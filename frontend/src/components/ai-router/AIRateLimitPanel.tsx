// AIRateLimitPanel - Extracted from AIRouterPage.tsx (Feature #405)
// Provider-specific rate limiting configuration and monitoring

import { useState } from 'react';
import type {
  AIFeatureType,
  ProviderRateLimitConfig,
  ProviderRateLimitStatus,
  RateLimitEvent,
  RateLimitAlert,
  RateLimitStrategy,
} from './types';
import { getFeatureIcon } from './types';

interface AIRateLimitPanelProps {
  rateLimitConfigs: ProviderRateLimitConfig[];
  setRateLimitConfigs: React.Dispatch<React.SetStateAction<ProviderRateLimitConfig[]>>;
  rateLimitStatus: ProviderRateLimitStatus[];
  rateLimitEvents: RateLimitEvent[];
  rateLimitAlerts: RateLimitAlert[];
  setRateLimitAlerts: React.Dispatch<React.SetStateAction<RateLimitAlert[]>>;
}

export function AIRateLimitPanel({
  rateLimitConfigs,
  setRateLimitConfigs,
  rateLimitStatus,
  rateLimitEvents,
  rateLimitAlerts,
  setRateLimitAlerts,
}: AIRateLimitPanelProps) {

  // Update a provider's rate limit configuration
  const updateRateLimitConfig = (
    provider: 'kie' | 'anthropic',
    updates: Partial<ProviderRateLimitConfig>
  ) => {
    setRateLimitConfigs(prev => prev.map(c =>
      c.provider === provider ? { ...c, ...updates } : c
    ));
  };

  // Acknowledge an alert
  const acknowledgeAlert = (alertId: string) => {
    setRateLimitAlerts(prev => prev.map(a =>
      a.id === alertId ? { ...a, acknowledged: true } : a
    ));
  };

  // Get severity color
  const getSeverityColor = (severity: 'info' | 'warning' | 'critical') => {
    switch (severity) {
      case 'critical': return 'bg-destructive/10 border-destructive/20 text-destructive';
      case 'warning': return 'bg-warning/10 border-warning/20 text-warning';
      default: return 'bg-primary/10 border-primary/20 text-primary';
    }
  };

  return (
    <div className="bg-card rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            ⏱️ Provider Rate Limiting
            <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full">
              {rateLimitConfigs.filter(c => c.enabled).length} active
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">Configure request limits and queue behavior per AI provider</p>
        </div>
      </div>

      {/* Provider Rate Limit Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {rateLimitConfigs.map((config) => {
          const status = rateLimitStatus.find(s => s.provider === config.provider);
          const usagePercentMinute = status
            ? ((config.requests_per_minute - status.requests_remaining_minute) / config.requests_per_minute) * 100
            : 0;
          const usagePercentHour = status
            ? ((config.requests_per_hour - status.requests_remaining_hour) / config.requests_per_hour) * 100
            : 0;

          return (
            <div
              key={config.provider}
              className={`border rounded-lg p-4 ${
                config.enabled ? 'border-border' : 'border-border bg-muted/50 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{config.provider === 'kie' ? '🤖' : '🔵'}</span>
                  <div>
                    <h3 className="font-semibold">{config.provider_name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      status?.is_rate_limited ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                    }`}>
                      {status?.is_rate_limited ? '⚠️ Rate Limited' : '✓ Available'}
                    </span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => updateRateLimitConfig(config.provider, { enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-card after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {config.enabled && (
                <div className="space-y-4">
                  {/* Usage Bars */}
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Requests/min</span>
                        <span>{status?.requests_remaining_minute ?? config.requests_per_minute}/{config.requests_per_minute}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            usagePercentMinute > 80 ? 'bg-destructive' :
                            usagePercentMinute > 50 ? 'bg-warning' : 'bg-success'
                          }`}
                          style={{ width: `${usagePercentMinute}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Requests/hour</span>
                        <span>{status?.requests_remaining_hour ?? config.requests_per_hour}/{config.requests_per_hour}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            usagePercentHour > 80 ? 'bg-destructive' :
                            usagePercentHour > 50 ? 'bg-warning' : 'bg-success'
                          }`}
                          style={{ width: `${usagePercentHour}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Configuration Inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Requests/min</label>
                      <input
                        type="number"
                        value={config.requests_per_minute}
                        onChange={(e) => updateRateLimitConfig(config.provider, { requests_per_minute: parseInt(e.target.value) })}
                        className="w-full border rounded px-2 py-1 text-sm bg-input text-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Requests/hour</label>
                      <input
                        type="number"
                        value={config.requests_per_hour}
                        onChange={(e) => updateRateLimitConfig(config.provider, { requests_per_hour: parseInt(e.target.value) })}
                        className="w-full border rounded px-2 py-1 text-sm bg-input text-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Tokens/min</label>
                      <input
                        type="number"
                        value={config.tokens_per_minute}
                        onChange={(e) => updateRateLimitConfig(config.provider, { tokens_per_minute: parseInt(e.target.value) })}
                        className="w-full border rounded px-2 py-1 text-sm bg-input text-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Burst Allowance</label>
                      <input
                        type="number"
                        value={config.burst_allowance}
                        onChange={(e) => updateRateLimitConfig(config.provider, { burst_allowance: parseInt(e.target.value) })}
                        className="w-full border rounded px-2 py-1 text-sm bg-input text-foreground"
                      />
                    </div>
                  </div>

                  {/* Strategy Selection */}
                  <div>
                    <label className="text-xs text-muted-foreground">On Rate Limit</label>
                    <select
                      value={config.strategy_on_limit}
                      onChange={(e) => updateRateLimitConfig(config.provider, { strategy_on_limit: e.target.value as RateLimitStrategy })}
                      className="w-full border rounded px-2 py-1.5 text-sm bg-card"
                    >
                      <option value="queue">📥 Queue requests</option>
                      <option value="retry">🔄 Retry with backoff</option>
                      <option value="failover">↔️ Failover to other provider</option>
                      <option value="drop">❌ Drop request</option>
                    </select>
                  </div>

                  {/* Queue Info */}
                  {config.strategy_on_limit === 'queue' && status && (
                    <div className="p-2 bg-muted/50 rounded text-xs">
                      <div className="flex justify-between">
                        <span>Queue Size</span>
                        <span>{status.current_queue_size}/{config.queue_max_size}</span>
                      </div>
                      {status.queued_requests.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {status.queued_requests.slice(0, 3).map((req) => (
                            <div key={req.id} className="flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                {getFeatureIcon(req.feature)} {req.feature}
                              </span>
                              <span className="text-muted-foreground">~{req.estimated_wait_ms}ms</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Options */}
                  <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.auto_distribute}
                        onChange={(e) => updateRateLimitConfig(config.provider, { auto_distribute: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span>Auto-distribute</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Alert at</span>
                      <input
                        type="number"
                        value={config.alert_threshold_percent}
                        onChange={(e) => updateRateLimitConfig(config.provider, { alert_threshold_percent: parseInt(e.target.value) })}
                        className="w-16 border rounded px-2 py-1 text-sm bg-input text-foreground"
                      />
                      <span>%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Rate Limit Alerts */}
      {rateLimitAlerts.filter(a => !a.acknowledged).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3">🚨 Active Alerts</h3>
          <div className="space-y-2">
            {rateLimitAlerts.filter(a => !a.acknowledged).map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded border flex items-center justify-between ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵'}
                  </span>
                  <div>
                    <div className="font-medium text-sm">{alert.message}</div>
                    <div className="text-xs opacity-70">
                      {alert.provider} • {new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => acknowledgeAlert(alert.id)}
                  className="px-2 py-1 text-xs bg-card rounded hover:bg-muted"
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Events */}
      <div>
        <h3 className="text-sm font-medium mb-3">📋 Recent Rate Limit Events</h3>
        {rateLimitEvents.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground bg-muted/50 rounded-lg">
            <div className="text-2xl mb-2">⏱️</div>
            <div className="text-sm">No rate limit events yet</div>
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {rateLimitEvents.slice(0, 10).map((event) => (
              <div
                key={event.id}
                className={`flex items-center justify-between p-2 rounded border text-sm ${
                  event.event_type === 'limit_hit' ? 'bg-destructive/5 border-destructive/20' :
                  event.event_type === 'limit_cleared' ? 'bg-success/5 border-success/20' :
                  'bg-muted/50 border-border'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>
                    {event.event_type === 'limit_hit' && '🔴'}
                    {event.event_type === 'request_queued' && '📥'}
                    {event.event_type === 'request_dropped' && '❌'}
                    {event.event_type === 'failover_triggered' && '↔️'}
                    {event.event_type === 'limit_cleared' && '✅'}
                  </span>
                  <span className="font-medium capitalize">{event.event_type.replace('_', ' ')}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{event.provider}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="flex items-center gap-1">
                    {getFeatureIcon(event.feature)} {event.feature}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
