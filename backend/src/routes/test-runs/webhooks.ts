/**
 * Test Runs - Webhooks Module
 * Feature #1283-1315: Webhook event delivery and management
 *
 * Extracted from test-runs.ts for code quality (#1356)
 */

import * as crypto from 'crypto';

// ============================================================================
// Webhook Subscription Interface
// ============================================================================

export interface WebhookSubscription {
  id: string;
  organization_id: string;
  project_id?: string; // Optional single project - if not set, applies to all projects (legacy)
  // Feature #1299: Support multiple project filtering
  project_ids?: string[]; // Optional array of project IDs - if empty/not set, applies to all projects
  // Feature #1300: Filter by result status
  result_statuses?: ('passed' | 'failed' | 'skipped' | 'error')[]; // Optional array of statuses to trigger on
  name: string;
  url: string;
  events: WebhookEventType[];
  headers?: Record<string, string>;
  secret?: string; // For HMAC signature verification
  // Feature #1291: Webhook payload customization
  payload_template?: string; // JSON template with {{variable}} interpolation
  // Feature #1294: Webhook retry with exponential backoff
  retry_enabled?: boolean; // Enable retries on failure (default: true)
  max_retries?: number; // Max retry attempts (default: 5)
  // Feature #1304: Webhook batch delivery
  batch_enabled?: boolean; // Enable batching multiple events (default: false)
  batch_size?: number; // Max events per batch (default: 10)
  batch_interval_seconds?: number; // Interval to flush batch (default: 5)
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
  last_triggered_at?: Date;
  failure_count: number;
  success_count: number;
}

export type WebhookEventType =
  | 'test.run.started'
  | 'test.run.completed'
  | 'test.run.failed'
  | 'test.run.passed'
  | 'test.completed'
  | 'test.created'
  | 'baseline.approved'
  | 'schedule.triggered'
  | 'visual.diff.detected'
  | 'performance.budget.exceeded'
  | 'security.vulnerability.found'
  | 'flaky.test.detected'
  | 'accessibility.issue.found';

// ============================================================================
// Webhook Delivery Tracking
// ============================================================================

// Feature #1294: Webhook delivery attempt tracking
export interface WebhookDeliveryAttempt {
  id: string;
  subscription_id: string;
  event: string;
  payload: Record<string, any>;
  attempt_number: number;
  max_attempts: number;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  response_status?: number;
  error?: string;
  created_at: Date;
  next_retry_at?: Date;
  completed_at?: Date;
}

// Feature #1294: Store for pending webhook delivery retries
export const webhookDeliveryQueue: Map<string, WebhookDeliveryAttempt> = new Map();

// ============================================================================
// Webhook Batching
// ============================================================================

// Feature #1304: Webhook batch queue
export interface WebhookBatchEntry {
  payload: Record<string, any>;
  eventType: string;
  context?: { runId?: string; projectId?: string };
  addedAt: Date;
}

// Map of subscription ID to pending batch entries
export const webhookBatchQueues: Map<string, WebhookBatchEntry[]> = new Map();

// Map of subscription ID to flush timer
export const webhookBatchTimers: Map<string, NodeJS.Timeout> = new Map();

// ============================================================================
// Webhook Delivery Logging
// ============================================================================

// Feature #1295: Webhook delivery log entry
export interface WebhookDeliveryLog {
  id: string;
  subscription_id: string;
  subscription_name: string;
  event_type: string;
  url: string;
  request: {
    method: string;
    headers: Record<string, string>;
    body: string;
    size_bytes: number;
  };
  response?: {
    status: number;
    headers: Record<string, string>;
    body?: string;
    size_bytes: number;
    duration_ms: number;
  };
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  attempt_number: number;
  max_attempts: number;
  status: 'success' | 'failed' | 'pending_retry';
  timestamp: Date;
  completed_at?: Date;
  context?: {
    run_id?: string;
    project_id?: string;
    test_id?: string;
  };
}

// In-memory store for webhook delivery logs
export const webhookDeliveryLogs: Map<string, WebhookDeliveryLog> = new Map();

// ============================================================================
// Webhook Subscriptions Store
// ============================================================================

// Store webhook subscriptions
export const webhookSubscriptions: Map<string, WebhookSubscription> = new Map();

// ============================================================================
// Helper Functions
// ============================================================================

// Feature #1294: Exponential backoff delays in milliseconds (1s, 2s, 4s, 8s, 16s)
export const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000];

// Feature #1299: Helper function to check if a subscription matches a project
// Supports both legacy project_id (single project) and new project_ids (multi-project) filtering
export function subscriptionMatchesProject(sub: WebhookSubscription, projectId: string): boolean {
  // If subscription has project_ids array, check if projectId is in it
  if (sub.project_ids && sub.project_ids.length > 0) {
    return sub.project_ids.includes(projectId);
  }
  // Fall back to legacy project_id check
  // If no project_id is set, subscription applies to all projects
  return !sub.project_id || sub.project_id === projectId;
}

// Feature #1300: Helper function to check if a subscription matches a result status
// If result_statuses is not set or empty, subscription triggers for all statuses
export function subscriptionMatchesResultStatus(
  sub: WebhookSubscription,
  resultStatus: 'passed' | 'failed' | 'skipped' | 'error' | string
): boolean {
  // If no result_statuses filter is set, match all statuses
  if (!sub.result_statuses || sub.result_statuses.length === 0) {
    return true;
  }
  // Check if the result status is in the subscription's filter
  return sub.result_statuses.includes(resultStatus as 'passed' | 'failed' | 'skipped' | 'error');
}

// Feature #1300: Helper function to check if any results match the subscription's status filter
export function subscriptionMatchesAnyResultStatus(
  sub: WebhookSubscription,
  results: Array<{ status: string }>
): boolean {
  // If no result_statuses filter is set, match all
  if (!sub.result_statuses || sub.result_statuses.length === 0) {
    return true;
  }
  // Check if any result matches the filter
  return results.some(r => subscriptionMatchesResultStatus(sub, r.status));
}

// ============================================================================
// Webhook Delivery Functions
// ============================================================================

// Flush a batch for a subscription
export async function flushWebhookBatch(subscriptionId: string): Promise<void> {
  const subscription = webhookSubscriptions.get(subscriptionId);
  if (!subscription) {
    webhookBatchQueues.delete(subscriptionId);
    return;
  }

  const batch = webhookBatchQueues.get(subscriptionId);
  if (!batch || batch.length === 0) {
    return;
  }

  // Clear the batch and timer
  webhookBatchQueues.delete(subscriptionId);
  const timer = webhookBatchTimers.get(subscriptionId);
  if (timer) {
    clearTimeout(timer);
    webhookBatchTimers.delete(subscriptionId);
  }

  console.log(`[WEBHOOK] Flushing batch of ${batch.length} events for subscription ${subscription.name}`);

  // Use the first entry's context for logging
  const firstEntry = batch[0];
  const lastEntry = batch[batch.length - 1];

  // Build batched payload
  const batchedPayload = {
    batch: true,
    event_count: batch.length,
    events: batch.map(entry => ({
      event: entry.eventType,
      timestamp: entry.addedAt.toISOString(),
      ...entry.payload,
    })),
    first_event_at: firstEntry?.addedAt.toISOString() || new Date().toISOString(),
    last_event_at: lastEntry?.addedAt.toISOString() || new Date().toISOString(),
    flushed_at: new Date().toISOString(),
  };

  // Send the batch using the retry-enabled delivery
  await deliverWebhookWithRetry(subscription, batchedPayload, 'batch', {
    runId: firstEntry?.context?.runId,
    projectId: firstEntry?.context?.projectId,
  });
}

// Add an event to a subscription's batch
export async function addToBatch(
  subscription: WebhookSubscription,
  payload: Record<string, any>,
  eventType: string,
  context?: { runId?: string; projectId?: string }
): Promise<void> {
  const batchSize = subscription.batch_size || 10;
  const batchInterval = subscription.batch_interval_seconds || 5;

  // Initialize batch if needed
  if (!webhookBatchQueues.has(subscription.id)) {
    webhookBatchQueues.set(subscription.id, []);
  }

  const batch = webhookBatchQueues.get(subscription.id)!;

  // Add to batch
  batch.push({
    payload,
    eventType,
    context,
    addedAt: new Date(),
  });

  console.log(`[WEBHOOK] Added event to batch for ${subscription.name} (${batch.length}/${batchSize})`);

  // Flush if batch is full
  if (batch.length >= batchSize) {
    await flushWebhookBatch(subscription.id);
    return;
  }

  // Set or reset the flush timer
  const existingTimer = webhookBatchTimers.get(subscription.id);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(async () => {
    await flushWebhookBatch(subscription.id);
  }, batchInterval * 1000);

  webhookBatchTimers.set(subscription.id, timer);
}

// Feature #1304: Deliver or batch webhook
// If batch_enabled is true on subscription, adds to batch queue instead of immediate delivery
export async function deliverOrBatchWebhook(
  subscription: WebhookSubscription,
  payload: Record<string, any>,
  eventType: string,
  context?: { runId?: string; projectId?: string }
): Promise<{ success: boolean; attempts: number; error?: string; deliveryId: string } | { batched: true }> {
  // Check if batching is enabled for this subscription
  if (subscription.batch_enabled) {
    await addToBatch(subscription, payload, eventType, context);
    return { batched: true };
  }

  // Otherwise, deliver immediately
  return deliverWebhookWithRetry(subscription, payload, eventType, context);
}

// Feature #1294: Deliver webhook with retry support
// Feature #1295: Enhanced with detailed delivery logging
export async function deliverWebhookWithRetry(
  subscription: WebhookSubscription,
  payload: Record<string, any>,
  eventType: string,
  context?: { runId?: string; projectId?: string }
): Promise<{ success: boolean; attempts: number; error?: string; deliveryId: string }> {
  const maxRetries = subscription.max_retries ?? 5;
  const retryEnabled = subscription.retry_enabled ?? true;
  const maxAttempts = retryEnabled ? maxRetries : 1;

  const deliveryId = `del_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startTime = Date.now();

    // Feature #1291: Apply custom template if specified
    const finalPayload = applyPayloadTemplate(subscription, payload);
    const payloadJson = JSON.stringify(finalPayload);

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': eventType,
      'X-Webhook-Delivery': deliveryId,
      'X-Webhook-Attempt': String(attempt),
      ...(subscription.headers || {}),
    };

    // Add HMAC signature if secret is configured
    if (subscription.secret) {
      const signature = crypto
        .createHmac('sha256', subscription.secret)
        .update(payloadJson)
        .digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    // Feature #1295: Create delivery log entry
    const logEntry: WebhookDeliveryLog = {
      id: `${deliveryId}_${attempt}`,
      subscription_id: subscription.id,
      subscription_name: subscription.name,
      event_type: eventType,
      url: subscription.url,
      request: {
        method: 'POST',
        headers,
        body: payloadJson,
        size_bytes: Buffer.byteLength(payloadJson, 'utf-8'),
      },
      attempt_number: attempt,
      max_attempts: maxAttempts,
      status: 'pending_retry',
      timestamp: new Date(),
      context: {
        run_id: context?.runId,
        project_id: context?.projectId,
      },
    };

    try {
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers,
        body: payloadJson,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      const duration = Date.now() - startTime;
      const responseBody = await response.text().catch(() => '');

      // Feature #1295: Update log entry with response
      // Convert headers to object (compatible with different Header implementations)
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value: string, key: string) => {
        responseHeaders[key] = value;
      });
      logEntry.response = {
        status: response.status,
        headers: responseHeaders,
        body: responseBody.substring(0, 1000), // Truncate large responses
        size_bytes: Buffer.byteLength(responseBody, 'utf-8'),
        duration_ms: duration,
      };

      if (response.ok) {
        console.log(`[WEBHOOK] Successfully delivered ${eventType} to ${subscription.name} (attempt ${attempt}/${maxAttempts})`);
        subscription.success_count++;
        subscription.last_triggered_at = new Date();
        subscription.updated_at = new Date();
        webhookSubscriptions.set(subscription.id, subscription);

        // Feature #1295: Log successful delivery
        logEntry.status = 'success';
        logEntry.completed_at = new Date();
        logWebhookDelivery(logEntry);

        return { success: true, attempts: attempt, deliveryId };
      }

      // Check if error is retriable (5xx errors)
      if (response.status >= 500 && attempt < maxAttempts) {
        console.log(`[WEBHOOK] Server error ${response.status} for ${subscription.name}, retrying (attempt ${attempt}/${maxAttempts})`);
        logEntry.status = 'pending_retry';
        logWebhookDelivery(logEntry);

        // Wait before retry with exponential backoff
        const delay = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Non-retriable error or max retries reached
      console.error(`[WEBHOOK] Failed to deliver ${eventType} to ${subscription.name}: HTTP ${response.status}`);
      subscription.failure_count++;
      subscription.updated_at = new Date();
      webhookSubscriptions.set(subscription.id, subscription);

      // Feature #1295: Log non-retriable failure
      logEntry.status = 'failed';
      logEntry.error = { message: `HTTP ${response.status}: ${responseBody.substring(0, 500)}` };
      logEntry.completed_at = new Date();
      logWebhookDelivery(logEntry);

      return { success: false, attempts: attempt, error: `HTTP ${response.status}`, deliveryId };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      if (attempt < maxAttempts) {
        console.log(`[WEBHOOK] Error delivering to ${subscription.name}: ${error.message}, retrying (attempt ${attempt}/${maxAttempts})`);

        // Feature #1295: Log failed attempt before retry
        logEntry.status = 'pending_retry';
        logEntry.error = {
          message: error.message,
          code: error.code,
          stack: error.stack?.substring(0, 500),
        };
        logEntry.response = {
          status: 0,
          headers: {},
          duration_ms: duration,
          size_bytes: 0,
        };
        logWebhookDelivery(logEntry);

        // Wait before retry
        const delay = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Max retries exhausted
      console.error(`[WEBHOOK] Failed to deliver ${eventType} to ${subscription.name} after ${maxAttempts} attempts: ${error.message}`);
      subscription.failure_count++;
      subscription.updated_at = new Date();
      webhookSubscriptions.set(subscription.id, subscription);

      // Feature #1295: Log error attempt
      logEntry.status = 'failed';
      logEntry.error = {
        message: error.message,
        code: error.code,
        stack: error.stack?.substring(0, 500),
      };
      logEntry.response = {
        status: 0,
        headers: {},
        duration_ms: duration,
        size_bytes: 0,
      };
      logEntry.completed_at = new Date();
      logWebhookDelivery(logEntry);

      return { success: false, attempts: attempt, error: error.message, deliveryId };
    }
  }

  // Should not reach here, but TypeScript needs a return
  return { success: false, attempts: maxAttempts, error: 'Max retries exceeded', deliveryId };
}

// Feature #1295: Helper function to log webhook delivery details
export function logWebhookDelivery(log: WebhookDeliveryLog): void {
  webhookDeliveryLogs.set(log.id, log);

  // Keep only last 1000 logs per subscription to prevent memory bloat
  const subLogs = Array.from(webhookDeliveryLogs.entries())
    .filter(([_, l]) => l.subscription_id === log.subscription_id)
    .sort((a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime());

  if (subLogs.length > 1000) {
    // Remove oldest logs beyond 1000
    subLogs.slice(1000).forEach(([id]) => webhookDeliveryLogs.delete(id));
  }

  console.log(`[WEBHOOK] Logged delivery ${log.id}: ${log.status} (${log.event_type} -> ${log.subscription_name})`);
}

// Feature #1295: Get delivery logs for a subscription
export function getWebhookDeliveryLogs(
  subscriptionId: string,
  options?: { limit?: number; offset?: number; status?: 'success' | 'failed' | 'pending_retry' }
): { logs: WebhookDeliveryLog[]; total: number } {
  let logs = Array.from(webhookDeliveryLogs.values())
    .filter(log => log.subscription_id === subscriptionId);

  if (options?.status) {
    logs = logs.filter(log => log.status === options.status);
  }

  const total = logs.length;

  // Sort by timestamp descending
  logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Apply pagination
  const offset = options?.offset || 0;
  const limit = options?.limit || 50;
  logs = logs.slice(offset, offset + limit);

  return { logs, total };
}

// ============================================================================
// Template Processing
// ============================================================================

// Feature #1291: Template variable interpolation function
export function interpolateTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const keys = path.trim().split('.');
    let value: any = data;

    for (const key of keys) {
      if (value === undefined || value === null) {
        return match; // Return original placeholder if path not found
      }
      value = value[key];
    }

    if (value === undefined || value === null) {
      return match;
    }

    // Convert objects/arrays to JSON strings
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  });
}

// Feature #1291: Apply custom template to webhook payload
export function applyPayloadTemplate(
  subscription: WebhookSubscription,
  defaultPayload: Record<string, any>
): Record<string, any> {
  if (!subscription.payload_template) {
    return defaultPayload;
  }

  try {
    // Interpolate the template with the default payload values
    const interpolated = interpolateTemplate(subscription.payload_template, defaultPayload);
    // Parse the result as JSON
    return JSON.parse(interpolated);
  } catch (error: any) {
    console.error(`[WEBHOOK] Failed to apply payload template for ${subscription.name}: ${error.message}`);
    // Fall back to default payload on error
    return defaultPayload;
  }
}
