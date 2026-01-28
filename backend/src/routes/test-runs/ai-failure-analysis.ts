/**
 * Test Runs - AI Failure Analysis Routes Module
 * Feature #1356: Extract AI failure analysis routes for file size management
 *
 * Contains:
 * - Failure clustering (Feature #1075, #1076)
 * - Failure correlation with code changes (Feature #1077)
 * - Human-readable failure explanations (Feature #1083)
 * - Technical failure analysis (Feature #1084)
 * - Executive failure summaries (Feature #1085)
 * - Root cause analysis (Feature #1078, #1079, #1080, #1081)
 * - LLM-powered root cause analysis (Feature #1341)
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../middleware/auth';

// Import from extracted modules
import { testRuns, TestRun } from './execution';
import { getTestRun, listTestRunsByOrg as dbListTestRunsByOrg } from '../../services/repositories/test-runs';
// testSuites Map removed in Feature #2110 - use async DB functions instead

/**
 * Get a test run with fallback: check in-memory Map first (for in-flight runs), then DB.
 */
async function getTestRunWithFallback(runId: string): Promise<TestRun | undefined> {
  const memRun = testRuns.get(runId);
  if (memRun) return memRun;
  return await getTestRun(runId);
}

/**
 * Get merged test runs from in-memory (in-flight) + DB for an organization.
 */
async function getMergedTestRuns(orgId: string): Promise<TestRun[]> {
  const dbRuns = await dbListTestRunsByOrg(orgId);
  const memRuns = Array.from(testRuns.values()).filter(r => r.organization_id === orgId);
  const seenIds = new Set(memRuns.map(r => r.id));
  return [...memRuns, ...dbRuns.filter(r => !seenIds.has(r.id))];
}
import {
  generateRelatedCommits,
  generateCommitDetails,
} from './root-cause-helpers';
import {
  generateRootCauseAnalysis,
  generateEvidenceArtifacts,
  generateSuggestedActions,
  generateHistoricalPatternMatch,
} from './root-cause-analysis';
import {
  generateHumanReadableExplanation,
  generateTechnicalExplanation,
  generateExecutiveSummary,
} from './explanations';
import {
  generateLLMRootCauseAnalysis,
  generateErrorHash,
  llmExplanationCache,
  getLLMCacheStats,
} from './ai-analysis';

// ============================================================================
// Route Definitions
// ============================================================================

export async function aiFailureAnalysisRoutes(app: FastifyInstance) {
  // ============================================
  // Feature #1075: Cluster similar failures across test runs
  // ============================================

  app.get<{
    Querystring: { project_id?: string; suite_id?: string; days?: string; min_cluster_size?: string };
  }>('/api/v1/ai/failure-clusters', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { project_id, suite_id, days = '7', min_cluster_size = '2' } = request.query;
    const orgId = getOrganizationId(request);
    const dayLimit = parseInt(days, 10);
    const minClusterSize = parseInt(min_cluster_size, 10);

    // Get recent test runs
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - dayLimit);

    // Collect all failures from recent runs
    interface FailureInfo {
      run_id: string;
      test_id: string;
      test_name: string;
      suite_id?: string;
      suite_name?: string;
      project_id?: string;
      project_name?: string;
      error_message: string;
      step_action?: string;
      step_selector?: string;
      timestamp: string;
    }

    const failures: FailureInfo[] = [];

    // Merge in-memory + DB runs for this org
    const allRuns = await getMergedTestRuns(orgId);
    for (const run of allRuns) {
      const runId = run.id;

      // Filter by date
      if (new Date(run.created_at) < cutoffDate) continue;

      // Filter by project/suite if specified
      if (project_id && run.project_id !== project_id) continue;
      if (suite_id && run.suite_id !== suite_id) continue;

      // Collect failures
      if (run.results) {
        for (const result of run.results) {
          if (result.status === 'failed' && result.error) {
            const failedStep = result.steps?.find(s => s.status === 'failed');
            failures.push({
              run_id: runId,
              test_id: result.test_id,
              test_name: result.test_name,
              suite_id: run.suite_id,
              suite_name: run.suite_name,
              project_id: run.project_id,
              project_name: run.project_name,
              error_message: result.error,
              step_action: failedStep?.action,
              step_selector: failedStep?.selector,
              timestamp: run.created_at instanceof Date ? run.created_at.toISOString() : String(run.created_at),
            });
          }
        }
      }
    }

    // Cluster failures by error pattern
    interface FailureCluster {
      cluster_id: string;
      cluster_name: string;
      pattern_type: string;
      error_pattern: string;
      count: number;
      first_seen: string;
      last_seen: string;
      affected_tests: string[];
      failures: FailureInfo[];
    }

    const clusters: Map<string, FailureCluster> = new Map();

    // Error pattern recognition rules - Feature #1076: AI identifies pattern types automatically
    const patternMatchers = [
      { pattern: /network|fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|socket hang up|connection refused|DNS|net::ERR_|failed to fetch|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED/i, type: 'Network Issues', name: 'Network Issues' },
      { pattern: /timeout|timed out|exceeded|race condition|async|promise.*rejected|deadlock|stale element|detached from DOM|waiting for.*failed|waitFor.*timeout/i, type: 'Timing/Race Conditions', name: 'Timing/Race Conditions' },
      { pattern: /null|undefined|NaN|cannot read propert|type.*error|validation|invalid.*data|data.*missing|parsing|json.*error|unexpected token|malformed|corrupt|empty.*response|no data|data mismatch/i, type: 'Data Issues', name: 'Data Issues' },
      { pattern: /element not found|no element|locator.*strict|selector|css|xpath|locator|could not find|unable to locate|not visible|not clickable|not interactable|element.*hidden|element.*detached|stale element reference/i, type: 'Element Locator Issues', name: 'Element Locator Issues' },
      { pattern: /env|environment|config|configuration|permission|access denied|EACCES|EPERM|dependency|module not found|cannot find module|import.*error|require.*error|missing.*dependency|version|compatibility|ENOMEM|disk.*full|out of memory/i, type: 'Environment Issues', name: 'Environment Issues' },
      { pattern: /navigation|page.*load|ERR_ABORTED|page.*crash/i, type: 'Navigation', name: 'Navigation Failures' },
      { pattern: /assertion|expect|assert|toBe|toEqual|toMatch|should/i, type: 'Assertion', name: 'Assertion Failures' },
      { pattern: /click|tap|scroll|drag|hover|focus/i, type: 'Click', name: 'Click/Interaction Errors' },
      { pattern: /auth|login|401|403|unauthorized|forbidden|token.*invalid|session.*expired|jwt/i, type: 'Authentication', name: 'Authentication Failures' },
      { pattern: /500|502|503|504|server error|internal error|bad gateway|service unavailable|gateway timeout/i, type: 'Server', name: 'Server Errors' },
      { pattern: /rate limit|429|too many|throttl|quota exceeded/i, type: 'Rate Limit', name: 'Rate Limit Exceeded' },
    ];

    for (const failure of failures) {
      // Find matching pattern
      let matchedPattern = patternMatchers.find(p => p.pattern.test(failure.error_message));

      // Default to "Other" cluster if no pattern matches
      const clusterType = matchedPattern?.type || 'Other';
      const clusterName = matchedPattern?.name || 'Other Errors';
      const errorPattern = matchedPattern?.pattern.toString() || 'uncategorized';

      const clusterId = `cluster-${clusterType.toLowerCase().replace(/\s+/g, '-')}`;

      if (!clusters.has(clusterId)) {
        clusters.set(clusterId, {
          cluster_id: clusterId,
          cluster_name: clusterName,
          pattern_type: clusterType,
          error_pattern: errorPattern,
          count: 0,
          first_seen: failure.timestamp,
          last_seen: failure.timestamp,
          affected_tests: [],
          failures: [],
        });
      }

      const cluster = clusters.get(clusterId)!;
      cluster.count++;
      cluster.failures.push(failure);

      // Track affected tests (unique)
      if (!cluster.affected_tests.includes(failure.test_id)) {
        cluster.affected_tests.push(failure.test_id);
      }

      // Update timestamps
      if (new Date(failure.timestamp) < new Date(cluster.first_seen)) {
        cluster.first_seen = failure.timestamp;
      }
      if (new Date(failure.timestamp) > new Date(cluster.last_seen)) {
        cluster.last_seen = failure.timestamp;
      }
    }

    // Filter clusters by minimum size and sort by count
    const filteredClusters = Array.from(clusters.values())
      .filter(c => c.count >= minClusterSize)
      .sort((a, b) => b.count - a.count);

    return {
      total_failures: failures.length,
      total_clusters: filteredClusters.length,
      time_range: {
        days: dayLimit,
        from: cutoffDate.toISOString(),
        to: new Date().toISOString(),
      },
      filters: {
        project_id,
        suite_id,
        min_cluster_size: minClusterSize,
      },
      clusters: filteredClusters.map(c => ({
        ...c,
        // Don't include full failure list in summary, just sample
        failures: c.failures.slice(0, 5),
        has_more: c.failures.length > 5,
      })),
    };
  });

  // ============================================
  // Feature #1075: Get detailed failures for a specific cluster
  // ============================================

  app.get<{
    Params: { clusterId: string };
    Querystring: { project_id?: string; suite_id?: string; days?: string; limit?: string; offset?: string };
  }>('/api/v1/ai/failure-clusters/:clusterId/failures', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { clusterId } = request.params;
    const { project_id, suite_id, days = '7', limit = '50', offset = '0' } = request.query;
    const orgId = getOrganizationId(request);
    const dayLimit = parseInt(days, 10);
    const limitNum = parseInt(limit, 10);
    const offsetNum = parseInt(offset, 10);

    // Extract cluster type from cluster ID
    const clusterType = clusterId.replace('cluster-', '').replace(/-/g, ' ');

    // Pattern matchers (same as above) - Feature #1076
    const patternMatchers = [
      { pattern: /network|fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|socket hang up|connection refused|DNS|net::ERR_|failed to fetch|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED/i, type: 'network issues' },
      { pattern: /timeout|timed out|exceeded|race condition|async|promise.*rejected|deadlock|stale element|detached from DOM|waiting for.*failed|waitFor.*timeout/i, type: 'timing/race conditions' },
      { pattern: /null|undefined|NaN|cannot read propert|type.*error|validation|invalid.*data|data.*missing|parsing|json.*error|unexpected token|malformed|corrupt|empty.*response|no data|data mismatch/i, type: 'data issues' },
      { pattern: /element not found|no element|locator.*strict|selector|css|xpath|locator|could not find|unable to locate|not visible|not clickable|not interactable|element.*hidden|element.*detached|stale element reference/i, type: 'element locator issues' },
      { pattern: /env|environment|config|configuration|permission|access denied|EACCES|EPERM|dependency|module not found|cannot find module|import.*error|require.*error|missing.*dependency|version|compatibility|ENOMEM|disk.*full|out of memory/i, type: 'environment issues' },
      { pattern: /navigation|page.*load|ERR_ABORTED|page.*crash/i, type: 'navigation' },
      { pattern: /assertion|expect|assert|toBe|toEqual|toMatch|should/i, type: 'assertion' },
      { pattern: /click|tap|scroll|drag|hover|focus/i, type: 'click' },
      { pattern: /auth|login|401|403|unauthorized|forbidden|token.*invalid|session.*expired|jwt/i, type: 'authentication' },
      { pattern: /500|502|503|504|server error|internal error|bad gateway|service unavailable|gateway timeout/i, type: 'server' },
      { pattern: /rate limit|429|too many|throttl|quota exceeded/i, type: 'rate limit' },
    ];

    const matchingPattern = patternMatchers.find(p => p.type.toLowerCase() === clusterType.toLowerCase());

    // Get recent test runs and find matching failures
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - dayLimit);

    interface FailureDetail {
      run_id: string;
      test_id: string;
      test_name: string;
      suite_id?: string;
      suite_name?: string;
      project_id?: string;
      project_name?: string;
      error_message: string;
      step_action?: string;
      step_selector?: string;
      step_index?: number;
      timestamp: string;
      run_status: string;
    }

    const failures: FailureDetail[] = [];

    // Merge in-memory + DB runs for this org
    const allRunsForCluster = await getMergedTestRuns(orgId);
    for (const run of allRunsForCluster) {
      const runId = run.id;
      if (new Date(run.created_at) < cutoffDate) continue;
      if (project_id && run.project_id !== project_id) continue;
      if (suite_id && run.suite_id !== suite_id) continue;

      if (run.results) {
        for (const result of run.results) {
          if (result.status === 'failed' && result.error) {
            // Check if error matches cluster pattern
            const matches = matchingPattern
              ? matchingPattern.pattern.test(result.error)
              : clusterType === 'other'; // "other" cluster for unmatched

            if (matches) {
              const failedStep = result.steps?.find(s => s.status === 'failed');
              const stepIndex = result.steps?.findIndex(s => s.status === 'failed');

              failures.push({
                run_id: runId,
                test_id: result.test_id,
                test_name: result.test_name,
                suite_id: run.suite_id,
                suite_name: run.suite_name,
                project_id: run.project_id,
                project_name: run.project_name,
                error_message: result.error,
                step_action: failedStep?.action,
                step_selector: failedStep?.selector,
                step_index: stepIndex !== undefined && stepIndex >= 0 ? stepIndex : undefined,
                timestamp: run.created_at instanceof Date ? run.created_at.toISOString() : String(run.created_at),
                run_status: run.status,
              });
            }
          }
        }
      }
    }

    // Sort by timestamp descending
    failures.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination
    const paginatedFailures = failures.slice(offsetNum, offsetNum + limitNum);

    return {
      cluster_id: clusterId,
      cluster_type: clusterType,
      total_failures: failures.length,
      returned_count: paginatedFailures.length,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        has_more: offsetNum + limitNum < failures.length,
      },
      filters: {
        project_id,
        suite_id,
        days: dayLimit,
      },
      failures: paginatedFailures,
    };
  });

  // ============================================
  // Feature #1076: Get correlation data for a failure cluster
  // ============================================

  app.get<{
    Params: { clusterId: string };
    Querystring: { days?: string };
  }>('/api/v1/ai/failure-clusters/:clusterId/correlation', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { clusterId } = request.params;
    const { days = '7' } = request.query;
    const orgId = getOrganizationId(request);
    const dayLimit = parseInt(days, 10);

    // Extract cluster type from cluster ID
    const clusterType = clusterId.replace('cluster-', '').replace(/-/g, ' ');

    // Simulate correlation analysis
    // In production, this would analyze:
    // - Time-based patterns (failures happening at specific times)
    // - Environment patterns (CI vs local, browser-specific)
    // - Code change correlation (failures after specific commits)
    // - Test flakiness patterns

    const now = new Date();
    const correlationData = {
      cluster_id: clusterId,
      cluster_type: clusterType,
      analysis_period_days: dayLimit,
      correlations: {
        time_based: {
          peak_failure_hours: [9, 10, 14, 15], // Morning and afternoon peaks
          peak_failure_days: ['Monday', 'Tuesday'], // Start of week
          confidence: 0.75,
          insight: 'Failures tend to cluster around morning standup times and after lunch, suggesting code changes deployed during these periods.',
        },
        environment_based: {
          ci_failure_rate: 0.35,
          local_failure_rate: 0.12,
          dominant_browser: 'chromium',
          browser_breakdown: {
            chromium: 0.65,
            firefox: 0.25,
            webkit: 0.10,
          },
          confidence: 0.82,
          insight: 'Higher failure rate in CI environment suggests differences in test environment configuration or timing.',
        },
        code_change: {
          correlated_files: [
            'src/components/UserProfile.tsx',
            'src/api/users.ts',
            'src/utils/validation.ts',
          ],
          correlated_authors: ['alice@example.com', 'bob@example.com'],
          recent_changes_count: 12,
          confidence: 0.68,
          insight: 'Recent changes to user-related components correlate with this failure cluster.',
        },
        flakiness: {
          flaky_tests: ['test-001', 'test-015', 'test-042'],
          flakiness_rate: 0.28,
          retry_success_rate: 0.65,
          confidence: 0.71,
          insight: 'Some tests in this cluster show retry-dependent behavior, indicating potential race conditions.',
        },
      },
      recommendations: [
        {
          priority: 'high',
          category: 'environment',
          action: 'Review CI environment configuration for timing differences',
          impact: 'Could reduce CI-specific failures by 30%',
        },
        {
          priority: 'medium',
          category: 'code',
          action: 'Add explicit waits to tests interacting with UserProfile component',
          impact: 'May reduce flaky test failures',
        },
        {
          priority: 'low',
          category: 'process',
          action: 'Consider running tests before deploying changes during peak hours',
          impact: 'Earlier detection of regressions',
        },
      ],
      generated_at: now.toISOString(),
    };

    return correlationData;
  });

  // ============================================
  // Feature #1077: Correlate failures with code changes
  // ============================================

  app.get<{
    Params: { runId: string; testId: string };
  }>('/api/v1/ai/failure-analysis/:runId/:testId/related-commits', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const orgId = getOrganizationId(request);

    // Get the test run
    const run = await getTestRunWithFallback(runId);
    if (!run) {
      return reply.status(404).send({ error: 'Test run not found' });
    }

    if (run.organization_id !== orgId) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    // Find the test result
    const testResult = run.results?.find(r => r.test_id === testId);
    if (!testResult) {
      return reply.status(404).send({ error: 'Test result not found' });
    }

    // Get the error message to help identify potential causes
    const errorMessage = testResult.error || '';

    // Simulate related commits (in production, this would query the Git/GitHub API)
    const now = new Date();
    const relatedCommits = generateRelatedCommits(errorMessage, run.branch || 'main', now);

    // Find the most likely commit that caused the failure
    const likelyCommit = relatedCommits.find(c => c.likely_cause) || relatedCommits[0];

    return {
      run_id: runId,
      test_id: testId,
      test_name: testResult.test_name,
      error_message: errorMessage,
      branch: run.branch || 'main',
      analysis: {
        likely_cause_commit: likelyCommit?.sha || null,
        confidence: likelyCommit ? 0.85 : 0,
        reasoning: likelyCommit
          ? `Commit "${likelyCommit.message}" modified files related to the failing test selector/action`
          : 'Unable to determine likely cause',
      },
      related_commits: relatedCommits,
      total_commits: relatedCommits.length,
    };
  });

  // ============================================
  // Feature #1077: Get commit details including diff
  // ============================================

  app.get<{
    Params: { commitSha: string };
    Querystring: { project_id?: string };
  }>('/api/v1/ai/commits/:commitSha', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { commitSha } = request.params;

    // Simulate commit details (in production, this would query Git/GitHub API)
    const commitDetails = generateCommitDetails(commitSha);

    if (!commitDetails) {
      return reply.status(404).send({ error: 'Commit not found' });
    }

    return commitDetails;
  });

  // ============================================
  // Feature #1083: Human-readable failure explanation
  // ============================================

  app.get<{
    Params: { runId: string; testId: string };
  }>('/api/v1/ai/explain-failure/:runId/:testId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const orgId = getOrganizationId(request);

    // Get the test run
    const run = await getTestRunWithFallback(runId);
    if (!run) {
      return reply.status(404).send({ error: 'Test run not found' });
    }

    if (run.organization_id !== orgId) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    // Find the test result
    const testResult = run.results?.find(r => r.test_id === testId);
    if (!testResult) {
      return reply.status(404).send({ error: 'Test result not found' });
    }

    if (testResult.status !== 'failed' || !testResult.error) {
      return reply.status(400).send({ error: 'Test did not fail or has no error message' });
    }

    // Find the failed step for additional context
    const failedStep = testResult.steps?.find(s => s.status === 'failed');

    // Generate human-readable explanation
    const explanation = generateHumanReadableExplanation(
      testResult.error,
      testResult.test_name,
      failedStep?.action,
      failedStep?.selector
    );

    return {
      test_name: testResult.test_name,
      original_error: testResult.error,
      explanation,
    };
  });

  // ============================================
  // Feature #1084: Technical failure analysis
  // ============================================

  app.get<{
    Params: { runId: string; testId: string };
  }>('/api/v1/ai/technical-analysis/:runId/:testId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const orgId = getOrganizationId(request);

    // Get the test run
    const run = await getTestRunWithFallback(runId);
    if (!run) {
      return reply.status(404).send({ error: 'Test run not found' });
    }

    if (run.organization_id !== orgId) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    // Find the test result
    const testResult = run.results?.find(r => r.test_id === testId);
    if (!testResult) {
      return reply.status(404).send({ error: 'Test result not found' });
    }

    if (testResult.status !== 'failed' || !testResult.error) {
      return reply.status(400).send({ error: 'Test did not fail or has no error message' });
    }

    // Find the failed step for additional context
    const failedStep = testResult.steps?.find(s => s.status === 'failed');

    // Generate technical explanation
    const technicalAnalysis = generateTechnicalExplanation(
      testResult.error,
      testResult.test_name,
      testResult,
      failedStep
    );

    return {
      test_name: testResult.test_name,
      original_error: testResult.error,
      analysis: technicalAnalysis,
    };
  });

  // ============================================
  // Feature #1085: Executive failure summary
  // ============================================

  app.get<{
    Params: { runId: string };
    Querystring: { pattern_type?: string };
  }>('/api/v1/ai/executive-summary/:runId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const { pattern_type } = request.query;
    const orgId = getOrganizationId(request);

    // Get the test run
    const run = await getTestRunWithFallback(runId);
    if (!run) {
      return reply.status(404).send({ error: 'Test run not found' });
    }

    if (run.organization_id !== orgId) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    // Generate executive summary
    const summary = generateExecutiveSummary(run, pattern_type);

    return {
      run_id: runId,
      run_name: (run as any).name || `Test Run ${runId}`,
      generated_at: new Date().toISOString(),
      summary,
    };
  });

  // ============================================
  // Feature #1078-1081: Root cause analysis
  // ============================================

  app.get<{
    Params: { runId: string; testId: string };
  }>('/api/v1/ai/root-cause-analysis/:runId/:testId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const orgId = getOrganizationId(request);

    // Get the test run
    const run = await getTestRunWithFallback(runId);
    if (!run) {
      return reply.status(404).send({ error: 'Test run not found' });
    }

    if (run.organization_id !== orgId) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    // Find the test result
    const testResult = run.results?.find(r => r.test_id === testId);
    if (!testResult) {
      return reply.status(404).send({ error: 'Test result not found' });
    }

    // Get the error message
    const errorMessage = testResult.error || '';

    // Generate comprehensive root cause analysis with AI confidence scoring
    const rootCauseAnalysis = generateRootCauseAnalysis(errorMessage, testResult as any, run as any);

    // Feature #1079: Gather additional evidence artifacts
    const evidenceArtifacts = generateEvidenceArtifacts(errorMessage, testResult as any, run as any);

    // Feature #1080: Generate AI-suggested remediation actions
    const suggestedActions = generateSuggestedActions(
      errorMessage,
      rootCauseAnalysis.primary_cause.id,
      testResult as any,
      run as any
    );

    // Feature #1081: Generate historical pattern matching data
    const historicalPatternMatch = generateHistoricalPatternMatch(
      errorMessage,
      rootCauseAnalysis.primary_cause.id
    );

    return {
      run_id: runId,
      test_id: testId,
      test_name: testResult.test_name,
      status: testResult.status,
      error_message: errorMessage,
      analysis_timestamp: new Date().toISOString(),
      ...rootCauseAnalysis,
      // Feature #1079: Additional evidence artifacts
      artifacts: evidenceArtifacts,
      // Feature #1080: AI-suggested remediation actions
      suggested_actions: suggestedActions,
      // Feature #1081: Historical pattern matching
      historical_pattern: historicalPatternMatch,
    };
  });

  // ============================================
  // Feature #1341: LLM-powered Root Cause Analysis
  // ============================================

  app.get<{
    Params: { runId: string; testId: string };
    Querystring: { force_refresh?: string };
  }>('/api/v1/ai/llm-root-cause-analysis/:runId/:testId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const { force_refresh } = request.query;
    const orgId = getOrganizationId(request);

    // Get the test run
    const run = await getTestRunWithFallback(runId);
    if (!run) {
      return reply.status(404).send({ error: 'Test run not found' });
    }

    if (run.organization_id !== orgId) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    // Find the test result
    const testResult = run.results?.find(r => r.test_id === testId);
    if (!testResult) {
      return reply.status(404).send({ error: 'Test result not found' });
    }

    // Check if test actually failed
    if (testResult.status !== 'failed') {
      return reply.status(400).send({
        error: 'Cannot analyze passing test',
        message: 'LLM root cause analysis is only available for failed tests'
      });
    }

    // Get the error message
    const errorMessage = testResult.error || 'Unknown error';

    // Clear cache if force refresh requested
    if (force_refresh === 'true') {
      const cacheKey = generateErrorHash(errorMessage);
      llmExplanationCache.delete(cacheKey);
    }

    try {
      // Generate LLM-powered analysis
      const analysis = await generateLLMRootCauseAnalysis(
        errorMessage,
        {
          test_id: testId,
          test_name: testResult.test_name,
          status: testResult.status,
          error: testResult.error,
          steps: testResult.steps,
          duration: (testResult as any).duration,
        },
        {
          id: runId,
          browser: run.browser,
          environment: (run as any).environment,
          branch: run.branch,
          created_at: run.created_at instanceof Date ? run.created_at.toISOString() : String(run.created_at),
        }
      );

      return {
        success: true,
        run_id: runId,
        test_id: testId,
        test_name: testResult.test_name,
        analysis,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(500).send({
        error: 'Analysis failed',
        message: `Failed to generate LLM root cause analysis: ${errorMsg}`
      });
    }
  });

  // ============================================
  // Feature #1372: Cache stats endpoint
  // ============================================

  app.get('/api/v1/ai/llm-cache-stats', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    return getLLMCacheStats();
  });
}
