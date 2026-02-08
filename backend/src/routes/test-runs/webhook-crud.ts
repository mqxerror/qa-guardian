/**
 * Webhook CRUD Routes - Features #1283-1300
 * CRUD operations for webhook subscriptions
 *
 * Split from webhook-subscriptions.ts for code quality
 */
import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId, JwtPayload } from '../../middleware/auth.js';
import { getProject as dbGetProject } from '../projects/stores.js';
import {
  WebhookSubscription,
  webhookSubscriptions,
  applyPayloadTemplate,
  generateWebhookSignature,
  createWebhookSubscriptionInDb,
  updateWebhookSubscriptionInDb,
  deleteWebhookSubscriptionFromDb,
  MAX_WEBHOOK_RETRIES
} from './webhooks.js';
import { validateWebhookURL, validateWebhookURLWithDNS, generateId } from '../../utils/index.js';
import { WebhookLogEntry, webhookLog } from './alerts.js';
import { createLogger } from '../../services/logger.js';

const logger = createLogger('route:test-runs:webhook-crud');

/**
 * Log webhook delivery details for debugging and monitoring
 * Feature #1295: Webhook delivery logging
 */
export function logWebhookDelivery(params: {
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

  // Keep only last 500 webhook logs (increased for detailed logging)
  if (webhookLog.length > 500) {
    webhookLog.pop();
  }
}

/**
 * Flatten nested object for template interpolation
 */
export function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
  return Object.keys(obj).reduce((acc: Record<string, any>, key) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(acc, flattenObject(obj[key], path));
    } else {
      acc[path] = obj[key];
    }
    return acc;
  }, {});
}

// ============================================================================
// Route Registration
// ============================================================================

export async function webhookCrudRoutes(app: FastifyInstance) {
  // Feature #1283: Webhook Subscriptions for test.run.started event
  // ============================================================================

  // List webhook subscriptions
  app.get('/api/v1/webhook-subscriptions', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);

    const subscriptions = Array.from(webhookSubscriptions.values())
      .filter(sub => sub.organization_id === orgId)
      .map(sub => ({
        id: sub.id,
        name: sub.name,
        url: sub.url,
        events: sub.events,
        project_id: sub.project_id,
        project_ids: sub.project_ids, // Feature #1299: Multi-project filtering
        result_statuses: sub.result_statuses, // Feature #1300: Filter by result status
        batch_enabled: sub.batch_enabled ?? false, // Feature #1304: Batch delivery
        batch_size: sub.batch_size ?? 10, // Feature #1304: Batch delivery
        batch_interval_seconds: sub.batch_interval_seconds ?? 60, // Feature #1304: Batch delivery
        enabled: sub.enabled,
        created_at: sub.created_at.toISOString(),
        updated_at: sub.updated_at.toISOString(),
        last_triggered_at: sub.last_triggered_at?.toISOString(),
        success_count: sub.success_count,
        failure_count: sub.failure_count,
      }));

    return {
      subscriptions,
      total: subscriptions.length,
    };
  });

  // Feature #1297: Test webhook URL before creating subscription
  app.post<{
    Body: {
      url: string;
      headers?: Record<string, string>;
      secret?: string;
      payload?: Record<string, any>;
    };
  }>('/api/v1/webhook-subscriptions/test-url', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { url, headers: customHeaders, secret, payload: customPayload } = request.body;

    // Validate URL
    if (!url) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'url is required',
      });
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'URL must start with http:// or https://',
        reachable: false,
      });
    }

    // Feature #315 + #400: SSRF protection with DNS resolution check
    // This prevents DNS rebinding attacks where a hostname resolves to a private IP
    const ssrfValidation = await validateWebhookURLWithDNS(url);
    if (!ssrfValidation.safe) {
      return reply.status(400).send({
        error: 'Security Error',
        message: ssrfValidation.error,
        reachable: false,
        ssrf_blocked: true,
      });
    }

    logger.info(`[WEBHOOK] Testing URL "${url}" by ${user.email}`);

    const startTime = Date.now();
    const deliveryId = generateId('test-url', 7); // Feature #357: Use shared ID generator

    // Build test payload
    const testPayload = customPayload || {
      event: 'test',
      timestamp: new Date().toISOString(),
      message: 'This is a test to validate the webhook URL',
      test_id: deliveryId,
      triggered_by: user.email,
    };

    // Build headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': 'test',
      'X-Webhook-Delivery-Id': deliveryId,
      ...customHeaders,
    };

    // Add HMAC signature if secret is provided
    // Feature #314: Stripe-style signing with timestamp for replay protection
    if (secret) {
      const { signature } = generateWebhookSignature(JSON.stringify(testPayload), secret);
      requestHeaders['X-Webhook-Signature'] = signature;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(testPayload),
      });

      const duration_ms = Date.now() - startTime;
      const responseStatus = response.status;
      let responseBody: string | undefined;
      const responseHeaders: Record<string, string> = {};

      // Capture response headers
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Capture response body
      try {
        const body = await response.text();
        responseBody = body.substring(0, 2000);
      } catch {
        responseBody = undefined;
      }

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
          url,
          method: 'POST',
          headers: Object.keys(requestHeaders).reduce((acc, key) => {
            // Redact sensitive headers
            const headerValue = requestHeaders[key];
            if (key.toLowerCase().includes('signature') || key.toLowerCase().includes('secret')) {
              acc[key] = '[REDACTED]';
            } else if (headerValue !== undefined) {
              acc[key] = headerValue;
            }
            return acc;
          }, {} as Record<string, string>),
          payload: testPayload,
        },
        duration_ms,
        delivery_id: deliveryId,
        message: response.ok
          ? 'URL is reachable and accepting webhook payloads'
          : `URL returned HTTP ${responseStatus}: ${response.statusText}`,
      };
    } catch (err) {
      const duration_ms = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';

      return {
        success: false,
        reachable: false,
        error: errorMsg,
        request: {
          url,
          method: 'POST',
          headers: Object.keys(requestHeaders).reduce((acc, key) => {
            const headerValue = requestHeaders[key];
            if (key.toLowerCase().includes('signature') || key.toLowerCase().includes('secret')) {
              acc[key] = '[REDACTED]';
            } else if (headerValue !== undefined) {
              acc[key] = headerValue;
            }
            return acc;
          }, {} as Record<string, string>),
          payload: testPayload,
        },
        duration_ms,
        delivery_id: deliveryId,
        message: `Failed to reach URL: ${errorMsg}`,
      };
    }
  });

  // Create webhook subscription
  app.post<{
    Body: {
      name: string;
      url: string;
      events: ('test.run.started' | 'test.run.completed' | 'test.run.failed' | 'test.run.passed' | 'test.completed' | 'test.created' | 'baseline.approved' | 'schedule.triggered' | 'visual.diff.detected' | 'performance.budget.exceeded' | 'security.vulnerability.found' | 'flaky.test.detected' | 'accessibility.issue.found')[];
      project_id?: string;
      // Feature #1299: Support multiple project filtering
      project_ids?: string[];
      // Feature #1300: Filter by result status
      result_statuses?: ('passed' | 'failed' | 'skipped' | 'error')[];
      headers?: Record<string, string>;
      secret?: string;
      enabled?: boolean;
      // Feature #1291: Payload customization
      payload_template?: string;
      // Feature #1294: Retry configuration
      retry_enabled?: boolean;
      max_retries?: number;
      // Feature #1304: Batch delivery configuration
      batch_enabled?: boolean;
      batch_size?: number;
      batch_interval_seconds?: number;
    };
  }>('/api/v1/webhook-subscriptions', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;
    // Feature #330: Default max_retries is now 3 per specification
    const { name, url, events, project_id, project_ids, result_statuses, headers, secret, enabled = true, payload_template, retry_enabled = true, max_retries = MAX_WEBHOOK_RETRIES, batch_enabled = false, batch_size = 10, batch_interval_seconds = 60 } = request.body;

    // Validate required fields
    if (!name || !url || !events || events.length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'name, url, and events are required',
      });
    }

    // Validate URL format
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'URL must start with http:// or https://',
      });
    }

    // Feature #315 + #400: SSRF protection with DNS resolution check
    // This prevents DNS rebinding attacks where a hostname resolves to a private IP
    const ssrfValidation = await validateWebhookURLWithDNS(url);
    if (!ssrfValidation.safe) {
      return reply.status(400).send({
        error: 'Security Error',
        message: `Webhook URL rejected: ${ssrfValidation.error}`,
        ssrf_blocked: true,
      });
    }

    // Validate events
    const validEvents = ['test.run.started', 'test.run.completed', 'test.run.failed', 'test.run.passed', 'test.completed', 'test.created', 'baseline.approved', 'schedule.triggered', 'visual.diff.detected', 'performance.budget.exceeded', 'security.vulnerability.found', 'flaky.test.detected', 'accessibility.issue.found'];
    for (const event of events) {
      if (!validEvents.includes(event)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Invalid event: ${event}. Valid events are: ${validEvents.join(', ')}`,
        });
      }
    }

    // Validate project_id if provided (legacy single project)
    if (project_id) {
      const project = await dbGetProject(project_id);
      if (!project || project.organization_id !== orgId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid project_id',
        });
      }
    }

    // Feature #1299: Validate project_ids if provided (multi-project support)
    let validatedProjectIds: string[] | undefined;
    if (project_ids && project_ids.length > 0) {
      validatedProjectIds = [];
      for (const pid of project_ids) {
        const project = await dbGetProject(pid);
        if (!project || project.organization_id !== orgId) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Invalid project_id: ${pid}`,
          });
        }
        validatedProjectIds.push(pid);
      }
    }

    // Feature #1300: Validate result_statuses if provided
    const validResultStatuses = ['passed', 'failed', 'skipped', 'error'];
    let validatedResultStatuses: ('passed' | 'failed' | 'skipped' | 'error')[] | undefined;
    if (result_statuses && result_statuses.length > 0) {
      validatedResultStatuses = [];
      for (const status of result_statuses) {
        if (!validResultStatuses.includes(status)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Invalid result_status: ${status}. Valid statuses are: ${validResultStatuses.join(', ')}`,
          });
        }
        validatedResultStatuses.push(status);
      }
    }

    // Feature #1291: Validate payload_template if provided
    if (payload_template) {
      try {
        // Test that the template is valid JSON when variables are replaced with placeholder values
        // Use "PLACEHOLDER" for string contexts to avoid breaking JSON syntax
        const testTemplate = payload_template.replace(/\{\{[^}]+\}\}/g, 'PLACEHOLDER');
        JSON.parse(testTemplate);
      } catch (err) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid payload_template: must be valid JSON with {{variable}} placeholders',
        });
      }
    }

    // Feature #1294/#330: Validate max_retries (default is 3, max is 5 to prevent long retry windows)
    if (max_retries !== undefined && (max_retries < 0 || max_retries > 5)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'max_retries must be between 0 and 5',
      });
    }

    // Feature #1304: Validate batch settings
    if (batch_size !== undefined && (batch_size < 1 || batch_size > 100)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'batch_size must be between 1 and 100',
      });
    }

    if (batch_interval_seconds !== undefined && (batch_interval_seconds < 5 || batch_interval_seconds > 3600)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'batch_interval_seconds must be between 5 and 3600 (1 hour)',
      });
    }

    const now = new Date();
    const id = generateId('wsub', 7); // Feature #357: Use shared ID generator

    const subscription: WebhookSubscription = {
      id,
      organization_id: orgId,
      project_id,
      project_ids: validatedProjectIds, // Feature #1299: Multi-project filtering
      result_statuses: validatedResultStatuses, // Feature #1300: Filter by result status
      name,
      url,
      events: events as WebhookSubscription['events'],
      headers,
      secret,
      payload_template, // Feature #1291
      retry_enabled, // Feature #1294
      max_retries, // Feature #1294
      batch_enabled, // Feature #1304: Batch delivery
      batch_size, // Feature #1304: Batch delivery
      batch_interval_seconds, // Feature #1304: Batch delivery
      enabled,
      created_at: now,
      updated_at: now,
      failure_count: 0,
      success_count: 0,
      consecutive_failures: 0, // Feature #321: Auto-disable tracking
    };

    // Feature #329: Create subscription in both memory and database
    await createWebhookSubscriptionInDb(subscription);

    logger.info(`[WEBHOOK] Created subscription "${name}" (${id}) by ${user.email}`);

    return {
      id: subscription.id,
      name: subscription.name,
      url: subscription.url,
      events: subscription.events,
      project_id: subscription.project_id,
      project_ids: subscription.project_ids, // Feature #1299: Multi-project filtering
      result_statuses: subscription.result_statuses, // Feature #1300: Filter by result status
      payload_template: subscription.payload_template, // Feature #1291
      retry_enabled: subscription.retry_enabled, // Feature #1294
      max_retries: subscription.max_retries, // Feature #1294
      batch_enabled: subscription.batch_enabled, // Feature #1304: Batch delivery
      batch_size: subscription.batch_size, // Feature #1304: Batch delivery
      batch_interval_seconds: subscription.batch_interval_seconds, // Feature #1304: Batch delivery
      enabled: subscription.enabled,
      created_at: subscription.created_at.toISOString(),
    };
  });

  // Get single webhook subscription
  app.get<{ Params: { subscriptionId: string } }>('/api/v1/webhook-subscriptions/:subscriptionId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const { subscriptionId } = request.params;

    const subscription = webhookSubscriptions.get(subscriptionId);
    if (!subscription || subscription.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Webhook subscription not found',
      });
    }

    return {
      id: subscription.id,
      name: subscription.name,
      url: subscription.url,
      events: subscription.events,
      project_id: subscription.project_id,
      project_ids: subscription.project_ids, // Feature #1299: Multi-project filtering
      result_statuses: subscription.result_statuses, // Feature #1300: Filter by result status
      headers: subscription.headers ? Object.keys(subscription.headers) : undefined, // Don't expose header values
      has_secret: !!subscription.secret,
      payload_template: subscription.payload_template, // Feature #1291
      retry_enabled: subscription.retry_enabled ?? true, // Feature #1294
      max_retries: subscription.max_retries ?? MAX_WEBHOOK_RETRIES, // Feature #330: Default is 3
      batch_enabled: subscription.batch_enabled ?? false, // Feature #1304: Batch delivery
      batch_size: subscription.batch_size ?? 10, // Feature #1304: Batch delivery
      batch_interval_seconds: subscription.batch_interval_seconds ?? 60, // Feature #1304: Batch delivery
      enabled: subscription.enabled,
      created_at: subscription.created_at.toISOString(),
      updated_at: subscription.updated_at.toISOString(),
      last_triggered_at: subscription.last_triggered_at?.toISOString(),
      success_count: subscription.success_count,
      failure_count: subscription.failure_count,
    };
  });

  // Update webhook subscription
  app.patch<{
    Params: { subscriptionId: string };
    Body: {
      name?: string;
      url?: string;
      events?: ('test.run.started' | 'test.run.completed' | 'test.run.failed' | 'test.run.passed' | 'test.completed' | 'test.created' | 'baseline.approved' | 'schedule.triggered' | 'visual.diff.detected' | 'performance.budget.exceeded' | 'security.vulnerability.found' | 'flaky.test.detected' | 'accessibility.issue.found')[];
      project_id?: string | null;
      // Feature #1299: Multi-project filtering
      project_ids?: string[] | null;
      // Feature #1300: Filter by result status
      result_statuses?: ('passed' | 'failed' | 'skipped' | 'error')[] | null;
      headers?: Record<string, string>;
      secret?: string;
      enabled?: boolean;
      // Feature #1291: Payload customization
      payload_template?: string | null;
      // Feature #1294: Retry configuration
      retry_enabled?: boolean;
      max_retries?: number;
      // Feature #1304: Batch delivery configuration
      batch_enabled?: boolean;
      batch_size?: number;
      batch_interval_seconds?: number;
    };
  }>('/api/v1/webhook-subscriptions/:subscriptionId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;
    const { subscriptionId } = request.params;
    const updates = request.body;

    const subscription = webhookSubscriptions.get(subscriptionId);
    if (!subscription || subscription.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Webhook subscription not found',
      });
    }

    // Validate URL if provided
    if (updates.url && !updates.url.startsWith('http://') && !updates.url.startsWith('https://')) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'URL must start with http:// or https://',
      });
    }

    // Feature #315 + #400: SSRF protection with DNS resolution check
    // This prevents DNS rebinding attacks where a hostname resolves to a private IP
    if (updates.url) {
      const ssrfValidation = await validateWebhookURLWithDNS(updates.url);
      if (!ssrfValidation.safe) {
        return reply.status(400).send({
          error: 'Security Error',
          message: `Webhook URL rejected: ${ssrfValidation.error}`,
          ssrf_blocked: true,
        });
      }
    }

    // Validate events if provided
    if (updates.events) {
      const validEvents = ['test.run.started', 'test.run.completed', 'test.run.failed', 'test.run.passed', 'test.completed', 'test.created', 'baseline.approved', 'schedule.triggered', 'visual.diff.detected', 'performance.budget.exceeded', 'security.vulnerability.found', 'flaky.test.detected', 'accessibility.issue.found'];
      for (const event of updates.events) {
        if (!validEvents.includes(event)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Invalid event: ${event}. Valid events are: ${validEvents.join(', ')}`,
          });
        }
      }
    }

    // Feature #1291: Validate payload_template if provided
    if (updates.payload_template !== undefined && updates.payload_template !== null) {
      try {
        // Test that the template is valid JSON when variables are replaced with placeholder values
        const testTemplate = updates.payload_template.replace(/\{\{[^}]+\}\}/g, 'PLACEHOLDER');
        JSON.parse(testTemplate);
      } catch (err) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid payload_template: must be valid JSON with {{variable}} placeholders',
        });
      }
    }

    // Feature #1294: Validate max_retries if provided
    if (updates.max_retries !== undefined && (updates.max_retries < 0 || updates.max_retries > 10)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'max_retries must be between 0 and 10',
      });
    }

    // Feature #1304: Validate batch settings if provided
    if (updates.batch_size !== undefined && (updates.batch_size < 1 || updates.batch_size > 100)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'batch_size must be between 1 and 100',
      });
    }

    if (updates.batch_interval_seconds !== undefined && (updates.batch_interval_seconds < 5 || updates.batch_interval_seconds > 3600)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'batch_interval_seconds must be between 5 and 3600 (1 hour)',
      });
    }

    // Feature #1299: Validate project_ids if provided
    let validatedProjectIds: string[] | undefined;
    if (updates.project_ids !== undefined && updates.project_ids !== null && updates.project_ids.length > 0) {
      validatedProjectIds = [];
      for (const pid of updates.project_ids) {
        const project = await dbGetProject(pid);
        if (!project || project.organization_id !== orgId) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Invalid project_id: ${pid}`,
          });
        }
        validatedProjectIds.push(pid);
      }
    }

    // Feature #1300: Validate result_statuses if provided
    const validResultStatuses = ['passed', 'failed', 'skipped', 'error'];
    let validatedResultStatuses: ('passed' | 'failed' | 'skipped' | 'error')[] | undefined;
    if (updates.result_statuses !== undefined && updates.result_statuses !== null && updates.result_statuses.length > 0) {
      validatedResultStatuses = [];
      for (const status of updates.result_statuses) {
        if (!validResultStatuses.includes(status)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Invalid result_status: ${status}. Valid statuses are: ${validResultStatuses.join(', ')}`,
          });
        }
        validatedResultStatuses.push(status);
      }
    }

    // Apply updates
    if (updates.name !== undefined) subscription.name = updates.name;
    if (updates.url !== undefined) subscription.url = updates.url;
    if (updates.events !== undefined) subscription.events = updates.events as WebhookSubscription['events'];
    if (updates.project_id !== undefined) subscription.project_id = updates.project_id || undefined;
    // Feature #1299: Update project_ids (null to clear)
    if (updates.project_ids !== undefined) {
      subscription.project_ids = updates.project_ids === null ? undefined : validatedProjectIds;
    }
    // Feature #1300: Update result_statuses (null to clear)
    if (updates.result_statuses !== undefined) {
      subscription.result_statuses = updates.result_statuses === null ? undefined : validatedResultStatuses;
    }
    if (updates.headers !== undefined) subscription.headers = updates.headers;
    if (updates.secret !== undefined) subscription.secret = updates.secret;
    if (updates.enabled !== undefined) subscription.enabled = updates.enabled;
    // Feature #1291: Update payload_template (null to clear)
    if (updates.payload_template !== undefined) {
      subscription.payload_template = updates.payload_template === null ? undefined : updates.payload_template;
    }
    // Feature #1294: Update retry settings
    if (updates.retry_enabled !== undefined) subscription.retry_enabled = updates.retry_enabled;
    if (updates.max_retries !== undefined) subscription.max_retries = updates.max_retries;
    // Feature #1304: Update batch settings
    if (updates.batch_enabled !== undefined) subscription.batch_enabled = updates.batch_enabled;
    if (updates.batch_size !== undefined) subscription.batch_size = updates.batch_size;
    if (updates.batch_interval_seconds !== undefined) subscription.batch_interval_seconds = updates.batch_interval_seconds;

    subscription.updated_at = new Date();

    // Feature #329: Update subscription in both memory and database
    await updateWebhookSubscriptionInDb(subscriptionId, subscription);

    logger.info(`[WEBHOOK] Updated subscription "${subscription.name}" (${subscriptionId}) by ${user.email}`);

    return {
      id: subscription.id,
      name: subscription.name,
      url: subscription.url,
      events: subscription.events,
      project_id: subscription.project_id,
      project_ids: subscription.project_ids, // Feature #1299: Multi-project filtering
      result_statuses: subscription.result_statuses, // Feature #1300: Filter by result status
      payload_template: subscription.payload_template, // Feature #1291
      retry_enabled: subscription.retry_enabled ?? true, // Feature #1294
      max_retries: subscription.max_retries ?? MAX_WEBHOOK_RETRIES, // Feature #330: Default is 3
      batch_enabled: subscription.batch_enabled ?? false, // Feature #1304: Batch delivery
      batch_size: subscription.batch_size ?? 10, // Feature #1304: Batch delivery
      batch_interval_seconds: subscription.batch_interval_seconds ?? 60, // Feature #1304: Batch delivery
      enabled: subscription.enabled,
      updated_at: subscription.updated_at.toISOString(),
    };
  });

  // Delete webhook subscription
  app.delete<{ Params: { subscriptionId: string } }>('/api/v1/webhook-subscriptions/:subscriptionId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;
    const { subscriptionId } = request.params;

    const subscription = webhookSubscriptions.get(subscriptionId);
    if (!subscription || subscription.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Webhook subscription not found',
      });
    }

    // Feature #329: Delete subscription from both memory and database
    await deleteWebhookSubscriptionFromDb(subscriptionId);

    logger.info(`[WEBHOOK] Deleted subscription "${subscription.name}" (${subscriptionId}) by ${user.email}`);

    return {
      message: 'Webhook subscription deleted successfully',
    };
  });
}
