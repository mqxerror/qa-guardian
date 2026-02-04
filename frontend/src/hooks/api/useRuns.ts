/**
 * React Query hooks for test runs API
 * Feature #56: Create React Query hooks for API data fetching
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';

// Types
export interface TestRun {
  id: string;
  suite_id: string;
  suite_name: string;
  project_id: string;
  test_id: string | null;
  test_name?: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled' | 'error';
  browser: string;
  branch: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  results_count: number;
  passed_count: number;
  failed_count: number;
  skipped_count: number;
}

export interface PaginatedRunsResponse {
  data: TestRun[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  runs: TestRun[]; // backwards compatibility
  total: number;
}

export interface RunsQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  suite_id?: string;
  project_id?: string;
}

// API helper
const fetchWithAuth = async (url: string, token: string | null) => {
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
};

// Query keys factory
export const runKeys = {
  all: ['runs'] as const,
  lists: () => [...runKeys.all, 'list'] as const,
  list: (params: RunsQueryParams) => [...runKeys.lists(), params] as const,
  details: () => [...runKeys.all, 'detail'] as const,
  detail: (id: string) => [...runKeys.details(), id] as const,
  byTest: (testId: string) => [...runKeys.all, 'byTest', testId] as const,
  bySuite: (suiteId: string) => [...runKeys.all, 'bySuite', suiteId] as const,
};

/**
 * Hook to fetch paginated test runs
 */
export function useRunsPaginated(params: RunsQueryParams = {}) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: runKeys.list(params),
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));
      if (params.status) searchParams.set('status', params.status);
      if (params.suite_id) searchParams.set('suite_id', params.suite_id);
      if (params.project_id) searchParams.set('project_id', params.project_id);

      const url = `/api/test-runs?${searchParams.toString()}`;
      return fetchWithAuth(url, token) as Promise<PaginatedRunsResponse>;
    },
    enabled: !!token,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch all runs (backwards compatible, uses default limit)
 */
export function useRuns(params: Omit<RunsQueryParams, 'page'> = {}) {
  return useRunsPaginated({ ...params, limit: params.limit || 1000 });
}

/**
 * Hook for infinite scrolling runs list
 */
export function useRunsInfinite(params: Omit<RunsQueryParams, 'page'> = {}) {
  const token = useAuthStore(state => state.token);

  return useInfiniteQuery({
    queryKey: [...runKeys.lists(), 'infinite', params],
    queryFn: ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams();
      searchParams.set('page', String(pageParam));
      if (params.limit) searchParams.set('limit', String(params.limit));
      if (params.status) searchParams.set('status', params.status);
      if (params.suite_id) searchParams.set('suite_id', params.suite_id);
      if (params.project_id) searchParams.set('project_id', params.project_id);

      const url = `/api/test-runs?${searchParams.toString()}`;
      return fetchWithAuth(url, token) as Promise<PaginatedRunsResponse>;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.hasNext) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled: !!token,
  });
}

/**
 * Hook to fetch a single run by ID
 */
export function useRun(runId: string | undefined) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: runKeys.detail(runId || ''),
    queryFn: () => fetchWithAuth(`/api/v1/runs/${runId}`, token),
    enabled: !!token && !!runId,
    staleTime: 10 * 1000, // 10 seconds for active runs
  });
}

/**
 * Hook to fetch runs for a specific test
 */
export function useRunsByTest(testId: string | undefined) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: runKeys.byTest(testId || ''),
    queryFn: () => fetchWithAuth(`/api/v1/tests/${testId}/runs`, token),
    enabled: !!token && !!testId,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to fetch runs for a specific suite
 */
export function useRunsBySuite(suiteId: string | undefined) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: runKeys.bySuite(suiteId || ''),
    queryFn: () => fetchWithAuth(`/api/v1/suites/${suiteId}/runs`, token),
    enabled: !!token && !!suiteId,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to invalidate run queries (for use after mutations)
 */
export function useInvalidateRuns() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: runKeys.all }),
    invalidateLists: () => queryClient.invalidateQueries({ queryKey: runKeys.lists() }),
    invalidateRun: (id: string) => queryClient.invalidateQueries({ queryKey: runKeys.detail(id) }),
  };
}
