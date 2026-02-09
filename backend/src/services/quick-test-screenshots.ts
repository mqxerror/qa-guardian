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
import * as crypto from 'crypto';
import { createLogger } from './logger.js';

const log = createLogger('quick-test-screenshots');

// Signed URL configuration
// Feature #478: Authentication for screenshot endpoint
const SIGNED_URL_SECRET = process.env.JWT_SECRET || 'qa-guardian-development-secret';
const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

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
 * Feature #478: Updated to generate signed URLs for security
 * @param runId - The quick test run ID
 * @param type - The screenshot type ('desktop' or 'mobile')
 * @param base64Data - The base64-encoded PNG data
 * @param orgId - The organization ID (for generating signed URL)
 * @returns The signed URL path for accessing the screenshot via API
 */
export async function saveScreenshot(
  runId: string,
  type: ScreenshotType,
  base64Data: string,
  orgId?: string
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

  // Feature #478: Return signed URL if orgId provided, otherwise plain URL
  // The plain URL will require JWT auth; signed URL allows <img> tag loading
  if (orgId) {
    return generateSignedScreenshotUrl(runId, type, orgId);
  }

  // Fallback for backward compatibility (though this should always have orgId)
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

/**
 * Feature #478: Generate a signed URL token for screenshot access
 * This allows <img> tags to load screenshots without auth headers
 * @param runId - The quick test run ID
 * @param type - The screenshot type
 * @param orgId - The organization ID (for scoping)
 * @returns Signed token that can be used as query parameter
 */
export function generateSignedScreenshotToken(
  runId: string,
  type: ScreenshotType,
  orgId: string
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_EXPIRY_SECONDS;
  const payload = `${runId}:${type}:${orgId}:${expiresAt}`;
  const signature = crypto
    .createHmac('sha256', SIGNED_URL_SECRET)
    .update(payload)
    .digest('hex');

  // Return base64-encoded token containing payload and signature
  const token = Buffer.from(`${payload}:${signature}`).toString('base64url');
  log.debug({ runId, type, orgId, expiresAt }, 'Generated signed screenshot token');
  return token;
}

/**
 * Feature #478: Generate a signed URL for screenshot access
 * @param runId - The quick test run ID
 * @param type - The screenshot type
 * @param orgId - The organization ID
 * @returns Full URL with signed token query parameter
 */
export function generateSignedScreenshotUrl(
  runId: string,
  type: ScreenshotType,
  orgId: string
): string {
  const token = generateSignedScreenshotToken(runId, type, orgId);
  return `/api/v1/quick-test/${runId}/screenshots/${type}?token=${token}`;
}

/**
 * Feature #478: Validate a signed URL token for screenshot access
 * @param token - The signed token from query parameter
 * @param runId - The runId from the URL path (for verification)
 * @param type - The screenshot type from URL path (for verification)
 * @returns The orgId if valid, null if invalid or expired
 */
export function validateSignedScreenshotToken(
  token: string,
  runId: string,
  type: ScreenshotType
): string | null {
  try {
    // Decode the token
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');

    if (parts.length !== 5) {
      log.warn({ token: token.substring(0, 20) + '...' }, 'Invalid token format');
      return null;
    }

    const [tokenRunId, tokenType, orgId, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    // Verify runId and type match
    if (tokenRunId !== runId || tokenType !== type) {
      log.warn({ tokenRunId, runId, tokenType, type }, 'Token path mismatch');
      return null;
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (now > expiresAt) {
      log.warn({ runId, expiresAt, now }, 'Token expired');
      return null;
    }

    // Verify signature
    const payload = `${tokenRunId}:${tokenType}:${orgId}:${expiresAtStr}`;
    const expectedSignature = crypto
      .createHmac('sha256', SIGNED_URL_SECRET)
      .update(payload)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (signatureBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      log.warn({ runId }, 'Invalid token signature');
      return null;
    }

    log.debug({ runId, type, orgId }, 'Validated signed screenshot token');
    return orgId;
  } catch (err) {
    log.warn({ error: err }, 'Error validating signed token');
    return null;
  }
}
