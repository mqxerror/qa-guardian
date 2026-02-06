/**
 * Zod Validation Schemas for API Endpoints
 * Feature #122: Runtime request validation with Zod
 *
 * Provides type-safe validation for:
 * - Projects CRUD
 * - Test Suites CRUD
 * - Test Runs creation/update
 * - Common shared schemas
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * UUID validation
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Pagination query parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * Date range filter
 */
export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// ============================================================================
// Project Schemas
// ============================================================================

/**
 * Create project request body
 */
export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(255, 'Project name must be less than 255 characters'),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  description: z
    .string()
    .max(2000, 'Description must be less than 2000 characters')
    .optional(),
  base_url: z
    .string()
    .url('Invalid URL format')
    .optional()
    .nullable(),
  settings: z.record(z.unknown()).optional(),
  visual_settings: z.record(z.unknown()).optional(),
  healing_settings: z.record(z.unknown()).optional(),
});

/**
 * Update project request body
 */
export const updateProjectSchema = createProjectSchema.partial();

/**
 * Project ID parameter
 */
export const projectIdParamsSchema = z.object({
  id: uuidSchema,
});

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
// Authentication Schemas
// ============================================================================

/**
 * Login request body
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Register request body
 */
export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters'),
  organization_name: z
    .string()
    .min(1, 'Organization name is required')
    .max(255)
    .optional(),
});

// ============================================================================
// Validation Helper
// ============================================================================

/**
 * Validation result type
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: z.ZodError['errors'] };

/**
 * Validate data against a schema
 * Returns typed result with errors if validation fails
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.errors };
}

/**
 * Format Zod errors for API response
 */
export function formatZodErrors(errors: z.ZodError['errors']): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};
  for (const error of errors) {
    const path = error.path.join('.') || 'root';
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(error.message);
  }
  return formatted;
}

// ============================================================================
// Type Exports
// ============================================================================

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateTestSuiteInput = z.infer<typeof createTestSuiteSchema>;
export type UpdateTestSuiteInput = z.infer<typeof updateTestSuiteSchema>;
export type CreateTestInput = z.infer<typeof createTestSchema>;
export type UpdateTestInput = z.infer<typeof updateTestSchema>;
export type CreateTestRunInput = z.infer<typeof createTestRunSchema>;
export type UpdateTestRunInput = z.infer<typeof updateTestRunSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type PaginationParams = z.infer<typeof paginationSchema>;
export type RunFiltersQuery = z.infer<typeof runFiltersQuerySchema>;
