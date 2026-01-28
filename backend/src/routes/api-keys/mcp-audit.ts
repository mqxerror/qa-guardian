// MCP Audit logging functions

import crypto from 'crypto';
import { McpAuditLogEntry } from './types';
import {
  dbCreateMcpAuditLog,
  dbGetMcpAuditLogs,
} from './stores';

// Track an MCP audit log entry (async)
export async function logMcpAuditEntry(entry: Omit<McpAuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
  const logEntry: McpAuditLogEntry = {
    ...entry,
    id: `mcp_audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date(),
  };

  await dbCreateMcpAuditLog(logEntry);

  console.log(`[MCP Audit] ${logEntry.method} ${logEntry.tool_name || logEntry.resource_uri || 'unknown'} - ${logEntry.response_type} (${logEntry.api_key_name})`);
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
