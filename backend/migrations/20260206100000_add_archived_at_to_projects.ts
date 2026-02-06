/**
 * Migration: Add archived_at column to projects table
 *
 * The projects repository expects an archived_at column for tracking when
 * projects were archived, but this column was missing from the initial schema.
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Add archived_at column to projects table
  pgm.addColumn('projects', {
    archived_at: { type: 'timestamptz', default: null },
  }, { ifNotExists: true });

  console.log('[Migration] Added archived_at column to projects table');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('projects', 'archived_at', { ifExists: true });
  console.log('[Migration] Removed archived_at column from projects table');
}
