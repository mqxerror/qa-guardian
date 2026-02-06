/**
 * Database Migration Service
 * Feature #162: Database migration system using node-pg-migrate
 *
 * Provides:
 * - Run pending migrations on startup
 * - Get migration status for health endpoint
 * - Safe migration execution with transaction support
 */

import { Pool } from 'pg';

// Migration status interface for health endpoint
export interface MigrationStatus {
  enabled: boolean;
  lastMigration: string | null;
  pendingMigrations: number;
  appliedMigrations: number;
  error: string | null;
}

let lastMigrationStatus: MigrationStatus = {
  enabled: true,
  lastMigration: null,
  pendingMigrations: 0,
  appliedMigrations: 0,
  error: null,
};

/**
 * Run pending database migrations
 * Should be called before server starts
 */
export async function runMigrations(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log('[Migrations] No DATABASE_URL configured, skipping migrations');
    lastMigrationStatus.enabled = false;
    return true;
  }

  // Check if migrations should be skipped
  if (process.env.SKIP_MIGRATIONS === 'true') {
    console.log('[Migrations] SKIP_MIGRATIONS=true, skipping migrations');
    lastMigrationStatus.enabled = false;
    return true;
  }

  try {
    // Dynamically import node-pg-migrate to avoid requiring it when not needed
    const { runner } = await import('node-pg-migrate');

    console.log('[Migrations] Running pending migrations...');

    const result = await runner({
      databaseUrl,
      dir: 'migrations',
      migrationsTable: 'pgmigrations',
      direction: 'up',
      count: Infinity, // Run all pending migrations
      log: (msg) => console.log('[Migrations]', msg),
      verbose: process.env.NODE_ENV !== 'production',
    });

    // Get migration status
    const status = await getMigrationStatusFromDb(databaseUrl);
    lastMigrationStatus = status;

    console.log(`[Migrations] Applied ${result} migration(s) successfully`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Migrations] Failed to run migrations:', errorMessage);

    lastMigrationStatus.error = errorMessage;

    // In production, fail fast on migration errors
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }

    // In development, continue but log the error
    return false;
  }
}

/**
 * Get migration status from the database
 */
async function getMigrationStatusFromDb(databaseUrl: string): Promise<MigrationStatus> {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  try {
    // Check if pgmigrations table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'pgmigrations'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      return {
        enabled: true,
        lastMigration: null,
        pendingMigrations: 0,
        appliedMigrations: 0,
        error: null,
      };
    }

    // Get applied migrations
    const result = await pool.query(`
      SELECT name, run_on
      FROM pgmigrations
      ORDER BY run_on DESC
    `);

    const appliedMigrations = result.rows.length;
    const lastMigration = result.rows[0]?.name || null;

    return {
      enabled: true,
      lastMigration,
      pendingMigrations: 0, // We've run all pending migrations
      appliedMigrations,
      error: null,
    };
  } catch (error) {
    return {
      enabled: true,
      lastMigration: null,
      pendingMigrations: 0,
      appliedMigrations: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await pool.end();
  }
}

/**
 * Get current migration status for health endpoint
 */
export function getMigrationStatus(): MigrationStatus {
  return { ...lastMigrationStatus };
}

/**
 * Check if migrations are healthy
 */
export function areMigrationsHealthy(): boolean {
  return !lastMigrationStatus.error && lastMigrationStatus.pendingMigrations === 0;
}
