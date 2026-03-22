/**
 * Webhook Service
 *
 * Feature #Agent8: Service layer extraction for webhook business logic.
 *
 * Consolidates webhook subscription management, delivery status computation,
 * and delivery history retrieval into a clean service interface. Route handlers
 * become thin: validate input -> call service -> return response.
 *
 * This service owns:
 * - Webhook subscription validation (URL safety, event validation, template validation)
 * - Webhook subscription CRUD orchestration (in-memory + DB persistence)
 * - Delivery status computation (health determination, stats aggregation)
 * - Delivery log retrieval with filtering and pagination
 * - Webhook test delivery execution
 *
 * Note: The actual queued delivery of webhook payloads for real events remains
 * in webhook-queue.ts (infrastructure concern). This service handles the
 * user-facing management and observability layer.
 */

import {
  WebhookSubscription,
  webhookSubscriptions,
  generateWebhookSignature,
  deleteWebhookSubscriptionFromDb,
  MAX_WEBHOOK_RETRIES,
  getWebhookDeliveryLogsFromDb,
} from '../routes/test-runs/webhooks.js';
import { WebhookLogEntry, webhookLog } from '../routes/test-runs/alerts.js';
import { validateWebhookURLWithDNS, generateId } from '../utils/index.js';
import { getProject as dbGetProject } from '../routes/projects/stores.js';

// ============================================================================
// Types
// ============================================================================

/** Valid webhook event types */
export const VALID_WEBHOOK_EVENTS = [
  'test.run.started',
  'test.run.completed',
  'test.run.failed',
  'test.run.passed',
  'test.completed',
  'test.created',
  'baseline.approved',
  'schedule.triggered',
  'visual.diff.detected',
  'performance.budget.exceeded',
  'security.vulnerability.found',
  'flaky.test.detected',
  'accessibility.issue.found',
] as const;

export type WebhookEventType = typeof VALID_WEBHOOK_EVENTS[number];

/** Valid result statuses for webhook filtering */
export const VALID_RESULT_STATUSES = ['passed', 'failed', 'skipped', 'error'] as const;
export type ResultStatus = typeof VALID_RESULT_STATUSES[number];

/** Delivery status for a subscription */
export type SubscriptionHealthStatus = 'healthy' | 'degraded' | 'failing' | 'unknown';

export interface WebhookValidationError {
  field: string;
  message: string;
}

export interface WebhookTestResult {
  success: boolean;
  reachable: boolean;
  response?: {
    status: number;
    status_text: string;
    headers: Record<string, string>;
    body?: string;
  };
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    payload: Record<string, unknown>;
  };
  duration_ms: number;
  delivery_id: string;
  error?: string;
  message: string;
}

export interface SubscriptionStatusResult {
  subscription: {
    id: string;
    name: string;
    url: string;
    enabled: boolean;
  };
  status: SubscriptionHealthStatus;
  delivery_stats: {
    total_success: number;
    total_failure: number;
    success_rate: number | null;
    last_24h: {
      successes: number;
      failures: number;
      total: number;
    };
  };
  timing: {
    last_triggered_at?: string;
    last_success_at?: string;
    last_failure_at?: string;
    avg_response_time_ms?: number;
  };
  retry_config: {
    enabled: boolean;
    max_retries: number;
  };
  recent_deliveries: Array<{
    id: string;
    timestamp: string;
    event: string;
    status: string;
    response_status?: number;
    duration_ms?: number;
    attempt: number;
    max_attempts: number;
    error?: string;
  }>;
}

export interface SubscriptionStatusSummary {
  summary: {
    total: number;
    enabled: number;
    disabled: number;
    by_status: {
      healthy: number;
      degraded: number;
      failing: number;
      unknown: number;
    };
  };
  subscriptions: Array<{
    id: string;
    name: string;
    enabled: boolean;
    status: SubscriptionHealthStatus;
    success_count: number;
    failure_count: number;
    last_triggered_at?: string;
  }>;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate a webhook URL for SSRF safety.
 * Returns null if safe, or an error message string if blocked.
 */
export async function validateWebhookUrl(url: string): Promise<string | null> {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'URL must start with http:// or https://';
  }

  const ssrfValidation = await validateWebhookURLWithDNS(url);
  if (!ssrfValidation.safe) {
    return ssrfValidation.error || 'URL rejected by SSRF validation';
  }

  return null;
}

/**
 * Validate an array of webhook event names.
 * Returns an error message for the first invalid event, or null if all valid.
 */
export function validateWebhookEvents(events: string[]): string | null {
  for (const event of events) {
    if (!VALID_WEBHOOK_EVENTS.includes(event as WebhookEventType)) {
      return `Invalid event: ${event}. Valid events are: ${VALID_WEBHOOK_EVENTS.join(', ')}`;
    }
  }
  return null;
}

/**
 * Validate a payload template string.
 * Templates must be valid JSON when {{variable}} placeholders are replaced.
 */
export function validatePayloadTemplate(template: string): string | null {
  try {
    const testTemplate = template.replace(/\{\{[^}]+\}\}/g, 'PLACEHOLDER');
    JSON.parse(testTemplate);
    return null;
  } catch {
    return 'Invalid payload_template: must be valid JSON with {{variable}} placeholders';
  }
}

/**
 * Validate result_statuses array.
 */
export function validateResultStatuses(statuses: string[]): string | null {
  for (const status of statuses) {
    if (!VALID_RESULT_STATUSES.includes(status as ResultStatus)) {
      return `Invalid result_status: ${status}. Valid statuses are: ${VALID_RESULT_STATUSES.join(', ')}`;
    }
  }
  return null;
}

/**
 * Validate an array of project IDs belong to the given organization.
 * Returns the validated IDs or throws with an error message.
 */
export async function validateProjectIds(
  projectIds: string[],
  orgId: string
): Promise<{ valid: string[] } | { error: string }> {
  const validated: string[] = [];
  for (const pid of projectIds) {
    const project = await dbGetProject(pid);
    if (!project || project.organization_id !== orgId) {
      return { error: `Invalid project_id: ${pid}` };
    }
    validated.push(pid);
  }
  return { valid: validated };
}

// ============================================================================
// Service Implementation
// ============================================================================

export class WebhookService {
  /**
   * List all webhook subscriptions for an organization.
   */
  listSubscriptions(orgId: string): Array<Record<string, unknown>> {
    return Array.from(webhookSubscriptions.values())
      .filter(sub => sub.organization_id === orgId)
      .map(sub => ({
        id: sub.id,
        name: sub.name,
        url: sub.url,
        events: sub.events,
        project_id: sub.project_id,
        project_ids: sub.project_ids,
        result_statuses: sub.result_statuses,
        batch_enabled: sub.batch_enabled ?? false,
        batch_size: sub.batch_size ?? 10,
        batch_interval_seconds: sub.batch_interval_seconds ?? 60,
        enabled: sub.enabled,
        created_at: sub.created_at.toISOString(),
        updated_at: sub.updated_at.toISOString(),
        last_triggered_at: sub.last_triggered_at?.toISOString(),
        success_count: sub.success_count,
        failure_count: sub.failure_count,
      }));
  }

  /**
   * Get a single webhook subscription, checking org ownership.
   * Returns the subscription or null if not found / not owned.
   */
  getSubscription(subscriptionId: string, orgId: string): WebhookSubscription | null {
    const subscription = webhookSubscriptions.get(subscriptionId);
    if (!subscription || subscription.organization_id !== orgId) {
      return null;
    }
    return subscription;
  }

  /**
   * Delete a webhook subscription from both memory and database.
   */
  async deleteSubscription(subscriptionId: string): Promise<void> {
    await deleteWebhookSubscriptionFromDb(subscriptionId);
  }

  /**
   * Compute the health status for a subscription based on recent delivery logs.
   * Returns 'healthy' (>=90% success), 'degraded' (>=50%), 'failing' (<50%),
   * or 'unknown' if no recent logs exist.
   */
  getSubscriptionStatus(subscriptionId: string, orgId: string): SubscriptionStatusResult | null {
    const subscription = this.getSubscription(subscriptionId, orgId);
    if (!subscription) return null;

    const recentLogs = webhookLog
      .filter(log => log.subscriptionId === subscriptionId)
      .slice(0, 10);

    // Determine health status from recent logs
    let status: SubscriptionHealthStatus = 'unknown';
    if (recentLogs.length > 0) {
      const recentSuccessRate = recentLogs.filter(l => l.success).length / recentLogs.length;
      if (recentSuccessRate >= 0.9) status = 'healthy';
      else if (recentSuccessRate >= 0.5) status = 'degraded';
      else status = 'failing';
    }

    // Last 24h stats
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logsLast24h = webhookLog.filter(
      log => log.subscriptionId === subscriptionId && log.timestamp >= last24Hours
    );
    const successesLast24h = logsLast24h.filter(log => log.success).length;
    const failuresLast24h = logsLast24h.filter(log => !log.success).length;

    // Last successful and failed deliveries
    const lastSuccess = recentLogs.find(log => log.success);
    const lastFailure = recentLogs.find(log => !log.success);

    // Average response time from successful logs
    const successfulLogs = recentLogs.filter(log => log.success && log.duration_ms !== undefined);
    const avgResponseTime = successfulLogs.length > 0
      ? Math.round(successfulLogs.reduce((sum, log) => sum + (log.duration_ms ?? 0), 0) / successfulLogs.length)
      : undefined;

    return {
      subscription: {
        id: subscription.id,
        name: subscription.name,
        url: subscription.url,
        enabled: subscription.enabled,
      },
      status,
      delivery_stats: {
        total_success: subscription.success_count,
        total_failure: subscription.failure_count,
        success_rate: subscription.success_count + subscription.failure_count > 0
          ? Math.round((subscription.success_count / (subscription.success_count + subscription.failure_count)) * 100)
          : null,
        last_24h: {
          successes: successesLast24h,
          failures: failuresLast24h,
          total: logsLast24h.length,
        },
      },
      timing: {
        last_triggered_at: subscription.last_triggered_at?.toISOString(),
        last_success_at: lastSuccess?.timestamp.toISOString(),
        last_failure_at: lastFailure?.timestamp.toISOString(),
        avg_response_time_ms: avgResponseTime,
      },
      retry_config: {
        enabled: subscription.retry_enabled ?? true,
        max_retries: subscription.max_retries ?? MAX_WEBHOOK_RETRIES,
      },
      recent_deliveries: recentLogs.map(log => ({
        id: log.id ?? '',
        timestamp: log.timestamp.toISOString(),
        event: log.event ?? '',
        status: log.success ? 'delivered' : 'failed',
        response_status: log.responseStatus,
        duration_ms: log.duration_ms,
        attempt: log.attempt ?? 1,
        max_attempts: log.max_attempts ?? MAX_WEBHOOK_RETRIES,
        error: log.error,
      })),
    };
  }

  /**
   * Compute a status summary across all subscriptions for an organization.
   */
  getStatusSummary(orgId: string): SubscriptionStatusSummary {
    const orgSubscriptions = Array.from(webhookSubscriptions.values())
      .filter(sub => sub.organization_id === orgId);

    const subscriptionStatuses = orgSubscriptions.map(sub => {
      const recentLogs = webhookLog
        .filter(log => log.subscriptionId === sub.id)
        .slice(0, 5);

      let status: SubscriptionHealthStatus = 'unknown';
      if (recentLogs.length > 0) {
        const recentSuccessRate = recentLogs.filter(l => l.success).length / recentLogs.length;
        if (recentSuccessRate >= 0.9) status = 'healthy';
        else if (recentSuccessRate >= 0.5) status = 'degraded';
        else status = 'failing';
      }

      return {
        id: sub.id,
        name: sub.name,
        enabled: sub.enabled,
        status,
        success_count: sub.success_count,
        failure_count: sub.failure_count,
        last_triggered_at: sub.last_triggered_at?.toISOString(),
      };
    });

    const enabledCount = subscriptionStatuses.filter(s => s.enabled).length;
    const healthyCount = subscriptionStatuses.filter(s => s.status === 'healthy').length;
    const degradedCount = subscriptionStatuses.filter(s => s.status === 'degraded').length;
    const failingCount = subscriptionStatuses.filter(s => s.status === 'failing').length;

    return {
      summary: {
        total: subscriptionStatuses.length,
        enabled: enabledCount,
        disabled: subscriptionStatuses.length - enabledCount,
        by_status: {
          healthy: healthyCount,
          degraded: degradedCount,
          failing: failingCount,
          unknown: subscriptionStatuses.length - healthyCount - degradedCount - failingCount,
        },
      },
      subscriptions: subscriptionStatuses,
    };
  }

  /**
   * Send a test delivery to a webhook subscription URL.
   * Validates SSRF safety, sends the payload, logs the delivery,
   * and updates subscription stats.
   *
   * Returns the test result (success/failure details).
   */
  async testWebhookDelivery(
    subscription: WebhookSubscription,
    triggeredByEmail: string
  ): Promise<WebhookTestResult> {
    // SSRF protection check
    const urlError = await validateWebhookUrl(subscription.url);
    if (urlError) {
      return {
        success: false,
        reachable: false,
        request: {
          url: subscription.url,
          method: 'POST',
          headers: {},
          payload: {},
        },
        duration_ms: 0,
        delivery_id: generateId('test', 7),
        error: urlError,
        message: `Webhook URL rejected: ${urlError}`,
      };
    }

    const startTime = Date.now();
    const deliveryId = generateId('test', 7);

    const testPayload: Record<string, unknown> = {
      event: 'test',
      timestamp: new Date().toISOString(),
      message: 'This is a test webhook delivery',
      subscription: {
        id: subscription.id,
        name: subscription.name,
        events: subscription.events,
      },
      triggered_by: triggeredByEmail,
    };

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': 'test',
      'X-Webhook-Delivery-Id': deliveryId,
      ...subscription.headers,
    };

    // Add HMAC signature if secret is configured
    if (subscription.secret) {
      const { signature } = generateWebhookSignature(JSON.stringify(testPayload), subscription.secret);
      requestHeaders['X-Webhook-Signature'] = signature;
    }

    // Redact sensitive headers for logging/response
    const redactedHeaders = Object.keys(requestHeaders).reduce((acc, key) => {
      const headerValue = requestHeaders[key];
      if (key.toLowerCase().includes('signature') || key.toLowerCase().includes('secret')) {
        acc[key] = '[REDACTED]';
      } else if (headerValue !== undefined) {
        acc[key] = headerValue;
      }
      return acc;
    }, {} as Record<string, string>);

    try {
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(testPayload),
      });

      const durationMs = Date.now() - startTime;
      const responseStatus = response.status;
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let responseBody: string | undefined;
      try {
        const body = await response.text();
        responseBody = body.substring(0, 1000);
      } catch {
        responseBody = undefined;
      }

      // Log the delivery
      this.logDelivery({
        deliveryId,
        subscription,
        eventType: 'test',
        payload: testPayload as Record<string, any>,
        headers: requestHeaders,
        attempt: 1,
        maxAttempts: 1,
        startTime,
        success: response.ok,
        responseStatus,
        responseBody,
        responseHeaders,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        context: { runId: 'test', projectId: subscription.project_id || 'org-wide' },
      });

      // Update subscription stats
      subscription.last_triggered_at = new Date();
      if (response.ok) subscription.success_count++;
      else subscription.failure_count++;
      subscription.updated_at = new Date();
      webhookSubscriptions.set(subscription.id, subscription);

      return {
        success: response.ok,
        reachable: true,
        response: {
          status: responseStatus,
          status_text: response.statusText,
          headers: responseHeaders,
          body: responseBody,
        },
        request: {
          url: subscription.url,
          method: 'POST',
          headers: redactedHeaders,
          payload: testPayload,
        },
        duration_ms: durationMs,
        delivery_id: deliveryId,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        message: response.ok
          ? 'Test webhook delivered successfully'
          : `Webhook returned HTTP ${responseStatus}`,
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';

      // Log the failed delivery
      this.logDelivery({
        deliveryId,
        subscription,
        eventType: 'test',
        payload: testPayload as Record<string, any>,
        headers: requestHeaders,
        attempt: 1,
        maxAttempts: 1,
        startTime,
        success: false,
        error: errorMsg,
        context: { runId: 'test', projectId: subscription.project_id || 'org-wide' },
      });

      // Update subscription stats
      subscription.last_triggered_at = new Date();
      subscription.failure_count++;
      subscription.updated_at = new Date();
      webhookSubscriptions.set(subscription.id, subscription);

      return {
        success: false,
        reachable: false,
        request: {
          url: subscription.url,
          method: 'POST',
          headers: redactedHeaders,
          payload: testPayload,
        },
        duration_ms: durationMs,
        delivery_id: deliveryId,
        error: errorMsg,
        message: `Failed to reach URL: ${errorMsg}`,
      };
    }
  }

  /**
   * Get delivery history for a subscription from the database.
   * Provides persistent logs that survive server restarts.
   */
  async getDeliveryHistory(
    subscriptionId: string,
    options?: { limit?: number; offset?: number; status?: 'success' | 'failed' | 'pending_retry' }
  ): Promise<{ logs: Array<Record<string, unknown>>; total: number }> {
    const result = await getWebhookDeliveryLogsFromDb(subscriptionId, {
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
      status: options?.status,
    });

    return {
      logs: result.logs.map(log => ({
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        event_type: log.event_type,
        url: log.url,
        status: log.status,
        attempt_number: log.attempt_number,
        max_attempts: log.max_attempts,
        response_status: log.response?.status,
        duration_ms: log.response?.duration_ms,
        error: log.error?.message,
        completed_at: log.completed_at?.toISOString(),
        context: log.context,
      })),
      total: result.total,
    };
  }

  /**
   * Log a webhook delivery attempt to the in-memory log buffer.
   * Keeps the last 500 entries with automatic eviction.
   */
  private logDelivery(params: {
    deliveryId: string;
    subscription: WebhookSubscription;
    eventType: string;
    payload: Record<string, any>;
    headers: Record<string, string>;
    attempt: number;
    maxAttempts: number;
    startTime: number;
    success: boolean;
    responseStatus?: number;
    responseBody?: string;
    responseHeaders?: Record<string, string>;
    error?: string;
    context?: { runId?: string; projectId?: string };
  }): void {
    const duration_ms = Date.now() - params.startTime;

    // Create sanitized headers (hide secret/signature values)
    const sanitizedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(params.headers)) {
      if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('signature')) {
        sanitizedHeaders[key] = '[REDACTED]';
      } else {
        sanitizedHeaders[key] = value;
      }
    }

    const logEntry: WebhookLogEntry = {
      id: `${params.deliveryId}_attempt_${params.attempt}`,
      timestamp: new Date(),
      url: params.subscription.url,
      method: 'POST',
      headers: sanitizedHeaders,
      payload: params.payload,
      event: params.eventType,
      runId: params.context?.runId || '',
      projectId: params.context?.projectId || '',
      subscriptionId: params.subscription.id,
      subscriptionName: params.subscription.name,
      success: params.success,
      responseStatus: params.responseStatus,
      responseBody: params.responseBody,
      responseHeaders: params.responseHeaders,
      duration_ms,
      attempt: params.attempt,
      max_attempts: params.maxAttempts,
      error: params.error,
    };

    webhookLog.unshift(logEntry);

    // Keep only last 500 entries
    if (webhookLog.length > 500) {
      webhookLog.pop();
    }
  }
}

// Export a singleton instance for convenience
export const webhookService = new WebhookService();
