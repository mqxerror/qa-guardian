/**
 * Security Advanced Routes - Types and Helpers
 *
 * Type definitions and helper functions for security-advanced.ts
 *
 * Feature #1356: Extracted to reduce file size
 *
 * @module security-advanced-types
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface DastScanBody {
  target_url: string;
  scan_type?: 'baseline' | 'full' | 'api' | 'ajax';
  project_id?: string;
  auth_config?: {
    type: 'none' | 'basic' | 'bearer' | 'cookie' | 'form';
    username?: string;
    password?: string;
    token?: string;
    login_url?: string;
  };
  scan_options?: {
    max_depth?: number;
    max_duration_minutes?: number;
    exclude_paths?: string[];
    include_paths?: string[];
    ajax_spider?: boolean;
  };
}

export interface SecurityReportBody {
  format?: 'pdf' | 'html' | 'json' | 'markdown';
  include_sections?: string[];
  time_range?: '24h' | '7d' | '30d' | '90d' | 'all';
  severity_threshold?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  executive_summary?: boolean;
}

export interface SecurityPolicyBody {
  severity_threshold?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  blocked_licenses?: string[];
  approved_licenses?: string[];
  require_license_review?: boolean;
  secret_detection?: {
    enabled?: boolean;
    block_on_active?: boolean;
    allowed_paths?: string[];
  };
  dast_policy?: {
    enabled?: boolean;
    max_severity?: 'critical' | 'high' | 'medium' | 'low';
    scan_frequency?: 'on_deploy' | 'daily' | 'weekly' | 'manual';
  };
  sbom_policy?: {
    auto_generate?: boolean;
    format?: 'cyclonedx' | 'spdx';
  };
}

export interface SecurityScanSchedule {
  schedule_id: string;
  project_id: string;
  scan_type: string;
  frequency: string;
  day_of_week?: number;
  time_of_day: string;
  target_url?: string;
  image?: string;
  notify_on_failure: boolean;
  notify_on_vulnerabilities: boolean;
  severity_threshold: string;
  status: string;
  created_at: string;
  next_run: string;
  last_run: string | null;
}

// ============================================================================
// In-Memory Stores
// ============================================================================

/**
 * Store for security policies
 * Key: projectId
 */
export const securityPolicies = new Map<string, Record<string, unknown>>();

/**
 * Store for security scan schedules
 * Key: scheduleId
 */
export const securityScanSchedules = new Map<string, SecurityScanSchedule>();

// ============================================================================
// Constants
// ============================================================================

/**
 * Secret type definitions for detection
 */
export const secretTypes = [
  { type: 'aws_access_key', pattern: 'AKIA[A-Z0-9]{16}', severity: 'critical' as const, name: 'AWS Access Key ID', verifiable: true },
  { type: 'aws_secret_key', pattern: '[A-Za-z0-9/+=]{40}', severity: 'critical' as const, name: 'AWS Secret Access Key', verifiable: true },
  { type: 'github_token', pattern: 'gh[ps]_[A-Za-z0-9]{36}', severity: 'critical' as const, name: 'GitHub Personal Access Token', verifiable: true },
  { type: 'api_key', pattern: '[a-zA-Z0-9]{32,}', severity: 'high' as const, name: 'Generic API Key', verifiable: false },
  { type: 'private_key', pattern: '-----BEGIN (RSA|EC|DSA) PRIVATE KEY-----', severity: 'critical' as const, name: 'Private Key', verifiable: false },
  { type: 'password', pattern: 'password\\s*=\\s*["\'][^"\']+["\']', severity: 'high' as const, name: 'Hardcoded Password', verifiable: false },
  { type: 'database_url', pattern: '(mysql|postgres|mongodb)://[^\\s]+', severity: 'high' as const, name: 'Database Connection String', verifiable: true },
  { type: 'jwt_secret', pattern: 'JWT_SECRET\\s*=\\s*["\'][^"\']+["\']', severity: 'high' as const, name: 'JWT Secret', verifiable: false },
  { type: 'slack_token', pattern: 'xox[baprs]-[A-Za-z0-9-]+', severity: 'medium' as const, name: 'Slack Token', verifiable: true },
  { type: 'sendgrid_key', pattern: 'SG\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{43}', severity: 'medium' as const, name: 'SendGrid API Key', verifiable: true },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate next run time for a scheduled scan
 */
export function calculateNextRun(freq: string, dow?: number, tod: string = '02:00'): string {
  const timeParts = tod.split(':').map(Number);
  const hours = timeParts[0] ?? 2;
  const minutes = timeParts[1] ?? 0;
  const now = new Date();
  const nextRun = new Date();
  nextRun.setUTCHours(hours, minutes, 0, 0);

  switch (freq) {
    case 'hourly':
      nextRun.setTime(now.getTime() + 60 * 60 * 1000);
      break;
    case 'daily':
      if (nextRun.getTime() <= now.getTime()) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;
    case 'weekly':
      while (nextRun.getUTCDay() !== dow || nextRun.getTime() <= now.getTime()) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;
    case 'monthly':
      nextRun.setDate(1);
      if (nextRun.getTime() <= now.getTime()) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;
  }
  return nextRun.toISOString();
}

// ============================================================================
// Secret Category Mapping (for secrets dashboard)
// ============================================================================

/**
 * Maps secret rule IDs to their categories
 */
export const secretCategoryMap: Record<string, string> = {
  'aws-access-key': 'Cloud Credentials',
  'aws-secret-key': 'Cloud Credentials',
  'aws_access_key': 'Cloud Credentials',
  'aws_secret_key': 'Cloud Credentials',
  'github-token': 'API Tokens',
  'github-oauth': 'API Tokens',
  'github_token': 'API Tokens',
  'generic-api-key': 'API Tokens',
  'generic_api_key': 'API Tokens',
  'api_key': 'API Tokens',
  'private-key': 'Cryptographic Keys',
  'private_key': 'Cryptographic Keys',
  'stripe-key': 'API Tokens',
  'stripe-test': 'API Tokens',
  'npm-token': 'API Tokens',
  'slack-webhook': 'API Tokens',
  'slack_token': 'API Tokens',
  'sendgrid_key': 'API Tokens',
  'generic-secret': 'Credentials',
  'generic_secret': 'Credentials',
  'password': 'Credentials',
  'database_url': 'Connection Strings',
  'jwt_secret': 'Cryptographic Keys',
};

/**
 * Get category for a secret rule ID
 */
export function getCategoryForRuleId(ruleId: string): string {
  const normalized = ruleId.toLowerCase();
  for (const [key, val] of Object.entries(secretCategoryMap)) {
    if (normalized.includes(key)) return val;
  }
  if (normalized.includes('aws') || normalized.includes('azure') || normalized.includes('gcp')) return 'Cloud Credentials';
  if (normalized.includes('token') || normalized.includes('key') || normalized.includes('api')) return 'API Tokens';
  if (normalized.includes('password') || normalized.includes('secret') || normalized.includes('credential')) return 'Credentials';
  if (normalized.includes('private') || normalized.includes('cert')) return 'Cryptographic Keys';
  if (normalized.includes('database') || normalized.includes('connection') || normalized.includes('url')) return 'Connection Strings';
  return 'Other';
}

// ============================================================================
// SBOM Sample Components
// ============================================================================

/**
 * Sample SBOM components for demonstration
 */
export const sampleSbomComponents = [
  { name: 'react', version: '18.2.0', type: 'library', license: 'MIT', purl: 'pkg:npm/react@18.2.0', scope: 'production' },
  { name: 'react-dom', version: '18.2.0', type: 'library', license: 'MIT', purl: 'pkg:npm/react-dom@18.2.0', scope: 'production' },
  { name: 'typescript', version: '5.3.3', type: 'library', license: 'Apache-2.0', purl: 'pkg:npm/typescript@5.3.3', scope: 'development' },
  { name: 'vite', version: '5.0.0', type: 'library', license: 'MIT', purl: 'pkg:npm/vite@5.0.0', scope: 'development' },
  { name: 'express', version: '4.18.2', type: 'library', license: 'MIT', purl: 'pkg:npm/express@4.18.2', scope: 'production' },
  { name: 'fastify', version: '4.24.3', type: 'library', license: 'MIT', purl: 'pkg:npm/fastify@4.24.3', scope: 'production' },
  { name: '@types/node', version: '20.10.4', type: 'library', license: 'MIT', purl: 'pkg:npm/%40types/node@20.10.4', scope: 'development' },
  { name: 'lodash', version: '4.17.21', type: 'library', license: 'MIT', purl: 'pkg:npm/lodash@4.17.21', scope: 'production' },
  { name: 'axios', version: '1.6.2', type: 'library', license: 'MIT', purl: 'pkg:npm/axios@1.6.2', scope: 'production' },
  { name: 'zod', version: '3.22.4', type: 'library', license: 'MIT', purl: 'pkg:npm/zod@3.22.4', scope: 'production' },
  { name: 'jest', version: '29.7.0', type: 'library', license: 'MIT', purl: 'pkg:npm/jest@29.7.0', scope: 'development' },
  { name: 'eslint', version: '8.55.0', type: 'library', license: 'MIT', purl: 'pkg:npm/eslint@8.55.0', scope: 'development' },
  { name: 'prettier', version: '3.1.0', type: 'library', license: 'MIT', purl: 'pkg:npm/prettier@3.1.0', scope: 'development' },
  { name: 'tailwindcss', version: '3.3.6', type: 'library', license: 'MIT', purl: 'pkg:npm/tailwindcss@3.3.6', scope: 'production' },
  { name: '@radix-ui/react-dialog', version: '1.0.5', type: 'library', license: 'MIT', purl: 'pkg:npm/%40radix-ui/react-dialog@1.0.5', scope: 'production' },
];

// ============================================================================
// Container Scan Sample Vulnerabilities
// ============================================================================

/**
 * Sample container vulnerabilities for demonstration
 */
export const sampleContainerVulnerabilities = [
  { id: 'CVE-2024-3456', package: 'openssl', version: '1.1.1k', fixed_version: '1.1.1n', severity: 'critical', cvss_score: 9.8, in_base_image: true },
  { id: 'CVE-2024-7890', package: 'libcurl', version: '7.74.0', fixed_version: '7.79.0', severity: 'high', cvss_score: 7.5, in_base_image: true },
  { id: 'CVE-2024-2345', package: 'nodejs', version: '18.12.0', fixed_version: '18.14.0', severity: 'high', cvss_score: 7.8, in_base_image: false },
  { id: 'CVE-2024-1234', package: 'glibc', version: '2.31', fixed_version: '2.35', severity: 'medium', cvss_score: 5.5, in_base_image: true },
  { id: 'CVE-2024-5678', package: 'zlib', version: '1.2.11', fixed_version: '1.2.12', severity: 'low', cvss_score: 3.5, in_base_image: true },
];

// ============================================================================
// Vulnerability Info Map
// ============================================================================

/**
 * Common vulnerability information for fix suggestions
 */
export const vulnInfoMap: Record<string, { title: string; severity: string; cwe: string; description: string }> = {
  'CVE-2021-23337': { title: 'Prototype Pollution in lodash', severity: 'high', cwe: 'CWE-1321', description: 'Lodash versions prior to 4.17.21 are vulnerable to Prototype Pollution.' },
  'CVE-2020-28469': { title: 'ReDoS in glob-parent', severity: 'high', cwe: 'CWE-400', description: 'glob-parent before 5.1.2 is vulnerable to ReDoS.' },
};

/**
 * Safe versions for common packages
 */
export const safeVersionsMap: Record<string, string> = {
  'lodash': '4.17.21',
  'glob-parent': '5.1.2',
  'axios': '1.6.0',
  'express': '4.18.2',
};

/**
 * Package alternatives for replacement suggestions
 */
export const packageAlternatives: Record<string, { name: string; description: string }> = {
  'lodash': { name: 'lodash-es', description: 'ES module version with better tree-shaking' },
  'moment': { name: 'dayjs', description: 'Lightweight alternative' },
};
