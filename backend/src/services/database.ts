/**
 * Database Service for PostgreSQL
 *
 * This service provides persistent storage using PostgreSQL (Supabase-compatible).
 * Replaces in-memory Map() storage to prevent data loss on container restart.
 *
 * Features:
 * - Connection pooling with pg
 * - Automatic reconnection on failure
 * - Schema initialization on startup
 * - Graceful shutdown support
 * - Feature #157: Pool monitoring and tuning
 * - Feature #247: Schema extracted to database-schema.ts
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getCompleteSchemaSQL } from './database-schema.js';

// Database connection pool
let pool: Pool | null = null;

// Connection state tracking
let isConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1000;

// Feature #157: Pool configuration from environment with sensible defaults
const POOL_MIN = parseInt(process.env.DB_POOL_MIN || '2', 10);
const POOL_MAX = parseInt(process.env.DB_POOL_MAX || '20', 10);
const POOL_IDLE_TIMEOUT = parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10);
const POOL_CONNECTION_TIMEOUT = parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '5000', 10);
const POOL_STATS_INTERVAL = parseInt(process.env.DB_POOL_STATS_INTERVAL || '60000', 10); // Log stats every 60s

// Feature #157: Pool monitoring state
let poolStatsInterval: NodeJS.Timeout | null = null;
let poolExhaustedCount = 0;
let lastPoolExhaustedAt: Date | null = null;

/**
 * Feature #157: Pool statistics interface for health endpoint
 */
export interface PoolStats {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  maxConnections: number;
  minConnections: number;
  poolExhaustedCount: number;
  lastPoolExhaustedAt: string | null;
}

/**
 * Initialize the database connection pool
 */
export async function initializeDatabase(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

  if (!databaseUrl) {
    console.warn('[Database] No DATABASE_URL or SUPABASE_DATABASE_URL configured - using in-memory storage');
    return false;
  }

  try {
    // Feature #157: Enhanced pool configuration with tuning parameters
    pool = new Pool({
      connectionString: databaseUrl,
      min: POOL_MIN, // Feature #157: Minimum pool size for warm connections
      max: POOL_MAX, // Maximum pool size
      idleTimeoutMillis: POOL_IDLE_TIMEOUT, // Close idle connections after timeout
      connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT, // Feature #157: Fast failure for pool exhaustion
      ssl: databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    });

    // Feature #157: Handle pool errors gracefully
    pool.on('error', (err) => {
      console.error('[Database] Pool error:', err.message);
      // Don't throw - pool will handle reconnection
    });

    // Feature #157: Track when clients are acquired/released for debugging
    pool.on('connect', () => {
      console.log('[Database] New client connected to pool');
    });

    pool.on('remove', () => {
      console.log('[Database] Client removed from pool');
    });

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    isConnected = true;
    connectionAttempts = 0;
    console.log(`[Database] PostgreSQL connection established successfully (pool: min=${POOL_MIN}, max=${POOL_MAX})`);

    // Feature #157: Start periodic pool stats logging
    startPoolStatsLogging();

    // Initialize schema
    await initializeSchema();

    return true;
  } catch (error) {
    connectionAttempts++;
    console.error(`[Database] Failed to connect (attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS}):`, error);

    if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
      console.log(`[Database] Retrying in ${RETRY_DELAY_MS}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return initializeDatabase();
    }

    console.warn('[Database] Max connection attempts reached - falling back to in-memory storage');
    return false;
  }
}

/**
 * Initialize the database schema
 * Feature #247: Schema SQL extracted to database-schema.ts for maintainability
 */
async function initializeSchema(): Promise<void> {
  if (!pool) return;

  try {
    const schemaSQL = getCompleteSchemaSQL();
    await pool.query(schemaSQL);
    console.log('[Database] Schema initialized successfully');
  } catch (error) {
    console.error('[Database] Failed to initialize schema:', error);
    throw error;
  }
}

/**
 * Get a client from the connection pool
 */
export async function getClient(): Promise<PoolClient | null> {
  if (!pool || !isConnected) {
    return null;
  }
  return pool.connect();
}

/**
 * Execute a query
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T> | null> {
  if (!pool || !isConnected) {
    return null;
  }
  return pool.query<T>(text, params);
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T | null> {
  if (!pool || !isConnected) {
    return null;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check if database is connected
 */
export function isDatabaseConnected(): boolean {
  return isConnected;
}

/**
 * Feature #157: Get current pool statistics
 */
export function getPoolStats(): PoolStats | null {
  if (!pool) {
    return null;
  }

  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
    maxConnections: POOL_MAX,
    minConnections: POOL_MIN,
    poolExhaustedCount,
    lastPoolExhaustedAt: lastPoolExhaustedAt?.toISOString() || null,
  };
}

/**
 * Feature #157: Start periodic pool stats logging
 */
function startPoolStatsLogging(): void {
  if (poolStatsInterval) {
    clearInterval(poolStatsInterval);
  }

  poolStatsInterval = setInterval(() => {
    if (!pool) return;

    const stats = getPoolStats();
    if (!stats) return;

    // Log warning if pool is near exhaustion
    const usagePercent = (stats.totalConnections / stats.maxConnections) * 100;
    if (usagePercent >= 80) {
      console.warn(`[Database] Pool near exhaustion: ${stats.totalConnections}/${stats.maxConnections} connections (${usagePercent.toFixed(1)}%), waiting: ${stats.waitingClients}`);
      poolExhaustedCount++;
      lastPoolExhaustedAt = new Date();
    } else if (stats.waitingClients > 0) {
      console.log(`[Database] Pool stats: ${stats.totalConnections}/${stats.maxConnections} connections, idle: ${stats.idleConnections}, waiting: ${stats.waitingClients}`);
    }
  }, POOL_STATS_INTERVAL);

  // Don't keep the process alive just for stats logging
  poolStatsInterval.unref();
}

/**
 * Feature #157: Stop pool stats logging
 */
function stopPoolStatsLogging(): void {
  if (poolStatsInterval) {
    clearInterval(poolStatsInterval);
    poolStatsInterval = null;
  }
}

/**
 * Close the database connection pool
 */
export async function closeDatabase(): Promise<void> {
  // Feature #157: Stop stats logging before closing pool
  stopPoolStatsLogging();

  if (pool) {
    await pool.end();
    pool = null;
    isConnected = false;
    console.log('[Database] Connection pool closed');
  }
}

/**
 * Feature #157: Enhanced health check with pool stats
 */
export interface DatabaseHealth {
  status: 'ok' | 'error';
  latency?: number;
  error?: string;
  pool?: PoolStats;
}

/**
 * Health check for the database
 */
export async function healthCheck(): Promise<DatabaseHealth> {
  if (!pool || !isConnected) {
    return { status: 'error', error: 'Database not connected' };
  }

  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    return {
      status: 'ok',
      latency: Date.now() - start,
      pool: getPoolStats() || undefined,
    };
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Feature #157: Acquire a connection with graceful retry on pool exhaustion
 * This wraps pool.connect() with retry logic for when the pool is temporarily exhausted
 */
export async function getConnectionWithRetry(maxRetries = 3, retryDelayMs = 100): Promise<PoolClient | null> {
  if (!pool || !isConnected) {
    return null;
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      return client;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if this is a pool exhaustion error (timeout waiting for connection)
      if (lastError.message.includes('timeout') || lastError.message.includes('exhausted')) {
        poolExhaustedCount++;
        lastPoolExhaustedAt = new Date();

        if (attempt < maxRetries) {
          console.warn(`[Database] Pool exhausted, retrying (${attempt}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
          continue;
        }
      }

      // Non-retryable error or max retries reached
      break;
    }
  }

  console.error('[Database] Failed to get connection after retries:', lastError?.message);
  return null;
}

// Export the pool for direct access if needed
export { pool };
