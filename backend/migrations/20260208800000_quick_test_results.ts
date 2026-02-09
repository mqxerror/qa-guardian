/**
 * Quick Test Results Persistence Migration
 * Feature #465: Persist Quick Test results to PostgreSQL database
 *
 * Quick Test results are currently stored in an in-memory Map with 1000-entry cap
 * and 24h TTL. This migration creates a table to persist results so they survive
 * server restarts.
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ========================================
  // QUICK TEST RESULTS TABLE
  // ========================================
  // Stores all Quick Test runs with wave scores and full results

  pgm.createTable('quick_test_results', {
    id: { type: 'uuid', primaryKey: true },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    url: { type: 'text', notNull: true },
    status: { type: 'varchar(20)', notNull: true, default: 'running' }, // running, completed, failed

    // Overall scores
    overall_score: { type: 'integer' },
    health_score: { type: 'integer' },
    performance_score: { type: 'integer' },
    security_score: { type: 'integer' },

    // Wave scores as JSONB for flexibility
    wave_scores: { type: 'jsonb', default: '{}' },

    // Full wave results as JSONB
    wave_results: { type: 'jsonb', default: '[]' },

    // Timestamps
    started_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    completed_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  // Indexes for quick_test_results
  pgm.createIndex('quick_test_results', 'organization_id', {
    ifNotExists: true,
    name: 'idx_quick_test_results_org'
  });
  pgm.createIndex('quick_test_results', 'user_id', {
    ifNotExists: true,
    name: 'idx_quick_test_results_user'
  });
  pgm.createIndex('quick_test_results', [{ name: 'created_at', sort: 'DESC' }], {
    ifNotExists: true,
    name: 'idx_quick_test_results_created'
  });
  pgm.createIndex('quick_test_results', 'status', {
    ifNotExists: true,
    name: 'idx_quick_test_results_status'
  });
  // Composite index for org + created_at (common query pattern for history)
  pgm.createIndex('quick_test_results', ['organization_id', { name: 'created_at', sort: 'DESC' }], {
    ifNotExists: true,
    name: 'idx_quick_test_results_org_created'
  });

  console.log('[Migration] Quick test results table created successfully');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('quick_test_results', { ifExists: true, cascade: true });

  console.log('[Migration] Quick test results table dropped');
}
