/**
 * Analytics Service
 *
 * Feature #Agent8: Service layer extraction for analytics business logic.
 *
 * Extracts data aggregation, trend computation, and comparison logic from
 * route handlers into a clean service interface. Route handlers become thin:
 * parse params -> call service -> return response.
 *
 * This service owns:
 * - Pass rate trend computation
 * - Accessibility trend computation
 * - Duration trend computation with percentiles and regression detection
 * - Browser-specific pass rate aggregation
 * - Failing test ranking
 * - Project comparison metrics
 * - Branch comparison metrics
 * - Dashboard summary and stats
 */

import { listAllTestSuites, listAllTests, batchGetTests, batchGetTestSuites } from './repositories/test-suites.js';
import { listTestRunsByOrg } from './repositories/test-runs.js';
import { listProjects as dbListProjects } from './repositories/projects.js';
// ============================================================================
// Types
// ============================================================================

export interface DateRangeFilter {
  days: number;
  projectId?: string;
}

export interface DurationTrendsFilter extends DateRangeFilter {
  browser?: string;
  testType?: string;
}

export interface PassRateTrendPoint {
  date: string;
  passed: number;
  failed: number;
  total: number;
  pass_rate: number | null;
}

export interface PassRateTrendsResult {
  trends: PassRateTrendPoint[];
  summary: {
    period_days: number;
    total_runs: number;
    total_passed: number;
    total_failed: number;
    overall_pass_rate: number | null;
    start_date: string;
    end_date: string;
  };
  project_filter: string | null;
}

export interface AccessibilityTrendPoint {
  date: string;
  total_violations: number;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  runs_with_violations: number;
  total_runs: number;
}

export interface AccessibilityTrendsResult {
  trends: AccessibilityTrendPoint[];
  summary: {
    period_days: number;
    total_runs: number;
    runs_with_violations: number;
    total_violations: number;
    avg_violations_per_run: number;
    violation_trend: 'improving' | 'stable' | 'worsening';
    start_date: string;
    end_date: string;
  };
  project_filter: string | null;
}

export interface DurationTrendPoint {
  date: string;
  run_count: number;
  p50_ms: number | null;
  p95_ms: number | null;
  p99_ms: number | null;
  avg_ms: number | null;
  min_ms: number | null;
  max_ms: number | null;
}

export interface DurationRegression {
  detected: boolean;
  change_percent: number | null;
  message: string;
}

export interface DurationTrendsResult {
  trends: DurationTrendPoint[];
  summary: {
    period_days: number;
    total_runs: number;
    overall_p50_ms: number | null;
    overall_p95_ms: number | null;
    overall_p99_ms: number | null;
    overall_avg_ms: number | null;
    start_date: string;
    end_date: string;
  };
  regression: DurationRegression;
  filters: {
    project_id: string | null;
    browser: string | null;
    test_type: string | null;
    available_browsers: string[];
    available_test_types: string[];
  };
}

export interface BrowserStatEntry {
  browser: string;
  total_runs: number;
  passed: number;
  failed: number;
  error: number;
  pass_rate: number;
  failure_rate: number;
}

export interface FailingTestEntry {
  test_id: string;
  test_name: string;
  suite_id: string;
  suite_name: string;
  project_id: string;
  project_name: string;
  failure_count: number;
  total_runs: number;
  failure_percentage: number;
  last_failure?: string;
}

export interface ProjectComparisonEntry {
  project_id: string;
  project_name: string;
  project_slug: string;
  suite_count: number;
  test_count: number;
  total_runs: number;
  passed_runs: number;
  failed_runs: number;
  pass_rate: number;
  created_at: string;
}

export interface BranchMetrics {
  branch: string;
  total_runs: number;
  passed_runs: number;
  failed_runs: number;
  pass_rate: number;
  avg_duration_ms: number | null;
  flaky_count: number;
  first_run: string | null;
  last_run: string | null;
}

export interface BranchComparisonResult {
  available_branches: string[];
  comparison: {
    branchA: BranchMetrics;
    branchB: BranchMetrics;
    deltas: {
      pass_rate: { value: number; trend: string; formatted: string };
      avg_duration_ms: { value: number | null; trend: string; formatted: string };
      failed_runs: { value: number; trend: string; formatted: string };
      flaky_count: { value: number; trend: string; formatted: string };
    };
  } | null;
  message?: string;
}

export interface DashboardSummary {
  total_tests: number;
  passed: number;
  failed: number;
  flaky: number;
  no_runs: number;
  timestamp: string;
}

export interface DashboardStats {
  projects: number;
  test_suites: number;
  tests: number;
  test_runs: number;
  passed_runs: number;
  failed_runs: number;
  pass_rate: number;
  timestamp?: string;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Get suite IDs scoped to an org and optional project filter.
 * Runs the two DB queries (projects + suites) in parallel.
 */
async function getScopedSuiteIds(
  orgId: string,
  projectIdFilter?: string
): Promise<string[]> {
  const [allProjects, allSuites] = await Promise.all([
    dbListProjects(orgId),
    listAllTestSuites(orgId),
  ]);

  const orgProjects = allProjects.filter(p => !projectIdFilter || p.id === projectIdFilter);
  const projectIds = orgProjects.map(p => p.id);
  const orgSuites = allSuites.filter(s => projectIds.includes(s.project_id));
  return orgSuites.map(s => s.id);
}

/**
 * Build a date key map initialized with all days in the given range.
 * Returns entries keyed by YYYY-MM-DD date strings.
 */
function initDailyRange<T>(days: number, factory: (dateKey: string) => T): Map<string, T> {
  const map = new Map<string, T>();
  for (let d = 0; d < days; d++) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateKey = date.toISOString().split('T')[0] || '';
    map.set(dateKey, factory(dateKey));
  }
  return map;
}

/**
 * Calculate the p-th percentile from a sorted array.
 * Returns null for empty arrays.
 */
function calculatePercentile(sortedArr: number[], p: number): number | null {
  if (sortedArr.length === 0) return null;
  const index = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, index)] || null;
}

/**
 * Get the start-of-range Date for a given number of days ago.
 */
function getStartDate(days: number): Date {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);
  return startDate;
}

// ============================================================================
// Service Implementation
// ============================================================================

export class AnalyticsService {
  /**
   * Compute pass rate trends over the specified date range.
   * Groups completed test runs by day, calculates daily pass/fail counts
   * and the overall pass rate for the period.
   */
  async getPassRateTrends(orgId: string, filter: DateRangeFilter): Promise<PassRateTrendsResult> {
    const { days, projectId } = filter;
    const suiteIds = await getScopedSuiteIds(orgId, projectId);
    const startDate = getStartDate(days);

    const relevantRuns = (await listTestRunsByOrg(orgId))
      .filter(r => suiteIds.includes(r.suite_id))
      .filter(r => r.status !== 'pending' && r.status !== 'running')
      .filter(r => {
        const runDate = r.completed_at || r.created_at;
        return runDate >= startDate;
      });

    // Initialize daily buckets
    const dailyData = initDailyRange(days, (dateKey) => ({
      date: dateKey,
      passed: 0,
      failed: 0,
      total: 0,
    }));

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

    // Build sorted trend array with computed pass rates
    const trends: PassRateTrendPoint[] = Array.from(dailyData.values())
      .map(d => ({
        date: d.date,
        passed: d.passed,
        failed: d.failed,
        total: d.total,
        pass_rate: d.total > 0 ? Math.round((d.passed / d.total) * 100) : null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Summary
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
        start_date: startDate.toISOString().split('T')[0] || '',
        end_date: new Date().toISOString().split('T')[0] || '',
      },
      project_filter: projectId || null,
    };
  }

  /**
   * Compute accessibility violation trends over the specified date range.
   * Groups accessibility test runs by day and counts violations by severity.
   * Determines whether the violation trend is improving, stable, or worsening
   * by comparing the first and second halves of the period.
   */
  async getAccessibilityTrends(orgId: string, filter: DateRangeFilter): Promise<AccessibilityTrendsResult> {
    const { days, projectId } = filter;
    const suiteIds = await getScopedSuiteIds(orgId, projectId);
    const startDate = getStartDate(days);

    // Need includeResults to access accessibility_results
    const relevantRuns = (await listTestRunsByOrg(orgId, { includeResults: true }))
      .filter(r => suiteIds.includes(r.suite_id))
      .filter(r => r.test_type === 'accessibility')
      .filter(r => r.status !== 'pending' && r.status !== 'running')
      .filter(r => {
        const runDate = r.completed_at || r.created_at;
        return runDate >= startDate;
      });

    // Initialize daily buckets
    const dailyData = initDailyRange(days, (dateKey) => ({
      date: dateKey,
      total_violations: 0,
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0,
      runs_with_violations: 0,
      total_runs: 0,
    }));

    // Aggregate by day
    for (const run of relevantRuns) {
      const runDate = (run.completed_at || run.created_at).toISOString().split('T')[0] || '';
      const dayData = dailyData.get(runDate);
      if (dayData) {
        dayData.total_runs++;

        const a11yResults = run.accessibility_results;
        if (a11yResults && a11yResults.violations) {
          const rawViolations = a11yResults.violations;
          const violations = Array.isArray(rawViolations)
            ? rawViolations
            : ((rawViolations as { items?: Array<{ impact?: string }> }).items || []);
          const violationCount = violations.length;

          if (violationCount > 0) {
            dayData.runs_with_violations++;
            dayData.total_violations += violationCount;

            for (const v of violations) {
              const impact = (v.impact?.toLowerCase()) || 'minor';
              if (impact === 'critical') dayData.critical++;
              else if (impact === 'serious') dayData.serious++;
              else if (impact === 'moderate') dayData.moderate++;
              else dayData.minor++;
            }
          }
        }
      }
    }

    const trends: AccessibilityTrendPoint[] = Array.from(dailyData.values())
      .sort((a, b) => a.date.localeCompare(b.date));

    // Summary
    const totalRuns = trends.reduce((sum, d) => sum + d.total_runs, 0);
    const totalViolations = trends.reduce((sum, d) => sum + d.total_violations, 0);
    const runsWithViolations = trends.reduce((sum, d) => sum + d.runs_with_violations, 0);
    const avgViolationsPerRun = totalRuns > 0 ? totalViolations / totalRuns : 0;

    // Determine trend direction by comparing first half to second half
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
        start_date: startDate.toISOString().split('T')[0] || '',
        end_date: new Date().toISOString().split('T')[0] || '',
      },
      project_filter: projectId || null,
    };
  }

  /**
   * Compute duration trends with p50/p95/p99 percentiles over the specified date range.
   * Supports optional browser and test type filters. Detects duration regressions
   * by comparing p95 values between the first and second halves of the period.
   */
  async getDurationTrends(orgId: string, filter: DurationTrendsFilter): Promise<DurationTrendsResult> {
    const { days, projectId, browser: browserFilter, testType: testTypeFilter } = filter;
    const suiteIds = await getScopedSuiteIds(orgId, projectId);
    const startDate = getStartDate(days);

    let relevantRuns = (await listTestRunsByOrg(orgId))
      .filter(r => suiteIds.includes(r.suite_id))
      .filter(r => r.status === 'passed' || r.status === 'failed')
      .filter(r => r.duration_ms && r.duration_ms > 0)
      .filter(r => {
        const runDate = r.completed_at || r.created_at;
        return runDate >= startDate;
      });

    if (browserFilter) {
      relevantRuns = relevantRuns.filter(r => r.browser === browserFilter);
    }
    if (testTypeFilter) {
      relevantRuns = relevantRuns.filter(r => r.test_type === testTypeFilter);
    }

    // Initialize daily buckets
    const dailyData = initDailyRange(days, (dateKey) => ({
      date: dateKey,
      durations: [] as number[],
    }));

    // Aggregate durations by day
    for (const run of relevantRuns) {
      const runDate = (run.completed_at || run.created_at).toISOString().split('T')[0] || '';
      const dayData = dailyData.get(runDate);
      if (dayData && run.duration_ms) {
        dayData.durations.push(run.duration_ms);
      }
    }

    // Calculate percentiles for each day
    const trends: DurationTrendPoint[] = Array.from(dailyData.values())
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

    // Overall summary
    const allDurations = relevantRuns.map(r => r.duration_ms!).filter(d => d > 0);
    const sortedAll = [...allDurations].sort((a, b) => a - b);
    const overallP50 = calculatePercentile(sortedAll, 50);
    const overallP95 = calculatePercentile(sortedAll, 95);
    const overallP99 = calculatePercentile(sortedAll, 99);
    const overallAvg = sortedAll.length > 0 ? Math.round(sortedAll.reduce((s, v) => s + v, 0) / sortedAll.length) : null;

    // Detect p95 regression between first and second halves of the period
    let regression: DurationRegression = {
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
              message: `Duration regression detected: p95 increased by ${Math.round(changePercent)}% in the recent period`,
            };
          }
        }
      }
    }

    // Unique filter options from the data
    const browsers = [...new Set(relevantRuns.map(r => r.browser).filter(Boolean))] as string[];
    const testTypes = [...new Set(relevantRuns.map(r => r.test_type).filter(Boolean))] as string[];

    return {
      trends,
      summary: {
        period_days: days,
        total_runs: allDurations.length,
        overall_p50_ms: overallP50 ? Math.round(overallP50) : null,
        overall_p95_ms: overallP95 ? Math.round(overallP95) : null,
        overall_p99_ms: overallP99 ? Math.round(overallP99) : null,
        overall_avg_ms: overallAvg,
        start_date: startDate.toISOString().split('T')[0] || '',
        end_date: new Date().toISOString().split('T')[0] || '',
      },
      regression,
      filters: {
        project_id: projectId || null,
        browser: browserFilter || null,
        test_type: testTypeFilter || null,
        available_browsers: browsers,
        available_test_types: testTypes,
      },
    };
  }

  /**
   * Get browser-specific pass rates for the organization.
   * Returns stats per browser sorted by usage (most runs first).
   */
  async getBrowserStats(orgId: string): Promise<BrowserStatEntry[]> {
    const orgRuns = (await listTestRunsByOrg(orgId))
      .filter(r => r.status !== 'pending' && r.status !== 'running');

    const browserStats: Map<string, {
      browser: string;
      total_runs: number;
      passed: number;
      failed: number;
      error: number;
    }> = new Map();

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
      if (run.status === 'passed') existing.passed++;
      else if (run.status === 'failed') existing.failed++;
      else if (run.status === 'error') existing.error++;

      browserStats.set(browserName, existing);
    }

    return Array.from(browserStats.values())
      .map(b => ({
        ...b,
        pass_rate: b.total_runs > 0 ? Math.round((b.passed / b.total_runs) * 100) : 0,
        failure_rate: b.total_runs > 0 ? Math.round(((b.failed + b.error) / b.total_runs) * 100) : 0,
      }))
      .sort((a, b) => b.total_runs - a.total_runs);
  }

  /**
   * Get the top failing tests for the organization.
   * Batch-loads all referenced tests and suites to avoid N+1 queries.
   * Returns up to 20 tests sorted by failure count descending.
   */
  async getFailingTests(orgId: string): Promise<FailingTestEntry[]> {
    // Need includeResults to iterate over individual test results
    const [allRuns, orgProjects] = await Promise.all([
      listTestRunsByOrg(orgId, { includeResults: true }),
      dbListProjects(orgId),
    ]);

    const orgRuns = allRuns.filter(r => r.results);
    const projectsMap = new Map<string, { id: string; name: string }>();
    for (const p of orgProjects) { projectsMap.set(p.id, p); }

    // Collect all test IDs from run results
    const allTestIds = new Set<string>();
    for (const run of orgRuns) {
      if (!run.results) continue;
      for (const result of run.results) {
        allTestIds.add(result.test_id);
      }
    }

    // Batch-load tests and suites
    const testsMap = await batchGetTests(Array.from(allTestIds));
    const allSuiteIds = new Set<string>();
    for (const test of testsMap.values()) {
      allSuiteIds.add(test.suite_id);
    }
    const suitesMap = await batchGetTestSuites(Array.from(allSuiteIds));

    // Track stats per test
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

    return Array.from(testStats.values())
      .filter(t => t.failure_count > 0)
      .map(t => ({
        test_id: t.test_id,
        test_name: t.test_name,
        suite_id: t.suite_id,
        suite_name: t.suite_name,
        project_id: t.project_id,
        project_name: t.project_name,
        failure_count: t.failure_count,
        total_runs: t.total_runs,
        failure_percentage: Math.round((t.failure_count / t.total_runs) * 100),
        last_failure: t.last_failure?.toISOString(),
      }))
      .sort((a, b) => b.failure_count - a.failure_count)
      .slice(0, 20);
  }

  /**
   * Compare all projects in the organization.
   * Returns per-project stats (suite count, test count, run counts, pass rate)
   * sorted by test count descending.
   */
  async getProjectComparison(orgId: string): Promise<ProjectComparisonEntry[]> {
    const [orgProjects, allOrgSuites, allOrgTests, allOrgRuns] = await Promise.all([
      dbListProjects(orgId),
      listAllTestSuites(orgId),
      listAllTests(orgId),
      listTestRunsByOrg(orgId),
    ]);

    const projectStats = orgProjects.map(project => {
      const projectSuites = allOrgSuites.filter(s => s.project_id === project.id);
      const suiteIds = projectSuites.map(s => s.id);
      const projectTests = allOrgTests.filter(t => suiteIds.includes(t.suite_id));
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

    projectStats.sort((a, b) => b.test_count - a.test_count);
    return projectStats;
  }

  /**
   * Compare test metrics between two branches.
   * Returns pass rate, avg duration, failure count, and flaky count for each branch,
   * along with deltas and trend indicators.
   */
  async getBranchComparison(orgId: string, branchA?: string, branchB?: string): Promise<BranchComparisonResult> {
    const allRuns = await listTestRunsByOrg(orgId);
    const completedRuns = allRuns.filter(r => r.status === 'passed' || r.status === 'failed' || r.status === 'error');

    // Collect unique branches
    const branchSet = new Set<string>();
    for (const run of completedRuns) {
      if (run.branch) branchSet.add(run.branch);
    }
    const availableBranches = Array.from(branchSet).sort();

    if (!branchA || !branchB) {
      return {
        available_branches: availableBranches,
        comparison: null,
        message: 'Select two branches to compare',
      };
    }

    const calculateBranchMetrics = (branchName: string): BranchMetrics => {
      const branchRuns = completedRuns.filter(r => r.branch === branchName);
      const totalRuns = branchRuns.length;
      const passedRuns = branchRuns.filter(r => r.status === 'passed').length;
      const failedRuns = branchRuns.filter(r => r.status === 'failed' || r.status === 'error').length;
      const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0;

      const runsWithDuration = branchRuns.filter(r => r.duration_ms && r.duration_ms > 0);
      const avgDuration = runsWithDuration.length > 0
        ? Math.round(runsWithDuration.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / runsWithDuration.length)
        : null;

      // Flaky = tests with both pass and fail runs on this branch
      const testStatusMap: Map<string, { passed: number; failed: number }> = new Map();
      for (const run of branchRuns) {
        const testId = run.test_id || run.suite_id;
        const existing = testStatusMap.get(testId) || { passed: 0, failed: 0 };
        if (run.status === 'passed') existing.passed++;
        else existing.failed++;
        testStatusMap.set(testId, existing);
      }
      let flakyCount = 0;
      for (const [, stats] of testStatusMap) {
        if (stats.passed > 0 && stats.failed > 0) flakyCount++;
      }

      const dates = branchRuns
        .map(r => r.completed_at || r.created_at)
        .filter(Boolean)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

      return {
        branch: branchName,
        total_runs: totalRuns,
        passed_runs: passedRuns,
        failed_runs: failedRuns,
        pass_rate: passRate,
        avg_duration_ms: avgDuration,
        flaky_count: flakyCount,
        first_run: dates.length > 0 ? dates[0]?.toISOString() ?? null : null,
        last_run: dates.length > 0 ? dates[dates.length - 1]?.toISOString() ?? null : null,
      };
    };

    const metricsA = calculateBranchMetrics(branchA);
    const metricsB = calculateBranchMetrics(branchB);

    const passRateDelta = metricsB.pass_rate - metricsA.pass_rate;
    const durationDelta = (metricsA.avg_duration_ms && metricsB.avg_duration_ms)
      ? metricsB.avg_duration_ms - metricsA.avg_duration_ms
      : null;
    const failureDelta = metricsB.failed_runs - metricsA.failed_runs;
    const flakyDelta = metricsB.flaky_count - metricsA.flaky_count;

    const getPassRateTrend = (delta: number): string => {
      if (delta > 5) return 'improved';
      if (delta < -5) return 'regressed';
      return 'same';
    };

    const getDurationTrend = (delta: number | null): string => {
      if (delta === null) return 'unknown';
      if (delta < -500) return 'improved';
      if (delta > 500) return 'regressed';
      return 'same';
    };

    const getFailureTrend = (delta: number): string => {
      if (delta < -2) return 'improved';
      if (delta > 2) return 'regressed';
      return 'same';
    };

    const getFlakyTrend = (delta: number): string => {
      if (delta < 0) return 'improved';
      if (delta > 0) return 'regressed';
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
  }

  /**
   * Get a dashboard summary of test health for AI chat context.
   * Returns total tests, pass/fail/flaky counts based on recent run history.
   */
  async getDashboardSummary(orgId: string): Promise<DashboardSummary> {
    const [tests, orgRuns] = await Promise.all([
      listAllTests(orgId),
      listTestRunsByOrg(orgId),
    ]);

    const totalTests = tests.length;
    const testRunStats: Map<string, { passed: number; failed: number }> = new Map();

    for (const run of orgRuns) {
      const testId = run.test_id;
      if (!testId) continue;
      const stats = testRunStats.get(testId) || { passed: 0, failed: 0 };
      if (run.status === 'passed') stats.passed++;
      else if (run.status === 'failed' || run.status === 'error') stats.failed++;
      testRunStats.set(testId, stats);
    }

    let passedCount = 0;
    let failedCount = 0;
    let flakyCount = 0;

    for (const [, stats] of testRunStats) {
      if (stats.passed > 0 && stats.failed > 0) flakyCount++;
      else if (stats.failed > 0) failedCount++;
      else if (stats.passed > 0) passedCount++;
    }

    const testsWithRuns = testRunStats.size;
    const testsWithoutRuns = totalTests - testsWithRuns;

    return {
      total_tests: totalTests,
      passed: passedCount,
      failed: failedCount,
      flaky: flakyCount,
      no_runs: testsWithoutRuns,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get extended dashboard statistics including counts of projects, suites,
   * tests, runs, and the overall pass rate.
   */
  async getDashboardStats(orgId: string): Promise<DashboardStats> {
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
  }
}

// Export a singleton instance for convenience
export const analyticsService = new AnalyticsService();
