/**
 * AI Provider Integration Routes
 * Features: #1321 (Kie.ai), #1322 (Anthropic Direct), #1323 (Router with Fallback)
 * Feature #246: Types and helpers extracted to ai-providers-types.ts
 */

import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';

// Import types and helpers from extracted module
import {
  KieAIConfig,
  KieAIChatRequest,
  KieAIChatResponse,
  KieAIUsageStats,
  AnthropicConfig,
  AnthropicChatRequest,
  AnthropicChatResponse,
  AnthropicUsageStats,
  AIRouterConfig,
  ProviderSwitchLog,
  RouterStats,
  kieAIConfigs,
  kieAIUsageStats,
  kieAIChatHistory,
  anthropicConfigs,
  anthropicUsageStats,
  anthropicChatHistory,
  anthropicRateLimits,
  routerConfigs,
  routerStats,
  providerSwitchLogs,
  circuitBreakerStates,
  KIE_AI_PRICING,
  ANTHROPIC_DIRECT_PRICING,
  ANTHROPIC_PRICING,
  calculateKieAICost,
  callKieAI,
  callAnthropicDirect,
} from './ai-providers-types.js';

// Re-export types for backward compatibility
export type {
  KieAIConfig,
  KieAIChatRequest,
  KieAIChatResponse,
  AnthropicConfig,
  AnthropicChatRequest,
  AnthropicChatResponse,
  AIRouterConfig,
};

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
    const result = await callKieAI(
      config.api_endpoint,
      config.api_key,
      config.model,
      [{ role: 'user', content: 'Hello, this is a connection test. Reply with OK.' }],
      50,
      0,
    );

    if ('error' in result) {
      return {
        success: false,
        latency_ms: Date.now() - testStartTime,
        error: result.error,
      };
    }

    return {
      success: true,
      latency_ms: Date.now() - testStartTime,
      api_status: 'healthy',
      model_available: true,
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

    const result = await callKieAI(
      config.api_endpoint,
      config.api_key,
      chatRequest.model || config.model,
      chatRequest.messages,
      chatRequest.max_tokens || config.max_tokens,
      chatRequest.temperature ?? config.temperature,
    );

    if ('error' in result) {
      return { error: result.error };
    }

    const inputTokens = result.inputTokens;
    const outputTokens = result.outputTokens;
    const thinkingTokens = result.thinkingTokens;

    const costSavings = calculateKieAICost(inputTokens, outputTokens, thinkingTokens);

    const response: KieAIChatResponse = {
      id: `kie-${Date.now()}`,
      model: chatRequest.model || config.model,
      created: Date.now(),
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: result.content,
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
    const result = await callAnthropicDirect(
      config.api_key,
      config.api_version,
      config.model,
      [{ role: 'user', content: 'Hello, this is a connection test. Reply with OK.' }],
      undefined,
      50,
      0,
    );

    if ('error' in result) {
      return {
        success: false,
        latency_ms: Date.now() - testStartTime,
        error: result.error,
      };
    }

    return {
      success: true,
      latency_ms: Date.now() - testStartTime,
      api_status: 'healthy',
      api_version: config.api_version,
      models_available: Object.keys(ANTHROPIC_PRICING),
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

    const result = await callAnthropicDirect(
      config.api_key,
      config.api_version,
      chatRequest.model || config.model,
      chatRequest.messages,
      chatRequest.system,
      chatRequest.max_tokens || config.max_tokens,
      chatRequest.temperature ?? config.temperature,
    );

    if ('error' in result) {
      updateAnthropicStats(orgId, null, Date.now() - startTime, true, false);
      return { error: result.error };
    }

    const inputTokens = result.inputTokens;
    const outputTokens = result.outputTokens;

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
        text: result.content,
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

    updateAnthropicStats(orgId, response, response.response_time_ms, false, false);

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

    const config = routerConfigs.get(orgId) || {
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
    const cbState = circuitBreakerStates.get(cbKey);

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
      const primaryResult = await callProvider(config.primary_provider, messages, config.timeout_ms);

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
      const fallbackResult = await callProvider(config.fallback_provider, messages, config.timeout_ms);

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

    const fallbackResult = await callProvider(config.fallback_provider, [
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

  // Helper to call a provider
  async function callProvider(
    provider: string,
    messages: Array<{ role: string; content: string }>,
    _timeoutMs: number
  ): Promise<{ success: boolean; response?: any; reason?: string; error?: string }> {
    const orgId = 'org-001';

    if (provider === 'kie') {
      const config = kieAIConfigs.get(orgId);
      if (!config || !config.api_key || config.api_key.includes('***')) {
        return { success: false, reason: 'error', error: 'Kie.ai API key not configured' };
      }
      const result = await callKieAI(config.api_endpoint, config.api_key, config.model, messages, config.max_tokens, config.temperature);
      if ('error' in result) {
        const reason = result.error.includes('timeout') ? 'timeout' : result.error.includes('429') ? 'rate_limit' : 'error';
        return { success: false, reason, error: result.error };
      }
      return {
        success: true,
        response: {
          id: `kie-${Date.now()}`,
          provider: 'kie',
          model: config.model,
          content: result.content,
          usage: { input_tokens: result.inputTokens, output_tokens: result.outputTokens, total_tokens: result.inputTokens + result.outputTokens },
          cost: {
            input_cost: (result.inputTokens / 1_000_000) * KIE_AI_PRICING.input_cost_per_million,
            output_cost: (result.outputTokens / 1_000_000) * KIE_AI_PRICING.output_cost_per_million,
          },
        },
      };
    } else {
      const config = anthropicConfigs.get(orgId);
      if (!config || !config.api_key || config.api_key.includes('***')) {
        return { success: false, reason: 'error', error: 'Anthropic API key not configured' };
      }
      const result = await callAnthropicDirect(config.api_key, config.api_version, config.model, messages, undefined, config.max_tokens, config.temperature);
      if ('error' in result) {
        const reason = result.error.includes('timeout') ? 'timeout' : result.error.includes('429') ? 'rate_limit' : 'error';
        return { success: false, reason, error: result.error };
      }
      return {
        success: true,
        response: {
          id: `anthropic-${Date.now()}`,
          provider: 'anthropic',
          model: config.model,
          content: result.content,
          usage: { input_tokens: result.inputTokens, output_tokens: result.outputTokens, total_tokens: result.inputTokens + result.outputTokens },
          cost: {
            input_cost: (result.inputTokens / 1_000_000) * (ANTHROPIC_PRICING[config.model]?.input_cost_per_million || 3.00),
            output_cost: (result.outputTokens / 1_000_000) * (ANTHROPIC_PRICING[config.model]?.output_cost_per_million || 15.00),
          },
        },
      };
    }
  }

  // Helper to update circuit breaker state
  function updateCircuitBreaker(
    key: string,
    success: boolean,
    config: { enabled: boolean; failure_threshold: number; recovery_time_ms: number }
  ) {
    if (!config.enabled) return;

    const state = circuitBreakerStates.get(key) || {
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
    const stats = routerStats.get(orgId) || {
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
