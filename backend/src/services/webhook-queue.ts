/**
 * Feature #320: BullMQ Webhook Queue Service
 *
 * Replaces in-memory Maps with Redis-backed BullMQ queue for reliable webhook delivery.
 * Ensures webhooks are not lost on server restart and supports distributed processing.
 *
 * Architecture:
 * - Uses BullMQ backed by Redis for job queue management
 * - Automatic exponential backoff retries (1s, 2s, 4s, 8s, 16s)
 * - Support for batch delivery
 * - Persistent delivery logs in Redis
 * - Graceful shutdown support
 */

import { Queue, Worker, Job, QueueEvents, JobsOptions } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import * as crypto from 'crypto';
import { validateWebhookURL, generateId } from '../utils/index.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Webhook delivery job data
 */
export interface WebhookJobData {
  subscriptionId: string;
  subscriptionName: string;
  url: string;
  payload: Record<string, unknown>;
  eventType: string;
  headers?: Record<string, string>;
  secret?: string;
  context?: {
    runId?: string;
    projectId?: string;
    testId?: string;
  };
  // Retry configuration
  maxRetries: number;
  retryEnabled: boolean;
  // Batch info
  isBatch?: boolean;
  batchCount?: number;
}

/**
 * Webhook delivery result
 */
export interface WebhookDeliveryResult {
  success: boolean;
  deliveryId: string;
  responseStatus?: number;
  responseBody?: string;
  error?: string;
  durationMs: number;
  attempts: number;
}

/**
 * Webhook delivery log entry (stored in Redis)
 */
export interface WebhookDeliveryLogEntry {
  id: string;
  subscriptionId: string;
  subscriptionName: string;
  eventType: string;
  url: string;
  status: 'success' | 'failed' | 'pending';
  responseStatus?: number;
  responseBody?: string;
  error?: string;
  durationMs: number;
  attempts: number;
  timestamp: string;
  completedAt?: string;
  context?: {
    runId?: string;
    projectId?: string;
    testId?: string;
  };
}

/**
 * Queue health status
 */
export interface WebhookQueueHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connected: boolean;
  stats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  };
  lastJobProcessed: string | null;
  uptime: number;
}

// ============================================================================
// Configuration
// ============================================================================

const QUEUE_NAME = 'webhook-delivery';
const MAX_CONCURRENCY = parseInt(process.env.WEBHOOK_MAX_CONCURRENCY || '5', 10);
const JOB_TIMEOUT = parseInt(process.env.WEBHOOK_JOB_TIMEOUT || '30000', 10); // 30 seconds default
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff delays
const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300; // 5 minutes for replay protection
const DELIVERY_LOG_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
const DELIVERY_LOG_PREFIX = 'webhook:log:';
// Feature #321: Auto-disable threshold - disable webhook after N consecutive failures
const AUTO_DISABLE_THRESHOLD = parseInt(process.env.WEBHOOK_AUTO_DISABLE_THRESHOLD || '10', 10);

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

// Feature #321: Callback result for auto-disable notification
export interface SubscriptionStatsResult {
  consecutiveFailures: number;
  autoDisabled: boolean;
  disableReason?: string;
}

// Callback for updating subscription stats (Feature #321: returns auto-disable status)
let updateSubscriptionStatsCallback: ((
  subscriptionId: string,
  success: boolean
) => Promise<SubscriptionStatsResult | void>) | null = null;

// Feature #321: Export threshold for use in webhooks.ts
export const WEBHOOK_AUTO_DISABLE_THRESHOLD = AUTO_DISABLE_THRESHOLD;

// ============================================================================
// Signature Functions
// ============================================================================

/**
 * Generate Stripe-style webhook signature
 * Format: t=timestamp,v1=hmac_signature
 */
export function generateWebhookSignature(payload: string, secret: string): { signature: string; timestamp: number } {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return {
    signature: `t=${timestamp},v1=${hmac}`,
    timestamp,
  };
}

// ============================================================================
// Queue Initialization
// ============================================================================

/**
 * Initialize the webhook queue with Redis connection
 */
export async function initializeWebhookQueue(): Promise<boolean> {
  if (isInitialized) {
    console.log('[WebhookQueue] Already initialized');
    return true;
  }

  try {
    // Get Redis URL from environment
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisPassword = process.env.REDIS_PASSWORD;

    // Parse Redis URL
    const url = new URL(redisUrl);
    const redisOptions: {
      host: string;
      port: number;
      password?: string;
      maxRetriesPerRequest: null;
    } = {
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
    console.log('[WebhookQueue] Redis connection established');

    // Create queue
    queue = new Queue(QUEUE_NAME, {
      connection: redisOptions,
      defaultJobOptions: {
        attempts: 6, // Initial attempt + 5 retries
        backoff: {
          type: 'custom', // We'll handle backoff in the worker
        },
        removeOnComplete: {
          count: 1000, // Keep last 1000 completed jobs
          age: 24 * 60 * 60, // Remove after 24 hours
        },
        removeOnFail: {
          count: 500, // Keep last 500 failed jobs
          age: 7 * 24 * 60 * 60, // Remove after 7 days
        },
      },
    });

    // Create queue events for monitoring
    queueEvents = new QueueEvents(QUEUE_NAME, { connection: redisOptions });

    // Create worker with concurrency limit
    worker = new Worker(
      QUEUE_NAME,
      async (job: Job<WebhookJobData>) => {
        return processWebhookJob(job);
      },
      {
        connection: redisOptions,
        concurrency: MAX_CONCURRENCY,
        lockDuration: JOB_TIMEOUT,
      }
    );

    // Set up event handlers
    worker.on('completed', (job, result: WebhookDeliveryResult) => {
      lastJobProcessedAt = new Date().toISOString();
      console.log(`[WebhookQueue] Job ${job.id} completed: ${result.success ? 'success' : 'failed'}`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[WebhookQueue] Job ${job?.id} failed:`, err.message);
    });

    worker.on('error', (err) => {
      console.error('[WebhookQueue] Worker error:', err);
    });

    queueEvents.on('waiting', ({ jobId }) => {
      console.log(`[WebhookQueue] Job ${jobId} is waiting`);
    });

    queueEvents.on('active', ({ jobId }) => {
      console.log(`[WebhookQueue] Job ${jobId} is now active`);
    });

    startedAt = new Date();
    isInitialized = true;
    console.log(`[WebhookQueue] Initialized - max concurrency: ${MAX_CONCURRENCY}`);

    return true;
  } catch (error) {
    console.error('[WebhookQueue] Failed to initialize:', error);
    return false;
  }
}

/**
 * Register callback for updating subscription stats
 * Feature #321: Callback now returns auto-disable status
 */
export function registerSubscriptionStatsCallback(
  callback: (subscriptionId: string, success: boolean) => Promise<SubscriptionStatsResult | void>
): void {
  updateSubscriptionStatsCallback = callback;
  console.log('[WebhookQueue] Subscription stats callback registered');
}

// ============================================================================
// Job Processing
// ============================================================================

/**
 * Process a webhook delivery job
 */
async function processWebhookJob(job: Job<WebhookJobData>): Promise<WebhookDeliveryResult> {
  const { data } = job;
  const deliveryId = generateId('del', 7); // Feature #357: Use shared ID generator
  const startTime = Date.now();
  const attemptNumber = job.attemptsMade + 1;

  console.log(`[WebhookQueue] Processing job ${job.id} for ${data.subscriptionName} (attempt ${attemptNumber}/${data.maxRetries + 1})`);

  // SSRF protection - validate URL
  const ssrfValidation = validateWebhookURL(data.url);
  if (!ssrfValidation.safe) {
    const error = `SSRF protection: ${ssrfValidation.error}`;
    console.error(`[WebhookQueue] ${error}`);

    await logDelivery({
      id: `${deliveryId}_${attemptNumber}`,
      subscriptionId: data.subscriptionId,
      subscriptionName: data.subscriptionName,
      eventType: data.eventType,
      url: data.url,
      status: 'failed',
      error,
      durationMs: 0,
      attempts: attemptNumber,
      timestamp: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      context: data.context,
    });

    return {
      success: false,
      deliveryId,
      error,
      durationMs: 0,
      attempts: attemptNumber,
    };
  }

  // Prepare payload and headers
  const payloadJson = JSON.stringify(data.payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': data.eventType,
    'X-Webhook-Delivery': deliveryId,
    'X-Webhook-Attempt': String(attemptNumber),
    ...(data.headers || {}),
  };

  // Add HMAC signature if secret is configured
  if (data.secret) {
    const { signature } = generateWebhookSignature(payloadJson, data.secret);
    headers['X-Webhook-Signature'] = signature;
  }

  try {
    const response = await fetch(data.url, {
      method: 'POST',
      headers,
      body: payloadJson,
      signal: AbortSignal.timeout(JOB_TIMEOUT - 1000), // Leave 1s buffer
    });

    const durationMs = Date.now() - startTime;
    const responseBody = await response.text().catch(() => '');

    if (response.ok) {
      console.log(`[WebhookQueue] Successfully delivered ${data.eventType} to ${data.subscriptionName}`);

      // Update subscription stats
      if (updateSubscriptionStatsCallback) {
        await updateSubscriptionStatsCallback(data.subscriptionId, true);
      }

      await logDelivery({
        id: `${deliveryId}_${attemptNumber}`,
        subscriptionId: data.subscriptionId,
        subscriptionName: data.subscriptionName,
        eventType: data.eventType,
        url: data.url,
        status: 'success',
        responseStatus: response.status,
        responseBody: responseBody.substring(0, 1000),
        durationMs,
        attempts: attemptNumber,
        timestamp: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        context: data.context,
      });

      return {
        success: true,
        deliveryId,
        responseStatus: response.status,
        responseBody: responseBody.substring(0, 500),
        durationMs,
        attempts: attemptNumber,
      };
    }

    // Check if error is retriable (5xx errors)
    const isRetriable = response.status >= 500 && data.retryEnabled && attemptNumber <= data.maxRetries;
    const error = `HTTP ${response.status}: ${responseBody.substring(0, 200)}`;

    await logDelivery({
      id: `${deliveryId}_${attemptNumber}`,
      subscriptionId: data.subscriptionId,
      subscriptionName: data.subscriptionName,
      eventType: data.eventType,
      url: data.url,
      status: isRetriable ? 'pending' : 'failed',
      responseStatus: response.status,
      responseBody: responseBody.substring(0, 1000),
      error,
      durationMs,
      attempts: attemptNumber,
      timestamp: new Date().toISOString(),
      completedAt: isRetriable ? undefined : new Date().toISOString(),
      context: data.context,
    });

    if (isRetriable) {
      // Calculate backoff delay for retry
      const delay = RETRY_DELAYS[Math.min(attemptNumber - 1, RETRY_DELAYS.length - 1)];
      console.log(`[WebhookQueue] Retriable error, will retry in ${delay}ms`);
      throw new Error(`Retriable: ${error}`); // Throw to trigger BullMQ retry
    }

    // Update subscription stats for failure
    if (updateSubscriptionStatsCallback) {
      await updateSubscriptionStatsCallback(data.subscriptionId, false);
    }

    return {
      success: false,
      deliveryId,
      responseStatus: response.status,
      responseBody: responseBody.substring(0, 500),
      error,
      durationMs,
      attempts: attemptNumber,
    };
  } catch (error: unknown) {
    const err = error as Error;
    const durationMs = Date.now() - startTime;
    const isRetriable = data.retryEnabled && attemptNumber <= data.maxRetries;

    console.error(`[WebhookQueue] Error delivering to ${data.subscriptionName}: ${err.message}`);

    await logDelivery({
      id: `${deliveryId}_${attemptNumber}`,
      subscriptionId: data.subscriptionId,
      subscriptionName: data.subscriptionName,
      eventType: data.eventType,
      url: data.url,
      status: isRetriable ? 'pending' : 'failed',
      error: err.message,
      durationMs,
      attempts: attemptNumber,
      timestamp: new Date().toISOString(),
      completedAt: isRetriable ? undefined : new Date().toISOString(),
      context: data.context,
    });

    if (isRetriable && !err.message.startsWith('Retriable:')) {
      throw err; // Trigger BullMQ retry
    }

    // Update subscription stats for failure
    if (updateSubscriptionStatsCallback) {
      await updateSubscriptionStatsCallback(data.subscriptionId, false);
    }

    return {
      success: false,
      deliveryId,
      error: err.message,
      durationMs,
      attempts: attemptNumber,
    };
  }
}

// ============================================================================
// Queue Operations
// ============================================================================

/**
 * Add a webhook delivery to the queue
 */
export async function queueWebhookDelivery(
  subscriptionId: string,
  subscriptionName: string,
  url: string,
  payload: Record<string, unknown>,
  eventType: string,
  options?: {
    headers?: Record<string, string>;
    secret?: string;
    maxRetries?: number;
    retryEnabled?: boolean;
    context?: { runId?: string; projectId?: string; testId?: string };
    isBatch?: boolean;
    batchCount?: number;
  }
): Promise<{ queued: boolean; jobId?: string; error?: string }> {
  if (!queue || !isInitialized) {
    console.warn('[WebhookQueue] Queue not initialized');
    return { queued: false, error: 'Queue not initialized' };
  }

  const jobData: WebhookJobData = {
    subscriptionId,
    subscriptionName,
    url,
    payload,
    eventType,
    headers: options?.headers,
    secret: options?.secret,
    maxRetries: options?.maxRetries ?? 5,
    retryEnabled: options?.retryEnabled ?? true,
    context: options?.context,
    isBatch: options?.isBatch,
    batchCount: options?.batchCount,
  };

  const jobOptions: JobsOptions = {
    jobId: generateId(`webhook-${subscriptionId}`, 7), // Feature #357: Use shared ID generator
    attempts: (options?.maxRetries ?? 5) + 1,
    backoff: {
      type: 'custom',
      delay: RETRY_DELAYS[0], // Initial delay, worker handles exponential backoff
    },
  };

  try {
    const job = await queue.add('deliver', jobData, jobOptions);
    console.log(`[WebhookQueue] Queued webhook for ${subscriptionName} with job ID ${job.id}`);
    return { queued: true, jobId: job.id };
  } catch (error) {
    const err = error as Error;
    console.error('[WebhookQueue] Failed to queue webhook:', err);
    return { queued: false, error: err.message };
  }
}

// ============================================================================
// Delivery Logging (Redis-backed)
// ============================================================================

/**
 * Log a delivery attempt to Redis
 */
async function logDelivery(entry: WebhookDeliveryLogEntry): Promise<void> {
  if (!connection) return;

  try {
    const key = `${DELIVERY_LOG_PREFIX}${entry.subscriptionId}:${entry.id}`;
    await connection.setex(key, DELIVERY_LOG_TTL, JSON.stringify(entry));

    // Also add to a list for the subscription (for efficient querying)
    const listKey = `${DELIVERY_LOG_PREFIX}${entry.subscriptionId}:list`;
    await connection.lpush(listKey, entry.id);
    await connection.ltrim(listKey, 0, 999); // Keep last 1000 entries
    await connection.expire(listKey, DELIVERY_LOG_TTL);
  } catch (error) {
    console.error('[WebhookQueue] Failed to log delivery:', error);
  }
}

/**
 * Get delivery logs for a subscription
 */
export async function getWebhookDeliveryLogs(
  subscriptionId: string,
  options?: { limit?: number; offset?: number; status?: 'success' | 'failed' | 'pending' }
): Promise<{ logs: WebhookDeliveryLogEntry[]; total: number }> {
  if (!connection) {
    return { logs: [], total: 0 };
  }

  try {
    const listKey = `${DELIVERY_LOG_PREFIX}${subscriptionId}:list`;
    const offset = options?.offset || 0;
    const limit = options?.limit || 50;

    // Get log IDs from list
    const logIds = await connection.lrange(listKey, offset, offset + limit - 1);
    const total = await connection.llen(listKey);

    // Get log entries
    const logs: WebhookDeliveryLogEntry[] = [];
    for (const id of logIds) {
      const key = `${DELIVERY_LOG_PREFIX}${subscriptionId}:${id}`;
      const data = await connection.get(key);
      if (data) {
        const entry = JSON.parse(data) as WebhookDeliveryLogEntry;
        if (!options?.status || entry.status === options.status) {
          logs.push(entry);
        }
      }
    }

    return { logs, total };
  } catch (error) {
    console.error('[WebhookQueue] Failed to get delivery logs:', error);
    return { logs: [], total: 0 };
  }
}

// ============================================================================
// Queue Status and Health
// ============================================================================

/**
 * Get current queue statistics
 */
export async function getWebhookQueueStats(): Promise<WebhookQueueHealth['stats'] | null> {
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
    };
  } catch (error) {
    console.error('[WebhookQueue] Failed to get stats:', error);
    return null;
  }
}

/**
 * Get queue health status
 */
export async function getWebhookQueueHealth(): Promise<WebhookQueueHealth> {
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
      },
      lastJobProcessed: null,
      uptime: 0,
    };
  }

  try {
    const stats = await getWebhookQueueStats();

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (!stats) {
      status = 'unhealthy';
    } else if (stats.paused) {
      status = 'degraded';
    } else if (stats.failed > stats.completed * 0.2 && stats.completed > 10) {
      // More than 20% failure rate with significant volume
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
      },
      lastJobProcessed: lastJobProcessedAt,
      uptime: startedAt ? Math.floor((Date.now() - startedAt.getTime()) / 1000) : 0,
    };
  } catch (error) {
    console.error('[WebhookQueue] Failed to get health:', error);
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
      },
      lastJobProcessed: null,
      uptime: 0,
    };
  }
}

/**
 * Check if queue is ready
 */
export function isWebhookQueueReady(): boolean {
  return isInitialized && queue !== null && worker !== null;
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

/**
 * Gracefully shutdown the webhook queue
 */
export async function shutdownWebhookQueue(): Promise<void> {
  console.log('[WebhookQueue] Shutting down...');

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
    console.log('[WebhookQueue] Shutdown complete');
  } catch (error) {
    console.error('[WebhookQueue] Error during shutdown:', error);
  }
}
