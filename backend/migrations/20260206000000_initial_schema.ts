/**
 * Initial Schema Migration
 * Feature #162: Database migration system
 *
 * This migration creates the initial database schema from the existing
 * CREATE TABLE IF NOT EXISTS statements in database.ts
 *
 * Note: This migration is designed for NEW databases only.
 * Existing databases with the schema already in place should mark this
 * migration as applied using: npm run migrate -- -f 20260206000000
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Enable UUID extension
  pgm.createExtension('uuid-ossp', { ifNotExists: true });

  // ========================================
  // CORE TABLES
  // ========================================

  // Organizations
  pgm.createTable('organizations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    name: { type: 'varchar(255)', notNull: true },
    slug: { type: 'varchar(255)', unique: true, notNull: true },
    settings: { type: 'jsonb', default: '{}' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  // Users
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    organization_id: { type: 'uuid', references: 'organizations', onDelete: 'CASCADE' },
    email: { type: 'varchar(255)', unique: true, notNull: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    name: { type: 'varchar(255)', notNull: true },
    avatar_url: { type: 'text' },
    role: { type: 'varchar(50)', notNull: true, default: 'viewer' },
    email_verified: { type: 'boolean', default: false },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  // Organization Members (composite primary key defined inline)
  pgm.createTable('organization_members', {
    user_id: { type: 'uuid', notNull: true, primaryKey: true },
    organization_id: { type: 'uuid', notNull: true, primaryKey: true, references: 'organizations', onDelete: 'CASCADE' },
    role: { type: 'varchar(50)', notNull: true, default: 'viewer' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  // Projects
  pgm.createTable('projects', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    organization_id: { type: 'uuid', references: 'organizations', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    slug: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    base_url: { type: 'text' },
    archived: { type: 'boolean', default: false },
    archived_at: { type: 'timestamptz', default: null },
    settings: { type: 'jsonb', default: '{}' },
    visual_settings: { type: 'jsonb', default: '{}' },
    healing_settings: { type: 'jsonb', default: '{}' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  }, { ifNotExists: true });
  // Add unique constraint idempotently using raw SQL
  pgm.sql(`
    DO $$ BEGIN
      ALTER TABLE "projects" ADD CONSTRAINT "projects_org_slug_unique" UNIQUE ("organization_id", "slug");
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  // Project Members (composite primary key defined inline)
  pgm.createTable('project_members', {
    project_id: { type: 'uuid', primaryKey: true, references: 'projects', onDelete: 'CASCADE' },
    user_id: { type: 'uuid', primaryKey: true, references: 'users', onDelete: 'CASCADE' },
    role: { type: 'varchar(50)', notNull: true },
    added_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    added_by: { type: 'uuid' },
  }, { ifNotExists: true });

  // Test Suites
  pgm.createTable('test_suites', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    project_id: { type: 'uuid', references: 'projects', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    type: { type: 'varchar(50)', notNull: true, default: 'e2e' },
    config: { type: 'jsonb', default: '{}' },
    tags: { type: 'text[]', default: '{}' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  // Tests
  pgm.createTable('tests', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    suite_id: { type: 'uuid', references: 'test_suites', onDelete: 'CASCADE' },
    project_id: { type: 'uuid', references: 'projects', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    type: { type: 'varchar(50)', notNull: true, default: 'e2e' },
    config: { type: 'jsonb', default: '{}' },
    code: { type: 'text' },
    enabled: { type: 'boolean', default: true },
    priority: { type: 'integer', default: 0 },
    tags: { type: 'text[]', default: '{}' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  // Test Runs
  pgm.createTable('test_runs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    test_id: { type: 'uuid', references: 'tests', onDelete: 'CASCADE' },
    suite_id: { type: 'uuid', references: 'test_suites', onDelete: 'CASCADE' },
    suite_name: { type: 'varchar(255)' },
    project_id: { type: 'uuid', references: 'projects', onDelete: 'CASCADE' },
    project_name: { type: 'varchar(255)' },
    schedule_id: { type: 'uuid' },
    organization_id: { type: 'uuid', references: 'organizations', onDelete: 'CASCADE' },
    status: { type: 'varchar(50)', notNull: true, default: 'pending' },
    results: { type: 'jsonb', default: '[]' },
    metrics: { type: 'jsonb', default: '{}' },
    error_message: { type: 'text' },
    duration_ms: { type: 'integer' },
    browser: { type: 'varchar(50)' },
    branch: { type: 'varchar(255)', default: 'main' },
    test_type: { type: 'varchar(50)' },
    viewport: { type: 'jsonb' },
    started_at: { type: 'timestamptz' },
    completed_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    accessibility_results: { type: 'jsonb' },
    run_env_vars: { type: 'jsonb' },
    priority: { type: 'integer', default: 100 },
    triggered_by: { type: 'varchar(50)' },
    user_id: { type: 'uuid' },
    pr_number: { type: 'integer' },
  }, { ifNotExists: true });

  // ========================================
  // INDEXES - Core Tables
  // ========================================

  pgm.createIndex('users', 'organization_id', { ifNotExists: true, name: 'idx_users_organization' });
  pgm.createIndex('users', 'email', { ifNotExists: true, name: 'idx_users_email' });
  pgm.createIndex('projects', 'organization_id', { ifNotExists: true, name: 'idx_projects_organization' });
  pgm.createIndex('projects', ['organization_id', 'slug'], { ifNotExists: true, name: 'idx_projects_slug' });
  pgm.createIndex('test_suites', 'project_id', { ifNotExists: true, name: 'idx_test_suites_project' });
  pgm.createIndex('tests', 'suite_id', { ifNotExists: true, name: 'idx_tests_suite' });
  pgm.createIndex('tests', 'project_id', { ifNotExists: true, name: 'idx_tests_project' });
  pgm.createIndex('test_runs', 'test_id', { ifNotExists: true, name: 'idx_test_runs_test' });
  pgm.createIndex('test_runs', 'suite_id', { ifNotExists: true, name: 'idx_test_runs_suite' });
  pgm.createIndex('test_runs', 'project_id', { ifNotExists: true, name: 'idx_test_runs_project' });
  pgm.createIndex('test_runs', 'status', { ifNotExists: true, name: 'idx_test_runs_status' });
  pgm.createIndex('test_runs', [{ name: 'created_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_test_runs_created' });
  pgm.createIndex('test_runs', 'organization_id', { ifNotExists: true, name: 'idx_test_runs_organization' });

  // Feature #62: Composite indexes for common query patterns
  pgm.createIndex('test_runs', ['organization_id', { name: 'created_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_test_runs_org_created' });
  pgm.createIndex('test_runs', ['suite_id', { name: 'created_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_test_runs_suite_created' });
  pgm.createIndex('test_runs', ['project_id', { name: 'created_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_test_runs_project_created' });
  pgm.createIndex('test_runs', ['organization_id', 'status'], { ifNotExists: true, name: 'idx_test_runs_org_status' });
  pgm.createIndex('test_runs', ['test_id', { name: 'created_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_test_runs_test_created' });

  // Note: Additional tables (sessions, api_keys, visual_baselines, flaky_tests, webhooks,
  // monitoring tables, security tables, etc.) should be added in subsequent migrations
  // when they're needed, rather than all at once.

  console.log('[Migration] Initial schema created successfully');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop tables in reverse order of dependencies
  pgm.dropTable('test_runs', { ifExists: true, cascade: true });
  pgm.dropTable('tests', { ifExists: true, cascade: true });
  pgm.dropTable('test_suites', { ifExists: true, cascade: true });
  pgm.dropTable('project_members', { ifExists: true, cascade: true });
  pgm.dropTable('projects', { ifExists: true, cascade: true });
  pgm.dropTable('organization_members', { ifExists: true, cascade: true });
  pgm.dropTable('users', { ifExists: true, cascade: true });
  pgm.dropTable('organizations', { ifExists: true, cascade: true });

  console.log('[Migration] Initial schema dropped');
}
