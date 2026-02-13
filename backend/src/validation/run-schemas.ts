/**
 * Test Run Validation Schemas
 * Extracted from schemas.ts - run CRUD, run control, run data, run trigger
 */

import { z } from 'zod';
import { uuidSchema, paginationSchema } from './common-schemas.js';
import { suiteTypeSchema } from './test-schemas.js';

// ============================================================================
// Test Run Schemas
// ============================================================================

/**
 * Test run status enum
 */
export const runStatusSchema = z.enum([
  'pending',
  'running',
  'passed',
  'failed',
  'cancelled',
  'error',
]);

/**
 * Browser enum
 */
export const browserSchema = z.enum(['chromium', 'firefox', 'webkit']);

/**
 * Create test run request body
 */
export const createTestRunSchema = z.object({
  test_id: uuidSchema.optional(),
  suite_id: uuidSchema.optional(),
  project_id: uuidSchema.optional(),
  browser: browserSchema.default('chromium'),
  branch: z.string().max(255).default('main'),
  test_type: suiteTypeSchema.optional(),
  viewport: z.object({
    width: z.number().int().min(320).max(3840),
    height: z.number().int().min(240).max(2160),
  }).optional(),
  priority: z.number().int().min(0).max(100).default(100),
  triggered_by: z.string().max(100).optional(),
  run_env_vars: z.record(z.string()).optional(),
});

/**
 * Update test run request body
 */
export const updateTestRunSchema = z.object({
  status: runStatusSchema.optional(),
  results: z.array(z.record(z.unknown())).optional(),
  metrics: z.record(z.unknown()).optional(),
  error_message: z.string().max(5000).optional(),
  duration_ms: z.number().int().min(0).optional(),
});

/**
 * Test run ID parameter
 */
export const runIdParamsSchema = z.object({
  id: uuidSchema,
});

/**
 * Test run filters query
 */
export const runFiltersQuerySchema = paginationSchema.extend({
  status: runStatusSchema.optional(),
  test_id: uuidSchema.optional(),
  suite_id: uuidSchema.optional(),
  project_id: uuidSchema.optional(),
  browser: browserSchema.optional(),
  branch: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// ============================================================================
// Feature #732: Run Control
// ============================================================================

/**
 * Run ID params (shared across run-control, run-data, etc.)
 */
export const runIdParamSchema = z.object({
  runId: z.string().min(1, 'Run ID is required'),
});

/**
 * Cancel run body
 */
export const cancelRunBodySchema = z.object({
  force: z.boolean().optional(),
  save_partial_results: z.boolean().optional(),
  reason: z.string().max(1000).optional(),
});

/**
 * Prioritize run body
 */
export const prioritizeRunBodySchema = z.object({
  priority: z.number().int().min(1).max(1000),
});

// ============================================================================
// Run Data
// ============================================================================

/**
 * Run logs query params
 */
export const runLogsQuerySchema = z.object({
  level: z.enum(['all', 'error', 'warn', 'info', 'debug', 'log']).optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * Set run environment variables body
 */
export const setRunEnvVarsBodySchema = z.object({
  env_vars: z.record(z.string()),
  merge: z.boolean().optional(),
});

/**
 * Delete run environment variables body
 */
export const deleteRunEnvVarsBodySchema = z.object({
  keys: z.array(z.string()).optional(),
});

/**
 * Compare runs query params
 */
export const compareRunsQuerySchema = z.object({
  baseRunId: z.string().min(1, 'baseRunId is required'),
  compareRunId: z.string().min(1, 'compareRunId is required'),
});

/**
 * Run result params (runId + testId)
 */
export const runResultParamsSchema = z.object({
  runId: z.string().min(1),
  testId: z.string().min(1),
});

// ============================================================================
// Run Trigger
// ============================================================================

/**
 * Suite run trigger params
 */
export const suiteRunParamsSchema = z.object({
  suiteId: z.string().min(1, 'Suite ID is required'),
});

/**
 * Test run trigger params
 */
export const testRunTriggerParamsSchema = z.object({
  testId: z.string().min(1, 'Test ID is required'),
});

/**
 * Run trigger body
 */
export const runTriggerBodySchema = z.object({
  browser: z.enum(['chromium', 'firefox', 'webkit']).optional(),
  branch: z.string().max(255).optional(),
});

/**
 * Rerun body
 */
export const rerunBodySchema = z.object({
  suite_id: z.string().min(1, 'Suite ID is required'),
  test_ids: z.array(z.string().min(1)).min(1, 'At least one test ID is required'),
  browser: z.enum(['chromium', 'firefox', 'webkit']).optional(),
  branch: z.string().max(255).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateTestRunInput = z.infer<typeof createTestRunSchema>;
export type UpdateTestRunInput = z.infer<typeof updateTestRunSchema>;
export type RunFiltersQuery = z.infer<typeof runFiltersQuerySchema>;
export type CancelRunBody = z.infer<typeof cancelRunBodySchema>;
export type PrioritizeRunBody = z.infer<typeof prioritizeRunBodySchema>;
export type SetRunEnvVarsBody = z.infer<typeof setRunEnvVarsBodySchema>;
export type DeleteRunEnvVarsBody = z.infer<typeof deleteRunEnvVarsBodySchema>;
export type RunTriggerBody = z.infer<typeof runTriggerBodySchema>;
export type RerunBody = z.infer<typeof rerunBodySchema>;
