/**
 * Remaining Route Validation Schemas
 * Extracted from schemas.ts - schedules, webhooks, healing, visual, GitHub, AI, recordings, misc
 */

import { z } from 'zod';
import { uuidSchema } from './common-schemas.js';

// ============================================================================
// Schedule Schemas
// ============================================================================

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

// ============================================================================
// Webhook Schemas
// ============================================================================

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

export const webhookTestSubscriptionParamsSchema = z.object({
  subscriptionId: z.string().min(1),
});

export const webhookDeliveryRetryBodySchema = z.object({
  subscription_id: z.string().optional(),
  event_type: z.string().optional(),
});

// ============================================================================
// AI Usage Schemas
// ============================================================================

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

export const aiGenericRequestBodySchema = z.object({
  description: z.string().optional(),
  test_type: z.string().optional(),
  code: z.string().optional(),
  steps: z.array(z.record(z.unknown())).optional(),
  context: z.record(z.unknown()).optional(),
  url: z.string().optional(),
  name: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

// ============================================================================
// AI Providers Schemas
// ============================================================================

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

export const aiCostBudgetBodySchema = z.object({
  monthly_budget_usd: z.number().min(0).optional(),
  daily_budget_usd: z.number().min(0).optional(),
  alert_threshold_percent: z.number().min(0).max(100).optional(),
});

// ============================================================================
// Healing Schemas
// ============================================================================

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

export const healingEventFeedbackBodySchema = z.object({
  accepted: z.boolean(),
  notes: z.string().max(2000).optional(),
});

export const healingEventParamsSchema = z.object({
  testId: z.string().min(1),
  eventId: z.string().min(1),
});

export const selectorOverrideParamsSchema = z.object({
  testId: z.string().min(1),
  stepId: z.string().min(1),
});

export const updateSelectorOverrideBodySchema = z.object({
  selector: z.string().min(1, 'Selector is required'),
  strategy: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

// ============================================================================
// Visual Baseline Schemas
// ============================================================================

export const baselineTestIdParamsSchema = z.object({
  testId: z.string().min(1, 'Test ID is required'),
});

export const baselineQuerySchema = z.object({
  viewport: z.string().optional(),
  branch: z.string().optional(),
});

export const approveBaselineBodySchema = z.object({
  runId: z.string().optional(),
  viewport: z.string().optional(),
  branch: z.string().optional(),
  expectedVersion: z.number().int().min(0).optional(),
});

export const approveBaselineConvenienceBodySchema = z.object({
  test_id: z.string().min(1, 'test_id is required'),
  run_id: z.string().optional(),
  viewport_id: z.string().optional(),
});

export const rejectBaselineConvenienceBodySchema = z.object({
  test_id: z.string().min(1, 'test_id is required'),
  run_id: z.string().optional(),
  viewport_id: z.string().optional(),
  reason: z.string().max(2000).optional(),
});

export const rejectVisualBodySchema = z.object({
  runId: z.string().min(1, 'runId is required'),
  viewport: z.string().optional(),
  reason: z.string().max(2000).optional(),
});

export const mergeBaselineBodySchema = z.object({
  sourceBranch: z.string().min(1, 'Source branch is required'),
  targetBranch: z.string().optional(),
  viewport: z.string().optional(),
});

export const restoreBaselineBodySchema = z.object({
  viewport: z.string().optional(),
  branch: z.string().optional(),
});

export const baselineHistoryRestoreParamsSchema = z.object({
  testId: z.string().min(1),
  historyId: z.string().min(1),
});

export const uploadRetryParamsSchema = z.object({
  uploadId: z.string().min(1),
});

export const deleteBaselineQuerySchema = z.object({
  viewport: z.string().optional(),
  branch: z.string().optional(),
});

export const cleanupBaselinesBodySchema = z.object({
  olderThanDays: z.number().int().min(1).max(365).optional(),
  dryRun: z.boolean().optional(),
});

export const mockPendingVisualBodySchema = z.object({
  count: z.number().int().min(1).max(100).optional(),
  test_ids: z.array(z.string()).optional(),
});

export const visualBatchApproveBodySchema = z.object({
  diff_ids: z.array(z.string().min(1)).min(1, 'At least one diff ID is required'),
  note: z.string().optional(),
});

export const visualBatchRejectBodySchema = z.object({
  diff_ids: z.array(z.string().min(1)).min(1, 'At least one diff ID is required'),
  reason: z.string().optional(),
});

// ============================================================================
// Review & Export Schemas
// ============================================================================

export const reviewResultBodySchema = z.object({
  notes: z.string().max(5000).optional(),
});

export const bugReportBodySchema = z.object({
  format: z.string().optional(),
  include_screenshots: z.boolean().optional(),
  include_trace: z.boolean().optional(),
  additional_context: z.string().max(5000).optional(),
});

export const annotationBodySchema = z.object({
  text: z.string().min(1, 'Annotation text is required').max(5000),
  type: z.string().max(50).optional(),
  priority: z.string().max(50).optional(),
});

export const annotationIdParamsSchema = z.object({
  runId: z.string().min(1),
  testId: z.string().min(1),
  annotationId: z.string().min(1),
});

export const shareResultBodySchema = z.object({
  expires_in_hours: z.number().min(1).max(720).optional(),
  include_artifacts: z.boolean().optional(),
});

// ============================================================================
// GitHub Schemas
// ============================================================================

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

export const githubConnectBodySchema = z.object({
  token: z.string().optional(),
  installation_id: z.string().optional(),
});

export const githubPrStatusBodySchema = z.object({
  status: z.string().min(1),
  description: z.string().optional(),
  test_run_id: z.string().optional(),
});

export const githubPrCommentBodySchema = z.object({
  passed: z.number().int().min(0),
  failed: z.number().int().min(0),
  skipped: z.number().int().min(0),
  test_run_id: z.string().optional(),
});

export const githubBranchUpdateBodySchema = z.object({
  branch: z.string().min(1, 'Branch is required').max(255),
});

export const githubPrChecksToggleBodySchema = z.object({
  pr_checks_enabled: z.boolean(),
});

export const githubPrCommentsToggleBodySchema = z.object({
  pr_comments_enabled: z.boolean(),
});

export const githubProjectPrParamsSchema = z.object({
  projectId: z.string().min(1),
  prNumber: z.string().min(1),
});

// ============================================================================
// Audit Logs Schemas
// ============================================================================

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
// Slack Integration
// ============================================================================

export const slackOrgParamsSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
});

export const slackConnectBodySchema = z.object({
  workspace_name: z.string().max(255).optional(),
});

// ============================================================================
// Flaky Tests
// ============================================================================

export const flakyTestQuarantineBodySchema = z.object({
  test_id: z.string().min(1, 'Test ID is required'),
  reason: z.string().max(1000).optional(),
});

export const flakyTestUnquarantineBodySchema = z.object({
  test_id: z.string().min(1, 'Test ID is required'),
});

// ============================================================================
// Error Report
// ============================================================================

export const errorReportBodySchema = z.object({
  message: z.string().min(1, 'Error message is required').max(5000),
  stack: z.string().max(20000).optional(),
  componentStack: z.string().max(20000).optional(),
  url: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
  browser: z.string().max(100).optional(),
  os: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================================
// Recording Routes
// ============================================================================

export const recordingIdParamsSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

export const startRecordingBodySchema = z.object({
  target_url: z.string().url('Valid URL is required'),
  suite_id: z.string().min(1, 'Suite ID is required'),
  device_config: z.object({
    device_name: z.string().optional(),
    viewport_width: z.number().int().positive().optional(),
    viewport_height: z.number().int().positive().optional(),
    user_agent: z.string().optional(),
    is_mobile: z.boolean().optional(),
    has_touch: z.boolean().optional(),
    device_scale_factor: z.number().positive().optional(),
  }).optional(),
});

export const stopRecordingBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  suite_id: z.string().optional(),
});

// ============================================================================
// Artifact Delete
// ============================================================================

export const deleteArtifactsBodySchema = z.object({
  test_id: z.string().optional(),
  artifact_types: z.array(z.string()).optional(),
  older_than_days: z.number().int().min(1).optional(),
  dry_run: z.boolean().optional(),
});

// ============================================================================
// API Key Schemas
// ============================================================================

export const apiKeyOrgParamsSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
});

export const apiKeyIdParamsSchema = z.object({
  id: z.string().min(1, 'API key ID is required'),
});

export const createApiKeyBodySchema = z.object({
  name: z.string().min(1, 'API key name is required').max(255),
  scopes: z.array(z.string()).default(['read']),
  expires_in_days: z.number().int().min(1).max(365).optional(),
  rate_limit: z.number().int().min(1).max(10000).optional(),
  rate_limit_window: z.number().int().min(1).max(3600).optional(),
  burst_limit: z.number().int().min(1).max(1000).optional(),
  burst_window: z.number().int().min(1).max(300).optional(),
});

export const validateMcpKeyBodySchema = z.object({
  api_key: z.string().min(1, 'API key is required'),
  required_scope: z.string().default('mcp'),
});

// ============================================================================
// Test Simulation
// ============================================================================

export const testSimulationBodySchema = z.object({
  url: z.string().optional(),
  scenario: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type ScheduleIdParams = z.infer<typeof scheduleIdParamsSchema>;
export type CreateScheduleBodyInput = z.infer<typeof createScheduleBodySchema>;
export type UpdateScheduleBodyInput = z.infer<typeof updateScheduleBodySchema>;
export type WebhookSubscriptionIdParams = z.infer<typeof webhookSubscriptionIdParamsSchema>;
export type TestWebhookUrlBodyInput = z.infer<typeof testWebhookUrlBodySchema>;
export type CreateWebhookSubscriptionBodyInput = z.infer<typeof createWebhookSubscriptionBodySchema>;
export type UpdateWebhookSubscriptionBodyInput = z.infer<typeof updateWebhookSubscriptionBodySchema>;
export type AiUsageQuery = z.infer<typeof aiUsageQuerySchema>;
export type AiUsageBudgetBodyInput = z.infer<typeof aiUsageBudgetBodySchema>;
export type HealingApprovalIdParams = z.infer<typeof healingApprovalIdParamsSchema>;
export type HealingIdParams = z.infer<typeof healingIdParamsSchema>;
export type HealingApprovalBodyInput = z.infer<typeof healingApprovalBodySchema>;
export type HealingBulkUpdateBodyInput = z.infer<typeof healingBulkUpdateBodySchema>;
export type BaselineTestIdParams = z.infer<typeof baselineTestIdParamsSchema>;
export type GithubRepoParams = z.infer<typeof githubRepoParamsSchema>;
export type GithubConnectProjectBodyInput = z.infer<typeof githubConnectProjectBodySchema>;
export type AuditLogsOrgIdParams = z.infer<typeof auditLogsOrgIdParamsSchema>;
export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;
export type ApiKeyOrgParams = z.infer<typeof apiKeyOrgParamsSchema>;
export type ApiKeyIdParams = z.infer<typeof apiKeyIdParamsSchema>;
export type CreateApiKeyBodyInput = z.infer<typeof createApiKeyBodySchema>;
export type ValidateMcpKeyBodyInput = z.infer<typeof validateMcpKeyBodySchema>;
export type ApproveBaselineBody = z.infer<typeof approveBaselineBodySchema>;
export type ReviewResultBody = z.infer<typeof reviewResultBodySchema>;
export type AnnotationBody = z.infer<typeof annotationBodySchema>;
export type ShareResultBody = z.infer<typeof shareResultBodySchema>;
export type CleanupBaselinesBody = z.infer<typeof cleanupBaselinesBodySchema>;
export type ErrorReportBody = z.infer<typeof errorReportBodySchema>;
