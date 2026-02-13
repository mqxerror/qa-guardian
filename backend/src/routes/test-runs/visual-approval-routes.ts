/**
 * Visual Approval Routes Module (Feature #1356 - Code Quality)
 * Extracted from test-runs.ts to reduce file size
 * Contains: Baseline approval, visual rejection, rejection status, mergeable baselines, baseline merge
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { authenticate, getOrganizationId, JwtPayload } from '../../middleware/auth.js';
import { getTest, getTestSuite } from '../test-suites.js';
import { testRuns, TestRun, TestRunResult } from './execution.js';
import { getTestRun, listTestRunsByOrg as dbListTestRunsByOrg } from '../../services/repositories/test-runs.js';
import { TestSuite, Test } from '../test-suites/types.js';

// Feature #414: Extended save result with quota info
interface SaveResultWithQuota {
  success: boolean;
  isQuotaExceeded?: boolean;
  suggestions?: string[];
}

/**
 * Get a test run with fallback: check in-memory Map first (for in-flight runs), then DB.
 */
async function getTestRunWithFallback(runId: string): Promise<TestRun | undefined> {
  const memRun = testRuns.get(runId);
  if (memRun) return memRun;
  return await getTestRun(runId);
}
import {
  BaselineMetadata,
  RejectionMetadata,
  BASELINES_DIR,
  getBaselineMetadata,
  setBaselineMetadata,
  addBaselineHistoryEntry,
  getBaselinePath,
  getRejectionMetadata,
  setRejectionMetadata,
} from './visual-regression.js';
import { sendBaselineApprovedWebhook } from './webhook-events.js';
import { createLogger } from '../../services/logger.js';

const logger = createLogger('route:test-runs:visual-approval');

// Helper to get user from request (typed via FastifyRequest with optional user field)
function getUser(request: FastifyRequest): JwtPayload | undefined {
  return (request as FastifyRequest & { user?: JwtPayload }).user;
}

// Import saveBaseline from test-runs.ts - we need to re-export it
// Note: This is a local function in test-runs.ts that handles quota checking
// For now, we'll import the simpler version and add quota handling inline
import { saveBaseline as saveBaselineToFile } from './visual-regression.js';

import { sendError } from '../../utils/errors.js';
/**
 * Register visual approval routes
 */
export async function visualApprovalRoutes(app: FastifyInstance) {

  // Approve a new screenshot as the baseline for a test
  // Feature #605: Added expectedVersion for optimistic locking
  app.post<{ Params: { testId: string }; Body: { runId?: string; viewport?: string; branch?: string; expectedVersion?: number } }>('/api/v1/tests/:testId/baseline/approve', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const { runId, viewport: requestedViewport, branch: requestedBranch, expectedVersion } = request.body || {};
    const branch = requestedBranch || 'main';
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;

    // Verify test exists and belongs to user's organization
    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
    }

    // Get the test runs to find the screenshot
    // Filter runs that either have test_id matching, or have results containing this test
    // Merge in-memory runs (in-flight) with DB runs
    // Feature #198: includeResults needed because we filter on r.results and extract test result data
    const dbRuns = await dbListTestRunsByOrg(orgId, { includeResults: true });
    const memRuns = Array.from(testRuns.values()).filter(r => r.organization_id === orgId);
    const seenIds = new Set(memRuns.map(r => r.id));
    const mergedRuns = [...memRuns, ...dbRuns.filter(r => !seenIds.has(r.id))];
    const allTestRuns = mergedRuns.filter(r =>
      r.test_id === testId ||
      r.results?.some(result => result.test_id === testId)
    );

    // Find the specific run or use the most recent one
    let targetRun: TestRun | undefined;
    if (runId) {
      targetRun = allTestRuns.find(r => r.id === runId);
    } else {
      // Get the most recent run
      targetRun = allTestRuns.sort((a, b) => {
        const aTime = a.started_at ? new Date(a.started_at).getTime() : 0;
        const bTime = b.started_at ? new Date(b.started_at).getTime() : 0;
        return bTime - aTime;
      })[0];
    }

    if (!targetRun) {
      return sendError(reply, 404, 'NOT_FOUND', 'No test run found. Run the test first to generate a screenshot.');
    }

    // Find the test result with the screenshot
    const testResult = targetRun.results?.find((r: TestRunResult) => r.test_id === testId);
    if (!testResult || !testResult.screenshot_base64) {
      return sendError(reply, 400, 'BAD_REQUEST', 'No screenshot found in the test run result.');
    }

    // Determine the viewport ID
    const viewportId = requestedViewport || 'single';

    // Feature #605: Optimistic locking - check for concurrent modifications
    const currentMetadata = getBaselineMetadata(testId, viewportId, branch);
    const currentVersion = currentMetadata?.version || 0;

    // If expectedVersion is provided, verify it matches the current version
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      const modifiedBy = currentMetadata?.approvedBy || 'another user';
      const modifiedAt = currentMetadata?.approvedAt ? new Date(currentMetadata.approvedAt).toLocaleString() : 'recently';
      logger.info(`[Visual] Concurrent modification detected for test ${testId}: expected version ${expectedVersion}, current version ${currentVersion}`);
      return sendError(reply, 409, 'CONFLICT', 'Baseline was modified by another user', { details: `The baseline was updated by ${modifiedBy} at ${modifiedAt}. Please refresh and review the changes before continuing.` });
    }

    // Save the screenshot as the new baseline (for this branch)
    const screenshotBuffer = Buffer.from(testResult.screenshot_base64, 'base64');

    // Use the simple save function - quota handling will be done in test-runs.ts saveBaseline wrapper
    const saveResult = saveBaselineToFile(testId, screenshotBuffer, viewportId, branch);

    // Feature #604: Handle storage quota exceeded
    if (!saveResult.success && saveResult.isQuotaExceeded) {
      return sendError(reply, 507, 'ERROR', 'Unable to approve baseline due to storage quota limits.', { isQuotaExceeded: true, suggestions: saveResult.suggestions });
    }

    // Record approval metadata - Feature #266: Include full metadata
    const approvedAt = new Date().toISOString();

    // Feature #605: Increment version for optimistic locking
    const newVersion = currentVersion + 1;

    const metadata: BaselineMetadata = {
      testId,
      viewportId,
      branch,
      approvedBy: user?.email || 'unknown',
      approvedByUserId: user?.id || 'unknown',
      approvedAt,
      sourceRunId: targetRun.id,
      // Feature #266: Track creation metadata (preserve if updating existing baseline)
      createdAt: currentMetadata?.createdAt || approvedAt,
      createdByUserId: currentMetadata?.createdByUserId || user?.id || 'unknown',
      createdByUserEmail: currentMetadata?.createdByUserEmail || user?.email || 'unknown',
      // Feature #266: Record viewport dimensions
      viewport: {
        width: testResult.viewport_width || test.viewport_width || 1280,
        height: testResult.viewport_height || test.viewport_height || 720,
        preset: test.viewport_preset,
      },
      // Feature #266: Record browser info
      browser: {
        name: targetRun.browser || 'chromium',
        version: (targetRun as unknown as Record<string, unknown>).browser_version as string || 'latest',
      },
      // Feature #605: Version for optimistic locking
      version: newVersion,
    };
    setBaselineMetadata(metadata);

    // Save to baseline history for audit trail
    const historyEntry = addBaselineHistoryEntry({
      testId,
      viewportId,
      branch,
      approvedBy: user?.email || 'unknown',
      approvedByUserId: user?.id || 'unknown',
      approvedAt,
      sourceRunId: targetRun.id,
    }, screenshotBuffer);

    logger.info(`[Visual] Baseline approved for test ${testId} branch ${branch} by ${user?.email || 'unknown'} from run ${targetRun.id} (version ${newVersion})`);

    // Feature #1310: Send baseline.approved webhook
    const suiteApprove = await getTestSuite(test.suite_id) as TestSuite | null;
    sendBaselineApprovedWebhook(orgId, {
      test_id: testId,
      test_name: test.name,
      suite_id: test.suite_id,
      suite_name: suiteApprove?.name || 'Unknown Suite',
      project_id: suiteApprove?.project_id || '',
      run_id: targetRun.id,
      viewport_id: viewportId,
      branch,
      approved_by: user?.email || 'unknown',
      approved_by_user_id: user?.id || 'unknown',
      approved_at: approvedAt,
      version: newVersion,
      viewport: metadata.viewport,
      browser: metadata.browser,
    }).catch(err => {
      logger.error('[WEBHOOK] Failed to send baseline.approved webhook:', err);
    });

    return {
      success: true,
      message: 'New baseline approved successfully',
      testId,
      runId: targetRun.id,
      viewport: viewportId,
      branch,
      approvedAt,
      approvedBy: user?.email || 'unknown',
      approvedByUserId: user?.id || 'unknown',
      // Feature #605: Return new version for client-side tracking
      version: newVersion,
    };
  });

  // Feature #14: Convenience route matching frontend's URL pattern
  // Frontend calls POST /api/v1/visual/approve-baseline with { test_id, run_id, viewport_id }
  app.post<{ Body: { test_id: string; run_id?: string; viewport_id?: string } }>('/api/v1/visual/approve-baseline', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { test_id, run_id, viewport_id } = request.body || {};

    if (!test_id) {
      return sendError(reply, 400, 'BAD_REQUEST', 'test_id is required');
    }

    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;

    // Verify test exists and belongs to user's organization
    const test = await getTest(test_id);
    if (!test || test.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
    }

    // Get the test runs to find the screenshot
    // Feature #198: includeResults needed because we filter on r.results and extract test result data
    const dbRuns = await dbListTestRunsByOrg(orgId, { includeResults: true });
    const memRuns = Array.from(testRuns.values()).filter(r => r.organization_id === orgId);
    const seenIds = new Set(memRuns.map(r => r.id));
    const mergedRuns = [...memRuns, ...dbRuns.filter(r => !seenIds.has(r.id))];
    const allTestRuns = mergedRuns.filter(r =>
      r.test_id === test_id ||
      r.results?.some(result => result.test_id === test_id)
    );

    // Find the specific run or use the most recent one
    let targetRun: TestRun | undefined;
    if (run_id) {
      targetRun = allTestRuns.find(r => r.id === run_id);
    } else {
      targetRun = allTestRuns.sort((a, b) => {
        const aTime = a.started_at ? new Date(a.started_at).getTime() : 0;
        const bTime = b.started_at ? new Date(b.started_at).getTime() : 0;
        return bTime - aTime;
      })[0];
    }

    if (!targetRun) {
      return sendError(reply, 404, 'NOT_FOUND', 'No test run found. Run the test first to generate a screenshot.');
    }

    // Find the test result with the screenshot
    const testResult = targetRun.results?.find((r: TestRunResult) => r.test_id === test_id);
    // For multi-viewport tests, the screenshot may be in viewport_results
    let screenshotBase64 = testResult?.screenshot_base64;
    if (!screenshotBase64 && testResult?.viewport_results) {
      const vpResult = viewport_id
        ? testResult.viewport_results.find(v => v.viewportId === viewport_id || v.viewportLabel === viewport_id)
        : testResult.viewport_results[0];
      screenshotBase64 = vpResult?.screenshotBase64;
    }
    if (!testResult || !screenshotBase64) {
      return sendError(reply, 400, 'BAD_REQUEST', 'No screenshot found in the test run result.');
    }

    const viewportId = viewport_id || 'single';
    const branch = 'main';

    // Get current metadata for version tracking
    const currentMetadata = getBaselineMetadata(test_id, viewportId, branch);
    const currentVersion = currentMetadata?.version || 0;
    const newVersion = currentVersion + 1;

    // Save the screenshot as the new baseline
    const screenshotBuffer = Buffer.from(screenshotBase64, 'base64');
    const saveResult = saveBaselineToFile(test_id, screenshotBuffer, viewportId, branch);

    if (!saveResult.success && saveResult.isQuotaExceeded) {
      return sendError(reply, 507, 'ERROR', 'Unable to approve baseline due to storage quota limits.', { isQuotaExceeded: true, suggestions: saveResult.suggestions });
    }

    const approvedAt = new Date().toISOString();
    const metadata: BaselineMetadata = {
      testId: test_id,
      viewportId,
      branch,
      approvedBy: user?.email || 'unknown',
      approvedByUserId: user?.id || 'unknown',
      approvedAt,
      sourceRunId: targetRun.id,
      createdAt: currentMetadata?.createdAt || approvedAt,
      createdByUserId: currentMetadata?.createdByUserId || user?.id || 'unknown',
      createdByUserEmail: currentMetadata?.createdByUserEmail || user?.email || 'unknown',
      viewport: {
        width: testResult.viewport_width || test.viewport_width || 1280,
        height: testResult.viewport_height || test.viewport_height || 720,
        preset: test.viewport_preset,
      },
      browser: {
        name: targetRun.browser || 'chromium',
        version: (targetRun as unknown as Record<string, unknown>).browser_version as string || 'latest',
      },
      version: newVersion,
    };
    setBaselineMetadata(metadata);

    addBaselineHistoryEntry({
      testId: test_id,
      viewportId,
      branch,
      approvedBy: user?.email || 'unknown',
      approvedByUserId: user?.id || 'unknown',
      approvedAt,
      sourceRunId: targetRun.id,
    }, screenshotBuffer);

    logger.info(`[Visual] Baseline approved for test ${test_id} branch ${branch} by ${user?.email || 'unknown'} from run ${targetRun.id} (version ${newVersion})`);

    // Send webhook
    const suiteForWebhook = await getTestSuite(test.suite_id) as TestSuite | null;
    sendBaselineApprovedWebhook(orgId, {
      test_id,
      test_name: test.name,
      suite_id: test.suite_id,
      suite_name: suiteForWebhook?.name || 'Unknown Suite',
      project_id: suiteForWebhook?.project_id || '',
      run_id: targetRun.id,
      viewport_id: viewportId,
      branch,
      approved_by: user?.email || 'unknown',
      approved_by_user_id: user?.id || 'unknown',
      approved_at: approvedAt,
      version: newVersion,
      viewport: metadata.viewport,
      browser: metadata.browser,
    }).catch(err => {
      logger.error('[WEBHOOK] Failed to send baseline.approved webhook:', err);
    });

    return {
      success: true,
      message: 'New baseline approved successfully',
      testId: test_id,
      runId: targetRun.id,
      viewport: viewportId,
      branch,
      approvedAt,
      approvedBy: user?.email || 'unknown',
      version: newVersion,
    };
  });

  // Convenience route for reject baseline (removes the baseline file)
  app.post<{ Body: { test_id: string; run_id?: string; viewport_id?: string; reason?: string } }>('/api/v1/visual/reject-baseline', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { test_id, viewport_id, reason } = request.body || {};
    if (!test_id) {
      return sendError(reply, 400, 'BAD_REQUEST', 'test_id is required');
    }
    const viewportId = viewport_id || 'single';
    const branch = 'main';
    // Remove the baseline file for this test/viewport
    const baselinePath = getBaselinePath(test_id, viewportId, branch);
    try {
      if (fs.existsSync(baselinePath)) {
        fs.unlinkSync(baselinePath);
      }
    } catch (err) {
      logger.error({ err, baselinePath }, '[Visual] Failed to delete baseline');
    }
    logger.info(`[Visual] Baseline rejected for test ${test_id} viewport ${viewportId}${reason ? ` reason: ${reason}` : ''}`);
    return reply.status(200).send({ success: true, message: 'Baseline rejected' });
  });

  // Reject visual changes (mark as regression)
  app.post<{ Params: { testId: string }; Body: { runId: string; viewport?: string; reason?: string } }>('/api/v1/tests/:testId/visual/reject', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const { runId, viewport, reason } = request.body;
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;

    if (!runId) {
      return sendError(reply, 400, 'BAD_REQUEST', 'runId is required');
    }

    // Verify test exists and belongs to user's organization
    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
    }

    // Find the target run
    const targetRun = await getTestRunWithFallback(runId);
    if (!targetRun || targetRun.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    // Find the result for this test
    const testResult = targetRun.results?.find((r: TestRunResult) => r.test_id === testId);
    if (!testResult) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test result not found in the specified run');
    }

    // Record rejection metadata
    const viewportId = viewport || 'single';
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

    logger.info(`[Visual] Visual changes rejected for test ${testId} by ${user?.email || 'unknown'} from run ${runId}${reason ? ` with reason: ${reason}` : ''}`);

    return {
      success: true,
      message: 'Visual changes rejected and marked as regression',
      testId,
      runId,
      viewport: viewportId,
      rejectedAt,
      rejectedBy: user?.email || 'unknown',
      rejectedByUserId: user?.id || 'unknown',
      reason: reason?.trim() || undefined,
      status: 'rejected_regression',
    };
  });

  // Get rejection status for a test run
  app.get<{ Params: { testId: string }; Querystring: { runId: string; viewport?: string } }>('/api/v1/tests/:testId/visual/rejection', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const { runId, viewport } = request.query;
    const orgId = getOrganizationId(request);

    if (!runId) {
      return sendError(reply, 400, 'BAD_REQUEST', 'runId is required');
    }

    // Verify test exists and belongs to user's organization
    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
    }

    const viewportId = viewport || 'single';
    const rejection = getRejectionMetadata(runId, testId, viewportId);

    if (!rejection) {
      return {
        hasRejection: false,
        testId,
        runId,
        viewport: viewportId,
      };
    }

    return {
      hasRejection: true,
      ...rejection,
    };
  });

  // Get mergeable baselines from other branches (for baseline merge after branch merge)
  app.get<{ Params: { testId: string }; Querystring: { targetBranch?: string; viewport?: string } }>('/api/v1/tests/:testId/baseline/mergeable', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const targetBranch = request.query.targetBranch || 'main';
    const viewportId = request.query.viewport || 'single';
    const orgId = getOrganizationId(request);

    // Verify test exists and belongs to user's organization
    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
    }

    // Get metadata for the target branch baseline (if exists)
    const targetMetadata = getBaselineMetadata(testId, viewportId, targetBranch);
    const targetUpdatedAt = targetMetadata?.updatedAt ? new Date(targetMetadata.updatedAt).getTime() : 0;

    // Find other branches with baselines that could be merged
    const mergeableBranches: Array<{
      branch: string;
      updatedAt: string;
      approvedBy?: string;
      isNewer: boolean;
      hasBaseline: boolean;
    }> = [];

    if (fs.existsSync(BASELINES_DIR)) {
      const entries = fs.readdirSync(BASELINES_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'history' && entry.name !== targetBranch) {
          // Check if this branch has a baseline for this test
          const branchDir = path.join(BASELINES_DIR, entry.name);
          const baselineFile = `baseline-${testId}-${viewportId}.png`;
          const baselinePath = path.join(branchDir, baselineFile);

          if (fs.existsSync(baselinePath)) {
            const sourceBranch = entry.name;
            const sourceMetadata = getBaselineMetadata(testId, viewportId, sourceBranch);
            const sourceUpdatedAt = sourceMetadata?.updatedAt ? new Date(sourceMetadata.updatedAt).getTime() : 0;

            // A baseline is mergeable if it exists on another branch
            mergeableBranches.push({
              branch: sourceBranch,
              updatedAt: sourceMetadata?.updatedAt || new Date().toISOString(),
              approvedBy: sourceMetadata?.approvedBy,
              isNewer: sourceUpdatedAt > targetUpdatedAt,
              hasBaseline: true,
            });
          }
        }
      }
    }

    // Sort by update time (newest first)
    mergeableBranches.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return {
      testId,
      targetBranch,
      viewportId,
      targetHasBaseline: !!targetMetadata,
      targetUpdatedAt: targetMetadata?.updatedAt,
      mergeableBranches,
      total: mergeableBranches.length,
    };
  });

  // Merge a baseline from one branch to another (copy baseline from source to target branch)
  app.post<{ Params: { testId: string }; Body: { sourceBranch: string; targetBranch?: string; viewport?: string } }>('/api/v1/tests/:testId/baseline/merge', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const { sourceBranch, targetBranch: requestTargetBranch, viewport: requestViewport } = request.body || {};
    const targetBranch = requestTargetBranch || 'main';
    const viewportId = requestViewport || 'single';
    const user = getUser(request);
    const orgId = getOrganizationId(request);

    // Verify test exists and belongs to user's organization
    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
    }

    if (!sourceBranch) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Source branch is required');
    }

    if (sourceBranch === targetBranch) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Source and target branches must be different');
    }

    // Check that source baseline exists
    const sourceBaselinePath = getBaselinePath(testId, viewportId, sourceBranch);
    if (!fs.existsSync(sourceBaselinePath)) {
      return sendError(reply, 404, 'NOT_FOUND', `No baseline found for test ${testId} on branch '${sourceBranch}'`);
    }

    // Read source baseline
    const sourceBaseline = fs.readFileSync(sourceBaselinePath);
    const sourceMetadata = getBaselineMetadata(testId, viewportId, sourceBranch);

    // Save as target baseline
    const saveResult = saveBaselineToFile(testId, sourceBaseline, viewportId, targetBranch);

    // Feature #604: Handle storage quota exceeded
    if (!saveResult.success && saveResult.isQuotaExceeded) {
      return sendError(reply, 507, 'ERROR', 'Unable to merge baseline due to storage quota limits.', { isQuotaExceeded: true, suggestions: saveResult.suggestions });
    }

    // Update baseline metadata for target branch - Feature #266: Include full metadata
    const now = new Date().toISOString();

    // Get existing target metadata to preserve creation info if it exists
    const existingTargetMetadata = getBaselineMetadata(testId, viewportId, targetBranch);

    const metadata: BaselineMetadata = {
      testId,
      viewportId,
      branch: targetBranch,
      approvedBy: user?.email || 'unknown',
      approvedByUserId: user?.id || 'unknown',
      approvedAt: now,
      sourceRunId: sourceMetadata?.sourceRunId,
      // Feature #266: Preserve original creation metadata or use source's
      createdAt: existingTargetMetadata?.createdAt || sourceMetadata?.createdAt || now,
      createdByUserId: existingTargetMetadata?.createdByUserId || sourceMetadata?.createdByUserId || user?.id || 'unknown',
      createdByUserEmail: existingTargetMetadata?.createdByUserEmail || sourceMetadata?.createdByUserEmail || user?.email || 'unknown',
      // Feature #266: Copy viewport and browser info from source metadata or use defaults
      viewport: sourceMetadata?.viewport || existingTargetMetadata?.viewport || {
        width: test.viewport_width || 1280,
        height: test.viewport_height || 720,
        preset: test.viewport_preset,
      },
      browser: sourceMetadata?.browser || existingTargetMetadata?.browser || {
        name: 'chromium',
        version: 'latest',
      },
    };
    setBaselineMetadata(metadata);

    // Add to baseline history
    const historyEntry = addBaselineHistoryEntry({
      testId,
      viewportId,
      approvedBy: user?.email || 'unknown',
      approvedByUserId: user?.id || 'unknown',
      approvedAt: now,
      sourceRunId: sourceMetadata?.sourceRunId,
      branch: targetBranch,
    }, sourceBaseline);

    logger.info(`[Visual] Baseline merged from branch '${sourceBranch}' to '${targetBranch}' for test ${testId} by ${user?.email || 'unknown'} (version ${historyEntry.version})`);

    return {
      success: true,
      message: `Baseline merged from '${sourceBranch}' to '${targetBranch}'`,
      testId,
      sourceBranch,
      targetBranch,
      viewportId,
      mergedAt: now,
      mergedBy: user?.email,
      version: historyEntry.version,
    };
  });
}
