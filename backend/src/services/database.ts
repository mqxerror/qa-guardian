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
 * - Feature #409: Query timeout support (queryWithTimeout, transactionWithTimeout)
 *
 * Environment Variables:
 * - DATABASE_URL / SUPABASE_DATABASE_URL: PostgreSQL connection string
 * - DB_POOL_MIN: Minimum pool size (default: 2)
 * - DB_POOL_MAX: Maximum pool size (default: 20)
 * - DB_POOL_IDLE_TIMEOUT: Idle connection timeout in ms (default: 30000)
 * - DB_POOL_CONNECTION_TIMEOUT: Connection acquisition timeout in ms (default: 5000)
 * - DB_POOL_STATS_INTERVAL: Stats logging interval in ms (default: 60000)
 * - DB_QUERY_TIMEOUT: Statement timeout in ms (default: 5000)
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getCompleteSchemaSQL } from './database-schema.js';
import { createLogger } from './logger.js';

// Feature #439: Structured logging for database service
const logger = createLogger('database');

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
// Feature #409: Query timeout in milliseconds (default 5 seconds)
const QUERY_TIMEOUT_MS = parseInt(process.env.DB_QUERY_TIMEOUT || '5000', 10);

// Feature #157: Pool monitoring state
let poolStatsInterval: NodeJS.Timeout | null = null;
let poolExhaustedCount = 0;
let lastPoolExhaustedAt: Date | null = null;

/**
 * Feature #157: Pool statistics interface for health endpoint
 * Feature #409: Added query timeout info
 */
export interface PoolStats {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  maxConnections: number;
  minConnections: number;
  poolExhaustedCount: number;
  lastPoolExhaustedAt: string | null;
  queryTimeoutMs: number; // Feature #409
}

/**
 * Initialize the database connection pool
 */
export async function initializeDatabase(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

  if (!databaseUrl) {
    logger.warn({ action: 'init' }, 'No DATABASE_URL configured - using in-memory storage');
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
      logger.error({ error: err.message }, 'Pool error');
      // Don't throw - pool will handle reconnection
    });

    // Feature #157: Track when clients are acquired/released for debugging
    pool.on('connect', () => {
      logger.debug({ action: 'connect' }, 'New client connected to pool');
    });

    pool.on('remove', () => {
      logger.debug({ action: 'remove' }, 'Client removed from pool');
    });

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    isConnected = true;
    connectionAttempts = 0;
    logger.info({ poolMin: POOL_MIN, poolMax: POOL_MAX, queryTimeoutMs: QUERY_TIMEOUT_MS }, 'PostgreSQL connection established');

    // Feature #157: Start periodic pool stats logging
    startPoolStatsLogging();

    // Initialize schema
    await initializeSchema();

    return true;
  } catch (error) {
    connectionAttempts++;
    logger.error({ attempt: connectionAttempts, maxAttempts: MAX_CONNECTION_ATTEMPTS, error }, 'Failed to connect');

    if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
      logger.info({ retryDelayMs: RETRY_DELAY_MS }, 'Retrying connection');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return initializeDatabase();
    }

    logger.warn({ maxAttempts: MAX_CONNECTION_ATTEMPTS }, 'Max connection attempts reached - falling back to in-memory storage');
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
    logger.info({ action: 'schema_init' }, 'Schema initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize schema');
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
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T> | null> {
  if (!pool || !isConnected) {
    return null;
  }
  return pool.query<T>(text, params);
}

/**
 * Feature #409: Execute a query with statement-level timeout
 * Wraps the query with PostgreSQL's statement_timeout to prevent runaway queries.
 * The timeout is reset after each query to not affect subsequent queries.
 *
 * @param text - SQL query text
 * @param params - Query parameters
 * @param timeoutMs - Query timeout in milliseconds (default: QUERY_TIMEOUT_MS from env or 5000ms)
 * @returns Query result or null if not connected
 * @throws Error if query times out
 */
export async function queryWithTimeout<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
  timeoutMs: number = QUERY_TIMEOUT_MS
): Promise<QueryResult<T> | null> {
  if (!pool || !isConnected) {
    return null;
  }

  const client = await pool.connect();
  try {
    // Set statement timeout for this session
    await client.query(`SET statement_timeout = ${timeoutMs}`);

    // Execute the actual query
    const result = await client.query<T>(text, params);

    // Reset timeout to default (0 = no limit) for connection reuse
    await client.query('SET statement_timeout = 0');

    return result;
  } catch (error) {
    // Reset timeout before releasing even on error
    try {
      await client.query('SET statement_timeout = 0');
    } catch {
      // Ignore reset errors - connection may be dead
    }

    // Check if this was a timeout error
    if (error instanceof Error && error.message.includes('statement timeout')) {
      logger.error({ timeoutMs, queryPreview: text.substring(0, 100) }, 'Query timed out');
      throw new Error(`Query timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Feature #409: Get the configured query timeout
 */
export function getQueryTimeout(): number {
  return QUERY_TIMEOUT_MS;
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
 * Feature #409: Execute a transaction with statement-level timeout
 * All queries within the transaction will have the specified timeout.
 *
 * @param callback - Function receiving the client to execute queries
 * @param timeoutMs - Query timeout in milliseconds (default: QUERY_TIMEOUT_MS from env or 5000ms)
 * @returns Transaction result or null if not connected
 * @throws Error if any query times out
 */
export async function transactionWithTimeout<T>(
  callback: (client: PoolClient) => Promise<T>,
  timeoutMs: number = QUERY_TIMEOUT_MS
): Promise<T | null> {
  if (!pool || !isConnected) {
    return null;
  }

  const client = await pool.connect();
  try {
    // Set statement timeout for entire transaction
    await client.query(`SET statement_timeout = ${timeoutMs}`);
    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');

    // Reset timeout for connection reuse
    await client.query('SET statement_timeout = 0');

    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
      await client.query('SET statement_timeout = 0');
    } catch {
      // Ignore cleanup errors
    }

    // Check if this was a timeout error
    if (error instanceof Error && error.message.includes('statement timeout')) {
      logger.error({ timeoutMs }, 'Transaction query timed out');
      throw new Error(`Transaction query timed out after ${timeoutMs}ms`);
    }
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
    queryTimeoutMs: QUERY_TIMEOUT_MS, // Feature #409
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
      logger.warn({ totalConnections: stats.totalConnections, maxConnections: stats.maxConnections, usagePercent: usagePercent.toFixed(1), waitingClients: stats.waitingClients }, 'Pool near exhaustion');
      poolExhaustedCount++;
      lastPoolExhaustedAt = new Date();
    } else if (stats.waitingClients > 0) {
      logger.debug({ totalConnections: stats.totalConnections, maxConnections: stats.maxConnections, idleConnections: stats.idleConnections, waitingClients: stats.waitingClients }, 'Pool stats');
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
    logger.info({ action: 'close' }, 'Connection pool closed');
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
          logger.warn({ attempt, maxRetries }, 'Pool exhausted, retrying');
          await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
          continue;
        }
      }

      // Non-retryable error or max retries reached
      break;
    }
  }

  logger.error({ error: lastError?.message }, 'Failed to get connection after retries');
  return null;
}

// Export the pool for direct access if needed
export { pool };
