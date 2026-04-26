/**
 * AI Router - Automatic Provider Failover
 *
 * Implements automatic failover between AI providers (Kie.ai -> Anthropic).
 * When the primary provider fails (timeout, rate limit, error), automatically
 * retries with the fallback provider without user intervention.
 *
 * Feature #1462: Implement automatic failover from Kie.ai to Anthropic
 */

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
  AIRouterConfig,
  ProviderName,
} from './types.js';

import { KieAIProvider } from './kie-ai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { DeepSeekProvider } from './deepseek-provider.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { modelSelector } from './model-selector.js';
// Feature #449: Use structured logger instead of console.*
import { createLogger } from '../logger.js';

const log = createLogger('ai-router');

// =============================================================================
// TYPES
// =============================================================================

/** Extended response with routing metadata */
export interface RoutedAIResponse extends AIResponse {
  /** The provider that actually served the request */
  actualProvider: ProviderName;
  /** Whether failover was used */
  usedFallback: boolean;
  /** Reason for failover, if applicable */
  fallbackReason?: string;
  /** Latency in milliseconds */
  latencyMs: number;
}

/** Failover event for logging */
export interface FailoverEvent {
  timestamp: string;
  primaryProvider: ProviderName;
  fallbackProvider: ProviderName | 'none';
  reason: string;
  errorType: 'timeout' | 'rate_limit' | 'server_error' | 'network_error' | 'other';
  originalError?: string;
}

/** Router statistics */
export interface RouterStats {
  totalRequests: number;
  primarySuccesses: number;
  fallbackSuccesses: number;
  totalFailures: number;
  failoverEvents: FailoverEvent[];
  lastFailoverAt?: string;
}

/** Provider switch event */
export interface ProviderSwitchEvent {
  timestamp: string;
  previousPrimary: ProviderName;
  newPrimary: ProviderName;
  previousFallback: ProviderName | undefined;
  newFallback: ProviderName | undefined;
  reason: string;
  inFlightRequests: number;
}

/** Cost savings report */
export interface CostSavings {
  /** Total tokens processed */
  totalInputTokens: number;
  totalOutputTokens: number;
  /** What it would have cost on Anthropic directly */
  anthropicCostUsd: number;
  /** What it actually cost on Kie.ai */
  kieCostUsd: number;
  /** Actual cost (whichever provider was used) */
  actualCostUsd: number;
  /** Total savings = anthropicCost - actualCost */
  savingsUsd: number;
  /** Savings percentage */
  savingsPercent: number;
  /** Breakdown by provider */
  byProvider: {
    kie: { requests: number; inputTokens: number; outputTokens: number; costUsd: number };
    anthropic: { requests: number; inputTokens: number; outputTokens: number; costUsd: number };
    deepseek: { requests: number; inputTokens: number; outputTokens: number; costUsd: number };
  };
}

/** Anthropic direct pricing for comparison (per 1M tokens) */
const ANTHROPIC_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  // DeepSeek models (use their own pricing)
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-coder': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
};

/** Kie.ai pricing (70% off Claude models) */
const KIE_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-haiku-20240307': { input: 0.075, output: 0.375 },
  'claude-sonnet-4-20250514': { input: 0.90, output: 4.50 },
  'claude-3-5-sonnet-20241022': { input: 0.90, output: 4.50 },
  'claude-3-opus-20240229': { input: 4.50, output: 22.50 },
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-coder': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
};

// =============================================================================
// ERROR DETECTION
// =============================================================================

/** Determine if an error should trigger failover */
function shouldFailover(error: unknown): { should: boolean; reason: string; errorType: FailoverEvent['errorType'] } {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Timeout errors
    if (message.includes('timeout') || message.includes('etimedout') || message.includes('abort')) {
      return { should: true, reason: 'Request timed out', errorType: 'timeout' };
    }

    // Rate limit errors (429)
    if (message.includes('429') || message.includes('rate limit') || message.includes('too many requests')) {
      return { should: true, reason: 'Rate limit exceeded', errorType: 'rate_limit' };
    }

    // Server errors (5xx)
    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504') ||
        message.includes('server error') || message.includes('internal error')) {
      return { should: true, reason: 'Server error', errorType: 'server_error' };
    }

    // Network errors
    if (message.includes('econnreset') || message.includes('econnrefused') || message.includes('network') ||
        message.includes('fetch failed') || message.includes('socket')) {
      return { should: true, reason: 'Network error', errorType: 'network_error' };
    }

    // Check for error status in error object
    if ('status' in error) {
      const status = (error as { status: number }).status;
      if (status === 429) {
        return { should: true, reason: 'Rate limit exceeded (429)', errorType: 'rate_limit' };
      }
      if (status >= 500) {
        return { should: true, reason: `Server error (${status})`, errorType: 'server_error' };
      }
      // 404 from AI providers often means service unavailable or model not found
      if (status === 404) {
        return { should: true, reason: 'Service not found (404)', errorType: 'server_error' };
      }
    }

    // Check for "no message" errors from Kie.ai which indicate service issues
    if (message.includes('no message available')) {
      return { should: true, reason: 'Provider response unavailable', errorType: 'server_error' };
    }
  }

  // Don't failover for authentication errors, invalid requests, etc.
  return { should: false, reason: 'Non-recoverable error', errorType: 'other' };
}

// =============================================================================
// AI ROUTER CLASS
// =============================================================================

/**
 * AIRouter - Routes requests between providers with automatic failover
 *
 * Implements the IAIProvider interface for drop-in replacement while
 * providing automatic failover capabilities.
 */
export class AIRouter implements IAIProvider {
  private config: Required<AIRouterConfig>;
  private providers: Map<ProviderName, IAIProvider> = new Map();
  private circuitBreakers: Map<ProviderName, CircuitBreaker> = new Map();
  private stats: RouterStats = {
    totalRequests: 0,
    primarySuccesses: 0,
    fallbackSuccesses: 0,
    totalFailures: 0,
    failoverEvents: [],
  };
  private onFailover?: (event: FailoverEvent) => void;
  private onProviderSwitch?: (event: ProviderSwitchEvent) => void;

  // In-flight request tracking for hot-swap safety
  private inFlightRequests = 0;
  private switchLock = false;
  private providerSwitchEvents: ProviderSwitchEvent[] = [];

  // Cost tracking for savings calculation
  private costTracking = {
    kie: { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
    anthropic: { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
    deepseek: { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
  };

  constructor(config: Partial<AIRouterConfig> = {}) {
    this.config = {
      primary: config.primary || 'kie',
      fallback: config.fallback || 'anthropic',
      fallbackOnError: config.fallbackOnError ?? true,
      fallbackOnTimeout: config.fallbackOnTimeout ?? true,
      timeoutMs: config.timeoutMs ?? 60000,
      costTracking: config.costTracking ?? true,
    };

    // Initialize providers
    this.providers.set('kie', new KieAIProvider());
    this.providers.set('anthropic', new AnthropicProvider());
    // P1.2: register DeepSeek as a third provider so smart routing
    // (P2.1) can target deepseek-v4-flash / deepseek-v4-pro for tasks
    // where their price/perf is best.
    this.providers.set('deepseek', new DeepSeekProvider());

    // Initialize circuit breakers for each provider
    this.circuitBreakers.set('kie', new CircuitBreaker('kie'));
    this.circuitBreakers.set('anthropic', new CircuitBreaker('anthropic'));
    this.circuitBreakers.set('deepseek', new CircuitBreaker('deepseek'));
  }

  /**
   * Set a callback for failover events
   */
  setFailoverCallback(callback: (event: FailoverEvent) => void): void {
    this.onFailover = callback;
  }

  /**
   * Set a callback for provider switch events
   */
  setProviderSwitchCallback(callback: (event: ProviderSwitchEvent) => void): void {
    this.onProviderSwitch = callback;
  }

  /**
   * Get the primary provider
   */
  private getPrimaryProvider(): IAIProvider | undefined {
    return this.providers.get(this.config.primary);
  }

  /**
   * P2.1/P2.2: Resolve which provider to prefer for this call.
   * Priority order:
   *   1. options.preferredProvider — explicit override (debug/dashboard)
   *   2. options.feature → modelSelector lookup → provider hint
   *   3. undefined (use global primary)
   *
   */
  private resolvePreferredProvider(options: AISendMessageOptions): ProviderName | undefined {
    if (options.preferredProvider) return options.preferredProvider;
    if (!options.feature) return undefined;
    const cfg = modelSelector.getModelForFeature(options.feature);
    return cfg.provider;
  }

  /**
   * Get the fallback provider
   */
  private getFallbackProvider(): IAIProvider | undefined {
    return this.config.fallback ? this.providers.get(this.config.fallback) : undefined;
  }

  /**
   * Log a failover event
   */
  private logFailover(reason: string, errorType: FailoverEvent['errorType'], originalError?: string): void {
    const event: FailoverEvent = {
      timestamp: new Date().toISOString(),
      primaryProvider: this.config.primary,
      fallbackProvider: this.config.fallback || 'none',
      reason,
      errorType,
      originalError,
    };

    this.stats.failoverEvents.push(event);
    this.stats.lastFailoverAt = event.timestamp;

    // Keep only last 100 failover events
    if (this.stats.failoverEvents.length > 100) {
      this.stats.failoverEvents = this.stats.failoverEvents.slice(-100);
    }

    log.info({ from: this.config.primary, to: this.config.fallback, reason }, 'Failover triggered');

    // Invoke callback if set
    this.onFailover?.(event);
  }

  /**
   * Try to execute with primary provider, failover to fallback if needed.
   * P2.2: optionally accepts a preferredProvider — when set, that provider
   * is tried FIRST; on failure we cascade through the standard primary →
   * fallback chain. This is what the smart per-feature routing uses to
   * say "send test_generation to deepseek-v4-pro, not the global primary."
   */
  private async tryWithFallback<T>(
    operation: (provider: IAIProvider) => Promise<T>,
    operationName: string,
    preferredProvider?: ProviderName,
  ): Promise<{ result: T; usedFallback: boolean; fallbackReason?: string; actualProvider: ProviderName }> {
    this.stats.totalRequests++;

    // Track in-flight requests for hot-swap safety
    this.inFlightRequests++;

    try {
      return await this.executeWithFallback(operation, operationName, preferredProvider);
    } finally {
      this.inFlightRequests--;
    }
  }

  /**
   * Internal execution logic with fallback support
   */
  private async executeWithFallback<T>(
    operation: (provider: IAIProvider) => Promise<T>,
    operationName: string,
    preferredProvider?: ProviderName,
  ): Promise<{ result: T; usedFallback: boolean; fallbackReason?: string; actualProvider: ProviderName }> {
    // P2.2: When a preferred provider is supplied (per-call override from
    // smart routing), try it first. If it's offline or fails on a retryable
    // error, we fall through to the standard primary → fallback chain.
    if (preferredProvider && preferredProvider !== this.config.primary) {
      const preferred = this.providers.get(preferredProvider);
      if (preferred?.isInitialized()) {
        try {
          const result = await operation(preferred);
          this.stats.primarySuccesses++;
          return { result, usedFallback: false, actualProvider: preferredProvider };
        } catch (error) {
          const check = shouldFailover(error);
          if (check.should) {
            this.logFailover(
              `Preferred provider ${preferredProvider} failed: ${check.reason}`,
              check.errorType,
              error instanceof Error ? error.message : String(error),
            );
            // Fall through to standard primary→fallback chain
          } else {
            // Non-retryable error from preferred — surface it; don't cascade
            this.stats.totalFailures++;
            throw error;
          }
        }
      }
      // If preferred isn't initialized, just fall through silently
    }

    const primary = this.getPrimaryProvider();
    const fallback = this.getFallbackProvider();

    // Try primary provider
    if (primary?.isInitialized()) {
      try {
        const result = await operation(primary);
        this.stats.primarySuccesses++;
        return {
          result,
          usedFallback: false,
          actualProvider: this.config.primary,
        };
      } catch (error) {
        const failoverCheck = shouldFailover(error);

        if (failoverCheck.should && this.config.fallbackOnError && fallback?.isInitialized()) {
          this.logFailover(
            failoverCheck.reason,
            failoverCheck.errorType,
            error instanceof Error ? error.message : String(error)
          );

          // Try fallback provider
          try {
            const result = await operation(fallback);
            this.stats.fallbackSuccesses++;
            return {
              result,
              usedFallback: true,
              fallbackReason: failoverCheck.reason,
              actualProvider: this.config.fallback!,
            };
          } catch (fallbackError) {
            this.stats.totalFailures++;
            throw fallbackError;
          }
        }

        // No failover - rethrow original error
        this.stats.totalFailures++;
        throw error;
      }
    }

    // Primary not available, try fallback directly
    if (fallback?.isInitialized()) {
      log.info({ primary: this.config.primary }, 'Primary provider not initialized, using fallback');
      try {
        const result = await operation(fallback);
        this.stats.fallbackSuccesses++;
        return {
          result,
          usedFallback: true,
          fallbackReason: 'Primary provider not initialized',
          actualProvider: this.config.fallback!,
        };
      } catch (error) {
        this.stats.totalFailures++;
        throw error;
      }
    }

    this.stats.totalFailures++;
    throw new Error(`[AIRouter] No initialized providers available for ${operationName}`);
  }

  // =============================================================================
  // IAIProvider IMPLEMENTATION
  // =============================================================================

  /**
   * Initialize providers
   */
  initialize(apiKey?: string): void {
    // Initialize all providers
    for (const provider of this.providers.values()) {
      provider.initialize(apiKey);
    }
  }

  /**
   * Reinitialize providers from environment variables
   * This is useful when the singleton was created before dotenv loaded
   */
  reinitializeFromEnv(): boolean {
    const kieKey = process.env.KIE_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const deepseekKey = process.env.DEEPSEEK_API_KEY;

    log.info({
      kiePresent: !!kieKey,
      anthropicPresent: !!anthropicKey,
      deepseekPresent: !!deepseekKey,
    }, 'Reinitializing from env');

    let anyInitialized = false;

    // Reinitialize Kie provider
    const kieProvider = this.providers.get('kie');
    if (kieProvider && kieKey) {
      kieProvider.initialize(kieKey);
      if (kieProvider.isInitialized()) {
        log.info('Kie.ai provider initialized successfully');
        anyInitialized = true;
      }
    }

    // Reinitialize Anthropic provider
    const anthropicProvider = this.providers.get('anthropic');
    if (anthropicProvider && anthropicKey) {
      anthropicProvider.initialize(anthropicKey);
      if (anthropicProvider.isInitialized()) {
        log.info('Anthropic provider initialized successfully');
        anyInitialized = true;
      }
    }

    // P1.2: Reinitialize DeepSeek provider
    const deepseekProvider = this.providers.get('deepseek');
    if (deepseekProvider && deepseekKey) {
      deepseekProvider.initialize(deepseekKey);
      if (deepseekProvider.isInitialized()) {
        log.info('DeepSeek provider initialized successfully');
        anyInitialized = true;
      }
    }

    return anyInitialized;
  }

  /**
   * Check if any provider is initialized
   */
  isInitialized(): boolean {
    const primary = this.getPrimaryProvider();
    const fallback = this.getFallbackProvider();
    return (primary?.isInitialized() ?? false) || (fallback?.isInitialized() ?? false);
  }

  /**
   * Track cost for a completed request
   */
  private trackCost(provider: ProviderName, model: string, inputTokens: number, outputTokens: number): void {
    if (!this.config.costTracking) return;

    // Per-provider pricing tables. DeepSeek prices live alongside the
    // V4 lineup; everything else falls back to its provider's table.
    const DEEPSEEK_PRICING: Record<string, { input: number; output: number }> = {
      'deepseek-v4-pro': { input: 1.74, output: 3.48 },
      'deepseek-v4-flash': { input: 0.14, output: 0.28 },
      'deepseek-chat': { input: 0.14, output: 0.28 },
      'deepseek-coder': { input: 0.14, output: 0.28 },
      'deepseek-reasoner': { input: 0.55, output: 2.19 },
    };
    const pricing = provider === 'kie'
      ? KIE_PRICING
      : provider === 'deepseek'
        ? DEEPSEEK_PRICING
        : ANTHROPIC_PRICING;
    const defaultPricing = { input: 0.25, output: 1.25 };
    const modelPricing = pricing[model] ?? pricing['claude-3-haiku-20240307'] ?? defaultPricing;

    const costUsd = (inputTokens * modelPricing.input + outputTokens * modelPricing.output) / 1_000_000;

    if (provider === 'kie') {
      this.costTracking.kie.requests++;
      this.costTracking.kie.inputTokens += inputTokens;
      this.costTracking.kie.outputTokens += outputTokens;
      this.costTracking.kie.costUsd += costUsd;
    } else if (provider === 'anthropic') {
      this.costTracking.anthropic.requests++;
      this.costTracking.anthropic.inputTokens += inputTokens;
      this.costTracking.anthropic.outputTokens += outputTokens;
      this.costTracking.anthropic.costUsd += costUsd;
    } else if (provider === 'deepseek') {
      this.costTracking.deepseek.requests++;
      this.costTracking.deepseek.inputTokens += inputTokens;
      this.costTracking.deepseek.outputTokens += outputTokens;
      this.costTracking.deepseek.costUsd += costUsd;
    }
  }

  /**
   * Send a message with automatic failover.
   * P2.1/P2.2: smart routing — when options.feature is set we look up the
   * configured provider for that feature (e.g. test_generation → deepseek)
   * and pass it as the preferredProvider hint. Direct preferredProvider
   * overrides feature-based routing.
   */
  async sendMessage(
    messages: AIMessage[],
    options: AISendMessageOptions = {}
  ): Promise<RoutedAIResponse> {
    const startTime = Date.now();
    const preferred = this.resolvePreferredProvider(options);

    const { result, usedFallback, fallbackReason, actualProvider } = await this.tryWithFallback(
      (provider) => provider.sendMessage(messages, options),
      'sendMessage',
      preferred,
    );

    // Track cost for the provider that handled the request
    this.trackCost(actualProvider, result.model, result.inputTokens, result.outputTokens);

    return {
      ...result,
      actualProvider,
      usedFallback,
      fallbackReason,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Send a message with streaming and automatic failover
   */
  async sendMessageStream(
    messages: AIMessage[],
    options: AISendMessageOptions = {},
    callbacks: StreamCallbacks = {}
  ): Promise<RoutedAIResponse> {
    const startTime = Date.now();
    const preferred = this.resolvePreferredProvider(options);

    const { result, usedFallback, fallbackReason, actualProvider } = await this.tryWithFallback(
      (provider) => provider.sendMessageStream(messages, options, callbacks),
      'sendMessageStream',
      preferred,
    );

    // Track cost for the provider that handled the request
    this.trackCost(actualProvider, result.model, result.inputTokens, result.outputTokens);

    return {
      ...result,
      actualProvider,
      usedFallback,
      fallbackReason,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Simple ask helper with automatic failover
   */
  async ask(question: string, options: AISendMessageOptions = {}): Promise<string> {
    const { result } = await this.tryWithFallback(
      (provider) => provider.ask(question, options),
      'ask'
    );
    return result;
  }

  /**
   * Send a vision message with image content
   * Note: Vision is only supported by Anthropic, so this bypasses Kie.ai
   *
   * @param messages - Messages with text and/or image content
   * @param options - Send options (model, maxTokens, etc.)
   * @returns Routed AI response with vision analysis
   */
  async sendVisionMessage(
    messages: AIMessage[],
    options: AISendMessageOptions = {}
  ): Promise<RoutedAIResponse> {
    const startTime = Date.now();

    // Vision is only supported by Anthropic, use it directly
    // Kie.ai doesn't support multimodal image content
    const anthropic = this.providers.get('anthropic');

    if (!anthropic?.isInitialized()) {
      throw new Error('[AIRouter] Vision requires Anthropic provider which is not initialized');
    }

    this.stats.totalRequests++;
    this.inFlightRequests++;

    try {
      const result = await anthropic.sendMessage(messages, options);
      this.stats.primarySuccesses++;

      // Track cost for Anthropic
      this.trackCost('anthropic', result.model, result.inputTokens, result.outputTokens);

      return {
        ...result,
        actualProvider: 'anthropic',
        usedFallback: false,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      this.stats.totalFailures++;
      throw error;
    } finally {
      this.inFlightRequests--;
    }
  }

  /**
   * Check if vision capabilities are available
   * Vision requires Anthropic provider to be initialized
   */
  isVisionAvailable(): boolean {
    return this.providers.get('anthropic')?.isInitialized() ?? false;
  }

  /**
   * Health check using primary provider with fallback
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const { result } = await this.tryWithFallback(
      (provider) => provider.healthCheck(),
      'healthCheck'
    );
    return result;
  }

  /**
   * Get combined usage stats from all providers
   */
  getUsageStats(): AIUsageStats {
    const combined: AIUsageStats = {
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
      requestsByModel: {},
      successfulRequests: 0,
      failedRequests: 0,
    };

    for (const provider of this.providers.values()) {
      const stats = provider.getUsageStats();
      combined.totalRequests += stats.totalRequests;
      combined.totalInputTokens += stats.totalInputTokens;
      combined.totalOutputTokens += stats.totalOutputTokens;
      combined.totalCostUsd += stats.totalCostUsd;
      combined.successfulRequests += stats.successfulRequests;
      combined.failedRequests += stats.failedRequests;

      // Merge requestsByModel
      for (const [model, count] of Object.entries(stats.requestsByModel)) {
        combined.requestsByModel[model] = (combined.requestsByModel[model] || 0) + count;
      }
    }

    return combined;
  }

  /**
   * Reset usage stats for all providers
   */
  resetUsageStats(): void {
    for (const provider of this.providers.values()) {
      provider.resetUsageStats();
    }
    this.stats = {
      totalRequests: 0,
      primarySuccesses: 0,
      fallbackSuccesses: 0,
      totalFailures: 0,
      failoverEvents: [],
    };
  }

  /**
   * Get provider status for primary provider
   */
  async getProviderStatus(): Promise<ProviderStatus> {
    const { result } = await this.tryWithFallback(
      (provider) => provider.getProviderStatus(),
      'getProviderStatus'
    );
    return result;
  }

  /**
   * Get available models from all providers
   */
  getAvailableModels(): string[] {
    const models = new Set<string>();
    for (const provider of this.providers.values()) {
      for (const model of provider.getAvailableModels()) {
        models.add(model);
      }
    }
    return Array.from(models);
  }

  /**
   * Get config from primary provider
   */
  getConfig(): Readonly<Required<ProviderConfig>> {
    const primary = this.getPrimaryProvider();
    if (primary) {
      return primary.getConfig();
    }
    const fallback = this.getFallbackProvider();
    if (fallback) {
      return fallback.getConfig();
    }
    // Return default config
    return {
      apiKey: '',
      apiUrl: '',
      defaultModel: '',
      maxRetries: 3,
      retryDelayMs: 1000,
      timeoutMs: 60000,
      rateLimitRpm: 50,
    };
  }

  /**
   * Update config for all providers
   */
  updateConfig(config: Partial<ProviderConfig>): void {
    for (const provider of this.providers.values()) {
      provider.updateConfig(config);
    }
  }

  /**
   * Estimate tokens using primary provider
   */
  estimateTokens(text: string): number {
    const primary = this.getPrimaryProvider();
    if (primary) {
      return primary.estimateTokens(text);
    }
    const fallback = this.getFallbackProvider();
    if (fallback) {
      return fallback.estimateTokens(text);
    }
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate cost using primary provider
   */
  estimateCost(inputTokens: number, outputTokens: number, model?: string): number {
    const primary = this.getPrimaryProvider();
    if (primary) {
      return primary.estimateCost(inputTokens, outputTokens, model);
    }
    const fallback = this.getFallbackProvider();
    if (fallback) {
      return fallback.estimateCost(inputTokens, outputTokens, model);
    }
    return 0;
  }

  /**
   * Get health metrics from primary provider
   */
  getHealthMetrics(): HealthMetrics {
    const primary = this.getPrimaryProvider();
    if (primary) {
      return primary.getHealthMetrics();
    }
    const fallback = this.getFallbackProvider();
    if (fallback) {
      return fallback.getHealthMetrics();
    }
    // Return empty metrics
    return {
      provider: 'router',
      status: 'offline',
      p50_latency_ms: 0,
      p95_latency_ms: 0,
      p99_latency_ms: 0,
      avg_latency_ms: 0,
      min_latency_ms: 0,
      max_latency_ms: 0,
      sample_count: 0,
      last_check_at: new Date().toISOString(),
      consecutive_failures: 0,
      success_rate: 0,
    };
  }

  // =============================================================================
  // ROUTER-SPECIFIC METHODS
  // =============================================================================

  /**
   * Get router statistics
   */
  getRouterStats(): RouterStats {
    return { ...this.stats };
  }

  /**
   * Get router configuration
   */
  getRouterConfig(): Readonly<Required<AIRouterConfig>> {
    return { ...this.config };
  }

  /**
   * Update router configuration
   */
  updateRouterConfig(config: Partial<AIRouterConfig>): void {
    if (config.primary !== undefined) this.config.primary = config.primary;
    if (config.fallback !== undefined) this.config.fallback = config.fallback;
    if (config.fallbackOnError !== undefined) this.config.fallbackOnError = config.fallbackOnError;
    if (config.fallbackOnTimeout !== undefined) this.config.fallbackOnTimeout = config.fallbackOnTimeout;
    if (config.timeoutMs !== undefined) this.config.timeoutMs = config.timeoutMs;
    if (config.costTracking !== undefined) this.config.costTracking = config.costTracking;
  }

  // =============================================================================
  // HOT-SWAP PROVIDER SWITCHING
  // =============================================================================

  /**
   * Get the number of in-flight requests
   */
  getInFlightCount(): number {
    return this.inFlightRequests;
  }

  /**
   * Check if a provider switch is currently in progress
   */
  isSwitching(): boolean {
    return this.switchLock;
  }

  /**
   * Hot-swap the primary provider without restart
   *
   * This method:
   * 1. Logs the switch event
   * 2. Tracks in-flight requests (they continue on old provider)
   * 3. Updates the primary provider for new requests
   * 4. Optionally resets circuit breaker state
   *
   * @param newPrimary - The new primary provider
   * @param options - Switch options
   * @returns The switch event
   */
  setPrimaryProvider(
    newPrimary: ProviderName,
    options: {
      reason?: string;
      resetCircuitBreaker?: boolean;
      newFallback?: ProviderName;
    } = {}
  ): ProviderSwitchEvent {
    const {
      reason = 'Manual provider switch',
      resetCircuitBreaker = true,
      newFallback,
    } = options;

    // Validate the new provider exists
    if (!this.providers.has(newPrimary)) {
      throw new Error(`Provider '${newPrimary}' not found. Available: ${Array.from(this.providers.keys()).join(', ')}`);
    }

    // Create switch event
    const event: ProviderSwitchEvent = {
      timestamp: new Date().toISOString(),
      previousPrimary: this.config.primary,
      newPrimary,
      previousFallback: this.config.fallback,
      newFallback: newFallback ?? this.config.fallback,
      reason,
      inFlightRequests: this.inFlightRequests,
    };

    // Log the switch
    log.info({
      from: event.previousPrimary,
      to: event.newPrimary,
      inFlightRequests: event.inFlightRequests,
      reason,
    }, 'Hot-swap provider switch');

    // Store the event
    this.providerSwitchEvents.push(event);
    if (this.providerSwitchEvents.length > 50) {
      this.providerSwitchEvents = this.providerSwitchEvents.slice(-50);
    }

    // Update configuration (takes effect immediately for new requests)
    this.config.primary = newPrimary;
    if (newFallback !== undefined) {
      this.config.fallback = newFallback;
    }

    // Reset circuit breaker for the new primary provider if requested
    if (resetCircuitBreaker) {
      const cb = this.circuitBreakers.get(newPrimary);
      if (cb) {
        cb.reset();
        log.info({ provider: newPrimary }, 'Reset circuit breaker');
      }
    }

    // Invoke callback if set
    this.onProviderSwitch?.(event);

    return event;
  }

  /**
   * Swap primary and fallback providers
   *
   * Useful for quick failover switching where you want the previous
   * fallback to become the new primary.
   */
  swapProviders(options: { reason?: string; resetCircuitBreakers?: boolean } = {}): ProviderSwitchEvent {
    const { reason = 'Provider swap', resetCircuitBreakers = true } = options;

    const newPrimary = this.config.fallback;
    const newFallback = this.config.primary;

    if (!newPrimary) {
      throw new Error('Cannot swap providers: no fallback provider configured');
    }

    return this.setPrimaryProvider(newPrimary, {
      reason,
      resetCircuitBreaker: resetCircuitBreakers,
      newFallback,
    });
  }

  /**
   * Get provider switch history
   */
  getProviderSwitchHistory(): ProviderSwitchEvent[] {
    return [...this.providerSwitchEvents];
  }

  /**
   * Get circuit breaker for a specific provider
   */
  getCircuitBreaker(provider: ProviderName): CircuitBreaker | undefined {
    return this.circuitBreakers.get(provider);
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers(): void {
    for (const cb of this.circuitBreakers.values()) {
      cb.reset();
    }
    log.info('Reset all circuit breakers');
  }

  /**
   * Get a specific provider by name
   */
  getProvider(name: ProviderName): IAIProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Check if a specific provider is available
   */
  isProviderAvailable(name: ProviderName): boolean {
    return this.providers.get(name)?.isInitialized() ?? false;
  }

  /**
   * Calculate cost savings from using Kie.ai vs Anthropic directly
   *
   * Returns a report showing:
   * - Total tokens processed across all providers
   * - What it would have cost on Anthropic directly
   * - Actual cost (Kie.ai + any Anthropic fallback)
   * - Total savings in USD and percentage
   */
  getCostSavings(): CostSavings {
    const totalInputTokens = this.costTracking.kie.inputTokens + this.costTracking.anthropic.inputTokens;
    const totalOutputTokens = this.costTracking.kie.outputTokens + this.costTracking.anthropic.outputTokens;

    // Calculate what Anthropic would have cost for ALL requests
    // (even the ones routed through Kie.ai)
    // We use average model pricing (assume claude-3-haiku for simplicity, or weighted average)
    // Default to haiku pricing if not found
    const avgAnthropicPricing = ANTHROPIC_PRICING['claude-3-haiku-20240307'] ?? { input: 0.25, output: 1.25 };
    const anthropicCostUsd = (totalInputTokens * avgAnthropicPricing.input + totalOutputTokens * avgAnthropicPricing.output) / 1_000_000;

    // Actual cost is what we actually paid
    const actualCostUsd = this.costTracking.kie.costUsd + this.costTracking.anthropic.costUsd;

    // Savings
    const savingsUsd = anthropicCostUsd - actualCostUsd;
    const savingsPercent = anthropicCostUsd > 0 ? (savingsUsd / anthropicCostUsd) * 100 : 0;

    return {
      totalInputTokens,
      totalOutputTokens,
      anthropicCostUsd,
      kieCostUsd: this.costTracking.kie.costUsd,
      actualCostUsd,
      savingsUsd,
      savingsPercent,
      byProvider: {
        kie: { ...this.costTracking.kie },
        anthropic: { ...this.costTracking.anthropic },
        deepseek: { ...this.costTracking.deepseek },
      },
    };
  }

  /**
   * Reset cost tracking data
   */
  resetCostTracking(): void {
    this.costTracking = {
      kie: { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
      anthropic: { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
      deepseek: { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
    };
  }
}

// Export singleton instance with default config
export const aiRouter = new AIRouter();

// Export default
export default AIRouter;
