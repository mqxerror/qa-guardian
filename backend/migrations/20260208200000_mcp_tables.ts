/**
 * Migration: MCP (Model Context Protocol) Tables
 * Feature #440: Complete database migration coverage
 *
 * Creates tables for:
 * - mcp_connections: Active MCP connections
 * - mcp_tool_calls: Tool call history with retention
 * - mcp_audit_logs: Detailed MCP audit trail
 *
 * NOTE: All operations are idempotent. Tables may already exist from
 * service-level CREATE TABLE IF NOT EXISTS with a different schema.
 * Columns are defensively added to handle schema drift.
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

function ensureColumns(
  pgm: MigrationBuilder,
  table: string,
  columns: Array<{ name: string; type: string; notNull?: boolean; default?: string }>
): void {
  for (const col of columns) {
    const parts = [`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`];
    if (col.default !== undefined) {
      parts.push(`DEFAULT ${col.default}`);
    }
    if (col.notNull && col.default !== undefined) {
      parts.push('NOT NULL');
    }
    pgm.sql(parts.join(' ') + ';');
  }
}

function ensureForeignKey(
  pgm: MigrationBuilder,
  table: string,
  constraintName: string,
  column: string,
  refTable: string,
  refColumn: string,
  onDelete: string = 'CASCADE'
): void {
  pgm.sql(`
    DO $$ BEGIN
      ALTER TABLE "${table}" ADD CONSTRAINT "${constraintName}"
        FOREIGN KEY ("${column}") REFERENCES "${refTable}"("${refColumn}") ON DELETE ${onDelete};
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ============================================================================
  // MCP Connections Table
  // ============================================================================
  pgm.createTable('mcp_connections', {
    id: {
      type: 'varchar(100)',
      primaryKey: true,
    },
    api_key_id: {
      type: 'uuid',
      references: 'api_keys(id)',
      onDelete: 'CASCADE',
    },
    api_key_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    organization_id: {
      type: 'uuid',
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    connected_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    last_activity_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    client_info: {
      type: 'jsonb',
    },
    ip_address: {
      type: 'varchar(45)',
    },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'mcp_connections', [
    { name: 'api_key_id', type: 'uuid' },
    { name: 'api_key_name', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'organization_id', type: 'uuid' },
    { name: 'connected_at', type: 'timestamptz', default: 'NOW()' },
    { name: 'last_activity_at', type: 'timestamptz', default: 'NOW()' },
    { name: 'client_info', type: 'jsonb' },
    { name: 'ip_address', type: 'varchar(45)' },
  ]);

  ensureForeignKey(pgm, 'mcp_connections', 'mcp_connections_api_key_id_fkey', 'api_key_id', 'api_keys', 'id', 'CASCADE');
  ensureForeignKey(pgm, 'mcp_connections', 'mcp_connections_organization_id_fkey', 'organization_id', 'organizations', 'id', 'CASCADE');

  pgm.createIndex('mcp_connections', 'organization_id', { ifNotExists: true, name: 'idx_mcp_connections_org' });
  pgm.createIndex('mcp_connections', 'api_key_id', { ifNotExists: true, name: 'idx_mcp_connections_api_key' });
  pgm.createIndex('mcp_connections', 'connected_at', { ifNotExists: true, name: 'idx_mcp_connections_connected' });

  // ============================================================================
  // MCP Tool Calls Table
  // ============================================================================
  pgm.createTable('mcp_tool_calls', {
    id: {
      type: 'varchar(100)',
      primaryKey: true,
    },
    connection_id: {
      type: 'varchar(100)',
      references: 'mcp_connections(id)',
      onDelete: 'SET NULL',
    },
    organization_id: {
      type: 'uuid',
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    api_key_id: {
      type: 'uuid',
      references: 'api_keys(id)',
      onDelete: 'SET NULL',
    },
    tool_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    timestamp: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    duration_ms: {
      type: 'integer',
    },
    success: {
      type: 'boolean',
      default: true,
    },
    error: {
      type: 'text',
    },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'mcp_tool_calls', [
    { name: 'connection_id', type: 'varchar(100)' },
    { name: 'organization_id', type: 'uuid' },
    { name: 'api_key_id', type: 'uuid' },
    { name: 'tool_name', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'timestamp', type: 'timestamptz', default: 'NOW()' },
    { name: 'duration_ms', type: 'integer' },
    { name: 'success', type: 'boolean', default: 'true' },
    { name: 'error', type: 'text' },
  ]);

  ensureForeignKey(pgm, 'mcp_tool_calls', 'mcp_tool_calls_connection_id_fkey', 'connection_id', 'mcp_connections', 'id', 'SET NULL');
  ensureForeignKey(pgm, 'mcp_tool_calls', 'mcp_tool_calls_organization_id_fkey', 'organization_id', 'organizations', 'id', 'CASCADE');
  ensureForeignKey(pgm, 'mcp_tool_calls', 'mcp_tool_calls_api_key_id_fkey', 'api_key_id', 'api_keys', 'id', 'SET NULL');

  pgm.createIndex('mcp_tool_calls', 'organization_id', { ifNotExists: true, name: 'idx_mcp_tool_calls_org' });
  pgm.createIndex('mcp_tool_calls', 'connection_id', { ifNotExists: true, name: 'idx_mcp_tool_calls_connection' });
  pgm.createIndex('mcp_tool_calls', 'tool_name', { ifNotExists: true, name: 'idx_mcp_tool_calls_tool' });
  pgm.createIndex('mcp_tool_calls', [{ name: 'timestamp', sort: 'DESC' }], { ifNotExists: true, name: 'idx_mcp_tool_calls_timestamp' });
  pgm.createIndex('mcp_tool_calls', ['organization_id', { name: 'timestamp', sort: 'DESC' }], { ifNotExists: true, name: 'idx_mcp_tool_calls_org_timestamp' });

  // ============================================================================
  // MCP Audit Logs Table
  // ============================================================================
  pgm.createTable('mcp_audit_logs', {
    id: {
      type: 'varchar(100)',
      primaryKey: true,
    },
    timestamp: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    organization_id: {
      type: 'uuid',
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    api_key_id: {
      type: 'uuid',
      references: 'api_keys(id)',
      onDelete: 'SET NULL',
    },
    api_key_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    connection_id: {
      type: 'varchar(100)',
    },
    client_name: {
      type: 'varchar(255)',
    },
    client_version: {
      type: 'varchar(100)',
    },
    method: {
      type: 'varchar(100)',
      notNull: true,
    },
    tool_name: {
      type: 'varchar(255)',
    },
    resource_uri: {
      type: 'text',
    },
    request_params: {
      type: 'jsonb',
    },
    response_type: {
      type: 'varchar(20)',
      notNull: true,
    },
    response_error_code: {
      type: 'integer',
    },
    response_error_message: {
      type: 'text',
    },
    response_data_preview: {
      type: 'text',
    },
    duration_ms: {
      type: 'integer',
    },
    ip_address: {
      type: 'varchar(45)',
    },
    user_agent: {
      type: 'text',
    },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'mcp_audit_logs', [
    { name: 'timestamp', type: 'timestamptz', default: 'NOW()' },
    { name: 'organization_id', type: 'uuid' },
    { name: 'api_key_id', type: 'uuid' },
    { name: 'api_key_name', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'connection_id', type: 'varchar(100)' },
    { name: 'client_name', type: 'varchar(255)' },
    { name: 'client_version', type: 'varchar(100)' },
    { name: 'method', type: 'varchar(100)', notNull: true, default: "''" },
    { name: 'tool_name', type: 'varchar(255)' },
    { name: 'resource_uri', type: 'text' },
    { name: 'request_params', type: 'jsonb' },
    { name: 'response_type', type: 'varchar(20)', notNull: true, default: "''" },
    { name: 'response_error_code', type: 'integer' },
    { name: 'response_error_message', type: 'text' },
    { name: 'response_data_preview', type: 'text' },
    { name: 'duration_ms', type: 'integer' },
    { name: 'ip_address', type: 'varchar(45)' },
    { name: 'user_agent', type: 'text' },
  ]);

  ensureForeignKey(pgm, 'mcp_audit_logs', 'mcp_audit_logs_organization_id_fkey', 'organization_id', 'organizations', 'id', 'CASCADE');
  ensureForeignKey(pgm, 'mcp_audit_logs', 'mcp_audit_logs_api_key_id_fkey', 'api_key_id', 'api_keys', 'id', 'SET NULL');

  pgm.createIndex('mcp_audit_logs', 'organization_id', { ifNotExists: true, name: 'idx_mcp_audit_logs_org' });
  pgm.createIndex('mcp_audit_logs', [{ name: 'timestamp', sort: 'DESC' }], { ifNotExists: true, name: 'idx_mcp_audit_logs_timestamp' });
  pgm.createIndex('mcp_audit_logs', 'method', { ifNotExists: true, name: 'idx_mcp_audit_logs_method' });
  pgm.createIndex('mcp_audit_logs', 'tool_name', { ifNotExists: true, name: 'idx_mcp_audit_logs_tool' });
  pgm.createIndex('mcp_audit_logs', ['organization_id', { name: 'timestamp', sort: 'DESC' }], { ifNotExists: true, name: 'idx_mcp_audit_logs_org_timestamp' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('mcp_audit_logs', { ifExists: true, cascade: true });
  pgm.dropTable('mcp_tool_calls', { ifExists: true, cascade: true });
  pgm.dropTable('mcp_connections', { ifExists: true, cascade: true });
}
