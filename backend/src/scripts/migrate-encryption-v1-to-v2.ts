/**
 * Feature #236: Migration script to upgrade v1 encrypted data to v2 format
 *
 * The v1 encryption used a fixed salt derived from the key, making it
 * vulnerable if the key is compromised. The v2 format uses a random salt
 * per value, providing better security.
 *
 * Usage:
 *   npx tsx src/scripts/migrate-encryption-v1-to-v2.ts [--dry-run]
 *
 * Options:
 *   --dry-run   Preview changes without modifying the database
 */

import { query, isDatabaseConnected, initializeDatabase } from '../services/database.js';
import { isV1Encrypted, migrateV1ToV2, isEncryptionEnabled } from '../services/encryption.js';
import { createLogger } from '../services/logger.js';

const migrationLogger = createLogger('migration-v1-to-v2');

interface EncryptedColumn {
  table: string;
  column: string;
  idColumn: string;
  whereClause?: string;  // Optional additional WHERE clause filter (e.g., for is_secret=true)
}

// Feature #731: Row interface for dynamically-selected encrypted columns
// Each row contains an ID column and an encrypted value column, both strings
interface EncryptedValueRow {
  [key: string]: string;
}

// List of tables/columns that may contain v1 encrypted data
// Feature #239: Corrected targets - api_keys.key_hash was WRONG (it's a SHA-256 hash, not AES-encrypted)
// Actual encrypted columns are:
//   - user_github_tokens.access_token (github.ts:423)
//   - project_env_vars.value when is_secret=true (projects.ts:452)
const ENCRYPTED_COLUMNS: EncryptedColumn[] = [
  { table: 'user_github_tokens', column: 'access_token', idColumn: 'id' },
  {
    table: 'project_env_vars',
    column: 'value',
    idColumn: 'id',
    whereClause: 'is_secret = true'  // Only secrets are encrypted, not plaintext env vars
  },
];

async function migrateTable(
  tableInfo: EncryptedColumn,
  dryRun: boolean
): Promise<{ migrated: number; skipped: number; errors: number }> {
  const { table, column, idColumn, whereClause } = tableInfo;
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  const filterDesc = whereClause ? ` (where ${whereClause})` : '';
  migrationLogger.info({ table, column, filter: filterDesc }, 'Checking table for v1 encrypted data');

  try {
    // Fetch all rows with the encrypted column
    // Feature #239: Support additional WHERE clause for tables like project_env_vars
    const baseQuery = `SELECT ${idColumn}, ${column} FROM ${table} WHERE ${column} IS NOT NULL`;
    const fullQuery = whereClause ? `${baseQuery} AND ${whereClause}` : baseQuery;
    const result = await query<EncryptedValueRow>(fullQuery);

    if (!result || !result.rows) {
      migrationLogger.info({ table }, 'No rows found in table');
      return { migrated, skipped, errors };
    }

    for (const row of result.rows) {
      const id = row[idColumn];
      const currentValue = row[column];

      if (!isV1Encrypted(currentValue)) {
        skipped++;
        continue;
      }

      migrationLogger.info({ table, idColumn, id }, 'Found v1 encrypted value');

      if (dryRun) {
        migrationLogger.info({ table, idColumn, id }, 'DRY-RUN: Would migrate row');
        migrated++;
        continue;
      }

      try {
        const newValue = migrateV1ToV2(currentValue);

        await query(
          `UPDATE ${table} SET ${column} = $1 WHERE ${idColumn} = $2`,
          [newValue, id]
        );

        migrationLogger.info({ table, idColumn, id }, 'Migrated row from v1 to v2');
        migrated++;
      } catch (error) {
        migrationLogger.error({ table, idColumn, id, error: error instanceof Error ? error.message : String(error) }, 'Error migrating row');
        errors++;
      }
    }
  } catch (error) {
    migrationLogger.error({ table, error: error instanceof Error ? error.message : String(error) }, 'Error reading table');
    errors++;
  }

  return { migrated, skipped, errors };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  migrationLogger.info('===========================================');
  migrationLogger.info('  Encryption v1 to v2 Migration Utility');
  migrationLogger.info('  Feature #236');
  migrationLogger.info('===========================================');
  migrationLogger.info({ mode: dryRun ? 'DRY-RUN' : 'LIVE' }, dryRun ? 'DRY-RUN: no changes will be made' : 'LIVE: will update database');

  // Check encryption is enabled
  if (!isEncryptionEnabled()) {
    migrationLogger.error('ENCRYPTION_KEY environment variable is not set. Cannot migrate encrypted data without the key.');
    process.exit(1);
  }

  // Initialize database connection
  await initializeDatabase();

  if (!isDatabaseConnected()) {
    migrationLogger.error('Database is not connected. Ensure DATABASE_URL is set and PostgreSQL is running.');
    process.exit(1);
  }

  migrationLogger.info('Database connected');
  migrationLogger.info('Encryption key available');

  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Migrate each table
  for (const tableInfo of ENCRYPTED_COLUMNS) {
    const result = await migrateTable(tableInfo, dryRun);
    totalMigrated += result.migrated;
    totalSkipped += result.skipped;
    totalErrors += result.errors;
  }

  migrationLogger.info('===========================================');
  migrationLogger.info('  Migration Summary');
  migrationLogger.info('===========================================');
  migrationLogger.info({ migrated: totalMigrated, skipped: totalSkipped, errors: totalErrors }, 'Migration results');

  if (dryRun && totalMigrated > 0) {
    migrationLogger.info('To apply these changes, run without --dry-run');
  }

  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((error) => {
  migrationLogger.error({ error: error instanceof Error ? error.message : String(error) }, 'Migration failed');
  process.exit(1);
});
