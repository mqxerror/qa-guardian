/**
 * Dependency Scanner Service
 *
 * Feature #562: Replace simulated Dependency Scan with npm audit integration
 *
 * Provides real dependency vulnerability scanning using `npm audit --json`.
 * Parses npm audit v2 JSON output and maps it to the app's existing
 * dependency/vulnerability interface.
 *
 * Graceful fallback: Returns an informative error if:
 * - npm is not available
 * - No package-lock.json exists
 * - npm audit fails for any reason
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from './logger.js';

const execFileAsync = promisify(execFile);
const log = createLogger('dependency-scanner');

// ============================================================================
// Types
// ============================================================================

export type DepSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface DepVulnerability {
  cve_id: string;
  severity: DepSeverity;
  title: string;
  description: string;
  published_date: string;
  patched_version: string;
  cwe_ids: string[];
  references: string[];
}

export interface ScannedDependency {
  name: string;
  version: string;
  latest_version: string;
  type: 'production' | 'development';
  vulnerabilities: DepVulnerability[];
  update_available: boolean;
  outdated: boolean;
}

export interface DependencyScanResult {
  dependencies: ScannedDependency[];
  metadata: {
    total_dependencies: number;
    prod_dependencies: number;
    dev_dependencies: number;
    vulnerabilities: {
      critical: number;
      high: number;
      moderate: number;
      low: number;
      info: number;
      total: number;
    };
  };
  scan_path: string;
  scanned_at: string;
  error?: string;
}

// ============================================================================
// npm audit v2 JSON types
// ============================================================================

interface NpmAuditVia {
  source?: number;
  name?: string;
  dependency?: string;
  title?: string;
  url?: string;
  severity?: string;
  cwe?: string[];
  cvss?: {
    score?: number;
    vectorString?: string;
  };
  range?: string;
}

interface NpmAuditVulnerability {
  name: string;
  severity: string;
  isDirect: boolean;
  via: (string | NpmAuditVia)[];
  effects: string[];
  range: string;
  nodes: string[];
  fixAvailable: boolean | {
    name: string;
    version: string;
    isSemVerMajor: boolean;
  };
}

interface NpmAuditReport {
  auditReportVersion?: number;
  vulnerabilities: Record<string, NpmAuditVulnerability>;
  metadata: {
    vulnerabilities: {
      info: number;
      low: number;
      moderate: number;
      high: number;
      critical: number;
      total: number;
    };
    dependencies: {
      prod: number;
      dev: number;
      optional: number;
      peer: number;
      peerOptional: number;
      total: number;
    };
  };
}

// ============================================================================
// Severity Mapping
// ============================================================================

/** Map npm audit severity to our severity schema */
function mapSeverity(npmSeverity: string): DepSeverity {
  switch (npmSeverity) {
    case 'critical': return 'critical';
    case 'high': return 'high';
    case 'moderate': return 'medium';
    case 'low': return 'low';
    case 'info': return 'info';
    default: return 'low';
  }
}

// ============================================================================
// Scanner Entry Point
// ============================================================================

/**
 * Run npm audit against a project directory and return parsed results.
 *
 * @param scanPath - Directory containing package.json and package-lock.json
 * @param includeDevDeps - Whether to include dev dependencies (default: true)
 * @returns Parsed dependency scan results
 */
export async function runDependencyScan(
  scanPath: string,
  includeDevDeps = true
): Promise<DependencyScanResult> {
  const now = new Date().toISOString();

  // Check for package-lock.json
  const lockFilePath = path.join(scanPath, 'package-lock.json');
  const packageJsonPath = path.join(scanPath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    log.warn({ scanPath }, 'No package.json found in scan path');
    return {
      dependencies: [],
      metadata: {
        total_dependencies: 0,
        prod_dependencies: 0,
        dev_dependencies: 0,
        vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 },
      },
      scan_path: scanPath,
      scanned_at: now,
      error: 'No package.json found in the project directory. Cannot perform dependency audit.',
    };
  }

  if (!fs.existsSync(lockFilePath)) {
    log.warn({ scanPath }, 'No package-lock.json found - npm audit requires a lockfile');
    return {
      dependencies: [],
      metadata: {
        total_dependencies: 0,
        prod_dependencies: 0,
        dev_dependencies: 0,
        vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 },
      },
      scan_path: scanPath,
      scanned_at: now,
      error: 'No package-lock.json found. Run `npm install` first to generate a lockfile for dependency auditing.',
    };
  }

  try {
    // Build npm audit command args
    const args = ['audit', '--json'];
    if (!includeDevDeps) {
      args.push('--omit=dev');
    }

    log.info({ scanPath, includeDevDeps }, 'Running npm audit');

    let stdout: string;
    try {
      const result = await execFileAsync('npm', args, {
        cwd: scanPath,
        timeout: 60000, // 60 second timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large audit reports
      });
      stdout = result.stdout;
    } catch (execErr: unknown) {
      // npm audit exits with code 1 when vulnerabilities are found
      // This is expected behavior, not an error
      const err = execErr as { code?: number; stdout?: string; stderr?: string };
      if (err.stdout) {
        stdout = err.stdout;
      } else {
        throw execErr;
      }
    }

    // Parse the JSON output
    const auditReport: NpmAuditReport = JSON.parse(stdout);

    // Read package.json to get dependency types
    let packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
    try {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    } catch {
      // Continue without package.json parsing
    }

    const prodDeps = new Set(Object.keys(packageJson.dependencies || {}));
    const devDeps = new Set(Object.keys(packageJson.devDependencies || {}));

    // Convert npm audit vulnerabilities to our format
    const dependencies: ScannedDependency[] = [];

    for (const [pkgName, vuln] of Object.entries(auditReport.vulnerabilities)) {
      // Determine dependency type
      const isDev = devDeps.has(pkgName) && !prodDeps.has(pkgName);
      const depType: 'production' | 'development' = isDev ? 'development' : 'production';

      // Skip dev deps if not included
      if (!includeDevDeps && isDev) continue;

      // Get the installed version from node_modules
      let installedVersion = 'unknown';
      try {
        const pkgJsonPath = path.join(scanPath, 'node_modules', pkgName, 'package.json');
        if (fs.existsSync(pkgJsonPath)) {
          const pkgData = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
          installedVersion = pkgData.version || 'unknown';
        }
      } catch {
        // Keep as 'unknown'
      }

      // Extract vulnerability details from 'via' entries
      const vulnDetails: DepVulnerability[] = [];
      for (const via of vuln.via) {
        // Only process advisory objects, not string references
        if (typeof via === 'object' && via.title) {
          vulnDetails.push({
            cve_id: via.url ? via.url.split('/').pop() || `GHSA-${via.source || 'unknown'}` : `Advisory-${via.source || 'unknown'}`,
            severity: mapSeverity(via.severity || vuln.severity),
            title: via.title,
            description: via.title, // npm audit v2 doesn't provide full descriptions
            published_date: now.split('T')[0]!, // Advisory date not in v2 format
            patched_version: via.range ? `Fixed outside range: ${via.range}` : 'See advisory',
            cwe_ids: via.cwe || [],
            references: via.url ? [via.url] : [],
          });
        }
      }

      // Determine fix availability
      let latestVersion = installedVersion;
      let updateAvailable = false;
      if (typeof vuln.fixAvailable === 'object' && vuln.fixAvailable.version) {
        // Fix is through updating a root dependency
        if (vuln.fixAvailable.name === pkgName) {
          latestVersion = vuln.fixAvailable.version;
          updateAvailable = true;
        } else {
          // Fix is through a transitive dependency update
          updateAvailable = true;
          latestVersion = `via ${vuln.fixAvailable.name}@${vuln.fixAvailable.version}`;
        }
      } else if (vuln.fixAvailable === true) {
        updateAvailable = true;
      }

      dependencies.push({
        name: pkgName,
        version: installedVersion,
        latest_version: latestVersion,
        type: depType,
        vulnerabilities: vulnDetails,
        update_available: updateAvailable,
        outdated: updateAvailable,
      });
    }

    // Sort by severity (critical first)
    const sevOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    dependencies.sort((a, b) => {
      const aMax = Math.max(...a.vulnerabilities.map(v => sevOrder[v.severity] || 0), sevOrder[mapSeverity(auditReport.vulnerabilities[a.name]?.severity || 'low')] || 0);
      const bMax = Math.max(...b.vulnerabilities.map(v => sevOrder[v.severity] || 0), sevOrder[mapSeverity(auditReport.vulnerabilities[b.name]?.severity || 'low')] || 0);
      return bMax - aMax;
    });

    const metadata = auditReport.metadata;

    log.info(
      {
        totalVulns: metadata.vulnerabilities.total,
        critical: metadata.vulnerabilities.critical,
        high: metadata.vulnerabilities.high,
        moderate: metadata.vulnerabilities.moderate,
        low: metadata.vulnerabilities.low,
        totalDeps: metadata.dependencies.total,
      },
      'npm audit scan completed'
    );

    return {
      dependencies,
      metadata: {
        total_dependencies: metadata.dependencies.total,
        prod_dependencies: metadata.dependencies.prod,
        dev_dependencies: metadata.dependencies.dev,
        vulnerabilities: metadata.vulnerabilities,
      },
      scan_path: scanPath,
      scanned_at: now,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error({ err, scanPath }, `Dependency scan failed: ${errMsg}`);
    return {
      dependencies: [],
      metadata: {
        total_dependencies: 0,
        prod_dependencies: 0,
        dev_dependencies: 0,
        vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 },
      },
      scan_path: scanPath,
      scanned_at: now,
      error: `Dependency scan failed: ${errMsg}`,
    };
  }
}
