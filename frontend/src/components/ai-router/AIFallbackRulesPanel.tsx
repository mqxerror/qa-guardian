// AIFallbackRulesPanel - Extracted from AIRouterPage.tsx (Feature #1339)
// Fallback rules configuration with testing and event history

import { useState } from 'react';
import type {
  FallbackTrigger,
  FallbackRule,
  FallbackTestResult,
  FallbackStats,
} from './types';

// Helper functions for fallback rules
export const getTriggerIcon = (trigger: FallbackTrigger): string => {
  switch (trigger) {
    case 'error': return '❌';
    case 'timeout': return '⏱️';
    case 'rate_limit': return '🚦';
    case 'server_error': return '🔥';
    case 'network_error': return '🌐';
  }
};

export const getTriggerLabel = (trigger: FallbackTrigger): string => {
  switch (trigger) {
    case 'error': return 'Error';
    case 'timeout': return 'Timeout';
    case 'rate_limit': return 'Rate Limit';
    case 'server_error': return 'Server Error';
    case 'network_error': return 'Network Error';
  }
};

export const getProviderLabel = (provider: 'kie' | 'anthropic' | 'any' | 'none'): string => {
  switch (provider) {
    case 'kie': return 'Kie.ai';
    case 'anthropic': return 'Anthropic';
    case 'any': return 'Any Provider';
    case 'none': return 'None (Fail)';
  }
};

interface AIFallbackRulesPanelProps {
  fallbackRules: FallbackRule[];
  setFallbackRules: React.Dispatch<React.SetStateAction<FallbackRule[]>>;
  fallbackTestResults: FallbackTestResult[];
  setFallbackTestResults: React.Dispatch<React.SetStateAction<FallbackTestResult[]>>;
  fallbackStats: FallbackStats;
}

export function AIFallbackRulesPanel({
  fallbackRules,
  setFallbackRules,
  fallbackTestResults,
  setFallbackTestResults,
  fallbackStats,
}: AIFallbackRulesPanelProps) {
  const [showFallbackRuleModal, setShowFallbackRuleModal] = useState(false);
  const [editingFallbackRule, setEditingFallbackRule] = useState<FallbackRule | null>(null);
  const [isTestingFallback, setIsTestingFallback] = useState(false);
  const [testingFallbackTrigger, setTestingFallbackTrigger] = useState<FallbackTrigger | null>(null);

  // Calculate success rate
  const getFallbackSuccessRate = (): number => {
    if (fallbackStats.total_fallbacks_24h === 0) return 100;
    return Math.round((fallbackStats.successful_fallbacks_24h / fallbackStats.total_fallbacks_24h) * 100);
  };

  // Update a fallback rule
  const updateFallbackRule = (ruleId: string, updates: Partial<FallbackRule>) => {
    setFallbackRules(prev => prev.map(rule =>
      rule.id === ruleId ? { ...rule, ...updates } : rule
    ));
  };

  // Delete a fallback rule
  const deleteFallbackRule = (ruleId: string) => {
    setFallbackRules(prev => prev.filter(rule => rule.id !== ruleId));
  };

  // Create a new fallback rule
  const createFallbackRule = () => {
    const newRule: FallbackRule = {
      id: `rule-${Date.now().toString(36)}`,
      name: 'New Fallback Rule',
      enabled: false,
      priority: fallbackRules.length + 1,
      triggers: ['error'],
      source_provider: 'any',
      target_provider: 'anthropic',
      retry_before_fallback: 1,
      timeout_threshold_ms: 30000,
      retry_delay_ms: 1000,
      max_fallback_attempts: 2,
      preserve_context: true,
      log_fallback: true,
      notify_on_fallback: false,
      cooldown_after_fallback_ms: 5000,
    };
    setFallbackRules(prev => [...prev, newRule]);
    setEditingFallbackRule(newRule);
    setShowFallbackRuleModal(true);
  };

  // Test fallback manually
  const testFallbackManually = async (trigger: FallbackTrigger) => {
    setIsTestingFallback(true);
    setTestingFallbackTrigger(trigger);

    // Find applicable rule
    const rule = fallbackRules
      .filter(r => r.enabled && r.triggers.includes(trigger))
      .sort((a, b) => a.priority - b.priority)[0];

    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));

    const success = Math.random() > 0.2;
    const newResult: FallbackTestResult = {
      rule_id: rule?.id || 'no-rule',
      trigger,
      timestamp: new Date().toISOString(),
      source_provider: rule?.source_provider === 'any' ? 'Kie.ai' : getProviderLabel(rule?.source_provider || 'kie'),
      target_provider: getProviderLabel(rule?.target_provider || 'anthropic'),
      success,
      fallback_latency_ms: Math.floor(100 + Math.random() * 500),
      retries_attempted: rule?.retry_before_fallback || 0,
      error_message: success ? undefined : 'Simulated fallback failure for testing',
    };

    setFallbackTestResults(prev => [newResult, ...prev.slice(0, 9)]);
    setIsTestingFallback(false);
    setTestingFallbackTrigger(null);

    if (rule) {
      alert(`${success ? '✅' : '❌'} Fallback test for "${trigger}"\n\nRule: ${rule.name}\nTarget: ${getProviderLabel(rule.target_provider)}\nRetries: ${rule.retry_before_fallback}\nResult: ${success ? 'SUCCESS' : 'FAILED'}\nLatency: ${newResult.fallback_latency_ms}ms`);
    } else {
      alert(`⚠️ No enabled rule found for trigger "${trigger}"\n\nPlease enable a rule with this trigger to test fallback.`);
    }
  };

  return (
    <>
      {/* Feature #1339: Fallback Rules Configuration UI */}
      <div className="bg-card rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              ↔️ Fallback Rules
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                getFallbackSuccessRate() >= 90 ? 'bg-success/10 text-success' :
                getFallbackSuccessRate() >= 70 ? 'bg-warning/10 text-warning' :
                'bg-destructive/10 text-destructive'
              }`}>
                {getFallbackSuccessRate()}% success rate
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">Configure when and how to fallback between providers</p>
          </div>
          <button
            onClick={createFallbackRule}
            className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            + Add Rule
          </button>
        </div>

        {/* Fallback Stats Overview */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-3 bg-primary/5 rounded-lg text-center">
            <div className="text-2xl font-bold text-primary">{fallbackStats.total_fallbacks_24h}</div>
            <div className="text-xs text-primary">Total (24h)</div>
          </div>
          <div className="p-3 bg-success/5 rounded-lg text-center">
            <div className="text-2xl font-bold text-success">{fallbackStats.successful_fallbacks_24h}</div>
            <div className="text-xs text-success">Successful</div>
          </div>
          <div className="p-3 bg-destructive/5 rounded-lg text-center">
            <div className="text-2xl font-bold text-destructive">{fallbackStats.failed_fallbacks_24h}</div>
            <div className="text-xs text-destructive">Failed</div>
          </div>
          <div className="p-3 bg-accent/10 rounded-lg text-center">
            <div className="text-2xl font-bold text-accent">{fallbackStats.avg_fallback_latency_ms}ms</div>
            <div className="text-xs text-accent">Avg Latency</div>
          </div>
        </div>

        {/* Fallback by Trigger Type */}
        <div className="mb-6 p-4 bg-muted/50 rounded-lg">
          <h3 className="text-sm font-medium mb-3">📊 Fallbacks by Trigger</h3>
          <div className="flex flex-wrap gap-3">
            {(['timeout', 'rate_limit', 'error', 'server_error', 'network_error'] as FallbackTrigger[]).map(trigger => (
              <div key={trigger} className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border">
                <span>{getTriggerIcon(trigger)}</span>
                <span className="text-sm font-medium">{getTriggerLabel(trigger)}</span>
                <span className="px-2 py-0.5 text-xs bg-muted rounded-full font-mono">
                  {fallbackStats.by_trigger[trigger]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Fallback Rules List */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3">📋 Configured Rules (Priority Order)</h3>
          <div className="space-y-3">
            {fallbackRules.sort((a, b) => a.priority - b.priority).map(rule => {
              const ruleStats = fallbackStats.by_rule[rule.id];
              return (
                <div
                  key={rule.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    rule.enabled
                      ? 'bg-card border-primary/20'
                      : 'bg-muted border-border opacity-70'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        rule.enabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                      }`}>
                        #{rule.priority}
                      </div>
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {rule.name}
                          {!rule.enabled && <span className="text-xs text-muted-foreground">(disabled)</span>}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {getProviderLabel(rule.source_provider)} → {getProviderLabel(rule.target_provider)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => updateFallbackRule(rule.id, { enabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-card after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                      <button
                        onClick={() => {
                          setEditingFallbackRule(rule);
                          setShowFallbackRuleModal(true);
                        }}
                        className="p-1 text-muted-foreground hover:text-primary"
                        title="Edit Rule"
                      >
                        ⚙️
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete rule "${rule.name}"?`)) {
                            deleteFallbackRule(rule.id);
                          }
                        }}
                        className="p-1 text-muted-foreground hover:text-destructive"
                        title="Delete Rule"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Triggers */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {rule.triggers.map(trigger => (
                      <span key={trigger} className="flex items-center gap-1 px-2 py-1 text-xs bg-muted rounded">
                        {getTriggerIcon(trigger)} {getTriggerLabel(trigger)}
                      </span>
                    ))}
                  </div>

                  {/* Rule Settings Summary */}
                  <div className="grid grid-cols-4 gap-3 text-xs text-foreground mb-3">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">🔄</span>
                      <span>{rule.retry_before_fallback} retries before fallback</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">⏱️</span>
                      <span>{rule.timeout_threshold_ms / 1000}s timeout</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">🎯</span>
                      <span>Max {rule.max_fallback_attempts} attempts</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">⏲️</span>
                      <span>{rule.cooldown_after_fallback_ms / 1000}s cooldown</span>
                    </div>
                  </div>

                  {/* Rule Stats */}
                  {ruleStats && (
                    <div className="flex items-center gap-4 pt-3 border-t text-sm">
                      <span className="text-muted-foreground">
                        Triggered: <strong>{ruleStats.triggered}x</strong>
                      </span>
                      <span className={`${ruleStats.success_rate >= 80 ? 'text-success' : ruleStats.success_rate >= 50 ? 'text-warning' : 'text-destructive'}`}>
                        Success rate: <strong>{ruleStats.success_rate}%</strong>
                      </span>
                      {rule.notify_on_fallback && (
                        <span className="text-primary">🔔 Notifications on</span>
                      )}
                      {rule.preserve_context && (
                        <span className="text-accent">📋 Preserves context</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Test Fallback Manually */}
        <div className="mb-6 p-4 bg-gradient-to-r from-warning/5 to-warning/10 rounded-lg border border-warning/20">
          <h3 className="text-sm font-medium mb-3">🧪 Test Fallback Manually</h3>
          <p className="text-xs text-foreground mb-3">Simulate different failure scenarios to test your fallback rules</p>
          <div className="flex flex-wrap gap-2">
            {(['timeout', 'rate_limit', 'error', 'server_error', 'network_error'] as FallbackTrigger[]).map(trigger => (
              <button
                key={trigger}
                onClick={() => testFallbackManually(trigger)}
                disabled={isTestingFallback}
                className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                  isTestingFallback && testingFallbackTrigger === trigger
                    ? 'bg-primary text-primary-foreground animate-pulse'
                    : 'bg-card border hover:border-primary/40 hover:bg-primary/5'
                } disabled:opacity-50`}
              >
                {isTestingFallback && testingFallbackTrigger === trigger ? '⏳' : getTriggerIcon(trigger)}
                Test {getTriggerLabel(trigger)}
              </button>
            ))}
          </div>
        </div>

        {/* Recent Fallback Test Results */}
        <div>
          <h3 className="text-sm font-medium mb-3">📋 Recent Fallback Events</h3>
          {fallbackTestResults.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground bg-muted/50 rounded-lg">
              <div className="text-2xl mb-2">📭</div>
              <div className="text-sm">No fallback events recorded yet</div>
              <div className="text-xs text-muted-foreground mt-1">Test a fallback scenario to see events</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {fallbackTestResults.map((result, idx) => {
                const rule = fallbackRules.find(r => r.id === result.rule_id);
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      result.success
                        ? 'bg-success/5 border-success/20'
                        : 'bg-destructive/5 border-destructive/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{result.success ? '✅' : '❌'}</span>
                      <div>
                        <div className="font-medium text-sm">
                          {getTriggerIcon(result.trigger)} {getTriggerLabel(result.trigger)} Fallback
                          {rule && <span className="text-muted-foreground font-normal"> • {rule.name}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {result.source_provider} → {result.target_provider}
                          {result.retries_attempted > 0 && ` • ${result.retries_attempted} retries`}
                          {result.error_message && ` • ${result.error_message}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{result.fallback_latency_ms}ms</div>
                      <div className="text-xs text-muted-foreground">{new Date(result.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Fallback Rule Configuration Modal */}
      {showFallbackRuleModal && editingFallbackRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl w-full max-w-2xl p-6 m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">⚙️ Configure Fallback Rule</h3>
              <button onClick={() => setShowFallbackRuleModal(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="space-y-4">
              {/* Rule Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Rule Name</label>
                <input
                  type="text"
                  value={editingFallbackRule.name}
                  onChange={(e) => {
                    const updated = { ...editingFallbackRule, name: e.target.value };
                    setEditingFallbackRule(updated);
                    updateFallbackRule(editingFallbackRule.id, { name: e.target.value });
                  }}
                  className="w-full px-3 py-2 border rounded bg-input text-foreground"
                />
              </div>

              {/* Triggers */}
              <div>
                <label className="block text-sm font-medium mb-2">Fallback Triggers</label>
                <div className="flex flex-wrap gap-2">
                  {(['error', 'timeout', 'rate_limit', 'server_error', 'network_error'] as FallbackTrigger[]).map(trigger => (
                    <label
                      key={trigger}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                        editingFallbackRule.triggers.includes(trigger)
                          ? 'bg-primary/10 border-primary/40'
                          : 'bg-card border-border hover:border-muted-foreground'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={editingFallbackRule.triggers.includes(trigger)}
                        onChange={(e) => {
                          const newTriggers = e.target.checked
                            ? [...editingFallbackRule.triggers, trigger]
                            : editingFallbackRule.triggers.filter(t => t !== trigger);
                          const updated = { ...editingFallbackRule, triggers: newTriggers };
                          setEditingFallbackRule(updated);
                          updateFallbackRule(editingFallbackRule.id, { triggers: newTriggers });
                        }}
                        className="sr-only"
                      />
                      <span>{getTriggerIcon(trigger)}</span>
                      <span className="text-sm">{getTriggerLabel(trigger)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Source and Target Provider */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Source Provider</label>
                  <select
                    value={editingFallbackRule.source_provider}
                    onChange={(e) => {
                      const value = e.target.value as 'kie' | 'anthropic' | 'any';
                      const updated = { ...editingFallbackRule, source_provider: value };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { source_provider: value });
                    }}
                    className="w-full px-3 py-2 border rounded bg-input text-foreground"
                  >
                    <option value="any">Any Provider</option>
                    <option value="kie">Kie.ai</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fallback To</label>
                  <select
                    value={editingFallbackRule.target_provider}
                    onChange={(e) => {
                      const value = e.target.value as 'kie' | 'anthropic' | 'none';
                      const updated = { ...editingFallbackRule, target_provider: value };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { target_provider: value });
                    }}
                    className="w-full px-3 py-2 border rounded bg-input text-foreground"
                  >
                    <option value="anthropic">Anthropic</option>
                    <option value="kie">Kie.ai</option>
                    <option value="none">None (Fail Request)</option>
                  </select>
                </div>
              </div>

              {/* Retry Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Retries Before Fallback</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={editingFallbackRule.retry_before_fallback}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      const updated = { ...editingFallbackRule, retry_before_fallback: val };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { retry_before_fallback: val });
                    }}
                    className="w-full px-3 py-2 border rounded bg-input text-foreground"
                  />
                  <div className="text-xs text-muted-foreground mt-1">Number of retries before triggering fallback</div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Retry Delay (ms)</label>
                  <input
                    type="number"
                    min="100"
                    max="10000"
                    step="100"
                    value={editingFallbackRule.retry_delay_ms}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1000;
                      const updated = { ...editingFallbackRule, retry_delay_ms: val };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { retry_delay_ms: val });
                    }}
                    className="w-full px-3 py-2 border rounded bg-input text-foreground"
                  />
                  <div className="text-xs text-muted-foreground mt-1">Delay between retries</div>
                </div>
              </div>

              {/* Timeout & Fallback Attempts */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Timeout Threshold (ms)</label>
                  <input
                    type="number"
                    min="1000"
                    max="120000"
                    step="1000"
                    value={editingFallbackRule.timeout_threshold_ms}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 30000;
                      const updated = { ...editingFallbackRule, timeout_threshold_ms: val };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { timeout_threshold_ms: val });
                    }}
                    className="w-full px-3 py-2 border rounded bg-input text-foreground"
                  />
                  <div className="text-xs text-muted-foreground mt-1">Timeout for fallback requests</div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Fallback Attempts</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={editingFallbackRule.max_fallback_attempts}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      const updated = { ...editingFallbackRule, max_fallback_attempts: val };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { max_fallback_attempts: val });
                    }}
                    className="w-full px-3 py-2 border rounded bg-input text-foreground"
                  />
                  <div className="text-xs text-muted-foreground mt-1">Max attempts at fallback provider</div>
                </div>
              </div>

              {/* Cooldown */}
              <div>
                <label className="block text-sm font-medium mb-1">Cooldown After Fallback (ms)</label>
                <input
                  type="number"
                  min="0"
                  max="60000"
                  step="1000"
                  value={editingFallbackRule.cooldown_after_fallback_ms}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    const updated = { ...editingFallbackRule, cooldown_after_fallback_ms: val };
                    setEditingFallbackRule(updated);
                    updateFallbackRule(editingFallbackRule.id, { cooldown_after_fallback_ms: val });
                  }}
                  className="w-full px-3 py-2 border rounded bg-input text-foreground"
                />
                <div className="text-xs text-muted-foreground mt-1">Wait time after fallback before returning to primary</div>
              </div>

              {/* Options */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingFallbackRule.preserve_context}
                    onChange={(e) => {
                      const updated = { ...editingFallbackRule, preserve_context: e.target.checked };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { preserve_context: e.target.checked });
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">📋 Preserve conversation context on fallback</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingFallbackRule.log_fallback}
                    onChange={(e) => {
                      const updated = { ...editingFallbackRule, log_fallback: e.target.checked };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { log_fallback: e.target.checked });
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">📝 Log all fallback events</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingFallbackRule.notify_on_fallback}
                    onChange={(e) => {
                      const updated = { ...editingFallbackRule, notify_on_fallback: e.target.checked };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { notify_on_fallback: e.target.checked });
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">🔔 Send notification on fallback</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-4 border-t">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingFallbackRule.enabled}
                    onChange={(e) => {
                      const updated = { ...editingFallbackRule, enabled: e.target.checked };
                      setEditingFallbackRule(updated);
                      updateFallbackRule(editingFallbackRule.id, { enabled: e.target.checked });
                    }}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Enable this rule</span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowFallbackRuleModal(false)}
                    className="px-4 py-2 text-foreground hover:bg-muted rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowFallbackRuleModal(false)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
