/**
 * Quick Test Module - Compare Routes
 * Feature #730: Split quick-test/routes.ts into sub-modules
 *
 * Provides POST /api/v1/quick-test/compare and GET /api/v1/quick-test/compare/:compareId
 * for comparative URL testing (e.g., staging vs production).
 */

import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, requireScopes, getOrganizationId, type JwtPayload } from '../../middleware/auth.js';
import {
  validateBody,
  validateParams,
  quickTestCompareBodySchema,
  quickTestCompareIdParamsSchema,
} from '../../validation/index.js';
import { runQuickTest, getQuickTestResultAsync } from '../../services/quick-test-runner.js';
import { logAuditEntry } from '../audit-logs.js';
import { validateURLForSSRF } from '../../utils/index.js';
import { createQuickTestComparison, getQuickTestComparison } from '../../services/repositories/quick-test.js';
import { sendError } from '../../utils/errors.js';
import type { QuickTestCompareBody, QuickTestCompareParams } from './helpers.js';
import { log, refreshScreenshotUrls } from './helpers.js';

export async function compareRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/quick-test/compare
   * Feature #473: Start a comparative quick test for two URLs side-by-side
   * Runs both tests in parallel and provides comparison-specific events
   */
  // Feature #715: Zod validation for compare body
  app.post<{ Body: QuickTestCompareBody }>(
    '/api/v1/quick-test/compare',
    {
      preHandler: [authenticate, requireScopes(['execute'])],
      preValidation: [validateBody(quickTestCompareBodySchema)],
      schema: {
        tags: ['Quick Test'],
        summary: 'Start a comparative quick test for two URLs',
        description: 'Initiates parallel analysis of two URLs (e.g., staging vs production) with side-by-side results.',
        body: {
          type: 'object',
          required: ['urlA', 'urlB'],
          properties: {
            urlA: {
              type: 'string',
              format: 'uri',
              description: 'The first URL to test (e.g., staging)',
            },
            urlB: {
              type: 'string',
              format: 'uri',
              description: 'The second URL to test (e.g., production)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              compareId: { type: 'string', format: 'uuid' },
              runIdA: { type: 'string', format: 'uuid' },
              runIdB: { type: 'string', format: 'uuid' },
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
      const { urlA, urlB } = request.body;
      const user = request.user as JwtPayload;
      const orgId = getOrganizationId(request);

      // Validate URLs
      if (!urlA || !urlB) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Both urlA and urlB are required');
      }

      // Feature #433: SSRF protection for both URLs
      const isProduction = process.env.NODE_ENV === 'production';

      const ssrfA = validateURLForSSRF(urlA, {
        requireHttps: false,
        allowLocalhost: !isProduction,
      });
      if (!ssrfA.safe) {
        return sendError(reply, 400, 'BAD_REQUEST', `URL A is not allowed: ${ssrfA.error}`);
      }

      const ssrfB = validateURLForSSRF(urlB, {
        requireHttps: false,
        allowLocalhost: !isProduction,
      });
      if (!ssrfB.safe) {
        return sendError(reply, 400, 'BAD_REQUEST', `URL B is not allowed: ${ssrfB.error}`);
      }

      // Generate compare ID and individual run IDs
      // Feature #535: Use proper UUIDs for run IDs (DB column is UUID type)
      const compareId = uuidv4();
      const runIdA = uuidv4();
      const runIdB = uuidv4();

      // Feature #670: Store compare mapping in database (replaces in-memory Map)
      // TTL cleanup is handled by database expires_at column
      await createQuickTestComparison(compareId, orgId, runIdA, runIdB);

      // Start both quick tests in parallel
      Promise.all([
        runQuickTest({
          url: urlA,
          runId: runIdA,
          orgId,
          userId: user.id,
        }),
        runQuickTest({
          url: urlB,
          runId: runIdB,
          orgId,
          userId: user.id,
        }),
      ]).catch((err) => {
        // Feature #481: Use structured Pino logging
        log.error({ compareId, urlA, urlB, error: err }, 'Unhandled error in quick test compare');
      });

      // Log audit entry
      logAuditEntry(request, 'create', 'quick_test_compare', compareId, `Comparative quick test started for ${urlA} vs ${urlB}`, {
        urlA,
        urlB,
        user_id: user.id,
      });

      return {
        compareId,
        runIdA,
        runIdB,
        status: 'started',
        message: 'Comparative quick test started. Listen for WebSocket events to receive results.',
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
   * GET /api/v1/quick-test/compare/:compareId
   * Feature #473: Get the results of a comparative quick test
   */
  // Feature #715: Zod validation for compare params
  app.get<{ Params: QuickTestCompareParams }>(
    '/api/v1/quick-test/compare/:compareId',
    {
      preHandler: [authenticate],
      preValidation: [validateParams(quickTestCompareIdParamsSchema)],
      schema: {
        tags: ['Quick Test'],
        summary: 'Get comparative quick test results',
        description: 'Returns the results of both URLs in a comparison',
        params: {
          type: 'object',
          required: ['compareId'],
          properties: {
            compareId: {
              type: 'string',
              format: 'uuid',
              description: 'The comparison ID',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              compareId: { type: 'string' },
              resultA: { type: 'object' },
              resultB: { type: 'object' },
              comparison: {
                type: 'object',
                properties: {
                  healthDelta: { type: 'number' },
                  performanceDelta: { type: 'number' },
                  securityDelta: { type: 'number' },
                  accessibilityDelta: { type: 'number' },
                  apiDelta: { type: 'number' },
                  overallDelta: { type: 'number' },
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
      const { compareId } = request.params;
      const orgId = getOrganizationId(request);

      // Feature #670: Look up the actual run UUIDs from database
      const comparisonMapping = await getQuickTestComparison(compareId);
      if (!comparisonMapping) {
        return sendError(reply, 404, 'NOT_FOUND', 'Comparison not found or has expired');
      }

      // Get both results using proper UUIDs
      const resultA = await getQuickTestResultAsync(comparisonMapping.runIdA);
      const resultB = await getQuickTestResultAsync(comparisonMapping.runIdB);

      if (!resultA && !resultB) {
        return sendError(reply, 404, 'NOT_FOUND', 'Comparison not found');
      }

      // Feature #461: IDOR protection - verify org-scoping for both results
      // Return 404 (not 403) to avoid information disclosure
      if ((resultA?.orgId && resultA.orgId !== orgId) ||
          (resultB?.orgId && resultB.orgId !== orgId)) {
        return sendError(reply, 404, 'NOT_FOUND', 'Comparison not found');
      }

      // Calculate deltas if both are complete
      let comparison = null;
      if (resultA?.summary && resultB?.summary) {
        comparison = {
          healthDelta: (resultA.summary.healthScore ?? 0) - (resultB.summary.healthScore ?? 0),
          performanceDelta: (resultA.summary.performanceScore ?? 0) - (resultB.summary.performanceScore ?? 0),
          securityDelta: (resultA.summary.securityScore ?? 0) - (resultB.summary.securityScore ?? 0),
          accessibilityDelta: (resultA.summary.accessibilityScore ?? 0) - (resultB.summary.accessibilityScore ?? 0),
          apiDelta: (resultA.summary.apiScore ?? 0) - (resultB.summary.apiScore ?? 0),
          overallDelta: (resultA.summary.overallScore ?? 0) - (resultB.summary.overallScore ?? 0),
        };
      }

      // Feature #535: Refresh screenshot URLs for both results
      if (resultA) refreshScreenshotUrls(resultA);
      if (resultB) refreshScreenshotUrls(resultB);

      return {
        compareId,
        resultA,
        resultB,
        comparison,
      };
    }
  );
}
