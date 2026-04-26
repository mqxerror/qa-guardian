/**
 * Request Timeout Middleware
 * Feature #90: Add request timeout to prevent 502 gateway errors
 *
 * This middleware sets a timeout for all API requests to prevent them from
 * hanging indefinitely and causing 502 gateway timeouts.
 */

import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
// Feature #439: Use structured logger instead of console.*
import { logger } from '../services/logger.js';

// Extend FastifyRequest to include timeout ID
interface FastifyRequestWithTimeout extends FastifyRequest {
  _timeoutId?: ReturnType<typeof setTimeout>;
}

// Default timeout in milliseconds (30 seconds)
export const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

// Paths that should have extended timeouts (for long-running operations)
const EXTENDED_TIMEOUT_PATHS: { pattern: RegExp; timeout: number }[] = [
  // Load tests can run for several minutes
  { pattern: /\/api\/v1\/runs\/.*\/load-test/, timeout: 5 * 60 * 1000 }, // 5 minutes
  // Performance tests (Lighthouse) can take a while
  { pattern: /\/api\/v1\/runs\/.*\/performance/, timeout: 3 * 60 * 1000 }, // 3 minutes
  // Security scans (DAST/SAST) can take time
  { pattern: /\/api\/v1\/(dast|sast)\/scan/, timeout: 5 * 60 * 1000 }, // 5 minutes
  // Feature #183: Visual pending count can be slow for orgs with many runs
  { pattern: /\/api\/v1\/visual\/pending\/count/, timeout: 60 * 1000 }, // 1 minute
  // AI test generation
  { pattern: /\/api\/v1\/ai\/generate/, timeout: 2 * 60 * 1000 }, // 2 minutes
  // MCP chat (AI responses)
  { pattern: /\/api\/v1\/mcp\/chat/, timeout: 2 * 60 * 1000 }, // 2 minutes
  // MCP execute (AI test generation + tool execution)
  { pattern: /\/api\/v1\/mcp\/execute/, timeout: 2 * 60 * 1000 }, // 2 minutes
  // MCP JSON-RPC adapter — runs the same handlers as /mcp/execute
  // (test generation pipeline can take 30-60s for Plan→Codegen)
  { pattern: /\/api\/v1\/mcp-rpc/, timeout: 2 * 60 * 1000 }, // 2 minutes
  // Test run execution
  { pattern: /\/api\/v1\/runs\/start/, timeout: 3 * 60 * 1000 }, // 3 minutes
  // Feature #184: Flakiness trend analytics can be slow on large datasets
  { pattern: /\/api\/v1\/tests\/.*\/flakiness-trend/, timeout: 60 * 1000 }, // 1 minute
];

// Paths that should be excluded from timeout middleware
const EXCLUDED_PATHS = [
  '/health',
  '/api/docs',
  '/favicon.ico',
  '/socket.io',
];

/**
 * Get the appropriate timeout for a given request path
 */
function getTimeoutForPath(url: string): number | null {
  // Check excluded paths
  if (EXCLUDED_PATHS.some(path => url.startsWith(path))) {
    return null; // No timeout for excluded paths
  }

  // Check extended timeout paths
  for (const { pattern, timeout } of EXTENDED_TIMEOUT_PATHS) {
    if (pattern.test(url)) {
      return timeout;
    }
  }

  // Return default timeout for all other paths
  return DEFAULT_REQUEST_TIMEOUT_MS;
}

/**
 * Request timeout hook for Fastify
 *
 * This hook sets a timeout on each request. If the request takes longer than
 * the timeout, it responds with 504 Gateway Timeout.
 */
export function requestTimeoutHook(
  request: FastifyRequestWithTimeout,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
) {
  const timeout = getTimeoutForPath(request.url);

  // Skip if no timeout needed (excluded paths)
  if (timeout === null) {
    return done();
  }

  // Store the timeout reference on the request for potential cleanup
  const timeoutId = setTimeout(() => {
    // Check if the response has already been sent
    if (reply.sent) {
      return;
    }

    logger.warn({ timeout, method: request.method, url: request.url }, '[Timeout] Request timed out');

    // Respond with 504 Gateway Timeout
    reply.status(504).send({
      error: 'Gateway Timeout',
      message: `Request timed out after ${timeout / 1000} seconds. The operation took longer than expected.`,
      statusCode: 504,
      path: request.url,
      method: request.method,
    });
  }, timeout);

  // Store timeout ID on request for cleanup
  request._timeoutId = timeoutId;

  // Clear timeout when response is sent
  reply.raw.on('finish', () => {
    clearTimeout(timeoutId);
  });

  // Also clear on close (client disconnect)
  reply.raw.on('close', () => {
    clearTimeout(timeoutId);
  });

  done();
}

/**
 * Export timeout configuration for use in other modules
 */
export const timeoutConfig = {
  DEFAULT_REQUEST_TIMEOUT_MS,
  EXTENDED_TIMEOUT_PATHS,
  EXCLUDED_PATHS,
  getTimeoutForPath,
};
