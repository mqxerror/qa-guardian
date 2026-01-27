/**
 * Streaming & Real-Time Tools Module
 *
 * Tools for real-time streaming updates during test execution and alert monitoring.
 * Provides live progress updates and alert subscription capabilities.
 */

import { ToolDefinition } from '../types';

export const STREAMING_TOOLS: ToolDefinition[] = [
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
];

export const STREAMING_TOOL_NAMES = STREAMING_TOOLS.map(t => t.name);
