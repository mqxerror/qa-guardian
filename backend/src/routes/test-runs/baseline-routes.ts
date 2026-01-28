/**
 * Baseline Routes Module (Feature #1356)
 *
 * Handles visual testing baseline management routes including:
 * - Baseline retrieval and metadata
 * - Baseline history management
 * - Baseline approval and rejection
 * - Visual pending changes
 * - Batch operations for baselines
 * - Branch management for baselines
 *
 * Extracted from test-runs.ts as part of code quality improvement.
 */

import { FastifyInstance } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { authenticate, getOrganizationId, JwtPayload } from '../../middleware/auth';
import { getTest } from '../test-suites';
import { testRuns } from './execution';
import {
  getBaselinePath,
  getBaselineMetadata,
  setBaselineMetadata,
  getBaselineHistory,
  getBaselineHistoryEntry,
  getBaselineHistoryImage,
  addBaselineHistoryEntry,
  BASELINES_DIR,
  BaselineMetadata,
  getRejectionMetadata,
  setRejectionMetadata,
  loadBaseline,
} from './visual-regression';

// Types for failed uploads
export interface FailedUpload {
  id: string;
  testId: string;
  viewportId: string;
  branch: string;
  targetPath: string;
  screenshotBuffer: Buffer;
  error: string;
  attemptCount: number;
  createdAt: Date;
  organizationId: string;
}

// In-memory store for failed uploads
export const failedUploads: Map<string, FailedUpload> = new Map();

// Default upload config for retries
const DEFAULT_UPLOAD_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
};

// Screenshot save helper (matches the one in test-runs.ts)
async function saveScreenshotWithRetry(
  targetPath: string,
  buffer: Buffer,
  config = DEFAULT_UPLOAD_CONFIG
): Promise<{ success: boolean; attempts: number; error?: string }> {
  let attempts = 0;
  let lastError: Error | null = null;

  while (attempts < config.maxRetries) {
    attempts++;
    try {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(targetPath, buffer);
      return { success: true, attempts };
    } catch (error) {
      lastError = error as Error;
      if (attempts < config.maxRetries) {
        const delay = Math.min(config.initialDelayMs * Math.pow(2, attempts - 1), config.maxDelayMs);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return { success: false, attempts, error: lastError?.message || 'Unknown error' };
}

/**
 * Register baseline routes
 */
export async function baselineRoutes(app: FastifyInstance): Promise<void> {
  // Get baseline for a test
  app.get<{ Params: { testId: string }; Querystring: { viewport?: string; branch?: string } }>('/api/v1/tests/:testId/baseline', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const requestedViewport = request.query.viewport;
    const requestedBranch = request.query.branch || 'main';
    const orgId = getOrganizationId(request);

    // Verify test exists and belongs to user's organization
    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    // Check if baseline exists - try requested viewport first, then fallback to common patterns
    let baselinePath: string;
    let viewport: string;

    if (requestedViewport) {
      // Specific viewport requested
      baselinePath = getBaselinePath(testId, requestedViewport, requestedBranch);
      viewport = requestedViewport;
    } else {
      // No viewport specified - try common patterns: 'single' (most common), then 'default'
      const singlePath = getBaselinePath(testId, 'single', requestedBranch);
      const defaultPath = getBaselinePath(testId, 'default', requestedBranch);

      if (fs.existsSync(singlePath)) {
        baselinePath = singlePath;
        viewport = 'single';
      } else if (fs.existsSync(defaultPath)) {
        baselinePath = defaultPath;
        viewport = 'default';
      } else {
        // Try to find any baseline for this test in the branch directory
        const baselineDir = path.dirname(getBaselinePath(testId, 'single', requestedBranch));
        const baselinePattern = `baseline-${testId}-`;
        const files = fs.existsSync(baselineDir) ? fs.readdirSync(baselineDir) : [];
        const matchingFile = files.find(f => f.startsWith(baselinePattern));

        if (matchingFile) {
          baselinePath = path.join(baselineDir, matchingFile);
          viewport = matchingFile.replace(baselinePattern, '').replace('.png', '');
        } else {
          return reply.status(404).send({
            error: 'Not Found',
            message: `No baseline exists for this test on branch '${requestedBranch}' yet. Run the test once to create a baseline.`,
            hasBaseline: false,
            branch: requestedBranch,
          });
        }
      }
    }

    if (!fs.existsSync(baselinePath)) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `No baseline exists for this test on branch '${requestedBranch}' yet. Run the test once to create a baseline.`,
        hasBaseline: false,
        branch: requestedBranch,
      });
    }

    // Get file stats for metadata
    const stats = fs.statSync(baselinePath);

    // Get approval metadata if available
    const approvalMetadata = getBaselineMetadata(testId, viewport, requestedBranch);

    // Return baseline info or the image based on Accept header
    const acceptHeader = request.headers.accept || '';
    if (acceptHeader.includes('application/json')) {
      // Return metadata
      const baselineBuffer = fs.readFileSync(baselinePath);
      const baselineBase64 = baselineBuffer.toString('base64');

      return {
        hasBaseline: true,
        testId,
        viewport,
        branch: requestedBranch,
        createdAt: stats.mtime.toISOString(),
        size: stats.size,
        image: baselineBase64,
        // Include approval metadata if available
        approvedBy: approvalMetadata?.approvedBy,
        approvedByUserId: approvalMetadata?.approvedByUserId,
        approvedAt: approvalMetadata?.approvedAt,
        sourceRunId: approvalMetadata?.sourceRunId,
        // Feature #605: Include version for optimistic locking
        version: approvalMetadata?.version || 0,
        // Feature #266: Include full baseline metadata
        metadata: approvalMetadata ? {
          createdAt: approvalMetadata.createdAt,
          createdByUserId: approvalMetadata.createdByUserId,
          createdByUserEmail: approvalMetadata.createdByUserEmail,
          viewport: approvalMetadata.viewport,
          browser: approvalMetadata.browser,
        } : null,
      };
    }

    // Serve the image file directly
    const fileStream = fs.createReadStream(baselinePath);
    const response = reply
      .header('Content-Type', 'image/png')
      .header('Content-Length', stats.size)
      .header('X-Baseline-Created', stats.mtime.toISOString())
      .header('X-Baseline-Branch', requestedBranch);

    // Include approval info in headers if available
    if (approvalMetadata) {
      response.header('X-Baseline-Approved-By', approvalMetadata.approvedBy);
      response.header('X-Baseline-Approved-At', approvalMetadata.approvedAt);
      // Feature #605: Include version for optimistic locking
      response.header('X-Baseline-Version', String(approvalMetadata.version || 0));
    }

    return response.send(fileStream);
  });

  // Check if baseline exists for a test (lightweight check without returning image)
  app.head<{ Params: { testId: string }; Querystring: { viewport?: string; branch?: string } }>('/api/v1/tests/:testId/baseline', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const requestedViewport = request.query.viewport;
    const requestedBranch = request.query.branch || 'main';
    const orgId = getOrganizationId(request);

    // Verify test exists and belongs to user's organization
    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return reply.status(404).send();
    }

    // Check if baseline exists - try requested viewport first, then fallback to common patterns
    let baselinePath: string;

    if (requestedViewport) {
      baselinePath = getBaselinePath(testId, requestedViewport, requestedBranch);
    } else {
      // No viewport specified - try common patterns: 'single' (most common), then 'default'
      const singlePath = getBaselinePath(testId, 'single', requestedBranch);
      const defaultPath = getBaselinePath(testId, 'default', requestedBranch);

      if (fs.existsSync(singlePath)) {
        baselinePath = singlePath;
      } else if (fs.existsSync(defaultPath)) {
        baselinePath = defaultPath;
      } else {
        return reply.status(404).send();
      }
    }

    if (!fs.existsSync(baselinePath)) {
      return reply.status(404).send();
    }

    const stats = fs.statSync(baselinePath);
    return reply
      .header('Content-Type', 'image/png')
      .header('Content-Length', stats.size)
      .header('X-Baseline-Exists', 'true')
      .status(200)
      .send();
  });

  // Get baseline history for a test
  app.get<{ Params: { testId: string }; Querystring: { viewport?: string; branch?: string } }>('/api/v1/tests/:testId/baseline/history', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const viewport = request.query.viewport || 'default';
    const branch = request.query.branch || 'main';
    const orgId = getOrganizationId(request);

    // Verify test exists and belongs to user's organization
    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    const history = getBaselineHistory(testId, viewport, branch);

    return {
      testId,
      viewport,
      branch,
      history,
      count: history.length,
    };
  });

  // Get a specific history entry
  app.get<{ Params: { testId: string; historyId: string }; Querystring: { viewport?: string; branch?: string; format?: string } }>('/api/v1/tests/:testId/baseline/history/:historyId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId, historyId } = request.params;
    const viewport = request.query.viewport || 'default';
    const branch = request.query.branch || 'main';
    const format = request.query.format || 'json';
    const orgId = getOrganizationId(request);

    // Verify test exists and belongs to user's organization
    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    const entry = getBaselineHistoryEntry(testId, viewport, historyId, branch);
    if (!entry) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'History entry not found',
      });
    }

    if (format === 'image') {
      const imageBuffer = getBaselineHistoryImage(entry);
      if (!imageBuffer) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'History image not found',
        });
      }
      return reply
        .header('Content-Type', 'image/png')
        .send(imageBuffer);
    }

    return {
      testId,
      viewport,
      branch,
      entry,
    };
  });

  // Compare a history entry with current baseline
  app.get<{ Params: { testId: string; historyId: string }; Querystring: { viewport?: string; branch?: string } }>('/api/v1/tests/:testId/baseline/history/:historyId/compare', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId, historyId } = request.params;
    const viewport = request.query.viewport || 'default';
    const branch = request.query.branch || 'main';
    const orgId = getOrganizationId(request);

    // Verify test exists and belongs to user's organization
    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    const entry = getBaselineHistoryEntry(testId, viewport, historyId, branch);
    if (!entry) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'History entry not found',
      });
    }

    // Get current baseline
    const currentBaselinePath = getBaselinePath(testId, viewport, branch);
    if (!fs.existsSync(currentBaselinePath)) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Current baseline not found',
      });
    }

    // Get history image
    const historyImage = getBaselineHistoryImage(entry);
    if (!historyImage) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'History image not found',
      });
    }

    const currentImage = fs.readFileSync(currentBaselinePath);

    return {
      testId,
      viewport,
      branch,
      historyEntry: entry,
      currentImage: currentImage.toString('base64'),
      historyImage: historyImage.toString('base64'),
    };
  });

  // Restore a history entry as the current baseline
  app.post<{ Params: { testId: string; historyId: string }; Body: { viewport?: string; branch?: string } }>('/api/v1/tests/:testId/baseline/history/:historyId/restore', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId, historyId } = request.params;
    const viewport = request.body.viewport || 'default';
    const branch = request.body.branch || 'main';
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;

    // Verify test exists and belongs to user's organization
    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    const entry = getBaselineHistoryEntry(testId, viewport, historyId, branch);
    if (!entry) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'History entry not found',
      });
    }

    // Get history image
    const historyImage = getBaselineHistoryImage(entry);
    if (!historyImage) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'History image not found',
      });
    }

    // Save history image as current baseline
    const baselinePath = getBaselinePath(testId, viewport, branch);
    const baselineDir = path.dirname(baselinePath);
    if (!fs.existsSync(baselineDir)) {
      fs.mkdirSync(baselineDir, { recursive: true });
    }
    fs.writeFileSync(baselinePath, historyImage);

    // Update metadata
    const now = new Date().toISOString();
    const existingMetadata = getBaselineMetadata(testId, viewport, branch);
    const metadata: BaselineMetadata = {
      testId,
      viewportId: viewport,
      branch,
      approvedBy: user.email,
      approvedByUserId: user.id,
      approvedAt: now,
      sourceRunId: entry.sourceRunId,
      createdAt: now,
      createdByUserId: user.id,
      createdByUserEmail: user.email,
      version: (existingMetadata?.version || 0) + 1,
      viewport: existingMetadata?.viewport || {
        width: 1920,
        height: 1080,
        preset: test.viewport_preset,
      },
      browser: existingMetadata?.browser || { name: 'chromium', version: 'latest' },
    };
    setBaselineMetadata(metadata);

    // Add to history - need to read the current baseline buffer for history
    const currentBaselineBuffer = fs.readFileSync(baselinePath);
    const newEntry = addBaselineHistoryEntry({
      testId,
      viewportId: viewport,
      approvedBy: user.email,
      approvedByUserId: user.id,
      sourceRunId: entry.sourceRunId,
      branch,
      approvedAt: now,
    }, currentBaselineBuffer);

    console.log(`[Visual] Baseline restored from history ${historyId} for test ${testId} by ${user.email} (version ${newEntry.version})`);

    return {
      success: true,
      message: 'Baseline restored from history',
      testId,
      viewport,
      branch,
      restoredFromVersion: entry.version,
      newVersion: newEntry.version,
      restoredAt: now,
      restoredBy: user.email,
    };
  });

  // List failed screenshot uploads for the organization
  app.get('/api/v1/visual/failed-uploads', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);

    // Filter failed uploads by organization
    const orgFailedUploads = Array.from(failedUploads.values())
      .filter(upload => upload.organizationId === orgId)
      .map(upload => ({
        id: upload.id,
        testId: upload.testId,
        viewportId: upload.viewportId,
        branch: upload.branch,
        targetPath: upload.targetPath,
        error: upload.error,
        attemptCount: upload.attemptCount,
        createdAt: upload.createdAt.toISOString(),
        canRetry: true,
      }));

    return {
      failedUploads: orgFailedUploads,
      count: orgFailedUploads.length,
    };
  });

  // Retry a failed screenshot upload
  app.post<{ Params: { uploadId: string } }>('/api/v1/visual/failed-uploads/:uploadId/retry', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { uploadId } = request.params;
    const orgId = getOrganizationId(request);

    const failedUpload = failedUploads.get(uploadId);
    if (!failedUpload) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Failed upload not found',
      });
    }

    // Verify organization ownership
    if (failedUpload.organizationId !== orgId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Access denied to this upload',
      });
    }

    console.log(`[Visual] Manual retry requested for failed upload ${uploadId}`);

    // Attempt to save the screenshot again with retry logic
    const result = await saveScreenshotWithRetry(
      failedUpload.targetPath,
      failedUpload.screenshotBuffer,
      { ...DEFAULT_UPLOAD_CONFIG, maxRetries: 3 }
    );

    if (result.success) {
      // Remove from failed uploads
      failedUploads.delete(uploadId);
      console.log(`[Visual] Manual retry successful for upload ${uploadId}`);

      return {
        success: true,
        message: 'Screenshot uploaded successfully',
        uploadId,
        attempts: result.attempts,
      };
    }

    // Update attempt count
    failedUpload.attemptCount += result.attempts;
    failedUpload.error = result.error || 'Retry failed';

    return reply.status(500).send({
      error: 'Upload Failed',
      message: result.error || 'Failed to upload screenshot - network error',
      uploadId,
      attemptCount: failedUpload.attemptCount,
      canRetry: true,
    });
  });

  // Delete a failed upload
  app.delete<{ Params: { uploadId: string } }>('/api/v1/visual/failed-uploads/:uploadId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { uploadId } = request.params;
    const orgId = getOrganizationId(request);

    const failedUpload = failedUploads.get(uploadId);
    if (!failedUpload) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Failed upload not found',
      });
    }

    // Verify organization ownership
    if (failedUpload.organizationId !== orgId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Access denied to this upload',
      });
    }

    failedUploads.delete(uploadId);

    return {
      success: true,
      message: 'Failed upload dismissed',
      uploadId,
    };
  });

  // NOTE: GET /api/v1/visual/storage is defined in visual-storage-routes.ts
  // Feature #1927: Removed duplicate route definition

  // Delete baseline for a test
  app.delete<{ Params: { testId: string }; Querystring: { viewport?: string; branch?: string } }>('/api/v1/tests/:testId/baseline', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const viewport = request.query.viewport || 'default';
    const branch = request.query.branch || 'main';
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;

    // Verify test exists and belongs to user's organization
    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    const baselinePath = getBaselinePath(testId, viewport, branch);
    if (!fs.existsSync(baselinePath)) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Baseline not found',
      });
    }

    fs.unlinkSync(baselinePath);

    console.log(`[Visual] Baseline deleted for test ${testId} (viewport: ${viewport}, branch: ${branch}) by ${user.email}`);

    return {
      success: true,
      message: 'Baseline deleted',
      testId,
      viewport,
      branch,
      deletedBy: user.email,
      deletedAt: new Date().toISOString(),
    };
  });

  // Get available branches for a test's baselines
  app.get<{ Params: { testId: string } }>('/api/v1/tests/:testId/baseline/branches', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const orgId = getOrganizationId(request);

    // Verify test exists and belongs to user's organization
    const test = await getTest(testId);
    if (!test || test.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    const branches: string[] = [];
    if (fs.existsSync(BASELINES_DIR)) {
      const files = fs.readdirSync(BASELINES_DIR);
      for (const file of files) {
        const branchPath = path.join(BASELINES_DIR, file);
        if (fs.statSync(branchPath).isDirectory()) {
          // Check if there's a baseline for this test in this branch
          const testBaselinePath = path.join(branchPath, `baseline-${testId}-single.png`);
          const testDefaultPath = path.join(branchPath, `baseline-${testId}-default.png`);
          if (fs.existsSync(testBaselinePath) || fs.existsSync(testDefaultPath)) {
            branches.push(file);
          }
        }
      }
    }

    return {
      testId,
      branches,
      count: branches.length,
    };
  });
}
