// Test Suites Routes - Re-exports from modular implementation
// This file maintains backward compatibility while the implementation is split into modules

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
} from './test-suites/types';

// Re-export stores (both Maps for backward compat and async functions)
export {
  testSuites,
  tests,
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
} from './test-suites/stores';

// Re-export utility functions
export { generatePlaywrightCode, stepToPlaywrightCode } from './test-suites/utils';

// Re-export main routes function
export { testSuiteRoutes } from './test-suites/index';
