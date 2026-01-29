// Test Suites Module - Main Index
// Re-exports all types, stores, utilities, and routes from modular files

import { FastifyInstance } from 'fastify';

// Re-export all types
export {
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
} from './types';

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
} from './stores';

// Re-export utility functions
export { generatePlaywrightCode, stepToPlaywrightCode } from './utils';

// Re-export AI refine types
export { ClarifyingQuestion, AIAnalyzeDescriptionBody, AIRefineTestBody } from './ai-refine';

// Import route modules
import { coreRoutes } from './routes';
import { healingRoutes } from './healing';
import { reviewRoutes } from './review';
import { aiGenerationRoutes } from './ai-generation';
import { aiSelectorsRoutes } from './ai-selectors';
import { aiAssertionsRoutes } from './ai-assertions';
import { aiRefineRoutes } from './ai-refine';
import { aiFeedbackRoutes } from './ai-feedback';
import { aiVariationsRoutes } from './ai-variations';
import { aiCoverageRoutes } from './ai-coverage';

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
}
