/**
 * Run Data Routes Module (Feature #1356 - Code Quality)
 * Extracted from test-runs.ts to reduce file size
 * Contains: Logs, console output, network logs, metrics, environment, compare results
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../middleware/auth';
import { tests, testSuites } from '../test-suites';
import { projectEnvVars } from '../projects';
import { testRuns } from './execution';

// Type definitions
interface TestRunParams {
  runId: string;
}

interface GetRunLogsQuery {
  level?: 'all' | 'error' | 'warn' | 'info' | 'debug' | 'log';
  limit?: number;
  offset?: number;
}

interface SetRunEnvVarsBody {
  env_vars: Record<string, string>;
  merge?: boolean;
}

interface DeleteRunEnvVarsBody {
  keys?: string[];
}

/**
 * Register run data routes
 */
export async function runDataRoutes(app: FastifyInstance) {
  // Feature #889: Get console logs for a test run
  app.get<{ Params: TestRunParams; Querystring: GetRunLogsQuery }>('/api/v1/runs/:runId/logs', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);
    const { level = 'all', limit = 100, offset = 0 } = request.query;

    const run = testRuns.get(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    // Collect all console logs from all test results
    const allLogs: Array<{
      timestamp: string;
      level: string;
      message: string;
      location?: string;
      test_id?: string;
      test_name?: string;
    }> = [];

    const results = run.results || [];
    for (const result of results) {
      const testInfo = tests.get(result.test_id);
      const testName = testInfo?.name || 'Unknown Test';

      if (result.console_logs && Array.isArray(result.console_logs)) {
        for (const log of result.console_logs) {
          // Filter by level if not 'all'
          if (level !== 'all' && log.level !== level) {
            continue;
          }

          allLogs.push({
            timestamp: new Date(log.timestamp).toISOString(),
            level: log.level,
            message: log.message,
            location: log.location,
            test_id: result.test_id,
            test_name: testName,
          });
        }
      }
    }

    // Sort by timestamp
    allLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Apply pagination
    const paginatedLogs = allLogs.slice(offset, offset + limit);

    // Calculate log level counts
    const levelCounts = {
      error: allLogs.filter(l => l.level === 'error').length,
      warn: allLogs.filter(l => l.level === 'warn').length,
      info: allLogs.filter(l => l.level === 'info').length,
      debug: allLogs.filter(l => l.level === 'debug').length,
      log: allLogs.filter(l => l.level === 'log').length,
    };

    return {
      run_id: runId,
      status: run.status,
      logs: paginatedLogs,
      pagination: {
        total: allLogs.length,
        limit,
        offset,
        has_more: offset + limit < allLogs.length,
      },
      level_counts: levelCounts,
      filter: {
        level: level,
      },
    };
  });

  // Feature #890: Get console output for a specific test result
  app.get<{ Params: { runId: string; testId: string } }>('/api/v1/runs/:runId/results/:testId/console', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const orgId = getOrganizationId(request);

    const run = testRuns.get(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    const result = run.results?.find(r => r.test_id === testId);
    if (!result) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test result not found',
      });
    }

    const testInfo = tests.get(testId);
    const consoleLogs = result.console_logs || [];

    // Categorize logs by level with highlighting info
    const categorizedLogs = {
      errors: consoleLogs.filter((l: any) => l.level === 'error').map((l: any) => ({
        ...l,
        timestamp: new Date(l.timestamp).toISOString(),
        highlighted: true,
        severity: 'high',
      })),
      warnings: consoleLogs.filter((l: any) => l.level === 'warn').map((l: any) => ({
        ...l,
        timestamp: new Date(l.timestamp).toISOString(),
        highlighted: true,
        severity: 'medium',
      })),
      info: consoleLogs.filter((l: any) => l.level === 'info' || l.level === 'log').map((l: any) => ({
        ...l,
        timestamp: new Date(l.timestamp).toISOString(),
        highlighted: false,
        severity: 'low',
      })),
      debug: consoleLogs.filter((l: any) => l.level === 'debug').map((l: any) => ({
        ...l,
        timestamp: new Date(l.timestamp).toISOString(),
        highlighted: false,
        severity: 'none',
      })),
    };

    // All logs in chronological order with highlighting
    const allLogs = consoleLogs.map((l: any) => ({
      timestamp: new Date(l.timestamp).toISOString(),
      level: l.level,
      message: l.message,
      location: l.location,
      highlighted: l.level === 'error' || l.level === 'warn',
      severity: l.level === 'error' ? 'high' : l.level === 'warn' ? 'medium' : 'low',
    })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      run_id: runId,
      test_id: testId,
      test_name: testInfo?.name || 'Unknown Test',
      test_status: result.status,
      console_output: {
        total: consoleLogs.length,
        by_level: {
          error: categorizedLogs.errors.length,
          warn: categorizedLogs.warnings.length,
          info: categorizedLogs.info.length,
          debug: categorizedLogs.debug.length,
        },
        has_errors: categorizedLogs.errors.length > 0,
        has_warnings: categorizedLogs.warnings.length > 0,
      },
      logs: allLogs,
      categorized: categorizedLogs,
    };
  });

  // Feature #891: Get network logs for a specific test result
  app.get<{ Params: { runId: string; testId: string } }>('/api/v1/runs/:runId/results/:testId/network', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const orgId = getOrganizationId(request);

    const run = testRuns.get(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    const result = run.results?.find(r => r.test_id === testId);
    if (!result) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test result not found',
      });
    }

    const testInfo = tests.get(testId);
    const networkRequests = result.network_requests || [];

    // Calculate statistics
    const totalRequests = networkRequests.length;
    const failedRequests = networkRequests.filter((r: any) => r.failed || (r.status && r.status >= 400));
    const successfulRequests = networkRequests.filter((r: any) => !r.failed && (!r.status || r.status < 400));

    // Calculate response times
    const responseTimes = networkRequests
      .filter((r: any) => r.duration_ms !== undefined)
      .map((r: any) => r.duration_ms!);
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length)
      : null;
    const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : null;
    const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : null;

    // Group by resource type
    const byResourceType: Record<string, number> = {};
    for (const req of networkRequests) {
      const type = (req as any).resourceType || 'other';
      byResourceType[type] = (byResourceType[type] || 0) + 1;
    }

    // Format requests for response with flagging failed ones
    const formattedRequests = networkRequests.map((req: any) => ({
      timestamp: new Date(req.timestamp).toISOString(),
      method: req.method,
      url: req.url,
      resource_type: req.resourceType,
      status: req.status,
      status_text: req.statusText,
      duration_ms: req.duration_ms,
      request_size: req.requestSize,
      response_size: req.responseSize,
      failed: req.failed || (req.status && req.status >= 400),
      failure_reason: req.failureText || (req.status && req.status >= 400 ? `HTTP ${req.status}` : null),
      is_slow: req.duration_ms && req.duration_ms > 1000, // Flag requests over 1 second
    })).sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      run_id: runId,
      test_id: testId,
      test_name: testInfo?.name || 'Unknown Test',
      test_status: result.status,
      network_summary: {
        total_requests: totalRequests,
        successful_requests: successfulRequests.length,
        failed_requests: failedRequests.length,
        has_failures: failedRequests.length > 0,
        by_resource_type: byResourceType,
      },
      response_times: {
        avg_ms: avgResponseTime,
        max_ms: maxResponseTime,
        min_ms: minResponseTime,
      },
      requests: formattedRequests,
      failed_requests: formattedRequests.filter((r: any) => r.failed),
    };
  });

  // Feature #892: Compare two test runs (general comparison, not just K6)
  app.get<{ Querystring: { baseRunId: string; compareRunId: string } }>('/api/v1/runs/compare-results', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { baseRunId, compareRunId } = request.query;
    const orgId = getOrganizationId(request);

    if (!baseRunId || !compareRunId) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Both baseRunId and compareRunId query parameters are required',
      });
    }

    const baseRun = testRuns.get(baseRunId);
    const compareRun = testRuns.get(compareRunId);

    if (!baseRun || baseRun.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Base run with ID ${baseRunId} not found`,
      });
    }

    if (!compareRun || compareRun.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Compare run with ID ${compareRunId} not found`,
      });
    }

    // Check if both runs are completed
    const completedStatuses = ['passed', 'failed', 'cancelled', 'error'];
    if (!completedStatuses.includes(baseRun.status)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Base run has not completed yet',
        status: baseRun.status,
      });
    }

    if (!completedStatuses.includes(compareRun.status)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Compare run has not completed yet',
        status: compareRun.status,
      });
    }

    const baseResults = baseRun.results || [];
    const compareResults = compareRun.results || [];

    // Create maps for easy lookup
    const baseResultsMap = new Map(baseResults.map(r => [r.test_id, r]));
    const compareResultsMap = new Map(compareResults.map(r => [r.test_id, r]));

    // Find new failures (passed in base, failed in compare)
    const newFailures: Array<{
      test_id: string;
      test_name: string;
      base_status: string;
      compare_status: string;
      error?: string;
    }> = [];

    // Find fixed tests (failed in base, passed in compare)
    const fixedTests: Array<{
      test_id: string;
      test_name: string;
      base_status: string;
      compare_status: string;
    }> = [];

    // Find unchanged tests
    const unchangedTests: Array<{
      test_id: string;
      test_name: string;
      status: string;
    }> = [];

    // Process all tests from both runs
    const allTestIds = new Set([...baseResultsMap.keys(), ...compareResultsMap.keys()]);

    for (const testId of allTestIds) {
      const baseResult = baseResultsMap.get(testId);
      const compareResult = compareResultsMap.get(testId);
      const testInfo = tests.get(testId);
      const testName = testInfo?.name || 'Unknown Test';

      if (baseResult && compareResult) {
        // Test exists in both runs
        if (baseResult.status === 'passed' && compareResult.status === 'failed') {
          newFailures.push({
            test_id: testId,
            test_name: testName,
            base_status: baseResult.status,
            compare_status: compareResult.status,
            error: compareResult.error,
          });
        } else if (baseResult.status === 'failed' && compareResult.status === 'passed') {
          fixedTests.push({
            test_id: testId,
            test_name: testName,
            base_status: baseResult.status,
            compare_status: compareResult.status,
          });
        } else if (baseResult.status === compareResult.status) {
          unchangedTests.push({
            test_id: testId,
            test_name: testName,
            status: baseResult.status,
          });
        }
      }
    }

    // Calculate summary statistics
    const basePassed = baseResults.filter(r => r.status === 'passed').length;
    const baseFailed = baseResults.filter(r => r.status === 'failed').length;
    const comparePassed = compareResults.filter(r => r.status === 'passed').length;
    const compareFailed = compareResults.filter(r => r.status === 'failed').length;

    const basePassRate = baseResults.length > 0 ? Math.round((basePassed / baseResults.length) * 100) : 0;
    const comparePassRate = compareResults.length > 0 ? Math.round((comparePassed / compareResults.length) * 100) : 0;
    const passRateDiff = comparePassRate - basePassRate;

    return {
      comparison: {
        base_run: {
          id: baseRunId,
          status: baseRun.status,
          total_tests: baseResults.length,
          passed: basePassed,
          failed: baseFailed,
          pass_rate: basePassRate,
          completed_at: baseRun.completed_at?.toISOString(),
        },
        compare_run: {
          id: compareRunId,
          status: compareRun.status,
          total_tests: compareResults.length,
          passed: comparePassed,
          failed: compareFailed,
          pass_rate: comparePassRate,
          completed_at: compareRun.completed_at?.toISOString(),
        },
        summary: {
          pass_rate_change: passRateDiff,
          pass_rate_improved: passRateDiff > 0,
          new_failures_count: newFailures.length,
          fixed_tests_count: fixedTests.length,
          unchanged_count: unchangedTests.length,
          overall_trend: passRateDiff > 0 ? 'improved' : passRateDiff < 0 ? 'regressed' : 'stable',
        },
      },
      new_failures: newFailures,
      fixed_tests: fixedTests,
      unchanged_tests: unchangedTests,
    };
  });

  // Feature #893: Get performance metrics for a test run
  app.get<{ Params: TestRunParams }>('/api/v1/runs/:runId/metrics', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);

    const run = testRuns.get(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    const results = run.results || [];
    const suite = testSuites.get(run.suite_id);

    // Duration metrics
    const testDurations = results
      .filter(r => r.duration_ms !== undefined)
      .map(r => r.duration_ms!);
    const totalDuration = run.duration_ms || (
      run.started_at && run.completed_at
        ? run.completed_at.getTime() - run.started_at.getTime()
        : testDurations.reduce((a, b) => a + b, 0)
    );
    const avgTestDuration = testDurations.length > 0
      ? Math.round(testDurations.reduce((a, b) => a + b, 0) / testDurations.length)
      : null;
    const maxTestDuration = testDurations.length > 0 ? Math.max(...testDurations) : null;
    const minTestDuration = testDurations.length > 0 ? Math.min(...testDurations) : null;

    // Pass/fail counts
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const error = results.filter(r => r.status === 'error').length;
    const total = results.length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    // Browser breakdown (from suite config)
    const browserInfo = suite ? {
      browser: (suite as any).browser || 'chromium',
      viewport: (suite as any).viewport || { width: 1280, height: 720 },
    } : {
      browser: 'unknown',
      viewport: { width: 1280, height: 720 },
    };

    // Test type breakdown
    const testTypeBreakdown: Record<string, { count: number; passed: number; failed: number }> = {};
    for (const result of results) {
      const testInfo = tests.get(result.test_id);
      const testType = (testInfo as any)?.test_type || 'e2e';
      if (!testTypeBreakdown[testType]) {
        testTypeBreakdown[testType] = { count: 0, passed: 0, failed: 0 };
      }
      testTypeBreakdown[testType].count++;
      if (result.status === 'passed') {
        testTypeBreakdown[testType].passed++;
      } else if (result.status === 'failed') {
        testTypeBreakdown[testType].failed++;
      }
    }

    // Slowest tests
    const slowestTests = results
      .filter(r => r.duration_ms !== undefined)
      .sort((a, b) => (b.duration_ms || 0) - (a.duration_ms || 0))
      .slice(0, 5)
      .map(r => {
        const testInfo = tests.get(r.test_id);
        return {
          test_id: r.test_id,
          test_name: testInfo?.name || 'Unknown Test',
          duration_ms: r.duration_ms,
          status: r.status,
        };
      });

    return {
      run_id: runId,
      status: run.status,
      duration: {
        total_ms: totalDuration,
        avg_test_ms: avgTestDuration,
        max_test_ms: maxTestDuration,
        min_test_ms: minTestDuration,
        started_at: run.started_at?.toISOString(),
        completed_at: run.completed_at?.toISOString(),
      },
      test_results: {
        total,
        passed,
        failed,
        skipped,
        error,
        pass_rate: passRate,
      },
      browser: browserInfo,
      by_test_type: testTypeBreakdown,
      slowest_tests: slowestTests,
    };
  });

  // Feature #894: Set environment variables for a test run
  app.post<{ Params: TestRunParams; Body: SetRunEnvVarsBody }>('/api/v1/runs/:runId/environment', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);
    const { env_vars, merge = true } = request.body || {};

    const run = testRuns.get(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    // Can only set env vars on pending or paused runs
    if (run.status !== 'pending' && run.status !== 'paused') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Cannot set environment variables for run with status "${run.status}". Only pending or paused runs can have environment variables modified.`,
        current_status: run.status,
      });
    }

    // Validate env_vars is an object
    if (!env_vars || typeof env_vars !== 'object' || Array.isArray(env_vars)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'env_vars must be an object with key-value pairs',
      });
    }

    // Validate all values are strings
    for (const [key, value] of Object.entries(env_vars)) {
      if (typeof key !== 'string' || key.trim() === '') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'All environment variable keys must be non-empty strings',
        });
      }
      if (typeof value !== 'string') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Environment variable "${key}" must have a string value`,
        });
      }
    }

    // Set or merge environment variables
    if (merge && (run as any).run_env_vars) {
      (run as any).run_env_vars = { ...(run as any).run_env_vars, ...env_vars };
    } else {
      (run as any).run_env_vars = { ...env_vars };
    }

    testRuns.set(runId, run);
    console.log(`[ENV] Set ${Object.keys(env_vars).length} environment variables for run ${runId} (merge=${merge})`);

    // Get the suite and project env vars for the response
    const suite = testSuites.get(run.suite_id);
    const projectId = (suite as any)?.project_id;
    const projectEnvVarsArray = projectId ? projectEnvVars.get(projectId) || [] : [];

    return {
      run_id: runId,
      status: run.status,
      environment: {
        run_env_vars: (run as any).run_env_vars,
        run_env_var_count: Object.keys((run as any).run_env_vars).length,
        project_env_var_count: projectEnvVarsArray.length,
        total_env_var_count: Object.keys((run as any).run_env_vars).length + projectEnvVarsArray.filter(
          (pv: any) => !(run as any).run_env_vars![pv.key] // Only count project vars not overridden by run vars
        ).length,
        merge_mode: merge,
      },
      message: `Successfully set ${Object.keys(env_vars).length} environment variables for run`,
    };
  });

  // Feature #894: Get environment variables for a test run
  app.get<{ Params: TestRunParams }>('/api/v1/runs/:runId/environment', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);

    const run = testRuns.get(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    // Get the suite and project env vars
    const suite = testSuites.get(run.suite_id);
    const projectId = (suite as any)?.project_id;
    const projectEnvVarsArray = projectId ? projectEnvVars.get(projectId) || [] : [];

    // Build merged view of env vars (with masking for sensitive project vars)
    const projectVars: Record<string, { value: string; masked: boolean; source: 'project' }> = {};
    for (const envVar of projectEnvVarsArray) {
      projectVars[(envVar as any).key] = {
        value: (envVar as any).masked ? '********' : (envVar as any).value,
        masked: (envVar as any).masked,
        source: 'project',
      };
    }

    const runVars: Record<string, { value: string; masked: boolean; source: 'run' }> = {};
    if ((run as any).run_env_vars) {
      for (const [key, value] of Object.entries((run as any).run_env_vars)) {
        runVars[key] = {
          value: value as string,
          masked: false,
          source: 'run',
        };
      }
    }

    // Effective env vars (run vars override project vars)
    const effectiveVars: Record<string, { value: string; masked: boolean; source: 'project' | 'run'; overridden?: boolean }> = {};

    // First add project vars
    for (const [key, varInfo] of Object.entries(projectVars)) {
      effectiveVars[key] = {
        ...varInfo,
        overridden: (run as any).run_env_vars ? key in (run as any).run_env_vars : false,
      };
    }

    // Then add run vars (overriding project vars)
    for (const [key, varInfo] of Object.entries(runVars)) {
      effectiveVars[key] = varInfo;
    }

    return {
      run_id: runId,
      status: run.status,
      environment: {
        project_vars: projectVars,
        run_vars: runVars,
        effective_vars: effectiveVars,
        summary: {
          project_var_count: Object.keys(projectVars).length,
          run_var_count: Object.keys(runVars).length,
          effective_var_count: Object.keys(effectiveVars).length,
          overridden_count: Object.values(effectiveVars).filter(v => v.overridden).length,
        },
      },
    };
  });

  // Feature #894: Delete environment variables from a test run
  app.delete<{ Params: TestRunParams; Body: DeleteRunEnvVarsBody }>('/api/v1/runs/:runId/environment', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);
    const { keys } = request.body || {};

    const run = testRuns.get(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    // Can only modify env vars on pending or paused runs
    if (run.status !== 'pending' && run.status !== 'paused') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Cannot modify environment variables for run with status "${run.status}". Only pending or paused runs can have environment variables modified.`,
        current_status: run.status,
      });
    }

    if (!(run as any).run_env_vars) {
      return {
        run_id: runId,
        status: run.status,
        deleted_count: 0,
        message: 'No environment variables to delete',
      };
    }

    let deletedCount = 0;

    if (keys && Array.isArray(keys) && keys.length > 0) {
      // Delete specific keys
      for (const key of keys) {
        if ((run as any).run_env_vars[key] !== undefined) {
          delete (run as any).run_env_vars[key];
          deletedCount++;
        }
      }
    } else {
      // Delete all env vars
      deletedCount = Object.keys((run as any).run_env_vars).length;
      (run as any).run_env_vars = {};
    }

    testRuns.set(runId, run);
    console.log(`[ENV] Deleted ${deletedCount} environment variables from run ${runId}`);

    return {
      run_id: runId,
      status: run.status,
      deleted_count: deletedCount,
      remaining_env_vars: (run as any).run_env_vars,
      message: deletedCount > 0
        ? `Successfully deleted ${deletedCount} environment variables`
        : 'No matching environment variables found to delete',
    };
  });

  // Feature #346: Compare two K6 test runs
  // Moved from test-runs.ts as part of Feature #1356 refactoring
  app.get<{ Querystring: { baseRunId: string; compareRunId: string } }>('/api/v1/runs/compare', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { baseRunId, compareRunId } = request.query;
    const orgId = getOrganizationId(request);

    // Validate required parameters
    if (!baseRunId || !compareRunId) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Both baseRunId and compareRunId query parameters are required',
      });
    }

    // Get both test runs
    const baseRun = testRuns.get(baseRunId);
    const compareRun = testRuns.get(compareRunId);

    if (!baseRun || baseRun.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Base run with ID ${baseRunId} not found`,
      });
    }

    if (!compareRun || compareRun.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Compare run with ID ${compareRunId} not found`,
      });
    }

    // Ensure both runs have completed
    if (baseRun.status === 'running' || baseRun.status === 'pending') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Base run has not completed yet',
      });
    }

    if (compareRun.status === 'running' || compareRun.status === 'pending') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Compare run has not completed yet',
      });
    }

    // Type alias for local use
    type TestRun = typeof baseRun;

    // Find K6 load test results in both runs
    const findLoadTestResult = (run: TestRun) => {
      if (!run.results) return null;
      for (const result of run.results) {
        if (result.steps) {
          for (const step of result.steps) {
            if ((step as any).load_test) {
              return {
                test_id: result.test_id,
                test_name: result.test_name,
                load_test: (step as any).load_test,
              };
            }
          }
        }
      }
      return null;
    };

    const baseLoadTest = findLoadTestResult(baseRun);
    const compareLoadTest = findLoadTestResult(compareRun);

    if (!baseLoadTest) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Base run does not contain K6 load test results',
      });
    }

    if (!compareLoadTest) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Compare run does not contain K6 load test results',
      });
    }

    // Helper to calculate delta and improvement status
    const calculateDelta = (baseValue: number, compareValue: number, lowerIsBetter = false) => {
      const delta = compareValue - baseValue;
      const deltaPercent = baseValue !== 0 ? ((delta / baseValue) * 100) : 0;
      let status: 'improved' | 'regressed' | 'unchanged';

      if (Math.abs(deltaPercent) < 1) {
        status = 'unchanged';
      } else if (lowerIsBetter) {
        status = delta < 0 ? 'improved' : 'regressed';
      } else {
        status = delta > 0 ? 'improved' : 'regressed';
      }

      return {
        base: baseValue,
        compare: compareValue,
        delta,
        delta_percent: Math.round(deltaPercent * 100) / 100,
        status,
      };
    };

    // Build comparison object
    const baseSummary = baseLoadTest.load_test.summary || {};
    const compareSummary = compareLoadTest.load_test.summary || {};
    const baseResponseTimes = baseLoadTest.load_test.response_times || {};
    const compareResponseTimes = compareLoadTest.load_test.response_times || {};

    const comparison = {
      base_run: {
        id: baseRunId,
        test_name: baseLoadTest.test_name,
        completed_at: baseRun.completed_at,
        status: baseRun.status,
      },
      compare_run: {
        id: compareRunId,
        test_name: compareLoadTest.test_name,
        completed_at: compareRun.completed_at,
        status: compareRun.status,
      },
      summary: {
        total_requests: calculateDelta(
          Number(baseSummary.total_requests) || 0,
          Number(compareSummary.total_requests) || 0
        ),
        failed_requests: calculateDelta(
          Number(baseSummary.failed_requests) || 0,
          Number(compareSummary.failed_requests) || 0,
          true // Lower is better
        ),
        success_rate: calculateDelta(
          parseFloat(baseSummary.success_rate) || 0,
          parseFloat(compareSummary.success_rate) || 0
        ),
        requests_per_second: calculateDelta(
          parseFloat(baseSummary.requests_per_second) || 0,
          parseFloat(compareSummary.requests_per_second) || 0
        ),
        data_transferred: calculateDelta(
          Number(baseSummary.data_transferred) || 0,
          Number(compareSummary.data_transferred) || 0
        ),
      },
      response_times: {
        min: calculateDelta(baseResponseTimes.min || 0, compareResponseTimes.min || 0, true),
        avg: calculateDelta(baseResponseTimes.avg || 0, compareResponseTimes.avg || 0, true),
        median: calculateDelta(baseResponseTimes.median || 0, compareResponseTimes.median || 0, true),
        p90: calculateDelta(baseResponseTimes.p90 || 0, compareResponseTimes.p90 || 0, true),
        p95: calculateDelta(baseResponseTimes.p95 || 0, compareResponseTimes.p95 || 0, true),
        p99: calculateDelta(baseResponseTimes.p99 || 0, compareResponseTimes.p99 || 0, true),
        max: calculateDelta(baseResponseTimes.max || 0, compareResponseTimes.max || 0, true),
      },
      // Overall assessment
      overall: {
        performance: 'unchanged' as 'improved' | 'regressed' | 'unchanged',
        highlights: [] as string[],
      },
    };

    // Determine overall performance assessment
    const responseTimeChanges = [
      comparison.response_times.avg,
      comparison.response_times.p95,
      comparison.response_times.p99,
    ];

    const improvedCount = responseTimeChanges.filter(c => c.status === 'improved').length;
    const regressedCount = responseTimeChanges.filter(c => c.status === 'regressed').length;

    if (improvedCount > regressedCount) {
      comparison.overall.performance = 'improved';
    } else if (regressedCount > improvedCount) {
      comparison.overall.performance = 'regressed';
    }

    // Add highlights
    if (comparison.response_times.avg.status === 'improved') {
      comparison.overall.highlights.push(
        `Average response time improved by ${Math.abs(comparison.response_times.avg.delta_percent)}%`
      );
    } else if (comparison.response_times.avg.status === 'regressed') {
      comparison.overall.highlights.push(
        `Average response time regressed by ${Math.abs(comparison.response_times.avg.delta_percent)}%`
      );
    }

    if (comparison.response_times.p95.status === 'improved') {
      comparison.overall.highlights.push(
        `P95 response time improved by ${Math.abs(comparison.response_times.p95.delta_percent)}%`
      );
    } else if (comparison.response_times.p95.status === 'regressed') {
      comparison.overall.highlights.push(
        `P95 response time regressed by ${Math.abs(comparison.response_times.p95.delta_percent)}%`
      );
    }

    if (comparison.summary.success_rate.status === 'improved') {
      comparison.overall.highlights.push(
        `Success rate improved from ${comparison.summary.success_rate.base}% to ${comparison.summary.success_rate.compare}%`
      );
    } else if (comparison.summary.success_rate.status === 'regressed') {
      comparison.overall.highlights.push(
        `Success rate regressed from ${comparison.summary.success_rate.base}% to ${comparison.summary.success_rate.compare}%`
      );
    }

    if (comparison.summary.requests_per_second.status === 'improved') {
      comparison.overall.highlights.push(
        `Throughput improved by ${Math.abs(comparison.summary.requests_per_second.delta_percent)}%`
      );
    } else if (comparison.summary.requests_per_second.status === 'regressed') {
      comparison.overall.highlights.push(
        `Throughput regressed by ${Math.abs(comparison.summary.requests_per_second.delta_percent)}%`
      );
    }

    console.log(`[K6 COMPARE] Compared runs ${baseRunId} vs ${compareRunId}: ${comparison.overall.performance}`);

    return {
      comparison,
    };
  });
}
