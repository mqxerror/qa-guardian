/**
 * Maintenance Window Routes
 *
 * Routes for managing maintenance windows, including:
 * - CRUD operations for maintenance windows
 * - Bulk maintenance window creation
 * - Pause/resume functionality for checks
 * - Toggle check enabled/disabled
 * - Check history with aggregated data for charts
 *
 * Extracted from uptime.ts
 */

import { FastifyInstance } from 'fastify';
import { authenticate, requireRoles, getOrganizationId, JwtPayload, ApiKeyPayload } from '../../middleware/auth';
import { logAuditEntry } from '../audit-logs';
import { UptimeCheck, MaintenanceWindow } from './types';
import {
  getUptimeCheck,
  listUptimeChecks,
  updateUptimeCheck,
  getCheckResults,
  getMaintenanceWindows,
  createMaintenanceWindow as dbCreateMaintenanceWindow,
  deleteMaintenanceWindow as dbDeleteMaintenanceWindow,
} from './stores';
import { startCheckInterval, stopCheckInterval } from './helpers';

export async function maintenanceRoutes(app: FastifyInstance): Promise<void> {
  // Get maintenance windows for a check
  app.get<{ Params: { checkId: string } }>(
    '/api/v1/monitoring/checks/:checkId/maintenance',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer', 'viewer'])],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const orgId = getOrganizationId(request);
      const check = await getUptimeCheck(checkId);
      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Not Found', message: 'Uptime check not found' });
      }
      const windows = await getMaintenanceWindows(checkId);
      const now = new Date();

      // Separate active and scheduled windows
      const activeWindows = windows.filter(w => now >= w.start_time && now <= w.end_time);
      const scheduledWindows = windows.filter(w => now < w.start_time);
      const pastWindows = windows.filter(w => now > w.end_time);

      return {
        check_id: checkId,
        check_name: check.name,
        in_maintenance: activeWindows.length > 0,
        active_window: activeWindows[0] ? {
          ...activeWindows[0],
          start_time: activeWindows[0].start_time.toISOString(),
          end_time: activeWindows[0].end_time.toISOString(),
          created_at: activeWindows[0].created_at.toISOString(),
        } : null,
        scheduled_windows: scheduledWindows.map(w => ({
          ...w,
          start_time: w.start_time.toISOString(),
          end_time: w.end_time.toISOString(),
          created_at: w.created_at.toISOString(),
        })),
        past_windows: pastWindows.slice(0, 10).map(w => ({
          ...w,
          start_time: w.start_time.toISOString(),
          end_time: w.end_time.toISOString(),
          created_at: w.created_at.toISOString(),
        })),
      };
    }
  );

  // Create a maintenance window
  app.post<{
    Params: { checkId: string };
    Body: {
      name: string;
      start_time: string;
      end_time: string;
      reason?: string;
    };
  }>(
    '/api/v1/monitoring/checks/:checkId/maintenance',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const { name, start_time, end_time, reason } = request.body;
      const orgId = getOrganizationId(request);
      const userId = (request.user as JwtPayload | ApiKeyPayload).id || 'api-key';
      const check = await getUptimeCheck(checkId);
      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Not Found', message: 'Uptime check not found' });
      }
      if (!name || !start_time || !end_time) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Name, start_time, and end_time are required' });
      }
      const startDate = new Date(start_time);
      const endDate = new Date(end_time);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Invalid date format for start_time or end_time' });
      }
      if (endDate <= startDate) {
        return reply.status(400).send({ error: 'Bad Request', message: 'end_time must be after start_time' });
      }
      const newWindow: MaintenanceWindow = {
        id: `mw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        check_id: checkId,
        name,
        start_time: startDate,
        end_time: endDate,
        reason,
        created_by: userId,
        created_at: new Date(),
      };

      await dbCreateMaintenanceWindow(newWindow);

      // Log audit entry
      logAuditEntry(
        request,
        'monitoring.maintenance.created',
        'maintenance_window',
        newWindow.id,
        name,
        { checkId, start_time, end_time, reason }
      );

      console.log(`[MONITORING] Maintenance window created: "${name}" for check ${check.name} (${startDate.toISOString()} - ${endDate.toISOString()})`);

      return {
        id: newWindow.id,
        check_id: checkId,
        name: newWindow.name,
        start_time: newWindow.start_time.toISOString(),
        end_time: newWindow.end_time.toISOString(),
        reason: newWindow.reason,
        created_by: newWindow.created_by,
        created_at: newWindow.created_at.toISOString(),
      };
    }
  );

  // Delete a maintenance window
  app.delete<{ Params: { checkId: string; windowId: string } }>(
    '/api/v1/monitoring/checks/:checkId/maintenance/:windowId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { checkId, windowId } = request.params;
      const orgId = getOrganizationId(request);

      const check = await getUptimeCheck(checkId);

      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Uptime check not found',
        });
      }

      const windows = await getMaintenanceWindows(checkId);
      const deletedWindow = windows.find(w => w.id === windowId);

      if (!deletedWindow) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Maintenance window not found',
        });
      }

      await dbDeleteMaintenanceWindow(windowId);

      // Log audit entry
      logAuditEntry(
        request,
        'monitoring.maintenance.deleted',
        'maintenance_window',
        windowId,
        deletedWindow.name,
        { checkId }
      );

      console.log(`[MONITORING] Maintenance window deleted: "${deletedWindow.name}" for check ${check.name}`);

      return {
        message: 'Maintenance window deleted successfully',
        id: windowId,
      };
    }
  );

  // Feature #957: Create maintenance window for multiple checks
  // This endpoint allows creating maintenance windows across multiple checks at once
  app.post<{
    Body: {
      name: string;
      start_time: string;
      end_time: string;
      reason?: string;
      check_ids?: string[];
      all_checks?: boolean;
      tags?: string[];
    };
  }>(
    '/api/v1/monitoring/maintenance',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { name, start_time, end_time, reason, check_ids, all_checks, tags } = request.body;
      const orgId = getOrganizationId(request);
      const userId = (request.user as JwtPayload | ApiKeyPayload).id || 'api-key';

      // Validate required fields
      if (!name || !start_time || !end_time) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Name, start_time, and end_time are required',
        });
      }

      const startDate = new Date(start_time);
      const endDate = new Date(end_time);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid date format for start_time or end_time',
        });
      }

      if (endDate <= startDate) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'end_time must be after start_time',
        });
      }

      // Determine which checks to apply the maintenance window to
      let targetChecks: UptimeCheck[] = [];
      const orgChecks = await listUptimeChecks(orgId);

      if (all_checks) {
        // Apply to all checks in the organization
        targetChecks = orgChecks;
      } else if (check_ids && check_ids.length > 0) {
        // Apply to specified check IDs
        const checkPromises = check_ids.map(id => getUptimeCheck(id));
        const resolvedChecks = await Promise.all(checkPromises);
        targetChecks = resolvedChecks
          .filter((c): c is UptimeCheck => c !== null && c !== undefined && c.organization_id === orgId);
      } else if (tags && tags.length > 0) {
        // Apply to checks with matching tags
        targetChecks = orgChecks.filter(c =>
          c.tags && c.tags.some(tag => tags.includes(tag))
        );
      } else {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Specify check_ids, tags, or set all_checks=true',
        });
      }

      if (targetChecks.length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'No checks found matching the specified criteria',
        });
      }

      // Generate a group ID to link all windows from this request
      const groupId = `mwg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create maintenance windows for each check
      const createdWindows: Array<{
        window_id: string;
        check_id: string;
        check_name: string;
      }> = [];

      for (const check of targetChecks) {
        const newWindow: MaintenanceWindow = {
          id: `mw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          check_id: check.id,
          name,
          start_time: startDate,
          end_time: endDate,
          reason: reason || `Maintenance window created via bulk API (group: ${groupId})`,
          created_by: userId,
          created_at: new Date(),
        };

        await dbCreateMaintenanceWindow(newWindow);

        createdWindows.push({
          window_id: newWindow.id,
          check_id: check.id,
          check_name: check.name,
        });
      }

      // Log audit entry
      logAuditEntry(
        request,
        'monitoring.maintenance.bulk_created',
        'maintenance_window',
        groupId,
        name,
        { check_count: createdWindows.length, start_time, end_time, reason }
      );

      console.log(`[MONITORING] Bulk maintenance window created: "${name}" for ${createdWindows.length} checks (${startDate.toISOString()} - ${endDate.toISOString()})`);

      // Check if any of the windows are currently active
      const now = new Date();
      const isActive = startDate <= now && now < endDate;

      return {
        group_id: groupId,
        name,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        reason,
        is_active: isActive,
        alerts_suppressed: isActive,
        affected_checks: createdWindows,
        total_checks_affected: createdWindows.length,
        created_by: userId,
        created_at: new Date().toISOString(),
        message: `Maintenance window "${name}" created for ${createdWindows.length} check(s). ${isActive ? 'Window is currently ACTIVE - alerts are being suppressed.' : 'Window is scheduled for future.'}`,
      };
    }
  );

  // Feature #957: List all maintenance windows across all checks
  app.get(
    '/api/v1/monitoring/maintenance',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const query = request.query as { active_only?: string };

      const orgChecks = await listUptimeChecks(orgId);

      const now = new Date();
      const allWindows: Array<{
        window_id: string;
        check_id: string;
        check_name: string;
        name: string;
        start_time: string;
        end_time: string;
        reason?: string;
        is_active: boolean;
        created_by: string;
        created_at: string;
      }> = [];

      for (const check of orgChecks) {
        const windows = await getMaintenanceWindows(check.id);
        for (const window of windows) {
          const isActive = window.start_time <= now && now < window.end_time;

          if (query.active_only === 'true' && !isActive) {
            continue;
          }

          allWindows.push({
            window_id: window.id,
            check_id: check.id,
            check_name: check.name,
            name: window.name,
            start_time: window.start_time.toISOString(),
            end_time: window.end_time.toISOString(),
            reason: window.reason,
            is_active: isActive,
            created_by: window.created_by,
            created_at: window.created_at.toISOString(),
          });
        }
      }

      // Sort by start_time descending
      allWindows.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

      const activeCount = allWindows.filter(w => w.is_active).length;

      return {
        maintenance_windows: allWindows,
        total: allWindows.length,
        active_count: activeCount,
        scheduled_count: allWindows.length - activeCount,
      };
    }
  );

  // Feature #944: Pause a monitoring check
  app.post<{ Params: { checkId: string }; Body: { reason?: string; duration_hours?: number } }>(
    '/api/v1/monitoring/checks/:checkId/pause',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const { reason, duration_hours } = request.body || {};
      const orgId = getOrganizationId(request);
      const user = request.user as JwtPayload;

      const check = await getUptimeCheck(checkId);

      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Uptime check not found',
        });
      }

      if (!check.enabled) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Check is already paused',
          paused_at: check.paused_at,
          paused_by: check.paused_by,
        });
      }

      // Pause the check
      check.enabled = false;
      check.paused_at = new Date();
      check.paused_by = user.email;
      check.pause_reason = reason;
      check.pause_expires_at = duration_hours
        ? new Date(Date.now() + duration_hours * 60 * 60 * 1000)
        : undefined;
      check.updated_at = new Date();
      await updateUptimeCheck(checkId, check);

      // Stop the interval
      stopCheckInterval(checkId);

      // Log audit entry
      logAuditEntry(
        request,
        'monitoring.check.paused',
        'uptime_check',
        checkId,
        check.name
      );

      return {
        message: 'Uptime check paused successfully',
        check_id: checkId,
        check_name: check.name,
        paused: true,
        paused_at: check.paused_at.toISOString(),
        paused_by: check.paused_by,
        pause_reason: check.pause_reason,
        pause_expires_at: check.pause_expires_at?.toISOString(),
        alerts_suppressed: true,
      };
    }
  );

  // Feature #944: Resume a monitoring check
  app.post<{ Params: { checkId: string } }>(
    '/api/v1/monitoring/checks/:checkId/resume',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const orgId = getOrganizationId(request);

      const check = await getUptimeCheck(checkId);

      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Uptime check not found',
        });
      }

      if (check.enabled) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Check is already running',
        });
      }

      // Calculate how long it was paused
      const pausedDuration = check.paused_at
        ? Date.now() - check.paused_at.getTime()
        : 0;

      // Resume the check
      check.enabled = true;
      const wasManuallyPaused = !!check.paused_by;
      check.paused_at = undefined;
      check.paused_by = undefined;
      check.pause_reason = undefined;
      check.pause_expires_at = undefined;
      check.updated_at = new Date();
      await updateUptimeCheck(checkId, check);

      // Start the interval
      startCheckInterval(check);

      // Log audit entry
      logAuditEntry(
        request,
        'monitoring.check.resumed',
        'uptime_check',
        checkId,
        check.name
      );

      return {
        message: 'Uptime check resumed successfully',
        check_id: checkId,
        check_name: check.name,
        paused: false,
        resumed_at: new Date().toISOString(),
        paused_duration_ms: pausedDuration,
        was_manually_paused: wasManuallyPaused,
      };
    }
  );

  // Toggle check enabled/disabled
  app.post<{ Params: { checkId: string } }>(
    '/api/v1/monitoring/checks/:checkId/toggle',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const orgId = getOrganizationId(request);

      const check = await getUptimeCheck(checkId);

      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Uptime check not found',
        });
      }

      check.enabled = !check.enabled;
      check.updated_at = new Date();
      await updateUptimeCheck(checkId, check);

      if (check.enabled) {
        startCheckInterval(check);
      } else {
        stopCheckInterval(checkId);
      }

      // Log audit entry
      logAuditEntry(
        request,
        check.enabled ? 'monitoring.check.enabled' : 'monitoring.check.disabled',
        'uptime_check',
        checkId,
        check.name
      );

      return {
        message: `Uptime check ${check.enabled ? 'enabled' : 'disabled'} successfully`,
        check: {
          ...check,
          created_at: check.created_at.toISOString(),
          updated_at: check.updated_at.toISOString(),
        },
      };
    }
  );

  // Get check history with aggregated data for charts
  app.get<{
    Params: { checkId: string };
    Querystring: { range?: string; interval?: string };
  }>(
    '/api/v1/monitoring/checks/:checkId/history',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer', 'viewer'])],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const { range = '24h', interval = 'auto' } = request.query;
      const orgId = getOrganizationId(request);

      const check = await getUptimeCheck(checkId);

      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Uptime check not found',
        });
      }

      const results = await getCheckResults(checkId);
      const now = new Date();

      // Calculate time range
      let rangeMs: number;
      switch (range) {
        case '1h':
          rangeMs = 60 * 60 * 1000;
          break;
        case '6h':
          rangeMs = 6 * 60 * 60 * 1000;
          break;
        case '24h':
          rangeMs = 24 * 60 * 60 * 1000;
          break;
        case '7d':
          rangeMs = 7 * 24 * 60 * 60 * 1000;
          break;
        case '30d':
          rangeMs = 30 * 24 * 60 * 60 * 1000;
          break;
        default:
          rangeMs = 24 * 60 * 60 * 1000;
      }

      const startTime = new Date(now.getTime() - rangeMs);

      // Filter results within range
      const filteredResults = results.filter(r => r.checked_at >= startTime);

      // Determine interval for aggregation
      let bucketMs: number;
      if (interval === 'auto') {
        // Auto-determine based on range
        if (rangeMs <= 60 * 60 * 1000) {
          bucketMs = 5 * 60 * 1000; // 5 min for 1h
        } else if (rangeMs <= 6 * 60 * 60 * 1000) {
          bucketMs = 15 * 60 * 1000; // 15 min for 6h
        } else if (rangeMs <= 24 * 60 * 60 * 1000) {
          bucketMs = 60 * 60 * 1000; // 1 hour for 24h
        } else if (rangeMs <= 7 * 24 * 60 * 60 * 1000) {
          bucketMs = 4 * 60 * 60 * 1000; // 4 hours for 7d
        } else {
          bucketMs = 24 * 60 * 60 * 1000; // 1 day for 30d
        }
      } else {
        bucketMs = parseInt(interval, 10) * 60 * 1000; // interval in minutes
      }

      // Aggregate results into buckets for charting
      interface Bucket {
        timestamp: Date;
        avg_response_time: number;
        min_response_time: number;
        max_response_time: number;
        successful_checks: number;
        failed_checks: number;
        degraded_checks: number;
        total_checks: number;
        uptime_percentage: number;
      }

      const buckets: Map<number, Bucket> = new Map();

      for (const result of filteredResults) {
        const bucketTime = Math.floor(result.checked_at.getTime() / bucketMs) * bucketMs;

        let bucket = buckets.get(bucketTime);
        if (!bucket) {
          bucket = {
            timestamp: new Date(bucketTime),
            avg_response_time: 0,
            min_response_time: Infinity,
            max_response_time: 0,
            successful_checks: 0,
            failed_checks: 0,
            degraded_checks: 0,
            total_checks: 0,
            uptime_percentage: 0,
          };
          buckets.set(bucketTime, bucket);
        }

        bucket.total_checks++;
        bucket.avg_response_time += result.response_time;
        bucket.min_response_time = Math.min(bucket.min_response_time, result.response_time);
        bucket.max_response_time = Math.max(bucket.max_response_time, result.response_time);

        if (result.status === 'up') {
          bucket.successful_checks++;
        } else if (result.status === 'down') {
          bucket.failed_checks++;
        } else {
          bucket.degraded_checks++;
        }
      }

      // Calculate averages and uptime
      const chartData: Array<{
        timestamp: string;
        avg_response_time: number;
        min_response_time: number;
        max_response_time: number;
        successful_checks: number;
        failed_checks: number;
        degraded_checks: number;
        total_checks: number;
        uptime_percentage: number;
      }> = [];

      const sortedBuckets = Array.from(buckets.values()).sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );

      for (const bucket of sortedBuckets) {
        if (bucket.total_checks > 0) {
          bucket.avg_response_time = Math.round(bucket.avg_response_time / bucket.total_checks);
          bucket.uptime_percentage = Math.round(
            ((bucket.successful_checks + bucket.degraded_checks) / bucket.total_checks) * 100
          );
        }
        if (bucket.min_response_time === Infinity) {
          bucket.min_response_time = 0;
        }

        chartData.push({
          timestamp: bucket.timestamp.toISOString(),
          avg_response_time: bucket.avg_response_time,
          min_response_time: bucket.min_response_time,
          max_response_time: bucket.max_response_time,
          successful_checks: bucket.successful_checks,
          failed_checks: bucket.failed_checks,
          degraded_checks: bucket.degraded_checks,
          total_checks: bucket.total_checks,
          uptime_percentage: bucket.uptime_percentage,
        });
      }

      // Calculate status history (list of status changes)
      const statusHistory: Array<{
        timestamp: string;
        status: 'up' | 'down' | 'degraded';
        response_time: number;
        location: string;
        error?: string;
      }> = filteredResults
        .sort((a, b) => b.checked_at.getTime() - a.checked_at.getTime())
        .slice(0, 100)
        .map(r => ({
          timestamp: r.checked_at.toISOString(),
          status: r.status,
          response_time: r.response_time,
          location: r.location,
          error: r.error,
        }));

      // Calculate overall stats for the period
      const totalChecks = filteredResults.length;
      const successfulChecks = filteredResults.filter(r => r.status === 'up').length;
      const failedChecks = filteredResults.filter(r => r.status === 'down').length;
      const degradedChecks = filteredResults.filter(r => r.status === 'degraded').length;
      const avgResponseTime = totalChecks > 0
        ? Math.round(filteredResults.reduce((sum, r) => sum + r.response_time, 0) / totalChecks)
        : 0;
      const minResponseTime = totalChecks > 0
        ? Math.min(...filteredResults.map(r => r.response_time))
        : 0;
      const maxResponseTime = totalChecks > 0
        ? Math.max(...filteredResults.map(r => r.response_time))
        : 0;
      const uptimePercentage = totalChecks > 0
        ? Math.round(((successfulChecks + degradedChecks) / totalChecks) * 100 * 100) / 100
        : 100;

      return {
        check_id: checkId,
        check_name: check.name,
        range,
        start_time: startTime.toISOString(),
        end_time: now.toISOString(),
        summary: {
          total_checks: totalChecks,
          successful_checks: successfulChecks,
          failed_checks: failedChecks,
          degraded_checks: degradedChecks,
          uptime_percentage: uptimePercentage,
          avg_response_time: avgResponseTime,
          min_response_time: minResponseTime,
          max_response_time: maxResponseTime,
        },
        chart_data: chartData,
        status_history: statusHistory,
      };
    }
  );
}
