// Feature #772: Dependency Age Tracking Page
// Extracted from App.tsx as part of Feature #1441

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../stores/toastStore';

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
  const token = localStorage.getItem('token');

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
      case 'up_to_date': return 'text-green-600 bg-green-100';
      case 'current': return 'text-blue-600 bg-blue-100';
      case 'outdated': return 'text-yellow-600 bg-yellow-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatAge = (days: number) => {
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.round(days / 30)} months`;
    return `${(days / 365).toFixed(1)} years`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/security')} className="text-gray-500 hover:text-gray-700">
              &#8592; Back to Security
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dependency Age Tracking</h1>
              <p className="text-gray-500">Track how old dependencies are and flag outdated ones</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Configure Thresholds
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-sm text-gray-500">Total Dependencies</div>
            <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-sm text-gray-500">Up to Date</div>
            <div className="text-2xl font-bold text-green-600">{summary.up_to_date + summary.current}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-sm text-gray-500">Outdated</div>
            <div className="text-2xl font-bold text-yellow-600">{summary.outdated}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-sm text-gray-500">Critical</div>
            <div className="text-2xl font-bold text-red-600">{summary.critical}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="text-sm text-gray-500">Avg Age</div>
            <div className="text-2xl font-bold text-gray-900">{formatAge(summary.average_age_days)}</div>
          </div>
        </div>

        {/* Configuration Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-blue-900">Current Thresholds</div>
              <div className="text-sm text-blue-700">
                Outdated: &gt; {config.outdated_threshold_days} days ({Math.round(config.outdated_threshold_days / 30)} months) &bull;
                Critical: &gt; {config.critical_age_days} days ({Math.round(config.critical_age_days / 30)} months / {(config.critical_age_days / 365).toFixed(1)} years)
              </div>
            </div>
            <button
              onClick={() => setShowConfigModal(true)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Edit
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="all">All Statuses</option>
            <option value="up_to_date">Up to Date</option>
            <option value="current">Current</option>
            <option value="outdated">Outdated</option>
            <option value="critical">Critical</option>
          </select>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={directOnlyFilter}
              onChange={(e) => setDirectOnlyFilter(e.target.checked)}
              className="mr-2"
            />
            Direct dependencies only
          </label>
        </div>

        {/* Dependencies Table */}
        <div className="bg-white rounded-lg border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Dependencies ({filteredDependencies.length})</h2>
          </div>
          <div className="overflow-x-auto">
            {isLoadingDeps ? (
              <div className="text-center py-8 text-gray-500">Loading dependencies...</div>
            ) : filteredDependencies.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No dependencies found</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Package</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Latest</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Age</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vulnerabilities</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredDependencies.map(dep => (
                    <tr key={dep.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{dep.name}</div>
                        <div className="text-xs text-gray-500">{dep.license}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm">{dep.current_version}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm">{dep.latest_version}</span>
                        {dep.versions_behind > 0 && (
                          <span className="ml-2 text-xs text-orange-600">
                            ({dep.versions_behind} behind)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className={`font-medium ${dep.age_days >= config.critical_age_days ? 'text-red-600' : dep.age_days >= config.outdated_threshold_days ? 'text-yellow-600' : 'text-gray-900'}`}>
                          {formatAge(dep.age_days)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(dep.current_release_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(dep.status)}`}>
                          {dep.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm ${dep.is_direct ? 'text-gray-900' : 'text-gray-500'}`}>
                          {dep.is_direct ? 'Direct' : 'Transitive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {dep.has_vulnerability ? (
                          <span className="text-red-600 font-medium">
                            &#9888; {dep.vulnerability_count}
                          </span>
                        ) : (
                          <span className="text-green-600">&#10003; None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Configure Thresholds Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Configure Thresholds</h3>
              <button onClick={() => setShowConfigModal(false)} className="text-gray-500 hover:text-gray-700">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Outdated Threshold (days)
                </label>
                <input
                  type="number"
                  value={editConfig.outdated_threshold_days}
                  onChange={(e) => setEditConfig({ ...editConfig, outdated_threshold_days: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min={1}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Dependencies older than this will be flagged as outdated ({Math.round(editConfig.outdated_threshold_days / 30)} months)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Critical Threshold (days)
                </label>
                <input
                  type="number"
                  value={editConfig.critical_age_days}
                  onChange={(e) => setEditConfig({ ...editConfig, critical_age_days: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min={1}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Dependencies older than this will be flagged as critical ({(editConfig.critical_age_days / 365).toFixed(1)} years)
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Notify on Outdated</div>
                  <div className="text-sm text-gray-500">Send notifications when deps become outdated</div>
                </div>
                <input
                  type="checkbox"
                  checked={editConfig.notify_on_outdated}
                  onChange={(e) => setEditConfig({ ...editConfig, notify_on_outdated: e.target.checked })}
                  className="h-4 w-4"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end space-x-3">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
