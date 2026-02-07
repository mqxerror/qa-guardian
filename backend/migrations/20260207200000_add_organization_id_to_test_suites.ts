import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Migration: Add organization_id column to test_suites table
 *
 * Problem: The test_suites table was missing the organization_id column,
 * but multiple queries (listAllTestSuites, listTestSuitesPaginated) were
 * filtering by organization_id, causing 500 errors.
 *
 * Solution: Add the column and backfill it from the related project's organization_id.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Step 1: Add organization_id column (nullable initially for existing rows)
  pgm.addColumns('test_suites', {
    organization_id: { type: 'uuid', references: 'organizations', onDelete: 'CASCADE' },
  }, { ifNotExists: true });

  // Step 2: Backfill organization_id from the related project
  pgm.sql(`
    UPDATE test_suites ts
    SET organization_id = p.organization_id
    FROM projects p
    WHERE ts.project_id = p.id
    AND ts.organization_id IS NULL
  `);

  // Step 3: Make it NOT NULL after backfill (only if there are no NULL values left)
  // Using raw SQL with exception handling for idempotency
  pgm.sql(`
    DO $$ BEGIN
      -- Only attempt to set NOT NULL if all rows have a value
      IF NOT EXISTS (SELECT 1 FROM test_suites WHERE organization_id IS NULL) THEN
        ALTER TABLE test_suites ALTER COLUMN organization_id SET NOT NULL;
      END IF;
    END $$;
  `);

  // Step 4: Add index for the new column
  pgm.createIndex('test_suites', 'organization_id', { ifNotExists: true, name: 'idx_test_suites_organization' });

  // Step 5: Add composite index for common query pattern
  pgm.createIndex('test_suites', ['organization_id', { name: 'created_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_test_suites_org_created' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex('test_suites', 'organization_id', { ifExists: true, name: 'idx_test_suites_org_created' });
  pgm.dropIndex('test_suites', 'organization_id', { ifExists: true, name: 'idx_test_suites_organization' });
  pgm.dropColumns('test_suites', ['organization_id'], { ifExists: true });
}
