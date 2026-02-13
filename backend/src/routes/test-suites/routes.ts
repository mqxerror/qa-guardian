/**
 * Test Suites Module - Core CRUD Routes
 * Feature #730: Split into sub-modules for maintainability
 *
 * This file maintains backward compatibility by delegating to sub-modules.
 * All route implementations are now in:
 * @see ./suite-crud.ts - Suite CRUD and test listing
 * @see ./test-crud.ts - Test CRUD operations
 * @see ./test-steps.ts - Test step management and test reordering
 */

import { FastifyInstance } from 'fastify';
import { suiteCrudRoutes } from './suite-crud.js';
import { testCrudRoutes } from './test-crud.js';
import { testStepsRoutes } from './test-steps.js';

export async function coreRoutes(app: FastifyInstance) {
  await suiteCrudRoutes(app);
  await testCrudRoutes(app);
  await testStepsRoutes(app);
}
