/**
 * Artifact Routes - Bulk Download
 *
 * Endpoint for bulk downloading artifacts as a ZIP archive.
 * Supports metadata-only mode and filtering by test/type.
 *
 * Feature #1356: Code quality - extracted from test-runs.ts
 */

import { FastifyInstance } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { authenticate, getOrganizationId } from '../../../middleware/auth.js';
import { TRACES_DIR, VIDEOS_DIR } from '../storage.js';
import {
  getTestRunWithFallback,
  DownloadArtifactInfo,
} from '../artifact-types.js';
import { createLogger } from '../../../services/logger.js';
import { sendError } from '../../../utils/errors.js';

const logger = createLogger('artifact-routes:download');

export async function artifactDownloadRoutes(app: FastifyInstance): Promise<void> {
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
      return sendError(reply, 404, 'NOT_FOUND', 'Test run not found');
    }

    if (!run.results || run.results.length === 0) {
      return sendError(reply, 400, 'BAD_REQUEST', 'No test results available for this run');
    }

    const filteredResults = test_id
      ? run.results.filter(r => r.test_id === test_id)
      : run.results;

    if (filteredResults.length === 0) {
      return sendError(reply, 404, 'NOT_FOUND', test_id ? `No results found for test ID: ${test_id}` : 'No test results available');
    }

    // Use DownloadArtifactInfo from types module
    const artifacts: DownloadArtifactInfo[] = [];

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
      return sendError(reply, 404, 'NOT_FOUND', 'No artifacts found matching the specified criteria', { filters: {
          test_id: test_id || null,
          include_screenshots: includeScreenshots,
          include_videos: includeVideos,
          include_traces: includeTraces,
        } });
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

    logger.info({ runId, artifactCount: artifacts.length }, 'Created bulk download ZIP');

    return reply;
  });
}
