/**
 * API Keys Repository for PostgreSQL
 *
 * This repository provides database persistence for API keys, MCP connections,
 * tool calls, and audit logs. Falls back to in-memory storage when database
 * is unavailable.
 *
 * Feature #2084: Migrate API Keys Module to PostgreSQL
 */

import { query, isDatabaseConnected } from '../database';
import {
  ApiKey,
  McpConnection,
  McpToolCall,
  McpAuditLogEntry
} from '../../routes/api-keys/types';
import crypto from 'crypto';

// In-memory fallback stores
const memoryApiKeys: Map<string, ApiKey> = new Map();
const memoryMcpConnections: Map<string, McpConnection> = new Map();
const memoryMcpToolCalls: Map<string, McpToolCall[]> = new Map();
const memoryMcpAuditLogs: Map<string, McpAuditLogEntry[]> = new Map();

// Export memory stores for compatibility
export function getMemoryApiKeys(): Map<string, ApiKey> {
  return memoryApiKeys;
}

export function getMemoryMcpConnections(): Map<string, McpConnection> {
  return memoryMcpConnections;
}

export function getMemoryMcpToolCalls(): Map<string, McpToolCall[]> {
  return memoryMcpToolCalls;
}

export function getMemoryMcpAuditLogs(): Map<string, McpAuditLogEntry[]> {
  return memoryMcpAuditLogs;
}

// ============================================================================
// API Key Functions
// ============================================================================

interface ApiKeyRow {
  id: string;
  organization_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: Date | null;
  expires_at: Date | null;
  created_by: string;
  created_at: Date;
  revoked_at: Date | null;
  rate_limit: number | null;
  rate_limit_window: number | null;
  burst_limit: number | null;
  burst_window: number | null;
}

function rowToApiKey(row: ApiKeyRow): ApiKey {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    key_hash: row.key_hash,
    key_prefix: row.key_prefix,
    scopes: row.scopes || [],
    last_used_at: row.last_used_at,
    expires_at: row.expires_at,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
    revoked_at: row.revoked_at,
    rate_limit: row.rate_limit ?? undefined,
    rate_limit_window: row.rate_limit_window ?? undefined,
    burst_limit: row.burst_limit ?? undefined,
    burst_window: row.burst_window ?? undefined,
  };
}

export async function createApiKey(apiKey: ApiKey): Promise<ApiKey> {
  // Always store in memory for fast access
  memoryApiKeys.set(apiKey.id, apiKey);

  if (isDatabaseConnected()) {
    try {
      await query(
        `INSERT INTO api_keys (
          id, organization_id, name, key_hash, key_prefix, scopes,
          last_used_at, expires_at, created_by, created_at, revoked_at,
          rate_limit, rate_limit_window, burst_limit, burst_window
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          apiKey.id,
          apiKey.organization_id,
          apiKey.name,
          apiKey.key_hash,
          apiKey.key_prefix,
          apiKey.scopes,
          apiKey.last_used_at,
          apiKey.expires_at,
          apiKey.created_by,
          apiKey.created_at,
          apiKey.revoked_at,
          apiKey.rate_limit ?? null,
          apiKey.rate_limit_window ?? null,
          apiKey.burst_limit ?? null,
          apiKey.burst_window ?? null,
        ]
      );
    } catch (error) {
      console.error('[API Keys Repo] Failed to create API key in database:', error);
    }
  }

  return apiKey;
}

export async function getApiKeyById(id: string): Promise<ApiKey | null> {
  // Try memory first for speed
  const memKey = memoryApiKeys.get(id);
  if (memKey) return memKey;

  if (isDatabaseConnected()) {
    try {
      const result = await query<ApiKeyRow>(
        'SELECT * FROM api_keys WHERE id = $1',
        [id]
      );
      if (result && result.rows.length > 0) {
        const apiKey = rowToApiKey(result.rows[0]);
        memoryApiKeys.set(id, apiKey);
        return apiKey;
      }
    } catch (error) {
      console.error('[API Keys Repo] Failed to get API key from database:', error);
    }
  }

  return null;
}

export async function getApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
  // Try memory first
  for (const [, key] of memoryApiKeys) {
    if (key.key_hash === keyHash && !key.revoked_at) {
      return key;
    }
  }

  if (isDatabaseConnected()) {
    try {
      const result = await query<ApiKeyRow>(
        'SELECT * FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL',
        [keyHash]
      );
      if (result && result.rows.length > 0) {
        const apiKey = rowToApiKey(result.rows[0]);
        memoryApiKeys.set(apiKey.id, apiKey);
        return apiKey;
      }
    } catch (error) {
      console.error('[API Keys Repo] Failed to get API key by hash:', error);
    }
  }

  return null;
}

export async function listApiKeysByOrg(orgId: string): Promise<ApiKey[]> {
  const keys: ApiKey[] = [];

  if (isDatabaseConnected()) {
    try {
      const result = await query<ApiKeyRow>(
        'SELECT * FROM api_keys WHERE organization_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC',
        [orgId]
      );
      if (result) {
        for (const row of result.rows) {
          const apiKey = rowToApiKey(row);
          memoryApiKeys.set(apiKey.id, apiKey);
          keys.push(apiKey);
        }
        return keys;
      }
    } catch (error) {
      console.error('[API Keys Repo] Failed to list API keys:', error);
    }
  }

  // Fallback to memory
  for (const [, key] of memoryApiKeys) {
    if (key.organization_id === orgId && !key.revoked_at) {
      keys.push(key);
    }
  }

  return keys;
}

export async function updateApiKey(id: string, updates: Partial<ApiKey>): Promise<ApiKey | null> {
  const existing = await getApiKeyById(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates };
  memoryApiKeys.set(id, updated);

  if (isDatabaseConnected()) {
    try {
      await query(
        `UPDATE api_keys SET
          last_used_at = $2,
          revoked_at = $3,
          rate_limit = $4,
          rate_limit_window = $5,
          burst_limit = $6,
          burst_window = $7
        WHERE id = $1`,
        [
          id,
          updated.last_used_at,
          updated.revoked_at,
          updated.rate_limit ?? null,
          updated.rate_limit_window ?? null,
          updated.burst_limit ?? null,
          updated.burst_window ?? null,
        ]
      );
    } catch (error) {
      console.error('[API Keys Repo] Failed to update API key:', error);
    }
  }

  return updated;
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const apiKey = await getApiKeyById(id);
  if (!apiKey) return false;

  apiKey.revoked_at = new Date();
  memoryApiKeys.set(id, apiKey);

  if (isDatabaseConnected()) {
    try {
      await query(
        'UPDATE api_keys SET revoked_at = $2 WHERE id = $1',
        [id, apiKey.revoked_at]
      );
    } catch (error) {
      console.error('[API Keys Repo] Failed to revoke API key:', error);
    }
  }

  return true;
}

// ============================================================================
// MCP Connection Functions
// ============================================================================

interface McpConnectionRow {
  id: string;
  api_key_id: string;
  api_key_name: string;
  organization_id: string;
  connected_at: Date;
  last_activity_at: Date;
  client_info: Record<string, unknown> | null;
  ip_address: string | null;
}

function rowToMcpConnection(row: McpConnectionRow): McpConnection {
  return {
    id: row.id,
    api_key_id: row.api_key_id,
    api_key_name: row.api_key_name,
    organization_id: row.organization_id,
    connected_at: new Date(row.connected_at),
    last_activity_at: new Date(row.last_activity_at),
    client_info: row.client_info as McpConnection['client_info'],
    ip_address: row.ip_address ?? undefined,
  };
}

export async function createMcpConnection(connection: McpConnection): Promise<McpConnection> {
  memoryMcpConnections.set(connection.id, connection);

  if (isDatabaseConnected()) {
    try {
      await query(
        `INSERT INTO mcp_connections (
          id, api_key_id, api_key_name, organization_id, connected_at,
          last_activity_at, client_info, ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          connection.id,
          connection.api_key_id,
          connection.api_key_name,
          connection.organization_id,
          connection.connected_at,
          connection.last_activity_at,
          connection.client_info ? JSON.stringify(connection.client_info) : null,
          connection.ip_address ?? null,
        ]
      );
    } catch (error) {
      console.error('[API Keys Repo] Failed to create MCP connection:', error);
    }
  }

  return connection;
}

export async function getMcpConnection(id: string): Promise<McpConnection | null> {
  const memConn = memoryMcpConnections.get(id);
  if (memConn) return memConn;

  if (isDatabaseConnected()) {
    try {
      const result = await query<McpConnectionRow>(
        'SELECT * FROM mcp_connections WHERE id = $1',
        [id]
      );
      if (result && result.rows.length > 0) {
        const conn = rowToMcpConnection(result.rows[0]);
        memoryMcpConnections.set(id, conn);
        return conn;
      }
    } catch (error) {
      console.error('[API Keys Repo] Failed to get MCP connection:', error);
    }
  }

  return null;
}

export async function updateMcpConnectionActivity(id: string): Promise<void> {
  const connection = memoryMcpConnections.get(id);
  if (connection) {
    connection.last_activity_at = new Date();
  }

  if (isDatabaseConnected()) {
    try {
      await query(
        'UPDATE mcp_connections SET last_activity_at = $2 WHERE id = $1',
        [id, new Date()]
      );
    } catch (error) {
      console.error('[API Keys Repo] Failed to update MCP connection activity:', error);
    }
  }
}

export async function deleteMcpConnection(id: string): Promise<void> {
  memoryMcpConnections.delete(id);

  if (isDatabaseConnected()) {
    try {
      await query('DELETE FROM mcp_connections WHERE id = $1', [id]);
    } catch (error) {
      console.error('[API Keys Repo] Failed to delete MCP connection:', error);
    }
  }
}

export async function cleanupStaleMcpConnections(staleThresholdMs: number = 30 * 60 * 1000): Promise<number> {
  const now = Date.now();
  let cleaned = 0;

  // Clean memory
  for (const [connectionId, connection] of memoryMcpConnections) {
    if (now - connection.last_activity_at.getTime() > staleThresholdMs) {
      memoryMcpConnections.delete(connectionId);
      cleaned++;
    }
  }

  // Clean database
  if (isDatabaseConnected()) {
    try {
      const staleTime = new Date(now - staleThresholdMs);
      const result = await query(
        'DELETE FROM mcp_connections WHERE last_activity_at < $1',
        [staleTime]
      );
      if (result) {
        cleaned = Math.max(cleaned, result.rowCount || 0);
      }
    } catch (error) {
      console.error('[API Keys Repo] Failed to cleanup stale connections:', error);
    }
  }

  return cleaned;
}

// ============================================================================
// MCP Tool Call Functions
// ============================================================================

interface McpToolCallRow {
  id: string;
  connection_id: string;
  organization_id: string;
  api_key_id: string;
  tool_name: string;
  timestamp: Date;
  duration_ms: number | null;
  success: boolean;
  error: string | null;
}

function rowToMcpToolCall(row: McpToolCallRow): McpToolCall {
  return {
    id: row.id,
    connection_id: row.connection_id,
    organization_id: row.organization_id,
    api_key_id: row.api_key_id,
    tool_name: row.tool_name,
    timestamp: new Date(row.timestamp),
    duration_ms: row.duration_ms ?? undefined,
    success: row.success,
    error: row.error ?? undefined,
  };
}

export async function createMcpToolCall(toolCall: McpToolCall): Promise<McpToolCall> {
  // Store in memory (with retention)
  const orgId = toolCall.organization_id;
  let orgToolCalls = memoryMcpToolCalls.get(orgId);
  if (!orgToolCalls) {
    orgToolCalls = [];
    memoryMcpToolCalls.set(orgId, orgToolCalls);
  }
  orgToolCalls.push(toolCall);

  // Keep only last 1000 entries per org
  if (orgToolCalls.length > 1000) {
    orgToolCalls.shift();
  }

  if (isDatabaseConnected()) {
    try {
      await query(
        `INSERT INTO mcp_tool_calls (
          id, connection_id, organization_id, api_key_id, tool_name,
          timestamp, duration_ms, success, error
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          toolCall.id,
          toolCall.connection_id,
          toolCall.organization_id,
          toolCall.api_key_id,
          toolCall.tool_name,
          toolCall.timestamp,
          toolCall.duration_ms ?? null,
          toolCall.success,
          toolCall.error ?? null,
        ]
      );

      // Enforce retention in database (delete oldest beyond 1000 per org)
      await query(
        `DELETE FROM mcp_tool_calls WHERE id IN (
          SELECT id FROM mcp_tool_calls
          WHERE organization_id = $1
          ORDER BY timestamp DESC
          OFFSET 1000
        )`,
        [orgId]
      );
    } catch (error) {
      console.error('[API Keys Repo] Failed to create MCP tool call:', error);
    }
  }

  return toolCall;
}

export async function getMcpToolCallsByOrg(
  orgId: string,
  since?: Date
): Promise<McpToolCall[]> {
  if (isDatabaseConnected()) {
    try {
      let sql = 'SELECT * FROM mcp_tool_calls WHERE organization_id = $1';
      const params: any[] = [orgId];

      if (since) {
        sql += ' AND timestamp >= $2';
        params.push(since);
      }

      sql += ' ORDER BY timestamp DESC LIMIT 1000';

      const result = await query<McpToolCallRow>(sql, params);
      if (result) {
        const calls = result.rows.map(rowToMcpToolCall);
        // Update memory cache
        memoryMcpToolCalls.set(orgId, calls);
        return calls;
      }
    } catch (error) {
      console.error('[API Keys Repo] Failed to get MCP tool calls:', error);
    }
  }

  // Fallback to memory
  const memCalls = memoryMcpToolCalls.get(orgId) || [];
  if (since) {
    return memCalls.filter(c => c.timestamp >= since);
  }
  return memCalls;
}

// ============================================================================
// MCP Audit Log Functions
// ============================================================================

interface McpAuditLogRow {
  id: string;
  timestamp: Date;
  organization_id: string;
  api_key_id: string;
  api_key_name: string;
  connection_id: string | null;
  client_name: string | null;
  client_version: string | null;
  method: string;
  tool_name: string | null;
  resource_uri: string | null;
  request_params: Record<string, unknown> | null;
  response_type: 'success' | 'error';
  response_error_code: number | null;
  response_error_message: string | null;
  response_data_preview: string | null;
  duration_ms: number | null;
  ip_address: string | null;
  user_agent: string | null;
}

function rowToMcpAuditLog(row: McpAuditLogRow): McpAuditLogEntry {
  return {
    id: row.id,
    timestamp: new Date(row.timestamp),
    organization_id: row.organization_id,
    api_key_id: row.api_key_id,
    api_key_name: row.api_key_name,
    connection_id: row.connection_id ?? undefined,
    client_name: row.client_name ?? undefined,
    client_version: row.client_version ?? undefined,
    method: row.method,
    tool_name: row.tool_name ?? undefined,
    resource_uri: row.resource_uri ?? undefined,
    request_params: row.request_params ?? undefined,
    response_type: row.response_type,
    response_error_code: row.response_error_code ?? undefined,
    response_error_message: row.response_error_message ?? undefined,
    response_data_preview: row.response_data_preview ?? undefined,
    duration_ms: row.duration_ms ?? undefined,
    ip_address: row.ip_address ?? undefined,
    user_agent: row.user_agent ?? undefined,
  };
}

export async function createMcpAuditLog(entry: McpAuditLogEntry): Promise<McpAuditLogEntry> {
  // Store in memory (with retention)
  const orgId = entry.organization_id;
  let orgAuditLogs = memoryMcpAuditLogs.get(orgId);
  if (!orgAuditLogs) {
    orgAuditLogs = [];
    memoryMcpAuditLogs.set(orgId, orgAuditLogs);
  }
  orgAuditLogs.push(entry);

  // Keep only last 500 entries per org
  if (orgAuditLogs.length > 500) {
    orgAuditLogs.shift();
  }

  if (isDatabaseConnected()) {
    try {
      await query(
        `INSERT INTO mcp_audit_logs (
          id, timestamp, organization_id, api_key_id, api_key_name,
          connection_id, client_name, client_version, method, tool_name,
          resource_uri, request_params, response_type, response_error_code,
          response_error_message, response_data_preview, duration_ms,
          ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          entry.id,
          entry.timestamp,
          entry.organization_id,
          entry.api_key_id,
          entry.api_key_name,
          entry.connection_id ?? null,
          entry.client_name ?? null,
          entry.client_version ?? null,
          entry.method,
          entry.tool_name ?? null,
          entry.resource_uri ?? null,
          entry.request_params ? JSON.stringify(entry.request_params) : null,
          entry.response_type,
          entry.response_error_code ?? null,
          entry.response_error_message ?? null,
          entry.response_data_preview ?? null,
          entry.duration_ms ?? null,
          entry.ip_address ?? null,
          entry.user_agent ?? null,
        ]
      );

      // Enforce retention in database (delete oldest beyond 500 per org)
      await query(
        `DELETE FROM mcp_audit_logs WHERE id IN (
          SELECT id FROM mcp_audit_logs
          WHERE organization_id = $1
          ORDER BY timestamp DESC
          OFFSET 500
        )`,
        [orgId]
      );
    } catch (error) {
      console.error('[API Keys Repo] Failed to create MCP audit log:', error);
    }
  }

  return entry;
}

export async function getMcpAuditLogs(
  orgId: string,
  options: {
    limit?: number;
    offset?: number;
    method?: string;
    api_key_id?: string;
    response_type?: 'success' | 'error';
    since?: Date;
    until?: Date;
  } = {}
): Promise<{ logs: McpAuditLogEntry[]; total: number }> {
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  if (isDatabaseConnected()) {
    try {
      let whereClauses = ['organization_id = $1'];
      const params: any[] = [orgId];
      let paramIndex = 2;

      if (options.method) {
        whereClauses.push(`method = $${paramIndex++}`);
        params.push(options.method);
      }
      if (options.api_key_id) {
        whereClauses.push(`api_key_id = $${paramIndex++}`);
        params.push(options.api_key_id);
      }
      if (options.response_type) {
        whereClauses.push(`response_type = $${paramIndex++}`);
        params.push(options.response_type);
      }
      if (options.since) {
        whereClauses.push(`timestamp >= $${paramIndex++}`);
        params.push(options.since);
      }
      if (options.until) {
        whereClauses.push(`timestamp <= $${paramIndex++}`);
        params.push(options.until);
      }

      const whereClause = whereClauses.join(' AND ');

      // Get total count
      const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM mcp_audit_logs WHERE ${whereClause}`,
        params
      );
      const total = countResult ? parseInt(countResult.rows[0].count, 10) : 0;

      // Get paginated results
      const result = await query<McpAuditLogRow>(
        `SELECT * FROM mcp_audit_logs WHERE ${whereClause} ORDER BY timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...params, limit, offset]
      );

      if (result) {
        return {
          logs: result.rows.map(rowToMcpAuditLog),
          total,
        };
      }
    } catch (error) {
      console.error('[API Keys Repo] Failed to get MCP audit logs:', error);
    }
  }

  // Fallback to memory
  let filtered = memoryMcpAuditLogs.get(orgId) || [];

  if (options.method) {
    filtered = filtered.filter(log => log.method === options.method);
  }
  if (options.api_key_id) {
    filtered = filtered.filter(log => log.api_key_id === options.api_key_id);
  }
  if (options.response_type) {
    filtered = filtered.filter(log => log.response_type === options.response_type);
  }
  if (options.since) {
    filtered = filtered.filter(log => log.timestamp >= options.since!);
  }
  if (options.until) {
    filtered = filtered.filter(log => log.timestamp <= options.until!);
  }

  // Sort by timestamp descending
  filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return {
    logs: filtered.slice(offset, offset + limit),
    total: filtered.length,
  };
}
