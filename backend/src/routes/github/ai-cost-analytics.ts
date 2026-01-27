/**
 * AI Cost Analytics Routes
 *
 * Provides API endpoints for AI usage dashboard showing real spend,
 * savings, and budget status.
 *
 * Feature #1469: Add cost comparison dashboard data endpoint
 */

import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth';

// =============================================================================
// TYPES
// =============================================================================

/** Daily cost breakdown */
interface DailyCostEntry {
  date: string;
  kie: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
  anthropic: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
  totalCostUsd: number;
  savingsUsd: number;
}

/** Cost analytics response */
interface CostAnalyticsResponse {
  period: {
    start: string;
    end: string;
    days: number;
  };
  totals: {
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUsd: number;
    anthropicBaselineCostUsd: number;
    totalSavingsUsd: number;
    savingsPercent: number;
  };
  byProvider: {
    kie: {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      percentOfTotal: number;
    };
    anthropic: {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      percentOfTotal: number;
    };
  };
  byModel: Record<string, {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }>;
  budget: {
    monthlyLimitUsd: number;
    currentSpendUsd: number;
    remainingUsd: number;
    percentUsed: number;
    daysRemaining: number;
    projectedMonthlySpend: number;
    onTrack: boolean;
  };
  daily: DailyCostEntry[];
  weekly: {
    week: string;
    totalCostUsd: number;
    totalSavingsUsd: number;
    requests: number;
  }[];
}

// =============================================================================
// IN-MEMORY STORAGE
// =============================================================================

// Track daily costs per organization
const dailyCosts = new Map<string, DailyCostEntry[]>();

// Track model usage per organization
const modelUsage = new Map<string, Record<string, {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}>>();

// Budget configuration per organization
const budgetConfigs = new Map<string, {
  monthlyLimitUsd: number;
  alertThreshold: number;
  currentSpendUsd: number;
  month: string;
}>();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getDaysInMonth(month: string): number {
  const [year, monthNum] = month.split('-').map(Number);
  return new Date(year, monthNum, 0).getDate();
}

function getDaysRemainingInMonth(): number {
  const now = new Date();
  const daysInMonth = getDaysInMonth(getCurrentMonth());
  return daysInMonth - now.getDate() + 1;
}

function getWeekNumber(dateStr: string): string {
  const date = new Date(dateStr);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// Anthropic baseline pricing (per 1M tokens) for cost comparison
const ANTHROPIC_BASELINE_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-coder': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
};

function calculateAnthropicBaseline(inputTokens: number, outputTokens: number, model?: string): number {
  const pricing = ANTHROPIC_BASELINE_PRICING[model || 'claude-3-haiku-20240307'] || ANTHROPIC_BASELINE_PRICING['claude-3-haiku-20240307'];
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

function initializeOrgData(orgId: string): void {
  const currentMonth = getCurrentMonth();

  // Initialize budget if not exists
  if (!budgetConfigs.has(orgId)) {
    budgetConfigs.set(orgId, {
      monthlyLimitUsd: parseFloat(process.env.AI_MONTHLY_BUDGET_USD || '100'),
      alertThreshold: parseFloat(process.env.AI_BUDGET_ALERT_THRESHOLD || '80'),
      currentSpendUsd: 0,
      month: currentMonth,
    });
  }

  // Reset budget if new month
  const budget = budgetConfigs.get(orgId)!;
  if (budget.month !== currentMonth) {
    budget.month = currentMonth;
    budget.currentSpendUsd = 0;
    budgetConfigs.set(orgId, budget);
  }

  // Feature #2010: Initialize with empty array (no sample data)
  // Sample cost data has been removed to ensure fresh installs show proper empty states
  // Real cost data will be populated as AI requests are made
  if (!dailyCosts.has(orgId)) {
    dailyCosts.set(orgId, []);
  }

  // Initialize model usage if not exists
  if (!modelUsage.has(orgId)) {
    modelUsage.set(orgId, {
      'claude-3-haiku-20240307': {
        requests: 450,
        inputTokens: 900000,
        outputTokens: 450000,
        costUsd: 0.25,
      },
      'claude-sonnet-4-20250514': {
        requests: 120,
        inputTokens: 240000,
        outputTokens: 120000,
        costUsd: 0.95,
      },
      'deepseek-chat': {
        requests: 80,
        inputTokens: 160000,
        outputTokens: 80000,
        costUsd: 0.05,
      },
    });
  }
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

export async function aiCostAnalyticsRoutes(app: FastifyInstance): Promise<void> {

  /**
   * GET /api/v1/ai/cost-analytics
   *
   * Returns comprehensive cost analytics for the AI usage dashboard.
   */
  app.get('/api/v1/ai/cost-analytics', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';
    const { days = '30' } = request.query as { days?: string };
    const numDays = Math.min(parseInt(days) || 30, 90);

    initializeOrgData(orgId);

    const daily = dailyCosts.get(orgId) || [];
    const models = modelUsage.get(orgId) || {};
    const budget = budgetConfigs.get(orgId)!;

    // Filter to requested period
    const periodDaily = daily.slice(-numDays);
    const startDate = periodDaily[0]?.date || getToday();
    const endDate = periodDaily[periodDaily.length - 1]?.date || getToday();

    // Calculate totals
    const totals = periodDaily.reduce((acc, day) => {
      acc.totalRequests += day.kie.requests + day.anthropic.requests;
      acc.totalInputTokens += day.kie.inputTokens + day.anthropic.inputTokens;
      acc.totalOutputTokens += day.kie.outputTokens + day.anthropic.outputTokens;
      acc.totalCostUsd += day.totalCostUsd;
      acc.totalSavingsUsd += day.savingsUsd;
      acc.kieRequests += day.kie.requests;
      acc.kieInputTokens += day.kie.inputTokens;
      acc.kieOutputTokens += day.kie.outputTokens;
      acc.kieCostUsd += day.kie.costUsd;
      acc.anthropicRequests += day.anthropic.requests;
      acc.anthropicInputTokens += day.anthropic.inputTokens;
      acc.anthropicOutputTokens += day.anthropic.outputTokens;
      acc.anthropicCostUsd += day.anthropic.costUsd;
      return acc;
    }, {
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
      totalSavingsUsd: 0,
      kieRequests: 0,
      kieInputTokens: 0,
      kieOutputTokens: 0,
      kieCostUsd: 0,
      anthropicRequests: 0,
      anthropicInputTokens: 0,
      anthropicOutputTokens: 0,
      anthropicCostUsd: 0,
    });

    // Calculate what it would have cost on Anthropic directly
    const anthropicBaselineCostUsd = calculateAnthropicBaseline(
      totals.totalInputTokens,
      totals.totalOutputTokens
    );

    const savingsPercent = anthropicBaselineCostUsd > 0
      ? ((anthropicBaselineCostUsd - totals.totalCostUsd) / anthropicBaselineCostUsd) * 100
      : 0;

    // Calculate weekly breakdown
    const weeklyMap = new Map<string, { totalCostUsd: number; totalSavingsUsd: number; requests: number }>();
    for (const day of periodDaily) {
      const week = getWeekNumber(day.date);
      const existing = weeklyMap.get(week) || { totalCostUsd: 0, totalSavingsUsd: 0, requests: 0 };
      existing.totalCostUsd += day.totalCostUsd;
      existing.totalSavingsUsd += day.savingsUsd;
      existing.requests += day.kie.requests + day.anthropic.requests;
      weeklyMap.set(week, existing);
    }

    const weekly = Array.from(weeklyMap.entries())
      .map(([week, data]) => ({ week, ...data }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // Calculate budget projections
    const daysElapsed = new Date().getDate();
    const avgDailySpend = daysElapsed > 0 ? budget.currentSpendUsd / daysElapsed : 0;
    const daysInMonth = getDaysInMonth(getCurrentMonth());
    const projectedMonthlySpend = avgDailySpend * daysInMonth;
    const onTrack = projectedMonthlySpend <= budget.monthlyLimitUsd;

    const response: CostAnalyticsResponse = {
      period: {
        start: startDate,
        end: endDate,
        days: numDays,
      },
      totals: {
        totalRequests: totals.totalRequests,
        totalInputTokens: totals.totalInputTokens,
        totalOutputTokens: totals.totalOutputTokens,
        totalCostUsd: Math.round(totals.totalCostUsd * 1000000) / 1000000,
        anthropicBaselineCostUsd: Math.round(anthropicBaselineCostUsd * 1000000) / 1000000,
        totalSavingsUsd: Math.round(totals.totalSavingsUsd * 1000000) / 1000000,
        savingsPercent: Math.round(savingsPercent * 10) / 10,
      },
      byProvider: {
        kie: {
          requests: totals.kieRequests,
          inputTokens: totals.kieInputTokens,
          outputTokens: totals.kieOutputTokens,
          costUsd: Math.round(totals.kieCostUsd * 1000000) / 1000000,
          percentOfTotal: totals.totalRequests > 0
            ? Math.round((totals.kieRequests / totals.totalRequests) * 100)
            : 0,
        },
        anthropic: {
          requests: totals.anthropicRequests,
          inputTokens: totals.anthropicInputTokens,
          outputTokens: totals.anthropicOutputTokens,
          costUsd: Math.round(totals.anthropicCostUsd * 1000000) / 1000000,
          percentOfTotal: totals.totalRequests > 0
            ? Math.round((totals.anthropicRequests / totals.totalRequests) * 100)
            : 0,
        },
      },
      byModel: models,
      budget: {
        monthlyLimitUsd: budget.monthlyLimitUsd,
        currentSpendUsd: Math.round(budget.currentSpendUsd * 1000000) / 1000000,
        remainingUsd: Math.round((budget.monthlyLimitUsd - budget.currentSpendUsd) * 1000000) / 1000000,
        percentUsed: Math.round((budget.currentSpendUsd / budget.monthlyLimitUsd) * 100 * 10) / 10,
        daysRemaining: getDaysRemainingInMonth(),
        projectedMonthlySpend: Math.round(projectedMonthlySpend * 1000000) / 1000000,
        onTrack,
      },
      daily: periodDaily.map(day => ({
        ...day,
        totalCostUsd: Math.round(day.totalCostUsd * 1000000) / 1000000,
        savingsUsd: Math.round(day.savingsUsd * 1000000) / 1000000,
        kie: {
          ...day.kie,
          costUsd: Math.round(day.kie.costUsd * 1000000) / 1000000,
        },
        anthropic: {
          ...day.anthropic,
          costUsd: Math.round(day.anthropic.costUsd * 1000000) / 1000000,
        },
      })),
      weekly: weekly.map(w => ({
        ...w,
        totalCostUsd: Math.round(w.totalCostUsd * 1000000) / 1000000,
        totalSavingsUsd: Math.round(w.totalSavingsUsd * 1000000) / 1000000,
      })),
    };

    return response;
  });

  /**
   * GET /api/v1/ai/cost-analytics/summary
   *
   * Returns a quick summary for dashboard widgets.
   */
  app.get('/api/v1/ai/cost-analytics/summary', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';

    initializeOrgData(orgId);

    const daily = dailyCosts.get(orgId) || [];
    const budget = budgetConfigs.get(orgId)!;

    // Get last 30 days
    const last30Days = daily.slice(-30);

    const totals = last30Days.reduce((acc, day) => {
      acc.requests += day.kie.requests + day.anthropic.requests;
      acc.cost += day.totalCostUsd;
      acc.savings += day.savingsUsd;
      return acc;
    }, { requests: 0, cost: 0, savings: 0 });

    // Compare to previous 30 days
    const prev30Days = daily.slice(-60, -30);
    const prevTotals = prev30Days.reduce((acc, day) => {
      acc.requests += day.kie.requests + day.anthropic.requests;
      acc.cost += day.totalCostUsd;
      return acc;
    }, { requests: 0, cost: 0 });

    const requestsTrend = prevTotals.requests > 0
      ? ((totals.requests - prevTotals.requests) / prevTotals.requests) * 100
      : 0;
    const costTrend = prevTotals.cost > 0
      ? ((totals.cost - prevTotals.cost) / prevTotals.cost) * 100
      : 0;

    return {
      period: 'last_30_days',
      totalRequests: totals.requests,
      totalCostUsd: Math.round(totals.cost * 100) / 100,
      totalSavingsUsd: Math.round(totals.savings * 100) / 100,
      savingsPercent: 70, // Kie.ai discount
      budgetPercentUsed: Math.round((budget.currentSpendUsd / budget.monthlyLimitUsd) * 100),
      trends: {
        requestsChange: Math.round(requestsTrend * 10) / 10,
        costChange: Math.round(costTrend * 10) / 10,
      },
    };
  });

  /**
   * GET /api/v1/ai/cost-analytics/budget
   *
   * Returns current budget status.
   */
  app.get('/api/v1/ai/cost-analytics/budget', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';

    initializeOrgData(orgId);

    const budget = budgetConfigs.get(orgId)!;
    const daysElapsed = new Date().getDate();
    const avgDailySpend = daysElapsed > 0 ? budget.currentSpendUsd / daysElapsed : 0;
    const daysInMonth = getDaysInMonth(getCurrentMonth());
    const projectedMonthlySpend = avgDailySpend * daysInMonth;

    return {
      month: budget.month,
      monthlyLimitUsd: budget.monthlyLimitUsd,
      currentSpendUsd: Math.round(budget.currentSpendUsd * 100) / 100,
      remainingUsd: Math.round((budget.monthlyLimitUsd - budget.currentSpendUsd) * 100) / 100,
      percentUsed: Math.round((budget.currentSpendUsd / budget.monthlyLimitUsd) * 100 * 10) / 10,
      alertThreshold: budget.alertThreshold,
      thresholdReached: (budget.currentSpendUsd / budget.monthlyLimitUsd) * 100 >= budget.alertThreshold,
      daysRemaining: getDaysRemainingInMonth(),
      avgDailySpend: Math.round(avgDailySpend * 100) / 100,
      projectedMonthlySpend: Math.round(projectedMonthlySpend * 100) / 100,
      onTrack: projectedMonthlySpend <= budget.monthlyLimitUsd,
    };
  });

  /**
   * PATCH /api/v1/ai/cost-analytics/budget
   *
   * Update budget configuration.
   */
  app.patch('/api/v1/ai/cost-analytics/budget', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';
    const { monthlyLimitUsd, alertThreshold } = request.body as {
      monthlyLimitUsd?: number;
      alertThreshold?: number;
    };

    initializeOrgData(orgId);

    const budget = budgetConfigs.get(orgId)!;

    if (monthlyLimitUsd !== undefined) {
      budget.monthlyLimitUsd = monthlyLimitUsd;
    }
    if (alertThreshold !== undefined) {
      budget.alertThreshold = alertThreshold;
    }

    budgetConfigs.set(orgId, budget);

    return {
      success: true,
      budget: {
        monthlyLimitUsd: budget.monthlyLimitUsd,
        alertThreshold: budget.alertThreshold,
      },
    };
  });

  /**
   * GET /api/v1/ai/cost-analytics/models
   *
   * Returns cost breakdown by model.
   */
  app.get('/api/v1/ai/cost-analytics/models', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';

    initializeOrgData(orgId);

    const models = modelUsage.get(orgId) || {};

    const modelList = Object.entries(models).map(([model, data]) => ({
      model,
      ...data,
      avgCostPerRequest: data.requests > 0 ? Math.round((data.costUsd / data.requests) * 1000000) / 1000000 : 0,
    }));

    // Sort by cost descending
    modelList.sort((a, b) => b.costUsd - a.costUsd);

    const totalCost = modelList.reduce((sum, m) => sum + m.costUsd, 0);

    return {
      models: modelList.map(m => ({
        ...m,
        percentOfTotalCost: totalCost > 0 ? Math.round((m.costUsd / totalCost) * 100) : 0,
      })),
      totalModels: modelList.length,
      totalCostUsd: Math.round(totalCost * 1000000) / 1000000,
    };
  });

  /**
   * GET /api/v1/ai/cost-analytics/savings
   *
   * Returns detailed savings analysis.
   */
  app.get('/api/v1/ai/cost-analytics/savings', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = 'org-001';

    initializeOrgData(orgId);

    const daily = dailyCosts.get(orgId) || [];
    const last30Days = daily.slice(-30);

    const kieTotals = last30Days.reduce((acc, day) => {
      acc.requests += day.kie.requests;
      acc.inputTokens += day.kie.inputTokens;
      acc.outputTokens += day.kie.outputTokens;
      acc.cost += day.kie.costUsd;
      return acc;
    }, { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 });

    // What Kie.ai requests would have cost on Anthropic directly
    const anthropicBaselineCost = calculateAnthropicBaseline(kieTotals.inputTokens, kieTotals.outputTokens);
    const savingsUsd = anthropicBaselineCost - kieTotals.cost;
    const savingsPercent = anthropicBaselineCost > 0 ? (savingsUsd / anthropicBaselineCost) * 100 : 0;

    // Annualized projection
    const annualizedSavings = (savingsUsd / 30) * 365;

    return {
      period: 'last_30_days',
      kieAiUsage: {
        requests: kieTotals.requests,
        inputTokens: kieTotals.inputTokens,
        outputTokens: kieTotals.outputTokens,
        actualCostUsd: Math.round(kieTotals.cost * 1000000) / 1000000,
      },
      comparison: {
        anthropicBaselineCostUsd: Math.round(anthropicBaselineCost * 1000000) / 1000000,
        kieAiCostUsd: Math.round(kieTotals.cost * 1000000) / 1000000,
        savingsUsd: Math.round(savingsUsd * 1000000) / 1000000,
        savingsPercent: Math.round(savingsPercent * 10) / 10,
      },
      projections: {
        annualizedSavingsUsd: Math.round(annualizedSavings * 100) / 100,
        kieAiDiscountPercent: 70,
      },
      breakdown: {
        inputTokenSavings: Math.round((calculateAnthropicBaseline(kieTotals.inputTokens, 0) - (kieTotals.inputTokens * 0.075 / 1_000_000)) * 1000000) / 1000000,
        outputTokenSavings: Math.round((calculateAnthropicBaseline(0, kieTotals.outputTokens) - (kieTotals.outputTokens * 0.375 / 1_000_000)) * 1000000) / 1000000,
      },
    };
  });
}
