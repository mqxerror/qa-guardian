/**
 * Run Data Routes - Comparison
 *
 * Endpoints for comparing test runs:
 * - GET /api/v1/runs/compare-results (general test run comparison)
 * - GET /api/v1/runs/compare (K6 load test comparison)
 *
 * Feature #1356: Code quality - extracted from run-data-routes.ts
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../../middleware/auth.js';
import { getTest } from '../../test-suites.js';
// Feature #484: Pino structured logging
import { createLogger } from '../../../services/logger.js';
import { sendError } from '../../../utils/errors.js';
import { getTestRunWithFallback } from './helpers.js';

const log = createLogger('run-data-routes:comparison');

export async function runComparisonRoutes(app: FastifyInstance): Promise<void> {
  // Feature #892: Compare two test runs (general comparison, not just K6)
  app.get<{ Querystring: { baseRunId: string; compareRunId: string } }>('/api/v1/runs/compare-results', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { baseRunId, compareRunId } = request.query;
    const orgId = getOrganizationId(request);

    if (!baseRunId || !compareRunId) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Both baseRunId and compareRunId query parameters are required');
    }

    const baseRun = await getTestRunWithFallback(baseRunId);
    const compareRun = await getTestRunWithFallback(compareRunId);

    if (!baseRun || baseRun.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', `Base run with ID ${baseRunId} not found`);
    }

    if (!compareRun || compareRun.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', `Compare run with ID ${compareRunId} not found`);
    }

    // Check if both runs are completed
    const completedStatuses = ['passed', 'failed', 'cancelled', 'error'];
    if (!completedStatuses.includes(baseRun.status)) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Base run has not completed yet', { status: baseRun.status });
    }

    if (!completedStatuses.includes(compareRun.status)) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Compare run has not completed yet', { status: compareRun.status });
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
      const testInfo = await getTest(testId);
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

  // Feature #346: Compare two K6 test runs
  // Moved from test-runs.ts as part of Feature #1356 refactoring
  app.get<{ Querystring: { baseRunId: string; compareRunId: string } }>('/api/v1/runs/compare', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { baseRunId, compareRunId } = request.query;
    const orgId = getOrganizationId(request);

    // Validate required parameters
    if (!baseRunId || !compareRunId) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Both baseRunId and compareRunId query parameters are required');
    }

    // Get both test runs
    const baseRun = await getTestRunWithFallback(baseRunId);
    const compareRun = await getTestRunWithFallback(compareRunId);

    if (!baseRun || baseRun.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', `Base run with ID ${baseRunId} not found`);
    }

    if (!compareRun || compareRun.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', `Compare run with ID ${compareRunId} not found`);
    }

    // Ensure both runs have completed
    if (baseRun.status === 'running' || baseRun.status === 'pending') {
      return sendError(reply, 400, 'BAD_REQUEST', 'Base run has not completed yet');
    }

    if (compareRun.status === 'running' || compareRun.status === 'pending') {
      return sendError(reply, 400, 'BAD_REQUEST', 'Compare run has not completed yet');
    }

    // Type alias for local use
    type LocalTestRun = typeof baseRun;

    // Find K6 load test results in both runs
    const findLoadTestResult = (run: LocalTestRun) => {
      if (!run.results) return null;
      for (const result of run.results) {
        if (result.steps) {
          for (const step of result.steps) {
            // StepResult already has load_test optional property
            if (step.load_test) {
              return {
                test_id: result.test_id,
                test_name: result.test_name,
                load_test: step.load_test,
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
      return sendError(reply, 400, 'BAD_REQUEST', 'Base run does not contain K6 load test results');
    }

    if (!compareLoadTest) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Compare run does not contain K6 load test results');
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
          parseFloat(baseSummary.success_rate || '0') || 0,
          parseFloat(compareSummary.success_rate || '0') || 0
        ),
        requests_per_second: calculateDelta(
          parseFloat(baseSummary.requests_per_second || '0') || 0,
          parseFloat(compareSummary.requests_per_second || '0') || 0
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

    log.info({ baseRunId, compareRunId, performance: comparison.overall.performance, code: 'K6_COMPARE' }, 'K6 runs compared');

    return {
      comparison,
    };
  });
}
