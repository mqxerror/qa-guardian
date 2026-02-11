// ============================================================================
// FEATURE #412: AI Analytics Page - Merged from AIUsageAnalyticsDashboard + AICostTrackingPage
// Combines usage analytics, cost tracking, provider comparison, and budget management
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { ArrowLeft, RefreshCw, DollarSign, Zap, FileInput, FileOutput, Building2, Brain, TrendingUp, Settings } from 'lucide-react';

// Feature #317: API base URL from environment
const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================================
// Types
// ============================================================================

interface UsageAnalytics {
  period: string;
  start_date: string;
  end_date: string;
  total_requests: number;
  total_cost: number;
  total_tokens: number;
  requests_by_provider: {
    kie: { requests: number; cost: number; tokens: number; avg_latency_ms: number };
    anthropic: { requests: number; cost: number; tokens: number; avg_latency_ms: number };
  };
  savings: {
    total_saved: number;
    percentage: number;
    if_all_anthropic_cost: number;
    actual_cost: number;
  };
  usage_by_day: Array<{
    date: string;
    kie_requests: number;
    anthropic_requests: number;
    kie_cost: number;
    anthropic_cost: number;
  }>;
  usage_by_model: Record<string, { requests: number; cost: number; tokens: number; percentage: number }>;
  usage_by_feature: Record<string, { requests: number; cost: number }>;
  peak_usage: { hour: number; requests: number; day_of_week: string };
}

interface ProviderComparison {
  period: string;
  comparison: {
    kie: {
      total_requests: number;
      total_cost: number;
      total_tokens: number;
      avg_tokens_per_request: number;
      avg_cost_per_request: number;
      avg_latency_ms: number;
      cost_per_1k_tokens: number;
    };
    anthropic: {
      total_requests: number;
      total_cost: number;
      total_tokens: number;
      avg_tokens_per_request: number;
      avg_cost_per_request: number;
      avg_latency_ms: number;
      cost_per_1k_tokens: number;
    };
  };
  recommendation: string;
  cost_difference_percent: number;
}

interface UsageTrends {
  period: string;
  trends: {
    cost: { current: number; previous: number; change_percent: number; trend: string };
    requests: { current: number; previous: number; change_percent: number; trend: string };
    tokens: { current: number; previous: number; change_percent: number; trend: string };
  };
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

// ============================================================================
// Component
// ============================================================================

export function AIAnalyticsPage() {
  const navigate = useNavigate();
  const token = useAuthStore.getState().token;

  // State
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
  const [comparison, setComparison] = useState<ProviderComparison | null>(null);
  const [trends, setTrends] = useState<UsageTrends | null>(null);
  const [budget, setBudget] = useState<CostBudget | null>(null);
  const [pricing, setPricing] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'quarter'>('month');
  const [activeTab, setActiveTab] = useState<'overview' | 'costs' | 'comparison'>('overview');
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'csv' | 'pdf' | 'json'>('csv');
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [newBudget, setNewBudget] = useState(500);
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  // Fetch all data
  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const days = period === 'day' ? '1' : period === 'week' ? '7' : period === 'month' ? '30' : '90';

      const [analyticsRes, comparisonRes, trendsRes, budgetRes, modelsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/ai/analytics?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/v1/ai/analytics/comparison?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/v1/ai/analytics/trends?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/v1/ai/cost-analytics/budget`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/v1/ai/cost-analytics/models`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (comparisonRes.ok) setComparison(await comparisonRes.json());
      if (trendsRes.ok) setTrends(await trendsRes.json());

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

      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        setPricing(Object.entries(modelsData.models || {}).map(([model, data]: [string, any]) => ({
          model,
          provider: model.includes('claude') ? 'anthropic' : 'kie',
          input_cost_per_million: (data.costUsd || 0) / ((data.inputTokens || 1) / 1000000),
          output_cost_per_million: (data.costUsd || 0) / ((data.outputTokens || 1) / 1000000),
        })));
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
    setIsLoading(false);
  };

  // Export report
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/ai/analytics/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: exportType, period }),
      });
      if (response.ok) {
        // Handle successful export
      }
    } catch (error) {
      console.error('Failed to export:', error);
    }
    setIsExporting(false);
  };

  // Update budget
  const updateBudget = async () => {
    setIsSavingBudget(true);
    try {
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
        setBudget(prev => prev ? {
          ...prev,
          monthly_budget: data.monthlyLimitUsd || newBudget,
        } : null);
        setShowBudgetModal(false);
      }
    } catch (error) {
      console.error('Failed to update budget:', error);
    }
    setIsSavingBudget(false);
  };

  // Format helpers
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return '📈';
    if (trend === 'down') return '📉';
    return '➡️';
  };

  const getTrendColor = (trend: string, metric: string) => {
    if (metric === 'cost') {
      return trend === 'up' ? 'text-destructive' : trend === 'down' ? 'text-success' : 'text-muted-foreground';
    }
    return trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground';
  };

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
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-muted-foreground">Back to Dashboard</span>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary" />
                AI Analytics & Costs
              </h1>
              <p className="text-muted-foreground mt-2">
                Track AI usage, costs, and savings across providers
              </p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as 'day' | 'week' | 'month' | 'quarter')}
                className="px-4 py-2 border border-border rounded-lg bg-card text-foreground"
              >
                <option value="day">Last 24 Hours</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="quarter">Last 90 Days</option>
              </select>
              <div className="flex items-center gap-2">
                <select
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value as 'csv' | 'pdf' | 'json')}
                  className="px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground"
                >
                  <option value="csv">CSV</option>
                  <option value="pdf">PDF</option>
                  <option value="json">JSON</option>
                </select>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="px-4 py-2 bg-success text-primary-foreground rounded-lg hover:bg-success/90 disabled:opacity-50"
                >
                  {isExporting ? '⏳ Exporting...' : '📥 Export'}
                </button>
              </div>
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

        {/* Tab Navigation */}
        <div className="border-b border-border mb-6">
          <nav className="flex gap-1 -mb-px">
            {([
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'costs', label: 'Cost Tracking', icon: '💰' },
              { id: 'comparison', label: 'Provider Comparison', icon: '🔄' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* Savings Banner (always visible) */}
            {analytics && (
              <div className="bg-gradient-to-r from-success to-success text-primary-foreground rounded-xl p-6 mb-8">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">💰 You've Saved {formatCurrency(analytics.savings.total_saved)}</h2>
                    <p className="opacity-90 mt-1">
                      By using Kie.ai instead of Anthropic exclusively ({analytics.savings.percentage}% savings)
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm opacity-80">If all Anthropic</div>
                    <div className="text-xl font-bold">{formatCurrency(analytics.savings.if_all_anthropic_cost)}</div>
                    <div className="text-sm opacity-80 mt-1">Actual Cost</div>
                    <div className="text-xl font-bold">{formatCurrency(analytics.savings.actual_cost)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
                {/* Trends */}
                {trends && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-muted-foreground">Cost Trend</span>
                        <span className="text-xl">{getTrendIcon(trends.trends.cost.trend)}</span>
                      </div>
                      <div className="text-3xl font-bold">{formatCurrency(trends.trends.cost.current)}</div>
                      <div className={`text-sm ${getTrendColor(trends.trends.cost.trend, 'cost')}`}>
                        {trends.trends.cost.change_percent > 0 ? '+' : ''}{trends.trends.cost.change_percent}% vs previous
                      </div>
                    </div>
                    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-muted-foreground">Requests Trend</span>
                        <span className="text-xl">{getTrendIcon(trends.trends.requests.trend)}</span>
                      </div>
                      <div className="text-3xl font-bold">{formatNumber(trends.trends.requests.current)}</div>
                      <div className={`text-sm ${getTrendColor(trends.trends.requests.trend, 'requests')}`}>
                        {trends.trends.requests.change_percent > 0 ? '+' : ''}{trends.trends.requests.change_percent}% vs previous
                      </div>
                    </div>
                    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-muted-foreground">Tokens Trend</span>
                        <span className="text-xl">{getTrendIcon(trends.trends.tokens.trend)}</span>
                      </div>
                      <div className="text-3xl font-bold">{formatNumber(trends.trends.tokens.current)}</div>
                      <div className={`text-sm ${getTrendColor(trends.trends.tokens.trend, 'tokens')}`}>
                        {trends.trends.tokens.change_percent > 0 ? '+' : ''}{trends.trends.tokens.change_percent}% vs previous
                      </div>
                    </div>
                  </div>
                )}

                {/* Usage by Day Chart */}
                {analytics && analytics.usage_by_day.length > 0 && (
                  <div className="bg-card rounded-xl border border-border p-6 shadow-sm mb-8">
                    <h2 className="text-xl font-bold mb-4 text-foreground">📅 Daily Usage by Provider</h2>
                    <div className="h-64 flex items-end gap-2">
                      {analytics.usage_by_day.slice(-14).map((day, idx) => {
                        const maxRequests = Math.max(...analytics.usage_by_day.map(d => d.kie_requests + d.anthropic_requests));
                        const totalRequests = day.kie_requests + day.anthropic_requests;
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full flex flex-col" style={{ height: `${Math.max((totalRequests / maxRequests) * 200, 4)}px` }}>
                              <div
                                className="w-full bg-primary rounded-t"
                                style={{ height: `${totalRequests > 0 ? (day.kie_requests / totalRequests) * 100 : 50}%` }}
                                title={`Kie.ai: ${day.kie_requests} requests`}
                              ></div>
                              <div
                                className="w-full bg-accent rounded-b"
                                style={{ height: `${totalRequests > 0 ? (day.anthropic_requests / totalRequests) * 100 : 50}%` }}
                                title={`Anthropic: ${day.anthropic_requests} requests`}
                              ></div>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-center gap-6 mt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-primary rounded"></div>
                        <span className="text-sm text-foreground">Kie.ai</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-accent rounded"></div>
                        <span className="text-sm text-foreground">Anthropic</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Usage by Model & Feature */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                  {analytics && (
                    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
                      <h2 className="text-xl font-bold mb-4 text-foreground">🧠 Usage by Model</h2>
                      <div className="space-y-3">
                        {Object.entries(analytics.usage_by_model)
                          .sort(([, a], [, b]) => b.requests - a.requests)
                          .map(([model, data]) => (
                            <div key={model} className="flex items-center gap-4">
                              <div className="w-32 text-sm font-medium truncate text-foreground">{model}</div>
                              <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-primary to-primary"
                                  style={{ width: `${data.percentage}%` }}
                                ></div>
                              </div>
                              <div className="w-16 text-right text-sm">
                                <div className="font-medium text-foreground">{data.requests}</div>
                                <div className="text-xs text-muted-foreground">{data.percentage}%</div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {analytics && (
                    <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
                      <h2 className="text-xl font-bold mb-4 text-foreground">⚡ Usage by Feature</h2>
                      <div className="space-y-3">
                        {Object.entries(analytics.usage_by_feature)
                          .sort(([, a], [, b]) => b.requests - a.requests)
                          .map(([feature, data]) => (
                            <div key={feature} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div>
                                <div className="font-medium capitalize text-foreground">{feature.replace('_', ' ')}</div>
                                <div className="text-xs text-muted-foreground">{data.requests} requests</div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-foreground">{formatCurrency(data.cost)}</div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Peak Usage */}
                {analytics && (
                  <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
                    <h2 className="text-xl font-bold mb-4 text-foreground">🔥 Peak Usage</h2>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="text-center p-4 bg-warning/10 rounded-lg">
                        <div className="text-4xl mb-2">⏰</div>
                        <div className="text-2xl font-bold text-foreground">{analytics.peak_usage.hour}:00</div>
                        <div className="text-sm text-muted-foreground">Peak Hour</div>
                        <div className="text-xs text-muted-foreground">{analytics.peak_usage.requests} requests</div>
                      </div>
                      <div className="text-center p-4 bg-primary/10 rounded-lg">
                        <div className="text-4xl mb-2">📆</div>
                        <div className="text-2xl font-bold text-foreground">{analytics.peak_usage.day_of_week}</div>
                        <div className="text-sm text-muted-foreground">Busiest Day</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Costs Tab */}
            {activeTab === 'costs' && (
              <>
                {/* Budget Overview */}
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
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
                {analytics && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                    <div className="rounded-xl border border-border bg-card p-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <DollarSign className="h-4 w-4" />
                        Total Cost
                      </div>
                      <div className="text-3xl font-bold text-primary">{formatCurrency(analytics.savings.actual_cost)}</div>
                      <div className="text-xs text-muted-foreground mt-1">{analytics.total_requests} requests</div>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Zap className="h-4 w-4" />
                        Avg Cost/Request
                      </div>
                      <div className="text-3xl font-bold text-accent">
                        {formatCurrency(analytics.total_requests > 0 ? analytics.savings.actual_cost / analytics.total_requests : 0)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <FileInput className="h-4 w-4" />
                        Input Tokens
                      </div>
                      <div className="text-3xl font-bold text-success">{formatNumber(analytics.total_tokens * 0.4)}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <FileOutput className="h-4 w-4" />
                        Output Tokens
                      </div>
                      <div className="text-3xl font-bold text-warning">{formatNumber(analytics.total_tokens * 0.6)}</div>
                    </div>
                  </div>
                )}

                {/* Cost by Provider & Model */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                  {analytics && (
                    <div className="rounded-xl border border-border bg-card p-6">
                      <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        Cost by Provider
                      </h2>
                      <div className="space-y-4">
                        {Object.entries(analytics.requests_by_provider).map(([provider, data]) => (
                          <div key={provider} className="p-4 bg-muted/50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center ${provider === 'kie' ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent'}`}>
                                  {provider === 'kie' ? 'K' : 'A'}
                                </span>
                                <span className="font-medium text-foreground capitalize">{provider === 'kie' ? 'Kie.ai' : 'Anthropic'}</span>
                              </div>
                              <div className="text-lg font-bold text-foreground">{formatCurrency(data.cost)}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                              <div>{data.requests} requests</div>
                              <div>{formatNumber(data.tokens)} tokens</div>
                              <div>{data.avg_latency_ms}ms avg</div>
                            </div>
                            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${provider === 'kie' ? 'bg-primary' : 'bg-accent'}`}
                                style={{ width: `${(data.cost / analytics.savings.actual_cost) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Model Pricing Reference */}
                  <div className="rounded-xl border border-border bg-card p-6">
                    <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />
                      Model Pricing
                    </h2>
                    <div className="space-y-3">
                      {pricing.map((model) => (
                        <div key={model.model} className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${model.provider === 'kie' ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent'}`}>
                              {model.provider === 'kie' ? 'K' : 'A'}
                            </span>
                            <span className="font-medium text-foreground">{model.model}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Input</span>
                              <span className="text-foreground">${model.input_cost_per_million.toFixed(2)}/M</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Output</span>
                              <span className="text-foreground">${model.output_cost_per_million.toFixed(2)}/M</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Comparison Tab */}
            {activeTab === 'comparison' && comparison && (
              <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
                <h2 className="text-xl font-bold mb-6 text-foreground">🔄 Provider Comparison: Kie.ai vs Anthropic</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Kie.ai */}
                  <div className="p-6 bg-primary/10 rounded-xl">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">🤖</span>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">Kie.ai</h3>
                        <p className="text-sm text-muted-foreground">Primary Provider</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Requests</div>
                        <div className="text-xl font-bold text-foreground">{comparison.comparison.kie.total_requests}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Total Cost</div>
                        <div className="text-xl font-bold text-success">{formatCurrency(comparison.comparison.kie.total_cost)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Avg Cost/Req</div>
                        <div className="text-lg font-medium text-foreground">{formatCurrency(comparison.comparison.kie.avg_cost_per_request)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Avg Latency</div>
                        <div className="text-lg font-medium text-foreground">{comparison.comparison.kie.avg_latency_ms}ms</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Cost/1K Tokens</div>
                        <div className="text-lg font-medium text-foreground">{formatCurrency(comparison.comparison.kie.cost_per_1k_tokens)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Total Tokens</div>
                        <div className="text-lg font-medium text-foreground">{formatNumber(comparison.comparison.kie.total_tokens)}</div>
                      </div>
                    </div>
                  </div>
                  {/* Anthropic */}
                  <div className="p-6 bg-accent/10 rounded-xl">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">🔵</span>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">Anthropic</h3>
                        <p className="text-sm text-muted-foreground">Fallback Provider</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Requests</div>
                        <div className="text-xl font-bold text-foreground">{comparison.comparison.anthropic.total_requests}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Total Cost</div>
                        <div className="text-xl font-bold text-accent">{formatCurrency(comparison.comparison.anthropic.total_cost)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Avg Cost/Req</div>
                        <div className="text-lg font-medium text-foreground">{formatCurrency(comparison.comparison.anthropic.avg_cost_per_request)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Avg Latency</div>
                        <div className="text-lg font-medium text-foreground">{comparison.comparison.anthropic.avg_latency_ms}ms</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Cost/1K Tokens</div>
                        <div className="text-lg font-medium text-foreground">{formatCurrency(comparison.comparison.anthropic.cost_per_1k_tokens)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Total Tokens</div>
                        <div className="text-lg font-medium text-foreground">{formatNumber(comparison.comparison.anthropic.total_tokens)}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl">💡</span>
                    <span className="font-medium text-foreground">{comparison.recommendation}</span>
                    <span className="ml-auto text-success font-bold">
                      {comparison.cost_difference_percent}% cost difference
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

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
