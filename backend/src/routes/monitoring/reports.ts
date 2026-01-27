/**
 * Monitoring Reports Routes
 *
 * Handles uptime report generation with SLA calculations and incident summaries.
 *
 * Feature #955: Generate uptime report for multiple checks
 */

import { FastifyInstance } from 'fastify';
import { authenticate, requireRoles, getOrganizationId, JwtPayload } from '../../middleware/auth';
import {
  UptimeCheck,
  ManagedIncident,
} from './types';
import {
  uptimeChecks,
  checkResults,
  managedIncidents,
  incidentsByOrg,
} from './stores';
import { formatDuration } from './helpers';

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  // Feature #955: Generate uptime report for multiple checks
  // This endpoint generates a comprehensive uptime report with SLA calculations and incident summaries
  app.get<{
    Querystring: {
      check_ids?: string;
      start_date?: string;
      end_date?: string;
      sla_target?: string;
    };
  }>(
    '/api/v1/monitoring/uptime-report',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer', 'viewer'])],
    },
    async (request) => {
      const orgId = getOrganizationId(request);
      const { check_ids, start_date, end_date, sla_target } = request.query;

      // Parse date range
      const now = new Date();
      const endDate = end_date ? new Date(end_date) : now;
      const startDate = start_date ? new Date(start_date) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days

      // Parse SLA target (default: 99.9%)
      const slaTargetPercent = sla_target ? parseFloat(sla_target) : 99.9;

      // Get checks to include in report
      let checksToReport: UptimeCheck[] = [];
      if (check_ids) {
        const checkIdList = check_ids.split(',').map(id => id.trim());
        checksToReport = checkIdList
          .map(id => uptimeChecks.get(id))
          .filter((c): c is UptimeCheck => c !== undefined && c.organization_id === orgId);
      } else {
        // If no check_ids specified, get all checks for the organization
        checksToReport = Array.from(uptimeChecks.values())
          .filter(c => c.organization_id === orgId);
      }

      // Calculate uptime for each check
      interface CheckReport {
        check_id: string;
        check_name: string;
        check_type: string;
        url: string;
        enabled: boolean;
        uptime_percentage: number;
        total_checks: number;
        successful_checks: number;
        failed_checks: number;
        avg_response_time_ms: number;
        p95_response_time_ms: number;
        p99_response_time_ms: number;
        min_response_time_ms: number;
        max_response_time_ms: number;
        sla_target: number;
        sla_met: boolean;
        sla_breaches: number;
        total_downtime_seconds: number;
        downtime_incidents: Array<{
          started_at: string;
          ended_at: string | null;
          duration_seconds: number;
          error_message?: string;
        }>;
      }

      const checkReports: CheckReport[] = [];
      let overallUpChecks = 0;
      let overallDownChecks = 0;
      let overallResponseTimeSum = 0;
      let overallResponseTimeCount = 0;
      let totalDowntimeSeconds = 0;

      for (const check of checksToReport) {
        const results = checkResults.get(check.id) || [];

        // Filter results within the date range
        const periodResults = results.filter(r => {
          const checkedAt = r.checked_at;
          return checkedAt >= startDate && checkedAt <= endDate;
        });

        // Calculate metrics
        const upChecks = periodResults.filter(r => r.status === 'up').length;
        const downChecks = periodResults.filter(r => r.status === 'down').length;
        const totalChecks = periodResults.length;
        const uptimePercent = totalChecks > 0 ? (upChecks / totalChecks) * 100 : 100;

        // Calculate response time metrics
        const responseTimes = periodResults.map(r => r.response_time).filter(t => t > 0);
        const avgResponseTime = responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0;

        // Sort for percentiles
        const sortedTimes = [...responseTimes].sort((a, b) => a - b);
        const p95Index = Math.floor(sortedTimes.length * 0.95);
        const p99Index = Math.floor(sortedTimes.length * 0.99);

        const p95ResponseTime = sortedTimes.length > 0 ? sortedTimes[Math.min(p95Index, sortedTimes.length - 1)] : 0;
        const p99ResponseTime = sortedTimes.length > 0 ? sortedTimes[Math.min(p99Index, sortedTimes.length - 1)] : 0;
        const minResponseTime = sortedTimes.length > 0 ? sortedTimes[0] : 0;
        const maxResponseTime = sortedTimes.length > 0 ? sortedTimes[sortedTimes.length - 1] : 0;

        // Check if SLA is met
        const slaMet = uptimePercent >= slaTargetPercent;

        // Count SLA breaches (consecutive down checks that could indicate breach)
        let slaBreaches = 0;
        let consecutiveDownCount = 0;
        for (const result of periodResults) {
          if (result.status === 'down') {
            consecutiveDownCount++;
            // Consider 3 consecutive downs as an SLA breach
            if (consecutiveDownCount >= 3) {
              slaBreaches++;
              consecutiveDownCount = 0;
            }
          } else {
            consecutiveDownCount = 0;
          }
        }

        // Calculate downtime incidents (periods of consecutive failures)
        const downtimeIncidents: Array<{
          started_at: string;
          ended_at: string | null;
          duration_seconds: number;
          error_message?: string;
        }> = [];

        let incidentStart: Date | null = null;
        let incidentError: string | undefined;
        let checkDowntimeSeconds = 0;

        for (let i = 0; i < periodResults.length; i++) {
          const result = periodResults[i];
          if (result.status === 'down') {
            if (!incidentStart) {
              incidentStart = result.checked_at;
              incidentError = result.error;
            }
          } else if (incidentStart) {
            // Incident ended
            const durationSeconds = Math.round((result.checked_at.getTime() - incidentStart.getTime()) / 1000);
            checkDowntimeSeconds += durationSeconds;
            downtimeIncidents.push({
              started_at: incidentStart.toISOString(),
              ended_at: result.checked_at.toISOString(),
              duration_seconds: durationSeconds,
              error_message: incidentError,
            });
            incidentStart = null;
            incidentError = undefined;
          }
        }

        // Handle ongoing incident
        if (incidentStart) {
          const durationSeconds = Math.round((endDate.getTime() - incidentStart.getTime()) / 1000);
          checkDowntimeSeconds += durationSeconds;
          downtimeIncidents.push({
            started_at: incidentStart.toISOString(),
            ended_at: null, // Ongoing
            duration_seconds: durationSeconds,
            error_message: incidentError,
          });
        }

        checkReports.push({
          check_id: check.id,
          check_name: check.name,
          check_type: 'uptime',
          url: check.url,
          enabled: check.enabled,
          uptime_percentage: Math.round(uptimePercent * 100) / 100,
          total_checks: totalChecks,
          successful_checks: upChecks,
          failed_checks: downChecks,
          avg_response_time_ms: Math.round(avgResponseTime),
          p95_response_time_ms: Math.round(p95ResponseTime),
          p99_response_time_ms: Math.round(p99ResponseTime),
          min_response_time_ms: Math.round(minResponseTime),
          max_response_time_ms: Math.round(maxResponseTime),
          sla_target: slaTargetPercent,
          sla_met: slaMet,
          sla_breaches: slaBreaches,
          total_downtime_seconds: checkDowntimeSeconds,
          downtime_incidents: downtimeIncidents.slice(0, 10), // Limit to most recent 10
        });

        // Aggregate for overall stats
        overallUpChecks += upChecks;
        overallDownChecks += downChecks;
        overallResponseTimeSum += avgResponseTime * totalChecks;
        overallResponseTimeCount += totalChecks;
        totalDowntimeSeconds += checkDowntimeSeconds;
      }

      // Calculate overall metrics
      const overallTotalChecks = overallUpChecks + overallDownChecks;
      const overallUptime = overallTotalChecks > 0
        ? (overallUpChecks / overallTotalChecks) * 100
        : 100;
      const overallAvgResponseTime = overallResponseTimeCount > 0
        ? overallResponseTimeSum / overallResponseTimeCount
        : 0;

      // Get incidents summary for the period
      const incidentIds = incidentsByOrg.get(orgId) || [];
      const periodIncidents = incidentIds
        .map(id => managedIncidents.get(id))
        .filter((i): i is ManagedIncident => i !== undefined)
        .filter(i => i.created_at >= startDate && i.created_at <= endDate);

      const incidentSummary = {
        total_incidents: periodIncidents.length,
        by_severity: {
          critical: periodIncidents.filter(i => i.severity === 'critical').length,
          high: periodIncidents.filter(i => i.severity === 'high').length,
          medium: periodIncidents.filter(i => i.severity === 'medium').length,
          low: periodIncidents.filter(i => i.severity === 'low').length,
          info: periodIncidents.filter(i => i.severity === 'info').length,
        },
        by_status: {
          resolved: periodIncidents.filter(i => i.status === 'resolved').length,
          active: periodIncidents.filter(i => ['triggered', 'acknowledged', 'investigating', 'identified', 'monitoring'].includes(i.status)).length,
        },
        avg_resolution_time_seconds: 0,
        recent_incidents: periodIncidents
          .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
          .slice(0, 5)
          .map(i => ({
            id: i.id,
            title: i.title,
            severity: i.severity,
            status: i.status,
            created_at: i.created_at.toISOString(),
            resolved_at: i.resolved_at?.toISOString() || null,
          })),
      };

      // Calculate average resolution time
      const resolvedIncidents = periodIncidents.filter(i => i.time_to_resolve_seconds !== undefined);
      if (resolvedIncidents.length > 0) {
        incidentSummary.avg_resolution_time_seconds = Math.round(
          resolvedIncidents.reduce((sum, i) => sum + (i.time_to_resolve_seconds || 0), 0) / resolvedIncidents.length
        );
      }

      return {
        report: {
          generated_at: now.toISOString(),
          period: {
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            duration_days: Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)),
          },
          sla_target: slaTargetPercent,
          overall_summary: {
            total_checks_monitored: checksToReport.length,
            total_check_results: overallTotalChecks,
            overall_uptime_percentage: Math.round(overallUptime * 100) / 100,
            overall_sla_met: overallUptime >= slaTargetPercent,
            checks_meeting_sla: checkReports.filter(r => r.sla_met).length,
            checks_below_sla: checkReports.filter(r => !r.sla_met).length,
            total_downtime_seconds: totalDowntimeSeconds,
            total_downtime_human: formatDuration(totalDowntimeSeconds),
            avg_response_time_ms: Math.round(overallAvgResponseTime),
          },
          checks: checkReports,
          incident_summary: incidentSummary,
        },
      };
    }
  );
}
