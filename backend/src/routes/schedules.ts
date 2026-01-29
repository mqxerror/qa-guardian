import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload, getOrganizationId } from '../middleware/auth';
import { getTestSuite } from './test-suites';
import { listTestRunsByOrg, createTestRun } from '../services/repositories/test-runs';
import { sendScheduleTriggeredWebhook } from './test-runs/webhook-events';

// Feature #2117: Import only async repository functions (no getMemory* calls)
import {
  Schedule,
  createSchedule as createScheduleRepo,
  getSchedule as getScheduleRepo,
  updateSchedule as updateScheduleRepo,
  deleteSchedule as deleteScheduleRepo,
  listSchedules as listSchedulesRepo,
} from '../services/repositories/schedules';

// Calculate next run time from cron expression (simplified implementation)
function calculateNextRun(cronExpression: string, timezone: string): Date | undefined {
  // Simple cron parsing for common patterns
  // Format: minute hour day-of-month month day-of-week
  const parts = cronExpression.split(' ');
  if (parts.length !== 5) return undefined;

  const [minute, hour, , , dayOfWeek] = parts;
  const now = new Date();
  const next = new Date(now);

  // Set the time
  if (minute !== '*') {
    next.setMinutes(parseInt(minute, 10));
    next.setSeconds(0);
    next.setMilliseconds(0);
  }

  if (hour !== '*') {
    next.setHours(parseInt(hour, 10));
    // If we've already passed this time today, move to tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
  }

  // Handle weekly schedules (day-of-week: 0=Sunday, 1=Monday, etc.)
  if (dayOfWeek !== '*') {
    const targetDay = parseInt(dayOfWeek, 10);
    const currentDay = next.getDay();
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd < 0 || (daysToAdd === 0 && next <= now)) {
      daysToAdd += 7;
    }
    next.setDate(next.getDate() + daysToAdd);
  }

  return next;
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
  app.get<{ Params: ScheduleParams }>('/api/v1/schedules/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const orgId = getOrganizationId(request);

    const schedule = await getScheduleRepo(id);
    if (!schedule || schedule.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Schedule not found',
      });
    }

    return { schedule };
  });

  // Create schedule
  app.post<{ Body: CreateScheduleBody }>('/api/v1/schedules', {
    preHandler: [authenticate],
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
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Viewers cannot create schedules',
      });
    }

    if (!name) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Schedule name is required',
      });
    }

    if (!suite_id) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Test suite ID is required',
      });
    }

    // Verify suite exists and belongs to organization
    const suite = await getTestSuite(suite_id);
    if (!suite || suite.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test suite not found',
      });
    }

    // Must have either cron_expression or run_at
    if (!cron_expression && !run_at) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Either cron_expression (recurring) or run_at (one-time) is required',
      });
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

    return reply.status(201).send({ schedule });
  });

  // Update schedule
  app.patch<{ Params: ScheduleParams; Body: Partial<CreateScheduleBody> }>('/api/v1/schedules/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot update schedules
    if (user.role === 'viewer') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Viewers cannot update schedules',
      });
    }

    const schedule = await getScheduleRepo(id);
    if (!schedule || schedule.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Schedule not found',
      });
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

    return { schedule: updatedSchedule };
  });

  // Delete schedule
  app.delete<{ Params: ScheduleParams }>('/api/v1/schedules/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Only admin or owner can delete schedules
    if (user.role !== 'admin' && user.role !== 'owner' && user.role !== 'developer') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only administrators and developers can delete schedules',
      });
    }

    const schedule = await getScheduleRepo(id);
    if (!schedule || schedule.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Schedule not found',
      });
    }

    await deleteScheduleRepo(id);

    return { message: 'Schedule deleted successfully' };
  });

  // Get schedule run history
  app.get<{ Params: ScheduleParams }>('/api/v1/schedules/:id/runs', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const orgId = getOrganizationId(request);

    const schedule = await getScheduleRepo(id);
    if (!schedule || schedule.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Schedule not found',
      });
    }

    // Find all runs that were triggered by this schedule (Feature #2117: async DB call)
    const allRuns = await listTestRunsByOrg(orgId);
    const runs = allRuns
      .filter(r => (r as any).schedule_id === id)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .map(r => ({
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
  app.post<{ Params: ScheduleParams }>('/api/v1/schedules/:id/trigger', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot trigger schedules
    if (user.role === 'viewer') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Viewers cannot trigger schedules',
      });
    }

    const schedule = await getScheduleRepo(id);
    if (!schedule || schedule.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Schedule not found',
      });
    }

    // Create a test run with schedule_id
    const runId = crypto.randomUUID();
    const run = {
      id: runId,
      suite_id: schedule.suite_id,
      organization_id: orgId,
      browser: schedule.browsers[0] || 'chromium' as const,
      status: 'pending' as const,
      created_at: new Date(),
      schedule_id: id, // Link to schedule
    };

    await createTestRun(run as any);

    // Update schedule metadata via repository
    await updateScheduleRepo(id, {
      last_run_id: runId,
      run_count: (schedule.run_count || 0) + 1,
    });

    // Import and start the test execution
    const { runTestsForRun } = await import('./test-runs.js');
    if (typeof runTestsForRun === 'function') {
      runTestsForRun(runId).catch(console.error);
    }

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
        console.error('[WEBHOOK] Failed to emit schedule.triggered webhook:', err);
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
