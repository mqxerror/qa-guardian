/**
 * Quick Test Routes
 * Feature #424: POST /api/v1/quick-test endpoint for instant URL analysis
 *
 * Accepts a URL and orchestrates 4 parallel test waves:
 * - Wave 1: Health Check (DNS, HTTP, SSL, redirects)
 * - Wave 2: Visual + Performance (Lighthouse, screenshots, Core Web Vitals)
 * - Wave 3: Security Scan (OWASP headers, cookies, exposed paths)
 * - Wave 4: AI Analysis (test suggestions, UX issues, recommendations)
 *
 * Results stream via Socket.IO events.
 */

import { FastifyPluginAsync } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, requireScopes, getOrganizationId, type JwtPayload } from '../../middleware/auth.js';
import { runQuickTest, getQuickTestResult } from '../../services/quick-test-runner.js';
import { logAuditEntry } from '../audit-logs.js';

// Request body type
interface QuickTestBody {
  url: string;
}

// Route params for getting results
interface QuickTestParams {
  runId: string;
}

const quickTestRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /api/v1/quick-test
   * Start a quick test for a URL
   * Returns immediately with runId, results stream via WebSocket
   */
  app.post<{ Body: QuickTestBody }>(
    '/api/v1/quick-test',
    {
      preHandler: [authenticate, requireScopes(['execute'])],
      schema: {
        tags: ['Quick Test'],
        summary: 'Start a quick test for a URL',
        description: 'Initiates a 4-wave analysis of the provided URL. Results are streamed via WebSocket events.',
        body: {
          type: 'object',
          required: ['url'],
          properties: {
            url: {
              type: 'string',
              format: 'uri',
              description: 'The URL to test (must include protocol)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              runId: { type: 'string', format: 'uuid' },
              status: { type: 'string', enum: ['started'] },
              message: { type: 'string' },
              websocketEvents: {
                type: 'array',
                items: { type: 'string' },
                description: 'WebSocket events to listen for',
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { url } = request.body;
      const user = request.user as JwtPayload;
      const orgId = getOrganizationId(request);

      // Validate URL
      if (!url) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'URL is required',
        });
      }

      // Validate URL format
      try {
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'URL must use http or https protocol',
          });
        }
      } catch {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid URL format',
        });
      }

      // Generate run ID
      const runId = uuidv4();

      // Start the quick test asynchronously
      runQuickTest({
        url,
        runId,
        orgId,
        userId: user.id,
      }).catch((err) => {
        console.error('[Quick Test] Unhandled error:', err);
      });

      // Log audit entry
      logAuditEntry(request, 'create', 'quick_test', runId, `Quick test started for ${url}`, {
        url,
        user_id: user.id,
      });

      return {
        runId,
        status: 'started',
        message: 'Quick test started. Listen for WebSocket events to receive results.',
        websocketEvents: [
          'wave:start',
          'wave:progress',
          'wave:complete',
          'wave:error',
          'quick-test:complete',
          'quick-test:error',
        ],
      };
    }
  );

  /**
   * GET /api/v1/quick-test/:runId
   * Get the current status and results of a quick test
   */
  app.get<{ Params: QuickTestParams }>(
    '/api/v1/quick-test/:runId',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Quick Test'],
        summary: 'Get quick test results',
        description: 'Returns the current status and results of a quick test run',
        params: {
          type: 'object',
          required: ['runId'],
          properties: {
            runId: {
              type: 'string',
              format: 'uuid',
              description: 'The quick test run ID',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              runId: { type: 'string' },
              url: { type: 'string' },
              status: { type: 'string', enum: ['running', 'completed', 'failed'] },
              startedAt: { type: 'string', format: 'date-time' },
              completedAt: { type: 'string', format: 'date-time' },
              waves: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    wave: { type: 'number' },
                    name: { type: 'string' },
                    status: { type: 'string' },
                    startedAt: { type: 'string' },
                    completedAt: { type: 'string' },
                    duration: { type: 'number' },
                    data: { type: 'object' },
                    error: { type: 'string' },
                  },
                },
              },
              summary: {
                type: 'object',
                properties: {
                  healthScore: { type: 'number' },
                  performanceScore: { type: 'number' },
                  securityScore: { type: 'number' },
                  overallScore: { type: 'number' },
                },
              },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { runId } = request.params;

      const result = getQuickTestResult(runId);
      if (!result) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Quick test run not found or expired (results expire after 24 hours)',
        });
      }

      return result;
    }
  );
};

export default quickTestRoutes;
