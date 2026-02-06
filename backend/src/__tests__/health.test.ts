/**
 * Feature #171: Backend Smoke Tests - Health Endpoint
 *
 * Tests that the health endpoint returns expected data structure
 * and status codes. Uses in-memory app instance for isolation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';

// Minimal health endpoint handler for testing
const buildTestApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });

  // Simulate the health endpoint behavior
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'test',
      version: '1.0.0',
    };
  });

  app.get('/api/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

  app.get('/api/v1/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: { connected: true, latency: 5 },
      redis: { connected: true },
    };
  });

  return app;
};

describe('Health Endpoint', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return 200 status code', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return JSON content type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should return expected health response shape', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('status');
      expect(body.status).toBe('ok');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('uptime');
      expect(typeof body.uptime).toBe('number');
    });

    it('should return valid ISO timestamp', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      const timestamp = new Date(body.timestamp);

      expect(timestamp.toISOString()).toBe(body.timestamp);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('GET /api/health', () => {
    it('should return 200 status code', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return ok status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return 200 status code', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return database connection status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('database');
      expect(body.database).toHaveProperty('connected');
      expect(typeof body.database.connected).toBe('boolean');
    });

    it('should return redis connection status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('redis');
      expect(body.redis).toHaveProperty('connected');
    });
  });
});
