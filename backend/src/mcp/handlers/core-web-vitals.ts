/**
 * Core Web Vitals Tool Handlers
 *
 * Handlers for Core Web Vitals and performance scheduling MCP tools.
 * Extracted from server.ts to reduce file size (Feature #1356).
 */

import { ToolHandler, HandlerModule } from './types';

// CWV thresholds based on Google's recommendations
const CWV_THRESHOLDS = {
  lcp: { good: 2500, needsImprovement: 4000 }, // milliseconds
  fid: { good: 100, needsImprovement: 300 }, // milliseconds
  inp: { good: 200, needsImprovement: 500 }, // milliseconds
  cls: { good: 0.1, needsImprovement: 0.25 }, // score
  fcp: { good: 1800, needsImprovement: 3000 }, // milliseconds
  ttfb: { good: 800, needsImprovement: 1800 }, // milliseconds
  tbt: { good: 200, needsImprovement: 600 }, // milliseconds
};

type CWVRating = 'good' | 'needs-improvement' | 'poor';

// Helper to rate a metric
function rateMetric(value: number, thresholds: { good: number; needsImprovement: number }): CWVRating {
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.needsImprovement) return 'needs-improvement';
  return 'poor';
}

interface LighthouseResults {
  run_id: string;
  test_id?: string;
  test_name?: string;
  target_url?: string;
  device?: string;
  performance_score?: number;
  lcp?: number;
  fid?: number;
  inp?: number;
  cls?: number;
  fcp?: number;
  ttfb?: number;
  tbt?: number;
  si?: number;
}

/**
 * Get Core Web Vitals metrics (Feature #992)
 */
export const getCoreWebVitals: ToolHandler = async (args, context) => {
  const url = args.url as string | undefined;
  const testId = args.test_id as string | undefined;
  const runId = args.run_id as string | undefined;
  const device = (args.device as string) || 'mobile';
  const runNewAudit = args.run_new_audit === true;

  if (!url && !testId && !runId) {
    return { error: 'Either url, test_id, or run_id is required' };
  }

  try {
    let lighthouseResults: LighthouseResults | null = null;

    // If run_id provided, get results directly
    if (runId && !runNewAudit) {
      const runResult = await context.callApi(`/api/v1/runs/${runId}`) as {
        run?: {
          id: string;
          test_id?: string;
          test_name?: string;
          test_type?: string;
          status: string;
          results?: Array<{
            performance_score?: number;
            largest_contentful_paint?: number;
            first_input_delay?: number;
            interaction_to_next_paint?: number;
            cumulative_layout_shift?: number;
            first_contentful_paint?: number;
            time_to_first_byte?: number;
            total_blocking_time?: number;
            speed_index?: number;
            target_url?: string;
          }>;
          config?: {
            device_preset?: string;
          };
        };
        error?: string;
      };

      if (runResult.error || !runResult.run) {
        return {
          success: false,
          error: `Run not found: ${runResult.error || 'Run does not exist'}`,
        };
      }

      if (runResult.run.status !== 'completed') {
        return {
          success: false,
          error: `Run is not completed (status: ${runResult.run.status})`,
          run_id: runId,
        };
      }

      const result = runResult.run.results?.[0];
      if (!result) {
        return {
          success: false,
          error: 'No results found in this run',
          run_id: runId,
        };
      }

      lighthouseResults = {
        run_id: runId,
        test_id: runResult.run.test_id,
        test_name: runResult.run.test_name,
        target_url: result.target_url,
        device: runResult.run.config?.device_preset || 'desktop',
        performance_score: result.performance_score,
        lcp: result.largest_contentful_paint,
        fid: result.first_input_delay,
        inp: result.interaction_to_next_paint,
        cls: result.cumulative_layout_shift,
        fcp: result.first_contentful_paint,
        ttfb: result.time_to_first_byte,
        tbt: result.total_blocking_time,
        si: result.speed_index,
      };
    }
    // If test_id provided and not running new audit, get latest run
    else if (testId && !runNewAudit) {
      const testResult = await context.callApi(`/api/v1/tests/${testId}`) as {
        test?: {
          id: string;
          name: string;
          test_type: string;
          target_url?: string;
          device_preset?: string;
        };
        error?: string;
      };

      if (testResult.error || !testResult.test) {
        return {
          success: false,
          error: `Test not found: ${testResult.error || 'Test does not exist'}`,
        };
      }

      if (testResult.test.test_type !== 'lighthouse') {
        return {
          success: false,
          error: `Test ${testId} is not a Lighthouse test (type: ${testResult.test.test_type})`,
          hint: 'Core Web Vitals require a Lighthouse test.',
        };
      }

      const runsResult = await context.callApi(`/api/v1/tests/${testId}/runs`) as {
        runs?: Array<{
          id: string;
          status: string;
          results?: Array<{
            performance_score?: number;
            largest_contentful_paint?: number;
            first_input_delay?: number;
            interaction_to_next_paint?: number;
            cumulative_layout_shift?: number;
            first_contentful_paint?: number;
            time_to_first_byte?: number;
            total_blocking_time?: number;
            speed_index?: number;
          }>;
        }>;
        error?: string;
      };

      const completedRun = runsResult.runs?.find(r => r.status === 'completed');
      if (!completedRun) {
        return {
          success: false,
          error: 'No completed runs found for this test',
          test_id: testId,
          hint: runNewAudit ? 'Set run_new_audit=true to run a new audit.' : 'Run a Lighthouse audit first.',
        };
      }

      const result = completedRun.results?.[0];
      lighthouseResults = {
        run_id: completedRun.id,
        test_id: testId,
        test_name: testResult.test.name,
        target_url: testResult.test.target_url,
        device: testResult.test.device_preset || 'desktop',
        performance_score: result?.performance_score,
        lcp: result?.largest_contentful_paint,
        fid: result?.first_input_delay,
        inp: result?.interaction_to_next_paint,
        cls: result?.cumulative_layout_shift,
        fcp: result?.first_contentful_paint,
        ttfb: result?.time_to_first_byte,
        tbt: result?.total_blocking_time,
        si: result?.speed_index,
      };
    }

    // If URL provided or run_new_audit requested, run a new audit
    if (!lighthouseResults || runNewAudit) {
      const targetUrl = url || lighthouseResults?.target_url;
      if (!targetUrl) {
        return {
          success: false,
          error: 'URL is required to run a new audit',
        };
      }

      // Validate URL
      try {
        new URL(targetUrl);
      } catch {
        return { error: 'Invalid URL format' };
      }

      const projectsResult = await context.callApi('/api/v1/projects') as {
        projects?: Array<{ id: string }>;
      };

      if (!projectsResult.projects || projectsResult.projects.length === 0) {
        return {
          success: false,
          error: 'No projects available. Create a project first.',
        };
      }

      const defaultProjectId = projectsResult.projects[0]?.id;
      if (!defaultProjectId) {
        return { success: false, error: 'No valid project found' };
      }

      const suitesResult = await context.callApi(`/api/v1/projects/${defaultProjectId}/suites`) as {
        suites?: Array<{ id: string; name: string; type?: string }>;
      };

      let suiteId: string;
      const perfSuite = suitesResult.suites?.find(s =>
        s.name.toLowerCase().includes('performance') || s.type === 'lighthouse'
      );

      if (perfSuite) {
        suiteId = perfSuite.id;
      } else {
        const createSuiteResult = await context.callApi(`/api/v1/projects/${defaultProjectId}/suites`, {
          method: 'POST',
          body: {
            name: 'Performance Tests',
            description: 'Auto-created suite for Core Web Vitals measurements',
            type: 'lighthouse',
          },
        }) as { suite?: { id: string } };

        if (!createSuiteResult.suite) {
          return { success: false, error: 'Failed to create performance suite' };
        }
        suiteId = createSuiteResult.suite.id;
      }

      // Create Lighthouse test
      const hostname = new URL(targetUrl).hostname;
      const createTestResult = await context.callApi(`/api/v1/suites/${suiteId}/tests`, {
        method: 'POST',
        body: {
          name: `CWV: ${hostname}`,
          description: `Core Web Vitals measurement for ${targetUrl}`,
          test_type: 'lighthouse',
          target_url: targetUrl,
          device_preset: device,
          steps: [{ action: 'navigate', value: targetUrl }],
        },
      }) as { test?: { id: string; name: string } };

      if (!createTestResult.test) {
        return { success: false, error: 'Failed to create Lighthouse test' };
      }

      // Run the test
      const runResult = await context.callApi(`/api/v1/tests/${createTestResult.test.id}/runs`, {
        method: 'POST',
        body: { browser: 'chromium' },
      }) as { run?: { id: string } };

      if (!runResult.run) {
        return { success: false, error: 'Failed to start Lighthouse audit' };
      }

      // Poll for completion (max 90 seconds)
      const maxWaitMs = 90000;
      const pollIntervalMs = 3000;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitMs) {
        const statusResult = await context.callApi(`/api/v1/runs/${runResult.run.id}`) as {
          run?: {
            status: string;
            results?: Array<{
              performance_score?: number;
              largest_contentful_paint?: number;
              first_input_delay?: number;
              interaction_to_next_paint?: number;
              cumulative_layout_shift?: number;
              first_contentful_paint?: number;
              time_to_first_byte?: number;
              total_blocking_time?: number;
              speed_index?: number;
            }>;
          };
        };

        if (statusResult.run?.status === 'completed') {
          const result = statusResult.run.results?.[0];
          lighthouseResults = {
            run_id: runResult.run.id,
            test_id: createTestResult.test.id,
            test_name: createTestResult.test.name,
            target_url: targetUrl,
            device,
            performance_score: result?.performance_score,
            lcp: result?.largest_contentful_paint,
            fid: result?.first_input_delay,
            inp: result?.interaction_to_next_paint,
            cls: result?.cumulative_layout_shift,
            fcp: result?.first_contentful_paint,
            ttfb: result?.time_to_first_byte,
            tbt: result?.total_blocking_time,
            si: result?.speed_index,
          };
          break;
        }

        if (statusResult.run?.status === 'failed') {
          return {
            success: false,
            error: 'Lighthouse audit failed',
            run_id: runResult.run.id,
          };
        }

        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      }

      if (!lighthouseResults) {
        return {
          success: true,
          message: 'Lighthouse audit started but timed out',
          run_id: runResult.run.id,
          test_id: createTestResult.test.id,
          status: 'running',
          note: 'Check back later with get_core_web_vitals using the run_id.',
        };
      }
    }

    // Build CWV response
    const cwv = {
      lcp: {
        value: lighthouseResults.lcp || 0,
        unit: 'ms',
        rating: rateMetric(lighthouseResults.lcp || 0, CWV_THRESHOLDS.lcp),
        threshold_good: CWV_THRESHOLDS.lcp.good,
        threshold_poor: CWV_THRESHOLDS.lcp.needsImprovement,
        description: 'Largest Contentful Paint - measures loading performance',
      },
      fid: {
        value: lighthouseResults.fid || 0,
        unit: 'ms',
        rating: rateMetric(lighthouseResults.fid || 0, CWV_THRESHOLDS.fid),
        threshold_good: CWV_THRESHOLDS.fid.good,
        threshold_poor: CWV_THRESHOLDS.fid.needsImprovement,
        description: 'First Input Delay - measures interactivity (lab simulation)',
        note: 'FID is being replaced by INP. Lab tests use TBT as proxy.',
      },
      inp: {
        value: lighthouseResults.inp || lighthouseResults.tbt || 0,
        unit: 'ms',
        rating: rateMetric(lighthouseResults.inp || lighthouseResults.tbt || 0, CWV_THRESHOLDS.inp),
        threshold_good: CWV_THRESHOLDS.inp.good,
        threshold_poor: CWV_THRESHOLDS.inp.needsImprovement,
        description: 'Interaction to Next Paint - measures responsiveness',
        note: lighthouseResults.inp ? 'Real INP value' : 'Estimated from Total Blocking Time (lab data)',
      },
      cls: {
        value: lighthouseResults.cls || 0,
        unit: 'score',
        rating: rateMetric(lighthouseResults.cls || 0, CWV_THRESHOLDS.cls),
        threshold_good: CWV_THRESHOLDS.cls.good,
        threshold_poor: CWV_THRESHOLDS.cls.needsImprovement,
        description: 'Cumulative Layout Shift - measures visual stability',
      },
    };

    // Overall CWV pass/fail
    const cwvRatings = [cwv.lcp.rating, cwv.inp.rating, cwv.cls.rating];
    const poorCount = cwvRatings.filter(r => r === 'poor').length;
    const goodCount = cwvRatings.filter(r => r === 'good').length;
    const overallRating = poorCount > 0 ? 'poor' : goodCount === 3 ? 'good' : 'needs-improvement';

    // Build recommendations
    const recommendations: string[] = [];
    if (cwv.lcp.rating !== 'good') {
      recommendations.push(`LCP (${cwv.lcp.value}ms) needs improvement. Optimize server response time, render-blocking resources, and resource load times.`);
    }
    if (cwv.inp.rating !== 'good') {
      recommendations.push(`INP/TBT (${cwv.inp.value}ms) needs improvement. Break up long tasks, optimize JavaScript execution, and use web workers.`);
    }
    if (cwv.cls.rating !== 'good') {
      recommendations.push(`CLS (${cwv.cls.value}) needs improvement. Set explicit dimensions for images/videos, avoid inserting content above existing content.`);
    }
    if (overallRating === 'good') {
      recommendations.push('All Core Web Vitals are good! Continue monitoring to maintain performance.');
    }

    return {
      success: true,
      url: lighthouseResults.target_url,
      device: lighthouseResults.device,
      run_id: lighthouseResults.run_id,
      test_id: lighthouseResults.test_id,
      measured_at: new Date().toISOString(),
      performance_score: lighthouseResults.performance_score,
      core_web_vitals: cwv,
      overall_rating: overallRating,
      passes_cwv: overallRating === 'good',
      additional_metrics: {
        fcp: {
          value: lighthouseResults.fcp || 0,
          unit: 'ms',
          rating: rateMetric(lighthouseResults.fcp || 0, CWV_THRESHOLDS.fcp),
          description: 'First Contentful Paint',
        },
        ttfb: {
          value: lighthouseResults.ttfb || 0,
          unit: 'ms',
          rating: rateMetric(lighthouseResults.ttfb || 0, CWV_THRESHOLDS.ttfb),
          description: 'Time to First Byte',
        },
        tbt: {
          value: lighthouseResults.tbt || 0,
          unit: 'ms',
          rating: rateMetric(lighthouseResults.tbt || 0, CWV_THRESHOLDS.tbt),
          description: 'Total Blocking Time',
        },
        si: {
          value: lighthouseResults.si || 0,
          unit: 'ms',
          description: 'Speed Index',
        },
      },
      recommendations,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get Core Web Vitals',
    };
  }
};

/**
 * Schedule performance audit (Feature #993)
 */
export const schedulePerformanceAudit: ToolHandler = async (args, context) => {
  const url = args.url as string | undefined;
  const testId = args.test_id as string | undefined;
  const frequency = (args.frequency as string) || 'daily';
  const timeOfDay = (args.time_of_day as string) || '02:00';
  const dayOfWeek = (args.day_of_week as number) ?? 1; // Monday
  const device = (args.device as string) || 'both';
  const alertOnRegression = args.alert_on_regression !== false; // Default true
  const regressionThreshold = (args.regression_threshold as number) || 10;
  const projectId = args.project_id as string | undefined;
  const customName = args.name as string | undefined;

  if (!url && !testId) {
    return { error: 'Either url or test_id is required' };
  }

  try {
    let targetTestId = testId;
    let targetProjectId = projectId;
    let testName: string;
    let targetUrl: string | undefined;

    // If URL provided, create or find a Lighthouse test
    if (url && !testId) {
      // Validate URL
      try {
        new URL(url);
      } catch {
        return { error: 'Invalid URL format' };
      }

      targetUrl = url;

      // Get project
      if (!targetProjectId) {
        const projectsResult = await context.callApi('/api/v1/projects') as {
          projects?: Array<{ id: string; name: string }>;
        };
        if (!projectsResult.projects || projectsResult.projects.length === 0) {
          return {
            success: false,
            error: 'No projects available. Create a project first or specify project_id.',
          };
        }
        targetProjectId = projectsResult.projects[0]?.id;
      }

      if (!targetProjectId) {
        return { success: false, error: 'No valid project found' };
      }

      // Get or create performance suite
      const suitesResult = await context.callApi(`/api/v1/projects/${targetProjectId}/suites`) as {
        suites?: Array<{ id: string; name: string; type?: string }>;
      };

      let suiteId: string;
      const perfSuite = suitesResult.suites?.find(s =>
        s.name.toLowerCase().includes('performance') || s.type === 'lighthouse'
      );

      if (perfSuite) {
        suiteId = perfSuite.id;
      } else {
        const createSuiteResult = await context.callApi(`/api/v1/projects/${targetProjectId}/suites`, {
          method: 'POST',
          body: {
            name: 'Performance Monitoring',
            description: 'Scheduled performance audits',
            type: 'lighthouse',
          },
        }) as { suite?: { id: string } };

        if (!createSuiteResult.suite) {
          return { success: false, error: 'Failed to create performance suite' };
        }
        suiteId = createSuiteResult.suite.id;
      }

      // Create Lighthouse test(s) based on device setting
      const hostname = new URL(url).hostname;
      const testsToCreate: Array<{ device: string; testId?: string }> = [];

      if (device === 'both') {
        testsToCreate.push({ device: 'mobile' }, { device: 'desktop' });
      } else {
        testsToCreate.push({ device });
      }

      for (const testConfig of testsToCreate) {
        const createTestResult = await context.callApi(`/api/v1/suites/${suiteId}/tests`, {
          method: 'POST',
          body: {
            name: customName
              ? `${customName} (${testConfig.device})`
              : `Performance: ${hostname} (${testConfig.device})`,
            description: `Scheduled ${frequency} performance audit for ${url}`,
            test_type: 'lighthouse',
            target_url: url,
            device_preset: testConfig.device,
            steps: [{ action: 'navigate', value: url }],
          },
        }) as { test?: { id: string; name: string } };

        if (createTestResult.test) {
          testConfig.testId = createTestResult.test.id;
          if (!targetTestId) targetTestId = createTestResult.test.id;
        }
      }

      testName = customName || `Performance: ${hostname}`;
    } else if (testId) {
      // Get existing test info
      const testResult = await context.callApi(`/api/v1/tests/${testId}`) as {
        test?: { id: string; name: string; target_url?: string; project_id?: string };
        error?: string;
      };

      if (testResult.error || !testResult.test) {
        return { success: false, error: `Test not found: ${testResult.error || 'Unknown error'}` };
      }

      testName = testResult.test.name;
      targetUrl = testResult.test.target_url;
      targetProjectId = testResult.test.project_id;
    } else {
      return { error: 'Either url or test_id is required' };
    }

    // Calculate cron expression
    let cronExpression: string;
    let nextRunTime: Date;
    const now = new Date();
    const [hours, minutes] = timeOfDay.split(':').map(Number);

    switch (frequency) {
      case 'hourly':
        cronExpression = `${minutes || 0} * * * *`;
        nextRunTime = new Date(now);
        nextRunTime.setMinutes(minutes || 0, 0, 0);
        if (nextRunTime <= now) nextRunTime.setHours(nextRunTime.getHours() + 1);
        break;
      case 'daily':
        cronExpression = `${minutes || 0} ${hours || 2} * * *`;
        nextRunTime = new Date(now);
        nextRunTime.setHours(hours || 2, minutes || 0, 0, 0);
        if (nextRunTime <= now) nextRunTime.setDate(nextRunTime.getDate() + 1);
        break;
      case 'weekly':
        cronExpression = `${minutes || 0} ${hours || 2} * * ${dayOfWeek}`;
        nextRunTime = new Date(now);
        nextRunTime.setHours(hours || 2, minutes || 0, 0, 0);
        const daysUntilNext = (dayOfWeek - now.getDay() + 7) % 7 || 7;
        nextRunTime.setDate(nextRunTime.getDate() + daysUntilNext);
        break;
      case 'monthly':
        cronExpression = `${minutes || 0} ${hours || 2} 1 * *`;
        nextRunTime = new Date(now.getFullYear(), now.getMonth() + 1, 1, hours || 2, minutes || 0);
        break;
      default:
        cronExpression = `${minutes || 0} ${hours || 2} * * *`;
        nextRunTime = new Date(now);
        nextRunTime.setHours(hours || 2, minutes || 0, 0, 0);
        if (nextRunTime <= now) nextRunTime.setDate(nextRunTime.getDate() + 1);
    }

    // Create schedule
    const scheduleResult = await context.callApi('/api/v1/schedules', {
      method: 'POST',
      body: {
        name: `${testName} - ${frequency} audit`,
        description: `Automated ${frequency} performance audit${targetUrl ? ` for ${targetUrl}` : ''}`,
        test_id: targetTestId,
        cron_expression: cronExpression,
        enabled: true,
        type: 'performance',
        config: {
          alert_on_regression: alertOnRegression,
          regression_threshold: regressionThreshold,
          device,
          frequency,
          time_of_day: timeOfDay,
          day_of_week: dayOfWeek,
        },
      },
    }) as { schedule?: { id: string }; error?: string };

    if (scheduleResult.error || !scheduleResult.schedule) {
      return {
        success: false,
        error: `Failed to create schedule: ${scheduleResult.error || 'Unknown error'}`,
      };
    }

    return {
      success: true,
      schedule_id: scheduleResult.schedule.id,
      test_id: targetTestId,
      project_id: targetProjectId,
      name: `${testName} - ${frequency} audit`,
      frequency,
      cron_expression: cronExpression,
      next_run: nextRunTime.toISOString(),
      time_of_day: timeOfDay,
      day_of_week: frequency === 'weekly' ? dayOfWeek : undefined,
      url: targetUrl,
      device,
      alert_on_regression: alertOnRegression,
      regression_threshold: regressionThreshold,
      message: `Performance audit scheduled to run ${frequency}${
        frequency === 'daily' ? ` at ${timeOfDay}` :
        frequency === 'weekly' ? ` on ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek]} at ${timeOfDay}` :
        frequency === 'hourly' ? ` at :${(minutes || 0).toString().padStart(2, '0')} every hour` :
        ` on the 1st at ${timeOfDay}`
      }`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to schedule performance audit',
    };
  }
};

// Handler registry for core web vitals tools
export const handlers: Record<string, ToolHandler> = {
  get_core_web_vitals: getCoreWebVitals,
  schedule_performance_audit: schedulePerformanceAudit,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const coreWebVitalsHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default coreWebVitalsHandlers;
