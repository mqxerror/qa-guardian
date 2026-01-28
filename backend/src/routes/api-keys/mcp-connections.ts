// MCP Connection management functions

import crypto from 'crypto';
import { McpConnection } from './types';
import {
  dbCreateMcpConnection,
  dbGetMcpConnection,
  dbUpdateMcpConnectionActivity,
  dbDeleteMcpConnection,
  dbCleanupStaleMcpConnections,
} from './stores';

// Helper to register an MCP connection (async)
export async function registerMcpConnection(
  apiKeyId: string,
  apiKeyName: string,
  organizationId: string,
  clientInfo?: McpConnection['client_info'],
  ipAddress?: string
): Promise<string> {
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

  await dbCreateMcpConnection(connection);
  console.log(`[MCP] Connection registered: ${connectionId} for API key ${apiKeyName}`);

  return connectionId;
}

// Helper to update connection activity (async)
export async function updateMcpActivity(connectionId: string): Promise<void> {
  await dbUpdateMcpConnectionActivity(connectionId);
}

// Helper to unregister an MCP connection (async)
export async function unregisterMcpConnection(connectionId: string): Promise<void> {
  await dbDeleteMcpConnection(connectionId);
  console.log(`[MCP] Connection unregistered: ${connectionId}`);
}

// Clean up stale connections (no activity for 30 minutes) (async)
export async function cleanupStaleConnections(): Promise<void> {
  const cleaned = await dbCleanupStaleMcpConnections();
  if (cleaned > 0) {
    console.log(`[MCP] Cleaned up ${cleaned} stale connection(s)`);
  }
}

// Start cleanup interval - run cleanup every 5 minutes
let cleanupIntervalStarted = false;

export function startConnectionCleanup(): void {
  if (!cleanupIntervalStarted) {
    setInterval(() => { cleanupStaleConnections().catch(console.error); }, 5 * 60 * 1000);
    cleanupIntervalStarted = true;
  }
}
