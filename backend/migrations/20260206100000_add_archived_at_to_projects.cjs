/**
 * Migration: Add archived_at column to projects table
 *
 * The projects repository expects an archived_at column for tracking when
 * projects were archived, but this column was missing from the initial schema.
 */

module.exports.up = async (pgm) => {
  // Add archived_at column to projects table
  pgm.addColumn('projects', {
    archived_at: { type: 'timestamptz', default: null },
  }, { ifNotExists: true });

  console.log('[Migration] Added archived_at column to projects table');
};

module.exports.down = async (pgm) => {
  pgm.dropColumn('projects', 'archived_at', { ifExists: true });
  console.log('[Migration] Removed archived_at column from projects table');
};
