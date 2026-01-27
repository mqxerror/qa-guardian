// Test Suites Module - Data Stores
// In-memory stores for test suites and tests

import { TestSuite, Test } from './types';

// In-memory stores
export const testSuites: Map<string, TestSuite> = new Map();
export const tests: Map<string, Test> = new Map();
