import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createIndex('test_runs', 'results', {
    name: 'idx_test_runs_results_gin',
    method: 'gin',
    ifNotExists: true,
  });
  console.log('[Migration] Added GIN index on test_runs.results for JSONB containment queries');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('test_runs', 'results', { name: 'idx_test_runs_results_gin', ifExists: true });
  console.log('[Migration] Removed GIN index on test_runs.results');
}
