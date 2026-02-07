/**
 * AI Provider Integration Routes - Types and Helpers Module
 *
 * Type definitions and helper functions for ai-providers.ts
 *
 * Feature #246: Extracted to reduce file size
 *
 * @module ai-providers-types
 */

// =====================================================
// Feature #1321: Kie.ai Provider Integration - Types
// =====================================================

export interface KieAIConfig {
  enabled: boolean;
  api_key: string;
  api_endpoint: string;
  model: string;
  max_tokens: number;
  temperature: number;
  cost_tracking_enabled: boolean;
}

export interface KieAIPricing {
  input_cost_per_million: number;
  output_cost_per_million: number;
  thinking_cost_per_million: number;
}

export interface KieAICostSavings {
  direct_anthropic_cost: number;
  kie_ai_cost: number;
  savings: number;
  savings_percentage: number;
}

export interface KieAIUsageStats {
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_thinking_tokens: number;
  total_cost: number;
  total_savings: number;
  avg_response_time_ms: number;
  success_rate: number;
}

export interface KieAIChatRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface KieAIChatResponse {
  id: string;
  model: string;
  created: number;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    thinking_tokens?: number;
    total_tokens: number;
  };
  cost: {
    input_cost: number;
    output_cost: number;
    thinking_cost: number;
    total_cost: number;
    savings: KieAICostSavings;
  };
}

// =====================================================
// Feature #1322: Anthropic Direct Provider - Types
// =====================================================

export interface AnthropicConfig {
  enabled: boolean;
  api_key: string;
  api_version: string;
  model: string;
  max_tokens: number;
  temperature: number;
  use_as_fallback: boolean;
  rate_limit_handling: 'retry' | 'queue' | 'fail';
  max_retries: number;
  retry_delay_ms: number;
}

export interface AnthropicPricing {
  input_cost_per_million: number;
  output_cost_per_million: number;
  thinking_cost_per_million?: number;
}

export interface AnthropicUsageStats {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  rate_limited_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  avg_response_time_ms: number;
  avg_tokens_per_request: number;
  error_rate: number;
}

export interface AnthropicChatRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  system?: string;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface AnthropicChatResponse {
  id: string;
  type: string;
  role: string;
  model: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  cost: {
    input_cost: number;
    output_cost: number;
    total_cost: number;
  };
  response_time_ms: number;
}

export interface AnthropicRateLimitInfo {
  requests_remaining: number;
  requests_limit: number;
  tokens_remaining: number;
  tokens_limit: number;
  reset_at: string;
}

// =====================================================
// Feature #1323: AI Provider Router - Types
// =====================================================

export interface AIRouterConfig {
  primary_provider: 'kie' | 'anthropic';
  fallback_provider: 'anthropic' | 'kie' | 'none';
  enabled: boolean;
  fallback_conditions: {
    on_timeout: boolean;
    on_rate_limit: boolean;
    on_error: boolean;
    on_server_error: boolean;
  };
  timeout_ms: number;
  max_fallback_attempts: number;
  circuit_breaker: {
    enabled: boolean;
    failure_threshold: number;
    recovery_time_ms: number;
  };
  logging: {
    log_provider_switches: boolean;
    log_failures: boolean;
    log_latency: boolean;
  };
}

export interface ProviderSwitchLog {
  id: string;
  timestamp: string;
  from_provider: string;
  to_provider: string;
  reason: 'timeout' | 'rate_limit' | 'error' | 'server_error' | 'manual';
  request_id: string;
  latency_ms?: number;
  error_message?: string;
  success: boolean;
}

export interface RouterStats {
  total_requests: number;
  primary_requests: number;
  fallback_requests: number;
  fallback_successes: number;
  fallback_failures: number;
  timeouts: number;
  rate_limits: number;
  errors: number;
  avg_latency_ms: number;
  primary_success_rate: number;
  fallback_success_rate: number;
  circuit_breaker_trips: number;
}

export interface CircuitBreakerState {
  provider: string;
  state: 'closed' | 'open' | 'half_open';
  failure_count: number;
  last_failure_time?: string;
  last_success_time?: string;
  opened_at?: string;
  recovery_at?: string;
}

// =====================================================
// In-memory Storage
// =====================================================

// Kie.ai storage
export const kieAIConfigs = new Map<string, KieAIConfig>();
export const kieAIUsageStats = new Map<string, KieAIUsageStats>();
export const kieAIChatHistory = new Map<string, KieAIChatResponse[]>();

// Anthropic storage
export const anthropicConfigs = new Map<string, AnthropicConfig>();
export const anthropicUsageStats = new Map<string, AnthropicUsageStats>();
export const anthropicChatHistory = new Map<string, AnthropicChatResponse[]>();
export const anthropicRateLimits = new Map<string, AnthropicRateLimitInfo>();

// Router storage
export const routerConfigs = new Map<string, AIRouterConfig>();
export const routerStats = new Map<string, RouterStats>();
export const providerSwitchLogs = new Map<string, ProviderSwitchLog[]>();
export const circuitBreakerStates = new Map<string, CircuitBreakerState>();

// =====================================================
// Pricing Constants
// =====================================================

// Kie.ai pricing (70% savings vs direct Anthropic)
export const KIE_AI_PRICING: KieAIPricing = {
  input_cost_per_million: 1.50,
  output_cost_per_million: 7.50,
  thinking_cost_per_million: 5.00,
};

// Direct Anthropic pricing for comparison
export const ANTHROPIC_DIRECT_PRICING = {
  input_cost_per_million: 5.00,
  output_cost_per_million: 25.00,
  thinking_cost_per_million: 15.00,
};

// Anthropic direct pricing (standard rates)
export const ANTHROPIC_PRICING: Record<string, AnthropicPricing> = {
  'claude-opus-4': {
    input_cost_per_million: 15.00,
    output_cost_per_million: 75.00,
  },
  'claude-sonnet-4': {
    input_cost_per_million: 3.00,
    output_cost_per_million: 15.00,
  },
  'claude-haiku-3.5': {
    input_cost_per_million: 0.80,
    output_cost_per_million: 4.00,
  },
};

// =====================================================
// Helper Functions
// =====================================================

export function calculateKieAICost(
  inputTokens: number,
  outputTokens: number,
  thinkingTokens: number = 0
): KieAICostSavings {
  const kieInputCost = (inputTokens / 1_000_000) * KIE_AI_PRICING.input_cost_per_million;
  const kieOutputCost = (outputTokens / 1_000_000) * KIE_AI_PRICING.output_cost_per_million;
  const kieThinkingCost = (thinkingTokens / 1_000_000) * KIE_AI_PRICING.thinking_cost_per_million;
  const kieTotalCost = kieInputCost + kieOutputCost + kieThinkingCost;

  const anthropicInputCost = (inputTokens / 1_000_000) * ANTHROPIC_DIRECT_PRICING.input_cost_per_million;
  const anthropicOutputCost = (outputTokens / 1_000_000) * ANTHROPIC_DIRECT_PRICING.output_cost_per_million;
  const anthropicThinkingCost = (thinkingTokens / 1_000_000) * ANTHROPIC_DIRECT_PRICING.thinking_cost_per_million;
  const anthropicTotalCost = anthropicInputCost + anthropicOutputCost + anthropicThinkingCost;

  return {
    direct_anthropic_cost: Math.round(anthropicTotalCost * 1000000) / 1000000,
    kie_ai_cost: Math.round(kieTotalCost * 1000000) / 1000000,
    savings: Math.round((anthropicTotalCost - kieTotalCost) * 1000000) / 1000000,
    savings_percentage: Math.round((1 - kieTotalCost / anthropicTotalCost) * 100),
  };
}

/**
 * Attempt to call Kie.ai API. Returns error message if not configured.
 */
export async function callKieAI(
  apiEndpoint: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  temperature: number,
): Promise<{ content: string; inputTokens: number; outputTokens: number; thinkingTokens: number } | { error: string }> {
  if (!apiKey || apiKey.includes('***')) {
    return { error: 'Kie.ai API key not configured. Please set a valid API key in Settings > AI Providers.' };
  }

  try {
    const response = await fetch(`${apiEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return { error: `Kie.ai API error (${response.status}): ${errorBody || response.statusText}` };
    }

    const data = await response.json() as any;
    return {
      content: data.choices?.[0]?.message?.content || 'No response content',
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      thinkingTokens: data.usage?.thinking_tokens || 0,
    };
  } catch (err: any) {
    return { error: `Kie.ai API call failed: ${err.message || 'Unknown error'}` };
  }
}

/**
 * Attempt to call Anthropic API directly. Returns error message if not configured.
 */
export async function callAnthropicDirect(
  apiKey: string,
  apiVersion: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  system: string | undefined,
  maxTokens: number,
  temperature: number,
): Promise<{ content: string; inputTokens: number; outputTokens: number } | { error: string }> {
  if (!apiKey || apiKey.includes('***')) {
    return { error: 'Anthropic API key not configured. Please set a valid API key in Settings > AI Providers.' };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': apiVersion || '2024-01-01',
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content })),
        ...(system ? { system } : {}),
        max_tokens: maxTokens,
        temperature,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return { error: `Anthropic API error (${response.status}): ${errorBody || response.statusText}` };
    }

    const data = await response.json() as any;
    return {
      content: data.content?.[0]?.text || 'No response content',
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    };
  } catch (err: any) {
    return { error: `Anthropic API call failed: ${err.message || 'Unknown error'}` };
  }
}
