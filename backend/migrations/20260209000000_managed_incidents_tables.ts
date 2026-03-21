/**
 * Migration: Managed Incidents Tables
 *
 * Creates tables for the managed incident workflow:
 * - managed_incidents: Core incident records with status, priority, severity tracking
 * - managed_incident_notes: Notes/comments attached to incidents
 * - managed_incident_timeline: Timeline events for incident activity log
 * - managed_incident_responders: Responder assignments to incidents
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

function ensureForeignKey(
  pgm: MigrationBuilder,
  table: string,
  constraintName: string,
  column: string,
  refTable: string,
  refColumn: string,
  onDelete: string = 'CASCADE'
): void {
  pgm.sql(`
    DO $$ BEGIN
      ALTER TABLE "${table}" ADD CONSTRAINT "${constraintName}"
        FOREIGN KEY ("${column}") REFERENCES "${refTable}"("${refColumn}") ON DELETE ${onDelete};
    EXCEPTION WHEN OTHERS THEN NULL;
    END $$;
  `);
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ============================================================================
  // Managed Incidents Table
  // ============================================================================
  pgm.createTable('managed_incidents', {
    id: { type: 'varchar(255)', primaryKey: true },
    organization_id: { type: 'uuid', notNull: true },
    title: { type: 'varchar(500)', notNull: true },
    description: { type: 'text' },
    severity: { type: 'varchar(20)', notNull: true, default: "'medium'" },
    status: { type: 'varchar(30)', notNull: true, default: "'triggered'" },
    priority: { type: 'varchar(5)', default: "'P3'" },
    source: { type: 'varchar(30)', notNull: true, default: "'manual'" },
    source_id: { type: 'varchar(255)' },
    source_alert_id: { type: 'varchar(255)' },
    source_check_id: { type: 'varchar(255)' },
    source_check_type: { type: 'varchar(50)' },
    check_ids: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    tags: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    affected_services: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    escalation_policy_id: { type: 'varchar(255)' },
    on_call_schedule_id: { type: 'varchar(255)' },
    current_escalation_level: { type: 'integer' },
    resolution_summary: { type: 'text' },
    postmortem_url: { type: 'text' },
    postmortem_completed: { type: 'boolean', default: false },
    created_by: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    acknowledged_at: { type: 'timestamptz' },
    resolved_at: { type: 'timestamptz' },
    time_to_acknowledge_seconds: { type: 'integer' },
    time_to_resolve_seconds: { type: 'integer' },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'managed_incidents', [
    { name: 'organization_id', type: 'uuid' },
    { name: 'title', type: 'varchar(500)', notNull: true, default: "''" },
    { name: 'description', type: 'text' },
    { name: 'severity', type: 'varchar(20)', notNull: true, default: "'medium'" },
    { name: 'status', type: 'varchar(30)', notNull: true, default: "'triggered'" },
    { name: 'priority', type: 'varchar(5)', default: "'P3'" },
    { name: 'source', type: 'varchar(30)', notNull: true, default: "'manual'" },
    { name: 'source_id', type: 'varchar(255)' },
    { name: 'source_alert_id', type: 'varchar(255)' },
    { name: 'source_check_id', type: 'varchar(255)' },
    { name: 'source_check_type', type: 'varchar(50)' },
    { name: 'check_ids', type: 'jsonb', default: "'[]'::jsonb" },
    { name: 'tags', type: 'jsonb', default: "'[]'::jsonb" },
    { name: 'affected_services', type: 'jsonb', default: "'[]'::jsonb" },
    { name: 'escalation_policy_id', type: 'varchar(255)' },
    { name: 'on_call_schedule_id', type: 'varchar(255)' },
    { name: 'current_escalation_level', type: 'integer' },
    { name: 'resolution_summary', type: 'text' },
    { name: 'postmortem_url', type: 'text' },
    { name: 'postmortem_completed', type: 'boolean', default: 'false' },
    { name: 'created_by', type: 'varchar(255)', notNull: true, default: "'system'" },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'acknowledged_at', type: 'timestamptz' },
    { name: 'resolved_at', type: 'timestamptz' },
    { name: 'time_to_acknowledge_seconds', type: 'integer' },
    { name: 'time_to_resolve_seconds', type: 'integer' },
  ]);

  ensureForeignKey(pgm, 'managed_incidents', 'managed_incidents_organization_id_fkey', 'organization_id', 'organizations', 'id', 'CASCADE');

  pgm.createIndex('managed_incidents', 'organization_id', { ifNotExists: true, name: 'idx_managed_incidents_org' });
  pgm.createIndex('managed_incidents', 'status', { ifNotExists: true, name: 'idx_managed_incidents_status' });
  pgm.createIndex('managed_incidents', [{ name: 'created_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_managed_incidents_created' });

  // ============================================================================
  // Managed Incident Notes Table
  // ============================================================================
  pgm.createTable('managed_incident_notes', {
    id: { type: 'varchar(255)', primaryKey: true },
    incident_id: { type: 'varchar(255)', notNull: true },
    author_id: { type: 'varchar(255)', notNull: true },
    author_name: { type: 'varchar(255)', notNull: true },
    content: { type: 'text', notNull: true },
    visibility: { type: 'varchar(20)', default: "'internal'" },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'managed_incident_notes', [
    { name: 'incident_id', type: 'varchar(255)' },
    { name: 'author_id', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'author_name', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'content', type: 'text', notNull: true, default: "''" },
    { name: 'visibility', type: 'varchar(20)', default: "'internal'" },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  ensureForeignKey(pgm, 'managed_incident_notes', 'managed_incident_notes_incident_id_fkey', 'incident_id', 'managed_incidents', 'id', 'CASCADE');

  pgm.createIndex('managed_incident_notes', 'incident_id', { ifNotExists: true, name: 'idx_managed_incident_notes_incident' });

  // ============================================================================
  // Managed Incident Timeline Table
  // ============================================================================
  pgm.createTable('managed_incident_timeline', {
    id: { type: 'varchar(255)', primaryKey: true },
    incident_id: { type: 'varchar(255)', notNull: true },
    event_type: { type: 'varchar(50)', notNull: true },
    description: { type: 'text', notNull: true },
    actor_id: { type: 'varchar(255)' },
    actor_name: { type: 'varchar(255)' },
    metadata: { type: 'jsonb', default: pgm.func("'{}'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'managed_incident_timeline', [
    { name: 'incident_id', type: 'varchar(255)' },
    { name: 'event_type', type: 'varchar(50)', notNull: true, default: "''" },
    { name: 'description', type: 'text', notNull: true, default: "''" },
    { name: 'actor_id', type: 'varchar(255)' },
    { name: 'actor_name', type: 'varchar(255)' },
    { name: 'metadata', type: 'jsonb', default: "'{}'::jsonb" },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  ensureForeignKey(pgm, 'managed_incident_timeline', 'managed_incident_timeline_incident_id_fkey', 'incident_id', 'managed_incidents', 'id', 'CASCADE');

  pgm.createIndex('managed_incident_timeline', 'incident_id', { ifNotExists: true, name: 'idx_managed_incident_timeline_incident' });
  pgm.createIndex('managed_incident_timeline', [{ name: 'created_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_managed_incident_timeline_created' });

  // ============================================================================
  // Managed Incident Responders Table
  // ============================================================================
  pgm.createTable('managed_incident_responders', {
    id: { type: 'varchar(255)', primaryKey: true },
    incident_id: { type: 'varchar(255)', notNull: true },
    user_id: { type: 'varchar(255)', notNull: true },
    user_name: { type: 'varchar(255)', notNull: true },
    user_email: { type: 'varchar(255)', notNull: true },
    role: { type: 'varchar(30)', notNull: true, default: "'secondary'" },
    assigned_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    acknowledged_at: { type: 'timestamptz' },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'managed_incident_responders', [
    { name: 'incident_id', type: 'varchar(255)' },
    { name: 'user_id', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'user_name', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'user_email', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'role', type: 'varchar(30)', notNull: true, default: "'secondary'" },
    { name: 'assigned_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'acknowledged_at', type: 'timestamptz' },
  ]);

  ensureForeignKey(pgm, 'managed_incident_responders', 'managed_incident_responders_incident_id_fkey', 'incident_id', 'managed_incidents', 'id', 'CASCADE');

  pgm.createIndex('managed_incident_responders', 'incident_id', { ifNotExists: true, name: 'idx_managed_incident_responders_incident' });
  pgm.createIndex('managed_incident_responders', 'user_id', { ifNotExists: true, name: 'idx_managed_incident_responders_user' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop tables in reverse dependency order
  pgm.dropTable('managed_incident_responders', { ifExists: true, cascade: true });
  pgm.dropTable('managed_incident_timeline', { ifExists: true, cascade: true });
  pgm.dropTable('managed_incident_notes', { ifExists: true, cascade: true });
  pgm.dropTable('managed_incidents', { ifExists: true, cascade: true });
}
