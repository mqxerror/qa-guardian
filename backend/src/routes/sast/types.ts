/**
 * SAST Module Types
 *
 * Type definitions for Static Application Security Testing including:
 * - Configuration
 * - Scan results and findings
 * - False positives
 * - PR integration
 *
 * Extracted from sast.ts (Feature #1376)
 */

// Severity levels for SAST findings
export type SASTSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

// Custom Semgrep rule definition
export interface CustomRule {
  id: string;
  name: string;
  yaml: string;  // YAML rule definition
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// SAST configuration for a project
export interface SASTConfig {
  enabled: boolean;
  ruleset: 'default' | 'security' | 'custom';
  customRules?: string[];  // Custom rule patterns
  customRulesYaml?: CustomRule[];  // User-defined YAML rules
  excludePaths?: string[];  // Paths to exclude from scanning
  severityThreshold: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';  // Minimum severity to report
  autoScan: boolean;  // Auto-scan on repository changes
  lastScanAt?: string;
  lastScanStatus?: 'pending' | 'running' | 'completed' | 'failed';
  // GitHub PR integration settings
  prChecksEnabled?: boolean;  // Enable SAST checks on PRs
  prCommentsEnabled?: boolean;  // Post SAST findings as PR comments
  blockPrOnCritical?: boolean;  // Block PR merge if critical findings
  blockPrOnHigh?: boolean;  // Block PR merge if high or critical findings
}

// Remediation guidance for a finding
export interface RemediationGuidance {
  summary: string;
  steps: string[];
  secureCodeExample?: {
    before: string;
    after: string;
    language: string;
  };
  references: {
    title: string;
    url: string;
  }[];
}

// Individual SAST finding
export interface SASTFinding {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: SASTSeverity;
  category: string;
  message: string;
  filePath: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  snippet?: string;
  cweId?: string;
  owaspCategory?: string;
  suggestion?: string;
  remediation?: RemediationGuidance;  // Detailed remediation guidance
  isFalsePositive?: boolean;  // Whether this finding is marked as false positive
}

// SAST scan result
export interface SASTScanResult {
  id: string;
  projectId: string;
  repositoryUrl?: string;
  branch?: string;
  commitSha?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  findings: SASTFinding[];
  summary: {
    total: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    byCategory: Record<string, number>;
  };
  error?: string;
}

// False positive record
export interface FalsePositive {
  id: string;
  projectId: string;
  ruleId: string;
  filePath: string;
  line: number;
  snippet?: string;
  reason: string;
  markedBy: string;
  markedAt: string;
}

// SAST PR check result
export interface SASTPRCheck {
  id: string;
  projectId: string;
  prNumber: number;
  prTitle: string;
  headSha: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'error';
  conclusion?: 'success' | 'failure' | 'blocked';
  context: string;
  description: string;
  targetUrl?: string;
  scanId?: string;
  findings?: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  blocked: boolean;
  blockReason?: string;
  createdAt: string;
  updatedAt: string;
}

// SAST PR comment
export interface SASTPRComment {
  id: string;
  projectId: string;
  prNumber: number;
  scanId: string;
  body: string;
  findings: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  blocked: boolean;
  createdAt: string;
}

/**
 * Feature #1558: Custom Gitleaks secret pattern
 * Allows users to define organization-specific secret patterns
 */
export interface SecretPattern {
  id: string;
  name: string;
  description?: string;
  pattern: string;  // Regex pattern
  severity: SASTSeverity;
  category: string;  // e.g., 'cloud', 'internal', 'api-key'
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Feature #1558: Common rule templates for Gitleaks
 * Pre-defined patterns users can select as starting points
 */
export interface SecretPatternTemplate {
  id: string;
  name: string;
  description: string;
  pattern: string;
  severity: SASTSeverity;
  category: string;
}
