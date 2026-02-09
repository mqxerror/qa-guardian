/**
 * Webhooks Repository - PostgreSQL persistence
 *
 * Feature #329: Persist webhook subscriptions and logs to PostgreSQL
 *
 * Provides CRUD operations for:
 * - Webhook subscriptions with full configuration
 * - Webhook delivery logs with pagination
 */

import { query, isDatabaseConnected } from '../database.js';
import type { WebhookSubscription, WebhookEventType, WebhookDeliveryLog } from '../../routes/test-runs/webhooks.js';
import { MAX_WEBHOOK_RETRIES } from '../../routes/test-runs/webhooks.js';
import { decrypt, encryptIfNeeded } from '../encryption.js'; // Feature #391: Encrypt webhook secrets at rest
// Feature #449: Use structured logger instead of console.*
import { createLogger } from '../logger.js';

const log = createLogger('repo:webhooks');

// ============================================
// Feature #462: Row interfaces to eliminate : any types
// ============================================

/** Database row type for webhook_subscriptions table */
interface WebhookSubscriptionRow {
  id: string;
  organization_id: string;
  project_id: string | null;
  project_ids: string[] | null;
  result_statuses: string[] | null;
  name: string;
  url: string;
  events: string[];
  headers: Record<string, string> | null;
  secret: string | null;
  payload_template: string | null;
  retry_enabled: boolean;
  max_retries: number;
  batch_enabled: boolean;
  batch_size: number;
  batch_interval_seconds: number;
  enabled: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  last_triggered_at: Date | string | null;
  failure_count: number;
  success_count: number;
  consecutive_failures: number;
  disabled_at: Date | string | null;
  disable_reason: string | null;
}

/** Database row type for webhook_delivery_logs table */
interface WebhookDeliveryLogRow {
  id: string;
  subscription_id: string;
  subscription_name: string;
  event_type: string;
  url: string;
  request_method: string;
  request_headers: Record<string, string>;
  request_body: string;
  request_size_bytes: number;
  response_status: number | null;
  response_headers: Record<string, string> | null;
  response_body: string | null;
  response_size_bytes: number | null;
  duration_ms: number | null;
  error_message: string | null;
  error_code: string | null;
  attempt_number: number;
  max_attempts: number;
  status: string;
  timestamp: Date | string;
  completed_at: Date | string | null;
  run_id: string | null;
  project_id: string | null;
  test_id: string | null;
}

/** Database row type for count queries */
interface CountRow {
  count: string;
}

// ============================================
// Column Constants (Feature #100: Replace SELECT * with explicit columns)
// ============================================

/**
 * Explicit column list for webhook_subscriptions table.
 */
const SUBSCRIPTION_COLUMNS = [
  'id', 'organization_id', 'project_id', 'project_ids', 'result_statuses',
  'name', 'url', 'events', 'headers', 'secret', 'payload_template',
  'retry_enabled', 'max_retries', 'batch_enabled', 'batch_size', 'batch_interval_seconds',
  'enabled', 'created_at', 'updated_at', 'last_triggered_at',
  'failure_count', 'success_count', 'consecutive_failures', 'disabled_at', 'disable_reason'
].join(', ');

/**
 * Explicit column list for webhook_delivery_logs table.
 */
const DELIVERY_LOG_COLUMNS = [
  'id', 'subscription_id', 'subscription_name', 'event_type', 'url',
  'request_method', 'request_headers', 'request_body', 'request_size_bytes',
  'response_status', 'response_headers', 'response_body', 'response_size_bytes', 'duration_ms',
  'error_message', 'error_code', 'attempt_number', 'max_attempts', 'status',
  'timestamp', 'completed_at', 'run_id', 'project_id', 'test_id'
].join(', ');

// ============================================
// Helper Functions
// ============================================

function parseSubscriptionRow(row: WebhookSubscriptionRow): WebhookSubscription {
  // Feature #391: Decrypt the webhook secret after SELECT
  let decryptedSecret: string | undefined;
  if (row.secret) {
    try {
      decryptedSecret = decrypt(row.secret);
    } catch (error) {
      // If decryption fails (e.g., key changed), log warning but don't break
      log.warn({ subscriptionId: row.id, error }, 'Failed to decrypt secret for subscription');
      decryptedSecret = undefined;
    }
  }

  return {
    id: row.id,
    organization_id: row.organization_id,
    project_id: row.project_id || undefined,
    project_ids: row.project_ids || undefined,
    result_statuses: (row.result_statuses || undefined) as WebhookSubscription['result_statuses'],
    name: row.name,
    url: row.url,
    events: row.events as WebhookEventType[],
    headers: row.headers || undefined,
    secret: decryptedSecret,
    payload_template: row.payload_template || undefined,
    retry_enabled: row.retry_enabled ?? true,
    max_retries: row.max_retries ?? MAX_WEBHOOK_RETRIES,
    batch_enabled: row.batch_enabled ?? false,
    batch_size: row.batch_size ?? 10,
    batch_interval_seconds: row.batch_interval_seconds ?? 60,
    enabled: row.enabled,
    created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    last_triggered_at: row.last_triggered_at ? new Date(row.last_triggered_at) : undefined,
    failure_count: row.failure_count || 0,
    success_count: row.success_count || 0,
    consecutive_failures: row.consecutive_failures || 0,
    disabled_at: row.disabled_at ? new Date(row.disabled_at) : undefined,
    disable_reason: row.disable_reason || undefined,
  };
}

function parseDeliveryLogRow(row: WebhookDeliveryLogRow): WebhookDeliveryLog {
  return {
    id: row.id,
    subscription_id: row.subscription_id,
    subscription_name: row.subscription_name,
    event_type: row.event_type,
    url: row.url,
    request: {
      method: row.request_method,
      headers: row.request_headers || {},
      body: row.request_body,
      size_bytes: row.request_size_bytes,
    },
    response: row.response_status !== null ? {
      status: row.response_status,
      headers: row.response_headers || {},
      body: row.response_body || undefined,
      size_bytes: row.response_size_bytes || 0,
      duration_ms: row.duration_ms || 0,
    } : undefined,
    error: row.error_message ? {
      message: row.error_message,
      code: row.error_code || undefined,
    } : undefined,
    attempt_number: row.attempt_number,
    max_attempts: row.max_attempts,
    status: row.status as 'success' | 'failed' | 'pending_retry',
    timestamp: row.timestamp instanceof Date ? row.timestamp : new Date(row.timestamp),
    completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
    context: {
      run_id: row.run_id || undefined,
      project_id: row.project_id || undefined,
      test_id: row.test_id || undefined,
    },
  };
}

// ============================================
// Subscription CRUD Operations
// ============================================

/**
 * Create a new webhook subscription
 */
export async function createSubscription(subscription: WebhookSubscription): Promise<WebhookSubscription> {
  if (!isDatabaseConnected()) {
    log.warn('Database not connected, subscription not persisted');
    return subscription;
  }

  // Feature #391: Encrypt the webhook secret before storing
  const encryptedSecret = subscription.secret ? encryptIfNeeded(subscription.secret) : null;

  const result = await query<WebhookSubscriptionRow>(
    `INSERT INTO webhook_subscriptions (
      id, organization_id, project_id, project_ids, result_statuses,
      name, url, events, headers, secret, payload_template,
      retry_enabled, max_retries, batch_enabled, batch_size, batch_interval_seconds,
      enabled, created_at, updated_at, last_triggered_at,
      failure_count, success_count, consecutive_failures, disabled_at, disable_reason
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
    RETURNING ${SUBSCRIPTION_COLUMNS}`,
    [
      subscription.id,
      subscription.organization_id,
      subscription.project_id || null,
      subscription.project_ids || [],
      subscription.result_statuses || [],
      subscription.name,
      subscription.url,
      subscription.events,
      subscription.headers ? JSON.stringify(subscription.headers) : null,
      encryptedSecret,
      subscription.payload_template || null,
      subscription.retry_enabled ?? true,
      subscription.max_retries ?? MAX_WEBHOOK_RETRIES,
      subscription.batch_enabled ?? false,
      subscription.batch_size ?? 10,
      subscription.batch_interval_seconds ?? 60,
      subscription.enabled,
      subscription.created_at,
      subscription.updated_at,
      subscription.last_triggered_at || null,
      subscription.failure_count,
      subscription.success_count,
      subscription.consecutive_failures,
      subscription.disabled_at || null,
      subscription.disable_reason || null,
    ]
  );

  if (result && result.rows[0]) {
    return parseSubscriptionRow(result.rows[0]);
  }
  return subscription;
}

/**
 * Get a subscription by ID
 */
export async function getSubscription(subscriptionId: string): Promise<WebhookSubscription | undefined> {
  if (!isDatabaseConnected()) {
    return undefined;
  }

  const result = await query<WebhookSubscriptionRow>(
    `SELECT ${SUBSCRIPTION_COLUMNS} FROM webhook_subscriptions WHERE id = $1`,
    [subscriptionId]
  );

  if (result && result.rows[0]) {
    return parseSubscriptionRow(result.rows[0]);
  }
  return undefined;
}

/**
 * Update a subscription
 */
export async function updateSubscription(
  subscriptionId: string,
  updates: Partial<WebhookSubscription>
): Promise<WebhookSubscription | undefined> {
  if (!isDatabaseConnected()) {
    return undefined;
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.url !== undefined) {
    setClauses.push(`url = $${paramIndex++}`);
    values.push(updates.url);
  }
  if (updates.events !== undefined) {
    setClauses.push(`events = $${paramIndex++}`);
    values.push(updates.events);
  }
  if (updates.project_id !== undefined) {
    setClauses.push(`project_id = $${paramIndex++}`);
    values.push(updates.project_id || null);
  }
  if (updates.project_ids !== undefined) {
    setClauses.push(`project_ids = $${paramIndex++}`);
    values.push(updates.project_ids || []);
  }
  if (updates.result_statuses !== undefined) {
    setClauses.push(`result_statuses = $${paramIndex++}`);
    values.push(updates.result_statuses || []);
  }
  if (updates.headers !== undefined) {
    setClauses.push(`headers = $${paramIndex++}`);
    values.push(updates.headers ? JSON.stringify(updates.headers) : null);
  }
  if (updates.secret !== undefined) {
    setClauses.push(`secret = $${paramIndex++}`);
    // Feature #391: Encrypt the webhook secret before storing
    values.push(updates.secret ? encryptIfNeeded(updates.secret) : null);
  }
  if (updates.payload_template !== undefined) {
    setClauses.push(`payload_template = $${paramIndex++}`);
    values.push(updates.payload_template || null);
  }
  if (updates.retry_enabled !== undefined) {
    setClauses.push(`retry_enabled = $${paramIndex++}`);
    values.push(updates.retry_enabled);
  }
  if (updates.max_retries !== undefined) {
    setClauses.push(`max_retries = $${paramIndex++}`);
    values.push(updates.max_retries);
  }
  if (updates.batch_enabled !== undefined) {
    setClauses.push(`batch_enabled = $${paramIndex++}`);
    values.push(updates.batch_enabled);
  }
  if (updates.batch_size !== undefined) {
    setClauses.push(`batch_size = $${paramIndex++}`);
    values.push(updates.batch_size);
  }
  if (updates.batch_interval_seconds !== undefined) {
    setClauses.push(`batch_interval_seconds = $${paramIndex++}`);
    values.push(updates.batch_interval_seconds);
  }
  if (updates.enabled !== undefined) {
    setClauses.push(`enabled = $${paramIndex++}`);
    values.push(updates.enabled);
  }
  if (updates.last_triggered_at !== undefined) {
    setClauses.push(`last_triggered_at = $${paramIndex++}`);
    values.push(updates.last_triggered_at || null);
  }
  if (updates.failure_count !== undefined) {
    setClauses.push(`failure_count = $${paramIndex++}`);
    values.push(updates.failure_count);
  }
  if (updates.success_count !== undefined) {
    setClauses.push(`success_count = $${paramIndex++}`);
    values.push(updates.success_count);
  }
  if (updates.consecutive_failures !== undefined) {
    setClauses.push(`consecutive_failures = $${paramIndex++}`);
    values.push(updates.consecutive_failures);
  }
  if (updates.disabled_at !== undefined) {
    setClauses.push(`disabled_at = $${paramIndex++}`);
    values.push(updates.disabled_at || null);
  }
  if (updates.disable_reason !== undefined) {
    setClauses.push(`disable_reason = $${paramIndex++}`);
    values.push(updates.disable_reason || null);
  }

  if (setClauses.length === 0) {
    return getSubscription(subscriptionId);
  }

  // Always update updated_at
  setClauses.push(`updated_at = $${paramIndex++}`);
  values.push(new Date());

  values.push(subscriptionId);
  const result = await query<WebhookSubscriptionRow>(
    `UPDATE webhook_subscriptions SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING ${SUBSCRIPTION_COLUMNS}`,
    values
  );

  if (result && result.rows[0]) {
    return parseSubscriptionRow(result.rows[0]);
  }
  return undefined;
}

/**
 * Delete a subscription
 */
export async function deleteSubscription(subscriptionId: string): Promise<boolean> {
  if (!isDatabaseConnected()) {
    return false;
  }

  const result = await query(
    'DELETE FROM webhook_subscriptions WHERE id = $1',
    [subscriptionId]
  );
  return (result?.rowCount ?? 0) > 0;
}

/**
 * List subscriptions for an organization
 */
export async function listSubscriptions(organizationId: string): Promise<WebhookSubscription[]> {
  if (!isDatabaseConnected()) {
    return [];
  }

  const result = await query<WebhookSubscriptionRow>(
    `SELECT ${SUBSCRIPTION_COLUMNS} FROM webhook_subscriptions WHERE organization_id = $1 ORDER BY created_at DESC`,
    [organizationId]
  );

  if (result) {
    return result.rows.map(parseSubscriptionRow);
  }
  return [];
}

/**
 * Get all enabled subscriptions for a specific event type
 */
export async function getSubscriptionsForEvent(
  organizationId: string,
  eventType: WebhookEventType,
  projectId?: string
): Promise<WebhookSubscription[]> {
  if (!isDatabaseConnected()) {
    return [];
  }

  let sql = `SELECT ${SUBSCRIPTION_COLUMNS} FROM webhook_subscriptions
             WHERE organization_id = $1 AND enabled = true AND $2 = ANY(events)`;
  const params: unknown[] = [organizationId, eventType];

  if (projectId) {
    // Match if project_id equals, or project_ids contains, or both are null/empty (org-wide)
    sql += ` AND (project_id IS NULL OR project_id = $3 OR $3 = ANY(project_ids) OR array_length(project_ids, 1) IS NULL)`;
    params.push(projectId);
  }

  sql += ' ORDER BY created_at ASC';

  const result = await query<WebhookSubscriptionRow>(sql, params);
  if (result) {
    return result.rows.map(parseSubscriptionRow);
  }
  return [];
}

/**
 * Load all subscriptions into memory (for startup sync)
 */
export async function loadAllSubscriptions(): Promise<Map<string, WebhookSubscription>> {
  const map = new Map<string, WebhookSubscription>();

  if (!isDatabaseConnected()) {
    return map;
  }

  const result = await query<WebhookSubscriptionRow>(
    `SELECT ${SUBSCRIPTION_COLUMNS} FROM webhook_subscriptions ORDER BY created_at DESC`,
    []
  );

  if (result) {
    for (const row of result.rows) {
      const sub = parseSubscriptionRow(row);
      map.set(sub.id, sub);
    }
  }

  log.info({ count: map.size }, 'Loaded subscriptions from database');
  return map;
}

// ============================================
// Delivery Log Operations
// ============================================

/**
 * Create a delivery log entry
 */
export async function createDeliveryLog(log: WebhookDeliveryLog): Promise<WebhookDeliveryLog> {
  if (!isDatabaseConnected()) {
    return log;
  }

  const result = await query<WebhookDeliveryLogRow>(
    `INSERT INTO webhook_delivery_logs (
      id, subscription_id, subscription_name, event_type, url,
      request_method, request_headers, request_body, request_size_bytes,
      response_status, response_headers, response_body, response_size_bytes, duration_ms,
      error_message, error_code, attempt_number, max_attempts, status,
      timestamp, completed_at, run_id, project_id, test_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
    RETURNING ${DELIVERY_LOG_COLUMNS}`,
    [
      log.id,
      log.subscription_id,
      log.subscription_name,
      log.event_type,
      log.url,
      log.request.method,
      log.request.headers,
      log.request.body,
      log.request.size_bytes,
      log.response?.status || null,
      log.response?.headers ? JSON.stringify(log.response.headers) : null,
      log.response?.body || null,
      log.response?.size_bytes || null,
      log.response?.duration_ms || null,
      log.error?.message || null,
      log.error?.code || null,
      log.attempt_number,
      log.max_attempts,
      log.status,
      log.timestamp,
      log.completed_at || null,
      log.context?.run_id || null,
      log.context?.project_id || null,
      log.context?.test_id || null,
    ]
  );

  if (result && result.rows[0]) {
    return parseDeliveryLogRow(result.rows[0]);
  }
  return log;
}

/**
 * Get delivery logs for a subscription with pagination
 */
export async function getDeliveryLogs(
  subscriptionId: string,
  options?: { limit?: number; offset?: number; status?: 'success' | 'failed' | 'pending_retry' }
): Promise<{ logs: WebhookDeliveryLog[]; total: number }> {
  if (!isDatabaseConnected()) {
    return { logs: [], total: 0 };
  }

  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  let countSql = 'SELECT COUNT(*) as count FROM webhook_delivery_logs WHERE subscription_id = $1';
  let dataSql = `SELECT ${DELIVERY_LOG_COLUMNS} FROM webhook_delivery_logs WHERE subscription_id = $1`;
  const params: unknown[] = [subscriptionId];

  if (options?.status) {
    countSql += ' AND status = $2';
    dataSql += ' AND status = $2';
    params.push(options.status);
  }

  dataSql += ` ORDER BY timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

  const [countResult, dataResult] = await Promise.all([
    query<CountRow>(countSql, params),
    query<WebhookDeliveryLogRow>(dataSql, [...params, limit, offset]),
  ]);

  const total = countResult?.rows[0]?.count ? parseInt(countResult.rows[0].count, 10) : 0;
  const logs = dataResult?.rows?.map(parseDeliveryLogRow) || [];

  return { logs, total };
}

/**
 * Get recent delivery logs across all subscriptions for an organization
 */
export async function getRecentDeliveryLogs(
  organizationId: string,
  options?: { limit?: number; offset?: number; eventType?: string; success?: boolean }
): Promise<{ logs: WebhookDeliveryLog[]; total: number }> {
  if (!isDatabaseConnected()) {
    return { logs: [], total: 0 };
  }

  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  // Join with subscriptions to filter by organization
  let countSql = `SELECT COUNT(*) as count FROM webhook_delivery_logs dl
                  JOIN webhook_subscriptions ws ON dl.subscription_id = ws.id
                  WHERE ws.organization_id = $1`;
  let dataSql = `SELECT dl.${DELIVERY_LOG_COLUMNS.split(', ').map(c => `dl.${c}`).join(', ')}
                 FROM webhook_delivery_logs dl
                 JOIN webhook_subscriptions ws ON dl.subscription_id = ws.id
                 WHERE ws.organization_id = $1`;
  const params: unknown[] = [organizationId];
  let paramIndex = 2;

  if (options?.eventType) {
    countSql += ` AND dl.event_type = $${paramIndex}`;
    dataSql += ` AND dl.event_type = $${paramIndex}`;
    params.push(options.eventType);
    paramIndex++;
  }

  if (options?.success !== undefined) {
    const status = options.success ? 'success' : 'failed';
    countSql += ` AND dl.status = $${paramIndex}`;
    dataSql += ` AND dl.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  dataSql += ` ORDER BY dl.timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

  const [countResult, dataResult] = await Promise.all([
    query<CountRow>(countSql, params),
    query<WebhookDeliveryLogRow>(dataSql, [...params, limit, offset]),
  ]);

  const total = countResult?.rows[0]?.count ? parseInt(countResult.rows[0].count, 10) : 0;
  const logs = dataResult?.rows?.map(parseDeliveryLogRow) || [];

  return { logs, total };
}

/**
 * Delete old delivery logs (for cleanup)
 */
export async function deleteOldDeliveryLogs(olderThanDays: number = 30): Promise<number> {
  if (!isDatabaseConnected()) {
    return 0;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await query(
    'DELETE FROM webhook_delivery_logs WHERE timestamp < $1',
    [cutoffDate]
  );

  const deleted = result?.rowCount ?? 0;
  if (deleted > 0) {
    log.info({ deletedCount: deleted, olderThanDays }, 'Deleted old delivery logs');
  }
  return deleted;
}

/**
 * Get subscription count for an organization
 */
export async function getSubscriptionCount(organizationId?: string): Promise<number> {
  if (!isDatabaseConnected()) {
    return 0;
  }

  let sql = 'SELECT COUNT(*) as count FROM webhook_subscriptions';
  const params: unknown[] = [];

  if (organizationId) {
    sql += ' WHERE organization_id = $1';
    params.push(organizationId);
  }

  const result = await query<CountRow>(sql, params);
  if (result && result.rows[0]) {
    return parseInt(result.rows[0].count, 10);
  }
  return 0;
}
