import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload, getOrganizationId } from '../middleware/auth.js';
import { getTestSuite } from './test-suites.js';
import { listTestRunsBySchedule, createTestRun } from '../services/repositories/test-runs.js';
import type { TestRun, BrowserType as TestRunBrowserType } from './test-runs/execution.js';
import { sendScheduleTriggeredWebhook } from './test-runs/webhook-events.js';
// Feature #145: Cache invalidation for schedule mutations
import { getCache } from '../services/cache.js';
import { CacheKeys } from '../services/cache-keys.js';
// Feature #484: Pino structured logging
import { createLogger } from '../services/logger.js';
import { sendError } from '../utils/errors.js';
// Feature #872: Full cron expression support via cron-parser utility
import { getNextRunTime } from '../utils/cron-parser.js';
// Feature #716: Zod validation middleware and schemas
import {
  validateBody,
  validateParams,
  scheduleIdParamsSchema,
  createScheduleBodySchema,
  updateScheduleBodySchema,
} from '../validation/index.js';

const log = createLogger('schedules');

// Feature #2117: Import only async repository functions (no getMemory* calls)
import {
  Schedule,
  createSchedule as createScheduleRepo,
  getSchedule as getScheduleRepo,
  updateSchedule as updateScheduleRepo,
  deleteSchedule as deleteScheduleRepo,
  listSchedules as listSchedulesRepo,
} from '../services/repositories/schedules.js';

// Feature #872: Full cron expression support using utils/cron-parser.ts
// Replaces the previous simplified parser that only handled basic patterns.
// Now supports: ranges (1-5), lists (1,3,5), steps (*/5), complex day-of-week/month combinations.
function calculateNextRun(cronExpression: string, _timezone: string): Date | undefined {
  const next = getNextRunTime(cronExpression);
  return next ?? undefined;
}

// Feature #2117: Map removed — all access now through async repository functions

interface CreateScheduleBody {
  suite_id: string;
  name: string;
  description?: string;
  cron_expression?: string;
  run_at?: string; // ISO date string
  timezone?: string;
  enabled?: boolean;
  browsers?: ('chromium' | 'firefox' | 'webkit')[];
  notify_on_failure?: boolean;
}

interface ScheduleParams {
  id: string;
}

export async function scheduleRoutes(app: FastifyInstance) {
  // List all schedules for organization
  app.get('/api/v1/schedules', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const scheduleList = await listSchedulesRepo(orgId);
    return { schedules: scheduleList };
  });

  // Get single schedule
  // Feature #716: Zod validation for schedule ID param
  app.get<{ Params: ScheduleParams }>('/api/v1/schedules/:id', {
    preHandler: [authenticate],
    preValidation: [validateParams(scheduleIdParamsSchema)],
  }, async (request, reply) => {
    const { id } = request.params;
    const orgId = getOrganizationId(request);

    const schedule = await getScheduleRepo(id);
    if (!schedule || schedule.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Schedule not found');
    }

    return { schedule };
  });

  // Create schedule
  // Feature #716: Zod validation for schedule creation body
  app.post<{ Body: CreateScheduleBody }>('/api/v1/schedules', {
    preHandler: [authenticate],
    preValidation: [validateBody(createScheduleBodySchema)],
  }, async (request, reply) => {
    const {
      suite_id,
      name,
      description,
      cron_expression,
      run_at,
      timezone = 'UTC',
      enabled = true,
      browsers = ['chromium'],
      notify_on_failure = true
    } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot create schedules
    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot create schedules');
    }

    if (!name) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Schedule name is required');
    }

    if (!suite_id) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Test suite ID is required');
    }

    // Verify suite exists and belongs to organization
    const suite = await getTestSuite(suite_id);
    if (!suite || suite.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test suite not found');
    }

    // Must have either cron_expression or run_at
    if (!cron_expression && !run_at) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Either cron_expression (recurring) or run_at (one-time) is required');
    }

    const id = crypto.randomUUID();

    // Calculate next run time
    let next_run_at: Date | undefined;
    if (enabled && cron_expression) {
      next_run_at = calculateNextRun(cron_expression, timezone);
    } else if (enabled && run_at) {
      const runAtDate = new Date(run_at);
      if (runAtDate > new Date()) {
        next_run_at = runAtDate;
      }
    }

    const schedule: Schedule = {
      id,
      organization_id: orgId,
      suite_id,
      name,
      description,
      cron_expression,
      run_at: run_at ? new Date(run_at) : undefined,
      timezone,
      enabled,
      browsers,
      notify_on_failure,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: user.id,
      next_run_at,
      run_count: 0,
    };

    await createScheduleRepo(schedule);

    // Feature #145: Invalidate schedule list cache after creation
    await getCache().delete(CacheKeys.schedules.list(orgId));

    return reply.status(201).send({ schedule });
  });

  // Update schedule
  // Feature #716: Zod validation for schedule update params and body
  app.patch<{ Params: ScheduleParams; Body: Partial<CreateScheduleBody> }>('/api/v1/schedules/:id', {
    preHandler: [authenticate],
    preValidation: [validateParams(scheduleIdParamsSchema), validateBody(updateScheduleBodySchema)],
  }, async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot update schedules
    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot update schedules');
    }

    const schedule = await getScheduleRepo(id);
    if (!schedule || schedule.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Schedule not found');
    }

    // Build the updates object for the repository
    const repoUpdates: Partial<Schedule> = {};
    if (updates.name) repoUpdates.name = updates.name;
    if (updates.description !== undefined) repoUpdates.description = updates.description;
    if (updates.cron_expression !== undefined) repoUpdates.cron_expression = updates.cron_expression;
    if (updates.run_at !== undefined) repoUpdates.run_at = updates.run_at ? new Date(updates.run_at) : undefined;
    if (updates.timezone) repoUpdates.timezone = updates.timezone;
    if (updates.enabled !== undefined) repoUpdates.enabled = updates.enabled;
    if (updates.browsers) repoUpdates.browsers = updates.browsers;
    if (updates.notify_on_failure !== undefined) repoUpdates.notify_on_failure = updates.notify_on_failure;

    // Recalculate next_run_at based on enabled status
    const newEnabled = updates.enabled !== undefined ? updates.enabled : schedule.enabled;
    const newCronExpression = updates.cron_expression !== undefined ? updates.cron_expression : schedule.cron_expression;
    const newRunAt = updates.run_at !== undefined ? (updates.run_at ? new Date(updates.run_at) : undefined) : schedule.run_at;
    const newTimezone = updates.timezone || schedule.timezone;

    if (newEnabled) {
      if (newCronExpression) {
        repoUpdates.next_run_at = calculateNextRun(newCronExpression, newTimezone);
      } else if (newRunAt && newRunAt > new Date()) {
        repoUpdates.next_run_at = newRunAt;
      }
    } else {
      // Clear next_run_at when disabled
      repoUpdates.next_run_at = undefined;
    }

    const updatedSchedule = await updateScheduleRepo(id, repoUpdates);

    // Feature #145: Invalidate schedule caches after update
    await Promise.all([
      getCache().delete(CacheKeys.schedules.detail(id)),
      getCache().delete(CacheKeys.schedules.list(orgId)),
    ]);

    return { schedule: updatedSchedule };
  });

  // Delete schedule
  // Feature #716: Zod validation for schedule delete params
  app.delete<{ Params: ScheduleParams }>('/api/v1/schedules/:id', {
    preHandler: [authenticate],
    preValidation: [validateParams(scheduleIdParamsSchema)],
  }, async (request, reply) => {
    const { id } = request.params;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Only admin or owner can delete schedules
    if (user.role !== 'admin' && user.role !== 'owner' && user.role !== 'developer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Only administrators and developers can delete schedules');
    }

    const schedule = await getScheduleRepo(id);
    if (!schedule || schedule.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Schedule not found');
    }

    await deleteScheduleRepo(id);

    // Feature #145: Invalidate schedule caches after deletion
    await Promise.all([
      getCache().delete(CacheKeys.schedules.detail(id)),
      getCache().delete(CacheKeys.schedules.list(orgId)),
    ]);

    return { message: 'Schedule deleted successfully' };
  });

  // Get schedule run history
  // Feature #716: Zod validation for schedule ID param
  app.get<{ Params: ScheduleParams }>('/api/v1/schedules/:id/runs', {
    preHandler: [authenticate],
    preValidation: [validateParams(scheduleIdParamsSchema)],
  }, async (request, reply) => {
    const { id } = request.params;
    const orgId = getOrganizationId(request);

    const schedule = await getScheduleRepo(id);
    if (!schedule || schedule.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Schedule not found');
    }

    // Feature #141: Query directly by schedule_id instead of loading all org runs
    const scheduleRuns = await listTestRunsBySchedule(id, orgId, 100);
    const runs = scheduleRuns.map(r => ({
      id: r.id,
      suite_id: r.suite_id,
      status: r.status,
      browser: r.browser,
      started_at: r.started_at?.toISOString(),
      completed_at: r.completed_at?.toISOString(),
      duration_ms: r.duration_ms,
      created_at: r.created_at.toISOString(),
      passed: r.results?.filter(res => res.status === 'passed').length || 0,
      failed: r.results?.filter(res => res.status === 'failed' || res.status === 'error').length || 0,
      total: r.results?.length || 0,
    }));

    return { runs, schedule_name: schedule.name, total: runs.length };
  });

  // Manually trigger a schedule run (simulates what the scheduler would do)
  // Feature #716: Zod validation for schedule trigger params
  app.post<{ Params: ScheduleParams }>('/api/v1/schedules/:id/trigger', {
    preHandler: [authenticate],
    preValidation: [validateParams(scheduleIdParamsSchema)],
  }, async (request, reply) => {
    const { id } = request.params;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot trigger schedules
    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot trigger schedules');
    }

    const schedule = await getScheduleRepo(id);
    if (!schedule || schedule.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Schedule not found');
    }

    // Create a test run with schedule_id
    const runId = crypto.randomUUID();
    const run: TestRun = {
      id: runId,
      suite_id: schedule.suite_id,
      organization_id: orgId,
      browser: (schedule.browsers[0] || 'chromium') as TestRunBrowserType,
      branch: 'main',
      status: 'pending',
      created_at: new Date(),
      schedule_id: id, // Link to schedule
      triggered_by: 'schedule',
    };

    await createTestRun(run);

    // Update schedule metadata via repository
    await updateScheduleRepo(id, {
      last_run_id: runId,
      run_count: (schedule.run_count || 0) + 1,
    });

    // Feature #169: Route execution through the queue (worker container handles actual execution)
    const { enqueueOrExecute } = await import('../services/execution-queue.js');
    enqueueOrExecute(runId, 'e2e', { triggeredBy: 'schedule' }).catch(err => {
      log.error({ err, runId, scheduleId: id, code: 'SCHEDULE_ENQUEUE_FAILED' }, 'Failed to enqueue test run');
    });

    // Feature #1312: Emit schedule.triggered webhook
    const suite = await getTestSuite(schedule.suite_id);
    if (suite) {
      // Determine trigger type
      const triggerType = schedule.cron_expression ? 'cron' : (schedule.run_at ? 'one_time' : 'manual');

      // Calculate next run time for recurring schedules
      let nextRunAt: string | undefined;
      if (schedule.cron_expression && schedule.next_run_at) {
        nextRunAt = schedule.next_run_at.toISOString();
      }

      // Send the webhook asynchronously (don't block the response)
      sendScheduleTriggeredWebhook(orgId, {
        schedule_id: id,
        schedule_name: schedule.name,
        suite_id: schedule.suite_id,
        suite_name: suite.name,
        project_id: suite.project_id,
        run_id: runId,
        trigger_type: triggerType,
        cron_expression: schedule.cron_expression,
        next_run_at: nextRunAt,
        run_count: schedule.run_count,
        triggered_by: user.email,
      }).catch((err) => {
        log.error({ err, scheduleId: id, runId, code: 'SCHEDULE_WEBHOOK_FAILED' }, 'Failed to emit schedule.triggered webhook');
      });
    }

    return reply.status(201).send({
      run: {
        id: runId,
        suite_id: schedule.suite_id,
        schedule_id: id,
        status: 'pending',
        created_at: run.created_at.toISOString(),
      },
      message: 'Schedule triggered successfully',
    });
  });
}
