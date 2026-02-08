// AITimeoutPanel - Extracted from AIRouterPage.tsx (Feature #405)
// Per-feature timeout configuration with simulation testing

import { useState } from 'react';
import type {
  AIFeatureType,
  FeatureTimeout,
  TimeoutEvent,
  TimeoutStats,
} from './types';
import { getFeatureIcon, formatTimeoutDuration } from './types';

interface AITimeoutPanelProps {
  featureTimeouts: FeatureTimeout[];
  setFeatureTimeouts: React.Dispatch<React.SetStateAction<FeatureTimeout[]>>;
  timeoutEvents: TimeoutEvent[];
  setTimeoutEvents: React.Dispatch<React.SetStateAction<TimeoutEvent[]>>;
  timeoutStats: TimeoutStats;
}

export function AITimeoutPanel({
  featureTimeouts,
  setFeatureTimeouts,
  timeoutEvents,
  setTimeoutEvents,
  timeoutStats,
}: AITimeoutPanelProps) {
  const [isSimulatingTimeout, setIsSimulatingTimeout] = useState(false);

  // Update a feature's timeout configuration
  const updateFeatureTimeout = (feature: AIFeatureType, updates: Partial<FeatureTimeout>) => {
    setFeatureTimeouts(prev => prev.map(ft =>
      ft.feature === feature ? { ...ft, ...updates } : ft
    ));
  };

  // Simulate a timeout event for testing
  const simulateTimeout = async (feature: AIFeatureType) => {
    setIsSimulatingTimeout(true);

    const ft = featureTimeouts.find(f => f.feature === feature);
    if (!ft) return;

    // Simulate a delay longer than timeout
    await new Promise(r => setTimeout(r, 1500));

    const event: TimeoutEvent = {
      id: `timeout-${Date.now()}`,
      timestamp: new Date().toISOString(),
      feature,
      configured_timeout_ms: ft.timeout_ms,
      actual_duration_ms: ft.timeout_ms + Math.floor(Math.random() * 5000),
      provider: Math.random() > 0.5 ? 'kie' : 'anthropic',
      triggered_fallback: ft.fallback_on_timeout,
      fallback_success: ft.fallback_on_timeout ? Math.random() > 0.2 : undefined,
    };

    setTimeoutEvents(prev => [event, ...prev].slice(0, 20));
    setIsSimulatingTimeout(false);
  };

  return (
    <div className="bg-card rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">⏱️ Timeout Configuration</h2>
          <p className="text-sm text-muted-foreground">Set custom timeouts per feature type with fallback behavior</p>
        </div>
      </div>

      {/* Feature Timeout Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {featureTimeouts.map((ft) => (
          <div
            key={ft.feature}
            className={`p-4 rounded-lg border-2 transition-all ${
              ft.enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/50'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getFeatureIcon(ft.feature)}</span>
                <div>
                  <div className="font-medium">{ft.name}</div>
                  <div className="text-xs text-muted-foreground">{ft.description}</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ft.enabled}
                  onChange={(e) => updateFeatureTimeout(ft.feature, { enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-card after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {ft.enabled && (
              <>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-foreground">Timeout</span>
                    <span className="font-mono font-medium">{formatTimeoutDuration(ft.timeout_ms)}</span>
                  </div>
                  <input
                    type="range"
                    min="5000"
                    max="180000"
                    step="5000"
                    value={ft.timeout_ms}
                    onChange={(e) => updateFeatureTimeout(ft.feature, { timeout_ms: parseInt(e.target.value) })}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>5s</span>
                    <span>3m</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ft.fallback_on_timeout}
                      onChange={(e) => updateFeatureTimeout(ft.feature, { fallback_on_timeout: e.target.checked })}
                      className="w-4 h-4 text-warning rounded focus:ring-warning"
                    />
                    <span className="text-foreground">Fallback on timeout</span>
                  </label>
                  <button
                    onClick={() => simulateTimeout(ft.feature)}
                    disabled={isSimulatingTimeout}
                    className="px-2 py-1 text-xs bg-warning/10 text-warning rounded hover:bg-warning/20 disabled:opacity-50"
                  >
                    {isSimulatingTimeout ? '⏳' : '🧪'} Test
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Timeout Stats */}
      <div className="mb-6">
        <h3 className="text-sm font-medium mb-3">📊 Timeout Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="text-center p-3 bg-destructive/5 rounded-lg">
            <div className="text-2xl font-bold text-destructive">{timeoutStats.total_timeouts}</div>
            <div className="text-xs text-destructive">Total Timeouts</div>
          </div>
          <div className="text-center p-3 bg-warning/5 rounded-lg">
            <div className="text-2xl font-bold text-warning">{formatTimeoutDuration(timeoutStats.avg_timeout_duration_ms)}</div>
            <div className="text-xs text-warning">Avg Overage</div>
          </div>
          <div className="text-center p-3 bg-success/5 rounded-lg">
            <div className="text-2xl font-bold text-success">{timeoutStats.fallback_success_rate.toFixed(1)}%</div>
            <div className="text-xs text-success">Fallback Success</div>
          </div>
          <div className="text-center p-3 bg-purple-500/10 rounded-lg col-span-2">
            <div className="text-lg font-bold text-purple-400 flex items-center justify-center gap-2">
              {timeoutStats.most_timeout_prone_feature && (
                <>
                  {getFeatureIcon(timeoutStats.most_timeout_prone_feature)}
                  <span>{featureTimeouts.find(f => f.feature === timeoutStats.most_timeout_prone_feature)?.name}</span>
                </>
              )}
            </div>
            <div className="text-xs text-purple-400">Most Timeout-Prone</div>
          </div>
        </div>
      </div>

      {/* Timeouts by Feature Bar Chart */}
      <div className="mb-6">
        <h3 className="text-sm font-medium mb-3">📈 Timeouts by Feature</h3>
        <div className="space-y-2">
          {featureTimeouts.map((ft) => {
            const count = timeoutStats.timeouts_by_feature[ft.feature] || 0;
            const maxCount = Math.max(...Object.values(timeoutStats.timeouts_by_feature), 1);
            const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
            return (
              <div key={ft.feature} className="flex items-center gap-3">
                <span className="w-6 text-center">{getFeatureIcon(ft.feature)}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-foreground">{ft.name}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-warning/80 to-destructive rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeout Event Logs */}
      <div>
        <h3 className="text-sm font-medium mb-3">📋 Timeout Event Logs</h3>
        {timeoutEvents.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground bg-muted/50 rounded-lg">
            <div className="text-2xl mb-2">⏱️</div>
            <div className="text-sm">No timeout events logged yet</div>
            <div className="text-xs text-muted-foreground mt-1">Test a feature timeout to see logs</div>
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {timeoutEvents.map((event) => (
              <div
                key={event.id}
                className={`flex items-center justify-between p-3 rounded border text-sm ${
                  event.triggered_fallback
                    ? event.fallback_success
                      ? 'bg-success/5 border-success/20'
                      : 'bg-destructive/5 border-destructive/20'
                    : 'bg-warning/5 border-warning/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {event.triggered_fallback
                      ? event.fallback_success
                        ? '✅'
                        : '❌'
                      : '⚠️'}
                  </span>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {getFeatureIcon(event.feature)}
                      {featureTimeouts.find(f => f.feature === event.feature)?.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Timeout: {formatTimeoutDuration(event.configured_timeout_ms)} •
                      Actual: {formatTimeoutDuration(event.actual_duration_ms)} •
                      {event.provider}
                      {event.triggered_fallback && ` → ${event.fallback_success ? 'Fallback OK' : 'Fallback Failed'}`}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
