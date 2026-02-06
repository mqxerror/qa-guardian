/**
 * Test Results Tools
 *
 * MCP tools for retrieving and analyzing test results.
 */

import { ToolDefinition } from '../types';

export const TEST_RESULTS_TOOLS: ToolDefinition[] = [
  // Feature #1429: Unified get_result tool replaces get_test_results, get_result_details, get_result_timeline
  {
    name: 'get_result',
    description: 'Get test results from a run. Can return all results for a run, or detailed info for a specific test including timeline and artifacts.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run (required)',
        },
        test_id: {
          type: 'string',
          description: 'Specific test ID for detailed results (optional)',
        },
        status: {
          type: 'string',
          enum: ['passed', 'failed', 'skipped', 'all'],
          description: 'Filter results by status (default: all)',
        },
        include: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['steps', 'errors', 'timeline', 'artifacts', 'analysis'],
          },
          description: 'Additional data to include: steps (step details), errors (stack traces), timeline (step durations), artifacts (screenshots/videos), analysis (AI analysis)',
        },
        bottleneck_threshold_ms: {
          type: 'number',
          description: 'For timeline: flag steps slower than this as bottlenecks (default: 1000ms)',
        },
      },
      required: ['run_id'],
    },
  },
  // Feature #1429: Removed get_test_results - use get_result
  // Feature #1429: Removed get_result_details - use get_result with test_id and include=["steps", "errors", "artifacts"]
  {
    name: 'search_results',
    description: 'Search across all test results by error message, test name, status, or other criteria. Returns matching results with relevance ranking.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query string (searches error messages, test names, and step values)',
        },
        status: {
          type: 'string',
          enum: ['passed', 'failed', 'error', 'skipped'],
          description: 'Filter by result status',
        },
        project_id: {
          type: 'string',
          description: 'Filter to a specific project',
        },
        suite_id: {
          type: 'string',
          description: 'Filter to a specific test suite',
        },
        from_date: {
          type: 'string',
          description: 'Filter results from this date (ISO 8601 format)',
        },
        to_date: {
          type: 'string',
          description: 'Filter results to this date (ISO 8601 format)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 20, max: 100)',
        },
      },
    },
  },
  {
    name: 'get_failure_patterns',
    description: 'Identify common failure patterns across test results. Returns categorized patterns with frequency, affected tests, and fix suggestions.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Filter patterns to a specific project (optional)',
        },
        suite_id: {
          type: 'string',
          description: 'Filter patterns to a specific test suite (optional)',
        },
        days: {
          type: 'number',
          description: 'Number of days to analyze (default: 30, max: 365)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of patterns to return (default: 10, max: 50)',
        },
        min_frequency: {
          type: 'number',
          description: 'Minimum frequency to include pattern (default: 1)',
        },
      },
    },
  },
  // Feature #1433: Removed mark_result_reviewed - collaboration feature for humans via UI
  {
    name: 'get_review_status',
    description: 'Get the review status for a test result. Shows if result has been reviewed, by whom, and any notes.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run',
        },
        test_id: {
          type: 'string',
          description: 'The ID of the test',
        },
        result_id: {
          type: 'string',
          description: 'The ID of the test result (format: runId-testId). Alternative to run_id + test_id.',
        },
      },
    },
  },
  // Feature #1435: Removed export_results - use export_data with type=results
  {
    name: 'get_result_diff',
    description: 'Compare two test results and highlight differences. Shows timing changes, step changes, status changes, and error differences.',
    inputSchema: {
      type: 'object',
      properties: {
        base_result_id: {
          type: 'string',
          description: 'The ID of the base result (format: runId-testId or standalone result ID)',
        },
        compare_result_id: {
          type: 'string',
          description: 'The ID of the result to compare against (format: runId-testId or standalone result ID)',
        },
        include_steps: {
          type: 'boolean',
          description: 'Include step-by-step diff comparison (default: true)',
        },
      },
      required: ['base_result_id', 'compare_result_id'],
    },
  },
  // Feature #1433: Removed annotate_result - collaboration feature for humans via UI
  {
    name: 'get_annotations',
    description: 'Get all annotations for a test result.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run',
        },
        test_id: {
          type: 'string',
          description: 'The ID of the test within the run',
        },
        result_id: {
          type: 'string',
          description: 'Alternative: Combined result ID (format: runId-testId)',
        },
      },
    },
  },
  // Feature #1433: Removed share_result - collaboration feature for humans via UI
  // Feature #1429: Removed get_result_timeline - use get_result with test_id and include=["timeline"]
  {
    name: 'compare_runs',
    description: 'Compare two test runs to identify regressions, improvements, and differences.',
    inputSchema: {
      type: 'object',
      properties: {
        base_run_id: {
          type: 'string',
          description: 'The ID of the base run to compare from',
        },
        compare_run_id: {
          type: 'string',
          description: 'The ID of the run to compare against',
        },
        include_timing: {
          type: 'boolean',
          description: 'Include timing comparison (default: true)',
        },
      },
      required: ['base_run_id', 'compare_run_id'],
    },
  },
  {
    name: 'get_run_metrics',
    description: 'Get aggregated metrics for a test run including timing, pass rate, and resource usage.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run',
        },
      },
      required: ['run_id'],
    },
  },
  // Additional test results tools
  {
    name: 'create_bug_report',
    description: 'Generate a structured bug report from a test failure. Includes error details, steps to reproduce, screenshots, and trace information.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run',
        },
        test_id: {
          type: 'string',
          description: 'The ID of the test',
        },
        result_id: {
          type: 'string',
          description: 'The ID of the test result (format: runId-testId). Alternative to run_id + test_id.',
        },
        format: {
          type: 'string',
          enum: ['json', 'markdown'],
          description: 'Output format for the bug report (default: markdown)',
        },
        include_screenshots: {
          type: 'boolean',
          description: 'Include screenshot URLs in the report (default: true)',
        },
        include_trace: {
          type: 'boolean',
          description: 'Include trace file information in the report (default: true)',
        },
        additional_context: {
          type: 'string',
          description: 'Additional context or notes to include in the bug report',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_error_stacktrace',
    description: 'Get formatted error stack trace for a failed test result. Returns parsed stack frames with source mapping and highlighted relevant lines.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run',
        },
        test_id: {
          type: 'string',
          description: 'The ID of the test',
        },
        result_id: {
          type: 'string',
          description: 'The ID of the test result (format: runId-testId). Alternative to run_id + test_id.',
        },
        include_source_context: {
          type: 'boolean',
          description: 'Include surrounding source code lines for each stack frame (default: true)',
        },
        context_lines: {
          type: 'number',
          description: 'Number of source code lines to include before/after error line (default: 3)',
        },
      },
      required: [],
    },
  },
];

// List of test results tool names for handler mapping
export const TEST_RESULTS_TOOL_NAMES = TEST_RESULTS_TOOLS.map(t => t.name);
