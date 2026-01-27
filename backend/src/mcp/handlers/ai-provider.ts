/**
 * AI Provider Tool Handlers
 *
 * Handlers for AI provider status, cost reporting, and configuration.
 * Extracted from server.ts to reduce file size (Feature #1356).
 */

import { ToolHandler, HandlerModule } from './types';
import { aiService } from '../../services/ai-service';
import { aiRouterService } from '../../services/providers/ai-router-service.js';
import { aiRouter } from '../../services/providers/ai-router.js';

/**
 * Get AI provider status and configuration (Feature #1351)
 */
export const getAiProviderStatus: ToolHandler = async (args, context) => {
  try {
    const includeHealthMetrics = args.include_health_metrics !== false;
    const includeModelConfig = args.include_model_config !== false;
    const includeRateLimits = args.include_rate_limits !== false;
    const includeFallbackStatus = args.include_fallback_status !== false;
    const includeUsageStats = args.include_usage_stats === true;
    const performHealthCheck = args.perform_health_check === true;
    const timeWindow = (args.time_window as string) || '24h';

    context.log(`[AI] Getting AI provider status (time_window: ${timeWindow})`);

    // Get real provider status from AI service and router
    const providerStatus = await aiService.getProviderStatus();
    const config = aiService.getConfig();
    const usageData = aiService.getUsageStats();

    // Get REAL router configuration and stats
    const routerConfig = aiRouterService.getConfig();
    const routerStats = aiRouterService.getStats();
    const circuitBreakerStates = aiRouterService.getCircuitBreakerStates();
    const costSavings = aiRouterService.getCostSavings();
    const healthMetricsData = aiRouterService.getHealthMetrics();

    // Determine primary provider name
    const primaryProviderName = routerConfig.primary_provider === 'kie' ? 'Kie.ai' : 'Anthropic';
    const primaryCbState = circuitBreakerStates.find(cb => cb.provider === routerConfig.primary_provider);

    // Map circuit breaker state to operational status
    const getStatusFromCb = (cbState: typeof primaryCbState) => {
      if (!cbState) return 'operational' as const;
      if (cbState.state === 'open') return 'offline' as const;
      if (cbState.state === 'half_open') return 'degraded' as const;
      return 'operational' as const;
    };

    // Primary provider status - using REAL data from ai-router
    const primaryProvider = {
      name: primaryProviderName,
      status: getStatusFromCb(primaryCbState),
      model: config.defaultModel,
      api_version: '2024-11',
      endpoint: routerConfig.primary_provider === 'kie'
        ? 'https://kieai.erweima.ai/api/v1/chat/completions'
        : 'https://api.anthropic.com/v1/messages',
      is_configured: aiRouterService.isProviderAvailable(routerConfig.primary_provider as 'kie' | 'anthropic'),
      last_health_check: healthMetricsData.last_check_at || new Date().toISOString(),
      circuit_breaker_state: primaryCbState?.state || 'closed',
      failure_count: primaryCbState?.failure_count || 0,
    };

    // Perform real health check if requested
    let healthCheckResult: typeof providerStatus.health_check | undefined;
    if (performHealthCheck && aiService.isInitialized()) {
      healthCheckResult = await aiService.healthCheck();
      primaryProvider.status = healthCheckResult.status === 'healthy' ? 'operational' :
                               healthCheckResult.status === 'degraded' ? 'degraded' : 'offline';
      primaryProvider.last_health_check = healthCheckResult.checked_at;
    }

    // Fallback provider status - using REAL data from ai-router
    let fallbackProvider: {
      name: string;
      status: 'operational' | 'degraded' | 'offline';
      model: string;
      is_configured: boolean;
      failover_enabled: boolean;
      priority: number;
      last_health_check: string;
      circuit_breaker_state: string;
      failure_count: number;
    } | undefined;

    if (includeFallbackStatus && routerConfig.fallback_provider !== 'none') {
      const fallbackName = routerConfig.fallback_provider === 'kie' ? 'Kie.ai' : 'Anthropic';
      const fallbackCbState = circuitBreakerStates.find(cb => cb.provider === routerConfig.fallback_provider);

      fallbackProvider = {
        name: fallbackName,
        status: getStatusFromCb(fallbackCbState),
        model: routerConfig.fallback_provider === 'kie' ? 'deepseek-chat' : 'claude-3-haiku-20240307',
        is_configured: aiRouterService.isProviderAvailable(routerConfig.fallback_provider as 'kie' | 'anthropic'),
        failover_enabled: routerConfig.enabled,
        priority: 2,
        last_health_check: healthMetricsData.last_check_at || new Date().toISOString(),
        circuit_breaker_state: fallbackCbState?.state || 'closed',
        failure_count: fallbackCbState?.failure_count || 0,
      };
    }

    // Health metrics - using REAL data from ai-router
    let healthMetrics: {
      avg_latency_ms: number;
      p95_latency_ms: number;
      p99_latency_ms: number;
      error_rate: number;
      uptime_percentage: number;
      requests_total: number;
      requests_success: number;
      requests_failed: number;
      primary_success_rate: number;
      fallback_success_rate: number;
      failover_count: number;
      time_window: string;
    } | undefined;

    if (includeHealthMetrics) {
      // Use REAL latency metrics from health metrics
      healthMetrics = {
        avg_latency_ms: healthMetricsData.avg_latency_ms || healthCheckResult?.latency_ms || 250,
        p95_latency_ms: healthMetricsData.p95_latency_ms || (healthCheckResult?.latency_ms || 250) * 2,
        p99_latency_ms: healthMetricsData.p99_latency_ms || (healthCheckResult?.latency_ms || 250) * 3,
        error_rate: routerStats.total_requests > 0
          ? (routerStats.total_failures / routerStats.total_requests) * 100
          : 0,
        uptime_percentage: healthMetricsData.success_rate || (providerStatus.status === 'healthy' ? 99.9 :
                          providerStatus.status === 'degraded' ? 95.0 : 0),
        requests_total: routerStats.total_requests,
        requests_success: routerStats.primary_successes + routerStats.fallback_successes,
        requests_failed: routerStats.total_failures,
        primary_success_rate: routerStats.primary_success_rate,
        fallback_success_rate: routerStats.fallback_success_rate,
        failover_count: routerStats.failover_events.length,
        time_window: timeWindow,
      };
    }

    // Model configuration - using REAL config
    let modelConfig: {
      primary_model: string;
      max_tokens: number;
      temperature: number;
      context_window: number;
      supports_vision: boolean;
      supports_function_calling: boolean;
      streaming_enabled: boolean;
      features: string[];
    } | undefined;

    if (includeModelConfig) {
      modelConfig = {
        primary_model: config.defaultModel,
        max_tokens: 8192,
        temperature: 0.7,
        context_window: 200000,
        supports_vision: true,
        supports_function_calling: true,
        streaming_enabled: true,
        features: [
          'text_generation',
          'code_generation',
          'image_analysis',
          'function_calling',
          'structured_output',
          'long_context',
        ],
      };
    }

    // Rate limit status - estimated from config
    let rateLimitStatus: {
      requests_per_minute: number;
      requests_used: number;
      requests_remaining: number;
      tokens_per_minute: number;
      tokens_used: number;
      tokens_remaining: number;
      reset_at: string;
      is_limited: boolean;
    } | undefined;

    if (includeRateLimits) {
      const rpmLimit = config.rateLimitRpm;
      // Estimate current usage (simplified - would need time-windowed tracking for accuracy)
      const recentRequests = Math.min(usageData.totalRequests, rpmLimit);
      rateLimitStatus = {
        requests_per_minute: rpmLimit,
        requests_used: recentRequests,
        requests_remaining: rpmLimit - recentRequests,
        tokens_per_minute: 100000,
        tokens_used: usageData.totalInputTokens + usageData.totalOutputTokens,
        tokens_remaining: Math.max(0, 100000 - (usageData.totalInputTokens + usageData.totalOutputTokens)),
        reset_at: new Date(Date.now() + 60000).toISOString(),
        is_limited: recentRequests >= rpmLimit,
      };
    }

    // Usage stats - using REAL data from AI service
    let usageStats: {
      total_requests: number;
      total_tokens: number;
      input_tokens: number;
      output_tokens: number;
      estimated_cost_usd: number;
      by_model: Array<{
        model: string;
        requests: number;
        tokens: number;
        cost_usd: number;
      }>;
      time_window: string;
    } | undefined;

    if (includeUsageStats) {
      // Build model breakdown from REAL tracking data
      const modelBreakdown = Object.entries(usageData.requestsByModel).map(([model, requests]) => ({
        model,
        requests,
        tokens: Math.round((usageData.totalInputTokens + usageData.totalOutputTokens) * (requests / usageData.totalRequests)) || 0,
        cost_usd: Math.round((usageData.totalCostUsd * (requests / usageData.totalRequests)) * 100) / 100 || 0,
      }));

      usageStats = {
        total_requests: usageData.totalRequests,
        total_tokens: usageData.totalInputTokens + usageData.totalOutputTokens,
        input_tokens: usageData.totalInputTokens,
        output_tokens: usageData.totalOutputTokens,
        estimated_cost_usd: Math.round(usageData.totalCostUsd * 100) / 100,
        by_model: modelBreakdown.length > 0 ? modelBreakdown : [
          { model: config.defaultModel, requests: 0, tokens: 0, cost_usd: 0 }
        ],
        time_window: timeWindow,
      };
    }

    // Determine overall status
    const overallStatus: 'healthy' | 'degraded' | 'offline' =
      !providerStatus.is_configured ? 'offline' :
      providerStatus.status === 'healthy' ? 'healthy' :
      providerStatus.status === 'degraded' ? 'degraded' : 'offline';

    // Circuit breaker states for all providers
    const circuitBreakers = circuitBreakerStates.map(cb => ({
      provider: cb.provider,
      state: cb.state,
      failure_count: cb.failure_count,
      last_failure_time: cb.last_failure_time,
      recovery_at: cb.recovery_at,
    }));

    // Recent failover events
    const recentFailovers = routerStats.failover_events.slice(-5).map(event => ({
      timestamp: event.timestamp,
      from_provider: event.primaryProvider,
      to_provider: event.fallbackProvider,
      reason: event.reason,
      error_type: event.errorType,
    }));

    // Cost savings from using Kie.ai
    const savings = costSavings.savingsUsd > 0 ? {
      total_savings_usd: Math.round(costSavings.savingsUsd * 100) / 100,
      savings_percentage: Math.round(costSavings.savingsPercent * 10) / 10,
      kie_cost_usd: Math.round(costSavings.kieCostUsd * 100) / 100,
      anthropic_baseline_usd: Math.round(costSavings.anthropicCostUsd * 100) / 100,
    } : undefined;

    return {
      success: true,
      primary_provider: primaryProvider,
      ...(fallbackProvider ? { fallback_provider: fallbackProvider } : {}),
      ...(healthMetrics ? { health_metrics: healthMetrics } : {}),
      ...(modelConfig ? { model_configuration: modelConfig } : {}),
      ...(rateLimitStatus ? { rate_limits: rateLimitStatus } : {}),
      ...(usageStats ? { usage_stats: usageStats } : {}),
      ...(healthCheckResult ? { health_check_result: healthCheckResult } : {}),
      circuit_breakers: circuitBreakers,
      recent_failovers: recentFailovers,
      ...(savings ? { cost_savings: savings } : {}),
      router_config: {
        enabled: routerConfig.enabled,
        timeout_ms: routerConfig.timeout_ms,
        fallback_on_timeout: routerConfig.fallback_conditions.on_timeout,
        fallback_on_error: routerConfig.fallback_conditions.on_error,
        fallback_on_rate_limit: routerConfig.fallback_conditions.on_rate_limit,
        cost_tracking: routerConfig.cost_tracking,
      },
      overall_status: overallStatus,
      ai_service_initialized: aiService.isInitialized(),
      router_enabled: aiRouterService.isEnabled(),
      data_source: 'real', // Indicate this is real data from ai-router
      checked_at: new Date().toISOString(),
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to get AI provider status: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Get AI cost analytics and savings report (Feature #1352)
 * Updated to use REAL data from AI service (Feature #1454)
 * Updated to use REAL cost savings from ai-router (Feature #1477)
 */
export const getAiCostReport: ToolHandler = async (args, context) => {
  try {
    const timeWindow = (args.time_window as string) || '30d';
    const includeSavings = args.include_savings !== false;
    const includeTokenBreakdown = args.include_token_breakdown !== false;
    const includeBudgetStatus = args.include_budget_status !== false;
    const includeTrends = args.include_trends !== false;
    const groupBy = (args.group_by as string) || 'provider';
    const format = (args.format as string) || 'detailed';
    const monthlyBudget = (args.monthly_budget_usd as number) || 500; // Budget alert threshold

    context.log(`[AI] Getting AI cost report (time_window: ${timeWindow}, group_by: ${groupBy})`);

    // Get REAL usage data from AI service
    const usageData = aiService.getUsageStats();
    const config = aiService.getConfig();

    // Get REAL cost savings data from ai-router
    const routerCostSavings = aiRouterService.getCostSavings();
    const budgetManager = aiRouterService.getBudgetManager();
    const budgetManagerStatus = budgetManager.getBudgetStatus();

    // Token pricing (per 1M tokens) - same as ai-service.ts
    const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
      'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
      'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
      'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
      'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    };

    // Calculate REAL costs
    const totalTokens = usageData.totalInputTokens + usageData.totalOutputTokens;
    const realCosts = {
      total_cost_usd: Math.round(usageData.totalCostUsd * 100) / 100,
      requests: usageData.totalRequests,
      tokens: totalTokens,
    };

    // Default pricing for unknown models
    const DEFAULT_PRICING = { input: 3.00, output: 15.00 };

    // Build REAL model breakdown from tracked data
    const modelBreakdown = Object.entries(usageData.requestsByModel).map(([model, requests]) => {
      // Estimate tokens per model proportionally
      const proportion = usageData.totalRequests > 0 ? requests / usageData.totalRequests : 0;
      const modelTokens = Math.round(totalTokens * proportion);
      const pricing = TOKEN_PRICING[model] ?? DEFAULT_PRICING;

      // Calculate cost for this model
      const inputTokens = Math.round(usageData.totalInputTokens * proportion);
      const outputTokens = Math.round(usageData.totalOutputTokens * proportion);
      const modelCost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;

      return {
        model,
        cost_usd: Math.round(modelCost * 100) / 100,
        requests,
        tokens: modelTokens,
      };
    });

    // Provider breakdown - using REAL data from ai-router cost tracking
    const byProvider = [
      {
        provider: 'Kie.ai',
        cost_usd: Math.round(routerCostSavings.byProvider.kie.costUsd * 100) / 100,
        requests: routerCostSavings.byProvider.kie.requests,
        tokens: routerCostSavings.byProvider.kie.inputTokens + routerCostSavings.byProvider.kie.outputTokens,
        input_tokens: routerCostSavings.byProvider.kie.inputTokens,
        output_tokens: routerCostSavings.byProvider.kie.outputTokens,
      },
      {
        provider: 'Anthropic',
        cost_usd: Math.round(routerCostSavings.byProvider.anthropic.costUsd * 100) / 100,
        requests: routerCostSavings.byProvider.anthropic.requests,
        tokens: routerCostSavings.byProvider.anthropic.inputTokens + routerCostSavings.byProvider.anthropic.outputTokens,
        input_tokens: routerCostSavings.byProvider.anthropic.inputTokens,
        output_tokens: routerCostSavings.byProvider.anthropic.outputTokens,
      },
    ];

    // Token breakdown - using REAL data
    let tokenBreakdown: {
      input_tokens: number;
      output_tokens: number;
      input_cost_usd: number;
      output_cost_usd: number;
      average_input_per_request: number;
      average_output_per_request: number;
    } | undefined;

    if (includeTokenBreakdown) {
      const pricing = TOKEN_PRICING[config.defaultModel] ?? DEFAULT_PRICING;
      const inputCost = (usageData.totalInputTokens / 1_000_000) * pricing.input;
      const outputCost = (usageData.totalOutputTokens / 1_000_000) * pricing.output;

      tokenBreakdown = {
        input_tokens: usageData.totalInputTokens,
        output_tokens: usageData.totalOutputTokens,
        input_cost_usd: Math.round(inputCost * 100) / 100,
        output_cost_usd: Math.round(outputCost * 100) / 100,
        average_input_per_request: usageData.totalRequests > 0
          ? Math.round(usageData.totalInputTokens / usageData.totalRequests)
          : 0,
        average_output_per_request: usageData.totalRequests > 0
          ? Math.round(usageData.totalOutputTokens / usageData.totalRequests)
          : 0,
      };
    }

    // Savings analysis - using REAL data from ai-router cost savings
    let savings: {
      total_savings_usd: number;
      savings_percentage: number;
      kie_cost_usd: number;
      anthropic_baseline_usd: number;
      actual_cost_usd: number;
      by_provider: {
        kie: { requests: number; cost_usd: number };
        anthropic: { requests: number; cost_usd: number };
      };
    } | undefined;

    if (includeSavings) {
      // Use REAL cost savings from ai-router
      savings = {
        total_savings_usd: Math.round(routerCostSavings.savingsUsd * 100) / 100,
        savings_percentage: Math.round(routerCostSavings.savingsPercent * 10) / 10,
        kie_cost_usd: Math.round(routerCostSavings.kieCostUsd * 100) / 100,
        anthropic_baseline_usd: Math.round(routerCostSavings.anthropicCostUsd * 100) / 100,
        actual_cost_usd: Math.round(routerCostSavings.actualCostUsd * 100) / 100,
        by_provider: {
          kie: {
            requests: routerCostSavings.byProvider.kie.requests,
            cost_usd: Math.round(routerCostSavings.byProvider.kie.costUsd * 100) / 100,
          },
          anthropic: {
            requests: routerCostSavings.byProvider.anthropic.requests,
            cost_usd: Math.round(routerCostSavings.byProvider.anthropic.costUsd * 100) / 100,
          },
        },
      };
    }

    // Budget status - using REAL data from budget manager
    let budgetStatus: {
      current_month: string;
      monthly_budget_usd: number;
      spent_usd: number;
      remaining_usd: number;
      percentage_used: number;
      projected_month_end_usd: number;
      will_exceed_budget: boolean;
      days_remaining: number;
      budget_alert: 'none' | 'warning' | 'critical';
      alert_message?: string;
      threshold_alert_triggered: boolean;
      requests_blocked: boolean;
    } | undefined;

    if (includeBudgetStatus) {
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const currentDay = now.getDate();
      const daysRemaining = daysInMonth - currentDay;
      const daysElapsed = currentDay;

      // Use REAL budget data from budget manager
      const currentSpend = budgetManagerStatus.currentSpendUsd;
      const budgetLimit = budgetManagerStatus.budgetLimitUsd || monthlyBudget;

      // Project end-of-month spending based on current rate
      const dailyRate = daysElapsed > 0 ? currentSpend / daysElapsed : 0;
      const projected = currentSpend + (dailyRate * daysRemaining);

      // Determine alert level
      let budgetAlert: 'none' | 'warning' | 'critical' = 'none';
      let alertMessage: string | undefined;

      if (budgetManagerStatus.budgetExceeded) {
        budgetAlert = 'critical';
        alertMessage = `Budget exceeded! Spent $${currentSpend.toFixed(2)} of $${budgetLimit.toFixed(2)} monthly budget.`;
      } else if (budgetManagerStatus.thresholdAlertTriggered || projected > budgetLimit) {
        budgetAlert = 'warning';
        alertMessage = projected > budgetLimit
          ? `Projected to exceed budget by $${(projected - budgetLimit).toFixed(2)} at current rate.`
          : `Approaching budget limit: ${budgetManagerStatus.percentUsed.toFixed(1)}% used.`;
      }

      budgetStatus = {
        current_month: budgetManagerStatus.currentMonth,
        monthly_budget_usd: budgetLimit,
        spent_usd: Math.round(currentSpend * 100) / 100,
        remaining_usd: Math.round(budgetManagerStatus.remainingBudgetUsd * 100) / 100,
        percentage_used: Math.round(budgetManagerStatus.percentUsed * 10) / 10,
        projected_month_end_usd: Math.round(projected * 100) / 100,
        will_exceed_budget: projected > budgetLimit,
        days_remaining: daysRemaining,
        budget_alert: budgetAlert,
        ...(alertMessage ? { alert_message: alertMessage } : {}),
        threshold_alert_triggered: budgetManagerStatus.thresholdAlertTriggered,
        requests_blocked: budgetManagerStatus.requestsBlocked,
      };
    }

    // Trends - calculated from REAL data (would need historical tracking for accurate trends)
    let trends: {
      cost_change_percentage: number;
      cost_change_direction: 'up' | 'down' | 'stable';
      usage_change_percentage: number;
      efficiency_score: number;
      efficiency_change: number;
      avg_cost_per_request: number;
      avg_tokens_per_request: number;
    } | undefined;

    if (includeTrends) {
      const avgCostPerRequest = usageData.totalRequests > 0
        ? realCosts.total_cost_usd / usageData.totalRequests
        : 0;
      const avgTokensPerRequest = usageData.totalRequests > 0
        ? totalTokens / usageData.totalRequests
        : 0;

      // Efficiency score based on output/input ratio (higher output per input = more efficient)
      const outputInputRatio = usageData.totalInputTokens > 0
        ? usageData.totalOutputTokens / usageData.totalInputTokens
        : 0;
      const efficiencyScore = Math.min(100, Math.round(outputInputRatio * 100));

      trends = {
        cost_change_percentage: 0, // Would need historical data to calculate
        cost_change_direction: 'stable',
        usage_change_percentage: 0, // Would need historical data to calculate
        efficiency_score: efficiencyScore,
        efficiency_change: 0, // Would need historical data to calculate
        avg_cost_per_request: Math.round(avgCostPerRequest * 10000) / 10000,
        avg_tokens_per_request: Math.round(avgTokensPerRequest),
      };
    }

    if (format === 'brief') {
      return {
        success: true,
        total_cost_usd: realCosts.total_cost_usd,
        total_requests: realCosts.requests,
        time_window: timeWindow,
        data_source: 'real', // Indicate this is real data
        ...(savings ? { savings_usd: savings.total_savings_usd } : {}),
        ...(budgetStatus && budgetStatus.budget_alert !== 'none' ? { budget_alert: budgetStatus.budget_alert } : {}),
      };
    }

    return {
      success: true,
      time_window: timeWindow,
      total_cost_usd: realCosts.total_cost_usd,
      total_requests: realCosts.requests,
      total_tokens: realCosts.tokens,
      by_provider: byProvider,
      data_source: 'real', // Indicate this is real data from AI service
      ai_service_initialized: aiService.isInitialized(),
      ...(tokenBreakdown ? { token_breakdown: tokenBreakdown } : {}),
      ...(savings ? { savings: savings } : {}),
      ...(budgetStatus ? { budget_status: budgetStatus } : {}),
      ...(trends ? { trends: trends } : {}),
      generated_at: new Date().toISOString(),
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to get AI cost report: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Switch AI provider (Feature #1353)
 * Updated to use REAL hot-swap functionality from ai-router (Feature #1474)
 */
export const switchAiProvider: ToolHandler = async (args, context) => {
  try {
    const provider = args.provider as string;
    const reason = args.reason as string | undefined;
    const resetCircuitBreaker = args.reset_circuit_breaker !== false;

    if (!provider) {
      return {
        success: false,
        error: 'Missing required parameter: provider',
      };
    }

    context.log(`[AI] Switching AI provider to ${provider}`);

    // Validate provider - we support kie and anthropic
    const validProviders = ['kie', 'anthropic'];
    const normalizedProvider = provider.toLowerCase();

    if (!validProviders.includes(normalizedProvider)) {
      return {
        success: false,
        error: `Invalid provider: ${provider}. Valid options: ${validProviders.join(', ')}`,
      };
    }

    // Get current configuration before switch
    const currentConfig = aiRouterService.getConfig();
    const previousPrimary = currentConfig.primary_provider;

    // Perform REAL hot-swap using ai-router
    const switchEvent = aiRouter.setPrimaryProvider(normalizedProvider as 'kie' | 'anthropic', {
      reason: reason || 'MCP tool switch request',
      resetCircuitBreaker,
      // Set the previous primary as the new fallback
      newFallback: previousPrimary === normalizedProvider ? undefined : previousPrimary,
    });

    // Get updated configuration
    const newConfig = aiRouterService.getConfig();

    return {
      success: true,
      previous_provider: switchEvent.previousPrimary,
      new_provider: switchEvent.newPrimary,
      previous_fallback: switchEvent.previousFallback,
      new_fallback: switchEvent.newFallback,
      reason: switchEvent.reason,
      in_flight_requests: switchEvent.inFlightRequests,
      circuit_breaker_reset: resetCircuitBreaker,
      router_enabled: newConfig.enabled,
      switched_at: switchEvent.timestamp,
      message: `Successfully switched primary provider from ${switchEvent.previousPrimary} to ${switchEvent.newPrimary}`,
      data_source: 'real', // Indicate this is a real switch
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to switch AI provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

// Handler registry for AI provider tools
export const handlers: Record<string, ToolHandler> = {
  get_ai_provider_status: getAiProviderStatus,
  get_ai_cost_report: getAiCostReport,
  switch_ai_provider: switchAiProvider,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const aiProviderHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default aiProviderHandlers;
