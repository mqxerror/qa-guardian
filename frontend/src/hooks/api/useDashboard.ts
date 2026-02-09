/**
 * React Query hooks for dashboard API
 * Feature #70: Create React Query hooks for dashboard data with caching
 */

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';

// Types
export interface DashboardStats {
  projects: number;
  test_suites: number;
  tests: number;
  test_runs: number;
  passed_runs: number;
  failed_runs: number;
  pass_rate: number;
}

export interface RecentRun {
  id: string;
  suite_id: string;
  suite_name: string;
  project_id: string;
  project_name?: string;
  test_id: string | null;
  test_name?: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled' | 'error';
  browser: string;
  branch: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
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
export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
  recentRuns: (limit?: number) => [...dashboardKeys.all, 'recentRuns', limit] as const,
};

/**
 * Hook to fetch dashboard statistics
 * Feature #70: Caches stats for 30 seconds for instant reload
 */
export function useDashboardStats() {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: () => fetchWithAuth('/api/v1/stats', token) as Promise<DashboardStats>,
    enabled: !!token,
    staleTime: 30 * 1000, // 30 seconds - stats don't change frequently
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

/**
 * Hook to fetch recent test runs for dashboard
 * Feature #70: Caches recent runs for quick dashboard loading
 */
export function useRecentRuns(limit: number = 10) {
  const token = useAuthStore(state => state.token);

  return useQuery({
    queryKey: dashboardKeys.recentRuns(limit),
    queryFn: () => fetchWithAuth(`/api/v1/test-runs?limit=${limit}&sort=created_at:desc`, token) as Promise<{ runs: RecentRun[] }>,
    enabled: !!token,
    staleTime: 15 * 1000, // 15 seconds - runs can change more frequently
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}
