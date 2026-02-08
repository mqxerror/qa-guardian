/**
 * Migration: SAST (Static Application Security Testing) Tables
 * Feature #440: Complete database migration coverage
 *
 * Creates tables for:
 * - sast_configs: Project SAST configuration
 * - sast_scans: SAST scan history and results
 * - sast_false_positives: Marked false positive findings
 * - sast_pr_checks: PR status checks for SAST
 * - sast_pr_comments: PR comments from SAST scans
 * - secret_patterns: Custom secret detection patterns
 * - gitleaks_configs: Gitleaks configuration
 * - gitleaks_scans: Gitleaks scan history
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ============================================================================
  // SAST Configs Table
  // ============================================================================
  pgm.createTable('sast_configs', {
    project_id: { type: 'uuid', primaryKey: true, references: 'projects(id)', onDelete: 'CASCADE' },
    enabled: { type: 'boolean', default: false },
    ruleset: { type: 'varchar(50)', default: "'default'" },
    custom_rules: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    custom_rules_yaml: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    exclude_paths: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    severity_threshold: { type: 'varchar(20)', default: "'MEDIUM'" },
    auto_scan: { type: 'boolean', default: false },
    last_scan_at: { type: 'timestamptz' },
    last_scan_status: { type: 'varchar(50)' },
    pr_checks_enabled: { type: 'boolean', default: false },
    pr_comments_enabled: { type: 'boolean', default: false },
    block_pr_on_critical: { type: 'boolean', default: false },
    block_pr_on_high: { type: 'boolean', default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  // ============================================================================
  // SAST Scans Table
  // ============================================================================
  pgm.createTable('sast_scans', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true, references: 'projects(id)', onDelete: 'CASCADE' },
    repository_url: { type: 'text' },
    branch: { type: 'varchar(255)' },
    commit_sha: { type: 'varchar(40)' },
    status: { type: 'varchar(50)', notNull: true, default: "'pending'" },
    started_at: { type: 'timestamptz', notNull: true },
    completed_at: { type: 'timestamptz' },
    findings: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    summary: { type: 'jsonb', notNull: true },
    error: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('sast_scans', 'project_id', { ifNotExists: true, name: 'idx_sast_scans_project' });
  pgm.createIndex('sast_scans', [{ name: 'created_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_sast_scans_created' });
  pgm.createIndex('sast_scans', 'status', { ifNotExists: true, name: 'idx_sast_scans_status' });

  // ============================================================================
  // SAST False Positives Table
  // ============================================================================
  pgm.createTable('sast_false_positives', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true, references: 'projects(id)', onDelete: 'CASCADE' },
    rule_id: { type: 'varchar(255)', notNull: true },
    file_path: { type: 'text', notNull: true },
    line: { type: 'integer', notNull: true },
    snippet: { type: 'text' },
    reason: { type: 'text', notNull: true },
    marked_by: { type: 'varchar(255)', notNull: true },
    marked_at: { type: 'timestamptz', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('sast_false_positives', 'project_id', { ifNotExists: true, name: 'idx_sast_false_positives_project' });
  pgm.createIndex('sast_false_positives', ['project_id', 'rule_id'], { ifNotExists: true, name: 'idx_sast_false_positives_lookup' });

  // ============================================================================
  // SAST PR Checks Table
  // ============================================================================
  pgm.createTable('sast_pr_checks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true, references: 'projects(id)', onDelete: 'CASCADE' },
    pr_number: { type: 'integer', notNull: true },
    pr_title: { type: 'text' },
    head_sha: { type: 'varchar(40)', notNull: true },
    status: { type: 'varchar(50)', notNull: true, default: "'pending'" },
    conclusion: { type: 'varchar(50)' },
    context: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    target_url: { type: 'text' },
    scan_id: { type: 'uuid' },
    findings: { type: 'jsonb' },
    blocked: { type: 'boolean', default: false },
    block_reason: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true },
    updated_at: { type: 'timestamptz', notNull: true },
  }, { ifNotExists: true });

  pgm.createIndex('sast_pr_checks', 'project_id', { ifNotExists: true, name: 'idx_sast_pr_checks_project' });
  pgm.createIndex('sast_pr_checks', ['project_id', 'pr_number'], { ifNotExists: true, name: 'idx_sast_pr_checks_pr' });
  pgm.createIndex('sast_pr_checks', 'head_sha', { ifNotExists: true, name: 'idx_sast_pr_checks_sha' });

  // ============================================================================
  // SAST PR Comments Table
  // ============================================================================
  pgm.createTable('sast_pr_comments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true, references: 'projects(id)', onDelete: 'CASCADE' },
    pr_number: { type: 'integer', notNull: true },
    scan_id: { type: 'uuid', notNull: true },
    body: { type: 'text', notNull: true },
    findings: { type: 'jsonb', notNull: true },
    blocked: { type: 'boolean', default: false },
    created_at: { type: 'timestamptz', notNull: true },
  }, { ifNotExists: true });

  pgm.createIndex('sast_pr_comments', 'project_id', { ifNotExists: true, name: 'idx_sast_pr_comments_project' });
  pgm.createIndex('sast_pr_comments', ['project_id', 'pr_number'], { ifNotExists: true, name: 'idx_sast_pr_comments_pr' });

  // ============================================================================
  // Secret Patterns Table
  // ============================================================================
  pgm.createTable('secret_patterns', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    project_id: { type: 'uuid', notNull: true, references: 'projects(id)', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    pattern: { type: 'text', notNull: true },
    severity: { type: 'varchar(20)', notNull: true },
    category: { type: 'varchar(100)', notNull: true },
    enabled: { type: 'boolean', default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('secret_patterns', 'project_id', { ifNotExists: true, name: 'idx_secret_patterns_project' });
  pgm.createIndex('secret_patterns', 'enabled', { ifNotExists: true, name: 'idx_secret_patterns_enabled' });

  // ============================================================================
  // Gitleaks Configs Table
  // ============================================================================
  pgm.createTable('gitleaks_configs', {
    project_id: { type: 'uuid', primaryKey: true, references: 'projects(id)', onDelete: 'CASCADE' },
    enabled: { type: 'boolean', default: false },
    scan_on_push: { type: 'boolean', default: false },
    scan_on_pr: { type: 'boolean', default: false },
    scan_full_history: { type: 'boolean', default: false },
    exclude_paths: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    allowlist_patterns: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    custom_rules: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    severity_threshold: { type: 'varchar(20)', default: "'all'" },
    fail_on_leak: { type: 'boolean', default: true },
    notification_channels: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  // ============================================================================
  // Gitleaks Scans Table
  // ============================================================================
  pgm.createTable('gitleaks_scans', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true },
    project_id: { type: 'uuid', notNull: true, references: 'projects(id)', onDelete: 'CASCADE' },
    repository: { type: 'varchar(255)' },
    branch: { type: 'varchar(255)' },
    status: { type: 'varchar(50)', notNull: true, default: "'pending'" },
    started_at: { type: 'timestamptz', notNull: true },
    completed_at: { type: 'timestamptz' },
    trigger: { type: 'varchar(50)', default: "'manual'" },
    commits_scanned: { type: 'integer', default: 0 },
    findings: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    summary: { type: 'jsonb', notNull: true },
    error_message: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('gitleaks_scans', 'project_id', { ifNotExists: true, name: 'idx_gitleaks_scans_project' });
  pgm.createIndex('gitleaks_scans', [{ name: 'created_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_gitleaks_scans_created' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('gitleaks_scans', { ifExists: true, cascade: true });
  pgm.dropTable('gitleaks_configs', { ifExists: true, cascade: true });
  pgm.dropTable('secret_patterns', { ifExists: true, cascade: true });
  pgm.dropTable('sast_pr_comments', { ifExists: true, cascade: true });
  pgm.dropTable('sast_pr_checks', { ifExists: true, cascade: true });
  pgm.dropTable('sast_false_positives', { ifExists: true, cascade: true });
  pgm.dropTable('sast_scans', { ifExists: true, cascade: true });
  pgm.dropTable('sast_configs', { ifExists: true, cascade: true });
}
