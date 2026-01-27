/**
 * Webhook Monitoring Routes Module
 *
 * Routes for managing webhook-based monitoring checks.
 * Extracted from monitoring.ts for better maintainability.
 *
 * Endpoints:
 * - GET /api/v1/monitoring/webhooks - List all webhook checks
 * - POST /api/v1/monitoring/webhooks - Create a webhook check
 * - POST /api/v1/monitoring/webhooks/receive/:token - Receive incoming webhook (public endpoint)
 * - GET /api/v1/monitoring/webhooks/:checkId - Get webhook check details
 * - DELETE /api/v1/monitoring/webhooks/:checkId - Delete a webhook check
 * - POST /api/v1/monitoring/webhooks/:checkId/test - Send test webhook
 */

import { FastifyInstance } from 'fastify';
import { authenticate, requireRoles, getOrganizationId, JwtPayload } from '../../middleware/auth';
import { logAuditEntry } from '../audit-logs';
import { WebhookCheck, WebhookEvent } from './types';
import { webhookChecks, webhookEvents, webhookTokenMap } from './stores';

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // Get all webhook checks
  app.get(
    '/api/v1/monitoring/webhooks',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const checks = Array.from(webhookChecks.values())
        .filter(check => check.organization_id === orgId)
        .map(check => {
          const events = webhookEvents.get(check.id) || [];
          const lastEvent = events[0];
          const eventsLast24h = events.filter(e =>
            e.received_at > new Date(Date.now() - 24 * 60 * 60 * 1000)
          ).length;

          return {
            ...check,
            created_at: check.created_at.toISOString(),
            updated_at: check.updated_at.toISOString(),
            last_received: lastEvent?.received_at.toISOString() || null,
            last_payload_valid: lastEvent?.payload_valid ?? null,
            events_24h: eventsLast24h,
          };
        });

      return { checks, total: checks.length };
    }
  );

  // Create a webhook check
  app.post<{
    Body: {
      name: string;
      description?: string;
      expected_interval: number; // seconds
      expected_payload?: {
        type: 'json-schema' | 'key-value' | 'any';
        schema?: object;
        required_fields?: string[];
        field_values?: Record<string, string | number | boolean>;
      };
      webhook_secret?: string;
    };
  }>(
    '/api/v1/monitoring/webhooks',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { name, description, expected_interval, expected_payload, webhook_secret } = request.body;
      const orgId = getOrganizationId(request);
      const user = request.user as JwtPayload;

      if (!name || name.trim().length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Name is required',
        });
      }

      if (!expected_interval || expected_interval < 60) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Expected interval must be at least 60 seconds',
        });
      }

      // Generate unique webhook ID and URL
      const checkId = `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const webhookToken = Math.random().toString(36).substr(2, 16) + Math.random().toString(36).substr(2, 16);

      const check: WebhookCheck = {
        id: checkId,
        organization_id: orgId,
        name: name.trim(),
        description,
        webhook_url: `/api/v1/monitoring/webhooks/receive/${webhookToken}`,
        webhook_secret,
        expected_interval,
        expected_payload: expected_payload || { type: 'any' },
        enabled: true,
        created_by: user.id,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Store the token -> checkId mapping
      webhookTokenMap.set(webhookToken, checkId);
      webhookChecks.set(checkId, check);
      webhookEvents.set(checkId, []);

      logAuditEntry(
        request,
        'monitoring.webhook.created',
        'webhook_check',
        checkId,
        check.name,
        { expected_interval }
      );

      return reply.status(201).send({
        message: 'Webhook check created successfully',
        check: {
          ...check,
          created_at: check.created_at.toISOString(),
          updated_at: check.updated_at.toISOString(),
          full_webhook_url: `${request.protocol}://${request.hostname}${check.webhook_url}`,
        },
      });
    }
  );

  // Receive incoming webhook (no auth - uses token in URL)
  app.post<{ Params: { token: string } }>(
    '/api/v1/monitoring/webhooks/receive/:token',
    async (request, reply) => {
      const { token } = request.params;
      const checkId = webhookTokenMap.get(token);

      if (!checkId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Invalid webhook endpoint',
        });
      }

      const check = webhookChecks.get(checkId);
      if (!check || !check.enabled) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Webhook check not found or disabled',
        });
      }

      // Validate signature if secret is configured
      let signatureValid: boolean | undefined;
      if (check.webhook_secret) {
        const signature = request.headers['x-webhook-signature'] as string;
        // Simple signature validation (in production, use HMAC-SHA256)
        signatureValid = signature === check.webhook_secret;
      }

      // Validate payload
      const payload = request.body;
      let payloadValid = true;
      const validationErrors: string[] = [];

      if (check.expected_payload) {
        const { type, required_fields, field_values } = check.expected_payload;

        if (type === 'key-value' && required_fields && Array.isArray(required_fields)) {
          for (const field of required_fields) {
            if (!payload || typeof payload !== 'object' || !(field in (payload as object))) {
              payloadValid = false;
              validationErrors.push(`Missing required field: ${field}`);
            }
          }
        }

        if (type === 'key-value' && field_values && typeof payload === 'object' && payload !== null) {
          for (const [key, expectedValue] of Object.entries(field_values)) {
            const actualValue = (payload as Record<string, unknown>)[key];
            if (actualValue !== expectedValue) {
              payloadValid = false;
              validationErrors.push(`Field "${key}" expected "${expectedValue}" but got "${actualValue}"`);
            }
          }
        }
      }

      // Record the event
      const event: WebhookEvent = {
        id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        check_id: checkId,
        received_at: new Date(),
        source_ip: request.ip || 'unknown',
        headers: request.headers as Record<string, string>,
        payload,
        payload_valid: payloadValid,
        validation_errors: validationErrors.length > 0 ? validationErrors : undefined,
        signature_valid: signatureValid,
      };

      const events = webhookEvents.get(checkId) || [];
      events.unshift(event); // Add to beginning
      // Keep only last 100 events
      if (events.length > 100) events.pop();
      webhookEvents.set(checkId, events);

      return {
        received: true,
        event_id: event.id,
        payload_valid: payloadValid,
        validation_errors: validationErrors.length > 0 ? validationErrors : undefined,
        signature_valid: signatureValid,
      };
    }
  );

  // Get webhook check details
  app.get<{ Params: { checkId: string } }>(
    '/api/v1/monitoring/webhooks/:checkId',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const orgId = getOrganizationId(request);

      const check = webhookChecks.get(checkId);

      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Webhook check not found',
        });
      }

      const events = webhookEvents.get(checkId) || [];

      return {
        check: {
          ...check,
          created_at: check.created_at.toISOString(),
          updated_at: check.updated_at.toISOString(),
        },
        events: events.slice(0, 20).map(e => ({
          ...e,
          received_at: e.received_at.toISOString(),
        })),
        total_events: events.length,
      };
    }
  );

  // Delete a webhook check
  app.delete<{ Params: { checkId: string } }>(
    '/api/v1/monitoring/webhooks/:checkId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const orgId = getOrganizationId(request);

      const check = webhookChecks.get(checkId);

      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Webhook check not found',
        });
      }

      // Remove token mapping
      const token = check.webhook_url.split('/').pop();
      if (token) webhookTokenMap.delete(token);

      webhookChecks.delete(checkId);
      webhookEvents.delete(checkId);

      logAuditEntry(
        request,
        'monitoring.webhook.deleted',
        'webhook_check',
        checkId,
        check.name
      );

      return { message: 'Webhook check deleted successfully' };
    }
  );

  // Send test webhook (for testing the endpoint)
  app.post<{ Params: { checkId: string }; Body: { payload?: unknown } }>(
    '/api/v1/monitoring/webhooks/:checkId/test',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const { payload = { test: true, timestamp: new Date().toISOString() } } = request.body || {};
      const orgId = getOrganizationId(request);

      const check = webhookChecks.get(checkId);

      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Webhook check not found',
        });
      }

      // Simulate receiving a webhook with the test payload
      let payloadValid = true;
      const validationErrors: string[] = [];

      if (check.expected_payload) {
        const { type, required_fields, field_values } = check.expected_payload;

        if (type === 'key-value' && required_fields && Array.isArray(required_fields)) {
          for (const field of required_fields) {
            if (!payload || typeof payload !== 'object' || !(field in (payload as object))) {
              payloadValid = false;
              validationErrors.push(`Missing required field: ${field}`);
            }
          }
        }

        if (type === 'key-value' && field_values && typeof payload === 'object' && payload !== null) {
          for (const [key, expectedValue] of Object.entries(field_values)) {
            const actualValue = (payload as Record<string, unknown>)[key];
            if (actualValue !== expectedValue) {
              payloadValid = false;
              validationErrors.push(`Field "${key}" expected "${expectedValue}" but got "${actualValue}"`);
            }
          }
        }
      }

      // Record the test event
      const event: WebhookEvent = {
        id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        check_id: checkId,
        received_at: new Date(),
        source_ip: 'test-internal',
        headers: { 'x-test-event': 'true' },
        payload,
        payload_valid: payloadValid,
        validation_errors: validationErrors.length > 0 ? validationErrors : undefined,
      };

      const events = webhookEvents.get(checkId) || [];
      events.unshift(event);
      if (events.length > 100) events.pop();
      webhookEvents.set(checkId, events);

      return {
        message: 'Test webhook sent successfully',
        event_id: event.id,
        payload_valid: payloadValid,
        validation_errors: validationErrors.length > 0 ? validationErrors : undefined,
      };
    }
  );
}
