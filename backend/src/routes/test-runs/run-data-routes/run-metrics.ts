/**
 * Run Data Routes - Metrics
 *
 * Endpoint for retrieving performance metrics for a test run:
 * - GET /api/v1/runs/:runId/metrics (duration, pass/fail, browser, test type breakdown)
 *
 * Feature #1356: Code quality - extracted from run-data-routes.ts
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../../middleware/auth.js';
import { getTestSuite, batchGetTests } from '../../test-suites.js';
import { TestSuite } from '../../test-suites/types.js';
import { sendError } from '../../../utils/errors.js';
import { getTestRunWithFallback, TestRunParams } from './helpers.js';

export async function runMetricRoutes(app: FastifyInstance): Promise<void> {
  // Feature #893: Get performance metrics for a test run
  app.get<{ Params: TestRunParams }>('/api/v1/runs/:runId/metrics', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    const results = run.results || [];
    const suite = await getTestSuite(run.suite_id);

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
    const typedSuite = suite as TestSuite | null;
    const browserInfo = typedSuite ? {
      browser: typedSuite.browser || 'chromium',
      viewport: { width: typedSuite.viewport_width || 1280, height: typedSuite.viewport_height || 720 },
    } : {
      browser: 'unknown',
      viewport: { width: 1280, height: 720 },
    };

    // Feature #707: Batch fetch all tests for this run to avoid N+1 queries
    const testIds = results.map(r => r.test_id);
    const allTests = await batchGetTests(testIds);

    // Test type breakdown
    const testTypeBreakdown: Record<string, { count: number; passed: number; failed: number }> = {};
    for (const result of results) {
      const testInfo = allTests.get(result.test_id);
      const testType = testInfo?.test_type || 'e2e';
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

    // Slowest tests (reuse allTests from above)
    const slowestTests = results
      .filter(r => r.duration_ms !== undefined)
      .sort((a, b) => (b.duration_ms || 0) - (a.duration_ms || 0))
      .slice(0, 5)
      .map(r => {
        const testInfo = allTests.get(r.test_id);
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
}
