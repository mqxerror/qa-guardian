/**
 * Artifact Routes - Listing
 *
 * Endpoints for listing artifacts and screenshots for a test run.
 * Feature #1356: Code quality - extracted from test-runs.ts
 */

import { FastifyInstance } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { authenticate, getOrganizationId } from '../../../middleware/auth.js';
import { TRACES_DIR, VIDEOS_DIR } from '../storage.js';
import {
  getTestRunWithFallback,
  ArtifactInfo,
  ScreenshotInfo,
} from '../artifact-types.js';
import { sendError } from '../../../utils/errors.js';
import { getServerPort } from './helpers.js';

export async function artifactListingRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { runId: string }; Querystring: { artifact_type?: string } }>('/api/v1/runs/:runId/artifacts', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const { artifact_type } = request.query;
    const orgId = getOrganizationId(request);

    // Verify run exists and belongs to user's organization
    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    // Check if run has results
    if (!run.results || run.results.length === 0) {
      return {
        artifacts: [],
        count: 0,
        run_id: runId,
      };
    }

    // Collect all artifacts from test results (using ArtifactInfo from types module)
    const artifacts: ArtifactInfo[] = [];

    // Build base URL
    const hostname = request.hostname.includes(':') ? request.hostname.split(':')[0] : request.hostname;
    const port = getServerPort(request.server);
    const baseUrl = `${request.protocol}://${hostname}:${port}`;

    for (const result of run.results) {
      const sanitizedTestName = result.test_name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const viewportInfo = result.viewport_width && result.viewport_height
        ? `_${result.viewport_width}x${result.viewport_height}`
        : '';
      const runIdShort = runId.slice(-8);

      // Add screenshot artifact if exists
      if (result.screenshot_base64) {
        const screenshotId = `${runId}-${result.test_id}-screenshot`;
        artifacts.push({
          id: screenshotId,
          type: 'screenshot',
          name: `${sanitizedTestName}${viewportInfo}_${runIdShort}_screenshot.png`,
          test_id: result.test_id,
          test_name: result.test_name,
          url: `${baseUrl}/api/v1/runs/${runId}/results/${result.test_id}/screenshot`,
          size_bytes: Math.round(result.screenshot_base64.length * 0.75),
          mime_type: 'image/png',
          created_at: run.completed_at?.toISOString() || run.started_at?.toISOString(),
        });
      }

      // Add trace artifact if exists
      if (result.trace_file) {
        const tracePath = path.join(TRACES_DIR, result.trace_file);
        let sizeBytes: number | undefined;
        if (fs.existsSync(tracePath)) {
          try {
            const stat = fs.statSync(tracePath);
            sizeBytes = stat.size;
          } catch {
            // Ignore stat errors
          }
        }

        const traceId = `${runId}-${result.test_id}-trace`;
        artifacts.push({
          id: traceId,
          type: 'trace',
          name: `${sanitizedTestName}_trace.zip`,
          test_id: result.test_id,
          test_name: result.test_name,
          url: `${baseUrl}/api/v1/runs/${runId}/traces/${result.trace_file}`,
          size_bytes: sizeBytes,
          mime_type: 'application/zip',
          created_at: run.completed_at?.toISOString() || run.started_at?.toISOString(),
        });
      }

      // Add video artifact if exists
      if (result.video_file) {
        const videoPath = path.join(VIDEOS_DIR, result.video_file);
        let sizeBytes: number | undefined;
        if (fs.existsSync(videoPath)) {
          try {
            const stat = fs.statSync(videoPath);
            sizeBytes = stat.size;
          } catch {
            // Ignore stat errors
          }
        }

        const videoId = `${runId}-${result.test_id}-video`;
        artifacts.push({
          id: videoId,
          type: 'video',
          name: `${sanitizedTestName}_video.webm`,
          test_id: result.test_id,
          test_name: result.test_name,
          url: `${baseUrl}/api/v1/runs/${runId}/videos/${result.video_file}`,
          size_bytes: sizeBytes,
          mime_type: 'video/webm',
          created_at: run.completed_at?.toISOString() || run.started_at?.toISOString(),
        });
      }

      // Add baseline screenshot if exists
      if (result.baseline_screenshot_base64) {
        const baselineId = `${runId}-${result.test_id}-baseline`;
        artifacts.push({
          id: baselineId,
          type: 'screenshot',
          name: `${sanitizedTestName}${viewportInfo}_${runIdShort}_baseline.png`,
          test_id: result.test_id,
          test_name: result.test_name,
          url: `${baseUrl}/api/v1/runs/${runId}/results/${result.test_id}/baseline`,
          size_bytes: Math.round(result.baseline_screenshot_base64.length * 0.75),
          mime_type: 'image/png',
          created_at: run.completed_at?.toISOString() || run.started_at?.toISOString(),
        });
      }

      // Add diff image if exists
      if (result.diff_image_base64) {
        const diffId = `${runId}-${result.test_id}-diff`;
        artifacts.push({
          id: diffId,
          type: 'screenshot',
          name: `${sanitizedTestName}${viewportInfo}_${runIdShort}_diff.png`,
          test_id: result.test_id,
          test_name: result.test_name,
          url: `${baseUrl}/api/v1/runs/${runId}/results/${result.test_id}/diff`,
          size_bytes: Math.round(result.diff_image_base64.length * 0.75),
          mime_type: 'image/png',
          created_at: run.completed_at?.toISOString() || run.started_at?.toISOString(),
        });
      }
    }

    // Filter by artifact type if specified
    const filteredArtifacts = artifact_type
      ? artifacts.filter(a => a.type === artifact_type)
      : artifacts;

    return {
      artifacts: filteredArtifacts,
      count: filteredArtifacts.length,
      run_id: runId,
      total_count: artifacts.length,
    };
  });

  // Get screenshots with step index information for MCP get_screenshots tool
  app.get<{
    Params: { runId: string };
    Querystring: {
      test_id?: string;
      include_baseline?: string;
      include_diff?: string;
    }
  }>('/api/v1/runs/:runId/screenshots', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const { test_id, include_baseline = 'true', include_diff = 'true' } = request.query;
    const orgId = getOrganizationId(request);

    // Verify run exists and belongs to user's organization
    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    // Check if run has results
    if (!run.results || run.results.length === 0) {
      return {
        screenshots: [],
        count: 0,
        run_id: runId,
        run_status: run.status,
      };
    }

    // Build base URL
    const hostname = request.hostname.includes(':') ? request.hostname.split(':')[0] : request.hostname;
    const port = getServerPort(request.server);
    const baseUrl = `${request.protocol}://${hostname}:${port}`;

    // Use ScreenshotInfo from types module
    const screenshots: ScreenshotInfo[] = [];

    // Filter results by test_id if specified
    const resultsToProcess = test_id
      ? run.results.filter(r => r.test_id === test_id)
      : run.results;

    for (const result of resultsToProcess) {
      const isFailure = result.status === 'failed' || result.status === 'error';
      const viewport = result.viewport_width && result.viewport_height
        ? { width: result.viewport_width, height: result.viewport_height }
        : undefined;
      const createdAt = run.completed_at?.toISOString() || run.started_at?.toISOString();

      // Add main screenshot
      if (result.screenshot_base64) {
        screenshots.push({
          id: `${runId}-${result.test_id}-current`,
          test_id: result.test_id,
          test_name: result.test_name,
          screenshot_type: isFailure ? 'failure' : 'current',
          url: `${baseUrl}/api/v1/runs/${runId}/results/${result.test_id}/screenshot`,
          size_bytes: Math.round(result.screenshot_base64.length * 0.75),
          viewport,
          is_failure_screenshot: isFailure,
          test_status: result.status,
          created_at: createdAt,
        });
      }

      // Add baseline screenshot if requested
      if (include_baseline === 'true' && result.baseline_screenshot_base64) {
        screenshots.push({
          id: `${runId}-${result.test_id}-baseline`,
          test_id: result.test_id,
          test_name: result.test_name,
          screenshot_type: 'baseline',
          url: `${baseUrl}/api/v1/runs/${runId}/results/${result.test_id}/baseline`,
          size_bytes: Math.round(result.baseline_screenshot_base64.length * 0.75),
          viewport,
          is_failure_screenshot: false,
          test_status: result.status,
          created_at: createdAt,
        });
      }

      // Add diff image if requested
      if (include_diff === 'true' && result.diff_image_base64) {
        screenshots.push({
          id: `${runId}-${result.test_id}-diff`,
          test_id: result.test_id,
          test_name: result.test_name,
          screenshot_type: 'diff',
          url: `${baseUrl}/api/v1/runs/${runId}/results/${result.test_id}/diff`,
          size_bytes: Math.round(result.diff_image_base64.length * 0.75),
          viewport,
          is_failure_screenshot: isFailure,
          test_status: result.status,
          created_at: createdAt,
        });
      }

      // Add step screenshots if available
      if (result.steps && Array.isArray(result.steps)) {
        result.steps.forEach((step, index) => {
          if (step.screenshot || step.screenshot_path || step.screenshot_base64) {
            const stepScreenshot: ScreenshotInfo = {
              id: `${runId}-${result.test_id}-step-${index}`,
              test_id: result.test_id,
              test_name: result.test_name,
              screenshot_type: 'step',
              step_index: index,
              step_action: step.action || step.name,
              url: `${baseUrl}/api/v1/runs/${runId}/results/${result.test_id}/steps/${index}/screenshot`,
              viewport,
              is_failure_screenshot: step.status === 'failed',
              test_status: result.status,
              created_at: createdAt,
            };
            screenshots.push(stepScreenshot);
          }
        });
      }
    }

    // Sort screenshots by test_id and step_index
    screenshots.sort((a, b) => {
      if (a.test_id !== b.test_id) {
        return a.test_id.localeCompare(b.test_id);
      }
      const typeOrder = { 'current': 0, 'failure': 0, 'baseline': 1, 'diff': 2, 'step': 3 };
      const aOrder = typeOrder[a.screenshot_type];
      const bOrder = typeOrder[b.screenshot_type];
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return (a.step_index ?? 0) - (b.step_index ?? 0);
    });

    return {
      screenshots,
      count: screenshots.length,
      run_id: runId,
      run_status: run.status,
      filters_applied: {
        test_id: test_id || null,
        include_baseline: include_baseline === 'true',
        include_diff: include_diff === 'true',
      },
      summary: {
        total_tests: resultsToProcess.length,
        failure_screenshots: screenshots.filter(s => s.is_failure_screenshot).length,
        current_screenshots: screenshots.filter(s => s.screenshot_type === 'current' || s.screenshot_type === 'failure').length,
        baseline_screenshots: screenshots.filter(s => s.screenshot_type === 'baseline').length,
        diff_screenshots: screenshots.filter(s => s.screenshot_type === 'diff').length,
        step_screenshots: screenshots.filter(s => s.screenshot_type === 'step').length,
      },
    };
  });
}
