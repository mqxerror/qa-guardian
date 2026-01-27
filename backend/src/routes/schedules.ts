import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload, getOrganizationId } from '../middleware/auth';
import { testSuites } from './test-suites';
import { testRuns, sendScheduleTriggeredWebhook } from './test-runs';

// In-memory schedule store for development
interface Schedule {
  id: string;
  organization_id: string;
  suite_id: string;
  name: string;
  description?: string;
  cron_expression?: string; // For recurring schedules
  run_at?: Date; // For one-time schedules
  timezone: string;
  enabled: boolean;
  browsers: ('chromium' | 'firefox' | 'webkit')[];
  notify_on_failure: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  next_run_at?: Date; // Calculated next run time
  last_run_id?: string; // ID of the most recent run triggered by this schedule
  run_count: number; // Total number of times this schedule has run
}

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

// In-memory stores
export const schedules: Map<string, Schedule> = new Map();

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
    const scheduleList = Array.from(schedules.values())
      .filter(s => s.organization_id === orgId);
    return { schedules: scheduleList };
  });

  // Get single schedule
  app.get<{ Params: ScheduleParams }>('/api/v1/schedules/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const orgId = getOrganizationId(request);

    const schedule = schedules.get(id);
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
    const suite = testSuites.get(suite_id);
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

    const id = String(Date.now());

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

    schedules.set(id, schedule);

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

    const schedule = schedules.get(id);
    if (!schedule || schedule.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Schedule not found',
      });
    }

    if (updates.name) schedule.name = updates.name;
    if (updates.description !== undefined) schedule.description = updates.description;
    if (updates.cron_expression !== undefined) schedule.cron_expression = updates.cron_expression;
    if (updates.run_at !== undefined) schedule.run_at = updates.run_at ? new Date(updates.run_at) : undefined;
    if (updates.timezone) schedule.timezone = updates.timezone;
    if (updates.enabled !== undefined) schedule.enabled = updates.enabled;
    if (updates.browsers) schedule.browsers = updates.browsers;
    if (updates.notify_on_failure !== undefined) schedule.notify_on_failure = updates.notify_on_failure;
    schedule.updated_at = new Date();

    // Recalculate next_run_at based on enabled status
    if (schedule.enabled) {
      if (schedule.cron_expression) {
        schedule.next_run_at = calculateNextRun(schedule.cron_expression, schedule.timezone);
      } else if (schedule.run_at && schedule.run_at > new Date()) {
        schedule.next_run_at = schedule.run_at;
      }
    } else {
      // Clear next_run_at when disabled
      schedule.next_run_at = undefined;
    }

    schedules.set(id, schedule);

    return { schedule };
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

    const schedule = schedules.get(id);
    if (!schedule || schedule.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Schedule not found',
      });
    }

    schedules.delete(id);

    return { message: 'Schedule deleted successfully' };
  });

  // Get schedule run history
  app.get<{ Params: ScheduleParams }>('/api/v1/schedules/:id/runs', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const orgId = getOrganizationId(request);

    const schedule = schedules.get(id);
    if (!schedule || schedule.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Schedule not found',
      });
    }

    // Find all runs that were triggered by this schedule
    const runs = Array.from(testRuns.values())
      .filter(r => (r as any).schedule_id === id && r.organization_id === orgId)
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

    const schedule = schedules.get(id);
    if (!schedule || schedule.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Schedule not found',
      });
    }

    // Create a test run with schedule_id
    const runId = String(Date.now());
    const run = {
      id: runId,
      suite_id: schedule.suite_id,
      organization_id: orgId,
      browser: schedule.browsers[0] || 'chromium' as const,
      status: 'pending' as const,
      created_at: new Date(),
      schedule_id: id, // Link to schedule
    };

    testRuns.set(runId, run as any);

    // Update schedule metadata
    schedule.last_run_id = runId;
    schedule.run_count = (schedule.run_count || 0) + 1;
    schedule.updated_at = new Date();
    schedules.set(id, schedule);

    // Import and start the test execution
    const { runTestsForRun } = await import('./test-runs');
    if (typeof runTestsForRun === 'function') {
      runTestsForRun(runId).catch(console.error);
    }

    // Feature #1312: Emit schedule.triggered webhook
    const suite = testSuites.get(schedule.suite_id);
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
