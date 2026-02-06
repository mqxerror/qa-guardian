/**
 * Test Management Tool Handlers
 *
 * Handlers for test CRUD operations MCP tools.
 * Extracted from server.ts to reduce file size (Feature #1356).
 */

import { ToolHandler, HandlerModule } from './types';

/**
 * Feature #1757: Blocklist of forbidden example/demo URLs
 * These URLs should NEVER be used as test targets
 */
const FORBIDDEN_URL_PATTERNS = [
  /^https?:\/\/(www\.)?example\.(com|org|net)/i,
  /^https?:\/\/demo\.playwright\.dev/i,
  /^https?:\/\/(www\.)?todomvc\.(com|org|net)/i,
  /^https?:\/\/jsonplaceholder\.typicode\.com/i,
  /^https?:\/\/httpbin\.org/i,
  /^https?:\/\/reqres\.in/i,
  /^https?:\/\/[^/]*\bexample\b[^/]*\.(com|org|net)/i,
  /^https?:\/\/[^/]*\bdemo\b[^/]*\.(com|org|net)/i,
];

function isForbiddenUrl(url: string): boolean {
  if (!url) return false;
  return FORBIDDEN_URL_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Create a new test (Feature #1743 - improved visual test defaults)
 * (Feature #1757 - blocklist validation for forbidden URLs)
 */
export const createTest: ToolHandler = async (args, context) => {
  // Feature #1757: Block forbidden example/demo URLs
  const targetUrl = args.target_url as string | undefined;
  if (targetUrl && isForbiddenUrl(targetUrl)) {
    return {
      error: 'Forbidden URL detected',
      message: 'Cannot create test with example/demo URLs. Use the actual user-provided URL instead.',
      forbidden_url: targetUrl,
      hint: 'Use the exact URL the user provided (e.g., https://mercan.pa). Never substitute with example.com or demo sites.',
    };
  }

  // Clone args to avoid mutating the original
  const testData = { ...args };

  // Feature #1743: Set default viewport and diff_threshold for visual tests
  const testType = (testData.type as string || testData.test_type as string || '').toLowerCase();
  const isVisualTest = testType === 'visual' || testType === 'visual_regression' || testType === 'visual-regression';

  if (isVisualTest) {
    // Set default viewport dimensions (desktop: 1920x1080)
    if (!testData.viewport_width) {
      testData.viewport_width = 1920;
    }
    if (!testData.viewport_height) {
      testData.viewport_height = 1080;
    }
    // Set reasonable default diff_threshold (10% tolerance instead of exact match)
    if (testData.diff_threshold === undefined || testData.diff_threshold === null) {
      testData.diff_threshold = 0.1;
    }
  }

  return await context.callApi(`/api/v1/suites/${args.suite_id}/tests`, {
    method: 'POST',
    body: testData,
  });
};

/**
 * Cancel a running test
 */
export const cancelTest: ToolHandler = async (args, context) => {
  return await context.callApi(`/api/v1/runs/${args.run_id}/cancel`, {
    method: 'POST',
  });
};

/**
 * Cancel a test run with options (Feature #885)
 */
export const cancelRun: ToolHandler = async (args, context) => {
  return await context.callApi(`/api/v1/runs/${args.run_id}/cancel`, {
    method: 'POST',
    body: {
      force: args.force || false,
      save_partial_results: args.save_partial_results !== false, // default true
      reason: args.reason,
    },
  });
};

/**
 * Compare two test runs (Feature #892)
 */
export const compareRuns: ToolHandler = async (args, context) => {
  return await context.callApi(`/api/v1/runs/compare-results?baseRunId=${args.base_run_id}&compareRunId=${args.compare_run_id}`);
};

/**
 * Get performance metrics for a test run (Feature #893)
 */
export const getRunMetrics: ToolHandler = async (args, context) => {
  return await context.callApi(`/api/v1/runs/${args.run_id}/metrics`);
};

/**
 * Set environment variables for a run
 */
export const setRunEnvironment: ToolHandler = async (args, context) => {
  return await context.callApi(`/api/v1/runs/${args.run_id}/environment`, {
    method: 'POST',
    body: {
      env_vars: args.env_vars,
      merge: args.merge !== false, // Default to true
    },
  });
};

/**
 * Get environment variables for a run
 */
export const getRunEnvironment: ToolHandler = async (args, context) => {
  return await context.callApi(`/api/v1/runs/${args.run_id}/environment`);
};

/**
 * Get queue status
 */
export const getQueueStatus: ToolHandler = async (args, context) => {
  const queueParams = new URLSearchParams();
  if (args.include_completed) queueParams.set('include_completed', 'true');
  if (args.limit) queueParams.set('limit', String(args.limit));
  const queueQuery = queueParams.toString();
  return await context.callApi(`/api/v1/runs/queue-status${queueQuery ? `?${queueQuery}` : ''}`);
};

/**
 * Prioritize a run
 */
export const prioritizeRun: ToolHandler = async (args, context) => {
  return await context.callApi(`/api/v1/runs/${args.run_id}/prioritize`, {
    method: 'POST',
    body: args.priority !== undefined ? { priority: args.priority } : {},
  });
};

/**
 * Get available browsers for execution
 */
export const getExecutionBrowsers: ToolHandler = async (_args, context) => {
  return await context.callApi('/api/v1/browsers');
};

/**
 * Get available viewports for execution
 */
export const getExecutionViewports: ToolHandler = async (_args, context) => {
  return await context.callApi('/api/v1/viewports');
};

/**
 * Update a test (Feature #1422: now supports steps array)
 */
export const updateTest: ToolHandler = async (args, context) => {
  return await context.callApi(`/api/v1/tests/${args.test_id}`, {
    method: 'PATCH',
    body: {
      name: args.name,
      description: args.description,
      status: args.status,
      target_url: args.target_url,
      diff_threshold: args.diff_threshold,
      steps: args.steps,
    },
  });
};

/**
 * Delete a test (Feature #867)
 */
export const deleteTest: ToolHandler = async (args, context) => {
  // Safety check: require explicit confirmation
  if (args.confirm !== true) {
    return {
      error: 'Deletion requires confirm=true parameter',
      hint: 'This is a safety check. Set confirm: true to delete the test. Test history will be preserved.',
    };
  }
  // Delete the test (history is preserved on the backend)
  await context.callApi(`/api/v1/tests/${args.test_id}`, {
    method: 'DELETE',
  });
  return {
    deleted: true,
    test_id: args.test_id,
    message: 'Test deleted successfully. Test history has been preserved.',
  };
};

/**
 * Duplicate a test (Feature #868)
 */
export const duplicateTest: ToolHandler = async (args, context) => {
  // First, get the original test to copy its settings
  const originalTest = await context.callApi(`/api/v1/tests/${args.test_id}`) as Record<string, unknown>;

  // Determine the target suite (same as original if not specified)
  const targetSuiteId = args.target_suite_id || originalTest.suite_id;

  // Create the duplicate with all settings copied
  const duplicateData: Record<string, unknown> = {
    name: args.new_name || `Copy of ${originalTest.name}`,
    description: originalTest.description,
    type: originalTest.type,
    status: 'draft',  // New duplicates start as draft
    target_url: originalTest.target_url,
    diff_threshold: originalTest.diff_threshold,
    steps: originalTest.steps,
    selectors: originalTest.selectors,
    assertions: originalTest.assertions,
    timeout: originalTest.timeout,
    retries: originalTest.retries,
    browsers: originalTest.browsers,
    viewports: originalTest.viewports,
    tags: originalTest.tags,
  };

  const duplicate = await context.callApi(`/api/v1/suites/${targetSuiteId}/tests`, {
    method: 'POST',
    body: duplicateData,
  });

  return {
    duplicated: true,
    original_test_id: args.test_id,
    new_test: duplicate,
    message: 'Test duplicated successfully with all settings copied.',
  };
};

/**
 * Import tests (Feature #869)
 */
export const importTests: ToolHandler = async (args, context) => {
  const suiteId = args.suite_id as string;
  const testsToImport = args.tests as Array<Record<string, unknown>>;
  const validateOnly = args.validate_only === true;

  // Validate the tests array
  if (!Array.isArray(testsToImport) || testsToImport.length === 0) {
    return {
      error: 'tests must be a non-empty array',
      hint: 'Provide an array of test objects, each with at least a name property.',
    };
  }

  // Validate each test has a name
  const validationErrors: Array<{ index: number; error: string }> = [];
  for (let i = 0; i < testsToImport.length; i++) {
    const test = testsToImport[i];
    if (!test) {
      validationErrors.push({ index: i, error: 'Test entry is null or undefined' });
      continue;
    }
    if (!test.name || typeof test.name !== 'string' || (test.name as string).trim() === '') {
      validationErrors.push({ index: i, error: 'Test must have a non-empty name' });
    }
    if (test.type && !['e2e', 'visual', 'api', 'accessibility', 'performance'].includes(test.type as string)) {
      validationErrors.push({ index: i, error: `Invalid test type: ${test.type}` });
    }
  }

  if (validationErrors.length > 0) {
    return {
      valid: false,
      errors: validationErrors,
      message: `Validation failed for ${validationErrors.length} test(s)`,
    };
  }

  // If only validating, return success
  if (validateOnly) {
    return {
      valid: true,
      tests_count: testsToImport.length,
      message: `Validation passed. ${testsToImport.length} test(s) ready to import.`,
    };
  }

  // Import each test
  const importedTests: Array<Record<string, unknown>> = [];
  const importErrors: Array<{ index: number; name: string; error: string }> = [];

  for (let i = 0; i < testsToImport.length; i++) {
    const testData = testsToImport[i];
    if (!testData) continue; // Skip undefined entries
    try {
      // Prepare the test data with defaults
      const createData: Record<string, unknown> = {
        name: testData.name,
        type: testData.type || 'e2e',
        description: testData.description || '',
        status: 'draft',  // Imported tests start as draft
        target_url: testData.target_url,
        steps: testData.steps || [],
        selectors: testData.selectors,
        assertions: testData.assertions,
        tags: testData.tags || [],
        timeout: testData.timeout,
        retries: testData.retries,
        browsers: testData.browsers,
        viewports: testData.viewports,
        diff_threshold: testData.diff_threshold,
      };

      // Remove undefined values
      Object.keys(createData).forEach(key => {
        if (createData[key] === undefined) {
          delete createData[key];
        }
      });

      const response = await context.callApi(`/api/v1/suites/${suiteId}/tests`, {
        method: 'POST',
        body: createData,
      }) as { test: Record<string, unknown> };

      importedTests.push(response.test);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      importErrors.push({
        index: i,
        name: (testData.name as string) || 'unknown',
        error: errorMessage,
      });
    }
  }

  return {
    imported: true,
    suite_id: suiteId,
    imported_count: importedTests.length,
    failed_count: importErrors.length,
    total_count: testsToImport.length,
    imported_tests: importedTests.map(t => ({ id: t.id, name: t.name })),
    errors: importErrors.length > 0 ? importErrors : undefined,
    message: importErrors.length === 0
      ? `Successfully imported ${importedTests.length} test(s) into suite.`
      : `Imported ${importedTests.length}/${testsToImport.length} test(s). ${importErrors.length} failed.`,
  };
};

/**
 * Export tests (Feature #870)
 */
export const exportTests: ToolHandler = async (args, context) => {
  const suiteId = args.suite_id as string;
  const includeIds = args.include_ids === true;
  const includeTimestamps = args.include_timestamps === true;
  const format = (args.format as string) || 'json';

  // Fetch the tests from the suite
  const response = await context.callApi(`/api/v1/suites/${suiteId}/tests`) as { tests: Array<Record<string, unknown>> };
  const tests = response.tests || [];

  if (tests.length === 0) {
    return {
      exported: true,
      suite_id: suiteId,
      tests: [],
      count: 0,
      format,
      message: 'No tests found in this suite.',
    };
  }

  // Transform tests based on format and options
  const exportedTests = tests.map(test => {
    if (format === 'minimal') {
      // Minimal format: just name, type, description
      return {
        name: test.name,
        type: test.test_type || 'e2e',
        description: test.description || '',
      };
    }

    // Full JSON format
    const exportTest: Record<string, unknown> = {
      name: test.name,
      type: test.test_type || 'e2e',
      description: test.description || '',
      status: test.status,
      steps: test.steps || [],
      target_url: test.target_url,
      tags: test.tags || [],
      // Visual regression fields
      viewport_width: test.viewport_width,
      viewport_height: test.viewport_height,
      diff_threshold: test.diff_threshold,
      // Test configuration
      timeout: test.timeout,
      retries: test.retries,
      browsers: test.browsers,
      viewports: test.viewports,
      // Selectors and assertions
      selectors: test.selectors,
      assertions: test.assertions,
    };

    // Optionally include IDs
    if (includeIds) {
      exportTest.id = test.id;
      exportTest.suite_id = test.suite_id;
    }

    // Optionally include timestamps
    if (includeTimestamps) {
      exportTest.created_at = test.created_at;
      exportTest.updated_at = test.updated_at;
    }

    // Remove undefined values for cleaner export
    Object.keys(exportTest).forEach(key => {
      if (exportTest[key] === undefined || exportTest[key] === null) {
        delete exportTest[key];
      }
    });

    return exportTest;
  });

  return {
    exported: true,
    suite_id: suiteId,
    tests: exportedTests,
    count: exportedTests.length,
    format,
    importable: true,
    message: `Successfully exported ${exportedTests.length} test(s) from suite.`,
  };
};

/**
 * Reorder tests (Feature #871)
 */
export const reorderTests: ToolHandler = async (args, context) => {
  const suiteId = args.suite_id as string;
  const testIds = args.test_ids as string[];

  if (!Array.isArray(testIds) || testIds.length === 0) {
    return {
      error: 'test_ids must be a non-empty array of test IDs',
      hint: 'Provide an array of test IDs in the desired order.',
    };
  }

  const response = await context.callApi(`/api/v1/suites/${suiteId}/tests/reorder`, {
    method: 'PUT',
    body: { test_ids: testIds },
  }) as { reordered: boolean; suite_id: string; tests: Array<Record<string, unknown>>; count: number };

  return {
    reordered: response.reordered,
    suite_id: response.suite_id,
    tests: response.tests.map(t => ({ id: t.id, name: t.name, order: t.order })),
    count: response.count,
    message: `Successfully reordered ${response.count} test(s) in suite.`,
  };
};

/**
 * Get test code (Feature #875)
 */
export const getTestCode: ToolHandler = async (args, context) => {
  const testId = args.test_id as string;
  const format = (args.format as string) || 'typescript';

  const response = await context.callApi(`/api/v1/tests/${testId}/code?format=${format}`, {
    method: 'GET',
  }) as {
    test_id: string;
    test_name: string;
    format: string;
    code: string;
    source: 'custom' | 'generated';
    steps_count?: number;
    is_valid: boolean;
  };

  return {
    test_id: response.test_id,
    test_name: response.test_name,
    format: response.format,
    code: response.code,
    source: response.source,
    steps_count: response.steps_count,
    is_valid: response.is_valid,
    message: response.source === 'custom'
      ? `Retrieved custom Playwright code for test "${response.test_name}".`
      : `Generated Playwright code from ${response.steps_count} step(s) for test "${response.test_name}".`,
  };
};

/**
 * Update test code (Feature #876)
 */
export const updateTestCode: ToolHandler = async (args, context) => {
  const testId = args.test_id as string;
  const code = args.code as string;
  const useCustomCode = args.use_custom_code !== false; // Default to true

  if (!code || code.trim().length === 0) {
    return {
      error: 'code is required',
      hint: 'Provide the Playwright test code to save.',
    };
  }

  // Basic validation - check for essential Playwright patterns
  const hasImport = code.includes('playwright') || code.includes('@playwright');
  const hasTestFunction = code.includes('test(') || code.includes('test.describe');

  const validationWarnings: string[] = [];
  if (!hasImport) {
    validationWarnings.push('Missing Playwright import statement');
  }
  if (!hasTestFunction) {
    validationWarnings.push('Missing test() function');
  }

  // Update the test with the new code
  const response = await context.callApi(`/api/v1/tests/${testId}`, {
    method: 'PATCH',
    body: {
      playwright_code: code,
      use_custom_code: useCustomCode,
    },
  }) as { test: { id: string; name: string; playwright_code: string; use_custom_code: boolean } };

  return {
    updated: true,
    test_id: response.test.id,
    test_name: response.test.name,
    use_custom_code: response.test.use_custom_code,
    code_length: response.test.playwright_code?.length || 0,
    validation_warnings: validationWarnings.length > 0 ? validationWarnings : undefined,
    is_valid: validationWarnings.length === 0,
    message: validationWarnings.length === 0
      ? `Successfully updated Playwright code for test "${response.test.name}".`
      : `Updated Playwright code for test "${response.test.name}" with ${validationWarnings.length} warning(s).`,
  };
};

/**
 * Trigger a test run (Feature #1735, #1741 - improved error handling)
 */
export const triggerTestRun: ToolHandler = async (args, context) => {
  const suiteId = args.suite_id as string;

  if (!suiteId) {
    return {
      error: 'suite_id is required',
      hint: 'Provide the suite_id to run. Use list_test_suites to find available suites.',
    };
  }

  try {
    const response = await context.callApi(`/api/v1/suites/${suiteId}/runs`, {
      method: 'POST',
      body: {
        browser: args.browser || 'chromium',
        branch: args.branch,
      },
    }) as { run?: { id: string; status: string }; error?: string; message?: string };

    // Handle error responses (in case API returns error in body)
    if (response.error || !response.run) {
      return {
        error: response.error || 'Failed to trigger test run',
        message: response.message || 'Suite not found or has no tests',
        suite_id: suiteId,
        hint: response.message?.includes('No tests')
          ? 'This suite has no tests. Use create_test to add tests first.'
          : 'Verify the suite_id exists using list_test_suites.',
      };
    }

    return {
      run_id: response.run.id,
      suite_id: suiteId,
      status: response.run.status,
      message: 'Test run triggered successfully',
    };
  } catch (err: unknown) {
    // Feature #1741: Handle API errors (4xx, 5xx) gracefully
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Check for specific error conditions
    if (errorMessage.includes('No tests') || errorMessage.includes('400')) {
      return {
        error: 'Cannot run suite',
        message: 'This suite has no tests to run',
        suite_id: suiteId,
        hint: 'Add tests to the suite first using create_test, then try again.',
      };
    }

    if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
      return {
        error: 'Suite not found',
        message: `Test suite with ID ${suiteId} was not found`,
        suite_id: suiteId,
        hint: 'Use list_test_suites to find available suites.',
      };
    }

    // Generic error fallback
    return {
      error: 'Failed to trigger test run',
      message: errorMessage,
      suite_id: suiteId,
      hint: 'Check the suite_id and try again. Use list_test_suites to verify the suite exists.',
    };
  }
};

/**
 * Get a single test by ID (Feature #1730)
 */
export const getTest: ToolHandler = async (args, context) => {
  const testId = args.test_id as string;

  const response = await context.callApi(`/api/v1/tests/${testId}`, {
    method: 'GET',
  }) as { test: Record<string, unknown> };

  const test = response.test;

  return {
    id: test.id,
    name: test.name,
    type: test.test_type || test.type || 'e2e',
    description: test.description,
    steps: test.steps || [],
    suite_id: test.suite_id,
    status: test.status || 'active',
    target_url: test.target_url,
    created_at: test.created_at,
    updated_at: test.updated_at,
    last_run: test.last_run_at ? {
      at: test.last_run_at,
      status: test.last_run_status,
    } : null,
  };
};

/**
 * List tests in a suite (Feature #1730)
 */
export const listTests: ToolHandler = async (args, context) => {
  const suiteId = args.suite_id as string;

  const response = await context.callApi(`/api/v1/suites/${suiteId}/tests`, {
    method: 'GET',
  }) as { tests: Array<Record<string, unknown>> };

  return {
    tests: (response.tests || []).map(test => ({
      id: test.id,
      name: test.name,
      type: test.test_type || test.type || 'e2e',
      status: test.status || 'active',
    })),
    count: (response.tests || []).length,
    suite_id: suiteId,
  };
};

// Handler registry for test management tools
export const handlers: Record<string, ToolHandler> = {
  create_test: createTest,
  cancel_test: cancelTest,
  cancel_run: cancelRun,
  compare_runs: compareRuns,
  get_run_metrics: getRunMetrics,
  set_run_environment: setRunEnvironment,
  get_run_environment: getRunEnvironment,
  get_queue_status: getQueueStatus,
  prioritize_run: prioritizeRun,
  get_execution_browsers: getExecutionBrowsers,
  get_execution_viewports: getExecutionViewports,
  update_test: updateTest,
  delete_test: deleteTest,
  duplicate_test: duplicateTest,
  import_tests: importTests,
  export_tests: exportTests,
  reorder_tests: reorderTests,
  get_test_code: getTestCode,
  update_test_code: updateTestCode,
  trigger_test_run: triggerTestRun,
  get_test: getTest,  // Feature #1730
  list_tests: listTests,  // Feature #1730
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const testManagementHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default testManagementHandlers;
