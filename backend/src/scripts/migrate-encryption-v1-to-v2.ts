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

interface EncryptedColumn {
  table: string;
  column: string;
  idColumn: string;
  whereClause?: string;  // Optional additional WHERE clause filter (e.g., for is_secret=true)
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
  console.log(`\n[Migration] Checking ${table}.${column}${filterDesc}...`);

  try {
    // Fetch all rows with the encrypted column
    // Feature #239: Support additional WHERE clause for tables like project_env_vars
    const baseQuery = `SELECT ${idColumn}, ${column} FROM ${table} WHERE ${column} IS NOT NULL`;
    const fullQuery = whereClause ? `${baseQuery} AND ${whereClause}` : baseQuery;
    const result = await query<any>(fullQuery);

    if (!result || !result.rows) {
      console.log(`  No rows found in ${table}`);
      return { migrated, skipped, errors };
    }

    for (const row of result.rows) {
      const id = row[idColumn];
      const currentValue = row[column];

      if (!isV1Encrypted(currentValue)) {
        skipped++;
        continue;
      }

      console.log(`  Found v1 encrypted value in ${table}.${idColumn}=${id}`);

      if (dryRun) {
        console.log(`  [DRY-RUN] Would migrate ${table}.${idColumn}=${id}`);
        migrated++;
        continue;
      }

      try {
        const newValue = migrateV1ToV2(currentValue);

        await query(
          `UPDATE ${table} SET ${column} = $1 WHERE ${idColumn} = $2`,
          [newValue, id]
        );

        console.log(`  Migrated ${table}.${idColumn}=${id} from v1 to v2`);
        migrated++;
      } catch (error) {
        console.error(`  Error migrating ${table}.${idColumn}=${id}:`, error);
        errors++;
      }
    }
  } catch (error) {
    console.error(`  Error reading ${table}:`, error);
    errors++;
  }

  return { migrated, skipped, errors };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('===========================================');
  console.log('  Encryption v1 to v2 Migration Utility');
  console.log('  Feature #236');
  console.log('===========================================');
  console.log(`Mode: ${dryRun ? 'DRY-RUN (no changes will be made)' : 'LIVE (will update database)'}`);

  // Check encryption is enabled
  if (!isEncryptionEnabled()) {
    console.error('\n[Error] ENCRYPTION_KEY environment variable is not set.');
    console.error('Cannot migrate encrypted data without the key.');
    process.exit(1);
  }

  // Initialize database connection
  await initializeDatabase();

  if (!isDatabaseConnected()) {
    console.error('\n[Error] Database is not connected.');
    console.error('Ensure DATABASE_URL is set and PostgreSQL is running.');
    process.exit(1);
  }

  console.log('\n[OK] Database connected');
  console.log('[OK] Encryption key available');

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

  console.log('\n===========================================');
  console.log('  Migration Summary');
  console.log('===========================================');
  console.log(`  Migrated: ${totalMigrated}`);
  console.log(`  Skipped (already v2 or not encrypted): ${totalSkipped}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log('');

  if (dryRun && totalMigrated > 0) {
    console.log('To apply these changes, run without --dry-run');
  }

  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
