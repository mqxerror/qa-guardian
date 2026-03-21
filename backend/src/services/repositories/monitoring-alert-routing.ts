/**
 * Monitoring Alert Routing Repository - Database CRUD operations
 *
 * Provides async DB functions for:
 * - Alert routing rules
 * - Alert routing logs
 * - Alert rate limit configs and states
 * - Alert correlation configs and correlations
 * - Alert-to-correlation mapping (stored as column on alert_correlations)
 * - Alert runbooks
 *
 * Migrated from in-memory Maps to PostgreSQL persistence.
 */

import { query, isDatabaseConnected } from '../database.js';
import {
  AlertRoutingRule,
  AlertRoutingLog,
  AlertRateLimitConfig,
  AlertRateLimitState,
  AlertCorrelationConfig,
  AlertCorrelation,
  AlertRunbook,
} from '../../routes/monitoring/types.js';
import { safeJsonParseOrPassthrough } from '../../utils/index.js';

// ============================================
// Row interfaces for DB result typing
// ============================================

interface AlertRoutingRuleRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  conditions: string | unknown[];
  condition_match: string;
  destinations: string | unknown[];
  enabled: boolean;
  priority: number;
  created_by: string;
  created_at: string | Date;
  updated_at: string | Date;
}

interface AlertRoutingLogRow {
  id: string;
  organization_id: string;
  rule_id: string;
  rule_name: string;
  alert_id: string;
  check_name: string;
  check_type: string;
  severity: string;
  destinations_notified: string | string[];
  notification_status: string;
  error_message: string | null;
  routed_at: string | Date;
}

interface AlertRateLimitConfigRow {
  organization_id: string;
  enabled: boolean;
  max_alerts_per_minute: number;
  time_window_seconds: number;
  suppression_mode: string;
  aggregate_threshold: number;
  updated_at: string | Date;
}

interface AlertRateLimitStateRow {
  organization_id: string;
  alerts_in_window: number;
  window_start: string | Date;
  suppressed_alerts: string | unknown[];
  total_alerts: number;
  sent_alerts: number;
  suppressed_count: number;
}

interface AlertCorrelationConfigRow {
  organization_id: string;
  enabled: boolean;
  correlate_by_check: boolean;
  correlate_by_location: boolean;
  correlate_by_error_type: boolean;
  correlate_by_time_window: boolean;
  time_window_seconds: number;
  similarity_threshold: number;
  updated_at: string | Date;
}

interface AlertCorrelationRow {
  id: string;
  organization_id: string;
  correlation_reason: string;
  correlation_details: string | null;
  alerts: string | unknown[];
  primary_alert_id: string;
  status: string;
  acknowledged_by: string | null;
  acknowledged_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

interface AlertRunbookRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  check_type: string;
  severity: string | null;
  runbook_url: string;
  instructions: string | null;
  tags: string | string[];
  trigger_conditions: string | Record<string, unknown> | null;
  steps: string | unknown[] | null;
  created_by: string;
  created_at: string | Date;
  updated_at: string | Date;
}

// ============================================
// Row parsers
// ============================================

function parseRoutingRuleRow(row: AlertRoutingRuleRow): AlertRoutingRule {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    description: row.description ?? undefined,
    conditions: safeJsonParseOrPassthrough(row.conditions, []) as AlertRoutingRule['conditions'],
    condition_match: row.condition_match as AlertRoutingRule['condition_match'],
    destinations: safeJsonParseOrPassthrough(row.destinations, []) as AlertRoutingRule['destinations'],
    enabled: row.enabled,
    priority: row.priority,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

function parseRoutingLogRow(row: AlertRoutingLogRow): AlertRoutingLog {
  return {
    id: row.id,
    organization_id: row.organization_id,
    rule_id: row.rule_id,
    rule_name: row.rule_name,
    alert_id: row.alert_id,
    check_name: row.check_name,
    check_type: row.check_type,
    severity: row.severity,
    destinations_notified: safeJsonParseOrPassthrough(row.destinations_notified, []) as string[],
    notification_status: row.notification_status as AlertRoutingLog['notification_status'],
    error_message: row.error_message ?? undefined,
    routed_at: new Date(row.routed_at),
  };
}

function parseRateLimitConfigRow(row: AlertRateLimitConfigRow): AlertRateLimitConfig {
  return {
    organization_id: row.organization_id,
    enabled: row.enabled,
    max_alerts_per_minute: row.max_alerts_per_minute,
    time_window_seconds: row.time_window_seconds,
    suppression_mode: row.suppression_mode as AlertRateLimitConfig['suppression_mode'],
    aggregate_threshold: row.aggregate_threshold,
    updated_at: new Date(row.updated_at),
  };
}

function parseRateLimitStateRow(row: AlertRateLimitStateRow): AlertRateLimitState {
  return {
    organization_id: row.organization_id,
    alerts_in_window: row.alerts_in_window,
    window_start: new Date(row.window_start),
    suppressed_alerts: safeJsonParseOrPassthrough(row.suppressed_alerts, []) as AlertRateLimitState['suppressed_alerts'],
    total_alerts: row.total_alerts,
    sent_alerts: row.sent_alerts,
    suppressed_count: row.suppressed_count,
  };
}

function parseCorrelationConfigRow(row: AlertCorrelationConfigRow): AlertCorrelationConfig {
  return {
    organization_id: row.organization_id,
    enabled: row.enabled,
    correlate_by_check: row.correlate_by_check,
    correlate_by_location: row.correlate_by_location,
    correlate_by_error_type: row.correlate_by_error_type,
    correlate_by_time_window: row.correlate_by_time_window,
    time_window_seconds: row.time_window_seconds,
    similarity_threshold: row.similarity_threshold,
    updated_at: new Date(row.updated_at),
  };
}

function parseCorrelationRow(row: AlertCorrelationRow): AlertCorrelation {
  const alerts = safeJsonParseOrPassthrough(row.alerts, []) as AlertCorrelation['alerts'];
  // Ensure triggered_at fields are Date objects
  for (const alert of alerts) {
    if (typeof alert.triggered_at === 'string') {
      alert.triggered_at = new Date(alert.triggered_at);
    }
  }
  return {
    id: row.id,
    organization_id: row.organization_id,
    correlation_reason: row.correlation_reason as AlertCorrelation['correlation_reason'],
    correlation_details: row.correlation_details ?? '',
    alerts,
    primary_alert_id: row.primary_alert_id,
    status: row.status as AlertCorrelation['status'],
    acknowledged_by: row.acknowledged_by ?? undefined,
    acknowledged_at: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

function parseRunbookRow(row: AlertRunbookRow): AlertRunbook {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    description: row.description ?? undefined,
    check_type: row.check_type as AlertRunbook['check_type'],
    severity: (row.severity ?? 'all') as AlertRunbook['severity'],
    runbook_url: row.runbook_url,
    instructions: row.instructions ?? undefined,
    tags: safeJsonParseOrPassthrough(row.tags, []) as string[],
    trigger_conditions: row.trigger_conditions
      ? safeJsonParseOrPassthrough(row.trigger_conditions, undefined) as AlertRunbook['trigger_conditions']
      : undefined,
    steps: row.steps
      ? safeJsonParseOrPassthrough(row.steps, undefined) as AlertRunbook['steps']
      : undefined,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

// =============================
// ALERT ROUTING RULES CRUD
// =============================

export async function createAlertRoutingRule(rule: AlertRoutingRule): Promise<AlertRoutingRule> {
  if (isDatabaseConnected()) {
    const result = await query<AlertRoutingRuleRow>(
      `INSERT INTO alert_routing_rules (
        id, organization_id, name, description, conditions, condition_match,
        destinations, enabled, priority, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        rule.id, rule.organization_id, rule.name, rule.description ?? null,
        JSON.stringify(rule.conditions), rule.condition_match,
        JSON.stringify(rule.destinations), rule.enabled, rule.priority,
        rule.created_by, rule.created_at, rule.updated_at,
      ]
    );
    if (result && result.rows[0]) return parseRoutingRuleRow(result.rows[0]);
  }
  return rule;
}

export async function getAlertRoutingRule(id: string): Promise<AlertRoutingRule | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<AlertRoutingRuleRow>(
      `SELECT * FROM alert_routing_rules WHERE id = $1`,
      [id]
    );
    if (result && result.rows[0]) return parseRoutingRuleRow(result.rows[0]);
    return undefined;
  }
  return undefined;
}

export async function updateAlertRoutingRule(id: string, updates: Partial<AlertRoutingRule>): Promise<AlertRoutingRule | undefined> {
  const existing = await getAlertRoutingRule(id);
  if (!existing) return undefined;

  const updated: AlertRoutingRule = { ...existing, ...updates, updated_at: new Date() };

  if (isDatabaseConnected()) {
    const result = await query<AlertRoutingRuleRow>(
      `UPDATE alert_routing_rules SET
        name = $2, description = $3, conditions = $4, condition_match = $5,
        destinations = $6, enabled = $7, priority = $8, updated_at = $9
       WHERE id = $1 RETURNING *`,
      [
        id, updated.name, updated.description ?? null,
        JSON.stringify(updated.conditions), updated.condition_match,
        JSON.stringify(updated.destinations), updated.enabled, updated.priority,
        updated.updated_at,
      ]
    );
    if (result && result.rows[0]) return parseRoutingRuleRow(result.rows[0]);
    return undefined;
  }
  return updated;
}

export async function deleteAlertRoutingRule(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(`DELETE FROM alert_routing_rules WHERE id = $1`, [id]);
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return false;
}

export async function listAlertRoutingRules(organizationId: string): Promise<AlertRoutingRule[]> {
  if (isDatabaseConnected()) {
    const result = await query<AlertRoutingRuleRow>(
      `SELECT * FROM alert_routing_rules WHERE organization_id = $1 ORDER BY priority ASC`,
      [organizationId]
    );
    if (result) return result.rows.map(parseRoutingRuleRow);
    return [];
  }
  return [];
}

/** Get the maximum priority value for an org's routing rules */
export async function getMaxAlertRoutingRulePriority(organizationId: string): Promise<number> {
  if (isDatabaseConnected()) {
    const result = await query<{ max_priority: number | null }>(
      `SELECT MAX(priority) as max_priority FROM alert_routing_rules WHERE organization_id = $1`,
      [organizationId]
    );
    if (result && result.rows[0]) return result.rows[0].max_priority ?? 0;
    return 0;
  }
  return 0;
}

// =============================
// ALERT ROUTING LOGS CRUD
// =============================

export async function addAlertRoutingLog(log: AlertRoutingLog): Promise<AlertRoutingLog> {
  if (isDatabaseConnected()) {
    const result = await query<AlertRoutingLogRow>(
      `INSERT INTO alert_routing_logs (
        id, organization_id, rule_id, rule_name, alert_id, check_name,
        check_type, severity, destinations_notified, notification_status,
        error_message, routed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        log.id, log.organization_id, log.rule_id, log.rule_name,
        log.alert_id, log.check_name, log.check_type, log.severity,
        JSON.stringify(log.destinations_notified), log.notification_status,
        log.error_message ?? null, log.routed_at,
      ]
    );
    if (result && result.rows[0]) return parseRoutingLogRow(result.rows[0]);
  }
  return log;
}

export async function listAlertRoutingLogs(organizationId: string, limit: number = 100): Promise<AlertRoutingLog[]> {
  if (isDatabaseConnected()) {
    const result = await query<AlertRoutingLogRow>(
      `SELECT * FROM alert_routing_logs WHERE organization_id = $1 ORDER BY routed_at DESC LIMIT $2`,
      [organizationId, limit]
    );
    if (result) return result.rows.map(parseRoutingLogRow);
    return [];
  }
  return [];
}

// =============================
// ALERT RATE LIMIT CONFIGS CRUD
// =============================

export async function getAlertRateLimitConfig(organizationId: string): Promise<AlertRateLimitConfig | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<AlertRateLimitConfigRow>(
      `SELECT * FROM alert_rate_limit_configs WHERE organization_id = $1`,
      [organizationId]
    );
    if (result && result.rows[0]) return parseRateLimitConfigRow(result.rows[0]);
    return undefined;
  }
  return undefined;
}

export async function setAlertRateLimitConfig(config: AlertRateLimitConfig): Promise<AlertRateLimitConfig> {
  if (isDatabaseConnected()) {
    const result = await query<AlertRateLimitConfigRow>(
      `INSERT INTO alert_rate_limit_configs (
        organization_id, enabled, max_alerts_per_minute, time_window_seconds,
        suppression_mode, aggregate_threshold, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (organization_id) DO UPDATE SET
        enabled = $2, max_alerts_per_minute = $3, time_window_seconds = $4,
        suppression_mode = $5, aggregate_threshold = $6, updated_at = $7
      RETURNING *`,
      [
        config.organization_id, config.enabled, config.max_alerts_per_minute,
        config.time_window_seconds, config.suppression_mode,
        config.aggregate_threshold, config.updated_at,
      ]
    );
    if (result && result.rows[0]) return parseRateLimitConfigRow(result.rows[0]);
  }
  return config;
}

// =============================
// ALERT RATE LIMIT STATES CRUD
// =============================

export async function getAlertRateLimitState(organizationId: string): Promise<AlertRateLimitState | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<AlertRateLimitStateRow>(
      `SELECT * FROM alert_rate_limit_states WHERE organization_id = $1`,
      [organizationId]
    );
    if (result && result.rows[0]) return parseRateLimitStateRow(result.rows[0]);
    return undefined;
  }
  return undefined;
}

export async function setAlertRateLimitState(state: AlertRateLimitState): Promise<AlertRateLimitState> {
  if (isDatabaseConnected()) {
    const result = await query<AlertRateLimitStateRow>(
      `INSERT INTO alert_rate_limit_states (
        organization_id, alerts_in_window, window_start, suppressed_alerts,
        total_alerts, sent_alerts, suppressed_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (organization_id) DO UPDATE SET
        alerts_in_window = $2, window_start = $3, suppressed_alerts = $4,
        total_alerts = $5, sent_alerts = $6, suppressed_count = $7
      RETURNING *`,
      [
        state.organization_id, state.alerts_in_window, state.window_start,
        JSON.stringify(state.suppressed_alerts), state.total_alerts,
        state.sent_alerts, state.suppressed_count,
      ]
    );
    if (result && result.rows[0]) return parseRateLimitStateRow(result.rows[0]);
  }
  return state;
}

export async function deleteAlertRateLimitState(organizationId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(`DELETE FROM alert_rate_limit_states WHERE organization_id = $1`, [organizationId]);
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return false;
}

// =============================
// ALERT CORRELATION CONFIGS CRUD
// =============================

export async function getAlertCorrelationConfig(organizationId: string): Promise<AlertCorrelationConfig | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<AlertCorrelationConfigRow>(
      `SELECT * FROM alert_correlation_configs WHERE organization_id = $1`,
      [organizationId]
    );
    if (result && result.rows[0]) return parseCorrelationConfigRow(result.rows[0]);
    return undefined;
  }
  return undefined;
}

export async function setAlertCorrelationConfig(config: AlertCorrelationConfig): Promise<AlertCorrelationConfig> {
  if (isDatabaseConnected()) {
    const result = await query<AlertCorrelationConfigRow>(
      `INSERT INTO alert_correlation_configs (
        organization_id, enabled, correlate_by_check, correlate_by_location,
        correlate_by_error_type, correlate_by_time_window, time_window_seconds,
        similarity_threshold, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (organization_id) DO UPDATE SET
        enabled = $2, correlate_by_check = $3, correlate_by_location = $4,
        correlate_by_error_type = $5, correlate_by_time_window = $6,
        time_window_seconds = $7, similarity_threshold = $8, updated_at = $9
      RETURNING *`,
      [
        config.organization_id, config.enabled, config.correlate_by_check,
        config.correlate_by_location, config.correlate_by_error_type,
        config.correlate_by_time_window, config.time_window_seconds,
        config.similarity_threshold, config.updated_at,
      ]
    );
    if (result && result.rows[0]) return parseCorrelationConfigRow(result.rows[0]);
  }
  return config;
}

// =============================
// ALERT CORRELATIONS CRUD
// =============================

export async function createAlertCorrelation(correlation: AlertCorrelation): Promise<AlertCorrelation> {
  if (isDatabaseConnected()) {
    const result = await query<AlertCorrelationRow>(
      `INSERT INTO alert_correlations (
        id, organization_id, correlation_reason, correlation_details,
        alerts, primary_alert_id, status, acknowledged_by, acknowledged_at,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        correlation.id, correlation.organization_id, correlation.correlation_reason,
        correlation.correlation_details, JSON.stringify(correlation.alerts),
        correlation.primary_alert_id, correlation.status,
        correlation.acknowledged_by ?? null, correlation.acknowledged_at ?? null,
        correlation.created_at, correlation.updated_at,
      ]
    );
    if (result && result.rows[0]) return parseCorrelationRow(result.rows[0]);
  }
  return correlation;
}

export async function getAlertCorrelation(id: string): Promise<AlertCorrelation | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<AlertCorrelationRow>(
      `SELECT * FROM alert_correlations WHERE id = $1`,
      [id]
    );
    if (result && result.rows[0]) return parseCorrelationRow(result.rows[0]);
    return undefined;
  }
  return undefined;
}

export async function updateAlertCorrelation(id: string, updates: Partial<AlertCorrelation>): Promise<AlertCorrelation | undefined> {
  const existing = await getAlertCorrelation(id);
  if (!existing) return undefined;

  const updated: AlertCorrelation = { ...existing, ...updates, updated_at: new Date() };

  if (isDatabaseConnected()) {
    const result = await query<AlertCorrelationRow>(
      `UPDATE alert_correlations SET
        correlation_reason = $2, correlation_details = $3, alerts = $4,
        primary_alert_id = $5, status = $6, acknowledged_by = $7,
        acknowledged_at = $8, updated_at = $9
       WHERE id = $1 RETURNING *`,
      [
        id, updated.correlation_reason, updated.correlation_details,
        JSON.stringify(updated.alerts), updated.primary_alert_id, updated.status,
        updated.acknowledged_by ?? null, updated.acknowledged_at ?? null,
        updated.updated_at,
      ]
    );
    if (result && result.rows[0]) return parseCorrelationRow(result.rows[0]);
    return undefined;
  }
  return updated;
}

export async function deleteAlertCorrelation(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(`DELETE FROM alert_correlations WHERE id = $1`, [id]);
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return false;
}

export async function listAlertCorrelations(
  organizationId: string,
  options?: { status?: string; limit?: number }
): Promise<AlertCorrelation[]> {
  if (isDatabaseConnected()) {
    const status = options?.status;
    const limit = options?.limit ?? 50;

    if (status) {
      const result = await query<AlertCorrelationRow>(
        `SELECT * FROM alert_correlations WHERE organization_id = $1 AND status = $2
         ORDER BY created_at DESC LIMIT $3`,
        [organizationId, status, limit]
      );
      if (result) return result.rows.map(parseCorrelationRow);
    } else {
      const result = await query<AlertCorrelationRow>(
        `SELECT * FROM alert_correlations WHERE organization_id = $1
         ORDER BY created_at DESC LIMIT $2`,
        [organizationId, limit]
      );
      if (result) return result.rows.map(parseCorrelationRow);
    }
    return [];
  }
  return [];
}

/** Delete all correlations for an organization, returns count of deleted rows */
export async function deleteAlertCorrelationsByOrg(organizationId: string): Promise<number> {
  if (isDatabaseConnected()) {
    const result = await query(
      `DELETE FROM alert_correlations WHERE organization_id = $1`,
      [organizationId]
    );
    return result ? (result.rowCount ?? 0) : 0;
  }
  return 0;
}

/**
 * Find which correlation an alert belongs to.
 * Searches alert_correlations.alerts JSONB array for the given alert ID.
 */
export async function getCorrelationIdForAlert(alertId: string): Promise<string | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<{ id: string }>(
      `SELECT id FROM alert_correlations WHERE alerts @> $1::jsonb LIMIT 1`,
      [JSON.stringify([{ id: alertId }])]
    );
    if (result && result.rows[0]) return result.rows[0].id;
    return undefined;
  }
  return undefined;
}

// =============================
// ALERT RUNBOOKS CRUD
// =============================

export async function createAlertRunbook(runbook: AlertRunbook): Promise<AlertRunbook> {
  if (isDatabaseConnected()) {
    const result = await query<AlertRunbookRow>(
      `INSERT INTO alert_runbooks (
        id, organization_id, name, description, check_type, severity,
        runbook_url, instructions, tags, trigger_conditions, steps,
        created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        runbook.id, runbook.organization_id, runbook.name,
        runbook.description ?? null, runbook.check_type,
        runbook.severity ?? 'all', runbook.runbook_url,
        runbook.instructions ?? null,
        JSON.stringify(runbook.tags ?? []),
        runbook.trigger_conditions ? JSON.stringify(runbook.trigger_conditions) : null,
        runbook.steps ? JSON.stringify(runbook.steps) : null,
        runbook.created_by, runbook.created_at, runbook.updated_at,
      ]
    );
    if (result && result.rows[0]) return parseRunbookRow(result.rows[0]);
  }
  return runbook;
}

export async function getAlertRunbook(id: string): Promise<AlertRunbook | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<AlertRunbookRow>(
      `SELECT * FROM alert_runbooks WHERE id = $1`,
      [id]
    );
    if (result && result.rows[0]) return parseRunbookRow(result.rows[0]);
    return undefined;
  }
  return undefined;
}

export async function updateAlertRunbook(id: string, updates: Partial<AlertRunbook>): Promise<AlertRunbook | undefined> {
  const existing = await getAlertRunbook(id);
  if (!existing) return undefined;

  const updated: AlertRunbook = { ...existing, ...updates, updated_at: new Date() };

  if (isDatabaseConnected()) {
    const result = await query<AlertRunbookRow>(
      `UPDATE alert_runbooks SET
        name = $2, description = $3, check_type = $4, severity = $5,
        runbook_url = $6, instructions = $7, tags = $8,
        trigger_conditions = $9, steps = $10, updated_at = $11
       WHERE id = $1 RETURNING *`,
      [
        id, updated.name, updated.description ?? null,
        updated.check_type, updated.severity ?? 'all',
        updated.runbook_url, updated.instructions ?? null,
        JSON.stringify(updated.tags ?? []),
        updated.trigger_conditions ? JSON.stringify(updated.trigger_conditions) : null,
        updated.steps ? JSON.stringify(updated.steps) : null,
        updated.updated_at,
      ]
    );
    if (result && result.rows[0]) return parseRunbookRow(result.rows[0]);
    return undefined;
  }
  return updated;
}

export async function deleteAlertRunbook(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(`DELETE FROM alert_runbooks WHERE id = $1`, [id]);
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return false;
}

export async function listAlertRunbooks(organizationId: string): Promise<AlertRunbook[]> {
  if (isDatabaseConnected()) {
    const result = await query<AlertRunbookRow>(
      `SELECT * FROM alert_runbooks WHERE organization_id = $1 ORDER BY check_type ASC, severity ASC`,
      [organizationId]
    );
    if (result) return result.rows.map(parseRunbookRow);
    return [];
  }
  return [];
}
