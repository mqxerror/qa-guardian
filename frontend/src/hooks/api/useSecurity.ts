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
  };
}
