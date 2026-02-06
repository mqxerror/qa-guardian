/**
 * Healing & AI Analysis Tools Module
 *
 * Tools for AI-powered selector healing, root cause analysis, and failure analysis.
 */

import { ToolDefinition } from '../types';

export const HEALING_TOOLS: ToolDefinition[] = [
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
];

export const HEALING_TOOL_NAMES = HEALING_TOOLS.map(t => t.name);
