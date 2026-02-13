/**
 * MCP Tools Module - Helper Functions
 * Feature #730: Split mcp-tools/routes.ts into sub-modules
 *
 * Contains error checking utilities, AI initialization, and context creation.
 */

import { FastifyRequest } from 'fastify';
import { aiRouter } from '../../services/providers/ai-router.js';
import { HandlerContext } from '../../mcp/handlers/types.js';
import { createLogger } from '../../services/logger.js';

// Use structured Pino logger with convenience wrappers
const pinoLog = createLogger('mcp-rest');
export const logger = {
  info: (msg: string) => pinoLog.info(msg),
  error: (msg: string, err?: unknown) => err ? pinoLog.error({ err }, msg) : pinoLog.error(msg),
};

/**
 * Error patterns to detect in tool results
 * These patterns indicate the tool execution failed even if no exception was thrown
 */
const ERROR_PATTERNS = [
  /not found/i,
  /error:/i,
  /failed/i,
  /invalid/i,
  /unauthorized/i,
  /forbidden/i,
  /does not exist/i,
  /cannot find/i,
  /no .* found/i,
  /route .* not found/i,
  /404/i,
  /500/i,
  /503/i,
  /timeout/i,
  /connection refused/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
];

/**
 * Check if a tool result contains error indicators
 * Returns { hasError: boolean, errorMessage: string }
 *
 * IMPORTANT: Check for explicit success indicators FIRST before pattern matching.
 * This prevents false positives where successful responses contain words like "not found"
 * in legitimate contexts (e.g., "no flaky tests found").
 */
export function checkForErrorInResult(result: unknown): { hasError: boolean; errorMessage: string } {
  // Handle null/undefined
  if (result === null || result === undefined) {
    return { hasError: true, errorMessage: 'Tool returned empty result' };
  }

  // Check for explicit success/error properties in object results FIRST
  // This must happen before pattern matching to avoid false positives
  if (typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>;

    // If success is explicitly true, this is not an error regardless of content
    if (obj.success === true) {
      return { hasError: false, errorMessage: '' };
    }

    // Check for error property
    if (obj.error) {
      return { hasError: true, errorMessage: String(obj.error) };
    }

    // Check for success: false
    if (obj.success === false) {
      return {
        hasError: true,
        errorMessage: obj.message ? String(obj.message) : 'Operation returned success: false'
      };
    }

    // Check for status codes
    if (typeof obj.statusCode === 'number' && obj.statusCode >= 400) {
      return {
        hasError: true,
        errorMessage: `HTTP ${obj.statusCode}: ${obj.message || 'Request failed'}`
      };
    }

    // Check for empty arrays that might indicate "not found"
    if (Array.isArray(obj.data) && obj.data.length === 0 && obj.total === 0) {
      // This is OK - empty results are not errors
      return { hasError: false, errorMessage: '' };
    }

    // Check for common success data fields that indicate a successful response
    // When these fields exist without an error field, the response is successful
    const successDataFields = [
      'suite', 'suites', 'project', 'projects', 'test', 'tests', 'run', 'runs',
      'result', 'results', 'organization', 'data', 'items', 'artifacts',
      'findings', 'report', 'baseline', 'metrics', 'stats', 'summary',
      'flaky_tests', 'failing_tests', 'coverage', 'incidents', 'alerts',
    ];

    // If the response has any of these data fields and no error field, it's successful
    if (!obj.error && !obj.statusCode) {
      for (const field of successDataFields) {
        if (field in obj && obj[field] !== undefined) {
          return { hasError: false, errorMessage: '' };
        }
      }
    }
  }

  // Convert to string for pattern matching (only if we didn't find explicit success/error)
  const resultStr = typeof result === 'string' ? result : JSON.stringify(result);

  // Check for error patterns only when there's no explicit success indicator
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(resultStr)) {
      // Extract more context for the error message
      const match = resultStr.match(pattern);
      return {
        hasError: true,
        errorMessage: match ? `Error detected: ${resultStr.substring(0, 200)}` : 'Unknown error in result'
      };
    }
  }

  return { hasError: false, errorMessage: '' };
}

/**
 * Ensure AI router is initialized with API keys from environment
 * This handles the case where the singleton was created before dotenv loaded
 */
export function ensureAIInitialized(): boolean {
  if (aiRouter.isInitialized()) {
    return true;
  }

  // Try to reinitialize with current env vars
  logger.info('AI router not initialized, attempting to reinitialize with env vars...');

  // Use the new reinitializeFromEnv method
  const success = aiRouter.reinitializeFromEnv();

  if (success) {
    logger.info('AI router reinitialized successfully');
  } else {
    logger.error('AI router reinitialization failed - check API keys in .env');
  }

  return aiRouter.isInitialized();
}

/**
 * Create a handler context for REST API calls
 */
export function createHandlerContext(request: FastifyRequest): HandlerContext {
  const apiUrl = process.env.QA_GUARDIAN_API_URL || 'http://localhost:3001';
  const apiKey = request.headers['x-api-key'] as string | undefined;
  // Also check for JWT token in Authorization header
  const authHeader = request.headers['authorization'] as string | undefined;

  return {
    callApi: async (endpoint: string, options?: { method?: string; body?: Record<string, unknown> }) => {
      // For REST API calls, we make internal HTTP requests
      const url = `${apiUrl}${endpoint}`;
      const method = options?.method || 'GET';

      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          // Forward authentication - prefer API key, fallback to JWT
          ...(apiKey ? { 'X-API-Key': apiKey } : {}),
          ...(authHeader && !apiKey ? { 'Authorization': authHeader } : {}),
        },
      };

      if (options?.body && method !== 'GET') {
        fetchOptions.body = JSON.stringify(options.body);
      }

      const response = await fetch(url, fetchOptions);
      return response.json();
    },
    callApiPublic: async (endpoint: string) => {
      const url = `${apiUrl}${endpoint}`;
      const response = await fetch(url);
      return response.json();
    },
    log: (message: string) => {
      logger.info(message);
    },
    apiKey,
    apiUrl,
  };
}

/**
 * List of tools that support real AI execution
 */
export const AI_POWERED_TOOLS = [
  // AI Generation tools
  'generate_test',
  'generate_test_from_description',
  'generate_test_suite',
  'convert_gherkin',
  'analyze_screenshot',
  'get_coverage_gaps',
  // AI Analysis tools
  'explain_test_failure_ai',
  'suggest_test_improvements',
  'analyze_test_failure',
  'get_ai_recommendations',
  // AI Chat tools
  'chat_with_ai',
  'get_ai_help',
];
