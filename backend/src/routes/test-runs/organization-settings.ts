/**
 * Organization Settings Routes Module (Feature #1356)
 *
 * Handles organization-specific settings routes including:
 * - Artifact retention policy
 * - Visual diff color settings
 * - Artifact cleanup preview and execution
 * - Storage usage statistics
 *
 * Extracted from test-runs.ts as part of code quality improvement.
 */

import { FastifyInstance } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { authenticate, getOrganizationId, JwtPayload } from '../../middleware/auth';
import { testRuns } from './execution';
import { testSuites } from '../test-suites';
import { projects } from '../projects';
import {
  artifactRetentionSettings,
  TRACES_DIR,
} from './storage';
import {
  getDiffColors,
  setDiffColors,
  DiffColorConfig,
} from './visual-regression';

/**
 * Register organization settings routes
 */
export async function organizationSettingsRoutes(app: FastifyInstance): Promise<void> {
  // Get artifact retention policy for organization
  app.get<{ Params: { orgId: string } }>('/api/v1/organizations/:orgId/artifact-retention', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { orgId } = request.params;
    const userOrgId = getOrganizationId(request);

    // Verify user has access to this organization
    if (orgId !== userOrgId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this organization',
      });
    }

    const retentionDays = artifactRetentionSettings.get(orgId) || 30;

    return {
      retention_days: retentionDays,
    };
  });

  // Update artifact retention policy for organization (owner/admin only)
  app.put<{ Params: { orgId: string }; Body: { retention_days: number } }>(
    '/api/v1/organizations/:orgId/artifact-retention',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { orgId } = request.params;
      const { retention_days } = request.body;
      const userOrgId = getOrganizationId(request);
      const user = request.user as JwtPayload;

      // Verify user has access to this organization
      if (orgId !== userOrgId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You do not have access to this organization',
        });
      }

      // Only owners and admins can change retention policy
      if (!['owner', 'admin'].includes(user.role)) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Only owners and admins can change artifact retention policy',
        });
      }

      // Validate retention_days
      if (typeof retention_days !== 'number' || retention_days < 1 || retention_days > 365) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Retention days must be between 1 and 365',
        });
      }

      // Update the setting
      artifactRetentionSettings.set(orgId, retention_days);

      console.log(`[ARTIFACT RETENTION] Organization ${orgId} retention policy updated to ${retention_days} days by ${user.email}`);

      return {
        retention_days,
        message: 'Artifact retention policy updated successfully',
      };
    }
  );

  // Feature #449: Get diff highlight color settings for organization
  app.get<{ Params: { orgId: string } }>('/api/v1/organizations/:orgId/visual-settings/diff-colors', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { orgId } = request.params;
    const userOrgId = getOrganizationId(request);

    // Verify user has access to this organization
    if (orgId !== userOrgId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this organization',
      });
    }

    const colors = getDiffColors(orgId);

    // Convert RGB arrays to hex for easier display
    const rgbToHex = (rgb: [number, number, number]) =>
      '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');

    return {
      diff_color: {
        rgb: colors.diffColor,
        hex: rgbToHex(colors.diffColor),
      },
      diff_color_alt: {
        rgb: colors.diffColorAlt,
        hex: rgbToHex(colors.diffColorAlt),
      },
      available_presets: [
        { name: 'Magenta (Default)', diffColor: [255, 0, 255], diffColorAlt: [255, 255, 0] },
        { name: 'Red', diffColor: [255, 0, 0], diffColorAlt: [255, 128, 0] },
        { name: 'Green', diffColor: [0, 255, 0], diffColorAlt: [128, 255, 0] },
        { name: 'Blue', diffColor: [0, 128, 255], diffColorAlt: [0, 255, 255] },
        { name: 'Orange', diffColor: [255, 165, 0], diffColorAlt: [255, 200, 0] },
      ],
    };
  });

  // Feature #449: Update diff highlight color settings for organization
  app.put<{ Params: { orgId: string }; Body: { diff_color?: [number, number, number]; diff_color_alt?: [number, number, number]; preset?: string } }>(
    '/api/v1/organizations/:orgId/visual-settings/diff-colors',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { orgId } = request.params;
      const { diff_color, diff_color_alt, preset } = request.body;
      const userOrgId = getOrganizationId(request);
      const user = request.user as JwtPayload;

      // Verify user has access to this organization
      if (orgId !== userOrgId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You do not have access to this organization',
        });
      }

      // Only owners and admins can change diff colors
      if (!['owner', 'admin'].includes(user.role)) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Only owners and admins can change visual diff settings',
        });
      }

      // Handle preset selection
      const presets: Record<string, DiffColorConfig> = {
        'magenta': { diffColor: [255, 0, 255], diffColorAlt: [255, 255, 0] },
        'red': { diffColor: [255, 0, 0], diffColorAlt: [255, 128, 0] },
        'green': { diffColor: [0, 255, 0], diffColorAlt: [128, 255, 0] },
        'blue': { diffColor: [0, 128, 255], diffColorAlt: [0, 255, 255] },
        'orange': { diffColor: [255, 165, 0], diffColorAlt: [255, 200, 0] },
      };

      let newColors: Partial<DiffColorConfig> = {};

      if (preset) {
        const presetColors = presets[preset.toLowerCase()];
        if (!presetColors) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Invalid preset. Available presets: ${Object.keys(presets).join(', ')}`,
          });
        }
        newColors = presetColors;
      } else {
        // Validate custom colors
        const validateRgb = (rgb: unknown): rgb is [number, number, number] => {
          return Array.isArray(rgb) &&
            rgb.length === 3 &&
            rgb.every(c => typeof c === 'number' && c >= 0 && c <= 255);
        };

        if (diff_color) {
          if (!validateRgb(diff_color)) {
            return reply.status(400).send({
              error: 'Bad Request',
              message: 'diff_color must be an array of 3 numbers [R, G, B] between 0-255',
            });
          }
          newColors.diffColor = diff_color;
        }

        if (diff_color_alt) {
          if (!validateRgb(diff_color_alt)) {
            return reply.status(400).send({
              error: 'Bad Request',
              message: 'diff_color_alt must be an array of 3 numbers [R, G, B] between 0-255',
            });
          }
          newColors.diffColorAlt = diff_color_alt;
        }
      }

      if (Object.keys(newColors).length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Provide diff_color, diff_color_alt, or preset',
        });
      }

      const updatedColors = setDiffColors(orgId, newColors);

      const rgbToHex = (rgb: [number, number, number]) =>
        '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');

      console.log(`[VISUAL SETTINGS] Organization ${orgId} diff colors updated by ${user.email}`);

      return {
        diff_color: {
          rgb: updatedColors.diffColor,
          hex: rgbToHex(updatedColors.diffColor),
        },
        diff_color_alt: {
          rgb: updatedColors.diffColorAlt,
          hex: rgbToHex(updatedColors.diffColorAlt),
        },
        message: 'Diff colors updated successfully',
      };
    }
  );

  // Get artifact cleanup preview (shows what would be deleted)
  app.get<{ Params: { orgId: string } }>('/api/v1/organizations/:orgId/artifact-cleanup/preview', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { orgId } = request.params;
    const userOrgId = getOrganizationId(request);
    const user = request.user as JwtPayload;

    // Verify user has access to this organization
    if (orgId !== userOrgId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this organization',
      });
    }

    // Only owners and admins can view cleanup preview
    if (!['owner', 'admin'].includes(user.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only owners and admins can view artifact cleanup preview',
      });
    }

    const retentionDays = artifactRetentionSettings.get(orgId) || 30;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    // Find old test runs for this organization
    const oldRuns: string[] = [];
    const preservedRuns: string[] = [];

    for (const [runId, run] of testRuns) {
      if (run.organization_id === orgId) {
        const runDate = run.completed_at || run.created_at;
        if (runDate < cutoffDate) {
          oldRuns.push(runId);
        } else {
          preservedRuns.push(runId);
        }
      }
    }

    // Count trace files that would be deleted
    let traceFilesToDelete = 0;
    let traceSizeBytes = 0;

    try {
      const traceFiles = fs.readdirSync(TRACES_DIR);
      for (const file of traceFiles) {
        // Filename format: trace-{runId}-{testId}-{timestamp}.zip
        const parts = file.split('-');
        if (parts.length >= 2 && parts[1] && oldRuns.includes(parts[1])) {
          traceFilesToDelete++;
          const filePath = path.join(TRACES_DIR, file);
          const stats = fs.statSync(filePath);
          traceSizeBytes += stats.size;
        }
      }
    } catch {
      // Ignore errors reading trace directory
    }

    return {
      retention_days: retentionDays,
      cutoff_date: cutoffDate.toISOString(),
      runs_to_delete: oldRuns.length,
      runs_preserved: preservedRuns.length,
      trace_files_to_delete: traceFilesToDelete,
      estimated_space_freed_bytes: traceSizeBytes,
      estimated_space_freed_mb: Math.round(traceSizeBytes / (1024 * 1024) * 100) / 100,
    };
  });

  // Execute artifact cleanup for organization (owner/admin only)
  app.post<{ Params: { orgId: string } }>('/api/v1/organizations/:orgId/artifact-cleanup', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { orgId } = request.params;
    const userOrgId = getOrganizationId(request);
    const user = request.user as JwtPayload;

    // Verify user has access to this organization
    if (orgId !== userOrgId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this organization',
      });
    }

    // Only owners and admins can execute cleanup
    if (!['owner', 'admin'].includes(user.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only owners and admins can execute artifact cleanup',
      });
    }

    const retentionDays = artifactRetentionSettings.get(orgId) || 30;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    // Find and delete old test runs for this organization
    const deletedRuns: string[] = [];
    const runsToDelete: string[] = [];

    for (const [runId, run] of testRuns) {
      if (run.organization_id === orgId) {
        const runDate = run.completed_at || run.created_at;
        if (runDate < cutoffDate) {
          runsToDelete.push(runId);
        }
      }
    }

    // Delete old runs
    for (const runId of runsToDelete) {
      testRuns.delete(runId);
      deletedRuns.push(runId);
    }

    // Delete associated trace files
    let traceFilesDeleted = 0;
    let bytesFreed = 0;

    try {
      const traceFiles = fs.readdirSync(TRACES_DIR);
      for (const file of traceFiles) {
        // Filename format: trace-{runId}-{testId}-{timestamp}.zip
        const parts = file.split('-');
        if (parts.length >= 2 && parts[1] && deletedRuns.includes(parts[1])) {
          const filePath = path.join(TRACES_DIR, file);
          try {
            const stats = fs.statSync(filePath);
            bytesFreed += stats.size;
            fs.unlinkSync(filePath);
            traceFilesDeleted++;
          } catch (err) {
            console.error(`Failed to delete trace file ${file}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Failed to read trace directory:', err);
    }

    console.log(`[ARTIFACT CLEANUP] Organization ${orgId}: Deleted ${deletedRuns.length} runs, ${traceFilesDeleted} trace files (${Math.round(bytesFreed / 1024)} KB) by ${user.email}`);

    return {
      retention_days: retentionDays,
      cutoff_date: cutoffDate.toISOString(),
      runs_deleted: deletedRuns.length,
      trace_files_deleted: traceFilesDeleted,
      bytes_freed: bytesFreed,
      mb_freed: Math.round(bytesFreed / (1024 * 1024) * 100) / 100,
      message: 'Artifact cleanup completed successfully',
    };
  });

  // Get storage usage for organization
  app.get<{ Params: { orgId: string } }>('/api/v1/organizations/:orgId/storage', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { orgId } = request.params;
    const userOrgId = getOrganizationId(request);

    // Verify user has access to this organization
    if (orgId !== userOrgId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this organization',
      });
    }

    // Calculate storage used by trace files
    const projectStorage: Map<string, { project_id: string; project_name: string; bytes: number; trace_count: number }> = new Map();
    let totalBytes = 0;
    let totalTraceFiles = 0;

    try {
      const traceFiles = fs.readdirSync(TRACES_DIR);
      for (const file of traceFiles) {
        // Filename format: trace-{runId}-{testId}-{timestamp}.zip
        const parts = file.split('-');
        if (parts.length >= 2 && parts[1]) {
          const runId = parts[1];
          const run = testRuns.get(runId);

          // Only count files for this organization
          if (run && run.organization_id === orgId) {
            const filePath = path.join(TRACES_DIR, file);
            try {
              const stats = fs.statSync(filePath);
              totalBytes += stats.size;
              totalTraceFiles++;

              // Find project for this run
              const suite = testSuites.get(run.suite_id);
              if (suite) {
                const projectId = suite.project_id;
                const project = projects.get(projectId);
                const projectName = project?.name || 'Unknown Project';

                const existing = projectStorage.get(projectId) || {
                  project_id: projectId,
                  project_name: projectName,
                  bytes: 0,
                  trace_count: 0,
                };
                existing.bytes += stats.size;
                existing.trace_count++;
                projectStorage.set(projectId, existing);
              }
            } catch {
              // Ignore files we can't stat
            }
          }
        }
      }
    } catch {
      // Ignore errors reading trace directory
    }

    // Convert project storage map to array and sort by size
    const projectBreakdown = Array.from(projectStorage.values())
      .map(p => ({
        project_id: p.project_id,
        project_name: p.project_name,
        bytes: p.bytes,
        mb: Math.round(p.bytes / (1024 * 1024) * 100) / 100,
        trace_count: p.trace_count,
      }))
      .sort((a, b) => b.bytes - a.bytes);

    // Storage limit and warning threshold
    const storageLimitMb = 500; // 500 MB limit
    const warningThresholdPercent = 80; // Warn at 80%
    const totalMb = Math.round(totalBytes / (1024 * 1024) * 100) / 100;
    const usagePercent = Math.round((totalMb / storageLimitMb) * 100);
    const isWarning = usagePercent >= warningThresholdPercent;

    return {
      total_bytes: totalBytes,
      total_mb: totalMb,
      total_trace_files: totalTraceFiles,
      storage_limit_mb: storageLimitMb,
      usage_percent: usagePercent,
      is_warning: isWarning,
      warning_threshold_percent: warningThresholdPercent,
      project_breakdown: projectBreakdown,
    };
  });
}
