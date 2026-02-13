/**
 * Organizations Module - Team Metrics Routes
 * Feature #730: Split organizations.ts into sub-modules
 * Feature #1002: Get team metrics - productivity metrics for organization members
 *
 * Handles organization team productivity metrics with trend analysis.
 */

import { FastifyInstance } from 'fastify';
import { authenticate, requireRoles, getOrganizationId } from '../../middleware/auth.js';
// Feature #713: Zod validation middleware
import {
  validateParams,
  validateQuery,
  orgIdParamsSchema,
  teamMetricsQuerySchema,
} from '../../validation/index.js';
import { getUserById as dbGetUserById } from '../../services/repositories/auth.js';
import { listAuditLogsRepo } from '../audit-logs.js';
import { sendError } from '../../utils/errors.js';
import {
  getOrganizationMembers as repoGetOrganizationMembers,
} from '../../services/repositories/organizations.js';
import type { OrgParams } from './types.js';

export async function teamMetricsRoutes(app: FastifyInstance) {
  // Feature #1002: Get team metrics - productivity metrics for organization members
  // Feature #713: Add Zod validation for params and query
  app.get<{ Params: OrgParams; Querystring: { period?: string; include_trends?: string; include_activity?: string } }>(
    '/api/v1/organizations/:id/team-metrics',
    {
      preValidation: [validateParams(orgIdParamsSchema), validateQuery(teamMetricsQuerySchema)],
      preHandler: [authenticate, requireRoles(['owner', 'admin'])],
    },
    async (request, reply) => {
      const { id: orgId } = request.params;
      const userOrgId = getOrganizationId(request);
      // Feature #713: Zod validation provides defaults and transforms
      const period = request.query.period || '30d';
      const includeTrends = request.query.include_trends !== 'false';
      const includeActivity = request.query.include_activity !== 'false';

      // Verify user has access to this organization
      if (orgId !== userOrgId) {
        return sendError(reply, 403, 'FORBIDDEN', 'You do not have access to this organization');
      }

      // Parse period (already validated by Zod regex)
      const periodMatch = period.match(/^(\d+)([dhw])$/)!;
      const periodValue = parseInt(periodMatch[1], 10);
      const periodUnit = periodMatch[2];
      let periodMs: number;
      switch (periodUnit) {
        case 'h':
          periodMs = periodValue * 60 * 60 * 1000;
          break;
        case 'd':
          periodMs = periodValue * 24 * 60 * 60 * 1000;
          break;
        case 'w':
          periodMs = periodValue * 7 * 24 * 60 * 60 * 1000;
          break;
        default:
          periodMs = 30 * 24 * 60 * 60 * 1000;
      }

      const cutoffDate = new Date(Date.now() - periodMs);
      const previousCutoffDate = new Date(Date.now() - periodMs * 2);

      // Get organization members
      const memberRecords = await repoGetOrganizationMembers(orgId);

      // Feature #2116: Build member details map using async DB calls
      const memberDetails = new Map<string, { id: string; name: string; email: string; role: string }>();
      for (const member of memberRecords) {
        const user = await dbGetUserById(member.user_id);
        if (user) {
          memberDetails.set(member.user_id, {
            id: user.id,
            name: user.name,
            email: user.email,
            role: member.role,
          });
        }
      }

      // Feature #2119: Get audit logs for this organization using async DB call
      const { logs: allOrgLogs } = await listAuditLogsRepo(orgId, { limit: 10000 });
      const currentPeriodLogs = allOrgLogs.filter(
        log => log.created_at >= cutoffDate
      );

      const previousPeriodLogs = includeTrends
        ? allOrgLogs.filter(
            log => log.created_at >= previousCutoffDate &&
                   log.created_at < cutoffDate
          )
        : [];

      // Calculate metrics per user
      const userMetrics: Array<{
        user_id: string;
        user_name: string;
        user_email: string;
        role: string;
        tests_created: number;
        tests_updated: number;
        tests_deleted: number;
        runs_triggered: number;
        runs_completed: number;
        suites_created: number;
        projects_created: number;
        total_actions: number;
        last_activity?: string;
        activity_score: number;
      }> = [];

      for (const [userId, details] of memberDetails) {
        const userLogs = currentPeriodLogs.filter(log => log.user_id === userId);

        // Count actions by type
        const testsCreated = userLogs.filter(log => log.action === 'create' && log.resource_type === 'test').length;
        const testsUpdated = userLogs.filter(log => log.action === 'update' && log.resource_type === 'test').length;
        const testsDeleted = userLogs.filter(log => log.action === 'delete' && log.resource_type === 'test').length;
        const runsTriggered = userLogs.filter(log => log.action === 'create' && log.resource_type === 'test_run').length;
        const runsCompleted = userLogs.filter(log => log.action === 'complete' && log.resource_type === 'test_run').length;
        const suitesCreated = userLogs.filter(log => log.action === 'create' && log.resource_type === 'test_suite').length;
        const projectsCreated = userLogs.filter(log => log.action === 'create' && log.resource_type === 'project').length;

        // Get last activity
        const sortedLogs = userLogs.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
        const lastActivity = sortedLogs.length > 0 ? sortedLogs[0].created_at.toISOString() : undefined;

        // Calculate activity score (weighted sum of actions)
        const activityScore =
          testsCreated * 3 +
          testsUpdated * 1 +
          runsTriggered * 2 +
          runsCompleted * 1 +
          suitesCreated * 4 +
          projectsCreated * 5;

        userMetrics.push({
          user_id: userId,
          user_name: details.name,
          user_email: details.email,
          role: details.role,
          tests_created: testsCreated,
          tests_updated: testsUpdated,
          tests_deleted: testsDeleted,
          runs_triggered: runsTriggered,
          runs_completed: runsCompleted,
          suites_created: suitesCreated,
          projects_created: projectsCreated,
          total_actions: userLogs.length,
          last_activity: lastActivity,
          activity_score: activityScore,
        });
      }

      // Sort by activity score descending
      userMetrics.sort((a, b) => b.activity_score - a.activity_score);

      // Calculate totals
      const totals = {
        tests_created: userMetrics.reduce((sum, m) => sum + m.tests_created, 0),
        tests_updated: userMetrics.reduce((sum, m) => sum + m.tests_updated, 0),
        runs_triggered: userMetrics.reduce((sum, m) => sum + m.runs_triggered, 0),
        runs_completed: userMetrics.reduce((sum, m) => sum + m.runs_completed, 0),
        suites_created: userMetrics.reduce((sum, m) => sum + m.suites_created, 0),
        projects_created: userMetrics.reduce((sum, m) => sum + m.projects_created, 0),
        total_actions: userMetrics.reduce((sum, m) => sum + m.total_actions, 0),
      };

      // Calculate trends
      let trends: {
        tests_created_change: number;
        runs_triggered_change: number;
        total_actions_change: number;
        trend_direction: 'improving' | 'declining' | 'stable';
      } | null = null;

      if (includeTrends && previousPeriodLogs.length > 0) {
        const prevTestsCreated = previousPeriodLogs.filter(
          log => log.action === 'create' && log.resource_type === 'test'
        ).length;
        const prevRunsTriggered = previousPeriodLogs.filter(
          log => log.action === 'create' && log.resource_type === 'test_run'
        ).length;
        const prevTotalActions = previousPeriodLogs.length;

        const testsCreatedChange = totals.tests_created - prevTestsCreated;
        const runsTriggeredChange = totals.runs_triggered - prevRunsTriggered;
        const totalActionsChange = totals.total_actions - prevTotalActions;

        const avgChange = (testsCreatedChange + runsTriggeredChange + totalActionsChange) / 3;

        trends = {
          tests_created_change: testsCreatedChange,
          runs_triggered_change: runsTriggeredChange,
          total_actions_change: totalActionsChange,
          trend_direction: avgChange > 2 ? 'improving' : avgChange < -2 ? 'declining' : 'stable',
        };
      }

      // Calculate activity by day for the period
      let activityByDay: Array<{ date: string; actions: number; tests_created: number; runs_triggered: number }> | null = null;

      if (includeActivity) {
        const dayMap = new Map<string, { actions: number; tests_created: number; runs_triggered: number }>();

        for (const log of currentPeriodLogs) {
          const dayKey = log.created_at.toISOString().split('T')[0];
          const existing = dayMap.get(dayKey) || { actions: 0, tests_created: 0, runs_triggered: 0 };
          existing.actions++;
          if (log.action === 'create' && log.resource_type === 'test') {
            existing.tests_created++;
          }
          if (log.action === 'create' && log.resource_type === 'test_run') {
            existing.runs_triggered++;
          }
          dayMap.set(dayKey, existing);
        }

        activityByDay = Array.from(dayMap.entries())
          .map(([date, data]) => ({ date, ...data }))
          .sort((a, b) => a.date.localeCompare(b.date));
      }

      // Calculate active members (members with at least one action in period)
      const activeMembers = userMetrics.filter(m => m.total_actions > 0).length;

      return {
        organization_id: orgId,
        period,
        period_start: cutoffDate.toISOString(),
        period_end: new Date().toISOString(),
        members: userMetrics,
        totals,
        summary: {
          total_members: memberDetails.size,
          active_members: activeMembers,
          inactive_members: memberDetails.size - activeMembers,
          average_actions_per_member: memberDetails.size > 0
            ? Math.round(totals.total_actions / memberDetails.size * 10) / 10
            : 0,
          most_active_member: userMetrics.length > 0 && userMetrics[0].total_actions > 0
            ? { user_id: userMetrics[0].user_id, user_name: userMetrics[0].user_name, actions: userMetrics[0].total_actions }
            : null,
        },
        ...(trends && { trends }),
        ...(activityByDay && { activity_by_day: activityByDay }),
      };
    }
  );
}
