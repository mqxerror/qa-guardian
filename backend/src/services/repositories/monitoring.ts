/**
 * Monitoring Repository - Database CRUD operations for monitoring module
 *
 * Feature #2086: Migrates in-memory Map stores to PostgreSQL persistence.
 * Provides transparent fallback to in-memory storage when database is not connected.
 *
 * This module handles all monitoring data including:
 * - Uptime checks and results
 * - Transaction checks and results
 * - Performance checks and results
 * - Maintenance windows
 * - Incidents (active and historical)
 * - Webhook checks and events
 * - DNS checks and results
 * - TCP checks and results
 * - Status pages and subscriptions
 * - On-call schedules and escalation policies
 * - Alert grouping, routing, rate limiting
 * - Alert correlations and runbooks
 * - Managed incidents
 */

import { query, isDatabaseConnected } from '../database';
import {
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
  MonitoringSettings,
  StatusPage,
  StatusPageIncident,
  StatusPageSubscription,
  OnCallSchedule,
  EscalationPolicy,
  DeletedCheckHistory,
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
} from '../../routes/monitoring/types';

// =============================
// IN-MEMORY STORES (FALLBACK)
// =============================

// Uptime checks and results
const memoryUptimeChecks: Map<string, UptimeCheck> = new Map();
const memoryCheckResults: Map<string, CheckResult[]> = new Map();

// Transaction checks and results
const memoryTransactionChecks: Map<string, TransactionCheck> = new Map();
const memoryTransactionResults: Map<string, TransactionResult[]> = new Map();

// Performance checks and results
const memoryPerformanceChecks: Map<string, PerformanceCheck> = new Map();
const memoryPerformanceResults: Map<string, PerformanceResult[]> = new Map();

// Maintenance windows: checkId -> windows
const memoryMaintenanceWindows: Map<string, MaintenanceWindow[]> = new Map();

// Incidents: checkId -> incidents (closed ones)
const memoryCheckIncidents: Map<string, Incident[]> = new Map();

// Active incidents: checkId -> incident (ongoing)
const memoryActiveIncidents: Map<string, Incident> = new Map();

// Consecutive failures tracking: checkId -> count
const memoryConsecutiveFailures: Map<string, number> = new Map();

// Webhook checks and events
const memoryWebhookChecks: Map<string, WebhookCheck> = new Map();
const memoryWebhookEvents: Map<string, WebhookEvent[]> = new Map();
const memoryWebhookTokenMap: Map<string, string> = new Map();

// DNS checks and results
const memoryDnsChecks: Map<string, DnsCheck> = new Map();
const memoryDnsResults: Map<string, DnsCheckResult[]> = new Map();

// TCP checks and results
const memoryTcpChecks: Map<string, TcpCheck> = new Map();
const memoryTcpResults: Map<string, TcpCheckResult[]> = new Map();

// Organization monitoring settings
const memoryMonitoringSettings: Map<string, MonitoringSettings> = new Map();

// Status pages
const memoryStatusPages: Map<string, StatusPage> = new Map();
const memoryStatusPagesBySlug: Map<string, string> = new Map();
const memoryStatusPageIncidents: Map<string, StatusPageIncident[]> = new Map();
const memoryStatusPageSubscriptions: Map<string, StatusPageSubscription[]> = new Map();

// On-call schedules
const memoryOnCallSchedules: Map<string, OnCallSchedule> = new Map();

// Escalation policies
const memoryEscalationPolicies: Map<string, EscalationPolicy> = new Map();

// Deleted check history
const memoryDeletedCheckHistory: Map<string, DeletedCheckHistory> = new Map();

// Alert grouping
const memoryAlertGroupingRules: Map<string, AlertGroupingRule> = new Map();
const memoryAlertGroups: Map<string, AlertGroup> = new Map();

// Alert routing
const memoryAlertRoutingRules: Map<string, AlertRoutingRule> = new Map();
const memoryAlertRoutingLogs: Map<string, AlertRoutingLog[]> = new Map();

// Alert rate limiting
const memoryAlertRateLimitConfigs: Map<string, AlertRateLimitConfig> = new Map();
const memoryAlertRateLimitStates: Map<string, AlertRateLimitState> = new Map();

// Alert correlation
const memoryAlertCorrelationConfigs: Map<string, AlertCorrelationConfig> = new Map();
const memoryAlertCorrelations: Map<string, AlertCorrelation> = new Map();
const memoryAlertToCorrelation: Map<string, string> = new Map();

// Alert runbooks
const memoryAlertRunbooks: Map<string, AlertRunbook> = new Map();

// Managed incidents
const memoryManagedIncidents: Map<string, ManagedIncident> = new Map();
const memoryIncidentsByOrg: Map<string, string[]> = new Map();


// =============================
// UPTIME CHECKS CRUD
// =============================

export async function createUptimeCheck(check: UptimeCheck): Promise<UptimeCheck> {
  if (isDatabaseConnected()) {
    const result = await query<UptimeCheck>(
      `INSERT INTO uptime_checks (
        id, organization_id, name, url, method, interval_seconds, timeout_ms,
        expected_status, headers, body, locations, assertions,
        ssl_expiry_warning_days, consecutive_failures_threshold, tags, group_name,
        enabled, paused_at, paused_by, pause_reason, pause_expires_at,
        created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      RETURNING *`,
      [
        check.id, check.organization_id, check.name, check.url, check.method,
        check.interval, check.timeout, check.expected_status,
        JSON.stringify(check.headers || {}), check.body,
        JSON.stringify(check.locations), JSON.stringify(check.assertions || []),
        check.ssl_expiry_warning_days, check.consecutive_failures_threshold,
        JSON.stringify(check.tags || []), check.group,
        check.enabled, check.paused_at, check.paused_by, check.pause_reason, check.pause_expires_at,
        check.created_by, check.created_at, check.updated_at
      ]
    );
    if (result && result.rows[0]) {
      return parseUptimeCheckRow(result.rows[0]);
    }
  }
  // Fallback to memory
  memoryUptimeChecks.set(check.id, check);
  return check;
}

export async function getUptimeCheck(id: string): Promise<UptimeCheck | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM uptime_checks WHERE id = $1`,
      [id]
    );
    if (result && result.rows[0]) {
      return parseUptimeCheckRow(result.rows[0]);
    }
    return undefined;
  }
  return memoryUptimeChecks.get(id);
}

export async function updateUptimeCheck(id: string, updates: Partial<UptimeCheck>): Promise<UptimeCheck | undefined> {
  const existing = await getUptimeCheck(id);
  if (!existing) return undefined;

  const updated: UptimeCheck = {
    ...existing,
    ...updates,
    updated_at: new Date(),
  };

  if (isDatabaseConnected()) {
    const result = await query<any>(
      `UPDATE uptime_checks SET
        name = $2, url = $3, method = $4, interval_seconds = $5, timeout_ms = $6,
        expected_status = $7, headers = $8, body = $9, locations = $10, assertions = $11,
        ssl_expiry_warning_days = $12, consecutive_failures_threshold = $13, tags = $14, group_name = $15,
        enabled = $16, paused_at = $17, paused_by = $18, pause_reason = $19, pause_expires_at = $20,
        updated_at = $21
      WHERE id = $1
      RETURNING *`,
      [
        id, updated.name, updated.url, updated.method, updated.interval, updated.timeout,
        updated.expected_status, JSON.stringify(updated.headers || {}), updated.body,
        JSON.stringify(updated.locations), JSON.stringify(updated.assertions || []),
        updated.ssl_expiry_warning_days, updated.consecutive_failures_threshold,
        JSON.stringify(updated.tags || []), updated.group,
        updated.enabled, updated.paused_at, updated.paused_by, updated.pause_reason, updated.pause_expires_at,
        updated.updated_at
      ]
    );
    if (result && result.rows[0]) {
      return parseUptimeCheckRow(result.rows[0]);
    }
    return undefined;
  }
  memoryUptimeChecks.set(id, updated);
  return updated;
}

export async function deleteUptimeCheck(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      `DELETE FROM uptime_checks WHERE id = $1`,
      [id]
    );
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return memoryUptimeChecks.delete(id);
}

export async function listUptimeChecks(organizationId: string): Promise<UptimeCheck[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM uptime_checks WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId]
    );
    if (result) {
      return result.rows.map(parseUptimeCheckRow);
    }
    return [];
  }
  return Array.from(memoryUptimeChecks.values()).filter(c => c.organization_id === organizationId);
}

export async function getAllUptimeChecks(): Promise<UptimeCheck[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(`SELECT * FROM uptime_checks ORDER BY created_at DESC`);
    if (result) {
      return result.rows.map(parseUptimeCheckRow);
    }
    return [];
  }
  return Array.from(memoryUptimeChecks.values());
}

function parseUptimeCheckRow(row: any): UptimeCheck {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    url: row.url,
    method: row.method,
    interval: row.interval_seconds,
    timeout: row.timeout_ms,
    expected_status: row.expected_status,
    headers: typeof row.headers === 'string' ? JSON.parse(row.headers) : row.headers,
    body: row.body,
    locations: typeof row.locations === 'string' ? JSON.parse(row.locations) : row.locations,
    assertions: typeof row.assertions === 'string' ? JSON.parse(row.assertions) : row.assertions,
    ssl_expiry_warning_days: row.ssl_expiry_warning_days,
    consecutive_failures_threshold: row.consecutive_failures_threshold,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
    group: row.group_name,
    enabled: row.enabled,
    paused_at: row.paused_at ? new Date(row.paused_at) : undefined,
    paused_by: row.paused_by,
    pause_reason: row.pause_reason,
    pause_expires_at: row.pause_expires_at ? new Date(row.pause_expires_at) : undefined,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}


// =============================
// CHECK RESULTS CRUD
// =============================

export async function addCheckResult(result: CheckResult): Promise<CheckResult> {
  if (isDatabaseConnected()) {
    const dbResult = await query<any>(
      `INSERT INTO check_results (
        id, check_id, location, status, response_time_ms, status_code,
        error, assertion_results, assertions_passed, assertions_failed,
        ssl_info, checked_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        result.id, result.check_id, result.location, result.status,
        result.response_time, result.status_code, result.error,
        JSON.stringify(result.assertion_results || []),
        result.assertions_passed, result.assertions_failed,
        JSON.stringify(result.ssl_info || null), result.checked_at
      ]
    );
    if (dbResult && dbResult.rows[0]) {
      return parseCheckResultRow(dbResult.rows[0]);
    }
  }
  // Fallback to memory
  const results = memoryCheckResults.get(result.check_id) || [];
  results.push(result);
  memoryCheckResults.set(result.check_id, results);
  return result;
}

export async function getCheckResults(checkId: string, limit: number = 100): Promise<CheckResult[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM check_results WHERE check_id = $1 ORDER BY checked_at DESC LIMIT $2`,
      [checkId, limit]
    );
    if (result) {
      return result.rows.map(parseCheckResultRow);
    }
    return [];
  }
  const results = memoryCheckResults.get(checkId) || [];
  return results.slice(-limit).reverse();
}

export async function getLatestCheckResult(checkId: string): Promise<CheckResult | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM check_results WHERE check_id = $1 ORDER BY checked_at DESC LIMIT 1`,
      [checkId]
    );
    if (result && result.rows[0]) {
      return parseCheckResultRow(result.rows[0]);
    }
    return undefined;
  }
  const results = memoryCheckResults.get(checkId) || [];
  return results[results.length - 1];
}

export async function deleteOldCheckResults(checkId: string, retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  if (isDatabaseConnected()) {
    const result = await query(
      `DELETE FROM check_results WHERE check_id = $1 AND checked_at < $2`,
      [checkId, cutoff]
    );
    return result?.rowCount ?? 0;
  }
  const results = memoryCheckResults.get(checkId) || [];
  const filtered = results.filter(r => r.checked_at >= cutoff);
  const deletedCount = results.length - filtered.length;
  memoryCheckResults.set(checkId, filtered);
  return deletedCount;
}

function parseCheckResultRow(row: any): CheckResult {
  return {
    id: row.id,
    check_id: row.check_id,
    location: row.location,
    status: row.status,
    response_time: row.response_time_ms,
    status_code: row.status_code,
    error: row.error,
    assertion_results: typeof row.assertion_results === 'string' ? JSON.parse(row.assertion_results) : row.assertion_results,
    assertions_passed: row.assertions_passed,
    assertions_failed: row.assertions_failed,
    ssl_info: typeof row.ssl_info === 'string' ? JSON.parse(row.ssl_info) : row.ssl_info,
    checked_at: new Date(row.checked_at),
  };
}


// =============================
// INCIDENTS CRUD
// =============================

export async function createIncident(incident: Incident): Promise<Incident> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO check_incidents (
        id, check_id, status, started_at, ended_at, duration_seconds, error, affected_locations
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        incident.id, incident.check_id, incident.status, incident.started_at,
        incident.ended_at, incident.duration_seconds, incident.error,
        JSON.stringify(incident.affected_locations)
      ]
    );
    if (result && result.rows[0]) {
      return parseIncidentRow(result.rows[0]);
    }
  }
  // Fallback to memory - add to both active and history based on status
  if (!incident.ended_at) {
    memoryActiveIncidents.set(incident.check_id, incident);
  } else {
    const incidents = memoryCheckIncidents.get(incident.check_id) || [];
    incidents.push(incident);
    memoryCheckIncidents.set(incident.check_id, incidents);
  }
  return incident;
}

export async function getActiveIncident(checkId: string): Promise<Incident | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM check_incidents WHERE check_id = $1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1`,
      [checkId]
    );
    if (result && result.rows[0]) {
      return parseIncidentRow(result.rows[0]);
    }
    return undefined;
  }
  return memoryActiveIncidents.get(checkId);
}

export async function setActiveIncident(checkId: string, incident: Incident): Promise<void> {
  if (isDatabaseConnected()) {
    // Just create/update the incident in database
    await createIncident(incident);
    return;
  }
  memoryActiveIncidents.set(checkId, incident);
}

export async function clearActiveIncident(checkId: string): Promise<void> {
  if (isDatabaseConnected()) {
    // In DB, we resolve incidents by setting ended_at
    // The incident should already be resolved before calling this
    return;
  }
  memoryActiveIncidents.delete(checkId);
}

export async function resolveIncident(incidentId: string, endedAt: Date): Promise<Incident | undefined> {
  if (isDatabaseConnected()) {
    // Calculate duration
    const existing = await query<any>(
      `SELECT * FROM check_incidents WHERE id = $1`,
      [incidentId]
    );
    if (!existing || !existing.rows[0]) return undefined;

    const startedAt = new Date(existing.rows[0].started_at);
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

    const result = await query<any>(
      `UPDATE check_incidents SET ended_at = $2, duration_seconds = $3 WHERE id = $1 RETURNING *`,
      [incidentId, endedAt, durationSeconds]
    );
    if (result && result.rows[0]) {
      return parseIncidentRow(result.rows[0]);
    }
    return undefined;
  }
  // Memory fallback
  for (const [checkId, incident] of memoryActiveIncidents.entries()) {
    if (incident.id === incidentId) {
      incident.ended_at = endedAt;
      incident.duration_seconds = Math.floor((endedAt.getTime() - incident.started_at.getTime()) / 1000);
      memoryActiveIncidents.delete(checkId);
      const incidents = memoryCheckIncidents.get(checkId) || [];
      incidents.push(incident);
      memoryCheckIncidents.set(checkId, incidents);
      return incident;
    }
  }
  return undefined;
}

export async function getCheckIncidents(checkId: string): Promise<Incident[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM check_incidents WHERE check_id = $1 ORDER BY started_at DESC`,
      [checkId]
    );
    if (result) {
      return result.rows.map(parseIncidentRow);
    }
    return [];
  }
  return memoryCheckIncidents.get(checkId) || [];
}

function parseIncidentRow(row: any): Incident {
  return {
    id: row.id,
    check_id: row.check_id,
    status: row.status,
    started_at: new Date(row.started_at),
    ended_at: row.ended_at ? new Date(row.ended_at) : undefined,
    duration_seconds: row.duration_seconds,
    error: row.error,
    affected_locations: typeof row.affected_locations === 'string' ? JSON.parse(row.affected_locations) : row.affected_locations,
  };
}


// =============================
// CONSECUTIVE FAILURES TRACKING
// =============================

export async function getConsecutiveFailures(checkId: string): Promise<number> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT consecutive_failures FROM uptime_check_state WHERE check_id = $1`,
      [checkId]
    );
    if (result && result.rows[0]) {
      return result.rows[0].consecutive_failures || 0;
    }
    return 0;
  }
  return memoryConsecutiveFailures.get(checkId) || 0;
}

export async function setConsecutiveFailures(checkId: string, count: number): Promise<void> {
  if (isDatabaseConnected()) {
    await query(
      `INSERT INTO uptime_check_state (check_id, consecutive_failures, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (check_id) DO UPDATE SET consecutive_failures = $2, updated_at = NOW()`,
      [checkId, count]
    );
    return;
  }
  memoryConsecutiveFailures.set(checkId, count);
}


// =============================
// MAINTENANCE WINDOWS CRUD
// =============================

export async function createMaintenanceWindow(window: MaintenanceWindow): Promise<MaintenanceWindow> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO maintenance_windows (id, check_id, name, start_time, end_time, reason, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [window.id, window.check_id, window.name, window.start_time, window.end_time, window.reason, window.created_by, window.created_at]
    );
    if (result && result.rows[0]) {
      return parseMaintenanceWindowRow(result.rows[0]);
    }
  }
  const windows = memoryMaintenanceWindows.get(window.check_id) || [];
  windows.push(window);
  memoryMaintenanceWindows.set(window.check_id, windows);
  return window;
}

export async function getMaintenanceWindows(checkId: string): Promise<MaintenanceWindow[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM maintenance_windows WHERE check_id = $1 ORDER BY start_time DESC`,
      [checkId]
    );
    if (result) {
      return result.rows.map(parseMaintenanceWindowRow);
    }
    return [];
  }
  return memoryMaintenanceWindows.get(checkId) || [];
}

export async function deleteMaintenanceWindow(windowId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      `DELETE FROM maintenance_windows WHERE id = $1`,
      [windowId]
    );
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  for (const [checkId, windows] of memoryMaintenanceWindows.entries()) {
    const filtered = windows.filter(w => w.id !== windowId);
    if (filtered.length < windows.length) {
      memoryMaintenanceWindows.set(checkId, filtered);
      return true;
    }
  }
  return false;
}

function parseMaintenanceWindowRow(row: any): MaintenanceWindow {
  return {
    id: row.id,
    check_id: row.check_id,
    name: row.name,
    start_time: new Date(row.start_time),
    end_time: new Date(row.end_time),
    reason: row.reason,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
  };
}


// =============================
// TRANSACTION CHECKS CRUD
// =============================

export async function createTransactionCheck(check: TransactionCheck): Promise<TransactionCheck> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO transaction_checks (
        id, organization_id, name, description, steps, interval_seconds, enabled, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [check.id, check.organization_id, check.name, check.description, JSON.stringify(check.steps), check.interval, check.enabled, check.created_by, check.created_at, check.updated_at]
    );
    if (result && result.rows[0]) {
      return parseTransactionCheckRow(result.rows[0]);
    }
  }
  memoryTransactionChecks.set(check.id, check);
  return check;
}

export async function getTransactionCheck(id: string): Promise<TransactionCheck | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM transaction_checks WHERE id = $1`,
      [id]
    );
    if (result && result.rows[0]) {
      return parseTransactionCheckRow(result.rows[0]);
    }
    return undefined;
  }
  return memoryTransactionChecks.get(id);
}

export async function updateTransactionCheck(id: string, updates: Partial<TransactionCheck>): Promise<TransactionCheck | undefined> {
  const existing = await getTransactionCheck(id);
  if (!existing) return undefined;

  const updated: TransactionCheck = { ...existing, ...updates, updated_at: new Date() };

  if (isDatabaseConnected()) {
    const result = await query<any>(
      `UPDATE transaction_checks SET
        name = $2, description = $3, steps = $4, interval_seconds = $5, enabled = $6, updated_at = $7
       WHERE id = $1 RETURNING *`,
      [id, updated.name, updated.description, JSON.stringify(updated.steps), updated.interval, updated.enabled, updated.updated_at]
    );
    if (result && result.rows[0]) {
      return parseTransactionCheckRow(result.rows[0]);
    }
    return undefined;
  }
  memoryTransactionChecks.set(id, updated);
  return updated;
}

export async function deleteTransactionCheck(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(`DELETE FROM transaction_checks WHERE id = $1`, [id]);
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return memoryTransactionChecks.delete(id);
}

export async function listTransactionChecks(organizationId: string): Promise<TransactionCheck[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM transaction_checks WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId]
    );
    if (result) return result.rows.map(parseTransactionCheckRow);
    return [];
  }
  return Array.from(memoryTransactionChecks.values()).filter(c => c.organization_id === organizationId);
}

function parseTransactionCheckRow(row: any): TransactionCheck {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    description: row.description,
    steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
    interval: row.interval_seconds,
    enabled: row.enabled,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}


// =============================
// TRANSACTION RESULTS CRUD
// =============================

export async function addTransactionResult(result: TransactionResult): Promise<TransactionResult> {
  if (isDatabaseConnected()) {
    const dbResult = await query<any>(
      `INSERT INTO transaction_results (id, transaction_id, status, total_time_ms, step_results, checked_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [result.id, result.transaction_id, result.status, result.total_time, JSON.stringify(result.step_results), result.checked_at]
    );
    if (dbResult && dbResult.rows[0]) {
      return parseTransactionResultRow(dbResult.rows[0]);
    }
  }
  const results = memoryTransactionResults.get(result.transaction_id) || [];
  results.push(result);
  memoryTransactionResults.set(result.transaction_id, results);
  return result;
}

export async function getTransactionResults(transactionId: string, limit: number = 100): Promise<TransactionResult[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM transaction_results WHERE transaction_id = $1 ORDER BY checked_at DESC LIMIT $2`,
      [transactionId, limit]
    );
    if (result) return result.rows.map(parseTransactionResultRow);
    return [];
  }
  const results = memoryTransactionResults.get(transactionId) || [];
  return results.slice(-limit).reverse();
}

function parseTransactionResultRow(row: any): TransactionResult {
  return {
    id: row.id,
    transaction_id: row.transaction_id,
    status: row.status,
    total_time: row.total_time_ms,
    step_results: typeof row.step_results === 'string' ? JSON.parse(row.step_results) : row.step_results,
    checked_at: new Date(row.checked_at),
  };
}


// =============================
// PERFORMANCE CHECKS CRUD
// =============================

export async function createPerformanceCheck(check: PerformanceCheck): Promise<PerformanceCheck> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO performance_checks (id, organization_id, name, url, interval_seconds, device, enabled, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [check.id, check.organization_id, check.name, check.url, check.interval, check.device, check.enabled, check.created_by, check.created_at, check.updated_at]
    );
    if (result && result.rows[0]) {
      return parsePerformanceCheckRow(result.rows[0]);
    }
  }
  memoryPerformanceChecks.set(check.id, check);
  return check;
}

export async function getPerformanceCheck(id: string): Promise<PerformanceCheck | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(`SELECT * FROM performance_checks WHERE id = $1`, [id]);
    if (result && result.rows[0]) return parsePerformanceCheckRow(result.rows[0]);
    return undefined;
  }
  return memoryPerformanceChecks.get(id);
}

export async function updatePerformanceCheck(id: string, updates: Partial<PerformanceCheck>): Promise<PerformanceCheck | undefined> {
  const existing = await getPerformanceCheck(id);
  if (!existing) return undefined;

  const updated: PerformanceCheck = { ...existing, ...updates, updated_at: new Date() };

  if (isDatabaseConnected()) {
    const result = await query<any>(
      `UPDATE performance_checks SET name = $2, url = $3, interval_seconds = $4, device = $5, enabled = $6, updated_at = $7
       WHERE id = $1 RETURNING *`,
      [id, updated.name, updated.url, updated.interval, updated.device, updated.enabled, updated.updated_at]
    );
    if (result && result.rows[0]) return parsePerformanceCheckRow(result.rows[0]);
    return undefined;
  }
  memoryPerformanceChecks.set(id, updated);
  return updated;
}

export async function deletePerformanceCheck(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(`DELETE FROM performance_checks WHERE id = $1`, [id]);
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return memoryPerformanceChecks.delete(id);
}

export async function listPerformanceChecks(organizationId: string): Promise<PerformanceCheck[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM performance_checks WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId]
    );
    if (result) return result.rows.map(parsePerformanceCheckRow);
    return [];
  }
  return Array.from(memoryPerformanceChecks.values()).filter(c => c.organization_id === organizationId);
}

function parsePerformanceCheckRow(row: any): PerformanceCheck {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    url: row.url,
    interval: row.interval_seconds,
    device: row.device,
    enabled: row.enabled,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}


// =============================
// PERFORMANCE RESULTS CRUD
// =============================

export async function addPerformanceResult(result: PerformanceResult): Promise<PerformanceResult> {
  if (isDatabaseConnected()) {
    const dbResult = await query<any>(
      `INSERT INTO performance_results (id, check_id, status, metrics, lighthouse_score, checked_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [result.id, result.check_id, result.status, JSON.stringify(result.metrics), result.lighthouse_score, result.checked_at]
    );
    if (dbResult && dbResult.rows[0]) {
      return parsePerformanceResultRow(dbResult.rows[0]);
    }
  }
  const results = memoryPerformanceResults.get(result.check_id) || [];
  results.push(result);
  memoryPerformanceResults.set(result.check_id, results);
  return result;
}

export async function getPerformanceResults(checkId: string, limit: number = 100): Promise<PerformanceResult[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM performance_results WHERE check_id = $1 ORDER BY checked_at DESC LIMIT $2`,
      [checkId, limit]
    );
    if (result) return result.rows.map(parsePerformanceResultRow);
    return [];
  }
  const results = memoryPerformanceResults.get(checkId) || [];
  return results.slice(-limit).reverse();
}

function parsePerformanceResultRow(row: any): PerformanceResult {
  return {
    id: row.id,
    check_id: row.check_id,
    status: row.status,
    metrics: typeof row.metrics === 'string' ? JSON.parse(row.metrics) : row.metrics,
    lighthouse_score: row.lighthouse_score,
    checked_at: new Date(row.checked_at),
  };
}


// =============================
// WEBHOOK CHECKS CRUD
// =============================

export async function createWebhookCheck(check: WebhookCheck): Promise<WebhookCheck> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO webhook_checks (
        id, organization_id, name, description, webhook_url, webhook_secret,
        expected_interval_seconds, expected_payload, enabled, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        check.id, check.organization_id, check.name, check.description,
        check.webhook_url, check.webhook_secret, check.expected_interval,
        JSON.stringify(check.expected_payload || null), check.enabled,
        check.created_by, check.created_at, check.updated_at
      ]
    );
    if (result && result.rows[0]) {
      return parseWebhookCheckRow(result.rows[0]);
    }
  }
  memoryWebhookChecks.set(check.id, check);
  // Also map the token to check ID
  const token = check.webhook_url.split('/').pop();
  if (token) {
    memoryWebhookTokenMap.set(token, check.id);
  }
  return check;
}

export async function getWebhookCheck(id: string): Promise<WebhookCheck | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(`SELECT * FROM webhook_checks WHERE id = $1`, [id]);
    if (result && result.rows[0]) return parseWebhookCheckRow(result.rows[0]);
    return undefined;
  }
  return memoryWebhookChecks.get(id);
}

export async function getWebhookCheckByToken(token: string): Promise<WebhookCheck | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM webhook_checks WHERE webhook_url LIKE $1`,
      [`%${token}`]
    );
    if (result && result.rows[0]) return parseWebhookCheckRow(result.rows[0]);
    return undefined;
  }
  const checkId = memoryWebhookTokenMap.get(token);
  if (checkId) return memoryWebhookChecks.get(checkId);
  return undefined;
}

export async function updateWebhookCheck(id: string, updates: Partial<WebhookCheck>): Promise<WebhookCheck | undefined> {
  const existing = await getWebhookCheck(id);
  if (!existing) return undefined;

  const updated: WebhookCheck = { ...existing, ...updates, updated_at: new Date() };

  if (isDatabaseConnected()) {
    const result = await query<any>(
      `UPDATE webhook_checks SET
        name = $2, description = $3, webhook_secret = $4,
        expected_interval_seconds = $5, expected_payload = $6, enabled = $7, updated_at = $8
       WHERE id = $1 RETURNING *`,
      [id, updated.name, updated.description, updated.webhook_secret, updated.expected_interval, JSON.stringify(updated.expected_payload || null), updated.enabled, updated.updated_at]
    );
    if (result && result.rows[0]) return parseWebhookCheckRow(result.rows[0]);
    return undefined;
  }
  memoryWebhookChecks.set(id, updated);
  return updated;
}

export async function deleteWebhookCheck(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(`DELETE FROM webhook_checks WHERE id = $1`, [id]);
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  const check = memoryWebhookChecks.get(id);
  if (check) {
    const token = check.webhook_url.split('/').pop();
    if (token) memoryWebhookTokenMap.delete(token);
  }
  return memoryWebhookChecks.delete(id);
}

export async function listWebhookChecks(organizationId: string): Promise<WebhookCheck[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM webhook_checks WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId]
    );
    if (result) return result.rows.map(parseWebhookCheckRow);
    return [];
  }
  return Array.from(memoryWebhookChecks.values()).filter(c => c.organization_id === organizationId);
}

function parseWebhookCheckRow(row: any): WebhookCheck {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    description: row.description,
    webhook_url: row.webhook_url,
    webhook_secret: row.webhook_secret,
    expected_interval: row.expected_interval_seconds,
    expected_payload: typeof row.expected_payload === 'string' ? JSON.parse(row.expected_payload) : row.expected_payload,
    enabled: row.enabled,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}


// =============================
// WEBHOOK EVENTS CRUD
// =============================

export async function addWebhookEvent(event: WebhookEvent): Promise<WebhookEvent> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO webhook_events (
        id, check_id, received_at, source_ip, headers, payload,
        payload_valid, validation_errors, signature_valid
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        event.id, event.check_id, event.received_at, event.source_ip,
        JSON.stringify(event.headers), JSON.stringify(event.payload),
        event.payload_valid, JSON.stringify(event.validation_errors || []),
        event.signature_valid
      ]
    );
    if (result && result.rows[0]) {
      return parseWebhookEventRow(result.rows[0]);
    }
  }
  const events = memoryWebhookEvents.get(event.check_id) || [];
  events.push(event);
  memoryWebhookEvents.set(event.check_id, events);
  return event;
}

export async function getWebhookEvents(checkId: string, limit: number = 100): Promise<WebhookEvent[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM webhook_events WHERE check_id = $1 ORDER BY received_at DESC LIMIT $2`,
      [checkId, limit]
    );
    if (result) return result.rows.map(parseWebhookEventRow);
    return [];
  }
  const events = memoryWebhookEvents.get(checkId) || [];
  return events.slice(-limit).reverse();
}

function parseWebhookEventRow(row: any): WebhookEvent {
  return {
    id: row.id,
    check_id: row.check_id,
    received_at: new Date(row.received_at),
    source_ip: row.source_ip,
    headers: typeof row.headers === 'string' ? JSON.parse(row.headers) : row.headers,
    payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    payload_valid: row.payload_valid,
    validation_errors: typeof row.validation_errors === 'string' ? JSON.parse(row.validation_errors) : row.validation_errors,
    signature_valid: row.signature_valid,
  };
}


// =============================
// DNS CHECKS CRUD
// =============================

export async function createDnsCheck(check: DnsCheck): Promise<DnsCheck> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO dns_checks (
        id, organization_id, name, domain, record_type, expected_values,
        nameservers, interval_seconds, timeout_ms, enabled, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        check.id, check.organization_id, check.name, check.domain, check.record_type,
        JSON.stringify(check.expected_values || []), JSON.stringify(check.nameservers || []),
        check.interval, check.timeout, check.enabled, check.created_by, check.created_at, check.updated_at
      ]
    );
    if (result && result.rows[0]) return parseDnsCheckRow(result.rows[0]);
  }
  memoryDnsChecks.set(check.id, check);
  return check;
}

export async function getDnsCheck(id: string): Promise<DnsCheck | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(`SELECT * FROM dns_checks WHERE id = $1`, [id]);
    if (result && result.rows[0]) return parseDnsCheckRow(result.rows[0]);
    return undefined;
  }
  return memoryDnsChecks.get(id);
}

export async function updateDnsCheck(id: string, updates: Partial<DnsCheck>): Promise<DnsCheck | undefined> {
  const existing = await getDnsCheck(id);
  if (!existing) return undefined;

  const updated: DnsCheck = { ...existing, ...updates, updated_at: new Date() };

  if (isDatabaseConnected()) {
    const result = await query<any>(
      `UPDATE dns_checks SET
        name = $2, domain = $3, record_type = $4, expected_values = $5,
        nameservers = $6, interval_seconds = $7, timeout_ms = $8, enabled = $9, updated_at = $10
       WHERE id = $1 RETURNING *`,
      [id, updated.name, updated.domain, updated.record_type, JSON.stringify(updated.expected_values || []), JSON.stringify(updated.nameservers || []), updated.interval, updated.timeout, updated.enabled, updated.updated_at]
    );
    if (result && result.rows[0]) return parseDnsCheckRow(result.rows[0]);
    return undefined;
  }
  memoryDnsChecks.set(id, updated);
  return updated;
}

export async function deleteDnsCheck(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(`DELETE FROM dns_checks WHERE id = $1`, [id]);
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return memoryDnsChecks.delete(id);
}

export async function listDnsChecks(organizationId: string): Promise<DnsCheck[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM dns_checks WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId]
    );
    if (result) return result.rows.map(parseDnsCheckRow);
    return [];
  }
  return Array.from(memoryDnsChecks.values()).filter(c => c.organization_id === organizationId);
}

function parseDnsCheckRow(row: any): DnsCheck {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    domain: row.domain,
    record_type: row.record_type,
    expected_values: typeof row.expected_values === 'string' ? JSON.parse(row.expected_values) : row.expected_values,
    nameservers: typeof row.nameservers === 'string' ? JSON.parse(row.nameservers) : row.nameservers,
    interval: row.interval_seconds,
    timeout: row.timeout_ms,
    enabled: row.enabled,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}


// =============================
// DNS RESULTS CRUD
// =============================

export async function addDnsResult(result: DnsCheckResult): Promise<DnsCheckResult> {
  if (isDatabaseConnected()) {
    const dbResult = await query<any>(
      `INSERT INTO dns_results (
        id, check_id, status, resolved_values, expected_values, response_time_ms,
        nameserver_used, error, ttl, all_expected_found, unexpected_values, checked_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        result.id, result.check_id, result.status, JSON.stringify(result.resolved_values),
        JSON.stringify(result.expected_values), result.response_time, result.nameserver_used,
        result.error, result.ttl, result.all_expected_found, JSON.stringify(result.unexpected_values), result.checked_at
      ]
    );
    if (dbResult && dbResult.rows[0]) return parseDnsResultRow(dbResult.rows[0]);
  }
  const results = memoryDnsResults.get(result.check_id) || [];
  results.push(result);
  memoryDnsResults.set(result.check_id, results);
  return result;
}

export async function getDnsResults(checkId: string, limit: number = 100): Promise<DnsCheckResult[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM dns_results WHERE check_id = $1 ORDER BY checked_at DESC LIMIT $2`,
      [checkId, limit]
    );
    if (result) return result.rows.map(parseDnsResultRow);
    return [];
  }
  const results = memoryDnsResults.get(checkId) || [];
  return results.slice(-limit).reverse();
}

function parseDnsResultRow(row: any): DnsCheckResult {
  return {
    id: row.id,
    check_id: row.check_id,
    status: row.status,
    resolved_values: typeof row.resolved_values === 'string' ? JSON.parse(row.resolved_values) : row.resolved_values,
    expected_values: typeof row.expected_values === 'string' ? JSON.parse(row.expected_values) : row.expected_values,
    response_time: row.response_time_ms,
    nameserver_used: row.nameserver_used,
    error: row.error,
    ttl: row.ttl,
    all_expected_found: row.all_expected_found,
    unexpected_values: typeof row.unexpected_values === 'string' ? JSON.parse(row.unexpected_values) : row.unexpected_values,
    checked_at: new Date(row.checked_at),
  };
}


// =============================
// TCP CHECKS CRUD
// =============================

export async function createTcpCheck(check: TcpCheck): Promise<TcpCheck> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO tcp_checks (
        id, organization_id, name, host, port, timeout_ms, interval_seconds, enabled, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [check.id, check.organization_id, check.name, check.host, check.port, check.timeout, check.interval, check.enabled, check.created_by, check.created_at, check.updated_at]
    );
    if (result && result.rows[0]) return parseTcpCheckRow(result.rows[0]);
  }
  memoryTcpChecks.set(check.id, check);
  return check;
}

export async function getTcpCheck(id: string): Promise<TcpCheck | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(`SELECT * FROM tcp_checks WHERE id = $1`, [id]);
    if (result && result.rows[0]) return parseTcpCheckRow(result.rows[0]);
    return undefined;
  }
  return memoryTcpChecks.get(id);
}

export async function updateTcpCheck(id: string, updates: Partial<TcpCheck>): Promise<TcpCheck | undefined> {
  const existing = await getTcpCheck(id);
  if (!existing) return undefined;

  const updated: TcpCheck = { ...existing, ...updates, updated_at: new Date() };

  if (isDatabaseConnected()) {
    const result = await query<any>(
      `UPDATE tcp_checks SET name = $2, host = $3, port = $4, timeout_ms = $5, interval_seconds = $6, enabled = $7, updated_at = $8
       WHERE id = $1 RETURNING *`,
      [id, updated.name, updated.host, updated.port, updated.timeout, updated.interval, updated.enabled, updated.updated_at]
    );
    if (result && result.rows[0]) return parseTcpCheckRow(result.rows[0]);
    return undefined;
  }
  memoryTcpChecks.set(id, updated);
  return updated;
}

export async function deleteTcpCheck(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(`DELETE FROM tcp_checks WHERE id = $1`, [id]);
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return memoryTcpChecks.delete(id);
}

export async function listTcpChecks(organizationId: string): Promise<TcpCheck[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM tcp_checks WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId]
    );
    if (result) return result.rows.map(parseTcpCheckRow);
    return [];
  }
  return Array.from(memoryTcpChecks.values()).filter(c => c.organization_id === organizationId);
}

function parseTcpCheckRow(row: any): TcpCheck {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    host: row.host,
    port: row.port,
    timeout: row.timeout_ms,
    interval: row.interval_seconds,
    enabled: row.enabled,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}


// =============================
// TCP RESULTS CRUD
// =============================

export async function addTcpResult(result: TcpCheckResult): Promise<TcpCheckResult> {
  if (isDatabaseConnected()) {
    const dbResult = await query<any>(
      `INSERT INTO tcp_results (id, check_id, status, port_open, response_time_ms, error, checked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [result.id, result.check_id, result.status, result.port_open, result.response_time, result.error, result.checked_at]
    );
    if (dbResult && dbResult.rows[0]) return parseTcpResultRow(dbResult.rows[0]);
  }
  const results = memoryTcpResults.get(result.check_id) || [];
  results.push(result);
  memoryTcpResults.set(result.check_id, results);
  return result;
}

export async function getTcpResults(checkId: string, limit: number = 100): Promise<TcpCheckResult[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM tcp_results WHERE check_id = $1 ORDER BY checked_at DESC LIMIT $2`,
      [checkId, limit]
    );
    if (result) return result.rows.map(parseTcpResultRow);
    return [];
  }
  const results = memoryTcpResults.get(checkId) || [];
  return results.slice(-limit).reverse();
}

function parseTcpResultRow(row: any): TcpCheckResult {
  return {
    id: row.id,
    check_id: row.check_id,
    status: row.status,
    port_open: row.port_open,
    response_time: row.response_time_ms,
    error: row.error,
    checked_at: new Date(row.checked_at),
  };
}


// =============================
// STATUS PAGES CRUD
// =============================

export async function createStatusPage(page: StatusPage): Promise<StatusPage> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
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
  memoryStatusPages.set(page.id, page);
  memoryStatusPagesBySlug.set(page.slug, page.id);
  return page;
}

export async function getStatusPage(id: string): Promise<StatusPage | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(`SELECT * FROM status_pages WHERE id = $1`, [id]);
    if (result && result.rows[0]) return parseStatusPageRow(result.rows[0]);
    return undefined;
  }
  return memoryStatusPages.get(id);
}

export async function getStatusPageBySlug(slug: string): Promise<StatusPage | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(`SELECT * FROM status_pages WHERE slug = $1`, [slug]);
    if (result && result.rows[0]) return parseStatusPageRow(result.rows[0]);
    return undefined;
  }
  const id = memoryStatusPagesBySlug.get(slug);
  if (id) return memoryStatusPages.get(id);
  return undefined;
}

export async function updateStatusPage(id: string, updates: Partial<StatusPage>): Promise<StatusPage | undefined> {
  const existing = await getStatusPage(id);
  if (!existing) return undefined;

  const updated: StatusPage = { ...existing, ...updates, updated_at: new Date() };

  if (isDatabaseConnected()) {
    const result = await query<any>(
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
  // Update slug mapping if slug changed
  if (existing.slug !== updated.slug) {
    memoryStatusPagesBySlug.delete(existing.slug);
    memoryStatusPagesBySlug.set(updated.slug, id);
  }
  memoryStatusPages.set(id, updated);
  return updated;
}

export async function deleteStatusPage(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(`DELETE FROM status_pages WHERE id = $1`, [id]);
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  const page = memoryStatusPages.get(id);
  if (page) {
    memoryStatusPagesBySlug.delete(page.slug);
  }
  return memoryStatusPages.delete(id);
}

export async function listStatusPages(organizationId: string): Promise<StatusPage[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM status_pages WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId]
    );
    if (result) return result.rows.map(parseStatusPageRow);
    return [];
  }
  return Array.from(memoryStatusPages.values()).filter(p => p.organization_id === organizationId);
}

function parseStatusPageRow(row: any): StatusPage {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    logo_url: row.logo_url,
    favicon_url: row.favicon_url,
    primary_color: row.primary_color,
    show_history_days: row.show_history_days,
    checks: typeof row.checks === 'string' ? JSON.parse(row.checks) : row.checks,
    custom_domain: row.custom_domain,
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
    const result = await query<any>(
      `SELECT * FROM monitoring_settings WHERE organization_id = $1`,
      [orgId]
    );
    if (result && result.rows[0]) return parseMonitoringSettingsRow(result.rows[0]);
    return undefined;
  }
  return memoryMonitoringSettings.get(orgId);
}

export async function setMonitoringSettings(settings: MonitoringSettings): Promise<MonitoringSettings> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO monitoring_settings (organization_id, retention_days, auto_cleanup_enabled, last_cleanup_at, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (organization_id) DO UPDATE SET
         retention_days = $2, auto_cleanup_enabled = $3, last_cleanup_at = $4, updated_by = $5, updated_at = $6
       RETURNING *`,
      [settings.organization_id, settings.retention_days, settings.auto_cleanup_enabled, settings.last_cleanup_at, settings.updated_by, settings.updated_at]
    );
    if (result && result.rows[0]) return parseMonitoringSettingsRow(result.rows[0]);
  }
  memoryMonitoringSettings.set(settings.organization_id, settings);
  return settings;
}

function parseMonitoringSettingsRow(row: any): MonitoringSettings {
  return {
    organization_id: row.organization_id,
    retention_days: row.retention_days,
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
  memoryDeletedCheckHistory.set(history.check_id, history);
  return history;
}

export async function getDeletedCheckHistory(checkId: string): Promise<DeletedCheckHistory | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM deleted_check_history WHERE check_id = $1`,
      [checkId]
    );
    if (result && result.rows[0]) {
      return {
        check_id: result.rows[0].check_id,
        check_name: result.rows[0].check_name,
        check_type: result.rows[0].check_type,
        organization_id: result.rows[0].organization_id,
        deleted_by: result.rows[0].deleted_by,
        deleted_at: new Date(result.rows[0].deleted_at),
        check_config: typeof result.rows[0].check_config === 'string' ? JSON.parse(result.rows[0].check_config) : result.rows[0].check_config,
        historical_results_count: result.rows[0].historical_results_count,
        last_status: result.rows[0].last_status,
      };
    }
    return undefined;
  }
  return memoryDeletedCheckHistory.get(checkId);
}


// =============================
// MEMORY STORE ACCESS (for compatibility)
// =============================

// Provide direct access to memory stores for use in stores.ts exports
export function getMemoryUptimeChecks(): Map<string, UptimeCheck> { return memoryUptimeChecks; }
export function getMemoryCheckResults(): Map<string, CheckResult[]> { return memoryCheckResults; }
export function getMemoryTransactionChecks(): Map<string, TransactionCheck> { return memoryTransactionChecks; }
export function getMemoryTransactionResults(): Map<string, TransactionResult[]> { return memoryTransactionResults; }
export function getMemoryPerformanceChecks(): Map<string, PerformanceCheck> { return memoryPerformanceChecks; }
export function getMemoryPerformanceResults(): Map<string, PerformanceResult[]> { return memoryPerformanceResults; }
export function getMemoryMaintenanceWindows(): Map<string, MaintenanceWindow[]> { return memoryMaintenanceWindows; }
export function getMemoryCheckIncidents(): Map<string, Incident[]> { return memoryCheckIncidents; }
export function getMemoryActiveIncidents(): Map<string, Incident> { return memoryActiveIncidents; }
export function getMemoryConsecutiveFailures(): Map<string, number> { return memoryConsecutiveFailures; }
export function getMemoryWebhookChecks(): Map<string, WebhookCheck> { return memoryWebhookChecks; }
export function getMemoryWebhookEvents(): Map<string, WebhookEvent[]> { return memoryWebhookEvents; }
export function getMemoryWebhookTokenMap(): Map<string, string> { return memoryWebhookTokenMap; }
export function getMemoryDnsChecks(): Map<string, DnsCheck> { return memoryDnsChecks; }
export function getMemoryDnsResults(): Map<string, DnsCheckResult[]> { return memoryDnsResults; }
export function getMemoryTcpChecks(): Map<string, TcpCheck> { return memoryTcpChecks; }
export function getMemoryTcpResults(): Map<string, TcpCheckResult[]> { return memoryTcpResults; }
export function getMemoryMonitoringSettings(): Map<string, MonitoringSettings> { return memoryMonitoringSettings; }
export function getMemoryStatusPages(): Map<string, StatusPage> { return memoryStatusPages; }
export function getMemoryStatusPagesBySlug(): Map<string, string> { return memoryStatusPagesBySlug; }
export function getMemoryStatusPageIncidents(): Map<string, StatusPageIncident[]> { return memoryStatusPageIncidents; }
export function getMemoryStatusPageSubscriptions(): Map<string, StatusPageSubscription[]> { return memoryStatusPageSubscriptions; }
export function getMemoryOnCallSchedules(): Map<string, OnCallSchedule> { return memoryOnCallSchedules; }
export function getMemoryEscalationPolicies(): Map<string, EscalationPolicy> { return memoryEscalationPolicies; }
export function getMemoryDeletedCheckHistory(): Map<string, DeletedCheckHistory> { return memoryDeletedCheckHistory; }
export function getMemoryAlertGroupingRules(): Map<string, AlertGroupingRule> { return memoryAlertGroupingRules; }
export function getMemoryAlertGroups(): Map<string, AlertGroup> { return memoryAlertGroups; }
export function getMemoryAlertRoutingRules(): Map<string, AlertRoutingRule> { return memoryAlertRoutingRules; }
export function getMemoryAlertRoutingLogs(): Map<string, AlertRoutingLog[]> { return memoryAlertRoutingLogs; }
export function getMemoryAlertRateLimitConfigs(): Map<string, AlertRateLimitConfig> { return memoryAlertRateLimitConfigs; }
export function getMemoryAlertRateLimitStates(): Map<string, AlertRateLimitState> { return memoryAlertRateLimitStates; }
export function getMemoryAlertCorrelationConfigs(): Map<string, AlertCorrelationConfig> { return memoryAlertCorrelationConfigs; }
export function getMemoryAlertCorrelations(): Map<string, AlertCorrelation> { return memoryAlertCorrelations; }
export function getMemoryAlertToCorrelation(): Map<string, string> { return memoryAlertToCorrelation; }
export function getMemoryAlertRunbooks(): Map<string, AlertRunbook> { return memoryAlertRunbooks; }
export function getMemoryManagedIncidents(): Map<string, ManagedIncident> { return memoryManagedIncidents; }
export function getMemoryIncidentsByOrg(): Map<string, string[]> { return memoryIncidentsByOrg; }
