/**
 * Feature #154: Data Retention Cleanup Job
 *
 * Manages automatic cleanup of old test runs, screenshots, and traces
 * based on configurable retention policies.
 */

import { isDatabaseConnected, query } from '../services/database.js';
import { deleteExpiredQuickTestComparisons } from '../services/repositories/quick-test.js';
import { createLogger } from '../services/logger.js';
import fs from 'fs';
import path from 'path';

// Use structured logger
const logger = createLogger('cleanup');

// Configuration
const RETENTION_DAYS = parseInt(process.env.DATA_RETENTION_DAYS || '90', 10);
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // Run daily
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || './artifacts';

// State
let cleanupInterval: NodeJS.Timeout | null = null;
const cleanupStats = {
  status: 'idle' as 'idle' | 'running' | 'completed' | 'error',
  lastRun: null as Date | null,
  nextRun: null as Date | null,
  deletedRuns: 0,
  deletedFiles: 0,
  freedBytes: 0,
  errorMessage: null as string | null,
};

/**
 * Initialize the cleanup job - runs on startup and then daily
 */
export function initializeCleanupJob(): void {
  logger.info(`[Cleanup] Initializing data retention cleanup job (retention: ${RETENTION_DAYS} days)`);

  // Schedule the next run
  scheduleNextRun();

  // Run initial cleanup after a delay to let the server start up
  setTimeout(() => {
    runCleanup().catch(err => {
      logger.error({ err }, 'Initial cleanup failed');
    });
  }, 5000);
}

/**
 * Stop the cleanup job
 */
export function stopCleanupJob(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('[Cleanup] Cleanup job stopped');
  }
}

/**
 * Get current cleanup statistics
 */
export function getCleanupStats(): typeof cleanupStats {
  return { ...cleanupStats };
}

/**
 * Schedule the next cleanup run
 */
function scheduleNextRun(): void {
  const nextRun = new Date(Date.now() + CLEANUP_INTERVAL_MS);
  cleanupStats.nextRun = nextRun;

  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  cleanupInterval = setInterval(() => {
    runCleanup().catch(err => {
      logger.error({ err }, 'Scheduled cleanup failed');
    });
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Run the cleanup process
 */
async function runCleanup(): Promise<void> {
  if (cleanupStats.status === 'running') {
    logger.warn('[Cleanup] Cleanup already in progress, skipping');
    return;
  }

  cleanupStats.status = 'running';
  cleanupStats.errorMessage = null;

  const startTime = Date.now();
  let deletedRuns = 0;
  let deletedFiles = 0;
  let freedBytes = 0;

  try {
    logger.info('[Cleanup] Starting data retention cleanup...');

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    // Cleanup database records
    if (isDatabaseConnected()) {
      const dbResult = await cleanupDatabaseRecords(cutoffDate);
      deletedRuns = dbResult.deletedRuns;

      // Feature #670: Clean up expired quick test comparisons
      const deletedComparisons = await deleteExpiredQuickTestComparisons();
      if (deletedComparisons > 0) {
        logger.info(`[Cleanup] Deleted ${deletedComparisons} expired quick test comparisons`);
      }
    } else {
      logger.info('[Cleanup] Database not connected, skipping DB cleanup');
    }

    // Cleanup artifact files
    const fileResult = await cleanupArtifactFiles(cutoffDate);
    deletedFiles = fileResult.deletedFiles;
    freedBytes = fileResult.freedBytes;

    cleanupStats.status = 'completed';
    cleanupStats.lastRun = new Date();
    cleanupStats.deletedRuns = deletedRuns;
    cleanupStats.deletedFiles = deletedFiles;
    cleanupStats.freedBytes = freedBytes;

    // Schedule next run
    cleanupStats.nextRun = new Date(Date.now() + CLEANUP_INTERVAL_MS);

    const duration = Date.now() - startTime;
    logger.info(`[Cleanup] Cleanup completed in ${duration}ms - deleted ${deletedRuns} runs, ${deletedFiles} files, freed ${formatBytes(freedBytes)}`);

  } catch (error) {
    cleanupStats.status = 'error';
    cleanupStats.errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error }, 'Cleanup failed');
    throw error;
  }
}

/**
 * Cleanup old database records
 */
async function cleanupDatabaseRecords(cutoffDate: Date): Promise<{ deletedRuns: number }> {
  try {
    // Delete old test runs (this will cascade to related records if foreign keys are set up)
    const result = await query(
      `DELETE FROM test_runs WHERE created_at < $1 RETURNING id`,
      [cutoffDate]
    );

    const deletedRuns = result?.rowCount || 0;
    logger.info(`[Cleanup] Deleted ${deletedRuns} test runs older than ${cutoffDate.toISOString()}`);

    return { deletedRuns };
  } catch (error) {
    logger.error({ error }, 'Database cleanup failed');
    return { deletedRuns: 0 };
  }
}

/**
 * Cleanup old artifact files (screenshots, videos, traces)
 */
async function cleanupArtifactFiles(cutoffDate: Date): Promise<{ deletedFiles: number; freedBytes: number }> {
  let deletedFiles = 0;
  let freedBytes = 0;

  const artifactDirs = [
    path.join(ARTIFACTS_DIR, 'screenshots'),
    path.join(ARTIFACTS_DIR, 'videos'),
    path.join(ARTIFACTS_DIR, 'traces'),
  ];

  for (const dir of artifactDirs) {
    try {
      if (!fs.existsSync(dir)) {
        continue;
      }

      const files = fs.readdirSync(dir);

      for (const file of files) {
        const filePath = path.join(dir, file);
        try {
          const stats = fs.statSync(filePath);

          if (stats.mtime < cutoffDate) {
            freedBytes += stats.size;
            fs.unlinkSync(filePath);
            deletedFiles++;
          }
        } catch (fileError) {
          // Skip files that can't be accessed
          logger.warn({ filePath, error: fileError }, `Could not process file ${filePath}`);
        }
      }
    } catch (dirError) {
      logger.warn({ dir, error: dirError }, `Could not access directory ${dir}`);
    }
  }

  logger.info(`[Cleanup] Deleted ${deletedFiles} artifact files, freed ${formatBytes(freedBytes)}`);

  return { deletedFiles, freedBytes };
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Export for testing
export { runCleanup };
