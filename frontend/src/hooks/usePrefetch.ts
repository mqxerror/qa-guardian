/**
 * Feature #134: Route Prefetching Hook
 * Prefetch data when user hovers over navigation links for instant page loads.
 *
 * Usage:
 * ```tsx
 * const prefetch = usePrefetch();
 *
 * <Link
 *   to={`/projects/${id}`}
 *   onMouseEnter={() => prefetch.project(id)}
 * >
 *   View Project
 * </Link>
 * ```
 */

import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { projectKeys } from './api/useProjects';
import { suiteKeys } from './api/useSuites';
import { dashboardKeys } from './api/useDashboard';

// Maximum concurrent prefetches to avoid network flooding
const MAX_CONCURRENT_PREFETCHES = 2;

// Debounce delay in ms (prevent rapid-fire prefetches)
const PREFETCH_DELAY = 100;

// Stale time for prefetched data (how long to keep in cache)
const PREFETCH_STALE_TIME = 60 * 1000; // 1 minute

/**
 * Fetch helper with auth
 */
async function fetchWithAuth(url: string, token: string | null) {
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Hook for prefetching route data on hover
 */
export function usePrefetch() {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);

  // Track active prefetches to limit concurrency
  const activePrefetches = useRef(new Set<string>());

  // Track pending prefetch timeouts for debouncing
  const pendingTimeouts = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  /**
   * Generic prefetch function with concurrency and debounce control
   */
  const prefetch = useCallback(
    async (key: string, queryKey: readonly unknown[], queryFn: () => Promise<unknown>) => {
      // Skip if already in cache and not stale
      const existingData = queryClient.getQueryData(queryKey);
      if (existingData) {
        return;
      }

      // Skip if already prefetching this
      if (activePrefetches.current.has(key)) {
        return;
      }

      // Skip if too many concurrent prefetches
      if (activePrefetches.current.size >= MAX_CONCURRENT_PREFETCHES) {
        return;
      }

      // Clear any pending timeout for this key
      const pendingTimeout = pendingTimeouts.current.get(key);
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
      }

      // Debounce the prefetch
      const timeout = setTimeout(async () => {
        pendingTimeouts.current.delete(key);

        // Double-check concurrency after debounce
        if (activePrefetches.current.size >= MAX_CONCURRENT_PREFETCHES) {
          return;
        }

        activePrefetches.current.add(key);

        try {
          await queryClient.prefetchQuery({
            queryKey,
            queryFn,
            staleTime: PREFETCH_STALE_TIME,
          });
        } catch (error) {
          // Silently ignore prefetch errors - they're not critical
          console.debug('Prefetch failed:', key, error);
        } finally {
          activePrefetches.current.delete(key);
        }
      }, PREFETCH_DELAY);

      pendingTimeouts.current.set(key, timeout);
    },
    [queryClient]
  );

  /**
   * Prefetch projects list
   */
  const prefetchProjects = useCallback(() => {
    prefetch('projects', projectKeys.list(false), () =>
      fetchWithAuth('/api/v1/projects', token)
    );
  }, [prefetch, token]);

  /**
   * Prefetch a specific project
   */
  const prefetchProject = useCallback(
    (projectId: string) => {
      prefetch(`project:${projectId}`, projectKeys.detail(projectId), () =>
        fetchWithAuth(`/api/v1/projects/${projectId}`, token)
      );
    },
    [prefetch, token]
  );

  /**
   * Prefetch suites for a project
   */
  const prefetchSuites = useCallback(
    (projectId: string) => {
      prefetch(`suites:${projectId}`, suiteKeys.listByProject(projectId), () =>
        fetchWithAuth(`/api/v1/projects/${projectId}/suites`, token)
      );
    },
    [prefetch, token]
  );

  /**
   * Prefetch a specific suite
   */
  const prefetchSuite = useCallback(
    (suiteId: string) => {
      prefetch(`suite:${suiteId}`, suiteKeys.detail(suiteId), () =>
        fetchWithAuth(`/api/v1/test-suites/${suiteId}`, token)
      );
    },
    [prefetch, token]
  );

  /**
   * Prefetch dashboard data
   */
  const prefetchDashboard = useCallback(() => {
    prefetch('dashboard', dashboardKeys.stats(), () =>
      fetchWithAuth('/api/v1/dashboard/summary', token)
    );
  }, [prefetch, token]);

  /**
   * Cancel all pending prefetches
   */
  const cancelAll = useCallback(() => {
    pendingTimeouts.current.forEach((timeout) => clearTimeout(timeout));
    pendingTimeouts.current.clear();
  }, []);

  return {
    // Individual prefetch functions
    projects: prefetchProjects,
    project: prefetchProject,
    suites: prefetchSuites,
    suite: prefetchSuite,
    dashboard: prefetchDashboard,

    // Utility
    cancelAll,
  };
}

/**
 * Hook for prefetching on Link hover
 * Returns props to spread onto a Link component
 */
export function useLinkPrefetch(
  prefetchFn: () => void
): { onMouseEnter: () => void; onFocus: () => void } {
  return {
    onMouseEnter: prefetchFn,
    onFocus: prefetchFn, // Also prefetch on keyboard focus for accessibility
  };
}

export default usePrefetch;
