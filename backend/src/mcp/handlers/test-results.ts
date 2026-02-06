/**
 * Test Results Tool Handlers
 *
 * Handlers for test results MCP tools.
 * Extracted from server.ts to reduce file size (Feature #1356).
 */

import { ToolHandler, HandlerModule } from './types';

/**
 * Unified get_result handler (Feature #1429)
 * Replaces get_test_results, get_result_details, get_result_timeline
 */
export const getResult: ToolHandler = async (args, context) => {
  const runId = args.run_id as string;
  const testId = args.test_id as string | undefined;
  const status = args.status as string | undefined;
  const includeData = (args.include as string[]) || [];
  const bottleneckThreshold = (args.bottleneck_threshold_ms as number) || 1000;

  if (!runId) {
    return { error: 'run_id is required' };
  }

  // If test_id is provided, get detailed result for that specific test
  if (testId) {
    const response: Record<string, unknown> = { run_id: runId, test_id: testId };

    // Get base result details
    const resultData = await context.callApi(`/api/v1/runs/${runId}/results/${testId}`);
    Object.assign(response, resultData);

    // Include step details
    if (includeData.includes('steps')) {
      response.steps = await context.callApi(`/api/v1/runs/${runId}/results/${testId}/steps`);
    }

    // Include error details
    if (includeData.includes('errors')) {
      response.errors = await context.callApi(`/api/v1/runs/${runId}/results/${testId}/errors`);
    }

    // Include timeline
    if (includeData.includes('timeline')) {
      const timelineData = await context.callApi(`/api/v1/runs/${runId}/results/${testId}/timeline?bottleneck_threshold=${bottleneckThreshold}`);
      response.timeline = timelineData;
    }

    // Include artifacts
    if (includeData.includes('artifacts')) {
      response.artifacts = await context.callApi(`/api/v1/runs/${runId}/results/${testId}/artifacts`);
    }

    // Include AI analysis
    if (includeData.includes('analysis')) {
      response.analysis = await context.callApi(`/api/v1/runs/${runId}/results/${testId}/analyze-failure`);
    }

    return response;
  }

  // Get all results for the run
  const resultsParams = new URLSearchParams();
  if (status && status !== 'all') resultsParams.set('status', status);
  if (includeData.includes('steps')) resultsParams.set('include_steps', 'true');
  if (includeData.includes('errors')) resultsParams.set('include_errors', 'true');
  const resultsQuery = resultsParams.toString();
  return await context.callApi(`/api/v1/runs/${runId}/results${resultsQuery ? `?${resultsQuery}` : ''}`);
};

/**
 * Run status response type
 */
interface RunStatusResponse {
  status?: string;
  progress?: number;
  testsCompleted?: number;
  testsTotal?: number;
  testsPassed?: number;
  testsFailed?: number;
  testsSkipped?: number;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  currentTest?: string;
  estimatedRemaining?: number;
}

/**
 * Unified get_run handler (Feature #1428)
 * Replaces get_run_status, get_run_progress, get_run_logs, get_console_output, get_network_logs
 */
export const getRun: ToolHandler = async (args, context) => {
  const runId = args.run_id as string;
  const testId = args.test_id as string | undefined;
  const includeData = (args.include as string[]) || ['status', 'progress'];
  const logLevel = (args.log_level as string) || 'all';
  const logLimit = (args.log_limit as number) || 100;

  if (!runId) {
    return { error: 'run_id is required' };
  }

  const response: Record<string, unknown> = { run_id: runId };

  // Status data
  if (includeData.includes('status') || includeData.includes('progress')) {
    const runData = await context.callApi(`/api/v1/runs/${runId}/status`) as RunStatusResponse;

    if (includeData.includes('status')) {
      response.status = runData?.status || 'unknown';
      response.started_at = runData?.startedAt;
      response.completed_at = runData?.completedAt;
      response.duration_ms = runData?.duration;
    }

    if (includeData.includes('progress')) {
      response.progress = {
        percentage: runData?.progress || 0,
        completed: runData?.testsCompleted || 0,
        total: runData?.testsTotal || 0,
        passed: runData?.testsPassed || 0,
        failed: runData?.testsFailed || 0,
        skipped: runData?.testsSkipped || 0,
        current_test: runData?.currentTest,
        estimated_remaining_ms: runData?.estimatedRemaining,
      };
    }
  }

  // Logs
  if (includeData.includes('logs')) {
    const params: Record<string, string> = { limit: String(logLimit) };
    if (logLevel !== 'all') params.level = logLevel;
    response.logs = await context.callApi(`/api/v1/runs/${runId}/logs`, params);
  }

  // Console output (requires test_id)
  if (includeData.includes('console')) {
    if (!testId) {
      response.console = { error: 'test_id required for console output' };
    } else {
      response.console = await context.callApi(`/api/v1/runs/${runId}/results/${testId}/console`);
    }
  }

  // Network logs (requires test_id)
  if (includeData.includes('network')) {
    if (!testId) {
      response.network = { error: 'test_id required for network logs' };
    } else {
      response.network = await context.callApi(`/api/v1/runs/${runId}/results/${testId}/network`);
    }
  }

  // Results
  if (includeData.includes('results')) {
    response.results = await context.callApi(`/api/v1/runs/${runId}/results`);
  }

  return response;
};

// Handler registry for test results tools
export const handlers: Record<string, ToolHandler> = {
  get_result: getResult,
  get_run: getRun,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const testResultsHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default testResultsHandlers;
