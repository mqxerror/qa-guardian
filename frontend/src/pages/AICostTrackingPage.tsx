// ============================================================================
// FEATURE #1325: AI Cost Tracking Per Request
// Extracted from App.tsx for code quality compliance (Feature #1357)
// Feature #340: Dark-first design system update
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { ArrowLeft, RefreshCw, DollarSign, Zap, FileInput, FileOutput, Building2, Brain, FileText, TrendingUp, Users, FolderOpen, Clock, Settings } from 'lucide-react';

// Types
interface AICostRecord {
  id: string;
  timestamp: string;
  provider: 'kie' | 'anthropic';
  model: string;
  request_type: string;
  input_tokens: number;
  output_tokens: number;
  thinking_tokens?: number;
  input_cost: number;
  output_cost: number;
  thinking_cost?: number;
  total_cost: number;
  latency_ms: number;
  user_id?: string;
  project_id?: string;
  cached: boolean;
}

interface CostSummary {
  period: string;
  total_cost: number;
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_thinking_tokens: number;
  avg_cost_per_request: number;
  by_provider: Record<string, { cost: number; requests: number; input_tokens: number; output_tokens: number }>;
  by_model: Record<string, { cost: number; requests: number; avg_latency_ms: number }>;
  by_request_type: Record<string, { cost: number; requests: number }>;
  trend: Array<{ date: string; cost: number; requests: number }>;
}

interface CostBudget {
  org_id: string;
  monthly_budget: number;
  warning_threshold_percent: number;
  critical_threshold_percent: number;
  auto_disable_on_limit: boolean;
  current_month_spend: number;
  budget_remaining: number;
  percentage_used: number;
  projected_month_end: number;
}

export function AICostTrackingPage() {
  const navigate = useNavigate();
  // Feature #232: Fixed to use Zustand auth store instead of non-existent localStorage token
  const token = useAuthStore.getState().token;

  // State
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [budget, setBudget] = useState<CostBudget | null>(null);
  const [records, setRecords] = useState<AICostRecord[]>([]);
  const [pricing, setPricing] = useState<any[]>([]);
  const [costsByUser, setCostsByUser] = useState<any[]>([]);
  const [costsByProject, setCostsByProject] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [newBudget, setNewBudget] = useState(500);

  // Fetch all data
  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Feature #313: Use correct API endpoints (cost-analytics instead of costs)
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const days = period === 'day' ? '1' : period === 'week' ? '7' : '30';

      const [analyticsRes, budgetRes, modelsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/ai/cost-analytics?days=${days}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/v1/ai/cost-analytics/budget`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/v1/ai/cost-analytics/models`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      // Parse full analytics response
      if (analyticsRes.ok) {
        const analytics = await analyticsRes.json();
        // Map analytics response to expected summary format
        setSummary({
          period: period,
          total_cost: analytics.totals?.totalCostUsd || 0,
          total_requests: analytics.totals?.totalRequests || 0,
          total_input_tokens: analytics.totals?.totalInputTokens || 0,
          total_output_tokens: analytics.totals?.totalOutputTokens || 0,
          total_thinking_tokens: 0,
          avg_cost_per_request: analytics.totals?.totalRequests > 0
            ? analytics.totals.totalCostUsd / analytics.totals.totalRequests
            : 0,
          by_provider: {
            kie: {
              cost: analytics.byProvider?.kie?.costUsd || 0,
              requests: analytics.byProvider?.kie?.requests || 0,
              input_tokens: analytics.byProvider?.kie?.inputTokens || 0,
              output_tokens: analytics.byProvider?.kie?.outputTokens || 0,
            },
            anthropic: {
              cost: analytics.byProvider?.anthropic?.costUsd || 0,
              requests: analytics.byProvider?.anthropic?.requests || 0,
              input_tokens: analytics.byProvider?.anthropic?.inputTokens || 0,
              output_tokens: analytics.byProvider?.anthropic?.outputTokens || 0,
            },
          },
          by_model: Object.fromEntries(
            Object.entries(analytics.byModel || {}).map(([model, data]: [string, any]) => [
              model,
              { cost: data.costUsd || 0, requests: data.requests || 0, avg_latency_ms: 0 }
            ])
          ),
          by_request_type: {},
          trend: (analytics.daily || []).map((d: { date: string; totalCostUsd: number; kie: { requests: number }; anthropic: { requests: number } }) => ({
            date: d.date,
            cost: d.totalCostUsd,
            requests: (d.kie?.requests || 0) + (d.anthropic?.requests || 0),
          })),
        });
      }

      // Parse budget response
      if (budgetRes.ok) {
        const budgetData = await budgetRes.json();
        setBudget({
          org_id: 'org-001',
          monthly_budget: budgetData.monthlyLimitUsd || 500,
          warning_threshold_percent: 80,
          critical_threshold_percent: 95,
          auto_disable_on_limit: false,
          current_month_spend: budgetData.currentSpendUsd || 0,
          budget_remaining: budgetData.remainingUsd || 0,
          percentage_used: budgetData.percentUsed || 0,
          projected_month_end: budgetData.projectedMonthlySpend || 0,
        });
      }

      // Parse models for pricing
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        setPricing(Object.entries(modelsData.models || {}).map(([model, data]: [string, any]) => ({
          model,
          provider: model.includes('claude') ? 'anthropic' : 'kie',
          input_cost_per_million: (data.costUsd || 0) / ((data.inputTokens || 1) / 1000000),
          output_cost_per_million: (data.costUsd || 0) / ((data.outputTokens || 1) / 1000000),
          context_window: 200000,
          max_output_tokens: 4096,
        })));
      }

      // Clear unused state since those endpoints don't exist
      setRecords([]);
      setCostsByUser([]);
      setCostsByProject([]);
    } catch (error) {
      console.error('Failed to fetch cost data:', error);
    }
    setIsLoading(false);
  };

  // Update budget
  // Feature #313: Note - budget update endpoint not yet implemented in backend
  // This will need a PATCH /api/v1/ai/cost-analytics/budget endpoint to be added
  const updateBudget = async () => {
    setIsSavingBudget(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${API_BASE}/api/v1/ai/cost-analytics/budget`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ monthlyLimitUsd: newBudget }),
      });
      if (response.ok) {
        const data = await response.json();
        setBudget({
          org_id: 'org-001',
          monthly_budget: data.monthlyLimitUsd || newBudget,
          warning_threshold_percent: 80,
          critical_threshold_percent: 95,
          auto_disable_on_limit: false,
          current_month_spend: data.currentSpendUsd || 0,
          budget_remaining: data.remainingUsd || 0,
          percentage_used: data.percentUsed || 0,
          projected_month_end: data.projectedMonthlySpend || 0,
        });
        setShowBudgetModal(false);
      }
    } catch (error) {
      console.error('Failed to update budget:', error);
    }
    setIsSavingBudget(false);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Get budget status color - dark-first
  const getBudgetStatusColor = () => {
    if (!budget) return 'bg-muted';
    if (budget.percentage_used >= budget.critical_threshold_percent) return 'bg-destructive';
    if (budget.percentage_used >= budget.warning_threshold_percent) return 'bg-warning';
    return 'bg-success';
  };

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate('/ai-insights')}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-muted-foreground">Back to AI Insights</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-primary" />
                AI Cost Tracking
              </h1>
              <p className="text-muted-foreground mt-2">
                Track AI costs per request by provider and model with token counts
              </p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as 'day' | 'week' | 'month')}
                className="px-4 py-2 border border-border bg-card text-foreground rounded-lg"
              >
                <option value="day">Last 24 Hours</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Budget Overview Banner */}
        {budget && (
          <div className="rounded-xl border border-border bg-card p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Monthly Budget
              </h2>
              <button
                onClick={() => {
                  setNewBudget(budget.monthly_budget);
                  setShowBudgetModal(true);
                }}
                className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
              >
                <Settings className="h-4 w-4" />
                Edit Budget
              </button>
            </div>
            <div className="grid grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-muted-foreground">Budget</div>
                <div className="text-2xl font-bold text-foreground">{formatCurrency(budget.monthly_budget)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Spent This Month</div>
                <div className="text-2xl font-bold text-foreground">{formatCurrency(budget.current_month_spend)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Remaining</div>
                <div className={`text-2xl font-bold ${budget.budget_remaining < 0 ? 'text-destructive' : 'text-success'}`}>
                  {formatCurrency(budget.budget_remaining)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Projected End of Month</div>
                <div className={`text-2xl font-bold ${budget.projected_month_end > budget.monthly_budget ? 'text-destructive' : 'text-foreground'}`}>
                  {formatCurrency(budget.projected_month_end)}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1 text-foreground">
                <span>{Math.round(budget.percentage_used)}% used</span>
                <span>{formatCurrency(budget.monthly_budget)}</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${getBudgetStatusColor()}`}
                  style={{ width: `${Math.min(budget.percentage_used, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Warning: {budget.warning_threshold_percent}%</span>
                <span>Critical: {budget.critical_threshold_percent}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                Total Cost
              </div>
              <div className="text-3xl font-bold text-primary">{formatCurrency(summary.total_cost)}</div>
              <div className="text-xs text-muted-foreground mt-1">{summary.total_requests} requests</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Zap className="h-4 w-4" />
                Avg Cost/Request
              </div>
              <div className="text-3xl font-bold text-purple-400">{formatCurrency(summary.avg_cost_per_request)}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <FileInput className="h-4 w-4" />
                Input Tokens
              </div>
              <div className="text-3xl font-bold text-success">{formatNumber(summary.total_input_tokens)}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <FileOutput className="h-4 w-4" />
                Output Tokens
              </div>
              <div className="text-3xl font-bold text-orange-400">{formatNumber(summary.total_output_tokens)}</div>
            </div>
          </div>
        )}

        {/* Cost by Provider & Model */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* By Provider */}
          {summary && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Cost by Provider
              </h2>
              <div className="space-y-4">
                {Object.entries(summary.by_provider).map(([provider, data]) => (
                  <div key={provider} className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center ${provider === 'kie' ? 'bg-primary/20 text-primary' : 'bg-purple-500/20 text-purple-400'}`}>
                          {provider === 'kie' ? 'K' : 'A'}
                        </span>
                        <span className="font-medium text-foreground capitalize">{provider === 'kie' ? 'Kie.ai' : 'Anthropic'}</span>
                      </div>
                      <div className="text-lg font-bold text-foreground">{formatCurrency(data.cost)}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                      <div>{data.requests} requests</div>
                      <div>{formatNumber(data.input_tokens)} in</div>
                      <div>{formatNumber(data.output_tokens)} out</div>
                    </div>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${provider === 'kie' ? 'bg-primary' : 'bg-purple-500'}`}
                        style={{ width: `${(data.cost / summary.total_cost) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Model */}
          {summary && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Cost by Model
              </h2>
              <div className="space-y-3">
                {Object.entries(summary.by_model)
                  .sort(([, a], [, b]) => b.cost - a.cost)
                  .map(([model, data]) => (
                    <div key={model} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <div className="font-medium text-foreground">{model}</div>
                        <div className="text-xs text-muted-foreground">
                          {data.requests} requests • {data.avg_latency_ms}ms avg
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-foreground">{formatCurrency(data.cost)}</div>
                        <div className="text-xs text-muted-foreground">
                          {((data.cost / summary.total_cost) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Cost by Request Type & Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* By Request Type */}
          {summary && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Cost by Request Type
              </h2>
              <div className="space-y-3">
                {Object.entries(summary.by_request_type)
                  .sort(([, a], [, b]) => b.cost - a.cost)
                  .map(([type, data]) => (
                    <div key={type} className="flex items-center gap-4">
                      <div className="w-32 text-sm text-muted-foreground capitalize">{type.replace('_', ' ')}</div>
                      <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-purple-500"
                          style={{ width: `${(data.cost / summary.total_cost) * 100}%` }}
                        ></div>
                      </div>
                      <div className="w-24 text-right">
                        <div className="font-medium text-foreground">{formatCurrency(data.cost)}</div>
                        <div className="text-xs text-muted-foreground">{data.requests} reqs</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Trend */}
          {summary && summary.trend.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Daily Cost Trend
              </h2>
              <div className="h-48 flex items-end gap-1">
                {summary.trend.slice(-14).map((day, idx) => {
                  const maxCost = Math.max(...summary.trend.map(d => d.cost));
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-gradient-to-t from-primary to-primary/60 rounded-t transition-all hover:opacity-80"
                        style={{ height: `${(day.cost / maxCost) * 150}px` }}
                        title={`${day.date}: ${formatCurrency(day.cost)}`}
                      ></div>
                      <div className="text-xs text-muted-foreground mt-1 rotate-45 origin-left whitespace-nowrap">
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Costs by User & Project */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* By User */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Top Users by Cost
            </h2>
            {costsByUser.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No user data available</div>
            ) : (
              <div className="space-y-3">
                {costsByUser.slice(0, 5).map((user, idx) => (
                  <div key={user.user_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                        idx === 0 ? 'bg-warning' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-400' : 'bg-muted-foreground'
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{user.user_id}</div>
                        <div className="text-xs text-muted-foreground">{user.requests} requests • {formatNumber(user.tokens)} tokens</div>
                      </div>
                    </div>
                    <div className="font-bold text-foreground">{formatCurrency(user.cost)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* By Project */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              Top Projects by Cost
            </h2>
            {costsByProject.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No project data available</div>
            ) : (
              <div className="space-y-3">
                {costsByProject.slice(0, 5).map((project, idx) => (
                  <div key={project.project_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                        idx === 0 ? 'bg-primary' : idx === 1 ? 'bg-primary/80' : idx === 2 ? 'bg-primary/30' : 'bg-muted-foreground'
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{project.project_id}</div>
                        <div className="text-xs text-muted-foreground">{project.requests} requests • {formatNumber(project.tokens)} tokens</div>
                      </div>
                    </div>
                    <div className="font-bold text-foreground">{formatCurrency(project.cost)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Records */}
        <div className="rounded-xl border border-border bg-card p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Recent Requests
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 text-muted-foreground">Time</th>
                  <th className="text-left py-3 px-2 text-muted-foreground">Provider</th>
                  <th className="text-left py-3 px-2 text-muted-foreground">Model</th>
                  <th className="text-left py-3 px-2 text-muted-foreground">Type</th>
                  <th className="text-right py-3 px-2 text-muted-foreground">Input</th>
                  <th className="text-right py-3 px-2 text-muted-foreground">Output</th>
                  <th className="text-right py-3 px-2 text-muted-foreground">Cost</th>
                  <th className="text-right py-3 px-2 text-muted-foreground">Latency</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 10).map((record) => (
                  <tr key={record.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-2 text-muted-foreground">
                      {new Date(record.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-2 text-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${record.provider === 'kie' ? 'bg-primary/20 text-primary' : 'bg-purple-500/20 text-purple-400'}`}>
                          {record.provider === 'kie' ? 'K' : 'A'}
                        </span>
                        {record.provider === 'kie' ? 'Kie.ai' : 'Anthropic'}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-mono text-xs text-foreground">{record.model}</td>
                    <td className="py-3 px-2 capitalize text-foreground">{record.request_type.replace('_', ' ')}</td>
                    <td className="py-3 px-2 text-right text-muted-foreground">{formatNumber(record.input_tokens)}</td>
                    <td className="py-3 px-2 text-right text-muted-foreground">{formatNumber(record.output_tokens)}</td>
                    <td className="py-3 px-2 text-right font-medium text-foreground">{formatCurrency(record.total_cost)}</td>
                    <td className="py-3 px-2 text-right text-muted-foreground">{record.latency_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Model Pricing Reference */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Model Pricing Reference
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pricing.map((model) => (
              <div key={model.model} className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${model.provider === 'kie' ? 'bg-primary/20 text-primary' : 'bg-purple-500/20 text-purple-400'}`}>
                    {model.provider === 'kie' ? 'K' : 'A'}
                  </span>
                  <span className="font-medium text-foreground">{model.model}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Input</span>
                    <span className="text-foreground">${model.input_cost_per_million}/M tokens</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Output</span>
                    <span className="text-foreground">${model.output_cost_per_million}/M tokens</span>
                  </div>
                  {model.thinking_cost_per_million && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Thinking</span>
                      <span className="text-foreground">${model.thinking_cost_per_million}/M tokens</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground text-xs mt-2">
                    <span>Context: {formatNumber(model.context_window)}</span>
                    <span>Max Out: {formatNumber(model.max_output_tokens)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Budget Edit Modal */}
        {showBudgetModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-xl p-6 w-96">
              <h3 className="text-xl font-bold mb-4 text-foreground">Edit Monthly Budget</h3>
              <div className="mb-4">
                <label className="block text-sm text-muted-foreground mb-1">Monthly Budget ($)</label>
                <input
                  type="number"
                  value={newBudget}
                  onChange={(e) => setNewBudget(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg"
                  min="0"
                  step="100"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowBudgetModal(false)}
                  className="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={updateBudget}
                  disabled={isSavingBudget}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSavingBudget ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
