/**
 * Results Routes Module
 *
 * HTTP routes for test results management:
 * - GET /api/v1/results/search - Search across all test results
 * - GET /api/v1/results/diff - Compare two test results
 * - POST /api/v1/runs/:runId/results/:testId/annotations - Add annotation
 * - GET /api/v1/runs/:runId/results/:testId/annotations - Get annotations
 * - DELETE /api/v1/runs/:runId/results/:testId/annotations/:annotationId - Delete annotation
 * - POST /api/v1/runs/:runId/results/:testId/share - Create share link
 * - GET /api/v1/shared/results/:shareToken - Get shared result
 * - GET /api/v1/runs/:runId/results/:testId/timeline - Get execution timeline
 *
 * Feature #1356: Code quality - extracted from test-runs.ts
 */

import { FastifyInstance } from 'fastify';
import * as crypto from 'crypto';
import { authenticate, getOrganizationId } from '../../middleware/auth';
import { getTestSuite } from '../test-suites';
import { getProject as dbGetProject } from '../projects/stores';
import { testRuns, TestRun } from './execution';
import { getTestRun as dbGetTestRun, listTestRunsByOrg as dbListTestRunsByOrg } from '../../services/repositories/test-runs';

// Helper: get test run from Map first, then fall back to DB
async function getTestRunWithFallback(runId: string): Promise<TestRun | undefined> {
  const fromMap = testRuns.get(runId);
  if (fromMap) return fromMap;
  return await dbGetTestRun(runId) as TestRun | undefined;
}

// In-memory storage for annotations
interface Annotation {
  id: string;
  run_id: string;
  test_id: string;
  text: string;
  type: string;
  priority: string;
  created_at: Date;
  created_by?: string;
}

const annotations = new Map<string, Annotation[]>();

// In-memory storage for shared results
interface SharedResult {
  token: string;
  run_id: string;
  test_id: string;
  organization_id: string;
  expires_at: Date;
  include_artifacts: boolean;
  created_at: Date;
}

const sharedResults = new Map<string, SharedResult>();

/**
 * Register results routes on the Fastify app
 */
export async function resultsRoutes(app: FastifyInstance): Promise<void> {
  // Search across all test results
  app.get<{ Querystring: { query?: string; status?: string; project_id?: string; suite_id?: string; from_date?: string; to_date?: string; limit?: string } }>('/api/v1/results/search', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { query, status, project_id, suite_id, from_date, to_date, limit: limitStr } = request.query;
    const orgId = getOrganizationId(request);

    const limit = Math.min(parseInt(limitStr || '20', 10), 100);

    const fromDate = from_date ? new Date(from_date) : null;
    const toDate = to_date ? new Date(to_date) : null;

    const orgRuns = await dbListTestRunsByOrg(orgId);

    interface SearchResult {
      run_id: string;
      test_id: string;
      test_name: string;
      status: string;
      suite_id: string;
      suite_name: string;
      project_id: string;
      project_name: string;
      error?: string;
      duration_ms?: number;
      created_at: string;
      relevance_score: number;
      match_highlights: string[];
    }

    const results: SearchResult[] = [];
    const queryLower = query?.toLowerCase() || '';

    for (const run of orgRuns) {
      if (fromDate && new Date(run.created_at) < fromDate) continue;
      if (toDate && new Date(run.created_at) > toDate) continue;

      const suite = await getTestSuite(run.suite_id);
      if (!suite) continue;

      if (suite_id && suite.id !== suite_id) continue;
      if (project_id && suite.project_id !== project_id) continue;

      const project = await dbGetProject(suite.project_id);
      const projectName = project?.name || 'Unknown Project';

      if (run.results) {
        for (const result of run.results) {
          if (status && result.status !== status) continue;

          let relevanceScore = 0;
          const matchHighlights: string[] = [];

          if (queryLower) {
            if (result.test_name?.toLowerCase().includes(queryLower)) {
              relevanceScore += 10;
              matchHighlights.push(`Test name: "${result.test_name}"`);
            }

            if (result.error?.toLowerCase().includes(queryLower)) {
              relevanceScore += 20;
              const errorLower = result.error.toLowerCase();
              const idx = errorLower.indexOf(queryLower);
              const start = Math.max(0, idx - 30);
              const end = Math.min(result.error.length, idx + queryLower.length + 30);
              const excerpt = result.error.substring(start, end);
              matchHighlights.push(`Error: "...${excerpt}..."`);
            }

            if (result.steps) {
              for (const step of result.steps) {
                if (step.value?.toLowerCase().includes(queryLower)) {
                  relevanceScore += 5;
                  matchHighlights.push(`Step value: "${step.value}"`);
                  break;
                }
                if (step.error?.toLowerCase().includes(queryLower)) {
                  relevanceScore += 15;
                  matchHighlights.push(`Step error: "${step.error.substring(0, 100)}..."`);
                  break;
                }
              }
            }

            if (relevanceScore === 0) continue;
          } else {
            relevanceScore = 1;
          }

          results.push({
            run_id: run.id,
            test_id: result.test_id,
            test_name: result.test_name,
            status: result.status,
            suite_id: suite.id,
            suite_name: suite.name,
            project_id: suite.project_id,
            project_name: projectName,
            error: result.error,
            duration_ms: result.duration_ms,
            created_at: run.created_at.toISOString(),
            relevance_score: relevanceScore,
            match_highlights: matchHighlights,
          });
        }
      }
    }

    results.sort((a, b) => b.relevance_score - a.relevance_score);
    const limitedResults = results.slice(0, limit);

    return {
      results: limitedResults,
      total_count: results.length,
      returned_count: limitedResults.length,
      query: query || null,
      filters: {
        status: status || null,
        project_id: project_id || null,
        suite_id: suite_id || null,
        from_date: from_date || null,
        to_date: to_date || null,
      },
    };
  });

  // Compare two test results
  app.get<{ Querystring: { base_result_id: string; compare_result_id: string; include_steps?: string } }>('/api/v1/results/diff', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { base_result_id, compare_result_id, include_steps } = request.query;
    const orgId = getOrganizationId(request);
    const includeSteps = include_steps !== 'false';

    // Parse result IDs (format: runId:testId)
    const [baseRunId, baseTestId] = base_result_id.split(':');
    const [compareRunId, compareTestId] = compare_result_id.split(':');

    if (!baseRunId || !baseTestId || !compareRunId || !compareTestId) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid result ID format. Expected format: runId:testId',
      });
    }

    // Get base run
    const baseRun = await getTestRunWithFallback(baseRunId);
    if (!baseRun || baseRun.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Base run ${baseRunId} not found`,
      });
    }

    // Get compare run
    const compareRun = await getTestRunWithFallback(compareRunId);
    if (!compareRun || compareRun.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Compare run ${compareRunId} not found`,
      });
    }

    // Get base result
    const baseResult = baseRun.results?.find(r => r.test_id === baseTestId);
    if (!baseResult) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Base result ${baseTestId} not found in run ${baseRunId}`,
      });
    }

    // Get compare result
    const compareResult = compareRun.results?.find(r => r.test_id === compareTestId);
    if (!compareResult) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Compare result ${compareTestId} not found in run ${compareRunId}`,
      });
    }

    // Calculate differences
    const statusChanged = baseResult.status !== compareResult.status;
    const durationDiff = (compareResult.duration_ms || 0) - (baseResult.duration_ms || 0);
    const durationPercentChange = baseResult.duration_ms
      ? ((durationDiff / baseResult.duration_ms) * 100).toFixed(2)
      : null;

    // Compare steps if requested
    let stepDiff = null;
    if (includeSteps && baseResult.steps && compareResult.steps) {
      const baseSteps = baseResult.steps;
      const compareSteps = compareResult.steps;

      const addedSteps = compareSteps.filter(
        cs => !baseSteps.find(bs => bs.action === cs.action && bs.selector === cs.selector)
      );
      const removedSteps = baseSteps.filter(
        bs => !compareSteps.find(cs => cs.action === bs.action && cs.selector === bs.selector)
      );
      const changedSteps = compareSteps.filter(cs => {
        const bs = baseSteps.find(b => b.action === cs.action && b.selector === cs.selector);
        return bs && (bs.status !== cs.status || bs.value !== cs.value);
      }).map(cs => {
        const bs = baseSteps.find(b => b.action === cs.action && b.selector === cs.selector)!;
        return {
          action: cs.action,
          selector: cs.selector,
          base_status: bs.status,
          compare_status: cs.status,
          base_value: bs.value,
          compare_value: cs.value,
        };
      });

      stepDiff = {
        added_count: addedSteps.length,
        removed_count: removedSteps.length,
        changed_count: changedSteps.length,
        added: addedSteps.map(s => ({ action: s.action, selector: s.selector })),
        removed: removedSteps.map(s => ({ action: s.action, selector: s.selector })),
        changed: changedSteps,
      };
    }

    // Compare errors
    const errorChanged = baseResult.error !== compareResult.error;

    return {
      comparison: {
        base: {
          result_id: base_result_id,
          run_id: baseRunId,
          test_id: baseTestId,
          test_name: baseResult.test_name,
          status: baseResult.status,
          duration_ms: baseResult.duration_ms,
          error: baseResult.error,
          created_at: baseRun.created_at.toISOString(),
        },
        compare: {
          result_id: compare_result_id,
          run_id: compareRunId,
          test_id: compareTestId,
          test_name: compareResult.test_name,
          status: compareResult.status,
          duration_ms: compareResult.duration_ms,
          error: compareResult.error,
          created_at: compareRun.created_at.toISOString(),
        },
      },
      differences: {
        status_changed: statusChanged,
        status_transition: statusChanged
          ? `${baseResult.status} → ${compareResult.status}`
          : null,
        duration_diff_ms: durationDiff,
        duration_percent_change: durationPercentChange,
        duration_trend: durationDiff > 0 ? 'slower' : durationDiff < 0 ? 'faster' : 'unchanged',
        error_changed: errorChanged,
        step_diff: stepDiff,
      },
      summary: {
        is_regression: baseResult.status === 'passed' && compareResult.status === 'failed',
        is_improvement: baseResult.status === 'failed' && compareResult.status === 'passed',
        performance_impact: durationPercentChange
          ? parseFloat(durationPercentChange) > 10
            ? 'significant_slowdown'
            : parseFloat(durationPercentChange) < -10
              ? 'significant_speedup'
              : 'minimal'
          : 'unknown',
      },
    };
  });

  // Add annotation to a test result
  app.post<{ Params: { runId: string; testId: string }; Body: { text: string; type?: string; priority?: string } }>('/api/v1/runs/:runId/results/:testId/annotations', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const { text, type = 'note', priority = 'normal' } = request.body;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    const result = run.results?.find(r => r.test_id === testId);
    if (!result) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test result not found',
      });
    }

    const annotation: Annotation = {
      id: `ann-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      run_id: runId,
      test_id: testId,
      text,
      type,
      priority,
      created_at: new Date(),
    };

    const key = `${runId}:${testId}`;
    if (!annotations.has(key)) {
      annotations.set(key, []);
    }
    annotations.get(key)!.push(annotation);

    return reply.status(201).send({
      annotation: {
        id: annotation.id,
        run_id: annotation.run_id,
        test_id: annotation.test_id,
        text: annotation.text,
        type: annotation.type,
        priority: annotation.priority,
        created_at: annotation.created_at.toISOString(),
      },
      message: 'Annotation created successfully',
    });
  });

  // Get annotations for a test result
  app.get<{ Params: { runId: string; testId: string } }>('/api/v1/runs/:runId/results/:testId/annotations', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    const key = `${runId}:${testId}`;
    const resultAnnotations = annotations.get(key) || [];

    return {
      annotations: resultAnnotations.map(a => ({
        id: a.id,
        run_id: a.run_id,
        test_id: a.test_id,
        text: a.text,
        type: a.type,
        priority: a.priority,
        created_at: a.created_at.toISOString(),
      })),
      count: resultAnnotations.length,
    };
  });

  // Delete annotation
  app.delete<{ Params: { runId: string; testId: string; annotationId: string } }>('/api/v1/runs/:runId/results/:testId/annotations/:annotationId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId, annotationId } = request.params;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    const key = `${runId}:${testId}`;
    const resultAnnotations = annotations.get(key);

    if (!resultAnnotations) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Annotation not found',
      });
    }

    const index = resultAnnotations.findIndex(a => a.id === annotationId);
    if (index === -1) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Annotation not found',
      });
    }

    resultAnnotations.splice(index, 1);

    return {
      deleted: true,
      message: 'Annotation deleted successfully',
    };
  });

  // Create share link for a test result
  app.post<{ Params: { runId: string; testId: string }; Body: { expires_in_hours?: number; include_artifacts?: boolean } }>('/api/v1/runs/:runId/results/:testId/share', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const { expires_in_hours = 24, include_artifacts = true } = request.body || {};
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    const result = run.results?.find(r => r.test_id === testId);
    if (!result) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test result not found',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000);

    const shared: SharedResult = {
      token,
      run_id: runId,
      test_id: testId,
      organization_id: orgId,
      expires_at: expiresAt,
      include_artifacts,
      created_at: new Date(),
    };

    sharedResults.set(token, shared);

    const baseUrl = `${request.protocol}://${request.headers.host}`;

    return reply.status(201).send({
      share_token: token,
      share_url: `${baseUrl}/api/v1/shared/results/${token}`,
      expires_at: expiresAt.toISOString(),
      include_artifacts,
      message: 'Share link created successfully',
    });
  });

  // Get shared result
  app.get<{ Params: { shareToken: string } }>('/api/v1/shared/results/:shareToken', {
    // No authentication required for shared results
  }, async (request, reply) => {
    const { shareToken } = request.params;

    const shared = sharedResults.get(shareToken);
    if (!shared) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Share link not found or expired',
      });
    }

    if (new Date() > shared.expires_at) {
      sharedResults.delete(shareToken);
      return reply.status(410).send({
        error: 'Gone',
        message: 'Share link has expired',
      });
    }

    const run = await getTestRunWithFallback(shared.run_id);
    if (!run) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    const result = run.results?.find(r => r.test_id === shared.test_id);
    if (!result) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test result not found',
      });
    }

    const suite = await getTestSuite(run.suite_id);
    const project = suite ? await dbGetProject(suite.project_id) : null;

    return {
      shared_by: 'QA Guardian',
      expires_at: shared.expires_at.toISOString(),
      result: {
        run_id: run.id,
        test_id: result.test_id,
        test_name: result.test_name,
        status: result.status,
        duration_ms: result.duration_ms,
        error: result.error,
        suite_name: suite?.name || 'Unknown',
        project_name: project?.name || 'Unknown',
        browser: run.browser,
        started_at: result.started_at,
        completed_at: result.completed_at,
        steps: result.steps,
      },
      artifacts: shared.include_artifacts ? {
        has_screenshot: !!result.screenshot_base64,
        has_video: !!result.video_file,
        has_trace: !!result.trace_file,
      } : undefined,
    };
  });

  // Get execution timeline for a test result
  app.get<{ Params: { runId: string; testId: string }; Querystring: { bottleneck_threshold_ms?: string; include_network?: string } }>('/api/v1/runs/:runId/results/:testId/timeline', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const { bottleneck_threshold_ms, include_network } = request.query;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    const result = run.results?.find(r => r.test_id === testId);
    if (!result) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Result with test_id ${testId} not found in run ${runId}`,
      });
    }

    const bottleneckThresholdMs = parseInt(bottleneck_threshold_ms || '1000', 10);
    const includeNetwork = include_network === 'true';

    const steps = result.steps || [];
    const totalDurationMs = result.duration_ms || 0;

    interface TimelineEntry {
      index: number;
      type: 'step' | 'network' | 'wait';
      action?: string;
      selector?: string;
      value?: string;
      status?: string;
      start_offset_ms: number;
      duration_ms: number;
      end_offset_ms: number;
      percentage_of_total: number;
      is_bottleneck: boolean;
      error?: string;
      url?: string;
      method?: string;
      response_time_ms?: number;
    }

    const timeline: TimelineEntry[] = [];
    let currentOffset = 0;
    let slowestStepIndex = -1;
    let slowestStepDuration = 0;
    let totalStepDuration = 0;
    let bottleneckCount = 0;

    steps.forEach((step: any, index: number) => {
      const stepDuration = step.duration_ms || 0;
      const endOffset = currentOffset + stepDuration;
      const percentageOfTotal = totalDurationMs > 0 ? (stepDuration / totalDurationMs) * 100 : 0;
      const isBottleneck = stepDuration >= bottleneckThresholdMs;

      if (stepDuration > slowestStepDuration) {
        slowestStepDuration = stepDuration;
        slowestStepIndex = index;
      }
      totalStepDuration += stepDuration;
      if (isBottleneck) bottleneckCount++;

      timeline.push({
        index,
        type: 'step',
        action: step.action,
        selector: step.selector,
        value: step.value,
        status: step.status,
        start_offset_ms: currentOffset,
        duration_ms: stepDuration,
        end_offset_ms: endOffset,
        percentage_of_total: parseFloat(percentageOfTotal.toFixed(2)),
        is_bottleneck: isBottleneck,
        error: step.error,
      });

      currentOffset = endOffset;
    });

    const networkEntries: TimelineEntry[] = [];
    if (includeNetwork && result.network_logs) {
      const networkLogs = result.network_logs as any[];
      networkLogs.forEach((entry: any, index: number) => {
        const responseTime = entry.response_time_ms || entry.duration_ms || 0;
        const isBottleneck = responseTime >= bottleneckThresholdMs;
        if (isBottleneck) bottleneckCount++;

        networkEntries.push({
          index,
          type: 'network',
          url: entry.url,
          method: entry.method,
          response_time_ms: responseTime,
          start_offset_ms: 0,
          duration_ms: responseTime,
          end_offset_ms: responseTime,
          percentage_of_total: totalDurationMs > 0 ? parseFloat(((responseTime / totalDurationMs) * 100).toFixed(2)) : 0,
          is_bottleneck: isBottleneck,
          status: entry.status?.toString(),
        });
      });
    }

    const overheadMs = Math.max(0, totalDurationMs - totalStepDuration);
    const overheadPercentage = totalDurationMs > 0 ? (overheadMs / totalDurationMs) * 100 : 0;

    const bottleneckSteps = timeline
      .filter(entry => entry.is_bottleneck)
      .map(entry => ({
        index: entry.index,
        action: entry.action,
        duration_ms: entry.duration_ms,
        percentage_of_total: entry.percentage_of_total,
      }));

    const timelineBarWidth = 50;
    const visualTimeline = timeline.map(entry => {
      const barLength = Math.round((entry.percentage_of_total / 100) * timelineBarWidth);
      const bar = '█'.repeat(Math.max(1, barLength));
      const indicator = entry.is_bottleneck ? '🔴' : entry.status === 'passed' ? '🟢' : entry.status === 'failed' ? '🔴' : '⚪';
      return `${indicator} [${entry.index.toString().padStart(2, '0')}] ${bar} ${entry.action || 'unknown'} (${entry.duration_ms}ms, ${entry.percentage_of_total}%)`;
    }).join('\n');

    return {
      run_id: runId,
      test_id: testId,
      test_name: result.test_name,
      status: result.status,
      total_duration_ms: totalDurationMs,
      started_at: result.started_at,
      completed_at: result.completed_at,
      timeline,
      network_entries: includeNetwork ? networkEntries : undefined,
      summary: {
        total_steps: steps.length,
        total_step_duration_ms: totalStepDuration,
        overhead_ms: overheadMs,
        overhead_percentage: parseFloat(overheadPercentage.toFixed(2)),
        bottleneck_threshold_ms: bottleneckThresholdMs,
        bottleneck_count: bottleneckCount,
        slowest_step: slowestStepIndex >= 0 ? {
          index: slowestStepIndex,
          action: timeline[slowestStepIndex]?.action,
          duration_ms: slowestStepDuration,
          percentage_of_total: timeline[slowestStepIndex]?.percentage_of_total,
        } : null,
        average_step_duration_ms: steps.length > 0 ? parseFloat((totalStepDuration / steps.length).toFixed(2)) : 0,
      },
      bottlenecks: {
        count: bottleneckSteps.length,
        steps: bottleneckSteps,
        recommendations: bottleneckSteps.length > 0 ? [
          'Consider optimizing slow selectors by using more specific or faster locators',
          'Add explicit waits only where necessary to reduce wait times',
          'Check for slow network requests that may be blocking test execution',
          'Consider running tests in parallel to reduce overall execution time',
        ] : ['No bottlenecks detected. Test execution is optimized.'],
      },
      visual_timeline: visualTimeline,
    };
  });
}

// Export stores for external access if needed
export { annotations, sharedResults };
