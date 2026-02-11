/**
 * Alert Routing Routes Module
 *
 * Split from alert-grouping-routing.ts - contains:
 * - Alert routing rules CRUD
 * - Alert routing simulation
 * - Alert routing logs
 * - Alert rate limit configuration
 *
 * Feature #248: Split alert-grouping-routing.ts for maintainability
 */

import { FastifyInstance } from 'fastify';
import { authenticate, requireRoles, getOrganizationId, JwtPayload } from '../../middleware/auth.js';
import { logAuditEntry } from '../audit-logs.js';

import {
  AlertRoutingCondition,
  AlertRoutingDestination,
  AlertRoutingRule,
  AlertRoutingLog,
  AlertRateLimitConfig,
} from './types.js';

import {
  alertRoutingRules,
  alertRoutingLogs,
  alertRateLimitConfigs,
  alertRateLimitStates,
} from './stores.js';
import { createLogger } from '../../services/logger.js';

const logger = createLogger('alert-routing');

import {
  checkAlertRateLimit,
} from './helpers.js';

export async function alertRoutingRoutes(app: FastifyInstance): Promise<void> {
  // ==================== ALERT ROUTING RULES ENDPOINTS ====================

  // List alert routing rules
  app.get(
    '/api/v1/monitoring/alert-routing/rules',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const rules = Array.from(alertRoutingRules.values())
        .filter(r => r.organization_id === orgId)
        .sort((a, b) => a.priority - b.priority)
        .map(r => ({
          ...r,
          created_at: r.created_at.toISOString(),
          updated_at: r.updated_at.toISOString(),
        }));

      return { rules };
    }
  );

  // Create alert routing rule
  app.post<{
    Body: {
      name: string;
      description?: string;
      conditions: AlertRoutingCondition[];
      condition_match?: 'all' | 'any';
      destinations: AlertRoutingDestination[];
      enabled?: boolean;
      priority?: number;
    };
  }>(
    '/api/v1/monitoring/alert-routing/rules',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { name, description, conditions, condition_match, destinations, enabled, priority } = request.body;
      const orgId = getOrganizationId(request);
      const user = request.user as JwtPayload;

      if (!name?.trim()) {
        return reply.status(400).send({ error: 'Rule name is required' });
      }

      if (!conditions || conditions.length === 0) {
        return reply.status(400).send({ error: 'At least one condition is required' });
      }

      if (!destinations || destinations.length === 0) {
        return reply.status(400).send({ error: 'At least one destination is required' });
      }

      // Validate conditions
      const validFields = ['severity', 'check_type', 'check_name', 'location', 'tag', 'error_contains'];
      const validOperators = ['equals', 'not_equals', 'contains', 'in', 'not_in'];
      for (const condition of conditions) {
        if (!validFields.includes(condition.field)) {
          return reply.status(400).send({ error: `Invalid condition field: ${condition.field}` });
        }
        if (!validOperators.includes(condition.operator)) {
          return reply.status(400).send({ error: `Invalid condition operator: ${condition.operator}` });
        }
      }

      // Validate destinations
      const validTypes = ['pagerduty', 'slack', 'email', 'webhook', 'opsgenie', 'on_call', 'n8n', 'telegram', 'teams', 'discord'];
      for (const dest of destinations) {
        if (!validTypes.includes(dest.type)) {
          return reply.status(400).send({ error: `Invalid destination type: ${dest.type}` });
        }
      }

      // Auto-assign priority if not provided
      const existingRules = Array.from(alertRoutingRules.values()).filter(r => r.organization_id === orgId);
      const maxPriority = existingRules.length > 0 ? Math.max(...existingRules.map(r => r.priority)) : 0;

      const ruleId = `${Date.now()}`;
      const rule: AlertRoutingRule = {
        id: ruleId,
        organization_id: orgId,
        name: name.trim(),
        description: description?.trim(),
        conditions,
        condition_match: condition_match || 'all',
        destinations,
        enabled: enabled !== false,
        priority: priority ?? (maxPriority + 1),
        created_by: user.id,
        created_at: new Date(),
        updated_at: new Date(),
      };

      alertRoutingRules.set(ruleId, rule);

      logAuditEntry(
        request,
        'alert_routing_rule.create',
        'alert_routing_rule',
        ruleId,
        rule.name,
        { conditions: rule.conditions.length, destinations: rule.destinations.length }
      );

      return reply.status(201).send({
        rule: {
          ...rule,
          created_at: rule.created_at.toISOString(),
          updated_at: rule.updated_at.toISOString(),
        },
      });
    }
  );

  // Get single alert routing rule
  app.get<{ Params: { ruleId: string } }>(
    '/api/v1/monitoring/alert-routing/rules/:ruleId',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { ruleId } = request.params;
      const orgId = getOrganizationId(request);

      const rule = alertRoutingRules.get(ruleId);

      if (!rule || rule.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Alert routing rule not found' });
      }

      return {
        rule: {
          ...rule,
          created_at: rule.created_at.toISOString(),
          updated_at: rule.updated_at.toISOString(),
        },
      };
    }
  );

  // Update alert routing rule
  app.patch<{
    Params: { ruleId: string };
    Body: {
      name?: string;
      description?: string;
      conditions?: AlertRoutingCondition[];
      condition_match?: 'all' | 'any';
      destinations?: AlertRoutingDestination[];
      enabled?: boolean;
      priority?: number;
    };
  }>(
    '/api/v1/monitoring/alert-routing/rules/:ruleId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { ruleId } = request.params;
      const { name, description, conditions, condition_match, destinations, enabled, priority } = request.body;
      const orgId = getOrganizationId(request);

      const rule = alertRoutingRules.get(ruleId);

      if (!rule || rule.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Alert routing rule not found' });
      }

      if (name !== undefined) rule.name = name.trim();
      if (description !== undefined) rule.description = description?.trim();
      if (conditions !== undefined) rule.conditions = conditions;
      if (condition_match !== undefined) rule.condition_match = condition_match;
      if (destinations !== undefined) rule.destinations = destinations;
      if (enabled !== undefined) rule.enabled = enabled;
      if (priority !== undefined) rule.priority = priority;
      rule.updated_at = new Date();

      alertRoutingRules.set(ruleId, rule);

      logAuditEntry(
        request,
        'alert_routing_rule.update',
        'alert_routing_rule',
        ruleId,
        rule.name
      );

      return {
        rule: {
          ...rule,
          created_at: rule.created_at.toISOString(),
          updated_at: rule.updated_at.toISOString(),
        },
      };
    }
  );

  // Delete alert routing rule
  app.delete<{ Params: { ruleId: string } }>(
    '/api/v1/monitoring/alert-routing/rules/:ruleId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { ruleId } = request.params;
      const orgId = getOrganizationId(request);

      const rule = alertRoutingRules.get(ruleId);

      if (!rule || rule.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Alert routing rule not found' });
      }

      alertRoutingRules.delete(ruleId);

      logAuditEntry(
        request,
        'alert_routing_rule.delete',
        'alert_routing_rule',
        ruleId,
        rule.name
      );

      return { success: true, message: 'Alert routing rule deleted' };
    }
  );

  // Simulate alert routing (test which rules would match)
  app.post<{
    Body: {
      alert: {
        check_name: string;
        check_type: 'uptime' | 'transaction' | 'performance' | 'webhook' | 'dns' | 'tcp';
        severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
        location?: string;
        tags?: string[];
        error_message?: string;
      };
    };
  }>(
    '/api/v1/monitoring/alert-routing/simulate',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const { alert } = request.body;
      const orgId = getOrganizationId(request);

      // Get all enabled rules for this org, sorted by priority
      const rules = Array.from(alertRoutingRules.values())
        .filter(r => r.organization_id === orgId && r.enabled)
        .sort((a, b) => a.priority - b.priority);

      const matchedRules: { rule: AlertRoutingRule; matched_conditions: string[] }[] = [];
      const destinationsNotified: { type: string; name: string }[] = [];

      for (const rule of rules) {
        const matchedConditions: string[] = [];
        let allMatch = true;
        let anyMatch = false;

        for (const condition of rule.conditions) {
          let fieldValue: string | string[] | undefined;

          switch (condition.field) {
            case 'severity':
              fieldValue = alert.severity;
              break;
            case 'check_type':
              fieldValue = alert.check_type;
              break;
            case 'check_name':
              fieldValue = alert.check_name;
              break;
            case 'location':
              fieldValue = alert.location;
              break;
            case 'tag':
              fieldValue = alert.tags || [];
              break;
            case 'error_contains':
              fieldValue = alert.error_message || '';
              break;
          }

          let conditionMatches = false;
          const conditionValues = Array.isArray(condition.value) ? condition.value : [condition.value];

          switch (condition.operator) {
            case 'equals':
              conditionMatches = fieldValue === condition.value;
              break;
            case 'not_equals':
              conditionMatches = fieldValue !== condition.value;
              break;
            case 'contains':
              if (typeof fieldValue === 'string') {
                conditionMatches = fieldValue.toLowerCase().includes(String(condition.value).toLowerCase());
              } else if (Array.isArray(fieldValue)) {
                conditionMatches = fieldValue.some(v => v.toLowerCase().includes(String(condition.value).toLowerCase()));
              }
              break;
            case 'in':
              if (typeof fieldValue === 'string') {
                conditionMatches = conditionValues.includes(fieldValue);
              } else if (Array.isArray(fieldValue)) {
                conditionMatches = fieldValue.some(v => conditionValues.includes(v));
              }
              break;
            case 'not_in':
              if (typeof fieldValue === 'string') {
                conditionMatches = !conditionValues.includes(fieldValue);
              } else if (Array.isArray(fieldValue)) {
                conditionMatches = !fieldValue.some(v => conditionValues.includes(v));
              }
              break;
          }

          if (conditionMatches) {
            matchedConditions.push(`${condition.field} ${condition.operator} ${JSON.stringify(condition.value)}`);
            anyMatch = true;
          } else {
            allMatch = false;
          }
        }

        const ruleMatches = rule.condition_match === 'all' ? allMatch : anyMatch;

        if (ruleMatches) {
          matchedRules.push({ rule, matched_conditions: matchedConditions });
          for (const dest of rule.destinations) {
            destinationsNotified.push({ type: dest.type, name: dest.name });
          }
        }
      }

      // Log the routing for audit purposes
      if (matchedRules.length > 0) {
        const firstMatchedRule = matchedRules[0]!;
        const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const log: AlertRoutingLog = {
          id: logId,
          organization_id: orgId,
          rule_id: firstMatchedRule.rule.id,
          rule_name: firstMatchedRule.rule.name,
          alert_id: `sim-${Date.now()}`,
          check_name: alert.check_name,
          check_type: alert.check_type,
          severity: alert.severity,
          destinations_notified: destinationsNotified.map(d => `${d.type}:${d.name}`),
          notification_status: 'simulated',
          routed_at: new Date(),
        };

        const orgLogs = alertRoutingLogs.get(orgId) || [];
        orgLogs.unshift(log);
        if (orgLogs.length > 100) orgLogs.pop();
        alertRoutingLogs.set(orgId, orgLogs);
      }

      return {
        alert,
        matched_rules: matchedRules.map(mr => ({
          rule_id: mr.rule.id,
          rule_name: mr.rule.name,
          priority: mr.rule.priority,
          matched_conditions: mr.matched_conditions,
          destinations: mr.rule.destinations.map(d => ({ type: d.type, name: d.name })),
        })),
        destinations_that_would_be_notified: destinationsNotified,
        total_rules_checked: rules.length,
        total_rules_matched: matchedRules.length,
        message: matchedRules.length > 0
          ? `Alert would be routed to ${destinationsNotified.length} destination(s) via ${matchedRules.length} rule(s)`
          : 'No routing rules matched this alert',
      };
    }
  );

  // Get alert routing logs
  app.get(
    '/api/v1/monitoring/alert-routing/logs',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const logs = alertRoutingLogs.get(orgId) || [];

      return {
        logs: logs.map(l => ({
          ...l,
          routed_at: l.routed_at.toISOString(),
        })),
      };
    }
  );

  // ========================================
  // Alert Rate Limiting API Endpoints
  // ========================================

  // Get alert rate limit configuration
  app.get(
    '/api/v1/monitoring/alert-rate-limit/config',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const config = alertRateLimitConfigs.get(orgId);

      if (!config) {
        // Return default config if not set
        return {
          enabled: true,
          max_alerts_per_minute: 5,
          time_window_seconds: 60,
          suppression_mode: 'aggregate',
          aggregate_threshold: 10,
        };
      }

      return {
        enabled: config.enabled,
        max_alerts_per_minute: config.max_alerts_per_minute,
        time_window_seconds: config.time_window_seconds,
        suppression_mode: config.suppression_mode,
        aggregate_threshold: config.aggregate_threshold,
      };
    }
  );

  // Save alert rate limit configuration
  app.post<{
    Body: {
      enabled: boolean;
      max_alerts_per_minute: number;
      time_window_seconds: number;
      suppression_mode: 'drop' | 'aggregate';
      aggregate_threshold: number;
    };
  }>(
    '/api/v1/monitoring/alert-rate-limit/config',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const { enabled, max_alerts_per_minute, time_window_seconds, suppression_mode, aggregate_threshold } = request.body;

      const config: AlertRateLimitConfig = {
        organization_id: orgId,
        enabled,
        max_alerts_per_minute: Math.max(1, Math.min(100, max_alerts_per_minute || 5)),
        time_window_seconds: Math.max(10, Math.min(600, time_window_seconds || 60)),
        suppression_mode: suppression_mode || 'aggregate',
        aggregate_threshold: Math.max(5, Math.min(100, aggregate_threshold || 10)),
        updated_at: new Date(),
      };

      alertRateLimitConfigs.set(orgId, config);

      logger.info({ orgId, config }, 'Rate limit configuration updated');

      return {
        success: true,
        config: {
          enabled: config.enabled,
          max_alerts_per_minute: config.max_alerts_per_minute,
          time_window_seconds: config.time_window_seconds,
          suppression_mode: config.suppression_mode,
          aggregate_threshold: config.aggregate_threshold,
        },
      };
    }
  );

  // Get current rate limit statistics
  app.get(
    '/api/v1/monitoring/alert-rate-limit/stats',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const state = alertRateLimitStates.get(orgId);

      if (!state) {
        return {
          total_alerts: 0,
          sent_alerts: 0,
          suppressed_alerts: 0,
          last_reset: new Date().toISOString(),
        };
      }

      return {
        total_alerts: state.total_alerts,
        sent_alerts: state.sent_alerts,
        suppressed_alerts: state.suppressed_count,
        last_reset: state.window_start.toISOString(),
      };
    }
  );

  // Test rate limiting by simulating multiple alerts
  app.post<{
    Body: {
      alert_count: number;
    };
  }>(
    '/api/v1/monitoring/alert-rate-limit/test',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const { alert_count = 10 } = request.body;

      // Reset state for fresh test
      alertRateLimitStates.delete(orgId);

      let sent = 0;
      let suppressed = 0;
      let summariesNeeded = 0;

      // Simulate sending alerts rapidly
      for (let i = 0; i < Math.min(alert_count, 50); i++) {
        const alertInfo = {
          alert_id: `test-${Date.now()}-${i}`,
          check_name: `Test Check ${i + 1}`,
          severity: i % 4 === 0 ? 'critical' : i % 3 === 0 ? 'high' : i % 2 === 0 ? 'medium' : 'low',
        };

        const result = checkAlertRateLimit(orgId, alertInfo);

        if (result.allowed) {
          sent++;
        } else {
          suppressed++;
        }

        if (result.summary_needed) {
          summariesNeeded++;
        }
      }

      const state = alertRateLimitStates.get(orgId);

      logger.info({ orgId, sent, suppressed, summariesNeeded }, 'Rate limit test completed');

      return {
        test_alerts: Math.min(alert_count, 50),
        sent,
        suppressed,
        summaries_triggered: summariesNeeded,
        stats: state ? {
          total_alerts: state.total_alerts,
          sent_alerts: state.sent_alerts,
          suppressed_alerts: state.suppressed_count,
          last_reset: state.window_start.toISOString(),
        } : null,
      };
    }
  );

  // Reset rate limit state (for testing/debugging)
  app.post(
    '/api/v1/monitoring/alert-rate-limit/reset',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      alertRateLimitStates.delete(orgId);
      logger.info({ orgId }, 'Rate limit state reset');
      return {
        success: true,
        message: 'Rate limit state reset',
      };
    }
  );
}
