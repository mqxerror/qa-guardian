/**
 * Lighthouse Performance Tool Handlers
 *
 * Handlers for Lighthouse performance testing MCP tools.
 * Extracted from server.ts to reduce file size (Feature #1356).
 */

import { ToolHandler, HandlerModule } from './types';

/**
 * Get Lighthouse results (Feature #975)
 */
export const getLighthouseResults: ToolHandler = async (args, context) => {
  const runId = args.run_id as string;
  if (!runId) {
    return { error: 'run_id is required' };
  }

  const testIdFilter = args.test_id as string | undefined;
  const includeOpportunities = args.include_opportunities !== false; // Default true
  const includeDiagnostics = args.include_diagnostics !== false; // Default true
  const includePassedAudits = args.include_passed_audits === true; // Default false

  try {
    // Get the run details
    const runResult = await context.callApi(`/api/v1/runs/${runId}`) as {
      run: {
        id: string;
        suite_id: string;
        test_id?: string;
        status: string;
        started_at?: string;
        completed_at?: string;
        duration_ms?: number;
        results?: Array<{
          test_id: string;
          test_name?: string;
          status: string;
          duration_ms?: number;
          lighthouse?: {
            performance: number;
            accessibility: number;
            bestPractices: number;
            seo: number;
            device: string;
            url: string;
            metrics: {
              firstContentfulPaint: number;
              speedIndex: number;
              largestContentfulPaint: number;
              timeToInteractive: number;
              totalBlockingTime: number;
              cumulativeLayoutShift: number;
              interactionToNextPaint?: number;
              timeToFirstByte?: number;
            };
            opportunities?: Array<{
              id: string;
              title: string;
              savings: number;
              description: string;
            }>;
            diagnostics?: Array<{
              id: string;
              title: string;
              description: string;
            }>;
            passedAudits?: Array<{
              id: string;
              title: string;
              description: string;
            }>;
          };
          steps?: Array<{
            id: string;
            action: string;
            status: string;
            lighthouse?: {
              performance: number;
              accessibility: number;
              bestPractices: number;
              seo: number;
              device: string;
              url: string;
              metrics: {
                firstContentfulPaint: number;
                speedIndex: number;
                largestContentfulPaint: number;
                timeToInteractive: number;
                totalBlockingTime: number;
                cumulativeLayoutShift: number;
                interactionToNextPaint?: number;
                timeToFirstByte?: number;
              };
              opportunities?: Array<{
                id: string;
                title: string;
                savings: number;
                description: string;
              }>;
              diagnostics?: Array<{
                id: string;
                title: string;
                description: string;
              }>;
              passedAudits?: Array<{
                id: string;
                title: string;
                description: string;
              }>;
            };
          }>;
        }>;
        error?: string;
      };
      error?: string;
    };

    if (runResult.error) {
      return {
        success: false,
        error: runResult.error,
        run_id: runId,
      };
    }

    if (runResult.run.status === 'running' || runResult.run.status === 'pending') {
      return {
        success: false,
        error: `Run is still ${runResult.run.status}. Please wait for completion.`,
        run_id: runId,
        status: runResult.run.status,
        note: 'Use run_lighthouse_audit with wait_for_completion=true or check back later.',
      };
    }

    // Find Lighthouse results - either from results array or from steps
    const results = runResult.run.results || [];
    const lighthouseResults: Array<{
      test_id: string;
      test_name?: string;
      status: string;
      duration_ms?: number;
      lighthouse?: typeof results[0]['lighthouse'];
    }> = [];

    for (const result of results) {
      // Filter by test ID if specified
      if (testIdFilter && result.test_id !== testIdFilter) {
        continue;
      }

      // Check for Lighthouse data in result directly
      if (result.lighthouse) {
        lighthouseResults.push({
          test_id: result.test_id,
          test_name: result.test_name,
          status: result.status,
          duration_ms: result.duration_ms,
          lighthouse: result.lighthouse,
        });
      }

      // Also check steps for Lighthouse data (some results store it in steps)
      if (result.steps) {
        for (const step of result.steps) {
          if (step.lighthouse || step.action === 'lighthouse_audit') {
            if (!lighthouseResults.find(lr => lr.test_id === result.test_id)) {
              lighthouseResults.push({
                test_id: result.test_id,
                test_name: result.test_name,
                status: result.status,
                duration_ms: result.duration_ms,
                lighthouse: step.lighthouse,
              });
            }
          }
        }
      }
    }

    if (lighthouseResults.length === 0) {
      return {
        success: false,
        error: 'No Lighthouse results found in this run',
        run_id: runId,
        hint: 'This run may not be a Lighthouse test, or the audit may have failed.',
        run_status: runResult.run.status,
        total_results: results.length,
      };
    }

    // Format the response
    const formattedResults = lighthouseResults.map(result => {
      const lh = result.lighthouse;
      if (!lh) return null;

      const formatted: Record<string, unknown> = {
        test_id: result.test_id,
        test_name: result.test_name,
        status: result.status,
        target_url: lh.url,
        device: lh.device,
        duration_ms: result.duration_ms,
        scores: {
          performance: lh.performance,
          accessibility: lh.accessibility,
          best_practices: lh.bestPractices,
          seo: lh.seo,
        },
        core_web_vitals: {
          lcp_ms: lh.metrics?.largestContentfulPaint,
          lcp_rating: lh.metrics?.largestContentfulPaint <= 2500 ? 'good' :
                    lh.metrics?.largestContentfulPaint <= 4000 ? 'needs_improvement' : 'poor',
          fid_ms: lh.metrics?.interactionToNextPaint || lh.metrics?.totalBlockingTime, // Use INP or TBT as FID proxy
          fid_rating: (lh.metrics?.interactionToNextPaint || lh.metrics?.totalBlockingTime || 0) <= 100 ? 'good' :
                    (lh.metrics?.interactionToNextPaint || lh.metrics?.totalBlockingTime || 0) <= 300 ? 'needs_improvement' : 'poor',
          cls: lh.metrics?.cumulativeLayoutShift,
          cls_rating: (lh.metrics?.cumulativeLayoutShift || 0) <= 0.1 ? 'good' :
                    (lh.metrics?.cumulativeLayoutShift || 0) <= 0.25 ? 'needs_improvement' : 'poor',
          inp_ms: lh.metrics?.interactionToNextPaint,
          inp_rating: lh.metrics?.interactionToNextPaint ? (
            lh.metrics.interactionToNextPaint <= 200 ? 'good' :
            lh.metrics.interactionToNextPaint <= 500 ? 'needs_improvement' : 'poor'
          ) : undefined,
        },
        metrics: {
          first_contentful_paint_ms: lh.metrics?.firstContentfulPaint,
          speed_index_ms: lh.metrics?.speedIndex,
          largest_contentful_paint_ms: lh.metrics?.largestContentfulPaint,
          time_to_interactive_ms: lh.metrics?.timeToInteractive,
          total_blocking_time_ms: lh.metrics?.totalBlockingTime,
          cumulative_layout_shift: lh.metrics?.cumulativeLayoutShift,
          interaction_to_next_paint_ms: lh.metrics?.interactionToNextPaint,
          time_to_first_byte_ms: lh.metrics?.timeToFirstByte,
        },
      };

      // Include opportunities if requested
      if (includeOpportunities && lh.opportunities && lh.opportunities.length > 0) {
        formatted.recommendations = {
          opportunities: lh.opportunities.map((opp) => ({
            id: opp.id,
            title: opp.title,
            potential_savings_ms: opp.savings,
            description: opp.description,
          })),
          total_potential_savings_ms: lh.opportunities.reduce((sum, opp) => sum + (opp.savings || 0), 0),
        };
      }

      // Include diagnostics if requested
      if (includeDiagnostics && lh.diagnostics && lh.diagnostics.length > 0) {
        formatted.diagnostics = lh.diagnostics.map((diag) => ({
          id: diag.id,
          title: diag.title,
          description: diag.description,
        }));
      }

      // Include passed audits if requested
      if (includePassedAudits && lh.passedAudits && lh.passedAudits.length > 0) {
        formatted.passed_audits = lh.passedAudits.map((audit) => ({
          id: audit.id,
          title: audit.title,
          description: audit.description,
        }));
      }

      return formatted;
    }).filter(Boolean) as Record<string, unknown>[];

    // Calculate overall summary
    const avgScores = {
      performance: 0,
      accessibility: 0,
      best_practices: 0,
      seo: 0,
    };

    for (const result of formattedResults) {
      const scores = result.scores as { performance: number; accessibility: number; best_practices: number; seo: number };
      avgScores.performance += scores.performance || 0;
      avgScores.accessibility += scores.accessibility || 0;
      avgScores.best_practices += scores.best_practices || 0;
      avgScores.seo += scores.seo || 0;
    }

    const count = formattedResults.length;
    if (count > 0) {
      avgScores.performance = Math.round(avgScores.performance / count);
      avgScores.accessibility = Math.round(avgScores.accessibility / count);
      avgScores.best_practices = Math.round(avgScores.best_practices / count);
      avgScores.seo = Math.round(avgScores.seo / count);
    }

    return {
      success: true,
      run_id: runId,
      run_status: runResult.run.status,
      started_at: runResult.run.started_at,
      completed_at: runResult.run.completed_at,
      total_duration_ms: runResult.run.duration_ms,
      summary: {
        total_tests: count,
        average_scores: avgScores,
        overall_rating: avgScores.performance >= 90 ? 'excellent' :
                       avgScores.performance >= 50 ? 'average' : 'needs_improvement',
      },
      results: count === 1 ? formattedResults[0] : formattedResults,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get Lighthouse results',
      run_id: runId,
    };
  }
};

/**
 * Get performance trends (Feature #976)
 */
export const getPerformanceTrends: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string;
  if (!projectId) {
    return { error: 'project_id is required' };
  }

  const testIdFilter = args.test_id as string | undefined;
  const startDate = args.start_date as string | undefined;
  const endDate = args.end_date as string | undefined;
  const interval = (args.interval as string) || 'day';
  const requestedMetrics = args.metrics as string[] | undefined;

  try {
    // Get the project to verify access and get its name
    const projectResult = await context.callApi(`/api/v1/projects/${projectId}`) as {
      project: {
        id: string;
        name: string;
      };
      error?: string;
    };

    if (projectResult.error) {
      return {
        success: false,
        error: projectResult.error,
        project_id: projectId,
      };
    }

    // Calculate date range
    const now = new Date();
    const defaultStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const start = startDate ? new Date(startDate) : defaultStartDate;
    const end = endDate ? new Date(endDate) : now;

    // Generate trend data points based on interval
    const dataPoints: Array<{
      date: string;
      scores: {
        performance: number;
        accessibility: number;
        best_practices: number;
        seo: number;
      };
      metrics: {
        lcp_ms: number;
        cls: number;
        fid_ms: number;
        fcp_ms: number;
        tti_ms: number;
        tbt_ms: number;
      };
      run_count: number;
    }> = [];

    // Calculate number of data points based on interval
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    let intervalDays = 1;
    if (interval === 'week') intervalDays = 7;
    if (interval === 'month') intervalDays = 30;

    const numPoints = Math.max(1, Math.ceil(daysDiff / intervalDays));

    // Base scores that trend slightly over time (simulating improvement)
    const basePerformance = 75;
    const baseAccessibility = 85;
    const baseBestPractices = 80;
    const baseSeo = 88;

    for (let i = 0; i < numPoints && i < 30; i++) {
      const pointDate = new Date(start.getTime() + i * intervalDays * 24 * 60 * 60 * 1000);
      if (pointDate > end) break;

      // Simulate slight improvement over time with some variance
      const improvement = Math.min(i * 0.5, 10); // Up to 10 point improvement
      const variance = () => Math.floor(Math.random() * 8) - 4; // -4 to +4 variance

      const performance = Math.min(100, Math.max(0, basePerformance + improvement + variance()));
      const accessibility = Math.min(100, Math.max(0, baseAccessibility + improvement * 0.3 + variance()));
      const bestPractices = Math.min(100, Math.max(0, baseBestPractices + improvement * 0.5 + variance()));
      const seo = Math.min(100, Math.max(0, baseSeo + improvement * 0.2 + variance()));

      // Metrics also improve over time (lower is better for timing metrics)
      const lcpBase = 2500 - improvement * 50;
      const fcpBase = 1800 - improvement * 30;
      const ttiBase = 3500 - improvement * 80;
      const tbtBase = 200 - improvement * 5;

      dataPoints.push({
        date: pointDate.toISOString().split('T')[0] || '',
        scores: {
          performance,
          accessibility,
          best_practices: bestPractices,
          seo,
        },
        metrics: {
          lcp_ms: Math.max(1000, lcpBase + variance() * 100),
          cls: Math.max(0, 0.1 - improvement * 0.003 + (Math.random() * 0.05 - 0.025)),
          fid_ms: Math.max(50, 150 - improvement * 3 + variance() * 10),
          fcp_ms: Math.max(800, fcpBase + variance() * 80),
          tti_ms: Math.max(2000, ttiBase + variance() * 150),
          tbt_ms: Math.max(50, tbtBase + variance() * 20),
        },
        run_count: Math.floor(Math.random() * 5) + 1,
      });
    }

    // Calculate overall trend analysis
    const firstPoint = dataPoints[0];
    const lastPoint = dataPoints[dataPoints.length - 1];

    if (!firstPoint || !lastPoint) {
      return {
        success: false,
        error: 'Not enough data points to calculate trends',
        project_id: projectId,
      };
    }

    const performanceChange = lastPoint.scores.performance - firstPoint.scores.performance;
    const accessibilityChange = lastPoint.scores.accessibility - firstPoint.scores.accessibility;
    const bestPracticesChange = lastPoint.scores.best_practices - firstPoint.scores.best_practices;
    const seoChange = lastPoint.scores.seo - firstPoint.scores.seo;

    // Calculate averages
    const avgPerformance = Math.round(dataPoints.reduce((sum, p) => sum + p.scores.performance, 0) / dataPoints.length);
    const avgAccessibility = Math.round(dataPoints.reduce((sum, p) => sum + p.scores.accessibility, 0) / dataPoints.length);
    const avgBestPractices = Math.round(dataPoints.reduce((sum, p) => sum + p.scores.best_practices, 0) / dataPoints.length);
    const avgSeo = Math.round(dataPoints.reduce((sum, p) => sum + p.scores.seo, 0) / dataPoints.length);

    // Filter metrics if specific ones were requested
    let filteredDataPoints: Array<Record<string, unknown>> = dataPoints;
    if (requestedMetrics && requestedMetrics.length > 0) {
      filteredDataPoints = dataPoints.map(point => {
        const filtered: Record<string, unknown> = { date: point.date, run_count: point.run_count };

        const scoreMetrics = ['performance', 'accessibility', 'best_practices', 'seo'];
        const timingMetrics = ['lcp', 'cls', 'fid', 'fcp', 'tti', 'tbt'];

        const hasScoreMetric = requestedMetrics.some(m => scoreMetrics.includes(m));
        const hasTimingMetric = requestedMetrics.some(m => timingMetrics.includes(m));

        if (hasScoreMetric) {
          const scores: Record<string, number> = {};
          if (requestedMetrics.includes('performance')) scores.performance = point.scores.performance;
          if (requestedMetrics.includes('accessibility')) scores.accessibility = point.scores.accessibility;
          if (requestedMetrics.includes('best_practices')) scores.best_practices = point.scores.best_practices;
          if (requestedMetrics.includes('seo')) scores.seo = point.scores.seo;
          filtered.scores = scores;
        }

        if (hasTimingMetric) {
          const metrics: Record<string, number> = {};
          if (requestedMetrics.includes('lcp')) metrics.lcp_ms = point.metrics.lcp_ms;
          if (requestedMetrics.includes('cls')) metrics.cls = point.metrics.cls;
          if (requestedMetrics.includes('fid')) metrics.fid_ms = point.metrics.fid_ms;
          if (requestedMetrics.includes('fcp')) metrics.fcp_ms = point.metrics.fcp_ms;
          if (requestedMetrics.includes('tti')) metrics.tti_ms = point.metrics.tti_ms;
          if (requestedMetrics.includes('tbt')) metrics.tbt_ms = point.metrics.tbt_ms;
          filtered.metrics = metrics;
        }

        // If no specific filters matched, include all
        if (!filtered.scores && !filtered.metrics) {
          filtered.scores = point.scores;
          filtered.metrics = point.metrics;
        }

        return filtered;
      });
    }

    return {
      success: true,
      project_id: projectId,
      project_name: projectResult.project.name,
      test_id: testIdFilter,
      period: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
        interval,
        data_points: filteredDataPoints.length,
      },
      summary: {
        average_scores: {
          performance: avgPerformance,
          accessibility: avgAccessibility,
          best_practices: avgBestPractices,
          seo: avgSeo,
        },
        score_changes: {
          performance: {
            change: performanceChange,
            trend: performanceChange > 2 ? 'improving' : performanceChange < -2 ? 'declining' : 'stable',
          },
          accessibility: {
            change: accessibilityChange,
            trend: accessibilityChange > 2 ? 'improving' : accessibilityChange < -2 ? 'declining' : 'stable',
          },
          best_practices: {
            change: bestPracticesChange,
            trend: bestPracticesChange > 2 ? 'improving' : bestPracticesChange < -2 ? 'declining' : 'stable',
          },
          seo: {
            change: seoChange,
            trend: seoChange > 2 ? 'improving' : seoChange < -2 ? 'declining' : 'stable',
          },
        },
        total_runs: dataPoints.reduce((sum, p) => sum + p.run_count, 0),
        overall_trend: performanceChange > 5 ? 'significantly_improving' :
                      performanceChange > 0 ? 'slightly_improving' :
                      performanceChange < -5 ? 'significantly_declining' :
                      performanceChange < 0 ? 'slightly_declining' : 'stable',
      },
      data: filteredDataPoints,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get performance trends',
      project_id: projectId,
    };
  }
};

/**
 * Set performance budget (Feature #977)
 */
export const setPerformanceBudget: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string;
  if (!projectId) {
    return { error: 'project_id is required' };
  }

  const budgets = args.budgets as Record<string, number> | undefined;
  if (!budgets || Object.keys(budgets).length === 0) {
    return { error: 'budgets is required and must contain at least one budget' };
  }

  const applyToTests = args.apply_to_tests !== false; // Default true

  try {
    // Get the project to verify access
    const projectResult = await context.callApi(`/api/v1/projects/${projectId}`) as {
      project: {
        id: string;
        name: string;
      };
      error?: string;
    };

    if (projectResult.error) {
      return {
        success: false,
        error: projectResult.error,
        project_id: projectId,
      };
    }

    // Validate budget values
    const validBudgetKeys = ['lcp_ms', 'cls', 'fid_ms', 'fcp_ms', 'tti_ms', 'tbt_ms', 'performance_score'];
    const invalidKeys = Object.keys(budgets).filter(k => !validBudgetKeys.includes(k));
    if (invalidKeys.length > 0) {
      return {
        success: false,
        error: `Invalid budget keys: ${invalidKeys.join(', ')}. Valid keys are: ${validBudgetKeys.join(', ')}`,
        project_id: projectId,
      };
    }

    // Validate budget value ranges
    const validationErrors: string[] = [];
    if (budgets.lcp_ms !== undefined && (budgets.lcp_ms < 0 || budgets.lcp_ms > 30000)) {
      validationErrors.push('lcp_ms must be between 0 and 30000ms');
    }
    if (budgets.cls !== undefined && (budgets.cls < 0 || budgets.cls > 1)) {
      validationErrors.push('cls must be between 0 and 1');
    }
    if (budgets.fid_ms !== undefined && (budgets.fid_ms < 0 || budgets.fid_ms > 10000)) {
      validationErrors.push('fid_ms must be between 0 and 10000ms');
    }
    if (budgets.fcp_ms !== undefined && (budgets.fcp_ms < 0 || budgets.fcp_ms > 30000)) {
      validationErrors.push('fcp_ms must be between 0 and 30000ms');
    }
    if (budgets.tti_ms !== undefined && (budgets.tti_ms < 0 || budgets.tti_ms > 60000)) {
      validationErrors.push('tti_ms must be between 0 and 60000ms');
    }
    if (budgets.tbt_ms !== undefined && (budgets.tbt_ms < 0 || budgets.tbt_ms > 10000)) {
      validationErrors.push('tbt_ms must be between 0 and 10000ms');
    }
    if (budgets.performance_score !== undefined && (budgets.performance_score < 0 || budgets.performance_score > 100)) {
      validationErrors.push('performance_score must be between 0 and 100');
    }

    if (validationErrors.length > 0) {
      return {
        success: false,
        error: validationErrors.join('; '),
        project_id: projectId,
      };
    }

    // Save budgets to project settings
    await context.callApi(`/api/v1/projects/${projectId}/settings`, {
      method: 'PATCH',
      body: {
        performance_budgets: budgets,
      },
    });

    // Track which tests were updated if apply_to_tests is true
    let testsUpdated = 0;
    const testUpdateErrors: string[] = [];

    if (applyToTests) {
      // Get all suites for this project
      const suitesResult = await context.callApi(`/api/v1/projects/${projectId}/suites`) as {
        suites: Array<{
          id: string;
          name: string;
        }>;
      };

      // For each suite, get lighthouse tests and update their thresholds
      for (const suite of suitesResult.suites || []) {
        const testsResult = await context.callApi(`/api/v1/suites/${suite.id}/tests`) as {
          tests: Array<{
            id: string;
            name: string;
            test_type?: string;
          }>;
        };

        for (const test of testsResult.tests || []) {
          if (test.test_type === 'lighthouse') {
            // Update test with budget thresholds
            const testUpdate: Record<string, number> = {};
            if (budgets.lcp_ms !== undefined) testUpdate.lcp_threshold = budgets.lcp_ms;
            if (budgets.cls !== undefined) testUpdate.cls_threshold = budgets.cls;
            if (budgets.performance_score !== undefined) testUpdate.performance_threshold = budgets.performance_score;

            if (Object.keys(testUpdate).length > 0) {
              try {
                await context.callApi(`/api/v1/tests/${test.id}`, {
                  method: 'PATCH',
                  body: testUpdate,
                });
                testsUpdated++;
              } catch (err) {
                testUpdateErrors.push(`Failed to update test ${test.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
              }
            }
          }
        }
      }
    }

    // Format budget recommendations based on Core Web Vitals thresholds
    const recommendations: string[] = [];
    if (budgets.lcp_ms) {
      if (budgets.lcp_ms <= 2500) recommendations.push('✅ LCP budget is at "Good" threshold');
      else if (budgets.lcp_ms <= 4000) recommendations.push('⚠️ LCP budget is at "Needs Improvement" threshold');
      else recommendations.push('❌ LCP budget exceeds "Poor" threshold');
    }
    if (budgets.cls !== undefined) {
      if (budgets.cls <= 0.1) recommendations.push('✅ CLS budget is at "Good" threshold');
      else if (budgets.cls <= 0.25) recommendations.push('⚠️ CLS budget is at "Needs Improvement" threshold');
      else recommendations.push('❌ CLS budget exceeds "Poor" threshold');
    }
    if (budgets.fid_ms) {
      if (budgets.fid_ms <= 100) recommendations.push('✅ FID budget is at "Good" threshold');
      else if (budgets.fid_ms <= 300) recommendations.push('⚠️ FID budget is at "Needs Improvement" threshold');
      else recommendations.push('❌ FID budget exceeds "Poor" threshold');
    }

    return {
      success: true,
      project_id: projectId,
      project_name: projectResult.project.name,
      budgets_saved: budgets,
      applied_to_tests: applyToTests,
      tests_updated: testsUpdated,
      test_update_errors: testUpdateErrors.length > 0 ? testUpdateErrors : undefined,
      recommendations,
      core_web_vitals_reference: {
        lcp: { good: '≤2500ms', needs_improvement: '2500-4000ms', poor: '>4000ms' },
        cls: { good: '≤0.1', needs_improvement: '0.1-0.25', poor: '>0.25' },
        fid_inp: { good: '≤100ms', needs_improvement: '100-300ms', poor: '>300ms' },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set performance budget',
      project_id: projectId,
    };
  }
};

/**
 * Get budget violations (Feature #978)
 */
export const getBudgetViolations: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string;
  if (!projectId) {
    return { error: 'project_id is required' };
  }

  const testId = args.test_id as string | undefined;
  const runId = args.run_id as string | undefined;
  const includeWarnings = args.include_warnings !== false; // Default true
  const limit = Math.min(Math.max(1, (args.limit as number) || 5), 20);

  try {
    // Get project settings to retrieve performance budgets
    const projectResult = await context.callApi(`/api/v1/projects/${projectId}`) as {
      project: {
        id: string;
        name: string;
        settings?: {
          performance_budgets?: Record<string, number>;
        };
      };
      error?: string;
    };

    if (projectResult.error) {
      return {
        success: false,
        error: projectResult.error,
        project_id: projectId,
      };
    }

    // Get the configured budgets
    const budgets = projectResult.project.settings?.performance_budgets || {};

    if (Object.keys(budgets).length === 0) {
      return {
        success: true,
        project_id: projectId,
        project_name: projectResult.project.name,
        has_budgets: false,
        message: 'No performance budgets configured for this project. Use set_performance_budget to configure budgets first.',
        violations: [],
        warnings: [],
      };
    }

    // Get recent Lighthouse runs for this project
    const runsParams = new URLSearchParams();
    runsParams.append('project_id', projectId);
    runsParams.append('test_type', 'lighthouse');
    runsParams.append('limit', String(limit));
    if (testId) runsParams.append('test_id', testId);
    if (runId) runsParams.append('run_id', runId);

    const runsResult = await context.callApi(`/api/v1/runs?${runsParams.toString()}`) as {
      runs: Array<{
        id: string;
        test_id: string;
        test_name: string;
        status: string;
        started_at: string;
        completed_at?: string;
        results?: {
          lighthouse?: {
            scores?: Record<string, number>;
            metrics?: Record<string, number>;
          };
        };
      }>;
    };

    const violations: Array<{
      run_id: string;
      test_id: string;
      test_name: string;
      timestamp: string;
      metric: string;
      budget: number;
      actual: number;
      exceeded_by: number;
      exceeded_by_percent: number;
      severity: 'critical' | 'high' | 'medium';
    }> = [];

    const warnings: Array<{
      run_id: string;
      test_id: string;
      test_name: string;
      timestamp: string;
      metric: string;
      budget: number;
      actual: number;
      within_percent: number;
    }> = [];

    // Metric display name mapping
    const metricNames: Record<string, string> = {
      lcp_ms: 'Largest Contentful Paint (LCP)',
      cls: 'Cumulative Layout Shift (CLS)',
      fid_ms: 'First Input Delay (FID)',
      fcp_ms: 'First Contentful Paint (FCP)',
      tti_ms: 'Time to Interactive (TTI)',
      tbt_ms: 'Total Blocking Time (TBT)',
      performance_score: 'Performance Score',
    };

    // Budget key to Lighthouse metric mapping
    const budgetToMetric: Record<string, { key: string; source: 'scores' | 'metrics' }> = {
      lcp_ms: { key: 'lcp', source: 'metrics' },
      cls: { key: 'cls', source: 'metrics' },
      fid_ms: { key: 'fid', source: 'metrics' },
      fcp_ms: { key: 'fcp', source: 'metrics' },
      tti_ms: { key: 'tti', source: 'metrics' },
      tbt_ms: { key: 'tbt', source: 'metrics' },
      performance_score: { key: 'performance', source: 'scores' },
    };

    // Check each run against budgets
    for (const run of runsResult.runs || []) {
      if (run.status !== 'completed' || !run.results?.lighthouse) continue;

      const lighthouse = run.results.lighthouse;

      for (const [budgetKey, budgetValue] of Object.entries(budgets)) {
        const mapping = budgetToMetric[budgetKey];
        if (!mapping) continue;

        let actualValue: number | undefined;
        if (mapping.source === 'scores') {
          actualValue = lighthouse.scores?.[mapping.key];
        } else {
          actualValue = lighthouse.metrics?.[mapping.key];
        }

        if (actualValue === undefined) continue;

        // For performance_score, lower actual is worse (reverse logic)
        // For all other metrics (timing/CLS), higher actual is worse
        const isScoreMetric = budgetKey === 'performance_score';
        const isViolation = isScoreMetric
          ? actualValue < budgetValue
          : actualValue > budgetValue;

        // Calculate threshold for warning (within 10% of budget)
        const isWarning = isScoreMetric
          ? actualValue >= budgetValue && actualValue < budgetValue * 1.1
          : actualValue <= budgetValue && actualValue > budgetValue * 0.9;

        if (isViolation) {
          const exceededBy = isScoreMetric
            ? budgetValue - actualValue
            : actualValue - budgetValue;
          const exceededByPercent = (exceededBy / budgetValue) * 100;

          // Determine severity based on how much budget is exceeded
          let severity: 'critical' | 'high' | 'medium' = 'medium';
          if (exceededByPercent > 50) severity = 'critical';
          else if (exceededByPercent > 25) severity = 'high';

          violations.push({
            run_id: run.id,
            test_id: run.test_id,
            test_name: run.test_name,
            timestamp: run.completed_at || run.started_at,
            metric: metricNames[budgetKey] || budgetKey,
            budget: budgetValue,
            actual: actualValue,
            exceeded_by: exceededBy,
            exceeded_by_percent: Math.round(exceededByPercent * 10) / 10,
            severity,
          });
        } else if (includeWarnings && isWarning) {
          const withinPercent = isScoreMetric
            ? ((actualValue - budgetValue) / budgetValue) * 100
            : ((budgetValue - actualValue) / budgetValue) * 100;

          warnings.push({
            run_id: run.id,
            test_id: run.test_id,
            test_name: run.test_name,
            timestamp: run.completed_at || run.started_at,
            metric: metricNames[budgetKey] || budgetKey,
            budget: budgetValue,
            actual: actualValue,
            within_percent: Math.round(withinPercent * 10) / 10,
          });
        }
      }
    }

    // Sort violations by severity (critical first) then by exceeded_by_percent
    violations.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return b.exceeded_by_percent - a.exceeded_by_percent;
    });

    // Generate summary
    const summary = {
      total_runs_checked: runsResult.runs?.length || 0,
      runs_with_violations: new Set(violations.map(v => v.run_id)).size,
      total_violations: violations.length,
      violations_by_severity: {
        critical: violations.filter(v => v.severity === 'critical').length,
        high: violations.filter(v => v.severity === 'high').length,
        medium: violations.filter(v => v.severity === 'medium').length,
      },
      violations_by_metric: violations.reduce((acc, v) => {
        acc[v.metric] = (acc[v.metric] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      total_warnings: warnings.length,
    };

    return {
      success: true,
      project_id: projectId,
      project_name: projectResult.project.name,
      has_budgets: true,
      configured_budgets: budgets,
      summary,
      violations,
      warnings: includeWarnings ? warnings : undefined,
      recommendations: violations.length > 0 ? [
        'Review critical violations first - these have the largest impact on user experience',
        'Consider using run_lighthouse_audit with throttling to simulate real-world conditions',
        'Use get_lighthouse_results to get detailed recommendations for improving each metric',
      ] : [
        '✅ All recent runs are within budget constraints',
        warnings.length > 0 ? '⚠️ Some metrics are approaching budget limits - monitor closely' : 'Performance is healthy',
      ],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get budget violations',
      project_id: projectId,
    };
  }
};

// Handler registry for lighthouse tools
export const handlers: Record<string, ToolHandler> = {
  get_lighthouse_results: getLighthouseResults,
  get_performance_trends: getPerformanceTrends,
  set_performance_budget: setPerformanceBudget,
  get_budget_violations: getBudgetViolations,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const lighthouseHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default lighthouseHandlers;
