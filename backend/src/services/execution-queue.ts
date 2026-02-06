/**
 * Feature #155: BullMQ Execution Queue for Test Runs
 *
 * Provides concurrency-limited test execution to prevent OOM conditions
 * when multiple tests are triggered simultaneously.
 *
 * Architecture:
 * - Uses BullMQ backed by Redis for job queue management
 * - Configurable max concurrency (default: 2 workers)
 * - Support for different test types (e2e, load, lighthouse, accessibility)
 * - Queue status exposed via health endpoint
 * - Job priority support for urgent runs
 */

import { Queue, Worker, Job, QueueEvents, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Test execution job data
 */
export interface ExecutionJobData {
  runId: string;
  testType: 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility';
  priority?: number; // Lower number = higher priority (default: 10)
  triggeredBy?: string;
  scheduledAt?: string;
}

/**
 * Queue statistics for health endpoint
 */
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  workerCount: number;
  maxConcurrency: number;
}

/**
 * Queue health status
 */
export interface QueueHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connected: boolean;
  stats: QueueStats;
  lastJobProcessed: string | null;
  uptime: number;
}

// ============================================================================
// Configuration
// ============================================================================

const QUEUE_NAME = 'test-execution';
const MAX_CONCURRENCY = parseInt(process.env.EXECUTION_MAX_CONCURRENCY || '2', 10);
const JOB_TIMEOUT = parseInt(process.env.EXECUTION_JOB_TIMEOUT || '600000', 10); // 10 minutes default
const JOB_RETRY_ATTEMPTS = parseInt(process.env.EXECUTION_RETRY_ATTEMPTS || '1', 10);

// Feature #169: When EXECUTION_MAX_CONCURRENCY=0, the API server only enqueues jobs
// and does NOT start a worker. A separate worker container handles execution.
const API_ONLY_MODE = MAX_CONCURRENCY === 0;

// ============================================================================
// Module State
// ============================================================================

let queue: Queue | null = null;
let worker: Worker | null = null;
let queueEvents: QueueEvents | null = null;
let connection: IORedis | null = null;
let isInitialized = false;
let lastJobProcessedAt: string | null = null;
let startedAt: Date | null = null;

// Callback for actual test execution (injected by test-runs module)
let executeTestRunCallback: ((runId: string) => Promise<void>) | null = null;

// ============================================================================
// Queue Initialization
// ============================================================================

/**
 * Initialize the execution queue with Redis connection
 */
export async function initializeExecutionQueue(): Promise<boolean> {
  if (isInitialized) {
    console.log('[ExecutionQueue] Already initialized');
    return true;
  }

  try {
    // Get Redis URL from environment
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisPassword = process.env.REDIS_PASSWORD;

    // Parse Redis URL
    const url = new URL(redisUrl);
    const redisOptions: any = {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      maxRetriesPerRequest: null, // Required by BullMQ
    };

    // Add password if configured
    if (redisPassword) {
      redisOptions.password = redisPassword;
    } else if (url.password) {
      redisOptions.password = url.password;
    }

    // Create Redis connection
    connection = new IORedis(redisOptions);

    // Test connection
    await connection.ping();
    console.log('[ExecutionQueue] Redis connection established');

    // Create queue
    queue = new Queue(QUEUE_NAME, {
      connection: redisOptions,
      defaultJobOptions: {
        attempts: JOB_RETRY_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5 seconds initial backoff
        },
        removeOnComplete: {
          count: 100, // Keep last 100 completed jobs
          age: 24 * 60 * 60, // Remove after 24 hours
        },
        removeOnFail: {
          count: 50, // Keep last 50 failed jobs
          age: 7 * 24 * 60 * 60, // Remove after 7 days
        },
      },
    });

    // Create queue events for monitoring
    queueEvents = new QueueEvents(QUEUE_NAME, { connection: redisOptions });

    // Feature #169: In API-only mode, skip worker creation
    // A separate worker container will handle job processing
    if (API_ONLY_MODE) {
      console.log('[ExecutionQueue] API-only mode (EXECUTION_MAX_CONCURRENCY=0) - worker NOT started');
      console.log('[ExecutionQueue] Jobs will be processed by separate worker container');
    } else {
      // Create worker with concurrency limit
      worker = new Worker(
        QUEUE_NAME,
        async (job: Job<ExecutionJobData>) => {
          console.log(`[ExecutionQueue] Processing job ${job.id} for run ${job.data.runId}`);

          if (!executeTestRunCallback) {
            throw new Error('Test execution callback not registered');
          }

          // Execute the test run
          await executeTestRunCallback(job.data.runId);

          lastJobProcessedAt = new Date().toISOString();
          console.log(`[ExecutionQueue] Completed job ${job.id} for run ${job.data.runId}`);
        },
        {
          connection: redisOptions,
          concurrency: MAX_CONCURRENCY,
          lockDuration: JOB_TIMEOUT,
        }
      );

      // Set up event handlers
      worker.on('completed', (job) => {
        console.log(`[ExecutionQueue] Job ${job.id} completed successfully`);
      });

      worker.on('failed', (job, err) => {
        console.error(`[ExecutionQueue] Job ${job?.id} failed:`, err.message);
      });

      worker.on('error', (err) => {
        console.error('[ExecutionQueue] Worker error:', err);
      });
    }

    queueEvents.on('waiting', ({ jobId }) => {
      console.log(`[ExecutionQueue] Job ${jobId} is waiting`);
    });

    queueEvents.on('active', ({ jobId }) => {
      console.log(`[ExecutionQueue] Job ${jobId} is now active`);
    });

    startedAt = new Date();
    isInitialized = true;
    const modeStr = API_ONLY_MODE ? 'API-only (enqueue only)' : `max concurrency: ${MAX_CONCURRENCY}`;
    console.log(`[ExecutionQueue] Initialized - ${modeStr}`);

    return true;
  } catch (error) {
    console.error('[ExecutionQueue] Failed to initialize:', error);
    return false;
  }
}

/**
 * Register the test execution callback
 * This should be called by the test-runs module during startup
 */
export function registerExecutionCallback(callback: (runId: string) => Promise<void>): void {
  executeTestRunCallback = callback;
  console.log('[ExecutionQueue] Execution callback registered');
}

// ============================================================================
// Queue Operations
// ============================================================================

/**
 * Add a test run to the execution queue
 * @returns Job ID if queued successfully, null if queue not initialized
 */
export async function queueTestRun(
  runId: string,
  testType: ExecutionJobData['testType'] = 'e2e',
  options?: {
    priority?: number;
    triggeredBy?: string;
    delay?: number; // Delay in milliseconds before processing
  }
): Promise<string | null> {
  if (!queue || !isInitialized) {
    console.warn('[ExecutionQueue] Queue not initialized, executing directly');
    return null;
  }

  const jobData: ExecutionJobData = {
    runId,
    testType,
    priority: options?.priority || 10,
    triggeredBy: options?.triggeredBy,
    scheduledAt: new Date().toISOString(),
  };

  const jobOptions: JobsOptions = {
    priority: options?.priority || 10, // Lower number = higher priority
    jobId: `run-${runId}`, // Use run ID as job ID for deduplication
  };

  if (options?.delay) {
    jobOptions.delay = options.delay;
  }

  try {
    const job = await queue.add('execute-test', jobData, jobOptions);
    console.log(`[ExecutionQueue] Queued test run ${runId} with job ID ${job.id}`);
    return job.id || null;
  } catch (error) {
    console.error('[ExecutionQueue] Failed to queue test run:', error);
    return null;
  }
}

/**
 * Get the position of a job in the queue
 * @returns Position (1-based) or null if not in queue
 */
export async function getJobPosition(runId: string): Promise<number | null> {
  if (!queue) return null;

  try {
    const job = await queue.getJob(`run-${runId}`);
    if (!job) return null;

    const state = await job.getState();
    if (state === 'active') return 0; // Currently executing
    if (state !== 'waiting') return null;

    const waitingJobs = await queue.getWaiting();
    const index = waitingJobs.findIndex(j => j.id === job.id);
    return index >= 0 ? index + 1 : null;
  } catch (error) {
    console.error('[ExecutionQueue] Failed to get job position:', error);
    return null;
  }
}

/**
 * Cancel a queued job (if not yet active)
 * @returns true if cancelled, false otherwise
 */
export async function cancelQueuedJob(runId: string): Promise<boolean> {
  if (!queue) return false;

  try {
    const job = await queue.getJob(`run-${runId}`);
    if (!job) return false;

    const state = await job.getState();
    if (state === 'waiting' || state === 'delayed') {
      await job.remove();
      console.log(`[ExecutionQueue] Cancelled queued job for run ${runId}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[ExecutionQueue] Failed to cancel job:', error);
    return false;
  }
}

// ============================================================================
// Queue Status and Health
// ============================================================================

/**
 * Get current queue statistics
 */
export async function getQueueStats(): Promise<QueueStats | null> {
  if (!queue) return null;

  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    const isPaused = await queue.isPaused();

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
      workerCount: worker ? 1 : 0,
      maxConcurrency: MAX_CONCURRENCY,
    };
  } catch (error) {
    console.error('[ExecutionQueue] Failed to get stats:', error);
    return null;
  }
}

/**
 * Get queue health status for health endpoint
 */
export async function getQueueHealth(): Promise<QueueHealth> {
  if (!isInitialized || !queue) {
    return {
      status: 'unhealthy',
      connected: false,
      stats: {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: false,
        workerCount: 0,
        maxConcurrency: MAX_CONCURRENCY,
      },
      lastJobProcessed: null,
      uptime: 0,
    };
  }

  try {
    const stats = await getQueueStats();

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (!stats) {
      status = 'unhealthy';
    } else if (stats.paused) {
      status = 'degraded';
    } else if (stats.failed > stats.completed * 0.1 && stats.completed > 10) {
      // More than 10% failure rate with significant volume
      status = 'degraded';
    }

    return {
      status,
      connected: true,
      stats: stats || {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: false,
        workerCount: 0,
        maxConcurrency: MAX_CONCURRENCY,
      },
      lastJobProcessed: lastJobProcessedAt,
      uptime: startedAt ? Math.floor((Date.now() - startedAt.getTime()) / 1000) : 0,
    };
  } catch (error) {
    console.error('[ExecutionQueue] Failed to get health:', error);
    return {
      status: 'unhealthy',
      connected: false,
      stats: {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: false,
        workerCount: 0,
        maxConcurrency: MAX_CONCURRENCY,
      },
      lastJobProcessed: null,
      uptime: 0,
    };
  }
}

/**
 * Check if queue is ready to accept jobs
 */
export function isQueueReady(): boolean {
  if (API_ONLY_MODE) {
    return isInitialized && queue !== null;
  }
  return isInitialized && queue !== null && worker !== null;
}

// ============================================================================
// Queue Control
// ============================================================================

/**
 * Pause the execution queue
 */
export async function pauseQueue(): Promise<boolean> {
  if (!queue) return false;

  try {
    await queue.pause();
    console.log('[ExecutionQueue] Queue paused');
    return true;
  } catch (error) {
    console.error('[ExecutionQueue] Failed to pause queue:', error);
    return false;
  }
}

/**
 * Resume the execution queue
 */
export async function resumeQueue(): Promise<boolean> {
  if (!queue) return false;

  try {
    await queue.resume();
    console.log('[ExecutionQueue] Queue resumed');
    return true;
  } catch (error) {
    console.error('[ExecutionQueue] Failed to resume queue:', error);
    return false;
  }
}

/**
 * Gracefully shutdown the execution queue
 */
export async function shutdownExecutionQueue(): Promise<void> {
  console.log('[ExecutionQueue] Shutting down...');

  try {
    if (worker) {
      await worker.close();
      worker = null;
    }

    if (queueEvents) {
      await queueEvents.close();
      queueEvents = null;
    }

    if (queue) {
      await queue.close();
      queue = null;
    }

    if (connection) {
      await connection.quit();
      connection = null;
    }

    isInitialized = false;
    console.log('[ExecutionQueue] Shutdown complete');
  } catch (error) {
    console.error('[ExecutionQueue] Error during shutdown:', error);
  }
}

// ============================================================================
// Direct Execution Fallback
// ============================================================================

/**
 * Execute a test run directly (bypassing queue)
 * Used when queue is not available or for testing
 */
export async function executeDirectly(runId: string): Promise<void> {
  if (!executeTestRunCallback) {
    throw new Error('Test execution callback not registered');
  }

  console.log(`[ExecutionQueue] Executing run ${runId} directly (queue bypassed)`);
  await executeTestRunCallback(runId);
}

/**
 * Wrapper function to queue or execute directly based on queue availability
 * This is the main entry point that should be used by the test-runs module
 */
export async function enqueueOrExecute(
  runId: string,
  testType: ExecutionJobData['testType'] = 'e2e',
  options?: {
    priority?: number;
    triggeredBy?: string;
    delay?: number;
  }
): Promise<{ queued: boolean; jobId?: string; position?: number; error?: string }> {
  // Try to queue the job
  const jobId = await queueTestRun(runId, testType, options);

  if (jobId) {
    const position = await getJobPosition(runId);
    return { queued: true, jobId, position: position || undefined };
  }

  // In API-only mode, never execute directly - the whole point is to keep Chromium out of the API process
  if (API_ONLY_MODE) {
    console.error(`[ExecutionQueue] Queue unavailable in API-only mode, cannot execute run ${runId}. Is Redis running?`);
    return { queued: false, error: 'Queue unavailable - worker container required' };
  }

  // Queue not available, execute directly (only in non-API-only mode)
  console.log('[ExecutionQueue] Queue not available, executing directly');
  executeDirectly(runId).catch(err => {
    console.error(`[ExecutionQueue] Direct execution failed for run ${runId}:`, err);
  });

  return { queued: false };
}
