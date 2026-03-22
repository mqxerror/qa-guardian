/**
 * Analytics Routes - Trends
 *
 * Time-series trend endpoints:
 * - GET /api/v1/analytics/pass-rate-trends (pass rate over time)
 * - GET /api/v1/analytics/accessibility-trends (a11y violations over time)
 * - GET /api/v1/analytics/duration-trends (duration percentiles over time)
 *
 * Feature #1356: Code quality - extracted from analytics.ts
 * Feature #Agent8: Business logic moved to AnalyticsService
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../../middleware/auth.js';
import { analyticsService } from '../../../services/analytics-service.js';

export async function analyticsTrendRoutes(app: FastifyInstance): Promise<void> {
  // Get pass rate trends over time
  app.get<{ Querystring: { days?: string; project_id?: string } }>('/api/v1/analytics/pass-rate-trends', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const { days: daysParam, project_id: projectIdFilter } = request.query;
    const days = parseInt(daysParam || '7', 10);

    if (days < 1 || days > 90) {
      return {
        error: 'Bad Request',
        message: 'Days parameter must be between 1 and 90',
      };
    }

    return analyticsService.getPassRateTrends(orgId, { days, projectId: projectIdFilter });
  });

  // Get accessibility trends over time
  app.get<{ Querystring: { days?: string; project_id?: string } }>('/api/v1/analytics/accessibility-trends', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const { days: daysParam, project_id: projectIdFilter } = request.query;
    const days = parseInt(daysParam || '7', 10);

    if (days < 1 || days > 90) {
      return {
        error: 'Bad Request',
        message: 'Days parameter must be between 1 and 90',
      };
    }

    return analyticsService.getAccessibilityTrends(orgId, { days, projectId: projectIdFilter });
  });

  // Get duration trends with p50/p95/p99 percentiles
  app.get<{
    Querystring: {
      days?: string;
      project_id?: string;
      browser?: string;
      test_type?: string;
    };
  }>('/api/v1/analytics/duration-trends', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const { days: daysParam, project_id: projectIdFilter, browser: browserFilter, test_type: testTypeFilter } = request.query;
    const days = parseInt(daysParam || '7', 10);

    if (days < 1 || days > 90) {
      return {
        error: 'Bad Request',
        message: 'Days parameter must be between 1 and 90',
      };
    }

    return analyticsService.getDurationTrends(orgId, {
      days,
      projectId: projectIdFilter,
      browser: browserFilter,
      testType: testTypeFilter,
    });
  });
}
