/**
 * Feature #R33: Backend Test Expansion - Monitoring Routes
 *
 * Tests CRUD operations for monitoring checks, including pause/resume
 * lifecycle and check history. Uses in-memory data stores for isolation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

interface MonitoringCheck {
  id: string;
  name: string;
  url: string;
  type: 'http' | 'tcp' | 'ping';
  interval: number; // seconds
  timeout: number;
  is_paused: boolean;
  status: 'up' | 'down' | 'unknown';
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CheckResult {
  id: string;
  check_id: string;
  status: 'up' | 'down';
  response_time: number;
  status_code: number | null;
  error: string | null;
  checked_at: string;
}

// Build self-contained Fastify test app with monitoring routes
const buildTestApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });

  // Counter-based ID generation to prevent collisions within the same millisecond
  let idCounter = 0;

  // In-memory data stores
  const checks = new Map<string, MonitoringCheck>();
  const history = new Map<string, CheckResult[]>();

  const VALID_TYPES = ['http', 'tcp', 'ping'];

  // List all checks
  app.get('/api/v1/monitoring/checks', async () => {
    const allChecks = Array.from(checks.values());
    return { checks: allChecks, total: allChecks.length };
  });

  // Create a check
  app.post('/api/v1/monitoring/checks', async (request, reply) => {
    const { name, url, interval, type, timeout } = request.body as {
      name?: string;
      url?: string;
      interval?: number;
      type?: string;
      timeout?: number;
    };

    // Validate required fields
    const missing: string[] = [];
    if (!name) missing.push('name');
    if (!url) missing.push('url');
    if (interval === undefined || interval === null) missing.push('interval');
    if (!type) missing.push('type');

    if (missing.length > 0) {
      return reply.status(400).send({
        error: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    if (!VALID_TYPES.includes(type!)) {
      return reply.status(400).send({
        error: `Invalid type: ${type}. Must be one of: ${VALID_TYPES.join(', ')}`,
      });
    }

    const id = `check-${++idCounter}`;
    const now = new Date().toISOString();
    const check: MonitoringCheck = {
      id,
      name: name!,
      url: url!,
      type: type as MonitoringCheck['type'],
      interval: interval!,
      timeout: timeout ?? 30,
      is_paused: false,
      status: 'unknown',
      last_checked_at: null,
      created_at: now,
      updated_at: now,
    };

    checks.set(id, check);
    history.set(id, []);

    return reply.status(201).send(check);
  });

  // Get single check
  app.get('/api/v1/monitoring/checks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const check = checks.get(id);
    if (!check) {
      return reply.status(404).send({ error: 'Check not found' });
    }
    return check;
  });

  // Update check
  app.put('/api/v1/monitoring/checks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const check = checks.get(id);
    if (!check) {
      return reply.status(404).send({ error: 'Check not found' });
    }

    const updates = request.body as Partial<
      Pick<MonitoringCheck, 'name' | 'url' | 'interval' | 'type' | 'timeout'>
    >;

    if (updates.name !== undefined) check.name = updates.name;
    if (updates.url !== undefined) check.url = updates.url;
    if (updates.interval !== undefined) check.interval = updates.interval;
    if (updates.type !== undefined) check.type = updates.type;
    if (updates.timeout !== undefined) check.timeout = updates.timeout;
    check.updated_at = new Date().toISOString();

    checks.set(id, check);
    return check;
  });

  // Delete check
  app.delete('/api/v1/monitoring/checks/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!checks.has(id)) {
      return reply.status(404).send({ error: 'Check not found' });
    }
    checks.delete(id);
    history.delete(id);
    return reply.status(204).send();
  });

  // Pause a check
  app.post('/api/v1/monitoring/checks/:id/pause', async (request, reply) => {
    const { id } = request.params as { id: string };
    const check = checks.get(id);
    if (!check) {
      return reply.status(404).send({ error: 'Check not found' });
    }
    check.is_paused = true;
    check.updated_at = new Date().toISOString();
    checks.set(id, check);
    return check;
  });

  // Resume a check
  app.post('/api/v1/monitoring/checks/:id/resume', async (request, reply) => {
    const { id } = request.params as { id: string };
    const check = checks.get(id);
    if (!check) {
      return reply.status(404).send({ error: 'Check not found' });
    }
    check.is_paused = false;
    check.updated_at = new Date().toISOString();
    checks.set(id, check);
    return check;
  });

  // Get check history
  app.get('/api/v1/monitoring/checks/:id/history', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!checks.has(id)) {
      return reply.status(404).send({ error: 'Check not found' });
    }
    const results = history.get(id) || [];
    return { results, total: results.length };
  });

  // Store reset helper for tests
  (app as any).resetStores = () => {
    checks.clear();
    history.clear();
    idCounter = 0;
  };

  return app;
};

describe('Monitoring Check Routes', () => {
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

  // Helper to create a check with sensible defaults
  const createCheck = async (overrides: Partial<MonitoringCheck> = {}) => {
    const payload = {
      name: 'API Health',
      url: 'https://api.example.com/health',
      type: 'http',
      interval: 60,
      ...overrides,
    };
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/monitoring/checks',
      payload,
    });
    return response;
  };

  describe('POST /api/v1/monitoring/checks', () => {
    it('should create a monitoring check with all required fields', async () => {
      const response = await createCheck();

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.name).toBe('API Health');
      expect(body.url).toBe('https://api.example.com/health');
      expect(body.type).toBe('http');
      expect(body.interval).toBe(60);
      expect(body.is_paused).toBe(false);
      expect(body.status).toBe('unknown');
      expect(body.last_checked_at).toBeNull();
      expect(body.created_at).toBeDefined();
      expect(body.updated_at).toBeDefined();
    });

    it('should assign default timeout of 30 when not provided', async () => {
      const response = await createCheck();

      const body = JSON.parse(response.body);
      expect(body.timeout).toBe(30);
    });

    it('should use custom timeout when provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/monitoring/checks',
        payload: {
          name: 'Slow Service',
          url: 'https://slow.example.com',
          type: 'http',
          interval: 120,
          timeout: 90,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.timeout).toBe(90);
    });

    it('should return 400 when name is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/monitoring/checks',
        payload: { url: 'https://example.com', type: 'http', interval: 60 },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('name');
    });

    it('should return 400 when url is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/monitoring/checks',
        payload: { name: 'Test', type: 'http', interval: 60 },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('url');
    });

    it('should return 400 when multiple required fields are missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/monitoring/checks',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('name');
      expect(body.error).toContain('url');
      expect(body.error).toContain('interval');
      expect(body.error).toContain('type');
    });

    it('should return 400 for invalid check type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/monitoring/checks',
        payload: {
          name: 'Bad Type',
          url: 'https://example.com',
          type: 'websocket',
          interval: 60,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid type');
    });
  });

  describe('GET /api/v1/monitoring/checks', () => {
    it('should return empty list when no checks exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/monitoring/checks',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.checks).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('should return all checks with correct total count', async () => {
      await createCheck({ name: 'Check 1', url: 'https://one.example.com' });
      await createCheck({ name: 'Check 2', url: 'https://two.example.com' });
      await createCheck({ name: 'Check 3', url: 'https://three.example.com' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/monitoring/checks',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.checks).toHaveLength(3);
      expect(body.total).toBe(3);
    });
  });

  describe('GET /api/v1/monitoring/checks/:id', () => {
    it('should return a check by ID', async () => {
      const createResponse = await createCheck({ name: 'Fetch Me' });
      const { id } = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/monitoring/checks/${id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(id);
      expect(body.name).toBe('Fetch Me');
    });

    it('should return 404 for non-existent check', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/monitoring/checks/check-nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Check not found');
    });
  });

  describe('PUT /api/v1/monitoring/checks/:id', () => {
    it('should update only specified fields', async () => {
      const createResponse = await createCheck({
        name: 'Original',
        url: 'https://original.example.com',
      });
      const created = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/monitoring/checks/${created.id}`,
        payload: { name: 'Updated Name' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Updated Name');
      // Unchanged fields should remain the same
      expect(body.url).toBe('https://original.example.com');
      expect(body.type).toBe('http');
      expect(body.interval).toBe(60);
    });

    it('should update the updated_at timestamp on modification', async () => {
      const createResponse = await createCheck();
      const created = JSON.parse(createResponse.body);
      const originalUpdatedAt = created.updated_at;

      // Small delay to ensure timestamp differs
      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/monitoring/checks/${created.id}`,
        payload: { name: 'Timestamp Test' },
      });

      const body = JSON.parse(response.body);
      expect(body.updated_at).not.toBe(originalUpdatedAt);
    });

    it('should return 404 when updating a non-existent check', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/monitoring/checks/check-nonexistent',
        payload: { name: 'Does Not Exist' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/v1/monitoring/checks/:id', () => {
    it('should delete a check and return 204', async () => {
      const createResponse = await createCheck({ name: 'Delete Me' });
      const { id } = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/monitoring/checks/${id}`,
      });

      expect(response.statusCode).toBe(204);
    });

    it('should confirm check is gone after deletion', async () => {
      const createResponse = await createCheck({ name: 'Gone Soon' });
      const { id } = JSON.parse(createResponse.body);

      await app.inject({
        method: 'DELETE',
        url: `/api/v1/monitoring/checks/${id}`,
      });

      // Verify the check no longer exists
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/monitoring/checks/${id}`,
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 when deleting a non-existent check', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/monitoring/checks/check-nonexistent',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/monitoring/checks/:id/pause', () => {
    it('should pause an active check', async () => {
      const createResponse = await createCheck();
      const { id } = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/monitoring/checks/${id}/pause`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.is_paused).toBe(true);
    });

    it('should return 404 when pausing a non-existent check', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/monitoring/checks/check-nonexistent/pause',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/monitoring/checks/:id/resume', () => {
    it('should resume a paused check', async () => {
      const createResponse = await createCheck();
      const { id } = JSON.parse(createResponse.body);

      // Pause first
      await app.inject({
        method: 'POST',
        url: `/api/v1/monitoring/checks/${id}/pause`,
      });

      // Then resume
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/monitoring/checks/${id}/resume`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.is_paused).toBe(false);
    });

    it('should return 404 when resuming a non-existent check', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/monitoring/checks/check-nonexistent/resume',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/monitoring/checks/:id/history', () => {
    it('should return empty history for a newly created check', async () => {
      const createResponse = await createCheck();
      const { id } = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/monitoring/checks/${id}/history`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.results).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('should return 404 for history of a non-existent check', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/monitoring/checks/check-nonexistent/history',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('CRUD Lifecycle', () => {
    it('should complete a full create -> read -> update -> delete cycle', async () => {
      // Create
      const createResponse = await createCheck({
        name: 'Lifecycle Check',
        url: 'https://lifecycle.example.com',
      });
      expect(createResponse.statusCode).toBe(201);
      const created = JSON.parse(createResponse.body);
      expect(created.name).toBe('Lifecycle Check');

      // Read
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/monitoring/checks/${created.id}`,
      });
      expect(getResponse.statusCode).toBe(200);
      expect(JSON.parse(getResponse.body).name).toBe('Lifecycle Check');

      // Update
      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/api/v1/monitoring/checks/${created.id}`,
        payload: { name: 'Updated Lifecycle', interval: 300 },
      });
      expect(updateResponse.statusCode).toBe(200);
      const updated = JSON.parse(updateResponse.body);
      expect(updated.name).toBe('Updated Lifecycle');
      expect(updated.interval).toBe(300);

      // Delete
      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/v1/monitoring/checks/${created.id}`,
      });
      expect(deleteResponse.statusCode).toBe(204);

      // Verify gone
      const verifyResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/monitoring/checks/${created.id}`,
      });
      expect(verifyResponse.statusCode).toBe(404);
    });

    it('should handle pause and resume within a check lifecycle', async () => {
      const createResponse = await createCheck({ name: 'Pause Lifecycle' });
      const { id } = JSON.parse(createResponse.body);

      // Verify initially not paused
      const initial = await app.inject({
        method: 'GET',
        url: `/api/v1/monitoring/checks/${id}`,
      });
      expect(JSON.parse(initial.body).is_paused).toBe(false);

      // Pause
      const pauseResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/monitoring/checks/${id}/pause`,
      });
      expect(JSON.parse(pauseResponse.body).is_paused).toBe(true);

      // Confirm paused via GET
      const pausedGet = await app.inject({
        method: 'GET',
        url: `/api/v1/monitoring/checks/${id}`,
      });
      expect(JSON.parse(pausedGet.body).is_paused).toBe(true);

      // Resume
      const resumeResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/monitoring/checks/${id}/resume`,
      });
      expect(JSON.parse(resumeResponse.body).is_paused).toBe(false);

      // Confirm resumed via GET
      const resumedGet = await app.inject({
        method: 'GET',
        url: `/api/v1/monitoring/checks/${id}`,
      });
      expect(JSON.parse(resumedGet.body).is_paused).toBe(false);
    });
  });
});
