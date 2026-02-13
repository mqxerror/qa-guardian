/**
 * React Query hooks for Dependency Security pages
 * Feature #710: Deep React Query migration - eliminate raw fetch() calls
 *
 * Covers:
 * - NpmAuditPage (Feature #725): npm audit scanning hooks
 *
 * Feature #863: Removed dead hooks after page cuts:
 *   - DependencyPolicyPage hooks (Feature #770 page removed)
 *   - DependencyAlertsPage hooks (Feature #767 page removed)
 *   - AutoPRPage hooks (Feature #771 page removed)
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { fetchWithAuth } from './fetchWithAuth';

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
// Types - LicenseCompliancePage (Feature #868)
// ============================================================================

/** Violation returned by the license compliance API */
export interface LicenseViolation {
  package: string;
  version: string;
  license: string;
  spdx_id: string | null;
  violation_type: 'blocklist' | 'not_in_allowlist' | 'unknown_license';
  severity: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
}

/** Package info from license compliance scan */
export interface LicensePackage {
  name: string;
  version: string;
  license: string;
  spdx_id: string | null;
  repository?: string;
  publisher?: string;
}

/** Full response from GET /api/v1/projects/:projectId/license-compliance */
export interface LicenseComplianceResult {
  project_id: string;
  project_name: string;
  scanned_at: string;
  summary: {
    total_packages: number;
    compliant_packages: number;
    violation_count: number;
    unknown_license_count: number;
    compliance_percentage: number;
  };
  violations: LicenseViolation[];
  license_summary: Record<string, number>;
  policy_applied: {
    name: string;
    allowlist: string[];
    blocklist: string[];
  };
  severity_breakdown: { critical: number; high: number; medium: number; low: number };
  packages?: LicensePackage[];
}

/** Organization license policy from GET /api/v1/license-policy */
export interface OrgLicensePolicy {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  allowlist: string[];
  blocklist: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Query Keys
// ============================================================================

export const dependencySecurityKeys = {
  // npm Audit keys (Feature #725)
  npmAudit: (projectId: string, includeDev: boolean) => ['npm-audit', projectId, includeDev] as const,
  // License compliance keys (Feature #868)
  licenseCompliance: (projectId: string) => ['license-compliance', projectId] as const,
  licensePolicy: () => ['license-policy'] as const,
};

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
// Hooks - LicenseCompliancePage (Feature #868)
// ============================================================================

/**
 * Fetch license compliance scan results for a specific project.
 * Calls GET /api/v1/projects/:projectId/license-compliance?include_packages=true
 */
export function useLicenseCompliance(
  projectId: string,
  enabled: boolean = true,
): UseQueryResult<LicenseComplianceResult> {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: dependencySecurityKeys.licenseCompliance(projectId),
    queryFn: async () => {
      const response = await fetchWithAuth<LicenseComplianceResult>(
        `/api/v1/projects/${projectId}/license-compliance?include_packages=true`,
        token
      );
      return response;
    },
    enabled: !!token && !!projectId && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Trigger a fresh license compliance scan (invalidates the cached query).
 */
export function useRunLicenseScan(projectId: string) {
  const queryClient = useQueryClient();

  return {
    runScan: () => queryClient.invalidateQueries({
      queryKey: dependencySecurityKeys.licenseCompliance(projectId),
    }),
  };
}

/**
 * Fetch organization's license policy.
 * Calls GET /api/v1/license-policy
 */
export function useLicensePolicy(): UseQueryResult<OrgLicensePolicy> {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: dependencySecurityKeys.licensePolicy(),
    queryFn: async () => {
      const response = await fetchWithAuth<OrgLicensePolicy>(
        '/api/v1/license-policy',
        token
      );
      return response;
    },
    enabled: !!token,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Update organization's license policy.
 * Calls PUT /api/v1/license-policy
 */
export function useUpdateLicensePolicy() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { name?: string; description?: string; allowlist?: string[]; blocklist?: string[] }) => {
      const response = await fetchWithAuth<{ success: boolean; policy: OrgLicensePolicy; message: string }>(
        '/api/v1/license-policy',
        token,
        { method: 'PUT', body: JSON.stringify(updates), headers: { 'Content-Type': 'application/json' } }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.licensePolicy() });
    },
  });
}

// ============================================================================
// Cache Invalidation Helper
// ============================================================================

export function useInvalidateDependencySecurity() {
  const queryClient = useQueryClient();

  return {
    invalidateNpmAudit: (projectId: string, includeDev: boolean) =>
      queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.npmAudit(projectId, includeDev) }),
    invalidateLicenseCompliance: (projectId: string) =>
      queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.licenseCompliance(projectId) }),
    invalidateLicensePolicy: () =>
      queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.licensePolicy() }),
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['npm-audit'] });
      queryClient.invalidateQueries({ queryKey: ['license-compliance'] });
      queryClient.invalidateQueries({ queryKey: ['license-policy'] });
    },
  };
}
