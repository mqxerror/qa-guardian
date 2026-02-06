/**
 * QA Guardian MCP Tool Definitions - Part 2
 * Feature #1356: Split for code quality compliance
 * Contains: Settings, Incidents, AI Healing, Root Cause, AI Tools (Part 2B)
 *
 * Combined with Part 2A for full TOOLS_PART2 export
 */

import { TOOLS_PART2A } from './tool-definitions-part2a';

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

// Part 2B: Settings, Incidents, AI Healing, Root Cause, AI Tools
const TOOLS_PART2B: ToolDefinition[] = [
  // Feature #1022: Update organization settings MCP tool
  {
    name: 'update_settings',
    description: 'Update organization settings including name, timezone, and default configurations.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'New organization name (1-100 characters)',
        },
        timezone: {
          type: 'string',
          description: 'Timezone for the organization (e.g., "America/New_York", "Europe/London", "UTC")',
        },
        default_browser: {
          type: 'string',
          enum: ['chromium', 'firefox', 'webkit'],
          description: 'Default browser for test execution',
        },
        default_timeout: {
          type: 'number',
          description: 'Default timeout for tests in milliseconds (1000-300000)',
        },
        notifications_enabled: {
          type: 'boolean',
          description: 'Enable or disable email notifications',
        },
        slack_webhook_url: {
          type: 'string',
          description: 'Slack webhook URL for notifications (or null to remove)',
        },
      },
    },
  },
  {
    name: 'get_incidents',
    description: 'List active and recent incidents',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'investigating', 'identified', 'monitoring', 'resolved'],
          description: 'Filter by incident status',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'major', 'minor', 'maintenance'],
          description: 'Filter by severity',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of incidents (default: 20)',
          default: 20,
        },
      },
    },
  },
  // Feature #948: Create incident MCP tool (enhanced)
  {
    name: 'create_incident',
    description: 'Create a new incident manually or from an alert. Use this to declare an incident when issues are detected.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Incident title - a brief description of the issue',
        },
        description: {
          type: 'string',
          description: 'Detailed incident description explaining what happened and the impact',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low', 'info'],
          description: 'Incident severity level (default: medium)',
          default: 'medium',
        },
        priority: {
          type: 'string',
          enum: ['P1', 'P2', 'P3', 'P4', 'P5'],
          description: 'Incident priority for response (P1=highest, P5=lowest, default: P3)',
          default: 'P3',
        },
        affected_services: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of affected service names (e.g., ["api", "frontend", "database"])',
        },
        source_check_id: {
          type: 'string',
          description: 'ID of the monitoring check that triggered this incident',
        },
        source_alert_id: {
          type: 'string',
          description: 'ID of the alert that triggered this incident',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorizing the incident (e.g., ["database", "performance"])',
        },
        escalation_policy_id: {
          type: 'string',
          description: 'ID of the escalation policy to use for notifications',
        },
        on_call_schedule_id: {
          type: 'string',
          description: 'ID of the on-call schedule to notify',
        },
      },
      required: ['title'],
    },
  },
  // Feature #947: Get incident details
  {
    name: 'get_incident_details',
    description: 'Get complete incident information including timeline, affected checks, and notes',
    inputSchema: {
      type: 'object',
      properties: {
        incident_id: {
          type: 'string',
          description: 'The ID of the incident to retrieve details for',
        },
        include_related_incidents: {
          type: 'boolean',
          description: 'Include similar or related incidents (default: false)',
          default: false,
        },
      },
      required: ['incident_id'],
    },
  },
  // Feature #949: Update incident MCP tool
  {
    name: 'update_incident',
    description: 'Update incident status and add notes. Use this to track incident progress through investigation to resolution.',
    inputSchema: {
      type: 'object',
      properties: {
        incident_id: {
          type: 'string',
          description: 'The ID of the incident to update',
        },
        status: {
          type: 'string',
          enum: ['acknowledged', 'investigating', 'identified', 'monitoring', 'resolved'],
          description: 'New status for the incident',
        },
        note: {
          type: 'string',
          description: 'Optional note to add with the status update (e.g., investigation findings)',
        },
        note_visibility: {
          type: 'string',
          enum: ['internal', 'public'],
          description: 'Visibility of the note (default: internal)',
          default: 'internal',
        },
        resolution_summary: {
          type: 'string',
          description: 'Required when resolving - summary of how the incident was resolved',
        },
        postmortem_url: {
          type: 'string',
          description: 'Optional URL to postmortem document (for resolved incidents)',
        },
      },
      required: ['incident_id'],
    },
  },
  // Feature #1066: Get healing history MCP tool
  {
    name: 'get_healing_history',
    description: 'Retrieve AI selector healing history for a test. Returns an array of healing events showing when selectors were auto-healed, what the original and healed selectors were, the healing strategy used, and confidence scores.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of the test to get healing history for',
        },
        run_id: {
          type: 'string',
          description: 'Optional: Filter to a specific test run',
        },
        include_overrides: {
          type: 'boolean',
          description: 'Include manual selector overrides in the history (default: true)',
          default: true,
        },
        limit: {
          type: 'number',
          description: 'Maximum number of healing events to return (default: 50)',
          default: 50,
        },
      },
      required: ['test_id'],
    },
  },
  // Feature #1067: Approve healing MCP tool
  {
    name: 'approve_healing',
    description: 'Approve a pending AI-healed selector and optionally apply it to the test definition. This makes the healed selector permanent.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run containing the healed selector',
        },
        test_id: {
          type: 'string',
          description: 'The ID of the test with the healed selector',
        },
        step_id: {
          type: 'string',
          description: 'The ID of the step with the healed selector',
        },
        apply_to_test: {
          type: 'boolean',
          description: 'If true, also update the test definition with the healed selector (default: true)',
          default: true,
        },
      },
      required: ['run_id', 'test_id', 'step_id'],
    },
  },
  // Feature #1068: Reject healing MCP tool
  {
    name: 'reject_healing',
    description: 'Reject a pending AI-healed selector. This marks the healing as rejected and flags the test step as needing manual attention.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run containing the healed selector',
        },
        test_id: {
          type: 'string',
          description: 'The ID of the test with the healed selector',
        },
        step_id: {
          type: 'string',
          description: 'The ID of the step with the healed selector',
        },
        reason: {
          type: 'string',
          description: 'Reason for rejecting the healing (e.g., "Incorrect element", "Wrong selector strategy")',
        },
        suggest_selector: {
          type: 'string',
          description: 'Optional: Suggest a correct selector to use instead',
        },
      },
      required: ['run_id', 'test_id', 'step_id'],
    },
  },
  // Feature #1069: Configure healing settings MCP tool
  {
    name: 'configure_healing',
    description: 'Configure AI healing settings for a project. This allows enabling/disabling healing, setting timeout, configuring strategies, and adjusting attempt limits.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The ID of the project to configure healing for',
        },
        healing_enabled: {
          type: 'boolean',
          description: 'Enable or disable AI healing for this project',
        },
        healing_timeout: {
          type: 'number',
          description: 'Maximum seconds for healing attempts (5-120)',
        },
        max_healing_attempts: {
          type: 'number',
          description: 'Maximum healing attempts per test (1-10)',
        },
        healing_strategies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Enabled healing strategies. Valid options: selector_fallback, visual_match, text_match, attribute_match, css_selector, xpath',
        },
        notify_on_healing: {
          type: 'boolean',
          description: 'Send notification when healing is applied',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #1070: Get healing suggestions MCP tool
  {
    name: 'get_healing_suggestions',
    description: 'Get AI suggestions for selector improvements in a test suite. Analyzes selectors for fragility and suggests more robust alternatives with confidence scores.',
    inputSchema: {
      type: 'object',
      properties: {
        suite_id: {
          type: 'string',
          description: 'The ID of the test suite to analyze for fragile selectors',
        },
        include_passing: {
          type: 'boolean',
          description: 'Include selectors from passing tests (default: true)',
        },
        min_confidence: {
          type: 'number',
          description: 'Minimum confidence threshold for suggestions (0-100, default: 50)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of suggestions to return (default: 20)',
        },
      },
      required: ['suite_id'],
    },
  },
  // Feature #1086: MCP tool analyze-root-cause - Get AI root cause analysis
  {
    name: 'analyze_root_cause',
    description: 'Get comprehensive AI-powered root cause analysis for a test failure. Returns primary and alternative causes with confidence scores, evidence artifacts, suggested remediation actions, historical pattern matching, and related code commits.',
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
        failure_id: {
          type: 'string',
          description: 'The failure ID (format: runId-testId). Alternative to run_id + test_id.',
        },
        include_commits: {
          type: 'boolean',
          description: 'Include related git commits that may have caused the failure (default: true)',
        },
        include_evidence: {
          type: 'boolean',
          description: 'Include detailed evidence artifacts (screenshots, logs, network requests) (default: true)',
        },
        include_historical: {
          type: 'boolean',
          description: 'Include historical pattern matching data (default: true)',
        },
      },
      required: [],
    },
  },
  // Feature #1087: MCP tool explain-failure - Get human-readable failure explanation
  {
    name: 'explain_failure',
    description: 'Get a human-readable explanation of a test failure tailored to a specific audience. Provides plain-English descriptions for general users, technical details for developers, or executive summaries for stakeholders.',
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
        failure_id: {
          type: 'string',
          description: 'The failure ID (format: runId-testId). Alternative to run_id + test_id.',
        },
        audience: {
          type: 'string',
          enum: ['general', 'technical', 'executive'],
          description: 'Target audience for the explanation. "general" provides plain-English with analogies, "technical" provides code-level analysis, "executive" provides business impact summary. Default: general.',
        },
      },
      required: [],
    },
  },
  // Feature #1088: MCP tool get-failure-clusters - List failure clusters
  {
    name: 'get_failure_clusters',
    description: 'Get AI-identified failure clusters grouped by similar error patterns. Clusters help identify systemic issues affecting multiple tests.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Filter clusters by project ID',
        },
        suite_id: {
          type: 'string',
          description: 'Filter clusters by test suite ID',
        },
        days: {
          type: 'number',
          description: 'Number of days to look back for failures (default: 7)',
        },
        min_cluster_size: {
          type: 'number',
          description: 'Minimum number of failures to form a cluster (default: 2)',
        },
      },
      required: [],
    },
  },
  // Feature #1090: MCP tool get-remediation-suggestions - Get AI fix suggestions
  {
    name: 'get_remediation_suggestions',
    description: 'Get AI-powered remediation suggestions for test failures. Returns actionable fix suggestions with code snippets, prioritized by impact.',
    inputSchema: {
      type: 'object',
      properties: {
        failure_id: {
          type: 'string',
          description: 'Composite failure ID in format "runId-testId". Alternative to providing run_id and test_id separately.',
        },
        run_id: {
          type: 'string',
          description: 'Test run ID containing the failure',
        },
        test_id: {
          type: 'string',
          description: 'Test ID of the failed test',
        },
        include_quick_wins: {
          type: 'boolean',
          description: 'Include quick-win suggestions that can be auto-applied (default: true)',
        },
        category_filter: {
          type: 'string',
          enum: ['code_fix', 'test_update', 'environment', 'configuration', 'retry'],
          description: 'Filter suggestions by category',
        },
      },
      required: [],
    },
  },
  // Feature #1089: MCP tool correlate-with-commits - Get commit correlation for failures
  {
    name: 'correlate_with_commits',
    description: 'Correlate test failures with recent git commits to identify potential code changes that caused the failure. Returns related commits with analysis of which commit is most likely responsible.',
    inputSchema: {
      type: 'object',
      properties: {
        failure_id: {
          type: 'string',
          description: 'Composite failure ID in format "runId-testId". Alternative to providing run_id and test_id separately.',
        },
        run_id: {
          type: 'string',
          description: 'Test run ID containing the failure',
        },
        test_id: {
          type: 'string',
          description: 'Test ID of the failed test',
        },
        include_diffs: {
          type: 'boolean',
          description: 'Include code diffs for related commits (default: false)',
        },
      },
      required: [],
    },
  },
  // Feature #1216: MCP tool stream-test-run - Get streaming updates during test execution
  {
    name: 'stream_test_run',
    description: 'Subscribe to streaming updates during test execution. Polls the test run status and sends real-time progress notifications including test completions, failures, and step progress. Returns when the run completes or times out.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run to stream updates for (required)',
        },
        poll_interval_ms: {
          type: 'number',
          description: 'Interval between status polls in milliseconds (default: 1000, min: 500, max: 10000)',
        },
        timeout_ms: {
          type: 'number',
          description: 'Maximum time to wait for run completion in milliseconds (default: 300000 = 5 minutes, max: 600000 = 10 minutes)',
        },
        include_step_details: {
          type: 'boolean',
          description: 'Include detailed step-by-step progress updates (default: true)',
        },
        include_failure_details: {
          type: 'boolean',
          description: 'Include immediate failure details when tests fail (default: true)',
        },
      },
      required: ['run_id'],
    },
  },
  // Feature #1217: MCP tool subscribe-to-alerts - Subscribe to real-time alert stream
  {
    name: 'subscribe_to_alerts',
    description: 'Subscribe to real-time alerts stream. Monitors for new alerts and sends streaming notifications when alerts are triggered. Returns when the subscription ends or times out.',
    inputSchema: {
      type: 'object',
      properties: {
        severity: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low', 'info'],
          },
          description: 'Filter alerts by severity levels (default: all severities)',
        },
        source: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['uptime', 'test_failure', 'performance', 'security', 'load_test', 'accessibility'],
          },
          description: 'Filter alerts by source type (default: all sources)',
        },
        check_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter alerts to specific monitoring check IDs',
        },
        poll_interval_ms: {
          type: 'number',
          description: 'Interval between alert polls in milliseconds (default: 2000, min: 1000, max: 30000)',
        },
        timeout_ms: {
          type: 'number',
          description: 'Maximum time to subscribe in milliseconds (default: 300000 = 5 minutes, max: 3600000 = 1 hour)',
        },
        include_resolved: {
          type: 'boolean',
          description: 'Include alert resolution events (default: true)',
        },
      },
      required: [],
    },
  },
  // Feature #1217: MCP tool unsubscribe-from-alerts - Unsubscribe from alert stream
  {
    name: 'unsubscribe_from_alerts',
    description: 'Unsubscribe from a real-time alerts subscription. Stops receiving alerts and returns the subscription summary.',
    inputSchema: {
      type: 'object',
      properties: {
        subscription_id: {
          type: 'string',
          description: 'The ID of the subscription to cancel (required)',
        },
      },
      required: ['subscription_id'],
    },
  },
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
  // Feature #1405: generate_executive_report removed - enterprise bloat
  // Feature #1406: generate_compliance_report removed - enterprise bloat
  // Feature #1224: MCP tool get-trend-analysis - Get AI analysis of trends over time
  {
    name: 'get_trend_analysis',
    description: 'Get AI-powered analysis of test metrics trends over time. Includes trend data, pattern interpretation, anomaly detection, and predictions for future performance.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID to analyze (required)',
        },
        metrics: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['pass_rate', 'test_count', 'duration', 'flakiness', 'failures', 'coverage'],
          },
          description: 'Metrics to analyze (default: all)',
        },
        time_range: {
          type: 'object',
          properties: {
            start: { type: 'string', description: 'Start date (ISO format)' },
            end: { type: 'string', description: 'End date (ISO format)' },
            preset: {
              type: 'string',
              enum: ['last_7_days', 'last_30_days', 'last_90_days', 'last_180_days', 'last_year'],
              description: 'Use a preset time range',
            },
          },
          description: 'Time range for analysis (default: last 30 days)',
        },
        granularity: {
          type: 'string',
          enum: ['hourly', 'daily', 'weekly', 'monthly'],
          description: 'Data point granularity (default: daily)',
        },
        include_predictions: {
          type: 'boolean',
          description: 'Include AI predictions for future trends (default: true)',
        },
        prediction_days: {
          type: 'number',
          description: 'Number of days to predict ahead (default: 7, max: 30)',
        },
        include_anomalies: {
          type: 'boolean',
          description: 'Detect and highlight anomalies (default: true)',
        },
        compare_periods: {
          type: 'boolean',
          description: 'Compare current period with previous (default: true)',
        },
      },
      required: ['project_id'],
    },
  },

  // Feature #1226: MCP tool get_related_prs - Get GitHub PRs related to failures
  {
    name: 'get_related_prs',
    description: 'Get GitHub pull requests related to a test failure. Analyzes commit history and file changes to identify PRs that likely caused the failure.',
    inputSchema: {
      type: 'object',
      properties: {
        failure_id: {
          type: 'string',
          description: 'The ID of the test failure to analyze (required)',
        },
        repository: {
          type: 'string',
          description: 'GitHub repository in owner/repo format (e.g., "myorg/myrepo")',
        },
        time_window: {
          type: 'string',
          enum: ['1h', '6h', '12h', '24h', '48h', '7d'],
          description: 'Time window to search for related PRs (default: 24h)',
        },
        include_commits: {
          type: 'boolean',
          description: 'Include detailed commit information (default: true)',
        },
        include_file_changes: {
          type: 'boolean',
          description: 'Include list of changed files per PR (default: true)',
        },
        include_blame: {
          type: 'boolean',
          description: 'Include blame information linking failures to specific code changes (default: false)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of PRs to return (default: 10)',
        },
      },
      required: ['failure_id'],
    },
  },

  // Feature #1437: Removed get_deployment_context - deployment info should come via webhooks, not polling
  // Feature #1436: Removed notify_team - AI should not send arbitrary notifications that bypass alert conditions and rate limiting
  // Feature #1434: Removed get_help, list_all_tools, validate_api_key
  // AI agents have tool schemas in the MCP manifest and are already authenticated
  // Feature #1351: MCP tool get_ai_provider_status - Get AI provider status and configuration
  {
    name: 'get_ai_provider_status',
    description: 'Get current AI provider status, health metrics, and configuration. Returns information about primary and fallback providers, model configuration, and rate limit status.',
    inputSchema: {
      type: 'object',
      properties: {
        include_health_metrics: {
          type: 'boolean',
          description: 'Include detailed health metrics (latency, error rates, uptime) (default: true)',
        },
        include_model_config: {
          type: 'boolean',
          description: 'Include current model configuration (default: true)',
        },
        include_rate_limits: {
          type: 'boolean',
          description: 'Include rate limit status (default: true)',
        },
        include_fallback_status: {
          type: 'boolean',
          description: 'Include fallback provider status (default: true)',
        },
        include_usage_stats: {
          type: 'boolean',
          description: 'Include usage statistics (requests, tokens, costs) (default: false)',
        },
        time_window: {
          type: 'string',
          enum: ['1h', '6h', '24h', '7d', '30d'],
          description: 'Time window for metrics and stats (default: 24h)',
        },
      },
    },
  },
  // Feature #1352: MCP tool get_ai_cost_report - Get AI cost analytics and savings report
  {
    name: 'get_ai_cost_report',
    description: 'Get comprehensive AI cost analytics including cost by provider, savings vs direct API usage, token usage breakdown, budget status, and cost trends over time.',
    inputSchema: {
      type: 'object',
      properties: {
        time_window: {
          type: 'string',
          enum: ['1h', '6h', '24h', '7d', '30d', '90d'],
          description: 'Time window for cost analysis (default: 30d)',
        },
        include_savings: {
          type: 'boolean',
          description: 'Include savings comparison vs direct Anthropic API pricing (default: true)',
        },
        include_token_breakdown: {
          type: 'boolean',
          description: 'Include detailed token usage breakdown by input/output (default: true)',
        },
        include_budget_status: {
          type: 'boolean',
          description: 'Include budget utilization and alerts (default: true)',
        },
        include_trends: {
          type: 'boolean',
          description: 'Include cost trend analysis over time (default: true)',
        },
        group_by: {
          type: 'string',
          enum: ['provider', 'model', 'feature', 'day', 'week'],
          description: 'Group cost data by dimension (default: provider)',
        },
        format: {
          type: 'string',
          enum: ['detailed', 'summary', 'csv'],
          description: 'Output format (default: detailed)',
        },
      },
    },
  },
  // Feature #1353: MCP tool switch_ai_provider - Switch primary AI provider (admin only)
  {
    name: 'switch_ai_provider',
    description: 'Switch the primary AI provider for the platform. Requires admin permissions. Changes take effect immediately and are logged for audit purposes.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['anthropic', 'openai', 'azure_openai', 'google'],
          description: 'The AI provider to switch to',
        },
        reason: {
          type: 'string',
          description: 'Reason for switching providers (required for audit log)',
        },
        fallback_provider: {
          type: 'string',
          enum: ['anthropic', 'openai', 'azure_openai', 'google', 'none'],
          description: 'Optional fallback provider if primary is unavailable',
        },
        validate_before_switch: {
          type: 'boolean',
          description: 'Test provider connectivity before switching (default: true)',
        },
        notify_team: {
          type: 'boolean',
          description: 'Send notification to team about provider change (default: true)',
        },
      },
      required: ['provider', 'reason'],
    },
  },
  // Feature #1354: MCP tool generate_test_from_description - Generate Playwright test from natural language
  {
    name: 'generate_test_from_description',
    description: 'Generate a Playwright test from a natural language description. Uses AI to create executable test code based on the provided description.',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Natural language description of the test to generate (e.g., "Test that users can login with valid credentials")',
        },
        target_url: {
          type: 'string',
          description: 'Base URL for the test (optional, can be inferred from description)',
        },
        test_framework: {
          type: 'string',
          enum: ['playwright-test', 'playwright-jest', 'playwright-mocha'],
          description: 'Test framework to use (default: playwright-test)',
        },
        include_assertions: {
          type: 'boolean',
          description: 'Include comprehensive assertions (default: true)',
        },
        include_comments: {
          type: 'boolean',
          description: 'Include descriptive comments in generated code (default: true)',
        },
        language: {
          type: 'string',
          enum: ['typescript', 'javascript'],
          description: 'Programming language for generated test (default: typescript)',
        },
        browser: {
          type: 'string',
          enum: ['chromium', 'firefox', 'webkit', 'all'],
          description: 'Target browser(s) for the test (default: chromium)',
        },
      },
      required: ['description'],
    },
  },
  // Feature #1157: MCP tool generate_test - Simplified test generation from description via MCP
  {
    name: 'generate_test',
    description: 'Generate a Playwright test from a description and target URL. Returns generated code, confidence score, and suggested test variations. Simplified version of generate_test_from_description.',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Description of the test to generate (e.g., "Login with valid credentials", "Add item to cart")',
        },
        target_url: {
          type: 'string',
          description: 'The base URL for the test (e.g., "https://example.com")',
        },
      },
      required: ['description', 'target_url'],
    },
  },
  // Feature #1158: MCP tool get_coverage_gaps - Get coverage gaps via MCP
  {
    name: 'get_coverage_gaps',
    description: 'Analyze test coverage and identify gaps. Returns untested areas, suggested tests to fill gaps, and priority scores based on risk and impact.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The ID of the project to analyze coverage for',
        },
        include_suggestions: {
          type: 'boolean',
          description: 'Include suggested tests for uncovered areas (default: true)',
        },
        min_priority: {
          type: 'number',
          description: 'Minimum priority score to include (0-100, default: 0)',
        },
      },
      required: ['project_id'],
    },
  },
  // Feature #1159: MCP tool generate_test_suite - Generate suite from user story via MCP
  {
    name: 'generate_test_suite',
    description: 'Generate a complete test suite from a user story. Returns an array of tests covering happy path and edge cases, each with assertions.',
    inputSchema: {
      type: 'object',
      properties: {
        user_story: {
          type: 'string',
          description: 'User story in format "As a [role], I want [feature], so that [benefit]"',
        },
        include_edge_cases: {
          type: 'boolean',
          description: 'Include edge case tests in addition to happy path (default: true)',
        },
        max_tests: {
          type: 'number',
          description: 'Maximum number of tests to generate (default: 10)',
        },
      },
      required: ['user_story'],
    },
  },
  // Feature #1160: MCP tool convert_gherkin - Convert Gherkin to Playwright via MCP
  {
    name: 'convert_gherkin',
    description: 'Convert Gherkin/BDD scenarios to Playwright test code. Preserves step mapping from Given/When/Then to navigation/action/assertion.',
    inputSchema: {
      type: 'object',
      properties: {
        gherkin_text: {
          type: 'string',
          description: 'Gherkin scenario text with Feature, Scenario, and Given/When/Then steps',
        },
        target_url: {
          type: 'string',
          description: 'Base URL for the generated tests (optional)',
        },
        include_comments: {
          type: 'boolean',
          description: 'Include step mapping comments in generated code (default: true)',
        },
      },
      required: ['gherkin_text'],
    },
  },
  // Feature #1355: MCP tool explain_test_failure_ai - Get AI-powered detailed failure explanation
  {
    name: 'explain_test_failure_ai',
    description: 'Get an AI-powered detailed explanation of a test failure. Analyzes error messages, stack traces, and test context to provide actionable insights and fix suggestions.',
    inputSchema: {
      type: 'object',
      properties: {
        error_message: {
          type: 'string',
          description: 'The error message from the test failure',
        },
        stack_trace: {
          type: 'string',
          description: 'The full stack trace (optional but recommended)',
        },
        test_code: {
          type: 'string',
          description: 'The test code that failed (optional but recommended)',
        },
        test_name: {
          type: 'string',
          description: 'Name of the failed test',
        },
        screenshot_url: {
          type: 'string',
          description: 'URL to failure screenshot if available',
        },
        browser: {
          type: 'string',
          description: 'Browser where the failure occurred',
        },
        environment: {
          type: 'string',
          description: 'Test environment (e.g., staging, production)',
        },
        include_code_fix: {
          type: 'boolean',
          description: 'Include suggested code fix (default: true)',
        },
        include_root_cause: {
          type: 'boolean',
          description: 'Include root cause analysis (default: true)',
        },
        verbosity: {
          type: 'string',
          enum: ['brief', 'standard', 'detailed'],
          description: 'Level of detail in explanation (default: standard)',
        },
      },
      required: ['error_message'],
    },
  },
  // Feature #1161: MCP tool suggest_test_improvements
  {
    name: 'suggest_test_improvements',
    description: 'Analyze an existing test and provide suggestions for improvements. Returns improvement suggestions with code examples and reasoning for each suggestion.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The ID of the test to analyze for improvements',
        },
        focus_areas: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['reliability', 'performance', 'coverage', 'maintainability', 'assertions', 'selectors', 'waits', 'all'],
          },
          description: 'Specific areas to focus improvement suggestions on (default: all)',
        },
        include_code_examples: {
          type: 'boolean',
          description: 'Include before/after code examples for each suggestion (default: true)',
        },
        include_reasoning: {
          type: 'boolean',
          description: 'Include detailed reasoning for each suggestion (default: true)',
        },
        max_suggestions: {
          type: 'number',
          description: 'Maximum number of improvement suggestions to return (default: 5)',
        },
        severity_threshold: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: 'Minimum severity level for suggestions (default: low)',
        },
      },
      required: ['test_id'],
    },
  },
  // Feature #1202: MCP tool ask_qa_guardian - Natural language interface to entire platform
  {
    name: 'ask_qa_guardian',
    description: 'Natural language interface to the entire QA Guardian platform. Ask any question about your tests, runs, projects, or get insights in plain English. The AI will answer with relevant data, statistics, and actionable links.',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'Your question in natural language (e.g., "What failed in the last run?", "Show me flaky tests", "Which tests are slowest?")',
        },
        context: {
          type: 'object',
          properties: {
            project_id: {
              type: 'string',
              description: 'Optional project ID to scope the question to a specific project',
            },
            suite_id: {
              type: 'string',
              description: 'Optional suite ID to scope the question to a specific test suite',
            },
            time_range: {
              type: 'string',
              enum: ['last_hour', 'last_day', 'last_week', 'last_month', 'all_time'],
              description: 'Time range for data queries (default: last_week)',
            },
          },
          description: 'Optional context to narrow down the search scope',
        },
        include_links: {
          type: 'boolean',
          description: 'Include actionable links in the response (default: true)',
        },
        include_data: {
          type: 'boolean',
          description: 'Include raw data alongside the natural language answer (default: true)',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to include (default: 10)',
        },
      },
      required: ['question'],
    },
  },
  // Feature #1213: MCP tool analyze_test_maintenance - AI analyzes test maintenance burden
  {
    name: 'analyze_test_maintenance',
    description: 'Analyze test maintenance burden for a test suite. Returns maintenance cost per test, identifies high-maintenance tests, and provides simplification suggestions.',
    inputSchema: {
      type: 'object',
      properties: {
        suite_id: {
          type: 'string',
          description: 'The ID of the test suite to analyze',
        },
        include_history: {
          type: 'boolean',
          description: 'Include historical maintenance data (default: true)',
        },
        include_suggestions: {
          type: 'boolean',
          description: 'Include simplification suggestions (default: true)',
        },
        time_period: {
          type: 'string',
          enum: ['7d', '30d', '90d'],
          description: 'Time period for analysis (default: 30d)',
        },
      },
      required: ['suite_id'],
    },
  },
  // Feature #1212: MCP tool suggest_test_strategy - AI recommends testing approach for feature
  {
    name: 'suggest_test_strategy',
    description: 'Get AI recommendations for testing approach based on feature description. Returns recommended test types, priority order, and estimated effort.',
    inputSchema: {
      type: 'object',
      properties: {
        feature_description: {
          type: 'string',
          description: 'Description of the feature to be tested (e.g., "User registration with email verification and SSO")',
        },
        context: {
          type: 'object',
          properties: {
            team_size: {
              type: 'number',
              description: 'Size of QA team (affects effort estimates)',
            },
            deadline_days: {
              type: 'number',
              description: 'Days until feature deadline',
            },
            risk_level: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              description: 'Business risk level of the feature',
            },
          },
          description: 'Optional context for more accurate recommendations',
        },
        include_examples: {
          type: 'boolean',
          description: 'Include example test scenarios for each test type (default: true)',
        },
        include_effort: {
          type: 'boolean',
          description: 'Include effort estimates (default: true)',
        },
      },
      required: ['feature_description'],
    },
  },
  // Feature #1206: MCP tool summarize_test_results - AI summary of test run results
  {
    name: 'summarize_test_results',
    description: 'Generate an AI-powered natural language summary of test run results. Highlights key issues, patterns, and provides actionable recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The ID of the test run to summarize',
        },
        include_action_items: {
          type: 'boolean',
          description: 'Include actionable recommendations (default: true)',
        },
        include_key_issues: {
          type: 'boolean',
          description: 'Highlight critical issues and failures (default: true)',
        },
        verbosity: {
          type: 'string',
          enum: ['brief', 'standard', 'detailed'],
          description: 'Level of detail in the summary (default: standard)',
        },
        format: {
          type: 'string',
          enum: ['prose', 'bullets', 'structured'],
          description: 'Output format (default: prose)',
        },
      },
      required: ['run_id'],
    },
  },
];

// Combine Part 2A and 2B for export
export const TOOLS_PART2: ToolDefinition[] = [
  ...TOOLS_PART2A,
  ...TOOLS_PART2B,
];
