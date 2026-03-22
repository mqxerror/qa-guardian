/**
 * Analytics Routes - Index
 *
 * Thin orchestrator that registers all analytics sub-route modules.
 * Split from monolithic analytics.ts for maintainability.
 *
 * Sub-modules:
 * - analytics-dashboard.ts: Dashboard summary, stats, and basic statistics
 * - analytics-tests.ts: Failing tests and browser-specific stats
 * - analytics-trends.ts: Pass rate, accessibility, and duration trends
 * - analytics-comparison.ts: Project comparison and branch comparison
 *
 * Feature #1356: Code quality - extracted from analytics.ts
 */

import { FastifyInstance } from 'fastify';
import { analyticsDashboardRoutes } from './analytics-dashboard.js';
import { analyticsTestRoutes } from './analytics-tests.js';
import { analyticsTrendRoutes } from './analytics-trends.js';
import { analyticsComparisonRoutes } from './analytics-comparison.js';

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  await analyticsDashboardRoutes(app);
  await analyticsTestRoutes(app);
  await analyticsTrendRoutes(app);
  await analyticsComparisonRoutes(app);
}
