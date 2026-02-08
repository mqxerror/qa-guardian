/**
 * Migration: MCP (Model Context Protocol) Tables
 * Feature #440: Complete database migration coverage
 *
 * Creates tables for:
 * - mcp_connections: Active MCP connections
 * - mcp_tool_calls: Tool call history with retention
 * - mcp_audit_logs: Detailed MCP audit trail
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

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
