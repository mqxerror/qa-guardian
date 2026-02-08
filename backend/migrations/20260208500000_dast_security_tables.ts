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
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

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
