/**
 * MCP Operations Tracker Module
 *
 * Tracks in-progress operations for graceful shutdown support.
 * Extracted from server.ts to reduce file size (Feature #252).
 *
 * @module mcp-operations
 */

// ============================================================================
// Types
// ============================================================================

/**
 * In-progress operation tracking entry
 */
export interface OperationEntry {
  startTime: number;
  method: string;
  requestId?: string | number;
  abortController?: AbortController;
}

/**
 * Logger function type
 */
export type LogFunction = (message: string) => void;

// ============================================================================
// OperationsTracker Class
// ============================================================================

/**
 * Tracks in-progress operations for graceful shutdown support.
 *
 * Features:
 * - Track operation start/completion with timing
 * - AbortController support for cancellation
 * - Bulk abort for shutdown scenarios
 * - Operation statistics
 */
export class OperationsTracker {
  /** In-progress operations map */
  private readonly operations: Map<string, OperationEntry> = new Map();

  /** Logger function */
  private readonly log: LogFunction;

  constructor(log: LogFunction = (msg) => console.error(`[Operations] ${msg}`)) {
    this.log = log;
  }

  /**
   * Get the number of in-progress operations.
   */
  get count(): number {
    return this.operations.size;
  }

  /**
   * Track the start of an operation.
   *
   * @param operationId - Unique operation identifier
   * @param method - Method/tool name being executed
   * @param requestId - Optional request ID for correlation
   * @returns AbortController for the operation
   */
  trackStart(operationId: string, method: string, requestId?: string | number): AbortController {
    const abortController = new AbortController();
    this.operations.set(operationId, {
      startTime: Date.now(),
      method,
      requestId,
      abortController,
    });
    this.log(`[OPERATION] Started: ${operationId} (${method})`);
    return abortController;
  }

  /**
   * Track the completion of an operation.
   *
   * @param operationId - Operation identifier
   */
  trackComplete(operationId: string): void {
    const op = this.operations.get(operationId);
    if (op) {
      const duration = Date.now() - op.startTime;
      this.log(`[OPERATION] Completed: ${operationId} (${op.method}) in ${duration}ms`);
      this.operations.delete(operationId);
    }
  }

  /**
   * Abort all in-progress operations.
   */
  abortAll(): void {
    for (const [opId, op] of this.operations) {
      this.log(`Aborting operation ${opId}: ${op.method} (running for ${Date.now() - op.startTime}ms)`);
      if (op.abortController) {
        op.abortController.abort();
      }
    }
    this.operations.clear();
  }

  /**
   * Wait for all operations to complete or timeout.
   *
   * @param timeoutMs - Maximum wait time in milliseconds
   * @returns true if all operations completed, false if timed out
   */
  async waitForCompletion(timeoutMs: number): Promise<boolean> {
    const waitStart = Date.now();

    while (this.operations.size > 0 && (Date.now() - waitStart) < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Check every 100ms
    }

    return this.operations.size === 0;
  }

  /**
   * Get all in-progress operations.
   */
  getAll(): Map<string, OperationEntry> {
    return new Map(this.operations);
  }

  /**
   * Check if a specific operation is in progress.
   *
   * @param operationId - Operation identifier
   */
  has(operationId: string): boolean {
    return this.operations.has(operationId);
  }

  /**
   * Get a specific operation.
   *
   * @param operationId - Operation identifier
   */
  get(operationId: string): OperationEntry | undefined {
    return this.operations.get(operationId);
  }

  /**
   * Clear all tracked operations without aborting.
   */
  clear(): void {
    this.operations.clear();
  }
}

// ============================================================================
// Timeout Execution Helper
// ============================================================================

/**
 * Execute a promise with a timeout.
 *
 * @param promise - Promise to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param toolName - Tool name for error message
 * @returns Promise result
 * @throws TimeoutError if the promise doesn't complete in time
 */
export async function executeWithTimeout<T>(
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

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new OperationsTracker.
 */
export function createOperationsTracker(log?: LogFunction): OperationsTracker {
  return new OperationsTracker(log);
}
