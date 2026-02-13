/**
 * Feature #R33: Backend Test Expansion - Validation Middleware
 *
 * Tests Zod validation middleware for Fastify, including body, params,
 * query, and combined validation hooks. Uses self-contained Fastify
 * test apps with app.inject() for full HTTP-level isolation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  validateBody,
  validateParams,
  validateQuery,
  validate,
  createValidatedHandler,
} from '../validation/middleware.js';
import { formatZodErrors } from '../validation/common-schemas.js';

// ---------------------------------------------------------------------------
// Schemas used across tests
// ---------------------------------------------------------------------------

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  age: z.number().int().min(0).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const optionalFieldsSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.number().int().min(1).max(5).optional(),
});

// ---------------------------------------------------------------------------
// Test app builders
// ---------------------------------------------------------------------------

/**
 * Builds a Fastify app with routes protected by individual validation hooks.
 */
const buildTestApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });

  // Route with body validation
  app.post(
    '/users',
    { preHandler: validateBody(createUserSchema) },
    async (request) => {
      return { success: true, user: request.body };
    },
  );

  // Route with params validation
  app.get(
    '/users/:id',
    { preHandler: validateParams(idParamSchema) },
    async (request) => {
      const { id } = request.params as z.infer<typeof idParamSchema>;
      return { success: true, id };
    },
  );

  // Route with query validation
  app.get(
    '/items',
    { preHandler: validateQuery(paginationQuerySchema) },
    async (request) => {
      const query = request.query as z.infer<typeof paginationQuerySchema>;
      return { success: true, page: query.page, limit: query.limit };
    },
  );

  // Route with combined validation (body + params + query)
  app.put(
    '/users/:id',
    {
      preHandler: validate({
        body: createUserSchema,
        params: idParamSchema,
        query: z.object({ dryRun: z.coerce.boolean().default(false) }),
      }),
    },
    async (request) => {
      return { success: true, user: request.body, params: request.params };
    },
  );

  // Route with optional fields
  app.post(
    '/tasks',
    { preHandler: validateBody(optionalFieldsSchema) },
    async (request) => {
      return { success: true, task: request.body };
    },
  );

  // Route using createValidatedHandler
  const handler = createValidatedHandler({
    body: createUserSchema,
    params: idParamSchema,
  });
  app.patch(
    '/users/:id',
    { preHandler: handler.preHandler },
    async (request) => {
      return { success: true, user: request.body };
    },
  );

  return app;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Validation Middleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // validateBody
  // =========================================================================

  describe('validateBody', () => {
    it('should pass request through when body is valid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload: { name: 'Alice', email: 'alice@example.com', age: 30 },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.user.name).toBe('Alice');
      expect(body.user.email).toBe('alice@example.com');
    });

    it('should return 400 with VALIDATION_ERROR code when body is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload: { name: 'A', email: 'not-an-email' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.error).toBe('Validation failed');
    });

    it('should return formatted details with field paths as keys', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload: { name: 'A', email: 'not-an-email' },
      });

      const body = JSON.parse(response.body);
      expect(body.details).toBeDefined();
      expect(body.details.name).toContain('Name must be at least 2 characters');
      expect(body.details.email).toContain('Invalid email address');
    });

    it('should return structured issues array with path, message, and code', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload: { name: 'A', email: 'bad' },
      });

      const body = JSON.parse(response.body);
      expect(body.issues).toBeDefined();
      expect(Array.isArray(body.issues)).toBe(true);
      expect(body.issues.length).toBeGreaterThanOrEqual(2);

      for (const issue of body.issues) {
        expect(issue).toHaveProperty('path');
        expect(issue).toHaveProperty('message');
        expect(issue).toHaveProperty('code');
        expect(typeof issue.path).toBe('string');
      }
    });

    it('should return 400 when required fields are entirely missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/users',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.issues.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // validateParams
  // =========================================================================

  describe('validateParams', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    it('should pass request through when params are valid', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/users/${validUuid}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.id).toBe(validUuid);
    });

    it('should return 400 with INVALID_PARAMS code for malformed params', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/users/not-a-uuid',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INVALID_PARAMS');
      expect(body.error).toBe('Invalid request parameters');
    });

    it('should include details and issues for invalid params', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/users/not-a-uuid',
      });

      const body = JSON.parse(response.body);
      expect(body.details).toBeDefined();
      expect(body.details.id).toBeDefined();
      expect(body.issues).toBeDefined();
      expect(body.issues[0].path).toBe('id');
      expect(body.issues[0].message).toBe('Invalid UUID format');
    });
  });

  // =========================================================================
  // validateQuery
  // =========================================================================

  describe('validateQuery', () => {
    it('should pass request through when query params are valid', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/items?page=2&limit=10',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.page).toBe(2);
      expect(body.limit).toBe(10);
    });

    it('should return 400 with INVALID_QUERY code for invalid query params', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/items?page=-1&limit=999',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INVALID_QUERY');
      expect(body.error).toBe('Invalid query parameters');
    });

    it('should apply Zod default values when optional query params are omitted', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/items',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(20);
    });
  });

  // =========================================================================
  // validate (combined)
  // =========================================================================

  describe('validate (combined)', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    it('should pass when body, params, and query are all valid', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/users/${validUuid}?dryRun=true`,
        payload: { name: 'Bob', email: 'bob@example.com' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should return all validation failures from multiple locations', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/users/not-a-uuid',
        payload: { name: 'A', email: 'bad' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.errors).toBeDefined();
      expect(Array.isArray(body.errors)).toBe(true);

      // Should contain both body and params errors
      const locations = body.errors.map((e: { location: string }) => e.location);
      expect(locations).toContain('body');
      expect(locations).toContain('params');
    });

    it('should include structured issues within each error location', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/users/not-a-uuid',
        payload: { name: 'A', email: 'bad' },
      });

      const body = JSON.parse(response.body);

      for (const errorGroup of body.errors) {
        expect(errorGroup).toHaveProperty('location');
        expect(errorGroup).toHaveProperty('issues');
        expect(Array.isArray(errorGroup.issues)).toBe(true);

        for (const issue of errorGroup.issues) {
          expect(issue).toHaveProperty('path');
          expect(issue).toHaveProperty('message');
          expect(issue).toHaveProperty('code');
        }
      }
    });
  });

  // =========================================================================
  // createValidatedHandler
  // =========================================================================

  describe('createValidatedHandler', () => {
    it('should validate using the combined preHandler it produces', async () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';

      const response = await app.inject({
        method: 'PATCH',
        url: `/users/${validUuid}`,
        payload: { name: 'Carol', email: 'carol@example.com' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.user.name).toBe('Carol');
    });

    it('should reject invalid data through createValidatedHandler', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/users/not-a-uuid',
        payload: { name: 'X', email: 'nope' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // Schema transformation (z.coerce)
  // =========================================================================

  describe('Schema transformation', () => {
    it('should coerce string query params to numbers via z.coerce.number()', async () => {
      // Query params arrive as strings from HTTP; z.coerce.number() transforms them
      const response = await app.inject({
        method: 'GET',
        url: '/items?page=3&limit=50',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(typeof body.page).toBe('number');
      expect(body.page).toBe(3);
      expect(typeof body.limit).toBe('number');
      expect(body.limit).toBe(50);
    });

    it('should coerce string "true" to boolean via z.coerce.boolean()', async () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';

      const response = await app.inject({
        method: 'PUT',
        url: `/users/${validUuid}?dryRun=true`,
        payload: { name: 'Dave', email: 'dave@example.com' },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // Optional fields
  // =========================================================================

  describe('Optional fields', () => {
    it('should accept a request when all optional fields are omitted', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: { name: 'Mandatory only' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.task.name).toBe('Mandatory only');
      expect(body.task.description).toBeUndefined();
      expect(body.task.tags).toBeUndefined();
      expect(body.task.priority).toBeUndefined();
    });

    it('should accept a request when optional fields are provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: {
          name: 'Full task',
          description: 'A description',
          tags: ['urgent', 'backend'],
          priority: 3,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.task.description).toBe('A description');
      expect(body.task.tags).toEqual(['urgent', 'backend']);
      expect(body.task.priority).toBe(3);
    });

    it('should still reject invalid required fields when optional fields are absent', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: { name: '' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // formatZodErrors
  // =========================================================================

  describe('formatZodErrors', () => {
    it('should group messages by dotted field path', () => {
      const zodErrors: z.ZodError['errors'] = [
        { path: ['name'], message: 'Required', code: 'invalid_type' as const, expected: 'string', received: 'undefined' },
        { path: ['email'], message: 'Invalid email', code: 'invalid_string' as const, validation: 'email' },
        { path: ['email'], message: 'Too short', code: 'too_small' as const, minimum: 5, inclusive: true, type: 'string', exact: false },
      ];

      const result = formatZodErrors(zodErrors);

      expect(result.name).toEqual(['Required']);
      expect(result.email).toEqual(['Invalid email', 'Too short']);
    });

    it('should use "root" as key when error path is empty', () => {
      const zodErrors: z.ZodError['errors'] = [
        { path: [], message: 'Invalid input', code: 'custom' as const, params: {} },
      ];

      const result = formatZodErrors(zodErrors);

      expect(result.root).toEqual(['Invalid input']);
    });

    it('should join nested paths with dots', () => {
      const zodErrors: z.ZodError['errors'] = [
        { path: ['address', 'zip'], message: 'Invalid zip code', code: 'invalid_string' as const, validation: 'regex' },
      ];

      const result = formatZodErrors(zodErrors);

      expect(result['address.zip']).toEqual(['Invalid zip code']);
    });

    it('should return an empty object when given no errors', () => {
      const result = formatZodErrors([]);

      expect(result).toEqual({});
    });
  });
});
