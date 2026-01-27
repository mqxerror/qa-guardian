/**
 * Kie.ai Provider
 *
 * Implementation of IAIProvider interface using KieAIClient.
 * Provides access to AI models through Kie.ai API with cost savings.
 *
 * Feature #1459: Implement Kie.ai provider using abstraction
 */

import {
  KieAIClient,
  KieAIClientConfig,
  KieMessage,
  KieSendMessageOptions,
  KieAIResponse,
  KieStreamCallbacks,
  KieUsageStats,
  KieAPIError,
} from './kie-ai-client.js';

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
} from './types.js';

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

/**
 * KieAIProvider - IAIProvider implementation using Kie.ai API
 *
 * Wraps KieAIClient to conform to the IAIProvider interface.
 * Provides access to AI models through Kie.ai with cost savings.
 */
export class KieAIProvider implements IAIProvider {
  private client: KieAIClient;

  // Latency tracking for health metrics
  private latencySamples: LatencySample[] = [];
  private consecutiveFailures = 0;
  private lastHealthCheckAt: string = new Date().toISOString();

  constructor(config: KieAIClientConfig = {}) {
    this.client = new KieAIClient(config);
  }

  /**
   * Initialize the provider with an optional API key
   */
  initialize(apiKey?: string): void {
    this.client.initialize(apiKey);
  }

  /**
   * Check if the provider is properly initialized
   */
  isInitialized(): boolean {
    return this.client.isInitialized();
  }

  /**
   * Send a message to Kie.ai and get a response
   */
  async sendMessage(
    messages: AIMessage[],
    options: AISendMessageOptions = {}
  ): Promise<AIResponse> {
    // Convert to Kie.ai message format
    const kieMessages: KieMessage[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Convert to Kie.ai options format
    const kieOptions: KieSendMessageOptions = {
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      systemPrompt: options.systemPrompt,
      stream: options.stream,
      stopSequences: options.stopSequences,
    };

    // Call Kie.ai client
    const response = await this.client.sendMessage(kieMessages, kieOptions);

    // Convert to standard AIResponse format
    return this.convertResponse(response);
  }

  /**
   * Send a message with streaming support
   */
  async sendMessageStream(
    messages: AIMessage[],
    options: AISendMessageOptions = {},
    callbacks: StreamCallbacks = {}
  ): Promise<AIResponse> {
    // Convert to Kie.ai message format
    const kieMessages: KieMessage[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Convert to Kie.ai options format
    const kieOptions: KieSendMessageOptions = {
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      systemPrompt: options.systemPrompt,
      stream: true,
      stopSequences: options.stopSequences,
    };

    // Convert callbacks to Kie.ai format
    const kieCallbacks: KieStreamCallbacks = {
      onText: callbacks.onText,
      onComplete: callbacks.onComplete
        ? (response: KieAIResponse) => callbacks.onComplete?.(this.convertResponse(response))
        : undefined,
      onError: callbacks.onError,
    };

    // Call Kie.ai client
    const response = await this.client.sendMessageStream(kieMessages, kieOptions, kieCallbacks);

    // Convert to standard AIResponse format
    return this.convertResponse(response);
  }

  /**
   * Simple helper for single-turn conversations
   */
  async ask(
    question: string,
    options: AISendMessageOptions = {}
  ): Promise<string> {
    return this.client.ask(question, {
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      systemPrompt: options.systemPrompt,
      stopSequences: options.stopSequences,
    });
  }

  /**
   * Perform a health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const now = new Date().toISOString();
    this.lastHealthCheckAt = now;

    const result = await this.client.healthCheck();

    // Record latency sample
    const success = result.status !== 'offline' && !result.error;
    this.recordLatencySample(result.latency_ms, success);

    if (success) {
      this.consecutiveFailures = 0;
    } else {
      this.consecutiveFailures++;
    }

    return result;
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
    if (!this.client.isInitialized()) {
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
      provider: 'kie',
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
    const kieStats = this.client.getUsageStats();
    return this.convertUsageStats(kieStats);
  }

  /**
   * Reset usage statistics
   */
  resetUsageStats(): void {
    this.client.resetUsageStats();
  }

  /**
   * Get detailed provider status
   */
  async getProviderStatus(): Promise<ProviderStatus> {
    const status = await this.client.getProviderStatus();
    return {
      provider: status.provider,
      status: status.status,
      is_configured: status.is_configured,
      model: status.model,
      usage: this.convertUsageStats(status.usage),
      health_check: status.health_check ? {
        status: status.health_check.status,
        latency_ms: status.health_check.latency_ms,
        model: status.health_check.model,
        error: status.health_check.error,
        checked_at: status.health_check.checked_at,
      } : undefined,
    };
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return this.client.getAvailableModels();
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<ProviderConfig>> {
    const kieConfig = this.client.getConfig();
    return {
      apiKey: kieConfig.apiKey,
      apiUrl: kieConfig.apiUrl,
      defaultModel: kieConfig.defaultModel,
      maxRetries: kieConfig.maxRetries,
      retryDelayMs: kieConfig.retryDelayMs,
      timeoutMs: kieConfig.timeoutMs,
      rateLimitRpm: kieConfig.rateLimitRpm,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ProviderConfig>): void {
    this.client.updateConfig({
      apiKey: config.apiKey,
      apiUrl: config.apiUrl,
      defaultModel: config.defaultModel,
      maxRetries: config.maxRetries,
      retryDelayMs: config.retryDelayMs,
      timeoutMs: config.timeoutMs,
      rateLimitRpm: config.rateLimitRpm,
    });
  }

  /**
   * Estimate tokens for text
   */
  estimateTokens(text: string): number {
    return this.client.estimateTokens(text);
  }

  /**
   * Estimate cost for tokens
   */
  estimateCost(inputTokens: number, outputTokens: number, model?: string): number {
    return this.client.estimateCost(inputTokens, outputTokens, model);
  }

  /**
   * Convert Kie.ai response to standard AIResponse
   */
  private convertResponse(response: KieAIResponse): AIResponse {
    return {
      content: response.content,
      model: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      stopReason: response.stopReason,
      provider: 'kie',
    };
  }

  /**
   * Convert Kie.ai usage stats to standard AIUsageStats
   */
  private convertUsageStats(stats: KieUsageStats): AIUsageStats {
    return {
      totalRequests: stats.totalRequests,
      totalInputTokens: stats.totalInputTokens,
      totalOutputTokens: stats.totalOutputTokens,
      totalCostUsd: stats.totalCostUsd,
      requestsByModel: stats.requestsByModel,
      successfulRequests: stats.successfulRequests,
      failedRequests: stats.failedRequests,
    };
  }
}

// Export singleton instance
export const kieAIProvider = new KieAIProvider();

// Export the error class for external use
export { KieAPIError };

// Export default
export default KieAIProvider;
