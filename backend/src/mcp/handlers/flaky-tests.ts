/**
 * Flaky Tests Handler Module
 *
 * Handles MCP tools for flaky test detection, quarantine management,
 * and flakiness trend analysis.
 *
 * Feature #1356: Extracted from server.ts switch statement
 */

import { ToolHandler, HandlerModule, HandlerContext } from './types';

/**
 * Get flaky tests for a project
 * Feature #1108
 */
const getFlakyTests: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string;
  const minFlakinessScore = (args.min_flakiness_score as number) || 20;
  const period = (args.period as string) || '30d';
  const limit = (args.limit as number) || 20;
  const includePatterns = args.include_patterns !== false;
  const includeRecentRuns = args.include_recent_runs !== false;

  if (!projectId) {
    return { error: 'project_id is required' };
  }

  // Parse period
  const periodDays = parseInt(period.replace('d', ''), 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);

  try {
    // Fetch runs for the project
    const runsResult = await context.callApi(`/api/v1/projects/${projectId}/runs?limit=1000`) as {
      runs?: Array<{
        id: string;
        test_id?: string;
        test_name?: string;
        suite_id?: string;
        suite_name?: string;
        status: string;
        started_at: string;
        completed_at?: string;
        duration_ms?: number;
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
      new Date(r.started_at) >= cutoffDate
    );

    // Group runs by test
    const testRuns = new Map<string, Array<{
      run_id: string;
      status: 'passed' | 'failed';
      started_at: string;
      duration_ms?: number;
      error?: string;
      test_name?: string;
      suite_name?: string;
    }>>();

    for (const run of periodRuns) {
      if (!run.test_id) continue;

      const runs = testRuns.get(run.test_id) || [];
      const isPassed = run.status === 'completed' && !run.results?.some(r => r.status === 'failed');

      runs.push({
        run_id: run.id,
        status: isPassed ? 'passed' : 'failed',
        started_at: run.started_at,
        duration_ms: run.duration_ms,
        error: run.results?.[0]?.error,
        test_name: run.test_name,
        suite_name: run.suite_name,
      });
      testRuns.set(run.test_id, runs);
    }

    // Calculate flakiness for each test
    interface FlakyTest {
      test_id: string;
      test_name?: string;
      suite_name?: string;
      total_runs: number;
      passed_runs: number;
      failed_runs: number;
      flakiness_score: number;
      transitions: number;
      pass_rate: number;
      failure_rate: number;
      avg_duration_ms?: number;
      patterns?: {
        common_errors: Array<{ error: string; count: number }>;
        failure_times: Array<string>;
        streak_info: {
          longest_pass_streak: number;
          longest_fail_streak: number;
          current_streak: { type: 'pass' | 'fail'; length: number };
        };
      };
      recent_runs?: Array<{
        run_id: string;
        status: 'passed' | 'failed';
        started_at: string;
      }>;
    }

    const flakyTests: FlakyTest[] = [];

    for (const [testId, runs] of testRuns.entries()) {
      if (runs.length < 3) continue; // Need enough runs to detect flakiness

      // Sort by date
      runs.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());

      // Count stats
      const passedRuns = runs.filter(r => r.status === 'passed').length;
      const failedRuns = runs.filter(r => r.status === 'failed').length;

      // Count transitions (pass->fail or fail->pass)
      let transitions = 0;
      for (let i = 1; i < runs.length; i++) {
        const currentRun = runs[i];
        const previousRun = runs[i - 1];
        if (currentRun && previousRun && currentRun.status !== previousRun.status) {
          transitions++;
        }
      }

      // Calculate flakiness score (0-100)
      // Higher score = more flaky
      // Based on: transitions ratio + mixed pass/fail ratio
      const transitionRatio = transitions / (runs.length - 1);
      const mixedRatio = Math.min(passedRuns, failedRuns) / runs.length;
      const flakiness = Math.round((transitionRatio * 60 + mixedRatio * 40) * 100);

      if (flakiness < minFlakinessScore) continue;

      const firstRun = runs[0];
      const flakyTest: FlakyTest = {
        test_id: testId,
        test_name: firstRun?.test_name || 'Unknown',
        suite_name: firstRun?.suite_name || 'Unknown',
        total_runs: runs.length,
        passed_runs: passedRuns,
        failed_runs: failedRuns,
        flakiness_score: flakiness,
        transitions,
        pass_rate: Math.round((passedRuns / runs.length) * 100),
        failure_rate: Math.round((failedRuns / runs.length) * 100),
      };

      // Calculate average duration
      const durations = runs.filter(r => r.duration_ms).map(r => r.duration_ms!);
      if (durations.length > 0) {
        flakyTest.avg_duration_ms = Math.round(
          durations.reduce((a, b) => a + b, 0) / durations.length
        );
      }

      // Add pattern analysis
      if (includePatterns) {
        // Common errors
        const errorCounts = new Map<string, number>();
        for (const run of runs) {
          if (run.error) {
            const normalizedError = run.error.substring(0, 100);
            errorCounts.set(normalizedError, (errorCounts.get(normalizedError) || 0) + 1);
          }
        }

        // Failure times (hour of day)
        const failureTimes = runs
          .filter(r => r.status === 'failed')
          .map(r => new Date(r.started_at).getHours().toString().padStart(2, '0') + ':00');

        // Calculate streaks
        let longestPassStreak = 0;
        let longestFailStreak = 0;
        let currentStreakLength = 1;
        const firstRunForStreak = runs[0];
        let currentStreakType: 'pass' | 'fail' = firstRunForStreak?.status === 'passed' ? 'pass' : 'fail';

        for (let i = 1; i < runs.length; i++) {
          const prevRun = runs[i - 1];
          const currRun = runs[i];
          if (!prevRun || !currRun) continue;
          const prevType = prevRun.status === 'passed' ? 'pass' : 'fail';
          const currType = currRun.status === 'passed' ? 'pass' : 'fail';

          if (currType === prevType) {
            currentStreakLength++;
          } else {
            // Update longest streak
            if (prevType === 'pass' && currentStreakLength > longestPassStreak) {
              longestPassStreak = currentStreakLength;
            } else if (prevType === 'fail' && currentStreakLength > longestFailStreak) {
              longestFailStreak = currentStreakLength;
            }
            currentStreakLength = 1;
            currentStreakType = currType;
          }
        }

        // Final streak
        if (currentStreakType === 'pass' && currentStreakLength > longestPassStreak) {
          longestPassStreak = currentStreakLength;
        } else if (currentStreakType === 'fail' && currentStreakLength > longestFailStreak) {
          longestFailStreak = currentStreakLength;
        }

        flakyTest.patterns = {
          common_errors: Array.from(errorCounts.entries())
            .map(([error, count]) => ({ error, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3),
          failure_times: [...new Set(failureTimes)].slice(0, 5),
          streak_info: {
            longest_pass_streak: longestPassStreak,
            longest_fail_streak: longestFailStreak,
            current_streak: {
              type: runs[runs.length - 1].status === 'passed' ? 'pass' : 'fail',
              length: currentStreakLength,
            },
          },
        };
      }

      // Add recent runs
      if (includeRecentRuns) {
        flakyTest.recent_runs = runs
          .slice(-10)
          .reverse()
          .map(r => ({
            run_id: r.run_id,
            status: r.status,
            started_at: r.started_at,
          }));
      }

      flakyTests.push(flakyTest);
    }

    // Sort by flakiness score and limit
    flakyTests.sort((a, b) => b.flakiness_score - a.flakiness_score);
    const limitedTests = flakyTests.slice(0, limit);

    // Calculate summary stats
    const totalFlakyTests = flakyTests.length;
    const avgFlakinessScore = flakyTests.length > 0
      ? Math.round(flakyTests.reduce((sum, t) => sum + t.flakiness_score, 0) / flakyTests.length)
      : 0;
    const criticalFlakyTests = flakyTests.filter(t => t.flakiness_score >= 70).length;
    const highFlakyTests = flakyTests.filter(t => t.flakiness_score >= 50 && t.flakiness_score < 70).length;

    // Generate recommendations
    const recommendations: string[] = [];
    if (criticalFlakyTests > 0) {
      recommendations.push(`${criticalFlakyTests} test(s) have critical flakiness (>70%) - prioritize stabilizing these`);
    }
    if (highFlakyTests > 0) {
      recommendations.push(`${highFlakyTests} test(s) have high flakiness (50-70%) - review for race conditions`);
    }
    if (limitedTests.some(t => t.patterns?.failure_times?.length === 1)) {
      recommendations.push('Some tests fail at specific times - check for time-dependent issues');
    }
    if (limitedTests.some(t => (t.patterns?.streak_info?.longest_fail_streak || 0) >= 3)) {
      recommendations.push('Some tests have long failure streaks - may indicate environmental issues');
    }
    if (totalFlakyTests === 0) {
      recommendations.push('No flaky tests detected! Great test stability.');
    }

    return {
      success: true,
      project_id: projectId,
      period,
      min_flakiness_score: minFlakinessScore,
      summary: {
        total_flaky_tests: totalFlakyTests,
        tests_returned: limitedTests.length,
        avg_flakiness_score: avgFlakinessScore,
        critical_count: criticalFlakyTests,
        high_count: highFlakyTests,
        moderate_count: flakyTests.filter(t => t.flakiness_score >= 20 && t.flakiness_score < 50).length,
      },
      flaky_tests: limitedTests,
      recommendations,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get flaky tests',
    };
  }
};

/**
 * Quarantine a flaky test
 * Feature #1109
 */
const quarantineTest: ToolHandler = async (args, context) => {
  const testId = args.test_id as string;
  const reason = (args.reason as string) || 'Flaky test - investigating';

  if (!testId) {
    return { error: 'test_id is required' };
  }

  try {
    const result = await context.callApi(`/api/v1/tests/${testId}/quarantine`, {}, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }) as {
      test_id?: string;
      test_name?: string;
      quarantined?: boolean;
      quarantine_reason?: string;
      quarantined_at?: string;
      quarantined_by?: string;
      error?: string;
    };

    if (result.error) {
      return {
        success: false,
        test_id: testId,
        error: result.error,
      };
    }

    return {
      success: true,
      message: `Test "${result.test_name || testId}" has been quarantined`,
      test_id: result.test_id || testId,
      test_name: result.test_name,
      quarantined: true,
      quarantine_reason: result.quarantine_reason || reason,
      quarantined_at: result.quarantined_at,
      quarantined_by: result.quarantined_by,
      note: 'Test will continue to run but failures will not block CI builds',
    };
  } catch (error) {
    return {
      success: false,
      test_id: testId,
      error: error instanceof Error ? error.message : 'Failed to quarantine test',
    };
  }
};

/**
 * Unquarantine a test
 * Feature #1110
 */
const unquarantineTest: ToolHandler = async (args, context) => {
  const testId = args.test_id as string;

  if (!testId) {
    return { error: 'test_id is required' };
  }

  try {
    const result = await context.callApi(`/api/v1/tests/${testId}/unquarantine`, {}, {
      method: 'POST',
    }) as {
      test_id?: string;
      test_name?: string;
      quarantined?: boolean;
      error?: string;
    };

    if (result.error) {
      return {
        success: false,
        test_id: testId,
        error: result.error,
      };
    }

    return {
      success: true,
      message: `Test "${result.test_name || testId}" has been released from quarantine`,
      test_id: result.test_id || testId,
      test_name: result.test_name,
      quarantined: false,
      note: 'Test failures will now block CI builds again. Monitoring will continue for potential re-quarantine.',
    };
  } catch (error) {
    return {
      success: false,
      test_id: testId,
      error: error instanceof Error ? error.message : 'Failed to unquarantine test',
    };
  }
};

/**
 * Get flakiness trends for a test
 * Feature #1110
 */
const getFlakyTrends: ToolHandler = async (args, context) => {
  const testId = args.test_id as string;
  const period = (args.period as string) || '30d';
  const includeCommits = args.include_commits !== false;

  if (!testId) {
    return { error: 'test_id is required' };
  }

  // Parse period
  const periodDays = parseInt(period.replace('d', ''), 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);

  try {
    // Fetch test details
    const testResult = await context.callApi(`/api/v1/tests/${testId}`) as {
      id?: string;
      name?: string;
      suite_id?: string;
      project_id?: string;
      error?: string;
    };

    if (testResult.error) {
      return { success: false, error: testResult.error };
    }

    // Fetch historical runs for this test
    const runsResult = await context.callApi(`/api/v1/tests/${testId}/runs?limit=500`) as {
      runs?: Array<{
        id: string;
        status: string;
        started_at: string;
        completed_at?: string;
        browser?: string;
        commit_sha?: string;
        commit_message?: string;
        commit_author?: string;
        duration_ms?: number;
      }>;
      error?: string;
    };

    if (runsResult.error) {
      return { success: false, error: runsResult.error };
    }

    const runs = (runsResult.runs || [])
      .filter(r => new Date(r.started_at) >= cutoffDate)
      .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());

    // Group runs by day and calculate daily flakiness scores
    const dailyData = new Map<string, { total: number; passed: number; failed: number; transitions: number; lastStatus?: string }>();

    for (const run of runs) {
      const dayKey = new Date(run.started_at).toISOString().split('T')[0];
      const data = dailyData.get(dayKey) || { total: 0, passed: 0, failed: 0, transitions: 0, lastStatus: undefined };

      data.total++;
      if (run.status === 'completed' || run.status === 'passed') {
        data.passed++;
        if (data.lastStatus === 'failed') data.transitions++;
        data.lastStatus = 'passed';
      } else {
        data.failed++;
        if (data.lastStatus === 'passed') data.transitions++;
        data.lastStatus = 'failed';
      }

      dailyData.set(dayKey, data);
    }

    // Build daily scores array
    interface DailyScore {
      date: string;
      flakiness_score: number;
      total_runs: number;
      passed: number;
      failed: number;
      pass_rate: number;
    }

    const dailyScores: DailyScore[] = [];

    for (const [date, data] of dailyData.entries()) {
      if (data.total < 2) continue; // Need at least 2 runs to calculate flakiness

      const transitionRatio = data.total > 1 ? data.transitions / (data.total - 1) : 0;
      const mixedRatio = Math.min(data.passed, data.failed) / data.total;
      const flakinessScore = Math.round((transitionRatio * 60 + mixedRatio * 40) * 100);

      dailyScores.push({
        date,
        flakiness_score: flakinessScore,
        total_runs: data.total,
        passed: data.passed,
        failed: data.failed,
        pass_rate: Math.round((data.passed / data.total) * 100),
      });
    }

    dailyScores.sort((a, b) => a.date.localeCompare(b.date));

    // Extract related commits
    interface RelatedCommit {
      sha: string;
      message?: string;
      author?: string;
      date: string;
      status_after: 'passed' | 'failed';
      flakiness_change?: 'increased' | 'decreased' | 'stable';
    }

    const relatedCommits: RelatedCommit[] = [];

    if (includeCommits) {
      const commitMap = new Map<string, { date: string; message?: string; author?: string; status: string }>();

      for (const run of runs) {
        if (run.commit_sha && !commitMap.has(run.commit_sha)) {
          commitMap.set(run.commit_sha, {
            date: run.started_at,
            message: run.commit_message,
            author: run.commit_author,
            status: run.status,
          });
        }
      }

      for (const [sha, data] of commitMap.entries()) {
        relatedCommits.push({
          sha,
          message: data.message,
          author: data.author,
          date: data.date,
          status_after: data.status === 'completed' || data.status === 'passed' ? 'passed' : 'failed',
        });
      }

      relatedCommits.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    // Calculate overall stats
    const totalPassed = runs.filter(r => r.status === 'completed' || r.status === 'passed').length;
    const totalFailed = runs.length - totalPassed;
    let totalTransitions = 0;
    for (let i = 1; i < runs.length; i++) {
      const prev = runs[i - 1].status === 'completed' || runs[i - 1].status === 'passed' ? 'passed' : 'failed';
      const curr = runs[i].status === 'completed' || runs[i].status === 'passed' ? 'passed' : 'failed';
      if (prev !== curr) totalTransitions++;
    }

    const overallFlakiness = runs.length > 1
      ? Math.round(((totalTransitions / (runs.length - 1)) * 60 + (Math.min(totalPassed, totalFailed) / runs.length) * 40) * 100)
      : 0;

    // Trend analysis
    const trend = dailyScores.length >= 2
      ? dailyScores[dailyScores.length - 1].flakiness_score > dailyScores[0].flakiness_score
        ? 'increasing'
        : dailyScores[dailyScores.length - 1].flakiness_score < dailyScores[0].flakiness_score
          ? 'decreasing'
          : 'stable'
      : 'insufficient_data';

    return {
      success: true,
      test_id: testId,
      test_name: testResult.name,
      period,
      summary: {
        total_runs: runs.length,
        overall_flakiness_score: overallFlakiness,
        overall_pass_rate: runs.length > 0 ? Math.round((totalPassed / runs.length) * 100) : 0,
        total_transitions: totalTransitions,
        trend,
        days_analyzed: dailyScores.length,
      },
      daily_scores: dailyScores,
      related_commits: includeCommits ? relatedCommits.slice(-20) : undefined,
      recommendations: overallFlakiness > 70
        ? ['Test has high flakiness - consider quarantining and investigating', 'Check for race conditions or timing issues']
        : overallFlakiness > 40
          ? ['Test shows moderate flakiness - review recent changes', 'Consider adding retry logic or explicit waits']
          : ['Test stability is acceptable'],
    };
  } catch (error) {
    return {
      success: false,
      test_id: testId,
      error: error instanceof Error ? error.message : 'Failed to get flakiness trends',
    };
  }
};

/**
 * Get AI-powered suggestions for fixing flaky tests
 * Feature #1111
 */
const suggestFlakyFixes: ToolHandler = async (args, context) => {
  const testId = args.test_id as string;
  const includeCodeExamples = args.include_code_examples !== false;
  const maxSuggestions = (args.max_suggestions as number) || 5;

  if (!testId) {
    return { error: 'test_id is required' };
  }

  try {
    // Call the AI suggestions endpoint
    const result = await context.callApi(`/api/v1/ai-insights/flaky-tests/${testId}/suggestions?include_code_examples=${includeCodeExamples}`) as {
      test_id?: string;
      test_name?: string;
      analysis?: {
        total_runs: number;
        pass_count: number;
        fail_count: number;
        flakiness_percentage: number;
        patterns_detected: string[];
      };
      suggestions?: Array<{
        id: string;
        priority: 'high' | 'medium' | 'low';
        category: string;
        title: string;
        description: string;
        confidence: number;
        pattern_matched?: string;
        code_example?: {
          before: string;
          after: string;
          explanation: string;
        };
        impact?: string;
        implementation_steps?: string[];
      }>;
      suggestions_count?: number;
      high_priority_count?: number;
      error?: string;
    };

    if (result.error) {
      return { success: false, test_id: testId, error: result.error };
    }

    // Limit suggestions
    const suggestions = (result.suggestions || []).slice(0, maxSuggestions);

    return {
      success: true,
      test_id: testId,
      test_name: result.test_name,
      analysis: result.analysis,
      suggestions: suggestions.map(s => ({
        id: s.id,
        type: s.category,
        priority: s.priority,
        title: s.title,
        description: s.description,
        confidence: s.confidence,
        confidence_percentage: Math.round(s.confidence * 100),
        pattern_matched: s.pattern_matched,
        code_example: includeCodeExamples ? s.code_example : undefined,
        impact: s.impact,
        implementation_steps: s.implementation_steps,
      })),
      suggestions_count: suggestions.length,
      high_priority_count: suggestions.filter(s => s.priority === 'high').length,
      recommendations: [
        suggestions.some(s => s.priority === 'high')
          ? 'Address high-priority suggestions first for maximum impact'
          : 'All suggestions are moderate priority - address as time permits',
        result.analysis && result.analysis.flakiness_percentage > 70
          ? 'Consider quarantining this test while implementing fixes'
          : 'Test is moderately flaky - fixes should improve stability',
      ],
    };
  } catch (error) {
    return {
      success: false,
      test_id: testId,
      error: error instanceof Error ? error.message : 'Failed to get flaky fix suggestions',
    };
  }
};

// Export handlers
export const handlers: Record<string, ToolHandler> = {
  get_flaky_tests: getFlakyTests,
  quarantine_test: quarantineTest,
  unquarantine_test: unquarantineTest,
  get_flakiness_trends: getFlakyTrends,
  suggest_flaky_fixes: suggestFlakyFixes,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const flakyTestsHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default flakyTestsHandlers;
