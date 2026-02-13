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
// Auth Extended Schemas (Feature #713)
// ============================================================================

/**
 * Logout request body
 */
export const logoutSchema = z.object({
  refresh_token: z.string().optional(),
});

/**
 * Refresh token request body
 */
export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

/**
 * Forgot password request body
 */
export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

/**
 * Reset password request body
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

/**
 * Session ID parameter
 */
export const sessionIdParamsSchema = z.object({
  sessionId: uuidSchema,
});

// ============================================================================
// Organization Schemas (Feature #713)
// ============================================================================

/**
 * Organization member role enum
 */
export const memberRoleSchema = z.enum(['owner', 'admin', 'developer', 'viewer']);

/**
 * Invitation role enum (excludes 'owner')
 */
export const invitationRoleSchema = z.enum(['admin', 'developer', 'viewer']);

/**
 * Organization ID parameter
 */
export const orgIdParamsSchema = z.object({
  id: uuidSchema,
});

/**
 * Organization switch request body
 */
export const switchOrganizationSchema = z.object({
  organization_id: uuidSchema,
});

/**
 * Create organization request body
 */
export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, 'Organization name is required')
    .max(100, 'Organization name must be 100 characters or less')
    .transform(s => s.trim()),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .max(100)
    .optional(),
  timezone: z.string().default('UTC'),
});

/**
 * Update organization request body
 */
export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  timezone: z.string().optional(),
});

/**
 * Delete organization request body (requires password confirmation)
 */
export const deleteOrganizationSchema = z.object({
  password: z.string().min(1, 'Password confirmation is required'),
});

/**
 * Create invitation request body
 */
export const createInvitationSchema = z.object({
  email: z.string().email('Invalid email format'),
  role: invitationRoleSchema,
});

/**
 * Invitation ID parameter
 */
export const inviteIdParamsSchema = z.object({
  inviteId: uuidSchema,
});

/**
 * Organization invitation delete params
 */
export const orgInviteParamsSchema = z.object({
  id: uuidSchema,
  inviteId: uuidSchema,
});

/**
 * Organization member params
 */
export const orgMemberParamsSchema = z.object({
  id: uuidSchema,
  memberId: uuidSchema,
});

/**
 * Update member role request body
 */
export const updateMemberRoleSchema = z.object({
  role: invitationRoleSchema,
});

/**
 * Transfer ownership request body
 */
export const transferOwnershipSchema = z.object({
  new_owner_id: uuidSchema,
  password: z.string().min(1, 'Password confirmation is required'),
});

/**
 * Team metrics query parameters
 */
export const teamMetricsQuerySchema = z.object({
  period: z
    .string()
    .regex(/^\d+[dhw]$/, 'Invalid period format. Use formats like 7d, 14d, 30d, or 4w')
    .optional()
    .default('30d'),
  include_trends: z
    .string()
    .optional()
    .default('true'),
  include_activity: z
    .string()
    .optional()
    .default('true'),
});

/**
 * Retry strategy test ID parameter
 */
export const retryStrategyTestIdParamsSchema = z.object({
  testId: uuidSchema,
});

/**
 * Auto-quarantine settings update body
 */
export const autoQuarantineSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  flakiness_threshold: z.number().min(0).max(1).optional(),
  quarantine_reason_prefix: z.string().max(100).optional(),
  notify_on_quarantine: z.boolean().optional(),
});

/**
 * Retry strategy settings update body
 */
export const retryStrategySettingsSchema = z.object({
  enabled: z.boolean().optional(),
  default_retries: z.number().int().min(0).max(10).optional(),
  rules: z.array(z.object({
    min_score: z.number().min(0).max(1),
    max_score: z.number().min(0).max(1.01), // Allow 1.01 to include 1.0
    retries: z.number().int().min(0).max(10),
  })).optional(),
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

// Feature #713: Auth Extended Types
export type LogoutInput = z.infer<typeof logoutSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SessionIdParams = z.infer<typeof sessionIdParamsSchema>;

// Feature #713: Organization Types
export type OrgIdParams = z.infer<typeof orgIdParamsSchema>;
export type SwitchOrganizationInput = z.infer<typeof switchOrganizationSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type DeleteOrganizationInput = z.infer<typeof deleteOrganizationSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type InviteIdParams = z.infer<typeof inviteIdParamsSchema>;
export type OrgInviteParams = z.infer<typeof orgInviteParamsSchema>;
export type OrgMemberParams = z.infer<typeof orgMemberParamsSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
export type TeamMetricsQuery = z.infer<typeof teamMetricsQuerySchema>;
export type RetryStrategyTestIdParams = z.infer<typeof retryStrategyTestIdParamsSchema>;
export type AutoQuarantineSettingsInput = z.infer<typeof autoQuarantineSettingsSchema>;
export type RetryStrategySettingsInput = z.infer<typeof retryStrategySettingsSchema>;
