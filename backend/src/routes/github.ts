/**
 * GitHub Routes - Re-exports from modular implementation
 *
 * This file maintains backward compatibility while the implementation is split into modules.
 * All types, stores, and routes are now in the ./github/ directory.
 *
 * Feature #1375: Split github.ts into modules
 * Feature #1542: Added AI best practices routes
 *
 * @see ./github/types.ts - Type definitions
 * @see ./github/stores.ts - In-memory data stores and demo data
 * @see ./github/core.ts - Core GitHub OAuth and repository routes
 * @see ./github/dependency-scanning.ts - PR dependency scanning, alerts, policies
 * @see ./github/dependency-management.ts - Allowlist/blocklist, health score, auto-PR, age tracking
 * @see ./github/vulnerability-tracking.ts - Multi-language support, vulnerability history, exploitability
 * @see ./github/ai-providers.ts - Kie.ai, Anthropic, AI provider router routes
 * @see ./github/ai-test-generation.ts - AI test generation routes
 * @see ./github/natural-language-tests.ts - Natural language test generation routes
 * @see ./github/ai-analysis.ts - AI analysis, vision, and screenshot routes
 * @see ./github/ai-best-practices.ts - AI best practices analysis routes
 */

import { FastifyInstance } from 'fastify';

// Re-export all types and stores for backward compatibility
export * from './github/types';
export * from './github/stores';

// Import route modules
import {
  coreGithubRoutes,
  dependencyScanningRoutes,
  dependencyManagementRoutes,
  vulnerabilityTrackingRoutes,
  aiProviderRoutes,
  aiTestGenerationRoutes,
  naturalLanguageTestRoutes,
  aiAnalysisRoutes,
  aiBestPracticesRoutes,
} from './github/index';

// Combined GitHub routes function that registers all sub-routes
export async function githubRoutes(app: FastifyInstance) {
  // Register all route modules
  await coreGithubRoutes(app);
  await dependencyScanningRoutes(app);
  await dependencyManagementRoutes(app);
  await vulnerabilityTrackingRoutes(app);
  await aiProviderRoutes(app);
  await aiTestGenerationRoutes(app);
  await naturalLanguageTestRoutes(app);
  await aiAnalysisRoutes(app);
  await aiBestPracticesRoutes(app);
}
