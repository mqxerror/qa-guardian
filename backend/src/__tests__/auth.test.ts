/**
 * Feature #171: Backend Smoke Tests - Authentication
 *
 * Tests authentication flows: login, register, token validation.
 * Uses mocked authentication handlers for isolation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';

const JWT_SECRET = 'test-secret-key-for-testing-only';

// Build test app with auth routes
const buildTestApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });

  // Register JWT plugin
  await app.register(jwt, {
    secret: JWT_SECRET,
  });

  // Mock user database
  const users = new Map<string, { id: string; email: string; password: string; name: string }>();

  // Register endpoint
  app.post('/api/v1/auth/register', async (request, reply) => {
    const { email, password, name } = request.body as { email: string; password: string; name: string };

    if (!email || !password || !name) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    if (users.has(email)) {
      return reply.status(409).send({ error: 'User already exists' });
    }

    const user = { id: `user-${Date.now()}`, email, password, name };
    users.set(email, user);

    const token = app.jwt.sign({ userId: user.id, email: user.email });

    return reply.status(201).send({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  });

  // Login endpoint
  app.post('/api/v1/auth/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      return reply.status(400).send({ error: 'Missing email or password' });
    }

    const user = users.get(email);

    if (!user || user.password !== password) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = app.jwt.sign({ userId: user.id, email: user.email });

    return { user: { id: user.id, email: user.email, name: user.name }, token };
  });

  // Protected endpoint (requires valid JWT)
  app.get('/api/v1/auth/me', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    },
  }, async (request) => {
    const decoded = request.user as { userId: string; email: string };
    return { userId: decoded.userId, email: decoded.email };
  });

  // Token validation endpoint
  app.post('/api/v1/auth/validate', async (request, reply) => {
    const { token } = request.body as { token: string };

    if (!token) {
      return reply.status(400).send({ error: 'Token required' });
    }

    try {
      const decoded = app.jwt.verify(token);
      return { valid: true, decoded };
    } catch {
      return reply.status(401).send({ valid: false, error: 'Invalid token' });
    }
  });

  return app;
};

describe('Authentication', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('user');
      expect(body).toHaveProperty('token');
      expect(body.user.email).toBe('test@example.com');
    });

    it('should reject registration with missing fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'test2@example.com',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject duplicate email registration', async () => {
      // First registration
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'duplicate@example.com',
          password: 'password123',
          name: 'First User',
        },
      });

      // Second registration with same email
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'duplicate@example.com',
          password: 'password456',
          name: 'Second User',
        },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      // Register first
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'login-test@example.com',
          password: 'password123',
          name: 'Login Test',
        },
      });

      // Then login
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'login-test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('token');
      expect(body.user.email).toBe('login-test@example.com');
    });

    it('should reject login with invalid password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'login-test@example.com',
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject login with non-existent user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me (Protected Route)', () => {
    it('should return user info with valid token', async () => {
      // Register and get token
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'me-test@example.com',
          password: 'password123',
          name: 'Me Test',
        },
      });

      const { token } = JSON.parse(registerResponse.body);

      // Access protected route
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.email).toBe('me-test@example.com');
    });

    it('should reject request without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/auth/validate', () => {
    it('should validate a valid token', async () => {
      // Register and get token
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'validate-test@example.com',
          password: 'password123',
          name: 'Validate Test',
        },
      });

      const { token } = JSON.parse(registerResponse.body);

      // Validate token
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/validate',
        payload: { token },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.valid).toBe(true);
      expect(body.decoded).toHaveProperty('email');
    });

    it('should reject an invalid token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/validate',
        payload: { token: 'invalid-token' },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.valid).toBe(false);
    });
  });
});
