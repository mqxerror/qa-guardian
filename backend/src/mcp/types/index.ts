/**
 * MCP Server Types and Interfaces
 *
 * This file contains all the shared types used across the MCP server modules.
 */

import * as http from 'http';

// MCP Protocol version
export const MCP_PROTOCOL_VERSION = '2024-11-05';

// Feature #858: API versioning support
export type APIVersionStatus = 'current' | 'deprecated' | 'sunset';

export interface APIVersionInfo {
  version: string;
  status: APIVersionStatus;
  deprecationDate?: string;
  sunsetDate?: string;
  deprecationMessage?: string;
}

// API version definitions
export const API_VERSIONS: Record<string, APIVersionInfo> = {
  'v1': {
    version: 'v1',
    status: 'deprecated',
    deprecationDate: '2025-06-01',
    sunsetDate: '2026-06-01',
    deprecationMessage: 'API v1 is deprecated and will be removed on 2026-06-01. Please migrate to v2.',
  },
  'v2': {
    version: 'v2',
    status: 'current',
  },
};

// Default API version if not specified
export const DEFAULT_API_VERSION = 'v2';

// Current API version
export const CURRENT_API_VERSION = 'v2';

// Server info
export const SERVER_INFO = {
  name: 'qa-guardian-mcp-server',
  version: '2.0.0',
  apiVersion: CURRENT_API_VERSION,
};

// Transport type
export type TransportType = 'stdio' | 'sse';

// MCP Protocol types
export interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

// Tool definition type
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

// Resource definition type
export interface ResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

// Feature #854: Streaming response metadata
export interface StreamMetadata {
  streamId: string;
  requestId: string | number | undefined;
  toolName: string;
  totalChunks: number;
  totalItems: number;
  startedAt: number;
  completedAt?: number;
}

// Feature #854: Streaming chunk notification
export interface StreamChunkNotification {
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

// Feature #855: Webhook callback configuration
export interface WebhookCallbackConfig {
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  includeRequestParams?: boolean;
  retries?: number;
  timeout?: number;
  secret?: string;
}

// Feature #855: Webhook callback payload
export interface WebhookCallbackPayload {
  timestamp: number;
  requestId: string | number | undefined;
  toolName: string;
  status: 'success' | 'error';
  duration_ms: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
  requestParams?: Record<string, unknown>;
  streaming?: {
    streamId: string;
    totalItems: number;
    totalChunks: number;
  };
  signature?: string;
}

// Feature #856: Batch operation types
export interface BatchOperationItem {
  id: string | number;
  name: string;
  arguments?: Record<string, unknown>;
}

export interface BatchOperationResult {
  id: string | number;
  status: 'success' | 'error';
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
  duration_ms: number;
}

export interface BatchResponse {
  batchId: string;
  totalOperations: number;
  succeeded: number;
  failed: number;
  results: BatchOperationResult[];
  duration_ms: number;
}

// Feature #857: Idempotency key entry
export interface IdempotencyEntry {
  key: string;
  response: MCPResponse;
  createdAt: number;
  expiresAt: number;
  toolName: string;
  requestHash: string;
}

// Rate limiting types
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  burstLimit: number;
  burstWindowMs: number;
}

export interface RateLimitEntry {
  timestamps: number[];
  burstTimestamps: number[];
}

export interface PerKeyRateLimitConfig {
  max_requests: number;
  window_seconds: number;
  burst_limit: number;
  burst_window_seconds: number;
}

// SSE Client connection
export interface SSEClient {
  id: string;
  response: http.ServerResponse;
  initialized: boolean;
  connectedAt: number;
  lastPingAt: number;
  eventBuffer: Array<{ event: string; data: string; timestamp: number }>;
  disconnectedAt?: number;
}

// SSE Connection timeout settings
export const SSE_PING_INTERVAL = 15000;
export const SSE_CONNECTION_TIMEOUT = 60000;
export const SSE_EVENT_BUFFER_MAX = 100;
export const SSE_EVENT_BUFFER_TTL = 300000;

// Server configuration
export interface ServerConfig {
  transport: TransportType;
  apiUrl?: string;
  apiKey?: string;
  port?: number;
  host?: string;
  requireAuth?: boolean;
  rateLimit?: number;
  rateLimitWindow?: number;
  maxConcurrent?: number;
  toolTimeout?: number;
  enableStreaming?: boolean;
  streamChunkSize?: number;
  streamThreshold?: number;
  webhookCallback?: WebhookCallbackConfig;
  enableWebhookCallbacks?: boolean;
  defaultApiVersion?: string;
}

// Priority levels
export const PRIORITY_LOW = 1;
export const PRIORITY_NORMAL = 5;
export const PRIORITY_HIGH = 10;

// Concurrent request tracking
export interface ConcurrentRequestEntry {
  active: number;
  queue: Array<{
    resolve: (value: boolean) => void;
    timestamp: number;
    priority: number;
  }>;
}

// Alert subscription type
export interface AlertSubscription {
  type: 'run_completed' | 'run_failed' | 'threshold_breach' | 'suite_completed';
  filters?: Record<string, unknown>;
  createdAt: number;
}

// Workflow types
export interface WorkflowStep {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  condition?: string;
  onSuccess?: string;
  onFailure?: string;
}

export interface Workflow {
  name: string;
  description: string;
  steps: WorkflowStep[];
  createdAt: number;
  updatedAt: number;
  lastRunId?: string;
  lastRunStatus?: string;
  lastRunAt?: number;
}

export interface WorkflowSchedule {
  workflowId: string;
  cron: string;
  timezone: string;
  enabled: boolean;
  nextRun: Date;
  createdAt: number;
  lastRun?: number;
  lastRunStatus?: string;
}

// Operation tracking for graceful shutdown
export interface InProgressOperation {
  method: string;
  startedAt: number;
  requestId?: string | number;
  abortController: AbortController;
}
