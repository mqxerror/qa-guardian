// API Keys Routes - Main module entry point
// Re-exports all types, stores, and helpers for external use

import { FastifyInstance } from 'fastify';
import { startConnectionCleanup } from './mcp-connections';
import { registerApiKeyRoutes } from './api-key-routes';
import { registerMcpRoutes } from './mcp-routes';

// Re-export all types
export * from './types';

// Re-export async DB functions from stores
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
} from './stores';

// DEPRECATED: Empty Map exports for backward compatibility until route migration (#2120)
import { ApiKey, McpConnection, McpToolCall, McpAuditLogEntry } from './types';
export const apiKeys = new Map<string, ApiKey>();
export const mcpConnections = new Map<string, McpConnection>();
export const mcpToolCalls = new Map<string, McpToolCall[]>();
export const mcpAuditLogs = new Map<string, McpAuditLogEntry[]>();

// Re-export utilities
export { generateApiKey, formatDuration } from './utils';

// Re-export MCP connection helpers
export {
  registerMcpConnection,
  updateMcpActivity,
  unregisterMcpConnection,
  startConnectionCleanup,
} from './mcp-connections';

// Re-export MCP analytics
export { trackMcpToolCall, getMcpAnalytics } from './mcp-analytics';

// Re-export MCP audit
export { logMcpAuditEntry, getMcpAuditLogs } from './mcp-audit';

// Start the connection cleanup interval
startConnectionCleanup();

// Main route registration function
export async function apiKeyRoutes(app: FastifyInstance) {
  // Register API key CRUD routes
  await registerApiKeyRoutes(app);

  // Register MCP connection/analytics routes
  await registerMcpRoutes(app);
}
