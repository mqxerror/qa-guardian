/**
 * API Metrics Service
 * Feature #165: API response time tracking and slow query logging
 *
 * Tracks:
 * - Request count per endpoint
 * - Average response time per endpoint
 * - Slow request logging (>1s warning, >5s error)
 * - P50, P95, P99 latency percentiles
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
// Feature #449: Use structured logger instead of console.*
import { createLogger } from './logger.js';

const log = createLogger('metrics');

// Threshold configuration (in milliseconds)
const SLOW_REQUEST_WARNING_MS = 1000; // 1 second
const SLOW_REQUEST_ERROR_MS = 5000; // 5 seconds

// Metrics storage
interface EndpointMetrics {
  method: string;
  path: string;
  requestCount: number;
  totalDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  slowRequestCount: number; // > 1s
  errorRequestCount: number; // > 5s
  // Store last 100 durations for percentile calculation
  recentDurations: number[];
}

const metricsMap: Map<string, EndpointMetrics> = new Map();
let totalRequests = 0;
let slowRequests = 0;
let errorRequests = 0;
let startTime = Date.now();

// Request timing map (request ID -> start time)
const requestTimings: Map<string, number> = new Map();

/**
 * Get metrics key for an endpoint
 */
function getMetricsKey(method: string, path: string): string {
  // Normalize path by removing IDs (UUIDs and numeric IDs)
  const normalizedPath = path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+/g, '/:id')
    .replace(/\?.*$/, ''); // Remove query string

  return `${method}:${normalizedPath}`;
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Record request start time
 */
export function startRequest(requestId: string): void {
  requestTimings.set(requestId, Date.now());
}

/**
 * Record request completion and update metrics
 */
export function endRequest(
  requestId: string,
  method: string,
  path: string,
  _statusCode: number
): number {
  const startTime = requestTimings.get(requestId);
  requestTimings.delete(requestId);

  if (!startTime) return 0;

  const duration = Date.now() - startTime;
  const key = getMetricsKey(method, path);

  // Get or create endpoint metrics
  let metrics = metricsMap.get(key);
  if (!metrics) {
    metrics = {
      method,
      path: key.split(':')[1],
      requestCount: 0,
      totalDurationMs: 0,
      minDurationMs: Infinity,
      maxDurationMs: 0,
      slowRequestCount: 0,
      errorRequestCount: 0,
      recentDurations: [],
    };
    metricsMap.set(key, metrics);
  }

  // Update metrics
  metrics.requestCount++;
  metrics.totalDurationMs += duration;
  metrics.minDurationMs = Math.min(metrics.minDurationMs, duration);
  metrics.maxDurationMs = Math.max(metrics.maxDurationMs, duration);

  // Track slow requests
  if (duration > SLOW_REQUEST_WARNING_MS) {
    metrics.slowRequestCount++;
    slowRequests++;
  }
  if (duration > SLOW_REQUEST_ERROR_MS) {
    metrics.errorRequestCount++;
    errorRequests++;
  }

  // Store recent durations (keep last 100 for percentile calculation)
  metrics.recentDurations.push(duration);
  if (metrics.recentDurations.length > 100) {
    metrics.recentDurations.shift();
  }

  totalRequests++;

  return duration;
}

/**
 * Log slow request warning/error
 */
export function logSlowRequest(
  method: string,
  path: string,
  duration: number,
  statusCode: number
): void {
  if (duration > SLOW_REQUEST_ERROR_MS) {
    log.error({ method, path, duration, statusCode }, 'SLOW REQUEST (critical)');
  } else if (duration > SLOW_REQUEST_WARNING_MS) {
    log.warn({ method, path, duration, statusCode }, 'SLOW REQUEST');
  }
}

/**
 * Get metrics summary for health/metrics endpoint
 */
export interface MetricsSummary {
  uptime: number;
  uptimeHuman: string;
  totalRequests: number;
  slowRequests: number;
  errorRequests: number;
  slowRequestPercent: number;
  errorRequestPercent: number;
  endpoints: Array<{
    method: string;
    path: string;
    requestCount: number;
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    slowRequestCount: number;
    errorRequestCount: number;
  }>;
}

export function getMetricsSummary(): MetricsSummary {
  const uptime = Date.now() - startTime;
  const hours = Math.floor(uptime / 3600000);
  const minutes = Math.floor((uptime % 3600000) / 60000);
  const seconds = Math.floor((uptime % 60000) / 1000);

  const endpoints = Array.from(metricsMap.values())
    .map(m => {
      const sorted = [...m.recentDurations].sort((a, b) => a - b);
      return {
        method: m.method,
        path: m.path,
        requestCount: m.requestCount,
        avgDurationMs: Math.round(m.totalDurationMs / m.requestCount),
        minDurationMs: m.minDurationMs === Infinity ? 0 : m.minDurationMs,
        maxDurationMs: m.maxDurationMs,
        p50Ms: percentile(sorted, 50),
        p95Ms: percentile(sorted, 95),
        p99Ms: percentile(sorted, 99),
        slowRequestCount: m.slowRequestCount,
        errorRequestCount: m.errorRequestCount,
      };
    })
    .sort((a, b) => b.requestCount - a.requestCount); // Sort by request count

  return {
    uptime,
    uptimeHuman: `${hours}h ${minutes}m ${seconds}s`,
    totalRequests,
    slowRequests,
    errorRequests,
    slowRequestPercent: totalRequests > 0 ? Math.round((slowRequests / totalRequests) * 10000) / 100 : 0,
    errorRequestPercent: totalRequests > 0 ? Math.round((errorRequests / totalRequests) * 10000) / 100 : 0,
    endpoints,
  };
}

/**
 * Reset metrics (for testing)
 */
export function resetMetrics(): void {
  metricsMap.clear();
  requestTimings.clear();
  totalRequests = 0;
  slowRequests = 0;
  errorRequests = 0;
  startTime = Date.now();
}

/**
 * Register metrics hooks with Fastify
 */
export function registerMetricsHooks(app: FastifyInstance): void {
  // Track request start time
  app.addHook('onRequest', async (request: FastifyRequest) => {
    startRequest(request.id);
  });

  // Track request completion and log slow requests
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const duration = endRequest(
      request.id,
      request.method,
      request.url,
      reply.statusCode
    );

    // Log slow requests
    logSlowRequest(request.method, request.url, duration, reply.statusCode);
  });

  log.info('Response time tracking hooks registered');
}
