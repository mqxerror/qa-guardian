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
// Feature #716: Remaining Route Validation Schemas
// ============================================================================

/**
 * Schedule routes
 */
export const scheduleIdParamsSchema = z.object({
  id: z.string().min(1, 'Schedule ID is required'),
});

export const createScheduleBodySchema = z.object({
  suite_id: z.string().min(1, 'Suite ID is required'),
  name: z.string().min(1, 'Schedule name is required').max(255),
  description: z.string().max(1000).optional(),
  cron_expression: z.string().optional(),
  run_at: z.string().optional(),
  timezone: z.string().max(100).optional(),
  enabled: z.boolean().optional(),
  browsers: z.array(z.enum(['chromium', 'firefox', 'webkit'])).optional(),
  notify_on_failure: z.boolean().optional(),
});

export const updateScheduleBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  cron_expression: z.string().optional(),
  run_at: z.string().optional(),
  timezone: z.string().max(100).optional(),
  enabled: z.boolean().optional(),
  browsers: z.array(z.enum(['chromium', 'firefox', 'webkit'])).optional(),
  notify_on_failure: z.boolean().optional(),
});

/**
 * Webhook subscription routes
 */
export const webhookSubscriptionIdParamsSchema = z.object({
  subscriptionId: z.string().min(1, 'Subscription ID is required'),
});

export const testWebhookUrlBodySchema = z.object({
  url: z.string().url('Must be a valid URL'),
  headers: z.record(z.string()).optional(),
  secret: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
});

export const createWebhookSubscriptionBodySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  url: z.string().url('Must be a valid URL'),
  events: z.array(z.string().min(1)).min(1, 'At least one event is required'),
  project_id: z.string().optional(),
  project_ids: z.array(z.string()).optional(),
  result_statuses: z.array(z.string()).optional(),
  headers: z.record(z.string()).optional(),
  secret: z.string().optional(),
  enabled: z.boolean().optional(),
  payload_template: z.string().optional(),
  retry_enabled: z.boolean().optional(),
  max_retries: z.number().int().min(0).max(5).optional(),
  batch_enabled: z.boolean().optional(),
  batch_size: z.number().int().min(1).max(100).optional(),
  batch_interval_seconds: z.number().int().min(5).max(3600).optional(),
});

export const updateWebhookSubscriptionBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string().min(1)).optional(),
  project_id: z.string().optional(),
  project_ids: z.array(z.string()).optional(),
  result_statuses: z.array(z.string()).optional(),
  headers: z.record(z.string()).optional(),
  secret: z.string().optional(),
  enabled: z.boolean().optional(),
  payload_template: z.string().optional(),
  retry_enabled: z.boolean().optional(),
  max_retries: z.number().int().min(0).max(5).optional(),
  batch_enabled: z.boolean().optional(),
  batch_size: z.number().int().min(1).max(100).optional(),
  batch_interval_seconds: z.number().int().min(5).max(3600).optional(),
});

/**
 * Monitoring webhook routes
 */
export const monitoringCheckIdParamsSchema = z.object({
  checkId: z.string().min(1, 'Check ID is required'),
});

export const monitoringWebhookTokenParamsSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const createMonitoringWebhookBodySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(1000).optional(),
  expected_interval: z.number().int().min(60, 'Interval must be at least 60 seconds'),
  expected_payload: z.object({
    schema: z.record(z.unknown()).optional(),
    fields: z.array(z.string()).optional(),
  }).optional(),
  webhook_secret: z.string().optional(),
});

/**
 * AI usage routes
 */
export const aiUsageQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month']).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export const aiUsageBudgetBodySchema = z.object({
  daily_limit_usd: z.number().min(0).optional(),
  monthly_limit_usd: z.number().min(0).optional(),
  alert_threshold_percent: z.number().min(0).max(100).optional(),
});

export const aiUsageAlertsQuerySchema = z.object({
  limit: z.string().optional(),
});

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

/**
 * Healing routes
 */
export const healingApprovalIdParamsSchema = z.object({
  approvalId: z.string().min(1, 'Approval ID is required'),
});

export const healingIdParamsSchema = z.object({
  healingId: z.string().min(1, 'Healing ID is required'),
});

export const healingApprovalBodySchema = z.object({
  approved: z.boolean(),
});

export const healingBulkUpdateBodySchema = z.object({
  updates: z.array(z.object({
    test_id: z.string().min(1),
    step_index: z.number().int().min(0),
    new_selector: z.string().min(1),
  })).min(1, 'At least one update is required'),
});

/**
 * Baseline routes
 */
export const baselineTestIdParamsSchema = z.object({
  testId: z.string().min(1, 'Test ID is required'),
});

export const baselineQuerySchema = z.object({
  viewport: z.string().optional(),
  branch: z.string().optional(),
});

/**
 * GitHub routes
 */
export const githubRepoParamsSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repo is required'),
});

export const githubConnectProjectBodySchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repo is required'),
  branch: z.string().optional(),
  test_path: z.string().optional(),
});

export const githubProjectIdParamsSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
});

/**
 * Audit logs routes
 */
export const auditLogsOrgIdParamsSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
});

export const auditLogsQuerySchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
  action: z.string().optional(),
  resource_type: z.string().optional(),
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

// Feature #716: Remaining Route Types
export type ScheduleIdParams = z.infer<typeof scheduleIdParamsSchema>;
export type CreateScheduleBodyInput = z.infer<typeof createScheduleBodySchema>;
export type UpdateScheduleBodyInput = z.infer<typeof updateScheduleBodySchema>;
export type WebhookSubscriptionIdParams = z.infer<typeof webhookSubscriptionIdParamsSchema>;
export type TestWebhookUrlBodyInput = z.infer<typeof testWebhookUrlBodySchema>;
export type CreateWebhookSubscriptionBodyInput = z.infer<typeof createWebhookSubscriptionBodySchema>;
export type UpdateWebhookSubscriptionBodyInput = z.infer<typeof updateWebhookSubscriptionBodySchema>;
export type MonitoringCheckIdParams = z.infer<typeof monitoringCheckIdParamsSchema>;
export type MonitoringWebhookTokenParams = z.infer<typeof monitoringWebhookTokenParamsSchema>;
export type CreateMonitoringWebhookBodyInput = z.infer<typeof createMonitoringWebhookBodySchema>;
export type AiUsageQuery = z.infer<typeof aiUsageQuerySchema>;
export type AiUsageBudgetBodyInput = z.infer<typeof aiUsageBudgetBodySchema>;
export type StepTemplateIdParams = z.infer<typeof stepTemplateIdParamsSchema>;
export type CreateStepTemplateBodyInput = z.infer<typeof createStepTemplateBodySchema>;
export type UpdateStepTemplateBodyInput = z.infer<typeof updateStepTemplateBodySchema>;
export type HealingApprovalIdParams = z.infer<typeof healingApprovalIdParamsSchema>;
export type HealingIdParams = z.infer<typeof healingIdParamsSchema>;
export type HealingApprovalBodyInput = z.infer<typeof healingApprovalBodySchema>;
export type HealingBulkUpdateBodyInput = z.infer<typeof healingBulkUpdateBodySchema>;
export type BaselineTestIdParams = z.infer<typeof baselineTestIdParamsSchema>;
export type GithubRepoParams = z.infer<typeof githubRepoParamsSchema>;
export type GithubConnectProjectBodyInput = z.infer<typeof githubConnectProjectBodySchema>;
export type AuditLogsOrgIdParams = z.infer<typeof auditLogsOrgIdParamsSchema>;
export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;

// ============================================================================
// Feature #716: API Key Schemas
// ============================================================================

/**
 * API key org params
 */
export const apiKeyOrgParamsSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
});

/**
 * API key ID params
 */
export const apiKeyIdParamsSchema = z.object({
  id: z.string().min(1, 'API key ID is required'),
});

/**
 * Create API key request body
 */
export const createApiKeyBodySchema = z.object({
  name: z.string().min(1, 'API key name is required').max(255),
  scopes: z.array(z.string()).default(['read']),
  expires_in_days: z.number().int().min(1).max(365).optional(),
  rate_limit: z.number().int().min(1).max(10000).optional(),
  rate_limit_window: z.number().int().min(1).max(3600).optional(),
  burst_limit: z.number().int().min(1).max(1000).optional(),
  burst_window: z.number().int().min(1).max(300).optional(),
});

/**
 * Validate MCP key request body
 */
export const validateMcpKeyBodySchema = z.object({
  api_key: z.string().min(1, 'API key is required'),
  required_scope: z.string().default('mcp'),
});

// API Key Types
export type ApiKeyOrgParams = z.infer<typeof apiKeyOrgParamsSchema>;
export type ApiKeyIdParams = z.infer<typeof apiKeyIdParamsSchema>;
export type CreateApiKeyBodyInput = z.infer<typeof createApiKeyBodySchema>;
export type ValidateMcpKeyBodyInput = z.infer<typeof validateMcpKeyBodySchema>;

// ============================================================================
// Feature #716: Monitoring - Alert Routing Schemas
// ============================================================================

/**
 * Alert routing rule ID params
 */
export const alertRoutingRuleIdParamsSchema = z.object({
  ruleId: z.string().min(1, 'Rule ID is required'),
});

/**
 * Create alert routing rule body
 */
export const createAlertRoutingRuleBodySchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(255),
  description: z.string().max(2000).optional(),
  conditions: z.array(z.object({
    field: z.string().min(1),
    operator: z.string().min(1),
    value: z.unknown(),
  })).min(1),
  condition_match: z.enum(['all', 'any']).optional(),
  destinations: z.array(z.object({
    type: z.string().min(1),
    config: z.record(z.unknown()),
    name: z.string().optional(),
  })).min(1),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
});

/**
 * Update alert routing rule body
 */
export const updateAlertRoutingRuleBodySchema = createAlertRoutingRuleBodySchema.partial();

/**
 * Alert routing simulate body
 */
export const alertRoutingSimulateBodySchema = z.object({
  alert: z.object({
    check_name: z.string().min(1),
    check_type: z.enum(['uptime', 'transaction', 'performance', 'webhook', 'dns', 'tcp']),
    severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
    location: z.string().optional(),
    tags: z.array(z.string()).optional(),
    error_message: z.string().optional(),
  }),
});

/**
 * Alert rate limit config body
 */
export const alertRateLimitConfigBodySchema = z.object({
  enabled: z.boolean(),
  max_alerts_per_minute: z.number().int().min(1),
  time_window_seconds: z.number().int().min(1),
  suppression_mode: z.enum(['drop', 'aggregate']),
  aggregate_threshold: z.number().int().min(1),
});

/**
 * Alert rate limit test body
 */
export const alertRateLimitTestBodySchema = z.object({
  alert_count: z.number().int().min(1).max(100).optional(),
});

// ============================================================================
// Feature #716: Monitoring - Alert Grouping Schemas
// ============================================================================

/**
 * Alert grouping rule ID params
 */
export const alertGroupingRuleIdParamsSchema = z.object({
  ruleId: z.string().min(1, 'Rule ID is required'),
});

/**
 * Alert group ID params
 */
export const alertGroupIdParamsSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
});

/**
 * Create alert grouping rule body
 */
export const createAlertGroupingRuleBodySchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(255),
  description: z.string().max(2000).optional(),
  group_by: z.array(z.string()).min(1),
  time_window_minutes: z.number().int().min(1).max(1440).optional(),
  deduplication_enabled: z.boolean().optional(),
  deduplication_key: z.string().optional(),
  max_alerts_per_group: z.number().int().min(1).optional(),
  notification_delay_seconds: z.number().int().min(0).optional(),
  priority: z.number().int().min(0).optional(),
});

/**
 * Update alert grouping rule body
 */
export const updateAlertGroupingRuleBodySchema = createAlertGroupingRuleBodySchema.extend({
  is_active: z.boolean().optional(),
}).partial();

/**
 * Alert group acknowledge body
 */
export const alertGroupAcknowledgeBodySchema = z.object({
  note: z.string().max(2000).optional(),
});

/**
 * Alert group resolve body
 */
export const alertGroupResolveBodySchema = z.object({
  resolution_notes: z.string().max(5000).optional(),
});

/**
 * Alert group snooze body
 */
export const alertGroupSnoozeBodySchema = z.object({
  duration_hours: z.number().min(0.1).max(168),
});

/**
 * Alert grouping simulate body
 */
export const alertGroupingSimulateBodySchema = z.object({
  alerts: z.array(z.object({
    check_name: z.string().min(1),
    check_type: z.enum(['uptime', 'transaction', 'performance', 'webhook', 'dns', 'tcp']),
    location: z.string().optional(),
    error_message: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })).min(1),
});

// ============================================================================
// Feature #716: Monitoring - Alert Correlation Schemas
// ============================================================================

/**
 * Alert correlation config body
 */
export const alertCorrelationConfigBodySchema = z.object({
  enabled: z.boolean(),
  correlate_by_check: z.boolean(),
  correlate_by_location: z.boolean(),
  correlate_by_error_type: z.boolean(),
  correlate_by_time_window: z.boolean(),
  time_window_seconds: z.number().int().min(1),
  similarity_threshold: z.number().int().min(0).max(100),
});

/**
 * Correlation ID params
 */
export const correlationIdParamsSchema = z.object({
  correlationId: z.string().min(1, 'Correlation ID is required'),
});

/**
 * Alert correlation test body
 */
export const alertCorrelationTestBodySchema = z.object({
  alert_count: z.number().int().min(1).max(100).optional(),
  scenario: z.enum(['same_check', 'same_location', 'similar_error', 'mixed']).optional(),
});

/**
 * Runbook ID params
 */
export const runbookIdParamsSchema = z.object({
  runbookId: z.string().min(1, 'Runbook ID is required'),
});

/**
 * Create alert runbook body
 */
export const createAlertRunbookBodySchema = z.object({
  name: z.string().min(1, 'Runbook name is required').max(255),
  description: z.string().max(2000).optional(),
  check_type: z.string().min(1),
  severity: z.string().optional(),
  runbook_url: z.string().url('Invalid runbook URL'),
  instructions: z.string().max(10000).optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Update alert runbook body
 */
export const updateAlertRunbookBodySchema = createAlertRunbookBodySchema.partial();

/**
 * Test runbook match body
 */
export const testRunbookMatchBodySchema = z.object({
  check_type: z.string().min(1),
  severity: z.string().min(1),
  check_name: z.string().optional(),
  error_message: z.string().optional(),
});

/**
 * Test alert routing destination body
 */
export const testAlertDestinationBodySchema = z.object({
  destination_type: z.string().min(1),
  config: z.record(z.unknown()),
  test_alert: z.object({
    check_name: z.string(),
    check_type: z.string(),
    severity: z.string(),
    error_message: z.string().optional(),
  }).optional(),
});

// ============================================================================
// Feature #716: Monitoring - Incidents Schemas
// ============================================================================

/**
 * Incident ID params
 */
export const incidentIdParamsSchema = z.object({
  incidentId: z.string().min(1, 'Incident ID is required'),
});

/**
 * Create incident body
 */
export const createIncidentBodySchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional(),
  priority: z.enum(['P1', 'P2', 'P3', 'P4', 'P5']).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  source: z.enum(['alert', 'manual', 'api', 'integration']).optional(),
  source_alert_id: z.string().optional(),
  source_check_id: z.string().optional(),
  source_check_type: z.string().optional(),
  tags: z.array(z.string()).optional(),
  affected_services: z.array(z.string()).optional(),
  escalation_policy_id: z.string().optional(),
  on_call_schedule_id: z.string().optional(),
});

/**
 * Update incident status body
 */
export const updateIncidentStatusBodySchema = z.object({
  status: z.enum(['triggered', 'acknowledged', 'investigating', 'identified', 'monitoring', 'resolved']),
  resolution_summary: z.string().max(5000).optional(),
  postmortem_url: z.string().url().optional(),
});

/**
 * Add incident responder body
 */
export const addIncidentResponderBodySchema = z.object({
  user_id: z.string().min(1),
  user_name: z.string().min(1),
  user_email: z.string().email(),
  role: z.enum(['primary', 'secondary', 'observer']).optional(),
});

/**
 * Add incident note body
 */
export const addIncidentNoteBodySchema = z.object({
  content: z.string().min(1, 'Note content is required').max(10000),
  visibility: z.enum(['internal', 'public']).optional(),
});

/**
 * Resolve incident body
 */
export const resolveIncidentBodySchema = z.object({
  resolution_summary: z.string().min(1).max(5000),
  postmortem_url: z.string().url().optional(),
  postmortem_completed: z.boolean().optional(),
});

// ============================================================================
// Feature #716: Monitoring - Status Pages Schemas
// ============================================================================

/**
 * Status page ID params
 */
export const statusPageIdParamsSchema = z.object({
  pageId: z.string().min(1, 'Page ID is required'),
});

/**
 * Status page incident params
 */
export const statusPageIncidentParamsSchema = z.object({
  pageId: z.string().min(1),
  incidentId: z.string().min(1),
});

/**
 * Status page slug params
 */
export const statusPageSlugParamsSchema = z.object({
  slug: z.string().min(1).max(100),
});

/**
 * Create status page body
 */
export const createStatusPageBodySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).optional(),
  logo_url: z.string().url().optional(),
  favicon_url: z.string().url().optional(),
  primary_color: z.string().max(20).optional(),
  show_history_days: z.number().int().min(1).max(90).optional(),
  checks: z.array(z.record(z.unknown())).optional(),
  is_public: z.boolean().optional(),
  show_uptime_percentage: z.boolean().optional(),
  show_response_time: z.boolean().optional(),
  show_incidents: z.boolean().optional(),
  custom_slug: z.string().max(100).optional(),
});

/**
 * Update status page body
 */
export const updateStatusPageBodySchema = createStatusPageBodySchema.extend({
  custom_domain: z.string().max(255).optional(),
}).partial();

/**
 * Create status page incident body
 */
export const createStatusPageIncidentBodySchema = z.object({
  title: z.string().min(1).max(500),
  status: z.enum(['investigating', 'identified', 'monitoring', 'resolved']),
  impact: z.enum(['none', 'minor', 'major', 'critical']),
  message: z.string().min(1).max(5000),
  affected_components: z.array(z.string()).optional(),
});

/**
 * Status page incident update body
 */
export const createStatusPageIncidentUpdateBodySchema = z.object({
  status: z.enum(['investigating', 'identified', 'monitoring', 'resolved']),
  message: z.string().min(1).max(5000),
});

/**
 * Status page subscribe body (public)
 */
export const statusPageSubscribeBodySchema = z.object({
  email: z.string().email().optional(),
});

// ============================================================================
// Feature #716: Monitoring - On-Call & Escalation Schemas
// ============================================================================

/**
 * On-call schedule ID params
 */
export const onCallScheduleIdParamsSchema = z.object({
  scheduleId: z.string().min(1, 'Schedule ID is required'),
});

/**
 * Escalation policy ID params
 */
export const escalationPolicyIdParamsSchema = z.object({
  policyId: z.string().min(1, 'Policy ID is required'),
});

/**
 * Create on-call schedule body
 */
export const createOnCallScheduleBodySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).optional(),
  timezone: z.string().max(100).optional(),
  rotation_type: z.enum(['daily', 'weekly', 'custom']),
  rotation_interval_days: z.number().int().min(1).max(365).optional(),
  members: z.array(z.object({
    user_id: z.string().min(1),
    user_name: z.string().min(1),
    user_email: z.string().email(),
    phone: z.string().optional(),
  })).min(1),
});

/**
 * Update on-call schedule body
 */
export const updateOnCallScheduleBodySchema = createOnCallScheduleBodySchema.extend({
  is_active: z.boolean().optional(),
}).partial();

/**
 * Create escalation policy body
 */
export const createEscalationPolicyBodySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).optional(),
  levels: z.array(z.object({
    escalate_after_minutes: z.number().int().min(0),
    targets: z.array(z.record(z.unknown())).min(1),
  })).min(1),
  repeat_policy: z.enum(['once', 'repeat_until_acknowledged']).optional(),
  repeat_interval_minutes: z.number().int().min(1).optional(),
  is_default: z.boolean().optional(),
});

/**
 * Update escalation policy body
 */
export const updateEscalationPolicyBodySchema = createEscalationPolicyBodySchema.extend({
  is_active: z.boolean().optional(),
}).partial();

// ============================================
// Feature #716: Recording Routes Schemas
// ============================================

export const recordingIdParamsSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

export const startRecordingBodySchema = z.object({
  url: z.string().url('Valid URL is required'),
  name: z.string().optional(),
  browser: browserSchema.optional(),
  viewport: z.object({
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }).optional(),
});

export const stopRecordingBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  suite_id: z.string().optional(),
});

// ============================================
// Feature #716: Visual Batch Routes Schemas
// ============================================

export const visualBatchApproveBodySchema = z.object({
  diff_ids: z.array(z.string().min(1)).min(1, 'At least one diff ID is required'),
  note: z.string().optional(),
});

export const visualBatchRejectBodySchema = z.object({
  diff_ids: z.array(z.string().min(1)).min(1, 'At least one diff ID is required'),
  reason: z.string().optional(),
});

// ============================================
// Feature #716: Dependency Scanning Schemas
// ============================================

export const depScanProjectIdParamsSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
});

export const depScanIdParamsSchema = z.object({
  scanId: z.string().min(1, 'Scan ID is required'),
});

export const depVulnIdParamsSchema = z.object({
  vulnId: z.string().min(1, 'Vulnerability ID is required'),
});

export const triggerDepScanBodySchema = z.object({
  project_id: z.string().min(1).optional(),
  include_dev: z.boolean().optional(),
  severity_threshold: z.enum(['critical', 'high', 'medium', 'low']).optional(),
});

export const depPolicyBodySchema = z.object({
  name: z.string().min(1, 'Policy name is required'),
  rules: z.array(z.object({
    type: z.string().min(1),
    severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    action: z.enum(['block', 'warn', 'allow']).optional(),
  })).optional(),
  enabled: z.boolean().optional(),
});

export const depPolicyIdParamsSchema = z.object({
  policyId: z.string().min(1, 'Policy ID is required'),
});

export const depAlertIdParamsSchema = z.object({
  alertId: z.string().min(1, 'Alert ID is required'),
});

export const depViolationIdParamsSchema = z.object({
  violationId: z.string().min(1, 'Violation ID is required'),
});

export const depProjectPrParamsSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  prNumber: z.string().min(1, 'PR number is required'),
});

// ============================================
// Feature #716: Vulnerability Tracking Schemas
// ============================================

export const vulnerabilityIdParamsSchema = z.object({
  vulnerabilityId: z.string().min(1, 'Vulnerability ID is required'),
});

export const multiLanguageConfigBodySchema = z.object({
  languages: z.array(z.string().min(1)).optional(),
  auto_detect: z.boolean().optional(),
  scan_depth: z.number().int().positive().optional(),
});

// ============================================
// Feature #716: AI Providers Schemas
// ============================================

export const aiProviderConfigBodySchema = z.object({
  api_key: z.string().optional(),
  model: z.string().optional(),
  base_url: z.string().url().optional(),
  enabled: z.boolean().optional(),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export const aiChatBodySchema = z.object({
  message: z.string().min(1, 'Message is required'),
  context: z.string().optional(),
  model: z.string().optional(),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export const aiEstimateCostBodySchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  model: z.string().optional(),
  max_tokens: z.number().int().positive().optional(),
});

export const aiRouterConfigBodySchema = z.object({
  primary_provider: z.string().optional(),
  fallback_provider: z.string().optional(),
  failover_enabled: z.boolean().optional(),
  max_retries: z.number().int().min(0).optional(),
  timeout_ms: z.number().int().positive().optional(),
});

export const aiRouterChatBodySchema = z.object({
  message: z.string().min(1, 'Message is required'),
  context: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  max_tokens: z.number().int().positive().optional(),
});

// ============================================
// Feature #716: AI Cost Analytics Schemas
// ============================================

export const aiCostBudgetBodySchema = z.object({
  monthly_budget_usd: z.number().min(0).optional(),
  daily_budget_usd: z.number().min(0).optional(),
  alert_threshold_percent: z.number().min(0).max(100).optional(),
});

// ============================================
// Feature #716: Test Simulation Schemas (generic)
// ============================================

export const testSimulationBodySchema = z.object({
  url: z.string().optional(),
  scenario: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

// Monitoring Types
export type AlertRoutingRuleIdParams = z.infer<typeof alertRoutingRuleIdParamsSchema>;
export type AlertGroupingRuleIdParams = z.infer<typeof alertGroupingRuleIdParamsSchema>;
export type AlertGroupIdParams = z.infer<typeof alertGroupIdParamsSchema>;
export type CorrelationIdParams = z.infer<typeof correlationIdParamsSchema>;
export type RunbookIdParams = z.infer<typeof runbookIdParamsSchema>;
export type IncidentIdParams = z.infer<typeof incidentIdParamsSchema>;
export type StatusPageIdParams = z.infer<typeof statusPageIdParamsSchema>;
export type OnCallScheduleIdParams = z.infer<typeof onCallScheduleIdParamsSchema>;
export type EscalationPolicyIdParams = z.infer<typeof escalationPolicyIdParamsSchema>;
