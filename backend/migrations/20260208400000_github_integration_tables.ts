/**
 * Migration: GitHub Integration Tables
 * Feature #440: Complete database migration coverage
 *
 * Creates tables for:
 * - github_connections: GitHub app/OAuth connections
 * - pr_status_checks: PR status checks
 * - pr_comments: PR review comments
 * - pr_dependency_scans: PR vulnerability scans
 * - user_github_tokens: User-level GitHub OAuth tokens
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
  // GitHub Connections Table
  // ============================================================================
  pgm.createTable('github_connections', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations(id)', onDelete: 'CASCADE' },
    installation_id: { type: 'varchar(255)' },
    access_token: { type: 'text' },
    refresh_token: { type: 'text' },
    token_expires_at: { type: 'timestamptz' },
    scope: { type: 'varchar(255)' },
    owner: { type: 'varchar(255)', notNull: true },
    repo: { type: 'varchar(255)', notNull: true },
    default_branch: { type: 'varchar(100)', default: "'main'" },
    webhook_secret: { type: 'text' },
    webhook_url: { type: 'text' },
    enabled: { type: 'boolean', default: true },
    last_sync_at: { type: 'timestamptz' },
    sync_status: { type: 'varchar(50)', default: "'pending'" },
    sync_error: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    created_by: { type: 'varchar(255)' },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'github_connections', [
    { name: 'organization_id', type: 'uuid' },
    { name: 'installation_id', type: 'varchar(255)' },
    { name: 'access_token', type: 'text' },
    { name: 'refresh_token', type: 'text' },
    { name: 'token_expires_at', type: 'timestamptz' },
    { name: 'scope', type: 'varchar(255)' },
    { name: 'owner', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'repo', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'default_branch', type: 'varchar(100)', default: "'main'" },
    { name: 'webhook_secret', type: 'text' },
    { name: 'webhook_url', type: 'text' },
    { name: 'enabled', type: 'boolean', default: 'true' },
    { name: 'last_sync_at', type: 'timestamptz' },
    { name: 'sync_status', type: 'varchar(50)', default: "'pending'" },
    { name: 'sync_error', type: 'text' },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'created_by', type: 'varchar(255)' },
  ]);

  ensureForeignKey(pgm, 'github_connections', 'github_connections_organization_id_fkey', 'organization_id', 'organizations', 'id', 'CASCADE');

  // Add unique constraint idempotently
  pgm.sql(`
    DO $$ BEGIN
      ALTER TABLE "github_connections" ADD CONSTRAINT "github_connections_org_owner_repo_unique"
        UNIQUE ("organization_id", "owner", "repo");
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  pgm.createIndex('github_connections', 'organization_id', { ifNotExists: true, name: 'idx_github_connections_org' });
  pgm.createIndex('github_connections', ['owner', 'repo'], { ifNotExists: true, name: 'idx_github_connections_repo' });
  pgm.createIndex('github_connections', 'enabled', { ifNotExists: true, name: 'idx_github_connections_enabled' });

  // ============================================================================
  // PR Status Checks Table
  // ============================================================================
  pgm.createTable('pr_status_checks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    connection_id: { type: 'uuid', notNull: true, references: 'github_connections(id)', onDelete: 'CASCADE' },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations(id)', onDelete: 'CASCADE' },
    pr_number: { type: 'integer', notNull: true },
    pr_title: { type: 'text' },
    pr_url: { type: 'text' },
    head_sha: { type: 'varchar(40)', notNull: true },
    base_branch: { type: 'varchar(255)' },
    head_branch: { type: 'varchar(255)' },
    status: { type: 'varchar(50)', notNull: true, default: "'pending'" },
    conclusion: { type: 'varchar(50)' },
    check_run_id: { type: 'varchar(255)' },
    details_url: { type: 'text' },
    test_run_id: { type: 'uuid' },
    tests_total: { type: 'integer', default: 0 },
    tests_passed: { type: 'integer', default: 0 },
    tests_failed: { type: 'integer', default: 0 },
    tests_skipped: { type: 'integer', default: 0 },
    started_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    completed_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'pr_status_checks', [
    { name: 'connection_id', type: 'uuid' },
    { name: 'organization_id', type: 'uuid' },
    { name: 'pr_number', type: 'integer', notNull: true, default: '0' },
    { name: 'pr_title', type: 'text' },
    { name: 'pr_url', type: 'text' },
    { name: 'head_sha', type: 'varchar(40)', notNull: true, default: "''" },
    { name: 'base_branch', type: 'varchar(255)' },
    { name: 'head_branch', type: 'varchar(255)' },
    { name: 'status', type: 'varchar(50)', notNull: true, default: "'pending'" },
    { name: 'conclusion', type: 'varchar(50)' },
    { name: 'check_run_id', type: 'varchar(255)' },
    { name: 'details_url', type: 'text' },
    { name: 'test_run_id', type: 'uuid' },
    { name: 'tests_total', type: 'integer', default: '0' },
    { name: 'tests_passed', type: 'integer', default: '0' },
    { name: 'tests_failed', type: 'integer', default: '0' },
    { name: 'tests_skipped', type: 'integer', default: '0' },
    { name: 'started_at', type: 'timestamptz', default: 'NOW()' },
    { name: 'completed_at', type: 'timestamptz' },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  ensureForeignKey(pgm, 'pr_status_checks', 'pr_status_checks_connection_id_fkey', 'connection_id', 'github_connections', 'id', 'CASCADE');
  ensureForeignKey(pgm, 'pr_status_checks', 'pr_status_checks_organization_id_fkey', 'organization_id', 'organizations', 'id', 'CASCADE');

  pgm.createIndex('pr_status_checks', 'connection_id', { ifNotExists: true, name: 'idx_pr_status_checks_connection' });
  pgm.createIndex('pr_status_checks', 'organization_id', { ifNotExists: true, name: 'idx_pr_status_checks_org' });
  pgm.createIndex('pr_status_checks', ['connection_id', 'pr_number'], { ifNotExists: true, name: 'idx_pr_status_checks_pr' });
  pgm.createIndex('pr_status_checks', 'head_sha', { ifNotExists: true, name: 'idx_pr_status_checks_sha' });
  pgm.createIndex('pr_status_checks', 'status', { ifNotExists: true, name: 'idx_pr_status_checks_status' });

  // ============================================================================
  // PR Comments Table
  // ============================================================================
  pgm.createTable('pr_comments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    connection_id: { type: 'uuid', notNull: true, references: 'github_connections(id)', onDelete: 'CASCADE' },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations(id)', onDelete: 'CASCADE' },
    pr_number: { type: 'integer', notNull: true },
    comment_id: { type: 'varchar(255)' },
    comment_type: { type: 'varchar(50)', notNull: true, default: "'general'" },
    body: { type: 'text', notNull: true },
    path: { type: 'text' },
    line: { type: 'integer' },
    side: { type: 'varchar(10)' },
    commit_id: { type: 'varchar(40)' },
    in_reply_to_id: { type: 'varchar(255)' },
    posted_at: { type: 'timestamptz' },
    posted_by: { type: 'varchar(255)' },
    is_bot: { type: 'boolean', default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'pr_comments', [
    { name: 'connection_id', type: 'uuid' },
    { name: 'organization_id', type: 'uuid' },
    { name: 'pr_number', type: 'integer', notNull: true, default: '0' },
    { name: 'comment_id', type: 'varchar(255)' },
    { name: 'comment_type', type: 'varchar(50)', notNull: true, default: "'general'" },
    { name: 'body', type: 'text', notNull: true, default: "''" },
    { name: 'path', type: 'text' },
    { name: 'line', type: 'integer' },
    { name: 'side', type: 'varchar(10)' },
    { name: 'commit_id', type: 'varchar(40)' },
    { name: 'in_reply_to_id', type: 'varchar(255)' },
    { name: 'posted_at', type: 'timestamptz' },
    { name: 'posted_by', type: 'varchar(255)' },
    { name: 'is_bot', type: 'boolean', default: 'false' },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  ensureForeignKey(pgm, 'pr_comments', 'pr_comments_connection_id_fkey', 'connection_id', 'github_connections', 'id', 'CASCADE');
  ensureForeignKey(pgm, 'pr_comments', 'pr_comments_organization_id_fkey', 'organization_id', 'organizations', 'id', 'CASCADE');

  pgm.createIndex('pr_comments', 'connection_id', { ifNotExists: true, name: 'idx_pr_comments_connection' });
  pgm.createIndex('pr_comments', 'organization_id', { ifNotExists: true, name: 'idx_pr_comments_org' });
  pgm.createIndex('pr_comments', ['connection_id', 'pr_number'], { ifNotExists: true, name: 'idx_pr_comments_pr' });

  // ============================================================================
  // PR Dependency Scans Table
  // ============================================================================
  pgm.createTable('pr_dependency_scans', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    connection_id: { type: 'uuid', notNull: true, references: 'github_connections(id)', onDelete: 'CASCADE' },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations(id)', onDelete: 'CASCADE' },
    pr_number: { type: 'integer', notNull: true },
    head_sha: { type: 'varchar(40)', notNull: true },
    status: { type: 'varchar(50)', notNull: true, default: "'pending'" },
    vulnerabilities_found: { type: 'integer', default: 0 },
    critical_count: { type: 'integer', default: 0 },
    high_count: { type: 'integer', default: 0 },
    medium_count: { type: 'integer', default: 0 },
    low_count: { type: 'integer', default: 0 },
    vulnerabilities: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    scan_started_at: { type: 'timestamptz' },
    scan_completed_at: { type: 'timestamptz' },
    scan_error: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'pr_dependency_scans', [
    { name: 'connection_id', type: 'uuid' },
    { name: 'organization_id', type: 'uuid' },
    { name: 'pr_number', type: 'integer', notNull: true, default: '0' },
    { name: 'head_sha', type: 'varchar(40)', notNull: true, default: "''" },
    { name: 'status', type: 'varchar(50)', notNull: true, default: "'pending'" },
    { name: 'vulnerabilities_found', type: 'integer', default: '0' },
    { name: 'critical_count', type: 'integer', default: '0' },
    { name: 'high_count', type: 'integer', default: '0' },
    { name: 'medium_count', type: 'integer', default: '0' },
    { name: 'low_count', type: 'integer', default: '0' },
    { name: 'vulnerabilities', type: 'jsonb', default: "'[]'::jsonb" },
    { name: 'scan_started_at', type: 'timestamptz' },
    { name: 'scan_completed_at', type: 'timestamptz' },
    { name: 'scan_error', type: 'text' },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  ensureForeignKey(pgm, 'pr_dependency_scans', 'pr_dependency_scans_connection_id_fkey', 'connection_id', 'github_connections', 'id', 'CASCADE');
  ensureForeignKey(pgm, 'pr_dependency_scans', 'pr_dependency_scans_organization_id_fkey', 'organization_id', 'organizations', 'id', 'CASCADE');

  pgm.createIndex('pr_dependency_scans', 'connection_id', { ifNotExists: true, name: 'idx_pr_dependency_scans_connection' });
  pgm.createIndex('pr_dependency_scans', 'organization_id', { ifNotExists: true, name: 'idx_pr_dependency_scans_org' });
  pgm.createIndex('pr_dependency_scans', ['connection_id', 'pr_number'], { ifNotExists: true, name: 'idx_pr_dependency_scans_pr' });

  // ============================================================================
  // User GitHub Tokens Table
  // ============================================================================
  pgm.createTable('user_github_tokens', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations(id)', onDelete: 'CASCADE' },
    access_token: { type: 'text', notNull: true },
    refresh_token: { type: 'text' },
    token_expires_at: { type: 'timestamptz' },
    scope: { type: 'varchar(255)' },
    github_username: { type: 'varchar(255)' },
    github_user_id: { type: 'varchar(255)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'user_github_tokens', [
    { name: 'user_id', type: 'uuid' },
    { name: 'organization_id', type: 'uuid' },
    { name: 'access_token', type: 'text', notNull: true, default: "''" },
    { name: 'refresh_token', type: 'text' },
    { name: 'token_expires_at', type: 'timestamptz' },
    { name: 'scope', type: 'varchar(255)' },
    { name: 'github_username', type: 'varchar(255)' },
    { name: 'github_user_id', type: 'varchar(255)' },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'updated_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  ensureForeignKey(pgm, 'user_github_tokens', 'user_github_tokens_user_id_fkey', 'user_id', 'users', 'id', 'CASCADE');
  ensureForeignKey(pgm, 'user_github_tokens', 'user_github_tokens_organization_id_fkey', 'organization_id', 'organizations', 'id', 'CASCADE');

  // Add unique constraint idempotently
  pgm.sql(`
    DO $$ BEGIN
      ALTER TABLE "user_github_tokens" ADD CONSTRAINT "user_github_tokens_user_org_unique"
        UNIQUE ("user_id", "organization_id");
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  pgm.createIndex('user_github_tokens', 'user_id', { ifNotExists: true, name: 'idx_user_github_tokens_user' });
  pgm.createIndex('user_github_tokens', 'organization_id', { ifNotExists: true, name: 'idx_user_github_tokens_org' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('user_github_tokens', { ifExists: true, cascade: true });
  pgm.dropTable('pr_dependency_scans', { ifExists: true, cascade: true });
  pgm.dropTable('pr_comments', { ifExists: true, cascade: true });
  pgm.dropTable('pr_status_checks', { ifExists: true, cascade: true });
  pgm.dropTable('github_connections', { ifExists: true, cascade: true });
}
