/**
 * Artifact Routes Module - Test artifact management routes
 * Feature #1356: Code quality - extracted from test-runs.ts
 */

import { FastifyInstance } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { authenticate, getOrganizationId } from '../../middleware/auth';
import { getTestSuite, getTestSuitesMap } from '../test-suites';
import { getProject as dbGetProject } from '../projects/stores';
import { TRACES_DIR, VIDEOS_DIR } from './storage';
import { testRuns, TestRun } from './execution';
import { getTestRun as dbGetTestRun, listTestRunsByOrg as dbListTestRunsByOrg } from '../../services/repositories/test-runs';

// Helper: get test run from Map first, then fall back to DB
async function getTestRunWithFallback(runId: string): Promise<TestRun | undefined> {
  const fromMap = testRuns.get(runId);
  if (fromMap) return fromMap;
  return await dbGetTestRun(runId) as TestRun | undefined;
}

/**
 * Register artifact routes on the Fastify app
 */
export async function artifactRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { fileName: string } }>('/api/v1/traces/:fileName', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { fileName } = request.params;
    const orgId = getOrganizationId(request);

    // Security: Ensure filename doesn't contain path traversal
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid file name',
      });
    }

    const tracePath = path.join(TRACES_DIR, fileName);

    // Check if file exists
    if (!fs.existsSync(tracePath)) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Trace file not found',
      });
    }

    // Extract runId from filename to verify organization ownership
    // Filename format: trace-{runId}-{testId}-{timestamp}.zip
    const parts = fileName.split('-');
    if (parts.length >= 2 && parts[1]) {
      const runId: string = parts[1];
      const run = await getTestRunWithFallback(runId);
      if (run && run.organization_id !== orgId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You do not have access to this trace file',
        });
      }
    }

    // Serve the file
    const fileStream = fs.createReadStream(tracePath);
    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="${fileName}"`)
      .send(fileStream);
  });

  app.get<{ Params: { fileName: string } }>('/api/v1/videos/:fileName', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { fileName } = request.params;
    const orgId = getOrganizationId(request);

    // Security: Ensure filename doesn't contain path traversal
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid file name',
      });
    }

    const videoPath = path.join(VIDEOS_DIR, fileName);

    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Video file not found',
      });
    }

    // Extract runId from filename to verify organization ownership
    // Filename format: video-{runId}-{testId}-{timestamp}.webm
    const parts = fileName.split('-');
    if (parts.length >= 2 && parts[1]) {
      const runId: string = parts[1];
      const run = await getTestRunWithFallback(runId);
      if (run && run.organization_id !== orgId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You do not have access to this video file',
        });
      }
    }

    // Get file stats for Content-Length
    const stats = fs.statSync(videoPath);
    const fileSize = stats.size;

    // Support range requests for seeking
    const rangeHeader = request.headers.range;
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0] ?? '0', 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(videoPath, { start, end });

      return reply
        .status(206)
        .header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
        .header('Accept-Ranges', 'bytes')
        .header('Content-Length', chunkSize)
        .header('Content-Type', 'video/webm')
        .send(fileStream);
    }

    // Serve the full file
    const fileStream = fs.createReadStream(videoPath);
    return reply
      .header('Content-Type', 'video/webm')
      .header('Content-Length', fileSize)
      .header('Accept-Ranges', 'bytes')
      .send(fileStream);
  });

  app.get<{ Params: { runId: string; fileName: string } }>('/api/v1/runs/:runId/videos/:fileName', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, fileName } = request.params;
    const orgId = getOrganizationId(request);

    // Security: Ensure filename doesn't contain path traversal
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid file name',
      });
    }

    // Verify run exists and belongs to user's organization
    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    const videoPath = path.join(VIDEOS_DIR, fileName);

    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Video file not found',
      });
    }

    // Get file stats for Content-Length
    const stats = fs.statSync(videoPath);
    const fileSize = stats.size;

    // Support range requests for seeking
    const rangeHeader = request.headers.range;
    if (rangeHeader) {
      const rangeParts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(rangeParts[0] ?? '0', 10);
      const end = rangeParts[1] ? parseInt(rangeParts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(videoPath, { start, end });

      return reply
        .status(206)
        .header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
        .header('Accept-Ranges', 'bytes')
        .header('Content-Length', chunkSize)
        .header('Content-Type', 'video/webm')
        .send(fileStream);
    }

    // Serve the full file
    const fileStream = fs.createReadStream(videoPath);
    return reply
      .header('Content-Type', 'video/webm')
      .header('Content-Length', fileSize)
      .header('Accept-Ranges', 'bytes')
      .send(fileStream);
  });

  app.get<{ Params: { runId: string; fileName: string } }>('/api/v1/runs/:runId/traces/:fileName', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, fileName } = request.params;
    const orgId = getOrganizationId(request);

    // Security: Ensure filename doesn't contain path traversal
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid file name',
      });
    }

    // Verify run exists and belongs to user's organization
    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    const tracePath = path.join(TRACES_DIR, fileName);

    // Check if file exists
    if (!fs.existsSync(tracePath)) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Trace file not found',
      });
    }

    // Get file stats for Content-Length
    const stats = fs.statSync(tracePath);
    const fileSize = stats.size;

    // Traces are zip files - set headers for download
    const fileStream = fs.createReadStream(tracePath);
    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Length', fileSize)
      .header('Content-Disposition', `attachment; filename="${fileName}"`)
      .send(fileStream);
  });

  app.get<{ Params: { runId: string }; Querystring: { artifact_type?: string } }>('/api/v1/runs/:runId/artifacts', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const { artifact_type } = request.query;
    const orgId = getOrganizationId(request);

    // Verify run exists and belongs to user's organization
    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    // Check if run has results
    if (!run.results || run.results.length === 0) {
      return {
        artifacts: [],
        count: 0,
        run_id: runId,
      };
    }

    // Collect all artifacts from test results
    const artifacts: {
      id: string;
      type: 'screenshot' | 'video' | 'trace' | 'log';
      name: string;
      test_id: string;
      test_name: string;
      url: string;
      size_bytes?: number;
      mime_type: string;
      created_at?: string;
    }[] = [];

    // Build base URL
    const hostname = request.hostname.includes(':') ? request.hostname.split(':')[0] : request.hostname;
    const port = (request.server as any)?.server?.address?.()?.port || 3001;
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
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
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
    const port = (request.server as any)?.server?.address?.()?.port || 3001;
    const baseUrl = `${request.protocol}://${hostname}:${port}`;

    interface ScreenshotInfo {
      id: string;
      test_id: string;
      test_name: string;
      screenshot_type: 'current' | 'baseline' | 'diff' | 'failure' | 'step';
      step_index?: number;
      step_action?: string;
      url: string;
      size_bytes?: number;
      viewport?: { width: number; height: number };
      is_failure_screenshot: boolean;
      // Feature #2053: Added 'warning' status for accessibility tests
      test_status: 'passed' | 'failed' | 'error' | 'skipped' | 'warning';
      created_at?: string;
    }

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
      const resultAny = result as any;
      if (resultAny.step_results && Array.isArray(resultAny.step_results)) {
        resultAny.step_results.forEach((step: any, index: number) => {
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

  app.get<{ Params: { runId: string; testId: string } }>('/api/v1/runs/:runId/results/:testId/screenshot', {
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

    const result = run.results?.find(r => r.test_id === testId);
    if (!result || !result.screenshot_base64) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Screenshot not found for this test result',
      });
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
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    const result = run.results?.find(r => r.test_id === testId);
    if (!result || !result.baseline_screenshot_base64) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Baseline screenshot not found for this test result',
      });
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
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    const result = run.results?.find(r => r.test_id === testId);
    if (!result || !result.diff_image_base64) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Diff image not found for this test result',
      });
    }

    const imageBuffer = Buffer.from(result.diff_image_base64, 'base64');
    return reply
      .header('Content-Type', 'image/png')
      .header('Content-Length', imageBuffer.length)
      .send(imageBuffer);
  });

  app.get<{ Params: { runId: string; testId: string } }>('/api/v1/runs/:runId/results/:testId/screenshot/base64', {
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

    const result = run.results?.find(r => r.test_id === testId);
    if (!result || !result.screenshot_base64) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Screenshot not found for this test result',
      });
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
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    const result = run.results?.find(r => r.test_id === testId);
    if (!result || !result.baseline_screenshot_base64) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Baseline screenshot not found for this test result',
      });
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
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    const result = run.results?.find(r => r.test_id === testId);
    if (!result || !result.diff_image_base64) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Diff image not found for this test result',
      });
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

  // Get video recording for a test result
  app.get<{ Params: { runId: string; testId: string }; Querystring: { format?: string } }>('/api/v1/runs/:runId/results/:testId/video', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const format = request.query.format || 'webm';
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

    if (!result.video_file) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No video recording available for this test result.',
        video_available: false,
      });
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
        browser: (result as any).browser || run.browser || 'chromium',
        viewport: (result as any).viewport_width && (result as any).viewport_height
          ? { width: (result as any).viewport_width, height: (result as any).viewport_height }
          : null,
        started_at: (result as any).started_at?.toISOString ? (result as any).started_at.toISOString() : (result as any).started_at,
        completed_at: (result as any).completed_at?.toISOString ? (result as any).completed_at.toISOString() : (result as any).completed_at,
      },
      playback_notes: format === 'mp4'
        ? 'MP4 format requested. If not available, WebM format will be returned.'
        : 'WebM format is the native recording format from Playwright.',
    };
  });

  // Get Playwright trace file for a test result
  app.get<{ Params: { runId: string; testId: string } }>('/api/v1/runs/:runId/results/:testId/trace', {
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

    const result = run.results?.find(r => r.test_id === testId);
    if (!result) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test result not found',
      });
    }

    if (!result.trace_file) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No trace file available for this test result.',
        trace_available: false,
      });
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
        browser: (result as any).browser || run.browser || 'chromium',
        viewport: (result as any).viewport_width && (result as any).viewport_height
          ? { width: (result as any).viewport_width, height: (result as any).viewport_height }
          : null,
        started_at: (result as any).started_at?.toISOString ? (result as any).started_at.toISOString() : (result as any).started_at,
        completed_at: (result as any).completed_at?.toISOString ? (result as any).completed_at.toISOString() : (result as any).completed_at,
        duration_ms: result.duration_ms,
      },
      viewer_instructions: 'To view the trace, download it and open with: npx playwright show-trace <trace.zip>',
    };
  });

  // Bulk artifact download - creates a ZIP file with all artifacts for a test run
  app.get<{ Params: { runId: string }; Querystring: { test_id?: string; include_screenshots?: string; include_videos?: string; include_traces?: string; metadata_only?: string } }>('/api/v1/runs/:runId/artifacts/download', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const { test_id, include_screenshots, include_videos, include_traces, metadata_only } = request.query;
    const orgId = getOrganizationId(request);

    const includeScreenshots = include_screenshots !== 'false';
    const includeVideos = include_videos !== 'false';
    const includeTraces = include_traces !== 'false';
    const returnMetadataOnly = metadata_only === 'true';

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    if (!run.results || run.results.length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No test results available for this run',
      });
    }

    const filteredResults = test_id
      ? run.results.filter(r => r.test_id === test_id)
      : run.results;

    if (filteredResults.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: test_id ? `No results found for test ID: ${test_id}` : 'No test results available',
      });
    }

    interface ArtifactInfo {
      name: string;
      type: 'trace' | 'video' | 'screenshot';
      path?: string;
      data?: string;
      size_bytes: number;
      test_id: string;
      test_name: string;
    }

    const artifacts: ArtifactInfo[] = [];

    for (const result of filteredResults) {
      const testName = result.test_name.replace(/[^a-zA-Z0-9_-]/g, '_');

      if (includeTraces && result.trace_file) {
        const tracePath = path.join(TRACES_DIR, result.trace_file);
        if (fs.existsSync(tracePath)) {
          const stats = fs.statSync(tracePath);
          artifacts.push({
            name: `${testName}_trace.zip`,
            type: 'trace',
            path: tracePath,
            size_bytes: stats.size,
            test_id: result.test_id,
            test_name: result.test_name,
          });
        }
      }

      if (includeVideos && result.video_file) {
        const videoPath = path.join(VIDEOS_DIR, result.video_file);
        if (fs.existsSync(videoPath)) {
          const stats = fs.statSync(videoPath);
          artifacts.push({
            name: `${testName}_video.webm`,
            type: 'video',
            path: videoPath,
            size_bytes: stats.size,
            test_id: result.test_id,
            test_name: result.test_name,
          });
        }
      }

      if (includeScreenshots && result.screenshot_base64) {
        const buffer = Buffer.from(result.screenshot_base64, 'base64');
        artifacts.push({
          name: `${testName}_screenshot.png`,
          type: 'screenshot',
          data: result.screenshot_base64,
          size_bytes: buffer.length,
          test_id: result.test_id,
          test_name: result.test_name,
        });
      }
    }

    if (artifacts.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No artifacts found matching the specified criteria',
        filters: {
          test_id: test_id || null,
          include_screenshots: includeScreenshots,
          include_videos: includeVideos,
          include_traces: includeTraces,
        },
      });
    }

    if (returnMetadataOnly) {
      const totalSizeBytes = artifacts.reduce((sum, a) => sum + a.size_bytes, 0);

      const downloadParams = new URLSearchParams();
      if (test_id) downloadParams.append('test_id', test_id);
      if (!includeScreenshots) downloadParams.append('include_screenshots', 'false');
      if (!includeVideos) downloadParams.append('include_videos', 'false');
      if (!includeTraces) downloadParams.append('include_traces', 'false');
      const queryString = downloadParams.toString();

      return {
        download_available: true,
        run_id: runId,
        download_url: `${request.protocol}://${request.headers.host}/api/v1/runs/${runId}/artifacts/download${queryString ? `?${queryString}` : ''}`,
        filename: `run-${runId}-artifacts.zip`,
        filters_applied: {
          test_id: test_id || null,
          include_screenshots: includeScreenshots,
          include_videos: includeVideos,
          include_traces: includeTraces,
        },
        manifest: {
          test_count: filteredResults.length,
          artifact_count: artifacts.length,
          total_size_bytes: totalSizeBytes,
          total_size_human: totalSizeBytes > 1024 * 1024
            ? `${(totalSizeBytes / (1024 * 1024)).toFixed(2)} MB`
            : `${(totalSizeBytes / 1024).toFixed(2)} KB`,
          by_type: {
            screenshots: artifacts.filter(a => a.type === 'screenshot').length,
            videos: artifacts.filter(a => a.type === 'video').length,
            traces: artifacts.filter(a => a.type === 'trace').length,
          },
          artifacts: artifacts.map(a => ({
            name: a.name,
            type: a.type,
            size_bytes: a.size_bytes,
            test_id: a.test_id,
            test_name: a.test_name,
          })),
        },
        instructions: 'Use the download_url to download the ZIP archive.',
      };
    }

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 5 } });
    const fileName = `run-${runId}-artifacts.zip`;
    const origin = request.headers.origin || 'http://localhost:5173';

    reply.raw.setHeader('Access-Control-Allow-Origin', origin);
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
    reply.raw.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');
    reply.raw.setHeader('Content-Type', 'application/zip');
    reply.raw.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    archive.pipe(reply.raw);

    for (const artifact of artifacts) {
      if (artifact.path) {
        archive.file(artifact.path, { name: artifact.name });
      } else if (artifact.data) {
        const buffer = Buffer.from(artifact.data, 'base64');
        archive.append(buffer, { name: artifact.name });
      }
    }

    const manifest = {
      run_id: runId,
      created_at: new Date().toISOString(),
      test_count: run.results.length,
      artifact_count: artifacts.length,
      artifacts: artifacts.map(a => ({ name: a.name, type: a.type })),
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    await archive.finalize();

    console.log(`[ARTIFACT DOWNLOAD] Created bulk download ZIP for run ${runId} with ${artifacts.length} artifacts`);

    return reply;
  });

  // Delete artifacts for a test run
  app.delete<{ Params: { runId: string }; Body: { test_id?: string; artifact_types?: string[]; older_than_days?: number; dry_run?: boolean } }>('/api/v1/runs/:runId/artifacts', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const { test_id, artifact_types, older_than_days, dry_run = false } = request.body || {};
    const orgId = getOrganizationId(request);

    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test run not found',
      });
    }

    if (!run.results || run.results.length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No test results available for this run',
      });
    }

    const filteredResults = test_id
      ? run.results.filter(r => r.test_id === test_id)
      : run.results;

    if (filteredResults.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: test_id ? `No results found for test ID: ${test_id}` : 'No test results available',
      });
    }

    const typesToDelete = artifact_types && artifact_types.length > 0
      ? artifact_types
      : ['screenshots', 'videos', 'traces'];

    const ageCutoff = older_than_days
      ? new Date(Date.now() - older_than_days * 24 * 60 * 60 * 1000)
      : null;

    interface ArtifactToDelete {
      name: string;
      type: 'screenshot' | 'video' | 'trace';
      path: string;
      size_bytes: number;
      test_id: string;
      test_name: string;
      created_at?: Date;
    }

    const artifactsToDelete: ArtifactToDelete[] = [];
    let totalSizeToFree = 0;

    for (const result of filteredResults) {
      const testName = result.test_name.replace(/[^a-zA-Z0-9_-]/g, '_');

      if (typesToDelete.includes('traces') && result.trace_file) {
        const tracePath = path.join(TRACES_DIR, result.trace_file);
        if (fs.existsSync(tracePath)) {
          const stats = fs.statSync(tracePath);
          const fileAge = stats.mtime;

          if (!ageCutoff || fileAge < ageCutoff) {
            artifactsToDelete.push({
              name: result.trace_file,
              type: 'trace',
              path: tracePath,
              size_bytes: stats.size,
              test_id: result.test_id,
              test_name: result.test_name,
              created_at: fileAge,
            });
            totalSizeToFree += stats.size;
          }
        }
      }

      if (typesToDelete.includes('videos') && result.video_file) {
        const videoPath = path.join(VIDEOS_DIR, result.video_file);
        if (fs.existsSync(videoPath)) {
          const stats = fs.statSync(videoPath);
          const fileAge = stats.mtime;

          if (!ageCutoff || fileAge < ageCutoff) {
            artifactsToDelete.push({
              name: result.video_file,
              type: 'video',
              path: videoPath,
              size_bytes: stats.size,
              test_id: result.test_id,
              test_name: result.test_name,
              created_at: fileAge,
            });
            totalSizeToFree += stats.size;
          }
        }
      }

      if (typesToDelete.includes('screenshots') && result.screenshot_base64) {
        const screenshotSize = Buffer.from(result.screenshot_base64, 'base64').length;
        artifactsToDelete.push({
          name: `${testName}_screenshot.png`,
          type: 'screenshot',
          path: '',
          size_bytes: screenshotSize,
          test_id: result.test_id,
          test_name: result.test_name,
        });
        totalSizeToFree += screenshotSize;
      }
    }

    if (artifactsToDelete.length === 0) {
      return {
        deleted: false,
        message: 'No artifacts found matching the specified criteria',
        filters: {
          test_id: test_id || null,
          artifact_types: typesToDelete,
          older_than_days: older_than_days || null,
        },
      };
    }

    if (dry_run) {
      return {
        dry_run: true,
        would_delete: {
          artifact_count: artifactsToDelete.length,
          total_size_bytes: totalSizeToFree,
          total_size_human: totalSizeToFree > 1024 * 1024
            ? `${(totalSizeToFree / (1024 * 1024)).toFixed(2)} MB`
            : `${(totalSizeToFree / 1024).toFixed(2)} KB`,
          by_type: {
            screenshots: artifactsToDelete.filter(a => a.type === 'screenshot').length,
            videos: artifactsToDelete.filter(a => a.type === 'video').length,
            traces: artifactsToDelete.filter(a => a.type === 'trace').length,
          },
          artifacts: artifactsToDelete.map(a => ({
            name: a.name,
            type: a.type,
            size_bytes: a.size_bytes,
            test_id: a.test_id,
            test_name: a.test_name,
          })),
        },
        filters: {
          test_id: test_id || null,
          artifact_types: typesToDelete,
          older_than_days: older_than_days || null,
        },
      };
    }

    const deletedArtifacts: { name: string; type: string; size_bytes: number }[] = [];
    const failedDeletions: { name: string; error: string }[] = [];

    for (const artifact of artifactsToDelete) {
      try {
        if (artifact.type === 'screenshot') {
          const result = run.results?.find(r => r.test_id === artifact.test_id);
          if (result) {
            delete result.screenshot_base64;
            deletedArtifacts.push({
              name: artifact.name,
              type: artifact.type,
              size_bytes: artifact.size_bytes,
            });
          }
        } else if (artifact.path && fs.existsSync(artifact.path)) {
          fs.unlinkSync(artifact.path);
          deletedArtifacts.push({
            name: artifact.name,
            type: artifact.type,
            size_bytes: artifact.size_bytes,
          });

          const result = run.results?.find(r => r.test_id === artifact.test_id);
          if (result) {
            if (artifact.type === 'trace') {
              delete result.trace_file;
            } else if (artifact.type === 'video') {
              delete result.video_file;
            }
          }
        }
      } catch (err) {
        failedDeletions.push({
          name: artifact.name,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const actualSizeFreed = deletedArtifacts.reduce((sum, a) => sum + a.size_bytes, 0);

    console.log(`[ARTIFACT DELETE] Deleted ${deletedArtifacts.length} artifacts for run ${runId}, freed ${actualSizeFreed} bytes`);

    return {
      deleted: true,
      run_id: runId,
      summary: {
        artifacts_deleted: deletedArtifacts.length,
        artifacts_failed: failedDeletions.length,
        storage_freed_bytes: actualSizeFreed,
        storage_freed_human: actualSizeFreed > 1024 * 1024
          ? `${(actualSizeFreed / (1024 * 1024)).toFixed(2)} MB`
          : `${(actualSizeFreed / 1024).toFixed(2)} KB`,
        by_type: {
          screenshots: deletedArtifacts.filter(a => a.type === 'screenshot').length,
          videos: deletedArtifacts.filter(a => a.type === 'video').length,
          traces: deletedArtifacts.filter(a => a.type === 'trace').length,
        },
      },
      deleted_artifacts: deletedArtifacts,
      failed_deletions: failedDeletions.length > 0 ? failedDeletions : undefined,
      filters_applied: {
        test_id: test_id || null,
        artifact_types: typesToDelete,
        older_than_days: older_than_days || null,
      },
    };
  });

  // Get artifact storage usage information
  app.get<{ Querystring: { project_id?: string; include_runs?: string } }>('/api/v1/artifacts/storage', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { project_id, include_runs } = request.query;
    const orgId = getOrganizationId(request);
    const includeRunsBreakdown = include_runs === 'true';

    const storageLimitBytes = 10 * 1024 * 1024 * 1024; // 10 GB

    const orgRuns = await dbListTestRunsByOrg(orgId);

    const projectStorage = new Map<string, {
      project_id: string;
      project_name: string;
      storage_bytes: number;
      artifact_count: number;
      screenshots: number;
      videos: number;
      traces: number;
      runs?: Array<{ run_id: string; storage_bytes: number; artifact_count: number }>;
    }>();

    let totalStorageBytes = 0;
    let totalArtifactCount = 0;
    let totalScreenshots = 0;
    let totalVideos = 0;
    let totalTraces = 0;

    const projectMap = new Map<string, string>();
    for (const [, suite] of (await getTestSuitesMap())) {
      if (suite.organization_id === orgId) {
        const project = await dbGetProject(suite.project_id);
        if (project) {
          projectMap.set(suite.project_id, project.name);
        }
      }
    }

    for (const run of orgRuns) {
      const suite = await getTestSuite(run.suite_id);
      if (!suite) continue;
      const runProjectId = suite.project_id;

      if (project_id && runProjectId !== project_id) continue;

      let runStorageBytes = 0;
      let runArtifactCount = 0;
      let runScreenshots = 0;
      let runVideos = 0;
      let runTraces = 0;

      if (run.results) {
        for (const result of run.results) {
          if (result.trace_file) {
            const tracePath = path.join(TRACES_DIR, result.trace_file);
            if (fs.existsSync(tracePath)) {
              const stats = fs.statSync(tracePath);
              runStorageBytes += stats.size;
              runArtifactCount++;
              runTraces++;
            }
          }

          if (result.video_file) {
            const videoPath = path.join(VIDEOS_DIR, result.video_file);
            if (fs.existsSync(videoPath)) {
              const stats = fs.statSync(videoPath);
              runStorageBytes += stats.size;
              runArtifactCount++;
              runVideos++;
            }
          }

          if (result.screenshot_base64) {
            const screenshotSize = Buffer.from(result.screenshot_base64, 'base64').length;
            runStorageBytes += screenshotSize;
            runArtifactCount++;
            runScreenshots++;
          }
        }
      }

      // Update project storage
      if (!projectStorage.has(runProjectId)) {
        projectStorage.set(runProjectId, {
          project_id: runProjectId,
          project_name: projectMap.get(runProjectId) || 'Unknown',
          storage_bytes: 0,
          artifact_count: 0,
          screenshots: 0,
          videos: 0,
          traces: 0,
          runs: includeRunsBreakdown ? [] : undefined,
        });
      }

      const projectData = projectStorage.get(runProjectId)!;
      projectData.storage_bytes += runStorageBytes;
      projectData.artifact_count += runArtifactCount;
      projectData.screenshots += runScreenshots;
      projectData.videos += runVideos;
      projectData.traces += runTraces;

      if (includeRunsBreakdown && projectData.runs) {
        projectData.runs.push({
          run_id: run.id,
          storage_bytes: runStorageBytes,
          artifact_count: runArtifactCount,
        });
      }

      totalStorageBytes += runStorageBytes;
      totalArtifactCount += runArtifactCount;
      totalScreenshots += runScreenshots;
      totalVideos += runVideos;
      totalTraces += runTraces;
    }

    const usagePercentage = (totalStorageBytes / storageLimitBytes) * 100;

    return {
      organization_id: orgId,
      storage_summary: {
        total_bytes: totalStorageBytes,
        total_human: totalStorageBytes > 1024 * 1024 * 1024
          ? `${(totalStorageBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
          : totalStorageBytes > 1024 * 1024
            ? `${(totalStorageBytes / (1024 * 1024)).toFixed(2)} MB`
            : `${(totalStorageBytes / 1024).toFixed(2)} KB`,
        limit_bytes: storageLimitBytes,
        limit_human: '10 GB',
        usage_percentage: parseFloat(usagePercentage.toFixed(2)),
        available_bytes: storageLimitBytes - totalStorageBytes,
      },
      artifact_counts: {
        total: totalArtifactCount,
        screenshots: totalScreenshots,
        videos: totalVideos,
        traces: totalTraces,
      },
      by_project: Array.from(projectStorage.values()),
      filters_applied: {
        project_id: project_id || null,
        include_runs: includeRunsBreakdown,
      },
    };
  });
}