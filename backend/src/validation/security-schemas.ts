/**
 * Security Validation Schemas
 * Extracted from schemas.ts - DAST, SAST, dependency scanning, vulnerability tracking
 */

import { z } from 'zod';
import { uuidSchema } from './common-schemas.js';

// ============================================================================
// Feature #715: DAST Schemas
// ============================================================================

export const dastProjectIdParamsSchema = z.object({
  projectId: uuidSchema,
});

export const dastScanIdParamsSchema = z.object({
  projectId: uuidSchema,
  scanId: z.string().min(1),
});

export const dastAlertIdParamsSchema = z.object({
  projectId: uuidSchema,
  scanId: z.string().min(1),
  alertId: z.string().min(1),
});

export const dastFalsePositiveIdParamsSchema = z.object({
  projectId: uuidSchema,
  falsePositiveId: z.string().min(1),
});

export const dastTriggerScanBodySchema = z.object({
  targetUrl: z.string().url('Invalid URL format').optional(),
  scanProfile: z.enum(['baseline', 'full', 'api']).optional(),
});

export const dastFalsePositiveBodySchema = z.object({
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

export const dastAlertsQuerySchema = z.object({
  risk: z.string().optional(),
  confidence: z.string().optional(),
  includeFalsePositives: z.string().optional(),
});

export const dastReportQuerySchema = z.object({
  format: z.enum(['pdf', 'html', 'json']).default('html'),
});

export const dastStatsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const dastOpenApiUploadBodySchema = z.object({
  content: z.string().min(1, 'OpenAPI specification content is required'),
  name: z.string().max(255).default('API Specification'),
});

export const dastGraphqlScanBodySchema = z.object({
  endpoint: z.string().url('Invalid GraphQL endpoint URL'),
  authHeader: z.string().optional(),
  testQueries: z.array(z.string()).optional(),
  includeIntrospection: z.boolean().default(true),
});

export const dastGraphqlIntrospectBodySchema = z.object({
  endpoint: z.string().url('Invalid GraphQL endpoint URL'),
  authHeader: z.string().optional(),
});

export const dastGraphqlScanIdParamsSchema = z.object({
  scanId: z.string().min(1),
});

export const dastGraphqlScansQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.string().optional(),
});

export const dastProfileUpdateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  target_url: z.string().url().optional(),
  scan_type: z.enum(['baseline', 'full', 'api']).optional(),
  authentication: z.record(z.unknown()).optional(),
});

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

export const dastOpenApiBodySchema = z.object({
  content: z.string().min(1, 'OpenAPI specification content is required'),
  name: z.string().max(255).default('API Specification'),
});

export const dastScheduleBodySchema = z.object({
  target_url: z.string().url('Invalid URL format'),
  scan_profile: z.enum(['baseline', 'full', 'api']).default('baseline'),
  frequency: z.string().min(1, 'Frequency is required'),
  enabled: z.boolean().default(true),
});

// ============================================================================
// Feature #715: SAST Schemas
// ============================================================================

export const sastProjectIdParamsSchema = z.object({
  projectId: uuidSchema,
});

export const sastScanIdParamsSchema = z.object({
  projectId: uuidSchema,
  scanId: uuidSchema,
});

export const sastTriggerScanBodySchema = z.object({
  branch: z.string().max(255).default('main'),
});

export const sastDashboardQuerySchema = z.object({
  severity: z.string().optional(),
  category: z.string().optional(),
  sortBy: z.enum(['date', 'severity', 'project']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const sastTrendsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const sastScansQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const autoQuarantineSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  flakiness_threshold: z.number().min(0).max(1).optional(),
  quarantine_reason_prefix: z.string().max(100).optional(),
  notify_on_quarantine: z.boolean().optional(),
});

export const retryStrategySettingsSchema = z.object({
  enabled: z.boolean().optional(),
  default_retries: z.number().int().min(0).max(10).optional(),
  rules: z.array(z.object({
    min_score: z.number().min(0).max(1),
    max_score: z.number().min(0).max(1.01),
    retries: z.number().int().min(0).max(10),
  })).optional(),
});

export const sastConfigUpdateBodySchema = z.object({
  enabled: z.boolean().optional(),
  auto_scan: z.boolean().optional(),
  scan_on_push: z.boolean().optional(),
  languages: z.array(z.string()).optional(),
  severity_threshold: z.enum(['info', 'warning', 'error', 'critical']).optional(),
  exclude_patterns: z.array(z.string()).optional(),
  custom_rules: z.array(z.record(z.unknown())).optional(),
});

// ============================================================================
// SAST sub-routes
// ============================================================================

export const sastProjectSubParamsSchema = z.object({
  projectId: z.string().min(1),
  patternId: z.string().min(1).optional(),
  ruleId: z.string().min(1).optional(),
  fpId: z.string().min(1).optional(),
});

export const createSecretPatternBodySchema = z.object({
  name: z.string().min(1, 'Pattern name is required').max(255),
  pattern: z.string().min(1, 'Pattern is required'),
  description: z.string().max(1000).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  enabled: z.boolean().optional(),
});

export const updateSecretPatternBodySchema = createSecretPatternBodySchema.partial();

export const createCustomSastRuleBodySchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(255),
  pattern: z.string().min(1, 'Pattern is required'),
  description: z.string().max(1000).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  language: z.string().optional(),
  category: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const updateCustomSastRuleBodySchema = createCustomSastRuleBodySchema.partial();

export const gitleaksConfigBodySchema = z.object({
  enabled: z.boolean().optional(),
  scan_on_push: z.boolean().optional(),
  severity_threshold: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  full_history: z.boolean().optional(),
  custom_patterns: z.array(z.record(z.unknown())).optional(),
});

export const gitleaksScanBodySchema = z.object({
  branch: z.string().max(255).optional(),
  full_history: z.boolean().optional(),
});

export const sastFalsePositiveBodySchema = z.object({
  finding_id: z.string().min(1).optional(),
  reason: z.string().min(1, 'Reason is required').max(2000),
  pattern: z.string().optional(),
  file_path: z.string().optional(),
});

// ============================================================================
// Security Advanced
// ============================================================================

export const securityScanTriggerBodySchema = z.object({
  scan_type: z.string().optional(),
  target_url: z.string().url().optional(),
  branch: z.string().max(255).optional(),
});

export const dismissVulnerabilityBodySchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(2000),
  comment: z.string().max(5000).optional(),
  expires_at: z.string().optional(),
});

export const licensePolicyBodySchema = z.object({
  name: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  allowlist: z.array(z.string()).optional(),
  blocklist: z.array(z.string()).optional(),
});

export const validateLicenseBodySchema = z.object({
  license: z.string().min(1, 'License is required'),
});

export const securityDastScanBodySchema = z.object({
  target_url: z.string().url('Invalid target URL'),
  scan_type: z.enum(['baseline', 'full', 'api']).optional(),
  authentication: z.record(z.unknown()).optional(),
});

export const securityReportBodySchema = z.object({
  format: z.enum(['pdf', 'html', 'json']).optional(),
  include_resolved: z.boolean().optional(),
  severity_filter: z.array(z.string()).optional(),
});

export const securityPolicyBodySchema = z.object({
  auto_scan_enabled: z.boolean().optional(),
  scan_on_push: z.boolean().optional(),
  severity_threshold: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  block_on_critical: z.boolean().optional(),
  notification_channels: z.array(z.string()).optional(),
});

export const containerScanQuerySchema = z.object({
  image: z.string().min(1, 'Image is required'),
  project_id: z.string().optional(),
  severity: z.string().optional(),
  include_layers: z.string().optional(),
  include_base: z.string().optional(),
  skip_cache: z.string().optional(),
});

export const securityScanScheduleBodySchema = z.object({
  name: z.string().min(1).max(255),
  project_id: z.string().min(1),
  scan_type: z.string().optional(),
  cron_expression: z.string().optional(),
  enabled: z.boolean().optional(),
});

// ============================================================================
// Dependency Scanning Schemas
// ============================================================================

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

// ============================================================================
// Vulnerability Tracking Schemas
// ============================================================================

export const vulnerabilityIdParamsSchema = z.object({
  vulnerabilityId: z.string().min(1, 'Vulnerability ID is required'),
});

export const multiLanguageConfigBodySchema = z.object({
  languages: z.array(z.string().min(1)).optional(),
  auto_detect: z.boolean().optional(),
  scan_depth: z.number().int().positive().optional(),
});

// ============================================================================
// Dependency Lists
// ============================================================================

export const dependencyListEntryBodySchema = z.object({
  package_name: z.string().min(1, 'Package name is required'),
  version_pattern: z.string().optional(),
  reason: z.string().min(1, 'Reason is required').max(2000),
  severity_override: z.string().optional(),
  expires_at: z.string().optional(),
});

export const dependencyAgeConfigBodySchema = z.object({
  enabled: z.boolean().optional(),
  warning_threshold_days: z.number().int().min(1).optional(),
  critical_threshold_days: z.number().int().min(1).optional(),
  auto_create_issues: z.boolean().optional(),
});

export const autoPrConfigBodySchema = z.object({
  enabled: z.boolean().optional(),
  auto_merge: z.boolean().optional(),
  branch_prefix: z.string().max(100).optional(),
  commit_message_template: z.string().max(500).optional(),
  labels: z.array(z.string()).optional(),
  reviewers: z.array(z.string()).optional(),
  max_prs_per_day: z.number().int().min(0).max(50).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

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
export type SastProjectIdParams = z.infer<typeof sastProjectIdParamsSchema>;
export type SastScanIdParams = z.infer<typeof sastScanIdParamsSchema>;
export type SastTriggerScanBodyInput = z.infer<typeof sastTriggerScanBodySchema>;
export type SastDashboardQuery = z.infer<typeof sastDashboardQuerySchema>;
export type SastTrendsQuery = z.infer<typeof sastTrendsQuerySchema>;
export type SastScansQuery = z.infer<typeof sastScansQuerySchema>;
export type AutoQuarantineSettingsInput = z.infer<typeof autoQuarantineSettingsSchema>;
export type RetryStrategySettingsInput = z.infer<typeof retryStrategySettingsSchema>;
export type SastConfigUpdateBodyInput = z.infer<typeof sastConfigUpdateBodySchema>;
export type DastProfileUpdateBodyInput = z.infer<typeof dastProfileUpdateBodySchema>;
export type DastConfigUpdateBodyInput = z.infer<typeof dastConfigUpdateBodySchema>;
export type DastScheduleBodyInput = z.infer<typeof dastScheduleBodySchema>;
export type SecurityDastScanBody = z.infer<typeof securityDastScanBodySchema>;
export type SecurityReportBody = z.infer<typeof securityReportBodySchema>;
export type SecurityPolicyBody = z.infer<typeof securityPolicyBodySchema>;
