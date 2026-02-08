/**
 * Migration: Remaining Tables
 * Feature #440: Complete database migration coverage
 *
 * Creates tables for:
 * - ai_generated_tests: AI-generated test storage
 * - reports: Generated test reports
 * - schedules: Test suite schedules
 * - audit_logs: System audit trail
 * - frontend_errors: Frontend error reporting
 * - step_templates: Reusable test step templates
 * - project_env_vars: Project environment variables
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
  // Project Environment Variables Table
  // ============================================================================
  pgm.createTable('project_env_vars', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    project_id: { type: 'uuid', references: 'projects(id)', onDelete: 'CASCADE' },
    key: { type: 'varchar(255)', notNull: true },
    value: { type: 'text', notNull: true },
    is_secret: { type: 'boolean', default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  // Add unique constraint idempotently
  pgm.sql(`
    DO $$ BEGIN
      ALTER TABLE "project_env_vars" ADD CONSTRAINT "project_env_vars_project_key_unique"
        UNIQUE ("project_id", "key");
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  ensureColumns(pgm, 'project_env_vars', [
    { name: 'project_id', type: 'uuid' },
    { name: 'key', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'value', type: 'text', notNull: true, default: "''" },
    { name: 'is_secret', type: 'boolean', default: 'false' },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  ensureForeignKey(pgm, 'project_env_vars', 'project_env_vars_project_id_fkey', 'project_id', 'projects', 'id', 'CASCADE');

  pgm.createIndex('project_env_vars', 'project_id', { ifNotExists: true, name: 'idx_project_env_vars_project' });

  // ============================================================================
  // AI Generated Tests Table
  // ============================================================================
  pgm.createTable('ai_generated_tests', {
    id: { type: 'varchar(100)', primaryKey: true },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    organization_id: { type: 'uuid', references: 'organizations(id)', onDelete: 'CASCADE' },
    project_id: { type: 'uuid', references: 'projects(id)', onDelete: 'CASCADE' },
    description: { type: 'text', notNull: true },
    generated_code: { type: 'text', notNull: true },
    test_name: { type: 'varchar(255)', notNull: true },
    language: { type: 'varchar(20)', notNull: true, default: "'typescript'" },
    confidence_score: { type: 'decimal(5,4)', notNull: true },
    confidence_level: { type: 'varchar(20)', notNull: true },
    version: { type: 'integer', notNull: true, default: 1 },
    parent_version_id: { type: 'varchar(100)' },
    feedback: { type: 'text' },
    ai_metadata: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    options: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    suggested_variations: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    improvement_suggestions: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    approval: { type: 'jsonb', notNull: true, default: pgm.func("'{\"status\": \"pending\"}'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'ai_generated_tests', [
    { name: 'user_id', type: 'uuid' },
    { name: 'organization_id', type: 'uuid' },
    { name: 'project_id', type: 'uuid' },
    { name: 'description', type: 'text', notNull: true, default: "''" },
    { name: 'generated_code', type: 'text', notNull: true, default: "''" },
    { name: 'test_name', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'language', type: 'varchar(20)', notNull: true, default: "'typescript'" },
    { name: 'confidence_score', type: 'decimal(5,4)', notNull: true, default: '0' },
    { name: 'confidence_level', type: 'varchar(20)', notNull: true, default: "'low'" },
    { name: 'version', type: 'integer', notNull: true, default: '1' },
    { name: 'parent_version_id', type: 'varchar(100)' },
    { name: 'feedback', type: 'text' },
    { name: 'ai_metadata', type: 'jsonb', notNull: true, default: "'{}'::jsonb" },
    { name: 'options', type: 'jsonb', notNull: true, default: "'{}'::jsonb" },
    { name: 'suggested_variations', type: 'jsonb', default: "'[]'::jsonb" },
    { name: 'improvement_suggestions', type: 'jsonb', default: "'[]'::jsonb" },
    { name: 'approval', type: 'jsonb', notNull: true, default: "'{\"status\": \"pending\"}'::jsonb" },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  ensureForeignKey(pgm, 'ai_generated_tests', 'ai_generated_tests_user_id_fkey', 'user_id', 'users', 'id', 'CASCADE');
  ensureForeignKey(pgm, 'ai_generated_tests', 'ai_generated_tests_organization_id_fkey', 'organization_id', 'organizations', 'id', 'CASCADE');
  ensureForeignKey(pgm, 'ai_generated_tests', 'ai_generated_tests_project_id_fkey', 'project_id', 'projects', 'id', 'CASCADE');

  pgm.createIndex('ai_generated_tests', 'user_id', { ifNotExists: true, name: 'idx_ai_generated_tests_user' });
  pgm.createIndex('ai_generated_tests', 'organization_id', { ifNotExists: true, name: 'idx_ai_generated_tests_org' });
  pgm.createIndex('ai_generated_tests', 'project_id', { ifNotExists: true, name: 'idx_ai_generated_tests_project' });
  pgm.createIndex('ai_generated_tests', [{ name: 'created_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_ai_generated_tests_created' });

  // ============================================================================
  // Reports Table
  // ============================================================================
  pgm.createTable('reports', {
    id: { type: 'varchar(100)', primaryKey: true },
    organization_id: { type: 'uuid', references: 'organizations(id)', onDelete: 'CASCADE' },
    project_id: { type: 'uuid', references: 'projects(id)', onDelete: 'CASCADE' },
    project_name: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    created_by: { type: 'varchar(255)', notNull: true },
    title: { type: 'varchar(500)', notNull: true },
    description: { type: 'text' },
    period: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    executive_summary: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    sections: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    generated_by: { type: 'varchar(50)', notNull: true, default: "'api'" },
    format: { type: 'varchar(20)', notNull: true, default: "'html'" },
    view_url: { type: 'text', notNull: true },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'reports', [
    { name: 'organization_id', type: 'uuid' },
    { name: 'project_id', type: 'uuid' },
    { name: 'project_name', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'created_by', type: 'varchar(255)', notNull: true, default: "'system'" },
    { name: 'title', type: 'varchar(500)', notNull: true, default: "''" },
    { name: 'description', type: 'text' },
    { name: 'period', type: 'jsonb', notNull: true, default: "'{}'::jsonb" },
    { name: 'executive_summary', type: 'jsonb', notNull: true, default: "'{}'::jsonb" },
    { name: 'sections', type: 'jsonb', notNull: true, default: "'{}'::jsonb" },
    { name: 'generated_by', type: 'varchar(50)', notNull: true, default: "'api'" },
    { name: 'format', type: 'varchar(20)', notNull: true, default: "'html'" },
    { name: 'view_url', type: 'text', notNull: true, default: "''" },
  ]);

  ensureForeignKey(pgm, 'reports', 'reports_organization_id_fkey', 'organization_id', 'organizations', 'id', 'CASCADE');
  ensureForeignKey(pgm, 'reports', 'reports_project_id_fkey', 'project_id', 'projects', 'id', 'CASCADE');

  pgm.createIndex('reports', 'organization_id', { ifNotExists: true, name: 'idx_reports_org' });
  pgm.createIndex('reports', 'project_id', { ifNotExists: true, name: 'idx_reports_project' });
  pgm.createIndex('reports', [{ name: 'created_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_reports_created' });

  // ============================================================================
  // Schedules Table
  // ============================================================================
  pgm.createTable('schedules', {
    id: { type: 'varchar(100)', primaryKey: true },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations(id)', onDelete: 'CASCADE' },
    suite_id: { type: 'varchar(100)', notNull: true },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    cron_expression: { type: 'varchar(100)' },
    run_at: { type: 'timestamptz' },
    timezone: { type: 'varchar(100)', notNull: true, default: "'UTC'" },
    enabled: { type: 'boolean', notNull: true, default: true },
    browsers: { type: 'jsonb', notNull: true, default: pgm.func("'[\"chromium\"]'::jsonb") },
    notify_on_failure: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    created_by: { type: 'varchar(255)', notNull: true },
    next_run_at: { type: 'timestamptz' },
    last_run_id: { type: 'varchar(100)' },
    run_count: { type: 'integer', notNull: true, default: 0 },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'schedules', [
    { name: 'organization_id', type: 'uuid' },
    { name: 'suite_id', type: 'varchar(100)', notNull: true, default: "''" },
    { name: 'name', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'description', type: 'text' },
    { name: 'cron_expression', type: 'varchar(100)' },
    { name: 'run_at', type: 'timestamptz' },
    { name: 'timezone', type: 'varchar(100)', notNull: true, default: "'UTC'" },
    { name: 'enabled', type: 'boolean', notNull: true, default: 'true' },
    { name: 'browsers', type: 'jsonb', notNull: true, default: "'[\"chromium\"]'::jsonb" },
    { name: 'notify_on_failure', type: 'boolean', notNull: true, default: 'true' },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'created_by', type: 'varchar(255)', notNull: true, default: "'system'" },
    { name: 'next_run_at', type: 'timestamptz' },
    { name: 'last_run_id', type: 'varchar(100)' },
    { name: 'run_count', type: 'integer', notNull: true, default: '0' },
  ]);

  ensureForeignKey(pgm, 'schedules', 'schedules_organization_id_fkey', 'organization_id', 'organizations', 'id', 'CASCADE');

  pgm.createIndex('schedules', 'organization_id', { ifNotExists: true, name: 'idx_schedules_org' });
  pgm.createIndex('schedules', 'suite_id', { ifNotExists: true, name: 'idx_schedules_suite' });
  pgm.createIndex('schedules', 'enabled', { ifNotExists: true, name: 'idx_schedules_enabled' });
  pgm.createIndex('schedules', 'next_run_at', { ifNotExists: true, name: 'idx_schedules_next_run' });

  // ============================================================================
  // Audit Logs Table
  // ============================================================================
  pgm.createTable('audit_logs', {
    id: { type: 'varchar(100)', primaryKey: true },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations(id)', onDelete: 'CASCADE' },
    user_id: { type: 'varchar(255)', notNull: true },
    user_email: { type: 'varchar(255)', notNull: true },
    action: { type: 'varchar(100)', notNull: true },
    resource_type: { type: 'varchar(100)', notNull: true },
    resource_id: { type: 'varchar(255)', notNull: true },
    resource_name: { type: 'varchar(500)' },
    details: { type: 'jsonb' },
    ip_address: { type: 'varchar(45)', notNull: true },
    user_agent: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'audit_logs', [
    { name: 'organization_id', type: 'uuid' },
    { name: 'user_id', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'user_email', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'action', type: 'varchar(100)', notNull: true, default: "''" },
    { name: 'resource_type', type: 'varchar(100)', notNull: true, default: "''" },
    { name: 'resource_id', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'resource_name', type: 'varchar(500)' },
    { name: 'details', type: 'jsonb' },
    { name: 'ip_address', type: 'varchar(45)', notNull: true, default: "''" },
    { name: 'user_agent', type: 'text', notNull: true, default: "''" },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  ensureForeignKey(pgm, 'audit_logs', 'audit_logs_organization_id_fkey', 'organization_id', 'organizations', 'id', 'CASCADE');

  pgm.createIndex('audit_logs', 'organization_id', { ifNotExists: true, name: 'idx_audit_logs_org' });
  pgm.createIndex('audit_logs', [{ name: 'created_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_audit_logs_created' });
  pgm.createIndex('audit_logs', 'action', { ifNotExists: true, name: 'idx_audit_logs_action' });
  pgm.createIndex('audit_logs', 'resource_type', { ifNotExists: true, name: 'idx_audit_logs_resource_type' });
  pgm.createIndex('audit_logs', ['organization_id', { name: 'created_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_audit_logs_org_created' });

  // ============================================================================
  // Frontend Errors Table
  // ============================================================================
  pgm.createTable('frontend_errors', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', references: 'organizations(id)', onDelete: 'CASCADE' },
    user_id: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    error_message: { type: 'text', notNull: true },
    error_stack: { type: 'text' },
    component_stack: { type: 'text' },
    url: { type: 'text', notNull: true },
    user_agent: { type: 'text' },
    browser: { type: 'varchar(100)' },
    os: { type: 'varchar(100)' },
    screen_resolution: { type: 'varchar(50)' },
    metadata: { type: 'jsonb', default: pgm.func("'{}'::jsonb") },
    resolved: { type: 'boolean', default: false },
    resolved_at: { type: 'timestamptz' },
    resolved_by: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'frontend_errors', [
    { name: 'organization_id', type: 'uuid' },
    { name: 'user_id', type: 'uuid' },
    { name: 'error_message', type: 'text', notNull: true, default: "''" },
    { name: 'error_stack', type: 'text' },
    { name: 'component_stack', type: 'text' },
    { name: 'url', type: 'text', notNull: true, default: "''" },
    { name: 'user_agent', type: 'text' },
    { name: 'browser', type: 'varchar(100)' },
    { name: 'os', type: 'varchar(100)' },
    { name: 'screen_resolution', type: 'varchar(50)' },
    { name: 'metadata', type: 'jsonb', default: "'{}'::jsonb" },
    { name: 'resolved', type: 'boolean', default: 'false' },
    { name: 'resolved_at', type: 'timestamptz' },
    { name: 'resolved_by', type: 'uuid' },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  ensureForeignKey(pgm, 'frontend_errors', 'frontend_errors_organization_id_fkey', 'organization_id', 'organizations', 'id', 'CASCADE');
  ensureForeignKey(pgm, 'frontend_errors', 'frontend_errors_user_id_fkey', 'user_id', 'users', 'id', 'SET NULL');
  ensureForeignKey(pgm, 'frontend_errors', 'frontend_errors_resolved_by_fkey', 'resolved_by', 'users', 'id', 'SET NULL');

  pgm.createIndex('frontend_errors', 'organization_id', { ifNotExists: true, name: 'idx_frontend_errors_org' });
  pgm.createIndex('frontend_errors', [{ name: 'created_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_frontend_errors_created' });
  pgm.createIndex('frontend_errors', 'resolved', { ifNotExists: true, name: 'idx_frontend_errors_resolved' });

  // ============================================================================
  // Step Templates Table
  // ============================================================================
  pgm.createTable('step_templates', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations(id)', onDelete: 'CASCADE' },
    suite_id: { type: 'uuid', references: 'test_suites(id)', onDelete: 'SET NULL' },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    steps: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    tags: { type: 'text[]', default: pgm.func("ARRAY[]::text[]") },
    created_by: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'step_templates', [
    { name: 'organization_id', type: 'uuid' },
    { name: 'suite_id', type: 'uuid' },
    { name: 'name', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'description', type: 'text' },
    { name: 'steps', type: 'jsonb', notNull: true, default: "'[]'::jsonb" },
    { name: 'tags', type: 'text[]', default: "ARRAY[]::text[]" },
    { name: 'created_by', type: 'varchar(255)', notNull: true, default: "'system'" },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  ensureForeignKey(pgm, 'step_templates', 'step_templates_organization_id_fkey', 'organization_id', 'organizations', 'id', 'CASCADE');
  ensureForeignKey(pgm, 'step_templates', 'step_templates_suite_id_fkey', 'suite_id', 'test_suites', 'id', 'SET NULL');

  pgm.createIndex('step_templates', 'organization_id', { ifNotExists: true, name: 'idx_step_templates_org' });
  pgm.createIndex('step_templates', 'suite_id', { ifNotExists: true, name: 'idx_step_templates_suite' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('step_templates', { ifExists: true, cascade: true });
  pgm.dropTable('frontend_errors', { ifExists: true, cascade: true });
  pgm.dropTable('audit_logs', { ifExists: true, cascade: true });
  pgm.dropTable('schedules', { ifExists: true, cascade: true });
  pgm.dropTable('reports', { ifExists: true, cascade: true });
  pgm.dropTable('ai_generated_tests', { ifExists: true, cascade: true });
  pgm.dropTable('project_env_vars', { ifExists: true, cascade: true });
}
