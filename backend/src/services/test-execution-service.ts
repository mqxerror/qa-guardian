/**
 * Test Execution Service
 *
 * Feature #Agent8: Service layer extraction for test execution business logic.
 *
 * Extracts run creation, status retrieval, and cancellation orchestration
 * from route handlers into a clean service interface. Route handlers become thin:
 * validate request -> call service -> return response.
 *
 * This service owns:
 * - Run creation orchestration (create in memory + DB + cache invalidation + queue)
 * - Run status retrieval (DB-first lookup with in-memory fallback)
 * - Run cancellation orchestration (state transitions, browser cleanup, event emission)
 * - Run pause/resume orchestration
 * - Queue status computation
 *
 * Note: The actual test execution loop (browser launch, step execution, retry logic)
 * remains in run-orchestrator.ts which is already a well-structured module.
 */

import {
  TestRun,
  BrowserType,
  TestType,
  testRuns,
  runningBrowsers,
  setTestRun,
  createTestRun as dbCreateTestRun,
} from '../routes/test-runs/execution.js';
import {
  getTestRun as dbGetTestRun,
  updateTestRun as dbUpdateTestRun,
} from './repositories/test-runs.js';
import { getTestSuite, getTest } from '../routes/test-suites.js';
import { getCache, CacheKeys } from './cache.js';
import { enqueueOrExecute } from './execution-queue.js';
import { createLogger } from './logger.js';

const logger = createLogger('test-execution-service');

// ============================================================================
// Types
// ============================================================================

export interface CreateRunOptions {
  suiteId: string;
  orgId: string;
  browser?: BrowserType;
  branch?: string;
  testId?: string;
  testIds?: string[];
  triggeredBy?: string;
  triggerType?: 'manual' | 'schedule' | 'api' | 'github';
  userId?: string;
  prNumber?: number;
  envVars?: Record<string, string>;
  priority?: number;
}

export interface CreateRunResult {
  run: TestRun;
  queued: boolean;
  queuePosition?: number;
  error?: string;
}

export interface RunStatusResult {
  found: boolean;
  run?: TestRun;
}

export interface CancelRunOptions {
  force?: boolean;
  savePartialResults?: boolean;
  reason?: string;
}

export interface CancelRunResult {
  success: boolean;
  run: {
    id: string;
    status: string;
    completed_at?: string;
    duration_ms?: number;
    partial_results_count: number;
    partial_results_saved: boolean;
  };
  already_cancelling?: boolean;
  message: string;
  cancel_options: {
    force: boolean;
    save_partial_results: boolean;
    reason: string | null;
  };
  cancel_duration_ms: number;
}

export interface QueueStatusResult {
  queue: {
    pending: Array<Record<string, unknown>>;
    pending_count: number;
    running: Array<Record<string, unknown>>;
    running_count: number;
    paused: Array<Record<string, unknown>>;
    paused_count: number;
    completed?: Array<Record<string, unknown>>;
    completed_count?: number;
  };
  summary: {
    total_pending: number;
    total_running: number;
    total_paused: number;
    total_completed: number;
  };
}

// Event emitter function type (injected by the routes layer)
type EmitRunEventFn = (runId: string, orgId: string, event: string, data: Record<string, unknown>) => void;

// ============================================================================
// Service Implementation
// ============================================================================

export class TestExecutionService {
  private emitRunEvent: EmitRunEventFn;

  constructor(emitRunEvent?: EmitRunEventFn) {
    // Default to a no-op emitter; routes layer injects the real one
    this.emitRunEvent = emitRunEvent || (() => {});
  }

  /**
   * Set the event emitter function.
   * Called from the routes layer after Socket.IO / Redis is initialized.
   */
  setEmitter(emitter: EmitRunEventFn): void {
    this.emitRunEvent = emitter;
  }

  /**
   * Create a new test run, persist it, invalidate caches, and enqueue for execution.
   *
   * Validates that the suite exists and has tests, then:
   * 1. Creates the run in memory
   * 2. Persists to database (so the worker can find it)
   * 3. Invalidates relevant caches
   * 4. Enqueues for execution (or executes directly if queue is unavailable)
   */
  async createRun(options: CreateRunOptions): Promise<CreateRunResult> {
    const {
      suiteId,
      orgId,
      browser: requestBrowser,
      branch: requestBranch,
      testId,
      testIds,
      triggeredBy,
      triggerType,
      userId,
      prNumber,
      envVars,
      priority,
    } = options;

    // Determine browser and branch
    const suite = await getTestSuite(suiteId);
    const browserToUse: BrowserType = requestBrowser || suite?.browser || 'chromium';
    const branchToUse: string = requestBranch || 'main';

    // Determine test type for queue prioritization
    let testType: TestType = 'e2e';
    if (testId) {
      const test = await getTest(testId);
      if (test?.test_type) {
        testType = test.test_type as TestType;
      }
    }

    const id = crypto.randomUUID();
    const run: TestRun = {
      id,
      suite_id: suiteId,
      organization_id: orgId,
      browser: browserToUse,
      branch: branchToUse,
      status: 'pending',
      created_at: new Date(),
      test_id: testId,
      test_ids: testIds,
      triggered_by: triggerType,
      user_id: userId,
      pr_number: prNumber,
      run_env_vars: envVars,
      priority,
    };

    // 1. Store in memory
    setTestRun(id, run);

    // 2. Persist to database BEFORE enqueuing (worker needs the run in DB)
    await dbCreateTestRun(run);

    // 3. Invalidate caches
    const cache = getCache();
    await cache.delete(CacheKeys.runs.bySuite(suiteId));
    if (testId) {
      await cache.delete(CacheKeys.runs.byTest(testId));
    }
    if (testIds) {
      for (const tid of testIds) {
        await cache.delete(CacheKeys.runs.byTest(tid));
      }
    }

    // 4. Enqueue for execution
    const queueResult = await enqueueOrExecute(id, testType, {
      triggeredBy,
    });

    // Handle queue failure
    if (queueResult.error) {
      run.status = 'error';
      setTestRun(id, run);
      return {
        run,
        queued: false,
        error: 'Runner offline / queue unavailable. Please try again later.',
      };
    }

    // Update status if queued
    if (queueResult.queued) {
      run.status = 'pending';
      setTestRun(id, run);
      logger.info({ runId: id, position: queueResult.position }, 'Run queued');
    }

    return {
      run,
      queued: queueResult.queued,
      queuePosition: queueResult.position,
    };
  }

  /**
   * Get a test run by ID.
   * Checks the database first (worker may have updated it), falls back to
   * the in-memory map for in-flight runs.
   */
  async getRunStatus(runId: string): Promise<RunStatusResult> {
    const fromDb = await dbGetTestRun(runId) as TestRun | undefined;
    if (fromDb) return { found: true, run: fromDb };

    const fromMemory = testRuns.get(runId);
    if (fromMemory) return { found: true, run: fromMemory };

    return { found: false };
  }

  /**
   * Cancel a running test.
   *
   * Transitions the run through cancelling -> cancelled states,
   * closes the browser, emits events, and persists the final state.
   */
  async cancelRun(
    runId: string,
    orgId: string,
    options: CancelRunOptions = {}
  ): Promise<CancelRunResult | null> {
    const { force = false, savePartialResults = true, reason } = options;
    const cancelStartTime = Date.now();

    const run = testRuns.get(runId);
    if (!run || run.organization_id !== orgId) {
      return null;
    }

    // If already cancelling and not forcing, return early
    if (run.status === 'cancelling' && !force) {
      return {
        success: true,
        run: {
          id: run.id,
          status: run.status,
          partial_results_count: run.results?.length || 0,
          partial_results_saved: true,
        },
        already_cancelling: true,
        message: 'Run is already being cancelled',
        cancel_options: { force, save_partial_results: savePartialResults, reason: reason || null },
        cancel_duration_ms: Date.now() - cancelStartTime,
      };
    }

    // Transition to 'cancelling'
    if (run.status !== 'cancelling') {
      run.status = 'cancelling';
      setTestRun(runId, run);
      logger.info({ runId, force, reason }, 'Test run status changed to cancelling');
    }

    // Emit cancelling event
    this.emitRunEvent(runId, orgId, 'run-cancelling', {
      run_id: runId,
      status: 'cancelling',
      message: reason || 'Test run is being cancelled',
      force,
    });

    // Mark browser for cancellation and close it
    const runState = runningBrowsers.get(runId);
    if (runState) {
      runState.cancelled = true;
      try {
        await runState.browser.close();
      } catch {
        // Browser may already be closed
      }
    }

    // Brief wait for the test loop to notice (skip if force)
    if (!force) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Finalize cancellation
    const updatedRun = testRuns.get(runId);
    if (updatedRun && (updatedRun.status === 'cancelling' || force)) {
      updatedRun.status = 'cancelled';
      updatedRun.completed_at = new Date();
      updatedRun.duration_ms = updatedRun.completed_at.getTime() -
        (updatedRun.started_at?.getTime() || updatedRun.created_at.getTime());

      const partialResultsCount = updatedRun.results?.length || 0;
      if (!savePartialResults && updatedRun.results) {
        updatedRun.results = [];
      }

      setTestRun(runId, updatedRun);

      // Persist to database (fire-and-forget with error logging)
      dbUpdateTestRun(runId, {
        status: 'cancelled',
        completed_at: updatedRun.completed_at,
        duration_ms: updatedRun.duration_ms,
        results: updatedRun.results,
      }).catch(err => logger.error({ err, runId }, 'Failed to persist cancelled run to database'));

      // Emit completion event
      this.emitRunEvent(runId, orgId, 'run-complete', {
        status: 'cancelled',
        duration_ms: updatedRun.duration_ms,
        completed_at: updatedRun.completed_at.toISOString(),
        message: reason || 'Test run cancelled by user',
        partial_results: savePartialResults ? partialResultsCount : 0,
        force,
        reason,
      });
    }

    const finalRun = testRuns.get(runId)!;
    return {
      success: true,
      run: {
        id: finalRun.id,
        status: finalRun.status,
        completed_at: finalRun.completed_at?.toISOString(),
        duration_ms: finalRun.duration_ms,
        partial_results_count: finalRun.results?.length || 0,
        partial_results_saved: savePartialResults,
      },
      message: 'Test run cancelled successfully',
      cancel_options: { force, save_partial_results: savePartialResults, reason: reason || null },
      cancel_duration_ms: Date.now() - cancelStartTime,
    };
  }

  /**
   * Pause a running test.
   * Marks the run and browser state as paused, emits pause event.
   */
  pauseRun(runId: string, orgId: string): { success: boolean; error?: string } {
    const run = testRuns.get(runId);
    if (!run || run.organization_id !== orgId) {
      return { success: false, error: 'Test run not found' };
    }

    if (run.status !== 'running') {
      return {
        success: false,
        error: `Cannot pause test run with status "${run.status}". Only running tests can be paused.`,
      };
    }

    run.status = 'paused';
    setTestRun(runId, run);

    const runState = runningBrowsers.get(runId);
    if (runState) runState.paused = true;

    this.emitRunEvent(runId, orgId, 'run-paused', {
      run_id: runId,
      status: 'paused',
      message: 'Test run has been paused',
      paused_at: new Date().toISOString(),
    });

    logger.info({ runId }, 'Test run paused');
    return { success: true };
  }

  /**
   * Resume a paused test.
   * Marks the run and browser state as running, emits resume event.
   */
  resumeRun(runId: string, orgId: string): { success: boolean; error?: string } {
    const run = testRuns.get(runId);
    if (!run || run.organization_id !== orgId) {
      return { success: false, error: 'Test run not found' };
    }

    if (run.status !== 'paused') {
      return {
        success: false,
        error: `Cannot resume test run with status "${run.status}". Only paused tests can be resumed.`,
      };
    }

    run.status = 'running';
    setTestRun(runId, run);

    const runState = runningBrowsers.get(runId);
    if (runState) runState.paused = false;

    this.emitRunEvent(runId, orgId, 'run-resumed', {
      run_id: runId,
      status: 'running',
      message: 'Test run has been resumed',
      resumed_at: new Date().toISOString(),
    });

    logger.info({ runId }, 'Test run resumed');
    return { success: true };
  }

  /**
   * Get queue status for an organization.
   * Returns pending, running, paused, and optionally completed runs.
   */
  getQueueStatus(
    orgId: string,
    options: { includeCompleted?: boolean; limit?: number } = {}
  ): QueueStatusResult {
    const { includeCompleted = false, limit = 100 } = options;

    const orgRuns = Array.from(testRuns.values())
      .filter(r => r.organization_id === orgId);

    // Pending runs sorted by priority then created_at
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

    const pausedRuns = orgRuns
      .filter(r => r.status === 'paused')
      .map(r => ({
        id: r.id,
        suite_id: r.suite_id,
        test_id: r.test_id,
        status: r.status,
        started_at: r.started_at?.toISOString(),
      }));

    const result: QueueStatusResult = {
      queue: {
        pending: pendingRuns,
        pending_count: pendingRuns.length,
        running: runningRuns,
        running_count: runningRuns.length,
        paused: pausedRuns,
        paused_count: pausedRuns.length,
      },
      summary: {
        total_pending: orgRuns.filter(r => r.status === 'pending').length,
        total_running: orgRuns.filter(r => r.status === 'running').length,
        total_paused: orgRuns.filter(r => r.status === 'paused').length,
        total_completed: orgRuns.filter(r => ['passed', 'failed', 'cancelled'].includes(r.status)).length,
      },
    };

    if (includeCompleted) {
      const completedRuns = orgRuns
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

      result.queue.completed = completedRuns;
      result.queue.completed_count = completedRuns.length;
    }

    return result;
  }
}

// Export a singleton instance for convenience
export const testExecutionService = new TestExecutionService();
