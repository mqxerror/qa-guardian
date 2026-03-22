/**
 * Analytics Routes - Comparison
 *
 * Cross-entity comparison endpoints:
 * - GET /api/v1/analytics/project-comparison (compare projects)
 * - GET /api/v1/analytics/branch-comparison (compare branches)
 *
 * Feature #1356: Code quality - extracted from analytics.ts
 * Feature #Agent8: Business logic moved to AnalyticsService
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../../middleware/auth.js';
import { analyticsService } from '../../../services/analytics-service.js';

export async function analyticsComparisonRoutes(app: FastifyInstance): Promise<void> {
  // Get project comparison statistics
  app.get('/api/v1/analytics/project-comparison', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const projectStats = await analyticsService.getProjectComparison(orgId);
    return { projects: projectStats };
  });

  // Feature #476: Branch-to-Branch Test Result Comparison
  app.get<{
    Querystring: {
      branchA?: string;
      branchB?: string;
    };
  }>('/api/v1/analytics/branch-comparison', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const { branchA, branchB } = request.query;
    return analyticsService.getBranchComparison(orgId, branchA, branchB);
  });
}
