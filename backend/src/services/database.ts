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

    -- API Keys table (Feature #2084: Extended for full ApiKey interface)
    CREATE TABLE IF NOT EXISTS api_keys (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      key_hash VARCHAR(255) NOT NULL,
      key_prefix VARCHAR(20) NOT NULL,
      scopes TEXT[] DEFAULT '{}',
      rate_limit INTEGER DEFAULT 100,
      rate_limit_window INTEGER DEFAULT 60,
      burst_limit INTEGER DEFAULT 20,
      burst_window INTEGER DEFAULT 10,
      last_used_at TIMESTAMP WITH TIME ZONE,
      expires_at TIMESTAMP WITH TIME ZONE,
      created_by UUID,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      revoked_at TIMESTAMP WITH TIME ZONE
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

    -- Invitations table (Feature #2085: Organization invitations)
    CREATE TABLE IF NOT EXISTS invitations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      invited_by UUID,
      token_hash VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      accepted_at TIMESTAMP WITH TIME ZONE,
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

    -- MCP Connections table (Feature #2084: Active MCP connections)
    CREATE TABLE IF NOT EXISTS mcp_connections (
      id VARCHAR(100) PRIMARY KEY,
      api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
      api_key_name VARCHAR(255) NOT NULL,
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      client_info JSONB,
      ip_address VARCHAR(45)
    );

    -- MCP Tool Calls table (Feature #2084: Tool call history with retention)
    CREATE TABLE IF NOT EXISTS mcp_tool_calls (
      id VARCHAR(100) PRIMARY KEY,
      connection_id VARCHAR(100) REFERENCES mcp_connections(id) ON DELETE SET NULL,
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
      tool_name VARCHAR(255) NOT NULL,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      duration_ms INTEGER,
      success BOOLEAN DEFAULT TRUE,
      error TEXT
    );

    -- MCP Audit Logs table (Feature #2084: Detailed MCP audit trail)
    CREATE TABLE IF NOT EXISTS mcp_audit_logs (
      id VARCHAR(100) PRIMARY KEY,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
      api_key_name VARCHAR(255) NOT NULL,
      connection_id VARCHAR(100),
      client_name VARCHAR(255),
      client_version VARCHAR(100),
      method VARCHAR(100) NOT NULL,
      tool_name VARCHAR(255),
      resource_uri TEXT,
      request_params JSONB,
      response_type VARCHAR(20) NOT NULL,
      response_error_code INTEGER,
      response_error_message TEXT,
      response_data_preview TEXT,
      duration_ms INTEGER,
      ip_address VARCHAR(45),
      user_agent TEXT
    );

    -- ========================================
    -- MONITORING TABLES (Feature #2086)
    -- ========================================

    -- Uptime checks table
    CREATE TABLE IF NOT EXISTS uptime_checks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      method VARCHAR(10) NOT NULL DEFAULT 'GET',
      interval_seconds INTEGER NOT NULL DEFAULT 60,
      timeout_ms INTEGER NOT NULL DEFAULT 10000,
      expected_status INTEGER NOT NULL DEFAULT 200,
      headers JSONB DEFAULT '{}',
      body TEXT,
      locations JSONB DEFAULT '["us-east"]',
      assertions JSONB DEFAULT '[]',
      ssl_expiry_warning_days INTEGER DEFAULT 30,
      consecutive_failures_threshold INTEGER DEFAULT 1,
      tags JSONB DEFAULT '[]',
      group_name VARCHAR(255),
      enabled BOOLEAN DEFAULT TRUE,
      paused_at TIMESTAMP WITH TIME ZONE,
      paused_by VARCHAR(255),
      pause_reason TEXT,
      pause_expires_at TIMESTAMP WITH TIME ZONE,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Check results table (time-series data)
    CREATE TABLE IF NOT EXISTS check_results (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      check_id UUID NOT NULL,
      location VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL,
      response_time_ms INTEGER NOT NULL,
      status_code INTEGER,
      error TEXT,
      assertion_results JSONB,
      assertions_passed INTEGER,
      assertions_failed INTEGER,
      ssl_info JSONB,
      checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Uptime check state table (for consecutive failures tracking)
    CREATE TABLE IF NOT EXISTS uptime_check_state (
      check_id UUID PRIMARY KEY,
      consecutive_failures INTEGER DEFAULT 0,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Check incidents table
    CREATE TABLE IF NOT EXISTS check_incidents (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      check_id UUID NOT NULL,
      status VARCHAR(20) NOT NULL,
      started_at TIMESTAMP WITH TIME ZONE NOT NULL,
      ended_at TIMESTAMP WITH TIME ZONE,
      duration_seconds INTEGER,
      error TEXT,
      affected_locations JSONB DEFAULT '[]'
    );

    -- Maintenance windows table
    CREATE TABLE IF NOT EXISTS maintenance_windows (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      check_id UUID NOT NULL,
      name VARCHAR(255) NOT NULL,
      start_time TIMESTAMP WITH TIME ZONE NOT NULL,
      end_time TIMESTAMP WITH TIME ZONE NOT NULL,
      reason TEXT,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Transaction checks table
    CREATE TABLE IF NOT EXISTS transaction_checks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      steps JSONB NOT NULL DEFAULT '[]',
      interval_seconds INTEGER NOT NULL DEFAULT 300,
      enabled BOOLEAN DEFAULT TRUE,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Transaction results table
    CREATE TABLE IF NOT EXISTS transaction_results (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      transaction_id UUID NOT NULL,
      status VARCHAR(20) NOT NULL,
      total_time_ms INTEGER NOT NULL,
      step_results JSONB DEFAULT '[]',
      checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Performance checks table
    CREATE TABLE IF NOT EXISTS performance_checks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      interval_seconds INTEGER NOT NULL DEFAULT 300,
      device VARCHAR(20) NOT NULL DEFAULT 'desktop',
      enabled BOOLEAN DEFAULT TRUE,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Performance results table
    CREATE TABLE IF NOT EXISTS performance_results (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      check_id UUID NOT NULL,
      status VARCHAR(20) NOT NULL,
      metrics JSONB NOT NULL,
      lighthouse_score INTEGER,
      checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Webhook checks table
    CREATE TABLE IF NOT EXISTS webhook_checks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      webhook_url TEXT NOT NULL,
      webhook_secret VARCHAR(255),
      expected_interval_seconds INTEGER NOT NULL DEFAULT 300,
      expected_payload JSONB,
      enabled BOOLEAN DEFAULT TRUE,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Webhook events table
    CREATE TABLE IF NOT EXISTS webhook_events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      check_id UUID NOT NULL,
      received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      source_ip VARCHAR(45),
      headers JSONB DEFAULT '{}',
      payload JSONB,
      payload_valid BOOLEAN DEFAULT TRUE,
      validation_errors JSONB DEFAULT '[]',
      signature_valid BOOLEAN
    );

    -- DNS checks table
    CREATE TABLE IF NOT EXISTS dns_checks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      domain VARCHAR(255) NOT NULL,
      record_type VARCHAR(10) NOT NULL DEFAULT 'A',
      expected_values JSONB DEFAULT '[]',
      nameservers JSONB DEFAULT '[]',
      interval_seconds INTEGER NOT NULL DEFAULT 300,
      timeout_ms INTEGER NOT NULL DEFAULT 5000,
      enabled BOOLEAN DEFAULT TRUE,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- DNS results table
    CREATE TABLE IF NOT EXISTS dns_results (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      check_id UUID NOT NULL,
      status VARCHAR(20) NOT NULL,
      resolved_values JSONB DEFAULT '[]',
      expected_values JSONB DEFAULT '[]',
      response_time_ms INTEGER NOT NULL,
      nameserver_used VARCHAR(255),
      error TEXT,
      ttl INTEGER,
      all_expected_found BOOLEAN DEFAULT TRUE,
      unexpected_values JSONB DEFAULT '[]',
      checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- TCP checks table
    CREATE TABLE IF NOT EXISTS tcp_checks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      host VARCHAR(255) NOT NULL,
      port INTEGER NOT NULL,
      timeout_ms INTEGER NOT NULL DEFAULT 5000,
      interval_seconds INTEGER NOT NULL DEFAULT 60,
      enabled BOOLEAN DEFAULT TRUE,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- TCP results table
    CREATE TABLE IF NOT EXISTS tcp_results (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      check_id UUID NOT NULL,
      status VARCHAR(20) NOT NULL,
      port_open BOOLEAN NOT NULL,
      response_time_ms INTEGER NOT NULL,
      error TEXT,
      checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Status pages table
    CREATE TABLE IF NOT EXISTS status_pages (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      logo_url TEXT,
      favicon_url TEXT,
      primary_color VARCHAR(20),
      show_history_days INTEGER DEFAULT 7,
      checks JSONB DEFAULT '[]',
      custom_domain VARCHAR(255),
      is_public BOOLEAN DEFAULT TRUE,
      show_uptime_percentage BOOLEAN DEFAULT TRUE,
      show_response_time BOOLEAN DEFAULT TRUE,
      show_incidents BOOLEAN DEFAULT TRUE,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Monitoring settings table
    CREATE TABLE IF NOT EXISTS monitoring_settings (
      organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      retention_days INTEGER NOT NULL DEFAULT 30,
      auto_cleanup_enabled BOOLEAN DEFAULT TRUE,
      last_cleanup_at TIMESTAMP WITH TIME ZONE,
      updated_by VARCHAR(255),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Deleted check history table (audit)
    CREATE TABLE IF NOT EXISTS deleted_check_history (
      check_id UUID PRIMARY KEY,
      check_name VARCHAR(255) NOT NULL,
      check_type VARCHAR(50) NOT NULL,
      organization_id UUID NOT NULL,
      deleted_by VARCHAR(255) NOT NULL,
      deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      check_config JSONB,
      historical_results_count INTEGER DEFAULT 0,
      last_status VARCHAR(20)
    );

    -- GitHub Integration tables (Feature #2087)
    CREATE TABLE IF NOT EXISTS github_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      installation_id VARCHAR(255),
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at TIMESTAMP WITH TIME ZONE,
      scope VARCHAR(255),
      owner VARCHAR(255) NOT NULL,
      repo VARCHAR(255) NOT NULL,
      default_branch VARCHAR(100) DEFAULT 'main',
      webhook_secret TEXT,
      webhook_url TEXT,
      enabled BOOLEAN DEFAULT TRUE,
      last_sync_at TIMESTAMP WITH TIME ZONE,
      sync_status VARCHAR(50) DEFAULT 'pending',
      sync_error TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_by VARCHAR(255),
      UNIQUE(organization_id, owner, repo)
    );

    CREATE TABLE IF NOT EXISTS pr_status_checks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      connection_id UUID NOT NULL REFERENCES github_connections(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      pr_number INTEGER NOT NULL,
      pr_title TEXT,
      pr_url TEXT,
      head_sha VARCHAR(40) NOT NULL,
      base_branch VARCHAR(255),
      head_branch VARCHAR(255),
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      conclusion VARCHAR(50),
      check_run_id VARCHAR(255),
      details_url TEXT,
      test_run_id UUID,
      tests_total INTEGER DEFAULT 0,
      tests_passed INTEGER DEFAULT 0,
      tests_failed INTEGER DEFAULT 0,
      tests_skipped INTEGER DEFAULT 0,
      started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      completed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pr_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      connection_id UUID NOT NULL REFERENCES github_connections(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      pr_number INTEGER NOT NULL,
      comment_id VARCHAR(255),
      comment_type VARCHAR(50) NOT NULL DEFAULT 'general',
      body TEXT NOT NULL,
      path TEXT,
      line INTEGER,
      side VARCHAR(10),
      commit_id VARCHAR(40),
      in_reply_to_id VARCHAR(255),
      posted_at TIMESTAMP WITH TIME ZONE,
      posted_by VARCHAR(255),
      is_bot BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pr_dependency_scans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      connection_id UUID NOT NULL REFERENCES github_connections(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      pr_number INTEGER NOT NULL,
      head_sha VARCHAR(40) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      vulnerabilities_found INTEGER DEFAULT 0,
      critical_count INTEGER DEFAULT 0,
      high_count INTEGER DEFAULT 0,
      medium_count INTEGER DEFAULT 0,
      low_count INTEGER DEFAULT 0,
      vulnerabilities JSONB DEFAULT '[]',
      scan_started_at TIMESTAMP WITH TIME ZONE,
      scan_completed_at TIMESTAMP WITH TIME ZONE,
      scan_error TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_github_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_expires_at TIMESTAMP WITH TIME ZONE,
      scope VARCHAR(255),
      github_username VARCHAR(255),
      github_user_id VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id, organization_id)
    );

    -- DAST (Dynamic Application Security Testing) tables (Feature #2088)
    CREATE TABLE IF NOT EXISTS dast_configs (
      project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
      enabled BOOLEAN DEFAULT FALSE,
      target_url TEXT,
      scan_profile VARCHAR(50) DEFAULT 'baseline',
      auth_config JSONB,
      context_config JSONB,
      alert_threshold VARCHAR(20) DEFAULT 'LOW',
      auto_scan BOOLEAN DEFAULT FALSE,
      last_scan_at TIMESTAMP WITH TIME ZONE,
      last_scan_status VARCHAR(50),
      openapi_spec_id UUID,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dast_scans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      target_url TEXT NOT NULL,
      scan_profile VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      started_at TIMESTAMP WITH TIME ZONE NOT NULL,
      completed_at TIMESTAMP WITH TIME ZONE,
      alerts JSONB DEFAULT '[]',
      summary JSONB NOT NULL,
      statistics JSONB,
      error TEXT,
      endpoints_tested JSONB,
      scope_config JSONB,
      progress JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dast_false_positives (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      plugin_id VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      param TEXT,
      reason TEXT NOT NULL,
      marked_by VARCHAR(255) NOT NULL,
      marked_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS openapi_specs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      version VARCHAR(100),
      content TEXT NOT NULL,
      endpoints JSONB DEFAULT '[]',
      uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL,
      uploaded_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS dast_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      frequency VARCHAR(50) NOT NULL,
      cron_expression VARCHAR(100) NOT NULL,
      timezone VARCHAR(100) NOT NULL,
      enabled BOOLEAN DEFAULT TRUE,
      scan_profile VARCHAR(50) NOT NULL,
      target_url TEXT NOT NULL,
      notify_on_failure BOOLEAN DEFAULT FALSE,
      notify_on_high_severity BOOLEAN DEFAULT FALSE,
      email_recipients JSONB DEFAULT '[]',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_by VARCHAR(255) NOT NULL,
      next_run_at TIMESTAMP WITH TIME ZONE,
      last_run_at TIMESTAMP WITH TIME ZONE,
      last_run_id UUID,
      run_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS graphql_scans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      config JSONB NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'introspecting',
      started_at TIMESTAMP WITH TIME ZONE NOT NULL,
      completed_at TIMESTAMP WITH TIME ZONE,
      schema JSONB,
      operations_tested JSONB DEFAULT '[]',
      findings JSONB DEFAULT '[]',
      summary JSONB NOT NULL,
      progress JSONB,
      error TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- SAST (Static Application Security Testing) tables (Feature #2089)
    CREATE TABLE IF NOT EXISTS sast_configs (
      project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
      enabled BOOLEAN DEFAULT FALSE,
      ruleset VARCHAR(50) DEFAULT 'default',
      custom_rules JSONB DEFAULT '[]',
      custom_rules_yaml JSONB DEFAULT '[]',
      exclude_paths JSONB DEFAULT '[]',
      severity_threshold VARCHAR(20) DEFAULT 'MEDIUM',
      auto_scan BOOLEAN DEFAULT FALSE,
      last_scan_at TIMESTAMP WITH TIME ZONE,
      last_scan_status VARCHAR(50),
      pr_checks_enabled BOOLEAN DEFAULT FALSE,
      pr_comments_enabled BOOLEAN DEFAULT FALSE,
      block_pr_on_critical BOOLEAN DEFAULT FALSE,
      block_pr_on_high BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sast_scans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      repository_url TEXT,
      branch VARCHAR(255),
      commit_sha VARCHAR(40),
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      started_at TIMESTAMP WITH TIME ZONE NOT NULL,
      completed_at TIMESTAMP WITH TIME ZONE,
      findings JSONB DEFAULT '[]',
      summary JSONB NOT NULL,
      error TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sast_false_positives (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      rule_id VARCHAR(255) NOT NULL,
      file_path TEXT NOT NULL,
      line INTEGER NOT NULL,
      snippet TEXT,
      reason TEXT NOT NULL,
      marked_by VARCHAR(255) NOT NULL,
      marked_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sast_pr_checks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      pr_number INTEGER NOT NULL,
      pr_title TEXT,
      head_sha VARCHAR(40) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      conclusion VARCHAR(50),
      context VARCHAR(255) NOT NULL,
      description TEXT,
      target_url TEXT,
      scan_id UUID,
      findings JSONB,
      blocked BOOLEAN DEFAULT FALSE,
      block_reason TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sast_pr_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      pr_number INTEGER NOT NULL,
      scan_id UUID NOT NULL,
      body TEXT NOT NULL,
      findings JSONB NOT NULL,
      blocked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS secret_patterns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      pattern TEXT NOT NULL,
      severity VARCHAR(20) NOT NULL,
      category VARCHAR(100) NOT NULL,
      enabled BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
    CREATE INDEX IF NOT EXISTS idx_invitations_organization ON invitations(organization_id);
    CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
    CREATE INDEX IF NOT EXISTS idx_visual_baselines_test ON visual_baselines(test_id);
    CREATE INDEX IF NOT EXISTS idx_flaky_tests_test ON flaky_tests(test_id);
    CREATE INDEX IF NOT EXISTS idx_flaky_tests_project ON flaky_tests(project_id);
    CREATE INDEX IF NOT EXISTS idx_webhooks_organization ON webhooks(organization_id);
    -- Note: audit_logs indexes moved to after table creation (see line ~1180)
    CREATE INDEX IF NOT EXISTS idx_mcp_connections_organization ON mcp_connections(organization_id);
    CREATE INDEX IF NOT EXISTS idx_mcp_connections_api_key ON mcp_connections(api_key_id);
    CREATE INDEX IF NOT EXISTS idx_mcp_connections_activity ON mcp_connections(last_activity_at);
    CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_organization ON mcp_tool_calls(organization_id);
    CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_timestamp ON mcp_tool_calls(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_organization ON mcp_audit_logs(organization_id);
    CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_timestamp ON mcp_audit_logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_mcp_audit_logs_api_key ON mcp_audit_logs(api_key_id);

    -- Monitoring indexes (Feature #2086)
    CREATE INDEX IF NOT EXISTS idx_uptime_checks_organization ON uptime_checks(organization_id);
    CREATE INDEX IF NOT EXISTS idx_uptime_checks_enabled ON uptime_checks(enabled);
    CREATE INDEX IF NOT EXISTS idx_check_results_check ON check_results(check_id);
    CREATE INDEX IF NOT EXISTS idx_check_results_checked_at ON check_results(checked_at DESC);
    CREATE INDEX IF NOT EXISTS idx_check_incidents_check ON check_incidents(check_id);
    CREATE INDEX IF NOT EXISTS idx_check_incidents_started ON check_incidents(started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_maintenance_windows_check ON maintenance_windows(check_id);
    CREATE INDEX IF NOT EXISTS idx_transaction_checks_organization ON transaction_checks(organization_id);
    CREATE INDEX IF NOT EXISTS idx_transaction_results_transaction ON transaction_results(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_performance_checks_organization ON performance_checks(organization_id);
    CREATE INDEX IF NOT EXISTS idx_performance_results_check ON performance_results(check_id);
    CREATE INDEX IF NOT EXISTS idx_webhook_checks_organization ON webhook_checks(organization_id);
    CREATE INDEX IF NOT EXISTS idx_webhook_events_check ON webhook_events(check_id);
    CREATE INDEX IF NOT EXISTS idx_webhook_events_received ON webhook_events(received_at DESC);
    CREATE INDEX IF NOT EXISTS idx_dns_checks_organization ON dns_checks(organization_id);
    CREATE INDEX IF NOT EXISTS idx_dns_results_check ON dns_results(check_id);
    CREATE INDEX IF NOT EXISTS idx_tcp_checks_organization ON tcp_checks(organization_id);
    CREATE INDEX IF NOT EXISTS idx_tcp_results_check ON tcp_results(check_id);
    CREATE INDEX IF NOT EXISTS idx_status_pages_organization ON status_pages(organization_id);
    CREATE INDEX IF NOT EXISTS idx_status_pages_slug ON status_pages(slug);
    CREATE INDEX IF NOT EXISTS idx_deleted_check_history_org ON deleted_check_history(organization_id);

    -- GitHub Integration indexes (Feature #2087)
    CREATE INDEX IF NOT EXISTS idx_github_connections_organization ON github_connections(organization_id);
    CREATE INDEX IF NOT EXISTS idx_github_connections_repo ON github_connections(owner, repo);
    CREATE INDEX IF NOT EXISTS idx_github_connections_enabled ON github_connections(enabled);
    CREATE INDEX IF NOT EXISTS idx_pr_status_checks_connection ON pr_status_checks(connection_id);
    CREATE INDEX IF NOT EXISTS idx_pr_status_checks_organization ON pr_status_checks(organization_id);
    CREATE INDEX IF NOT EXISTS idx_pr_status_checks_pr ON pr_status_checks(connection_id, pr_number);
    CREATE INDEX IF NOT EXISTS idx_pr_status_checks_sha ON pr_status_checks(head_sha);
    CREATE INDEX IF NOT EXISTS idx_pr_status_checks_status ON pr_status_checks(status);
    CREATE INDEX IF NOT EXISTS idx_pr_comments_connection ON pr_comments(connection_id);
    CREATE INDEX IF NOT EXISTS idx_pr_comments_organization ON pr_comments(organization_id);
    CREATE INDEX IF NOT EXISTS idx_pr_comments_pr ON pr_comments(connection_id, pr_number);
    CREATE INDEX IF NOT EXISTS idx_pr_dependency_scans_connection ON pr_dependency_scans(connection_id);
    CREATE INDEX IF NOT EXISTS idx_pr_dependency_scans_organization ON pr_dependency_scans(organization_id);
    CREATE INDEX IF NOT EXISTS idx_pr_dependency_scans_pr ON pr_dependency_scans(connection_id, pr_number);
    CREATE INDEX IF NOT EXISTS idx_pr_dependency_scans_status ON pr_dependency_scans(status);
    CREATE INDEX IF NOT EXISTS idx_user_github_tokens_user ON user_github_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_github_tokens_organization ON user_github_tokens(organization_id);

    -- DAST indexes (Feature #2088)
    CREATE INDEX IF NOT EXISTS idx_dast_scans_project ON dast_scans(project_id);
    CREATE INDEX IF NOT EXISTS idx_dast_scans_status ON dast_scans(status);
    CREATE INDEX IF NOT EXISTS idx_dast_scans_started ON dast_scans(started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_dast_false_positives_project ON dast_false_positives(project_id);
    CREATE INDEX IF NOT EXISTS idx_dast_false_positives_plugin ON dast_false_positives(plugin_id);
    CREATE INDEX IF NOT EXISTS idx_openapi_specs_project ON openapi_specs(project_id);
    CREATE INDEX IF NOT EXISTS idx_dast_schedules_project ON dast_schedules(project_id);
    CREATE INDEX IF NOT EXISTS idx_dast_schedules_organization ON dast_schedules(organization_id);
    CREATE INDEX IF NOT EXISTS idx_dast_schedules_enabled ON dast_schedules(enabled);
    CREATE INDEX IF NOT EXISTS idx_dast_schedules_next_run ON dast_schedules(next_run_at);
    CREATE INDEX IF NOT EXISTS idx_graphql_scans_status ON graphql_scans(status);
    CREATE INDEX IF NOT EXISTS idx_graphql_scans_started ON graphql_scans(started_at DESC);

    -- SAST indexes (Feature #2089)
    CREATE INDEX IF NOT EXISTS idx_sast_scans_project ON sast_scans(project_id);
    CREATE INDEX IF NOT EXISTS idx_sast_scans_status ON sast_scans(status);
    CREATE INDEX IF NOT EXISTS idx_sast_scans_started ON sast_scans(started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sast_false_positives_project ON sast_false_positives(project_id);
    CREATE INDEX IF NOT EXISTS idx_sast_false_positives_rule ON sast_false_positives(rule_id);
    CREATE INDEX IF NOT EXISTS idx_sast_pr_checks_project ON sast_pr_checks(project_id);
    CREATE INDEX IF NOT EXISTS idx_sast_pr_checks_pr ON sast_pr_checks(project_id, pr_number);
    CREATE INDEX IF NOT EXISTS idx_sast_pr_checks_status ON sast_pr_checks(status);
    CREATE INDEX IF NOT EXISTS idx_sast_pr_comments_project ON sast_pr_comments(project_id);
    CREATE INDEX IF NOT EXISTS idx_sast_pr_comments_pr ON sast_pr_comments(project_id, pr_number);
    CREATE INDEX IF NOT EXISTS idx_secret_patterns_project ON secret_patterns(project_id);
    CREATE INDEX IF NOT EXISTS idx_secret_patterns_enabled ON secret_patterns(enabled);

    -- AI Generated Tests table (Feature #2090)
    CREATE TABLE IF NOT EXISTS ai_generated_tests (
      id VARCHAR(100) PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      generated_code TEXT NOT NULL,
      test_name VARCHAR(255) NOT NULL,
      language VARCHAR(20) NOT NULL DEFAULT 'typescript',
      confidence_score DECIMAL(5,4) NOT NULL,
      confidence_level VARCHAR(20) NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      parent_version_id VARCHAR(100),
      feedback TEXT,
      ai_metadata JSONB NOT NULL DEFAULT '{}',
      options JSONB NOT NULL DEFAULT '{}',
      suggested_variations JSONB DEFAULT '[]',
      improvement_suggestions JSONB DEFAULT '[]',
      approval JSONB NOT NULL DEFAULT '{"status": "pending"}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- AI Generated Tests indexes (Feature #2090)
    CREATE INDEX IF NOT EXISTS idx_ai_generated_tests_user ON ai_generated_tests(user_id);
    CREATE INDEX IF NOT EXISTS idx_ai_generated_tests_organization ON ai_generated_tests(organization_id);
    CREATE INDEX IF NOT EXISTS idx_ai_generated_tests_project ON ai_generated_tests(project_id);
    CREATE INDEX IF NOT EXISTS idx_ai_generated_tests_approval_status ON ai_generated_tests((approval->>'status'));
    CREATE INDEX IF NOT EXISTS idx_ai_generated_tests_created ON ai_generated_tests(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_generated_tests_version_chain ON ai_generated_tests(user_id, LOWER(TRIM(description)));
    CREATE INDEX IF NOT EXISTS idx_ai_generated_tests_parent ON ai_generated_tests(parent_version_id);

    -- Reports table (Feature #2091)
    CREATE TABLE IF NOT EXISTS reports (
      id VARCHAR(100) PRIMARY KEY,
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      project_name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_by VARCHAR(255) NOT NULL,
      title VARCHAR(500) NOT NULL,
      description TEXT,
      period JSONB NOT NULL DEFAULT '{}',
      executive_summary JSONB NOT NULL DEFAULT '{}',
      sections JSONB NOT NULL DEFAULT '{}',
      generated_by VARCHAR(50) NOT NULL DEFAULT 'api',
      format VARCHAR(20) NOT NULL DEFAULT 'html',
      view_url TEXT NOT NULL
    );

    -- Reports indexes (Feature #2091)
    CREATE INDEX IF NOT EXISTS idx_reports_organization ON reports(organization_id);
    CREATE INDEX IF NOT EXISTS idx_reports_project ON reports(project_id);
    CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reports_format ON reports(format);

    -- Schedules table (Feature #2092)
    CREATE TABLE IF NOT EXISTS schedules (
      id VARCHAR(100) PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      suite_id VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      cron_expression VARCHAR(100),
      run_at TIMESTAMP WITH TIME ZONE,
      timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
      enabled BOOLEAN NOT NULL DEFAULT true,
      browsers JSONB NOT NULL DEFAULT '["chromium"]',
      notify_on_failure BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_by VARCHAR(255) NOT NULL,
      next_run_at TIMESTAMP WITH TIME ZONE,
      last_run_id VARCHAR(100),
      run_count INTEGER NOT NULL DEFAULT 0
    );

    -- Schedules indexes (Feature #2092)
    CREATE INDEX IF NOT EXISTS idx_schedules_organization ON schedules(organization_id);
    CREATE INDEX IF NOT EXISTS idx_schedules_suite ON schedules(suite_id);
    CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled);
    CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON schedules(next_run_at) WHERE enabled = true;

    -- Audit Logs table (Feature #2093)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(100) PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id VARCHAR(255) NOT NULL,
      user_email VARCHAR(255) NOT NULL,
      action VARCHAR(100) NOT NULL,
      resource_type VARCHAR(100) NOT NULL,
      resource_id VARCHAR(255) NOT NULL,
      resource_name VARCHAR(500),
      details JSONB,
      ip_address VARCHAR(45) NOT NULL,
      user_agent TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Audit Logs indexes (Feature #2093)
    CREATE INDEX IF NOT EXISTS idx_audit_logs_organization ON audit_logs(organization_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
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
