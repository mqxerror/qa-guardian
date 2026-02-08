/**
 * QA Guardian MCP Server
 *
 * Model Context Protocol (MCP) server for QA Guardian integration with Claude Code.
 * Supports stdio transport for local use and SSE transport for remote use.
 *
 * Feature #1356/#252: Refactored into modular architecture.
 * See extracted modules: mcp-types, mcp-cli, mcp-auth, mcp-validation,
 * mcp-streaming, mcp-batch, mcp-workflow, mcp-transport-sse, etc.
 *
 * @module server
 */

import * as readline from 'readline';
import * as http from 'http';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

// Feature #1356: Import types from extracted module
import {
  MCPRequest,
  MCPResponse,
  MCPNotification,
  ServerConfig,
  StreamMetadata,
  StreamChunkNotification,
  IdempotencyEntry,
  SSEClient,
  MCP_PROTOCOL_VERSION,
  SSE_PING_INTERVAL,
  SSE_CONNECTION_TIMEOUT,
  AlertSubscription,
  Workflow,
  WorkflowSchedule,
} from './mcp-types.js';

// Feature #1356: Import tool and resource definitions from extracted modules
import { TOOLS } from './tool-definitions.js';
import { RESOURCES } from './resource-definitions.js';

// Feature #1356: Import handler registry for extracted tool handlers
import { hasHandler, executeHandler, HandlerContext } from './handlers/index.js';

// Feature #1356: Import tool permissions from extracted module
import { TOOL_SCOPE_MAP } from './tool-permissions.js';

// Feature #1356: Import string utilities from extracted module
import { findSimilarStrings } from './string-utils.js';

// Feature #1356: Import hash utilities from extracted module
import { generateRequestHash } from './hash-utils.js';

// Feature #1356: Import insights utilities from extracted module
import { generateVisualTrendInsights as generateVisualTrendInsightsUtil } from './insights-utils.js';

// Feature #1356: Import API versioning from extracted module
import {
  API_VERSIONS,
  DEFAULT_API_VERSION,
  CURRENT_API_VERSION,
  parseApiVersion,
  addVersionWarnings,
} from './api-versioning.js';

// Feature #1356: Import webhook callback utilities from extracted module
import {
  WebhookCallbackConfig,
  WebhookCallbackPayload,
  sendWebhookCallback,
  parseWebhookCallback,
  createSuccessPayload,
  createErrorPayload,
} from './webhook-callbacks.js';

// Feature #252: Import extracted modules for code size reduction
import { RateLimiter, createDefaultRateLimitConfig } from './mcp-rate-limiter.js';
import { SSEClientManager, parseJsonWithDetails, buildJsonParseErrorMessage } from './mcp-sse-manager.js';
import { ConcurrencyManager, PRIORITY_LOW, PRIORITY_NORMAL, PRIORITY_HIGH } from './mcp-concurrency.js';
import { IdempotencyCache } from './mcp-idempotency.js';
import { OperationsTracker, executeWithTimeout } from './mcp-operations.js';
import { ApiClient, createApiClient } from './mcp-api-client.js';
import { StreamingManager, createStreamingManager, StreamingConfig } from './mcp-streaming.js';
import {
  handleResourcesRead as handleResourcesReadImpl,
  RESOURCE_PATTERNS,
  validateResourceUri,
  resourceNotFoundError,
  unknownResourceError,
  ResourceHandlerContext,
} from './mcp-resources.js';
import {
  checkAuth as checkAuthImpl,
  validateMcpScope as validateMcpScopeImpl,
  isKnownTool as isKnownToolImpl,
  hasToolPermission as hasToolPermissionImpl,
  toolPermissionDeniedError as toolPermissionDeniedErrorImpl,
  unknownToolError as unknownToolErrorImpl,
} from './mcp-auth.js';
import {
  validateRequiredParams as validateRequiredParamsImpl,
  validateParamTypes as validateParamTypesImpl,
} from './mcp-validation.js';
import { AuditLogger, createAuditLogger, AuditLogEntry } from './mcp-audit.js';
import { handleToolsCallBatch as handleToolsCallBatchImpl, BatchContext } from './mcp-batch.js';
import { executeWorkflowStep as executeWorkflowStepImpl, WorkflowContext } from './mcp-workflow.js';
import {
  handleSSEConnection as handleSSEConnectionImpl,
  handleSSEMessage as handleSSEMessageImpl,
  sendSSEEvent as sendSSEEventImpl,
  sendSSEEventWithId as sendSSEEventWithIdImpl,
  SSETransportContext,
} from './mcp-transport-sse.js';

// Server info
const SERVER_INFO = {
  name: 'qa-guardian-mcp-server',
  version: '2.0.0',
  apiVersion: CURRENT_API_VERSION,
};

class MCPServer {
  private config: ServerConfig;
  private initialized = false;
  private rl: readline.Interface | null = null;
  private httpServer: http.Server | null = null;

  // Feature #252: Use extracted module instances
  private sseClientManager: SSEClientManager;
  private rateLimiter: RateLimiter;
  private concurrencyManager: ConcurrencyManager;
  private idempotencyManager: IdempotencyCache;
  private operationsTracker: OperationsTracker;
  private apiClient: ApiClient;
  private streamingManager: StreamingManager;
  private auditLogger: AuditLogger;

  // Legacy compatibility - SSE clients (delegates to sseClientManager)
  private get sseClients(): Map<string, SSEClient> {
    // Create a compatibility wrapper that delegates to SSEClientManager
    const compatMap = new Map<string, SSEClient>();
    for (const [id, client] of this.sseClientManager.getAllClients()) {
      compatMap.set(id, client);
    }
    return compatMap;
  }

  // Feature #849: Tool execution timeout
  private toolTimeout = 30000; // Default 30 seconds for tool execution

  // Feature #854: Response streaming configuration
  private enableStreaming = true; // Enable streaming by default
  private streamChunkSize = 10; // Number of items per chunk
  private streamThreshold = 20; // Minimum items to trigger streaming
  private activeStreams: Map<string, StreamMetadata> = new Map();

  // Feature #1217: Alert subscription tracking (types in mcp-types.ts)
  private alertSubscriptions: Map<string, AlertSubscription> = new Map();

  // Feature #1219: Workflow storage (types in mcp-types.ts)
  private workflows: Map<string, Workflow> = new Map();

  // Feature #1221: Workflow schedules storage (types in mcp-types.ts)
  private workflowSchedules: Map<string, WorkflowSchedule> = new Map();

  // Feature #857: Idempotency cache
  private idempotencyCache: Map<string, IdempotencyEntry> = new Map();
  private idempotencyTTL = 3600000; // 1 hour default TTL for idempotency keys
  private idempotencyCleanupInterval: NodeJS.Timeout | null = null;

  // Graceful shutdown state
  private isShuttingDown = false;
  private shutdownTimeout = 10000; // 10 seconds max wait for in-progress operations

  // Feature #846: Audit logging - track connection info
  private connectionId?: string;
  private clientInfo?: { name: string; version: string };

  // Feature #858: API versioning
  private requestApiVersion: string = DEFAULT_API_VERSION;
  private defaultApiVersion: string = DEFAULT_API_VERSION;

  constructor(config: ServerConfig) {
    this.config = config;

    // Feature #252: Initialize extracted modules
    const logFn = (msg: string) => this.log(msg);

    // Initialize rate limiter
    const rateLimitConfig = createDefaultRateLimitConfig(
      config.rateLimit || 100,
      config.rateLimitWindow || 60,
      20, // burst limit
      10  // burst window seconds
    );
    this.rateLimiter = new RateLimiter(rateLimitConfig, logFn);

    // Initialize SSE client manager
    this.sseClientManager = new SSEClientManager(logFn);

    // Initialize concurrency manager
    this.concurrencyManager = new ConcurrencyManager(
      config.maxConcurrent || 5,
      30000, // queue timeout
      logFn
    );

    // Initialize idempotency cache
    this.idempotencyManager = new IdempotencyCache(3600000, logFn); // 1 hour TTL

    // Initialize operations tracker
    this.operationsTracker = new OperationsTracker(logFn);

    // Feature #252: Initialize API client
    this.apiClient = createApiClient({
      apiUrl: config.apiUrl || 'http://localhost:3001',
      apiKey: config.apiKey,
    }, logFn);

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

    // Feature #252: Initialize streaming manager
    this.streamingManager = createStreamingManager({
      config: {
        enableStreaming: this.enableStreaming,
        streamChunkSize: this.streamChunkSize,
        streamThreshold: this.streamThreshold,
      },
      log: logFn,
      sendNotification: (notification) => this.sendStreamNotification(notification),
    });

    // Feature #858: Configure API versioning
    if (config.defaultApiVersion && API_VERSIONS[config.defaultApiVersion]) {
      this.defaultApiVersion = config.defaultApiVersion;
    }

    // Feature #252: Initialize audit logger
    this.auditLogger = createAuditLogger({
      apiUrl: config.apiUrl || 'http://localhost:3001',
      apiKey: config.apiKey,
    }, logFn);
  }

  // Feature #851: Parse priority from request params (delegates to concurrency manager)
  private parsePriority(params?: Record<string, unknown>): number {
    return this.concurrencyManager.parsePriority(params);
  }

  // Feature #858: Parse API version from request params (delegates to extracted module)
  private parseApiVersionFromParams(params?: Record<string, unknown>): string {
    return parseApiVersion(params, this.defaultApiVersion, (msg) => this.log(msg));
  }

  // Feature #858: Add version warnings (delegates to extracted module)
  private addApiVersionWarnings(response: MCPResponse, version: string): MCPResponse {
    return addVersionWarnings(response, version, (msg) => this.log(msg));
  }

  // Feature #854: Check if result should be streamed (delegates to streaming manager)
  private shouldStreamResult(result: unknown, forceStream?: boolean): boolean {
    return this.streamingManager.shouldStreamResult(result, forceStream);
  }

  // Feature #854: Extract streamable array from result (delegates to streaming manager)
  private extractStreamableArray(result: unknown): { array: unknown[]; wrapper?: Record<string, unknown>; arrayKey?: string } {
    return this.streamingManager.extractStreamableArray(result);
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

  // Feature #854: Stream large result set (delegates to streaming manager)
  private async streamResult(
    result: unknown,
    requestId: string | number | undefined,
    toolName: string
  ): Promise<MCPResponse> {
    return this.streamingManager.streamResult(result, requestId, toolName);
  }

  // Feature #854: Get active stream info (delegates to streaming manager)
  getActiveStreams(): Map<string, StreamMetadata> {
    return this.streamingManager.getActiveStreams();
  }

  // Feature #857/#252: Idempotency methods - delegate to extracted module
  private startIdempotencyCleanup(): void {
    this.idempotencyManager.startCleanup(300000); // 5 minutes
  }

  private stopIdempotencyCleanup(): void {
    this.idempotencyManager.stopCleanup();
  }

  private checkIdempotency(key: string, toolName: string, requestHash: string): IdempotencyEntry | null {
    return this.idempotencyManager.check(key, toolName, requestHash);
  }

  private storeIdempotencyResponse(key: string, toolName: string, requestHash: string, response: MCPResponse, ttlMs?: number): void {
    this.idempotencyManager.store(key, toolName, requestHash, response, ttlMs);
  }

  private parseIdempotencyKey(args?: Record<string, unknown>): string | undefined {
    return this.idempotencyManager.parseKey(args);
  }

  getIdempotencyCacheStats(): { size: number; entries: Array<{ key: string; toolName: string; expiresIn: number }> } {
    return this.idempotencyManager.getStats();
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

  // Feature #851/#252: Concurrent request methods - delegate to extracted module
  private async acquireConcurrentSlot(
    apiKey: string,
    priority: number = PRIORITY_NORMAL
  ): Promise<{ acquired: boolean; queued: boolean; position?: number; priority: number }> {
    return this.concurrencyManager.acquireSlot(apiKey, priority);
  }

  private releaseConcurrentSlot(apiKey: string): void {
    this.concurrencyManager.releaseSlot(apiKey);
  }

  private getConcurrentStats(apiKey: string): { active: number; queued: number; maxConcurrent: number } {
    return this.concurrencyManager.getStats(apiKey);
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
      const parseResult = parseJsonWithDetails<MCPRequest>(line);
      if (!parseResult.success) {
        const err = parseResult.error!;
        this.log(`[ERROR] Malformed JSON request: ${err.message}`);
        this.sendResponse({
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: buildJsonParseErrorMessage(err),
            data: { originalError: err.message, position: err.position, line: err.line, column: err.column },
          },
        });
        return;
      }
      const response = await this.handleRequest(parseResult.data);
      if (response) {
        this.sendResponse(response);
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

    // Phase 1: Notify all connected clients about server shutdown (using extracted module)
    this.sseClientManager.notifyShutdown(this.operationsTracker.count);

    // For stdio transport, send shutdown notification to stdout
    if (this.config.transport === 'stdio') {
      const shutdownNotification: MCPNotification = {
        jsonrpc: '2.0',
        method: 'notifications/server-shutdown',
        params: {
          timestamp: Date.now(),
          reason: 'Server is shutting down for maintenance or restart',
          inProgressOperations: this.operationsTracker.count,
        },
      };
      this.sendResponse(shutdownNotification as unknown as MCPResponse);
    }

    // Phase 2: Wait for in-progress operations to complete (with timeout)
    if (this.operationsTracker.count > 0) {
      this.log(`Waiting for ${this.operationsTracker.count} in-progress operation(s) to complete...`);
      const completed = await this.operationsTracker.waitForCompletion(this.shutdownTimeout);
      if (!completed) {
        this.log(`Aborting ${this.operationsTracker.count} remaining operation(s) after timeout`);
        this.operationsTracker.abortAll();
      } else {
        this.log('All in-progress operations completed cleanly');
      }
    }

    // Phase 3: Close readline interface for stdio transport
    if (this.rl) {
      this.rl.close();
      this.log('Closed readline interface');
    }

    // Phase 4: Close all SSE client connections (using extracted module)
    this.sseClientManager.closeAll();

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

  // Feature #252: Operations tracking methods - delegate to extracted module
  private trackOperationStart(operationId: string, method: string, requestId?: string | number): AbortController {
    return this.operationsTracker.trackStart(operationId, method, requestId);
  }

  private trackOperationComplete(operationId: string): void {
    this.operationsTracker.trackComplete(operationId);
  }

  // Get count of in-progress operations (delegates to extracted module)
  getInProgressCount(): number {
    return this.operationsTracker.count;
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

  // Handle SSE connection (delegates to mcp-transport-sse.ts)
  private handleSSEConnection(req: http.IncomingMessage, res: http.ServerResponse): void {
    const context: SSETransportContext = {
      log: this.log.bind(this),
      handleRequest: this.handleRequest.bind(this),
      serverInfo: SERVER_INFO,
      getSseClients: () => this.sseClients,
    };
    handleSSEConnectionImpl(req, res, context);
  }

  // Send SSE event with event ID for reconnection tracking (delegates to mcp-transport-sse.ts)
  private sendSSEEventWithId(client: SSEClient, event: string, data: string, eventId: string): void {
    sendSSEEventWithIdImpl(client, event, data, eventId, this.log.bind(this));
  }

  // Handle incoming message on SSE transport (delegates to mcp-transport-sse.ts)
  private handleSSEMessage(req: http.IncomingMessage, res: http.ServerResponse): void {
    const context: SSETransportContext = {
      log: this.log.bind(this),
      handleRequest: this.handleRequest.bind(this),
      serverInfo: SERVER_INFO,
      getSseClients: () => this.sseClients,
    };
    handleSSEMessageImpl(req, res, context);
  }

  // Send SSE event to client (delegates to mcp-transport-sse.ts)
  private sendSSEEvent(client: SSEClient, event: string, data: string): void {
    sendSSEEventImpl(client, event, data, this.log.bind(this));
  }

  // Check if authentication is required and valid
  // Feature #252: Auth methods delegated to mcp-auth.ts
  private checkAuth(): { valid: boolean; error?: MCPResponse } {
    return checkAuthImpl({
      requireAuth: this.config.requireAuth ?? false,
      apiKey: this.config.apiKey,
      apiUrl: this.config.apiUrl,
    });
  }

  // Validate API key has MCP scope via backend API (delegates to mcp-auth.ts)
  private async validateMcpScope(): Promise<{ valid: boolean; error?: MCPResponse; scopes?: string[] }> {
    return validateMcpScopeImpl(
      {
        requireAuth: this.config.requireAuth ?? false,
        apiKey: this.config.apiKey,
        apiUrl: this.config.apiUrl,
      },
      (msg) => this.log(msg),
      this.rateLimiter
    );
  }

  // Check if a tool exists (delegates to mcp-auth.ts)
  private isKnownTool(toolName: string): boolean {
    return isKnownToolImpl(toolName);
  }

  // Check if the validated scopes allow a specific tool action (delegates to mcp-auth.ts)
  private hasToolPermission(toolName: string): boolean {
    return hasToolPermissionImpl(toolName, this.validatedScopes);
  }

  // Generate permission denied error for a tool (delegates to mcp-auth.ts)
  private toolPermissionDeniedError(toolName: string, requestId?: string | number): MCPResponse {
    return toolPermissionDeniedErrorImpl(toolName, this.validatedScopes, requestId, (msg) => this.log(msg));
  }

  // Generate unknown tool error with suggestions (delegates to mcp-auth.ts)
  private unknownToolError(toolName: string, requestId?: string | number): MCPResponse {
    return unknownToolErrorImpl(toolName, requestId, (msg) => this.log(msg));
  }

  // Cache for MCP scope validation (to avoid repeated API calls)
  private mcpScopeValidated = false;
  private mcpScopeError: MCPResponse | null = null;
  private validatedScopes: string[] = [];

  // Feature #1356: Tool scope requirements are now imported from ./tool-permissions.ts
  // See TOOL_SCOPE_MAP in tool-permissions.ts for the full mapping

  // Feature #252: Rate limiting methods - delegate to extracted module
  private checkRateLimit(): {
    allowed: boolean;
    error?: MCPResponse;
    remaining: number;
    resetMs: number;
    headers: { 'X-RateLimit-Limit': number; 'X-RateLimit-Remaining': number; 'X-RateLimit-Reset': number; 'X-RateLimit-Burst-Limit': number; 'X-RateLimit-Burst-Remaining': number };
  } {
    return this.rateLimiter.checkRateLimit(this.config.apiKey);
  }

  private getRateLimitStatus(): { remaining: number; limit: number; resetMs: number; burstLimit: number; burstRemaining: number } {
    return this.rateLimiter.getRateLimitStatus(this.config.apiKey);
  }

  // Feature #1356: findSimilarTools and levenshteinDistance moved to ./string-utils.ts
  // Feature #1356: calculateNextCronRun and describeCronExpression moved to ./cron-utils.ts

  // Feature #1220: Execute a single workflow step by calling the appropriate API (delegates to mcp-workflow.ts)
  private async executeWorkflowStep(tool: string, args: Record<string, unknown>): Promise<unknown> {
    const context: WorkflowContext = {
      callApi: this.callApi.bind(this),
      log: this.log.bind(this),
    };
    return executeWorkflowStepImpl(tool, args, context);
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
            inProgressOperations: this.operationsTracker.count,
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

  // Validate required parameters for a tool (delegates to mcp-validation.ts)
  private validateRequiredParams(toolName: string, toolArgs: Record<string, unknown>): { valid: boolean; error?: MCPResponse } {
    return validateRequiredParamsImpl(toolName, toolArgs, (msg) => this.log(msg));
  }

  // Validate parameter types for a tool (delegates to mcp-validation.ts)
  private validateParamTypes(toolName: string, toolArgs: Record<string, unknown>): { valid: boolean; error?: MCPResponse } {
    return validateParamTypesImpl(toolName, toolArgs, (msg) => this.log(msg));
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
          message: `Too many concurrent requests. Maximum ${this.concurrencyManager.maxConcurrent} allowed. Request was queued but timed out.`,
          data: {
            maxConcurrent: this.concurrencyManager.maxConcurrent,
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

      // Execute tool with timeout (using extracted module function)
      const executionResult = await executeWithTimeout(
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

  // Feature #856: Handle batch tool calls (delegates to mcp-batch.ts)
  private async handleToolsCallBatch(request: MCPRequest): Promise<MCPResponse> {
    const context: BatchContext = {
      handleToolsCall: this.handleToolsCall.bind(this),
      isKnownTool: this.isKnownTool.bind(this),
      hasToolPermission: this.hasToolPermission.bind(this),
      log: this.log.bind(this),
      addApiVersionWarnings: this.addApiVersionWarnings.bind(this),
      requestApiVersion: this.requestApiVersion,
    };
    return handleToolsCallBatchImpl(request, context);
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

  // Feature #252: Resource patterns now imported from mcp-resources.ts
  private static readonly RESOURCE_PATTERNS = RESOURCE_PATTERNS;

  // Handle resources/read request (delegates to mcp-resources.ts)
  private async handleResourcesRead(request: MCPRequest): Promise<MCPResponse> {
    const context: ResourceHandlerContext = {
      callApi: this.callApi.bind(this),
      log: this.log.bind(this),
      sendAuditLog: this.sendAuditLog.bind(this),
    };
    return handleResourcesReadImpl(request, context);
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

  // Call QA Guardian API (delegates to mcp-api-client.ts)
  private async callApi(
    endpoint: string,
    options: { method?: string; body?: unknown } & Record<string, unknown> = {}
  ): Promise<unknown> {
    return this.apiClient.callApi(endpoint, options);
  }

  // Feature #958: Call QA Guardian API without authentication (delegates to mcp-api-client.ts)
  private async callApiPublic(endpoint: string): Promise<unknown> {
    return this.apiClient.callApiPublic(endpoint);
  }

  // Feature #846: Send audit log entry to backend (delegates to mcp-audit.ts)
  private async sendAuditLog(entry: AuditLogEntry): Promise<void> {
    // Update connection info before sending
    if (this.connectionId) {
      this.auditLogger.updateConnectionInfo(
        this.connectionId,
        this.clientInfo?.name,
        this.clientInfo?.version
      );
    }
    return this.auditLogger.sendAuditLog(entry);
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

// ============================================================================
// Exports
// ============================================================================

// Export MCPServer class for programmatic use
export { MCPServer };

// Re-export types from mcp-types.ts
export type { ServerConfig } from './mcp-types.js';

// Re-export CLI functions from mcp-cli.ts for backward compatibility
export { loadConfigFile, parseArgs, main } from './mcp-cli.js';

// Run if executed directly - delegates to mcp-cli.ts
// Note: For direct execution, use mcp-cli.ts instead
// Feature #431: Updated for ES module compatibility with Claude Code MCP integration
const isServerMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isServerMainModule) {
  import('./mcp-cli.js').then(cli => cli.main());
}
