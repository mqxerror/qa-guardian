// AIConfigurationTab - AI provider config
// Feature #451: Extracted from SettingsPage.tsx
// Feature #2074: AI Model Selection for Different Tasks

import { useState, useEffect } from 'react';
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
