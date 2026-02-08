/**
 * Migration: Monitoring Tables
 * Feature #440: Complete database migration coverage
 *
 * Creates tables for:
 * - uptime_checks: HTTP uptime monitoring
 * - check_results: Time-series results data
 * - uptime_check_state: Consecutive failures tracking
 * - check_incidents: Incident records
 * - maintenance_windows: Scheduled maintenance
 * - transaction_checks/results: Multi-step transaction monitoring
 * - performance_checks/results: Lighthouse performance checks
 * - webhook_checks/events: Incoming webhook monitoring
 * - dns_checks/results: DNS record monitoring
 * - tcp_checks/results: TCP port monitoring
 * - status_pages: Public status pages
 * - monitoring_settings: Organization monitoring config
 * - deleted_check_history: Audit trail for deleted checks
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ============================================================================
  // Uptime Checks Table
  // ============================================================================
  pgm.createTable('uptime_checks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    organization_id: { type: 'uuid', references: 'organizations(id)', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    url: { type: 'text', notNull: true },
    method: { type: 'varchar(10)', notNull: true, default: "'GET'" },
    interval_seconds: { type: 'integer', notNull: true, default: 60 },
    timeout_ms: { type: 'integer', notNull: true, default: 10000 },
    expected_status: { type: 'integer', notNull: true, default: 200 },
    headers: { type: 'jsonb', default: pgm.func("'{}'::jsonb") },
    body: { type: 'text' },
    locations: { type: 'jsonb', default: pgm.func("'[\"us-east\"]'::jsonb") },
    assertions: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    ssl_expiry_warning_days: { type: 'integer', default: 30 },
    consecutive_failures_threshold: { type: 'integer', default: 1 },
    tags: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    group_name: { type: 'varchar(255)' },
    enabled: { type: 'boolean', default: true },
    paused_at: { type: 'timestamptz' },
    paused_by: { type: 'varchar(255)' },
    pause_reason: { type: 'text' },
    pause_expires_at: { type: 'timestamptz' },
    created_by: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('uptime_checks', 'organization_id', { ifNotExists: true, name: 'idx_uptime_checks_org' });
  pgm.createIndex('uptime_checks', 'enabled', { ifNotExists: true, name: 'idx_uptime_checks_enabled' });

  // ============================================================================
  // Check Results Table
  // ============================================================================
  pgm.createTable('check_results', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    check_id: { type: 'uuid', notNull: true },
    location: { type: 'varchar(50)', notNull: true },
    status: { type: 'varchar(20)', notNull: true },
    response_time_ms: { type: 'integer', notNull: true },
    status_code: { type: 'integer' },
    error: { type: 'text' },
    assertion_results: { type: 'jsonb' },
    assertions_passed: { type: 'integer' },
    assertions_failed: { type: 'integer' },
    ssl_info: { type: 'jsonb' },
    checked_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('check_results', 'check_id', { ifNotExists: true, name: 'idx_check_results_check' });
  pgm.createIndex('check_results', [{ name: 'checked_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_check_results_checked' });
  pgm.createIndex('check_results', ['check_id', { name: 'checked_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_check_results_check_time' });

  // ============================================================================
  // Uptime Check State Table
  // ============================================================================
  pgm.createTable('uptime_check_state', {
    check_id: { type: 'uuid', primaryKey: true },
    consecutive_failures: { type: 'integer', default: 0 },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  // ============================================================================
  // Check Incidents Table
  // ============================================================================
  pgm.createTable('check_incidents', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    check_id: { type: 'uuid', notNull: true },
    status: { type: 'varchar(20)', notNull: true },
    started_at: { type: 'timestamptz', notNull: true },
    ended_at: { type: 'timestamptz' },
    duration_seconds: { type: 'integer' },
    error: { type: 'text' },
    affected_locations: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
  }, { ifNotExists: true });

  pgm.createIndex('check_incidents', 'check_id', { ifNotExists: true, name: 'idx_check_incidents_check' });
  pgm.createIndex('check_incidents', [{ name: 'started_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_check_incidents_started' });

  // ============================================================================
  // Maintenance Windows Table
  // ============================================================================
  pgm.createTable('maintenance_windows', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    check_id: { type: 'uuid', notNull: true },
    name: { type: 'varchar(255)', notNull: true },
    start_time: { type: 'timestamptz', notNull: true },
    end_time: { type: 'timestamptz', notNull: true },
    reason: { type: 'text' },
    created_by: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('maintenance_windows', 'check_id', { ifNotExists: true, name: 'idx_maintenance_windows_check' });

  // ============================================================================
  // Transaction Checks Table
  // ============================================================================
  pgm.createTable('transaction_checks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    organization_id: { type: 'uuid', references: 'organizations(id)', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    steps: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
    interval_seconds: { type: 'integer', notNull: true, default: 300 },
    enabled: { type: 'boolean', default: true },
    created_by: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('transaction_checks', 'organization_id', { ifNotExists: true, name: 'idx_transaction_checks_org' });

  // ============================================================================
  // Transaction Results Table
  // ============================================================================
  pgm.createTable('transaction_results', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    transaction_id: { type: 'uuid', notNull: true },
    status: { type: 'varchar(20)', notNull: true },
    total_time_ms: { type: 'integer', notNull: true },
    step_results: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    checked_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('transaction_results', 'transaction_id', { ifNotExists: true, name: 'idx_transaction_results_tx' });

  // ============================================================================
  // Performance Checks Table
  // ============================================================================
  pgm.createTable('performance_checks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    organization_id: { type: 'uuid', references: 'organizations(id)', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    url: { type: 'text', notNull: true },
    interval_seconds: { type: 'integer', notNull: true, default: 300 },
    device: { type: 'varchar(20)', notNull: true, default: "'desktop'" },
    enabled: { type: 'boolean', default: true },
    created_by: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('performance_checks', 'organization_id', { ifNotExists: true, name: 'idx_performance_checks_org' });

  // ============================================================================
  // Performance Results Table
  // ============================================================================
  pgm.createTable('performance_results', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    check_id: { type: 'uuid', notNull: true },
    status: { type: 'varchar(20)', notNull: true },
    metrics: { type: 'jsonb', notNull: true },
    lighthouse_score: { type: 'integer' },
    checked_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('performance_results', 'check_id', { ifNotExists: true, name: 'idx_performance_results_check' });

  // ============================================================================
  // Webhook Checks Table (Incoming)
  // ============================================================================
  pgm.createTable('webhook_checks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    organization_id: { type: 'uuid', references: 'organizations(id)', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    webhook_url: { type: 'text', notNull: true },
    webhook_secret: { type: 'varchar(255)' },
    expected_interval_seconds: { type: 'integer', notNull: true, default: 300 },
    expected_payload: { type: 'jsonb' },
    enabled: { type: 'boolean', default: true },
    created_by: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('webhook_checks', 'organization_id', { ifNotExists: true, name: 'idx_webhook_checks_org' });

  // ============================================================================
  // Webhook Events Table
  // ============================================================================
  pgm.createTable('webhook_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    check_id: { type: 'uuid', notNull: true },
    received_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    source_ip: { type: 'varchar(45)' },
    headers: { type: 'jsonb', default: pgm.func("'{}'::jsonb") },
    payload: { type: 'jsonb' },
    payload_valid: { type: 'boolean', default: true },
    validation_errors: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    signature_valid: { type: 'boolean' },
  }, { ifNotExists: true });

  pgm.createIndex('webhook_events', 'check_id', { ifNotExists: true, name: 'idx_webhook_events_check' });
  pgm.createIndex('webhook_events', [{ name: 'received_at', sort: 'DESC' }], { ifNotExists: true, name: 'idx_webhook_events_received' });

  // ============================================================================
  // DNS Checks Table
  // ============================================================================
  pgm.createTable('dns_checks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    organization_id: { type: 'uuid', references: 'organizations(id)', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    domain: { type: 'varchar(255)', notNull: true },
    record_type: { type: 'varchar(10)', notNull: true, default: "'A'" },
    expected_values: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    nameservers: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    interval_seconds: { type: 'integer', notNull: true, default: 300 },
    timeout_ms: { type: 'integer', notNull: true, default: 5000 },
    enabled: { type: 'boolean', default: true },
    created_by: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('dns_checks', 'organization_id', { ifNotExists: true, name: 'idx_dns_checks_org' });

  // ============================================================================
  // DNS Results Table
  // ============================================================================
  pgm.createTable('dns_results', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    check_id: { type: 'uuid', notNull: true },
    status: { type: 'varchar(20)', notNull: true },
    resolved_values: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    expected_values: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    response_time_ms: { type: 'integer', notNull: true },
    nameserver_used: { type: 'varchar(255)' },
    error: { type: 'text' },
    ttl: { type: 'integer' },
    all_expected_found: { type: 'boolean', default: true },
    unexpected_values: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    checked_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('dns_results', 'check_id', { ifNotExists: true, name: 'idx_dns_results_check' });

  // ============================================================================
  // TCP Checks Table
  // ============================================================================
  pgm.createTable('tcp_checks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    organization_id: { type: 'uuid', references: 'organizations(id)', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    host: { type: 'varchar(255)', notNull: true },
    port: { type: 'integer', notNull: true },
    timeout_ms: { type: 'integer', notNull: true, default: 5000 },
    interval_seconds: { type: 'integer', notNull: true, default: 60 },
    enabled: { type: 'boolean', default: true },
    created_by: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('tcp_checks', 'organization_id', { ifNotExists: true, name: 'idx_tcp_checks_org' });

  // ============================================================================
  // TCP Results Table
  // ============================================================================
  pgm.createTable('tcp_results', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    check_id: { type: 'uuid', notNull: true },
    status: { type: 'varchar(20)', notNull: true },
    port_open: { type: 'boolean', notNull: true },
    response_time_ms: { type: 'integer', notNull: true },
    error: { type: 'text' },
    checked_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('tcp_results', 'check_id', { ifNotExists: true, name: 'idx_tcp_results_check' });

  // ============================================================================
  // Status Pages Table
  // ============================================================================
  pgm.createTable('status_pages', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuid_generate_v4()') },
    organization_id: { type: 'uuid', references: 'organizations(id)', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    slug: { type: 'varchar(255)', notNull: true, unique: true },
    description: { type: 'text' },
    logo_url: { type: 'text' },
    favicon_url: { type: 'text' },
    primary_color: { type: 'varchar(20)' },
    show_history_days: { type: 'integer', default: 7 },
    checks: { type: 'jsonb', default: pgm.func("'[]'::jsonb") },
    custom_domain: { type: 'varchar(255)' },
    is_public: { type: 'boolean', default: true },
    show_uptime_percentage: { type: 'boolean', default: true },
    show_response_time: { type: 'boolean', default: true },
    show_incidents: { type: 'boolean', default: true },
    created_by: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  pgm.createIndex('status_pages', 'organization_id', { ifNotExists: true, name: 'idx_status_pages_org' });

  // ============================================================================
  // Monitoring Settings Table
  // ============================================================================
  pgm.createTable('monitoring_settings', {
    organization_id: { type: 'uuid', primaryKey: true, references: 'organizations(id)', onDelete: 'CASCADE' },
    retention_days: { type: 'integer', notNull: true, default: 30 },
    auto_cleanup_enabled: { type: 'boolean', default: true },
    last_cleanup_at: { type: 'timestamptz' },
    updated_by: { type: 'varchar(255)' },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  }, { ifNotExists: true });

  // ============================================================================
  // Deleted Check History Table
  // ============================================================================
  pgm.createTable('deleted_check_history', {
    check_id: { type: 'uuid', primaryKey: true },
    check_name: { type: 'varchar(255)', notNull: true },
    check_type: { type: 'varchar(50)', notNull: true },
    organization_id: { type: 'uuid', notNull: true },
    deleted_by: { type: 'varchar(255)', notNull: true },
    deleted_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    check_config: { type: 'jsonb' },
    historical_results_count: { type: 'integer', default: 0 },
    last_status: { type: 'varchar(20)' },
  }, { ifNotExists: true });

  pgm.createIndex('deleted_check_history', 'organization_id', { ifNotExists: true, name: 'idx_deleted_check_history_org' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop tables in reverse order
  pgm.dropTable('deleted_check_history', { ifExists: true, cascade: true });
  pgm.dropTable('monitoring_settings', { ifExists: true, cascade: true });
  pgm.dropTable('status_pages', { ifExists: true, cascade: true });
  pgm.dropTable('tcp_results', { ifExists: true, cascade: true });
  pgm.dropTable('tcp_checks', { ifExists: true, cascade: true });
  pgm.dropTable('dns_results', { ifExists: true, cascade: true });
  pgm.dropTable('dns_checks', { ifExists: true, cascade: true });
  pgm.dropTable('webhook_events', { ifExists: true, cascade: true });
  pgm.dropTable('webhook_checks', { ifExists: true, cascade: true });
  pgm.dropTable('performance_results', { ifExists: true, cascade: true });
  pgm.dropTable('performance_checks', { ifExists: true, cascade: true });
  pgm.dropTable('transaction_results', { ifExists: true, cascade: true });
  pgm.dropTable('transaction_checks', { ifExists: true, cascade: true });
  pgm.dropTable('maintenance_windows', { ifExists: true, cascade: true });
  pgm.dropTable('check_incidents', { ifExists: true, cascade: true });
  pgm.dropTable('uptime_check_state', { ifExists: true, cascade: true });
  pgm.dropTable('check_results', { ifExists: true, cascade: true });
  pgm.dropTable('uptime_checks', { ifExists: true, cascade: true });
}
