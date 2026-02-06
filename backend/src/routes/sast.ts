/**
 * SAST Routes - Re-exports from modular implementation
 *
 * This file maintains backward compatibility while the implementation is split into modules.
 * All types, stores, and routes are now in the ./sast/ directory.
 *
 * Feature #1376: Split sast.ts into modules
 * Feature #1565: Added secret verification routes
 * Feature #1566: Added secret remediation routes
 */

import { FastifyInstance } from 'fastify';

// Re-export all types and stores for backward compatibility
export * from './sast/types';
export * from './sast/stores';

// Import route modules
import {
  coreRoutes,
  customRulesRoutes,
  falsePositivesRoutes,
  prIntegrationRoutes,
  gitleaksRoutes,
  secretPatternsRoutes,  // Feature #1558
  secretVerificationRoutes,  // Feature #1565
  secretRemediationRoutes,  // Feature #1566
} from './sast/index';

// Combined SAST routes function that registers all sub-routes
export async function sastRoutes(app: FastifyInstance) {
  // Register all route modules
  await coreRoutes(app);
  await customRulesRoutes(app);
  await falsePositivesRoutes(app);
  await prIntegrationRoutes(app);
  await gitleaksRoutes(app);
  await secretPatternsRoutes(app);  // Feature #1558: Custom Gitleaks rules
  await secretVerificationRoutes(app);  // Feature #1565: Real secret verification
  await secretRemediationRoutes(app);  // Feature #1566: Secret remediation guides
}
