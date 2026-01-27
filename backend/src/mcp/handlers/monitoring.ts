/**
 * Monitoring Tool Handlers
 *
 * Handlers for monitoring and alerting MCP tools.
 * Extracted from server.ts to reduce file size (Feature #1356).
 */

import { ToolHandler, HandlerModule } from './types';

/**
 * Get uptime status
 */
export const getUptimeStatus: ToolHandler = async (args, context) => {
  const uptimeParams = new URLSearchParams();
  if (args.check_id) uptimeParams.append('check_id', args.check_id as string);
  if (args.status) uptimeParams.append('status', args.status as string);
  if (args.check_type) uptimeParams.append('type', args.check_type as string);
  const uptimeQuery = uptimeParams.toString();
  return await context.callApi(`/api/v1/monitoring/checks${uptimeQuery ? '?' + uptimeQuery : ''}`);
};

/**
 * Get check results
 */
export const getCheckResults: ToolHandler = async (args, context) => {
  return await context.callApi(
    `/api/v1/monitoring/checks/${args.check_id}/results?period=${args.period || '24h'}&include_metrics=${args.include_metrics !== false}`
  );
};

/**
 * Get alert history (Feature #953)
 */
export const getAlertHistory: ToolHandler = async (args, context) => {
  const historyParams = new URLSearchParams();
  if (args.start_date) historyParams.append('start_date', args.start_date as string);
  if (args.end_date) historyParams.append('end_date', args.end_date as string);
  if (args.severity) historyParams.append('severity', args.severity as string);
  if (args.source) historyParams.append('source', args.source as string);

  const limitVal = Math.min(args.limit as number || 50, 100);
  historyParams.append('limit', String(limitVal));

  const historyQuery = historyParams.toString();
  const historyResult = await context.callApi(`/api/v1/monitoring/alert-history${historyQuery ? '?' + historyQuery : ''}`) as {
    alerts: Array<{
      id: string;
      check_name: string;
      check_type: string;
      error_message?: string;
      severity: string;
      source: string;
      group_status: string;
      triggered_at: string;
      resolved_at?: string;
      acknowledged_at?: string;
    }>;
    stats: {
      total_alerts: number;
      by_severity: Record<string, number>;
      by_source: Record<string, number>;
      by_status: Record<string, number>;
      avg_resolution_time_seconds: number | null;
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
  };

  return {
    alerts: historyResult.alerts,
    statistics: {
      total_alerts: historyResult.stats.total_alerts,
      by_severity: historyResult.stats.by_severity,
      by_status: historyResult.stats.by_status,
      avg_resolution_time_seconds: historyResult.stats.avg_resolution_time_seconds,
    },
    pagination: historyResult.pagination,
    message: `Retrieved ${historyResult.alerts.length} alerts out of ${historyResult.pagination.total} total`,
  };
};

/**
 * Get on-call schedule (Feature #954)
 */
export const getOncallSchedule: ToolHandler = async (args, context) => {
  const scheduleId = args.schedule_id as string | undefined;

  if (scheduleId) {
    // Get specific schedule
    const scheduleResult = await context.callApi(`/api/v1/monitoring/on-call/${scheduleId}`) as {
      schedule: {
        id: string;
        name: string;
        description?: string;
        timezone: string;
        rotation_type: string;
        rotation_interval_days: number;
        members: Array<{
          id: string;
          user_name: string;
          user_email: string;
          phone?: string;
          order: number;
        }>;
        current_on_call_index: number;
        current_on_call: {
          user_name: string;
          user_email: string;
          phone?: string;
        } | null;
        is_active: boolean;
      };
    };

    const schedule = scheduleResult.schedule;
    const nextIndex = (schedule.current_on_call_index + 1) % schedule.members.length;
    const nextOnCall = schedule.members[nextIndex];

    return {
      schedule_id: schedule.id,
      name: schedule.name,
      description: schedule.description,
      timezone: schedule.timezone,
      rotation_type: schedule.rotation_type,
      rotation_interval_days: schedule.rotation_interval_days,
      is_active: schedule.is_active,
      current_on_call: schedule.current_on_call ? {
        name: schedule.current_on_call.user_name,
        email: schedule.current_on_call.user_email,
        phone: schedule.current_on_call.phone,
      } : null,
      next_on_call: nextOnCall ? {
        name: nextOnCall.user_name,
        email: nextOnCall.user_email,
        phone: nextOnCall.phone,
      } : null,
      rotation_members: schedule.members.map(m => ({
        name: m.user_name,
        email: m.user_email,
        phone: m.phone,
        order: m.order,
      })),
      total_members: schedule.members.length,
    };
  } else {
    // Get all schedules
    const schedulesResult = await context.callApi('/api/v1/monitoring/on-call') as {
      schedules: Array<{
        id: string;
        name: string;
        description?: string;
        rotation_type: string;
        is_active: boolean;
        current_on_call: {
          user_name: string;
          user_email: string;
          phone?: string;
        } | null;
        members: Array<{ user_name: string }>;
      }>;
    };

    return {
      schedules: schedulesResult.schedules.map(s => ({
        schedule_id: s.id,
        name: s.name,
        description: s.description,
        rotation_type: s.rotation_type,
        is_active: s.is_active,
        current_on_call: s.current_on_call ? {
          name: s.current_on_call.user_name,
          email: s.current_on_call.user_email,
          phone: s.current_on_call.phone,
        } : null,
        total_members: s.members.length,
      })),
      total_schedules: schedulesResult.schedules.length,
      message: `Found ${schedulesResult.schedules.length} on-call schedule(s)`,
    };
  }
};

/**
 * Get uptime report (Feature #955)
 */
export const getUptimeReport: ToolHandler = async (args, context) => {
  const reportParams = new URLSearchParams();

  if (args.check_ids) reportParams.append('check_ids', args.check_ids as string);
  if (args.start_date) reportParams.append('start_date', args.start_date as string);
  if (args.end_date) reportParams.append('end_date', args.end_date as string);
  if (args.sla_target !== undefined) reportParams.append('sla_target', String(args.sla_target));

  const reportQuery = reportParams.toString();
  const reportResult = await context.callApi(`/api/v1/monitoring/uptime-report${reportQuery ? '?' + reportQuery : ''}`) as {
    report: {
      generated_at: string;
      period: {
        start_date: string;
        end_date: string;
        duration_days: number;
      };
      sla_target: number;
      overall_summary: {
        total_checks_monitored: number;
        total_check_results: number;
        overall_uptime_percentage: number;
        overall_sla_met: boolean;
        checks_meeting_sla: number;
        checks_below_sla: number;
        total_downtime_seconds: number;
        total_downtime_human: string;
        avg_response_time_ms: number;
      };
      checks: Array<{
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
      }>;
      incident_summary: {
        total_incidents: number;
        by_severity: Record<string, number>;
        by_status: {
          resolved: number;
          active: number;
        };
        avg_resolution_time_seconds: number;
        recent_incidents: Array<{
          id: string;
          title: string;
          severity: string;
          status: string;
          created_at: string;
          resolved_at: string | null;
        }>;
      };
    };
  };

  // Return the full report with a summary message
  const report = reportResult.report;
  return {
    report_period: report.period,
    sla_target: `${report.sla_target}%`,
    overall_summary: {
      total_checks: report.overall_summary.total_checks_monitored,
      overall_uptime: `${report.overall_summary.overall_uptime_percentage}%`,
      sla_status: report.overall_summary.overall_sla_met ? 'SLA MET' : 'SLA BREACHED',
      checks_meeting_sla: report.overall_summary.checks_meeting_sla,
      checks_below_sla: report.overall_summary.checks_below_sla,
      total_downtime: report.overall_summary.total_downtime_human,
      avg_response_time: `${report.overall_summary.avg_response_time_ms}ms`,
    },
    check_details: report.checks.map(c => ({
      check_id: c.check_id,
      name: c.check_name,
      url: c.url,
      uptime: `${c.uptime_percentage}%`,
      sla_met: c.sla_met,
      sla_breaches: c.sla_breaches,
      response_times: {
        avg: `${c.avg_response_time_ms}ms`,
        p95: `${c.p95_response_time_ms}ms`,
        p99: `${c.p99_response_time_ms}ms`,
      },
      total_downtime_seconds: c.total_downtime_seconds,
      downtime_incidents_count: c.downtime_incidents.length,
    })),
    incident_summary: {
      total_incidents: report.incident_summary.total_incidents,
      by_severity: report.incident_summary.by_severity,
      resolved: report.incident_summary.by_status.resolved,
      active: report.incident_summary.by_status.active,
      avg_resolution_time_seconds: report.incident_summary.avg_resolution_time_seconds,
    },
    recent_incidents: report.incident_summary.recent_incidents,
    generated_at: report.generated_at,
    message: `Uptime report generated for ${report.period.duration_days} days. Overall uptime: ${report.overall_summary.overall_uptime_percentage}% (SLA target: ${report.sla_target}%). ${report.overall_summary.checks_meeting_sla}/${report.overall_summary.total_checks_monitored} checks meeting SLA.`,
  };
};

/**
 * Create maintenance window (Feature #957)
 */
export const createMaintenanceWindow: ToolHandler = async (args, context) => {
  const mwName = args.name as string;
  const startTime = args.start_time as string;
  const endTime = args.end_time as string;
  const reason = args.reason as string | undefined;
  const checkIds = args.check_ids as string[] | undefined;
  const allChecks = args.all_checks as boolean | undefined;
  const tags = args.tags as string[] | undefined;

  // Validate required fields
  if (!mwName?.trim()) {
    return { error: 'name is required' };
  }
  if (!startTime) {
    return { error: 'start_time is required (ISO 8601 format)' };
  }
  if (!endTime) {
    return { error: 'end_time is required (ISO 8601 format)' };
  }

  // Validate at least one scope selector
  if (!checkIds?.length && !allChecks && !tags?.length) {
    return {
      error: 'At least one scope selector is required',
      hint: 'Provide check_ids (array), tags (array), or set all_checks=true',
    };
  }

  // Create the maintenance window via API
  const mwResult = await context.callApi('/api/v1/monitoring/maintenance', {
    method: 'POST',
    body: {
      name: mwName.trim(),
      start_time: startTime,
      end_time: endTime,
      reason,
      check_ids: checkIds,
      all_checks: allChecks,
      tags,
    },
  }) as {
    group_id: string;
    name: string;
    start_time: string;
    end_time: string;
    reason?: string;
    is_active: boolean;
    alerts_suppressed: boolean;
    affected_checks: Array<{
      window_id: string;
      check_id: string;
      check_name: string;
    }>;
    total_checks_affected: number;
    message: string;
  };

  return {
    group_id: mwResult.group_id,
    name: mwResult.name,
    start_time: mwResult.start_time,
    end_time: mwResult.end_time,
    reason: mwResult.reason,
    is_active: mwResult.is_active,
    alerts_suppressed: mwResult.alerts_suppressed,
    affected_checks: mwResult.affected_checks.map(c => ({
      check_id: c.check_id,
      check_name: c.check_name,
    })),
    total_checks_affected: mwResult.total_checks_affected,
    message: mwResult.message,
  };
};

/**
 * Get maintenance windows (Feature #957)
 */
export const getMaintenanceWindows: ToolHandler = async (args, context) => {
  const activeOnly = args.active_only as boolean | undefined;
  const mwParams = new URLSearchParams();
  if (activeOnly) mwParams.append('active_only', 'true');
  const mwQuery = mwParams.toString();

  const windowsResult = await context.callApi(`/api/v1/monitoring/maintenance${mwQuery ? '?' + mwQuery : ''}`) as {
    maintenance_windows: Array<{
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
    }>;
    total: number;
    active_count: number;
    scheduled_count: number;
  };

  return {
    maintenance_windows: windowsResult.maintenance_windows.map(w => ({
      window_id: w.window_id,
      check_id: w.check_id,
      check_name: w.check_name,
      name: w.name,
      start_time: w.start_time,
      end_time: w.end_time,
      reason: w.reason,
      is_active: w.is_active,
    })),
    summary: {
      total: windowsResult.total,
      active: windowsResult.active_count,
      scheduled: windowsResult.scheduled_count,
    },
    message: `Found ${windowsResult.total} maintenance window(s): ${windowsResult.active_count} active, ${windowsResult.scheduled_count} scheduled.`,
  };
};

/**
 * Get status page status (Feature #958)
 */
export const getStatusPageStatus: ToolHandler = async (args, context) => {
  const statusPageSlug = args.slug as string;
  if (!statusPageSlug?.trim()) {
    return { error: 'slug is required' };
  }

  try {
    // Call the public status page endpoint (no auth required)
    const statusResult = await context.callApiPublic(`/api/v1/status/${encodeURIComponent(statusPageSlug)}`) as {
      name: string;
      slug: string;
      description?: string;
      logo_url?: string;
      primary_color?: string;
      overall_status: 'up' | 'down' | 'degraded';
      checks: Array<{
        id: string;
        type: string;
        name: string;
        status: string;
        uptime?: number;
        avg_response_time?: number;
        order: number;
      }>;
      incidents?: Array<{
        id: string;
        check_name: string;
        status: string;
        started_at: string;
        resolved_at?: string;
        type: string;
      }>;
      manual_incidents?: Array<{
        id: string;
        title: string;
        status: string;
        impact: string;
        affected_components: string[];
        updates: Array<{
          message: string;
          status: string;
          timestamp: string;
        }>;
        created_at: string;
        updated_at: string;
        resolved_at?: string;
      }>;
      last_updated: string;
    };

    // Build summary
    const totalComponents = statusResult.checks.length;
    const upComponents = statusResult.checks.filter(c => c.status === 'up').length;
    const downComponents = statusResult.checks.filter(c => c.status === 'down').length;
    const degradedComponents = statusResult.checks.filter(c => c.status === 'degraded').length;

    const activeIncidents = [
      ...(statusResult.incidents?.filter(i => !i.resolved_at) || []),
      ...(statusResult.manual_incidents?.filter(i => i.status !== 'resolved') || []),
    ];

    let statusEmoji = '✅';
    let statusMessage = 'All systems operational';
    if (statusResult.overall_status === 'down') {
      statusEmoji = '🔴';
      statusMessage = 'Major outage detected';
    } else if (statusResult.overall_status === 'degraded') {
      statusEmoji = '🟡';
      statusMessage = 'Some systems degraded';
    }

    return {
      status_page: {
        name: statusResult.name,
        slug: statusResult.slug,
        description: statusResult.description,
      },
      overall_status: statusResult.overall_status,
      status_summary: `${statusEmoji} ${statusMessage}`,
      components: statusResult.checks.map(c => ({
        name: c.name,
        status: c.status,
        uptime_percentage: c.uptime,
        avg_response_time_ms: c.avg_response_time,
      })),
      component_summary: {
        total: totalComponents,
        up: upComponents,
        down: downComponents,
        degraded: degradedComponents,
      },
      active_incidents: activeIncidents.length,
      incidents: statusResult.incidents?.slice(0, 5).map(i => ({
        check_name: i.check_name,
        status: i.status,
        started_at: i.started_at,
        resolved_at: i.resolved_at,
      })),
      manual_incidents: statusResult.manual_incidents?.slice(0, 5).map(i => ({
        title: i.title,
        status: i.status,
        impact: i.impact,
        affected_components: i.affected_components,
        latest_update: i.updates?.[i.updates.length - 1]?.message,
        created_at: i.created_at,
        resolved_at: i.resolved_at,
      })),
      last_updated: statusResult.last_updated,
      message: `Status page "${statusResult.name}": ${statusMessage}. ${upComponents}/${totalComponents} components operational.`,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      return { error: `Status page with slug "${statusPageSlug}" not found` };
    }
    if (errorMessage.includes('403') || errorMessage.includes('private')) {
      return { error: `Status page "${statusPageSlug}" is private and cannot be accessed` };
    }
    throw err;
  }
};

// Handler registry for monitoring tools
export const handlers: Record<string, ToolHandler> = {
  get_uptime_status: getUptimeStatus,
  get_check_results: getCheckResults,
  get_alert_history: getAlertHistory,
  get_oncall_schedule: getOncallSchedule,
  get_uptime_report: getUptimeReport,
  create_maintenance_window: createMaintenanceWindow,
  get_maintenance_windows: getMaintenanceWindows,
  get_status_page_status: getStatusPageStatus,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const monitoringHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default monitoringHandlers;
