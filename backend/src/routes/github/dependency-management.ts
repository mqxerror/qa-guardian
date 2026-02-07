/**
 * Dependency Management Routes
 *
 * Routes for managing dependency allowlists/blocklists, health scores,
 * auto-PR for dependency updates, and dependency age tracking.
 *
 * This module re-exports the split route handlers:
 * - dependency-lists.ts: Features #777, #778, #772 (Allowlist/Blocklist, Health Score, Age Tracking)
 * - dependency-auto-pr.ts: Feature #771 (Auto-PR for Dependency Updates)
 *
 * Feature #777: Dependency Allowlist/Blocklist
 * Feature #778: Dependency Health Score
 * Feature #771: Auto-PR for Dependency Updates
 * Feature #772: Dependency Age Tracking
 */

import { FastifyInstance } from 'fastify';
import { dependencyListsRoutes } from './dependency-lists.js';
import { dependencyAutoPRRoutes } from './dependency-auto-pr.js';

/**
 * Main entry point for dependency management routes
 * Registers both dependency lists and auto-PR routes
 */
export async function dependencyManagementRoutes(app: FastifyInstance): Promise<void> {
  // Register dependency lists routes (allowlist/blocklist, health score, age tracking)
  await dependencyListsRoutes(app);

  // Register auto-PR routes
  await dependencyAutoPRRoutes(app);
}
