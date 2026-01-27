/**
 * Alerting Tools
 *
 * MCP tools for alert management, on-call schedules, and maintenance windows.
 */

import { ToolDefinition } from '../types';

export const ALERTING_TOOLS: ToolDefinition[] = [
  // Feature #1425: Removed unsnooze_alert tool
  // Alert management is an incident response workflow for humans, not AI automation
  {
    name: 'get_alert_history',
    description: 'Get historical alerts with statistics and analytics. Use this to analyze past alerts, identify patterns, and review resolution details.',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date for filtering (ISO 8601 format)',
        },
        end_date: {
          type: 'string',
          description: 'End date for filtering (ISO 8601 format)',
        },
        severity: {
          type: 'string',
          description: 'Filter by severity (comma-separated for multiple)',
        },
        source: {
          type: 'string',
          description: 'Filter by source (comma-separated for multiple)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of alerts to return (default: 50, max: 100)',
          default: 50,
        },
      },
    },
  },
  {
    name: 'get_oncall_schedule',
    description: 'Get on-call schedules to see who is currently on-call and the upcoming rotation.',
    inputSchema: {
      type: 'object',
      properties: {
        schedule_id: {
          type: 'string',
          description: 'Optional: Get a specific schedule by ID. If not provided, returns all schedules.',
        },
      },
    },
  },
  // Feature #1425: Removed test_alert_channel tool
  // Testing alert channels sends notifications and should be done via UI
  {
    name: 'get_maintenance_windows',
    description: 'List all maintenance windows. Use this to see scheduled and active maintenance windows across all checks.',
    inputSchema: {
      type: 'object',
      properties: {
        active_only: {
          type: 'boolean',
          description: 'If true, only return currently active maintenance windows',
        },
      },
    },
  },
  {
    name: 'get_status_page_status',
    description: 'Get the current status of a public status page. Use this to check overall system health, component statuses, and any active incidents.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'The URL slug of the status page (e.g., "my-service-status")',
        },
      },
      required: ['slug'],
    },
  },
];

// List of alerting tool names for handler mapping
export const ALERTING_TOOL_NAMES = ALERTING_TOOLS.map(t => t.name);
