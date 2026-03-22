/**
 * Analytics Routes - Comparison
 *
 * Cross-entity comparison endpoints:
 * - GET /api/v1/analytics/project-comparison (compare projects)
 * - GET /api/v1/analytics/branch-comparison (compare branches)
 *
 * Feature #1356: Code quality - extracted from analytics.ts
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../../middleware/auth.js';
import { listAllTestSuites, listAllTests } from '../../../services/repositories/test-suites.js';
import { listTestRunsByOrg } from '../../../services/repositories/test-runs.js';
import { listProjects as dbListProjects } from '../../../services/repositories/projects.js';

export async function analyticsComparisonRoutes(app: FastifyInstance): Promise<void> {
  // Get project comparison statistics
  // Feature #140: Parallelized independent DB queries
  app.get('/api/v1/analytics/project-comparison', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);

    // Feature #140: Run all 4 independent queries in parallel
    const [orgProjects, allOrgSuites, allOrgTests, allOrgRuns] = await Promise.all([
      dbListProjects(orgId),
      listAllTestSuites(orgId),
      listAllTests(orgId),
      listTestRunsByOrg(orgId),
    ]);

    // Build comparison data for each project
    const projectStats = orgProjects.map(project => {
      // Get suites for this project
      const projectSuites = allOrgSuites
        .filter(s => s.project_id === project.id);

      const suiteIds = projectSuites.map(s => s.id);

      // Get tests for this project's suites
      const projectTests = allOrgTests
        .filter(t => suiteIds.includes(t.suite_id));

      // Get test runs for this project's suites
      const projectRuns = allOrgRuns
        .filter(r => suiteIds.includes(r.suite_id) && r.status !== 'pending' && r.status !== 'running');

      const passedRuns = projectRuns.filter(r => r.status === 'passed').length;
      const failedRuns = projectRuns.filter(r => r.status === 'failed' || r.status === 'error').length;
      const totalRuns = passedRuns + failedRuns;
      const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0;

      return {
        project_id: project.id,
        project_name: project.name,
        project_slug: project.slug,
        suite_count: projectSuites.length,
        test_count: projectTests.length,
        total_runs: totalRuns,
        passed_runs: passedRuns,
        failed_runs: failedRuns,
        pass_rate: passRate,
        created_at: project.created_at.toISOString(),
      };
    });

    // Sort by test count descending (most active projects first)
    projectStats.sort((a, b) => b.test_count - a.test_count);

    return { projects: projectStats };
  });

  // ============================================================================
  // Feature #476: Branch-to-Branch Test Result Comparison
  // Compare test metrics between two branches: pass rate, avg duration, failure count, flaky count
  // ============================================================================
  app.get<{
    Querystring: {
      branchA?: string;
      branchB?: string;
    };
  }>('/api/v1/analytics/branch-comparison', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const { branchA, branchB } = request.query;

    // Get all test runs for this organization
    const allRuns = await listTestRunsByOrg(orgId);

    // Filter to only completed runs
    const completedRuns = allRuns.filter(r => r.status === 'passed' || r.status === 'failed' || r.status === 'error');

    // Get unique branches from test runs
    const branchSet = new Set<string>();
    for (const run of completedRuns) {
      if (run.branch) {
        branchSet.add(run.branch);
      }
    }
    const availableBranches = Array.from(branchSet).sort();

    // If no branches specified, return available branches only
    if (!branchA || !branchB) {
      return {
        available_branches: availableBranches,
        comparison: null,
        message: 'Select two branches to compare',
      };
    }

    // Calculate metrics for each branch
    const calculateBranchMetrics = (branchName: string) => {
      const branchRuns = completedRuns.filter(r => r.branch === branchName);
      const totalRuns = branchRuns.length;
      const passedRuns = branchRuns.filter(r => r.status === 'passed').length;
      const failedRuns = branchRuns.filter(r => r.status === 'failed' || r.status === 'error').length;
      const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0;

      // Calculate average duration
      const runsWithDuration = branchRuns.filter(r => r.duration_ms && r.duration_ms > 0);
      const avgDuration = runsWithDuration.length > 0
        ? Math.round(runsWithDuration.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / runsWithDuration.length)
        : null;

      // Calculate flaky count (tests that have both passed and failed)
      const testStatusMap: Map<string, { passed: number; failed: number }> = new Map();
      for (const run of branchRuns) {
        const testId = run.test_id || run.suite_id; // Group by test or suite
        const existing = testStatusMap.get(testId) || { passed: 0, failed: 0 };
        if (run.status === 'passed') {
          existing.passed++;
        } else {
          existing.failed++;
        }
        testStatusMap.set(testId, existing);
      }
      let flakyCount = 0;
      for (const [, stats] of testStatusMap) {
        if (stats.passed > 0 && stats.failed > 0) {
          flakyCount++;
        }
      }

      // Get date range
      const dates = branchRuns
        .map(r => r.completed_at || r.created_at)
        .filter(Boolean)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      const firstRun = dates.length > 0 ? dates[0]?.toISOString() : null;
      const lastRun = dates.length > 0 ? dates[dates.length - 1]?.toISOString() : null;

      return {
        branch: branchName,
        total_runs: totalRuns,
        passed_runs: passedRuns,
        failed_runs: failedRuns,
        pass_rate: passRate,
        avg_duration_ms: avgDuration,
        flaky_count: flakyCount,
        first_run: firstRun,
        last_run: lastRun,
      };
    };

    const metricsA = calculateBranchMetrics(branchA);
    const metricsB = calculateBranchMetrics(branchB);

    // Calculate deltas (branchB - branchA)
    const passRateDelta = metricsB.pass_rate - metricsA.pass_rate;
    const durationDelta = (metricsA.avg_duration_ms && metricsB.avg_duration_ms)
      ? metricsB.avg_duration_ms - metricsA.avg_duration_ms
      : null;
    const failureDelta = metricsB.failed_runs - metricsA.failed_runs;
    const flakyDelta = metricsB.flaky_count - metricsA.flaky_count;

    // Determine trends (positive = branchB better, negative = branchB worse)
    const getPassRateTrend = (delta: number): 'improved' | 'same' | 'regressed' => {
      if (delta > 5) return 'improved';
      if (delta < -5) return 'regressed';
      return 'same';
    };

    const getDurationTrend = (delta: number | null): 'improved' | 'same' | 'regressed' | 'unknown' => {
      if (delta === null) return 'unknown';
      if (delta < -500) return 'improved'; // Faster is better
      if (delta > 500) return 'regressed'; // Slower is worse
      return 'same';
    };

    const getFailureTrend = (delta: number): 'improved' | 'same' | 'regressed' => {
      if (delta < -2) return 'improved'; // Fewer failures is better
      if (delta > 2) return 'regressed'; // More failures is worse
      return 'same';
    };

    const getFlakyTrend = (delta: number): 'improved' | 'same' | 'regressed' => {
      if (delta < 0) return 'improved'; // Fewer flaky tests is better
      if (delta > 0) return 'regressed'; // More flaky tests is worse
      return 'same';
    };

    return {
      available_branches: availableBranches,
      comparison: {
        branchA: metricsA,
        branchB: metricsB,
        deltas: {
          pass_rate: {
            value: passRateDelta,
            trend: getPassRateTrend(passRateDelta),
            formatted: `${passRateDelta > 0 ? '+' : ''}${passRateDelta}%`,
          },
          avg_duration_ms: {
            value: durationDelta,
            trend: getDurationTrend(durationDelta),
            formatted: durationDelta !== null
              ? `${durationDelta > 0 ? '+' : ''}${durationDelta}ms`
              : 'N/A',
          },
          failed_runs: {
            value: failureDelta,
            trend: getFailureTrend(failureDelta),
            formatted: `${failureDelta > 0 ? '+' : ''}${failureDelta}`,
          },
          flaky_count: {
            value: flakyDelta,
            trend: getFlakyTrend(flakyDelta),
            formatted: `${flakyDelta > 0 ? '+' : ''}${flakyDelta}`,
          },
        },
      },
    };
  });
}
