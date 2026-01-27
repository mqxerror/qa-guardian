// ============================================================================
// FEATURE #1325: AI Cost Tracking Per Request
// Extracted from App.tsx for code quality compliance (Feature #1357)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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
  const token = localStorage.getItem('token');

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
      const [summaryRes, budgetRes, recordsRes, pricingRes, usersRes, projectsRes] = await Promise.all([
        fetch(`http://localhost:3000/api/v1/ai/costs/summary?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('http://localhost:3000/api/v1/ai/costs/budget', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('http://localhost:3000/api/v1/ai/costs?limit=20', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('http://localhost:3000/api/v1/ai/costs/pricing', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:3000/api/v1/ai/costs/by-user?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:3000/api/v1/ai/costs/by-project?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (budgetRes.ok) setBudget(await budgetRes.json());
      if (recordsRes.ok) {
        const data = await recordsRes.json();
        setRecords(data.records || []);
      }
      if (pricingRes.ok) {
        const data = await pricingRes.json();
        setPricing(data.models || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setCostsByUser(data.users || []);
      }
      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setCostsByProject(data.projects || []);
      }
    } catch (error) {
      console.error('Failed to fetch cost data:', error);
    }
    setIsLoading(false);
  };

  // Update budget
  const updateBudget = async () => {
    setIsSavingBudget(true);
    try {
      const response = await fetch('http://localhost:3000/api/v1/ai/costs/budget', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ monthly_budget: newBudget }),
      });
      if (response.ok) {
        const data = await response.json();
        setBudget(data.budget);
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

  // Get budget status color
  const getBudgetStatusColor = () => {
    if (!budget) return 'bg-gray-200';
    if (budget.percentage_used >= budget.critical_threshold_percent) return 'bg-red-500';
    if (budget.percentage_used >= budget.warning_threshold_percent) return 'bg-yellow-500';
    return 'bg-green-500';
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
            <h1 className="text-3xl font-bold">💰 AI Cost Tracking</h1>
            <p className="text-gray-600 mt-2">
              Track AI costs per request by provider and model with token counts
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
            </select>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Budget Overview Banner */}
      {budget && (
        <div className="bg-white rounded-xl border p-6 mb-8 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">📊 Monthly Budget</h2>
            <button
              onClick={() => {
                setNewBudget(budget.monthly_budget);
                setShowBudgetModal(true);
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Edit Budget
            </button>
          </div>
          <div className="grid grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-gray-500">Budget</div>
              <div className="text-2xl font-bold">{formatCurrency(budget.monthly_budget)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Spent This Month</div>
              <div className="text-2xl font-bold">{formatCurrency(budget.current_month_spend)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Remaining</div>
              <div className={`text-2xl font-bold ${budget.budget_remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(budget.budget_remaining)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Projected End of Month</div>
              <div className={`text-2xl font-bold ${budget.projected_month_end > budget.monthly_budget ? 'text-red-600' : ''}`}>
                {formatCurrency(budget.projected_month_end)}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span>{Math.round(budget.percentage_used)}% used</span>
              <span>{formatCurrency(budget.monthly_budget)}</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${getBudgetStatusColor()}`}
                style={{ width: `${Math.min(budget.percentage_used, 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Warning: {budget.warning_threshold_percent}%</span>
              <span>Critical: {budget.critical_threshold_percent}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <div className="text-sm text-gray-500">Total Cost</div>
            <div className="text-3xl font-bold text-blue-600">{formatCurrency(summary.total_cost)}</div>
            <div className="text-xs text-gray-400 mt-1">{summary.total_requests} requests</div>
          </div>
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <div className="text-sm text-gray-500">Avg Cost/Request</div>
            <div className="text-3xl font-bold text-purple-600">{formatCurrency(summary.avg_cost_per_request)}</div>
          </div>
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <div className="text-sm text-gray-500">Input Tokens</div>
            <div className="text-3xl font-bold text-green-600">{formatNumber(summary.total_input_tokens)}</div>
          </div>
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <div className="text-sm text-gray-500">Output Tokens</div>
            <div className="text-3xl font-bold text-orange-600">{formatNumber(summary.total_output_tokens)}</div>
          </div>
        </div>
      )}

      {/* Cost by Provider & Model */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* By Provider */}
        {summary && (
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4">🏢 Cost by Provider</h2>
            <div className="space-y-4">
              {Object.entries(summary.by_provider).map(([provider, data]) => (
                <div key={provider} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{provider === 'kie' ? '🤖' : '🔵'}</span>
                      <span className="font-medium capitalize">{provider === 'kie' ? 'Kie.ai' : 'Anthropic'}</span>
                    </div>
                    <div className="text-lg font-bold">{formatCurrency(data.cost)}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm text-gray-500">
                    <div>{data.requests} requests</div>
                    <div>{formatNumber(data.input_tokens)} in</div>
                    <div>{formatNumber(data.output_tokens)} out</div>
                  </div>
                  <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${provider === 'kie' ? 'bg-blue-500' : 'bg-purple-500'}`}
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
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4">🧠 Cost by Model</h2>
            <div className="space-y-3">
              {Object.entries(summary.by_model)
                .sort(([, a], [, b]) => b.cost - a.cost)
                .map(([model, data]) => (
                  <div key={model} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{model}</div>
                      <div className="text-xs text-gray-500">
                        {data.requests} requests • {data.avg_latency_ms}ms avg
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatCurrency(data.cost)}</div>
                      <div className="text-xs text-gray-500">
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
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4">📋 Cost by Request Type</h2>
            <div className="space-y-3">
              {Object.entries(summary.by_request_type)
                .sort(([, a], [, b]) => b.cost - a.cost)
                .map(([type, data]) => (
                  <div key={type} className="flex items-center gap-4">
                    <div className="w-32 text-sm text-gray-600 capitalize">{type.replace('_', ' ')}</div>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                        style={{ width: `${(data.cost / summary.total_cost) * 100}%` }}
                      ></div>
                    </div>
                    <div className="w-24 text-right">
                      <div className="font-medium">{formatCurrency(data.cost)}</div>
                      <div className="text-xs text-gray-500">{data.requests} reqs</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Trend */}
        {summary && summary.trend.length > 0 && (
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4">📈 Daily Cost Trend</h2>
            <div className="h-48 flex items-end gap-1">
              {summary.trend.slice(-14).map((day, idx) => {
                const maxCost = Math.max(...summary.trend.map(d => d.cost));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all hover:opacity-80"
                      style={{ height: `${(day.cost / maxCost) * 150}px` }}
                      title={`${day.date}: ${formatCurrency(day.cost)}`}
                    ></div>
                    <div className="text-xs text-gray-400 mt-1 rotate-45 origin-left whitespace-nowrap">
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
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4">👤 Top Users by Cost</h2>
          {costsByUser.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No user data available</div>
          ) : (
            <div className="space-y-3">
              {costsByUser.slice(0, 5).map((user, idx) => (
                <div key={user.user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-400' : 'bg-gray-300'
                    }`}>
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-medium">{user.user_id}</div>
                      <div className="text-xs text-gray-500">{user.requests} requests • {formatNumber(user.tokens)} tokens</div>
                    </div>
                  </div>
                  <div className="font-bold">{formatCurrency(user.cost)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Project */}
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4">📁 Top Projects by Cost</h2>
          {costsByProject.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No project data available</div>
          ) : (
            <div className="space-y-3">
              {costsByProject.slice(0, 5).map((project, idx) => (
                <div key={project.project_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      idx === 0 ? 'bg-blue-500' : idx === 1 ? 'bg-blue-400' : idx === 2 ? 'bg-blue-300' : 'bg-gray-300'
                    }`}>
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-medium">{project.project_id}</div>
                      <div className="text-xs text-gray-500">{project.requests} requests • {formatNumber(project.tokens)} tokens</div>
                    </div>
                  </div>
                  <div className="font-bold">{formatCurrency(project.cost)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Records */}
      <div className="bg-white rounded-xl border p-6 shadow-sm mb-8">
        <h2 className="text-xl font-bold mb-4">📜 Recent Requests</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2">Time</th>
                <th className="text-left py-3 px-2">Provider</th>
                <th className="text-left py-3 px-2">Model</th>
                <th className="text-left py-3 px-2">Type</th>
                <th className="text-right py-3 px-2">Input</th>
                <th className="text-right py-3 px-2">Output</th>
                <th className="text-right py-3 px-2">Cost</th>
                <th className="text-right py-3 px-2">Latency</th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 10).map((record) => (
                <tr key={record.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-2 text-gray-500">
                    {new Date(record.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-3 px-2">
                    <span className="inline-flex items-center gap-1">
                      {record.provider === 'kie' ? '🤖' : '🔵'}
                      {record.provider === 'kie' ? 'Kie.ai' : 'Anthropic'}
                    </span>
                  </td>
                  <td className="py-3 px-2 font-mono text-xs">{record.model}</td>
                  <td className="py-3 px-2 capitalize">{record.request_type.replace('_', ' ')}</td>
                  <td className="py-3 px-2 text-right text-gray-500">{formatNumber(record.input_tokens)}</td>
                  <td className="py-3 px-2 text-right text-gray-500">{formatNumber(record.output_tokens)}</td>
                  <td className="py-3 px-2 text-right font-medium">{formatCurrency(record.total_cost)}</td>
                  <td className="py-3 px-2 text-right text-gray-500">{record.latency_ms}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model Pricing Reference */}
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4">💵 Model Pricing Reference</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pricing.map((model) => (
            <div key={model.model} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span>{model.provider === 'kie' ? '🤖' : '🔵'}</span>
                <span className="font-medium">{model.model}</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Input</span>
                  <span>${model.input_cost_per_million}/M tokens</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Output</span>
                  <span>${model.output_cost_per_million}/M tokens</span>
                </div>
                {model.thinking_cost_per_million && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Thinking</span>
                    <span>${model.thinking_cost_per_million}/M tokens</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-400 text-xs mt-2">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96">
            <h3 className="text-xl font-bold mb-4">Edit Monthly Budget</h3>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1">Monthly Budget ($)</label>
              <input
                type="number"
                value={newBudget}
                onChange={(e) => setNewBudget(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 border rounded-lg"
                min="0"
                step="100"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBudgetModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={updateBudget}
                disabled={isSavingBudget}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSavingBudget ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
