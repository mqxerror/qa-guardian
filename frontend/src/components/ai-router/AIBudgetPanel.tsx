// AIBudgetPanel - Extracted from AIRouterPage.tsx (Feature #1329)
// Monthly AI budget limits with spending tracking and alerts

import { useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../ui/Modal';
import type {
  AIBudgetConfig,
  AISpendingData,
  BudgetAlert,
  AIFeatureType,
} from './types';
import { getFeatureIcon } from './types';

interface AIBudgetPanelProps {
  budgetConfig: AIBudgetConfig;
  setBudgetConfig: React.Dispatch<React.SetStateAction<AIBudgetConfig>>;
  spendingData: AISpendingData;
  setSpendingData: React.Dispatch<React.SetStateAction<AISpendingData>>;
  budgetAlerts: BudgetAlert[];
  setBudgetAlerts: React.Dispatch<React.SetStateAction<BudgetAlert[]>>;
}

export function AIBudgetPanel({
  budgetConfig,
  setBudgetConfig,
  spendingData,
  setSpendingData,
  budgetAlerts,
  setBudgetAlerts,
}: AIBudgetPanelProps) {
  const [showBudgetResetModal, setShowBudgetResetModal] = useState(false);

  // Feature #1329: Budget helper functions
  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getBudgetPercentage = (): number => {
    return (spendingData.current_month_spend_cents / budgetConfig.monthly_budget_cents) * 100;
  };

  const getBudgetStatus = (): 'ok' | 'warning' | 'critical' | 'blocked' => {
    const percentage = getBudgetPercentage();
    if (percentage >= budgetConfig.hard_limit_percentage && budgetConfig.block_on_hard_limit) {
      return 'blocked';
    }
    if (percentage >= budgetConfig.soft_limit_percentage) {
      return 'critical';
    }
    if (percentage >= budgetConfig.soft_limit_percentage - 10) {
      return 'warning';
    }
    return 'ok';
  };

  const getDaysUntilReset = (): number => {
    const today = new Date();
    const resetDay = budgetConfig.billing_cycle_day;
    const currentDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    if (currentDay < resetDay) {
      return resetDay - currentDay;
    } else {
      return daysInMonth - currentDay + resetDay;
    }
  };

  const getProjectedSpend = (): number => {
    const daysElapsed = spendingData.daily_spend.length;
    const avgDailySpend = spendingData.current_month_spend_cents / Math.max(daysElapsed, 1);
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    return Math.round(avgDailySpend * daysInMonth);
  };

  const simulateSpending = (amount_cents: number) => {
    const newSpend = spendingData.current_month_spend_cents + amount_cents;
    const newPercentage = (newSpend / budgetConfig.monthly_budget_cents) * 100;

    setSpendingData(prev => ({
      ...prev,
      current_month_spend_cents: newSpend,
      requests_this_month: prev.requests_this_month + Math.ceil(amount_cents / prev.avg_cost_per_request_cents),
    }));

    // Check for alerts
    if (newPercentage >= budgetConfig.hard_limit_percentage && budgetConfig.block_on_hard_limit) {
      setBudgetAlerts(prev => [{
        id: `alert-${Date.now().toString(36)}`,
        timestamp: new Date().toISOString(),
        type: 'hard_limit',
        percentage: Math.round(newPercentage),
        message: `Hard limit reached! AI requests are now blocked. Current spend: ${formatCurrency(newSpend)}`,
        acknowledged: false,
      }, ...prev]);
      alert(`Hard limit reached!\n\nYou have used ${newPercentage.toFixed(1)}% of your monthly AI budget.\nNew AI requests are now blocked until the billing cycle resets.\n\nSpend: ${formatCurrency(newSpend)} / ${formatCurrency(budgetConfig.monthly_budget_cents)}`);
    } else if (newPercentage >= budgetConfig.soft_limit_percentage && budgetConfig.alert_on_soft_limit) {
      const existingSoftAlert = budgetAlerts.find(a => a.type === 'soft_limit' && !a.acknowledged);
      if (!existingSoftAlert) {
        setBudgetAlerts(prev => [{
          id: `alert-${Date.now().toString(36)}`,
          timestamp: new Date().toISOString(),
          type: 'soft_limit',
          percentage: Math.round(newPercentage),
          message: `Soft limit reached! You have used ${Math.round(newPercentage)}% of your monthly AI budget.`,
          acknowledged: false,
        }, ...prev]);
      }
    }
  };

  const resetBudget = () => {
    setSpendingData(prev => ({
      ...prev,
      current_month_spend_cents: 0,
      daily_spend: [],
      requests_this_month: 0,
    }));
    setBudgetAlerts(prev => [{
      id: `alert-${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      type: 'reset',
      percentage: 0,
      message: 'Monthly budget has been reset for the new billing cycle.',
      acknowledged: false,
    }, ...prev]);
    setShowBudgetResetModal(false);
    alert('Budget Reset!\n\nYour monthly AI budget has been reset. All spending counters are now at $0.00.');
  };

  const acknowledgeAlert = (alertId: string) => {
    setBudgetAlerts(prev => prev.map(a =>
      a.id === alertId ? { ...a, acknowledged: true } : a
    ));
  };

  return (
    <>
      {/* Feature #1329: Monthly AI Budget Limits */}
      <div className="bg-card rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Monthly AI Budget
              {getBudgetStatus() === 'blocked' && (
                <span className="text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full animate-pulse">BLOCKED</span>
              )}
              {getBudgetStatus() === 'critical' && (
                <span className="text-xs bg-warning text-warning-foreground px-2 py-0.5 rounded-full">Soft Limit</span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">Track and control AI spending with soft and hard limits</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBudgetResetModal(true)}
              className="px-3 py-1 text-sm bg-muted text-muted-foreground rounded hover:bg-muted/80"
            >
              Reset Budget
            </button>
          </div>
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
          <div className="relative h-6 bg-muted rounded-full overflow-hidden">
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
              At current rate, projected month-end spend: <strong>{formatCurrency(getProjectedSpend())}</strong>
              (over budget by {formatCurrency(getProjectedSpend() - budgetConfig.monthly_budget_cents)})
            </div>
          )}
        </div>

        {/* Budget Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Left: Budget Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Budget Configuration</h3>

            <div className="p-3 bg-muted/50 rounded-lg">
              <label className="block text-sm font-medium text-foreground mb-1">Monthly Budget</label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <input
                  type="number"
                  min="100"
                  max="100000"
                  step="100"
                  value={budgetConfig.monthly_budget_cents / 100}
                  onChange={(e) => setBudgetConfig({ ...budgetConfig, monthly_budget_cents: parseFloat(e.target.value) * 100 || 50000 })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary bg-input text-foreground"
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
                    onChange={(e) => setBudgetConfig({ ...budgetConfig, alert_on_soft_limit: e.target.checked })}
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
                onChange={(e) => setBudgetConfig({ ...budgetConfig, soft_limit_percentage: parseInt(e.target.value) })}
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
                    onChange={(e) => setBudgetConfig({ ...budgetConfig, block_on_hard_limit: e.target.checked })}
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
                onChange={(e) => setBudgetConfig({ ...budgetConfig, hard_limit_percentage: parseInt(e.target.value) })}
                className="w-full h-2 bg-destructive/20 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-xs text-destructive mt-1">Block at {formatCurrency(budgetConfig.monthly_budget_cents * budgetConfig.hard_limit_percentage / 100)}</div>
            </div>

            <div className="p-3 bg-primary/5 rounded-lg">
              <label className="block text-sm font-medium text-primary mb-2">Billing Cycle Day</label>
              <select
                value={budgetConfig.billing_cycle_day}
                onChange={(e) => setBudgetConfig({ ...budgetConfig, billing_cycle_day: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary bg-input text-foreground"
              >
                {Array.from({ length: 28 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Day {i + 1}</option>
                ))}
              </select>
              <div className="text-xs text-primary mt-1">Budget resets on this day each month</div>
            </div>
          </div>

          {/* Right: Spending Stats */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Spending Breakdown</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-primary/5 rounded-lg">
                <div className="text-xl font-bold text-primary">{spendingData.requests_this_month.toLocaleString()}</div>
                <div className="text-xs text-primary">Requests</div>
              </div>
              <div className="text-center p-3 bg-success/5 rounded-lg">
                <div className="text-xl font-bold text-success">{formatCurrency(spendingData.avg_cost_per_request_cents)}</div>
                <div className="text-xs text-success">Avg Cost/Req</div>
              </div>
              <div className="text-center p-3 bg-accent/10 rounded-lg">
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
                      style={{ width: `${(cents / spendingData.current_month_spend_cents) * 100}%` }}
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

        {/* Feature #1340: Budget History Chart */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Daily Spending History</h3>
            <div className="flex items-center gap-2">
              <select
                value="16"
                className="text-xs border rounded px-2 py-1 bg-input text-foreground"
                onChange={() => {}}
              >
                <option value="7">Last 7 days</option>
                <option value="14">Last 14 days</option>
                <option value="16">This month</option>
                <option value="30">Last 30 days</option>
              </select>
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            {/* Mini chart showing daily spending */}
            <div className="flex items-end gap-1 h-32 mb-2">
              {spendingData.daily_spend.map((day, idx) => {
                const maxSpend = Math.max(...spendingData.daily_spend.map(d => d.amount_cents), 1);
                const height = (day.amount_cents / maxSpend) * 100;
                const dailyBudgetLimit = budgetConfig.monthly_budget_cents / 30;
                const isOverDailyBudget = day.amount_cents > dailyBudgetLimit;
                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center group relative"
                    title={`${new Date(day.date).toLocaleDateString()}: ${formatCurrency(day.amount_cents)}`}
                  >
                    <div
                      className={`w-full rounded-t transition-all ${
                        isOverDailyBudget ? 'bg-destructive/80 hover:bg-destructive/90' : 'bg-primary/80 hover:bg-primary/90'
                      }`}
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card text-foreground text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
                      {formatCurrency(day.amount_cents)}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* X-axis labels */}
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{spendingData.daily_spend[0]?.date ? new Date(spendingData.daily_spend[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
              <span>Daily avg: {formatCurrency(spendingData.daily_spend.length > 0 ? spendingData.daily_spend.reduce((a, b) => a + b.amount_cents, 0) / spendingData.daily_spend.length : 0)}</span>
              <span>{spendingData.daily_spend.length > 0 ? new Date(spendingData.daily_spend[spendingData.daily_spend.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-primary/80 rounded" />
                <span>Within daily budget</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-destructive/80 rounded" />
                <span>Over daily budget</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-0.5 h-3 bg-warning" />
                <span>Avg: ~{formatCurrency(budgetConfig.monthly_budget_cents / 30)}/day</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature #1340: Export Budget Reports */}
        <div className="mb-6 p-4 bg-gradient-to-r from-primary/5 to-accent/10 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-medium text-primary">Export Budget Reports</h3>
              <p className="text-xs text-primary">Download spending data for analysis or compliance</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const csvHeader = 'Date,Amount (USD),Provider,Feature\n';
                const csvData = spendingData.daily_spend.map(d =>
                  `${d.date},${(d.amount_cents / 100).toFixed(2)},Mixed,All Features`
                ).join('\n');
                const blob = new Blob([csvHeader + csvData], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `budget-report-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                alert('Budget report downloaded as CSV');
              }}
              className="px-3 py-2 bg-card border border-primary/30 text-primary rounded hover:bg-primary/5 flex items-center gap-2"
            >
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => {
                const reportData = {
                  generated_at: new Date().toISOString(),
                  period: {
                    start: spendingData.daily_spend[0]?.date || '',
                    end: spendingData.daily_spend[spendingData.daily_spend.length - 1]?.date || ''
                  },
                  budget: {
                    monthly_limit_cents: budgetConfig.monthly_budget_cents,
                    soft_limit_percent: budgetConfig.soft_limit_percentage,
                    hard_limit_percent: budgetConfig.hard_limit_percentage,
                    billing_cycle_day: budgetConfig.billing_cycle_day
                  },
                  spending: {
                    current_month_cents: spendingData.current_month_spend_cents,
                    last_month_cents: spendingData.last_month_spend_cents,
                    requests_this_month: spendingData.requests_this_month,
                    avg_cost_per_request_cents: spendingData.avg_cost_per_request_cents,
                    by_provider: spendingData.by_provider,
                    by_feature: spendingData.by_feature,
                    daily_breakdown: spendingData.daily_spend
                  },
                  status: getBudgetStatus(),
                  projected_month_end_cents: getProjectedSpend()
                };
                const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `budget-report-detailed-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                alert('Detailed budget report downloaded as JSON');
              }}
              className="px-3 py-2 bg-card border border-primary/30 text-primary rounded hover:bg-primary/5 flex items-center gap-2"
            >
              <span>Export JSON</span>
            </button>
            <button
              onClick={() => {
                const summaryText = `
AI Budget Summary Report
========================
Generated: ${new Date().toLocaleString()}

BUDGET CONFIGURATION
-------------------
Monthly Budget: ${formatCurrency(budgetConfig.monthly_budget_cents)}
Soft Limit: ${budgetConfig.soft_limit_percentage}% (${formatCurrency(budgetConfig.monthly_budget_cents * budgetConfig.soft_limit_percentage / 100)})
Hard Limit: ${budgetConfig.hard_limit_percentage}% (${formatCurrency(budgetConfig.monthly_budget_cents * budgetConfig.hard_limit_percentage / 100)})
Billing Cycle: Day ${budgetConfig.billing_cycle_day} of each month

CURRENT STATUS
--------------
Status: ${getBudgetStatus().toUpperCase()}
Current Spend: ${formatCurrency(spendingData.current_month_spend_cents)}
Budget Used: ${getBudgetPercentage().toFixed(1)}%
Projected End-of-Month: ${formatCurrency(getProjectedSpend())}
Days Until Reset: ${getDaysUntilReset()}

SPENDING BREAKDOWN
------------------
Total Requests: ${spendingData.requests_this_month.toLocaleString()}
Avg Cost/Request: ${formatCurrency(spendingData.avg_cost_per_request_cents)}
Last Month Total: ${formatCurrency(spendingData.last_month_spend_cents)}

BY PROVIDER:
${Object.entries(spendingData.by_provider).map(([p, c]) => ` ${p}: ${formatCurrency(c)}`).join('\n')}

BY FEATURE:
${Object.entries(spendingData.by_feature).map(([f, c]) => ` ${f.replace('_', ' ')}: ${formatCurrency(c)}`).join('\n')}
`.trim();
                const blob = new Blob([summaryText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `budget-summary-${new Date().toISOString().split('T')[0]}.txt`;
                a.click();
                URL.revokeObjectURL(url);
                alert('Budget summary downloaded as TXT');
              }}
              className="px-3 py-2 bg-card border border-primary/30 text-primary rounded hover:bg-primary/5 flex items-center gap-2"
            >
              <span>Export Summary</span>
            </button>
            <button
              onClick={() => {
                const printContent = `
<html>
<head>
  <title>AI Budget Report</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 20px; max-width: 800px; margin: auto; }
    h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 24px; }
    .stat { background: #f3f4f6; padding: 12px; border-radius: 8px; margin: 8px 0; }
    .stat-value { font-size: 24px; font-weight: bold; color: #1e40af; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { padding: 8px; border: 1px solid #e5e7eb; text-align: left; }
    th { background: #f3f4f6; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <h1>AI Budget Report</h1>
  <p>Generated: ${new Date().toLocaleString()}</p>

  <h2>Budget Overview</h2>
  <div class="grid">
    <div class="stat">
      <div>Current Spend</div>
      <div class="stat-value">${formatCurrency(spendingData.current_month_spend_cents)}</div>
    </div>
    <div class="stat">
      <div>Monthly Budget</div>
      <div class="stat-value">${formatCurrency(budgetConfig.monthly_budget_cents)}</div>
    </div>
  </div>

  <h2>Spending by Provider</h2>
  <table>
    <tr><th>Provider</th><th>Amount</th><th>%</th></tr>
    ${Object.entries(spendingData.by_provider).map(([p, c]) =>
      `<tr><td>${p}</td><td>${formatCurrency(c)}</td><td>${((c / spendingData.current_month_spend_cents) * 100).toFixed(1)}%</td></tr>`
    ).join('')}
  </table>

  <h2>Spending by Feature</h2>
  <table>
    <tr><th>Feature</th><th>Amount</th><th>%</th></tr>
    ${Object.entries(spendingData.by_feature).map(([f, c]) =>
      `<tr><td>${f.replace('_', ' ')}</td><td>${formatCurrency(c)}</td><td>${((c / spendingData.current_month_spend_cents) * 100).toFixed(1)}%</td></tr>`
    ).join('')}
  </table>
</body>
</html>
`;
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                  printWindow.document.write(printContent);
                  printWindow.document.close();
                  printWindow.print();
                }
              }}
              className="px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 flex items-center gap-2"
            >
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* Simulate Spending */}
        <div className="mb-6 p-4 bg-muted/50 rounded-lg">
          <h3 className="text-sm font-medium mb-3">Simulate Spending</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => simulateSpending(1000)}
              disabled={getBudgetStatus() === 'blocked'}
              className="px-3 py-2 bg-success/10 text-success rounded hover:bg-success/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +$10.00
            </button>
            <button
              onClick={() => simulateSpending(5000)}
              disabled={getBudgetStatus() === 'blocked'}
              className="px-3 py-2 bg-primary/10 text-primary rounded hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +$50.00
            </button>
            <button
              onClick={() => simulateSpending(10000)}
              disabled={getBudgetStatus() === 'blocked'}
              className="px-3 py-2 bg-warning/10 text-warning rounded hover:bg-warning/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +$100.00
            </button>
            <button
              onClick={() => simulateSpending(budgetConfig.monthly_budget_cents - spendingData.current_month_spend_cents + 100)}
              disabled={getBudgetStatus() === 'blocked'}
              className="px-3 py-2 bg-destructive/10 text-destructive rounded hover:bg-destructive/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Exceed Budget
            </button>
          </div>
          {getBudgetStatus() === 'blocked' && (
            <div className="mt-2 text-sm text-destructive">
              Spending blocked - hard limit reached. Reset budget to continue.
            </div>
          )}
        </div>

        {/* Budget Alerts */}
        <div>
          <h3 className="text-sm font-medium mb-3">Budget Alerts</h3>
          {budgetAlerts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground bg-muted/50 rounded-lg">
              <div className="text-2xl mb-2">No alerts</div>
              <div className="text-sm">No budget alerts</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {budgetAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-center justify-between p-3 rounded border ${
                    alert.type === 'hard_limit' ? 'bg-destructive/5 border-destructive/20' :
                    alert.type === 'soft_limit' ? 'bg-warning/5 border-warning/20' :
                    alert.type === 'reset' ? 'bg-success/5 border-success/20' :
                    'bg-primary/5 border-primary/20'
                  } ${alert.acknowledged ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {alert.type === 'hard_limit' ? 'BLOCKED' :
                       alert.type === 'soft_limit' ? 'WARNING' :
                       alert.type === 'reset' ? 'RESET' : 'INFO'}
                    </span>
                    <div>
                      <div className="font-medium text-sm">{alert.message}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {!alert.acknowledged && (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="px-2 py-1 text-xs bg-secondary text-foreground rounded hover:bg-muted"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feature #659: Budget Reset Modal - migrated to shared Modal */}
      <Modal
        isOpen={showBudgetResetModal}
        onClose={() => setShowBudgetResetModal(false)}
        title="Reset Monthly Budget"
        size="md"
      >
        <ModalHeader onClose={() => setShowBudgetResetModal(false)}>
          Reset Monthly Budget
        </ModalHeader>
        <ModalBody>
          <p className="text-foreground mb-4">
            This will reset your current month's spending to $0.00 and clear all spending history.
            This action is typically triggered automatically on billing cycle day {budgetConfig.billing_cycle_day}.
          </p>
          <div className="bg-warning/5 border border-warning/20 rounded p-3 text-sm text-warning">
            Current spend of <strong>{formatCurrency(spendingData.current_month_spend_cents)}</strong> will be cleared.
          </div>
        </ModalBody>
        <ModalFooter>
          <button
            onClick={() => setShowBudgetResetModal(false)}
            className="px-4 py-2 bg-muted text-foreground rounded hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={resetBudget}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Reset Budget
          </button>
        </ModalFooter>
      </Modal>
    </>
  );
}
