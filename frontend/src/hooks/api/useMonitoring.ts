/**
 * React Query hooks for Monitoring API
 * Feature #75: Migrate MonitoringPage to React Query with caching
 *
 * Note: MonitoringPage has complex modular hooks (useUptimeCheckHandlers, etc.)
 * This file provides React Query wrappers for the core data fetching operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { fetchWithAuth } from './fetchWithAuth'; // Feature #655: Shared auth fetch

// Import the existing MonitoringSummary type from monitoring components
import type { MonitoringSummary } from '../../components/monitoring';

export type { MonitoringSummary };

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
