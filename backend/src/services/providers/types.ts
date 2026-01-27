/**
 * AI Provider Types and Interfaces
 *
 * This file defines the contract for AI providers, allowing both Kie.ai and Anthropic
 * to implement the same interface for seamless switching.
 *
 * Feature #1457: Create provider abstraction interface (IProvider)
 */

// =============================================================================
// MESSAGE TYPES
// =============================================================================

/**
 * Image source for vision messages (base64 encoded)
 */
export interface AIImageSource {
  /** Media type of the image */
  type: 'base64';
  /** Media type of the image (e.g., 'image/png', 'image/jpeg', 'image/webp', 'image/gif') */
  media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  /** Base64-encoded image data (without the data:image/... prefix) */
  data: string;
}

/**
 * URL-based image source for vision messages
 */
export interface AIImageUrlSource {
  type: 'url';
  /** URL of the image */
  url: string;
}

/**
 * Image content block for vision messages
 */
export interface AIImageContent {
  type: 'image';
  source: AIImageSource | AIImageUrlSource;
}

/**
 * Text content block for messages
 */
export interface AITextContent {
  type: 'text';
  text: string;
}

/**
 * Content can be either text or image blocks
 */
export type AIMessageContent = string | (AITextContent | AIImageContent)[];

/**
 * Represents a message in a conversation with an AI provider.
 * Compatible with both OpenAI and Anthropic message formats.
 */
export interface AIMessage {
  /** The role of the message sender */
  role: 'user' | 'assistant' | 'system';
  /** The text content of the message (string or multimodal content blocks) */
  content: AIMessageContent;
}

/**
 * Options for sending a message to an AI provider.
 */
export interface AISendMessageOptions {
  /** The model to use (e.g., 'claude-sonnet-4-5', 'deepseek-chat') */
  model?: string;
  /** Maximum number of tokens to generate */
  maxTokens?: number;
  /** Sampling temperature (0-1, higher = more random) */
  temperature?: number;
  /** System prompt to guide the model's behavior */
  systemPrompt?: string;
  /** Whether to stream the response */
  stream?: boolean;
  /** Stop sequences to end generation */
  stopSequences?: string[];
}

/**
 * Response from an AI provider after processing a message.
 */
export interface AIResponse {
  /** The generated text content */
  content: string;
  /** The model that generated the response */
  model: string;
  /** Number of input tokens used */
  inputTokens: number;
  /** Number of output tokens generated */
  outputTokens: number;
  /** Reason for stopping generation (e.g., 'stop', 'max_tokens') */
  stopReason: string | null;
  /** The provider that generated the response */
  provider: string;
}

// =============================================================================
// STREAMING TYPES
// =============================================================================

/**
 * Callbacks for handling streaming responses from AI providers.
 */
export interface StreamCallbacks {
  /** Called when new text is received during streaming */
  onText?: (text: string) => void;
  /** Called when streaming is complete with the full response */
  onComplete?: (response: AIResponse) => void;
  /** Called if an error occurs during streaming */
  onError?: (error: Error) => void;
}

// =============================================================================
// USAGE AND STATISTICS TYPES
// =============================================================================

/**
 * Statistics about AI provider usage.
 */
export interface AIUsageStats {
  /** Total number of API requests made */
  totalRequests: number;
  /** Total input tokens consumed */
  totalInputTokens: number;
  /** Total output tokens generated */
  totalOutputTokens: number;
  /** Total estimated cost in USD */
  totalCostUsd: number;
  /** Number of requests per model */
  requestsByModel: Record<string, number>;
  /** Number of successful requests */
  successfulRequests: number;
  /** Number of failed requests */
  failedRequests: number;
}

// =============================================================================
// HEALTH CHECK TYPES
// =============================================================================

/** Health status of an AI provider */
export type HealthStatus = 'healthy' | 'degraded' | 'offline';

/**
 * Result of a health check on an AI provider.
 */
export interface HealthCheckResult {
  /** Current health status */
  status: HealthStatus;
  /** Latency of the health check request in milliseconds */
  latency_ms: number;
  /** The model used for health check */
  model: string;
  /** Error message if health check failed */
  error?: string;
  /** Timestamp when the check was performed */
  checked_at: string;
}

/**
 * Latency metrics for an AI provider.
 * Tracks p50/p95/p99 percentiles from recent requests.
 */
export interface HealthMetrics {
  /** Provider name */
  provider: string;
  /** Current health status */
  status: HealthStatus;
  /** 50th percentile latency (median) in milliseconds */
  p50_latency_ms: number;
  /** 95th percentile latency in milliseconds */
  p95_latency_ms: number;
  /** 99th percentile latency in milliseconds */
  p99_latency_ms: number;
  /** Average latency in milliseconds */
  avg_latency_ms: number;
  /** Minimum latency in milliseconds */
  min_latency_ms: number;
  /** Maximum latency in milliseconds */
  max_latency_ms: number;
  /** Number of samples used for calculations */
  sample_count: number;
  /** Timestamp of the last health check */
  last_check_at: string;
  /** Number of consecutive failures */
  consecutive_failures: number;
  /** Success rate over the sample window (0-1) */
  success_rate: number;
}

/**
 * Detailed status information for an AI provider.
 */
export interface ProviderStatus {
  /** Name of the provider (e.g., 'anthropic', 'kie') */
  provider: string;
  /** Current health status */
  status: HealthStatus;
  /** Whether the provider is properly configured */
  is_configured: boolean;
  /** The default model being used */
  model: string;
  /** Current usage statistics */
  usage: AIUsageStats;
  /** Results of the most recent health check */
  health_check?: HealthCheckResult;
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Configuration options for an AI provider.
 */
export interface ProviderConfig {
  /** API key for authentication */
  apiKey?: string;
  /** Base URL for the API endpoint */
  apiUrl?: string;
  /** Default model to use */
  defaultModel?: string;
  /** Maximum number of retry attempts on failure */
  maxRetries?: number;
  /** Delay between retry attempts in milliseconds */
  retryDelayMs?: number;
  /** Timeout for API requests in milliseconds */
  timeoutMs?: number;
  /** Maximum requests per minute (rate limiting) */
  rateLimitRpm?: number;
}

// =============================================================================
// PROVIDER INTERFACE
// =============================================================================

/**
 * Interface that all AI providers must implement.
 * This allows seamless switching between providers (e.g., Kie.ai, Anthropic).
 */
export interface IAIProvider {
  /**
   * Initialize the provider with an optional API key.
   * @param apiKey - Optional API key to use instead of environment variable
   */
  initialize(apiKey?: string): void;

  /**
   * Check if the provider is properly initialized and ready to use.
   * @returns True if initialized, false otherwise
   */
  isInitialized(): boolean;

  /**
   * Send a message to the AI provider and get a response.
   * @param messages - Array of messages in the conversation
   * @param options - Optional configuration for the request
   * @returns Promise resolving to the AI response
   */
  sendMessage(
    messages: AIMessage[],
    options?: AISendMessageOptions
  ): Promise<AIResponse>;

  /**
   * Send a message with streaming support.
   * @param messages - Array of messages in the conversation
   * @param options - Optional configuration for the request
   * @param callbacks - Callbacks for handling streaming events
   * @returns Promise resolving to the complete AI response
   */
  sendMessageStream(
    messages: AIMessage[],
    options?: AISendMessageOptions,
    callbacks?: StreamCallbacks
  ): Promise<AIResponse>;

  /**
   * Simple helper for single-turn conversations.
   * @param question - The question to ask
   * @param options - Optional configuration for the request
   * @returns Promise resolving to the response text
   */
  ask(question: string, options?: AISendMessageOptions): Promise<string>;

  /**
   * Perform a health check on the provider.
   * @returns Promise resolving to health check results
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * Get current usage statistics.
   * @returns Current usage statistics
   */
  getUsageStats(): AIUsageStats;

  /**
   * Reset usage statistics to zero.
   */
  resetUsageStats(): void;

  /**
   * Get detailed provider status including health and usage.
   * @returns Promise resolving to provider status
   */
  getProviderStatus(): Promise<ProviderStatus>;

  /**
   * Get the list of available models for this provider.
   * @returns Array of model identifiers
   */
  getAvailableModels(): string[];

  /**
   * Get the current configuration (read-only).
   * @returns Current provider configuration
   */
  getConfig(): Readonly<Required<ProviderConfig>>;

  /**
   * Update provider configuration.
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<ProviderConfig>): void;

  /**
   * Estimate the number of tokens for a text string.
   * @param text - Text to estimate tokens for
   * @returns Estimated token count
   */
  estimateTokens(text: string): number;

  /**
   * Estimate the cost for a given number of tokens.
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens
   * @param model - Optional model to use for pricing
   * @returns Estimated cost in USD
   */
  estimateCost(inputTokens: number, outputTokens: number, model?: string): number;

  /**
   * Get detailed health metrics including latency percentiles.
   * @returns Health metrics with p50/p95/p99 latency data
   */
  getHealthMetrics(): HealthMetrics;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Error thrown by AI providers.
 */
export interface AIProviderError extends Error {
  /** HTTP status code (e.g., 401, 429, 500) */
  status: number;
  /** Error code from the provider */
  code?: string;
  /** Whether the error is retryable */
  retryable: boolean;
}

// =============================================================================
// PROVIDER REGISTRY TYPES
// =============================================================================

/** Available provider names */
export type ProviderName = 'anthropic' | 'kie' | 'openai';

/**
 * Configuration for the AI provider router.
 */
export interface AIRouterConfig {
  /** Primary provider to use */
  primary: ProviderName;
  /** Fallback provider if primary fails */
  fallback?: ProviderName;
  /** Whether to fallback on error */
  fallbackOnError?: boolean;
  /** Whether to fallback on timeout */
  fallbackOnTimeout?: boolean;
  /** Timeout in milliseconds before considering fallback */
  timeoutMs?: number;
  /** Whether to track costs */
  costTracking?: boolean;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default IAIProvider;
