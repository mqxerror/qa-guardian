/**
 * Artifact Routes - Cleanup & Storage
 *
 * Endpoints for deleting artifacts and viewing storage usage.
 * Supports dry-run mode, filtering by type/age, and per-project storage breakdown.
 *
 * Feature #1356: Code quality - extracted from test-runs.ts
 */

import { FastifyInstance } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { authenticate, getOrganizationId } from '../../../middleware/auth.js';
import { getTestSuite, getTestSuitesMapByOrg } from '../../test-suites.js';
import { getProject as dbGetProject } from '../../projects/stores.js';
import { TRACES_DIR, VIDEOS_DIR } from '../storage.js';
import { listTestRunsByOrg as dbListTestRunsByOrg } from '../../../services/repositories/test-runs.js';
import {
  getTestRunWithFallback,
  ArtifactToDelete,
} from '../artifact-types.js';
import { createLogger } from '../../../services/logger.js';
import { sendError } from '../../../utils/errors.js';

const logger = createLogger('artifact-routes:cleanup');

export async function artifactCleanupRoutes(app: FastifyInstance): Promise<void> {
  // Delete artifacts for a test run
  app.delete<{ Params: { runId: string }; Body: { test_id?: string; artifact_types?: string[]; older_than_days?: number; dry_run?: boolean } }>('/api/v1/runs/:runId/artifacts', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId } = request.params;
    const { test_id, artifact_types, older_than_days, dry_run = false } = request.body || {};
    const orgId = getOrganizationId(request);

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

    const typesToDelete = artifact_types && artifact_types.length > 0
      ? artifact_types
      : ['screenshots', 'videos', 'traces'];

    const ageCutoff = older_than_days
      ? new Date(Date.now() - older_than_days * 24 * 60 * 60 * 1000)
      : null;

    // Use ArtifactToDelete from types module
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

    logger.info({ runId, deletedCount: deletedArtifacts.length, bytesFreed: actualSizeFreed }, 'Deleted artifacts');

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

    // Feature #198: includeResults needed because storage analysis iterates over run.results
    const orgRuns = await dbListTestRunsByOrg(orgId, { includeResults: true });

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

    // Feature #707: Use org-filtered version to avoid full table scan
    const projectMap = new Map<string, string>();
    for (const [, suite] of (await getTestSuitesMapByOrg(orgId))) {
      const project = await dbGetProject(suite.project_id);
      if (project) {
        projectMap.set(suite.project_id, project.name);
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
