/**
 * Webhook Persistence Migration
 * Feature #329: Persist webhook subscriptions and logs to PostgreSQL
 *
 * This migration creates tables for webhook subscriptions and delivery logs
 * so they survive server restarts. The existing 'webhooks' table from
 * database-schema.ts is simpler; this creates a more complete schema.
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ========================================
  // WEBHOOK SUBSCRIPTIONS TABLE
  // ========================================
  // Full schema matching the WebhookSubscription interface

  pgm.createTable('webhook_subscriptions', {
    id: { type: 'varchar(100)', primaryKey: true },
    organization_id: { type: 'uuid', notNull: true, references: 'organizations', onDelete: 'CASCADE' },
    project_id: { type: 'uuid', references: 'projects', onDelete: 'SET NULL' },
    // Feature #1299: Multi-project filtering - array of project IDs
    project_ids: { type: 'uuid[]', default: '{}' },
    // Feature #1300: Filter by result status
    result_statuses: { type: 'varchar(20)[]', default: '{}' },
    name: { type: 'varchar(255)', notNull: true },
    url: { type: 'text', notNull: true },
    events: { type: 'varchar(100)[]', notNull: true },
    headers: { type: 'jsonb', default: '{}' },
    secret: { type: 'varchar(255)' },
    // Feature #1291: Payload customization
    payload_template: { type: 'text' },
    // Feature #1294: Retry configuration
    retry_enabled: { type: 'boolean', default: true },
    max_retries: { type: 'integer', default: 5 },
    // Feature #1304: Batch delivery
    batch_enabled: { type: 'boolean', default: false },
    batch_size: { type: 'integer', default: 10 },
    batch_interval_seconds: { type: 'integer', default: 60 },
    enabled: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    last_triggered_at: { type: 'timestamptz' },
    failure_count: { type: 'integer', notNull: true, default: 0 },
    success_count: { type: 'integer', notNull: true, default: 0 },
    // Feature #321: Auto-disable on sustained failure
    consecutive_failures: { type: 'integer', notNull: true, default: 0 },
    disabled_at: { type: 'timestamptz' },
    disable_reason: { type: 'text' },
  }, { ifNotExists: true });

  // Indexes for webhook_subscriptions
  pgm.createIndex('webhook_subscriptions', 'organization_id', {
    ifNotExists: true,
    name: 'idx_webhook_subscriptions_org'
  });
  pgm.createIndex('webhook_subscriptions', 'project_id', {
    ifNotExists: true,
    name: 'idx_webhook_subscriptions_project'
  });
  pgm.createIndex('webhook_subscriptions', 'enabled', {
    ifNotExists: true,
    name: 'idx_webhook_subscriptions_enabled'
  });
  pgm.createIndex('webhook_subscriptions', [{ name: 'created_at', sort: 'DESC' }], {
    ifNotExists: true,
    name: 'idx_webhook_subscriptions_created'
  });

  // ========================================
  // WEBHOOK DELIVERY LOGS TABLE
  // ========================================
  // Stores delivery attempts for auditing and debugging

  pgm.createTable('webhook_delivery_logs', {
    id: { type: 'varchar(100)', primaryKey: true },
    subscription_id: { type: 'varchar(100)', notNull: true, references: 'webhook_subscriptions', onDelete: 'CASCADE' },
    subscription_name: { type: 'varchar(255)', notNull: true },
    event_type: { type: 'varchar(100)', notNull: true },
    url: { type: 'text', notNull: true },
    // Request details
    request_method: { type: 'varchar(10)', notNull: true, default: 'POST' },
    request_headers: { type: 'jsonb', notNull: true, default: '{}' },
    request_body: { type: 'text', notNull: true },
    request_size_bytes: { type: 'integer', notNull: true },
    // Response details
    response_status: { type: 'integer' },
    response_headers: { type: 'jsonb' },
    response_body: { type: 'text' },
    response_size_bytes: { type: 'integer' },
    duration_ms: { type: 'integer' },
    // Error details
    error_message: { type: 'text' },
    error_code: { type: 'varchar(50)' },
    // Retry tracking
    attempt_number: { type: 'integer', notNull: true, default: 1 },
    max_attempts: { type: 'integer', notNull: true, default: 1 },
    status: { type: 'varchar(20)', notNull: true }, // success, failed, pending_retry
    // Timestamps
    timestamp: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    completed_at: { type: 'timestamptz' },
    // Context
    run_id: { type: 'varchar(100)' },
    project_id: { type: 'uuid' },
    test_id: { type: 'uuid' },
  }, { ifNotExists: true });

  // Indexes for webhook_delivery_logs
  pgm.createIndex('webhook_delivery_logs', 'subscription_id', {
    ifNotExists: true,
    name: 'idx_webhook_delivery_logs_subscription'
  });
  pgm.createIndex('webhook_delivery_logs', [{ name: 'timestamp', sort: 'DESC' }], {
    ifNotExists: true,
    name: 'idx_webhook_delivery_logs_timestamp'
  });
  pgm.createIndex('webhook_delivery_logs', 'status', {
    ifNotExists: true,
    name: 'idx_webhook_delivery_logs_status'
  });
  pgm.createIndex('webhook_delivery_logs', 'event_type', {
    ifNotExists: true,
    name: 'idx_webhook_delivery_logs_event'
  });
  // Composite index for subscription + timestamp (common query pattern)
  pgm.createIndex('webhook_delivery_logs', ['subscription_id', { name: 'timestamp', sort: 'DESC' }], {
    ifNotExists: true,
    name: 'idx_webhook_delivery_logs_sub_timestamp'
  });

  console.log('[Migration] Webhook persistence tables created successfully');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop in reverse order due to foreign key
  pgm.dropTable('webhook_delivery_logs', { ifExists: true, cascade: true });
  pgm.dropTable('webhook_subscriptions', { ifExists: true, cascade: true });

  console.log('[Migration] Webhook persistence tables dropped');
}
