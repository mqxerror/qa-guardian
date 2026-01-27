/**
 * QA Guardian MCP Tool Definitions - Part 2A
 * Feature #1356: Split for code quality compliance
 * Contains: K6 Load Testing, Accessibility, Analytics
 */

// Tool input schema type
interface ToolInputSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

// Tool definition type
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
}

// Part 2A: K6 Load Testing, Accessibility, Analytics
export const TOOLS_PART2A: ToolDefinition[] = [
  // Feature #979: Run K6 load test MCP tool
  {
    name: 'run_k6_test',
    description: 'Trigger a K6 load test execution. Starts the test and optionally waits for completion.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of a K6/load test to run (must be test_type=load)',
        },
        script_id: {
          type: 'string',
          description: 'Alternative: ID of a saved K6 script to run',
        },
        virtual_users: {
          type: 'number',
          description: 'Number of virtual users (VUs) to simulate (default: from test config or 10)',
          minimum: 1,
          maximum: 1000,
        },
        duration_seconds: {
          type: 'number',
          description: 'Test duration in seconds (default: from test config or 30)',
          minimum: 1,
          maximum: 3600,
        },
        ramp_up_seconds: {
          type: 'number',
          description: 'Time in seconds to ramp up to full VU count (default: 0)',
          minimum: 0,
        },
        wait_for_completion: {
          type: 'boolean',
          description: 'Wait for the test to complete before returning (default: false for load tests)',
        },
        environment: {
          type: 'object',
          description: 'Environment variables to pass to the K6 script',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['test_id'],
    },
  },
  // Feature #980: Get K6 results MCP tool
  {
    name: 'get_k6_results',
    description: 'Get detailed K6 load test results for a completed test run. Returns metrics, percentiles, and threshold results.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of a completed K6/load test run',
        },
        test_id: {
          type: 'string',
          description: 'Optional: Specific test ID within the run (if run contains multiple tests)',
        },
        include_checks: {
          type: 'boolean',
          description: 'Include K6 check results (default: true)',
        },
        include_http_metrics: {
          type: 'boolean',
          description: 'Include detailed HTTP metrics (default: true)',
        },
        include_custom_metrics: {
          type: 'boolean',
          description: 'Include custom metrics defined in the K6 script (default: true)',
        },
      },
      required: ['run_id'],
    },
  },
  // Feature #981: Get K6 progress MCP tool
  {
    name: 'get_k6_progress',
    description: 'Monitor a running K6 load test in real-time. Returns current metrics including VU count, requests per second, and error rate.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of a running K6/load test run',
        },
        test_id: {
          type: 'string',
          description: 'Optional: Specific test ID within the run',
        },
        include_recent_errors: {
          type: 'boolean',
          description: 'Include recent error messages (default: true)',
        },
      },
      required: ['run_id'],
    },
  },
  // Feature #982: Stop K6 test MCP tool
  {
    name: 'stop_k6_test',
    description: 'Stop a running K6 load test. Partial results collected up to the stop point are saved.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the running K6/load test run to stop',
        },
        reason: {
          type: 'string',
          description: 'Optional reason for stopping the test (e.g., "high error rate detected")',
        },
        save_partial_results: {
          type: 'boolean',
          description: 'Save partial results collected up to this point (default: true)',
        },
      },
      required: ['run_id'],
    },
  },
  // Feature #983: Create K6 script MCP tool
  {
    name: 'create_k6_script',
    description: 'Generate a K6 load test script based on configuration. Supports various test types including simple load, stress, spike, and soak tests.',
    inputSchema: {
      type: 'object',
      properties: {
        target_url: {
          type: 'string',
          description: 'The target URL to test (e.g., "https://api.example.com/endpoint")',
        },
        test_type: {
          type: 'string',
          enum: ['simple', 'stress', 'spike', 'soak', 'breakpoint'],
          description: 'Type of load test: simple (basic load), stress (gradually increasing), spike (sudden surge), soak (long duration), breakpoint (find limits)',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          description: 'HTTP method to use (default: GET)',
        },
        headers: {
          type: 'object',
          description: 'Custom HTTP headers to include',
          additionalProperties: { type: 'string' },
        },
        body: {
          type: 'string',
          description: 'Request body for POST/PUT/PATCH requests (JSON string)',
        },
        virtual_users: {
          type: 'number',
          description: 'Number of virtual users (default: 10)',
        },
        duration_seconds: {
          type: 'number',
          description: 'Test duration in seconds (default: 30)',
        },
        ramp_up_seconds: {
          type: 'number',
          description: 'Time to ramp up to target VUs (default: 0)',
        },
        thresholds: {
          type: 'object',
          description: 'Performance thresholds (e.g., {"http_req_duration": ["p(95)<500"]})',
          additionalProperties: { type: 'array', items: { type: 'string' } },
        },
        checks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              condition: { type: 'string' },
            },
          },
          description: 'Custom checks to add (e.g., [{"name": "status is 200", "condition": "res.status === 200"}])',
        },
        include_think_time: {
          type: 'boolean',
          description: 'Add random think time between requests (default: true for realistic tests)',
        },
        save_to_project: {
          type: 'string',
          description: 'Optional project ID to save the script to',
        },
      },
      required: ['target_url', 'test_type'],
    },
  },
  // Feature #984: Update K6 script MCP tool
  {
    name: 'update_k6_script',
    description: 'Modify an existing K6 load test script. Can update the script content, configuration, or specific sections.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of the test containing the K6 script to update',
        },
        script: {
          type: 'string',
          description: 'Complete new K6 script content (replaces existing script)',
        },
        modifications: {
          type: 'object',
          description: 'Partial modifications to apply to the existing script',
          properties: {
            target_url: {
              type: 'string',
              description: 'New target URL to test',
            },
            method: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
              description: 'New HTTP method',
            },
            headers: {
              type: 'object',
              description: 'New HTTP headers (replaces existing)',
              additionalProperties: { type: 'string' },
            },
            body: {
              type: 'string',
              description: 'New request body for POST/PUT/PATCH',
            },
            virtual_users: {
              type: 'number',
              description: 'New number of virtual users',
            },
            duration_seconds: {
              type: 'number',
              description: 'New test duration in seconds',
            },
            thresholds: {
              type: 'object',
              description: 'New performance thresholds',
              additionalProperties: { type: 'array', items: { type: 'string' } },
            },
            checks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  condition: { type: 'string' },
                },
              },
              description: 'New custom checks to add',
            },
          },
        },
        validate: {
          type: 'boolean',
          description: 'Validate script syntax before saving (default: true)',
        },
        name: {
          type: 'string',
          description: 'Optionally update the test name',
        },
      },
      required: ['test_id'],
    },
  },
  // Feature #985: Get K6 templates MCP tool
  {
    name: 'get_k6_templates',
    description: 'List available K6 load test script templates. Use these as starting points for creating custom load tests.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['all', 'http', 'websocket', 'grpc', 'browser', 'scenario'],
          description: 'Filter templates by category (default: all)',
        },
        include_script: {
          type: 'boolean',
          description: 'Include full script content in response (default: false, only metadata)',
        },
      },
    },
  },
  // Feature #986: Get load test trends MCP tool
  {
    name: 'get_load_test_trends',
    description: 'View load test trends over time for a project. Shows response times, throughput, and error rates across multiple test runs.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to get trends for',
        },
        test_id: {
          type: 'string',
          description: 'Optional: specific test ID to get trends for',
        },
        period: {
          type: 'string',
          enum: ['7d', '14d', '30d', '90d'],
          description: 'Time period for trend data (default: 30d)',
        },
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific metrics to include (default: all). Options: response_time, throughput, error_rate, vus, duration',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #987: Compare load tests MCP tool
  {
    name: 'compare_load_tests',
    description: 'Compare two load test runs to identify performance differences. Useful for regression testing and validating optimizations.',
    inputSchema: {
      type: 'object',
      properties: {
        baseline_run_id: {
          type: 'string',
          description: 'The run ID to use as baseline (typically the older/reference run)',
        },
        comparison_run_id: {
          type: 'string',
          description: 'The run ID to compare against baseline (typically the newer run)',
        },
        threshold_percent: {
          type: 'number',
          description: 'Percentage threshold for flagging significant differences (default: 10)',
        },
      },
      required: ['baseline_run_id', 'comparison_run_id'],
    },
  },
  // Feature #988: Run accessibility scan MCP tool
  {
    name: 'run_accessibility_scan',
    description: 'Trigger an accessibility audit using axe-core. Scans a URL for WCAG compliance issues and returns violations categorized by severity.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to scan for accessibility issues',
        },
        wcag_level: {
          type: 'string',
          enum: ['A', 'AA', 'AAA'],
          description: 'WCAG conformance level to test against (default: AA)',
        },
        include_best_practices: {
          type: 'boolean',
          description: 'Include best practice checks beyond WCAG requirements (default: true)',
        },
        include_experimental: {
          type: 'boolean',
          description: 'Include experimental accessibility rules (default: false)',
        },
        wait_for_selector: {
          type: 'string',
          description: 'CSS selector to wait for before running scan (for dynamic content)',
        },
        project_id: {
          type: 'string',
          description: 'Optional project ID to associate the scan with',
        },
        test_name: {
          type: 'string',
          description: 'Optional name for the accessibility test (auto-generated if not provided)',
        },
      },
      required: ['url'],
    },
  },
  // Feature #989: Get accessibility results MCP tool
  {
    name: 'get_accessibility_results',
    description: 'Get detailed accessibility scan results including violations, severity levels, and remediation guidance. Use after running an accessibility scan.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The run ID from an accessibility scan',
        },
        test_id: {
          type: 'string',
          description: 'The test ID of an accessibility test (alternative to run_id - gets latest run)',
        },
        severity_filter: {
          type: 'string',
          enum: ['critical', 'serious', 'moderate', 'minor', 'all'],
          description: 'Filter violations by severity level (default: all)',
        },
        include_passing: {
          type: 'boolean',
          description: 'Include passing rules in results (default: false)',
        },
        include_remediation: {
          type: 'boolean',
          description: 'Include detailed remediation guidance for violations (default: true)',
        },
      },
    },
  },
  // Feature #990: Get accessibility trends MCP tool
  {
    name: 'get_accessibility_trends',
    description: 'Get accessibility score and violation trends over time for a project or specific test. Useful for tracking accessibility improvements.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to get trends for',
        },
        test_id: {
          type: 'string',
          description: 'Optional specific test ID to get trends for',
        },
        period: {
          type: 'string',
          enum: ['7d', '14d', '30d', '90d'],
          description: 'Time period for trends (default: 30d)',
        },
        include_violation_breakdown: {
          type: 'boolean',
          description: 'Include breakdown of violations by rule over time (default: true)',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #1435: Removed export_accessibility_report - use export_data with type=accessibility
  // Feature #992: Get Core Web Vitals MCP tool
  {
    name: 'get_core_web_vitals',
    description: 'Get Core Web Vitals (LCP, FID/INP, CLS) for a URL. Can run a new Lighthouse audit or retrieve from existing test results.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to measure Core Web Vitals for',
        },
        test_id: {
          type: 'string',
          description: 'Existing Lighthouse test ID to get CWV from (alternative to url)',
        },
        run_id: {
          type: 'string',
          description: 'Specific run ID to get CWV from (alternative to url)',
        },
        device: {
          type: 'string',
          enum: ['mobile', 'desktop'],
          description: 'Device type to emulate (default: mobile - Google uses mobile-first)',
        },
        run_new_audit: {
          type: 'boolean',
          description: 'Run a new Lighthouse audit even if test_id provided (default: false)',
        },
      },
    },
  },
  // Feature #993: Schedule performance audit MCP tool
  {
    name: 'schedule_performance_audit',
    description: 'Schedule recurring Lighthouse performance audits for a URL. Creates automated monitoring for Core Web Vitals and performance metrics.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to monitor for performance',
        },
        test_id: {
          type: 'string',
          description: 'Existing Lighthouse test ID to schedule (alternative to url)',
        },
        frequency: {
          type: 'string',
          enum: ['hourly', 'daily', 'weekly', 'monthly'],
          description: 'How often to run the audit (default: daily)',
        },
        time_of_day: {
          type: 'string',
          description: 'Time to run daily/weekly/monthly audits in HH:MM format (default: 02:00)',
        },
        day_of_week: {
          type: 'number',
          description: 'Day of week for weekly audits (0=Sunday, 6=Saturday, default: 1=Monday)',
        },
        device: {
          type: 'string',
          enum: ['mobile', 'desktop', 'both'],
          description: 'Device type to test (default: both)',
        },
        alert_on_regression: {
          type: 'boolean',
          description: 'Send alerts when performance regresses (default: true)',
        },
        regression_threshold: {
          type: 'number',
          description: 'Percentage drop that triggers regression alert (default: 10)',
        },
        project_id: {
          type: 'string',
          description: 'Project to create schedule under (uses default if not specified)',
        },
        name: {
          type: 'string',
          description: 'Custom name for the schedule',
        },
      },
    },
  },
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
  // Feature #1435: Removed generate_report, export_analytics_csv - use export_data with type=report/analytics
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
  // Feature #1407: get_sla_report removed - enterprise bloat
  // Feature #1435: Removed schedule_report - scheduling via REST API for human oversight
  // Feature #1011: Get audit log MCP tool
  {
    name: 'get_audit_log',
    description: 'Retrieve audit log entries for the organization. Supports filtering by action type, user, and date range.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'delete', 'run', 'login', 'logout', 'invite', 'remove', 'all'],
          description: 'Filter by action type (default: all)',
        },
        user_id: {
          type: 'string',
          description: 'Filter by user ID',
        },
        user_email: {
          type: 'string',
          description: 'Filter by user email',
        },
        resource_type: {
          type: 'string',
          enum: ['project', 'suite', 'test', 'run', 'user', 'organization', 'api_key', 'schedule', 'all'],
          description: 'Filter by resource type (default: all)',
        },
        start_date: {
          type: 'string',
          description: 'Start date for log entries (ISO format)',
        },
        end_date: {
          type: 'string',
          description: 'End date for log entries (ISO format)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of entries to return (default: 100, max: 1000)',
        },
        offset: {
          type: 'number',
          description: 'Number of entries to skip for pagination (default: 0)',
        },
      },
    },
  },
  // Feature #1012: Get usage statistics MCP tool
  {
    name: 'get_usage_statistics',
    description: 'Get platform usage statistics including API calls, storage usage, execution minutes, and resource consumption.',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', '7d', '30d', '90d', 'mtd', 'ytd'],
          description: 'Time period for statistics (default: 30d)',
        },
        include_breakdown: {
          type: 'boolean',
          description: 'Include detailed breakdown by category (default: true)',
        },
        include_trends: {
          type: 'boolean',
          description: 'Include usage trends over time (default: true)',
        },
        include_quotas: {
          type: 'boolean',
          description: 'Include quota/limit information (default: true)',
        },
      },
    },
  },
  // Feature #1013: get_anomalies - REMOVED (Feature #1416 - Enterprise ML not needed for SMB)
  // Feature #1014: Get organization info MCP tool
  {
    name: 'get_organization_info',
    description: 'Get detailed information about the current organization including name, settings, member count, and plan details.',
    inputSchema: {
      type: 'object',
      properties: {
        include_members: {
          type: 'boolean',
          description: 'Include list of organization members (default: false)',
        },
        include_settings: {
          type: 'boolean',
          description: 'Include organization settings (default: true)',
        },
        include_usage: {
          type: 'boolean',
          description: 'Include usage statistics (default: true)',
        },
        include_integrations: {
          type: 'boolean',
          description: 'Include configured integrations (default: true)',
        },
      },
    },
  },
  // Feature #1015: Get team members MCP tool
  {
    name: 'get_team_members',
    description: 'List all organization members with their roles, status, and activity information.',
    inputSchema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          enum: ['owner', 'admin', 'developer', 'viewer', 'all'],
          description: 'Filter by role (default: all)',
        },
        status: {
          type: 'string',
          enum: ['active', 'pending', 'inactive', 'all'],
          description: 'Filter by status (default: all)',
        },
        include_activity: {
          type: 'boolean',
          description: 'Include recent activity for each member (default: false)',
        },
        include_permissions: {
          type: 'boolean',
          description: 'Include detailed permissions for each member (default: false)',
        },
      },
    },
  },
  // Feature #1424: Removed invite_member, update_member_role, remove_member tools
  // These are security-sensitive operations that require human judgment
  // and should only be available via REST API
  // Feature #1019: Get API keys MCP tool
  {
    name: 'get_api_keys',
    description: 'List all API keys for the organization with their scopes and usage information.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'revoked', 'expired', 'all'],
          description: 'Filter by key status (default: active)',
        },
        created_by: {
          type: 'string',
          description: 'Filter by creator user ID',
        },
        include_usage: {
          type: 'boolean',
          description: 'Include usage statistics for each key (default: true)',
        },
      },
    },
  },
  // Feature #1424: Removed create_api_key and revoke_api_key tools
  // These are security-sensitive operations that require human judgment
  // and should only be available via REST API
  // Feature #1023: Get integrations MCP tool
  {
    name: 'get_integrations',
    description: 'List all connected integrations (GitHub, Slack, webhooks) and their status for the organization.',
    inputSchema: {
      type: 'object',
      properties: {
        include_webhooks: {
          type: 'boolean',
          description: 'Include webhook configurations (default: true)',
        },
        include_github: {
          type: 'boolean',
          description: 'Include GitHub repository connections (default: true)',
        },
        include_slack: {
          type: 'boolean',
          description: 'Include Slack workspace connection (default: true)',
        },
        project_id: {
          type: 'string',
          description: 'Filter GitHub connections by project ID (optional)',
        },
      },
    },
  },
];
