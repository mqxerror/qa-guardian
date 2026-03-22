/**
 * Flaky Tests Routes - Index
 *
 * Thin orchestrator that registers all flaky test sub-route modules.
 * Split from monolithic flaky-tests.ts for maintainability.
 *
 * Sub-modules:
 * - flaky-queries.ts: GET endpoints (flaky list, trend, impact report, quarantined list)
 * - flaky-mutations.ts: POST endpoints (quarantine, unquarantine, auto-quarantine check)
 *
 * Feature #1356: Code quality - extracted from flaky-tests.ts
 */

import { FastifyInstance } from 'fastify';
import { flakyQueryRoutes } from './flaky-queries.js';
import { flakyMutationRoutes } from './flaky-mutations.js';

export async function flakyTestsRoutes(app: FastifyInstance): Promise<void> {
  await flakyQueryRoutes(app);
  await flakyMutationRoutes(app);
}
