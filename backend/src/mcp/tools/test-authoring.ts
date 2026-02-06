/**
 * Test Authoring Tools Module
 *
 * Tools for creating, editing, and managing test cases and test steps.
 * Includes import/export functionality for test portability.
 */

import { ToolDefinition } from '../types';

export const TEST_AUTHORING_TOOLS: ToolDefinition[] = [
  // Feature #1730: Get test by ID
  {
    name: 'get_test',
    description: 'Get test case details by ID. Returns test name, steps, type, suite, status, and last run info.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of the test to retrieve',
        },
      },
      required: ['test_id'],
    },
  },
  // Feature #1730: List tests in a suite
  {
    name: 'list_tests',
    description: 'List all test cases in a test suite.',
    inputSchema: {
      type: 'object',
      properties: {
        suite_id: {
          type: 'string',
          description: 'The ID of the test suite to list tests from',
        },
      },
      required: ['suite_id'],
    },
  },
  {
    name: 'create_test',
    description: 'Create a new test case',
    inputSchema: {
      type: 'object',
      properties: {
        suite_id: {
          type: 'string',
          description: 'The ID of the test suite',
        },
        name: {
          type: 'string',
          description: 'Name of the test',
        },
        type: {
          type: 'string',
          enum: ['e2e', 'api', 'unit', 'visual', 'accessibility'],
          description: 'Type of test',
        },
        steps: {
          type: 'array',
          description: 'Test steps (for E2E tests)',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string' },
              selector: { type: 'string' },
              value: { type: 'string' },
            },
          },
        },
      },
      required: ['suite_id', 'name', 'type'],
    },
  },
  {
    name: 'update_test',
    description: 'Update test configuration settings. Use this tool to update test steps by providing the complete steps array.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of the test to update',
        },
        name: {
          type: 'string',
          description: 'New name for the test',
        },
        description: {
          type: 'string',
          description: 'New description for the test',
        },
        status: {
          type: 'string',
          enum: ['draft', 'active', 'archived'],
          description: 'New status for the test',
        },
        target_url: {
          type: 'string',
          description: 'Target URL for visual regression tests',
        },
        diff_threshold: {
          type: 'number',
          description: 'Acceptable diff percentage threshold (0-100)',
        },
        steps: {
          type: 'array',
          description: 'Complete array of test steps. When provided, replaces all existing steps.',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string' },
              selector: { type: 'string' },
              value: { type: 'string' },
            },
          },
        },
      },
      required: ['test_id'],
    },
  },
  // Feature #867: Delete test tool
  {
    name: 'delete_test',
    description: 'Delete a test from a test suite. Requires confirm=true as a safety check. Test history is preserved.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of the test to delete',
        },
        confirm: {
          type: 'boolean',
          description: 'Must be set to true to confirm deletion. This is a safety check.',
        },
      },
      required: ['test_id', 'confirm'],
    },
  },
  // Feature #868: Duplicate test tool
  {
    name: 'duplicate_test',
    description: 'Duplicate an existing test. Creates a copy with all settings preserved. Optionally specify a new name for the copy.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of the test to duplicate',
        },
        new_name: {
          type: 'string',
          description: 'Name for the duplicate test (defaults to "Copy of [original name]")',
        },
        target_suite_id: {
          type: 'string',
          description: 'ID of the suite to create the duplicate in (defaults to same suite as original)',
        },
      },
      required: ['test_id'],
    },
  },
  // Feature #869: Import tests tool
  {
    name: 'import_tests',
    description: 'Import multiple tests from JSON data into a test suite. Returns the count of successfully imported tests.',
    inputSchema: {
      type: 'object',
      properties: {
        suite_id: {
          type: 'string',
          description: 'The ID of the test suite to import tests into',
        },
        tests: {
          type: 'array',
          description: 'Array of test objects to import. Each test should have name, type, and optionally: description, steps, selectors, assertions, target_url, etc.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Test name (required)' },
              type: { type: 'string', enum: ['e2e', 'visual', 'api', 'accessibility', 'performance'], description: 'Test type' },
              description: { type: 'string', description: 'Test description' },
              steps: { type: 'array', description: 'Test steps for e2e tests' },
              target_url: { type: 'string', description: 'URL to test' },
              tags: { type: 'array', items: { type: 'string' }, description: 'Tags for filtering' },
            },
            required: ['name'],
          },
        },
        validate_only: {
          type: 'boolean',
          description: 'If true, only validate the import data without creating tests',
        },
      },
      required: ['suite_id', 'tests'],
    },
  },
  // Feature #870: Export tests tool
  {
    name: 'export_tests',
    description: 'Export tests from a test suite to JSON format. Returns all test details in a format that can be imported into another suite.',
    inputSchema: {
      type: 'object',
      properties: {
        suite_id: {
          type: 'string',
          description: 'The ID of the test suite to export tests from',
        },
        include_ids: {
          type: 'boolean',
          description: 'Include test IDs in export (default: false). Set to false for portable exports.',
        },
        include_timestamps: {
          type: 'boolean',
          description: 'Include created_at/updated_at timestamps (default: false)',
        },
        format: {
          type: 'string',
          enum: ['json', 'minimal'],
          description: 'Export format: "json" for full details, "minimal" for name/type/description only',
        },
      },
      required: ['suite_id'],
    },
  },
  // Feature #871: Reorder tests tool
  {
    name: 'reorder_tests',
    description: 'Reorder tests within a test suite. Provide test IDs in the desired order.',
    inputSchema: {
      type: 'object',
      properties: {
        suite_id: {
          type: 'string',
          description: 'The ID of the test suite',
        },
        test_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of test IDs in the desired order',
        },
      },
      required: ['suite_id', 'test_ids'],
    },
  },
  // Feature #1422: Removed add_test_step, update_test_step, delete_test_step tools
  // AI agents should use update_test with the complete test definition instead of granular step manipulation
  // Feature #875: Get test code tool
  {
    name: 'get_test_code',
    description: 'Get the generated Playwright code for a test. Returns either custom code if set, or auto-generated code from test steps.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of the test to get code for',
        },
        format: {
          type: 'string',
          enum: ['typescript', 'javascript'],
          description: 'Output format for the code (default: typescript)',
        },
      },
      required: ['test_id'],
    },
  },
  // Feature #876: Update test code tool
  {
    name: 'update_test_code',
    description: 'Update the Playwright code for a test. Sets custom code that will be used instead of auto-generated code from steps.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of the test to update',
        },
        code: {
          type: 'string',
          description: 'The Playwright test code to set',
        },
        use_custom_code: {
          type: 'boolean',
          description: 'Whether to use the custom code instead of steps (default: true)',
        },
      },
      required: ['test_id', 'code'],
    },
  },
  {
    name: 'get_test_config',
    description: 'Get configuration for a test suite. Returns browsers, timeout, retries, base URL, and other settings.',
    inputSchema: {
      type: 'object',
      properties: {
        suite_id: {
          type: 'string',
          description: 'The ID of the test suite',
        },
      },
      required: ['suite_id'],
    },
  },
  // Feature #877: Validate test tool
  {
    name: 'validate_test',
    description: 'Validate a test configuration. Checks for missing selectors, invalid step sequences, proper assertions, and other common issues. Returns validation result with any errors or warnings.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of the test to validate',
        },
        strict: {
          type: 'boolean',
          description: 'If true, treat warnings as errors (default: false)',
        },
        validate_selectors: {
          type: 'boolean',
          description: 'If true, validate that selectors are properly formatted (default: true)',
        },
        validate_steps: {
          type: 'boolean',
          description: 'If true, validate step sequence logic (default: true)',
        },
        validate_assertions: {
          type: 'boolean',
          description: 'If true, ensure test has proper assertions (default: true)',
        },
      },
      required: ['test_id'],
    },
  },
  // Feature #878: Get test history tool
  {
    name: 'get_test_history',
    description: 'Get the run history of a specific test. Returns a list of past runs with their status, duration, and failure details.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of the test to get history for',
        },
        since: {
          type: 'string',
          description: 'Start date for history (ISO 8601 format, e.g., "2026-01-01T00:00:00Z")',
        },
        until: {
          type: 'string',
          description: 'End date for history (ISO 8601 format, e.g., "2026-01-31T23:59:59Z")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of runs to return (default: 20, max: 100)',
        },
        status: {
          type: 'string',
          enum: ['passed', 'failed', 'running', 'pending', 'cancelled', 'skipped'],
          description: 'Filter by run status',
        },
        include_artifacts: {
          type: 'boolean',
          description: 'Include artifact links (screenshots, videos) in response (default: false)',
        },
      },
      required: ['test_id'],
    },
  },
];

export const TEST_AUTHORING_TOOL_NAMES = TEST_AUTHORING_TOOLS.map(t => t.name);
