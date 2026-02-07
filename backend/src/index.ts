// CRITICAL: Load environment variables FIRST before any imports that use process.env
// This ensures AI providers get their API keys during initialization
import dotenv from 'dotenv';
dotenv.config();

// Feature #147: Require JWT_SECRET - security critical, fail fast if missing
if (!process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET environment variable is required but not set.');
  console.error('Please set JWT_SECRET in your .env file with a secure random string.');
  console.error('Example: JWT_SECRET=your-256-bit-secret-key-here');
  process.exit(1);
}

import Fastify from 'fastify';
import { initializeDatabase, isDatabaseConnected, healthCheck as dbHealthCheck, closeDatabase } from './services/database.js';
import { initializeCache, closeCache, getCache } from './services/cache.js'; // Feature #60: Redis cache service
import { runMigrations, getMigrationStatus } from './services/migrations.js'; // Feature #162: Database migrations
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter'; // Feature #227: Redis adapter for horizontal scaling
import { Redis } from 'ioredis'; // Feature #227: Redis clients for Socket.IO adapter
import { createVerifier } from 'fast-jwt'; // Feature #201: Socket.IO JWT authentication
import { authRoutes, initTestUsers } from './routes/auth.js';
import { organizationRoutes } from './routes/organizations.js';
import { projectRoutes } from './routes/projects.js';
import { apiKeyRoutes } from './routes/api-keys/index.js';
import { testRunRoutes, setSocketIO } from './routes/test-runs.js';
import { testSuiteRoutes } from './routes/test-suites.js';
import { scheduleRoutes } from './routes/schedules.js';
import { auditLogRoutes } from './routes/audit-logs.js';
import { githubRoutes } from './routes/github.js'; // Feature #1542: AI best practices routes
import { sastRoutes } from './routes/sast.js';
import { dastRoutes } from './routes/dast.js';
import { monitoringRoutes } from './routes/monitoring.js';
import aiTestGeneratorRoutes from './routes/ai-test-generator/index.js';
import mcpToolsRoutes from './routes/mcp-tools/index.js';
import { reportsRoutes } from './routes/reports/index.js'; // Feature #1732
import { servicesStatusRoutes, setServicesSocketIO } from './routes/services-status.js'; // Feature #2127
import { setRecordingSocketIO } from './routes/test-runs/recording-routes.js'; // Feature #26: Playwright recording
import { stepTemplateRoutes } from './routes/step-templates.js'; // Feature #31: Reusable Step Templates
import { errorsRoutes } from './routes/errors/index.js'; // Feature #166: Frontend error reporting
import { requestTimeoutHook } from './middleware/timeout.js'; // Feature #90: Request timeout middleware
import { authenticate } from './middleware/auth.js'; // Feature #205: Auth for health/metrics endpoints
import { initializeCleanupJob, stopCleanupJob, getCleanupStats } from './jobs/cleanup.js'; // Feature #154: Data retention cleanup
import { initializeExecutionQueue, shutdownExecutionQueue, getQueueHealth, registerExecutionCallback } from './services/execution-queue.js'; // Feature #155: BullMQ execution queue
import { initializeWebhookQueue, shutdownWebhookQueue, getWebhookQueueHealth, registerSubscriptionStatsCallback } from './services/webhook-queue.js'; // Feature #320: BullMQ webhook queue
import { updateSubscriptionDeliveryStats } from './routes/test-runs/webhooks.js'; // Feature #321: Webhook auto-disable
import { initializeErrorHandlers, getErrorMetrics } from './services/error-tracking.js'; // Feature #164: Error tracking
import { registerMetricsHooks, getMetricsSummary } from './services/metrics.js'; // Feature #165: API response time tracking
import { setWebSocketIO } from './services/websocket-events.js'; // Feature #108: WebSocket CRUD events
import { initializeEventSubscriber, closeSubscriber, getConnectionStatus as getRedisEventsStatus } from './services/redis-events.js'; // Feature #200: Redis Pub/Sub for worker events
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Socket.IO server instance (will be initialized after server starts)
let io: SocketIOServer | null = null;

// Feature #237: Socket.IO Redis adapter clients for graceful shutdown cleanup
let socketPubClient: Redis | null = null;
let socketSubClient: Redis | null = null;

// ========== RATE LIMITING ==========
// Feature #214: Redis-based distributed rate limiting
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory rate limit store as fallback when Redis is unavailable
const rateLimitStore: Map<string, RateLimitEntry> = new Map();

// Feature #214: Rate limit configuration with endpoint-specific limits
const RATE_LIMIT_WINDOW_SECONDS = 60; // 1 minute window
const RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_SECONDS * 1000;

// Different limits for different endpoint categories
const RATE_LIMITS = {
  AUTH: 20,       // Auth endpoints: 20 requests per minute (stricter)
  DEFAULT: 200,   // Default limit: 200 requests per minute
  READ_ONLY: 500, // Read-only endpoints: 500 requests per minute (higher)
};

// Patterns for endpoint classification
const AUTH_ENDPOINT_PATTERNS = ['/api/v1/auth'];
const READ_ONLY_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Feature #214: Get rate limit for a given request
 */
function getRateLimitForRequest(url: string, method: string): number {
  // Auth endpoints get stricter limits
  if (AUTH_ENDPOINT_PATTERNS.some(pattern => url.startsWith(pattern))) {
    return RATE_LIMITS.AUTH;
  }
  // Read-only requests get higher limits
  if (READ_ONLY_METHODS.includes(method)) {
    return RATE_LIMITS.READ_ONLY;
  }
  return RATE_LIMITS.DEFAULT;
}

// Feature #214: Cleanup old fallback entries periodically (every 5 minutes)
// Note: Redis entries auto-expire via TTL, this only cleans up memory fallback
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Feature #153: Structured JSON logging with request correlation IDs
// Fastify uses pino internally - configure it for production-grade logging
const app = Fastify({
  logger: {
    // Use LOG_LEVEL env var or default based on environment
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    // Transport for pretty printing in development, JSON in production
    ...(process.env.NODE_ENV !== 'production' && {
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          colorize: true,
        },
      },
    }),
    // Serialize objects in logs
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          path: request.routeOptions?.url || request.url,
          parameters: request.params,
          headers: {
            host: request.headers.host,
            'user-agent': request.headers['user-agent'],
            'x-request-id': request.headers['x-request-id'],
            'x-forwarded-for': request.headers['x-forwarded-for'],
          },
        };
      },
      res(reply) {
        return {
          statusCode: reply.statusCode,
        };
      },
    },
  },
  // Feature #153: Generate request IDs for correlation
  genReqId: (req) => {
    // Use client-provided X-Request-ID if present, otherwise generate one
    const clientRequestId = req.headers['x-request-id'];
    if (clientRequestId && typeof clientRequestId === 'string') {
      return clientRequestId;
    }
    // Generate a unique request ID
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },
  // Disable request logging for certain paths (logged separately)
  disableRequestLogging: false,
});

// Feature #153: Add request ID to response headers for correlation
app.addHook('onRequest', async (request, reply) => {
  // Set the request ID in response headers
  reply.header('X-Request-ID', request.id);

  // Store request start time for duration calculation
  (request as any).startTime = process.hrtime();
});

// Feature #153: Log request completion with duration
app.addHook('onResponse', async (request, reply) => {
  // Skip logging for certain paths to reduce noise
  const skipPaths = ['/health', '/favicon.ico'];
  if (skipPaths.some(path => request.url.startsWith(path))) {
    return;
  }

  // Calculate request duration
  const startTime = (request as any).startTime;
  let durationMs = 0;
  if (startTime) {
    const diff = process.hrtime(startTime);
    durationMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);
  }

  // Log with correlation ID and duration
  request.log.info({
    msg: 'request completed',
    requestId: request.id,
    method: request.method,
    url: request.url,
    statusCode: reply.statusCode,
    durationMs,
  });
});

// Register plugins
async function registerPlugins() {
  // Feature #149: CORS - Configurable allowed origins for security
  // Parse CORS_ORIGINS env var (comma-separated list) or use defaults
  const corsOriginsEnv = process.env.CORS_ORIGINS;
  const configuredOrigins = corsOriginsEnv
    ? corsOriginsEnv.split(',').map(o => o.trim()).filter(Boolean)
    : [];

  const allowedOrigins = [
    ...configuredOrigins,
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',  // Vite default (development)
    'http://localhost:3000',  // Alternative React dev server
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    // Production domains - qa.pixelcraftedmedia.com
    'https://qa.pixelcraftedmedia.com',
    'http://qa.pixelcraftedmedia.com',  // HTTP redirect should handle this
  ];

  // Log allowed origins for debugging (helpful for CORS troubleshooting)
  console.log('[CORS] Allowed origins:', allowedOrigins);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[CORS] Development mode: allowing all origins');
  }

  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) {
        cb(null, true);
        return;
      }
      // Check if the origin is in our allowed list
      if (allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      // In development, be more permissive
      if (process.env.NODE_ENV === 'development') {
        cb(null, true);
        return;
      }
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length'],
  });

  // Feature #150: Security headers (CSP, X-Frame-Options, etc.)
  app.addHook('onSend', async (_request, reply, _payload) => {
    // Content Security Policy - restrict resource loading
    reply.header('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow inline scripts for React
      "style-src 'self' 'unsafe-inline'", // Allow inline styles
      "img-src 'self' data: https:", // Allow images from self, data URIs, and HTTPS
      "font-src 'self' https:", // Allow fonts from self and HTTPS
      "connect-src 'self' https: wss:", // Allow API and WebSocket connections
      "frame-ancestors 'none'", // Prevent embedding in iframes
    ].join('; '));

    // Prevent clickjacking
    reply.header('X-Frame-Options', 'DENY');

    // Prevent MIME-type sniffing
    reply.header('X-Content-Type-Options', 'nosniff');

    // Enable XSS filter
    reply.header('X-XSS-Protection', '1; mode=block');

    // Referrer Policy
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy (previously Feature-Policy)
    reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // HSTS - only in production with HTTPS
    if (process.env.NODE_ENV === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  });

  // JWT Authentication
  // Feature #147: JWT_SECRET is validated at startup, so we can safely use it here
  await app.register(jwt, {
    secret: process.env.JWT_SECRET!,
  });

  // Feature #205: Swagger Documentation - only enabled in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'QA Guardian API',
          description: 'Enterprise-Grade Quality Assurance Automation Platform API',
          version: '1.0.0',
        },
        servers: [
          {
            url: `http://localhost:${process.env.PORT || 3001}`,
            description: 'Development server',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
            apiKeyAuth: {
              type: 'apiKey',
              in: 'header',
              name: 'X-API-Key',
            },
          },
        },
      },
    });

    await app.register(swaggerUi, {
      routePrefix: '/api/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
    });
    console.log('[Swagger] API documentation available at /api/docs');
  } else {
    console.log('[Swagger] Disabled in production mode');
  }

  // Register routes
  await app.register(authRoutes);
  await app.register(organizationRoutes);
  await app.register(projectRoutes);
  await app.register(apiKeyRoutes);
  await app.register(testRunRoutes);
  await app.register(testSuiteRoutes);
  await app.register(scheduleRoutes);
  await app.register(auditLogRoutes);
  await app.register(githubRoutes);
  await app.register(sastRoutes);
  await app.register(dastRoutes);
  await app.register(monitoringRoutes);
  await app.register(aiTestGeneratorRoutes, { prefix: '/api/v1/ai' });
  await app.register(mcpToolsRoutes, { prefix: '/api/v1/mcp' });
  await app.register(reportsRoutes); // Feature #1732
  await app.register(servicesStatusRoutes); // Feature #2127
  await app.register(stepTemplateRoutes); // Feature #31: Reusable Step Templates
  await app.register(errorsRoutes); // Feature #166: Frontend error reporting

  // Global error handler - don't expose stack traces to clients
  app.setErrorHandler((error, request, reply) => {
    // Log the full error on the server
    app.log.error(error);

    // Return a safe error response without stack trace
    const statusCode = error.statusCode || 500;
    const message = statusCode >= 500
      ? 'An internal server error occurred. Please try again later.'
      : error.message;

    reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal Server Error' : error.name || 'Error',
      message,
      statusCode,
    });
  });

  // Feature #90: Request timeout middleware - prevent 502 gateway timeouts
  // This hook must be added BEFORE other hooks to ensure timeout applies first
  app.addHook('onRequest', requestTimeoutHook);

  // Feature #214: Redis-based rate limiting hook - applies to all API routes
  app.addHook('onRequest', async (request, reply) => {
    // Skip rate limiting for certain endpoints
    const skipPaths = ['/health', '/api/docs', '/favicon.ico'];
    if (skipPaths.some(path => request.url.startsWith(path))) {
      return;
    }

    // Get client identifier (IP address or API key if present)
    const clientIp = request.ip || request.headers['x-forwarded-for'] || 'unknown';
    const apiKey = request.headers['x-api-key'];
    const clientId = apiKey ? `key:${apiKey}` : `ip:${clientIp}`;

    // Feature #214: Get endpoint-specific rate limit
    const rateLimit = getRateLimitForRequest(request.url, request.method);
    const rateLimitKey = `ratelimit:${clientId}`;

    const cache = getCache();
    let count: number;
    const now = Date.now();
    const resetAt = now + RATE_LIMIT_WINDOW_MS;

    // Feature #214: Use Redis INCR for distributed rate limiting
    if (cache.isRedisConnected()) {
      // Redis-based rate limiting with automatic expiry
      count = await cache.incr(rateLimitKey, RATE_LIMIT_WINDOW_SECONDS);
    } else {
      // Fallback to in-memory rate limiting
      let entry = rateLimitStore.get(clientId);

      // Initialize or reset entry if window has passed
      if (!entry || entry.resetAt < now) {
        entry = {
          count: 0,
          resetAt: resetAt,
        };
      }

      // Increment request count
      entry.count++;
      rateLimitStore.set(clientId, entry);
      count = entry.count;
    }

    // Calculate remaining requests and time until reset
    const remaining = Math.max(0, rateLimit - count);
    const resetInSeconds = RATE_LIMIT_WINDOW_SECONDS;

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
        retryAfter: resetInSeconds,
        limit: rateLimit,
      });
      return;
    }
  });
}

// Feature #205: Lightweight health check for Docker/Kubernetes health probes
// Returns simple status without exposing sensitive system information
app.get('/health', async (_request, reply) => {
  // Quick check of critical dependencies without detailed diagnostics
  const dbHealthy = isDatabaseConnected();
  const socketHealthy = io !== null;

  const allHealthy = dbHealthy && socketHealthy;
  const status = allHealthy ? 'ok' : 'unhealthy';

  if (!allHealthy) {
    reply.status(503);
  }

  return { status, timestamp: new Date().toISOString() };
});

// Feature #205: Detailed health check with full diagnostics - requires authentication
// Feature #152: Enhanced with disk space, memory usage, version info, and 503 on critical failures
app.get('/health/detailed', { preHandler: [authenticate] }, async (request, reply) => {
  // fs, path, os are now imported at the top level

  // Check database health with timeout
  const dbCheck = await Promise.race([
    dbHealthCheck(),
    new Promise<{ status: 'error'; latency?: number; error: string }>((resolve) =>
      setTimeout(() => resolve({ status: 'error', error: 'Database health check timed out (5s)' }), 5000)
    ),
  ]);

  // Feature #60: Check cache status with timeout
  const cacheStats = await Promise.race([
    getCache().stats(),
    new Promise<{ redisConnected: boolean; memoryCacheSize: number; redisKeyCount: number; redisMemory?: undefined }>((resolve) =>
      setTimeout(() => resolve({ redisConnected: false, memoryCacheSize: 0, redisKeyCount: 0 }), 3000)
    ),
  ]);

  // Feature #152: Check disk space
  const diskSpace = await checkDiskSpace();

  // Feature #152: Get memory usage
  const memoryUsage = {
    heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    external: Math.round(process.memoryUsage().external / 1024 / 1024),
    systemFree: Math.round(os.freemem() / 1024 / 1024),
    systemTotal: Math.round(os.totalmem() / 1024 / 1024),
  };

  // Feature #152: Get application version and build info
  const versionInfo = getVersionInfo();

  const checks = {
    server: true,
    socketio: io !== null,
    filesystem: true,
    database: dbCheck.status === 'ok',
    cache: cacheStats.redisConnected || cacheStats.memoryCacheSize >= 0, // Always true with fallback
    diskSpace: diskSpace.healthy,
  };

  // Check filesystem (screenshots/traces/videos directories)
  try {
    const dirs = ['screenshots', 'traces', 'videos'].map((d: string) => path.join(process.cwd(), d));
    dirs.forEach((dir: string) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    checks.filesystem = true;
  } catch {
    checks.filesystem = false;
  }

  // Feature #152: Critical dependencies that must be healthy
  // Database and Redis are critical in production
  const isProduction = process.env.NODE_ENV === 'production';
  const criticalChecks = {
    server: checks.server,
    socketio: checks.socketio,
    filesystem: checks.filesystem,
    // In production, database must be connected
    ...(isProduction && { database: checks.database }),
    // Disk space is always critical
    diskSpace: checks.diskSpace,
  };

  const allCriticalHealthy = Object.values(criticalChecks).every(Boolean);

  // Feature #152: Determine overall status
  let status: 'ok' | 'degraded' | 'unhealthy' = 'ok';
  if (!allCriticalHealthy) {
    status = 'unhealthy';
  } else if (!checks.database || !checks.cache) {
    status = 'degraded';
  }

  const responseBody = {
    status,
    timestamp: new Date().toISOString(),
    checks,
    database: {
      connected: isDatabaseConnected(),
      latency: dbCheck.latency,
      error: dbCheck.error,
      // Feature #157: Include pool stats from health check
      pool: 'pool' in dbCheck ? dbCheck.pool : undefined,
    },
    // Feature #60: Include cache status in health check
    // Feature #158: Enhanced with Redis memory usage
    cache: {
      redisConnected: cacheStats.redisConnected,
      memoryCacheSize: cacheStats.memoryCacheSize,
      redisKeyCount: cacheStats.redisKeyCount,
      redisMemory: cacheStats.redisMemory,
    },
    // Feature #152: Disk space info
    disk: diskSpace,
    // Feature #152: Memory usage stats
    memory: memoryUsage,
    // Feature #151: Include backup status in health check
    backup: await getBackupStatus(),
    // Feature #154: Include cleanup job status in health check
    cleanup: getCleanupStats(),
    // Feature #155: Include execution queue status in health check
    executionQueue: await getQueueHealth(),
    // Feature #320: Include webhook queue status in health check
    webhookQueue: await getWebhookQueueHealth(),
    // Feature #162: Include migration status in health check
    migrations: getMigrationStatus(),
    // Feature #164: Include error tracking metrics in health check
    errors: getErrorMetrics(),
    // Feature #152: Version and build info
    version: versionInfo.version,
    build: {
      commit: versionInfo.commit,
      buildTime: versionInfo.buildTime,
      nodeVersion: process.version,
    },
    uptime: process.uptime(),
  };

  // Feature #152: Return 503 if any critical dependency is down
  if (status === 'unhealthy') {
    reply.status(503);
  }

  return responseBody;
});

// Feature #165: API Metrics endpoint - response time tracking
// Feature #205: Requires authentication to protect latency data
app.get('/api/v1/metrics', { preHandler: [authenticate] }, async (_request, _reply) => {
  return getMetricsSummary();
});

// Feature #152: Check disk space and warn if < 1GB free
async function checkDiskSpace(): Promise<{
  healthy: boolean;
  freeGB: number;
  totalGB: number;
  usedPercent: number;
  warning: string | null;
}> {
  // fs, path, os are imported at the top level
  const { execSync } = await import('child_process');

  try {
    // Use statvfs on Unix-like systems via child_process

    // Try to get disk space info
    let freeBytes = 0;
    let totalBytes = 0;

    try {
      // Works on Linux/macOS
      const dfOutput = execSync('df -k . 2>/dev/null || df -k / 2>/dev/null', { encoding: 'utf-8' });
      const lines = dfOutput.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        // df -k outputs in 1K blocks: Filesystem, 1K-blocks, Used, Available, Use%, Mounted
        totalBytes = parseInt(parts[1], 10) * 1024;
        freeBytes = parseInt(parts[3], 10) * 1024;
      }
    } catch {
      // Fallback: estimate from OS memory (not accurate but provides a response)
      totalBytes = os.totalmem();
      freeBytes = os.freemem();
    }

    const freeGB = Math.round((freeBytes / 1024 / 1024 / 1024) * 100) / 100;
    const totalGB = Math.round((totalBytes / 1024 / 1024 / 1024) * 100) / 100;
    const usedPercent = totalBytes > 0 ? Math.round(((totalBytes - freeBytes) / totalBytes) * 100) : 0;

    // Warning if < 1GB free
    const warning = freeGB < 1 ? `Low disk space: ${freeGB}GB free` : null;
    const healthy = freeGB >= 1;

    return { healthy, freeGB, totalGB, usedPercent, warning };
  } catch (error) {
    return {
      healthy: true, // Assume healthy if we can't check
      freeGB: 0,
      totalGB: 0,
      usedPercent: 0,
      warning: 'Could not determine disk space',
    };
  }
}

// Feature #152: Get version info from package.json and environment
function getVersionInfo(): {
  version: string;
  commit: string | null;
  buildTime: string | null;
} {
  // fs, path are imported at the top level
  let version = '1.0.0';

  // Try to read version from package.json
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      version = packageJson.version || version;
    }
  } catch {
    // Use default version
  }

  // Get commit hash from environment (set during Docker build)
  const commit = process.env.BUILD_COMMIT || process.env.GIT_COMMIT || null;

  // Get build time from environment
  const buildTime = process.env.BUILD_TIME || null;

  return { version, commit, buildTime };
}

// Feature #151: Get backup status from status file
async function getBackupStatus(): Promise<{
  configured: boolean;
  lastBackup: string | null;
  status: string;
  backupsCount: number;
  retentionDays: number;
}> {
  // fs, path are imported at the top level
  const backupDir = process.env.BACKUP_DIR || '/opt/backups';
  const statusFile = path.join(backupDir, '.backup_status.json');

  try {
    if (fs.existsSync(statusFile)) {
      const content = fs.readFileSync(statusFile, 'utf-8');
      const status = JSON.parse(content);
      return {
        configured: true,
        lastBackup: status.last_backup || null,
        status: status.status || 'unknown',
        backupsCount: status.backups_count || 0,
        retentionDays: status.retention_days || 30,
      };
    }
  } catch (e) {
    // Status file not readable
  }

  return {
    configured: false,
    lastBackup: null,
    status: 'not_configured',
    backupsCount: 0,
    retentionDays: 30,
  };
}

// API v1 prefix
app.get('/api/v1', async () => {
  return {
    name: 'QA Guardian API',
    version: '1.0.0',
    documentation: '/api/docs',
  };
});

// Start server - Feature #1542 AI best practices route added
async function start() {
  try {
    // Initialize database connection (optional - will fall back to in-memory if not available)
    const dbConnected = await initializeDatabase();
    if (dbConnected) {
      console.log('[Startup] PostgreSQL database connected - data will persist');

      // Feature #162: Run pending database migrations
      const migrationsRan = await runMigrations();
      if (migrationsRan) {
        console.log('[Startup] Database migrations applied successfully');
      } else {
        console.log('[Startup] Some migrations may have failed - check logs above');
      }
    } else {
      console.log('[Startup] Using in-memory storage - data will NOT persist across restarts');
    }

    // Feature #60: Initialize Redis cache service (optional - will fall back to in-memory if not available)
    const cache = await initializeCache();
    if (cache.isRedisConnected()) {
      console.log('[Startup] Redis cache connected - caching enabled');
    } else {
      console.log('[Startup] Redis not available - using in-memory cache fallback');
    }

    // Feature #155: Initialize BullMQ execution queue (requires Redis)
    const queueInitialized = await initializeExecutionQueue();
    if (queueInitialized) {
      console.log('[Startup] Execution queue initialized - test runs will be queued with concurrency limits');
    } else {
      console.log('[Startup] Execution queue not available - test runs will execute directly');
    }

    // Feature #320: Initialize BullMQ webhook queue (requires Redis)
    const webhookQueueInitialized = await initializeWebhookQueue();
    if (webhookQueueInitialized) {
      console.log('[Startup] Webhook queue initialized - webhook deliveries will be queued reliably');

      // Feature #321: Register callback for auto-disable on sustained failure
      registerSubscriptionStatsCallback(updateSubscriptionDeliveryStats);
    } else {
      console.log('[Startup] Webhook queue not available - webhooks will use in-memory delivery');
    }

    // Seed test users AFTER database is connected
    // This ensures organization_members are persisted to the database
    try {
      await initTestUsers();
    } catch (err: any) {
      console.error('[Startup] Failed to seed test users (non-fatal):', err.message);
    }

    await registerPlugins();

    // Feature #165: Register response time tracking hooks
    registerMetricsHooks(app);

    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });

    // Initialize Socket.IO server attached to Fastify's underlying HTTP server
    // Use same CORS origins as the main server
    const socketAllowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      // Production domains - qa.pixelcraftedmedia.com
      'https://qa.pixelcraftedmedia.com',
      'http://qa.pixelcraftedmedia.com',
    ];

    // Log Socket.IO allowed origins for debugging
    console.log('Socket.IO allowed origins:', socketAllowedOrigins);

    io = new SocketIOServer(app.server, {
      cors: {
        origin: socketAllowedOrigins,
        credentials: true,
      },
    });

    // Feature #227: Socket.IO Redis adapter for horizontal scaling
    // This enables multiple API server instances to share Socket.IO events
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const redisPassword = process.env.REDIS_PASSWORD;

      const redisOptions: { host: string; port: number; password?: string } = (() => {
        try {
          const url = new URL(redisUrl);
          const opts: { host: string; port: number; password?: string } = {
            host: url.hostname,
            port: parseInt(url.port || '6379', 10),
          };
          if (redisPassword) {
            opts.password = redisPassword;
          } else if (url.password) {
            opts.password = url.password;
          }
          return opts;
        } catch {
          return { host: 'localhost', port: 6379 };
        }
      })();

      // Feature #237: Create dedicated pub/sub clients for the Socket.IO adapter
      // Store in module-level variables so gracefulShutdown can close them
      socketPubClient = new Redis(redisOptions);
      socketSubClient = new Redis(redisOptions);

      // Wait for both clients to be ready
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          socketPubClient.once('ready', resolve);
          socketPubClient.once('error', reject);
          setTimeout(() => reject(new Error('Redis pub client timeout')), 5000);
        }),
        new Promise<void>((resolve, reject) => {
          socketSubClient.once('ready', resolve);
          socketSubClient.once('error', reject);
          setTimeout(() => reject(new Error('Redis sub client timeout')), 5000);
        }),
      ]);

      // Configure the Redis adapter
      io.adapter(createAdapter(socketPubClient, socketSubClient));
      console.log('[Socket.IO] Redis adapter configured - horizontal scaling enabled');
    } catch (err) {
      console.warn('[Socket.IO] Redis adapter not available, running in single-instance mode:', err instanceof Error ? err.message : err);
      // Continue without Redis adapter - Socket.IO will work on single instance
    }

    // Feature #201: Socket.IO JWT Authentication Middleware
    // Create JWT verifier using the same secret as Fastify JWT
    const jwtSecret = process.env.JWT_SECRET!;
    const verifyJwt = createVerifier({ key: jwtSecret });

    // Extended Socket interface with user data
    interface AuthenticatedSocket extends Socket {
      data: {
        userId?: string;
        email?: string;
        role?: string;
        organizationId?: string;
        authenticated?: boolean;
      };
    }

    // Feature #201: Authentication middleware - verify JWT before allowing connection
    io.use((socket: AuthenticatedSocket, next) => {
      try {
        // Extract token from handshake auth
        const token = socket.handshake.auth?.token;

        if (!token) {
          // Feature #219: Require authentication - no more unauthenticated bypass
          console.warn(`[Socket.IO] Client ${socket.id} rejected - no token provided`);
          return next(new Error('Authentication required: No token provided'));
        }

        // Verify the JWT token
        const decoded = verifyJwt(token) as {
          id: string;
          email: string;
          role: string;
          organization_id: string;
          iat?: number;
          exp?: number;
        };

        // Attach user info to socket.data
        socket.data.userId = decoded.id;
        socket.data.email = decoded.email;
        socket.data.role = decoded.role;
        socket.data.organizationId = decoded.organization_id;
        socket.data.authenticated = true;

        console.log(`[Socket.IO] Client ${socket.id} authenticated as ${decoded.email} (org: ${decoded.organization_id})`);
        next();
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.warn(`[Socket.IO] Authentication failed for ${socket.id}: ${errorMessage}`);
        // Reject connection with invalid token
        next(new Error('Authentication failed: Invalid or expired token'));
      }
    });

    // Socket.IO connection handling
    io.on('connection', (socket: AuthenticatedSocket) => {
      const authStatus = socket.data.authenticated ? 'authenticated' : 'unauthenticated';
      console.log(`[Socket.IO] Client connected: ${socket.id} (${authStatus})`);

      // Feature #201: Join organization room with authorization check
      socket.on('join-org', (orgId: string) => {
        // If authenticated, verify the user belongs to this organization
        if (socket.data.authenticated && socket.data.organizationId !== orgId) {
          console.warn(`[Socket.IO] Client ${socket.id} tried to join unauthorized org: ${orgId} (belongs to: ${socket.data.organizationId})`);
          socket.emit('error', { message: 'Unauthorized: You do not belong to this organization' });
          return;
        }

        socket.join(`org:${orgId}`);
        console.log(`[Socket.IO] Client ${socket.id} joined org:${orgId}`);
      });

      // Feature #219: Join specific test run room with auth check
      socket.on('join-run', (runId: string) => {
        if (!socket.data.authenticated) {
          socket.emit('error', { message: 'Authentication required to join run rooms' });
          return;
        }
        socket.join(`run:${runId}`);
        console.log(`[Socket.IO] Client ${socket.id} joined run:${runId}`);
      });

      // Feature #219: Leave test run room (auth implicitly required since only authenticated clients can connect)
      socket.on('leave-run', (runId: string) => {
        socket.leave(`run:${runId}`);
        console.log(`[Socket.IO] Client ${socket.id} left run:${runId}`);
      });

      // Feature #167: Heartbeat ping/pong for connection health monitoring
      socket.on('ping', () => {
        socket.emit('pong');
      });

      socket.on('disconnect', () => {
        console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
      });
    });

    // Share Socket.IO instance with test-runs module, services status, recording, and WebSocket events
    setSocketIO(io);
    setServicesSocketIO(io);
    setRecordingSocketIO(io);
    setWebSocketIO(io); // Feature #108: WebSocket CRUD events

    // Feature #200: Initialize Redis event subscriber for worker events
    // This allows worker containers to publish events via Redis Pub/Sub
    // and have them forwarded to Socket.IO clients
    const redisEventsInitialized = await initializeEventSubscriber(io);
    if (redisEventsInitialized) {
      console.log('[Startup] Redis event subscriber initialized - worker events will be forwarded to Socket.IO');
    } else {
      console.log('[Startup] Redis event subscriber not available - worker events will not be forwarded');
    }

    // Feature #154: Initialize data retention cleanup job
    initializeCleanupJob();

    // Check AI provider status for MCP features
    const kieApiKey = process.env.KIE_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const hasKie = !!kieApiKey && kieApiKey.length > 0;
    const hasAnthropic = !!anthropicApiKey && anthropicApiKey.length > 0;
    const aiConfigured = hasKie || hasAnthropic;

    const mcpStatus = aiConfigured
      ? `Configured (${hasKie ? 'Kie.ai' : ''}${hasKie && hasAnthropic ? ' + ' : ''}${hasAnthropic ? 'Anthropic' : ''})`
      : 'Not configured - add KIE_API_KEY or ANTHROPIC_API_KEY to .env';

    const dbStatus = isDatabaseConnected()
      ? 'Connected (PostgreSQL)'
      : 'In-memory (data will not persist!)';

    console.log(`
====================================
  QA Guardian API Server
====================================

  Server running at: http://localhost:${port}
  API Documentation: http://localhost:${port}/api/docs
  Health Check:      http://localhost:${port}/health
  WebSocket:         ws://localhost:${port} (Socket.IO)

  MCP Tools:         /api/v1/mcp/tools (170+ tools)
  MCP Execute:       /api/v1/mcp/execute
  MCP Chat:          /api/v1/mcp/chat
  MCP Status:        /api/v1/mcp/status

  Database:          ${dbStatus}
  AI Provider:       ${mcpStatus}
  Environment:       ${process.env.NODE_ENV || 'development'}
  CORS Origins:      ${process.env.FRONTEND_URL || 'localhost:5173'}, qa.pixelcraftedmedia.com
====================================
    `);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Feature #164: Graceful shutdown function used by error handlers
async function gracefulShutdown(): Promise<void> {
  console.log('[Shutdown] Closing connections gracefully...');
  stopCleanupJob(); // Feature #154: Stop cleanup job
  await shutdownExecutionQueue(); // Feature #155: Stop execution queue
  await shutdownWebhookQueue(); // Feature #320: Stop webhook queue
  await closeSubscriber(); // Feature #200: Close Redis event subscriber
  // Feature #237: Close Socket.IO adapter Redis clients
  if (socketPubClient) {
    await socketPubClient.quit();
    socketPubClient = null;
  }
  if (socketSubClient) {
    await socketSubClient.quit();
    socketSubClient = null;
  }
  await closeCache(); // Feature #60: Close cache connection
  await closeDatabase();
  await app.close();
  console.log('[Shutdown] All connections closed');
}

// Feature #164: Initialize global error handlers BEFORE starting server
initializeErrorHandlers(gracefulShutdown);

start();

// Graceful shutdown on signals
process.on('SIGTERM', async () => {
  console.log('[Shutdown] SIGTERM received...');
  await gracefulShutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Shutdown] SIGINT received...');
  await gracefulShutdown();
  process.exit(0);
});

export default app;
