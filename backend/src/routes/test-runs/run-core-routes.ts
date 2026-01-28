/**
 * Run Core Routes Module (Feature #1356 - Code Quality)
 * Extracted from test-runs.ts to reduce file size
 * Contains: Run CRUD operations, status, results, listing
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../middleware/auth';
import { getTest, getTestSuite, getTestsMap, getTestSuitesMap } from '../test-suites';
import { testRuns, runningBrowsers, TestRun, BrowserType, TestRunResult } from './execution';
import { getTestRun as dbGetTestRun, listTestRunsBySuite as dbListTestRunsBySuite, listTestRunsByOrg as dbListTestRunsByOrg } from '../../services/repositories/test-runs';

// Helper: get test run from Map first, then fall back to DB
async function getTestRunWithFallback(runId: string): Promise<TestRun | undefined> {
  const fromMap = testRuns.get(runId);
  if (fromMap) return fromMap;
  return await dbGetTestRun(runId) as TestRun | undefined;
}

// Type definitions for route params
interface TestRunParams {
  runId: string;
}

interface RunParams {
  suiteId: string;
}

interface TestIdParams {
  testId: string;
}

interface GetResultsQuery {
  status?: string;
  page?: number;
  limit?: number;
}

interface ResultDetailsParams {
  runId: string;
  resultIndex: string;
}

// Helper function for emitting events (will be passed from parent)
type EmitRunEventFn = (runId: string, orgId: string, event: string, data: any) => void;

// Store reference to emitRunEvent function
let emitRunEvent: EmitRunEventFn = () => {};

/**
 * Set the emitRunEvent function (called from test-runs.ts)
 */
export function setRunCoreEmitter(emitter: EmitRunEventFn) {
  emitRunEvent = emitter;
}

/**
 * Register run core routes
 */
export async function runCoreRoutes(app: FastifyInstance) {
  // Get test run status and results
  app.get<{ Params: TestRunParams }>('/api/v1/runs/:runId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    return {
      run: {
        id: run.id,
        suite_id: run.suite_id,
        test_id: run.test_id,
        organization_id: run.organization_id,
        status: run.status,
        started_at: run.started_at?.toISOString(),
        completed_at: run.completed_at?.toISOString(),
        duration_ms: run.duration_ms,
        created_at: run.created_at.toISOString(),
        results: run.results,
        error: run.error,
      },
    };
  });

  // Get test run results with filtering and pagination
  app.get<{ Params: TestRunParams; Querystring: GetResultsQuery }>('/api/v1/runs/:runId/results', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const { status, page = 1, limit = 50 } = request.query;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    let results = run.results || [];

    // Filter by status if specified
    if (status) {
      results = results.filter(r => r.status === status);
    }

    // Calculate pagination
    const total = results.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedResults = results.slice(offset, offset + limit);

    // Add index to each result for reference
    const resultsWithIndex = paginatedResults.map((result, idx) => ({
      ...result,
      index: offset + idx,
    }));

    return {
      run_id: runId,
      run_status: run.status,
      results: resultsWithIndex,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
      summary: {
        total: run.results?.length || 0,
        passed: run.results?.filter(r => r.status === 'passed').length || 0,
        failed: run.results?.filter(r => r.status === 'failed').length || 0,
        skipped: run.results?.filter(r => r.status === 'skipped').length || 0,
      },
    };
  });

  // Get detailed result for a specific test in a run
  app.get<{ Params: ResultDetailsParams }>('/api/v1/runs/:runId/results/:resultIndex', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, resultIndex } = request.params;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    const idx = parseInt(resultIndex, 10);
    if (isNaN(idx) || idx < 0 || !run.results || idx >= run.results.length) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Result not found at specified index',
      });
    }

    const result = run.results![idx];

    // Get test details for additional context
    const test = result?.test_id ? await getTest(result.test_id) : null;
    const suite = test ? await getTestSuite(test.suite_id) : null;

    return {
      run_id: runId,
      run_status: run.status,
      result_index: idx,
      result: {
        ...result,
        test_name: test?.name || 'Unknown Test',
        test_description: test?.description,
        suite_name: suite?.name || 'Unknown Suite',
      },
      navigation: {
        has_prev: idx > 0,
        has_next: run.results && idx < run.results.length - 1,
        prev_index: idx > 0 ? idx - 1 : null,
        next_index: run.results && idx < run.results.length - 1 ? idx + 1 : null,
        total_results: run.results?.length || 0,
      },
    };
  });

  // Get run status
  app.get<{ Params: TestRunParams }>('/api/v1/runs/:runId/status', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    // Check if there's an active browser for this run
    const browserState = runningBrowsers.get(runId);

    return {
      run_id: runId,
      status: run.status,
      is_active: !!browserState,
      is_paused: browserState?.paused || false,
      is_cancelled: browserState?.cancelled || false,
      created_at: run.created_at.toISOString(),
      started_at: run.started_at?.toISOString(),
      completed_at: run.completed_at?.toISOString(),
      duration_ms: run.duration_ms,
      results_count: run.results?.length || 0,
    };
  });

  // Get run progress (detailed progress during execution)
  app.get<{ Params: TestRunParams }>('/api/v1/runs/:runId/progress', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    // Get tests to run for this run
    let testsToRun: any[] = [];
    if (run.test_id) {
      const test = await getTest(run.test_id);
      if (test) testsToRun = [test];
    } else if (run.suite_id) {
      testsToRun = Array.from((await getTestsMap()).values()).filter(t => t.suite_id === run.suite_id);
    }

    const totalTests = testsToRun.length;
    const completedTests = run.results?.length || 0;
    const passedTests = run.results?.filter(r => r.status === 'passed').length || 0;
    const failedTests = run.results?.filter(r => r.status === 'failed').length || 0;
    const skippedTests = run.results?.filter(r => r.status === 'skipped').length || 0;
    const remainingTests = totalTests - completedTests;

    // Calculate progress percentage
    const progressPercent = totalTests > 0 ? Math.round((completedTests / totalTests) * 100) : 0;

    // Estimate remaining time based on average duration
    let estimatedRemainingMs: number | null = null;
    if (run.results && run.results.length > 0 && remainingTests > 0) {
      const completedDurations = run.results
        .filter(r => r.duration_ms != null)
        .map(r => r.duration_ms!);
      if (completedDurations.length > 0) {
        const avgDuration = completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length;
        estimatedRemainingMs = Math.round(avgDuration * remainingTests);
      }
    }

    // Get current test being executed (if any)
    let currentTest: { id: string; name: string; index: number } | null = null;
    if (run.status === 'running' && completedTests < totalTests) {
      const currentIndex = completedTests;
      const testToRun = testsToRun[currentIndex];
      if (testToRun) {
        currentTest = {
          id: testToRun.id,
          name: testToRun.name,
          index: currentIndex,
        };
      }
    }

    return {
      run_id: runId,
      status: run.status,
      progress: {
        percent: progressPercent,
        total_tests: totalTests,
        completed_tests: completedTests,
        remaining_tests: remainingTests,
      },
      results_summary: {
        passed: passedTests,
        failed: failedTests,
        skipped: skippedTests,
      },
      timing: {
        started_at: run.started_at?.toISOString(),
        elapsed_ms: run.started_at ? Date.now() - run.started_at.getTime() : null,
        estimated_remaining_ms: estimatedRemainingMs,
      },
      current_test: currentTest,
    };
  });

  // List test runs for a suite
  app.get<{ Params: RunParams }>('/api/v1/suites/:suiteId/runs', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { suiteId } = request.params;
    const orgId = getOrganizationId(request);

    // Verify suite exists
    const suite = await getTestSuite(suiteId);
    if (!suite || suite.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test suite not found',
      });
    }

    const allSuiteRuns = await dbListTestRunsBySuite(suiteId, orgId);
    const runs = allSuiteRuns
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(r => ({
        id: r.id,
        suite_id: r.suite_id,
        test_id: r.test_id,
        status: r.status,
        browser: r.browser,
        branch: r.branch,
        created_at: r.created_at.toISOString(),
        started_at: r.started_at?.toISOString(),
        completed_at: r.completed_at?.toISOString(),
        duration_ms: r.duration_ms,
        results_count: r.results?.length || 0,
        passed_count: r.results?.filter(res => res.status === 'passed').length || 0,
        failed_count: r.results?.filter(res => res.status === 'failed').length || 0,
      }));

    return {
      suite_id: suiteId,
      runs,
      total: runs.length,
    };
  });

  // List test runs for a specific test
  app.get<{ Params: TestIdParams }>('/api/v1/tests/:testId/runs', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const orgId = getOrganizationId(request);

    // Verify test exists
    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    // Feature #1984: Include batch runs that contain results for this test
    // Check both direct test_id match (single test run) AND results array for suite runs
    const allOrgRuns = await dbListTestRunsByOrg(orgId);
    const runs = allOrgRuns
      .filter(r => {
        // Direct single-test run
        if (r.test_id === testId) return true;
        // Suite/batch run that includes this test in results
        if (r.results && r.results.some(result => result.test_id === testId)) return true;
        return false;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(r => {
        // For suite runs, extract only the result for this specific test
        const testResult = r.test_id === testId
          ? r.results?.[0] // Single test run - use first result
          : r.results?.find(result => result.test_id === testId) || null; // Suite run - find matching result
        return {
          id: r.id,
          suite_id: r.suite_id,
          test_id: r.test_id || testId, // Use testId for suite runs
          status: testResult?.status || r.status, // Use test-specific status if available
          browser: r.browser,
          branch: r.branch,
          created_at: r.created_at.toISOString(),
          started_at: r.started_at?.toISOString(),
          completed_at: r.completed_at?.toISOString(),
          duration_ms: testResult?.duration_ms || r.duration_ms,
          result: testResult || null,
          is_batch_run: !r.test_id, // Flag to indicate this was part of a batch/suite run
          batch_run_id: !r.test_id ? r.id : undefined, // Link to the full batch run
        };
      });

    return {
      test_id: testId,
      runs,
      total: runs.length,
    };
  });

  // List all recent test runs across the organization
  // Feature: MCP tool list_recent_runs support
  app.get<{ Querystring: { limit?: number; status?: string; suite_id?: string; project_id?: string } }>('/api/test-runs', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { limit = 50, status, suite_id, project_id } = request.query;
    const orgId = getOrganizationId(request);

    let runs = await dbListTestRunsByOrg(orgId);

    // Filter by status if specified
    if (status) {
      runs = runs.filter(r => r.status === status);
    }

    // Filter by suite_id if specified
    if (suite_id) {
      runs = runs.filter(r => r.suite_id === suite_id);
    }

    // Filter by project_id if specified (need to check suite's project)
    if (project_id) {
      const suitesMap = await getTestSuitesMap();
      runs = runs.filter(r => {
        const suite = suitesMap.get(r.suite_id);
        return suite && suite.project_id === project_id;
      });
    }

    // Sort by created_at descending (most recent first)
    runs = runs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Apply limit
    runs = runs.slice(0, limit);

    // Map to response format
    const allSuites = await getTestSuitesMap();
    const allTests = await getTestsMap();
    const runsResponse = runs.map(r => {
      const suite = allSuites.get(r.suite_id);
      const test = r.test_id ? allTests.get(r.test_id) : null;
      return {
        id: r.id,
        suite_id: r.suite_id,
        suite_name: suite?.name || 'Unknown Suite',
        project_id: suite?.project_id,
        test_id: r.test_id,
        test_name: test?.name,
        status: r.status,
        browser: r.browser,
        branch: r.branch,
        created_at: r.created_at.toISOString(),
        started_at: r.started_at?.toISOString(),
        completed_at: r.completed_at?.toISOString(),
        duration_ms: r.duration_ms,
        results_count: r.results?.length || 0,
        passed_count: r.results?.filter(res => res.status === 'passed').length || 0,
        failed_count: r.results?.filter(res => res.status === 'failed').length || 0,
        skipped_count: r.results?.filter(res => res.status === 'skipped').length || 0,
      };
    });

    return {
      runs: runsResponse,
      total: runsResponse.length,
      filters: {
        limit,
        status: status || null,
        suite_id: suite_id || null,
        project_id: project_id || null,
      },
    };
  });
}
