/**
 * Quick Test Routes Index
 * Feature #424: Export quick test routes for registration in main server
 * Feature #730: Split quick-test/routes.ts into sub-modules
 *
 * @see ./helpers.ts - Shared types and utility functions
 * @see ./core.ts - POST /api/v1/quick-test, GET /api/v1/quick-test/:runId
 * @see ./compare.ts - POST/GET /api/v1/quick-test/compare
 * @see ./schedules.ts - CRUD /api/v1/quick-test/schedules
 * @see ./history.ts - GET /api/v1/quick-test/history
 * @see ./screenshots.ts - GET /api/v1/quick-test/:runId/screenshots/:type
 */

import { FastifyInstance } from 'fastify';
import { coreRoutes } from './core.js';
import { compareRoutes } from './compare.js';
import { scheduleRoutes } from './schedules.js';
import { historyRoutes } from './history.js';
import { screenshotRoutes } from './screenshots.js';

async function quickTestRoutes(app: FastifyInstance) {
  // Register compare routes first (specific prefix /compare)
  await compareRoutes(app);
  // Register schedule routes (specific prefix /schedules)
  await scheduleRoutes(app);
  // Register history route BEFORE core to avoid /:runId matching "history"
  await historyRoutes(app);
  // Register core routes (POST / and GET /:runId)
  await coreRoutes(app);
  // Register screenshot routes (GET /:runId/screenshots/:type)
  await screenshotRoutes(app);
}

export { quickTestRoutes };
export default quickTestRoutes;
