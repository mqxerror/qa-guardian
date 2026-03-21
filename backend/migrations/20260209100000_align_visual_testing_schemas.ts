/**
 * Migration: Align Visual Testing Schema Drift
 * Resolves schema conflicts between migration-created tables and
 * service-level CREATE TABLE IF NOT EXISTS in database-schema.ts.
 *
 * The inline schema in database-schema.ts defines additional columns for
 * healed_selector_history and selector_overrides that were not present in
 * the original 20260208100000_visual_testing_tables migration.
 *
 * Uses ADD COLUMN IF NOT EXISTS for full idempotency -- safe to run whether
 * the inline schema ran first (columns already exist) or not.
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ============================================================================
  // healed_selector_history -- add columns present in inline schema but
  // missing from the 20260208100000 migration
  // ============================================================================

  const healedHistoryColumns = [
    { name: 'step_id', type: 'VARCHAR(255)' },
    { name: 'strategy', type: 'VARCHAR(100)' },
    { name: 'healing_strategy', type: 'VARCHAR(100)' },
    { name: 'healing_confidence', type: 'DECIMAL(5,4)' },
    { name: 'was_successful', type: 'BOOLEAN' },
    { name: 'was_accepted', type: 'BOOLEAN' },
    { name: 'accepted_by', type: 'VARCHAR(255)' },
    { name: 'accepted_at', type: 'TIMESTAMP WITH TIME ZONE' },
    { name: 'was_rejected', type: 'BOOLEAN' },
    { name: 'rejection_reason', type: 'TEXT' },
    { name: 'rejected_by', type: 'VARCHAR(255)' },
    { name: 'rejected_at', type: 'TIMESTAMP WITH TIME ZONE' },
    { name: 'suggested_alternative', type: 'TEXT' },
    { name: 'suggested_selector', type: 'TEXT' },
  ];

  for (const col of healedHistoryColumns) {
    pgm.sql(
      `ALTER TABLE "healed_selector_history" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type};`
    );
  }

  // ============================================================================
  // selector_overrides -- add columns present in inline schema but
  // missing from the 20260208100000 migration
  // ============================================================================

  const selectorOverrideColumns: Array<{ name: string; type: string; default?: string }> = [
    { name: 'step_id', type: 'VARCHAR(255)' },
    { name: 'new_selector', type: 'TEXT' },
    { name: 'override_by', type: 'VARCHAR(255)' },
    { name: 'override_by_email', type: 'VARCHAR(255)' },
    { name: 'override_at', type: 'TIMESTAMP WITH TIME ZONE', default: 'NOW()' },
    { name: 'notes', type: 'TEXT' },
  ];

  for (const col of selectorOverrideColumns) {
    const parts = [
      `ALTER TABLE "selector_overrides" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`,
    ];
    if (col.default !== undefined) {
      parts.push(`DEFAULT ${col.default}`);
    }
    pgm.sql(parts.join(' ') + ';');
  }

  console.log('[Migration] Visual testing schema alignment complete');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // ============================================================================
  // Drop columns added to healed_selector_history
  // ============================================================================

  const healedHistoryColumnsToDrop = [
    'step_id',
    'strategy',
    'healing_strategy',
    'healing_confidence',
    'was_successful',
    'was_accepted',
    'accepted_by',
    'accepted_at',
    'was_rejected',
    'rejection_reason',
    'rejected_by',
    'rejected_at',
    'suggested_alternative',
    'suggested_selector',
  ];

  for (const col of healedHistoryColumnsToDrop) {
    pgm.sql(
      `ALTER TABLE "healed_selector_history" DROP COLUMN IF EXISTS "${col}";`
    );
  }

  // ============================================================================
  // Drop columns added to selector_overrides
  // ============================================================================

  const selectorOverrideColumnsToDrop = [
    'step_id',
    'new_selector',
    'override_by',
    'override_by_email',
    'override_at',
    'notes',
  ];

  for (const col of selectorOverrideColumnsToDrop) {
    pgm.sql(
      `ALTER TABLE "selector_overrides" DROP COLUMN IF EXISTS "${col}";`
    );
  }

  console.log('[Migration] Visual testing schema alignment reverted');
}
