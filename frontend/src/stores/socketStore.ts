/**
 * Socket.IO Store with Health Monitoring and Auto-Reconnect
 * Feature #167: WebSocket connection health monitoring
 *
 * Features:
 * - Heartbeat ping/pong every 30 seconds
 * - Exponential backoff auto-reconnect (1s, 2s, 4s, max 30s)
 * - Connection status indicator
 * - Re-subscribe to channels after reconnect
 * - Reconnection event logging
 */

import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { logger } from '../utils/logger';

/**
 * Connection status for visual indicator
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

/**
 * Reconnection event for logging
 */
export interface ReconnectionEvent {
  timestamp: Date;
  attempt: number;
  delay: number;
  reason: string;
  success: boolean;
}

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  reconnectAttempt: number;
  lastHeartbeat: Date | null;
  reconnectionEvents: ReconnectionEvent[];
  subscribedRuns: string[];
  subscribedOrg: string | null;

  // Actions
  connect: () => void;
  disconnect: () => void;
  joinRun: (runId: string) => void;
  leaveRun: (runId: string) => void;
  joinOrg: (orgId: string) => void;
  getConnectionHealth: () => { healthy: boolean; lastHeartbeatAgo: number | null };
}

// Feature #167: Heartbeat and reconnect configuration
// Feature #116: Uses constants from timeouts.ts
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  INITIAL_RECONNECT_DELAY_MS,
  MAX_RECONNECT_DELAY_MS,
  SOCKET_CONNECT_TIMEOUT_MS,
} from '../constants/timeouts';

const MAX_RECONNECTION_EVENTS = 50; // Keep last 50 events

// Get the WebSocket server URL
function getSocketUrl(): string {
  // In development, use localhost; in production, use the production URL
  if (import.meta.env.DEV) {
    return 'http://localhost:3001';
  }
  return 'https://qa.pixelcraftedmedia.com';
}

export const useSocketStore = create<SocketState>((set, get) => {
  // Feature #167: Heartbeat timer reference
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Calculate exponential backoff delay
   */
  const getReconnectDelay = (attempt: number): number => {
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(2, attempt),
      MAX_RECONNECT_DELAY_MS
    );
    // Add some jitter (0-20%) to prevent thundering herd
    return delay + Math.random() * delay * 0.2;
  };

  /**
   * Log a reconnection event
   */
  const logReconnectionEvent = (event: Omit<ReconnectionEvent, 'timestamp'>) => {
    const fullEvent = { ...event, timestamp: new Date() };
    logger.socket.debug('Reconnection event:', fullEvent);

    set((state) => ({
      reconnectionEvents: [
        fullEvent,
        ...state.reconnectionEvents.slice(0, MAX_RECONNECTION_EVENTS - 1),
      ],
    }));
  };

  /**
   * Clear all timers
   */
  const clearTimers = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (heartbeatTimeout) {
      clearTimeout(heartbeatTimeout);
      heartbeatTimeout = null;
    }
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  };

  /**
   * Start heartbeat monitoring
   */
  const startHeartbeat = (socket: Socket) => {
    // Clear any existing timers
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (heartbeatTimeout) clearTimeout(heartbeatTimeout);

    // Feature #167: Send heartbeat ping every 30 seconds
    heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping');

        // Start timeout for pong response
        heartbeatTimeout = setTimeout(() => {
          console.warn('[Socket.IO] Heartbeat timeout - no pong received');
          // Force disconnect to trigger reconnect
          socket.disconnect();
        }, HEARTBEAT_TIMEOUT_MS);
      }
    }, HEARTBEAT_INTERVAL_MS);
  };

  /**
   * Handle pong response
   */
  const handlePong = () => {
    if (heartbeatTimeout) {
      clearTimeout(heartbeatTimeout);
      heartbeatTimeout = null;
    }
    set({ lastHeartbeat: new Date() });
  };

  /**
   * Re-subscribe to all channels after reconnect
   */
  const resubscribeToChannels = (socket: Socket) => {
    const state = get();

    // Re-join organization room
    if (state.subscribedOrg) {
      socket.emit('join-org', state.subscribedOrg);
      logger.socket.debug('Re-subscribed to org:', state.subscribedOrg);
    }

    // Re-join all run rooms
    for (const runId of state.subscribedRuns) {
      socket.emit('join-run', runId);
      logger.socket.debug('Re-subscribed to run:', runId);
    }
  };

  /**
   * Attempt to reconnect with exponential backoff
   */
  const attemptReconnect = () => {
    const state = get();
    const attempt = state.reconnectAttempt + 1;
    const delay = getReconnectDelay(attempt);

    set({
      connectionStatus: 'reconnecting',
      reconnectAttempt: attempt,
    });

    logReconnectionEvent({
      attempt,
      delay,
      reason: 'Connection lost',
      success: false,
    });

    logger.socket.debug(`Reconnecting in ${Math.round(delay)}ms (attempt ${attempt})`);

    reconnectTimeout = setTimeout(() => {
      get().connect();
    }, delay);
  };

  return {
    socket: null,
    isConnected: false,
    connectionStatus: 'disconnected',
    reconnectAttempt: 0,
    lastHeartbeat: null,
    reconnectionEvents: [],
    subscribedRuns: [],
    subscribedOrg: null,

    connect: () => {
      const { socket } = get();
      if (socket?.connected) return;

      // Clean up existing socket
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }

      set({ connectionStatus: 'connecting' });

      const socketUrl = getSocketUrl();
      logger.socket.debug('Connecting to:', socketUrl);

      const newSocket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnection: false, // We handle reconnection ourselves
        timeout: SOCKET_CONNECT_TIMEOUT_MS,
      });

      newSocket.on('connect', () => {
        logger.socket.debug('Connected:', newSocket.id);

        const wasReconnecting = get().reconnectAttempt > 0;

        set({
          isConnected: true,
          connectionStatus: 'connected',
          reconnectAttempt: 0,
          lastHeartbeat: new Date(),
        });

        // Feature #167: Start heartbeat monitoring
        startHeartbeat(newSocket);

        // Feature #167: Re-subscribe after reconnect
        if (wasReconnecting) {
          logReconnectionEvent({
            attempt: get().reconnectAttempt,
            delay: 0,
            reason: 'Reconnection successful',
            success: true,
          });
          resubscribeToChannels(newSocket);
        }
      });

      newSocket.on('disconnect', (reason) => {
        logger.socket.debug('Disconnected:', reason);
        clearTimers();

        set({
          isConnected: false,
          connectionStatus: 'disconnected',
        });

        // Feature #167: Auto-reconnect unless explicitly disconnected
        if (reason !== 'io client disconnect') {
          attemptReconnect();
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('[Socket.IO] Connection error:', error.message);

        set({ connectionStatus: 'disconnected' });

        // Feature #167: Attempt reconnect on connection error
        attemptReconnect();
      });

      // Feature #167: Handle pong response for heartbeat
      newSocket.on('pong', handlePong);

      set({ socket: newSocket });
    },

    disconnect: () => {
      const { socket } = get();
      clearTimers();

      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        set({
          socket: null,
          isConnected: false,
          connectionStatus: 'disconnected',
          reconnectAttempt: 0,
          subscribedRuns: [],
          subscribedOrg: null,
        });
      }
    },

    joinRun: (runId: string) => {
      const { socket, subscribedRuns } = get();
      if (socket?.connected) {
        socket.emit('join-run', runId);
        logger.socket.debug('Joining run:', runId);

        // Track subscription for re-subscribe
        if (!subscribedRuns.includes(runId)) {
          set({ subscribedRuns: [...subscribedRuns, runId] });
        }
      }
    },

    leaveRun: (runId: string) => {
      const { socket, subscribedRuns } = get();
      if (socket?.connected) {
        socket.emit('leave-run', runId);
        logger.socket.debug('Leaving run:', runId);
      }

      // Remove from tracked subscriptions
      set({ subscribedRuns: subscribedRuns.filter(id => id !== runId) });
    },

    joinOrg: (orgId: string) => {
      const { socket } = get();
      if (socket?.connected) {
        socket.emit('join-org', orgId);
        logger.socket.debug('Joining org:', orgId);
      }

      // Track subscription for re-subscribe
      set({ subscribedOrg: orgId });
    },

    getConnectionHealth: () => {
      const { lastHeartbeat, isConnected } = get();

      if (!isConnected || !lastHeartbeat) {
        return { healthy: false, lastHeartbeatAgo: null };
      }

      const lastHeartbeatAgo = Date.now() - lastHeartbeat.getTime();
      const healthy = lastHeartbeatAgo < HEARTBEAT_TIMEOUT_MS;

      return { healthy, lastHeartbeatAgo };
    },
  };
});
