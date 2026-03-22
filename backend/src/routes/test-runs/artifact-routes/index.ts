/**
 * Artifact Routes - Index
 *
 * Thin orchestrator that registers all artifact sub-route modules.
 * Split from monolithic artifact-routes.ts for maintainability.
 *
 * Sub-modules:
 * - artifact-file-serving.ts: Direct file serving (traces, videos by filename)
 * - artifact-listing.ts: Artifact listing and screenshots listing
 * - artifact-images.ts: Screenshot/baseline/diff serving (binary + base64) + video/trace metadata
 * - artifact-download.ts: Bulk ZIP download
 * - artifact-cleanup.ts: Delete artifacts + storage stats
 *
 * Feature #1356: Code quality - extracted from test-runs.ts
 * Feature #245: Types and helpers extracted to artifact-types.ts
 */

import { FastifyInstance } from 'fastify';
import { artifactFileServingRoutes } from './artifact-file-serving.js';
import { artifactListingRoutes } from './artifact-listing.js';
import { artifactImageRoutes } from './artifact-images.js';
import { artifactDownloadRoutes } from './artifact-download.js';
import { artifactCleanupRoutes } from './artifact-cleanup.js';

export async function artifactRoutes(app: FastifyInstance): Promise<void> {
  await artifactFileServingRoutes(app);
  await artifactListingRoutes(app);
  await artifactImageRoutes(app);
  await artifactDownloadRoutes(app);
  await artifactCleanupRoutes(app);
}
