/**
 * MCP Streaming Module
 *
 * Handles response streaming for large result sets in the MCP server.
 * Extracted from server.ts to reduce file size (Feature #252).
 *
 * @module mcp-streaming
 */

import { MCPResponse, StreamMetadata, StreamChunkNotification } from './mcp-types.js';
import { generateStreamId } from './hash-utils.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Logger function type
 */
export type LogFunction = (message: string) => void;

/**
 * Stream notification sender function type
 */
export type StreamNotificationSender = (notification: StreamChunkNotification) => void;

/**
 * Configuration for streaming behavior
 */
export interface StreamingConfig {
  enableStreaming: boolean;
  streamChunkSize: number;
  streamThreshold: number;
}

/**
 * Context for streaming operations
 */
export interface StreamingContext {
  config: StreamingConfig;
  log: LogFunction;
  sendNotification: StreamNotificationSender;
}

// ============================================================================
// Streaming Manager Class
// ============================================================================

/**
 * Manages response streaming for large result sets.
 */
export class StreamingManager {
  private readonly config: StreamingConfig;
  private readonly log: LogFunction;
  private readonly sendNotification: StreamNotificationSender;
  private readonly activeStreams: Map<string, StreamMetadata> = new Map();

  constructor(context: StreamingContext) {
    this.config = context.config;
    this.log = context.log;
    this.sendNotification = context.sendNotification;
  }

  /**
   * Check if a result should be streamed based on size and configuration.
   */
  shouldStreamResult(result: unknown, forceStream?: boolean): boolean {
    if (!this.config.enableStreaming) return false;
    if (forceStream === false) return false;
    if (forceStream === true) return true;

    // Auto-detect large arrays that should be streamed
    if (Array.isArray(result)) {
      return result.length >= this.config.streamThreshold;
    }

    // Check for result objects containing arrays
    if (result && typeof result === 'object') {
      const obj = result as Record<string, unknown>;
      for (const key of ['items', 'results', 'data', 'records', 'list', 'entries']) {
        if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length >= this.config.streamThreshold) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Extract streamable array from a result.
   */
  extractStreamableArray(result: unknown): {
    array: unknown[];
    wrapper?: Record<string, unknown>;
    arrayKey?: string
  } {
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

  /**
   * Stream a large result set in chunks.
   */
  async streamResult(
    result: unknown,
    requestId: string | number | undefined,
    toolName: string
  ): Promise<MCPResponse> {
    const streamId = generateStreamId();
    const { array, wrapper, arrayKey } = this.extractStreamableArray(result);
    const totalItems = array.length;
    const totalChunks = Math.ceil(totalItems / this.config.streamChunkSize);

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
      const start = chunkIndex * this.config.streamChunkSize;
      const end = Math.min(start + this.config.streamChunkSize, totalItems);
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

      this.sendNotification(notification);

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

  /**
   * Get information about active streams.
   */
  getActiveStreams(): Map<string, StreamMetadata> {
    return this.activeStreams;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a streaming manager instance.
 */
export function createStreamingManager(context: StreamingContext): StreamingManager {
  return new StreamingManager(context);
}
