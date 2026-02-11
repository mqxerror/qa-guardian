/**
 * React Query hooks for Organization-related pages
 * Feature #84: Migrate remaining pages to React Query
 *
 * This file provides hooks for:
 * - AuditLogsPage: audit logs with filters
 * - ApiKeysPage: API key management
 * - WebhookConfigurationPage: webhook subscriptions
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { fetchWithAuth } from './fetchWithAuth'; // Feature #655: Shared auth fetch

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

// ============== Types ==============

export interface AuditLogEntry {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  resource_name?: string;
  details?: Record<string, unknown>;
  ip_address: string;
  created_at: string;
}

export interface AuditLogsResponse {
  logs: AuditLogEntry[];
  total: number;
}

export interface AuditLogsParams {
  limit?: number;
  offset?: number;
  action?: string;
  resource_type?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key?: string; // Only present at creation time
  key_prefix: string;
  scopes: string[];
  expires_at: string | null;
  created_at: string;
}

export interface CreateApiKeyParams {
  name: string;
  scopes: string[];
  rate_limit?: number;
  rate_limit_window?: number;
  burst_limit?: number;
  burst_window?: number;
}

export interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  events: string[];
  result_statuses?: string[];
  enabled: boolean;
  retry_enabled?: boolean;
  max_retries?: number;
  success_count: number;
  failure_count: number;
  last_triggered_at?: string;
  batch_enabled?: boolean;
  batch_size?: number;
  batch_interval_seconds?: number;
}

export interface WebhookDeliveryLog {
  id: string;
  webhook_id: string;
  event: string;
  success: boolean;
  timestamp: string;
  duration_ms: number;
  attempt: number;
  max_attempts: number;
  responseStatus?: number;
  responseBody?: string;
  error?: string;
}

export interface CreateWebhookParams {
  name: string;
  url: string;
  events: string[];
  enabled?: boolean;
  result_statuses?: string[];
  retry_enabled?: boolean;
  max_retries?: number;
  secret?: string;
  batch_enabled?: boolean;
  batch_size?: number;
  batch_interval_seconds?: number;
}

// Query keys factory for cache management
export const organizationKeys = {
  all: ['organization'] as const,
  // Audit logs
  auditLogs: () => [...organizationKeys.all, 'auditLogs'] as const,
  auditLogsWithParams: (orgId: string, params: AuditLogsParams) => [...organizationKeys.auditLogs(), orgId, params] as const,
  auditLogActions: (orgId: string) => [...organizationKeys.all, 'auditLogActions', orgId] as const,
  auditLogResourceTypes: (orgId: string) => [...organizationKeys.all, 'auditLogResourceTypes', orgId] as const,
  // API keys
  apiKeys: (orgId: string) => [...organizationKeys.all, 'apiKeys', orgId] as const,
  // Webhooks
  webhooks: () => [...organizationKeys.all, 'webhooks'] as const,
  webhookLogs: (webhookId: string) => [...organizationKeys.all, 'webhookLogs', webhookId] as const,
};

// ============== Audit Logs Hooks ==============

/**
 * Hook to fetch audit logs with pagination and filters
 */
export function useAuditLogs(params: AuditLogsParams = {}) {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';

  return useQuery({
    queryKey: organizationKeys.auditLogsWithParams(orgId, params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.limit) searchParams.set('limit', String(params.limit));
      if (params.offset) searchParams.set('offset', String(params.offset));
      if (params.action) searchParams.set('action', params.action);
      if (params.resource_type) searchParams.set('resource_type', params.resource_type);

      const queryString = searchParams.toString();
      const url = `/api/v1/organizations/${orgId}/audit-logs${queryString ? `?${queryString}` : ''}`;
      return fetchWithAuth(url, token) as Promise<AuditLogsResponse>;
    },
    enabled: !!token && !!orgId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 30 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch available audit log actions (for filter dropdown)
 */
export function useAuditLogActions() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';

  return useQuery({
    queryKey: organizationKeys.auditLogActions(orgId),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/organizations/${orgId}/audit-logs/actions`, token);
      return (data.actions || []) as string[];
    },
    enabled: !!token && !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes - actions don't change often
    gcTime: 2 * 5 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch available audit log resource types (for filter dropdown)
 */
export function useAuditLogResourceTypes() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';

  return useQuery({
    queryKey: organizationKeys.auditLogResourceTypes(orgId),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/organizations/${orgId}/audit-logs/resource-types`, token);
      return (data.resource_types || []) as string[];
    },
    enabled: !!token && !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes - resource types don't change often
    gcTime: 2 * 5 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

// ============== API Keys Hooks ==============

/**
 * Hook to fetch API keys
 */
export function useApiKeys() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';

  return useQuery({
    queryKey: organizationKeys.apiKeys(orgId),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/organizations/${orgId}/api-keys`, token);
      return (data.api_keys || []) as ApiKey[];
    },
    enabled: !!token && !!orgId,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 2 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to create a new API key
 */
export function useCreateApiKey() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateApiKeyParams) =>
      fetchWithAuth(`/api/v1/organizations/${orgId}/api-keys`, token, {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.apiKeys(orgId) });
    },
  });
}

/**
 * Hook to delete an API key
 */
export function useDeleteApiKey() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (keyId: string) =>
      fetchWithAuth(`/api/v1/api-keys/${keyId}`, token, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.apiKeys(orgId) });
    },
  });
}

// ============== Webhooks Hooks ==============

/**
 * Hook to fetch webhook subscriptions
 */
export function useWebhooks() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: organizationKeys.webhooks(),
    queryFn: async () => {
      const data = await fetchWithAuth('/api/v1/webhook-subscriptions', token);
      return (data.subscriptions || []) as WebhookSubscription[];
    },
    enabled: !!token,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 30 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to create a webhook subscription
 */
export function useCreateWebhook() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateWebhookParams) =>
      fetchWithAuth('/api/v1/webhook-subscriptions', token, {
        method: 'POST',
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.webhooks() });
    },
  });
}

/**
 * Hook to update a webhook subscription
 */
export function useUpdateWebhook() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ webhookId, ...params }: Partial<CreateWebhookParams> & { webhookId: string }) =>
      fetchWithAuth(`/api/v1/webhook-subscriptions/${webhookId}`, token, {
        method: 'PATCH',
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.webhooks() });
    },
  });
}

/**
 * Hook to delete a webhook subscription
 */
export function useDeleteWebhook() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (webhookId: string) =>
      fetchWithAuth(`/api/v1/webhook-subscriptions/${webhookId}`, token, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.webhooks() });
    },
  });
}

/**
 * Hook to fetch webhook delivery logs
 */
export function useWebhookLogs(webhookId: string) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: organizationKeys.webhookLogs(webhookId),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/webhook-subscriptions/${webhookId}/logs?limit=50`, token);
      return (data.logs || []) as WebhookDeliveryLog[];
    },
    enabled: !!token && !!webhookId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 30 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

// ============== Invalidation Hooks ==============

/**
 * Hook to invalidate organization queries
 */
export function useInvalidateOrganization() {
  const queryClient = useQueryClient();
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: organizationKeys.all }),
    invalidateAuditLogs: () => queryClient.invalidateQueries({ queryKey: organizationKeys.auditLogs() }),
    invalidateApiKeys: () => queryClient.invalidateQueries({ queryKey: organizationKeys.apiKeys(orgId) }),
    invalidateWebhooks: () => queryClient.invalidateQueries({ queryKey: organizationKeys.webhooks() }),
    refetchAuditLogs: () => queryClient.refetchQueries({ queryKey: organizationKeys.auditLogs() }),
    refetchApiKeys: () => queryClient.refetchQueries({ queryKey: organizationKeys.apiKeys(orgId) }),
    refetchWebhooks: () => queryClient.refetchQueries({ queryKey: organizationKeys.webhooks() }),
  };
}
