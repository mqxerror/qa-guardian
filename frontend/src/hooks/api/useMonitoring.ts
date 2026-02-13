/**
 * React Query hooks for Monitoring API
 * Feature #75: Migrate MonitoringPage to React Query with caching
 * Feature #708: Full React Query migration for MonitoringPage settings
 *
 * Note: MonitoringPage has complex modular hooks (useUptimeCheckHandlers, etc.)
 * This file provides React Query wrappers for the core data fetching operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { fetchWithAuth } from './fetchWithAuth'; // Feature #655: Shared auth fetch

// Import types from monitoring components to ensure compatibility
// Feature #708: Use canonical types from monitoring module
import type {
  MonitoringSummary,
  MonitoringSettings,
  RetentionStats,
  StatusPage,
  AvailableCheck,
  OnCallSchedule,
  EscalationPolicy,
  AlertHistoryItem,
  AlertHistoryStats,
  AlertsOverTimeData,
  AlertRoutingRule,
  AlertRoutingLog,
} from '../../components/monitoring';

export type { MonitoringSummary, MonitoringSettings, RetentionStats };

export interface UptimeCheck {
  id: string;
  name: string;
  url: string;
  method: string;
  interval: number;
  timeout: number;
  enabled: boolean;
  status: 'up' | 'down' | 'degraded' | 'pending';
  uptime_24h: number;
  avg_response_time: number;
  last_check_at?: string;
  tags?: string[];
  group?: string;
}

export interface ChecksResponse {
  checks: UptimeCheck[];
  filters: {
    tags: string[];
    groups: string[];
  };
}

export interface MonitoringLocation {
  id: string;
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface ChecksQueryParams {
  tag?: string;
  group?: string;
}

// Query keys factory for cache management
export const monitoringKeys = {
  all: ['monitoring'] as const,
  summary: () => [...monitoringKeys.all, 'summary'] as const,
  checks: () => [...monitoringKeys.all, 'checks'] as const,
  checksWithParams: (params: ChecksQueryParams) => [...monitoringKeys.checks(), params] as const,
  locations: () => [...monitoringKeys.all, 'locations'] as const,
  checkResults: (checkId: string) => [...monitoringKeys.all, 'results', checkId] as const,
  transactions: () => [...monitoringKeys.all, 'transactions'] as const,
  webhooks: () => [...monitoringKeys.all, 'webhooks'] as const,
  performance: () => [...monitoringKeys.all, 'performance'] as const,
};

/**
 * Hook to fetch monitoring summary stats
 * Short staleTime for real-time monitoring data
 */
export function useMonitoringSummary() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: monitoringKeys.summary(),
    queryFn: () => fetchWithAuth('/api/v1/monitoring/summary', token) as Promise<MonitoringSummary>,
    enabled: !!token,
    staleTime: 15 * 1000, // 15 seconds - monitoring data needs to be fresh
    gcTime: 2 * 15 * 1000, // Feature #106: 2x staleTime for garbage collection
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds for real-time updates
  });
}

/**
 * Hook to fetch uptime checks list
 */
export function useMonitoringChecks(params: ChecksQueryParams = {}) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: monitoringKeys.checksWithParams(params),
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.tag) searchParams.set('tag', params.tag);
      if (params.group) searchParams.set('group', params.group);

      const queryString = searchParams.toString();
      const url = `/api/v1/monitoring/checks${queryString ? `?${queryString}` : ''}`;
      return fetchWithAuth(url, token) as Promise<ChecksResponse>;
    },
    enabled: !!token,
    staleTime: 15 * 1000, // 15 seconds
    gcTime: 2 * 15 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch monitoring locations
 */
export function useMonitoringLocations() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: monitoringKeys.locations(),
    queryFn: () => fetchWithAuth('/api/v1/monitoring/locations', token) as Promise<{ locations: MonitoringLocation[] }>,
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes - locations don't change often
    gcTime: 2 * 5 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch check results for a specific check
 */
export function useCheckResults(checkId: string | undefined) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: monitoringKeys.checkResults(checkId || ''),
    queryFn: () => fetchWithAuth(`/api/v1/monitoring/checks/${checkId}/results?limit=20`, token),
    enabled: !!token && !!checkId,
    staleTime: 10 * 1000, // 10 seconds - results update frequently
    gcTime: 2 * 10 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch transactions list
 */
export function useMonitoringTransactions() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: monitoringKeys.transactions(),
    queryFn: () => fetchWithAuth('/api/v1/monitoring/transactions', token),
    enabled: !!token,
    staleTime: 15 * 1000,
    gcTime: 2 * 15 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch webhooks list
 */
export function useMonitoringWebhooks() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: monitoringKeys.webhooks(),
    queryFn: () => fetchWithAuth('/api/v1/monitoring/webhooks', token),
    enabled: !!token,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 30 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch performance checks list
 */
export function useMonitoringPerformance() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: monitoringKeys.performance(),
    queryFn: () => fetchWithAuth('/api/v1/monitoring/performance', token),
    enabled: !!token,
    staleTime: 15 * 1000,
    gcTime: 2 * 15 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to toggle a check's enabled status
 */
export function useToggleCheck() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (checkId: string) => {
      // First get current check state
      const checksData = queryClient.getQueryData<ChecksResponse>(monitoringKeys.checks());
      const check = checksData?.checks.find(c => c.id === checkId);
      const newEnabled = !check?.enabled;

      return fetchWithAuth(`/api/v1/monitoring/checks/${checkId}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: newEnabled }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monitoringKeys.checks() });
      queryClient.invalidateQueries({ queryKey: monitoringKeys.summary() });
    },
  });
}

/**
 * Hook to run a check manually
 */
export function useRunCheck() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (checkId: string) =>
      fetchWithAuth(`/api/v1/monitoring/checks/${checkId}/run`, token, {
        method: 'POST',
      }),
    onSuccess: (_, checkId) => {
      // Invalidate check results and summary
      queryClient.invalidateQueries({ queryKey: monitoringKeys.checkResults(checkId) });
      queryClient.invalidateQueries({ queryKey: monitoringKeys.checks() });
      queryClient.invalidateQueries({ queryKey: monitoringKeys.summary() });
    },
  });
}

/**
 * Hook to delete a check
 */
export function useDeleteCheck() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (checkId: string) =>
      fetchWithAuth(`/api/v1/monitoring/checks/${checkId}`, token, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monitoringKeys.checks() });
      queryClient.invalidateQueries({ queryKey: monitoringKeys.summary() });
    },
  });
}

/**
 * Hook to create a new check
 */
export function useCreateCheck() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<UptimeCheck>) =>
      fetchWithAuth('/api/v1/monitoring/checks', token, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monitoringKeys.checks() });
      queryClient.invalidateQueries({ queryKey: monitoringKeys.summary() });
    },
  });
}

/**
 * Hook to invalidate monitoring queries
 */
export function useInvalidateMonitoring() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: monitoringKeys.all }),
    invalidateSummary: () => queryClient.invalidateQueries({ queryKey: monitoringKeys.summary() }),
    invalidateChecks: () => queryClient.invalidateQueries({ queryKey: monitoringKeys.checks() }),
    invalidateTransactions: () => queryClient.invalidateQueries({ queryKey: monitoringKeys.transactions() }),
    invalidateWebhooks: () => queryClient.invalidateQueries({ queryKey: monitoringKeys.webhooks() }),
    refetchAll: () => {
      queryClient.refetchQueries({ queryKey: monitoringKeys.summary() });
      queryClient.refetchQueries({ queryKey: monitoringKeys.checks() });
    },
  };
}

// ============== Public Status Page Hooks ==============
// Feature #690: Hooks for PublicStatusPage migration

export interface PublicStatusData {
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  primary_color?: string;
  overall_status: 'up' | 'down' | 'degraded';
  checks: {
    id: string;
    type: string;
    name: string;
    status: 'up' | 'down' | 'degraded' | 'unknown';
    uptime?: number;
    avg_response_time?: number;
  }[];
  incidents?: {
    id: string;
    status: string;
    started_at: string;
    ended_at?: string;
    error?: string;
    check_name: string;
  }[];
  manual_incidents?: {
    id: string;
    title: string;
    status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
    impact: 'none' | 'minor' | 'major' | 'critical';
    updates: {
      id: string;
      status: string;
      message: string;
      created_at: string;
    }[];
    created_at: string;
    updated_at: string;
    resolved_at?: string;
  }[];
  last_updated: string;
}

export interface SubscribeResult {
  success: boolean;
  message: string;
  verification_required?: boolean;
  already_subscribed?: boolean;
  dev_verify_url?: string;
}

// Query keys for public status page
export const publicStatusKeys = {
  all: ['publicStatus'] as const,
  detail: (slug: string) => [...publicStatusKeys.all, slug] as const,
};

/**
 * Hook to fetch public status page data (no auth required)
 * Feature #690: Migrate PublicStatusPage to React Query
 */
export function usePublicStatus(slug: string | undefined) {
  return useQuery({
    queryKey: publicStatusKeys.detail(slug || ''),
    queryFn: async () => {
      const response = await fetch(`/api/v1/status/${slug}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Status page not found');
        } else if (response.status === 403) {
          throw new Error('This status page is private');
        } else {
          throw new Error('Failed to load status page');
        }
      }
      return response.json() as Promise<PublicStatusData>;
    },
    enabled: !!slug,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000,
    refetchInterval: 60 * 1000, // Auto-refresh every 60 seconds
    retry: false,
  });
}

/**
 * Hook to subscribe to status page notifications
 * Feature #690: Migrate PublicStatusPage to React Query
 */
export function useStatusSubscribe() {
  return useMutation({
    mutationFn: async ({ slug, email }: { slug: string; email: string }) => {
      const response = await fetch(`/api/v1/status/${slug}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to subscribe');
      }
      return data as SubscribeResult;
    },
  });
}

/**
 * Hook to verify a status page subscription (dev mode)
 * Feature #712: Add hook to eliminate raw fetch() in PublicStatusPage
 */
export function useStatusVerify() {
  return useMutation({
    mutationFn: async (verifyUrl: string) => {
      const response = await fetch(verifyUrl);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify subscription');
      }
      return data as { message: string };
    },
  });
}

// ============== Monitoring Settings Hooks ==============
// Feature #708: React Query hooks for MonitoringPage settings
// Types imported from components/monitoring/types.ts for compatibility

export interface CleanupResult {
  success: boolean;
  cleaned_results: {
    total: number;
    by_type: Record<string, number>;
  };
}

// Extended query keys for settings
export const monitoringSettingsKeys = {
  all: ['monitoring', 'settings'] as const,
  settings: () => [...monitoringSettingsKeys.all, 'config'] as const,
  stats: () => [...monitoringSettingsKeys.all, 'stats'] as const,
  statusPages: () => [...monitoringSettingsKeys.all, 'status-pages'] as const,
  availableChecks: () => [...monitoringSettingsKeys.all, 'available-checks'] as const,
  onCallSchedules: () => [...monitoringSettingsKeys.all, 'on-call'] as const,
  escalationPolicies: () => [...monitoringSettingsKeys.all, 'escalation-policies'] as const,
  alertHistory: (params: AlertHistoryParams) => [...monitoringSettingsKeys.all, 'alert-history', params] as const,
  alertRoutingRules: () => [...monitoringSettingsKeys.all, 'alert-routing', 'rules'] as const,
  alertRoutingLogs: () => [...monitoringSettingsKeys.all, 'alert-routing', 'logs'] as const,
};

/**
 * Hook to fetch monitoring settings
 * Feature #708: Migrate MonitoringPage settings fetch to React Query
 */
export function useMonitoringSettings() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: monitoringSettingsKeys.settings(),
    queryFn: () => fetchWithAuth('/api/v1/monitoring/settings', token) as Promise<MonitoringSettings>,
    enabled: !!token,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to fetch retention stats
 * Feature #708: Migrate MonitoringPage stats fetch to React Query
 */
export function useMonitoringRetentionStats() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: monitoringSettingsKeys.stats(),
    queryFn: () => fetchWithAuth('/api/v1/monitoring/settings/stats', token) as Promise<RetentionStats>,
    enabled: !!token,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000,
  });
}

/**
 * Hook to save monitoring settings
 * Feature #708: Migrate MonitoringPage settings save to React Query mutation
 */
export function useSaveMonitoringSettings() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Partial<MonitoringSettings>) =>
      fetchWithAuth('/api/v1/monitoring/settings', token, {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monitoringSettingsKeys.settings() });
    },
  });
}

/**
 * Hook to run retention cleanup
 * Feature #708: Migrate MonitoringPage cleanup to React Query mutation
 */
export function useRunRetentionCleanup() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchWithAuth('/api/v1/monitoring/settings/cleanup', token, {
        method: 'POST',
      }) as Promise<CleanupResult>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monitoringSettingsKeys.stats() });
    },
  });
}

// ============== Status Pages Hooks ==============
// Feature #708: React Query hooks for status pages
// Types imported from components/monitoring/types.ts

/**
 * Hook to fetch status pages
 * Feature #708: Migrate MonitoringPage status pages fetch to React Query
 */
export function useStatusPages() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: monitoringSettingsKeys.statusPages(),
    queryFn: () => fetchWithAuth('/api/v1/monitoring/status-pages', token) as Promise<{ status_pages: StatusPage[] }>,
    enabled: !!token,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000,
  });
}

/**
 * Hook to fetch available checks for status pages
 * Feature #708: Migrate available checks fetch to React Query
 */
export function useAvailableChecksForStatus() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: monitoringSettingsKeys.availableChecks(),
    queryFn: () => fetchWithAuth('/api/v1/monitoring/status-pages/available-checks', token) as Promise<{ checks: AvailableCheck[] }>,
    enabled: !!token,
    staleTime: 60 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to delete status page
 * Feature #708: Migrate status page delete to React Query mutation
 */
export function useDeleteStatusPage() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pageId: string) =>
      fetchWithAuth(`/api/v1/monitoring/status-pages/${pageId}`, token, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monitoringSettingsKeys.statusPages() });
    },
  });
}

// ============== On-Call Schedule Hooks ==============
// Feature #708: React Query hooks for on-call schedules
// Types imported from components/monitoring/types.ts

/**
 * Hook to fetch on-call schedules
 * Feature #708: Migrate on-call fetch to React Query
 */
export function useOnCallSchedules() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: monitoringSettingsKeys.onCallSchedules(),
    queryFn: () => fetchWithAuth('/api/v1/monitoring/on-call', token) as Promise<{ schedules: OnCallSchedule[] }>,
    enabled: !!token,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000,
  });
}

/**
 * Hook to delete on-call schedule
 * Feature #708: Migrate on-call delete to React Query mutation
 */
export function useDeleteOnCallSchedule() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: string) =>
      fetchWithAuth(`/api/v1/monitoring/on-call/${scheduleId}`, token, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monitoringSettingsKeys.onCallSchedules() });
    },
  });
}

/**
 * Hook to rotate on-call schedule
 * Feature #708: Migrate on-call rotate to React Query mutation
 */
export function useRotateOnCallSchedule() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: string) =>
      fetchWithAuth(`/api/v1/monitoring/on-call/${scheduleId}/rotate`, token, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monitoringSettingsKeys.onCallSchedules() });
    },
  });
}

// ============== Escalation Policy Hooks ==============
// Feature #708: React Query hooks for escalation policies
// Types imported from components/monitoring/types.ts

/**
 * Hook to fetch escalation policies
 * Feature #708: Migrate escalation policies fetch to React Query
 */
export function useEscalationPolicies() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: monitoringSettingsKeys.escalationPolicies(),
    queryFn: () => fetchWithAuth('/api/v1/monitoring/escalation-policies', token) as Promise<{ policies: EscalationPolicy[] }>,
    enabled: !!token,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000,
  });
}

/**
 * Hook to delete escalation policy
 * Feature #708: Migrate escalation policy delete to React Query mutation
 */
export function useDeleteEscalationPolicy() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (policyId: string) =>
      fetchWithAuth(`/api/v1/monitoring/escalation-policies/${policyId}`, token, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monitoringSettingsKeys.escalationPolicies() });
    },
  });
}

/**
 * Hook to test escalation policy
 * Feature #708: Migrate escalation policy test to React Query mutation
 */
export function useTestEscalationPolicy() {
  const token = useAuthStore(state => state.token);

  return useMutation({
    mutationFn: (policyId: string) =>
      fetchWithAuth(`/api/v1/monitoring/escalation-policies/${policyId}/test`, token, {
        method: 'POST',
      }),
  });
}

// ============== Alert History Hooks ==============
// Feature #708: React Query hooks for alert history
// Types imported from components/monitoring/types.ts

export interface AlertHistoryParams {
  severity?: string;
  source?: string;
}

export interface AlertHistoryResponse {
  alerts: AlertHistoryItem[];
  stats: AlertHistoryStats;
  alerts_over_time: AlertsOverTimeData[];
}

/**
 * Hook to fetch alert history
 * Feature #708: Migrate alert history fetch to React Query
 */
export function useAlertHistory(params: AlertHistoryParams = {}) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: monitoringSettingsKeys.alertHistory(params),
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.severity) searchParams.set('severity', params.severity);
      if (params.source) searchParams.set('source', params.source);

      const queryString = searchParams.toString();
      const url = `/api/v1/monitoring/alert-history${queryString ? `?${queryString}` : ''}`;
      return fetchWithAuth(url, token) as Promise<AlertHistoryResponse>;
    },
    enabled: !!token,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000,
  });
}

/**
 * Hook to export alert history
 * Feature #708: Migrate alert history export to React Query mutation
 */
export function useExportAlertHistory() {
  const token = useAuthStore(state => state.token);

  return useMutation({
    mutationFn: async ({ format, severity, source }: { format: 'csv' | 'json'; severity?: string; source?: string }) => {
      const params = new URLSearchParams();
      if (severity) params.append('severity', severity);
      if (source) params.append('source', source);
      params.append('format', format);

      const response = await fetch(`/api/v1/monitoring/alert-history/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to export alert history');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alert-history.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      return { success: true };
    },
  });
}

// ============== Alert Routing Hooks ==============
// Feature #708: React Query hooks for alert routing
// Types imported from components/monitoring/types.ts

/**
 * Hook to fetch alert routing rules
 * Feature #708: Migrate alert routing rules fetch to React Query
 */
export function useAlertRoutingRules() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: monitoringSettingsKeys.alertRoutingRules(),
    queryFn: () => fetchWithAuth('/api/v1/monitoring/alert-routing/rules', token) as Promise<{ rules: AlertRoutingRule[] }>,
    enabled: !!token,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000,
  });
}

/**
 * Hook to fetch alert routing logs
 * Feature #708: Migrate alert routing logs fetch to React Query
 */
export function useAlertRoutingLogs() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: monitoringSettingsKeys.alertRoutingLogs(),
    queryFn: () => fetchWithAuth('/api/v1/monitoring/alert-routing/logs', token) as Promise<{ logs: AlertRoutingLog[] }>,
    enabled: !!token,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000,
  });
}

/**
 * Hook to delete alert routing rule
 * Feature #708: Migrate alert routing rule delete to React Query mutation
 */
export function useDeleteAlertRoutingRule() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ruleId: string) =>
      fetchWithAuth(`/api/v1/monitoring/alert-routing/rules/${ruleId}`, token, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: monitoringSettingsKeys.alertRoutingRules() });
    },
  });
}

/**
 * Hook to invalidate all monitoring settings queries
 * Feature #708: Utility hook for cache invalidation
 */
export function useInvalidateMonitoringSettings() {
  const queryClient = useQueryClient();

  return {
    invalidateSettings: () => queryClient.invalidateQueries({ queryKey: monitoringSettingsKeys.settings() }),
    invalidateStats: () => queryClient.invalidateQueries({ queryKey: monitoringSettingsKeys.stats() }),
    invalidateStatusPages: () => queryClient.invalidateQueries({ queryKey: monitoringSettingsKeys.statusPages() }),
    invalidateOnCallSchedules: () => queryClient.invalidateQueries({ queryKey: monitoringSettingsKeys.onCallSchedules() }),
    invalidateEscalationPolicies: () => queryClient.invalidateQueries({ queryKey: monitoringSettingsKeys.escalationPolicies() }),
    invalidateAlertRoutingRules: () => queryClient.invalidateQueries({ queryKey: monitoringSettingsKeys.alertRoutingRules() }),
    invalidateAlertRoutingLogs: () => queryClient.invalidateQueries({ queryKey: monitoringSettingsKeys.alertRoutingLogs() }),
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: monitoringSettingsKeys.all }),
  };
}
