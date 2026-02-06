/**
 * Alert Correlation and Runbooks Routes Module
 *
 * Split from alert-correlation-incidents.ts - contains:
 * - Alert correlation configs
 * - Alert runbooks CRUD
 * - Alert routing test destinations
 *
 * Note: Incident management routes moved to incidents.ts
 *
 * Feature #1375: Split alert management routes from monitoring.ts
 */

import { FastifyInstance } from 'fastify';
import { authenticate, requireRoles, getOrganizationId } from '../../middleware/auth';

import {
  AlertCorrelationConfig,
  CorrelatedAlert,
  AlertCorrelation,
  AlertRunbook,
} from './types';

import {
  alertCorrelationConfigs,
  alertCorrelations,
  alertToCorrelation,
  alertRunbooks,
} from './stores';

import {
  correlateAlert,
  findRunbookForAlert,
} from './helpers';

export async function alertCorrelationRoutes(app: FastifyInstance): Promise<void> {
  // ============================================================
  // ALERT CORRELATION ENDPOINTS
  // ============================================================

  // Get alert correlation configuration
  app.get(
    '/api/v1/monitoring/alert-correlation/config',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const config = alertCorrelationConfigs.get(orgId);

      if (!config) {
        return {
          enabled: false,
          correlate_by_check: true,
          correlate_by_location: true,
          correlate_by_error_type: true,
          correlate_by_time_window: true,
          time_window_seconds: 300,
          similarity_threshold: 60,
        };
      }

      return config;
    }
  );

  // Update alert correlation configuration
  app.post<{
    Body: {
      enabled: boolean;
      correlate_by_check: boolean;
      correlate_by_location: boolean;
      correlate_by_error_type: boolean;
      correlate_by_time_window: boolean;
      time_window_seconds: number;
      similarity_threshold: number;
    };
  }>(
    '/api/v1/monitoring/alert-correlation/config',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const body = request.body;

      const config: AlertCorrelationConfig = {
        organization_id: orgId,
        enabled: body.enabled,
        correlate_by_check: body.correlate_by_check,
        correlate_by_location: body.correlate_by_location,
        correlate_by_error_type: body.correlate_by_error_type,
        correlate_by_time_window: body.correlate_by_time_window,
        time_window_seconds: body.time_window_seconds || 300,
        similarity_threshold: body.similarity_threshold || 60,
        updated_at: new Date(),
      };

      alertCorrelationConfigs.set(orgId, config);

      console.log(`[CORRELATION] Config saved for org ${orgId}:`, config);

      return { success: true, config };
    }
  );

  // Get all correlations for organization
  app.get<{
    Querystring: {
      status?: 'active' | 'acknowledged' | 'resolved';
      limit?: string;
    };
  }>(
    '/api/v1/monitoring/alert-correlation/correlations',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const { status, limit } = request.query;
      const maxResults = parseInt(limit || '50');

      const correlations: AlertCorrelation[] = [];
      for (const [_, corr] of alertCorrelations) {
        if (corr.organization_id !== orgId) continue;
        if (status && corr.status !== status) continue;
        correlations.push(corr);
      }

      // Sort by created_at descending
      correlations.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

      return {
        correlations: correlations.slice(0, maxResults),
        total: correlations.length,
      };
    }
  );

  // Get a specific correlation by ID
  app.get<{
    Params: { correlationId: string };
  }>(
    '/api/v1/monitoring/alert-correlation/correlations/:correlationId',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { correlationId } = request.params;
      const orgId = getOrganizationId(request);

      const correlation = alertCorrelations.get(correlationId);
      if (!correlation || correlation.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Correlation not found' });
      }

      return correlation;
    }
  );

  // Acknowledge a correlation
  app.post<{
    Params: { correlationId: string };
  }>(
    '/api/v1/monitoring/alert-correlation/correlations/:correlationId/acknowledge',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { correlationId } = request.params;
      const orgId = getOrganizationId(request);
      const user = (request as any).user;

      const correlation = alertCorrelations.get(correlationId);
      if (!correlation || correlation.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Correlation not found' });
      }

      correlation.status = 'acknowledged';
      correlation.acknowledged_by = user.email;
      correlation.acknowledged_at = new Date();
      correlation.updated_at = new Date();

      return { success: true, correlation };
    }
  );

  // Resolve a correlation
  app.post<{
    Params: { correlationId: string };
  }>(
    '/api/v1/monitoring/alert-correlation/correlations/:correlationId/resolve',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { correlationId } = request.params;
      const orgId = getOrganizationId(request);

      const correlation = alertCorrelations.get(correlationId);
      if (!correlation || correlation.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Correlation not found' });
      }

      correlation.status = 'resolved';
      correlation.updated_at = new Date();

      return { success: true, correlation };
    }
  );

  // Test alert correlation - trigger multiple related alerts to test
  app.post<{
    Body: {
      alert_count: number;
      scenario: 'same_check' | 'same_location' | 'similar_error' | 'mixed';
    };
  }>(
    '/api/v1/monitoring/alert-correlation/test',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const { alert_count = 5, scenario = 'mixed' } = request.body;

      // Enable correlation config if not already enabled
      let config = alertCorrelationConfigs.get(orgId);
      if (!config || !config.enabled) {
        config = {
          organization_id: orgId,
          enabled: true,
          correlate_by_check: true,
          correlate_by_location: true,
          correlate_by_error_type: true,
          correlate_by_time_window: true,
          time_window_seconds: 300,
          similarity_threshold: 60,
          updated_at: new Date(),
        };
        alertCorrelationConfigs.set(orgId, config);
      }

      const results: Array<{
        alert_id: string;
        correlated: boolean;
        correlation_id?: string;
        reason?: string;
      }> = [];

      const baseCheckId = `check-test-${Date.now()}`;
      const locations = ['US East', 'US West', 'EU West', 'Asia Pacific'];
      const errorMessages = [
        'Connection timeout after 30000ms',
        'Connection timeout after 30000ms - request failed',
        'SSL certificate expired',
        'SSL certificate has expired',
        'Server returned 500 Internal Server Error',
        'Server error: 500 Internal Server Error',
      ];

      for (let i = 0; i < alert_count; i++) {
        const alertId = `alert-test-${Date.now()}-${i}`;

        let alertInfo: CorrelatedAlert;

        switch (scenario) {
          case 'same_check':
            alertInfo = {
              id: alertId,
              check_id: baseCheckId,
              check_name: 'API Health Check',
              check_type: 'uptime',
              location: locations[i % locations.length],
              error_message: errorMessages[i % errorMessages.length],
              severity: 'high',
              triggered_at: new Date(),
            };
            break;

          case 'same_location':
            alertInfo = {
              id: alertId,
              check_id: `${baseCheckId}-${i}`,
              check_name: `Check ${i + 1}`,
              check_type: 'uptime',
              location: 'US East', // All same location
              error_message: errorMessages[i % errorMessages.length],
              severity: 'medium',
              triggered_at: new Date(),
            };
            break;

          case 'similar_error':
            alertInfo = {
              id: alertId,
              check_id: `${baseCheckId}-${i}`,
              check_name: `Check ${i + 1}`,
              check_type: 'uptime',
              location: locations[i % locations.length],
              error_message: i % 2 === 0 ? 'Connection timeout after 30000ms' : 'Connection timeout after 30000ms - request failed',
              severity: 'high',
              triggered_at: new Date(),
            };
            break;

          case 'mixed':
          default:
            alertInfo = {
              id: alertId,
              check_id: i < 2 ? baseCheckId : `${baseCheckId}-${i}`, // First 2 same check
              check_name: i < 2 ? 'API Health Check' : `Check ${i + 1}`,
              check_type: 'uptime',
              location: i < 3 ? 'US East' : locations[i % locations.length], // First 3 same location
              error_message: errorMessages[Math.floor(i / 2) % errorMessages.length], // Pairs have similar errors
              severity: ['low', 'medium', 'high', 'critical'][i % 4] as any,
              triggered_at: new Date(),
            };
            break;
        }

        const result = correlateAlert(orgId, alertInfo);
        results.push({
          alert_id: alertId,
          correlated: result.correlated,
          correlation_id: result.correlation_id,
          reason: result.correlation_reason,
        });

        // Small delay between alerts
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Count unique correlations
      const uniqueCorrelations = new Set(results.filter(r => r.correlation_id).map(r => r.correlation_id));

      return {
        test_alerts: alert_count,
        scenario,
        results,
        correlations_created: uniqueCorrelations.size,
        message: `${alert_count} test alerts triggered, grouped into ${uniqueCorrelations.size} correlation(s)`,
      };
    }
  );

  // Reset correlation state (for testing/debugging)
  app.post(
    '/api/v1/monitoring/alert-correlation/reset',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const orgId = getOrganizationId(request);

      // Remove all correlations for this org
      const toDelete: string[] = [];
      for (const [corrId, corr] of alertCorrelations) {
        if (corr.organization_id === orgId) {
          toDelete.push(corrId);
          // Also clean up alert-to-correlation mappings
          for (const alert of corr.alerts) {
            alertToCorrelation.delete(alert.id);
          }
        }
      }
      toDelete.forEach(id => alertCorrelations.delete(id));

      console.log(`[CORRELATION] State reset for org ${orgId}, removed ${toDelete.length} correlations`);

      return {
        success: true,
        message: `Correlation state reset, removed ${toDelete.length} correlations`,
      };
    }
  );

  // ============================================================
  // ALERT RUNBOOK ENDPOINTS
  // ============================================================

  // Get all runbooks for organization
  app.get(
    '/api/v1/monitoring/alert-runbooks',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const runbooks: AlertRunbook[] = [];

      for (const [_, runbook] of alertRunbooks) {
        if (runbook.organization_id === orgId) {
          runbooks.push(runbook);
        }
      }

      // Sort by check_type then severity
      runbooks.sort((a, b) => {
        if (a.check_type !== b.check_type) {
          return a.check_type.localeCompare(b.check_type);
        }
        return (a.severity || 'all').localeCompare(b.severity || 'all');
      });

      return { runbooks, total: runbooks.length };
    }
  );

  // Create a new runbook
  app.post<{
    Body: {
      name: string;
      description?: string;
      check_type: 'uptime' | 'transaction' | 'performance' | 'webhook' | 'dns' | 'tcp' | 'all';
      severity?: 'critical' | 'high' | 'medium' | 'low' | 'all';
      runbook_url: string;
      instructions?: string;
      tags?: string[];
    };
  }>(
    '/api/v1/monitoring/alert-runbooks',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const user = (request as any).user;
      const body = request.body;

      const runbookId = `runbook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();

      const runbook: AlertRunbook = {
        id: runbookId,
        organization_id: orgId,
        name: body.name,
        description: body.description,
        check_type: body.check_type,
        severity: body.severity || 'all',
        runbook_url: body.runbook_url,
        instructions: body.instructions,
        tags: body.tags || [],
        created_by: user.email,
        created_at: now,
        updated_at: now,
      };

      alertRunbooks.set(runbookId, runbook);

      console.log(`[RUNBOOK] Created runbook ${runbookId} for ${body.check_type}/${body.severity || 'all'}`);

      return { success: true, runbook };
    }
  );

  // Get a specific runbook
  app.get<{
    Params: { runbookId: string };
  }>(
    '/api/v1/monitoring/alert-runbooks/:runbookId',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { runbookId } = request.params;
      const orgId = getOrganizationId(request);

      const runbook = alertRunbooks.get(runbookId);
      if (!runbook || runbook.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Runbook not found' });
      }

      return runbook;
    }
  );

  // Update a runbook
  app.put<{
    Params: { runbookId: string };
    Body: {
      name?: string;
      description?: string;
      check_type?: 'uptime' | 'transaction' | 'performance' | 'webhook' | 'dns' | 'tcp' | 'all';
      severity?: 'critical' | 'high' | 'medium' | 'low' | 'all';
      runbook_url?: string;
      instructions?: string;
      tags?: string[];
    };
  }>(
    '/api/v1/monitoring/alert-runbooks/:runbookId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { runbookId } = request.params;
      const orgId = getOrganizationId(request);
      const body = request.body;

      const runbook = alertRunbooks.get(runbookId);
      if (!runbook || runbook.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Runbook not found' });
      }

      // Update fields
      if (body.name) runbook.name = body.name;
      if (body.description !== undefined) runbook.description = body.description;
      if (body.check_type) runbook.check_type = body.check_type;
      if (body.severity) runbook.severity = body.severity;
      if (body.runbook_url) runbook.runbook_url = body.runbook_url;
      if (body.instructions !== undefined) runbook.instructions = body.instructions;
      if (body.tags) runbook.tags = body.tags;
      runbook.updated_at = new Date();

      return { success: true, runbook };
    }
  );

  // Delete a runbook
  app.delete<{
    Params: { runbookId: string };
  }>(
    '/api/v1/monitoring/alert-runbooks/:runbookId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { runbookId } = request.params;
      const orgId = getOrganizationId(request);

      const runbook = alertRunbooks.get(runbookId);
      if (!runbook || runbook.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Runbook not found' });
      }

      alertRunbooks.delete(runbookId);

      console.log(`[RUNBOOK] Deleted runbook ${runbookId}`);

      return { success: true, message: 'Runbook deleted' };
    }
  );

  // Find matching runbook for an alert type
  app.get<{
    Querystring: {
      check_type: string;
      severity?: string;
    };
  }>(
    '/api/v1/monitoring/alert-runbooks/match',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const { check_type, severity = 'medium' } = request.query;

      const runbook = findRunbookForAlert(orgId, check_type, severity);

      if (!runbook) {
        return { found: false, runbook: null };
      }

      return { found: true, runbook };
    }
  );

  // Test alert with runbook - simulate triggering an alert and finding its runbook
  app.post<{
    Body: {
      check_type: 'uptime' | 'transaction' | 'performance' | 'webhook' | 'dns' | 'tcp';
      severity: 'critical' | 'high' | 'medium' | 'low';
      check_name?: string;
      error_message?: string;
    };
  }>(
    '/api/v1/monitoring/alert-runbooks/test',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const body = request.body;

      const runbook = findRunbookForAlert(orgId, body.check_type, body.severity);

      const testAlert = {
        id: `test-alert-${Date.now()}`,
        check_name: body.check_name || `Test ${body.check_type} Check`,
        check_type: body.check_type,
        severity: body.severity,
        error_message: body.error_message || 'Test error for runbook verification',
        triggered_at: new Date().toISOString(),
        runbook: runbook ? {
          id: runbook.id,
          name: runbook.name,
          url: runbook.runbook_url,
          instructions: runbook.instructions,
        } : null,
      };

      return {
        success: true,
        alert: testAlert,
        runbook_found: !!runbook,
        message: runbook
          ? `Found runbook "${runbook.name}" for ${body.check_type}/${body.severity} alerts`
          : `No runbook configured for ${body.check_type}/${body.severity} alerts`,
      };
    }
  );

  // Helper function to apply template variables
  const applyTemplateVariables = (template: string, variables: Record<string, string>): string => {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      // Support both {{variable}} and {variable} syntax
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
  };

  // Send test alert to a specific destination (n8n, Telegram, webhook, PagerDuty, Teams, etc.)
  app.post<{
    Body: {
      destination_type: 'n8n' | 'telegram' | 'webhook' | 'slack' | 'pagerduty' | 'opsgenie' | 'teams';
      config: {
        webhook_url?: string;
        n8n_webhook_url?: string;
        telegram_bot_token?: string;
        telegram_chat_id?: string;
        message_template?: string;
        payload_template?: string;
        // PagerDuty
        integration_key?: string;
        severity_mapping?: Record<string, string>;
        // OpsGenie
        api_key?: string;
        // Microsoft Teams
        teams_webhook_url?: string;
        teams_title?: string;
        teams_theme_color?: string;
        // Discord
        discord_webhook_url?: string;
        discord_username?: string;
        discord_avatar_url?: string;
        discord_embed_color?: string;
      };
      test_alert?: {
        check_name: string;
        check_type: string;
        severity: string;
        error_message?: string;
      };
    };
  }>(
    '/api/v1/monitoring/alert-routing/test-destination',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { destination_type, config, test_alert } = request.body;
      const user = (request as any).user;

      const alertPayload = test_alert || {
        check_name: 'Test Alert',
        check_type: 'uptime',
        severity: 'medium',
        error_message: 'This is a test alert from QA Guardian',
      };

      const timestamp = new Date().toISOString();
      const alertId = `test-${Date.now()}`;

      // Template variables that can be used in payload_template
      const templateVariables: Record<string, string> = {
        check_name: alertPayload.check_name,
        check_type: alertPayload.check_type,
        severity: alertPayload.severity,
        error_message: alertPayload.error_message || 'No details',
        timestamp,
        alert_id: alertId,
        triggered_by: user?.email || 'unknown',
        source: 'qa_guardian',
        severity_upper: alertPayload.severity.toUpperCase(),
      };

      // Build alert data - either from custom template or default structure
      let alertData: Record<string, any>;

      if (config.payload_template) {
        try {
          // Apply template variables to custom payload template
          const processedTemplate = applyTemplateVariables(config.payload_template, templateVariables);
          alertData = JSON.parse(processedTemplate);
        } catch (parseError: any) {
          return reply.status(400).send({
            error: `Invalid payload template: ${parseError.message}`,
            hint: 'Ensure your template is valid JSON with {{variable}} placeholders',
          });
        }
      } else {
        // Default alert data structure
        alertData = {
          source: 'qa_guardian',
          alert_id: alertId,
          ...alertPayload,
          triggered_at: timestamp,
          triggered_by: user?.email || 'unknown',
          message: config.message_template
            ? applyTemplateVariables(config.message_template, templateVariables)
            : `[${alertPayload.severity.toUpperCase()}] ${alertPayload.check_name}: ${alertPayload.error_message || 'Alert triggered'}`,
        };
      }

      try {
        let webhookUrl: string | undefined;
        let result: any;

        switch (destination_type) {
          case 'pagerduty': {
            // PagerDuty Events API v2
            if (!config.integration_key) {
              return reply.status(400).send({ error: 'integration_key is required for PagerDuty' });
            }

            // Map severity to PagerDuty severity
            const severityMapping: Record<string, string> = config.severity_mapping || {};
            const pdSeverity = severityMapping[alertPayload.severity] ||
              (alertPayload.severity === 'critical' ? 'critical' :
               alertPayload.severity === 'high' ? 'error' :
               alertPayload.severity === 'medium' ? 'warning' : 'info');

            const pagerDutyPayload = {
              routing_key: config.integration_key,
              event_action: 'trigger',
              dedup_key: alertId,
              payload: {
                summary: `[${alertPayload.severity.toUpperCase()}] ${alertPayload.check_name}: ${alertPayload.error_message || 'Alert triggered'}`,
                source: 'QA Guardian',
                severity: pdSeverity,
                timestamp,
                custom_details: {
                  check_name: alertPayload.check_name,
                  check_type: alertPayload.check_type,
                  original_severity: alertPayload.severity,
                  error_message: alertPayload.error_message,
                  triggered_by: user?.email || 'unknown',
                },
              },
              links: [
                {
                  href: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/monitoring`,
                  text: 'View in QA Guardian',
                },
              ],
            };

            result = await fetch('https://events.pagerduty.com/v2/enqueue', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(pagerDutyPayload),
            });

            if (!result.ok) {
              const errorData = await result.json().catch(() => ({}));
              console.error('PagerDuty API error:', errorData);
              return {
                success: false,
                destination_type,
                error: `PagerDuty API error: ${errorData.message || errorData.status || 'Unknown error'}`,
                alert_payload: pagerDutyPayload,
              };
            }

            const pdResponse = await result.json().catch(() => ({}));
            console.log(`Test alert sent to PagerDuty, dedup_key: ${alertId}`);
            return {
              success: true,
              destination_type,
              message: `Test alert sent to PagerDuty. Dedup key: ${alertId}`,
              pagerduty_response: pdResponse,
              alert_payload: pagerDutyPayload,
            };
          }

          case 'opsgenie': {
            // OpsGenie Alert API
            if (!config.api_key) {
              return reply.status(400).send({ error: 'api_key is required for OpsGenie' });
            }

            // Map severity to OpsGenie priority (P1-P5)
            const priorityMapping: Record<string, string> = {
              critical: 'P1',
              high: 'P2',
              medium: 'P3',
              low: 'P4',
              info: 'P5',
            };

            const opsgeniePayload = {
              message: `[${alertPayload.severity.toUpperCase()}] ${alertPayload.check_name}: ${alertPayload.error_message || 'Alert triggered'}`,
              alias: alertId,
              description: alertPayload.error_message || 'Alert triggered from QA Guardian',
              priority: priorityMapping[alertPayload.severity] || 'P3',
              source: 'QA Guardian',
              tags: ['qa-guardian', alertPayload.check_type],
              details: {
                check_name: alertPayload.check_name,
                check_type: alertPayload.check_type,
                severity: alertPayload.severity,
                triggered_by: user?.email || 'unknown',
              },
            };

            result = await fetch('https://api.opsgenie.com/v2/alerts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `GenieKey ${config.api_key}`,
              },
              body: JSON.stringify(opsgeniePayload),
            });

            if (!result.ok) {
              const errorData = await result.json().catch(() => ({}));
              console.error('OpsGenie API error:', errorData);
              return {
                success: false,
                destination_type,
                error: `OpsGenie API error: ${errorData.message || 'Unknown error'}`,
                alert_payload: opsgeniePayload,
              };
            }

            const ogResponse = await result.json().catch(() => ({}));
            console.log(`Test alert sent to OpsGenie, alias: ${alertId}`);
            return {
              success: true,
              destination_type,
              message: `Test alert sent to OpsGenie. Request ID: ${ogResponse.requestId || 'N/A'}`,
              opsgenie_response: ogResponse,
              alert_payload: opsgeniePayload,
            };
          }

          case 'teams': {
            // Microsoft Teams Incoming Webhook (Adaptive Card format)
            if (!config.teams_webhook_url) {
              return reply.status(400).send({ error: 'teams_webhook_url is required for Microsoft Teams' });
            }

            // Map severity to color
            const severityColors: Record<string, string> = {
              critical: 'FF0000',
              high: 'FF6600',
              medium: 'FFAA00',
              low: '0078D7',
              info: '00AA00',
            };
            const themeColor = config.teams_theme_color?.replace('#', '') ||
              severityColors[alertPayload.severity] || 'FF0000';

            // Build Teams message template
            const messageText = config.message_template
              ? applyTemplateVariables(config.message_template, templateVariables)
              : `[${alertPayload.severity.toUpperCase()}] ${alertPayload.check_name}: ${alertPayload.error_message || 'Alert triggered'}`;

            // Microsoft Teams Adaptive Card payload (Office 365 Connector format)
            const teamsPayload = {
              '@type': 'MessageCard',
              '@context': 'http://schema.org/extensions',
              themeColor,
              summary: `${config.teams_title || 'QA Guardian Alert'}: ${alertPayload.check_name}`,
              sections: [
                {
                  activityTitle: config.teams_title || 'QA Guardian Alert',
                  activitySubtitle: `Source: ${alertPayload.check_type}`,
                  activityImage: 'https://qa-guardian.example.com/logo.png',
                  facts: [
                    { name: 'Severity', value: alertPayload.severity.toUpperCase() },
                    { name: 'Check Name', value: alertPayload.check_name },
                    { name: 'Check Type', value: alertPayload.check_type },
                    { name: 'Time', value: timestamp },
                    { name: 'Triggered By', value: user?.email || 'System' },
                  ],
                  text: messageText,
                  markdown: true,
                },
              ],
              potentialAction: [
                {
                  '@type': 'OpenUri',
                  name: 'View in QA Guardian',
                  targets: [
                    {
                      os: 'default',
                      uri: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/monitoring`,
                    },
                  ],
                },
              ],
            };

            result = await fetch(config.teams_webhook_url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(teamsPayload),
            });

            // Teams webhook returns '1' for success, not JSON
            const teamsResponseText = await result.text().catch(() => '');

            if (!result.ok) {
              console.error('Teams Webhook error:', teamsResponseText);
              return {
                success: false,
                destination_type,
                error: `Teams Webhook error: ${teamsResponseText || `HTTP ${result.status}`}`,
                alert_payload: teamsPayload,
              };
            }

            console.log(`Test alert sent to Microsoft Teams`);
            return {
              success: true,
              destination_type,
              message: 'Test alert sent to Microsoft Teams channel',
              alert_payload: teamsPayload,
            };
          }

          case 'n8n':
            webhookUrl = config.n8n_webhook_url;
            if (!webhookUrl) {
              return reply.status(400).send({ error: 'n8n_webhook_url is required for n8n destination' });
            }
            break;

          case 'telegram':
            // For direct Telegram integration
            if (config.telegram_bot_token && config.telegram_chat_id) {
              // Send directly to Telegram API
              webhookUrl = `https://api.telegram.org/bot${config.telegram_bot_token}/sendMessage`;
              result = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: config.telegram_chat_id,
                  text: alertData.message,
                  parse_mode: 'HTML',
                }),
              });

              if (!result.ok) {
                const errorData = await result.json().catch(() => ({}));
                console.error('Telegram API error:', errorData);
                return {
                  success: false,
                  destination_type,
                  error: `Telegram API error: ${errorData.description || 'Unknown error'}`,
                  alert_payload: alertData,
                };
              }

              console.log(`Test alert sent to Telegram chat ${config.telegram_chat_id}`);
              return {
                success: true,
                destination_type,
                message: `Test alert sent to Telegram chat ${config.telegram_chat_id}`,
                alert_payload: alertData,
              };
            }
            // Fall through to use n8n webhook for Telegram
            webhookUrl = config.n8n_webhook_url || config.webhook_url;
            if (!webhookUrl) {
              return reply.status(400).send({ error: 'n8n_webhook_url or telegram_bot_token+telegram_chat_id required' });
            }
            break;

          case 'webhook':
          case 'slack':
            webhookUrl = config.webhook_url;
            if (!webhookUrl) {
              return reply.status(400).send({ error: 'webhook_url is required' });
            }
            break;

          default:
            return reply.status(400).send({ error: `Unsupported destination type: ${destination_type}` });
        }

        // Send to webhook (n8n or generic)
        result = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(alertData),
        });

        if (!result.ok) {
          const errorText = await result.text().catch(() => 'Unknown error');
          console.error(`Webhook error (${destination_type}):`, errorText);
          return {
            success: false,
            destination_type,
            error: `Webhook returned ${result.status}: ${errorText.slice(0, 200)}`,
            alert_payload: alertData,
          };
        }

        console.log(`Test alert sent via ${destination_type} to ${webhookUrl}`);
        return {
          success: true,
          destination_type,
          message: `Test alert successfully sent via ${destination_type}`,
          alert_payload: alertData,
        };
      } catch (error: any) {
        console.error(`Failed to send test alert to ${destination_type}:`, error);
        return {
          success: false,
          destination_type,
          error: error.message || 'Failed to send test alert',
          alert_payload: alertData,
        };
      }
    }
  );
}
