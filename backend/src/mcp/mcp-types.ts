/**
 * MCP Server Types Module
 *
 * Type definitions for the MCP server, including protocol types, configuration,
 * and internal data structures.
 *
 * Feature #1356: Extracted from server.ts to reduce file size
 *
 * @module mcp-types
 */

import * as http from 'http';
import { WebhookCallbackConfig } from './webhook-callbacks.js';

// ============================================================================
// Transport Types
// ============================================================================

/**
 * Supported transport types for MCP server
 */
export type TransportType = 'stdio' | 'sse';

// ============================================================================
// MCP Protocol Types
// ============================================================================

/**
 * MCP JSON-RPC 2.0 request format
 */
export interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * MCP JSON-RPC 2.0 response format
 */
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

/**
 * MCP JSON-RPC 2.0 notification format
 */
export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

// ============================================================================
// Server Configuration
// ============================================================================

/**
 * MCP Server configuration options
 */
export interface ServerConfig {
  transport: TransportType;
  apiUrl?: string;
  apiKey?: string;
  port?: number;
  host?: string;
  /** If true, API key is required for all operations */
  requireAuth?: boolean;
  /** Max requests per minute per API key (default: 100) */
  rateLimit?: number;
  /** Rate limit window in seconds (default: 60) */
  rateLimitWindow?: number;
  /** Max concurrent requests per API key (default: 5) */
  maxConcurrent?: number;
  /** Tool execution timeout in milliseconds (default: 30000) */
  toolTimeout?: number;
  /** Enable response streaming for large results (default: true) */
  enableStreaming?: boolean;
  /** Size of each streaming chunk in items (default: 10) */
  streamChunkSize?: number;
  /** Min items to trigger streaming (default: 20) */
  streamThreshold?: number;
  /** Feature #855: Global webhook callback configuration */
  webhookCallback?: WebhookCallbackConfig;
  /** Enable per-request webhook callbacks (default: true) */
  enableWebhookCallbacks?: boolean;
  /** Feature #858: Default API version for requests without explicit version */
  defaultApiVersion?: string;
}

// ============================================================================
// Streaming Types (Feature #854)
// ============================================================================

/**
 * Metadata for an active streaming response
 */
export interface StreamMetadata {
  streamId: string;
  requestId: string | number | undefined;
  toolName: string;
  totalChunks: number;
  totalItems: number;
  startedAt: number;
  completedAt?: number;
}

/**
 * Streaming chunk notification sent to clients
 */
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

// ============================================================================
// Batch Operations Types (Feature #856)
// ============================================================================

/**
 * Individual operation in a batch request
 */
export interface BatchOperationItem {
  /** Unique ID for this operation within the batch */
  id: string | number;
  /** Tool name */
  name: string;
  /** Tool arguments */
  arguments?: Record<string, unknown>;
}

/**
 * Result of a batch operation
 */
export interface BatchOperationResult {
  /** Matches the request item ID */
  id: string | number;
  status: 'success' | 'error';
  /** Result for success */
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
  duration_ms: number;
}

/**
 * Complete batch operation response
 */
export interface BatchResponse {
  batchId: string;
  totalOperations: number;
  succeeded: number;
  failed: number;
  results: BatchOperationResult[];
  duration_ms: number;
}

// ============================================================================
// Idempotency Types (Feature #857)
// ============================================================================

/**
 * Cached response for idempotency key
 */
export interface IdempotencyEntry {
  key: string;
  response: MCPResponse;
  createdAt: number;
  expiresAt: number;
  toolName: string;
  requestHash: string;
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

/**
 * Rate limiting configuration with burst support
 */
export interface RateLimitConfig {
  /** Max requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Max additional burst requests allowed */
  burstLimit: number;
  /** Burst window size in milliseconds */
  burstWindowMs: number;
}

/**
 * Rate limit tracking entry for an API key
 */
export interface RateLimitEntry {
  /** Timestamps of requests within the window */
  timestamps: number[];
  /** Timestamps of burst requests (short window) */
  burstTimestamps: number[];
}

/**
 * Per-key rate limit configuration from backend
 */
export interface PerKeyRateLimitConfig {
  max_requests: number;
  window_seconds: number;
  burst_limit: number;
  burst_window_seconds: number;
}

// ============================================================================
// SSE Transport Types
// ============================================================================

/**
 * SSE client connection state
 */
export interface SSEClient {
  id: string;
  response: http.ServerResponse;
  initialized: boolean;
  connectedAt: number;
  lastPingAt: number;
  eventBuffer: Array<{ event: string; data: string; timestamp: number }>;
  disconnectedAt?: number;
}

// ============================================================================
// SSE Configuration Constants
// ============================================================================

/** SSE ping interval in milliseconds (15 seconds) */
export const SSE_PING_INTERVAL = 15000;

/** SSE connection timeout in milliseconds (60 seconds) */
export const SSE_CONNECTION_TIMEOUT = 60000;

/** Maximum events to buffer per SSE client */
export const SSE_EVENT_BUFFER_MAX = 100;

/** Maximum age for buffered events in milliseconds (5 minutes) */
export const SSE_EVENT_BUFFER_TTL = 300000;

// ============================================================================
// MCP Protocol Constants
// ============================================================================

/** Current MCP protocol version */
export const MCP_PROTOCOL_VERSION = '2024-11-05';

/** MCP Server information */
export const SERVER_INFO = {
  name: 'qa-guardian-mcp-server',
  version: '2.0.0',
  // Note: apiVersion imported from api-versioning module at runtime
};

// ============================================================================
// Alert Subscription Types (Feature #1217)
// ============================================================================

/**
 * Alert subscription configuration
 */
export interface AlertSubscription {
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
}

// ============================================================================
// Workflow Types (Feature #1219)
// ============================================================================

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  id: string;
  name: string;
  tool: string;
  arguments: Record<string, unknown>;
  condition?: string;
  on_failure?: 'stop' | 'continue' | 'skip_remaining';
  timeout_ms?: number;
  retry_count?: number;
}

/**
 * Workflow definition
 */
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
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
}

/**
 * Workflow schedule definition (Feature #1221)
 */
export interface WorkflowSchedule {
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
}

// ============================================================================
// In-Progress Operation Types
// ============================================================================

/**
 * Tracking information for in-progress operations
 */
export interface InProgressOperation {
  startTime: number;
  method: string;
  requestId?: string | number;
  abortController?: AbortController;
}

// ============================================================================
// Concurrent Request Types
// ============================================================================

/**
 * Concurrent request state for an API key
 */
export interface ConcurrentRequestState {
  active: number;
  queue: Array<{
    resolve: (value: boolean) => void;
    timestamp: number;
    /** Feature #851: Priority level for queue ordering */
    priority: number;
  }>;
}

// ============================================================================
// Feature #1217: Alert Subscription Types
// ============================================================================

/**
 * Alert subscription entry for monitoring
 */
export interface AlertSubscription {
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
}

// ============================================================================
// Feature #1219: Workflow Types
// ============================================================================

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  id: string;
  name: string;
  tool: string;
  arguments: Record<string, unknown>;
  condition?: string;
  on_failure?: 'stop' | 'continue' | 'skip_remaining';
  timeout_ms?: number;
  retry_count?: number;
}

/**
 * Workflow definition
 */
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
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
}

// ============================================================================
// Feature #1221: Workflow Schedule Types
// ============================================================================

/**
 * Workflow schedule execution history entry
 */
export interface WorkflowExecutionHistory {
  run_id: string;
  status: 'success' | 'failed';
  started_at: Date;
  completed_at: Date;
  duration_ms: number;
}

/**
 * Workflow schedule definition
 */
export interface WorkflowSchedule {
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
  execution_history: WorkflowExecutionHistory[];
}

// ============================================================================
// Re-exports
// ============================================================================

// Re-export WebhookCallbackConfig for convenience
export { WebhookCallbackConfig } from './webhook-callbacks.js';
