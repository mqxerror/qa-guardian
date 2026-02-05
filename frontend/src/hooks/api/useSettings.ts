/**
 * React Query hooks for Settings Page APIs
 * Feature #80: Migrate SettingsPage to React Query with caching
 *
 * This file provides hooks for all Settings page tabs:
 * - Team: members, invitations
 * - API Keys: listing, creation, deletion
 * - Webhooks: listing, creation, deletion
 * - Audit Logs: logs with filtering
 * - AI Configuration: AI status
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';

// Types for Team management
export interface Member {
  id: string;
  user_id: string;
  organization_id: string;
  name: string;
  email: string;
  role: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

// Types for API Keys
export interface ApiKey {
  id: string;
  name: string;
  key?: string; // Only present when newly created
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
  scopes: string[];
}

// Types for Webhooks
export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
  last_triggered_at?: string;
  failure_count: number;
}

// Types for Audit Logs
export interface AuditLog {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  user_name: string;
  user_email: string;
  details: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export interface AuditLogFilters {
  action?: string;
  resource_type?: string;
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
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.error || `API error: ${response.status}`);
  }

  return response.json();
};

// Query keys factory for cache management
export const settingsKeys = {
  all: ['settings'] as const,
  // Team
  members: (orgId: string | number) => [...settingsKeys.all, 'members', String(orgId)] as const,
  invitations: (orgId: string | number) => [...settingsKeys.all, 'invitations', String(orgId)] as const,
  // API Keys
  apiKeys: (orgId: string | number) => [...settingsKeys.all, 'apiKeys', String(orgId)] as const,
  // Webhooks
  webhooks: (orgId: string | number) => [...settingsKeys.all, 'webhooks', String(orgId)] as const,
  // Audit Logs
  auditLogs: (orgId: string | number, filters?: AuditLogFilters) => [...settingsKeys.all, 'auditLogs', String(orgId), filters] as const,
  auditLogActions: (orgId: string | number) => [...settingsKeys.all, 'auditLogActions', String(orgId)] as const,
  auditLogResourceTypes: (orgId: string | number) => [...settingsKeys.all, 'auditLogResourceTypes', String(orgId)] as const,
  // AI Status
  aiStatus: () => [...settingsKeys.all, 'aiStatus'] as const,
};

// ============== Team Hooks ==============

/**
 * Hook to fetch organization members
 */
export function useMembers(orgId: string | number = 1) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: settingsKeys.members(orgId),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/organizations/${orgId}/members`, token);
      return (data.members || []) as Member[];
    },
    enabled: !!token,
    staleTime: 60 * 1000, // 1 minute - members don't change often
  });
}

/**
 * Hook to fetch pending invitations
 */
export function useInvitations(orgId: string | number = 1) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: settingsKeys.invitations(orgId),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/organizations/${orgId}/invitations`, token);
      return (data.invitations || []) as Invitation[];
    },
    enabled: !!token,
    staleTime: 30 * 1000, // 30 seconds - invitations may be accepted
  });
}

/**
 * Hook to send invitation
 */
export function useSendInvitation(orgId: string | number = 1) {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      fetchWithAuth(`/api/v1/organizations/${orgId}/invitations`, token, {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.invitations(orgId) });
    },
  });
}

/**
 * Hook to cancel invitation
 */
export function useCancelInvitation(orgId: string | number = 1) {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) =>
      fetchWithAuth(`/api/v1/organizations/${orgId}/invitations/${invitationId}`, token, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.invitations(orgId) });
    },
  });
}

/**
 * Hook to remove member
 */
export function useRemoveMember(orgId: string | number = 1) {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      fetchWithAuth(`/api/v1/organizations/${orgId}/members/${userId}`, token, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.members(orgId) });
    },
  });
}

/**
 * Hook to update member role
 */
export function useUpdateMemberRole(orgId: string | number = 1) {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      fetchWithAuth(`/api/v1/organizations/${orgId}/members/${userId}/role`, token, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.members(orgId) });
    },
  });
}

// ============== API Keys Hooks ==============

/**
 * Hook to fetch API keys
 */
export function useApiKeys(orgId: string | number | undefined) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: settingsKeys.apiKeys(orgId || 'none'),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/organizations/${orgId}/api-keys`, token);
      return (data.keys || []) as ApiKey[];
    },
    enabled: !!token && !!orgId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to create API key
 */
export function useCreateApiKey(orgId: string | number | undefined) {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, scopes, expiresIn }: { name: string; scopes: string[]; expiresIn?: number }) =>
      fetchWithAuth(`/api/v1/organizations/${orgId}/api-keys`, token, {
        method: 'POST',
        body: JSON.stringify({ name, scopes, expires_in_days: expiresIn }),
      }),
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: settingsKeys.apiKeys(orgId) });
      }
    },
  });
}

/**
 * Hook to delete API key
 */
export function useDeleteApiKey(orgId: string | number | undefined) {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (keyId: string) =>
      fetchWithAuth(`/api/v1/organizations/${orgId}/api-keys/${keyId}`, token, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: settingsKeys.apiKeys(orgId) });
      }
    },
  });
}

// ============== Webhooks Hooks ==============

/**
 * Hook to fetch webhooks
 */
export function useWebhooks(orgId: string | number | undefined) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: settingsKeys.webhooks(orgId || 'none'),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/organizations/${orgId}/webhooks`, token);
      return (data.webhooks || []) as Webhook[];
    },
    enabled: !!token && !!orgId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to create webhook
 */
export function useCreateWebhook(orgId: string | number | undefined) {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ url, events }: { url: string; events: string[] }) =>
      fetchWithAuth(`/api/v1/organizations/${orgId}/webhooks`, token, {
        method: 'POST',
        body: JSON.stringify({ url, events }),
      }),
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: settingsKeys.webhooks(orgId) });
      }
    },
  });
}

/**
 * Hook to delete webhook
 */
export function useDeleteWebhook(orgId: string | number | undefined) {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (webhookId: string) =>
      fetchWithAuth(`/api/v1/organizations/${orgId}/webhooks/${webhookId}`, token, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: settingsKeys.webhooks(orgId) });
      }
    },
  });
}

/**
 * Hook to toggle webhook active status
 */
export function useToggleWebhook(orgId: string | number | undefined) {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ webhookId, active }: { webhookId: string; active: boolean }) =>
      fetchWithAuth(`/api/v1/organizations/${orgId}/webhooks/${webhookId}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }),
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: settingsKeys.webhooks(orgId) });
      }
    },
  });
}

// ============== Audit Logs Hooks ==============

/**
 * Hook to fetch audit logs with filtering
 */
export function useAuditLogs(orgId: string | number | undefined, filters: AuditLogFilters = {}) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: settingsKeys.auditLogs(orgId || 'none', filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.action) params.set('action', filters.action);
      if (filters.resource_type) params.set('resource_type', filters.resource_type);
      if (filters.days) params.set('days', String(filters.days));

      const queryString = params.toString();
      const url = `/api/v1/organizations/${orgId}/audit-logs${queryString ? `?${queryString}` : ''}`;
      const data = await fetchWithAuth(url, token);
      return (data.logs || []) as AuditLog[];
    },
    enabled: !!token && !!orgId,
    staleTime: 30 * 1000, // 30 seconds - logs update frequently
  });
}

/**
 * Hook to fetch available audit log actions
 */
export function useAuditLogActions(orgId: string | number | undefined) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: settingsKeys.auditLogActions(orgId || 'none'),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/organizations/${orgId}/audit-logs/actions`, token);
      return (data.actions || []) as string[];
    },
    enabled: !!token && !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes - actions rarely change
  });
}

/**
 * Hook to fetch available audit log resource types
 */
export function useAuditLogResourceTypes(orgId: string | number | undefined) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: settingsKeys.auditLogResourceTypes(orgId || 'none'),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/organizations/${orgId}/audit-logs/resource-types`, token);
      return (data.resource_types || []) as string[];
    },
    enabled: !!token && !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes - resource types rarely change
  });
}

// ============== AI Configuration Hooks ==============

/**
 * Hook to fetch AI status - reuses from useMCPChat
 */
export { useAIStatus } from './useMCPChat';

// ============== Invalidation Hooks ==============

/**
 * Hook to invalidate settings queries
 */
export function useInvalidateSettings() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: settingsKeys.all }),
    invalidateMembers: (orgId: string | number) =>
      queryClient.invalidateQueries({ queryKey: settingsKeys.members(orgId) }),
    invalidateInvitations: (orgId: string | number) =>
      queryClient.invalidateQueries({ queryKey: settingsKeys.invitations(orgId) }),
    invalidateApiKeys: (orgId: string | number) =>
      queryClient.invalidateQueries({ queryKey: settingsKeys.apiKeys(orgId) }),
    invalidateWebhooks: (orgId: string | number) =>
      queryClient.invalidateQueries({ queryKey: settingsKeys.webhooks(orgId) }),
    invalidateAuditLogs: (orgId: string | number) =>
      queryClient.invalidateQueries({ queryKey: settingsKeys.auditLogs(orgId) }),
  };
}
