/**
 * Flaky Tests Tools Module
 *
 * Tools for detecting, managing, and analyzing flaky tests.
 * Includes quarantine functionality and AI-powered fix suggestions.
 */

import { ToolDefinition } from '../types';

export const FLAKY_TESTS_TOOLS: ToolDefinition[] = [
  // Feature #996: Get flaky tests MCP tool
  {
    name: 'get_flaky_tests',
    description: 'List flaky tests for a project with flakiness scores and failure patterns. Helps identify and prioritize unstable tests.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to get flaky tests for',
        },
        min_flakiness_score: {
          type: 'number',
          description: 'Minimum flakiness score (0-100) to include (default: 20)',
        },
        period: {
          type: 'string',
          enum: ['7d', '14d', '30d', '90d'],
          description: 'Time period to analyze (default: 30d)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of flaky tests to return (default: 20)',
        },
        include_patterns: {
          type: 'boolean',
          description: 'Include failure pattern analysis (default: true)',
        },
        include_recent_runs: {
          type: 'boolean',
          description: 'Include recent run history for each test (default: true)',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #1109: Quarantine test MCP tool
  {
    name: 'quarantine_test',
    description: 'Quarantine a flaky test to exclude it from CI failures. The test will still run but its failures won\'t block the build.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of the test to quarantine',
        },
        reason: {
          type: 'string',
          description: 'Reason for quarantining the test (e.g., "Flaky - investigating race condition")',
        },
      },
      required: ['test_id'],
    },
  },
  // Feature #1110: Unquarantine test MCP tool
  {
    name: 'unquarantine_test',
    description: 'Release a test from quarantine to resume normal CI behavior. The test failures will block builds again.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of the test to release from quarantine',
        },
      },
      required: ['test_id'],
    },
  },
  // Feature #1110: Get flakiness trends MCP tool
  {
    name: 'get_flakiness_trends',
    description: 'Get historical flakiness trends for a test including daily scores and related commits. Helps understand when and why a test became flaky.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of the test to get flakiness trends for',
        },
        period: {
          type: 'string',
          enum: ['7d', '14d', '30d', '90d'],
          description: 'Time period to analyze (default: 30d)',
        },
        include_commits: {
          type: 'boolean',
          description: 'Include related commits that may have caused flakiness changes (default: true)',
        },
      },
      required: ['test_id'],
    },
  },
  // Feature #1111: Suggest flaky fixes MCP tool
  {
    name: 'suggest_flaky_fixes',
    description: 'Get AI-powered fix suggestions for a flaky test. Analyzes failure patterns and provides actionable code fixes with confidence scores.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of the flaky test to get fix suggestions for',
        },
        include_code_examples: {
          type: 'boolean',
          description: 'Include before/after code examples for each suggestion (default: true)',
        },
        max_suggestions: {
          type: 'number',
          description: 'Maximum number of suggestions to return (default: 5)',
        },
      },
      required: ['test_id'],
    },
  },
];

export const FLAKY_TESTS_TOOL_NAMES = FLAKY_TESTS_TOOLS.map(t => t.name);
