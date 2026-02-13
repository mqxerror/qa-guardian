// AIRouterPage - AI Provider Router with circuit breaker, rate limiting, and fallback (Feature #405)
// Feature #691: Migrated provider switch modal to shared Modal component
// Feature #865: Removed 8 mock sub-panels (retry, timeout, model, rate-limit, fallback, budget, cache, API keys)
//   that used hardcoded DEFAULT_* data with no backend. Kept core router config UI.
import { useState, useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { PageHeader } from "../components/ui";
import { Button } from '@/components/ui/button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';
import type {
  AIRouterConfig, RouterStats, CircuitBreakerState, ProviderSwitchLog,
  ActiveProviderState, ProviderChangeLog, ProviderSwitchResult,
} from '../components/ai-router/types';

function AIRouterPage() {
  const token = useAuthStore.getState().token;

  // Core router state
  const [config, setConfig] = useState<AIRouterConfig | null>(null);
  const [stats, setStats] = useState<RouterStats | null>(null);
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakerState[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [logs, setLogs] = useState<ProviderSwitchLog[]>([]); // Reserved for logs display panel
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Feature #1327: Provider Hot-Swap State
  const [activeProvider, setActiveProvider] = useState<ActiveProviderState | null>(null);
  const [changeLogs, setChangeLogs] = useState<ProviderChangeLog[]>([]);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchResult, setSwitchResult] = useState<ProviderSwitchResult | null>(null);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [switchReason, setSwitchReason] = useState('');
  const [gracefulSwitch, setGracefulSwitch] = useState(true);
  const [targetProvider, setTargetProvider] = useState<'kie' | 'anthropic'>('anthropic');

  // Fetch data
  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [configRes, statsRes, cbRes, logsRes, activeRes, changeLogsRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/ai/router/config`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/ai/router/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/ai/router/circuit-breaker`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/ai/router/logs?limit=20`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/ai/provider/active`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/ai/provider/change-logs?limit=10`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (configRes.ok) setConfig(await configRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (cbRes.ok) { const data = await cbRes.json(); setCircuitBreakers(data.providers || []); }
      if (logsRes.ok) { const data = await logsRes.json(); setLogs(data.logs || []); }
      if (activeRes.ok) setActiveProvider(await activeRes.json());
      if (changeLogsRes.ok) { const data = await changeLogsRes.json(); setChangeLogs(data.logs || []); }
    } catch (error) {
      console.error('Failed to fetch router data:', error);
    }
    setIsLoading(false);
  };

  const updateConfig = async (updates: Partial<AIRouterConfig>) => {
    setIsSaving(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/ai/router/config`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (response.ok) { const data = await response.json(); setConfig(data.config); }
    } catch (error) { console.error('Failed to update config:', error); }
    setIsSaving(false);
  };

  const testFailover = async (failureType: 'timeout' | 'rate_limit' | 'error') => {
    setIsTesting(true); setTestResult(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/ai/router/test-failover`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulate_failure: failureType }),
      });
      const result = await response.json(); setTestResult(result); fetchData();
    } catch (error) { setTestResult({ success: false, message: 'Test failed' }); }
    setIsTesting(false);
  };

  const resetCircuitBreaker = async (provider: string) => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/ai/router/circuit-breaker/reset`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      fetchData();
    } catch (error) { console.error('Failed to reset circuit breaker:', error); }
  };

  const hotSwapProvider = async () => {
    setIsSwitching(true); setSwitchResult(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/ai/provider/switch`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_provider: targetProvider, reason: switchReason || 'Manual switch via admin UI', graceful_switch: gracefulSwitch, drain_timeout_ms: 5000 }),
      });
      const result = await response.json(); setSwitchResult(result);
      if (result.success) { setShowSwitchModal(false); setSwitchReason(''); fetchData(); }
    } catch (error) {
      setSwitchResult({ success: false, error: 'Failed to switch provider', message: 'Network error occurred' });
    }
    setIsSwitching(false);
  };

  const openSwitchModal = (target: 'kie' | 'anthropic') => {
    setTargetProvider(target); setSwitchResult(null); setShowSwitchModal(true);
  };

  const formatNumber = (num: number) => num.toLocaleString();

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Feature #638: PageHeader component */}
      <PageHeader
        title="AI Provider Router"
        description="Route AI requests with automatic fallback"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'AI Insights', href: '/ai-insights' }, { label: 'AI Router' }]}
      />

      {/* Provider Flow Diagram */}
      <div className="mb-6 bg-gradient-to-r from-accent via-accent to-primary rounded-lg p-6 text-primary-foreground">
        <h2 className="text-lg font-bold mb-4">Request Flow</h2>
        <div className="flex items-center justify-center gap-4">
          <div className="bg-white/20 rounded-lg p-4 text-center"><div className="text-2xl mb-1">📨</div><div className="font-medium">Request</div></div>
          <div className="text-2xl">→</div>
          <div className={`rounded-lg p-4 text-center ${config?.primary_provider === 'kie' ? 'bg-success/50 ring-2 ring-white' : 'bg-white/20'}`}>
            <div className="text-2xl mb-1">🤖</div><div className="font-medium">Kie.ai</div><div className="text-xs opacity-70">Primary</div>
          </div>
          <div className="text-xl">⚡</div>
          <div className={`rounded-lg p-4 text-center ${config?.fallback_provider === 'anthropic' ? 'bg-warning/50' : 'bg-white/20'}`}>
            <div className="text-2xl mb-1">🔵</div><div className="font-medium">Anthropic</div><div className="text-xs opacity-70">Fallback</div>
          </div>
          <div className="text-2xl">→</div>
          <div className="bg-white/20 rounded-lg p-4 text-center"><div className="text-2xl mb-1">✅</div><div className="font-medium">Response</div></div>
        </div>
      </div>

      {/* Feature #1327: Hot-Swap Provider Section */}
      <div className="mb-6 bg-card rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span>⚡</span> Hot-Swap Provider
              <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded">No Restart Required</span>
            </h2>
            <p className="text-sm text-foreground">Switch between AI providers instantly without service interruption</p>
          </div>
          {activeProvider?.switching && (
            <div className="flex items-center gap-2 text-warning animate-pulse">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-warning border-t-transparent"></div>
              <span>Switching...</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Kie.ai Provider Card */}
          <div className={`border-2 rounded-lg p-4 transition-all ${activeProvider?.current_provider === 'kie' ? 'border-success bg-success/5' : 'border-border hover:border-primary/30'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="text-3xl">🤖</span>
                  <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-card ${activeProvider?.available_providers?.find(p => p.id === 'kie')?.configured ? 'bg-success' : 'bg-warning'}`}></span>
                </div>
                <div><div className="font-semibold text-lg">Kie.ai</div><div className="text-sm text-success font-medium">70% cost savings</div></div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {activeProvider?.current_provider === 'kie' ? (
                  <span className="px-3 py-1 bg-success text-primary-foreground text-xs rounded-full font-medium flex items-center gap-1"><span className="w-2 h-2 bg-card rounded-full animate-pulse"></span> ACTIVE</span>
                ) : (
                  <Button onClick={() => openSwitchModal('kie')} disabled={isSwitching || activeProvider?.switching} size="sm">Switch to Kie.ai</Button>
                )}
              </div>
            </div>
          </div>
          {/* Anthropic Direct Card */}
          <div className={`border-2 rounded-lg p-4 transition-all ${activeProvider?.current_provider === 'anthropic' ? 'border-success bg-success/5' : 'border-border hover:border-primary/30'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="text-3xl">🔵</span>
                  <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-card ${activeProvider?.available_providers?.find(p => p.id === 'anthropic')?.configured ? 'bg-success' : 'bg-warning'}`}></span>
                </div>
                <div><div className="font-semibold text-lg">Anthropic Direct</div><div className="text-sm text-primary font-medium">Direct API access</div></div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {activeProvider?.current_provider === 'anthropic' ? (
                  <span className="px-3 py-1 bg-success text-primary-foreground text-xs rounded-full font-medium flex items-center gap-1"><span className="w-2 h-2 bg-card rounded-full animate-pulse"></span> ACTIVE</span>
                ) : (
                  <Button onClick={() => openSwitchModal('anthropic')} disabled={isSwitching || activeProvider?.switching} size="sm">Switch to Anthropic</Button>
                )}
              </div>
            </div>
          </div>
        </div>
        {activeProvider?.last_switch && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
            <div className="flex items-center gap-2 text-foreground">
              <span>Last switch: {activeProvider.last_switch.from} → {activeProvider.last_switch.to}</span>
              <span className="text-muted-foreground">|</span>
              <span>By: {activeProvider.last_switch.switched_by}</span>
              <span className="text-muted-foreground">|</span>
              <span>{new Date(activeProvider.last_switch.switched_at).toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Provider Switch Modal - Feature #691: Using shared Modal component */}
      <Modal isOpen={showSwitchModal} onClose={() => setShowSwitchModal(false)} title="Switch Provider" size="md">
        <ModalHeader onClose={() => setShowSwitchModal(false)}>
          <span className="flex items-center gap-2"><span>⚡</span> Switch Provider</span>
        </ModalHeader>
        <ModalBody>
          <div className="mb-4 p-3 bg-primary/5 rounded-lg">
            <div className="text-sm text-primary"><strong>Current:</strong> {activeProvider?.current_provider === 'kie' ? 'Kie.ai' : 'Anthropic Direct'}</div>
            <div className="text-sm text-primary"><strong>Target:</strong> {targetProvider === 'kie' ? 'Kie.ai' : 'Anthropic Direct'}</div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-1">Reason for switch</label>
            <input type="text" value={switchReason} onChange={(e) => setSwitchReason(e.target.value)} placeholder="e.g., Cost optimization, performance testing..." className="w-full border rounded-lg p-2 text-sm bg-input text-foreground" />
          </div>
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={gracefulSwitch} onChange={(e) => setGracefulSwitch(e.target.checked)} className="rounded" />
              <div><div className="text-sm font-medium">Graceful switch</div><div className="text-xs text-muted-foreground">Wait for pending requests to complete (recommended)</div></div>
            </label>
          </div>
          {switchResult && (
            <div className={`p-3 rounded-lg ${switchResult.success ? 'bg-success/5 border border-success/20' : 'bg-destructive/5 border border-destructive/20'}`}>
              <div className="font-medium text-sm">{switchResult.success ? 'Switch successful!' : 'Switch failed'}</div>
              <div className="text-xs mt-1">{switchResult.message}</div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowSwitchModal(false)} disabled={isSwitching}>Cancel</Button>
          <Button onClick={hotSwapProvider} disabled={isSwitching} className="flex items-center gap-2">
            {isSwitching && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>}
            {isSwitching ? 'Switching...' : 'Switch Provider'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="bg-card rounded-lg shadow p-3 text-center"><div className="text-2xl font-bold text-primary">{formatNumber(stats.total_requests)}</div><div className="text-xs text-foreground">Total Requests</div></div>
          <div className="bg-card rounded-lg shadow p-3 text-center"><div className="text-2xl font-bold text-success">{stats.primary_success_rate}%</div><div className="text-xs text-foreground">Primary Success</div></div>
          <div className="bg-card rounded-lg shadow p-3 text-center"><div className="text-2xl font-bold text-warning">{formatNumber(stats.fallback_requests)}</div><div className="text-xs text-foreground">Fallbacks</div></div>
          <div className="bg-card rounded-lg shadow p-3 text-center"><div className="text-2xl font-bold text-accent">{stats.fallback_success_rate}%</div><div className="text-xs text-foreground">Fallback Success</div></div>
          <div className="bg-card rounded-lg shadow p-3 text-center"><div className="text-2xl font-bold text-info">{stats.avg_latency_ms}ms</div><div className="text-xs text-foreground">Avg Latency</div></div>
          <div className="bg-card rounded-lg shadow p-3 text-center"><div className="text-2xl font-bold text-destructive">{stats.errors}</div><div className="text-xs text-foreground">Errors</div></div>
        </div>
      )}

      {/* Router Config, Circuit Breakers, and Test Failover */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Configuration */}
        <div className="bg-card rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Router Configuration</h2>
          {config && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Router Enabled</span>
                <button onClick={() => updateConfig({ enabled: !config.enabled })} disabled={isSaving} className={`w-12 h-6 rounded-full transition-colors ${config.enabled ? 'bg-success' : 'bg-muted'}`} aria-label="Toggle router enabled">
                  <div className={`w-5 h-5 bg-card rounded-full shadow transform transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div>
                <label className="text-sm text-foreground">Primary Provider</label>
                <select value={config.primary_provider} onChange={(e) => updateConfig({ primary_provider: e.target.value as 'kie' | 'anthropic' })} disabled={isSaving} className="mt-1 w-full border rounded p-2 bg-input text-foreground">
                  <option value="kie">Kie.ai (70% savings)</option><option value="anthropic">Anthropic Direct</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-foreground">Fallback Provider</label>
                <select value={config.fallback_provider} onChange={(e) => updateConfig({ fallback_provider: e.target.value as 'anthropic' | 'kie' | 'none' })} disabled={isSaving} className="mt-1 w-full border rounded p-2 bg-input text-foreground">
                  <option value="anthropic">Anthropic Direct</option><option value="kie">Kie.ai</option><option value="none">None (fail on error)</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-foreground">Timeout (ms)</label>
                <input type="number" value={config.timeout_ms} onChange={(e) => updateConfig({ timeout_ms: parseInt(e.target.value) })} disabled={isSaving} className="mt-1 w-full border rounded p-2 bg-input text-foreground" />
              </div>
              <div className="border-t pt-3">
                <div className="text-sm font-medium mb-2">Fallback Triggers</div>
                {(['on_timeout', 'on_rate_limit', 'on_error', 'on_server_error'] as const).map((key) => (
                  <label key={key} className="flex items-center gap-2 text-sm mb-1">
                    <input type="checkbox" checked={config.fallback_conditions[key]} onChange={(e) => updateConfig({ fallback_conditions: { ...config.fallback_conditions, [key]: e.target.checked } })} disabled={isSaving} />
                    {key.replace('on_', '').replace('_', ' ')}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Circuit Breakers */}
        <div className="bg-card rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Circuit Breakers</h2>
          {circuitBreakers.map((cb) => (
            <div key={cb.provider} className={`mb-4 p-3 rounded-lg border ${cb.state === 'closed' ? 'border-success/20 bg-success/5' : cb.state === 'open' ? 'border-destructive/20 bg-destructive/5' : 'border-warning/20 bg-warning/5'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium capitalize">{cb.provider}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${cb.state === 'closed' ? 'bg-success/20 text-success' : cb.state === 'open' ? 'bg-destructive/20 text-destructive' : 'bg-warning/20 text-warning'}`}>{cb.state}</span>
              </div>
              <div className="text-sm text-foreground">
                <div>Failures: {cb.failure_count}</div>
                {cb.recovery_at && <div>Recovers: {new Date(cb.recovery_at).toLocaleTimeString()}</div>}
              </div>
              {cb.state !== 'closed' && (
                <Button variant="ghost" size="sm" onClick={() => resetCircuitBreaker(cb.provider)} className="mt-2 text-xs bg-primary/10 text-primary hover:bg-primary/20">Reset</Button>
              )}
            </div>
          ))}
          {config?.circuit_breaker && (
            <div className="mt-4 border-t pt-3">
              <div className="text-sm">
                <div className="flex justify-between mb-1"><span className="text-foreground">CB Enabled:</span><span>{config.circuit_breaker.enabled ? 'Yes' : 'No'}</span></div>
                <div className="flex justify-between mb-1"><span className="text-foreground">Threshold:</span><span>{config.circuit_breaker.failure_threshold} failures</span></div>
                <div className="flex justify-between"><span className="text-foreground">Recovery:</span><span>{config.circuit_breaker.recovery_time_ms / 1000}s</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Test Failover */}
        <div className="bg-card rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Test Failover</h2>
          <div className="space-y-2 mb-4">
            <Button variant="outline" onClick={() => testFailover('timeout')} disabled={isTesting} className="w-full bg-warning/10 text-warning border-warning/20 hover:bg-warning/20">Test Timeout Failover</Button>
            <Button variant="outline" onClick={() => testFailover('rate_limit')} disabled={isTesting} className="w-full bg-accent/10 text-accent border-accent/20 hover:bg-accent/20">Test Rate Limit Failover</Button>
            <Button variant="destructive" onClick={() => testFailover('error')} disabled={isTesting} className="w-full bg-destructive/10 text-destructive hover:bg-destructive/20">Test Error Failover</Button>
          </div>
          {testResult && (
            <div className={`p-3 rounded ${testResult.success ? 'bg-success/5 border border-success/20' : 'bg-destructive/5 border border-destructive/20'}`}>
              <div className="font-medium mb-1">{testResult.success ? 'Test Passed' : 'Test Failed'}</div>
              <div className="text-sm text-foreground">{testResult.message}</div>
              {testResult.total_latency_ms && <div className="text-xs text-muted-foreground mt-1">Latency: {testResult.total_latency_ms}ms</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { AIRouterPage };
