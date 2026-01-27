/**
 * Kie.ai API Client
 *
 * A client for connecting to the Kie.ai API (https://kieai.erweima.ai/api/v1) which provides
 * access to AI models through an OpenAI-compatible chat/completions endpoint.
 *
 * IMPORTANT: As of January 2026, Kie.ai's chat/completions API supports models like:
 * - deepseek-chat, deepseek-coder, deepseek-reasoner (confirmed working)
 * - Claude models are NOT currently available through the chat/completions API
 *   (the marketplace UI may offer them, but not the programmatic API)
 *
 * This client uses the OpenAI-compatible format with Bearer token authentication.
 * It provides retry logic, rate limiting, streaming, and comprehensive error handling.
 *
 * Feature #1456: Create Kie.ai API client class with authentication
 */

// Configuration interface
export interface KieAIClientConfig {
  apiKey?: string;
  apiUrl?: string;
  defaultModel?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  rateLimitRpm?: number;
}

// Message types for Claude-compatible API
export interface KieMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface KieSendMessageOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  stream?: boolean;
  stopSequences?: string[];
}

export interface KieAIResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string | null;
  provider: 'kie';
}

export interface KieStreamCallbacks {
  onText?: (text: string) => void;
  onComplete?: (response: KieAIResponse) => void;
  onError?: (error: Error) => void;
}

// Error classes for Kie.ai API errors
export class KieAPIError extends Error {
  status: number;
  code?: string;
  retryable: boolean;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'KieAPIError';
    this.status = status;
    this.code = code;
    // Only retry on rate limits (429) and server errors (5xx), but NOT for model_not_found
    // Kie.ai returns status 500 for "Operation not found" but these shouldn't be retried
    this.retryable = (status === 429 || status >= 500) && code !== 'model_not_found';
  }
}

// Rate limiter class
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number = 60000; // 1 minute window

  constructor(maxRequestsPerMinute: number) {
    this.maxRequests = maxRequestsPerMinute;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();

    // Remove requests older than the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      // Calculate wait time
      const oldestRequest = this.requests[0] ?? now;
      const waitTime = this.windowMs - (now - oldestRequest);

      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      // Clean up again after waiting
      this.requests = this.requests.filter(time => Date.now() - time < this.windowMs);
    }

    this.requests.push(Date.now());
  }
}

// Usage tracking
export interface KieUsageStats {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  requestsByModel: Record<string, number>;
  successfulRequests: number;
  failedRequests: number;
}

// Token pricing for models available through Kie.ai (per 1M tokens)
// Note: As of Jan 2026, Claude models are NOT available through Kie.ai's chat API
// These are the models confirmed to work with Kie.ai:
const KIE_TOKEN_PRICING = {
  // DeepSeek models (confirmed working)
  'deepseek-chat': { input: 0.14, output: 0.28 },      // DeepSeek V3
  'deepseek-coder': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 }, // DeepSeek R1
  // Other available models (pricing estimated)
  'qwen-turbo': { input: 0.10, output: 0.20 },
  'qwen-plus': { input: 0.50, output: 1.00 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  // Claude pricing (70% discount from Anthropic direct pricing)
  // Note: Claude models may not be available via Kie.ai chat API
  'claude-3-haiku-20240307': { input: 0.075, output: 0.375 },  // 70% off $0.25/$1.25
  'claude-sonnet-4-5': { input: 0.90, output: 4.50 },          // 70% off $3.00/$15.00
  'claude-3-5-sonnet-20241022': { input: 0.90, output: 4.50 }, // 70% off $3.00/$15.00
  'claude-sonnet-4-20250514': { input: 0.90, output: 4.50 },   // 70% off $3.00/$15.00
  'claude-3-opus-20240229': { input: 4.50, output: 22.50 },    // 70% off $15.00/$75.00
  'claude-opus-4-5-thinking': { input: 4.50, output: 22.50 },
} as const;

/**
 * KieAIClient - Client for Kie.ai API
 *
 * Provides access to Claude models through Kie.ai's API with 70% cost savings.
 * Implements retry logic, rate limiting, streaming, and comprehensive error handling.
 */
export class KieAIClient {
  private config: Required<KieAIClientConfig>;
  private rateLimiter: RateLimiter;
  private usageStats: KieUsageStats = {
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    requestsByModel: {},
    successfulRequests: 0,
    failedRequests: 0,
  };
  private initialized = false;

  constructor(config: KieAIClientConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.KIE_API_KEY || '',
      apiUrl: config.apiUrl || process.env.KIE_API_URL || 'https://kieai.erweima.ai/api/v1',
      defaultModel: config.defaultModel || process.env.KIE_DEFAULT_MODEL || 'deepseek-chat',
      maxRetries: config.maxRetries ?? parseInt(process.env.AI_RETRY_COUNT || '3', 10),
      retryDelayMs: config.retryDelayMs ?? 1000,
      timeoutMs: config.timeoutMs ?? parseInt(process.env.AI_TIMEOUT_MS || '50000', 10),
      rateLimitRpm: config.rateLimitRpm ?? 50,
    };

    this.rateLimiter = new RateLimiter(this.config.rateLimitRpm);

    // Auto-initialize if API key is available
    if (this.config.apiKey) {
      this.initialized = true;
      console.log('[KieAIClient] Initialized with API key');
    } else {
      console.warn('[KieAIClient] No API key provided - Kie.ai features will be disabled');
    }
  }

  /**
   * Initialize the client with an API key
   */
  initialize(apiKey?: string): void {
    const key = apiKey || this.config.apiKey;

    if (!key) {
      console.warn('[KieAIClient] No API key provided - Kie.ai features will be disabled');
      this.initialized = false;
      return;
    }

    this.config.apiKey = key;
    this.initialized = true;
    console.log('[KieAIClient] Initialized successfully');
  }

  /**
   * Check if the client is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized && !!this.config.apiKey;
  }

  /**
   * Send a message to the Kie.ai API and get a response
   */
  async sendMessage(
    messages: KieMessage[],
    options: KieSendMessageOptions = {}
  ): Promise<KieAIResponse> {
    if (!this.isInitialized()) {
      throw new KieAPIError('Kie.ai client not initialized. Please provide a valid KIE_API_KEY.', 401);
    }

    const model = options.model || this.config.defaultModel;
    const maxTokens = options.maxTokens || 4096;
    const temperature = options.temperature ?? 0.7;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // Wait for rate limit slot
        await this.rateLimiter.waitForSlot();

        // Build request body (OpenAI-compatible format for Kie.ai)
        // Kie.ai uses OpenAI chat/completions format with Bearer auth
        const allMessages: Array<{ role: string; content: string }> = [];

        // Add system message first if provided
        const systemMessage = messages.find(m => m.role === 'system');
        if (options.systemPrompt) {
          allMessages.push({ role: 'system', content: options.systemPrompt });
        } else if (systemMessage) {
          allMessages.push({ role: 'system', content: systemMessage.content });
        }

        // Add other messages
        messages.filter(m => m.role !== 'system').forEach(msg => {
          allMessages.push({ role: msg.role, content: msg.content });
        });

        const requestBody: Record<string, unknown> = {
          model,
          max_tokens: maxTokens,
          temperature,
          messages: allMessages,
          stream: false,
        };

        if (options.stopSequences && options.stopSequences.length > 0) {
          requestBody.stop = options.stopSequences;
        }

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

        try {
          const response = await fetch(`${this.config.apiUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorBody = await response.text();
            let errorMessage = `Kie.ai API error: ${response.status}`;
            let errorCode: string | undefined;

            try {
              const errorJson = JSON.parse(errorBody);
              errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
              errorCode = errorJson.error?.type || errorJson.type;
            } catch {
              // Use raw error body if not JSON
              errorMessage = errorBody || errorMessage;
            }

            throw new KieAPIError(errorMessage, response.status, errorCode);
          }

          const data = await response.json();

          // Check for Kie.ai specific error response format
          // Kie.ai returns HTTP 200 but with { code: 500, msg: "Operation not found: ..." }
          if (data.code && data.code !== 200 && data.msg) {
            throw new KieAPIError(
              data.msg,
              data.code,
              data.msg.includes('Operation not found') ? 'model_not_found' : undefined
            );
          }

          // Extract text content from OpenAI-compatible response format
          // Format: { choices: [{ message: { content: "..." } }], usage: { prompt_tokens, completion_tokens } }
          const textContent = data.choices?.[0]?.message?.content ||
            // Fallback to Anthropic format if present
            data.content?.filter((block: { type: string }) => block.type === 'text')
              ?.map((block: { text: string }) => block.text)
              ?.join('') || '';

          const result: KieAIResponse = {
            content: textContent,
            model: data.model || model,
            // OpenAI format uses prompt_tokens/completion_tokens, Anthropic uses input_tokens/output_tokens
            inputTokens: data.usage?.prompt_tokens || data.usage?.input_tokens || 0,
            outputTokens: data.usage?.completion_tokens || data.usage?.output_tokens || 0,
            stopReason: data.choices?.[0]?.finish_reason || data.stop_reason || null,
            provider: 'kie',
          };

          // Track usage
          this.trackUsage(result, true);

          return result;

        } finally {
          clearTimeout(timeoutId);
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        if (this.isRetryableError(error)) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          console.warn(`[KieAIClient] Retrying in ${delay}ms (attempt ${attempt + 1}/${this.config.maxRetries}):`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Track failed request
          this.usageStats.failedRequests++;
          throw lastError;
        }
      }
    }

    // Track failed request after all retries exhausted
    this.usageStats.failedRequests++;
    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Send a message with streaming support
   */
  async sendMessageStream(
    messages: KieMessage[],
    options: KieSendMessageOptions = {},
    callbacks: KieStreamCallbacks = {}
  ): Promise<KieAIResponse> {
    if (!this.isInitialized()) {
      throw new KieAPIError('Kie.ai client not initialized. Please provide a valid KIE_API_KEY.', 401);
    }

    const model = options.model || this.config.defaultModel;
    const maxTokens = options.maxTokens || 4096;
    const temperature = options.temperature ?? 0.7;

    // Wait for rate limit slot
    await this.rateLimiter.waitForSlot();

    try {
      // Build request body (OpenAI-compatible format for Kie.ai streaming)
      const allMessages: Array<{ role: string; content: string }> = [];

      // Add system message first if provided
      const systemMessage = messages.find(m => m.role === 'system');
      if (options.systemPrompt) {
        allMessages.push({ role: 'system', content: options.systemPrompt });
      } else if (systemMessage) {
        allMessages.push({ role: 'system', content: systemMessage.content });
      }

      // Add other messages
      messages.filter(m => m.role !== 'system').forEach(msg => {
        allMessages.push({ role: msg.role, content: msg.content });
      });

      const requestBody: Record<string, unknown> = {
        model,
        max_tokens: maxTokens,
        temperature,
        stream: true,
        messages: allMessages,
      };

      if (options.stopSequences && options.stopSequences.length > 0) {
        requestBody.stop = options.stopSequences;
      }

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const response = await fetch(`${this.config.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new KieAPIError(
          `Kie.ai API streaming error: ${response.status} - ${errorBody}`,
          response.status
        );
      }

      if (!response.body) {
        throw new KieAPIError('No response body for streaming', 500);
      }

      let fullContent = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let stopReason: string | null = null;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();

            if (data === '[DONE]') continue;

            try {
              const event = JSON.parse(data);

              // OpenAI streaming format: { choices: [{ delta: { content: "..." } }] }
              if (event.choices?.[0]?.delta?.content) {
                const text = event.choices[0].delta.content;
                fullContent += text;
                callbacks.onText?.(text);
              }

              // Check for finish reason
              if (event.choices?.[0]?.finish_reason) {
                stopReason = event.choices[0].finish_reason;
              }

              // Get usage from final chunk (OpenAI format)
              if (event.usage) {
                inputTokens = event.usage.prompt_tokens || inputTokens;
                outputTokens = event.usage.completion_tokens || outputTokens;
              }

              // Also handle Anthropic format as fallback
              if (event.type === 'content_block_delta' && event.delta?.text) {
                fullContent += event.delta.text;
                callbacks.onText?.(event.delta.text);
              } else if (event.type === 'message_delta') {
                if (event.usage?.output_tokens) {
                  outputTokens = event.usage.output_tokens;
                }
                if (event.delta?.stop_reason) {
                  stopReason = event.delta.stop_reason;
                }
              } else if (event.type === 'message_start') {
                if (event.message?.usage?.input_tokens) {
                  inputTokens = event.message.usage.input_tokens;
                }
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      const result: KieAIResponse = {
        content: fullContent,
        model,
        inputTokens,
        outputTokens,
        stopReason,
        provider: 'kie',
      };

      // Track usage
      this.trackUsage(result, true);

      callbacks.onComplete?.(result);
      return result;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.usageStats.failedRequests++;
      callbacks.onError?.(err);
      throw err;
    }
  }

  /**
   * Simple helper for single-turn conversations
   */
  async ask(
    question: string,
    options: KieSendMessageOptions = {}
  ): Promise<string> {
    const response = await this.sendMessage(
      [{ role: 'user', content: question }],
      options
    );
    return response.content;
  }

  /**
   * Track token usage and cost
   */
  private trackUsage(response: KieAIResponse, success: boolean): void {
    this.usageStats.totalRequests++;
    if (success) {
      this.usageStats.successfulRequests++;
    }
    this.usageStats.totalInputTokens += response.inputTokens;
    this.usageStats.totalOutputTokens += response.outputTokens;

    // Track by model
    this.usageStats.requestsByModel[response.model] =
      (this.usageStats.requestsByModel[response.model] || 0) + 1;

    // Calculate cost (70% discount from standard Anthropic pricing)
    const pricing = KIE_TOKEN_PRICING[response.model as keyof typeof KIE_TOKEN_PRICING] ||
      KIE_TOKEN_PRICING['claude-sonnet-4-5'];

    const inputCost = (response.inputTokens / 1_000_000) * pricing.input;
    const outputCost = (response.outputTokens / 1_000_000) * pricing.output;
    this.usageStats.totalCostUsd += inputCost + outputCost;
  }

  /**
   * Get current usage statistics
   */
  getUsageStats(): KieUsageStats {
    return { ...this.usageStats };
  }

  /**
   * Reset usage statistics
   */
  resetUsageStats(): void {
    this.usageStats = {
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
      requestsByModel: {},
      successfulRequests: 0,
      failedRequests: 0,
    };
  }

  /**
   * Estimate tokens for a message (rough approximation)
   */
  estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate estimated cost for tokens (with Kie.ai 70% discount)
   */
  estimateCost(inputTokens: number, outputTokens: number, model?: string): number {
    const pricing = KIE_TOKEN_PRICING[(model || this.config.defaultModel) as keyof typeof KIE_TOKEN_PRICING] ||
      KIE_TOKEN_PRICING['claude-sonnet-4-5'];

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof KieAPIError) {
      // Retry on rate limits (429) and server errors (5xx)
      return error.retryable;
    }

    // Retry on network errors
    if (error instanceof Error) {
      return error.message.includes('ECONNRESET') ||
             error.message.includes('ETIMEDOUT') ||
             error.message.includes('network') ||
             error.message.includes('abort') ||
             error.name === 'AbortError';
    }

    return false;
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return Object.keys(KIE_TOKEN_PRICING);
  }

  /**
   * Get the current configuration (read-only)
   */
  getConfig(): Readonly<Required<KieAIClientConfig>> {
    return { ...this.config };
  }

  /**
   * Perform a health check by sending a minimal request to the API
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'offline';
    latency_ms: number;
    model: string;
    error?: string;
    checked_at: string;
  }> {
    if (!this.isInitialized()) {
      return {
        status: 'offline',
        latency_ms: 0,
        model: this.config.defaultModel,
        error: 'Kie.ai client not initialized - no API key configured',
        checked_at: new Date().toISOString(),
      };
    }

    const startTime = Date.now();
    try {
      // Send a minimal request to check API health using haiku for speed
      await this.sendMessage(
        [{ role: 'user', content: 'Hi' }],
        { model: 'claude-3-haiku-20240307', maxTokens: 10 }
      );

      const latency = Date.now() - startTime;
      return {
        status: latency < 5000 ? 'healthy' : 'degraded',
        latency_ms: latency,
        model: this.config.defaultModel,
        checked_at: new Date().toISOString(),
      };

    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Determine status based on error type
      let status: 'healthy' | 'degraded' | 'offline' = 'offline';
      if (error instanceof KieAPIError && error.status === 429) {
        status = 'degraded'; // Rate limited but still working
      }

      return {
        status,
        latency_ms: latency,
        model: this.config.defaultModel,
        error: errorMessage,
        checked_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Get detailed provider status including health and usage
   */
  async getProviderStatus(): Promise<{
    provider: string;
    status: 'healthy' | 'degraded' | 'offline';
    is_configured: boolean;
    model: string;
    api_url: string;
    usage: KieUsageStats;
    health_check?: {
      status: 'healthy' | 'degraded' | 'offline';
      latency_ms: number;
      model: string;
      error?: string;
      checked_at: string;
    };
  }> {
    const healthResult = this.isInitialized() ? await this.healthCheck() : undefined;

    return {
      provider: 'kie',
      status: this.isInitialized()
        ? (healthResult?.status || 'offline')
        : 'offline',
      is_configured: this.isInitialized(),
      model: this.config.defaultModel,
      api_url: this.config.apiUrl,
      usage: this.getUsageStats(),
      health_check: healthResult,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<KieAIClientConfig>): void {
    if (config.apiKey !== undefined) {
      this.config.apiKey = config.apiKey;
      this.initialize(config.apiKey);
    }
    if (config.apiUrl !== undefined) {
      this.config.apiUrl = config.apiUrl;
    }
    if (config.defaultModel !== undefined) {
      this.config.defaultModel = config.defaultModel;
    }
    if (config.maxRetries !== undefined) {
      this.config.maxRetries = config.maxRetries;
    }
    if (config.retryDelayMs !== undefined) {
      this.config.retryDelayMs = config.retryDelayMs;
    }
    if (config.timeoutMs !== undefined) {
      this.config.timeoutMs = config.timeoutMs;
    }
    if (config.rateLimitRpm !== undefined) {
      this.config.rateLimitRpm = config.rateLimitRpm;
      this.rateLimiter = new RateLimiter(config.rateLimitRpm);
    }
  }
}

// Export singleton instance
export const kieAIClient = new KieAIClient();

// Export types and class for testing
export default KieAIClient;
