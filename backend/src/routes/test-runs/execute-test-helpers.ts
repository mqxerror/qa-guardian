/**
 * Feature #1356: Execute Test Helpers Module
 *
 * Contains helper functions used by the executeTest function:
 * - findElementByVisualMatch: Visual element matching using stored fingerprint
 * - saveCrashDump: Save crash dump for debugging
 * - saveScreenshotWithRetry: Save screenshot with retry logic
 * - saveBaselineWithRetry: Save baseline screenshot with retry support
 * - saveBaseline: Synchronous save baseline
 * - checkPageDimensions: Check page dimensions before full-page capture
 * - captureScreenshotWithTimeout: Screenshot capture with timeout
 * - getIgnoreRegionsFromSelectors: Get bounding boxes for CSS selectors
 */

import * as fs from 'fs';
import * as path from 'path';
import { Page } from 'playwright';
import { PNG } from 'pngjs';
import { Locator } from 'playwright';

// Import from existing modules
import {
  SCREENSHOTS_DIR,
  checkStorageQuota,
} from './storage';

import {
  VisualMatchResult,
  extractRegion,
  getBaselinePath,
} from './visual-regression';

import {
  getCrashDumpsDir,
  getSimulatedOversizedPage,
} from './test-simulation';

import { failedUploads } from './baseline-routes';

// Import IgnoreRegion from test-suites
import { IgnoreRegion } from '../test-suites';

// ============================================================================
// Types and Interfaces
// ============================================================================

// Feature #606: Interface for crash dump data
export interface CrashDumpData {
  timestamp: string;
  testId: string;
  testName: string;
  runId: string;
  errorMessage: string;
  originalError: string;
  browserType: string;
  targetUrl?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  stepResults?: any[];
  suggestion: string;
}

// Screenshot upload configuration
export interface ScreenshotUploadConfig {
  maxRetries: number;
  retryDelayMs: number;
  timeout: number;
}

export const DEFAULT_UPLOAD_CONFIG: ScreenshotUploadConfig = {
  maxRetries: 3,  // Default 3 retries as per feature spec
  retryDelayMs: 1000,  // 1 second between retries
  timeout: 30000,  // 30 second timeout per upload attempt
};

// Upload error class for network/storage failures
export class ScreenshotUploadError extends Error {
  public readonly isNetworkError: boolean;
  public readonly attemptNumber: number;
  public readonly totalAttempts: number;
  public readonly canRetry: boolean;
  public readonly screenshotPath?: string;
  public readonly screenshotBuffer?: Buffer;

  constructor(
    message: string,
    options: {
      isNetworkError: boolean;
      attemptNumber: number;
      totalAttempts: number;
      canRetry: boolean;
      screenshotPath?: string;
      screenshotBuffer?: Buffer;
    }
  ) {
    super(message);
    this.name = 'ScreenshotUploadError';
    this.isNetworkError = options.isNetworkError;
    this.attemptNumber = options.attemptNumber;
    this.totalAttempts = options.totalAttempts;
    this.canRetry = options.canRetry;
    this.screenshotPath = options.screenshotPath;
    this.screenshotBuffer = options.screenshotBuffer;
  }
}

// Track failed uploads for manual retry
export interface FailedUpload {
  id: string;
  testId: string;
  viewportId: string;
  branch: string;
  screenshotBuffer: Buffer;
  targetPath: string;
  error: string;
  attemptCount: number;
  createdAt: Date;
  organizationId: string;
}

// Feature #601: Screenshot capture with timeout
export const DEFAULT_SCREENSHOT_TIMEOUT = 30000; // 30 seconds default

// Feature #607: Memory protection for large pages
export const MAX_PAGE_HEIGHT_FOR_FULL_CAPTURE = 32000; // Maximum page height in pixels for full-page capture
export const MAX_PAGE_WIDTH_FOR_FULL_CAPTURE = 16000;  // Maximum page width in pixels
export const MAX_ESTIMATED_IMAGE_SIZE_MB = 200;        // Maximum estimated image size in MB (RGBA: height * width * 4)

export interface PageDimensionsResult {
  width: number;
  height: number;
  scrollWidth: number;
  scrollHeight: number;
  isOversized: boolean;
  estimatedSizeMb: number;
  reason?: string;
}

export interface ScreenshotCaptureResult {
  buffer: Buffer | null;
  timedOut: boolean;
  error?: string;
  durationMs: number;
  // Feature #607: Add oversized page info
  isOversized?: boolean;
  pageDimensions?: PageDimensionsResult;
}

// Result interface for selector region resolution with warnings
export interface SelectorRegionResult {
  regions: IgnoreRegion[];
  warnings: string[];
}

// ============================================================================
// Visual Element Matching
// ============================================================================

// Feature #1054: Visual element matching using stored fingerprint
export async function findElementByVisualMatch(
  page: Page,
  fingerprintFilename: string,
  searchRegion?: { x: number; y: number; width: number; height: number }
): Promise<VisualMatchResult> {
  console.log(`[HEALING] Visual matching initiated for fingerprint: ${fingerprintFilename}`);

  const fingerprintPath = path.join(SCREENSHOTS_DIR, fingerprintFilename);
  if (!fs.existsSync(fingerprintPath)) {
    console.log(`[HEALING] Fingerprint file not found: ${fingerprintPath}`);
    return { found: false, confidence: 0, matchMethod: 'none' };
  }

  try {
    // Load fingerprint image
    const fingerprintBuffer = fs.readFileSync(fingerprintPath);
    const fingerprintPng = PNG.sync.read(fingerprintBuffer);
    const fpWidth = fingerprintPng.width;
    const fpHeight = fingerprintPng.height;

    // Take current page screenshot
    const pageScreenshot = await page.screenshot({ type: 'png' });
    const pagePng = PNG.sync.read(pageScreenshot);
    const pageWidth = pagePng.width;
    const pageHeight = pagePng.height;

    console.log(`[HEALING] Fingerprint size: ${fpWidth}x${fpHeight}, Page size: ${pageWidth}x${pageHeight}`);

    // Sliding window search for best match
    // Dynamically import pixelmatch (ESM module)
    const pixelmatch = (await import('pixelmatch')).default;

    let bestMatch = {
      x: 0,
      y: 0,
      mismatchPixels: Infinity,
      confidence: 0,
    };

    const stepSize = Math.max(4, Math.min(fpWidth, fpHeight) / 10); // Adaptive step size
    const searchX = searchRegion?.x ?? 0;
    const searchY = searchRegion?.y ?? 0;
    const searchWidth = searchRegion?.width ?? pageWidth;
    const searchHeight = searchRegion?.height ?? pageHeight;

    // Limit search area to visible region
    const maxX = Math.min(searchX + searchWidth, pageWidth - fpWidth);
    const maxY = Math.min(searchY + searchHeight, pageHeight - fpHeight);

    if (maxX <= 0 || maxY <= 0) {
      console.log('[HEALING] Fingerprint larger than search area, cannot match');
      return { found: false, confidence: 0, matchMethod: 'pixelmatch' };
    }

    // First pass: Coarse search with larger step size
    for (let y = searchY; y < maxY; y += stepSize) {
      for (let x = searchX; x < maxX; x += stepSize) {
        // Extract region from page at position (x, y)
        const regionData = extractRegion(pagePng.data, pageWidth, x, y, fpWidth, fpHeight);

        // Compare region to fingerprint
        const diff = new PNG({ width: fpWidth, height: fpHeight });
        const mismatch = pixelmatch(
          fingerprintPng.data,
          regionData,
          diff.data,
          fpWidth,
          fpHeight,
          { threshold: 0.3 } // Higher threshold for coarse pass
        );

        if (mismatch < bestMatch.mismatchPixels) {
          bestMatch = {
            x,
            y,
            mismatchPixels: mismatch,
            confidence: 1 - (mismatch / (fpWidth * fpHeight)),
          };
        }
      }
    }

    // Second pass: Fine search around best match with step size 1
    if (bestMatch.confidence > 0.5) {
      const fineSearchRadius = stepSize * 2;
      const fineMinX = Math.max(searchX, bestMatch.x - fineSearchRadius);
      const fineMinY = Math.max(searchY, bestMatch.y - fineSearchRadius);
      const fineMaxX = Math.min(maxX, bestMatch.x + fineSearchRadius);
      const fineMaxY = Math.min(maxY, bestMatch.y + fineSearchRadius);

      for (let y = fineMinY; y < fineMaxY; y += 1) {
        for (let x = fineMinX; x < fineMaxX; x += 1) {
          const regionData = extractRegion(pagePng.data, pageWidth, x, y, fpWidth, fpHeight);

          const diff = new PNG({ width: fpWidth, height: fpHeight });
          const mismatch = pixelmatch(
            fingerprintPng.data,
            regionData,
            diff.data,
            fpWidth,
            fpHeight,
            { threshold: 0.1 } // Stricter threshold for fine pass
          );

          if (mismatch < bestMatch.mismatchPixels) {
            bestMatch = {
              x,
              y,
              mismatchPixels: mismatch,
              confidence: 1 - (mismatch / (fpWidth * fpHeight)),
            };
          }
        }
      }
    }

    const totalPixels = fpWidth * fpHeight;
    const foundThreshold = 0.7; // 70% confidence threshold

    console.log(`[HEALING] Visual match result: confidence=${bestMatch.confidence.toFixed(3)}, position=(${bestMatch.x}, ${bestMatch.y})`);

    if (bestMatch.confidence >= foundThreshold) {
      return {
        found: true,
        confidence: bestMatch.confidence,
        matchLocation: {
          x: bestMatch.x,
          y: bestMatch.y,
          width: fpWidth,
          height: fpHeight,
        },
        matchMethod: 'pixelmatch',
        mismatchPixels: bestMatch.mismatchPixels,
        totalPixels,
      };
    }

    return {
      found: false,
      confidence: bestMatch.confidence,
      matchMethod: 'pixelmatch',
      mismatchPixels: bestMatch.mismatchPixels,
      totalPixels,
    };
  } catch (err: any) {
    console.error('[HEALING] Visual matching error:', err.message);
    return { found: false, confidence: 0, matchMethod: 'none' };
  }
}

// ============================================================================
// Crash Dump Functions
// ============================================================================

// Feature #606: Save crash dump for debugging
export function saveCrashDump(data: CrashDumpData): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `crash-${data.testId}-${timestamp}.json`;
  const filepath = path.join(getCrashDumpsDir(), filename);

  try {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`[Visual][CrashDump] Saved crash dump to ${filename}`);
    return filename;
  } catch (err) {
    console.error(`[Visual][CrashDump] Failed to save crash dump:`, err);
    return '';
  }
}

// ============================================================================
// Screenshot Upload Functions
// ============================================================================

// Save screenshot with retry logic
export async function saveScreenshotWithRetry(
  targetPath: string,
  screenshotBuffer: Buffer,
  config: ScreenshotUploadConfig = DEFAULT_UPLOAD_CONFIG
): Promise<{ success: boolean; error?: string; attempts: number; isQuotaExceeded?: boolean; suggestions?: string[] }> {
  // Feature #604: Check storage quota before attempting save
  const quotaCheck = checkStorageQuota(screenshotBuffer.length);
  if (!quotaCheck.allowed && quotaCheck.error) {
    console.error(`[Visual] Storage quota exceeded. Used: ${quotaCheck.error.usedBytes} bytes, Quota: ${quotaCheck.error.quotaBytes} bytes`);
    return {
      success: false,
      error: 'Storage quota exceeded',
      attempts: 0,
      isQuotaExceeded: true,
      suggestions: quotaCheck.error.suggestions,
    };
  }

  // Log warning if approaching quota
  if (quotaCheck.warning) {
    console.warn(`[Visual] ${quotaCheck.warning}`);
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      console.log(`[Visual] Screenshot save attempt ${attempt}/${config.maxRetries} to ${targetPath}`);

      // Ensure directory exists
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Simulate network operation with timeout wrapper
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Screenshot upload timeout - network error'));
        }, config.timeout);

        try {
          // In production, this would be an S3/MinIO upload
          // For now, we simulate with local file save that can fail
          fs.writeFileSync(targetPath, screenshotBuffer);
          clearTimeout(timeoutId);
          resolve();
        } catch (err) {
          clearTimeout(timeoutId);
          reject(err);
        }
      });

      console.log(`[Visual] Screenshot saved successfully on attempt ${attempt}`);
      return { success: true, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isNetworkError = lastError.message.includes('network') ||
                            lastError.message.includes('timeout') ||
                            lastError.message.includes('ECONNRESET') ||
                            lastError.message.includes('ETIMEDOUT') ||
                            lastError.message.includes('ENOTFOUND');

      console.error(`[Visual] Screenshot save attempt ${attempt}/${config.maxRetries} failed: ${lastError.message}`);

      // Wait before retrying (except on last attempt)
      if (attempt < config.maxRetries) {
        console.log(`[Visual] Retrying in ${config.retryDelayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, config.retryDelayMs));
      }
    }
  }

  const errorMessage = lastError?.message || 'Unknown upload error';
  console.error(`[Visual] All ${config.maxRetries} screenshot save attempts failed: ${errorMessage}`);

  return {
    success: false,
    error: `Failed to upload screenshot - network error: ${errorMessage}`,
    attempts: config.maxRetries,
  };
}

// Save baseline screenshot (with retry support)
export async function saveBaselineWithRetry(
  testId: string,
  screenshotBuffer: Buffer,
  viewportId: string = 'default',
  branch: string = 'main',
  organizationId?: string
): Promise<{ success: boolean; error?: string; failedUploadId?: string; isQuotaExceeded?: boolean; suggestions?: string[] }> {
  const baselinePath = getBaselinePath(testId, viewportId, branch);
  const result = await saveScreenshotWithRetry(baselinePath, screenshotBuffer);

  if (!result.success) {
    // Feature #604: Handle storage quota exceeded - don't store for retry since it will fail again
    if (result.isQuotaExceeded) {
      console.error(`[Visual] Storage quota exceeded - baseline save blocked for test ${testId}`);
      return {
        success: false,
        error: result.error,
        isQuotaExceeded: true,
        suggestions: result.suggestions,
      };
    }

    // Store failed upload for manual retry (only for non-quota errors)
    const failedUploadId = `${testId}-${viewportId}-${branch}-${Date.now()}`;
    failedUploads.set(failedUploadId, {
      id: failedUploadId,
      testId,
      viewportId,
      branch,
      screenshotBuffer,
      targetPath: baselinePath,
      error: result.error || 'Upload failed',
      attemptCount: result.attempts,
      createdAt: new Date(),
      organizationId: organizationId || 'unknown',
    });

    console.error(`[Visual] Stored failed upload ${failedUploadId} for manual retry`);
    return {
      success: false,
      error: result.error,
      failedUploadId,
    };
  }

  console.log(`[Visual] Saved baseline for test ${testId} viewport ${viewportId} branch ${branch}`);
  return { success: true };
}

// Synchronous save baseline (original function for backward compatibility)
// Feature #604: Now checks storage quota before saving
export function saveBaseline(testId: string, screenshotBuffer: Buffer, viewportId: string = 'default', branch: string = 'main'): { success: boolean; error?: string; isQuotaExceeded?: boolean; suggestions?: string[] } {
  // Check storage quota before saving
  const quotaCheck = checkStorageQuota(screenshotBuffer.length);
  if (!quotaCheck.allowed && quotaCheck.error) {
    console.error(`[Visual] Storage quota exceeded. Cannot save baseline for test ${testId}`);
    return {
      success: false,
      error: 'Storage quota exceeded',
      isQuotaExceeded: true,
      suggestions: quotaCheck.error.suggestions,
    };
  }

  const baselinePath = getBaselinePath(testId, viewportId, branch);
  fs.writeFileSync(baselinePath, screenshotBuffer);
  console.log(`[Visual] Saved baseline for test ${testId} viewport ${viewportId} branch ${branch}`);
  return { success: true };
}

// ============================================================================
// Page Dimension Functions
// ============================================================================

// Feature #607: Check page dimensions before full-page capture to prevent memory exhaustion
export async function checkPageDimensions(page: Page): Promise<PageDimensionsResult> {
  try {
    // Feature #607: Support simulated oversized page for testing
    let dimensions;
    const oversizedState = getSimulatedOversizedPage();
    if (oversizedState.enabled) {
      console.log(`[Visual][SimulatedOversized] Using simulated page dimensions: ${oversizedState.dimensions.width}x${oversizedState.dimensions.height}`);
      dimensions = { ...oversizedState.dimensions };
    } else {
      dimensions = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth || document.body.scrollWidth,
        height: document.documentElement.scrollHeight || document.body.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      }));
    }

    // Estimate image size in MB (RGBA format: 4 bytes per pixel)
    const estimatedSizeMb = (dimensions.width * dimensions.height * 4) / (1024 * 1024);

    let isOversized = false;
    let reason: string | undefined;

    if (dimensions.height > MAX_PAGE_HEIGHT_FOR_FULL_CAPTURE) {
      isOversized = true;
      reason = `Page height (${dimensions.height}px) exceeds maximum safe limit (${MAX_PAGE_HEIGHT_FOR_FULL_CAPTURE}px)`;
    } else if (dimensions.width > MAX_PAGE_WIDTH_FOR_FULL_CAPTURE) {
      isOversized = true;
      reason = `Page width (${dimensions.width}px) exceeds maximum safe limit (${MAX_PAGE_WIDTH_FOR_FULL_CAPTURE}px)`;
    } else if (estimatedSizeMb > MAX_ESTIMATED_IMAGE_SIZE_MB) {
      isOversized = true;
      reason = `Estimated image size (${estimatedSizeMb.toFixed(1)}MB) exceeds maximum safe limit (${MAX_ESTIMATED_IMAGE_SIZE_MB}MB)`;
    }

    return {
      width: dimensions.width,
      height: dimensions.height,
      scrollWidth: dimensions.scrollWidth,
      scrollHeight: dimensions.scrollHeight,
      isOversized,
      estimatedSizeMb,
      reason,
    };
  } catch (err) {
    console.error('[Visual] Failed to check page dimensions:', err);
    return {
      width: 0,
      height: 0,
      scrollWidth: 0,
      scrollHeight: 0,
      isOversized: false,
      estimatedSizeMb: 0,
    };
  }
}

// ============================================================================
// Screenshot Capture Functions
// ============================================================================

export async function captureScreenshotWithTimeout(
  page: Page,
  options: {
    timeout?: number;
    fullPage?: boolean;
    element?: Locator;
  } = {}
): Promise<ScreenshotCaptureResult> {
  const timeout = options.timeout || DEFAULT_SCREENSHOT_TIMEOUT;
  const startTime = Date.now();

  try {
    // Feature #607: Check page dimensions before full-page capture to prevent memory exhaustion
    const isFullPage = options.fullPage ?? true;
    if (isFullPage && !options.element) {
      const pageDimensions = await checkPageDimensions(page);
      if (pageDimensions.isOversized) {
        console.log(`[Visual][Screenshot] Page too large for full-page capture: ${pageDimensions.reason}`);
        return {
          buffer: null,
          timedOut: false,
          error: `Page too large for full-page capture: ${pageDimensions.reason}. Consider using viewport-only capture instead.`,
          durationMs: Date.now() - startTime,
          isOversized: true,
          pageDimensions,
        };
      }
    }

    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Screenshot capture timed out after ${timeout}ms`));
      }, timeout);
    });

    // Create the screenshot promise
    let screenshotPromise: Promise<Buffer>;
    if (options.element) {
      screenshotPromise = options.element.screenshot({ timeout });
    } else {
      screenshotPromise = page.screenshot({ fullPage: isFullPage, timeout });
    }

    // Race between screenshot and timeout
    const buffer = await Promise.race([screenshotPromise, timeoutPromise]);

    return {
      buffer,
      timedOut: false,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isTimeout = errorMessage.includes('timed out') || errorMessage.includes('timeout');

    console.error(`[Visual][Screenshot] ${isTimeout ? 'Timeout' : 'Error'}: ${errorMessage}`);

    return {
      buffer: null,
      timedOut: isTimeout,
      error: isTimeout
        ? `Screenshot capture timed out after ${timeout}ms - page may be slow to render or stabilize`
        : errorMessage,
      durationMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Ignore Region Functions
// ============================================================================

// Helper function to get bounding boxes for CSS selectors and convert to IgnoreRegion
// Feature #603: Returns warnings when selectors match 0 elements
export async function getIgnoreRegionsFromSelectors(page: Page, selectors: string[]): Promise<SelectorRegionResult> {
  const regions: IgnoreRegion[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < selectors.length; i++) {
    const selector = selectors[i];
    if (!selector) continue;
    try {
      const locator = page.locator(selector);
      // Check if element exists and get count
      const count = await locator.count();

      if (count === 0) {
        // Feature #603: Generate warning for mask selector that matched 0 elements
        const warning = `Mask selector matched 0 elements: '${selector}'`;
        warnings.push(warning);
        console.log(`[Visual] ${warning}`);
        continue;
      }

      // Handle multiple matching elements
      for (let j = 0; j < count; j++) {
        const element = locator.nth(j);
        const boundingBox = await element.boundingBox();

        if (boundingBox) {
          regions.push({
            id: `selector-${i}-${j}`,
            x: boundingBox.x,
            y: boundingBox.y,
            width: boundingBox.width,
            height: boundingBox.height,
            name: `${selector}${count > 1 ? ` [${j + 1}]` : ''}`,
          });
          console.log(`[Visual] Resolved selector "${selector}"${count > 1 ? ` [${j + 1}]` : ''} to region: ${boundingBox.x},${boundingBox.y} ${boundingBox.width}x${boundingBox.height}`);
        }
      }
    } catch (err) {
      // Feature #603: Include error in warnings
      const warning = `Error resolving mask selector '${selector}': ${err}`;
      warnings.push(warning);
      console.log(`[Visual] ${warning}`);
    }
  }

  return { regions, warnings };
}
