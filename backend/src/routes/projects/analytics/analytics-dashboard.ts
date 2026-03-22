/**
 * Analytics Routes - Dashboard
 *
 * Dashboard-level aggregate endpoints:
 * - GET /api/v1/dashboard/summary (test health summary for AI chat)
 * - GET /api/v1/dashboard/stats (extended dashboard stats)
 * - GET /api/v1/stats (basic statistics)
 *
 * Feature #1356: Code quality - extracted from analytics.ts
 * Feature #Agent8: Business logic moved to AnalyticsService
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../../middleware/auth.js';
import { analyticsService } from '../../../services/analytics-service.js';

export async function analyticsDashboardRoutes(app: FastifyInstance): Promise<void> {
  // Feature #382: Dashboard summary endpoint for AI chat context
  app.get('/api/v1/dashboard/summary', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const result = await analyticsService.getDashboardSummary(orgId);

    // Guard against timeout middleware having already sent a 504
    if (reply.sent) return;
    return result;
  });

  // Feature #382: Dashboard stats endpoint (alias for MCP resources)
  app.get('/api/v1/dashboard/stats', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const result = await analyticsService.getDashboardStats(orgId);

    // Guard against timeout middleware having already sent a 504
    if (reply.sent) return;
    return result;
  });

  // Get dashboard statistics
  app.get('/api/v1/stats', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const result = await analyticsService.getDashboardStats(orgId);

    // Feature #193: Guard against timeout middleware having already sent a 504
    if (reply.sent) return;

    // /api/v1/stats does not include timestamp (preserves original contract)
    const { timestamp: _timestamp, ...stats } = result;
    return stats;
  });
}
