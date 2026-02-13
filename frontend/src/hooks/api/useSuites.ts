/**
 * React Query hooks for test suites API
 * Feature #56: Create React Query hooks for API data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
// Feature #143: Import dashboard keys for cross-cache invalidation
import { dashboardKeys } from './useDashboard';
import { fetchWithAuth } from './fetchWithAuth'; // Feature #655: Shared auth fetch

// Types
/**
 * Canonical TestSuite interface
 * Feature #656: Consolidated from 5 duplicate definitions across the codebase
 *
 * Core fields (required): id, name
 * Everything else is optional to support different API responses and use cases
 */
export interface TestSuite {
  id: string;
  name: string;
  project_id?: string;
  organization_id?: string;
  description?: string;
  type?: 'e2e' | 'visual' | 'accessibility' | 'performance' | 'load';
  browser?: string;
  browsers?: string[];
  default_browser?: 'chromium' | 'firefox' | 'webkit';
  base_url?: string;
  viewport_width?: number;
  viewport_height?: number;
  timeout?: number;
  retry_count?: number;
  test_count?: number;
  created_at?: string;
  updated_at?: string;
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

// Feature #701: Review settings response types
// Matches TestSuitePage's reviewStats state type
export interface ReviewStats {
  total_tests?: number;
  ai_generated?: number;
  pending_review: number;
  approved: number;
  rejected: number;
  total?: number;
}

export interface ReviewSettingsResponse {
  require_human_review: boolean;
  stats: ReviewStats;
}

// Feature #701: AI Health Check report type
// Matches TestSuitePage's aiHealthReport state type
export interface AIHealthReport {
  health_score: number;
  trend: 'improving' | 'stable' | 'degrading';
  ai_summary: string;
  recommendations: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    category: string;
    title: string;
    description: string;
    suggested_action: string;
    affected_tests?: string[];
  }>;
  generated_at: string;
}

// Query keys factory
export const suiteKeys = {
  all: ['suites'] as const,
  lists: () => [...suiteKeys.all, 'list'] as const,
  listByProject: (projectId: string, params?: SuitesQueryParams) =>
    [...suiteKeys.lists(), 'project', projectId, params] as const,
  details: () => [...suiteKeys.all, 'detail'] as const,
  detail: (id: string) => [...suiteKeys.details(), id] as const,
  // Feature #701: Review settings and AI health check keys
  reviewSettings: (id: string) => [...suiteKeys.detail(id), 'review-settings'] as const,
  aiHealthCheck: (id: string) => [...suiteKeys.detail(id), 'ai-health'] as const,
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
    // Feature #110: Narrow scope - only invalidate the specific project's suites
    onSettled: (_, __, { id, projectId }) => {
      queryClient.invalidateQueries({ queryKey: suiteKeys.detail(id) });
      // Feature #110: Only invalidate the project-specific list, not all suites
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
    // Feature #110: Narrow scope - only invalidate the specific project's suites
    onSettled: (_, __, { projectId }) => {
      // Feature #110: Only invalidate the project-specific list, not all suites
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: suiteKeys.listByProject(projectId) });
      }
      // Feature #143: Invalidate dashboard stats (suite count changed)
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
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

// ============================================================
// Feature #701: Review Settings Hooks
// ============================================================

/**
 * Hook to fetch suite review settings
 */
export function useReviewSettings(suiteId: string | undefined) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: suiteKeys.reviewSettings(suiteId || ''),
    queryFn: () => fetchWithAuth(`/api/v1/suites/${suiteId}/review-settings`, token) as Promise<ReviewSettingsResponse>,
    enabled: !!token && !!suiteId,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000,
  });
}

/**
 * Hook to toggle human review requirement
 */
export function useToggleHumanReview() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ suiteId, requireHumanReview }: { suiteId: string; requireHumanReview: boolean }) =>
      fetchWithAuth(`/api/v1/suites/${suiteId}/review-settings`, token, {
        method: 'PATCH',
        body: JSON.stringify({ require_human_review: requireHumanReview }),
      }),
    onSuccess: (_, { suiteId }) => {
      queryClient.invalidateQueries({ queryKey: suiteKeys.reviewSettings(suiteId) });
    },
  });
}

// ============================================================
// Feature #701: AI Health Check Hooks
// ============================================================

/**
 * Hook to run AI health check on a suite
 */
export function useAIHealthCheck() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ suiteId }: { suiteId: string }) =>
      fetchWithAuth(`/api/v1/suites/${suiteId}/ai-health-check`, token, {
        method: 'POST',
      }) as Promise<{ report: AIHealthReport }>,
    onSuccess: (_, { suiteId }) => {
      queryClient.invalidateQueries({ queryKey: suiteKeys.aiHealthCheck(suiteId) });
    },
  });
}
