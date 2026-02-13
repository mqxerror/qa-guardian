// Projects Module - Analytics Routes
// Includes dashboard stats, browser stats, project comparison, and pass rate trends

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../middleware/auth.js';
import { getTest, getTestSuite, listAllTestSuites, listAllTests } from '../../services/repositories/test-suites.js';
import { listTestRunsByOrg } from '../../services/repositories/test-runs.js';
import { listProjects as dbListProjects } from '../../services/repositories/projects.js';
import { Project } from './types.js';

export async function analyticsRoutes(app: FastifyInstance) {
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

    // Analyze each run's results
    for (const run of orgRuns) {
      if (!run.results) continue;

      for (const result of run.results) {
        const testId = result.test_id;
        const test = await getTest(testId);
        if (!test) continue;

        const suite = await getTestSuite(test.suite_id);
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

  // Get pass rate trends over time
  // Feature #140: Parallelized independent DB queries
  app.get<{ Querystring: { days?: string; project_id?: string } }>('/api/v1/analytics/pass-rate-trends', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const { days: daysParam, project_id: projectIdFilter } = request.query;
    const days = parseInt(daysParam || '7', 10);

    // Validate days parameter
    if (days < 1 || days > 90) {
      return {
        error: 'Bad Request',
        message: 'Days parameter must be between 1 and 90',
      };
    }

    // Feature #140: Run independent queries in parallel
    const [allProjects, allSuites] = await Promise.all([
      dbListProjects(orgId),
      listAllTestSuites(orgId),
    ]);

    // Filter projects
    const orgProjects = allProjects.filter(p => !projectIdFilter || p.id === projectIdFilter);

    // Get all suite IDs for these projects
    const projectIds = orgProjects.map(p => p.id);
    const orgSuites = allSuites.filter(s => projectIds.includes(s.project_id));
    const suiteIds = orgSuites.map(s => s.id);

    // Get all completed test runs for these suites within the date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const relevantRuns = (await listTestRunsByOrg(orgId))
      .filter(r => suiteIds.includes(r.suite_id))
      .filter(r => r.status !== 'pending' && r.status !== 'running')
      .filter(r => {
        const runDate = r.completed_at || r.created_at;
        return runDate >= startDate;
      });

    // Group runs by day
    const dailyData: Map<string, { date: string; passed: number; failed: number; total: number }> = new Map();

    // Initialize all days in the range
    for (let d = 0; d < days; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const dateKey = date.toISOString().split('T')[0] || ''; // YYYY-MM-DD
      dailyData.set(dateKey, { date: dateKey, passed: 0, failed: 0, total: 0 });
    }

    // Aggregate runs by day
    for (const run of relevantRuns) {
      const runDate = (run.completed_at || run.created_at).toISOString().split('T')[0] || '';
      const dayData = dailyData.get(runDate);
      if (dayData) {
        dayData.total++;
        if (run.status === 'passed') {
          dayData.passed++;
        } else {
          dayData.failed++;
        }
      }
    }

    // Convert to array and calculate pass rates
    const trends = Array.from(dailyData.values())
      .map(d => ({
        date: d.date,
        passed: d.passed,
        failed: d.failed,
        total: d.total,
        pass_rate: d.total > 0 ? Math.round((d.passed / d.total) * 100) : null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)); // Sort chronologically

    // Calculate overall summary
    const totalPassed = trends.reduce((sum, d) => sum + d.passed, 0);
    const totalFailed = trends.reduce((sum, d) => sum + d.failed, 0);
    const totalRuns = totalPassed + totalFailed;
    const overallPassRate = totalRuns > 0 ? Math.round((totalPassed / totalRuns) * 100) : null;

    return {
      trends,
      summary: {
        period_days: days,
        total_runs: totalRuns,
        total_passed: totalPassed,
        total_failed: totalFailed,
        overall_pass_rate: overallPassRate,
        start_date: startDate.toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
      },
      project_filter: projectIdFilter || null,
    };
  });

  // Get accessibility trends over time
  // Feature #140: Parallelized independent DB queries
  app.get<{ Querystring: { days?: string; project_id?: string } }>('/api/v1/analytics/accessibility-trends', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const { days: daysParam, project_id: projectIdFilter } = request.query;
    const days = parseInt(daysParam || '7', 10);

    // Validate days parameter
    if (days < 1 || days > 90) {
      return {
        error: 'Bad Request',
        message: 'Days parameter must be between 1 and 90',
      };
    }

    // Feature #140: Run independent queries in parallel
    const [allProjects, allSuites] = await Promise.all([
      dbListProjects(orgId),
      listAllTestSuites(orgId),
    ]);

    // Filter projects
    const orgProjects = allProjects.filter(p => !projectIdFilter || p.id === projectIdFilter);

    // Get all suite IDs for these projects
    const projectIds = orgProjects.map(p => p.id);
    const orgSuites = allSuites.filter(s => projectIds.includes(s.project_id));
    const suiteIds = orgSuites.map(s => s.id);

    // Get all completed accessibility test runs within the date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Feature #198: includeResults needed because this handler accesses accessibility_results
    const relevantRuns = (await listTestRunsByOrg(orgId, { includeResults: true }))
      .filter(r => suiteIds.includes(r.suite_id))
      .filter(r => r.test_type === 'accessibility')
      .filter(r => r.status !== 'pending' && r.status !== 'running')
      .filter(r => {
        const runDate = r.completed_at || r.created_at;
        return runDate >= startDate;
      });

    // Group runs by day
    const dailyData: Map<string, {
      date: string;
      total_violations: number;
      critical: number;
      serious: number;
      moderate: number;
      minor: number;
      runs_with_violations: number;
      total_runs: number;
    }> = new Map();

    // Initialize all days in the range
    for (let d = 0; d < days; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const dateKey = date.toISOString().split('T')[0] || ''; // YYYY-MM-DD
      dailyData.set(dateKey, {
        date: dateKey,
        total_violations: 0,
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
        runs_with_violations: 0,
        total_runs: 0
      });
    }

    // Aggregate runs by day
    for (const run of relevantRuns) {
      const runDate = (run.completed_at || run.created_at).toISOString().split('T')[0] || '';
      const dayData = dailyData.get(runDate);
      if (dayData) {
        dayData.total_runs++;

        // Get violations from accessibility results
        const a11yResults = run.accessibility_results;
        if (a11yResults && a11yResults.violations) {
          // violations can be an array directly or an object with items property
          const rawViolations = a11yResults.violations;
          const violations = Array.isArray(rawViolations) ? rawViolations : (rawViolations.items || []);
          const violationCount = violations.length;

          if (violationCount > 0) {
            dayData.runs_with_violations++;
            dayData.total_violations += violationCount;

            // Count by severity
            for (const v of violations) {
              const impact = v.impact?.toLowerCase() || 'minor';
              if (impact === 'critical') dayData.critical++;
              else if (impact === 'serious') dayData.serious++;
              else if (impact === 'moderate') dayData.moderate++;
              else dayData.minor++;
            }
          }
        }
      }
    }

    // Convert to array
    const trends = Array.from(dailyData.values())
      .sort((a, b) => a.date.localeCompare(b.date)); // Sort chronologically

    // Calculate overall summary
    const totalRuns = trends.reduce((sum, d) => sum + d.total_runs, 0);
    const totalViolations = trends.reduce((sum, d) => sum + d.total_violations, 0);
    const runsWithViolations = trends.reduce((sum, d) => sum + d.runs_with_violations, 0);
    const avgViolationsPerRun = totalRuns > 0 ? totalViolations / totalRuns : 0;

    // Determine trend direction (compare first half to second half)
    let violationTrend: 'improving' | 'stable' | 'worsening' = 'stable';
    if (trends.length >= 2) {
      const midPoint = Math.floor(trends.length / 2);
      const firstHalf = trends.slice(0, midPoint);
      const secondHalf = trends.slice(midPoint);
      const firstHalfAvg = firstHalf.length > 0
        ? firstHalf.reduce((s, d) => s + d.total_violations, 0) / firstHalf.length
        : 0;
      const secondHalfAvg = secondHalf.length > 0
        ? secondHalf.reduce((s, d) => s + d.total_violations, 0) / secondHalf.length
        : 0;

      const diff = secondHalfAvg - firstHalfAvg;
      if (diff < -0.5) violationTrend = 'improving';
      else if (diff > 0.5) violationTrend = 'worsening';
    }

    return {
      trends,
      summary: {
        period_days: days,
        total_runs: totalRuns,
        runs_with_violations: runsWithViolations,
        total_violations: totalViolations,
        avg_violations_per_run: Math.round(avgViolationsPerRun * 10) / 10,
        violation_trend: violationTrend,
        start_date: startDate.toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
      },
      project_filter: projectIdFilter || null,
    };
  });

  // ============================================================================
  // Feature #470: Duration Trends Analytics with p50/p95/p99 percentiles
  // ============================================================================
  app.get<{
    Querystring: {
      days?: string;
      project_id?: string;
      browser?: string;
      test_type?: string;
    };
  }>('/api/v1/analytics/duration-trends', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const { days: daysParam, project_id: projectIdFilter, browser: browserFilter, test_type: testTypeFilter } = request.query;
    const days = parseInt(daysParam || '7', 10);

    // Validate days parameter
    if (days < 1 || days > 90) {
      return {
        error: 'Bad Request',
        message: 'Days parameter must be between 1 and 90',
      };
    }

    // Get all projects and suites for filtering
    const [allProjects, allSuites] = await Promise.all([
      dbListProjects(orgId),
      listAllTestSuites(orgId),
    ]);

    // Filter projects
    const orgProjects = allProjects.filter(p => !projectIdFilter || p.id === projectIdFilter);
    const projectIds = orgProjects.map(p => p.id);
    const orgSuites = allSuites.filter(s => projectIds.includes(s.project_id));
    const suiteIds = orgSuites.map(s => s.id);

    // Get all completed test runs within the date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    let relevantRuns = (await listTestRunsByOrg(orgId))
      .filter(r => suiteIds.includes(r.suite_id))
      .filter(r => r.status === 'passed' || r.status === 'failed')
      .filter(r => r.duration_ms && r.duration_ms > 0)
      .filter(r => {
        const runDate = r.completed_at || r.created_at;
        return runDate >= startDate;
      });

    // Apply optional filters
    if (browserFilter) {
      relevantRuns = relevantRuns.filter(r => r.browser === browserFilter);
    }
    if (testTypeFilter) {
      relevantRuns = relevantRuns.filter(r => r.test_type === testTypeFilter);
    }

    // Group runs by day
    const dailyData: Map<string, {
      date: string;
      durations: number[];
    }> = new Map();

    // Initialize all days in the range
    for (let d = 0; d < days; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const dateKey = date.toISOString().split('T')[0] || '';
      dailyData.set(dateKey, { date: dateKey, durations: [] });
    }

    // Aggregate durations by day
    for (const run of relevantRuns) {
      const runDate = (run.completed_at || run.created_at).toISOString().split('T')[0] || '';
      const dayData = dailyData.get(runDate);
      if (dayData && run.duration_ms) {
        dayData.durations.push(run.duration_ms);
      }
    }

    // Calculate percentiles for each day
    const calculatePercentile = (sortedArr: number[], p: number): number | null => {
      if (sortedArr.length === 0) return null;
      const index = Math.ceil((p / 100) * sortedArr.length) - 1;
      return sortedArr[Math.max(0, index)] || null;
    };

    const trends = Array.from(dailyData.values())
      .map(d => {
        const sorted = [...d.durations].sort((a, b) => a - b);
        const p50 = calculatePercentile(sorted, 50);
        const p95 = calculatePercentile(sorted, 95);
        const p99 = calculatePercentile(sorted, 99);
        const avg = sorted.length > 0 ? Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length) : null;
        const min = sorted.length > 0 ? sorted[0] : null;
        const max = sorted.length > 0 ? sorted[sorted.length - 1] : null;

        return {
          date: d.date,
          run_count: d.durations.length,
          p50_ms: p50 ? Math.round(p50) : null,
          p95_ms: p95 ? Math.round(p95) : null,
          p99_ms: p99 ? Math.round(p99) : null,
          avg_ms: avg,
          min_ms: min ?? null,
          max_ms: max ?? null,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate overall summary
    const allDurations = relevantRuns.map(r => r.duration_ms!).filter(d => d > 0);
    const sortedAll = [...allDurations].sort((a, b) => a - b);
    const overallP50 = calculatePercentile(sortedAll, 50);
    const overallP95 = calculatePercentile(sortedAll, 95);
    const overallP99 = calculatePercentile(sortedAll, 99);
    const overallAvg = sortedAll.length > 0 ? Math.round(sortedAll.reduce((s, v) => s + v, 0) / sortedAll.length) : null;

    // Detect regression: compare last week's p95 to previous week's p95
    let regression: { detected: boolean; change_percent: number | null; message: string } = {
      detected: false,
      change_percent: null,
      message: 'No significant duration regression detected',
    };

    if (days >= 14) {
      const midPoint = Math.floor(trends.length / 2);
      const firstHalf = trends.slice(0, midPoint);
      const secondHalf = trends.slice(midPoint);

      const firstHalfP95s = firstHalf.filter(d => d.p95_ms !== null).map(d => d.p95_ms!);
      const secondHalfP95s = secondHalf.filter(d => d.p95_ms !== null).map(d => d.p95_ms!);

      if (firstHalfP95s.length > 0 && secondHalfP95s.length > 0) {
        const firstAvgP95 = firstHalfP95s.reduce((s, v) => s + v, 0) / firstHalfP95s.length;
        const secondAvgP95 = secondHalfP95s.reduce((s, v) => s + v, 0) / secondHalfP95s.length;

        if (firstAvgP95 > 0) {
          const changePercent = ((secondAvgP95 - firstAvgP95) / firstAvgP95) * 100;
          if (changePercent > 20) {
            regression = {
              detected: true,
              change_percent: Math.round(changePercent),
              message: `⚠️ Duration regression detected: p95 increased by ${Math.round(changePercent)}% in the recent period`,
            };
          }
        }
      }
    }

    // Get unique browsers and test types for filter options
    const browsers = [...new Set(relevantRuns.map(r => r.browser).filter(Boolean))];
    const testTypes = [...new Set(relevantRuns.map(r => r.test_type).filter(Boolean))];

    return {
      trends,
      summary: {
        period_days: days,
        total_runs: allDurations.length,
        overall_p50_ms: overallP50 ? Math.round(overallP50) : null,
        overall_p95_ms: overallP95 ? Math.round(overallP95) : null,
        overall_p99_ms: overallP99 ? Math.round(overallP99) : null,
        overall_avg_ms: overallAvg,
        start_date: startDate.toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
      },
      regression,
      filters: {
        project_id: projectIdFilter || null,
        browser: browserFilter || null,
        test_type: testTypeFilter || null,
        available_browsers: browsers,
        available_test_types: testTypes,
      },
    };
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

  // ============================================================================
  // Feature #1542: AI Best Practices Analysis
  // NOTE: Route moved to github/ai-best-practices.ts to avoid duplication
  // ============================================================================

  // ============================================================================
  // Feature #247: AI Insights routes moved to ai-insights-routes.ts
  // Routes: /api/v1/ai-insights/industry-benchmarks, cross-project-patterns,
  //         personalized, team-skills, learning-stats, releases
  // ============================================================================
}
