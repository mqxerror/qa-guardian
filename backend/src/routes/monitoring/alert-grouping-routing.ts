/**
 * Alert Grouping and Routing Routes Module
 *
 * Split from alert-management.ts - contains:
 * - Alert grouping rules CRUD
 * - Alert groups endpoints
 * - Alert routing rules endpoints
 * - Alert routing logs
 * - Alert rate limit configs
 *
 * Feature #1375: Split alert management routes from monitoring.ts
 */

import { FastifyInstance } from 'fastify';
import { authenticate, requireRoles, getOrganizationId, JwtPayload, ApiKeyPayload } from '../../middleware/auth';
import { logAuditEntry } from '../audit-logs';

import {
  AlertGroupingRule,
  AlertGroup,
  GroupedAlert,
  AlertRoutingCondition,
  AlertRoutingDestination,
  AlertRoutingRule,
  AlertRoutingLog,
  AlertRateLimitConfig,
} from './types';

import {
  alertGroupingRules,
  alertGroups,
  alertRoutingRules,
  alertRoutingLogs,
  alertRateLimitConfigs,
  alertRateLimitStates,
} from './stores';

import {
  checkAlertRateLimit,
} from './helpers';

export async function alertGroupingRoutingRoutes(app: FastifyInstance): Promise<void> {
  // ==================== Alert Grouping Routes ====================

  // List alert grouping rules
  app.get(
    '/api/v1/monitoring/alert-grouping/rules',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer', 'viewer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);

      const rules = Array.from(alertGroupingRules.values())
        .filter(r => r.organization_id === orgId)
        .sort((a, b) => a.priority - b.priority)
        .map(rule => ({
          ...rule,
          created_at: rule.created_at.toISOString(),
          updated_at: rule.updated_at.toISOString(),
        }));

      return { rules };
    }
  );

  // Create alert grouping rule
  app.post(
    '/api/v1/monitoring/alert-grouping/rules',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);

      const {
        name,
        description,
        group_by,
        time_window_minutes,
        deduplication_enabled,
        deduplication_key,
        max_alerts_per_group,
        notification_delay_seconds,
        priority,
      } = request.body as {
        name: string;
        description?: string;
        group_by: ('check_name' | 'check_type' | 'location' | 'error_type' | 'tag')[];
        time_window_minutes?: number;
        deduplication_enabled?: boolean;
        deduplication_key?: string;
        max_alerts_per_group?: number;
        notification_delay_seconds?: number;
        priority?: number;
      };

      if (!name?.trim()) {
        return reply.status(400).send({ error: 'Name is required' });
      }

      if (!group_by || group_by.length === 0) {
        return reply.status(400).send({ error: 'At least one grouping criterion is required' });
      }

      const ruleId = Date.now().toString();

      // Get max priority if not provided
      const existingRules = Array.from(alertGroupingRules.values()).filter(r => r.organization_id === orgId);
      const maxPriority = existingRules.length > 0 ? Math.max(...existingRules.map(r => r.priority)) : 0;

      const rule: AlertGroupingRule = {
        id: ruleId,
        organization_id: orgId,
        name: name.trim(),
        description: description?.trim(),
        group_by,
        time_window_minutes: time_window_minutes || 5,
        deduplication_enabled: deduplication_enabled ?? true,
        deduplication_key: deduplication_key || 'check_id',
        max_alerts_per_group: max_alerts_per_group || 100,
        notification_delay_seconds: notification_delay_seconds || 30,
        is_active: true,
        priority: priority ?? (maxPriority + 1),
        created_by: 'user_id',
        created_at: new Date(),
        updated_at: new Date(),
      };

      alertGroupingRules.set(ruleId, rule);

      // Log audit entry
      logAuditEntry(
        request,
        'alert_grouping_rule.create',
        'alert_grouping_rule',
        ruleId,
        rule.name
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

  // Get single alert grouping rule
  app.get(
    '/api/v1/monitoring/alert-grouping/rules/:ruleId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer', 'viewer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { ruleId } = request.params as { ruleId: string };

      const rule = alertGroupingRules.get(ruleId);
      if (!rule || rule.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Alert grouping rule not found' });
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

  // Update alert grouping rule
  app.patch(
    '/api/v1/monitoring/alert-grouping/rules/:ruleId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { ruleId } = request.params as { ruleId: string };

      const rule = alertGroupingRules.get(ruleId);
      if (!rule || rule.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Alert grouping rule not found' });
      }

      const {
        name,
        description,
        group_by,
        time_window_minutes,
        deduplication_enabled,
        deduplication_key,
        max_alerts_per_group,
        notification_delay_seconds,
        is_active,
        priority,
      } = request.body as {
        name?: string;
        description?: string;
        group_by?: ('check_name' | 'check_type' | 'location' | 'error_type' | 'tag')[];
        time_window_minutes?: number;
        deduplication_enabled?: boolean;
        deduplication_key?: string;
        max_alerts_per_group?: number;
        notification_delay_seconds?: number;
        is_active?: boolean;
        priority?: number;
      };

      if (name !== undefined) rule.name = name.trim();
      if (description !== undefined) rule.description = description.trim();
      if (group_by !== undefined) rule.group_by = group_by;
      if (time_window_minutes !== undefined) rule.time_window_minutes = time_window_minutes;
      if (deduplication_enabled !== undefined) rule.deduplication_enabled = deduplication_enabled;
      if (deduplication_key !== undefined) rule.deduplication_key = deduplication_key;
      if (max_alerts_per_group !== undefined) rule.max_alerts_per_group = max_alerts_per_group;
      if (notification_delay_seconds !== undefined) rule.notification_delay_seconds = notification_delay_seconds;
      if (is_active !== undefined) rule.is_active = is_active;
      if (priority !== undefined) rule.priority = priority;

      rule.updated_at = new Date();
      alertGroupingRules.set(ruleId, rule);

      // Log audit entry
      logAuditEntry(
        request,
        'alert_grouping_rule.update',
        'alert_grouping_rule',
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

  // Delete alert grouping rule
  app.delete(
    '/api/v1/monitoring/alert-grouping/rules/:ruleId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { ruleId } = request.params as { ruleId: string };

      const rule = alertGroupingRules.get(ruleId);
      if (!rule || rule.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Alert grouping rule not found' });
      }

      alertGroupingRules.delete(ruleId);

      // Log audit entry
      logAuditEntry(
        request,
        'alert_grouping_rule.delete',
        'alert_grouping_rule',
        ruleId,
        rule.name
      );

      return { success: true };
    }
  );

  // List alert groups (active and recent)
  app.get(
    '/api/v1/monitoring/alert-grouping/groups',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer', 'viewer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { status } = request.query as { status?: string };

      let groups = Array.from(alertGroups.values())
        .filter(g => g.organization_id === orgId);

      if (status) {
        groups = groups.filter(g => g.status === status);
      }

      groups.sort((a, b) => b.last_alert_at.getTime() - a.last_alert_at.getTime());

      return {
        groups: groups.map(g => ({
          ...g,
          first_alert_at: g.first_alert_at.toISOString(),
          last_alert_at: g.last_alert_at.toISOString(),
          notification_sent_at: g.notification_sent_at?.toISOString(),
          acknowledged_at: g.acknowledged_at?.toISOString(),
          resolved_at: g.resolved_at?.toISOString(),
          snoozed_at: g.snoozed_at?.toISOString(),
          snoozed_until: g.snoozed_until?.toISOString(),
          alerts: g.alerts.map(a => ({
            ...a,
            triggered_at: a.triggered_at.toISOString(),
          })),
        })),
      };
    }
  );

  // Acknowledge an alert group (stops escalation)
  app.post(
    '/api/v1/monitoring/alert-grouping/groups/:groupId/acknowledge',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { groupId } = request.params as { groupId: string };
      const { note } = request.body as { note?: string };
      const user = (request as any).user;

      const group = alertGroups.get(groupId);
      if (!group) {
        return reply.status(404).send({ error: 'Alert group not found' });
      }

      if (group.organization_id !== orgId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      if (group.status === 'acknowledged') {
        return reply.status(400).send({ error: 'Alert group already acknowledged' });
      }

      if (group.status === 'resolved') {
        return reply.status(400).send({ error: 'Alert group already resolved' });
      }

      // Update group status to acknowledged
      group.status = 'acknowledged';
      group.acknowledged_by = user?.email || user?.id || 'unknown';
      group.acknowledged_at = new Date();

      // Cancel any pending escalations for this group
      // (In a real system, this would cancel scheduled escalation jobs)
      console.log(`Escalation stopped for alert group ${groupId} - acknowledged by ${group.acknowledged_by}`);

      return {
        success: true,
        message: 'Alert group acknowledged',
        group: {
          ...group,
          first_alert_at: group.first_alert_at.toISOString(),
          last_alert_at: group.last_alert_at.toISOString(),
          notification_sent_at: group.notification_sent_at?.toISOString(),
          acknowledged_at: group.acknowledged_at?.toISOString(),
          resolved_at: group.resolved_at?.toISOString(),
          alerts: group.alerts.map(a => ({
            ...a,
            triggered_at: a.triggered_at.toISOString(),
          })),
        },
      };
    }
  );

  // Resolve an alert group with resolution notes
  app.post(
    '/api/v1/monitoring/alert-grouping/groups/:groupId/resolve',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { groupId } = request.params as { groupId: string };
      const { resolution_notes } = request.body as { resolution_notes?: string };
      const user = (request as any).user;

      const group = alertGroups.get(groupId);
      if (!group) {
        return reply.status(404).send({ error: 'Alert group not found' });
      }

      if (group.organization_id !== orgId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      if (group.status === 'resolved') {
        return reply.status(400).send({ error: 'Alert group already resolved' });
      }

      // Calculate resolution time (from first alert to now)
      const resolvedAt = new Date();
      const resolutionTimeSeconds = Math.floor(
        (resolvedAt.getTime() - group.first_alert_at.getTime()) / 1000
      );

      // Update group status to resolved
      group.status = 'resolved';
      group.resolved_at = resolvedAt;
      (group as any).resolved_by = user?.email || user?.id || 'unknown';
      (group as any).resolution_notes = resolution_notes || '';
      (group as any).resolution_time_seconds = resolutionTimeSeconds;

      console.log(`Alert group ${groupId} resolved by ${(group as any).resolved_by} - resolution time: ${resolutionTimeSeconds}s`);

      return {
        success: true,
        message: 'Alert group resolved',
        resolution_time_seconds: resolutionTimeSeconds,
        group: {
          ...group,
          first_alert_at: group.first_alert_at.toISOString(),
          last_alert_at: group.last_alert_at.toISOString(),
          notification_sent_at: group.notification_sent_at?.toISOString(),
          acknowledged_at: group.acknowledged_at?.toISOString(),
          resolved_at: group.resolved_at?.toISOString(),
          alerts: group.alerts.map(a => ({
            ...a,
            triggered_at: a.triggered_at.toISOString(),
          })),
        },
      };
    }
  );

  // Snooze an alert group (temporarily silence notifications)
  app.post(
    '/api/v1/monitoring/alert-grouping/groups/:groupId/snooze',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { groupId } = request.params as { groupId: string };
      const { duration_hours } = request.body as { duration_hours: number };
      const user = (request as any).user;

      if (!duration_hours || ![1, 4, 24].includes(duration_hours)) {
        return reply.status(400).send({ error: 'Invalid duration. Must be 1, 4, or 24 hours.' });
      }

      const group = alertGroups.get(groupId);
      if (!group) {
        return reply.status(404).send({ error: 'Alert group not found' });
      }

      if (group.organization_id !== orgId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      if (group.status === 'resolved') {
        return reply.status(400).send({ error: 'Cannot snooze resolved alert group' });
      }

      const snoozedAt = new Date();
      const snoozedUntil = new Date(snoozedAt.getTime() + duration_hours * 60 * 60 * 1000);

      group.snoozed_at = snoozedAt;
      group.snoozed_until = snoozedUntil;
      group.snoozed_by = user?.email || user?.id || 'unknown';
      group.snooze_duration_hours = duration_hours;

      console.log(`Alert group ${groupId} snoozed by ${group.snoozed_by} for ${duration_hours}h until ${snoozedUntil.toISOString()}`);

      return {
        success: true,
        message: `Alert group snoozed for ${duration_hours} hour(s)`,
        snoozed_until: snoozedUntil.toISOString(),
        group: {
          ...group,
          first_alert_at: group.first_alert_at.toISOString(),
          last_alert_at: group.last_alert_at.toISOString(),
          notification_sent_at: group.notification_sent_at?.toISOString(),
          acknowledged_at: group.acknowledged_at?.toISOString(),
          resolved_at: group.resolved_at?.toISOString(),
          snoozed_at: group.snoozed_at?.toISOString(),
          snoozed_until: group.snoozed_until?.toISOString(),
          alerts: group.alerts.map(a => ({
            ...a,
            triggered_at: a.triggered_at.toISOString(),
          })),
        },
      };
    }
  );

  // Unsnooze an alert group (resume notifications immediately)
  app.post(
    '/api/v1/monitoring/alert-grouping/groups/:groupId/unsnooze',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { groupId } = request.params as { groupId: string };
      const user = (request as any).user;

      const group = alertGroups.get(groupId);
      if (!group) {
        return reply.status(404).send({ error: 'Alert group not found' });
      }

      if (group.organization_id !== orgId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      if (!group.snoozed_until) {
        return reply.status(400).send({ error: 'Alert group is not snoozed' });
      }

      const wasSnoozedUntil = group.snoozed_until;
      group.snoozed_at = undefined;
      group.snoozed_until = undefined;
      group.snoozed_by = undefined;
      group.snooze_duration_hours = undefined;

      console.log(`Alert group ${groupId} unsnoozed by ${user?.email || 'unknown'} - was snoozed until ${wasSnoozedUntil.toISOString()}`);

      return {
        success: true,
        message: 'Alert group unsnoozed - notifications will resume',
        group: {
          ...group,
          first_alert_at: group.first_alert_at.toISOString(),
          last_alert_at: group.last_alert_at.toISOString(),
          notification_sent_at: group.notification_sent_at?.toISOString(),
          acknowledged_at: group.acknowledged_at?.toISOString(),
          resolved_at: group.resolved_at?.toISOString(),
          alerts: group.alerts.map(a => ({
            ...a,
            triggered_at: a.triggered_at.toISOString(),
          })),
        },
      };
    }
  );

  // Alert history with statistics and analytics
  app.get(
    '/api/v1/monitoring/alert-history',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer', 'viewer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const {
        severity,
        source,
        start_date,
        end_date,
        page = '1',
        limit = '50',
      } = request.query as {
        severity?: string;
        source?: string;
        start_date?: string;
        end_date?: string;
        page?: string;
        limit?: string;
      };

      // Get all alert groups for this org
      let groups = Array.from(alertGroups.values())
        .filter(g => g.organization_id === orgId);

      // Date filtering
      if (start_date) {
        const startTime = new Date(start_date).getTime();
        groups = groups.filter(g => g.first_alert_at.getTime() >= startTime);
      }
      if (end_date) {
        const endTime = new Date(end_date).getTime();
        groups = groups.filter(g => g.first_alert_at.getTime() <= endTime);
      }

      // Flatten all alerts from groups
      let allAlerts = groups.flatMap(g => g.alerts.map(a => ({
        ...a,
        group_id: g.id,
        group_status: g.status,
        severity: (g as any).severity || 'medium', // Default severity
        source: g.group_key.includes('API') ? 'api' :
                g.group_key.includes('Database') ? 'database' :
                g.group_key.includes('Redis') ? 'cache' : 'system',
        resolved_at: g.resolved_at,
        acknowledged_at: g.acknowledged_at,
      })));

      // Filter by severity
      if (severity) {
        const severities = severity.split(',');
        allAlerts = allAlerts.filter(a => severities.includes(a.severity));
      }

      // Filter by source
      if (source) {
        const sources = source.split(',');
        allAlerts = allAlerts.filter(a => sources.includes(a.source));
      }

      // Sort by triggered_at descending (most recent first)
      allAlerts.sort((a, b) => b.triggered_at.getTime() - a.triggered_at.getTime());

      // Calculate statistics
      const stats = {
        total_alerts: allAlerts.length,
        by_severity: {
          critical: allAlerts.filter(a => a.severity === 'critical').length,
          high: allAlerts.filter(a => a.severity === 'high').length,
          medium: allAlerts.filter(a => a.severity === 'medium').length,
          low: allAlerts.filter(a => a.severity === 'low').length,
        },
        by_source: {
          api: allAlerts.filter(a => a.source === 'api').length,
          database: allAlerts.filter(a => a.source === 'database').length,
          cache: allAlerts.filter(a => a.source === 'cache').length,
          system: allAlerts.filter(a => a.source === 'system').length,
        },
        by_status: {
          active: groups.filter(g => g.status === 'active').length,
          acknowledged: groups.filter(g => g.status === 'acknowledged').length,
          resolved: groups.filter(g => g.status === 'resolved').length,
        },
        avg_resolution_time_seconds: (() => {
          const resolved = groups.filter(g => g.status === 'resolved' && (g as any).resolution_time_seconds);
          if (resolved.length === 0) return null;
          const total = resolved.reduce((sum, g) => sum + ((g as any).resolution_time_seconds || 0), 0);
          return Math.round(total / resolved.length);
        })(),
      };

      // Generate alerts over time data (last 7 days by hour buckets)
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const alertsOverTime: { time: string; count: number }[] = [];

      for (let i = 0; i < 7 * 24; i++) {
        const bucketStart = new Date(sevenDaysAgo.getTime() + i * 60 * 60 * 1000);
        const bucketEnd = new Date(bucketStart.getTime() + 60 * 60 * 1000);
        const count = allAlerts.filter(a =>
          a.triggered_at.getTime() >= bucketStart.getTime() &&
          a.triggered_at.getTime() < bucketEnd.getTime()
        ).length;

        alertsOverTime.push({
          time: bucketStart.toISOString(),
          count,
        });
      }

      // Pagination
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const offset = (pageNum - 1) * limitNum;
      const paginatedAlerts = allAlerts.slice(offset, offset + limitNum);

      return {
        alerts: paginatedAlerts.map(a => ({
          ...a,
          triggered_at: a.triggered_at.toISOString(),
          resolved_at: a.resolved_at?.toISOString(),
          acknowledged_at: a.acknowledged_at?.toISOString(),
        })),
        stats,
        alerts_over_time: alertsOverTime,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: allAlerts.length,
          total_pages: Math.ceil(allAlerts.length / limitNum),
        },
      };
    }
  );

  // Export alert history as CSV
  app.get(
    '/api/v1/monitoring/alert-history/export',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const {
        severity,
        source,
        start_date,
        end_date,
        format = 'csv',
      } = request.query as {
        severity?: string;
        source?: string;
        start_date?: string;
        end_date?: string;
        format?: string;
      };

      // Get all alert groups for this org
      let groups = Array.from(alertGroups.values())
        .filter(g => g.organization_id === orgId);

      // Date filtering
      if (start_date) {
        const startTime = new Date(start_date).getTime();
        groups = groups.filter(g => g.first_alert_at.getTime() >= startTime);
      }
      if (end_date) {
        const endTime = new Date(end_date).getTime();
        groups = groups.filter(g => g.first_alert_at.getTime() <= endTime);
      }

      // Flatten all alerts from groups
      let allAlerts = groups.flatMap(g => g.alerts.map(a => ({
        ...a,
        group_id: g.id,
        group_status: g.status,
        severity: (g as any).severity || 'medium',
        source: g.group_key.includes('API') ? 'api' :
                g.group_key.includes('Database') ? 'database' :
                g.group_key.includes('Redis') ? 'cache' : 'system',
        resolved_at: g.resolved_at,
        acknowledged_at: g.acknowledged_at,
      })));

      // Filter by severity
      if (severity) {
        const severities = severity.split(',');
        allAlerts = allAlerts.filter(a => severities.includes(a.severity));
      }

      // Filter by source
      if (source) {
        const sources = source.split(',');
        allAlerts = allAlerts.filter(a => sources.includes(a.source));
      }

      // Sort by triggered_at descending
      allAlerts.sort((a, b) => b.triggered_at.getTime() - a.triggered_at.getTime());

      if (format === 'json') {
        reply.header('Content-Type', 'application/json');
        reply.header('Content-Disposition', 'attachment; filename="alert-history.json"');
        return allAlerts.map(a => ({
          ...a,
          triggered_at: a.triggered_at.toISOString(),
          resolved_at: a.resolved_at?.toISOString(),
          acknowledged_at: a.acknowledged_at?.toISOString(),
        }));
      }

      // Default: CSV format
      const csvHeader = 'id,check_name,check_type,error_message,severity,source,status,triggered_at,acknowledged_at,resolved_at\n';
      const csvRows = allAlerts.map(a =>
        `"${a.id}","${a.check_name}","${a.check_type}","${(a.error_message || '').replace(/"/g, '""')}","${a.severity}","${a.source}","${a.group_status}","${a.triggered_at.toISOString()}","${a.acknowledged_at?.toISOString() || ''}","${a.resolved_at?.toISOString() || ''}"`
      ).join('\n');

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', 'attachment; filename="alert-history.csv"');
      return csvHeader + csvRows;
    }
  );

  // Simulate triggering grouped alerts (for testing)
  app.post(
    '/api/v1/monitoring/alert-grouping/simulate',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);

      const {
        alerts,
      } = request.body as {
        alerts: {
          check_name: string;
          check_type: 'uptime' | 'transaction' | 'performance' | 'webhook' | 'dns' | 'tcp';
          location?: string;
          error_message?: string;
          tags?: string[];
        }[];
      };

      if (!alerts || alerts.length === 0) {
        return reply.status(400).send({ error: 'At least one alert is required' });
      }

      // Get active rules for this org
      const activeRules = Array.from(alertGroupingRules.values())
        .filter(r => r.organization_id === orgId && r.is_active)
        .sort((a, b) => a.priority - b.priority);

      if (activeRules.length === 0) {
        return reply.status(400).send({ error: 'No active alert grouping rules configured' });
      }

      const rule = activeRules[0]!; // Use highest priority rule (non-null asserted since we checked length)
      const results: { alert: typeof alerts[0]; grouped: boolean; deduplicated: boolean; group_id: string }[] = [];

      // Process each alert
      for (const alert of alerts) {
        // Compute group key based on rule's group_by criteria
        const keyParts: string[] = [];
        for (const criterion of rule.group_by) {
          switch (criterion) {
            case 'check_name':
              keyParts.push(alert.check_name);
              break;
            case 'check_type':
              keyParts.push(alert.check_type);
              break;
            case 'location':
              keyParts.push(alert.location || 'unknown');
              break;
            case 'error_type':
              keyParts.push(alert.error_message?.split(':')[0] || 'unknown');
              break;
            case 'tag':
              keyParts.push(alert.tags?.sort().join(',') || '');
              break;
          }
        }
        const groupKey = keyParts.join('|');

        // Find existing group within time window
        const now = new Date();
        const timeWindowMs = rule.time_window_minutes * 60 * 1000;
        let existingGroup = Array.from(alertGroups.values()).find(
          g => g.organization_id === orgId &&
               g.rule_id === rule.id &&
               g.group_key === groupKey &&
               g.status === 'active' &&
               (now.getTime() - g.first_alert_at.getTime()) < timeWindowMs &&
               g.alerts.length < rule.max_alerts_per_group
        );

        let deduplicated = false;
        let grouped = !!existingGroup;

        if (rule.deduplication_enabled && existingGroup) {
          // Check for duplicate
          const checkId = `${alert.check_name}-${alert.check_type}`;
          const isDuplicate = existingGroup.alerts.some(a =>
            `${a.check_name}-${a.check_type}` === checkId
          );
          deduplicated = isDuplicate;
        }

        const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const groupedAlert: GroupedAlert = {
          id: alertId,
          check_id: `${alert.check_name}-${alert.check_type}`,
          check_name: alert.check_name,
          check_type: alert.check_type,
          location: alert.location,
          error_message: alert.error_message,
          tags: alert.tags,
          triggered_at: now,
          deduplicated,
        };

        if (existingGroup) {
          existingGroup.alerts.push(groupedAlert);
          existingGroup.last_alert_at = now;
          alertGroups.set(existingGroup.id, existingGroup);
          results.push({ alert, grouped: true, deduplicated, group_id: existingGroup.id });
        } else {
          // Create new group
          const groupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newGroup: AlertGroup = {
            id: groupId,
            organization_id: orgId,
            rule_id: rule.id,
            group_key: groupKey,
            alerts: [groupedAlert],
            status: 'active',
            first_alert_at: now,
            last_alert_at: now,
            notification_sent: false,
          };
          alertGroups.set(groupId, newGroup);
          results.push({ alert, grouped: false, deduplicated: false, group_id: groupId });
        }
      }

      // Count notifications that would be sent
      const uniqueGroups = new Set(results.map(r => r.group_id));
      const groupedCount = results.filter(r => r.grouped).length;
      const deduplicatedCount = results.filter(r => r.deduplicated).length;

      console.log(`[Alert Grouping] Processed ${alerts.length} alerts: ${uniqueGroups.size} groups, ${groupedCount} grouped, ${deduplicatedCount} deduplicated`);

      return {
        success: true,
        total_alerts: alerts.length,
        groups_created_or_updated: uniqueGroups.size,
        alerts_grouped: groupedCount,
        alerts_deduplicated: deduplicatedCount,
        notifications_that_would_be_sent: uniqueGroups.size,
        message: `${alerts.length} alerts processed into ${uniqueGroups.size} group(s). ${deduplicatedCount} duplicate alert(s) suppressed.`,
        results,
      };
    }
  );

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

      console.log(`[RATE LIMIT] Configuration updated for org ${orgId}:`, config);

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

      console.log(`[RATE LIMIT TEST] Org ${orgId}: ${sent} sent, ${suppressed} suppressed, ${summariesNeeded} summaries needed`);

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
      console.log(`[RATE LIMIT] State reset for org ${orgId}`);
      return {
        success: true,
        message: 'Rate limit state reset',
      };
    }
  );
}
