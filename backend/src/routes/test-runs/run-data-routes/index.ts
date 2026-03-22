/**
 * Run Data Routes - Index
 *
 * Thin orchestrator that registers all run data sub-route modules.
 * Split from monolithic run-data-routes.ts for maintainability.
 *
 * Sub-modules:
 * - run-logs.ts: Console logs, console output, network logs
 * - run-metrics.ts: Performance metrics for a test run
 * - run-environment.ts: Environment variable CRUD (set/get/delete)
 * - run-comparison.ts: General run comparison and K6 load test comparison
 *
 * Feature #1356: Code quality - extracted from run-data-routes.ts
 */

import { FastifyInstance } from 'fastify';
import { runLogRoutes } from './run-logs.js';
import { runMetricRoutes } from './run-metrics.js';
import { runEnvironmentRoutes } from './run-environment.js';
import { runComparisonRoutes } from './run-comparison.js';

export async function runDataRoutes(app: FastifyInstance): Promise<void> {
  await runLogRoutes(app);
  await runMetricRoutes(app);
  await runEnvironmentRoutes(app);
  await runComparisonRoutes(app);
}
