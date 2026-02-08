/**
 * Structured Logger Service
 * Feature #429: Structured logging with request correlation
 *
 * Provides a centralized logging interface that integrates with Fastify's pino logger.
 * Services can use this instead of console.log/warn/error for structured logging.
 *
 * Usage patterns:
 * 1. In route handlers: use request.log.info/warn/error (includes request ID automatically)
 * 2. In services: use logger.info/warn/error from this module
 * 3. For child loggers with context: use createLogger('service-name')
 */

import pino from 'pino';

/**
 * Log level type for type-safe log level configuration
 */
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * Get the configured log level from environment
 */
function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
  const validLevels: LogLevel[] = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];

  if (level && validLevels.includes(level)) {
    return level;
  }

  // Default based on environment
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

/**
 * Get the pino transport configuration for development vs production
 */
function getTransport(): pino.TransportSingleOptions | undefined {
  if (process.env.NODE_ENV === 'production') {
    return undefined; // JSON output in production
  }

  // Pretty print in development
  return {
    target: 'pino-pretty',
    options: {
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
      colorize: true,
    },
  };
}

/**
 * Base pino logger instance
 * This is the root logger that can be used for application-level logging
 */
const baseLogger = pino({
  level: getLogLevel(),
  transport: getTransport(),
  base: {
    service: 'qa-guardian',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create a child logger with a specific context/service name
 * Use this for service-specific logging that automatically includes the service name
 *
 * @param service - The service or module name for context
 * @returns A child logger instance
 *
 * @example
 * const logger = createLogger('auth');
 * logger.info('User logged in', { userId: '123' });
 * // Output: {"level":"info","time":"...","service":"auth","msg":"User logged in","userId":"123"}
 */
export function createLogger(service: string): pino.Logger {
  return baseLogger.child({ service });
}

/**
 * Default logger for general use
 * Use createLogger() for service-specific logging
 */
export const logger = baseLogger;

/**
 * Re-export pino types for consumers
 */
export type { Logger } from 'pino';

/**
 * Helper to log with request correlation ID
 * Use this in middleware or when you have access to a request ID
 *
 * @param requestId - The X-Request-ID from the request
 * @returns A child logger with the request ID bound
 *
 * @example
 * const reqLogger = withRequestId('abc-123');
 * reqLogger.info('Processing request');
 * // Output includes: {"requestId":"abc-123",...}
 */
export function withRequestId(requestId: string): pino.Logger {
  return baseLogger.child({ requestId });
}

/**
 * Structured error logging helper
 * Ensures errors are properly serialized with stack traces
 *
 * @param logger - The logger instance to use
 * @param message - The error message
 * @param error - The error object
 * @param context - Additional context to include
 */
export function logError(
  log: pino.Logger,
  message: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  const errorInfo = error instanceof Error
    ? {
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack,
      }
    : { error: String(error) };

  log.error({ ...errorInfo, ...context }, message);
}

/**
 * Performance timing helper
 * Returns a function to log the duration when called
 *
 * @param log - The logger instance
 * @param operation - The operation name being timed
 * @returns A function to call when the operation completes
 *
 * @example
 * const done = startTiming(logger, 'database-query');
 * await db.query(...);
 * done({ rowCount: 100 }); // Logs: "database-query completed" with duration
 */
export function startTiming(
  log: pino.Logger,
  operation: string
): (context?: Record<string, unknown>) => void {
  const start = process.hrtime.bigint();

  return (context?: Record<string, unknown>) => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    log.info(
      {
        operation,
        durationMs: Math.round(durationMs * 100) / 100,
        ...context,
      },
      `${operation} completed`
    );
  };
}

// Export default for convenience
export default logger;
