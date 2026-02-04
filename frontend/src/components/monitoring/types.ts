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
