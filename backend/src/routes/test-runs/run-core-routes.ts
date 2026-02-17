/**
 * Run Core Routes Module (Feature #1356 - Code Quality)
 * Extracted from test-runs.ts to reduce file size
 * Contains: Run CRUD operations, status, results, listing
 * Feature #61: Redis caching integration
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../middleware/auth.js';
import { getTest, getTestSuite, getTestsMap, getTestSuitesMap, getTestsMapByOrg, getTestSuitesMapByOrg, listTests, batchGetTests, batchGetTestSuites } from '../test-suites.js';
import type { Test } from '../test-suites/types.js';
import { testRuns, runningBrowsers, TestRun, TestRunResult, TestRunStatus } from './execution.js';

// Feature #414: Valid TestRunStatus values for validation
const validStatuses: TestRunStatus[] = ['pending', 'running', 'paused', 'passed', 'failed', 'warning', 'error', 'cancelled', 'cancelling', 'visual_approved', 'visual_rejected'];
import { getTestRun as dbGetTestRun, listTestRunsBySuite as dbListTestRunsBySuite, listTestRunsByOrg as dbListTestRunsByOrg, listTestRunsByTestId as dbListTestRunsByTestId, listTestRunsPaginated, type PaginatedTestRunsResult } from '../../services/repositories/test-runs.js';
// Feature #61: Redis caching
import { getCache, CacheKeys, CacheTTL } from '../../services/cache.js';

import { sendError } from '../../utils/errors.js';
// Helper: get test run from DB first (worker may have updated it), fall back to Map
// Feature #169: DB-first lookup to support separate worker container architecture
async function getTestRunWithFallback(runId: string): Promise<TestRun | undefined> {
  const fromDb = await dbGetTestRun(runId) as TestRun | undefined;
  if (fromDb) return fromDb;
  return testRuns.get(runId);
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
type EmitRunEventFn = (runId: string, orgId: string, event: string, data: Record<string, unknown>) => void;

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
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
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
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
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
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    const idx = parseInt(resultIndex, 10);
    if (isNaN(idx) || idx < 0 || !run.results || idx >= run.results.length) {
      return sendError(reply, 404, 'NOT_FOUND', 'Result not found at specified index');
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
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
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
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    // Get tests to run for this run
    let testsToRun: Test[] = [];
    if (run.test_id) {
      const test = await getTest(run.test_id);
      if (test) testsToRun = [test];
    } else if (run.suite_id) {
      // Feature #707: Use listTests() instead of full table scan + filter
      testsToRun = await listTests(run.suite_id);
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
  // Feature #61: Cached for 1 minute (runs change frequently)
  app.get<{ Params: RunParams }>('/api/v1/suites/:suiteId/runs', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { suiteId } = request.params;
    const orgId = getOrganizationId(request);
    const cache = getCache();

    // Verify suite exists
    const suite = await getTestSuite(suiteId);
    if (!suite || suite.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test suite not found');
    }

    // Feature #61: Try to get runs list from cache first
    const cacheKey = CacheKeys.runs.bySuite(suiteId);
    let allSuiteRuns = await cache.get<TestRun[]>(cacheKey);
    if (!allSuiteRuns) {
      allSuiteRuns = await dbListTestRunsBySuite(suiteId, orgId);
      // Cache with SHORT TTL since runs change frequently
      await cache.set(cacheKey, allSuiteRuns, CacheTTL.SHORT);
    }
    const runs = allSuiteRuns
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(r => {
        // Handle both Date objects (from DB) and ISO strings (from Redis cache)
        const createdAt = r.created_at instanceof Date ? r.created_at : new Date(r.created_at);
        const startedAt = r.started_at ? (r.started_at instanceof Date ? r.started_at : new Date(r.started_at)) : null;
        const completedAt = r.completed_at ? (r.completed_at instanceof Date ? r.completed_at : new Date(r.completed_at)) : null;
        return {
        id: r.id,
        suite_id: r.suite_id,
        test_id: r.test_id,
        status: r.status,
        browser: r.browser,
        branch: r.branch,
        created_at: createdAt.toISOString(),
        started_at: startedAt?.toISOString(),
        completed_at: completedAt?.toISOString(),
        duration_ms: r.duration_ms,
        results_count: r.results?.length || 0,
        passed_count: r.results?.filter((res: { status: string }) => res.status === 'passed').length || 0,
        failed_count: r.results?.filter((res: { status: string }) => res.status === 'failed').length || 0,
      };
      });

    return {
      suite_id: suiteId,
      runs,
      total: runs.length,
    };
  });

  // List test runs for a specific test
  // Feature #61: Cached for 1 minute (runs change frequently)
  // Feature #135: Use direct SQL query by test_id instead of loading all org runs
  app.get<{ Params: TestIdParams }>('/api/v1/tests/:testId/runs', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const orgId = getOrganizationId(request);
    const cache = getCache();

    // Verify test exists
    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
    }

    // Feature #61: Try to get runs list from cache first
    const cacheKey = CacheKeys.runs.byTest(testId);
    let testRuns = await cache.get<TestRun[]>(cacheKey);
    if (!testRuns) {
      // Feature #135: Query directly by test_id (not loading all org runs)
      // This function handles both direct test_id match AND suite runs containing this test
      testRuns = await dbListTestRunsByTestId(testId, orgId, 50);
      // Cache with SHORT TTL since runs change frequently
      await cache.set(cacheKey, testRuns, CacheTTL.SHORT);
    }

    // Transform runs to response format (SQL already handled filtering and sorting)
    const runs = testRuns.map(r => {
      // For suite runs, extract only the result for this specific test
      const testResult = r.test_id === testId
        ? r.results?.[0] // Single test run - use first result
        : r.results?.find(result => result.test_id === testId) || null; // Suite run - find matching result
      // Feature #68: Handle both Date objects and ISO strings (from cache)
      const createdAt = r.created_at instanceof Date ? r.created_at : new Date(r.created_at);
      const startedAt = r.started_at ? (r.started_at instanceof Date ? r.started_at : new Date(r.started_at)) : null;
      const completedAt = r.completed_at ? (r.completed_at instanceof Date ? r.completed_at : new Date(r.completed_at)) : null;
      return {
        id: r.id,
        suite_id: r.suite_id,
        test_id: r.test_id || testId, // Use testId for suite runs
        status: testResult?.status || r.status, // Use test-specific status if available
        browser: r.browser,
        branch: r.branch,
        created_at: createdAt.toISOString(),
        started_at: startedAt?.toISOString(),
        completed_at: completedAt?.toISOString(),
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
  // Feature #53: Server-side pagination support
  // Feature: MCP tool list_recent_runs support
  // Feature #61: Cached for 1 minute (runs change frequently)
  app.get<{ Querystring: { page?: number; limit?: number; offset?: number; status?: string; suite_id?: string; project_id?: string } }>('/api/v1/test-runs', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { page = 1, limit = 50, offset, status, suite_id, project_id } = request.query;
    const orgId = getOrganizationId(request);
    const cache = getCache();

    // Feature #61: Build cache key from org and filters
    const cacheKey = `runs:list:${orgId}:p${page}:l${limit}:o${offset || 0}:s${status || 'all'}:suite${suite_id || 'all'}:proj${project_id || 'all'}`;
    let result = await cache.get<PaginatedTestRunsResult>(cacheKey);

    if (!result) {
      // Use new paginated function for efficient server-side pagination
      // Feature #414: Validate status against valid TestRunStatus values
      const validatedStatus = status && validStatuses.includes(status as TestRunStatus)
        ? (status as TestRunStatus)
        : undefined;

      result = await listTestRunsPaginated(orgId, {
        page: Number(page),
        limit: Number(limit),
        offset: offset !== undefined ? Number(offset) : undefined,
        status: validatedStatus,
        suite_id,
        project_id,
      });
      // Cache with SHORT TTL since runs change frequently
      await cache.set(cacheKey, result, CacheTTL.SHORT);
    }

    // Feature #707: Use batch functions instead of full table scans
    // Collect unique IDs from the runs to batch fetch only needed records
    type RunData = { suite_id: string; test_id?: string };
    const suiteIds = Array.from(new Set((result.data as RunData[]).map(r => r.suite_id)));
    const testIds = Array.from(new Set((result.data as RunData[]).filter(r => r.test_id).map(r => r.test_id as string)));
    const allSuites = await batchGetTestSuites(suiteIds);
    const allTests = await batchGetTests(testIds);
    // Helper to safely convert date to ISO string
    const toISOString = (date: Date | string | null | undefined): string | null => {
      if (!date) return null;
      if (date instanceof Date) return date.toISOString();
      return date; // Already a string from PostgreSQL
    };

    type ResultStatus = { status: string };
    const runsResponse = result.data.map((r: { suite_id: string; test_id?: string; id: string; project_id?: string; status: string; browser?: string; branch?: string; created_at: Date | string; started_at?: Date | string | null; completed_at?: Date | string | null; duration_ms?: number; results?: ResultStatus[] }) => {
      const suite = allSuites.get(r.suite_id);
      const test = r.test_id ? allTests.get(r.test_id) : null;
      return {
        id: r.id,
        suite_id: r.suite_id,
        suite_name: suite?.name || 'Unknown Suite',
        project_id: suite?.project_id || r.project_id,
        test_id: r.test_id,
        test_name: test?.name,
        status: r.status,
        browser: r.browser,
        branch: r.branch,
        created_at: toISOString(r.created_at),
        started_at: toISOString(r.started_at),
        completed_at: toISOString(r.completed_at),
        duration_ms: r.duration_ms,
        results_count: r.results?.length || 0,
        passed_count: r.results?.filter((res: ResultStatus) => res.status === 'passed').length || 0,
        failed_count: r.results?.filter((res: ResultStatus) => res.status === 'failed').length || 0,
        skipped_count: r.results?.filter((res: ResultStatus) => res.status === 'skipped').length || 0,
      };
    });

    return {
      data: runsResponse,
      pagination: result.pagination,
      // Also include 'runs' and 'total' for backwards compatibility
      runs: runsResponse,
      total: result.pagination.total,
      filters: {
        page: result.pagination.page,
        limit: result.pagination.limit,
        status: status || null,
        suite_id: suite_id || null,
        project_id: project_id || null,
      },
    };
  });
}
