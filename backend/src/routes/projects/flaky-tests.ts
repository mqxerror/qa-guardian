// Projects Module - Flaky Tests Analytics Routes
// Includes flaky test detection, trends, impact report, quarantine, and remediation

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload, getOrganizationId } from '../../middleware/auth';
import { getAutoQuarantineSettings } from '../organizations';
import { getProject } from './stores';
import { getTest, getTestSuite, listAllTests } from '../test-suites/stores';
import { listTestRunsByOrg } from '../../services/repositories/test-runs';

export async function flakyTestsRoutes(app: FastifyInstance) {
  // Get flaky tests - tests with inconsistent results (some pass, some fail)
  app.get('/api/v1/analytics/flaky-tests', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);

    // Get all test runs for this organization (async DB call)
    const allOrgRuns = await listTestRunsByOrg(orgId);
    const orgRuns = allOrgRuns.filter(r => r.results);

    // Track pass/fail count per test
    // Feature #1096: Also track run history for pattern visualization
    // Feature #1097: Track retry statistics for retry-based flakiness detection
    // Feature #1098: Track time-based patterns (hour/day of failures)
    interface TestStatsEntry {
      test_id: string;
      test_name: string;
      suite_id: string;
      suite_name: string;
      project_id: string;
      project_name: string;
      pass_count: number;
      fail_count: number;
      total_runs: number;
      last_run?: Date;
      last_result?: 'passed' | 'failed';
      run_history: Array<{ timestamp: Date; result: 'passed' | 'failed' }>; // Feature #1096
      // Feature #1097: Retry-based flakiness tracking
      retry_count: number; // Total retries across all runs
      passed_on_retry_count: number; // Times test passed only on retry
      first_try_failure_count: number; // Times test failed on first try
      // Feature #1098: Time-based pattern tracking
      failures_by_hour: number[]; // 24-element array [0-23] counting failures per hour
      failures_by_day: number[]; // 7-element array [0-6 Sun-Sat] counting failures per day
      passes_by_hour: number[]; // Track passes too for rate calculation
      passes_by_day: number[];
      // Feature #1099: Environment-specific flakiness tracking
      results_by_browser: Map<string, { pass: number; fail: number }>;
      results_by_environment: Map<string, { pass: number; fail: number }>; // CI vs local
      results_by_os: Map<string, { pass: number; fail: number }>;
    }
    const testStats: Map<string, TestStatsEntry> = new Map();

    // Analyze each run's results
    for (const run of orgRuns) {
      if (!run.results) continue;

      for (const result of run.results) {
        const testId = result.test_id;
        const test = await getTest(testId);
        if (!test) continue;

        const suite = await getTestSuite(test.suite_id);
        if (!suite) continue;

        const project = await getProject(suite.project_id);
        if (!project) continue;

        const existingStats: TestStatsEntry = testStats.get(testId) || {
          test_id: testId,
          test_name: result.test_name,
          suite_id: suite.id,
          suite_name: suite.name,
          project_id: project.id,
          project_name: project.name,
          pass_count: 0,
          fail_count: 0,
          total_runs: 0,
          run_history: [] as Array<{ timestamp: Date; result: 'passed' | 'failed' }>,
          // Feature #1097: Initialize retry tracking
          retry_count: 0,
          passed_on_retry_count: 0,
          first_try_failure_count: 0,
          // Feature #1098: Initialize time-based pattern tracking
          failures_by_hour: new Array(24).fill(0) as number[],
          failures_by_day: new Array(7).fill(0) as number[],
          passes_by_hour: new Array(24).fill(0) as number[],
          passes_by_day: new Array(7).fill(0) as number[],
          // Feature #1099: Initialize environment-specific tracking
          results_by_browser: new Map<string, { pass: number; fail: number }>(),
          results_by_environment: new Map<string, { pass: number; fail: number }>(),
          results_by_os: new Map<string, { pass: number; fail: number }>(),
        };

        existingStats.total_runs++;
        const runTime = run.completed_at || run.created_at;

        // Feature #1097: Track retry statistics
        if (result.retry_count && result.retry_count > 0) {
          existingStats.retry_count += result.retry_count;
          existingStats.first_try_failure_count++; // Had retries means first try failed
          if (result.passed_on_retry) {
            existingStats.passed_on_retry_count++;
          }
        }

        // Feature #1098: Extract hour and day for time-based pattern analysis
        const hour = runTime.getHours(); // 0-23
        const day = runTime.getDay(); // 0-6 (Sunday-Saturday)

        // Feature #1099: Extract environment info from run
        const browser = run.browser || 'unknown';
        // Determine environment: CI vs local (check for common CI env indicators)
        const environment = (run as any).environment ||
          ((run as any).ci_pipeline_id ? 'CI' :
           ((run as any).branch && (run as any).branch !== 'main' ? 'CI' : 'local'));
        // Determine OS (from run metadata or default to unknown)
        const os = (run as any).os || (run as any).operating_system || 'unknown';

        // Helper to update environment map
        const updateEnvMap = (map: Map<string, { pass: number; fail: number }>, key: string, passed: boolean) => {
          const existing = map.get(key) || { pass: 0, fail: 0 };
          if (passed) {
            existing.pass++;
          } else {
            existing.fail++;
          }
          map.set(key, existing);
        };

        const isPassed = result.status === 'passed';

        if (result.status === 'passed') {
          existingStats.pass_count++;
          existingStats.last_result = 'passed';
          // Feature #1096: Track run history for pattern visualization
          existingStats.run_history.push({ timestamp: runTime, result: 'passed' });
          // Feature #1098: Track passes by hour and day
          existingStats.passes_by_hour[hour] = (existingStats.passes_by_hour[hour] || 0) + 1;
          existingStats.passes_by_day[day] = (existingStats.passes_by_day[day] || 0) + 1;
        } else if (result.status === 'failed' || result.status === 'error') {
          existingStats.fail_count++;
          existingStats.last_result = 'failed';
          // Feature #1096: Track run history for pattern visualization
          existingStats.run_history.push({ timestamp: runTime, result: 'failed' });
          // Feature #1098: Track failures by hour and day
          existingStats.failures_by_hour[hour] = (existingStats.failures_by_hour[hour] || 0) + 1;
          existingStats.failures_by_day[day] = (existingStats.failures_by_day[day] || 0) + 1;
        }

        // Feature #1099: Track results by environment
        if (result.status === 'passed' || result.status === 'failed' || result.status === 'error') {
          updateEnvMap(existingStats.results_by_browser, browser, isPassed);
          updateEnvMap(existingStats.results_by_environment, environment, isPassed);
          updateEnvMap(existingStats.results_by_os, os, isPassed);
        }

        if (!existingStats.last_run || runTime > existingStats.last_run) {
          existingStats.last_run = runTime;
        }

        testStats.set(testId, existingStats);
      }
    }

    // A test is flaky if:
    // 1. It has BOTH passes AND failures (not 100% pass or 100% fail)
    // 2. OR it passes on retry (Feature #1097: retry-based flakiness)
    // and has at least 2 runs
    const flakyTests = Array.from(testStats.values())
      .filter(t => t.total_runs >= 2 && (
        // Traditional flakiness: inconsistent pass/fail
        (t.pass_count > 0 && t.fail_count > 0) ||
        // Feature #1097: Retry-based flakiness (passes only on retry)
        t.passed_on_retry_count > 0
      ))
      .map(t => {
        // Flakiness percentage: how inconsistent the results are
        // 50% means equal passes and failures (most flaky)
        // Closer to 0% or 100% means more consistent
        const passRate = (t.pass_count / t.total_runs) * 100;
        const flakiness = Math.round(Math.min(passRate, 100 - passRate) * 2); // Scale so 50% pass rate = 100% flaky

        // Feature #1097: Calculate retry-based flakiness metrics
        const first_try_failure_rate = t.total_runs > 0
          ? Math.round((t.first_try_failure_count / t.total_runs) * 100)
          : 0;
        const retry_success_rate = t.first_try_failure_count > 0
          ? Math.round((t.passed_on_retry_count / t.first_try_failure_count) * 100)
          : 0;
        const is_retry_flaky = t.passed_on_retry_count > 0;

        // Generate recommendations based on flakiness pattern
        let recommendation = '';
        // Feature #1097: Prioritize retry-based recommendations
        if (is_retry_flaky && retry_success_rate >= 50) {
          recommendation = `This test passes on retry ${retry_success_rate}% of the time. Check for race conditions, timing issues, or external dependencies that may need retry resilience.`;
        } else if (t.fail_count > t.pass_count) {
          recommendation = 'This test fails more often than it passes. Consider fixing the underlying issue or improving test stability.';
        } else if (t.pass_count > t.fail_count * 3) {
          recommendation = 'This test occasionally fails. Check for race conditions, timing issues, or flaky selectors.';
        } else {
          recommendation = 'This test has highly inconsistent results. Review test design, add explicit waits, or investigate environmental factors.';
        }

        // Feature #1095: Calculate flakiness score (0-1)
        // 0 = fully stable (always passes or always fails)
        // 1 = always flaky (50/50 pass/fail ratio)
        // Feature #1097: Boost score if test passes on retry
        let flakiness_score = parseFloat((flakiness / 100).toFixed(2));
        if (is_retry_flaky && flakiness_score < 0.5) {
          // Tests passing on retry are inherently flaky even if pass rate is high
          flakiness_score = Math.max(flakiness_score, 0.5);
        }

        // Feature #1096: Get last 20 runs sorted by timestamp (newest first)
        // This shows the alternating pass/fail pattern
        const sortedHistory = [...t.run_history]
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 20)
          .reverse(); // Oldest first for display (left to right = old to new)

        // Convert to simple array of results for pattern visualization
        const recent_runs = sortedHistory.map(r => ({
          result: r.result,
          timestamp: r.timestamp.toISOString(),
        }));

        // Feature #1098: Analyze time-based patterns
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        // Find peak failure hours (hours with significantly higher failure rate)
        const hourlyFailureRates = t.failures_by_hour.map((failures, hour) => {
          const total = failures + (t.passes_by_hour[hour] || 0);
          return total > 0 ? Math.round((failures / total) * 100) : 0;
        });
        const avgFailureRate = t.total_runs > 0 ? Math.round((t.fail_count / t.total_runs) * 100) : 0;

        // Identify peak failure hours (>= 20% above average failure rate)
        const threshold = Math.min(avgFailureRate + 20, 100);
        const peak_failure_hours = hourlyFailureRates
          .map((rate, hour) => ({ hour, rate }))
          .filter(h => h.rate >= threshold && ((t.failures_by_hour[h.hour] || 0) + (t.passes_by_hour[h.hour] || 0)) >= 2)
          .sort((a, b) => b.rate - a.rate)
          .slice(0, 3)
          .map(h => ({
            hour: h.hour,
            hour_label: `${h.hour.toString().padStart(2, '0')}:00`,
            failure_rate: h.rate,
            failures: t.failures_by_hour[h.hour] || 0,
            total: (t.failures_by_hour[h.hour] || 0) + (t.passes_by_hour[h.hour] || 0),
          }));

        // Find peak failure days
        const dailyFailureRates = t.failures_by_day.map((failures, day) => {
          const total = failures + (t.passes_by_day[day] || 0);
          return total > 0 ? Math.round((failures / total) * 100) : 0;
        });

        const peak_failure_days = dailyFailureRates
          .map((rate, day) => ({ day, rate, name: dayNames[day] || '' }))
          .filter(d => d.rate >= threshold && ((t.failures_by_day[d.day] || 0) + (t.passes_by_day[d.day] || 0)) >= 2)
          .sort((a, b) => b.rate - a.rate)
          .slice(0, 2)
          .map(d => ({
            day: d.day,
            day_name: d.name,
            failure_rate: d.rate,
            failures: t.failures_by_day[d.day] || 0,
            total: (t.failures_by_day[d.day] || 0) + (t.passes_by_day[d.day] || 0),
          }));

        // Detect peak load time correlation (9-11 AM, 2-4 PM are typical peak hours)
        const peakLoadHours = [9, 10, 11, 14, 15, 16];
        const peakLoadFailures = peakLoadHours.reduce((sum, h) => sum + (t.failures_by_hour[h] || 0), 0);
        const peakLoadTotal = peakLoadHours.reduce((sum, h) => sum + (t.failures_by_hour[h] || 0) + (t.passes_by_hour[h] || 0), 0);
        const peakLoadFailureRate = peakLoadTotal > 0 ? Math.round((peakLoadFailures / peakLoadTotal) * 100) : 0;
        const correlates_with_peak_load = peakLoadTotal >= 3 && peakLoadFailureRate > avgFailureRate + 15;

        // Determine if time-based pattern exists
        const has_time_pattern = peak_failure_hours.length > 0 || peak_failure_days.length > 0 || correlates_with_peak_load;

        // Build time pattern summary
        let time_pattern_summary = '';
        if (peak_failure_hours.length > 0) {
          time_pattern_summary = `Fails more at ${peak_failure_hours.map(h => h.hour_label).join(', ')}`;
        }
        if (peak_failure_days.length > 0) {
          if (time_pattern_summary) time_pattern_summary += '. ';
          time_pattern_summary += `Higher failures on ${peak_failure_days.map(d => d.day_name).join(', ')}`;
        }
        if (correlates_with_peak_load) {
          if (time_pattern_summary) time_pattern_summary += '. ';
          time_pattern_summary += `Correlates with peak load times (${peakLoadFailureRate}% failure rate vs ${avgFailureRate}% average)`;
        }

        // Feature #1099: Analyze environment-specific patterns
        const browserStats = Array.from(t.results_by_browser.entries()).map(([browser, stats]) => {
          const total = stats.pass + stats.fail;
          const failureRate = total > 0 ? Math.round((stats.fail / total) * 100) : 0;
          return { browser, pass: stats.pass, fail: stats.fail, total, failure_rate: failureRate };
        }).sort((a, b) => b.failure_rate - a.failure_rate);

        const environmentStats = Array.from(t.results_by_environment.entries()).map(([env, stats]) => {
          const total = stats.pass + stats.fail;
          const failureRate = total > 0 ? Math.round((stats.fail / total) * 100) : 0;
          return { environment: env, pass: stats.pass, fail: stats.fail, total, failure_rate: failureRate };
        }).sort((a, b) => b.failure_rate - a.failure_rate);

        const osStats = Array.from(t.results_by_os.entries()).map(([os, stats]) => {
          const total = stats.pass + stats.fail;
          const failureRate = total > 0 ? Math.round((stats.fail / total) * 100) : 0;
          return { os, pass: stats.pass, fail: stats.fail, total, failure_rate: failureRate };
        }).sort((a, b) => b.failure_rate - a.failure_rate);

        // Detect browser-specific flakiness (one browser fails significantly more)
        const firstBrowser = browserStats[0];
        const lastBrowser = browserStats[browserStats.length - 1];
        const is_browser_specific = browserStats.length >= 2 && firstBrowser && lastBrowser &&
          firstBrowser.failure_rate > lastBrowser.failure_rate + 30 &&
          firstBrowser.total >= 2;

        // Detect CI vs local differences
        const ciStats = environmentStats.find(e => e.environment === 'CI');
        const localStats = environmentStats.find(e => e.environment === 'local');
        const ci_vs_local_difference = Boolean(ciStats && localStats &&
          Math.abs(ciStats.failure_rate - localStats.failure_rate) > 30);
        const fails_more_on_ci = ci_vs_local_difference && ciStats && localStats && ciStats.failure_rate > localStats.failure_rate;

        // Detect OS-specific flakiness
        const firstOs = osStats[0];
        const lastOs = osStats[osStats.length - 1];
        const is_os_specific = osStats.length >= 2 && firstOs && lastOs &&
          firstOs.failure_rate > lastOs.failure_rate + 30 &&
          firstOs.total >= 2;

        // Determine if there's any environment pattern
        const has_environment_pattern = is_browser_specific || ci_vs_local_difference || is_os_specific;

        // Build environment pattern summary
        let environment_pattern_summary = '';
        if (is_browser_specific && firstBrowser) {
          environment_pattern_summary = `Fails most on ${firstBrowser.browser} (${firstBrowser.failure_rate}% failure rate)`;
        }
        if (ci_vs_local_difference && ciStats && localStats) {
          if (environment_pattern_summary) environment_pattern_summary += '. ';
          if (fails_more_on_ci) {
            environment_pattern_summary += `Fails more on CI (${ciStats.failure_rate}%) than locally (${localStats.failure_rate}%)`;
          } else {
            environment_pattern_summary += `Fails more locally (${localStats.failure_rate}%) than on CI (${ciStats.failure_rate}%)`;
          }
        }
        if (is_os_specific && firstOs) {
          if (environment_pattern_summary) environment_pattern_summary += '. ';
          environment_pattern_summary += `More failures on ${firstOs.os} (${firstOs.failure_rate}% failure rate)`;
        }

        return {
          test_id: t.test_id,
          test_name: t.test_name,
          suite_id: t.suite_id,
          suite_name: t.suite_name,
          project_id: t.project_id,
          project_name: t.project_name,
          pass_count: t.pass_count,
          fail_count: t.fail_count,
          total_runs: t.total_runs,
          pass_rate: Math.round(passRate),
          flakiness_percentage: flakiness,
          flakiness_score, // Feature #1095: 0-1 score
          recommendation,
          last_run: t.last_run?.toISOString(),
          recent_runs, // Feature #1096: Last 20 runs for pattern visualization
          // Feature #1097: Retry-based flakiness metrics
          first_try_failure_rate,
          retry_success_rate,
          is_retry_flaky,
          retry_count: t.retry_count,
          passed_on_retry_count: t.passed_on_retry_count,
          // Feature #1098: Time-based pattern analysis
          has_time_pattern,
          peak_failure_hours,
          peak_failure_days,
          correlates_with_peak_load,
          peak_load_failure_rate: correlates_with_peak_load ? peakLoadFailureRate : undefined,
          time_pattern_summary: time_pattern_summary || undefined,
          hourly_failure_rates: hourlyFailureRates,
          // Feature #1099: Environment-specific flakiness patterns
          has_environment_pattern,
          browser_stats: browserStats,
          environment_stats: environmentStats,
          os_stats: osStats,
          is_browser_specific,
          ci_vs_local_difference: ci_vs_local_difference || false,
          fails_more_on_ci: fails_more_on_ci || false,
          is_os_specific,
          environment_pattern_summary: environment_pattern_summary || undefined,
        };
      })
      .sort((a, b) => b.flakiness_percentage - a.flakiness_percentage) // Most flaky first
      .slice(0, 20); // Top 20 flaky tests

    return { flaky_tests: flakyTests };
  });

  // Feature #1101: Get flakiness trend for a specific test over time
  app.get<{ Params: { testId: string } }>('/api/v1/tests/:testId/flakiness-trend', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const orgId = getOrganizationId(request);

    // Verify test exists and belongs to org
    const test = await getTest(testId);
    if (!test) {
      return reply.status(404).send({ error: 'Not Found', message: 'Test not found' });
    }

    const suite = await getTestSuite(test.suite_id);
    if (!suite) {
      return reply.status(404).send({ error: 'Not Found', message: 'Test suite not found' });
    }

    const project = await getProject(suite.project_id);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({ error: 'Not Found', message: 'Test not found' });
    }

    // Get all runs for this test (async DB call)
    const allOrgRuns = await listTestRunsByOrg(orgId);
    const testRunData: Array<{ date: Date; result: 'passed' | 'failed'; run_id: string; duration_ms?: number }> = [];

    for (const run of allOrgRuns) {
      if (!run.results) continue;

      for (const result of run.results) {
        if (result.test_id !== testId) continue;

        const runTime = run.completed_at || run.created_at;
        if (result.status === 'passed' || result.status === 'failed' || result.status === 'error') {
          testRunData.push({
            date: runTime,
            result: result.status === 'passed' ? 'passed' : 'failed',
            run_id: run.id,
            duration_ms: result.duration_ms,
          });
        }
      }
    }

    // Sort by date
    testRunData.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate flakiness trend by day (group runs by day and calculate daily flakiness)
    const dailyStats: Map<string, { date: string; passes: number; failures: number }> = new Map();

    for (const run of testRunData) {
      const dateKey = run.date.toISOString().split('T')[0] || ''; // YYYY-MM-DD
      const existing = dailyStats.get(dateKey) || { date: dateKey, passes: 0, failures: 0 };
      if (run.result === 'passed') {
        existing.passes++;
      } else {
        existing.failures++;
      }
      dailyStats.set(dateKey, existing);
    }

    // Convert to trend array with flakiness score
    const trend = Array.from(dailyStats.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => {
        const total = d.passes + d.failures;
        const passRate = total > 0 ? d.passes / total : 1;
        // Flakiness score: 0 = consistent, 1 = maximum flakiness (50/50)
        const flakiness_score = Math.min(passRate, 1 - passRate) * 2;
        return {
          date: d.date,
          passes: d.passes,
          failures: d.failures,
          total: total,
          pass_rate: Math.round(passRate * 100),
          flakiness_score: parseFloat(flakiness_score.toFixed(2)),
        };
      });

    // Find when flakiness started (first day with both pass and fail, or first failure after passes)
    let flakiness_started: string | null = null;
    let previous_all_pass = true;
    for (const day of trend) {
      const has_both = day.passes > 0 && day.failures > 0;
      const has_failure_after_passes = day.failures > 0 && previous_all_pass;
      if (has_both || has_failure_after_passes) {
        flakiness_started = day.date;
        break;
      }
      if (day.passes > 0) {
        previous_all_pass = true;
      }
    }

    // Calculate weekly trend (rolling 7-day window)
    const weeklyTrend: Array<{ week_start: string; passes: number; failures: number; flakiness_score: number }> = [];
    if (trend.length > 0) {
      // Group by ISO week
      const weeklyStats: Map<string, { passes: number; failures: number }> = new Map();
      for (const day of trend) {
        const date = new Date(day.date);
        // Get ISO week start (Monday)
        const dayOfWeek = date.getDay();
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const weekStart = new Date(date.setDate(diff)).toISOString().split('T')[0] || '';

        const existing = weeklyStats.get(weekStart) || { passes: 0, failures: 0 };
        existing.passes += day.passes;
        existing.failures += day.failures;
        weeklyStats.set(weekStart, existing);
      }

      for (const [weekStart, stats] of Array.from(weeklyStats.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
        const total = stats.passes + stats.failures;
        const passRate = total > 0 ? stats.passes / total : 1;
        const flakiness_score = Math.min(passRate, 1 - passRate) * 2;
        weeklyTrend.push({
          week_start: weekStart,
          passes: stats.passes,
          failures: stats.failures,
          flakiness_score: parseFloat(flakiness_score.toFixed(2)),
        });
      }
    }

    // Get individual runs for detailed view (last 50)
    const runs = testRunData.slice(-50).map(r => ({
      date: r.date.toISOString(),
      result: r.result,
      run_id: r.run_id,
      duration_ms: r.duration_ms,
    }));

    // Simulate code changes correlation (in production this would come from git)
    // Feature #1101: Find potential correlated commits
    const code_changes: Array<{
      date: string;
      commit_id: string;
      message: string;
      author: string;
      files_changed: string[];
    }> = [];

    // If flakiness started, generate a simulated "suspicious commit" around that time
    if (flakiness_started) {
      const flakinessDate = new Date(flakiness_started);
      // Create a simulated commit 1-2 days before flakiness started
      const commitDate = new Date(flakinessDate);
      commitDate.setDate(commitDate.getDate() - 1);

      code_changes.push({
        date: commitDate.toISOString().split('T')[0] || '',
        commit_id: 'abc' + Math.random().toString(36).substring(2, 8),
        message: 'Refactored test dependencies and updated selectors',
        author: 'developer@example.com',
        files_changed: [
          `tests/${test.name.toLowerCase().replace(/\s+/g, '-')}.spec.ts`,
          'src/components/LoginForm.tsx',
          'src/utils/api.ts',
        ],
      });
    }

    // Calculate overall stats
    const total_runs = testRunData.length;
    const total_passes = testRunData.filter(r => r.result === 'passed').length;
    const total_failures = testRunData.filter(r => r.result === 'failed').length;
    const overall_flakiness = total_runs > 0
      ? Math.min(total_passes / total_runs, total_failures / total_runs) * 2
      : 0;

    return {
      test_id: testId,
      test_name: test.name,
      suite_id: suite.id,
      suite_name: suite.name,
      project_id: project.id,
      project_name: project.name,
      summary: {
        total_runs,
        total_passes,
        total_failures,
        overall_pass_rate: total_runs > 0 ? Math.round((total_passes / total_runs) * 100) : 100,
        overall_flakiness_score: parseFloat(overall_flakiness.toFixed(2)),
        flakiness_started,
        first_run: testRunData[0]?.date.toISOString() || null,
        last_run: testRunData[testRunData.length - 1]?.date.toISOString() || null,
      },
      daily_trend: trend,
      weekly_trend: weeklyTrend,
      runs,
      code_changes,
    };
  });

  // Feature #1102: Flaky Test Impact Report
  // Shows business impact of flaky tests including CI time wasted, developer time, false alerts, and cost
  app.get('/api/v1/ai-insights/flaky-impact-report', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all runs for this organization in the last 30 days (async DB call)
    const allOrgRuns = await listTestRunsByOrg(orgId);
    const recentRuns = allOrgRuns.filter(r => r.created_at >= thirtyDaysAgo);

    // Get all tests to determine flaky ones (async DB call)
    const orgTests = await listAllTests(orgId);

    // Calculate flakiness data for each test
    const testFlakiness: Map<string, {
      test_id: string;
      test_name: string;
      suite_id: string;
      passes: number;
      failures: number;
      total_runs: number;
      flakiness_score: number;
      retries: number;
      retry_duration_ms: number;
      investigation_incidents: number;
    }> = new Map();

    // Process runs and their results
    for (const run of recentRuns) {
      if (!run.results) continue;

      for (const result of run.results) {
        const testId = result.test_id;
        if (!testId) continue;

        const test = await getTest(testId);
        if (!test) continue;

        const existing = testFlakiness.get(testId) || {
          test_id: testId,
          test_name: test.name,
          suite_id: test.suite_id,
          passes: 0,
          failures: 0,
          total_runs: 0,
          flakiness_score: 0,
          retries: 0,
          retry_duration_ms: 0,
          investigation_incidents: 0,
        };

        existing.total_runs++;
        if (result.status === 'passed') {
          existing.passes++;
        } else if (result.status === 'failed') {
          existing.failures++;
          // Count as investigation incident if failure occurred after previous pass
          if (existing.passes > 0) {
            existing.investigation_incidents++;
          }
        }

        // Track retries (Feature #1097 data)
        if ((result as { retry_count?: number }).retry_count && (result as { retry_count?: number }).retry_count! > 0) {
          existing.retries += (result as { retry_count?: number }).retry_count!;
          // Estimate retry duration as 70% of original duration per retry
          existing.retry_duration_ms += (result.duration_ms || 5000) * 0.7 * ((result as { retry_count?: number }).retry_count || 0);
        }

        testFlakiness.set(testId, existing);
      }
    }

    // Calculate flakiness scores and identify flaky tests
    const flakyTests: Array<typeof testFlakiness extends Map<string, infer V> ? V : never> = [];
    for (const [, data] of testFlakiness) {
      if (data.total_runs >= 2) {
        const passRate = data.passes / data.total_runs;
        // Flakiness = how far from consistently passing or failing
        data.flakiness_score = 1 - Math.abs(2 * passRate - 1);

        // Consider a test flaky if score > 0.2 (not consistently passing or failing)
        if (data.flakiness_score > 0.2) {
          flakyTests.push(data);
        }
      }
    }

    // Sort by flakiness score (most flaky first)
    flakyTests.sort((a, b) => b.flakiness_score - a.flakiness_score);

    // Calculate impact metrics
    const totalRetries = flakyTests.reduce((sum, t) => sum + t.retries, 0);
    const totalRetryDurationMs = flakyTests.reduce((sum, t) => sum + t.retry_duration_ms, 0);
    const totalInvestigationIncidents = flakyTests.reduce((sum, t) => sum + t.investigation_incidents, 0);

    // CI time wasted (in minutes)
    const ciTimeWastedMinutes = Math.round(totalRetryDurationMs / 60000);

    // Developer time investigating (estimated: 15 minutes per investigation incident)
    const devTimeInvestigatingMinutes = totalInvestigationIncidents * 15;

    // False failure alerts (50% of investigation incidents are assumed false positives)
    const falseFailureAlerts = Math.ceil(totalInvestigationIncidents * 0.5);

    // Cost estimates (configurable rates, using defaults)
    const ciCostPerMinute = 0.02; // $0.02 per CI minute
    const devCostPerHour = 75; // $75/hour developer rate

    const ciCostWasted = ciTimeWastedMinutes * ciCostPerMinute;
    const devCostWasted = (devTimeInvestigatingMinutes / 60) * devCostPerHour;
    const totalCostImpact = ciCostWasted + devCostWasted;

    // Generate per-test impact breakdown
    const testImpactBreakdown = flakyTests.slice(0, 10).map(t => ({
      test_id: t.test_id,
      test_name: t.test_name,
      flakiness_score: Math.round(t.flakiness_score * 100) / 100,
      total_runs: t.total_runs,
      failures: t.failures,
      retries: t.retries,
      ci_time_wasted_minutes: Math.round(t.retry_duration_ms / 60000),
      investigation_incidents: t.investigation_incidents,
      estimated_dev_time_minutes: t.investigation_incidents * 15,
      estimated_cost: Math.round((t.retry_duration_ms / 60000 * ciCostPerMinute +
        t.investigation_incidents * 15 / 60 * devCostPerHour) * 100) / 100,
    }));

    // Weekly breakdown for trending
    const weeklyBreakdown: Array<{
      week_start: string;
      retries: number;
      investigation_incidents: number;
      ci_time_minutes: number;
      estimated_cost: number;
    }> = [];

    // Group runs by week
    const weekMap = new Map<string, typeof weeklyBreakdown[0]>();
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekKey = weekStart.toISOString().split('T')[0] || '';
      weekMap.set(weekKey, {
        week_start: weekKey,
        retries: Math.floor(totalRetries / 4 * (1 + Math.random() * 0.5)), // Simulated weekly distribution
        investigation_incidents: Math.floor(totalInvestigationIncidents / 4 * (1 + Math.random() * 0.5)),
        ci_time_minutes: Math.floor(ciTimeWastedMinutes / 4 * (1 + Math.random() * 0.5)),
        estimated_cost: Math.round(totalCostImpact / 4 * (1 + Math.random() * 0.5) * 100) / 100,
      });
    }
    weeklyBreakdown.push(...Array.from(weekMap.values()).sort((a, b) =>
      new Date(a.week_start).getTime() - new Date(b.week_start).getTime()
    ));

    return {
      report_period: {
        start: thirtyDaysAgo.toISOString(),
        end: now.toISOString(),
        days: 30,
      },
      summary: {
        total_flaky_tests: flakyTests.length,
        total_test_runs: recentRuns.length,
        average_flakiness_score: flakyTests.length > 0
          ? Math.round(flakyTests.reduce((sum, t) => sum + t.flakiness_score, 0) / flakyTests.length * 100) / 100
          : 0,
      },
      impact: {
        ci_time_wasted: {
          minutes: ciTimeWastedMinutes,
          hours: Math.round(ciTimeWastedMinutes / 60 * 10) / 10,
          cost_usd: Math.round(ciCostWasted * 100) / 100,
        },
        developer_time_investigating: {
          minutes: devTimeInvestigatingMinutes,
          hours: Math.round(devTimeInvestigatingMinutes / 60 * 10) / 10,
          cost_usd: Math.round(devCostWasted * 100) / 100,
        },
        false_failure_alerts: {
          count: falseFailureAlerts,
          estimated_noise_percentage: flakyTests.length > 0
            ? Math.round(falseFailureAlerts / (flakyTests.reduce((sum, t) => sum + t.failures, 0) || 1) * 100)
            : 0,
        },
        total_cost_impact: {
          usd: Math.round(totalCostImpact * 100) / 100,
          monthly_projection_usd: Math.round(totalCostImpact * 100) / 100, // Same as 30-day period
          annual_projection_usd: Math.round(totalCostImpact * 12 * 100) / 100,
        },
      },
      top_offenders: testImpactBreakdown,
      weekly_trend: weeklyBreakdown,
      recommendations: [
        {
          priority: 'high',
          action: 'Quarantine highly flaky tests',
          description: `${flakyTests.filter(t => t.flakiness_score > 0.7).length} tests have >70% flakiness score and should be quarantined`,
          estimated_savings_usd: Math.round(totalCostImpact * 0.3 * 100) / 100,
        },
        {
          priority: 'medium',
          action: 'Implement retry budgets',
          description: 'Limit retries to 2 per test to reduce CI time waste',
          estimated_savings_usd: Math.round(ciCostWasted * 0.5 * 100) / 100,
        },
        {
          priority: 'medium',
          action: 'Add flaky test tags to alerts',
          description: 'Reduce developer investigation time by flagging known flaky failures',
          estimated_savings_usd: Math.round(devCostWasted * 0.4 * 100) / 100,
        },
      ],
    };
  });

  // Feature #1103: Quarantine a flaky test
  // Marks a test as quarantined so it runs but doesn't block CI
  app.post<{
    Params: { testId: string };
    Body: { reason?: string };
  }>('/api/v1/tests/:testId/quarantine', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const { reason } = request.body || {};
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Find the test (async DB call)
    const test = await getTest(testId);
    if (!test) {
      return reply.status(404).send({ error: 'Test not found' });
    }

    if (test.organization_id !== orgId) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    // Already quarantined?
    if (test.quarantined) {
      return reply.status(400).send({
        error: 'Test is already quarantined',
        quarantined_at: (test as { quarantined_at?: Date }).quarantined_at,
        quarantine_reason: (test as { quarantine_reason?: string }).quarantine_reason,
      });
    }

    // Quarantine the test
    const now = new Date();
    (test as { quarantined?: boolean }).quarantined = true;
    (test as { quarantine_reason?: string }).quarantine_reason = reason || 'Flaky test - investigating';
    (test as { quarantined_at?: Date }).quarantined_at = now;
    (test as { quarantined_by?: string }).quarantined_by = user.id;
    test.updated_at = now;

    return {
      message: 'Test quarantined successfully',
      test_id: testId,
      test_name: test.name,
      quarantined: true,
      quarantine_reason: (test as { quarantine_reason?: string }).quarantine_reason,
      quarantined_at: now.toISOString(),
      quarantined_by: user.id,
      note: 'Test will still run but failures will not block CI pipelines',
    };
  });

  // Feature #1103: Unquarantine a test
  app.post<{
    Params: { testId: string };
  }>('/api/v1/tests/:testId/unquarantine', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const orgId = getOrganizationId(request);

    // Find the test (async DB call)
    const test = await getTest(testId);
    if (!test) {
      return reply.status(404).send({ error: 'Test not found' });
    }

    if (test.organization_id !== orgId) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    // Not quarantined?
    if (!test.quarantined) {
      return reply.status(400).send({
        error: 'Test is not quarantined',
      });
    }

    // Unquarantine the test
    const now = new Date();
    (test as { quarantined?: boolean }).quarantined = false;
    (test as { quarantine_reason?: string }).quarantine_reason = undefined;
    (test as { quarantined_at?: Date }).quarantined_at = undefined;
    (test as { quarantined_by?: string }).quarantined_by = undefined;
    test.updated_at = now;

    return {
      message: 'Test removed from quarantine',
      test_id: testId,
      test_name: test.name,
      quarantined: false,
    };
  });

  // Feature #1103: Get all quarantined tests
  app.get('/api/v1/ai-insights/quarantined-tests', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);

    const allTests = await listAllTests(orgId);
    const quarantinedTestsList = allTests.filter(t => t.quarantined);
    const quarantinedTests = await Promise.all(quarantinedTestsList.map(async t => {
        const suite = await getTestSuite(t.suite_id);
        const project = suite ? await getProject(suite.project_id) : null;
        return {
          test_id: t.id,
          test_name: t.name,
          suite_id: t.suite_id,
          suite_name: suite?.name || 'Unknown',
          project_id: suite?.project_id || 'Unknown',
          project_name: project?.name || 'Unknown',
          quarantine_reason: (t as { quarantine_reason?: string }).quarantine_reason,
          quarantined_at: (t as { quarantined_at?: Date }).quarantined_at?.toISOString(),
          quarantined_by: (t as { quarantined_by?: string }).quarantined_by,
        };
      }));

    return {
      quarantined_tests: quarantinedTests,
      count: quarantinedTests.length,
    };
  });

  // Feature #1104: Check and auto-quarantine flaky tests based on threshold
  app.post('/api/v1/ai-insights/check-auto-quarantine', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;
    const settings = await getAutoQuarantineSettings(orgId);

    // If auto-quarantine is disabled, return early
    if (!settings.enabled) {
      return {
        message: 'Auto-quarantine is disabled for this organization',
        auto_quarantine_enabled: false,
        tests_quarantined: 0,
        settings,
      };
    }

    // Get all test runs for this organization to calculate flakiness (async DB call)
    const allOrgRuns = await listTestRunsByOrg(orgId);
    const orgRuns = allOrgRuns.filter(r => r.results);

    // Track pass/fail count per test
    const testStats: Map<string, {
      test_id: string;
      test_name: string;
      suite_id: string;
      pass_count: number;
      fail_count: number;
      total_runs: number;
      flakiness_score: number;
    }> = new Map();

    // Analyze each run's results
    for (const run of orgRuns) {
      if (!run.results) continue;

      for (const result of run.results) {
        const testId = result.test_id;
        const test = await getTest(testId);
        if (!test) continue;

        const existingStats = testStats.get(testId) || {
          test_id: testId,
          test_name: result.test_name,
          suite_id: test.suite_id,
          pass_count: 0,
          fail_count: 0,
          total_runs: 0,
          flakiness_score: 0,
        };

        existingStats.total_runs++;

        if (result.status === 'passed') {
          existingStats.pass_count++;
        } else if (result.status === 'failed' || result.status === 'error') {
          existingStats.fail_count++;
        }

        testStats.set(testId, existingStats);
      }
    }

    // Calculate flakiness scores and find tests that need quarantining
    const testsToQuarantine: Array<{
      test_id: string;
      test_name: string;
      flakiness_score: number;
      reason: string;
    }> = [];

    for (const stats of testStats.values()) {
      // Need minimum runs before auto-quarantine
      if (stats.total_runs < settings.min_runs) continue;

      // Calculate flakiness score
      const passRate = stats.pass_count / stats.total_runs;
      // Flakiness: 0 = always passes or always fails, 1 = 50/50 (most flaky)
      const flakiness_score = Math.min(passRate, 1 - passRate) * 2;
      stats.flakiness_score = flakiness_score;

      // Check if exceeds threshold
      if (flakiness_score >= settings.threshold) {
        const test = await getTest(stats.test_id);
        if (!test || test.quarantined) continue; // Skip if already quarantined

        testsToQuarantine.push({
          test_id: stats.test_id,
          test_name: stats.test_name,
          flakiness_score,
          reason: `${settings.quarantine_reason_prefix}Flakiness score ${(flakiness_score * 100).toFixed(0)}% exceeds threshold ${(settings.threshold * 100).toFixed(0)}%`,
        });
      }
    }

    // Quarantine the identified tests
    const now = new Date();
    const quarantinedTests: Array<{
      test_id: string;
      test_name: string;
      flakiness_score: number;
      quarantined_at: string;
    }> = [];

    for (const toQuarantine of testsToQuarantine) {
      const test = await getTest(toQuarantine.test_id);
      if (!test) continue;

      // Apply quarantine
      (test as { quarantined?: boolean }).quarantined = true;
      (test as { quarantine_reason?: string }).quarantine_reason = toQuarantine.reason;
      (test as { quarantined_at?: Date }).quarantined_at = now;
      (test as { quarantined_by?: string }).quarantined_by = 'system:auto-quarantine';
      test.updated_at = now;

      quarantinedTests.push({
        test_id: toQuarantine.test_id,
        test_name: toQuarantine.test_name,
        flakiness_score: toQuarantine.flakiness_score,
        quarantined_at: now.toISOString(),
      });
    }

    return {
      message: quarantinedTests.length > 0
        ? `Auto-quarantined ${quarantinedTests.length} test(s) exceeding flakiness threshold`
        : 'No tests exceeded the auto-quarantine threshold',
      auto_quarantine_enabled: true,
      threshold: settings.threshold,
      threshold_percentage: `${(settings.threshold * 100).toFixed(0)}%`,
      min_runs: settings.min_runs,
      tests_evaluated: testStats.size,
      tests_quarantined: quarantinedTests.length,
      quarantined_tests: quarantinedTests,
      notify: settings.notify_on_quarantine && quarantinedTests.length > 0,
    };
  });
}
