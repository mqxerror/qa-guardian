/**
 * Analytics Routes - Test Analytics
 *
 * Test-level analytics endpoints:
 * - GET /api/v1/analytics/failing-tests (most failing tests)
 * - GET /api/v1/analytics/browser-stats (browser-specific pass rates)
 *
 * Feature #1356: Code quality - extracted from analytics.ts
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../../middleware/auth.js';
import { batchGetTests, batchGetTestSuites } from '../../../services/repositories/test-suites.js';
import { listTestRunsByOrg } from '../../../services/repositories/test-runs.js';
import { listProjects as dbListProjects } from '../../../services/repositories/projects.js';
import { Project } from '../types.js';

export async function analyticsTestRoutes(app: FastifyInstance): Promise<void> {
  // Get most failing tests
  // Feature #140: Parallelized independent DB queries
  app.get('/api/v1/analytics/failing-tests', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);

    // Feature #140: Run both independent queries in parallel
    // Feature #198: includeResults needed because this handler iterates over individual test results
    const [allRuns, orgProjects] = await Promise.all([
      listTestRunsByOrg(orgId, { includeResults: true }),
      dbListProjects(orgId),
    ]);

    // Get all test runs for this organization
    const orgRuns = allRuns.filter(r => r.results);

    // Pre-fetch projects as a map for lookup
    const projectsMap = new Map<string, Project>();
    for (const p of orgProjects) { projectsMap.set(p.id, p); }

    // Track failure count and total runs per test
    const testStats: Map<string, {
      test_id: string;
      test_name: string;
      suite_id: string;
      suite_name: string;
      project_id: string;
      project_name: string;
      failure_count: number;
      total_runs: number;
      last_failure?: Date;
    }> = new Map();

    // Batch-load all referenced tests and suites upfront (eliminates N+1 queries)
    const allTestIds = new Set<string>();
    for (const run of orgRuns) {
      if (!run.results) continue;
      for (const result of run.results) {
        allTestIds.add(result.test_id);
      }
    }

    const testsMap = await batchGetTests(Array.from(allTestIds));
    const allSuiteIds = new Set<string>();
    for (const test of testsMap.values()) {
      allSuiteIds.add(test.suite_id);
    }
    const suitesMap = await batchGetTestSuites(Array.from(allSuiteIds));

    // Analyze each run's results using pre-fetched maps
    for (const run of orgRuns) {
      if (!run.results) continue;

      for (const result of run.results) {
        const testId = result.test_id;
        const test = testsMap.get(testId);
        if (!test) continue;

        const suite = suitesMap.get(test.suite_id);
        if (!suite) continue;

        const project = projectsMap.get(suite.project_id);
        if (!project) continue;

        const existingStats = testStats.get(testId) || {
          test_id: testId,
          test_name: result.test_name,
          suite_id: suite.id,
          suite_name: suite.name,
          project_id: project.id,
          project_name: project.name,
          failure_count: 0,
          total_runs: 0,
        };

        existingStats.total_runs++;
        if (result.status === 'failed' || result.status === 'error') {
          existingStats.failure_count++;
          existingStats.last_failure = run.completed_at || run.created_at;
        }

        testStats.set(testId, existingStats);
      }
    }

    // Convert to array, calculate failure percentage, sort by failure count
    const failingTests = Array.from(testStats.values())
      .filter(t => t.failure_count > 0)
      .map(t => ({
        ...t,
        failure_percentage: Math.round((t.failure_count / t.total_runs) * 100),
        last_failure: t.last_failure?.toISOString(),
      }))
      .sort((a, b) => b.failure_count - a.failure_count)
      .slice(0, 20); // Top 20 most failing tests

    return { failing_tests: failingTests };
  });

  // Get browser-specific pass rates
  app.get('/api/v1/analytics/browser-stats', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);

    // Get all test runs for this organization
    const orgRuns = (await listTestRunsByOrg(orgId))
      .filter(r => r.status !== 'pending' && r.status !== 'running');

    // Track stats per browser
    const browserStats: Map<string, {
      browser: string;
      total_runs: number;
      passed: number;
      failed: number;
      error: number;
    }> = new Map();

    // Analyze each run
    for (const run of orgRuns) {
      const browserName = run.browser || 'chromium';

      const existing = browserStats.get(browserName) || {
        browser: browserName,
        total_runs: 0,
        passed: 0,
        failed: 0,
        error: 0,
      };

      existing.total_runs++;
      if (run.status === 'passed') {
        existing.passed++;
      } else if (run.status === 'failed') {
        existing.failed++;
      } else if (run.status === 'error') {
        existing.error++;
      }

      browserStats.set(browserName, existing);
    }

    // Convert to array with pass rates
    const stats = Array.from(browserStats.values()).map(b => ({
      ...b,
      pass_rate: b.total_runs > 0 ? Math.round((b.passed / b.total_runs) * 100) : 0,
      failure_rate: b.total_runs > 0 ? Math.round(((b.failed + b.error) / b.total_runs) * 100) : 0,
    }));

    // Sort by total runs (most used browsers first)
    stats.sort((a, b) => b.total_runs - a.total_runs);

    return { browser_stats: stats };
  });
}
