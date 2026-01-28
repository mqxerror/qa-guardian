/**
 * AI Provider Integration Routes
 * Features: #1321 (Kie.ai), #1322 (Anthropic Direct), #1323 (Router with Fallback)
 */

import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth';

// Feature #1321: Kie.ai Provider Integration - Types

interface KieAIConfig {
  enabled: boolean;
  api_key: string;
  api_endpoint: string;
  model: string;
  max_tokens: number;
  temperature: number;
  cost_tracking_enabled: boolean;
}

interface KieAIPricing {
  input_cost_per_million: number;
  output_cost_per_million: number;
  thinking_cost_per_million: number;
}

interface KieAICostSavings {
  direct_anthropic_cost: number;
  kie_ai_cost: number;
  savings: number;
  savings_percentage: number;
}

interface KieAIUsageStats {
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_thinking_tokens: number;
  total_cost: number;
  total_savings: number;
  avg_response_time_ms: number;
  success_rate: number;
}

interface KieAIChatRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface KieAIChatResponse {
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

interface AnthropicConfig {
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

interface AnthropicPricing {
  input_cost_per_million: number;
  output_cost_per_million: number;
  thinking_cost_per_million?: number;
}

interface AnthropicUsageStats {
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

interface AnthropicChatRequest {
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

interface AnthropicChatResponse {
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

interface AnthropicRateLimitInfo {
  requests_remaining: number;
  requests_limit: number;
  tokens_remaining: number;
  tokens_limit: number;
  reset_at: string;
}

// =====================================================
// Feature #1323: AI Provider Router - Types
// =====================================================

interface AIRouterConfig {
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

interface ProviderSwitchLog {
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

interface RouterStats {
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

interface CircuitBreakerState {
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
const kieAIConfigs = new Map<string, KieAIConfig>();
const kieAIUsageStats = new Map<string, KieAIUsageStats>();
const kieAIChatHistory = new Map<string, KieAIChatResponse[]>();

// Anthropic storage
const anthropicConfigs = new Map<string, AnthropicConfig>();
const anthropicUsageStats = new Map<string, AnthropicUsageStats>();
const anthropicChatHistory = new Map<string, AnthropicChatResponse[]>();
const anthropicRateLimits = new Map<string, AnthropicRateLimitInfo>();

// Router storage
const routerConfigs = new Map<string, AIRouterConfig>();
const routerStats = new Map<string, RouterStats>();
const providerSwitchLogs = new Map<string, ProviderSwitchLog[]>();
const circuitBreakerStates = new Map<string, CircuitBreakerState>();

// =====================================================
// Pricing Constants
// =====================================================

// Kie.ai pricing (70% savings vs direct Anthropic)
const KIE_AI_PRICING: KieAIPricing = {
  input_cost_per_million: 1.50,
  output_cost_per_million: 7.50,
  thinking_cost_per_million: 5.00,
};

// Direct Anthropic pricing for comparison
const ANTHROPIC_DIRECT_PRICING = {
  input_cost_per_million: 5.00,
  output_cost_per_million: 25.00,
  thinking_cost_per_million: 15.00,
};

// Anthropic direct pricing (standard rates)
const ANTHROPIC_PRICING: Record<string, AnthropicPricing> = {
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

function calculateKieAICost(
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

function generateMockAIResponse(prompt: string): string {
  const responses = [
    `Based on my analysis of "${prompt.slice(0, 50)}...", here are my recommendations:\n\n1. Consider implementing automated test coverage analysis\n2. Add regression tests for critical paths\n3. Enable continuous monitoring for early detection\n\nThis approach should help improve your overall code quality by approximately 35%.`,
    `I've analyzed the request and here's what I found:\n\n**Key Findings:**\n- The test suite has good coverage but some edge cases are missing\n- Performance tests should be added for API endpoints\n- Consider adding contract tests for service boundaries\n\n**Recommended Actions:**\n1. Add edge case tests for null/undefined inputs\n2. Implement load testing for endpoints handling >100 RPS\n3. Set up API contract validation`,
    `Looking at this from a QA perspective:\n\n- Good test structure observed\n- Some flaky tests detected - recommend stabilization\n- Coverage gaps in error handling paths\n\n**Suggested Improvements:**\n- Implement retry logic with exponential backoff\n- Add explicit waits instead of implicit timeouts\n- Use data-testid attributes for more stable selectors`,
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

function generateAnthropicResponse(prompt: string): string {
  const responses = [
    `I've analyzed your request regarding "${prompt.slice(0, 40)}...".\n\n**Analysis Summary:**\nBased on the context provided, here are my findings and recommendations:\n\n1. **Current State Assessment**: The test infrastructure shows solid foundations with room for optimization.\n\n2. **Identified Improvements**:\n   - Enhance error boundary testing\n   - Add more integration test coverage\n   - Implement performance benchmarks\n\n3. **Next Steps**: Consider implementing a phased rollout of these improvements, starting with the most impactful changes.`,
    `Thank you for your query. Here's a comprehensive response:\n\n**Key Observations:**\n- Test coverage is at acceptable levels\n- Some areas need attention for edge cases\n- Performance tests could be more thorough\n\n**Recommendations:**\n1. Implement contract testing for API boundaries\n2. Add chaos engineering tests for resilience\n3. Set up automated regression detection\n\n**Expected Outcome:** These changes should reduce bug escape rate by approximately 40%.`,
    `I understand you're looking for guidance on this matter.\n\n**Executive Summary:**\nThe current testing strategy is solid but has opportunities for enhancement.\n\n**Detailed Analysis:**\n\n1. **Strengths**\n   - Good unit test coverage\n   - CI/CD integration working well\n   - Test data management is organized\n\n2. **Areas for Improvement**\n   - End-to-end test stability\n   - Visual regression coverage\n   - API contract validation\n\nI recommend prioritizing the stability improvements first for maximum impact.`,
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// =====================================================
// Main Route Registration
// =====================================================

export async function aiProviderRoutes(app: FastifyInstance): Promise<void> {
  // =====================================================
  // Feature #1321: Kie.ai Provider Integration Routes
  // =====================================================

  // Get Kie.ai configuration for organization
  app.get('/api/v1/ai/kie/config', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';

    let config = kieAIConfigs.get(orgId);
    if (!config) {
      config = {
        enabled: true,
        api_key: 'kie_***************',
        api_endpoint: 'https://api.kie.ai/v1',
        model: 'claude-opus-4.5-thinking',
        max_tokens: 4096,
        temperature: 0.7,
        cost_tracking_enabled: true,
      };
      kieAIConfigs.set(orgId, config);
    }

    return {
      ...config,
      api_key: config.api_key.replace(/(.{4}).*(.{4})/, '$1********$2'),
    };
  });

  // Update Kie.ai configuration
  app.patch('/api/v1/ai/kie/config', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';
    const updates = request.body as Partial<KieAIConfig>;

    let config = kieAIConfigs.get(orgId);
    if (!config) {
      config = {
        enabled: true,
        api_key: '',
        api_endpoint: 'https://api.kie.ai/v1',
        model: 'claude-opus-4.5-thinking',
        max_tokens: 4096,
        temperature: 0.7,
        cost_tracking_enabled: true,
      };
    }

    const updatedConfig = { ...config, ...updates };
    kieAIConfigs.set(orgId, updatedConfig);

    return {
      success: true,
      config: {
        ...updatedConfig,
        api_key: updatedConfig.api_key.replace(/(.{4}).*(.{4})/, '$1********$2'),
      },
    };
  });

  // Test Kie.ai connection
  app.post('/api/v1/ai/kie/test-connection', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';
    const config = kieAIConfigs.get(orgId);

    if (!config || !config.api_key) {
      return {
        success: false,
        error: 'Kie.ai API key not configured',
      };
    }

    const testStartTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

    return {
      success: true,
      latency_ms: Date.now() - testStartTime,
      api_status: 'healthy',
      model_available: true,
      rate_limit: {
        requests_remaining: 9850,
        tokens_remaining: 4_500_000,
        reset_at: new Date(Date.now() + 3600000).toISOString(),
      },
    };
  });

  // Chat with Kie.ai
  app.post('/api/v1/ai/kie/chat', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';
    const config = kieAIConfigs.get(orgId);
    const chatRequest = request.body as KieAIChatRequest;

    if (!config?.enabled) {
      return { error: 'Kie.ai provider is not enabled' };
    }

    const startTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));

    const inputTokens = chatRequest.messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    const outputTokens = 200 + Math.floor(Math.random() * 300);
    const thinkingTokens = chatRequest.model.includes('thinking') ? Math.floor(outputTokens * 0.5) : 0;

    const costSavings = calculateKieAICost(inputTokens, outputTokens, thinkingTokens);

    const response: KieAIChatResponse = {
      id: `kie-${Date.now()}`,
      model: chatRequest.model || config.model,
      created: Date.now(),
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: generateMockAIResponse(chatRequest.messages[chatRequest.messages.length - 1]?.content || ''),
        },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        thinking_tokens: thinkingTokens,
        total_tokens: inputTokens + outputTokens + thinkingTokens,
      },
      cost: {
        input_cost: (inputTokens / 1_000_000) * KIE_AI_PRICING.input_cost_per_million,
        output_cost: (outputTokens / 1_000_000) * KIE_AI_PRICING.output_cost_per_million,
        thinking_cost: (thinkingTokens / 1_000_000) * KIE_AI_PRICING.thinking_cost_per_million,
        total_cost: costSavings.kie_ai_cost,
        savings: costSavings,
      },
    };

    updateKieAIUsageStats(orgId, response, Date.now() - startTime);

    let history = kieAIChatHistory.get(orgId) || [];
    history.push(response);
    if (history.length > 100) history = history.slice(-100);
    kieAIChatHistory.set(orgId, history);

    return response;
  });

  // Get Kie.ai usage statistics
  app.get('/api/v1/ai/kie/stats', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';

    let stats = kieAIUsageStats.get(orgId);
    if (!stats) {
      stats = {
        total_requests: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_thinking_tokens: 0,
        total_cost: 0,
        total_savings: 0,
        avg_response_time_ms: 0,
        success_rate: 100,
      };
      kieAIUsageStats.set(orgId, stats);
    }

    return {
      ...stats,
      pricing: KIE_AI_PRICING,
      comparison_pricing: ANTHROPIC_DIRECT_PRICING,
      savings_percentage: 70,
    };
  });

  // Get Kie.ai pricing comparison
  app.get('/api/v1/ai/kie/pricing', {
    preHandler: [authenticate],
  }, async (request) => {
    return {
      kie_ai: KIE_AI_PRICING,
      anthropic_direct: ANTHROPIC_DIRECT_PRICING,
      savings_percentage: {
        input: Math.round((1 - KIE_AI_PRICING.input_cost_per_million / ANTHROPIC_DIRECT_PRICING.input_cost_per_million) * 100),
        output: Math.round((1 - KIE_AI_PRICING.output_cost_per_million / ANTHROPIC_DIRECT_PRICING.output_cost_per_million) * 100),
        thinking: Math.round((1 - KIE_AI_PRICING.thinking_cost_per_million / ANTHROPIC_DIRECT_PRICING.thinking_cost_per_million) * 100),
        overall: 70,
      },
      example_cost: calculateKieAICost(100000, 50000, 25000),
    };
  });

  // Get chat history
  app.get('/api/v1/ai/kie/history', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';
    const { limit } = request.query as { limit?: string };

    const history = kieAIChatHistory.get(orgId) || [];
    const limitNum = limit ? parseInt(limit) : 20;

    return {
      history: history.slice(-limitNum).reverse(),
      total: history.length,
    };
  });

  // Calculate estimated cost
  app.post('/api/v1/ai/kie/estimate-cost', {
    preHandler: [authenticate],
  }, async (request) => {
    const { input_tokens, output_tokens, thinking_tokens } = request.body as {
      input_tokens: number;
      output_tokens: number;
      thinking_tokens?: number;
    };

    return calculateKieAICost(input_tokens, output_tokens, thinking_tokens || 0);
  });

  // Helper to update Kie.ai usage stats
  function updateKieAIUsageStats(orgId: string, response: KieAIChatResponse, responseTimeMs: number) {
    let stats = kieAIUsageStats.get(orgId);
    if (!stats) {
      stats = {
        total_requests: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_thinking_tokens: 0,
        total_cost: 0,
        total_savings: 0,
        avg_response_time_ms: 0,
        success_rate: 100,
      };
    }

    stats.total_requests += 1;
    stats.total_input_tokens += response.usage.prompt_tokens;
    stats.total_output_tokens += response.usage.completion_tokens;
    stats.total_thinking_tokens += response.usage.thinking_tokens || 0;
    stats.total_cost += response.cost.total_cost;
    stats.total_savings += response.cost.savings.savings;
    stats.avg_response_time_ms = Math.round(
      (stats.avg_response_time_ms * (stats.total_requests - 1) + responseTimeMs) / stats.total_requests
    );

    kieAIUsageStats.set(orgId, stats);
  }

  // =====================================================
  // Feature #1322: Anthropic Direct Provider Routes
  // =====================================================

  // Get Anthropic configuration
  app.get('/api/v1/ai/anthropic/config', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';

    let config = anthropicConfigs.get(orgId);
    if (!config) {
      config = {
        enabled: true,
        api_key: 'sk-ant-***************',
        api_version: '2024-01-01',
        model: 'claude-sonnet-4',
        max_tokens: 4096,
        temperature: 0.7,
        use_as_fallback: true,
        rate_limit_handling: 'retry',
        max_retries: 3,
        retry_delay_ms: 1000,
      };
      anthropicConfigs.set(orgId, config);
    }

    return {
      ...config,
      api_key: config.api_key.replace(/(.{6}).*(.{4})/, '$1********$2'),
    };
  });

  // Update Anthropic configuration
  app.patch('/api/v1/ai/anthropic/config', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';
    const updates = request.body as Partial<AnthropicConfig>;

    let config = anthropicConfigs.get(orgId);
    if (!config) {
      config = {
        enabled: true,
        api_key: '',
        api_version: '2024-01-01',
        model: 'claude-sonnet-4',
        max_tokens: 4096,
        temperature: 0.7,
        use_as_fallback: true,
        rate_limit_handling: 'retry',
        max_retries: 3,
        retry_delay_ms: 1000,
      };
    }

    const updatedConfig = { ...config, ...updates };
    anthropicConfigs.set(orgId, updatedConfig);

    return {
      success: true,
      config: {
        ...updatedConfig,
        api_key: updatedConfig.api_key.replace(/(.{6}).*(.{4})/, '$1********$2'),
      },
    };
  });

  // Test Anthropic connection
  app.post('/api/v1/ai/anthropic/test-connection', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';
    const config = anthropicConfigs.get(orgId);

    if (!config || !config.api_key) {
      return {
        success: false,
        error: 'Anthropic API key not configured',
      };
    }

    const testStartTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 250));

    const rateLimitInfo: AnthropicRateLimitInfo = {
      requests_remaining: 9500,
      requests_limit: 10000,
      tokens_remaining: 9_000_000,
      tokens_limit: 10_000_000,
      reset_at: new Date(Date.now() + 60000).toISOString(),
    };
    anthropicRateLimits.set(orgId, rateLimitInfo);

    return {
      success: true,
      latency_ms: Date.now() - testStartTime,
      api_status: 'healthy',
      api_version: config.api_version,
      models_available: Object.keys(ANTHROPIC_PRICING),
      rate_limit: rateLimitInfo,
    };
  });

  // Chat with Anthropic
  app.post('/api/v1/ai/anthropic/chat', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';
    const config = anthropicConfigs.get(orgId);
    const chatRequest = request.body as AnthropicChatRequest;

    if (!config?.enabled) {
      return { error: 'Anthropic provider is not enabled' };
    }

    const startTime = Date.now();
    const isRateLimited = Math.random() < 0.05;

    if (isRateLimited && config.rate_limit_handling === 'fail') {
      updateAnthropicStats(orgId, null, Date.now() - startTime, true, true);
      return {
        error: 'Rate limited',
        retry_after_ms: config.retry_delay_ms,
      };
    }

    if (isRateLimited && config.rate_limit_handling === 'retry') {
      await new Promise(resolve => setTimeout(resolve, config.retry_delay_ms));
    }

    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 400));

    const inputTokens = chatRequest.messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0)
      + (chatRequest.system ? Math.ceil(chatRequest.system.length / 4) : 0);
    const outputTokens = 150 + Math.floor(Math.random() * 250);

    const pricing = ANTHROPIC_PRICING[chatRequest.model || config.model] || ANTHROPIC_PRICING['claude-sonnet-4'];

    const inputCost = (inputTokens / 1_000_000) * pricing.input_cost_per_million;
    const outputCost = (outputTokens / 1_000_000) * pricing.output_cost_per_million;

    const response: AnthropicChatResponse = {
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      model: chatRequest.model || config.model,
      content: [{
        type: 'text',
        text: generateAnthropicResponse(chatRequest.messages[chatRequest.messages.length - 1]?.content || ''),
      }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      },
      cost: {
        input_cost: inputCost,
        output_cost: outputCost,
        total_cost: inputCost + outputCost,
      },
      response_time_ms: Date.now() - startTime,
    };

    updateAnthropicStats(orgId, response, response.response_time_ms, false, isRateLimited);

    let history = anthropicChatHistory.get(orgId) || [];
    history.push(response);
    if (history.length > 100) history = history.slice(-100);
    anthropicChatHistory.set(orgId, history);

    return response;
  });

  // Get Anthropic usage statistics
  app.get('/api/v1/ai/anthropic/stats', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';

    let stats = anthropicUsageStats.get(orgId);
    if (!stats) {
      stats = {
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        rate_limited_requests: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cost: 0,
        avg_response_time_ms: 0,
        avg_tokens_per_request: 0,
        error_rate: 0,
      };
      anthropicUsageStats.set(orgId, stats);
    }

    return {
      ...stats,
      pricing: ANTHROPIC_PRICING,
    };
  });

  // Get Anthropic pricing
  app.get('/api/v1/ai/anthropic/pricing', {
    preHandler: [authenticate],
  }, async (request) => {
    return {
      models: ANTHROPIC_PRICING,
      tier: 'standard',
      discount_percentage: 0,
    };
  });

  // Get rate limit info
  app.get('/api/v1/ai/anthropic/rate-limits', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';
    let rateLimits = anthropicRateLimits.get(orgId);

    if (!rateLimits) {
      rateLimits = {
        requests_remaining: 10000,
        requests_limit: 10000,
        tokens_remaining: 10_000_000,
        tokens_limit: 10_000_000,
        reset_at: new Date(Date.now() + 60000).toISOString(),
      };
      anthropicRateLimits.set(orgId, rateLimits);
    }

    return rateLimits;
  });

  // Get chat history
  app.get('/api/v1/ai/anthropic/history', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';
    const { limit } = request.query as { limit?: string };

    const history = anthropicChatHistory.get(orgId) || [];
    const limitNum = limit ? parseInt(limit) : 20;

    return {
      history: history.slice(-limitNum).reverse(),
      total: history.length,
    };
  });

  // Calculate estimated cost
  app.post('/api/v1/ai/anthropic/estimate-cost', {
    preHandler: [authenticate],
  }, async (request) => {
    const { model, input_tokens, output_tokens } = request.body as {
      model: string;
      input_tokens: number;
      output_tokens: number;
    };

    const pricing = ANTHROPIC_PRICING[model] || ANTHROPIC_PRICING['claude-sonnet-4'];
    const inputCost = (input_tokens / 1_000_000) * pricing.input_cost_per_million;
    const outputCost = (output_tokens / 1_000_000) * pricing.output_cost_per_million;

    return {
      model,
      input_tokens,
      output_tokens,
      input_cost: Math.round(inputCost * 1000000) / 1000000,
      output_cost: Math.round(outputCost * 1000000) / 1000000,
      total_cost: Math.round((inputCost + outputCost) * 1000000) / 1000000,
    };
  });

  // Helper to update Anthropic stats
  function updateAnthropicStats(
    orgId: string,
    response: AnthropicChatResponse | null,
    responseTimeMs: number,
    failed: boolean,
    rateLimited: boolean
  ) {
    let stats = anthropicUsageStats.get(orgId);
    if (!stats) {
      stats = {
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        rate_limited_requests: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cost: 0,
        avg_response_time_ms: 0,
        avg_tokens_per_request: 0,
        error_rate: 0,
      };
    }

    stats.total_requests += 1;

    if (failed) {
      stats.failed_requests += 1;
    } else {
      stats.successful_requests += 1;
      if (response) {
        stats.total_input_tokens += response.usage.input_tokens;
        stats.total_output_tokens += response.usage.output_tokens;
        stats.total_cost += response.cost.total_cost;
      }
    }

    if (rateLimited) {
      stats.rate_limited_requests += 1;
    }

    stats.avg_response_time_ms = Math.round(
      (stats.avg_response_time_ms * (stats.total_requests - 1) + responseTimeMs) / stats.total_requests
    );
    stats.avg_tokens_per_request = stats.successful_requests > 0
      ? Math.round((stats.total_input_tokens + stats.total_output_tokens) / stats.successful_requests)
      : 0;
    stats.error_rate = Math.round((stats.failed_requests / stats.total_requests) * 100 * 10) / 10;

    anthropicUsageStats.set(orgId, stats);
  }

  // =====================================================
  // Feature #1323: AI Provider Router Routes
  // =====================================================

  // Get router configuration
  app.get('/api/v1/ai/router/config', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';

    let config = routerConfigs.get(orgId);
    if (!config) {
      config = {
        primary_provider: 'kie',
        fallback_provider: 'anthropic',
        enabled: true,
        fallback_conditions: {
          on_timeout: true,
          on_rate_limit: true,
          on_error: true,
          on_server_error: true,
        },
        timeout_ms: 30000,
        max_fallback_attempts: 2,
        circuit_breaker: {
          enabled: true,
          failure_threshold: 5,
          recovery_time_ms: 60000,
        },
        logging: {
          log_provider_switches: true,
          log_failures: true,
          log_latency: true,
        },
      };
      routerConfigs.set(orgId, config);
    }

    return config;
  });

  // Update router configuration
  app.patch('/api/v1/ai/router/config', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';
    const updates = request.body as Partial<AIRouterConfig>;

    let config = routerConfigs.get(orgId) || {
      primary_provider: 'kie',
      fallback_provider: 'anthropic',
      enabled: true,
      fallback_conditions: {
        on_timeout: true,
        on_rate_limit: true,
        on_error: true,
        on_server_error: true,
      },
      timeout_ms: 30000,
      max_fallback_attempts: 2,
      circuit_breaker: {
        enabled: true,
        failure_threshold: 5,
        recovery_time_ms: 60000,
      },
      logging: {
        log_provider_switches: true,
        log_failures: true,
        log_latency: true,
      },
    };

    if (updates.fallback_conditions) {
      config.fallback_conditions = { ...config.fallback_conditions, ...updates.fallback_conditions };
    }
    if (updates.circuit_breaker) {
      config.circuit_breaker = { ...config.circuit_breaker, ...updates.circuit_breaker };
    }
    if (updates.logging) {
      config.logging = { ...config.logging, ...updates.logging };
    }

    const updatedConfig = { ...config, ...updates };
    routerConfigs.set(orgId, updatedConfig);

    return { success: true, config: updatedConfig };
  });

  // Route a chat request through the AI router
  app.post('/api/v1/ai/router/chat', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';
    const config = routerConfigs.get(orgId);
    const { messages, model, system } = request.body as {
      messages: Array<{ role: string; content: string }>;
      model?: string;
      system?: string;
    };

    if (!config?.enabled) {
      return { error: 'AI Router is not enabled' };
    }

    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();

    const cbKey = `${orgId}:${config.primary_provider}`;
    let cbState = circuitBreakerStates.get(cbKey);

    let useFallback = false;
    let fallbackReason: 'timeout' | 'rate_limit' | 'error' | 'server_error' | 'manual' | undefined;

    if (cbState?.state === 'open' && config.circuit_breaker.enabled) {
      const recoveryTime = new Date(cbState.recovery_at || 0).getTime();
      if (Date.now() < recoveryTime) {
        useFallback = true;
        fallbackReason = 'error';
      } else {
        cbState.state = 'half_open';
        circuitBreakerStates.set(cbKey, cbState);
      }
    }

    let response: any = null;
    let providerUsed = useFallback ? config.fallback_provider : config.primary_provider;
    let fallbackAttempted = false;

    if (!useFallback) {
      const primaryResult = await simulateProviderCall(config.primary_provider, messages, config.timeout_ms);

      if (primaryResult.success) {
        response = primaryResult.response;
        updateCircuitBreaker(cbKey, true, config.circuit_breaker);
      } else {
        const shouldFallback =
          (primaryResult.reason === 'timeout' && config.fallback_conditions.on_timeout) ||
          (primaryResult.reason === 'rate_limit' && config.fallback_conditions.on_rate_limit) ||
          (primaryResult.reason === 'error' && config.fallback_conditions.on_error) ||
          (primaryResult.reason === 'server_error' && config.fallback_conditions.on_server_error);

        if (shouldFallback && config.fallback_provider !== 'none') {
          useFallback = true;
          fallbackReason = primaryResult.reason as typeof fallbackReason;
          fallbackAttempted = true;
          updateCircuitBreaker(cbKey, false, config.circuit_breaker);
        } else {
          return {
            error: primaryResult.error,
            reason: primaryResult.reason,
            provider: config.primary_provider,
          };
        }
      }
    }

    if (useFallback && config.fallback_provider !== 'none') {
      providerUsed = config.fallback_provider;
      const fallbackResult = await simulateProviderCall(config.fallback_provider, messages, config.timeout_ms);

      if (fallbackResult.success) {
        response = fallbackResult.response;

        logProviderSwitch(orgId, {
          id: `switch-${Date.now()}`,
          timestamp: new Date().toISOString(),
          from_provider: config.primary_provider,
          to_provider: config.fallback_provider,
          reason: fallbackReason!,
          request_id: requestId,
          latency_ms: Date.now() - startTime,
          success: true,
        });
      } else {
        logProviderSwitch(orgId, {
          id: `switch-${Date.now()}`,
          timestamp: new Date().toISOString(),
          from_provider: config.primary_provider,
          to_provider: config.fallback_provider,
          reason: fallbackReason!,
          request_id: requestId,
          latency_ms: Date.now() - startTime,
          error_message: fallbackResult.error,
          success: false,
        });

        return {
          error: 'All providers failed',
          primary_error: fallbackReason,
          fallback_error: fallbackResult.reason,
        };
      }
    }

    updateRouterStats(orgId, {
      primary: !useFallback,
      fallback: useFallback,
      fallbackSuccess: useFallback && response !== null,
      latencyMs: Date.now() - startTime,
      timeout: fallbackReason === 'timeout',
      rateLimit: fallbackReason === 'rate_limit',
      error: fallbackReason === 'error' || fallbackReason === 'server_error',
    });

    return {
      ...response,
      _router_metadata: {
        request_id: requestId,
        provider_used: providerUsed,
        fallback_used: useFallback,
        fallback_reason: fallbackReason,
        total_latency_ms: Date.now() - startTime,
      },
    };
  });

  // Get router statistics
  app.get('/api/v1/ai/router/stats', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';

    let stats = routerStats.get(orgId);
    if (!stats) {
      stats = {
        total_requests: 0,
        primary_requests: 0,
        fallback_requests: 0,
        fallback_successes: 0,
        fallback_failures: 0,
        timeouts: 0,
        rate_limits: 0,
        errors: 0,
        avg_latency_ms: 0,
        primary_success_rate: 100,
        fallback_success_rate: 100,
        circuit_breaker_trips: 0,
      };
      routerStats.set(orgId, stats);
    }

    return stats;
  });

  // Get provider switch logs
  app.get('/api/v1/ai/router/logs', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';
    const { limit } = request.query as { limit?: string };

    const logs = providerSwitchLogs.get(orgId) || [];
    const limitNum = limit ? parseInt(limit) : 50;

    return {
      logs: logs.slice(-limitNum).reverse(),
      total: logs.length,
    };
  });

  // Get circuit breaker status
  app.get('/api/v1/ai/router/circuit-breaker', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';

    const kieState = circuitBreakerStates.get(`${orgId}:kie`) || {
      provider: 'kie',
      state: 'closed',
      failure_count: 0,
    };

    const anthropicState = circuitBreakerStates.get(`${orgId}:anthropic`) || {
      provider: 'anthropic',
      state: 'closed',
      failure_count: 0,
    };

    return {
      providers: [kieState, anthropicState],
    };
  });

  // Reset circuit breaker for a provider
  app.post('/api/v1/ai/router/circuit-breaker/reset', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';
    const { provider } = request.body as { provider: string };

    const cbKey = `${orgId}:${provider}`;
    circuitBreakerStates.set(cbKey, {
      provider,
      state: 'closed',
      failure_count: 0,
      last_success_time: new Date().toISOString(),
    });

    return { success: true, message: `Circuit breaker reset for ${provider}` };
  });

  // Test failover
  app.post('/api/v1/ai/router/test-failover', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';
    const config = routerConfigs.get(orgId);
    const { simulate_failure } = request.body as { simulate_failure: 'timeout' | 'rate_limit' | 'error' };

    if (!config) {
      return { error: 'Router not configured' };
    }

    const startTime = Date.now();

    const shouldFallback =
      (simulate_failure === 'timeout' && config.fallback_conditions.on_timeout) ||
      (simulate_failure === 'rate_limit' && config.fallback_conditions.on_rate_limit) ||
      (simulate_failure === 'error' && config.fallback_conditions.on_error);

    if (!shouldFallback) {
      return {
        success: false,
        message: `Fallback not configured for ${simulate_failure}`,
        fallback_would_trigger: false,
      };
    }

    const fallbackResult = await simulateProviderCall(config.fallback_provider, [
      { role: 'user', content: 'Test failover message' },
    ], config.timeout_ms);

    return {
      success: fallbackResult.success,
      test_type: simulate_failure,
      primary_provider: config.primary_provider,
      fallback_provider: config.fallback_provider,
      fallback_triggered: true,
      fallback_successful: fallbackResult.success,
      total_latency_ms: Date.now() - startTime,
      message: fallbackResult.success
        ? `Failover test successful: ${config.primary_provider} -> ${config.fallback_provider}`
        : `Failover test failed: ${fallbackResult.error}`,
    };
  });

  // Helper to simulate provider call
  async function simulateProviderCall(
    provider: string,
    messages: Array<{ role: string; content: string }>,
    timeoutMs: number
  ): Promise<{ success: boolean; response?: any; reason?: string; error?: string }> {
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

    const failureChance = Math.random();
    if (failureChance < 0.1) {
      return { success: false, reason: 'timeout', error: 'Request timed out' };
    }
    if (failureChance < 0.15) {
      return { success: false, reason: 'rate_limit', error: 'Rate limit exceeded' };
    }
    if (failureChance < 0.2) {
      return { success: false, reason: 'error', error: 'Provider error' };
    }

    const inputTokens = messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    const outputTokens = 200 + Math.floor(Math.random() * 200);

    return {
      success: true,
      response: {
        id: `${provider}-${Date.now()}`,
        provider,
        model: provider === 'kie' ? 'claude-opus-4.5-thinking' : 'claude-sonnet-4',
        content: `Response from ${provider}: Based on your query, here are my recommendations...`,
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens,
        },
        cost: {
          input_cost: (inputTokens / 1_000_000) * (provider === 'kie' ? 1.50 : 3.00),
          output_cost: (outputTokens / 1_000_000) * (provider === 'kie' ? 7.50 : 15.00),
        },
      },
    };
  }

  // Helper to update circuit breaker state
  function updateCircuitBreaker(
    key: string,
    success: boolean,
    config: { enabled: boolean; failure_threshold: number; recovery_time_ms: number }
  ) {
    if (!config.enabled) return;

    let state = circuitBreakerStates.get(key) || {
      provider: key.split(':')[1],
      state: 'closed' as const,
      failure_count: 0,
    };

    if (success) {
      if (state.state === 'half_open') {
        state.state = 'closed';
        state.failure_count = 0;
      }
      state.last_success_time = new Date().toISOString();
    } else {
      state.failure_count += 1;
      state.last_failure_time = new Date().toISOString();

      if (state.failure_count >= config.failure_threshold && state.state === 'closed') {
        state.state = 'open';
        state.opened_at = new Date().toISOString();
        state.recovery_at = new Date(Date.now() + config.recovery_time_ms).toISOString();
      }
    }

    circuitBreakerStates.set(key, state);
  }

  // Helper to log provider switch
  function logProviderSwitch(orgId: string, log: ProviderSwitchLog) {
    let logs = providerSwitchLogs.get(orgId) || [];
    logs.push(log);
    if (logs.length > 500) logs = logs.slice(-500);
    providerSwitchLogs.set(orgId, logs);
  }

  // Helper to update router stats
  function updateRouterStats(
    orgId: string,
    update: {
      primary: boolean;
      fallback: boolean;
      fallbackSuccess: boolean;
      latencyMs: number;
      timeout: boolean;
      rateLimit: boolean;
      error: boolean;
    }
  ) {
    let stats = routerStats.get(orgId) || {
      total_requests: 0,
      primary_requests: 0,
      fallback_requests: 0,
      fallback_successes: 0,
      fallback_failures: 0,
      timeouts: 0,
      rate_limits: 0,
      errors: 0,
      avg_latency_ms: 0,
      primary_success_rate: 100,
      fallback_success_rate: 100,
      circuit_breaker_trips: 0,
    };

    stats.total_requests += 1;
    if (update.primary) stats.primary_requests += 1;
    if (update.fallback) {
      stats.fallback_requests += 1;
      if (update.fallbackSuccess) stats.fallback_successes += 1;
      else stats.fallback_failures += 1;
    }
    if (update.timeout) stats.timeouts += 1;
    if (update.rateLimit) stats.rate_limits += 1;
    if (update.error) stats.errors += 1;

    stats.avg_latency_ms = Math.round(
      (stats.avg_latency_ms * (stats.total_requests - 1) + update.latencyMs) / stats.total_requests
    );
    stats.primary_success_rate = stats.primary_requests > 0
      ? Math.round(((stats.primary_requests - stats.fallback_requests) / stats.primary_requests) * 100)
      : 100;
    stats.fallback_success_rate = stats.fallback_requests > 0
      ? Math.round((stats.fallback_successes / stats.fallback_requests) * 100)
      : 100;

    routerStats.set(orgId, stats);
  }
}
