/**
 * Types for Monitoring Page
 * Extracted from MonitoringPage.tsx for modularity (Feature #47)
 */

// Monitoring locations
export type MonitoringLocation = 'us-east' | 'us-west' | 'europe' | 'asia-pacific' | 'australia';

export interface MonitoringLocationInfo {
  id: MonitoringLocation;
  name: string;
  region: string;
  city: string;
}

// Result by location for display
export interface LocationResult {
  location: MonitoringLocation;
  location_name: string;
  latest_result: CheckResult | null;
  avg_response_time: number;
  uptime_percentage: number;
  total_checks: number;
}

// Assertion interface for uptime checks
export interface UptimeAssertion {
  type: 'responseTime' | 'statusCode' | 'bodyContains' | 'headerContains';
  operator: 'lessThan' | 'greaterThan' | 'equals' | 'contains';
  value: string | number;
}

export interface AssertionResult {
  type: string;
  operator: string;
  expected: string | number;
  actual: string | number;
  passed: boolean;
}

// SSL Certificate info interface
export interface SSLCertificateInfo {
  valid: boolean;
  issuer: string;
  subject: string;
  valid_from: string;
  valid_to: string;
  days_until_expiry: number;
  fingerprint: string;
}

// Uptime Check interface for frontend
export interface UptimeCheck {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE' | 'PATCH';
  interval: number;
  timeout: number;
  expected_status: number;
  headers?: Record<string, string>;
  body?: string;
  locations: MonitoringLocation[];
  assertions?: UptimeAssertion[];
  ssl_expiry_warning_days?: number;
  consecutive_failures_threshold?: number;
  tags?: string[];
  group?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  latest_status?: 'up' | 'down' | 'degraded' | 'unknown';
  latest_response_time?: number;
  latest_checked_at?: string;
}

export interface CheckResult {
  id: string;
  check_id: string;
  location: MonitoringLocation;
  status: 'up' | 'down' | 'degraded';
  response_time: number;
  status_code: number;
  error?: string;
  assertion_results?: AssertionResult[];
  assertions_passed?: number;
  assertions_failed?: number;
  ssl_info?: SSLCertificateInfo;
  checked_at: string;
}

export interface MonitoringSummary {
  total_checks: number;
  enabled_checks: number;
  status_summary: {
    up: number;
    down: number;
    degraded: number;
    unknown: number;
  };
  uptime_percentage: number;
}

// Webhook check interface
export interface WebhookCheck {
  id: string;
  name: string;
  description?: string;
  webhook_url: string;
  webhook_secret?: string;
  expected_interval: number;
  expected_payload?: {
    type: 'json-schema' | 'key-value' | 'any';
    schema?: object;
    required_fields?: string[];
    field_values?: Record<string, string | number | boolean>;
  };
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_received?: string | null;
  last_payload_valid?: boolean | null;
  events_24h?: number;
}

export interface WebhookEvent {
  id: string;
  check_id: string;
  received_at: string;
  source_ip: string;
  headers: Record<string, string>;
  payload: unknown;
  payload_valid: boolean;
  validation_errors?: string[];
  signature_valid?: boolean;
}

// SLA metrics interface
export interface SlaPeriod {
  uptime_percentage: number;
  total_checks: number;
  successful_checks: number;
  failed_checks: number;
  avg_response_time: number;
}

export interface SlaMetrics {
  check_id: string;
  check_name: string;
  sla: {
    last_24h: SlaPeriod;
    last_7d: SlaPeriod;
    last_30d: SlaPeriod;
    all_time: SlaPeriod;
  };
  generated_at: string;
}

// Incident interface
export interface Incident {
  id: string;
  status: 'down' | 'degraded';
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  duration_formatted: string;
  error?: string;
  affected_locations: string[];
  is_active: boolean;
}

export interface IncidentData {
  check_id: string;
  check_name: string;
  active_incident: Incident | null;
  incidents: Incident[];
  total_incidents: number;
}

// History data interfaces
export interface HistoryChartDataPoint {
  timestamp: string;
  avg_response_time: number;
  min_response_time: number;
  max_response_time: number;
  successful_checks: number;
  failed_checks: number;
  degraded_checks: number;
  total_checks: number;
  uptime_percentage: number;
}

export interface HistoryStatusEntry {
  timestamp: string;
  status: 'up' | 'down' | 'degraded';
  response_time: number;
  location: string;
  error?: string;
}

export interface HistoryData {
  check_id: string;
  check_name: string;
  range: string;
  start_time: string;
  end_time: string;
  summary: {
    total_checks: number;
    successful_checks: number;
    failed_checks: number;
    degraded_checks: number;
    uptime_percentage: number;
    avg_response_time: number;
    min_response_time: number;
    max_response_time: number;
  };
  chart_data: HistoryChartDataPoint[];
  status_history: HistoryStatusEntry[];
}

// Maintenance window interfaces
export interface MaintenanceWindow {
  id: string;
  check_id: string;
  name: string;
  start_time: string;
  end_time: string;
  reason?: string;
  created_by: string;
  created_at: string;
}

export interface MaintenanceData {
  check_id: string;
  check_name: string;
  in_maintenance: boolean;
  active_window: MaintenanceWindow | null;
  scheduled_windows: MaintenanceWindow[];
  past_windows: MaintenanceWindow[];
}

// Transaction monitoring interfaces
export interface TransactionStepAssertion {
  type: 'status' | 'responseTime' | 'bodyContains' | 'headerContains';
  value: string | number;
  operator?: 'equals' | 'contains' | 'lessThan' | 'greaterThan';
}

export interface TransactionStep {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  expected_status: number;
  assertions?: TransactionStepAssertion[];
  timeout: number;
}

export interface TransactionCheck {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  steps: TransactionStep[];
  interval: number;
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionStepResult {
  step_id: string;
  step_name: string;
  status: 'passed' | 'failed';
  response_time: number;
  status_code: number;
  error?: string;
  assertions_passed: number;
  assertions_failed: number;
}

export interface TransactionResult {
  id: string;
  transaction_id: string;
  status: 'passed' | 'failed';
  total_duration: number;
  steps_passed: number;
  steps_failed: number;
  step_results: TransactionStepResult[];
  executed_at: string;
}

// Input interface for creating/editing transaction steps (without id)
export interface TransactionStepInput {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: string;
  body?: string;
  expected_status: number;
  assertions: TransactionStepAssertion[];
  timeout?: number;
}

// Performance check interfaces
export interface PerformanceCheck {
  id: string;
  name: string;
  url: string;
  interval: number;
  device: 'desktop' | 'mobile';
  enabled: boolean;
  created_at: string;
  updated_at: string;
  latest_status?: 'good' | 'needs_improvement' | 'poor';
  latest_score?: number;
  latest_lcp?: number;
  latest_checked_at?: string;
}

export interface PerformanceMetrics {
  lcp: number;
  fid: number;
  cls: number;
  ttfb: number;
  fcp: number;
  tti: number;
  tbt: number;
  si: number;
  total_size: number;
  request_count: number;
  dom_elements: number;
}

export interface PerformanceResult {
  id: string;
  check_id: string;
  status: 'good' | 'needs_improvement' | 'poor';
  metrics: PerformanceMetrics;
  lighthouse_score: number;
  checked_at: string;
}

export interface PerformanceTrends {
  trends: {
    lcp: { avg: number; min: number; max: number; trend: string };
    fid: { avg: number; min: number; max: number; trend: string };
    cls: { avg: number; min: number; max: number; trend: string };
    lighthouse_score: { avg: number; min: number; max: number; trend: string };
  };
  data_points: {
    timestamp: string;
    lcp: number;
    fid: number;
    cls: number;
    lighthouse_score: number;
  }[];
}

// Tab types
export type MonitoringTab = 'checks' | 'transactions' | 'performance' | 'webhooks' | 'dns' | 'tcp' | 'settings';
export type DetailTab = 'details' | 'incidents' | 'history' | 'maintenance';
export type HistoryRange = '1h' | '6h' | '24h' | '7d' | '30d';

// HTTP Methods
export type HttpMethod = 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE' | 'PATCH';

// Check status types
export type CheckStatus = 'up' | 'down' | 'degraded' | 'unknown';
export type PerformanceStatus = 'good' | 'needs_improvement' | 'poor';
export type TransactionStatus = 'passed' | 'failed';

// ============================================================
// Settings Tab Types (Feature #47 - Modular Refactoring)
// ============================================================

// Retention settings interface
export interface MonitoringSettings {
  organization_id: string;
  retention_days: 30 | 90 | 365;
  auto_cleanup_enabled: boolean;
  last_cleanup_at?: string;
  updated_at: string;
}

export interface RetentionStats {
  retention_days: number;
  auto_cleanup_enabled: boolean;
  last_cleanup_at: string | null;
  stats: {
    uptime: { total: number; last30: number; last90: number; last365: number; older: number };
    transaction: { total: number; last30: number; last90: number; last365: number; older: number };
    performance: { total: number; last30: number; last90: number; last365: number; older: number };
    webhook: { total: number; last30: number; last90: number; last365: number; older: number };
    dns: { total: number; last30: number; last90: number; last365: number; older: number };
    tcp: { total: number; last30: number; last90: number; last365: number; older: number };
  };
}

// Status page interfaces
export interface StatusPageCheck {
  check_id: string;
  check_type: 'uptime' | 'transaction' | 'performance' | 'dns' | 'tcp';
  display_name?: string;
  order: number;
}

export interface StatusPage {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  primary_color?: string;
  show_history_days: number;
  checks: StatusPageCheck[];
  is_public: boolean;
  show_uptime_percentage: boolean;
  show_response_time: boolean;
  show_incidents: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvailableCheck {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
}

// Status page incident interfaces
export interface StatusPageIncidentUpdate {
  id: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  message: string;
  created_at: string;
}

export interface StatusPageIncident {
  id: string;
  status_page_id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  impact: 'none' | 'minor' | 'major' | 'critical';
  affected_components?: string[];
  updates: StatusPageIncidentUpdate[];
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

// On-call schedule interfaces
export interface OnCallMember {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  phone?: string;
  order: number;
}

export interface OnCallSchedule {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  timezone: string;
  rotation_type: 'daily' | 'weekly' | 'custom';
  rotation_interval_days: number;
  members: OnCallMember[];
  current_on_call_index: number;
  last_rotation_at?: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Escalation policy interfaces
export interface EscalationTarget {
  id: string;
  type: 'user' | 'on_call_schedule' | 'email' | 'webhook';
  user_name?: string;
  user_email?: string;
  phone?: string;
  schedule_id?: string;
  webhook_url?: string;
}

export interface EscalationLevel {
  id: string;
  level: number;
  escalate_after_minutes: number;
  targets: EscalationTarget[];
}

export interface EscalationPolicy {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  levels: EscalationLevel[];
  repeat_policy: 'once' | 'repeat_until_acknowledged';
  repeat_interval_minutes?: number;
  is_default: boolean;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Alert grouping interfaces
export interface AlertGroupingRule {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  group_by: ('check_name' | 'check_type' | 'location' | 'error_type' | 'tag')[];
  time_window_minutes: number;
  deduplication_enabled: boolean;
  deduplication_key?: string;
  max_alerts_per_group: number;
  notification_delay_seconds: number;
  is_active: boolean;
  priority: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GroupedAlert {
  id: string;
  check_id: string;
  check_name: string;
  check_type: 'uptime' | 'transaction' | 'performance' | 'webhook' | 'dns' | 'tcp';
  location?: string;
  error_message?: string;
  tags?: string[];
  triggered_at: string;
  deduplicated: boolean;
}

export interface AlertGroup {
  id: string;
  organization_id: string;
  rule_id: string;
  group_key: string;
  alerts: GroupedAlert[];
  status: 'active' | 'acknowledged' | 'resolved';
  first_alert_at: string;
  last_alert_at: string;
  notification_sent: boolean;
  notification_sent_at?: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_at?: string;
  snoozed_until?: string;
  snoozed_by?: string;
  snoozed_at?: string;
  snooze_duration_hours?: number;
}

// Alert history interfaces
export interface AlertHistoryStats {
  total_alerts: number;
  by_severity: { critical: number; high: number; medium: number; low: number };
  by_source: { api: number; database: number; cache: number; system: number };
  by_status: { active: number; acknowledged: number; resolved: number };
  avg_resolution_time_seconds: number | null;
}

export interface AlertHistoryItem {
  id: string;
  check_name: string;
  check_type: string;
  error_message?: string;
  severity: string;
  source: string;
  group_status: string;
  triggered_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
}

export interface AlertsOverTimeData {
  time: string;
  count: number;
}

// Alert routing interfaces
export interface AlertRoutingCondition {
  field: 'severity' | 'check_type' | 'check_name' | 'location' | 'tag' | 'error_contains';
  operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'not_in';
  value: string | string[];
}

export interface AlertRoutingDestination {
  type: 'pagerduty' | 'slack' | 'email' | 'webhook' | 'opsgenie' | 'on_call' | 'n8n' | 'telegram' | 'teams' | 'discord';
  name: string;
  config: {
    integration_key?: string;
    webhook_url?: string;
    channel?: string;
    addresses?: string[];
    url?: string;
    headers?: Record<string, string>;
    api_key?: string;
    schedule_id?: string;
    n8n_webhook_url?: string;
    workflow_id?: string;
    telegram_bot_token?: string;
    telegram_chat_id?: string;
    severity_mapping?: {
      critical?: 'critical' | 'error' | 'warning' | 'info';
      high?: 'critical' | 'error' | 'warning' | 'info';
      medium?: 'critical' | 'error' | 'warning' | 'info';
      low?: 'critical' | 'error' | 'warning' | 'info';
    };
    message_template?: string;
    payload_template?: string;
    teams_webhook_url?: string;
    teams_title?: string;
    teams_theme_color?: string;
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
  condition_match: 'all' | 'any';
  destinations: AlertRoutingDestination[];
  enabled: boolean;
  priority: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AlertRoutingLog {
  id: string;
  rule_name: string;
  check_name: string;
  check_type: string;
  severity: string;
  destinations_notified: string[];
  notification_status: 'sent' | 'failed' | 'simulated';
  routed_at: string;
}

// Global severity mapping
export interface GlobalSeverityMapping {
  critical: string;
  high: string;
  medium: string;
  low: string;
  info: string;
}

// Alert rate limiting
export interface AlertRateLimitConfig {
  enabled: boolean;
  max_alerts_per_minute: number;
  time_window_seconds: number;
  suppression_mode: 'drop' | 'aggregate';
  aggregate_threshold: number;
}

export interface RateLimitStats {
  total_alerts: number;
  sent_alerts: number;
  suppressed_alerts: number;
  last_reset: string;
}

// Alert correlation
export interface AlertCorrelationConfig {
  enabled: boolean;
  correlate_by_check: boolean;
  correlate_by_location: boolean;
  correlate_by_error_type: boolean;
  correlate_by_time_window: boolean;
  time_window_seconds: number;
  similarity_threshold: number;
}

export interface CorrelatedAlert {
  id: string;
  check_id: string;
  check_name: string;
  check_type: string;
  location?: string;
  error_message?: string;
  severity: string;
  triggered_at: string;
}

export interface AlertCorrelation {
  id: string;
  correlation_reason: string;
  correlation_details: string;
  alerts: CorrelatedAlert[];
  primary_alert_id: string;
  status: 'active' | 'acknowledged' | 'resolved';
  created_at: string;
  updated_at: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
}

// Alert runbook interfaces
export interface AlertRunbookStep {
  id: string;
  order: number;
  title: string;
  description: string;
  action_type: 'manual' | 'automated' | 'decision';
  automation_config?: {
    type: 'webhook' | 'api_call' | 'script';
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    script?: string;
  };
  decision_options?: { label: string; next_step_id?: string }[];
}

export interface AlertRunbook {
  id: string;
  name: string;
  description?: string;
  check_type: 'uptime' | 'transaction' | 'performance' | 'webhook' | 'dns' | 'tcp' | 'all';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  steps: AlertRunbookStep[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Managed incident interfaces
export interface ManagedIncidentNote {
  id: string;
  author: string;
  content: string;
  created_at: string;
}

export interface ManagedIncident {
  id: string;
  title: string;
  description?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'triggered' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';
  source: 'manual' | 'alert' | 'api';
  source_alert_id?: string;
  source_check_id?: string;
  source_check_name?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  assigned_at?: string;
  escalation_policy_id?: string;
  runbook_id?: string;
  notes: ManagedIncidentNote[];
  started_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  closed_at?: string;
  resolution_summary?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}
