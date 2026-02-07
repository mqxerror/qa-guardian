// AIBudgetDashboard - Extracted from AIRouterPage.tsx for Feature #328
// AI Budget tracking with spending visualization and alerts

import { useState } from 'react';
import type {
  AIBudgetConfig,
  AISpendingData,
  BudgetAlert,
  AIFeatureType
} from './ai-types';

interface AIBudgetDashboardProps {
  budgetConfig: AIBudgetConfig;
  spendingData: AISpendingData;
  budgetAlerts: BudgetAlert[];
  onConfigChange: (config: AIBudgetConfig) => void;
  onResetBudget: () => void;
  onAcknowledgeAlert: (alertId: string) => void;
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function getFeatureIcon(feature: AIFeatureType): string {
  const icons: Record<AIFeatureType, string> = {
    chat: '💬',
    completion: '✍️',
    embedding: '🔢',
    analysis: '🔬',
    code_review: '📝',
    test_generation: '🧪'
  };
  return icons[feature] || '🤖';
}

export function AIBudgetDashboard({
  budgetConfig,
  spendingData,
  budgetAlerts,
  onConfigChange,
  onResetBudget,
  onAcknowledgeAlert
}: AIBudgetDashboardProps) {
  const [showBudgetResetModal, setShowBudgetResetModal] = useState(false);

  const getBudgetPercentage = () => {
    return (spendingData.current_month_spend_cents / budgetConfig.monthly_budget_cents) * 100;
  };

  const getBudgetStatus = () => {
    const percentage = getBudgetPercentage();
    if (percentage >= budgetConfig.hard_limit_percentage) return 'blocked';
    if (percentage >= budgetConfig.soft_limit_percentage) return 'critical';
    if (percentage >= budgetConfig.soft_limit_percentage * 0.9) return 'warning';
    return 'healthy';
  };

  const getDaysUntilReset = () => {
    const today = new Date();
    const currentDay = today.getDate();
    const billingDay = budgetConfig.billing_cycle_day;

    if (currentDay < billingDay) {
      return billingDay - currentDay;
    }

    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, billingDay);
    const diffTime = nextMonth.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getProjectedSpend = () => {
    const daysElapsed = new Date().getDate();
    const daysInMonth = 30;
    const dailyRate = spendingData.current_month_spend_cents / daysElapsed;
    return dailyRate * daysInMonth;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            💰 Monthly AI Budget
            {getBudgetStatus() === 'blocked' && (
              <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">BLOCKED</span>
            )}
            {getBudgetStatus() === 'critical' && (
              <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">Soft Limit</span>
            )}
          </h2>
          <p className="text-sm text-gray-500">Track and control AI spending with soft and hard limits</p>
        </div>
        <button
          onClick={() => setShowBudgetResetModal(true)}
          className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
        >
          🔄 Reset Budget
        </button>
      </div>

      {/* Budget Overview */}
      <div className={`mb-6 p-4 rounded-lg border-2 ${
        getBudgetStatus() === 'blocked' ? 'bg-red-50 border-red-300' :
        getBudgetStatus() === 'critical' ? 'bg-amber-50 border-amber-300' :
        getBudgetStatus() === 'warning' ? 'bg-yellow-50 border-yellow-300' :
        'bg-green-50 border-green-300'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-3xl font-bold">
              {formatCurrency(spendingData.current_month_spend_cents)}
              <span className="text-lg font-normal text-gray-500"> / {formatCurrency(budgetConfig.monthly_budget_cents)}</span>
            </div>
            <div className="text-sm text-gray-600">
              {getBudgetPercentage().toFixed(1)}% of monthly budget used
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Resets in</div>
            <div className="text-2xl font-bold">{getDaysUntilReset()} days</div>
            <div className="text-xs text-gray-400">on day {budgetConfig.billing_cycle_day}</div>
          </div>
        </div>

        {/* Progress bar with limits */}
        <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              getBudgetStatus() === 'blocked' ? 'bg-red-500' :
              getBudgetStatus() === 'critical' ? 'bg-amber-500' :
              getBudgetStatus() === 'warning' ? 'bg-yellow-500' :
              'bg-green-500'
            }`}
            style={{ width: `${Math.min(getBudgetPercentage(), 100)}%` }}
          />
          {/* Soft limit marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-600"
            style={{ left: `${budgetConfig.soft_limit_percentage}%` }}
            title={`Soft limit: ${budgetConfig.soft_limit_percentage}%`}
          />
          {/* Hard limit marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-600"
            style={{ left: `${Math.min(budgetConfig.hard_limit_percentage, 100)}%` }}
            title={`Hard limit: ${budgetConfig.hard_limit_percentage}%`}
          />
          {/* Labels */}
          <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-medium">
            <span className={getBudgetPercentage() > 50 ? 'text-white' : 'text-gray-700'}>
              {formatCurrency(spendingData.current_month_spend_cents)}
            </span>
            <span className="text-gray-600">
              {formatCurrency(budgetConfig.monthly_budget_cents)}
            </span>
          </div>
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>0%</span>
          <span className="text-amber-600">{budgetConfig.soft_limit_percentage}% soft</span>
          <span className="text-red-600">{budgetConfig.hard_limit_percentage}% hard</span>
        </div>

        {/* Projected spend warning */}
        {getProjectedSpend() > budgetConfig.monthly_budget_cents && (
          <div className="mt-3 p-2 bg-amber-100 border border-amber-300 rounded text-sm text-amber-800">
            ⚠️ At current rate, projected month-end spend: <strong>{formatCurrency(getProjectedSpend())}</strong>
            (over budget by {formatCurrency(getProjectedSpend() - budgetConfig.monthly_budget_cents)})
          </div>
        )}
      </div>

      {/* Budget Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Left: Budget Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">⚙️ Budget Configuration</h3>

          <div className="p-3 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Budget</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <input
                type="number"
                min="100"
                max="100000"
                step="100"
                value={budgetConfig.monthly_budget_cents / 100}
                onChange={(e) => onConfigChange({ ...budgetConfig, monthly_budget_cents: parseFloat(e.target.value) * 100 || 50000 })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="p-3 bg-amber-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-amber-800">Soft Limit: {budgetConfig.soft_limit_percentage}%</label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={budgetConfig.alert_on_soft_limit}
                  onChange={(e) => onConfigChange({ ...budgetConfig, alert_on_soft_limit: e.target.checked })}
                  className="w-4 h-4 text-amber-600 rounded"
                />
                <span>Alert</span>
              </label>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              value={budgetConfig.soft_limit_percentage}
              onChange={(e) => onConfigChange({ ...budgetConfig, soft_limit_percentage: parseInt(e.target.value) })}
              className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-xs text-amber-600 mt-1">Warn at {formatCurrency(budgetConfig.monthly_budget_cents * budgetConfig.soft_limit_percentage / 100)}</div>
          </div>

          <div className="p-3 bg-red-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-red-800">Hard Limit: {budgetConfig.hard_limit_percentage}%</label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={budgetConfig.block_on_hard_limit}
                  onChange={(e) => onConfigChange({ ...budgetConfig, block_on_hard_limit: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded"
                />
                <span>Block</span>
              </label>
            </div>
            <input
              type="range"
              min={budgetConfig.soft_limit_percentage + 5}
              max="150"
              value={budgetConfig.hard_limit_percentage}
              onChange={(e) => onConfigChange({ ...budgetConfig, hard_limit_percentage: parseInt(e.target.value) })}
              className="w-full h-2 bg-red-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-xs text-red-600 mt-1">Block at {formatCurrency(budgetConfig.monthly_budget_cents * budgetConfig.hard_limit_percentage / 100)}</div>
          </div>
        </div>

        {/* Right: Spending Stats */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">📊 Spending Breakdown</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-xl font-bold text-blue-600">{spendingData.requests_this_month.toLocaleString()}</div>
              <div className="text-xs text-blue-800">Requests</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-xl font-bold text-green-600">{formatCurrency(spendingData.avg_cost_per_request_cents)}</div>
              <div className="text-xs text-green-800">Avg Cost/Req</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-xl font-bold text-purple-600">{formatCurrency(spendingData.last_month_spend_cents)}</div>
              <div className="text-xs text-purple-800">Last Month</div>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <div className="text-xl font-bold text-amber-600">{formatCurrency(getProjectedSpend())}</div>
              <div className="text-xs text-amber-800">Projected</div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-2">By Provider</h4>
            {Object.entries(spendingData.by_provider).map(([provider, cents]) => (
              <div key={provider} className="flex items-center gap-2 mb-2">
                <span className="w-16 text-sm font-medium capitalize">{provider}</span>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${provider === 'kie' ? 'bg-gradient-to-r from-teal-400 to-teal-500' : 'bg-gradient-to-r from-blue-400 to-blue-500'}`}
                    style={{ width: `${spendingData.current_month_spend_cents > 0 ? (cents / spendingData.current_month_spend_cents) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600 w-16 text-right">{formatCurrency(cents)}</span>
              </div>
            ))}
          </div>

          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-2">By Feature</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {Object.entries(spendingData.by_feature)
                .sort(([, a], [, b]) => b - a)
                .map(([feature, cents]) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    <span className="w-6">{getFeatureIcon(feature as AIFeatureType)}</span>
                    <span className="flex-1 truncate capitalize">{feature.replace('_', ' ')}</span>
                    <span className="text-gray-600">{formatCurrency(cents)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Budget Alerts */}
      {budgetAlerts.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <h3 className="text-sm font-medium mb-3">🔔 Budget Alerts</h3>
          <div className="space-y-2">
            {budgetAlerts.filter(a => !a.acknowledged).slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  alert.type === 'hard_limit' ? 'bg-red-50 border border-red-200' :
                  alert.type === 'soft_limit' ? 'bg-amber-50 border border-amber-200' :
                  'bg-yellow-50 border border-yellow-200'
                }`}
              >
                <div>
                  <div className="text-sm font-medium">{alert.message}</div>
                  <div className="text-xs text-gray-500">{new Date(alert.timestamp).toLocaleString()}</div>
                </div>
                <button
                  onClick={() => onAcknowledgeAlert(alert.id)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reset Budget Modal */}
      {showBudgetResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">🔄 Reset Monthly Budget</h3>
            <p className="text-gray-600 mb-4">
              This will reset the current month's spending counter to $0.00. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBudgetResetModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onResetBudget();
                  setShowBudgetResetModal(false);
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Reset Budget
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AIBudgetDashboard;
