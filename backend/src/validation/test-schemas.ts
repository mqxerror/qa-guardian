/**
 * Test & Test Suite Validation Schemas
 * Extracted from schemas.ts - test CRUD, suite CRUD, steps, reorder
 */

import { z } from 'zod';
import { uuidSchema } from './common-schemas.js';

// ============================================================================
// Test Suite Schemas
// ============================================================================

/**
 * Test suite type enum
 */
export const suiteTypeSchema = z.enum([
  'e2e',
  'visual_regression',
  'lighthouse',
  'load',
  'accessibility',
]);

/**
 * Create test suite request body
 */
export const createTestSuiteSchema = z.object({
  name: z
    .string()
    .min(1, 'Suite name is required')
    .max(255, 'Suite name must be less than 255 characters'),
  description: z
    .string()
    .max(2000, 'Description must be less than 2000 characters')
    .optional(),
  type: suiteTypeSchema.default('e2e'),
  project_id: uuidSchema,
  config: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Update test suite request body
 */
export const updateTestSuiteSchema = createTestSuiteSchema.omit({ project_id: true }).partial();

/**
 * Test suite ID parameter
 */
export const suiteIdParamsSchema = z.object({
  id: uuidSchema,
});

// ============================================================================
// Test Schemas
// ============================================================================

/**
 * Create test request body
 */
export const createTestSchema = z.object({
  name: z
    .string()
    .min(1, 'Test name is required')
    .max(255, 'Test name must be less than 255 characters'),
  description: z
    .string()
    .max(5000, 'Description must be less than 5000 characters')
    .optional(),
  type: suiteTypeSchema.default('e2e'),
  suite_id: uuidSchema,
  code: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(0),
});

/**
 * Update test request body
 */
export const updateTestSchema = createTestSchema.omit({ suite_id: true }).partial();

/**
 * Test ID parameter
 */
export const testIdParamsSchema = z.object({
  id: uuidSchema,
});

// ============================================================================
// Feature #714: Test Suite Route Schemas
// ============================================================================

/**
 * Project ID parameter for suite routes
 */
export const suiteProjectParamsSchema = z.object({
  projectId: uuidSchema,
});

/**
 * Suite ID parameter
 */
export const suiteParamsSchema = z.object({
  suiteId: uuidSchema,
});

/**
 * Test ID parameter
 */
export const testParamsSchema = z.object({
  testId: uuidSchema,
});

/**
 * Test step params (testId + stepId)
 */
export const testStepParamsSchema = z.object({
  testId: uuidSchema,
  stepId: uuidSchema,
});

/**
 * Pagination query for suites/tests lists
 */
export const listPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Test code format query
 */
export const testCodeQuerySchema = z.object({
  format: z.enum(['typescript', 'javascript']).default('typescript'),
});

/**
 * Reorder steps request body
 */
export const reorderStepsSchema = z.object({
  steps: z.array(z.object({
    id: z.string(),
    action: z.string(),
    selector: z.string().optional(),
    value: z.string().optional(),
    order: z.number().int().optional(),
  })),
});

/**
 * Add step request body
 */
export const addStepSchema = z.object({
  action: z.string().min(1, 'Action is required'),
  selector: z.string().optional(),
  value: z.string().optional(),
  index: z.number().int().min(0).optional(),
});

/**
 * Update step request body
 */
export const updateStepSchema = z.object({
  action: z.string().optional(),
  selector: z.string().optional(),
  value: z.string().optional(),
});

/**
 * Reorder tests request body
 */
export const reorderTestsSchema = z.object({
  test_ids: z.array(uuidSchema).min(1, 'At least one test ID is required'),
});

// ============================================================================
// Step Templates
// ============================================================================

/**
 * Step template routes
 */
export const stepTemplateIdParamsSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
});

export const createStepTemplateBodySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(1000).optional(),
  steps: z.array(z.record(z.unknown())).min(1, 'At least one step is required'),
  tags: z.array(z.string()).optional(),
  suite_id: z.string().optional(),
});

export const updateStepTemplateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  steps: z.array(z.record(z.unknown())).optional(),
  tags: z.array(z.string()).optional(),
  suite_id: z.string().optional(),
});

export const stepTemplatesQuerySchema = z.object({
  suite_id: z.string().optional(),
  search: z.string().optional(),
});

// ============================================================================
// Test Suite Review
// ============================================================================

/**
 * Review test body
 */
export const reviewTestBodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().max(5000).optional(),
});

/**
 * Bulk review body
 */
export const bulkReviewBodySchema = z.object({
  test_ids: z.array(z.string().min(1)).min(1),
  action: z.enum(['approve', 'reject']),
  notes: z.string().max(5000).optional(),
});

/**
 * Suite review settings body
 */
export const suiteReviewSettingsBodySchema = z.object({
  require_human_review: z.boolean(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateTestSuiteInput = z.infer<typeof createTestSuiteSchema>;
export type UpdateTestSuiteInput = z.infer<typeof updateTestSuiteSchema>;
export type CreateTestInput = z.infer<typeof createTestSchema>;
export type UpdateTestInput = z.infer<typeof updateTestSchema>;
export type SuiteProjectParams = z.infer<typeof suiteProjectParamsSchema>;
export type SuiteParams = z.infer<typeof suiteParamsSchema>;
export type TestParams = z.infer<typeof testParamsSchema>;
export type TestStepParams = z.infer<typeof testStepParamsSchema>;
export type ListPaginationQuery = z.infer<typeof listPaginationQuerySchema>;
export type TestCodeQuery = z.infer<typeof testCodeQuerySchema>;
export type ReorderStepsInput = z.infer<typeof reorderStepsSchema>;
export type AddStepInput = z.infer<typeof addStepSchema>;
export type UpdateStepInput = z.infer<typeof updateStepSchema>;
export type ReorderTestsInput = z.infer<typeof reorderTestsSchema>;
export type StepTemplateIdParams = z.infer<typeof stepTemplateIdParamsSchema>;
export type CreateStepTemplateBodyInput = z.infer<typeof createStepTemplateBodySchema>;
export type UpdateStepTemplateBodyInput = z.infer<typeof updateStepTemplateBodySchema>;
