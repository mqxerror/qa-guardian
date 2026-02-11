/**
 * React Query hooks for tests API
 * Feature #56: Create React Query hooks for API data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
// Feature #91: Import query keys for cross-cache invalidation
import { dashboardKeys } from './useDashboard';
import { suiteKeys } from './useSuites';
import { fetchWithAuth } from './fetchWithAuth'; // Feature #655: Shared auth fetch

// Types
export interface TestStep {
  id: string;
  order: number;
  action: string;
  selector?: string;
  value?: string;
  description?: string;
}

export interface Test {
  id: string;
  suite_id: string;
  // Feature #137: Enriched fields from JOIN to eliminate waterfall fetches
  suite_name?: string;
  project_id?: string;
  project_name?: string;
  organization_id: string;
  name: string;
  description?: string;
  order: number;
  test_type: 'e2e' | 'visual' | 'accessibility' | 'performance' | 'load';
  steps: TestStep[];
  target_url?: string;
  status: 'draft' | 'active' | 'disabled';
  review_status?: string;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
  // Run metadata (from list endpoint)
  run_count?: number;
  last_run_at?: string;
  last_result?: string;
  avg_duration_ms?: number;
  // Load test specific
  virtual_users?: number;
  duration?: number;
  ramp_up_time?: number;
  k6_thresholds?: Array<{ metric: string; expression: string }>;
}

export interface PaginatedTestsResponse {
  data: Test[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  tests: Test[]; // backwards compatibility
}

export interface TestsQueryParams {
  page?: number;
  limit?: number;
}

export interface CreateTestInput {
  name: string;
  description?: string;
  test_type?: string;
  target_url?: string;
  steps?: TestStep[];
}

export interface UpdateTestInput {
  name?: string;
  description?: string;
  target_url?: string;
  steps?: TestStep[];
  status?: 'draft' | 'active' | 'disabled';
}

// Query keys factory
export const testKeys = {
  all: ['tests'] as const,
  lists: () => [...testKeys.all, 'list'] as const,
  listBySuite: (suiteId: string, params?: TestsQueryParams) =>
    [...testKeys.lists(), 'suite', suiteId, params] as const,
  details: () => [...testKeys.all, 'detail'] as const,
  detail: (id: string) => [...testKeys.details(), id] as const,
  code: (id: string) => [...testKeys.all, 'code', id] as const,
};

/**
 * Hook to fetch paginated tests for a suite
 */
export function useTestsPaginated(suiteId: string | undefined, params: TestsQueryParams = {}) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: testKeys.listBySuite(suiteId || '', params),
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));

      const queryString = searchParams.toString();
      const url = `/api/v1/suites/${suiteId}/tests${queryString ? `?${queryString}` : ''}`;
      return fetchWithAuth(url, token) as Promise<PaginatedTestsResponse>;
    },
    enabled: !!token && !!suiteId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch all tests for a suite (backwards compatible)
 */
export function useTests(suiteId: string | undefined) {
  return useTestsPaginated(suiteId, { limit: 100 });
}

/**
 * Hook to fetch a single test by ID
 */
export function useTest(testId: string | undefined) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: testKeys.detail(testId || ''),
    queryFn: () => fetchWithAuth(`/api/v1/tests/${testId}`, token),
    enabled: !!token && !!testId,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to fetch generated Playwright code for a test
 */
export function useTestCode(testId: string | undefined, format: 'typescript' | 'javascript' = 'typescript') {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: [...testKeys.code(testId || ''), format],
    queryFn: () => fetchWithAuth(`/api/v1/tests/${testId}/code?format=${format}`, token),
    enabled: !!token && !!testId,
    staleTime: 60 * 1000, // 1 minute - code doesn't change often
    gcTime: 2 * 60 * 1000, // Feature #106: 2x staleTime for garbage collection
  });
}

/**
 * Hook to create a new test
 * Feature #65: Added optimistic updates for immediate UI feedback
 */
export function useCreateTest() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ suiteId, data }: { suiteId: string; data: CreateTestInput }) =>
      fetchWithAuth(`/api/v1/suites/${suiteId}/tests`, token, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    // Optimistic update: add the new test to cache immediately
    onMutate: async ({ suiteId, data }) => {
      // Cancel any outgoing refetches (all queries for this suite)
      await queryClient.cancelQueries({ queryKey: testKeys.listBySuite(suiteId) });

      // The page uses useTests which internally uses { limit: 100 }
      const queryKey = testKeys.listBySuite(suiteId, { limit: 100 });

      // Snapshot the previous value for rollback
      const previousTests = queryClient.getQueryData<PaginatedTestsResponse>(queryKey);

      // Optimistically add the new test
      if (previousTests) {
        const optimisticTest: Test = {
          id: `temp-${Date.now()}`, // Temporary ID until server responds
          suite_id: suiteId,
          organization_id: '', // Will be set by server
          name: data.name,
          description: data.description,
          order: (previousTests.data?.length || 0) + 1,
          test_type: (data.test_type as Test['test_type']) || 'e2e',
          steps: data.steps || [],
          target_url: data.target_url,
          status: 'draft',
          ai_generated: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData<PaginatedTestsResponse>(
          queryKey,
          {
            ...previousTests,
            data: [...(previousTests.data || []), optimisticTest],
            tests: [...(previousTests.tests || []), optimisticTest],
            pagination: {
              ...previousTests.pagination,
              total: (previousTests.pagination?.total || 0) + 1,
            },
          }
        );
      }

      // Return context with previous value for rollback
      return { previousTests, suiteId, queryKey };
    },
    // Rollback on error
    onError: (_err, _vars, context) => {
      if (context?.previousTests && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousTests);
      }
    },
    // Always refetch after error or success to get fresh data
    // Feature #91: Invalidate all related caches when test count changes
    onSettled: (_, __, { suiteId }) => {
      queryClient.invalidateQueries({ queryKey: testKeys.listBySuite(suiteId) });
      // Invalidate dashboard stats (test count changed)
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
      // Invalidate suite detail (may show test count)
      queryClient.invalidateQueries({ queryKey: suiteKeys.detail(suiteId) });
    },
  });
}

/**
 * Hook to update a test
 * Feature #91: Enhanced cache invalidation for immediate UI updates
 * Feature #109: Added optimistic updates for immediate UI feedback
 */
export function useUpdateTest() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data, suiteId }: { id: string; data: UpdateTestInput; suiteId?: string }) =>
      fetchWithAuth(`/api/v1/tests/${id}`, token, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    // Feature #109: Optimistic update
    onMutate: async ({ id, data, suiteId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: testKeys.detail(id) });
      if (suiteId) {
        await queryClient.cancelQueries({ queryKey: testKeys.listBySuite(suiteId) });
      }

      // Snapshot previous values for rollback
      const previousTest = queryClient.getQueryData<{ test: Test }>(
        testKeys.detail(id)
      );
      const previousTests = suiteId
        ? queryClient.getQueryData<PaginatedTestsResponse>(testKeys.listBySuite(suiteId))
        : undefined;

      // Optimistically update test detail
      if (previousTest) {
        queryClient.setQueryData<{ test: Test }>(testKeys.detail(id), {
          test: {
            ...previousTest.test,
            ...data,
            updated_at: new Date().toISOString(),
          },
        });
      }

      // Optimistically update test in list
      if (previousTests && suiteId) {
        queryClient.setQueryData<PaginatedTestsResponse>(
          testKeys.listBySuite(suiteId),
          {
            ...previousTests,
            data: previousTests.data.map((t) =>
              t.id === id ? { ...t, ...data, updated_at: new Date().toISOString() } : t
            ),
            tests: (previousTests.tests || []).map((t) =>
              t.id === id ? { ...t, ...data, updated_at: new Date().toISOString() } : t
            ),
          }
        );
      }

      return { previousTest, previousTests, suiteId };
    },
    // Rollback on error
    onError: (_err, { id, suiteId }, context) => {
      if (context?.previousTest) {
        queryClient.setQueryData(testKeys.detail(id), context.previousTest);
      }
      if (context?.previousTests && suiteId) {
        queryClient.setQueryData(testKeys.listBySuite(suiteId), context.previousTests);
      }
    },
    // Always refetch after error or success
    onSettled: (updatedTest, _err, { id, suiteId }) => {
      // Invalidate the specific test detail
      queryClient.invalidateQueries({ queryKey: testKeys.detail(id) });
      // Feature #110: Narrow scope - only invalidate the specific suite's tests, not all tests
      const effectiveSuiteId = (updatedTest as Test)?.suite_id || suiteId;
      if (effectiveSuiteId) {
        queryClient.invalidateQueries({ queryKey: testKeys.listBySuite(effectiveSuiteId) });
        // Feature #91: Also invalidate suite detail if test belongs to a suite
        queryClient.invalidateQueries({ queryKey: suiteKeys.detail(effectiveSuiteId) });
      }
    },
  });
}

/**
 * Hook to delete a test
 * Feature #91: Enhanced cache invalidation including dashboard stats and suite
 * Feature #109: Added optimistic updates for immediate UI feedback
 */
export function useDeleteTest() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, suiteId }: { id: string; suiteId?: string }) =>
      fetchWithAuth(`/api/v1/tests/${id}`, token, {
        method: 'DELETE',
      }),
    // Feature #109: Optimistic update - remove test immediately
    onMutate: async ({ id, suiteId }) => {
      // Cancel any outgoing refetches
      if (suiteId) {
        await queryClient.cancelQueries({ queryKey: testKeys.listBySuite(suiteId) });
      }

      // Snapshot previous values for rollback
      const previousTests = suiteId
        ? queryClient.getQueryData<PaginatedTestsResponse>(testKeys.listBySuite(suiteId))
        : undefined;

      // Optimistically remove the test from list
      if (previousTests && suiteId) {
        queryClient.setQueryData<PaginatedTestsResponse>(
          testKeys.listBySuite(suiteId),
          {
            ...previousTests,
            data: previousTests.data.filter((t) => t.id !== id),
            tests: (previousTests.tests || []).filter((t) => t.id !== id),
            pagination: {
              ...previousTests.pagination,
              total: Math.max(0, (previousTests.pagination?.total || 0) - 1),
            },
          }
        );
      }

      return { previousTests, suiteId };
    },
    // Rollback on error
    onError: (_err, { suiteId }, context) => {
      if (context?.previousTests && suiteId) {
        queryClient.setQueryData(testKeys.listBySuite(suiteId), context.previousTests);
      }
    },
    // Always refetch after error or success
    onSettled: (_, __, { suiteId }) => {
      // Feature #110: Narrow scope - only invalidate the specific suite's tests
      if (suiteId) {
        queryClient.invalidateQueries({ queryKey: testKeys.listBySuite(suiteId) });
        // Feature #91: Invalidate suite detail (test count changed)
        queryClient.invalidateQueries({ queryKey: suiteKeys.detail(suiteId) });
      }
      // Feature #91: Invalidate dashboard stats (test count changed)
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
    },
  });
}

/**
 * Hook to invalidate test queries
 * Feature #91: Enhanced to also invalidate dashboard stats and suite details
 */
export function useInvalidateTests() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: testKeys.all });
      // Feature #91: Also invalidate dashboard when all tests are invalidated
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
    },
    invalidateLists: () => {
      queryClient.invalidateQueries({ queryKey: testKeys.lists() });
      // Feature #91: Also invalidate dashboard stats
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
    },
    invalidateTest: (id: string) => queryClient.invalidateQueries({ queryKey: testKeys.detail(id) }),
    invalidateBySuite: (suiteId: string) => {
      queryClient.invalidateQueries({ queryKey: testKeys.listBySuite(suiteId) });
      // Feature #91: Also invalidate dashboard stats and suite detail
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
      queryClient.invalidateQueries({ queryKey: suiteKeys.detail(suiteId) });
    },
  };
}

/**
 * Feature #143: Hook to review a single test
 * Mutation hook to update test review status with cache invalidation
 */
export function useReviewTest() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ testId, status, notes }: { testId: string; status: 'approved' | 'rejected' | 'needs_review'; notes?: string }) =>
      fetchWithAuth(`/api/v1/tests/${testId}/review`, token, {
        method: 'POST',
        body: JSON.stringify({ status, notes }),
      }),
    onSuccess: (_, { testId }) => {
      // Invalidate the specific test detail
      queryClient.invalidateQueries({ queryKey: testKeys.detail(testId) });
      // Invalidate all test lists (review status changed)
      queryClient.invalidateQueries({ queryKey: testKeys.lists() });
    },
  });
}

/**
 * Feature #143: Hook to batch review multiple tests
 * Mutation hook for bulk review operations with cache invalidation
 */
export function useBatchReviewTests() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ testIds, status }: { testIds: string[]; status: 'approved' | 'rejected' | 'needs_review'; suiteId?: string }) =>
      fetchWithAuth('/api/v1/tests/bulk-review', token, {
        method: 'POST',
        body: JSON.stringify({ test_ids: testIds, status }),
      }),
    onSuccess: (_, { testIds, suiteId }) => {
      // Invalidate all affected test details
      testIds.forEach(id => {
        queryClient.invalidateQueries({ queryKey: testKeys.detail(id) });
      });
      // Invalidate test lists
      queryClient.invalidateQueries({ queryKey: testKeys.lists() });
      // Invalidate suite detail if provided
      if (suiteId) {
        queryClient.invalidateQueries({ queryKey: suiteKeys.detail(suiteId) });
      }
    },
  });
}

/**
 * Feature #143: Hook to duplicate a test
 * Mutation hook with cache invalidation for the duplicated test
 */
export function useDuplicateTest() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ suiteId, data }: { suiteId: string; data: CreateTestInput }) =>
      fetchWithAuth(`/api/v1/suites/${suiteId}/tests`, token, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { suiteId }) => {
      // Invalidate test lists for the suite
      queryClient.invalidateQueries({ queryKey: testKeys.listBySuite(suiteId) });
      // Invalidate suite detail (test count changed)
      queryClient.invalidateQueries({ queryKey: suiteKeys.detail(suiteId) });
      // Invalidate dashboard stats
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
    },
  });
}

/**
 * Feature #143: Hook to update a selector override for a test step
 * Mutation hook for healing/updating selectors
 */
export function useUpdateSelector() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ testId, stepId, newSelector, notes }: { testId: string; stepId: string; newSelector: string; notes?: string }) =>
      fetchWithAuth(`/api/v1/tests/${testId}/steps/${stepId}/selector`, token, {
        method: 'PUT',
        body: JSON.stringify({ new_selector: newSelector, notes }),
      }),
    onSuccess: (_, { testId }) => {
      // Invalidate the specific test detail (selector changed)
      queryClient.invalidateQueries({ queryKey: testKeys.detail(testId) });
    },
  });
}
