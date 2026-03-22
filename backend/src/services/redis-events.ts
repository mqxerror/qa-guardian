/**
 * Redis Pub/Sub Events Service
 * Feature #200: Worker Redis Pub/Sub for real-time Socket.IO events
 *
 * This module provides Redis-based event publishing for the worker process.
 * In production, the worker container executes tests but has NO Socket.IO instance.
 * All emitRunEvent() calls would be silently dropped without this service.
 *
 * Architecture:
 * - Worker publishes events via Redis Pub/Sub
 * - API server subscribes and forwards to Socket.IO clients
 * - This enables real-time test progress even when tests run in separate containers
 *
 * Usage:
 * - Worker: initializeEventPublisher() then publishRunEvent()
 * - API Server: initializeEventSubscriber(io) to forward events to Socket.IO
 */

import { Redis } from 'ioredis';
import type { Server as SocketIOServer } from 'socket.io';
import { createLogger } from './logger.js';

// Feature #439: Structured logging for redis events
const logger = createLogger('redis-events');

// Redis channel name for Socket.IO events
const SOCKET_EVENTS_CHANNEL = 'qa-guardian:socket-events';

// Redis channel name for Quick Test wave events (separate from test-run events)
const QUICK_TEST_EVENTS_CHANNEL = 'qa-guardian:quick-test-events';

// Event types that can be published
export interface SocketEventPayload {
  event: string;
  runId: string;
  orgId: string;
  data: Record<string, unknown>;
  timestamp: number;
}

// Publisher client (used by worker)
let pubClient: Redis | null = null;

// Subscriber client (used by API server)
let subClient: Redis | null = null;

// Track initialization status
let publisherInitialized = false;
let subscriberInitialized = false;

// Feature #224: Reconnection state for exponential backoff
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
let publisherReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let publisherReconnectAttempts = 0;
let subscriberReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let subscriberReconnectAttempts = 0;
let cachedIO: SocketIOServer | null = null;

/**
 * Feature #224: Calculate reconnect delay with exponential backoff and jitter
 */
function getReconnectDelay(attempt: number): number {
  const delay = Math.min(INITIAL_RECONNECT_DELAY_MS * Math.pow(2, attempt), MAX_RECONNECT_DELAY_MS);
  // Add 0-20% jitter to prevent thundering herd
  return delay + Math.random() * delay * 0.2;
}

/**
 * Get Redis connection options from environment
 */
function getRedisOptions(): {
  host: string;
  port: number;
  password?: string;
  maxRetriesPerRequest: null;
} {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redisPassword = process.env.REDIS_PASSWORD;

  try {
    const url = new URL(redisUrl);
    const options: {
      host: string;
      port: number;
      password?: string;
      maxRetriesPerRequest: null;
    } = {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      maxRetriesPerRequest: null, // Required for pub/sub
    };

    if (redisPassword) {
      options.password = redisPassword;
    } else if (url.password) {
      options.password = url.password;
    }

    return options;
  } catch (err) {
    logger.error({ error: err }, 'Invalid REDIS_URL');
    return {
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,
    };
  }
}

/**
 * Initialize the Redis publisher client (for worker)
 * Call this in worker.ts before processing jobs
 */
export async function initializeEventPublisher(): Promise<boolean> {
  if (publisherInitialized && pubClient) {
    return true;
  }

  try {
    const options = getRedisOptions();
    pubClient = new Redis(options);

    pubClient.on('connect', () => {
      logger.info({ action: 'publisher_connect' }, 'Publisher connected to Redis');
    });

    pubClient.on('error', (err) => {
      logger.error({ error: err.message }, 'Publisher error');
    });

    pubClient.on('close', () => {
      logger.info({ action: 'publisher_close' }, 'Publisher connection closed');
      publisherInitialized = false;

      // Feature #224: Schedule reconnection with exponential backoff
      if (publisherReconnectTimer) {
        clearTimeout(publisherReconnectTimer);
      }
      const delay = getReconnectDelay(publisherReconnectAttempts);
      logger.info({ delayMs: Math.round(delay), attempt: publisherReconnectAttempts + 1 }, 'Publisher scheduling reconnection');
      publisherReconnectTimer = setTimeout(async () => {
        publisherReconnectAttempts++;
        const success = await initializeEventPublisher();
        if (success) {
          logger.info({ action: 'publisher_reconnect' }, 'Publisher reconnected successfully');
          publisherReconnectAttempts = 0; // Reset on success
        }
      }, delay);
    });

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, 5000);

      pubClient!.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      pubClient!.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    publisherInitialized = true;
    logger.info({ action: 'init' }, 'Event publisher initialized');
    return true;
  } catch (err) {
    logger.error({ error: err }, 'Failed to initialize event publisher');
    pubClient = null;
    publisherInitialized = false;
    return false;
  }
}

/**
 * Publish a run event via Redis Pub/Sub
 * This is called by worker when Socket.IO is not available
 */
export async function publishRunEvent(
  runId: string,
  orgId: string,
  event: string,
  data: Record<string, unknown>
): Promise<boolean> {
  if (!pubClient || !publisherInitialized) {
    logger.warn({ action: 'publish' }, 'Publisher not initialized, cannot publish event');
    return false;
  }

  try {
    const payload: SocketEventPayload = {
      event,
      runId,
      orgId,
      data,
      timestamp: Date.now(),
    };

    const message = JSON.stringify(payload);
    await pubClient.publish(SOCKET_EVENTS_CHANNEL, message);
    logger.debug({ event, runId, orgId }, 'Published event');
    return true;
  } catch (err) {
    logger.error({ error: err }, 'Failed to publish event');
    return false;
  }
}

/**
 * Publish a Quick Test wave event via Redis Pub/Sub
 * This is called by worker when Socket.IO is not available for quick test events
 */
export async function publishQuickTestEvent(
  runId: string,
  orgId: string,
  event: string,
  data: Record<string, unknown>
): Promise<boolean> {
  if (!pubClient || !publisherInitialized) {
    logger.warn({ action: 'publish_quick_test' }, 'Publisher not initialized, cannot publish quick test event');
    return false;
  }

  try {
    const payload: SocketEventPayload = {
      event,
      runId,
      orgId,
      data,
      timestamp: Date.now(),
    };

    const message = JSON.stringify(payload);
    await pubClient.publish(QUICK_TEST_EVENTS_CHANNEL, message);
    logger.debug({ event, runId, orgId }, 'Published quick test event');
    return true;
  } catch (err) {
    logger.error({ error: err }, 'Failed to publish quick test event');
    return false;
  }
}

/**
 * Initialize the Redis subscriber and forward events to Socket.IO
 * Call this in index.ts after Socket.IO is set up
 */
export async function initializeEventSubscriber(io: SocketIOServer): Promise<boolean> {
  if (subscriberInitialized && subClient) {
    return true;
  }

  // Feature #224: Cache IO instance for reconnection
  cachedIO = io;

  try {
    const options = getRedisOptions();
    subClient = new Redis(options);

    subClient.on('connect', () => {
      logger.info({ action: 'subscriber_connect' }, 'Subscriber connected to Redis');
    });

    subClient.on('error', (err) => {
      logger.error({ error: err.message }, 'Subscriber error');
    });

    subClient.on('close', () => {
      logger.info({ action: 'subscriber_close' }, 'Subscriber connection closed');
      subscriberInitialized = false;

      // Feature #224: Schedule reconnection with exponential backoff
      if (subscriberReconnectTimer) {
        clearTimeout(subscriberReconnectTimer);
      }
      const delay = getReconnectDelay(subscriberReconnectAttempts);
      logger.info({ delayMs: Math.round(delay), attempt: subscriberReconnectAttempts + 1 }, 'Subscriber scheduling reconnection');
      subscriberReconnectTimer = setTimeout(async () => {
        subscriberReconnectAttempts++;
        if (cachedIO) {
          const success = await initializeEventSubscriber(cachedIO);
          if (success) {
            logger.info({ action: 'subscriber_reconnect' }, 'Subscriber reconnected successfully');
            subscriberReconnectAttempts = 0; // Reset on success
          }
        } else {
          logger.error({ action: 'subscriber_reconnect' }, 'Cannot reconnect subscriber - no cached IO instance');
        }
      }, delay);
    });

    // Subscribe to both the test-run and quick-test event channels
    await subClient.subscribe(SOCKET_EVENTS_CHANNEL, QUICK_TEST_EVENTS_CHANNEL);
    logger.info({ channels: [SOCKET_EVENTS_CHANNEL, QUICK_TEST_EVENTS_CHANNEL] }, 'Subscribed to channels');

    // Handle incoming messages from all channels
    subClient.on('message', (channel, message) => {
      try {
        const payload: SocketEventPayload = JSON.parse(message);
        const { event, runId, orgId, data } = payload;

        if (channel === SOCKET_EVENTS_CHANNEL) {
          // Test-run events: forward to run-specific and lifecycle org rooms
          const socketPayload = { runId, orgId, ...data };

          // Always emit to run-specific room
          io.to(`run:${runId}`).emit(event, socketPayload);

          // Only emit lifecycle events to org room to prevent double delivery
          // (clients in both run and org rooms would receive every event twice)
          const orgRoomEvents = ['run-start', 'run-complete', 'run-cancelled'];
          if (orgRoomEvents.includes(event)) {
            io.to(`org:${orgId}`).emit(event, socketPayload);
          }

          logger.debug({ event, runId }, 'Forwarded run event to Socket.IO clients');
        } else if (channel === QUICK_TEST_EVENTS_CHANNEL) {
          // Quick test events: forward to quick-test-specific and org rooms
          const socketPayload = { orgId, runId, ...data };

          io.to(`quick-test:${runId}`).emit(event, socketPayload);
          io.to(`org:${orgId}`).emit(event, socketPayload);

          logger.debug({ event, runId }, 'Forwarded quick test event to Socket.IO clients');
        }
      } catch (err) {
        logger.error({ error: err }, 'Failed to parse/forward event');
      }
    });

    subscriberInitialized = true;
    logger.info({ action: 'subscriber_init' }, 'Event subscriber initialized');
    return true;
  } catch (err) {
    logger.error({ error: err }, 'Failed to initialize event subscriber');
    subClient = null;
    subscriberInitialized = false;
    return false;
  }
}

/**
 * Check if the publisher is available
 */
export function isPublisherAvailable(): boolean {
  return publisherInitialized && pubClient !== null;
}

/**
 * Check if the subscriber is available
 */
export function isSubscriberAvailable(): boolean {
  return subscriberInitialized && subClient !== null;
}

/**
 * Close publisher connection (call on worker shutdown)
 */
export async function closePublisher(): Promise<void> {
  // Feature #224: Clear any pending reconnect timer
  if (publisherReconnectTimer) {
    clearTimeout(publisherReconnectTimer);
    publisherReconnectTimer = null;
  }
  publisherReconnectAttempts = 0;

  if (pubClient) {
    await pubClient.quit();
    pubClient = null;
    publisherInitialized = false;
    logger.info({ action: 'publisher_closed' }, 'Publisher closed');
  }
}

/**
 * Close subscriber connection (call on API server shutdown)
 */
export async function closeSubscriber(): Promise<void> {
  // Feature #224: Clear any pending reconnect timer
  if (subscriberReconnectTimer) {
    clearTimeout(subscriberReconnectTimer);
    subscriberReconnectTimer = null;
  }
  subscriberReconnectAttempts = 0;
  cachedIO = null;

  if (subClient) {
    await subClient.unsubscribe(SOCKET_EVENTS_CHANNEL, QUICK_TEST_EVENTS_CHANNEL);
    await subClient.quit();
    subClient = null;
    subscriberInitialized = false;
    logger.info({ action: 'subscriber_closed' }, 'Subscriber closed');
  }
}

/**
 * Get connection status for health checks
 */
export function getConnectionStatus(): {
  publisher: boolean;
  subscriber: boolean;
  channel: string;
  channels: string[];
} {
  return {
    publisher: publisherInitialized,
    subscriber: subscriberInitialized,
    channel: SOCKET_EVENTS_CHANNEL, // Kept for backward compatibility
    channels: [SOCKET_EVENTS_CHANNEL, QUICK_TEST_EVENTS_CHANNEL],
  };
}
