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
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

// Database connection pool
let pool: Pool | null = null;

// Connection state tracking
let isConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;
const RETRY_DELAY_MS = 2000;

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
    pool = new Pool({
      connectionString: databaseUrl,
      max: 20, // Maximum pool size
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 10000, // Connection timeout of 10 seconds
      ssl: databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    });

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    isConnected = true;
    connectionAttempts = 0;
    console.log('[Database] PostgreSQL connection established successfully');

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
 */
async function initializeSchema(): Promise<void> {
  if (!pool) return;

  const schemaSQL = `
    -- Enable UUID extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Organizations table
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      settings JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      avatar_url TEXT,
      role VARCHAR(50) NOT NULL DEFAULT 'viewer',
      email_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Projects table
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      description TEXT,
      base_url TEXT,
      archived BOOLEAN DEFAULT FALSE,
      settings JSONB DEFAULT '{}',
      visual_settings JSONB DEFAULT '{}',
      healing_settings JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(organization_id, slug)
    );

    -- Test Suites table
    CREATE TABLE IF NOT EXISTS test_suites (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      type VARCHAR(50) NOT NULL DEFAULT 'e2e',
      config JSONB DEFAULT '{}',
      tags TEXT[] DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Tests table
    CREATE TABLE IF NOT EXISTS tests (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      suite_id UUID REFERENCES test_suites(id) ON DELETE CASCADE,
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      type VARCHAR(50) NOT NULL DEFAULT 'e2e',
      config JSONB DEFAULT '{}',
      code TEXT,
      enabled BOOLEAN DEFAULT TRUE,
      priority INTEGER DEFAULT 0,
      tags TEXT[] DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Test Runs table (Feature #2082: Extended for full TestRun interface)
    CREATE TABLE IF NOT EXISTS test_runs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
      suite_id UUID REFERENCES test_suites(id) ON DELETE CASCADE,
      suite_name VARCHAR(255),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      project_name VARCHAR(255),
      schedule_id UUID,
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      results JSONB DEFAULT '[]',
      metrics JSONB DEFAULT '{}',
      error_message TEXT,
      duration_ms INTEGER,
      browser VARCHAR(50),
      branch VARCHAR(255) DEFAULT 'main',
      test_type VARCHAR(50),
      viewport JSONB,
      started_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      accessibility_results JSONB,
      run_env_vars JSONB,
      priority INTEGER DEFAULT 100,
      triggered_by VARCHAR(50),
      user_id UUID,
      pr_number INTEGER
    );

    -- Selector Overrides table (Feature #2082: Manual selector overrides)
    CREATE TABLE IF NOT EXISTS selector_overrides (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      test_id VARCHAR(255) NOT NULL,
      step_id VARCHAR(255) NOT NULL,
      original_selector TEXT NOT NULL,
      new_selector TEXT NOT NULL,
      override_by VARCHAR(255),
      override_by_email VARCHAR(255),
      override_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(test_id, step_id)
    );

    -- Healed Selector History table (Feature #2082: AI selector healing history)
    CREATE TABLE IF NOT EXISTS healed_selector_history (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      run_id VARCHAR(255),
      test_id VARCHAR(255) NOT NULL,
      step_id VARCHAR(255) NOT NULL,
      original_selector TEXT NOT NULL,
      healed_selector TEXT NOT NULL,
      strategy VARCHAR(100),
      healing_strategy VARCHAR(100),
      confidence DECIMAL(5,4),
      healing_confidence DECIMAL(5,4),
      healed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      was_successful BOOLEAN,
      was_accepted BOOLEAN,
      accepted_by VARCHAR(255),
      accepted_at TIMESTAMP WITH TIME ZONE,
      was_rejected BOOLEAN,
      rejection_reason TEXT,
      rejected_by VARCHAR(255),
      rejected_at TIMESTAMP WITH TIME ZONE,
      suggested_alternative TEXT,
      suggested_selector TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(test_id, step_id)
    );

    -- API Keys table
    CREATE TABLE IF NOT EXISTS api_keys (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      key_hash VARCHAR(255) NOT NULL,
      key_prefix VARCHAR(20) NOT NULL,
      scopes TEXT[] DEFAULT '{}',
      rate_limit INTEGER DEFAULT 1000,
      last_used_at TIMESTAMP WITH TIME ZONE,
      expires_at TIMESTAMP WITH TIME ZONE,
      revoked_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Sessions table (for user authentication)
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      device VARCHAR(100),
      browser VARCHAR(100),
      ip_address VARCHAR(45),
      last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Token Blacklist table (Feature #2083: Invalidated JWT tokens)
    CREATE TABLE IF NOT EXISTS token_blacklist (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      token_hash VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Reset Tokens table (Feature #2083: Password reset tokens)
    CREATE TABLE IF NOT EXISTS reset_tokens (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      token_hash VARCHAR(255) UNIQUE NOT NULL,
      user_email VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      used_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Visual Baselines table
    CREATE TABLE IF NOT EXISTS visual_baselines (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      viewport VARCHAR(50),
      browser VARCHAR(50),
      screenshot_path TEXT NOT NULL,
      screenshot_hash VARCHAR(64),
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(test_id, viewport, browser)
    );

    -- Flaky Tests table
    CREATE TABLE IF NOT EXISTS flaky_tests (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      flaky_score DECIMAL(5,2) DEFAULT 0,
      total_runs INTEGER DEFAULT 0,
      failed_runs INTEGER DEFAULT 0,
      last_flaky_at TIMESTAMP WITH TIME ZONE,
      quarantined BOOLEAN DEFAULT FALSE,
      analysis JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(test_id)
    );

    -- Schedules table
    CREATE TABLE IF NOT EXISTS schedules (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      suite_id UUID REFERENCES test_suites(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      cron_expression VARCHAR(100) NOT NULL,
      enabled BOOLEAN DEFAULT TRUE,
      config JSONB DEFAULT '{}',
      last_run_at TIMESTAMP WITH TIME ZONE,
      next_run_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Webhooks table
    CREATE TABLE IF NOT EXISTS webhooks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      secret VARCHAR(255),
      events TEXT[] NOT NULL,
      enabled BOOLEAN DEFAULT TRUE,
      headers JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Audit Logs table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      resource_type VARCHAR(100) NOT NULL,
      resource_id UUID,
      details JSONB DEFAULT '{}',
      ip_address VARCHAR(45),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_projects_organization ON projects(organization_id);
    CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(organization_id, slug);
    CREATE INDEX IF NOT EXISTS idx_test_suites_project ON test_suites(project_id);
    CREATE INDEX IF NOT EXISTS idx_tests_suite ON tests(suite_id);
    CREATE INDEX IF NOT EXISTS idx_tests_project ON tests(project_id);
    CREATE INDEX IF NOT EXISTS idx_test_runs_test ON test_runs(test_id);
    CREATE INDEX IF NOT EXISTS idx_test_runs_suite ON test_runs(suite_id);
    CREATE INDEX IF NOT EXISTS idx_test_runs_project ON test_runs(project_id);
    CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
    CREATE INDEX IF NOT EXISTS idx_test_runs_created ON test_runs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_test_runs_organization ON test_runs(organization_id);
    CREATE INDEX IF NOT EXISTS idx_selector_overrides_test ON selector_overrides(test_id);
    CREATE INDEX IF NOT EXISTS idx_healed_selector_history_test ON healed_selector_history(test_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_organization ON api_keys(organization_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);
    CREATE INDEX IF NOT EXISTS idx_reset_tokens_email ON reset_tokens(user_email);
    CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON reset_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_visual_baselines_test ON visual_baselines(test_id);
    CREATE INDEX IF NOT EXISTS idx_flaky_tests_test ON flaky_tests(test_id);
    CREATE INDEX IF NOT EXISTS idx_flaky_tests_project ON flaky_tests(project_id);
    CREATE INDEX IF NOT EXISTS idx_schedules_project ON schedules(project_id);
    CREATE INDEX IF NOT EXISTS idx_webhooks_organization ON webhooks(organization_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_organization ON audit_logs(organization_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
  `;

  try {
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
 * Close the database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    isConnected = false;
    console.log('[Database] Connection pool closed');
  }
}

/**
 * Health check for the database
 */
export async function healthCheck(): Promise<{ status: 'ok' | 'error'; latency?: number; error?: string }> {
  if (!pool || !isConnected) {
    return { status: 'error', error: 'Database not connected' };
  }

  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    return { status: 'ok', latency: Date.now() - start };
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Export the pool for direct access if needed
export { pool };
