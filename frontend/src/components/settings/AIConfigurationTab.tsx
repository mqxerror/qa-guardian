// AIConfigurationTab - AI provider config
// Feature #451: Extracted from SettingsPage.tsx
// Feature #2074: AI Model Selection for Different Tasks
// T1.5: DB-backed API credential management (Kie.ai + Anthropic)

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import {
  useAIModelPreferencesStore,
  PROVIDERS,
  MODELS,
  TASK_TYPES,
  getModelsForProvider,
  type AIProvider,
  type AIModel,
} from '../../stores/aiModelPreferencesStore';
import { toast } from '../../stores/toastStore';
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle, Trash2 } from 'lucide-react';

// -------------------------------------------------------------
// T1.5: Types matching /api/v1/ai/providers response
// -------------------------------------------------------------
interface SupportedProvider { name: string; label: string; defaultModel?: string }
interface ProviderConfig {
  provider: string;
  apiKeyMasked: string;
  apiBaseUrl: string | null;
  defaultModel: string | null;
  lastTestedAt: string | null;
  lastTestSuccess: boolean | null;
  lastTestError: string | null;
  updatedAt: string;
}
interface ProvidersResponse {
  supported: SupportedProvider[];
  configs: ProviderConfig[];
  routerState: { primary: string; fallback: string; kieInitialized: boolean; anthropicInitialized: boolean };
}

export function AIConfigurationTab() {
  const {
    preferences,
    defaultProvider,
    defaultModel,
    setTaskPreference,
    setDefaultProvider,
    setDefaultModel,
    resetToDefaults,
  } = useAIModelPreferencesStore();

  const [aiStatus, setAiStatus] = useState<{
    kie: { available: boolean; model?: string };
    anthropic: { available: boolean; model?: string };
  } | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const { token } = useAuthStore();

  // Fetch AI provider status
  useEffect(() => {
    const fetchAIStatus = async () => {
      try {
        const response = await fetch('/api/v1/mcp/status', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setAiStatus({
            kie: { available: data.kie_available ?? false, model: data.kie_model },
            anthropic: { available: data.anthropic_available ?? false, model: data.anthropic_model },
          });
        }
      } catch (err) {
        console.error('Failed to fetch AI status:', err);
      } finally {
        setIsLoadingStatus(false);
      }
    };
    fetchAIStatus();
  }, [token]);

  const getCostBadge = (cost: 'low' | 'medium' | 'high') => {
    switch (cost) {
      case 'low': return 'bg-success/10 text-success';
      case 'medium': return 'bg-warning/10 text-warning';
      case 'high': return 'bg-destructive/10 text-destructive';
    }
  };

  const getSpeedBadge = (speed: 'fast' | 'medium' | 'slow') => {
    switch (speed) {
      case 'fast': return 'bg-primary/10 text-primary';
      case 'medium': return 'bg-accent/10 text-accent';
      case 'slow': return 'bg-muted text-foreground';
    }
  };

  return (
    <div className="space-y-8">
      {/* T1.5: API Credentials — the section that was missing. Without this
           block, admins had to SSH to the server and edit .env by hand. */}
      <APICredentialsSection token={token} />

      {/* AI Provider Status */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">AI Provider Status</h3>
          <p className="text-sm text-muted-foreground">Current availability of AI providers.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Kie.ai Status */}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${aiStatus?.kie.available ? 'bg-success' : 'bg-destructive'}`}></span>
                <h4 className="font-medium text-foreground">Kie.ai</h4>
              </div>
              <span className="px-2 py-1 rounded text-xs bg-success/10 text-success">
                70% Savings
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {isLoadingStatus ? 'Checking...' : aiStatus?.kie.available ? 'Connected and ready' : 'Not configured'}
            </p>
            {aiStatus?.kie.model && (
              <p className="text-xs text-muted-foreground">Model: {aiStatus.kie.model}</p>
            )}
          </div>

          {/* Anthropic Status */}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${aiStatus?.anthropic.available ? 'bg-success' : 'bg-destructive'}`}></span>
                <h4 className="font-medium text-foreground">Anthropic (Direct)</h4>
              </div>
              <span className="px-2 py-1 rounded text-xs bg-primary/10 text-primary">
                Fallback
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {isLoadingStatus ? 'Checking...' : aiStatus?.anthropic.available ? 'Connected and ready' : 'Not configured'}
            </p>
            {aiStatus?.anthropic.model && (
              <p className="text-xs text-muted-foreground">Model: {aiStatus.anthropic.model}</p>
            )}
          </div>
        </div>
      </div>

      {/* Default Settings */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Default AI Settings</h3>
          <p className="text-sm text-muted-foreground">These settings are used when a task is set to "Auto".</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Default Provider</label>
              <select
                value={defaultProvider}
                onChange={(e) => setDefaultProvider(e.target.value as AIProvider)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              >
                {PROVIDERS.filter(p => p.id !== 'auto').map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {PROVIDERS.find(p => p.id === defaultProvider)?.description}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Default Model</label>
              <select
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value as AIModel)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              >
                {getModelsForProvider(defaultProvider).filter(m => m.id !== 'auto').map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {MODELS.find(m => m.id === defaultModel)?.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Task-Specific Settings */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Task-Specific Model Selection</h3>
            <p className="text-sm text-muted-foreground">Choose which AI model to use for different tasks.</p>
          </div>
          <button
            onClick={resetToDefaults}
            className="text-sm text-primary hover:underline"
          >
            Reset to defaults
          </button>
        </div>

        <div className="space-y-4">
          {TASK_TYPES.map(taskType => {
            const pref = preferences[taskType.id];
            const availableModels = pref.provider === 'auto'
              ? MODELS
              : getModelsForProvider(pref.provider);

            return (
              <div key={taskType.id} className="bg-card rounded-lg border border-border p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Task Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground">{taskType.name}</h4>
                      {pref.provider === 'auto' && pref.model === 'auto' && (
                        <span className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">
                          Auto
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{taskType.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Recommended: {MODELS.find(m => m.id === taskType.recommendedModel)?.name} via {PROVIDERS.find(p => p.id === taskType.recommendedProvider)?.name}
                    </p>
                  </div>

                  {/* Provider Selector */}
                  <div className="w-full lg:w-48">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Provider</label>
                    <select
                      value={pref.provider}
                      onChange={(e) => setTaskPreference(taskType.id, {
                        ...pref,
                        provider: e.target.value as AIProvider,
                        // Reset model to auto when changing provider
                        model: 'auto',
                      })}
                      className="w-full px-2 py-1.5 border border-border rounded-md bg-background text-foreground text-sm"
                    >
                      {PROVIDERS.map(provider => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Model Selector */}
                  <div className="w-full lg:w-56">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Model</label>
                    <select
                      value={pref.model}
                      onChange={(e) => setTaskPreference(taskType.id, {
                        ...pref,
                        model: e.target.value as AIModel,
                      })}
                      className="w-full px-2 py-1.5 border border-border rounded-md bg-background text-foreground text-sm"
                    >
                      {availableModels.map(model => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Model Info (when not auto) */}
                {pref.model !== 'auto' && (
                  <div className="mt-3 pt-3 border-t border-border">
                    {(() => {
                      const modelInfo = MODELS.find(m => m.id === pref.model);
                      if (!modelInfo) return null;
                      return (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${getCostBadge(modelInfo.costIndicator)}`}>
                            {modelInfo.costIndicator === 'low' ? '$' : modelInfo.costIndicator === 'medium' ? '$$' : '$$$'} Cost
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs ${getSpeedBadge(modelInfo.speedIndicator)}`}>
                            {modelInfo.speedIndicator.charAt(0).toUpperCase() + modelInfo.speedIndicator.slice(1)} Speed
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {modelInfo.capabilities.slice(0, 3).join(', ')}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Model Reference */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Available Models</h3>
          <p className="text-sm text-muted-foreground">Reference guide for all available AI models.</p>
        </div>
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Model</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Providers</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Cost</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Speed</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Capabilities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {MODELS.filter(m => m.id !== 'auto').map(model => (
                <tr key={model.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{model.name}</div>
                    <div className="text-xs text-muted-foreground">{model.description}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {model.providers.filter(p => p !== 'auto').map(provider => (
                        <span key={provider} className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground capitalize">
                          {provider}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${getCostBadge(model.costIndicator)}`}>
                      {model.costIndicator === 'low' ? 'Low' : model.costIndicator === 'medium' ? 'Medium' : 'High'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${getSpeedBadge(model.speedIndicator)}`}>
                      {model.speedIndicator.charAt(0).toUpperCase() + model.speedIndicator.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="text-xs text-muted-foreground">
                      {model.capabilities.join(', ')}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// T1.5: API Credentials Section
// -----------------------------------------------------------------
// Wraps GET/PATCH/POST/DELETE /api/v1/ai/providers into a UI the user
// can actually operate. Each supported provider renders as a card with:
//   - masked key display + edit mode
//   - "Show/Hide" toggle on the input during entry
//   - "Test connection" button that pings the provider via the backend
//   - "Save" button that PATCHes and hot-reloads the router
//   - "Remove" button that soft-deletes
// =================================================================
function APICredentialsSection({ token }: { token: string | null }) {
  const [data, setData] = useState<ProvidersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/ai/providers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ProvidersResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load provider configs');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">API Credentials</h3>
        <p className="text-sm text-muted-foreground">
          Paste your Kie.ai and Anthropic keys here. Keys are encrypted at rest and applied without a restart.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="p-6 bg-card rounded-lg border border-border text-center text-muted-foreground">
          <Loader2 className="inline-block mr-2 h-4 w-4 animate-spin" />
          Loading credentials…
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4">
            {data.supported.map(p => {
              const existing = data.configs.find(c => c.provider === p.name);
              const routerInit = p.name === 'kie'
                ? data.routerState.kieInitialized
                : p.name === 'anthropic' ? data.routerState.anthropicInitialized : false;
              return (
                <ProviderCard
                  key={p.name}
                  supported={p}
                  existing={existing}
                  token={token}
                  routerInitialized={routerInit}
                  onChanged={fetchConfigs}
                />
              );
            })}
          </div>

          <div className="text-xs text-muted-foreground">
            Router: <span className="font-mono">{data.routerState.primary}</span> →
            fallback <span className="font-mono">{data.routerState.fallback}</span>
            {' · '}
            Kie: {data.routerState.kieInitialized ? '✓' : '✗'}
            {' · '}
            Anthropic: {data.routerState.anthropicInitialized ? '✓' : '✗'}
          </div>
        </>
      )}
    </div>
  );
}

function ProviderCard({
  supported,
  existing,
  token,
  routerInitialized,
  onChanged,
}: {
  supported: SupportedProvider;
  existing: ProviderConfig | undefined;
  token: string | null;
  routerInitialized: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [modelInput, setModelInput] = useState(existing?.defaultModel || supported.defaultModel || '');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const statusDot = routerInitialized
    ? <span className="w-2.5 h-2.5 rounded-full bg-success inline-block" />
    : existing
      ? <span className="w-2.5 h-2.5 rounded-full bg-warning inline-block" />
      : <span className="w-2.5 h-2.5 rounded-full bg-destructive inline-block" />;

  const handleSave = async () => {
    if (!token || keyInput.trim().length < 10) {
      toast.error('API key must be at least 10 characters');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/ai/providers/${supported.name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          apiKey: keyInput.trim(),
          defaultModel: modelInput.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
      toast.success(body.routerApplied
        ? `${supported.label} saved — router updated live`
        : `${supported.label} saved (router couldn't apply: ${body.routerReason || 'unknown'})`);
      setEditing(false);
      setKeyInput('');
      setTestResult(null);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!token) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/v1/ai/providers/${supported.name}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      const success = !!body.success;
      setTestResult({
        success,
        message: body.message || (success ? 'OK' : 'Test failed'),
      });
      if (success) toast.success(`${supported.label}: ${body.message || 'Connected'}`);
      else toast.error(`${supported.label}: ${body.message || 'Test failed'}`);
      onChanged();
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    if (!token) return;
    if (!confirm(`Remove the saved ${supported.label} key? The router will stop using it on next restart.`)) return;
    try {
      const res = await fetch(`/api/v1/ai/providers/${supported.name}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`${supported.label} key removed`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Remove failed');
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {statusDot}
            <h4 className="font-medium text-foreground">{supported.label}</h4>
            {routerInitialized && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-success/10 text-success">Active</span>
            )}
            {existing && !routerInitialized && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning">Saved, not loaded</span>
            )}
            {!existing && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">Not configured</span>
            )}
          </div>
          {existing && (
            <p className="text-xs text-muted-foreground mt-1 font-mono">{existing.apiKeyMasked}</p>
          )}
          {existing?.lastTestedAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Last tested {new Date(existing.lastTestedAt).toLocaleString()}
              {existing.lastTestSuccess === true && ' — OK'}
              {existing.lastTestSuccess === false && (existing.lastTestError ? ` — ${existing.lastTestError}` : ' — failed')}
            </p>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder={`Paste ${supported.label} API key`}
                className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-background text-foreground font-mono text-sm"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Default Model (optional)</label>
            <input
              type="text"
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              placeholder={supported.defaultModel}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setKeyInput(''); }}
              className="px-3 py-1.5 rounded-md border border-border text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 rounded-md border border-border text-sm font-medium hover:bg-muted"
          >
            {existing ? 'Replace key' : 'Add key'}
          </button>
          {existing && (
            <button
              onClick={handleTest}
              disabled={testing}
              className="px-3 py-1.5 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-50 flex items-center gap-1.5"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Test connection
            </button>
          )}
          {existing && (
            <button
              onClick={handleRemove}
              className="px-3 py-1.5 rounded-md border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/5 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </button>
          )}
          {testResult && (
            <span className={`text-xs flex items-center gap-1 ${testResult.success ? 'text-success' : 'text-destructive'}`}>
              {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {testResult.message}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
