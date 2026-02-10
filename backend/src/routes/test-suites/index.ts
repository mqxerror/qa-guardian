// Test Suites Module - Main Index
// Re-exports all types, stores, utilities, and routes from modular files

import { FastifyInstance } from 'fastify';

// Re-export all types (using type-only exports for interfaces)
export type {
  K6Threshold,
  TestSuite,
  Test,
  IgnoreRegion,
  TestStep,
  ProjectParams,
  SuiteParams,
  TestParams,
  CreateSuiteBody,
  CreateTestBody,
  UpdateTestBody,
} from './types.js';

// Re-export stores (Feature #2111: Proxy Map exports removed, async functions only)
export {
  createTestSuite,
  getTestSuite,
  updateTestSuite,
  deleteTestSuite,
  listTestSuites,
  listAllTestSuites,
  createTest,
  getTest,
  updateTest,
  deleteTest,
  listTests,
  listAllTests,
  getTestSuitesMap,
  getTestsMap,
} from './stores.js';

// Re-export utility functions
export { generatePlaywrightCode, stepToPlaywrightCode } from './utils.js';

// Re-export AI refine types (using type-only exports for interfaces)
export type { ClarifyingQuestion, AIAnalyzeDescriptionBody, AIRefineTestBody } from './ai-refine.js';

// Import route modules
import { coreRoutes } from './routes.js';
import { healingRoutes } from './healing.js';
import { reviewRoutes } from './review.js';
import { aiGenerationRoutes } from './ai-generation.js';
import { aiSelectorsRoutes } from './ai-selectors.js';
import { aiAssertionsRoutes } from './ai-assertions.js';
import { aiRefineRoutes } from './ai-refine.js';
import { aiFeedbackRoutes } from './ai-feedback.js';
import { aiVariationsRoutes } from './ai-variations.js';
import { aiCoverageRoutes } from './ai-coverage.js';
import { aiHealthMonitoringRoutes } from './ai-health-monitoring.js';

// Combined test suite routes function that registers all sub-routes
export async function testSuiteRoutes(app: FastifyInstance) {
  // Register all route modules
  await coreRoutes(app);
  await healingRoutes(app);
  await reviewRoutes(app);
  await aiGenerationRoutes(app);
  await aiSelectorsRoutes(app);
  await aiAssertionsRoutes(app);
  await aiRefineRoutes(app);
  await aiFeedbackRoutes(app);
  await aiVariationsRoutes(app);
  await aiCoverageRoutes(app);
  await aiHealthMonitoringRoutes(app);
}
