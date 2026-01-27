// MCP Audit logging functions

import crypto from 'crypto';
import { McpAuditLogEntry } from './types';
import { mcpAuditLogs } from './stores';

// Track an MCP audit log entry
export function logMcpAuditEntry(entry: Omit<McpAuditLogEntry, 'id' | 'timestamp'>): void {
  const logEntry: McpAuditLogEntry = {
    ...entry,
    id: `mcp_audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date(),
  };

  // Get or create org's audit log array
  const orgId = entry.organization_id;
  let orgAuditLogs = mcpAuditLogs.get(orgId);
  if (!orgAuditLogs) {
    orgAuditLogs = [];
    mcpAuditLogs.set(orgId, orgAuditLogs);
  }

  orgAuditLogs.push(logEntry);

  // Keep only last 500 entries per org
  if (orgAuditLogs.length > 500) {
    orgAuditLogs.shift();
  }

  console.log(`[MCP Audit] ${logEntry.method} ${logEntry.tool_name || logEntry.resource_uri || 'unknown'} - ${logEntry.response_type} (${logEntry.api_key_name})`);
}

// Get MCP audit logs for an organization
export function getMcpAuditLogs(
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
): { logs: McpAuditLogEntry[]; total: number } {
  const orgAuditLogs = mcpAuditLogs.get(orgId) || [];

  // Apply filters
  let filtered = [...orgAuditLogs];

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

  // Sort by timestamp descending (newest first)
  filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const total = filtered.length;
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  return {
    logs: filtered.slice(offset, offset + limit),
    total,
  };
}
