/**
 * Test Suite Tools
 *
 * MCP tools for managing test suites in QA Guardian.
 */

import { ToolDefinition } from '../types';

export const TEST_SUITE_TOOLS: ToolDefinition[] = [
  {
    name: 'list_test_suites',
    description: 'List test suites in a project. Supports filtering by type and name search. Returns array of suites with id, name, type.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The ID of the project',
        },
        type: {
          type: 'string',
          enum: ['e2e', 'api', 'unit', 'visual', 'accessibility'],
          description: 'Filter suites by type',
        },
        name: {
          type: 'string',
          description: 'Filter suites by name (partial match)',
        },
        status: {
          type: 'string',
          enum: ['active', 'draft', 'archived'],
          description: 'Filter suites by status',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of suites to return (default: 50)',
          default: 50,
        },
        offset: {
          type: 'number',
          description: 'Number of suites to skip for pagination (default: 0)',
          default: 0,
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'create_test_suite',
    description: 'Create a new test suite in a project. Returns the created suite with its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The ID of the project to create the suite in (required)',
        },
        name: {
          type: 'string',
          description: 'Name of the test suite (required)',
        },
        type: {
          type: 'string',
          enum: ['e2e', 'api', 'unit', 'visual', 'accessibility'],
          description: 'Type of tests in this suite (required)',
        },
        description: {
          type: 'string',
          description: 'Description of the test suite',
        },
        base_url: {
          type: 'string',
          description: 'Base URL for test execution',
        },
        browsers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Browsers to run tests in (e.g., ["chromium", "firefox"])',
        },
        timeout: {
          type: 'number',
          description: 'Default timeout for tests in milliseconds',
        },
        retries: {
          type: 'number',
          description: 'Number of retries for failed tests',
        },
      },
      required: ['project_id', 'name', 'type'],
    },
  },
  {
    name: 'update_test_suite',
    description: 'Update an existing test suite\'s configuration. Returns the updated suite.',
    inputSchema: {
      type: 'object',
      properties: {
        suite_id: {
          type: 'string',
          description: 'The ID of the test suite to update (required)',
        },
        name: {
          type: 'string',
          description: 'New name for the test suite',
        },
        description: {
          type: 'string',
          description: 'New description for the test suite',
        },
        base_url: {
          type: 'string',
          description: 'Base URL for test execution',
        },
        browsers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Browsers to run tests in (e.g., ["chromium", "firefox"])',
        },
        viewports: {
          type: 'array',
          items: { type: 'object' },
          description: 'Viewport configurations (e.g., [{"name": "desktop", "width": 1920, "height": 1080}])',
        },
        timeout: {
          type: 'number',
          description: 'Default timeout for tests in milliseconds',
        },
        retries: {
          type: 'number',
          description: 'Number of retries for failed tests',
        },
        status: {
          type: 'string',
          enum: ['active', 'draft', 'archived'],
          description: 'Suite status',
        },
      },
      required: ['suite_id'],
    },
  },
  {
    name: 'delete_test_suite',
    description: 'Delete a test suite and all its tests. This action is irreversible.',
    inputSchema: {
      type: 'object',
      properties: {
        suite_id: {
          type: 'string',
          description: 'The ID of the test suite to delete (required)',
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm deletion (required)',
        },
      },
      required: ['suite_id', 'confirm'],
    },
  },
];

// List of test suite tool names for handler mapping
export const TEST_SUITE_TOOL_NAMES = TEST_SUITE_TOOLS.map(t => t.name);
