// Feature #772: Dependency Age Tracking Page
// Extracted from App.tsx as part of Feature #1441

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { toast } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';
import { ArrowLeft, Clock, RefreshCw, Settings, AlertTriangle, Check, X } from 'lucide-react';

// Feature #772: Dependency Age Tracking interfaces
interface DependencyAgeConfig {
  outdated_threshold_days: number;
  critical_age_days: number;
  track_direct_only: boolean;
  notify_on_outdated: boolean;
  auto_flag_outdated: boolean;
}

interface ProjectDependency {
  id: string;
  project_id: string;
  name: string;
  current_version: string;
  latest_version: string;
  current_release_date: string;
  latest_release_date: string;
  age_days: number;
  versions_behind: number;
  is_direct: boolean;
  license: string;
  status: 'current' | 'outdated' | 'critical' | 'up_to_date';
  has_vulnerability: boolean;
  vulnerability_count: number;
  last_checked: string;
}

export function DependencyAgePage() {
  const navigate = useNavigate();
  // Feature #232: Fixed to use Zustand auth store instead of non-existent localStorage token
  const token = useAuthStore.getState().token;

  // Config state
  const [config, setConfig] = useState<DependencyAgeConfig>({
    outdated_threshold_days: 180,
    critical_age_days: 365,
    track_direct_only: false,
    notify_on_outdated: true,
    auto_flag_outdated: true,
  });
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Dependencies state
  const [dependencies, setDependencies] = useState<ProjectDependency[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    up_to_date: 0,
    current: 0,
    outdated: 0,
    critical: 0,
    with_vulnerabilities: 0,
    direct: 0,
    transitive: 0,
    average_age_days: 0,
    oldest_days: 0,
  });
  const [isLoadingDeps, setIsLoadingDeps] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | 'up_to_date' | 'current' | 'outdated' | 'critical'>('all');
  const [directOnlyFilter, setDirectOnlyFilter] = useState(false);

  // Edit threshold modal state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editConfig, setEditConfig] = useState(config);

  // Load config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/v1/organization/dependency-age/config', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setConfig(data.config);
          setEditConfig(data.config);
        }
      } catch (error) {
        console.error('Failed to load config:', error);
      } finally {
        setIsLoadingConfig(false);
      }
    };
    loadConfig();
  }, [token]);

  // Load dependencies
  useEffect(() => {
    const loadDependencies = async () => {
      try {
        // Use a demo project ID
        const response = await fetch('/api/v1/projects/demo-project/dependencies', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setDependencies(data.dependencies || []);
          setSummary(data.summary);
        }
      } catch (error) {
        console.error('Failed to load dependencies:', error);
      } finally {
        setIsLoadingDeps(false);
      }
    };
    loadDependencies();
  }, [token]);

  // Save config
  const handleSaveConfig = async () => {
    try {
      const response = await fetch('/api/v1/organization/dependency-age/config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(editConfig),
      });
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        setShowConfigModal(false);
        toast.success('Thresholds updated');
        // Reload dependencies to reflect new thresholds
        const depsResponse = await fetch('/api/v1/projects/demo-project/dependencies', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (depsResponse.ok) {
          const depsData = await depsResponse.json();
          setDependencies(depsData.dependencies || []);
          setSummary(depsData.summary);
        }
      }
    } catch (error) {
      toast.error('Failed to save configuration');
    }
  };

  // Refresh dependencies
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch('/api/v1/projects/demo-project/dependencies/refresh', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      // Reload dependencies
      const response = await fetch('/api/v1/projects/demo-project/dependencies', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDependencies(data.dependencies || []);
        setSummary(data.summary);
        toast.success('Dependencies refreshed');
      }
    } catch (error) {
      toast.error('Failed to refresh dependencies');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter dependencies
  const filteredDependencies = dependencies.filter(dep => {
    if (statusFilter !== 'all' && dep.status !== statusFilter) return false;
    if (directOnlyFilter && !dep.is_direct) return false;
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up_to_date': return 'text-green-400 bg-green-500/20';
      case 'current': return 'text-blue-400 bg-blue-500/20';
      case 'outdated': return 'text-yellow-400 bg-yellow-500/20';
      case 'critical': return 'text-red-400 bg-red-500/20';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const formatAge = (days: number) => {
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.round(days / 30)} months`;
    return `${(days / 365).toFixed(1)} years`;
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/security')} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Clock className="h-6 w-6 text-primary" />
                Dependency Age Tracking
              </h1>
              <p className="text-muted-foreground">Track how old dependencies are and flag outdated ones</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowConfigModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <Settings className="h-4 w-4" />
              Configure Thresholds
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Total Dependencies</div>
            <div className="text-2xl font-bold text-foreground">{summary.total}</div>
          </div>
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
            <div className="text-sm text-green-400">Up to Date</div>
            <div className="text-2xl font-bold text-green-400">{summary.up_to_date + summary.current}</div>
          </div>
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
            <div className="text-sm text-yellow-400">Outdated</div>
            <div className="text-2xl font-bold text-yellow-400">{summary.outdated}</div>
          </div>
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <div className="text-sm text-red-400">Critical</div>
            <div className="text-2xl font-bold text-red-400">{summary.critical}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Avg Age</div>
            <div className="text-2xl font-bold text-foreground">{formatAge(summary.average_age_days)}</div>
          </div>
        </div>

        {/* Configuration Summary */}
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-blue-400">Current Thresholds</div>
              <div className="text-sm text-blue-400/80">
                Outdated: &gt; {config.outdated_threshold_days} days ({Math.round(config.outdated_threshold_days / 30)} months) &bull;
                Critical: &gt; {config.critical_age_days} days ({Math.round(config.critical_age_days / 30)} months / {(config.critical_age_days / 365).toFixed(1)} years)
              </div>
            </div>
            <button
              onClick={() => setShowConfigModal(true)}
              className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
            >
              Edit
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-foreground"
          >
            <option value="all">All Statuses</option>
            <option value="up_to_date">Up to Date</option>
            <option value="current">Current</option>
            <option value="outdated">Outdated</option>
            <option value="critical">Critical</option>
          </select>
          <label className="flex items-center text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={directOnlyFilter}
              onChange={(e) => setDirectOnlyFilter(e.target.checked)}
              className="mr-2 rounded border-border"
            />
            Direct dependencies only
          </label>
        </div>

        {/* Dependencies Table */}
        <div className="rounded-lg border border-border bg-card">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Dependencies ({filteredDependencies.length})</h2>
          </div>
          <div className="overflow-x-auto">
            {isLoadingDeps ? (
              <div className="text-center py-8 text-muted-foreground">Loading dependencies...</div>
            ) : filteredDependencies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No dependencies found</div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Package</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Current</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Latest</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Age</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Vulnerabilities</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredDependencies.map(dep => (
                    <tr key={dep.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{dep.name}</div>
                        <div className="text-xs text-muted-foreground">{dep.license}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm text-foreground">{dep.current_version}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm text-foreground">{dep.latest_version}</span>
                        {dep.versions_behind > 0 && (
                          <span className="ml-2 text-xs text-orange-400">
                            ({dep.versions_behind} behind)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className={`font-medium ${dep.age_days >= config.critical_age_days ? 'text-red-400' : dep.age_days >= config.outdated_threshold_days ? 'text-yellow-400' : 'text-foreground'}`}>
                          {formatAge(dep.age_days)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(dep.current_release_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(dep.status)}`}>
                          {dep.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm ${dep.is_direct ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {dep.is_direct ? 'Direct' : 'Transitive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {dep.has_vulnerability ? (
                          <span className="text-red-400 font-medium flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4" /> {dep.vulnerability_count}
                          </span>
                        ) : (
                          <span className="text-green-400 flex items-center gap-1">
                            <Check className="h-4 w-4" /> None
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Configure Thresholds Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg w-full max-w-md border border-border">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Configure Thresholds</h3>
              <button onClick={() => setShowConfigModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Outdated Threshold (days)
                </label>
                <input
                  type="number"
                  value={editConfig.outdated_threshold_days}
                  onChange={(e) => setEditConfig({ ...editConfig, outdated_threshold_days: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  min={1}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Dependencies older than this will be flagged as outdated ({Math.round(editConfig.outdated_threshold_days / 30)} months)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Critical Threshold (days)
                </label>
                <input
                  type="number"
                  value={editConfig.critical_age_days}
                  onChange={(e) => setEditConfig({ ...editConfig, critical_age_days: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                  min={1}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Dependencies older than this will be flagged as critical ({(editConfig.critical_age_days / 365).toFixed(1)} years)
                </p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <div className="font-medium text-foreground">Notify on Outdated</div>
                  <div className="text-sm text-muted-foreground">Send notifications when deps become outdated</div>
                </div>
                <input
                  type="checkbox"
                  checked={editConfig.notify_on_outdated}
                  onChange={(e) => setEditConfig({ ...editConfig, notify_on_outdated: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
