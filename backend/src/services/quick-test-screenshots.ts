/**
 * Quick Test Screenshot Storage Service
 * Feature #466: Persist Quick Test screenshots to filesystem with URL references
 *
 * Provides functionality to:
 * - Save screenshots from Wave 2 (Visual + Performance) to disk
 * - Generate URLs for accessing screenshots via API
 * - Organize screenshots by runId for easy retrieval
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from './logger.js';

const log = createLogger('quick-test-screenshots');

// Directory for quick test screenshots
// Uses process.cwd() to ensure consistent path resolution
export const QUICK_TEST_SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots', 'quick-test');

// Ensure directory exists on module load
if (!fs.existsSync(QUICK_TEST_SCREENSHOTS_DIR)) {
  fs.mkdirSync(QUICK_TEST_SCREENSHOTS_DIR, { recursive: true });
  log.info({ dir: QUICK_TEST_SCREENSHOTS_DIR }, 'Created quick-test screenshots directory');
}

// Screenshot types
export type ScreenshotType = 'desktop' | 'mobile';

/**
 * Get the directory path for a specific run's screenshots
 */
export function getRunScreenshotDir(runId: string): string {
  return path.join(QUICK_TEST_SCREENSHOTS_DIR, runId);
}

/**
 * Get the file path for a specific screenshot
 */
export function getScreenshotPath(runId: string, type: ScreenshotType): string {
  return path.join(getRunScreenshotDir(runId), `${type}.png`);
}

/**
 * Save a screenshot to disk
 * @param runId - The quick test run ID
 * @param type - The screenshot type ('desktop' or 'mobile')
 * @param base64Data - The base64-encoded PNG data
 * @returns The relative URL path for accessing the screenshot via API
 */
export async function saveScreenshot(
  runId: string,
  type: ScreenshotType,
  base64Data: string
): Promise<string> {
  const runDir = getRunScreenshotDir(runId);

  // Ensure run directory exists
  if (!fs.existsSync(runDir)) {
    fs.mkdirSync(runDir, { recursive: true });
  }

  const filePath = getScreenshotPath(runId, type);

  // Convert base64 to buffer and write to disk
  const buffer = Buffer.from(base64Data, 'base64');
  await fs.promises.writeFile(filePath, buffer);

  log.info({ runId, type, path: filePath, size: buffer.length }, 'Saved screenshot');

  // Return the API URL for accessing this screenshot
  return `/api/v1/quick-test/${runId}/screenshots/${type}`;
}

/**
 * Read a screenshot from disk
 * @param runId - The quick test run ID
 * @param type - The screenshot type ('desktop' or 'mobile')
 * @returns Buffer containing the PNG data, or null if not found
 */
export async function readScreenshot(
  runId: string,
  type: ScreenshotType
): Promise<Buffer | null> {
  const filePath = getScreenshotPath(runId, type);

  if (!fs.existsSync(filePath)) {
    log.warn({ runId, type, path: filePath }, 'Screenshot not found');
    return null;
  }

  return fs.promises.readFile(filePath);
}

/**
 * Check if a screenshot exists
 */
export function screenshotExists(runId: string, type: ScreenshotType): boolean {
  return fs.existsSync(getScreenshotPath(runId, type));
}

/**
 * Delete all screenshots for a run (used for cleanup)
 */
export async function deleteRunScreenshots(runId: string): Promise<void> {
  const runDir = getRunScreenshotDir(runId);

  if (fs.existsSync(runDir)) {
    await fs.promises.rm(runDir, { recursive: true, force: true });
    log.info({ runId, dir: runDir }, 'Deleted run screenshots');
  }
}

/**
 * Get disk usage for quick test screenshots
 */
export async function getScreenshotsDiskUsage(): Promise<{
  totalBytes: number;
  runCount: number;
}> {
  let totalBytes = 0;
  let runCount = 0;

  if (!fs.existsSync(QUICK_TEST_SCREENSHOTS_DIR)) {
    return { totalBytes, runCount };
  }

  const entries = await fs.promises.readdir(QUICK_TEST_SCREENSHOTS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      runCount++;
      const runDir = path.join(QUICK_TEST_SCREENSHOTS_DIR, entry.name);
      const files = await fs.promises.readdir(runDir);

      for (const file of files) {
        const filePath = path.join(runDir, file);
        const stats = await fs.promises.stat(filePath);
        totalBytes += stats.size;
      }
    }
  }

  return { totalBytes, runCount };
}
