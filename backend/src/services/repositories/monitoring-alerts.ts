/**
 * Monitoring Alerts Repository - Database CRUD operations for alerts and configuration
 *
 * Feature #250: Extracted from monitoring.ts (1499 lines) for better organization.
 *
 * This module handles alert and configuration data including:
 * - Status pages and subscriptions
 * - Monitoring settings
 * - Deleted check history
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
    checks: typeof row.checks === 'string' ? JSON.parse(row.checks) : row.checks,
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
        check_config: typeof row.check_config === 'string' ? JSON.parse(row.check_config) : row.check_config,
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
        check_config: typeof row.check_config === 'string' ? JSON.parse(row.check_config) : row.check_config,
        historical_results_count: row.historical_results_count,
        last_status: row.last_status as DeletedCheckHistory['last_status'],
      }));
    }
    return [];
  }
  return [];
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
