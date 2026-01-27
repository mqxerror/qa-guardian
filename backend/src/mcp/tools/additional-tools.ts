/**
 * Additional Tools Module
 *
 * Tool definitions for miscellaneous MCP tools that complete the feature set.
 * Features: #1658, #1659, #1660, #1663, #1665, #1672, #1677, #1678, #1679
 */

import { ToolDefinition } from '../types';

export const ADDITIONAL_TOOLS: ToolDefinition[] = [
  // Feature #1658: Bulk update tests
  {
    name: 'bulk_update_tests',
    description: 'Update multiple test cases at once with specified properties like tags, status, timeout, or retries.',
    inputSchema: {
      type: 'object',
      properties: {
        test_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of test IDs to update',
        },
        updates: {
          type: 'object',
          description: 'Properties to update (tags, status, timeout, retries, etc.)',
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags to set on all tests',
            },
            status: {
              type: 'string',
              enum: ['draft', 'active', 'disabled'],
              description: 'Status to set on all tests',
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds',
            },
            retries: {
              type: 'number',
              description: 'Number of retries',
            },
          },
        },
      },
      required: ['test_ids', 'updates'],
    },
  },
  // Feature #1659: Get notification settings
  {
    name: 'get_notification_settings',
    description: 'Retrieve notification configuration for the organization including email, Slack, and in-app notification settings.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  // Feature #1660: Configure webhook
  {
    name: 'configure_webhook',
    description: 'Add or update a webhook configuration to receive notifications for test events like failures and suite completions.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Webhook URL to receive notifications',
        },
        name: {
          type: 'string',
          description: 'Name for the webhook configuration',
        },
        events: {
          type: 'array',
          items: { type: 'string' },
          description: 'Events to trigger webhook (test_failure, suite_completed, etc.)',
        },
        enabled: {
          type: 'boolean',
          description: 'Whether the webhook is enabled (default: true)',
        },
        secret: {
          type: 'string',
          description: 'Secret for webhook signature verification',
        },
      },
      required: ['url'],
    },
  },
  // Feature #1663: Tag test cases
  {
    name: 'tag_test_cases',
    description: 'Add or remove tags from multiple test cases at once for organization and filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        test_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of test IDs to tag',
        },
        add_tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags to add to the tests',
        },
        remove_tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags to remove from the tests',
        },
      },
      required: ['test_ids'],
    },
  },
  // Feature #1665: Get data retention policy
  {
    name: 'get_data_retention_policy',
    description: 'Retrieve data retention settings for test results, artifacts, audit logs, and other data.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  // Feature #1672: Approve visual baseline
  {
    name: 'approve_visual_baseline',
    description: 'Approve a new visual baseline for a test, accepting the current screenshot as the new reference.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The test ID to approve baseline for',
        },
        run_id: {
          type: 'string',
          description: 'The run ID containing the new baseline (optional)',
        },
        diff_id: {
          type: 'string',
          description: 'The diff ID to approve (alternative to test_id)',
        },
        comment: {
          type: 'string',
          description: 'Comment explaining why the baseline was approved',
        },
      },
    },
  },
  // Feature #1677: Validate API response
  {
    name: 'validate_api_response',
    description: 'Validate an API response against expected status codes, schema, or specific values.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The API endpoint URL to validate',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          description: 'HTTP method (default: GET)',
        },
        expected_status: {
          type: 'number',
          description: 'Expected HTTP status code (default: 200)',
        },
        schema: {
          type: 'object',
          description: 'JSON schema to validate the response against',
        },
        expected_values: {
          type: 'object',
          description: 'Key-value pairs of expected values in the response (supports dot notation)',
        },
        headers: {
          type: 'object',
          description: 'Custom headers to send with the request',
        },
        body: {
          type: 'object',
          description: 'Request body for POST/PUT/PATCH requests',
        },
      },
      required: ['url'],
    },
  },
  // Feature #1678: Get mock server status
  {
    name: 'get_mock_server_status',
    description: 'Get the status of the mock server used for API testing, including running state and configured endpoints.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  // Feature #1679: Create mock endpoint
  {
    name: 'create_mock_endpoint',
    description: 'Create a new mock endpoint for API testing with custom response status, body, and headers.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The endpoint path (e.g., /api/users)',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          description: 'HTTP method (default: GET)',
        },
        name: {
          type: 'string',
          description: 'Name for the mock endpoint',
        },
        response_status: {
          type: 'number',
          description: 'HTTP status code to return (default: 200)',
        },
        response_body: {
          type: 'object',
          description: 'JSON body to return in the response',
        },
        response_headers: {
          type: 'object',
          description: 'Custom headers to return in the response',
        },
        delay: {
          type: 'number',
          description: 'Response delay in milliseconds (default: 0)',
        },
      },
      required: ['path'],
    },
  },
  // Feature #1715: Analyze site using Crawl4AI
  {
    name: 'analyze_site',
    description: 'Analyze a website to understand its structure for test generation. Uses Crawl4AI to extract forms, links, buttons, navigation, and suggests relevant tests.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to analyze (e.g., https://example.com)',
        },
        include_links: {
          type: 'boolean',
          description: 'Include link analysis (default: true)',
        },
        include_forms: {
          type: 'boolean',
          description: 'Include form analysis (default: true)',
        },
      },
      required: ['url'],
    },
  },
];

export const ADDITIONAL_TOOL_NAMES = ADDITIONAL_TOOLS.map(t => t.name);
