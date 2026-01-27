// ============================================================================
// FEATURE #1324: Provider Health Monitoring
// Extracted from App.tsx for code quality compliance (Feature #1357)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Types
interface ProviderHealthMetrics {
  provider: 'kie' | 'anthropic';
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  availability_percent: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  error_rate_percent: number;
  request_count_1h: number;
  request_count_24h: number;
  last_success: string | null;
  last_failure: string | null;
  last_check: string;
  uptime_percent_24h: number;
  errors_by_type: {
    timeout: number;
    rate_limit: number;
    server_error: number;
    network_error: number;
    auth_error: number;
    other: number;
  };
}

interface HealthAlert {
  id: string;
  provider: 'kie' | 'anthropic';
  alert_type: 'degradation' | 'outage' | 'recovery' | 'latency_spike' | 'error_rate_high';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggered_at: string;
  resolved_at: string | null;
  acknowledged: boolean;
  acknowledged_by?: string;
  threshold_value?: number;
  actual_value?: number;
}

interface HealthAlertConfig {
  org_id: string;
  enabled: boolean;
  thresholds: {
    latency_warning_ms: number;
    latency_critical_ms: number;
    error_rate_warning_percent: number;
    error_rate_critical_percent: number;
    availability_warning_percent: number;
    availability_critical_percent: number;
  };
  notification_channels: {
    email: boolean;
    slack: boolean;
    webhook: boolean;
  };
  cooldown_minutes: number;
}

export function ProviderHealthPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // State
  const [overallStatus, setOverallStatus] = useState<string>('loading');
  const [providers, setProviders] = useState<ProviderHealthMetrics[]>([]);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [alertConfig, setAlertConfig] = useState<HealthAlertConfig | null>(null);
  const [latencyTrend, setLatencyTrend] = useState<Array<{ timestamp: string; kie_latency: number; anthropic_latency: number }>>([]);
  const [errorDist, setErrorDist] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<'all' | 'kie' | 'anthropic'>('all');
  const [isRunningCheck, setIsRunningCheck] = useState<string | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Fetch all data
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [healthRes, alertsRes, configRes, trendRes, errorRes] = await Promise.all([
        fetch('http://localhost:3000/api/v1/ai/health', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('http://localhost:3000/api/v1/ai/health/alerts', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('http://localhost:3000/api/v1/ai/health/alerts/config', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('http://localhost:3000/api/v1/ai/health/latency-trend?hours=24', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('http://localhost:3000/api/v1/ai/health/error-distribution', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (healthRes.ok) {
        const data = await healthRes.json();
        setOverallStatus(data.overall_status);
        setProviders(data.providers || []);
      }
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        setAlerts(data.alerts || []);
      }
      if (configRes.ok) {
        const data = await configRes.json();
        setAlertConfig(data);
      }
      if (trendRes.ok) {
        const data = await trendRes.json();
        setLatencyTrend(data.trend || []);
      }
      if (errorRes.ok) {
        const data = await errorRes.json();
        setErrorDist(data);
      }
    } catch (error) {
      console.error('Failed to fetch health data:', error);
    }
    setIsLoading(false);
  };

  // Run manual health check
  const runHealthCheck = async (provider: 'kie' | 'anthropic') => {
    setIsRunningCheck(provider);
    try {
      const response = await fetch(`http://localhost:3000/api/v1/ai/health/${provider}/check`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        await fetchData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to run health check:', error);
    }
    setIsRunningCheck(null);
  };

  // Acknowledge alert
  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`http://localhost:3000/api/v1/ai/health/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  // Update alert config
  const updateAlertConfig = async (updates: Partial<HealthAlertConfig>) => {
    setIsSavingConfig(true);
    try {
      const response = await fetch('http://localhost:3000/api/v1/ai/health/alerts/config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        const data = await response.json();
        setAlertConfig(data.config);
      }
    } catch (error) {
      console.error('Failed to update config:', error);
    }
    setIsSavingConfig(false);
  };

  // Get status color and icon
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'operational':
        return { color: 'bg-green-500', icon: '✅', text: 'text-green-600', bg: 'bg-green-50' };
      case 'degraded':
      case 'warning':
        return { color: 'bg-yellow-500', icon: '⚠️', text: 'text-yellow-600', bg: 'bg-yellow-50' };
      case 'unhealthy':
      case 'critical':
        return { color: 'bg-red-500', icon: '❌', text: 'text-red-600', bg: 'bg-red-50' };
      default:
        return { color: 'bg-gray-400', icon: '❓', text: 'text-gray-600', bg: 'bg-gray-50' };
    }
  };

  // Get provider icon
  const getProviderIcon = (provider: string) => {
    return provider === 'kie' ? '🤖' : '🔵';
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
        <h1 className="text-3xl font-bold">🏥 Provider Health Monitoring</h1>
        <p className="text-gray-600 mt-2">
          Monitor AI provider availability, latency, and error rates in real-time
        </p>
      </div>

      {/* Overall Status Banner */}
      <div className={`rounded-xl p-6 mb-8 ${getStatusDisplay(overallStatus).bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full ${getStatusDisplay(overallStatus).color} animate-pulse`}></div>
            <div>
              <div className={`text-xl font-bold ${getStatusDisplay(overallStatus).text}`}>
                {overallStatus === 'operational' ? 'All Systems Operational' :
                 overallStatus === 'warning' ? 'Partial Degradation' :
                 overallStatus === 'degraded' ? 'Service Degraded' :
                 overallStatus === 'critical' ? 'Major Outage' : 'Loading...'}
              </div>
              <div className="text-sm text-gray-600">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {providers.map((provider) => (
          <div key={provider.provider} className="bg-white rounded-xl border p-6 shadow-sm">
            {/* Provider Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getProviderIcon(provider.provider)}</span>
                <div>
                  <h3 className="text-xl font-bold">
                    {provider.provider === 'kie' ? 'Kie.ai' : 'Anthropic'}
                  </h3>
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm ${getStatusDisplay(provider.status).bg} ${getStatusDisplay(provider.status).text}`}>
                    {getStatusDisplay(provider.status).icon} {provider.status.charAt(0).toUpperCase() + provider.status.slice(1)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => runHealthCheck(provider.provider)}
                disabled={isRunningCheck === provider.provider}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isRunningCheck === provider.provider ? '⏳ Checking...' : '🔍 Run Check'}
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{provider.availability_percent}%</div>
                <div className="text-xs text-gray-500">Availability (1h)</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{provider.avg_latency_ms}ms</div>
                <div className="text-xs text-gray-500">Avg Latency</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{provider.error_rate_percent}%</div>
                <div className="text-xs text-gray-500">Error Rate</div>
              </div>
            </div>

            {/* Additional Metrics */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">P95 Latency</span>
                <span className="font-medium">{provider.p95_latency_ms}ms</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">P99 Latency</span>
                <span className="font-medium">{provider.p99_latency_ms}ms</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Requests (1h)</span>
                <span className="font-medium">{provider.request_count_1h}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Requests (24h)</span>
                <span className="font-medium">{provider.request_count_24h}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">24h Uptime</span>
                <span className="font-medium">{provider.uptime_percent_24h}%</span>
              </div>
            </div>

            {/* Error Breakdown */}
            {provider.errors_by_type && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-sm font-medium text-gray-700 mb-2">Error Breakdown</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Timeout:</span>
                    <span>{provider.errors_by_type.timeout}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Rate Limit:</span>
                    <span>{provider.errors_by_type.rate_limit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Server:</span>
                    <span>{provider.errors_by_type.server_error}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Network:</span>
                    <span>{provider.errors_by_type.network_error}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Auth:</span>
                    <span>{provider.errors_by_type.auth_error}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Other:</span>
                    <span>{provider.errors_by_type.other}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Last Events */}
            <div className="mt-4 pt-4 border-t text-xs text-gray-500">
              {provider.last_success && (
                <div>Last Success: {new Date(provider.last_success).toLocaleString()}</div>
              )}
              {provider.last_failure && (
                <div>Last Failure: {new Date(provider.last_failure).toLocaleString()}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Latency Trend Chart */}
      <div className="bg-white rounded-xl border p-6 shadow-sm mb-8">
        <h2 className="text-xl font-bold mb-4">📈 Latency Trend (24h)</h2>
        <div className="h-64 flex items-end gap-1">
          {latencyTrend.slice(-24).map((point, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col gap-0.5">
                <div
                  className="w-full bg-blue-400 rounded-t transition-all"
                  style={{ height: `${Math.min(point.kie_latency / 4, 100)}px` }}
                  title={`Kie.ai: ${point.kie_latency}ms`}
                ></div>
                <div
                  className="w-full bg-purple-400 rounded-b transition-all"
                  style={{ height: `${Math.min(point.anthropic_latency / 4, 100)}px` }}
                  title={`Anthropic: ${point.anthropic_latency}ms`}
                ></div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-400 rounded"></div>
            <span>Kie.ai</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-400 rounded"></div>
            <span>Anthropic</span>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Active Alerts */}
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4">🔔 Health Alerts</h2>
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">✅</div>
              <div>No active alerts</div>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border ${
                    alert.severity === 'critical' ? 'border-red-200 bg-red-50' :
                    alert.severity === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                    'border-blue-200 bg-blue-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">
                        {alert.severity === 'critical' ? '🚨' :
                         alert.severity === 'warning' ? '⚠️' : 'ℹ️'}
                      </span>
                      <div>
                        <div className="font-medium">{alert.message}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {getProviderIcon(alert.provider)} {alert.provider === 'kie' ? 'Kie.ai' : 'Anthropic'} •
                          {new Date(alert.triggered_at).toLocaleString()}
                        </div>
                        {alert.resolved_at && (
                          <div className="text-xs text-green-600 mt-1">
                            ✅ Resolved: {new Date(alert.resolved_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                    {!alert.acknowledged && !alert.resolved_at && (
                      <button
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="text-xs px-2 py-1 bg-white border rounded hover:bg-gray-50"
                      >
                        Acknowledge
                      </button>
                    )}
                    {alert.acknowledged && (
                      <span className="text-xs text-green-600">✓ Ack</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alert Configuration */}
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4">⚙️ Alert Thresholds</h2>
          {alertConfig && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Alerts Enabled</span>
                <button
                  onClick={() => updateAlertConfig({ enabled: !alertConfig.enabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    alertConfig.enabled ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      alertConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="text-sm font-medium text-gray-700">Latency Thresholds</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Warning (ms)</label>
                    <input
                      type="number"
                      value={alertConfig.thresholds.latency_warning_ms}
                      onChange={(e) => updateAlertConfig({
                        thresholds: { ...alertConfig.thresholds, latency_warning_ms: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Critical (ms)</label>
                    <input
                      type="number"
                      value={alertConfig.thresholds.latency_critical_ms}
                      onChange={(e) => updateAlertConfig({
                        thresholds: { ...alertConfig.thresholds, latency_critical_ms: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="text-sm font-medium text-gray-700">Error Rate Thresholds (%)</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Warning</label>
                    <input
                      type="number"
                      value={alertConfig.thresholds.error_rate_warning_percent}
                      onChange={(e) => updateAlertConfig({
                        thresholds: { ...alertConfig.thresholds, error_rate_warning_percent: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Critical</label>
                    <input
                      type="number"
                      value={alertConfig.thresholds.error_rate_critical_percent}
                      onChange={(e) => updateAlertConfig({
                        thresholds: { ...alertConfig.thresholds, error_rate_critical_percent: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="text-sm font-medium text-gray-700">Notification Channels</div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={alertConfig.notification_channels.email}
                      onChange={(e) => updateAlertConfig({
                        notification_channels: { ...alertConfig.notification_channels, email: e.target.checked }
                      })}
                      className="rounded"
                    />
                    📧 Email
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={alertConfig.notification_channels.slack}
                      onChange={(e) => updateAlertConfig({
                        notification_channels: { ...alertConfig.notification_channels, slack: e.target.checked }
                      })}
                      className="rounded"
                    />
                    💬 Slack
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={alertConfig.notification_channels.webhook}
                      onChange={(e) => updateAlertConfig({
                        notification_channels: { ...alertConfig.notification_channels, webhook: e.target.checked }
                      })}
                      className="rounded"
                    />
                    🔗 Webhook
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Distribution */}
      {errorDist && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4">📊 Error Distribution (24h)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Kie.ai Errors */}
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                🤖 Kie.ai ({errorDist.kie?.total || 0} total)
              </h3>
              <div className="space-y-2">
                {Object.entries(errorDist.kie || {}).filter(([key]) => key !== 'total').map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className="w-24 text-sm text-gray-500 capitalize">{type.replace('_', ' ')}</div>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${errorDist.kie?.total ? ((count as number) / errorDist.kie.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <div className="w-8 text-sm text-right">{count as number}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Anthropic Errors */}
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                🔵 Anthropic ({errorDist.anthropic?.total || 0} total)
              </h3>
              <div className="space-y-2">
                {Object.entries(errorDist.anthropic || {}).filter(([key]) => key !== 'total').map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className="w-24 text-sm text-gray-500 capitalize">{type.replace('_', ' ')}</div>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 transition-all"
                        style={{ width: `${errorDist.anthropic?.total ? ((count as number) / errorDist.anthropic.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <div className="w-8 text-sm text-right">{count as number}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
