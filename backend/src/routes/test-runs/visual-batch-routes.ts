/**
 * Visual Batch Routes Module (Feature #1356 - Code Quality)
 *
 * Extracted from test-runs.ts for better maintainability.
 * Contains routes for visual regression batch operations:
 * - Pending visual changes listing
 * - Batch approve/reject operations
 * - Mock data for testing (DEV)
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId, JwtPayload } from '../../middleware/auth';
import { getTest, getTestSuite, getTestsMap, getTestSuitesMap } from '../test-suites';
import { getProject as dbGetProject } from '../projects/stores';
import {
  BaselineMetadata,
  RejectionMetadata,
  getBaselineMetadata,
  setBaselineMetadata,
  getRejectionMetadata,
  setRejectionMetadata,
  saveBaseline,
} from './visual-regression';

// Import testRuns store from execution module
import { testRuns, TestRun } from './execution';
import { getTestRun, listTestRunsByOrg as dbListTestRunsByOrg } from '../../services/repositories/test-runs';

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

// Types for route parameters
interface PendingQueryParams {
  project_id?: string;
}

interface MockPendingBody {
  count: number;
  test_id?: string;
}

interface BatchChangeItem {
  runId: string;
  testId: string;
  viewport?: string;
}

interface BatchApproveBody {
  changes: BatchChangeItem[];
}

interface BatchRejectBody {
  changes: BatchChangeItem[];
  reason?: string;
}

// Extended result type for batch operations
interface BatchResult {
  runId: string;
  testId: string;
  success: boolean;
  error?: string;
  isQuotaExceeded?: boolean;
  suggestions?: string[];
}

/**
 * Register visual batch operation routes
 */
export async function visualBatchRoutes(app: FastifyInstance) {

  // Get all pending visual changes (diff_detected) for the organization
  app.get<{ Querystring: PendingQueryParams }>('/api/v1/visual/pending', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const { project_id } = request.query;

    // Find all test runs with visual regression tests that have diff_detected status
    const pendingChanges: Array<{
      runId: string;
      testId: string;
      testName: string;
      projectId?: string;
      projectName?: string;
      suiteId: string;
      suiteName?: string;
      diffPercentage?: number;
      screenshot?: string;
      baselineScreenshot?: string;
      diffImage?: string;
      startedAt?: string;
      viewport?: string;
    }> = [];

    // Iterate through all test runs (merged in-memory + DB)
    const allRuns = await getMergedTestRuns(orgId);
    for (const run of allRuns) {
      const runId = run.id;
      if (run.organization_id !== orgId) continue;
      if (run.status !== 'failed') continue; // Only look at failed runs
      if (!run.results) continue;

      for (const result of run.results) {
        // Check if this is a visual regression test with diff detected
        if (result.visual_comparison &&
            result.visual_comparison.diffPercentage !== undefined &&
            result.visual_comparison.diffPercentage > 0 &&
            result.status === 'failed') {

          // Get test info
          const test = await getTest(result.test_id);
          if (!test || test.test_type !== 'visual_regression') continue;

          // Filter by project if specified
          const suite = await getTestSuite(run.suite_id);
          if (project_id && suite?.project_id !== project_id) continue;

          // Get project info
          const project = suite?.project_id ? await dbGetProject(suite.project_id) : undefined;

          // Check if already rejected
          const rejection = getRejectionMetadata(runId, result.test_id, 'single');
          if (rejection) continue; // Skip if already rejected

          pendingChanges.push({
            runId,
            testId: result.test_id,
            testName: result.test_name,
            projectId: suite?.project_id,
            projectName: project?.name,
            suiteId: run.suite_id,
            suiteName: suite?.name,
            diffPercentage: result.visual_comparison.diffPercentage,
            screenshot: result.screenshot_base64,
            baselineScreenshot: result.baseline_screenshot_base64,
            diffImage: result.diff_image_base64,
            startedAt: typeof run.started_at === 'string' ? run.started_at : run.started_at?.toISOString(),
            viewport: 'single', // Default viewport
          });
        }
      }
    }

    // Sort by started_at descending (most recent first)
    pendingChanges.sort((a, b) => {
      const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return bTime - aTime;
    });

    return {
      pending: pendingChanges,
      total: pendingChanges.length,
    };
  });

  // Feature #481: Get count of pending visual approvals for sidebar badge
  app.get<{ Querystring: PendingQueryParams }>('/api/v1/visual/pending/count', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const { project_id } = request.query;

    let count = 0;

    // Count test runs with visual regression tests that have diff_detected status
    const allRunsForCount = await getMergedTestRuns(orgId);
    for (const run of allRunsForCount) {
      const runId = run.id;
      if (run.organization_id !== orgId) continue;
      if (run.status !== 'failed') continue;
      if (!run.results) continue;

      for (const result of run.results) {
        if (result.visual_comparison &&
            result.visual_comparison.diffPercentage !== undefined &&
            result.visual_comparison.diffPercentage > 0 &&
            result.status === 'failed') {

          const test = await getTest(result.test_id);
          if (!test || test.test_type !== 'visual_regression') continue;

          // Filter by project if specified
          const suite = await getTestSuite(run.suite_id);
          if (project_id && suite?.project_id !== project_id) continue;

          // Check if already rejected
          const rejection = getRejectionMetadata(runId, result.test_id, 'single');
          if (rejection) continue;

          count++;
        }
      }
    }

    return {
      count,
      has_pending: count > 0,
    };
  });

  // DEV ONLY: Create mock pending visual changes for testing the badge
  app.post<{ Body: MockPendingBody }>('/api/v1/visual/pending/mock', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { count = 5, test_id: requestTestId } = request.body || {};
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;

    // Find a visual regression test in this org
    let visualTestId: string | null = null;
    let suiteId: string | null = null;

    // If specific test_id provided, use that
    if (requestTestId) {
      const test = await getTest(requestTestId);
      if (test && test.organization_id === orgId && test.test_type === 'visual_regression') {
        visualTestId = requestTestId;
        suiteId = test.suite_id;
      }
    } else {
      // Otherwise find the first visual regression test
      for (const [testId, test] of (await getTestsMap())) {
        if (test.organization_id === orgId && test.test_type === 'visual_regression') {
          visualTestId = testId;
          // Find the suite
          for (const [sid, suite] of (await getTestSuitesMap())) {
            if (suite.id === test.suite_id) {
              suiteId = sid;
              break;
            }
          }
          break;
        }
      }
    }

    if (!visualTestId || !suiteId) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No visual regression test found in this organization. Create one first.',
      });
    }

    // Create mock test runs with visual diff detected
    const createdRuns: string[] = [];
    for (let i = 0; i < count; i++) {
      const runId = `mock-visual-run-${Date.now()}-${i}`;
      const testRun: any = {
        id: runId,
        suite_id: suiteId,
        organization_id: orgId,
        status: 'failed' as const,
        trigger: 'manual' as const,
        triggered_by: user.id,
        created_at: new Date(),
        started_at: new Date(),
        completed_at: new Date(),
        results: [{
          test_id: visualTestId,
          status: 'failed' as const,
          duration_ms: 1000,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          visual_comparison: {
            diffPercentage: 5 + Math.random() * 10, // 5-15% diff
            mismatchedPixels: Math.floor(1000 + Math.random() * 5000),
            comparisonStatus: 'diff_detected',
            message: `Mock diff detected: ${(5 + Math.random() * 10).toFixed(2)}%`,
          },
          steps: [{
            index: 0,
            name: 'Visual Comparison',
            status: 'failed',
            duration_ms: 1000,
            error: 'Visual difference detected',
          }],
        }],
        summary: {
          total: 1,
          passed: 0,
          failed: 1,
          skipped: 0,
        },
      };
      testRuns.set(runId, testRun);
      createdRuns.push(runId);
    }

    return {
      message: `Created ${count} mock pending visual changes`,
      run_ids: createdRuns,
    };
  });

  // DEV ONLY: Clear mock pending visual changes
  app.delete('/api/v1/visual/pending/mock', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    let deletedCount = 0;

    // Delete all mock runs for this org (only from in-memory, mock runs are transient)
    for (const [runId, run] of testRuns.entries()) {
      if (run.organization_id === orgId && runId.startsWith('mock-visual-run-')) {
        testRuns.delete(runId);
        deletedCount++;
      }
    }

    return {
      message: `Deleted ${deletedCount} mock pending visual changes`,
      deleted_count: deletedCount,
    };
  });

  // Batch approve multiple visual changes
  app.post<{ Body: BatchApproveBody }>('/api/v1/visual/batch-approve', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { changes } = request.body;
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;

    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'changes array is required and must not be empty',
      });
    }

    const results: BatchResult[] = [];

    for (const change of changes) {
      const { runId, testId, viewport } = change;
      const viewportId = viewport || 'single';

      try {
        // Verify test exists and belongs to user's organization
        const test = await getTest(testId);
        if (!test || test.organization_id !== orgId) {
          results.push({ runId, testId, success: false, error: 'Test not found' });
          continue;
        }

        // Find the target run
        const targetRun = await getTestRunWithFallback(runId);
        if (!targetRun || targetRun.organization_id !== orgId) {
          results.push({ runId, testId, success: false, error: 'Test run not found' });
          continue;
        }

        // Find the test result with the screenshot
        const testResult = targetRun.results?.find((r: any) => r.test_id === testId);
        if (!testResult || !testResult.screenshot_base64) {
          results.push({ runId, testId, success: false, error: 'No screenshot found' });
          continue;
        }

        // Save the screenshot as the new baseline
        const screenshotBuffer = Buffer.from(testResult.screenshot_base64, 'base64');
        const branch = targetRun.branch || 'main';
        const saveResult = saveBaseline(testId, screenshotBuffer, viewportId, branch);

        // Feature #604: Handle storage quota exceeded
        if (!saveResult.success && saveResult.isQuotaExceeded) {
          results.push({
            runId,
            testId,
            success: false,
            error: 'Storage quota exceeded',
            isQuotaExceeded: true,
            suggestions: saveResult.suggestions,
          });
          continue;
        }

        // Record approval metadata - Feature #266: Include full metadata
        const approvedAt = new Date().toISOString();

        // Get existing metadata to preserve createdAt if it exists
        const existingMetadata = getBaselineMetadata(testId, viewportId, branch);

        const metadata: BaselineMetadata = {
          testId,
          viewportId,
          branch,
          approvedBy: user?.email || 'unknown',
          approvedByUserId: user?.id || 'unknown',
          approvedAt,
          sourceRunId: targetRun.id,
          // Feature #266: Track creation metadata (preserve if updating existing baseline)
          createdAt: existingMetadata?.createdAt || approvedAt,
          createdByUserId: existingMetadata?.createdByUserId || user?.id || 'unknown',
          createdByUserEmail: existingMetadata?.createdByUserEmail || user?.email || 'unknown',
          viewport: {
            width: (test as any).viewport_width || 1280,
            height: (test as any).viewport_height || 720,
            preset: (test as any).viewport_preset,
          },
          browser: {
            name: (typeof targetRun.browser === 'string' ? targetRun.browser : (targetRun.browser as any)?.name) || 'chromium',
            version: typeof targetRun.browser === 'object' ? (targetRun.browser as any)?.version : undefined,
          },
          // Feature #605: Increment version for optimistic locking
          version: (existingMetadata?.version || 0) + 1,
        };
        setBaselineMetadata(metadata);

        // Update the run status to reflect approval
        targetRun.status = 'visual_approved';
        testRuns.set(runId, targetRun);

        console.log(`[Visual] Batch: Visual changes approved for test ${testId} by ${user?.email || 'unknown'} from run ${runId}`);
        results.push({ runId, testId, success: true });
      } catch (error) {
        console.error(`[Visual] Batch approve error for test ${testId}:`, error);
        results.push({ runId, testId, success: false, error: 'Internal error' });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return {
      success: true,
      message: `Batch approved ${successCount} of ${changes.length} visual changes`,
      results,
      summary: {
        total: changes.length,
        successful: successCount,
        failed: failedCount,
      },
    };
  });

  // Batch reject multiple visual changes
  app.post<{ Body: BatchRejectBody }>('/api/v1/visual/batch-reject', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { changes, reason } = request.body;
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;

    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'changes array is required and must not be empty',
      });
    }

    const results: BatchResult[] = [];

    for (const change of changes) {
      const { runId, testId, viewport } = change;
      const viewportId = viewport || 'single';

      try {
        // Verify test exists and belongs to user's organization
        const test = await getTest(testId);
        if (!test || test.organization_id !== orgId) {
          results.push({ runId, testId, success: false, error: 'Test not found' });
          continue;
        }

        // Find the target run
        const targetRun = await getTestRunWithFallback(runId);
        if (!targetRun || targetRun.organization_id !== orgId) {
          results.push({ runId, testId, success: false, error: 'Test run not found' });
          continue;
        }

        // Record rejection metadata
        const rejectedAt = new Date().toISOString();
        const metadata: RejectionMetadata = {
          testId,
          viewportId,
          runId,
          rejectedBy: user?.email || 'unknown',
          rejectedByUserId: user?.id || 'unknown',
          rejectedAt,
          reason: reason?.trim() || undefined,
          status: 'rejected_regression',
        };
        setRejectionMetadata(metadata);

        // Mark the run as visually rejected (remove from pending queue)
        targetRun.status = 'visual_rejected';
        testRuns.set(runId, targetRun);

        console.log(`[Visual] Batch: Visual changes rejected for test ${testId} by ${user?.email || 'unknown'} from run ${runId}${reason ? ` with reason: ${reason}` : ''}`);
        results.push({ runId, testId, success: true });
      } catch (error) {
        console.error(`[Visual] Batch reject error for test ${testId}:`, error);
        results.push({ runId, testId, success: false, error: 'Internal error' });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return {
      success: true,
      message: `Batch rejected ${successCount} of ${changes.length} visual changes`,
      results,
      summary: {
        total: changes.length,
        successful: successCount,
        failed: failedCount,
      },
      reason: reason?.trim() || undefined,
    };
  });
}
