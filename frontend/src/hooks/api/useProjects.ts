/**
 * React Query hooks for projects API
 * Feature #56: Create React Query hooks for API data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';

// Types
export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  slug: string;
  repository_url?: string;
  default_branch: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectsResponse {
  projects: Project[];
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  repository_url?: string;
  default_branch?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  repository_url?: string;
  default_branch?: string;
  is_archived?: boolean;
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

// Query keys factory
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (includeArchived?: boolean) => [...projectKeys.lists(), { includeArchived }] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

/**
 * Hook to fetch all projects
 */
export function useProjects(includeArchived: boolean = false) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: projectKeys.list(includeArchived),
    queryFn: () => {
      const url = includeArchived
        ? '/api/v1/projects?include_archived=true'
        : '/api/v1/projects';
      return fetchWithAuth(url, token) as Promise<ProjectsResponse>;
    },
    enabled: !!token,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 2 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch a single project by ID
 */
export function useProject(projectId: string | undefined) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: projectKeys.detail(projectId || ''),
    queryFn: () => fetchWithAuth(`/api/v1/projects/${projectId}`, token),
    enabled: !!token && !!projectId,
    staleTime: 60 * 1000,
    gcTime: 2 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to create a new project
 * Feature #65: Added optimistic updates for immediate UI feedback
 */
export function useCreateProject() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      fetchWithAuth('/api/v1/projects', token, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    // Optimistic update: add the new project to cache immediately
    onMutate: async (newProject) => {
      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: projectKeys.lists() });

      // Snapshot the previous value for rollback
      const previousProjects = queryClient.getQueryData<ProjectsResponse>(
        projectKeys.list(false)
      );

      // Optimistically add the new project
      if (previousProjects) {
        const optimisticProject: Project = {
          id: `temp-${Date.now()}`, // Temporary ID until server responds
          organization_id: '', // Will be set by server
          name: newProject.name,
          description: newProject.description,
          slug: newProject.name.toLowerCase().replace(/\s+/g, '-'),
          repository_url: newProject.repository_url,
          default_branch: newProject.default_branch || 'main',
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData<ProjectsResponse>(
          projectKeys.list(false),
          {
            projects: [...previousProjects.projects, optimisticProject],
          }
        );
      }

      // Return context with previous value for rollback
      return { previousProjects };
    },
    // Rollback on error
    onError: (_err, _newProject, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(
          projectKeys.list(false),
          context.previousProjects
        );
      }
    },
    // Always refetch after error or success to get fresh data
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

/**
 * Hook to update a project
 * Feature #109: Added optimistic updates for immediate UI feedback
 */
export function useUpdateProject() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectInput }) =>
      fetchWithAuth(`/api/v1/projects/${id}`, token, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    // Feature #109: Optimistic update
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: projectKeys.detail(id) });
      await queryClient.cancelQueries({ queryKey: projectKeys.lists() });

      // Snapshot previous values for rollback
      const previousProject = queryClient.getQueryData<{ project: Project }>(
        projectKeys.detail(id)
      );
      const previousProjects = queryClient.getQueryData<ProjectsResponse>(
        projectKeys.list(false)
      );

      // Optimistically update project detail
      if (previousProject) {
        queryClient.setQueryData<{ project: Project }>(projectKeys.detail(id), {
          project: {
            ...previousProject.project,
            ...data,
            updated_at: new Date().toISOString(),
          },
        });
      }

      // Optimistically update project in list
      if (previousProjects) {
        queryClient.setQueryData<ProjectsResponse>(projectKeys.list(false), {
          projects: previousProjects.projects.map((p) =>
            p.id === id ? { ...p, ...data, updated_at: new Date().toISOString() } : p
          ),
        });
      }

      return { previousProject, previousProjects };
    },
    // Rollback on error
    onError: (_err, { id }, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(projectKeys.detail(id), context.previousProject);
      }
      if (context?.previousProjects) {
        queryClient.setQueryData(projectKeys.list(false), context.previousProjects);
      }
    },
    // Always refetch after error or success
    onSettled: (_, __, { id }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

/**
 * Hook to delete a project
 * Feature #109: Added optimistic updates for immediate UI feedback
 */
export function useDeleteProject() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchWithAuth(`/api/v1/projects/${id}`, token, {
        method: 'DELETE',
      }),
    // Feature #109: Optimistic update - remove project immediately
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: projectKeys.lists() });

      // Snapshot previous values for rollback
      const previousProjects = queryClient.getQueryData<ProjectsResponse>(
        projectKeys.list(false)
      );

      // Optimistically remove the project from list
      if (previousProjects) {
        queryClient.setQueryData<ProjectsResponse>(projectKeys.list(false), {
          projects: previousProjects.projects.filter((p) => p.id !== id),
        });
      }

      return { previousProjects };
    },
    // Rollback on error
    onError: (_err, _id, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(projectKeys.list(false), context.previousProjects);
      }
    },
    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

/**
 * Hook to invalidate project queries
 */
export function useInvalidateProjects() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: projectKeys.all }),
    invalidateLists: () => queryClient.invalidateQueries({ queryKey: projectKeys.lists() }),
    invalidateProject: (id: string) => queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) }),
  };
}

// ============== Feature #144: Project Settings Hooks ==============
// These hooks replace raw fetch() calls in ProjectDetailPage settings/security tabs
// Re-export types from project-detail for convenience
export type {
  ProjectMember,
  AlertChannel,
  AlertHistoryEntry,
  EnvironmentVariable,
  HealingSettings,
  SASTConfig,
  SASTScanResult,
  SASTRuleset,
  CustomRule,
  SecretPattern,
  DASTConfig,
  DASTScanResult,
  OpenAPISpec,
} from '../../components/project-detail/types';

// Import types for internal use
import type {
  ProjectMember,
  AlertChannel,
  AlertHistoryEntry,
  EnvironmentVariable,
  HealingSettings,
  SASTConfig,
  SASTScanResult,
  SASTRuleset,
  CustomRule,
  SecretPattern,
  DASTConfig,
  DASTScanResult,
  OpenAPISpec,
} from '../../components/project-detail/types';

// Extended query keys for project settings
export const projectSettingsKeys = {
  members: (projectId: string) => [...projectKeys.all, 'members', projectId] as const,
  alerts: (projectId: string) => [...projectKeys.all, 'alerts', projectId] as const,
  alertHistory: () => ['alert-history'] as const,
  envVars: (projectId: string) => [...projectKeys.all, 'env', projectId] as const,
  healingSettings: (projectId: string) => [...projectKeys.all, 'healing', projectId] as const,
  sastConfig: (projectId: string) => [...projectKeys.all, 'sast', projectId] as const,
  dastConfig: (projectId: string) => [...projectKeys.all, 'dast', projectId] as const,
};

/**
 * Hook to fetch project members
 * Feature #144: Convert raw fetch to React Query
 */
export function useProjectMembers(projectId: string | undefined) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: projectSettingsKeys.members(projectId || ''),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/projects/${projectId}/members`, token);
      return (data.members || []) as ProjectMember[];
    },
    enabled: !!token && !!projectId,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to fetch alert channels for a project
 * Feature #144: Convert raw fetch to React Query
 */
export function useAlertChannels(projectId: string | undefined) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: projectSettingsKeys.alerts(projectId || ''),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/projects/${projectId}/alerts`, token);
      return (data.channels || []) as AlertChannel[];
    },
    enabled: !!token && !!projectId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000,
  });
}

/**
 * Hook to fetch alert history (global, filtered by project in component)
 * Feature #144: Convert raw fetch to React Query
 */
export function useAlertHistory() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: projectSettingsKeys.alertHistory(),
    queryFn: async () => {
      const data = await fetchWithAuth('/api/v1/alert-history', token);
      return (data.history || []) as AlertHistoryEntry[];
    },
    enabled: !!token,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000,
  });
}

/**
 * Hook to fetch environment variables for a project
 * Feature #144: Convert raw fetch to React Query
 */
export function useEnvVars(projectId: string | undefined) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: projectSettingsKeys.envVars(projectId || ''),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/projects/${projectId}/env`, token);
      return (data.env_vars || []) as EnvironmentVariable[];
    },
    enabled: !!token && !!projectId,
    staleTime: 60 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to fetch healing settings for a project
 * Feature #144: Convert raw fetch to React Query
 */
export function useHealingSettings(projectId: string | undefined) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: projectSettingsKeys.healingSettings(projectId || ''),
    queryFn: async () => {
      const data = await fetchWithAuth(`/api/v1/projects/${projectId}/healing-settings`, token);
      return data.healing_settings as HealingSettings;
    },
    enabled: !!token && !!projectId,
    staleTime: 60 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to fetch all SAST configuration data in parallel
 * Feature #144: Consolidates 5 fetch calls into one hook with Promise.all
 */
export function useSastConfig(projectId: string | undefined) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: projectSettingsKeys.sastConfig(projectId || ''),
    queryFn: async () => {
      // Fetch all SAST data in parallel for better performance
      const [configRes, rulesetsRes, scansRes, customRulesRes, patternsRes] = await Promise.all([
        fetch(`/api/v1/projects/${projectId}/sast/config`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/v1/sast/rulesets', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/v1/projects/${projectId}/sast/scans?limit=10`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/v1/projects/${projectId}/sast/custom-rules`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/v1/projects/${projectId}/sast/patterns`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      // Process responses (each can fail independently)
      const config = configRes.ok ? (await configRes.json()).config as SASTConfig : null;
      const rulesets = rulesetsRes.ok ? (await rulesetsRes.json()).rulesets as SASTRuleset[] : [];
      const scans = scansRes.ok ? (await scansRes.json()).scans as SASTScanResult[] : [];
      const customRules = customRulesRes.ok ? (await customRulesRes.json()).rules as CustomRule[] : [];
      const patterns = patternsRes.ok ? (await patternsRes.json()).patterns as SecretPattern[] : [];

      return { config, rulesets, scans, customRules, patterns };
    },
    enabled: !!token && !!projectId,
    staleTime: 30 * 1000, // 30 seconds - security data can change
    gcTime: 60 * 1000,
  });
}

/**
 * Hook to fetch all DAST configuration data in parallel
 * Feature #144: Consolidates 4 fetch calls into one hook with Promise.all
 */
export function useDastConfig(projectId: string | undefined) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: projectSettingsKeys.dastConfig(projectId || ''),
    queryFn: async () => {
      // Fetch all DAST data in parallel for better performance
      const [configRes, scansRes, specRes, schedulesRes] = await Promise.all([
        fetch(`/api/v1/projects/${projectId}/dast/config`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/v1/projects/${projectId}/dast/scans?limit=10`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/v1/projects/${projectId}/dast/openapi-spec`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/v1/projects/${projectId}/dast/schedules`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      // Process responses (each can fail independently)
      const configData = configRes.ok ? await configRes.json() : null;
      const config = configData?.config as DASTConfig | null;
      const targetUrl = configData?.config?.targetUrl || '';
      const scans = scansRes.ok ? (await scansRes.json()).scans as DASTScanResult[] : [];
      const spec = specRes.ok ? (await specRes.json()).spec as OpenAPISpec | null : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schedules = schedulesRes.ok ? (await schedulesRes.json()).schedules as any[] : [];

      return { config, targetUrl, scans, spec, schedules };
    },
    enabled: !!token && !!projectId,
    staleTime: 30 * 1000, // 30 seconds - security data can change
    gcTime: 60 * 1000,
  });
}

/**
 * Hook to invalidate project settings queries
 * Feature #144: Invalidation helper for settings data
 */
export function useInvalidateProjectSettings() {
  const queryClient = useQueryClient();

  return {
    invalidateMembers: (projectId: string) =>
      queryClient.invalidateQueries({ queryKey: projectSettingsKeys.members(projectId) }),
    invalidateAlerts: (projectId: string) =>
      queryClient.invalidateQueries({ queryKey: projectSettingsKeys.alerts(projectId) }),
    invalidateAlertHistory: () =>
      queryClient.invalidateQueries({ queryKey: projectSettingsKeys.alertHistory() }),
    invalidateEnvVars: (projectId: string) =>
      queryClient.invalidateQueries({ queryKey: projectSettingsKeys.envVars(projectId) }),
    invalidateHealingSettings: (projectId: string) =>
      queryClient.invalidateQueries({ queryKey: projectSettingsKeys.healingSettings(projectId) }),
    invalidateSastConfig: (projectId: string) =>
      queryClient.invalidateQueries({ queryKey: projectSettingsKeys.sastConfig(projectId) }),
    invalidateDastConfig: (projectId: string) =>
      queryClient.invalidateQueries({ queryKey: projectSettingsKeys.dastConfig(projectId) }),
    invalidateAllSettings: (projectId: string) => {
      queryClient.invalidateQueries({ queryKey: projectSettingsKeys.members(projectId) });
      queryClient.invalidateQueries({ queryKey: projectSettingsKeys.alerts(projectId) });
      queryClient.invalidateQueries({ queryKey: projectSettingsKeys.alertHistory() });
      queryClient.invalidateQueries({ queryKey: projectSettingsKeys.envVars(projectId) });
      queryClient.invalidateQueries({ queryKey: projectSettingsKeys.healingSettings(projectId) });
      queryClient.invalidateQueries({ queryKey: projectSettingsKeys.sastConfig(projectId) });
      queryClient.invalidateQueries({ queryKey: projectSettingsKeys.dastConfig(projectId) });
    },
  };
}
