/**
 * Test Execution Tools
 *
 * MCP tools for running tests and managing test execution.
 */

import { ToolDefinition } from '../types';

export const TEST_EXECUTION_TOOLS: ToolDefinition[] = [
  {
    name: 'run_test',
    description: 'Execute a test or test suite',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of the test to run',
        },
        suite_id: {
          type: 'string',
          description: 'The ID of the test suite to run',
        },
        browser: {
          type: 'string',
          enum: ['chromium', 'firefox', 'webkit'],
          description: 'Browser to use for the test',
          default: 'chromium',
        },
      },
    },
  },
  // Feature #1428: Unified get_run tool replaces get_run_status, get_run_progress, get_run_logs, etc.
  {
    name: 'get_run',
    description: 'Get comprehensive information about a test run. Use include parameter to specify what data to retrieve: status, progress, logs, console, network.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run (required)',
        },
        test_id: {
          type: 'string',
          description: 'Specific test ID for console/network logs (optional)',
        },
        include: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['status', 'progress', 'logs', 'console', 'network', 'results'],
          },
          description: 'Data to include in response. Default: ["status", "progress"]',
        },
        log_level: {
          type: 'string',
          enum: ['all', 'error', 'warn', 'info', 'debug'],
          description: 'Filter logs by level when including logs (default: all)',
        },
        log_limit: {
          type: 'number',
          description: 'Maximum log entries to return (default: 100)',
        },
      },
      required: ['run_id'],
    },
  },
  // Feature #1428: Removed get_run_status - use get_run with include=["status"]
  {
    name: 'list_recent_runs',
    description: 'List recent test runs',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Filter by project ID',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of runs to return',
          default: 10,
        },
        status: {
          type: 'string',
          enum: ['passed', 'failed', 'running', 'pending'],
          description: 'Filter by status',
        },
      },
    },
  },
  {
    name: 'cancel_test',
    description: 'Cancel a running test',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run to cancel',
        },
      },
      required: ['run_id'],
    },
  },
  {
    name: 'cancel_run',
    description: 'Cancel a running test run. Only works for runs in "running" or "pending" status.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run to cancel',
        },
        reason: {
          type: 'string',
          description: 'Optional reason for cancellation',
        },
      },
      required: ['run_id'],
    },
  },
  // Feature #1423: Removed pause_run and resume_run tools
  // Playwright does not support mid-execution pause/resume - tests either run to completion or get cancelled
  // Feature #1428: Removed get_run_progress - use get_run with include=["progress"]
  {
    name: 'get_queue_status',
    description: 'Get the status of the test run queue including pending runs and estimated wait times.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Filter queue status to a specific project',
        },
        include_details: {
          type: 'boolean',
          description: 'Include detailed information about each queued run',
        },
      },
    },
  },
  {
    name: 'prioritize_run',
    description: 'Change the priority of a pending test run in the queue.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run to prioritize',
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'critical'],
          description: 'New priority level',
        },
      },
      required: ['run_id', 'priority'],
    },
  },
  {
    name: 'get_execution_browsers',
    description: 'Get list of available browsers for test execution.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_execution_viewports',
    description: 'Get list of available viewport configurations for test execution.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  // Additional test execution tools
  {
    name: 'set_run_environment',
    description: 'Set environment variables for a test run. These variables override project-level environment variables during test execution.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run to set environment variables for',
        },
        env_vars: {
          type: 'object',
          description: 'Key-value pairs of environment variables to set',
          additionalProperties: {
            type: 'string',
          },
        },
        merge: {
          type: 'boolean',
          description: 'If true, merge with existing env vars; if false, replace all run env vars',
          default: true,
        },
      },
      required: ['run_id', 'env_vars'],
    },
  },
  {
    name: 'get_run_environment',
    description: 'Get environment variables for a test run, including project-level and run-specific variables.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run to get environment variables for',
        },
      },
      required: ['run_id'],
    },
  },
  {
    name: 'run_suite',
    description: 'Run an entire test suite. Executes all tests in the suite and returns a run ID for tracking progress.',
    inputSchema: {
      type: 'object',
      properties: {
        suite_id: {
          type: 'string',
          description: 'The ID of the test suite to run',
        },
        browser: {
          type: 'string',
          enum: ['chromium', 'firefox', 'webkit'],
          description: 'Browser to use for the test run (default: chromium)',
        },
        browsers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Run tests in multiple browsers (e.g., ["chromium", "firefox"])',
        },
        parallel: {
          type: 'boolean',
          description: 'Run tests in parallel (default: true)',
        },
        retries: {
          type: 'number',
          description: 'Number of retries for failed tests (default: 0)',
        },
        timeout: {
          type: 'number',
          description: 'Test timeout in milliseconds (default: 30000)',
        },
        branch: {
          type: 'string',
          description: 'Git branch to run tests against',
        },
        base_url: {
          type: 'string',
          description: 'Base URL for tests (overrides suite default)',
        },
        environment: {
          type: 'string',
          enum: ['development', 'staging', 'production'],
          description: 'Target environment for the test run',
        },
      },
      required: ['suite_id'],
    },
  },
  {
    name: 'run_selected_tests',
    description: 'Run specific tests from a suite. Allows running a subset of tests by providing their IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        test_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of test IDs to run',
        },
        browser: {
          type: 'string',
          enum: ['chromium', 'firefox', 'webkit'],
          description: 'Browser to use for the test run (default: chromium)',
        },
        parallel: {
          type: 'boolean',
          description: 'Run tests in parallel (default: true)',
        },
        retries: {
          type: 'number',
          description: 'Number of retries for failed tests (default: 0)',
        },
        timeout: {
          type: 'number',
          description: 'Test timeout in milliseconds (default: 30000)',
        },
      },
      required: ['test_ids'],
    },
  },
  {
    name: 'run_failed_tests',
    description: 'Retry only the failed tests from a previous run. Fetches the failed test IDs and re-runs them.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the previous run to get failed tests from',
        },
        browser: {
          type: 'string',
          enum: ['chromium', 'firefox', 'webkit'],
          description: 'Browser to use for retries (default: same as original run)',
        },
        retries: {
          type: 'number',
          description: 'Number of additional retries for failed tests (default: 1)',
        },
        timeout: {
          type: 'number',
          description: 'Test timeout in milliseconds (default: 30000)',
        },
      },
      required: ['run_id'],
    },
  },
  {
    name: 'run_flaky_tests',
    description: 'Run tests that have been identified as flaky. Fetches tests with flakiness scores above threshold and re-runs them to update their flakiness metrics.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The ID of the project to find and run flaky tests in',
        },
        suite_id: {
          type: 'string',
          description: 'Optional: limit to specific suite',
        },
        min_flakiness_score: {
          type: 'number',
          description: 'Minimum flakiness score (0-100) to consider a test flaky (default: 20)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of flaky tests to run (default: 10)',
        },
        browser: {
          type: 'string',
          enum: ['chromium', 'firefox', 'webkit'],
          description: 'Browser to use for test runs (default: chromium)',
        },
        runs_per_test: {
          type: 'number',
          description: 'Number of times to run each flaky test (default: 3)',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'schedule_run',
    description: 'Schedule a test suite to run at a specific time. Returns the schedule ID for tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        suite_id: {
          type: 'string',
          description: 'The ID of the test suite to schedule',
        },
        scheduled_time: {
          type: 'string',
          description: 'When to run the tests (ISO 8601 format, e.g., "2026-01-16T10:00:00Z")',
        },
        timezone: {
          type: 'string',
          description: 'Timezone for the scheduled time (default: UTC)',
        },
        browser: {
          type: 'string',
          enum: ['chromium', 'firefox', 'webkit'],
          description: 'Browser to use for the scheduled run (default: chromium)',
        },
        recurrence: {
          type: 'string',
          enum: ['once', 'daily', 'weekly', 'monthly'],
          description: 'Recurrence pattern (default: once)',
        },
        notify_on_complete: {
          type: 'boolean',
          description: 'Send notification when run completes (default: true)',
        },
        notify_on_failure: {
          type: 'boolean',
          description: 'Send notification only on failures (default: false)',
        },
      },
      required: ['suite_id', 'scheduled_time'],
    },
  },
  {
    name: 'trigger_test_run',
    description: 'Start execution of a test suite. Returns a runId that can be used to track progress.',
    inputSchema: {
      type: 'object',
      properties: {
        suite_id: {
          type: 'string',
          description: 'The ID of the test suite to execute',
        },
        browser: {
          type: 'string',
          enum: ['chromium', 'firefox', 'webkit'],
          description: 'Browser to use for the test run',
        },
      },
      required: ['suite_id'],
    },
  },
];

// List of test execution tool names for handler mapping
export const TEST_EXECUTION_TOOL_NAMES = TEST_EXECUTION_TOOLS.map(t => t.name);
