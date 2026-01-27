/**
 * Webhook Subscriptions Routes - Feature #1283-1315
 * Extracted from test-runs.ts for code quality (#1356)
 */
import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId, JwtPayload } from '../../middleware/auth';
import { projects } from '../projects';
import { WebhookSubscription, webhookSubscriptions, applyPayloadTemplate } from './webhooks';
import { WebhookLogEntry, webhookLog } from './alerts';

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
function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
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

export async function webhookSubscriptionRoutes(app: FastifyInstance) {
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

    console.log(`[WEBHOOK] Testing URL "${url}" by ${user.email}`);

    const startTime = Date.now();
    const deliveryId = `test-url-${Date.now()}_${Math.random().toString(36).substring(7)}`;

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
    if (secret) {
      const crypto = await import('crypto');
      const signature = crypto.createHmac('sha256', secret)
        .update(JSON.stringify(testPayload))
        .digest('hex');
      requestHeaders['X-QA-Guardian-Signature'] = `sha256=${signature}`;
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
    const { name, url, events, project_id, project_ids, result_statuses, headers, secret, enabled = true, payload_template, retry_enabled = true, max_retries = 5, batch_enabled = false, batch_size = 10, batch_interval_seconds = 60 } = request.body;

    // Validate required fields
    if (!name || !url || !events || events.length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'name, url, and events are required',
      });
    }

    // Validate URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'URL must start with http:// or https://',
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
      const project = projects.get(project_id);
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
        const project = projects.get(pid);
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

    // Feature #1294: Validate max_retries
    if (max_retries !== undefined && (max_retries < 0 || max_retries > 10)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'max_retries must be between 0 and 10',
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
    const id = `wsub_${Date.now()}_${Math.random().toString(36).substring(7)}`;

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
    };

    webhookSubscriptions.set(id, subscription);

    console.log(`[WEBHOOK] Created subscription "${name}" (${id}) by ${user.email}`);

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
      max_retries: subscription.max_retries ?? 5, // Feature #1294
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
        const project = projects.get(pid);
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
    webhookSubscriptions.set(subscriptionId, subscription);

    console.log(`[WEBHOOK] Updated subscription "${subscription.name}" (${subscriptionId}) by ${user.email}`);

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
      max_retries: subscription.max_retries ?? 5, // Feature #1294
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

    webhookSubscriptions.delete(subscriptionId);

    console.log(`[WEBHOOK] Deleted subscription "${subscription.name}" (${subscriptionId}) by ${user.email}`);

    return {
      message: 'Webhook subscription deleted successfully',
    };
  });

  // Feature #1295: Get webhook delivery logs
  app.get<{
    Querystring: {
      subscription_id?: string;
      event?: string;
      success?: string;
      limit?: string;
      offset?: string;
    };
  }>('/api/v1/webhook-delivery-logs', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const { subscription_id, event, success, limit = '50', offset = '0' } = request.query;

    // Filter logs by organization (only show logs for subscriptions owned by this org)
    let filteredLogs = webhookLog.filter(log => {
      if (!log.subscriptionId) return false;
      const subscription = webhookSubscriptions.get(log.subscriptionId);
      return subscription && subscription.organization_id === orgId;
    });

    // Apply filters
    if (subscription_id) {
      filteredLogs = filteredLogs.filter(log => log.subscriptionId === subscription_id);
    }
    if (event) {
      filteredLogs = filteredLogs.filter(log => log.event === event);
    }
    if (success !== undefined) {
      const successBool = success === 'true';
      filteredLogs = filteredLogs.filter(log => log.success === successBool);
    }

    // Apply pagination
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offsetNum = parseInt(offset) || 0;
    const paginatedLogs = filteredLogs.slice(offsetNum, offsetNum + limitNum);

    return {
      logs: paginatedLogs.map(log => ({
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        url: log.url,
        method: log.method,
        headers: log.headers,
        payload: log.payload,
        event: log.event,
        run_id: log.runId,
        project_id: log.projectId,
        subscription_id: log.subscriptionId,
        subscription_name: log.subscriptionName,
        success: log.success,
        response_status: log.responseStatus,
        response_body: log.responseBody,
        response_headers: log.responseHeaders,
        duration_ms: log.duration_ms,
        attempt: log.attempt,
        max_attempts: log.max_attempts,
        error: log.error,
      })),
      total: filteredLogs.length,
      limit: limitNum,
      offset: offsetNum,
    };
  });

  // Feature #1295: Get delivery logs for a specific subscription
  app.get<{
    Params: { subscriptionId: string };
    Querystring: {
      limit?: string;
      offset?: string;
    };
  }>('/api/v1/webhook-subscriptions/:subscriptionId/logs', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const { subscriptionId } = request.params;
    const { limit = '50', offset = '0' } = request.query;

    const subscription = webhookSubscriptions.get(subscriptionId);
    if (!subscription || subscription.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Webhook subscription not found',
      });
    }

    // Filter logs for this subscription
    const filteredLogs = webhookLog.filter(log => log.subscriptionId === subscriptionId);

    // Apply pagination
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offsetNum = parseInt(offset) || 0;
    const paginatedLogs = filteredLogs.slice(offsetNum, offsetNum + limitNum);

    return {
      subscription: {
        id: subscription.id,
        name: subscription.name,
      },
      logs: paginatedLogs.map(log => ({
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        url: log.url,
        method: log.method,
        headers: log.headers,
        payload: log.payload,
        event: log.event,
        success: log.success,
        response_status: log.responseStatus,
        response_body: log.responseBody,
        response_headers: log.responseHeaders,
        duration_ms: log.duration_ms,
        attempt: log.attempt,
        max_attempts: log.max_attempts,
        error: log.error,
      })),
      total: filteredLogs.length,
      limit: limitNum,
      offset: offsetNum,
    };
  });

  // Feature #1296: Get delivery status for a webhook subscription
  app.get<{
    Params: { subscriptionId: string };
  }>('/api/v1/webhook-subscriptions/:subscriptionId/status', {
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

    // Get recent delivery logs for this subscription
    const recentLogs = webhookLog
      .filter(log => log.subscriptionId === subscriptionId)
      .slice(0, 10);

    // Calculate delivery statistics
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logsLast24h = webhookLog.filter(
      log => log.subscriptionId === subscriptionId && log.timestamp >= last24Hours
    );
    const successesLast24h = logsLast24h.filter(log => log.success).length;
    const failuresLast24h = logsLast24h.filter(log => !log.success).length;

    // Determine current status
    let status: 'healthy' | 'degraded' | 'failing' | 'unknown' = 'unknown';
    if (recentLogs.length > 0) {
      const recentSuccessRate = recentLogs.filter(l => l.success).length / recentLogs.length;
      if (recentSuccessRate >= 0.9) {
        status = 'healthy';
      } else if (recentSuccessRate >= 0.5) {
        status = 'degraded';
      } else {
        status = 'failing';
      }
    }

    // Get last successful and failed deliveries
    const lastSuccess = recentLogs.find(log => log.success);
    const lastFailure = recentLogs.find(log => !log.success);

    // Calculate average response time
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
        max_retries: subscription.max_retries ?? 5,
      },
      recent_deliveries: recentLogs.map(log => ({
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        event: log.event,
        status: log.success ? 'delivered' : 'failed',
        response_status: log.responseStatus,
        duration_ms: log.duration_ms,
        attempt: log.attempt,
        max_attempts: log.max_attempts,
        error: log.error,
      })),
    };
  });

  // Feature #1296: Get delivery status summary for all subscriptions
  app.get('/api/v1/webhook-subscriptions/status/summary', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);

    // Get all subscriptions for this organization
    const orgSubscriptions = Array.from(webhookSubscriptions.values())
      .filter(sub => sub.organization_id === orgId);

    // Calculate status for each subscription
    const subscriptionStatuses = orgSubscriptions.map(sub => {
      const recentLogs = webhookLog
        .filter(log => log.subscriptionId === sub.id)
        .slice(0, 5);

      let status: 'healthy' | 'degraded' | 'failing' | 'unknown' = 'unknown';
      if (recentLogs.length > 0) {
        const recentSuccessRate = recentLogs.filter(l => l.success).length / recentLogs.length;
        if (recentSuccessRate >= 0.9) {
          status = 'healthy';
        } else if (recentSuccessRate >= 0.5) {
          status = 'degraded';
        } else {
          status = 'failing';
        }
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

    // Overall summary
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
  });

  // Test webhook subscription (sends a test event)
  app.post<{ Params: { subscriptionId: string } }>('/api/v1/webhook-subscriptions/:subscriptionId/test', {
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

    // Build test payload
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      message: 'This is a test webhook delivery',
      subscription: {
        id: subscription.id,
        name: subscription.name,
        events: subscription.events,
      },
      triggered_by: user.email,
    };

    console.log(`[WEBHOOK] Testing subscription "${subscription.name}" (${subscriptionId})`);

    const startTime = Date.now();
    const deliveryId = `test-${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': 'test',
      'X-Webhook-Delivery-Id': deliveryId,
      ...subscription.headers,
    };

    // Add HMAC signature if secret is configured
    if (subscription.secret) {
      const crypto = await import('crypto');
      const signature = crypto.createHmac('sha256', subscription.secret)
        .update(JSON.stringify(testPayload))
        .digest('hex');
      requestHeaders['X-QA-Guardian-Signature'] = `sha256=${signature}`;
    }

    try {
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(testPayload),
      });

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
        responseBody = body.substring(0, 1000);
      } catch {
        responseBody = undefined;
      }

      // Feature #1295: Log the test delivery
      logWebhookDelivery({
        deliveryId,
        subscription,
        eventType: 'test',
        payload: testPayload,
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

      // Feature #1296: Update subscription stats
      subscription.last_triggered_at = new Date();
      if (response.ok) {
        subscription.success_count++;
      } else {
        subscription.failure_count++;
      }
      subscription.updated_at = new Date();
      webhookSubscriptions.set(subscriptionId, subscription);

      if (!response.ok) {
        return {
          success: false,
          status_code: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`,
          delivery_id: deliveryId,
        };
      }

      return {
        success: true,
        status_code: response.status,
        message: 'Test webhook delivered successfully',
        delivery_id: deliveryId,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';

      // Feature #1295: Log the failed delivery
      logWebhookDelivery({
        deliveryId,
        subscription,
        eventType: 'test',
        payload: testPayload,
        headers: requestHeaders,
        attempt: 1,
        maxAttempts: 1,
        startTime,
        success: false,
        error: errorMsg,
        context: { runId: 'test', projectId: subscription.project_id || 'org-wide' },
      });

      // Feature #1296: Update subscription stats on error
      subscription.last_triggered_at = new Date();
      subscription.failure_count++;
      subscription.updated_at = new Date();
      webhookSubscriptions.set(subscriptionId, subscription);

      return {
        success: false,
        error: errorMsg,
        delivery_id: deliveryId,
      };
    }
  });

  // Feature #1291: Preview webhook payload with template interpolation
  app.post<{
    Params: { subscriptionId: string };
    Body: {
      event_type: 'test.run.started' | 'test.run.completed' | 'test.run.failed' | 'test.run.passed' | 'flaky.test.detected' | 'visual.diff.detected' | 'performance.budget.exceeded' | 'security.vulnerability.found';
      template?: string; // Optional template override for preview
    };
  }>('/api/v1/webhook-subscriptions/:subscriptionId/preview', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const { subscriptionId } = request.params;
    const { event_type, template } = request.body;

    const subscription = webhookSubscriptions.get(subscriptionId);
    if (!subscription || subscription.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Webhook subscription not found',
      });
    }

    // Build sample payload based on event type
    const sampleData: Record<string, any> = {
      event: event_type,
      timestamp: new Date().toISOString(),
      organization_id: orgId,
      project_id: subscription.project_id || 'proj_sample_123',
    };

    // Add event-specific sample data
    switch (event_type) {
      case 'test.run.started':
      case 'test.run.completed':
      case 'test.run.passed':
      case 'test.run.failed':
        sampleData.run = {
          id: 'run_sample_123',
          suite_id: 'suite_sample_123',
          suite_name: 'Sample Test Suite',
          status: event_type === 'test.run.started' ? 'running' : (event_type === 'test.run.passed' ? 'passed' : 'failed'),
          browser: 'chromium',
          total_tests: 10,
          passed: event_type === 'test.run.passed' ? 10 : 7,
          failed: event_type === 'test.run.passed' ? 0 : 2,
          skipped: event_type === 'test.run.passed' ? 0 : 1,
          duration_ms: 45000,
          triggered_by: 'manual',
        };
        if (event_type === 'test.run.failed') {
          sampleData.failures = [
            { test_id: 'test_1', test_name: 'Login test', error: 'Element not found' },
            { test_id: 'test_2', test_name: 'Checkout test', error: 'Timeout exceeded' },
          ];
        }
        break;
      case 'flaky.test.detected':
        sampleData.test = {
          id: 'test_sample_123',
          name: 'Sample Flaky Test',
          suite_id: 'suite_sample_123',
          suite_name: 'Sample Suite',
        };
        sampleData.flakiness = {
          score: 45,
          detection_reason: 'Test alternated between pass/fail 5 times in last 10 runs',
          recent_pass_rate: 55,
          consecutive_status_flips: 5,
        };
        sampleData.history = [
          { run_id: 'run_1', status: 'passed', timestamp: new Date(Date.now() - 3600000).toISOString(), duration_ms: 1200 },
          { run_id: 'run_2', status: 'failed', timestamp: new Date(Date.now() - 7200000).toISOString(), duration_ms: 1500 },
        ];
        sampleData.severity = 'medium';
        break;
      case 'visual.diff.detected':
        sampleData.test = {
          id: 'test_sample_123',
          name: 'Homepage Visual Test',
        };
        sampleData.visual = {
          diff_percentage: 12.5,
          mismatched_pixels: 15000,
          total_pixels: 120000,
          threshold: 5.0,
        };
        break;
      case 'performance.budget.exceeded':
        sampleData.test = {
          id: 'test_sample_123',
          name: 'Homepage Performance Test',
        };
        sampleData.violations = [
          { metric: 'LCP', actual: 3200, threshold: 2500, unit: 'ms', severity: 'high' },
          { metric: 'CLS', actual: 0.15, threshold: 0.1, unit: '', severity: 'medium' },
        ];
        sampleData.scores = {
          performance: 72,
          accessibility: 95,
          best_practices: 88,
          seo: 91,
        };
        break;
      case 'security.vulnerability.found':
        sampleData.vulnerability = {
          cve_id: 'CVE-2024-12345',
          severity: 'high',
          cvss_score: 8.5,
          title: 'Sample Vulnerability',
          description: 'A sample vulnerability description for preview',
          affected_package: '@sample/package',
          affected_versions: '<1.5.0',
          fixed_version: '1.5.0',
        };
        sampleData.affected_projects = ['proj_1', 'proj_2'];
        break;
    }

    // Use provided template or subscription's template
    const templateToUse = template || subscription.payload_template;

    // Generate preview
    let previewPayload: Record<string, any>;
    let templateError: string | undefined;

    if (templateToUse) {
      try {
        // Create a temporary subscription object with the template for preview
        const tempSubscription: WebhookSubscription = {
          ...subscription,
          payload_template: templateToUse,
        };
        previewPayload = applyPayloadTemplate(tempSubscription, sampleData);
      } catch (err) {
        templateError = err instanceof Error ? err.message : 'Template parsing error';
        previewPayload = sampleData;
      }
    } else {
      previewPayload = sampleData;
    }

    return {
      event_type,
      template_used: !!templateToUse,
      template_error: templateError,
      default_payload: sampleData,
      final_payload: previewPayload,
      available_variables: Object.keys(flattenObject(sampleData)).map(k => `{{${k}}}`),
    };
  });

  // Feature #1292: Get all available webhook payload variables with documentation
  app.get('/api/v1/webhook-variables', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    // Define all available variables with documentation
    const variables = {
      common: {
        description: 'Variables available in all webhook events',
        variables: [
          { name: '{{event}}', type: 'string', description: 'The event type that triggered the webhook' },
          { name: '{{timestamp}}', type: 'string', description: 'ISO 8601 timestamp when the event occurred' },
          { name: '{{organization_id}}', type: 'string', description: 'The organization ID' },
          { name: '{{project_id}}', type: 'string', description: 'The project ID (if applicable)' },
        ],
      },
      project: {
        description: 'Project information (when project context is available)',
        variables: [
          { name: '{{project.id}}', type: 'string', description: 'Unique project identifier' },
          { name: '{{project.name}}', type: 'string', description: 'Project name' },
          { name: '{{project.base_url}}', type: 'string', description: 'Base URL configured for the project' },
        ],
      },
      suite: {
        description: 'Test suite information',
        variables: [
          { name: '{{suite.id}}', type: 'string', description: 'Unique suite identifier' },
          { name: '{{suite.name}}', type: 'string', description: 'Test suite name' },
        ],
      },
      run: {
        description: 'Test run information (for test.run.* events)',
        variables: [
          { name: '{{run.id}}', type: 'string', description: 'Unique run identifier' },
          { name: '{{run.suite_id}}', type: 'string', description: 'Suite ID this run belongs to' },
          { name: '{{run.suite_name}}', type: 'string', description: 'Name of the suite' },
          { name: '{{run.status}}', type: 'string', description: 'Run status: running, passed, failed, error, cancelled' },
          { name: '{{run.browser}}', type: 'string', description: 'Browser used: chromium, firefox, webkit' },
          { name: '{{run.total_tests}}', type: 'number', description: 'Total number of tests in the run' },
          { name: '{{run.passed}}', type: 'number', description: 'Number of passed tests' },
          { name: '{{run.failed}}', type: 'number', description: 'Number of failed tests' },
          { name: '{{run.skipped}}', type: 'number', description: 'Number of skipped tests' },
          { name: '{{run.duration_ms}}', type: 'number', description: 'Run duration in milliseconds' },
          { name: '{{run.triggered_by}}', type: 'string', description: 'How the run was triggered: manual, schedule, api, github' },
          { name: '{{run.pr_number}}', type: 'number', description: 'GitHub PR number (if triggered by PR)' },
        ],
      },
      test: {
        description: 'Individual test information',
        variables: [
          { name: '{{test.id}}', type: 'string', description: 'Unique test identifier' },
          { name: '{{test.name}}', type: 'string', description: 'Test name' },
          { name: '{{test.suite_id}}', type: 'string', description: 'Suite ID the test belongs to' },
          { name: '{{test.suite_name}}', type: 'string', description: 'Name of the suite' },
        ],
      },
      result: {
        description: 'Test result information',
        variables: [
          { name: '{{result.status}}', type: 'string', description: 'Test result: passed, failed, error, skipped' },
          { name: '{{result.duration_ms}}', type: 'number', description: 'Test duration in milliseconds' },
          { name: '{{result.error}}', type: 'string', description: 'Error message if test failed' },
          { name: '{{result.screenshot}}', type: 'string', description: 'Screenshot URL if available' },
        ],
      },
      failures: {
        description: 'Failure details (for test.run.failed events)',
        variables: [
          { name: '{{failures}}', type: 'array', description: 'Array of failed test details' },
          { name: '{{failures[0].test_id}}', type: 'string', description: 'ID of the failed test' },
          { name: '{{failures[0].test_name}}', type: 'string', description: 'Name of the failed test' },
          { name: '{{failures[0].error}}', type: 'string', description: 'Error message' },
          { name: '{{failures[0].failed_steps}}', type: 'array', description: 'Array of failed step details' },
        ],
      },
      flakiness: {
        description: 'Flaky test detection (for flaky.test.detected events)',
        variables: [
          { name: '{{flakiness.score}}', type: 'number', description: 'Flakiness score from 0-100' },
          { name: '{{flakiness.detection_reason}}', type: 'string', description: 'Why the test was flagged as flaky' },
          { name: '{{flakiness.recent_pass_rate}}', type: 'number', description: 'Pass rate over recent runs (0-100)' },
          { name: '{{flakiness.consecutive_status_flips}}', type: 'number', description: 'Number of pass/fail alternations' },
          { name: '{{flakiness.first_detected_at}}', type: 'string', description: 'When flakiness was first detected' },
          { name: '{{history}}', type: 'array', description: 'Array of recent test run history' },
          { name: '{{history[0].run_id}}', type: 'string', description: 'Run ID' },
          { name: '{{history[0].status}}', type: 'string', description: 'Test status in that run' },
          { name: '{{history[0].timestamp}}', type: 'string', description: 'When the run occurred' },
          { name: '{{severity}}', type: 'string', description: 'Severity level: low, medium, high' },
          { name: '{{recommended_action}}', type: 'string', description: 'Suggested action to fix flakiness' },
        ],
      },
      visual: {
        description: 'Visual regression (for visual.diff.detected events)',
        variables: [
          { name: '{{visual.diff_percentage}}', type: 'number', description: 'Percentage of pixels that differ' },
          { name: '{{visual.mismatched_pixels}}', type: 'number', description: 'Number of mismatched pixels' },
          { name: '{{visual.total_pixels}}', type: 'number', description: 'Total pixels compared' },
          { name: '{{visual.threshold}}', type: 'number', description: 'Configured diff threshold' },
          { name: '{{visual.baseline_url}}', type: 'string', description: 'URL to baseline screenshot' },
          { name: '{{visual.current_url}}', type: 'string', description: 'URL to current screenshot' },
          { name: '{{visual.diff_url}}', type: 'string', description: 'URL to diff image' },
        ],
      },
      performance: {
        description: 'Performance budget (for performance.budget.exceeded events)',
        variables: [
          { name: '{{violations}}', type: 'array', description: 'Array of budget violations' },
          { name: '{{violations[0].metric}}', type: 'string', description: 'Metric name (LCP, FID, CLS, etc.)' },
          { name: '{{violations[0].actual}}', type: 'number', description: 'Actual measured value' },
          { name: '{{violations[0].threshold}}', type: 'number', description: 'Configured threshold' },
          { name: '{{violations[0].unit}}', type: 'string', description: 'Unit of measurement (ms, etc.)' },
          { name: '{{violations[0].severity}}', type: 'string', description: 'Violation severity' },
          { name: '{{scores.performance}}', type: 'number', description: 'Lighthouse performance score (0-100)' },
          { name: '{{scores.accessibility}}', type: 'number', description: 'Lighthouse accessibility score' },
          { name: '{{scores.best_practices}}', type: 'number', description: 'Lighthouse best practices score' },
          { name: '{{scores.seo}}', type: 'number', description: 'Lighthouse SEO score' },
        ],
      },
      vulnerability: {
        description: 'Security vulnerability (for security.vulnerability.found events)',
        variables: [
          { name: '{{vulnerability.cve_id}}', type: 'string', description: 'CVE identifier' },
          { name: '{{vulnerability.severity}}', type: 'string', description: 'Severity level: low, medium, high, critical' },
          { name: '{{vulnerability.cvss_score}}', type: 'number', description: 'CVSS score (0-10)' },
          { name: '{{vulnerability.title}}', type: 'string', description: 'Vulnerability title' },
          { name: '{{vulnerability.description}}', type: 'string', description: 'Detailed description' },
          { name: '{{vulnerability.affected_package}}', type: 'string', description: 'Name of affected package' },
          { name: '{{vulnerability.affected_versions}}', type: 'string', description: 'Affected version range' },
          { name: '{{vulnerability.fixed_version}}', type: 'string', description: 'Version with the fix' },
          { name: '{{vulnerability.references}}', type: 'array', description: 'Reference URLs' },
          { name: '{{affected_projects}}', type: 'array', description: 'List of affected project IDs' },
        ],
      },
    };

    // Map event types to relevant variable categories
    const eventVariables = {
      'test.run.started': ['common', 'project', 'run'],
      'test.run.completed': ['common', 'project', 'run'],
      'test.run.passed': ['common', 'project', 'run'],
      'test.run.failed': ['common', 'project', 'run', 'failures'],
      'test.completed': ['common', 'project', 'suite', 'test', 'result'],
      'flaky.test.detected': ['common', 'project', 'test', 'flakiness'],
      'visual.diff.detected': ['common', 'project', 'test', 'visual'],
      'performance.budget.exceeded': ['common', 'project', 'test', 'performance'],
      'security.vulnerability.found': ['common', 'vulnerability'],
    };

    return {
      categories: variables,
      event_mapping: eventVariables,
      usage: {
        example_template: JSON.stringify({
          custom_message: 'Test {{run.status}} for {{run.suite_name}}',
          run_id: '{{run.id}}',
          timestamp: '{{timestamp}}',
          stats: {
            passed: '{{run.passed}}',
            failed: '{{run.failed}}',
          },
        }, null, 2),
        notes: [
          'Use {{variable.path}} syntax to access nested properties',
          'Arrays can be accessed with {{array}} to include the whole array',
          'Use the preview endpoint to test your template before saving',
          'Variables that do not exist in the payload will remain as {{variable}} in the output',
        ],
      },
    };
  });

  // Feature #1293: Webhook signature verification documentation
  app.get('/api/v1/webhook-signature-verification', {
    preHandler: [authenticate],
  }, async () => ({
    header_name: 'X-QA-Guardian-Signature',
    algorithm: 'HMAC-SHA256',
    format: 'sha256=<hex_encoded_signature>',
    description: 'QA Guardian signs webhook payloads using HMAC-SHA256 when a secret is configured.',
    verification_steps: [
      { step: 1, title: 'Extract signature', code: 'const sig = request.headers["x-qa-guardian-signature"];' },
      { step: 2, title: 'Parse format', code: 'const providedSig = sig.split("=")[1];' },
      { step: 3, title: 'Compute expected', code: 'const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");' },
      { step: 4, title: 'Compare securely', code: 'crypto.timingSafeEqual(Buffer.from(providedSig, "hex"), Buffer.from(expected, "hex"));' },
    ],
    code_examples: {
      nodejs: 'const crypto = require("crypto"); function verify(req, secret) { const sig = req.headers["x-qa-guardian-signature"]; if (!sig?.startsWith("sha256=")) return false; const provided = sig.substring(7); const expected = crypto.createHmac("sha256", secret).update(JSON.stringify(req.body)).digest("hex"); try { return crypto.timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex")); } catch { return false; } }',
      python: 'import hmac, hashlib; def verify(request, secret): sig = request.headers.get("X-QA-Guardian-Signature", ""); return sig.startswith("sha256=") and hmac.compare_digest(sig.split("=", 1)[1], hmac.new(secret.encode(), request.data, hashlib.sha256).hexdigest())',
      go: 'func verify(body []byte, sig, secret string) bool { if !strings.HasPrefix(sig, "sha256=") { return false }; mac := hmac.New(sha256.New, []byte(secret)); mac.Write(body); return hmac.Equal([]byte(strings.TrimPrefix(sig, "sha256=")), []byte(hex.EncodeToString(mac.Sum(nil)))) }',
    },
    security_notes: ['Use timing-safe comparison', 'Store secrets securely', 'Use HTTPS', 'Implement replay protection'],
    headers_sent: { 'X-QA-Guardian-Signature': 'HMAC-SHA256 signature', 'X-Webhook-Event': 'Event type', 'X-Webhook-Delivery-Id': 'Unique delivery ID', 'Content-Type': 'application/json' },
  }));
}
