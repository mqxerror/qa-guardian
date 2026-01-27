/**
 * External Integrations Tools Module
 *
 * Tools for integrating with external services like GitHub and notification systems.
 * Provides connections to source control and team communication channels.
 * Note: For issue tracking (Jira, Linear, etc.), use webhooks + n8n/Zapier.
 */

import { ToolDefinition } from '../types';

export const INTEGRATIONS_TOOLS: ToolDefinition[] = [
  // Feature #1226: MCP tool get_related_prs - Get GitHub PRs related to failures
  {
    name: 'get_related_prs',
    description: 'Get GitHub pull requests related to a test failure. Analyzes commit history and file changes to identify PRs that likely caused the failure.',
    inputSchema: {
      type: 'object',
      properties: {
        failure_id: {
          type: 'string',
          description: 'The ID of the test failure to analyze (required)',
        },
        repository: {
          type: 'string',
          description: 'GitHub repository in owner/repo format (e.g., "myorg/myrepo")',
        },
        time_window: {
          type: 'string',
          enum: ['1h', '6h', '12h', '24h', '48h', '7d'],
          description: 'Time window to search for related PRs (default: 24h)',
        },
        include_commits: {
          type: 'boolean',
          description: 'Include detailed commit information (default: true)',
        },
        include_file_changes: {
          type: 'boolean',
          description: 'Include list of changed files per PR (default: true)',
        },
        include_blame: {
          type: 'boolean',
          description: 'Include blame information linking failures to specific code changes (default: false)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of PRs to return (default: 10)',
        },
      },
      required: ['failure_id'],
    },
  },
  // Feature #1437: Removed get_deployment_context - deployment info should come via webhooks, not polling
  // Feature #1436: Removed notify_team - AI should not send arbitrary notifications that bypass alert conditions and rate limiting
];

export const INTEGRATIONS_TOOL_NAMES = INTEGRATIONS_TOOLS.map(t => t.name);
