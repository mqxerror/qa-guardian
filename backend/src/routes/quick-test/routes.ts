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

// Feature #473: Comparative Quick Test request body
interface QuickTestCompareBody {
  urlA: string;
  urlB: string;
}

// Route params for getting results
interface QuickTestParams {
  runId: string;
}

// Feature #473: Route params for compare results
interface QuickTestCompareParams {
  compareId: string;
}

// Feature #474: Quick Test schedule request body
interface QuickTestScheduleBody {
  url: string;
  name: string;
  cron_expression: string;
  notify_on_score_drop?: boolean;
  score_threshold?: number;
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
   * POST /api/v1/quick-test/compare
   * Feature #473: Start a comparative quick test for two URLs side-by-side
   * Runs both tests in parallel and provides comparison-specific events
   */
  app.post<{ Body: QuickTestCompareBody }>(
    '/api/v1/quick-test/compare',
    {
      preHandler: [authenticate, requireScopes(['execute'])],
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
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Both urlA and urlB are required',
        });
      }

      // Feature #433: SSRF protection for both URLs
      const isProduction = process.env.NODE_ENV === 'production';

      const ssrfA = validateURLForSSRF(urlA, {
        requireHttps: false,
        allowLocalhost: !isProduction,
      });
      if (!ssrfA.safe) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `URL A is not allowed: ${ssrfA.error}`,
        });
      }

      const ssrfB = validateURLForSSRF(urlB, {
        requireHttps: false,
        allowLocalhost: !isProduction,
      });
      if (!ssrfB.safe) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `URL B is not allowed: ${ssrfB.error}`,
        });
      }

      // Generate compare ID and individual run IDs
      const compareId = uuidv4();
      const runIdA = `${compareId}-a`;
      const runIdB = `${compareId}-b`;

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
        console.error('[Quick Test Compare] Unhandled error:', err);
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
  app.get<{ Params: QuickTestCompareParams }>(
    '/api/v1/quick-test/compare/:compareId',
    {
      preHandler: [authenticate],
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

      // Get both results
      const resultA = await getQuickTestResultAsync(`${compareId}-a`);
      const resultB = await getQuickTestResultAsync(`${compareId}-b`);

      if (!resultA && !resultB) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Comparison not found',
        });
      }

      // Feature #461: IDOR protection - verify org-scoping for both results
      // Return 404 (not 403) to avoid information disclosure
      if ((resultA?.orgId && resultA.orgId !== orgId) ||
          (resultB?.orgId && resultB.orgId !== orgId)) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Comparison not found',
        });
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

      return {
        compareId,
        resultA,
        resultB,
        comparison,
      };
    }
  );

  /**
   * POST /api/v1/quick-test/schedules
   * Feature #474: Create a scheduled Quick Test for recurring monitoring
   */
  app.post<{ Body: QuickTestScheduleBody }>(
    '/api/v1/quick-test/schedules',
    {
      preHandler: [authenticate, requireScopes(['execute'])],
      schema: {
        tags: ['Quick Test'],
        summary: 'Create a scheduled Quick Test',
        description: 'Creates a recurring Quick Test schedule for monitoring a URL',
        body: {
          type: 'object',
          required: ['url', 'name', 'cron_expression'],
          properties: {
            url: {
              type: 'string',
              format: 'uri',
              description: 'The URL to monitor',
            },
            name: {
              type: 'string',
              description: 'Schedule name',
            },
            cron_expression: {
              type: 'string',
              description: 'Cron expression for schedule (e.g., "0 */6 * * *" for every 6 hours)',
            },
            notify_on_score_drop: {
              type: 'boolean',
              default: true,
              description: 'Whether to send alerts when score drops',
            },
            score_threshold: {
              type: 'number',
              default: 70,
              description: 'Score threshold for alerts (0-100)',
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              url: { type: 'string' },
              name: { type: 'string' },
              cron_expression: { type: 'string' },
              notify_on_score_drop: { type: 'boolean' },
              score_threshold: { type: 'number' },
              enabled: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
              next_run_at: { type: 'string', format: 'date-time' },
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
      const { url, name, cron_expression, notify_on_score_drop = true, score_threshold = 70 } = request.body;
      const user = request.user as JwtPayload;
      const orgId = getOrganizationId(request);

      // Validate URL
      if (!url) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'URL is required',
        });
      }

      // SSRF protection
      const isProduction = process.env.NODE_ENV === 'production';
      const ssrfValidation = validateURLForSSRF(url, {
        requireHttps: false,
        allowLocalhost: !isProduction,
      });

      if (!ssrfValidation.safe) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: ssrfValidation.error || 'URL is not allowed for security reasons',
        });
      }

      // Calculate next run time from cron (simplified)
      const now = new Date();
      const next_run_at = new Date(now.getTime() + 60 * 60 * 1000); // Default: 1 hour from now

      const scheduleId = uuidv4();

      // Log the schedule creation (actual persistence would go to a quick_test_schedules table)
      logAuditEntry(request, 'create', 'quick_test_schedule', scheduleId, `Quick test schedule created for ${url}`, {
        url,
        cron_expression,
        notify_on_score_drop,
        score_threshold,
        user_id: user.id,
      });

      // For now, return success (full implementation would persist to database and integrate with scheduler)
      return reply.status(201).send({
        id: scheduleId,
        organization_id: orgId,
        url,
        name,
        cron_expression,
        notify_on_score_drop,
        score_threshold,
        enabled: true,
        created_at: new Date().toISOString(),
        next_run_at: next_run_at.toISOString(),
      });
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
      const orgId = getOrganizationId(request);

      // Feature #465: Use async lookup that checks DB if not in memory
      const result = await getQuickTestResultAsync(runId);
      if (!result) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Quick test run not found',
        });
      }

      // Feature #461: IDOR protection - verify org-scoping
      // Return 404 (not 403) to avoid information disclosure about other orgs' test runs
      if (result.orgId && result.orgId !== orgId) {
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
