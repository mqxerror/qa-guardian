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
  });
}

/**
 * Hook to create a new project
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

/**
 * Hook to update a project
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
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

/**
 * Hook to delete a project
 */
export function useDeleteProject() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchWithAuth(`/api/v1/projects/${id}`, token, {
        method: 'DELETE',
      }),
    onSuccess: () => {
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
