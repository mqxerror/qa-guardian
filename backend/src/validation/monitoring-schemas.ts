/**
 * Monitoring Validation Schemas
 * Extracted from schemas.ts - uptime, alerts, incidents, status pages, on-call
 */

import { z } from 'zod';

// ============================================================================
// Monitoring: Uptime
// ============================================================================

export const createUptimeCheckBodySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  url: z.string().url('Valid URL is required'),
  check_interval: z.number().int().min(30).max(86400).optional(),
  timeout: z.number().int().min(1000).max(60000).optional(),
  regions: z.array(z.string()).optional(),
  expected_status: z.number().int().min(100).max(599).optional(),
  method: z.enum(['GET', 'HEAD', 'POST']).optional(),
  headers: z.record(z.string()).optional(),
  body: z.string().optional(),
  assertions: z.array(z.record(z.unknown())).optional(),
  tags: z.array(z.string()).optional(),
  notification_channels: z.array(z.string()).optional(),
  ssl_check: z.boolean().optional(),
  follow_redirects: z.boolean().optional(),
});

export const updateUptimeCheckBodySchema = createUptimeCheckBodySchema.partial();

export const bulkUptimeCheckActionBodySchema = z.object({
  action: z.enum(['enable', 'disable', 'delete', 'run']),
  checkIds: z.array(z.string()).optional(),
  group: z.string().optional(),
});

export const uptimeCheckIdParamsSchema = z.object({
  checkId: z.string().min(1, 'Check ID is required'),
});

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

// ============================================================================
// Monitoring: Maintenance
// ============================================================================

export const createMaintenanceWindowBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  reason: z.string().max(1000).optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  duration_hours: z.number().min(0.1).max(168).optional(),
  recurring: z.boolean().optional(),
  cron_expression: z.string().optional(),
});

export const maintenanceWindowParamsSchema = z.object({
  checkId: z.string().min(1),
  windowId: z.string().min(1),
});

export const muteCheckBodySchema = z.object({
  reason: z.string().max(1000).optional(),
  duration_hours: z.number().min(0.1).max(168).optional(),
});

// ============================================================================
// Alert Routing Schemas
// ============================================================================

export const alertRoutingRuleIdParamsSchema = z.object({
  ruleId: z.string().min(1, 'Rule ID is required'),
});

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

export const updateAlertRoutingRuleBodySchema = createAlertRoutingRuleBodySchema.partial();

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

export const alertRateLimitConfigBodySchema = z.object({
  enabled: z.boolean(),
  max_alerts_per_minute: z.number().int().min(1),
  time_window_seconds: z.number().int().min(1),
  suppression_mode: z.enum(['drop', 'aggregate']),
  aggregate_threshold: z.number().int().min(1),
});

export const alertRateLimitTestBodySchema = z.object({
  alert_count: z.number().int().min(1).max(100).optional(),
});

// ============================================================================
// Alert Grouping Schemas
// ============================================================================

export const alertGroupingRuleIdParamsSchema = z.object({
  ruleId: z.string().min(1, 'Rule ID is required'),
});

export const alertGroupIdParamsSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
});

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

export const updateAlertGroupingRuleBodySchema = createAlertGroupingRuleBodySchema.extend({
  is_active: z.boolean().optional(),
}).partial();

export const alertGroupAcknowledgeBodySchema = z.object({
  note: z.string().max(2000).optional(),
});

export const alertGroupResolveBodySchema = z.object({
  resolution_notes: z.string().max(5000).optional(),
});

export const alertGroupSnoozeBodySchema = z.object({
  duration_hours: z.number().min(0.1).max(168),
});

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
// Alert Correlation Schemas
// ============================================================================

export const alertCorrelationConfigBodySchema = z.object({
  enabled: z.boolean(),
  correlate_by_check: z.boolean(),
  correlate_by_location: z.boolean(),
  correlate_by_error_type: z.boolean(),
  correlate_by_time_window: z.boolean(),
  time_window_seconds: z.number().int().min(1),
  similarity_threshold: z.number().int().min(0).max(100),
});

export const correlationIdParamsSchema = z.object({
  correlationId: z.string().min(1, 'Correlation ID is required'),
});

export const alertCorrelationTestBodySchema = z.object({
  alert_count: z.number().int().min(1).max(100).optional(),
  scenario: z.enum(['same_check', 'same_location', 'similar_error', 'mixed']).optional(),
});

export const runbookIdParamsSchema = z.object({
  runbookId: z.string().min(1, 'Runbook ID is required'),
});

export const createAlertRunbookBodySchema = z.object({
  name: z.string().min(1, 'Runbook name is required').max(255),
  description: z.string().max(2000).optional(),
  check_type: z.string().min(1),
  severity: z.string().optional(),
  runbook_url: z.string().url('Invalid runbook URL'),
  instructions: z.string().max(10000).optional(),
  tags: z.array(z.string()).optional(),
});

export const updateAlertRunbookBodySchema = createAlertRunbookBodySchema.partial();

export const testRunbookMatchBodySchema = z.object({
  check_type: z.string().min(1),
  severity: z.string().min(1),
  check_name: z.string().optional(),
  error_message: z.string().optional(),
});

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
// Alert Channels
// ============================================================================

export const alertChannelProjectParamsSchema = z.object({
  projectId: z.string().min(1),
});

export const alertChannelIdParamsSchema = z.object({
  projectId: z.string().min(1),
  channelId: z.string().min(1),
});

export const createAlertChannelBodySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  type: z.enum(['email', 'slack', 'webhook', 'pagerduty', 'teams']),
  config: z.record(z.unknown()),
  events: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
});

export const updateAlertChannelBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.enum(['email', 'slack', 'webhook', 'pagerduty', 'teams']).optional(),
  config: z.record(z.unknown()).optional(),
  events: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
});

// ============================================================================
// Incidents Schemas
// ============================================================================

export const incidentIdParamsSchema = z.object({
  incidentId: z.string().min(1, 'Incident ID is required'),
});

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

export const updateIncidentStatusBodySchema = z.object({
  status: z.enum(['triggered', 'acknowledged', 'investigating', 'identified', 'monitoring', 'resolved']),
  resolution_summary: z.string().max(5000).optional(),
  postmortem_url: z.string().url().optional(),
});

export const addIncidentResponderBodySchema = z.object({
  user_id: z.string().min(1),
  user_name: z.string().min(1),
  user_email: z.string().email(),
  role: z.enum(['primary', 'secondary', 'observer']).optional(),
});

export const addIncidentNoteBodySchema = z.object({
  content: z.string().min(1, 'Note content is required').max(10000),
  visibility: z.enum(['internal', 'public']).optional(),
});

export const resolveIncidentBodySchema = z.object({
  resolution_summary: z.string().min(1).max(5000),
  postmortem_url: z.string().url().optional(),
  postmortem_completed: z.boolean().optional(),
});

// ============================================================================
// Status Pages Schemas
// ============================================================================

export const statusPageIdParamsSchema = z.object({
  pageId: z.string().min(1, 'Page ID is required'),
});

export const statusPageIncidentParamsSchema = z.object({
  pageId: z.string().min(1),
  incidentId: z.string().min(1),
});

export const statusPageSlugParamsSchema = z.object({
  slug: z.string().min(1).max(100),
});

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

export const updateStatusPageBodySchema = createStatusPageBodySchema.extend({
  custom_domain: z.string().max(255).optional(),
}).partial();

export const createStatusPageIncidentBodySchema = z.object({
  title: z.string().min(1).max(500),
  status: z.enum(['investigating', 'identified', 'monitoring', 'resolved']),
  impact: z.enum(['none', 'minor', 'major', 'critical']),
  message: z.string().min(1).max(5000),
  affected_components: z.array(z.string()).optional(),
});

export const createStatusPageIncidentUpdateBodySchema = z.object({
  status: z.enum(['investigating', 'identified', 'monitoring', 'resolved']),
  message: z.string().min(1).max(5000),
});

export const statusPageSubscribeBodySchema = z.object({
  email: z.string().email().optional(),
});

// ============================================================================
// On-Call & Escalation Schemas
// ============================================================================

export const onCallScheduleIdParamsSchema = z.object({
  scheduleId: z.string().min(1, 'Schedule ID is required'),
});

export const escalationPolicyIdParamsSchema = z.object({
  policyId: z.string().min(1, 'Policy ID is required'),
});

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

export const updateOnCallScheduleBodySchema = createOnCallScheduleBodySchema.extend({
  is_active: z.boolean().optional(),
}).partial();

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

export const updateEscalationPolicyBodySchema = createEscalationPolicyBodySchema.extend({
  is_active: z.boolean().optional(),
}).partial();

// ============================================================================
// Type Exports
// ============================================================================

export type MonitoringCheckIdParams = z.infer<typeof monitoringCheckIdParamsSchema>;
export type MonitoringWebhookTokenParams = z.infer<typeof monitoringWebhookTokenParamsSchema>;
export type CreateMonitoringWebhookBodyInput = z.infer<typeof createMonitoringWebhookBodySchema>;
export type AlertRoutingRuleIdParams = z.infer<typeof alertRoutingRuleIdParamsSchema>;
export type AlertGroupingRuleIdParams = z.infer<typeof alertGroupingRuleIdParamsSchema>;
export type AlertGroupIdParams = z.infer<typeof alertGroupIdParamsSchema>;
export type CorrelationIdParams = z.infer<typeof correlationIdParamsSchema>;
export type RunbookIdParams = z.infer<typeof runbookIdParamsSchema>;
export type IncidentIdParams = z.infer<typeof incidentIdParamsSchema>;
export type StatusPageIdParams = z.infer<typeof statusPageIdParamsSchema>;
export type OnCallScheduleIdParams = z.infer<typeof onCallScheduleIdParamsSchema>;
export type EscalationPolicyIdParams = z.infer<typeof escalationPolicyIdParamsSchema>;
export type CreateAlertChannelBody = z.infer<typeof createAlertChannelBodySchema>;
export type UpdateAlertChannelBody = z.infer<typeof updateAlertChannelBodySchema>;
export type CreateUptimeCheckBody = z.infer<typeof createUptimeCheckBodySchema>;
export type UpdateUptimeCheckBody = z.infer<typeof updateUptimeCheckBodySchema>;
export type CreateMaintenanceWindowBody = z.infer<typeof createMaintenanceWindowBodySchema>;
