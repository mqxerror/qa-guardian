/**
 * MCP Idempotency Cache Module
 *
 * Provides request deduplication via idempotency keys for the MCP server.
 * Extracted from server.ts to reduce file size (Feature #252).
 *
 * @module mcp-idempotency
 */

import { IdempotencyEntry, MCPResponse } from './mcp-types.js';
import { createLogger } from '../services/logger.js';

// Create logger for MCP idempotency cache
const mcpLog = createLogger('mcp:idempotency');

// ============================================================================
// Types
// ============================================================================

/**
 * Logger function type
 */
export type LogFunction = (message: string) => void;

/**
 * Idempotency cache statistics
 */
export interface IdempotencyCacheStats {
  size: number;
  entries: Array<{ key: string; toolName: string; expiresIn: number }>;
}

// ============================================================================
// IdempotencyCache Class
// ============================================================================

/**
 * Manages idempotency keys and cached responses.
 *
 * Features:
 * - Request deduplication via user-provided keys
 * - Configurable TTL for cached responses
 * - Automatic cleanup of expired entries
 * - Tool and request hash validation
 */
export class IdempotencyCache {
  /** Cached responses by idempotency key */
  private readonly cache: Map<string, IdempotencyEntry> = new Map();

  /** Default TTL in milliseconds (1 hour) */
  private readonly defaultTTL: number;

  /** Cleanup interval handle */
  private cleanupInterval: NodeJS.Timeout | null = null;

  /** Logger function */
  private readonly log: LogFunction;

  constructor(
    defaultTTL: number = 3600000, // 1 hour
    log: LogFunction = (msg) => mcpLog.info(msg)
  ) {
    this.defaultTTL = defaultTTL;
    this.log = log;
  }

  /**
   * Start automatic cleanup of expired entries.
   *
   * @param intervalMs - Cleanup interval in milliseconds (default: 60000)
   */
  startCleanup(intervalMs: number = 60000): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, intervalMs);

    this.log(`Started idempotency cache cleanup (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop automatic cleanup.
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.log('Stopped idempotency cache cleanup');
    }
  }

  /**
   * Remove expired entries from the cache.
   */
  cleanupExpired(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.log(`Cleaned up ${removed} expired idempotency entries`);
    }
  }

  /**
   * Check if a cached response exists for the given idempotency key.
   *
   * @param key - Idempotency key
   * @param toolName - Expected tool name
   * @param requestHash - Expected request hash
   * @returns Cached entry if valid, null otherwise
   */
  check(key: string, toolName: string, requestHash: string): IdempotencyEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
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

  /**
   * Store a response in the cache.
   *
   * @param key - Idempotency key
   * @param toolName - Tool name
   * @param requestHash - Request hash for validation
   * @param response - Response to cache
   * @param ttlMs - Custom TTL in milliseconds (optional)
   */
  store(
    key: string,
    toolName: string,
    requestHash: string,
    response: MCPResponse,
    ttlMs?: number
  ): void {
    const now = Date.now();
    const actualTTL = ttlMs || this.defaultTTL;

    const entry: IdempotencyEntry = {
      key,
      response,
      createdAt: now,
      expiresAt: now + actualTTL,
      toolName,
      requestHash,
    };

    this.cache.set(key, entry);
    this.log(`[IDEMPOTENCY] Stored response for key: ${key} (expires in ${actualTTL / 1000}s)`);
  }

  /**
   * Parse idempotency key from request arguments.
   *
   * @param args - Request arguments
   * @returns Idempotency key if valid, undefined otherwise
   */
  parseKey(args?: Record<string, unknown>): string | undefined {
    if (!args) return undefined;
    const key = args._idempotencyKey;
    if (typeof key === 'string' && key.length > 0 && key.length <= 256) {
      return key;
    }
    return undefined;
  }

  /**
   * Get cache statistics.
   *
   * @returns Cache statistics
   */
  getStats(): IdempotencyCacheStats {
    const now = Date.now();
    const entries: IdempotencyCacheStats['entries'] = [];

    for (const [key, entry] of this.cache) {
      entries.push({
        key,
        toolName: entry.toolName,
        expiresIn: Math.max(0, entry.expiresAt - now),
      });
    }

    return { size: this.cache.size, entries };
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.cache.clear();
    this.log('Cleared idempotency cache');
  }

  /**
   * Get the number of cached entries.
   */
  get size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new IdempotencyCache.
 */
export function createIdempotencyCache(
  defaultTTL: number = 3600000,
  log?: LogFunction
): IdempotencyCache {
  return new IdempotencyCache(defaultTTL, log);
}
