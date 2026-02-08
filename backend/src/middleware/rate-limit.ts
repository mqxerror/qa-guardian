/**
 * Feature #359: Rate limiting middleware
 * Extracted from index.ts to reduce monolithic file size
 *
 * Feature #214: Redis-based distributed rate limiting with in-memory fallback
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getCache } from '../services/cache.js';

// ========== RATE LIMITING TYPES ==========
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ========== RATE LIMITING CONFIGURATION ==========
// Feature #214: Rate limit configuration with endpoint-specific limits
const RATE_LIMIT_WINDOW_SECONDS = 60; // 1 minute window
const RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_SECONDS * 1000;

// Different limits for different endpoint categories
const RATE_LIMITS = {
  AUTH: 20,       // Auth endpoints: 20 requests per minute (stricter)
  ERROR_REPORT: 10, // Feature #389: Error reporting: 10 requests per minute (tighter limit)
  DEFAULT: 200,   // Default limit: 200 requests per minute
  READ_ONLY: 500, // Read-only endpoints: 500 requests per minute (higher)
};

// Patterns for endpoint classification
const AUTH_ENDPOINT_PATTERNS = ['/api/v1/auth'];
// Feature #389: Tighter rate limit for unauthenticated error reporting endpoint
const ERROR_REPORT_PATTERNS = ['/api/v1/errors'];
const READ_ONLY_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// In-memory rate limit store as fallback when Redis is unavailable
const rateLimitStore: Map<string, RateLimitEntry> = new Map();

/**
 * Feature #214: Get rate limit for a given request
 */
export function getRateLimitForRequest(url: string, method: string): number {
  // Auth endpoints get stricter limits
  if (AUTH_ENDPOINT_PATTERNS.some(pattern => url.startsWith(pattern))) {
    return RATE_LIMITS.AUTH;
  }
  // Feature #389: Error reporting endpoints get tighter limits (POST only)
  if (method === 'POST' && ERROR_REPORT_PATTERNS.some(pattern => url === pattern)) {
    return RATE_LIMITS.ERROR_REPORT;
  }
  // Read-only requests get higher limits
  if (READ_ONLY_METHODS.includes(method)) {
    return RATE_LIMITS.READ_ONLY;
  }
  return RATE_LIMITS.DEFAULT;
}

/**
 * Feature #214: Cleanup old fallback entries periodically
 * Note: Redis entries auto-expire via TTL, this only cleans up memory fallback
 */
export function startRateLimitCleanup(): NodeJS.Timeout {
  return setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}

/**
 * Feature #214: Register rate limiting hooks on the Fastify app
 */
export function registerRateLimiting(app: FastifyInstance): void {
  // Start the cleanup interval
  startRateLimitCleanup();

  // Feature #214: Rate limiting hook (runs before each request)
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip rate limiting for health checks
    if (request.url === '/health' || request.url === '/health/detailed') {
      return;
    }

    // Get client identifier (prefer JWT user ID, fall back to IP)
    const userId = (request as any).user?.id;
    const clientIp = request.ip || request.headers['x-forwarded-for'] || 'unknown';
    const identifier = userId ? `user:${userId}` : `ip:${clientIp}`;

    // Determine rate limit based on endpoint
    const rateLimit = getRateLimitForRequest(request.url, request.method);

    // Try Redis first, fall back to in-memory
    const cache = getCache();
    const redisKey = `rate_limit:${identifier}`;
    let count = 0;
    let resetAt = Date.now() + RATE_LIMIT_WINDOW_MS;

    if (cache.isRedisConnected()) {
      // Use Redis for distributed rate limiting
      try {
        const cached = await cache.get(redisKey) as { count: number; resetAt: number } | null;
        if (cached) {
          count = cached.count + 1;
          resetAt = cached.resetAt;
        } else {
          count = 1;
          resetAt = Date.now() + RATE_LIMIT_WINDOW_MS;
        }
        // Store updated count with TTL
        await cache.set(redisKey, { count, resetAt }, RATE_LIMIT_WINDOW_SECONDS);
      } catch (err) {
        // Fall back to in-memory on Redis error
        const entry = rateLimitStore.get(identifier);
        if (entry && entry.resetAt > Date.now()) {
          count = entry.count + 1;
          resetAt = entry.resetAt;
        } else {
          count = 1;
          resetAt = Date.now() + RATE_LIMIT_WINDOW_MS;
        }
        rateLimitStore.set(identifier, { count, resetAt });
      }
    } else {
      // In-memory fallback
      const entry = rateLimitStore.get(identifier);
      if (entry && entry.resetAt > Date.now()) {
        count = entry.count + 1;
        resetAt = entry.resetAt;
      } else {
        count = 1;
        resetAt = Date.now() + RATE_LIMIT_WINDOW_MS;
      }
      rateLimitStore.set(identifier, { count, resetAt });
    }

    // Calculate remaining requests and reset time
    const remaining = Math.max(0, rateLimit - count);
    const resetInSeconds = Math.ceil((resetAt - Date.now()) / 1000);

    // Add rate limit headers to all responses
    reply.header('X-RateLimit-Limit', rateLimit);
    reply.header('X-RateLimit-Remaining', remaining);
    reply.header('X-RateLimit-Reset', Math.ceil(resetAt / 1000)); // Unix timestamp

    // Check if rate limit exceeded
    if (count > rateLimit) {
      reply.header('Retry-After', resetInSeconds);
      reply.status(429).send({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please wait ${resetInSeconds} seconds before making more requests.`,
        statusCode: 429,
        retry_after: resetInSeconds, // Feature #360: Use snake_case for consistency with HTTP headers
        limit: rateLimit,
      });
      return;
    }
  });
}

// Export the store for testing purposes
export const _rateLimitStore = rateLimitStore;

// Export constants for testing
export const RATE_LIMIT_CONSTANTS = {
  WINDOW_SECONDS: RATE_LIMIT_WINDOW_SECONDS,
  WINDOW_MS: RATE_LIMIT_WINDOW_MS,
  LIMITS: RATE_LIMITS,
};
