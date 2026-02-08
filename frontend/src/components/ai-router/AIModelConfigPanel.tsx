// AIModelConfigPanel - Extracted from AIRouterPage.tsx (Feature #405)
// Per-feature model configuration with cost optimization suggestions

import { useState } from 'react';
import type {
  AIFeatureType,
  AIModelType,
  FeatureModelConfig,
  ModelUsageStats,
} from './types';
import { getFeatureIcon, getModelInfo, getQualityTierColor } from './types';

interface AIModelConfigPanelProps {
  featureModelConfigs: FeatureModelConfig[];
  setFeatureModelConfigs: React.Dispatch<React.SetStateAction<FeatureModelConfig[]>>;
  modelUsageStats: ModelUsageStats[];
  orgDefaultModel: AIModelType;
  setOrgDefaultModel: React.Dispatch<React.SetStateAction<AIModelType>>;
}

export function AIModelConfigPanel({
  featureModelConfigs,
  setFeatureModelConfigs,
  modelUsageStats,
  orgDefaultModel,
  setOrgDefaultModel,
}: AIModelConfigPanelProps) {

  // Update a feature's model configuration
  const updateFeatureModel = (feature: AIFeatureType, model: AIModelType) => {
    const modelInfo = getModelInfo(model);
    setFeatureModelConfigs(prev => prev.map(c =>
      c.feature === feature
        ? {
            ...c,
            model,
            override_org_default: model !== orgDefaultModel,
            cost_per_1k_tokens: modelInfo.cost,
            avg_latency_ms: parseInt(modelInfo.latency) || c.avg_latency_ms,
            quality_tier: modelInfo.tier.toLowerCase().includes('premium') ? 'premium' as const :
                         modelInfo.tier.toLowerCase().includes('economy') ? 'economy' as const : 'standard' as const
          }
        : c
    ));
  };

  // Reset a feature to use org default
  const resetFeatureToOrgDefault = (feature: AIFeatureType) => {
    const modelInfo = getModelInfo(orgDefaultModel);
    setFeatureModelConfigs(prev => prev.map(c =>
      c.feature === feature
        ? {
            ...c,
            model: orgDefaultModel,
            override_org_default: false,
            cost_per_1k_tokens: modelInfo.cost,
            avg_latency_ms: parseInt(modelInfo.latency) || c.avg_latency_ms,
            quality_tier: modelInfo.tier.toLowerCase().includes('premium') ? 'premium' as const :
                         modelInfo.tier.toLowerCase().includes('economy') ? 'economy' as const : 'standard' as const
          }
        : c
    ));
  };

  // Calculate total estimated monthly cost
  const getTotalEstimatedMonthlyCost = () => {
    return modelUsageStats.reduce((sum, s) => sum + s.total_cost_cents, 0);
  };

  return (
    <div className="bg-card rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            🤖 Model Selection per Feature
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {featureModelConfigs.filter(c => c.override_org_default).length} custom
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">Configure which AI model to use for each feature (Opus 4.5 Thinking/Sonnet/Haiku)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setFeatureModelConfigs(prev => prev.map(c => ({
                ...c,
                model: orgDefaultModel,
                override_org_default: false,
                cost_per_1k_tokens: 0.003,
                avg_latency_ms: 450,
                quality_tier: 'standard' as const
              })));
            }}
            className="px-3 py-1 text-sm bg-muted text-muted-foreground rounded hover:bg-muted/80"
          >
            🔄 Reset All to Default
          </button>
          {/* Bulk Model Assignment */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Bulk assign:</span>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  const model = e.target.value as AIModelType;
                  const modelInfo = getModelInfo(model);
                  setFeatureModelConfigs(prev => prev.map(c => ({
                    ...c,
                    model,
                    override_org_default: model !== orgDefaultModel,
                    cost_per_1k_tokens: modelInfo.cost,
                    avg_latency_ms: parseInt(modelInfo.latency) || c.avg_latency_ms,
                    quality_tier: modelInfo.tier.toLowerCase().includes('premium') ? 'premium' as const :
                                  modelInfo.tier.toLowerCase().includes('economy') ? 'economy' as const : 'standard' as const
                  })));
                  e.target.value = '';
                }
              }}
              className="border rounded px-2 py-1 text-sm bg-card"
              defaultValue=""
            >
              <option value="">Set all features to...</option>
              <option value="claude-opus-4.5-thinking">🧠 Opus 4.5 Thinking (All Premium)</option>
              <option value="claude-opus-4.5">🎯 Opus 4.5 (All Premium)</option>
              <option value="claude-sonnet-4">⚡ Sonnet 4 (All Standard)</option>
              <option value="claude-haiku-3.5">🚀 Haiku 3.5 (All Economy)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Organization Default Model */}
      <div className="mb-6 p-4 bg-gradient-to-r from-primary/5 to-indigo-50 rounded-lg border border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏢</span>
            <div>
              <h3 className="font-medium">Organization Default Model</h3>
              <p className="text-sm text-muted-foreground">Used for features without custom configuration</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={orgDefaultModel}
              onChange={(e) => setOrgDefaultModel(e.target.value as AIModelType)}
              className="border rounded-lg px-3 py-2 font-medium bg-card"
            >
              <option value="claude-opus-4.5-thinking">🧠 Opus 4.5 Thinking ($$$)</option>
              <option value="claude-opus-4.5">🎯 Opus 4.5 ($$$)</option>
              <option value="claude-sonnet-4">⚡ Sonnet 4 ($$)</option>
              <option value="claude-haiku-3.5">🚀 Haiku 3.5 ($)</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-sm text-foreground">
          <span className={`px-2 py-0.5 rounded border ${getQualityTierColor(getModelInfo(orgDefaultModel).tier.toLowerCase() as 'premium' | 'standard' | 'economy')}`}>
            {getModelInfo(orgDefaultModel).tier}
          </span>
          <span>{getModelInfo(orgDefaultModel).description}</span>
        </div>
      </div>

      {/* Per-Feature Model Configuration */}
      <div className="mb-6">
        <h3 className="text-sm font-medium mb-3">📋 Per-Feature Model Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featureModelConfigs.map((config) => {
            const modelInfo = getModelInfo(config.model);
            const usageStats = modelUsageStats.find(s => s.feature === config.feature);
            return (
              <div
                key={config.feature}
                className={`p-4 rounded-lg border-2 transition-all ${
                  config.override_org_default
                    ? 'border-purple-300 bg-purple-50'
                    : 'border-border bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getFeatureIcon(config.feature)}</span>
                    <div>
                      <div className="font-medium">{config.name}</div>
                      <div className="text-xs text-muted-foreground">{config.description}</div>
                    </div>
                  </div>
                  {config.override_org_default && (
                    <span className="text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full">Custom</span>
                  )}
                </div>

                <div className="space-y-3">
                  <select
                    value={config.model}
                    onChange={(e) => updateFeatureModel(config.feature, e.target.value as AIModelType)}
                    className="w-full border rounded px-2 py-1.5 text-sm bg-card"
                  >
                    <option value="claude-opus-4.5-thinking">🧠 Opus 4.5 Thinking</option>
                    <option value="claude-opus-4.5">🎯 Opus 4.5</option>
                    <option value="claude-sonnet-4">⚡ Sonnet 4</option>
                    <option value="claude-haiku-3.5">🚀 Haiku 3.5</option>
                  </select>

                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-2 py-0.5 rounded border ${getQualityTierColor(config.quality_tier)}`}>
                      {modelInfo.tier}
                    </span>
                    <span className="text-muted-foreground">~{config.avg_latency_ms}ms latency</span>
                    <span className="font-medium text-success">{modelInfo.costBadge}</span>
                  </div>

                  {usageStats && (
                    <div className="pt-2 border-t text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>{usageStats.request_count.toLocaleString()} requests</span>
                        <span>${(usageStats.total_cost_cents / 100).toFixed(2)} this month</span>
                      </div>
                    </div>
                  )}

                  {config.override_org_default && (
                    <button
                      onClick={() => resetFeatureToOrgDefault(config.feature)}
                      className="w-full text-xs text-purple-600 hover:text-purple-800 py-1"
                    >
                      ↩️ Reset to org default ({getModelInfo(orgDefaultModel).name})
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Model Usage Statistics */}
      <div className="mb-6">
        <h3 className="text-sm font-medium mb-3">📊 Model Usage by Feature (This Month)</h3>
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {modelUsageStats.reduce((sum, s) => sum + s.request_count, 0).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Total Requests</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">
                {(modelUsageStats.reduce((sum, s) => sum + s.total_tokens, 0) / 1000000).toFixed(1)}M
              </div>
              <div className="text-xs text-muted-foreground">Total Tokens</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                ${(getTotalEstimatedMonthlyCost() / 100).toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">Total Cost</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-warning">
                {Math.round(modelUsageStats.reduce((sum, s) => sum + s.avg_latency_ms * s.request_count, 0) / modelUsageStats.reduce((sum, s) => sum + s.request_count, 0) || 0)}ms
              </div>
              <div className="text-xs text-muted-foreground">Avg Latency</div>
            </div>
          </div>

          <div className="space-y-2">
            {modelUsageStats
              .sort((a, b) => b.total_cost_cents - a.total_cost_cents)
              .map((stat) => {
                const config = featureModelConfigs.find(c => c.feature === stat.feature);
                const modelInfo = getModelInfo(stat.model);
                const totalCost = getTotalEstimatedMonthlyCost();
                const percentage = totalCost > 0 ? (stat.total_cost_cents / totalCost) * 100 : 0;
                return (
                  <div key={stat.feature} className="flex items-center gap-3">
                    <span className="w-6">{getFeatureIcon(stat.feature)}</span>
                    <span className="w-28 text-sm font-medium truncate">{config?.name}</span>
                    <span className="w-20 text-xs text-muted-foreground">{modelInfo.icon} {modelInfo.name.split(' ')[0]}</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          stat.model.includes('opus') ? 'bg-purple-500' :
                          stat.model.includes('sonnet') ? 'bg-primary' :
                          'bg-success'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-sm font-medium">${(stat.total_cost_cents / 100).toFixed(2)}</span>
                    <span className="w-12 text-right text-xs text-muted-foreground">{percentage.toFixed(1)}%</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Cost Optimization Suggestions */}
      <div className="p-4 bg-gradient-to-r from-success/5 to-emerald-50 rounded-lg border border-success/20">
        <h3 className="font-medium text-success mb-2">💡 Cost Optimization Suggestions</h3>
        <ul className="text-sm text-success space-y-1">
          <li>• Consider using Haiku 3.5 for simple chat responses (~90% cost reduction)</li>
          <li>• Enable response caching for repeated analysis queries</li>
          <li>• Use Sonnet 4 for code reviews instead of Opus for similar quality at 80% less cost</li>
        </ul>
      </div>
    </div>
  );
}
