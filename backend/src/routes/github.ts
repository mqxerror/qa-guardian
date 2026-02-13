/**
 * GitHub Routes - Re-exports from modular implementation
 *
 * This file maintains backward compatibility while the implementation is split into modules.
 * All types, stores, and routes are now in the ./github/ directory.
 *
 * Feature #1375: Split github.ts into modules
 * Feature #1542: Added AI best practices routes
 * Feature #862: Removed dependency-management (dead code after page cuts)
 *
 * @see ./github/types.ts - Type definitions
 * @see ./github/stores.ts - In-memory data stores and demo data
 * @see ./github/core.ts - Core GitHub OAuth and repository routes
 * @see ./github/dependency-scanning.ts - PR dependency scanning
 * @see ./github/vulnerability-tracking.ts - All-dependencies endpoint
 * @see ./github/ai-providers.ts - Kie.ai, Anthropic, AI provider router routes
 * @see ./github/ai-test-generation.ts - AI test generation routes
 * @see ./github/natural-language-tests.ts - Natural language test generation routes
 * @see ./github/ai-analysis.ts - AI analysis, vision, and screenshot routes
 * @see ./github/ai-best-practices.ts - AI best practices analysis routes
 */

import { FastifyInstance } from 'fastify';

// Re-export all types and stores for backward compatibility
export * from './github/types.js';
export * from './github/stores.js';

// Import route modules
import {
  coreGithubRoutes,
  dependencyScanningRoutes,
  vulnerabilityTrackingRoutes,
  aiProviderRoutes,
  aiTestGenerationRoutes,
  naturalLanguageTestRoutes,
  aiAnalysisRoutes,
  aiBestPracticesRoutes,
  githubWebhookRoutes, // Feature #272: Auto-trigger dependency scan on PR
  aiCostAnalyticsRoutes, // Feature #313: AI cost analytics routes
} from './github/index.js';

// Combined GitHub routes function that registers all sub-routes
export async function githubRoutes(app: FastifyInstance) {
  // Register all route modules
  await coreGithubRoutes(app);
  await dependencyScanningRoutes(app);
  await vulnerabilityTrackingRoutes(app);
  await aiProviderRoutes(app);
  await aiTestGenerationRoutes(app);
  await naturalLanguageTestRoutes(app);
  await aiAnalysisRoutes(app);
  await aiBestPracticesRoutes(app);
  await githubWebhookRoutes(app); // Feature #272: Auto-trigger dependency scan on PR
  await aiCostAnalyticsRoutes(app); // Feature #313: AI cost analytics routes
}
