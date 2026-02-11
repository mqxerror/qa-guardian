// AICachePanel - Feature #1332: AI Response Caching
// Extracted from AIRouterPage.tsx to reduce file size and improve maintainability

import { useState } from 'react';
import {
  AIFeatureType,
  AICacheConfig,
  CacheStats,
  CacheEntry,
  CacheEvent,
  getFeatureIcon,
} from './types';

// Props interface for the AICachePanel component
export interface AICachePanelProps {
  // Cache configuration state
  cacheConfig: AICacheConfig;
  setCacheConfig: React.Dispatch<React.SetStateAction<AICacheConfig>>;

  // Cache statistics
  cacheStats: CacheStats;
  setCacheStats: React.Dispatch<React.SetStateAction<CacheStats>>;

  // Cache entries list
  cacheEntries: CacheEntry[];
  setCacheEntries: React.Dispatch<React.SetStateAction<CacheEntry[]>>;

  // Cache events log
  cacheEvents: CacheEvent[];
  setCacheEvents: React.Dispatch<React.SetStateAction<CacheEvent[]>>;
}

/**
 * AICachePanel - Manages AI response caching configuration and monitoring
 *
 * Features:
 * - Enable/disable caching globally
 * - Configure TTL, max cache size, and hash algorithm
 * - Per-feature caching settings
 * - Auto-invalidation settings
 * - Cache key preview generator
 * - Hit/miss rate visualization by feature
 * - Cache event log
 * - Recent cache entries display
 * - Simulate cache scenarios for testing
 * - Clear cache with confirmation modal
 */
export function AICachePanel({
  cacheConfig,
  setCacheConfig,
  cacheStats,
  setCacheStats,
  cacheEntries,
  setCacheEntries,
  cacheEvents,
  setCacheEvents,
}: AICachePanelProps) {
  // Local state for modals and UI
  const [showCacheClearModal, setShowCacheClearModal] = useState(false);
  const [cacheKeyPreview, setCacheKeyPreview] = useState('');

  // Helper function to format TTL values
  const formatTTL = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  // Helper function to format byte sizes
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Get icon for cache event type
  const getCacheEventIcon = (type: CacheEvent['type']): string => {
    const icons: Record<CacheEvent['type'], string> = {
      hit: '\u2705',
      miss: '\u274C',
      store: '\uD83D\uDCBE',
      invalidate: '\uD83D\uDD04',
      expire: '\u23F0',
      evict: '\uD83D\uDDD1\uFE0F',
    };
    return icons[type];
  };

  // Get color class for cache event type
  const getCacheEventColor = (type: CacheEvent['type']): string => {
    const colors: Record<CacheEvent['type'], string> = {
      hit: 'bg-success/5 border-success/20 text-success',
      miss: 'bg-destructive/5 border-destructive/20 text-destructive',
      store: 'bg-primary/5 border-primary/20 text-primary',
      invalidate: 'bg-warning/5 border-warning/20 text-warning',
      expire: 'bg-muted/50 border-border text-muted-foreground',
      evict: 'bg-warning/10 border-warning/20 text-warning',
    };
    return colors[type];
  };

  // Format notification timestamp to relative time
  const formatNotificationTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Generate cache key from request parameters
  const generateCacheKey = (feature: AIFeatureType, prompt: string, model: string): string => {
    const input = `${feature}:${model}:${prompt}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
    return `${cacheConfig.hash_algorithm}:${hashHex}...`;
  };

  // Update per-feature cache configuration
  const updateFeatureCacheConfig = (
    feature: AIFeatureType,
    updates: Partial<{ enabled: boolean; ttl_seconds: number }>
  ) => {
    setCacheConfig(prev => ({
      ...prev,
      cache_by_feature: {
        ...prev.cache_by_feature,
        [feature]: { ...prev.cache_by_feature[feature], ...updates },
      },
    }));
  };

  // Simulate a cache hit event
  const simulateCacheHit = () => {
    const features: AIFeatureType[] = ['chat', 'completion', 'embedding', 'analysis'];
    const randomFeature = features[Math.floor(Math.random() * features.length)];
    const latencySaved = Math.floor(Math.random() * 1500) + 200;
    const costSaved = Math.floor(Math.random() * 5) + 1;

    const newEvent: CacheEvent = {
      id: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'hit',
      cache_key: generateCacheKey(randomFeature, 'test prompt', 'claude-3-sonnet'),
      feature_type: randomFeature,
      latency_saved_ms: latencySaved,
      cost_saved_cents: costSaved,
    };

    setCacheEvents(prev => [newEvent, ...prev.slice(0, 9)]);
    setCacheStats(prev => ({
      ...prev,
      total_hits: prev.total_hits + 1,
      hit_rate_percent: ((prev.total_hits + 1) / (prev.total_hits + prev.total_misses + 1)) * 100,
      estimated_cost_savings_cents: prev.estimated_cost_savings_cents + costSaved,
      estimated_latency_savings_ms: prev.estimated_latency_savings_ms + latencySaved,
    }));

    alert(`\u2705 Cache HIT!\n\nFeature: ${randomFeature}\nLatency Saved: ${latencySaved}ms\nCost Saved: $${(costSaved / 100).toFixed(2)}`);
  };

  // Simulate a cache miss event
  const simulateCacheMiss = () => {
    const features: AIFeatureType[] = ['chat', 'completion', 'embedding', 'analysis'];
    const randomFeature = features[Math.floor(Math.random() * features.length)];

    const newEvent: CacheEvent = {
      id: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'miss',
      cache_key: generateCacheKey(randomFeature, 'new unique prompt', 'claude-3-sonnet'),
      feature_type: randomFeature,
    };

    setCacheEvents(prev => [newEvent, ...prev.slice(0, 9)]);
    setCacheStats(prev => ({
      ...prev,
      total_misses: prev.total_misses + 1,
      hit_rate_percent: (prev.total_hits / (prev.total_hits + prev.total_misses + 1)) * 100,
    }));

    // Simulate storing the response after a short delay
    setTimeout(() => {
      const storeEvent: CacheEvent = {
        id: `evt-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'store',
        cache_key: generateCacheKey(randomFeature, 'new unique prompt', 'claude-3-sonnet'),
        feature_type: randomFeature,
      };
      setCacheEvents(prev => [storeEvent, ...prev.slice(0, 9)]);
      setCacheStats(prev => ({
        ...prev,
        total_entries: prev.total_entries + 1,
        active_entries: prev.active_entries + 1,
      }));
    }, 500);

    alert(`\u274C Cache MISS!\n\nFeature: ${randomFeature}\nNew request - response will be cached for future use.`);
  };

  // Invalidate all cache entries
  const invalidateCache = (reason: string) => {
    const invalidateEvent: CacheEvent = {
      id: `evt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'invalidate',
      cache_key: 'all',
      feature_type: 'chat',
      reason: reason,
    };

    setCacheEvents(prev => [invalidateEvent, ...prev.slice(0, 9)]);
    setCacheStats(prev => ({
      ...prev,
      active_entries: 0,
    }));
    setCacheEntries(prev => prev.map(e => ({ ...e, status: 'invalidated' as const })));

    alert(`\uD83D\uDD04 Cache Invalidated!\n\nReason: ${reason}\nAll ${cacheStats.active_entries.toLocaleString()} cached entries have been invalidated.`);
  };

  // Clear all cache entries
  const clearCache = () => {
    setCacheStats(prev => ({
      ...prev,
      total_entries: 0,
      active_entries: 0,
      cache_size_mb: 0,
    }));
    setCacheEntries([]);
    setShowCacheClearModal(false);
    alert('\uD83D\uDDD1\uFE0F Cache Cleared!\n\nAll cached AI responses have been removed.');
  };

  // Preview cache key for a sample prompt
  const previewCacheKey = (prompt: string) => {
    if (prompt.length > 0) {
      const key = generateCacheKey('chat', prompt, 'claude-3-sonnet');
      setCacheKeyPreview(key);
    } else {
      setCacheKeyPreview('');
    }
  };

  return (
    <>
      {/* Feature #1332: AI Response Caching */}
      <div className="bg-card rounded-lg shadow p-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{'\uD83D\uDCBE'} AI Response Caching</h2>
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
              cacheConfig.enabled ? 'bg-success/10 text-success' : 'bg-muted text-foreground'
            }`}>
              {cacheConfig.enabled ? '\u2713 Enabled' : '\u25CB Disabled'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCacheClearModal(true)}
              className="px-3 py-1.5 text-sm bg-destructive/10 text-destructive rounded hover:bg-destructive/20"
            >
              {'\uD83D\uDDD1\uFE0F'} Clear Cache
            </button>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={cacheConfig.enabled}
                onChange={(e) => setCacheConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                className="w-4 h-4 text-primary rounded"
              />
              <span className="text-sm">Caching</span>
            </label>
          </div>
        </div>

        {/* Cache Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-primary/5 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary">{cacheStats.hit_rate_percent.toFixed(1)}%</div>
            <div className="text-xs text-primary">Hit Rate</div>
          </div>
          <div className="bg-success/5 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-success">{cacheStats.total_hits.toLocaleString()}</div>
            <div className="text-xs text-success">Total Hits</div>
          </div>
          <div className="bg-accent/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-accent">${(cacheStats.estimated_cost_savings_cents / 100).toFixed(2)}</div>
            <div className="text-xs text-accent">Cost Saved</div>
          </div>
          <div className="bg-warning/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-warning">{(cacheStats.estimated_latency_savings_ms / 1000).toFixed(1)}s</div>
            <div className="text-xs text-warning">Latency Saved</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cache Configuration */}
          <div className="space-y-4">
            <h3 className="font-medium text-foreground border-b pb-2">{'\u2699\uFE0F'} Cache Configuration</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Default TTL</div>
                  <div className="text-xs text-muted-foreground">Time-to-live for cached responses</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={cacheConfig.default_ttl_seconds}
                    onChange={(e) => setCacheConfig(prev => ({ ...prev, default_ttl_seconds: parseInt(e.target.value) }))}
                    className="px-2 py-1 text-sm border rounded bg-input text-foreground"
                  >
                    <option value={900}>15 minutes</option>
                    <option value={1800}>30 minutes</option>
                    <option value={3600}>1 hour</option>
                    <option value={7200}>2 hours</option>
                    <option value={86400}>24 hours</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Max Cache Size</div>
                  <div className="text-xs text-muted-foreground">{cacheStats.cache_size_mb.toFixed(1)} MB / {cacheStats.max_size_mb} MB used</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={cacheConfig.max_cache_size_mb}
                    onChange={(e) => setCacheConfig(prev => ({ ...prev, max_cache_size_mb: parseInt(e.target.value) }))}
                    className="px-2 py-1 text-sm border rounded bg-input text-foreground"
                  >
                    <option value={128}>128 MB</option>
                    <option value={256}>256 MB</option>
                    <option value={512}>512 MB</option>
                    <option value={1024}>1 GB</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Hash Algorithm</div>
                  <div className="text-xs text-muted-foreground">Algorithm for cache key generation</div>
                </div>
                <select
                  value={cacheConfig.hash_algorithm}
                  onChange={(e) => setCacheConfig(prev => ({ ...prev, hash_algorithm: e.target.value as 'sha256' | 'md5' | 'xxhash' }))}
                  className="px-2 py-1 text-sm border rounded bg-input text-foreground"
                >
                  <option value="sha256">SHA-256 (Secure)</option>
                  <option value="md5">MD5 (Fast)</option>
                  <option value="xxhash">xxHash (Fastest)</option>
                </select>
              </div>
            </div>

            {/* Invalidation Settings */}
            <div className="border-t pt-3 mt-3">
              <div className="font-medium text-sm mb-2">{'\uD83D\uDD04'} Auto-Invalidation</div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cacheConfig.invalidate_on_model_change}
                    onChange={(e) => setCacheConfig(prev => ({ ...prev, invalidate_on_model_change: e.target.checked }))}
                    className="w-4 h-4 text-primary rounded"
                  />
                  <span className="text-sm">Invalidate on model change</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cacheConfig.invalidate_on_prompt_change}
                    onChange={(e) => setCacheConfig(prev => ({ ...prev, invalidate_on_prompt_change: e.target.checked }))}
                    className="w-4 h-4 text-primary rounded"
                  />
                  <span className="text-sm">Invalidate on system prompt change</span>
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => invalidateCache('Manual invalidation by user')}
                  className="px-3 py-1.5 text-sm bg-warning/10 text-warning rounded hover:bg-warning/20"
                >
                  {'\uD83D\uDD04'} Invalidate All
                </button>
              </div>
            </div>

            {/* Cache Key Preview */}
            <div className="border-t pt-3 mt-3">
              <div className="font-medium text-sm mb-2">{'\uD83D\uDD11'} Cache Key Generator</div>
              <input
                type="text"
                placeholder="Enter a sample prompt to preview cache key..."
                className="w-full px-3 py-2 text-sm border rounded mb-2 bg-input text-foreground"
                onChange={(e) => previewCacheKey(e.target.value)}
              />
              {cacheKeyPreview && (
                <div className="bg-muted rounded p-2 font-mono text-xs break-all">
                  {cacheKeyPreview}
                </div>
              )}
            </div>
          </div>

          {/* Per-Feature Cache Settings */}
          <div className="space-y-4">
            <h3 className="font-medium text-foreground border-b pb-2">{'\uD83D\uDCCB'} Per-Feature TTL Settings</h3>

            <div className="space-y-2">
              {(Object.entries(cacheConfig.cache_by_feature) as [AIFeatureType, { enabled: boolean; ttl_seconds: number }][]).map(([feature, config]) => (
                <div key={feature} className="flex items-center justify-between p-2 bg-muted/50 rounded border">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => updateFeatureCacheConfig(feature, { enabled: e.target.checked })}
                      className="w-4 h-4 text-primary rounded"
                    />
                    <span className="text-sm">{getFeatureIcon(feature)}</span>
                    <span className="text-sm font-medium capitalize">{feature.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={config.ttl_seconds}
                      onChange={(e) => updateFeatureCacheConfig(feature, { ttl_seconds: parseInt(e.target.value) })}
                      disabled={!config.enabled}
                      className="px-2 py-1 text-xs border rounded disabled:opacity-50 bg-input text-foreground"
                    >
                      <option value={900}>15m</option>
                      <option value={1800}>30m</option>
                      <option value={3600}>1h</option>
                      <option value={7200}>2h</option>
                      <option value={86400}>24h</option>
                    </select>
                    <span className="text-xs text-muted-foreground w-16 text-right">
                      {cacheStats.by_feature[feature]?.hits.toLocaleString() || 0} hits
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Hit/Miss by Feature */}
            <div className="border-t pt-3 mt-3">
              <div className="font-medium text-sm mb-2">{'\uD83D\uDCCA'} Hit Rate by Feature</div>
              <div className="space-y-2">
                {(Object.entries(cacheStats.by_feature) as [AIFeatureType, { hits: number; misses: number; entries: number }][]).map(([feature, stats]) => {
                  const hitRate = stats.hits + stats.misses > 0 ? (stats.hits / (stats.hits + stats.misses)) * 100 : 0;
                  return (
                    <div key={feature} className="flex items-center gap-2">
                      <span className="text-sm w-24 capitalize">{feature.replace('_', ' ')}</span>
                      <div className="flex-1 bg-secondary rounded-full h-2">
                        <div
                          className="bg-success h-2 rounded-full"
                          style={{ width: `${hitRate}%` }}
                        />
                      </div>
                      <span className="text-xs text-foreground w-12 text-right">{hitRate.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Simulate Cache Actions */}
        <div className="mt-6 border-t pt-4">
          <h3 className="font-medium text-foreground mb-3">{'\uD83E\uDDEA'} Simulate Cache Scenarios</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={simulateCacheHit}
              className="px-3 py-1.5 text-sm bg-success/10 text-success rounded hover:bg-success/20"
            >
              {'\u2705'} Simulate Hit
            </button>
            <button
              onClick={simulateCacheMiss}
              className="px-3 py-1.5 text-sm bg-destructive/10 text-destructive rounded hover:bg-destructive/20"
            >
              {'\u274C'} Simulate Miss
            </button>
            <button
              onClick={() => invalidateCache('Model configuration changed')}
              className="px-3 py-1.5 text-sm bg-warning/10 text-warning rounded hover:bg-warning/20"
            >
              {'\uD83D\uDD04'} Simulate Config Change
            </button>
          </div>
        </div>

        {/* Cache Event Log */}
        <div className="mt-6 border-t pt-4">
          <h3 className="font-medium text-foreground mb-3">{'\uD83D\uDCDC'} Cache Event Log</h3>
          {cacheEvents.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <div className="text-2xl mb-1">{'\uD83D\uDCED'}</div>
              <div className="text-sm">No cache events yet</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cacheEvents.map((event) => (
                <div
                  key={event.id}
                  className={`flex items-center justify-between p-2 rounded border ${getCacheEventColor(event.type)}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getCacheEventIcon(event.type)}</span>
                    <div>
                      <div className="text-sm font-medium uppercase">{event.type}</div>
                      <div className="text-xs">
                        {event.feature_type} {'\u2022'} {event.cache_key.substring(0, 20)}...
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs">
                      {event.latency_saved_ms && <span className="text-success">-{event.latency_saved_ms}ms</span>}
                      {event.cost_saved_cents && <span className="ml-2 text-accent">-${(event.cost_saved_cents / 100).toFixed(2)}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{formatNotificationTime(event.timestamp)}</div>
                    {event.reason && <div className="text-xs text-muted-foreground italic">{event.reason}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Cache Entries */}
        <div className="mt-6 border-t pt-4">
          <h3 className="font-medium text-foreground mb-3">{'\uD83D\uDCE6'} Recent Cache Entries ({cacheStats.active_entries.toLocaleString()} active)</h3>
          {cacheEntries.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <div className="text-2xl mb-1">{'\uD83D\uDCED'}</div>
              <div className="text-sm">No cache entries</div>
            </div>
          ) : (
            <div className="space-y-2">
              {cacheEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-3 rounded border ${
                    entry.status === 'active' ? 'bg-success/5 border-success/20' :
                    entry.status === 'expired' ? 'bg-muted/50 border-border' :
                    'bg-warning/5 border-warning/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 text-xs rounded ${
                        entry.status === 'active' ? 'bg-success/20 text-success' :
                        entry.status === 'expired' ? 'bg-secondary text-foreground' :
                        'bg-warning/20 text-warning'
                      }`}>
                        {entry.status.toUpperCase()}
                      </span>
                      <span className="text-sm font-mono">{entry.cache_key}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatBytes(entry.response_size_bytes)}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-foreground">
                    <span>{getFeatureIcon(entry.feature_type)} {entry.feature_type}</span>
                    <span>{'\uD83E\uDD16'} {entry.provider}</span>
                    <span>{'\uD83D\uDCCA'} {entry.hit_count} hits</span>
                    <span>{'\u23F1\uFE0F'} TTL: {formatTTL(entry.ttl_seconds)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cache Clear Confirmation Modal */}
      {showCacheClearModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">{'\uD83D\uDDD1\uFE0F'} Clear AI Cache</h3>
            <p className="text-foreground mb-4">
              Are you sure you want to clear all cached AI responses? This will remove {cacheStats.active_entries.toLocaleString()} cached entries ({cacheStats.cache_size_mb.toFixed(1)} MB).
            </p>
            <div className="bg-warning/5 border border-warning/20 rounded p-3 mb-4 text-sm text-warning">
              {'\u26A0\uFE0F'} This action cannot be undone. Future requests will need to be re-processed, increasing costs and latency temporarily.
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCacheClearModal(false)}
                className="px-4 py-2 bg-muted text-foreground rounded hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={clearCache}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
              >
                Clear Cache
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
