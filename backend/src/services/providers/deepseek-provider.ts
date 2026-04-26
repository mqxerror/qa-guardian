/**
 * DeepSeek Provider
 *
 * Implementation of IAIProvider for DeepSeek V4 (Pro + Flash) and the
 * legacy V3.x lineup. Uses the @anthropic-ai/sdk against DeepSeek's
 * Anthropic-compatible endpoint at https://api.deepseek.com/anthropic so
 * we get the same SDK ergonomics as our Anthropic provider for free.
 *
 * Why a separate class instead of subclassing AnthropicProvider:
 *   - Independent pricing tables (DeepSeek is much cheaper)
 *   - Independent model catalog
 *   - Quirks isolation: e.g., DeepSeek has no vision support, different
 *     rate-limit headers, separate maintenance windows
 *   - Easier to reason about which provider is doing what at debug time
 *
 * P1 of the V4 integration. P2 (smart per-feature routing) lives in
 * modelSelector + ai-router.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../logger.js';
import type {
  AIMessage,
  AIMessageContent,
  AIProviderError,
  AIResponse,
  AISendMessageOptions,
  AIUsageStats,
  HealthCheckResult,
  HealthMetrics,
  HealthStatus,
  IAIProvider,
  ProviderConfig,
  ProviderStatus,
  StreamCallbacks,
} from './types.js';

const log = createLogger('deepseek-provider');

// =============================================================================
// CONFIGURATION
// =============================================================================

/** DeepSeek's Anthropic-compatible endpoint */
const DEFAULT_API_URL = 'https://api.deepseek.com/anthropic';

/** Default model — V4 Flash strikes the best speed/cost balance for routine work */
const DEFAULT_MODEL = 'deepseek-v4-flash';

/**
 * Pricing per 1M tokens (USD). Source: api-docs.deepseek.com/quick_start/pricing
 * Verified 2026-04-26. V4 Pro is in a 75%-off promo until 2026-05-05; we
 * use the regular price here for accurate forecasting and so the savings
 * dashboard shows true unit cost rather than promo cost.
 */
const PRICING: Record<string, { input: number; output: number }> = {
  'deepseek-v4-pro': { input: 1.74, output: 3.48 },
  'deepseek-v4-flash': { input: 0.14, output: 0.28 },
  // Legacy V3.x lineup — kept so existing keys mapped to deepseek-chat
  // (Kie.ai default) continue to estimate cost correctly.
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-coder': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
};

const AVAILABLE_MODELS = Object.keys(PRICING);

// =============================================================================
// ERROR CLASS
// =============================================================================

export class DeepSeekAPIError extends Error implements AIProviderError {
  status: number;
  code?: string;
  retryable: boolean;
  constructor(message: string, status: number, retryable: boolean, code?: string) {
    super(message);
    this.name = 'DeepSeekAPIError';
    this.status = status;
    this.retryable = retryable;
    this.code = code;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Normalise our internal AIMessageContent (string | array of blocks) into
 * the shape Anthropic's SDK expects. DeepSeek's Anthropic endpoint follows
 * the same schema, so this is identical to AnthropicProvider's path.
 */
function toAnthropicContent(content: AIMessageContent): string | Anthropic.MessageParam['content'] {
  if (typeof content === 'string') return content;
  // Filter out image content — DeepSeek V4 (Pro + Flash) doesn't accept
  // images. Caller should route vision tasks to Anthropic explicitly.
  return content
    .filter((block) => block.type === 'text')
    .map((block) => ({ type: 'text' as const, text: (block as { text: string }).text }));
}

/** Coerce SDK errors into our AIProviderError shape */
function wrapError(err: unknown): DeepSeekAPIError {
  if (err instanceof Anthropic.APIError) {
    const retryable = err.status === 429 || (err.status ?? 0) >= 500;
    return new DeepSeekAPIError(err.message, err.status ?? 500, retryable, String(err.error ?? ''));
  }
  const msg = err instanceof Error ? err.message : String(err);
  return new DeepSeekAPIError(msg, 500, true);
}

// =============================================================================
// PROVIDER CLASS
// =============================================================================

export class DeepSeekProvider implements IAIProvider {
  private client: Anthropic | null = null;
  private initialized = false;
  private config: Required<ProviderConfig>;

  // Local usage stats — DeepSeek doesn't return cumulative usage, so we
  // track per-request and aggregate.
  private stats: AIUsageStats = {
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    requestsByModel: {},
    successfulRequests: 0,
    failedRequests: 0,
  };

  // Latency tracking for health metrics (last 100 samples)
  private latencySamples: Array<{ latency_ms: number; success: boolean; t: number }> = [];
  private consecutiveFailures = 0;
  private lastCheckAt: string = new Date().toISOString();

  constructor(config: Partial<ProviderConfig> = {}) {
    this.config = {
      apiKey: config.apiKey ?? process.env.DEEPSEEK_API_KEY ?? '',
      apiUrl: config.apiUrl ?? process.env.DEEPSEEK_API_URL ?? DEFAULT_API_URL,
      defaultModel: config.defaultModel ?? process.env.DEEPSEEK_DEFAULT_MODEL ?? DEFAULT_MODEL,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      timeoutMs: config.timeoutMs ?? 60000,
      rateLimitRpm: config.rateLimitRpm ?? 60,
    };
  }

  initialize(apiKey?: string): void {
    const key = apiKey ?? this.config.apiKey ?? process.env.DEEPSEEK_API_KEY;
    if (!key) {
      this.client = null;
      this.initialized = false;
      return;
    }
    try {
      this.client = new Anthropic({
        apiKey: key,
        baseURL: this.config.apiUrl,
        // SDK retries handled at our level; disable here to keep timing predictable
        maxRetries: 0,
      });
      this.config.apiKey = key;
      this.initialized = true;
      log.info({ baseURL: this.config.apiUrl }, 'DeepSeek provider initialized');
    } catch (err) {
      log.error({ err }, 'Failed to initialize DeepSeek provider');
      this.client = null;
      this.initialized = false;
    }
  }

  isInitialized(): boolean {
    return this.initialized && this.client !== null;
  }

  // ---------------------------------------------------------------------------
  // Core message paths
  // ---------------------------------------------------------------------------

  async sendMessage(messages: AIMessage[], options: AISendMessageOptions = {}): Promise<AIResponse> {
    if (!this.client) throw new DeepSeekAPIError('Not initialized', 503, false);
    const model = options.model ?? this.config.defaultModel;
    const start = Date.now();
    try {
      const result = await this.client.messages.create({
        model,
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature,
        system: options.systemPrompt,
        stop_sequences: options.stopSequences,
        messages: messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: toAnthropicContent(m.content) })),
      });

      const text = result.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

      const inputTokens = result.usage?.input_tokens ?? 0;
      const outputTokens = result.usage?.output_tokens ?? 0;
      this.recordSuccess(model, inputTokens, outputTokens, Date.now() - start);

      return {
        content: text,
        model,
        inputTokens,
        outputTokens,
        stopReason: result.stop_reason ?? null,
        provider: 'deepseek',
      };
    } catch (err) {
      this.recordFailure(Date.now() - start);
      throw wrapError(err);
    }
  }

  async sendMessageStream(
    messages: AIMessage[],
    options: AISendMessageOptions = {},
    callbacks: StreamCallbacks = {},
  ): Promise<AIResponse> {
    if (!this.client) throw new DeepSeekAPIError('Not initialized', 503, false);
    const model = options.model ?? this.config.defaultModel;
    const start = Date.now();
    let fullText = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let stopReason: string | null = null;

    try {
      const stream = await this.client.messages.create({
        model,
        max_tokens: options.maxTokens ?? 2048,
        temperature: options.temperature,
        system: options.systemPrompt,
        stop_sequences: options.stopSequences,
        stream: true,
        messages: messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: toAnthropicContent(m.content) })),
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullText += event.delta.text;
          callbacks.onText?.(event.delta.text);
        } else if (event.type === 'message_delta') {
          if (event.usage) outputTokens = event.usage.output_tokens ?? outputTokens;
          if (event.delta.stop_reason) stopReason = event.delta.stop_reason;
        } else if (event.type === 'message_start' && event.message.usage) {
          inputTokens = event.message.usage.input_tokens;
        }
      }

      this.recordSuccess(model, inputTokens, outputTokens, Date.now() - start);
      const response: AIResponse = {
        content: fullText,
        model,
        inputTokens,
        outputTokens,
        stopReason,
        provider: 'deepseek',
      };
      callbacks.onComplete?.(response);
      return response;
    } catch (err) {
      this.recordFailure(Date.now() - start);
      const wrapped = wrapError(err);
      callbacks.onError?.(wrapped);
      throw wrapped;
    }
  }

  async ask(question: string, options?: AISendMessageOptions): Promise<string> {
    const r = await this.sendMessage([{ role: 'user', content: question }], options);
    return r.content;
  }

  // ---------------------------------------------------------------------------
  // Health + status
  // ---------------------------------------------------------------------------

  async healthCheck(): Promise<HealthCheckResult> {
    if (!this.isInitialized()) {
      return {
        status: 'offline',
        latency_ms: 0,
        model: this.config.defaultModel,
        error: 'No API key configured',
        checked_at: new Date().toISOString(),
      };
    }
    const start = Date.now();
    try {
      // Cheap probe: 1-token reply on Flash. Avoids burning Pro budget.
      await this.sendMessage([{ role: 'user', content: 'ping' }], {
        model: 'deepseek-v4-flash',
        maxTokens: 5,
      });
      const latency = Date.now() - start;
      const status: HealthStatus = latency < 5000 ? 'healthy' : 'degraded';
      this.lastCheckAt = new Date().toISOString();
      return {
        status,
        latency_ms: latency,
        model: this.config.defaultModel,
        checked_at: this.lastCheckAt,
      };
    } catch (err) {
      const latency = Date.now() - start;
      const e = wrapError(err);
      this.lastCheckAt = new Date().toISOString();
      // Rate limited but online → degraded; everything else → offline
      const status: HealthStatus = e.status === 429 ? 'degraded' : 'offline';
      return {
        status,
        latency_ms: latency,
        model: this.config.defaultModel,
        error: e.message,
        checked_at: this.lastCheckAt,
      };
    }
  }

  async getProviderStatus(): Promise<ProviderStatus> {
    const health = this.isInitialized() ? await this.healthCheck() : undefined;
    return {
      provider: 'deepseek',
      status: health?.status ?? 'offline',
      is_configured: this.isInitialized(),
      model: this.config.defaultModel,
      usage: this.getUsageStats(),
      health_check: health,
    };
  }

  // ---------------------------------------------------------------------------
  // Usage + stats
  // ---------------------------------------------------------------------------

  private recordSuccess(model: string, inputTokens: number, outputTokens: number, latency: number): void {
    this.stats.totalRequests++;
    this.stats.successfulRequests++;
    this.stats.totalInputTokens += inputTokens;
    this.stats.totalOutputTokens += outputTokens;
    this.stats.totalCostUsd += this.estimateCost(inputTokens, outputTokens, model);
    this.stats.requestsByModel[model] = (this.stats.requestsByModel[model] ?? 0) + 1;
    this.consecutiveFailures = 0;
    this.pushLatency(latency, true);
  }

  private recordFailure(latency: number): void {
    this.stats.totalRequests++;
    this.stats.failedRequests++;
    this.consecutiveFailures++;
    this.pushLatency(latency, false);
  }

  private pushLatency(latency_ms: number, success: boolean): void {
    this.latencySamples.push({ latency_ms, success, t: Date.now() });
    if (this.latencySamples.length > 100) this.latencySamples.shift();
  }

  getUsageStats(): AIUsageStats {
    return { ...this.stats, requestsByModel: { ...this.stats.requestsByModel } };
  }

  resetUsageStats(): void {
    this.stats = {
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
      requestsByModel: {},
      successfulRequests: 0,
      failedRequests: 0,
    };
  }

  getHealthMetrics(): HealthMetrics {
    const samples = this.latencySamples.map((s) => s.latency_ms).sort((a, b) => a - b);
    const successCount = this.latencySamples.filter((s) => s.success).length;
    const pick = (p: number) => (samples.length ? samples[Math.min(samples.length - 1, Math.floor(samples.length * p))] : 0);
    return {
      provider: 'deepseek',
      status: this.consecutiveFailures > 3 ? 'offline' : this.consecutiveFailures > 0 ? 'degraded' : 'healthy',
      p50_latency_ms: pick(0.5),
      p95_latency_ms: pick(0.95),
      p99_latency_ms: pick(0.99),
      avg_latency_ms: samples.length ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length) : 0,
      min_latency_ms: samples[0] ?? 0,
      max_latency_ms: samples[samples.length - 1] ?? 0,
      sample_count: samples.length,
      last_check_at: this.lastCheckAt,
      consecutive_failures: this.consecutiveFailures,
      success_rate: this.latencySamples.length ? successCount / this.latencySamples.length : 1,
    };
  }

  // ---------------------------------------------------------------------------
  // Catalog + cost
  // ---------------------------------------------------------------------------

  getAvailableModels(): string[] {
    return [...AVAILABLE_MODELS];
  }

  estimateTokens(text: string): number {
    // DeepSeek V4 uses a similar BPE to Claude. ~4 chars/token is fine
    // for cost forecasting (real billing will differ ±10% but it's close
    // enough for the cost dashboard).
    return Math.ceil(text.length / 4);
  }

  estimateCost(inputTokens: number, outputTokens: number, model?: string): number {
    const m = model ?? this.config.defaultModel;
    const p = PRICING[m] ?? PRICING['deepseek-v4-flash'];
    return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
  }

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------

  getConfig(): Readonly<Required<ProviderConfig>> {
    return { ...this.config };
  }

  updateConfig(config: Partial<ProviderConfig>): void {
    if (config.apiKey !== undefined) this.config.apiKey = config.apiKey;
    if (config.apiUrl !== undefined) this.config.apiUrl = config.apiUrl;
    if (config.defaultModel !== undefined) this.config.defaultModel = config.defaultModel;
    if (config.maxRetries !== undefined) this.config.maxRetries = config.maxRetries;
    if (config.retryDelayMs !== undefined) this.config.retryDelayMs = config.retryDelayMs;
    if (config.timeoutMs !== undefined) this.config.timeoutMs = config.timeoutMs;
    if (config.rateLimitRpm !== undefined) this.config.rateLimitRpm = config.rateLimitRpm;
    // Re-init client if key/url changed
    if (config.apiKey !== undefined || config.apiUrl !== undefined) {
      this.initialize(this.config.apiKey);
    }
  }
}

export const deepseekProvider = new DeepSeekProvider();
