/**
 * Alert Grouping Routes Module
 *
 * Split from alert-grouping-routing.ts - contains:
 * - Alert grouping rules CRUD
 * - Alert groups endpoints
 * - Alert history and export
 * - Alert group actions (acknowledge, resolve, snooze)
 *
 * Feature #248: Split alert-grouping-routing.ts for maintainability
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate, requireRoles, getOrganizationId, JwtPayload, ApiKeyPayload, InternalServicePayload } from '../../middleware/auth.js';
import { logAuditEntry } from '../audit-logs.js';

import {
  AlertGroupingRule,
  AlertGroup,
  GroupedAlert,
} from './types.js';

// Type-safe user accessor for authenticated requests
type AuthUser = JwtPayload | ApiKeyPayload | InternalServicePayload;
function getUser(request: FastifyRequest): AuthUser | undefined {
  return (request as unknown as { user?: AuthUser }).user;
}

// Helper to get user email (only JwtPayload has email)
function getUserEmail(user: AuthUser | undefined): string | undefined {
  if (user && 'email' in user) {
    return (user as JwtPayload).email;
  }
  return undefined;
}

import {
  // Async DB functions for alert grouping rules (Feature #2118)
  createAlertGroupingRule as dbCreateAlertGroupingRule,
  getAlertGroupingRule as dbGetAlertGroupingRule,
  updateAlertGroupingRule as dbUpdateAlertGroupingRule,
  deleteAlertGroupingRule as dbDeleteAlertGroupingRule,
  listAlertGroupingRules as dbListAlertGroupingRules,
  // Async DB functions for alert groups (Feature #2118)
  createAlertGroup as dbCreateAlertGroup,
  getAlertGroup as dbGetAlertGroup,
  updateAlertGroup as dbUpdateAlertGroup,
  listAlertGroups as dbListAlertGroups,
  findActiveAlertGroup as dbFindActiveAlertGroup,
} from './stores.js';

import { createLogger } from '../../services/logger.js';

import { sendError } from '../../utils/errors.js';
// Feature #716: Zod validation middleware and schemas
import {
  validateBody,
  validateParams,
  alertGroupingRuleIdParamsSchema,
  alertGroupIdParamsSchema,
  createAlertGroupingRuleBodySchema,
  updateAlertGroupingRuleBodySchema,
  alertGroupAcknowledgeBodySchema,
  alertGroupResolveBodySchema,
  alertGroupSnoozeBodySchema,
  alertGroupingSimulateBodySchema,
} from '../../validation/index.js';

const logger = createLogger('alert-grouping');

export async function alertGroupingRoutes(app: FastifyInstance): Promise<void> {
  // ==================== Alert Grouping Routes ====================

  // List alert grouping rules
  app.get(
    '/api/v1/monitoring/alert-grouping/rules',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer', 'viewer'])],
    },
    async (request, _reply) => {
      const orgId = getOrganizationId(request);

      // Feature #2118: Use async DB function instead of in-memory Map
      const allRules = await dbListAlertGroupingRules(orgId);
      const rules = allRules
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
      preValidation: [validateBody(createAlertGroupingRuleBodySchema)],
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
        return sendError(reply, 400, 'BAD_REQUEST', 'Name is required');
      }

      if (!group_by || group_by.length === 0) {
        return sendError(reply, 400, 'BAD_REQUEST', 'At least one grouping criterion is required');
      }

      const ruleId = Date.now().toString();

      // Feature #2118: Get max priority from DB instead of in-memory Map
      const existingRules = await dbListAlertGroupingRules(orgId);
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

      await dbCreateAlertGroupingRule(rule);

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
      preValidation: [validateParams(alertGroupingRuleIdParamsSchema)],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { ruleId } = request.params as { ruleId: string };

      // Feature #2118: Use async DB function instead of in-memory Map
      const rule = await dbGetAlertGroupingRule(ruleId);
      if (!rule || rule.organization_id !== orgId) {
        return sendError(reply, 404, 'NOT_FOUND', 'Alert grouping rule not found');
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
      preValidation: [validateParams(alertGroupingRuleIdParamsSchema), validateBody(updateAlertGroupingRuleBodySchema)],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { ruleId } = request.params as { ruleId: string };

      // Feature #2118: Use async DB function instead of in-memory Map
      const existing = await dbGetAlertGroupingRule(ruleId);
      if (!existing || existing.organization_id !== orgId) {
        return sendError(reply, 404, 'NOT_FOUND', 'Alert grouping rule not found');
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

      // Build partial updates object for only the fields that were provided
      const updates: Partial<AlertGroupingRule> = {};
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description.trim();
      if (group_by !== undefined) updates.group_by = group_by;
      if (time_window_minutes !== undefined) updates.time_window_minutes = time_window_minutes;
      if (deduplication_enabled !== undefined) updates.deduplication_enabled = deduplication_enabled;
      if (deduplication_key !== undefined) updates.deduplication_key = deduplication_key;
      if (max_alerts_per_group !== undefined) updates.max_alerts_per_group = max_alerts_per_group;
      if (notification_delay_seconds !== undefined) updates.notification_delay_seconds = notification_delay_seconds;
      if (is_active !== undefined) updates.is_active = is_active;
      if (priority !== undefined) updates.priority = priority;

      const rule = await dbUpdateAlertGroupingRule(ruleId, updates);
      if (!rule) {
        return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to update alert grouping rule');
      }

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
      preValidation: [validateParams(alertGroupingRuleIdParamsSchema)],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { ruleId } = request.params as { ruleId: string };

      // Feature #2118: Use async DB function instead of in-memory Map
      const rule = await dbGetAlertGroupingRule(ruleId);
      if (!rule || rule.organization_id !== orgId) {
        return sendError(reply, 404, 'NOT_FOUND', 'Alert grouping rule not found');
      }

      await dbDeleteAlertGroupingRule(ruleId);

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
    async (request, _reply) => {
      const orgId = getOrganizationId(request);
      const { status } = request.query as { status?: string };

      // Feature #2118: Use async DB function instead of in-memory Map
      let groups = await dbListAlertGroups(orgId);

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
      preValidation: [validateParams(alertGroupIdParamsSchema), validateBody(alertGroupAcknowledgeBodySchema)],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { groupId } = request.params as { groupId: string };
      const { note: _note } = request.body as { note?: string };
      const user = getUser(request);

      // Feature #2118: Use async DB function instead of in-memory Map
      const group = await dbGetAlertGroup(groupId);
      if (!group) {
        return sendError(reply, 404, 'NOT_FOUND', 'Alert group not found');
      }

      if (group.organization_id !== orgId) {
        return sendError(reply, 403, 'FORBIDDEN', 'Access denied');
      }

      if (group.status === 'acknowledged') {
        return sendError(reply, 400, 'BAD_REQUEST', 'Alert group already acknowledged');
      }

      if (group.status === 'resolved') {
        return sendError(reply, 400, 'BAD_REQUEST', 'Alert group already resolved');
      }

      // Update group status to acknowledged via DB
      const acknowledgedBy = getUserEmail(user) || user?.id || 'unknown';
      const acknowledgedAt = new Date();
      const updatedGroup = await dbUpdateAlertGroup(groupId, {
        status: 'acknowledged',
        acknowledged_by: acknowledgedBy,
        acknowledged_at: acknowledgedAt,
      });

      if (!updatedGroup) {
        return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to acknowledge alert group');
      }

      // Cancel any pending escalations for this group
      // (In a real system, this would cancel scheduled escalation jobs)
      logger.info({ groupId, acknowledgedBy }, 'Escalation stopped - alert group acknowledged');

      return {
        success: true,
        message: 'Alert group acknowledged',
        group: {
          ...updatedGroup,
          first_alert_at: updatedGroup.first_alert_at.toISOString(),
          last_alert_at: updatedGroup.last_alert_at.toISOString(),
          notification_sent_at: updatedGroup.notification_sent_at?.toISOString(),
          acknowledged_at: updatedGroup.acknowledged_at?.toISOString(),
          resolved_at: updatedGroup.resolved_at?.toISOString(),
          alerts: updatedGroup.alerts.map(a => ({
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
      preValidation: [validateParams(alertGroupIdParamsSchema), validateBody(alertGroupResolveBodySchema)],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { groupId } = request.params as { groupId: string };
      const { resolution_notes } = request.body as { resolution_notes?: string };
      const user = getUser(request);

      // Feature #2118: Use async DB function instead of in-memory Map
      const group = await dbGetAlertGroup(groupId);
      if (!group) {
        return sendError(reply, 404, 'NOT_FOUND', 'Alert group not found');
      }

      if (group.organization_id !== orgId) {
        return sendError(reply, 403, 'FORBIDDEN', 'Access denied');
      }

      if (group.status === 'resolved') {
        return sendError(reply, 400, 'BAD_REQUEST', 'Alert group already resolved');
      }

      // Calculate resolution time (from first alert to now)
      const resolvedAt = new Date();
      const resolutionTimeSeconds = Math.floor(
        (resolvedAt.getTime() - group.first_alert_at.getTime()) / 1000
      );

      const resolverEmail = 'email' in (user || {}) ? (user as JwtPayload).email : undefined;
      const resolvedBy = resolverEmail || user?.id || 'unknown';

      // Update group status to resolved via DB
      const updatedGroup = await dbUpdateAlertGroup(groupId, {
        status: 'resolved',
        resolved_at: resolvedAt,
        resolved_by: resolvedBy,
        resolution_notes: resolution_notes || '',
        resolution_time_seconds: resolutionTimeSeconds,
      });

      if (!updatedGroup) {
        return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to resolve alert group');
      }

      logger.info({ groupId, resolvedBy, resolutionTimeSeconds }, 'Alert group resolved');

      return {
        success: true,
        message: 'Alert group resolved',
        resolution_time_seconds: resolutionTimeSeconds,
        group: {
          ...updatedGroup,
          first_alert_at: updatedGroup.first_alert_at.toISOString(),
          last_alert_at: updatedGroup.last_alert_at.toISOString(),
          notification_sent_at: updatedGroup.notification_sent_at?.toISOString(),
          acknowledged_at: updatedGroup.acknowledged_at?.toISOString(),
          resolved_at: updatedGroup.resolved_at?.toISOString(),
          alerts: updatedGroup.alerts.map(a => ({
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
      preValidation: [validateParams(alertGroupIdParamsSchema), validateBody(alertGroupSnoozeBodySchema)],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { groupId } = request.params as { groupId: string };
      const { duration_hours } = request.body as { duration_hours: number };
      const user = getUser(request);

      if (!duration_hours || ![1, 4, 24].includes(duration_hours)) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Invalid duration. Must be 1, 4, or 24 hours.');
      }

      // Feature #2118: Use async DB function instead of in-memory Map
      const group = await dbGetAlertGroup(groupId);
      if (!group) {
        return sendError(reply, 404, 'NOT_FOUND', 'Alert group not found');
      }

      if (group.organization_id !== orgId) {
        return sendError(reply, 403, 'FORBIDDEN', 'Access denied');
      }

      if (group.status === 'resolved') {
        return sendError(reply, 400, 'BAD_REQUEST', 'Cannot snooze resolved alert group');
      }

      const snoozedAt = new Date();
      const snoozedUntil = new Date(snoozedAt.getTime() + duration_hours * 60 * 60 * 1000);
      const snoozedBy = getUserEmail(user) || user?.id || 'unknown';

      const updatedGroup = await dbUpdateAlertGroup(groupId, {
        snoozed_at: snoozedAt,
        snoozed_until: snoozedUntil,
        snoozed_by: snoozedBy,
        snooze_duration_hours: duration_hours,
      });

      if (!updatedGroup) {
        return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to snooze alert group');
      }

      logger.info({ groupId, snoozedBy, durationHours: duration_hours, snoozedUntil: snoozedUntil.toISOString() }, 'Alert group snoozed');

      return {
        success: true,
        message: `Alert group snoozed for ${duration_hours} hour(s)`,
        snoozed_until: snoozedUntil.toISOString(),
        group: {
          ...updatedGroup,
          first_alert_at: updatedGroup.first_alert_at.toISOString(),
          last_alert_at: updatedGroup.last_alert_at.toISOString(),
          notification_sent_at: updatedGroup.notification_sent_at?.toISOString(),
          acknowledged_at: updatedGroup.acknowledged_at?.toISOString(),
          resolved_at: updatedGroup.resolved_at?.toISOString(),
          snoozed_at: updatedGroup.snoozed_at?.toISOString(),
          snoozed_until: updatedGroup.snoozed_until?.toISOString(),
          alerts: updatedGroup.alerts.map(a => ({
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
      preValidation: [validateParams(alertGroupIdParamsSchema)],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { groupId } = request.params as { groupId: string };
      const user = getUser(request);

      // Feature #2118: Use async DB function instead of in-memory Map
      const group = await dbGetAlertGroup(groupId);
      if (!group) {
        return sendError(reply, 404, 'NOT_FOUND', 'Alert group not found');
      }

      if (group.organization_id !== orgId) {
        return sendError(reply, 403, 'FORBIDDEN', 'Access denied');
      }

      if (!group.snoozed_until) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Alert group is not snoozed');
      }

      const wasSnoozedUntil = group.snoozed_until;

      // Clear snooze fields by setting them to undefined (DB will store as NULL)
      const updatedGroup = await dbUpdateAlertGroup(groupId, {
        snoozed_at: undefined,
        snoozed_until: undefined,
        snoozed_by: undefined,
        snooze_duration_hours: undefined,
      });

      if (!updatedGroup) {
        return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to unsnooze alert group');
      }

      logger.info({ groupId, unsnoozedBy: getUserEmail(user) || 'unknown', wasSnoozedUntil: wasSnoozedUntil.toISOString() }, 'Alert group unsnoozed');

      return {
        success: true,
        message: 'Alert group unsnoozed - notifications will resume',
        group: {
          ...updatedGroup,
          first_alert_at: updatedGroup.first_alert_at.toISOString(),
          last_alert_at: updatedGroup.last_alert_at.toISOString(),
          notification_sent_at: updatedGroup.notification_sent_at?.toISOString(),
          acknowledged_at: updatedGroup.acknowledged_at?.toISOString(),
          resolved_at: updatedGroup.resolved_at?.toISOString(),
          alerts: updatedGroup.alerts.map(a => ({
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

      // Feature #2118: Use async DB function instead of in-memory Map
      let groups = await dbListAlertGroups(orgId);

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
        severity: g.severity || 'medium', // Default severity
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
          const resolved = groups.filter(g => g.status === 'resolved' && g.resolution_time_seconds);
          if (resolved.length === 0) return null;
          const total = resolved.reduce((sum, g) => sum + (g.resolution_time_seconds || 0), 0);
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

      // Feature #2118: Use async DB function instead of in-memory Map
      let groups = await dbListAlertGroups(orgId);

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
        severity: g.severity || 'medium',
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
      preValidation: [validateBody(alertGroupingSimulateBodySchema)],
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
        return sendError(reply, 400, 'BAD_REQUEST', 'At least one alert is required');
      }

      // Feature #2118: Use async DB functions instead of in-memory Maps
      const allRules = await dbListAlertGroupingRules(orgId);
      const activeRules = allRules
        .filter(r => r.is_active)
        .sort((a, b) => a.priority - b.priority);

      if (activeRules.length === 0) {
        return sendError(reply, 400, 'BAD_REQUEST', 'No active alert grouping rules configured');
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

        // Find existing group within time window using DB query
        const now = new Date();
        const timeWindowMs = rule.time_window_minutes * 60 * 1000;
        const existingGroup = await dbFindActiveAlertGroup(
          orgId, rule.id, groupKey, timeWindowMs, rule.max_alerts_per_group
        );

        let deduplicated = false;
        const grouped = !!existingGroup;

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
          // Append alert to existing group and update via DB
          const updatedAlerts = [...existingGroup.alerts, groupedAlert];
          await dbUpdateAlertGroup(existingGroup.id, {
            alerts: updatedAlerts,
            last_alert_at: now,
          });
          results.push({ alert, grouped: true, deduplicated, group_id: existingGroup.id });
        } else {
          // Create new group in DB
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
          await dbCreateAlertGroup(newGroup);
          results.push({ alert, grouped: false, deduplicated: false, group_id: groupId });
        }
      }

      // Count notifications that would be sent
      const uniqueGroups = new Set(results.map(r => r.group_id));
      const groupedCount = results.filter(r => r.grouped).length;
      const deduplicatedCount = results.filter(r => r.deduplicated).length;

      logger.info({ alertCount: alerts.length, groupCount: uniqueGroups.size, groupedCount, deduplicatedCount }, 'Processed alert grouping');

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
}
