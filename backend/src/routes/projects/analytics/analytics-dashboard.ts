/**
 * Analytics Routes - Dashboard
 *
 * Dashboard-level aggregate endpoints:
 * - GET /api/v1/dashboard/summary (test health summary for AI chat)
 * - GET /api/v1/dashboard/stats (extended dashboard stats)
 * - GET /api/v1/stats (basic statistics)
 *
 * Feature #1356: Code quality - extracted from analytics.ts
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../../middleware/auth.js';
import { listAllTestSuites, listAllTests } from '../../../services/repositories/test-suites.js';
import { listTestRunsByOrg } from '../../../services/repositories/test-runs.js';
import { listProjects as dbListProjects } from '../../../services/repositories/projects.js';

export async function analyticsDashboardRoutes(app: FastifyInstance): Promise<void> {
  // Feature #382: Dashboard summary endpoint for AI chat context
  // Returns total_tests, passed, failed, flaky counts for AI to understand test health
  app.get('/api/v1/dashboard/summary', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);

    // Get all tests and test runs in parallel
    const [tests, orgRuns] = await Promise.all([
      listAllTests(orgId),
      listTestRunsByOrg(orgId),
    ]);

    const totalTests = tests.length;

    // Calculate pass/fail/flaky counts from recent runs
    // A test is "flaky" if it has both passed and failed in recent runs
    const testRunStats: Map<string, { passed: number; failed: number }> = new Map();

    for (const run of orgRuns) {
      const testId = run.test_id;
      if (!testId) continue;

      const stats = testRunStats.get(testId) || { passed: 0, failed: 0 };
      if (run.status === 'passed') {
        stats.passed++;
      } else if (run.status === 'failed' || run.status === 'error') {
        stats.failed++;
      }
      testRunStats.set(testId, stats);
    }

    // Count tests by status
    let passedCount = 0;
    let failedCount = 0;
    let flakyCount = 0;

    for (const [, stats] of testRunStats) {
      // Flaky: has both passes and failures
      if (stats.passed > 0 && stats.failed > 0) {
        flakyCount++;
      } else if (stats.failed > 0) {
        failedCount++;
      } else if (stats.passed > 0) {
        passedCount++;
      }
    }

    // Tests with no runs are neither passed nor failed
    const testsWithRuns = testRunStats.size;
    const testsWithoutRuns = totalTests - testsWithRuns;

    // Guard against timeout middleware having already sent a 504
    if (reply.sent) return;

    return {
      total_tests: totalTests,
      passed: passedCount,
      failed: failedCount,
      flaky: flakyCount,
      no_runs: testsWithoutRuns,
      timestamp: new Date().toISOString(),
    };
  });

  // Feature #382: Dashboard stats endpoint (alias for MCP resources)
  app.get('/api/v1/dashboard/stats', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);

    // Reuse the same logic as /api/v1/stats but with additional fields
    const [projects, suites, tests, orgRuns] = await Promise.all([
      dbListProjects(orgId),
      listAllTestSuites(orgId),
      listAllTests(orgId),
      listTestRunsByOrg(orgId),
    ]);

    const projectCount = projects.filter(p => !p.archived).length;
    const suiteCount = suites.length;
    const testCount = tests.length;
    const testRunCount = orgRuns.length;

    const completedRuns = orgRuns.filter(r => r.status === 'passed' || r.status === 'failed');
    const passedRuns = orgRuns.filter(r => r.status === 'passed');
    const passRate = completedRuns.length > 0
      ? Math.round((passedRuns.length / completedRuns.length) * 100)
      : 0;

    // Guard against timeout middleware having already sent a 504
    if (reply.sent) return;

    return {
      projects: projectCount,
      test_suites: suiteCount,
      tests: testCount,
      test_runs: testRunCount,
      passed_runs: passedRuns.length,
      failed_runs: completedRuns.length - passedRuns.length,
      pass_rate: passRate,
      timestamp: new Date().toISOString(),
    };
  });

  // Get dashboard statistics
  // Feature #140: Parallelized independent DB queries with Promise.all
  app.get('/api/v1/stats', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);

    // Feature #140: Run all 4 independent queries in parallel (was sequential)
    const [projects, suites, tests, orgRuns] = await Promise.all([
      dbListProjects(orgId),
      listAllTestSuites(orgId),
      listAllTests(orgId),
      listTestRunsByOrg(orgId),
    ]);

    // Count active (non-archived) projects
    const projectCount = projects.filter(p => !p.archived).length;

    // Count test suites and tests
    const suiteCount = suites.length;
    const testCount = tests.length;

    // Count test runs
    const testRunCount = orgRuns.length;

    // Calculate pass rate
    const completedRuns = orgRuns.filter(r => r.status === 'passed' || r.status === 'failed');
    const passedRuns = orgRuns.filter(r => r.status === 'passed');
    const passRate = completedRuns.length > 0
      ? Math.round((passedRuns.length / completedRuns.length) * 100)
      : 0;

    // Feature #193: Guard against timeout middleware having already sent a 504
    if (reply.sent) return;
    return {
      projects: projectCount,
      test_suites: suiteCount,
      tests: testCount,
      test_runs: testRunCount,
      passed_runs: passedRuns.length,
      failed_runs: completedRuns.length - passedRuns.length,
      pass_rate: passRate,
    };
  });
}
