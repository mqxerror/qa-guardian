// Test Suites Module - Data Stores
//
// This module provides data access for test suites and tests with database persistence.
// Primary storage is PostgreSQL with memory fallback for development.
// Backward-compatible Map exports are provided for files not yet migrated to async.

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
  getMemoryTestSuites,
  getMemoryTests,
} from '../../services/repositories/test-suites';

// ===== BACKWARD COMPATIBILITY =====
// These export the memory stores for synchronous code not yet migrated to async
// In development (no database), these are the primary storage
// In production (with database), these are only used as fallback
export const testSuites: Map<string, TestSuite> = getMemoryTestSuites();
export const tests: Map<string, Test> = getMemoryTests();

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
