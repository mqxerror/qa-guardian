/**
 * Dependency Management Routes
 *
 * Routes for managing dependency allowlists/blocklists, health scores,
 * and dependency age tracking.
 *
 * This module re-exports the split route handlers:
 * - dependency-lists.ts: Features #777, #778, #772 (Allowlist/Blocklist, Health Score, Age Tracking)
 *
 * Feature #777: Dependency Allowlist/Blocklist
 * Feature #778: Dependency Health Score
 * Feature #772: Dependency Age Tracking
 */

import { FastifyInstance } from 'fastify';
import { dependencyListsRoutes } from './dependency-lists.js';

/**
 * Main entry point for dependency management routes
 * Registers dependency lists routes
 */
export async function dependencyManagementRoutes(app: FastifyInstance): Promise<void> {
  // Register dependency lists routes (allowlist/blocklist, health score, age tracking)
  await dependencyListsRoutes(app);
}
