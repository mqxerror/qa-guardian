/**
 * Monitoring Alerts Repository - Database CRUD operations for alerts and configuration
 *
 * Feature #250: Extracted from monitoring.ts (1499 lines) for better organization.
 *
 * This module handles alert and configuration data including:
 * - Status pages and subscriptions
 * - Monitoring settings
 * - Deleted check history
 * - Alert grouping rules and groups (Feature #2118)
 * - Memory store compatibility stubs (return empty Maps)
 */

import { query, isDatabaseConnected } from '../database.js';
import {
  StatusPage,
  StatusPageIncident,
  StatusPageSubscription,
  MonitoringSettings,
  DeletedCheckHistory,
  OnCallSchedule,
  EscalationPolicy,
  AlertGroupingRule,
  AlertGroup,
  GroupedAlert,
  AlertRoutingRule,
  AlertRoutingLog,
  AlertRateLimitConfig,
  AlertRateLimitState,
  AlertCorrelationConfig,
  AlertCorrelation,
  AlertRunbook,
  ManagedIncident,
  UptimeCheck,
  CheckResult,
  TransactionCheck,
  TransactionResult,
  PerformanceCheck,
  PerformanceResult,
  MaintenanceWindow,
  Incident,
  WebhookCheck,
  WebhookEvent,
  DnsCheck,
  DnsCheckResult,
  TcpCheck,
  TcpCheckResult,
} from '../../routes/monitoring/types.js';
// Feature #510: Safe JSON parsing for DB row columns
import { safeJsonParseOrPassthrough } from '../../utils/index.js';

// ============================================
// Column Constants for SELECT queries
// ============================================

const STATUS_PAGE_COLUMNS = `
  id, organization_id, name, slug, description, logo_url, favicon_url,
  primary_color, show_history_days, checks, custom_domain, is_public,
  show_uptime_percentage, show_response_time, show_incidents,
  created_by, created_at, updated_at
`;

const MONITORING_SETTINGS_COLUMNS = `
  organization_id, retention_days, auto_cleanup_enabled, last_cleanup_at, updated_by, updated_at
`;

const DELETED_CHECK_HISTORY_COLUMNS = `
  check_id, check_name, check_type, organization_id, deleted_by, deleted_at,
  check_config, historical_results_count, last_status
`;

const ALERT_GROUPING_RULE_COLUMNS = `
  id, organization_id, name, description, group_by, time_window_minutes,
  deduplication_enabled, deduplication_key, max_alerts_per_group,
  notification_delay_seconds, is_active, priority, created_by, created_at, updated_at
`;

const ALERT_GROUP_COLUMNS = `
  id, organization_id, rule_id, group_key, alerts, status, severity,
  first_alert_at, last_alert_at, notification_sent, notification_sent_at,
  acknowledged_by, acknowledged_at, resolved_at, resolved_by,
  resolution_notes, resolution_time_seconds,
  snoozed_until, snoozed_by, snoozed_at, snooze_duration_hours
`;

// ============================================
// Feature #462: Row interfaces to eliminate : any types
// ============================================

interface StatusPageRow {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  show_history_days: number;
  checks: string | string[];
  custom_domain: string | null;
  is_public: boolean;
  show_uptime_percentage: boolean;
  show_response_time: boolean;
  show_incidents: boolean;
  created_by: string;
  created_at: string | Date;
  updated_at: string | Date;
}

interface MonitoringSettingsRow {
  organization_id: string;
  retention_days: number;
  auto_cleanup_enabled: boolean;
  last_cleanup_at: string | Date | null;
  updated_by: string;
  updated_at: string | Date;
}

interface DeletedCheckHistoryRow {
  check_id: string;
  check_name: string;
  check_type: string;
  organization_id: string;
  deleted_by: string;
  deleted_at: string | Date;
  check_config: string | Record<string, unknown>;
  historical_results_count: number;
  last_status: string;
}

interface AlertGroupingRuleRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  group_by: string | string[];
  time_window_minutes: number;
  deduplication_enabled: boolean;
  deduplication_key: string | null;
  max_alerts_per_group: number;
  notification_delay_seconds: number;
  is_active: boolean;
  priority: number;
  created_by: string;
  created_at: string | Date;
  updated_at: string | Date;
}

interface AlertGroupRow {
  id: string;
  organization_id: string;
  rule_id: string;
  group_key: string;
  alerts: string | GroupedAlert[];
  status: string;
  severity: string | null;
  first_alert_at: string | Date;
  last_alert_at: string | Date;
  notification_sent: boolean;
  notification_sent_at: string | Date | null;
  acknowledged_by: string | null;
  acknowledged_at: string | Date | null;
  resolved_at: string | Date | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  resolution_time_seconds: number | null;
  snoozed_until: string | Date | null;
  snoozed_by: string | null;
  snoozed_at: string | Date | null;
  snooze_duration_hours: number | null;
}

// =============================
// STATUS PAGES CRUD
// =============================

export async function createStatusPage(page: StatusPage): Promise<StatusPage> {
  if (isDatabaseConnected()) {
    const result = await query<StatusPageRow>(
      `INSERT INTO status_pages (
        id, organization_id, name, slug, description, logo_url, favicon_url,
        primary_color, show_history_days, checks, custom_domain, is_public,
        show_uptime_percentage, show_response_time, show_incidents,
        created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        page.id, page.organization_id, page.name, page.slug, page.description,
        page.logo_url, page.favicon_url, page.primary_color, page.show_history_days,
        JSON.stringify(page.checks), page.custom_domain, page.is_public,
        page.show_uptime_percentage, page.show_response_time, page.show_incidents,
        page.created_by, page.created_at, page.updated_at
      ]
    );
    if (result && result.rows[0]) return parseStatusPageRow(result.rows[0]);
  }
  return page;
}

export async function getStatusPage(id: string): Promise<StatusPage | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<StatusPageRow>(`SELECT ${STATUS_PAGE_COLUMNS} FROM status_pages WHERE id = $1`, [id]);
    if (result && result.rows[0]) return parseStatusPageRow(result.rows[0]);
    return undefined;
  }
  return undefined;
}

export async function getStatusPageBySlug(slug: string): Promise<StatusPage | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<StatusPageRow>(`SELECT ${STATUS_PAGE_COLUMNS} FROM status_pages WHERE slug = $1`, [slug]);
    if (result && result.rows[0]) return parseStatusPageRow(result.rows[0]);
    return undefined;
  }
  return undefined;
}

export async function updateStatusPage(id: string, updates: Partial<StatusPage>): Promise<StatusPage | undefined> {
  const existing = await getStatusPage(id);
  if (!existing) return undefined;

  const updated: StatusPage = { ...existing, ...updates, updated_at: new Date() };

  if (isDatabaseConnected()) {
    const result = await query<StatusPageRow>(
      `UPDATE status_pages SET
        name = $2, slug = $3, description = $4, logo_url = $5, favicon_url = $6,
        primary_color = $7, show_history_days = $8, checks = $9, custom_domain = $10, is_public = $11,
        show_uptime_percentage = $12, show_response_time = $13, show_incidents = $14, updated_at = $15
       WHERE id = $1 RETURNING *`,
      [
        id, updated.name, updated.slug, updated.description, updated.logo_url, updated.favicon_url,
        updated.primary_color, updated.show_history_days, JSON.stringify(updated.checks),
        updated.custom_domain, updated.is_public, updated.show_uptime_percentage,
        updated.show_response_time, updated.show_incidents, updated.updated_at
      ]
    );
    if (result && result.rows[0]) return parseStatusPageRow(result.rows[0]);
    return undefined;
  }
  return updated;
}

export async function deleteStatusPage(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(`DELETE FROM status_pages WHERE id = $1`, [id]);
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return false;
}

export async function listStatusPages(organizationId: string, limit: number = 100): Promise<StatusPage[]> {
  if (isDatabaseConnected()) {
    const result = await query<StatusPageRow>(
      `SELECT ${STATUS_PAGE_COLUMNS} FROM status_pages WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [organizationId, limit]
    );
    if (result) return result.rows.map(parseStatusPageRow);
    return [];
  }
  return [];
}

function parseStatusPageRow(row: StatusPageRow): StatusPage {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    logo_url: row.logo_url ?? undefined,
    favicon_url: row.favicon_url ?? undefined,
    primary_color: row.primary_color ?? undefined,
    show_history_days: row.show_history_days,
    checks: safeJsonParseOrPassthrough(row.checks, []) as unknown as StatusPage['checks'],
    custom_domain: row.custom_domain ?? undefined,
    is_public: row.is_public,
    show_uptime_percentage: row.show_uptime_percentage,
    show_response_time: row.show_response_time,
    show_incidents: row.show_incidents,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}


// =============================
// MONITORING SETTINGS CRUD
// =============================

export async function getMonitoringSettings(orgId: string): Promise<MonitoringSettings | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<MonitoringSettingsRow>(
      `SELECT ${MONITORING_SETTINGS_COLUMNS} FROM monitoring_settings WHERE organization_id = $1`,
      [orgId]
    );
    if (result && result.rows[0]) return parseMonitoringSettingsRow(result.rows[0]);
    return undefined;
  }
  return undefined;
}

export async function setMonitoringSettings(settings: MonitoringSettings): Promise<MonitoringSettings> {
  if (isDatabaseConnected()) {
    const result = await query<MonitoringSettingsRow>(
      `INSERT INTO monitoring_settings (organization_id, retention_days, auto_cleanup_enabled, last_cleanup_at, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (organization_id) DO UPDATE SET
         retention_days = $2, auto_cleanup_enabled = $3, last_cleanup_at = $4, updated_by = $5, updated_at = $6
       RETURNING *`,
      [settings.organization_id, settings.retention_days, settings.auto_cleanup_enabled, settings.last_cleanup_at, settings.updated_by, settings.updated_at]
    );
    if (result && result.rows[0]) return parseMonitoringSettingsRow(result.rows[0]);
  }
  return settings;
}

function parseMonitoringSettingsRow(row: MonitoringSettingsRow): MonitoringSettings {
  return {
    organization_id: row.organization_id,
    retention_days: row.retention_days as MonitoringSettings['retention_days'],
    auto_cleanup_enabled: row.auto_cleanup_enabled,
    last_cleanup_at: row.last_cleanup_at ? new Date(row.last_cleanup_at) : undefined,
    updated_by: row.updated_by,
    updated_at: new Date(row.updated_at),
  };
}


// =============================
// DELETED CHECK HISTORY CRUD
// =============================

export async function addDeletedCheckHistory(history: DeletedCheckHistory): Promise<DeletedCheckHistory> {
  if (isDatabaseConnected()) {
    await query(
      `INSERT INTO deleted_check_history (
        check_id, check_name, check_type, organization_id, deleted_by, deleted_at,
        check_config, historical_results_count, last_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        history.check_id, history.check_name, history.check_type, history.organization_id,
        history.deleted_by, history.deleted_at, JSON.stringify(history.check_config),
        history.historical_results_count, history.last_status
      ]
    );
    return history;
  }
  return history;
}

export async function getDeletedCheckHistory(checkId: string): Promise<DeletedCheckHistory | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<DeletedCheckHistoryRow>(
      `SELECT ${DELETED_CHECK_HISTORY_COLUMNS} FROM deleted_check_history WHERE check_id = $1`,
      [checkId]
    );
    if (result && result.rows[0]) {
      const row = result.rows[0];
      return {
        check_id: row.check_id,
        check_name: row.check_name,
        check_type: row.check_type as DeletedCheckHistory['check_type'],
        organization_id: row.organization_id,
        deleted_by: row.deleted_by,
        deleted_at: new Date(row.deleted_at),
        check_config: safeJsonParseOrPassthrough(row.check_config, {} as Record<string, unknown>),
        historical_results_count: row.historical_results_count,
        last_status: row.last_status as DeletedCheckHistory['last_status'],
      };
    }
    return undefined;
  }
  return undefined;
}


export async function listDeletedCheckHistory(organizationId: string, limit: number = 100): Promise<DeletedCheckHistory[]> {
  if (isDatabaseConnected()) {
    const result = await query<DeletedCheckHistoryRow>(
      `SELECT ${DELETED_CHECK_HISTORY_COLUMNS} FROM deleted_check_history WHERE organization_id = $1 ORDER BY deleted_at DESC LIMIT $2`,
      [organizationId, limit]
    );
    if (result) {
      return result.rows.map((row: DeletedCheckHistoryRow) => ({
        check_id: row.check_id,
        check_name: row.check_name,
        check_type: row.check_type as DeletedCheckHistory['check_type'],
        organization_id: row.organization_id,
        deleted_by: row.deleted_by,
        deleted_at: new Date(row.deleted_at),
        check_config: safeJsonParseOrPassthrough(row.check_config, {} as Record<string, unknown>),
        historical_results_count: row.historical_results_count,
        last_status: row.last_status as DeletedCheckHistory['last_status'],
      }));
    }
    return [];
  }
  return [];
}

// =============================
// ALERT GROUPING RULES CRUD
// Feature #2118: Persist alert grouping rules to PostgreSQL
// =============================

export async function createAlertGroupingRule(rule: AlertGroupingRule): Promise<AlertGroupingRule> {
  if (isDatabaseConnected()) {
    const result = await query<AlertGroupingRuleRow>(
      `INSERT INTO alert_grouping_rules (
        id, organization_id, name, description, group_by, time_window_minutes,
        deduplication_enabled, deduplication_key, max_alerts_per_group,
        notification_delay_seconds, is_active, priority, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        rule.id, rule.organization_id, rule.name, rule.description || null,
        JSON.stringify(rule.group_by), rule.time_window_minutes,
        rule.deduplication_enabled, rule.deduplication_key || null,
        rule.max_alerts_per_group, rule.notification_delay_seconds,
        rule.is_active, rule.priority, rule.created_by, rule.created_at, rule.updated_at
      ]
    );
    if (result && result.rows[0]) return parseAlertGroupingRuleRow(result.rows[0]);
  }
  return rule;
}

export async function getAlertGroupingRule(id: string): Promise<AlertGroupingRule | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<AlertGroupingRuleRow>(
      `SELECT ${ALERT_GROUPING_RULE_COLUMNS} FROM alert_grouping_rules WHERE id = $1`,
      [id]
    );
    if (result && result.rows[0]) return parseAlertGroupingRuleRow(result.rows[0]);
    return undefined;
  }
  return undefined;
}

export async function updateAlertGroupingRule(id: string, updates: Partial<AlertGroupingRule>): Promise<AlertGroupingRule | undefined> {
  const existing = await getAlertGroupingRule(id);
  if (!existing) return undefined;

  const updated: AlertGroupingRule = { ...existing, ...updates, updated_at: new Date() };

  if (isDatabaseConnected()) {
    const result = await query<AlertGroupingRuleRow>(
      `UPDATE alert_grouping_rules SET
        name = $2, description = $3, group_by = $4, time_window_minutes = $5,
        deduplication_enabled = $6, deduplication_key = $7, max_alerts_per_group = $8,
        notification_delay_seconds = $9, is_active = $10, priority = $11, updated_at = $12
       WHERE id = $1 RETURNING *`,
      [
        id, updated.name, updated.description || null,
        JSON.stringify(updated.group_by), updated.time_window_minutes,
        updated.deduplication_enabled, updated.deduplication_key || null,
        updated.max_alerts_per_group, updated.notification_delay_seconds,
        updated.is_active, updated.priority, updated.updated_at
      ]
    );
    if (result && result.rows[0]) return parseAlertGroupingRuleRow(result.rows[0]);
    return undefined;
  }
  return updated;
}

export async function deleteAlertGroupingRule(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(`DELETE FROM alert_grouping_rules WHERE id = $1`, [id]);
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return false;
}

export async function listAlertGroupingRules(organizationId: string, limit: number = 100): Promise<AlertGroupingRule[]> {
  if (isDatabaseConnected()) {
    const result = await query<AlertGroupingRuleRow>(
      `SELECT ${ALERT_GROUPING_RULE_COLUMNS} FROM alert_grouping_rules
       WHERE organization_id = $1 ORDER BY priority ASC, created_at DESC LIMIT $2`,
      [organizationId, limit]
    );
    if (result) return result.rows.map(parseAlertGroupingRuleRow);
    return [];
  }
  return [];
}

function parseAlertGroupingRuleRow(row: AlertGroupingRuleRow): AlertGroupingRule {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    description: row.description ?? undefined,
    group_by: safeJsonParseOrPassthrough(row.group_by, []) as AlertGroupingRule['group_by'],
    time_window_minutes: row.time_window_minutes,
    deduplication_enabled: row.deduplication_enabled,
    deduplication_key: row.deduplication_key ?? undefined,
    max_alerts_per_group: row.max_alerts_per_group,
    notification_delay_seconds: row.notification_delay_seconds,
    is_active: row.is_active,
    priority: row.priority,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}


// =============================
// ALERT GROUPS CRUD
// Feature #2118: Persist alert groups to PostgreSQL
// =============================

export async function createAlertGroup(group: AlertGroup): Promise<AlertGroup> {
  if (isDatabaseConnected()) {
    const result = await query<AlertGroupRow>(
      `INSERT INTO alert_groups (
        id, organization_id, rule_id, group_key, alerts, status, severity,
        first_alert_at, last_alert_at, notification_sent, notification_sent_at,
        acknowledged_by, acknowledged_at, resolved_at, resolved_by,
        resolution_notes, resolution_time_seconds,
        snoozed_until, snoozed_by, snoozed_at, snooze_duration_hours
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *`,
      [
        group.id, group.organization_id, group.rule_id, group.group_key,
        JSON.stringify(group.alerts), group.status, group.severity || null,
        group.first_alert_at, group.last_alert_at, group.notification_sent,
        group.notification_sent_at || null, group.acknowledged_by || null,
        group.acknowledged_at || null, group.resolved_at || null,
        group.resolved_by || null, group.resolution_notes || null,
        group.resolution_time_seconds || null,
        group.snoozed_until || null, group.snoozed_by || null,
        group.snoozed_at || null, group.snooze_duration_hours || null
      ]
    );
    if (result && result.rows[0]) return parseAlertGroupRow(result.rows[0]);
  }
  return group;
}

export async function getAlertGroup(id: string): Promise<AlertGroup | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<AlertGroupRow>(
      `SELECT ${ALERT_GROUP_COLUMNS} FROM alert_groups WHERE id = $1`,
      [id]
    );
    if (result && result.rows[0]) return parseAlertGroupRow(result.rows[0]);
    return undefined;
  }
  return undefined;
}

export async function updateAlertGroup(id: string, updates: Partial<AlertGroup>): Promise<AlertGroup | undefined> {
  const existing = await getAlertGroup(id);
  if (!existing) return undefined;

  const updated: AlertGroup = { ...existing, ...updates };

  if (isDatabaseConnected()) {
    const result = await query<AlertGroupRow>(
      `UPDATE alert_groups SET
        alerts = $2, status = $3, severity = $4, last_alert_at = $5,
        notification_sent = $6, notification_sent_at = $7,
        acknowledged_by = $8, acknowledged_at = $9,
        resolved_at = $10, resolved_by = $11,
        resolution_notes = $12, resolution_time_seconds = $13,
        snoozed_until = $14, snoozed_by = $15, snoozed_at = $16, snooze_duration_hours = $17
       WHERE id = $1 RETURNING *`,
      [
        id, JSON.stringify(updated.alerts), updated.status, updated.severity || null,
        updated.last_alert_at, updated.notification_sent,
        updated.notification_sent_at || null, updated.acknowledged_by || null,
        updated.acknowledged_at || null, updated.resolved_at || null,
        updated.resolved_by || null, updated.resolution_notes || null,
        updated.resolution_time_seconds || null,
        updated.snoozed_until || null, updated.snoozed_by || null,
        updated.snoozed_at || null, updated.snooze_duration_hours || null
      ]
    );
    if (result && result.rows[0]) return parseAlertGroupRow(result.rows[0]);
    return undefined;
  }
  return updated;
}

export async function listAlertGroups(organizationId: string, limit: number = 200): Promise<AlertGroup[]> {
  if (isDatabaseConnected()) {
    const result = await query<AlertGroupRow>(
      `SELECT ${ALERT_GROUP_COLUMNS} FROM alert_groups
       WHERE organization_id = $1 ORDER BY last_alert_at DESC LIMIT $2`,
      [organizationId, limit]
    );
    if (result) return result.rows.map(parseAlertGroupRow);
    return [];
  }
  return [];
}

/**
 * Find an active alert group matching a specific rule, group key, and within the time window.
 * Used by the simulate endpoint to find existing groups to add alerts to.
 */
export async function findActiveAlertGroup(
  organizationId: string,
  ruleId: string,
  groupKey: string,
  timeWindowMs: number,
  maxAlerts: number
): Promise<AlertGroup | undefined> {
  if (isDatabaseConnected()) {
    const cutoff = new Date(Date.now() - timeWindowMs);
    const result = await query<AlertGroupRow>(
      `SELECT ${ALERT_GROUP_COLUMNS} FROM alert_groups
       WHERE organization_id = $1
         AND rule_id = $2
         AND group_key = $3
         AND status = 'active'
         AND first_alert_at >= $4
         AND jsonb_array_length(alerts) < $5
       ORDER BY first_alert_at DESC
       LIMIT 1`,
      [organizationId, ruleId, groupKey, cutoff, maxAlerts]
    );
    if (result && result.rows[0]) return parseAlertGroupRow(result.rows[0]);
    return undefined;
  }
  return undefined;
}

function parseAlertGroupRow(row: AlertGroupRow): AlertGroup {
  const rawAlerts = safeJsonParseOrPassthrough(row.alerts, []) as GroupedAlert[];
  // Ensure triggered_at fields are Date objects
  const alerts: GroupedAlert[] = rawAlerts.map(a => ({
    ...a,
    triggered_at: new Date(a.triggered_at),
  }));

  return {
    id: row.id,
    organization_id: row.organization_id,
    rule_id: row.rule_id,
    group_key: row.group_key,
    alerts,
    status: row.status as AlertGroup['status'],
    severity: (row.severity as AlertGroup['severity']) ?? undefined,
    first_alert_at: new Date(row.first_alert_at),
    last_alert_at: new Date(row.last_alert_at),
    notification_sent: row.notification_sent,
    notification_sent_at: row.notification_sent_at ? new Date(row.notification_sent_at) : undefined,
    acknowledged_by: row.acknowledged_by ?? undefined,
    acknowledged_at: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
    resolved_at: row.resolved_at ? new Date(row.resolved_at) : undefined,
    resolved_by: row.resolved_by ?? undefined,
    resolution_notes: row.resolution_notes ?? undefined,
    resolution_time_seconds: row.resolution_time_seconds ?? undefined,
    snoozed_until: row.snoozed_until ? new Date(row.snoozed_until) : undefined,
    snoozed_by: row.snoozed_by ?? undefined,
    snoozed_at: row.snoozed_at ? new Date(row.snoozed_at) : undefined,
    snooze_duration_hours: row.snooze_duration_hours ?? undefined,
  };
}


// =============================
// MEMORY STORE ACCESS (for compatibility)
// Feature #2105: Memory stores removed, these return empty Maps
// =============================

// Return empty Maps for backward compatibility (memory stores removed in #2105)
export function getMemoryUptimeChecks(): Map<string, UptimeCheck> { return new Map(); }
export function getMemoryCheckResults(): Map<string, CheckResult[]> { return new Map(); }
export function getMemoryTransactionChecks(): Map<string, TransactionCheck> { return new Map(); }
export function getMemoryTransactionResults(): Map<string, TransactionResult[]> { return new Map(); }
export function getMemoryPerformanceChecks(): Map<string, PerformanceCheck> { return new Map(); }
export function getMemoryPerformanceResults(): Map<string, PerformanceResult[]> { return new Map(); }
export function getMemoryMaintenanceWindows(): Map<string, MaintenanceWindow[]> { return new Map(); }
export function getMemoryCheckIncidents(): Map<string, Incident[]> { return new Map(); }
export function getMemoryActiveIncidents(): Map<string, Incident> { return new Map(); }
export function getMemoryConsecutiveFailures(): Map<string, number> { return new Map(); }
export function getMemoryWebhookChecks(): Map<string, WebhookCheck> { return new Map(); }
export function getMemoryWebhookEvents(): Map<string, WebhookEvent[]> { return new Map(); }
export function getMemoryWebhookTokenMap(): Map<string, string> { return new Map(); }
export function getMemoryDnsChecks(): Map<string, DnsCheck> { return new Map(); }
export function getMemoryDnsResults(): Map<string, DnsCheckResult[]> { return new Map(); }
export function getMemoryTcpChecks(): Map<string, TcpCheck> { return new Map(); }
export function getMemoryTcpResults(): Map<string, TcpCheckResult[]> { return new Map(); }
export function getMemoryMonitoringSettings(): Map<string, MonitoringSettings> { return new Map(); }
export function getMemoryStatusPages(): Map<string, StatusPage> { return new Map(); }
export function getMemoryStatusPagesBySlug(): Map<string, string> { return new Map(); }
export function getMemoryStatusPageIncidents(): Map<string, StatusPageIncident[]> { return new Map(); }
export function getMemoryStatusPageSubscriptions(): Map<string, StatusPageSubscription[]> { return new Map(); }
export function getMemoryOnCallSchedules(): Map<string, OnCallSchedule> { return new Map(); }
export function getMemoryEscalationPolicies(): Map<string, EscalationPolicy> { return new Map(); }
export function getMemoryDeletedCheckHistory(): Map<string, DeletedCheckHistory> { return new Map(); }
export function getMemoryAlertGroupingRules(): Map<string, AlertGroupingRule> { return new Map(); }
export function getMemoryAlertGroups(): Map<string, AlertGroup> { return new Map(); }
export function getMemoryAlertRoutingRules(): Map<string, AlertRoutingRule> { return new Map(); }
export function getMemoryAlertRoutingLogs(): Map<string, AlertRoutingLog[]> { return new Map(); }
export function getMemoryAlertRateLimitConfigs(): Map<string, AlertRateLimitConfig> { return new Map(); }
export function getMemoryAlertRateLimitStates(): Map<string, AlertRateLimitState> { return new Map(); }
export function getMemoryAlertCorrelationConfigs(): Map<string, AlertCorrelationConfig> { return new Map(); }
export function getMemoryAlertCorrelations(): Map<string, AlertCorrelation> { return new Map(); }
export function getMemoryAlertToCorrelation(): Map<string, string> { return new Map(); }
export function getMemoryAlertRunbooks(): Map<string, AlertRunbook> { return new Map(); }
export function getMemoryManagedIncidents(): Map<string, ManagedIncident> { return new Map(); }
export function getMemoryIncidentsByOrg(): Map<string, string[]> { return new Map(); }
