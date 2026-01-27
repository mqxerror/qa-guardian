// In-memory stores for API keys, MCP connections, tool calls, and audit logs

import { ApiKey, McpConnection, McpToolCall, McpAuditLogEntry } from './types';

// In-memory store for API keys
export const apiKeys: Map<string, ApiKey> = new Map();

// In-memory store for active MCP connections
export const mcpConnections: Map<string, McpConnection> = new Map();

// In-memory store for MCP tool call history (keeps last 1000 per org)
export const mcpToolCalls: Map<string, McpToolCall[]> = new Map();

// In-memory store for MCP audit logs (keeps last 500 per org)
export const mcpAuditLogs: Map<string, McpAuditLogEntry[]> = new Map();
