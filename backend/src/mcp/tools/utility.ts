/**
 * Utility Tools Module
 *
 * General utility tools for help, discovery, and validation.
 * Includes documentation access, tool listing, and API key validation.
 */

import { ToolDefinition } from '../types';

export const UTILITY_TOOLS: ToolDefinition[] = [
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
  // Feature #1161: MCP tool suggest_test_improvements - Get suggestions to improve existing test
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
];

export const UTILITY_TOOL_NAMES = UTILITY_TOOLS.map(t => t.name);
