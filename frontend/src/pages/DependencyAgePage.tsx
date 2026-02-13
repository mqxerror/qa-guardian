// Feature #772: Dependency Age Tracking Page
// Extracted from App.tsx as part of Feature #1441
// Feature #710: Migrated to React Query for data fetching

import { useState } from 'react';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { toast } from '../stores/toastStore';
import { Clock, RefreshCw, Settings, AlertTriangle, Check } from 'lucide-react';
import { Button } from '../components/ui/button';
// Feature #728: EmptyState adoption
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';
// Feature #710: React Query hooks
import {
  useDependencyAgeConfig,
  useProjectDependencies,
  useUpdateDependencyAgeConfig,
  useRefreshDependencies,
  type DependencyAgeConfig,
} from '../hooks/api';

export function DependencyAgePage() {
  // Feature #710: React Query hooks for data fetching
  const { data: configData, isLoading: isLoadingConfig } = useDependencyAgeConfig();
  // Use demo-project for now (could be parameterized later)
  const projectId = 'demo-project';
  const { data: depsData, isLoading: isLoadingDeps } = useProjectDependencies(projectId);

  // Mutations
  const updateConfigMutation = useUpdateDependencyAgeConfig();
  const refreshMutation = useRefreshDependencies(projectId);

  // Derived data
  const config = configData?.config || {
    outdated_threshold_days: 180,
    critical_age_days: 365,
    track_direct_only: false,
    notify_on_outdated: true,
    auto_flag_outdated: true,
  };
  const dependencies = depsData?.dependencies || [];
  const summary = depsData?.summary || {
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
  };

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | 'up_to_date' | 'current' | 'outdated' | 'critical'>('all');
  const [directOnlyFilter, setDirectOnlyFilter] = useState(false);

  // Edit threshold modal state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editConfig, setEditConfig] = useState(config);

  // Update editConfig when config changes
  if (configData?.config && editConfig.outdated_threshold_days !== configData.config.outdated_threshold_days) {
    setEditConfig(configData.config);
  }

  // Save config
  const handleSaveConfig = async () => {
    try {
      await updateConfigMutation.mutateAsync(editConfig);
      setShowConfigModal(false);
      toast.success('Thresholds updated');
    } catch (error) {
      toast.error('Failed to save configuration');
    }
  };

  // Refresh dependencies
  const handleRefresh = async () => {
    try {
      await refreshMutation.mutateAsync();
      toast.success('Dependencies refreshed');
    } catch (error) {
      toast.error('Failed to refresh dependencies');
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
      case 'up_to_date': return 'text-success bg-success/20';
      case 'current': return 'text-primary bg-primary/20';
      case 'outdated': return 'text-warning bg-warning/20';
      case 'critical': return 'text-destructive bg-destructive/20';
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
      <div className="p-6 lg:p-8 space-y-6">
        {/* Feature #639: PageHeader component */}
        <PageHeader
          title="Dependency Age Tracking"
          description="Track how old dependencies are and flag outdated ones"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Security', href: '/security' }, { label: 'Dependency Age' }]}
          actions={
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
                disabled={refreshMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                {refreshMutation.isPending ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          }
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Total Dependencies</div>
            <div className="text-2xl font-bold text-foreground">{summary.total}</div>
          </div>
          <div className="rounded-lg border border-success/30 bg-success/10 p-4">
            <div className="text-sm text-success">Up to Date</div>
            <div className="text-2xl font-bold text-success">{summary.up_to_date + summary.current}</div>
          </div>
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
            <div className="text-sm text-warning">Outdated</div>
            <div className="text-2xl font-bold text-warning">{summary.outdated}</div>
          </div>
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <div className="text-sm text-destructive">Critical</div>
            <div className="text-2xl font-bold text-destructive">{summary.critical}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Avg Age</div>
            <div className="text-2xl font-bold text-foreground">{formatAge(summary.average_age_days)}</div>
          </div>
        </div>

        {/* Configuration Summary */}
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-primary">Current Thresholds</div>
              <div className="text-sm text-primary/80">
                Outdated: &gt; {config.outdated_threshold_days} days ({Math.round(config.outdated_threshold_days / 30)} months) &bull;
                Critical: &gt; {config.critical_age_days} days ({Math.round(config.critical_age_days / 30)} months / {(config.critical_age_days / 365).toFixed(1)} years)
              </div>
            </div>
            <button
              onClick={() => setShowConfigModal(true)}
              className="text-primary hover:text-primary/70 text-sm transition-colors"
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
              /* Feature #728: EmptyState adoption */
              <EmptyState
                icon={EmptyStateIcons.folder}
                title="No dependencies found"
                description="Select a project to view its dependency age analysis."
                size="sm"
              />
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
                          <span className="ml-2 text-xs text-warning">
                            ({dep.versions_behind} behind)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className={`font-medium ${dep.age_days >= config.critical_age_days ? 'text-destructive' : dep.age_days >= config.outdated_threshold_days ? 'text-warning' : 'text-foreground'}`}>
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
                          <span className="text-destructive font-medium flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4" /> {dep.vulnerability_count}
                          </span>
                        ) : (
                          <span className="text-success flex items-center gap-1">
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

      {/* Feature #661: Configure Thresholds Modal - migrated to shared Modal */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title="Configure Thresholds"
        size="md"
      >
        <ModalHeader onClose={() => setShowConfigModal(false)}>
          Configure Thresholds
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
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
        </ModalBody>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => setShowConfigModal(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveConfig}
            disabled={updateConfigMutation.isPending}
          >
            {updateConfigMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </ModalFooter>
      </Modal>
    </Layout>
  );
}
