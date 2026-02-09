// MCP Audit logging functions

import crypto from 'crypto';
import { McpAuditLogEntry } from './types.js';
import {
  dbCreateMcpAuditLog,
  dbGetMcpAuditLogs,
} from './stores.js';
import { createLogger } from '../../services/logger.js';

const log = createLogger('mcp-audit');

// Track an MCP audit log entry (async)
export async function logMcpAuditEntry(entry: Omit<McpAuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
  const logEntry: McpAuditLogEntry = {
    ...entry,
    id: `mcp_audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date(),
  };

  await dbCreateMcpAuditLog(logEntry);

  log.debug({ method: logEntry.method, tool: logEntry.tool_name || logEntry.resource_uri || 'unknown', responseType: logEntry.response_type, apiKeyName: logEntry.api_key_name }, 'MCP audit entry logged');
}

// Get MCP audit logs for an organization (async)
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
  const result = await dbGetMcpAuditLogs(orgId, options);
  return result;
}
