/**
 * Test Execution Tool Handlers
 *
 * Handlers for test execution MCP tools.
 * Extracted from server.ts to reduce file size (Feature #1356).
 */

import { ToolHandler, HandlerModule } from './types';

/**
 * Response types for test execution
 */
interface TestRunResponse {
  run: {
    id: string;
    suite_id: string;
    test_id?: string;
    browser: string;
    status: string;
    created_at: string;
  };
  message: string;
}

/**
 * Run a single test or suite (Feature #879, #1734)
 */
export const runTest: ToolHandler = async (args, context) => {
  // Determine if this is a single test run or suite run
  if (args.test_id) {
    // Run a single test using the correct endpoint
    const testId = args.test_id as string;
    const response = await context.callApi(`/api/v1/tests/${testId}/runs`, {
      method: 'POST',
      body: {
        browser: args.browser || 'chromium',
        branch: args.branch,
      },
    }) as TestRunResponse | { error: string; message: string };

    // Feature #1734: Handle API error responses
    if ('error' in response && !('run' in response)) {
      return {
        error: response.error || 'Failed to start test run',
        message: response.message || 'Test not found or run failed to start',
        test_id: testId,
        hint: 'Verify the test_id exists using get_test before running.',
      };
    }

    const runResponse = response as TestRunResponse;
    if (!runResponse.run) {
      return {
        error: 'Invalid response from API',
        message: 'The test run API did not return a run object',
        test_id: testId,
        hint: 'The test may not exist or there was an internal error.',
      };
    }

    return {
      run_id: runResponse.run.id,
      test_id: runResponse.run.test_id,
      suite_id: runResponse.run.suite_id,
      browser: runResponse.run.browser,
      status: runResponse.run.status,
      started_at: runResponse.run.created_at,
      message: runResponse.message || 'Test run started successfully',
    };
  } else if (args.suite_id) {
    // Run a full suite
    const suiteId = args.suite_id as string;
    const response = await context.callApi(`/api/v1/suites/${suiteId}/runs`, {
      method: 'POST',
      body: {
        browser: args.browser || 'chromium',
        branch: args.branch,
      },
    }) as TestRunResponse | { error: string; message: string };

    // Feature #1734: Handle API error responses
    if ('error' in response && !('run' in response)) {
      return {
        error: response.error || 'Failed to start suite run',
        message: response.message || 'Suite not found or run failed to start',
        suite_id: suiteId,
        hint: 'Verify the suite_id exists using get_suite before running.',
      };
    }

    const runResponse = response as TestRunResponse;
    if (!runResponse.run) {
      return {
        error: 'Invalid response from API',
        message: 'The suite run API did not return a run object',
        suite_id: suiteId,
        hint: 'The suite may not exist or there was an internal error.',
      };
    }

    return {
      run_id: runResponse.run.id,
      suite_id: runResponse.run.suite_id,
      browser: runResponse.run.browser,
      status: runResponse.run.status,
      started_at: runResponse.run.created_at,
      message: runResponse.message || 'Test suite run started successfully',
    };
  } else {
    return {
      error: 'Either test_id or suite_id must be provided',
      hint: 'Provide test_id to run a single test, or suite_id to run all tests in a suite.',
    };
  }
};

/**
 * Get test suite configuration
 */
export const getTestConfig: ToolHandler = async (args, context) => {
  return await context.callApi(`/api/v1/suites/${args.suite_id}/config`);
};

/**
 * List recent test runs
 */
export const listRecentRuns: ToolHandler = async (args, context) => {
  return await context.callApi('/api/test-runs', args);
};

/**
 * Get test artifacts for a run
 */
export const getTestArtifacts: ToolHandler = async (args, context) => {
  return await context.callApi(`/api/v1/runs/${args.run_id}/artifacts`, {
    artifact_type: args.artifact_type,
  });
};

// Handler registry for test execution tools
export const handlers: Record<string, ToolHandler> = {
  run_test: runTest,
  get_test_config: getTestConfig,
  list_recent_runs: listRecentRuns,
  get_test_artifacts: getTestArtifacts,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const testExecutionHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default testExecutionHandlers;
