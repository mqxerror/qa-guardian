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
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

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
