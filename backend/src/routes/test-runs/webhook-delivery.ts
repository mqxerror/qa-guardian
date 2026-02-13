/**
 * Webhook Delivery Routes - Features #1291-1296
 * Delivery logs, status, testing, and documentation
 *
 * Split from webhook-subscriptions.ts for code quality
 */
import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId, JwtPayload } from '../../middleware/auth.js';
import { WebhookSubscription, webhookSubscriptions, applyPayloadTemplate, generateWebhookSignature, WEBHOOK_SIGNATURE_TOLERANCE_SECONDS, getWebhookDeliveryLogsFromDb, MAX_WEBHOOK_RETRIES } from './webhooks.js';
import { validateWebhookURL, validateWebhookURLWithDNS, generateId } from '../../utils/index.js';
import { webhookLog } from './alerts.js';
import { logWebhookDelivery, flattenObject } from './webhook-crud.js';
import * as webhookRepo from '../../services/repositories/webhooks.js';
// Feature #484: Pino structured logging
import { createLogger } from '../../services/logger.js';

import { sendError } from '../../utils/errors.js';
const log = createLogger('webhook-delivery');

// ============================================================================
// Route Registration
// ============================================================================

export async function webhookDeliveryRoutes(app: FastifyInstance) {
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
      return sendError(reply, 404, 'NOT_FOUND', 'Webhook subscription not found');
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
      return sendError(reply, 404, 'NOT_FOUND', 'Webhook subscription not found');
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
        max_retries: subscription.max_retries ?? MAX_WEBHOOK_RETRIES,
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
      return sendError(reply, 404, 'NOT_FOUND', 'Webhook subscription not found');
    }

    // Feature #315 + #400: SSRF protection with DNS resolution check
    // This prevents DNS rebinding attacks where a hostname resolves to a private IP
    const ssrfValidation = await validateWebhookURLWithDNS(subscription.url);
    if (!ssrfValidation.safe) {
      return sendError(reply, 400, 'BAD_REQUEST', `Webhook URL rejected: ${ssrfValidation.error}`, { ssrf_blocked: true });
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

    log.info({ subscriptionId, subscriptionName: subscription.name, code: 'WEBHOOK_TEST' }, 'Testing webhook subscription');

    const startTime = Date.now();
    const deliveryId = generateId('test', 7); // Feature #357: Use shared ID generator

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': 'test',
      'X-Webhook-Delivery-Id': deliveryId,
      ...subscription.headers,
    };

    // Add HMAC signature if secret is configured
    // Feature #314: Stripe-style signing with timestamp for replay protection
    if (subscription.secret) {
      const { signature } = generateWebhookSignature(JSON.stringify(testPayload), subscription.secret);
      requestHeaders['X-Webhook-Signature'] = signature;
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
          status_code: responseStatus,
          message: `Webhook returned HTTP ${responseStatus}`,
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
      return sendError(reply, 404, 'NOT_FOUND', 'Webhook subscription not found');
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

  // Feature #1293 + #314: Webhook signature verification documentation
  // Updated to Stripe-style signing with timestamp and replay protection
  app.get('/api/v1/webhook-signature-verification', {
    preHandler: [authenticate],
  }, async () => ({
    header_name: 'X-Webhook-Signature',
    algorithm: 'HMAC-SHA256',
    format: 't=<unix_timestamp>,v1=<hex_encoded_signature>',
    description: 'QA Guardian signs webhook payloads using Stripe-style HMAC-SHA256 with timestamp. The signature is computed over "timestamp.payload" to enable replay protection.',
    replay_protection: {
      enabled: true,
      tolerance_seconds: WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
      description: `Signatures older than ${WEBHOOK_SIGNATURE_TOLERANCE_SECONDS} seconds (5 minutes) should be rejected to prevent replay attacks.`,
    },
    verification_steps: [
      { step: 1, title: 'Extract header', code: 'const sig = request.headers["x-webhook-signature"];' },
      { step: 2, title: 'Parse components', code: 'const parts = sig.split(","); const timestamp = parts.find(p => p.startsWith("t="))?.split("=")[1]; const signature = parts.find(p => p.startsWith("v1="))?.split("=")[1];' },
      { step: 3, title: 'Check timestamp', code: 'const age = Math.floor(Date.now() / 1000) - parseInt(timestamp); if (age > 300) throw new Error("Signature expired");' },
      { step: 4, title: 'Compute expected', code: 'const signedPayload = `${timestamp}.${body}`; const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");' },
      { step: 5, title: 'Compare securely', code: 'crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));' },
    ],
    code_examples: {
      nodejs: `const crypto = require("crypto");

function verifyWebhookSignature(body, signatureHeader, secret, tolerance = 300) {
  // Parse signature header: t=timestamp,v1=signature
  const parts = signatureHeader.split(",");
  const timestamp = parts.find(p => p.startsWith("t="))?.split("=")[1];
  const signature = parts.find(p => p.startsWith("v1="))?.split("=")[1];

  if (!timestamp || !signature) return false;

  // Check timestamp (replay protection)
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (age > tolerance || age < -tolerance) return false;

  // Compute expected signature
  const signedPayload = \`\${timestamp}.\${body}\`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch { return false; }
}`,
      python: `import hmac, hashlib, time

def verify_webhook_signature(body: bytes, signature_header: str, secret: str, tolerance: int = 300) -> bool:
    # Parse signature header: t=timestamp,v1=signature
    parts = dict(p.split("=", 1) for p in signature_header.split(",") if "=" in p)
    timestamp = parts.get("t")
    signature = parts.get("v1")

    if not timestamp or not signature:
        return False

    # Check timestamp (replay protection)
    age = int(time.time()) - int(timestamp)
    if abs(age) > tolerance:
        return False

    # Compute expected signature
    signed_payload = f"{timestamp}.".encode() + body
    expected = hmac.new(secret.encode(), signed_payload, hashlib.sha256).hexdigest()

    return hmac.compare_digest(signature, expected)`,
      go: `func verifyWebhookSignature(body []byte, sigHeader, secret string, tolerance int64) bool {
    // Parse signature header
    var timestamp, signature string
    for _, part := range strings.Split(sigHeader, ",") {
        kv := strings.SplitN(part, "=", 2)
        if len(kv) == 2 {
            if kv[0] == "t" { timestamp = kv[1] }
            if kv[0] == "v1" { signature = kv[1] }
        }
    }
    if timestamp == "" || signature == "" { return false }

    // Check timestamp (replay protection)
    ts, _ := strconv.ParseInt(timestamp, 10, 64)
    age := time.Now().Unix() - ts
    if age > tolerance || age < -tolerance { return false }

    // Compute expected signature
    signedPayload := fmt.Sprintf("%s.%s", timestamp, body)
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(signedPayload))
    expected := hex.EncodeToString(mac.Sum(nil))

    return hmac.Equal([]byte(signature), []byte(expected))
}`,
    },
    security_notes: [
      'Always verify the timestamp to prevent replay attacks',
      'Reject signatures older than 5 minutes (300 seconds)',
      'Use timing-safe comparison to prevent timing attacks',
      'Store webhook secrets securely (environment variables, secrets manager)',
      'Always use HTTPS for webhook endpoints',
      'Log failed verification attempts for security monitoring',
    ],
    headers_sent: {
      'X-Webhook-Signature': 'Stripe-style signature: t=timestamp,v1=hmac',
      'X-Webhook-Event': 'Event type that triggered the webhook',
      'X-Webhook-Delivery': 'Unique delivery ID for tracking',
      'X-Webhook-Attempt': 'Delivery attempt number (for retries)',
      'Content-Type': 'application/json',
    },
  }));

  // Feature #329: Get delivery history from database with pagination
  // This endpoint provides persistent delivery history that survives server restarts
  app.get<{
    Params: { subscriptionId: string };
    Querystring: {
      limit?: string;
      offset?: string;
      status?: 'success' | 'failed' | 'pending_retry';
    };
  }>('/api/v1/webhook-subscriptions/:subscriptionId/delivery-history', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const { subscriptionId } = request.params;
    const { limit = '50', offset = '0', status } = request.query;

    const subscription = webhookSubscriptions.get(subscriptionId);
    if (!subscription || subscription.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Webhook subscription not found');
    }

    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offsetNum = parseInt(offset) || 0;

    try {
      // Use database-backed function
      const result = await getWebhookDeliveryLogsFromDb(subscriptionId, {
        limit: limitNum,
        offset: offsetNum,
        status,
      });

      return {
        subscription: {
          id: subscription.id,
          name: subscription.name,
        },
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
        limit: limitNum,
        offset: offsetNum,
        source: 'database', // Indicates data comes from persistent storage
      };
    } catch (error: unknown) {
      log.error({ err: error, code: 'WEBHOOK_DELIVERY_HISTORY_FAILED' }, 'Failed to get delivery history from database');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve delivery history');
    }
  });

  // Feature #329: Get all recent delivery logs for the organization (from database)
  app.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      event_type?: string;
      success?: string;
    };
  }>('/api/v1/webhook-delivery-history', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const { limit = '50', offset = '0', event_type, success } = request.query;

    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offsetNum = parseInt(offset) || 0;

    try {
      const result = await webhookRepo.getRecentDeliveryLogs(orgId, {
        limit: limitNum,
        offset: offsetNum,
        eventType: event_type,
        success: success === undefined ? undefined : success === 'true',
      });

      return {
        logs: result.logs.map(log => ({
          id: log.id,
          subscription_id: log.subscription_id,
          subscription_name: log.subscription_name,
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
        limit: limitNum,
        offset: offsetNum,
        source: 'database',
      };
    } catch (error: unknown) {
      log.error({ err: error, code: 'WEBHOOK_DELIVERY_HISTORY_FAILED' }, 'Failed to get delivery history from database');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve delivery history');
    }
  });
}
