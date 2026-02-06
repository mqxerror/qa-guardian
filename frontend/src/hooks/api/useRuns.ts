/**
 * React Query hooks for test runs API
 * Feature #56: Create React Query hooks for API data fetching
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
// Feature #92: Import query keys for cross-cache invalidation
import { dashboardKeys } from './useDashboard';

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
    // Feature #95: Reduced from 30s to 5s for faster updates on frequently changing run data
    staleTime: 5 * 1000, // 5 seconds
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
    // Feature #95: Reduced from 10s to 2s for real-time run status updates
    staleTime: 2 * 1000, // 2 seconds for active runs
    // Feature #95: Auto-refetch every 10s for run detail pages
    refetchInterval: 10 * 1000, // 10 seconds
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
    // Feature #95: Reduced from 30s to 5s for faster run history updates
    staleTime: 5 * 1000, // 5 seconds
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
    // Feature #95: Reduced from 30s to 5s for faster run history updates
    staleTime: 5 * 1000, // 5 seconds
  });
}

/**
 * Hook to start a test run
 * Feature #92: Mutation hook with cache invalidation for immediate UI updates
 * Feature #138: Added optimistic update for instant UI feedback
 */
export function useStartRun() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ testId, branch }: { testId: string; branch?: string }) =>
      fetchWithAuth(`/api/v1/tests/${testId}/runs`, token, {
        method: 'POST',
        body: JSON.stringify({ branch: branch || 'main' }),
      }),
    // Feature #138: Optimistic update - show pending run immediately
    onMutate: async ({ testId, branch }) => {
      // Cancel any outgoing refetches for this test's runs
      await queryClient.cancelQueries({ queryKey: runKeys.byTest(testId) });

      // Snapshot the previous value for rollback
      const previousRuns = queryClient.getQueryData(runKeys.byTest(testId));

      // Create an optimistic run object
      const optimisticRun: TestRun = {
        id: `temp-${Date.now()}`, // Temporary ID until server responds
        suite_id: '', // Will be set by server
        suite_name: '',
        project_id: '',
        test_id: testId,
        test_name: '',
        status: 'pending',
        browser: 'chromium',
        branch: branch || 'main',
        created_at: new Date().toISOString(),
        results_count: 0,
        passed_count: 0,
        failed_count: 0,
        skipped_count: 0,
      };

      // Optimistically add the new run at the beginning of the list
      queryClient.setQueryData(runKeys.byTest(testId), (old: { runs?: TestRun[] } | undefined) => {
        if (!old) return { runs: [optimisticRun] };
        return {
          ...old,
          runs: [optimisticRun, ...(old.runs || [])],
        };
      });

      // Return context with previous value for rollback
      return { previousRuns, testId };
    },
    // Feature #138: Rollback on error
    onError: (_err, _vars, context) => {
      if (context?.previousRuns !== undefined && context?.testId) {
        queryClient.setQueryData(runKeys.byTest(context.testId), context.previousRuns);
      }
    },
    onSuccess: (data, { testId }) => {
      // Invalidate the runs list for this test
      queryClient.invalidateQueries({ queryKey: runKeys.byTest(testId) });
      // Invalidate all run lists (run history pages)
      queryClient.invalidateQueries({ queryKey: runKeys.lists() });
      // Invalidate dashboard stats (run count changed)
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
      // If we have suite_id from the response, invalidate suite runs too
      if (data?.run?.suite_id) {
        queryClient.invalidateQueries({ queryKey: runKeys.bySuite(data.run.suite_id) });
      }
    },
  });
}

/**
 * Hook to cancel a test run
 * Feature #92: Mutation hook with cache invalidation
 */
export function useCancelRun() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: string) =>
      fetchWithAuth(`/api/v1/runs/${runId}/cancel`, token, {
        method: 'POST',
      }),
    onSuccess: (_, runId) => {
      // Invalidate this specific run detail
      queryClient.invalidateQueries({ queryKey: runKeys.detail(runId) });
      // Invalidate all run lists
      queryClient.invalidateQueries({ queryKey: runKeys.lists() });
      // Invalidate dashboard stats
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
    },
  });
}

/**
 * Hook to invalidate run queries (for use after mutations)
 * Feature #92: Enhanced to also invalidate dashboard stats on run completion
 */
export function useInvalidateRuns() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: runKeys.all });
      // Feature #92: Also invalidate dashboard when all runs are invalidated
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
    },
    invalidateLists: () => {
      queryClient.invalidateQueries({ queryKey: runKeys.lists() });
      // Feature #92: Also invalidate dashboard stats
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
    },
    invalidateRun: (id: string) => queryClient.invalidateQueries({ queryKey: runKeys.detail(id) }),
    // Feature #92: Invalidate runs by test (useful for test detail page)
    invalidateByTest: (testId: string) => {
      queryClient.invalidateQueries({ queryKey: runKeys.byTest(testId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
    },
    // Feature #92: Invalidate runs by suite
    invalidateBySuite: (suiteId: string) => {
      queryClient.invalidateQueries({ queryKey: runKeys.bySuite(suiteId) });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
    },
    // Feature #92: Call this when a run completes (from WebSocket event)
    onRunComplete: (runId: string, testId?: string, suiteId?: string) => {
      // Invalidate the specific run
      queryClient.invalidateQueries({ queryKey: runKeys.detail(runId) });
      // Invalidate run lists
      queryClient.invalidateQueries({ queryKey: runKeys.lists() });
      // Invalidate dashboard stats
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
      // Invalidate test-specific runs if testId provided
      if (testId) {
        queryClient.invalidateQueries({ queryKey: runKeys.byTest(testId) });
      }
      // Invalidate suite-specific runs if suiteId provided
      if (suiteId) {
        queryClient.invalidateQueries({ queryKey: runKeys.bySuite(suiteId) });
      }
    },
  };
}
