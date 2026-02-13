// ============================================================================
// FEATURE #412: AI Analytics Page - Merged from AIUsageAnalyticsDashboard + AICostTrackingPage
// Combines usage analytics, cost tracking, provider comparison, and budget management
// FEATURE #711: Migrated to React Query hooks
// ============================================================================

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { RefreshCw, DollarSign, Zap, FileInput, FileOutput, Building2, Brain, TrendingUp, Settings, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../components/ui';
import { Button } from '@/components/ui/button';
// Feature #691: Migrated budget modal to shared Modal component
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';
import { fetchWithAuth } from '../hooks/api/fetchWithAuth';
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';

// Feature #317: API base URL from environment
const API_BASE = import.meta.env.VITE_API_URL || '';

// Query keys for cache management
const analyticsKeys = {
  all: ['aiAnalytics'] as const,
  analytics: (period: string) => [...analyticsKeys.all, 'analytics', period] as const,
  comparison: (period: string) => [...analyticsKeys.all, 'comparison', period] as const,
  trends: (period: string) => [...analyticsKeys.all, 'trends', period] as const,
  budget: () => [...analyticsKeys.all, 'budget'] as const,
  models: () => [...analyticsKeys.all, 'models'] as const,
};

import type {
  UsageAnalytics,
  ProviderComparison,
  UsageTrends,
  CostBudget,
} from '@/types/ai';

// ============================================================================
// Component
// ============================================================================

export function AIAnalyticsPage() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  // UI State
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'quarter'>('month');
  const [activeTab, setActiveTab] = useState<'overview' | 'costs' | 'comparison'>('overview');
  const [exportType, setExportType] = useState<'csv' | 'pdf' | 'json'>('csv');
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [newBudget, setNewBudget] = useState(500);

  // React Query: Fetch analytics
  const { data: analytics, isLoading: isAnalyticsLoading, isError, error } = useQuery({
    queryKey: analyticsKeys.analytics(period),
    queryFn: () => fetchWithAuth(`${API_BASE}/api/v1/ai/analytics?period=${period}`, token) as Promise<UsageAnalytics>,
    enabled: !!token,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // React Query: Fetch comparison
  const { data: comparison, isLoading: isComparisonLoading } = useQuery({
    queryKey: analyticsKeys.comparison(period),
    queryFn: () => fetchWithAuth(`${API_BASE}/api/v1/ai/analytics/comparison?period=${period}`, token) as Promise<ProviderComparison>,
    enabled: !!token,
    staleTime: 2 * 60 * 1000,
  });

  // React Query: Fetch trends
  const { data: trends, isLoading: isTrendsLoading } = useQuery({
    queryKey: analyticsKeys.trends(period),
    queryFn: () => fetchWithAuth(`${API_BASE}/api/v1/ai/analytics/trends?period=${period}`, token) as Promise<UsageTrends>,
    enabled: !!token,
    staleTime: 2 * 60 * 1000,
  });

  // React Query: Fetch budget
  const { data: budgetData, isLoading: isBudgetLoading } = useQuery({
    queryKey: analyticsKeys.budget(),
    queryFn: () => fetchWithAuth(`${API_BASE}/api/v1/ai/cost-analytics/budget`, token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });

  // Transform budget data
  const budget: CostBudget | null = budgetData ? {
    org_id: 'org-001',
    monthly_budget: budgetData.monthlyLimitUsd || 500,
    warning_threshold_percent: 80,
    critical_threshold_percent: 95,
    auto_disable_on_limit: false,
    current_month_spend: budgetData.currentSpendUsd || 0,
    budget_remaining: budgetData.remainingUsd || 0,
    percentage_used: budgetData.percentUsed || 0,
    projected_month_end: budgetData.projectedMonthlySpend || 0,
  } : null;

  // React Query: Fetch models
  const { data: modelsData } = useQuery({
    queryKey: analyticsKeys.models(),
    queryFn: () => fetchWithAuth(`${API_BASE}/api/v1/ai/cost-analytics/models`, token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });

  // Transform pricing data
  const pricing = modelsData?.models
    ? Object.entries(modelsData.models).map(([model, data]: [string, any]) => ({
        model,
        provider: model.includes('claude') ? 'anthropic' : 'kie',
        input_cost_per_million: (data.costUsd || 0) / ((data.inputTokens || 1) / 1000000),
        output_cost_per_million: (data.costUsd || 0) / ((data.outputTokens || 1) / 1000000),
      }))
    : [];

  const isLoading = isAnalyticsLoading || isComparisonLoading || isTrendsLoading || isBudgetLoading;

  // React Query: Export mutation
  const exportMutation = useMutation({
    mutationFn: ({ type, period }: { type: string; period: string }) =>
      fetchWithAuth(`${API_BASE}/api/v1/ai/analytics/export`, token, {
        method: 'POST',
        body: JSON.stringify({ type, period }),
      }),
  });

  const handleExport = () => {
    exportMutation.mutate({ type: exportType, period });
  };

  const isExporting = exportMutation.isPending;

  // React Query: Update budget mutation
  const updateBudgetMutation = useMutation({
    mutationFn: (monthlyLimitUsd: number) =>
      fetchWithAuth(`${API_BASE}/api/v1/ai/cost-analytics/budget`, token, {
        method: 'PATCH',
        body: JSON.stringify({ monthlyLimitUsd }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: analyticsKeys.budget() });
      setShowBudgetModal(false);
    },
  });

  const updateBudget = () => {
    updateBudgetMutation.mutate(newBudget);
  };

  const isSavingBudget = updateBudgetMutation.isPending;

  // Refetch all analytics data
  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: analyticsKeys.analytics(period) });
    queryClient.invalidateQueries({ queryKey: analyticsKeys.comparison(period) });
    queryClient.invalidateQueries({ queryKey: analyticsKeys.trends(period) });
    queryClient.invalidateQueries({ queryKey: analyticsKeys.budget() });
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
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Feature #638: PageHeader component */}
        <PageHeader
          title="AI Analytics & Costs"
          description="Track AI usage, costs, and savings across providers"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'AI Analytics' }]}
          actions={
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
                <Button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="bg-success text-primary-foreground hover:bg-success/90"
                >
                  {isExporting ? 'Exporting...' : 'Export'}
                </Button>
              </div>
              <Button
                onClick={refetchAll}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          }
        />

        {/* Tab Navigation */}
        <div className="border-b border-border mb-6">
          <nav className="flex gap-1 -mb-px">
            {([
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'costs', label: 'Cost Tracking', icon: '💰' },
              { id: 'comparison', label: 'Provider Comparison', icon: '🔄' },
            ] as const).map(tab => (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap rounded-none h-auto ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </Button>
            ))}
          </nav>
        </div>

        {isError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" />
            <h3 className="text-lg font-semibold text-destructive">Failed to load AI analytics</h3>
            <p className="text-sm text-muted-foreground mt-1">{error instanceof Error ? error.message : 'An unexpected error occurred'}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !analytics ? (
          <EmptyState
            icon={EmptyStateIcons.analytics}
            title="No AI usage data"
            description="AI usage analytics will appear here once AI features are used."
          />
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setNewBudget(budget.monthly_budget);
                          setShowBudgetModal(true);
                        }}
                        className="text-primary hover:text-primary/80 flex items-center gap-1"
                      >
                        <Settings className="h-4 w-4" />
                        Edit Budget
                      </Button>
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

        {/* Budget Edit Modal - Feature #691: Using shared Modal component */}
        <Modal isOpen={showBudgetModal} onClose={() => setShowBudgetModal(false)} title="Edit Monthly Budget" size="sm">
          <ModalHeader onClose={() => setShowBudgetModal(false)}>Edit Monthly Budget</ModalHeader>
          <ModalBody>
            <div>
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
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => setShowBudgetModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={updateBudget}
              disabled={isSavingBudget}
            >
              {isSavingBudget ? 'Saving...' : 'Save'}
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </Layout>
  );
}
