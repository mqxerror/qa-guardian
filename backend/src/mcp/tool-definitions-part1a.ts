/**
 * QA Guardian MCP Tool Definitions - Part 1A
 * Feature #1356: Split for code quality compliance
 * Contains first half of core tools (Projects through Security)
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

// Part 1A: First half of core tools
export const TOOLS_PART1A: ToolDefinition[] = [
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
  // Feature #1428: Unified get_run tool replaces get_run_status, get_run_progress, get_run_logs, get_console_output, get_network_logs
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
          description: 'Data to include in response. Default: ["status", "progress"]. Options: status, progress, logs, console (requires test_id), network (requires test_id), results',
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
    name: 'get_test_artifacts',
    description: 'Get artifacts (screenshots, videos, logs) from a test run',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run',
        },
        artifact_type: {
          type: 'string',
          enum: ['screenshot', 'video', 'log', 'trace'],
          description: 'Type of artifact to retrieve',
        },
      },
      required: ['run_id'],
    },
  },
  // Feature #1427: Unified get_artifact tool replaces get_screenshots, get_screenshot_base64,
  // get_visual_comparison_image, and compare_screenshots
  {
    name: 'get_artifact',
    description: 'Get test artifacts (screenshots, videos, traces) from a test run. Supports multiple output formats. Use format="base64" for AI image analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run (required)',
        },
        test_id: {
          type: 'string',
          description: 'The ID of the specific test within the run',
        },
        type: {
          type: 'string',
          enum: ['screenshot', 'video', 'trace', 'diff', 'baseline'],
          description: 'Type of artifact to retrieve (default: screenshot)',
        },
        format: {
          type: 'string',
          enum: ['url', 'base64', 'metadata'],
          description: 'Output format: url returns download URLs, base64 returns encoded data for AI analysis, metadata returns info without content (default: url)',
        },
        step_index: {
          type: 'number',
          description: 'For screenshots: retrieve screenshot from a specific step index',
        },
        include_all: {
          type: 'boolean',
          description: 'For screenshots: include all screenshots (current, baseline, diff) in response (default: false)',
        },
      },
      required: ['run_id'],
    },
  },
  // Feature #1427: Removed get_screenshots - use get_artifact with type="screenshot"
  // Feature #1427: Removed get_screenshot_base64 - use get_artifact with type="screenshot", format="base64"
  // Feature #910: MCP tool search-results - AI agent can search across all test results
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
      required: [],
    },
  },
  // Feature #911: MCP tool get-failure-patterns - AI agent can identify common failure patterns
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
      required: [],
    },
  },
  // Feature #1433: Removed mark_result_reviewed - collaboration feature for humans via UI
  // Feature #912: MCP tool get-review-status - AI agent can get review status
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
      required: [],
    },
  },
  // Feature #913: MCP tool create-bug-report - AI agent can generate bug report from failure
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
  // Feature #1435: Unified export_data tool replaces export_results, export_analytics_csv, export_accessibility_report, generate_report
  {
    name: 'export_data',
    description: 'Export data in various formats. Replaces export_results, export_analytics_csv, export_accessibility_report, generate_report.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['results', 'analytics', 'accessibility', 'security', 'report'],
          description: 'Type of data to export (required)',
        },
        format: {
          type: 'string',
          enum: ['json', 'csv', 'html', 'pdf', 'junit'],
          description: 'Export format (default: json)',
        },
        project_id: {
          type: 'string',
          description: 'Project ID to export data for',
        },
        run_id: {
          type: 'string',
          description: 'Run ID for results export',
        },
        start_date: {
          type: 'string',
          description: 'Start date for export period (ISO format)',
        },
        end_date: {
          type: 'string',
          description: 'End date for export period (ISO format)',
        },
        include_details: {
          type: 'boolean',
          description: 'Include detailed data (default: true)',
        },
      },
      required: ['type'],
    },
  },
  // Feature #1435: Removed export_results - use export_data with type=results
  // Feature #915: MCP tool get-result-diff - AI agent can diff two test results
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
  // Feature #916: MCP tool get-annotations - Get annotations for a result
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
      required: [],
    },
  },
  // Feature #1433: Removed share_result - collaboration feature for humans via UI
  // Feature #1429: Removed get_result_timeline - use get_result with include=["timeline"]
  // Feature #909: MCP tool get-artifact-storage - AI agent can check artifact storage usage
  {
    name: 'get_artifact_storage',
    description: 'Get artifact storage usage information. Shows total storage used, storage limit, and per-project breakdown.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Filter to a specific project ID (optional, defaults to all projects)',
        },
        include_runs: {
          type: 'boolean',
          description: 'Include per-run storage breakdown (default: false, can be slow for many runs)',
        },
      },
      required: [],
    },
  },
  // Feature #908: MCP tool delete-artifacts - AI agent can delete old artifacts
  {
    name: 'delete_artifacts',
    description: 'Delete test artifacts (screenshots, videos, traces) for a test run. Returns details about deleted files and storage freed.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run',
        },
        test_id: {
          type: 'string',
          description: 'Delete artifacts only for a specific test ID (optional)',
        },
        artifact_types: {
          type: 'array',
          items: { type: 'string', enum: ['screenshots', 'videos', 'traces'] },
          description: 'Types of artifacts to delete (default: all types)',
        },
        older_than_days: {
          type: 'number',
          description: 'Only delete artifacts older than this many days (optional, for batch cleanup)',
        },
        dry_run: {
          type: 'boolean',
          description: 'If true, return what would be deleted without actually deleting (default: false)',
        },
      },
      required: ['run_id'],
    },
  },
  // Feature #907: MCP tool download-artifacts - AI agent can download all artifacts as zip
  {
    name: 'download_artifacts',
    description: 'Download all test artifacts (screenshots, videos, traces) for a test run as a zip file. Returns a download URL and manifest of included files.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run',
        },
        test_id: {
          type: 'string',
          description: 'Filter artifacts for a specific test ID (optional)',
        },
        include_screenshots: {
          type: 'boolean',
          description: 'Include screenshots in the zip (default: true)',
        },
        include_videos: {
          type: 'boolean',
          description: 'Include video recordings in the zip (default: true)',
        },
        include_traces: {
          type: 'boolean',
          description: 'Include Playwright trace files in the zip (default: true)',
        },
      },
      required: ['run_id'],
    },
  },
  // Feature #906: MCP tool get-error-stacktrace - AI agent can get formatted error stack trace
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
  // Feature #905: MCP tool analyze-failure - AI agent can get AI-analyzed failure reason
  {
    name: 'analyze_failure',
    description: 'Get AI-powered analysis of a test failure. Returns root cause analysis, fix recommendations, and related historical failures.',
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
        include_history: {
          type: 'boolean',
          description: 'Include analysis of historical failures for this test (default: true)',
        },
      },
      required: [],
    },
  },
  // Feature #904: MCP tool get-trace - AI agent can retrieve Playwright trace file
  {
    name: 'get_trace',
    description: 'Get Playwright trace file for a test result. Trace files can be viewed in Playwright Trace Viewer for debugging.',
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
      required: [],
    },
  },
  // Feature #903: MCP tool get-video - AI agent can retrieve test execution video
  {
    name: 'get_video',
    description: 'Get test execution video recording for a test result. Returns video URL, duration, file size, and metadata.',
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
          enum: ['webm', 'mp4'],
          description: 'Preferred video format (default: webm). WebM is usually available, MP4 may require transcoding.',
        },
      },
      required: [],
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
    name: 'cancel_test',
    description: 'Cancel a running test execution (basic - use cancel_run for enhanced options)',
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
  // Feature #885: Enhanced cancel-run tool with options
  {
    name: 'cancel_run',
    description: 'Cancel a running test with enhanced options. Supports force immediate stop and control over partial results.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run to cancel',
        },
        force: {
          type: 'boolean',
          description: 'Force immediate stop without graceful wait. Use when a test is stuck or unresponsive. Default: false',
          default: false,
        },
        save_partial_results: {
          type: 'boolean',
          description: 'Whether to save partial results collected before cancellation. Default: true',
          default: true,
        },
        reason: {
          type: 'string',
          description: 'Optional reason for cancellation (logged and included in events)',
        },
      },
      required: ['run_id'],
    },
  },
  // Feature #1423: Removed pause_run and resume_run tools
  // Playwright does not support mid-execution pause/resume - tests either run to completion or get cancelled
  // Use cancel_run to stop a test, and trigger_test_run to start a new one
  // Feature #1428: Removed get_run_progress, get_run_logs, get_console_output, get_network_logs
  // Use get_run with include parameter instead
  // Feature #892: Compare two test runs
  {
    name: 'compare_runs',
    description: 'Compare two test runs to identify new failures, fixed tests, and overall trend. Useful for regression analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        base_run_id: {
          type: 'string',
          description: 'The ID of the baseline/previous test run',
        },
        compare_run_id: {
          type: 'string',
          description: 'The ID of the new/current test run to compare against the baseline',
        },
      },
      required: ['base_run_id', 'compare_run_id'],
    },
  },
  // Feature #893: Get performance metrics for a test run
  {
    name: 'get_run_metrics',
    description: 'Get performance metrics for a test run including duration statistics, pass/fail counts, and browser breakdown.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run to get metrics for',
        },
      },
      required: ['run_id'],
    },
  },
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
    name: 'get_queue_status',
    description: 'Get the current test execution queue status, including pending, running, and paused runs with estimated wait times.',
    inputSchema: {
      type: 'object',
      properties: {
        include_completed: {
          type: 'boolean',
          description: 'Include recently completed runs in the response (last 24 hours)',
          default: false,
        },
        limit: {
          type: 'number',
          description: 'Maximum number of runs to return per category (max 100)',
          default: 50,
        },
      },
      required: [],
    },
  },
  {
    name: 'prioritize_run',
    description: 'Prioritize a queued test run, moving it to the front of the execution queue.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run to prioritize',
        },
        priority: {
          type: 'number',
          description: 'Priority value (lower = higher priority). Omit to move to front (priority 0). Default priority is 100.',
        },
      },
      required: ['run_id'],
    },
  },
  {
    name: 'get_execution_browsers',
    description: 'List available browsers and mobile emulators for test execution. Returns supported browsers (Chromium, Firefox, WebKit) and mobile device presets (iPhone, Pixel, Galaxy, iPad).',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_execution_viewports',
    description: 'List available viewport presets for test execution. Returns desktop (HD, 4K, ultrawide), tablet (landscape, portrait, pro), and mobile (medium, large, small, android) viewport sizes.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  // Feature #1429: Removed get_result_details - use get_result with test_id and include=["steps", "errors", "artifacts"]
  // Feature #1432: Removed approve_baseline - visual approval requires human judgment
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
];
