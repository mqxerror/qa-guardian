/**
 * Vulnerability Tracking Routes - Types and Helpers Module
 *
 * Type definitions and helper functions for vulnerability-tracking.ts
 *
 * Feature #246: Extracted to reduce file size
 *
 * @module vuln-tracking-types
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execFileAsync = promisify(execFile);

// =====================================================
// Type Definitions
// =====================================================

export interface LanguageScanConfig {
  language: 'javascript' | 'python' | 'java' | 'go' | 'rust';
  enabled: boolean;
  manifest_files: string[];
  lock_files: string[];
  registries: string[];
}

export interface MultiLanguageScanConfig {
  organization_id: string;
  enabled_languages: LanguageScanConfig[];
  scan_dev_dependencies: boolean;
  scan_transitive: boolean;
  auto_detect_languages: boolean;
  parallel_scanning: boolean;
  cache_duration_hours: number;
}

export interface LanguageDependency {
  id: string;
  project_id: string;
  language: 'javascript' | 'python' | 'java' | 'go' | 'rust';
  name: string;
  current_version: string;
  latest_version: string;
  license?: string;
  is_dev: boolean;
  is_transitive: boolean;
  depth: number;
  parent_package?: string;
  repository_url?: string;
  registry: string;
  vulnerabilities: Array<{
    id: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    fixed_version?: string;
  }>;
  last_scanned_at: string;
}

export interface LanguageScanResult {
  project_id: string;
  language: string;
  status: 'pending' | 'scanning' | 'completed' | 'failed';
  total_dependencies: number;
  direct_dependencies: number;
  transitive_dependencies: number;
  vulnerabilities_found: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export interface VulnerabilityHistoryEvent {
  id: string;
  event_type: 'detected' | 'fixed' | 'acknowledged' | 'ignored' | 'reopened';
  timestamp: string;
  user_id?: string;
  user_name?: string;
  commit_sha?: string;
  commit_message?: string;
  branch?: string;
  notes?: string;
}

export interface VulnerabilityHistory {
  id: string;
  vulnerability_id: string;
  cve_id: string;
  dependency_name: string;
  dependency_version: string;
  project_id: string;
  project_name: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  first_detected_at: string;
  first_detected_commit?: string;
  first_detected_by?: string;
  fixed_at?: string;
  fixed_commit?: string;
  fixed_by?: string;
  fixed_in_version?: string;
  current_status: 'open' | 'fixed' | 'ignored' | 'false_positive';
  time_to_fix_days?: number;
  events: VulnerabilityHistoryEvent[];
}

export interface ExploitabilityAnalysis {
  vulnerability_id: string;
  cve_id: string;
  dependency_name: string;
  dependency_version: string;
  epss_score: number;
  epss_percentile: number;
  reachability: {
    status: 'reachable' | 'potentially_reachable' | 'not_reachable' | 'unknown';
    confidence: number;
    call_paths: Array<{
      source_file: string;
      line_number: number;
      function_name: string;
      call_chain: string[];
    }>;
    affected_functions: string[];
    analysis_method: 'static' | 'dynamic' | 'hybrid' | 'manual';
  };
  known_exploits: {
    has_public_exploit: boolean;
    exploit_maturity: 'proof_of_concept' | 'functional' | 'weaponized' | 'none';
    exploit_sources: Array<{
      source: string;
      url?: string;
      date_published?: string;
    }>;
    in_the_wild: boolean;
    ransomware_associated: boolean;
  };
  kev_status: {
    is_in_kev: boolean;
    date_added?: string;
    due_date?: string;
    notes?: string;
  };
  risk_assessment: {
    overall_risk: 'critical' | 'high' | 'medium' | 'low' | 'informational';
    exploitability_score: number;
    impact_score: number;
    priority_score: number;
    recommended_action: string;
    remediation_effort: 'minimal' | 'moderate' | 'significant' | 'extensive';
  };
  analyzed_at: string;
  analysis_version: string;
}

// =====================================================
// In-memory Storage
// =====================================================

export const multiLangConfigs = new Map<string, MultiLanguageScanConfig>();
export const languageDependencies = new Map<string, LanguageDependency[]>();
export const scanResults = new Map<string, LanguageScanResult[]>();
export const vulnerabilityHistories = new Map<string, VulnerabilityHistory[]>();
export const exploitabilityCache = new Map<string, ExploitabilityAnalysis>();

// =====================================================
// NPM Command Output Interfaces
// =====================================================

interface NpmLsOutput {
  name?: string;
  version?: string;
  dependencies?: Record<string, NpmDependencyInfo>;
}

interface NpmDependencyInfo {
  version?: string;
  dev?: boolean;
  resolved?: string;
}

interface NpmAuditOutput {
  metadata?: {
    vulnerabilities?: {
      total?: number;
      info?: number;
      low?: number;
      moderate?: number;
      high?: number;
      critical?: number;
    };
    dependencies?: {
      prod?: number;
      dev?: number;
      total?: number;
    };
  };
  vulnerabilities?: Record<string, NpmVulnerability>;
}

interface NpmVulnerability {
  severity?: string;
  fixAvailable?: {
    version?: string;
    [key: string]: unknown;
  } | boolean;
  via?: (string | NpmVulnerabilityVia)[];
}

interface NpmVulnerabilityVia {
  title?: string;
  url?: string;
  severity?: string;
}

interface VulnMapEntry {
  id: string;
  severity: string;
  title: string;
  fixAvailable?: { version?: string };
  via: (string | NpmVulnerabilityVia)[];
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Find a directory containing a package.json to scan.
 * Tries the project's backend dir, then the project root.
 */
export function findScanTarget(): string {
  const candidates = [
    path.resolve(__dirname, '..', '..', '..'),       // backend/
    path.resolve(__dirname, '..', '..', '..', '..'),  // project root
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
  }
  return candidates[0];
}

/**
 * Map npm severity to standard format
 */
export function mapNpmSeverity(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'critical': return 'CRITICAL';
    case 'high': return 'HIGH';
    case 'moderate':
    case 'medium': return 'MEDIUM';
    case 'low': return 'LOW';
    case 'info': return 'LOW';
    default: return 'LOW';
  }
}

/**
 * Run real npm audit --json and npm ls --json to get actual dependency and vulnerability data.
 */
export async function runNpmAudit(targetDir: string): Promise<{
  dependencies: LanguageDependency[];
  auditMeta: { total: number; info: number; low: number; moderate: number; high: number; critical: number };
  depMeta: { prod: number; dev: number; total: number };
}> {
  const dependencies: LanguageDependency[] = [];
  let auditMeta = { total: 0, info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  let depMeta = { prod: 0, dev: 0, total: 0 };

  // 1. Run npm ls --json --depth=0 to get direct dependencies
  let lsData: NpmLsOutput = {};
  try {
    const { stdout } = await execFileAsync('npm', ['ls', '--json', '--depth=0'], {
      cwd: targetDir,
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    lsData = JSON.parse(stdout) as NpmLsOutput;
  } catch (err: unknown) {
    // npm ls exits with non-zero when there are peer dep issues; parse stdout anyway
    const execErr = err as { stdout?: string };
    if (execErr.stdout) {
      try { lsData = JSON.parse(execErr.stdout) as NpmLsOutput; } catch { /* ignore */ }
    }
  }

  // 2. Run npm audit --json to get vulnerabilities
  let auditData: NpmAuditOutput = {};
  try {
    const { stdout } = await execFileAsync('npm', ['audit', '--json'], {
      cwd: targetDir,
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    });
    auditData = JSON.parse(stdout) as NpmAuditOutput;
  } catch (err: unknown) {
    // npm audit exits non-zero when vulns found; parse stdout anyway
    const execErr = err as { stdout?: string };
    if (execErr.stdout) {
      try { auditData = JSON.parse(execErr.stdout) as NpmAuditOutput; } catch { /* ignore */ }
    }
  }

  // Extract audit metadata
  if (auditData.metadata) {
    const m = auditData.metadata;
    auditMeta = {
      total: m.vulnerabilities?.total || 0,
      info: m.vulnerabilities?.info || 0,
      low: m.vulnerabilities?.low || 0,
      moderate: m.vulnerabilities?.moderate || 0,
      high: m.vulnerabilities?.high || 0,
      critical: m.vulnerabilities?.critical || 0,
    };
    depMeta = {
      prod: m.dependencies?.prod || 0,
      dev: m.dependencies?.dev || 0,
      total: m.dependencies?.total || 0,
    };
  }

  // Build vulnerability lookup from audit data
  const vulnMap = new Map<string, VulnMapEntry[]>();
  if (auditData.vulnerabilities) {
    for (const [name, vuln] of Object.entries(auditData.vulnerabilities)) {
      const vias = (vuln.via || []).filter((v): v is NpmVulnerabilityVia => typeof v === 'object');
      const fixAvailable = typeof vuln.fixAvailable === 'object' ? vuln.fixAvailable : undefined;
      vulnMap.set(name, [{
        id: `npm-${name}-${vuln.severity}`,
        severity: mapNpmSeverity(vuln.severity || 'low'),
        title: vias.length > 0 ? (vias[0].title || `Vulnerability in ${name}`) : `Vulnerability in ${name} (via ${(vuln.via || []).join(', ')})`,
        fixAvailable,
        via: vuln.via || [],
      }]);
    }
  }

  // Build dependency list from npm ls output
  const allDeps = lsData.dependencies || {};
  let depIndex = 0;
  for (const [name, info] of Object.entries(allDeps)) {
    const vulns = vulnMap.get(name) || [];
    const dep: LanguageDependency = {
      id: `dep-js-${depIndex++}`,
      project_id: 'current',
      language: 'javascript',
      name,
      current_version: info.version || '0.0.0',
      latest_version: vulns.length > 0 && vulns[0].fixAvailable?.version
        ? vulns[0].fixAvailable.version
        : info.version || '0.0.0',
      license: undefined,
      is_dev: !!info.dev,
      is_transitive: false,
      depth: 0,
      parent_package: undefined,
      repository_url: undefined,
      registry: 'https://registry.npmjs.org',
      vulnerabilities: vulns.map(v => ({
        id: v.id,
        severity: v.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
        title: v.title,
        fixed_version: v.fixAvailable?.version,
      })),
      last_scanned_at: new Date().toISOString(),
    };
    dependencies.push(dep);
  }

  // Also add vulnerable transitive dependencies not in direct deps
  for (const [name, vulnEntries] of vulnMap) {
    if (!allDeps[name]) {
      const vuln = vulnEntries[0];
      dependencies.push({
        id: `dep-js-${depIndex++}`,
        project_id: 'current',
        language: 'javascript',
        name,
        current_version: 'transitive',
        latest_version: vuln.fixAvailable?.version || 'unknown',
        license: undefined,
        is_dev: false,
        is_transitive: true,
        depth: 1,
        parent_package: undefined,
        repository_url: undefined,
        registry: 'https://registry.npmjs.org',
        vulnerabilities: vulnEntries.map(v => ({
          id: v.id,
          severity: v.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
          title: v.title,
          fixed_version: v.fixAvailable?.version,
        })),
        last_scanned_at: new Date().toISOString(),
      });
    }
  }

  return { dependencies, auditMeta, depMeta };
}

/**
 * Return empty dependencies for non-JavaScript languages (not yet supported).
 */
export function generateMockDependencies(_projectId: string, _language: 'javascript' | 'python' | 'java' | 'go' | 'rust'): LanguageDependency[] {
  // Non-JS languages: real scanning not yet integrated
  return [];
}

/**
 * Build vulnerability history from real npm audit data.
 */
export async function buildRealVulnerabilityHistory(projectId: string): Promise<VulnerabilityHistory[]> {
  try {
    const targetDir = findScanTarget();
    const { dependencies } = await runNpmAudit(targetDir);
    const histories: VulnerabilityHistory[] = [];
    let idx = 0;

    for (const dep of dependencies) {
      for (const vuln of dep.vulnerabilities) {
        histories.push({
          id: `vuln-hist-${idx++}`,
          vulnerability_id: vuln.id,
          cve_id: vuln.id,
          dependency_name: dep.name,
          dependency_version: dep.current_version,
          project_id: projectId,
          project_name: 'QA Guardian',
          severity: vuln.severity,
          title: vuln.title,
          description: `${vuln.title} in ${dep.name}@${dep.current_version}` +
            (vuln.fixed_version ? `. Fix available: upgrade to ${vuln.fixed_version}` : ''),
          first_detected_at: new Date().toISOString(),
          current_status: 'open',
          events: [{
            id: `evt-${idx}`,
            event_type: 'detected',
            timestamp: new Date().toISOString(),
            notes: `Detected by npm audit scan`,
          }],
        });
      }
    }
    return histories;
  } catch {
    return [];
  }
}

/**
 * Return empty vulnerability history - sync fallback.
 */
export function generateMockVulnerabilityHistory(_projectId: string): VulnerabilityHistory[] {
  return [];
}

/**
 * Get top affected dependencies from vulnerability histories
 */
export function getTopAffectedDependencies(histories: VulnerabilityHistory[]): Array<{ name: string; count: number; open: number }> {
  const depCounts: Record<string, { count: number; open: number }> = {};
  histories.forEach(h => {
    if (!depCounts[h.dependency_name]) {
      depCounts[h.dependency_name] = { count: 0, open: 0 };
    }
    depCounts[h.dependency_name].count++;
    if (h.current_status === 'open') {
      depCounts[h.dependency_name].open++;
    }
  });

  return Object.entries(depCounts)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/**
 * Return default exploitability analysis - real EPSS/reachability analysis not yet integrated.
 */
export function generateMockExploitabilityAnalysis(
  vulnerabilityId: string,
  cveId?: string,
  depName?: string,
  depVersion?: string
): ExploitabilityAnalysis {
  return {
    vulnerability_id: vulnerabilityId,
    cve_id: cveId || 'N/A',
    dependency_name: depName || 'unknown',
    dependency_version: depVersion || '0.0.0',
    epss_score: 0,
    epss_percentile: 0,
    reachability: {
      status: 'not_reachable',
      confidence: 0,
      call_paths: [],
      affected_functions: [],
      analysis_method: 'static',
    },
    known_exploits: {
      has_public_exploit: false,
      exploit_maturity: 'none',
      exploit_sources: [],
      in_the_wild: false,
      ransomware_associated: false,
    },
    kev_status: {
      is_in_kev: false,
    },
    risk_assessment: {
      overall_risk: 'low',
      exploitability_score: 0,
      impact_score: 0,
      priority_score: 0,
      recommended_action: 'Exploitability analysis not yet integrated - connect a real vulnerability scanner for accurate results.',
      remediation_effort: 'minimal',
    },
    analyzed_at: new Date().toISOString(),
    analysis_version: '1.0.0',
  };
}
