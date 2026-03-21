/**
 * Migration: Alert Grouping Tables
 * Feature #2118: Migrate alert grouping from in-memory Maps to PostgreSQL
 *
 * Creates tables for:
 * - alert_grouping_rules: Rules that define how alerts are grouped
 * - alert_groups: Groups of alerts created by applying grouping rules
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
  // Alert Grouping Rules Table
  // ============================================================================
  pgm.createTable('alert_grouping_rules', {
    id: { type: 'varchar(100)', primaryKey: true },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations(id)', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    group_by: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    time_window_minutes: { type: 'integer', notNull: true, default: 5 },
    deduplication_enabled: { type: 'boolean', notNull: true, default: true },
    deduplication_key: { type: 'varchar(255)', default: "'check_id'" },
    max_alerts_per_group: { type: 'integer', notNull: true, default: 100 },
    notification_delay_seconds: { type: 'integer', notNull: true, default: 30 },
    is_active: { type: 'boolean', notNull: true, default: true },
    priority: { type: 'integer', notNull: true, default: 0 },
    created_by: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'alert_grouping_rules', [
    { name: 'organization_id', type: 'uuid' },
    { name: 'name', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'description', type: 'text' },
    { name: 'group_by', type: 'jsonb', notNull: true, default: "'[]'::jsonb" },
    { name: 'time_window_minutes', type: 'integer', notNull: true, default: '5' },
    { name: 'deduplication_enabled', type: 'boolean', notNull: true, default: 'true' },
    { name: 'deduplication_key', type: 'varchar(255)', default: "'check_id'" },
    { name: 'max_alerts_per_group', type: 'integer', notNull: true, default: '100' },
    { name: 'notification_delay_seconds', type: 'integer', notNull: true, default: '30' },
    { name: 'is_active', type: 'boolean', notNull: true, default: 'true' },
    { name: 'priority', type: 'integer', notNull: true, default: '0' },
    { name: 'created_by', type: 'varchar(255)', notNull: true, default: "'system'" },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  pgm.createIndex('alert_grouping_rules', 'organization_id', { ifNotExists: true, name: 'idx_alert_grouping_rules_org' });
  pgm.createIndex('alert_grouping_rules', ['organization_id', 'is_active'], { ifNotExists: true, name: 'idx_alert_grouping_rules_org_active' });
  pgm.createIndex('alert_grouping_rules', ['organization_id', 'priority'], { ifNotExists: true, name: 'idx_alert_grouping_rules_org_priority' });

  // ============================================================================
  // Alert Groups Table
  // ============================================================================
  pgm.createTable('alert_groups', {
    id: { type: 'varchar(100)', primaryKey: true },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations(id)', onDelete: 'CASCADE' },
    rule_id: { type: 'varchar(100)', notNull: true },
    group_key: { type: 'varchar(500)', notNull: true },
    alerts: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    status: { type: 'varchar(20)', notNull: true, default: "'active'" },
    severity: { type: 'varchar(20)' },
    first_alert_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    last_alert_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    notification_sent: { type: 'boolean', notNull: true, default: false },
    notification_sent_at: { type: 'timestamptz' },
    acknowledged_by: { type: 'varchar(255)' },
    acknowledged_at: { type: 'timestamptz' },
    resolved_at: { type: 'timestamptz' },
    resolved_by: { type: 'varchar(255)' },
    resolution_notes: { type: 'text' },
    resolution_time_seconds: { type: 'integer' },
    snoozed_until: { type: 'timestamptz' },
    snoozed_by: { type: 'varchar(255)' },
    snoozed_at: { type: 'timestamptz' },
    snooze_duration_hours: { type: 'integer' },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'alert_groups', [
    { name: 'organization_id', type: 'uuid' },
    { name: 'rule_id', type: 'varchar(100)', notNull: true, default: "''" },
    { name: 'group_key', type: 'varchar(500)', notNull: true, default: "''" },
    { name: 'alerts', type: 'jsonb', notNull: true, default: "'[]'::jsonb" },
    { name: 'status', type: 'varchar(20)', notNull: true, default: "'active'" },
    { name: 'severity', type: 'varchar(20)' },
    { name: 'first_alert_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'last_alert_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'notification_sent', type: 'boolean', notNull: true, default: 'false' },
    { name: 'notification_sent_at', type: 'timestamptz' },
    { name: 'acknowledged_by', type: 'varchar(255)' },
    { name: 'acknowledged_at', type: 'timestamptz' },
    { name: 'resolved_at', type: 'timestamptz' },
    { name: 'resolved_by', type: 'varchar(255)' },
    { name: 'resolution_notes', type: 'text' },
    { name: 'resolution_time_seconds', type: 'integer' },
    { name: 'snoozed_until', type: 'timestamptz' },
    { name: 'snoozed_by', type: 'varchar(255)' },
    { name: 'snoozed_at', type: 'timestamptz' },
    { name: 'snooze_duration_hours', type: 'integer' },
  ]);

  pgm.createIndex('alert_groups', 'organization_id', { ifNotExists: true, name: 'idx_alert_groups_org' });
  pgm.createIndex('alert_groups', ['organization_id', 'status'], { ifNotExists: true, name: 'idx_alert_groups_org_status' });
  pgm.createIndex('alert_groups', [{ name: 'last_alert_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_alert_groups_last_alert' });
  pgm.createIndex('alert_groups', ['organization_id', 'rule_id', 'group_key', 'status'], { ifNotExists: true, name: 'idx_alert_groups_lookup' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('alert_groups', { ifExists: true, cascade: true });
  pgm.dropTable('alert_grouping_rules', { ifExists: true, cascade: true });
}
