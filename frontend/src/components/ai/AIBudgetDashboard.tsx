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
    <div className="bg-card rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            💰 Monthly AI Budget
            {getBudgetStatus() === 'blocked' && (
              <span className="text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full animate-pulse">BLOCKED</span>
            )}
            {getBudgetStatus() === 'critical' && (
              <span className="text-xs bg-warning text-warning-foreground px-2 py-0.5 rounded-full">Soft Limit</span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">Track and control AI spending with soft and hard limits</p>
        </div>
        <button
          onClick={() => setShowBudgetResetModal(true)}
          className="px-3 py-1 text-sm bg-muted text-foreground rounded hover:bg-secondary"
        >
          🔄 Reset Budget
        </button>
      </div>

      {/* Budget Overview */}
      <div className={`mb-6 p-4 rounded-lg border-2 ${
        getBudgetStatus() === 'blocked' ? 'bg-destructive/5 border-destructive/30' :
        getBudgetStatus() === 'critical' ? 'bg-warning/5 border-warning/30' :
        getBudgetStatus() === 'warning' ? 'bg-warning/5 border-warning/30' :
        'bg-success/5 border-success/30'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-3xl font-bold">
              {formatCurrency(spendingData.current_month_spend_cents)}
              <span className="text-lg font-normal text-muted-foreground"> / {formatCurrency(budgetConfig.monthly_budget_cents)}</span>
            </div>
            <div className="text-sm text-foreground">
              {getBudgetPercentage().toFixed(1)}% of monthly budget used
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Resets in</div>
            <div className="text-2xl font-bold">{getDaysUntilReset()} days</div>
            <div className="text-xs text-muted-foreground">on day {budgetConfig.billing_cycle_day}</div>
          </div>
        </div>

        {/* Progress bar with limits */}
        <div className="relative h-6 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              getBudgetStatus() === 'blocked' ? 'bg-destructive' :
              getBudgetStatus() === 'critical' ? 'bg-warning' :
              getBudgetStatus() === 'warning' ? 'bg-warning' :
              'bg-success'
            }`}
            style={{ width: `${Math.min(getBudgetPercentage(), 100)}%` }}
          />
          {/* Soft limit marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-warning"
            style={{ left: `${budgetConfig.soft_limit_percentage}%` }}
            title={`Soft limit: ${budgetConfig.soft_limit_percentage}%`}
          />
          {/* Hard limit marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-destructive"
            style={{ left: `${Math.min(budgetConfig.hard_limit_percentage, 100)}%` }}
            title={`Hard limit: ${budgetConfig.hard_limit_percentage}%`}
          />
          {/* Labels */}
          <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-medium">
            <span className={getBudgetPercentage() > 50 ? 'text-success-foreground' : 'text-foreground'}>
              {formatCurrency(spendingData.current_month_spend_cents)}
            </span>
            <span className="text-foreground">
              {formatCurrency(budgetConfig.monthly_budget_cents)}
            </span>
          </div>
        </div>
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          <span>0%</span>
          <span className="text-warning">{budgetConfig.soft_limit_percentage}% soft</span>
          <span className="text-destructive">{budgetConfig.hard_limit_percentage}% hard</span>
        </div>

        {/* Projected spend warning */}
        {getProjectedSpend() > budgetConfig.monthly_budget_cents && (
          <div className="mt-3 p-2 bg-warning/10 border border-warning/30 rounded text-sm text-warning">
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

          <div className="p-3 bg-muted rounded-lg">
            <label className="block text-sm font-medium text-foreground mb-1">Monthly Budget</label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">$</span>
              <input
                type="number"
                min="100"
                max="100000"
                step="100"
                value={budgetConfig.monthly_budget_cents / 100}
                onChange={(e) => onConfigChange({ ...budgetConfig, monthly_budget_cents: parseFloat(e.target.value) * 100 || 50000 })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="p-3 bg-warning/5 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-warning">Soft Limit: {budgetConfig.soft_limit_percentage}%</label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={budgetConfig.alert_on_soft_limit}
                  onChange={(e) => onConfigChange({ ...budgetConfig, alert_on_soft_limit: e.target.checked })}
                  className="w-4 h-4 text-warning rounded"
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
              className="w-full h-2 bg-warning/20 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-xs text-warning mt-1">Warn at {formatCurrency(budgetConfig.monthly_budget_cents * budgetConfig.soft_limit_percentage / 100)}</div>
          </div>

          <div className="p-3 bg-destructive/5 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-destructive">Hard Limit: {budgetConfig.hard_limit_percentage}%</label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={budgetConfig.block_on_hard_limit}
                  onChange={(e) => onConfigChange({ ...budgetConfig, block_on_hard_limit: e.target.checked })}
                  className="w-4 h-4 text-destructive rounded"
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
              className="w-full h-2 bg-destructive/20 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-xs text-destructive mt-1">Block at {formatCurrency(budgetConfig.monthly_budget_cents * budgetConfig.hard_limit_percentage / 100)}</div>
          </div>
        </div>

        {/* Right: Spending Stats */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">📊 Spending Breakdown</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-primary/5 rounded-lg">
              <div className="text-xl font-bold text-primary">{spendingData.requests_this_month.toLocaleString()}</div>
              <div className="text-xs text-primary">Requests</div>
            </div>
            <div className="text-center p-3 bg-success/5 rounded-lg">
              <div className="text-xl font-bold text-success">{formatCurrency(spendingData.avg_cost_per_request_cents)}</div>
              <div className="text-xs text-success">Avg Cost/Req</div>
            </div>
            <div className="text-center p-3 bg-accent/5 rounded-lg">
              <div className="text-xl font-bold text-accent">{formatCurrency(spendingData.last_month_spend_cents)}</div>
              <div className="text-xs text-accent">Last Month</div>
            </div>
            <div className="text-center p-3 bg-warning/5 rounded-lg">
              <div className="text-xl font-bold text-warning">{formatCurrency(getProjectedSpend())}</div>
              <div className="text-xs text-warning">Projected</div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">By Provider</h4>
            {Object.entries(spendingData.by_provider).map(([provider, cents]) => (
              <div key={provider} className="flex items-center gap-2 mb-2">
                <span className="w-16 text-sm font-medium capitalize">{provider}</span>
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${provider === 'kie' ? 'bg-gradient-to-r from-teal-400 to-teal-500' : 'bg-gradient-to-r from-primary/80 to-primary'}`}
                    style={{ width: `${spendingData.current_month_spend_cents > 0 ? (cents / spendingData.current_month_spend_cents) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs text-foreground w-16 text-right">{formatCurrency(cents)}</span>
              </div>
            ))}
          </div>

          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">By Feature</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {Object.entries(spendingData.by_feature)
                .sort(([, a], [, b]) => b - a)
                .map(([feature, cents]) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    <span className="w-6">{getFeatureIcon(feature as AIFeatureType)}</span>
                    <span className="flex-1 truncate capitalize">{feature.replace('_', ' ')}</span>
                    <span className="text-foreground">{formatCurrency(cents)}</span>
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
                  alert.type === 'hard_limit' ? 'bg-destructive/5 border border-destructive/20' :
                  alert.type === 'soft_limit' ? 'bg-warning/5 border border-warning/20' :
                  'bg-warning/5 border border-warning/20'
                }`}
              >
                <div>
                  <div className="text-sm font-medium">{alert.message}</div>
                  <div className="text-xs text-muted-foreground">{new Date(alert.timestamp).toLocaleString()}</div>
                </div>
                <button
                  onClick={() => onAcknowledgeAlert(alert.id)}
                  className="text-xs text-muted-foreground hover:text-foreground"
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
          <div className="bg-card rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">🔄 Reset Monthly Budget</h3>
            <p className="text-foreground mb-4">
              This will reset the current month's spending counter to $0.00. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBudgetResetModal(false)}
                className="px-4 py-2 text-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onResetBudget();
                  setShowBudgetResetModal(false);
                }}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90"
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
