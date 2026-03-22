/**
 * Artifact Routes - File Serving
 *
 * Direct file serving for trace and video files by filename.
 * Includes security checks for path traversal and org ownership.
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

export async function artifactFileServingRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { fileName: string } }>('/api/v1/traces/:fileName', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { fileName } = request.params;
    const orgId = getOrganizationId(request);

    // Security: Ensure filename doesn't contain path traversal
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Invalid file name');
    }

    const tracePath = path.join(TRACES_DIR, fileName);

    // Check if file exists
    if (!fs.existsSync(tracePath)) {
      return sendError(reply, 404, 'NOT_FOUND', 'Trace file not found');
    }

    // Extract runId from filename to verify organization ownership
    // Filename format: trace-{runId}-{testId}-{timestamp}.zip
    const parts = fileName.split('-');
    if (parts.length >= 2 && parts[1]) {
      const runId: string = parts[1];
      const run = await getTestRunWithFallback(runId);
      if (run && run.organization_id !== orgId) {
        return sendError(reply, 403, 'FORBIDDEN', 'You do not have access to this trace file');
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
      return sendError(reply, 400, 'BAD_REQUEST', 'Invalid file name');
    }

    const videoPath = path.join(VIDEOS_DIR, fileName);

    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      return sendError(reply, 404, 'NOT_FOUND', 'Video file not found');
    }

    // Extract runId from filename to verify organization ownership
    // Filename format: video-{runId}-{testId}-{timestamp}.webm
    const parts = fileName.split('-');
    if (parts.length >= 2 && parts[1]) {
      const runId: string = parts[1];
      const run = await getTestRunWithFallback(runId);
      if (run && run.organization_id !== orgId) {
        return sendError(reply, 403, 'FORBIDDEN', 'You do not have access to this video file');
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
      return sendError(reply, 400, 'BAD_REQUEST', 'Invalid file name');
    }

    // Verify run exists and belongs to user's organization
    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    const videoPath = path.join(VIDEOS_DIR, fileName);

    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      return sendError(reply, 404, 'NOT_FOUND', 'Video file not found');
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
      return sendError(reply, 400, 'BAD_REQUEST', 'Invalid file name');
    }

    // Verify run exists and belongs to user's organization
    const run = await getTestRunWithFallback(runId);
    if (!run || run.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    const tracePath = path.join(TRACES_DIR, fileName);

    // Check if file exists
    if (!fs.existsSync(tracePath)) {
      return sendError(reply, 404, 'NOT_FOUND', 'Trace file not found');
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
}
