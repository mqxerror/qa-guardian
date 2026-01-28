// Test Suites Module - Data Stores
//
// This module provides data access for test suites and tests with database persistence.
// PostgreSQL is REQUIRED - memory fallback has been removed.
//
// Feature #2111: Proxy Map exports REMOVED. Only async DB functions exported.
// All data access must use async functions: getTestSuite(), getTest(), listAllTestSuites(), listAllTests()

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

// ===== ASYNC DATABASE FUNCTIONS =====
// All data access goes through these async functions

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
