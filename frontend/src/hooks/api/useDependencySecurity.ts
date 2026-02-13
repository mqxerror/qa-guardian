/**
 * React Query hooks for Dependency Security pages
 * Feature #710: Deep React Query migration - eliminate raw fetch() calls
 *
 * Covers:
 * - DependencyPolicyPage (Feature #770)
 * - DependencyAlertsPage (Feature #767)
 * - DependencyAgePage (Feature #772)
 * - AutoPRPage (Feature #771)
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { fetchWithAuth } from './fetchWithAuth';

// ============================================================================
// Types - DependencyPolicyPage
// ============================================================================

export interface DependencyPolicy {
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

export interface PolicyViolation {
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

export interface ViolationSummary {
  total: number;
  blocked: number;
  warned: number;
  overridden: number;
  resolved: number;
}

export interface CreatePolicyInput {
  name: string;
  description?: string;
  max_allowed_severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  fail_on_critical: boolean;
  fail_on_high: boolean;
  fail_on_medium: boolean;
  fail_on_low: boolean;
  block_builds: boolean;
  block_deployments: boolean;
  block_pr_merge: boolean;
  grace_period_days?: number;
  exception_patterns?: string[];
  notify_on_violation?: boolean;
  notify_channels?: ('slack' | 'email' | 'in_app')[];
}

export interface SimulateBuildResult {
  allowed: boolean;
  message: string;
  violations: PolicyViolation[];
}

// ============================================================================
// Types - DependencyAlertsPage
// ============================================================================

export interface DependencyAlertConfig {
  enabled: boolean;
  severity_threshold: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  notify_email: boolean;
  notify_slack: boolean;
  slack_webhook?: string;
  notify_in_app: boolean;
  auto_create_issues: boolean;
}

export interface CVEAlert {
  id: string;
  cve_id: string;
  published_at: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  cvss_score: number;
  title: string;
  description: string;
  affected_package: string;
  affected_versions: string;
  fixed_version?: string;
  references: string[];
  affected_projects: Array<{
    project_id: string;
    project_name: string;
    installed_version: string;
    is_direct_dependency: boolean;
  }>;
  status: 'new' | 'acknowledged' | 'dismissed' | 'fixed';
  acknowledged_by?: string;
  acknowledged_at?: string;
  dismissed_reason?: string;
}

export interface AlertSummary {
  total: number;
  new: number;
  acknowledged: number;
  dismissed: number;
  fixed: number;
  by_severity: { critical: number; high: number; medium: number; low: number };
}

// ============================================================================
// Types - AutoPRPage
// ============================================================================

export interface AutoPRConfig {
  enabled: boolean;
  auto_merge_patch: boolean;
  auto_merge_minor: boolean;
  require_tests_pass: boolean;
  include_changelog: boolean;
  assignees: string[];
  labels: string[];
  branch_prefix: string;
  schedule: 'immediate' | 'daily' | 'weekly';
  max_prs_per_day: number;
}

export interface AutoPR {
  id: string;
  project_id: string;
  project_name: string;
  dependency_name: string;
  current_version: string;
  target_version: string;
  update_type: 'patch' | 'minor' | 'major';
  vulnerability?: {
    cve_id: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
  };
  pr_number?: number;
  pr_url?: string;
  pr_title: string;
  pr_body: string;
  branch_name: string;
  status: 'pending' | 'created' | 'merged' | 'closed' | 'failed';
  changelog?: string;
  tests_status?: 'pending' | 'running' | 'passed' | 'failed';
  created_at: string;
  updated_at: string;
  merged_at?: string;
}

export interface AutoPRSummary {
  total: number;
  pending: number;
  created: number;
  merged: number;
  closed: number;
  failed: number;
}

export interface ScanAndCreateResult {
  prs_created: AutoPR[];
  total_scanned: number;
  message: string;
}

// ============================================================================
// Types - NpmAuditPage (Feature #725)
// ============================================================================

/** Single vulnerability detail from npm audit */
export interface NpmAuditVulnerability {
  cve_id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  published_date: string;
  patched_version: string;
  cwe_ids: string[];
  references: string[];
}

/** A scanned dependency with its vulnerability details */
export interface NpmAuditDependency {
  name: string;
  version: string;
  latest_version: string;
  type: 'production' | 'development';
  vulnerable: boolean;
  vulnerability_count: number;
  vulnerabilities: NpmAuditVulnerability[];
  update_available: boolean;
  outdated: boolean;
}

/** Upgrade suggestion for a vulnerable package */
export interface NpmAuditUpgradeSuggestion {
  package: string;
  current_version: string;
  recommended_version: string;
  vulnerabilities_fixed: number;
  severity_fixed: string[];
  upgrade_command: string;
  breaking_changes_likely: boolean;
}

/** Recommendation from the scan */
export interface NpmAuditRecommendation {
  priority: string;
  message: string;
  action: string;
}

/** Full response from /api/v1/security/dependencies/:projectId */
export interface NpmAuditScanResult {
  project_id: string;
  project_name: string;
  scanned_at: string;
  source: string;
  scan_warning?: string;
  summary: {
    total_dependencies: number;
    production_dependencies: number;
    dev_dependencies: number;
    vulnerable_dependencies: number;
    total_vulnerabilities: number;
    severity_breakdown: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    npm_audit_totals: {
      critical: number;
      high: number;
      moderate: number;
      low: number;
      info: number;
      total: number;
    };
    outdated_dependencies: number;
    updates_available: number;
  };
  dependencies: NpmAuditDependency[];
  upgrade_suggestions: NpmAuditUpgradeSuggestion[];
  recommendations: NpmAuditRecommendation[];
}

// ============================================================================
// Query Keys
// ============================================================================

export const dependencySecurityKeys = {
  // Policy keys
  policies: ['dependency-policies'] as const,
  violations: ['dependency-violations'] as const,

  // Alerts keys
  alertConfig: ['dependency-alerts', 'config'] as const,
  alerts: ['dependency-alerts'] as const,

  // Auto-PR keys
  autoPRConfig: ['auto-pr', 'config'] as const,
  autoPRs: ['auto-pr'] as const,

  // npm Audit keys (Feature #725)
  npmAudit: (projectId: string, includeDev: boolean) => ['npm-audit', projectId, includeDev] as const,
};

// ============================================================================
// Hooks - DependencyPolicyPage
// ============================================================================

export function useDependencyPolicies() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: dependencySecurityKeys.policies,
    queryFn: async () => {
      const response = await fetchWithAuth<{ policies: DependencyPolicy[] }>(
        '/api/v1/organization/dependency-policies',
        token
      );
      return response;
    },
    enabled: !!token,
  });
}

export function usePolicyViolations() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: dependencySecurityKeys.violations,
    queryFn: async () => {
      const response = await fetchWithAuth<{ violations: PolicyViolation[]; summary: ViolationSummary }>(
        '/api/v1/organization/dependency-policies/violations',
        token
      );
      return response;
    },
    enabled: !!token,
  });
}

export function useCreateDependencyPolicy() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePolicyInput) => {
      const response = await fetchWithAuth<{ policy: DependencyPolicy }>(
        '/api/v1/organization/dependency-policies',
        token,
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.policies });
    },
  });
}

export function useTogglePolicyEnabled() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ policyId, enabled }: { policyId: string; enabled: boolean }) => {
      const response = await fetchWithAuth<{ policy: DependencyPolicy }>(
        `/api/v1/organization/dependency-policies/${policyId}`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify({ enabled }),
        }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.policies });
    },
  });
}

export function useDeleteDependencyPolicy() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (policyId: string) => {
      await fetchWithAuth(
        `/api/v1/organization/dependency-policies/${policyId}`,
        token,
        { method: 'DELETE' }
      );
      return policyId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.policies });
    },
  });
}

export function useSimulateBuild() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { project_id: string; build_type: 'ci' | 'deployment' | 'pr'; pr_number?: number }) => {
      const response = await fetchWithAuth<SimulateBuildResult>(
        '/api/v1/organization/dependency-policies/check-build',
        token,
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );
      return response;
    },
    onSuccess: () => {
      // Refresh violations after simulation
      queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.violations });
    },
  });
}

export function useOverrideViolation() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ violationId, reason }: { violationId: string; reason: string }) => {
      const response = await fetchWithAuth<{ violation: PolicyViolation }>(
        `/api/v1/organization/dependency-policies/violations/${violationId}/override`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({ reason }),
        }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.violations });
    },
  });
}

// ============================================================================
// Hooks - DependencyAlertsPage
// ============================================================================

export function useDependencyAlertConfig() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: dependencySecurityKeys.alertConfig,
    queryFn: async () => {
      const response = await fetchWithAuth<{ config: DependencyAlertConfig }>(
        '/api/v1/organization/dependency-alerts/config',
        token
      );
      return response;
    },
    enabled: !!token,
  });
}

export function useDependencyAlerts() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: dependencySecurityKeys.alerts,
    queryFn: async () => {
      const response = await fetchWithAuth<{ alerts: CVEAlert[]; summary: AlertSummary }>(
        '/api/v1/organization/dependency-alerts',
        token
      );
      return response;
    },
    enabled: !!token,
  });
}

export function useUpdateDependencyAlertConfig() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<DependencyAlertConfig>) => {
      const response = await fetchWithAuth<{ config: DependencyAlertConfig; message: string }>(
        '/api/v1/organization/dependency-alerts/config',
        token,
        {
          method: 'PATCH',
          body: JSON.stringify(updates),
        }
      );
      return response;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(dependencySecurityKeys.alertConfig, { config: data.config });
    },
  });
}

export function useSimulateCVE() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { package_name: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' }) => {
      const response = await fetchWithAuth<{ alert: CVEAlert; notifications_sent: string[]; message: string }>(
        '/api/v1/organization/dependency-alerts/simulate-cve',
        token,
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.alerts });
    },
  });
}

export function useUpdateAlertStatus() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ alertId, status, dismissed_reason }: { alertId: string; status: 'acknowledged' | 'dismissed' | 'fixed'; dismissed_reason?: string }) => {
      const response = await fetchWithAuth<{ alert: CVEAlert }>(
        `/api/v1/organization/dependency-alerts/${alertId}`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify({ status, dismissed_reason }),
        }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.alerts });
    },
  });
}

// ============================================================================
// Hooks - AutoPRPage
// ============================================================================

export function useAutoPRConfig() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: dependencySecurityKeys.autoPRConfig,
    queryFn: async () => {
      const response = await fetchWithAuth<{ config: AutoPRConfig }>(
        '/api/v1/organization/auto-pr/config',
        token
      );
      return response;
    },
    enabled: !!token,
  });
}

export function useAutoPRs() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: dependencySecurityKeys.autoPRs,
    queryFn: async () => {
      const response = await fetchWithAuth<{ prs: AutoPR[]; summary: AutoPRSummary }>(
        '/api/v1/organization/auto-pr',
        token
      );
      return response;
    },
    enabled: !!token,
  });
}

export function useUpdateAutoPRConfig() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<AutoPRConfig>) => {
      const response = await fetchWithAuth<{ config: AutoPRConfig; message: string }>(
        '/api/v1/organization/auto-pr/config',
        token,
        {
          method: 'PATCH',
          body: JSON.stringify(updates),
        }
      );
      return response;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(dependencySecurityKeys.autoPRConfig, { config: data.config });
    },
  });
}

export function useScanAndCreatePRs() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { project_id: string }) => {
      const response = await fetchWithAuth<ScanAndCreateResult>(
        '/api/v1/organization/auto-pr/scan-and-create',
        token,
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.autoPRs });
    },
  });
}

export function useUpdateAutoPRStatus() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ prId, status, tests_status }: { prId: string; status: 'merged' | 'closed'; tests_status?: 'passed' | 'failed' }) => {
      const response = await fetchWithAuth<{ pr: AutoPR }>(
        `/api/v1/organization/auto-pr/${prId}`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify({ status, tests_status }),
        }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.autoPRs });
    },
  });
}

// ============================================================================
// Hooks - NpmAuditPage (Feature #725)
// ============================================================================

/**
 * Fetch npm audit scan results for a specific project.
 * Calls GET /api/v1/security/dependencies/:projectId?include_dev=<bool>
 *
 * The query is only enabled when a projectId is provided and the user is
 * authenticated. Callers can set `enabled: false` to defer execution until
 * the user explicitly triggers a scan via the mutation hook.
 */
export function useNpmAuditScan(
  projectId: string,
  includeDev: boolean = true,
  enabled: boolean = true,
): UseQueryResult<NpmAuditScanResult> {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: dependencySecurityKeys.npmAudit(projectId, includeDev),
    queryFn: async () => {
      const response = await fetchWithAuth<NpmAuditScanResult>(
        `/api/v1/security/dependencies/${projectId}?include_dev=${includeDev}`,
        token
      );
      return response;
    },
    enabled: !!token && !!projectId && enabled,
    // Scans are expensive; keep results fresh for 5 minutes
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Trigger a fresh npm audit scan (invalidates the cached query).
 * This allows a "Run Scan" button to re-fetch without waiting for staleTime.
 */
export function useRunNpmAuditScan(projectId: string, includeDev: boolean = true) {
  const queryClient = useQueryClient();

  return {
    runScan: () => queryClient.invalidateQueries({
      queryKey: dependencySecurityKeys.npmAudit(projectId, includeDev),
    }),
  };
}

// ============================================================================
// Cache Invalidation Helper
// ============================================================================

export function useInvalidateDependencySecurity() {
  const queryClient = useQueryClient();

  return {
    invalidatePolicies: () => queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.policies }),
    invalidateViolations: () => queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.violations }),
    invalidateAlerts: () => queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.alerts }),
    invalidateAlertConfig: () => queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.alertConfig }),
    invalidateAutoPRs: () => queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.autoPRs }),
    invalidateAutoPRConfig: () => queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.autoPRConfig }),
    invalidateNpmAudit: (projectId: string, includeDev: boolean) =>
      queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.npmAudit(projectId, includeDev) }),
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['dependency-policies'] });
      queryClient.invalidateQueries({ queryKey: ['dependency-violations'] });
      queryClient.invalidateQueries({ queryKey: ['dependency-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['auto-pr'] });
      queryClient.invalidateQueries({ queryKey: ['npm-audit'] });
    },
  };
}
