/**
 * QA Guardian MCP Tool Definitions - Core
 *
 * This file contains core MCP tool definitions:
 * - Project management tools
 * - Test suite management tools
 * - Basic test management tools
 */

// Tool input schema type
interface ToolInputSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

// Tool definition type
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
}

// Core tools: Projects, Suites, and basic test management
export const TOOLS_CORE: ToolDefinition[] = [
  // ===== Project Management Tools =====
  {
    name: 'list_projects',
    description: 'List all projects in the organization',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of projects to return',
          default: 50,
        },
        offset: {
          type: 'number',
          description: 'Number of projects to skip',
          default: 0,
        },
      },
    },
  },
  {
    name: 'get_project',
    description: 'Get details of a specific project',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The ID of the project',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #859: Create project tool
  {
    name: 'create_project',
    description: 'Create a new project in the organization. Returns the created project with its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the project (required)',
        },
        description: {
          type: 'string',
          description: 'Description of the project',
        },
        repository_url: {
          type: 'string',
          description: 'Git repository URL for the project',
        },
        default_branch: {
          type: 'string',
          description: 'Default branch name (e.g., "main" or "master")',
          default: 'main',
        },
        test_types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Types of tests to enable (e.g., ["e2e", "api", "visual"])',
        },
      },
      required: ['name'],
    },
  },
  // Feature #860: Update project tool
  {
    name: 'update_project',
    description: 'Update an existing project\'s settings. Returns the updated project.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The ID of the project to update (required)',
        },
        name: {
          type: 'string',
          description: 'New name for the project',
        },
        description: {
          type: 'string',
          description: 'New description for the project',
        },
        repository_url: {
          type: 'string',
          description: 'Git repository URL',
        },
        default_branch: {
          type: 'string',
          description: 'Default branch name',
        },
        default_browser: {
          type: 'string',
          enum: ['chromium', 'firefox', 'webkit'],
          description: 'Default browser for test execution',
        },
        default_timeout: {
          type: 'number',
          description: 'Default test timeout in milliseconds',
        },
        status: {
          type: 'string',
          enum: ['active', 'archived'],
          description: 'Project status',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #861: Delete project tool
  {
    name: 'delete_project',
    description: 'Delete a project. This action is irreversible. Returns confirmation of deletion.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The ID of the project to delete (required)',
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm deletion (required)',
        },
      },
      required: ['project_id', 'confirm'],
    },
  },

  // ===== Test Suite Management Tools =====
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
  // Feature #862: Create test suite tool
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
  // Feature #863: Update test suite tool
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
  // Feature #864: Delete test suite tool
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

  // ===== Basic Test Management Tools =====
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
          description: 'Complete array of test steps. When provided, replaces all existing steps. Each step should have action, and optionally selector and value.',
          items: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['click', 'fill', 'navigate', 'assert', 'wait', 'hover', 'select', 'press', 'screenshot', 'scroll', 'check', 'uncheck', 'focus', 'blur', 'dblclick', 'type', 'clear', 'upload', 'download', 'evaluate'],
                description: 'The type of step action',
              },
              selector: {
                type: 'string',
                description: 'CSS selector or locator for the target element',
              },
              value: {
                type: 'string',
                description: 'Value for the step (e.g., text for fill, URL for navigate)',
              },
            },
            required: ['action'],
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
