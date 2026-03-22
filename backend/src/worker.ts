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
import { initializeDatabase, closeDatabase } from './services/database.js'; // Feature #169: Worker needs DB access for run lookup
import { createLogger } from './services/logger.js'; // Feature #447: Structured logging
import { initializeWebhookSubscriptionsFromDb, initializeWebhookPubSub, closeWebhookPubSub } from './routes/test-runs/webhooks.js'; // Worker needs webhook subscriptions for delivery

// Feature #447: Worker logger for execution and lifecycle logging
const log = createLogger('worker');

// ============================================================================
// Configuration
// ============================================================================

const QUEUE_NAME = 'test-execution';
const QUICK_TEST_QUEUE_NAME = 'quick-test-execution';
const MAX_CONCURRENCY = parseInt(process.env.EXECUTION_MAX_CONCURRENCY || '2', 10);
const QUICK_TEST_CONCURRENCY = 2; // Quick tests are lighter weight than full test runs
const JOB_TIMEOUT = parseInt(process.env.EXECUTION_JOB_TIMEOUT || '600000', 10); // 10 minutes
const QUICK_TEST_TIMEOUT = 300000; // 5 minutes - 7 waves max ~4 min total
const JOB_RETRY_ATTEMPTS = parseInt(process.env.EXECUTION_RETRY_ATTEMPTS || '3', 10);

log.info({ maxConcurrency: MAX_CONCURRENCY, jobTimeoutMs: JOB_TIMEOUT }, 'Starting QA Guardian Test Execution Worker');

// ============================================================================
// Redis Connection
// ============================================================================

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisPassword = process.env.REDIS_PASSWORD;

let redisOptions: { host: string; port: number; maxRetriesPerRequest: null; password?: string };
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
  log.error({ error: err }, 'Invalid REDIS_URL');
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

interface QuickTestJobData {
  runId: string;
  url: string;
  orgId: string;
  userId: string;
  browser: 'chromium' | 'firefox' | 'webkit';
}

// ============================================================================
// Test Execution Logic Import
// ============================================================================

// Import the actual test execution function from test-runs module
// This is dynamically imported to ensure all dependencies are loaded
let runTestsForRun: (runId: string) => Promise<void>;

// Import the quick test execution function from quick-test-runner module
// Dynamically imported like runTestsForRun to ensure all dependencies are loaded
let runQuickTest: (request: { url: string; runId: string; orgId: string; userId: string; browser?: 'chromium' | 'firefox' | 'webkit' }) => Promise<void>;

async function loadExecutionModule(): Promise<void> {
  try {
    // Dynamic import of the test-runs module
    const testRunsModule = await import('./routes/test-runs.js');
    runTestsForRun = testRunsModule.runTestsForRun;
    log.info('Test execution module loaded successfully');
  } catch (err) {
    log.error({ error: err }, 'Failed to load test execution module');
    process.exit(1);
  }

  try {
    // Dynamic import of the quick-test-runner module
    const quickTestModule = await import('./services/quick-test-runner.js');
    runQuickTest = quickTestModule.runQuickTest;
    log.info('Quick test execution module loaded successfully');
  } catch (err) {
    log.error({ error: err }, 'Failed to load quick test execution module');
    process.exit(1);
  }
}

// ============================================================================
// Worker Setup
// ============================================================================

let worker: Worker | null = null;
let quickTestWorker: Worker | null = null;
let isShuttingDown = false;

// Phase 2C: Periodic zombie run cleanup interval reference
let zombieCleanupInterval: ReturnType<typeof setInterval> | null = null;
const ZOMBIE_CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const ZOMBIE_STALE_MINUTES = 30; // Runs stuck for 30+ minutes are considered zombies

async function startWorker(): Promise<void> {
  // Feature #169: Initialize PostgreSQL connection - worker needs DB access
  // to look up test runs, tests, suites, and persist results
  const dbConnected = await initializeDatabase();
  if (dbConnected) {
    log.info('PostgreSQL database connected');
  } else {
    log.error('PostgreSQL database NOT connected - worker cannot look up runs');
    process.exit(1);
  }

  // Feature #BMAD: Clean up zombie runs from previous lifecycle before processing new jobs.
  // Runs stuck in 'running' or 'cancelling' are orphans from the previous container.
  try {
    const { cleanupZombieRuns } = await import('./services/repositories/test-runs.js');
    const cleaned = await cleanupZombieRuns();
    if (cleaned > 0) {
      log.warn({ count: cleaned }, 'Cleaned up zombie runs from previous container lifecycle');
    }
  } catch (err) {
    log.error({ error: err }, 'Failed to run zombie cleanup - continuing startup');
  }

  // Feature #200: Initialize Redis event publisher BEFORE loading execution module
  // This allows emitRunEvent() to publish events via Redis Pub/Sub
  const publisherInitialized = await initializeEventPublisher();
  if (publisherInitialized) {
    log.info('Redis event publisher initialized - real-time events will be forwarded to API server');
  } else {
    log.warn('Redis event publisher not available - real-time events will be silently dropped');
  }

  // Initialize webhook subscriptions from DB so webhooks fire after run completion
  try {
    await initializeWebhookSubscriptionsFromDb();
    log.info('Webhook subscriptions loaded from database');
    const pubSubReady = await initializeWebhookPubSub();
    if (pubSubReady) {
      log.info('Webhook Pub/Sub initialized - cache invalidation active');
    }
  } catch (err) {
    log.warn({ error: err }, 'Webhook initialization failed - webhooks may not fire');
  }

  // Load execution module after event publisher is ready
  await loadExecutionModule();

  log.info('Creating BullMQ worker...');

  worker = new Worker<ExecutionJobData>(
    QUEUE_NAME,
    async (job: Job<ExecutionJobData>) => {
      const { runId, testType } = job.data;
      log.info({ jobId: job.id, runId, testType }, 'Processing job');

      const startTime = Date.now();

      // Phase 2B: Extend BullMQ lock every 2 minutes to prevent long-running suites
      // from being marked as stalled. The default lockDuration is 10 minutes, so
      // extending every 2 minutes provides a comfortable safety margin.
      const LOCK_EXTEND_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
      const lockExtender = setInterval(async () => {
        try {
          if (job.token) {
            await job.extendLock(job.token, JOB_TIMEOUT);
            log.debug({ jobId: job.id, runId }, 'Extended job lock');
          }
        } catch (err) {
          log.warn({ jobId: job.id, runId, error: err instanceof Error ? err.message : String(err) },
            'Failed to extend job lock - job may be marked as stalled');
        }
      }, LOCK_EXTEND_INTERVAL_MS);

      try {
        // Execute the test run
        await runTestsForRun(runId);

        const durationSec = Math.round((Date.now() - startTime) / 1000);
        log.info({ jobId: job.id, runId, durationSec }, 'Job completed successfully');
      } catch (err: unknown) {
        const durationSec = Math.round((Date.now() - startTime) / 1000);
        log.error({ jobId: job.id, runId, durationSec, error: err instanceof Error ? err.message : String(err) }, 'Job failed');
        throw err; // Re-throw for BullMQ retry handling
      } finally {
        // Phase 2B: Always clear the lock extender interval
        clearInterval(lockExtender);
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
    log.debug({ jobId: job.id }, 'Job completed');
  });

  // Feature #BMAD: Dead-letter detection for permanently failed jobs
  // Defense-in-depth: runTestsForRun handles most errors internally, but this catches
  // edge cases (run not found, import failures, stalled job removal)
  worker.on('failed', async (job, err) => {
    try {
      // BullMQ can pass job=undefined for stalled jobs removed by removeOnFail
      if (!job) {
        log.fatal({ error: err.message }, 'JOB PERMANENTLY FAILED - stalled job removed (no job reference)');
        return;
      }

      const maxAttempts = job.opts?.attempts ?? JOB_RETRY_ATTEMPTS;
      const isExhausted = job.attemptsMade >= maxAttempts;

      if (isExhausted) {
        log.fatal({
          jobId: job.id,
          runId: job.data?.runId,
          attempts: job.attemptsMade,
          maxAttempts,
          error: err.message,
        }, 'JOB PERMANENTLY FAILED - all retries exhausted');

        // Update run status in DB to 'error' so UI doesn't show "running" forever
        if (job.data?.runId) {
          try {
            const { updateTestRun } = await import('./services/repositories/test-runs.js');
            await updateTestRun(job.data.runId, { status: 'error', error: `Job permanently failed after ${job.attemptsMade} attempts: ${err.message}` });
          } catch (dbErr) {
            log.error({ runId: job.data.runId, error: dbErr instanceof Error ? dbErr.message : String(dbErr) }, 'Failed to update run status after exhausted retries');
          }
        }
      } else {
        log.warn({
          jobId: job.id,
          runId: job.data?.runId,
          attempt: job.attemptsMade,
          maxAttempts,
          error: err.message,
        }, 'Job failed - will retry');
      }
    } catch (handlerErr) {
      log.error({ error: handlerErr instanceof Error ? handlerErr.message : String(handlerErr) }, 'Error in failed-job handler');
    }
  });

  worker.on('error', (err) => {
    log.error({ error: err }, 'Worker error');
  });

  worker.on('stalled', (jobId) => {
    log.warn({ jobId }, 'Job stalled - may need investigation');
  });

  worker.on('ready', () => {
    log.info({ queueName: QUEUE_NAME }, 'Worker ready and listening for jobs');
  });

  worker.on('closing', () => {
    log.info('Worker closing...');
  });

  worker.on('closed', () => {
    log.info('Worker closed');
  });

  // Phase 2C: Start periodic zombie run cleanup every 15 minutes.
  // This catches runs that get stuck in 'running' state due to Chromium crashes,
  // memory leaks, or other unforeseen issues that the per-test timeout didn't catch.
  zombieCleanupInterval = setInterval(async () => {
    if (isShuttingDown) return;
    try {
      const { cleanupStaleRunningRuns } = await import('./services/repositories/test-runs.js');
      const cleaned = await cleanupStaleRunningRuns(ZOMBIE_STALE_MINUTES);
      if (cleaned > 0) {
        log.warn({ count: cleaned, staleMinutes: ZOMBIE_STALE_MINUTES },
          'Periodic zombie cleanup: cleaned up stale running runs');
      }
    } catch (err) {
      log.error({ error: err instanceof Error ? err.message : String(err) },
        'Periodic zombie cleanup failed');
    }
  }, ZOMBIE_CLEANUP_INTERVAL_MS);
  log.info({ intervalMinutes: ZOMBIE_CLEANUP_INTERVAL_MS / 60000, staleThresholdMinutes: ZOMBIE_STALE_MINUTES },
    'Periodic zombie run cleanup scheduled');

  // ============================================================================
  // Quick Test Worker (separate queue, higher concurrency, shorter timeout)
  // ============================================================================

  log.info({ concurrency: QUICK_TEST_CONCURRENCY, timeoutMs: QUICK_TEST_TIMEOUT }, 'Creating Quick Test BullMQ worker...');

  quickTestWorker = new Worker<QuickTestJobData>(
    QUICK_TEST_QUEUE_NAME,
    async (job: Job<QuickTestJobData>) => {
      const { runId, url, orgId, userId, browser } = job.data;
      log.info({ jobId: job.id, runId, url, browser }, 'Processing quick test job');

      const startTime = Date.now();

      try {
        await runQuickTest({ url, runId, orgId, userId, browser });

        const durationSec = Math.round((Date.now() - startTime) / 1000);
        log.info({ jobId: job.id, runId, durationSec }, 'Quick test job completed successfully');
      } catch (err: unknown) {
        const durationSec = Math.round((Date.now() - startTime) / 1000);
        log.error({ jobId: job.id, runId, durationSec, error: err instanceof Error ? err.message : String(err) }, 'Quick test job failed');
        throw err; // Re-throw for BullMQ retry handling
      }
    },
    {
      connection: redisOptions,
      concurrency: QUICK_TEST_CONCURRENCY,
      lockDuration: QUICK_TEST_TIMEOUT,
      stalledInterval: 60000,
      maxStalledCount: 2,
    }
  );

  // Quick Test worker event handlers
  quickTestWorker.on('completed', (job) => {
    log.debug({ jobId: job.id, queue: QUICK_TEST_QUEUE_NAME }, 'Quick test job completed');
  });

  quickTestWorker.on('failed', async (job, err) => {
    try {
      if (!job) {
        log.fatal({ error: err.message, queue: QUICK_TEST_QUEUE_NAME }, 'QUICK TEST JOB PERMANENTLY FAILED - stalled job removed');
        return;
      }

      const maxAttempts = job.opts?.attempts ?? 2;
      const isExhausted = job.attemptsMade >= maxAttempts;

      if (isExhausted) {
        log.fatal({
          jobId: job.id,
          runId: job.data?.runId,
          attempts: job.attemptsMade,
          maxAttempts,
          error: err.message,
        }, 'QUICK TEST JOB PERMANENTLY FAILED - all retries exhausted');

        // Mark the quick test as failed in DB so UI doesn't show "running" forever
        if (job.data?.runId) {
          try {
            const { completeQuickTestResult } = await import('./services/repositories/quick-test.js');
            await completeQuickTestResult(job.data.runId, 'failed', [], null);
          } catch (dbErr) {
            log.error({ runId: job.data.runId, error: dbErr instanceof Error ? dbErr.message : String(dbErr) },
              'Failed to mark quick test as failed after exhausted retries');
          }
        }
      } else {
        log.warn({
          jobId: job.id,
          runId: job.data?.runId,
          attempt: job.attemptsMade,
          maxAttempts,
          error: err.message,
        }, 'Quick test job failed - will retry');
      }
    } catch (handlerErr) {
      log.error({ error: handlerErr instanceof Error ? handlerErr.message : String(handlerErr) },
        'Error in quick test failed-job handler');
    }
  });

  quickTestWorker.on('error', (err) => {
    log.error({ error: err, queue: QUICK_TEST_QUEUE_NAME }, 'Quick test worker error');
  });

  quickTestWorker.on('stalled', (jobId) => {
    log.warn({ jobId, queue: QUICK_TEST_QUEUE_NAME }, 'Quick test job stalled - may need investigation');
  });

  quickTestWorker.on('ready', () => {
    log.info({ queueName: QUICK_TEST_QUEUE_NAME }, 'Quick test worker ready and listening for jobs');
  });
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    log.info('Already shutting down...');
    return;
  }

  isShuttingDown = true;
  log.info({ signal }, 'Received shutdown signal, initiating graceful shutdown...');

  // Phase 2C: Clear zombie cleanup interval before closing worker
  if (zombieCleanupInterval) {
    clearInterval(zombieCleanupInterval);
    zombieCleanupInterval = null;
    log.info('Periodic zombie cleanup interval cleared');
  }

  // Close workers (waits for current jobs to finish)
  if (worker) {
    log.info('Closing test execution worker (waiting for active jobs)...');
    try {
      await worker.close();
      log.info('Test execution worker closed successfully');
    } catch (err) {
      log.error({ error: err }, 'Error closing test execution worker');
    }
  }

  if (quickTestWorker) {
    log.info('Closing quick test worker (waiting for active jobs)...');
    try {
      await quickTestWorker.close();
      log.info('Quick test worker closed successfully');
    } catch (err) {
      log.error({ error: err }, 'Error closing quick test worker');
    }
  }

  // Close webhook Pub/Sub connections
  await closeWebhookPubSub();

  // Feature #200: Close Redis event publisher
  await closePublisher();

  // Feature #169: Close database connection
  await closeDatabase();

  log.info('Shutdown complete');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  log.error({ error: err }, 'Uncaught exception');
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  log.error({ promise, reason }, 'Unhandled rejection');
  // Don't shutdown for unhandled rejections, just log
});

// ============================================================================
// Health Check Server (optional, for container health checks)
// ============================================================================

const HEALTH_PORT = parseInt(process.env.WORKER_HEALTH_PORT || '3002', 10);

const healthServer = createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    const isHealthy = worker !== null && quickTestWorker !== null && !isShuttingDown;
    res.writeHead(isHealthy ? 200 : 503);
    res.end(JSON.stringify({
      status: isHealthy ? 'healthy' : 'unhealthy',
      worker: worker !== null,
      quickTestWorker: quickTestWorker !== null,
      shuttingDown: isShuttingDown,
      maxConcurrency: MAX_CONCURRENCY,
      quickTestConcurrency: QUICK_TEST_CONCURRENCY,
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
  log.info({ nodeVersion: process.version, pid: process.pid }, 'QA Guardian Test Execution Worker starting');

  // Start the worker
  await startWorker();

  // Start health check server
  healthServer.listen(HEALTH_PORT, () => {
    log.info({ healthEndpoint: `http://localhost:${HEALTH_PORT}/health` }, 'Health check server started');
  });

  log.info('Worker is running and waiting for jobs');
}

main().catch((err) => {
  log.fatal({ error: err }, 'Fatal error during startup');
  process.exit(1);
});
