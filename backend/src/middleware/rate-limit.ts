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

// User payload type for authenticated requests (optional since rate limiting runs before auth for some paths)
interface AuthenticatedUser {
  id?: string;
  email?: string;
  role?: string;
  organization_id?: string;
}

// ========== RATE LIMITING CONFIGURATION ==========
// Feature #214: Rate limit configuration with endpoint-specific limits
const RATE_LIMIT_WINDOW_SECONDS = 60; // 1 minute window
const RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_SECONDS * 1000;

// Different limits for different endpoint categories
const RATE_LIMITS = {
  QUICK_TEST: 5,   // Feature #437: Quick Test: 5 requests per minute (amplification prevention)
  AUTH_LOGIN: 10,   // Login/register: 10 requests per minute (brute-force prevention)
  AUTH_GENERAL: 300, // Auth reads (/me, /refresh, /sessions): 300/min (raised for dev/testing traffic)
  ERROR_REPORT: 10, // Feature #389: Error reporting: 10 requests per minute (tighter limit)
  DEFAULT: 100,     // Feature #437: Default limit: 100 requests per minute (global safety net)
  READ_ONLY: 300,   // Read-only endpoints: 300 requests per minute (higher but safer)
};

// Patterns for endpoint classification
// Brute-force targets: login, register, forgot-password, reset-password (strict limit)
const AUTH_LOGIN_PATTERNS = [
  '/api/v1/auth/login',
  '/api/v1/auth/login-short',
  '/api/v1/auth/register',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
];
// General auth: /me, /refresh, /sessions, /logout (higher limit - normal navigation traffic)
const AUTH_GENERAL_PATTERNS = ['/api/v1/auth'];
// Feature #437: Quick Test endpoints make outbound HTTP requests - strict limit to prevent amplification
const QUICK_TEST_PATTERNS = ['/api/v1/quick-test'];
// Feature #389: Tighter rate limit for unauthenticated error reporting endpoint
const ERROR_REPORT_PATTERNS = ['/api/v1/errors'];
const READ_ONLY_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// In-memory rate limit store as fallback when Redis is unavailable
const rateLimitStore: Map<string, RateLimitEntry> = new Map();

// Feature #390: Store cleanup interval ref for graceful shutdown
let rateLimitCleanupInterval: NodeJS.Timeout | null = null;

/**
 * Get the rate limit bucket name for a request.
 * Each bucket has its own independent counter, so /auth/me traffic
 * doesn't eat into the login attempt budget.
 */
export function getRateLimitBucket(url: string, method: string): string {
  if (method === 'POST' && QUICK_TEST_PATTERNS.some(pattern => url.startsWith(pattern))) {
    return 'quick_test';
  }
  if (AUTH_LOGIN_PATTERNS.some(pattern => url.startsWith(pattern))) {
    return 'auth_login';
  }
  if (AUTH_GENERAL_PATTERNS.some(pattern => url.startsWith(pattern))) {
    return 'auth_general';
  }
  if (method === 'POST' && ERROR_REPORT_PATTERNS.some(pattern => url === pattern)) {
    return 'error_report';
  }
  if (READ_ONLY_METHODS.includes(method)) {
    return 'read_only';
  }
  return 'default';
}

const BUCKET_LIMITS: Record<string, number> = {
  quick_test: RATE_LIMITS.QUICK_TEST,
  auth_login: RATE_LIMITS.AUTH_LOGIN,
  auth_general: RATE_LIMITS.AUTH_GENERAL,
  error_report: RATE_LIMITS.ERROR_REPORT,
  read_only: RATE_LIMITS.READ_ONLY,
  default: RATE_LIMITS.DEFAULT,
};

export function getRateLimitForRequest(url: string, method: string): number {
  return BUCKET_LIMITS[getRateLimitBucket(url, method)] ?? RATE_LIMITS.DEFAULT;
}

/**
 * Feature #214: Cleanup old fallback entries periodically
 * Note: Redis entries auto-expire via TTL, this only cleans up memory fallback
 * Feature #390: Returns and stores interval ref for graceful shutdown
 */
export function startRateLimitCleanup(): NodeJS.Timeout {
  rateLimitCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000); // Every 5 minutes
  return rateLimitCleanupInterval;
}

/**
 * Feature #390: Stop the rate limit cleanup interval during graceful shutdown
 */
export function stopRateLimitCleanup(): void {
  if (rateLimitCleanupInterval) {
    clearInterval(rateLimitCleanupInterval);
    rateLimitCleanupInterval = null;
  }
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
    // User may be set by auth middleware, cast to get typed access
    const userId = (request.user as AuthenticatedUser | undefined)?.id;
    const clientIp = request.ip || request.headers['x-forwarded-for'] || 'unknown';
    const identifier = userId ? `user:${userId}` : `ip:${clientIp}`;

    // Determine rate limit based on endpoint — each bucket has independent counters
    const bucket = getRateLimitBucket(request.url, request.method);
    const rateLimit = BUCKET_LIMITS[bucket] ?? RATE_LIMITS.DEFAULT;

    // Feature #390: Use atomic incr() to prevent race conditions under concurrent load
    const cache = getCache();
    const redisKey = `rate_limit:${bucket}:${identifier}`;
    let count = 0;
    let resetAt = Date.now() + RATE_LIMIT_WINDOW_MS;

    // Use atomic incr() which handles both Redis and in-memory fallback
    // incr() uses Redis MULTI/EXEC for atomic increment + expire
    count = await cache.incr(redisKey, RATE_LIMIT_WINDOW_SECONDS);

    // For in-memory fallback, we still need to track resetAt for headers
    // Use bucket-scoped key so each category has independent counters
    if (!cache.isRedisConnected()) {
      const memKey = `${bucket}:${identifier}`;
      const entry = rateLimitStore.get(memKey);
      if (entry && entry.resetAt > Date.now()) {
        resetAt = entry.resetAt;
        entry.count = count;
      } else {
        resetAt = Date.now() + RATE_LIMIT_WINDOW_MS;
        rateLimitStore.set(memKey, { count, resetAt });
      }
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
