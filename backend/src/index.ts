// CRITICAL: Load environment variables FIRST before any imports that use process.env
// This ensures AI providers get their API keys during initialization
import dotenv from 'dotenv';
dotenv.config();

// Feature #147: Require JWT_SECRET - security critical, fail fast if missing
if (!process.env.JWT_SECRET) {
  // Feature #721: Use process.stderr.write instead of console.error
  // (logger not yet available at this early boot phase)
  process.stderr.write('[FATAL] JWT_SECRET environment variable is required but not set.\n');
  process.stderr.write('Please set JWT_SECRET in your .env file with a secure random string.\n');
  process.stderr.write('Example: JWT_SECRET=your-256-bit-secret-key-here\n');
  process.exit(1);
}

import Fastify, { FastifyRequest } from 'fastify';

// Feature #356: Type augmentation for request.startTime
declare module 'fastify' {
  interface FastifyRequest {
    startTime: [number, number] | null;
  }
}
import { initializeDatabase, isDatabaseConnected, closeDatabase } from './services/database.js';
import { initializeCache, closeCache, getCache } from './services/cache.js'; // Feature #60: Redis cache service
import { runMigrations } from './services/migrations.js'; // Feature #162: Database migrations
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
import { aiRouter } from './services/providers/ai-router.js'; // Phase 3A: Startup initialization
import quickTestRoutes from './routes/quick-test/index.js'; // Feature #424: Quick Test API
import { reportsRoutes } from './routes/reports/index.js'; // Feature #1732
import { servicesStatusRoutes, setServicesSocketIO } from './routes/services-status.js'; // Feature #2127
import { setRecordingSocketIO } from './routes/test-runs/recording-routes.js'; // Feature #26: Playwright recording
import { stepTemplateRoutes } from './routes/step-templates.js'; // Feature #31: Reusable Step Templates
import { errorsRoutes } from './routes/errors/index.js'; // Feature #166: Frontend error reporting
import { aiUsageRoutes } from './routes/ai-usage.js'; // Feature #477: AI usage tracking
import { healthRoutes, setHealthSocketIO } from './routes/health.js'; // Feature #359: Health check routes
import { requestTimeoutHook } from './middleware/timeout.js'; // Feature #90: Request timeout middleware
import { registerRateLimiting } from './middleware/rate-limit.js'; // Feature #359: Rate limiting middleware
import { initializeCleanupJob, stopCleanupJob } from './jobs/cleanup.js'; // Feature #154: Data retention cleanup
import { initializeQuickTestScheduler, stopQuickTestScheduler } from './jobs/quick-test-scheduler.js'; // Feature #684: Quick Test cron scheduler
import { initializeSuiteScheduleExecutor, stopSuiteScheduleExecutor } from './jobs/suite-schedule-executor.js'; // Feature #870: Suite schedule executor
import { initializeExecutionQueue, shutdownExecutionQueue } from './services/execution-queue.js'; // Feature #155: BullMQ execution queue
import { initializeWebhookQueue, shutdownWebhookQueue, registerSubscriptionStatsCallback } from './services/webhook-queue.js'; // Feature #320: BullMQ webhook queue
import { updateSubscriptionDeliveryStats, initializeWebhookSubscriptionsFromDb, closeWebhookPubSub, initializeWebhookPubSub } from './routes/test-runs/webhooks.js'; // Feature #321: Webhook auto-disable, Feature #329: DB persistence, Feature #362: Pub/Sub init, Feature #372: Pub/Sub cleanup
import { initializeErrorHandlers } from './services/error-tracking.js'; // Feature #164: Error tracking
import { registerMetricsHooks } from './services/metrics.js'; // Feature #165: API response time tracking
import { setWebSocketIO } from './services/websocket-events.js'; // Feature #108: WebSocket CRUD events
import { initializeEventSubscriber, closeSubscriber } from './services/redis-events.js'; // Feature #200: Redis Pub/Sub for worker events
import { generateRequestId } from './utils/index.js';
import { getTestRun } from './services/repositories/test-runs.js'; // Feature #388: Organization check for Socket.IO join-run
import { getQuickTestResultAsync, shutdownQuickTestTimers } from './services/quick-test-runner.js'; // Feature #461: Organization check for Socket.IO join-quick-test, Feature #BMAD: TTL timer cleanup
import { createLogger } from './services/logger.js'; // Feature #447: Structured logging
import { sendError } from './utils/errors.js'; // Feature #722: Standardized error responses

// Feature #447: Server logger for startup and lifecycle logging
const log = createLogger('server');

// Socket.IO server instance (will be initialized after server starts)
let io: SocketIOServer | null = null;

// Feature #237: Socket.IO Redis adapter clients for graceful shutdown cleanup
let socketPubClient: Redis | null = null;
let socketSubClient: Redis | null = null;

// ========== CORS Configuration ==========
// Feature #358: Shared CORS origins to avoid duplication
const CORS_ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',  // Vite default (development)
  'http://localhost:3000',  // Alternative React dev server
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  // Production domains - qa.pixelcraftedmedia.com
  'https://qa.pixelcraftedmedia.com',
  'http://qa.pixelcraftedmedia.com',  // HTTP redirect should handle this
] as const;

// Feature #153: Structured JSON logging with request correlation IDs
// Fastify uses pino internally - configure it for production-grade logging
const app = Fastify({
  // Trust reverse proxy (Nginx/Traefik) so request.ip reads X-Forwarded-For
  // Without this, ALL users behind the proxy share a single rate limit counter
  trustProxy: true,
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
    // Generate a unique request ID (Feature #357: Use shared utility)
    return generateRequestId();
  },
  // Disable request logging for certain paths (logged separately)
  disableRequestLogging: false,
});

// Feature #356: Type-safe request decoration for duration tracking
// Using [number, number] type for process.hrtime() result
app.decorateRequest('startTime', null as [number, number] | null);

// Feature #153: Add request ID to response headers for correlation
app.addHook('onRequest', async (request, reply) => {
  // Set the request ID in response headers
  reply.header('X-Request-ID', request.id);

  // Store request start time for duration calculation
  request.startTime = process.hrtime();
});

// Feature #153: Log request completion with duration
app.addHook('onResponse', async (request, reply) => {
  // Skip logging for certain paths to reduce noise
  const skipPaths = ['/health', '/favicon.ico'];
  if (skipPaths.some(path => request.url.startsWith(path))) {
    return;
  }

  // Calculate request duration (Feature #356: type-safe access)
  const startTime = request.startTime;
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
  // Parse CORS_ORIGINS env var (comma-separated list) and combine with defaults
  // Feature #358: Use shared CORS_ALLOWED_ORIGINS constant
  const corsOriginsEnv = process.env.CORS_ORIGINS;
  const configuredOrigins = corsOriginsEnv
    ? corsOriginsEnv.split(',').map(o => o.trim()).filter(Boolean)
    : [];

  const allowedOrigins = [
    ...configuredOrigins,
    ...CORS_ALLOWED_ORIGINS,
  ];

  // Log allowed origins for debugging (helpful for CORS troubleshooting)
  log.info({ allowedOrigins }, 'CORS allowed origins configured');
  if (process.env.NODE_ENV !== 'production') {
    log.info('CORS development mode: allowing all origins');
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
    log.info('Swagger API documentation available at /api/docs');
  } else {
    log.info('Swagger disabled in production mode');
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

  // Feature #359: Route prefix documentation
  // Most routes are registered without a prefix and define their paths internally (e.g., /api/v1/auth, /api/v1/projects)
  // Some routes use inline prefixes for modularity:
  // - aiTestGeneratorRoutes: /api/v1/ai/* - AI test generation endpoints
  // - mcpToolsRoutes: /api/v1/mcp/* - MCP tool execution endpoints
  // This allows these modules to define paths relative to their prefix (e.g., /generate instead of /api/v1/ai/generate)
  await app.register(aiTestGeneratorRoutes, { prefix: '/api/v1/ai' });
  await app.register(mcpToolsRoutes, { prefix: '/api/v1/mcp' });
  await app.register(quickTestRoutes); // Feature #424: Quick Test API
  await app.register(reportsRoutes); // Feature #1732
  await app.register(servicesStatusRoutes); // Feature #2127
  await app.register(stepTemplateRoutes); // Feature #31: Reusable Step Templates
  await app.register(errorsRoutes); // Feature #166: Frontend error reporting
  await app.register(aiUsageRoutes); // Feature #477: AI usage tracking

  // Global error handler - don't expose stack traces to clients
  // Feature #722: Global error handler uses standardized error shape
  app.setErrorHandler((error, request, reply) => {
    // Log the full error on the server
    app.log.error(error);

    // Return a safe error response without stack trace
    const statusCode = error.statusCode || 500;
    const code = statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : (error.name || 'ERROR');
    const message = statusCode >= 500
      ? 'An internal server error occurred. Please try again later.'
      : error.message;

    return sendError(reply, statusCode, code, message);
  });

  // Feature #90: Request timeout middleware - prevent 502 gateway timeouts
  // This hook must be added BEFORE other hooks to ensure timeout applies first
  app.addHook('onRequest', requestTimeoutHook);

  // Feature #359: Rate limiting extracted to middleware/rate-limit.ts
  registerRateLimiting(app);

  // Feature #359: Health check routes extracted to routes/health.ts
  await app.register(healthRoutes);
}

// Feature #359: Health check endpoints and utility functions extracted to:
// - routes/health.ts (health endpoints + metrics endpoint)
// - services/health-checks.ts (checkDiskSpace, getVersionInfo, getBackupStatus)
// - middleware/rate-limit.ts (rate limiting configuration and hooks)

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
      log.info('PostgreSQL database connected - data will persist');

      // Feature #162: Run pending database migrations
      const migrationsRan = await runMigrations();
      if (migrationsRan) {
        log.info('Database migrations applied successfully');
      } else {
        log.warn('Some migrations may have failed - check logs above');
      }
    } else {
      log.warn('Using in-memory storage - data will NOT persist across restarts');
    }

    // Feature #60: Initialize Redis cache service (optional - will fall back to in-memory if not available)
    const cache = await initializeCache();
    if (cache.isRedisConnected()) {
      log.info('Redis cache connected - caching enabled');
    } else {
      log.info('Redis not available - using in-memory cache fallback');
    }

    // Feature #BMAD: Clean up zombie runs from previous lifecycle.
    // After a deploy/restart, runs stuck in 'running' are orphans — mark them as 'error'.
    // Done after cache init so we can flush stale cached run listings.
    if (dbConnected) {
      try {
        const { cleanupZombieRuns } = await import('./services/repositories/test-runs.js');
        const cleaned = await cleanupZombieRuns();
        if (cleaned > 0) {
          log.warn({ count: cleaned }, 'Cleaned up zombie runs from previous container lifecycle');
          // Flush all cached run listings so the frontend sees the updated statuses
          await cache.clear();
          log.info('Flushed cache after zombie cleanup');
        }
      } catch (err) {
        log.error({ error: err }, 'Failed to run zombie cleanup - continuing startup');
      }
    }

    // Feature #155: Initialize BullMQ execution queue (requires Redis)
    const queueInitialized = await initializeExecutionQueue();
    if (queueInitialized) {
      log.info('Execution queue initialized - test runs will be queued with concurrency limits');
    } else {
      log.info('Execution queue not available - test runs will execute directly');
    }

    // Feature #329: Initialize webhook subscriptions from database
    try {
      await initializeWebhookSubscriptionsFromDb();
      log.info('Webhook subscriptions loaded from database');
    } catch (err: unknown) {
      log.error({ error: err instanceof Error ? err.message : String(err) }, 'Failed to load webhook subscriptions from database (non-fatal)');
    }

    // Feature #320: Initialize BullMQ webhook queue (requires Redis)
    const webhookQueueInitialized = await initializeWebhookQueue();
    if (webhookQueueInitialized) {
      log.info('Webhook queue initialized - webhook deliveries will be queued reliably');

      // Feature #321: Register callback for auto-disable on sustained failure
      registerSubscriptionStatsCallback(updateSubscriptionDeliveryStats);
    } else {
      log.info('Webhook queue not available - webhooks will use in-memory delivery');
    }

    // Feature #362: Initialize Redis Pub/Sub for webhook cache invalidation (Feature #381)
    try {
      const webhookPubSubInitialized = await initializeWebhookPubSub();
      if (webhookPubSubInitialized) {
        log.info('Webhook Pub/Sub initialized - cache invalidation across instances enabled');
      } else {
        log.info('Webhook Pub/Sub already initialized');
      }
    } catch (err: unknown) {
      log.warn({ error: err instanceof Error ? err.message : String(err) }, 'Webhook Pub/Sub not available (non-fatal)');
    }

    // Seed test users AFTER database is connected
    // This ensures organization_members are persisted to the database
    try {
      await initTestUsers();
    } catch (err: unknown) {
      log.error({ error: err instanceof Error ? err.message : String(err) }, 'Failed to seed test users (non-fatal)');
    }

    await registerPlugins();

    // Feature #165: Register response time tracking hooks
    registerMetricsHooks(app);

    const port = parseInt(process.env.PORT || '3001', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });

    // Initialize Socket.IO server attached to Fastify's underlying HTTP server
    // Feature #358: Use shared CORS_ALLOWED_ORIGINS constant
    // Feature #BMAD: Include configuredOrigins from CORS_ORIGINS env var for parity with Fastify CORS
    const corsOriginsEnv = process.env.CORS_ORIGINS;
    const socketConfiguredOrigins = corsOriginsEnv
      ? corsOriginsEnv.split(',').map(o => o.trim()).filter(Boolean)
      : [];
    const socketAllowedOrigins = [
      ...socketConfiguredOrigins,
      ...CORS_ALLOWED_ORIGINS,
    ];
    log.info({ allowedOrigins: socketAllowedOrigins }, 'Socket.IO allowed origins');

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
      // Use ! assertion since we just assigned them above
      const pubClient = socketPubClient!;
      const subClient = socketSubClient!;
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          pubClient.once('ready', resolve);
          pubClient.once('error', reject);
          setTimeout(() => reject(new Error('Redis pub client timeout')), 5000);
        }),
        new Promise<void>((resolve, reject) => {
          subClient.once('ready', resolve);
          subClient.once('error', reject);
          setTimeout(() => reject(new Error('Redis sub client timeout')), 5000);
        }),
      ]);

      // Configure the Redis adapter
      io.adapter(createAdapter(socketPubClient, socketSubClient));
      log.info('Socket.IO Redis adapter configured - horizontal scaling enabled');
    } catch (err) {
      log.warn({ error: err instanceof Error ? err.message : String(err) }, 'Socket.IO Redis adapter not available, running in single-instance mode');
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
          log.warn({ socketId: socket.id }, 'Socket.IO client rejected - no token provided');
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

        log.info({ socketId: socket.id, email: decoded.email, orgId: decoded.organization_id }, 'Socket.IO client authenticated');
        next();
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        log.warn({ socketId: socket.id, error: errorMessage }, 'Socket.IO authentication failed');
        // Reject connection with invalid token
        next(new Error('Authentication failed: Invalid or expired token'));
      }
    });

    // Socket.IO connection handling
    io.on('connection', (socket: AuthenticatedSocket) => {
      const authStatus = socket.data.authenticated ? 'authenticated' : 'unauthenticated';
      log.info({ socketId: socket.id, authStatus }, 'Socket.IO client connected');

      // Feature #201: Join organization room with authorization check
      socket.on('join-org', (orgId: string) => {
        // If authenticated, verify the user belongs to this organization
        if (socket.data.authenticated && socket.data.organizationId !== orgId) {
          log.warn({ socketId: socket.id, requestedOrgId: orgId, userOrgId: socket.data.organizationId }, 'Socket.IO client tried to join unauthorized org');
          socket.emit('error', { message: 'Unauthorized: You do not belong to this organization' });
          return;
        }

        socket.join(`org:${orgId}`);
        log.debug({ socketId: socket.id, orgId }, 'Socket.IO client joined org room');
      });

      // Feature #219: Join specific test run room with auth check
      // Feature #388: Organization membership check to prevent cross-org data leakage
      socket.on('join-run', async (runId: string) => {
        if (!socket.data.authenticated) {
          socket.emit('error', { message: 'Authentication required to join run rooms' });
          return;
        }

        // Feature #388: Verify the run belongs to the user's organization
        try {
          const run = await getTestRun(runId);
          if (!run) {
            socket.emit('error', { message: 'Test run not found' });
            return;
          }

          if (run.organization_id !== socket.data.organizationId) {
            log.info({ socketId: socket.id, runId, userOrgId: socket.data.organizationId, runOrgId: run.organization_id }, 'Socket.IO client denied access to run - org mismatch');
            socket.emit('error', { message: 'Access denied - test run belongs to a different organization' });
            return;
          }
        } catch (error) {
          log.error({ socketId: socket.id, runId, error }, 'Socket.IO error checking run ownership');
          socket.emit('error', { message: 'Failed to verify run ownership' });
          return;
        }

        socket.join(`run:${runId}`);
        log.debug({ socketId: socket.id, runId }, 'Socket.IO client joined run room');
      });

      // Feature #219: Leave test run room (auth implicitly required since only authenticated clients can connect)
      socket.on('leave-run', (runId: string) => {
        socket.leave(`run:${runId}`);
        log.debug({ socketId: socket.id, runId }, 'Socket.IO client left run room');
      });

      // Feature #426: Join quick test room for real-time wave updates
      // Feature #461: Organization membership check to prevent cross-org data leakage
      socket.on('join-quick-test', async (runId: string) => {
        if (!socket.data.authenticated) {
          socket.emit('error', { message: 'Authentication required to join quick-test rooms' });
          return;
        }

        // Feature #461: Verify the quick test belongs to the user's organization
        // Feature #BMAD: Reject join if record not found — the DB record is created
        // BEFORE the job is queued, so a missing record means the runId is invalid.
        try {
          const result = await getQuickTestResultAsync(runId);
          if (!result) {
            log.warn({ socketId: socket.id, runId }, 'Socket.IO client denied access to quick-test - record not found');
            socket.emit('error', { message: 'Quick test not found' });
            return;
          }

          if (result.orgId && result.orgId !== socket.data.organizationId) {
            log.info({ socketId: socket.id, runId, userOrgId: socket.data.organizationId, runOrgId: result.orgId }, 'Socket.IO client denied access to quick-test - org mismatch');
            socket.emit('error', { message: 'Access denied - quick test belongs to a different organization' });
            return;
          }
        } catch (error) {
          log.error({ socketId: socket.id, runId, error }, 'Socket.IO error checking quick-test ownership');
          socket.emit('error', { message: 'Failed to verify quick-test ownership' });
          return;
        }

        socket.join(`quick-test:${runId}`);
        log.debug({ socketId: socket.id, runId }, 'Socket.IO client joined quick-test room');
      });

      // Feature #426: Leave quick test room
      socket.on('leave-quick-test', (runId: string) => {
        socket.leave(`quick-test:${runId}`);
        log.debug({ socketId: socket.id, runId }, 'Socket.IO client left quick-test room');
      });

      // Feature #167: Heartbeat ping/pong for connection health monitoring
      socket.on('ping', () => {
        socket.emit('pong');
      });

      socket.on('disconnect', () => {
        log.debug({ socketId: socket.id }, 'Socket.IO client disconnected');
      });
    });

    // Share Socket.IO instance with test-runs module, services status, recording, health, and WebSocket events
    setSocketIO(io);
    setServicesSocketIO(io);
    setRecordingSocketIO(io);
    setHealthSocketIO(io); // Feature #359: Health check routes need Socket.IO status
    setWebSocketIO(io); // Feature #108: WebSocket CRUD events

    // Feature #200: Initialize Redis event subscriber for worker events
    // This allows worker containers to publish events via Redis Pub/Sub
    // and have them forwarded to Socket.IO clients
    const redisEventsInitialized = await initializeEventSubscriber(io);
    if (redisEventsInitialized) {
      log.info('Redis event subscriber initialized - worker events will be forwarded to Socket.IO');
    } else {
      log.info('Redis event subscriber not available - worker events will not be forwarded');
    }

    // Feature #154: Initialize data retention cleanup job
    initializeCleanupJob();

    // Feature #684: Initialize quick test cron scheduler
    initializeQuickTestScheduler();

    // Feature #870: Initialize suite schedule executor
    initializeSuiteScheduleExecutor();

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

    // Phase 3A: Initialize AI router at startup so it's ready for first request
    if (aiConfigured) {
      const initResult = aiRouter.reinitializeFromEnv();
      log.info({ initialized: initResult }, 'AI Router startup initialization');
    }

    log.info({
      port,
      docsUrl: `http://localhost:${port}/api/docs`,
      healthUrl: `http://localhost:${port}/health`,
      database: dbStatus,
      aiProvider: mcpStatus,
      environment: process.env.NODE_ENV || 'development',
    }, `QA Guardian API Server started at http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Feature #164: Graceful shutdown function used by error handlers
async function gracefulShutdown(): Promise<void> {
  log.info('Closing connections gracefully...');
  stopCleanupJob(); // Feature #154: Stop cleanup job
  stopQuickTestScheduler(); // Feature #684: Stop quick test scheduler
  stopSuiteScheduleExecutor(); // Feature #870: Stop suite schedule executor
  shutdownQuickTestTimers(); // Feature #BMAD: Clear quick test TTL timers
  await shutdownExecutionQueue(); // Feature #155: Stop execution queue
  await shutdownWebhookQueue(); // Feature #320: Stop webhook queue
  await closeSubscriber(); // Feature #200: Close Redis event subscriber
  await closeWebhookPubSub(); // Feature #372: Close webhook Pub/Sub connections
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
  log.info('All connections closed');
}

// Feature #164: Initialize global error handlers BEFORE starting server
initializeErrorHandlers(gracefulShutdown);

start();

// Graceful shutdown on signals
process.on('SIGTERM', async () => {
  log.info('SIGTERM received, initiating shutdown...');
  await gracefulShutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  log.info('SIGINT received, initiating shutdown...');
  await gracefulShutdown();
  process.exit(0);
});

export default app;
