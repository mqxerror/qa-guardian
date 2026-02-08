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
import { runQuickTest, getQuickTestResult, getQuickTestResultAsync } from '../../services/quick-test-runner.js';
import { logAuditEntry } from '../audit-logs.js';
import { validateURLForSSRF } from '../../utils/index.js';
// Feature #465: PostgreSQL persistence for history endpoint
import { getQuickTestHistory } from '../../services/repositories/quick-test.js';
// Feature #466: Screenshot serving
import { readScreenshot, screenshotExists, type ScreenshotType } from '../../services/quick-test-screenshots.js';

// Request body type
interface QuickTestBody {
  url: string;
}

// Route params for getting results
interface QuickTestParams {
  runId: string;
}

// Feature #466: Route params for screenshots
interface ScreenshotParams {
  runId: string;
  type: 'desktop' | 'mobile';
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

      // Feature #433: SSRF protection - validate URL before any HTTP request
      // This prevents scanning of internal infrastructure via private IPs
      const isProduction = process.env.NODE_ENV === 'production';
      const ssrfValidation = validateURLForSSRF(url, {
        requireHttps: false,  // Allow HTTP for testing purposes
        allowLocalhost: !isProduction,  // Block localhost in production
      });

      if (!ssrfValidation.safe) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: ssrfValidation.error || 'URL is not allowed for security reasons',
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
   * GET /api/v1/quick-test/history
   * Feature #465: Get paginated history of quick test runs for the organization
   * NOTE: This route MUST be registered BEFORE /:runId to avoid path parameter conflict
   */
  app.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      status?: 'running' | 'completed' | 'failed';
    };
  }>(
    '/api/v1/quick-test/history',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Quick Test'],
        summary: 'Get quick test history',
        description: 'Returns paginated list of quick test runs for the organization',
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'string',
              default: '20',
              description: 'Number of results per page (max 100)',
            },
            offset: {
              type: 'string',
              default: '0',
              description: 'Number of results to skip',
            },
            status: {
              type: 'string',
              enum: ['running', 'completed', 'failed'],
              description: 'Filter by status',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    url: { type: 'string' },
                    status: { type: 'string' },
                    overallScore: { type: 'number', nullable: true },
                    healthScore: { type: 'number', nullable: true },
                    performanceScore: { type: 'number', nullable: true },
                    securityScore: { type: 'number', nullable: true },
                    startedAt: { type: 'string', format: 'date-time' },
                    completedAt: { type: 'string', format: 'date-time', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
              total: { type: 'number' },
              limit: { type: 'number' },
              offset: { type: 'number' },
            },
          },
        },
      },
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
      const offset = parseInt(request.query.offset || '0', 10);
      const status = request.query.status;

      const historyResult = await getQuickTestHistory({
        organizationId: orgId,
        limit,
        offset,
        status,
      });

      return {
        results: historyResult.results.map((r) => ({
          id: r.id,
          url: r.url,
          status: r.status,
          overallScore: r.overallScore,
          healthScore: r.healthScore,
          performanceScore: r.performanceScore,
          securityScore: r.securityScore,
          startedAt: r.startedAt.toISOString(),
          completedAt: r.completedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
        })),
        total: historyResult.total,
        limit: historyResult.limit,
        offset: historyResult.offset,
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

      // Feature #465: Use async lookup that checks DB if not in memory
      const result = await getQuickTestResultAsync(runId);
      if (!result) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Quick test run not found',
        });
      }

      return result;
    }
  );

  /**
   * GET /api/v1/quick-test/:runId/screenshots/:type
   * Feature #466: Serve screenshots for a quick test run
   * Note: No authentication required - runId (UUID) provides security through obscurity
   * This allows <img> tags to load screenshots without auth headers
   */
  app.get<{ Params: ScreenshotParams }>(
    '/api/v1/quick-test/:runId/screenshots/:type',
    {
      // No preHandler - public endpoint for image loading
      schema: {
        tags: ['Quick Test'],
        summary: 'Get screenshot from a quick test run',
        description: 'Returns the desktop or mobile screenshot captured during the Visual + Performance wave',
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

      // Validate type
      if (type !== 'desktop' && type !== 'mobile') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Screenshot type must be "desktop" or "mobile"',
        });
      }

      // Check if screenshot exists
      if (!screenshotExists(runId, type as ScreenshotType)) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Screenshot not found for run ${runId}`,
        });
      }

      // Read and return the screenshot
      const imageBuffer = await readScreenshot(runId, type as ScreenshotType);
      if (!imageBuffer) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Screenshot could not be read',
        });
      }

      return reply
        .header('Content-Type', 'image/png')
        .header('Cache-Control', 'public, max-age=86400') // Cache for 24 hours
        .send(imageBuffer);
    }
  );
};

export default quickTestRoutes;
