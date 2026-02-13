// Feature #770: Dependency Policy Enforcement Page
// Extracted from App.tsx as part of Feature #1441
// Feature #710: Migrated to React Query for data fetching

import { useState } from 'react';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { toast } from '../stores/toastStore';
import { Shield, Plus, Play, Check, X, ChevronDown, ChevronRight } from 'lucide-react'; // AlertTriangle unused
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';
// Feature #710: React Query hooks
import {
  useDependencyPolicies,
  usePolicyViolations,
  useCreateDependencyPolicy,
  useTogglePolicyEnabled,
  useDeleteDependencyPolicy,
  useSimulateBuild,
  useOverrideViolation,
  type DependencyPolicy,
  type PolicyViolation,
} from '../hooks/api';

export function DependencyPolicyPage() {
  // Feature #710: React Query hooks for data fetching
  const { data: policiesData, isLoading: isLoadingPolicies } = useDependencyPolicies();
  const { data: violationsData, isLoading: isLoadingViolations } = usePolicyViolations();

  // Mutations
  const createPolicyMutation = useCreateDependencyPolicy();
  const togglePolicyMutation = useTogglePolicyEnabled();
  const deletePolicyMutation = useDeleteDependencyPolicy();
  const simulateBuildMutation = useSimulateBuild();
  const overrideViolationMutation = useOverrideViolation();

  // Derived data
  const policies = policiesData?.policies || [];
  const violations = violationsData?.violations || [];
  const violationSummary = violationsData?.summary || {
    total: 0,
    blocked: 0,
    warned: 0,
    overridden: 0,
    resolved: 0,
  };

  // UI state
  const [expandedViolation, setExpandedViolation] = useState<string | null>(null);

  // Create policy modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPolicy, setNewPolicy] = useState<{
    name: string;
    description: string;
    max_allowed_severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    fail_on_critical: boolean;
    fail_on_high: boolean;
    fail_on_medium: boolean;
    fail_on_low: boolean;
    block_builds: boolean;
    block_deployments: boolean;
    block_pr_merge: boolean;
    grace_period_days: number;
    exception_patterns: string;
    notify_on_violation: boolean;
    notify_channels: ('slack' | 'email' | 'in_app')[];
  }>({
    name: '',
    description: '',
    max_allowed_severity: 'MEDIUM',
    fail_on_critical: true,
    fail_on_high: true,
    fail_on_medium: false,
    fail_on_low: false,
    block_builds: true,
    block_deployments: true,
    block_pr_merge: false,
    grace_period_days: 0,
    exception_patterns: '',
    notify_on_violation: true,
    notify_channels: ['in_app'],
  });

  // Simulate build modal state
  const [showSimulateBuildModal, setShowSimulateBuildModal] = useState(false);
  const [simulateBuildType, setSimulateBuildType] = useState<'ci' | 'deployment' | 'pr'>('ci');
  const [simulationResult, setSimulationResult] = useState<{
    allowed: boolean;
    message: string;
    violations: PolicyViolation[];
  } | null>(null);

  // Filter state
  const [violationStatusFilter, setViolationStatusFilter] = useState<'all' | 'blocked' | 'warned' | 'overridden' | 'resolved'>('all');

  // Create policy handler
  const handleCreatePolicy = async () => {
    try {
      await createPolicyMutation.mutateAsync({
        ...newPolicy,
        exception_patterns: newPolicy.exception_patterns.split(',').map(p => p.trim()).filter(Boolean),
      });
      setShowCreateModal(false);
      setNewPolicy({
        name: '',
        description: '',
        max_allowed_severity: 'MEDIUM',
        fail_on_critical: true,
        fail_on_high: true,
        fail_on_medium: false,
        fail_on_low: false,
        block_builds: true,
        block_deployments: true,
        block_pr_merge: false,
        grace_period_days: 0,
        exception_patterns: '',
        notify_on_violation: true,
        notify_channels: ['in_app'],
      });
      toast.success('Policy created successfully');
    } catch (error) {
      toast.error('Failed to create policy');
    }
  };

  // Toggle policy enabled
  const handleTogglePolicyEnabled = async (policyId: string, enabled: boolean) => {
    try {
      await togglePolicyMutation.mutateAsync({ policyId, enabled });
      toast.success(`Policy ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to update policy');
    }
  };

  // Delete policy
  const handleDeletePolicy = async (policyId: string) => {
    if (!confirm('Are you sure you want to delete this policy?')) return;
    try {
      await deletePolicyMutation.mutateAsync(policyId);
      toast.success('Policy deleted');
    } catch (error) {
      toast.error('Failed to delete policy');
    }
  };

  // Simulate build
  const handleSimulateBuild = async () => {
    setSimulationResult(null);
    try {
      const result = await simulateBuildMutation.mutateAsync({
        project_id: 'demo-project',
        build_type: simulateBuildType,
        pr_number: simulateBuildType === 'pr' ? 123 : undefined,
      });
      setSimulationResult(result);
    } catch (error) {
      toast.error('Failed to simulate build');
    }
  };

  // Override violation
  const handleOverrideViolation = async (violationId: string, reason: string) => {
    try {
      await overrideViolationMutation.mutateAsync({ violationId, reason });
      toast.success('Violation overridden');
    } catch (error) {
      toast.error('Failed to override violation');
    }
  };

  // Filter violations
  const filteredViolations = violations.filter(v =>
    violationStatusFilter === 'all' || v.status === violationStatusFilter
  );

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-destructive bg-destructive/20';
      case 'HIGH': return 'text-warning bg-warning/20';
      case 'MEDIUM': return 'text-warning bg-warning/20';
      case 'LOW': return 'text-primary bg-primary/20';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'blocked': return 'text-destructive bg-destructive/20';
      case 'warned': return 'text-warning bg-warning/20';
      case 'overridden': return 'text-accent bg-accent/20';
      case 'resolved': return 'text-success bg-success/20';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Feature #639: PageHeader component */}
        <PageHeader
          title="Dependency Policy Enforcement"
          description="Block builds with dependencies exceeding severity thresholds"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Security', href: '/security' }, { label: 'Dependency Policy' }]}
          actions={
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSimulateBuildModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <Play className="h-4 w-4" />
                Simulate Build
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Policy
              </button>
            </div>
          }
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Total Policies</div>
            <div className="text-2xl font-bold text-foreground">{policies.length}</div>
          </div>
          <div className="rounded-lg border border-success/30 bg-success/10 p-4">
            <div className="text-sm text-success">Active Policies</div>
            <div className="text-2xl font-bold text-success">{policies.filter(p => p.enabled).length}</div>
          </div>
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <div className="text-sm text-destructive">Blocked Builds</div>
            <div className="text-2xl font-bold text-destructive">{violationSummary.blocked}</div>
          </div>
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
            <div className="text-sm text-warning">Warnings</div>
            <div className="text-2xl font-bold text-warning">{violationSummary.warned}</div>
          </div>
          <div className="rounded-lg border border-accent/30 bg-accent/10 p-4">
            <div className="text-sm text-accent">Overridden</div>
            <div className="text-2xl font-bold text-accent">{violationSummary.overridden}</div>
          </div>
        </div>

        {/* Policies Section */}
        <div className="rounded-lg border border-border bg-card">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Dependency Policies</h2>
          </div>
          <div className="p-6">
            {isLoadingPolicies ? (
              <div className="text-center py-8 text-muted-foreground">Loading policies...</div>
            ) : policies.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground mb-4">No policies configured yet</div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Create Your First Policy
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {policies.map(policy => (
                  <div key={policy.id} className="rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={policy.enabled}
                            onChange={(e) => handleTogglePolicyEnabled(policy.id, e.target.checked)}
                            disabled={togglePolicyMutation.isPending}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-muted peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                        <div>
                          <div className="font-semibold text-foreground">{policy.name}</div>
                          {policy.description && <div className="text-sm text-muted-foreground">{policy.description}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-3 py-1 rounded-full text-sm ${getSeverityColor(policy.max_allowed_severity)}`}>
                          Max: {policy.max_allowed_severity}
                        </span>
                        <div className="flex gap-2 text-sm">
                          {policy.block_builds && <span className="px-2 py-1 bg-muted rounded text-muted-foreground">Builds</span>}
                          {policy.block_deployments && <span className="px-2 py-1 bg-muted rounded text-muted-foreground">Deployments</span>}
                          {policy.block_pr_merge && <span className="px-2 py-1 bg-muted rounded text-muted-foreground">PR Merge</span>}
                        </div>
                        <button
                          onClick={() => handleDeletePolicy(policy.id)}
                          disabled={deletePolicyMutation.isPending}
                          className="text-destructive hover:text-destructive/70 transition-colors disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <span>Fail on: {[
                        policy.fail_on_critical && 'Critical',
                        policy.fail_on_high && 'High',
                        policy.fail_on_medium && 'Medium',
                        policy.fail_on_low && 'Low',
                      ].filter(Boolean).join(', ') || 'None'}</span>
                      {policy.exception_patterns.length > 0 && (
                        <span className="text-muted-foreground/70">| Exceptions: {policy.exception_patterns.join(', ')}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Violations Section */}
        <div className="rounded-lg border border-border bg-card">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Policy Violations</h2>
            <select
              value={violationStatusFilter}
              onChange={(e) => setViolationStatusFilter(e.target.value as typeof violationStatusFilter)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-foreground"
            >
              <option value="all">All Statuses</option>
              <option value="blocked">Blocked</option>
              <option value="warned">Warned</option>
              <option value="overridden">Overridden</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div className="p-6">
            {isLoadingViolations ? (
              <div className="text-center py-8 text-muted-foreground">Loading violations...</div>
            ) : filteredViolations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No violations found. {policies.filter(p => p.enabled).length === 0 && 'Create and enable a policy first.'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredViolations.map(violation => (
                  <div key={violation.id} className="rounded-lg border border-border overflow-hidden">
                    <div
                      className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedViolation(expandedViolation === violation.id ? null : violation.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(violation.status)}`}>
                            {violation.status.toUpperCase()}
                          </span>
                          <div>
                            <div className="font-medium text-foreground">{violation.project_name}</div>
                            <div className="text-sm text-muted-foreground">{violation.policy_name} &bull; {violation.violation_type}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm">
                              <span className="text-destructive">{violation.summary.critical}C</span>
                              <span className="text-warning ml-2">{violation.summary.high}H</span>
                              <span className="text-warning ml-2">{violation.summary.medium}M</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(violation.created_at).toLocaleString()}
                            </div>
                          </div>
                          {expandedViolation === violation.id ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">{violation.message}</div>
                    </div>
                    {expandedViolation === violation.id && (
                      <div className="border-t border-border bg-muted/20 p-4">
                        <div className="text-sm font-medium text-foreground mb-2">Vulnerable Packages:</div>
                        <div className="space-y-2">
                          {violation.violations.map((v, i) => (
                            <div key={i} className="flex items-center justify-between text-sm bg-card p-2 rounded border border-border">
                              <div>
                                <span className="font-mono text-foreground">{v.package_name}@{v.version}</span>
                                <span className={`ml-2 px-2 py-0.5 rounded text-xs ${getSeverityColor(v.severity)}`}>
                                  {v.severity}
                                </span>
                              </div>
                              <div className="text-muted-foreground">
                                {v.cve_id} {v.fixed_version && `→ Fix: ${v.fixed_version}`}
                              </div>
                            </div>
                          ))}
                        </div>
                        {violation.status === 'blocked' && (
                          <div className="mt-4">
                            <button
                              onClick={() => {
                                const reason = prompt('Enter override reason:');
                                if (reason) handleOverrideViolation(violation.id, reason);
                              }}
                              disabled={overrideViolationMutation.isPending}
                              className="px-4 py-2 bg-accent text-primary-foreground rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                            >
                              {overrideViolationMutation.isPending ? 'Processing...' : 'Override & Allow Build'}
                            </button>
                          </div>
                        )}
                        {violation.overridden_by && (
                          <div className="mt-3 text-sm text-accent">
                            Overridden by {violation.overridden_by}: {violation.override_reason}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feature #661: Create Policy Modal - migrated to shared Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Dependency Policy"
        size="lg"
      >
        <ModalHeader onClose={() => setShowCreateModal(false)}>
          Create Dependency Policy
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Policy Name</label>
              <input
                type="text"
                value={newPolicy.name}
                onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                placeholder="e.g., Production Security Policy"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Description</label>
              <textarea
                value={newPolicy.description}
                onChange={(e) => setNewPolicy({ ...newPolicy, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                rows={2}
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Max Allowed Severity</label>
              <select
                value={newPolicy.max_allowed_severity}
                onChange={(e) => setNewPolicy({ ...newPolicy, max_allowed_severity: e.target.value as DependencyPolicy['max_allowed_severity'] })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
              >
                <option value="NONE">None (Block all vulnerabilities)</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Fail On Severity</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPolicy.fail_on_critical}
                    onChange={(e) => setNewPolicy({ ...newPolicy, fail_on_critical: e.target.checked })}
                    className="mr-2 rounded border-border"
                  />
                  Critical
                </label>
                <label className="flex items-center text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPolicy.fail_on_high}
                    onChange={(e) => setNewPolicy({ ...newPolicy, fail_on_high: e.target.checked })}
                    className="mr-2 rounded border-border"
                  />
                  High
                </label>
                <label className="flex items-center text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPolicy.fail_on_medium}
                    onChange={(e) => setNewPolicy({ ...newPolicy, fail_on_medium: e.target.checked })}
                    className="mr-2 rounded border-border"
                  />
                  Medium
                </label>
                <label className="flex items-center text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPolicy.fail_on_low}
                    onChange={(e) => setNewPolicy({ ...newPolicy, fail_on_low: e.target.checked })}
                    className="mr-2 rounded border-border"
                  />
                  Low
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Block On</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPolicy.block_builds}
                    onChange={(e) => setNewPolicy({ ...newPolicy, block_builds: e.target.checked })}
                    className="mr-2 rounded border-border"
                  />
                  CI Builds
                </label>
                <label className="flex items-center text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPolicy.block_deployments}
                    onChange={(e) => setNewPolicy({ ...newPolicy, block_deployments: e.target.checked })}
                    className="mr-2 rounded border-border"
                  />
                  Deployments
                </label>
                <label className="flex items-center text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPolicy.block_pr_merge}
                    onChange={(e) => setNewPolicy({ ...newPolicy, block_pr_merge: e.target.checked })}
                    className="mr-2 rounded border-border"
                  />
                  PR Merge
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Exception Patterns (comma-separated)</label>
              <input
                type="text"
                value={newPolicy.exception_patterns}
                onChange={(e) => setNewPolicy({ ...newPolicy, exception_patterns: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
                placeholder="e.g., lodash*, @internal/*"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <button
            onClick={() => setShowCreateModal(false)}
            className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreatePolicy}
            disabled={!newPolicy.name || createPolicyMutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {createPolicyMutation.isPending ? 'Creating...' : 'Create Policy'}
          </button>
        </ModalFooter>
      </Modal>

      {/* Feature #661: Simulate Build Modal - migrated to shared Modal */}
      <Modal
        isOpen={showSimulateBuildModal}
        onClose={() => { setShowSimulateBuildModal(false); setSimulationResult(null); }}
        title="Simulate Build Check"
        size="md"
      >
        <ModalHeader onClose={() => { setShowSimulateBuildModal(false); setSimulationResult(null); }}>
          Simulate Build Check
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Build Type</label>
              <select
                value={simulateBuildType}
                onChange={(e) => setSimulateBuildType(e.target.value as typeof simulateBuildType)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground"
              >
                <option value="ci">CI Build</option>
                <option value="deployment">Deployment</option>
                <option value="pr">PR Merge</option>
              </select>
            </div>
            <p className="text-sm text-muted-foreground">
              This will simulate a build with vulnerable dependencies (lodash, express, axios)
              to test your policy enforcement.
            </p>
            {simulationResult && (
              <div className={`p-4 rounded-lg ${simulationResult.allowed ? 'bg-success/10 border border-success/30' : 'bg-destructive/10 border border-destructive/30'}`}>
                <div className={`font-semibold flex items-center gap-2 ${simulationResult.allowed ? 'text-success' : 'text-destructive'}`}>
                  {simulationResult.allowed ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  {simulationResult.allowed ? 'Build Allowed' : 'Build Blocked'}
                </div>
                <div className={`text-sm mt-1 ${simulationResult.allowed ? 'text-success/80' : 'text-destructive/80'}`}>
                  {simulationResult.message}
                </div>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <button
            onClick={() => { setShowSimulateBuildModal(false); setSimulationResult(null); }}
            className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleSimulateBuild}
            disabled={simulateBuildMutation.isPending || policies.filter(p => p.enabled).length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Play className="h-4 w-4" />
            {simulateBuildMutation.isPending ? 'Checking...' : 'Run Build Check'}
          </button>
        </ModalFooter>
      </Modal>
    </Layout>
  );
}
