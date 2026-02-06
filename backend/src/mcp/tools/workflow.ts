/**
 * Workflow Automation Tools Module
 *
 * Tools for creating, executing, and scheduling multi-step automation workflows.
 * Includes batch test triggering and workflow orchestration capabilities.
 */

import { ToolDefinition } from '../types';

export const WORKFLOW_TOOLS: ToolDefinition[] = [
  // Feature #1218: MCP tool batch-trigger-tests - Trigger multiple test suites at once
  {
    name: 'batch_trigger_tests',
    description: 'Trigger multiple test suites at once. Executes all specified suites concurrently and returns an array of run IDs that can be used to track progress. Use stream_test_run to monitor each run.',
    inputSchema: {
      type: 'object',
      properties: {
        suite_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of test suite IDs to execute (required)',
          minItems: 1,
          maxItems: 50,
        },
        browser: {
          type: 'string',
          enum: ['chromium', 'firefox', 'webkit'],
          description: 'Browser to use for all test runs (default: chromium)',
        },
        branch: {
          type: 'string',
          description: 'Git branch to run tests against (applies to all suites)',
        },
        env: {
          type: 'string',
          enum: ['development', 'staging', 'production'],
          description: 'Target environment for all test runs',
        },
        base_url: {
          type: 'string',
          description: 'Base URL for tests (overrides environment default, applies to all suites)',
        },
        parallel: {
          type: 'boolean',
          description: 'Run tests within each suite in parallel (default: true)',
        },
        retries: {
          type: 'number',
          description: 'Number of retries for failed tests (default: 0)',
        },
        continue_on_failure: {
          type: 'boolean',
          description: 'Continue triggering remaining suites if one fails to start (default: true)',
        },
      },
      required: ['suite_ids'],
    },
  },
  // Feature #1426: Removed create_workflow, execute_workflow, schedule_workflow tools
  // Users have CI/CD systems (GitHub Actions, Jenkins) for workflow orchestration
  // Use batch_trigger_tests above for running multiple suites at once
];

export const WORKFLOW_TOOL_NAMES = WORKFLOW_TOOLS.map(t => t.name);
