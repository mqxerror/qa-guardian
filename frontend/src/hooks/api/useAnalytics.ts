/**
 * React Query hooks for analytics API
 * Feature #72: Create React Query hooks for analytics with caching
 */

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';

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
export const analyticsKeys = {
  all: ['analytics'] as const,
  failingTests: () => [...analyticsKeys.all, 'failingTests'] as const,
  browserStats: () => [...analyticsKeys.all, 'browserStats'] as const,
  projectComparison: () => [...analyticsKeys.all, 'projectComparison'] as const,
  flakyTests: () => [...analyticsKeys.all, 'flakyTests'] as const,
  passRateTrends: (days: number) => [...analyticsKeys.all, 'passRateTrends', days] as const,
  accessibilityTrends: (days: number) => [...analyticsKeys.all, 'accessibilityTrends', days] as const,
  failureClusters: (days: number) => [...analyticsKeys.all, 'failureClusters', days] as const,
  // Feature #470: Duration trends key
  durationTrends: (days: number, browser?: string, testType?: string) =>
    [...analyticsKeys.all, 'durationTrends', days, browser || 'all', testType || 'all'] as const,
  // Feature #476: Branch comparison key
  branchComparison: (branchA?: string, branchB?: string) =>
    [...analyticsKeys.all, 'branchComparison', branchA || 'none', branchB || 'none'] as const,
};

/**
 * Hook to fetch most failing tests
 * Feature #72: Caches for 5 minutes for faster analytics page loading
 */
export function useFailingTests() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: analyticsKeys.failingTests(),
    queryFn: () => fetchWithAuth('/api/v1/analytics/failing-tests', token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes - analytics data doesn't change frequently
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

/**
 * Hook to fetch browser statistics
 * Feature #72: Caches for 5 minutes
 */
export function useBrowserStats() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: analyticsKeys.browserStats(),
    queryFn: () => fetchWithAuth('/api/v1/analytics/browser-stats', token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch project comparison statistics
 * Feature #72: Caches for 5 minutes
 */
export function useProjectComparison() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: analyticsKeys.projectComparison(),
    queryFn: () => fetchWithAuth('/api/v1/analytics/project-comparison', token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch flaky tests
 * Feature #72: Caches for 5 minutes
 */
export function useFlakyTests() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: analyticsKeys.flakyTests(),
    queryFn: () => fetchWithAuth('/api/v1/analytics/flaky-tests', token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch pass rate trends
 * Feature #72: Caches for 5 minutes, keyed by days parameter
 */
export function usePassRateTrends(days: 7 | 30 = 7) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: analyticsKeys.passRateTrends(days),
    queryFn: () => fetchWithAuth(`/api/v1/analytics/pass-rate-trends?days=${days}`, token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch accessibility trends
 * Feature #72: Caches for 5 minutes, keyed by days parameter
 */
export function useAccessibilityTrends(days: 7 | 30 = 7) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: analyticsKeys.accessibilityTrends(days),
    queryFn: () => fetchWithAuth(`/api/v1/analytics/accessibility-trends?days=${days}`, token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch AI failure clusters
 * Feature #72: Caches for 5 minutes, keyed by days parameter
 */
export function useFailureClusters(days: 7 | 14 | 30 = 7) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: analyticsKeys.failureClusters(days),
    queryFn: () => fetchWithAuth(`/api/v1/ai/failure-clusters?days=${days}`, token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Feature #470: Hook to fetch duration trends with p50/p95/p99 percentiles
 * Caches for 5 minutes, keyed by days, browser, and testType parameters
 */
export function useDurationTrends(
  days: 7 | 30 = 7,
  browser?: string,
  testType?: string
) {
  const token = useAuthStore(state => state.token);

  // Build query string with optional filters
  const params = new URLSearchParams({ days: String(days) });
  if (browser) params.append('browser', browser);
  if (testType) params.append('test_type', testType);

  return useQuery({
    queryKey: analyticsKeys.durationTrends(days, browser, testType),
    queryFn: () => fetchWithAuth(`/api/v1/analytics/duration-trends?${params.toString()}`, token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Feature #476: Hook to fetch branch comparison statistics
 * Compare test metrics between two branches: pass rate, duration, failures, flaky count
 */
export function useBranchComparison(branchA?: string, branchB?: string) {
  const token = useAuthStore(state => state.token);

  // Build query string with branch parameters
  const params = new URLSearchParams();
  if (branchA) params.append('branchA', branchA);
  if (branchB) params.append('branchB', branchB);

  return useQuery({
    queryKey: analyticsKeys.branchComparison(branchA, branchB),
    queryFn: () => fetchWithAuth(`/api/v1/analytics/branch-comparison?${params.toString()}`, token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
