// Test Suites Routes - Re-exports from modular implementation
// This file maintains backward compatibility while the implementation is split into modules

// Re-export all types (must use 'export type' for ESM compatibility with Node.js 20+)
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
} from './test-suites/types.js';

// Re-export stores (async functions only - Maps removed in Feature #2110)
// Use async functions: getTestSuite(), getTest(), listAllTestSuites(), listAllTests()
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
} from './test-suites/stores.js';

// Re-export utility functions
export { generatePlaywrightCode, stepToPlaywrightCode } from './test-suites/utils.js';

// Re-export main routes function
export { testSuiteRoutes } from './test-suites/index.js';
