// ScanCachingPage - extracted from App.tsx
// Feature #776: Dependency Scan Caching Page
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Type definitions
interface ScanCacheEntry {
  id: string;
  scan_type: string;
  cache_key: string;
  status: 'valid' | 'stale' | 'invalidated';
  hit_count: number;
  scan_duration_ms: number;
  dependencies: number;
  vulnerabilities: number;
  created_at: string;
  expires_at: string;
  last_accessed: string;
}

interface CacheConfig {
  enabled: boolean;
  ttl_hours: number;
  max_entries: number;
  invalidation_triggers: string[];
  compression_enabled: boolean;
}

interface CacheStats {
  project_id: string;
  total_entries: number;
  valid_entries: number;
  stale_entries: number;
  invalidated_entries: number;
  total_cache_hits: number;
  total_time_saved_ms: number;
  cache_hit_rate: number;
  storage_used_bytes: number;
  oldest_entry: string | null;
  newest_entry: string | null;
}

interface ScanResult {
  scan_id: string;
  project_id: string;
  cache_hit: boolean;
  cache_entry_id?: string;
  scan_duration_ms: number;
  saved_time_ms?: number;
  results: {
    dependencies: any[];
    vulnerabilities: any[];
    total_dependencies: number;
    total_vulnerabilities: number;
  };
  cache_info: {
    key: string;
    created_at?: string;
    expires_at?: string;
    hit_count?: number;
  };
}

export function ScanCachingPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const projectId = 'proj-001'; // Demo project

  // State
  const [config, setConfig] = useState<CacheConfig | null>(null);
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [entries, setEntries] = useState<ScanCacheEntry[]>([]);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [configRes, statsRes, entriesRes] = await Promise.all([
        fetch(`http://localhost:3000/api/v1/projects/${projectId}/scan-cache/config`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:3000/api/v1/projects/${projectId}/scan-cache/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`http://localhost:3000/api/v1/projects/${projectId}/scan-cache/entries`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (configRes.ok) {
        setConfig(await configRes.json());
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (entriesRes.ok) {
        const data = await entriesRes.json();
        setEntries(data.entries || []);
      }
    } catch (error) {
      console.error('Failed to fetch cache data:', error);
    }
    setIsLoading(false);
  };

  // Run scan with caching
  const runScan = async (forceRefresh: boolean = false) => {
    setIsScanning(true);
    try {
      const response = await fetch(`http://localhost:3000/api/v1/projects/${projectId}/scan-with-cache`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scan_type: 'full', force_refresh: forceRefresh }),
      });

      if (response.ok) {
        const result = await response.json();
        setLastScan(result);
        // Refresh stats and entries after scan
        fetchData();
      }
    } catch (error) {
      console.error('Scan failed:', error);
    }
    setIsScanning(false);
  };

  // Update configuration
  const updateConfig = async (updates: Partial<CacheConfig>) => {
    setIsSavingConfig(true);
    try {
      const response = await fetch(`http://localhost:3000/api/v1/projects/${projectId}/scan-cache/config`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Failed to update config:', error);
    }
    setIsSavingConfig(false);
  };

  // Invalidate all cache entries
  const invalidateCache = async () => {
    try {
      const response = await fetch(`http://localhost:3000/api/v1/projects/${projectId}/scan-cache/invalidate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invalidate_all: true, reason: 'Manual invalidation' }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to invalidate cache:', error);
    }
  };

  // Clear all cache entries
  const clearCache = async () => {
    if (!confirm('Are you sure you want to clear all cache entries?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/v1/projects/${projectId}/scan-cache`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  // Filter entries
  const filteredEntries = statusFilter === 'all'
    ? entries
    : entries.filter(e => e.status === statusFilter);

  // Format time duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => navigate('/security')}
            className="text-blue-500 hover:text-blue-700 mb-2 flex items-center gap-1"
          >
            &#8592; Back to Security
          </button>
          <h1 className="text-2xl font-bold">{'\u{1F5C4}\uFE0F'} Dependency Scan Caching</h1>
          <p className="text-gray-600">Cache scan results for faster subsequent scans</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => runScan(false)}
            disabled={isScanning}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isScanning ? 'Scanning...' : '\u{1F50D} Run Scan'}
          </button>
          <button
            onClick={() => runScan(true)}
            disabled={isScanning}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            {'\u{1F504}'} Force Refresh
          </button>
        </div>
      </div>

      {/* Last Scan Result */}
      {lastScan && (
        <div className={`mb-6 p-4 rounded-lg border ${lastScan.cache_hit ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{lastScan.cache_hit ? '\u26A1' : '\u{1F50D}'}</span>
              <div>
                <div className="font-medium">
                  {lastScan.cache_hit ? 'Cache Hit!' : 'Full Scan Completed'}
                </div>
                <div className="text-sm text-gray-600">
                  Duration: {formatDuration(lastScan.scan_duration_ms)}
                  {lastScan.saved_time_ms && ` (saved ${formatDuration(lastScan.saved_time_ms)})`}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm">
                <span className="font-medium">{lastScan.results.total_dependencies}</span> dependencies
              </div>
              <div className="text-sm">
                <span className="font-medium">{lastScan.results.total_vulnerabilities}</span> vulnerabilities
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cache Statistics */}
      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.total_entries}</div>
            <div className="text-sm text-gray-600">Total Entries</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.valid_entries}</div>
            <div className="text-sm text-gray-600">Valid</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-purple-600">{stats.total_cache_hits}</div>
            <div className="text-sm text-gray-600">Cache Hits</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-amber-600">{stats.cache_hit_rate}%</div>
            <div className="text-sm text-gray-600">Hit Rate</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-cyan-600">{formatDuration(stats.total_time_saved_ms)}</div>
            <div className="text-sm text-gray-600">Time Saved</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">{'\u2699\uFE0F'} Cache Configuration</h2>

          {config && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Cache Enabled</span>
                <button
                  onClick={() => updateConfig({ enabled: !config.enabled })}
                  disabled={isSavingConfig}
                  className={`w-12 h-6 rounded-full transition-colors ${config.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div>
                <label className="text-sm text-gray-600">TTL (hours)</label>
                <select
                  value={config.ttl_hours}
                  onChange={(e) => updateConfig({ ttl_hours: parseInt(e.target.value) })}
                  disabled={isSavingConfig}
                  className="mt-1 w-full border rounded p-2"
                >
                  <option value="1">1 hour</option>
                  <option value="6">6 hours</option>
                  <option value="12">12 hours</option>
                  <option value="24">24 hours</option>
                  <option value="48">48 hours</option>
                  <option value="168">1 week</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-600">Max Entries</label>
                <input
                  type="number"
                  value={config.max_entries}
                  onChange={(e) => updateConfig({ max_entries: parseInt(e.target.value) })}
                  disabled={isSavingConfig}
                  className="mt-1 w-full border rounded p-2"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Compression</span>
                <button
                  onClick={() => updateConfig({ compression_enabled: !config.compression_enabled })}
                  disabled={isSavingConfig}
                  className={`w-12 h-6 rounded-full transition-colors ${config.compression_enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${config.compression_enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div>
                <label className="text-sm text-gray-600">Invalidation Triggers</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {config.invalidation_triggers.map((trigger, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 rounded text-xs">{trigger}</span>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t flex gap-2">
                <button
                  onClick={invalidateCache}
                  className="flex-1 px-3 py-2 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 text-sm"
                >
                  Invalidate All
                </button>
                <button
                  onClick={clearCache}
                  className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                >
                  Clear Cache
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cache Entries Panel */}
        <div className="col-span-2 bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{'\u{1F4CB}'} Cache Entries</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded p-1 text-sm"
            >
              <option value="all">All Status</option>
              <option value="valid">Valid</option>
              <option value="stale">Stale</option>
              <option value="invalidated">Invalidated</option>
            </select>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">{'\u{1F4ED}'}</div>
              <div>No cache entries found</div>
              <div className="text-sm">Run a scan to create cache entries</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={`border rounded p-3 ${
                    entry.status === 'valid' ? 'border-green-200 bg-green-50'
                    : entry.status === 'stale' ? 'border-amber-200 bg-amber-50'
                    : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        entry.status === 'valid' ? 'bg-green-200 text-green-800'
                        : entry.status === 'stale' ? 'bg-amber-200 text-amber-800'
                        : 'bg-red-200 text-red-800'
                      }`}>
                        {entry.status}
                      </span>
                      <span className="text-sm font-medium">{entry.scan_type}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {entry.hit_count} hits
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Deps:</span>
                      <span className="ml-1 font-medium">{entry.dependencies}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Vulns:</span>
                      <span className="ml-1 font-medium">{entry.vulnerabilities}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Duration:</span>
                      <span className="ml-1 font-medium">{formatDuration(entry.scan_duration_ms)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Expires:</span>
                      <span className="ml-1 font-medium">
                        {new Date(entry.expires_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="mt-1 text-xs text-gray-400 truncate">
                    Key: {entry.cache_key}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Storage Info */}
      {stats && (
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-gray-500">Storage Used:</span>
              <span className="font-medium">{formatBytes(stats.storage_used_bytes)}</span>
            </div>
            <div className="flex items-center gap-4">
              {stats.oldest_entry && (
                <span className="text-gray-500">
                  Oldest: {new Date(stats.oldest_entry).toLocaleDateString()}
                </span>
              )}
              {stats.newest_entry && (
                <span className="text-gray-500">
                  Newest: {new Date(stats.newest_entry).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
