/**
 * React Query hooks for test suites API
 * Feature #56: Create React Query hooks for API data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
// Feature #143: Import dashboard keys for cross-cache invalidation
import { dashboardKeys } from './useDashboard';

// Types
export interface TestSuite {
  id: string;
  project_id: string;
  organization_id: string;
  name: string;
  description?: string;
  type: 'e2e' | 'visual' | 'accessibility' | 'performance' | 'load';
  browser: string;
  browsers: string[];
  base_url?: string;
  viewport_width: number;
  viewport_height: number;
  timeout: number;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface PaginatedSuitesResponse {
  data: TestSuite[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  suites: TestSuite[]; // backwards compatibility
}

export interface SuitesQueryParams {
  page?: number;
  limit?: number;
}

export interface CreateSuiteInput {
  name: string;
  description?: string;
  type?: string;
  base_url?: string;
  browser?: string;
  browsers?: string[];
  viewport_width?: number;
  viewport_height?: number;
  timeout?: number;
  retry_count?: number;
}

export interface UpdateSuiteInput {
  name?: string;
  description?: string;
  base_url?: string;
  browser?: string;
  browsers?: string[];
  viewport_width?: number;
  viewport_height?: number;
  timeout?: number;
  retry_count?: number;
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
export const suiteKeys = {
  all: ['suites'] as const,
  lists: () => [...suiteKeys.all, 'list'] as const,
  listByProject: (projectId: string, params?: SuitesQueryParams) =>
    [...suiteKeys.lists(), 'project', projectId, params] as const,
  details: () => [...suiteKeys.all, 'detail'] as const,
  detail: (id: string) => [...suiteKeys.details(), id] as const,
};

/**
 * Hook to fetch paginated suites for a project
 */
export function useSuitesPaginated(projectId: string | undefined, params: SuitesQueryParams = {}) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: suiteKeys.listByProject(projectId || '', params),
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));

      const queryString = searchParams.toString();
      const url = `/api/v1/projects/${projectId}/suites${queryString ? `?${queryString}` : ''}`;
      return fetchWithAuth(url, token) as Promise<PaginatedSuitesResponse>;
    },
    enabled: !!token && !!projectId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch all suites for a project (backwards compatible)
 */
export function useSuites(projectId: string | undefined) {
  return useSuitesPaginated(projectId, { limit: 100 });
}

/**
 * Hook to fetch a single suite by ID
 */
export function useSuite(suiteId: string | undefined) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: suiteKeys.detail(suiteId || ''),
    queryFn: () => fetchWithAuth(`/api/v1/suites/${suiteId}`, token),
    enabled: !!token && !!suiteId,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to create a new suite
 * Feature #65: Added optimistic updates for immediate UI feedback
 */
export function useCreateSuite() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: CreateSuiteInput }) =>
      fetchWithAuth(`/api/v1/projects/${projectId}/suites`, token, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    // Optimistic update: add the new suite to cache immediately
    onMutate: async ({ projectId, data }) => {
      // Cancel any outgoing refetches (all queries for this project)
      await queryClient.cancelQueries({ queryKey: suiteKeys.listByProject(projectId) });

      // The page uses useSuites which internally uses { limit: 100 }
      const queryKey = suiteKeys.listByProject(projectId, { limit: 100 });

      // Snapshot the previous value for rollback
      const previousSuites = queryClient.getQueryData<PaginatedSuitesResponse>(queryKey);

      // Optimistically add the new suite
      if (previousSuites) {
        const optimisticSuite: TestSuite = {
          id: `temp-${Date.now()}`, // Temporary ID until server responds
          project_id: projectId,
          organization_id: '', // Will be set by server
          name: data.name,
          description: data.description,
          type: (data.type as TestSuite['type']) || 'e2e',
          browser: data.browser || 'chromium',
          browsers: data.browsers || ['chromium'],
          base_url: data.base_url,
          viewport_width: data.viewport_width || 1280,
          viewport_height: data.viewport_height || 720,
          timeout: data.timeout || 30000,
          retry_count: data.retry_count || 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData<PaginatedSuitesResponse>(
          queryKey,
          {
            ...previousSuites,
            data: [...previousSuites.data, optimisticSuite],
            suites: [...(previousSuites.suites || []), optimisticSuite],
            pagination: {
              ...previousSuites.pagination,
              total: (previousSuites.pagination?.total || 0) + 1,
            },
          }
        );
      }

      // Return context with previous value for rollback
      return { previousSuites, projectId, queryKey };
    },
    // Rollback on error
    onError: (_err, _vars, context) => {
      if (context?.previousSuites && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousSuites);
      }
    },
    // Always refetch after error or success to get fresh data
    onSettled: (_, __, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: suiteKeys.listByProject(projectId) });
    },
  });
}

/**
 * Hook to update a suite
 * Feature #109: Added optimistic updates for immediate UI feedback
 */
export function useUpdateSuite() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data, projectId }: { id: string; data: UpdateSuiteInput; projectId?: string }) =>
      fetchWithAuth(`/api/v1/suites/${id}`, token, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    // Feature #109: Optimistic update
    onMutate: async ({ id, data, projectId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: suiteKeys.detail(id) });
      if (projectId) {
        await queryClient.cancelQueries({ queryKey: suiteKeys.listByProject(projectId) });
      }

      // Snapshot previous values for rollback
      const previousSuite = queryClient.getQueryData<{ suite: TestSuite }>(
        suiteKeys.detail(id)
      );
      const previousSuites = projectId
        ? queryClient.getQueryData<PaginatedSuitesResponse>(suiteKeys.listByProject(projectId))
        : undefined;

      // Optimistically update suite detail
      if (previousSuite) {
        queryClient.setQueryData<{ suite: TestSuite }>(suiteKeys.detail(id), {
          suite: {
            ...previousSuite.suite,
            ...data,
            updated_at: new Date().toISOString(),
          },
        });
      }

      // Optimistically update suite in list
      if (previousSuites && projectId) {
        queryClient.setQueryData<PaginatedSuitesResponse>(
          suiteKeys.listByProject(projectId),
          {
            ...previousSuites,
            data: previousSuites.data.map((s) =>
              s.id === id ? { ...s, ...data, updated_at: new Date().toISOString() } : s
            ),
            suites: (previousSuites.suites || []).map((s) =>
              s.id === id ? { ...s, ...data, updated_at: new Date().toISOString() } : s
            ),
          }
        );
      }

      return { previousSuite, previousSuites, projectId };
    },
    // Rollback on error
    onError: (_err, { id, projectId }, context) => {
      if (context?.previousSuite) {
        queryClient.setQueryData(suiteKeys.detail(id), context.previousSuite);
      }
      if (context?.previousSuites && projectId) {
        queryClient.setQueryData(suiteKeys.listByProject(projectId), context.previousSuites);
      }
    },
    // Always refetch after error or success
    onSettled: (_, __, { id, projectId }) => {
      queryClient.invalidateQueries({ queryKey: suiteKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: suiteKeys.lists() });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: suiteKeys.listByProject(projectId) });
      }
    },
  });
}

/**
 * Hook to delete a suite
 * Feature #143: Enhanced with dashboard invalidation
 * Feature #109: Added optimistic updates for immediate UI feedback
 */
export function useDeleteSuite() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, projectId }: { id: string; projectId?: string }) =>
      fetchWithAuth(`/api/v1/suites/${id}`, token, {
        method: 'DELETE',
      }),
    // Feature #109: Optimistic update - remove suite immediately
    onMutate: async ({ id, projectId }) => {
      // Cancel any outgoing refetches
      if (projectId) {
        await queryClient.cancelQueries({ queryKey: suiteKeys.listByProject(projectId) });
      }

      // Snapshot previous values for rollback
      const previousSuites = projectId
        ? queryClient.getQueryData<PaginatedSuitesResponse>(suiteKeys.listByProject(projectId))
        : undefined;

      // Optimistically remove the suite from list
      if (previousSuites && projectId) {
        queryClient.setQueryData<PaginatedSuitesResponse>(
          suiteKeys.listByProject(projectId),
          {
            ...previousSuites,
            data: previousSuites.data.filter((s) => s.id !== id),
            suites: (previousSuites.suites || []).filter((s) => s.id !== id),
            pagination: {
              ...previousSuites.pagination,
              total: Math.max(0, (previousSuites.pagination?.total || 0) - 1),
            },
          }
        );
      }

      return { previousSuites, projectId };
    },
    // Rollback on error
    onError: (_err, { projectId }, context) => {
      if (context?.previousSuites && projectId) {
        queryClient.setQueryData(suiteKeys.listByProject(projectId), context.previousSuites);
      }
    },
    // Always refetch after error or success
    onSettled: (_, __, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: suiteKeys.lists() });
      // Feature #143: Invalidate dashboard stats (suite count changed)
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
      // Invalidate project suites if projectId provided
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: suiteKeys.listByProject(projectId) });
      }
    },
  });
}

/**
 * Hook to invalidate suite queries
 */
export function useInvalidateSuites() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: suiteKeys.all }),
    invalidateLists: () => queryClient.invalidateQueries({ queryKey: suiteKeys.lists() }),
    invalidateSuite: (id: string) => queryClient.invalidateQueries({ queryKey: suiteKeys.detail(id) }),
    invalidateByProject: (projectId: string) =>
      queryClient.invalidateQueries({ queryKey: suiteKeys.listByProject(projectId) }),
  };
}
