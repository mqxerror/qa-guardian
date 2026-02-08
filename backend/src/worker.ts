/**
 * QA Guardian - Test Execution Worker
 * ====================================
 * Feature #169: Separate test execution into worker container
 *
 * This is a standalone entry point that runs ONLY the BullMQ worker for
 * processing test execution jobs. It does NOT start the Fastify HTTP server.
 *
 * Why separate?
 * - Chromium OOM in test execution can kill the process
 * - If worker crashes, API server remains responsive for all users
 * - Worker can be scaled horizontally with multiple replicas
 * - Better resource isolation (worker gets dedicated memory for Chromium)
 *
 * Usage:
 *   npm run start:worker  # Production
 *   npm run dev:worker    # Development
 *
 * Required Environment Variables:
 *   - DATABASE_URL: PostgreSQL connection string
 *   - REDIS_URL: Redis connection string (for BullMQ)
 *   - EXECUTION_MAX_CONCURRENCY: Max parallel test executions (default: 2)
 */

import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { createServer } from 'http';
import { initializeEventPublisher, closePublisher, isPublisherAvailable } from './services/redis-events.js'; // Feature #200: Redis Pub/Sub for real-time events

// ============================================================================
// Configuration
// ============================================================================

const QUEUE_NAME = 'test-execution';
const MAX_CONCURRENCY = parseInt(process.env.EXECUTION_MAX_CONCURRENCY || '2', 10);
const JOB_TIMEOUT = parseInt(process.env.EXECUTION_JOB_TIMEOUT || '600000', 10); // 10 minutes

console.log('[Worker] Starting QA Guardian Test Execution Worker');
console.log(`[Worker] Max Concurrency: ${MAX_CONCURRENCY}`);
console.log(`[Worker] Job Timeout: ${JOB_TIMEOUT}ms`);

// ============================================================================
// Redis Connection
// ============================================================================

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisPassword = process.env.REDIS_PASSWORD;

let redisOptions: any;
try {
  const url = new URL(redisUrl);
  redisOptions = {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    maxRetriesPerRequest: null, // Required by BullMQ
  };

  if (redisPassword) {
    redisOptions.password = redisPassword;
  } else if (url.password) {
    redisOptions.password = url.password;
  }
} catch (err) {
  console.error('[Worker] ERROR: Invalid REDIS_URL:', err);
  process.exit(1);
}

// ============================================================================
// Job Processing Types
// ============================================================================

interface ExecutionJobData {
  runId: string;
  testType: 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility';
  priority?: number;
  triggeredBy?: string;
  scheduledAt?: string;
}

// ============================================================================
// Test Execution Logic Import
// ============================================================================

// Import the actual test execution function from test-runs module
// This is dynamically imported to ensure all dependencies are loaded
let runTestsForRun: (runId: string) => Promise<void>;

async function loadExecutionModule(): Promise<void> {
  try {
    // Dynamic import of the test-runs module
    const testRunsModule = await import('./routes/test-runs.js');
    runTestsForRun = testRunsModule.runTestsForRun;
    console.log('[Worker] Test execution module loaded successfully');
  } catch (err) {
    console.error('[Worker] ERROR: Failed to load test execution module:', err);
    process.exit(1);
  }
}

// ============================================================================
// Worker Setup
// ============================================================================

let worker: Worker | null = null;
let isShuttingDown = false;

async function startWorker(): Promise<void> {
  // Feature #200: Initialize Redis event publisher BEFORE loading execution module
  // This allows emitRunEvent() to publish events via Redis Pub/Sub
  const publisherInitialized = await initializeEventPublisher();
  if (publisherInitialized) {
    console.log('[Worker] Redis event publisher initialized - real-time events will be forwarded to API server');
  } else {
    console.warn('[Worker] Redis event publisher not available - real-time events will be silently dropped');
  }

  // Load execution module after event publisher is ready
  await loadExecutionModule();

  console.log('[Worker] Creating BullMQ worker...');

  worker = new Worker<ExecutionJobData>(
    QUEUE_NAME,
    async (job: Job<ExecutionJobData>) => {
      const { runId, testType } = job.data;
      console.log(`[Worker] Processing job ${job.id} - Run: ${runId}, Type: ${testType}`);

      const startTime = Date.now();

      try {
        // Execute the test run
        await runTestsForRun(runId);

        const duration = Math.round((Date.now() - startTime) / 1000);
        console.log(`[Worker] Completed job ${job.id} - Run: ${runId} (${duration}s)`);
      } catch (err: unknown) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        console.error(`[Worker] Failed job ${job.id} - Run: ${runId} (${duration}s):`, err instanceof Error ? err.message : String(err));
        throw err; // Re-throw for BullMQ retry handling
      }
    },
    {
      connection: redisOptions,
      concurrency: MAX_CONCURRENCY,
      lockDuration: JOB_TIMEOUT,
      stalledInterval: 60000, // Check for stalled jobs every minute
      maxStalledCount: 2, // Allow 2 stall warnings before failing
    }
  );

  // Event handlers
  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[Worker] Job ${jobId} stalled - may need investigation`);
  });

  worker.on('ready', () => {
    console.log(`[Worker] Worker ready and listening for jobs on queue "${QUEUE_NAME}"`);
  });

  worker.on('closing', () => {
    console.log('[Worker] Worker closing...');
  });

  worker.on('closed', () => {
    console.log('[Worker] Worker closed');
  });
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    console.log('[Worker] Already shutting down...');
    return;
  }

  isShuttingDown = true;
  console.log(`[Worker] Received ${signal}, initiating graceful shutdown...`);

  // Close worker (waits for current jobs to finish)
  if (worker) {
    console.log('[Worker] Closing worker (waiting for active jobs)...');
    try {
      await worker.close();
      console.log('[Worker] Worker closed successfully');
    } catch (err) {
      console.error('[Worker] Error closing worker:', err);
    }
  }

  // Feature #200: Close Redis event publisher
  await closePublisher();

  console.log('[Worker] Shutdown complete');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('[Worker] Uncaught exception:', err);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Worker] Unhandled rejection at:', promise, 'reason:', reason);
  // Don't shutdown for unhandled rejections, just log
});

// ============================================================================
// Health Check Server (optional, for container health checks)
// ============================================================================

const HEALTH_PORT = parseInt(process.env.WORKER_HEALTH_PORT || '3002', 10);

const healthServer = createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    const isHealthy = worker !== null && !isShuttingDown;
    res.writeHead(isHealthy ? 200 : 503);
    res.end(JSON.stringify({
      status: isHealthy ? 'healthy' : 'unhealthy',
      worker: worker !== null,
      shuttingDown: isShuttingDown,
      maxConcurrency: MAX_CONCURRENCY,
      // Feature #200: Include Redis event publisher status
      redisEventPublisher: isPublisherAvailable(),
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  console.log('[Worker] ====================================');
  console.log('[Worker] QA Guardian Test Execution Worker');
  console.log('[Worker] ====================================');
  console.log(`[Worker] Node.js ${process.version}`);
  console.log(`[Worker] PID: ${process.pid}`);

  // Start the worker
  await startWorker();

  // Start health check server
  healthServer.listen(HEALTH_PORT, () => {
    console.log(`[Worker] Health endpoint: http://localhost:${HEALTH_PORT}/health`);
  });

  console.log('[Worker] ====================================');
  console.log('[Worker] Worker is running and waiting for jobs');
  console.log('[Worker] Press Ctrl+C to stop');
  console.log('[Worker] ====================================');
}

main().catch((err) => {
  console.error('[Worker] Fatal error during startup:', err);
  process.exit(1);
});
