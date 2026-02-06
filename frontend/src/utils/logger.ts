/**
 * Development-only logger utility
 * Feature #115: Replace console.log statements with conditional logging
 *
 * In production builds, these functions become no-ops (tree-shaken by bundler)
 * In development, they provide prefixed, colored console output
 */

const isDev = import.meta.env.DEV;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  prefix?: string;
  color?: string;
}

// Color codes for different log levels/modules
const colors: Record<string, string> = {
  socket: '#00bcd4',     // cyan
  auth: '#9c27b0',       // purple
  websocket: '#2196f3',  // blue
  api: '#4caf50',        // green
  cache: '#ff9800',      // orange
  ai: '#e91e63',         // pink
  default: '#607d8b',    // blue-grey
};

function formatPrefix(prefix: string, color: string): string[] {
  return [`%c[${prefix}]`, `color: ${color}; font-weight: bold;`];
}

/**
 * Create a namespaced logger instance
 * @param namespace - Logger namespace/prefix (e.g., 'Socket.IO', 'Auth', 'WebSocket')
 * @returns Object with debug, info, warn, error methods
 *
 * @example
 * const log = createLogger('Socket.IO');
 * log.debug('Connected:', socketId);
 * log.info('Reconnecting...', { attempt: 3 });
 */
export function createLogger(namespace: string) {
  const colorKey = namespace.toLowerCase().replace(/[.\s-]/g, '');
  const color = colors[colorKey] || colors.default;

  return {
    debug: (...args: unknown[]) => {
      if (isDev) {
        console.log(...formatPrefix(namespace, color), ...args);
      }
    },
    info: (...args: unknown[]) => {
      if (isDev) {
        console.info(...formatPrefix(namespace, color), ...args);
      }
    },
    warn: (...args: unknown[]) => {
      // Warnings always shown (even in production)
      console.warn(...formatPrefix(namespace, color), ...args);
    },
    error: (...args: unknown[]) => {
      // Errors always shown (even in production)
      console.error(...formatPrefix(namespace, color), ...args);
    },
  };
}

/**
 * Simple development-only log function
 * Use for quick debugging without creating a logger instance
 *
 * @example
 * devLog('User clicked button', { userId: 123 });
 */
export function devLog(...args: unknown[]) {
  if (isDev) {
    console.log('[Dev]', ...args);
  }
}

/**
 * Pre-created logger instances for common modules
 */
export const logger = {
  socket: createLogger('Socket.IO'),
  auth: createLogger('Auth'),
  websocket: createLogger('WebSocket'),
  api: createLogger('API'),
  cache: createLogger('Cache'),
  ai: createLogger('AI'),
};

export default logger;
