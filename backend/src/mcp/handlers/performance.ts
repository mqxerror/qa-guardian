/**
 * Performance Testing Tool Handlers
 *
 * Handlers for Lighthouse and performance testing MCP tools.
 * Extracted from server.ts to reduce file size (Feature #1356).
 */

import { ToolHandler, HandlerModule } from './types';

/**
 * Run Lighthouse audit (Feature #974)
 */
export const runLighthouseAudit: ToolHandler = async (args, context) => {
  const testId = args.test_id as string;
  if (!testId) {
    return { error: 'test_id is required' };
  }

  const device = (args.device as string) || 'desktop';
  const waitForCompletion = args.wait_for_completion !== false;

  try {
    // First verify the test exists and is a Lighthouse test
    const testResult = await context.callApi(`/api/v1/tests/${testId}`) as {
      test: {
        id: string;
        name: string;
        test_type: string;
        suite_id: string;
        target_url: string;
        device_preset?: string;
      };
      error?: string;
    };

    if (testResult.error) {
      return {
        success: false,
        error: testResult.error,
        test_id: testId,
      };
    }

    if (testResult.test.test_type !== 'lighthouse') {
      return {
        success: false,
        error: `Test ${testId} is not a Lighthouse test (type: ${testResult.test.test_type})`,
        test_id: testId,
        hint: 'This tool only works with lighthouse tests. Create a Lighthouse test first.',
      };
    }

    // Trigger the test run
    const runResult = await context.callApi(`/api/v1/tests/${testId}/runs`, {
      method: 'POST',
      body: {
        browser: 'chromium',
      },
    }) as {
      run: {
        id: string;
        status: string;
      };
      error?: string;
    };

    if (runResult.error) {
      return {
        success: false,
        error: runResult.error,
        test_id: testId,
      };
    }

    const runId = runResult.run.id;

    // If not waiting, return immediately
    if (!waitForCompletion) {
      return {
        success: true,
        message: 'Lighthouse audit started',
        test_id: testId,
        test_name: testResult.test.name,
        target_url: testResult.test.target_url,
        run_id: runId,
        device,
        status: 'running',
        note: 'Audit is running in background. Use get_test_run_status to check progress.',
      };
    }

    // Poll for completion (max 90 seconds for Lighthouse)
    const maxWaitMs = 90000;
    const pollIntervalMs = 3000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const statusResult = await context.callApi(`/api/v1/runs/${runId}`) as {
        run: {
          id: string;
          status: string;
          results?: Array<{
            test_id: string;
            status: string;
            performance_score?: number;
            accessibility_score?: number;
            best_practices_score?: number;
            seo_score?: number;
            pwa_score?: number;
            first_contentful_paint?: number;
            largest_contentful_paint?: number;
            cumulative_layout_shift?: number;
            total_blocking_time?: number;
            speed_index?: number;
            time_to_interactive?: number;
          }>;
          started_at?: string;
          completed_at?: string;
        };
      };

      if (statusResult.run.status === 'completed' || statusResult.run.status === 'failed') {
        const result = statusResult.run.results?.[0];

        return {
          success: statusResult.run.status === 'completed',
          message: statusResult.run.status === 'completed' ? 'Lighthouse audit completed' : 'Lighthouse audit failed',
          test_id: testId,
          test_name: testResult.test.name,
          target_url: testResult.test.target_url,
          run_id: runId,
          device,
          status: statusResult.run.status,
          scores: result ? {
            performance: result.performance_score,
            accessibility: result.accessibility_score,
            best_practices: result.best_practices_score,
            seo: result.seo_score,
            pwa: result.pwa_score,
          } : null,
          metrics: result ? {
            first_contentful_paint_ms: result.first_contentful_paint,
            largest_contentful_paint_ms: result.largest_contentful_paint,
            cumulative_layout_shift: result.cumulative_layout_shift,
            total_blocking_time_ms: result.total_blocking_time,
            speed_index_ms: result.speed_index,
            time_to_interactive_ms: result.time_to_interactive,
          } : null,
          started_at: statusResult.run.started_at,
          completed_at: statusResult.run.completed_at,
        };
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    // Timeout
    return {
      success: true,
      message: 'Lighthouse audit still running after timeout',
      test_id: testId,
      test_name: testResult.test.name,
      run_id: runId,
      device,
      status: 'running',
      note: 'Audit did not complete within 90 seconds. Use get_test_run_status to check later.',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run Lighthouse audit',
      test_id: testId,
    };
  }
};

/**
 * Get visual trends (Feature #970)
 */
export const getVisualTrends: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string;
  if (!projectId) {
    return { error: 'project_id is required' };
  }

  const days = (args.days as number) || 30;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  try {
    // Get test runs for the project
    const runsResult = await context.callApi(`/api/v1/projects/${projectId}/runs?limit=100`) as {
      runs: Array<{
        id: string;
        test_suite_id: string;
        status: string;
        started_at: string;
        completed_at: string;
        results?: Array<{
          test_id: string;
          test_name: string;
          status: string;
          diff_percentage?: number;
          visual_regression_detected?: boolean;
        }>;
      }>;
      error?: string;
    };

    if (runsResult.error) {
      return {
        success: false,
        error: runsResult.error,
        project_id: projectId,
      };
    }

    // Filter runs within the time range
    const runs = (runsResult.runs || []).filter(run => {
      const runDate = new Date(run.started_at);
      return runDate >= cutoffDate;
    });

    // Calculate visual regression statistics
    let totalVisualTests = 0;
    let visualTestsPassed = 0;
    let visualTestsFailed = 0;
    let testsWithDiffs = 0;
    const testDiffCounts: Record<string, { name: string; diffs: number; total: number }> = {};
    const diffPercentages: number[] = [];

    for (const run of runs) {
      if (!run.results) continue;

      for (const result of run.results) {
        // Check if this was a visual test
        if (result.diff_percentage !== undefined || result.visual_regression_detected !== undefined) {
          totalVisualTests++;

          // Track by test ID
          if (!testDiffCounts[result.test_id]) {
            testDiffCounts[result.test_id] = { name: result.test_name, diffs: 0, total: 0 };
          }
          testDiffCounts[result.test_id]!.total++;

          if (result.status === 'passed') {
            visualTestsPassed++;
          } else if (result.status === 'failed') {
            visualTestsFailed++;
          }

          if (result.diff_percentage && result.diff_percentage > 0) {
            testsWithDiffs++;
            testDiffCounts[result.test_id]!.diffs++;
            diffPercentages.push(result.diff_percentage);
          }
        }
      }
    }

    // Calculate average diff percentage
    const avgDiffPercentage = diffPercentages.length > 0
      ? diffPercentages.reduce((a, b) => a + b, 0) / diffPercentages.length
      : 0;

    // Find tests with most frequent diffs
    const frequentDiffTests = Object.entries(testDiffCounts)
      .filter(([, data]) => data.diffs > 0)
      .map(([testId, data]) => ({
        test_id: testId,
        test_name: data.name,
        diff_count: data.diffs,
        total_runs: data.total,
        diff_rate: Math.round((data.diffs / data.total) * 100),
      }))
      .sort((a, b) => b.diff_rate - a.diff_rate)
      .slice(0, 5);

    // Get pending visual diffs count
    let pendingDiffsCount = 0;
    try {
      const pendingResult = await context.callApi(`/api/v1/visual/pending/count?project_id=${projectId}`) as {
        count: number;
      };
      pendingDiffsCount = pendingResult.count || 0;
    } catch {
      // Ignore if endpoint fails
    }

    // Generate insights
    const insights: string[] = [];
    if (totalVisualTests === 0) {
      insights.push('No visual regression tests found in the selected period.');
    } else {
      const passRate = Math.round((visualTestsPassed / totalVisualTests) * 100);
      if (passRate >= 95) {
        insights.push(`Excellent visual consistency with ${passRate}% pass rate.`);
      } else if (passRate >= 80) {
        insights.push(`Good visual consistency with ${passRate}% pass rate.`);
      } else {
        insights.push(`Visual tests need attention with ${passRate}% pass rate.`);
      }

      if (frequentDiffTests.length > 0) {
        insights.push(`Test "${frequentDiffTests[0]?.test_name}" has the highest diff rate at ${frequentDiffTests[0]?.diff_rate}%.`);
      }

      if (pendingDiffsCount > 0) {
        insights.push(`${pendingDiffsCount} visual diff(s) pending review.`);
      }
    }

    return {
      success: true,
      project_id: projectId,
      period_days: days,
      summary: {
        total_visual_tests: totalVisualTests,
        passed: visualTestsPassed,
        failed: visualTestsFailed,
        pass_rate: totalVisualTests > 0 ? Math.round((visualTestsPassed / totalVisualTests) * 100) : 0,
        tests_with_diffs: testsWithDiffs,
        diff_frequency: totalVisualTests > 0 ? Math.round((testsWithDiffs / totalVisualTests) * 100) : 0,
        average_diff_percentage: Math.round(avgDiffPercentage * 100) / 100,
        pending_approvals: pendingDiffsCount,
      },
      frequent_diff_tests: frequentDiffTests,
      insights,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get visual trends',
      project_id: projectId,
    };
  }
};

/**
 * Run visual comparison (Feature #971)
 */
export const runVisualComparison: ToolHandler = async (args, context) => {
  const testId = args.test_id as string;
  if (!testId) {
    return { error: 'test_id is required' };
  }

  const browser = (args.browser as string) || 'chromium';
  const branch = (args.branch as string) || 'main';
  const waitForCompletion = args.wait_for_completion !== false;

  try {
    // First verify the test exists and is a visual regression test
    const testResult = await context.callApi(`/api/v1/tests/${testId}`) as {
      test: {
        id: string;
        name: string;
        test_type: string;
        suite_id: string;
        target_url: string;
      };
      error?: string;
    };

    if (testResult.error) {
      return {
        success: false,
        error: testResult.error,
        test_id: testId,
      };
    }

    if (testResult.test.test_type !== 'visual_regression') {
      return {
        success: false,
        error: `Test ${testId} is not a visual regression test (type: ${testResult.test.test_type})`,
        test_id: testId,
        hint: 'This tool only works with visual_regression tests. Use run_test for other test types.',
      };
    }

    // Trigger the test run
    const runResult = await context.callApi(`/api/v1/tests/${testId}/runs`, {
      method: 'POST',
      body: {
        browser,
        branch,
      },
    }) as {
      run: {
        id: string;
        suite_id: string;
        test_id: string;
        browser: string;
        branch: string;
        status: string;
      };
      error?: string;
    };

    if (runResult.error) {
      return {
        success: false,
        error: runResult.error,
        test_id: testId,
      };
    }

    const runId = runResult.run.id;

    // If not waiting, return immediately
    if (!waitForCompletion) {
      return {
        success: true,
        message: 'Visual comparison test started',
        test_id: testId,
        test_name: testResult.test.name,
        run_id: runId,
        browser,
        branch,
        status: 'running',
        note: 'Test is running in background. Use get_test_run_status to check progress.',
      };
    }

    // Poll for completion (max 60 seconds)
    const maxWaitMs = 60000;
    const pollIntervalMs = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const statusResult = await context.callApi(`/api/v1/runs/${runId}`) as {
        run: {
          id: string;
          status: string;
          results?: Array<{
            test_id: string;
            status: string;
            diff_percentage?: number;
            visual_regression_detected?: boolean;
            screenshot_base64?: string;
            diff_image_base64?: string;
          }>;
          started_at?: string;
          completed_at?: string;
        };
      };

      if (statusResult.run.status === 'completed' || statusResult.run.status === 'failed') {
        const result = statusResult.run.results?.[0];

        return {
          success: true,
          message: statusResult.run.status === 'completed' ? 'Visual comparison completed' : 'Visual comparison failed',
          test_id: testId,
          test_name: testResult.test.name,
          run_id: runId,
          browser,
          branch,
          status: statusResult.run.status,
          result: result ? {
            test_status: result.status,
            diff_percentage: result.diff_percentage,
            visual_regression_detected: result.visual_regression_detected,
            has_diff_image: !!result.diff_image_base64,
          } : null,
          started_at: statusResult.run.started_at,
          completed_at: statusResult.run.completed_at,
          note: result?.visual_regression_detected
            ? 'Visual differences detected. Review and approve or reject the changes.'
            : 'No visual differences detected.',
        };
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    // Timeout
    return {
      success: true,
      message: 'Visual comparison still running after timeout',
      test_id: testId,
      test_name: testResult.test.name,
      run_id: runId,
      browser,
      branch,
      status: 'running',
      note: 'Test did not complete within 60 seconds. Use get_test_run_status to check later.',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run visual comparison',
      test_id: testId,
    };
  }
};

// Handler registry for performance tools
export const handlers: Record<string, ToolHandler> = {
  run_lighthouse_audit: runLighthouseAudit,
  get_visual_trends: getVisualTrends,
  run_visual_comparison: runVisualComparison,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const performanceHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default performanceHandlers;
