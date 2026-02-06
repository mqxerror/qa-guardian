/**
 * Incidents Tools Module
 *
 * Tools for managing incidents including creation, tracking, and resolution.
 */

import { ToolDefinition } from '../types';

export const INCIDENTS_TOOLS: ToolDefinition[] = [
  {
    name: 'get_incidents',
    description: 'List active and recent incidents',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'investigating', 'identified', 'monitoring', 'resolved'],
          description: 'Filter by incident status',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'major', 'minor', 'maintenance'],
          description: 'Filter by severity',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of incidents (default: 20)',
          default: 20,
        },
      },
    },
  },
  // Feature #948: Create incident MCP tool (enhanced)
  {
    name: 'create_incident',
    description: 'Create a new incident manually or from an alert. Use this to declare an incident when issues are detected.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Incident title - a brief description of the issue',
        },
        description: {
          type: 'string',
          description: 'Detailed incident description explaining what happened and the impact',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'info'],
          description: 'Incident severity level (default: medium)',
          default: 'medium',
        },
        priority: {
          type: 'string',
          enum: ['P1', 'P2', 'P3', 'P4', 'P5'],
          description: 'Incident priority for response (P1=highest, P5=lowest, default: P3)',
          default: 'P3',
        },
        affected_services: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of affected service names (e.g., ["api", "frontend", "database"])',
        },
        source_check_id: {
          type: 'string',
          description: 'ID of the monitoring check that triggered this incident',
        },
        source_alert_id: {
          type: 'string',
          description: 'ID of the alert that triggered this incident',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorizing the incident (e.g., ["database", "performance"])',
        },
        escalation_policy_id: {
          type: 'string',
          description: 'ID of the escalation policy to use for notifications',
        },
        on_call_schedule_id: {
          type: 'string',
          description: 'ID of the on-call schedule to notify',
        },
      },
      required: ['title'],
    },
  },
  // Feature #947: Get incident details
  {
    name: 'get_incident_details',
    description: 'Get complete incident information including timeline, affected checks, and notes',
    inputSchema: {
      type: 'object',
      properties: {
        incident_id: {
          type: 'string',
          description: 'The ID of the incident to retrieve details for',
        },
        include_related_incidents: {
          type: 'boolean',
          description: 'Include similar or related incidents (default: false)',
          default: false,
        },
      },
      required: ['incident_id'],
    },
  },
  // Feature #949: Update incident MCP tool
  {
    name: 'update_incident',
    description: 'Update incident status and add notes. Use this to track incident progress through investigation to resolution.',
    inputSchema: {
      type: 'object',
      properties: {
        incident_id: {
          type: 'string',
          description: 'The ID of the incident to update',
        },
        status: {
          type: 'string',
          enum: ['acknowledged', 'investigating', 'identified', 'monitoring', 'resolved'],
          description: 'New status for the incident',
        },
        note: {
          type: 'string',
          description: 'Optional note to add with the status update (e.g., investigation findings)',
        },
        note_visibility: {
          type: 'string',
          enum: ['internal', 'public'],
          description: 'Visibility of the note (default: internal)',
          default: 'internal',
        },
        resolution_summary: {
          type: 'string',
          description: 'Required when resolving - summary of how the incident was resolved',
        },
        postmortem_url: {
          type: 'string',
          description: 'Optional URL to postmortem document (for resolved incidents)',
        },
      },
      required: ['incident_id'],
    },
  },
];

export const INCIDENTS_TOOL_NAMES = INCIDENTS_TOOLS.map(t => t.name);
