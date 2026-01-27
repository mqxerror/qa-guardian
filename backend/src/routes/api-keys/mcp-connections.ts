// MCP Connection management functions

import crypto from 'crypto';
import { McpConnection } from './types';
import { mcpConnections } from './stores';

// Helper to register an MCP connection
export function registerMcpConnection(
  apiKeyId: string,
  apiKeyName: string,
  organizationId: string,
  clientInfo?: McpConnection['client_info'],
  ipAddress?: string
): string {
  const connectionId = `mcp_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

  const connection: McpConnection = {
    id: connectionId,
    api_key_id: apiKeyId,
    api_key_name: apiKeyName,
    organization_id: organizationId,
    connected_at: new Date(),
    last_activity_at: new Date(),
    client_info: clientInfo,
    ip_address: ipAddress,
  };

  mcpConnections.set(connectionId, connection);
  console.log(`[MCP] Connection registered: ${connectionId} for API key ${apiKeyName}`);

  return connectionId;
}

// Helper to update connection activity
export function updateMcpActivity(connectionId: string): void {
  const connection = mcpConnections.get(connectionId);
  if (connection) {
    connection.last_activity_at = new Date();
  }
}

// Helper to unregister an MCP connection
export function unregisterMcpConnection(connectionId: string): void {
  if (mcpConnections.has(connectionId)) {
    mcpConnections.delete(connectionId);
    console.log(`[MCP] Connection unregistered: ${connectionId}`);
  }
}

// Clean up stale connections (no activity for 30 minutes)
export function cleanupStaleConnections(): void {
  const staleThreshold = 30 * 60 * 1000; // 30 minutes
  const now = Date.now();

  for (const [connectionId, connection] of mcpConnections) {
    if (now - connection.last_activity_at.getTime() > staleThreshold) {
      mcpConnections.delete(connectionId);
      console.log(`[MCP] Cleaned up stale connection: ${connectionId}`);
    }
  }
}

// Start cleanup interval - run cleanup every 5 minutes
let cleanupIntervalStarted = false;

export function startConnectionCleanup(): void {
  if (!cleanupIntervalStarted) {
    setInterval(cleanupStaleConnections, 5 * 60 * 1000);
    cleanupIntervalStarted = true;
  }
}
