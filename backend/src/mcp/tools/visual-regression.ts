/**
 * Visual Regression Testing Tools
 *
 * MCP tools for visual regression testing analysis and reporting.
 * Visual approval/baseline management requires human judgment and is done via UI.
 */

import { ToolDefinition } from '../types';

export const VISUAL_REGRESSION_TOOLS: ToolDefinition[] = [
  {
    name: 'get_visual_diffs',
    description: 'Get visual regression test differences pending review',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Filter by project ID',
        },
        status: {
          type: 'string',
          enum: ['pending', 'approved', 'rejected'],
          description: 'Filter by diff status',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of diffs to return',
          default: 50,
        },
      },
    },
  },
  {
    name: 'get_diff_details',
    description: 'Get detailed information about a visual diff including baseline, current, and diff images.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The test run ID containing the visual diff',
        },
        test_id: {
          type: 'string',
          description: 'The test ID within the run',
        },
      },
      required: ['run_id', 'test_id'],
    },
  },
  // Feature #1432: Removed approve_visual_diff, reject_visual_diff, batch_approve_visual_diffs
  // Visual approval requires human judgment and should be done via UI, not automated
  // Feature #1432: Removed set_baseline, restore_baseline, add_ignore_region, approve_baseline
  // Baseline management is a human decision that affects test outcomes
  {
    name: 'get_baseline_history',
    description: 'Get the history of baseline changes for a visual test. Shows all previous versions, when they were set, and who approved them.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The test ID to get baseline history for',
        },
        viewport: {
          type: 'string',
          description: 'The viewport identifier. Defaults to "single".',
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
  // Feature #1427: Removed get_visual_comparison_image - use get_artifact with type="diff", format="base64"
  {
    name: 'configure_visual_threshold',
    description: 'Set the visual diff sensitivity threshold for a test.',
    inputSchema: {
      type: 'object',
      properties: {
        test_id: {
          type: 'string',
          description: 'The test ID to configure',
        },
        threshold: {
          type: 'number',
          description: 'Threshold value. For percentage mode: 0-100. For pixel_count mode: exact number.',
        },
        mode: {
          type: 'string',
          enum: ['percentage', 'pixel_count'],
          description: 'Threshold mode',
        },
        anti_aliasing_tolerance: {
          type: 'string',
          enum: ['off', 'low', 'medium', 'high'],
          description: 'Anti-aliasing tolerance for cross-browser differences',
        },
        color_threshold: {
          type: 'number',
          description: 'Color difference threshold (0.0-1.0). Default: 0.1',
        },
      },
      required: ['test_id', 'threshold'],
    },
  },
  {
    name: 'get_visual_trends',
    description: 'Get visual stability trends for a project. Shows diff frequency, approval rates, and identifies tests with frequent visual changes.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID',
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
  {
    name: 'get_visual_diff_details',
    description: 'Get detailed information about a specific visual difference including image URLs.',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: {
          type: 'string',
          description: 'The test run ID containing the visual diff',
        },
        test_id: {
          type: 'string',
          description: 'The test ID within the run',
        },
      },
      required: ['run_id', 'test_id'],
    },
  },
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
  {
    name: 'get_visual_review_queue',
    description: 'Get a prioritized list of visual changes pending review. Orders items by diff percentage (most different first).',
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
];

// List of visual regression tool names for handler mapping
export const VISUAL_REGRESSION_TOOL_NAMES = VISUAL_REGRESSION_TOOLS.map(t => t.name);
