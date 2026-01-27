/**
 * QA Guardian MCP Server
 *
 * Model Context Protocol (MCP) server for QA Guardian integration with Claude Code.
 * Supports stdio transport for local use and SSE transport for remote use.
 */

import * as readline from 'readline';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// Feature #1356: Import tool and resource definitions from extracted modules
import { TOOLS } from './tool-definitions';
import { RESOURCES } from './resource-definitions';

// Feature #1356: Import handler registry for extracted tool handlers
import { hasHandler, executeHandler, HandlerContext } from './handlers';

// Feature #1356: Import tool permissions from extracted module
import { TOOL_SCOPE_MAP } from './tool-permissions';

// Feature #1356: Import string utilities from extracted module
import { findSimilarStrings, levenshteinDistance } from './string-utils';

// Feature #1356: Import cron utilities from extracted module
import { calculateNextCronRun, describeCronExpression } from './cron-utils';

// Feature #1356: Import validation utilities from extracted module
import {
  getJsonType,
  isTypeMatch,
  getValidExample,
  validateK6Script,
  validateParameterTypes,
  findMissingRequiredParams,
} from './validation-utils';

// Feature #1356: Import hash utilities from extracted module
import {
  generateRequestHash,
  generateStreamId,
  generateOperationId,
} from './hash-utils';

// Feature #1356: Import insights utilities from extracted module
import { generateVisualTrendInsights as generateVisualTrendInsightsUtil } from './insights-utils';

// Feature #1356: Import API versioning from extracted module
import {
  APIVersionStatus,
  APIVersionInfo,
  API_VERSIONS,
  DEFAULT_API_VERSION,
  CURRENT_API_VERSION,
  parseApiVersion,
  getVersionInfo,
  isVersionDeprecated,
  getSupportedVersions,
  getCurrentApiVersion,
  addVersionWarnings,
} from './api-versioning';

// Feature #1356: Import webhook callback utilities from extracted module
import {
  WebhookCallbackConfig,
  WebhookCallbackPayload,
  sendWebhookCallback,
  parseWebhookCallback,
  createSuccessPayload,
  createErrorPayload,
} from './webhook-callbacks';

// MCP Protocol version
const MCP_PROTOCOL_VERSION = '2024-11-05';

// Server info
const SERVER_INFO = {
  name: 'qa-guardian-mcp-server',
  version: '2.0.0',
  apiVersion: CURRENT_API_VERSION,
};

// Transport type
type TransportType = 'stdio' | 'sse';

interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

// Feature #1356: TOOLS and RESOURCES are now imported from ./tool-definitions and ./resource-definitions
// This reduces server.ts by ~5200 lines
// See tool-definitions.ts and resource-definitions.ts for the full definitions

// Configuration
interface ServerConfig {
  transport: TransportType;
  apiUrl?: string;
  apiKey?: string;
  port?: number;
  host?: string;
  requireAuth?: boolean; // If true, API key is required for all operations
  rateLimit?: number; // Max requests per minute per API key (default: 100)
  rateLimitWindow?: number; // Window in seconds (default: 60)
  maxConcurrent?: number; // Max concurrent requests per API key (default: 5)
  toolTimeout?: number; // Tool execution timeout in milliseconds (default: 30000)
  enableStreaming?: boolean; // Enable response streaming for large results (default: true)
  streamChunkSize?: number; // Size of each streaming chunk in items (default: 10)
  streamThreshold?: number; // Min items to trigger streaming (default: 20)
  // Feature #855: Webhook callback configuration
  webhookCallback?: WebhookCallbackConfig; // Global webhook callback
  enableWebhookCallbacks?: boolean; // Enable per-request webhook callbacks (default: true)
  // Feature #858: API versioning
  defaultApiVersion?: string; // Default API version for requests without explicit version
}

// Feature #854: Streaming response metadata
interface StreamMetadata {
  streamId: string;
  requestId: string | number | undefined;
  toolName: string;
  totalChunks: number;
  totalItems: number;
  startedAt: number;
  completedAt?: number;
}

// Feature #854: Streaming chunk notification
interface StreamChunkNotification {
  jsonrpc: '2.0';
  method: 'notifications/stream/chunk';
  params: {
    streamId: string;
    requestId: string | number | undefined;
    chunkIndex: number;
    totalChunks: number;
    data: unknown[];
    isLast: boolean;
    progress: {
      itemsSent: number;
      totalItems: number;
      percentage: number;
    };
  };
}

// Feature #855: WebhookCallbackConfig and WebhookCallbackPayload imported from ./webhook-callbacks

// Feature #856: Batch operation request item
interface BatchOperationItem {
  id: string | number; // Unique ID for this operation within the batch
  name: string; // Tool name
  arguments?: Record<string, unknown>; // Tool arguments
}

// Feature #856: Batch operation response item
interface BatchOperationResult {
  id: string | number; // Matches the request item ID
  status: 'success' | 'error';
  result?: unknown; // Result for success
  error?: {
    code: number;
    message: string;
  };
  duration_ms: number;
}

// Feature #856: Batch response
interface BatchResponse {
  batchId: string;
  totalOperations: number;
  succeeded: number;
  failed: number;
  results: BatchOperationResult[];
  duration_ms: number;
}

// Feature #857: Idempotency key entry
interface IdempotencyEntry {
  key: string;
  response: MCPResponse;
  createdAt: number;
  expiresAt: number;
  toolName: string;
  requestHash: string;
}

// Rate limiting configuration (enhanced with burst support)
interface RateLimitConfig {
  maxRequests: number; // Max requests per window
  windowMs: number; // Window size in milliseconds
  burstLimit: number; // Max additional burst requests allowed
  burstWindowMs: number; // Burst window size in milliseconds
}

// Rate limit entry for tracking requests per API key
interface RateLimitEntry {
  timestamps: number[]; // Timestamps of requests within the window
  burstTimestamps: number[]; // Timestamps of burst requests (short window)
}

// Per-key rate limit configuration from backend
interface PerKeyRateLimitConfig {
  max_requests: number;
  window_seconds: number;
  burst_limit: number;
  burst_window_seconds: number;
}

// SSE Client connection
interface SSEClient {
  id: string;
  response: http.ServerResponse;
  initialized: boolean;
  connectedAt: number;
  lastPingAt: number;
  eventBuffer: Array<{ event: string; data: string; timestamp: number }>;
  disconnectedAt?: number;
}

// SSE Connection timeout settings
const SSE_PING_INTERVAL = 15000; // 15 seconds
const SSE_CONNECTION_TIMEOUT = 60000; // 60 seconds
const SSE_EVENT_BUFFER_MAX = 100; // Max events to buffer per client
const SSE_EVENT_BUFFER_TTL = 300000; // 5 minutes - max age for buffered events

class MCPServer {
  private config: ServerConfig;
  private initialized = false;
  private rl: readline.Interface | null = null;
  private httpServer: http.Server | null = null;
  private sseClients: Map<string, SSEClient> = new Map();

  // Rate limiting state - tracks requests per API key
  private rateLimitStore: Map<string, RateLimitEntry> = new Map();
  private rateLimitConfig: RateLimitConfig;
  // Per-key rate limit configurations (from backend validation response)
  private perKeyRateLimits: Map<string, PerKeyRateLimitConfig> = new Map();

  // Feature #851: Request priority levels (higher number = higher priority)
  private static readonly PRIORITY_LOW = 1;
  private static readonly PRIORITY_NORMAL = 5;
  private static readonly PRIORITY_HIGH = 10;

  // Concurrent request limiting - tracks in-flight requests per API key
  private concurrentRequests: Map<string, {
    active: number;
    queue: Array<{
      resolve: (value: boolean) => void;
      timestamp: number;
      priority: number; // Feature #851: Priority level for queue ordering
    }>;
  }> = new Map();
  private maxConcurrentRequests = 5; // Default max concurrent requests per API key
  private concurrentQueueTimeout = 30000; // 30 seconds max queue wait time

  // Feature #849: Tool execution timeout
  private toolTimeout = 30000; // Default 30 seconds for tool execution

  // Feature #854: Response streaming configuration
  private enableStreaming = true; // Enable streaming by default
  private streamChunkSize = 10; // Number of items per chunk
  private streamThreshold = 20; // Minimum items to trigger streaming
  private activeStreams: Map<string, StreamMetadata> = new Map();

  // Feature #1217: Alert subscription tracking
  private alertSubscriptions: Map<string, {
    id: string;
    filters: {
      severity?: string[];
      source?: string[];
      check_ids?: string[];
      include_resolved: boolean;
    };
    startTime: number;
    timeoutMs: number;
    pollIntervalMs: number;
    lastAlertId?: string;
    alertsReceived: number;
    isActive: boolean;
  }> = new Map();

  // Feature #1219: Workflow storage
  private workflows: Map<string, {
    id: string;
    name: string;
    description?: string;
    steps: Array<{
      id: string;
      name: string;
      tool: string;
      arguments: Record<string, unknown>;
      condition?: string;
      on_failure?: 'stop' | 'continue' | 'skip_remaining';
      timeout_ms?: number;
      retry_count?: number;
    }>;
    created_at: Date;
    created_by?: string;
    triggers?: {
      schedule?: string;
      on_event?: string;
      manual?: boolean;
    };
    variables?: Record<string, unknown>;
    last_run?: {
      run_id: string;
      status: string;
      started_at: Date;
      completed_at?: Date;
    };
  }> = new Map();

  // Feature #1221: Workflow schedules storage
  private workflowSchedules: Map<string, {
    id: string;
    workflow_id: string;
    cron: string;
    timezone: string;
    enabled: boolean;
    variables?: Record<string, unknown>;
    notify_on_success: boolean;
    notify_on_failure: boolean;
    max_consecutive_failures: number;
    consecutive_failures: number;
    created_at: Date;
    created_by?: string;
    next_run?: Date;
    last_run?: {
      run_id: string;
      status: 'success' | 'failed';
      started_at: Date;
      completed_at?: Date;
    };
    execution_history: Array<{
      run_id: string;
      status: 'success' | 'failed';
      started_at: Date;
      completed_at: Date;
      duration_ms: number;
    }>;
  }> = new Map();

  // Feature #857: Idempotency cache
  private idempotencyCache: Map<string, IdempotencyEntry> = new Map();
  private idempotencyTTL = 3600000; // 1 hour default TTL for idempotency keys
  private idempotencyCleanupInterval: NodeJS.Timeout | null = null;

  // Graceful shutdown state
  private isShuttingDown = false;
  private shutdownTimeout = 10000; // 10 seconds max wait for in-progress operations
  private inProgressOperations: Map<string, {
    startTime: number;
    method: string;
    requestId?: string | number;
    abortController?: AbortController;
  }> = new Map();

  // Feature #846: Audit logging - track connection info
  private connectionId?: string;
  private clientInfo?: { name: string; version: string };

  // Feature #858: API versioning
  private requestApiVersion: string = DEFAULT_API_VERSION;
  private defaultApiVersion: string = DEFAULT_API_VERSION;

  constructor(config: ServerConfig) {
    this.config = config;

    // Initialize rate limit config with burst support
    this.rateLimitConfig = {
      maxRequests: config.rateLimit || 100, // Default: 100 requests
      windowMs: (config.rateLimitWindow || 60) * 1000, // Default: 60 seconds
      burstLimit: 20, // Default: 20 additional burst requests
      burstWindowMs: 10 * 1000, // Default: 10 seconds burst window
    };

    // Allow configuring max concurrent requests
    if (config.maxConcurrent) {
      this.maxConcurrentRequests = config.maxConcurrent;
    }

    // Feature #849: Allow configuring tool execution timeout
    if (config.toolTimeout !== undefined && config.toolTimeout > 0) {
      this.toolTimeout = config.toolTimeout;
    }

    // Feature #854: Configure response streaming
    if (config.enableStreaming !== undefined) {
      this.enableStreaming = config.enableStreaming;
    }
    if (config.streamChunkSize !== undefined && config.streamChunkSize > 0) {
      this.streamChunkSize = config.streamChunkSize;
    }
    if (config.streamThreshold !== undefined && config.streamThreshold > 0) {
      this.streamThreshold = config.streamThreshold;
    }

    // Feature #858: Configure API versioning
    if (config.defaultApiVersion && API_VERSIONS[config.defaultApiVersion]) {
      this.defaultApiVersion = config.defaultApiVersion;
    }
  }

  // Feature #851: Parse priority from request params
  private parsePriority(params?: Record<string, unknown>): number {
    if (!params || params._priority === undefined) {
      return MCPServer.PRIORITY_NORMAL;
    }
    const priority = params._priority;
    if (typeof priority === 'number') {
      // Clamp to valid range
      return Math.max(MCPServer.PRIORITY_LOW, Math.min(MCPServer.PRIORITY_HIGH, priority));
    }
    if (typeof priority === 'string') {
      switch (priority.toLowerCase()) {
        case 'low': return MCPServer.PRIORITY_LOW;
        case 'high': return MCPServer.PRIORITY_HIGH;
        case 'normal':
        default: return MCPServer.PRIORITY_NORMAL;
      }
    }
    return MCPServer.PRIORITY_NORMAL;
  }

  // Feature #858: Parse API version from request params (delegates to extracted module)
  private parseApiVersionFromParams(params?: Record<string, unknown>): string {
    return parseApiVersion(params, this.defaultApiVersion, (msg) => this.log(msg));
  }

  // Feature #858: Add version warnings (delegates to extracted module)
  private addApiVersionWarnings(response: MCPResponse, version: string): MCPResponse {
    return addVersionWarnings(response, version, (msg) => this.log(msg));
  }

  // Feature #854: Check if result should be streamed
  private shouldStreamResult(result: unknown, forceStream?: boolean): boolean {
    if (!this.enableStreaming) return false;
    if (forceStream === false) return false;
    if (forceStream === true) return true;

    // Auto-detect large arrays that should be streamed
    if (Array.isArray(result)) {
      return result.length >= this.streamThreshold;
    }

    // Check for result objects containing arrays
    if (result && typeof result === 'object') {
      const obj = result as Record<string, unknown>;
      for (const key of ['items', 'results', 'data', 'records', 'list', 'entries']) {
        if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length >= this.streamThreshold) {
          return true;
        }
      }
    }

    return false;
  }

  // Feature #854: Extract streamable array from result
  private extractStreamableArray(result: unknown): { array: unknown[]; wrapper?: Record<string, unknown>; arrayKey?: string } {
    if (Array.isArray(result)) {
      return { array: result };
    }

    if (result && typeof result === 'object') {
      const obj = result as Record<string, unknown>;
      for (const key of ['items', 'results', 'data', 'records', 'list', 'entries']) {
        if (Array.isArray(obj[key])) {
          // Return the array with wrapper context
          const wrapper = { ...obj };
          delete wrapper[key];
          return { array: obj[key] as unknown[], wrapper, arrayKey: key };
        }
      }
    }

    // Not streamable, wrap in array
    return { array: [result] };
  }

  // Feature #854: Send streaming notification
  private sendStreamNotification(notification: StreamChunkNotification): void {
    if (this.config.transport === 'stdio') {
      // For stdio, write notification directly
      console.log(JSON.stringify(notification));
    } else if (this.config.transport === 'sse') {
      // For SSE, send to all connected clients
      for (const client of this.sseClients.values()) {
        this.sendSSEEvent(client, 'stream-chunk', JSON.stringify(notification));
      }
    }
  }

  // Feature #854: Stream large result set
  private async streamResult(
    result: unknown,
    requestId: string | number | undefined,
    toolName: string
  ): Promise<MCPResponse> {
    const streamId = generateStreamId();
    const { array, wrapper, arrayKey } = this.extractStreamableArray(result);
    const totalItems = array.length;
    const totalChunks = Math.ceil(totalItems / this.streamChunkSize);

    // Create stream metadata
    const metadata: StreamMetadata = {
      streamId,
      requestId,
      toolName,
      totalChunks,
      totalItems,
      startedAt: Date.now(),
    };
    this.activeStreams.set(streamId, metadata);

    this.log(`[STREAM] Starting stream ${streamId} for ${toolName}: ${totalItems} items in ${totalChunks} chunks`);

    // Send chunks
    let itemsSent = 0;
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * this.streamChunkSize;
      const end = Math.min(start + this.streamChunkSize, totalItems);
      const chunkData = array.slice(start, end);
      itemsSent += chunkData.length;
      const isLast = chunkIndex === totalChunks - 1;

      const notification: StreamChunkNotification = {
        jsonrpc: '2.0',
        method: 'notifications/stream/chunk',
        params: {
          streamId,
          requestId,
          chunkIndex,
          totalChunks,
          data: chunkData,
          isLast,
          progress: {
            itemsSent,
            totalItems,
            percentage: Math.round((itemsSent / totalItems) * 100),
          },
        },
      };

      this.sendStreamNotification(notification);

      // Small delay between chunks to allow client processing
      if (!isLast) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Mark stream complete
    metadata.completedAt = Date.now();
    this.log(`[STREAM] Completed stream ${streamId} in ${metadata.completedAt - metadata.startedAt}ms`);

    // Clean up stream tracking after a delay
    setTimeout(() => {
      this.activeStreams.delete(streamId);
    }, 60000); // Keep metadata for 1 minute for debugging

    // Return summary response with streaming metadata
    const summaryResult: Record<string, unknown> = {
      streamed: true,
      streamId,
      totalItems,
      totalChunks,
      duration_ms: metadata.completedAt - metadata.startedAt,
    };

    // Include wrapper metadata if present
    if (wrapper) {
      summaryResult.metadata = wrapper;
      summaryResult.arrayKey = arrayKey;
    }

    return {
      jsonrpc: '2.0',
      id: requestId,
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(summaryResult, null, 2),
          },
        ],
        _streaming: {
          streamId,
          totalItems,
          totalChunks,
          completed: true,
        },
      },
    };
  }

  // Feature #854: Get active stream info
  getActiveStreams(): Map<string, StreamMetadata> {
    return this.activeStreams;
  }

  // Feature #857: Start idempotency cache cleanup
  private startIdempotencyCleanup(): void {
    if (this.idempotencyCleanupInterval) return;

    // Run cleanup every 5 minutes
    this.idempotencyCleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      for (const [key, entry] of this.idempotencyCache) {
        if (entry.expiresAt < now) {
          this.idempotencyCache.delete(key);
          cleaned++;
        }
      }
      if (cleaned > 0) {
        this.log(`[IDEMPOTENCY] Cleaned up ${cleaned} expired entries`);
      }
    }, 300000); // 5 minutes
  }

  // Feature #857: Stop idempotency cache cleanup
  private stopIdempotencyCleanup(): void {
    if (this.idempotencyCleanupInterval) {
      clearInterval(this.idempotencyCleanupInterval);
      this.idempotencyCleanupInterval = null;
    }
  }

  // Feature #857: generateRequestHash moved to hash-utils.ts

  // Feature #857: Check idempotency cache for existing response
  private checkIdempotency(
    key: string,
    toolName: string,
    requestHash: string
  ): IdempotencyEntry | null {
    const entry = this.idempotencyCache.get(key);
    if (!entry) return null;

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.idempotencyCache.delete(key);
      return null;
    }

    // Check if same tool and request hash
    if (entry.toolName !== toolName) {
      this.log(`[IDEMPOTENCY] Key reused with different tool: ${key} (${entry.toolName} vs ${toolName})`);
      return null; // Don't return cached response if tool is different
    }

    if (entry.requestHash !== requestHash) {
      this.log(`[IDEMPOTENCY] Key reused with different request: ${key}`);
      return null; // Don't return cached response if request is different
    }

    this.log(`[IDEMPOTENCY] Cache hit for key: ${key}`);
    return entry;
  }

  // Feature #857: Store response in idempotency cache
  private storeIdempotencyResponse(
    key: string,
    toolName: string,
    requestHash: string,
    response: MCPResponse,
    ttlMs?: number
  ): void {
    const now = Date.now();
    const entry: IdempotencyEntry = {
      key,
      response,
      createdAt: now,
      expiresAt: now + (ttlMs || this.idempotencyTTL),
      toolName,
      requestHash,
    };
    this.idempotencyCache.set(key, entry);
    this.log(`[IDEMPOTENCY] Stored response for key: ${key} (expires in ${(ttlMs || this.idempotencyTTL) / 1000}s)`);
  }

  // Feature #857: Parse idempotency key from request args
  private parseIdempotencyKey(args?: Record<string, unknown>): string | undefined {
    if (!args) return undefined;
    const key = args._idempotencyKey;
    if (typeof key === 'string' && key.length > 0 && key.length <= 256) {
      return key;
    }
    return undefined;
  }

  // Feature #857: Get idempotency cache stats
  getIdempotencyCacheStats(): { size: number; entries: Array<{ key: string; toolName: string; expiresIn: number }> } {
    const now = Date.now();
    const entries = [];
    for (const [key, entry] of this.idempotencyCache) {
      entries.push({
        key,
        toolName: entry.toolName,
        expiresIn: Math.max(0, entry.expiresAt - now),
      });
    }
    return { size: this.idempotencyCache.size, entries };
  }

  // Feature #855: Send webhook callback (delegates to extracted module)
  private async sendWebhookCallbackImpl(
    callbackConfig: WebhookCallbackConfig,
    payload: WebhookCallbackPayload
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    return sendWebhookCallback(callbackConfig, payload, (msg) => this.log(msg));
  }

  // Feature #855: Parse webhook callback config (delegates to extracted module)
  private parseWebhookCallbackImpl(args?: Record<string, unknown>): WebhookCallbackConfig | undefined {
    return parseWebhookCallback(args, this.config.enableWebhookCallbacks !== false, (msg) => this.log(msg));
  }

  // Acquire a concurrent request slot (returns true if acquired, false if rejected)
  // Feature #851: Added priority parameter for queue ordering
  private async acquireConcurrentSlot(
    apiKey: string,
    priority: number = MCPServer.PRIORITY_NORMAL
  ): Promise<{ acquired: boolean; queued: boolean; position?: number; priority: number }> {
    const key = apiKey || 'anonymous';

    if (!this.concurrentRequests.has(key)) {
      this.concurrentRequests.set(key, { active: 0, queue: [] });
    }

    const state = this.concurrentRequests.get(key)!;

    // If under limit, acquire immediately
    if (state.active < this.maxConcurrentRequests) {
      state.active++;
      return { acquired: true, queued: false, priority };
    }

    // Feature #851: Insert into queue based on priority (higher priority first)
    const queueEntry = {
      resolve: (acquired: boolean) => {},
      timestamp: Date.now(),
      priority,
    };

    // Find insertion point to maintain priority order (higher priority first)
    let insertIndex = state.queue.findIndex(entry => entry.priority < priority);
    if (insertIndex === -1) {
      insertIndex = state.queue.length;
    }

    const queuePosition = insertIndex + 1;
    this.log(`[CONCURRENT] Request queued at position ${queuePosition} (priority: ${priority}) for API key ${key.substring(0, 8)}...`);

    return new Promise((resolve) => {
      queueEntry.resolve = (acquired: boolean) => resolve({ acquired, queued: true, position: queuePosition, priority });
      state.queue.splice(insertIndex, 0, queueEntry);

      // Timeout after configured period
      setTimeout(() => {
        const index = state.queue.indexOf(queueEntry);
        if (index !== -1) {
          state.queue.splice(index, 1);
          this.log(`[CONCURRENT] Queued request timed out (priority: ${priority}) for API key ${key.substring(0, 8)}...`);
          resolve({ acquired: false, queued: true, position: queuePosition, priority });
        }
      }, this.concurrentQueueTimeout);
    });
  }

  // Release a concurrent request slot
  private releaseConcurrentSlot(apiKey: string): void {
    const key = apiKey || 'anonymous';
    const state = this.concurrentRequests.get(key);

    if (!state) return;

    state.active--;

    // Process next queued request if any
    if (state.queue.length > 0 && state.active < this.maxConcurrentRequests) {
      const next = state.queue.shift();
      if (next) {
        state.active++;
        this.log(`[CONCURRENT] Dequeued request for API key ${key.substring(0, 8)}...`);
        next.resolve(true);
      }
    }
  }

  // Get concurrent request stats for an API key
  private getConcurrentStats(apiKey: string): { active: number; queued: number; maxConcurrent: number } {
    const key = apiKey || 'anonymous';
    const state = this.concurrentRequests.get(key);
    return {
      active: state?.active || 0,
      queued: state?.queue.length || 0,
      maxConcurrent: this.maxConcurrentRequests,
    };
  }

  // Start the server
  async start(): Promise<void> {
    // Feature #857: Start idempotency cache cleanup
    this.startIdempotencyCleanup();

    if (this.config.transport === 'stdio') {
      await this.startStdioTransport();
    } else if (this.config.transport === 'sse') {
      await this.startSSETransport();
    } else {
      throw new Error(`Transport ${this.config.transport} not implemented`);
    }
  }

  // Start stdio transport - reads from stdin, writes to stdout
  private async startStdioTransport(): Promise<void> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    // Log to stderr so it doesn't interfere with JSON-RPC on stdout
    this.log('QA Guardian MCP Server starting...');
    this.log(`Transport: ${this.config.transport}`);
    this.log(`API URL: ${this.config.apiUrl || 'http://localhost:3001'}`);
    this.log('Ready to receive commands via stdin');

    this.rl.on('line', async (line) => {
      try {
        const request = JSON.parse(line) as MCPRequest;
        const response = await this.handleRequest(request);
        if (response) {
          this.sendResponse(response);
        }
      } catch (error) {
        // Enhanced JSON parse error handling with location information
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Try to extract position information from JSON parse error
        // Node.js JSON.parse errors often include position like "at position 42"
        let position: number | undefined;
        let lineNumber: number | undefined;
        let column: number | undefined;

        const positionMatch = errorMessage.match(/position\s+(\d+)/i);
        if (positionMatch) {
          position = parseInt(positionMatch[1], 10);
          // Calculate line and column from position
          const beforeError = line.substring(0, position);
          const lines = beforeError.split('\n');
          lineNumber = lines.length;
          column = lines[lines.length - 1].length + 1;
        }

        // Log the malformed request for debugging (without exposing sensitive data)
        this.log(`[ERROR] Malformed JSON request: ${errorMessage}`);
        if (position !== undefined) {
          this.log(`[ERROR] Error at position ${position} (line ${lineNumber}, column ${column})`);
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

        this.sendResponse({
          jsonrpc: '2.0',
          error: {
            code: -32700, // JSON-RPC standard parse error code
            message: helpfulMessage,
            data: {
              originalError: errorMessage,
              position,
              line: lineNumber,
              column,
            },
          },
        });
      }
    });

    this.rl.on('close', () => {
      this.log('stdin closed, shutting down');
      process.exit(0);
    });

    // Handle process signals
    process.on('SIGINT', () => {
      this.log('Received SIGINT, shutting down gracefully');
      this.shutdown();
    });

    process.on('SIGTERM', () => {
      this.log('Received SIGTERM, shutting down gracefully');
      this.shutdown();
    });
  }

  // Graceful shutdown
  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      this.log('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    this.log('Starting graceful shutdown...');
    const shutdownStartTime = Date.now();

    // Feature #857: Stop idempotency cleanup
    this.stopIdempotencyCleanup();

    // Phase 1: Notify all connected clients about server shutdown
    if (this.sseClients.size > 0) {
      this.log(`Notifying ${this.sseClients.size} SSE client(s) about server shutdown...`);
      const shutdownNotification = {
        type: 'server-shutdown',
        timestamp: Date.now(),
        reason: 'Server is shutting down for maintenance or restart',
        reconnectAfter: 5000, // Suggest reconnecting after 5 seconds
        inProgressOperations: this.inProgressOperations.size,
      };

      for (const [clientId, client] of this.sseClients) {
        try {
          // Send server-shutdown event to client
          this.sendSSEEvent(client, 'server-shutdown', JSON.stringify(shutdownNotification));
          this.log(`Sent server-shutdown notification to client: ${clientId}`);
        } catch {
          this.log(`Failed to notify client ${clientId} about shutdown`);
        }
      }
    }

    // For stdio transport, send shutdown notification to stdout
    if (this.config.transport === 'stdio') {
      const shutdownNotification: MCPNotification = {
        jsonrpc: '2.0',
        method: 'notifications/server-shutdown',
        params: {
          timestamp: Date.now(),
          reason: 'Server is shutting down for maintenance or restart',
          inProgressOperations: this.inProgressOperations.size,
        },
      };
      this.sendResponse(shutdownNotification as unknown as MCPResponse);
    }

    // Phase 2: Wait for in-progress operations to complete (with timeout)
    if (this.inProgressOperations.size > 0) {
      this.log(`Waiting for ${this.inProgressOperations.size} in-progress operation(s) to complete...`);

      const waitStart = Date.now();
      while (this.inProgressOperations.size > 0 && (Date.now() - waitStart) < this.shutdownTimeout) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Check every 100ms
      }

      if (this.inProgressOperations.size > 0) {
        this.log(`Aborting ${this.inProgressOperations.size} remaining operation(s) after timeout`);
        // Abort remaining operations
        for (const [opId, op] of this.inProgressOperations) {
          this.log(`Aborting operation ${opId}: ${op.method} (running for ${Date.now() - op.startTime}ms)`);
          if (op.abortController) {
            op.abortController.abort();
          }
        }
        this.inProgressOperations.clear();
      } else {
        this.log('All in-progress operations completed cleanly');
      }
    }

    // Phase 3: Close readline interface for stdio transport
    if (this.rl) {
      this.rl.close();
      this.log('Closed readline interface');
    }

    // Phase 4: Close all SSE client connections
    if (this.sseClients.size > 0) {
      this.log(`Closing ${this.sseClients.size} SSE client connection(s)`);
      for (const [clientId, client] of this.sseClients) {
        try {
          // Send final close event to client
          client.response.write('event: close\ndata: Server shutdown complete\n\n');
          client.response.end();
          this.log(`Closed SSE client: ${clientId}`);
        } catch {
          // Ignore errors when closing
        }
      }
      this.sseClients.clear();
    }

    // Phase 5: Close HTTP server
    const totalShutdownTime = Date.now() - shutdownStartTime;
    this.log(`Shutdown completed in ${totalShutdownTime}ms`);

    if (this.httpServer) {
      this.httpServer.close(() => {
        this.log('HTTP server closed');
        process.exit(0);
      });

      // Force close after timeout
      setTimeout(() => {
        this.log('Forcing shutdown after timeout');
        process.exit(0);
      }, 5000);
    } else {
      process.exit(0);
    }
  }

  // Track start of an operation
  private trackOperationStart(operationId: string, method: string, requestId?: string | number): AbortController {
    const abortController = new AbortController();
    this.inProgressOperations.set(operationId, {
      startTime: Date.now(),
      method,
      requestId,
      abortController,
    });
    this.log(`[OPERATION] Started: ${operationId} (${method})`);
    return abortController;
  }

  // Track completion of an operation
  private trackOperationComplete(operationId: string): void {
    const op = this.inProgressOperations.get(operationId);
    if (op) {
      const duration = Date.now() - op.startTime;
      this.log(`[OPERATION] Completed: ${operationId} (${op.method}) in ${duration}ms`);
      this.inProgressOperations.delete(operationId);
    }
  }

  // Feature #849: Execute a promise with timeout
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    toolName: string
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const error = new Error(`Tool '${toolName}' execution timed out after ${timeoutMs}ms`);
        error.name = 'TimeoutError';
        reject(error);
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutHandle!);
    }
  }

  // Get count of in-progress operations
  getInProgressCount(): number {
    return this.inProgressOperations.size;
  }

  // Check if server is shutting down
  isServerShuttingDown(): boolean {
    return this.isShuttingDown;
  }

  // Start SSE transport - HTTP server with Server-Sent Events
  private async startSSETransport(): Promise<void> {
    const port = this.config.port || 3000;
    const host = this.config.host || '0.0.0.0';

    this.httpServer = http.createServer((req, res) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url || '/', `http://${host}:${port}`);

      // SSE endpoint for events
      if (req.method === 'GET' && url.pathname === '/sse') {
        this.handleSSEConnection(req, res);
        return;
      }

      // Message endpoint for receiving JSON-RPC requests
      if (req.method === 'POST' && url.pathname === '/message') {
        this.handleSSEMessage(req, res);
        return;
      }

      // Health check
      if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', clients: this.sseClients.size }));
        return;
      }

      // Server info
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          name: SERVER_INFO.name,
          version: SERVER_INFO.version,
          transport: 'sse',
          endpoints: {
            sse: '/sse',
            message: '/message',
            health: '/health',
          },
        }));
        return;
      }

      // 404 for unknown routes
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    return new Promise((resolve, reject) => {
      this.httpServer!.listen(port, host, () => {
        this.log('QA Guardian MCP Server starting...');
        this.log(`Transport: SSE`);
        this.log(`Listening on: http://${host}:${port}`);
        this.log(`SSE endpoint: http://${host}:${port}/sse`);
        this.log(`Message endpoint: http://${host}:${port}/message`);
        this.log(`API URL: ${this.config.apiUrl || 'http://localhost:3001'}`);
        this.log('Ready to accept connections');

        console.log(`
====================================
  QA Guardian MCP Server (SSE)
====================================

  Server running at: http://${host}:${port}
  SSE endpoint:      http://${host}:${port}/sse
  Message endpoint:  http://${host}:${port}/message
  Health check:      http://${host}:${port}/health

  Connect via SSE:
    1. GET /sse to establish SSE connection
    2. POST /message with JSON-RPC request body

====================================
        `);

        resolve();
      });

      this.httpServer!.on('error', (err) => {
        this.log(`Server error: ${err.message}`);
        reject(err);
      });
    });
  }

  // Handle SSE connection
  private handleSSEConnection(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Check if this is a reconnection (client provides previous session ID)
    const url = new URL(req.url || '/', `http://localhost`);
    const previousSessionId = url.searchParams.get('lastSessionId');
    const lastEventId = req.headers['last-event-id'];

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

    this.sseClients.set(clientId, client);
    this.log(`SSE client connected: ${clientId}`);

    // Send retry interval recommendation (tells client to reconnect after this many ms)
    res.write(`retry: ${SSE_PING_INTERVAL}\n\n`);

    // If this is a reconnection, check for buffered events from previous session
    if (previousSessionId) {
      this.log(`SSE client ${clientId} reconnecting from previous session: ${previousSessionId}`);
      // Note: In a production system, you'd store disconnected client buffers
      // and replay them here. For now, we just acknowledge the reconnection.
      this.sendSSEEvent(client, 'reconnected', JSON.stringify({
        previousSessionId,
        newSessionId: clientId,
        timestamp: now,
      }));
    }

    // Send endpoint message (tells client where to send requests)
    this.sendSSEEvent(client, 'endpoint', `/message?sessionId=${clientId}`);

    // Send welcome message with connection info
    this.sendSSEEvent(client, 'message', JSON.stringify({
      type: 'welcome',
      sessionId: clientId,
      serverInfo: SERVER_INFO,
      connectionTimeout: SSE_CONNECTION_TIMEOUT,
      pingInterval: SSE_PING_INTERVAL,
    }));

    // Handle client disconnect
    req.on('close', () => {
      const disconnectedClient = this.sseClients.get(clientId);
      if (disconnectedClient) {
        disconnectedClient.disconnectedAt = Date.now();
        // Keep client in map for potential reconnection (for a limited time)
        this.log(`SSE client disconnected: ${clientId} (may reconnect within ${SSE_CONNECTION_TIMEOUT}ms)`);

        // Schedule removal after timeout period
        setTimeout(() => {
          if (this.sseClients.has(clientId)) {
            const client = this.sseClients.get(clientId)!;
            if (client.disconnectedAt) {
              this.sseClients.delete(clientId);
              this.log(`SSE client ${clientId} removed after reconnection timeout`);
            }
          }
        }, SSE_CONNECTION_TIMEOUT);
      }
    });

    // Keep-alive ping with timeout monitoring
    const keepAlive = setInterval(() => {
      const currentClient = this.sseClients.get(clientId);
      if (currentClient && !currentClient.disconnectedAt) {
        // Send ping with event ID for reconnection tracking
        const eventId = `${clientId}-${Date.now()}`;
        this.sendSSEEventWithId(client, 'ping', Date.now().toString(), eventId);
        currentClient.lastPingAt = Date.now();
      } else {
        clearInterval(keepAlive);
      }
    }, SSE_PING_INTERVAL);

    // Connection timeout monitoring
    const timeoutCheck = setInterval(() => {
      const currentClient = this.sseClients.get(clientId);
      if (!currentClient) {
        clearInterval(timeoutCheck);
        return;
      }

      // If client is disconnected and timeout has passed, clean up
      if (currentClient.disconnectedAt) {
        const disconnectedDuration = Date.now() - currentClient.disconnectedAt;
        if (disconnectedDuration > SSE_CONNECTION_TIMEOUT) {
          this.sseClients.delete(clientId);
          this.log(`SSE client ${clientId} timed out after ${disconnectedDuration}ms`);
          clearInterval(timeoutCheck);
          clearInterval(keepAlive);
        }
      }
    }, 10000); // Check every 10 seconds
  }

  // Send SSE event with event ID for reconnection tracking
  private sendSSEEventWithId(client: SSEClient, event: string, data: string, eventId: string): void {
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

  // Handle incoming message on SSE transport
  private handleSSEMessage(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url || '/', `http://localhost`);
    const sessionId = url.searchParams.get('sessionId');

    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const request = JSON.parse(body) as MCPRequest;
        const response = await this.handleRequest(request);

        // Send response via HTTP
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (response) {
          res.end(JSON.stringify(response));
        } else {
          res.end(JSON.stringify({ jsonrpc: '2.0', result: 'ok' }));
        }

        // Also send via SSE if client connected
        if (sessionId && this.sseClients.has(sessionId)) {
          const client = this.sseClients.get(sessionId)!;
          if (response) {
            this.sendSSEEvent(client, 'message', JSON.stringify(response));
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
        this.log(`[ERROR] Malformed JSON request: ${errorMessage}`);
        if (position !== undefined) {
          this.log(`[ERROR] Error at position ${position} (line ${lineNumber}, column ${column})`);
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
    });
  }

  // Send SSE event to client
  private sendSSEEvent(client: SSEClient, event: string, data: string): void {
    try {
      client.response.write(`event: ${event}\n`);
      client.response.write(`data: ${data}\n\n`);
    } catch (error) {
      this.log(`Error sending SSE event to ${client.id}: ${error}`);
      this.sseClients.delete(client.id);
    }
  }

  // Check if authentication is required and valid
  private checkAuth(): { valid: boolean; error?: MCPResponse } {
    if (this.config.requireAuth && !this.config.apiKey) {
      return {
        valid: false,
        error: {
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Authentication required. Please provide a valid API key.',
          },
        },
      };
    }
    return { valid: true };
  }

  // Validate API key has MCP scope via backend API
  private async validateMcpScope(): Promise<{ valid: boolean; error?: MCPResponse; scopes?: string[] }> {
    // Skip validation if auth not required
    if (!this.config.requireAuth || !this.config.apiKey) {
      return { valid: true, scopes: ['admin'] }; // No auth required = full access
    }

    // Skip scope validation if no API URL configured (local mode)
    if (!this.config.apiUrl) {
      return { valid: true, scopes: ['admin'] }; // Local mode = full access
    }

    try {
      const apiUrl = this.config.apiUrl;
      const url = new URL('/api/v1/mcp/validate-key', apiUrl);

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.config.apiKey,
          required_scope: 'mcp',
        }),
      });

      const data = await response.json() as {
        valid: boolean;
        error?: string;
        scopes?: string[];
        rate_limit?: PerKeyRateLimitConfig;
      };

      if (!data.valid) {
        // Determine error type based on HTTP status code
        // 401 = Invalid or expired API key (authentication failure)
        // 403 = Insufficient scope (authorization failure)
        const isAuthenticationError = response.status === 401;
        const isAuthorizationError = response.status === 403;

        // Log security event for failed authentication attempts
        const maskedKey = this.config.apiKey
          ? `${this.config.apiKey.substring(0, 7)}...${this.config.apiKey.substring(this.config.apiKey.length - 4)}`
          : 'unknown';

        if (isAuthenticationError) {
          // Log security warning for invalid/expired API key
          this.log(`[SECURITY] Failed authentication attempt with API key: ${maskedKey}`);
          this.log(`[SECURITY] Error: ${data.error || 'Invalid or expired API key'}`);

          return {
            valid: false,
            error: {
              jsonrpc: '2.0',
              error: {
                code: -32001, // Authentication error code
                message: 'Invalid or expired API key',
              },
            },
          };
        } else if (isAuthorizationError) {
          // Log for insufficient scope
          this.log(`[SECURITY] Insufficient scope for API key: ${maskedKey}. Scopes: ${data.scopes?.join(', ') || 'none'}`);

          return {
            valid: false,
            error: {
              jsonrpc: '2.0',
              error: {
                code: -32002, // Authorization error code
                message: data.error || 'API key does not have MCP access. Required scope: mcp or mcp:*',
              },
            },
          };
        } else {
          // Generic validation failure
          this.log(`[SECURITY] API key validation failed for key: ${maskedKey}`);

          return {
            valid: false,
            error: {
              jsonrpc: '2.0',
              error: {
                code: -32002,
                message: data.error || 'API key validation failed',
              },
            },
          };
        }
      }

      // Store per-key rate limits if provided
      if (data.rate_limit && this.config.apiKey) {
        this.perKeyRateLimits.set(this.config.apiKey, data.rate_limit);
        this.log(`Loaded per-key rate limits: ${data.rate_limit.max_requests}/${data.rate_limit.window_seconds}s (burst: ${data.rate_limit.burst_limit}/${data.rate_limit.burst_window_seconds}s)`);
      }

      return { valid: true, scopes: data.scopes || [] };
    } catch (error) {
      // If we can't reach the API, allow access (graceful degradation)
      // In production, you might want to fail closed instead
      this.log(`MCP scope validation failed: ${error}`);
      return { valid: true, scopes: ['admin'] };
    }
  }

  // Check if a tool exists
  private isKnownTool(toolName: string): boolean {
    return TOOL_SCOPE_MAP[toolName] !== undefined;
  }

  // Check if the validated scopes allow a specific tool action
  private hasToolPermission(toolName: string): boolean {
    const requiredAction = TOOL_SCOPE_MAP[toolName];
    if (!requiredAction) {
      // Unknown tool - return false (but this should be handled separately)
      return false;
    }

    // Check if user has any of these:
    // - 'admin' scope (full access)
    // - 'mcp' scope (full MCP access)
    // - specific scope like 'mcp:read', 'mcp:write', 'mcp:execute'
    for (const scope of this.validatedScopes) {
      // Admin has access to everything
      if (scope === 'admin') return true;

      // Generic 'mcp' scope has full MCP access
      if (scope === 'mcp') return true;

      // Check specific scope matches required action
      if (requiredAction === 'read' && (scope === 'mcp:read' || scope === 'mcp:write' || scope === 'mcp:execute')) {
        return true; // Read is allowed for any specific mcp:* scope
      }
      if (requiredAction === 'write' && scope === 'mcp:write') {
        return true;
      }
      if (requiredAction === 'execute' && scope === 'mcp:execute') {
        return true;
      }
    }

    return false;
  }

  // Generate permission denied error for a tool
  private toolPermissionDeniedError(toolName: string, requestId?: string | number): MCPResponse {
    const requiredAction = TOOL_SCOPE_MAP[toolName];
    const requiredScope = requiredAction ? `mcp:${requiredAction}` : 'mcp';

    // Log the permission denied event
    const maskedKey = this.config.apiKey
      ? `${this.config.apiKey.substring(0, 7)}...${this.config.apiKey.substring(this.config.apiKey.length - 4)}`
      : 'unknown';
    this.log(`[SECURITY] Permission denied for tool '${toolName}'. API key: ${maskedKey}, Current scopes: [${this.validatedScopes.join(', ')}], Required: ${requiredScope}`);

    return {
      jsonrpc: '2.0',
      id: requestId,
      error: {
        code: -32003, // 403 Forbidden equivalent
        message: `Permission denied. Tool '${toolName}' requires '${requiredScope}' scope. Update your API key permissions in the QA Guardian dashboard to include the '${requiredScope}' scope.`,
      },
    };
  }

  // Generate unknown tool error with suggestions
  private unknownToolError(toolName: string, requestId?: string | number): MCPResponse {
    // Get list of available tools
    const availableTools = TOOLS.map(t => t.name);

    // Find similar tool names using Levenshtein distance
    const suggestions = findSimilarStrings(toolName, availableTools);

    // Build helpful error message
    let errorMessage = `Unknown tool: ${toolName}.`;
    if (suggestions.length > 0) {
      errorMessage += ` Did you mean: ${suggestions.join(', ')}?`;
    }

    this.log(`[ERROR] Unknown tool invocation: ${toolName}`);

    return {
      jsonrpc: '2.0',
      id: requestId,
      error: {
        code: -32601, // Method not found (404 equivalent)
        message: errorMessage,
        data: {
          requestedTool: toolName,
          availableTools,
          suggestions: suggestions.length > 0 ? suggestions : undefined,
        },
      },
    };
  }

  // Cache for MCP scope validation (to avoid repeated API calls)
  private mcpScopeValidated = false;
  private mcpScopeError: MCPResponse | null = null;
  private validatedScopes: string[] = [];

  // Feature #1356: Tool scope requirements are now imported from ./tool-permissions.ts
  // See TOOL_SCOPE_MAP in tool-permissions.ts for the full mapping

  // Get effective rate limit config for the current API key
  // Uses per-key config if available, otherwise falls back to default
  private getEffectiveRateLimitConfig(): { maxRequests: number; windowMs: number; burstLimit: number; burstWindowMs: number } {
    const identifier = this.config.apiKey || 'anonymous';
    const perKeyConfig = this.perKeyRateLimits.get(identifier);

    if (perKeyConfig) {
      return {
        maxRequests: perKeyConfig.max_requests,
        windowMs: perKeyConfig.window_seconds * 1000,
        burstLimit: perKeyConfig.burst_limit,
        burstWindowMs: perKeyConfig.burst_window_seconds * 1000,
      };
    }

    return this.rateLimitConfig;
  }

  // Check rate limit for the current API key
  // Uses a sliding window algorithm with burst support
  private checkRateLimit(): {
    allowed: boolean;
    error?: MCPResponse;
    remaining: number;
    resetMs: number;
    headers: { 'X-RateLimit-Limit': number; 'X-RateLimit-Remaining': number; 'X-RateLimit-Reset': number; 'X-RateLimit-Burst-Limit': number; 'X-RateLimit-Burst-Remaining': number };
  } {
    // Use API key as identifier, or 'anonymous' for unauthenticated requests
    const identifier = this.config.apiKey || 'anonymous';
    const now = Date.now();
    const config = this.getEffectiveRateLimitConfig();
    const windowStart = now - config.windowMs;
    const burstWindowStart = now - config.burstWindowMs;

    // Get or create rate limit entry
    let entry = this.rateLimitStore.get(identifier);
    if (!entry) {
      entry = { timestamps: [], burstTimestamps: [] };
      this.rateLimitStore.set(identifier, entry);
    }

    // Remove timestamps outside the current windows (sliding window)
    entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);
    entry.burstTimestamps = entry.burstTimestamps.filter(ts => ts > burstWindowStart);

    // Check if rate limit exceeded
    const requestCount = entry.timestamps.length;
    const burstCount = entry.burstTimestamps.length;
    const remaining = Math.max(0, config.maxRequests - requestCount);
    const burstRemaining = Math.max(0, config.burstLimit - burstCount);

    // Calculate time until oldest request expires (reset time)
    const resetMs = entry.timestamps.length > 0
      ? Math.max(0, entry.timestamps[0] + config.windowMs - now)
      : 0;

    // Rate limit headers to return with every response
    const headers = {
      'X-RateLimit-Limit': config.maxRequests,
      'X-RateLimit-Remaining': Math.max(0, remaining - 1),
      'X-RateLimit-Reset': Math.ceil((now + resetMs) / 1000),
      'X-RateLimit-Burst-Limit': config.burstLimit,
      'X-RateLimit-Burst-Remaining': Math.max(0, burstRemaining - 1),
    };

    // Check if both rate limit AND burst limit exceeded
    if (requestCount >= config.maxRequests) {
      // Main rate limit exceeded - check if burst is available
      if (burstCount >= config.burstLimit) {
        // Both limits exceeded - reject request
        this.log(`Rate limit exceeded for ${identifier}: ${requestCount}/${config.maxRequests} (burst: ${burstCount}/${config.burstLimit})`);
        return {
          allowed: false,
          remaining: 0,
          resetMs,
          headers: { ...headers, 'X-RateLimit-Remaining': 0, 'X-RateLimit-Burst-Remaining': 0 },
          error: {
            jsonrpc: '2.0',
            error: {
              code: -32004, // Rate limit exceeded error code
              message: `Rate limit exceeded. Maximum ${config.maxRequests} requests per ${config.windowMs / 1000} seconds (burst: ${config.burstLimit}/${config.burstWindowMs / 1000}s). Try again in ${Math.ceil(resetMs / 1000)} seconds.`,
              data: {
                limit: config.maxRequests,
                remaining: 0,
                resetMs,
                retryAfter: Math.ceil(resetMs / 1000),
                burst_limit: config.burstLimit,
                burst_remaining: 0,
              },
            },
          },
        };
      }

      // Main limit exceeded but burst available - allow with warning
      this.log(`Using burst allowance for ${identifier}: ${burstCount + 1}/${config.burstLimit} (main: ${requestCount}/${config.maxRequests})`);
      entry.burstTimestamps.push(now);

      return {
        allowed: true,
        remaining: 0,
        resetMs,
        headers: { ...headers, 'X-RateLimit-Remaining': 0, 'X-RateLimit-Burst-Remaining': Math.max(0, burstRemaining - 1) },
      };
    }

    // Add current request timestamp to main window
    entry.timestamps.push(now);

    return {
      allowed: true,
      remaining: remaining - 1, // -1 because we just added this request
      resetMs,
      headers,
    };
  }

  // Get current rate limit status without consuming a request
  private getRateLimitStatus(): { remaining: number; limit: number; resetMs: number; burstLimit: number; burstRemaining: number } {
    const identifier = this.config.apiKey || 'anonymous';
    const now = Date.now();
    const config = this.getEffectiveRateLimitConfig();
    const windowStart = now - config.windowMs;
    const burstWindowStart = now - config.burstWindowMs;

    const entry = this.rateLimitStore.get(identifier);
    if (!entry) {
      return {
        remaining: config.maxRequests,
        limit: config.maxRequests,
        resetMs: 0,
        burstLimit: config.burstLimit,
        burstRemaining: config.burstLimit,
      };
    }

    // Count requests in current windows
    const validTimestamps = entry.timestamps.filter(ts => ts > windowStart);
    const validBurstTimestamps = entry.burstTimestamps.filter(ts => ts > burstWindowStart);
    const remaining = Math.max(0, config.maxRequests - validTimestamps.length);
    const burstRemaining = Math.max(0, config.burstLimit - validBurstTimestamps.length);
    const resetMs = validTimestamps.length > 0
      ? Math.max(0, validTimestamps[0] + config.windowMs - now)
      : 0;

    return {
      remaining,
      limit: config.maxRequests,
      resetMs,
      burstLimit: config.burstLimit,
      burstRemaining,
    };
  }

  // Feature #1356: findSimilarTools and levenshteinDistance moved to ./string-utils.ts
  // Feature #1356: calculateNextCronRun and describeCronExpression moved to ./cron-utils.ts

  // Feature #1220: Execute a single workflow step by calling the appropriate API
  private async executeWorkflowStep(tool: string, args: Record<string, unknown>): Promise<unknown> {
    // Map common tools to their API endpoints
    const toolApiMap: Record<string, { method: string; path: string | ((args: Record<string, unknown>) => string); bodyKeys?: string[] }> = {
      'batch_trigger_tests': {
        method: 'POST',
        path: '/api/v1/suites/batch-run',
        bodyKeys: ['suite_ids', 'browser', 'branch', 'env', 'parallel', 'retries'],
      },
      // Feature #1428: get_run_status replaced by get_run
      'get_run': {
        method: 'GET',
        path: (a) => `/api/v1/runs/${a.run_id}/status`,
      },
      'subscribe_to_alerts': {
        method: 'GET',
        path: '/api/v1/monitoring/alert-grouping/groups?status=active',
      },
      // Feature #1429: get_test_results replaced by get_result
      'get_result': {
        method: 'GET',
        path: (a) => `/api/v1/runs/${a.run_id}/results`,
      },
      'trigger_test_run': {
        method: 'POST',
        path: (a) => `/api/v1/suites/${a.suite_id}/runs`,
        bodyKeys: ['browser', 'branch', 'env', 'parallel', 'retries'],
      },
      'get_flaky_tests': {
        method: 'GET',
        path: '/api/v1/tests/flaky',
      },
      'list_projects': {
        method: 'GET',
        path: '/api/v1/projects',
      },
    };

    const mapping = toolApiMap[tool];
    if (!mapping) {
      // For unmapped tools, return a simulated result
      this.log(`[WORKFLOW] Tool "${tool}" not mapped for workflow execution, returning simulated result`);
      return {
        success: true,
        tool,
        simulated: true,
        args,
        message: `Tool ${tool} executed (simulated)`,
      };
    }

    // Build path
    const path = typeof mapping.path === 'function' ? mapping.path(args) : mapping.path;

    // Build body if needed
    let body: Record<string, unknown> | undefined;
    if (mapping.method === 'POST' && mapping.bodyKeys) {
      body = {};
      for (const key of mapping.bodyKeys) {
        if (args[key] !== undefined) {
          body[key] = args[key];
        }
      }
    }

    // Call the API
    return await this.callApi(path, mapping.method !== 'GET' ? { method: mapping.method, body } : undefined);
  }

  // Handle incoming MCP request
  private async handleRequest(request: MCPRequest): Promise<MCPResponse | null> {
    this.log(`Received request: ${request.method}`);

    // Check if server is shutting down - reject new requests
    if (this.isShuttingDown && request.method !== 'ping') {
      this.log(`[SHUTDOWN] Rejecting request ${request.method} - server is shutting down`);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32006, // Server shutdown error code
          message: 'Server is shutting down. Please reconnect shortly.',
          data: {
            reason: 'shutdown',
            inProgressOperations: this.inProgressOperations.size,
            reconnectAfter: 5000,
          },
        },
      };
    }

    switch (request.method) {
      case 'initialize':
        return this.handleInitialize(request);
      case 'initialized':
        // This is a notification, no response needed
        this.initialized = true;
        this.log('Server initialized');
        return null;
      case 'tools/list':
        // Allow listing tools without auth
        return this.handleToolsList(request);
      case 'tools/call': {
        // Check basic auth for tool calls
        const authCheck = this.checkAuth();
        if (!authCheck.valid) {
          return { ...authCheck.error!, id: request.id };
        }
        // Check MCP scope (cached after first validation)
        if (!this.mcpScopeValidated) {
          const scopeCheck = await this.validateMcpScope();
          this.mcpScopeValidated = true;
          if (!scopeCheck.valid) {
            this.mcpScopeError = scopeCheck.error || null;
          } else {
            this.validatedScopes = scopeCheck.scopes || [];
            this.log(`Validated scopes: ${this.validatedScopes.join(', ')}`);
          }
        }
        if (this.mcpScopeError) {
          return { ...this.mcpScopeError, id: request.id };
        }

        // Check tool-specific permission
        const params = request.params as { name: string; arguments?: Record<string, unknown> };
        const toolName = params?.name;

        // First check if tool exists (before checking permission)
        if (toolName && !this.isKnownTool(toolName)) {
          return this.unknownToolError(toolName, request.id);
        }

        // Then check permission
        if (toolName && !this.hasToolPermission(toolName)) {
          return this.toolPermissionDeniedError(toolName, request.id);
        }

        // Check rate limit for tool calls
        const rateLimitCheck = this.checkRateLimit();
        if (!rateLimitCheck.allowed) {
          return { ...rateLimitCheck.error!, id: request.id };
        }

        return this.handleToolsCall(request);
      }
      case 'tools/call-batch': {
        // Feature #856: Handle batch tool calls
        // Check basic auth for tool calls
        const authCheck = this.checkAuth();
        if (!authCheck.valid) {
          return { ...authCheck.error!, id: request.id };
        }
        // Check MCP scope (cached after first validation)
        if (!this.mcpScopeValidated) {
          const scopeCheck = await this.validateMcpScope();
          this.mcpScopeValidated = true;
          if (!scopeCheck.valid) {
            this.mcpScopeError = scopeCheck.error || null;
          } else {
            this.validatedScopes = scopeCheck.scopes || [];
            this.log(`Validated scopes: ${this.validatedScopes.join(', ')}`);
          }
        }
        if (this.mcpScopeError) {
          return { ...this.mcpScopeError, id: request.id };
        }

        // Check rate limit for batch calls (counts as one request)
        const rateLimitCheck = this.checkRateLimit();
        if (!rateLimitCheck.allowed) {
          return { ...rateLimitCheck.error!, id: request.id };
        }

        return this.handleToolsCallBatch(request);
      }
      case 'resources/list':
        // Allow listing resources without auth
        return this.handleResourcesList(request);
      case 'resources/read': {
        // Check basic auth for resource reads
        const authCheck = this.checkAuth();
        if (!authCheck.valid) {
          return { ...authCheck.error!, id: request.id };
        }
        // Check MCP scope (cached after first validation)
        if (!this.mcpScopeValidated) {
          const scopeCheck = await this.validateMcpScope();
          this.mcpScopeValidated = true;
          if (!scopeCheck.valid) {
            this.mcpScopeError = scopeCheck.error || null;
          } else {
            this.validatedScopes = scopeCheck.scopes || [];
            this.log(`Validated scopes: ${this.validatedScopes.join(', ')}`);
          }
        }
        if (this.mcpScopeError) {
          return { ...this.mcpScopeError, id: request.id };
        }

        // Resources are read-only, so check for mcp:read scope
        const hasReadAccess = this.validatedScopes.some(scope =>
          scope === 'admin' ||
          scope === 'mcp' ||
          scope.startsWith('mcp:')
        );
        if (!hasReadAccess) {
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32003,
              message: `Permission denied. Resource read requires 'mcp:read' scope.`,
            },
          };
        }

        // Check rate limit for resource reads
        const rateLimitCheck = this.checkRateLimit();
        if (!rateLimitCheck.allowed) {
          return { ...rateLimitCheck.error!, id: request.id };
        }

        return this.handleResourcesRead(request);
      }
      case 'ping':
        return this.handlePing(request);
      default:
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`,
          },
        };
    }
  }

  // Handle initialize request
  private handleInitialize(request: MCPRequest): MCPResponse {
    // Feature #846: Capture client info for audit logging
    const params = request.params as {
      protocolVersion?: string;
      capabilities?: Record<string, unknown>;
      clientInfo?: { name: string; version: string };
    };

    if (params?.clientInfo) {
      this.clientInfo = params.clientInfo;
      this.log(`Client connected: ${params.clientInfo.name} v${params.clientInfo.version}`);
    }

    // Generate a connection ID for audit tracking
    this.connectionId = `conn_${Date.now()}_${randomUUID().slice(0, 8)}`;
    this.log(`Connection ID: ${this.connectionId}`);

    // Log the initialize event
    this.sendAuditLog({
      method: 'initialize',
      request_params: { clientInfo: params?.clientInfo },
      response_type: 'success',
      duration_ms: 0,
    });

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: {},
          resources: {},
        },
        serverInfo: SERVER_INFO,
        // Feature #858: Include API version info
        apiVersioning: {
          currentVersion: CURRENT_API_VERSION,
          defaultVersion: this.defaultApiVersion,
          supportedVersions: Object.keys(API_VERSIONS),
          versions: Object.values(API_VERSIONS).map(v => ({
            version: v.version,
            status: v.status,
            deprecationDate: v.deprecationDate,
            sunsetDate: v.sunsetDate,
          })),
        },
      },
    };
  }

  // Handle tools/list request
  private handleToolsList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools: TOOLS,
      },
    };
  }

  // Validate required parameters for a tool
  // Feature #1356: Uses findMissingRequiredParams from validation-utils.ts
  private validateRequiredParams(toolName: string, toolArgs: Record<string, unknown>): { valid: boolean; error?: MCPResponse } {
    // Find the tool definition
    const tool = TOOLS.find(t => t.name === toolName);
    if (!tool) {
      return { valid: true }; // Unknown tool handled elsewhere
    }

    const schema = tool.inputSchema;
    const requiredParams = schema?.required as string[] | undefined;
    if (!requiredParams || requiredParams.length === 0) {
      return { valid: true }; // No required params
    }

    // Use extracted utility to find missing params
    const properties = schema?.properties as Record<string, { description?: string }> | undefined;
    const missingParams = findMissingRequiredParams(toolArgs, requiredParams, properties);

    if (missingParams.length === 0) {
      return { valid: true };
    }

    // Build error message
    const paramNames = missingParams.map(p => p.name);
    const errorMessage = missingParams.length === 1
      ? `Missing required parameter: ${paramNames[0]}`
      : `Missing required parameters: ${paramNames.join(', ')}`;

    // Build detailed data with descriptions
    const missingDetails = missingParams.map(p => ({
      parameter: p.name,
      description: p.description || 'No description available',
    }));

    this.log(`[ERROR] Missing required parameters for tool '${toolName}': ${paramNames.join(', ')}`);

    return {
      valid: false,
      error: {
        jsonrpc: '2.0',
        error: {
          code: -32602, // Invalid params (400 Bad Request equivalent)
          message: errorMessage,
          data: {
            tool: toolName,
            missingParameters: missingDetails,
          },
        },
      },
    };
  }

  // Validate parameter types for a tool
  // Feature #1356: Uses validateParameterTypes from validation-utils.ts
  private validateParamTypes(toolName: string, toolArgs: Record<string, unknown>): { valid: boolean; error?: MCPResponse } {
    // Find the tool definition
    const tool = TOOLS.find(t => t.name === toolName);
    if (!tool) {
      return { valid: true }; // Unknown tool handled elsewhere
    }

    const schema = tool.inputSchema;
    const properties = schema?.properties as Record<string, { type?: string; enum?: unknown[]; description?: string }> | undefined;
    if (!properties) {
      return { valid: true }; // No properties defined
    }

    // Use extracted utility to validate parameter types
    const typeErrors = validateParameterTypes(toolArgs, properties);

    if (typeErrors.length === 0) {
      return { valid: true };
    }

    // Build error message
    const errorMessage = typeErrors.length === 1
      ? `Invalid type for ${typeErrors[0].parameter}: expected ${typeErrors[0].expectedType}, got ${typeErrors[0].actualType}`
      : `Invalid types for parameters: ${typeErrors.map(e => e.parameter).join(', ')}`;

    this.log(`[ERROR] Invalid parameter types for tool '${toolName}': ${typeErrors.map(e => `${e.parameter} (expected ${e.expectedType}, got ${e.actualType})`).join(', ')}`);

    return {
      valid: false,
      error: {
        jsonrpc: '2.0',
        error: {
          code: -32602, // Invalid params (400 Bad Request equivalent)
          message: errorMessage,
          data: {
            tool: toolName,
            invalidParameters: typeErrors,
          },
        },
      },
    };
  }

  // Feature #1356: Validation utilities moved to validation-utils.ts
  // - getJsonType, isTypeMatch, getValidExample, validateK6Script

  // Handle tools/call request
  private async handleToolsCall(request: MCPRequest): Promise<MCPResponse> {
    const params = request.params as { name: string; arguments?: Record<string, unknown> };
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};

    // Feature #858: Parse and track API version for this request
    this.requestApiVersion = this.parseApiVersionFromParams(toolArgs);
    this.log(`Calling tool: ${toolName} (API ${this.requestApiVersion}) with args: ${JSON.stringify(toolArgs)}`);
    const startTime = Date.now();

    // Validate required parameters before execution
    const paramValidation = this.validateRequiredParams(toolName, toolArgs);
    if (!paramValidation.valid) {
      return { ...paramValidation.error!, id: request.id };
    }

    // Validate parameter types
    const typeValidation = this.validateParamTypes(toolName, toolArgs);
    if (!typeValidation.valid) {
      return { ...typeValidation.error!, id: request.id };
    }

    // Feature #857: Check idempotency cache
    const idempotencyKey = this.parseIdempotencyKey(toolArgs);
    if (idempotencyKey) {
      const requestHash = generateRequestHash(toolName, toolArgs);
      const cachedEntry = this.checkIdempotency(idempotencyKey, toolName, requestHash);
      if (cachedEntry) {
        // Return cached response with idempotency indicator
        const cachedResponse = { ...cachedEntry.response };
        if (cachedResponse.result && typeof cachedResponse.result === 'object') {
          (cachedResponse.result as Record<string, unknown>)._idempotent = {
            cached: true,
            key: idempotencyKey,
            originalRequestAt: cachedEntry.createdAt,
          };
        }
        return cachedResponse;
      }
    }

    // Feature #851: Parse priority from request params
    const requestPriority = this.parsePriority(toolArgs);

    // Check concurrent request limit (with priority)
    const apiKey = this.config.apiKey || 'anonymous';
    const slotResult = await this.acquireConcurrentSlot(apiKey, requestPriority);

    if (!slotResult.acquired) {
      // Request was queued but timed out
      const stats = this.getConcurrentStats(apiKey);
      this.log(`[ERROR] Concurrent request limit exceeded for tool '${toolName}' (priority: ${requestPriority})`);

      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32005, // Too many concurrent requests (429 equivalent)
          message: `Too many concurrent requests. Maximum ${this.maxConcurrentRequests} allowed. Request was queued but timed out.`,
          data: {
            maxConcurrent: this.maxConcurrentRequests,
            active: stats.active,
            queued: stats.queued,
            queuePosition: slotResult.position,
            priority: slotResult.priority, // Feature #851: Include priority in response
            retryAfter: 5, // Suggest retry after 5 seconds
          },
        },
      };
    }

    if (slotResult.queued) {
      this.log(`[CONCURRENT] Queued request for tool '${toolName}' (priority: ${requestPriority}) now processing`);
    }

    // Track this operation for graceful shutdown
    const operationId = `${request.id || Date.now()}-${toolName}`;
    const abortController = this.trackOperationStart(operationId, toolName, request.id);

    try {
      // Feature #849: Wrap tool execution with configurable timeout
      const executeToolSwitch = async (): Promise<unknown | MCPResponse> => {
        // Feature #1356: Check handler registry first for extracted handlers
        if (hasHandler(toolName)) {
          const handlerContext: HandlerContext = {
            callApi: this.callApi.bind(this),
            callApiPublic: this.callApiPublic.bind(this),
            log: this.log.bind(this),
            apiKey: this.config.apiKey,
            apiUrl: this.config.apiUrl || 'http://localhost:3001',
          };
          return await executeHandler(toolName, toolArgs, handlerContext);
        }

        // Feature #1356: All tools now have handlers - switch statement removed
        // If we reach here, the tool is unknown (not in handler registry)

        // Get list of available tools
        const availableTools = TOOLS.map(t => t.name);

        // Find similar tool names using simple string matching
        const suggestions = findSimilarStrings(toolName, availableTools);

        // Build helpful error message
        let errorMessage = `Unknown tool: ${toolName}.`;
        if (suggestions.length > 0) {
          errorMessage += ` Did you mean: ${suggestions.join(', ')}?`;
        }

        this.log(`[ERROR] Unknown tool invocation: ${toolName}`);

        // Release slot before returning
        this.releaseConcurrentSlot(apiKey);

        // Return error response for unknown tool
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601, // Method not found (404 equivalent)
            message: errorMessage,
            data: {
              requestedTool: toolName,
              availableTools,
              suggestions: suggestions.length > 0 ? suggestions : undefined,
            },
          },
        } as MCPResponse;
      };

      // Execute tool with timeout
      const executionResult = await this.executeWithTimeout(
        executeToolSwitch(),
        this.toolTimeout,
        toolName
      );

      // Check if result is an error response (from default case)
      if (executionResult && typeof executionResult === 'object' && 'error' in executionResult) {
        return executionResult as MCPResponse;
      }

      const result = executionResult;
      const responseTime = Date.now() - startTime;
      this.log(`Tool '${toolName}' completed in ${responseTime}ms`);

      // Track operation completion
      this.trackOperationComplete(operationId);

      // Feature #855: Parse webhook callback from request
      const callbackConfig = this.parseWebhookCallbackImpl(toolArgs) || this.config.webhookCallback;

      // Feature #854: Check if streaming should be used
      // Parse _stream parameter from tool args
      const forceStream = toolArgs._stream as boolean | undefined;
      const shouldStream = this.shouldStreamResult(result, forceStream);

      if (shouldStream) {
        this.log(`[STREAM] Tool '${toolName}' result will be streamed (triggered by ${forceStream !== undefined ? 'explicit _stream parameter' : 'auto-detection'})`);

        // Release concurrent slot before streaming (streaming is async)
        this.releaseConcurrentSlot(apiKey);

        // Stream the result
        const streamResponse = await this.streamResult(result, request.id, toolName);

        // Feature #846: Audit log successful tool call (streaming)
        const streamInfo = (streamResponse.result as Record<string, unknown>)?._streaming as Record<string, unknown>;
        this.sendAuditLog({
          method: 'tools/call',
          tool_name: toolName,
          request_params: toolArgs,
          response_type: 'success',
          response_data_preview: `[STREAMED] ${streamInfo?.totalItems || 0} items in ${streamInfo?.totalChunks || 0} chunks`,
          duration_ms: responseTime,
          streaming: true,
          stream_id: streamInfo?.streamId as string,
        });

        // Feature #855: Send webhook callback for streaming response (async, don't wait)
        if (callbackConfig) {
          const webhookPayload: WebhookCallbackPayload = {
            timestamp: Date.now(),
            requestId: request.id,
            toolName,
            status: 'success',
            duration_ms: responseTime,
            streaming: {
              streamId: streamInfo?.streamId as string,
              totalItems: streamInfo?.totalItems as number,
              totalChunks: streamInfo?.totalChunks as number,
            },
            ...(callbackConfig.includeRequestParams ? { requestParams: toolArgs } : {}),
          };
          this.sendWebhookCallbackImpl(callbackConfig, webhookPayload).catch(err => {
            this.log(`[WEBHOOK] Failed to send callback: ${err instanceof Error ? err.message : 'Unknown error'}`);
          });
        }

        // Feature #857: Store streaming response in idempotency cache
        if (idempotencyKey) {
          const reqHash = generateRequestHash(toolName, toolArgs);
          this.storeIdempotencyResponse(idempotencyKey, toolName, reqHash, streamResponse);
        }

        // Feature #858: Add version warnings to streaming response
        return this.addApiVersionWarnings(streamResponse, this.requestApiVersion);
      }

      // Feature #846: Audit log successful tool call (non-streaming)
      const resultStr = JSON.stringify(result, null, 2);
      this.sendAuditLog({
        method: 'tools/call',
        tool_name: toolName,
        request_params: toolArgs,
        response_type: 'success',
        response_data_preview: resultStr.length > 500 ? resultStr.slice(0, 500) + '...' : resultStr,
        duration_ms: responseTime,
      });

      // Feature #855: Send webhook callback for non-streaming response (async, don't wait)
      if (callbackConfig) {
        const webhookPayload: WebhookCallbackPayload = {
          timestamp: Date.now(),
          requestId: request.id,
          toolName,
          status: 'success',
          duration_ms: responseTime,
          result: result,
          ...(callbackConfig.includeRequestParams ? { requestParams: toolArgs } : {}),
        };
        this.sendWebhookCallbackImpl(callbackConfig, webhookPayload).catch(err => {
          this.log(`[WEBHOOK] Failed to send callback: ${err instanceof Error ? err.message : 'Unknown error'}`);
        });
      }

      const successResponse: MCPResponse = {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'text',
              text: resultStr,
            },
          ],
        },
      };

      // Feature #857: Store response in idempotency cache
      if (idempotencyKey) {
        const reqHash = generateRequestHash(toolName, toolArgs);
        this.storeIdempotencyResponse(idempotencyKey, toolName, reqHash, successResponse);
      }

      // Feature #858: Add version warnings to response
      return this.addApiVersionWarnings(successResponse, this.requestApiVersion);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.log(`Tool '${toolName}' failed in ${responseTime}ms`);

      // Track operation completion (even on error)
      this.trackOperationComplete(operationId);

      // Feature #855: Parse webhook callback (also for error notifications)
      const errorCallbackConfig = this.parseWebhookCallbackImpl(toolArgs) || this.config.webhookCallback;

      // Check if this was an abort due to server shutdown
      if (error instanceof Error && error.name === 'AbortError') {
        // Feature #855: Send webhook callback for abort error
        if (errorCallbackConfig) {
          const webhookPayload: WebhookCallbackPayload = {
            timestamp: Date.now(),
            requestId: request.id,
            toolName,
            status: 'error',
            duration_ms: responseTime,
            error: { code: -32006, message: 'Operation aborted due to server shutdown' },
            ...(errorCallbackConfig.includeRequestParams ? { requestParams: toolArgs } : {}),
          };
          this.sendWebhookCallbackImpl(errorCallbackConfig, webhookPayload).catch(() => {});
        }
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32006, // Server shutdown error code
            message: 'Operation aborted due to server shutdown',
            data: {
              reason: 'shutdown',
              tool: toolName,
              aborted: true,
            },
          },
        };
      }

      // Feature #849: Check if this was a timeout error
      if (error instanceof Error && error.name === 'TimeoutError') {
        // Feature #846: Audit log timeout error
        this.sendAuditLog({
          method: 'tools/call',
          tool_name: toolName,
          request_params: toolArgs,
          response_type: 'error',
          response_error_code: -32007,
          response_error_message: error.message,
          duration_ms: responseTime,
        });

        // Feature #855: Send webhook callback for timeout error
        if (errorCallbackConfig) {
          const webhookPayload: WebhookCallbackPayload = {
            timestamp: Date.now(),
            requestId: request.id,
            toolName,
            status: 'error',
            duration_ms: responseTime,
            error: { code: -32007, message: error.message },
            ...(errorCallbackConfig.includeRequestParams ? { requestParams: toolArgs } : {}),
          };
          this.sendWebhookCallbackImpl(errorCallbackConfig, webhookPayload).catch(() => {});
        }

        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32007, // Tool execution timeout error code
            message: error.message,
            data: {
              reason: 'timeout',
              tool: toolName,
              timeout_ms: this.toolTimeout,
              duration_ms: responseTime,
            },
          },
        };
      }

      // Build helpful error message with tool context
      const errorMessage = error instanceof Error ? error.message : 'Tool execution failed';
      const toolContext = `Error in tool '${toolName}'`;

      // Add tool-specific help based on common issues
      let helpText = '';
      if (toolName === 'get_result' || toolName === 'get_run') {  // Feature #1428: get_run, Feature #1429: get_result
        helpText = ' Make sure the run_id parameter is a valid test run ID.';
      } else if (toolName === 'trigger_test_run') {
        helpText = ' Make sure the suite_id parameter is a valid test suite ID.';
      } else if (toolName === 'get_project') {
        helpText = ' Make sure the project_id parameter is a valid project ID.';
      } else if (toolName === 'list_test_suites') {
        helpText = ' Make sure the project_id parameter is a valid project ID.';
      } else if (toolName === 'get_test_artifacts') {
        helpText = ' Make sure the run_id parameter is a valid test run ID.';
      }

      const fullErrorMessage = `${toolContext}: ${errorMessage}${helpText}`;

      // Feature #846: Audit log failed tool call
      this.sendAuditLog({
        method: 'tools/call',
        tool_name: toolName,
        request_params: toolArgs,
        response_type: 'error',
        response_error_code: -32000,
        response_error_message: fullErrorMessage,
        duration_ms: responseTime,
      });

      // Feature #855: Send webhook callback for general error
      if (errorCallbackConfig) {
        const webhookPayload: WebhookCallbackPayload = {
          timestamp: Date.now(),
          requestId: request.id,
          toolName,
          status: 'error',
          duration_ms: responseTime,
          error: { code: -32000, message: fullErrorMessage },
          ...(errorCallbackConfig.includeRequestParams ? { requestParams: toolArgs } : {}),
        };
        this.sendWebhookCallbackImpl(errorCallbackConfig, webhookPayload).catch(() => {});
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32000,
          message: fullErrorMessage,
        },
      };
    } finally {
      // Always release the concurrent slot
      this.releaseConcurrentSlot(apiKey);
    }
  }

  // Feature #856: Handle batch tool calls
  private async handleToolsCallBatch(request: MCPRequest): Promise<MCPResponse> {
    const params = request.params as {
      operations: BatchOperationItem[];
      parallel?: boolean; // Execute operations in parallel (default: false)
      stopOnError?: boolean; // Stop batch on first error (default: false)
    };

    const operations = params?.operations;
    const parallel = params?.parallel ?? false;
    const stopOnError = params?.stopOnError ?? false;

    // Validate batch request
    if (!operations || !Array.isArray(operations)) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32602,
          message: 'Invalid params: operations array is required',
          data: {
            expected: 'operations: BatchOperationItem[]',
            received: typeof operations,
          },
        },
      };
    }

    if (operations.length === 0) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32602,
          message: 'Invalid params: operations array cannot be empty',
        },
      };
    }

    if (operations.length > 50) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32602,
          message: 'Invalid params: maximum 50 operations per batch',
          data: {
            maxOperations: 50,
            received: operations.length,
          },
        },
      };
    }

    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const batchStartTime = Date.now();
    const results: BatchOperationResult[] = [];
    let succeeded = 0;
    let failed = 0;

    this.log(`[BATCH] Starting batch ${batchId} with ${operations.length} operations (parallel: ${parallel})`);

    // Execute operations
    const executeOperation = async (op: BatchOperationItem): Promise<BatchOperationResult> => {
      const opStartTime = Date.now();
      const operationId = op.id ?? `op-${Math.random().toString(36).substring(2, 9)}`;

      // Validate operation
      if (!op.name || typeof op.name !== 'string') {
        return {
          id: operationId,
          status: 'error',
          error: { code: -32602, message: 'Invalid operation: name is required' },
          duration_ms: Date.now() - opStartTime,
        };
      }

      // Check if tool exists
      if (!this.isKnownTool(op.name)) {
        return {
          id: operationId,
          status: 'error',
          error: { code: -32601, message: `Unknown tool: ${op.name}` },
          duration_ms: Date.now() - opStartTime,
        };
      }

      // Check tool permission
      if (!this.hasToolPermission(op.name)) {
        return {
          id: operationId,
          status: 'error',
          error: { code: -32003, message: `Permission denied for tool: ${op.name}` },
          duration_ms: Date.now() - opStartTime,
        };
      }

      try {
        // Create a synthetic request for the tool call
        const toolRequest: MCPRequest = {
          jsonrpc: '2.0',
          id: `${batchId}-${operationId}`,
          method: 'tools/call',
          params: {
            name: op.name,
            arguments: op.arguments || {},
          },
        };

        // Call the tool
        const response = await this.handleToolsCall(toolRequest);
        const duration = Date.now() - opStartTime;

        if (response.error) {
          return {
            id: operationId,
            status: 'error',
            error: {
              code: response.error.code,
              message: response.error.message,
            },
            duration_ms: duration,
          };
        }

        return {
          id: operationId,
          status: 'success',
          result: response.result,
          duration_ms: duration,
        };
      } catch (error) {
        return {
          id: operationId,
          status: 'error',
          error: {
            code: -32000,
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          duration_ms: Date.now() - opStartTime,
        };
      }
    };

    if (parallel) {
      // Execute all operations in parallel
      const operationPromises = operations.map(executeOperation);
      const operationResults = await Promise.all(operationPromises);

      for (const result of operationResults) {
        results.push(result);
        if (result.status === 'success') {
          succeeded++;
        } else {
          failed++;
        }
      }
    } else {
      // Execute operations sequentially
      for (const op of operations) {
        const result = await executeOperation(op);
        results.push(result);

        if (result.status === 'success') {
          succeeded++;
        } else {
          failed++;
          if (stopOnError) {
            this.log(`[BATCH] Stopping batch ${batchId} due to error on operation ${result.id}`);
            break;
          }
        }
      }
    }

    const batchDuration = Date.now() - batchStartTime;
    this.log(`[BATCH] Completed batch ${batchId}: ${succeeded} succeeded, ${failed} failed in ${batchDuration}ms`);

    const batchResponse: BatchResponse = {
      batchId,
      totalOperations: operations.length,
      succeeded,
      failed,
      results,
      duration_ms: batchDuration,
    };

    const batchMcpResponse: MCPResponse = {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(batchResponse, null, 2),
          },
        ],
        _batch: batchResponse,
      },
    };

    // Feature #858: Add version warnings to batch response
    return this.addApiVersionWarnings(batchMcpResponse, this.requestApiVersion);
  }

  // Handle resources/list request
  private handleResourcesList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        resources: RESOURCES,
      },
    };
  }

  // Available resource patterns for error messages
  private static readonly RESOURCE_PATTERNS = [
    'qa-guardian://projects - List all projects',
    'qa-guardian://projects/{id} - Get a specific project',
    'qa-guardian://recent-runs - List recent test runs',
    'qa-guardian://dashboard-stats - Get dashboard statistics',
    'qa-guardian://test-runs/{id} - Get a specific test run',
    'qa-guardian://test-runs/{id}/results - Get results for a test run',
    'qa-guardian://test-runs/{id}/artifacts - Get artifacts for a test run',
  ];

  // Generate resource not found error
  private resourceNotFoundError(resourceType: string, resourceId: string, requestId?: string | number): MCPResponse {
    const errorMessage = `${resourceType} not found: ${resourceId}`;
    this.log(`[ERROR] Resource not found: ${resourceType} with ID '${resourceId}'`);

    return {
      jsonrpc: '2.0',
      id: requestId,
      error: {
        code: -32001, // Resource not found (404 equivalent)
        message: errorMessage,
        data: {
          resourceType,
          resourceId,
          availablePatterns: MCPServer.RESOURCE_PATTERNS,
        },
      },
    };
  }

  // Generate unknown resource pattern error
  private unknownResourceError(uri: string, requestId?: string | number): MCPResponse {
    this.log(`[ERROR] Unknown resource pattern: ${uri}`);

    return {
      jsonrpc: '2.0',
      id: requestId,
      error: {
        code: -32602, // Invalid params
        message: `Unknown resource pattern: ${uri}`,
        data: {
          requestedUri: uri,
          availablePatterns: MCPServer.RESOURCE_PATTERNS,
        },
      },
    };
  }

  // Validate resource URI format
  private validateResourceUri(uri: string | undefined): { valid: boolean; error?: MCPResponse } {
    if (!uri) {
      return {
        valid: false,
        error: {
          jsonrpc: '2.0',
          error: {
            code: -32602, // Invalid params (400 Bad Request)
            message: 'Invalid resource URI format: URI is required',
            data: {
              expectedFormat: 'qa-guardian://{resource-type}[/{resource-id}]',
              examples: MCPServer.RESOURCE_PATTERNS,
            },
          },
        },
      };
    }

    // Check for common URI format issues
    const validationErrors: string[] = [];

    // Check for wrong protocol prefix (e.g., qaguardian:// instead of qa-guardian://)
    if (!uri.startsWith('qa-guardian://')) {
      if (uri.match(/^[a-z-]+:\/\//i)) {
        const protocol = uri.match(/^([a-z-]+):\/\//i)?.[1];
        validationErrors.push(`Invalid protocol '${protocol}'. Expected 'qa-guardian'`);
      } else {
        validationErrors.push("URI must start with 'qa-guardian://'");
      }
    }

    // Check for double slashes in path (after protocol)
    const pathPart = uri.replace(/^qa-guardian:\/\//, '');
    if (pathPart.includes('//')) {
      validationErrors.push('URI contains invalid double slashes in path');
    }

    // Check for empty path segments
    if (pathPart.split('/').some(segment => segment === '')) {
      validationErrors.push('URI contains empty path segments');
    }

    // Check for invalid characters
    if (uri.match(/[<>{}|\\^`\[\]\s]/)) {
      validationErrors.push('URI contains invalid characters');
    }

    if (validationErrors.length > 0) {
      this.log(`[ERROR] Invalid resource URI format: ${uri} - ${validationErrors.join(', ')}`);

      return {
        valid: false,
        error: {
          jsonrpc: '2.0',
          error: {
            code: -32602, // Invalid params (400 Bad Request)
            message: `Invalid resource URI format: ${validationErrors[0]}`,
            data: {
              requestedUri: uri,
              issues: validationErrors,
              expectedFormat: 'qa-guardian://{resource-type}[/{resource-id}]',
              examples: MCPServer.RESOURCE_PATTERNS,
            },
          },
        },
      };
    }

    return { valid: true };
  }

  // Handle resources/read request
  private async handleResourcesRead(request: MCPRequest): Promise<MCPResponse> {
    const params = request.params as { uri: string };
    const uri = params?.uri;

    // Validate URI format first
    const uriValidation = this.validateResourceUri(uri);
    if (!uriValidation.valid) {
      return { ...uriValidation.error!, id: request.id };
    }

    try {
      let data: unknown;
      let resourceType: string | null = null;
      let resourceId: string | null = null;

      // Check for dynamic resources first
      // Match test-runs/{id}/results
      const testRunResultsMatch = uri?.match(/^qa-guardian:\/\/test-runs\/([^/]+)\/results$/);
      if (testRunResultsMatch) {
        resourceType = 'Test run results';
        resourceId = testRunResultsMatch[1];
        // Get test run and extract just the results
        const runData = await this.callApi(`/api/v1/runs/${resourceId}`) as { run?: { results?: unknown[] } };
        data = { results: runData?.run?.results || [] };
      }
      // Match test-runs/{id}/artifacts
      else {
        const testRunArtifactsMatch = uri?.match(/^qa-guardian:\/\/test-runs\/([^/]+)\/artifacts$/);
        if (testRunArtifactsMatch) {
          resourceType = 'Test run artifacts';
          resourceId = testRunArtifactsMatch[1];
          // Get artifacts from the artifacts endpoint
          data = await this.callApi(`/api/v1/runs/${resourceId}/artifacts`);
        }
        // Feature #1034: Match checks/{id}/status
        else {
          const checkStatusMatch = uri?.match(/^qa-guardian:\/\/checks\/([^/]+)\/status$/);
          if (checkStatusMatch) {
            resourceType = 'Check status';
            resourceId = checkStatusMatch[1];
            data = await this.callApi(`/api/v1/monitoring/checks/${resourceId}`);
          }
          // Match test-runs/{id}
          else {
          const testRunMatch = uri?.match(/^qa-guardian:\/\/test-runs\/([^/]+)$/);
          if (testRunMatch) {
            resourceType = 'Test run';
            resourceId = testRunMatch[1];
            data = await this.callApi(`/api/v1/runs/${resourceId}`);
          }
          // Feature #1026: Match projects/{id}/suites
          else {
            const projectSuitesMatch = uri?.match(/^qa-guardian:\/\/projects\/([^/]+)\/suites$/);
            if (projectSuitesMatch) {
              resourceType = 'Project suites';
              resourceId = projectSuitesMatch[1];
              data = await this.callApi(`/api/v1/projects/${resourceId}/suites`);
            }
            // Match projects/{id}
            else {
              const projectMatch = uri?.match(/^qa-guardian:\/\/projects\/([^/]+)$/);
              if (projectMatch) {
                resourceType = 'Project';
                resourceId = projectMatch[1];
                data = await this.callApi(`/api/v1/projects/${resourceId}`);
              } else {
              // Handle static resources
              switch (uri) {
                case 'qa-guardian://projects':
                  data = await this.callApi('/api/v1/projects');
                  break;
                case 'qa-guardian://recent-runs':
                  data = await this.callApi('/api/v1/runs?limit=20');
                  break;
                case 'qa-guardian://dashboard-stats':
                  data = await this.callApi('/api/v1/dashboard/stats');
                  break;
                // Feature #1030: Security vulnerabilities resource
                case 'qa-guardian://security/vulnerabilities':
                  data = await this.callApi('/api/v1/security/vulnerabilities');
                  break;
                // Feature #1031: Security trends resource
                case 'qa-guardian://security/trends':
                  data = await this.callApi('/api/v1/security/trends');
                  break;
                // Feature #1032: Active alerts resource
                case 'qa-guardian://alerts/active':
                  try {
                    data = await this.callApi('/api/v1/monitoring/alerts?status=active');
                  } catch {
                    // Return simulated empty alerts if endpoint not available
                    data = {
                      alerts: [],
                      total: 0,
                      message: 'No active alerts',
                    };
                  }
                  break;
                // Incidents resource
                case 'qa-guardian://incidents':
                  try {
                    data = await this.callApi('/api/v1/incidents');
                  } catch {
                    // Return simulated empty incidents if endpoint not available
                    data = {
                      incidents: [],
                      total: 0,
                      message: 'No active incidents',
                    };
                  }
                  break;
                // Feature #1033: Analytics dashboard resource
                case 'qa-guardian://analytics/dashboard':
                  try {
                    // Aggregate data from multiple analytics endpoints
                    const [failingTests, browserStats, passRateTrends] = await Promise.all([
                      this.callApi('/api/v1/analytics/failing-tests').catch(() => ({ tests: [] })),
                      this.callApi('/api/v1/analytics/browser-stats').catch(() => ({ browsers: [] })),
                      this.callApi('/api/v1/analytics/pass-rate-trends').catch(() => ({ trends: [] })),
                    ]);
                    data = {
                      summary: {
                        total_tests: 0,
                        passing_tests: 0,
                        failing_tests: (failingTests as { tests: unknown[] }).tests?.length || 0,
                        pass_rate: 0,
                      },
                      browser_stats: browserStats,
                      pass_rate_trends: passRateTrends,
                      failing_tests: failingTests,
                    };
                  } catch {
                    data = {
                      summary: { total_tests: 0, passing_tests: 0, failing_tests: 0, pass_rate: 0 },
                      browser_stats: { browsers: [] },
                      pass_rate_trends: { trends: [] },
                      failing_tests: { tests: [] },
                    };
                  }
                  break;
                default:
                  return this.unknownResourceError(uri, request.id);
              }
            }
          }
          }
          }
        }
      }

      // Feature #846: Audit log successful resource read
      const dataStr = JSON.stringify(data, null, 2);
      this.sendAuditLog({
        method: 'resources/read',
        resource_uri: uri,
        response_type: 'success',
        response_data_preview: dataStr.length > 500 ? dataStr.slice(0, 500) + '...' : dataStr,
      });

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: dataStr,
            },
          ],
        },
      };
    } catch (error) {
      // Check for 404 errors and return proper MCP error
      const errorMessage = error instanceof Error ? error.message : 'Resource read failed';
      const is404 = errorMessage.includes('404') || errorMessage.includes('Not Found');

      // Extract resource type and ID from the URI for better error messages
      const projectMatch = uri?.match(/^qa-guardian:\/\/projects\/([^/]+)$/);
      const testRunMatch = uri?.match(/^qa-guardian:\/\/test-runs\/([^/]+)/);

      if (is404) {
        // Provide specific "not found" error with resource context
        if (projectMatch) {
          return this.resourceNotFoundError('Project', projectMatch[1], request.id);
        } else if (testRunMatch) {
          return this.resourceNotFoundError('Test run', testRunMatch[1], request.id);
        } else {
          // Generic 404
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32001, // Resource not found
              message: 'Resource not found',
              data: {
                requestedUri: uri,
                availablePatterns: MCPServer.RESOURCE_PATTERNS,
              },
            },
          };
        }
      }

      // Feature #846: Audit log failed resource read
      this.sendAuditLog({
        method: 'resources/read',
        resource_uri: uri,
        response_type: 'error',
        response_error_code: is404 ? -32001 : -32000,
        response_error_message: errorMessage,
      });

      // Non-404 error
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32000,
          message: errorMessage,
        },
      };
    }
  }

  // Handle ping request
  private handlePing(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {},
    };
  }

  // Feature #970: Generate insights from visual trend data
  // Feature #1356: Delegates to generateVisualTrendInsightsUtil from insights-utils.ts
  private generateVisualTrendInsights(
    totalTests: number,
    passedTests: number,
    testsWithDiffs: number,
    frequentDiffTests: Array<{ test_name: string; diff_rate: number }>
  ): string[] {
    return generateVisualTrendInsightsUtil({
      totalTests,
      passedTests,
      testsWithDiffs,
      frequentDiffTests,
    });
  }

  // Call QA Guardian API
  private async callApi(
    endpoint: string,
    options: { method?: string; body?: unknown } & Record<string, unknown> = {}
  ): Promise<unknown> {
    const apiUrl = this.config.apiUrl || 'http://localhost:3001';
    const url = new URL(endpoint, apiUrl);

    // Add query parameters for GET requests
    if (!options.method || options.method === 'GET') {
      Object.entries(options).forEach(([key, value]) => {
        if (key !== 'method' && key !== 'body' && value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Check for internal service token first (for container-to-container communication)
    const internalServiceToken = process.env.INTERNAL_SERVICE_TOKEN;
    if (internalServiceToken) {
      headers['X-Internal-Service-Token'] = internalServiceToken;
    } else if (this.config.apiKey) {
      // Check if apiKey looks like a JWT (starts with 'eyJ') - if so, use Bearer auth
      if (this.config.apiKey.startsWith('eyJ')) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      } else {
        headers['X-API-Key'] = this.config.apiKey;
      }
    }

    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers,
    };

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url.toString(), fetchOptions);

    if (!response.ok) {
      // Try to get the error body for more helpful error messages
      let errorDetail = '';
      let suggestion = '';
      try {
        const errorBody = await response.json() as { error?: string; message?: string };
        errorDetail = errorBody.message || errorBody.error || '';

        // Add helpful suggestions based on error type
        if (response.status === 404) {
          suggestion = ' Verify the ID exists and you have access to it.';
        } else if (response.status === 401) {
          suggestion = ' Check that your API key is valid and has the required scopes.';
        } else if (response.status === 403) {
          suggestion = ' Your API key may not have permission for this operation.';
        } else if (response.status === 400) {
          suggestion = ' Check that all required parameters are provided and valid.';
        }
      } catch {
        // Ignore JSON parse errors
      }

      const baseMessage = `API error: ${response.status} ${response.statusText}`;
      const fullMessage = errorDetail
        ? `${baseMessage} - ${errorDetail}${suggestion}`
        : `${baseMessage}${suggestion}`;

      throw new Error(fullMessage);
    }

    return response.json();
  }

  // Feature #958: Call QA Guardian API without authentication (for public endpoints)
  private async callApiPublic(endpoint: string): Promise<unknown> {
    const apiUrl = this.config.apiUrl || 'http://localhost:3001';
    const url = new URL(endpoint, apiUrl);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorDetail = '';
      try {
        const errorBody = await response.json() as { error?: string; message?: string };
        errorDetail = errorBody.message || errorBody.error || '';
      } catch {
        // Ignore JSON parse errors
      }
      throw new Error(`${response.status} ${response.statusText}${errorDetail ? ` - ${errorDetail}` : ''}`);
    }

    return response.json();
  }

  // Feature #846: Send audit log entry to backend
  private async sendAuditLog(entry: {
    method: string;
    tool_name?: string;
    resource_uri?: string;
    request_params?: Record<string, unknown>;
    response_type: 'success' | 'error';
    response_error_code?: number;
    response_error_message?: string;
    response_data_preview?: string;
    duration_ms?: number;
    // Feature #854: Streaming fields
    streaming?: boolean;
    stream_id?: string;
  }): Promise<void> {
    // Don't log if no API key configured
    if (!this.config.apiKey) {
      return;
    }

    try {
      const apiUrl = this.config.apiUrl || 'http://localhost:3001';
      await fetch(`${apiUrl}/api/v1/mcp/audit-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.config.apiKey,
          connection_id: this.connectionId,
          client_name: this.clientInfo?.name,
          client_version: this.clientInfo?.version,
          ...entry,
        }),
      });
    } catch (error) {
      // Don't fail the main request if audit logging fails
      this.log(`[AUDIT] Failed to send audit log: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Send JSON-RPC response to stdout
  private sendResponse(response: MCPResponse): void {
    console.log(JSON.stringify(response));
  }

  // Log to stderr (so it doesn't interfere with JSON-RPC on stdout)
  private log(message: string): void {
    console.error(`[QA Guardian MCP] ${message}`);
  }
}

// Load configuration from JSON file
function loadConfigFile(configPath: string): Partial<ServerConfig> {
  try {
    const absolutePath = path.isAbsolute(configPath)
      ? configPath
      : path.resolve(process.cwd(), configPath);

    const content = fs.readFileSync(absolutePath, 'utf-8');
    const fileConfig = JSON.parse(content);

    const config: Partial<ServerConfig> = {};

    if (fileConfig.transport === 'stdio' || fileConfig.transport === 'sse') {
      config.transport = fileConfig.transport;
    }
    if (typeof fileConfig.port === 'number') {
      config.port = fileConfig.port;
    }
    if (typeof fileConfig.host === 'string') {
      config.host = fileConfig.host;
    }
    if (typeof fileConfig.apiUrl === 'string') {
      config.apiUrl = fileConfig.apiUrl;
    }
    if (typeof fileConfig.apiKey === 'string') {
      config.apiKey = fileConfig.apiKey;
    }
    if (typeof fileConfig.requireAuth === 'boolean') {
      config.requireAuth = fileConfig.requireAuth;
    }
    if (typeof fileConfig.rateLimit === 'number') {
      config.rateLimit = fileConfig.rateLimit;
    }
    if (typeof fileConfig.rateLimitWindow === 'number') {
      config.rateLimitWindow = fileConfig.rateLimitWindow;
    }

    // Feature #854: Streaming configuration from config file
    if (typeof fileConfig.enableStreaming === 'boolean') {
      config.enableStreaming = fileConfig.enableStreaming;
    }
    if (typeof fileConfig.streamChunkSize === 'number') {
      config.streamChunkSize = fileConfig.streamChunkSize;
    }
    if (typeof fileConfig.streamThreshold === 'number') {
      config.streamThreshold = fileConfig.streamThreshold;
    }

    // Feature #855: Webhook callback configuration from config file
    if (typeof fileConfig.enableWebhookCallbacks === 'boolean') {
      config.enableWebhookCallbacks = fileConfig.enableWebhookCallbacks;
    }
    if (fileConfig.webhookCallback && typeof fileConfig.webhookCallback === 'object') {
      const webhook = fileConfig.webhookCallback as Record<string, unknown>;
      if (typeof webhook.url === 'string') {
        try {
          new URL(webhook.url);
          config.webhookCallback = {
            url: webhook.url,
            method: (webhook.method as 'POST' | 'PUT') || 'POST',
            headers: webhook.headers as Record<string, string>,
            includeRequestParams: webhook.includeRequestParams as boolean,
            retries: webhook.retries as number,
            timeout: webhook.timeout as number,
            secret: webhook.secret as string,
          };
        } catch {
          console.error('[QA Guardian MCP] Invalid webhook callback URL in config');
        }
      }
    }

    console.error(`[QA Guardian MCP] Loaded config from: ${absolutePath}`);
    return config;
  } catch (error) {
    console.error(`[QA Guardian MCP] Error loading config file: ${error instanceof Error ? error.message : error}`);
    return {};
  }
}

// Parse command line arguments
function parseArgs(): ServerConfig {
  const args = process.argv.slice(2);
  const config: ServerConfig = {
    transport: 'stdio',
  };

  // First pass: look for config file
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' || args[i] === '-c') {
      const configPath = args[i + 1];
      if (configPath) {
        const fileConfig = loadConfigFile(configPath);
        Object.assign(config, fileConfig);
      }
      break;
    }
  }

  // Second pass: command line args override config file
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--config' || arg === '-c') {
      i++; // Skip config file path
    } else if (arg === '--transport' || arg === '-t') {
      const value = args[++i];
      if (value === 'stdio' || value === 'sse') {
        config.transport = value;
      }
    } else if (arg === '--port' || arg === '-p') {
      config.port = parseInt(args[++i], 10);
    } else if (arg === '--host' || arg === '-H') {
      config.host = args[++i];
    } else if (arg === '--api-url' || arg === '-u') {
      config.apiUrl = args[++i];
    } else if (arg === '--api-key' || arg === '-k') {
      config.apiKey = args[++i];
    } else if (arg === '--require-auth' || arg === '-a') {
      config.requireAuth = true;
    } else if (arg === '--rate-limit' || arg === '-r') {
      config.rateLimit = parseInt(args[++i], 10);
    } else if (arg === '--rate-limit-window' || arg === '-w') {
      config.rateLimitWindow = parseInt(args[++i], 10);
    } else if (arg === '--tool-timeout' || arg === '-T') {
      config.toolTimeout = parseInt(args[++i], 10);
    } else if (arg === '--enable-streaming') {
      config.enableStreaming = true;
    } else if (arg === '--disable-streaming') {
      config.enableStreaming = false;
    } else if (arg === '--stream-chunk-size') {
      config.streamChunkSize = parseInt(args[++i], 10);
    } else if (arg === '--stream-threshold') {
      config.streamThreshold = parseInt(args[++i], 10);
    } else if (arg === '--webhook-callback') {
      const url = args[++i];
      try {
        new URL(url);
        config.webhookCallback = { url };
      } catch {
        console.error(`[QA Guardian MCP] Invalid webhook callback URL: ${url}`);
      }
    } else if (arg === '--enable-webhook-callbacks') {
      config.enableWebhookCallbacks = true;
    } else if (arg === '--disable-webhook-callbacks') {
      config.enableWebhookCallbacks = false;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
QA Guardian MCP Server

Usage: qa-guardian-mcp [options]

Options:
  -c, --config <file>     Path to JSON config file
  -t, --transport <type>  Transport type: stdio (default) or sse
  -p, --port <port>       Port for SSE transport (default: 3000)
  -H, --host <host>       Host for SSE transport (default: 0.0.0.0)
  -u, --api-url <url>     QA Guardian API URL (default: http://localhost:3001)
  -k, --api-key <key>     API key for authentication
  -a, --require-auth      Require API key for tool calls and resource reads
  -r, --rate-limit <n>    Max requests per window (default: 100)
  -w, --rate-limit-window <s>  Rate limit window in seconds (default: 60)
  -T, --tool-timeout <ms>  Tool execution timeout in milliseconds (default: 30000)
  --enable-streaming       Enable response streaming for large results (default: true)
  --disable-streaming      Disable response streaming
  --stream-chunk-size <n>  Items per streaming chunk (default: 10)
  --stream-threshold <n>   Min items to trigger streaming (default: 20)
  --webhook-callback <url> Global webhook callback URL for operation completion
  --enable-webhook-callbacks   Enable per-request webhook callbacks (default: true)
  --disable-webhook-callbacks  Disable per-request webhook callbacks
  -h, --help              Show this help message

Config File Format (mcp-config.json):
  {
    "transport": "stdio",
    "apiUrl": "http://localhost:3001",
    "apiKey": "your-api-key",
    "port": 3000,
    "host": "0.0.0.0",
    "requireAuth": true,
    "rateLimit": 100,
    "rateLimitWindow": 60,
    "toolTimeout": 30000,
    "enableStreaming": true,
    "streamChunkSize": 10,
    "streamThreshold": 20,
    "enableWebhookCallbacks": true,
    "webhookCallback": {
      "url": "https://example.com/webhook",
      "method": "POST",
      "headers": { "Authorization": "Bearer token" },
      "includeRequestParams": true,
      "retries": 3,
      "timeout": 10000,
      "secret": "your-hmac-secret"
    }
  }

Examples:
  # Start with stdio transport (default)
  qa-guardian-mcp

  # Start with config file
  qa-guardian-mcp --config mcp-config.json

  # Start with SSE transport on port 3000
  qa-guardian-mcp --transport sse --port 3000

  # Connect to custom API URL
  qa-guardian-mcp --api-url http://localhost:3001

  # Require API key authentication
  qa-guardian-mcp --require-auth --api-key your-api-key

  # Set custom rate limit (50 requests per 30 seconds)
  qa-guardian-mcp --rate-limit 50 --rate-limit-window 30

  # Set tool execution timeout (60 seconds for long-running operations)
  qa-guardian-mcp --tool-timeout 60000

  # Configure streaming for large results
  qa-guardian-mcp --stream-chunk-size 25 --stream-threshold 50

  # Enable webhook callbacks for all operations
  qa-guardian-mcp --webhook-callback https://example.com/webhook
      `);
      process.exit(0);
    }
  }

  return config;
}

// Export for testing
export { loadConfigFile };

// Main entry point
async function main(): Promise<void> {
  const config = parseArgs();
  const server = new MCPServer(config);

  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Export for programmatic use
export { MCPServer, ServerConfig };

// Run if executed directly
if (require.main === module) {
  main();
}
