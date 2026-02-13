/**
 * Quick Test Module - History Route
 * Feature #730: Split quick-test/routes.ts into sub-modules
 *
 * Provides GET /api/v1/quick-test/history for paginated quick test run history.
 * Feature #465: PostgreSQL persistence for history endpoint
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../middleware/auth.js';
import {
  validateQuery,
  quickTestHistoryQuerySchema,
} from '../../validation/index.js';
import { getQuickTestHistory } from '../../services/repositories/quick-test.js';

export async function historyRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/quick-test/history
   * Feature #465: Get paginated history of quick test runs for the organization
   * NOTE: This route MUST be registered BEFORE /:runId to avoid path parameter conflict
   */
  // Feature #715: Zod validation for history query
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
      preValidation: [validateQuery(quickTestHistoryQuerySchema)],
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
}
