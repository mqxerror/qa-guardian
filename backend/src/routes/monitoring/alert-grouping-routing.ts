/**
 * Alert Grouping and Routing Routes Module
 *
 * This file has been split into:
 * - alert-grouping.ts: Alert grouping rules, groups, history
 * - alert-routing.ts: Alert routing rules, simulation, rate limiting
 *
 * This module re-exports both for backwards compatibility.
 *
 * Feature #248: Split alert-grouping-routing.ts for maintainability
 */

import { FastifyInstance } from 'fastify';
import { alertGroupingRoutes } from './alert-grouping.js';
import { alertRoutingRoutes } from './alert-routing.js';

// Re-export individual route modules for direct access
export { alertGroupingRoutes } from './alert-grouping.js';
export { alertRoutingRoutes } from './alert-routing.js';

/**
 * Combined alert grouping and routing routes function.
 * Registers both alert grouping and alert routing route modules.
 * Kept for backwards compatibility.
 */
export async function alertGroupingRoutingRoutes(app: FastifyInstance): Promise<void> {
  await alertGroupingRoutes(app);
  await alertRoutingRoutes(app);
}
