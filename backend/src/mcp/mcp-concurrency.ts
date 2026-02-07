/**
 * MCP Concurrency Manager Module
 *
 * Manages concurrent request limiting with priority-based queuing for the MCP server.
 * Extracted from server.ts to reduce file size (Feature #252).
 *
 * @module mcp-concurrency
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Priority levels for request queuing
 */
export const PRIORITY_LOW = 1;
export const PRIORITY_NORMAL = 5;
export const PRIORITY_HIGH = 10;

/**
 * Queue entry for waiting requests
 */
interface QueueEntry {
  resolve: (acquired: boolean) => void;
  timestamp: number;
  priority: number;
}

/**
 * State for tracking concurrent requests per API key
 */
interface ConcurrentState {
  active: number;
  queue: QueueEntry[];
}

/**
 * Result of acquiring a concurrent slot
 */
export interface AcquireSlotResult {
  acquired: boolean;
  queued: boolean;
  position?: number;
  priority: number;
}

/**
 * Statistics for concurrent requests
 */
export interface ConcurrentStats {
  active: number;
  queued: number;
  maxConcurrent: number;
}

/**
 * Logger function type
 */
export type LogFunction = (message: string) => void;

// ============================================================================
// ConcurrencyManager Class
// ============================================================================

/**
 * Manages concurrent request limiting with priority-based queuing.
 *
 * Features:
 * - Per-API-key concurrent request limiting
 * - Priority-based queue ordering (higher priority served first)
 * - Configurable queue timeout
 * - Automatic slot release and queue processing
 */
export class ConcurrencyManager {
  /** Concurrent request tracking per API key */
  private readonly concurrentRequests: Map<string, ConcurrentState> = new Map();

  /** Maximum concurrent requests per API key */
  private readonly maxConcurrentRequests: number;

  /** Queue timeout in milliseconds */
  private readonly queueTimeout: number;

  /** Logger function */
  private readonly log: LogFunction;

  constructor(
    maxConcurrent: number = 5,
    queueTimeout: number = 30000,
    log: LogFunction = (msg) => console.error(`[Concurrency] ${msg}`)
  ) {
    this.maxConcurrentRequests = maxConcurrent;
    this.queueTimeout = queueTimeout;
    this.log = log;
  }

  /**
   * Get the maximum concurrent requests allowed.
   */
  get maxConcurrent(): number {
    return this.maxConcurrentRequests;
  }

  /**
   * Parse priority from request params.
   *
   * @param params - Request parameters
   * @returns Priority level
   */
  parsePriority(params?: Record<string, unknown>): number {
    if (!params || params._priority === undefined) {
      return PRIORITY_NORMAL;
    }
    const priority = params._priority;
    if (typeof priority === 'number') {
      // Clamp to valid range
      return Math.max(PRIORITY_LOW, Math.min(PRIORITY_HIGH, priority));
    }
    if (typeof priority === 'string') {
      switch (priority.toLowerCase()) {
        case 'low': return PRIORITY_LOW;
        case 'high': return PRIORITY_HIGH;
        case 'normal':
        default: return PRIORITY_NORMAL;
      }
    }
    return PRIORITY_NORMAL;
  }

  /**
   * Acquire a concurrent request slot.
   * Returns immediately if under limit, otherwise queues the request.
   *
   * @param apiKey - API key identifier (undefined = anonymous)
   * @param priority - Request priority (default: PRIORITY_NORMAL)
   * @returns Promise resolving to acquisition result
   */
  async acquireSlot(
    apiKey: string | undefined,
    priority: number = PRIORITY_NORMAL
  ): Promise<AcquireSlotResult> {
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

    // Insert into queue based on priority (higher priority first)
    const queueEntry: QueueEntry = {
      resolve: () => {},
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
      }, this.queueTimeout);
    });
  }

  /**
   * Release a concurrent request slot.
   * Automatically processes the next queued request if any.
   *
   * @param apiKey - API key identifier (undefined = anonymous)
   */
  releaseSlot(apiKey: string | undefined): void {
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

  /**
   * Get concurrent request stats for an API key.
   *
   * @param apiKey - API key identifier (undefined = anonymous)
   * @returns Concurrent request statistics
   */
  getStats(apiKey: string | undefined): ConcurrentStats {
    const key = apiKey || 'anonymous';
    const state = this.concurrentRequests.get(key);
    return {
      active: state?.active || 0,
      queued: state?.queue.length || 0,
      maxConcurrent: this.maxConcurrentRequests,
    };
  }

  /**
   * Clear all concurrent request tracking data.
   */
  clear(): void {
    this.concurrentRequests.clear();
  }

  /**
   * Clear concurrent request tracking for a specific API key.
   *
   * @param apiKey - API key identifier (undefined = anonymous)
   */
  clearKey(apiKey: string | undefined): void {
    const key = apiKey || 'anonymous';
    this.concurrentRequests.delete(key);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new ConcurrencyManager.
 */
export function createConcurrencyManager(
  maxConcurrent: number = 5,
  queueTimeout: number = 30000,
  log?: LogFunction
): ConcurrencyManager {
  return new ConcurrencyManager(maxConcurrent, queueTimeout, log);
}
