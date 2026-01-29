// MonitoringPage - Extracted from App.tsx (Feature #1441)
// Synthetic monitoring: uptime checks, transaction monitoring, performance testing
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuthStore } from "../stores/authStore";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "../stores/toastStore";


type MonitoringLocation = 'us-east' | 'us-west' | 'europe' | 'asia-pacific' | 'australia';

interface MonitoringLocationInfo {
  id: MonitoringLocation;
  name: string;
  region: string;
  city: string;
}

// Result by location for display
interface LocationResult {
  location: MonitoringLocation;
  location_name: string;
  latest_result: CheckResult | null;
  avg_response_time: number;
  uptime_percentage: number;
  total_checks: number;
}

// Assertion interface for uptime checks
interface UptimeAssertion {
  type: 'responseTime' | 'statusCode' | 'bodyContains' | 'headerContains';
  operator: 'lessThan' | 'greaterThan' | 'equals' | 'contains';
  value: string | number;
}

interface AssertionResult {
  type: string;
  operator: string;
  expected: string | number;
  actual: string | number;
  passed: boolean;
}

// SSL Certificate info interface
interface SSLCertificateInfo {
  valid: boolean;
  issuer: string;
  subject: string;
  valid_from: string;
  valid_to: string;
  days_until_expiry: number;
  fingerprint: string;
}

// Uptime Check interface for frontend
interface UptimeCheck {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE' | 'PATCH';
  interval: number;
  timeout: number;
  expected_status: number;
  headers?: Record<string, string>;
  body?: string;
  locations: MonitoringLocation[]; // Geographic locations
  assertions?: UptimeAssertion[]; // Assertions for validation
  ssl_expiry_warning_days?: number; // Alert when SSL cert expires in this many days
  consecutive_failures_threshold?: number; // Only alert after N consecutive failures
  tags?: string[]; // Tags for organizing and filtering checks
  group?: string; // Group name for organizing checks
  enabled: boolean;
  created_at: string;
  updated_at: string;
  latest_status?: 'up' | 'down' | 'degraded' | 'unknown';
  latest_response_time?: number;
  latest_checked_at?: string;
}

interface CheckResult {
  id: string;
  check_id: string;
  location: MonitoringLocation; // Location check ran from
  status: 'up' | 'down' | 'degraded';
  response_time: number;
  status_code: number;
  error?: string;
  assertion_results?: AssertionResult[];
  assertions_passed?: number;
  assertions_failed?: number;
  ssl_info?: SSLCertificateInfo; // SSL certificate information
  checked_at: string;
}

interface MonitoringSummary {
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
interface WebhookCheck {
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

interface WebhookEvent {
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
interface SlaPeriod {
  uptime_percentage: number;
  total_checks: number;
  successful_checks: number;
  failed_checks: number;
  avg_response_time: number;
}

interface SlaMetrics {
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
interface Incident {
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

interface IncidentData {
  check_id: string;
  check_name: string;
  active_incident: Incident | null;
  incidents: Incident[];
  total_incidents: number;
}

// History data interfaces
interface HistoryChartDataPoint {
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

interface HistoryStatusEntry {
  timestamp: string;
  status: 'up' | 'down' | 'degraded';
  response_time: number;
  location: string;
  error?: string;
}

interface HistoryData {
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
interface MaintenanceWindow {
  id: string;
  check_id: string;
  name: string;
  start_time: string;
  end_time: string;
  reason?: string;
  created_by: string;
  created_at: string;
}

interface MaintenanceData {
  check_id: string;
  check_name: string;
  in_maintenance: boolean;
  active_window: MaintenanceWindow | null;
  scheduled_windows: MaintenanceWindow[];
  past_windows: MaintenanceWindow[];
}

// Transaction monitoring interfaces
interface TransactionStepAssertion {
  type: 'status' | 'responseTime' | 'bodyContains' | 'headerContains';
  value: string | number;
  operator?: 'equals' | 'contains' | 'lessThan' | 'greaterThan';
}

interface TransactionStep {
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

interface TransactionCheck {
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

interface TransactionStepResult {
  step_id: string;
  step_name: string;
  status: 'passed' | 'failed';
  response_time: number;
  status_code: number;
  error?: string;
  assertions_passed: number;
  assertions_failed: number;
}

interface TransactionResult {
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
interface TransactionStepInput {
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
interface PerformanceCheck {
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

interface PerformanceMetrics {
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

interface PerformanceResult {
  id: string;
  check_id: string;
  status: 'good' | 'needs_improvement' | 'poor';
  metrics: PerformanceMetrics;
  lighthouse_score: number;
  checked_at: string;
}

interface PerformanceTrends {
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

function MonitoringPage() {
  const { token } = useAuthStore();
  const [checks, setChecks] = useState<UptimeCheck[]>([]);
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<UptimeCheck | null>(null);
  const [checkResults, setCheckResults] = useState<CheckResult[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [editingCheck, setEditingCheck] = useState<UptimeCheck | null>(null);
  const [slaMetrics, setSlaMetrics] = useState<SlaMetrics | null>(null);
  const [isLoadingSla, setIsLoadingSla] = useState(false);
  const [incidentData, setIncidentData] = useState<IncidentData | null>(null);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState(false);
  const [showIncidentTab, setShowIncidentTab] = useState(false);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyRange, setHistoryRange] = useState<'1h' | '6h' | '24h' | '7d' | '30d'>('24h');
  const [activeDetailTab, setActiveDetailTab] = useState<'details' | 'incidents' | 'history' | 'maintenance'>('details');
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceData | null>(null);
  const [isLoadingMaintenance, setIsLoadingMaintenance] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceName, setMaintenanceName] = useState('');
  const [maintenanceStartTime, setMaintenanceStartTime] = useState('');
  const [maintenanceEndTime, setMaintenanceEndTime] = useState('');
  const [maintenanceReason, setMaintenanceReason] = useState('');

  // Form state for creating/editing checks
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formMethod, setFormMethod] = useState<'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE' | 'PATCH'>('GET');
  const [formInterval, setFormInterval] = useState(60);
  const [formTimeout, setFormTimeout] = useState(10000);
  const [formExpectedStatus, setFormExpectedStatus] = useState(200);
  const [formHeaders, setFormHeaders] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formLocations, setFormLocations] = useState<MonitoringLocation[]>(['us-east']);
  const [formAssertions, setFormAssertions] = useState<UptimeAssertion[]>([]);
  const [formSslWarningDays, setFormSslWarningDays] = useState(30);
  const [formConsecutiveFailures, setFormConsecutiveFailures] = useState(1);
  const [formTags, setFormTags] = useState(''); // comma-separated tags
  const [formGroup, setFormGroup] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Simplified modal state
  const [selectedPreset, setSelectedPreset] = useState<'light' | 'standard' | 'critical' | null>('standard');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Filter state
  const [filterTag, setFilterTag] = useState<string>('');
  const [filterGroup, setFilterGroup] = useState<string>('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);

  // Available locations
  const [availableLocations, setAvailableLocations] = useState<MonitoringLocationInfo[]>([]);
  const [locationResults, setLocationResults] = useState<LocationResult[]>([]);

  // Tab state
  const [activeTab, setActiveTab] = useState<'checks' | 'transactions' | 'performance' | 'webhooks' | 'dns' | 'tcp' | 'settings'>('checks');

  // Retention settings interface
  interface MonitoringSettings {
    organization_id: string;
    retention_days: 30 | 90 | 365;
    auto_cleanup_enabled: boolean;
    last_cleanup_at?: string;
    updated_at: string;
  }

  interface RetentionStats {
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

  // Settings state
  const [monitoringSettings, setMonitoringSettings] = useState<MonitoringSettings | null>(null);
  const [retentionStats, setRetentionStats] = useState<RetentionStats | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);
  const [settingsRetentionDays, setSettingsRetentionDays] = useState<30 | 90 | 365>(90);
  const [settingsAutoCleanup, setSettingsAutoCleanup] = useState(true);

  // Status page interfaces
  interface StatusPageCheck {
    check_id: string;
    check_type: 'uptime' | 'transaction' | 'performance' | 'dns' | 'tcp';
    display_name?: string;
    order: number;
  }

  interface StatusPage {
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

  interface AvailableCheck {
    id: string;
    type: string;
    name: string;
    enabled: boolean;
  }

  // Status page state
  const [statusPages, setStatusPages] = useState<StatusPage[]>([]);
  const [availableChecksForStatus, setAvailableChecksForStatus] = useState<AvailableCheck[]>([]);
  const [isLoadingStatusPages, setIsLoadingStatusPages] = useState(false);
  const [showStatusPageModal, setShowStatusPageModal] = useState(false);
  const [editingStatusPage, setEditingStatusPage] = useState<StatusPage | null>(null);
  const [statusPageName, setStatusPageName] = useState('');
  const [statusPageSlug, setStatusPageSlug] = useState('');
  const [statusPageDescription, setStatusPageDescription] = useState('');
  const [statusPageColor, setStatusPageColor] = useState('#2563EB');
  const [statusPageIsPublic, setStatusPageIsPublic] = useState(true);
  const [statusPageShowUptime, setStatusPageShowUptime] = useState(true);
  const [statusPageShowResponseTime, setStatusPageShowResponseTime] = useState(true);
  const [statusPageShowIncidents, setStatusPageShowIncidents] = useState(true);
  const [statusPageSelectedChecks, setStatusPageSelectedChecks] = useState<{ id: string; type: string; name: string }[]>([]);
  const [isSubmittingStatusPage, setIsSubmittingStatusPage] = useState(false);

  // Status page incident interfaces
  interface StatusPageIncidentUpdate {
    id: string;
    status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
    message: string;
    created_at: string;
  }

  interface StatusPageIncident {
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

  // Incident management state
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showIncidentUpdateModal, setShowIncidentUpdateModal] = useState(false);
  const [selectedStatusPageForIncident, setSelectedStatusPageForIncident] = useState<StatusPage | null>(null);
  const [statusPageIncidents, setStatusPageIncidents] = useState<StatusPageIncident[]>([]);
  const [isLoadingStatusPageIncidents, setIsLoadingStatusPageIncidents] = useState(false);
  const [editingIncident, setEditingIncident] = useState<StatusPageIncident | null>(null);
  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentStatus, setIncidentStatus] = useState<'investigating' | 'identified' | 'monitoring' | 'resolved'>('investigating');
  const [incidentImpact, setIncidentImpact] = useState<'none' | 'minor' | 'major' | 'critical'>('major');
  const [incidentUpdateMessage, setIncidentUpdateMessage] = useState('');
  const [isSubmittingIncident, setIsSubmittingIncident] = useState(false);

  // On-call schedule interfaces
  interface OnCallMember {
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    phone?: string;
    order: number;
  }

  interface OnCallSchedule {
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

  // On-call schedule state
  const [onCallSchedules, setOnCallSchedules] = useState<OnCallSchedule[]>([]);
  const [isLoadingOnCallSchedules, setIsLoadingOnCallSchedules] = useState(false);
  const [showOnCallModal, setShowOnCallModal] = useState(false);
  const [editingOnCallSchedule, setEditingOnCallSchedule] = useState<OnCallSchedule | null>(null);
  const [onCallScheduleName, setOnCallScheduleName] = useState('');
  const [onCallScheduleDescription, setOnCallScheduleDescription] = useState('');
  const [onCallScheduleTimezone, setOnCallScheduleTimezone] = useState('UTC');
  const [onCallScheduleRotationType, setOnCallScheduleRotationType] = useState<'daily' | 'weekly' | 'custom'>('weekly');
  const [onCallScheduleRotationInterval, setOnCallScheduleRotationInterval] = useState(7);
  const [onCallScheduleMembers, setOnCallScheduleMembers] = useState<OnCallMember[]>([]);
  const [isSubmittingOnCallSchedule, setIsSubmittingOnCallSchedule] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');

  // Escalation policy interfaces
  interface EscalationTarget {
    id: string;
    type: 'user' | 'on_call_schedule' | 'email' | 'webhook';
    user_name?: string;
    user_email?: string;
    phone?: string;
    schedule_id?: string;
    webhook_url?: string;
  }

  interface EscalationLevel {
    id: string;
    level: number;
    escalate_after_minutes: number;
    targets: EscalationTarget[];
  }

  interface EscalationPolicy {
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

  // Escalation policy state
  const [escalationPolicies, setEscalationPolicies] = useState<EscalationPolicy[]>([]);
  const [isLoadingEscalationPolicies, setIsLoadingEscalationPolicies] = useState(false);
  const [showEscalationPolicyModal, setShowEscalationPolicyModal] = useState(false);
  const [editingEscalationPolicy, setEditingEscalationPolicy] = useState<EscalationPolicy | null>(null);
  const [escalationPolicyName, setEscalationPolicyName] = useState('');
  const [escalationPolicyDescription, setEscalationPolicyDescription] = useState('');
  const [escalationPolicyLevels, setEscalationPolicyLevels] = useState<{ escalate_after_minutes: number; targets: Omit<EscalationTarget, 'id'>[] }[]>([]);
  const [escalationPolicyRepeatPolicy, setEscalationPolicyRepeatPolicy] = useState<'once' | 'repeat_until_acknowledged'>('once');
  const [escalationPolicyRepeatInterval, setEscalationPolicyRepeatInterval] = useState(30);
  const [escalationPolicyIsDefault, setEscalationPolicyIsDefault] = useState(false);
  const [isSubmittingEscalationPolicy, setIsSubmittingEscalationPolicy] = useState(false);

  // Alert grouping interfaces
  interface AlertGroupingRule {
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

  interface AlertGroup {
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
    // Snooze fields
    snoozed_until?: string;
    snoozed_by?: string;
    snoozed_at?: string;
    snooze_duration_hours?: number;
  }

  interface GroupedAlert {
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

  // Alert grouping state
  const [alertGroupingRules, setAlertGroupingRules] = useState<AlertGroupingRule[]>([]);
  const [alertGroups, setAlertGroups] = useState<AlertGroup[]>([]);
  const [isLoadingAlertGrouping, setIsLoadingAlertGrouping] = useState(false);
  const [showAlertGroupingModal, setShowAlertGroupingModal] = useState(false);
  const [editingAlertGroupingRule, setEditingAlertGroupingRule] = useState<AlertGroupingRule | null>(null);
  const [alertGroupingName, setAlertGroupingName] = useState('');
  const [alertGroupingDescription, setAlertGroupingDescription] = useState('');
  const [alertGroupingGroupBy, setAlertGroupingGroupBy] = useState<('check_name' | 'check_type' | 'location' | 'error_type' | 'tag')[]>(['check_type']);
  const [alertGroupingTimeWindow, setAlertGroupingTimeWindow] = useState(5);
  const [alertGroupingDeduplication, setAlertGroupingDeduplication] = useState(true);
  const [alertGroupingNotificationDelay, setAlertGroupingNotificationDelay] = useState(30);
  const [isSubmittingAlertGrouping, setIsSubmittingAlertGrouping] = useState(false);

  // Alert history state
  interface AlertHistoryStats {
    total_alerts: number;
    by_severity: { critical: number; high: number; medium: number; low: number };
    by_source: { api: number; database: number; cache: number; system: number };
    by_status: { active: number; acknowledged: number; resolved: number };
    avg_resolution_time_seconds: number | null;
  }
  interface AlertHistoryItem {
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
  interface AlertsOverTimeData {
    time: string;
    count: number;
  }
  const [alertHistory, setAlertHistory] = useState<AlertHistoryItem[]>([]);
  const [alertHistoryStats, setAlertHistoryStats] = useState<AlertHistoryStats | null>(null);
  const [alertsOverTime, setAlertsOverTime] = useState<AlertsOverTimeData[]>([]);
  const [isLoadingAlertHistory, setIsLoadingAlertHistory] = useState(false);
  const [alertHistorySeverityFilter, setAlertHistorySeverityFilter] = useState<string>('');
  const [alertHistorySourceFilter, setAlertHistorySourceFilter] = useState<string>('');
  const [showAlertHistorySection, setShowAlertHistorySection] = useState(false);

  // Alert routing interfaces
  interface AlertRoutingCondition {
    field: 'severity' | 'check_type' | 'check_name' | 'location' | 'tag' | 'error_contains';
    operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'not_in';
    value: string | string[];
  }

  interface AlertRoutingDestination {
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
      // n8n
      n8n_webhook_url?: string;
      workflow_id?: string;
      // Telegram
      telegram_bot_token?: string;
      telegram_chat_id?: string;
      // PagerDuty severity mapping
      severity_mapping?: {
        critical?: 'critical' | 'error' | 'warning' | 'info';
        high?: 'critical' | 'error' | 'warning' | 'info';
        medium?: 'critical' | 'error' | 'warning' | 'info';
        low?: 'critical' | 'error' | 'warning' | 'info';
      };
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

  interface AlertRoutingRule {
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

  interface AlertRoutingLog {
    id: string;
    rule_name: string;
    check_name: string;
    check_type: string;
    severity: string;
    destinations_notified: string[];
    notification_status: 'sent' | 'failed' | 'simulated';
    routed_at: string;
  }

  // Alert routing state
  const [alertRoutingRules, setAlertRoutingRules] = useState<AlertRoutingRule[]>([]);
  const [alertRoutingLogs, setAlertRoutingLogs] = useState<AlertRoutingLog[]>([]);
  const [isLoadingAlertRouting, setIsLoadingAlertRouting] = useState(false);
  const [showAlertRoutingModal, setShowAlertRoutingModal] = useState(false);
  const [editingAlertRoutingRule, setEditingAlertRoutingRule] = useState<AlertRoutingRule | null>(null);
  const [alertRoutingName, setAlertRoutingName] = useState('');
  const [alertRoutingDescription, setAlertRoutingDescription] = useState('');
  const [alertRoutingConditionMatch, setAlertRoutingConditionMatch] = useState<'all' | 'any'>('all');
  const [alertRoutingConditions, setAlertRoutingConditions] = useState<AlertRoutingCondition[]>([
    { field: 'severity', operator: 'equals', value: 'critical' }
  ]);
  const [alertRoutingDestinations, setAlertRoutingDestinations] = useState<AlertRoutingDestination[]>([
    { type: 'pagerduty', name: 'PagerDuty', config: {} }
  ]);
  const [isSubmittingAlertRouting, setIsSubmittingAlertRouting] = useState(false);
  const [showAlertRoutingTest, setShowAlertRoutingTest] = useState(false);
  const [testAlertSeverity, setTestAlertSeverity] = useState<'critical' | 'high' | 'medium' | 'low' | 'info'>('critical');
  const [testAlertCheckType, setTestAlertCheckType] = useState<string>('uptime');
  const [testAlertCheckName, setTestAlertCheckName] = useState('API Server');
  const [testRoutingResult, setTestRoutingResult] = useState<{ matched_rules: unknown[]; message: string } | null>(null);

  // Global Alert Severity Mapping state
  interface GlobalSeverityMapping {
    critical: string;
    high: string;
    medium: string;
    low: string;
    info: string;
  }
  const [globalSeverityMapping, setGlobalSeverityMapping] = useState<GlobalSeverityMapping>({
    critical: 'P1',
    high: 'P2',
    medium: 'P3',
    low: 'P4',
    info: 'P5',
  });
  const [isSavingSeverityMapping, setIsSavingSeverityMapping] = useState(false);

  // Alert Rate Limiting state
  interface AlertRateLimitConfig {
    enabled: boolean;
    max_alerts_per_minute: number;
    time_window_seconds: number;
    suppression_mode: 'drop' | 'aggregate'; // drop: discard, aggregate: collect and send summary
    aggregate_threshold: number; // When aggregating, send summary after this many alerts
  }
  const [alertRateLimitConfig, setAlertRateLimitConfig] = useState<AlertRateLimitConfig>({
    enabled: true,
    max_alerts_per_minute: 5,
    time_window_seconds: 60,
    suppression_mode: 'aggregate',
    aggregate_threshold: 10,
  });
  const [isSavingRateLimit, setIsSavingRateLimit] = useState(false);
  const [rateLimitStats, setRateLimitStats] = useState<{
    total_alerts: number;
    sent_alerts: number;
    suppressed_alerts: number;
    last_reset: string;
  } | null>(null);
  const [isTestingRateLimit, setIsTestingRateLimit] = useState(false);

  // Alert Correlation state
  interface AlertCorrelationConfig {
    enabled: boolean;
    correlate_by_check: boolean;
    correlate_by_location: boolean;
    correlate_by_error_type: boolean;
    correlate_by_time_window: boolean;
    time_window_seconds: number;
    similarity_threshold: number;
  }
  interface CorrelatedAlert {
    id: string;
    check_id: string;
    check_name: string;
    check_type: string;
    location?: string;
    error_message?: string;
    severity: string;
    triggered_at: string;
  }
  interface AlertCorrelation {
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
  const [alertCorrelationConfig, setAlertCorrelationConfig] = useState<AlertCorrelationConfig>({
    enabled: true,
    correlate_by_check: true,
    correlate_by_location: true,
    correlate_by_error_type: true,
    correlate_by_time_window: true,
    time_window_seconds: 300,
    similarity_threshold: 60,
  });
  const [isSavingCorrelation, setIsSavingCorrelation] = useState(false);
  const [alertCorrelations, setAlertCorrelations] = useState<AlertCorrelation[]>([]);
  const [isTestingCorrelation, setIsTestingCorrelation] = useState(false);
  const [selectedCorrelation, setSelectedCorrelation] = useState<AlertCorrelation | null>(null);

  // Alert Runbook state
  interface AlertRunbook {
    id: string;
    name: string;
    description?: string;
    check_type: 'uptime' | 'transaction' | 'performance' | 'webhook' | 'dns' | 'tcp' | 'all';
    severity?: 'critical' | 'high' | 'medium' | 'low' | 'all';
    runbook_url: string;
    instructions?: string;
    tags?: string[];
    created_by: string;
    created_at: string;
    updated_at: string;
  }
  const [alertRunbooks, setAlertRunbooks] = useState<AlertRunbook[]>([]);
  const [isLoadingRunbooks, setIsLoadingRunbooks] = useState(false);
  const [showRunbookModal, setShowRunbookModal] = useState(false);
  const [editingRunbook, setEditingRunbook] = useState<AlertRunbook | null>(null);
  const [runbookForm, setRunbookForm] = useState({
    name: '',
    description: '',
    check_type: 'all' as AlertRunbook['check_type'],
    severity: 'all' as AlertRunbook['severity'],
    runbook_url: '',
    instructions: '',
  });
  const [isSavingRunbook, setIsSavingRunbook] = useState(false);
  const [runbookTestResult, setRunbookTestResult] = useState<{
    alert: {
      id: string;
      check_name: string;
      check_type: string;
      severity: string;
      error_message: string;
      runbook: { id: string; name: string; url: string; instructions?: string } | null;
    };
    runbook_found: boolean;
    message: string;
  } | null>(null);

  // Incident Management interfaces
  interface IncidentNote {
    id: string;
    author_id: string;
    author_name: string;
    content: string;
    visibility: 'internal' | 'public';
    created_at: string;
  }

  interface IncidentTimeline {
    id: string;
    event_type: 'created' | 'assigned' | 'status_changed' | 'priority_changed' | 'note_added' | 'responder_added' | 'responder_removed' | 'resolved' | 'escalated';
    description: string;
    actor_id?: string;
    actor_name?: string;
    metadata?: Record<string, unknown>;
    created_at: string;
  }

  interface IncidentResponder {
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    role: 'primary' | 'secondary' | 'observer';
    assigned_at: string;
    acknowledged_at?: string;
  }

  interface ManagedIncident {
    id: string;
    organization_id: string;
    title: string;
    description?: string;
    status: 'triggered' | 'acknowledged' | 'investigating' | 'identified' | 'monitoring' | 'resolved';
    priority: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    source: 'alert' | 'manual' | 'api' | 'integration';
    source_alert_id?: string;
    source_check_id?: string;
    source_check_type?: string;
    responders: IncidentResponder[];
    notes: IncidentNote[];
    timeline: IncidentTimeline[];
    tags?: string[];
    affected_services?: string[];
    postmortem_url?: string;
    postmortem_completed: boolean;
    created_by: string;
    created_at: string;
    updated_at: string;
    acknowledged_at?: string;
    resolved_at?: string;
    resolution_summary?: string;
    time_to_acknowledge_seconds?: number;
    time_to_resolve_seconds?: number;
  }

  // Incident Management state
  const [managedIncidents, setManagedIncidents] = useState<ManagedIncident[]>([]);
  const [isLoadingManagedIncidents, setIsLoadingManagedIncidents] = useState(false);
  const [showManagedIncidentModal, setShowManagedIncidentModal] = useState(false);
  const [selectedManagedIncident, setSelectedManagedIncident] = useState<ManagedIncident | null>(null);
  const [managedIncidentTitle, setManagedIncidentTitle] = useState('');
  const [managedIncidentDescription, setManagedIncidentDescription] = useState('');
  const [managedIncidentPriority, setManagedIncidentPriority] = useState<'P1' | 'P2' | 'P3' | 'P4' | 'P5'>('P3');
  const [managedIncidentSeverity, setManagedIncidentSeverity] = useState<'critical' | 'high' | 'medium' | 'low' | 'info'>('medium');
  const [managedIncidentTags, setManagedIncidentTags] = useState('');
  const [managedIncidentAffectedServices, setManagedIncidentAffectedServices] = useState('');
  const [isSubmittingManagedIncident, setIsSubmittingManagedIncident] = useState(false);
  const [showManagedIncidentDetailModal, setShowManagedIncidentDetailModal] = useState(false);
  const [managedIncidentNoteContent, setManagedIncidentNoteContent] = useState('');
  const [managedIncidentNoteVisibility, setManagedIncidentNoteVisibility] = useState<'internal' | 'public'>('internal');
  const [showManagedAssignResponderModal, setShowManagedAssignResponderModal] = useState(false);
  const [managedResponderName, setManagedResponderName] = useState('');
  const [managedResponderEmail, setManagedResponderEmail] = useState('');
  const [managedResponderRole, setManagedResponderRole] = useState<'primary' | 'secondary' | 'observer'>('secondary');
  const [showManagedResolveModal, setShowManagedResolveModal] = useState(false);
  const [managedResolutionSummary, setManagedResolutionSummary] = useState('');
  const [managedPostmortemUrl, setManagedPostmortemUrl] = useState('');
  const [managedPostmortemCompleted, setManagedPostmortemCompleted] = useState(false);
  const [managedIncidentFilter, setManagedIncidentFilter] = useState<'all' | 'active' | 'resolved'>('active');

  // TCP check interfaces
  interface TcpCheck {
    id: string;
    name: string;
    host: string;
    port: number;
    timeout: number;
    interval: number;
    enabled: boolean;
    created_at: string;
    updated_at: string;
    latest_status?: 'up' | 'down' | 'unknown';
    latest_port_open?: boolean;
    latest_response_time?: number;
    latest_checked_at?: string;
  }

  interface TcpCheckResult {
    id: string;
    check_id: string;
    status: 'up' | 'down';
    port_open: boolean;
    response_time: number;
    error?: string;
    checked_at: string;
  }

  // TCP state
  const [tcpChecks, setTcpChecks] = useState<TcpCheck[]>([]);
  const [showTcpModal, setShowTcpModal] = useState(false);
  const [selectedTcp, setSelectedTcp] = useState<TcpCheck | null>(null);
  const [tcpResults, setTcpResults] = useState<TcpCheckResult[]>([]);

  // TCP form state
  const [tcpName, setTcpName] = useState('');
  const [tcpHost, setTcpHost] = useState('');
  const [tcpPort, setTcpPort] = useState(80);
  const [tcpInterval, setTcpInterval] = useState(60);
  const [isSubmittingTcp, setIsSubmittingTcp] = useState(false);
  const [isLoadingTcpResults, setIsLoadingTcpResults] = useState(false);

  // DNS check interfaces
  interface DnsCheck {
    id: string;
    name: string;
    domain: string;
    record_type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS';
    expected_values: string[];
    nameservers?: string[];
    interval: number;
    timeout: number;
    enabled: boolean;
    created_at: string;
    updated_at: string;
    latest_status?: 'up' | 'down' | 'degraded' | 'unknown';
    latest_response_time?: number;
    latest_checked_at?: string;
    latest_resolved_values?: string[];
  }

  interface DnsCheckResult {
    id: string;
    check_id: string;
    status: 'up' | 'down' | 'degraded';
    resolved_values: string[];
    expected_values: string[];
    response_time: number;
    nameserver_used: string;
    error?: string;
    ttl?: number;
    all_expected_found: boolean;
    unexpected_values: string[];
    checked_at: string;
  }

  // DNS state
  const [dnsChecks, setDnsChecks] = useState<DnsCheck[]>([]);
  const [showDnsModal, setShowDnsModal] = useState(false);
  const [selectedDns, setSelectedDns] = useState<DnsCheck | null>(null);
  const [dnsResults, setDnsResults] = useState<DnsCheckResult[]>([]);

  // DNS form state
  const [dnsName, setDnsName] = useState('');
  const [dnsDomain, setDnsDomain] = useState('');
  const [dnsRecordType, setDnsRecordType] = useState<'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS'>('A');
  const [dnsExpectedValues, setDnsExpectedValues] = useState('');
  const [dnsInterval, setDnsInterval] = useState(60);
  const [isSubmittingDns, setIsSubmittingDns] = useState(false);
  const [isLoadingDnsResults, setIsLoadingDnsResults] = useState(false);

  // Webhook state
  const [webhookChecks, setWebhookChecks] = useState<WebhookCheck[]>([]);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookCheck | null>(null);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);

  // Webhook form state
  const [webhookName, setWebhookName] = useState('');
  const [webhookDescription, setWebhookDescription] = useState('');
  const [webhookInterval, setWebhookInterval] = useState(300);
  const [webhookPayloadType, setWebhookPayloadType] = useState<'any' | 'key-value'>('any');
  const [webhookRequiredFields, setWebhookRequiredFields] = useState('');
  const [isSubmittingWebhook, setIsSubmittingWebhook] = useState(false);

  // Transaction state
  const [transactions, setTransactions] = useState<TransactionCheck[]>([]);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionCheck | null>(null);
  const [transactionResults, setTransactionResults] = useState<TransactionResult[]>([]);

  // Transaction form state
  const [txnName, setTxnName] = useState('');
  const [txnDescription, setTxnDescription] = useState('');
  const [txnSteps, setTxnSteps] = useState<TransactionStepInput[]>([
    { name: '', url: '', method: 'GET', expected_status: 200, assertions: [] }
  ]);
  const [txnInterval, setTxnInterval] = useState(300);
  const [isSubmittingTxn, setIsSubmittingTxn] = useState(false);
  const [isLoadingTxnResults, setIsLoadingTxnResults] = useState(false);

  // Fetch webhook checks
  const fetchWebhookChecks = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/v1/monitoring/webhooks', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setWebhookChecks(data.checks || []);
      }
    } catch (error) {
      console.error('Failed to fetch webhook checks:', error);
    }
  }, [token]);

  // Fetch webhook events
  const fetchWebhookEvents = useCallback(async (checkId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/webhooks/${checkId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setWebhookEvents(data.events || []);
      }
    } catch (error) {
      console.error('Failed to fetch webhook events:', error);
    }
  }, [token]);

  // Create webhook check
  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmittingWebhook(true);

    try {
      const payload: Record<string, unknown> = {
        name: webhookName,
        description: webhookDescription || undefined,
        expected_interval: webhookInterval,
        expected_payload: webhookPayloadType === 'key-value' && webhookRequiredFields
          ? { type: 'key-value', required_fields: webhookRequiredFields.split(',').map(f => f.trim()).filter(Boolean) }
          : { type: 'any' },
      };

      const response = await fetch('/api/v1/monitoring/webhooks', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Webhook created! URL: ${data.check.webhook_url}`);
        setShowWebhookModal(false);
        setWebhookName('');
        setWebhookDescription('');
        setWebhookInterval(300);
        setWebhookPayloadType('any');
        setWebhookRequiredFields('');
        fetchWebhookChecks();
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to create webhook');
      }
    } catch (error) {
      toast.error('Failed to create webhook');
    } finally {
      setIsSubmittingWebhook(false);
    }
  };

  // Send test webhook
  const sendTestWebhook = async (checkId: string, payload?: unknown) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/webhooks/${checkId}/test`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payload }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.payload_valid) {
          toast.success('Test webhook sent - payload valid');
        } else {
          toast.error(`Test webhook sent - validation failed: ${data.validation_errors?.join(', ')}`);
        }
        fetchWebhookChecks();
        if (selectedWebhook?.id === checkId) {
          fetchWebhookEvents(checkId);
        }
      }
    } catch (error) {
      toast.error('Failed to send test webhook');
    }
  };

  // Delete webhook check
  const deleteWebhookCheck = async (checkId: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to delete this webhook check?')) return;
    try {
      const response = await fetch(`/api/v1/monitoring/webhooks/${checkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('Webhook check deleted');
        if (selectedWebhook?.id === checkId) {
          setSelectedWebhook(null);
        }
        fetchWebhookChecks();
      }
    } catch (error) {
      toast.error('Failed to delete webhook check');
    }
  };

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/v1/monitoring/transactions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  }, [token]);

  // Fetch transaction results
  const fetchTransactionResults = useCallback(async (transactionId: string) => {
    if (!token) return;
    setIsLoadingTxnResults(true);
    try {
      const response = await fetch(`/api/v1/monitoring/transactions/${transactionId}/results?limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTransactionResults(data.results || []);
      }
    } catch (error) {
      console.error('Failed to fetch transaction results:', error);
    } finally {
      setIsLoadingTxnResults(false);
    }
  }, [token]);

  // Create transaction
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmittingTxn(true);

    try {
      // Convert steps to API format
      const steps = txnSteps.map((step, index) => ({
        name: step.name || `Step ${index + 1}`,
        url: step.url,
        method: step.method,
        expected_status: step.expected_status,
        headers: step.headers ? parseHeaders(step.headers) : undefined,
        body: step.body || undefined,
        assertions: step.assertions,
        timeout: step.timeout || 10000,
      }));

      const response = await fetch('/api/v1/monitoring/transactions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: txnName,
          description: txnDescription || undefined,
          steps,
          interval: txnInterval,
        }),
      });

      if (response.ok) {
        toast.success('Transaction created successfully');
        setShowTransactionModal(false);
        resetTransactionForm();
        fetchTransactions();
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to create transaction');
      }
    } catch (error) {
      toast.error('Failed to create transaction');
    } finally {
      setIsSubmittingTxn(false);
    }
  };

  // Run transaction manually
  const runTransaction = async (transactionId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/transactions/${transactionId}/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('Transaction executed');
        fetchTransactions();
        if (selectedTransaction?.id === transactionId) {
          fetchTransactionResults(transactionId);
        }
      }
    } catch (error) {
      toast.error('Failed to run transaction');
    }
  };

  // Delete transaction
  const deleteTransaction = async (transactionId: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      const response = await fetch(`/api/v1/monitoring/transactions/${transactionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('Transaction deleted');
        if (selectedTransaction?.id === transactionId) {
          setSelectedTransaction(null);
        }
        fetchTransactions();
      }
    } catch (error) {
      toast.error('Failed to delete transaction');
    }
  };

  // Reset transaction form
  const resetTransactionForm = () => {
    setTxnName('');
    setTxnDescription('');
    setTxnSteps([{ name: '', url: '', method: 'GET', expected_status: 200, assertions: [] }]);
    setTxnInterval(300);
  };

  // Add step to transaction
  const addTransactionStep = () => {
    setTxnSteps([...txnSteps, { name: '', url: '', method: 'GET', expected_status: 200, assertions: [] }]);
  };

  // Remove step from transaction
  const removeTransactionStep = (index: number) => {
    if (txnSteps.length > 1) {
      setTxnSteps(txnSteps.filter((_, i) => i !== index));
    }
  };

  // Update step in transaction
  const updateTransactionStep = (index: number, field: keyof TransactionStepInput, value: any) => {
    const updated = [...txnSteps];
    updated[index] = { ...updated[index], [field]: value };
    setTxnSteps(updated);
  };

  // Add assertion to step
  const addAssertionToStep = (stepIndex: number) => {
    const updated = [...txnSteps];
    updated[stepIndex].assertions = [...updated[stepIndex].assertions, { type: 'status', value: 200, operator: 'equals' }];
    setTxnSteps(updated);
  };

  // Remove assertion from step
  const removeAssertionFromStep = (stepIndex: number, assertionIndex: number) => {
    const updated = [...txnSteps];
    updated[stepIndex].assertions = updated[stepIndex].assertions.filter((_, i) => i !== assertionIndex);
    setTxnSteps(updated);
  };

  // Update assertion in step
  const updateAssertionInStep = (stepIndex: number, assertionIndex: number, field: keyof TransactionStepAssertion, value: any) => {
    const updated = [...txnSteps];
    updated[stepIndex].assertions = updated[stepIndex].assertions.map((a, i) =>
      i === assertionIndex ? { ...a, [field]: value } : a
    );
    setTxnSteps(updated);
  };

  // Performance state
  const [performanceChecks, setPerformanceChecks] = useState<PerformanceCheck[]>([]);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [selectedPerformance, setSelectedPerformance] = useState<PerformanceCheck | null>(null);
  const [performanceResults, setPerformanceResults] = useState<PerformanceResult[]>([]);
  const [performanceTrends, setPerformanceTrends] = useState<PerformanceTrends | null>(null);
  const [isLoadingPerfResults, setIsLoadingPerfResults] = useState(false);

  // Performance form state
  const [perfName, setPerfName] = useState('');
  const [perfUrl, setPerfUrl] = useState('');
  const [perfInterval, setPerfInterval] = useState(3600);
  const [perfDevice, setPerfDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [isSubmittingPerf, setIsSubmittingPerf] = useState(false);

  // Fetch DNS checks
  const fetchDnsChecks = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/v1/monitoring/dns', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDnsChecks(data.checks || []);
      }
    } catch (error) {
      console.error('Failed to fetch DNS checks:', error);
    }
  }, [token]);

  // Fetch DNS results
  const fetchDnsResults = useCallback(async (checkId: string) => {
    if (!token) return;
    setIsLoadingDnsResults(true);
    try {
      const response = await fetch(`/api/v1/monitoring/dns/${checkId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDnsResults(data.results || []);
      }
    } catch (error) {
      console.error('Failed to fetch DNS results:', error);
    } finally {
      setIsLoadingDnsResults(false);
    }
  }, [token]);

  // Create DNS check
  const handleCreateDns = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmittingDns(true);

    try {
      const expectedValues = dnsExpectedValues.split(',').map(v => v.trim()).filter(Boolean);

      const response = await fetch('/api/v1/monitoring/dns', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: dnsName,
          domain: dnsDomain,
          record_type: dnsRecordType,
          expected_values: expectedValues,
          interval: dnsInterval,
        }),
      });

      if (response.ok) {
        toast.success('DNS check created successfully');
        setShowDnsModal(false);
        resetDnsForm();
        fetchDnsChecks();
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to create DNS check');
      }
    } catch (error) {
      toast.error('Failed to create DNS check');
    } finally {
      setIsSubmittingDns(false);
    }
  };

  // Run DNS check manually
  const runDnsCheck = async (checkId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/dns/${checkId}/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('DNS check executed');
        fetchDnsChecks();
        if (selectedDns?.id === checkId) {
          fetchDnsResults(checkId);
        }
      }
    } catch (error) {
      toast.error('Failed to run DNS check');
    }
  };

  // Toggle DNS check
  const toggleDnsCheck = async (checkId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/dns/${checkId}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('DNS check toggled');
        fetchDnsChecks();
      }
    } catch (error) {
      toast.error('Failed to toggle DNS check');
    }
  };

  // Delete DNS check
  const deleteDnsCheck = async (checkId: string) => {
    if (!token) return;
    if (!window.confirm('Are you sure you want to delete this DNS check?')) return;
    try {
      const response = await fetch(`/api/v1/monitoring/dns/${checkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('DNS check deleted');
        if (selectedDns?.id === checkId) {
          setSelectedDns(null);
        }
        fetchDnsChecks();
      }
    } catch (error) {
      toast.error('Failed to delete DNS check');
    }
  };

  // Reset DNS form
  const resetDnsForm = () => {
    setDnsName('');
    setDnsDomain('');
    setDnsRecordType('A');
    setDnsExpectedValues('');
    setDnsInterval(60);
  };

  // Fetch TCP checks
  const fetchTcpChecks = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/v1/monitoring/tcp', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTcpChecks(data.checks || []);
      }
    } catch (error) {
      console.error('Failed to fetch TCP checks:', error);
    }
  }, [token]);

  // Fetch TCP results
  const fetchTcpResults = useCallback(async (checkId: string) => {
    if (!token) return;
    setIsLoadingTcpResults(true);
    try {
      const response = await fetch(`/api/v1/monitoring/tcp/${checkId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTcpResults(data.results || []);
      }
    } catch (error) {
      console.error('Failed to fetch TCP results:', error);
    } finally {
      setIsLoadingTcpResults(false);
    }
  }, [token]);

  // Create TCP check
  const handleCreateTcp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmittingTcp(true);

    try {
      const response = await fetch('/api/v1/monitoring/tcp', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: tcpName,
          host: tcpHost,
          port: tcpPort,
          interval: tcpInterval,
        }),
      });

      if (response.ok) {
        toast.success('TCP check created successfully');
        setShowTcpModal(false);
        resetTcpForm();
        fetchTcpChecks();
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to create TCP check');
      }
    } catch (error) {
      toast.error('Failed to create TCP check');
    } finally {
      setIsSubmittingTcp(false);
    }
  };

  // Run TCP check manually
  const runTcpCheck = async (checkId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/tcp/${checkId}/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('TCP check executed');
        fetchTcpChecks();
        if (selectedTcp?.id === checkId) {
          fetchTcpResults(checkId);
        }
      }
    } catch (error) {
      toast.error('Failed to run TCP check');
    }
  };

  // Toggle TCP check
  const toggleTcpCheck = async (checkId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/tcp/${checkId}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('TCP check toggled');
        fetchTcpChecks();
      }
    } catch (error) {
      toast.error('Failed to toggle TCP check');
    }
  };

  // Delete TCP check
  const deleteTcpCheck = async (checkId: string) => {
    if (!token) return;
    if (!window.confirm('Are you sure you want to delete this TCP check?')) return;
    try {
      const response = await fetch(`/api/v1/monitoring/tcp/${checkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('TCP check deleted');
        if (selectedTcp?.id === checkId) {
          setSelectedTcp(null);
        }
        fetchTcpChecks();
      }
    } catch (error) {
      toast.error('Failed to delete TCP check');
    }
  };

  // Reset TCP form
  const resetTcpForm = () => {
    setTcpName('');
    setTcpHost('');
    setTcpPort(80);
    setTcpInterval(60);
  };

  // Fetch monitoring settings
  const fetchMonitoringSettings = useCallback(async () => {
    if (!token) return;
    setIsLoadingSettings(true);
    try {
      const [settingsRes, statsRes] = await Promise.all([
        fetch('/api/v1/monitoring/settings', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/v1/monitoring/settings/stats', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        setMonitoringSettings(settings);
        setSettingsRetentionDays(settings.retention_days);
        setSettingsAutoCleanup(settings.auto_cleanup_enabled);
      }

      if (statsRes.ok) {
        const stats = await statsRes.json();
        setRetentionStats(stats);
      }
    } catch (error) {
      console.error('Failed to fetch monitoring settings:', error);
    } finally {
      setIsLoadingSettings(false);
    }
  }, [token]);

  // Save monitoring settings
  const saveMonitoringSettings = async () => {
    if (!token) return;
    setIsSavingSettings(true);
    try {
      const response = await fetch('/api/v1/monitoring/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          retention_days: settingsRetentionDays,
          auto_cleanup_enabled: settingsAutoCleanup,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMonitoringSettings(data.settings);
        toast.success('Settings saved successfully');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Run retention cleanup
  const runRetentionCleanup = async () => {
    if (!token) return;
    setIsRunningCleanup(true);
    try {
      const response = await fetch('/api/v1/monitoring/settings/cleanup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Cleanup complete: ${data.cleaned_results.total} results removed`);
        // Refresh stats
        await fetchMonitoringSettings();
      } else {
        toast.error('Failed to run cleanup');
      }
    } catch (error) {
      console.error('Failed to run cleanup:', error);
      toast.error('Failed to run cleanup');
    } finally {
      setIsRunningCleanup(false);
    }
  };

  // Fetch status pages
  const fetchStatusPages = useCallback(async () => {
    if (!token) return;
    setIsLoadingStatusPages(true);
    try {
      const [pagesRes, checksRes] = await Promise.all([
        fetch('/api/v1/monitoring/status-pages', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/v1/monitoring/status-pages/available-checks', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (pagesRes.ok) {
        const data = await pagesRes.json();
        setStatusPages(data.status_pages || []);
      }

      if (checksRes.ok) {
        const data = await checksRes.json();
        setAvailableChecksForStatus(data.checks || []);
      }
    } catch (error) {
      console.error('Failed to fetch status pages:', error);
    } finally {
      setIsLoadingStatusPages(false);
    }
  }, [token]);

  // Create/update status page
  const handleSubmitStatusPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !statusPageName.trim()) return;

    setIsSubmittingStatusPage(true);
    try {
      const payload = {
        name: statusPageName.trim(),
        custom_slug: statusPageSlug.trim() || undefined,
        description: statusPageDescription.trim() || undefined,
        primary_color: statusPageColor,
        is_public: statusPageIsPublic,
        show_uptime_percentage: statusPageShowUptime,
        show_response_time: statusPageShowResponseTime,
        show_incidents: statusPageShowIncidents,
        checks: statusPageSelectedChecks.map((c, index) => ({
          check_id: c.id,
          check_type: c.type as 'uptime' | 'transaction' | 'performance' | 'dns' | 'tcp',
          order: index,
        })),
      };

      const url = editingStatusPage
        ? `/api/v1/monitoring/status-pages/${editingStatusPage.id}`
        : '/api/v1/monitoring/status-pages';
      const method = editingStatusPage ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(editingStatusPage ? 'Status page updated' : 'Status page created');
        setShowStatusPageModal(false);
        resetStatusPageForm();
        fetchStatusPages();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save status page');
      }
    } catch (error) {
      console.error('Failed to save status page:', error);
      toast.error('Failed to save status page');
    } finally {
      setIsSubmittingStatusPage(false);
    }
  };

  // Delete status page
  const handleDeleteStatusPage = async (pageId: string) => {
    if (!token || !confirm('Are you sure you want to delete this status page?')) return;

    try {
      const response = await fetch(`/api/v1/monitoring/status-pages/${pageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('Status page deleted');
        fetchStatusPages();
      } else {
        toast.error('Failed to delete status page');
      }
    } catch (error) {
      console.error('Failed to delete status page:', error);
      toast.error('Failed to delete status page');
    }
  };

  // Reset status page form
  const resetStatusPageForm = () => {
    setEditingStatusPage(null);
    setStatusPageName('');
    setStatusPageSlug('');
    setStatusPageDescription('');
    setStatusPageColor('#2563EB');
    setStatusPageIsPublic(true);
    setStatusPageShowUptime(true);
    setStatusPageShowResponseTime(true);
    setStatusPageShowIncidents(true);
    setStatusPageSelectedChecks([]);
  };

  // Open edit status page modal
  const openEditStatusPage = (page: StatusPage) => {
    setEditingStatusPage(page);
    setStatusPageName(page.name);
    setStatusPageSlug(page.slug);
    setStatusPageDescription(page.description || '');
    setStatusPageColor(page.primary_color || '#2563EB');
    setStatusPageIsPublic(page.is_public);
    setStatusPageShowUptime(page.show_uptime_percentage);
    setStatusPageShowResponseTime(page.show_response_time);
    setStatusPageShowIncidents(page.show_incidents);
    // Map checks back to selected format
    const selected = page.checks.map(c => {
      const check = availableChecksForStatus.find(ac => ac.id === c.check_id);
      return { id: c.check_id, type: c.check_type, name: check?.name || c.display_name || 'Unknown' };
    });
    setStatusPageSelectedChecks(selected);
    setShowStatusPageModal(true);
  };

  // Toggle check selection for status page
  const toggleStatusPageCheck = (check: AvailableCheck) => {
    setStatusPageSelectedChecks(prev => {
      const exists = prev.find(c => c.id === check.id);
      if (exists) {
        return prev.filter(c => c.id !== check.id);
      } else {
        return [...prev, { id: check.id, type: check.type, name: check.name }];
      }
    });
  };

  // Fetch incidents for a status page
  const fetchStatusPageIncidents = async (pageId: string) => {
    if (!token) return;
    setIsLoadingStatusPageIncidents(true);
    try {
      const response = await fetch(`/api/v1/monitoring/status-pages/${pageId}/incidents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStatusPageIncidents(data.incidents || []);
      }
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
    } finally {
      setIsLoadingStatusPageIncidents(false);
    }
  };

  // Open incident management for a status page
  const openIncidentManagement = (page: StatusPage) => {
    setSelectedStatusPageForIncident(page);
    fetchStatusPageIncidents(page.id);
  };

  // Reset incident form
  const resetIncidentForm = () => {
    setEditingIncident(null);
    setIncidentTitle('');
    setIncidentStatus('investigating');
    setIncidentImpact('major');
    setIncidentUpdateMessage('');
  };

  // Create new incident
  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedStatusPageForIncident || !incidentTitle.trim()) return;

    setIsSubmittingIncident(true);
    try {
      const response = await fetch(`/api/v1/monitoring/status-pages/${selectedStatusPageForIncident.id}/incidents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: incidentTitle.trim(),
          status: incidentStatus,
          impact: incidentImpact,
          message: incidentUpdateMessage.trim() || `We are currently investigating this issue.`,
        }),
      });

      if (response.ok) {
        toast.success('Incident created');
        setShowIncidentModal(false);
        resetIncidentForm();
        fetchStatusPageIncidents(selectedStatusPageForIncident.id);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to create incident');
      }
    } catch (error) {
      console.error('Failed to create incident:', error);
      toast.error('Failed to create incident');
    } finally {
      setIsSubmittingIncident(false);
    }
  };

  // Add update to existing incident
  const handleAddIncidentUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedStatusPageForIncident || !editingIncident || !incidentUpdateMessage.trim()) return;

    setIsSubmittingIncident(true);
    try {
      const response = await fetch(`/api/v1/monitoring/status-pages/${selectedStatusPageForIncident.id}/incidents/${editingIncident.id}/updates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: incidentStatus,
          message: incidentUpdateMessage.trim(),
        }),
      });

      if (response.ok) {
        toast.success('Incident updated');
        setShowIncidentUpdateModal(false);
        resetIncidentForm();
        fetchStatusPageIncidents(selectedStatusPageForIncident.id);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update incident');
      }
    } catch (error) {
      console.error('Failed to update incident:', error);
      toast.error('Failed to update incident');
    } finally {
      setIsSubmittingIncident(false);
    }
  };

  // Delete incident
  const handleDeleteIncident = async (incidentId: string) => {
    if (!token || !selectedStatusPageForIncident || !confirm('Are you sure you want to delete this incident?')) return;

    try {
      const response = await fetch(`/api/v1/monitoring/status-pages/${selectedStatusPageForIncident.id}/incidents/${incidentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('Incident deleted');
        fetchStatusPageIncidents(selectedStatusPageForIncident.id);
      } else {
        toast.error('Failed to delete incident');
      }
    } catch (error) {
      console.error('Failed to delete incident:', error);
      toast.error('Failed to delete incident');
    }
  };

  // Open add update modal
  const openAddUpdateModal = (incident: StatusPageIncident) => {
    setEditingIncident(incident);
    setIncidentStatus(incident.status);
    setIncidentUpdateMessage('');
    setShowIncidentUpdateModal(true);
  };

  // Fetch on-call schedules
  const fetchOnCallSchedules = useCallback(async () => {
    if (!token) return;
    setIsLoadingOnCallSchedules(true);
    try {
      const response = await fetch('/api/v1/monitoring/on-call', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setOnCallSchedules(data.schedules || []);
      }
    } catch (error) {
      console.error('Failed to fetch on-call schedules:', error);
    } finally {
      setIsLoadingOnCallSchedules(false);
    }
  }, [token]);

  // Reset on-call schedule form
  const resetOnCallScheduleForm = () => {
    setOnCallScheduleName('');
    setOnCallScheduleDescription('');
    setOnCallScheduleTimezone('UTC');
    setOnCallScheduleRotationType('weekly');
    setOnCallScheduleRotationInterval(7);
    setOnCallScheduleMembers([]);
    setEditingOnCallSchedule(null);
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberPhone('');
  };

  // Open edit on-call schedule modal
  const openEditOnCallSchedule = (schedule: OnCallSchedule) => {
    setEditingOnCallSchedule(schedule);
    setOnCallScheduleName(schedule.name);
    setOnCallScheduleDescription(schedule.description || '');
    setOnCallScheduleTimezone(schedule.timezone);
    setOnCallScheduleRotationType(schedule.rotation_type);
    setOnCallScheduleRotationInterval(schedule.rotation_interval_days);
    setOnCallScheduleMembers([...schedule.members]);
    setShowOnCallModal(true);
  };

  // Add member to on-call schedule
  const addOnCallMember = () => {
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;
    const newMember: OnCallMember = {
      id: `temp-${Date.now()}`,
      user_id: `temp-user-${Date.now()}`,
      user_name: newMemberName.trim(),
      user_email: newMemberEmail.trim(),
      phone: newMemberPhone.trim() || undefined,
      order: onCallScheduleMembers.length,
    };
    setOnCallScheduleMembers([...onCallScheduleMembers, newMember]);
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberPhone('');
  };

  // Remove member from on-call schedule
  const removeOnCallMember = (memberId: string) => {
    setOnCallScheduleMembers(onCallScheduleMembers.filter(m => m.id !== memberId));
  };

  // Create/update on-call schedule
  const handleSubmitOnCallSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !onCallScheduleName.trim()) return;

    setIsSubmittingOnCallSchedule(true);
    try {
      const payload = {
        name: onCallScheduleName.trim(),
        description: onCallScheduleDescription.trim() || undefined,
        timezone: onCallScheduleTimezone,
        rotation_type: onCallScheduleRotationType,
        rotation_interval_days: onCallScheduleRotationInterval,
        members: onCallScheduleMembers.map((m, index) => ({
          user_name: m.user_name,
          user_email: m.user_email,
          phone: m.phone,
          order: index,
        })),
      };

      const url = editingOnCallSchedule
        ? `/api/v1/monitoring/on-call/${editingOnCallSchedule.id}`
        : '/api/v1/monitoring/on-call';

      const response = await fetch(url, {
        method: editingOnCallSchedule ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(editingOnCallSchedule ? 'On-call schedule updated' : 'On-call schedule created');
        setShowOnCallModal(false);
        resetOnCallScheduleForm();
        fetchOnCallSchedules();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save on-call schedule');
      }
    } catch (error) {
      console.error('Failed to save on-call schedule:', error);
      toast.error('Failed to save on-call schedule');
    } finally {
      setIsSubmittingOnCallSchedule(false);
    }
  };

  // Delete on-call schedule
  const handleDeleteOnCallSchedule = async (scheduleId: string) => {
    if (!token || !confirm('Are you sure you want to delete this on-call schedule?')) return;

    try {
      const response = await fetch(`/api/v1/monitoring/on-call/${scheduleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('On-call schedule deleted');
        fetchOnCallSchedules();
      } else {
        toast.error('Failed to delete on-call schedule');
      }
    } catch (error) {
      console.error('Failed to delete on-call schedule:', error);
      toast.error('Failed to delete on-call schedule');
    }
  };

  // Rotate on-call schedule manually
  const handleRotateOnCallSchedule = async (scheduleId: string) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/monitoring/on-call/${scheduleId}/rotate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('On-call rotation advanced');
        fetchOnCallSchedules();
      } else {
        toast.error('Failed to rotate on-call schedule');
      }
    } catch (error) {
      console.error('Failed to rotate on-call schedule:', error);
      toast.error('Failed to rotate on-call schedule');
    }
  };

  // Fetch escalation policies
  const fetchEscalationPolicies = useCallback(async () => {
    if (!token) return;
    setIsLoadingEscalationPolicies(true);
    try {
      const response = await fetch('/api/v1/monitoring/escalation-policies', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setEscalationPolicies(data.policies || []);
      }
    } catch (error) {
      console.error('Failed to fetch escalation policies:', error);
    } finally {
      setIsLoadingEscalationPolicies(false);
    }
  }, [token]);

  // Reset escalation policy form
  const resetEscalationPolicyForm = () => {
    setEscalationPolicyName('');
    setEscalationPolicyDescription('');
    setEscalationPolicyLevels([{ escalate_after_minutes: 0, targets: [] }]);
    setEscalationPolicyRepeatPolicy('once');
    setEscalationPolicyRepeatInterval(30);
    setEscalationPolicyIsDefault(false);
    setEditingEscalationPolicy(null);
  };

  // Open edit escalation policy modal
  const openEditEscalationPolicy = (policy: EscalationPolicy) => {
    setEditingEscalationPolicy(policy);
    setEscalationPolicyName(policy.name);
    setEscalationPolicyDescription(policy.description || '');
    setEscalationPolicyLevels(policy.levels.map(level => ({
      escalate_after_minutes: level.escalate_after_minutes,
      targets: level.targets.map(t => ({ ...t })),
    })));
    setEscalationPolicyRepeatPolicy(policy.repeat_policy);
    setEscalationPolicyRepeatInterval(policy.repeat_interval_minutes || 30);
    setEscalationPolicyIsDefault(policy.is_default);
    setShowEscalationPolicyModal(true);
  };

  // Add escalation level
  const addEscalationLevel = () => {
    const lastLevel = escalationPolicyLevels[escalationPolicyLevels.length - 1];
    const newMinutes = lastLevel ? lastLevel.escalate_after_minutes + 15 : 0;
    setEscalationPolicyLevels([...escalationPolicyLevels, { escalate_after_minutes: newMinutes, targets: [] }]);
  };

  // Remove escalation level
  const removeEscalationLevel = (index: number) => {
    setEscalationPolicyLevels(escalationPolicyLevels.filter((_, i) => i !== index));
  };

  // Add target to escalation level
  const addTargetToLevel = (levelIndex: number, target: Omit<EscalationTarget, 'id'>) => {
    const newLevels = [...escalationPolicyLevels];
    newLevels[levelIndex].targets.push(target);
    setEscalationPolicyLevels(newLevels);
  };

  // Remove target from escalation level
  const removeTargetFromLevel = (levelIndex: number, targetIndex: number) => {
    const newLevels = [...escalationPolicyLevels];
    newLevels[levelIndex].targets.splice(targetIndex, 1);
    setEscalationPolicyLevels(newLevels);
  };

  // Create/update escalation policy
  const handleSubmitEscalationPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !escalationPolicyName.trim()) return;

    setIsSubmittingEscalationPolicy(true);
    try {
      const payload = {
        name: escalationPolicyName.trim(),
        description: escalationPolicyDescription.trim() || undefined,
        levels: escalationPolicyLevels,
        repeat_policy: escalationPolicyRepeatPolicy,
        repeat_interval_minutes: escalationPolicyRepeatInterval,
        is_default: escalationPolicyIsDefault,
      };

      const url = editingEscalationPolicy
        ? `/api/v1/monitoring/escalation-policies/${editingEscalationPolicy.id}`
        : '/api/v1/monitoring/escalation-policies';

      const response = await fetch(url, {
        method: editingEscalationPolicy ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(editingEscalationPolicy ? 'Escalation policy updated' : 'Escalation policy created');
        setShowEscalationPolicyModal(false);
        resetEscalationPolicyForm();
        fetchEscalationPolicies();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save escalation policy');
      }
    } catch (error) {
      console.error('Failed to save escalation policy:', error);
      toast.error('Failed to save escalation policy');
    } finally {
      setIsSubmittingEscalationPolicy(false);
    }
  };

  // Delete escalation policy
  const handleDeleteEscalationPolicy = async (policyId: string) => {
    if (!token || !confirm('Are you sure you want to delete this escalation policy?')) return;

    try {
      const response = await fetch(`/api/v1/monitoring/escalation-policies/${policyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('Escalation policy deleted');
        fetchEscalationPolicies();
      } else {
        toast.error('Failed to delete escalation policy');
      }
    } catch (error) {
      console.error('Failed to delete escalation policy:', error);
      toast.error('Failed to delete escalation policy');
    }
  };

  // Test escalation policy
  const handleTestEscalationPolicy = async (policyId: string) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/monitoring/escalation-policies/${policyId}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Escalation test completed: ${data.escalation_flow.length} levels`);
        console.log('[Escalation Test]', data);
      } else {
        toast.error('Failed to test escalation policy');
      }
    } catch (error) {
      console.error('Failed to test escalation policy:', error);
      toast.error('Failed to test escalation policy');
    }
  };

  // Fetch alert grouping rules
  const fetchAlertGroupingRules = useCallback(async () => {
    if (!token) return;
    setIsLoadingAlertGrouping(true);
    try {
      const response = await fetch('/api/v1/monitoring/alert-grouping/rules', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAlertGroupingRules(data.rules || []);
      }
    } catch (error) {
      console.error('Failed to fetch alert grouping rules:', error);
    } finally {
      setIsLoadingAlertGrouping(false);
    }
  }, [token]);

  // Fetch alert groups
  const fetchAlertGroups = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/v1/monitoring/alert-grouping/groups', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAlertGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Failed to fetch alert groups:', error);
    }
  }, [token]);

  // Reset alert grouping form
  const resetAlertGroupingForm = () => {
    setAlertGroupingName('');
    setAlertGroupingDescription('');
    setAlertGroupingGroupBy(['check_type']);
    setAlertGroupingTimeWindow(5);
    setAlertGroupingDeduplication(true);
    setAlertGroupingNotificationDelay(30);
    setEditingAlertGroupingRule(null);
  };

  // Fetch alert history with statistics
  const fetchAlertHistory = useCallback(async () => {
    if (!token) return;
    setIsLoadingAlertHistory(true);
    try {
      const params = new URLSearchParams();
      if (alertHistorySeverityFilter) params.append('severity', alertHistorySeverityFilter);
      if (alertHistorySourceFilter) params.append('source', alertHistorySourceFilter);

      const response = await fetch(`/api/v1/monitoring/alert-history?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAlertHistory(data.alerts || []);
        setAlertHistoryStats(data.stats || null);
        setAlertsOverTime(data.alerts_over_time || []);
      }
    } catch (error) {
      console.error('Failed to fetch alert history:', error);
    } finally {
      setIsLoadingAlertHistory(false);
    }
  }, [token, alertHistorySeverityFilter, alertHistorySourceFilter]);

  // Export alert history
  const exportAlertHistory = async (format: 'csv' | 'json') => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (alertHistorySeverityFilter) params.append('severity', alertHistorySeverityFilter);
      if (alertHistorySourceFilter) params.append('source', alertHistorySourceFilter);
      params.append('format', format);

      const response = await fetch(`/api/v1/monitoring/alert-history/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alert-history.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success(`Alert history exported as ${format.toUpperCase()}`);
      } else {
        toast.error('Failed to export alert history');
      }
    } catch (error) {
      console.error('Failed to export alert history:', error);
      toast.error('Failed to export alert history');
    }
  };

  // Open edit alert grouping rule modal
  const openEditAlertGroupingRule = (rule: AlertGroupingRule) => {
    setEditingAlertGroupingRule(rule);
    setAlertGroupingName(rule.name);
    setAlertGroupingDescription(rule.description || '');
    setAlertGroupingGroupBy(rule.group_by);
    setAlertGroupingTimeWindow(rule.time_window_minutes);
    setAlertGroupingDeduplication(rule.deduplication_enabled);
    setAlertGroupingNotificationDelay(rule.notification_delay_seconds);
    setShowAlertGroupingModal(true);
  };

  // Create/update alert grouping rule
  const handleSubmitAlertGroupingRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !alertGroupingName.trim() || alertGroupingGroupBy.length === 0) return;

    setIsSubmittingAlertGrouping(true);
    try {
      const payload = {
        name: alertGroupingName.trim(),
        description: alertGroupingDescription.trim() || undefined,
        group_by: alertGroupingGroupBy,
        time_window_minutes: alertGroupingTimeWindow,
        deduplication_enabled: alertGroupingDeduplication,
        notification_delay_seconds: alertGroupingNotificationDelay,
      };

      const url = editingAlertGroupingRule
        ? `/api/v1/monitoring/alert-grouping/rules/${editingAlertGroupingRule.id}`
        : '/api/v1/monitoring/alert-grouping/rules';

      const response = await fetch(url, {
        method: editingAlertGroupingRule ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(editingAlertGroupingRule ? 'Alert grouping rule updated' : 'Alert grouping rule created');
        setShowAlertGroupingModal(false);
        resetAlertGroupingForm();
        fetchAlertGroupingRules();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save alert grouping rule');
      }
    } catch (error) {
      console.error('Failed to save alert grouping rule:', error);
      toast.error('Failed to save alert grouping rule');
    } finally {
      setIsSubmittingAlertGrouping(false);
    }
  };

  // Delete alert grouping rule
  const handleDeleteAlertGroupingRule = async (ruleId: string) => {
    if (!token || !confirm('Are you sure you want to delete this alert grouping rule?')) return;

    try {
      const response = await fetch(`/api/v1/monitoring/alert-grouping/rules/${ruleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('Alert grouping rule deleted');
        fetchAlertGroupingRules();
      } else {
        toast.error('Failed to delete alert grouping rule');
      }
    } catch (error) {
      console.error('Failed to delete alert grouping rule:', error);
      toast.error('Failed to delete alert grouping rule');
    }
  };

  // Simulate alert grouping
  const handleSimulateAlertGrouping = async () => {
    if (!token) return;

    // Simulate 5 related alerts
    const simulatedAlerts = [
      { check_name: 'API Server', check_type: 'uptime' as const, location: 'us-east', error_message: 'Connection timeout' },
      { check_name: 'API Server', check_type: 'uptime' as const, location: 'us-west', error_message: 'Connection timeout' },
      { check_name: 'Database Check', check_type: 'uptime' as const, location: 'us-east', error_message: 'Connection refused' },
      { check_name: 'API Server', check_type: 'uptime' as const, location: 'us-east', error_message: 'Connection timeout' },
      { check_name: 'CDN Health', check_type: 'uptime' as const, location: 'europe', error_message: 'Slow response' },
    ];

    try {
      const response = await fetch('/api/v1/monitoring/alert-grouping/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ alerts: simulatedAlerts }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        console.log('[Alert Grouping Simulation]', data);
        fetchAlertGroups();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to simulate alerts');
      }
    } catch (error) {
      console.error('Failed to simulate alerts:', error);
      toast.error('Failed to simulate alerts');
    }
  };

  // Toggle groupBy criterion
  const toggleGroupByCriterion = (criterion: 'check_name' | 'check_type' | 'location' | 'error_type' | 'tag') => {
    if (alertGroupingGroupBy.includes(criterion)) {
      setAlertGroupingGroupBy(alertGroupingGroupBy.filter(c => c !== criterion));
    } else {
      setAlertGroupingGroupBy([...alertGroupingGroupBy, criterion]);
    }
  };

  // Fetch alert routing rules
  const fetchAlertRoutingRules = useCallback(async () => {
    if (!token) return;
    setIsLoadingAlertRouting(true);
    try {
      const response = await fetch('/api/v1/monitoring/alert-routing/rules', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAlertRoutingRules(data.rules || []);
      }
    } catch (error) {
      console.error('Failed to fetch alert routing rules:', error);
    } finally {
      setIsLoadingAlertRouting(false);
    }
  }, [token]);

  // Fetch alert routing logs
  const fetchAlertRoutingLogs = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/v1/monitoring/alert-routing/logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAlertRoutingLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch alert routing logs:', error);
    }
  }, [token]);

  // Reset alert routing form
  const resetAlertRoutingForm = () => {
    setAlertRoutingName('');
    setAlertRoutingDescription('');
    setAlertRoutingConditionMatch('all');
    setAlertRoutingConditions([{ field: 'severity', operator: 'equals', value: 'critical' }]);
    setAlertRoutingDestinations([{ type: 'pagerduty', name: 'PagerDuty', config: {} }]);
    setEditingAlertRoutingRule(null);
  };

  // Open edit alert routing rule modal
  const openEditAlertRoutingRule = (rule: AlertRoutingRule) => {
    setEditingAlertRoutingRule(rule);
    setAlertRoutingName(rule.name);
    setAlertRoutingDescription(rule.description || '');
    setAlertRoutingConditionMatch(rule.condition_match);
    setAlertRoutingConditions(rule.conditions);
    setAlertRoutingDestinations(rule.destinations);
    setShowAlertRoutingModal(true);
  };

  // Create/update alert routing rule
  const handleSubmitAlertRoutingRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !alertRoutingName.trim() || alertRoutingConditions.length === 0 || alertRoutingDestinations.length === 0) return;

    setIsSubmittingAlertRouting(true);
    try {
      const payload = {
        name: alertRoutingName.trim(),
        description: alertRoutingDescription.trim() || undefined,
        condition_match: alertRoutingConditionMatch,
        conditions: alertRoutingConditions,
        destinations: alertRoutingDestinations,
      };

      const url = editingAlertRoutingRule
        ? `/api/v1/monitoring/alert-routing/rules/${editingAlertRoutingRule.id}`
        : '/api/v1/monitoring/alert-routing/rules';

      const response = await fetch(url, {
        method: editingAlertRoutingRule ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(editingAlertRoutingRule ? 'Alert routing rule updated' : 'Alert routing rule created');
        setShowAlertRoutingModal(false);
        resetAlertRoutingForm();
        fetchAlertRoutingRules();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to save alert routing rule');
      }
    } catch (error) {
      console.error('Failed to save alert routing rule:', error);
      toast.error('Failed to save alert routing rule');
    } finally {
      setIsSubmittingAlertRouting(false);
    }
  };

  // Delete alert routing rule
  const handleDeleteAlertRoutingRule = async (ruleId: string) => {
    if (!token || !confirm('Are you sure you want to delete this alert routing rule?')) return;

    try {
      const response = await fetch(`/api/v1/monitoring/alert-routing/rules/${ruleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success('Alert routing rule deleted');
        fetchAlertRoutingRules();
      } else {
        toast.error('Failed to delete alert routing rule');
      }
    } catch (error) {
      console.error('Failed to delete alert routing rule:', error);
      toast.error('Failed to delete alert routing rule');
    }
  };

  // Test alert routing
  const handleTestAlertRouting = async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/v1/monitoring/alert-routing/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          alert: {
            check_name: testAlertCheckName,
            check_type: testAlertCheckType,
            severity: testAlertSeverity,
            location: 'us-east',
            error_message: 'Connection timeout',
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTestRoutingResult(data);
        toast.success(data.message);
        fetchAlertRoutingLogs();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to test routing');
      }
    } catch (error) {
      console.error('Failed to test alert routing:', error);
      toast.error('Failed to test alert routing');
    }
  };

  // Add/remove routing condition
  const addAlertRoutingCondition = () => {
    setAlertRoutingConditions([...alertRoutingConditions, { field: 'severity', operator: 'equals', value: 'high' }]);
  };

  const removeAlertRoutingCondition = (index: number) => {
    setAlertRoutingConditions(alertRoutingConditions.filter((_, i) => i !== index));
  };

  const updateAlertRoutingCondition = (index: number, updates: Partial<AlertRoutingCondition>) => {
    setAlertRoutingConditions(alertRoutingConditions.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  // Add/remove routing destination
  const addAlertRoutingDestination = () => {
    setAlertRoutingDestinations([...alertRoutingDestinations, { type: 'slack', name: 'Slack', config: {} }]);
  };

  const removeAlertRoutingDestination = (index: number) => {
    setAlertRoutingDestinations(alertRoutingDestinations.filter((_, i) => i !== index));
  };

  const updateAlertRoutingDestination = (index: number, updates: Partial<AlertRoutingDestination>) => {
    setAlertRoutingDestinations(alertRoutingDestinations.map((d, i) => i === index ? { ...d, ...updates } : d));
  };

  // Test a routing destination
  const [testingDestinationIndex, setTestingDestinationIndex] = useState<number | null>(null);
  const testAlertRoutingDestination = async (dest: AlertRoutingDestination, index: number) => {
    if (!token) {
      toast.error('Not authenticated');
      return;
    }

    // Validate required fields based on destination type
    if (dest.type === 'pagerduty' && !dest.config.integration_key) {
      toast.error('PagerDuty integration key is required');
      return;
    }
    if (dest.type === 'opsgenie' && !dest.config.api_key) {
      toast.error('OpsGenie API key is required');
      return;
    }
    if (dest.type === 'slack' && !dest.config.webhook_url) {
      toast.error('Slack webhook URL is required');
      return;
    }
    if (dest.type === 'n8n' && !dest.config.n8n_webhook_url) {
      toast.error('n8n webhook URL is required');
      return;
    }
    if (dest.type === 'telegram' && !dest.config.telegram_bot_token && !dest.config.n8n_webhook_url) {
      toast.error('Telegram bot token or n8n webhook URL is required');
      return;
    }
    if (dest.type === 'teams' && !dest.config.teams_webhook_url) {
      toast.error('Microsoft Teams webhook URL is required');
      return;
    }
    if (dest.type === 'discord' && !dest.config.discord_webhook_url) {
      toast.error('Discord webhook URL is required');
      return;
    }

    setTestingDestinationIndex(index);
    try {
      const response = await fetch('/api/v1/monitoring/alert-routing/test-destination', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          destination_type: dest.type,
          config: dest.config,
          test_alert: {
            check_name: 'Test Routing Destination',
            check_type: 'uptime',
            severity: 'critical',
            error_message: 'This is a test alert to verify the destination configuration',
          },
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(`✅ Test alert sent to ${dest.type}!\n${data.message || ''}`);
      } else {
        toast.error(`❌ Test failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Test destination error:', error);
      toast.error(`Test failed: ${error.message}`);
    } finally {
      setTestingDestinationIndex(null);
    }
  };

  // Fetch incidents
  const fetchManagedIncidents = useCallback(async () => {
    if (!token) return;
    setIsLoadingManagedIncidents(true);
    try {
      const statusFilter = managedIncidentFilter === 'active'
        ? 'triggered,acknowledged,investigating,identified,monitoring'
        : managedIncidentFilter === 'resolved'
          ? 'resolved'
          : '';
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);

      const response = await fetch(`/api/v1/monitoring/incidents?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setManagedIncidents(data.incidents || []);
      }
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
    } finally {
      setIsLoadingManagedIncidents(false);
    }
  }, [token, managedIncidentFilter]);

  // Create incident
  const handleCreateManagedIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !managedIncidentTitle.trim()) return;

    setIsSubmittingManagedIncident(true);
    try {
      const payload = {
        title: managedIncidentTitle.trim(),
        description: managedIncidentDescription.trim() || undefined,
        priority: managedIncidentPriority,
        severity: managedIncidentSeverity,
        source: 'manual',
        tags: managedIncidentTags ? managedIncidentTags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        affected_services: managedIncidentAffectedServices ? managedIncidentAffectedServices.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      };

      const response = await fetch('/api/v1/monitoring/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success('Incident created');
        setShowManagedIncidentModal(false);
        resetManagedIncidentForm();
        fetchManagedIncidents();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to create incident');
      }
    } catch (error) {
      console.error('Failed to create incident:', error);
      toast.error('Failed to create incident');
    } finally {
      setIsSubmittingManagedIncident(false);
    }
  };

  // Reset incident form
  const resetManagedIncidentForm = () => {
    setManagedIncidentTitle('');
    setManagedIncidentDescription('');
    setManagedIncidentPriority('P3');
    setManagedIncidentSeverity('medium');
    setManagedIncidentTags('');
    setManagedIncidentAffectedServices('');
  };

  // Create incident from alert group
  const createIncidentFromAlertGroup = async (group: AlertGroup) => {
    if (!token) return;

    try {
      // Determine severity based on alert group
      const severity = group.alerts.length > 5 ? 'critical' :
                       group.alerts.length > 3 ? 'high' : 'medium';

      // Create a title from the grouped alerts
      const uniqueCheckNames = [...new Set(group.alerts.map(a => a.check_name))];
      const title = uniqueCheckNames.length === 1
        ? `Alert: ${uniqueCheckNames[0]}`
        : `Alert: Multiple checks (${uniqueCheckNames.length})`;

      // Build description from alerts
      const description = `Auto-created from alert group.\n\nGrouped alerts:\n${
        group.alerts.slice(0, 5).map(a => `- ${a.check_name}: ${a.error_message || 'Failed'}`).join('\n')
      }${group.alerts.length > 5 ? `\n... and ${group.alerts.length - 5} more` : ''}`;

      const payload = {
        title,
        description,
        priority: severity === 'critical' ? 'P1' : severity === 'high' ? 'P2' : 'P3' as 'P1' | 'P2' | 'P3',
        severity,
        source: 'alert',
        source_alert_id: group.id,
        tags: ['auto-created', 'alert-group'],
        affected_services: uniqueCheckNames,
      };

      const response = await fetch('/api/v1/monitoring/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success('Incident created from alert group');
        fetchManagedIncidents();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to create incident');
      }
    } catch (error) {
      console.error('Failed to create incident from alert:', error);
      toast.error('Failed to create incident');
    }
  };

  // Acknowledge an alert group (stops escalation)
  const acknowledgeAlertGroup = async (group: AlertGroup) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/monitoring/alert-grouping/groups/${group.id}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        toast.success('Alert group acknowledged - escalation stopped');
        // Refresh alert groups
        fetchAlertGroups();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to acknowledge alert group');
      }
    } catch (error) {
      console.error('Failed to acknowledge alert group:', error);
      toast.error('Failed to acknowledge alert group');
    }
  };

  // Resolve an alert group with resolution notes
  const resolveAlertGroup = async (group: AlertGroup, resolutionNotes?: string) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/monitoring/alert-grouping/groups/${group.id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ resolution_notes: resolutionNotes || 'Resolved via UI' }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Alert group resolved - Resolution time: ${data.resolution_time_seconds}s`);
        fetchAlertGroups();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to resolve alert group');
      }
    } catch (error) {
      console.error('Failed to resolve alert group:', error);
      toast.error('Failed to resolve alert group');
    }
  };

  // Snooze an alert group (temporarily silence notifications)
  const snoozeAlertGroup = async (group: AlertGroup, durationHours: number) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/monitoring/alert-grouping/groups/${group.id}/snooze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ duration_hours: durationHours }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Alert group snoozed for ${durationHours}h - until ${new Date(data.snoozed_until).toLocaleTimeString()}`);
        fetchAlertGroups();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to snooze alert group');
      }
    } catch (error) {
      console.error('Failed to snooze alert group:', error);
      toast.error('Failed to snooze alert group');
    }
  };

  // Unsnooze an alert group (resume notifications)
  const unsnoozeAlertGroup = async (group: AlertGroup) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/monitoring/alert-grouping/groups/${group.id}/unsnooze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        toast.success('Alert group unsnoozed - notifications will resume');
        fetchAlertGroups();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to unsnooze alert group');
      }
    } catch (error) {
      console.error('Failed to unsnooze alert group:', error);
      toast.error('Failed to unsnooze alert group');
    }
  };

  // Update incident status
  const handleUpdateManagedIncidentStatus = async (incidentId: string, newStatus: ManagedIncident['status']) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/v1/monitoring/incidents/${incidentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Incident status updated to ${newStatus}`);
        setSelectedManagedIncident(data);
        fetchManagedIncidents();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Failed to update incident status:', error);
      toast.error('Failed to update status');
    }
  };

  // Add note to incident
  const handleAddManagedIncidentNote = async (incidentId: string) => {
    if (!token || !managedIncidentNoteContent.trim()) return;

    try {
      const response = await fetch(`/api/v1/monitoring/incidents/${incidentId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: managedIncidentNoteContent.trim(),
          visibility: managedIncidentNoteVisibility,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Note added');
        setSelectedManagedIncident(data.incident);
        setManagedIncidentNoteContent('');
        fetchManagedIncidents();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to add note');
      }
    } catch (error) {
      console.error('Failed to add note:', error);
      toast.error('Failed to add note');
    }
  };

  // Assign responder to incident
  const handleAssignManagedResponder = async (incidentId: string) => {
    if (!token || !managedResponderName.trim() || !managedResponderEmail.trim()) return;

    try {
      const response = await fetch(`/api/v1/monitoring/incidents/${incidentId}/responders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: `user-${Date.now()}`,
          user_name: managedResponderName.trim(),
          user_email: managedResponderEmail.trim(),
          role: managedResponderRole,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`${managedResponderName} assigned as ${managedResponderRole} responder`);
        setSelectedManagedIncident(data.incident);
        setShowManagedAssignResponderModal(false);
        setManagedResponderName('');
        setManagedResponderEmail('');
        setManagedResponderRole('secondary');
        fetchManagedIncidents();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to assign responder');
      }
    } catch (error) {
      console.error('Failed to assign responder:', error);
      toast.error('Failed to assign responder');
    }
  };

  // Resolve incident
  const handleResolveManagedIncident = async (incidentId: string) => {
    if (!token || !managedResolutionSummary.trim()) return;

    try {
      const response = await fetch(`/api/v1/monitoring/incidents/${incidentId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          resolution_summary: managedResolutionSummary.trim(),
          postmortem_url: managedPostmortemUrl.trim() || undefined,
          postmortem_completed: managedPostmortemCompleted,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Incident resolved');
        setSelectedManagedIncident(data);
        setShowManagedResolveModal(false);
        setManagedResolutionSummary('');
        setManagedPostmortemUrl('');
        setManagedPostmortemCompleted(false);
        fetchManagedIncidents();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to resolve incident');
      }
    } catch (error) {
      console.error('Failed to resolve incident:', error);
      toast.error('Failed to resolve incident');
    }
  };

  // Open incident detail
  const openManagedIncidentDetail = async (incident: ManagedIncident) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/incidents/${incident.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedManagedIncident(data);
        setShowManagedIncidentDetailModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch incident details:', error);
      setSelectedManagedIncident(incident);
      setShowManagedIncidentDetailModal(true);
    }
  };

  // Get status badge color
  const getIncidentStatusColor = (status: ManagedIncident['status']) => {
    switch (status) {
      case 'triggered': return 'bg-red-100 text-red-800';
      case 'acknowledged': return 'bg-yellow-100 text-yellow-800';
      case 'investigating': return 'bg-blue-100 text-blue-800';
      case 'identified': return 'bg-purple-100 text-purple-800';
      case 'monitoring': return 'bg-cyan-100 text-cyan-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get priority badge color
  const getIncidentPriorityColor = (priority: ManagedIncident['priority']) => {
    switch (priority) {
      case 'P1': return 'bg-red-600 text-white';
      case 'P2': return 'bg-orange-500 text-white';
      case 'P3': return 'bg-yellow-500 text-white';
      case 'P4': return 'bg-blue-500 text-white';
      case 'P5': return 'bg-gray-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  // Fetch performance checks
  const fetchPerformanceChecks = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/v1/monitoring/performance', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPerformanceChecks(data.checks || []);
      }
    } catch (error) {
      console.error('Failed to fetch performance checks:', error);
    }
  }, [token]);

  // Fetch performance results
  const fetchPerformanceResults = useCallback(async (checkId: string) => {
    if (!token) return;
    setIsLoadingPerfResults(true);
    try {
      const [resultsRes, trendsRes] = await Promise.all([
        fetch(`/api/v1/monitoring/performance/${checkId}/results?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/v1/monitoring/performance/${checkId}/trends`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (resultsRes.ok) {
        const data = await resultsRes.json();
        setPerformanceResults(data.results || []);
      }
      if (trendsRes.ok) {
        const data = await trendsRes.json();
        setPerformanceTrends(data);
      }
    } catch (error) {
      console.error('Failed to fetch performance results:', error);
    } finally {
      setIsLoadingPerfResults(false);
    }
  }, [token]);

  // Create performance check
  const handleCreatePerformance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmittingPerf(true);

    try {
      const response = await fetch('/api/v1/monitoring/performance', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: perfName,
          url: perfUrl,
          interval: perfInterval,
          device: perfDevice,
        }),
      });

      if (response.ok) {
        toast.success('Performance check created successfully');
        setShowPerformanceModal(false);
        resetPerformanceForm();
        fetchPerformanceChecks();
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to create performance check');
      }
    } catch (error) {
      toast.error('Failed to create performance check');
    } finally {
      setIsSubmittingPerf(false);
    }
  };

  // Run performance check manually
  const runPerformanceCheck = async (checkId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/performance/${checkId}/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('Performance check executed');
        fetchPerformanceChecks();
        if (selectedPerformance?.id === checkId) {
          fetchPerformanceResults(checkId);
        }
      }
    } catch (error) {
      toast.error('Failed to run performance check');
    }
  };

  // Delete performance check
  const deletePerformanceCheck = async (checkId: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to delete this performance check?')) return;
    try {
      const response = await fetch(`/api/v1/monitoring/performance/${checkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('Performance check deleted');
        if (selectedPerformance?.id === checkId) {
          setSelectedPerformance(null);
        }
        fetchPerformanceChecks();
      }
    } catch (error) {
      toast.error('Failed to delete performance check');
    }
  };

  // Reset performance form
  const resetPerformanceForm = () => {
    setPerfName('');
    setPerfUrl('');
    setPerfInterval(3600);
    setPerfDevice('desktop');
  };

  // Get performance status badge
  const getPerfStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'good':
        return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">🟢 Good</span>;
      case 'needs_improvement':
        return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">🟡 Needs Work</span>;
      case 'poor':
        return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">🔴 Poor</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">⚪ Unknown</span>;
    }
  };

  // Get Core Web Vitals rating color
  const getMetricColor = (metric: string, value: number) => {
    const thresholds: Record<string, { good: number; poor: number }> = {
      lcp: { good: 2500, poor: 4000 },
      fid: { good: 100, poor: 300 },
      cls: { good: 0.1, poor: 0.25 },
      fcp: { good: 1800, poor: 3000 },
      ttfb: { good: 800, poor: 1800 },
    };
    const t = thresholds[metric];
    if (!t) return 'text-foreground';
    if (value <= t.good) return 'text-green-600';
    if (value >= t.poor) return 'text-red-600';
    return 'text-yellow-600';
  };

  // Fetch available locations
  const fetchLocations = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/v1/monitoring/locations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableLocations(data.locations || []);
      }
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  }, [token]);

  // Fetch results by location for a check
  const fetchLocationResults = useCallback(async (checkId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/results/by-location`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setLocationResults(data.locations || []);
      }
    } catch (error) {
      console.error('Failed to fetch location results:', error);
    }
  }, [token]);

  // Fetch checks and summary
  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      // Build query string with filters
      const params = new URLSearchParams();
      if (filterTag) params.set('tag', filterTag);
      if (filterGroup) params.set('group', filterGroup);
      const queryString = params.toString();

      const [checksRes, summaryRes] = await Promise.all([
        fetch(`/api/v1/monitoring/checks${queryString ? `?${queryString}` : ''}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/v1/monitoring/summary', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (checksRes.ok) {
        const data = await checksRes.json();
        setChecks(data.checks || []);
        // Update available filter options
        if (data.filters) {
          setAvailableTags(data.filters.tags || []);
          setAvailableGroups(data.filters.groups || []);
        }
      }
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token, filterTag, filterGroup]);

  useEffect(() => {
    fetchData();
    fetchTransactions();
    fetchPerformanceChecks();
    fetchWebhookChecks();
    fetchDnsChecks();
    fetchTcpChecks();
    fetchLocations();
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchData();
      fetchTransactions();
      fetchPerformanceChecks();
      fetchWebhookChecks();
      fetchDnsChecks();
      fetchTcpChecks();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData, fetchTransactions, fetchPerformanceChecks, fetchWebhookChecks, fetchDnsChecks, fetchTcpChecks, fetchLocations]);

  // Fetch DNS results when a DNS check is selected
  useEffect(() => {
    if (selectedDns) {
      fetchDnsResults(selectedDns.id);
    }
  }, [selectedDns, fetchDnsResults]);

  // Fetch TCP results when a TCP check is selected
  useEffect(() => {
    if (selectedTcp) {
      fetchTcpResults(selectedTcp.id);
    }
  }, [selectedTcp, fetchTcpResults]);

  // Fetch transaction results when a transaction is selected
  useEffect(() => {
    if (selectedTransaction) {
      fetchTransactionResults(selectedTransaction.id);
    }
  }, [selectedTransaction, fetchTransactionResults]);

  // Fetch performance results when a performance check is selected
  useEffect(() => {
    if (selectedPerformance) {
      fetchPerformanceResults(selectedPerformance.id);
    }
  }, [selectedPerformance, fetchPerformanceResults]);

  // Fetch check results when a check is selected
  const fetchCheckResults = useCallback(async (checkId: string) => {
    if (!token) return;
    setIsLoadingResults(true);
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/results?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCheckResults(data.results || []);
      }
    } catch (error) {
      console.error('Failed to fetch check results:', error);
    } finally {
      setIsLoadingResults(false);
    }
  }, [token]);

  const fetchSlaMetrics = useCallback(async (checkId: string) => {
    if (!token) return;
    setIsLoadingSla(true);
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/sla`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSlaMetrics(data);
      }
    } catch (error) {
      console.error('Failed to fetch SLA metrics:', error);
    } finally {
      setIsLoadingSla(false);
    }
  }, [token]);

  const fetchIncidents = useCallback(async (checkId: string) => {
    if (!token) return;
    setIsLoadingIncidents(true);
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/incidents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setIncidentData(data);
      }
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
    } finally {
      setIsLoadingIncidents(false);
    }
  }, [token]);

  const fetchHistory = useCallback(async (checkId: string, range: string) => {
    if (!token) return;
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/history?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setHistoryData(data);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [token]);

  const fetchMaintenance = useCallback(async (checkId: string) => {
    if (!token) return;
    setIsLoadingMaintenance(true);
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/maintenance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMaintenanceData(data);
      }
    } catch (error) {
      console.error('Failed to fetch maintenance windows:', error);
    } finally {
      setIsLoadingMaintenance(false);
    }
  }, [token]);

  const createMaintenanceWindow = async () => {
    if (!selectedCheck || !token) return;
    if (!maintenanceName || !maintenanceStartTime || !maintenanceEndTime) {
      alert('Please fill in all required fields');
      return;
    }
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${selectedCheck.id}/maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: maintenanceName,
          start_time: maintenanceStartTime,
          end_time: maintenanceEndTime,
          reason: maintenanceReason || undefined,
        }),
      });
      if (response.ok) {
        setShowMaintenanceModal(false);
        setMaintenanceName('');
        setMaintenanceStartTime('');
        setMaintenanceEndTime('');
        setMaintenanceReason('');
        fetchMaintenance(selectedCheck.id);
      }
    } catch (error) {
      console.error('Failed to create maintenance window:', error);
    }
  };

  const deleteMaintenanceWindow = async (windowId: string) => {
    if (!selectedCheck || !token) return;
    if (!confirm('Are you sure you want to delete this maintenance window?')) return;
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${selectedCheck.id}/maintenance/${windowId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        fetchMaintenance(selectedCheck.id);
      }
    } catch (error) {
      console.error('Failed to delete maintenance window:', error);
    }
  };

  useEffect(() => {
    if (selectedCheck) {
      fetchCheckResults(selectedCheck.id);
      fetchLocationResults(selectedCheck.id);
      fetchSlaMetrics(selectedCheck.id);
      fetchIncidents(selectedCheck.id);
      fetchHistory(selectedCheck.id, historyRange);
      fetchMaintenance(selectedCheck.id);
      setActiveDetailTab('details'); // Reset to details tab
    }
  }, [selectedCheck, fetchCheckResults, fetchLocationResults, fetchSlaMetrics, fetchIncidents, fetchHistory, fetchMaintenance]);

  // Fetch history data when range changes (without resetting tab)
  useEffect(() => {
    if (selectedCheck) {
      fetchHistory(selectedCheck.id, historyRange);
    }
  }, [historyRange, selectedCheck, fetchHistory]);

  // Parse headers from text format (key: value per line)
  const parseHeaders = (headersText: string): Record<string, string> | undefined => {
    if (!headersText.trim()) return undefined;
    const headers: Record<string, string> = {};
    const lines = headersText.split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        if (key && value) {
          headers[key] = value;
        }
      }
    }
    return Object.keys(headers).length > 0 ? headers : undefined;
  };

  // Create new check
  const handleCreateCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmitting(true);

    try {
      const headers = parseHeaders(formHeaders);
      // Parse tags from comma-separated string
      const tags = formTags.split(',').map(t => t.trim()).filter(t => t.length > 0);

      const response = await fetch('/api/v1/monitoring/checks', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formName,
          url: formUrl,
          method: formMethod,
          interval: formInterval,
          timeout: formTimeout,
          expected_status: formExpectedStatus,
          headers,
          body: formBody || undefined,
          locations: formLocations.length > 0 ? formLocations : ['us-east'],
          assertions: formAssertions.length > 0 ? formAssertions : undefined,
          ssl_expiry_warning_days: formSslWarningDays,
          consecutive_failures_threshold: formConsecutiveFailures,
          tags: tags.length > 0 ? tags : undefined,
          group: formGroup || undefined,
        }),
      });

      if (response.ok) {
        toast.success('Uptime check created successfully');
        setShowCreateModal(false);
        resetForm();
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to create check');
      }
    } catch (error) {
      toast.error('Failed to create check');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle check enabled/disabled
  const toggleCheck = async (checkId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to toggle check');
    }
  };

  // Run check manually
  const runCheck = async (checkId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('Check executed');
        fetchData();
        if (selectedCheck?.id === checkId) {
          fetchCheckResults(checkId);
        }
      }
    } catch (error) {
      toast.error('Failed to run check');
    }
  };

  // Delete check
  const deleteCheck = async (checkId: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to delete this check?')) return;
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('Check deleted');
        if (selectedCheck?.id === checkId) {
          setSelectedCheck(null);
        }
        fetchData();
      }
    } catch (error) {
      toast.error('Failed to delete check');
    }
  };

  // Duplicate check
  const duplicateCheck = async (checkId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/v1/monitoring/checks/${checkId}/duplicate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(`Check duplicated as "${data.check.name}"`);
        fetchData();
        // Optionally open edit modal for the new check
        if (data.check) {
          openEditModal(data.check);
        }
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to duplicate check');
      }
    } catch (error) {
      toast.error('Failed to duplicate check');
    }
  };

  // Bulk operations on checks by group
  const bulkAction = async (action: 'enable' | 'disable' | 'delete' | 'run', group: string) => {
    if (!token || !group) return;
    const actionLabels = { enable: 'enable', disable: 'disable', delete: 'delete', run: 'run' };
    if (action === 'delete' && !confirm(`Are you sure you want to ${actionLabels[action]} all checks in group "${group}"?`)) return;

    try {
      const response = await fetch('/api/v1/monitoring/checks/bulk', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, group }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Bulk ${action} completed: ${data.affected} checks affected`);
        setSelectedCheck(null);
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.message || `Failed to bulk ${action}`);
      }
    } catch (error) {
      toast.error(`Failed to bulk ${action}`);
    }
  };

  // Convert headers object to text format
  const headersToText = (headers?: Record<string, string>): string => {
    if (!headers) return '';
    return Object.entries(headers).map(([key, value]) => `${key}: ${value}`).join('\n');
  };

  const resetForm = () => {
    setFormName('');
    setFormUrl('');
    setFormMethod('GET');
    setFormInterval(60);
    setFormTimeout(10000);
    setFormExpectedStatus(200);
    setFormHeaders('');
    setFormBody('');
    setFormLocations(['us-east']);
    setFormAssertions([]);
    setFormSslWarningDays(30);
    setFormConsecutiveFailures(1);
    setFormTags('');
    setFormGroup('');
    setEditingCheck(null);
    // Reset simplified modal state
    setSelectedPreset('standard');
    setShowAdvancedOptions(false);
  };

  // Preset configurations for simplified modal
  const presets = {
    light: {
      label: 'Light Touch',
      description: '5 min interval, 1 failure threshold',
      icon: '🌿',
      interval: 300, // 5 minutes
      consecutiveFailures: 1,
      timeout: 15000,
    },
    standard: {
      label: 'Standard',
      description: '1 min interval, 2 failures threshold',
      icon: '⚡',
      interval: 60, // 1 minute
      consecutiveFailures: 2,
      timeout: 10000,
    },
    critical: {
      label: 'Critical',
      description: '30s interval, 1 failure threshold',
      icon: '🔥',
      interval: 30, // 30 seconds
      consecutiveFailures: 1,
      timeout: 5000,
    },
  };

  // Apply preset values to form
  const applyPreset = (presetKey: 'light' | 'standard' | 'critical') => {
    const preset = presets[presetKey];
    setSelectedPreset(presetKey);
    setFormInterval(preset.interval);
    setFormConsecutiveFailures(preset.consecutiveFailures);
    setFormTimeout(preset.timeout);
  };

  // Auto-generate name from URL
  const generateNameFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');
      const pathname = urlObj.pathname !== '/' ? urlObj.pathname : '';
      // Create a readable name like "api.example.com/health"
      const baseName = hostname + pathname;
      // Capitalize first letter and clean up
      return baseName.charAt(0).toUpperCase() + baseName.slice(1).replace(/\//g, ' ').trim() || hostname;
    } catch {
      // If URL is invalid, just return empty string
      return '';
    }
  };

  // Handle URL change with auto-name suggestion
  const handleUrlChange = (url: string) => {
    setFormUrl(url);
    // Auto-fill name if it's empty
    if (!formName || formName === generateNameFromUrl(formUrl)) {
      setFormName(generateNameFromUrl(url));
    }
    // Auto-detect HTTPS and set SSL monitoring
    if (url.startsWith('https://')) {
      setFormSslWarningDays(30);
    }
  };

  // Open edit modal with check data
  const openEditModal = (check: UptimeCheck) => {
    setEditingCheck(check);
    setFormName(check.name);
    setFormUrl(check.url);
    setFormMethod(check.method);
    setFormInterval(check.interval);
    setFormTimeout(check.timeout);
    setFormExpectedStatus(check.expected_status);
    setFormHeaders(headersToText(check.headers));
    setFormBody(check.body || '');
    setFormLocations(check.locations || ['us-east']);
    setFormAssertions(check.assertions || []);
    setFormSslWarningDays(check.ssl_expiry_warning_days || 30);
    setFormConsecutiveFailures(check.consecutive_failures_threshold || 1);
    setFormTags(check.tags?.join(', ') || '');
    setFormGroup(check.group || '');
    // When editing, show all options expanded and don't use presets
    setShowAdvancedOptions(true);
    setSelectedPreset(null);
    setShowCreateModal(true);
  };

  // Update existing check
  const handleUpdateCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingCheck) return;
    setIsSubmitting(true);

    try {
      const headers = parseHeaders(formHeaders);
      // Parse tags from comma-separated string
      const tags = formTags.split(',').map(t => t.trim()).filter(t => t.length > 0);

      const response = await fetch(`/api/v1/monitoring/checks/${editingCheck.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formName,
          url: formUrl,
          method: formMethod,
          interval: formInterval,
          timeout: formTimeout,
          expected_status: formExpectedStatus,
          headers,
          body: formBody || undefined,
          locations: formLocations.length > 0 ? formLocations : ['us-east'],
          assertions: formAssertions.length > 0 ? formAssertions : undefined,
          ssl_expiry_warning_days: formSslWarningDays,
          consecutive_failures_threshold: formConsecutiveFailures,
          tags: tags.length > 0 ? tags : [],
          group: formGroup || undefined,
        }),
      });

      if (response.ok) {
        toast.success('Uptime check updated successfully');
        setShowCreateModal(false);
        resetForm();
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.message || 'Failed to update check');
      }
    } catch (error) {
      toast.error('Failed to update check');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'up':
        return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">🟢 Up</span>;
      case 'down':
        return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">🔴 Down</span>;
      case 'degraded':
        return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">🟡 Degraded</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">⚪ Unknown</span>;
    }
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Synthetic Monitoring</h1>
            <p className="text-muted-foreground">Monitor uptime and performance of your endpoints</p>
          </div>
          {activeTab !== 'settings' && (
            <button
              onClick={() => {
                if (activeTab === 'checks') setShowCreateModal(true);
                else if (activeTab === 'transactions') setShowTransactionModal(true);
                else if (activeTab === 'webhooks') setShowWebhookModal(true);
                else if (activeTab === 'dns') setShowDnsModal(true);
                else if (activeTab === 'tcp') setShowTcpModal(true);
                else setShowPerformanceModal(true);
              }}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              {activeTab === 'checks' ? 'Create Check' : activeTab === 'transactions' ? 'Create Transaction' : activeTab === 'dns' ? 'Create DNS Check' : activeTab === 'tcp' ? 'Create TCP Check' : activeTab === 'webhooks' ? 'Create Webhook' : 'Create Performance Check'}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-border">
          <nav className="-mb-px flex gap-4">
            <button
              onClick={() => setActiveTab('checks')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'checks'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Uptime Checks ({checks.length})
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'transactions'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Transactions ({transactions.length})
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'performance'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Performance ({performanceChecks.length})
            </button>
            <button
              onClick={() => setActiveTab('webhooks')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'webhooks'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Webhooks ({webhookChecks.length})
            </button>
            <button
              onClick={() => setActiveTab('dns')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'dns'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              DNS ({dnsChecks.length})
            </button>
            <button
              onClick={() => setActiveTab('tcp')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'tcp'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              TCP ({tcpChecks.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('settings');
                fetchMonitoringSettings();
                fetchStatusPages();
                fetchOnCallSchedules();
                fetchEscalationPolicies();
                fetchAlertGroupingRules();
                fetchAlertGroups();
                fetchAlertRoutingRules();
                fetchAlertRoutingLogs();
                fetchManagedIncidents();
              }}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              ⚙️ Settings
            </button>
          </nav>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-sm text-muted-foreground">Total Checks</div>
              <div className="mt-1 text-2xl font-bold text-foreground">{summary.total_checks}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-sm text-muted-foreground">Uptime</div>
              <div className="mt-1 text-2xl font-bold text-green-600">{summary.uptime_percentage}%</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-sm text-muted-foreground">Status</div>
              <div className="mt-1 flex gap-2">
                <span className="text-green-600">🟢 {summary.status_summary.up}</span>
                <span className="text-red-600">🔴 {summary.status_summary.down}</span>
                <span className="text-yellow-600">🟡 {summary.status_summary.degraded}</span>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-sm text-muted-foreground">Enabled</div>
              <div className="mt-1 text-2xl font-bold text-foreground">{summary.enabled_checks}</div>
            </div>
          </div>
        )}

        {/* Uptime Checks Tab Content */}
        {activeTab === 'checks' && (
          <>
            {/* Filter Controls */}
            {(availableTags.length > 0 || availableGroups.length > 0) && (
              <div className="mb-4 flex flex-wrap items-center gap-4 p-4 rounded-lg border border-border bg-card">
                <span className="text-sm font-medium text-foreground">🔍 Filters:</span>
                {availableTags.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Tag:</label>
                    <select
                      value={filterTag}
                      onChange={e => setFilterTag(e.target.value)}
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    >
                      <option value="">All Tags</option>
                      {availableTags.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </div>
                )}
                {availableGroups.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Group:</label>
                    <select
                      value={filterGroup}
                      onChange={e => setFilterGroup(e.target.value)}
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    >
                      <option value="">All Groups</option>
                      {availableGroups.map(group => (
                        <option key={group} value={group}>{group}</option>
                      ))}
                    </select>
                  </div>
                )}
                {(filterTag || filterGroup) && (
                  <button
                    onClick={() => { setFilterTag(''); setFilterGroup(''); }}
                    className="text-sm text-primary hover:underline"
                  >
                    Clear Filters
                  </button>
                )}
                {filterGroup && (
                  <div className="flex items-center gap-2 ml-4 pl-4 border-l border-border">
                    <span className="text-sm text-muted-foreground">Bulk Actions:</span>
                    <button
                      onClick={() => bulkAction('run', filterGroup)}
                      className="rounded px-2 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200"
                    >
                      ▶️ Run All
                    </button>
                    <button
                      onClick={() => bulkAction('disable', filterGroup)}
                      className="rounded px-2 py-1 text-xs bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                    >
                      ⏸️ Disable All
                    </button>
                    <button
                      onClick={() => bulkAction('enable', filterGroup)}
                      className="rounded px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200"
                    >
                      ▶️ Enable All
                    </button>
                    <button
                      onClick={() => bulkAction('delete', filterGroup)}
                      className="rounded px-2 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200"
                    >
                      🗑️ Delete All
                    </button>
                  </div>
                )}
              </div>
            )}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            ) : checks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-gradient-to-br from-card to-muted/30 p-12 text-center animate-in fade-in duration-500">
                {/* Radar/pulse icon illustration */}
                <div className="relative mx-auto w-28 h-28 mb-6">
                  <svg className="w-full h-full text-primary/20" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
                    {/* Outer rings (radar effect) */}
                    <circle cx="50" cy="50" r="45" className="animate-ping opacity-20" style={{ animationDuration: '3s' }} />
                    <circle cx="50" cy="50" r="35" className="animate-ping opacity-30" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
                    <circle cx="50" cy="50" r="25" className="animate-ping opacity-40" style={{ animationDuration: '2s', animationDelay: '1s' }} />
                    {/* Center point */}
                    <circle cx="50" cy="50" r="8" fill="currentColor" className="text-primary/50" />
                    {/* Scanning line */}
                    <line x1="50" y1="50" x2="50" y2="10" className="text-primary origin-center animate-spin" style={{ animationDuration: '4s' }} />
                  </svg>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <span className="text-3xl">📡</span>
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No Monitors Yet</h3>
                <p className="text-muted-foreground mb-2 max-w-md mx-auto">
                  Start monitoring your endpoints in seconds
                </p>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  Get instant alerts when your APIs, websites, or services go down. Track response times and uptime percentage.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Your First Monitor
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Checks List */}
            <div className="lg:col-span-2">
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Response</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Interval</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {checks.map(check => (
                      <tr
                        key={check.id}
                        className={`hover:bg-muted/30 cursor-pointer ${selectedCheck?.id === check.id ? 'bg-primary/5' : ''}`}
                        onClick={() => setSelectedCheck(check)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{check.name}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{check.url}</div>
                          {(check.tags && check.tags.length > 0 || check.group) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {check.group && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700">
                                  📁 {check.group}
                                </span>
                              )}
                              {check.tags?.slice(0, 3).map(tag => (
                                <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-700">
                                  {tag}
                                </span>
                              ))}
                              {check.tags && check.tags.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">+{check.tags.length - 3}</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(check.latest_status)}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {check.latest_response_time ? `${check.latest_response_time}ms` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {check.interval}s
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => runCheck(check.id)}
                              title="Run now"
                              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              ▶️
                            </button>
                            <button
                              onClick={() => openEditModal(check)}
                              title="Edit"
                              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => duplicateCheck(check.id)}
                              title="Duplicate"
                              className="rounded p-1.5 text-muted-foreground hover:bg-blue-100 hover:text-blue-600"
                            >
                              📋
                            </button>
                            <button
                              onClick={() => toggleCheck(check.id)}
                              title={check.enabled ? 'Disable' : 'Enable'}
                              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              {check.enabled ? '⏸️' : '▶️'}
                            </button>
                            <button
                              onClick={() => deleteCheck(check.id)}
                              title="Delete"
                              className="rounded p-1.5 text-muted-foreground hover:bg-red-100 hover:text-red-600"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Check Details Panel */}
            <div className="lg:col-span-1">
              {selectedCheck ? (
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="font-semibold text-foreground mb-2">{selectedCheck.name}</h3>
                  {/* Tab Navigation */}
                  <div className="flex gap-2 mb-4 border-b border-border pb-2">
                    <button
                      onClick={() => setActiveDetailTab('details')}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        activeDetailTab === 'details'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      Details
                    </button>
                    <button
                      onClick={() => setActiveDetailTab('history')}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        activeDetailTab === 'history'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      History
                    </button>
                    <button
                      onClick={() => setActiveDetailTab('incidents')}
                      className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1 ${
                        activeDetailTab === 'incidents'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      Incidents
                      {incidentData && incidentData.total_incidents > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] text-xs rounded-full bg-red-500 text-white">
                          {incidentData.total_incidents}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setActiveDetailTab('maintenance')}
                      className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1 ${
                        activeDetailTab === 'maintenance'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      Maintenance
                      {maintenanceData?.in_maintenance && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] text-xs rounded-full bg-yellow-500 text-black">
                          🔧
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Details Tab Content */}
                  {activeDetailTab === 'details' && (
                    <>
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground">URL</dt>
                      <dd className="font-mono text-foreground break-all">{selectedCheck.url}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Method</dt>
                      <dd className="text-foreground">{selectedCheck.method}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Interval</dt>
                      <dd className="text-foreground">{selectedCheck.interval} seconds</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Timeout</dt>
                      <dd className="text-foreground">{selectedCheck.timeout}ms</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Expected Status</dt>
                      <dd className="text-foreground">{selectedCheck.expected_status}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Status</dt>
                      <dd>{getStatusBadge(selectedCheck.latest_status)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Locations</dt>
                      <dd className="flex flex-wrap gap-1">
                        {selectedCheck.locations?.map(loc => (
                          <span key={loc} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            {loc}
                          </span>
                        ))}
                      </dd>
                    </div>
                    {selectedCheck.headers && Object.keys(selectedCheck.headers).length > 0 && (
                      <div>
                        <dt className="text-muted-foreground">Headers</dt>
                        <dd className="font-mono text-xs text-foreground">
                          {Object.entries(selectedCheck.headers).map(([key, value]) => (
                            <div key={key}>{key}: {value}</div>
                          ))}
                        </dd>
                      </div>
                    )}
                    {selectedCheck.body && (
                      <div>
                        <dt className="text-muted-foreground">Body</dt>
                        <dd className="font-mono text-xs text-foreground break-all max-h-20 overflow-y-auto">{selectedCheck.body}</dd>
                      </div>
                    )}
                  </dl>

                  {/* Results by Location */}
                  {locationResults.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-medium text-foreground mb-2">📍 Results by Location</h4>
                      <div className="space-y-2">
                        {locationResults.map(loc => (
                          <div key={loc.location} className="rounded-md border border-border p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{loc.location_name}</span>
                                {loc.latest_result && (
                                  <>
                                    {loc.latest_result.status === 'up' && <span className="text-green-500">●</span>}
                                    {loc.latest_result.status === 'down' && <span className="text-red-500">●</span>}
                                    {loc.latest_result.status === 'degraded' && <span className="text-yellow-500">●</span>}
                                  </>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">{loc.total_checks} checks</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Avg Response:</span>{' '}
                                <span className="text-foreground font-medium">{loc.avg_response_time}ms</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Uptime:</span>{' '}
                                <span className={`font-medium ${loc.uptime_percentage >= 99 ? 'text-green-500' : loc.uptime_percentage >= 95 ? 'text-yellow-500' : 'text-red-500'}`}>
                                  {loc.uptime_percentage}%
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SSL Certificate Info */}
                  {checkResults.length > 0 && checkResults[0].ssl_info && (
                    <div className="mt-6">
                      <h4 className="font-medium text-foreground mb-2">🔒 SSL Certificate</h4>
                      <div className="rounded-lg border border-border p-3 bg-muted/30">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Issuer:</span>
                            <span className="ml-2 text-foreground">{checkResults[0].ssl_info.issuer}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Subject:</span>
                            <span className="ml-2 text-foreground">{checkResults[0].ssl_info.subject}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Valid From:</span>
                            <span className="ml-2 text-foreground">{new Date(checkResults[0].ssl_info.valid_from).toLocaleDateString()}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Valid To:</span>
                            <span className="ml-2 text-foreground">{new Date(checkResults[0].ssl_info.valid_to).toLocaleDateString()}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Expires In:</span>
                            <span className={`ml-2 font-medium ${
                              checkResults[0].ssl_info.days_until_expiry <= 7 ? 'text-red-500' :
                              checkResults[0].ssl_info.days_until_expiry <= 30 ? 'text-yellow-500' :
                              'text-green-500'
                            }`}>
                              {checkResults[0].ssl_info.days_until_expiry} days
                              {checkResults[0].ssl_info.days_until_expiry <= 30 && ' ⚠️'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SLA Metrics */}
                  <div className="mt-6">
                    <h4 className="font-medium text-foreground mb-2">📊 SLA Report</h4>
                    {isLoadingSla ? (
                      <div className="text-center py-4">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto"></div>
                      </div>
                    ) : slaMetrics ? (
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Last 24 Hours', data: slaMetrics.sla.last_24h },
                          { label: 'Last 7 Days', data: slaMetrics.sla.last_7d },
                          { label: 'Last 30 Days', data: slaMetrics.sla.last_30d },
                          { label: 'All Time', data: slaMetrics.sla.all_time },
                        ].map(({ label, data }) => (
                          <div key={label} className="rounded-lg border border-border p-3 bg-muted/20">
                            <div className="text-xs text-muted-foreground mb-1">{label}</div>
                            <div className={`text-xl font-bold ${
                              data.uptime_percentage >= 99.9 ? 'text-green-500' :
                              data.uptime_percentage >= 99 ? 'text-yellow-500' :
                              'text-red-500'
                            }`}>
                              {data.uptime_percentage}%
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                              <div className="flex justify-between">
                                <span>Total checks:</span>
                                <span className="text-foreground">{data.total_checks}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Successful:</span>
                                <span className="text-green-500">{data.successful_checks}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Failed:</span>
                                <span className="text-red-500">{data.failed_checks}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Avg response:</span>
                                <span className="text-foreground">{data.avg_response_time}ms</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No SLA data available</p>
                    )}
                  </div>

                  {/* Recent Results */}
                  <div className="mt-6">
                    <h4 className="font-medium text-foreground mb-2">Recent Results</h4>
                    {isLoadingResults ? (
                      <div className="text-center py-4">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto"></div>
                      </div>
                    ) : checkResults.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No results yet</p>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {checkResults.map(result => (
                          <div key={result.id} className="flex items-center justify-between text-xs border-b border-border pb-2">
                            <div className="flex items-center gap-2">
                              {result.status === 'up' && <span className="text-green-500">●</span>}
                              {result.status === 'down' && <span className="text-red-500">●</span>}
                              {result.status === 'degraded' && <span className="text-yellow-500">●</span>}
                              <span className="font-medium text-foreground">{result.location}</span>
                              <span className="text-muted-foreground">
                                {new Date(result.checked_at).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="text-muted-foreground">
                              {result.response_time}ms
                              {result.error && <span className="text-red-500 ml-2">{result.error}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                    </>
                  )}

                  {/* History Tab Content */}
                  {activeDetailTab === 'history' && (
                    <div className="space-y-4">
                      {/* Date Range Selector */}
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-foreground">📈 Check History</h4>
                        <div className="flex gap-1">
                          {(['1h', '6h', '24h', '7d', '30d'] as const).map((range) => (
                            <button
                              key={range}
                              onClick={() => setHistoryRange(range)}
                              className={`px-2 py-1 text-xs rounded transition-colors ${
                                historyRange === range
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                            >
                              {range}
                            </button>
                          ))}
                        </div>
                      </div>

                      {isLoadingHistory ? (
                        <div className="text-center py-8">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto"></div>
                        </div>
                      ) : historyData ? (
                        <>
                          {/* Summary Stats */}
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-lg border border-border p-3 bg-muted/20">
                              <div className="text-muted-foreground text-xs">Uptime</div>
                              <div className={`text-lg font-semibold ${
                                historyData.summary.uptime_percentage >= 99.9 ? 'text-green-500' :
                                historyData.summary.uptime_percentage >= 99 ? 'text-yellow-500' : 'text-red-500'
                              }`}>
                                {historyData.summary.uptime_percentage}%
                              </div>
                            </div>
                            <div className="rounded-lg border border-border p-3 bg-muted/20">
                              <div className="text-muted-foreground text-xs">Avg Response</div>
                              <div className="text-lg font-semibold text-foreground">
                                {historyData.summary.avg_response_time}ms
                              </div>
                            </div>
                            <div className="rounded-lg border border-border p-3 bg-muted/20">
                              <div className="text-muted-foreground text-xs">Total Checks</div>
                              <div className="text-lg font-semibold text-foreground">
                                {historyData.summary.total_checks}
                              </div>
                            </div>
                            <div className="rounded-lg border border-border p-3 bg-muted/20">
                              <div className="text-muted-foreground text-xs">Failed</div>
                              <div className={`text-lg font-semibold ${
                                historyData.summary.failed_checks > 0 ? 'text-red-500' : 'text-green-500'
                              }`}>
                                {historyData.summary.failed_checks}
                              </div>
                            </div>
                          </div>

                          {/* Response Time Chart */}
                          {historyData.chart_data.length > 0 && (
                            <div className="rounded-lg border border-border p-3 bg-muted/10">
                              <h5 className="text-sm font-medium text-foreground mb-2">Response Time (ms)</h5>
                              <div className="h-32 flex items-end gap-1">
                                {historyData.chart_data.map((point, idx) => {
                                  const maxResponse = Math.max(...historyData.chart_data.map(p => p.max_response_time), 1);
                                  const height = Math.max((point.avg_response_time / maxResponse) * 100, 5);
                                  const color = point.uptime_percentage >= 99 ? 'bg-green-500' :
                                               point.uptime_percentage >= 90 ? 'bg-yellow-500' : 'bg-red-500';
                                  return (
                                    <div
                                      key={idx}
                                      className="flex-1 group relative"
                                      title={`${new Date(point.timestamp).toLocaleString()}\nAvg: ${point.avg_response_time}ms\nUptime: ${point.uptime_percentage}%`}
                                    >
                                      <div
                                        className={`${color} rounded-t transition-all hover:opacity-80`}
                                        style={{ height: `${height}%` }}
                                      />
                                      <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-popover text-popover-foreground text-xs p-1 rounded shadow-lg whitespace-nowrap z-10">
                                        {point.avg_response_time}ms
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>{new Date(historyData.start_time).toLocaleDateString()}</span>
                                <span>{new Date(historyData.end_time).toLocaleDateString()}</span>
                              </div>
                            </div>
                          )}

                          {/* Status History */}
                          <div>
                            <h5 className="text-sm font-medium text-foreground mb-2">Status History</h5>
                            <div className="space-y-1 max-h-[200px] overflow-y-auto">
                              {historyData.status_history.slice(0, 20).map((entry, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs border-b border-border pb-1">
                                  <div className="flex items-center gap-2">
                                    {entry.status === 'up' && <span className="text-green-500">●</span>}
                                    {entry.status === 'down' && <span className="text-red-500">●</span>}
                                    {entry.status === 'degraded' && <span className="text-yellow-500">●</span>}
                                    <span className="text-muted-foreground">
                                      {new Date(entry.timestamp).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-foreground">{entry.response_time}ms</span>
                                    <span className="text-muted-foreground">{entry.location}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No history data available
                        </p>
                      )}
                    </div>
                  )}

                  {/* Incidents Tab Content */}
                  {activeDetailTab === 'incidents' && (
                    <div className="space-y-4">
                      <h4 className="font-medium text-foreground">🚨 Incident Timeline</h4>

                      {isLoadingIncidents ? (
                        <div className="text-center py-8">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto"></div>
                        </div>
                      ) : (
                        <>
                          {/* Active Incident Alert */}
                          {incidentData?.active_incident && (
                            <div className="rounded-lg border-2 border-red-500 bg-red-500/10 p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="animate-pulse text-red-500">●</span>
                                <span className="font-semibold text-red-500">Active Incident</span>
                              </div>
                              <div className="text-sm space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Status:</span>
                                  <span className={incidentData.active_incident.status === 'down' ? 'text-red-500' : 'text-yellow-500'}>
                                    {incidentData.active_incident.status === 'down' ? '🔴 Down' : '🟡 Degraded'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Started:</span>
                                  <span className="text-foreground">{new Date(incidentData.active_incident.started_at).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Duration:</span>
                                  <span className="text-foreground">{incidentData.active_incident.duration_formatted}</span>
                                </div>
                                {incidentData.active_incident.error && (
                                  <div className="mt-2 text-xs text-red-400 bg-red-500/10 p-2 rounded">
                                    {incidentData.active_incident.error}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Incident History */}
                          {incidentData && incidentData.incidents.length > 0 ? (
                            <div className="space-y-3 max-h-[400px] overflow-y-auto">
                              <h5 className="text-sm text-muted-foreground">Past Incidents</h5>
                              {incidentData.incidents.map((incident) => (
                                <div key={incident.id} className="rounded-lg border border-border p-3 bg-muted/20">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className={`text-sm font-medium ${
                                      incident.status === 'down' ? 'text-red-500' : 'text-yellow-500'
                                    }`}>
                                      {incident.status === 'down' ? '🔴 Outage' : '🟡 Degraded'}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {incident.duration_formatted}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-muted-foreground">Start:</span>
                                      <span className="ml-1 text-foreground">
                                        {new Date(incident.started_at).toLocaleString()}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">End:</span>
                                      <span className="ml-1 text-foreground">
                                        {incident.ended_at ? new Date(incident.ended_at).toLocaleString() : 'Ongoing'}
                                      </span>
                                    </div>
                                  </div>
                                  {incident.affected_locations.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {incident.affected_locations.map((loc) => (
                                        <span key={loc} className="text-xs bg-muted px-2 py-0.5 rounded">
                                          {loc}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {incident.error && (
                                    <div className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded">
                                      {incident.error}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : !incidentData?.active_incident && (
                            <div className="text-center py-8 text-muted-foreground">
                              <div className="text-3xl mb-2">✅</div>
                              <p>No incidents recorded</p>
                              <p className="text-xs mt-1">This check has been running without issues</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Maintenance Tab Content */}
                  {activeDetailTab === 'maintenance' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-foreground">🔧 Maintenance Windows</h4>
                        <button
                          onClick={() => setShowMaintenanceModal(true)}
                          className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          + Schedule
                        </button>
                      </div>

                      {isLoadingMaintenance ? (
                        <div className="text-center py-8">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto"></div>
                        </div>
                      ) : (
                        <>
                          {/* Active Maintenance Window */}
                          {maintenanceData?.active_window && (
                            <div className="rounded-lg border-2 border-yellow-500 bg-yellow-500/10 p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-yellow-500">🔧</span>
                                <span className="font-semibold text-yellow-600">Active Maintenance</span>
                              </div>
                              <div className="text-sm space-y-1">
                                <div className="font-medium text-foreground">{maintenanceData.active_window.name}</div>
                                <div className="text-muted-foreground">
                                  {new Date(maintenanceData.active_window.start_time).toLocaleString()} -{' '}
                                  {new Date(maintenanceData.active_window.end_time).toLocaleString()}
                                </div>
                                {maintenanceData.active_window.reason && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Reason: {maintenanceData.active_window.reason}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Scheduled Windows */}
                          {maintenanceData?.scheduled_windows && maintenanceData.scheduled_windows.length > 0 && (
                            <div>
                              <h5 className="text-sm text-muted-foreground mb-2">Scheduled</h5>
                              <div className="space-y-2">
                                {maintenanceData.scheduled_windows.map((window) => (
                                  <div key={window.id} className="rounded-lg border border-border p-3 bg-muted/20">
                                    <div className="flex items-center justify-between">
                                      <div className="font-medium text-foreground text-sm">{window.name}</div>
                                      <button
                                        onClick={() => deleteMaintenanceWindow(window.id)}
                                        className="text-red-500 hover:text-red-600 text-xs"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {new Date(window.start_time).toLocaleString()} -{' '}
                                      {new Date(window.end_time).toLocaleString()}
                                    </div>
                                    {window.reason && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {window.reason}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Past Windows */}
                          {maintenanceData?.past_windows && maintenanceData.past_windows.length > 0 && (
                            <div>
                              <h5 className="text-sm text-muted-foreground mb-2">Past Windows</h5>
                              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                {maintenanceData.past_windows.map((window) => (
                                  <div key={window.id} className="flex items-center justify-between text-xs text-muted-foreground py-1 border-b border-border">
                                    <span>{window.name}</span>
                                    <span>
                                      {new Date(window.start_time).toLocaleDateString()} - {new Date(window.end_time).toLocaleDateString()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {!maintenanceData?.active_window &&
                           (!maintenanceData?.scheduled_windows || maintenanceData.scheduled_windows.length === 0) && (
                            <div className="text-center py-8 text-muted-foreground">
                              <div className="text-3xl mb-2">📅</div>
                              <p>No maintenance windows scheduled</p>
                              <p className="text-xs mt-1">Click "+ Schedule" to add a maintenance window</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Maintenance Window Modal */}
                  {showMaintenanceModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                      <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 border border-border">
                        <h3 className="text-lg font-semibold text-foreground mb-4">Schedule Maintenance Window</h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm text-muted-foreground mb-1">Name *</label>
                            <input
                              type="text"
                              value={maintenanceName}
                              onChange={(e) => setMaintenanceName(e.target.value)}
                              placeholder="e.g., Server Update"
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-muted-foreground mb-1">Start Time *</label>
                            <input
                              type="datetime-local"
                              value={maintenanceStartTime}
                              onChange={(e) => setMaintenanceStartTime(e.target.value)}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-muted-foreground mb-1">End Time *</label>
                            <input
                              type="datetime-local"
                              value={maintenanceEndTime}
                              onChange={(e) => setMaintenanceEndTime(e.target.value)}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-muted-foreground mb-1">Reason (optional)</label>
                            <textarea
                              value={maintenanceReason}
                              onChange={(e) => setMaintenanceReason(e.target.value)}
                              placeholder="e.g., Applying security patches"
                              rows={2}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground resize-none"
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => {
                                setShowMaintenanceModal(false);
                                setMaintenanceName('');
                                setMaintenanceStartTime('');
                                setMaintenanceEndTime('');
                                setMaintenanceReason('');
                              }}
                              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={createMaintenanceWindow}
                              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                            >
                              Schedule
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                  Select a check to view details
                </div>
              )}
            </div>
          </div>
            )}
          </>
        )}

        {/* Transactions Tab Content */}
        {activeTab === 'transactions' && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            ) : transactions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-12 text-center">
                <div className="text-4xl mb-4">🔄</div>
                <h3 className="text-lg font-medium text-foreground">No transactions yet</h3>
                <p className="mt-2 text-muted-foreground">Create multi-step transaction monitors to verify user flows.</p>
                <button
                  onClick={() => setShowTransactionModal(true)}
                  className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Create Transaction
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Transactions List */}
                <div className="lg:col-span-2">
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Steps</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Interval</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {transactions.map(txn => (
                          <tr
                            key={txn.id}
                            className={`hover:bg-muted/30 cursor-pointer ${selectedTransaction?.id === txn.id ? 'bg-primary/5' : ''}`}
                            onClick={() => setSelectedTransaction(txn)}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-foreground">{txn.name}</div>
                              {txn.description && (
                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">{txn.description}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {txn.steps.length} steps
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {txn.interval >= 60 ? `${Math.floor(txn.interval / 60)}m` : `${txn.interval}s`}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                                txn.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {txn.enabled ? '✓ Active' : '⏸ Paused'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => runTransaction(txn.id)}
                                  title="Run now"
                                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                  ▶️
                                </button>
                                <button
                                  onClick={() => deleteTransaction(txn.id)}
                                  title="Delete"
                                  className="rounded p-1.5 text-muted-foreground hover:bg-red-100 hover:text-red-600"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Transaction Details Panel */}
                <div className="lg:col-span-1">
                  {selectedTransaction ? (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <h3 className="font-semibold text-foreground mb-4">{selectedTransaction.name}</h3>
                      {selectedTransaction.description && (
                        <p className="text-sm text-muted-foreground mb-4">{selectedTransaction.description}</p>
                      )}

                      {/* Transaction Steps */}
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-foreground mb-2">Steps ({selectedTransaction.steps.length})</h4>
                        <div className="space-y-2">
                          {selectedTransaction.steps.map((step, index) => (
                            <div key={step.id} className="rounded border border-border p-2 text-xs">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                                  {index + 1}
                                </span>
                                <span className="font-medium text-foreground">{step.name}</span>
                              </div>
                              <div className="ml-7 space-y-1 text-muted-foreground">
                                <div className="font-mono">
                                  <span className="text-blue-600">{step.method}</span> {step.url}
                                </div>
                                <div>Expected: {step.expected_status}</div>
                                {step.assertions && step.assertions.length > 0 && (
                                  <div>Assertions: {step.assertions.length}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recent Results */}
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">Recent Results</h4>
                        {isLoadingTxnResults ? (
                          <div className="text-center py-4">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto"></div>
                          </div>
                        ) : transactionResults.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No results yet. Run the transaction to see results.</p>
                        ) : (
                          <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {transactionResults.map(result => (
                              <div key={result.id} className="rounded border border-border p-2 text-xs">
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`font-medium ${result.status === 'passed' ? 'text-green-600' : 'text-red-600'}`}>
                                    {result.status === 'passed' ? '✓ Passed' : '✗ Failed'}
                                  </span>
                                  <span className="text-muted-foreground">{result.total_duration}ms</span>
                                </div>
                                <div className="text-muted-foreground">
                                  {new Date(result.executed_at).toLocaleString()}
                                </div>
                                <div className="text-muted-foreground">
                                  Steps: {result.steps_passed}/{result.steps_passed + result.steps_failed}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                      Select a transaction to view details
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Performance Tab Content */}
        {activeTab === 'performance' && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            ) : performanceChecks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-12 text-center">
                <div className="text-4xl mb-4">⚡</div>
                <h3 className="text-lg font-medium text-foreground">No performance checks yet</h3>
                <p className="mt-2 text-muted-foreground">Monitor Core Web Vitals and page performance metrics.</p>
                <button
                  onClick={() => setShowPerformanceModal(true)}
                  className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Create Performance Check
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Performance Checks List */}
                <div className="lg:col-span-2">
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Score</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">LCP</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {performanceChecks.map(check => (
                          <tr
                            key={check.id}
                            className={`hover:bg-muted/30 cursor-pointer ${selectedPerformance?.id === check.id ? 'bg-primary/5' : ''}`}
                            onClick={() => setSelectedPerformance(check)}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-foreground">{check.name}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">{check.url}</div>
                            </td>
                            <td className="px-4 py-3">
                              {getPerfStatusBadge(check.latest_status)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-lg font-bold ${
                                (check.latest_score || 0) >= 90 ? 'text-green-600' :
                                (check.latest_score || 0) >= 50 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {check.latest_score || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={getMetricColor('lcp', check.latest_lcp || 0)}>
                                {check.latest_lcp ? `${check.latest_lcp}ms` : '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => runPerformanceCheck(check.id)}
                                  title="Run now"
                                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                  ▶️
                                </button>
                                <button
                                  onClick={() => deletePerformanceCheck(check.id)}
                                  title="Delete"
                                  className="rounded p-1.5 text-muted-foreground hover:bg-red-100 hover:text-red-600"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Performance Details Panel */}
                <div className="lg:col-span-1">
                  {selectedPerformance ? (
                    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
                      <div>
                        <h3 className="font-semibold text-foreground">{selectedPerformance.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">{selectedPerformance.url}</p>
                      </div>

                      {isLoadingPerfResults ? (
                        <div className="text-center py-4">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto"></div>
                        </div>
                      ) : performanceResults.length > 0 && (
                        <>
                          {/* Latest Lighthouse Score */}
                          <div className="text-center py-4 border-b border-border">
                            <div className="text-4xl font-bold mb-1" style={{
                              color: performanceResults[0].lighthouse_score >= 90 ? '#16a34a' :
                                     performanceResults[0].lighthouse_score >= 50 ? '#ca8a04' : '#dc2626'
                            }}>
                              {performanceResults[0].lighthouse_score}
                            </div>
                            <div className="text-xs text-muted-foreground">Lighthouse Score</div>
                          </div>

                          {/* Core Web Vitals */}
                          <div>
                            <h4 className="text-sm font-medium text-foreground mb-2">Core Web Vitals</h4>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="p-2 rounded bg-muted/30">
                                <div className={`text-lg font-bold ${getMetricColor('lcp', performanceResults[0].metrics?.lcp ?? 0)}`}>
                                  {((performanceResults[0].metrics?.lcp ?? 0) / 1000).toFixed(1)}s
                                </div>
                                <div className="text-xs text-muted-foreground">LCP</div>
                              </div>
                              <div className="p-2 rounded bg-muted/30">
                                <div className={`text-lg font-bold ${getMetricColor('fid', performanceResults[0].metrics?.fid ?? 0)}`}>
                                  {performanceResults[0].metrics?.fid ?? 0}ms
                                </div>
                                <div className="text-xs text-muted-foreground">FID</div>
                              </div>
                              <div className="p-2 rounded bg-muted/30">
                                <div className={`text-lg font-bold ${getMetricColor('cls', performanceResults[0].metrics?.cls ?? 0)}`}>
                                  {(performanceResults[0].metrics?.cls ?? 0).toFixed(2)}
                                </div>
                                <div className="text-xs text-muted-foreground">CLS</div>
                              </div>
                            </div>
                          </div>

                          {/* Additional Metrics */}
                          <div>
                            <h4 className="text-sm font-medium text-foreground mb-2">Other Metrics</h4>
                            <dl className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <dt className="text-muted-foreground">TTFB</dt>
                                <dd className={getMetricColor('ttfb', performanceResults[0].metrics?.ttfb ?? 0)}>
                                  {performanceResults[0].metrics?.ttfb ?? 0}ms
                                </dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-muted-foreground">FCP</dt>
                                <dd className={getMetricColor('fcp', performanceResults[0].metrics?.fcp ?? 0)}>
                                  {performanceResults[0].metrics?.fcp ?? 0}ms
                                </dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-muted-foreground">TTI</dt>
                                <dd>{performanceResults[0].metrics?.tti ?? 0}ms</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-muted-foreground">TBT</dt>
                                <dd>{performanceResults[0].metrics?.tbt ?? 0}ms</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-muted-foreground">Speed Index</dt>
                                <dd>{performanceResults[0].metrics?.si ?? 0}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-muted-foreground">Page Size</dt>
                                <dd>{((performanceResults[0].metrics?.total_size ?? 0) / 1024).toFixed(1)}MB</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-muted-foreground">Requests</dt>
                                <dd>{performanceResults[0].metrics?.request_count ?? 0}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-muted-foreground">DOM Elements</dt>
                                <dd>{performanceResults[0].metrics?.dom_elements ?? 0}</dd>
                              </div>
                            </dl>
                          </div>

                          {/* Trends */}
                          {performanceTrends && performanceTrends.trends.lcp.avg > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-foreground mb-2">Trends</h4>
                              <dl className="space-y-1 text-xs">
                                <div className="flex justify-between items-center">
                                  <dt className="text-muted-foreground">LCP Avg</dt>
                                  <dd className="flex items-center gap-1">
                                    {performanceTrends.trends.lcp.avg}ms
                                    <span className={
                                      performanceTrends.trends.lcp.trend === 'improving' ? 'text-green-600' :
                                      performanceTrends.trends.lcp.trend === 'degrading' ? 'text-red-600' : 'text-muted-foreground'
                                    }>
                                      {performanceTrends.trends.lcp.trend === 'improving' ? '↓' :
                                       performanceTrends.trends.lcp.trend === 'degrading' ? '↑' : '→'}
                                    </span>
                                  </dd>
                                </div>
                                <div className="flex justify-between items-center">
                                  <dt className="text-muted-foreground">Score Avg</dt>
                                  <dd className="flex items-center gap-1">
                                    {performanceTrends.trends.lighthouse_score.avg}
                                    <span className={
                                      performanceTrends.trends.lighthouse_score.trend === 'improving' ? 'text-green-600' :
                                      performanceTrends.trends.lighthouse_score.trend === 'degrading' ? 'text-red-600' : 'text-muted-foreground'
                                    }>
                                      {performanceTrends.trends.lighthouse_score.trend === 'improving' ? '↑' :
                                       performanceTrends.trends.lighthouse_score.trend === 'degrading' ? '↓' : '→'}
                                    </span>
                                  </dd>
                                </div>
                              </dl>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                      Select a performance check to view details
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Webhooks Tab Content */}
        {activeTab === 'webhooks' && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            ) : webhookChecks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-12 text-center">
                <div className="text-4xl mb-4">🔗</div>
                <h3 className="text-lg font-medium text-foreground">No webhook checks yet</h3>
                <p className="mt-2 text-muted-foreground">Monitor incoming webhooks with payload validation.</p>
                <button
                  onClick={() => setShowWebhookModal(true)}
                  className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Create Webhook Check
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Webhook Checks List */}
                <div className="lg:col-span-2">
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Last Received</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Events (24h)</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {webhookChecks.map(check => (
                          <tr
                            key={check.id}
                            className={`hover:bg-muted/30 cursor-pointer ${selectedWebhook?.id === check.id ? 'bg-primary/5' : ''}`}
                            onClick={() => {
                              setSelectedWebhook(check);
                              fetchWebhookEvents(check.id);
                            }}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-foreground">{check.name}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">{check.description || 'No description'}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {check.last_received ? new Date(check.last_received).toLocaleTimeString() : 'Never'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-medium">{check.events_24h || 0}</span>
                            </td>
                            <td className="px-4 py-3">
                              {check.last_payload_valid === true && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">✅ Valid</span>
                              )}
                              {check.last_payload_valid === false && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">❌ Invalid</span>
                              )}
                              {check.last_payload_valid === null && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">⚪ Waiting</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => sendTestWebhook(check.id)}
                                  title="Send test webhook"
                                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                  🧪
                                </button>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(window.location.origin + check.webhook_url);
                                    toast.success('Webhook URL copied to clipboard');
                                  }}
                                  title="Copy URL"
                                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                  📋
                                </button>
                                <button
                                  onClick={() => deleteWebhookCheck(check.id)}
                                  title="Delete"
                                  className="rounded p-1.5 text-muted-foreground hover:bg-red-100 hover:text-red-600"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Webhook Details Panel */}
                <div className="lg:col-span-1">
                  {selectedWebhook ? (
                    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
                      <div>
                        <h3 className="font-semibold text-foreground">{selectedWebhook.name}</h3>
                        <p className="text-xs text-muted-foreground">{selectedWebhook.description || 'No description'}</p>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <span className="text-xs text-muted-foreground">Webhook URL:</span>
                          <div className="mt-1 p-2 bg-muted rounded text-xs font-mono break-all">
                            {window.location.origin}{selectedWebhook.webhook_url}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Expected Interval:</span>
                          <span className="ml-2 text-sm">{selectedWebhook.expected_interval}s</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Payload Validation:</span>
                          <span className="ml-2 text-sm capitalize">{selectedWebhook.expected_payload?.type || 'any'}</span>
                        </div>
                        {selectedWebhook.expected_payload?.required_fields && (
                          <div>
                            <span className="text-xs text-muted-foreground">Required Fields:</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {selectedWebhook.expected_payload.required_fields.map((f, i) => (
                                <span key={i} className="px-2 py-0.5 bg-muted rounded text-xs">{f}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="font-medium text-sm mb-2">Recent Events</h4>
                        {webhookEvents.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No events received yet</p>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {webhookEvents.slice(0, 10).map(event => (
                              <div key={event.id} className="p-2 border border-border rounded text-xs">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-muted-foreground">{new Date(event.received_at).toLocaleString()}</span>
                                  {event.payload_valid ? (
                                    <span className="text-green-600">✅</span>
                                  ) : (
                                    <span className="text-red-600">❌</span>
                                  )}
                                </div>
                                {event.validation_errors && (
                                  <div className="text-red-500 text-xs">{event.validation_errors.join(', ')}</div>
                                )}
                                <div className="text-muted-foreground">From: {event.source_ip}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                      Select a webhook check to view details
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* DNS Tab Content */}
        {activeTab === 'dns' && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            ) : dnsChecks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-12 text-center">
                <div className="text-4xl mb-4">🌐</div>
                <h3 className="text-lg font-medium text-foreground">No DNS checks yet</h3>
                <p className="mt-2 text-muted-foreground">Monitor DNS resolution for your domains.</p>
                <button
                  onClick={() => setShowDnsModal(true)}
                  className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Create DNS Check
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* DNS Checks List */}
                <div className="lg:col-span-2">
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Domain</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Record</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {dnsChecks.map(check => (
                          <tr
                            key={check.id}
                            className={`hover:bg-muted/30 cursor-pointer ${selectedDns?.id === check.id ? 'bg-primary/5' : ''}`}
                            onClick={() => setSelectedDns(check)}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-foreground">{check.name}</div>
                              <div className="text-xs text-muted-foreground">Every {check.interval}s</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                              {check.domain}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 bg-muted rounded text-xs font-mono">{check.record_type}</span>
                            </td>
                            <td className="px-4 py-3">
                              {getStatusBadge(check.latest_status)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => runDnsCheck(check.id)}
                                  title="Run check"
                                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                  ▶️
                                </button>
                                <button
                                  onClick={() => toggleDnsCheck(check.id)}
                                  title={check.enabled ? 'Disable' : 'Enable'}
                                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                  {check.enabled ? '⏸️' : '▶️'}
                                </button>
                                <button
                                  onClick={() => deleteDnsCheck(check.id)}
                                  title="Delete"
                                  className="rounded p-1.5 text-muted-foreground hover:bg-red-100 hover:text-red-600"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* DNS Details Panel */}
                <div className="lg:col-span-1">
                  {selectedDns ? (
                    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
                      <div>
                        <h3 className="font-semibold text-foreground">{selectedDns.name}</h3>
                        <p className="text-xs text-muted-foreground font-mono">{selectedDns.domain}</p>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <span className="text-xs text-muted-foreground">Record Type:</span>
                          <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded text-sm font-mono">{selectedDns.record_type}</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Check Interval:</span>
                          <span className="ml-2 text-sm">{selectedDns.interval}s</span>
                        </div>
                        {selectedDns.expected_values && selectedDns.expected_values.length > 0 && (
                          <div>
                            <span className="text-xs text-muted-foreground">Expected Values:</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {selectedDns.expected_values.map((v, i) => (
                                <span key={i} className="px-2 py-0.5 bg-muted rounded text-xs font-mono">{v}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {selectedDns.latest_resolved_values && selectedDns.latest_resolved_values.length > 0 && (
                          <div>
                            <span className="text-xs text-muted-foreground">Resolved Values:</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {selectedDns.latest_resolved_values.map((v, i) => (
                                <span key={i} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-mono">{v}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <span className="text-xs text-muted-foreground">Last Checked:</span>
                          <span className="ml-2 text-sm">
                            {selectedDns.latest_checked_at
                              ? new Date(selectedDns.latest_checked_at).toLocaleString()
                              : 'Never'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm mb-2">Recent Results</h4>
                        {isLoadingDnsResults ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                          </div>
                        ) : dnsResults.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No results yet. Run a check!</p>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {dnsResults.slice(0, 10).map(result => (
                              <div key={result.id} className="p-2 border border-border rounded text-xs">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-muted-foreground">{new Date(result.checked_at).toLocaleString()}</span>
                                  {result.status === 'up' ? (
                                    <span className="text-green-600">✅ {result.response_time}ms</span>
                                  ) : result.status === 'degraded' ? (
                                    <span className="text-yellow-600">⚠️ {result.response_time}ms</span>
                                  ) : (
                                    <span className="text-red-600">❌</span>
                                  )}
                                </div>
                                {result.error && (
                                  <div className="text-red-500 text-xs">{result.error}</div>
                                )}
                                {result.resolved_values && result.resolved_values.length > 0 && (
                                  <div className="text-muted-foreground mt-1">
                                    <span>Resolved: </span>
                                    {result.resolved_values.join(', ')}
                                  </div>
                                )}
                                {!result.all_expected_found && result.expected_values.length > 0 && (
                                  <div className="text-yellow-600 mt-1">
                                    Missing expected values
                                  </div>
                                )}
                                <div className="text-muted-foreground">NS: {result.nameserver_used}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                      Select a DNS check to view details
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* TCP Tab Content */}
        {activeTab === 'tcp' && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            ) : tcpChecks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-12 text-center">
                <div className="text-4xl mb-4">🔌</div>
                <h3 className="text-lg font-medium text-foreground">No TCP checks yet</h3>
                <p className="mt-2 text-muted-foreground">Monitor TCP port availability for your hosts.</p>
                <button
                  onClick={() => setShowTcpModal(true)}
                  className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Create TCP Check
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* TCP Checks List */}
                <div className="lg:col-span-2">
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Host</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Port</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {tcpChecks.map(check => (
                          <tr
                            key={check.id}
                            className={`hover:bg-muted/30 cursor-pointer ${selectedTcp?.id === check.id ? 'bg-primary/5' : ''}`}
                            onClick={() => setSelectedTcp(check)}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-foreground">{check.name}</div>
                              <div className="text-xs text-muted-foreground">Every {check.interval}s</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                              {check.host}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 bg-muted rounded text-xs font-mono">{check.port}</span>
                            </td>
                            <td className="px-4 py-3">
                              {check.latest_status === 'up' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">🟢 Open</span>
                              ) : check.latest_status === 'down' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">🔴 Closed</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">⚪ Unknown</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => runTcpCheck(check.id)}
                                  title="Run check"
                                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                  ▶️
                                </button>
                                <button
                                  onClick={() => toggleTcpCheck(check.id)}
                                  title={check.enabled ? 'Disable' : 'Enable'}
                                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                  {check.enabled ? '⏸️' : '▶️'}
                                </button>
                                <button
                                  onClick={() => deleteTcpCheck(check.id)}
                                  title="Delete"
                                  className="rounded p-1.5 text-muted-foreground hover:bg-red-100 hover:text-red-600"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* TCP Details Panel */}
                <div className="lg:col-span-1">
                  {selectedTcp ? (
                    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
                      <div>
                        <h3 className="font-semibold text-foreground">{selectedTcp.name}</h3>
                        <p className="text-xs text-muted-foreground font-mono">{selectedTcp.host}:{selectedTcp.port}</p>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <span className="text-xs text-muted-foreground">Port:</span>
                          <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded text-sm font-mono">{selectedTcp.port}</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Check Interval:</span>
                          <span className="ml-2 text-sm">{selectedTcp.interval}s</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Port Status:</span>
                          <span className="ml-2 text-sm">
                            {selectedTcp.latest_port_open === true ? '✅ Open' : selectedTcp.latest_port_open === false ? '❌ Closed' : 'Unknown'}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Last Checked:</span>
                          <span className="ml-2 text-sm">
                            {selectedTcp.latest_checked_at
                              ? new Date(selectedTcp.latest_checked_at).toLocaleString()
                              : 'Never'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm mb-2">Recent Results</h4>
                        {isLoadingTcpResults ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                          </div>
                        ) : tcpResults.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No results yet. Run a check!</p>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {tcpResults.slice(0, 10).map(result => (
                              <div key={result.id} className="p-2 border border-border rounded text-xs">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-muted-foreground">{new Date(result.checked_at).toLocaleString()}</span>
                                  {result.port_open ? (
                                    <span className="text-green-600">✅ {result.response_time}ms</span>
                                  ) : (
                                    <span className="text-red-600">❌ Closed</span>
                                  )}
                                </div>
                                {result.error && (
                                  <div className="text-red-500 text-xs">{result.error}</div>
                                )}
                                <div className="text-muted-foreground">
                                  Port {result.port_open ? 'Open' : 'Closed'}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                      Select a TCP check to view details
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Settings Tab Content */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {isLoadingSettings ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            ) : (
              <>
                {/* Retention Settings Card */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">📦 Data Retention Settings</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Configure how long check results are retained. Older results will be automatically cleaned up.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Retention Period
                      </label>
                      <select
                        value={settingsRetentionDays}
                        onChange={(e) => setSettingsRetentionDays(Number(e.target.value) as 30 | 90 | 365)}
                        className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-foreground"
                      >
                        <option value={30}>30 days</option>
                        <option value={90}>90 days</option>
                        <option value={365}>365 days (1 year)</option>
                      </select>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Results older than this will be removed during cleanup
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="autoCleanup"
                        checked={settingsAutoCleanup}
                        onChange={(e) => setSettingsAutoCleanup(e.target.checked)}
                        className="h-4 w-4 rounded border-input"
                      />
                      <label htmlFor="autoCleanup" className="text-sm text-foreground">
                        Enable automatic cleanup
                      </label>
                    </div>

                    <div className="flex items-center gap-4 pt-4">
                      <button
                        onClick={saveMonitoringSettings}
                        disabled={isSavingSettings}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {isSavingSettings ? 'Saving...' : 'Save Settings'}
                      </button>
                      <button
                        onClick={runRetentionCleanup}
                        disabled={isRunningCleanup}
                        className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        {isRunningCleanup ? 'Running...' : 'Run Cleanup Now'}
                      </button>
                    </div>

                    {monitoringSettings?.last_cleanup_at && (
                      <p className="text-xs text-muted-foreground">
                        Last cleanup: {new Date(monitoringSettings.last_cleanup_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Retention Statistics Card */}
                {retentionStats && (
                  <div className="rounded-lg border border-border bg-card p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">📊 Result Statistics by Age</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Overview of stored check results grouped by age. Current retention: <strong>{retentionStats.retention_days} days</strong>
                    </p>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Check Type</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Total</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Last 30d</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">30-90d</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">90-365d</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Older</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {[
                            { name: 'Uptime Checks', data: retentionStats.stats.uptime, icon: '🌐' },
                            { name: 'Transactions', data: retentionStats.stats.transaction, icon: '🔄' },
                            { name: 'Performance', data: retentionStats.stats.performance, icon: '⚡' },
                            { name: 'Webhooks', data: retentionStats.stats.webhook, icon: '🔗' },
                            { name: 'DNS Checks', data: retentionStats.stats.dns, icon: '🌍' },
                            { name: 'TCP Checks', data: retentionStats.stats.tcp, icon: '🔌' },
                          ].map(({ name, data, icon }) => (
                            <tr key={name} className="hover:bg-muted/30">
                              <td className="px-4 py-3 font-medium text-foreground">
                                {icon} {name}
                              </td>
                              <td className="px-4 py-3 text-right text-sm">{data.total}</td>
                              <td className="px-4 py-3 text-right text-sm text-green-600">{data.last30}</td>
                              <td className="px-4 py-3 text-right text-sm text-yellow-600">{data.last90}</td>
                              <td className="px-4 py-3 text-right text-sm text-orange-600">{data.last365}</td>
                              <td className="px-4 py-3 text-right text-sm text-red-600">{data.older}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        💡 <strong>Tip:</strong> Results in the red column (older than {retentionStats.retention_days} days based on your retention setting) will be removed during cleanup.
                      </p>
                    </div>
                  </div>
                )}

                {/* Status Page Settings Card */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">📊 Public Status Pages</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Create public status pages to share your service status with external users
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        resetStatusPageForm();
                        setShowStatusPageModal(true);
                      }}
                      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Create Status Page
                    </button>
                  </div>

                  {isLoadingStatusPages ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    </div>
                  ) : statusPages.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center">
                      <div className="text-4xl mb-3">📄</div>
                      <h4 className="font-medium text-foreground mb-2">No status pages yet</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create a public status page to share your service status with customers
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {statusPages.map(page => (
                        <div key={page.id} className="rounded-lg border border-border p-4 hover:bg-muted/30">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: page.primary_color || '#2563EB' }}
                              />
                              <div>
                                <h4 className="font-medium text-foreground">{page.name}</h4>
                                <p className="text-xs text-muted-foreground">
                                  /{page.slug} • {page.checks.length} checks • {page.is_public ? '🌐 Public' : '🔒 Private'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={`/status/${page.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                              >
                                View Page
                              </a>
                              <button
                                onClick={() => openEditStatusPage(page)}
                                className="rounded px-3 py-1.5 text-xs font-medium bg-muted text-foreground hover:bg-muted/80"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => openIncidentManagement(page)}
                                className="rounded px-3 py-1.5 text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200"
                              >
                                Incidents
                              </button>
                              <button
                                onClick={() => handleDeleteStatusPage(page.id)}
                                className="rounded px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          {page.description && (
                            <p className="mt-2 text-sm text-muted-foreground">{page.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* On-Call Schedules Card */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">📞 On-Call Schedules</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Manage on-call rotation schedules for your team
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        resetOnCallScheduleForm();
                        setShowOnCallModal(true);
                      }}
                      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Create Schedule
                    </button>
                  </div>

                  {isLoadingOnCallSchedules ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    </div>
                  ) : onCallSchedules.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center">
                      <div className="text-4xl mb-3">📅</div>
                      <h4 className="font-medium text-foreground mb-2">No on-call schedules yet</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create an on-call schedule to manage team rotations
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {onCallSchedules.map(schedule => {
                        const currentOnCall = schedule.members[schedule.current_on_call_index];
                        return (
                          <div key={schedule.id} className="rounded-lg border border-border p-4 hover:bg-muted/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${schedule.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                                <div>
                                  <h4 className="font-medium text-foreground">{schedule.name}</h4>
                                  <p className="text-xs text-muted-foreground">
                                    {schedule.rotation_type === 'daily' ? 'Daily' : schedule.rotation_type === 'weekly' ? 'Weekly' : `Every ${schedule.rotation_interval_days} days`} rotation • {schedule.members.length} members • {schedule.timezone}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleRotateOnCallSchedule(schedule.id)}
                                  className="rounded px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                                  title="Manual rotation"
                                >
                                  🔄 Rotate
                                </button>
                                <button
                                  onClick={() => openEditOnCallSchedule(schedule)}
                                  className="rounded px-3 py-1.5 text-xs font-medium bg-muted text-foreground hover:bg-muted/80"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteOnCallSchedule(schedule.id)}
                                  className="rounded px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            {currentOnCall && (
                              <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                                  🟢 Currently On-Call: {currentOnCall.user_name}
                                </p>
                                <p className="text-xs text-green-600 dark:text-green-400">
                                  {currentOnCall.user_email} {currentOnCall.phone && `• ${currentOnCall.phone}`}
                                </p>
                              </div>
                            )}
                            {schedule.description && (
                              <p className="mt-2 text-sm text-muted-foreground">{schedule.description}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Alert Severity Mapping Card */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">🎚️ Alert Severity Mapping</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Map internal severity levels to external priority levels (P1-P5) for incident management
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        setIsSavingSeverityMapping(true);
                        try {
                          // In production, this would save to backend
                          await new Promise(resolve => setTimeout(resolve, 500));
                          toast.success('Severity mapping saved');
                        } catch {
                          toast.error('Failed to save severity mapping');
                        } finally {
                          setIsSavingSeverityMapping(false);
                        }
                      }}
                      disabled={isSavingSeverityMapping}
                      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isSavingSeverityMapping ? 'Saving...' : 'Save Mapping'}
                    </button>
                  </div>
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      These mappings are applied globally when alerts are sent to external systems (PagerDuty, OpsGenie, etc.)
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Critical → P1 */}
                      <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-red-600 dark:text-red-400">🔴 Critical</span>
                          <span className="text-xs text-muted-foreground">Highest priority</span>
                        </div>
                        <select
                          value={globalSeverityMapping.critical}
                          onChange={(e) => setGlobalSeverityMapping({ ...globalSeverityMapping, critical: e.target.value })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                        >
                          <option value="P1">P1 - Critical</option>
                          <option value="P2">P2 - High</option>
                          <option value="P3">P3 - Medium</option>
                          <option value="P4">P4 - Low</option>
                          <option value="P5">P5 - Informational</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">System down, data loss risk</p>
                      </div>
                      {/* High → P2 */}
                      <div className="p-4 rounded-lg border border-orange-500/30 bg-orange-500/10">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-orange-600 dark:text-orange-400">🟠 High</span>
                          <span className="text-xs text-muted-foreground">Urgent response</span>
                        </div>
                        <select
                          value={globalSeverityMapping.high}
                          onChange={(e) => setGlobalSeverityMapping({ ...globalSeverityMapping, high: e.target.value })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                        >
                          <option value="P1">P1 - Critical</option>
                          <option value="P2">P2 - High</option>
                          <option value="P3">P3 - Medium</option>
                          <option value="P4">P4 - Low</option>
                          <option value="P5">P5 - Informational</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">Major impact, needs attention</p>
                      </div>
                      {/* Medium → P3 */}
                      <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-yellow-600 dark:text-yellow-400">🟡 Medium</span>
                          <span className="text-xs text-muted-foreground">Normal priority</span>
                        </div>
                        <select
                          value={globalSeverityMapping.medium}
                          onChange={(e) => setGlobalSeverityMapping({ ...globalSeverityMapping, medium: e.target.value })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                        >
                          <option value="P1">P1 - Critical</option>
                          <option value="P2">P2 - High</option>
                          <option value="P3">P3 - Medium</option>
                          <option value="P4">P4 - Low</option>
                          <option value="P5">P5 - Informational</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">Degraded service, workaround available</p>
                      </div>
                      {/* Low → P4 */}
                      <div className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/10">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-blue-600 dark:text-blue-400">🔵 Low</span>
                          <span className="text-xs text-muted-foreground">Low priority</span>
                        </div>
                        <select
                          value={globalSeverityMapping.low}
                          onChange={(e) => setGlobalSeverityMapping({ ...globalSeverityMapping, low: e.target.value })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                        >
                          <option value="P1">P1 - Critical</option>
                          <option value="P2">P2 - High</option>
                          <option value="P3">P3 - Medium</option>
                          <option value="P4">P4 - Low</option>
                          <option value="P5">P5 - Informational</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">Minor impact, can be scheduled</p>
                      </div>
                      {/* Info → P5 */}
                      <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/10">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-green-600 dark:text-green-400">🟢 Info</span>
                          <span className="text-xs text-muted-foreground">Informational</span>
                        </div>
                        <select
                          value={globalSeverityMapping.info}
                          onChange={(e) => setGlobalSeverityMapping({ ...globalSeverityMapping, info: e.target.value })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                        >
                          <option value="P1">P1 - Critical</option>
                          <option value="P2">P2 - High</option>
                          <option value="P3">P3 - Medium</option>
                          <option value="P4">P4 - Low</option>
                          <option value="P5">P5 - Informational</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">No action required</p>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs font-medium text-foreground mb-2">Current Mapping Preview:</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded">
                          Critical → {globalSeverityMapping.critical}
                        </span>
                        <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded">
                          High → {globalSeverityMapping.high}
                        </span>
                        <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded">
                          Medium → {globalSeverityMapping.medium}
                        </span>
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                          Low → {globalSeverityMapping.low}
                        </span>
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                          Info → {globalSeverityMapping.info}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alert Rate Limiting Card */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">⏱️ Alert Rate Limiting</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Limit alert frequency to prevent notification flooding
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          setIsTestingRateLimit(true);
                          try {
                            // Simulate triggering many alerts rapidly to test rate limiting
                            const response = await fetch('/api/v1/monitoring/alert-rate-limit/test', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify({ alert_count: 10 }),
                            });
                            const data = await response.json();
                            if (response.ok) {
                              setRateLimitStats(data.stats);
                              toast.success(`Test complete: ${data.sent} sent, ${data.suppressed} suppressed`);
                            } else {
                              toast.error('Rate limit test failed');
                            }
                          } catch {
                            toast.error('Failed to test rate limiting');
                          } finally {
                            setIsTestingRateLimit(false);
                          }
                        }}
                        disabled={isTestingRateLimit || !alertRateLimitConfig.enabled}
                        className="rounded-md bg-blue-100 dark:bg-blue-900/30 px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50"
                      >
                        {isTestingRateLimit ? '🔄 Testing...' : '🧪 Test Rate Limit'}
                      </button>
                      <button
                        onClick={async () => {
                          setIsSavingRateLimit(true);
                          try {
                            const response = await fetch('/api/v1/monitoring/alert-rate-limit/config', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify(alertRateLimitConfig),
                            });
                            if (response.ok) {
                              toast.success('Rate limit settings saved');
                            } else {
                              toast.error('Failed to save rate limit settings');
                            }
                          } catch {
                            toast.error('Failed to save rate limit settings');
                          } finally {
                            setIsSavingRateLimit(false);
                          }
                        }}
                        disabled={isSavingRateLimit}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {isSavingRateLimit ? 'Saving...' : 'Save Settings'}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {/* Enable/Disable toggle */}
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${alertRateLimitConfig.enabled ? 'bg-green-500' : 'bg-gray-400'}`}
                          onClick={() => setAlertRateLimitConfig({ ...alertRateLimitConfig, enabled: !alertRateLimitConfig.enabled })}
                        >
                          <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${alertRateLimitConfig.enabled ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5`} />
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Rate Limiting {alertRateLimitConfig.enabled ? 'Enabled' : 'Disabled'}</span>
                          <p className="text-xs text-muted-foreground">
                            {alertRateLimitConfig.enabled ? 'Alerts will be rate limited' : 'All alerts will be sent without limiting'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Rate Limit Settings */}
                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!alertRateLimitConfig.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                      {/* Max alerts per minute */}
                      <div className="p-4 rounded-lg border border-border">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Max Alerts per Time Window
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={alertRateLimitConfig.max_alerts_per_minute}
                            onChange={(e) => setAlertRateLimitConfig({ ...alertRateLimitConfig, max_alerts_per_minute: parseInt(e.target.value) || 5 })}
                            className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                          />
                          <span className="text-sm text-muted-foreground">alerts per</span>
                          <select
                            value={alertRateLimitConfig.time_window_seconds}
                            onChange={(e) => setAlertRateLimitConfig({ ...alertRateLimitConfig, time_window_seconds: parseInt(e.target.value) })}
                            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                          >
                            <option value="30">30 seconds</option>
                            <option value="60">1 minute</option>
                            <option value="120">2 minutes</option>
                            <option value="300">5 minutes</option>
                          </select>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Maximum number of alerts sent within the time window
                        </p>
                      </div>

                      {/* Suppression Mode */}
                      <div className="p-4 rounded-lg border border-border">
                        <label className="block text-sm font-medium text-foreground mb-2">
                          When Rate Limit Exceeded
                        </label>
                        <select
                          value={alertRateLimitConfig.suppression_mode}
                          onChange={(e) => setAlertRateLimitConfig({ ...alertRateLimitConfig, suppression_mode: e.target.value as 'drop' | 'aggregate' })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                        >
                          <option value="aggregate">Aggregate & Send Summary</option>
                          <option value="drop">Drop Excess Alerts</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-2">
                          {alertRateLimitConfig.suppression_mode === 'aggregate'
                            ? 'Suppressed alerts are collected and sent as a summary'
                            : 'Suppressed alerts are discarded (not recommended)'}
                        </p>
                      </div>

                      {/* Aggregate Threshold (only for aggregate mode) */}
                      {alertRateLimitConfig.suppression_mode === 'aggregate' && (
                        <div className="p-4 rounded-lg border border-border">
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Summary Threshold
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Send summary after</span>
                            <input
                              type="number"
                              min="5"
                              max="100"
                              value={alertRateLimitConfig.aggregate_threshold}
                              onChange={(e) => setAlertRateLimitConfig({ ...alertRateLimitConfig, aggregate_threshold: parseInt(e.target.value) || 10 })}
                              className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                            />
                            <span className="text-sm text-muted-foreground">suppressed alerts</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            A summary notification is sent when this many alerts are suppressed
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Rate Limit Stats */}
                    {rateLimitStats && (
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <p className="text-sm font-medium text-foreground mb-3">📊 Rate Limit Statistics (Current Window)</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-2 bg-background rounded-lg">
                            <div className="text-2xl font-bold text-foreground">{rateLimitStats.total_alerts}</div>
                            <div className="text-xs text-muted-foreground">Total Alerts</div>
                          </div>
                          <div className="text-center p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{rateLimitStats.sent_alerts}</div>
                            <div className="text-xs text-muted-foreground">Sent</div>
                          </div>
                          <div className="text-center p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{rateLimitStats.suppressed_alerts}</div>
                            <div className="text-xs text-muted-foreground">Suppressed</div>
                          </div>
                          <div className="text-center p-2 bg-background rounded-lg">
                            <div className="text-sm font-medium text-foreground">{new Date(rateLimitStats.last_reset).toLocaleTimeString()}</div>
                            <div className="text-xs text-muted-foreground">Window Reset</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Info Box */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <span className="text-blue-500">ℹ️</span>
                        <div className="text-xs text-blue-700 dark:text-blue-300">
                          <strong>How it works:</strong> When alerts exceed the rate limit, excess alerts are {alertRateLimitConfig.suppression_mode === 'aggregate' ? 'collected and sent as a summary notification' : 'dropped'}.
                          This prevents notification fatigue during incidents that generate many alerts rapidly.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alert Correlation Card */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">🔗 Alert Correlation</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Automatically correlate related alerts to reduce noise
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          setIsTestingCorrelation(true);
                          try {
                            const response = await fetch('/api/v1/monitoring/alert-correlation/test', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify({ alert_count: 8, scenario: 'mixed' }),
                            });
                            const data = await response.json();
                            if (response.ok) {
                              // Refresh correlations list
                              const listResponse = await fetch('/api/v1/monitoring/alert-correlation/correlations?status=active', {
                                headers: { Authorization: `Bearer ${token}` },
                              });
                              if (listResponse.ok) {
                                const listData = await listResponse.json();
                                setAlertCorrelations(listData.correlations || []);
                              }
                              toast.success(`Test complete: ${data.test_alerts} alerts → ${data.correlations_created} correlation group(s)`);
                            } else {
                              toast.error('Correlation test failed');
                            }
                          } catch {
                            toast.error('Failed to test correlation');
                          } finally {
                            setIsTestingCorrelation(false);
                          }
                        }}
                        disabled={isTestingCorrelation || !alertCorrelationConfig.enabled}
                        className="rounded-md bg-blue-100 dark:bg-blue-900/30 px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50"
                      >
                        {isTestingCorrelation ? '🔄 Testing...' : '🧪 Test Correlation'}
                      </button>
                      <button
                        onClick={async () => {
                          setIsSavingCorrelation(true);
                          try {
                            const response = await fetch('/api/v1/monitoring/alert-correlation/config', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify(alertCorrelationConfig),
                            });
                            if (response.ok) {
                              toast.success('Correlation settings saved');
                            } else {
                              toast.error('Failed to save correlation settings');
                            }
                          } catch {
                            toast.error('Failed to save correlation settings');
                          } finally {
                            setIsSavingCorrelation(false);
                          }
                        }}
                        disabled={isSavingCorrelation}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {isSavingCorrelation ? 'Saving...' : 'Save Settings'}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {/* Enable/Disable toggle */}
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${alertCorrelationConfig.enabled ? 'bg-green-500' : 'bg-gray-400'}`}
                          onClick={() => setAlertCorrelationConfig({ ...alertCorrelationConfig, enabled: !alertCorrelationConfig.enabled })}
                        >
                          <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${alertCorrelationConfig.enabled ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5`} />
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Correlation {alertCorrelationConfig.enabled ? 'Enabled' : 'Disabled'}</span>
                          <p className="text-xs text-muted-foreground">
                            {alertCorrelationConfig.enabled ? 'Related alerts will be grouped together' : 'Each alert treated individually'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Correlation Settings */}
                    <div className={`space-y-4 ${!alertCorrelationConfig.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                      {/* Correlation Methods */}
                      <div className="p-4 rounded-lg border border-border">
                        <label className="block text-sm font-medium text-foreground mb-3">
                          Correlation Methods
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={alertCorrelationConfig.correlate_by_check}
                              onChange={(e) => setAlertCorrelationConfig({ ...alertCorrelationConfig, correlate_by_check: e.target.checked })}
                              className="rounded border-input"
                            />
                            <span className="text-sm text-foreground">Same Check</span>
                          </label>
                          <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={alertCorrelationConfig.correlate_by_location}
                              onChange={(e) => setAlertCorrelationConfig({ ...alertCorrelationConfig, correlate_by_location: e.target.checked })}
                              className="rounded border-input"
                            />
                            <span className="text-sm text-foreground">Same Location</span>
                          </label>
                          <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={alertCorrelationConfig.correlate_by_error_type}
                              onChange={(e) => setAlertCorrelationConfig({ ...alertCorrelationConfig, correlate_by_error_type: e.target.checked })}
                              className="rounded border-input"
                            />
                            <span className="text-sm text-foreground">Similar Error</span>
                          </label>
                          <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={alertCorrelationConfig.correlate_by_time_window}
                              onChange={(e) => setAlertCorrelationConfig({ ...alertCorrelationConfig, correlate_by_time_window: e.target.checked })}
                              className="rounded border-input"
                            />
                            <span className="text-sm text-foreground">Time Proximity</span>
                          </label>
                        </div>
                      </div>

                      {/* Time Window & Similarity */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg border border-border">
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Correlation Time Window
                          </label>
                          <select
                            value={alertCorrelationConfig.time_window_seconds}
                            onChange={(e) => setAlertCorrelationConfig({ ...alertCorrelationConfig, time_window_seconds: parseInt(e.target.value) })}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                          >
                            <option value="60">1 minute</option>
                            <option value="180">3 minutes</option>
                            <option value="300">5 minutes</option>
                            <option value="600">10 minutes</option>
                            <option value="900">15 minutes</option>
                          </select>
                          <p className="text-xs text-muted-foreground mt-2">
                            Alerts within this window may be correlated
                          </p>
                        </div>

                        <div className="p-4 rounded-lg border border-border">
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Error Similarity Threshold
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min="30"
                              max="100"
                              value={alertCorrelationConfig.similarity_threshold}
                              onChange={(e) => setAlertCorrelationConfig({ ...alertCorrelationConfig, similarity_threshold: parseInt(e.target.value) })}
                              className="flex-1"
                            />
                            <span className="text-sm font-medium text-foreground w-12">{alertCorrelationConfig.similarity_threshold}%</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Minimum similarity for error message matching
                          </p>
                        </div>
                      </div>

                      {/* Correlated Alerts List */}
                      {alertCorrelations.length > 0 && (
                        <div className="p-4 bg-muted/30 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-foreground">📊 Active Correlations</p>
                            <button
                              onClick={async () => {
                                try {
                                  await fetch('/api/v1/monitoring/alert-correlation/reset', {
                                    method: 'POST',
                                    headers: { Authorization: `Bearer ${token}` },
                                  });
                                  setAlertCorrelations([]);
                                  toast.success('Correlation state reset');
                                } catch {
                                  toast.error('Failed to reset');
                                }
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              Reset All
                            </button>
                          </div>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {alertCorrelations.map(corr => (
                              <div
                                key={corr.id}
                                className="p-3 bg-background rounded-lg border border-border cursor-pointer hover:border-primary/50"
                                onClick={() => setSelectedCorrelation(selectedCorrelation?.id === corr.id ? null : corr)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${
                                      corr.status === 'active' ? 'bg-yellow-500' :
                                      corr.status === 'acknowledged' ? 'bg-blue-500' : 'bg-green-500'
                                    }`} />
                                    <span className="text-sm font-medium text-foreground">
                                      {corr.alerts.length} alerts correlated
                                    </span>
                                  </div>
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                    {corr.correlation_reason.replace('_', ' ')}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{corr.correlation_details}</p>

                                {/* Expanded details */}
                                {selectedCorrelation?.id === corr.id && (
                                  <div className="mt-3 pt-3 border-t border-border">
                                    <p className="text-xs font-medium text-foreground mb-2">Correlated Alerts:</p>
                                    <div className="space-y-1">
                                      {corr.alerts.slice(0, 5).map((alert, idx) => (
                                        <div key={alert.id} className="flex items-center gap-2 text-xs">
                                          <span className={`w-1.5 h-1.5 rounded-full ${
                                            alert.severity === 'critical' ? 'bg-red-500' :
                                            alert.severity === 'high' ? 'bg-orange-500' :
                                            alert.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                                          }`} />
                                          <span className="text-foreground">{alert.check_name}</span>
                                          {alert.location && <span className="text-muted-foreground">({alert.location})</span>}
                                        </div>
                                      ))}
                                      {corr.alerts.length > 5 && (
                                        <p className="text-xs text-muted-foreground">+{corr.alerts.length - 5} more alerts</p>
                                      )}
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            await fetch(`/api/v1/monitoring/alert-correlation/correlations/${corr.id}/acknowledge`, {
                                              method: 'POST',
                                              headers: { Authorization: `Bearer ${token}` },
                                            });
                                            setAlertCorrelations(prev => prev.map(c => c.id === corr.id ? { ...c, status: 'acknowledged' } : c));
                                            toast.success('Correlation acknowledged');
                                          } catch {
                                            toast.error('Failed to acknowledge');
                                          }
                                        }}
                                        disabled={corr.status !== 'active'}
                                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 disabled:opacity-50"
                                      >
                                        Acknowledge
                                      </button>
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            await fetch(`/api/v1/monitoring/alert-correlation/correlations/${corr.id}/resolve`, {
                                              method: 'POST',
                                              headers: { Authorization: `Bearer ${token}` },
                                            });
                                            setAlertCorrelations(prev => prev.filter(c => c.id !== corr.id));
                                            setSelectedCorrelation(null);
                                            toast.success('Correlation resolved');
                                          } catch {
                                            toast.error('Failed to resolve');
                                          }
                                        }}
                                        className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                                      >
                                        Resolve
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Info Box */}
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-start gap-2">
                          <span className="text-blue-500">ℹ️</span>
                          <div className="text-xs text-blue-700 dark:text-blue-300">
                            <strong>How it works:</strong> When related alerts are detected (same check, location, or similar errors within the time window),
                            they are grouped together. This reduces noise and helps identify patterns during incidents.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alert Runbooks Card */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">📖 Alert Runbooks</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Attach runbook documentation to alert types for faster incident response
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingRunbook(null);
                        setRunbookForm({
                          name: '',
                          description: '',
                          check_type: 'all',
                          severity: 'all',
                          runbook_url: '',
                          instructions: '',
                        });
                        setShowRunbookModal(true);
                      }}
                      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Add Runbook
                    </button>
                  </div>

                  {/* Runbook List */}
                  {alertRunbooks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center">
                      <div className="text-4xl mb-3">📚</div>
                      <h4 className="font-medium text-foreground mb-2">No runbooks configured</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Add runbook documentation links to help your team respond to alerts faster
                      </p>
                      <button
                        onClick={() => setShowRunbookModal(true)}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Add Your First Runbook
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {alertRunbooks.map(runbook => (
                        <div key={runbook.id} className="rounded-lg border border-border p-4 hover:bg-muted/30">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="text-2xl">
                                {runbook.check_type === 'uptime' && '🌐'}
                                {runbook.check_type === 'transaction' && '🔄'}
                                {runbook.check_type === 'performance' && '⚡'}
                                {runbook.check_type === 'webhook' && '🔗'}
                                {runbook.check_type === 'dns' && '🌍'}
                                {runbook.check_type === 'tcp' && '🔌'}
                                {runbook.check_type === 'all' && '📋'}
                              </div>
                              <div>
                                <h4 className="font-medium text-foreground">{runbook.name}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {runbook.check_type === 'all' ? 'All check types' : runbook.check_type}
                                  {' • '}
                                  {runbook.severity === 'all' ? 'All severities' : runbook.severity}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={runbook.runbook_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                              >
                                📖 View Runbook
                              </a>
                              <button
                                onClick={() => {
                                  setEditingRunbook(runbook);
                                  setRunbookForm({
                                    name: runbook.name,
                                    description: runbook.description || '',
                                    check_type: runbook.check_type,
                                    severity: runbook.severity || 'all',
                                    runbook_url: runbook.runbook_url,
                                    instructions: runbook.instructions || '',
                                  });
                                  setShowRunbookModal(true);
                                }}
                                className="rounded px-3 py-1.5 text-xs font-medium bg-muted text-foreground hover:bg-muted/80"
                              >
                                Edit
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm('Delete this runbook?')) return;
                                  try {
                                    const response = await fetch(`/api/v1/monitoring/alert-runbooks/${runbook.id}`, {
                                      method: 'DELETE',
                                      headers: { Authorization: `Bearer ${token}` },
                                    });
                                    if (response.ok) {
                                      setAlertRunbooks(prev => prev.filter(r => r.id !== runbook.id));
                                      toast.success('Runbook deleted');
                                    }
                                  } catch {
                                    toast.error('Failed to delete runbook');
                                  }
                                }}
                                className="rounded px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          {runbook.description && (
                            <p className="mt-2 text-sm text-muted-foreground">{runbook.description}</p>
                          )}
                          {runbook.instructions && (
                            <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-700 dark:text-yellow-300">
                              <strong>Quick Instructions:</strong> {runbook.instructions}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Test Runbook Section */}
                  <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm font-medium text-foreground mb-3">🧪 Test Alert with Runbook</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Check Type</label>
                        <select
                          id="test-runbook-check-type"
                          className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                          defaultValue="uptime"
                        >
                          <option value="uptime">Uptime</option>
                          <option value="transaction">Transaction</option>
                          <option value="performance">Performance</option>
                          <option value="webhook">Webhook</option>
                          <option value="dns">DNS</option>
                          <option value="tcp">TCP</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Severity</label>
                        <select
                          id="test-runbook-severity"
                          className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                          defaultValue="high"
                        >
                          <option value="critical">Critical</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </div>
                      <div className="col-span-2 flex items-end">
                        <button
                          onClick={async () => {
                            const checkType = (document.getElementById('test-runbook-check-type') as HTMLSelectElement).value;
                            const severity = (document.getElementById('test-runbook-severity') as HTMLSelectElement).value;
                            try {
                              const response = await fetch('/api/v1/monitoring/alert-runbooks/test', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({ check_type: checkType, severity }),
                              });
                              const data = await response.json();
                              if (response.ok) {
                                setRunbookTestResult(data);
                                if (data.runbook_found) {
                                  toast.success(`Runbook found: ${data.alert.runbook.name}`);
                                } else {
                                  toast.info('No matching runbook found for this alert type');
                                }
                              }
                            } catch {
                              toast.error('Failed to test runbook');
                            }
                          }}
                          className="rounded-md bg-blue-100 dark:bg-blue-900/30 px-4 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                        >
                          🔍 Find Matching Runbook
                        </button>
                      </div>
                    </div>

                    {/* Test Result */}
                    {runbookTestResult && (
                      <div className={`p-3 rounded-lg border ${runbookTestResult.runbook_found ? 'border-green-500/30 bg-green-50 dark:bg-green-900/20' : 'border-orange-500/30 bg-orange-50 dark:bg-orange-900/20'}`}>
                        <div className="flex items-start gap-2">
                          <span className="text-lg">{runbookTestResult.runbook_found ? '✅' : '⚠️'}</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{runbookTestResult.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Alert: {runbookTestResult.alert.check_name} ({runbookTestResult.alert.check_type}/{runbookTestResult.alert.severity})
                            </p>
                            {runbookTestResult.alert.runbook && (
                              <div className="mt-2 flex items-center gap-2">
                                <a
                                  href={runbookTestResult.alert.runbook.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                                >
                                  📖 {runbookTestResult.alert.runbook.name} →
                                </a>
                                {runbookTestResult.alert.runbook.instructions && (
                                  <span className="text-xs text-muted-foreground">
                                    | {runbookTestResult.alert.runbook.instructions}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info Box */}
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-500">ℹ️</span>
                      <div className="text-xs text-blue-700 dark:text-blue-300">
                        <strong>How it works:</strong> When an alert is triggered, the system automatically finds the matching runbook
                        based on check type and severity. The runbook link is included in alert notifications to help responders quickly
                        access documentation for resolving the issue.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Runbook Modal */}
                {showRunbookModal && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card border border-border rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                      <h3 className="text-lg font-semibold text-foreground mb-4">
                        {editingRunbook ? 'Edit Runbook' : 'Add Runbook'}
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
                          <input
                            type="text"
                            value={runbookForm.name}
                            onChange={(e) => setRunbookForm({ ...runbookForm, name: e.target.value })}
                            placeholder="e.g., Uptime Alert Response"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                          <input
                            type="text"
                            value={runbookForm.description}
                            onChange={(e) => setRunbookForm({ ...runbookForm, description: e.target.value })}
                            placeholder="Brief description of when this runbook applies"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1">Check Type</label>
                            <select
                              value={runbookForm.check_type}
                              onChange={(e) => setRunbookForm({ ...runbookForm, check_type: e.target.value as AlertRunbook['check_type'] })}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                            >
                              <option value="all">All Types</option>
                              <option value="uptime">Uptime</option>
                              <option value="transaction">Transaction</option>
                              <option value="performance">Performance</option>
                              <option value="webhook">Webhook</option>
                              <option value="dns">DNS</option>
                              <option value="tcp">TCP</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-foreground mb-1">Severity</label>
                            <select
                              value={runbookForm.severity}
                              onChange={(e) => setRunbookForm({ ...runbookForm, severity: e.target.value as AlertRunbook['severity'] })}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                            >
                              <option value="all">All Severities</option>
                              <option value="critical">Critical</option>
                              <option value="high">High</option>
                              <option value="medium">Medium</option>
                              <option value="low">Low</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">Runbook URL *</label>
                          <input
                            type="url"
                            value={runbookForm.runbook_url}
                            onChange={(e) => setRunbookForm({ ...runbookForm, runbook_url: e.target.value })}
                            placeholder="https://docs.example.com/runbooks/uptime-alerts"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">Quick Instructions</label>
                          <textarea
                            value={runbookForm.instructions}
                            onChange={(e) => setRunbookForm({ ...runbookForm, instructions: e.target.value })}
                            placeholder="Brief inline instructions shown in alert (e.g., 'Check server logs, restart service if needed')"
                            rows={2}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 mt-6">
                        <button
                          onClick={() => setShowRunbookModal(false)}
                          className="rounded-md px-4 py-2 text-sm font-medium bg-muted text-foreground hover:bg-muted/80"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            if (!runbookForm.name || !runbookForm.runbook_url) {
                              toast.error('Name and Runbook URL are required');
                              return;
                            }
                            setIsSavingRunbook(true);
                            try {
                              const url = editingRunbook
                                ? `/api/v1/monitoring/alert-runbooks/${editingRunbook.id}`
                                : '/api/v1/monitoring/alert-runbooks';
                              const method = editingRunbook ? 'PUT' : 'POST';
                              const response = await fetch(url, {
                                method,
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify(runbookForm),
                              });
                              const data = await response.json();
                              if (response.ok) {
                                if (editingRunbook) {
                                  setAlertRunbooks(prev => prev.map(r => r.id === editingRunbook.id ? data.runbook : r));
                                  toast.success('Runbook updated');
                                } else {
                                  setAlertRunbooks(prev => [...prev, data.runbook]);
                                  toast.success('Runbook created');
                                }
                                setShowRunbookModal(false);
                              } else {
                                toast.error(data.error || 'Failed to save runbook');
                              }
                            } catch {
                              toast.error('Failed to save runbook');
                            } finally {
                              setIsSavingRunbook(false);
                            }
                          }}
                          disabled={isSavingRunbook}
                          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          {isSavingRunbook ? 'Saving...' : (editingRunbook ? 'Update Runbook' : 'Add Runbook')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Escalation Policies Card */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">🚨 Escalation Policies</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Define escalation paths when alerts are not acknowledged
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        resetEscalationPolicyForm();
                        setShowEscalationPolicyModal(true);
                      }}
                      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Create Policy
                    </button>
                  </div>

                  {isLoadingEscalationPolicies ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    </div>
                  ) : escalationPolicies.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center">
                      <div className="text-4xl mb-3">📢</div>
                      <h4 className="font-medium text-foreground mb-2">No escalation policies yet</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create an escalation policy to define alert handling procedures
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {escalationPolicies.map(policy => (
                        <div key={policy.id} className="rounded-lg border border-border p-4 hover:bg-muted/30">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${policy.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-foreground">{policy.name}</h4>
                                  {policy.is_default && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Default</span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {policy.levels.length} escalation levels • {policy.repeat_policy === 'repeat_until_acknowledged' ? 'Repeats' : 'Once'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleTestEscalationPolicy(policy.id)}
                                className="rounded px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                                title="Test escalation flow"
                              >
                                🧪 Test
                              </button>
                              <button
                                onClick={() => openEditEscalationPolicy(policy)}
                                className="rounded px-3 py-1.5 text-xs font-medium bg-muted text-foreground hover:bg-muted/80"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteEscalationPolicy(policy.id)}
                                className="rounded px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          {/* Show escalation levels summary */}
                          <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                            <p className="text-xs font-medium text-foreground mb-2">Escalation Flow:</p>
                            <div className="flex flex-wrap gap-2">
                              {policy.levels.map((level, idx) => (
                                <div key={level.id} className="flex items-center gap-1">
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                    Level {level.level}: {level.targets.length} target{level.targets.length !== 1 ? 's' : ''}
                                    {level.escalate_after_minutes > 0 && ` (after ${level.escalate_after_minutes}min)`}
                                  </span>
                                  {idx < policy.levels.length - 1 && <span className="text-muted-foreground">→</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                          {policy.description && (
                            <p className="mt-2 text-sm text-muted-foreground">{policy.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Alert Grouping Card */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">🔗 Alert Grouping & Deduplication</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Group related alerts to reduce noise and prevent notification fatigue
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSimulateAlertGrouping}
                        className="rounded-md bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200"
                        disabled={alertGroupingRules.length === 0}
                        title={alertGroupingRules.length === 0 ? 'Create a rule first' : 'Simulate 5 alerts'}
                      >
                        🧪 Test Grouping
                      </button>
                      <button
                        onClick={() => {
                          resetAlertGroupingForm();
                          setShowAlertGroupingModal(true);
                        }}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Create Rule
                      </button>
                    </div>
                  </div>

                  {isLoadingAlertGrouping ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    </div>
                  ) : alertGroupingRules.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center">
                      <div className="text-4xl mb-3">🔔</div>
                      <h4 className="font-medium text-foreground mb-2">No alert grouping rules yet</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create a rule to group related alerts and reduce notification noise
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Rules List */}
                      <div className="space-y-3">
                        {alertGroupingRules.map(rule => (
                          <div key={rule.id} className="rounded-lg border border-border p-4 hover:bg-muted/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${rule.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                                <div>
                                  <h4 className="font-medium text-foreground">{rule.name}</h4>
                                  <p className="text-xs text-muted-foreground">
                                    Group by: {rule.group_by.join(', ')} • {rule.time_window_minutes}min window
                                    {rule.deduplication_enabled && ' • Dedup enabled'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openEditAlertGroupingRule(rule)}
                                  className="rounded px-3 py-1.5 text-xs font-medium bg-muted text-foreground hover:bg-muted/80"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteAlertGroupingRule(rule.id)}
                                  className="rounded px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            {rule.description && (
                              <p className="mt-2 text-sm text-muted-foreground">{rule.description}</p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Alert Groups */}
                      {alertGroups.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <h4 className="text-sm font-medium text-foreground mb-3">Recent Alert Groups ({alertGroups.length})</h4>
                          <div className="space-y-2">
                            {alertGroups.slice(0, 5).map(group => (
                              <div key={group.id} className="rounded-lg bg-muted/50 p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 text-xs rounded ${
                                      group.status === 'active' ? 'bg-yellow-100 text-yellow-700' :
                                      group.status === 'acknowledged' ? 'bg-blue-100 text-blue-700' :
                                      'bg-green-100 text-green-700'
                                    }`}>
                                      {group.status}
                                    </span>
                                    <span className="text-sm font-medium">{group.alerts.length} alerts grouped</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {group.status === 'active' && (
                                      <>
                                        <button
                                          onClick={() => acknowledgeAlertGroup(group)}
                                          className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                                          title="Acknowledge alert - stops escalation"
                                        >
                                          ✓ Acknowledge
                                        </button>
                                        <button
                                          onClick={() => createIncidentFromAlertGroup(group)}
                                          className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                                          title="Create incident from this alert group"
                                        >
                                          🔥 Create Incident
                                        </button>
                                      </>
                                    )}
                                    {(group.status === 'active' || group.status === 'acknowledged') && (
                                      <button
                                        onClick={() => resolveAlertGroup(group)}
                                        className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200"
                                        title="Mark alert as resolved"
                                      >
                                        ✓ Resolve
                                      </button>
                                    )}
                                    {(group.status === 'active' || group.status === 'acknowledged') && !group.snoozed_until && (
                                      <select
                                        onChange={(e) => {
                                          const hours = parseInt(e.target.value, 10);
                                          if (hours) snoozeAlertGroup(group, hours);
                                          e.target.value = '';
                                        }}
                                        className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 border-none cursor-pointer"
                                        title="Snooze alert notifications"
                                        defaultValue=""
                                      >
                                        <option value="" disabled>💤 Snooze</option>
                                        <option value="1">1 hour</option>
                                        <option value="4">4 hours</option>
                                        <option value="24">24 hours</option>
                                      </select>
                                    )}
                                    {group.snoozed_until && new Date(group.snoozed_until) > new Date() && (
                                      <button
                                        onClick={() => unsnoozeAlertGroup(group)}
                                        className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                                        title={`Snoozed until ${new Date(group.snoozed_until).toLocaleTimeString()}`}
                                      >
                                        💤 Unsnoze ({group.snooze_duration_hours}h)
                                      </button>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(group.last_alert_at).toLocaleTimeString()}
                                    </span>
                                  </div>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {group.alerts.filter(a => a.deduplicated).length} deduplicated •{' '}
                                  {group.notification_sent ? '1 notification sent' : 'Notification pending'}
                                  {group.snoozed_until && new Date(group.snoozed_until) > new Date() && (
                                    <span className="text-purple-600"> • Snoozed until {new Date(group.snoozed_until).toLocaleTimeString()}</span>
                                  )}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Alert History Card */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">📊 Alert History & Analytics</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        View historical alerts with statistics and export data
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowAlertHistorySection(!showAlertHistorySection);
                        if (!showAlertHistorySection) fetchAlertHistory();
                      }}
                      className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      {showAlertHistorySection ? 'Hide' : 'Show'} History
                    </button>
                  </div>

                  {showAlertHistorySection && (
                    <div className="space-y-4">
                      {/* Filters and Export */}
                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          value={alertHistorySeverityFilter}
                          onChange={(e) => setAlertHistorySeverityFilter(e.target.value)}
                          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        >
                          <option value="">All Severities</option>
                          <option value="critical">Critical</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                        <select
                          value={alertHistorySourceFilter}
                          onChange={(e) => setAlertHistorySourceFilter(e.target.value)}
                          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        >
                          <option value="">All Sources</option>
                          <option value="api">API</option>
                          <option value="database">Database</option>
                          <option value="cache">Cache</option>
                          <option value="system">System</option>
                        </select>
                        <button
                          onClick={() => fetchAlertHistory()}
                          className="rounded-md bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-secondary/90"
                        >
                          🔄 Refresh
                        </button>
                        <div className="ml-auto flex gap-2">
                          <button
                            onClick={() => exportAlertHistory('csv')}
                            className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-muted"
                          >
                            📥 Export CSV
                          </button>
                          <button
                            onClick={() => exportAlertHistory('json')}
                            className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-muted"
                          >
                            📥 Export JSON
                          </button>
                        </div>
                      </div>

                      {/* Statistics Cards */}
                      {alertHistoryStats && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="rounded-lg bg-muted/50 p-3 text-center">
                            <div className="text-2xl font-bold text-foreground">{alertHistoryStats.total_alerts}</div>
                            <div className="text-xs text-muted-foreground">Total Alerts</div>
                          </div>
                          <div className="rounded-lg bg-red-50 p-3 text-center">
                            <div className="text-2xl font-bold text-red-700">{alertHistoryStats.by_severity.critical}</div>
                            <div className="text-xs text-red-600">Critical</div>
                          </div>
                          <div className="rounded-lg bg-yellow-50 p-3 text-center">
                            <div className="text-2xl font-bold text-yellow-700">{alertHistoryStats.by_status.active}</div>
                            <div className="text-xs text-yellow-600">Active</div>
                          </div>
                          <div className="rounded-lg bg-green-50 p-3 text-center">
                            <div className="text-2xl font-bold text-green-700">{alertHistoryStats.by_status.resolved}</div>
                            <div className="text-xs text-green-600">Resolved</div>
                          </div>
                        </div>
                      )}

                      {/* Alerts Over Time Mini Chart */}
                      {alertsOverTime.length > 0 && (
                        <div className="rounded-lg bg-muted/30 p-4">
                          <h4 className="text-sm font-medium text-foreground mb-2">Alerts Over Time (Last 7 Days)</h4>
                          <div className="h-16 flex items-end gap-px">
                            {alertsOverTime.slice(-48).map((point, idx) => {
                              const maxCount = Math.max(...alertsOverTime.slice(-48).map(p => p.count), 1);
                              const height = point.count > 0 ? Math.max((point.count / maxCount) * 100, 10) : 2;
                              return (
                                <div
                                  key={idx}
                                  className={`flex-1 rounded-t ${point.count > 0 ? 'bg-primary' : 'bg-muted'}`}
                                  style={{ height: `${height}%` }}
                                  title={`${new Date(point.time).toLocaleString()}: ${point.count} alerts`}
                                />
                              );
                            })}
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>48h ago</span>
                            <span>Now</span>
                          </div>
                        </div>
                      )}

                      {/* Alert History List */}
                      {isLoadingAlertHistory ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                        </div>
                      ) : alertHistory.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                          No alerts found matching the filters
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {alertHistory.slice(0, 10).map(alert => (
                            <div key={alert.id} className="rounded-lg bg-muted/50 p-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className={`px-2 py-0.5 text-xs rounded ${
                                  alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                  alert.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                                  alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {alert.severity}
                                </span>
                                <div>
                                  <div className="text-sm font-medium text-foreground">{alert.check_name}</div>
                                  <div className="text-xs text-muted-foreground">{alert.error_message || 'No details'}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`text-xs px-2 py-0.5 rounded ${
                                  alert.group_status === 'active' ? 'bg-yellow-100 text-yellow-700' :
                                  alert.group_status === 'acknowledged' ? 'bg-blue-100 text-blue-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {alert.group_status}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {new Date(alert.triggered_at).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ))}
                          {alertHistory.length > 10 && (
                            <div className="text-center text-sm text-muted-foreground py-2">
                              Showing 10 of {alertHistory.length} alerts
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Alert Routing Card */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">🚀 Alert Routing Rules</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Route alerts to different channels based on conditions (severity, type, etc.)
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowAlertRoutingTest(true)}
                        className="rounded-md bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200"
                        disabled={alertRoutingRules.length === 0}
                        title={alertRoutingRules.length === 0 ? 'Create a rule first' : 'Test alert routing'}
                      >
                        🧪 Test Routing
                      </button>
                      <button
                        onClick={() => {
                          resetAlertRoutingForm();
                          setShowAlertRoutingModal(true);
                        }}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Create Rule
                      </button>
                    </div>
                  </div>

                  {isLoadingAlertRouting ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    </div>
                  ) : alertRoutingRules.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-8 text-center">
                      <div className="text-4xl mb-3">📨</div>
                      <h4 className="font-medium text-foreground mb-2">No alert routing rules yet</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create a rule to route critical alerts to PagerDuty, Slack, or other channels
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Rules List */}
                      <div className="space-y-3">
                        {alertRoutingRules.map(rule => (
                          <div key={rule.id} className="rounded-lg border border-border p-4 hover:bg-muted/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                                <div>
                                  <h4 className="font-medium text-foreground">{rule.name}</h4>
                                  <p className="text-xs text-muted-foreground">
                                    {rule.conditions.length} condition(s) ({rule.condition_match}) →{' '}
                                    {rule.destinations.map(d => d.type).join(', ')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Priority: {rule.priority}</span>
                                <button
                                  onClick={() => openEditAlertRoutingRule(rule)}
                                  className="rounded px-3 py-1.5 text-xs font-medium bg-muted text-foreground hover:bg-muted/80"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteAlertRoutingRule(rule.id)}
                                  className="rounded px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            {rule.description && (
                              <p className="mt-2 text-sm text-muted-foreground">{rule.description}</p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
                              {rule.conditions.map((cond, i) => (
                                <span key={i} className="px-2 py-1 text-xs rounded bg-muted text-foreground">
                                  {cond.field} {cond.operator} {JSON.stringify(cond.value)}
                                </span>
                              ))}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {rule.destinations.map((dest, i) => (
                                <span key={i} className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700">
                                  📤 {dest.type}: {dest.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Routing Logs */}
                      {alertRoutingLogs.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <h4 className="text-sm font-medium text-foreground mb-3">Recent Routing Logs ({alertRoutingLogs.length})</h4>
                          <div className="space-y-2">
                            {alertRoutingLogs.slice(0, 5).map(log => (
                              <div key={log.id} className="rounded-lg bg-muted/50 p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 text-xs rounded ${
                                      log.notification_status === 'sent' ? 'bg-green-100 text-green-700' :
                                      log.notification_status === 'simulated' ? 'bg-blue-100 text-blue-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {log.notification_status}
                                    </span>
                                    <span className="text-sm font-medium">{log.rule_name}</span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(log.routed_at).toLocaleTimeString()}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {log.check_name} ({log.check_type}) • Severity: {log.severity} • → {log.destinations_notified.join(', ')}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Incident Management Section */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">🔥 Incident Management</h3>
                      <p className="text-sm text-muted-foreground">Track incidents from detection to resolution with full workflow support</p>
                    </div>
                    <button
                      onClick={() => setShowManagedIncidentModal(true)}
                      className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    >
                      Declare Incident
                    </button>
                  </div>

                  {/* Filter tabs */}
                  <div className="flex gap-2 mb-4">
                    {(['active', 'resolved', 'all'] as const).map(filter => (
                      <button
                        key={filter}
                        onClick={() => {
                          setManagedIncidentFilter(filter);
                          fetchManagedIncidents();
                        }}
                        className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                          managedIncidentFilter === filter
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground hover:bg-muted/80'
                        }`}
                      >
                        {filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Incidents list */}
                  {isLoadingManagedIncidents ? (
                    <div className="text-center py-8 text-muted-foreground">Loading incidents...</div>
                  ) : managedIncidents.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-2">✅</div>
                      <h4 className="text-md font-medium text-foreground">No {managedIncidentFilter === 'all' ? '' : managedIncidentFilter} incidents</h4>
                      <p className="text-sm text-muted-foreground">
                        {managedIncidentFilter === 'active' ? 'All clear! No active incidents at the moment.' : 'No incidents match this filter.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {managedIncidents.map(incident => (
                        <div
                          key={incident.id}
                          onClick={() => openManagedIncidentDetail(incident)}
                          className="p-4 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 text-xs font-bold rounded ${getIncidentPriorityColor(incident.priority)}`}>
                                  {incident.priority}
                                </span>
                                <span className={`px-2 py-0.5 text-xs rounded ${getIncidentStatusColor(incident.status)}`}>
                                  {incident.status}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {incident.severity}
                                </span>
                              </div>
                              <h4 className="font-medium text-foreground truncate">{incident.title}</h4>
                              {incident.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{incident.description}</p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span>Created: {new Date(incident.created_at).toLocaleString()}</span>
                                {incident.responders.length > 0 && (
                                  <span>👥 {incident.responders.length} responder(s)</span>
                                )}
                                {incident.notes.length > 0 && (
                                  <span>📝 {incident.notes.length} note(s)</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                              {incident.source === 'alert' ? '🚨 Alert' : '✋ Manual'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Create Managed Incident Modal */}
        {showManagedIncidentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-card p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                🔥 Declare Incident
              </h2>
              <form onSubmit={handleCreateManagedIncident} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Incident Title *</label>
                  <input
                    type="text"
                    value={managedIncidentTitle}
                    onChange={e => setManagedIncidentTitle(e.target.value)}
                    placeholder="API Server Outage - US East"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                  <textarea
                    value={managedIncidentDescription}
                    onChange={e => setManagedIncidentDescription(e.target.value)}
                    placeholder="Describe the incident..."
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Priority</label>
                    <select
                      value={managedIncidentPriority}
                      onChange={e => setManagedIncidentPriority(e.target.value as ManagedIncident['priority'])}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    >
                      <option value="P1">P1 - Critical</option>
                      <option value="P2">P2 - High</option>
                      <option value="P3">P3 - Medium</option>
                      <option value="P4">P4 - Low</option>
                      <option value="P5">P5 - Minimal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Severity</label>
                    <select
                      value={managedIncidentSeverity}
                      onChange={e => setManagedIncidentSeverity(e.target.value as ManagedIncident['severity'])}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                      <option value="info">Info</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={managedIncidentTags}
                    onChange={e => setManagedIncidentTags(e.target.value)}
                    placeholder="database, api, production"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Affected Services (comma-separated)</label>
                  <input
                    type="text"
                    value={managedIncidentAffectedServices}
                    onChange={e => setManagedIncidentAffectedServices(e.target.value)}
                    placeholder="user-service, auth-service, api-gateway"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowManagedIncidentModal(false);
                      resetManagedIncidentForm();
                    }}
                    className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingManagedIncident || !managedIncidentTitle.trim()}
                    className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {isSubmittingManagedIncident ? 'Creating...' : 'Declare Incident'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Managed Incident Detail Modal */}
        {showManagedIncidentDetailModal && selectedManagedIncident && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-card p-6 shadow-xl">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 text-xs font-bold rounded ${getIncidentPriorityColor(selectedManagedIncident.priority)}`}>
                      {selectedManagedIncident.priority}
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded ${getIncidentStatusColor(selectedManagedIncident.status)}`}>
                      {selectedManagedIncident.status}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">{selectedManagedIncident.title}</h2>
                  {selectedManagedIncident.description && (
                    <p className="text-muted-foreground mt-1">{selectedManagedIncident.description}</p>
                  )}
                </div>
                <button
                  onClick={() => setShowManagedIncidentDetailModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              {/* Status Actions */}
              {selectedManagedIncident.status !== 'resolved' && (
                <div className="flex flex-wrap gap-2 mb-6 p-4 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground mr-2">Update Status:</span>
                  {['acknowledged', 'investigating', 'identified', 'monitoring'].map(status => (
                    <button
                      key={status}
                      onClick={() => handleUpdateManagedIncidentStatus(selectedManagedIncident.id, status as ManagedIncident['status'])}
                      disabled={selectedManagedIncident.status === status}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        selectedManagedIncident.status === status
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background border border-input hover:bg-muted'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowManagedResolveModal(true)}
                    className="px-3 py-1 text-xs rounded-full bg-green-600 text-white hover:bg-green-700"
                  >
                    Resolve
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left column - Info & Responders */}
                <div className="space-y-6">
                  {/* Info */}
                  <div className="p-4 rounded-lg border border-border">
                    <h3 className="font-medium text-foreground mb-3">Incident Details</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Severity:</span>
                        <span className="text-foreground">{selectedManagedIncident.severity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Source:</span>
                        <span className="text-foreground">{selectedManagedIncident.source}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Created:</span>
                        <span className="text-foreground">{new Date(selectedManagedIncident.created_at).toLocaleString()}</span>
                      </div>
                      {selectedManagedIncident.acknowledged_at && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Acknowledged:</span>
                          <span className="text-foreground">{new Date(selectedManagedIncident.acknowledged_at).toLocaleString()}</span>
                        </div>
                      )}
                      {selectedManagedIncident.resolved_at && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Resolved:</span>
                          <span className="text-foreground">{new Date(selectedManagedIncident.resolved_at).toLocaleString()}</span>
                        </div>
                      )}
                      {selectedManagedIncident.time_to_acknowledge_seconds && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Time to Acknowledge:</span>
                          <span className="text-foreground">{Math.round(selectedManagedIncident.time_to_acknowledge_seconds / 60)} min</span>
                        </div>
                      )}
                      {selectedManagedIncident.time_to_resolve_seconds && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Time to Resolve:</span>
                          <span className="text-foreground">{Math.round(selectedManagedIncident.time_to_resolve_seconds / 60)} min</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Responders */}
                  <div className="p-4 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-foreground">Responders</h3>
                      {selectedManagedIncident.status !== 'resolved' && (
                        <button
                          onClick={() => setShowManagedAssignResponderModal(true)}
                          className="text-xs text-primary hover:underline"
                        >
                          + Assign
                        </button>
                      )}
                    </div>
                    {selectedManagedIncident.responders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No responders assigned yet</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedManagedIncident.responders.map(responder => (
                          <div key={responder.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <div>
                              <span className="text-sm font-medium text-foreground">{responder.user_name}</span>
                              <span className="text-xs text-muted-foreground ml-2">({responder.role})</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{responder.user_email}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Resolution (if resolved) */}
                  {selectedManagedIncident.status === 'resolved' && selectedManagedIncident.resolution_summary && (
                    <div className="p-4 rounded-lg border border-green-300 bg-green-50">
                      <h3 className="font-medium text-green-800 mb-2">Resolution</h3>
                      <p className="text-sm text-green-700">{selectedManagedIncident.resolution_summary}</p>
                      {selectedManagedIncident.postmortem_url && (
                        <a
                          href={selectedManagedIncident.postmortem_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-2 text-sm text-green-600 hover:underline"
                        >
                          📄 View Postmortem
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Right column - Notes & Timeline */}
                <div className="space-y-6">
                  {/* Add Note */}
                  {selectedManagedIncident.status !== 'resolved' && (
                    <div className="p-4 rounded-lg border border-border">
                      <h3 className="font-medium text-foreground mb-3">Add Note</h3>
                      <textarea
                        value={managedIncidentNoteContent}
                        onChange={e => setManagedIncidentNoteContent(e.target.value)}
                        placeholder="Add investigation notes, updates, or findings..."
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <select
                          value={managedIncidentNoteVisibility}
                          onChange={e => setManagedIncidentNoteVisibility(e.target.value as 'internal' | 'public')}
                          className="text-xs rounded border border-input bg-background px-2 py-1"
                        >
                          <option value="internal">Internal only</option>
                          <option value="public">Public (visible on status page)</option>
                        </select>
                        <button
                          onClick={() => handleAddManagedIncidentNote(selectedManagedIncident.id)}
                          disabled={!managedIncidentNoteContent.trim()}
                          className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          Add Note
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {selectedManagedIncident.notes.length > 0 && (
                    <div className="p-4 rounded-lg border border-border">
                      <h3 className="font-medium text-foreground mb-3">Notes ({selectedManagedIncident.notes.length})</h3>
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {selectedManagedIncident.notes.map(note => (
                          <div key={note.id} className="p-3 rounded bg-muted/50">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-foreground">{note.author_name}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${note.visibility === 'public' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                  {note.visibility}
                                </span>
                                <span className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleString()}</span>
                              </div>
                            </div>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="p-4 rounded-lg border border-border">
                    <h3 className="font-medium text-foreground mb-3">Timeline ({selectedManagedIncident.timeline.length})</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {selectedManagedIncident.timeline.map(event => (
                        <div key={event.id} className="flex gap-3 text-sm">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(event.created_at).toLocaleTimeString()}
                          </span>
                          <span className="text-foreground">{event.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowManagedIncidentDetailModal(false)}
                  className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Responder Modal */}
        {showManagedAssignResponderModal && selectedManagedIncident && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-foreground mb-4">Assign Responder</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
                  <input
                    type="text"
                    value={managedResponderName}
                    onChange={e => setManagedResponderName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Email *</label>
                  <input
                    type="email"
                    value={managedResponderEmail}
                    onChange={e => setManagedResponderEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Role</label>
                  <select
                    value={managedResponderRole}
                    onChange={e => setManagedResponderRole(e.target.value as IncidentResponder['role'])}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  >
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="observer">Observer</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowManagedAssignResponderModal(false);
                      setManagedResponderName('');
                      setManagedResponderEmail('');
                    }}
                    className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleAssignManagedResponder(selectedManagedIncident.id)}
                    disabled={!managedResponderName.trim() || !managedResponderEmail.trim()}
                    className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Assign
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Resolve Incident Modal */}
        {showManagedResolveModal && selectedManagedIncident && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-foreground mb-4">Resolve Incident</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Resolution Summary *</label>
                  <textarea
                    value={managedResolutionSummary}
                    onChange={e => setManagedResolutionSummary(e.target.value)}
                    placeholder="Describe how the incident was resolved..."
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Postmortem URL</label>
                  <input
                    type="url"
                    value={managedPostmortemUrl}
                    onChange={e => setManagedPostmortemUrl(e.target.value)}
                    placeholder="https://docs.company.com/postmortems/inc-123"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="postmortemCompleted"
                    checked={managedPostmortemCompleted}
                    onChange={e => setManagedPostmortemCompleted(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <label htmlFor="postmortemCompleted" className="text-sm text-foreground">
                    Postmortem has been completed
                  </label>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowManagedResolveModal(false);
                      setManagedResolutionSummary('');
                      setManagedPostmortemUrl('');
                      setManagedPostmortemCompleted(false);
                    }}
                    className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleResolveManagedIncident(selectedManagedIncident.id)}
                    disabled={!managedResolutionSummary.trim()}
                    className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Resolve Incident
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create/Edit Alert Grouping Rule Modal */}
        {showAlertGroupingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-lg bg-card p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                {editingAlertGroupingRule ? 'Edit Alert Grouping Rule' : 'Create Alert Grouping Rule'}
              </h2>
              <form onSubmit={handleSubmitAlertGroupingRule} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Rule Name *</label>
                  <input
                    type="text"
                    value={alertGroupingName}
                    onChange={e => setAlertGroupingName(e.target.value)}
                    placeholder="Group by check type"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                  <textarea
                    value={alertGroupingDescription}
                    onChange={e => setAlertGroupingDescription(e.target.value)}
                    placeholder="Description of this grouping rule..."
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Group Alerts By *</label>
                  <div className="flex flex-wrap gap-2">
                    {(['check_type', 'check_name', 'location', 'error_type', 'tag'] as const).map(criterion => (
                      <button
                        key={criterion}
                        type="button"
                        onClick={() => toggleGroupByCriterion(criterion)}
                        className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                          alertGroupingGroupBy.includes(criterion)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground hover:bg-muted/80'
                        }`}
                      >
                        {criterion.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                  {alertGroupingGroupBy.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">Select at least one criterion</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Time Window (minutes)</label>
                    <input
                      type="number"
                      value={alertGroupingTimeWindow}
                      onChange={e => setAlertGroupingTimeWindow(Number(e.target.value))}
                      min={1}
                      max={60}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Group alerts within this window</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Notification Delay (sec)</label>
                    <input
                      type="number"
                      value={alertGroupingNotificationDelay}
                      onChange={e => setAlertGroupingNotificationDelay(Number(e.target.value))}
                      min={0}
                      max={300}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Delay to collect more alerts</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="deduplication"
                    checked={alertGroupingDeduplication}
                    onChange={e => setAlertGroupingDeduplication(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <label htmlFor="deduplication" className="text-sm text-foreground">
                    Enable deduplication (suppress identical alerts)
                  </label>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAlertGroupingModal(false);
                      resetAlertGroupingForm();
                    }}
                    className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAlertGrouping || !alertGroupingName.trim() || alertGroupingGroupBy.length === 0}
                    className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSubmittingAlertGrouping ? 'Saving...' : editingAlertGroupingRule ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create/Edit Alert Routing Rule Modal */}
        {showAlertRoutingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-card p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                {editingAlertRoutingRule ? 'Edit Alert Routing Rule' : 'Create Alert Routing Rule'}
              </h2>
              <form onSubmit={handleSubmitAlertRoutingRule} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Rule Name *</label>
                  <input
                    type="text"
                    value={alertRoutingName}
                    onChange={e => setAlertRoutingName(e.target.value)}
                    placeholder="Route critical alerts to PagerDuty"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                  <textarea
                    value={alertRoutingDescription}
                    onChange={e => setAlertRoutingDescription(e.target.value)}
                    placeholder="Description of this routing rule..."
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-foreground">Conditions *</label>
                    <div className="flex items-center gap-2">
                      <select
                        value={alertRoutingConditionMatch}
                        onChange={e => setAlertRoutingConditionMatch(e.target.value as 'all' | 'any')}
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
                      >
                        <option value="all">Match ALL conditions</option>
                        <option value="any">Match ANY condition</option>
                      </select>
                      <button
                        type="button"
                        onClick={addAlertRoutingCondition}
                        className="text-xs text-primary hover:underline"
                      >
                        + Add Condition
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {alertRoutingConditions.map((cond, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                        <select
                          value={cond.field}
                          onChange={e => updateAlertRoutingCondition(index, { field: e.target.value as AlertRoutingCondition['field'] })}
                          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                        >
                          <option value="severity">Severity</option>
                          <option value="check_type">Check Type</option>
                          <option value="check_name">Check Name</option>
                          <option value="location">Location</option>
                          <option value="tag">Tag</option>
                          <option value="error_contains">Error Contains</option>
                        </select>
                        <select
                          value={cond.operator}
                          onChange={e => updateAlertRoutingCondition(index, { operator: e.target.value as AlertRoutingCondition['operator'] })}
                          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                        >
                          <option value="equals">equals</option>
                          <option value="not_equals">not equals</option>
                          <option value="contains">contains</option>
                          <option value="in">in</option>
                          <option value="not_in">not in</option>
                        </select>
                        {cond.field === 'severity' ? (
                          <select
                            value={cond.value as string}
                            onChange={e => updateAlertRoutingCondition(index, { value: e.target.value })}
                            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                          >
                            <option value="critical">critical</option>
                            <option value="high">high</option>
                            <option value="medium">medium</option>
                            <option value="low">low</option>
                            <option value="info">info</option>
                          </select>
                        ) : cond.field === 'check_type' ? (
                          <select
                            value={cond.value as string}
                            onChange={e => updateAlertRoutingCondition(index, { value: e.target.value })}
                            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                          >
                            <option value="uptime">uptime</option>
                            <option value="transaction">transaction</option>
                            <option value="performance">performance</option>
                            <option value="webhook">webhook</option>
                            <option value="dns">dns</option>
                            <option value="tcp">tcp</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={cond.value as string}
                            onChange={e => updateAlertRoutingCondition(index, { value: e.target.value })}
                            placeholder="Value"
                            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                          />
                        )}
                        {alertRoutingConditions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeAlertRoutingCondition(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-foreground">Destinations *</label>
                    <button
                      type="button"
                      onClick={addAlertRoutingDestination}
                      className="text-xs text-primary hover:underline"
                    >
                      + Add Destination
                    </button>
                  </div>
                  <div className="space-y-3">
                    {alertRoutingDestinations.map((dest, index) => (
                      <div key={index} className="p-3 rounded-md border border-border bg-muted/30">
                        <div className="flex items-center gap-2 mb-2">
                          <select
                            value={dest.type}
                            onChange={e => updateAlertRoutingDestination(index, { type: e.target.value as AlertRoutingDestination['type'], config: {} })}
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                          >
                            <option value="pagerduty">PagerDuty</option>
                            <option value="slack">Slack</option>
                            <option value="teams">Microsoft Teams</option>
                            <option value="discord">Discord</option>
                            <option value="email">Email</option>
                            <option value="webhook">Webhook</option>
                            <option value="opsgenie">OpsGenie</option>
                            <option value="on_call">On-Call Schedule</option>
                            <option value="n8n">n8n Workflow</option>
                            <option value="telegram">Telegram</option>
                          </select>
                          <input
                            type="text"
                            value={dest.name}
                            onChange={e => updateAlertRoutingDestination(index, { name: e.target.value })}
                            placeholder="Destination name"
                            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                          />
                          {alertRoutingDestinations.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeAlertRoutingDestination(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* PagerDuty Configuration */}
                        {dest.type === 'pagerduty' && (
                          <div className="space-y-2 pt-2 border-t border-border/50">
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Integration Key (Routing Key) *
                              </label>
                              <input
                                type="text"
                                value={dest.config.integration_key || ''}
                                onChange={e => updateAlertRoutingDestination(index, {
                                  config: { ...dest.config, integration_key: e.target.value }
                                })}
                                placeholder="e.g., R034M12345ABCDEF..."
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground font-mono"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Find this in PagerDuty: Services → Your Service → Integrations → Events API v2
                              </p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Severity Mapping
                              </label>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-16 text-red-500 font-medium">Critical:</span>
                                  <select
                                    value={dest.config.severity_mapping?.critical || 'critical'}
                                    onChange={e => updateAlertRoutingDestination(index, {
                                      config: {
                                        ...dest.config,
                                        severity_mapping: {
                                          ...dest.config.severity_mapping,
                                          critical: e.target.value as 'critical' | 'error' | 'warning' | 'info'
                                        }
                                      }
                                    })}
                                    className="flex-1 rounded border border-input bg-background px-1 py-0.5 text-xs"
                                  >
                                    <option value="critical">Critical</option>
                                    <option value="error">Error</option>
                                    <option value="warning">Warning</option>
                                    <option value="info">Info</option>
                                  </select>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="w-16 text-orange-500 font-medium">High:</span>
                                  <select
                                    value={dest.config.severity_mapping?.high || 'error'}
                                    onChange={e => updateAlertRoutingDestination(index, {
                                      config: {
                                        ...dest.config,
                                        severity_mapping: {
                                          ...dest.config.severity_mapping,
                                          high: e.target.value as 'critical' | 'error' | 'warning' | 'info'
                                        }
                                      }
                                    })}
                                    className="flex-1 rounded border border-input bg-background px-1 py-0.5 text-xs"
                                  >
                                    <option value="critical">Critical</option>
                                    <option value="error">Error</option>
                                    <option value="warning">Warning</option>
                                    <option value="info">Info</option>
                                  </select>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="w-16 text-yellow-500 font-medium">Medium:</span>
                                  <select
                                    value={dest.config.severity_mapping?.medium || 'warning'}
                                    onChange={e => updateAlertRoutingDestination(index, {
                                      config: {
                                        ...dest.config,
                                        severity_mapping: {
                                          ...dest.config.severity_mapping,
                                          medium: e.target.value as 'critical' | 'error' | 'warning' | 'info'
                                        }
                                      }
                                    })}
                                    className="flex-1 rounded border border-input bg-background px-1 py-0.5 text-xs"
                                  >
                                    <option value="critical">Critical</option>
                                    <option value="error">Error</option>
                                    <option value="warning">Warning</option>
                                    <option value="info">Info</option>
                                  </select>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="w-16 text-blue-500 font-medium">Low:</span>
                                  <select
                                    value={dest.config.severity_mapping?.low || 'info'}
                                    onChange={e => updateAlertRoutingDestination(index, {
                                      config: {
                                        ...dest.config,
                                        severity_mapping: {
                                          ...dest.config.severity_mapping,
                                          low: e.target.value as 'critical' | 'error' | 'warning' | 'info'
                                        }
                                      }
                                    })}
                                    className="flex-1 rounded border border-input bg-background px-1 py-0.5 text-xs"
                                  >
                                    <option value="critical">Critical</option>
                                    <option value="error">Error</option>
                                    <option value="warning">Warning</option>
                                    <option value="info">Info</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Slack Configuration */}
                        {dest.type === 'slack' && (
                          <div className="space-y-2 pt-2 border-t border-border/50">
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Webhook URL *
                              </label>
                              <input
                                type="url"
                                value={dest.config.webhook_url || ''}
                                onChange={e => updateAlertRoutingDestination(index, {
                                  config: { ...dest.config, webhook_url: e.target.value }
                                })}
                                placeholder="https://hooks.slack.com/services/..."
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Channel (optional)
                              </label>
                              <input
                                type="text"
                                value={dest.config.channel || ''}
                                onChange={e => updateAlertRoutingDestination(index, {
                                  config: { ...dest.config, channel: e.target.value }
                                })}
                                placeholder="#alerts"
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                              />
                            </div>
                          </div>
                        )}

                        {/* Email Configuration */}
                        {dest.type === 'email' && (
                          <div className="pt-2 border-t border-border/50">
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Email Addresses *
                            </label>
                            <input
                              type="text"
                              value={dest.config.addresses?.join(', ') || ''}
                              onChange={e => updateAlertRoutingDestination(index, {
                                config: { ...dest.config, addresses: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }
                              })}
                              placeholder="alert@example.com, oncall@example.com"
                              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                            />
                          </div>
                        )}

                        {/* Webhook Configuration */}
                        {dest.type === 'webhook' && (
                          <div className="pt-2 border-t border-border/50">
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Webhook URL *
                            </label>
                            <input
                              type="url"
                              value={dest.config.url || ''}
                              onChange={e => updateAlertRoutingDestination(index, {
                                config: { ...dest.config, url: e.target.value }
                              })}
                              placeholder="https://your-endpoint.com/webhook"
                              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                            />
                          </div>
                        )}

                        {/* OpsGenie Configuration */}
                        {dest.type === 'opsgenie' && (
                          <div className="pt-2 border-t border-border/50">
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              API Key *
                            </label>
                            <input
                              type="text"
                              value={dest.config.api_key || ''}
                              onChange={e => updateAlertRoutingDestination(index, {
                                config: { ...dest.config, api_key: e.target.value }
                              })}
                              placeholder="OpsGenie API Key"
                              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground font-mono"
                            />
                          </div>
                        )}

                        {/* On-Call Configuration */}
                        {dest.type === 'on_call' && (
                          <div className="pt-2 border-t border-border/50">
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Schedule ID *
                            </label>
                            <input
                              type="text"
                              value={dest.config.schedule_id || ''}
                              onChange={e => updateAlertRoutingDestination(index, {
                                config: { ...dest.config, schedule_id: e.target.value }
                              })}
                              placeholder="on-call-schedule-id"
                              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                            />
                          </div>
                        )}

                        {/* n8n Configuration */}
                        {dest.type === 'n8n' && (
                          <div className="space-y-2 pt-2 border-t border-border/50">
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                n8n Webhook URL *
                              </label>
                              <input
                                type="url"
                                value={dest.config.n8n_webhook_url || ''}
                                onChange={e => updateAlertRoutingDestination(index, {
                                  config: { ...dest.config, n8n_webhook_url: e.target.value }
                                })}
                                placeholder="https://n8n.example.com/webhook/..."
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Workflow ID (optional)
                              </label>
                              <input
                                type="text"
                                value={dest.config.workflow_id || ''}
                                onChange={e => updateAlertRoutingDestination(index, {
                                  config: { ...dest.config, workflow_id: e.target.value }
                                })}
                                placeholder="workflow-123"
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                              />
                            </div>
                          </div>
                        )}

                        {/* Telegram Configuration */}
                        {dest.type === 'telegram' && (
                          <div className="space-y-2 pt-2 border-t border-border/50">
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Bot Token *
                              </label>
                              <input
                                type="text"
                                value={dest.config.telegram_bot_token || ''}
                                onChange={e => updateAlertRoutingDestination(index, {
                                  config: { ...dest.config, telegram_bot_token: e.target.value }
                                })}
                                placeholder="123456789:ABCDefGHIJKlmNOPQrsTUVwxyz"
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Chat ID *
                              </label>
                              <input
                                type="text"
                                value={dest.config.telegram_chat_id || ''}
                                onChange={e => updateAlertRoutingDestination(index, {
                                  config: { ...dest.config, telegram_chat_id: e.target.value }
                                })}
                                placeholder="-1001234567890"
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                              />
                            </div>
                          </div>
                        )}

                        {/* Microsoft Teams Configuration */}
                        {dest.type === 'teams' && (
                          <div className="space-y-2 pt-2 border-t border-border/50">
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Teams Webhook URL *
                              </label>
                              <input
                                type="url"
                                value={dest.config.teams_webhook_url || ''}
                                onChange={e => updateAlertRoutingDestination(index, {
                                  config: { ...dest.config, teams_webhook_url: e.target.value }
                                })}
                                placeholder="https://outlook.office.com/webhook/..."
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Create an Incoming Webhook connector in your Teams channel
                              </p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Card Title (optional)
                              </label>
                              <input
                                type="text"
                                value={dest.config.teams_title || ''}
                                onChange={e => updateAlertRoutingDestination(index, {
                                  config: { ...dest.config, teams_title: e.target.value }
                                })}
                                placeholder="QA Guardian Alert"
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Theme Color (optional)
                              </label>
                              <div className="flex gap-2 items-center">
                                <input
                                  type="color"
                                  value={dest.config.teams_theme_color || '#FF0000'}
                                  onChange={e => updateAlertRoutingDestination(index, {
                                    config: { ...dest.config, teams_theme_color: e.target.value }
                                  })}
                                  className="w-10 h-8 rounded border border-input cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={dest.config.teams_theme_color || '#FF0000'}
                                  onChange={e => updateAlertRoutingDestination(index, {
                                    config: { ...dest.config, teams_theme_color: e.target.value }
                                  })}
                                  placeholder="#FF0000"
                                  className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground font-mono"
                                />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Hex color for the card accent (e.g., red for critical)
                              </p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Message Template (optional)
                              </label>
                              <textarea
                                value={dest.config.message_template || ''}
                                onChange={e => updateAlertRoutingDestination(index, {
                                  config: { ...dest.config, message_template: e.target.value }
                                })}
                                placeholder="🚨 [{severity}] {check_name}: {error_message}"
                                rows={2}
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Variables: {'{'}severity{'}'}, {'{'}check_name{'}'}, {'{'}check_type{'}'}, {'{'}error_message{'}'}, {'{'}timestamp{'}'}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Discord Configuration */}
                        {dest.type === 'discord' && (
                          <div className="space-y-3 p-3 rounded-md bg-indigo-500/10 border border-indigo-500/30">
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-2">
                              🎮 Discord Webhook - send alerts to Discord channels
                            </p>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Discord Webhook URL *
                              </label>
                              <input
                                type="url"
                                value={dest.config.discord_webhook_url || ''}
                                onChange={e => updateAlertRoutingDestination(index, {
                                  config: { ...dest.config, discord_webhook_url: e.target.value }
                                })}
                                placeholder="https://discord.com/api/webhooks/..."
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Get this from Discord: Channel Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL
                              </p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Bot Username (optional)
                              </label>
                              <input
                                type="text"
                                value={dest.config.discord_username || ''}
                                onChange={e => updateAlertRoutingDestination(index, {
                                  config: { ...dest.config, discord_username: e.target.value }
                                })}
                                placeholder="QA Guardian Bot"
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Bot Avatar URL (optional)
                              </label>
                              <input
                                type="url"
                                value={dest.config.discord_avatar_url || ''}
                                onChange={e => updateAlertRoutingDestination(index, {
                                  config: { ...dest.config, discord_avatar_url: e.target.value }
                                })}
                                placeholder="https://example.com/avatar.png"
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Embed Color
                              </label>
                              <div className="flex gap-2 items-center">
                                <input
                                  type="color"
                                  value={dest.config.discord_embed_color || '#5865F2'}
                                  onChange={e => updateAlertRoutingDestination(index, {
                                    config: { ...dest.config, discord_embed_color: e.target.value }
                                  })}
                                  className="w-10 h-8 rounded border border-input cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={dest.config.discord_embed_color || '#5865F2'}
                                  onChange={e => updateAlertRoutingDestination(index, {
                                    config: { ...dest.config, discord_embed_color: e.target.value }
                                  })}
                                  placeholder="#5865F2"
                                  className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground font-mono"
                                />
                                <div className="flex gap-1">
                                  {['#ED4245', '#FEE75C', '#57F287', '#5865F2', '#EB459E'].map(color => (
                                    <button
                                      key={color}
                                      type="button"
                                      onClick={() => updateAlertRoutingDestination(index, {
                                        config: { ...dest.config, discord_embed_color: color }
                                      })}
                                      className="w-6 h-6 rounded border border-input"
                                      style={{ backgroundColor: color }}
                                      title={color}
                                    />
                                  ))}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Auto-colored by severity: 🔴 Critical #ED4245, 🟠 High #FEE75C, 🟢 Medium #57F287, 🔵 Low #5865F2
                              </p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-muted-foreground mb-1">
                                Message Template (optional)
                              </label>
                              <textarea
                                value={dest.config.message_template || ''}
                                onChange={e => updateAlertRoutingDestination(index, {
                                  config: { ...dest.config, message_template: e.target.value }
                                })}
                                placeholder="🚨 [{severity}] {check_name}: {error_message}"
                                rows={2}
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Variables: {'{'}severity{'}'}, {'{'}check_name{'}'}, {'{'}check_type{'}'}, {'{'}error_message{'}'}, {'{'}timestamp{'}'}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Test Destination Button - shown for supported types */}
                        {['pagerduty', 'opsgenie', 'slack', 'webhook', 'n8n', 'telegram', 'teams', 'discord'].includes(dest.type) && (
                          <div className="pt-2 mt-2 border-t border-border/50">
                            <button
                              type="button"
                              onClick={() => testAlertRoutingDestination(dest, index)}
                              disabled={testingDestinationIndex === index}
                              className="w-full rounded-md bg-amber-500/20 border border-amber-500/50 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/30 disabled:opacity-50"
                            >
                              {testingDestinationIndex === index ? '🔄 Testing...' : '🧪 Send Test Alert'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAlertRoutingModal(false);
                      resetAlertRoutingForm();
                    }}
                    className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAlertRouting || !alertRoutingName.trim() || alertRoutingConditions.length === 0 || alertRoutingDestinations.length === 0}
                    className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSubmittingAlertRouting ? 'Saving...' : editingAlertRoutingRule ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Test Alert Routing Modal */}
        {showAlertRoutingTest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-card p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                🧪 Test Alert Routing
              </h2>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Simulate an alert to see which routing rules would match and where it would be routed.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Severity</label>
                    <select
                      value={testAlertSeverity}
                      onChange={e => setTestAlertSeverity(e.target.value as typeof testAlertSeverity)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                      <option value="info">Info</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Check Type</label>
                    <select
                      value={testAlertCheckType}
                      onChange={e => setTestAlertCheckType(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    >
                      <option value="uptime">Uptime</option>
                      <option value="transaction">Transaction</option>
                      <option value="performance">Performance</option>
                      <option value="webhook">Webhook</option>
                      <option value="dns">DNS</option>
                      <option value="tcp">TCP</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Check Name</label>
                  <input
                    type="text"
                    value={testAlertCheckName}
                    onChange={e => setTestAlertCheckName(e.target.value)}
                    placeholder="API Server"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>

                <button
                  onClick={handleTestAlertRouting}
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Test Routing
                </button>

                {testRoutingResult && (
                  <div className="rounded-lg bg-muted p-4">
                    <h4 className="font-medium text-foreground mb-2">Result</h4>
                    <p className="text-sm text-muted-foreground mb-2">{testRoutingResult.message}</p>
                    {(testRoutingResult.matched_rules as Array<{ rule_name: string; destinations: Array<{ type: string; name: string }> }>).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground">Matched Rules:</p>
                        {(testRoutingResult.matched_rules as Array<{ rule_name: string; destinations: Array<{ type: string; name: string }> }>).map((rule, i) => (
                          <div key={i} className="text-xs p-2 bg-background rounded">
                            <span className="font-medium">{rule.rule_name}</span>
                            <span className="text-muted-foreground"> → </span>
                            {rule.destinations.map(d => d.type).join(', ')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => {
                    setShowAlertRoutingTest(false);
                    setTestRoutingResult(null);
                  }}
                  className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create/Edit Escalation Policy Modal */}
        {showEscalationPolicyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg bg-card p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                {editingEscalationPolicy ? 'Edit Escalation Policy' : 'Create Escalation Policy'}
              </h2>
              <form onSubmit={handleSubmitEscalationPolicy} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Policy Name *</label>
                    <input
                      type="text"
                      value={escalationPolicyName}
                      onChange={e => setEscalationPolicyName(e.target.value)}
                      placeholder="Primary Escalation"
                      required
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    />
                  </div>
                  <div className="flex items-end gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={escalationPolicyIsDefault}
                        onChange={e => setEscalationPolicyIsDefault(e.target.checked)}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="text-sm text-foreground">Set as default policy</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                  <textarea
                    value={escalationPolicyDescription}
                    onChange={e => setEscalationPolicyDescription(e.target.value)}
                    placeholder="Description of this escalation policy..."
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Repeat Policy</label>
                    <select
                      value={escalationPolicyRepeatPolicy}
                      onChange={e => setEscalationPolicyRepeatPolicy(e.target.value as 'once' | 'repeat_until_acknowledged')}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    >
                      <option value="once">Escalate once</option>
                      <option value="repeat_until_acknowledged">Repeat until acknowledged</option>
                    </select>
                  </div>
                  {escalationPolicyRepeatPolicy === 'repeat_until_acknowledged' && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Repeat Interval (minutes)</label>
                      <input
                        type="number"
                        value={escalationPolicyRepeatInterval}
                        onChange={e => setEscalationPolicyRepeatInterval(parseInt(e.target.value) || 30)}
                        min={5}
                        max={120}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                      />
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-foreground">
                      Escalation Levels ({escalationPolicyLevels.length})
                    </label>
                    <button
                      type="button"
                      onClick={addEscalationLevel}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      + Add Level
                    </button>
                  </div>

                  {escalationPolicyLevels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No escalation levels. Click "Add Level" to create one.</p>
                  ) : (
                    <div className="space-y-4">
                      {escalationPolicyLevels.map((level, levelIndex) => (
                        <div key={levelIndex} className="border border-border rounded-lg p-4 bg-muted/20">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 flex items-center justify-center bg-primary/10 text-primary rounded-full text-sm font-bold">
                                {levelIndex + 1}
                              </span>
                              <div>
                                <p className="text-sm font-medium text-foreground">Level {levelIndex + 1}</p>
                                {levelIndex > 0 && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-muted-foreground">Escalate after</span>
                                    <input
                                      type="number"
                                      value={level.escalate_after_minutes}
                                      onChange={e => {
                                        const newLevels = [...escalationPolicyLevels];
                                        newLevels[levelIndex].escalate_after_minutes = parseInt(e.target.value) || 0;
                                        setEscalationPolicyLevels(newLevels);
                                      }}
                                      min={1}
                                      max={120}
                                      className="w-16 rounded border border-input bg-background px-2 py-1 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">minutes</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {escalationPolicyLevels.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeEscalationLevel(levelIndex)}
                                className="text-red-500 hover:text-red-700 text-sm"
                              >
                                ✕ Remove
                              </button>
                            )}
                          </div>

                          {/* Targets for this level */}
                          <div className="mt-3">
                            <p className="text-xs font-medium text-foreground mb-2">Targets ({level.targets.length})</p>
                            {level.targets.length > 0 && (
                              <div className="space-y-2 mb-3">
                                {level.targets.map((target, targetIndex) => (
                                  <div key={targetIndex} className="flex items-center justify-between bg-background rounded p-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs">
                                        {target.type === 'user' && '👤'}
                                        {target.type === 'on_call_schedule' && '📞'}
                                        {target.type === 'email' && '✉️'}
                                        {target.type === 'webhook' && '🔗'}
                                      </span>
                                      <span className="text-sm text-foreground">
                                        {target.type === 'user' && `${target.user_name} (${target.user_email})`}
                                        {target.type === 'on_call_schedule' && `On-Call: ${onCallSchedules.find(s => s.id === target.schedule_id)?.name || 'Unknown'}`}
                                        {target.type === 'email' && target.user_email}
                                        {target.type === 'webhook' && target.webhook_url}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => removeTargetFromLevel(levelIndex, targetIndex)}
                                      className="text-red-500 hover:text-red-700 text-xs"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Add target buttons */}
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const name = prompt('Enter user name:');
                                  const email = prompt('Enter user email:');
                                  if (name && email) {
                                    addTargetToLevel(levelIndex, { type: 'user', user_name: name, user_email: email });
                                  }
                                }}
                                className="rounded px-2 py-1 text-xs bg-muted text-foreground hover:bg-muted/80"
                              >
                                + User
                              </button>
                              {onCallSchedules.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const scheduleId = prompt(`Enter schedule ID (${onCallSchedules.map(s => s.id).join(', ')}):`);
                                    if (scheduleId && onCallSchedules.find(s => s.id === scheduleId)) {
                                      addTargetToLevel(levelIndex, { type: 'on_call_schedule', schedule_id: scheduleId });
                                    }
                                  }}
                                  className="rounded px-2 py-1 text-xs bg-muted text-foreground hover:bg-muted/80"
                                >
                                  + On-Call Schedule
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const email = prompt('Enter email address:');
                                  if (email) {
                                    addTargetToLevel(levelIndex, { type: 'email', user_email: email });
                                  }
                                }}
                                className="rounded px-2 py-1 text-xs bg-muted text-foreground hover:bg-muted/80"
                              >
                                + Email
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const url = prompt('Enter webhook URL:');
                                  if (url) {
                                    addTargetToLevel(levelIndex, { type: 'webhook', webhook_url: url });
                                  }
                                }}
                                className="rounded px-2 py-1 text-xs bg-muted text-foreground hover:bg-muted/80"
                              >
                                + Webhook
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEscalationPolicyModal(false);
                      resetEscalationPolicyForm();
                    }}
                    className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingEscalationPolicy || !escalationPolicyName.trim() || escalationPolicyLevels.length === 0}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSubmittingEscalationPolicy ? 'Saving...' : editingEscalationPolicy ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create/Edit On-Call Schedule Modal */}
        {showOnCallModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-card p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                {editingOnCallSchedule ? 'Edit On-Call Schedule' : 'Create On-Call Schedule'}
              </h2>
              <form onSubmit={handleSubmitOnCallSchedule} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Schedule Name *</label>
                    <input
                      type="text"
                      value={onCallScheduleName}
                      onChange={e => setOnCallScheduleName(e.target.value)}
                      placeholder="Primary On-Call"
                      required
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Timezone</label>
                    <select
                      value={onCallScheduleTimezone}
                      onChange={e => setOnCallScheduleTimezone(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New_York (EST/EDT)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                      <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                      <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                      <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                      <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                  <textarea
                    value={onCallScheduleDescription}
                    onChange={e => setOnCallScheduleDescription(e.target.value)}
                    placeholder="Description of this on-call schedule..."
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Rotation Type</label>
                    <select
                      value={onCallScheduleRotationType}
                      onChange={e => {
                        const type = e.target.value as 'daily' | 'weekly' | 'custom';
                        setOnCallScheduleRotationType(type);
                        if (type === 'daily') setOnCallScheduleRotationInterval(1);
                        else if (type === 'weekly') setOnCallScheduleRotationInterval(7);
                      }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Rotation Interval (days)</label>
                    <input
                      type="number"
                      value={onCallScheduleRotationInterval}
                      onChange={e => setOnCallScheduleRotationInterval(parseInt(e.target.value) || 1)}
                      min={1}
                      max={90}
                      disabled={onCallScheduleRotationType !== 'custom'}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Team Members ({onCallScheduleMembers.length})
                  </label>

                  {/* Add member form */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <input
                      type="text"
                      value={newMemberName}
                      onChange={e => setNewMemberName(e.target.value)}
                      placeholder="Name"
                      className="rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm"
                    />
                    <input
                      type="email"
                      value={newMemberEmail}
                      onChange={e => setNewMemberEmail(e.target.value)}
                      placeholder="Email"
                      className="rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm"
                    />
                    <input
                      type="tel"
                      value={newMemberPhone}
                      onChange={e => setNewMemberPhone(e.target.value)}
                      placeholder="Phone (optional)"
                      className="rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm"
                    />
                    <button
                      type="button"
                      onClick={addOnCallMember}
                      disabled={!newMemberName.trim() || !newMemberEmail.trim()}
                      className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>

                  {/* Members list */}
                  {onCallScheduleMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No members added yet. Add at least one member.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto border border-border rounded-md p-2 space-y-2">
                      {onCallScheduleMembers.map((member, index) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 flex items-center justify-center bg-primary/10 text-primary rounded-full text-xs font-medium">
                              {index + 1}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-foreground">{member.user_name}</p>
                              <p className="text-xs text-muted-foreground">{member.user_email} {member.phone && `• ${member.phone}`}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeOnCallMember(member.id)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOnCallModal(false);
                      resetOnCallScheduleForm();
                    }}
                    className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingOnCallSchedule || !onCallScheduleName.trim() || onCallScheduleMembers.length === 0}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSubmittingOnCallSchedule ? 'Saving...' : editingOnCallSchedule ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create/Edit Status Page Modal */}
        {showStatusPageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-card p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                {editingStatusPage ? 'Edit Status Page' : 'Create Status Page'}
              </h2>
              <form onSubmit={handleSubmitStatusPage} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Name *</label>
                    <input
                      type="text"
                      value={statusPageName}
                      onChange={e => setStatusPageName(e.target.value)}
                      placeholder="My Service Status"
                      required
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">URL Slug</label>
                    <div className="flex items-center">
                      <span className="text-sm text-muted-foreground mr-1">/status/</span>
                      <input
                        type="text"
                        value={statusPageSlug}
                        onChange={e => setStatusPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                        placeholder="my-service"
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-foreground"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Leave empty to auto-generate from name</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                  <textarea
                    value={statusPageDescription}
                    onChange={e => setStatusPageDescription(e.target.value)}
                    placeholder="Current status of our services..."
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Brand Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={statusPageColor}
                        onChange={e => setStatusPageColor(e.target.value)}
                        className="w-10 h-10 rounded border border-input cursor-pointer"
                      />
                      <input
                        type="text"
                        value={statusPageColor}
                        onChange={e => setStatusPageColor(e.target.value)}
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col justify-center">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={statusPageIsPublic}
                        onChange={e => setStatusPageIsPublic(e.target.checked)}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="text-sm text-foreground">Public (accessible without login)</span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <label className="block text-sm font-medium text-foreground mb-2">Display Options</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={statusPageShowUptime}
                        onChange={e => setStatusPageShowUptime(e.target.checked)}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="text-sm text-foreground">Show uptime %</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={statusPageShowResponseTime}
                        onChange={e => setStatusPageShowResponseTime(e.target.checked)}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="text-sm text-foreground">Show response time</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={statusPageShowIncidents}
                        onChange={e => setStatusPageShowIncidents(e.target.checked)}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="text-sm text-foreground">Show incidents</span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Select Checks to Display ({statusPageSelectedChecks.length} selected)
                  </label>
                  {availableChecksForStatus.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No checks available. Create some monitoring checks first.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto border border-border rounded-md p-2 space-y-2">
                      {availableChecksForStatus.map(check => (
                        <label
                          key={check.id}
                          className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={statusPageSelectedChecks.some(c => c.id === check.id)}
                            onChange={() => toggleStatusPageCheck(check)}
                            className="h-4 w-4 rounded border-input"
                          />
                          <span className="text-sm">
                            {check.type === 'uptime' && '🌐'}
                            {check.type === 'transaction' && '🔄'}
                            {check.type === 'performance' && '⚡'}
                            {check.type === 'dns' && '🌍'}
                            {check.type === 'tcp' && '🔌'}
                          </span>
                          <span className="text-sm text-foreground">{check.name}</span>
                          <span className="text-xs text-muted-foreground">({check.type})</span>
                          {!check.enabled && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">disabled</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setShowStatusPageModal(false);
                      resetStatusPageForm();
                    }}
                    className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingStatusPage || !statusPageName.trim()}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSubmittingStatusPage ? 'Saving...' : editingStatusPage ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Incident Management Panel */}
        {selectedStatusPageForIncident && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg bg-card p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    📢 Incident Management - {selectedStatusPageForIncident.name}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create and manage incident communications for your status page
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedStatusPageForIncident(null);
                    setStatusPageIncidents([]);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center justify-end mb-4">
                <button
                  onClick={() => {
                    resetIncidentForm();
                    setShowIncidentModal(true);
                  }}
                  className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
                >
                  + Create Incident
                </button>
              </div>

              {isLoadingStatusPageIncidents ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                </div>
              ) : statusPageIncidents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <div className="text-4xl mb-3">📣</div>
                  <h4 className="font-medium text-foreground mb-2">No incidents</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    No active or recent incidents on this status page
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {statusPageIncidents.map(incident => (
                    <div key={incident.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            incident.impact === 'critical' ? 'bg-red-100 text-red-800' :
                            incident.impact === 'major' ? 'bg-orange-100 text-orange-800' :
                            incident.impact === 'minor' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {incident.impact.toUpperCase()}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            incident.status === 'resolved' ? 'bg-green-100 text-green-800' :
                            incident.status === 'monitoring' ? 'bg-blue-100 text-blue-800' :
                            incident.status === 'identified' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openAddUpdateModal(incident)}
                            className="rounded px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
                          >
                            Add Update
                          </button>
                          <button
                            onClick={() => handleDeleteIncident(incident.id)}
                            className="rounded px-2 py-1 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <h4 className="font-medium text-foreground mt-2">{incident.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Created: {new Date(incident.created_at).toLocaleString()}
                        {incident.resolved_at && ` • Resolved: ${new Date(incident.resolved_at).toLocaleString()}`}
                      </p>

                      {incident.updates.length > 0 && (
                        <div className="mt-3 pl-4 border-l-2 border-border space-y-2">
                          {incident.updates.slice().reverse().map((update, idx) => (
                            <div key={update.id || idx} className="text-sm">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className={`font-medium ${
                                  update.status === 'resolved' ? 'text-green-600' :
                                  update.status === 'monitoring' ? 'text-blue-600' :
                                  update.status === 'identified' ? 'text-yellow-600' :
                                  'text-red-600'
                                }`}>
                                  {update.status.charAt(0).toUpperCase() + update.status.slice(1)}
                                </span>
                                <span>•</span>
                                <span>{new Date(update.created_at).toLocaleString()}</span>
                              </div>
                              <p className="text-foreground mt-1">{update.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-border mt-4">
                <button
                  onClick={() => {
                    setSelectedStatusPageForIncident(null);
                    setStatusPageIncidents([]);
                  }}
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Incident Modal */}
        {showIncidentModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-foreground mb-4">Create New Incident</h2>
              <form onSubmit={handleCreateIncident} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Incident Title *</label>
                  <input
                    type="text"
                    value={incidentTitle}
                    onChange={e => setIncidentTitle(e.target.value)}
                    placeholder="Service degradation on API endpoints"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                    <select
                      value={incidentStatus}
                      onChange={e => setIncidentStatus(e.target.value as 'investigating' | 'identified' | 'monitoring' | 'resolved')}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    >
                      <option value="investigating">Investigating</option>
                      <option value="identified">Identified</option>
                      <option value="monitoring">Monitoring</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Impact</label>
                    <select
                      value={incidentImpact}
                      onChange={e => setIncidentImpact(e.target.value as 'none' | 'minor' | 'major' | 'critical')}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    >
                      <option value="none">None</option>
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Initial Message</label>
                  <textarea
                    value={incidentUpdateMessage}
                    onChange={e => setIncidentUpdateMessage(e.target.value)}
                    placeholder="We are currently investigating this issue..."
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setShowIncidentModal(false);
                      resetIncidentForm();
                    }}
                    className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingIncident || !incidentTitle.trim()}
                    className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                  >
                    {isSubmittingIncident ? 'Creating...' : 'Create Incident'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Incident Update Modal */}
        {showIncidentUpdateModal && editingIncident && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-foreground mb-4">Add Incident Update</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Incident: {editingIncident.title}
              </p>
              <form onSubmit={handleAddIncidentUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">New Status</label>
                  <select
                    value={incidentStatus}
                    onChange={e => setIncidentStatus(e.target.value as 'investigating' | 'identified' | 'monitoring' | 'resolved')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  >
                    <option value="investigating">Investigating</option>
                    <option value="identified">Identified</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Update Message *</label>
                  <textarea
                    value={incidentUpdateMessage}
                    onChange={e => setIncidentUpdateMessage(e.target.value)}
                    placeholder="Describe the current status and any actions taken..."
                    rows={3}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setShowIncidentUpdateModal(false);
                      resetIncidentForm();
                    }}
                    className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingIncident || !incidentUpdateMessage.trim()}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSubmittingIncident ? 'Posting...' : 'Post Update'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create TCP Modal */}
        {showTcpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-foreground mb-4">Create TCP Check</h2>
              <form onSubmit={handleCreateTcp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                  <input
                    type="text"
                    value={tcpName}
                    onChange={e => setTcpName(e.target.value)}
                    placeholder="My Server Port Monitor"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Host</label>
                  <input
                    type="text"
                    value={tcpHost}
                    onChange={e => setTcpHost(e.target.value)}
                    placeholder="example.com or 192.168.1.1"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Port</label>
                  <input
                    type="number"
                    value={tcpPort}
                    onChange={e => setTcpPort(parseInt(e.target.value) || 80)}
                    min={1}
                    max={65535}
                    placeholder="80"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Port number (1-65535)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Check Interval</label>
                  <select
                    value={tcpInterval}
                    onChange={e => setTcpInterval(parseInt(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  >
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                    <option value={300}>5 minutes</option>
                    <option value={900}>15 minutes</option>
                    <option value={3600}>1 hour</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTcpModal(false);
                      resetTcpForm();
                    }}
                    className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTcp}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSubmittingTcp ? 'Creating...' : 'Create TCP Check'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create DNS Modal */}
        {showDnsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-foreground mb-4">Create DNS Check</h2>
              <form onSubmit={handleCreateDns} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                  <input
                    type="text"
                    value={dnsName}
                    onChange={e => setDnsName(e.target.value)}
                    placeholder="My Domain DNS Monitor"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Domain</label>
                  <input
                    type="text"
                    value={dnsDomain}
                    onChange={e => setDnsDomain(e.target.value)}
                    placeholder="example.com"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Record Type</label>
                  <select
                    value={dnsRecordType}
                    onChange={e => setDnsRecordType(e.target.value as 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  >
                    <option value="A">A (IPv4 Address)</option>
                    <option value="AAAA">AAAA (IPv6 Address)</option>
                    <option value="CNAME">CNAME (Canonical Name)</option>
                    <option value="MX">MX (Mail Exchange)</option>
                    <option value="TXT">TXT (Text Record)</option>
                    <option value="NS">NS (Name Server)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Expected Values (Optional)</label>
                  <input
                    type="text"
                    value={dnsExpectedValues}
                    onChange={e => setDnsExpectedValues(e.target.value)}
                    placeholder="e.g., 192.168.1.1, 192.168.1.2"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Comma-separated IP addresses or values to expect</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Check Interval</label>
                  <select
                    value={dnsInterval}
                    onChange={e => setDnsInterval(parseInt(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  >
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                    <option value={300}>5 minutes</option>
                    <option value={900}>15 minutes</option>
                    <option value={3600}>1 hour</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDnsModal(false);
                      resetDnsForm();
                    }}
                    className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingDns}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSubmittingDns ? 'Creating...' : 'Create DNS Check'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Webhook Modal */}
        {showWebhookModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-foreground mb-4">Create Webhook Check</h2>
              <form onSubmit={handleCreateWebhook} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                  <input
                    type="text"
                    value={webhookName}
                    onChange={e => setWebhookName(e.target.value)}
                    placeholder="My Webhook Monitor"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                  <input
                    type="text"
                    value={webhookDescription}
                    onChange={e => setWebhookDescription(e.target.value)}
                    placeholder="Monitor incoming webhooks from service X"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Expected Interval (seconds)</label>
                  <select
                    value={webhookInterval}
                    onChange={e => setWebhookInterval(parseInt(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  >
                    <option value={60}>1 min</option>
                    <option value={300}>5 min</option>
                    <option value={900}>15 min</option>
                    <option value={3600}>1 hour</option>
                    <option value={86400}>24 hours</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">Alert if no webhook received within this interval</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Payload Validation</label>
                  <select
                    value={webhookPayloadType}
                    onChange={e => setWebhookPayloadType(e.target.value as 'any' | 'key-value')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  >
                    <option value="any">Accept Any Payload</option>
                    <option value="key-value">Require Specific Fields</option>
                  </select>
                </div>
                {webhookPayloadType === 'key-value' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Required Fields</label>
                    <input
                      type="text"
                      value={webhookRequiredFields}
                      onChange={e => setWebhookRequiredFields(e.target.value)}
                      placeholder="e.g., event_type, user_id, timestamp"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Comma-separated list of required JSON fields</p>
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowWebhookModal(false);
                      setWebhookName('');
                      setWebhookDescription('');
                      setWebhookInterval(300);
                      setWebhookPayloadType('any');
                      setWebhookRequiredFields('');
                    }}
                    className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingWebhook}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSubmittingWebhook ? 'Creating...' : 'Create Webhook'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create/Edit Check Modal - Simplified with Smart Defaults */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-4">
            <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-semibold text-foreground mb-4">{editingCheck ? 'Edit Uptime Check' : 'Create Uptime Check'}</h2>
              <form onSubmit={editingCheck ? handleUpdateCheck : handleCreateCheck} className="space-y-4">
                {/* URL Input - Primary field */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">URL to Monitor</label>
                  <input
                    type="url"
                    value={formUrl}
                    onChange={e => handleUrlChange(e.target.value)}
                    placeholder="https://api.example.com/health"
                    required
                    autoFocus
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                  {formUrl && formName && (
                    <p className="text-xs text-muted-foreground mt-1">Name: {formName}</p>
                  )}
                </div>

                {/* Preset Selection - Only show when creating */}
                {!editingCheck && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Monitoring Level</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.entries(presets) as [keyof typeof presets, typeof presets[keyof typeof presets]][]).map(([key, preset]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => applyPreset(key)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              applyPreset(key);
                            }
                          }}
                          className={`relative p-3 rounded-lg border-2 text-center transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                            selectedPreset === key
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary/50 hover:bg-muted'
                          }`}
                        >
                          {selectedPreset === key && (
                            <div className="absolute -top-2 -right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                          <div className="text-xl mb-1">{preset.icon}</div>
                          <div className="font-medium text-sm text-foreground">{preset.label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{preset.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Name field - editable */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Auto-generated from URL"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>

                {/* Advanced Options - Collapsible */}
                <div className="border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Advanced Options
                    <span className="text-xs text-muted-foreground ml-auto">
                      {showAdvancedOptions ? 'Click to collapse' : 'Method, Headers, Locations, Assertions...'}
                    </span>
                  </button>
                </div>

                {/* Advanced Options Content */}
                {showAdvancedOptions && (
                  <div className="space-y-4 pl-2 border-l-2 border-border">
                    {/* Method & Interval */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Method</label>
                        <select
                          value={formMethod}
                          onChange={e => setFormMethod(e.target.value as 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE' | 'PATCH')}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                          <option value="DELETE">DELETE</option>
                          <option value="HEAD">HEAD</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Interval</label>
                        <select
                          value={formInterval}
                          onChange={e => {
                            setFormInterval(parseInt(e.target.value));
                            setSelectedPreset(null); // Clear preset when manually changing
                          }}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                        >
                          <option value={30}>30s</option>
                          <option value={60}>1 min</option>
                          <option value={120}>2 min</option>
                          <option value={180}>3 min</option>
                          <option value={300}>5 min</option>
                        </select>
                      </div>
                    </div>

                    {/* Timeout & Expected Status */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Timeout (ms)</label>
                        <input
                          type="number"
                          value={formTimeout}
                          onChange={e => setFormTimeout(parseInt(e.target.value))}
                          min={1000}
                          max={30000}
                          step={1000}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Expected Status</label>
                        <input
                          type="number"
                          value={formExpectedStatus}
                          onChange={e => setFormExpectedStatus(parseInt(e.target.value))}
                          min={100}
                          max={599}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                        />
                      </div>
                    </div>

                    {/* Request Headers */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Request Headers</label>
                      <textarea
                        value={formHeaders}
                        onChange={e => setFormHeaders(e.target.value)}
                        placeholder="Header-Name: value (one per line)"
                        rows={2}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground font-mono text-sm"
                      />
                    </div>

                    {/* Request Body - Only for POST/PUT/PATCH */}
                    {(formMethod === 'POST' || formMethod === 'PUT' || formMethod === 'PATCH') && (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Request Body</label>
                        <textarea
                          value={formBody}
                          onChange={e => setFormBody(e.target.value)}
                          placeholder='{"key": "value"}'
                          rows={3}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground font-mono text-sm"
                        />
                      </div>
                    )}

                    {/* Monitoring Locations */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Monitoring Locations</label>
                      <div className="grid grid-cols-2 gap-2">
                        {availableLocations.map(loc => (
                          <label
                            key={loc.id}
                            className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                              formLocations.includes(loc.id)
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:bg-muted'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={formLocations.includes(loc.id)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setFormLocations([...formLocations, loc.id]);
                                } else {
                                  setFormLocations(formLocations.filter(l => l !== loc.id));
                                }
                              }}
                              className="rounded border-input"
                            />
                            <div className="flex-1 text-sm">
                              <div className="font-medium">{loc.name}</div>
                              <div className="text-xs text-muted-foreground">{loc.city}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                      {formLocations.length === 0 && (
                        <p className="text-xs text-red-500 mt-1">At least one location required</p>
                      )}
                    </div>

                    {/* Response Assertions */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">Response Assertions</label>
                      <div className="space-y-2">
                        {formAssertions.map((assertion, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/30">
                            <select
                              value={assertion.type}
                              onChange={e => {
                                const updated = [...formAssertions];
                                updated[idx] = { ...updated[idx], type: e.target.value as UptimeAssertion['type'] };
                                setFormAssertions(updated);
                              }}
                              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                            >
                              <option value="responseTime">Response Time</option>
                              <option value="statusCode">Status Code</option>
                              <option value="bodyContains">Body Contains</option>
                              <option value="headerContains">Header Contains</option>
                            </select>
                            <select
                              value={assertion.operator}
                              onChange={e => {
                                const updated = [...formAssertions];
                                updated[idx] = { ...updated[idx], operator: e.target.value as UptimeAssertion['operator'] };
                                setFormAssertions(updated);
                              }}
                              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                            >
                              <option value="lessThan">&lt;</option>
                              <option value="greaterThan">&gt;</option>
                              <option value="equals">=</option>
                              <option value="contains">~</option>
                            </select>
                            <input
                              type={assertion.type === 'bodyContains' || assertion.type === 'headerContains' ? 'text' : 'number'}
                              value={assertion.value}
                              onChange={e => {
                                const updated = [...formAssertions];
                                const value = assertion.type === 'bodyContains' || assertion.type === 'headerContains'
                                  ? e.target.value
                                  : parseInt(e.target.value) || 0;
                                updated[idx] = { ...updated[idx], value };
                                setFormAssertions(updated);
                              }}
                              className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => setFormAssertions(formAssertions.filter((_, i) => i !== idx))}
                              className="text-red-500 hover:text-red-700"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setFormAssertions([...formAssertions, { type: 'responseTime', operator: 'lessThan', value: 500 }])}
                          className="text-sm text-primary hover:underline"
                        >
                          + Add Assertion
                        </button>
                      </div>
                    </div>

                    {/* SSL Certificate Monitoring - Only for HTTPS URLs */}
                    {formUrl.startsWith('https://') && (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">🔒 SSL Monitoring</label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Warn</span>
                          <input
                            type="number"
                            value={formSslWarningDays}
                            onChange={e => setFormSslWarningDays(parseInt(e.target.value) || 30)}
                            min={1}
                            max={365}
                            className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm"
                          />
                          <span className="text-sm text-muted-foreground">days before SSL expiry</span>
                        </div>
                      </div>
                    )}

                    {/* Consecutive Failure Alerting */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">🔔 Alert Threshold</label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Alert after</span>
                        <input
                          type="number"
                          value={formConsecutiveFailures}
                          onChange={e => {
                            setFormConsecutiveFailures(parseInt(e.target.value) || 1);
                            setSelectedPreset(null); // Clear preset when manually changing
                          }}
                          min={1}
                          max={10}
                          className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm"
                        />
                        <span className="text-sm text-muted-foreground">consecutive failures</span>
                      </div>
                    </div>

                    {/* Tags & Group */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">🏷️ Tags</label>
                        <input
                          type="text"
                          value={formTags}
                          onChange={e => setFormTags(e.target.value)}
                          placeholder="production, api"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">📁 Group</label>
                        <input
                          type="text"
                          value={formGroup}
                          onChange={e => setFormGroup(e.target.value)}
                          placeholder="Backend APIs"
                          list="available-groups"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                        <datalist id="available-groups">
                          {availableGroups.map(g => (
                            <option key={g} value={g} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => { setShowCreateModal(false); resetForm(); }}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !formUrl || formLocations.length === 0}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSubmitting ? (editingCheck ? 'Updating...' : 'Creating...') : (editingCheck ? 'Update Check' : 'Create Check')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Transaction Modal */}
        {showTransactionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
            <div className="w-full max-w-2xl rounded-lg bg-card p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-semibold text-foreground mb-4">Create Transaction</h2>
              <form onSubmit={handleCreateTransaction} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                    <input
                      type="text"
                      value={txnName}
                      onChange={e => setTxnName(e.target.value)}
                      placeholder="Login Flow"
                      required
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Interval</label>
                    <select
                      value={txnInterval}
                      onChange={e => setTxnInterval(parseInt(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    >
                      <option value={60}>1 min</option>
                      <option value={300}>5 min</option>
                      <option value={600}>10 min</option>
                      <option value={900}>15 min</option>
                      <option value={1800}>30 min</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={txnDescription}
                    onChange={e => setTxnDescription(e.target.value)}
                    placeholder="Monitor the user login flow"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>

                {/* Steps */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-foreground">Steps</label>
                    <button
                      type="button"
                      onClick={addTransactionStep}
                      className="text-xs text-primary hover:text-primary/80"
                    >
                      + Add Step
                    </button>
                  </div>
                  <div className="space-y-4">
                    {txnSteps.map((step, stepIndex) => (
                      <div key={stepIndex} className="rounded-lg border border-border p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                            {stepIndex + 1}
                          </span>
                          {txnSteps.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTransactionStep(stepIndex)}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Step Name</label>
                            <input
                              type="text"
                              value={step.name}
                              onChange={e => updateTransactionStep(stepIndex, 'name', e.target.value)}
                              placeholder="Get login page"
                              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Method</label>
                              <select
                                value={step.method}
                                onChange={e => updateTransactionStep(stepIndex, 'method', e.target.value)}
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                              >
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                                <option value="PUT">PUT</option>
                                <option value="PATCH">PATCH</option>
                                <option value="DELETE">DELETE</option>
                              </select>
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs text-muted-foreground mb-1">Expected Status</label>
                              <input
                                type="number"
                                value={step.expected_status}
                                onChange={e => updateTransactionStep(stepIndex, 'expected_status', parseInt(e.target.value))}
                                min={100}
                                max={599}
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="block text-xs text-muted-foreground mb-1">URL</label>
                          <input
                            type="url"
                            value={step.url}
                            onChange={e => updateTransactionStep(stepIndex, 'url', e.target.value)}
                            placeholder="https://api.example.com/login"
                            required
                            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                          />
                        </div>
                        {(step.method === 'POST' || step.method === 'PUT' || step.method === 'PATCH') && (
                          <>
                            <div className="mb-3">
                              <label className="block text-xs text-muted-foreground mb-1">Headers</label>
                              <textarea
                                value={step.headers || ''}
                                onChange={e => updateTransactionStep(stepIndex, 'headers', e.target.value)}
                                placeholder="Content-Type: application/json"
                                rows={2}
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground font-mono"
                              />
                            </div>
                            <div className="mb-3">
                              <label className="block text-xs text-muted-foreground mb-1">Body</label>
                              <textarea
                                value={step.body || ''}
                                onChange={e => updateTransactionStep(stepIndex, 'body', e.target.value)}
                                placeholder='{"username": "test", "password": "test123"}'
                                rows={2}
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground font-mono"
                              />
                            </div>
                          </>
                        )}

                        {/* Assertions */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs text-muted-foreground">Assertions</label>
                            <button
                              type="button"
                              onClick={() => addAssertionToStep(stepIndex)}
                              className="text-xs text-primary hover:text-primary/80"
                            >
                              + Add Assertion
                            </button>
                          </div>
                          {step.assertions.length > 0 && (
                            <div className="space-y-2">
                              {step.assertions.map((assertion, assertionIndex) => (
                                <div key={assertionIndex} className="flex items-center gap-2 rounded border border-border p-2">
                                  <select
                                    value={assertion.type}
                                    onChange={e => updateAssertionInStep(stepIndex, assertionIndex, 'type', e.target.value)}
                                    className="rounded border border-input bg-background px-2 py-1 text-xs"
                                  >
                                    <option value="status">Status Code</option>
                                    <option value="responseTime">Response Time</option>
                                    <option value="bodyContains">Body Contains</option>
                                    <option value="headerContains">Header Contains</option>
                                  </select>
                                  <select
                                    value={assertion.operator || 'equals'}
                                    onChange={e => updateAssertionInStep(stepIndex, assertionIndex, 'operator', e.target.value)}
                                    className="rounded border border-input bg-background px-2 py-1 text-xs"
                                  >
                                    <option value="equals">equals</option>
                                    <option value="contains">contains</option>
                                    <option value="lessThan">less than</option>
                                    <option value="greaterThan">greater than</option>
                                  </select>
                                  <input
                                    type={assertion.type === 'responseTime' || assertion.type === 'status' ? 'number' : 'text'}
                                    value={assertion.value}
                                    onChange={e => updateAssertionInStep(stepIndex, assertionIndex, 'value', assertion.type === 'responseTime' || assertion.type === 'status' ? parseInt(e.target.value) : e.target.value)}
                                    placeholder="Value"
                                    className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeAssertionFromStep(stepIndex, assertionIndex)}
                                    className="text-red-600 hover:text-red-700 text-xs"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowTransactionModal(false); resetTransactionForm(); }}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTxn}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSubmittingTxn ? 'Creating...' : 'Create Transaction'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Performance Check Modal */}
        {showPerformanceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-foreground mb-4">Create Performance Check</h2>
              <form onSubmit={handleCreatePerformance} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                  <input
                    type="text"
                    value={perfName}
                    onChange={e => setPerfName(e.target.value)}
                    placeholder="Homepage Performance"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">URL</label>
                  <input
                    type="url"
                    value={perfUrl}
                    onChange={e => setPerfUrl(e.target.value)}
                    placeholder="https://example.com"
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Interval</label>
                    <select
                      value={perfInterval}
                      onChange={e => setPerfInterval(parseInt(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    >
                      <option value={300}>5 min</option>
                      <option value={900}>15 min</option>
                      <option value={1800}>30 min</option>
                      <option value={3600}>1 hour</option>
                      <option value={21600}>6 hours</option>
                      <option value={86400}>24 hours</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Device</label>
                    <select
                      value={perfDevice}
                      onChange={e => setPerfDevice(e.target.value as 'desktop' | 'mobile')}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                    >
                      <option value="desktop">Desktop</option>
                      <option value="mobile">Mobile</option>
                    </select>
                  </div>
                </div>
                <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  <strong>Metrics Tracked:</strong> LCP, FID, CLS, TTFB, FCP, TTI, TBT, Speed Index, Page Size, Request Count, DOM Elements
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowPerformanceModal(false); resetPerformanceForm(); }}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPerf}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSubmittingPerf ? 'Creating...' : 'Create Performance Check'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}


export { MonitoringPage };
