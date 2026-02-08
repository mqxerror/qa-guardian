/**
 * AI Usage Repository
 * Feature #477: Persist AI usage statistics to PostgreSQL for cost tracking
 *
 * Provides database operations for AI usage logging, aggregation, and budget alerting.
 */

import { query, isDatabaseConnected } from '../database.js';
import { logger } from '../logger.js';

// ============================================================================
// Types
// ============================================================================

export interface AIUsageLog {
  id: string;
  organization_id: string;
  user_id?: string;
  model: string;
  provider: string;
  feature: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  success: boolean;
  error_message?: string;
  latency_ms?: number;
  created_at: Date;
}

export interface AIUsageLogInput {
  organization_id: string;
  user_id?: string;
  model: string;
  provider: string;
  feature: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  success: boolean;
  error_message?: string;
  latency_ms?: number;
}

export interface AIUsageBudget {
  id: string;
  organization_id: string;
  daily_limit_usd?: number;
  monthly_limit_usd?: number;
  alert_threshold_percent: number;
  created_at: Date;
  updated_at: Date;
}

export interface AIUsageAggregation {
  period: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  avg_latency_ms?: number;
  by_model: Record<string, { requests: number; cost_usd: number; tokens: number }>;
  by_feature: Record<string, { requests: number; cost_usd: number; tokens: number }>;
}

// ============================================================================
// Usage Logging
// ============================================================================

/**
 * Log an AI usage event to the database
 */
export async function logAIUsage(input: AIUsageLogInput): Promise<AIUsageLog | null> {
  if (!isDatabaseConnected()) {
    logger.debug('[AI Usage] Database not connected, skipping usage log');
    return null;
  }

  try {
    const result = await query<AIUsageLog>(
      `INSERT INTO ai_usage_logs (
        organization_id, user_id, model, provider, feature,
        input_tokens, output_tokens, cost_usd, success, error_message, latency_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        input.organization_id,
        input.user_id || null,
        input.model,
        input.provider,
        input.feature,
        input.input_tokens,
        input.output_tokens,
        input.cost_usd,
        input.success,
        input.error_message || null,
        input.latency_ms || null,
      ]
    );
    return result?.rows[0] || null;
  } catch (error) {
    logger.error({ error }, '[AI Usage] Failed to log usage');
    return null;
  }
}

// ============================================================================
// Usage Aggregation
// ============================================================================

/**
 * Get AI usage aggregation for an organization
 */
export async function getAIUsageAggregation(
  organizationId: string,
  period: 'day' | 'week' | 'month' = 'day',
  startDate?: Date,
  endDate?: Date
): Promise<AIUsageAggregation[]> {
  if (!isDatabaseConnected()) {
    return [];
  }

  const now = new Date();
  const start = startDate || new Date(now.getTime() - (period === 'month' ? 30 : period === 'week' ? 7 : 1) * 24 * 60 * 60 * 1000);
  const end = endDate || now;

  // Different date truncation based on period
  const truncation = period === 'month' ? 'month' : period === 'week' ? 'week' : 'day';

  try {
    // Get daily aggregation
    const dailyResult = await query<{
      period: Date;
      total_requests: string;
      successful_requests: string;
      failed_requests: string;
      total_input_tokens: string;
      total_output_tokens: string;
      total_cost_usd: string;
      avg_latency_ms: string;
    }>(
      `SELECT
        DATE_TRUNC($1, created_at) as period,
        COUNT(*) as total_requests,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests,
        SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed_requests,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(cost_usd) as total_cost_usd,
        AVG(latency_ms) FILTER (WHERE latency_ms IS NOT NULL) as avg_latency_ms
      FROM ai_usage_logs
      WHERE organization_id = $2 AND created_at BETWEEN $3 AND $4
      GROUP BY DATE_TRUNC($1, created_at)
      ORDER BY period DESC`,
      [truncation, organizationId, start, end]
    );

    // Get breakdown by model
    const modelResult = await query<{
      period: Date;
      model: string;
      requests: string;
      cost_usd: string;
      tokens: string;
    }>(
      `SELECT
        DATE_TRUNC($1, created_at) as period,
        model,
        COUNT(*) as requests,
        SUM(cost_usd) as cost_usd,
        SUM(input_tokens + output_tokens) as tokens
      FROM ai_usage_logs
      WHERE organization_id = $2 AND created_at BETWEEN $3 AND $4
      GROUP BY DATE_TRUNC($1, created_at), model
      ORDER BY period DESC, requests DESC`,
      [truncation, organizationId, start, end]
    );

    // Get breakdown by feature
    const featureResult = await query<{
      period: Date;
      feature: string;
      requests: string;
      cost_usd: string;
      tokens: string;
    }>(
      `SELECT
        DATE_TRUNC($1, created_at) as period,
        feature,
        COUNT(*) as requests,
        SUM(cost_usd) as cost_usd,
        SUM(input_tokens + output_tokens) as tokens
      FROM ai_usage_logs
      WHERE organization_id = $2 AND created_at BETWEEN $3 AND $4
      GROUP BY DATE_TRUNC($1, created_at), feature
      ORDER BY period DESC, requests DESC`,
      [truncation, organizationId, start, end]
    );

    // Build model and feature maps by period
    const modelByPeriod: Map<string, Record<string, { requests: number; cost_usd: number; tokens: number }>> = new Map();
    for (const row of (modelResult?.rows || [])) {
      const periodKey = row.period.toISOString();
      if (!modelByPeriod.has(periodKey)) {
        modelByPeriod.set(periodKey, {});
      }
      modelByPeriod.get(periodKey)![row.model] = {
        requests: parseInt(row.requests, 10),
        cost_usd: parseFloat(row.cost_usd),
        tokens: parseInt(row.tokens, 10),
      };
    }

    const featureByPeriod: Map<string, Record<string, { requests: number; cost_usd: number; tokens: number }>> = new Map();
    for (const row of (featureResult?.rows || [])) {
      const periodKey = row.period.toISOString();
      if (!featureByPeriod.has(periodKey)) {
        featureByPeriod.set(periodKey, {});
      }
      featureByPeriod.get(periodKey)![row.feature] = {
        requests: parseInt(row.requests, 10),
        cost_usd: parseFloat(row.cost_usd),
        tokens: parseInt(row.tokens, 10),
      };
    }

    // Combine into final result
    return (dailyResult?.rows || []).map(row => {
      const periodKey = row.period.toISOString();
      return {
        period: periodKey,
        total_requests: parseInt(row.total_requests, 10),
        successful_requests: parseInt(row.successful_requests, 10),
        failed_requests: parseInt(row.failed_requests, 10),
        total_input_tokens: parseInt(row.total_input_tokens, 10),
        total_output_tokens: parseInt(row.total_output_tokens, 10),
        total_cost_usd: parseFloat(row.total_cost_usd),
        avg_latency_ms: row.avg_latency_ms ? parseFloat(row.avg_latency_ms) : undefined,
        by_model: modelByPeriod.get(periodKey) || {},
        by_feature: featureByPeriod.get(periodKey) || {},
      };
    });
  } catch (error) {
    logger.error({ error }, '[AI Usage] Failed to get aggregation');
    return [];
  }
}

/**
 * Get total AI usage for current day/month for budget checking
 */
export async function getCurrentPeriodUsage(
  organizationId: string,
  period: 'day' | 'month'
): Promise<{ total_cost_usd: number; total_requests: number }> {
  if (!isDatabaseConnected()) {
    return { total_cost_usd: 0, total_requests: 0 };
  }

  try {
    const result = await query<{ total_cost_usd: string; total_requests: string }>(
      `SELECT
        COALESCE(SUM(cost_usd), 0) as total_cost_usd,
        COUNT(*) as total_requests
      FROM ai_usage_logs
      WHERE organization_id = $1
        AND created_at >= DATE_TRUNC($2, NOW())`,
      [organizationId, period]
    );

    const row = result?.rows[0];
    return {
      total_cost_usd: row ? parseFloat(row.total_cost_usd) : 0,
      total_requests: row ? parseInt(row.total_requests, 10) : 0,
    };
  } catch (error) {
    logger.error({ error }, '[AI Usage] Failed to get current period usage');
    return { total_cost_usd: 0, total_requests: 0 };
  }
}

// ============================================================================
// Budget Management
// ============================================================================

/**
 * Get or create budget for an organization
 */
export async function getAIUsageBudget(organizationId: string): Promise<AIUsageBudget | null> {
  if (!isDatabaseConnected()) {
    return null;
  }

  try {
    const result = await query<AIUsageBudget>(
      'SELECT * FROM ai_usage_budgets WHERE organization_id = $1',
      [organizationId]
    );
    return result?.rows[0] || null;
  } catch (error) {
    logger.error({ error }, '[AI Usage] Failed to get budget');
    return null;
  }
}

/**
 * Set budget for an organization
 */
export async function setAIUsageBudget(
  organizationId: string,
  dailyLimitUsd?: number,
  monthlyLimitUsd?: number,
  alertThresholdPercent: number = 80
): Promise<AIUsageBudget | null> {
  if (!isDatabaseConnected()) {
    return null;
  }

  try {
    const result = await query<AIUsageBudget>(
      `INSERT INTO ai_usage_budgets (organization_id, daily_limit_usd, monthly_limit_usd, alert_threshold_percent)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id) DO UPDATE SET
         daily_limit_usd = $2,
         monthly_limit_usd = $3,
         alert_threshold_percent = $4,
         updated_at = NOW()
       RETURNING *`,
      [organizationId, dailyLimitUsd || null, monthlyLimitUsd || null, alertThresholdPercent]
    );
    return result?.rows[0] || null;
  } catch (error) {
    logger.error({ error }, '[AI Usage] Failed to set budget');
    return null;
  }
}

/**
 * Check if budget threshold is exceeded and log alert if needed
 */
export async function checkBudgetAndAlert(
  organizationId: string
): Promise<{ exceeded: boolean; alerts: string[] }> {
  const alerts: string[] = [];

  if (!isDatabaseConnected()) {
    return { exceeded: false, alerts };
  }

  try {
    const budget = await getAIUsageBudget(organizationId);
    if (!budget) {
      return { exceeded: false, alerts };
    }

    const dailyUsage = await getCurrentPeriodUsage(organizationId, 'day');
    const monthlyUsage = await getCurrentPeriodUsage(organizationId, 'month');

    const thresholdMultiplier = budget.alert_threshold_percent / 100;

    // Check daily limit
    if (budget.daily_limit_usd) {
      const dailyThreshold = budget.daily_limit_usd * thresholdMultiplier;
      if (dailyUsage.total_cost_usd >= dailyThreshold) {
        const percent = Math.round((dailyUsage.total_cost_usd / budget.daily_limit_usd) * 100);
        alerts.push(`Daily AI usage at ${percent}% of limit ($${dailyUsage.total_cost_usd.toFixed(2)} / $${budget.daily_limit_usd})`);

        // Log alert
        await query(
          `INSERT INTO ai_usage_alerts (organization_id, alert_type, threshold_percent, current_usage_usd, limit_usd, period_start, period_end)
           VALUES ($1, 'daily', $2, $3, $4, DATE_TRUNC('day', NOW()), DATE_TRUNC('day', NOW()) + INTERVAL '1 day')`,
          [organizationId, percent, dailyUsage.total_cost_usd, budget.daily_limit_usd]
        );
      }
    }

    // Check monthly limit
    if (budget.monthly_limit_usd) {
      const monthlyThreshold = budget.monthly_limit_usd * thresholdMultiplier;
      if (monthlyUsage.total_cost_usd >= monthlyThreshold) {
        const percent = Math.round((monthlyUsage.total_cost_usd / budget.monthly_limit_usd) * 100);
        alerts.push(`Monthly AI usage at ${percent}% of limit ($${monthlyUsage.total_cost_usd.toFixed(2)} / $${budget.monthly_limit_usd})`);

        // Log alert
        await query(
          `INSERT INTO ai_usage_alerts (organization_id, alert_type, threshold_percent, current_usage_usd, limit_usd, period_start, period_end)
           VALUES ($1, 'monthly', $2, $3, $4, DATE_TRUNC('month', NOW()), DATE_TRUNC('month', NOW()) + INTERVAL '1 month')`,
          [organizationId, percent, monthlyUsage.total_cost_usd, budget.monthly_limit_usd]
        );
      }
    }

    return {
      exceeded: alerts.length > 0,
      alerts,
    };
  } catch (error) {
    logger.error({ error }, '[AI Usage] Failed to check budget');
    return { exceeded: false, alerts };
  }
}

/**
 * Get recent alerts for an organization
 */
export async function getRecentAlerts(organizationId: string, limit: number = 10): Promise<Array<{
  id: string;
  alert_type: string;
  threshold_percent: number;
  current_usage_usd: number;
  limit_usd: number;
  created_at: Date;
}>> {
  if (!isDatabaseConnected()) {
    return [];
  }

  try {
    const result = await query(
      `SELECT id, alert_type, threshold_percent, current_usage_usd, limit_usd, created_at
       FROM ai_usage_alerts
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [organizationId, limit]
    );
    return (result?.rows || []) as Array<{
      id: string;
      alert_type: string;
      threshold_percent: number;
      current_usage_usd: number;
      limit_usd: number;
      created_at: Date;
    }>;
  } catch (error) {
    logger.error({ error }, '[AI Usage] Failed to get recent alerts');
    return [];
  }
}
