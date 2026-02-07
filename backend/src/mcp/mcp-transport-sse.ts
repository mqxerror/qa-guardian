/**
 * MCP SSE Transport Module
 *
 * Handles SSE transport connection and message handling for the MCP server.
 * Extracted from server.ts to reduce file size (Feature #252).
 *
 * @module mcp-transport-sse
 */

import * as http from 'http';
import { randomUUID } from 'crypto';
import {
  MCPRequest,
  MCPResponse,
  SSEClient,
  SSE_PING_INTERVAL,
  SSE_CONNECTION_TIMEOUT,
} from './mcp-types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Logger function type
 */
export type LogFunction = (message: string) => void;

/**
 * Request handler function type
 */
export type RequestHandler = (request: MCPRequest) => Promise<MCPResponse | null>;

/**
 * Server info type
 */
export interface ServerInfo {
  name: string;
  version: string;
  apiVersion: string;
}

/**
 * SSE Transport context
 */
export interface SSETransportContext {
  log: LogFunction;
  handleRequest: RequestHandler;
  serverInfo: ServerInfo;
  getSseClients: () => Map<string, SSEClient>;
}

// ============================================================================
// SSE Connection Handler
// ============================================================================

/**
 * Handle SSE connection setup.
 */
export function handleSSEConnection(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  context: SSETransportContext
): void {
  // Check if this is a reconnection (client provides previous session ID)
  const url = new URL(req.url || '/', `http://localhost`);
  const previousSessionId = url.searchParams.get('lastSessionId');
  // const lastEventId = req.headers['last-event-id']; // Available for reconnection tracking

  const clientId = randomUUID();
  const now = Date.now();

  // Set SSE headers with retry recommendation
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Create client
  const client: SSEClient = {
    id: clientId,
    response: res,
    initialized: false,
    connectedAt: now,
    lastPingAt: now,
    eventBuffer: [],
  };

  const sseClients = context.getSseClients();
  sseClients.set(clientId, client);
  context.log(`SSE client connected: ${clientId}`);

  // Send retry interval recommendation (tells client to reconnect after this many ms)
  res.write(`retry: ${SSE_PING_INTERVAL}\n\n`);

  // If this is a reconnection, check for buffered events from previous session
  if (previousSessionId) {
    context.log(`SSE client ${clientId} reconnecting from previous session: ${previousSessionId}`);
    // Note: In a production system, you'd store disconnected client buffers
    // and replay them here. For now, we just acknowledge the reconnection.
    sendSSEEvent(client, 'reconnected', JSON.stringify({
      previousSessionId,
      newSessionId: clientId,
      timestamp: now,
    }), context.log);
  }

  // Send endpoint message (tells client where to send requests)
  sendSSEEvent(client, 'endpoint', `/message?sessionId=${clientId}`, context.log);

  // Send welcome message with connection info
  sendSSEEvent(client, 'message', JSON.stringify({
    type: 'welcome',
    sessionId: clientId,
    serverInfo: context.serverInfo,
    connectionTimeout: SSE_CONNECTION_TIMEOUT,
    pingInterval: SSE_PING_INTERVAL,
  }), context.log);

  // Handle client disconnect
  req.on('close', () => {
    const disconnectedClient = sseClients.get(clientId);
    if (disconnectedClient) {
      disconnectedClient.disconnectedAt = Date.now();
      // Keep client in map for potential reconnection (for a limited time)
      context.log(`SSE client disconnected: ${clientId} (may reconnect within ${SSE_CONNECTION_TIMEOUT}ms)`);

      // Schedule removal after timeout period
      setTimeout(() => {
        if (sseClients.has(clientId)) {
          const c = sseClients.get(clientId)!;
          if (c.disconnectedAt) {
            sseClients.delete(clientId);
            context.log(`SSE client ${clientId} removed after reconnection timeout`);
          }
        }
      }, SSE_CONNECTION_TIMEOUT);
    }
  });

  // Keep-alive ping with timeout monitoring
  const keepAlive = setInterval(() => {
    const currentClient = sseClients.get(clientId);
    if (currentClient && !currentClient.disconnectedAt) {
      // Send ping with event ID for reconnection tracking
      const eventId = `${clientId}-${Date.now()}`;
      sendSSEEventWithId(currentClient, 'ping', Date.now().toString(), eventId, context.log);
      currentClient.lastPingAt = Date.now();
    } else {
      clearInterval(keepAlive);
    }
  }, SSE_PING_INTERVAL);

  // Connection timeout monitoring
  const timeoutCheck = setInterval(() => {
    const currentClient = sseClients.get(clientId);
    if (!currentClient) {
      clearInterval(timeoutCheck);
      return;
    }

    // If client is disconnected and timeout has passed, clean up
    if (currentClient.disconnectedAt) {
      const disconnectedDuration = Date.now() - currentClient.disconnectedAt;
      if (disconnectedDuration > SSE_CONNECTION_TIMEOUT) {
        sseClients.delete(clientId);
        context.log(`SSE client ${clientId} timed out after ${disconnectedDuration}ms`);
        clearInterval(timeoutCheck);
        clearInterval(keepAlive);
      }
    }
  }, 10000); // Check every 10 seconds
}

/**
 * Send SSE event with event ID for reconnection tracking.
 */
export function sendSSEEventWithId(
  client: SSEClient,
  event: string,
  data: string,
  eventId: string,
  log: LogFunction
): void {
  try {
    if (client.disconnectedAt) {
      // Buffer event for potential reconnection
      if (client.eventBuffer.length < 100) { // SSE_EVENT_BUFFER_MAX
        client.eventBuffer.push({ event, data, timestamp: Date.now() });
      }
      return;
    }
    client.response.write(`id: ${eventId}\nevent: ${event}\ndata: ${data}\n\n`);
  } catch (error) {
    log(`Error sending SSE event to ${client.id}: ${error}`);
    client.disconnectedAt = Date.now();
  }
}

/**
 * Send SSE event to client.
 */
export function sendSSEEvent(
  client: SSEClient,
  event: string,
  data: string,
  log: LogFunction
): void {
  try {
    client.response.write(`event: ${event}\n`);
    client.response.write(`data: ${data}\n\n`);
  } catch (error) {
    log(`Error sending SSE event to ${client.id}: ${error}`);
    // Mark client as disconnected
    client.disconnectedAt = Date.now();
  }
}

// ============================================================================
// SSE Message Handler
// ============================================================================

/**
 * Handle incoming message on SSE transport.
 */
export async function handleSSEMessage(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  context: SSETransportContext
): Promise<void> {
  const url = new URL(req.url || '/', `http://localhost`);
  const sessionId = url.searchParams.get('sessionId');

  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  return new Promise((resolve) => {
    req.on('end', async () => {
      try {
        const request = JSON.parse(body) as MCPRequest;
        const response = await context.handleRequest(request);

        // Send response via HTTP
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (response) {
          res.end(JSON.stringify(response));
        } else {
          res.end(JSON.stringify({ jsonrpc: '2.0', result: 'ok' }));
        }

        // Also send via SSE if client connected
        const sseClients = context.getSseClients();
        if (sessionId && sseClients.has(sessionId)) {
          const client = sseClients.get(sessionId)!;
          if (response) {
            sendSSEEvent(client, 'message', JSON.stringify(response), context.log);
          }
        }
      } catch (error) {
        // Enhanced JSON parse error handling with location information
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Try to extract position information from JSON parse error
        let position: number | undefined;
        let lineNumber: number | undefined;
        let column: number | undefined;

        const positionMatch = errorMessage.match(/position\s+(\d+)/i);
        if (positionMatch) {
          position = parseInt(positionMatch[1], 10);
          // Calculate line and column from position
          const beforeError = body.substring(0, position);
          const lines = beforeError.split('\n');
          lineNumber = lines.length;
          column = lines[lines.length - 1].length + 1;
        }

        // Log the malformed request
        context.log(`[ERROR] Malformed JSON request: ${errorMessage}`);
        if (position !== undefined) {
          context.log(`[ERROR] Error at position ${position} (line ${lineNumber}, column ${column})`);
        }

        // Build helpful error message
        let helpfulMessage = 'Invalid JSON in request body';
        if (position !== undefined) {
          helpfulMessage += ` at position ${position}`;
          if (lineNumber !== undefined && column !== undefined) {
            helpfulMessage += ` (line ${lineNumber}, column ${column})`;
          }
        }
        helpfulMessage += `. ${errorMessage}`;

        const errorResponse: MCPResponse = {
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: helpfulMessage,
            data: {
              originalError: errorMessage,
              position,
              line: lineNumber,
              column,
            },
          },
        };
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(errorResponse));
      }
      resolve();
    });
  });
}
