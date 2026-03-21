/**
 * Migration: Quick Test Supplementary Tables
 * Feature #670: Persist compareRunMap to database
 * Feature #671: Persist quick test schedules
 *
 * Creates tables for:
 * - quick_test_comparisons: Stores compareId -> runIdA/runIdB mapping for comparative Quick Tests
 * - quick_test_schedules: Stores recurring quick test schedules for URLs
 *
 * NOTE: All operations are idempotent. Tables may already exist from
 * service-level CREATE TABLE IF NOT EXISTS in database-schema.ts.
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ========================================
  // QUICK TEST COMPARISONS TABLE
  // ========================================
  // Stores the mapping from compareId to runIdA/runIdB for comparative Quick Tests

  pgm.createTable('quick_test_comparisons', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' },
    run_id_a: { type: 'uuid', notNull: true, references: 'quick_test_results', onDelete: 'CASCADE' },
    run_id_b: { type: 'uuid', notNull: true, references: 'quick_test_results', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    expires_at: { type: 'timestamptz', default: pgm.func("NOW() + INTERVAL '24 hours'") },
  }, { ifNotExists: true });

  // Indexes for quick_test_comparisons
  pgm.createIndex('quick_test_comparisons', 'organization_id', {
    ifNotExists: true,
    name: 'idx_quick_test_comparisons_org',
  });
  pgm.createIndex('quick_test_comparisons', 'run_id_a', {
    ifNotExists: true,
    name: 'idx_quick_test_comparisons_run_a',
  });
  pgm.createIndex('quick_test_comparisons', 'run_id_b', {
    ifNotExists: true,
    name: 'idx_quick_test_comparisons_run_b',
  });
  pgm.createIndex('quick_test_comparisons', 'expires_at', {
    ifNotExists: true,
    name: 'idx_quick_test_comparisons_expires',
  });

  // ========================================
  // QUICK TEST SCHEDULES TABLE
  // ========================================
  // Stores recurring quick test schedules for URLs

  pgm.createTable('quick_test_schedules', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    url: { type: 'text', notNull: true },
    name: { type: 'varchar(255)', notNull: true },
    cron_expression: { type: 'varchar(100)', notNull: true },
    timezone: { type: 'varchar(100)', notNull: true, default: "'UTC'" },
    enabled: { type: 'boolean', notNull: true, default: true },
    notify_on_score_drop: { type: 'boolean', notNull: true, default: false },
    score_threshold: { type: 'integer', default: 80 },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    next_run_at: { type: 'timestamptz' },
    last_run_id: { type: 'uuid', references: 'quick_test_results', onDelete: 'SET NULL' },
    last_run_at: { type: 'timestamptz' },
    run_count: { type: 'integer', notNull: true, default: 0 },
  }, { ifNotExists: true });

  // Indexes for quick_test_schedules
  pgm.createIndex('quick_test_schedules', 'organization_id', {
    ifNotExists: true,
    name: 'idx_quick_test_schedules_org',
  });
  pgm.createIndex('quick_test_schedules', 'user_id', {
    ifNotExists: true,
    name: 'idx_quick_test_schedules_user',
  });
  pgm.createIndex('quick_test_schedules', 'enabled', {
    ifNotExists: true,
    name: 'idx_quick_test_schedules_enabled',
  });
  pgm.createIndex('quick_test_schedules', 'next_run_at', {
    ifNotExists: true,
    name: 'idx_quick_test_schedules_next_run',
  });

  console.log('[Migration] Quick test comparisons and schedules tables created successfully');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('quick_test_schedules', { ifExists: true, cascade: true });
  pgm.dropTable('quick_test_comparisons', { ifExists: true, cascade: true });

  console.log('[Migration] Quick test comparisons and schedules tables dropped');
}
