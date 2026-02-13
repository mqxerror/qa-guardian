/**
 * Feature #R33: Backend Test Expansion - Test Run Lifecycle
 *
 * Tests for test run CRUD and lifecycle operations including
 * state transitions (pending -> running -> passed/failed/cancelled).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TestRun {
  id: string;
  suite_id: string;
  environment: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  created_at: string;
}

interface TestResult {
  id: string;
  run_id: string;
  test_name: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Mock app builder
// ---------------------------------------------------------------------------

function buildTestApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  const runs = new Map<string, TestRun>();
  const results = new Map<string, TestResult[]>();
  let idCounter = 0;

  // POST /api/v1/test-runs - Create a test run
  app.post('/api/v1/test-runs', async (request, reply) => {
    const body = request.body as Record<string, unknown> | undefined;

    if (!body || !body.suite_id || !body.environment) {
      return reply.status(400).send({
        error: 'Missing required fields: suite_id, environment',
      });
    }

    idCounter += 1;
    const id = `run-${idCounter}`;
    const now = new Date().toISOString();

    const run: TestRun = {
      id,
      suite_id: body.suite_id as string,
      environment: body.environment as string,
      status: 'pending',
      started_at: null,
      completed_at: null,
      duration_ms: null,
      total_tests: 0,
      passed_tests: 0,
      failed_tests: 0,
      created_at: now,
    };

    runs.set(id, run);
    results.set(id, []);

    return reply.status(201).send(run);
  });

  // GET /api/v1/test-runs - List test runs with optional filters
  app.get('/api/v1/test-runs', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    let items = Array.from(runs.values());

    if (query.status) {
      items = items.filter((r) => r.status === query.status);
    }
    if (query.suite_id) {
      items = items.filter((r) => r.suite_id === query.suite_id);
    }

    return reply.send({ runs: items, total: items.length });
  });

  // GET /api/v1/test-runs/:id - Get a single test run
  app.get('/api/v1/test-runs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = runs.get(id);

    if (!run) {
      return reply.status(404).send({ error: 'Test run not found' });
    }

    return reply.send(run);
  });

  // POST /api/v1/test-runs/:id/start - Start a run
  app.post('/api/v1/test-runs/:id/start', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = runs.get(id);

    if (!run) {
      return reply.status(404).send({ error: 'Test run not found' });
    }

    if (run.status !== 'pending') {
      return reply.status(409).send({
        error: `Cannot start run with status '${run.status}'. Must be 'pending'.`,
      });
    }

    run.status = 'running';
    run.started_at = new Date().toISOString();

    return reply.send(run);
  });

  // POST /api/v1/test-runs/:id/complete - Complete a run
  app.post('/api/v1/test-runs/:id/complete', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = runs.get(id);

    if (!run) {
      return reply.status(404).send({ error: 'Test run not found' });
    }

    if (run.status !== 'running') {
      return reply.status(409).send({
        error: `Cannot complete run with status '${run.status}'. Must be 'running'.`,
      });
    }

    const body = request.body as Record<string, unknown> | undefined;
    const passed = body?.passed === true;

    run.status = passed ? 'passed' : 'failed';
    run.completed_at = new Date().toISOString();

    // Calculate duration from started_at to completed_at
    if (run.started_at) {
      run.duration_ms =
        new Date(run.completed_at).getTime() -
        new Date(run.started_at).getTime();
    }

    // Allow optional test count overrides from the request body
    if (typeof body?.total_tests === 'number') {
      run.total_tests = body.total_tests as number;
    }
    if (typeof body?.passed_tests === 'number') {
      run.passed_tests = body.passed_tests as number;
    }
    if (typeof body?.failed_tests === 'number') {
      run.failed_tests = body.failed_tests as number;
    }

    return reply.send(run);
  });

  // POST /api/v1/test-runs/:id/cancel - Cancel a run
  app.post('/api/v1/test-runs/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = runs.get(id);

    if (!run) {
      return reply.status(404).send({ error: 'Test run not found' });
    }

    if (run.status !== 'pending' && run.status !== 'running') {
      return reply.status(409).send({
        error: `Cannot cancel run with status '${run.status}'. Must be 'pending' or 'running'.`,
      });
    }

    run.status = 'cancelled';

    return reply.send(run);
  });

  // DELETE /api/v1/test-runs/:id - Delete a test run
  app.delete('/api/v1/test-runs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!runs.has(id)) {
      return reply.status(404).send({ error: 'Test run not found' });
    }

    runs.delete(id);
    results.delete(id);

    return reply.status(204).send();
  });

  // GET /api/v1/test-runs/:id/results - Get test results for a run
  app.get('/api/v1/test-runs/:id/results', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = runs.get(id);

    if (!run) {
      return reply.status(404).send({ error: 'Test run not found' });
    }

    const runResults = results.get(id) ?? [];

    return reply.send({ results: runResults });
  });

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Feature #R33: Backend Test Expansion - Test Run Lifecycle', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // Helper to create a test run and return the parsed response body
  async function createRun(
    overrides: Record<string, unknown> = {},
  ): Promise<TestRun> {
    const payload = {
      suite_id: 'suite-1',
      environment: 'staging',
      ...overrides,
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/test-runs',
      payload,
    });

    return JSON.parse(res.payload) as TestRun;
  }

  // -----------------------------------------------------------------------
  // 1. Full lifecycle: create -> start -> complete (passed)
  // -----------------------------------------------------------------------
  describe('full lifecycle - passed', () => {
    it('should transition through create -> start -> complete (passed)', async () => {
      // Create
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/test-runs',
        payload: { suite_id: 'suite-lifecycle', environment: 'production' },
      });
      expect(createRes.statusCode).toBe(201);
      const created = JSON.parse(createRes.payload) as TestRun;
      expect(created.status).toBe('pending');
      expect(created.suite_id).toBe('suite-lifecycle');
      expect(created.environment).toBe('production');

      // Start
      const startRes = await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${created.id}/start`,
      });
      expect(startRes.statusCode).toBe(200);
      const started = JSON.parse(startRes.payload) as TestRun;
      expect(started.status).toBe('running');
      expect(started.started_at).not.toBeNull();

      // Complete as passed
      const completeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${created.id}/complete`,
        payload: { passed: true, total_tests: 10, passed_tests: 10, failed_tests: 0 },
      });
      expect(completeRes.statusCode).toBe(200);
      const completed = JSON.parse(completeRes.payload) as TestRun;
      expect(completed.status).toBe('passed');
      expect(completed.completed_at).not.toBeNull();
      expect(completed.duration_ms).toBeTypeOf('number');
      expect(completed.total_tests).toBe(10);
      expect(completed.passed_tests).toBe(10);
      expect(completed.failed_tests).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // 2. Full lifecycle: create -> start -> complete (failed)
  // -----------------------------------------------------------------------
  describe('full lifecycle - failed', () => {
    it('should transition through create -> start -> complete (failed)', async () => {
      const run = await createRun({ suite_id: 'suite-fail' });
      expect(run.status).toBe('pending');

      // Start
      await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/start`,
      });

      // Complete as failed
      const completeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/complete`,
        payload: { passed: false, total_tests: 8, passed_tests: 5, failed_tests: 3 },
      });
      expect(completeRes.statusCode).toBe(200);
      const completed = JSON.parse(completeRes.payload) as TestRun;
      expect(completed.status).toBe('failed');
      expect(completed.failed_tests).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // 3. Create -> cancel flow
  // -----------------------------------------------------------------------
  describe('cancel flow', () => {
    it('should cancel a pending run', async () => {
      const run = await createRun();

      const cancelRes = await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/cancel`,
      });
      expect(cancelRes.statusCode).toBe(200);
      const cancelled = JSON.parse(cancelRes.payload) as TestRun;
      expect(cancelled.status).toBe('cancelled');
    });

    it('should cancel a running run', async () => {
      const run = await createRun();

      await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/start`,
      });

      const cancelRes = await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/cancel`,
      });
      expect(cancelRes.statusCode).toBe(200);
      const cancelled = JSON.parse(cancelRes.payload) as TestRun;
      expect(cancelled.status).toBe('cancelled');
    });
  });

  // -----------------------------------------------------------------------
  // 4. Cannot start already running test
  // -----------------------------------------------------------------------
  describe('state transition guards - start', () => {
    it('should return 409 when starting an already running run', async () => {
      const run = await createRun();

      // Start the first time - should succeed
      await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/start`,
      });

      // Attempt to start again - should conflict
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/start`,
      });
      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.payload);
      expect(body.error).toContain('running');
    });

    it('should return 409 when starting a completed run', async () => {
      const run = await createRun();

      await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/start`,
      });
      await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/complete`,
        payload: { passed: true },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/start`,
      });
      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.payload);
      expect(body.error).toContain('passed');
    });
  });

  // -----------------------------------------------------------------------
  // 5. Cannot complete a pending test (must be running first)
  // -----------------------------------------------------------------------
  describe('state transition guards - complete', () => {
    it('should return 409 when completing a pending run', async () => {
      const run = await createRun();

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/complete`,
        payload: { passed: true },
      });
      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.payload);
      expect(body.error).toContain('pending');
    });

    it('should return 409 when completing a cancelled run', async () => {
      const run = await createRun();

      await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/cancel`,
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/complete`,
        payload: { passed: true },
      });
      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.payload);
      expect(body.error).toContain('cancelled');
    });
  });

  // -----------------------------------------------------------------------
  // 6. Cannot cancel completed test
  // -----------------------------------------------------------------------
  describe('state transition guards - cancel', () => {
    it('should return 409 when cancelling a completed run', async () => {
      const run = await createRun();

      await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/start`,
      });
      await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/complete`,
        payload: { passed: true },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/cancel`,
      });
      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.payload);
      expect(body.error).toContain('passed');
    });

    it('should return 409 when cancelling an already cancelled run', async () => {
      const run = await createRun();

      await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/cancel`,
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/cancel`,
      });
      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.payload);
      expect(body.error).toContain('cancelled');
    });
  });

  // -----------------------------------------------------------------------
  // 7. List runs with status filter
  // -----------------------------------------------------------------------
  describe('listing with status filter', () => {
    it('should return only runs matching the requested status', async () => {
      // Create two runs; cancel one, leave the other pending
      const pendingRun = await createRun({ suite_id: 'filter-status' });
      const cancelledRun = await createRun({ suite_id: 'filter-status' });

      await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${cancelledRun.id}/cancel`,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/test-runs?status=cancelled',
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);

      // All returned runs should have status 'cancelled'
      for (const run of body.runs) {
        expect(run.status).toBe('cancelled');
      }

      // The pending run should not appear in cancelled results
      const ids = body.runs.map((r: TestRun) => r.id);
      expect(ids).not.toContain(pendingRun.id);
      expect(ids).toContain(cancelledRun.id);
    });
  });

  // -----------------------------------------------------------------------
  // 8. List runs with suite_id filter
  // -----------------------------------------------------------------------
  describe('listing with suite_id filter', () => {
    it('should return only runs matching the requested suite_id', async () => {
      const runA = await createRun({ suite_id: 'suite-alpha' });
      await createRun({ suite_id: 'suite-beta' });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/test-runs?suite_id=suite-alpha',
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);

      for (const run of body.runs) {
        expect(run.suite_id).toBe('suite-alpha');
      }

      const ids = body.runs.map((r: TestRun) => r.id);
      expect(ids).toContain(runA.id);
    });
  });

  // -----------------------------------------------------------------------
  // 9. Get non-existent run returns 404
  // -----------------------------------------------------------------------
  describe('get non-existent run', () => {
    it('should return 404 for a run that does not exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/test-runs/run-does-not-exist',
      });
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.payload);
      expect(body.error).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 10. Delete removes run
  // -----------------------------------------------------------------------
  describe('delete', () => {
    it('should delete an existing run and return 204', async () => {
      const run = await createRun();

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/test-runs/${run.id}`,
      });
      expect(deleteRes.statusCode).toBe(204);

      // Verify it is gone
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/test-runs/${run.id}`,
      });
      expect(getRes.statusCode).toBe(404);
    });

    it('should return 404 when deleting a non-existent run', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/test-runs/run-nonexistent',
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  // 11. Create run with missing fields returns 400
  // -----------------------------------------------------------------------
  describe('create validation', () => {
    it('should return 400 when suite_id is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/test-runs',
        payload: { environment: 'staging' },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error).toContain('Missing required fields');
    });

    it('should return 400 when environment is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/test-runs',
        payload: { suite_id: 'suite-1' },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error).toContain('Missing required fields');
    });

    it('should return 400 when body is empty', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/test-runs',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // 12. Start sets started_at timestamp
  // -----------------------------------------------------------------------
  describe('started_at timestamp', () => {
    it('should set started_at to a valid ISO timestamp when starting', async () => {
      const run = await createRun();
      expect(run.started_at).toBeNull();

      const before = new Date().toISOString();

      const startRes = await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/start`,
      });
      const started = JSON.parse(startRes.payload) as TestRun;

      const after = new Date().toISOString();

      expect(started.started_at).not.toBeNull();
      // Verify the timestamp falls within a reasonable range
      expect(started.started_at! >= before).toBe(true);
      expect(started.started_at! <= after).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 13. Complete sets completed_at and duration_ms
  // -----------------------------------------------------------------------
  describe('completed_at and duration_ms', () => {
    it('should set completed_at and a non-negative duration_ms on completion', async () => {
      const run = await createRun();

      await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/start`,
      });

      const completeRes = await app.inject({
        method: 'POST',
        url: `/api/v1/test-runs/${run.id}/complete`,
        payload: { passed: true },
      });
      const completed = JSON.parse(completeRes.payload) as TestRun;

      expect(completed.completed_at).not.toBeNull();
      expect(completed.duration_ms).not.toBeNull();
      expect(completed.duration_ms!).toBeGreaterThanOrEqual(0);
    });
  });

  // -----------------------------------------------------------------------
  // 14. Results endpoint returns empty for new run
  // -----------------------------------------------------------------------
  describe('results endpoint', () => {
    it('should return an empty results array for a freshly created run', async () => {
      const run = await createRun();

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/test-runs/${run.id}/results`,
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.results).toEqual([]);
    });

    it('should return 404 for results of a non-existent run', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/test-runs/run-ghost/results',
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // -----------------------------------------------------------------------
  // 15. Create returns correct default values
  // -----------------------------------------------------------------------
  describe('create defaults', () => {
    it('should initialize numeric counters to zero and timestamps to null', async () => {
      const run = await createRun({ suite_id: 'suite-defaults', environment: 'ci' });

      expect(run.status).toBe('pending');
      expect(run.started_at).toBeNull();
      expect(run.completed_at).toBeNull();
      expect(run.duration_ms).toBeNull();
      expect(run.total_tests).toBe(0);
      expect(run.passed_tests).toBe(0);
      expect(run.failed_tests).toBe(0);
      expect(run.created_at).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 16. List all runs without filters
  // -----------------------------------------------------------------------
  describe('list all runs', () => {
    it('should return total count matching the number of runs', async () => {
      // Build a fresh app so we know the exact count
      const freshApp = buildTestApp();
      await freshApp.ready();

      await freshApp.inject({
        method: 'POST',
        url: '/api/v1/test-runs',
        payload: { suite_id: 's1', environment: 'dev' },
      });
      await freshApp.inject({
        method: 'POST',
        url: '/api/v1/test-runs',
        payload: { suite_id: 's2', environment: 'dev' },
      });

      const res = await freshApp.inject({
        method: 'GET',
        url: '/api/v1/test-runs',
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.total).toBe(2);
      expect(body.runs).toHaveLength(2);

      await freshApp.close();
    });
  });

  // -----------------------------------------------------------------------
  // 17. ID generation produces unique IDs
  // -----------------------------------------------------------------------
  describe('unique id generation', () => {
    it('should generate unique IDs for each created run', async () => {
      const run1 = await createRun();
      const run2 = await createRun();
      const run3 = await createRun();

      const ids = new Set([run1.id, run2.id, run3.id]);
      expect(ids.size).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // 18. Start non-existent run returns 404
  // -----------------------------------------------------------------------
  describe('lifecycle actions on non-existent runs', () => {
    it('should return 404 when starting a non-existent run', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/test-runs/run-phantom/start',
      });
      expect(res.statusCode).toBe(404);
    });

    it('should return 404 when completing a non-existent run', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/test-runs/run-phantom/complete',
        payload: { passed: true },
      });
      expect(res.statusCode).toBe(404);
    });

    it('should return 404 when cancelling a non-existent run', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/test-runs/run-phantom/cancel',
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
