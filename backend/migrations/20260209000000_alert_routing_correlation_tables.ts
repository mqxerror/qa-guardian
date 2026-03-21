/**
 * Migration: Alert Routing, Correlation, Rate Limiting, and Runbook Tables
 *
 * Creates tables for:
 * - alert_routing_rules: Alert routing rule definitions
 * - alert_routing_logs: Audit log of routed alerts
 * - alert_rate_limit_configs: Per-org rate limit configuration
 * - alert_rate_limit_states: Per-org rate limit runtime state
 * - alert_correlation_configs: Per-org correlation configuration
 * - alert_correlations: Correlated alert groups
 * - alert_runbooks: Runbook definitions linked to alert types
 *
 * NOTE: All operations are idempotent. Tables may already exist from
 * service-level CREATE TABLE IF NOT EXISTS with a different schema.
 * Columns are defensively added to handle schema drift.
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

function ensureColumns(
  pgm: MigrationBuilder,
  table: string,
  columns: Array<{ name: string; type: string; notNull?: boolean; default?: string }>
): void {
  for (const col of columns) {
    const parts = [`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`];
    if (col.default !== undefined) {
      parts.push(`DEFAULT ${col.default}`);
    }
    if (col.notNull && col.default !== undefined) {
      parts.push('NOT NULL');
    }
    pgm.sql(parts.join(' ') + ';');
  }
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ============================================================================
  // Alert Routing Rules Table
  // ============================================================================
  pgm.createTable('alert_routing_rules', {
    id: { type: 'varchar(100)', primaryKey: true },
    organization_id: { type: 'uuid', notNull: true },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    conditions: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    condition_match: { type: 'varchar(10)', notNull: true, default: "'all'" },
    destinations: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    enabled: { type: 'boolean', notNull: true, default: true },
    priority: { type: 'integer', notNull: true, default: 0 },
    created_by: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'alert_routing_rules', [
    { name: 'organization_id', type: 'uuid' },
    { name: 'name', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'description', type: 'text' },
    { name: 'conditions', type: 'jsonb', notNull: true, default: "'[]'::jsonb" },
    { name: 'condition_match', type: 'varchar(10)', notNull: true, default: "'all'" },
    { name: 'destinations', type: 'jsonb', notNull: true, default: "'[]'::jsonb" },
    { name: 'enabled', type: 'boolean', notNull: true, default: 'true' },
    { name: 'priority', type: 'integer', notNull: true, default: '0' },
    { name: 'created_by', type: 'varchar(255)', notNull: true, default: "'system'" },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  pgm.createIndex('alert_routing_rules', 'organization_id', { ifNotExists: true, name: 'idx_alert_routing_rules_org' });
  pgm.createIndex('alert_routing_rules', ['organization_id', 'priority'], { ifNotExists: true, name: 'idx_alert_routing_rules_org_priority' });

  // ============================================================================
  // Alert Routing Logs Table
  // ============================================================================
  pgm.createTable('alert_routing_logs', {
    id: { type: 'varchar(100)', primaryKey: true },
    organization_id: { type: 'uuid', notNull: true },
    rule_id: { type: 'varchar(100)', notNull: true },
    rule_name: { type: 'varchar(255)', notNull: true },
    alert_id: { type: 'varchar(100)', notNull: true },
    check_name: { type: 'varchar(255)', notNull: true },
    check_type: { type: 'varchar(50)', notNull: true },
    severity: { type: 'varchar(20)', notNull: true },
    destinations_notified: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    notification_status: { type: 'varchar(20)', notNull: true, default: "'sent'" },
    error_message: { type: 'text' },
    routed_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'alert_routing_logs', [
    { name: 'organization_id', type: 'uuid' },
    { name: 'rule_id', type: 'varchar(100)', notNull: true, default: "''" },
    { name: 'rule_name', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'alert_id', type: 'varchar(100)', notNull: true, default: "''" },
    { name: 'check_name', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'check_type', type: 'varchar(50)', notNull: true, default: "''" },
    { name: 'severity', type: 'varchar(20)', notNull: true, default: "''" },
    { name: 'destinations_notified', type: 'jsonb', notNull: true, default: "'[]'::jsonb" },
    { name: 'notification_status', type: 'varchar(20)', notNull: true, default: "'sent'" },
    { name: 'error_message', type: 'text' },
    { name: 'routed_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  pgm.createIndex('alert_routing_logs', 'organization_id', { ifNotExists: true, name: 'idx_alert_routing_logs_org' });
  pgm.createIndex('alert_routing_logs', [{ name: 'routed_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_alert_routing_logs_routed' });
  pgm.createIndex('alert_routing_logs', ['organization_id', { name: 'routed_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_alert_routing_logs_org_routed' });

  // ============================================================================
  // Alert Rate Limit Configs Table
  // ============================================================================
  pgm.createTable('alert_rate_limit_configs', {
    organization_id: { type: 'uuid', primaryKey: true },
    enabled: { type: 'boolean', notNull: true, default: true },
    max_alerts_per_minute: { type: 'integer', notNull: true, default: 5 },
    time_window_seconds: { type: 'integer', notNull: true, default: 60 },
    suppression_mode: { type: 'varchar(20)', notNull: true, default: "'aggregate'" },
    aggregate_threshold: { type: 'integer', notNull: true, default: 10 },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'alert_rate_limit_configs', [
    { name: 'enabled', type: 'boolean', notNull: true, default: 'true' },
    { name: 'max_alerts_per_minute', type: 'integer', notNull: true, default: '5' },
    { name: 'time_window_seconds', type: 'integer', notNull: true, default: '60' },
    { name: 'suppression_mode', type: 'varchar(20)', notNull: true, default: "'aggregate'" },
    { name: 'aggregate_threshold', type: 'integer', notNull: true, default: '10' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  // ============================================================================
  // Alert Rate Limit States Table
  // ============================================================================
  pgm.createTable('alert_rate_limit_states', {
    organization_id: { type: 'uuid', primaryKey: true },
    alerts_in_window: { type: 'integer', notNull: true, default: 0 },
    window_start: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    suppressed_alerts: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    total_alerts: { type: 'integer', notNull: true, default: 0 },
    sent_alerts: { type: 'integer', notNull: true, default: 0 },
    suppressed_count: { type: 'integer', notNull: true, default: 0 },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'alert_rate_limit_states', [
    { name: 'alerts_in_window', type: 'integer', notNull: true, default: '0' },
    { name: 'window_start', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'suppressed_alerts', type: 'jsonb', notNull: true, default: "'[]'::jsonb" },
    { name: 'total_alerts', type: 'integer', notNull: true, default: '0' },
    { name: 'sent_alerts', type: 'integer', notNull: true, default: '0' },
    { name: 'suppressed_count', type: 'integer', notNull: true, default: '0' },
  ]);

  // ============================================================================
  // Alert Correlation Configs Table
  // ============================================================================
  pgm.createTable('alert_correlation_configs', {
    organization_id: { type: 'uuid', primaryKey: true },
    enabled: { type: 'boolean', notNull: true, default: false },
    correlate_by_check: { type: 'boolean', notNull: true, default: true },
    correlate_by_location: { type: 'boolean', notNull: true, default: true },
    correlate_by_error_type: { type: 'boolean', notNull: true, default: true },
    correlate_by_time_window: { type: 'boolean', notNull: true, default: true },
    time_window_seconds: { type: 'integer', notNull: true, default: 300 },
    similarity_threshold: { type: 'integer', notNull: true, default: 60 },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'alert_correlation_configs', [
    { name: 'enabled', type: 'boolean', notNull: true, default: 'false' },
    { name: 'correlate_by_check', type: 'boolean', notNull: true, default: 'true' },
    { name: 'correlate_by_location', type: 'boolean', notNull: true, default: 'true' },
    { name: 'correlate_by_error_type', type: 'boolean', notNull: true, default: 'true' },
    { name: 'correlate_by_time_window', type: 'boolean', notNull: true, default: 'true' },
    { name: 'time_window_seconds', type: 'integer', notNull: true, default: '300' },
    { name: 'similarity_threshold', type: 'integer', notNull: true, default: '60' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  // ============================================================================
  // Alert Correlations Table
  // ============================================================================
  pgm.createTable('alert_correlations', {
    id: { type: 'varchar(100)', primaryKey: true },
    organization_id: { type: 'uuid', notNull: true },
    correlation_reason: { type: 'varchar(50)', notNull: true },
    correlation_details: { type: 'text' },
    alerts: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    primary_alert_id: { type: 'varchar(100)', notNull: true },
    status: { type: 'varchar(20)', notNull: true, default: "'active'" },
    acknowledged_by: { type: 'varchar(255)' },
    acknowledged_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'alert_correlations', [
    { name: 'organization_id', type: 'uuid' },
    { name: 'correlation_reason', type: 'varchar(50)', notNull: true, default: "''" },
    { name: 'correlation_details', type: 'text' },
    { name: 'alerts', type: 'jsonb', notNull: true, default: "'[]'::jsonb" },
    { name: 'primary_alert_id', type: 'varchar(100)', notNull: true, default: "''" },
    { name: 'status', type: 'varchar(20)', notNull: true, default: "'active'" },
    { name: 'acknowledged_by', type: 'varchar(255)' },
    { name: 'acknowledged_at', type: 'timestamptz' },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  pgm.createIndex('alert_correlations', 'organization_id', { ifNotExists: true, name: 'idx_alert_correlations_org' });
  pgm.createIndex('alert_correlations', 'status', { ifNotExists: true, name: 'idx_alert_correlations_status' });
  pgm.createIndex('alert_correlations', ['organization_id', 'status'], { ifNotExists: true, name: 'idx_alert_correlations_org_status' });

  // ============================================================================
  // Alert Runbooks Table
  // ============================================================================
  pgm.createTable('alert_runbooks', {
    id: { type: 'varchar(100)', primaryKey: true },
    organization_id: { type: 'uuid', notNull: true },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    check_type: { type: 'varchar(50)', notNull: true, default: "'all'" },
    severity: { type: 'varchar(20)', default: "'all'" },
    runbook_url: { type: 'text', notNull: true },
    instructions: { type: 'text' },
    tags: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    trigger_conditions: { type: 'jsonb' },
    steps: { type: 'jsonb' },
    created_by: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'alert_runbooks', [
    { name: 'organization_id', type: 'uuid' },
    { name: 'name', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'description', type: 'text' },
    { name: 'check_type', type: 'varchar(50)', notNull: true, default: "'all'" },
    { name: 'severity', type: 'varchar(20)', default: "'all'" },
    { name: 'runbook_url', type: 'text', notNull: true, default: "''" },
    { name: 'instructions', type: 'text' },
    { name: 'tags', type: 'jsonb', default: "'[]'::jsonb" },
    { name: 'trigger_conditions', type: 'jsonb' },
    { name: 'steps', type: 'jsonb' },
    { name: 'created_by', type: 'varchar(255)', notNull: true, default: "'system'" },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  pgm.createIndex('alert_runbooks', 'organization_id', { ifNotExists: true, name: 'idx_alert_runbooks_org' });
  pgm.createIndex('alert_runbooks', ['organization_id', 'check_type'], { ifNotExists: true, name: 'idx_alert_runbooks_org_check_type' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('alert_runbooks', { ifExists: true, cascade: true });
  pgm.dropTable('alert_correlations', { ifExists: true, cascade: true });
  pgm.dropTable('alert_correlation_configs', { ifExists: true, cascade: true });
  pgm.dropTable('alert_rate_limit_states', { ifExists: true, cascade: true });
  pgm.dropTable('alert_rate_limit_configs', { ifExists: true, cascade: true });
  pgm.dropTable('alert_routing_logs', { ifExists: true, cascade: true });
  pgm.dropTable('alert_routing_rules', { ifExists: true, cascade: true });
}
