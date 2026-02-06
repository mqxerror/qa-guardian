/**
 * Load Testing Tools
 *
 * MCP tools for K6 load testing, script management, and performance trends.
 */

import { ToolDefinition } from '../types';

export const LOAD_TESTING_TOOLS: ToolDefinition[] = [
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
          description: 'Optional reason for stopping the test',
        },
        save_partial_results: {
          type: 'boolean',
          description: 'Save partial results collected up to this point (default: true)',
        },
      },
      required: ['run_id'],
    },
  },
  {
    name: 'create_k6_script',
    description: 'Generate a K6 load test script based on configuration. Supports various test types including simple load, stress, spike, and soak tests.',
    inputSchema: {
      type: 'object',
      properties: {
        target_url: {
          type: 'string',
          description: 'The target URL to test',
        },
        test_type: {
          type: 'string',
          enum: ['simple', 'stress', 'spike', 'soak', 'breakpoint'],
          description: 'Type of load test',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          description: 'HTTP method to use (default: GET)',
        },
        headers: {
          type: 'object',
          description: 'Custom HTTP headers to include',
        },
        body: {
          type: 'string',
          description: 'Request body for POST/PUT/PATCH requests',
        },
        virtual_users: {
          type: 'number',
          description: 'Number of virtual users (default: 10)',
        },
        duration_seconds: {
          type: 'number',
          description: 'Test duration in seconds (default: 30)',
        },
        save_to_project: {
          type: 'string',
          description: 'Optional project ID to save the script to',
        },
      },
      required: ['target_url', 'test_type'],
    },
  },
  {
    name: 'update_k6_script',
    description: 'Modify an existing K6 load test script.',
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
          description: 'Include full script content in response (default: false)',
        },
      },
    },
  },
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
          description: 'Specific metrics to include',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'compare_load_tests',
    description: 'Compare two load test runs to identify performance differences.',
    inputSchema: {
      type: 'object',
      properties: {
        baseline_run_id: {
          type: 'string',
          description: 'The run ID to use as baseline',
        },
        comparison_run_id: {
          type: 'string',
          description: 'The run ID to compare against baseline',
        },
        threshold_percent: {
          type: 'number',
          description: 'Percentage threshold for flagging significant differences (default: 10)',
        },
      },
      required: ['baseline_run_id', 'comparison_run_id'],
    },
  },
];

// List of load testing tool names for handler mapping
export const LOAD_TESTING_TOOL_NAMES = LOAD_TESTING_TOOLS.map(t => t.name);
