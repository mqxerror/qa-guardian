/**
 * Accessibility Testing Tool Handlers
 *
 * Handlers for axe-core accessibility testing MCP tools.
 * Extracted from server.ts to reduce file size (Feature #1356).
 */

import { ToolHandler, HandlerModule } from './types';

/**
 * Run accessibility scan (Feature #988)
 */
export const runAccessibilityScan: ToolHandler = async (args, context) => {
  const url = args.url as string;
  if (!url) {
    return { error: 'url is required' };
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return { error: 'Invalid URL format. Please provide a valid URL (e.g., https://example.com)' };
  }

  const wcagLevel = (args.wcag_level as string) || 'AA';
  const includeBestPractices = args.include_best_practices !== false; // Default true
  const includeExperimental = args.include_experimental === true; // Default false
  const waitForSelector = args.wait_for_selector as string | undefined;
  const projectId = args.project_id as string | undefined;
  const testName = args.test_name as string || `Accessibility Scan: ${new URL(url).hostname}`;

  try {
    // First, we need to create or find a suite for accessibility tests
    let suiteId: string;

    if (projectId) {
      // Check if project has an accessibility suite, or create one
      const suitesResult = await context.callApi(`/api/v1/projects/${projectId}/suites`) as {
        suites?: Array<{
          id: string;
          name: string;
          type?: string;
        }>;
        error?: string;
      };

      if (suitesResult.error) {
        return {
          success: false,
          error: `Failed to fetch project suites: ${suitesResult.error}`,
        };
      }

      // Look for existing accessibility suite
      const a11ySuite = suitesResult.suites?.find(s =>
        s.name.toLowerCase().includes('accessibility') || s.type === 'accessibility'
      );

      if (a11ySuite) {
        suiteId = a11ySuite.id;
      } else {
        // Create a new accessibility suite
        const createSuiteResult = await context.callApi(`/api/v1/projects/${projectId}/suites`, {
          method: 'POST',
          body: {
            name: 'Accessibility Tests',
            description: 'Auto-created suite for accessibility scans',
            type: 'accessibility',
          },
        }) as {
          suite?: { id: string };
          error?: string;
        };

        if (createSuiteResult.error || !createSuiteResult.suite) {
          return {
            success: false,
            error: `Failed to create accessibility suite: ${createSuiteResult.error || 'Unknown error'}`,
          };
        }
        suiteId = createSuiteResult.suite.id;
      }
    } else {
      // Without a project, we need at least one project. Try to get the first available one.
      const projectsResult = await context.callApi('/api/v1/projects') as {
        projects?: Array<{ id: string; name: string }>;
        error?: string;
      };

      if (projectsResult.error || !projectsResult.projects || projectsResult.projects.length === 0) {
        return {
          success: false,
          error: 'No project specified and no projects available. Please create a project first or specify project_id.',
        };
      }

      const defaultProjectId = projectsResult.projects[0]?.id;
      if (!defaultProjectId) {
        return {
          success: false,
          error: 'No project available',
        };
      }

      // Get or create accessibility suite
      const suitesResult = await context.callApi(`/api/v1/projects/${defaultProjectId}/suites`) as {
        suites?: Array<{ id: string; name: string; type?: string }>;
        error?: string;
      };

      const a11ySuite = suitesResult.suites?.find(s =>
        s.name.toLowerCase().includes('accessibility') || s.type === 'accessibility'
      );

      if (a11ySuite) {
        suiteId = a11ySuite.id;
      } else {
        const createSuiteResult = await context.callApi(`/api/v1/projects/${defaultProjectId}/suites`, {
          method: 'POST',
          body: {
            name: 'Accessibility Tests',
            description: 'Auto-created suite for accessibility scans',
            type: 'accessibility',
          },
        }) as {
          suite?: { id: string };
          error?: string;
        };

        if (createSuiteResult.error || !createSuiteResult.suite) {
          return {
            success: false,
            error: `Failed to create accessibility suite: ${createSuiteResult.error || 'Unknown error'}`,
          };
        }
        suiteId = createSuiteResult.suite.id;
      }
    }

    // Create the accessibility test
    const createTestResult = await context.callApi(`/api/v1/suites/${suiteId}/tests`, {
      method: 'POST',
      body: {
        name: testName,
        description: `Accessibility audit for ${url} at WCAG ${wcagLevel} level`,
        test_type: 'accessibility',
        target_url: url,
        wcag_level: wcagLevel,
        include_best_practices: includeBestPractices,
        include_experimental: includeExperimental,
        a11y_wait_selector: waitForSelector,
        steps: [
          {
            action: 'navigate',
            value: url,
            description: `Navigate to ${url}`,
          },
        ],
      },
    }) as {
      test?: {
        id: string;
        name: string;
        target_url: string;
      };
      error?: string;
    };

    if (createTestResult.error || !createTestResult.test) {
      return {
        success: false,
        error: `Failed to create accessibility test: ${createTestResult.error || 'Unknown error'}`,
      };
    }

    const testId = createTestResult.test.id;

    // Trigger the test run
    const runResult = await context.callApi(`/api/v1/tests/${testId}/runs`, {
      method: 'POST',
      body: {
        browser: 'chromium', // axe-core works best with Chromium
      },
    }) as {
      run?: {
        id: string;
        status: string;
      };
      error?: string;
    };

    if (runResult.error || !runResult.run) {
      return {
        success: false,
        error: `Failed to start accessibility scan: ${runResult.error || 'Unknown error'}`,
        test_id: testId,
      };
    }

    const runId = runResult.run.id;

    // Wait for scan completion (accessibility scans are typically fast)
    const maxWaitMs = 60000; // 60 seconds
    const pollIntervalMs = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const statusResult = await context.callApi(`/api/v1/runs/${runId}`) as {
        run?: {
          id: string;
          status: string;
          results?: Array<{
            test_id: string;
            status: string;
            accessibility_results?: {
              violations?: Array<{
                id: string;
                impact: 'critical' | 'serious' | 'moderate' | 'minor';
                description: string;
                help: string;
                helpUrl: string;
                nodes: Array<{
                  html: string;
                  target: string[];
                  failureSummary?: string;
                }>;
              }>;
              passes?: Array<{
                id: string;
                description: string;
              }>;
              incomplete?: Array<{
                id: string;
                description: string;
              }>;
              inapplicable?: Array<{
                id: string;
                description: string;
              }>;
              summary?: {
                violations_count: number;
                passes_count: number;
                critical_count: number;
                serious_count: number;
                moderate_count: number;
                minor_count: number;
              };
            };
          }>;
        };
        error?: string;
      };

      if (statusResult.error) {
        return {
          success: false,
          error: `Failed to check scan status: ${statusResult.error}`,
          run_id: runId,
        };
      }

      const run = statusResult.run;
      if (run && (run.status === 'completed' || run.status === 'failed')) {
        const result = run.results?.[0];
        const a11yResults = result?.accessibility_results;

        if (run.status === 'failed') {
          return {
            success: false,
            message: 'Accessibility scan failed',
            url,
            wcag_level: wcagLevel,
            test_id: testId,
            run_id: runId,
            status: 'failed',
            error: 'Scan execution failed',
          };
        }

        // Calculate summary stats
        const violations = a11yResults?.violations || [];
        const criticalCount = violations.filter(v => v.impact === 'critical').length;
        const seriousCount = violations.filter(v => v.impact === 'serious').length;
        const moderateCount = violations.filter(v => v.impact === 'moderate').length;
        const minorCount = violations.filter(v => v.impact === 'minor').length;
        const totalViolations = violations.length;
        const passesCount = a11yResults?.passes?.length || 0;

        // Determine pass/fail based on violations
        const scanPassed = criticalCount === 0 && seriousCount === 0;

        return {
          success: true,
          message: scanPassed
            ? `Accessibility scan passed - no critical or serious violations found`
            : `Accessibility scan completed with ${totalViolations} violation(s)`,
          url,
          wcag_level: wcagLevel,
          test_id: testId,
          test_name: testName,
          run_id: runId,
          status: scanPassed ? 'passed' : 'failed',
          summary: {
            total_violations: totalViolations,
            critical: criticalCount,
            serious: seriousCount,
            moderate: moderateCount,
            minor: minorCount,
            rules_passed: passesCount,
            scan_passed: scanPassed,
          },
          violations: violations.slice(0, 10).map(v => ({
            rule_id: v.id,
            impact: v.impact,
            description: v.description,
            help: v.help,
            help_url: v.helpUrl,
            affected_elements: v.nodes.length,
            sample_element: v.nodes[0]?.html?.substring(0, 200),
          })),
          has_more_violations: totalViolations > 10,
          recommendations: [
            ...(criticalCount > 0 ? [`Fix ${criticalCount} critical issue(s) immediately - these block users from accessing content`] : []),
            ...(seriousCount > 0 ? [`Address ${seriousCount} serious issue(s) - these significantly impact user experience`] : []),
            ...(moderateCount > 0 ? [`Review ${moderateCount} moderate issue(s) - these cause difficulties for some users`] : []),
            ...(totalViolations === 0 ? ['Great job! Consider running with WCAG AAA level for even better accessibility'] : []),
          ],
        };
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    // Timeout - return partial result
    return {
      success: true,
      message: 'Accessibility scan started but timed out waiting for completion',
      url,
      wcag_level: wcagLevel,
      test_id: testId,
      test_name: testName,
      run_id: runId,
      status: 'running',
      note: 'Scan is still running. Use get_test_run_status to check progress.',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run accessibility scan',
    };
  }
};

/**
 * Get accessibility results (Feature #989)
 */
export const getAccessibilityResults: ToolHandler = async (args, context) => {
  const runId = args.run_id as string | undefined;
  const testId = args.test_id as string | undefined;
  const severityFilter = (args.severity_filter as string) || 'all';
  const includePassing = args.include_passing === true; // Default false
  const includeRemediation = args.include_remediation !== false; // Default true

  if (!runId && !testId) {
    return { error: 'Either run_id or test_id is required' };
  }

  try {
    let targetRunId = runId;

    // If test_id provided, get the latest run for that test
    if (!targetRunId && testId) {
      // First verify it's an accessibility test
      const testResult = await context.callApi(`/api/v1/tests/${testId}`) as {
        test?: {
          id: string;
          name: string;
          test_type: string;
        };
        error?: string;
      };

      if (testResult.error || !testResult.test) {
        return {
          success: false,
          error: `Test not found: ${testResult.error || 'Test does not exist'}`,
        };
      }

      if (testResult.test.test_type !== 'accessibility') {
        return {
          success: false,
          error: `Test ${testId} is not an accessibility test (type: ${testResult.test.test_type})`,
          hint: 'This tool only works with accessibility tests.',
        };
      }

      // Get runs for this test
      const runsResult = await context.callApi(`/api/v1/tests/${testId}/runs`) as {
        runs?: Array<{
          id: string;
          status: string;
          started_at: string;
        }>;
        error?: string;
      };

      if (runsResult.error || !runsResult.runs || runsResult.runs.length === 0) {
        return {
          success: false,
          error: 'No runs found for this test',
          test_id: testId,
          hint: 'Run an accessibility scan first using run_accessibility_scan.',
        };
      }

      // Get the most recent completed run
      const completedRuns = runsResult.runs.filter(r => r.status === 'completed');
      if (completedRuns.length === 0) {
        const latestRun = runsResult.runs[0];
        return {
          success: false,
          error: `No completed runs found. Latest run status: ${latestRun?.status}`,
          test_id: testId,
          latest_run_id: latestRun?.id,
          hint: latestRun?.status === 'running' ? 'Wait for the run to complete or use get_test_run_status to check progress.' : 'Run a new accessibility scan.',
        };
      }

      targetRunId = completedRuns[0]?.id;
    }

    if (!targetRunId) {
      return {
        success: false,
        error: 'Could not determine run ID',
      };
    }

    // Fetch run details with accessibility results
    const runResult = await context.callApi(`/api/v1/runs/${targetRunId}`) as {
      run?: {
        id: string;
        status: string;
        test_id?: string;
        test_name?: string;
        test_type?: string;
        started_at: string;
        completed_at?: string;
        results?: Array<{
          test_id: string;
          status: string;
          target_url?: string;
          wcag_level?: string;
          accessibility_results?: {
            violations?: Array<{
              id: string;
              impact: 'critical' | 'serious' | 'moderate' | 'minor';
              description: string;
              help: string;
              helpUrl: string;
              tags?: string[];
              nodes: Array<{
                html: string;
                target: string[];
                failureSummary?: string;
                any?: Array<{ id: string; message: string }>;
                all?: Array<{ id: string; message: string }>;
                none?: Array<{ id: string; message: string }>;
              }>;
            }>;
            passes?: Array<{
              id: string;
              description: string;
              help: string;
              helpUrl: string;
              tags?: string[];
              nodes?: Array<{ html: string; target: string[] }>;
            }>;
            incomplete?: Array<{
              id: string;
              description: string;
              impact?: string;
            }>;
            inapplicable?: Array<{
              id: string;
              description: string;
            }>;
          };
        }>;
      };
      error?: string;
    };

    if (runResult.error || !runResult.run) {
      return {
        success: false,
        error: `Run not found: ${runResult.error || 'Run does not exist'}`,
      };
    }

    const run = runResult.run;
    const result = run.results?.[0];
    const a11yResults = result?.accessibility_results;

    if (run.status !== 'completed') {
      return {
        success: false,
        error: `Run is not completed (status: ${run.status})`,
        run_id: targetRunId,
        hint: run.status === 'running' ? 'Wait for the run to complete.' : 'Run may have failed.',
      };
    }

    if (!a11yResults) {
      return {
        success: false,
        error: 'No accessibility results found in this run',
        run_id: targetRunId,
        hint: 'This may not be an accessibility test run.',
      };
    }

    // Filter violations by severity
    let violations = a11yResults.violations || [];
    if (severityFilter !== 'all') {
      violations = violations.filter(v => v.impact === severityFilter);
    }

    // Calculate summary stats
    const allViolations = a11yResults.violations || [];
    const criticalCount = allViolations.filter(v => v.impact === 'critical').length;
    const seriousCount = allViolations.filter(v => v.impact === 'serious').length;
    const moderateCount = allViolations.filter(v => v.impact === 'moderate').length;
    const minorCount = allViolations.filter(v => v.impact === 'minor').length;
    const totalViolations = allViolations.length;
    const passesCount = a11yResults.passes?.length || 0;
    const incompleteCount = a11yResults.incomplete?.length || 0;

    // Build remediation guidance map
    const remediationGuidance: Record<string, {
      rule_id: string;
      description: string;
      wcag_criteria: string[];
      fix_suggestions: string[];
      resources: string[];
    }> = {};

    if (includeRemediation) {
      for (const violation of violations) {
        const wcagTags = violation.tags?.filter(t => t.startsWith('wcag')) || [];
        const fixSuggestions: string[] = [];

        // Extract fix suggestions from nodes
        for (const node of violation.nodes.slice(0, 3)) {
          if (node.failureSummary) {
            fixSuggestions.push(node.failureSummary);
          }
          if (node.any) {
            fixSuggestions.push(...node.any.map(a => a.message));
          }
          if (node.all) {
            fixSuggestions.push(...node.all.map(a => a.message));
          }
        }

        remediationGuidance[violation.id] = {
          rule_id: violation.id,
          description: violation.description,
          wcag_criteria: wcagTags,
          fix_suggestions: [...new Set(fixSuggestions)].slice(0, 5),
          resources: [violation.helpUrl],
        };
      }
    }

    // Build response
    const response: Record<string, unknown> = {
      success: true,
      run_id: targetRunId,
      test_id: result?.test_id || testId,
      test_name: run.test_name,
      target_url: result?.target_url,
      wcag_level: result?.wcag_level || 'AA',
      scanned_at: run.completed_at || run.started_at,
      summary: {
        total_violations: totalViolations,
        filtered_violations: violations.length,
        critical: criticalCount,
        serious: seriousCount,
        moderate: moderateCount,
        minor: minorCount,
        rules_passed: passesCount,
        rules_incomplete: incompleteCount,
        scan_passed: criticalCount === 0 && seriousCount === 0,
      },
      severity_filter: severityFilter,
      violations: violations.map(v => ({
        rule_id: v.id,
        impact: v.impact,
        description: v.description,
        help: v.help,
        help_url: v.helpUrl,
        wcag_tags: v.tags?.filter(t => t.startsWith('wcag')) || [],
        affected_elements_count: v.nodes.length,
        affected_elements: v.nodes.slice(0, 5).map(n => ({
          html: n.html.substring(0, 300),
          selector: n.target.join(' > '),
          failure_summary: n.failureSummary,
        })),
        has_more_elements: v.nodes.length > 5,
      })),
    };

    // Add passing rules if requested
    if (includePassing && a11yResults.passes) {
      response.passing_rules = a11yResults.passes.slice(0, 20).map(p => ({
        rule_id: p.id,
        description: p.description,
        help: p.help,
        elements_checked: p.nodes?.length || 0,
      }));
      response.has_more_passing_rules = (a11yResults.passes.length || 0) > 20;
    }

    // Add remediation guidance if requested
    if (includeRemediation && Object.keys(remediationGuidance).length > 0) {
      response.remediation_guidance = remediationGuidance;
    }

    // Add recommendations based on findings
    const recommendations: string[] = [];
    if (criticalCount > 0) {
      recommendations.push(`CRITICAL: Fix ${criticalCount} critical issue(s) immediately - these block users from accessing content`);
    }
    if (seriousCount > 0) {
      recommendations.push(`HIGH PRIORITY: Address ${seriousCount} serious issue(s) - these significantly impact user experience`);
    }
    if (moderateCount > 0) {
      recommendations.push(`MODERATE: Review ${moderateCount} moderate issue(s) - these cause difficulties for some users`);
    }
    if (minorCount > 0) {
      recommendations.push(`LOW: Consider fixing ${minorCount} minor issue(s) - these are best practice improvements`);
    }
    if (incompleteCount > 0) {
      recommendations.push(`REVIEW: ${incompleteCount} rule(s) need manual review - automated testing could not determine pass/fail`);
    }
    if (totalViolations === 0) {
      recommendations.push('Excellent! No violations found. Consider running with stricter WCAG level for even better accessibility.');
    }

    response.recommendations = recommendations;

    return response;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get accessibility results',
    };
  }
};

/**
 * Get accessibility trends (Feature #990)
 */
export const getAccessibilityTrends: ToolHandler = async (args, context) => {
  const projectId = args.project_id as string;
  const testId = args.test_id as string | undefined;
  const period = (args.period as string) || '30d';
  const includeViolationBreakdown = args.include_violation_breakdown !== false; // Default true

  if (!projectId) {
    return { error: 'project_id is required' };
  }

  // Parse period to days
  const periodDays = parseInt(period.replace('d', ''), 10);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);

  try {
    // Get all runs for the project
    const runsResult = await context.callApi(`/api/v1/projects/${projectId}/runs?limit=500`) as {
      runs?: Array<{
        id: string;
        test_id?: string;
        test_name?: string;
        test_type?: string;
        status: string;
        started_at: string;
        completed_at?: string;
        results?: Array<{
          test_id: string;
          status: string;
          accessibility_results?: {
            violations?: Array<{
              id: string;
              impact: 'critical' | 'serious' | 'moderate' | 'minor';
            }>;
            passes?: Array<{ id: string }>;
          };
        }>;
      }>;
      error?: string;
    };

    if (runsResult.error) {
      return {
        success: false,
        error: `Failed to fetch runs: ${runsResult.error}`,
      };
    }

    // Filter to accessibility runs within the period
    let accessibilityRuns = (runsResult.runs || []).filter(run => {
      if (run.test_type !== 'accessibility' &&
          !run.results?.some(r => r.accessibility_results)) {
        return false;
      }
      if (run.status !== 'completed') return false;
      const runDate = new Date(run.started_at);
      return runDate >= cutoffDate;
    });

    // If specific test_id provided, filter to that test
    if (testId) {
      accessibilityRuns = accessibilityRuns.filter(run =>
        run.test_id === testId ||
        run.results?.some(r => r.test_id === testId)
      );
    }

    if (accessibilityRuns.length === 0) {
      return {
        success: true,
        message: 'No accessibility runs found in the specified period',
        project_id: projectId,
        test_id: testId,
        period,
        runs_analyzed: 0,
        trends: null,
        hint: 'Run accessibility scans using run_accessibility_scan to start tracking trends.',
      };
    }

    // Sort by date
    accessibilityRuns.sort((a, b) =>
      new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
    );

    // Build trend data points
    interface TrendPoint {
      date: string;
      run_id: string;
      test_name?: string;
      total_violations: number;
      critical: number;
      serious: number;
      moderate: number;
      minor: number;
      rules_passed: number;
      score: number; // Calculated accessibility score
    }

    const trendPoints: TrendPoint[] = [];
    const violationsByRule: Record<string, number[]> = {};

    for (const run of accessibilityRuns) {
      const result = run.results?.[0];
      const a11yResults = result?.accessibility_results;
      const violations = a11yResults?.violations || [];

      const criticalCount = violations.filter(v => v.impact === 'critical').length;
      const seriousCount = violations.filter(v => v.impact === 'serious').length;
      const moderateCount = violations.filter(v => v.impact === 'moderate').length;
      const minorCount = violations.filter(v => v.impact === 'minor').length;
      const passesCount = a11yResults?.passes?.length || 0;
      const totalViolations = violations.length;

      // Calculate score (weighted by severity)
      // Score is 100 minus penalty for violations
      const penalty = (criticalCount * 10) + (seriousCount * 5) + (moderateCount * 2) + (minorCount * 0.5);
      const score = Math.max(0, Math.min(100, 100 - penalty));

      trendPoints.push({
        date: run.started_at,
        run_id: run.id,
        test_name: run.test_name,
        total_violations: totalViolations,
        critical: criticalCount,
        serious: seriousCount,
        moderate: moderateCount,
        minor: minorCount,
        rules_passed: passesCount,
        score: Math.round(score * 10) / 10,
      });

      // Track violations by rule
      if (includeViolationBreakdown) {
        for (const violation of violations) {
          if (!violationsByRule[violation.id]) {
            violationsByRule[violation.id] = [];
          }
          violationsByRule[violation.id]!.push(1);
        }
      }
    }

    // Calculate trend analysis
    const latestPoint = trendPoints[trendPoints.length - 1];
    const earliestPoint = trendPoints[0];

    if (!latestPoint || !earliestPoint) {
      return {
        success: false,
        error: 'Not enough data points to calculate trends',
        project_id: projectId,
      };
    }

    const scoreChange = latestPoint.score - earliestPoint.score;
    const violationChange = latestPoint.total_violations - earliestPoint.total_violations;
    const criticalChange = latestPoint.critical - earliestPoint.critical;

    // Determine trend direction
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (Math.abs(scoreChange) >= 5) {
      trend = scoreChange > 0 ? 'improving' : 'declining';
    } else if (Math.abs(violationChange) >= 3) {
      trend = violationChange < 0 ? 'improving' : 'declining';
    }

    // Calculate averages
    const avgScore = trendPoints.reduce((sum, p) => sum + p.score, 0) / trendPoints.length;
    const avgViolations = trendPoints.reduce((sum, p) => sum + p.total_violations, 0) / trendPoints.length;

    // Build violation breakdown
    const violationBreakdown: Array<{
      rule_id: string;
      occurrence_count: number;
      first_seen: string;
      last_seen: string;
      trend: 'new' | 'recurring' | 'resolved' | 'persistent';
    }> = [];

    if (includeViolationBreakdown) {
      for (const [ruleId, occurrences] of Object.entries(violationsByRule)) {
        violationBreakdown.push({
          rule_id: ruleId,
          occurrence_count: occurrences.length,
          first_seen: trendPoints.find(p =>
            accessibilityRuns.find(r =>
              r.id === p.run_id &&
              r.results?.[0]?.accessibility_results?.violations?.some(v => v.id === ruleId)
            )
          )?.date || earliestPoint.date,
          last_seen: [...trendPoints].reverse().find(p =>
            accessibilityRuns.find(r =>
              r.id === p.run_id &&
              r.results?.[0]?.accessibility_results?.violations?.some(v => v.id === ruleId)
            )
          )?.date || latestPoint.date,
          trend: occurrences.length === 1 ? 'new' :
                 occurrences.length >= trendPoints.length * 0.8 ? 'persistent' : 'recurring',
        });
      }

      // Sort by occurrence count
      violationBreakdown.sort((a, b) => b.occurrence_count - a.occurrence_count);
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (trend === 'declining') {
      recommendations.push('Accessibility is declining. Review recent changes that may have introduced new violations.');
    }
    if (criticalChange > 0) {
      recommendations.push(`Critical violations increased by ${criticalChange}. Prioritize fixing these immediately.`);
    }
    if (latestPoint.critical > 0) {
      recommendations.push(`${latestPoint.critical} critical violation(s) remain. These block users from accessing content.`);
    }
    if (violationBreakdown.filter(v => v.trend === 'persistent').length > 0) {
      const persistentCount = violationBreakdown.filter(v => v.trend === 'persistent').length;
      recommendations.push(`${persistentCount} violation(s) are persistent across most runs. Focus on fixing these recurring issues.`);
    }
    if (trend === 'improving') {
      recommendations.push('Great progress! Continue monitoring to maintain accessibility improvements.');
    }
    if (latestPoint.total_violations === 0) {
      recommendations.push('Excellent! No violations in latest scan. Consider testing with stricter WCAG level.');
    }

    return {
      success: true,
      project_id: projectId,
      test_id: testId,
      period,
      runs_analyzed: trendPoints.length,
      date_range: {
        start: earliestPoint.date,
        end: latestPoint.date,
      },
      summary: {
        trend,
        current_score: latestPoint.score,
        average_score: Math.round(avgScore * 10) / 10,
        score_change: Math.round(scoreChange * 10) / 10,
        current_violations: latestPoint.total_violations,
        average_violations: Math.round(avgViolations * 10) / 10,
        violation_change: violationChange,
        current_critical: latestPoint.critical,
        critical_change: criticalChange,
      },
      trend_data: trendPoints.slice(-20).map(p => ({
        date: p.date,
        run_id: p.run_id,
        score: p.score,
        violations: p.total_violations,
        critical: p.critical,
        serious: p.serious,
      })),
      ...(includeViolationBreakdown && {
        violation_breakdown: violationBreakdown.slice(0, 15),
        has_more_violations: violationBreakdown.length > 15,
      }),
      recommendations,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get accessibility trends',
    };
  }
};

// Handler registry for accessibility tools
export const handlers: Record<string, ToolHandler> = {
  run_accessibility_scan: runAccessibilityScan,
  get_accessibility_results: getAccessibilityResults,
  get_accessibility_trends: getAccessibilityTrends,
};

// List of tool names this module handles
export const toolNames = Object.keys(handlers);

// Export as a handler module
export const accessibilityHandlers: HandlerModule = {
  handlers,
  toolNames,
};

export default accessibilityHandlers;
