// CRITICAL: Load environment variables FIRST before any imports that use process.env
// This ensures AI providers get their API keys during initialization
import dotenv from 'dotenv';
dotenv.config();

import Fastify from 'fastify';
import { initializeDatabase, isDatabaseConnected, healthCheck as dbHealthCheck, closeDatabase } from './services/database';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { Server as SocketIOServer } from 'socket.io';
import { authRoutes } from './routes/auth';
import { organizationRoutes } from './routes/organizations';
import { projectRoutes } from './routes/projects';
import { apiKeyRoutes } from './routes/api-keys';
import { testRunRoutes, setSocketIO } from './routes/test-runs';
import { testSuiteRoutes } from './routes/test-suites';
import { scheduleRoutes } from './routes/schedules';
import { auditLogRoutes } from './routes/audit-logs';
import { githubRoutes } from './routes/github'; // Feature #1542: AI best practices routes
import { sastRoutes } from './routes/sast';
import { dastRoutes } from './routes/dast';
import { monitoringRoutes } from './routes/monitoring';
import aiTestGeneratorRoutes from './routes/ai-test-generator';
import mcpToolsRoutes from './routes/mcp-tools';
import { reportsRoutes } from './routes/reports'; // Feature #1732
import { servicesStatusRoutes, setServicesSocketIO } from './routes/services-status'; // Feature #2127

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

const app = Fastify({
  logger: true,
});

// Register plugins
async function registerPlugins() {
  // CORS - Allow multiple origins for development and production
  const allowedOrigins = [
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
  console.log('CORS allowed origins:', allowedOrigins);

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

  // JWT Authentication
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
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
app.get('/health', async () => {
  const fs = require('fs');
  const path = require('path');

  // Check database health
  const dbCheck = await dbHealthCheck();

  const checks = {
    server: true,
    socketio: io !== null,
    filesystem: true,
    database: dbCheck.status === 'ok',
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

  // Database is optional - don't require it for health status
  const criticalChecks = { server: checks.server, socketio: checks.socketio, filesystem: checks.filesystem };
  const allCriticalHealthy = Object.values(criticalChecks).every(Boolean);

  return {
    status: allCriticalHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
    database: {
      connected: isDatabaseConnected(),
      latency: dbCheck.latency,
      error: dbCheck.error,
    },
    version: '1.0.0',
    uptime: process.uptime(),
  };
});

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
    } else {
      console.log('[Startup] Using in-memory storage - data will NOT persist across restarts');
    }

    await registerPlugins();

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

      socket.on('disconnect', () => {
        console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
      });
    });

    // Share Socket.IO instance with test-runs module and services status
    setSocketIO(io);
    setServicesSocketIO(io);

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

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Shutdown] SIGTERM received, closing connections...');
  await closeDatabase();
  await app.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Shutdown] SIGINT received, closing connections...');
  await closeDatabase();
  await app.close();
  process.exit(0);
});

export default app;
