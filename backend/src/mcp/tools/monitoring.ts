/**
 * Monitoring Tools
 *
 * MCP tools for uptime monitoring, health checks, and alerting.
 */

import { ToolDefinition } from '../types';

export const MONITORING_TOOLS: ToolDefinition[] = [
  {
    name: 'get_uptime_status',
    description: 'Get current uptime status for all monitoring checks',
    inputSchema: {
      type: 'object',
      properties: {
        check_id: {
          type: 'string',
          description: 'Filter by specific check ID',
        },
        status: {
          type: 'string',
          enum: ['up', 'down', 'degraded', 'maintenance'],
          description: 'Filter by status',
        },
        check_type: {
          type: 'string',
          enum: ['http', 'tcp', 'dns', 'ssl', 'webhook'],
          description: 'Filter by check type',
        },
      },
    },
  },
  {
    name: 'get_check_results',
    description: 'Get synthetic monitoring check results',
    inputSchema: {
      type: 'object',
      properties: {
        check_id: {
          type: 'string',
          description: 'The ID of the monitoring check',
        },
        period: {
          type: 'string',
          enum: ['1h', '6h', '24h', '7d', '30d'],
          description: 'Time period for results (default: 24h)',
          default: '24h',
        },
        include_metrics: {
          type: 'boolean',
          description: 'Include response time metrics (default: true)',
          default: true,
        },
      },
      required: ['check_id'],
    },
  },
  // Feature #1431: Removed create_check, update_check, delete_check, pause_check, resume_check tools
  // Monitoring CRUD operations should be done via REST API with human oversight
  // Keep get_uptime_status and get_check_results for AI context
  // Feature #1425: Removed acknowledge_alert, resolve_alert, snooze_alert tools
  // Alert management is an incident response workflow for humans, not AI automation
  {
    name: 'get_incident_timeline',
    description: 'Get incident timeline showing all events and status changes.',
    inputSchema: {
      type: 'object',
      properties: {
        incident_id: {
          type: 'string',
          description: 'The ID of the incident',
        },
        include_related: {
          type: 'boolean',
          description: 'Include related alerts and checks',
          default: true,
        },
      },
      required: ['incident_id'],
    },
  },
  // Feature #1431: Removed create_maintenance_window - use REST API with human oversight
  {
    name: 'get_health_summary',
    description: 'Get overall health summary across all monitoring checks.',
    inputSchema: {
      type: 'object',
      properties: {
        group: {
          type: 'string',
          description: 'Filter by check group',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags',
        },
      },
    },
  },
  {
    name: 'get_uptime_report',
    description: 'Generate an uptime report for specified time period.',
    inputSchema: {
      type: 'object',
      properties: {
        check_id: {
          type: 'string',
          description: 'The check ID (optional, all checks if omitted)',
        },
        period: {
          type: 'string',
          enum: ['24h', '7d', '30d', '90d', '1y'],
          description: 'Report period',
          default: '30d',
        },
        format: {
          type: 'string',
          enum: ['json', 'html', 'pdf'],
          description: 'Report format',
          default: 'json',
        },
      },
    },
  },
  {
    name: 'configure_alert_policy',
    description: 'Configure alerting policy for a check or group of checks.',
    inputSchema: {
      type: 'object',
      properties: {
        check_id: {
          type: 'string',
          description: 'The check ID to configure (or use tags for multiple)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Apply policy to checks with these tags',
        },
        policy: {
          type: 'object',
          description: 'Alert policy configuration',
        },
      },
    },
  },
];

// List of monitoring tool names for handler mapping
export const MONITORING_TOOL_NAMES = MONITORING_TOOLS.map(t => t.name);
