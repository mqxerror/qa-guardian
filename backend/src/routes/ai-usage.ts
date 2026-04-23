/**
 * AI Usage Routes
 * Feature #477: Database-backed AI usage statistics for cost tracking
 *
 * Provides API endpoints for:
 * - Usage aggregation (daily/weekly/monthly)
 * - Budget management
 * - Usage alerts
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../middleware/auth.js';
import { sendError } from '../utils/errors.js';
import {
  getAIUsageAggregation,
  getCurrentPeriodUsage,
  getAIUsageBudget,
  setAIUsageBudget,
  getRecentAlerts,
  checkBudgetAndAlert,
} from '../services/repositories/ai-usage.js';
// P1c: expose AI router state for the Test Generator observability panel
import { aiRouter } from '../services/providers/ai-router.js';
// Feature #716: Zod validation middleware and schemas
import {
  validateBody,
  validateQuery,
  aiUsageQuerySchema,
  aiUsageBudgetBodySchema,
  aiUsageAlertsQuerySchema,
} from '../validation/index.js';

// ============================================================================
// Route Registration
// ============================================================================

export async function aiUsageRoutes(app: FastifyInstance) {
  // ============================================================================
  // GET /api/v1/ai/usage - Get AI usage statistics
  // Feature #477: Returns aggregated usage data from database
  // ============================================================================
  // Feature #716: Zod validation for AI usage query
  app.get<{
    Querystring: {
      period?: 'day' | 'week' | 'month';
      start_date?: string;
      end_date?: string;
    };
  }>('/api/v1/ai/usage', {
    preHandler: [authenticate],
    preValidation: [validateQuery(aiUsageQuerySchema)],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const { period = 'day', start_date, end_date } = request.query;

    // Parse dates if provided
    const startDate = start_date ? new Date(start_date) : undefined;
    const endDate = end_date ? new Date(end_date) : undefined;

    // Get aggregated usage
    const usage = await getAIUsageAggregation(orgId, period, startDate, endDate);

    // Get current period usage for summary
    const dailyUsage = await getCurrentPeriodUsage(orgId, 'day');
    const monthlyUsage = await getCurrentPeriodUsage(orgId, 'month');

    // Get budget
    const budget = await getAIUsageBudget(orgId);

    // Calculate budget status
    let budgetStatus: {
      daily: { used: number; limit: number | null; percent: number | null } | null;
      monthly: { used: number; limit: number | null; percent: number | null } | null;
    } | null = null;

    if (budget) {
      budgetStatus = {
        daily: budget.daily_limit_usd ? {
          used: dailyUsage.total_cost_usd,
          limit: budget.daily_limit_usd,
          percent: Math.round((dailyUsage.total_cost_usd / budget.daily_limit_usd) * 100),
        } : null,
        monthly: budget.monthly_limit_usd ? {
          used: monthlyUsage.total_cost_usd,
          limit: budget.monthly_limit_usd,
          percent: Math.round((monthlyUsage.total_cost_usd / budget.monthly_limit_usd) * 100),
        } : null,
      };
    }

    // Guard against timeout middleware having already sent a 504
    if (reply.sent) return;

    return {
      usage,
      summary: {
        today: {
          cost_usd: dailyUsage.total_cost_usd,
          requests: dailyUsage.total_requests,
        },
        this_month: {
          cost_usd: monthlyUsage.total_cost_usd,
          requests: monthlyUsage.total_requests,
        },
      },
      budget: budgetStatus,
      period,
    };
  });

  // ============================================================================
  // GET /api/v1/ai/usage/budget - Get budget configuration
  // Feature #477: Returns budget limits and alert thresholds
  // ============================================================================
  app.get('/api/v1/ai/usage/budget', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const budget = await getAIUsageBudget(orgId);

    // Guard against timeout middleware having already sent a 504
    if (reply.sent) return;

    return {
      budget: budget ? {
        daily_limit_usd: budget.daily_limit_usd,
        monthly_limit_usd: budget.monthly_limit_usd,
        alert_threshold_percent: budget.alert_threshold_percent,
        updated_at: budget.updated_at,
      } : null,
    };
  });

  // ============================================================================
  // PUT /api/v1/ai/usage/budget - Set budget configuration
  // Feature #477: Configure daily/monthly limits and alert thresholds
  // ============================================================================
  // Feature #716: Zod validation for AI usage budget body
  app.put<{
    Body: {
      daily_limit_usd?: number | null;
      monthly_limit_usd?: number | null;
      alert_threshold_percent?: number;
    };
  }>('/api/v1/ai/usage/budget', {
    preHandler: [authenticate],
    preValidation: [validateBody(aiUsageBudgetBodySchema)],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const { daily_limit_usd, monthly_limit_usd, alert_threshold_percent } = request.body;

    const budget = await setAIUsageBudget(
      orgId,
      daily_limit_usd ?? undefined,
      monthly_limit_usd ?? undefined,
      alert_threshold_percent ?? 80
    );

    if (!budget) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to set budget');
    }

    // Guard against timeout middleware having already sent a 504
    if (reply.sent) return;

    return {
      budget: {
        daily_limit_usd: budget.daily_limit_usd,
        monthly_limit_usd: budget.monthly_limit_usd,
        alert_threshold_percent: budget.alert_threshold_percent,
        updated_at: budget.updated_at,
      },
    };
  });

  // ============================================================================
  // GET /api/v1/ai/usage/alerts - Get recent budget alerts
  // Feature #477: Returns recent budget threshold alerts
  // ============================================================================
  // Feature #716: Zod validation for AI usage alerts query
  app.get<{
    Querystring: {
      limit?: string;
    };
  }>('/api/v1/ai/usage/alerts', {
    preHandler: [authenticate],
    preValidation: [validateQuery(aiUsageAlertsQuerySchema)],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const limit = parseInt(request.query.limit || '10', 10);

    const alerts = await getRecentAlerts(orgId, Math.min(limit, 100));

    // Guard against timeout middleware having already sent a 504
    if (reply.sent) return;

    return {
      alerts: alerts.map(alert => ({
        id: alert.id,
        alert_type: alert.alert_type,
        threshold_percent: alert.threshold_percent,
        current_usage_usd: alert.current_usage_usd,
        limit_usd: alert.limit_usd,
        created_at: alert.created_at,
      })),
    };
  });

  // ============================================================================
  // POST /api/v1/ai/usage/check-budget - Manually check budget status
  // Feature #477: Triggers budget check and returns any alerts
  // ============================================================================
  app.post('/api/v1/ai/usage/check-budget', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const result = await checkBudgetAndAlert(orgId);

    // Guard against timeout middleware having already sent a 504
    if (reply.sent) return;

    return {
      exceeded: result.exceeded,
      alerts: result.alerts,
    };
  });

  // ============================================================================
  // GET /api/v1/ai/routing-status — P1c: router + circuit breaker diagnostics
  // Read-only snapshot for the Test Generator observability panel.
  // Shows: current primary/fallback, per-provider availability, recent failover
  // events with reasons, circuit-breaker state, and cost savings.
  // ============================================================================
  app.get('/api/v1/ai/routing-status', {
    preHandler: [authenticate],
  }, async (_request, reply) => {
    try {
      const config = aiRouter.getRouterConfig();
      const stats = aiRouter.getRouterStats();
      const kieCb = aiRouter.getCircuitBreaker('kie');
      const anthropicCb = aiRouter.getCircuitBreaker('anthropic');
      const costs = aiRouter.getCostSavings();
      const switches = aiRouter.getProviderSwitchHistory().slice(-10);

      if (reply.sent) return;

      return {
        config: {
          primary: config.primary,
          fallback: config.fallback,
          fallbackOnError: config.fallbackOnError,
          fallbackOnTimeout: config.fallbackOnTimeout,
          timeoutMs: config.timeoutMs,
        },
        providers: {
          kie: {
            initialized: aiRouter.isProviderAvailable('kie'),
            // CircuitBreaker exposes getState() — safe to call even if never tripped
            circuitBreaker: kieCb ? kieCb.getState() : null,
          },
          anthropic: {
            initialized: aiRouter.isProviderAvailable('anthropic'),
            circuitBreaker: anthropicCb ? anthropicCb.getState() : null,
          },
        },
        stats: {
          totalRequests: stats.totalRequests,
          primarySuccesses: stats.primarySuccesses,
          fallbackSuccesses: stats.fallbackSuccesses,
          totalFailures: stats.totalFailures,
          primarySuccessRate: stats.totalRequests > 0
            ? Math.round((stats.primarySuccesses / stats.totalRequests) * 1000) / 10
            : null,
          lastFailoverAt: stats.lastFailoverAt,
          // Last 10 failover events (most recent first)
          recentFailovers: [...stats.failoverEvents].slice(-10).reverse(),
        },
        providerSwitches: switches,
        costSavings: {
          anthropicCostUsd: Math.round(costs.anthropicCostUsd * 10000) / 10000,
          actualCostUsd: Math.round(costs.actualCostUsd * 10000) / 10000,
          savingsUsd: Math.round(costs.savingsUsd * 10000) / 10000,
          savingsPercent: Math.round(costs.savingsPercent * 10) / 10,
          byProvider: costs.byProvider,
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (err) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR',
        err instanceof Error ? err.message : 'Failed to read routing status');
    }
  });
}
