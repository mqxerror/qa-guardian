/**
 * Uptime Check Routes
 *
 * Routes for managing uptime checks, including:
 * - CRUD operations for checks
 * - Check results and history
 * - SLA metrics
 * - Incident timeline
 * - Run check functionality
 *
 * Note: Maintenance windows and pause/resume functionality
 * have been moved to maintenance.ts
 */

import { FastifyInstance } from 'fastify';
import { authenticate, requireRoles, getOrganizationId, JwtPayload, ApiKeyPayload } from '../../middleware/auth';
import { logAuditEntry } from '../audit-logs';
import { UptimeCheck, CheckResult, Incident, DeletedCheckHistory, MonitoringLocation, UptimeAssertion } from './types';
import {
  getUptimeCheck,
  listUptimeChecks,
  createUptimeCheck,
  updateUptimeCheck,
  deleteUptimeCheck as dbDeleteUptimeCheck,
  getCheckResults,
  getLatestCheckResult,
  getCheckIncidentsAsync,
  getActiveIncident,
  addDeletedCheckHistory,
  getDeletedCheckHistory,
  listDeletedCheckHistory,
} from './stores';
import { MONITORING_LOCATIONS, runCheckFromAllLocations, startCheckInterval, stopCheckInterval, formatDuration } from './helpers';

export async function uptimeRoutes(app: FastifyInstance): Promise<void> {
  // Get available monitoring locations
  app.get(
    '/api/v1/monitoring/locations',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      return { locations: MONITORING_LOCATIONS };
    }
  );

  // Get all uptime checks for organization
  app.get<{ Querystring: { enabled?: string; tag?: string; group?: string } }>(
    '/api/v1/monitoring/checks',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { enabled, tag, group } = request.query;
      let checks = await listUptimeChecks(orgId);
      if (enabled !== undefined) {
        checks = checks.filter(check => check.enabled === (enabled === 'true'));
      }
      if (tag) { checks = checks.filter(check => check.tags && check.tags.includes(tag)); }
      if (group) { checks = checks.filter(check => check.group === group); }
      checks.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      const checksWithStatus = await Promise.all(checks.map(async (check) => {
        const latestResult = await getLatestCheckResult(check.id);
        return {
          ...check,
          created_at: check.created_at.toISOString(),
          updated_at: check.updated_at.toISOString(),
          latest_status: latestResult?.status || 'unknown',
          latest_response_time: latestResult?.response_time,
          latest_checked_at: latestResult?.checked_at.toISOString(),
        };
      }));

      // Get all unique tags and groups for filter options
      const allChecks = await listUptimeChecks(orgId);
      const allTags = [...new Set(allChecks.flatMap(c => c.tags || []))].sort();
      const allGroups = [...new Set(allChecks.map(c => c.group).filter(Boolean))].sort() as string[];

      return {
        checks: checksWithStatus,
        filters: {
          tags: allTags,
          groups: allGroups,
        }
      };
    }
  );

  // Create a new uptime check
  app.post<{
    Body: {
      name: string;
      url: string;
      method?: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE' | 'PATCH';
      interval: number;
      timeout?: number;
      expected_status?: number;
      headers?: Record<string, string>;
      body?: string;
      locations?: MonitoringLocation[];
      assertions?: UptimeAssertion[];
      ssl_expiry_warning_days?: number;
      consecutive_failures_threshold?: number;
      tags?: string[];
      group?: string;
    };
  }>(
    '/api/v1/monitoring/checks',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const user = request.user as JwtPayload | ApiKeyPayload;
      const orgId = getOrganizationId(request);
      const { name, url, method = 'GET', interval, timeout = 10000, expected_status = 200, headers, body: requestBody, locations = ['us-east'], assertions, ssl_expiry_warning_days, consecutive_failures_threshold, tags, group } = request.body;

      // Validate interval (30s - 5min)
      if (interval < 30 || interval > 300) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Interval must be between 30 and 300 seconds',
        });
      }

      // Validate URL
      try {
        new URL(url);
      } catch {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid URL format',
        });
      }

      // Validate timeout (1s - 30s)
      if (timeout < 1000 || timeout > 30000) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Timeout must be between 1000 and 30000 milliseconds',
        });
      }

      // Validate locations
      const validLocations = locations.filter(loc =>
        MONITORING_LOCATIONS.some(ml => ml.id === loc)
      ) as MonitoringLocation[];

      if (validLocations.length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'At least one valid location is required',
        });
      }

      const check: UptimeCheck = {
        id: `check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        organization_id: orgId,
        name,
        url,
        method,
        interval,
        timeout,
        expected_status,
        headers,
        body: requestBody,
        locations: validLocations,
        assertions,
        ssl_expiry_warning_days: ssl_expiry_warning_days || 30,
        consecutive_failures_threshold: consecutive_failures_threshold || 1,
        tags: tags || [],
        group: group || undefined,
        enabled: true,
        created_by: user.id,
        created_at: new Date(),
        updated_at: new Date(),
      };

      await createUptimeCheck(check);

      // Start running the check
      startCheckInterval(check);

      // Log audit entry
      logAuditEntry(
        request,
        'monitoring.check.created',
        'uptime_check',
        check.id,
        check.name,
        { url, interval, method }
      );

      return reply.status(201).send({
        message: 'Uptime check created successfully',
        check: {
          ...check,
          created_at: check.created_at.toISOString(),
          updated_at: check.updated_at.toISOString(),
        },
      });
    }
  );

  // Get a specific uptime check
  app.get<{ Params: { checkId: string } }>(
    '/api/v1/monitoring/checks/:checkId',
    {
      preHandler: [authenticate],
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

      const latestResult = await getLatestCheckResult(checkId);

      return {
        check: {
          ...check,
          created_at: check.created_at.toISOString(),
          updated_at: check.updated_at.toISOString(),
          latest_status: latestResult?.status || 'unknown',
          latest_response_time: latestResult?.response_time,
          latest_checked_at: latestResult?.checked_at.toISOString(),
        },
      };
    }
  );

  // Update an uptime check
  app.put<{
    Params: { checkId: string };
    Body: {
      name?: string;
      url?: string;
      method?: 'GET' | 'POST' | 'HEAD' | 'PUT' | 'DELETE' | 'PATCH';
      interval?: number;
      timeout?: number;
      expected_status?: number;
      headers?: Record<string, string>;
      body?: string;
      locations?: MonitoringLocation[];
      assertions?: UptimeAssertion[];
      tags?: string[];
      group?: string;
      enabled?: boolean;
    };
  }>(
    '/api/v1/monitoring/checks/:checkId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const orgId = getOrganizationId(request);
      const updates = request.body;

      const check = await getUptimeCheck(checkId);

      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Uptime check not found',
        });
      }

      // Validate interval if provided
      if (updates.interval !== undefined && (updates.interval < 30 || updates.interval > 300)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Interval must be between 30 and 300 seconds',
        });
      }

      // Validate URL if provided
      if (updates.url) {
        try {
          new URL(updates.url);
        } catch {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Invalid URL format',
          });
        }
      }

      // Update check
      const updatedCheck: UptimeCheck = {
        ...check,
        ...updates,
        updated_at: new Date(),
      };

      await updateUptimeCheck(checkId, updatedCheck);

      // Restart interval if interval changed or enabled status changed
      if (updates.interval !== undefined || updates.enabled !== undefined) {
        if (updatedCheck.enabled) {
          startCheckInterval(updatedCheck);
        } else {
          stopCheckInterval(checkId);
        }
      }

      // Log audit entry
      logAuditEntry(
        request,
        'monitoring.check.updated',
        'uptime_check',
        checkId,
        updatedCheck.name,
        updates
      );

      return {
        message: 'Uptime check updated successfully',
        check: {
          ...updatedCheck,
          created_at: updatedCheck.created_at.toISOString(),
          updated_at: updatedCheck.updated_at.toISOString(),
        },
      };
    }
  );

  // Delete an uptime check
  // Feature #943: Support preserve_history query parameter
  app.delete<{ Params: { checkId: string }; Querystring: { preserve_history?: string } }>(
    '/api/v1/monitoring/checks/:checkId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const orgId = getOrganizationId(request);
      const user = request.user as JwtPayload;
      const preserveHistory = request.query.preserve_history !== 'false'; // Default true

      const check = await getUptimeCheck(checkId);

      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Uptime check not found',
        });
      }

      // Stop the interval
      stopCheckInterval(checkId);

      // Feature #943: Preserve history for audit purposes if requested
      if (preserveHistory) {
        const results = await getCheckResults(checkId);
        const lastResult = results.length > 0 ? results[results.length - 1] : null;

        await addDeletedCheckHistory({
          check_id: checkId,
          check_name: check.name,
          check_type: 'uptime',
          organization_id: orgId,
          deleted_by: user.email,
          deleted_at: new Date(),
          check_config: {
            url: check.url,
            method: check.method,
            interval: check.interval,
            timeout: check.timeout,
            expected_status: check.expected_status,
            headers: check.headers,
            body: check.body,
            assertions: check.assertions,
            tags: check.tags,
            group: check.group,
            locations: check.locations,
            enabled: check.enabled,
            created_at: check.created_at,
          },
          historical_results_count: results.length,
          last_status: lastResult?.status,
        });
      }

      // Delete check and results
      await dbDeleteUptimeCheck(checkId);

      // Log audit entry
      logAuditEntry(
        request,
        'monitoring.check.deleted',
        'uptime_check',
        checkId,
        check.name
      );

      return {
        message: 'Uptime check deleted successfully',
        history_preserved: preserveHistory,
      };
    }
  );

  // Feature #943: List all deleted checks for organization
  app.get(
    '/api/v1/monitoring/deleted-checks',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);

      const allDeletedHistory = await listDeletedCheckHistory(orgId);
      const deletedChecks = allDeletedHistory
        .sort((a, b) => b.deleted_at.getTime() - a.deleted_at.getTime())
        .map(h => ({
          ...h,
          deleted_at: h.deleted_at.toISOString(),
        }));

      return {
        deleted_checks: deletedChecks,
        total_count: deletedChecks.length,
      };
    }
  );

  // Feature #943: Get specific deleted check history
  app.get<{ Params: { checkId: string } }>(
    '/api/v1/monitoring/deleted-checks/:checkId',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const orgId = getOrganizationId(request);

      const history = await getDeletedCheckHistory(checkId);

      if (!history || history.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Deleted check history not found',
        });
      }

      return {
        history: {
          ...history,
          deleted_at: history.deleted_at.toISOString(),
        },
      };
    }
  );

  // Duplicate an uptime check
  app.post<{ Params: { checkId: string }; Body: { name?: string } }>(
    '/api/v1/monitoring/checks/:checkId/duplicate',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const { name: newName } = request.body || {};
      const orgId = getOrganizationId(request);
      const user = request.user as JwtPayload;

      const originalCheck = await getUptimeCheck(checkId);

      if (!originalCheck || originalCheck.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Uptime check not found',
        });
      }

      // Create duplicate with new ID and optionally new name
      const duplicatedCheck: UptimeCheck = {
        ...originalCheck,
        id: `check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: newName || `${originalCheck.name} (Copy)`,
        created_by: user.id,
        created_at: new Date(),
        updated_at: new Date(),
        enabled: false, // Start disabled so user can review before enabling
      };

      await createUptimeCheck(duplicatedCheck);

      // Log audit entry
      logAuditEntry(
        request,
        'monitoring.check.duplicated',
        'uptime_check',
        duplicatedCheck.id,
        duplicatedCheck.name,
        { sourceCheckId: checkId, sourceName: originalCheck.name }
      );

      return reply.status(201).send({
        message: 'Uptime check duplicated successfully',
        check: {
          ...duplicatedCheck,
          created_at: duplicatedCheck.created_at.toISOString(),
          updated_at: duplicatedCheck.updated_at.toISOString(),
        },
      });
    }
  );

  // Bulk operations on checks (by group or selected IDs)
  app.post<{
    Body: {
      action: 'enable' | 'disable' | 'delete' | 'run';
      checkIds?: string[];
      group?: string;
    };
  }>(
    '/api/v1/monitoring/checks/bulk',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { action, checkIds, group } = request.body;

      if (!action) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Action is required',
        });
      }

      // Get checks to operate on
      let targetChecks: UptimeCheck[] = [];

      if (checkIds && checkIds.length > 0) {
        // Select by IDs
        for (const id of checkIds) {
          const check = await getUptimeCheck(id);
          if (check && check.organization_id === orgId) {
            targetChecks.push(check);
          }
        }
      } else if (group) {
        // Select by group
        const allOrgChecks = await listUptimeChecks(orgId);
        targetChecks = allOrgChecks.filter(check => check.group === group);
      } else {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Either checkIds or group must be provided',
        });
      }

      if (targetChecks.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'No matching checks found',
        });
      }

      let affectedCount = 0;
      const results: { id: string; name: string; success: boolean; error?: string }[] = [];

      for (const check of targetChecks) {
        try {
          switch (action) {
            case 'enable':
              check.enabled = true;
              check.updated_at = new Date();
              await updateUptimeCheck(check.id, check);
              startCheckInterval(check);
              results.push({ id: check.id, name: check.name, success: true });
              affectedCount++;
              break;

            case 'disable':
              check.enabled = false;
              check.updated_at = new Date();
              await updateUptimeCheck(check.id, check);
              stopCheckInterval(check.id);
              results.push({ id: check.id, name: check.name, success: true });
              affectedCount++;
              break;

            case 'delete':
              stopCheckInterval(check.id);
              await dbDeleteUptimeCheck(check.id);
              results.push({ id: check.id, name: check.name, success: true });
              affectedCount++;
              break;

            case 'run':
              await runCheckFromAllLocations(check);
              results.push({ id: check.id, name: check.name, success: true });
              affectedCount++;
              break;
          }
        } catch (error) {
          results.push({ id: check.id, name: check.name, success: false, error: String(error) });
        }
      }

      // Log audit entry
      logAuditEntry(
        request,
        `monitoring.checks.bulk.${action}`,
        'uptime_checks',
        group || checkIds?.join(',') || '',
        `Bulk ${action} on ${affectedCount} checks`,
        { action, checkIds, group, affectedCount }
      );

      return {
        message: `Bulk ${action} completed`,
        affected: affectedCount,
        total: targetChecks.length,
        results,
      };
    }
  );

  // Get check results/history (Feature #940: get-check-results support)
  app.get<{
    Params: { checkId: string };
    Querystring: { limit?: string; period?: string; include_metrics?: string };
  }>(
    '/api/v1/monitoring/checks/:checkId/results',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { checkId } = request.params;
      const { limit = '50', period = '24h', include_metrics = 'true' } = request.query;
      const orgId = getOrganizationId(request);

      const check = await getUptimeCheck(checkId);

      if (!check || check.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Uptime check not found',
        });
      }

      const results = await getCheckResults(checkId);
      const limitNum = parseInt(limit, 10);
      const includeMetrics = include_metrics === 'true';

      // Parse period and filter results
      const periodMs: Record<string, number> = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };
      const cutoffTime = new Date(Date.now() - (periodMs[period] || periodMs['24h']));
      const filteredResults = results.filter(r => r.checked_at >= cutoffTime);

      // Calculate metrics if requested
      const responseTimes = filteredResults.map(r => r.response_time).filter(t => t !== undefined);
      const metrics = includeMetrics ? {
        avg_response_time: responseTimes.length > 0 ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : null,
        min_response_time: responseTimes.length > 0 ? Math.min(...responseTimes) : null,
        max_response_time: responseTimes.length > 0 ? Math.max(...responseTimes) : null,
        p95_response_time: responseTimes.length > 0 ? responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)] : null,
        success_rate: filteredResults.length > 0 ? parseFloat(((filteredResults.filter(r => r.status === 'up').length / filteredResults.length) * 100).toFixed(2)) : null,
        total_checks: filteredResults.length,
        successful_checks: filteredResults.filter(r => r.status === 'up').length,
        failed_checks: filteredResults.filter(r => r.status === 'down').length,
      } : undefined;

      return {
        check_id: checkId,
        check_name: check.name,
        period,
        results: filteredResults.slice(0, limitNum).map(r => ({
          id: r.id,
          status: r.status,
          response_time: r.response_time,
          status_code: r.status_code,
          location: r.location,
          checked_at: r.checked_at.toISOString(),
          error: r.error,
        })),
        total: filteredResults.length,
        metrics,
      };
    }
  );

  // Get check results grouped by location
  app.get<{
    Params: { checkId: string };
  }>(
    '/api/v1/monitoring/checks/:checkId/results/by-location',
    {
      preHandler: [authenticate],
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

      const results = await getCheckResults(checkId);

      // Group results by location
      const resultsByLocation: Record<string, {
        location: MonitoringLocation;
        location_name: string;
        latest_result: CheckResult | null;
        avg_response_time: number;
        uptime_percentage: number;
        total_checks: number;
      }> = {};

      // Initialize all configured locations
      for (const loc of check.locations) {
        const locInfo = MONITORING_LOCATIONS.find(l => l.id === loc);
        resultsByLocation[loc] = {
          location: loc,
          location_name: locInfo?.name || loc,
          latest_result: null,
          avg_response_time: 0,
          uptime_percentage: 100,
          total_checks: 0,
        };
      }

      // Process results
      for (const result of results) {
        const loc = result.location;
        if (!resultsByLocation[loc]) continue;

        if (!resultsByLocation[loc].latest_result) {
          resultsByLocation[loc].latest_result = result;
        }
        resultsByLocation[loc].total_checks++;
      }

      // Calculate stats per location
      for (const loc of Object.keys(resultsByLocation)) {
        const locResults = results.filter(r => r.location === loc);
        if (locResults.length > 0) {
          const avgTime = locResults.reduce((sum, r) => sum + r.response_time, 0) / locResults.length;
          const upCount = locResults.filter(r => r.status === 'up').length;
          resultsByLocation[loc].avg_response_time = Math.round(avgTime);
          resultsByLocation[loc].uptime_percentage = Math.round((upCount / locResults.length) * 100);
        }
      }

      return {
        locations: Object.values(resultsByLocation).map(loc => ({
          ...loc,
          latest_result: loc.latest_result ? {
            ...loc.latest_result,
            checked_at: loc.latest_result.checked_at.toISOString(),
          } : null,
        })),
      };
    }
  );

  // Get incidents for a specific check (incident timeline)
  app.get<{ Params: { checkId: string } }>(
    '/api/v1/monitoring/checks/:checkId/incidents',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer', 'viewer'])],
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

      // Get closed incidents
      const closedIncidents = await getCheckIncidentsAsync(checkId);

      // Get active incident if any
      const activeIncident = await getActiveIncident(checkId);

      // Format incidents for response
      const formatIncident = (incident: Incident) => ({
        id: incident.id,
        status: incident.status,
        started_at: incident.started_at.toISOString(),
        ended_at: incident.ended_at ? incident.ended_at.toISOString() : null,
        duration_seconds: incident.duration_seconds ?? null,
        duration_formatted: incident.duration_seconds
          ? formatDuration(incident.duration_seconds)
          : incident.started_at
            ? formatDuration(Math.round((Date.now() - incident.started_at.getTime()) / 1000))
            : 'Ongoing',
        error: incident.error,
        affected_locations: incident.affected_locations,
        is_active: !incident.ended_at,
      });

      return {
        check_id: checkId,
        check_name: check.name,
        active_incident: activeIncident ? formatIncident(activeIncident) : null,
        incidents: closedIncidents.map(formatIncident),
        total_incidents: closedIncidents.length + (activeIncident ? 1 : 0),
      };
    }
  );

  // Get SLA metrics for a specific check (uptime over different time periods)
  app.get<{ Params: { checkId: string } }>(
    '/api/v1/monitoring/checks/:checkId/sla',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer', 'viewer'])],
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

      const results = await getCheckResults(checkId);
      const now = new Date();

      // Calculate uptime for different time periods
      const calculateUptime = (hours: number): { uptime: number; totalChecks: number; upChecks: number; downChecks: number } => {
        const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);
        const periodResults = results.filter(r => r.checked_at >= cutoff);

        if (periodResults.length === 0) {
          return { uptime: 100, totalChecks: 0, upChecks: 0, downChecks: 0 };
        }

        const upChecks = periodResults.filter(r => r.status === 'up').length;
        const downChecks = periodResults.filter(r => r.status === 'down').length;
        const uptime = Math.round((upChecks / periodResults.length) * 10000) / 100; // 2 decimal places

        return { uptime, totalChecks: periodResults.length, upChecks, downChecks };
      };

      const sla24h = calculateUptime(24);
      const sla7d = calculateUptime(24 * 7);
      const sla30d = calculateUptime(24 * 30);
      const slaAll = calculateUptime(24 * 365); // All time (up to 1 year)

      // Calculate average response time for each period
      const calculateAvgResponseTime = (hours: number): number => {
        const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);
        const periodResults = results.filter(r => r.checked_at >= cutoff);

        if (periodResults.length === 0) return 0;

        const totalTime = periodResults.reduce((sum, r) => sum + r.response_time, 0);
        return Math.round(totalTime / periodResults.length);
      };

      return {
        check_id: checkId,
        check_name: check.name,
        sla: {
          last_24h: {
            uptime_percentage: sla24h.uptime,
            total_checks: sla24h.totalChecks,
            successful_checks: sla24h.upChecks,
            failed_checks: sla24h.downChecks,
            avg_response_time: calculateAvgResponseTime(24),
          },
          last_7d: {
            uptime_percentage: sla7d.uptime,
            total_checks: sla7d.totalChecks,
            successful_checks: sla7d.upChecks,
            failed_checks: sla7d.downChecks,
            avg_response_time: calculateAvgResponseTime(24 * 7),
          },
          last_30d: {
            uptime_percentage: sla30d.uptime,
            total_checks: sla30d.totalChecks,
            successful_checks: sla30d.upChecks,
            failed_checks: sla30d.downChecks,
            avg_response_time: calculateAvgResponseTime(24 * 30),
          },
          all_time: {
            uptime_percentage: slaAll.uptime,
            total_checks: slaAll.totalChecks,
            successful_checks: slaAll.upChecks,
            failed_checks: slaAll.downChecks,
            avg_response_time: calculateAvgResponseTime(24 * 365),
          },
        },
        generated_at: now.toISOString(),
      };
    }
  );

  // Run a check immediately from all locations
  app.post<{ Params: { checkId: string } }>(
    '/api/v1/monitoring/checks/:checkId/run',
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

      const results = await runCheckFromAllLocations(check);

      return {
        message: 'Check executed successfully from all locations',
        results: results.map(r => ({
          ...r,
          checked_at: r.checked_at.toISOString(),
        })),
      };
    }
  );

  // Get monitoring overview/summary
  app.get(
    '/api/v1/monitoring/summary',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);

      const checks = await listUptimeChecks(orgId);

      let upCount = 0;
      let downCount = 0;
      let degradedCount = 0;
      let unknownCount = 0;

      for (const check of checks) {
        const latestResult = await getLatestCheckResult(check.id);
        if (!latestResult) {
          unknownCount++;
        } else if (latestResult.status === 'up') {
          upCount++;
        } else if (latestResult.status === 'down') {
          downCount++;
        } else {
          degradedCount++;
        }
      }

      return {
        total_checks: checks.length,
        enabled_checks: checks.filter(c => c.enabled).length,
        status_summary: {
          up: upCount,
          down: downCount,
          degraded: degradedCount,
          unknown: unknownCount,
        },
        uptime_percentage: checks.length > 0
          ? Math.round((upCount / checks.length) * 100)
          : 100,
      };
    }
  );
}
