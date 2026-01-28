// Test Suites Module - Map Declarations
// Feature #2100: Extracted Map instances to separate file to break circular dependencies.
// index.ts → route files → index.ts circular import is broken by having Maps here.
//
// DEPRECATED: These Maps are empty stubs for backward compatibility.
// All data access should use async DB functions from ./stores instead.

import { TestSuite, Test } from './types';

// DEPRECATED: Empty Map exports for backward compatibility until route migration (#2115)
// These return empty Maps - consumers must migrate to async DB functions
export const testSuites = new Map<string, TestSuite>();
export const tests = new Map<string, Test>();
