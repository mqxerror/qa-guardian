/**
 * Quick Test Module - Core Routes
 * Feature #730: Split quick-test/routes.ts into sub-modules
 *
 * Provides POST /api/v1/quick-test (start test) and GET /api/v1/quick-test/:runId (get results).
 */

import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, requireScopes, getOrganizationId, type JwtPayload } from '../../middleware/auth.js';
import {
  validateBody,
  validateParams,
  quickTestBodySchema,
  quickTestRunIdParamsSchema,
} from '../../validation/index.js';
import { runQuickTest, getQuickTestResultAsync } from '../../services/quick-test-runner.js';
import { logAuditEntry } from '../audit-logs.js';
import { validateWebhookURLWithDNS } from '../../utils/index.js';
import { sendError } from '../../utils/errors.js';
import type { QuickTestBody, QuickTestParams } from './helpers.js';
import { log, refreshScreenshotUrls } from './helpers.js';

export async function coreRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/quick-test
   * Start a quick test for a URL
   * Returns immediately with runId, results stream via WebSocket
   */
  // Feature #715: Zod validation for request body
  app.post<{ Body: QuickTestBody }>(
    '/api/v1/quick-test',
    {
      preHandler: [authenticate, requireScopes(['execute'])],
      preValidation: [validateBody(quickTestBodySchema)],
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
            // Feature #579: Cross-browser Quick Test
            browser: {
              type: 'string',
              enum: ['chromium', 'firefox', 'webkit'],
              default: 'chromium',
              description: 'Browser to use for testing (default: chromium)',
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
      // Feature #579: Extract browser option (default to chromium)
      const { url, browser = 'chromium' } = request.body;
      const user = request.user as JwtPayload;
      const orgId = getOrganizationId(request);

      // Validate URL
      if (!url) {
        return sendError(reply, 400, 'BAD_REQUEST', 'URL is required');
      }

      // Feature #433: SSRF protection - validate URL before any HTTP request
      // Feature #BMAD: Async DNS resolution to prevent DNS rebinding attacks
      const isProduction = process.env.NODE_ENV === 'production';
      const ssrfValidation = await validateWebhookURLWithDNS(url, {
        allowLocalhost: !isProduction,
      });

      if (!ssrfValidation.safe) {
        return sendError(reply, 400, 'BAD_REQUEST', ssrfValidation.error || 'URL is not allowed for security reasons');
      }

      // Generate run ID
      const runId = uuidv4();

      // Start the quick test asynchronously
      // Feature #579: Pass browser selection to runner
      runQuickTest({
        url,
        runId,
        orgId,
        userId: user.id,
        browser,
      }).catch((err) => {
        // Feature #481: Use structured Pino logging
        log.error({ runId, url, error: err }, 'Unhandled error in quick test');
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
  // Feature #715: Zod validation for runId param
  app.get<{ Params: QuickTestParams }>(
    '/api/v1/quick-test/:runId',
    {
      preHandler: [authenticate],
      preValidation: [validateParams(quickTestRunIdParamsSchema)],
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
      const orgId = getOrganizationId(request);

      // Feature #465: Use async lookup that checks DB if not in memory
      const result = await getQuickTestResultAsync(runId);
      if (!result) {
        return sendError(reply, 404, 'NOT_FOUND', 'Quick test run not found');
      }

      // Feature #461: IDOR protection - verify org-scoping
      // Return 404 (not 403) to avoid information disclosure about other orgs' test runs
      if (result.orgId && result.orgId !== orgId) {
        return sendError(reply, 404, 'NOT_FOUND', 'Quick test run not found');
      }

      // Feature #535: Regenerate fresh signed URLs for screenshots
      refreshScreenshotUrls(result);

      return result;
    }
  );
}
