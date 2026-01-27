/**
 * Analytics Tool Handlers
 *
 * Handlers for dashboard, analytics, and flaky test management MCP tools.
 * Extracted from server.ts to reduce file size (Feature #1356).
 */

import { ToolHandler, HandlerModule } from './types';

/**
 * Get dashboard summary (Feature #994)
 */
export const getDashboardSummary: ToolHandler = async (args, context) => {
  const period = (args.period as string) || '7d';
  const includeTrends = args.include_trends !== false;
  const includeTopFailures = args.include_top_failures !== false;
  const includeRecentRuns = args.include_recent_runs !== false;

  // Parse period to days
  const periodMatch = period.match(/^(\d+)([dh])$/);
  if (!periodMatch || !periodMatch[1] || !periodMatch[2]) {
    return { error: 'Invalid period format. Use 24h, 7d, 30d, or 90d.' };
  }

  const periodValue = parseInt(periodMatch[1], 10);
  const periodUnit = periodMatch[2];
  const periodMs = periodUnit === 'h'
    ? periodValue * 60 * 60 * 1000
    : periodValue * 24 * 60 * 60 * 1000;

  const cutoffDate = new Date(Date.now() - periodMs);
  const previousCutoffDate = new Date(Date.now() - periodMs * 2);

  try {
    // Fetch all necessary data
    const [projectsResult, runsResult] = await Promise.all([
      context.callApi('/api/v1/projects') as Promise<{
        projects?: Array<{
          id: string;
          name: string;
          created_at: string;
          test_count?: number;
          suite_count?: number;
        }>;
        error?: string;
      }>,
      context.callApi('/api/v1/runs?limit=1000') as Promise<{
        runs?: Array<{
          id: string;
          test_id?: string;
          test_name?: string;
          project_id?: string;
          project_name?: string;
          status: string;
          test_type?: string;
          started_at: string;
          completed_at?: string;
          duration_ms?: number;
          results?: Array<{
            status: string;
            error?: string;
          }>;
        }>;
        error?: string;
      }>,
    ]);

    if (projectsResult.error) {
      return { success: false, error: `Failed to fetch projects: ${projectsResult.error}` };
    }

    const projects = projectsResult.projects || [];
    const allRuns = runsResult.runs || [];

    // Filter runs by period
    const currentPeriodRuns = allRuns.filter(r =>
      new Date(r.started_at) >= cutoffDate
    );
    const previousPeriodRuns = includeTrends
      ? allRuns.filter(r =>
          new Date(r.started_at) >= previousCutoffDate &&
          new Date(r.started_at) < cutoffDate
        )
      : [];

    // Calculate statistics for current period
    const completedRuns = currentPeriodRuns.filter(r => r.status === 'completed');
    const failedRuns = currentPeriodRuns.filter(r => r.status === 'failed');
    const runningRuns = currentPeriodRuns.filter(r => r.status === 'running');
    const passedRuns = completedRuns.filter(r =>
      !r.results?.some(res => res.status === 'failed')
    );

    const totalRuns = currentPeriodRuns.length;
    const passRate = totalRuns > 0
      ? Math.round((passedRuns.length / totalRuns) * 1000) / 10
      : 0;

    // Calculate test counts by type
    const runsByType = currentPeriodRuns.reduce((acc, run) => {
      const type = run.test_type || 'e2e';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate previous period stats for trends
    let trends: {
      runs_change: number;
      pass_rate_change: number;
      trend_direction: 'improving' | 'declining' | 'stable';
    } | null = null;

    if (includeTrends && previousPeriodRuns.length > 0) {
      const prevCompleted = previousPeriodRuns.filter(r => r.status === 'completed');
      const prevPassed = prevCompleted.filter(r =>
        !r.results?.some(res => res.status === 'failed')
      );
      const prevPassRate = previousPeriodRuns.length > 0
        ? (prevPassed.length / previousPeriodRuns.length) * 100
        : 0;

      const runsChange = totalRuns - previousPeriodRuns.length;
      const passRateChange = Math.round((passRate - prevPassRate) * 10) / 10;

      trends = {
        runs_change: runsChange,
        pass_rate_change: passRateChange,
        trend_direction: passRateChange > 2 ? 'improving' : passRateChange < -2 ? 'declining' : 'stable',
      };
    }

    // Get top failing tests
    let topFailures: Array<{
      test_id?: string;
      test_name?: string;
      project_name?: string;
      failure_count: number;
      last_failure: string;
      error_sample?: string;
    }> | null = null;

    if (includeTopFailures) {
      const failuresByTest = new Map<string, {
        count: number;
        test_name?: string;
        project_name?: string;
        last_failure: Date;
        error?: string;
      }>();

      for (const run of failedRuns) {
        const key = run.test_id || run.id;
        const existing = failuresByTest.get(key);
        const runDate = new Date(run.started_at);

        if (!existing || runDate > existing.last_failure) {
          failuresByTest.set(key, {
            count: (existing?.count || 0) + 1,
            test_name: run.test_name,
            project_name: run.project_name,
            last_failure: runDate,
            error: run.results?.[0]?.error,
          });
        } else {
          existing.count++;
        }
      }

      topFailures = Array.from(failuresByTest.entries())
        .map(([testId, data]) => ({
          test_id: testId,
          test_name: data.test_name,
          project_name: data.project_name,
          failure_count: data.count,
          last_failure: data.last_failure.toISOString(),
          error_sample: data.error?.substring(0, 200),
        }))
        .sort((a, b) => b.failure_count - a.failure_count)
        .slice(0, 10);
    }

    // Get recent runs
    let recentRuns: Array<{
      run_id: string;
      test_name?: string;
      project_name?: string;
      status: string;
      test_type?: string;
      started_at: string;
      duration_ms?: number;
    }> | null = null;

    if (includeRecentRuns) {
      recentRuns = currentPeriodRuns
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
        .slice(0, 10)
        .map(run => ({
          run_id: run.id,
          test_name: run.test_name,
          project_name: run.project_name,
          status: run.status,
          test_type: run.test_type,
          started_at: run.started_at,
          duration_ms: run.duration_ms,
        }));
    }

    // Calculate average run duration
    const durations = completedRuns
      .filter(r => r.duration_ms)
      .map(r => r.duration_ms!);
    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    // Calculate health score (0-100)
    const healthScore = Math.round(
      (passRate * 0.6) + // Pass rate weighted 60%
      (runningRuns.length > 0 ? 10 : 0) + // Active testing bonus
      (totalRuns > 0 ? 20 : 0) + // Has recent tests
      (failedRuns.length === 0 ? 10 : Math.max(0, 10 - failedRuns.length)) // Failure penalty
    );

    // Determine overall status
    const overallStatus = healthScore >= 80 ? 'healthy' :
                         healthScore >= 60 ? 'warning' : 'critical';

    return {
      success: true,
      period,
      generated_at: new Date().toISOString(),
      organization_summary: {
        total_projects: projects.length,
        total_test_runs: totalRuns,
        pass_rate_percent: passRate,
        health_score: healthScore,
        overall_status: overallStatus,
      },
      run_statistics: {
        total: totalRuns,
        completed: completedRuns.length,
        passed: passedRuns.length,
        failed: failedRuns.length,
        running: runningRuns.length,
        average_duration_ms: avgDuration,
      },
      test_type_breakdown: runsByType,
      ...(includeTrends && trends && {
        trends: {
          ...trends,
          previous_period_runs: previousPeriodRuns.length,
        },
      }),
      ...(includeTopFailures && topFailures && {
        top_failures: topFailures,
      }),
      ...(includeRecentRuns && recentRuns && {
        recent_runs: recentRuns,
      }),
      recommendations: [
        ...(passRate < 80 ? [`Pass rate is ${passRate}% - investigate failing tests`] : []),
        ...(failedRuns.length > 10 ? [`${failedRuns.length} failed runs in this period - consider reviewing test stability`] : []),
        ...(totalRuns === 0 ? ['No test runs in this period - ensure CI/CD pipelines are configured'] : []),
        ...(trends?.trend_direction === 'declining' ? ['Pass rate is declining - review recent changes'] : []),
        ...(healthScore >= 90 ? ['Excellent test health! Keep up the good work.'] : []),
      ],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get dashboard summary',
    };
  }
};

/**
 * Get failing tests (Feature #1001)
 */
export const getFailingTests: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string | undefined;
  const period = (args.period as string) || '7d';
  const limit = (args.limit as number) || 20;
  const includeTrends = args.include_trends !== false;

  // Parse period
  const periodDays = parseInt(period.replace('d', ''), 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);

  try {
    // Fetch runs
    const endpoint = projectId
      ? `/api/v1/projects/${projectId}/runs?limit=1000`
      : '/api/v1/runs?limit=1000';

    const runsResult = await context.callApi(endpoint) as {
      runs?: Array<{
        id: string;
        test_id?: string;
        test_name?: string;
        project_id?: string;
        project_name?: string;
        status: string;
        started_at: string;
        completed_at?: string;
        results?: Array<{
          status: string;
          error?: string;
        }>;
      }>;
      error?: string;
    };

    if (runsResult.error) {
      return { success: false, error: `Failed to fetch runs: ${runsResult.error}` };
    }

    const allRuns = runsResult.runs || [];

    // Filter runs within period
    const periodRuns = allRuns.filter(r =>
      new Date(r.started_at) >= cutoffDate && r.status === 'failed'
    );

    // Group failures by test
    const failuresByTest = new Map<string, {
      test_name?: string;
      project_name?: string;
      failure_count: number;
      last_failure: Date;
      errors: string[];
      run_ids: string[];
    }>();

    for (const run of periodRuns) {
      const key = run.test_id || run.id;
      const existing = failuresByTest.get(key);
      const runDate = new Date(run.started_at);
      const error = run.results?.[0]?.error;

      if (!existing) {
        failuresByTest.set(key, {
          test_name: run.test_name,
          project_name: run.project_name,
          failure_count: 1,
          last_failure: runDate,
          errors: error ? [error] : [],
          run_ids: [run.id],
        });
      } else {
        existing.failure_count++;
        if (runDate > existing.last_failure) {
          existing.last_failure = runDate;
        }
        if (error && !existing.errors.includes(error)) {
          existing.errors.push(error);
        }
        existing.run_ids.push(run.id);
      }
    }

    // Sort by failure count and limit
    const failingTests = Array.from(failuresByTest.entries())
      .map(([testId, data]) => ({
        test_id: testId,
        test_name: data.test_name,
        project_name: data.project_name,
        failure_count: data.failure_count,
        last_failure: data.last_failure.toISOString(),
        unique_errors: data.errors.length,
        error_samples: data.errors.slice(0, 3).map(e => e.substring(0, 200)),
        recent_run_ids: data.run_ids.slice(-5),
      }))
      .sort((a, b) => b.failure_count - a.failure_count)
      .slice(0, limit);

    return {
      success: true,
      project_id: projectId,
      period,
      total_failing_tests: failingTests.length,
      total_failures: periodRuns.length,
      failing_tests: failingTests,
      recommendations: [
        ...(failingTests.length > 10 ? ['Consider prioritizing the top 5 most-failing tests for fixing'] : []),
        ...(failingTests.some(t => t.failure_count > 10) ? ['Some tests are failing repeatedly - investigate root causes'] : []),
        ...(failingTests.length === 0 ? ['Great job! No consistently failing tests in this period'] : []),
      ],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get failing tests',
    };
  }
};

/**
 * Get test coverage (Feature #1003)
 */
export const getTestCoverage: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string;

  if (!projectId) {
    return { error: 'project_id is required' };
  }

  try {
    // Fetch project with suites and tests
    const [projectResult, suitesResult] = await Promise.all([
      context.callApi(`/api/v1/projects/${projectId}`) as Promise<{
        project?: {
          id: string;
          name: string;
        };
        error?: string;
      }>,
      context.callApi(`/api/v1/projects/${projectId}/suites`) as Promise<{
        suites?: Array<{
          id: string;
          name: string;
          tests?: Array<{
            id: string;
            name: string;
            status: string;
            type: string;
          }>;
        }>;
        error?: string;
      }>,
    ]);

    if (projectResult.error) {
      return { success: false, error: projectResult.error };
    }

    const project = projectResult.project;
    const suites = suitesResult.suites || [];

    // Calculate coverage metrics
    let totalTests = 0;
    let activeTests = 0;
    let draftTests = 0;
    let archivedTests = 0;
    const testsByType: Record<string, number> = {};
    const testsBySuite: Array<{
      suite_id: string;
      suite_name: string;
      total_tests: number;
      active_tests: number;
    }> = [];

    for (const suite of suites) {
      const suiteTests = suite.tests || [];
      let suiteActive = 0;

      for (const test of suiteTests) {
        totalTests++;
        const type = test.type || 'e2e';
        testsByType[type] = (testsByType[type] || 0) + 1;

        if (test.status === 'active') {
          activeTests++;
          suiteActive++;
        } else if (test.status === 'draft') {
          draftTests++;
        } else if (test.status === 'archived') {
          archivedTests++;
        }
      }

      testsBySuite.push({
        suite_id: suite.id,
        suite_name: suite.name,
        total_tests: suiteTests.length,
        active_tests: suiteActive,
      });
    }

    const coveragePercent = totalTests > 0
      ? Math.round((activeTests / totalTests) * 100)
      : 0;

    return {
      success: true,
      project_id: projectId,
      project_name: project?.name,
      summary: {
        total_tests: totalTests,
        active_tests: activeTests,
        draft_tests: draftTests,
        archived_tests: archivedTests,
        coverage_percent: coveragePercent,
      },
      by_type: testsByType,
      by_suite: testsBySuite,
      recommendations: [
        ...(coveragePercent < 50 ? ['Less than 50% of tests are active - review and activate draft tests'] : []),
        ...(draftTests > 10 ? [`${draftTests} tests are in draft status - consider finalizing them`] : []),
        ...(archivedTests > totalTests * 0.3 ? ['Many tests are archived - consider cleaning up obsolete tests'] : []),
        ...(coveragePercent >= 80 ? ['Good test coverage! Continue adding tests as features grow.'] : []),
      ],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get test coverage',
    };
  }
};

/**
 * Get quality score (Feature #1004)
 */
export const getQualityScore: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string | undefined;
  const period = (args.period as string) || '30d';
  const includeBreakdown = args.include_breakdown !== false;

  // Parse period
  const periodDays = parseInt(period.replace('d', ''), 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);

  try {
    // Fetch runs
    const endpoint = projectId
      ? `/api/v1/projects/${projectId}/runs?limit=500`
      : '/api/v1/runs?limit=500';

    const runsResult = await context.callApi(endpoint) as {
      runs?: Array<{
        id: string;
        status: string;
        started_at: string;
        duration_ms?: number;
        results?: Array<{
          status: string;
        }>;
      }>;
      error?: string;
    };

    if (runsResult.error) {
      return { success: false, error: `Failed to fetch runs: ${runsResult.error}` };
    }

    const allRuns = runsResult.runs || [];
    const periodRuns = allRuns.filter(r => new Date(r.started_at) >= cutoffDate);

    if (periodRuns.length === 0) {
      return {
        success: true,
        project_id: projectId,
        period,
        quality_score: 0,
        message: 'No test runs in the specified period',
        hint: 'Run tests to get a quality score',
      };
    }

    // Calculate component scores
    const completedRuns = periodRuns.filter(r => r.status === 'completed');
    const failedRuns = periodRuns.filter(r => r.status === 'failed');
    const passedRuns = completedRuns.filter(r =>
      !r.results?.some(res => res.status === 'failed')
    );

    // Pass rate score (0-100, weighted 60%)
    const passRateScore = periodRuns.length > 0
      ? (passedRuns.length / periodRuns.length) * 100
      : 0;

    // Stability score (0-100, weighted 25%)
    // Based on consecutive passes/fails
    let stabilityScore = 100;
    let consecutiveStatus: 'pass' | 'fail' | null = null;
    let transitions = 0;

    const sortedRuns = [...periodRuns].sort(
      (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
    );

    for (const run of sortedRuns) {
      const isPassed = run.status === 'completed' && !run.results?.some(r => r.status === 'failed');
      const status = isPassed ? 'pass' : 'fail';

      if (consecutiveStatus && consecutiveStatus !== status) {
        transitions++;
      }
      consecutiveStatus = status;
    }

    // More transitions = less stable
    stabilityScore = Math.max(0, 100 - (transitions * 5));

    // Performance score (0-100, weighted 15%)
    // Based on run durations
    const durations = completedRuns
      .filter(r => r.duration_ms)
      .map(r => r.duration_ms!);

    let performanceScore = 100;
    if (durations.length > 0) {
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      // Score decreases as duration increases
      // 30 seconds = 100, 5 minutes = 50, 15+ minutes = 0
      performanceScore = Math.max(0, Math.min(100, 100 - ((avgDuration - 30000) / 9000)));
    }

    // Calculate weighted quality score
    const qualityScore = Math.round(
      (passRateScore * 0.6) +
      (stabilityScore * 0.25) +
      (performanceScore * 0.15)
    );

    // Determine grade
    const grade = qualityScore >= 90 ? 'A' :
                 qualityScore >= 80 ? 'B' :
                 qualityScore >= 70 ? 'C' :
                 qualityScore >= 60 ? 'D' : 'F';

    return {
      success: true,
      project_id: projectId,
      period,
      quality_score: qualityScore,
      grade,
      ...(includeBreakdown && {
        breakdown: {
          pass_rate: {
            score: Math.round(passRateScore),
            weight: '60%',
            passed: passedRuns.length,
            total: periodRuns.length,
          },
          stability: {
            score: Math.round(stabilityScore),
            weight: '25%',
            transitions,
            total_runs: periodRuns.length,
          },
          performance: {
            score: Math.round(performanceScore),
            weight: '15%',
            avg_duration_ms: durations.length > 0
              ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
              : null,
          },
        },
      }),
      recommendations: [
        ...(passRateScore < 80 ? ['Improve pass rate by fixing failing tests'] : []),
        ...(stabilityScore < 70 ? ['Tests are flaky - investigate intermittent failures'] : []),
        ...(performanceScore < 70 ? ['Consider optimizing slow tests'] : []),
        ...(qualityScore >= 90 ? ['Excellent quality! Keep up the good work.'] : []),
      ],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get quality score',
    };
  }
};

/**
 * Get team metrics (Feature #1005)
 */
export const getTeamMetrics: ToolHandler = async (args, context) => {
  const period = (args.period as string) || '30d';
  const includeByProject = args.include_by_project !== false;

  // Parse period
  const periodDays = parseInt(period.replace('d', ''), 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);

  try {
    // Fetch runs
    const runsResult = await context.callApi('/api/v1/runs?limit=1000') as {
      runs?: Array<{
        id: string;
        project_id?: string;
        project_name?: string;
        triggered_by?: string;
        status: string;
        started_at: string;
        completed_at?: string;
        duration_ms?: number;
        results?: Array<{
          status: string;
        }>;
      }>;
      error?: string;
    };

    if (runsResult.error) {
      return { success: false, error: `Failed to fetch runs: ${runsResult.error}` };
    }

    const allRuns = runsResult.runs || [];
    const periodRuns = allRuns.filter(r => new Date(r.started_at) >= cutoffDate);

    // Calculate team-wide metrics
    const totalRuns = periodRuns.length;
    const completedRuns = periodRuns.filter(r => r.status === 'completed');
    const failedRuns = periodRuns.filter(r => r.status === 'failed');
    const passedRuns = completedRuns.filter(r =>
      !r.results?.some(res => res.status === 'failed')
    );

    const passRate = totalRuns > 0
      ? Math.round((passedRuns.length / totalRuns) * 1000) / 10
      : 0;

    // Calculate duration stats
    const durations = completedRuns
      .filter(r => r.duration_ms)
      .map(r => r.duration_ms!);

    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    // Calculate runs per day
    const runsPerDay = totalRuns / periodDays;

    // Group by project if requested
    let byProject: Array<{
      project_id: string;
      project_name?: string;
      total_runs: number;
      pass_rate: number;
      avg_duration_ms: number;
    }> | undefined;

    if (includeByProject) {
      const projectStats = new Map<string, {
        name?: string;
        runs: number;
        passed: number;
        durations: number[];
      }>();

      for (const run of periodRuns) {
        const projectId = run.project_id || 'unknown';
        const existing = projectStats.get(projectId) || {
          name: run.project_name,
          runs: 0,
          passed: 0,
          durations: [],
        };

        existing.runs++;
        const isPassed = run.status === 'completed' && !run.results?.some(r => r.status === 'failed');
        if (isPassed) existing.passed++;
        if (run.duration_ms) existing.durations.push(run.duration_ms);

        projectStats.set(projectId, existing);
      }

      byProject = Array.from(projectStats.entries())
        .map(([projectId, stats]) => ({
          project_id: projectId,
          project_name: stats.name,
          total_runs: stats.runs,
          pass_rate: stats.runs > 0 ? Math.round((stats.passed / stats.runs) * 1000) / 10 : 0,
          avg_duration_ms: stats.durations.length > 0
            ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
            : 0,
        }))
        .sort((a, b) => b.total_runs - a.total_runs);
    }

    return {
      success: true,
      period,
      team_summary: {
        total_runs: totalRuns,
        completed_runs: completedRuns.length,
        failed_runs: failedRuns.length,
        pass_rate_percent: passRate,
        avg_duration_ms: avgDuration,
        runs_per_day: Math.round(runsPerDay * 10) / 10,
      },
      ...(byProject && { by_project: byProject }),
      productivity: {
        rating: runsPerDay >= 10 ? 'high' :
                runsPerDay >= 5 ? 'medium' : 'low',
        runs_per_day: Math.round(runsPerDay * 10) / 10,
        message: runsPerDay >= 10
          ? 'Excellent testing activity!'
          : runsPerDay >= 5
          ? 'Good testing cadence'
          : 'Consider running more tests regularly',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get team metrics',
    };
  }
};

// Handler registry for analytics tools
export const handlers: Record<string, ToolHandler> = {
  get_dashboard_summary: getDashboardSummary,
  get_failing_tests: getFailingTests,
  get_test_coverage: getTestCoverage,
  get_quality_score: getQualityScore,
  get_team_metrics: getTeamMetrics,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const analyticsHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default analyticsHandlers;
