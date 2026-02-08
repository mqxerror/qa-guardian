/**
 * Migration: Visual Testing Tables
 * Feature #440: Complete database migration coverage
 *
 * Creates tables for:
 * - visual_baselines: Visual regression baseline screenshots
 * - flaky_tests: Flaky test tracking and quarantine
 * - webhooks: Legacy webhooks table (simpler than webhook_subscriptions)
 * - selector_overrides: Healed selector overrides
 * - healed_selector_history: Selector healing history
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ============================================================================
  // Visual Baselines Table
  // ============================================================================
  pgm.createTable('visual_baselines', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    test_id: {
      type: 'uuid',
      references: 'tests(id)',
      onDelete: 'CASCADE',
    },
    project_id: {
      type: 'uuid',
      references: 'projects(id)',
      onDelete: 'CASCADE',
    },
    viewport: {
      type: 'varchar(50)',
    },
    browser: {
      type: 'varchar(50)',
    },
    screenshot_path: {
      type: 'text',
      notNull: true,
    },
    screenshot_hash: {
      type: 'varchar(64)',
    },
    metadata: {
      type: 'jsonb',
      default: pgm.func("'{}'::jsonb"),
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  }, { ifNotExists: true });

  // Add unique constraint idempotently
  pgm.sql(`
    DO $$ BEGIN
      ALTER TABLE "visual_baselines" ADD CONSTRAINT "visual_baselines_test_viewport_browser_unique"
        UNIQUE ("test_id", "viewport", "browser");
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);

  pgm.createIndex('visual_baselines', 'test_id', { ifNotExists: true, name: 'idx_visual_baselines_test' });
  pgm.createIndex('visual_baselines', 'project_id', { ifNotExists: true, name: 'idx_visual_baselines_project' });

  // ============================================================================
  // Flaky Tests Table
  // ============================================================================
  pgm.createTable('flaky_tests', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    test_id: {
      type: 'uuid',
      unique: true,
      references: 'tests(id)',
      onDelete: 'CASCADE',
    },
    project_id: {
      type: 'uuid',
      references: 'projects(id)',
      onDelete: 'CASCADE',
    },
    flaky_score: {
      type: 'decimal(5,2)',
      default: 0,
    },
    total_runs: {
      type: 'integer',
      default: 0,
    },
    failed_runs: {
      type: 'integer',
      default: 0,
    },
    last_flaky_at: {
      type: 'timestamptz',
    },
    quarantined: {
      type: 'boolean',
      default: false,
    },
    analysis: {
      type: 'jsonb',
      default: pgm.func("'{}'::jsonb"),
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  }, { ifNotExists: true });

  pgm.createIndex('flaky_tests', 'project_id', { ifNotExists: true, name: 'idx_flaky_tests_project' });
  pgm.createIndex('flaky_tests', 'quarantined', { ifNotExists: true, name: 'idx_flaky_tests_quarantined' });
  pgm.createIndex('flaky_tests', 'flaky_score', { ifNotExists: true, name: 'idx_flaky_tests_score' });

  // ============================================================================
  // Webhooks Table (Legacy)
  // ============================================================================
  pgm.createTable('webhooks', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    organization_id: {
      type: 'uuid',
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    project_id: {
      type: 'uuid',
      references: 'projects(id)',
      onDelete: 'SET NULL',
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    url: {
      type: 'text',
      notNull: true,
    },
    secret: {
      type: 'varchar(255)',
    },
    events: {
      type: 'text[]',
      notNull: true,
    },
    enabled: {
      type: 'boolean',
      default: true,
    },
    headers: {
      type: 'jsonb',
      default: pgm.func("'{}'::jsonb"),
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  }, { ifNotExists: true });

  pgm.createIndex('webhooks', 'organization_id', { ifNotExists: true, name: 'idx_webhooks_org' });
  pgm.createIndex('webhooks', 'project_id', { ifNotExists: true, name: 'idx_webhooks_project' });
  pgm.createIndex('webhooks', 'enabled', { ifNotExists: true, name: 'idx_webhooks_enabled' });

  // ============================================================================
  // Selector Overrides Table
  // ============================================================================
  pgm.createTable('selector_overrides', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    test_id: {
      type: 'uuid',
      references: 'tests(id)',
      onDelete: 'CASCADE',
    },
    project_id: {
      type: 'uuid',
      references: 'projects(id)',
      onDelete: 'CASCADE',
    },
    original_selector: {
      type: 'text',
      notNull: true,
    },
    healed_selector: {
      type: 'text',
      notNull: true,
    },
    confidence: {
      type: 'decimal(5,4)',
      default: 0.95,
    },
    approved: {
      type: 'boolean',
      default: false,
    },
    approved_by: {
      type: 'uuid',
    },
    approved_at: {
      type: 'timestamptz',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  }, { ifNotExists: true });

  pgm.createIndex('selector_overrides', 'test_id', { ifNotExists: true, name: 'idx_selector_overrides_test' });
  pgm.createIndex('selector_overrides', 'project_id', { ifNotExists: true, name: 'idx_selector_overrides_project' });
  pgm.createIndex('selector_overrides', ['test_id', 'original_selector'], { ifNotExists: true, name: 'idx_selector_overrides_lookup' });

  // ============================================================================
  // Healed Selector History Table
  // ============================================================================
  pgm.createTable('healed_selector_history', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    test_id: {
      type: 'uuid',
      references: 'tests(id)',
      onDelete: 'CASCADE',
    },
    project_id: {
      type: 'uuid',
      references: 'projects(id)',
      onDelete: 'CASCADE',
    },
    run_id: {
      type: 'uuid',
    },
    original_selector: {
      type: 'text',
      notNull: true,
    },
    healed_selector: {
      type: 'text',
      notNull: true,
    },
    healing_method: {
      type: 'varchar(50)',
    },
    confidence: {
      type: 'decimal(5,4)',
    },
    element_context: {
      type: 'jsonb',
    },
    success: {
      type: 'boolean',
      default: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  }, { ifNotExists: true });

  pgm.createIndex('healed_selector_history', 'test_id', { ifNotExists: true, name: 'idx_healed_selector_history_test' });
  pgm.createIndex('healed_selector_history', 'project_id', { ifNotExists: true, name: 'idx_healed_selector_history_project' });
  pgm.createIndex('healed_selector_history', [{ name: 'created_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_healed_selector_history_created' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('healed_selector_history', { ifExists: true, cascade: true });
  pgm.dropTable('selector_overrides', { ifExists: true, cascade: true });
  pgm.dropTable('webhooks', { ifExists: true, cascade: true });
  pgm.dropTable('flaky_tests', { ifExists: true, cascade: true });
  pgm.dropTable('visual_baselines', { ifExists: true, cascade: true });
}
