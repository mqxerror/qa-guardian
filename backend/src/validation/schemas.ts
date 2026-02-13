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

// ============================================================================
// Feature #714: Project Route Schemas
// ============================================================================

/**
 * Project list query parameters
 */
export const projectListQuerySchema = z.object({
  include_archived: z.string().optional(),
  archived_only: z.string().optional(),
});

/**
 * Project archive request body
 */
export const projectArchiveSchema = z.object({
  archived: z.boolean(),
});

/**
 * Project environment variable ID params
 */
export const projectEnvVarParamsSchema = z.object({
  id: uuidSchema,
  varId: uuidSchema,
});

/**
 * Create environment variable request body
 */
export const createEnvVarSchema = z.object({
  key: z
    .string()
    .min(1, 'Key is required')
    .transform(s => s.trim().toUpperCase())
    .refine(
      s => /^[A-Z_][A-Z0-9_]*$/.test(s),
      'Key must start with a letter or underscore and contain only letters, numbers, and underscores'
    ),
  value: z.string(),
  is_secret: z.boolean().default(false),
});

/**
 * Update environment variable request body
 */
export const updateEnvVarSchema = z.object({
  value: z.string().optional(),
  is_secret: z.boolean().optional(),
});

/**
 * Quick smoke test request body
 */
export const quickSmokeTestSchema = z.object({
  target_url: z.string().url('Invalid URL format').optional(),
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
// Feature #715: Quick Test Schemas
// ============================================================================

/**
 * Quick test run ID parameter
 */
export const quickTestRunIdParamsSchema = z.object({
  runId: uuidSchema,
});

/**
 * Quick test compare ID parameter
 */
export const quickTestCompareIdParamsSchema = z.object({
  compareId: uuidSchema,
});

/**
 * Quick test schedule ID parameter
 */
export const quickTestScheduleIdParamsSchema = z.object({
  scheduleId: uuidSchema,
});

/**
 * Quick test screenshot params
 */
export const quickTestScreenshotParamsSchema = z.object({
  runId: uuidSchema,
  type: z.enum(['desktop', 'mobile']),
});

/**
 * Quick test body (POST /quick-test)
 */
export const quickTestBodySchema = z.object({
  url: z.string().url('Invalid URL format'),
  browser: z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
});

/**
 * Quick test compare body
 */
export const quickTestCompareBodySchema = z.object({
  urlA: z.string().url('Invalid URL format for urlA'),
  urlB: z.string().url('Invalid URL format for urlB'),
});

/**
 * Quick test schedule body
 */
export const quickTestScheduleBodySchema = z.object({
  url: z.string().url('Invalid URL format'),
  name: z.string().min(1, 'Name is required').max(255),
  cron_expression: z.string().min(1, 'Cron expression is required'),
  notify_on_score_drop: z.boolean().default(true),
  score_threshold: z.number().min(0).max(100).default(70),
});

/**
 * Quick test schedule update body
 */
export const quickTestScheduleUpdateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  cron_expression: z.string().optional(),
  enabled: z.boolean().optional(),
  notify_on_score_drop: z.boolean().optional(),
  score_threshold: z.number().min(0).max(100).optional(),
});

/**
 * Quick test history query
 */
export const quickTestHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['running', 'completed', 'failed']).optional(),
});

/**
 * Quick test schedules list query
 */
export const quickTestSchedulesQuerySchema = z.object({
  enabled: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ============================================================================
// Feature #715: DAST Schemas
// ============================================================================

/**
 * DAST project ID parameter
 */
export const dastProjectIdParamsSchema = z.object({
  projectId: uuidSchema,
});

/**
 * DAST scan ID params
 */
export const dastScanIdParamsSchema = z.object({
  projectId: uuidSchema,
  scanId: z.string().min(1),
});

/**
 * DAST alert ID params
 */
export const dastAlertIdParamsSchema = z.object({
  projectId: uuidSchema,
  scanId: z.string().min(1),
  alertId: z.string().min(1),
});

/**
 * DAST false positive ID params
 */
export const dastFalsePositiveIdParamsSchema = z.object({
  projectId: uuidSchema,
  falsePositiveId: z.string().min(1),
});

/**
 * DAST trigger scan body
 */
export const dastTriggerScanBodySchema = z.object({
  targetUrl: z.string().url('Invalid URL format').optional(),
  scanProfile: z.enum(['baseline', 'full', 'api']).optional(),
});

/**
 * DAST false positive body
 */
export const dastFalsePositiveBodySchema = z.object({
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

/**
 * DAST alerts query
 */
export const dastAlertsQuerySchema = z.object({
  risk: z.string().optional(),
  confidence: z.string().optional(),
  includeFalsePositives: z.string().optional(),
});

/**
 * DAST report query
 */
export const dastReportQuerySchema = z.object({
  format: z.enum(['pdf', 'html', 'json']).default('html'),
});

/**
 * DAST stats query
 */
export const dastStatsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

/**
 * DAST OpenAPI upload body
 */
export const dastOpenApiUploadBodySchema = z.object({
  content: z.string().min(1, 'OpenAPI specification content is required'),
  name: z.string().max(255).default('API Specification'),
});

/**
 * DAST GraphQL scan body
 */
export const dastGraphqlScanBodySchema = z.object({
  endpoint: z.string().url('Invalid GraphQL endpoint URL'),
  authHeader: z.string().optional(),
  testQueries: z.array(z.string()).optional(),
  includeIntrospection: z.boolean().default(true),
});

/**
 * DAST GraphQL introspect body
 */
export const dastGraphqlIntrospectBodySchema = z.object({
  endpoint: z.string().url('Invalid GraphQL endpoint URL'),
  authHeader: z.string().optional(),
});

/**
 * DAST GraphQL scan ID params
 */
export const dastGraphqlScanIdParamsSchema = z.object({
  scanId: z.string().min(1),
});

/**
 * DAST GraphQL scans query
 */
export const dastGraphqlScansQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.string().optional(),
});

// ============================================================================
// Feature #715: SAST Schemas
// ============================================================================

/**
 * SAST project ID parameter
 */
export const sastProjectIdParamsSchema = z.object({
  projectId: uuidSchema,
});

/**
 * SAST scan ID params
 */
export const sastScanIdParamsSchema = z.object({
  projectId: uuidSchema,
  scanId: uuidSchema,
});

/**
 * SAST trigger scan body
 */
export const sastTriggerScanBodySchema = z.object({
  branch: z.string().max(255).default('main'),
});

/**
 * SAST dashboard query
 */
export const sastDashboardQuerySchema = z.object({
  severity: z.string().optional(),
  category: z.string().optional(),
  sortBy: z.enum(['date', 'severity', 'project']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * SAST trends query
 */
export const sastTrendsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

/**
 * SAST scans list query
 */
export const sastScansQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
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
// Feature #715: MCP Tools Schemas
// ============================================================================

/**
 * MCP tool execute request body
 */
export const mcpExecuteBodySchema = z.object({
  tool_name: z.string().min(1, 'Tool name is required').max(100),
  args: z.record(z.unknown()).default({}),
  use_real_ai: z.boolean().default(true),
});

/**
 * MCP chat request body
 */
export const mcpChatBodySchema = z.object({
  message: z.string().min(1, 'Message is required').max(10000),
  context: z.object({
    project_id: z.string().optional(),
    project_name: z.string().optional(),
    test_id: z.string().optional(),
    current_page: z.string().optional(),
    conversation_history: z.array(z.object({
      role: z.string(),
      content: z.string(),
    })).optional(),
  }).optional(),
  complexity: z.enum(['simple', 'complex']).default('complex'),
  provider: z.enum(['kie', 'anthropic', 'auto']).optional(),
  model: z.string().max(100).optional(),
});

/**
 * MCP chat vision request body
 */
export const mcpChatVisionBodySchema = z.object({
  message: z.string().min(1, 'Message is required').max(10000),
  image: z.object({
    data: z.string().min(1, 'Image data is required'),
    media_type: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  }),
  context: z.object({
    test_type: z.string().optional(),
    diff_percentage: z.number().min(0).max(100).optional(),
    viewport: z.object({
      width: z.number().int().min(1),
      height: z.number().int().min(1),
    }).optional(),
  }).optional(),
  complexity: z.enum(['simple', 'complex']).default('complex'),
});

/**
 * SAST config update body
 */
export const sastConfigUpdateBodySchema = z.object({
  enabled: z.boolean().optional(),
  auto_scan: z.boolean().optional(),
  scan_on_push: z.boolean().optional(),
  languages: z.array(z.string()).optional(),
  severity_threshold: z.enum(['info', 'warning', 'error', 'critical']).optional(),
  exclude_patterns: z.array(z.string()).optional(),
  custom_rules: z.array(z.record(z.unknown())).optional(),
});

/**
 * DAST scan profile update body
 */
export const dastProfileUpdateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  target_url: z.string().url().optional(),
  scan_type: z.enum(['baseline', 'full', 'api']).optional(),
  authentication: z.record(z.unknown()).optional(),
});

/**
 * Feature #715: DAST config update body (Partial<DASTConfig>)
 */
export const dastConfigUpdateBodySchema = z.object({
  enabled: z.boolean().optional(),
  targetUrl: z.string().url().optional(),
  scanProfile: z.enum(['baseline', 'full', 'api']).optional(),
  authConfig: z.object({
    enabled: z.boolean(),
    loginUrl: z.string().url().optional(),
    usernameField: z.string().optional(),
    passwordField: z.string().optional(),
    submitSelector: z.string().optional(),
    loggedInIndicator: z.string().optional(),
    credentials: z.object({
      username: z.string(),
      password: z.string(),
    }).optional(),
  }).optional(),
  contextConfig: z.object({
    includeUrls: z.array(z.string()).optional(),
    excludeUrls: z.array(z.string()).optional(),
    maxCrawlDepth: z.number().int().min(1).max(10).optional(),
  }).optional(),
  alertThreshold: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  autoScan: z.boolean().optional(),
  openApiSpecId: z.string().optional(),
});

/**
 * DAST OpenAPI upload body
 */
export const dastOpenApiBodySchema = z.object({
  content: z.string().min(1, 'OpenAPI specification content is required'),
  name: z.string().max(255).default('API Specification'),
});

/**
 * DAST schedule body
 */
export const dastScheduleBodySchema = z.object({
  target_url: z.string().url('Invalid URL format'),
  scan_profile: z.enum(['baseline', 'full', 'api']).default('baseline'),
  frequency: z.string().min(1, 'Frequency is required'),
  enabled: z.boolean().default(true),
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

// Feature #714: Project Route Types
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;
export type ProjectArchiveInput = z.infer<typeof projectArchiveSchema>;
export type ProjectEnvVarParams = z.infer<typeof projectEnvVarParamsSchema>;
export type CreateEnvVarInput = z.infer<typeof createEnvVarSchema>;
export type UpdateEnvVarInput = z.infer<typeof updateEnvVarSchema>;
export type QuickSmokeTestInput = z.infer<typeof quickSmokeTestSchema>;

// Feature #714: Test Suite Route Types
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

// Feature #715: Quick Test Types
export type QuickTestRunIdParams = z.infer<typeof quickTestRunIdParamsSchema>;
export type QuickTestCompareIdParams = z.infer<typeof quickTestCompareIdParamsSchema>;
export type QuickTestScheduleIdParams = z.infer<typeof quickTestScheduleIdParamsSchema>;
export type QuickTestScreenshotParams = z.infer<typeof quickTestScreenshotParamsSchema>;
export type QuickTestBodyInput = z.infer<typeof quickTestBodySchema>;
export type QuickTestCompareBodyInput = z.infer<typeof quickTestCompareBodySchema>;
export type QuickTestScheduleBodyInput = z.infer<typeof quickTestScheduleBodySchema>;
export type QuickTestScheduleUpdateBodyInput = z.infer<typeof quickTestScheduleUpdateBodySchema>;
export type QuickTestHistoryQuery = z.infer<typeof quickTestHistoryQuerySchema>;
export type QuickTestSchedulesQuery = z.infer<typeof quickTestSchedulesQuerySchema>;

// Feature #715: DAST Types
export type DastProjectIdParams = z.infer<typeof dastProjectIdParamsSchema>;
export type DastScanIdParams = z.infer<typeof dastScanIdParamsSchema>;
export type DastAlertIdParams = z.infer<typeof dastAlertIdParamsSchema>;
export type DastFalsePositiveIdParams = z.infer<typeof dastFalsePositiveIdParamsSchema>;
export type DastTriggerScanBodyInput = z.infer<typeof dastTriggerScanBodySchema>;
export type DastFalsePositiveBodyInput = z.infer<typeof dastFalsePositiveBodySchema>;
export type DastAlertsQuery = z.infer<typeof dastAlertsQuerySchema>;
export type DastReportQuery = z.infer<typeof dastReportQuerySchema>;
export type DastStatsQuery = z.infer<typeof dastStatsQuerySchema>;
export type DastOpenApiUploadBodyInput = z.infer<typeof dastOpenApiUploadBodySchema>;
export type DastGraphqlScanBodyInput = z.infer<typeof dastGraphqlScanBodySchema>;
export type DastGraphqlIntrospectBodyInput = z.infer<typeof dastGraphqlIntrospectBodySchema>;
export type DastGraphqlScanIdParams = z.infer<typeof dastGraphqlScanIdParamsSchema>;
export type DastGraphqlScansQuery = z.infer<typeof dastGraphqlScansQuerySchema>;

// Feature #715: SAST Types
export type SastProjectIdParams = z.infer<typeof sastProjectIdParamsSchema>;
export type SastScanIdParams = z.infer<typeof sastScanIdParamsSchema>;
export type SastTriggerScanBodyInput = z.infer<typeof sastTriggerScanBodySchema>;
export type SastDashboardQuery = z.infer<typeof sastDashboardQuerySchema>;
export type SastTrendsQuery = z.infer<typeof sastTrendsQuerySchema>;
export type SastScansQuery = z.infer<typeof sastScansQuerySchema>;

// Feature #715: MCP Tools Types
export type McpExecuteBodyInput = z.infer<typeof mcpExecuteBodySchema>;
export type McpChatBodyInput = z.infer<typeof mcpChatBodySchema>;
export type McpChatVisionBodyInput = z.infer<typeof mcpChatVisionBodySchema>;
export type SastConfigUpdateBodyInput = z.infer<typeof sastConfigUpdateBodySchema>;
export type DastProfileUpdateBodyInput = z.infer<typeof dastProfileUpdateBodySchema>;
export type DastConfigUpdateBodyInput = z.infer<typeof dastConfigUpdateBodySchema>;
export type DastScheduleBodyInput = z.infer<typeof dastScheduleBodySchema>;
