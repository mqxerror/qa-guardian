/**
 * Visual Storage Routes Module
 * Feature #1356: Backend file size limit enforcement (1500 lines)
 *
 * This module contains routes for visual storage management:
 * - GET /api/v1/visual/storage - Get storage usage and quota information
 * - POST /api/v1/visual/cleanup-baselines - Cleanup old baselines
 *
 * Extracted from test-runs.ts to reduce file size.
 */

import { FastifyInstance } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { authenticate, getOrganizationId } from '../../middleware/auth';
import {
  calculateTotalStorageUsage,
  DEFAULT_STORAGE_QUOTA,
} from './storage';
import { BASELINES_DIR } from './visual-regression';

/**
 * Register visual storage routes
 */
export async function visualStorageRoutes(app: FastifyInstance): Promise<void> {
  // Feature #604: Get storage usage and quota information
  app.get('/api/v1/visual/storage', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { usedBytes, breakdown } = calculateTotalStorageUsage();
    const quotaBytes = DEFAULT_STORAGE_QUOTA.quotaBytes;
    const usagePercent = Math.round((usedBytes / quotaBytes) * 100);
    const availableBytes = Math.max(0, quotaBytes - usedBytes);

    // Convert breakdown to MB for readability
    const breakdownMb: Record<string, number> = {};
    for (const [key, value] of Object.entries(breakdown)) {
      breakdownMb[key] = Math.round((value / (1024 * 1024)) * 100) / 100;
    }

    return {
      used_bytes: usedBytes,
      used_mb: Math.round((usedBytes / (1024 * 1024)) * 100) / 100,
      quota_bytes: quotaBytes,
      quota_mb: Math.round((quotaBytes / (1024 * 1024)) * 100) / 100,
      available_bytes: availableBytes,
      available_mb: Math.round((availableBytes / (1024 * 1024)) * 100) / 100,
      usage_percent: usagePercent,
      is_warning: usagePercent >= DEFAULT_STORAGE_QUOTA.warningThresholdPercent,
      is_exceeded: usedBytes >= quotaBytes,
      warning_threshold_percent: DEFAULT_STORAGE_QUOTA.warningThresholdPercent,
      breakdown: breakdownMb,
      suggestions: usagePercent >= 80 ? [
        'Clean up old baselines that are no longer needed',
        'Delete unused test artifacts (screenshots, traces, videos)',
        'Archive old test runs to external storage',
        'Contact your administrator to increase storage quota',
      ] : [],
    };
  });

  // Feature #604: Cleanup old baselines endpoint
  app.post<{ Body: { olderThanDays?: number; dryRun?: boolean } }>('/api/v1/visual/cleanup-baselines', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { olderThanDays = 90, dryRun = false } = request.body || {};
    const orgId = getOrganizationId(request);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const candidatesForDeletion: Array<{
      path: string;
      size: number;
      modifiedAt: Date;
    }> = [];

    let totalBytesToFree = 0;

    // Scan baselines directory for old files
    function scanDirectory(dirPath: string) {
      if (!fs.existsSync(dirPath)) return;

      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            scanDirectory(entryPath);
          } else if (entry.isFile() && entry.name.endsWith('.png')) {
            try {
              const stats = fs.statSync(entryPath);
              if (stats.mtime < cutoffDate) {
                candidatesForDeletion.push({
                  path: entryPath,
                  size: stats.size,
                  modifiedAt: stats.mtime,
                });
                totalBytesToFree += stats.size;
              }
            } catch {
              // Ignore files we can't stat
            }
          }
        }
      } catch {
        // Ignore errors reading directory
      }
    }

    scanDirectory(BASELINES_DIR);

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        message: `Found ${candidatesForDeletion.length} baselines older than ${olderThanDays} days`,
        candidatesCount: candidatesForDeletion.length,
        bytesToFree: totalBytesToFree,
        mbToFree: Math.round((totalBytesToFree / (1024 * 1024)) * 100) / 100,
        candidates: candidatesForDeletion.slice(0, 100).map(c => ({
          path: c.path.replace(process.cwd(), ''),
          size_bytes: c.size,
          modified_at: c.modifiedAt.toISOString(),
        })),
      };
    }

    // Actually delete files
    let deletedCount = 0;
    let deletedBytes = 0;
    const errors: string[] = [];

    for (const candidate of candidatesForDeletion) {
      try {
        fs.unlinkSync(candidate.path);
        deletedCount++;
        deletedBytes += candidate.size;
      } catch (err) {
        errors.push(`Failed to delete ${candidate.path}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    console.log(`[Visual] Cleanup completed: deleted ${deletedCount} baselines, freed ${Math.round(deletedBytes / (1024 * 1024))}MB`);

    return {
      success: true,
      dryRun: false,
      message: `Deleted ${deletedCount} baselines older than ${olderThanDays} days`,
      deletedCount,
      bytesFreed: deletedBytes,
      mbFreed: Math.round((deletedBytes / (1024 * 1024)) * 100) / 100,
      errors: errors.length > 0 ? errors : undefined,
    };
  });
}
