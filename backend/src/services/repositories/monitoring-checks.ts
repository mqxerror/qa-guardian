/**
 * Monitoring Checks Repository - Database CRUD operations for check entities
 *
 * Feature #250: Extracted from monitoring.ts (1499 lines) for better organization.
 *
 * This module handles check data including:
 * - Uptime checks and results
 * - Transaction checks and results
 * - Performance checks and results (Lighthouse)
 * - Webhook checks and events
 * - DNS checks and results
 * - TCP checks and results
 */

import { query, isDatabaseConnected } from '../database.js';
import {
  UptimeCheck,
  CheckResult,
  TransactionCheck,
  TransactionResult,
  PerformanceCheck,
  PerformanceResult,
  WebhookCheck,
  WebhookEvent,
  DnsCheck,
  DnsCheckResult,
  TcpCheck,
  TcpCheckResult,
} from '../../routes/monitoring/types.js';

// =============================
// Feature #210: Explicit Column Lists (Replace SELECT *)
// =============================

/** Columns for uptime_checks table */
const UPTIME_CHECK_COLUMNS = `
  id, organization_id, name, url, method, interval_seconds, timeout_ms,
  expected_status, headers, body, locations, assertions,
  ssl_expiry_warning_days, consecutive_failures_threshold, tags, group_name,
  enabled, paused_at, paused_by, pause_reason, pause_expires_at,
  created_by, created_at, updated_at
`.trim().replace(/\s+/g, ' ');

/** Columns for check_results table */
const CHECK_RESULT_COLUMNS = `
  id, check_id, location, status, response_time_ms, status_code,
  error, assertion_results, assertions_passed, assertions_failed,
  ssl_info, checked_at
`.trim().replace(/\s+/g, ' ');

/** Columns for transaction_checks table */
const TRANSACTION_CHECK_COLUMNS = `
  id, organization_id, name, description, steps, interval_seconds, enabled,
  created_by, created_at, updated_at
`.trim().replace(/\s+/g, ' ');

/** Columns for performance_checks table */
const PERFORMANCE_CHECK_COLUMNS = `
  id, organization_id, name, url, device, interval_seconds, enabled,
  created_by, created_at, updated_at
`.trim().replace(/\s+/g, ' ');

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
  // No DB fallback - require PostgreSQL
  throw new Error('[Monitoring Repo] Database not connected - cannot create uptime check');
}

export async function getUptimeCheck(id: string): Promise<UptimeCheck | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT ${UPTIME_CHECK_COLUMNS} FROM uptime_checks WHERE id = $1`,
      [id]
    );
    if (result && result.rows[0]) {
      return parseUptimeCheckRow(result.rows[0]);
    }
    return undefined;
  }
  return undefined;
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
  return undefined;
}

export async function deleteUptimeCheck(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      `DELETE FROM uptime_checks WHERE id = $1`,
      [id]
    );
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return false;
}

export async function listUptimeChecks(organizationId: string, limit: number = 100): Promise<UptimeCheck[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT ${UPTIME_CHECK_COLUMNS} FROM uptime_checks WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [organizationId, limit]
    );
    if (result) {
      return result.rows.map(parseUptimeCheckRow);
    }
    return [];
  }
  return [];
}

export async function getAllUptimeChecks(limit: number = 100): Promise<UptimeCheck[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(`SELECT ${UPTIME_CHECK_COLUMNS} FROM uptime_checks ORDER BY created_at DESC LIMIT $1`, [limit]);
    if (result) {
      return result.rows.map(parseUptimeCheckRow);
    }
    return [];
  }
  return [];
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
  // No DB fallback - require PostgreSQL
  throw new Error('[Monitoring Repo] Database not connected - cannot add check result');
}

export async function getCheckResults(checkId: string, limit: number = 100): Promise<CheckResult[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT ${CHECK_RESULT_COLUMNS} FROM check_results WHERE check_id = $1 ORDER BY checked_at DESC LIMIT $2`,
      [checkId, limit]
    );
    if (result) {
      return result.rows.map(parseCheckResultRow);
    }
    return [];
  }
  return [];
}

export async function getLatestCheckResult(checkId: string): Promise<CheckResult | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT ${CHECK_RESULT_COLUMNS} FROM check_results WHERE check_id = $1 ORDER BY checked_at DESC LIMIT 1`,
      [checkId]
    );
    if (result && result.rows[0]) {
      return parseCheckResultRow(result.rows[0]);
    }
    return undefined;
  }
  return undefined;
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
  return 0;
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
  // No DB fallback - require PostgreSQL
  throw new Error('[Monitoring Repo] Database not connected - cannot create transaction check');
}

export async function getTransactionCheck(id: string): Promise<TransactionCheck | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT ${TRANSACTION_CHECK_COLUMNS} FROM transaction_checks WHERE id = $1`,
      [id]
    );
    if (result && result.rows[0]) {
      return parseTransactionCheckRow(result.rows[0]);
    }
    return undefined;
  }
  return undefined;
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
  return undefined;
}

export async function deleteTransactionCheck(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(`DELETE FROM transaction_checks WHERE id = $1`, [id]);
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return false;
}

export async function listTransactionChecks(organizationId: string, limit: number = 100): Promise<TransactionCheck[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT ${TRANSACTION_CHECK_COLUMNS} FROM transaction_checks WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [organizationId, limit]
    );
    if (result) return result.rows.map(parseTransactionCheckRow);
    return [];
  }
  return [];
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
  return [];
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
  return check;
}

export async function getPerformanceCheck(id: string): Promise<PerformanceCheck | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(`SELECT ${PERFORMANCE_CHECK_COLUMNS} FROM performance_checks WHERE id = $1`, [id]);
    if (result && result.rows[0]) return parsePerformanceCheckRow(result.rows[0]);
    return undefined;
  }
  return undefined;
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
  return updated;
}

export async function deletePerformanceCheck(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(`DELETE FROM performance_checks WHERE id = $1`, [id]);
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return false;
}

export async function listPerformanceChecks(organizationId: string, limit: number = 100): Promise<PerformanceCheck[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT ${PERFORMANCE_CHECK_COLUMNS} FROM performance_checks WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [organizationId, limit]
    );
    if (result) return result.rows.map(parsePerformanceCheckRow);
    return [];
  }
  return [];
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
  return [];
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
  return check;
}

export async function getWebhookCheck(id: string): Promise<WebhookCheck | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(`SELECT * FROM webhook_checks WHERE id = $1`, [id]);
    if (result && result.rows[0]) return parseWebhookCheckRow(result.rows[0]);
    return undefined;
  }
  return undefined;
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
  return updated;
}

export async function deleteWebhookCheck(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(`DELETE FROM webhook_checks WHERE id = $1`, [id]);
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return false;
}

export async function listWebhookChecks(organizationId: string, limit: number = 100): Promise<WebhookCheck[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM webhook_checks WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [organizationId, limit]
    );
    if (result) return result.rows.map(parseWebhookCheckRow);
    return [];
  }
  return [];
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
  return [];
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
  return check;
}

export async function getDnsCheck(id: string): Promise<DnsCheck | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(`SELECT * FROM dns_checks WHERE id = $1`, [id]);
    if (result && result.rows[0]) return parseDnsCheckRow(result.rows[0]);
    return undefined;
  }
  return undefined;
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
  return updated;
}

export async function deleteDnsCheck(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(`DELETE FROM dns_checks WHERE id = $1`, [id]);
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return false;
}

export async function listDnsChecks(organizationId: string, limit: number = 100): Promise<DnsCheck[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM dns_checks WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [organizationId, limit]
    );
    if (result) return result.rows.map(parseDnsCheckRow);
    return [];
  }
  return [];
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
  return [];
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
  return check;
}

export async function getTcpCheck(id: string): Promise<TcpCheck | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(`SELECT * FROM tcp_checks WHERE id = $1`, [id]);
    if (result && result.rows[0]) return parseTcpCheckRow(result.rows[0]);
    return undefined;
  }
  return undefined;
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
  return updated;
}

export async function deleteTcpCheck(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(`DELETE FROM tcp_checks WHERE id = $1`, [id]);
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return false;
}

export async function listTcpChecks(organizationId: string, limit: number = 100): Promise<TcpCheck[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM tcp_checks WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [organizationId, limit]
    );
    if (result) return result.rows.map(parseTcpCheckRow);
    return [];
  }
  return [];
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
  return [];
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
