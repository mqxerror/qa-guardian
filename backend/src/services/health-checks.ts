/**
 * Feature #359: Health check utility functions
 * Extracted from index.ts to reduce monolithic file size
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface DiskSpaceInfo {
  healthy: boolean;
  freeGB: number;
  totalGB: number;
  usedPercent: number;
  warning: string | null;
}

export interface VersionInfo {
  version: string;
  commit: string | null;
  buildTime: string | null;
}

export interface BackupStatus {
  configured: boolean;
  lastBackup: string | null;
  status: string;
  backupsCount: number;
  retentionDays: number;
}

/**
 * Feature #152: Check disk space and warn if < 1GB free
 */
export async function checkDiskSpace(): Promise<DiskSpaceInfo> {
  const { execSync } = await import('child_process');

  try {
    // Try to get disk space info
    let freeBytes = 0;
    let totalBytes = 0;

    try {
      // Works on Linux/macOS
      const dfOutput = execSync('df -k . 2>/dev/null || df -k / 2>/dev/null', { encoding: 'utf-8' });
      const lines = dfOutput.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        // df -k outputs in 1K blocks: Filesystem, 1K-blocks, Used, Available, Use%, Mounted
        totalBytes = parseInt(parts[1], 10) * 1024;
        freeBytes = parseInt(parts[3], 10) * 1024;
      }
    } catch {
      // Fallback: estimate from OS memory (not accurate but provides a response)
      totalBytes = os.totalmem();
      freeBytes = os.freemem();
    }

    const freeGB = Math.round((freeBytes / 1024 / 1024 / 1024) * 100) / 100;
    const totalGB = Math.round((totalBytes / 1024 / 1024 / 1024) * 100) / 100;
    const usedPercent = totalBytes > 0 ? Math.round(((totalBytes - freeBytes) / totalBytes) * 100) : 0;

    // Warning if < 1GB free
    const warning = freeGB < 1 ? `Low disk space: ${freeGB}GB free` : null;
    const healthy = freeGB >= 1;

    return { healthy, freeGB, totalGB, usedPercent, warning };
  } catch (error) {
    return {
      healthy: true, // Assume healthy if we can't check
      freeGB: 0,
      totalGB: 0,
      usedPercent: 0,
      warning: 'Could not determine disk space',
    };
  }
}

/**
 * Feature #152: Get version info from package.json and environment
 */
export function getVersionInfo(): VersionInfo {
  let version = '1.0.0';

  // Try to read version from package.json
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      version = packageJson.version || version;
    }
  } catch {
    // Use default version
  }

  // Get commit hash from environment (set during Docker build)
  const commit = process.env.BUILD_COMMIT || process.env.GIT_COMMIT || null;

  // Get build time from environment
  const buildTime = process.env.BUILD_TIME || null;

  return { version, commit, buildTime };
}

/**
 * Feature #151: Get backup status from status file
 */
export async function getBackupStatus(): Promise<BackupStatus> {
  const backupDir = process.env.BACKUP_DIR || '/opt/backups';
  const statusFile = path.join(backupDir, '.backup_status.json');

  try {
    if (fs.existsSync(statusFile)) {
      const content = fs.readFileSync(statusFile, 'utf-8');
      const status = JSON.parse(content);
      return {
        configured: true,
        lastBackup: status.last_backup || null,
        status: status.status || 'unknown',
        backupsCount: status.backups_count || 0,
        retentionDays: status.retention_days || 30,
      };
    }
  } catch (e) {
    // Status file not readable
  }

  return {
    configured: false,
    lastBackup: null,
    status: 'not_configured',
    backupsCount: 0,
    retentionDays: 30,
  };
}

/**
 * Feature #152: Get memory usage statistics
 */
export function getMemoryUsage(): {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  systemFree: number;
  systemTotal: number;
} {
  return {
    heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    external: Math.round(process.memoryUsage().external / 1024 / 1024),
    systemFree: Math.round(os.freemem() / 1024 / 1024),
    systemTotal: Math.round(os.totalmem() / 1024 / 1024),
  };
}

/**
 * Feature #152: Ensure required directories exist for screenshots, traces, videos
 */
export function ensureFilesystemDirectories(): boolean {
  try {
    const dirs = ['screenshots', 'traces', 'videos'].map((d: string) => path.join(process.cwd(), d));
    dirs.forEach((dir: string) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    return true;
  } catch {
    return false;
  }
}
