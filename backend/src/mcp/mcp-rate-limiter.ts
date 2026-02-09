/**
 * MCP Rate Limiter Module
 *
 * Implements sliding window rate limiting with burst support for the MCP server.
 * Extracted from server.ts to reduce file size (Feature #252).
 *
 * @module mcp-rate-limiter
 */

import {
  RateLimitConfig,
  RateLimitEntry,
  PerKeyRateLimitConfig,
  MCPResponse,
} from './mcp-types.js';
import { createLogger } from '../services/logger.js';

// Create logger for MCP rate limiter
const mcpLog = createLogger('mcp:rate-limiter');

// ============================================================================
// Types
// ============================================================================

/**
 * Rate limit check result
 */
export interface RateLimitCheckResult {
  allowed: boolean;
  error?: MCPResponse;
  remaining: number;
  resetMs: number;
  headers: RateLimitHeaders;
}

/**
 * Rate limit headers for HTTP responses
 */
export interface RateLimitHeaders {
  'X-RateLimit-Limit': number;
  'X-RateLimit-Remaining': number;
  'X-RateLimit-Reset': number;
  'X-RateLimit-Burst-Limit': number;
  'X-RateLimit-Burst-Remaining': number;
}

/**
 * Rate limit status (read-only check without consuming a request)
 */
export interface RateLimitStatus {
  remaining: number;
  limit: number;
  resetMs: number;
  burstLimit: number;
  burstRemaining: number;
}

/**
 * Effective rate limit config (computed from defaults and per-key overrides)
 */
export interface EffectiveRateLimitConfig {
  maxRequests: number;
  windowMs: number;
  burstLimit: number;
  burstWindowMs: number;
}

// ============================================================================
// RateLimiter Class
// ============================================================================

/**
 * Rate limiter implementing sliding window algorithm with burst support.
 *
 * Features:
 * - Sliding window rate limiting (more accurate than fixed windows)
 * - Burst allowance for temporary traffic spikes
 * - Per-key rate limit overrides from backend configuration
 * - Standard rate limit headers for HTTP responses
 */
export class RateLimiter {
  /** Default rate limit configuration */
  private readonly defaultConfig: RateLimitConfig;

  /** Per-API-key rate limit tracking */
  private readonly rateLimitStore: Map<string, RateLimitEntry> = new Map();

  /** Per-key rate limit configurations (from backend validation response) */
  private readonly perKeyRateLimits: Map<string, PerKeyRateLimitConfig> = new Map();

  /** Logger function (writes to stderr) */
  private readonly log: (message: string) => void;

  constructor(
    config: RateLimitConfig,
    log: (message: string) => void = (msg) => mcpLog.error(msg)
  ) {
    this.defaultConfig = config;
    this.log = log;
  }

  /**
   * Set per-key rate limit configuration (from backend API validation)
   */
  setPerKeyConfig(apiKey: string, config: PerKeyRateLimitConfig): void {
    this.perKeyRateLimits.set(apiKey, config);
  }

  /**
   * Get effective rate limit config for an API key.
   * Uses per-key config if available, otherwise falls back to default.
   */
  getEffectiveConfig(apiKey: string | undefined): EffectiveRateLimitConfig {
    const identifier = apiKey || 'anonymous';
    const perKeyConfig = this.perKeyRateLimits.get(identifier);

    if (perKeyConfig) {
      return {
        maxRequests: perKeyConfig.max_requests,
        windowMs: perKeyConfig.window_seconds * 1000,
        burstLimit: perKeyConfig.burst_limit,
        burstWindowMs: perKeyConfig.burst_window_seconds * 1000,
      };
    }

    return this.defaultConfig;
  }

  /**
   * Check rate limit for an API key.
   * Uses a sliding window algorithm with burst support.
   *
   * @param apiKey - The API key to check (undefined = anonymous)
   * @returns Rate limit check result with allowed status, headers, and error if exceeded
   */
  checkRateLimit(apiKey: string | undefined): RateLimitCheckResult {
    const identifier = apiKey || 'anonymous';
    const now = Date.now();
    const config = this.getEffectiveConfig(apiKey);
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
    const headers: RateLimitHeaders = {
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

  /**
   * Get current rate limit status without consuming a request.
   * Useful for status/info endpoints.
   *
   * @param apiKey - The API key to check (undefined = anonymous)
   * @returns Current rate limit status
   */
  getRateLimitStatus(apiKey: string | undefined): RateLimitStatus {
    const identifier = apiKey || 'anonymous';
    const now = Date.now();
    const config = this.getEffectiveConfig(apiKey);
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

  /**
   * Clear rate limit data for an API key.
   * Useful for testing or administrative actions.
   */
  clearRateLimitData(apiKey: string | undefined): void {
    const identifier = apiKey || 'anonymous';
    this.rateLimitStore.delete(identifier);
    this.perKeyRateLimits.delete(identifier);
  }

  /**
   * Clear all rate limit data.
   * Useful for testing or server reset.
   */
  clearAllRateLimitData(): void {
    this.rateLimitStore.clear();
    this.perKeyRateLimits.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new RateLimiter with the given configuration.
 */
export function createRateLimiter(
  maxRequests: number = 100,
  windowMs: number = 60000,
  burstLimit: number = 20,
  burstWindowMs: number = 10000,
  log?: (message: string) => void
): RateLimiter {
  return new RateLimiter(
    { maxRequests, windowMs, burstLimit, burstWindowMs },
    log
  );
}

/**
 * Create default rate limit config from server config values.
 */
export function createDefaultRateLimitConfig(
  rateLimit: number = 100,
  rateLimitWindow: number = 60,
  burstLimit: number = 20,
  burstWindowSeconds: number = 10
): RateLimitConfig {
  return {
    maxRequests: rateLimit,
    windowMs: rateLimitWindow * 1000,
    burstLimit,
    burstWindowMs: burstWindowSeconds * 1000,
  };
}
