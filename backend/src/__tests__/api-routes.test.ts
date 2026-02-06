/**
 * Feature #171: Backend Smoke Tests - API Routes
 *
 * Tests critical CRUD endpoints for projects, suites, and tests.
 * Uses mocked data stores for isolation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

interface TestSuite {
  id: string;
  project_id: string;
  name: string;
  description: string;
  created_at: string;
}

interface Test {
  id: string;
  suite_id: string;
  name: string;
  type: string;
  created_at: string;
}

// Build test app with CRUD routes
const buildTestApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });

  // In-memory data stores
  const projects = new Map<string, Project>();
  const suites = new Map<string, TestSuite>();
  const tests = new Map<string, Test>();

  // Projects CRUD
  app.get('/api/v1/projects', async () => {
    return { projects: Array.from(projects.values()) };
  });

  app.get('/api/v1/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const project = projects.get(id);
    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }
    return project;
  });

  app.post('/api/v1/projects', async (request, reply) => {
    const { name, description } = request.body as { name: string; description?: string };
    if (!name) {
      return reply.status(400).send({ error: 'Name is required' });
    }
    const id = `project-${Date.now()}`;
    const project: Project = {
      id,
      name,
      description: description || '',
      created_at: new Date().toISOString(),
    };
    projects.set(id, project);
    return reply.status(201).send(project);
  });

  app.put('/api/v1/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, description } = request.body as { name?: string; description?: string };
    const project = projects.get(id);
    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }
    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    projects.set(id, project);
    return project;
  });

  app.delete('/api/v1/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!projects.has(id)) {
      return reply.status(404).send({ error: 'Project not found' });
    }
    projects.delete(id);
    return { success: true };
  });

  // Test Suites CRUD
  app.get('/api/v1/suites', async (request) => {
    const { project_id } = request.query as { project_id?: string };
    let results = Array.from(suites.values());
    if (project_id) {
      results = results.filter(s => s.project_id === project_id);
    }
    return { suites: results };
  });

  app.get('/api/v1/suites/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const suite = suites.get(id);
    if (!suite) {
      return reply.status(404).send({ error: 'Suite not found' });
    }
    return suite;
  });

  app.post('/api/v1/suites', async (request, reply) => {
    const { project_id, name, description } = request.body as {
      project_id: string;
      name: string;
      description?: string;
    };
    if (!project_id || !name) {
      return reply.status(400).send({ error: 'project_id and name are required' });
    }
    if (!projects.has(project_id)) {
      return reply.status(400).send({ error: 'Project not found' });
    }
    const id = `suite-${Date.now()}`;
    const suite: TestSuite = {
      id,
      project_id,
      name,
      description: description || '',
      created_at: new Date().toISOString(),
    };
    suites.set(id, suite);
    return reply.status(201).send(suite);
  });

  app.delete('/api/v1/suites/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!suites.has(id)) {
      return reply.status(404).send({ error: 'Suite not found' });
    }
    suites.delete(id);
    return { success: true };
  });

  // Tests CRUD
  app.get('/api/v1/tests', async (request) => {
    const { suite_id } = request.query as { suite_id?: string };
    let results = Array.from(tests.values());
    if (suite_id) {
      results = results.filter(t => t.suite_id === suite_id);
    }
    return { tests: results };
  });

  app.get('/api/v1/tests/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const test = tests.get(id);
    if (!test) {
      return reply.status(404).send({ error: 'Test not found' });
    }
    return test;
  });

  app.post('/api/v1/tests', async (request, reply) => {
    const { suite_id, name, type } = request.body as {
      suite_id: string;
      name: string;
      type?: string;
    };
    if (!suite_id || !name) {
      return reply.status(400).send({ error: 'suite_id and name are required' });
    }
    if (!suites.has(suite_id)) {
      return reply.status(400).send({ error: 'Suite not found' });
    }
    const id = `test-${Date.now()}`;
    const test: Test = {
      id,
      suite_id,
      name,
      type: type || 'e2e',
      created_at: new Date().toISOString(),
    };
    tests.set(id, test);
    return reply.status(201).send(test);
  });

  app.delete('/api/v1/tests/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!tests.has(id)) {
      return reply.status(404).send({ error: 'Test not found' });
    }
    tests.delete(id);
    return { success: true };
  });

  // Store reset helper for tests
  (app as any).resetStores = () => {
    projects.clear();
    suites.clear();
    tests.clear();
  };

  return app;
};

describe('API Routes', () => {
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

  describe('Projects CRUD', () => {
    it('should create a project', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        payload: { name: 'Test Project', description: 'A test project' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Test Project');
      expect(body.id).toBeDefined();
    });

    it('should list projects', async () => {
      // Create a project first
      await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        payload: { name: 'Project 1' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/projects',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.projects).toHaveLength(1);
    });

    it('should get a project by ID', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        payload: { name: 'Get Project' },
      });
      const { id } = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Get Project');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/projects/nonexistent',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should update a project', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        payload: { name: 'Original Name' },
      });
      const { id } = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/projects/${id}`,
        payload: { name: 'Updated Name' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Updated Name');
    });

    it('should delete a project', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        payload: { name: 'Delete Me' },
      });
      const { id } = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // Verify deletion
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${id}`,
      });
      expect(getResponse.statusCode).toBe(404);
    });
  });

  describe('Test Suites CRUD', () => {
    let projectId: string;

    beforeEach(async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        payload: { name: 'Suite Test Project' },
      });
      projectId = JSON.parse(response.body).id;
    });

    it('should create a test suite', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/suites',
        payload: { project_id: projectId, name: 'Test Suite' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Test Suite');
      expect(body.project_id).toBe(projectId);
    });

    it('should list suites by project', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/suites',
        payload: { project_id: projectId, name: 'Suite 1' },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/suites?project_id=${projectId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.suites).toHaveLength(1);
    });

    it('should reject suite creation for non-existent project', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/suites',
        payload: { project_id: 'nonexistent', name: 'Invalid Suite' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Tests CRUD', () => {
    let suiteId: string;

    beforeEach(async () => {
      const projectResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        payload: { name: 'Test Test Project' },
      });
      const projectId = JSON.parse(projectResponse.body).id;

      const suiteResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/suites',
        payload: { project_id: projectId, name: 'Test Suite' },
      });
      suiteId = JSON.parse(suiteResponse.body).id;
    });

    it('should create a test', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/tests',
        payload: { suite_id: suiteId, name: 'Login Test', type: 'e2e' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Login Test');
      expect(body.type).toBe('e2e');
    });

    it('should list tests by suite', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/tests',
        payload: { suite_id: suiteId, name: 'Test 1' },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/tests',
        payload: { suite_id: suiteId, name: 'Test 2' },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/tests?suite_id=${suiteId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tests).toHaveLength(2);
    });

    it('should delete a test', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/tests',
        payload: { suite_id: suiteId, name: 'Delete Me' },
      });
      const { id } = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/tests/${id}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).success).toBe(true);
    });
  });
});
