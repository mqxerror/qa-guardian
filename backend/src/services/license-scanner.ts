/**
 * License Scanner Service
 * Feature #267: License compliance checking for dependencies
 *
 * Uses license-checker npm package to scan project dependencies.
 * Maps licenses to SPDX identifiers and checks against org-level policies.
 *
 * Policy Types:
 * - Allowlist: Only specified licenses are permitted (MIT, Apache-2.0, ISC, BSD-*)
 * - Blocklist: Specified licenses are prohibited (GPL-3.0, AGPL-*)
 */

import licenseChecker from 'license-checker';
import { promisify } from 'util';

// ============================================================================
// Types
// ============================================================================

/**
 * Package info returned by license-checker
 */
interface LicenseCheckerPackageInfo {
  licenses?: string;
  repository?: string;
  publisher?: string;
  url?: string;
  path?: string;
  licenseFile?: string;
}

export interface LicenseInfo {
  name: string;
  version: string;
  license: string;
  spdxId: string | null;
  repository?: string;
  publisher?: string;
  url?: string;
  path?: string;
  licenseFile?: string;
}

export interface LicenseViolation {
  package: string;
  version: string;
  license: string;
  spdxId: string | null;
  violationType: 'blocklist' | 'not_in_allowlist' | 'unknown_license';
  severity: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
}

export interface LicensePolicy {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  allowlist: string[];
  blocklist: string[];
  created_at: Date;
  updated_at: Date;
}

export interface LicenseComplianceResult {
  project_id: string;
  scanned_at: Date;
  total_packages: number;
  compliant_packages: number;
  violation_count: number;
  unknown_license_count: number;
  packages: LicenseInfo[];
  violations: LicenseViolation[];
  license_summary: Record<string, number>;
  policy_applied: {
    name: string;
    allowlist: string[];
    blocklist: string[];
  };
  compliance_percentage: number;
}

// ============================================================================
// SPDX License Mapping
// ============================================================================

/**
 * Map common license names to SPDX identifiers
 * See: https://spdx.org/licenses/
 */
const LICENSE_SPDX_MAP: Record<string, string> = {
  // MIT variants
  'MIT': 'MIT',
  'MIT*': 'MIT',
  'MIT License': 'MIT',
  'The MIT License': 'MIT',
  '(MIT)': 'MIT',
  'MIT/X11': 'MIT',

  // Apache variants
  'Apache-2.0': 'Apache-2.0',
  'Apache 2.0': 'Apache-2.0',
  'Apache License 2.0': 'Apache-2.0',
  'Apache License, Version 2.0': 'Apache-2.0',
  'Apache': 'Apache-2.0',
  'Apache*': 'Apache-2.0',
  'Apache-1.1': 'Apache-1.1',

  // ISC
  'ISC': 'ISC',
  'ISC*': 'ISC',
  'ISC License': 'ISC',

  // BSD variants
  'BSD': 'BSD-3-Clause',
  'BSD-2-Clause': 'BSD-2-Clause',
  'BSD-3-Clause': 'BSD-3-Clause',
  'BSD*': 'BSD-3-Clause',
  'BSD License': 'BSD-3-Clause',
  'BSD-3-Clause-Clear': 'BSD-3-Clause-Clear',
  '0BSD': '0BSD',

  // GPL variants
  'GPL': 'GPL-3.0-only',
  'GPL-2.0': 'GPL-2.0-only',
  'GPL-2.0+': 'GPL-2.0-or-later',
  'GPL-3.0': 'GPL-3.0-only',
  'GPL-3.0+': 'GPL-3.0-or-later',
  'LGPL': 'LGPL-3.0-only',
  'LGPL-2.0': 'LGPL-2.0-only',
  'LGPL-2.1': 'LGPL-2.1-only',
  'LGPL-3.0': 'LGPL-3.0-only',

  // AGPL
  'AGPL': 'AGPL-3.0-only',
  'AGPL-3.0': 'AGPL-3.0-only',
  'AGPL-3.0-only': 'AGPL-3.0-only',

  // Other common licenses
  'CC0-1.0': 'CC0-1.0',
  'CC-BY-3.0': 'CC-BY-3.0',
  'CC-BY-4.0': 'CC-BY-4.0',
  'Unlicense': 'Unlicense',
  'WTFPL': 'WTFPL',
  'Python-2.0': 'Python-2.0',
  'MPL-2.0': 'MPL-2.0',
  'Artistic-2.0': 'Artistic-2.0',
  'Zlib': 'Zlib',
  'BlueOak-1.0.0': 'BlueOak-1.0.0',
  'Public Domain': 'Unlicense',
};

/**
 * Normalize and map a license string to an SPDX identifier
 */
export function toSpdxId(license: string): string | null {
  if (!license || license === 'UNKNOWN') {
    return null;
  }

  // Direct lookup
  if (LICENSE_SPDX_MAP[license]) {
    return LICENSE_SPDX_MAP[license] ?? null;
  }

  // Try normalized version
  const normalized = license.trim().replace(/\s+/g, ' ');
  if (LICENSE_SPDX_MAP[normalized]) {
    return LICENSE_SPDX_MAP[normalized] ?? null;
  }

  // Handle compound licenses (e.g., "MIT OR Apache-2.0")
  if (license.includes(' OR ') || license.includes(' AND ')) {
    const parts = license.split(/\s+(OR|AND)\s+/);
    const mappedParts = parts.map(p => LICENSE_SPDX_MAP[p] || p);
    return mappedParts.join(' OR ');
  }

  // Handle parenthesized licenses
  const parenMatch = license.match(/^\((.+)\)$/);
  if (parenMatch && parenMatch[1]) {
    return toSpdxId(parenMatch[1]);
  }

  // If it looks like an SPDX ID already, return as-is
  if (/^[A-Za-z0-9.+-]+$/.test(license)) {
    return license;
  }

  return null;
}

// ============================================================================
// Default Policy
// ============================================================================

/**
 * Default license policy used when no org-level policy is defined
 */
export const DEFAULT_LICENSE_POLICY: Omit<LicensePolicy, 'id' | 'organization_id' | 'created_at' | 'updated_at'> = {
  name: 'Default License Policy',
  description: 'Default policy allowing common permissive licenses',
  allowlist: [
    'MIT',
    'Apache-2.0',
    'Apache-1.1',
    'ISC',
    'BSD-2-Clause',
    'BSD-3-Clause',
    '0BSD',
    'CC0-1.0',
    'Unlicense',
    'WTFPL',
    'Python-2.0',
    'Zlib',
    'BlueOak-1.0.0',
  ],
  blocklist: [
    'GPL-3.0-only',
    'GPL-3.0-or-later',
    'AGPL-3.0-only',
    'AGPL-3.0-or-later',
  ],
};

// ============================================================================
// In-Memory Policy Store
// ============================================================================

/**
 * Store for organization license policies
 * Key: organization_id
 */
export const licensePolicies = new Map<string, LicensePolicy>();

/**
 * Get license policy for an organization (or default)
 */
export function getLicensePolicy(organizationId: string): LicensePolicy {
  const policy = licensePolicies.get(organizationId);
  if (policy) {
    return policy;
  }

  // Return default policy with org context
  return {
    id: 'default',
    organization_id: organizationId,
    name: DEFAULT_LICENSE_POLICY.name,
    description: DEFAULT_LICENSE_POLICY.description,
    allowlist: [...DEFAULT_LICENSE_POLICY.allowlist],
    blocklist: [...DEFAULT_LICENSE_POLICY.blocklist],
    created_at: new Date(),
    updated_at: new Date(),
  };
}

/**
 * Set/update license policy for an organization
 */
export function setLicensePolicy(policy: LicensePolicy): void {
  policy.updated_at = new Date();
  licensePolicies.set(policy.organization_id, policy);
}

// ============================================================================
// License Scanning
// ============================================================================

// Promisify the license-checker init function
const initAsync = promisify(licenseChecker.init);

/**
 * Scan a directory for npm package licenses
 */
export async function scanLicenses(projectPath: string): Promise<LicenseInfo[]> {
  try {
    const packages = await initAsync({
      start: projectPath,
      production: true,
      json: true,
    }) as Record<string, LicenseCheckerPackageInfo>;

    const licenses: LicenseInfo[] = [];

    for (const [packageKey, info] of Object.entries(packages)) {
      // Parse package name and version from key (e.g., "lodash@4.17.21")
      const atIndex = packageKey.lastIndexOf('@');
      let name: string;
      let version: string;

      if (atIndex > 0) {
        name = packageKey.substring(0, atIndex);
        version = packageKey.substring(atIndex + 1);
      } else {
        name = packageKey;
        version = 'unknown';
      }

      const licenseStr = info.licenses || 'UNKNOWN';
      const spdxId = toSpdxId(licenseStr);

      licenses.push({
        name,
        version,
        license: licenseStr,
        spdxId,
        repository: info.repository,
        publisher: info.publisher,
        url: info.url,
        path: info.path,
        licenseFile: info.licenseFile,
      });
    }

    return licenses;
  } catch (error) {
    console.error('[LicenseScanner] Error scanning licenses:', error);
    throw error;
  }
}

/**
 * Check if a license matches any pattern in a list
 * Supports wildcards (e.g., "BSD-*", "GPL-*")
 */
function matchesLicensePattern(spdxId: string | null, patterns: string[]): boolean {
  if (!spdxId) return false;

  for (const pattern of patterns) {
    if (pattern.endsWith('*')) {
      // Wildcard match
      const prefix = pattern.slice(0, -1);
      if (spdxId.startsWith(prefix)) {
        return true;
      }
    } else if (pattern === spdxId) {
      // Exact match
      return true;
    }
  }

  return false;
}

/**
 * Check licenses against a policy and return violations
 */
export function checkCompliance(
  licenses: LicenseInfo[],
  policy: LicensePolicy
): LicenseViolation[] {
  const violations: LicenseViolation[] = [];

  for (const pkg of licenses) {
    const { name, version, license, spdxId } = pkg;

    // Check blocklist first (highest priority)
    if (spdxId && matchesLicensePattern(spdxId, policy.blocklist)) {
      violations.push({
        package: name,
        version,
        license,
        spdxId,
        violationType: 'blocklist',
        severity: 'critical',
        reason: `License ${spdxId} is on the blocklist`,
      });
      continue;
    }

    // Check if license is unknown
    if (!spdxId || spdxId === 'UNKNOWN') {
      violations.push({
        package: name,
        version,
        license,
        spdxId: null,
        violationType: 'unknown_license',
        severity: 'medium',
        reason: `Unknown or unparseable license: ${license}`,
      });
      continue;
    }

    // Check allowlist (if allowlist has items, license must be in it)
    if (policy.allowlist.length > 0 && !matchesLicensePattern(spdxId, policy.allowlist)) {
      // Determine severity based on license type
      let severity: 'critical' | 'high' | 'medium' | 'low' = 'high';
      if (spdxId.includes('GPL') || spdxId.includes('AGPL')) {
        severity = 'critical';
      } else if (spdxId.includes('LGPL') || spdxId.includes('MPL')) {
        severity = 'high';
      } else {
        severity = 'medium';
      }

      violations.push({
        package: name,
        version,
        license,
        spdxId,
        violationType: 'not_in_allowlist',
        severity,
        reason: `License ${spdxId} is not in the approved allowlist`,
      });
    }
  }

  // Sort violations by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  violations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return violations;
}

/**
 * Run a complete license compliance check for a project
 */
export async function checkLicenseCompliance(
  projectId: string,
  projectPath: string,
  organizationId: string
): Promise<LicenseComplianceResult> {
  // Get the applicable policy
  const policy = getLicensePolicy(organizationId);

  // Scan for licenses
  const packages = await scanLicenses(projectPath);

  // Check compliance
  const violations = checkCompliance(packages, policy);

  // Calculate license summary
  const licenseSummary: Record<string, number> = {};
  for (const pkg of packages) {
    const key = pkg.spdxId || 'Unknown';
    licenseSummary[key] = (licenseSummary[key] || 0) + 1;
  }

  // Calculate stats
  const compliantPackages = packages.length - violations.length;
  const unknownLicenseCount = violations.filter(v => v.violationType === 'unknown_license').length;
  const compliancePercentage = packages.length > 0
    ? Math.round((compliantPackages / packages.length) * 100)
    : 100;

  return {
    project_id: projectId,
    scanned_at: new Date(),
    total_packages: packages.length,
    compliant_packages: compliantPackages,
    violation_count: violations.length,
    unknown_license_count: unknownLicenseCount,
    packages,
    violations,
    license_summary: licenseSummary,
    policy_applied: {
      name: policy.name,
      allowlist: policy.allowlist,
      blocklist: policy.blocklist,
    },
    compliance_percentage: compliancePercentage,
  };
}

/**
 * Get a quick summary without full package details
 */
export async function getLicenseComplianceSummary(
  projectPath: string,
  organizationId: string
): Promise<{
  total: number;
  compliant: number;
  violations: number;
  compliancePercentage: number;
  severityCounts: Record<string, number>;
}> {
  const policy = getLicensePolicy(organizationId);
  const packages = await scanLicenses(projectPath);
  const violations = checkCompliance(packages, policy);

  const severityCounts = {
    critical: violations.filter(v => v.severity === 'critical').length,
    high: violations.filter(v => v.severity === 'high').length,
    medium: violations.filter(v => v.severity === 'medium').length,
    low: violations.filter(v => v.severity === 'low').length,
  };

  return {
    total: packages.length,
    compliant: packages.length - violations.length,
    violations: violations.length,
    compliancePercentage: packages.length > 0
      ? Math.round(((packages.length - violations.length) / packages.length) * 100)
      : 100,
    severityCounts,
  };
}
