// Feature #771: Auto-PR for Dependency Updates Page
// Extracted from App.tsx as part of Feature #1441
// Feature #710: Migrated to React Query for data fetching

import { useState } from 'react';
import { toast } from '../stores/toastStore';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { Button } from '@/components/ui/button';
// Feature #728: EmptyState adoption
import { EmptyState, EmptyStateIcons } from '../components/ui/EmptyState';
// Feature #710: React Query hooks
import {
  useAutoPRConfig,
  useAutoPRs,
  useUpdateAutoPRConfig,
  useScanAndCreatePRs,
  useUpdateAutoPRStatus,
  type AutoPRConfig,
  type AutoPR,
} from '../hooks/api';

export function AutoPRPage() {
  // Feature #710: React Query hooks for data fetching
  const { data: configData, isLoading: isLoadingConfig } = useAutoPRConfig();
  const { data: prsData, isLoading: isLoadingPRs } = useAutoPRs();

  // Mutations
  const updateConfigMutation = useUpdateAutoPRConfig();
  const scanAndCreateMutation = useScanAndCreatePRs();
  const updateStatusMutation = useUpdateAutoPRStatus();

  // Derived data
  const config = configData?.config || {
    enabled: false,
    auto_merge_patch: false,
    auto_merge_minor: false,
    require_tests_pass: true,
    include_changelog: true,
    assignees: [],
    labels: ['dependencies', 'security'],
    branch_prefix: 'deps/',
    schedule: 'immediate' as const,
    max_prs_per_day: 10,
  };
  const prs = prsData?.prs || [];
  const prSummary = prsData?.summary || {
    total: 0,
    pending: 0,
    created: 0,
    merged: 0,
    closed: 0,
    failed: 0,
  };

  // UI state
  const [expandedPR, setExpandedPR] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{
    prs_created: AutoPR[];
    total_scanned: number;
  } | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'created' | 'merged' | 'closed' | 'failed'>('all');

  // Save config
  const saveConfig = async (updates: Partial<AutoPRConfig>) => {
    try {
      const result = await updateConfigMutation.mutateAsync(updates);
      if (result.message) {
        toast.success(result.message);
      }
    } catch (error) {
      toast.error('Failed to save configuration');
    }
  };

  // Scan and create PRs
  const handleScanAndCreate = async () => {
    setScanResult(null);
    try {
      const result = await scanAndCreateMutation.mutateAsync({ project_id: 'demo-project' });
      setScanResult(result);
      toast.success(result.message);
    } catch (error) {
      toast.error('Failed to scan and create PRs');
    }
  };

  // Update PR status (merge/close)
  const handleUpdatePRStatus = async (prId: string, status: 'merged' | 'closed', testsStatus?: 'passed' | 'failed') => {
    try {
      await updateStatusMutation.mutateAsync({ prId, status, tests_status: testsStatus });
      toast.success(`PR ${status}`);
    } catch (error) {
      toast.error('Failed to update PR');
    }
  };

  // Filter PRs
  const filteredPRs = prs.filter(pr =>
    statusFilter === 'all' || pr.status === statusFilter
  );

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-destructive bg-destructive/10';
      case 'HIGH': return 'text-warning bg-warning/10';
      case 'MEDIUM': return 'text-warning bg-warning/10';
      case 'LOW': return 'text-primary bg-primary/10';
      default: return 'text-muted-foreground bg-muted/50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-muted-foreground bg-muted';
      case 'created': return 'text-primary bg-primary/20';
      case 'merged': return 'text-success bg-success/20';
      case 'closed': return 'text-muted-foreground bg-muted';
      case 'failed': return 'text-destructive bg-destructive/20';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getTestStatusIcon = (status?: string) => {
    switch (status) {
      case 'passed': return '\u2713';
      case 'failed': return '\u2717';
      case 'running': return '\u27F3';
      case 'pending': return '\u25CB';
      default: return '';
    }
  };

  return (
    <Layout>
    <div className="min-h-screen p-6 lg:p-8 space-y-6">
      {/* Feature #639: PageHeader component */}
      <PageHeader
        title="Auto-PR for Dependency Updates"
        description="Automatically create PRs to update vulnerable dependencies"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Security', href: '/security' }, { label: 'Auto-PR' }]}
        actions={
          <Button
            onClick={handleScanAndCreate}
            disabled={!config.enabled || scanAndCreateMutation.isPending}
          >
            {scanAndCreateMutation.isPending ? 'Scanning...' : 'Scan & Create PRs'}
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-6 gap-4">
          <div className="bg-card rounded-lg p-4 border border-border">
            <div className="text-sm text-muted-foreground">Total PRs</div>
            <div className="text-2xl font-bold text-foreground">{prSummary.total}</div>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <div className="text-sm text-muted-foreground">Pending</div>
            <div className="text-2xl font-bold text-muted-foreground">{prSummary.pending}</div>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <div className="text-sm text-muted-foreground">Created</div>
            <div className="text-2xl font-bold text-primary">{prSummary.created}</div>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <div className="text-sm text-muted-foreground">Merged</div>
            <div className="text-2xl font-bold text-success">{prSummary.merged}</div>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <div className="text-sm text-muted-foreground">Closed</div>
            <div className="text-2xl font-bold text-muted-foreground">{prSummary.closed}</div>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <div className="text-sm text-muted-foreground">Failed</div>
            <div className="text-2xl font-bold text-destructive">{prSummary.failed}</div>
          </div>
        </div>

        {/* Configuration Section */}
        <div className="bg-card rounded-lg border border-border">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Auto-PR Configuration</h2>
          </div>
          <div className="p-6">
            {isLoadingConfig ? (
              <div className="text-center py-4 text-muted-foreground">Loading configuration...</div>
            ) : (
              <div className="space-y-6">
                {/* Enable Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-foreground">Enable Auto-PR</div>
                    <div className="text-sm text-muted-foreground">Automatically create PRs for vulnerable dependencies</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      onChange={(e) => saveConfig({ enabled: e.target.checked })}
                      disabled={updateConfigMutation.isPending}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Auto-merge options */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-foreground">Auto-merge Patch Updates</div>
                      <div className="text-sm text-muted-foreground">Automatically merge patch version updates</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.auto_merge_patch}
                        onChange={(e) => saveConfig({ auto_merge_patch: e.target.checked })}
                        disabled={updateConfigMutation.isPending}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-foreground">Auto-merge Minor Updates</div>
                      <div className="text-sm text-muted-foreground">Automatically merge minor version updates</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.auto_merge_minor}
                        onChange={(e) => saveConfig({ auto_merge_minor: e.target.checked })}
                        disabled={updateConfigMutation.isPending}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>

                {/* Other options */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-foreground">Require Tests to Pass</div>
                      <div className="text-sm text-muted-foreground">Only merge after tests pass</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.require_tests_pass}
                        onChange={(e) => saveConfig({ require_tests_pass: e.target.checked })}
                        disabled={updateConfigMutation.isPending}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-foreground">Include Changelog</div>
                      <div className="text-sm text-muted-foreground">Add changelog to PR description</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.include_changelog}
                        onChange={(e) => saveConfig({ include_changelog: e.target.checked })}
                        disabled={updateConfigMutation.isPending}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>

                {/* Schedule */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Schedule</label>
                  <select
                    value={config.schedule}
                    onChange={(e) => saveConfig({ schedule: e.target.value as AutoPRConfig['schedule'] })}
                    disabled={updateConfigMutation.isPending}
                    className="w-full max-w-xs px-3 py-2 border border-border rounded-lg bg-card text-foreground"
                  >
                    <option value="immediate">Immediate</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scan Result */}
        {scanResult && (
          <div className="bg-success/10 border border-success/30 rounded-lg p-4">
            <div className="font-semibold text-success">Scan Complete</div>
            <div className="text-sm text-success">
              Scanned {scanResult.total_scanned} dependencies, created {scanResult.prs_created.length} PR(s)
            </div>
          </div>
        )}

        {/* PRs List */}
        <div className="bg-card rounded-lg border border-border">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Auto-Generated PRs</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2 border border-border rounded-lg bg-card text-foreground"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="created">Created</option>
              <option value="merged">Merged</option>
              <option value="closed">Closed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="p-6">
            {isLoadingPRs ? (
              <div className="text-center py-8 text-muted-foreground">Loading PRs...</div>
            ) : filteredPRs.length === 0 ? (
              /* Feature #728: EmptyState adoption */
              <EmptyState
                icon={EmptyStateIcons.document}
                title="No auto-PRs yet"
                description={config.enabled ? 'Click "Scan & Create PRs" to get started.' : 'Enable Auto-PR first.'}
              />
            ) : (
              <div className="space-y-3">
                {filteredPRs.map(pr => (
                  <div key={pr.id} className="border border-border rounded-lg overflow-hidden">
                    <div
                      className="p-4 cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedPR(expandedPR === pr.id ? null : pr.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(pr.status)}`}>
                            {pr.status.toUpperCase()}
                          </span>
                          <div>
                            <div className="font-medium text-foreground">
                              {pr.dependency_name} {pr.current_version} &#8594; {pr.target_version}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {pr.project_name} &bull; PR #{pr.pr_number} &bull; {pr.update_type} update
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          {pr.vulnerability && (
                            <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(pr.vulnerability.severity)}`}>
                              {pr.vulnerability.cve_id}
                            </span>
                          )}
                          {pr.tests_status && (
                            <span className={`text-sm ${pr.tests_status === 'passed' ? 'text-success' : pr.tests_status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
                              Tests: {getTestStatusIcon(pr.tests_status)} {pr.tests_status}
                            </span>
                          )}
                          <span className="text-muted-foreground">{expandedPR === pr.id ? '\u25BC' : '\u25B6'}</span>
                        </div>
                      </div>
                    </div>
                    {expandedPR === pr.id && (
                      <div className="border-t border-border bg-muted/50 p-4">
                        <div className="space-y-3">
                          <div>
                            <div className="text-sm font-medium text-foreground">PR Title</div>
                            <div className="text-sm text-muted-foreground">{pr.pr_title}</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-foreground">Branch</div>
                            <div className="text-sm font-mono text-muted-foreground">{pr.branch_name}</div>
                          </div>
                          {pr.vulnerability && (
                            <div>
                              <div className="text-sm font-medium text-foreground">Security Fix</div>
                              <div className="text-sm text-muted-foreground">
                                <span className={`inline-block px-2 py-0.5 rounded mr-2 ${getSeverityColor(pr.vulnerability.severity)}`}>
                                  {pr.vulnerability.severity}
                                </span>
                                {pr.vulnerability.title}
                              </div>
                            </div>
                          )}
                          {pr.changelog && (
                            <div>
                              <div className="text-sm font-medium text-foreground">Changelog</div>
                              <pre className="text-xs text-muted-foreground bg-card p-2 rounded border border-border mt-1 overflow-auto max-h-32">
                                {pr.changelog}
                              </pre>
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Created: {new Date(pr.created_at).toLocaleString()}
                            {pr.merged_at && ` \u2022 Merged: ${new Date(pr.merged_at).toLocaleString()}`}
                          </div>
                          {pr.status === 'created' && (
                            <div className="flex space-x-2 pt-2">
                              <Button
                                size="sm"
                                onClick={() => handleUpdatePRStatus(pr.id, 'merged', 'passed')}
                                disabled={updateStatusMutation.isPending}
                                className="bg-success text-primary-foreground hover:bg-success/90"
                              >
                                Merge
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleUpdatePRStatus(pr.id, 'closed')}
                                disabled={updateStatusMutation.isPending}
                              >
                                Close
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </Layout>
  );
}
