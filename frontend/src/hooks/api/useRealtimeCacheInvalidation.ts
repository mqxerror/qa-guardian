/**
 * React Query cache invalidation triggered by WebSocket events
 * Feature #96: Real-time cache invalidation for instant UI updates
 *
 * This hook listens to WebSocket events from the backend and automatically
 * invalidates the relevant React Query cache, so UI updates appear
 * immediately without requiring manual refresh.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocketStore } from '../../stores/socketStore';
import { runKeys } from './useRuns';
import { testKeys } from './useTests';
import { suiteKeys } from './useSuites';
import { dashboardKeys } from './useDashboard';

// Event payload types from backend
interface RunEventPayload {
  runId: string;
  orgId: string;
  status?: string;
  testId?: string;
  suiteId?: string;
  suite_id?: string;
  test_id?: string;
}

interface TestEventPayload {
  testId: string;
  orgId: string;
  suiteId?: string;
  suite_id?: string;
}

/**
 * Hook to automatically invalidate React Query cache when WebSocket events are received.
 * Use this in a top-level component (App.tsx or Layout) to enable real-time updates.
 *
 * Events handled:
 * - run-start: Invalidates run lists and dashboard stats
 * - run-complete: Invalidates run detail, lists, and dashboard stats
 * - run-progress: No invalidation (handled locally by UI components)
 * - test-created: Invalidates test lists for the suite
 * - test-updated: Invalidates test detail and lists
 */
export function useRealtimeCacheInvalidation() {
  const socket = useSocketStore(state => state.socket);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    // Handle run-start event
    const handleRunStart = (data: RunEventPayload) => {
      console.log('[RealtimeCache] run-start event:', data.runId);

      // Invalidate run lists so the new run appears
      queryClient.invalidateQueries({ queryKey: runKeys.lists() });

      // Invalidate dashboard stats (run count changed)
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });

      // Invalidate runs by test/suite if provided
      const testId = data.testId || data.test_id;
      const suiteId = data.suiteId || data.suite_id;
      if (testId) {
        queryClient.invalidateQueries({ queryKey: runKeys.byTest(testId) });
      }
      if (suiteId) {
        queryClient.invalidateQueries({ queryKey: runKeys.bySuite(suiteId) });
      }
    };

    // Handle run-complete event
    const handleRunComplete = (data: RunEventPayload) => {
      console.log('[RealtimeCache] run-complete event:', data.runId, 'status:', data.status);

      // Invalidate the specific run detail
      queryClient.invalidateQueries({ queryKey: runKeys.detail(data.runId) });

      // Invalidate all run lists
      queryClient.invalidateQueries({ queryKey: runKeys.lists() });

      // Invalidate dashboard stats (pass/fail counts changed)
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.recentRuns() });

      // Invalidate runs by test/suite if provided
      const testId = data.testId || data.test_id;
      const suiteId = data.suiteId || data.suite_id;
      if (testId) {
        queryClient.invalidateQueries({ queryKey: runKeys.byTest(testId) });
        // Also invalidate test detail (may show last run status)
        queryClient.invalidateQueries({ queryKey: testKeys.detail(testId) });
      }
      if (suiteId) {
        queryClient.invalidateQueries({ queryKey: runKeys.bySuite(suiteId) });
        // Also invalidate test lists for the suite (may show last_run metadata)
        queryClient.invalidateQueries({ queryKey: testKeys.listBySuite(suiteId) });
      }
    };

    // Handle test-created event (if backend emits it)
    const handleTestCreated = (data: TestEventPayload) => {
      console.log('[RealtimeCache] test-created event:', data.testId);

      const suiteId = data.suiteId || data.suite_id;
      if (suiteId) {
        // Invalidate test lists for the suite
        queryClient.invalidateQueries({ queryKey: testKeys.listBySuite(suiteId) });
        // Invalidate suite detail (may show test count)
        queryClient.invalidateQueries({ queryKey: suiteKeys.detail(suiteId) });
      }

      // Invalidate dashboard stats (test count changed)
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
    };

    // Handle test-updated event (if backend emits it)
    const handleTestUpdated = (data: TestEventPayload) => {
      console.log('[RealtimeCache] test-updated event:', data.testId);

      // Invalidate the specific test detail
      queryClient.invalidateQueries({ queryKey: testKeys.detail(data.testId) });

      const suiteId = data.suiteId || data.suite_id;
      if (suiteId) {
        // Invalidate test lists for the suite
        queryClient.invalidateQueries({ queryKey: testKeys.listBySuite(suiteId) });
      }
    };

    // Subscribe to WebSocket events
    socket.on('run-start', handleRunStart);
    socket.on('run-complete', handleRunComplete);
    socket.on('test-created', handleTestCreated);
    socket.on('test-updated', handleTestUpdated);

    // Cleanup on unmount
    return () => {
      socket.off('run-start', handleRunStart);
      socket.off('run-complete', handleRunComplete);
      socket.off('test-created', handleTestCreated);
      socket.off('test-updated', handleTestUpdated);
    };
  }, [socket, queryClient]);
}

/**
 * Export for use in App.tsx or Layout component
 */
export default useRealtimeCacheInvalidation;
