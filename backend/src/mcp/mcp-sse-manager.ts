/**
 * MCP SSE Client Manager Module
 *
 * Manages Server-Sent Events (SSE) client connections for the MCP server.
 * Handles client tracking, keep-alive pings, reconnection, and event buffering.
 * Extracted from server.ts to reduce file size (Feature #252).
 *
 * @module mcp-sse-manager
 */

import * as http from 'http';
import { randomUUID } from 'crypto';
import {
  SSEClient,
  SSE_PING_INTERVAL,
  SSE_CONNECTION_TIMEOUT,
  SSE_EVENT_BUFFER_MAX,
} from './mcp-types.js';

// ============================================================================
// Server Info (used in welcome messages)
// ============================================================================

const SERVER_INFO = {
  name: 'qa-guardian-mcp-server',
  version: '2.0.0',
};

// ============================================================================
// Types
// ============================================================================

/**
 * Logger function type
 */
export type LogFunction = (message: string) => void;

/**
 * Callback for when a message is received from a client
 */
export type MessageHandler = (body: string, sessionId: string | null, res: http.ServerResponse) => Promise<void>;

// ============================================================================
// SSEClientManager Class
// ============================================================================

/**
 * Manages SSE client connections for the MCP server.
 *
 * Features:
 * - Client connection tracking with unique session IDs
 * - Keep-alive pings with configurable intervals
 * - Event buffering for reconnection support
 * - Connection timeout monitoring
 * - Graceful client removal on disconnect
 */
export class SSEClientManager {
  /** Connected SSE clients */
  private readonly clients: Map<string, SSEClient> = new Map();

  /** Active keep-alive intervals */
  private readonly keepAliveIntervals: Map<string, NodeJS.Timeout> = new Map();

  /** Active timeout check intervals */
  private readonly timeoutIntervals: Map<string, NodeJS.Timeout> = new Map();

  /** Logger function */
  private readonly log: LogFunction;

  constructor(log: LogFunction = (msg) => console.error(`[SSEManager] ${msg}`)) {
    this.log = log;
  }

  /**
   * Get the number of connected clients.
   */
  get clientCount(): number {
    return this.clients.size;
  }

  /**
   * Get a client by ID.
   */
  getClient(clientId: string): SSEClient | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Check if a client exists.
   */
  hasClient(clientId: string): boolean {
    return this.clients.has(clientId);
  }

  /**
   * Get all connected clients.
   */
  getAllClients(): IterableIterator<[string, SSEClient]> {
    return this.clients.entries();
  }

  /**
   * Handle a new SSE connection.
   *
   * @param req - Incoming HTTP request
   * @param res - HTTP server response
   * @returns The new client ID
   */
  handleConnection(req: http.IncomingMessage, res: http.ServerResponse): string {
    // Check if this is a reconnection (client provides previous session ID)
    const url = new URL(req.url || '/', `http://localhost`);
    const previousSessionId = url.searchParams.get('lastSessionId');

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

    this.clients.set(clientId, client);
    this.log(`SSE client connected: ${clientId}`);

    // Send retry interval recommendation (tells client to reconnect after this many ms)
    res.write(`retry: ${SSE_PING_INTERVAL}\n\n`);

    // If this is a reconnection, acknowledge it
    if (previousSessionId) {
      this.log(`SSE client ${clientId} reconnecting from previous session: ${previousSessionId}`);
      this.sendEvent(client, 'reconnected', JSON.stringify({
        previousSessionId,
        newSessionId: clientId,
        timestamp: now,
      }));
    }

    // Send endpoint message (tells client where to send requests)
    this.sendEvent(client, 'endpoint', `/message?sessionId=${clientId}`);

    // Send welcome message with connection info
    this.sendEvent(client, 'message', JSON.stringify({
      type: 'welcome',
      sessionId: clientId,
      serverInfo: SERVER_INFO,
      connectionTimeout: SSE_CONNECTION_TIMEOUT,
      pingInterval: SSE_PING_INTERVAL,
    }));

    // Handle client disconnect
    req.on('close', () => {
      this.handleClientDisconnect(clientId);
    });

    // Start keep-alive ping
    this.startKeepAlive(clientId, client);

    // Start connection timeout monitoring
    this.startTimeoutMonitoring(clientId);

    return clientId;
  }

  /**
   * Handle client disconnect.
   */
  private handleClientDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.disconnectedAt = Date.now();
      // Keep client in map for potential reconnection (for a limited time)
      this.log(`SSE client disconnected: ${clientId} (may reconnect within ${SSE_CONNECTION_TIMEOUT}ms)`);

      // Schedule removal after timeout period
      setTimeout(() => {
        const currentClient = this.clients.get(clientId);
        if (currentClient && currentClient.disconnectedAt) {
          this.removeClient(clientId);
          this.log(`SSE client ${clientId} removed after reconnection timeout`);
        }
      }, SSE_CONNECTION_TIMEOUT);
    }
  }

  /**
   * Start keep-alive ping for a client.
   */
  private startKeepAlive(clientId: string, client: SSEClient): void {
    const keepAlive = setInterval(() => {
      const currentClient = this.clients.get(clientId);
      if (currentClient && !currentClient.disconnectedAt) {
        // Send ping with event ID for reconnection tracking
        const eventId = `${clientId}-${Date.now()}`;
        this.sendEventWithId(currentClient, 'ping', Date.now().toString(), eventId);
        currentClient.lastPingAt = Date.now();
      } else {
        clearInterval(keepAlive);
        this.keepAliveIntervals.delete(clientId);
      }
    }, SSE_PING_INTERVAL);

    this.keepAliveIntervals.set(clientId, keepAlive);
  }

  /**
   * Start connection timeout monitoring for a client.
   */
  private startTimeoutMonitoring(clientId: string): void {
    const timeoutCheck = setInterval(() => {
      const client = this.clients.get(clientId);
      if (!client) {
        clearInterval(timeoutCheck);
        this.timeoutIntervals.delete(clientId);
        return;
      }

      // If client is disconnected and timeout has passed, clean up
      if (client.disconnectedAt) {
        const disconnectedDuration = Date.now() - client.disconnectedAt;
        if (disconnectedDuration > SSE_CONNECTION_TIMEOUT) {
          this.removeClient(clientId);
          this.log(`SSE client ${clientId} timed out after ${disconnectedDuration}ms`);
          clearInterval(timeoutCheck);
          this.timeoutIntervals.delete(clientId);
        }
      }
    }, 10000); // Check every 10 seconds

    this.timeoutIntervals.set(clientId, timeoutCheck);
  }

  /**
   * Remove a client and clean up associated resources.
   */
  removeClient(clientId: string): void {
    // Clear intervals
    const keepAlive = this.keepAliveIntervals.get(clientId);
    if (keepAlive) {
      clearInterval(keepAlive);
      this.keepAliveIntervals.delete(clientId);
    }

    const timeoutCheck = this.timeoutIntervals.get(clientId);
    if (timeoutCheck) {
      clearInterval(timeoutCheck);
      this.timeoutIntervals.delete(clientId);
    }

    // Remove client
    this.clients.delete(clientId);
  }

  /**
   * Send an SSE event to a client.
   */
  sendEvent(client: SSEClient, event: string, data: string): void {
    try {
      client.response.write(`event: ${event}\n`);
      client.response.write(`data: ${data}\n\n`);
    } catch (error) {
      this.log(`Error sending SSE event to ${client.id}: ${error}`);
      this.clients.delete(client.id);
    }
  }

  /**
   * Send an SSE event with event ID for reconnection tracking.
   */
  sendEventWithId(client: SSEClient, event: string, data: string, eventId: string): void {
    try {
      if (client.disconnectedAt) {
        // Buffer event for potential reconnection
        if (client.eventBuffer.length < SSE_EVENT_BUFFER_MAX) {
          client.eventBuffer.push({ event, data, timestamp: Date.now() });
        }
        return;
      }
      client.response.write(`id: ${eventId}\nevent: ${event}\ndata: ${data}\n\n`);
    } catch (error) {
      this.log(`Error sending SSE event to ${client.id}: ${error}`);
      client.disconnectedAt = Date.now();
    }
  }

  /**
   * Broadcast an event to all connected clients.
   */
  broadcast(event: string, data: string): void {
    for (const client of this.clients.values()) {
      if (!client.disconnectedAt) {
        this.sendEvent(client, event, data);
      }
    }
  }

  /**
   * Notify all clients about server shutdown.
   */
  notifyShutdown(inProgressOperations: number): void {
    this.log(`Notifying ${this.clients.size} SSE client(s) about server shutdown...`);
    const shutdownNotification = {
      type: 'server-shutdown',
      timestamp: Date.now(),
      reason: 'Server is shutting down for maintenance or restart',
      reconnectAfter: 5000, // Suggest reconnecting after 5 seconds
      inProgressOperations,
    };

    for (const [clientId, client] of this.clients) {
      try {
        this.sendEvent(client, 'server-shutdown', JSON.stringify(shutdownNotification));
        this.log(`Sent server-shutdown notification to client: ${clientId}`);
      } catch {
        this.log(`Failed to notify client ${clientId} about shutdown`);
      }
    }
  }

  /**
   * Close all client connections.
   */
  closeAll(): void {
    this.log(`Closing ${this.clients.size} SSE client connection(s)`);
    for (const [clientId, client] of this.clients) {
      try {
        // Send final close event to client
        client.response.write('event: close\ndata: Server shutdown complete\n\n');
        client.response.end();
        this.log(`Closed SSE client: ${clientId}`);
      } catch {
        // Ignore errors when closing
      }
    }

    // Clear all tracking data
    for (const interval of this.keepAliveIntervals.values()) {
      clearInterval(interval);
    }
    for (const interval of this.timeoutIntervals.values()) {
      clearInterval(interval);
    }

    this.clients.clear();
    this.keepAliveIntervals.clear();
    this.timeoutIntervals.clear();
  }
}

// ============================================================================
// JSON Parse Error Helper
// ============================================================================

/**
 * Parse JSON with enhanced error information.
 */
export interface JsonParseResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    position?: number;
    line?: number;
    column?: number;
  };
}

/**
 * Parse JSON with detailed error information for debugging.
 */
export function parseJsonWithDetails<T>(body: string): JsonParseResult<T> {
  try {
    const data = JSON.parse(body) as T;
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Try to extract position information from JSON parse error
    let position: number | undefined;
    let line: number | undefined;
    let column: number | undefined;

    const positionMatch = errorMessage.match(/position\s+(\d+)/i);
    if (positionMatch) {
      position = parseInt(positionMatch[1], 10);
      // Calculate line and column from position
      const beforeError = body.substring(0, position);
      const lines = beforeError.split('\n');
      line = lines.length;
      column = lines[lines.length - 1].length + 1;
    }

    return {
      success: false,
      error: {
        message: errorMessage,
        position,
        line,
        column,
      },
    };
  }
}

/**
 * Build a helpful JSON parse error message.
 */
export function buildJsonParseErrorMessage(error: NonNullable<JsonParseResult<unknown>['error']>): string {
  let message = 'Invalid JSON in request body';
  if (error.position !== undefined) {
    message += ` at position ${error.position}`;
    if (error.line !== undefined && error.column !== undefined) {
      message += ` (line ${error.line}, column ${error.column})`;
    }
  }
  message += `. ${error.message}`;
  return message;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new SSEClientManager.
 */
export function createSSEClientManager(log?: LogFunction): SSEClientManager {
  return new SSEClientManager(log);
}
