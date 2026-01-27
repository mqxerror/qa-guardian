/**
 * Storage Module
 * Extracted from test-runs.ts for code organization (Feature #1371)
 *
 * Contains:
 * - Storage quota configuration and checking
 * - Directory size calculation utilities
 * - Artifact retention settings
 * - Storage quota error class
 */

import * as fs from 'fs';
import * as path from 'path';
import { BASELINES_DIR } from './visual-regression';

// ============================================
// Directory Constants
// ============================================

// Screenshots directory
export const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Traces directory
export const TRACES_DIR = path.join(process.cwd(), 'traces');
if (!fs.existsSync(TRACES_DIR)) {
  fs.mkdirSync(TRACES_DIR, { recursive: true });
}

// Videos directory
export const VIDEOS_DIR = path.join(process.cwd(), 'videos');
if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

// ============================================
// Types and Interfaces
// ============================================

// Feature #604: Storage quota configuration
export interface StorageQuotaConfig {
  quotaBytes: number;  // Storage quota in bytes
  warningThresholdPercent: number;  // Percentage at which to show warning
}

export const DEFAULT_STORAGE_QUOTA: StorageQuotaConfig = {
  quotaBytes: 500 * 1024 * 1024,  // 500 MB default quota
  warningThresholdPercent: 80,  // Warn at 80% usage
};

// ============================================
// Simulation Flags (for testing)
// ============================================

// Feature #604: Allow simulating storage quota exceeded for testing
let simulatedStorageQuotaExceeded = false;

export function setSimulatedStorageQuotaExceeded(value: boolean): void {
  simulatedStorageQuotaExceeded = value;
  console.log(`[Visual] Storage quota exceeded simulation ${value ? 'ENABLED' : 'DISABLED'}`);
}

export function getSimulatedStorageQuotaExceeded(): boolean {
  return simulatedStorageQuotaExceeded;
}

// ============================================
// Storage Quota Error Class
// ============================================

// Feature #604: Storage quota error class
export class StorageQuotaExceededError extends Error {
  public readonly usedBytes: number;
  public readonly quotaBytes: number;
  public readonly usagePercent: number;
  public readonly suggestions: string[];

  constructor(
    message: string,
    usedBytes: number,
    quotaBytes: number,
    suggestions: string[]
  ) {
    super(message);
    this.name = 'StorageQuotaExceededError';
    this.usedBytes = usedBytes;
    this.quotaBytes = quotaBytes;
    this.usagePercent = Math.round((usedBytes / quotaBytes) * 100);
    this.suggestions = suggestions;
  }
}

// ============================================
// Artifact Retention Settings
// ============================================

// Feature #909: Artifact retention settings per organization (days)
export const artifactRetentionSettings: Map<string, number> = new Map([
  ['1', 90], // Default org 1: 90 days
  ['2', 30], // Default org 2: 30 days
]);

// ============================================
// Storage Calculation Functions
// ============================================

// Feature #604: Calculate storage usage for a directory recursively
export function calculateDirectorySize(dirPath: string): number {
  let totalSize = 0;

  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += calculateDirectorySize(entryPath);
      } else if (entry.isFile()) {
        try {
          const stats = fs.statSync(entryPath);
          totalSize += stats.size;
        } catch {
          // Ignore files we can't stat
        }
      }
    }
  } catch {
    // Ignore errors reading directory
  }

  return totalSize;
}

// Feature #604: Calculate total storage usage across all artifact directories
export function calculateTotalStorageUsage(): { usedBytes: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {
    baselines: calculateDirectorySize(BASELINES_DIR),
    screenshots: calculateDirectorySize(SCREENSHOTS_DIR),
    traces: calculateDirectorySize(TRACES_DIR),
    videos: calculateDirectorySize(VIDEOS_DIR),
  };

  const usedBytes = Object.values(breakdown).reduce((sum, size) => sum + size, 0);

  return { usedBytes, breakdown };
}

// ============================================
// Storage Quota Checking
// ============================================

// Feature #604: Check if storage quota would be exceeded after adding fileSize bytes
export function checkStorageQuota(
  additionalBytes: number,
  config: StorageQuotaConfig = DEFAULT_STORAGE_QUOTA
): { allowed: boolean; error?: StorageQuotaExceededError; warning?: string } {
  // If simulated quota exceeded is enabled, always return exceeded
  if (simulatedStorageQuotaExceeded) {
    const suggestions = [
      'Clean up old baselines that are no longer needed',
      'Delete unused test artifacts (screenshots, traces, videos)',
      'Archive old test runs to external storage',
      'Contact your administrator to increase storage quota',
    ];
    return {
      allowed: false,
      error: new StorageQuotaExceededError(
        'Storage quota exceeded',
        config.quotaBytes,  // Report as if storage is full
        config.quotaBytes,
        suggestions
      ),
    };
  }

  const { usedBytes } = calculateTotalStorageUsage();
  const projectedUsage = usedBytes + additionalBytes;
  const usagePercent = Math.round((projectedUsage / config.quotaBytes) * 100);

  // Check if quota would be exceeded
  if (projectedUsage > config.quotaBytes) {
    const suggestions = [
      'Clean up old baselines that are no longer needed',
      'Delete unused test artifacts (screenshots, traces, videos)',
      'Archive old test runs to external storage',
      'Contact your administrator to increase storage quota',
    ];

    return {
      allowed: false,
      error: new StorageQuotaExceededError(
        'Storage quota exceeded',
        usedBytes,
        config.quotaBytes,
        suggestions
      ),
    };
  }

  // Check if usage is above warning threshold
  if (usagePercent >= config.warningThresholdPercent) {
    return {
      allowed: true,
      warning: `Storage usage at ${usagePercent}% (${Math.round(usedBytes / (1024 * 1024))}MB / ${Math.round(config.quotaBytes / (1024 * 1024))}MB). Consider cleaning up old baselines.`,
    };
  }

  return { allowed: true };
}

// ============================================
// Utility Functions
// ============================================

// Format bytes to human-readable string
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
