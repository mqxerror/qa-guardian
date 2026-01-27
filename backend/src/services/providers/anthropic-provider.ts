/**
 * Anthropic Provider
 *
 * Implementation of IAIProvider interface using @anthropic-ai/sdk.
 * Provides direct access to Anthropic's Claude models.
 *
 * Feature #1460: Implement Anthropic provider using abstraction
 */

import Anthropic from '@anthropic-ai/sdk';

import type {
  IAIProvider,
  AIMessage,
  AISendMessageOptions,
  AIResponse,
  StreamCallbacks,
  AIUsageStats,
  HealthCheckResult,
  HealthMetrics,
  ProviderStatus,
  ProviderConfig,
  AIProviderError,
  AIMessageContent,
  AIImageContent,
  AITextContent,
} from './types.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface AnthropicProviderConfig extends ProviderConfig {
  // Anthropic-specific options can go here
}

// Token pricing (per 1M tokens) - Anthropic Claude pricing
const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
};

// Health check thresholds
const LATENCY_THRESHOLDS = {
  healthy: 2000,    // < 2s is healthy
  degraded: 5000,   // < 5s is degraded, >= 5s is offline
};

// Maximum number of latency samples to keep
const MAX_LATENCY_SAMPLES = 100;

/** Represents a latency sample with success/failure status */
interface LatencySample {
  latency_ms: number;
  success: boolean;
  timestamp: number;
}

// =============================================================================
// ERROR CLASS
// =============================================================================

/**
 * Custom error class for Anthropic API errors
 */
export class AnthropicAPIError extends Error implements AIProviderError {
  status: number;
  code?: string;
  retryable: boolean;

  constructor(message: string, status: number, code?: string, retryable = false) {
    super(message);
    this.name = 'AnthropicAPIError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

// =============================================================================
// RATE LIMITER
// =============================================================================

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

// =============================================================================
// ANTHROPIC PROVIDER CLASS
// =============================================================================

/**
 * AnthropicProvider - IAIProvider implementation using Anthropic SDK
 *
 * Provides direct access to Claude models via Anthropic's API.
 */
export class AnthropicProvider implements IAIProvider {
  private client: Anthropic | null = null;
  private config: Required<ProviderConfig>;
  private rateLimiter: RateLimiter;
  private usageStats: AIUsageStats = {
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    requestsByModel: {},
    successfulRequests: 0,
    failedRequests: 0,
  };
  private initialized = false;

  // Latency tracking for health metrics
  private latencySamples: LatencySample[] = [];
  private consecutiveFailures = 0;
  private lastHealthCheckAt: string = new Date().toISOString();

  constructor(config: AnthropicProviderConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY || '',
      apiUrl: config.apiUrl || 'https://api.anthropic.com/v1',
      defaultModel: config.defaultModel || 'claude-sonnet-4-20250514',
      maxRetries: config.maxRetries ?? parseInt(process.env.AI_RETRY_COUNT || '3', 10),
      retryDelayMs: config.retryDelayMs ?? 1000,
      timeoutMs: config.timeoutMs ?? 50000,
      rateLimitRpm: config.rateLimitRpm ?? 50,
    };

    this.rateLimiter = new RateLimiter(this.config.rateLimitRpm);

    // Auto-initialize if API key is available
    if (this.config.apiKey) {
      this.initialize();
    }
  }

  /**
   * Initialize the Anthropic client
   */
  initialize(apiKey?: string): void {
    const key = apiKey || this.config.apiKey;

    if (!key) {
      console.warn('[AnthropicProvider] No API key provided - AI features will be disabled');
      this.client = null;
      this.initialized = false;
      return;
    }

    try {
      this.client = new Anthropic({
        apiKey: key,
      });
      this.config.apiKey = key;
      this.initialized = true;
      console.log('[AnthropicProvider] Initialized successfully');
    } catch (error) {
      console.error('[AnthropicProvider] Failed to initialize:', error);
      this.client = null;
      this.initialized = false;
    }
  }

  /**
   * Check if the provider is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * Convert AIMessageContent to Anthropic content format
   * Handles both simple strings and multimodal content (text + images)
   */
  private convertToAnthropicContent(
    content: AIMessageContent
  ): string | Anthropic.ContentBlockParam[] {
    // Simple string content
    if (typeof content === 'string') {
      return content;
    }

    // Multimodal content (array of text/image blocks)
    return content.map(block => {
      if (block.type === 'text') {
        return {
          type: 'text' as const,
          text: (block as AITextContent).text,
        };
      } else if (block.type === 'image') {
        const imageBlock = block as AIImageContent;
        if (imageBlock.source.type === 'base64') {
          return {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: imageBlock.source.media_type,
              data: imageBlock.source.data,
            },
          };
        } else {
          // URL-based image
          return {
            type: 'image' as const,
            source: {
              type: 'url' as const,
              url: imageBlock.source.url,
            },
          };
        }
      }
      // Fallback for unknown types
      return { type: 'text' as const, text: String(block) };
    });
  }

  /**
   * Send a message to Anthropic and get a response
   * Supports both text and vision (multimodal) messages
   */
  async sendMessage(
    messages: AIMessage[],
    options: AISendMessageOptions = {}
  ): Promise<AIResponse> {
    if (!this.client) {
      throw new AnthropicAPIError(
        'Anthropic provider not initialized. Please provide a valid API key.',
        401,
        'not_initialized',
        false
      );
    }

    const model = options.model || this.config.defaultModel;
    const maxTokens = options.maxTokens || 4096;
    const temperature = options.temperature ?? 0.7;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // Wait for rate limit slot
        await this.rateLimiter.waitForSlot();

        // Convert messages to Anthropic format, supporting multimodal content
        const anthropicMessages = messages.filter(m => m.role !== 'system').map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: this.convertToAnthropicContent(msg.content),
        }));

        const requestParams: Anthropic.MessageCreateParams = {
          model,
          max_tokens: maxTokens,
          temperature,
          messages: anthropicMessages,
        };

        // Add system prompt if provided
        const systemMessage = messages.find(m => m.role === 'system');
        if (options.systemPrompt) {
          requestParams.system = options.systemPrompt;
        } else if (systemMessage && typeof systemMessage.content === 'string') {
          requestParams.system = systemMessage.content;
        }

        // Add stop sequences if provided
        if (options.stopSequences && options.stopSequences.length > 0) {
          requestParams.stop_sequences = options.stopSequences;
        }

        const response = await this.client.messages.create(requestParams);

        // Extract text content
        const textContent = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map(block => block.text)
          .join('');

        const result: AIResponse = {
          content: textContent,
          model: response.model,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          stopReason: response.stop_reason,
          provider: 'anthropic',
        };

        // Track usage
        this.trackUsage(result, true);

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        if (this.isRetryableError(error)) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          console.warn(`[AnthropicProvider] Retrying in ${delay}ms (attempt ${attempt + 1}/${this.config.maxRetries}):`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          this.usageStats.failedRequests++;
          throw this.wrapError(error);
        }
      }
    }

    this.usageStats.failedRequests++;
    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Send a message with streaming support
   */
  async sendMessageStream(
    messages: AIMessage[],
    options: AISendMessageOptions = {},
    callbacks: StreamCallbacks = {}
  ): Promise<AIResponse> {
    if (!this.client) {
      throw new AnthropicAPIError(
        'Anthropic provider not initialized. Please provide a valid API key.',
        401,
        'not_initialized',
        false
      );
    }

    const model = options.model || this.config.defaultModel;
    const maxTokens = options.maxTokens || 4096;
    const temperature = options.temperature ?? 0.7;

    // Wait for rate limit slot
    await this.rateLimiter.waitForSlot();

    try {
      // Convert messages to Anthropic format, supporting multimodal content
      const anthropicMessages = messages.filter(m => m.role !== 'system').map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: this.convertToAnthropicContent(msg.content),
      }));

      const requestParams: Anthropic.MessageCreateParams = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: anthropicMessages,
        stream: true,
      };

      // Add system prompt if provided
      const systemMessage = messages.find(m => m.role === 'system');
      if (options.systemPrompt) {
        requestParams.system = options.systemPrompt;
      } else if (systemMessage && typeof systemMessage.content === 'string') {
        requestParams.system = systemMessage.content;
      }

      // Add stop sequences if provided
      if (options.stopSequences && options.stopSequences.length > 0) {
        requestParams.stop_sequences = options.stopSequences;
      }

      const stream = await this.client.messages.create(requestParams);

      let fullContent = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let stopReason: string | null = null;

      // Handle streaming response
      for await (const event of stream as AsyncIterable<Anthropic.MessageStreamEvent>) {
        if (event.type === 'content_block_delta') {
          const delta = event.delta;
          if ('text' in delta) {
            fullContent += delta.text;
            callbacks.onText?.(delta.text);
          }
        } else if (event.type === 'message_delta') {
          if ('usage' in event) {
            outputTokens = (event.usage as { output_tokens: number }).output_tokens;
          }
          if ('stop_reason' in event.delta) {
            stopReason = event.delta.stop_reason ?? null;
          }
        } else if (event.type === 'message_start') {
          if (event.message?.usage) {
            inputTokens = event.message.usage.input_tokens;
          }
        }
      }

      const result: AIResponse = {
        content: fullContent,
        model,
        inputTokens,
        outputTokens,
        stopReason,
        provider: 'anthropic',
      };

      // Track usage
      this.trackUsage(result, true);

      callbacks.onComplete?.(result);
      return result;

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.usageStats.failedRequests++;
      callbacks.onError?.(err);
      throw this.wrapError(error);
    }
  }

  /**
   * Simple helper for single-turn conversations
   */
  async ask(
    question: string,
    options: AISendMessageOptions = {}
  ): Promise<string> {
    const response = await this.sendMessage(
      [{ role: 'user', content: question }],
      options
    );
    return response.content;
  }

  /**
   * Perform a health check by sending a minimal request to the API
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const now = new Date().toISOString();
    this.lastHealthCheckAt = now;

    if (!this.client) {
      this.recordLatencySample(0, false);
      return {
        status: 'offline',
        latency_ms: 0,
        model: this.config.defaultModel,
        error: 'Anthropic provider not initialized - no API key configured',
        checked_at: now,
      };
    }

    const startTime = Date.now();
    try {
      // Send a minimal request to check API health
      await this.client.messages.create({
        model: this.config.defaultModel,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });

      const latency = Date.now() - startTime;

      // Record successful sample
      this.recordLatencySample(latency, true);
      this.consecutiveFailures = 0;

      // Determine status based on latency thresholds
      let status: 'healthy' | 'degraded' | 'offline' = 'healthy';
      if (latency >= LATENCY_THRESHOLDS.degraded) {
        status = 'degraded';
      } else if (latency >= LATENCY_THRESHOLDS.healthy) {
        status = 'degraded';
      }

      return {
        status,
        latency_ms: latency,
        model: this.config.defaultModel,
        checked_at: now,
      };

    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Record failed sample
      this.recordLatencySample(latency, false);
      this.consecutiveFailures++;

      // Determine status based on error type
      let status: 'healthy' | 'degraded' | 'offline' = 'offline';
      if (error instanceof Anthropic.APIError) {
        if (error.status === 429) {
          status = 'degraded'; // Rate limited but still working
        }
      }

      return {
        status,
        latency_ms: latency,
        model: this.config.defaultModel,
        error: errorMessage,
        checked_at: now,
      };
    }
  }

  /**
   * Record a latency sample for health metrics
   */
  private recordLatencySample(latency_ms: number, success: boolean): void {
    this.latencySamples.push({
      latency_ms,
      success,
      timestamp: Date.now(),
    });

    // Keep only the most recent samples
    if (this.latencySamples.length > MAX_LATENCY_SAMPLES) {
      this.latencySamples = this.latencySamples.slice(-MAX_LATENCY_SAMPLES);
    }
  }

  /**
   * Calculate percentile from an array of numbers
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }

  /**
   * Get detailed health metrics including latency percentiles
   */
  getHealthMetrics(): HealthMetrics {
    const latencies = this.latencySamples
      .filter(s => s.success)
      .map(s => s.latency_ms);

    const successCount = this.latencySamples.filter(s => s.success).length;
    const totalCount = this.latencySamples.length;
    const successRate = totalCount > 0 ? successCount / totalCount : 0;

    // Determine overall status based on metrics
    let status: 'healthy' | 'degraded' | 'offline' = 'offline';
    if (!this.initialized || !this.client) {
      status = 'offline';
    } else if (this.consecutiveFailures >= 3) {
      status = 'offline';
    } else if (successRate < 0.5 || this.consecutiveFailures > 0) {
      status = 'degraded';
    } else {
      const p95 = this.calculatePercentile(latencies, 95);
      if (p95 < LATENCY_THRESHOLDS.healthy) {
        status = 'healthy';
      } else if (p95 < LATENCY_THRESHOLDS.degraded) {
        status = 'degraded';
      } else {
        status = 'offline';
      }
    }

    return {
      provider: 'anthropic',
      status,
      p50_latency_ms: this.calculatePercentile(latencies, 50),
      p95_latency_ms: this.calculatePercentile(latencies, 95),
      p99_latency_ms: this.calculatePercentile(latencies, 99),
      avg_latency_ms: latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0,
      min_latency_ms: latencies.length > 0 ? Math.min(...latencies) : 0,
      max_latency_ms: latencies.length > 0 ? Math.max(...latencies) : 0,
      sample_count: latencies.length,
      last_check_at: this.lastHealthCheckAt,
      consecutive_failures: this.consecutiveFailures,
      success_rate: successRate,
    };
  }

  /**
   * Get current usage statistics
   */
  getUsageStats(): AIUsageStats {
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
   * Get detailed provider status including health and usage
   */
  async getProviderStatus(): Promise<ProviderStatus> {
    const healthResult = this.client ? await this.healthCheck() : undefined;

    return {
      provider: 'anthropic',
      status: this.client
        ? (healthResult?.status || 'offline')
        : 'offline',
      is_configured: this.initialized && !!this.config.apiKey,
      model: this.config.defaultModel,
      usage: this.getUsageStats(),
      health_check: healthResult,
    };
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return Object.keys(TOKEN_PRICING);
  }

  /**
   * Get the current configuration (read-only)
   */
  getConfig(): Readonly<Required<ProviderConfig>> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ProviderConfig>): void {
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

  /**
   * Estimate tokens for text (rough approximation)
   */
  estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate cost for tokens
   */
  estimateCost(inputTokens: number, outputTokens: number, model?: string): number {
    const pricing = TOKEN_PRICING[(model || this.config.defaultModel)] ||
      TOKEN_PRICING['claude-sonnet-4-20250514'];

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
  }

  /**
   * Track token usage and cost
   */
  private trackUsage(response: AIResponse, success: boolean): void {
    this.usageStats.totalRequests++;
    if (success) {
      this.usageStats.successfulRequests++;
    }
    this.usageStats.totalInputTokens += response.inputTokens;
    this.usageStats.totalOutputTokens += response.outputTokens;

    // Track by model
    this.usageStats.requestsByModel[response.model] =
      (this.usageStats.requestsByModel[response.model] || 0) + 1;

    // Calculate cost
    const pricing = TOKEN_PRICING[response.model] ||
      TOKEN_PRICING['claude-sonnet-4-20250514'];

    const inputCost = (response.inputTokens / 1_000_000) * pricing.input;
    const outputCost = (response.outputTokens / 1_000_000) * pricing.output;
    this.usageStats.totalCostUsd += inputCost + outputCost;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Anthropic.APIError) {
      // Retry on rate limits and server errors
      return error.status === 429 || error.status >= 500;
    }

    // Retry on network errors
    if (error instanceof Error) {
      return error.message.includes('ECONNRESET') ||
             error.message.includes('ETIMEDOUT') ||
             error.message.includes('network');
    }

    return false;
  }

  /**
   * Wrap error in AnthropicAPIError
   */
  private wrapError(error: unknown): AnthropicAPIError {
    if (error instanceof AnthropicAPIError) {
      return error;
    }

    if (error instanceof Anthropic.APIError) {
      return new AnthropicAPIError(
        error.message,
        error.status,
        undefined,
        this.isRetryableError(error)
      );
    }

    if (error instanceof Error) {
      return new AnthropicAPIError(
        error.message,
        500,
        'unknown_error',
        false
      );
    }

    return new AnthropicAPIError(
      String(error),
      500,
      'unknown_error',
      false
    );
  }
}

// Export singleton instance
export const anthropicProvider = new AnthropicProvider();

// Export default
export default AnthropicProvider;
