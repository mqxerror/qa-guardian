/**
 * Error Tracking Service
 * Feature #164: Global error handling and monitoring
 *
 * Provides:
 * - Uncaught exception tracking
 * - Unhandled rejection tracking
 * - Error metrics for health endpoint
 * - Optional webhook alerts (Slack/Discord)
 */

// Error tracking state
let uncaughtExceptionCount = 0;
let unhandledRejectionCount = 0;
let lastErrorAt: Date | null = null;
let lastError: { message: string; stack?: string } | null = null;
const recentErrors: Array<{ timestamp: Date; type: string; message: string }> = [];
const MAX_RECENT_ERRORS = 10;

/**
 * Error metrics interface for health endpoint
 */
export interface ErrorMetrics {
  uncaughtExceptions: number;
  unhandledRejections: number;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  recentErrors: Array<{ timestamp: string; type: string; message: string }>;
}

/**
 * Get current error metrics for health endpoint
 */
export function getErrorMetrics(): ErrorMetrics {
  return {
    uncaughtExceptions: uncaughtExceptionCount,
    unhandledRejections: unhandledRejectionCount,
    lastErrorAt: lastErrorAt?.toISOString() || null,
    lastErrorMessage: lastError?.message || null,
    recentErrors: recentErrors.map(e => ({
      timestamp: e.timestamp.toISOString(),
      type: e.type,
      message: e.message,
    })),
  };
}

/**
 * Record an error in the tracking system
 */
function recordError(type: 'uncaughtException' | 'unhandledRejection', error: Error | unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  if (type === 'uncaughtException') {
    uncaughtExceptionCount++;
  } else {
    unhandledRejectionCount++;
  }

  lastErrorAt = new Date();
  lastError = { message: errorMessage, stack: errorStack };

  // Add to recent errors list
  recentErrors.unshift({
    timestamp: lastErrorAt,
    type,
    message: errorMessage,
  });

  // Keep only last N errors
  while (recentErrors.length > MAX_RECENT_ERRORS) {
    recentErrors.pop();
  }
}

/**
 * Send error alert to webhook (Slack/Discord compatible)
 */
async function sendErrorWebhook(type: string, error: Error | unknown): Promise<void> {
  const webhookUrl = process.env.ERROR_WEBHOOK_URL;
  if (!webhookUrl) return;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  try {
    const payload = {
      // Discord/Slack compatible format
      embeds: [{
        title: `\u26a0\ufe0f ${type} in QA Guardian`,
        description: errorMessage.substring(0, 1000),
        color: 0xff0000, // Red
        fields: [
          {
            name: 'Environment',
            value: process.env.NODE_ENV || 'development',
            inline: true,
          },
          {
            name: 'Timestamp',
            value: new Date().toISOString(),
            inline: true,
          },
        ],
        footer: {
          text: errorStack ? errorStack.substring(0, 500) : 'No stack trace available',
        },
      }],
      // Slack format as fallback
      text: `[${type}] ${errorMessage}`,
      attachments: [{
        color: 'danger',
        fields: [
          { title: 'Error', value: errorMessage, short: false },
          { title: 'Environment', value: process.env.NODE_ENV || 'development', short: true },
        ],
      }],
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log('[ErrorTracking] Alert sent to webhook');
  } catch (webhookError) {
    console.error('[ErrorTracking] Failed to send webhook alert:', webhookError);
  }
}

/**
 * Initialize global error handlers
 * Must be called early in application startup
 */
export function initializeErrorHandlers(gracefulShutdown: () => Promise<void>): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', async (error: Error) => {
    console.error('[FATAL] Uncaught Exception:');
    console.error(error.stack || error.message);

    recordError('uncaughtException', error);

    // Send webhook alert (non-blocking)
    sendErrorWebhook('Uncaught Exception', error).catch(() => {});

    // Uncaught exceptions are fatal - gracefully shutdown
    console.log('[ErrorTracking] Initiating graceful shutdown due to uncaught exception...');
    try {
      await gracefulShutdown();
    } catch (shutdownError) {
      console.error('[ErrorTracking] Error during shutdown:', shutdownError);
    }

    // Exit with error code
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    console.error('[ERROR] Unhandled Promise Rejection:');
    console.error('Reason:', reason);

    recordError('unhandledRejection', reason);

    // Send webhook alert (non-blocking)
    sendErrorWebhook('Unhandled Promise Rejection', reason).catch(() => {});

    // In Node.js 15+, unhandled rejections will cause the process to exit
    // We log but don't force exit - let Node handle it based on --unhandled-rejections flag
    if (process.env.NODE_ENV === 'production') {
      console.error('[ErrorTracking] Unhandled rejection in production - consider investigating');
    }
  });

  // Handle warning events (for debugging)
  process.on('warning', (warning) => {
    console.warn('[WARNING]', warning.name, warning.message);
    if (warning.stack) {
      console.warn(warning.stack);
    }
  });

  console.log('[ErrorTracking] Global error handlers initialized');
  if (process.env.ERROR_WEBHOOK_URL) {
    console.log('[ErrorTracking] Webhook alerts enabled');
  }
}

/**
 * Check if error tracking is healthy (no recent fatal errors)
 */
export function isErrorTrackingHealthy(): boolean {
  // Consider unhealthy if there have been uncaught exceptions recently
  if (uncaughtExceptionCount > 0) {
    return false;
  }

  // Consider degraded if there are many unhandled rejections
  if (unhandledRejectionCount > 10) {
    return false;
  }

  return true;
}
