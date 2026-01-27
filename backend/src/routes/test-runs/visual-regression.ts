/**
 * Visual Regression Testing Module
 * Extracted from test-runs.ts for code organization (Feature #1369)
 *
 * Contains:
 * - Screenshot comparison logic (compareScreenshots)
 * - Baseline management (saveBaseline, loadBaseline, hasBaseline)
 * - Baseline metadata and history storage
 * - Ignore regions logic (applyIgnoreRegions)
 * - Visual diff color configuration
 * - Anti-aliasing tolerance options
 */

import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import { IgnoreRegion } from '../test-suites';

// Baselines directory for visual regression baseline screenshots
export const BASELINES_DIR = path.join(process.cwd(), 'baselines');
if (!fs.existsSync(BASELINES_DIR)) {
  fs.mkdirSync(BASELINES_DIR, { recursive: true });
}

// Baseline history directory
export const BASELINE_HISTORY_DIR = path.join(BASELINES_DIR, 'history');
if (!fs.existsSync(BASELINE_HISTORY_DIR)) {
  fs.mkdirSync(BASELINE_HISTORY_DIR, { recursive: true });
}

// ============================================
// Interfaces
// ============================================

// Visual comparison results storage
export interface VisualComparisonResult {
  hasBaseline: boolean;
  baselineScreenshot?: string; // Base64 encoded baseline image
  diffPercentage?: number; // Percentage of pixels that differ (0-100)
  diffImage?: string; // Base64 encoded diff image
  mismatchedPixels?: number; // Number of pixels that differ
  totalPixels?: number; // Total number of pixels compared
  baselineCorrupted?: boolean; // Feature #600: True if baseline is corrupted
  corruptionError?: string; // Feature #600: Corruption error message
  // Feature #647: Anti-aliasing tolerance info
  antiAliasingTolerance?: 'off' | 'low' | 'medium' | 'high'; // Tolerance level used
  colorThreshold?: number; // Effective color threshold used for comparison
}

// Baseline metadata storage (who approved, when)
export interface BaselineMetadata {
  testId: string;
  viewportId: string;
  branch: string; // Git branch for this baseline (default: 'main')
  approvedBy: string; // User email who approved
  approvedByUserId: string; // User ID who approved
  approvedAt: string; // ISO timestamp
  sourceRunId?: string; // Run ID from which the baseline was approved
  // Feature #266: Additional baseline metadata
  createdAt?: string; // ISO timestamp when baseline was first created
  viewport?: {
    width: number;
    height: number;
    preset?: string; // e.g., 'Desktop', 'iPhone 12', etc.
  };
  browser?: {
    name: string; // e.g., 'chromium', 'firefox', 'webkit'
    version?: string; // Browser version string
  };
  createdByUserId?: string; // User ID who created the original baseline
  createdByUserEmail?: string; // User email who created the original baseline
  // Feature #605: Optimistic locking for concurrent updates
  version?: number; // Incremented on each update for conflict detection
}

// Baseline history entry interface
export interface BaselineHistoryEntry {
  id: string; // Unique ID for this version
  testId: string;
  viewportId: string;
  branch: string; // Git branch for this baseline version (default: 'main')
  version: number; // Version number (1, 2, 3...)
  approvedBy: string; // User email who approved
  approvedByUserId: string; // User ID who approved
  approvedAt: string; // ISO timestamp
  sourceRunId?: string; // Run ID from which the baseline was approved
  filename: string; // Filename in history directory
}

// Load baseline screenshot result interface (Feature #600)
export interface LoadBaselineResult {
  buffer: Buffer | null;
  corrupted: boolean;
  error?: string;
  path?: string;
}

// Feature #449: Configurable diff highlight colors
export interface DiffColorConfig {
  diffColor: [number, number, number];    // RGB color for different pixels
  diffColorAlt: [number, number, number]; // RGB color for anti-aliased pixels
}

// Feature #647: Anti-aliasing tolerance options for cross-browser comparisons
export interface AntiAliasingOptions {
  tolerance: 'off' | 'low' | 'medium' | 'high';
  colorThreshold?: number; // Custom color threshold (0.0-1.0)
}

// ============================================
// Baseline Metadata Store
// ============================================

// In-memory store for baseline metadata (persisted to file)
const baselineMetadataStore = new Map<string, BaselineMetadata>();
const BASELINE_METADATA_FILE = path.join(BASELINES_DIR, 'metadata.json');

// Load baseline metadata from file on startup
function loadBaselineMetadata(): void {
  if (fs.existsSync(BASELINE_METADATA_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(BASELINE_METADATA_FILE, 'utf-8'));
      for (const [key, value] of Object.entries(data)) {
        baselineMetadataStore.set(key, value as BaselineMetadata);
      }
      console.log(`[Visual] Loaded ${baselineMetadataStore.size} baseline metadata entries`);
    } catch (error) {
      console.error('[Visual] Failed to load baseline metadata:', error);
    }
  }
}

// Save baseline metadata to file
function saveBaselineMetadataToFile(): void {
  const data: Record<string, BaselineMetadata> = {};
  for (const [key, value] of baselineMetadataStore.entries()) {
    data[key] = value;
  }
  fs.writeFileSync(BASELINE_METADATA_FILE, JSON.stringify(data, null, 2));
}

// Get baseline metadata key (includes branch for branch-specific baselines)
export function getBaselineMetadataKey(testId: string, viewportId: string, branch: string = 'main'): string {
  return `${testId}-${viewportId}-${branch}`;
}

// Set baseline metadata
export function setBaselineMetadata(metadata: BaselineMetadata): void {
  const key = getBaselineMetadataKey(metadata.testId, metadata.viewportId, metadata.branch);
  baselineMetadataStore.set(key, metadata);
  saveBaselineMetadataToFile();
  console.log(`[Visual] Saved baseline metadata for test ${metadata.testId} viewport ${metadata.viewportId} branch ${metadata.branch}`);
}

// Get baseline metadata
export function getBaselineMetadata(testId: string, viewportId: string, branch: string = 'main'): BaselineMetadata | undefined {
  return baselineMetadataStore.get(getBaselineMetadataKey(testId, viewportId, branch));
}

// Load metadata on module initialization
loadBaselineMetadata();

// ============================================
// Baseline History Store
// ============================================

// In-memory store for baseline history (persisted to file)
const baselineHistoryStore = new Map<string, BaselineHistoryEntry[]>();
const BASELINE_HISTORY_FILE = path.join(BASELINES_DIR, 'history.json');

// Load baseline history from file on startup
function loadBaselineHistory(): void {
  if (fs.existsSync(BASELINE_HISTORY_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(BASELINE_HISTORY_FILE, 'utf-8'));
      for (const [key, value] of Object.entries(data)) {
        baselineHistoryStore.set(key, value as BaselineHistoryEntry[]);
      }
      console.log(`[Visual] Loaded baseline history for ${baselineHistoryStore.size} tests`);
    } catch (error) {
      console.error('[Visual] Failed to load baseline history:', error);
    }
  }
}

// Save baseline history to file
function saveBaselineHistoryToFile(): void {
  const data: Record<string, BaselineHistoryEntry[]> = {};
  for (const [key, value] of baselineHistoryStore.entries()) {
    data[key] = value;
  }
  fs.writeFileSync(BASELINE_HISTORY_FILE, JSON.stringify(data, null, 2));
}

// Get baseline history key (includes branch for branch-specific history)
export function getBaselineHistoryKey(testId: string, viewportId: string, branch: string = 'main'): string {
  return `${testId}-${viewportId}-${branch}`;
}

// Add entry to baseline history
export function addBaselineHistoryEntry(entry: Omit<BaselineHistoryEntry, 'id' | 'version' | 'filename'>, screenshotBuffer: Buffer): BaselineHistoryEntry {
  const branch = entry.branch || 'main';
  const key = getBaselineHistoryKey(entry.testId, entry.viewportId, branch);
  const history = baselineHistoryStore.get(key) || [];

  // Get next version number
  const version = history.length + 1;

  // Generate unique ID and filename (includes branch for uniqueness)
  const id = `${entry.testId}-${entry.viewportId}-${branch}-v${version}-${Date.now()}`;
  const filename = `baseline-${entry.testId}-${entry.viewportId}-${branch}-v${version}.png`;

  // Save the screenshot to history directory
  const historyPath = path.join(BASELINE_HISTORY_DIR, filename);
  fs.writeFileSync(historyPath, screenshotBuffer);

  const historyEntry: BaselineHistoryEntry = {
    ...entry,
    branch,
    id,
    version,
    filename,
  };

  history.push(historyEntry);
  baselineHistoryStore.set(key, history);
  saveBaselineHistoryToFile();

  console.log(`[Visual] Added baseline history entry v${version} for test ${entry.testId} viewport ${entry.viewportId} branch ${branch}`);
  return historyEntry;
}

// Get baseline history for a test
export function getBaselineHistory(testId: string, viewportId: string, branch: string = 'main'): BaselineHistoryEntry[] {
  return baselineHistoryStore.get(getBaselineHistoryKey(testId, viewportId, branch)) || [];
}

// Get a specific baseline history entry by ID
export function getBaselineHistoryEntry(testId: string, viewportId: string, historyId: string, branch: string = 'main'): BaselineHistoryEntry | undefined {
  const history = getBaselineHistory(testId, viewportId, branch);
  return history.find(entry => entry.id === historyId);
}

// Get baseline history image by entry
export function getBaselineHistoryImage(entry: BaselineHistoryEntry): Buffer | null {
  const historyPath = path.join(BASELINE_HISTORY_DIR, entry.filename);
  if (fs.existsSync(historyPath)) {
    return fs.readFileSync(historyPath);
  }
  return null;
}

// Load baseline history on module initialization
loadBaselineHistory();

// ============================================
// Baseline File Operations
// ============================================

// Get baseline path for a test (includes branch for branch-specific baselines)
export function getBaselinePath(testId: string, viewportId: string = 'default', branch: string = 'main'): string {
  // Create branch-specific subdirectory for better organization
  const branchDir = path.join(BASELINES_DIR, branch);
  if (!fs.existsSync(branchDir)) {
    fs.mkdirSync(branchDir, { recursive: true });
  }
  return path.join(branchDir, `baseline-${testId}-${viewportId}.png`);
}

// Synchronous save baseline
// Feature #604: Now checks storage quota before saving (quota check should be done in calling code)
export function saveBaseline(testId: string, screenshotBuffer: Buffer, viewportId: string = 'default', branch: string = 'main'): { success: boolean; error?: string; isQuotaExceeded?: boolean; suggestions?: string[] } {
  const baselinePath = getBaselinePath(testId, viewportId, branch);
  fs.writeFileSync(baselinePath, screenshotBuffer);
  console.log(`[Visual] Saved baseline for test ${testId} viewport ${viewportId} branch ${branch}`);
  return { success: true };
}

// Load baseline screenshot with corruption detection (Feature #600)
export function loadBaseline(testId: string, viewportId: string = 'default', branch: string = 'main'): Buffer | null {
  const baselinePath = getBaselinePath(testId, viewportId, branch);
  if (fs.existsSync(baselinePath)) {
    return fs.readFileSync(baselinePath);
  }
  return null;
}

// Load baseline with validation and corruption detection (Feature #600)
export function loadBaselineWithValidation(testId: string, viewportId: string = 'default', branch: string = 'main'): LoadBaselineResult {
  const baselinePath = getBaselinePath(testId, viewportId, branch);

  if (!fs.existsSync(baselinePath)) {
    return { buffer: null, corrupted: false };
  }

  try {
    const buffer = fs.readFileSync(baselinePath);

    // Validate PNG signature (first 8 bytes)
    const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
      console.error(`[Visual][Corrupted] Baseline image has invalid PNG signature: ${baselinePath}`);
      return {
        buffer: null,
        corrupted: true,
        error: 'Baseline image corrupted or unreadable: Invalid PNG signature',
        path: baselinePath,
      };
    }

    // Try to parse the PNG to validate it's not corrupted
    try {
      PNG.sync.read(buffer);
    } catch (parseErr) {
      console.error(`[Visual][Corrupted] Baseline image failed PNG parsing: ${baselinePath}`, parseErr);
      return {
        buffer: null,
        corrupted: true,
        error: `Baseline image corrupted or unreadable: ${parseErr instanceof Error ? parseErr.message : 'PNG parsing failed'}`,
        path: baselinePath,
      };
    }

    return { buffer, corrupted: false, path: baselinePath };
  } catch (err) {
    console.error(`[Visual][Corrupted] Failed to read baseline file: ${baselinePath}`, err);
    return {
      buffer: null,
      corrupted: true,
      error: `Baseline image corrupted or unreadable: ${err instanceof Error ? err.message : 'File read failed'}`,
      path: baselinePath,
    };
  }
}

// Check if baseline exists
export function hasBaseline(testId: string, viewportId: string = 'default', branch: string = 'main'): boolean {
  return fs.existsSync(getBaselinePath(testId, viewportId, branch));
}

// ============================================
// Diff Color Configuration
// ============================================

// Default diff colors
const DEFAULT_DIFF_COLORS: DiffColorConfig = {
  diffColor: [255, 0, 255],     // Magenta (default)
  diffColorAlt: [255, 255, 0],  // Yellow for anti-aliased
};

// In-memory store for organization diff color preferences
const orgDiffColors: Map<string, DiffColorConfig> = new Map();

// Helper to get diff colors for an organization
export function getDiffColors(orgId?: string): DiffColorConfig {
  if (orgId) {
    const orgColors = orgDiffColors.get(orgId);
    if (orgColors) {
      return orgColors;
    }
  }
  return DEFAULT_DIFF_COLORS;
}

// Helper to set diff colors for an organization
export function setDiffColors(orgId: string, colors: Partial<DiffColorConfig>): DiffColorConfig {
  const current = getDiffColors(orgId);
  const updated: DiffColorConfig = {
    diffColor: colors.diffColor || current.diffColor,
    diffColorAlt: colors.diffColorAlt || current.diffColorAlt,
  };
  orgDiffColors.set(orgId, updated);
  return updated;
}

// ============================================
// Anti-Aliasing Options
// ============================================

// Convert anti-aliasing tolerance to pixelmatch options
export function getPixelmatchOptions(aaOptions?: AntiAliasingOptions) {
  // Default values (strict matching - no anti-aliasing tolerance)
  let threshold = 0.1;
  let includeAA = false;

  if (aaOptions) {
    // Use custom color threshold if specified
    if (aaOptions.colorThreshold !== undefined) {
      threshold = Math.max(0, Math.min(1, aaOptions.colorThreshold));
    } else {
      // Map tolerance level to threshold
      // Higher tolerance = higher threshold = more lenient comparison
      switch (aaOptions.tolerance) {
        case 'off':
          threshold = 0.1; // Strict: 10% color difference tolerance
          includeAA = false; // Exclude anti-aliased pixels (treats them as matches)
          break;
        case 'low':
          // Low tolerance for minor font rendering differences
          threshold = 0.2; // 20% color difference tolerance
          includeAA = false; // Still exclude obvious anti-aliased pixels
          break;
        case 'medium':
          // Medium tolerance for cross-browser font rendering
          threshold = 0.3; // 30% color difference tolerance
          includeAA = false; // Exclude anti-aliased pixels from diff
          break;
        case 'high':
          // High tolerance for significant rendering differences
          // Use this when comparing Chrome vs Firefox font rendering
          threshold = 0.4; // 40% color difference tolerance
          includeAA = false; // Still exclude anti-aliased pixels
          break;
      }
    }
  }

  return { threshold, includeAA };
}

// ============================================
// Ignore Regions
// ============================================

// Helper function to mask out ignore regions in a PNG by setting those pixels to a solid color
export function applyIgnoreRegions(png: PNG, ignoreRegions: IgnoreRegion[]): void {
  const { width, height, data } = png;

  for (const region of ignoreRegions) {
    // Clamp region bounds to image dimensions
    const startX = Math.max(0, Math.floor(region.x));
    const startY = Math.max(0, Math.floor(region.y));
    const endX = Math.min(width, Math.floor(region.x + region.width));
    const endY = Math.min(height, Math.floor(region.y + region.height));

    // Fill the region with a solid magenta color (easy to spot in diff images)
    // Using [255, 0, 255, 255] = magenta with full opacity
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = 255;     // R
        data[idx + 1] = 0;   // G
        data[idx + 2] = 255; // B
        data[idx + 3] = 255; // A
      }
    }
  }
}

// ============================================
// Rejection Metadata Store
// ============================================

// Visual regression rejection metadata storage (who rejected, when, why)
export interface RejectionMetadata {
  testId: string;
  viewportId: string;
  runId: string;
  rejectedBy: string; // User email who rejected
  rejectedByUserId: string; // User ID who rejected
  rejectedAt: string; // ISO timestamp
  reason?: string; // Optional rejection reason
  status: 'rejected_regression'; // Status to mark on the result
}

// In-memory store for rejection metadata (persisted to file)
const rejectionMetadataStore = new Map<string, RejectionMetadata>();
const REJECTION_METADATA_FILE = path.join(BASELINES_DIR, 'rejections.json');

// Load rejection metadata from file on startup
function loadRejectionMetadata(): void {
  if (fs.existsSync(REJECTION_METADATA_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(REJECTION_METADATA_FILE, 'utf-8'));
      for (const [key, value] of Object.entries(data)) {
        rejectionMetadataStore.set(key, value as RejectionMetadata);
      }
      console.log(`[Visual] Loaded ${rejectionMetadataStore.size} rejection metadata entries`);
    } catch (error) {
      console.error('[Visual] Failed to load rejection metadata:', error);
    }
  }
}

// Save rejection metadata to file
function saveRejectionMetadataToFile(): void {
  const data: Record<string, RejectionMetadata> = {};
  for (const [key, value] of rejectionMetadataStore.entries()) {
    data[key] = value;
  }
  fs.writeFileSync(REJECTION_METADATA_FILE, JSON.stringify(data, null, 2));
}

// Get rejection metadata key (unique per run+test+viewport)
export function getRejectionMetadataKey(runId: string, testId: string, viewportId: string): string {
  return `${runId}-${testId}-${viewportId}`;
}

// Set rejection metadata
export function setRejectionMetadata(metadata: RejectionMetadata): void {
  const key = getRejectionMetadataKey(metadata.runId, metadata.testId, metadata.viewportId);
  rejectionMetadataStore.set(key, metadata);
  saveRejectionMetadataToFile();
  console.log(`[Visual] Saved rejection metadata for run ${metadata.runId} test ${metadata.testId} viewport ${metadata.viewportId}`);
}

// Get rejection metadata
export function getRejectionMetadata(runId: string, testId: string, viewportId: string): RejectionMetadata | undefined {
  return rejectionMetadataStore.get(getRejectionMetadataKey(runId, testId, viewportId));
}

// Load rejection metadata on module initialization
loadRejectionMetadata();

// ============================================
// Visual Matching Helpers (for healing)
// ============================================

// Feature #1054: Visual element matching result interface
export interface VisualMatchResult {
  found: boolean;
  confidence: number; // 0-1 confidence score
  matchLocation?: { x: number; y: number; width: number; height: number };
  matchMethod: 'pixelmatch' | 'template' | 'none';
  mismatchPixels?: number;
  totalPixels?: number;
}

// Helper function to extract a region from image data
export function extractRegion(
  data: Uint8Array,
  imageWidth: number,
  startX: number,
  startY: number,
  regionWidth: number,
  regionHeight: number
): Uint8Array {
  const region = new Uint8Array(regionWidth * regionHeight * 4);

  for (let y = 0; y < regionHeight; y++) {
    for (let x = 0; x < regionWidth; x++) {
      const srcIdx = ((startY + y) * imageWidth + (startX + x)) * 4;
      const dstIdx = (y * regionWidth + x) * 4;
      region[dstIdx] = data[srcIdx] ?? 0;         // R
      region[dstIdx + 1] = data[srcIdx + 1] ?? 0; // G
      region[dstIdx + 2] = data[srcIdx + 2] ?? 0; // B
      region[dstIdx + 3] = data[srcIdx + 3] ?? 255; // A (default to opaque)
    }
  }

  return region;
}

// ============================================
// Screenshot Comparison
// ============================================

// Compare screenshots using pixelmatch
export async function compareScreenshots(
  baseline: Buffer,
  current: Buffer,
  ignoreRegions?: IgnoreRegion[],
  orgId?: string,
  aaOptions?: AntiAliasingOptions
): Promise<VisualComparisonResult> {
  try {
    // Dynamic import for ESM-only pixelmatch v6+
    const pixelmatch = (await import('pixelmatch')).default;
    // Parse PNG images
    const baselinePng = PNG.sync.read(baseline);
    const currentPng = PNG.sync.read(current);

    // Check dimensions match
    if (baselinePng.width !== currentPng.width || baselinePng.height !== currentPng.height) {
      console.log(`[Visual] Dimension mismatch: baseline ${baselinePng.width}x${baselinePng.height}, current ${currentPng.width}x${currentPng.height}`);
      // Return as 100% different if dimensions don't match
      return {
        hasBaseline: true,
        diffPercentage: 100,
        mismatchedPixels: baselinePng.width * baselinePng.height,
        totalPixels: baselinePng.width * baselinePng.height,
      };
    }

    const { width, height } = baselinePng;

    // Apply ignore regions to both images if specified
    if (ignoreRegions && ignoreRegions.length > 0) {
      console.log(`[Visual] Applying ${ignoreRegions.length} ignore region(s)`);
      applyIgnoreRegions(baselinePng, ignoreRegions);
      applyIgnoreRegions(currentPng, ignoreRegions);
    }

    const diffPng = new PNG({ width, height });

    // Feature #449: Get configurable diff colors for this organization
    const diffColors = getDiffColors(orgId);

    // Feature #647: Get anti-aliasing tolerance options
    const pmOptions = getPixelmatchOptions(aaOptions);
    const effectiveTolerance = aaOptions?.tolerance ?? 'off';
    const effectiveThreshold = pmOptions.threshold;

    // Log anti-aliasing settings if not using default
    if (effectiveTolerance !== 'off' || aaOptions?.colorThreshold !== undefined) {
      console.log(`[Visual] Anti-aliasing tolerance: ${effectiveTolerance}, threshold: ${effectiveThreshold.toFixed(2)}`);
    }

    // Perform pixel-by-pixel comparison
    const mismatchedPixels = pixelmatch(
      baselinePng.data,
      currentPng.data,
      diffPng.data,
      width,
      height,
      {
        threshold: effectiveThreshold, // Feature #647: Configurable color difference threshold
        includeAA: pmOptions.includeAA, // Include/exclude anti-aliased pixels in diff
        alpha: 0.1, // Blending factor for unchanged pixels in diff output
        diffColor: diffColors.diffColor, // Configurable color for different pixels
        diffColorAlt: diffColors.diffColorAlt, // Configurable color for anti-aliased pixels
      }
    );

    const totalPixels = width * height;
    const diffPercentage = (mismatchedPixels / totalPixels) * 100;

    // Encode diff image to base64
    const diffBuffer = PNG.sync.write(diffPng);
    const diffImage = diffBuffer.toString('base64');

    console.log(`[Visual] Comparison: ${mismatchedPixels} of ${totalPixels} pixels differ (${diffPercentage.toFixed(2)}%)`);

    return {
      hasBaseline: true,
      baselineScreenshot: baseline.toString('base64'),
      diffPercentage,
      diffImage,
      mismatchedPixels,
      totalPixels,
      // Feature #647: Include anti-aliasing info in result
      antiAliasingTolerance: effectiveTolerance,
      colorThreshold: effectiveThreshold,
    };
  } catch (err) {
    // Feature #600: Detect and report corrupted baseline/current images
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isCorruptionError = errorMessage.includes('CRC') ||
                              errorMessage.includes('Invalid') ||
                              errorMessage.includes('unexpected end') ||
                              errorMessage.includes('truncated') ||
                              errorMessage.includes('bad header');

    if (isCorruptionError) {
      console.error('[Visual][Corrupted] Baseline image corrupted or unreadable:', err);
      return {
        hasBaseline: true,
        diffPercentage: 100,
        baselineCorrupted: true,
        corruptionError: `Baseline image corrupted or unreadable: ${errorMessage}`,
      };
    }

    console.error('[Visual] Error comparing screenshots:', err);
    return {
      hasBaseline: true,
      diffPercentage: 100,
    };
  }
}
