/**
 * React Query hooks for Security Dashboard API
 * Feature #73: Migrate SecurityDashboardPage to React Query with caching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';

// Types matching SecurityDashboardPage interfaces
export interface DashboardFinding {
  id: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  scanId: string;
  scanDate: string;
  ruleId: string;
  ruleName: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  message: string;
  filePath: string;
  line: number;
  column?: number;
  snippet?: string;
  cweId?: string;
  owaspCategory?: string;
  suggestion?: string;
  isFalsePositive?: boolean;
}

export interface SecurityDashboardData {
  findings: DashboardFinding[];
  summary: {
    total: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    byCategory: Record<string, number>;
    projectsScanned: number;
    totalProjects: number;
    falsePositives: number;
  };
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface TrendDataPoint {
  date: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  scanCount: number;
}

export interface TrendsData {
  trends: TrendDataPoint[];
  summary: {
    totalScans: number;
    latestFindings: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    changes: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  scans: Array<{
    date: string;
    scanId: string;
    projectId: string;
    projectName: string;
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }>;
}

export interface DetectedSecret {
  id: string;
  projectId: string;
  projectName: string;
  secretType: string;
  secretTypeName: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  filePath: string;
  line: number;
  column?: number;
  snippet: string;
  detectedAt: string;
  commitSha?: string;
  commitAuthor?: string;
  status: 'active' | 'resolved' | 'false-positive';
  resolvedAt?: string;
  resolvedBy?: string;
  verificationStatus?: 'unverified' | 'active' | 'revoked' | 'unknown';
  lastVerifiedAt?: string;
  lastVerifiedBy?: string;
  verificationError?: string;
}

export interface SecretType {
  id: string;
  name: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SecretsData {
  secrets: DetectedSecret[];
  summary: {
    total: number;
    active: number;
    resolved: number;
    falsePositives: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    bySecretType: Array<{
      type: string;
      name: string;
      count: number;
      severity: string;
      category: string;
    }>;
    byCategory: Record<string, number>;
    byProject: Array<{ id: string; name: string; count: number }>;
  };
  secretTypes: SecretType[];
}

export interface ScanSecretsResult {
  message: string;
  secretsFound: number;
}

// Query params types
export interface DashboardQueryParams {
  severity?: string[];
  category?: string[];
  sortBy?: 'date' | 'severity' | 'project';
  sortOrder?: 'asc' | 'desc';
}

export interface SecretsQueryParams {
  project?: string;
  secretType?: string;
  sortBy?: 'date' | 'severity' | 'project' | 'type';
  sortOrder?: 'asc' | 'desc';
}

export interface TrendsQueryParams {
  days?: number;
}

// API helper
const fetchWithAuth = async (url: string, token: string | null, options?: RequestInit) => {
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
};

// Query keys factory for cache management
export const securityKeys = {
  all: ['security'] as const,
  dashboard: () => [...securityKeys.all, 'dashboard'] as const,
  dashboardWithParams: (params: DashboardQueryParams) => [...securityKeys.dashboard(), params] as const,
  trends: () => [...securityKeys.all, 'trends'] as const,
  trendsWithDays: (days: number) => [...securityKeys.trends(), days] as const,
  secrets: () => [...securityKeys.all, 'secrets'] as const,
  secretsWithParams: (params: SecretsQueryParams) => [...securityKeys.secrets(), params] as const,
  // Feature #83: Dependency page keys
  alertsConfig: () => [...securityKeys.all, 'alertsConfig'] as const,
  alerts: () => [...securityKeys.all, 'alerts'] as const,
  ageConfig: () => [...securityKeys.all, 'ageConfig'] as const,
  dependencies: (projectId: string) => [...securityKeys.all, 'dependencies', projectId] as const,
  policies: () => [...securityKeys.all, 'policies'] as const,
  violations: () => [...securityKeys.all, 'violations'] as const,
  vulnerabilityHistory: (projectId: string) => [...securityKeys.all, 'vulnerabilityHistory', projectId] as const,
  vulnerabilityStats: (projectId: string) => [...securityKeys.all, 'vulnerabilityStats', projectId] as const,
  multiLangConfig: () => [...securityKeys.all, 'multiLangConfig'] as const,
  multiLangStats: () => [...securityKeys.all, 'multiLangStats'] as const,
  allDependencies: (projectId: string) => [...securityKeys.all, 'allDependencies', projectId] as const,
};

/**
 * Hook to fetch SAST dashboard findings with filters
 */
export function useSecurityDashboard(params: DashboardQueryParams = {}) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: securityKeys.dashboardWithParams(params),
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.severity && params.severity.length > 0) {
        searchParams.set('severity', params.severity.join(','));
      }
      if (params.category && params.category.length > 0) {
        searchParams.set('category', params.category.join(','));
      }
      if (params.sortBy) searchParams.set('sortBy', params.sortBy);
      if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

      const queryString = searchParams.toString();
      const url = `/api/v1/sast/dashboard${queryString ? `?${queryString}` : ''}`;
      return fetchWithAuth(url, token) as Promise<SecurityDashboardData>;
    },
    enabled: !!token,
    staleTime: 30 * 1000, // 30 seconds - security data can change frequently
  });
}

/**
 * Hook to fetch security trends over time
 */
export function useSecurityTrends(days: number = 30) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: securityKeys.trendsWithDays(days),
    queryFn: () => {
      return fetchWithAuth(`/api/v1/sast/trends?days=${days}`, token) as Promise<TrendsData>;
    },
    enabled: !!token,
    staleTime: 60 * 1000, // 1 minute - trends don't change as often
  });
}

/**
 * Hook to fetch secrets dashboard with filters
 */
export function useSecretsDashboard(params: SecretsQueryParams = {}) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: securityKeys.secretsWithParams(params),
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.project && params.project !== 'all') {
        searchParams.set('project', params.project);
      }
      if (params.secretType && params.secretType !== 'all') {
        searchParams.set('secretType', params.secretType);
      }
      if (params.sortBy) searchParams.set('sortBy', params.sortBy);
      if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

      const queryString = searchParams.toString();
      const url = `/api/v1/secrets/dashboard${queryString ? `?${queryString}` : ''}`;
      return fetchWithAuth(url, token) as Promise<SecretsData>;
    },
    enabled: !!token,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to trigger secret scanning
 */
export function useScanSecrets() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scanEnvFiles = true, scanCiConfigs = true }: { scanEnvFiles?: boolean; scanCiConfigs?: boolean }) =>
      fetchWithAuth('/api/v1/secrets/scan', token, {
        method: 'POST',
        body: JSON.stringify({ scanEnvFiles, scanCiConfigs }),
      }) as Promise<ScanSecretsResult>,
    onSuccess: () => {
      // Invalidate secrets dashboard to refresh after scan
      queryClient.invalidateQueries({ queryKey: securityKeys.secrets() });
    },
  });
}

/**
 * Hook to verify a secret's status
 */
export function useVerifySecret() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (secretId: string) =>
      fetchWithAuth(`/api/v1/secrets/${secretId}/verify`, token, {
        method: 'POST',
      }),
    onSuccess: () => {
      // Invalidate secrets dashboard to refresh after verification
      queryClient.invalidateQueries({ queryKey: securityKeys.secrets() });
    },
  });
}

/**
 * Hook to invalidate security queries
 */
export function useInvalidateSecurity() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: securityKeys.all }),
    invalidateDashboard: () => queryClient.invalidateQueries({ queryKey: securityKeys.dashboard() }),
    invalidateTrends: () => queryClient.invalidateQueries({ queryKey: securityKeys.trends() }),
    invalidateSecrets: () => queryClient.invalidateQueries({ queryKey: securityKeys.secrets() }),
    refetchDashboard: () => queryClient.refetchQueries({ queryKey: securityKeys.dashboard() }),
    refetchSecrets: () => queryClient.refetchQueries({ queryKey: securityKeys.secrets() }),
    // Feature #83: Additional invalidation methods
    invalidateAlerts: () => queryClient.invalidateQueries({ queryKey: securityKeys.alerts() }),
    invalidatePolicies: () => {
      queryClient.invalidateQueries({ queryKey: securityKeys.policies() });
      queryClient.invalidateQueries({ queryKey: securityKeys.violations() });
    },
    invalidateVulnerabilities: (projectId: string) => {
      queryClient.invalidateQueries({ queryKey: securityKeys.vulnerabilityHistory(projectId) });
      queryClient.invalidateQueries({ queryKey: securityKeys.vulnerabilityStats(projectId) });
    },
  };
}

// ============== Feature #83: Hooks for Security/Dependency Pages ==============

// ============== Dependency Alerts Hooks ==============

/**
 * Hook to fetch dependency alerts config
 */
export function useAlertsConfig() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: securityKeys.alertsConfig(),
    queryFn: () => fetchWithAuth('/api/v1/organization/dependency-alerts/config', token),
    enabled: !!token,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch dependency alerts
 */
export function useDependencyAlerts() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: securityKeys.alerts(),
    queryFn: async () => {
      const data = await fetchWithAuth('/api/v1/organization/dependency-alerts', token);
      return data.alerts || [];
    },
    enabled: !!token,
    staleTime: 30 * 1000, // 30 seconds - alerts change frequently
  });
}

/**
 * Hook to update alerts config
 */
export function useUpdateAlertsConfig() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Record<string, unknown>) =>
      fetchWithAuth('/api/v1/organization/dependency-alerts/config', token, {
        method: 'PUT',
        body: JSON.stringify(config),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: securityKeys.alertsConfig() });
    },
  });
}

/**
 * Hook to dismiss an alert
 */
export function useDismissAlert() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId: string) =>
      fetchWithAuth(`/api/v1/organization/dependency-alerts/${alertId}`, token, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: securityKeys.alerts() });
    },
  });
}

// ============== Dependency Age Hooks ==============

/**
 * Hook to fetch dependency age config
 */
export function useAgeConfig() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: securityKeys.ageConfig(),
    queryFn: () => fetchWithAuth('/api/v1/organization/dependency-age/config', token),
    enabled: !!token,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch project dependencies
 */
export function useProjectDependencies(projectId: string) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: securityKeys.dependencies(projectId),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/projects/${projectId}/dependencies`, token);
      return data.dependencies || [];
    },
    enabled: !!token && !!projectId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to update age config
 */
export function useUpdateAgeConfig() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Record<string, unknown>) =>
      fetchWithAuth('/api/v1/organization/dependency-age/config', token, {
        method: 'PUT',
        body: JSON.stringify(config),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: securityKeys.ageConfig() });
    },
  });
}

// ============== Dependency Policy Hooks ==============

/**
 * Hook to fetch dependency policies
 */
export function useDependencyPolicies() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: securityKeys.policies(),
    queryFn: async () => {
      const data = await fetchWithAuth('/api/v1/organization/dependency-policies', token);
      return data.policies || [];
    },
    enabled: !!token,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to fetch policy violations
 */
export function usePolicyViolations() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: securityKeys.violations(),
    queryFn: async () => {
      const data = await fetchWithAuth('/api/v1/organization/dependency-policies/violations', token);
      return data.violations || [];
    },
    enabled: !!token,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to create policy
 */
export function useCreatePolicy() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (policy: Record<string, unknown>) =>
      fetchWithAuth('/api/v1/organization/dependency-policies', token, {
        method: 'POST',
        body: JSON.stringify(policy),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: securityKeys.policies() });
    },
  });
}

/**
 * Hook to delete policy
 */
export function useDeletePolicy() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (policyId: string) =>
      fetchWithAuth(`/api/v1/organization/dependency-policies/${policyId}`, token, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: securityKeys.policies() });
    },
  });
}

/**
 * Hook to override a violation
 */
export function useOverrideViolation() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ violationId, reason }: { violationId: string; reason: string }) =>
      fetchWithAuth(`/api/v1/organization/dependency-policies/violations/${violationId}/override`, token, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: securityKeys.violations() });
    },
  });
}

// ============== Vulnerability History Hooks ==============

/**
 * Hook to fetch vulnerability history
 */
export function useVulnerabilityHistory(projectId: string) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: securityKeys.vulnerabilityHistory(projectId),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/projects/${projectId}/vulnerability-history`, token);
      return data.vulnerabilities || [];
    },
    enabled: !!token && !!projectId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch vulnerability stats
 */
export function useVulnerabilityStats(projectId: string) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: securityKeys.vulnerabilityStats(projectId),
    queryFn: () => fetchWithAuth(`/api/v1/projects/${projectId}/vulnerability-stats`, token),
    enabled: !!token && !!projectId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to update vulnerability status
 */
export function useUpdateVulnerabilityStatus() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vulnId, status, comment, projectId }: { vulnId: string; status: string; comment?: string; projectId: string }) =>
      fetchWithAuth(`/api/v1/vulnerabilities/${vulnId}/status`, token, {
        method: 'PUT',
        body: JSON.stringify({ status, comment }),
      }),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: securityKeys.vulnerabilityHistory(projectId) });
      queryClient.invalidateQueries({ queryKey: securityKeys.vulnerabilityStats(projectId) });
    },
  });
}

// ============== Multi-Language Dependency Hooks ==============

/**
 * Hook to fetch multi-language config
 */
export function useMultiLangConfig() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: securityKeys.multiLangConfig(),
    queryFn: () => fetchWithAuth('/api/v1/organization/multi-language/config', token),
    enabled: !!token,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch multi-language stats
 */
export function useMultiLangStats() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: securityKeys.multiLangStats(),
    queryFn: () => fetchWithAuth('/api/v1/organization/multi-language/stats', token),
    enabled: !!token,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to fetch all dependencies for a project
 */
export function useAllDependencies(projectId: string) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: securityKeys.allDependencies(projectId),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/projects/${projectId}/all-dependencies`, token);
      return data.dependencies || [];
    },
    enabled: !!token && !!projectId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to update multi-language config
 */
export function useUpdateMultiLangConfig() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Record<string, unknown>) =>
      fetchWithAuth('/api/v1/organization/multi-language/config', token, {
        method: 'PUT',
        body: JSON.stringify(config),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: securityKeys.multiLangConfig() });
    },
  });
}
