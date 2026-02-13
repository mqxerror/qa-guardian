/**
 * React Query hooks for OrganizationSettingsPage
 * Feature #709: Migrate OrganizationSettingsPage to React Query
 *
 * This file provides hooks for:
 * - Sessions management
 * - Artifact retention and cleanup
 * - Storage usage
 * - MCP connections, audit logs, and analytics
 * - Slack integration
 * - Organization management (members, transfer, delete)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { fetchWithAuth } from './fetchWithAuth';
import type {
  SessionInfo,
  SlackConnectionData,
  MCPConnection,
  McpAuditLogEntry,
  McpAnalytics,
  CleanupPreview,
  CleanupResult,
  StorageUsageData,
  OrgMember,
} from '../../components/organization-settings';

// Query keys factory for cache management
export const orgSettingsKeys = {
  all: ['orgSettings'] as const,
  // Sessions
  sessions: () => [...orgSettingsKeys.all, 'sessions'] as const,
  // Artifact retention
  artifactRetention: (orgId: string) => [...orgSettingsKeys.all, 'artifactRetention', orgId] as const,
  cleanupPreview: (orgId: string) => [...orgSettingsKeys.all, 'cleanupPreview', orgId] as const,
  // Storage
  storage: (orgId: string) => [...orgSettingsKeys.all, 'storage', orgId] as const,
  // MCP
  mcpConnections: (orgId: string) => [...orgSettingsKeys.all, 'mcpConnections', orgId] as const,
  mcpAuditLogs: (orgId: string, params: McpAuditLogsParams) => [...orgSettingsKeys.all, 'mcpAuditLogs', orgId, params] as const,
  mcpAnalytics: (orgId: string, period: string) => [...orgSettingsKeys.all, 'mcpAnalytics', orgId, period] as const,
  // Slack
  slack: (orgId: string) => [...orgSettingsKeys.all, 'slack', orgId] as const,
  // Members
  members: (orgId: string) => [...orgSettingsKeys.all, 'members', orgId] as const,
  adminMembers: (orgId: string) => [...orgSettingsKeys.all, 'adminMembers', orgId] as const,
};

export interface McpAuditLogsParams {
  limit?: number;
  offset?: number;
  method?: string;
  response_type?: string;
}

// ============== Sessions Hooks ==============

/**
 * Hook to fetch active sessions
 */
export function useSessions() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: orgSettingsKeys.sessions(),
    queryFn: async () => {
      const data = await fetchWithAuth('/api/v1/auth/sessions', token) as { sessions?: SessionInfo[] };
      return data.sessions || [];
    },
    enabled: !!token,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000,
  });
}

/**
 * Hook to logout a specific session
 */
export function useLogoutSession() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      await fetchWithAuth(`/api/v1/auth/sessions/${sessionId}`, token, { method: 'DELETE' });
      return sessionId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgSettingsKeys.sessions() });
    },
  });
}

/**
 * Hook to logout all other sessions
 */
export function useLogoutAllSessions() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const data = await fetchWithAuth('/api/v1/auth/sessions/logout-all', token, { method: 'POST' });
      return data as { message?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgSettingsKeys.sessions() });
    },
  });
}

// ============== Artifact Retention Hooks ==============

/**
 * Hook to fetch artifact retention settings
 */
export function useArtifactRetention() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';

  return useQuery({
    queryKey: orgSettingsKeys.artifactRetention(orgId),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/organizations/${orgId}/artifact-retention`, token) as { retention_days: number };
      return data;
    },
    enabled: !!token && !!orgId,
    staleTime: 60 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to save artifact retention settings
 */
export function useSaveArtifactRetention() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (retentionDays: number) => {
      await fetchWithAuth(`/api/v1/organizations/${orgId}/artifact-retention`, token, {
        method: 'PUT',
        body: JSON.stringify({ retention_days: retentionDays }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgSettingsKeys.artifactRetention(orgId) });
    },
  });
}

/**
 * Hook to preview cleanup
 */
export function useCleanupPreview() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';

  return useQuery({
    queryKey: orgSettingsKeys.cleanupPreview(orgId),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/organizations/${orgId}/artifact-cleanup/preview`, token) as CleanupPreview;
      return data;
    },
    enabled: false, // Only fetch on demand
    staleTime: 0, // Always fresh
  });
}

/**
 * Hook to run cleanup
 */
export function useRunCleanup() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const data = await fetchWithAuth(`/api/v1/organizations/${orgId}/artifact-cleanup`, token, { method: 'POST' }) as CleanupResult;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgSettingsKeys.cleanupPreview(orgId) });
      queryClient.invalidateQueries({ queryKey: orgSettingsKeys.storage(orgId) });
    },
  });
}

// ============== Storage Hooks ==============

/**
 * Hook to fetch storage usage
 */
export function useStorageUsage() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';

  return useQuery({
    queryKey: orgSettingsKeys.storage(orgId),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/organizations/${orgId}/storage`, token) as StorageUsageData;
      return data;
    },
    enabled: !!token && !!orgId,
    staleTime: 60 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}

// ============== MCP Hooks ==============

/**
 * Hook to fetch MCP connections
 */
export function useMcpConnections() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';

  return useQuery({
    queryKey: orgSettingsKeys.mcpConnections(orgId),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/organizations/${orgId}/mcp-connections`, token) as { mcp_connections?: MCPConnection[] };
      return data.mcp_connections || [];
    },
    enabled: !!token && !!orgId,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000,
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });
}

/**
 * Hook to fetch MCP audit logs
 */
export function useMcpAuditLogs(params: McpAuditLogsParams = {}) {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';

  return useQuery({
    queryKey: orgSettingsKeys.mcpAuditLogs(orgId, params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.limit) searchParams.set('limit', String(params.limit));
      if (params.offset) searchParams.set('offset', String(params.offset));
      if (params.method) searchParams.set('method', params.method);
      if (params.response_type) searchParams.set('response_type', params.response_type);

      const queryString = searchParams.toString();
      const url = `/api/v1/organizations/${orgId}/mcp-audit-logs${queryString ? `?${queryString}` : ''}`;
      const data = await fetchWithAuth(url, token) as { logs?: McpAuditLogEntry[]; total?: number };
      return { logs: data.logs || [], total: data.total || 0 };
    },
    enabled: !!token && !!orgId,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000,
    refetchInterval: 30 * 1000,
  });
}

/**
 * Hook to fetch MCP analytics
 */
export function useMcpAnalytics(timePeriod: string = '7d') {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';

  const getSinceDate = () => {
    const now = new Date();
    switch (timePeriod) {
      case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      default: return undefined;
    }
  };

  return useQuery({
    queryKey: orgSettingsKeys.mcpAnalytics(orgId, timePeriod),
    queryFn: async () => {
      const since = getSinceDate();
      const url = since
        ? `/api/v1/organizations/${orgId}/mcp-analytics?since=${since}`
        : `/api/v1/organizations/${orgId}/mcp-analytics`;
      const data = await fetchWithAuth(url, token) as { analytics?: McpAnalytics };
      return data.analytics || null;
    },
    enabled: !!token && !!orgId,
    staleTime: 60 * 1000,
    gcTime: 2 * 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Hook to export MCP analytics
 */
export function useExportMcpAnalytics() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';

  return useMutation({
    mutationFn: async ({ format, timePeriod }: { format: 'csv' | 'json'; timePeriod: string }) => {
      const getSinceDate = () => {
        const now = new Date();
        switch (timePeriod) {
          case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
          case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
          case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
          default: return undefined;
        }
      };

      const since = getSinceDate();
      let url = `/api/v1/organizations/${orgId}/mcp-analytics/export?format=${format}`;
      if (since) url += `&since=${since}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to export analytics');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `mcp-analytics.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    },
  });
}

// ============== Slack Hooks ==============

/**
 * Hook to fetch Slack connection status
 */
export function useSlackConnection() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';

  return useQuery({
    queryKey: orgSettingsKeys.slack(orgId),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/organizations/${orgId}/slack`, token) as SlackConnectionData;
      return data;
    },
    enabled: !!token && !!orgId,
    staleTime: 60 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to connect Slack workspace
 */
export function useConnectSlack() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workspaceName: string) => {
      const data = await fetchWithAuth(`/api/v1/organizations/${orgId}/slack/connect`, token, {
        method: 'POST',
        body: JSON.stringify({ workspace_name: workspaceName || 'Dev Workspace' }),
      }) as SlackConnectionData;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgSettingsKeys.slack(orgId) });
    },
  });
}

/**
 * Hook to disconnect Slack workspace
 */
export function useDisconnectSlack() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await fetchWithAuth(`/api/v1/organizations/${orgId}/slack`, token, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgSettingsKeys.slack(orgId) });
    },
  });
}

// ============== Members Hooks ==============

/**
 * Hook to fetch organization members
 */
export function useOrgMembers() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';

  return useQuery({
    queryKey: orgSettingsKeys.members(orgId),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/organizations/${orgId}/members`, token) as { members?: OrgMember[] };
      return data.members || [];
    },
    enabled: !!token && !!orgId,
    staleTime: 60 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to fetch admin members (for transfer ownership)
 */
export function useAdminMembers() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';

  return useQuery({
    queryKey: orgSettingsKeys.adminMembers(orgId),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/organizations/${orgId}/members`, token) as { members?: OrgMember[] };
      const admins = (data.members || []).filter(m => m.role === 'admin' && m.user_id !== user?.id);
      return admins;
    },
    enabled: !!token && !!orgId && user?.role === 'owner',
    staleTime: 60 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to transfer ownership
 */
export function useTransferOwnership() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';

  return useMutation({
    mutationFn: async ({ newOwnerId, password }: { newOwnerId: string; password: string }) => {
      await fetchWithAuth(`/api/v1/organizations/${orgId}/transfer-ownership`, token, {
        method: 'POST',
        body: JSON.stringify({ new_owner_id: newOwnerId, password }),
      });
    },
  });
}

/**
 * Hook to delete organization
 */
export function useDeleteOrganization() {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';

  return useMutation({
    mutationFn: async (password: string) => {
      await fetchWithAuth(`/api/v1/organizations/${orgId}`, token, {
        method: 'DELETE',
        body: JSON.stringify({ password }),
      });
    },
  });
}

// ============== Invalidation Hooks ==============

/**
 * Hook to invalidate organization settings queries
 */
export function useInvalidateOrgSettings() {
  const queryClient = useQueryClient();
  const user = useAuthStore(state => state.user);
  const orgId = user?.organization_id || '';

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: orgSettingsKeys.all }),
    invalidateSessions: () => queryClient.invalidateQueries({ queryKey: orgSettingsKeys.sessions() }),
    invalidateStorage: () => queryClient.invalidateQueries({ queryKey: orgSettingsKeys.storage(orgId) }),
    invalidateMcp: () => {
      queryClient.invalidateQueries({ queryKey: orgSettingsKeys.mcpConnections(orgId) });
      queryClient.invalidateQueries({ queryKey: [...orgSettingsKeys.all, 'mcpAuditLogs'] });
      queryClient.invalidateQueries({ queryKey: [...orgSettingsKeys.all, 'mcpAnalytics'] });
    },
    invalidateSlack: () => queryClient.invalidateQueries({ queryKey: orgSettingsKeys.slack(orgId) }),
  };
}
