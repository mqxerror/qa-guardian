/**
 * Analytics Routes - Test Analytics
 *
 * Test-level analytics endpoints:
 * - GET /api/v1/analytics/failing-tests (most failing tests)
 * - GET /api/v1/analytics/browser-stats (browser-specific pass rates)
 *
 * Feature #1356: Code quality - extracted from analytics.ts
 * Feature #Agent8: Business logic moved to AnalyticsService
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../../middleware/auth.js';
import { analyticsService } from '../../../services/analytics-service.js';

export async function analyticsTestRoutes(app: FastifyInstance): Promise<void> {
  // Get most failing tests
  app.get('/api/v1/analytics/failing-tests', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const failingTests = await analyticsService.getFailingTests(orgId);
    return { failing_tests: failingTests };
  });

  // Get browser-specific pass rates
  app.get('/api/v1/analytics/browser-stats', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const stats = await analyticsService.getBrowserStats(orgId);
    return { browser_stats: stats };
  });
}
