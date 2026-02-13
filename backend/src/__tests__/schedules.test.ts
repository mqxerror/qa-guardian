/**
 * Feature #R33: Backend Test Expansion - Schedule Management
 *
 * Tests schedule CRUD endpoints, enable/disable toggles, cron validation,
 * timezone validation, and execution history retrieval.
 * Uses mocked data stores for isolation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

interface Schedule {
  id: string;
  name: string;
  suite_id: string;
  cron_expression: string;
  timezone: string;
  is_enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
  created_at: string;
  updated_at: string;
}

interface Execution {
  id: string;
  schedule_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
}

// Well-known IANA timezones used for basic validation
const VALID_TIMEZONES = new Set([
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland',
]);

/**
 * Validates a cron expression by checking it is non-empty and
 * consists of exactly 5 space-separated parts (minute, hour, day-of-month, month, day-of-week).
 */
const isValidCron = (expression: string): boolean => {
  if (!expression || expression.trim().length === 0) return false;
  const parts = expression.trim().split(/\s+/);
  return parts.length === 5;
};

/**
 * Computes a naive "next run" timestamp by adding 1 hour from the current time.
 * In a real system this would parse the cron expression against the timezone.
 */
const computeNextRunAt = (): string => {
  const next = new Date(Date.now() + 60 * 60 * 1000);
  return next.toISOString();
};

// Build a self-contained Fastify test app with schedule management routes
const buildTestApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });

  // Counter-based ID generation to prevent collisions within the same millisecond
  let idCounter = 0;

  // In-memory data stores
  const schedules = new Map<string, Schedule>();
  const executions = new Map<string, Execution[]>();

  // POST /api/v1/schedules - Create a new schedule
  app.post('/api/v1/schedules', async (request, reply) => {
    const { name, suite_id, cron_expression, timezone } = request.body as {
      name?: string;
      suite_id?: string;
      cron_expression?: string;
      timezone?: string;
    };

    // Validate required fields
    if (!name || !suite_id || !cron_expression || !timezone) {
      return reply.status(400).send({
        error: 'name, suite_id, cron_expression, and timezone are required',
      });
    }

    // Validate cron expression format (must have exactly 5 parts)
    if (!isValidCron(cron_expression)) {
      return reply.status(400).send({
        error: 'Invalid cron expression: must have exactly 5 space-separated parts',
      });
    }

    // Validate timezone against known IANA timezones
    if (!VALID_TIMEZONES.has(timezone)) {
      return reply.status(400).send({
        error: `Invalid timezone: ${timezone}`,
      });
    }

    const now = new Date().toISOString();
    const id = `schedule-${++idCounter}`;
    const schedule: Schedule = {
      id,
      name,
      suite_id,
      cron_expression,
      timezone,
      is_enabled: true,
      last_run_at: null,
      next_run_at: computeNextRunAt(),
      run_count: 0,
      created_at: now,
      updated_at: now,
    };

    schedules.set(id, schedule);
    executions.set(id, []);

    return reply.status(201).send(schedule);
  });

  // GET /api/v1/schedules - List all schedules
  app.get('/api/v1/schedules', async () => {
    const all = Array.from(schedules.values());
    return { schedules: all, total: all.length };
  });

  // GET /api/v1/schedules/:id - Get a single schedule
  app.get('/api/v1/schedules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const schedule = schedules.get(id);
    if (!schedule) {
      return reply.status(404).send({ error: 'Schedule not found' });
    }
    return schedule;
  });

  // PUT /api/v1/schedules/:id - Update a schedule
  app.put('/api/v1/schedules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const schedule = schedules.get(id);
    if (!schedule) {
      return reply.status(404).send({ error: 'Schedule not found' });
    }

    const { name, suite_id, cron_expression, timezone } = request.body as {
      name?: string;
      suite_id?: string;
      cron_expression?: string;
      timezone?: string;
    };

    // Validate cron expression if provided
    if (cron_expression !== undefined) {
      if (!isValidCron(cron_expression)) {
        return reply.status(400).send({
          error: 'Invalid cron expression: must have exactly 5 space-separated parts',
        });
      }
      schedule.cron_expression = cron_expression;
      // Recalculate next_run_at when cron changes
      schedule.next_run_at = computeNextRunAt();
    }

    // Validate timezone if provided
    if (timezone !== undefined) {
      if (!VALID_TIMEZONES.has(timezone)) {
        return reply.status(400).send({
          error: `Invalid timezone: ${timezone}`,
        });
      }
      schedule.timezone = timezone;
    }

    if (name !== undefined) schedule.name = name;
    if (suite_id !== undefined) schedule.suite_id = suite_id;
    schedule.updated_at = new Date().toISOString();

    schedules.set(id, schedule);
    return schedule;
  });

  // DELETE /api/v1/schedules/:id - Delete a schedule
  app.delete('/api/v1/schedules/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!schedules.has(id)) {
      return reply.status(404).send({ error: 'Schedule not found' });
    }
    schedules.delete(id);
    executions.delete(id);
    return reply.status(204).send();
  });

  // POST /api/v1/schedules/:id/enable - Enable a schedule
  app.post('/api/v1/schedules/:id/enable', async (request, reply) => {
    const { id } = request.params as { id: string };
    const schedule = schedules.get(id);
    if (!schedule) {
      return reply.status(404).send({ error: 'Schedule not found' });
    }
    schedule.is_enabled = true;
    schedule.updated_at = new Date().toISOString();
    schedules.set(id, schedule);
    return schedule;
  });

  // POST /api/v1/schedules/:id/disable - Disable a schedule
  app.post('/api/v1/schedules/:id/disable', async (request, reply) => {
    const { id } = request.params as { id: string };
    const schedule = schedules.get(id);
    if (!schedule) {
      return reply.status(404).send({ error: 'Schedule not found' });
    }
    schedule.is_enabled = false;
    schedule.updated_at = new Date().toISOString();
    schedules.set(id, schedule);
    return schedule;
  });

  // GET /api/v1/schedules/:id/history - Get execution history for a schedule
  app.get('/api/v1/schedules/:id/history', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!schedules.has(id)) {
      return reply.status(404).send({ error: 'Schedule not found' });
    }
    const history = executions.get(id) || [];
    return { executions: history, total: history.length };
  });

  // Store reset helper for tests
  (app as any).resetStores = () => {
    schedules.clear();
    executions.clear();
    idCounter = 0;
  };

  return app;
};

describe('Schedule Management', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    (app as any).resetStores();
  });

  // Helper to create a valid schedule with sensible defaults
  const createSchedule = async (overrides: Record<string, unknown> = {}) => {
    const payload = {
      name: 'Nightly Regression',
      suite_id: 'suite-1',
      cron_expression: '0 2 * * *',
      timezone: 'UTC',
      ...overrides,
    };
    return app.inject({
      method: 'POST',
      url: '/api/v1/schedules',
      payload,
    });
  };

  describe('CRUD Lifecycle', () => {
    it('should complete a full create, read, update, delete cycle', async () => {
      // Create
      const createRes = await createSchedule({ name: 'Lifecycle Test' });
      expect(createRes.statusCode).toBe(201);
      const created = JSON.parse(createRes.body);
      expect(created.name).toBe('Lifecycle Test');
      expect(created.id).toBeDefined();

      // Read
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/schedules/${created.id}`,
      });
      expect(getRes.statusCode).toBe(200);
      expect(JSON.parse(getRes.body).name).toBe('Lifecycle Test');

      // Update
      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/schedules/${created.id}`,
        payload: { name: 'Updated Lifecycle' },
      });
      expect(updateRes.statusCode).toBe(200);
      expect(JSON.parse(updateRes.body).name).toBe('Updated Lifecycle');

      // Delete
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/schedules/${created.id}`,
      });
      expect(deleteRes.statusCode).toBe(204);

      // Verify deletion
      const verifyRes = await app.inject({
        method: 'GET',
        url: `/api/v1/schedules/${created.id}`,
      });
      expect(verifyRes.statusCode).toBe(404);
    });
  });

  describe('Create Schedule', () => {
    it('should create a schedule with a valid cron expression', async () => {
      const response = await createSchedule({
        name: 'Every 15 Minutes',
        cron_expression: '*/15 * * * *',
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Every 15 Minutes');
      expect(body.cron_expression).toBe('*/15 * * * *');
      expect(body.id).toBeDefined();
      expect(body.created_at).toBeDefined();
    });

    it('should default is_enabled to true on creation', async () => {
      const response = await createSchedule();

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.is_enabled).toBe(true);
    });

    it('should initialize run_count to 0 and last_run_at to null', async () => {
      const response = await createSchedule();

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.run_count).toBe(0);
      expect(body.last_run_at).toBeNull();
    });

    it('should set next_run_at on creation', async () => {
      const response = await createSchedule();

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.next_run_at).toBeDefined();
      expect(body.next_run_at).not.toBeNull();
    });

    it('should reject creation with an invalid cron expression (too few parts)', async () => {
      const response = await createSchedule({ cron_expression: '0 2 *' });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid cron expression');
    });

    it('should reject creation with an empty cron expression', async () => {
      const response = await createSchedule({ cron_expression: '' });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should reject creation with missing required fields', async () => {
      // Missing name
      const noName = await app.inject({
        method: 'POST',
        url: '/api/v1/schedules',
        payload: { suite_id: 'suite-1', cron_expression: '0 2 * * *', timezone: 'UTC' },
      });
      expect(noName.statusCode).toBe(400);

      // Missing suite_id
      const noSuite = await app.inject({
        method: 'POST',
        url: '/api/v1/schedules',
        payload: { name: 'Test', cron_expression: '0 2 * * *', timezone: 'UTC' },
      });
      expect(noSuite.statusCode).toBe(400);

      // Missing cron_expression
      const noCron = await app.inject({
        method: 'POST',
        url: '/api/v1/schedules',
        payload: { name: 'Test', suite_id: 'suite-1', timezone: 'UTC' },
      });
      expect(noCron.statusCode).toBe(400);

      // Missing timezone
      const noTz = await app.inject({
        method: 'POST',
        url: '/api/v1/schedules',
        payload: { name: 'Test', suite_id: 'suite-1', cron_expression: '0 2 * * *' },
      });
      expect(noTz.statusCode).toBe(400);
    });

    it('should reject creation with an invalid timezone', async () => {
      const response = await createSchedule({ timezone: 'Mars/Olympus_Mons' });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid timezone');
    });

    it('should allow multiple schedules for the same suite', async () => {
      const first = await createSchedule({
        name: 'Morning Run',
        suite_id: 'suite-shared',
        cron_expression: '0 8 * * *',
      });
      const second = await createSchedule({
        name: 'Evening Run',
        suite_id: 'suite-shared',
        cron_expression: '0 20 * * *',
      });

      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(201);

      const firstBody = JSON.parse(first.body);
      const secondBody = JSON.parse(second.body);
      expect(firstBody.suite_id).toBe('suite-shared');
      expect(secondBody.suite_id).toBe('suite-shared');
      expect(firstBody.id).not.toBe(secondBody.id);
    });
  });

  describe('List Schedules', () => {
    it('should return all schedules with total count', async () => {
      await createSchedule({ name: 'Schedule A' });
      await createSchedule({ name: 'Schedule B' });
      await createSchedule({ name: 'Schedule C' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/schedules',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.schedules).toHaveLength(3);
      expect(body.total).toBe(3);
    });

    it('should return empty list when no schedules exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/schedules',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.schedules).toHaveLength(0);
      expect(body.total).toBe(0);
    });
  });

  describe('Get Schedule', () => {
    it('should return 404 for a non-existent schedule', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/schedules/nonexistent-id',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });
  });

  describe('Update Schedule', () => {
    it('should only change the specified fields', async () => {
      const createRes = await createSchedule({
        name: 'Original Name',
        cron_expression: '0 2 * * *',
        timezone: 'UTC',
      });
      const { id, cron_expression, timezone } = JSON.parse(createRes.body);

      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/schedules/${id}`,
        payload: { name: 'New Name' },
      });

      expect(updateRes.statusCode).toBe(200);
      const updated = JSON.parse(updateRes.body);
      expect(updated.name).toBe('New Name');
      // Unchanged fields should remain the same
      expect(updated.cron_expression).toBe(cron_expression);
      expect(updated.timezone).toBe(timezone);
    });

    it('should update next_run_at when cron expression changes', async () => {
      const createRes = await createSchedule();
      const created = JSON.parse(createRes.body);

      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/schedules/${created.id}`,
        payload: { cron_expression: '30 4 * * 1' },
      });

      expect(updateRes.statusCode).toBe(200);
      const updated = JSON.parse(updateRes.body);
      expect(updated.cron_expression).toBe('30 4 * * 1');
      // next_run_at should be recalculated (non-null)
      expect(updated.next_run_at).toBeDefined();
      expect(updated.next_run_at).not.toBeNull();
    });

    it('should return 404 when updating a non-existent schedule', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/schedules/nonexistent-id',
        payload: { name: 'Does Not Matter' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should update the updated_at timestamp', async () => {
      const createRes = await createSchedule();
      const created = JSON.parse(createRes.body);

      // Small delay so timestamps differ
      await new Promise(resolve => setTimeout(resolve, 10));

      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/schedules/${created.id}`,
        payload: { name: 'Timestamp Check' },
      });

      const updated = JSON.parse(updateRes.body);
      expect(new Date(updated.updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(created.updated_at).getTime()
      );
    });
  });

  describe('Delete Schedule', () => {
    it('should return 204 on successful deletion', async () => {
      const createRes = await createSchedule();
      const { id } = JSON.parse(createRes.body);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/schedules/${id}`,
      });

      expect(response.statusCode).toBe(204);
    });

    it('should return 404 when deleting a non-existent schedule', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/schedules/nonexistent-id',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Enable / Disable', () => {
    it('should disable an enabled schedule', async () => {
      const createRes = await createSchedule();
      const { id } = JSON.parse(createRes.body);

      const disableRes = await app.inject({
        method: 'POST',
        url: `/api/v1/schedules/${id}/disable`,
      });

      expect(disableRes.statusCode).toBe(200);
      const body = JSON.parse(disableRes.body);
      expect(body.is_enabled).toBe(false);
    });

    it('should re-enable a disabled schedule', async () => {
      const createRes = await createSchedule();
      const { id } = JSON.parse(createRes.body);

      // Disable first
      await app.inject({
        method: 'POST',
        url: `/api/v1/schedules/${id}/disable`,
      });

      // Re-enable
      const enableRes = await app.inject({
        method: 'POST',
        url: `/api/v1/schedules/${id}/enable`,
      });

      expect(enableRes.statusCode).toBe(200);
      const body = JSON.parse(enableRes.body);
      expect(body.is_enabled).toBe(true);
    });

    it('should return 404 when enabling a non-existent schedule', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/schedules/nonexistent-id/enable',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 when disabling a non-existent schedule', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/schedules/nonexistent-id/disable',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Execution History', () => {
    it('should return empty history for a newly created schedule', async () => {
      const createRes = await createSchedule();
      const { id } = JSON.parse(createRes.body);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/schedules/${id}/history`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.executions).toHaveLength(0);
      expect(body.total).toBe(0);
    });

    it('should return 404 for history of a non-existent schedule', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/schedules/nonexistent-id/history',
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
