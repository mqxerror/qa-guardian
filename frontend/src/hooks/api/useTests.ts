/**
 * React Query hooks for tests API
 * Feature #56: Create React Query hooks for API data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';

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
  });
}

/**
 * Hook to create a new test
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
    onSuccess: (_, { suiteId }) => {
      queryClient.invalidateQueries({ queryKey: testKeys.listBySuite(suiteId) });
    },
  });
}

/**
 * Hook to update a test
 */
export function useUpdateTest() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTestInput }) =>
      fetchWithAuth(`/api/v1/tests/${id}`, token, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: testKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: testKeys.lists() });
    },
  });
}

/**
 * Hook to delete a test
 */
export function useDeleteTest() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchWithAuth(`/api/v1/tests/${id}`, token, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: testKeys.lists() });
    },
  });
}

/**
 * Hook to invalidate test queries
 */
export function useInvalidateTests() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: testKeys.all }),
    invalidateLists: () => queryClient.invalidateQueries({ queryKey: testKeys.lists() }),
    invalidateTest: (id: string) => queryClient.invalidateQueries({ queryKey: testKeys.detail(id) }),
    invalidateBySuite: (suiteId: string) =>
      queryClient.invalidateQueries({ queryKey: testKeys.listBySuite(suiteId) }),
  };
}
