/**
 * QA Guardian MCP Tool Definitions
 *
 * This file combines all MCP tool definitions for the QA Guardian platform.
 * Split into multiple parts for code quality compliance (Feature #1356).
 *
 * Parts:
 * - tool-definitions-part1a.ts: Projects, Suites, Tests, Execution, Results, Security
 * - tool-definitions.ts (this file): Monitoring, Visual, Performance (Part 1B)
 * - tool-definitions-part2.ts: K6, Accessibility, Analytics, Settings, AI tools
 */

import { TOOLS_PART1A } from './tool-definitions-part1a';
import { TOOLS_PART2 } from './tool-definitions-part2';

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

// Part 1B: Second half of core tools (Monitoring, Visual, Performance)
const TOOLS_PART1B: ToolDefinition[] = [
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
  // Feature #880: Run suite tool
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
  // Feature #881: Run selected tests tool
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
  // Feature #882: Run failed tests tool
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
  // Feature #883: Run flaky tests tool
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
  // Feature #884: Schedule run tool
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
          default: 'chromium',
        },
        branch: {
          type: 'string',
          description: 'Git branch to run tests against (e.g., "main", "develop", "feature/xyz")',
        },
        env: {
          type: 'string',
          enum: ['development', 'staging', 'production'],
          description: 'Target environment for the test run',
        },
        base_url: {
          type: 'string',
          description: 'Base URL to run tests against (overrides environment default)',
        },
        environment: {
          type: 'string',
          description: 'Environment variables as JSON string (e.g., {"API_KEY": "xxx"})',
        },
        parallel: {
          type: 'boolean',
          description: 'Run tests in parallel (default: true)',
          default: true,
        },
        retries: {
          type: 'number',
          description: 'Number of retries for failed tests (default: 0)',
          default: 0,
        },
        timeout: {
          type: 'number',
          description: 'Test timeout in milliseconds (default: 30000)',
        },
      },
      required: ['suite_id'],
    },
  },
  // ===== MCP v2.0 Security Tools =====
  {
    name: 'run_security_scan',
    description: 'Trigger a security scan (SAST/DAST) for a project',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The ID of the project to scan',
        },
        scan_type: {
          type: 'string',
          enum: ['sast', 'dast', 'dependency', 'secrets', 'full'],
          description: 'Type of security scan to run (default: full)',
          default: 'full',
        },
        target_url: {
          type: 'string',
          description: 'Target URL for DAST scans',
        },
        branch: {
          type: 'string',
          description: 'Git branch to scan (for SAST)',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #1430: Unified get_security_findings tool replaces get_security_scan_status, get_vulnerabilities, get_vulnerability_details
  {
    name: 'get_security_findings',
    description: 'Get security findings from scans. Can return scan status, list vulnerabilities, or get details for a specific vulnerability.',
    inputSchema: {
      type: 'object',
      properties: {
        scan_id: {
          type: 'string',
          description: 'Security scan ID - for scan status or findings from a specific scan',
        },
        vulnerability_id: {
          type: 'string',
          description: 'Specific vulnerability ID - returns detailed info including remediation steps',
        },
        project_id: {
          type: 'string',
          description: 'Filter vulnerabilities by project ID',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'info', 'all'],
          description: 'Filter by severity level (default: all)',
        },
        scan_type: {
          type: 'string',
          enum: ['sast', 'dast', 'dependency', 'secrets', 'all'],
          description: 'Filter by scan type (default: all)',
        },
        status: {
          type: 'string',
          enum: ['open', 'resolved', 'false_positive', 'accepted', 'all'],
          description: 'Filter by status (default: open)',
        },
        include: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['scan_status', 'vulnerabilities', 'trends', 'remediation'],
          },
          description: 'Data to include: scan_status, vulnerabilities, trends, remediation (default: scan_status + vulnerabilities)',
        },
        limit: {
          type: 'number',
          description: 'Maximum vulnerabilities to return (default: 50)',
        },
      },
    },
  },
  // Feature #1430: Removed get_security_scan_status, get_vulnerabilities, get_vulnerability_details - use get_security_findings
  // Feature #923: MCP tool dismiss-vulnerability - AI agent can dismiss false positive vulnerabilities
  {
    name: 'dismiss_vulnerability',
    description: 'Dismiss a vulnerability as a false positive or accepted risk. The dismissal is persisted and the vulnerability will be excluded from future reports.',
    inputSchema: {
      type: 'object',
      properties: {
        vulnerability_id: {
          type: 'string',
          description: 'The ID of the vulnerability to dismiss',
        },
        reason: {
          type: 'string',
          enum: ['false_positive', 'accepted_risk', 'not_applicable', 'will_not_fix', 'mitigated'],
          description: 'The reason for dismissing the vulnerability',
        },
        comment: {
          type: 'string',
          description: 'Additional context or justification for the dismissal',
        },
        expires_at: {
          type: 'string',
          description: 'Optional ISO date when the dismissal expires and vulnerability should be re-evaluated (format: YYYY-MM-DD)',
        },
      },
      required: ['vulnerability_id', 'reason'],
    },
  },
  {
    name: 'get_dependency_audit',
    description: 'Get dependency vulnerability audit report for a project',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The ID of the project',
        },
        include_dev: {
          type: 'boolean',
          description: 'Include dev dependencies (default: true)',
          default: true,
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'get_security_trends',
    description: 'Get security metrics and trends over time',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Filter by project ID',
        },
        period: {
          type: 'string',
          enum: ['7d', '30d', '90d', '1y'],
          description: 'Time period for trends (default: 30d)',
          default: '30d',
        },
        metric: {
          type: 'string',
          enum: ['vulnerabilities', 'scan_coverage', 'fix_rate', 'mttr'],
          description: 'Specific metric to retrieve',
        },
      },
    },
  },
  // Feature #926: MCP tool get-security-score
  {
    name: 'get_security_score',
    description: 'Get overall security health score for a project (0-100)',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to get the security score for',
        },
        include_history: {
          type: 'boolean',
          description: 'Include historical scores (default: false)',
          default: false,
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #927: MCP tool get-exposed-secrets
  {
    name: 'get_exposed_secrets',
    description: 'Get list of detected exposed secrets in the codebase',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to scan for exposed secrets',
        },
        scan_id: {
          type: 'string',
          description: 'Optional specific scan ID to get secrets from',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
          description: 'Filter by severity level',
        },
        secret_type: {
          type: 'string',
          description: 'Filter by secret type (e.g., api_key, password, token)',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #928: MCP tool verify-secret-status
  {
    name: 'verify_secret_status',
    description: 'Check if a detected secret is still active or has been revoked',
    inputSchema: {
      type: 'object',
      properties: {
        secret_id: {
          type: 'string',
          description: 'The ID of the secret to verify',
        },
        force_recheck: {
          type: 'boolean',
          description: 'Force a fresh verification check (bypass cache)',
          default: false,
        },
      },
      required: ['secret_id'],
    },
  },
  // Feature #929: MCP tool generate-sbom
  {
    name: 'generate_sbom',
    description: 'Generate a Software Bill of Materials (SBOM) for a project',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to generate SBOM for',
        },
        format: {
          type: 'string',
          enum: ['cyclonedx', 'spdx'],
          description: 'SBOM format (default: cyclonedx)',
          default: 'cyclonedx',
        },
        include_dev_dependencies: {
          type: 'boolean',
          description: 'Include development dependencies (default: false)',
          default: false,
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #931: MCP tool run-dast-scan
  {
    name: 'run_dast_scan',
    description: 'Trigger a DAST (Dynamic Application Security Testing) scan on a running application',
    inputSchema: {
      type: 'object',
      properties: {
        target_url: {
          type: 'string',
          description: 'The target URL of the running application to scan',
        },
        scan_type: {
          type: 'string',
          enum: ['baseline', 'full', 'api', 'ajax'],
          description: 'Type of scan to run: baseline (quick passive), full (comprehensive), api (API-focused), ajax (Ajax spider)',
          default: 'baseline',
        },
        project_id: {
          type: 'string',
          description: 'Project ID to associate the scan results with',
        },
        auth_config: {
          type: 'object',
          description: 'Authentication configuration for scanning protected endpoints',
          properties: {
            type: { type: 'string', enum: ['none', 'basic', 'bearer', 'cookie', 'form'] },
            username: { type: 'string' },
            password: { type: 'string' },
            token: { type: 'string' },
            login_url: { type: 'string' },
          },
        },
        scan_options: {
          type: 'object',
          description: 'Additional scan options',
          properties: {
            max_depth: { type: 'number', description: 'Maximum crawl depth' },
            max_duration_minutes: { type: 'number', description: 'Maximum scan duration in minutes' },
            exclude_paths: { type: 'array', items: { type: 'string' }, description: 'URL paths to exclude from scanning' },
            include_paths: { type: 'array', items: { type: 'string' }, description: 'URL paths to include in scanning' },
            ajax_spider: { type: 'boolean', description: 'Enable Ajax spider for JavaScript-heavy apps' },
          },
        },
      },
      required: ['target_url'],
    },
  },
  // Feature #932: MCP tool get-dast-findings
  {
    name: 'get_dast_findings',
    description: 'Get DAST scan findings with evidence and remediation guidance',
    inputSchema: {
      type: 'object',
      properties: {
        scan_id: {
          type: 'string',
          description: 'The DAST scan ID to get findings for',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'info'],
          description: 'Filter findings by severity',
        },
        category: {
          type: 'string',
          description: 'Filter findings by category (e.g., injection, xss, authentication)',
        },
        include_evidence: {
          type: 'boolean',
          description: 'Include detailed evidence for each finding (default: true)',
          default: true,
        },
        include_remediation: {
          type: 'boolean',
          description: 'Include remediation guidance for each finding (default: true)',
          default: true,
        },
        limit: {
          type: 'number',
          description: 'Maximum number of findings to return',
          default: 50,
        },
        offset: {
          type: 'number',
          description: 'Number of findings to skip (for pagination)',
          default: 0,
        },
      },
      required: ['scan_id'],
    },
  },
  // Feature #933: MCP tool generate-security-report
  {
    name: 'generate_security_report',
    description: 'Generate a comprehensive security report for a project including all scan types',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to generate the report for',
        },
        format: {
          type: 'string',
          enum: ['pdf', 'html', 'json', 'markdown'],
          description: 'Report output format (default: pdf)',
          default: 'pdf',
        },
        include_sections: {
          type: 'array',
          items: { type: 'string' },
          description: 'Report sections to include: vulnerabilities, dependencies, secrets, dast, compliance, sbom',
        },
        time_range: {
          type: 'string',
          enum: ['24h', '7d', '30d', '90d', 'all'],
          description: 'Time range for historical data (default: 30d)',
          default: '30d',
        },
        severity_threshold: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'info'],
          description: 'Minimum severity to include in the report (default: low)',
          default: 'low',
        },
        executive_summary: {
          type: 'boolean',
          description: 'Include executive summary section (default: true)',
          default: true,
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #934: MCP tool configure-security-policy
  {
    name: 'configure_security_policy',
    description: 'Configure security policies for a project including severity thresholds and license restrictions',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to configure policies for',
        },
        severity_threshold: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'info'],
          description: 'Maximum allowed vulnerability severity (vulnerabilities above this threshold will fail the build)',
        },
        blocked_licenses: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of license SPDX identifiers to block (e.g., GPL-3.0, AGPL-3.0)',
        },
        approved_licenses: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of explicitly approved license SPDX identifiers',
        },
        require_license_review: {
          type: 'boolean',
          description: 'Require manual review for unlisted licenses (default: true)',
          default: true,
        },
        secret_detection: {
          type: 'object',
          description: 'Secret detection policy settings',
          properties: {
            enabled: { type: 'boolean' },
            block_on_active: { type: 'boolean', description: 'Block if active secrets are found' },
            allowed_paths: { type: 'array', items: { type: 'string' }, description: 'Paths to exclude from scanning' },
          },
        },
        dast_policy: {
          type: 'object',
          description: 'DAST policy settings',
          properties: {
            enabled: { type: 'boolean' },
            max_severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
            scan_frequency: { type: 'string', enum: ['on_deploy', 'daily', 'weekly', 'manual'] },
          },
        },
        sbom_policy: {
          type: 'object',
          description: 'SBOM generation policy',
          properties: {
            auto_generate: { type: 'boolean' },
            format: { type: 'string', enum: ['cyclonedx', 'spdx'] },
          },
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #935: MCP tool get-container-vulnerabilities
  {
    name: 'get_container_vulnerabilities',
    description: 'Scan a container image for vulnerabilities and get layer analysis',
    inputSchema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          description: 'Container image reference (e.g., nginx:latest, gcr.io/project/app:v1.0.0)',
        },
        project_id: {
          type: 'string',
          description: 'Project ID to associate the scan results with',
        },
        severity_filter: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'all'],
          description: 'Filter results by minimum severity (default: all)',
          default: 'all',
        },
        include_layer_analysis: {
          type: 'boolean',
          description: 'Include detailed layer-by-layer analysis (default: true)',
          default: true,
        },
        include_base_image: {
          type: 'boolean',
          description: 'Include base image vulnerability analysis (default: true)',
          default: true,
        },
      },
      required: ['image'],
    },
  },
  // Feature #936: MCP tool compare-security-scans
  {
    name: 'compare_security_scans',
    description: 'Compare two security scans to show new, fixed, and unchanged vulnerabilities',
    inputSchema: {
      type: 'object',
      properties: {
        baseline_scan_id: {
          type: 'string',
          description: 'The ID of the baseline (older) scan to compare from',
        },
        current_scan_id: {
          type: 'string',
          description: 'The ID of the current (newer) scan to compare to',
        },
        include_details: {
          type: 'boolean',
          description: 'Include full vulnerability details (default: true)',
          default: true,
        },
        severity_filter: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'all'],
          description: 'Filter results by minimum severity (default: all)',
          default: 'all',
        },
      },
      required: ['baseline_scan_id', 'current_scan_id'],
    },
  },
  // Feature #937: MCP tool schedule-security-scan
  {
    name: 'schedule_security_scan',
    description: 'Schedule recurring security scans for a project or container image',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to schedule scans for',
        },
        scan_type: {
          type: 'string',
          enum: ['dependency', 'container', 'dast', 'secret', 'full'],
          description: 'Type of security scan to schedule',
        },
        frequency: {
          type: 'string',
          enum: ['hourly', 'daily', 'weekly', 'monthly'],
          description: 'How often to run the scan',
        },
        day_of_week: {
          type: 'number',
          description: 'Day of week for weekly scans (0=Sunday, 6=Saturday)',
        },
        time_of_day: {
          type: 'string',
          description: 'Time of day to run (HH:MM in UTC)',
        },
        target_url: {
          type: 'string',
          description: 'Target URL for DAST scans',
        },
        image: {
          type: 'string',
          description: 'Container image for container scans',
        },
        notify_on_failure: {
          type: 'boolean',
          description: 'Send notification on scan failure (default: true)',
          default: true,
        },
        notify_on_vulnerabilities: {
          type: 'boolean',
          description: 'Send notification when vulnerabilities found (default: true)',
          default: true,
        },
        severity_threshold: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
          description: 'Minimum severity to trigger notifications',
        },
      },
      required: ['project_id', 'scan_type', 'frequency'],
    },
  },
  // Feature #938: MCP tool get-fix-suggestions
  {
    name: 'get_fix_suggestions',
    description: 'Get AI-suggested fixes for a vulnerability including code changes and safe versions',
    inputSchema: {
      type: 'object',
      properties: {
        vulnerability_id: {
          type: 'string',
          description: 'The ID of the vulnerability to get fix suggestions for',
        },
        package_name: {
          type: 'string',
          description: 'The name of the affected package',
        },
        current_version: {
          type: 'string',
          description: 'The current vulnerable version',
        },
        ecosystem: {
          type: 'string',
          enum: ['npm', 'pip', 'maven', 'nuget', 'go', 'cargo', 'gem'],
          description: 'The package ecosystem',
        },
        include_breaking_changes: {
          type: 'boolean',
          description: 'Include analysis of potential breaking changes (default: true)',
          default: true,
        },
        include_code_examples: {
          type: 'boolean',
          description: 'Include code examples for fixes (default: true)',
          default: true,
        },
        max_suggestions: {
          type: 'number',
          description: 'Maximum number of fix suggestions to return (default: 3)',
          default: 3,
        },
      },
      required: ['vulnerability_id'],
    },
  },
  // ===== MCP v2.0 Monitoring Tools =====
  {
    name: 'get_uptime_status',
    description: 'Get current uptime status for all monitoring checks',
    inputSchema: {
      type: 'object',
      properties: {
        check_id: {
          type: 'string',
          description: 'Filter by specific check ID',
        },
        status: {
          type: 'string',
          enum: ['up', 'down', 'degraded', 'maintenance'],
          description: 'Filter by status',
        },
        check_type: {
          type: 'string',
          enum: ['http', 'tcp', 'dns', 'ssl', 'webhook'],
          description: 'Filter by check type',
        },
      },
    },
  },
  {
    name: 'get_check_results',
    description: 'Get synthetic monitoring check results',
    inputSchema: {
      type: 'object',
      properties: {
        check_id: {
          type: 'string',
          description: 'The ID of the monitoring check',
        },
        period: {
          type: 'string',
          enum: ['1h', '6h', '24h', '7d', '30d'],
          description: 'Time period for results (default: 24h)',
          default: '24h',
        },
        include_metrics: {
          type: 'boolean',
          description: 'Include response time metrics (default: true)',
          default: true,
        },
      },
      required: ['check_id'],
    },
  },
  // Feature #1431: Removed create_check, update_check, delete_check, pause_check, resume_check
  // Monitoring CRUD operations should be done via REST API or UI, not AI automation
  // AI agents can still read monitoring data via get_uptime_status and get_check_results
  // Feature #1425: Removed acknowledge_alert, resolve_alert, snooze_alert, unsnooze_alert tools
  // Alert management is an incident response workflow for humans, not AI automation
  // These operations should only be available via REST API with proper human oversight
  // Feature #953: Get alert history MCP tool
  {
    name: 'get_alert_history',
    description: 'Get historical alerts with statistics and analytics. Use this to analyze past alerts, identify patterns, and review resolution details.',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date for filtering (ISO 8601 format, e.g., "2026-01-01T00:00:00Z")',
        },
        end_date: {
          type: 'string',
          description: 'End date for filtering (ISO 8601 format, e.g., "2026-01-15T23:59:59Z")',
        },
        severity: {
          type: 'string',
          description: 'Filter by severity (comma-separated for multiple: "critical,high")',
        },
        source: {
          type: 'string',
          description: 'Filter by source (comma-separated for multiple: "api,database")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of alerts to return (default: 50, max: 100)',
          default: 50,
        },
      },
    },
  },
  // Feature #1431: Removed get_oncall_schedule - HR/scheduling data should be accessed via REST API
  // Feature #955: Get uptime report MCP tool
  {
    name: 'get_uptime_report',
    description: 'Generate a comprehensive uptime report with SLA calculations, response time metrics, and incident summaries. Use this to analyze the health and availability of your monitored services over a specified time period.',
    inputSchema: {
      type: 'object',
      properties: {
        check_ids: {
          type: 'string',
          description: 'Comma-separated list of check IDs to include in the report (e.g., "check_1,check_2"). If not provided, includes all checks.',
        },
        start_date: {
          type: 'string',
          description: 'Start date for the report period (ISO 8601 format, e.g., "2026-01-01T00:00:00Z"). Defaults to 30 days ago.',
        },
        end_date: {
          type: 'string',
          description: 'End date for the report period (ISO 8601 format, e.g., "2026-01-15T23:59:59Z"). Defaults to now.',
        },
        sla_target: {
          type: 'number',
          description: 'Target SLA percentage to measure against (e.g., 99.9 for 99.9%). Default: 99.9',
          default: 99.9,
        },
      },
    },
  },
  // Feature #1425: Removed test_alert_channel tool
  // Testing alert channels sends notifications and should be done via UI with human oversight
  // Feature #1431: Removed create_maintenance_window - scheduling should be done via REST API or UI
  // Feature #957: Get maintenance windows MCP tool
  {
    name: 'get_maintenance_windows',
    description: 'List all maintenance windows. Use this to see scheduled and active maintenance windows across all checks.',
    inputSchema: {
      type: 'object',
      properties: {
        active_only: {
          type: 'boolean',
          description: 'If true, only return currently active maintenance windows',
        },
      },
    },
  },
  // Feature #958: Get status page status MCP tool
  {
    name: 'get_status_page_status',
    description: 'Get the current status of a public status page. Use this to check overall system health, component statuses, and any active incidents displayed on a status page.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'The URL slug of the status page (e.g., "my-service-status")',
        },
      },
      required: ['slug'],
    },
  },
  // Feature #959: Get visual diffs MCP tool
  {
    name: 'get_visual_diffs',
    description: 'List pending visual differences that need review. Use this to see visual regression test failures that require approval or rejection before baselines can be updated.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Filter by project ID. If not provided, shows diffs from all projects.',
        },
        status: {
          type: 'string',
          enum: ['pending', 'all'],
          description: 'Filter by status: "pending" (default) shows only unreviewed diffs, "all" shows all diffs including already reviewed ones.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of diffs to return (default: 20)',
        },
      },
    },
  },
  // Feature #960: Get visual diff details MCP tool
  {
    name: 'get_visual_diff_details',
    description: 'Get detailed information about a specific visual difference including image URLs. Use this after get_visual_diffs to retrieve full details about a specific diff that needs review.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The test run ID containing the visual diff (from get_visual_diffs)',
        },
        test_id: {
          type: 'string',
          description: 'The test ID within the run (from get_visual_diffs)',
        },
      },
      required: ['run_id', 'test_id'],
    },
  },
  // Feature #1432: Removed approve_visual_diff, reject_visual_diff, batch_approve_visual_diffs, set_baseline
  // Visual approval requires human judgment and should be done via UI, not automated
  // Feature #965: Get baseline history MCP tool
  {
    name: 'get_baseline_history',
    description: 'Get the history of baseline changes for a visual test. Shows all previous versions, when they were set, and who approved them. Useful for auditing visual changes over time.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The test ID to get baseline history for',
        },
        viewport: {
          type: 'string',
          description: 'The viewport identifier (e.g., "single", "mobile", "desktop"). Defaults to "single".',
        },
        branch: {
          type: 'string',
          description: 'The branch to get history for. Defaults to "main".',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of history entries to return (default: 20)',
          default: 20,
        },
      },
      required: ['test_id'],
    },
  },
  // Feature #1432: Removed restore_baseline, add_ignore_region
  // Baseline management is a human decision that affects test outcomes
  // Feature #1427: Removed get_visual_comparison_image - use get_artifact with type="diff", format="base64"
  // Feature #969: Configure visual threshold MCP tool
  {
    name: 'configure_visual_threshold',
    description: 'Set the visual diff sensitivity threshold for a test. A higher threshold allows more pixel differences before marking a test as failed.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The test ID to configure',
        },
        threshold: {
          type: 'number',
          description: 'Threshold value. For percentage mode: 0-100 (% of pixels that can differ). For pixel_count mode: exact number of different pixels allowed.',
        },
        mode: {
          type: 'string',
          enum: ['percentage', 'pixel_count'],
          description: 'Threshold mode. "percentage" (default): threshold is % of image that can differ. "pixel_count": threshold is exact number of pixels.',
        },
        anti_aliasing_tolerance: {
          type: 'string',
          enum: ['off', 'low', 'medium', 'high'],
          description: 'Anti-aliasing tolerance for cross-browser font rendering differences. Default: "off".',
        },
        color_threshold: {
          type: 'number',
          description: 'Color difference threshold for pixelmatch (0.0-1.0). Higher values tolerate more color variation. Default: 0.1',
        },
      },
      required: ['test_id', 'threshold'],
    },
  },
  // Feature #970: Get visual trends MCP tool
  {
    name: 'get_visual_trends',
    description: 'Get visual stability trends for a project. Shows diff frequency, approval rates, and identifies tests with frequent visual changes.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to get visual trends for',
        },
        days: {
          type: 'number',
          description: 'Number of days to analyze (default: 30)',
          default: 30,
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #971: Run visual comparison MCP tool
  {
    name: 'run_visual_comparison',
    description: 'Trigger a visual comparison test. Runs an existing visual regression test and compares the current screenshot against the baseline.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of the visual regression test to run',
        },
        browser: {
          type: 'string',
          enum: ['chromium', 'firefox', 'webkit'],
          description: 'Browser to use for the comparison (default: chromium)',
        },
        branch: {
          type: 'string',
          description: 'Branch to compare against (default: main)',
        },
        wait_for_completion: {
          type: 'boolean',
          description: 'Wait for the test to complete before returning (default: true)',
        },
      },
      required: ['test_id'],
    },
  },
  // Feature #972: Get visual review queue MCP tool
  {
    name: 'get_visual_review_queue',
    description: 'Get a prioritized list of visual changes pending review. Orders items by diff percentage (most different first) and includes project context.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Filter by project ID',
        },
        sort_by: {
          type: 'string',
          enum: ['diff_percentage', 'created_at', 'project'],
          description: 'Sort order for the queue (default: diff_percentage)',
        },
        limit: {
          type: 'number',
          description: 'Maximum items to return (default: 20)',
          default: 20,
        },
      },
    },
  },
  // Feature #1427: Removed compare_screenshots - use run_visual_comparison for active comparisons
  // or get_artifact with type="diff" for retrieving existing comparison results
  // Feature #974: Run Lighthouse audit MCP tool
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
  // Feature #975: Get Lighthouse results MCP tool
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
          description: 'Optional: Specific test ID within the run (if run contains multiple tests)',
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
  // Feature #976: Get performance trends MCP tool
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
          description: 'Optional: Specific test ID to filter trends for a single test',
        },
        start_date: {
          type: 'string',
          description: 'Start date for the trend period (ISO 8601 format, e.g., "2026-01-01")',
        },
        end_date: {
          type: 'string',
          description: 'End date for the trend period (ISO 8601 format, e.g., "2026-01-15")',
        },
        interval: {
          type: 'string',
          enum: ['day', 'week', 'month'],
          description: 'Aggregation interval for trend data (default: day)',
        },
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific metrics to include (default: all). Options: performance, accessibility, best_practices, seo, lcp, cls, fid, fcp, tti, tbt',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #977: Set performance budget MCP tool
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
          description: 'Performance budget thresholds',
          properties: {
            lcp_ms: {
              type: 'number',
              description: 'Largest Contentful Paint budget in milliseconds (recommended: 2500 for good, 4000 max)',
            },
            cls: {
              type: 'number',
              description: 'Cumulative Layout Shift budget (recommended: 0.1 for good, 0.25 max)',
            },
            fid_ms: {
              type: 'number',
              description: 'First Input Delay / Interaction to Next Paint budget in milliseconds (recommended: 100 for good, 300 max)',
            },
            fcp_ms: {
              type: 'number',
              description: 'First Contentful Paint budget in milliseconds (recommended: 1800 for good)',
            },
            tti_ms: {
              type: 'number',
              description: 'Time to Interactive budget in milliseconds (recommended: 3800 for good)',
            },
            tbt_ms: {
              type: 'number',
              description: 'Total Blocking Time budget in milliseconds (recommended: 200 for good, 600 max)',
            },
            performance_score: {
              type: 'number',
              description: 'Minimum performance score (0-100, recommended: 90 for good)',
            },
          },
        },
        apply_to_tests: {
          type: 'boolean',
          description: 'Apply budgets to existing Lighthouse tests in this project (default: true)',
        },
      },
      required: ['project_id', 'budgets'],
    },
  },
  // Feature #978: Get budget violations MCP tool
  {
    name: 'get_budget_violations',
    description: 'List performance budget violations for a project. Compares recent Lighthouse test results against configured budgets and returns any violations.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to check for budget violations',
        },
        test_id: {
          type: 'string',
          description: 'Optional: Specific test ID to check (if not provided, checks all recent tests)',
        },
        run_id: {
          type: 'string',
          description: 'Optional: Specific run ID to check (if not provided, checks the most recent run)',
        },
        include_warnings: {
          type: 'boolean',
          description: 'Include near-threshold warnings (within 10% of budget) (default: true)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of recent runs to check (default: 5, max: 20)',
        },
      },
      required: ['project_id'],
    },
  },
];

// Combine all tool definitions
export const TOOLS: ToolDefinition[] = [
  ...TOOLS_PART1A,
  ...TOOLS_PART1B,
  ...TOOLS_PART2,
];
