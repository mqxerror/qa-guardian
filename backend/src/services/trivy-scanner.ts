/**
 * Trivy Container Scanner Service
 *
 * Feature #327: Implement real Trivy CLI container scanning
 *
 * Provides integration with Trivy CLI for container image vulnerability scanning.
 * Falls back gracefully when Trivy is not installed.
 */

import { execFileSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getCache } from './cache.js';
import { generateId } from '../utils/index.js';

// ============================================================
// Trivy Types
// ============================================================

export interface TrivyVersionInfo {
  available: boolean;
  version?: string;
  path?: string;
}

export interface TrivyVulnerability {
  id: string;
  package: string;
  version: string;
  fixed_version?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  cvss_score?: number;
  description?: string;
  references?: string[];
  in_base_image: boolean;
  layer_id?: string;
  installed_version?: string;
  primary_url?: string;
}

export interface TrivyScanResult {
  success: boolean;
  scan_id: string;
  image: {
    reference: string;
    name: string;
    tag: string;
    registry: string;
    digest?: string;
  };
  scan: {
    status: 'completed' | 'failed' | 'not_available';
    scanned_at: string;
    scanner: string;
    scanner_version: string;
    duration_ms?: number;
  };
  summary: {
    total_vulnerabilities: number;
    by_severity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      unknown: number;
    };
    fixable: number;
    from_base_image: number;
  };
  vulnerabilities: TrivyVulnerability[];
  layers?: TrivyLayerInfo[];
  base_image?: {
    reference: string;
    vulnerabilities: number;
    recommendation?: string;
  };
  error?: string;
}

export interface TrivyLayerInfo {
  id: string;
  command?: string;
  size_mb?: number;
  vulnerability_count: number;
  is_base_layer: boolean;
}

// Raw Trivy JSON output types
interface TrivyRawResult {
  Results?: TrivyRawTarget[];
  Metadata?: {
    ImageID?: string;
    DiffIDs?: string[];
    ImageConfig?: {
      history?: Array<{ created_by?: string }>;
    };
  };
}

interface TrivyRawTarget {
  Target: string;
  Class?: string;
  Type?: string;
  Vulnerabilities?: TrivyRawVulnerability[];
}

interface TrivyRawVulnerability {
  VulnerabilityID: string;
  PkgName: string;
  InstalledVersion: string;
  FixedVersion?: string;
  Severity: string;
  Title?: string;
  Description?: string;
  References?: string[];
  PrimaryURL?: string;
  CVSS?: Record<string, { V3Score?: number; V2Score?: number }>;
  Layer?: { DiffID?: string };
}

// ============================================================
// Version Cache
// ============================================================

let trivyVersionCache: TrivyVersionInfo | null = null;

// ============================================================
// Trivy Availability Check
// ============================================================

/**
 * Check if Trivy CLI is available on the system
 */
export function checkTrivyAvailability(): TrivyVersionInfo {
  if (trivyVersionCache) {
    return trivyVersionCache;
  }

  try {
    // Try common trivy binary locations
    const possiblePaths = [
      'trivy',
      '/opt/homebrew/bin/trivy',
      '/usr/local/bin/trivy',
      '/usr/bin/trivy',
      '/snap/bin/trivy',
    ];

    for (const trivyPath of possiblePaths) {
      try {
        const versionOutput = execFileSync(trivyPath, ['version'], {
          encoding: 'utf-8',
          timeout: 10000,
        }).trim();

        // Parse version - trivy outputs version info in various formats
        // e.g., "Version: 0.48.0" or just the version number
        const versionMatch = versionOutput.match(/(\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : 'unknown';

        trivyVersionCache = {
          available: true,
          version,
          path: trivyPath,
        };

        console.log(`[Trivy] Found at ${trivyPath}, version ${version}`);
        return trivyVersionCache;
      } catch {
        // Try next path
      }
    }

    trivyVersionCache = { available: false };
    console.log('[Trivy] CLI not found on system');
    return trivyVersionCache;
  } catch (error) {
    trivyVersionCache = { available: false };
    return trivyVersionCache;
  }
}

/**
 * Reset the version cache (useful for testing)
 */
export function resetTrivyCache(): void {
  trivyVersionCache = null;
}

// ============================================================
// Trivy Image Scanning
// ============================================================

/**
 * Scan a container image for vulnerabilities using Trivy CLI
 *
 * @param imageRef - Docker image reference (e.g., "nginx:latest", "alpine:3.18")
 * @param options - Scan options
 * @returns TrivyScanResult with vulnerabilities or error
 */
export async function scanContainerImage(
  imageRef: string,
  options: {
    timeout?: number;
    severityFilter?: string[];
    ignoreUnfixed?: boolean;
    skipCache?: boolean;
  } = {}
): Promise<TrivyScanResult> {
  const {
    timeout = 300000, // 5 minute default timeout
    severityFilter = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'],
    ignoreUnfixed = false,
    skipCache = false,
  } = options;

  const startTime = Date.now();
  const scanId = generateId('container-scan'); // Feature #357: Use shared ID generator
  const scannedAt = new Date().toISOString();

  // Parse image reference
  const parsedImage = parseImageReference(imageRef);

  // Check cache first (unless skipCache is true)
  if (!skipCache) {
    const cacheKey = `trivy:scan:${imageRef}`;
    const cache = getCache();
    const cached = await cache.get<TrivyScanResult>(cacheKey);
    if (cached) {
      console.log(`[Trivy] Using cached scan result for ${imageRef}`);
      return {
        ...cached,
        scan_id: scanId, // Generate new scan ID
      };
    }
  }

  // Check Trivy availability
  const trivyInfo = checkTrivyAvailability();

  if (!trivyInfo.available) {
    return {
      success: false,
      scan_id: scanId,
      image: parsedImage,
      scan: {
        status: 'not_available',
        scanned_at: scannedAt,
        scanner: 'Trivy',
        scanner_version: 'not installed',
      },
      summary: {
        total_vulnerabilities: 0,
        by_severity: { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 },
        fixable: 0,
        from_base_image: 0,
      },
      vulnerabilities: [],
      error: 'Trivy CLI is not installed on this system. Please install Trivy to enable container scanning. Visit https://aquasecurity.github.io/trivy/latest/getting-started/installation/',
    };
  }

  const trivyPath = trivyInfo.path!;
  const tempOutputFile = path.join(os.tmpdir(), `trivy-${scanId}.json`);

  try {
    // Build Trivy command arguments
    const args: string[] = [
      'image',
      '--format', 'json',
      '--output', tempOutputFile,
      '--severity', severityFilter.join(','),
    ];

    if (ignoreUnfixed) {
      args.push('--ignore-unfixed');
    }

    // Add the image reference
    args.push(imageRef);

    console.log(`[Trivy] Running: ${trivyPath} ${args.join(' ')}`);

    // Run Trivy with timeout
    await new Promise<void>((resolve, reject) => {
      const trivyProcess = spawn(trivyPath, args, {
        timeout,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      let stdout = '';

      trivyProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      trivyProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      trivyProcess.on('close', (code) => {
        console.log(`[Trivy] Process exited with code ${code}`);
        if (code !== 0 && stderr) {
          console.log(`[Trivy] stderr: ${stderr.substring(0, 500)}`);
        }
        // Trivy returns exit code 0 even when vulnerabilities are found
        // Exit code 1 means error (e.g., image not found)
        if (code === 1 && stderr.includes('unable to find')) {
          reject(new Error(`Image not found: ${imageRef}`));
        } else {
          resolve();
        }
      });

      trivyProcess.on('error', (err) => {
        reject(new Error(`Trivy process error: ${err.message}`));
      });

      // Handle timeout
      setTimeout(() => {
        trivyProcess.kill('SIGTERM');
        reject(new Error(`Trivy scan timed out after ${timeout}ms`));
      }, timeout);
    });

    // Parse JSON output
    const duration = Date.now() - startTime;

    if (fs.existsSync(tempOutputFile)) {
      const rawOutput = fs.readFileSync(tempOutputFile, 'utf-8');
      console.log(`[Trivy] Output file size: ${rawOutput.length} bytes`);

      // Clean up temp file
      fs.unlinkSync(tempOutputFile);

      if (!rawOutput.trim()) {
        console.log('[Trivy] Output file is empty - no findings');
        return createSuccessResult(scanId, parsedImage, scannedAt, trivyInfo.version!, duration, []);
      }

      const rawResult: TrivyRawResult = JSON.parse(rawOutput);
      const { vulnerabilities, layers } = parseTrivyOutput(rawResult);

      const result = createSuccessResult(scanId, parsedImage, scannedAt, trivyInfo.version!, duration, vulnerabilities, layers);

      // Cache the result for 1 hour
      if (!skipCache) {
        const cacheKey = `trivy:scan:${imageRef}`;
        const cache = getCache();
        await cache.set(cacheKey, result, 3600); // 1 hour TTL
      }

      return result;
    }

    // No output file - shouldn't happen but handle gracefully
    console.log('[Trivy] No output file found');
    return createSuccessResult(scanId, parsedImage, scannedAt, trivyInfo.version!, duration, []);

  } catch (error: unknown) {
    // Feature #356: Use unknown type with proper narrowing
    // Clean up temp file on error
    try {
      if (fs.existsSync(tempOutputFile)) {
        fs.unlinkSync(tempOutputFile);
      }
    } catch { /* cleanup errors intentionally ignored */ }

    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during Trivy scan';

    return {
      success: false,
      scan_id: scanId,
      image: parsedImage,
      scan: {
        status: 'failed',
        scanned_at: scannedAt,
        scanner: 'Trivy',
        scanner_version: trivyInfo.version || 'unknown',
        duration_ms: duration,
      },
      summary: {
        total_vulnerabilities: 0,
        by_severity: { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 },
        fixable: 0,
        from_base_image: 0,
      },
      vulnerabilities: [],
      error: errorMessage,
    };
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Parse Docker image reference into components
 */
function parseImageReference(imageRef: string): TrivyScanResult['image'] {
  // Handle various formats:
  // - nginx:latest
  // - docker.io/library/nginx:latest
  // - gcr.io/project/image:tag
  // - registry.example.com:5000/image:tag

  const ref = imageRef.includes(':') ? imageRef : `${imageRef}:latest`;

  // Split by the last colon (to handle ports in registry)
  const lastColonIndex = ref.lastIndexOf(':');
  const tagPart = lastColonIndex > ref.lastIndexOf('/') ? ref.substring(lastColonIndex + 1) : 'latest';
  const namePart = lastColonIndex > ref.lastIndexOf('/') ? ref.substring(0, lastColonIndex) : ref;

  // Determine registry
  let registry = 'docker.io';
  let name = namePart;

  if (namePart.includes('/')) {
    const firstPart = namePart.split('/')[0];
    // Check if first part is a registry (contains . or :)
    if (firstPart && (firstPart.includes('.') || firstPart.includes(':'))) {
      registry = firstPart;
      name = namePart.substring(firstPart.length + 1);
    }
  }

  return {
    reference: ref,
    name,
    tag: tagPart,
    registry,
  };
}

/**
 * Parse Trivy JSON output into our vulnerability format
 */
function parseTrivyOutput(raw: TrivyRawResult): { vulnerabilities: TrivyVulnerability[]; layers: TrivyLayerInfo[] } {
  const vulnerabilities: TrivyVulnerability[] = [];
  const layerVulnCounts: Map<string, number> = new Map();

  if (!raw.Results) {
    return { vulnerabilities: [], layers: [] };
  }

  for (const target of raw.Results) {
    if (!target.Vulnerabilities) continue;

    for (const vuln of target.Vulnerabilities) {
      // Map severity to our format
      const severity = mapSeverity(vuln.Severity);

      // Get CVSS score if available
      let cvssScore: number | undefined;
      if (vuln.CVSS) {
        for (const source of Object.values(vuln.CVSS)) {
          if (source.V3Score) {
            cvssScore = source.V3Score;
            break;
          } else if (source.V2Score) {
            cvssScore = source.V2Score;
          }
        }
      }

      // Track vulnerabilities per layer
      const layerId = vuln.Layer?.DiffID || 'unknown';
      layerVulnCounts.set(layerId, (layerVulnCounts.get(layerId) || 0) + 1);

      vulnerabilities.push({
        id: vuln.VulnerabilityID,
        package: vuln.PkgName,
        version: vuln.InstalledVersion,
        fixed_version: vuln.FixedVersion,
        severity,
        cvss_score: cvssScore,
        description: vuln.Description || vuln.Title,
        references: vuln.References,
        primary_url: vuln.PrimaryURL,
        in_base_image: isBaseLayerVuln(layerId, raw.Metadata),
        layer_id: layerId !== 'unknown' ? layerId : undefined,
        installed_version: vuln.InstalledVersion,
      });
    }
  }

  // Build layer info
  const layers: TrivyLayerInfo[] = [];
  const diffIDs = raw.Metadata?.DiffIDs || [];
  const history = raw.Metadata?.ImageConfig?.history || [];

  for (let i = 0; i < diffIDs.length; i++) {
    const layerId = diffIDs[i];
    if (!layerId) continue;

    layers.push({
      id: layerId.substring(0, 20), // Truncate for display
      command: history[i]?.created_by?.substring(0, 100),
      vulnerability_count: layerVulnCounts.get(layerId) || 0,
      is_base_layer: i < Math.ceil(diffIDs.length / 2), // Heuristic: first half are base layers
    });
  }

  return { vulnerabilities, layers };
}

/**
 * Map Trivy severity to our severity format
 */
function mapSeverity(trivySeverity: string): TrivyVulnerability['severity'] {
  switch (trivySeverity.toUpperCase()) {
    case 'CRITICAL':
      return 'critical';
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
      return 'low';
    default:
      return 'unknown';
  }
}

/**
 * Determine if vulnerability is in a base layer (heuristic)
 */
function isBaseLayerVuln(layerId: string, metadata?: TrivyRawResult['Metadata']): boolean {
  if (!metadata?.DiffIDs || layerId === 'unknown') {
    return false;
  }

  const layerIndex = metadata.DiffIDs.indexOf(layerId);
  if (layerIndex === -1) return false;

  // Consider first 50% of layers as base image layers
  return layerIndex < Math.ceil(metadata.DiffIDs.length / 2);
}

/**
 * Create a successful scan result
 */
function createSuccessResult(
  scanId: string,
  image: TrivyScanResult['image'],
  scannedAt: string,
  version: string,
  duration: number,
  vulnerabilities: TrivyVulnerability[],
  layers?: TrivyLayerInfo[]
): TrivyScanResult {
  const summary = {
    total_vulnerabilities: vulnerabilities.length,
    by_severity: {
      critical: vulnerabilities.filter(v => v.severity === 'critical').length,
      high: vulnerabilities.filter(v => v.severity === 'high').length,
      medium: vulnerabilities.filter(v => v.severity === 'medium').length,
      low: vulnerabilities.filter(v => v.severity === 'low').length,
      unknown: vulnerabilities.filter(v => v.severity === 'unknown').length,
    },
    fixable: vulnerabilities.filter(v => v.fixed_version).length,
    from_base_image: vulnerabilities.filter(v => v.in_base_image).length,
  };

  const result: TrivyScanResult = {
    success: true,
    scan_id: scanId,
    image,
    scan: {
      status: 'completed',
      scanned_at: scannedAt,
      scanner: 'Trivy',
      scanner_version: version,
      duration_ms: duration,
    },
    summary,
    vulnerabilities,
  };

  if (layers && layers.length > 0) {
    result.layers = layers;
  }

  // Add base image recommendation if there are base image vulnerabilities
  if (summary.from_base_image > 0) {
    result.base_image = {
      reference: 'base image',
      vulnerabilities: summary.from_base_image,
      recommendation: summary.from_base_image > 5
        ? 'Consider upgrading to a more recent base image with fewer vulnerabilities'
        : 'Some vulnerabilities originate from the base image',
    };
  }

  return result;
}
