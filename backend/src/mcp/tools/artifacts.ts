/**
 * Artifact Management Tools
 *
 * MCP tools for managing test artifacts (screenshots, videos, traces, logs).
 */

import { ToolDefinition } from '../types';

export const ARTIFACT_TOOLS: ToolDefinition[] = [
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
  {
    name: 'get_video',
    description: 'Get video recording of a test execution.',
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
      },
      required: ['run_id', 'test_id'],
    },
  },
  {
    name: 'get_trace',
    description: 'Get Playwright trace file for a test execution.',
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
      },
      required: ['run_id', 'test_id'],
    },
  },
  // Feature #1428: Removed get_run_logs, get_console_output, get_network_logs
  // Use get_run with include=["logs"], include=["console"], include=["network"]
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
    },
  },
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
];

// List of artifact tool names for handler mapping
export const ARTIFACT_TOOL_NAMES = ARTIFACT_TOOLS.map(t => t.name);
