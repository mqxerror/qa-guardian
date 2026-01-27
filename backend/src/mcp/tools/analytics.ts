/**
 * Analytics Tools Module
 *
 * Tools for dashboard summaries, project analytics, quality metrics, and data analysis.
 * Report generation tools are in reporting.ts
 */

import { ToolDefinition } from '../types';

export const ANALYTICS_TOOLS: ToolDefinition[] = [
  // Feature #994: Get dashboard summary MCP tool
  {
    name: 'get_dashboard_summary',
    description: 'Get a comprehensive dashboard summary for the organization. Includes project counts, test statistics, pass rates, recent activity, and health metrics.',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['24h', '7d', '30d', '90d'],
          description: 'Time period for statistics (default: 7d)',
        },
        include_trends: {
          type: 'boolean',
          description: 'Include trend data comparing to previous period (default: true)',
        },
        include_top_failures: {
          type: 'boolean',
          description: 'Include list of top failing tests (default: true)',
        },
        include_recent_runs: {
          type: 'boolean',
          description: 'Include recent test runs (default: true)',
        },
      },
    },
  },
  // Feature #995: Get project analytics MCP tool
  {
    name: 'get_project_analytics',
    description: 'Get detailed analytics for a specific project including trends, test breakdown, and failure analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to get analytics for',
        },
        period: {
          type: 'string',
          enum: ['7d', '14d', '30d', '90d'],
          description: 'Time period for analytics (default: 30d)',
        },
        include_suite_breakdown: {
          type: 'boolean',
          description: 'Include breakdown by test suite (default: true)',
        },
        include_failure_analysis: {
          type: 'boolean',
          description: 'Include detailed failure analysis (default: true)',
        },
        include_flakiness_report: {
          type: 'boolean',
          description: 'Include test flakiness analysis (default: true)',
        },
        include_duration_analysis: {
          type: 'boolean',
          description: 'Include test duration trends (default: true)',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #997: Get failing tests MCP tool
  {
    name: 'get_failing_tests',
    description: 'List consistently failing tests for a project with failure counts and error details. Helps prioritize test fixes.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to get failing tests for',
        },
        min_failure_count: {
          type: 'number',
          description: 'Minimum number of failures to include (default: 2)',
        },
        period: {
          type: 'string',
          enum: ['7d', '14d', '30d', '90d'],
          description: 'Time period to analyze (default: 30d)',
        },
        include_only_consecutive: {
          type: 'boolean',
          description: 'Only include tests that are currently failing consecutively (default: false)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of failing tests to return (default: 20)',
        },
        include_error_details: {
          type: 'boolean',
          description: 'Include error messages and stack traces (default: true)',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #998: Get test coverage MCP tool
  {
    name: 'get_test_coverage',
    description: 'Get test coverage metrics for a project including coverage percentage and uncovered areas. Analyzes test distribution across features and pages.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to get coverage for',
        },
        include_breakdown: {
          type: 'boolean',
          description: 'Include breakdown by suite and test type (default: true)',
        },
        include_gaps: {
          type: 'boolean',
          description: 'Include analysis of coverage gaps (default: true)',
        },
        target_coverage: {
          type: 'number',
          description: 'Target coverage percentage for comparison (default: 80)',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #999: Get quality score MCP tool
  {
    name: 'get_quality_score',
    description: 'Get an overall quality health score (0-100) for a project based on test pass rates, coverage, performance, and stability.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to get quality score for',
        },
        period: {
          type: 'string',
          enum: ['7d', '14d', '30d'],
          description: 'Time period for analysis (default: 30d)',
        },
        include_history: {
          type: 'boolean',
          description: 'Include quality score history/trend (default: true)',
        },
        include_component_details: {
          type: 'boolean',
          description: 'Include detailed component breakdowns (default: true)',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #1002: Get team metrics MCP tool
  {
    name: 'get_team_metrics',
    description: 'Get team productivity metrics showing tests created, runs triggered, and activity per team member. Useful for understanding team contribution and activity levels.',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['7d', '14d', '30d', '90d'],
          description: 'Time period for metrics (default: 30d)',
        },
        include_trends: {
          type: 'boolean',
          description: 'Include trend comparison with previous period (default: true)',
        },
        include_activity: {
          type: 'boolean',
          description: 'Include daily activity breakdown (default: true)',
        },
      },
    },
  },
  // Feature #1003: Get browser analytics MCP tool
  {
    name: 'get_browser_analytics',
    description: 'Get browser-specific analytics showing pass rates, failure patterns, and performance metrics per browser (Chromium, Firefox, WebKit). Useful for identifying browser-specific issues.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to analyze browser metrics for',
        },
        period: {
          type: 'string',
          enum: ['7d', '14d', '30d', '90d'],
          description: 'Time period for analysis (default: 30d)',
        },
        include_failures: {
          type: 'boolean',
          description: 'Include browser-specific failure breakdown (default: true)',
        },
        include_performance: {
          type: 'boolean',
          description: 'Include per-browser performance metrics (default: true)',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #1004: Get execution time analytics MCP tool
  {
    name: 'get_execution_time_analytics',
    description: 'Analyze test execution times to identify slowest tests, average durations, and time trends. Helps optimize test suite performance and identify bottlenecks.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to analyze execution times for',
        },
        period: {
          type: 'string',
          enum: ['7d', '14d', '30d', '90d'],
          description: 'Time period for analysis (default: 30d)',
        },
        include_slowest: {
          type: 'boolean',
          description: 'Include list of slowest tests (default: true)',
        },
        include_trends: {
          type: 'boolean',
          description: 'Include execution time trends over the period (default: true)',
        },
        slowest_limit: {
          type: 'number',
          description: 'Number of slowest tests to return (default: 10)',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #1005: Get failure categories MCP tool
  {
    name: 'get_failure_categories',
    description: 'Get categorized test failures for a project. Groups failures by type (timeout, assertion, element not found, network, etc.) with counts and examples. Helps identify patterns in test failures.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to analyze failures for',
        },
        period: {
          type: 'string',
          enum: ['7d', '14d', '30d', '90d'],
          description: 'Time period to analyze (default: 30d)',
        },
        include_examples: {
          type: 'boolean',
          description: 'Include example failures for each category (default: true)',
        },
        examples_limit: {
          type: 'number',
          description: 'Maximum number of examples per category (default: 3)',
        },
        min_count: {
          type: 'number',
          description: 'Minimum failure count to include a category (default: 1)',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #1006: Get release quality MCP tool
  {
    name: 'get_release_quality',
    description: 'Assess quality of a release candidate. Analyzes test results, identifies regressions, calculates risk score, and provides release readiness recommendation.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to assess',
        },
        release_tag: {
          type: 'string',
          description: 'The release tag or version (e.g., v1.2.0, release-2024-01)',
        },
        compare_to: {
          type: 'string',
          description: 'Previous release tag to compare against (optional, uses last release if not specified)',
        },
        include_regressions: {
          type: 'boolean',
          description: 'Include list of identified regressions (default: true)',
        },
        include_new_tests: {
          type: 'boolean',
          description: 'Include list of new tests added (default: true)',
        },
        risk_threshold: {
          type: 'number',
          description: 'Risk score threshold for release approval (0-100, default: 30)',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #1007: Compare releases MCP tool
  {
    name: 'compare_releases',
    description: 'Compare quality metrics between two releases or time periods. Shows improvements, regressions, and overall quality trend.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to compare releases for',
        },
        release_a: {
          type: 'string',
          description: 'First release tag or period (e.g., v1.1.0 or "last_week")',
        },
        release_b: {
          type: 'string',
          description: 'Second release tag or period (e.g., v1.2.0 or "current")',
        },
        include_details: {
          type: 'boolean',
          description: 'Include detailed test-level comparison (default: true)',
        },
        include_performance: {
          type: 'boolean',
          description: 'Include execution time comparison (default: true)',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #1013: get_anomalies - REMOVED (Feature #1416 - Enterprise ML not needed for SMB)
];

export const ANALYTICS_TOOL_NAMES = ANALYTICS_TOOLS.map(t => t.name);
