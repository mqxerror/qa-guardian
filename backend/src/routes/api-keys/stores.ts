// In-memory stores for API keys, MCP connections, tool calls, and audit logs
// Feature #2084: These are now backed by PostgreSQL via the repository layer

import { ApiKey, McpConnection, McpToolCall, McpAuditLogEntry } from './types';
import {
  getMemoryApiKeys,
  getMemoryMcpConnections,
  getMemoryMcpToolCalls,
  getMemoryMcpAuditLogs,
  // Export async database functions for consumers to use
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

// In-memory store for API keys (backed by repository)
export const apiKeys: Map<string, ApiKey> = getMemoryApiKeys();

// In-memory store for active MCP connections (backed by repository)
export const mcpConnections: Map<string, McpConnection> = getMemoryMcpConnections();

// In-memory store for MCP tool call history (keeps last 1000 per org, backed by repository)
export const mcpToolCalls: Map<string, McpToolCall[]> = getMemoryMcpToolCalls();

// In-memory store for MCP audit logs (keeps last 500 per org, backed by repository)
export const mcpAuditLogs: Map<string, McpAuditLogEntry[]> = getMemoryMcpAuditLogs();

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
