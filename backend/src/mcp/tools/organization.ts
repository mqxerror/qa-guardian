/**
 * Organization Tools Module
 *
 * Tools for managing organization settings, team members, API keys, and integrations.
 */

import { ToolDefinition } from '../types';

export const ORGANIZATION_TOOLS: ToolDefinition[] = [
  // Feature #1014: Get organization info MCP tool
  {
    name: 'get_organization_info',
    description: 'Get detailed information about the current organization including name, settings, member count, and plan details.',
    inputSchema: {
      type: 'object',
      properties: {
        include_members: {
          type: 'boolean',
          description: 'Include list of organization members (default: false)',
        },
        include_settings: {
          type: 'boolean',
          description: 'Include organization settings (default: true)',
        },
        include_usage: {
          type: 'boolean',
          description: 'Include usage statistics (default: true)',
        },
        include_integrations: {
          type: 'boolean',
          description: 'Include configured integrations (default: true)',
        },
      },
    },
  },
  // Feature #1015: Get team members MCP tool
  {
    name: 'get_team_members',
    description: 'List all organization members with their roles, status, and activity information.',
    inputSchema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          enum: ['owner', 'admin', 'developer', 'viewer', 'all'],
          description: 'Filter by role (default: all)',
        },
        status: {
          type: 'string',
          enum: ['active', 'pending', 'inactive', 'all'],
          description: 'Filter by status (default: all)',
        },
        include_activity: {
          type: 'boolean',
          description: 'Include recent activity for each member (default: false)',
        },
        include_permissions: {
          type: 'boolean',
          description: 'Include detailed permissions for each member (default: false)',
        },
      },
    },
  },
  // Feature #1424: Removed invite_member, update_member_role, remove_member tools
  // These are security-sensitive operations that require human judgment
  // and should only be available via REST API
  // Feature #1019: Get API keys MCP tool
  {
    name: 'get_api_keys',
    description: 'List all API keys for the organization with their scopes and usage information.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'revoked', 'expired', 'all'],
          description: 'Filter by key status (default: active)',
        },
        created_by: {
          type: 'string',
          description: 'Filter by creator user ID',
        },
        include_usage: {
          type: 'boolean',
          description: 'Include usage statistics for each key (default: true)',
        },
      },
    },
  },
  // Feature #1424: Removed create_api_key and revoke_api_key tools
  // These are security-sensitive operations that require human judgment
  // and should only be available via REST API
  // Feature #1023: Get integrations MCP tool
  {
    name: 'get_integrations',
    description: 'List all connected integrations (GitHub, Slack, webhooks) and their status for the organization.',
    inputSchema: {
      type: 'object',
      properties: {
        include_webhooks: {
          type: 'boolean',
          description: 'Include webhook configurations (default: true)',
        },
        include_github: {
          type: 'boolean',
          description: 'Include GitHub repository connections (default: true)',
        },
        include_slack: {
          type: 'boolean',
          description: 'Include Slack workspace connection (default: true)',
        },
        project_id: {
          type: 'string',
          description: 'Filter GitHub connections by project ID (optional)',
        },
      },
    },
  },
  // Feature #1022: Update organization settings MCP tool
  {
    name: 'update_settings',
    description: 'Update organization settings including name, timezone, and default configurations.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'New organization name (1-100 characters)',
        },
        timezone: {
          type: 'string',
          description: 'Timezone for the organization (e.g., "America/New_York", "Europe/London", "UTC")',
        },
        default_browser: {
          type: 'string',
          enum: ['chromium', 'firefox', 'webkit'],
          description: 'Default browser for test execution',
        },
        default_timeout: {
          type: 'number',
          description: 'Default timeout for tests in milliseconds (1000-300000)',
        },
        notifications_enabled: {
          type: 'boolean',
          description: 'Enable or disable email notifications',
        },
        slack_webhook_url: {
          type: 'string',
          description: 'Slack webhook URL for notifications (or null to remove)',
        },
      },
    },
  },
];

export const ORGANIZATION_TOOL_NAMES = ORGANIZATION_TOOLS.map(t => t.name);
