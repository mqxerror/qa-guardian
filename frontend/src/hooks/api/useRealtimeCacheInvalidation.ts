/**
 * React Query cache invalidation triggered by WebSocket events
 * Feature #96: Real-time cache invalidation for instant UI updates
 * Feature #108: Added suite/project CRUD events and run-progress handler
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
import { projectKeys } from './useProjects';
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
  progress?: number;
}

interface TestEventPayload {
  testId: string;
  orgId: string;
  suiteId?: string;
  suite_id?: string;
}

// Feature #108: Suite event payload
interface SuiteEventPayload {
  suiteId: string;
  orgId: string;
  projectId?: string;
  project_id?: string;
}

// Feature #108: Project event payload
interface ProjectEventPayload {
  projectId: string;
  orgId: string;
}

/**
 * Hook to automatically invalidate React Query cache when WebSocket events are received.
 * Use this in a top-level component (App.tsx or Layout) to enable real-time updates.
 *
 * Events handled:
 * - run-start: Invalidates run lists and dashboard stats
 * - run-complete: Invalidates run detail, lists, and dashboard stats
 * - run-progress: Invalidates run detail for live progress updates
 * - test-created: Invalidates test lists for the suite
 * - test-updated: Invalidates test detail and lists
 * - test-deleted: Invalidates test lists and suite detail
 * Feature #108:
 * - suite-created: Invalidates suite lists
 * - suite-updated: Invalidates suite detail and lists
 * - suite-deleted: Invalidates suite lists and project detail
 * - project-created: Invalidates project lists
 * - project-updated: Invalidates project detail and lists
 * - project-deleted: Invalidates project lists and dashboard
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

    // Feature #108: Handle run-progress event for live status updates
    const handleRunProgress = (data: RunEventPayload) => {
      console.log('[RealtimeCache] run-progress event:', data.runId, 'progress:', data.progress);

      // Invalidate the specific run detail for live progress updates
      queryClient.invalidateQueries({ queryKey: runKeys.detail(data.runId) });
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

    // Handle test-created event
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

    // Handle test-updated event
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

    // Feature #108: Handle test-deleted event
    const handleTestDeleted = (data: TestEventPayload) => {
      console.log('[RealtimeCache] test-deleted event:', data.testId);

      const suiteId = data.suiteId || data.suite_id;
      if (suiteId) {
        // Invalidate test lists for the suite
        queryClient.invalidateQueries({ queryKey: testKeys.listBySuite(suiteId) });
        // Invalidate suite detail (test count changed)
        queryClient.invalidateQueries({ queryKey: suiteKeys.detail(suiteId) });
      }

      // Invalidate dashboard stats (test count changed)
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
    };

    // Feature #108: Handle suite-created event
    const handleSuiteCreated = (data: SuiteEventPayload) => {
      console.log('[RealtimeCache] suite-created event:', data.suiteId);

      const projectId = data.projectId || data.project_id;

      // Invalidate suite lists
      queryClient.invalidateQueries({ queryKey: suiteKeys.lists() });

      if (projectId) {
        // Invalidate suites for the specific project
        queryClient.invalidateQueries({ queryKey: suiteKeys.listByProject(projectId) });
        // Invalidate project detail (may show suite count)
        queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      }

      // Invalidate dashboard stats (suite count changed)
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
    };

    // Feature #108: Handle suite-updated event
    const handleSuiteUpdated = (data: SuiteEventPayload) => {
      console.log('[RealtimeCache] suite-updated event:', data.suiteId);

      // Invalidate the specific suite detail
      queryClient.invalidateQueries({ queryKey: suiteKeys.detail(data.suiteId) });

      const projectId = data.projectId || data.project_id;
      if (projectId) {
        // Invalidate suite lists for the project
        queryClient.invalidateQueries({ queryKey: suiteKeys.listByProject(projectId) });
      }

      // Also invalidate general suite lists
      queryClient.invalidateQueries({ queryKey: suiteKeys.lists() });
    };

    // Feature #108: Handle suite-deleted event
    const handleSuiteDeleted = (data: SuiteEventPayload) => {
      console.log('[RealtimeCache] suite-deleted event:', data.suiteId);

      const projectId = data.projectId || data.project_id;

      // Invalidate suite lists
      queryClient.invalidateQueries({ queryKey: suiteKeys.lists() });

      if (projectId) {
        // Invalidate suites for the specific project
        queryClient.invalidateQueries({ queryKey: suiteKeys.listByProject(projectId) });
        // Invalidate project detail (suite count changed)
        queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      }

      // Invalidate dashboard stats (suite count changed)
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
    };

    // Feature #108: Handle project-created event
    const handleProjectCreated = (data: ProjectEventPayload) => {
      console.log('[RealtimeCache] project-created event:', data.projectId);

      // Invalidate project lists
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });

      // Invalidate dashboard stats (project count changed)
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });
    };

    // Feature #108: Handle project-updated event
    const handleProjectUpdated = (data: ProjectEventPayload) => {
      console.log('[RealtimeCache] project-updated event:', data.projectId);

      // Invalidate the specific project detail
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(data.projectId) });

      // Invalidate project lists
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    };

    // Feature #108: Handle project-deleted event
    const handleProjectDeleted = (data: ProjectEventPayload) => {
      console.log('[RealtimeCache] project-deleted event:', data.projectId);

      // Invalidate project lists
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });

      // Invalidate dashboard stats (project count changed)
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() });

      // Invalidate dashboard recent runs (may reference deleted project)
      queryClient.invalidateQueries({ queryKey: dashboardKeys.recentRuns() });
    };

    // Subscribe to WebSocket events
    socket.on('run-start', handleRunStart);
    socket.on('run-progress', handleRunProgress);
    socket.on('run-complete', handleRunComplete);
    socket.on('test-created', handleTestCreated);
    socket.on('test-updated', handleTestUpdated);
    socket.on('test-deleted', handleTestDeleted);
    // Feature #108: Suite events
    socket.on('suite-created', handleSuiteCreated);
    socket.on('suite-updated', handleSuiteUpdated);
    socket.on('suite-deleted', handleSuiteDeleted);
    // Feature #108: Project events
    socket.on('project-created', handleProjectCreated);
    socket.on('project-updated', handleProjectUpdated);
    socket.on('project-deleted', handleProjectDeleted);

    // Cleanup on unmount
    return () => {
      socket.off('run-start', handleRunStart);
      socket.off('run-progress', handleRunProgress);
      socket.off('run-complete', handleRunComplete);
      socket.off('test-created', handleTestCreated);
      socket.off('test-updated', handleTestUpdated);
      socket.off('test-deleted', handleTestDeleted);
      socket.off('suite-created', handleSuiteCreated);
      socket.off('suite-updated', handleSuiteUpdated);
      socket.off('suite-deleted', handleSuiteDeleted);
      socket.off('project-created', handleProjectCreated);
      socket.off('project-updated', handleProjectUpdated);
      socket.off('project-deleted', handleProjectDeleted);
    };
  }, [socket, queryClient]);
}

/**
 * Export for use in App.tsx or Layout component
 */
export default useRealtimeCacheInvalidation;
