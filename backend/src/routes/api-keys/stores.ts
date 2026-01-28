// API Keys Module Data Stores
// Feature #2084: PostgreSQL-backed via repository layer
// Feature #2106: Map exports are DEPRECATED - use async functions instead

import { ApiKey, McpConnection, McpToolCall, McpAuditLogEntry } from './types';
import {
  createApiKey as dbCreateApiKey,
  getApiKeyById as dbGetApiKeyById,
  getApiKeyByHash as dbGetApiKeyByHash,
  listApiKeysByOrg as dbListApiKeysByOrg,
  updateApiKey as dbUpdateApiKey,
  revokeApiKey as dbRevokeApiKey,
  createMcpConnection as dbCreateMcpConnection,
  getMcpConnection as dbGetMcpConnection,
  updateMcpConnectionActivity as dbUpdateMcpConnectionActivity,
  deleteMcpConnection as dbDeleteMcpConnection,
  cleanupStaleMcpConnections as dbCleanupStaleMcpConnections,
  createMcpToolCall as dbCreateMcpToolCall,
  getMcpToolCallsByOrg as dbGetMcpToolCallsByOrg,
  createMcpAuditLog as dbCreateMcpAuditLog,
  getMcpAuditLogs as dbGetMcpAuditLogs,
} from '../../services/repositories/api-keys';

// ===== DEPRECATED MAP EXPORTS =====
// WARNING: These Maps return EMPTY data and are DEPRECATED!
// Use async functions instead (dbCreateApiKey, dbGetApiKeyById, etc.)

let deprecationWarned = false;
function warnDeprecation() {
  if (!deprecationWarned) {
    console.warn('[DEPRECATED] apiKeys, mcpConnections, etc. Map exports return empty data.');
    console.warn('[DEPRECATED] Use async db functions: dbCreateApiKey(), dbGetApiKeyById()');
    deprecationWarned = true;
  }
}

const emptyApiKeysMap = new Map<string, ApiKey>();
const emptyMcpConnectionsMap = new Map<string, McpConnection>();
const emptyMcpToolCallsMap = new Map<string, McpToolCall[]>();
const emptyMcpAuditLogsMap = new Map<string, McpAuditLogEntry[]>();

export const apiKeys: Map<string, ApiKey> = new Proxy(emptyApiKeysMap, {
  get(target, prop) { warnDeprecation(); return Reflect.get(target, prop); }
});
export const mcpConnections: Map<string, McpConnection> = new Proxy(emptyMcpConnectionsMap, {
  get(target, prop) { warnDeprecation(); return Reflect.get(target, prop); }
});
export const mcpToolCalls: Map<string, McpToolCall[]> = new Proxy(emptyMcpToolCallsMap, {
  get(target, prop) { warnDeprecation(); return Reflect.get(target, prop); }
});
export const mcpAuditLogs: Map<string, McpAuditLogEntry[]> = new Proxy(emptyMcpAuditLogsMap, {
  get(target, prop) { warnDeprecation(); return Reflect.get(target, prop); }
});

// Re-export async database functions for consumers
export {
  dbCreateApiKey,
  dbGetApiKeyById,
  dbGetApiKeyByHash,
  dbListApiKeysByOrg,
  dbUpdateApiKey,
  dbRevokeApiKey,
  dbCreateMcpConnection,
  dbGetMcpConnection,
  dbUpdateMcpConnectionActivity,
  dbDeleteMcpConnection,
  dbCleanupStaleMcpConnections,
  dbCreateMcpToolCall,
  dbGetMcpToolCallsByOrg,
  dbCreateMcpAuditLog,
  dbGetMcpAuditLogs,
};
