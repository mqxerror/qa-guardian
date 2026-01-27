/**
 * Webhook Callback Utilities for MCP Server
 * Extracted from server.ts for code organization (Feature #1356)
 *
 * This module handles webhook callback configuration, parsing, and execution.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Webhook callback configuration
 */
export interface WebhookCallbackConfig {
  url: string; // Callback URL
  method?: 'POST' | 'PUT'; // HTTP method (default: POST)
  headers?: Record<string, string>; // Custom headers
  includeRequestParams?: boolean; // Include original request params in payload
  retries?: number; // Number of retries on failure (default: 3)
  timeout?: number; // Timeout in ms (default: 10000)
  secret?: string; // HMAC secret for signing payload
}

/**
 * Webhook callback payload
 */
export interface WebhookCallbackPayload {
  timestamp: number;
  requestId: string | number | undefined;
  toolName: string;
  status: 'success' | 'error';
  duration_ms: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
  requestParams?: Record<string, unknown>;
  streaming?: {
    streamId: string;
    totalItems: number;
    totalChunks: number;
  };
  signature?: string; // HMAC signature if secret is configured
}

/**
 * Result of a webhook callback attempt
 */
export interface WebhookCallbackResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Send webhook callback for operation completion
 *
 * @param callbackConfig - The webhook configuration
 * @param payload - The payload to send
 * @param logFn - Optional logging function
 * @returns Result indicating success or failure
 */
export async function sendWebhookCallback(
  callbackConfig: WebhookCallbackConfig,
  payload: WebhookCallbackPayload,
  logFn?: (msg: string) => void
): Promise<WebhookCallbackResult> {
  const log = logFn || (() => {});
  const {
    url,
    method = 'POST',
    headers = {},
    retries = 3,
    timeout = 10000,
    secret,
  } = callbackConfig;

  // Sign payload if secret is provided
  let signature: string | undefined;
  if (secret) {
    try {
      const crypto = await import('crypto');
      const payloadString = JSON.stringify(payload);
      signature = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');
      payload.signature = signature;
    } catch (error) {
      log(`[WEBHOOK] Failed to sign payload: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  const payloadString = JSON.stringify(payload);

  // Retry logic
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-QA-Guardian-Event': 'mcp.operation.complete',
          'X-QA-Guardian-Timestamp': String(payload.timestamp),
          ...(signature ? { 'X-QA-Guardian-Signature': `sha256=${signature}` } : {}),
          ...headers,
        },
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        log(`[WEBHOOK] Callback sent successfully to ${url} (attempt ${attempt})`);
        return { success: true, statusCode: response.status };
      }

      log(`[WEBHOOK] Callback failed with status ${response.status} (attempt ${attempt}/${retries})`);

      // Don't retry on client errors (4xx) except 429
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return { success: false, statusCode: response.status, error: `HTTP ${response.status}` };
      }

      // Wait before retry with exponential backoff
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`[WEBHOOK] Callback error (attempt ${attempt}/${retries}): ${errorMessage}`);

      if (attempt === retries) {
        return { success: false, error: errorMessage };
      }

      // Wait before retry
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

/**
 * Parse webhook callback config from tool arguments
 *
 * @param args - The tool arguments that may contain _callback
 * @param enableWebhookCallbacks - Whether webhooks are enabled (defaults to true)
 * @param logFn - Optional logging function
 * @returns The parsed webhook config or undefined if not valid
 */
export function parseWebhookCallback(
  args?: Record<string, unknown>,
  enableWebhookCallbacks: boolean = true,
  logFn?: (msg: string) => void
): WebhookCallbackConfig | undefined {
  const log = logFn || (() => {});

  if (!args) return undefined;

  // Check if per-request callbacks are enabled
  if (enableWebhookCallbacks === false) {
    return undefined;
  }

  // Parse _callback parameter from args
  const callback = args._callback as Record<string, unknown> | string | undefined;
  if (!callback) return undefined;

  // Simple string URL
  if (typeof callback === 'string') {
    try {
      new URL(callback);
      return { url: callback };
    } catch {
      log(`[WEBHOOK] Invalid callback URL: ${callback}`);
      return undefined;
    }
  }

  // Full callback config object
  if (typeof callback === 'object' && callback.url) {
    const url = callback.url as string;
    try {
      new URL(url);
      return {
        url,
        method: (callback.method as 'POST' | 'PUT') || 'POST',
        headers: callback.headers as Record<string, string>,
        includeRequestParams: callback.includeRequestParams as boolean,
        retries: callback.retries as number,
        timeout: callback.timeout as number,
        secret: callback.secret as string,
      };
    } catch {
      log(`[WEBHOOK] Invalid callback URL: ${url}`);
      return undefined;
    }
  }

  return undefined;
}

/**
 * Create a success callback payload
 *
 * @param requestId - The request ID
 * @param toolName - The tool name
 * @param result - The successful result
 * @param duration_ms - The operation duration
 * @param requestParams - Optional original request params
 * @param streaming - Optional streaming metadata
 * @returns The callback payload
 */
export function createSuccessPayload(
  requestId: string | number | undefined,
  toolName: string,
  result: unknown,
  duration_ms: number,
  requestParams?: Record<string, unknown>,
  streaming?: { streamId: string; totalItems: number; totalChunks: number }
): WebhookCallbackPayload {
  return {
    timestamp: Date.now(),
    requestId,
    toolName,
    status: 'success',
    duration_ms,
    result,
    ...(requestParams ? { requestParams } : {}),
    ...(streaming ? { streaming } : {}),
  };
}

/**
 * Create an error callback payload
 *
 * @param requestId - The request ID
 * @param toolName - The tool name
 * @param error - The error details
 * @param duration_ms - The operation duration
 * @param requestParams - Optional original request params
 * @returns The callback payload
 */
export function createErrorPayload(
  requestId: string | number | undefined,
  toolName: string,
  error: { code: number; message: string },
  duration_ms: number,
  requestParams?: Record<string, unknown>
): WebhookCallbackPayload {
  return {
    timestamp: Date.now(),
    requestId,
    toolName,
    status: 'error',
    duration_ms,
    error,
    ...(requestParams ? { requestParams } : {}),
  };
}
