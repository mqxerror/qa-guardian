// Test Suites Module - Data Stores
//
// This module provides data access for test suites and tests with database persistence.
// PostgreSQL is REQUIRED - memory fallback has been removed (Feature #2100).
//
// Feature #2103: Deprecated Map exports are kept for backward compatibility but
// return empty Maps. These will be removed in Feature #2106 when all route files
// have been migrated to use async functions.

import { TestSuite, Test } from './types';

// Import repository functions for database access
import {
  createTestSuite as dbCreateTestSuite,
  getTestSuite as dbGetTestSuite,
  updateTestSuite as dbUpdateTestSuite,
  deleteTestSuite as dbDeleteTestSuite,
  listTestSuites as dbListTestSuites,
  listAllTestSuites as dbListAllTestSuites,
  createTest as dbCreateTest,
  getTest as dbGetTest,
  updateTest as dbUpdateTest,
  deleteTest as dbDeleteTest,
  listTests as dbListTests,
  listAllTests as dbListAllTests,
  getTestSuitesMap,
  getTestsMap,
} from '../../services/repositories/test-suites';

// ===== DEPRECATED MAP EXPORTS =====
// WARNING: These Maps are EMPTY and DEPRECATED!
// They return empty Maps for backward compatibility during migration.
// Use async functions instead: getTestSuite(), listAllTestSuites(), getTest(), listAllTests()
// These exports will be REMOVED in Feature #2106.

let deprecationWarned = false;
function warnDeprecation() {
  if (!deprecationWarned) {
    console.warn('[DEPRECATED] testSuites and tests Map exports are deprecated and return empty data.');
    console.warn('[DEPRECATED] Use async functions instead: getTestSuite(), listAllTestSuites(), getTest(), listAllTests()');
    deprecationWarned = true;
  }
}

// Create empty Maps with deprecation warning
const emptyTestSuitesMap = new Map<string, TestSuite>();
const emptyTestsMap = new Map<string, Test>();

// Wrap with proxy to log deprecation warning on first access
export const testSuites: Map<string, TestSuite> = new Proxy(emptyTestSuitesMap, {
  get(target, prop) {
    warnDeprecation();
    return Reflect.get(target, prop);
  }
});

export const tests: Map<string, Test> = new Proxy(emptyTestsMap, {
  get(target, prop) {
    warnDeprecation();
    return Reflect.get(target, prop);
  }
});

// ===== ASYNC DATABASE FUNCTIONS =====
// Use these functions for all new code

// Test Suites CRUD
export const createTestSuite = dbCreateTestSuite;
export const getTestSuite = dbGetTestSuite;
export const updateTestSuite = dbUpdateTestSuite;
export const deleteTestSuite = dbDeleteTestSuite;
export const listTestSuites = dbListTestSuites;
export const listAllTestSuites = dbListAllTestSuites;

// Tests CRUD
export const createTest = dbCreateTest;
export const getTest = dbGetTest;
export const updateTest = dbUpdateTest;
export const deleteTest = dbDeleteTest;
export const listTests = dbListTests;
export const listAllTests = dbListAllTests;

// Async Map accessors for backward compatibility
export { getTestSuitesMap, getTestsMap };
