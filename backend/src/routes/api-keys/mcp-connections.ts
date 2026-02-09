// MCP Connection management functions

import crypto from 'crypto';
import { McpConnection } from './types.js';
import {
  dbCreateMcpConnection,
  dbGetMcpConnection,
  dbUpdateMcpConnectionActivity,
  dbDeleteMcpConnection,
  dbCleanupStaleMcpConnections,
} from './stores.js';
import { createLogger } from '../../services/logger.js';

const log = createLogger('mcp-connections');

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
  log.info({ connectionId, apiKeyName }, 'MCP connection registered');

  return connectionId;
}

// Helper to update connection activity (async)
export async function updateMcpActivity(connectionId: string): Promise<void> {
  await dbUpdateMcpConnectionActivity(connectionId);
}

// Helper to unregister an MCP connection (async)
export async function unregisterMcpConnection(connectionId: string): Promise<void> {
  await dbDeleteMcpConnection(connectionId);
  log.info({ connectionId }, 'MCP connection unregistered');
}

// Clean up stale connections (no activity for 30 minutes) (async)
export async function cleanupStaleConnections(): Promise<void> {
  const cleaned = await dbCleanupStaleMcpConnections();
  if (cleaned > 0) {
    log.info({ cleanedCount: cleaned }, 'Cleaned up stale MCP connections');
  }
}

// Start cleanup interval - run cleanup every 5 minutes
let cleanupIntervalStarted = false;

export function startConnectionCleanup(): void {
  if (!cleanupIntervalStarted) {
    setInterval(() => { cleanupStaleConnections().catch(err => log.error({ err }, 'Cleanup failed')); }, 5 * 60 * 1000);
    cleanupIntervalStarted = true;
  }
}
