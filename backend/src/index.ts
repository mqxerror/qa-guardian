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
import { Server as SocketIOServer } from 'socket.io';
import { authRoutes, initTestUsers } from './routes/auth.js';
import { organizationRoutes } from './routes/organizations.js';
import { projectRoutes } from './routes/projects.js';
import { apiKeyRoutes } from './routes/api-keys.js';
import { testRunRoutes, setSocketIO } from './routes/test-runs.js';
import { testSuiteRoutes } from './routes/test-suites.js';
import { scheduleRoutes } from './routes/schedules.js';
import { auditLogRoutes } from './routes/audit-logs.js';
import { githubRoutes } from './routes/github.js'; // Feature #1542: AI best practices routes
import { sastRoutes } from './routes/sast.js';
import { dastRoutes } from './routes/dast.js';
import { monitoringRoutes } from './routes/monitoring.js';
import aiTestGeneratorRoutes from './routes/ai-test-generator.js';
import mcpToolsRoutes from './routes/mcp-tools.js';
import { reportsRoutes } from './routes/reports.js'; // Feature #1732
import { servicesStatusRoutes, setServicesSocketIO } from './routes/services-status.js'; // Feature #2127
import { setRecordingSocketIO } from './routes/test-runs/recording-routes.js'; // Feature #26: Playwright recording
import { stepTemplateRoutes } from './routes/step-templates.js'; // Feature #31: Reusable Step Templates
import { errorsRoutes } from './routes/errors/index.js'; // Feature #166: Frontend error reporting
import { requestTimeoutHook } from './middleware/timeout.js'; // Feature #90: Request timeout middleware
import { initializeCleanupJob, stopCleanupJob, getCleanupStats } from './jobs/cleanup.js'; // Feature #154: Data retention cleanup
import { initializeExecutionQueue, shutdownExecutionQueue, getQueueHealth, registerExecutionCallback } from './services/execution-queue.js'; // Feature #155: BullMQ execution queue
import { initializeErrorHandlers, getErrorMetrics } from './services/error-tracking.js'; // Feature #164: Error tracking
import { registerMetricsHooks, getMetricsSummary } from './services/metrics.js'; // Feature #165: API response time tracking
import { setWebSocketIO } from './services/websocket-events.js'; // Feature #108: WebSocket CRUD events
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Socket.IO server instance (will be initialized after server starts)
let io: SocketIOServer | null = null;

// ========== RATE LIMITING ==========
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory rate limit store (per IP address)
// For production, use Redis for distributed rate limiting
const rateLimitStore: Map<string, RateLimitEntry> = new Map();

// Rate limit configuration
const RATE_LIMIT_MAX = 5000; // Maximum requests per window (increased for development/testing)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window

// Cleanup old entries periodically (every 5 minutes)
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

  // Swagger Documentation
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

  // Rate limiting hook - applies to all API routes
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

    const now = Date.now();
    let entry = rateLimitStore.get(clientId);

    // Initialize or reset entry if window has passed
    if (!entry || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      };
    }

    // Increment request count
    entry.count++;
    rateLimitStore.set(clientId, entry);

    // Calculate remaining requests and time until reset
    const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
    const resetInSeconds = Math.ceil((entry.resetAt - now) / 1000);

    // Add rate limit headers to all responses
    reply.header('X-RateLimit-Limit', RATE_LIMIT_MAX);
    reply.header('X-RateLimit-Remaining', remaining);
    reply.header('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000)); // Unix timestamp

    // Check if rate limit exceeded
    if (entry.count > RATE_LIMIT_MAX) {
      reply.header('Retry-After', resetInSeconds);
      reply.status(429).send({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please wait ${resetInSeconds} seconds before making more requests.`,
        statusCode: 429,
        retryAfter: resetInSeconds,
      });
      return;
    }
  });
}

// Health check endpoint with service status
// Used by Dokploy/Docker health checks and deployment verification
// Feature #152: Enhanced with disk space, memory usage, version info, and 503 on critical failures
app.get('/health', async (request, reply) => {
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
app.get('/api/v1/metrics', async (request, reply) => {
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

    // Socket.IO connection handling
    io.on('connection', (socket) => {
      console.log(`[Socket.IO] Client connected: ${socket.id}`);

      // Join organization room for targeted broadcasts
      socket.on('join-org', (orgId: string) => {
        socket.join(`org:${orgId}`);
        console.log(`[Socket.IO] Client ${socket.id} joined org:${orgId}`);
      });

      // Join specific test run room
      socket.on('join-run', (runId: string) => {
        socket.join(`run:${runId}`);
        console.log(`[Socket.IO] Client ${socket.id} joined run:${runId}`);
      });

      // Leave test run room
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
