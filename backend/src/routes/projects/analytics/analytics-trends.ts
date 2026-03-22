/**
 * Analytics Routes - Trends
 *
 * Time-series trend endpoints:
 * - GET /api/v1/analytics/pass-rate-trends (pass rate over time)
 * - GET /api/v1/analytics/accessibility-trends (a11y violations over time)
 * - GET /api/v1/analytics/duration-trends (duration percentiles over time)
 *
 * Feature #1356: Code quality - extracted from analytics.ts
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../../middleware/auth.js';
import { listAllTestSuites } from '../../../services/repositories/test-suites.js';
import { listTestRunsByOrg } from '../../../services/repositories/test-runs.js';
import { listProjects as dbListProjects } from '../../../services/repositories/projects.js';

export async function analyticsTrendRoutes(app: FastifyInstance): Promise<void> {
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
}
