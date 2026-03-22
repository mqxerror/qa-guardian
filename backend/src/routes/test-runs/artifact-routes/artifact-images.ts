/**
 * Artifact Routes - Image Serving
 *
 * Endpoints for serving screenshot, baseline, and diff images.
 * Both binary (image/png) and base64 JSON formats.
 *
 * Feature #1356: Code quality - extracted from test-runs.ts
 */

import { FastifyInstance } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { authenticate, getOrganizationId } from '../../../middleware/auth.js';
import { TRACES_DIR, VIDEOS_DIR } from '../storage.js';
import { getTestRunWithFallback } from '../artifact-types.js';
import { sendError } from '../../../utils/errors.js';

export async function artifactImageRoutes(app: FastifyInstance): Promise<void> {
  // Binary image endpoints

  app.get<{ Params: { runId: string; testId: string } }>('/api/v1/runs/:runId/results/:testId/screenshot', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    const result = run.results?.find(r => r.test_id === testId);
    if (!result || !result.screenshot_base64) {
      return sendError(reply, 404, 'NOT_FOUND', 'Screenshot not found for this test result');
    }

    const imageBuffer = Buffer.from(result.screenshot_base64, 'base64');
    return reply
      .header('Content-Type', 'image/png')
      .header('Content-Length', imageBuffer.length)
      .send(imageBuffer);
  });

  app.get<{ Params: { runId: string; testId: string } }>('/api/v1/runs/:runId/results/:testId/baseline', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    const result = run.results?.find(r => r.test_id === testId);
    if (!result || !result.baseline_screenshot_base64) {
      return sendError(reply, 404, 'NOT_FOUND', 'Baseline screenshot not found for this test result');
    }

    const imageBuffer = Buffer.from(result.baseline_screenshot_base64, 'base64');
    return reply
      .header('Content-Type', 'image/png')
      .header('Content-Length', imageBuffer.length)
      .send(imageBuffer);
  });

  app.get<{ Params: { runId: string; testId: string } }>('/api/v1/runs/:runId/results/:testId/diff', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    const result = run.results?.find(r => r.test_id === testId);
    if (!result || !result.diff_image_base64) {
      return sendError(reply, 404, 'NOT_FOUND', 'Diff image not found for this test result');
    }

    const imageBuffer = Buffer.from(result.diff_image_base64, 'base64');
    return reply
      .header('Content-Type', 'image/png')
      .header('Content-Length', imageBuffer.length)
      .send(imageBuffer);
  });

  // Base64 JSON endpoints (for MCP/AI analysis)

  app.get<{ Params: { runId: string; testId: string } }>('/api/v1/runs/:runId/results/:testId/screenshot/base64', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    const result = run.results?.find(r => r.test_id === testId);
    if (!result || !result.screenshot_base64) {
      return sendError(reply, 404, 'NOT_FOUND', 'Screenshot not found for this test result');
    }

    return {
      screenshot_type: result.status === 'failed' || result.status === 'error' ? 'failure' : 'current',
      run_id: runId,
      test_id: testId,
      test_name: result.test_name,
      test_status: result.status,
      base64_data: result.screenshot_base64,
      mime_type: 'image/png',
      size_bytes: Math.round(result.screenshot_base64.length * 0.75),
      viewport: result.viewport_width && result.viewport_height
        ? { width: result.viewport_width, height: result.viewport_height }
        : null,
      created_at: run.completed_at?.toISOString() || run.started_at?.toISOString(),
    };
  });

  app.get<{ Params: { runId: string; testId: string } }>('/api/v1/runs/:runId/results/:testId/baseline/base64', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    const result = run.results?.find(r => r.test_id === testId);
    if (!result || !result.baseline_screenshot_base64) {
      return sendError(reply, 404, 'NOT_FOUND', 'Baseline screenshot not found for this test result');
    }

    return {
      screenshot_type: 'baseline',
      run_id: runId,
      test_id: testId,
      test_name: result.test_name,
      test_status: result.status,
      base64_data: result.baseline_screenshot_base64,
      mime_type: 'image/png',
      size_bytes: Math.round(result.baseline_screenshot_base64.length * 0.75),
      viewport: result.viewport_width && result.viewport_height
        ? { width: result.viewport_width, height: result.viewport_height }
        : null,
      created_at: run.completed_at?.toISOString() || run.started_at?.toISOString(),
    };
  });

  // Get diff image as base64 JSON for MCP/AI analysis
  app.get<{ Params: { runId: string; testId: string } }>('/api/v1/runs/:runId/results/:testId/diff/base64', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    const result = run.results?.find(r => r.test_id === testId);
    if (!result || !result.diff_image_base64) {
      return sendError(reply, 404, 'NOT_FOUND', 'Diff image not found for this test result');
    }

    return {
      screenshot_type: 'diff',
      run_id: runId,
      test_id: testId,
      test_name: result.test_name,
      test_status: result.status,
      base64_data: result.diff_image_base64,
      mime_type: 'image/png',
      size_bytes: Math.round(result.diff_image_base64.length * 0.75),
      viewport: result.viewport_width && result.viewport_height
        ? { width: result.viewport_width, height: result.viewport_height }
        : null,
      created_at: run.completed_at?.toISOString() || run.started_at?.toISOString(),
    };
  });

  // Get video recording metadata for a test result
  app.get<{ Params: { runId: string; testId: string }; Querystring: { format?: string } }>('/api/v1/runs/:runId/results/:testId/video', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const format = request.query.format || 'webm';
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    const result = run.results?.find(r => r.test_id === testId);
    if (!result) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test result not found');
    }

    if (!result.video_file) {
      return sendError(reply, 404, 'NOT_FOUND', 'No video recording available for this test result.', { video_available: false });
    }

    const videoPath = path.join(VIDEOS_DIR, result.video_file);
    let videoSize = 0;
    let videoExists = false;

    try {
      const stats = fs.statSync(videoPath);
      videoSize = stats.size;
      videoExists = true;
    } catch {
      videoExists = false;
    }

    const testDuration = result.duration_ms || 0;

    return {
      video_available: true,
      run_id: runId,
      test_id: testId,
      test_name: result.test_name,
      test_status: result.status,
      video: {
        url: `/api/v1/artifacts/videos/${result.video_file}`,
        filename: result.video_file,
        format: format === 'mp4' ? 'mp4' : 'webm',
        mime_type: format === 'mp4' ? 'video/mp4' : 'video/webm',
        size_bytes: videoSize,
        file_exists: videoExists,
        duration_ms: testDuration,
        duration_formatted: `${Math.floor(testDuration / 60000)}:${String(Math.floor((testDuration % 60000) / 1000)).padStart(2, '0')}`,
      },
      test_info: {
        browser: result.browser || run.browser || 'chromium',
        viewport: result.viewport_width && result.viewport_height
          ? { width: result.viewport_width, height: result.viewport_height }
          : null,
        started_at: result.started_at instanceof Date ? result.started_at.toISOString() : result.started_at,
        completed_at: result.completed_at instanceof Date ? result.completed_at.toISOString() : result.completed_at,
      },
      playback_notes: format === 'mp4'
        ? 'MP4 format requested. If not available, WebM format will be returned.'
        : 'WebM format is the native recording format from Playwright.',
    };
  });

  // Get Playwright trace file metadata for a test result
  app.get<{ Params: { runId: string; testId: string } }>('/api/v1/runs/:runId/results/:testId/trace', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    const result = run.results?.find(r => r.test_id === testId);
    if (!result) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test result not found');
    }

    if (!result.trace_file) {
      return sendError(reply, 404, 'NOT_FOUND', 'No trace file available for this test result.', { trace_available: false });
    }

    const tracePath = path.join(TRACES_DIR, result.trace_file);
    let traceSize = 0;
    let traceExists = false;

    try {
      const stats = fs.statSync(tracePath);
      traceSize = stats.size;
      traceExists = true;
    } catch {
      traceExists = false;
    }

    return {
      trace_available: true,
      run_id: runId,
      test_id: testId,
      test_name: result.test_name,
      test_status: result.status,
      trace: {
        url: `/api/v1/artifacts/traces/${result.trace_file}`,
        filename: result.trace_file,
        format: 'zip',
        mime_type: 'application/zip',
        size_bytes: traceSize,
        file_exists: traceExists,
      },
      test_info: {
        browser: result.browser || run.browser || 'chromium',
        viewport: result.viewport_width && result.viewport_height
          ? { width: result.viewport_width, height: result.viewport_height }
          : null,
        started_at: result.started_at instanceof Date ? result.started_at.toISOString() : result.started_at,
        completed_at: result.completed_at instanceof Date ? result.completed_at.toISOString() : result.completed_at,
        duration_ms: result.duration_ms,
      },
      viewer_instructions: 'To view the trace, download it and open with: npx playwright show-trace <trace.zip>',
    };
  });
}
