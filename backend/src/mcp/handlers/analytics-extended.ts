/**
 * Extended Analytics Tool Handlers
 *
 * Handlers for project analytics, browser analytics, and release quality MCP tools.
 * Extracted from server.ts to reduce file size (Feature #1356).
 */

import { ToolHandler, HandlerModule } from './types';

/**
 * Get project analytics (Feature #999)
 */
export const getProjectAnalytics: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string;
  const period = (args.period as string) || '30d';
  const includeSuiteBreakdown = args.include_suite_breakdown !== false;
  const includeFailureAnalysis = args.include_failure_analysis !== false;
  const includeFlakinessReport = args.include_flakiness_report !== false;
  const includeDurationAnalysis = args.include_duration_analysis !== false;

  if (!projectId) {
    return { error: 'project_id is required' };
  }

  // Parse period
  const periodDays = parseInt(period.replace('d', ''), 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);

  try {
    // Fetch project details and runs
    const [projectResult, runsResult, suitesResult] = await Promise.all([
      context.callApi(`/api/v1/projects/${projectId}`) as Promise<{
        project?: {
          id: string;
          name: string;
          description?: string;
          created_at: string;
        };
        error?: string;
      }>,
      context.callApi(`/api/v1/projects/${projectId}/runs?limit=1000`) as Promise<{
        runs?: Array<{
          id: string;
          test_id?: string;
          test_name?: string;
          suite_id?: string;
          suite_name?: string;
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
      context.callApi(`/api/v1/projects/${projectId}/suites`) as Promise<{
        suites?: Array<{
          id: string;
          name: string;
          type?: string;
          test_count?: number;
        }>;
        error?: string;
      }>,
    ]);

    if (projectResult.error || !projectResult.project) {
      return {
        success: false,
        error: `Project not found: ${projectResult.error || 'Project does not exist'}`,
      };
    }

    const project = projectResult.project;
    const allRuns = runsResult.runs || [];
    const suites = suitesResult.suites || [];

    // Filter runs within period
    const periodRuns = allRuns.filter(r =>
      new Date(r.started_at) >= cutoffDate
    );

    // Calculate basic stats
    const completedRuns = periodRuns.filter(r => r.status === 'completed');
    const failedRuns = periodRuns.filter(r => r.status === 'failed');
    const passedRuns = completedRuns.filter(r =>
      !r.results?.some(res => res.status === 'failed')
    );

    const passRate = periodRuns.length > 0
      ? Math.round((passedRuns.length / periodRuns.length) * 1000) / 10
      : 0;

    // Build daily trend data
    const dailyData: Map<string, { total: number; passed: number; failed: number }> = new Map();
    for (const run of periodRuns) {
      const date = (run.started_at || '').split('T')[0] || 'unknown';
      const existing = dailyData.get(date) || { total: 0, passed: 0, failed: 0 };
      existing.total++;
      if (run.status === 'completed' && !run.results?.some(r => r.status === 'failed')) {
        existing.passed++;
      } else if (run.status === 'failed' || run.results?.some(r => r.status === 'failed')) {
        existing.failed++;
      }
      if (date !== 'unknown') {
        dailyData.set(date, existing);
      }
    }

    const trendData = Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        total_runs: data.total,
        passed: data.passed,
        failed: data.failed,
        pass_rate: data.total > 0 ? Math.round((data.passed / data.total) * 100) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Suite breakdown
    let suiteBreakdown: Array<{
      suite_id: string;
      suite_name: string;
      test_count?: number;
      run_count: number;
      pass_rate: number;
      avg_duration_ms: number;
    }> | null = null;

    if (includeSuiteBreakdown) {
      const suiteStats = new Map<string, {
        name: string;
        testCount?: number;
        runs: number;
        passed: number;
        durations: number[];
      }>();

      // Initialize from suites
      for (const suite of suites) {
        suiteStats.set(suite.id, {
          name: suite.name,
          testCount: suite.test_count,
          runs: 0,
          passed: 0,
          durations: [],
        });
      }

      // Accumulate run stats
      for (const run of periodRuns) {
        if (run.suite_id) {
          const stats = suiteStats.get(run.suite_id) || {
            name: run.suite_name || 'Unknown',
            runs: 0,
            passed: 0,
            durations: [],
          };
          stats.runs++;
          if (run.status === 'completed' && !run.results?.some(r => r.status === 'failed')) {
            stats.passed++;
          }
          if (run.duration_ms) {
            stats.durations.push(run.duration_ms);
          }
          suiteStats.set(run.suite_id, stats);
        }
      }

      suiteBreakdown = Array.from(suiteStats.entries())
        .map(([id, stats]) => ({
          suite_id: id,
          suite_name: stats.name,
          test_count: stats.testCount,
          run_count: stats.runs,
          pass_rate: stats.runs > 0 ? Math.round((stats.passed / stats.runs) * 100) : 0,
          avg_duration_ms: stats.durations.length > 0
            ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
            : 0,
        }))
        .sort((a, b) => b.run_count - a.run_count);
    }

    // Failure analysis
    let failureAnalysis: {
      total_failures: number;
      common_errors: Array<{
        pattern: string;
        count: number;
        example_test?: string;
      }>;
      failure_by_type: Record<string, number>;
      most_failing_tests: Array<{
        test_id?: string;
        test_name?: string;
        failure_count: number;
      }>;
    } | null = null;

    if (includeFailureAnalysis) {
      const errorPatterns = new Map<string, { count: number; example?: string }>();
      const failuresByType: Record<string, number> = {};
      const failuresByTest = new Map<string, { name?: string; count: number }>();

      for (const run of failedRuns) {
        const type = run.test_type || 'e2e';
        failuresByType[type] = (failuresByType[type] || 0) + 1;

        if (run.test_id) {
          const testStats = failuresByTest.get(run.test_id) || { name: run.test_name, count: 0 };
          testStats.count++;
          failuresByTest.set(run.test_id, testStats);
        }

        for (const result of run.results || []) {
          if (result.status === 'failed' && result.error) {
            const errorKey = result.error.substring(0, 50);
            const existing = errorPatterns.get(errorKey) || { count: 0, example: run.test_name };
            existing.count++;
            errorPatterns.set(errorKey, existing);
          }
        }
      }

      failureAnalysis = {
        total_failures: failedRuns.length,
        common_errors: Array.from(errorPatterns.entries())
          .map(([pattern, data]) => ({
            pattern,
            count: data.count,
            example_test: data.example,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        failure_by_type: failuresByType,
        most_failing_tests: Array.from(failuresByTest.entries())
          .map(([testId, data]) => ({
            test_id: testId,
            test_name: data.name,
            failure_count: data.count,
          }))
          .sort((a, b) => b.failure_count - a.failure_count)
          .slice(0, 10),
      };
    }

    // Flakiness report
    let flakinessReport: {
      total_flaky_tests: number;
      flakiness_rate: number;
      flaky_tests: Array<{
        test_id?: string;
        test_name?: string;
        flakiness_score: number;
        flip_count: number;
      }>;
    } | null = null;

    if (includeFlakinessReport) {
      const testRuns = new Map<string, { name?: string; results: string[] }>();

      for (const run of periodRuns) {
        if (run.test_id) {
          const existing = testRuns.get(run.test_id) || { name: run.test_name, results: [] };
          existing.results.push(run.status);
          testRuns.set(run.test_id, existing);
        }
      }

      const flakyTests: Array<{
        test_id: string;
        test_name?: string;
        flakiness_score: number;
        flip_count: number;
      }> = [];

      for (const [testId, data] of testRuns.entries()) {
        if (data.results.length >= 3) {
          let flipCount = 0;
          for (let i = 1; i < data.results.length; i++) {
            if (data.results[i] !== data.results[i - 1]) {
              flipCount++;
            }
          }
          if (flipCount >= 2) {
            flakyTests.push({
              test_id: testId,
              test_name: data.name,
              flakiness_score: Math.round((flipCount / (data.results.length - 1)) * 100),
              flip_count: flipCount,
            });
          }
        }
      }

      flakinessReport = {
        total_flaky_tests: flakyTests.length,
        flakiness_rate: testRuns.size > 0 ? Math.round((flakyTests.length / testRuns.size) * 100) : 0,
        flaky_tests: flakyTests.sort((a, b) => b.flakiness_score - a.flakiness_score).slice(0, 20),
      };
    }

    // Duration analysis
    let durationAnalysis: {
      avg_duration_ms: number;
      min_duration_ms: number;
      max_duration_ms: number;
      p50_duration_ms: number;
      p90_duration_ms: number;
      p99_duration_ms: number;
      slowest_tests: Array<{
        test_id?: string;
        test_name?: string;
        avg_duration_ms: number;
      }>;
    } | null = null;

    if (includeDurationAnalysis) {
      const durations = periodRuns
        .filter(r => r.duration_ms)
        .map(r => r.duration_ms as number);

      if (durations.length > 0) {
        durations.sort((a, b) => a - b);
        const sum = durations.reduce((a, b) => a + b, 0);

        const testDurations = new Map<string, { name?: string; durations: number[] }>();
        for (const run of periodRuns) {
          if (run.test_id && run.duration_ms) {
            const existing = testDurations.get(run.test_id) || { name: run.test_name, durations: [] };
            existing.durations.push(run.duration_ms);
            testDurations.set(run.test_id, existing);
          }
        }

        durationAnalysis = {
          avg_duration_ms: Math.round(sum / durations.length),
          min_duration_ms: durations[0] ?? 0,
          max_duration_ms: durations[durations.length - 1] ?? 0,
          p50_duration_ms: durations[Math.floor(durations.length * 0.5)] ?? 0,
          p90_duration_ms: durations[Math.floor(durations.length * 0.9)] ?? 0,
          p99_duration_ms: durations[Math.floor(durations.length * 0.99)] ?? 0,
          slowest_tests: Array.from(testDurations.entries())
            .map(([testId, data]) => ({
              test_id: testId,
              test_name: data.name,
              avg_duration_ms: Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length),
            }))
            .sort((a, b) => b.avg_duration_ms - a.avg_duration_ms)
            .slice(0, 10),
        };
      }
    }

    return {
      success: true,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
      },
      period: period,
      summary: {
        total_runs: periodRuns.length,
        passed_runs: passedRuns.length,
        failed_runs: failedRuns.length,
        pass_rate: passRate,
        total_suites: suites.length,
      },
      trend_data: trendData,
      suite_breakdown: suiteBreakdown,
      failure_analysis: failureAnalysis,
      flakiness_report: flakinessReport,
      duration_analysis: durationAnalysis,
      generated_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get project analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Get browser analytics (Feature #1001)
 */
export const getBrowserAnalytics: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string;
  const period = (args.period as string) || '30d';
  const browsers = (args.browsers as string[]) || ['chromium', 'firefox', 'webkit'];
  const includeViewports = args.include_viewports !== false;
  const includePerformance = args.include_performance !== false;

  if (!projectId) {
    return { error: 'project_id is required' };
  }

  const periodDays = parseInt(period.replace('d', ''), 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);

  try {
    const runsResult = await context.callApi(`/api/v1/projects/${projectId}/runs?limit=1000`) as {
      runs?: Array<{
        id: string;
        status: string;
        browser?: string;
        viewport?: { width: number; height: number };
        started_at: string;
        duration_ms?: number;
      }>;
    };

    const allRuns = runsResult.runs || [];
    const periodRuns = allRuns.filter(r => new Date(r.started_at) >= cutoffDate);

    // Browser breakdown
    const browserStats = new Map<string, {
      runs: number;
      passed: number;
      failed: number;
      durations: number[];
    }>();

    for (const browser of browsers) {
      browserStats.set(browser, { runs: 0, passed: 0, failed: 0, durations: [] });
    }

    for (const run of periodRuns) {
      const browser = run.browser || 'chromium';
      const stats = browserStats.get(browser) || { runs: 0, passed: 0, failed: 0, durations: [] };
      stats.runs++;
      if (run.status === 'completed') {
        stats.passed++;
      } else if (run.status === 'failed') {
        stats.failed++;
      }
      if (run.duration_ms) {
        stats.durations.push(run.duration_ms);
      }
      browserStats.set(browser, stats);
    }

    const browserBreakdown = Array.from(browserStats.entries()).map(([browser, stats]) => ({
      browser,
      total_runs: stats.runs,
      passed: stats.passed,
      failed: stats.failed,
      pass_rate: stats.runs > 0 ? Math.round((stats.passed / stats.runs) * 100) : 0,
      avg_duration_ms: stats.durations.length > 0
        ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
        : 0,
    }));

    // Viewport breakdown
    let viewportBreakdown: Array<{
      viewport: string;
      total_runs: number;
      pass_rate: number;
    }> | null = null;

    if (includeViewports) {
      const viewportStats = new Map<string, { runs: number; passed: number }>();
      for (const run of periodRuns) {
        if (run.viewport) {
          const key = `${run.viewport.width}x${run.viewport.height}`;
          const stats = viewportStats.get(key) || { runs: 0, passed: 0 };
          stats.runs++;
          if (run.status === 'completed') stats.passed++;
          viewportStats.set(key, stats);
        }
      }
      viewportBreakdown = Array.from(viewportStats.entries())
        .map(([viewport, stats]) => ({
          viewport,
          total_runs: stats.runs,
          pass_rate: stats.runs > 0 ? Math.round((stats.passed / stats.runs) * 100) : 0,
        }))
        .sort((a, b) => b.total_runs - a.total_runs);
    }

    return {
      success: true,
      project_id: projectId,
      period: period,
      total_runs: periodRuns.length,
      browser_breakdown: browserBreakdown,
      viewport_breakdown: viewportBreakdown,
      recommendations: browserBreakdown.some(b => b.pass_rate < 80)
        ? ['Some browsers have low pass rates - consider browser-specific fixes']
        : [],
      generated_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get browser analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Get execution time analytics (Feature #1002)
 */
export const getExecutionTimeAnalytics: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string;
  const period = (args.period as string) || '30d';
  const groupBy = (args.group_by as string) || 'day';
  const includeSlowTests = args.include_slow_tests !== false;

  if (!projectId) {
    return { error: 'project_id is required' };
  }

  const periodDays = parseInt(period.replace('d', ''), 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);

  try {
    const runsResult = await context.callApi(`/api/v1/projects/${projectId}/runs?limit=1000`) as {
      runs?: Array<{
        id: string;
        test_id?: string;
        test_name?: string;
        status: string;
        started_at: string;
        duration_ms?: number;
      }>;
    };

    const allRuns = runsResult.runs || [];
    const periodRuns = allRuns.filter(r =>
      new Date(r.started_at) >= cutoffDate && r.duration_ms
    );

    // Group by time period
    const grouped = new Map<string, number[]>();
    for (const run of periodRuns) {
      let key: string;
      const date = new Date(run.started_at || Date.now());
      if (groupBy === 'hour') {
        key = `${date.toISOString().split('T')[0] || 'unknown'}T${date.getHours().toString().padStart(2, '0')}:00`;
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0] || 'unknown';
      } else {
        key = date.toISOString().split('T')[0] || 'unknown';
      }
      const existing = grouped.get(key) || [];
      if (run.duration_ms) existing.push(run.duration_ms);
      grouped.set(key, existing);
    }

    const timeSeries = Array.from(grouped.entries())
      .map(([period, durations]) => ({
        period,
        avg_duration_ms: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
        min_duration_ms: Math.min(...durations),
        max_duration_ms: Math.max(...durations),
        run_count: durations.length,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    // Slow tests
    let slowTests: Array<{
      test_id?: string;
      test_name?: string;
      avg_duration_ms: number;
      run_count: number;
    }> | null = null;

    if (includeSlowTests) {
      const testDurations = new Map<string, { name?: string; durations: number[] }>();
      for (const run of periodRuns) {
        if (run.test_id && run.duration_ms) {
          const existing = testDurations.get(run.test_id) || { name: run.test_name, durations: [] };
          existing.durations.push(run.duration_ms);
          testDurations.set(run.test_id, existing);
        }
      }
      slowTests = Array.from(testDurations.entries())
        .map(([testId, data]) => ({
          test_id: testId,
          test_name: data.name,
          avg_duration_ms: Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length),
          run_count: data.durations.length,
        }))
        .sort((a, b) => b.avg_duration_ms - a.avg_duration_ms)
        .slice(0, 20);
    }

    const allDurations = periodRuns.map(r => r.duration_ms as number);
    allDurations.sort((a, b) => a - b);

    return {
      success: true,
      project_id: projectId,
      period: period,
      group_by: groupBy,
      summary: {
        total_runs: periodRuns.length,
        total_duration_ms: allDurations.reduce((a, b) => a + b, 0),
        avg_duration_ms: allDurations.length > 0 ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length) : 0,
        p50_duration_ms: allDurations.length > 0 ? allDurations[Math.floor(allDurations.length * 0.5)] : 0,
        p90_duration_ms: allDurations.length > 0 ? allDurations[Math.floor(allDurations.length * 0.9)] : 0,
        p99_duration_ms: allDurations.length > 0 ? allDurations[Math.floor(allDurations.length * 0.99)] : 0,
      },
      time_series: timeSeries,
      slow_tests: slowTests,
      generated_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get execution time analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Get failure categories (Feature #1003)
 */
export const getFailureCategories: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string;
  const period = (args.period as string) || '30d';
  const includeExamples = args.include_examples !== false;
  const minOccurrences = (args.min_occurrences as number) || 1;

  if (!projectId) {
    return { error: 'project_id is required' };
  }

  const periodDays = parseInt(period.replace('d', ''), 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);

  try {
    const runsResult = await context.callApi(`/api/v1/projects/${projectId}/runs?limit=1000`) as {
      runs?: Array<{
        id: string;
        test_id?: string;
        test_name?: string;
        status: string;
        started_at: string;
        results?: Array<{
          status: string;
          error?: string;
          error_category?: string;
        }>;
      }>;
    };

    const allRuns = runsResult.runs || [];
    const failedRuns = allRuns.filter(r =>
      new Date(r.started_at) >= cutoffDate &&
      (r.status === 'failed' || r.results?.some(res => res.status === 'failed'))
    );

    // Categorize errors
    const categories = new Map<string, {
      count: number;
      examples: Array<{ test_name?: string; error?: string }>;
    }>();

    for (const run of failedRuns) {
      for (const result of run.results || []) {
        if (result.status === 'failed') {
          let category = result.error_category || 'unknown';

          // Auto-categorize based on error message
          if (result.error) {
            const errorLower = result.error.toLowerCase();
            if (errorLower.includes('timeout')) category = 'timeout';
            else if (errorLower.includes('element not found') || errorLower.includes('no such element')) category = 'element_not_found';
            else if (errorLower.includes('network') || errorLower.includes('fetch')) category = 'network_error';
            else if (errorLower.includes('assertion') || errorLower.includes('expect')) category = 'assertion_failure';
            else if (errorLower.includes('authentication') || errorLower.includes('unauthorized')) category = 'auth_error';
          }

          const existing = categories.get(category) || { count: 0, examples: [] };
          existing.count++;
          if (includeExamples && existing.examples.length < 3) {
            existing.examples.push({
              test_name: run.test_name,
              error: result.error?.substring(0, 200),
            });
          }
          categories.set(category, existing);
        }
      }
    }

    const categoryList = Array.from(categories.entries())
      .filter(([, data]) => data.count >= minOccurrences)
      .map(([category, data]) => ({
        category,
        count: data.count,
        percentage: failedRuns.length > 0 ? Math.round((data.count / failedRuns.length) * 100) : 0,
        examples: includeExamples ? data.examples : undefined,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      success: true,
      project_id: projectId,
      period: period,
      total_failures: failedRuns.length,
      categories: categoryList,
      recommendations: categoryList.slice(0, 3).map(c => ({
        category: c.category,
        suggestion: c.category === 'timeout' ? 'Consider increasing timeouts or optimizing slow operations'
          : c.category === 'element_not_found' ? 'Check if selectors are up to date with the application'
          : c.category === 'network_error' ? 'Verify network stability and API availability'
          : c.category === 'assertion_failure' ? 'Review expected values and test data'
          : 'Investigate and categorize these failures',
      })),
      generated_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get failure categories: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Get release quality (Feature #1004)
 */
export const getReleaseQuality: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string;
  const releaseTag = args.release_tag as string;
  const includeTestBreakdown = args.include_test_breakdown !== false;
  const includeRegressions = args.include_regressions !== false;

  if (!projectId) {
    return { error: 'project_id is required' };
  }

  try {
    const runsResult = await context.callApi(`/api/v1/projects/${projectId}/runs?limit=500`) as {
      runs?: Array<{
        id: string;
        test_id?: string;
        test_name?: string;
        status: string;
        started_at: string;
        release_tag?: string;
        duration_ms?: number;
      }>;
    };

    const allRuns = runsResult.runs || [];

    // Filter by release tag if specified
    const releaseRuns = releaseTag
      ? allRuns.filter(r => r.release_tag === releaseTag)
      : allRuns.slice(0, 100); // Last 100 runs if no tag specified

    const passedRuns = releaseRuns.filter(r => r.status === 'completed');
    const failedRuns = releaseRuns.filter(r => r.status === 'failed');

    // Test breakdown
    let testBreakdown: Array<{
      test_id?: string;
      test_name?: string;
      status: string;
      duration_ms?: number;
    }> | null = null;

    if (includeTestBreakdown) {
      testBreakdown = releaseRuns.map(r => ({
        test_id: r.test_id,
        test_name: r.test_name,
        status: r.status,
        duration_ms: r.duration_ms,
      }));
    }

    // Regressions (tests that passed before but failed in this release)
    let regressions: Array<{
      test_id?: string;
      test_name?: string;
      previous_status: string;
      current_status: string;
    }> | null = null;

    if (includeRegressions) {
      const currentTests = new Map<string, string>();
      for (const run of releaseRuns) {
        if (run.test_id) {
          currentTests.set(run.test_id, run.status);
        }
      }

      // Get previous runs (before this release)
      const previousRuns = allRuns.filter(r => {
        if (releaseTag) {
          return r.release_tag !== releaseTag && new Date(r.started_at) < new Date(releaseRuns[0]?.started_at || new Date());
        }
        return false;
      });

      const previousTests = new Map<string, { status: string; name?: string }>();
      for (const run of previousRuns) {
        if (run.test_id && !previousTests.has(run.test_id)) {
          previousTests.set(run.test_id, { status: run.status, name: run.test_name });
        }
      }

      regressions = [];
      for (const [testId, currentStatus] of currentTests.entries()) {
        const previous = previousTests.get(testId);
        if (previous && previous.status === 'completed' && currentStatus === 'failed') {
          regressions.push({
            test_id: testId,
            test_name: previous.name,
            previous_status: 'passed',
            current_status: 'failed',
          });
        }
      }
    }

    const qualityScore = releaseRuns.length > 0
      ? Math.round((passedRuns.length / releaseRuns.length) * 100)
      : 0;

    return {
      success: true,
      project_id: projectId,
      release_tag: releaseTag || 'latest',
      summary: {
        total_tests: releaseRuns.length,
        passed: passedRuns.length,
        failed: failedRuns.length,
        pass_rate: releaseRuns.length > 0 ? Math.round((passedRuns.length / releaseRuns.length) * 1000) / 10 : 0,
        quality_score: qualityScore,
        quality_grade: qualityScore >= 95 ? 'A' : qualityScore >= 85 ? 'B' : qualityScore >= 75 ? 'C' : qualityScore >= 60 ? 'D' : 'F',
      },
      test_breakdown: testBreakdown,
      regressions: regressions,
      release_ready: qualityScore >= 85 && (regressions?.length || 0) === 0,
      recommendations: qualityScore < 85
        ? ['Address failing tests before release', 'Review regressions if any']
        : ['Release looks good to go'],
      generated_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get release quality: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Compare releases (Feature #1005)
 */
export const compareReleases: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string;
  const releaseA = args.release_a as string;
  const releaseB = args.release_b as string;
  const includeTestDiff = args.include_test_diff !== false;

  if (!projectId) {
    return { error: 'project_id is required' };
  }
  if (!releaseA || !releaseB) {
    return { error: 'Both release_a and release_b are required' };
  }

  try {
    const runsResult = await context.callApi(`/api/v1/projects/${projectId}/runs?limit=1000`) as {
      runs?: Array<{
        id: string;
        test_id?: string;
        test_name?: string;
        status: string;
        release_tag?: string;
        duration_ms?: number;
      }>;
    };

    const allRuns = runsResult.runs || [];

    const runsA = allRuns.filter(r => r.release_tag === releaseA);
    const runsB = allRuns.filter(r => r.release_tag === releaseB);

    const passRateA = runsA.length > 0
      ? Math.round((runsA.filter(r => r.status === 'completed').length / runsA.length) * 1000) / 10
      : 0;
    const passRateB = runsB.length > 0
      ? Math.round((runsB.filter(r => r.status === 'completed').length / runsB.length) * 1000) / 10
      : 0;

    const avgDurationA = runsA.filter(r => r.duration_ms).length > 0
      ? Math.round(runsA.filter(r => r.duration_ms).reduce((a, r) => a + (r.duration_ms || 0), 0) / runsA.filter(r => r.duration_ms).length)
      : 0;
    const avgDurationB = runsB.filter(r => r.duration_ms).length > 0
      ? Math.round(runsB.filter(r => r.duration_ms).reduce((a, r) => a + (r.duration_ms || 0), 0) / runsB.filter(r => r.duration_ms).length)
      : 0;

    // Test diff
    let testDiff: {
      new_failures: Array<{ test_id?: string; test_name?: string }>;
      fixed_tests: Array<{ test_id?: string; test_name?: string }>;
      consistent_failures: Array<{ test_id?: string; test_name?: string }>;
    } | null = null;

    if (includeTestDiff) {
      const testsA = new Map<string, { status: string; name?: string }>();
      const testsB = new Map<string, { status: string; name?: string }>();

      for (const run of runsA) {
        if (run.test_id) testsA.set(run.test_id, { status: run.status, name: run.test_name });
      }
      for (const run of runsB) {
        if (run.test_id) testsB.set(run.test_id, { status: run.status, name: run.test_name });
      }

      const newFailures: Array<{ test_id: string; test_name?: string }> = [];
      const fixedTests: Array<{ test_id: string; test_name?: string }> = [];
      const consistentFailures: Array<{ test_id: string; test_name?: string }> = [];

      for (const [testId, dataB] of testsB.entries()) {
        const dataA = testsA.get(testId);
        if (dataB.status === 'failed') {
          if (!dataA || dataA.status === 'completed') {
            newFailures.push({ test_id: testId, test_name: dataB.name });
          } else if (dataA.status === 'failed') {
            consistentFailures.push({ test_id: testId, test_name: dataB.name });
          }
        } else if (dataB.status === 'completed' && dataA?.status === 'failed') {
          fixedTests.push({ test_id: testId, test_name: dataB.name });
        }
      }

      testDiff = {
        new_failures: newFailures,
        fixed_tests: fixedTests,
        consistent_failures: consistentFailures,
      };
    }

    return {
      success: true,
      project_id: projectId,
      comparison: {
        release_a: {
          tag: releaseA,
          total_tests: runsA.length,
          pass_rate: passRateA,
          avg_duration_ms: avgDurationA,
        },
        release_b: {
          tag: releaseB,
          total_tests: runsB.length,
          pass_rate: passRateB,
          avg_duration_ms: avgDurationB,
        },
        changes: {
          pass_rate_delta: Math.round((passRateB - passRateA) * 10) / 10,
          duration_delta_ms: avgDurationB - avgDurationA,
          test_count_delta: runsB.length - runsA.length,
        },
      },
      test_diff: testDiff,
      summary: passRateB > passRateA
        ? `${releaseB} shows improvement over ${releaseA}`
        : passRateB < passRateA
        ? `${releaseB} shows regression compared to ${releaseA}`
        : `${releaseB} and ${releaseA} have similar quality`,
      generated_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to compare releases: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

// Handler registry for extended analytics tools
export const handlers: Record<string, ToolHandler> = {
  get_project_analytics: getProjectAnalytics,
  get_browser_analytics: getBrowserAnalytics,
  get_execution_time_analytics: getExecutionTimeAnalytics,
  get_failure_categories: getFailureCategories,
  get_release_quality: getReleaseQuality,
  compare_releases: compareReleases,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const analyticsExtendedHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default analyticsExtendedHandlers;
