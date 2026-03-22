/**
 * Run Data Routes - Shared Helpers & Types
 *
 * Common utilities and type definitions used across run data sub-route modules.
 *
 * Feature #1356: Code quality - extracted from run-data-routes.ts
 */

import { testRuns, TestRun } from '../execution.js';
import { getTestRun as dbGetTestRun } from '../../../services/repositories/test-runs.js';

// Helper: get test run from Map first, then fall back to DB
export async function getTestRunWithFallback(runId: string): Promise<TestRun | undefined> {
  const fromMap = testRuns.get(runId);
  if (fromMap) return fromMap;
  return await dbGetTestRun(runId) as TestRun | undefined;
}

// Type definitions
export interface TestRunParams {
  runId: string;
}

export interface GetRunLogsQuery {
  level?: 'all' | 'error' | 'warn' | 'info' | 'debug' | 'log';
  limit?: number;
  offset?: number;
}

export interface SetRunEnvVarsBody {
  env_vars: Record<string, string>;
  merge?: boolean;
}

export interface DeleteRunEnvVarsBody {
  keys?: string[];
}
