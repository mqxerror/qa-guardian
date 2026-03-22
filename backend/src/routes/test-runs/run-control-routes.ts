/**
 * Run Control Routes Module (Feature #1356 - Code Quality)
 * Extracted from test-runs.ts to reduce file size
 * Contains: Cancel, pause, resume, queue status, prioritization
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../middleware/auth.js';
import { testRuns, setTestRun } from './execution.js';
// Feature #Agent8: Use TestExecutionService for cancel, pause, resume, queue status
import { testExecutionService } from '../../services/test-execution-service.js';
import { createLogger } from '../../services/logger.js';

import { sendError } from '../../utils/errors.js';
// Feature #732: Zod validation for run control routes
import {
  validateBody,
  validateParams,
  runIdParamSchema,
  cancelRunBodySchema,
  prioritizeRunBodySchema,
} from '../../validation/index.js';
const logger = createLogger('route:test-runs:run-control');

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
type EmitRunEventFn = (runId: string, orgId: string, event: string, data: Record<string, unknown>) => void;

/**
 * Set the emitRunEvent function (called from test-runs.ts)
 * Feature #Agent8: Delegates to TestExecutionService emitter
 */
export function setRunControlEmitter(emitter: EmitRunEventFn) {
  testExecutionService.setEmitter(emitter);
}

/**
 * Register run control routes
 */
export async function runControlRoutes(app: FastifyInstance) {
  // Cancel a running test (enhanced with options)
  // Feature #885: Enhanced cancel-run with force option and partial results control
  // Feature #732: Zod validation for cancel run
  // Feature #Agent8: Cancellation logic delegated to TestExecutionService
  app.post<{ Params: TestRunParams; Body: CancelRunBody }>('/api/v1/runs/:runId/cancel', {
    preHandler: [authenticate],
    preValidation: [validateParams(runIdParamSchema), validateBody(cancelRunBodySchema)],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);
    const { force = false, save_partial_results = true, reason } = request.body || {};

    // Validate run exists and is in a cancellable state
    const run = testRuns.get(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    if (run.status !== 'running' && run.status !== 'cancelling') {
      return sendError(reply, 400, 'BAD_REQUEST', `Cannot cancel test run with status "${run.status}". Only running or cancelling tests can be cancelled.`, { current_status: run.status });
    }

    const result = await testExecutionService.cancelRun(runId, orgId, {
      force,
      savePartialResults: save_partial_results,
      reason,
    });

    if (!result) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    return result;
  });

  // Feature #886: Pause a running test
  // Feature #732: Zod validation for pause run params
  // Feature #Agent8: Pause logic delegated to TestExecutionService
  app.post<{ Params: TestRunParams }>('/api/v1/runs/:runId/pause', {
    preHandler: [authenticate],
    preValidation: [validateParams(runIdParamSchema)],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);

    const result = testExecutionService.pauseRun(runId, orgId);
    if (!result.success) {
      // Distinguish between "not found" and "wrong status"
      if (result.error === 'Test run not found') {
        return sendError(reply, 404, 'NOT_FOUND', result.error);
      }
      return sendError(reply, 400, 'BAD_REQUEST', result.error!, { current_status: testRuns.get(runId)?.status });
    }

    return {
      run: {
        id: runId,
        status: 'paused',
        paused_at: new Date().toISOString(),
      },
      message: 'Test run paused successfully',
      can_resume: true,
    };
  });

  // Feature #886: Resume a paused test
  // Feature #732: Zod validation for resume run params
  // Feature #Agent8: Resume logic delegated to TestExecutionService
  app.post<{ Params: TestRunParams }>('/api/v1/runs/:runId/resume', {
    preHandler: [authenticate],
    preValidation: [validateParams(runIdParamSchema)],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);

    const result = testExecutionService.resumeRun(runId, orgId);
    if (!result.success) {
      if (result.error === 'Test run not found') {
        return sendError(reply, 404, 'NOT_FOUND', result.error);
      }
      return sendError(reply, 400, 'BAD_REQUEST', result.error!, { current_status: testRuns.get(runId)?.status });
    }

    return {
      run: {
        id: runId,
        status: 'running',
        resumed_at: new Date().toISOString(),
      },
      message: 'Test run resumed successfully',
    };
  });

  // Get queue status
  // Feature #Agent8: Queue status computation delegated to TestExecutionService
  app.get<{ Querystring: QueueStatusQuery }>('/api/v1/runs/queue-status', {
    preHandler: [authenticate],
  }, async (request) => {
    const { include_completed = 'false', limit = 100 } = request.query;
    const orgId = getOrganizationId(request);

    return testExecutionService.getQueueStatus(orgId, {
      includeCompleted: include_completed === 'true',
      limit,
    });
  });

  // Prioritize a pending run
  // Feature #732: Zod validation for prioritize run
  app.post<{ Params: TestRunParams; Body: PrioritizeRunBody }>('/api/v1/runs/:runId/prioritize', {
    preHandler: [authenticate],
    preValidation: [validateParams(runIdParamSchema), validateBody(prioritizeRunBodySchema)],
  }, async (request, reply) => {
    const { runId } = request.params;
    const { priority } = request.body;
    const orgId = getOrganizationId(request);

    const run = testRuns.get(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    // Can only prioritize pending runs
    if (run.status !== 'pending') {
      return sendError(reply, 400, 'BAD_REQUEST', `Cannot prioritize test run with status "${run.status}". Only pending tests can be prioritized.`, { current_status: run.status });
    }

    // Validate priority (1-1000, lower is higher priority)
    if (priority < 1 || priority > 1000) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Priority must be between 1 and 1000 (1 = highest priority)');
    }

    const oldPriority = run.priority ?? 100;
    run.priority = priority;
    setTestRun(runId, run);

    logger.info(`[PRIORITY] Test run ${runId} priority changed from ${oldPriority} to ${priority}`);

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
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
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
