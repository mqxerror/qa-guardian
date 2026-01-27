// ============================================================================
// FEATURE #1326: AI Usage Analytics Dashboard
// Extracted from App.tsx for code quality compliance (Feature #1357)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Types
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

export function AIUsageAnalyticsDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // State
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
  const [comparison, setComparison] = useState<ProviderComparison | null>(null);
  const [trends, setTrends] = useState<UsageTrends | null>(null);
  const [exports, setExports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'quarter'>('month');
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'csv' | 'pdf' | 'json'>('csv');

  // Fetch all data
  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [analyticsRes, comparisonRes, trendsRes, exportsRes] = await Promise.all([
        fetch(`http://localhost:3000/api/v1/ai/analytics?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:3000/api/v1/ai/analytics/comparison?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:3000/api/v1/ai/analytics/trends?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('http://localhost:3000/api/v1/ai/analytics/exports', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (comparisonRes.ok) setComparison(await comparisonRes.json());
      if (trendsRes.ok) setTrends(await trendsRes.json());
      if (exportsRes.ok) {
        const data = await exportsRes.json();
        setExports(data.reports || []);
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
      const response = await fetch('http://localhost:3000/api/v1/ai/analytics/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: exportType, period }),
      });
      if (response.ok) {
        const data = await response.json();
        setExports([data.report, ...exports]);
      }
    } catch (error) {
      console.error('Failed to export:', error);
    }
    setIsExporting(false);
  };

  // Format helpers
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
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
    // For costs, down is good, up is bad
    if (metric === 'cost') {
      if (trend === 'up') return 'text-red-600';
      if (trend === 'down') return 'text-green-600';
    }
    // For others, up is good
    if (trend === 'up') return 'text-green-600';
    if (trend === 'down') return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/ai-insights')}
          className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1"
        >
          ← Back to AI Insights
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">📊 AI Usage Analytics</h1>
            <p className="text-gray-600 mt-2">
              Comprehensive analytics and savings comparison by provider
            </p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="day">Last 24 Hours</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="quarter">Last 90 Days</option>
            </select>
            <div className="flex items-center gap-2">
              <select
                value={exportType}
                onChange={(e) => setExportType(e.target.value as any)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="csv">CSV</option>
                <option value="pdf">PDF</option>
                <option value="json">JSON</option>
              </select>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isExporting ? '⏳ Exporting...' : '📥 Export'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Savings Banner */}
      {analytics && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between">
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

      {/* Trends */}
      {trends && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500">Cost Trend</span>
              <span className="text-xl">{getTrendIcon(trends.trends.cost.trend)}</span>
            </div>
            <div className="text-3xl font-bold">{formatCurrency(trends.trends.cost.current)}</div>
            <div className={`text-sm ${getTrendColor(trends.trends.cost.trend, 'cost')}`}>
              {trends.trends.cost.change_percent > 0 ? '+' : ''}{trends.trends.cost.change_percent}% vs previous
            </div>
          </div>
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500">Requests Trend</span>
              <span className="text-xl">{getTrendIcon(trends.trends.requests.trend)}</span>
            </div>
            <div className="text-3xl font-bold">{formatNumber(trends.trends.requests.current)}</div>
            <div className={`text-sm ${getTrendColor(trends.trends.requests.trend, 'requests')}`}>
              {trends.trends.requests.change_percent > 0 ? '+' : ''}{trends.trends.requests.change_percent}% vs previous
            </div>
          </div>
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500">Tokens Trend</span>
              <span className="text-xl">{getTrendIcon(trends.trends.tokens.trend)}</span>
            </div>
            <div className="text-3xl font-bold">{formatNumber(trends.trends.tokens.current)}</div>
            <div className={`text-sm ${getTrendColor(trends.trends.tokens.trend, 'tokens')}`}>
              {trends.trends.tokens.change_percent > 0 ? '+' : ''}{trends.trends.tokens.change_percent}% vs previous
            </div>
          </div>
        </div>
      )}

      {/* Provider Comparison */}
      {comparison && (
        <div className="bg-white rounded-xl border p-6 shadow-sm mb-8">
          <h2 className="text-xl font-bold mb-6">🔄 Provider Comparison: Kie.ai vs Anthropic</h2>
          <div className="grid grid-cols-2 gap-8">
            {/* Kie.ai */}
            <div className="p-6 bg-blue-50 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🤖</span>
                <div>
                  <h3 className="text-xl font-bold">Kie.ai</h3>
                  <p className="text-sm text-gray-500">Primary Provider</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Requests</div>
                  <div className="text-xl font-bold">{comparison.comparison.kie.total_requests}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Total Cost</div>
                  <div className="text-xl font-bold text-green-600">{formatCurrency(comparison.comparison.kie.total_cost)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Avg Cost/Req</div>
                  <div className="text-lg font-medium">{formatCurrency(comparison.comparison.kie.avg_cost_per_request)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Avg Latency</div>
                  <div className="text-lg font-medium">{comparison.comparison.kie.avg_latency_ms}ms</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Cost/1K Tokens</div>
                  <div className="text-lg font-medium">{formatCurrency(comparison.comparison.kie.cost_per_1k_tokens)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Total Tokens</div>
                  <div className="text-lg font-medium">{formatNumber(comparison.comparison.kie.total_tokens)}</div>
                </div>
              </div>
            </div>
            {/* Anthropic */}
            <div className="p-6 bg-purple-50 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🔵</span>
                <div>
                  <h3 className="text-xl font-bold">Anthropic</h3>
                  <p className="text-sm text-gray-500">Fallback Provider</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Requests</div>
                  <div className="text-xl font-bold">{comparison.comparison.anthropic.total_requests}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Total Cost</div>
                  <div className="text-xl font-bold text-purple-600">{formatCurrency(comparison.comparison.anthropic.total_cost)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Avg Cost/Req</div>
                  <div className="text-lg font-medium">{formatCurrency(comparison.comparison.anthropic.avg_cost_per_request)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Avg Latency</div>
                  <div className="text-lg font-medium">{comparison.comparison.anthropic.avg_latency_ms}ms</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Cost/1K Tokens</div>
                  <div className="text-lg font-medium">{formatCurrency(comparison.comparison.anthropic.cost_per_1k_tokens)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Total Tokens</div>
                  <div className="text-lg font-medium">{formatNumber(comparison.comparison.anthropic.total_tokens)}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-xl">💡</span>
              <span className="font-medium">{comparison.recommendation}</span>
              <span className="ml-auto text-green-600 font-bold">
                {comparison.cost_difference_percent}% cost difference
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Usage by Day Chart */}
      {analytics && analytics.usage_by_day.length > 0 && (
        <div className="bg-white rounded-xl border p-6 shadow-sm mb-8">
          <h2 className="text-xl font-bold mb-4">📅 Daily Usage by Provider</h2>
          <div className="h-64 flex items-end gap-2">
            {analytics.usage_by_day.slice(-14).map((day, idx) => {
              const maxRequests = Math.max(...analytics.usage_by_day.map(d => d.kie_requests + d.anthropic_requests));
              const totalRequests = day.kie_requests + day.anthropic_requests;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col" style={{ height: `${Math.max((totalRequests / maxRequests) * 200, 4)}px` }}>
                    <div
                      className="w-full bg-blue-500 rounded-t"
                      style={{ height: `${(day.kie_requests / totalRequests) * 100}%` }}
                      title={`Kie.ai: ${day.kie_requests} requests`}
                    ></div>
                    <div
                      className="w-full bg-purple-500 rounded-b"
                      style={{ height: `${(day.anthropic_requests / totalRequests) * 100}%` }}
                      title={`Anthropic: ${day.anthropic_requests} requests`}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-sm">Kie.ai</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded"></div>
              <span className="text-sm">Anthropic</span>
            </div>
          </div>
        </div>
      )}

      {/* Usage by Model & Feature */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* By Model */}
        {analytics && (
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4">🧠 Usage by Model</h2>
            <div className="space-y-3">
              {Object.entries(analytics.usage_by_model)
                .sort(([, a], [, b]) => b.requests - a.requests)
                .map(([model, data]) => (
                  <div key={model} className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium truncate">{model}</div>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                        style={{ width: `${data.percentage}%` }}
                      ></div>
                    </div>
                    <div className="w-16 text-right text-sm">
                      <div className="font-medium">{data.requests}</div>
                      <div className="text-xs text-gray-500">{data.percentage}%</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* By Feature */}
        {analytics && (
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4">⚡ Usage by Feature</h2>
            <div className="space-y-3">
              {Object.entries(analytics.usage_by_feature)
                .sort(([, a], [, b]) => b.requests - a.requests)
                .map(([feature, data]) => (
                  <div key={feature} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium capitalize">{feature.replace('_', ' ')}</div>
                      <div className="text-xs text-gray-500">{data.requests} requests</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatCurrency(data.cost)}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Peak Usage & Recent Exports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Peak Usage */}
        {analytics && (
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4">🔥 Peak Usage</h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-4xl mb-2">⏰</div>
                <div className="text-2xl font-bold">{analytics.peak_usage.hour}:00</div>
                <div className="text-sm text-gray-500">Peak Hour</div>
                <div className="text-xs text-gray-400">{analytics.peak_usage.requests} requests</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-4xl mb-2">📆</div>
                <div className="text-2xl font-bold">{analytics.peak_usage.day_of_week}</div>
                <div className="text-sm text-gray-500">Busiest Day</div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Exports */}
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4">📁 Recent Exports</h2>
          {exports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📄</div>
              <div>No exports yet</div>
            </div>
          ) : (
            <div className="space-y-3">
              {exports.slice(0, 5).map((report) => (
                <div key={report.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">
                      {report.type === 'csv' ? '📊' : report.type === 'pdf' ? '📕' : '📋'}
                    </span>
                    <div>
                      <div className="font-medium">{report.type.toUpperCase()} Report</div>
                      <div className="text-xs text-gray-500">
                        {new Date(report.generated_at).toLocaleString()} • {Math.round(report.size_bytes / 1024)}KB
                      </div>
                    </div>
                  </div>
                  <button className="text-blue-600 hover:text-blue-800 text-sm">
                    Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
