/**
 * Monitoring Types Module
 *
 * Shared type definitions for all monitoring modules.
 * Extracted from monitoring.ts (Feature #1374)
 */

// Global monitoring locations
export type MonitoringLocation = 'us-east' | 'us-west' | 'europe' | 'asia-pacific' | 'australia';

// MONITORING_LOCATIONS is defined in helpers.ts to avoid duplicate exports

// Assertion types for uptime checks
export interface UptimeAssertion {
  type: 'responseTime' | 'statusCode' | 'bodyContains' | 'headerContains';
  operator: 'lessThan' | 'greaterThan' | 'equals' | 'contains';
  value: string | number;
}

// Uptime check interface
export interface UptimeCheck {
  id: string;
  organization_id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE' | 'PATCH';
  interval: number; // in seconds (30-300)
  timeout: number; // in milliseconds
  expected_status: number;
  headers?: Record<string, string>;
  body?: string; // Request body for POST/PUT/PATCH
  locations: MonitoringLocation[]; // Geographic locations to run check from
  assertions?: UptimeAssertion[]; // Assertions to validate response
  ssl_expiry_warning_days?: number; // Alert when SSL cert expires in this many days (default: 30)
  consecutive_failures_threshold?: number; // Only alert after N consecutive failures (default: 1)
  tags?: string[]; // Tags for organizing and filtering checks
  group?: string; // Group name for organizing checks
  enabled: boolean;
  // Feature #944: Pause tracking fields
  paused_at?: Date; // When the check was paused
  paused_by?: string; // Who paused it (email)
  pause_reason?: string; // Why it was paused
  pause_expires_at?: Date; // When the pause expires (auto-resume)
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// Maintenance window interface
export interface MaintenanceWindow {
  id: string;
  check_id: string;
  name: string;
  start_time: Date;
  end_time: Date;
  reason?: string;
  created_by: string;
  created_at: Date;
}

// Assertion result
export interface AssertionResult {
  type: string;
  operator: string;
  expected: string | number;
  actual: string | number;
  passed: boolean;
}

// SSL certificate info interface
export interface SSLCertificateInfo {
  valid: boolean;
  issuer: string;
  subject: string;
  valid_from: Date;
  valid_to: Date;
  days_until_expiry: number;
  fingerprint: string;
}

// Check result interface
export interface CheckResult {
  id: string;
  check_id: string;
  location: MonitoringLocation; // Location check was run from
  status: 'up' | 'down' | 'degraded';
  response_time: number; // in milliseconds
  status_code: number;
  error?: string;
  assertion_results?: AssertionResult[]; // Results of assertion checks
  assertions_passed?: number;
  assertions_failed?: number;
  ssl_info?: SSLCertificateInfo; // SSL certificate information for HTTPS URLs
  checked_at: Date;
}

// Transaction step interface
export interface TransactionStep {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  expected_status: number;
  assertions?: {
    type: 'status' | 'responseTime' | 'bodyContains' | 'headerContains';
    value: string | number;
    operator?: 'equals' | 'contains' | 'lessThan' | 'greaterThan';
  }[];
  timeout: number;
}

// Transaction check interface
export interface TransactionCheck {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  steps: TransactionStep[];
  interval: number; // in seconds
  enabled: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// Transaction result interface
export interface TransactionResult {
  id: string;
  transaction_id: string;
  status: 'passed' | 'failed' | 'partial';
  total_time: number; // total time for all steps
  step_results: {
    step_id: string;
    step_name: string;
    status: 'passed' | 'failed';
    response_time: number;
    status_code: number;
    error?: string;
    assertions_passed: number;
    assertions_failed: number;
  }[];
  checked_at: Date;
}

// Performance check interface - Core Web Vitals monitoring
export interface PerformanceCheck {
  id: string;
  organization_id: string;
  name: string;
  url: string;
  interval: number; // in seconds
  device: 'desktop' | 'mobile';
  enabled: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// Core Web Vitals result interface
export interface PerformanceResult {
  id: string;
  check_id: string;
  status: 'good' | 'needs_improvement' | 'poor';
  metrics: {
    // Core Web Vitals
    lcp: number; // Largest Contentful Paint (ms)
    fid: number; // First Input Delay (ms)
    cls: number; // Cumulative Layout Shift (score)
    // Additional metrics
    ttfb: number; // Time to First Byte (ms)
    fcp: number; // First Contentful Paint (ms)
    tti: number; // Time to Interactive (ms)
    tbt: number; // Total Blocking Time (ms)
    si: number; // Speed Index
    // Resource metrics
    total_size: number; // Total page size in KB
    request_count: number;
    dom_elements: number;
  };
  lighthouse_score: number; // 0-100
  checked_at: Date;
}

// Incident interface - represents a period when a check was down
export interface Incident {
  id: string;
  check_id: string;
  status: 'down' | 'degraded';
  started_at: Date;
  ended_at?: Date; // undefined if ongoing
  duration_seconds?: number; // calculated when incident ends
  error?: string;
  affected_locations: string[];
}

// Webhook check interface - monitors incoming webhooks
export interface WebhookCheck {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  webhook_url: string; // Generated unique URL for receiving webhooks
  webhook_secret?: string; // Optional secret for signature validation
  expected_interval: number; // Expected time between webhooks (seconds), alerts if exceeded
  expected_payload?: {
    // JSON schema or key-value pairs to validate
    type: 'json-schema' | 'key-value' | 'any';
    schema?: object; // For json-schema validation
    required_fields?: string[]; // For key-value validation
    field_values?: Record<string, string | number | boolean>; // Expected field values
  };
  enabled: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// Webhook event - represents a received webhook
export interface WebhookEvent {
  id: string;
  check_id: string;
  received_at: Date;
  source_ip: string;
  headers: Record<string, string>;
  payload: unknown;
  payload_valid: boolean;
  validation_errors?: string[];
  signature_valid?: boolean; // If secret is configured
}

// DNS check interface - monitors DNS resolution for domains
export interface DnsCheck {
  id: string;
  organization_id: string;
  name: string;
  domain: string; // Domain to monitor (e.g., example.com)
  record_type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS'; // DNS record type
  expected_values?: string[]; // Expected IP addresses or record values
  nameservers?: string[]; // Optional custom nameservers to use
  interval: number; // Check interval in seconds
  timeout: number; // DNS query timeout in milliseconds
  enabled: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// DNS check result
export interface DnsCheckResult {
  id: string;
  check_id: string;
  status: 'up' | 'down' | 'degraded';
  resolved_values: string[]; // Actual resolved values
  expected_values: string[]; // Expected values (if any)
  response_time: number; // DNS resolution time in milliseconds
  nameserver_used: string; // Which nameserver responded
  error?: string;
  ttl?: number; // TTL of the DNS record
  all_expected_found: boolean; // Whether all expected IPs were found
  unexpected_values: string[]; // Values found that weren't expected
  checked_at: Date;
}

// TCP port check interface - monitors TCP port availability
export interface TcpCheck {
  id: string;
  organization_id: string;
  name: string;
  host: string; // Hostname or IP address
  port: number; // TCP port number (1-65535)
  timeout: number; // Connection timeout in milliseconds
  interval: number; // Check interval in seconds
  enabled: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// TCP check result
export interface TcpCheckResult {
  id: string;
  check_id: string;
  status: 'up' | 'down';
  port_open: boolean;
  response_time: number; // Connection time in milliseconds
  error?: string;
  checked_at: Date;
}

// Monitoring settings interface for retention configuration
export interface MonitoringSettings {
  organization_id: string;
  retention_days: 30 | 90 | 365; // How long to keep check results
  auto_cleanup_enabled: boolean;
  last_cleanup_at?: Date;
  updated_by: string;
  updated_at: Date;
}

// Public status page interface
export interface StatusPage {
  id: string;
  organization_id: string;
  name: string;
  slug: string; // URL-friendly slug for public access (e.g., /status/my-company)
  description?: string;
  logo_url?: string;
  favicon_url?: string;
  primary_color?: string; // Hex color for branding (e.g., #2563EB)
  show_history_days: number; // Number of days of history to show (1-90)
  checks: StatusPageCheck[]; // Which checks to display on the status page
  custom_domain?: string; // Optional custom domain for status page
  is_public: boolean; // Whether the page is publicly accessible
  show_uptime_percentage: boolean; // Show uptime % for each check
  show_response_time: boolean; // Show avg response time for each check
  show_incidents: boolean; // Show incident timeline
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// Status page check configuration
export interface StatusPageCheck {
  check_id: string;
  check_type: 'uptime' | 'transaction' | 'performance' | 'dns' | 'tcp';
  display_name?: string; // Optional override display name
  order: number; // Display order on status page
}

// Status page incident - manual incident communication
export interface StatusPageIncident {
  id: string;
  status_page_id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  impact: 'none' | 'minor' | 'major' | 'critical';
  affected_components?: string[]; // IDs of affected checks
  updates: StatusPageIncidentUpdate[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
  resolved_at?: Date;
}

// Status page incident update
export interface StatusPageIncidentUpdate {
  id: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  message: string;
  created_by: string;
  created_at: Date;
}

// Status page subscription for notifications
export interface StatusPageSubscription {
  id: string;
  status_page_id: string;
  email: string;
  verification_token?: string;
  verified: boolean;
  unsubscribe_token: string;
  created_at: Date;
  verified_at?: Date;
}

// On-call schedule for incident response
export interface OnCallSchedule {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  timezone: string;
  rotation_type: 'daily' | 'weekly' | 'custom';
  rotation_interval_days: number; // For custom rotation
  members: OnCallMember[];
  current_on_call_index: number;
  last_rotation_at?: Date;
  is_active: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// On-call schedule member
export interface OnCallMember {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  phone?: string;
  order: number;
}

// Escalation policy for alert management
export interface EscalationLevel {
  id: string;
  level: number; // 1, 2, 3, etc.
  escalate_after_minutes: number; // Escalate if not acknowledged within this time
  targets: EscalationTarget[];
}

export interface EscalationTarget {
  id: string;
  type: 'user' | 'on_call_schedule' | 'email' | 'webhook';
  user_name?: string;
  user_email?: string;
  phone?: string;
  schedule_id?: string; // Reference to on-call schedule
  webhook_url?: string;
}

export interface EscalationPolicy {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  levels: EscalationLevel[];
  repeat_policy: 'once' | 'repeat_until_acknowledged';
  repeat_interval_minutes?: number; // If repeat_policy is 'repeat_until_acknowledged'
  is_default: boolean;
  is_active: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// Feature #943: Deleted check history storage for audit purposes
export interface DeletedCheckHistory {
  check_id: string;
  check_name: string;
  check_type: 'uptime' | 'performance' | 'transaction' | 'webhook' | 'dns' | 'tcp';
  organization_id: string;
  deleted_by: string;
  deleted_at: Date;
  check_config: Record<string, unknown>; // Preserved check configuration
  historical_results_count: number;
  last_status?: 'up' | 'down' | 'degraded';
}

// Alert grouping interfaces
export interface AlertGroupingRule {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  group_by: ('check_name' | 'check_type' | 'location' | 'error_type' | 'tag')[];
  time_window_minutes: number; // Group alerts within this time window
  deduplication_enabled: boolean;
  deduplication_key?: string; // Custom key for deduplication (e.g., "check_id", "error_message")
  max_alerts_per_group: number; // Maximum alerts before forcing a new group
  notification_delay_seconds: number; // Delay before sending notification (to collect more alerts)
  is_active: boolean;
  priority: number; // Lower number = higher priority
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface AlertGroup {
  id: string;
  organization_id: string;
  rule_id: string;
  group_key: string; // Computed key based on grouping rules
  alerts: GroupedAlert[];
  status: 'active' | 'acknowledged' | 'resolved';
  first_alert_at: Date;
  last_alert_at: Date;
  notification_sent: boolean;
  notification_sent_at?: Date;
  acknowledged_by?: string;
  acknowledged_at?: Date;
  resolved_at?: Date;
  // Snooze fields
  snoozed_until?: Date;
  snoozed_by?: string;
  snoozed_at?: Date;
  snooze_duration_hours?: number;
}

export interface GroupedAlert {
  id: string;
  check_id: string;
  check_name: string;
  check_type: 'uptime' | 'transaction' | 'performance' | 'webhook' | 'dns' | 'tcp';
  location?: string;
  error_message?: string;
  tags?: string[];
  triggered_at: Date;
  deduplicated: boolean;
}

// Alert Routing Rule interface - routes alerts to different channels based on conditions
export interface AlertRoutingCondition {
  field: 'severity' | 'check_type' | 'check_name' | 'location' | 'tag' | 'error_contains';
  operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'not_in';
  value: string | string[];
}

export interface AlertRoutingDestination {
  type: 'pagerduty' | 'slack' | 'email' | 'webhook' | 'opsgenie' | 'on_call' | 'n8n' | 'telegram' | 'teams' | 'discord';
  name: string;
  config: {
    // PagerDuty
    integration_key?: string;
    severity_mapping?: {
      critical?: 'critical' | 'error' | 'warning' | 'info';
      high?: 'critical' | 'error' | 'warning' | 'info';
      medium?: 'critical' | 'error' | 'warning' | 'info';
      low?: 'critical' | 'error' | 'warning' | 'info';
    };
    // Slack
    webhook_url?: string;
    channel?: string;
    // Email
    addresses?: string[];
    // Webhook
    url?: string;
    headers?: Record<string, string>;
    // OpsGenie
    api_key?: string;
    // On-call schedule reference
    schedule_id?: string;
    // n8n
    n8n_webhook_url?: string;
    workflow_id?: string;
    // Telegram (via n8n or direct)
    telegram_bot_token?: string;
    telegram_chat_id?: string;
    message_template?: string;
    // Custom webhook payload template (JSON string with {{variables}})
    payload_template?: string;
    // Microsoft Teams
    teams_webhook_url?: string;
    teams_title?: string;
    teams_theme_color?: string;
    // Discord
    discord_webhook_url?: string;
    discord_username?: string;
    discord_avatar_url?: string;
    discord_embed_color?: string;
  };
}

export interface AlertRoutingRule {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  conditions: AlertRoutingCondition[];
  condition_match: 'all' | 'any'; // All conditions must match or any one
  destinations: AlertRoutingDestination[];
  enabled: boolean;
  priority: number; // Lower number = higher priority, first matching rule wins
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface AlertRoutingLog {
  id: string;
  organization_id: string;
  rule_id: string;
  rule_name: string;
  alert_id: string;
  check_name: string;
  check_type: string;
  severity: string;
  destinations_notified: string[];
  notification_status: 'sent' | 'failed' | 'simulated';
  error_message?: string;
  routed_at: Date;
}

// Alert Rate Limiting interfaces
export interface AlertRateLimitConfig {
  organization_id: string;
  enabled: boolean;
  max_alerts_per_minute: number;
  time_window_seconds: number;
  suppression_mode: 'drop' | 'aggregate'; // drop: discard, aggregate: collect and send summary
  aggregate_threshold: number; // When aggregating, send summary after this many alerts
  updated_at: Date;
}

export interface AlertRateLimitState {
  organization_id: string;
  alerts_in_window: number;
  window_start: Date;
  suppressed_alerts: Array<{
    alert_id: string;
    check_name: string;
    severity: string;
    triggered_at: Date;
  }>;
  total_alerts: number;
  sent_alerts: number;
  suppressed_count: number;
}

// Alert Correlation interfaces - automatically correlate related alerts
export interface AlertCorrelationConfig {
  organization_id: string;
  enabled: boolean;
  // Correlation methods
  correlate_by_check: boolean; // Correlate alerts from same check
  correlate_by_location: boolean; // Correlate alerts from same location
  correlate_by_error_type: boolean; // Correlate alerts with similar errors
  correlate_by_time_window: boolean; // Correlate alerts within a time window
  time_window_seconds: number; // Time window for correlation (default 300 = 5 min)
  similarity_threshold: number; // 0-100, how similar error messages should be
  updated_at: Date;
}

export interface CorrelatedAlert {
  id: string;
  check_id: string;
  check_name: string;
  check_type: string;
  location?: string;
  error_message?: string;
  severity: string;
  triggered_at: Date;
}

export interface AlertCorrelation {
  id: string;
  organization_id: string;
  correlation_reason: 'same_check' | 'same_location' | 'similar_error' | 'time_proximity' | 'multiple';
  correlation_details: string; // Human-readable explanation
  alerts: CorrelatedAlert[];
  primary_alert_id: string; // The first alert that triggered the correlation
  status: 'active' | 'acknowledged' | 'resolved';
  created_at: Date;
  updated_at: Date;
  acknowledged_by?: string;
  acknowledged_at?: Date;
}

// Alert Runbook interface
export interface AlertRunbook {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  // Fields used by alert-management routes
  check_type: 'uptime' | 'transaction' | 'performance' | 'webhook' | 'dns' | 'tcp' | 'all';
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'all';
  runbook_url: string;
  instructions?: string;
  tags?: string[];
  // Legacy fields for backward compatibility
  trigger_conditions?: {
    check_types?: string[];
    error_contains?: string[];
    severity?: string[];
  };
  steps?: {
    order: number;
    title: string;
    description: string;
    type: 'manual' | 'automated';
    automation_command?: string;
  }[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// Incident management interfaces
export interface IncidentNote {
  id: string;
  incident_id?: string;
  author_id: string;
  author_name: string;
  content: string;
  visibility?: 'internal' | 'public';
  created_at: Date;
}

export interface IncidentTimeline {
  id: string;
  incident_id?: string;
  event_type: 'created' | 'status_change' | 'status_changed' | 'responder_added' | 'note_added' | 'escalated' | 'resolved' | 'assigned';
  description: string;
  author?: string;
  actor_id?: string;
  actor_name?: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface IncidentResponder {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  role: 'commander' | 'responder' | 'observer' | 'primary' | 'secondary';
  assigned_at: Date;
  acknowledged_at?: Date;
}

export interface ManagedIncident {
  id: string;
  organization_id: string;
  title: string;
  description?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'triggered' | 'acknowledged' | 'investigating' | 'identified' | 'monitoring' | 'resolved';
  priority?: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  source: 'manual' | 'alert' | 'check' | 'api' | 'integration';
  source_id?: string; // ID of the triggering alert or check
  source_alert_id?: string;
  source_check_id?: string;
  source_check_type?: string;
  check_ids?: string[]; // Linked check IDs
  responders: IncidentResponder[];
  notes: IncidentNote[];
  timeline: IncidentTimeline[];
  tags?: string[];
  affected_services?: string[];
  escalation_policy_id?: string;
  on_call_schedule_id?: string;
  current_escalation_level?: number;
  resolution_summary?: string;
  postmortem_url?: string;
  postmortem_completed?: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  acknowledged_at?: Date;
  resolved_at?: Date;
  time_to_acknowledge_seconds?: number;
  time_to_resolve_seconds?: number;
}
