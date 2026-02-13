/**
 * Security domain type definitions
 *
 * Types for DAST scanning, CVE database, container scanning,
 * vulnerability history, exploitability analysis, and license compliance.
 */

// ============================================================================
// DAST Comparison (Feature #756)
// ============================================================================

export type DASTCompareRisk = 'High' | 'Medium' | 'Low' | 'Informational';
export type DASTCompareConfidence = 'High' | 'Medium' | 'Low' | 'User Confirmed' | 'False Positive';

export interface DASTCompareAlert {
  id: string;
  pluginId: string;
  name: string;
  risk: DASTCompareRisk;
  confidence: DASTCompareConfidence;
  description: string;
  url: string;
  method: string;
  param?: string;
  attack?: string;
  evidence?: string;
  solution: string;
  cweId?: number;
}

export interface DASTCompareScan {
  id: string;
  targetUrl: string;
  scanProfile: 'baseline' | 'full' | 'api';
  status: string;
  startedAt: string;
  completedAt?: string;
  alerts: DASTCompareAlert[];
  summary: {
    total: number;
    byRisk: { high: number; medium: number; low: number; informational: number; };
  };
  statistics?: {
    urlsScanned: number;
    requestsSent: number;
    duration: number;
  };
  progress?: {
    phase: string;
    percentage: number;
    alertsFound: number;
    urlsScanned: number;
    phaseDescription: string;
  };
}

export interface DASTComparisonResult {
  scan1: DASTCompareScan;
  scan2: DASTCompareScan;
  newFindings: DASTCompareAlert[];
  fixedFindings: DASTCompareAlert[];
  unchangedFindings: DASTCompareAlert[];
  summary: {
    totalNew: number;
    totalFixed: number;
    totalUnchanged: number;
    riskDelta: { high: number; medium: number; low: number; informational: number; };
    overallImprovement: boolean;
  };
}

// ============================================================================
// CVE Database (Feature #762)
// ============================================================================

/** CVE vulnerability interface with NVD details */
export interface CVEVulnerability {
  id: string;
  cveId: string;
  source: string;
  pkgName: string;
  installedVersion: string;
  fixedVersion?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  cvss: {
    version: string;
    score: number;
    vector: string;
    attackVector: string;
    attackComplexity: string;
    privilegesRequired: string;
    userInteraction: string;
    scope: string;
    confidentiality: string;
    integrity: string;
    availability: string;
  };
  publishedDate: string;
  lastModifiedDate: string;
  nvdUrl: string;
  references: {
    url: string;
    source: string;
    tags: string[];
  }[];
  cwe: { id: string; name: string }[];
  affectedVersions: string;
  exploitabilityScore?: number;
  impactScore?: number;
}

/** CVE scan result interface */
export interface CVEScanResult {
  scanId: string;
  scanDate: string;
  projectName: string;
  totalDependencies: number;
  vulnerabilities: CVEVulnerability[];
  summary: {
    total: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    bySource: {
      nvd: number;
      ghsa: number;
      osv: number;
    };
  };
  progress?: {
    phase: string;
    percent: number;
  };
}

// ============================================================================
// Container Scanning (Feature #269)
// ============================================================================

export interface ContainerVulnerability {
  id: string;
  package: string;
  version: string;
  fixed_version?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cvss_score: number;
  in_base_image: boolean;
}

export interface ContainerLayer {
  id: string;
  command: string;
  size_mb: number;
  vulnerability_count: number;
  is_base_layer: boolean;
}

export interface ContainerScanResult {
  scan_id: string;
  image: {
    reference: string;
    name: string;
    tag: string;
    registry: string;
  };
  scan: {
    status: string;
    scanned_at: string;
    scanner: string;
    scanner_version: string;
  };
  summary: {
    total_vulnerabilities: number;
    by_severity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    fixable: number;
    from_base_image: number;
  };
  vulnerabilities: ContainerVulnerability[];
  layers?: ContainerLayer[];
  base_image?: {
    reference: string;
    vulnerabilities: number;
    recommendation: string;
  };
}

// ============================================================================
// Vulnerability History (Feature #774)
// ============================================================================

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

export interface SeverityCount {
  open: number;
  fixed: number;
}

export interface VulnerabilityStats {
  by_severity?: {
    critical?: SeverityCount;
    high?: SeverityCount;
    medium?: SeverityCount;
    low?: SeverityCount;
  };
  overall?: {
    total_vulnerabilities: number;
    currently_open: number;
    fixed_all_time: number;
    oldest_open_days: number;
  };
  top_affected_dependencies?: AffectedDependency[];
}

export interface AffectedDependency {
  name: string;
  count: number;
  open: number;
}

export interface VulnerabilitySummary {
  total: number;
  open: number;
  fixed: number;
  ignored: number;
  avg_time_to_fix_days?: number;
}

// ============================================================================
// Exploitability Analysis (Feature #775)
// ============================================================================

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
    analysis_method: string;
  };
  known_exploits: {
    has_public_exploit: boolean;
    exploit_maturity: string;
    exploit_sources: Array<{ source: string; url?: string; date_published?: string }>;
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
    overall_risk: string;
    exploitability_score: number;
    impact_score: number;
    priority_score: number;
    recommended_action: string;
    remediation_effort: string;
  };
  analyzed_at: string;
}

// ============================================================================
// License Compliance (Feature #763)
// ============================================================================

/** License types and their characteristics */
export interface LicenseInfo {
  id: string;
  spdxId: string;
  name: string;
  category: 'permissive' | 'copyleft' | 'copyleft-weak' | 'proprietary' | 'public-domain' | 'unknown';
  copyleft: boolean;
  commercial: boolean;
  attribution: boolean;
  patentGrant: boolean;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
}

/** Dependency with license information */
export interface DependencyLicense {
  id: string;
  pkgName: string;
  version: string;
  license: LicenseInfo;
  isCompliant: boolean;
  warnings: string[];
  repository?: string;
  author?: string;
  dependencies?: number;
  source: 'direct' | 'transitive';
}

/** License policy configuration */
export interface LicensePolicy {
  id: string;
  name: string;
  allowedLicenses: string[]; // SPDX IDs
  deniedLicenses: string[]; // SPDX IDs
  requireApproval: string[]; // Licenses that need manual approval
  warnOnCopyleft: boolean;
  warnOnUnknown: boolean;
  failOnDenied: boolean;
  enabled: boolean;
}

/** License scan result */
export interface LicenseScanResult {
  id: string;
  status: 'pending' | 'scanning' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  projectName: string;
  dependencies: DependencyLicense[];
  summary: {
    total: number;
    compliant: number;
    nonCompliant: number;
    warnings: number;
    byCategory: Record<string, number>;
    byRisk: { low: number; medium: number; high: number };
  };
  progress?: {
    phase: string;
    percentage: number;
  };
}

// ============================================================================
// Security Report Section (used in ComprehensiveReport)
// ============================================================================

export interface SecurityReportSection {
  type: 'security';
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    riskScore: number;
  };
  vulnerabilities: Array<{
    id: string;
    name: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    category: string;
    description: string;
  }>;
}
