/**
 * Performance Testing Tools
 *
 * MCP tools for Lighthouse audits, performance budgets, and load testing (K6).
 */

import { ToolDefinition } from '../types';

export const PERFORMANCE_TOOLS: ToolDefinition[] = [
  // Lighthouse / Performance Audits
  {
    name: 'run_lighthouse_audit',
    description: 'Trigger a Lighthouse performance audit on an existing performance test. Returns audit scores for performance, accessibility, best practices, and SEO.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of a Lighthouse/performance test to run',
        },
        device: {
          type: 'string',
          enum: ['desktop', 'mobile'],
          description: 'Device preset for the audit (default: desktop)',
        },
        wait_for_completion: {
          type: 'boolean',
          description: 'Wait for the audit to complete before returning (default: true)',
        },
      },
      required: ['test_id'],
    },
  },
  {
    name: 'get_lighthouse_results',
    description: 'Get Lighthouse audit results for a completed test run. Returns scores, Core Web Vitals, and recommendations for improving performance.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of a completed Lighthouse test run',
        },
        test_id: {
          type: 'string',
          description: 'Optional: Specific test ID within the run',
        },
        include_opportunities: {
          type: 'boolean',
          description: 'Include performance improvement opportunities (default: true)',
        },
        include_diagnostics: {
          type: 'boolean',
          description: 'Include diagnostic information (default: true)',
        },
        include_passed_audits: {
          type: 'boolean',
          description: 'Include audits that passed (default: false)',
        },
      },
      required: ['run_id'],
    },
  },
  {
    name: 'get_performance_trends',
    description: 'Get Lighthouse performance trends over time for a project or test. Returns historical score data to track performance improvements or regressions.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to get performance trends for',
        },
        test_id: {
          type: 'string',
          description: 'Optional: Specific test ID to filter trends',
        },
        start_date: {
          type: 'string',
          description: 'Start date (ISO 8601 format)',
        },
        end_date: {
          type: 'string',
          description: 'End date (ISO 8601 format)',
        },
        interval: {
          type: 'string',
          enum: ['day', 'week', 'month'],
          description: 'Aggregation interval for trend data (default: day)',
        },
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific metrics to include (default: all)',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'set_performance_budget',
    description: 'Configure performance budgets for a project. Lighthouse tests will fail if metrics exceed these budgets.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to set budgets for',
        },
        budgets: {
          type: 'object',
          description: 'Performance budget thresholds (lcp_ms, cls, fid_ms, fcp_ms, tti_ms, tbt_ms, performance_score)',
        },
        apply_to_tests: {
          type: 'boolean',
          description: 'Apply budgets to existing Lighthouse tests (default: true)',
        },
      },
      required: ['project_id', 'budgets'],
    },
  },
  {
    name: 'get_budget_violations',
    description: 'List performance budget violations for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to check',
        },
        test_id: {
          type: 'string',
          description: 'Optional: Specific test ID to check',
        },
        run_id: {
          type: 'string',
          description: 'Optional: Specific run ID to check',
        },
        include_warnings: {
          type: 'boolean',
          description: 'Include near-threshold warnings (default: true)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of recent runs to check (default: 5)',
        },
      },
      required: ['project_id'],
    },
  },

  // K6 Load Testing
  {
    name: 'run_k6_test',
    description: 'Trigger a K6 load test execution.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of a K6/load test to run',
        },
        script_id: {
          type: 'string',
          description: 'Alternative: ID of a saved K6 script to run',
        },
        virtual_users: {
          type: 'number',
          description: 'Number of virtual users (VUs) to simulate (default: 10)',
        },
        duration_seconds: {
          type: 'number',
          description: 'Test duration in seconds (default: 30)',
        },
        ramp_up_seconds: {
          type: 'number',
          description: 'Time to ramp up to full VU count (default: 0)',
        },
        wait_for_completion: {
          type: 'boolean',
          description: 'Wait for the test to complete (default: false)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_k6_results',
    description: 'Get K6 load test results for a completed test run.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of a completed K6 test run',
        },
        include_breakdown: {
          type: 'boolean',
          description: 'Include response time breakdown (default: true)',
        },
        include_errors: {
          type: 'boolean',
          description: 'Include error details (default: true)',
        },
        include_checks: {
          type: 'boolean',
          description: 'Include check results (default: true)',
        },
      },
      required: ['run_id'],
    },
  },
  {
    name: 'get_load_trends',
    description: 'Get load test performance trends over time for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID',
        },
        test_id: {
          type: 'string',
          description: 'Optional: Specific test ID to filter',
        },
        start_date: {
          type: 'string',
          description: 'Start date (ISO 8601)',
        },
        end_date: {
          type: 'string',
          description: 'End date (ISO 8601)',
        },
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Metrics to include (rps, response_time, errors, etc.)',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'set_load_thresholds',
    description: 'Configure load test thresholds for a project. Tests will fail if metrics exceed these thresholds.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID',
        },
        thresholds: {
          type: 'object',
          description: 'Load test thresholds (max_response_time_p95, max_error_rate, min_rps, etc.)',
        },
        apply_to_tests: {
          type: 'boolean',
          description: 'Apply to existing K6 tests (default: true)',
        },
      },
      required: ['project_id', 'thresholds'],
    },
  },
  {
    name: 'cancel_load_test',
    description: 'Cancel a running load test.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the running load test',
        },
        reason: {
          type: 'string',
          description: 'Optional reason for cancellation',
        },
      },
      required: ['run_id'],
    },
  },
  {
    name: 'compare_load_runs',
    description: 'Compare two load test runs to identify performance regressions or improvements.',
    inputSchema: {
      type: 'object',
      properties: {
        base_run_id: {
          type: 'string',
          description: 'The baseline run ID',
        },
        compare_run_id: {
          type: 'string',
          description: 'The run ID to compare against',
        },
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Metrics to compare',
        },
      },
      required: ['base_run_id', 'compare_run_id'],
    },
  },
  {
    name: 'save_k6_script',
    description: 'Save a K6 script for reuse.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID',
        },
        name: {
          type: 'string',
          description: 'Name for the script',
        },
        description: {
          type: 'string',
          description: 'Description of the script',
        },
        script: {
          type: 'string',
          description: 'The K6 script content (JavaScript)',
        },
        default_options: {
          type: 'object',
          description: 'Default options (vus, duration, thresholds)',
        },
      },
      required: ['project_id', 'name', 'script'],
    },
  },
  {
    name: 'list_k6_scripts',
    description: 'List saved K6 scripts for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of scripts to return (default: 50)',
        },
      },
      required: ['project_id'],
    },
  },
];

// List of performance tool names for handler mapping
export const PERFORMANCE_TOOL_NAMES = PERFORMANCE_TOOLS.map(t => t.name);
