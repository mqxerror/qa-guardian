// Feature #770: Dependency Policy Enforcement Page
// Extracted from App.tsx as part of Feature #1441

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { toast } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';
import { ArrowLeft, Shield, Plus, Play, AlertTriangle, Check, X, ChevronDown, ChevronRight } from 'lucide-react';

// Feature #770: Dependency Policy Enforcement interfaces
interface DependencyPolicy {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  enabled: boolean;
  max_allowed_severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  fail_on_critical: boolean;
  fail_on_high: boolean;
  fail_on_medium: boolean;
  fail_on_low: boolean;
  block_builds: boolean;
  block_deployments: boolean;
  block_pr_merge: boolean;
  grace_period_days: number;
  exception_patterns: string[];
  auto_create_fix_pr: boolean;
  notify_on_violation: boolean;
  notify_channels: ('slack' | 'email' | 'in_app')[];
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

interface PolicyViolation {
  id: string;
  organization_id: string;
  policy_id: string;
  policy_name: string;
  project_id: string;
  project_name: string;
  build_id?: string;
  pr_number?: number;
  violation_type: 'build' | 'deployment' | 'pr_merge';
  status: 'blocked' | 'warned' | 'overridden' | 'resolved';
  violations: Array<{
    package_name: string;
    version: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    cve_id: string;
    title: string;
    fixed_version?: string;
  }>;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  message: string;
  overridden_by?: string;
  overridden_at?: string;
  override_reason?: string;
  created_at: string;
  resolved_at?: string;
}

export function DependencyPolicyPage() {
  const navigate = useNavigate();
  // Feature #232: Fixed to use Zustand auth store instead of non-existent localStorage token
  const token = useAuthStore.getState().token;

  // Policies state
  const [policies, setPolicies] = useState<DependencyPolicy[]>([]);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(true);

  // Violations state
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [violationSummary, setViolationSummary] = useState({
    total: 0,
    blocked: 0,
    warned: 0,
    overridden: 0,
    resolved: 0,
  });
  const [isLoadingViolations, setIsLoadingViolations] = useState(true);
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
  const [isCreatingPolicy, setIsCreatingPolicy] = useState(false);

  // Simulate build modal state
  const [showSimulateBuildModal, setShowSimulateBuildModal] = useState(false);
  const [simulateBuildType, setSimulateBuildType] = useState<'ci' | 'deployment' | 'pr'>('ci');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<{
    allowed: boolean;
    message: string;
    violations: PolicyViolation[];
  } | null>(null);

  // Filter state
  const [violationStatusFilter, setViolationStatusFilter] = useState<'all' | 'blocked' | 'warned' | 'overridden' | 'resolved'>('all');

  // Load policies
  useEffect(() => {
    const loadPolicies = async () => {
      try {
        const response = await fetch('/api/v1/organization/dependency-policies', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setPolicies(data.policies || []);
        }
      } catch (error) {
        console.error('Failed to load policies:', error);
      } finally {
        setIsLoadingPolicies(false);
      }
    };
    loadPolicies();
  }, [token]);

  // Load violations
  useEffect(() => {
    const loadViolations = async () => {
      try {
        const response = await fetch('/api/v1/organization/dependency-policies/violations', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setViolations(data.violations || []);
          setViolationSummary(data.summary);
        }
      } catch (error) {
        console.error('Failed to load violations:', error);
      } finally {
        setIsLoadingViolations(false);
      }
    };
    loadViolations();
  }, [token]);

  // Create policy
  const handleCreatePolicy = async () => {
    setIsCreatingPolicy(true);
    try {
      const response = await fetch('/api/v1/organization/dependency-policies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newPolicy,
          exception_patterns: newPolicy.exception_patterns.split(',').map(p => p.trim()).filter(Boolean),
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setPolicies([...policies, data.policy]);
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
      } else {
        toast.error('Failed to create policy');
      }
    } catch (error) {
      toast.error('Failed to create policy');
    } finally {
      setIsCreatingPolicy(false);
    }
  };

  // Toggle policy enabled
  const togglePolicyEnabled = async (policyId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/v1/organization/dependency-policies/${policyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled }),
      });
      if (response.ok) {
        setPolicies(policies.map(p => p.id === policyId ? { ...p, enabled } : p));
        toast.success(`Policy ${enabled ? 'enabled' : 'disabled'}`);
      }
    } catch (error) {
      toast.error('Failed to update policy');
    }
  };

  // Delete policy
  const deletePolicy = async (policyId: string) => {
    if (!confirm('Are you sure you want to delete this policy?')) return;
    try {
      const response = await fetch(`/api/v1/organization/dependency-policies/${policyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        setPolicies(policies.filter(p => p.id !== policyId));
        toast.success('Policy deleted');
      }
    } catch (error) {
      toast.error('Failed to delete policy');
    }
  };

  // Simulate build
  const handleSimulateBuild = async () => {
    setIsSimulating(true);
    setSimulationResult(null);
    try {
      const response = await fetch('/api/v1/organization/dependency-policies/check-build', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          project_id: 'demo-project',
          build_type: simulateBuildType,
          pr_number: simulateBuildType === 'pr' ? 123 : undefined,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setSimulationResult(data);
        // Reload violations to show new ones
        const violationsResponse = await fetch('/api/v1/organization/dependency-policies/violations', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (violationsResponse.ok) {
          const violationsData = await violationsResponse.json();
          setViolations(violationsData.violations || []);
          setViolationSummary(violationsData.summary);
        }
      }
    } catch (error) {
      toast.error('Failed to simulate build');
    } finally {
      setIsSimulating(false);
    }
  };

  // Override violation
  const overrideViolation = async (violationId: string, reason: string) => {
    try {
      const response = await fetch(`/api/v1/organization/dependency-policies/violations/${violationId}/override`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });
      if (response.ok) {
        const data = await response.json();
        setViolations(violations.map(v => v.id === violationId ? data.violation : v));
        toast.success('Violation overridden');
      }
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
      case 'CRITICAL': return 'text-red-400 bg-red-500/20';
      case 'HIGH': return 'text-orange-400 bg-orange-500/20';
      case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/20';
      case 'LOW': return 'text-blue-400 bg-blue-500/20';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'blocked': return 'text-red-400 bg-red-500/20';
      case 'warned': return 'text-yellow-400 bg-yellow-500/20';
      case 'overridden': return 'text-purple-400 bg-purple-500/20';
      case 'resolved': return 'text-green-400 bg-green-500/20';
      default: return 'text-muted-foreground bg-muted';
    }
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
                <Shield className="h-6 w-6 text-primary" />
                Dependency Policy Enforcement
              </h1>
              <p className="text-muted-foreground">Block builds with dependencies exceeding severity thresholds</p>
            </div>
          </div>
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
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">Total Policies</div>
            <div className="text-2xl font-bold text-foreground">{policies.length}</div>
          </div>
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
            <div className="text-sm text-green-400">Active Policies</div>
            <div className="text-2xl font-bold text-green-400">{policies.filter(p => p.enabled).length}</div>
          </div>
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <div className="text-sm text-red-400">Blocked Builds</div>
            <div className="text-2xl font-bold text-red-400">{violationSummary.blocked}</div>
          </div>
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
            <div className="text-sm text-yellow-400">Warnings</div>
            <div className="text-2xl font-bold text-yellow-400">{violationSummary.warned}</div>
          </div>
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-4">
            <div className="text-sm text-purple-400">Overridden</div>
            <div className="text-2xl font-bold text-purple-400">{violationSummary.overridden}</div>
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
                            onChange={(e) => togglePolicyEnabled(policy.id, e.target.checked)}
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
                          onClick={() => deletePolicy(policy.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
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
                              <span className="text-red-400">{violation.summary.critical}C</span>
                              <span className="text-orange-400 ml-2">{violation.summary.high}H</span>
                              <span className="text-yellow-400 ml-2">{violation.summary.medium}M</span>
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
                                if (reason) overrideViolation(violation.id, reason);
                              }}
                              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                            >
                              Override &amp; Allow Build
                            </button>
                          </div>
                        )}
                        {violation.overridden_by && (
                          <div className="mt-3 text-sm text-purple-400">
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

      {/* Create Policy Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Create Dependency Policy</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
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
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePolicy}
                disabled={!newPolicy.name || isCreatingPolicy}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isCreatingPolicy ? 'Creating...' : 'Create Policy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulate Build Modal */}
      {showSimulateBuildModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg w-full max-w-lg border border-border">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Simulate Build Check</h3>
              <button onClick={() => { setShowSimulateBuildModal(false); setSimulationResult(null); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
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
                <div className={`p-4 rounded-lg ${simulationResult.allowed ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                  <div className={`font-semibold flex items-center gap-2 ${simulationResult.allowed ? 'text-green-400' : 'text-red-400'}`}>
                    {simulationResult.allowed ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    {simulationResult.allowed ? 'Build Allowed' : 'Build Blocked'}
                  </div>
                  <div className={`text-sm mt-1 ${simulationResult.allowed ? 'text-green-400/80' : 'text-red-400/80'}`}>
                    {simulationResult.message}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => { setShowSimulateBuildModal(false); setSimulationResult(null); }}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleSimulateBuild}
                disabled={isSimulating || policies.filter(p => p.enabled).length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Play className="h-4 w-4" />
                {isSimulating ? 'Checking...' : 'Run Build Check'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
