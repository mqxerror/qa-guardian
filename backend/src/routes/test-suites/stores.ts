// Test Suites Module - Data Stores
//
// This module provides data access for test suites and tests with database persistence.
// PostgreSQL is REQUIRED - memory fallback has been removed (Feature #2100).
//
// Feature #2103: Map exports are DEPRECATED - they return empty Maps.
// Use async functions instead: getTestSuite(), getTest(), listAllTestSuites(), listAllTests()

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
// WARNING: These Maps return EMPTY data and are DEPRECATED!
// Use async functions instead for database access.
// These will be removed when all route files are migrated (Feature #2104).

let deprecationWarned = false;
function warnDeprecation() {
  if (!deprecationWarned) {
    console.warn('[DEPRECATED] testSuites and tests Map exports return empty data.');
    console.warn('[DEPRECATED] Use async functions: getTestSuite(), getTest(), listAllTestSuites(), listAllTests()');
    deprecationWarned = true;
  }
}

// Create empty Maps with Proxy to log deprecation warning
const emptyTestSuitesMap = new Map<string, TestSuite>();
const emptyTestsMap = new Map<string, Test>();

export const testSuites: Map<string, TestSuite> = new Proxy(emptyTestSuitesMap, {
  get(target, prop) {
    warnDeprecation();
    const val = Reflect.get(target, prop); return typeof val === "function" ? val.bind(target) : val;
  }
});

export const tests: Map<string, Test> = new Proxy(emptyTestsMap, {
  get(target, prop) {
    warnDeprecation();
    const val = Reflect.get(target, prop); return typeof val === "function" ? val.bind(target) : val;
  }
});

// ===== ASYNC DATABASE FUNCTIONS =====
// Use these functions for all data access

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

// Async Map accessors (return Promise<Map>)
export { getTestSuitesMap, getTestsMap };
