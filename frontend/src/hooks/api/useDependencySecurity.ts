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

import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
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
// Query Keys
// ============================================================================

export const dependencySecurityKeys = {
  // npm Audit keys (Feature #725)
  npmAudit: (projectId: string, includeDev: boolean) => ['npm-audit', projectId, includeDev] as const,
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
// Cache Invalidation Helper
// ============================================================================

export function useInvalidateDependencySecurity() {
  const queryClient = useQueryClient();

  return {
    invalidateNpmAudit: (projectId: string, includeDev: boolean) =>
      queryClient.invalidateQueries({ queryKey: dependencySecurityKeys.npmAudit(projectId, includeDev) }),
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['npm-audit'] });
    },
  };
}
