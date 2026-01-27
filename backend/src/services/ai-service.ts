/**
 * AI Service Module
 *
 * Centralized AI service that handles all AI API calls with proper
 * error handling, rate limiting, and fallback support.
 *
 * Feature #1458: Refactored to use provider abstraction for seamless
 * switching between Kie.ai and Anthropic providers.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { TextBlockParam } from '@anthropic-ai/sdk/resources/messages.js';
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
  AIMessageContent,
} from './providers/types.js';

// Re-export types for backward compatibility
export type Message = AIMessage;
export type SendMessageOptions = AISendMessageOptions;
export { AIResponse, StreamCallbacks };
export type UsageStats = AIUsageStats;

// Configuration interface (backward compatible)
export interface AIServiceConfig extends ProviderConfig {
  // All fields inherited from ProviderConfig
}

// Token pricing (per 1M tokens) - Claude pricing
const TOKEN_PRICING = {
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
} as const;

// Health check thresholds
const LATENCY_THRESHOLDS = {
  healthy: 2000,    // < 2s is healthy
  degraded: 5000,   // < 5s is degraded, >= 5s is offline
};

// Maximum number of latency samples to keep
const MAX_LATENCY_SAMPLES = 100;

/**
 * Convert AIMessageContent to Anthropic-compatible system content format.
 * Anthropic's system parameter only accepts string or TextBlockParam[] (no images).
 *
 * @param content - The AIMessageContent (string or array of text/image blocks)
 * @returns string | TextBlockParam[] compatible with Anthropic API
 */
function convertToAnthropicSystemContent(content: AIMessageContent): string | TextBlockParam[] {
  // If it's a string, return as-is
  if (typeof content === 'string') {
    return content;
  }

  // If it's an array, filter to text blocks only and convert to TextBlockParam format
  const textBlocks: TextBlockParam[] = content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map(block => ({
      type: 'text' as const,
      text: block.text,
    }));

  // If no text blocks found, return empty string
  if (textBlocks.length === 0) {
    return '';
  }

  // If only one text block, return as string for simplicity
  if (textBlocks.length === 1 && textBlocks[0]) {
    return textBlocks[0].text;
  }

  return textBlocks;
}

/** Represents a latency sample with success/failure status */
interface LatencySample {
  latency_ms: number;
  success: boolean;
  timestamp: number;
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

/**
 * AI Service class
 *
 * Implements IAIProvider interface and can delegate to other providers.
 * Supports runtime provider switching while maintaining backward compatibility.
 */
class AIService implements IAIProvider {
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

  // Provider delegation support
  private externalProvider: IAIProvider | null = null;
  private useExternalProvider = false;

  // Latency tracking for health metrics
  private latencySamples: LatencySample[] = [];
  private consecutiveFailures = 0;
  private lastHealthCheckAt: string = new Date().toISOString();

  constructor(config: AIServiceConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY || '',
      apiUrl: config.apiUrl || 'https://api.anthropic.com/v1',
      defaultModel: config.defaultModel || 'claude-sonnet-4-20250514',
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      timeoutMs: config.timeoutMs ?? 30000,
      rateLimitRpm: config.rateLimitRpm ?? 50,
    };

    this.rateLimiter = new RateLimiter(this.config.rateLimitRpm);
  }

  /**
   * Set an external provider to delegate all calls to.
   * This allows runtime switching between providers (e.g., Kie.ai, Anthropic).
   * @param provider - The provider to delegate to, or null to use built-in Anthropic
   */
  setProvider(provider: IAIProvider | null): void {
    this.externalProvider = provider;
    this.useExternalProvider = provider !== null;

    if (provider) {
      console.log('[AIService] Switched to external provider');
    } else {
      console.log('[AIService] Using built-in Anthropic provider');
    }
  }

  /**
   * Get the current provider (external or self)
   */
  getCurrentProvider(): IAIProvider {
    return this.useExternalProvider && this.externalProvider
      ? this.externalProvider
      : this;
  }

  /**
   * Initialize the Anthropic client
   */
  initialize(apiKey?: string): void {
    const key = apiKey || this.config.apiKey;

    if (!key) {
      console.warn('[AIService] No API key provided - AI features will be disabled');
      this.client = null;
      return;
    }

    try {
      this.client = new Anthropic({
        apiKey: key,
      });
      this.initialized = true;
      console.log('[AIService] Initialized successfully');
    } catch (error) {
      console.error('[AIService] Failed to initialize:', error);
      this.client = null;
    }
  }

  /**
   * Check if the service is properly initialized
   */
  isInitialized(): boolean {
    if (this.useExternalProvider && this.externalProvider) {
      return this.externalProvider.isInitialized();
    }
    return this.initialized && this.client !== null;
  }

  /**
   * Send a message to the AI provider and get a response
   */
  async sendMessage(
    messages: AIMessage[],
    options: AISendMessageOptions = {}
  ): Promise<AIResponse> {
    // Delegate to external provider if set
    if (this.useExternalProvider && this.externalProvider) {
      return this.externalProvider.sendMessage(messages, options);
    }

    // Use built-in Anthropic implementation
    if (!this.client) {
      throw new Error('AI service not initialized. Please provide a valid API key.');
    }

    const model = options.model || this.config.defaultModel;
    const maxTokens = options.maxTokens || 4096;
    const temperature = options.temperature ?? 0.7;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // Wait for rate limit slot
        await this.rateLimiter.waitForSlot();

        const requestParams: Anthropic.MessageCreateParams = {
          model,
          max_tokens: maxTokens,
          temperature,
          messages: messages.filter(m => m.role !== 'system').map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
        };

        // Add system prompt if provided
        const systemMessage = messages.find(m => m.role === 'system');
        if (options.systemPrompt) {
          requestParams.system = options.systemPrompt;
        } else if (systemMessage) {
          requestParams.system = convertToAnthropicSystemContent(systemMessage.content);
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
          console.warn(`[AIService] Retrying in ${delay}ms (attempt ${attempt + 1}/${this.config.maxRetries}):`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          this.usageStats.failedRequests++;
          throw lastError;
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
    // Delegate to external provider if set
    if (this.useExternalProvider && this.externalProvider) {
      return this.externalProvider.sendMessageStream(messages, options, callbacks);
    }

    // Use built-in Anthropic implementation
    if (!this.client) {
      throw new Error('AI service not initialized. Please provide a valid API key.');
    }

    const model = options.model || this.config.defaultModel;
    const maxTokens = options.maxTokens || 4096;
    const temperature = options.temperature ?? 0.7;

    // Wait for rate limit slot
    await this.rateLimiter.waitForSlot();

    try {
      const requestParams: Anthropic.MessageCreateParams = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: messages.filter(m => m.role !== 'system').map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        stream: true,
      };

      // Add system prompt if provided
      const systemMessage = messages.find(m => m.role === 'system');
      if (options.systemPrompt) {
        requestParams.system = options.systemPrompt;
      } else if (systemMessage) {
        requestParams.system = convertToAnthropicSystemContent(systemMessage.content);
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
      throw err;
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
    const pricing = TOKEN_PRICING[response.model as keyof typeof TOKEN_PRICING] ||
      TOKEN_PRICING['claude-sonnet-4-20250514'];

    const inputCost = (response.inputTokens / 1_000_000) * pricing.input;
    const outputCost = (response.outputTokens / 1_000_000) * pricing.output;
    this.usageStats.totalCostUsd += inputCost + outputCost;
  }

  /**
   * Get current usage statistics
   */
  getUsageStats(): AIUsageStats {
    if (this.useExternalProvider && this.externalProvider) {
      return this.externalProvider.getUsageStats();
    }
    return { ...this.usageStats };
  }

  /**
   * Reset usage statistics
   */
  resetUsageStats(): void {
    if (this.useExternalProvider && this.externalProvider) {
      this.externalProvider.resetUsageStats();
      return;
    }
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
    if (this.useExternalProvider && this.externalProvider) {
      return this.externalProvider.estimateTokens(text);
    }
    // Rough estimate: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate estimated cost for tokens
   */
  estimateCost(inputTokens: number, outputTokens: number, model?: string): number {
    if (this.useExternalProvider && this.externalProvider) {
      return this.externalProvider.estimateCost(inputTokens, outputTokens, model);
    }
    const pricing = TOKEN_PRICING[(model || this.config.defaultModel) as keyof typeof TOKEN_PRICING] ||
      TOKEN_PRICING['claude-sonnet-4-20250514'];

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
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
   * Get available models
   */
  getAvailableModels(): string[] {
    if (this.useExternalProvider && this.externalProvider) {
      return this.externalProvider.getAvailableModels();
    }
    return Object.keys(TOKEN_PRICING);
  }

  /**
   * Get the current configuration (read-only)
   */
  getConfig(): Readonly<Required<ProviderConfig>> {
    if (this.useExternalProvider && this.externalProvider) {
      return this.externalProvider.getConfig();
    }
    return { ...this.config };
  }

  /**
   * Perform a health check by sending a minimal request to the API
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const now = new Date().toISOString();
    this.lastHealthCheckAt = now;

    if (this.useExternalProvider && this.externalProvider) {
      const result = await this.externalProvider.healthCheck();
      // Record latency sample from external provider
      const success = result.status !== 'offline' && !result.error;
      this.recordLatencySample(result.latency_ms, success);
      if (success) {
        this.consecutiveFailures = 0;
      } else {
        this.consecutiveFailures++;
      }
      return result;
    }

    if (!this.client) {
      this.recordLatencySample(0, false);
      return {
        status: 'offline',
        latency_ms: 0,
        model: this.config.defaultModel,
        error: 'AI service not initialized - no API key configured',
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
    if (this.useExternalProvider && this.externalProvider) {
      return this.externalProvider.getHealthMetrics();
    }

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
   * Get detailed provider status including health and usage
   */
  async getProviderStatus(): Promise<ProviderStatus> {
    if (this.useExternalProvider && this.externalProvider) {
      return this.externalProvider.getProviderStatus();
    }

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
   * Update configuration
   */
  updateConfig(config: Partial<ProviderConfig>): void {
    if (this.useExternalProvider && this.externalProvider) {
      this.externalProvider.updateConfig(config);
      return;
    }

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
export const aiService = new AIService();

// Initialize on module load if API key is available
if (process.env.ANTHROPIC_API_KEY) {
  aiService.initialize();
}

// Export class for testing (types already exported above)
export { AIService };
