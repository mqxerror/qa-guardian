import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Feature #230: Add denormalized count columns to test_runs
 * Feature #203: These columns avoid loading the full results JSONB (up to 114MB) just to count passed/failed/skipped
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Add denormalized count columns
  pgm.sql(`
    ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS results_count INTEGER DEFAULT 0;
    ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS passed_count INTEGER DEFAULT 0;
    ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0;
    ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS skipped_count INTEGER DEFAULT 0;
  `);
  console.log('[Migration] Added denormalized count columns to test_runs');

  // Backfill existing rows with count values from results JSONB
  pgm.sql(`
    UPDATE test_runs SET
      results_count = COALESCE(jsonb_array_length(results), 0),
      passed_count = COALESCE((SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(results, '[]'::jsonb)) r WHERE r->>'status' = 'passed'), 0),
      failed_count = COALESCE((SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(results, '[]'::jsonb)) r WHERE r->>'status' = 'failed'), 0),
      skipped_count = COALESCE((SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(results, '[]'::jsonb)) r WHERE r->>'status' = 'skipped'), 0)
    WHERE results_count = 0 AND results IS NOT NULL AND jsonb_array_length(results) > 0;
  `);
  console.log('[Migration] Backfilled count values from existing results JSONB');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    ALTER TABLE test_runs DROP COLUMN IF EXISTS results_count;
    ALTER TABLE test_runs DROP COLUMN IF EXISTS passed_count;
    ALTER TABLE test_runs DROP COLUMN IF EXISTS failed_count;
    ALTER TABLE test_runs DROP COLUMN IF EXISTS skipped_count;
  `);
  console.log('[Migration] Removed denormalized count columns from test_runs');
}
