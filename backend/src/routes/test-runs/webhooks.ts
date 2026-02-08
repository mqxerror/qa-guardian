/**
 * Test Runs - Webhooks Module
 * Feature #1283-1315: Webhook event delivery and management
 * Feature #329: Persist webhook subscriptions and logs to PostgreSQL
 * Feature #362: Redis Pub/Sub cache invalidation for horizontal scaling
 *
 * Extracted from test-runs.ts for code quality (#1356)
 */

import * as crypto from 'crypto';
import { Redis } from 'ioredis';
import { validateWebhookURL, validateWebhookURLWithDNS, generateId } from '../../utils/index.js';
import { queueWebhookDelivery, isWebhookQueueReady, WEBHOOK_AUTO_DISABLE_THRESHOLD, generateWebhookSignature, type SubscriptionStatsResult } from '../../services/webhook-queue.js';

// Re-export generateWebhookSignature for consumers of this module (Feature #357)
export { generateWebhookSignature };
import * as webhookRepo from '../../services/repositories/webhooks.js';

// ============================================================================
// Feature #362: Redis Pub/Sub for Webhook Cache Invalidation
// ============================================================================

const WEBHOOK_SUBSCRIPTIONS_CHANNEL = 'qa-guardian:webhook-subscriptions-changed';

// Feature #362: Cache TTL as safety net (default 5 minutes)
const WEBHOOK_CACHE_TTL_MS = parseInt(process.env.WEBHOOK_CACHE_TTL || '300000', 10);

// Feature #362: Track cache timestamps per org for TTL-based refresh
const orgCacheTimestamps: Map<string, number> = new Map();

// Feature #362: Redis Pub/Sub clients
let webhookPubClient: Redis | null = null;
let webhookSubClient: Redis | null = null;
let webhookPubSubInitialized = false;

/**
 * Feature #362: Cache invalidation message payload
 */
interface WebhookCacheInvalidationMessage {
  action: 'create' | 'update' | 'delete';
  subscription_id: string;
  organization_id: string;
  timestamp: number;
  source_instance?: string; // Optional instance ID for debugging
}

/**
 * Feature #362: Initialize Redis Pub/Sub for webhook cache invalidation
 * Call this after database connection is established in startup
 */
export async function initializeWebhookPubSub(): Promise<boolean> {
  if (webhookPubSubInitialized) {
    return true;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redisPassword = process.env.REDIS_PASSWORD;

  try {
    const url = new URL(redisUrl);
    const redisOptions: { host: string; port: number; password?: string; maxRetriesPerRequest: null } = {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      maxRetriesPerRequest: null, // Required for pub/sub
    };

    if (redisPassword) {
      redisOptions.password = redisPassword;
    } else if (url.password) {
      redisOptions.password = url.password;
    }

    // Create publisher and subscriber clients
    webhookPubClient = new Redis(redisOptions);
    webhookSubClient = new Redis(redisOptions);

    // Wait for connections
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        webhookPubClient!.once('ready', resolve);
        webhookPubClient!.once('error', reject);
        setTimeout(() => reject(new Error('Webhook pub client timeout')), 5000);
      }),
      new Promise<void>((resolve, reject) => {
        webhookSubClient!.once('ready', resolve);
        webhookSubClient!.once('error', reject);
        setTimeout(() => reject(new Error('Webhook sub client timeout')), 5000);
      }),
    ]);

    // Subscribe to the channel
    await webhookSubClient.subscribe(WEBHOOK_SUBSCRIPTIONS_CHANNEL);

    // Handle incoming messages
    webhookSubClient.on('message', async (channel: string, message: string) => {
      if (channel !== WEBHOOK_SUBSCRIPTIONS_CHANNEL) return;

      try {
        const payload = JSON.parse(message) as WebhookCacheInvalidationMessage;
        console.log(`[WEBHOOK] Received cache invalidation: ${payload.action} for subscription ${payload.subscription_id} in org ${payload.organization_id}`);

        // Reload subscriptions for this organization from database
        await reloadOrganizationSubscriptions(payload.organization_id);
      } catch (err) {
        console.error('[WEBHOOK] Failed to process cache invalidation message:', err);
      }
    });

    webhookPubSubInitialized = true;
    console.log('[WEBHOOK] Redis Pub/Sub for cache invalidation initialized');
    return true;
  } catch (err) {
    console.warn('[WEBHOOK] Redis Pub/Sub not available, running in single-instance mode:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Feature #362: Publish a cache invalidation message to all instances
 */
async function publishCacheInvalidation(
  action: 'create' | 'update' | 'delete',
  subscriptionId: string,
  organizationId: string
): Promise<void> {
  if (!webhookPubClient || !webhookPubSubInitialized) {
    return; // No Redis available, single-instance mode
  }

  const message: WebhookCacheInvalidationMessage = {
    action,
    subscription_id: subscriptionId,
    organization_id: organizationId,
    timestamp: Date.now(),
    source_instance: process.env.INSTANCE_ID || process.pid.toString(),
  };

  try {
    await webhookPubClient.publish(WEBHOOK_SUBSCRIPTIONS_CHANNEL, JSON.stringify(message));
    console.log(`[WEBHOOK] Published cache invalidation: ${action} for subscription ${subscriptionId}`);
  } catch (err) {
    console.error('[WEBHOOK] Failed to publish cache invalidation:', err);
  }
}

/**
 * Feature #362: Reload all subscriptions for an organization from database
 */
async function reloadOrganizationSubscriptions(organizationId: string): Promise<void> {
  try {
    const dbSubscriptions = await webhookRepo.loadAllSubscriptions();

    // Remove old entries for this org
    for (const [id, sub] of webhookSubscriptions.entries()) {
      if (sub.organization_id === organizationId) {
        webhookSubscriptions.delete(id);
      }
    }

    // Add fresh entries from database
    for (const [id, sub] of dbSubscriptions) {
      if (sub.organization_id === organizationId) {
        webhookSubscriptions.set(id, sub);
      }
    }

    // Update cache timestamp
    orgCacheTimestamps.set(organizationId, Date.now());

    console.log(`[WEBHOOK] Reloaded subscriptions for org ${organizationId}`);
  } catch (err) {
    console.error(`[WEBHOOK] Failed to reload subscriptions for org ${organizationId}:`, err);
  }
}

/**
 * Feature #362: Check if cache for an organization is stale (TTL expired)
 * Used as a safety net even if Pub/Sub messages are missed
 */
export function isCacheStale(organizationId: string): boolean {
  const lastRefresh = orgCacheTimestamps.get(organizationId);
  if (!lastRefresh) {
    return true; // Never refreshed, consider stale
  }
  return Date.now() - lastRefresh > WEBHOOK_CACHE_TTL_MS;
}

/**
 * Feature #362: Ensure fresh cache for an organization
 * Call this before reading subscriptions to handle TTL-based refresh
 */
export async function ensureFreshCache(organizationId: string): Promise<void> {
  if (isCacheStale(organizationId)) {
    await reloadOrganizationSubscriptions(organizationId);
  }
}

/**
 * Feature #362: Close Redis Pub/Sub connections gracefully
 */
export async function closeWebhookPubSub(): Promise<void> {
  if (webhookSubClient) {
    await webhookSubClient.unsubscribe(WEBHOOK_SUBSCRIPTIONS_CHANNEL);
    await webhookSubClient.quit();
    webhookSubClient = null;
  }
  if (webhookPubClient) {
    await webhookPubClient.quit();
    webhookPubClient = null;
  }
  webhookPubSubInitialized = false;
  console.log('[WEBHOOK] Redis Pub/Sub connections closed');
}

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
  max_retries?: number; // Max retry attempts (default: 3 per Feature #330)
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
  // Feature #321: Auto-disable on sustained failure
  consecutive_failures: number; // Track consecutive failed deliveries (reset on success)
  disabled_at?: Date; // Timestamp when auto-disabled
  disable_reason?: string; // Reason for disable (e.g., "10 consecutive failures")
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
// Webhook Payload Types (Feature #358: Replace Record<string, any>)
// ============================================================================

/**
 * Base interface for all webhook payloads.
 * All payloads must include event type and timestamp.
 * Index signature allows arbitrary additional properties.
 */
export interface WebhookPayloadBase {
  event: WebhookEventType | 'batch' | 'test' | string;
  timestamp: string;
  organization_id?: string;
  project_id?: string;
  [key: string]: unknown; // Allow arbitrary additional properties
}

/**
 * Test run event payload
 */
export interface TestRunPayload extends WebhookPayloadBase {
  run_id: string;
  run_name?: string;
  status: 'started' | 'running' | 'completed' | 'failed' | 'passed';
  total_tests?: number;
  passed_tests?: number;
  failed_tests?: number;
  skipped_tests?: number;
  duration_ms?: number;
  triggered_by?: string;
}

/**
 * Test result event payload
 */
export interface TestResultPayload extends WebhookPayloadBase {
  test_id: string;
  test_name: string;
  suite_id?: string;
  suite_name?: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration_ms?: number;
  error_message?: string;
}

/**
 * Visual diff event payload
 */
export interface VisualDiffPayload extends WebhookPayloadBase {
  baseline_id: string;
  comparison_id: string;
  diff_percentage: number;
  viewport?: string;
  url?: string;
}

/**
 * Security vulnerability event payload
 */
export interface SecurityPayload extends WebhookPayloadBase {
  scan_id: string;
  vulnerability_count: number;
  severity_breakdown?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Batch webhook payload (aggregated events)
 */
export interface BatchWebhookPayload extends WebhookPayloadBase {
  event: 'batch';
  subscription_id: string;
  subscription_name: string;
  events: WebhookPayload[];
  event_types: string[];
  first_event_at: string;
  last_event_at: string;
}

/**
 * Generic webhook payload type.
 * Uses union of known types with fallback to base + arbitrary properties.
 */
export type WebhookPayload =
  | TestRunPayload
  | TestResultPayload
  | VisualDiffPayload
  | SecurityPayload
  | BatchWebhookPayload
  | (WebhookPayloadBase & Record<string, unknown>);

// ============================================================================
// Webhook Delivery Tracking
// ============================================================================

// Feature #1294: Webhook delivery attempt tracking
export interface WebhookDeliveryAttempt {
  id: string;
  subscription_id: string;
  event: string;
  payload: WebhookPayload; // Feature #358: Use typed payload
  attempt_number: number;
  max_attempts: number;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  response_status?: number;
  error?: string;
  created_at: Date;
  next_retry_at?: Date;
  completed_at?: Date;
}

// ============================================================================
// Webhook Batching
// ============================================================================

// Feature #1304: Webhook batch queue
export interface WebhookBatchEntry {
  payload: WebhookPayload; // Feature #358: Use typed payload
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

// Store webhook subscriptions (in-memory cache, synced with database)
export const webhookSubscriptions: Map<string, WebhookSubscription> = new Map();

// Feature #329: Flag to track if we've loaded from database
let subscriptionsLoadedFromDb = false;

/**
 * Feature #329: Initialize subscriptions from database on startup
 * Call this once during server initialization
 */
export async function initializeWebhookSubscriptionsFromDb(): Promise<void> {
  if (subscriptionsLoadedFromDb) {
    return; // Already loaded
  }

  try {
    const dbSubscriptions = await webhookRepo.loadAllSubscriptions();
    for (const [id, sub] of dbSubscriptions) {
      webhookSubscriptions.set(id, sub);
    }
    subscriptionsLoadedFromDb = true;
    console.log(`[WEBHOOK] Initialized ${webhookSubscriptions.size} subscriptions from database`);
  } catch (error) {
    console.error('[WEBHOOK] Failed to load subscriptions from database:', error);
    // Continue with empty cache - will work in-memory only
  }
}

/**
 * Feature #329: Create subscription in both memory and database
 * Feature #362: Publishes cache invalidation to Redis Pub/Sub for horizontal scaling
 */
export async function createWebhookSubscriptionInDb(subscription: WebhookSubscription): Promise<WebhookSubscription> {
  // Add to memory first
  webhookSubscriptions.set(subscription.id, subscription);

  // Persist to database
  try {
    await webhookRepo.createSubscription(subscription);
  } catch (error) {
    console.error(`[WEBHOOK] Failed to persist subscription ${subscription.id} to database:`, error);
    // Continue with in-memory only
  }

  // Feature #362: Notify other instances about the new subscription
  await publishCacheInvalidation('create', subscription.id, subscription.organization_id);

  return subscription;
}

/**
 * Feature #329: Update subscription in both memory and database
 * Feature #362: Publishes cache invalidation to Redis Pub/Sub for horizontal scaling
 */
export async function updateWebhookSubscriptionInDb(
  subscriptionId: string,
  updates: Partial<WebhookSubscription>
): Promise<WebhookSubscription | undefined> {
  const subscription = webhookSubscriptions.get(subscriptionId);
  if (!subscription) {
    return undefined;
  }

  // Apply updates to in-memory copy
  Object.assign(subscription, updates);
  subscription.updated_at = new Date();
  webhookSubscriptions.set(subscriptionId, subscription);

  // Persist to database
  try {
    await webhookRepo.updateSubscription(subscriptionId, updates);
  } catch (error) {
    console.error(`[WEBHOOK] Failed to persist subscription update ${subscriptionId} to database:`, error);
    // Continue with in-memory only
  }

  // Feature #362: Notify other instances about the updated subscription
  await publishCacheInvalidation('update', subscriptionId, subscription.organization_id);

  return subscription;
}

/**
 * Feature #329: Delete subscription from both memory and database
 * Feature #362: Publishes cache invalidation to Redis Pub/Sub for horizontal scaling
 */
export async function deleteWebhookSubscriptionFromDb(subscriptionId: string): Promise<boolean> {
  // Feature #362: Capture organization_id before deleting from map
  const subscription = webhookSubscriptions.get(subscriptionId);
  const organizationId = subscription?.organization_id;

  const existed = webhookSubscriptions.delete(subscriptionId);

  // Delete from database
  try {
    await webhookRepo.deleteSubscription(subscriptionId);
  } catch (error) {
    console.error(`[WEBHOOK] Failed to delete subscription ${subscriptionId} from database:`, error);
    // Continue even if DB delete fails
  }

  // Feature #362: Notify other instances about the deleted subscription
  if (organizationId) {
    await publishCacheInvalidation('delete', subscriptionId, organizationId);
  }

  return existed;
}

// ============================================================================
// Helper Functions
// ============================================================================

// Feature #330: Retry delays per specification (1 min, 5 min, 30 min)
// Max 3 retry attempts with progressively longer delays
export const RETRY_DELAYS = [60000, 300000, 1800000]; // 1 min, 5 min, 30 min in ms

// Feature #330: Maximum retry attempts (3 retries = 4 total attempts)
export const MAX_WEBHOOK_RETRIES = 3;

// Feature #314: Stripe-style HMAC webhook signing
// Replay protection window in seconds (5 minutes)
export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;

// generateWebhookSignature is now imported from webhook-queue.js (Feature #357)

/**
 * Verify Stripe-style webhook signature with replay protection
 *
 * Parses the signature header format: t=timestamp,v1=hmac_signature
 * Verifies the HMAC and checks that the timestamp is within the tolerance window.
 *
 * Feature #314: Stripe-style HMAC verification with replay protection
 *
 * @param payload - The raw request body as string
 * @param signatureHeader - The X-Webhook-Signature header value
 * @param secret - The webhook secret
 * @param toleranceSeconds - Maximum age of signature in seconds (default: 300 = 5 minutes)
 * @returns Object with verified status and any error message
 */
export function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds: number = WEBHOOK_SIGNATURE_TOLERANCE_SECONDS
): { verified: boolean; error?: string; timestamp?: number } {
  // Parse the signature header: t=timestamp,v1=signature
  const parts = signatureHeader.split(',');
  let timestamp: number | undefined;
  let providedSignature: string | undefined;

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') {
      timestamp = parseInt(value, 10);
    } else if (key === 'v1') {
      providedSignature = value;
    }
  }

  // Validate parsed values
  if (!timestamp || isNaN(timestamp)) {
    return { verified: false, error: 'Invalid signature format: missing or invalid timestamp' };
  }
  if (!providedSignature) {
    return { verified: false, error: 'Invalid signature format: missing v1 signature' };
  }

  // Check timestamp is within tolerance (replay protection)
  const currentTime = Math.floor(Date.now() / 1000);
  const age = currentTime - timestamp;

  if (age > toleranceSeconds) {
    return {
      verified: false,
      error: `Signature expired: timestamp is ${age} seconds old (max ${toleranceSeconds}s)`,
      timestamp,
    };
  }

  if (age < -toleranceSeconds) {
    return {
      verified: false,
      error: 'Signature timestamp is in the future',
      timestamp,
    };
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    const providedBuffer = Buffer.from(providedSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (providedBuffer.length !== expectedBuffer.length) {
      return { verified: false, error: 'Signature mismatch', timestamp };
    }

    const match = crypto.timingSafeEqual(providedBuffer, expectedBuffer);
    return {
      verified: match,
      error: match ? undefined : 'Signature mismatch',
      timestamp,
    };
  } catch {
    return { verified: false, error: 'Invalid signature encoding', timestamp };
  }
}

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
// Feature #321: Auto-disable on Sustained Failure
// ============================================================================

/**
 * Update subscription stats after a delivery attempt
 * Tracks consecutive failures and auto-disables after threshold
 *
 * Feature #321: Auto-disable on sustained failure
 * Feature #329: Persists stats updates to database
 */
export async function updateSubscriptionDeliveryStats(
  subscriptionId: string,
  success: boolean
): Promise<SubscriptionStatsResult | void> {
  const subscription = webhookSubscriptions.get(subscriptionId);
  if (!subscription) {
    console.warn(`[WEBHOOK] Cannot update stats: subscription ${subscriptionId} not found`);
    return;
  }

  if (success) {
    // Reset consecutive failures on success
    subscription.consecutive_failures = 0;
    subscription.success_count++;
    subscription.last_triggered_at = new Date();
    subscription.updated_at = new Date();
    webhookSubscriptions.set(subscriptionId, subscription);

    // Feature #329: Persist to database
    webhookRepo.updateSubscription(subscriptionId, {
      consecutive_failures: 0,
      success_count: subscription.success_count,
      last_triggered_at: subscription.last_triggered_at,
    }).catch(err => console.error(`[WEBHOOK] Failed to persist stats update:`, err));

    return {
      consecutiveFailures: 0,
      autoDisabled: false,
    };
  }

  // Increment consecutive failures
  subscription.consecutive_failures = (subscription.consecutive_failures || 0) + 1;
  subscription.failure_count++;
  subscription.updated_at = new Date();

  // Feature #321: Check if we should auto-disable
  if (subscription.consecutive_failures >= WEBHOOK_AUTO_DISABLE_THRESHOLD && subscription.enabled) {
    subscription.enabled = false;
    subscription.disabled_at = new Date();
    subscription.disable_reason = `Auto-disabled after ${subscription.consecutive_failures} consecutive delivery failures`;

    console.warn(
      `[WEBHOOK] Auto-disabled subscription ${subscription.name} (${subscriptionId}) ` +
      `after ${subscription.consecutive_failures} consecutive failures`
    );
  }

  webhookSubscriptions.set(subscriptionId, subscription);

  // Feature #329: Persist to database
  webhookRepo.updateSubscription(subscriptionId, {
    consecutive_failures: subscription.consecutive_failures,
    failure_count: subscription.failure_count,
    enabled: subscription.enabled,
    disabled_at: subscription.disabled_at,
    disable_reason: subscription.disable_reason,
  }).catch(err => console.error(`[WEBHOOK] Failed to persist stats update:`, err));

  return {
    consecutiveFailures: subscription.consecutive_failures,
    autoDisabled: !subscription.enabled,
    disableReason: subscription.disable_reason,
  };
}

/**
 * Re-enable a disabled webhook subscription
 *
 * Feature #321: Manual re-enable after auto-disable
 */
export function reEnableWebhookSubscription(
  subscriptionId: string
): { success: boolean; subscription?: WebhookSubscription; error?: string } {
  const subscription = webhookSubscriptions.get(subscriptionId);
  if (!subscription) {
    return { success: false, error: 'Subscription not found' };
  }

  if (subscription.enabled) {
    return { success: false, error: 'Subscription is already enabled' };
  }

  // Re-enable and reset failure tracking
  subscription.enabled = true;
  subscription.consecutive_failures = 0;
  subscription.disabled_at = undefined;
  subscription.disable_reason = undefined;
  subscription.updated_at = new Date();

  webhookSubscriptions.set(subscriptionId, subscription);

  console.log(`[WEBHOOK] Re-enabled subscription ${subscription.name} (${subscriptionId})`);

  return { success: true, subscription };
}

/**
 * Get auto-disable status for a subscription
 *
 * Feature #321: Check if subscription was auto-disabled
 */
export function getWebhookAutoDisableStatus(subscriptionId: string): {
  found: boolean;
  enabled?: boolean;
  consecutiveFailures?: number;
  disabledAt?: Date;
  disableReason?: string;
  warningThreshold?: number;
} {
  const subscription = webhookSubscriptions.get(subscriptionId);
  if (!subscription) {
    return { found: false };
  }

  return {
    found: true,
    enabled: subscription.enabled,
    consecutiveFailures: subscription.consecutive_failures || 0,
    disabledAt: subscription.disabled_at,
    disableReason: subscription.disable_reason,
    warningThreshold: Math.floor(WEBHOOK_AUTO_DISABLE_THRESHOLD * 0.7), // Warn at 70% of threshold
  };
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

  // Build batched payload (Feature #358: typed as BatchWebhookPayload)
  const batchedPayload: BatchWebhookPayload = {
    event: 'batch',
    timestamp: new Date().toISOString(),
    subscription_id: subscriptionId,
    subscription_name: subscription.name,
    events: batch.map(entry => ({
      ...entry.payload,
      event: entry.eventType,
      timestamp: entry.addedAt.toISOString(),
    })) as WebhookPayload[],
    event_types: [...new Set(batch.map(e => e.eventType))],
    first_event_at: firstEntry?.addedAt.toISOString() || new Date().toISOString(),
    last_event_at: lastEntry?.addedAt.toISOString() || new Date().toISOString(),
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
  payload: WebhookPayload, // Feature #358: Use typed payload
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
  payload: WebhookPayload, // Feature #358: Use typed payload
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
// Feature #315: Added SSRF protection
// Feature #320: Uses BullMQ queue when available for reliable delivery
export async function deliverWebhookWithRetry(
  subscription: WebhookSubscription,
  payload: WebhookPayload, // Feature #358: Use typed payload
  eventType: string,
  context?: { runId?: string; projectId?: string }
): Promise<{ success: boolean; attempts: number; error?: string; deliveryId: string }> {
  const deliveryId = generateId('del', 7); // Feature #357: Use shared ID generator

  // Feature #320: Try to use BullMQ queue for reliable delivery
  if (isWebhookQueueReady()) {
    const result = await queueWebhookDelivery(
      subscription.id,
      subscription.name,
      subscription.url,
      payload,
      eventType,
      {
        headers: subscription.headers,
        secret: subscription.secret,
        maxRetries: subscription.max_retries ?? MAX_WEBHOOK_RETRIES,
        retryEnabled: subscription.retry_enabled ?? true,
        context,
      }
    );

    if (result.queued) {
      console.log(`[WEBHOOK] Queued ${eventType} for ${subscription.name} (job: ${result.jobId})`);
      // Return success since it's queued - actual delivery happens async
      return {
        success: true,
        attempts: 0,
        deliveryId: result.jobId || deliveryId,
      };
    }
    // If queueing failed, fall through to direct delivery
    console.warn(`[WEBHOOK] Queue unavailable, falling back to direct delivery: ${result.error}`);
  }

  // Fallback: Direct delivery (in-memory, not reliable on restart)
  console.log(`[WEBHOOK] Using direct delivery for ${eventType} to ${subscription.name}`);

  // Feature #315 + #400: SSRF protection with DNS resolution check
  // This prevents DNS rebinding attacks where a hostname resolves to a private IP
  const ssrfValidation = await validateWebhookURLWithDNS(subscription.url);
  if (!ssrfValidation.safe) {
    console.error(`[WEBHOOK] SSRF protection blocked delivery to ${subscription.url}: ${ssrfValidation.error}`);
    return {
      success: false,
      attempts: 0,
      error: `SSRF protection: ${ssrfValidation.error}`,
      deliveryId,
    };
  }

  // Feature #330: Use MAX_WEBHOOK_RETRIES (3) as default
  const maxRetries = subscription.max_retries ?? MAX_WEBHOOK_RETRIES;
  const retryEnabled = subscription.retry_enabled ?? true;
  const maxAttempts = retryEnabled ? maxRetries : 1;

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
    // Feature #314: Stripe-style signing with timestamp for replay protection
    if (subscription.secret) {
      const { signature } = generateWebhookSignature(payloadJson, subscription.secret);
      headers['X-Webhook-Signature'] = signature;
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

        // Feature #321: Update stats with auto-disable tracking (resets consecutive failures)
        await updateSubscriptionDeliveryStats(subscription.id, true);

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

      // Feature #321: Update stats with auto-disable tracking (may auto-disable)
      const statsResult = await updateSubscriptionDeliveryStats(subscription.id, false);
      if (statsResult && statsResult.autoDisabled) {
        console.warn(`[WEBHOOK] Subscription ${subscription.name} has been auto-disabled`);
      }

      // Feature #1295: Log non-retriable failure
      logEntry.status = 'failed';
      logEntry.error = { message: `HTTP ${response.status}: ${responseBody.substring(0, 500)}` };
      logEntry.completed_at = new Date();
      logWebhookDelivery(logEntry);

      return { success: false, attempts: attempt, error: `HTTP ${response.status}`, deliveryId };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorObj = error instanceof Error ? error : new Error(String(error));
      const errorMessage = errorObj.message;
      const errorCode = (error as { code?: string }).code;
      const errorStack = errorObj.stack?.substring(0, 500);

      if (attempt < maxAttempts) {
        console.log(`[WEBHOOK] Error delivering to ${subscription.name}: ${errorMessage}, retrying (attempt ${attempt}/${maxAttempts})`);

        // Feature #1295: Log failed attempt before retry
        logEntry.status = 'pending_retry';
        logEntry.error = {
          message: errorMessage,
          code: errorCode,
          stack: errorStack,
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
      console.error(`[WEBHOOK] Failed to deliver ${eventType} to ${subscription.name} after ${maxAttempts} attempts: ${errorMessage}`);

      // Feature #321: Update stats with auto-disable tracking (may auto-disable)
      const statsResult = await updateSubscriptionDeliveryStats(subscription.id, false);
      if (statsResult && statsResult.autoDisabled) {
        console.warn(`[WEBHOOK] Subscription ${subscription.name} has been auto-disabled`);
      }

      // Feature #1295: Log error attempt
      logEntry.status = 'failed';
      logEntry.error = {
        message: errorMessage,
        code: errorCode,
        stack: errorStack,
      };
      logEntry.response = {
        status: 0,
        headers: {},
        duration_ms: duration,
        size_bytes: 0,
      };
      logEntry.completed_at = new Date();
      logWebhookDelivery(logEntry);

      return { success: false, attempts: attempt, error: errorMessage, deliveryId };
    }
  }

  // Should not reach here, but TypeScript needs a return
  return { success: false, attempts: maxAttempts, error: 'Max retries exceeded', deliveryId };
}

// Feature #1295: Helper function to log webhook delivery details
// Feature #329: Now also persists to database
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

  // Feature #329: Persist to database asynchronously (fire and forget)
  webhookRepo.createDeliveryLog(log).catch(error => {
    console.error(`[WEBHOOK] Failed to persist delivery log ${log.id} to database:`, error);
  });

  console.log(`[WEBHOOK] Logged delivery ${log.id}: ${log.status} (${log.event_type} -> ${log.subscription_name})`);
}

// Feature #1295: Get delivery logs for a subscription
// Feature #329: Now reads from database with fallback to in-memory cache
export async function getWebhookDeliveryLogsFromDb(
  subscriptionId: string,
  options?: { limit?: number; offset?: number; status?: 'success' | 'failed' | 'pending_retry' }
): Promise<{ logs: WebhookDeliveryLog[]; total: number }> {
  try {
    // Try database first
    return await webhookRepo.getDeliveryLogs(subscriptionId, options);
  } catch (error) {
    console.error(`[WEBHOOK] Failed to get delivery logs from database, using in-memory:`, error);
    // Fall back to in-memory
    return getWebhookDeliveryLogsInMemory(subscriptionId, options);
  }
}

// Legacy in-memory function for fallback
export function getWebhookDeliveryLogsInMemory(
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

// Alias for backward compatibility
export const getWebhookDeliveryLogs = getWebhookDeliveryLogsInMemory;

// ============================================================================
// Template Processing
// ============================================================================

// Feature #1291: Template variable interpolation function
// Feature #358: Use Record<string, unknown> for type safety
export function interpolateTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const keys = path.trim().split('.');
    let value: unknown = data;

    for (const key of keys) {
      if (value === undefined || value === null) {
        return match; // Return original placeholder if path not found
      }
      value = (value as Record<string, unknown>)[key];
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
// Feature #358: Use Record<string, unknown> for type safety
export function applyPayloadTemplate(
  subscription: WebhookSubscription,
  defaultPayload: Record<string, unknown>
): Record<string, unknown> {
  if (!subscription.payload_template) {
    return defaultPayload;
  }

  try {
    // Interpolate the template with the default payload values
    const interpolated = interpolateTemplate(subscription.payload_template, defaultPayload);
    // Parse the result as JSON
    return JSON.parse(interpolated);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[WEBHOOK] Failed to apply payload template for ${subscription.name}: ${errorMessage}`);
    // Fall back to default payload on error
    return defaultPayload;
  }
}
