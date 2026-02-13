/**
 * Quick Test Module - Screenshot Routes
 * Feature #730: Split quick-test/routes.ts into sub-modules
 *
 * Provides GET /api/v1/quick-test/:runId/screenshots/:type for serving screenshots.
 * Feature #466: Screenshot serving
 * Feature #478: Signed URL validation for screenshot auth
 */

import { FastifyInstance } from 'fastify';
import { getOrganizationId } from '../../middleware/auth.js';
import {
  validateParams,
  quickTestScreenshotParamsSchema,
} from '../../validation/index.js';
import { getQuickTestResultAsync } from '../../services/quick-test-runner.js';
import { readScreenshot, screenshotExists, validateSignedScreenshotToken, type ScreenshotType } from '../../services/quick-test-screenshots.js';
import { sendError } from '../../utils/errors.js';
import type { ScreenshotParams, ScreenshotQuerystring } from './helpers.js';

export async function screenshotRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/quick-test/:runId/screenshots/:type
   * Feature #466: Serve screenshots for a quick test run
   * Feature #478: SECURITY FIX - Add authentication and org-scoping
   *
   * Authentication methods (either one works):
   * 1. Authorization header (JWT token) - for API clients
   * 2. Signed URL token query param - for <img> tags
   */
  // Feature #715: Zod validation for screenshot params
  app.get<{ Params: ScreenshotParams; Querystring: ScreenshotQuerystring }>(
    '/api/v1/quick-test/:runId/screenshots/:type',
    {
      // Feature #478: No preHandler - we do soft auth in the handler
      // This allows both JWT auth and signed token auth without returning 401 early
      preValidation: [validateParams(quickTestScreenshotParamsSchema)],
      schema: {
        tags: ['Quick Test'],
        summary: 'Get screenshot from a quick test run',
        description: 'Returns the desktop or mobile screenshot captured during the Visual + Performance wave. Requires authentication via JWT header or signed URL token.',
        params: {
          type: 'object',
          required: ['runId', 'type'],
          properties: {
            runId: {
              type: 'string',
              format: 'uuid',
              description: 'The quick test run ID',
            },
            type: {
              type: 'string',
              enum: ['desktop', 'mobile'],
              description: 'The screenshot type',
            },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'Signed URL token for authentication (alternative to JWT header)',
            },
          },
        },
        response: {
          200: {
            type: 'string',
            format: 'binary',
            description: 'PNG image data',
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
      const { runId, type } = request.params;
      const { token } = request.query;

      // Validate type
      if (type !== 'desktop' && type !== 'mobile') {
        return sendError(reply, 400, 'BAD_REQUEST', 'Screenshot type must be "desktop" or "mobile"');
      }

      // Feature #478: Determine authenticated orgId using soft auth
      // (doesn't return 401 on failure - just checks if auth is present)
      let authenticatedOrgId: string | null = null;

      // Method 1: Try JWT authentication (soft - catch any failures silently)
      try {
        await request.jwtVerify();
        // If verification succeeded, request.user is populated
        if (request.user) {
          authenticatedOrgId = getOrganizationId(request);
        }
      } catch {
        // JWT verification failed - that's okay, we'll check signed token
      }

      // Method 2: Check signed URL token (fallback for <img> tags)
      if (!authenticatedOrgId && token) {
        authenticatedOrgId = validateSignedScreenshotToken(token, runId, type as ScreenshotType);
      }

      // If neither authentication method succeeded, return 404 (avoid leaking resource existence)
      if (!authenticatedOrgId) {
        return sendError(reply, 404, 'NOT_FOUND', 'Quick test run not found');
      }

      // Feature #478: Get the run to verify org-scoping
      const result = await getQuickTestResultAsync(runId);
      if (!result) {
        return sendError(reply, 404, 'NOT_FOUND', 'Quick test run not found');
      }

      // Feature #478: IDOR protection - verify org-scoping
      // Return 404 (not 403) to avoid information disclosure
      if (result.orgId && result.orgId !== authenticatedOrgId) {
        return sendError(reply, 404, 'NOT_FOUND', 'Quick test run not found');
      }

      // Check if screenshot exists
      if (!screenshotExists(runId, type as ScreenshotType)) {
        return sendError(reply, 404, 'NOT_FOUND', `Screenshot not found for run ${runId}`);
      }

      // Read and return the screenshot
      const imageBuffer = await readScreenshot(runId, type as ScreenshotType);
      if (!imageBuffer) {
        return sendError(reply, 404, 'NOT_FOUND', 'Screenshot could not be read');
      }

      return reply
        .header('Content-Type', 'image/png')
        .header('Cache-Control', 'private, max-age=3600') // Private cache for 1 hour (reduced due to auth)
        .send(imageBuffer);
    }
  );
}
