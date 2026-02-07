/**
 * Feature #359: Health check routes
 * Extracted from index.ts to reduce monolithic file size
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { isDatabaseConnected, healthCheck as dbHealthCheck } from '../services/database.js';
import { getCache } from '../services/cache.js';
import { authenticate } from '../middleware/auth.js';
import { getCleanupStats } from '../jobs/cleanup.js';
import { getQueueHealth } from '../services/execution-queue.js';
import { getWebhookQueueHealth } from '../services/webhook-queue.js';
import { getMigrationStatus } from '../services/migrations.js';
import { getErrorMetrics } from '../services/error-tracking.js';
import { getMetricsSummary } from '../services/metrics.js';
import {
  checkDiskSpace,
  getVersionInfo,
  getBackupStatus,
  getMemoryUsage,
  ensureFilesystemDirectories,
} from '../services/health-checks.js';

// Socket.IO instance reference - set via setHealthSocketIO
let io: any = null;

/**
 * Set the Socket.IO instance for health checks
 */
export function setHealthSocketIO(socketIO: any): void {
  io = socketIO;
}

/**
 * Register health check routes
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  // Feature #205: Lightweight health check for Docker/Kubernetes health probes
  // Returns simple status without exposing sensitive system information
  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
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
  app.get('/health/detailed', { preHandler: [authenticate] }, async (_request: FastifyRequest, reply: FastifyReply) => {
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
    const memoryUsage = getMemoryUsage();

    // Feature #152: Get application version and build info
    const versionInfo = getVersionInfo();

    const checks = {
      server: true,
      socketio: io !== null,
      filesystem: ensureFilesystemDirectories(),
      database: dbCheck.status === 'ok',
      cache: cacheStats.redisConnected || cacheStats.memoryCacheSize >= 0, // Always true with fallback
      diskSpace: diskSpace.healthy,
    };

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
  app.get('/api/v1/metrics', { preHandler: [authenticate] }, async (_request: FastifyRequest, _reply: FastifyReply) => {
    return getMetricsSummary();
  });
}

export default healthRoutes;
