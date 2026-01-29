/**
 * Run Control Routes Module (Feature #1356 - Code Quality)
 * Extracted from test-runs.ts to reduce file size
 * Contains: Cancel, pause, resume, queue status, prioritization
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../middleware/auth';
import { testRuns, runningBrowsers, TestRun } from './execution';
import { getTestRun as dbGetTestRun, listTestRunsByOrg as dbListTestRunsByOrg, updateTestRun as dbUpdateTestRun } from '../../services/repositories/test-runs';

// Helper: get test run from Map first, then fall back to DB
async function getTestRunWithFallback(runId: string): Promise<TestRun | undefined> {
  const fromMap = testRuns.get(runId);
  if (fromMap) return fromMap;
  return await dbGetTestRun(runId) as TestRun | undefined;
}

// Type definitions
interface TestRunParams {
  runId: string;
}

interface CancelRunBody {
  force?: boolean;
  save_partial_results?: boolean;
  reason?: string;
}

interface PrioritizeRunBody {
  priority: number;
}

interface QueueStatusQuery {
  include_completed?: string;
  limit?: number;
}

// Helper function for emitting events (will be passed from parent)
type EmitRunEventFn = (runId: string, orgId: string, event: string, data: any) => void;

// Store reference to emitRunEvent function
let emitRunEvent: EmitRunEventFn = () => {};

/**
 * Set the emitRunEvent function (called from test-runs.ts)
 */
export function setRunControlEmitter(emitter: EmitRunEventFn) {
  emitRunEvent = emitter;
}

/**
 * Register run control routes
 */
export async function runControlRoutes(app: FastifyInstance) {
  // Cancel a running test (enhanced with options)
  // Feature #885: Enhanced cancel-run with force option and partial results control
  app.post<{ Params: TestRunParams; Body: CancelRunBody }>('/api/v1/runs/:runId/cancel', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);
    const { force = false, save_partial_results = true, reason } = request.body || {};
    const cancelStartTime = Date.now();

    const run = testRuns.get(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    // Can only cancel running or cancelling tests
    if (run.status !== 'running' && run.status !== 'cancelling') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Cannot cancel test run with status "${run.status}". Only running or cancelling tests can be cancelled.`,
        current_status: run.status,
      });
    }

    // If force mode and already cancelling, force to cancelled immediately
    if (run.status === 'cancelling' && force) {
      console.log(`[CANCEL] Force cancelling already-cancelling run ${runId}`);
    } else if (run.status === 'cancelling') {
      // Already cancelling, return current state
      return {
        run: {
          id: run.id,
          status: run.status,
          message: 'Run is already being cancelled',
        },
        already_cancelling: true,
      };
    }

    // First transition to 'cancelling' status (if not already)
    if (run.status !== 'cancelling') {
      run.status = 'cancelling';
      testRuns.set(runId, run);
      console.log(`[CANCEL] Test run ${runId} status changed to 'cancelling' (force=${force}, reason=${reason || 'none'})`);
    }

    // Emit cancelling event
    emitRunEvent(runId, orgId, 'run-cancelling', {
      run_id: runId,
      status: 'cancelling',
      message: reason || 'Test run is being cancelled',
      force,
    });

    // Mark for cancellation in the running state
    const runState = runningBrowsers.get(runId);
    if (runState) {
      runState.cancelled = true;
      console.log(`[CANCEL] Test run ${runId} marked for cancellation`);

      // Close browser to force stop execution
      try {
        await runState.browser.close();
      } catch {
        // Browser may already be closed
      }
    }

    // Wait a short time for the test loop to notice the cancellation and update status
    // Skip waiting if force mode is enabled
    if (!force) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // If the test loop hasn't finalized yet, finalize it here
    const updatedRun = testRuns.get(runId);
    if (updatedRun && (updatedRun.status === 'cancelling' || force)) {
      updatedRun.status = 'cancelled';
      updatedRun.completed_at = new Date();
      updatedRun.duration_ms = updatedRun.completed_at.getTime() - (updatedRun.started_at?.getTime() || updatedRun.created_at.getTime());

      // Feature #885: Optionally clear partial results if save_partial_results is false
      const partialResultsCount = updatedRun.results?.length || 0;
      if (!save_partial_results && updatedRun.results) {
        console.log(`[CANCEL] Clearing ${partialResultsCount} partial results for run ${runId}`);
        updatedRun.results = [];
      }

      testRuns.set(runId, updatedRun);

      // Persist cancelled status to database
      dbUpdateTestRun(runId, {
        status: 'cancelled',
        completed_at: updatedRun.completed_at,
        duration_ms: updatedRun.duration_ms,
        results: updatedRun.results,
      }).catch(err =>
        console.error('[Cancel] Failed to persist cancelled run to database:', err)
      );

      console.log(`[CANCEL] Test run ${runId} status changed to 'cancelled' (saved ${save_partial_results ? partialResultsCount : 0} partial results)`);

      // Emit cancellation complete event
      emitRunEvent(runId, orgId, 'run-complete', {
        status: 'cancelled',
        duration_ms: updatedRun.duration_ms,
        completed_at: updatedRun.completed_at.toISOString(),
        message: reason || 'Test run cancelled by user',
        partial_results: save_partial_results ? partialResultsCount : 0,
        force,
        reason,
      });
    }

    // Return the final state
    const finalRun = testRuns.get(runId)!;
    const cancelDuration = Date.now() - cancelStartTime;

    return {
      run: {
        id: finalRun.id,
        status: finalRun.status,
        completed_at: finalRun.completed_at?.toISOString(),
        duration_ms: finalRun.duration_ms,
        partial_results_count: finalRun.results?.length || 0,
        partial_results_saved: save_partial_results,
      },
      message: 'Test run cancelled successfully',
      cancel_options: {
        force,
        save_partial_results,
        reason: reason || null,
      },
      cancel_duration_ms: cancelDuration,
    };
  });

  // Feature #886: Pause a running test
  app.post<{ Params: TestRunParams }>('/api/v1/runs/:runId/pause', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);

    const run = testRuns.get(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    // Can only pause running tests
    if (run.status !== 'running') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Cannot pause test run with status "${run.status}". Only running tests can be paused.`,
        current_status: run.status,
      });
    }

    // Mark the run as paused
    run.status = 'paused';
    testRuns.set(runId, run);
    console.log(`[PAUSE] Test run ${runId} paused`);

    // Mark the browser state as paused
    const runState = runningBrowsers.get(runId);
    if (runState) {
      runState.paused = true;
    }

    // Emit pause event
    emitRunEvent(runId, orgId, 'run-paused', {
      run_id: runId,
      status: 'paused',
      message: 'Test run has been paused',
      paused_at: new Date().toISOString(),
    });

    return {
      run: {
        id: run.id,
        status: run.status,
        paused_at: new Date().toISOString(),
      },
      message: 'Test run paused successfully',
      can_resume: true,
    };
  });

  // Feature #886: Resume a paused test
  app.post<{ Params: TestRunParams }>('/api/v1/runs/:runId/resume', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);

    const run = testRuns.get(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    // Can only resume paused tests
    if (run.status !== 'paused') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Cannot resume test run with status "${run.status}". Only paused tests can be resumed.`,
        current_status: run.status,
      });
    }

    // Mark the run as running again
    run.status = 'running';
    testRuns.set(runId, run);
    console.log(`[RESUME] Test run ${runId} resumed`);

    // Mark the browser state as not paused
    const runState = runningBrowsers.get(runId);
    if (runState) {
      runState.paused = false;
    }

    // Emit resume event
    emitRunEvent(runId, orgId, 'run-resumed', {
      run_id: runId,
      status: 'running',
      message: 'Test run has been resumed',
      resumed_at: new Date().toISOString(),
    });

    return {
      run: {
        id: run.id,
        status: run.status,
        resumed_at: new Date().toISOString(),
      },
      message: 'Test run resumed successfully',
    };
  });

  // Get queue status
  app.get<{ Querystring: QueueStatusQuery }>('/api/v1/runs/queue-status', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { include_completed = 'false', limit = 100 } = request.query;
    const orgId = getOrganizationId(request);
    const includeCompleted = include_completed === 'true';

    // Get all runs for this organization
    const orgRuns = Array.from(testRuns.values())
      .filter(r => r.organization_id === orgId);

    // Get pending runs (sorted by priority then created_at)
    const pendingRuns = orgRuns
      .filter(r => r.status === 'pending')
      .sort((a, b) => {
        const priorityA = a.priority ?? 100;
        const priorityB = b.priority ?? 100;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return a.created_at.getTime() - b.created_at.getTime();
      })
      .slice(0, limit)
      .map((r, idx) => ({
        id: r.id,
        suite_id: r.suite_id,
        test_id: r.test_id,
        status: r.status,
        priority: r.priority ?? 100,
        queue_position: idx + 1,
        created_at: r.created_at.toISOString(),
      }));

    // Get running runs
    const runningRuns = orgRuns
      .filter(r => r.status === 'running')
      .map(r => ({
        id: r.id,
        suite_id: r.suite_id,
        test_id: r.test_id,
        status: r.status,
        started_at: r.started_at?.toISOString(),
        results_count: r.results?.length || 0,
      }));

    // Get paused runs
    const pausedRuns = orgRuns
      .filter(r => r.status === 'paused')
      .map(r => ({
        id: r.id,
        suite_id: r.suite_id,
        test_id: r.test_id,
        status: r.status,
        started_at: r.started_at?.toISOString(),
      }));

    // Optionally include completed runs
    let completedRuns: any[] = [];
    if (includeCompleted) {
      completedRuns = orgRuns
        .filter(r => ['passed', 'failed', 'cancelled'].includes(r.status))
        .sort((a, b) => (b.completed_at?.getTime() || 0) - (a.completed_at?.getTime() || 0))
        .slice(0, limit)
        .map(r => ({
          id: r.id,
          suite_id: r.suite_id,
          test_id: r.test_id,
          status: r.status,
          completed_at: r.completed_at?.toISOString(),
          duration_ms: r.duration_ms,
        }));
    }

    return {
      queue: {
        pending: pendingRuns,
        pending_count: pendingRuns.length,
        running: runningRuns,
        running_count: runningRuns.length,
        paused: pausedRuns,
        paused_count: pausedRuns.length,
        ...(includeCompleted && {
          completed: completedRuns,
          completed_count: completedRuns.length,
        }),
      },
      summary: {
        total_pending: orgRuns.filter(r => r.status === 'pending').length,
        total_running: orgRuns.filter(r => r.status === 'running').length,
        total_paused: orgRuns.filter(r => r.status === 'paused').length,
        total_completed: orgRuns.filter(r => ['passed', 'failed', 'cancelled'].includes(r.status)).length,
      },
    };
  });

  // Prioritize a pending run
  app.post<{ Params: TestRunParams; Body: PrioritizeRunBody }>('/api/v1/runs/:runId/prioritize', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const { priority } = request.body;
    const orgId = getOrganizationId(request);

    const run = testRuns.get(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    // Can only prioritize pending runs
    if (run.status !== 'pending') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Cannot prioritize test run with status "${run.status}". Only pending tests can be prioritized.`,
        current_status: run.status,
      });
    }

    // Validate priority (1-1000, lower is higher priority)
    if (priority < 1 || priority > 1000) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Priority must be between 1 and 1000 (1 = highest priority)',
      });
    }

    const oldPriority = run.priority ?? 100;
    run.priority = priority;
    testRuns.set(runId, run);

    console.log(`[PRIORITY] Test run ${runId} priority changed from ${oldPriority} to ${priority}`);

    // Get new queue position
    const pendingRuns = Array.from(testRuns.entries())
      .filter(([_, r]) => r.organization_id === orgId && r.status === 'pending')
      .sort((a, b) => {
        const priorityA = a[1].priority ?? 100;
        const priorityB = b[1].priority ?? 100;
        if (priorityA !== priorityB) return priorityA - priorityB;
        return a[1].created_at.getTime() - b[1].created_at.getTime();
      });

    const queuePosition = pendingRuns.findIndex(([id]) => id === runId) + 1;

    return {
      run_id: runId,
      old_priority: oldPriority,
      new_priority: priority,
      queue_position: queuePosition,
      total_pending: pendingRuns.length,
      message: priority < oldPriority ? 'Run moved up in queue' : 'Run moved down in queue',
    };
  });

  // Get run priority status
  app.get<{ Params: TestRunParams }>('/api/v1/runs/:runId/priority', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);

    const run = testRuns.get(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    // Get queue position if pending
    let queuePosition: number | null = null;
    let totalPending = 0;

    if (run.status === 'pending') {
      const pendingRuns = Array.from(testRuns.entries())
        .filter(([_, r]) => r.organization_id === orgId && r.status === 'pending')
        .sort((a, b) => {
          const priorityA = a[1].priority ?? 100;
          const priorityB = b[1].priority ?? 100;
          if (priorityA !== priorityB) return priorityA - priorityB;
          return a[1].created_at.getTime() - b[1].created_at.getTime();
        });

      queuePosition = pendingRuns.findIndex(([id]) => id === runId) + 1;
      totalPending = pendingRuns.length;
    }

    return {
      run_id: runId,
      status: run.status,
      priority: run.priority ?? 100,
      queue_position: queuePosition,
      total_pending: totalPending,
      is_prioritized: (run.priority ?? 100) < 100,
    };
  });
}
