// Test Suites Module - Data Stores
//
// This module provides data access for test suites and tests with database persistence.
// It maintains backward compatibility with Map-based access while adding
// async database operations for persistent storage.

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
  getMemoryTestSuites,
  getMemoryTests,
} from '../../services/repositories/test-suites';

// Export memory stores for backward compatibility with synchronous code
// These are still used by code that hasn't been migrated to async yet
export const testSuites: Map<string, TestSuite> = getMemoryTestSuites();
export const tests: Map<string, Test> = getMemoryTests();

// ===== ASYNC DATABASE FUNCTIONS =====
// Use these functions for new code or when migrating to persistent storage

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
