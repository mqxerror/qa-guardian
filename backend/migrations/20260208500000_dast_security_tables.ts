/**
 * Migration: DAST (Dynamic Application Security Testing) Tables
 * Feature #440: Complete database migration coverage
 *
 * Creates tables for:
 * - dast_configs: Project DAST configuration
 * - dast_scans: DAST scan history and results
 * - dast_false_positives: Marked false positive alerts
 * - openapi_specs: Uploaded OpenAPI specifications
 * - dast_schedules: Scheduled DAST scans
 * - graphql_scans: GraphQL security scans
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
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ============================================================================
  // DAST Configs Table
  // ============================================================================
  pgm.createTable('dast_configs', {
    project_id: { type: 'uuid', primaryKey: true, references: 'projects(id)', onDelete: 'CASCADE' },
    enabled: { type: 'boolean', default: false },
    target_url: { type: 'text' },
    scan_profile: { type: 'varchar(50)', default: "'baseline'" },
    auth_config: { type: 'jsonb' },
    context_config: { type: 'jsonb' },
    alert_threshold: { type: 'varchar(20)', default: "'LOW'" },
    auto_scan: { type: 'boolean', default: false },
    last_scan_at: { type: 'timestamptz' },
    last_scan_status: { type: 'varchar(50)' },
    openapi_spec_id: { type: 'uuid' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'dast_configs', [
    { name: 'enabled', type: 'boolean', default: 'false' },
    { name: 'target_url', type: 'text' },
    { name: 'scan_profile', type: 'varchar(50)', default: "'baseline'" },
    { name: 'auth_config', type: 'jsonb' },
    { name: 'context_config', type: 'jsonb' },
    { name: 'alert_threshold', type: 'varchar(20)', default: "'LOW'" },
    { name: 'auto_scan', type: 'boolean', default: 'false' },
    { name: 'last_scan_at', type: 'timestamptz' },
    { name: 'last_scan_status', type: 'varchar(50)' },
    { name: 'openapi_spec_id', type: 'uuid' },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  // ============================================================================
  // DAST Scans Table
  // ============================================================================
  pgm.createTable('dast_scans', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true, references: 'projects(id)', onDelete: 'CASCADE' },
    target_url: { type: 'text', notNull: true },
    scan_profile: { type: 'varchar(50)', notNull: true },
    status: { type: 'varchar(50)', notNull: true, default: "'pending'" },
    started_at: { type: 'timestamptz', notNull: true },
    completed_at: { type: 'timestamptz' },
    alerts: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    summary: { type: 'jsonb', notNull: true },
    statistics: { type: 'jsonb' },
    error: { type: 'text' },
    endpoints_tested: { type: 'jsonb' },
    scope_config: { type: 'jsonb' },
    progress: { type: 'jsonb' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'dast_scans', [
    { name: 'project_id', type: 'uuid' },
    { name: 'target_url', type: 'text', notNull: true, default: "''" },
    { name: 'scan_profile', type: 'varchar(50)', notNull: true, default: "'baseline'" },
    { name: 'status', type: 'varchar(50)', notNull: true, default: "'pending'" },
    { name: 'started_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'completed_at', type: 'timestamptz' },
    { name: 'alerts', type: 'jsonb', default: "'[]'::jsonb" },
    { name: 'summary', type: 'jsonb', notNull: true, default: "'{}'::jsonb" },
    { name: 'statistics', type: 'jsonb' },
    { name: 'error', type: 'text' },
    { name: 'endpoints_tested', type: 'jsonb' },
    { name: 'scope_config', type: 'jsonb' },
    { name: 'progress', type: 'jsonb' },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  ensureForeignKey(pgm, 'dast_scans', 'dast_scans_project_id_fkey', 'project_id', 'projects', 'id', 'CASCADE');

  pgm.createIndex('dast_scans', 'project_id', { ifNotExists: true, name: 'idx_dast_scans_project' });
  pgm.createIndex('dast_scans', [{ name: 'created_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_dast_scans_created' });
  pgm.createIndex('dast_scans', 'status', { ifNotExists: true, name: 'idx_dast_scans_status' });

  // ============================================================================
  // DAST False Positives Table
  // ============================================================================
  pgm.createTable('dast_false_positives', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true, references: 'projects(id)', onDelete: 'CASCADE' },
    plugin_id: { type: 'varchar(255)', notNull: true },
    url: { type: 'text', notNull: true },
    param: { type: 'text' },
    reason: { type: 'text', notNull: true },
    marked_by: { type: 'varchar(255)', notNull: true },
    marked_at: { type: 'timestamptz', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'dast_false_positives', [
    { name: 'project_id', type: 'uuid' },
    { name: 'plugin_id', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'url', type: 'text', notNull: true, default: "''" },
    { name: 'param', type: 'text' },
    { name: 'reason', type: 'text', notNull: true, default: "''" },
    { name: 'marked_by', type: 'varchar(255)', notNull: true, default: "'system'" },
    { name: 'marked_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  ensureForeignKey(pgm, 'dast_false_positives', 'dast_false_positives_project_id_fkey', 'project_id', 'projects', 'id', 'CASCADE');

  pgm.createIndex('dast_false_positives', 'project_id', { ifNotExists: true, name: 'idx_dast_false_positives_project' });
  pgm.createIndex('dast_false_positives', ['project_id', 'plugin_id'], { ifNotExists: true, name: 'idx_dast_false_positives_lookup' });

  // ============================================================================
  // OpenAPI Specs Table
  // ============================================================================
  pgm.createTable('openapi_specs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true, references: 'projects(id)', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    version: { type: 'varchar(100)' },
    content: { type: 'text', notNull: true },
    endpoints: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    uploaded_at: { type: 'timestamptz', notNull: true },
    uploaded_by: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'openapi_specs', [
    { name: 'project_id', type: 'uuid' },
    { name: 'name', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'version', type: 'varchar(100)' },
    { name: 'content', type: 'text', notNull: true, default: "''" },
    { name: 'endpoints', type: 'jsonb', default: "'[]'::jsonb" },
    { name: 'uploaded_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'uploaded_by', type: 'varchar(255)', notNull: true, default: "'system'" },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  ensureForeignKey(pgm, 'openapi_specs', 'openapi_specs_project_id_fkey', 'project_id', 'projects', 'id', 'CASCADE');

  pgm.createIndex('openapi_specs', 'project_id', { ifNotExists: true, name: 'idx_openapi_specs_project' });

  // ============================================================================
  // DAST Schedules Table
  // ============================================================================
  pgm.createTable('dast_schedules', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true, references: 'projects(id)', onDelete: 'CASCADE' },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations(id)', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    frequency: { type: 'varchar(50)', notNull: true },
    cron_expression: { type: 'varchar(100)', notNull: true },
    timezone: { type: 'varchar(100)', notNull: true },
    enabled: { type: 'boolean', default: true },
    scan_profile: { type: 'varchar(50)', notNull: true },
    target_url: { type: 'text', notNull: true },
    notify_on_failure: { type: 'boolean', default: false },
    notify_on_high_severity: { type: 'boolean', default: false },
    email_recipients: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    created_by: { type: 'varchar(255)', notNull: true },
    next_run_at: { type: 'timestamptz' },
    last_run_at: { type: 'timestamptz' },
    last_run_id: { type: 'uuid' },
    run_count: { type: 'integer', default: 0 },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'dast_schedules', [
    { name: 'project_id', type: 'uuid' },
    { name: 'organization_id', type: 'uuid' },
    { name: 'name', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'description', type: 'text' },
    { name: 'frequency', type: 'varchar(50)', notNull: true, default: "'daily'" },
    { name: 'cron_expression', type: 'varchar(100)', notNull: true, default: "'0 0 * * *'" },
    { name: 'timezone', type: 'varchar(100)', notNull: true, default: "'UTC'" },
    { name: 'enabled', type: 'boolean', default: 'true' },
    { name: 'scan_profile', type: 'varchar(50)', notNull: true, default: "'baseline'" },
    { name: 'target_url', type: 'text', notNull: true, default: "''" },
    { name: 'notify_on_failure', type: 'boolean', default: 'false' },
    { name: 'notify_on_high_severity', type: 'boolean', default: 'false' },
    { name: 'email_recipients', type: 'jsonb', default: "'[]'::jsonb" },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'created_by', type: 'varchar(255)', notNull: true, default: "'system'" },
    { name: 'next_run_at', type: 'timestamptz' },
    { name: 'last_run_at', type: 'timestamptz' },
    { name: 'last_run_id', type: 'uuid' },
    { name: 'run_count', type: 'integer', default: '0' },
  ]);

  ensureForeignKey(pgm, 'dast_schedules', 'dast_schedules_project_id_fkey', 'project_id', 'projects', 'id', 'CASCADE');
  ensureForeignKey(pgm, 'dast_schedules', 'dast_schedules_organization_id_fkey', 'organization_id', 'organizations', 'id', 'CASCADE');

  pgm.createIndex('dast_schedules', 'project_id', { ifNotExists: true, name: 'idx_dast_schedules_project' });
  pgm.createIndex('dast_schedules', 'organization_id', { ifNotExists: true, name: 'idx_dast_schedules_org' });
  pgm.createIndex('dast_schedules', 'enabled', { ifNotExists: true, name: 'idx_dast_schedules_enabled' });

  // ============================================================================
  // GraphQL Scans Table
  // ============================================================================
  pgm.createTable('graphql_scans', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    config: { type: 'jsonb', notNull: true },
    status: { type: 'varchar(50)', notNull: true, default: "'introspecting'" },
    started_at: { type: 'timestamptz', notNull: true },
    completed_at: { type: 'timestamptz' },
    schema: { type: 'jsonb' },
    operations_tested: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    findings: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    summary: { type: 'jsonb', notNull: true },
    progress: { type: 'jsonb' },
    error: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'graphql_scans', [
    { name: 'config', type: 'jsonb', notNull: true, default: "'{}'::jsonb" },
    { name: 'status', type: 'varchar(50)', notNull: true, default: "'introspecting'" },
    { name: 'started_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'completed_at', type: 'timestamptz' },
    { name: 'schema', type: 'jsonb' },
    { name: 'operations_tested', type: 'jsonb', default: "'[]'::jsonb" },
    { name: 'findings', type: 'jsonb', default: "'[]'::jsonb" },
    { name: 'summary', type: 'jsonb', notNull: true, default: "'{}'::jsonb" },
    { name: 'progress', type: 'jsonb' },
    { name: 'error', type: 'text' },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  pgm.createIndex('graphql_scans', [{ name: 'created_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_graphql_scans_created' });
  pgm.createIndex('graphql_scans', 'status', { ifNotExists: true, name: 'idx_graphql_scans_status' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('graphql_scans', { ifExists: true, cascade: true });
  pgm.dropTable('dast_schedules', { ifExists: true, cascade: true });
  pgm.dropTable('openapi_specs', { ifExists: true, cascade: true });
  pgm.dropTable('dast_false_positives', { ifExists: true, cascade: true });
  pgm.dropTable('dast_scans', { ifExists: true, cascade: true });
  pgm.dropTable('dast_configs', { ifExists: true, cascade: true });
}
