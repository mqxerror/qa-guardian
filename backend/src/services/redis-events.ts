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

// Redis channel name for Socket.IO events
const SOCKET_EVENTS_CHANNEL = 'qa-guardian:socket-events';

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
    console.error('[RedisEvents] Invalid REDIS_URL:', err);
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
      console.log('[RedisEvents] Publisher connected to Redis');
    });

    pubClient.on('error', (err) => {
      console.error('[RedisEvents] Publisher error:', err.message);
    });

    pubClient.on('close', () => {
      console.log('[RedisEvents] Publisher connection closed');
      publisherInitialized = false;

      // Feature #224: Schedule reconnection with exponential backoff
      if (publisherReconnectTimer) {
        clearTimeout(publisherReconnectTimer);
      }
      const delay = getReconnectDelay(publisherReconnectAttempts);
      console.log(`[RedisEvents] Publisher scheduling reconnection in ${Math.round(delay)}ms (attempt ${publisherReconnectAttempts + 1})`);
      publisherReconnectTimer = setTimeout(async () => {
        publisherReconnectAttempts++;
        const success = await initializeEventPublisher();
        if (success) {
          console.log('[RedisEvents] Publisher reconnected successfully');
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
    console.log('[RedisEvents] Event publisher initialized');
    return true;
  } catch (err) {
    console.error('[RedisEvents] Failed to initialize event publisher:', err);
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
    console.warn('[RedisEvents] Publisher not initialized, cannot publish event');
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
    console.log(`[RedisEvents] Published ${event} for run ${runId} (org: ${orgId})`);
    return true;
  } catch (err) {
    console.error('[RedisEvents] Failed to publish event:', err);
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
      console.log('[RedisEvents] Subscriber connected to Redis');
    });

    subClient.on('error', (err) => {
      console.error('[RedisEvents] Subscriber error:', err.message);
    });

    subClient.on('close', () => {
      console.log('[RedisEvents] Subscriber connection closed');
      subscriberInitialized = false;

      // Feature #224: Schedule reconnection with exponential backoff
      if (subscriberReconnectTimer) {
        clearTimeout(subscriberReconnectTimer);
      }
      const delay = getReconnectDelay(subscriberReconnectAttempts);
      console.log(`[RedisEvents] Subscriber scheduling reconnection in ${Math.round(delay)}ms (attempt ${subscriberReconnectAttempts + 1})`);
      subscriberReconnectTimer = setTimeout(async () => {
        subscriberReconnectAttempts++;
        if (cachedIO) {
          const success = await initializeEventSubscriber(cachedIO);
          if (success) {
            console.log('[RedisEvents] Subscriber reconnected successfully');
            subscriberReconnectAttempts = 0; // Reset on success
          }
        } else {
          console.error('[RedisEvents] Cannot reconnect subscriber - no cached IO instance');
        }
      }, delay);
    });

    // Subscribe to the socket events channel
    await subClient.subscribe(SOCKET_EVENTS_CHANNEL);
    console.log(`[RedisEvents] Subscribed to channel: ${SOCKET_EVENTS_CHANNEL}`);

    // Handle incoming messages
    subClient.on('message', (channel, message) => {
      if (channel !== SOCKET_EVENTS_CHANNEL) {
        return;
      }

      try {
        const payload: SocketEventPayload = JSON.parse(message);
        const { event, runId, orgId, data } = payload;

        // Forward to Socket.IO clients
        const socketPayload = { runId, orgId, ...data };

        // Emit to run-specific room
        io.to(`run:${runId}`).emit(event, socketPayload);

        // Also emit to organization room for cross-tab sync
        io.to(`org:${orgId}`).emit(event, socketPayload);

        console.log(`[RedisEvents] Forwarded ${event} for run ${runId} to Socket.IO clients`);
      } catch (err) {
        console.error('[RedisEvents] Failed to parse/forward event:', err);
      }
    });

    subscriberInitialized = true;
    console.log('[RedisEvents] Event subscriber initialized');
    return true;
  } catch (err) {
    console.error('[RedisEvents] Failed to initialize event subscriber:', err);
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
    console.log('[RedisEvents] Publisher closed');
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
    await subClient.unsubscribe(SOCKET_EVENTS_CHANNEL);
    await subClient.quit();
    subClient = null;
    subscriberInitialized = false;
    console.log('[RedisEvents] Subscriber closed');
  }
}

/**
 * Get connection status for health checks
 */
export function getConnectionStatus(): {
  publisher: boolean;
  subscriber: boolean;
  channel: string;
} {
  return {
    publisher: publisherInitialized,
    subscriber: subscriberInitialized,
    channel: SOCKET_EVENTS_CHANNEL,
  };
}
