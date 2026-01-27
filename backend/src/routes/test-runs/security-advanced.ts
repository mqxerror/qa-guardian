/**
 * Test Runs - Advanced Security Routes Module (Feature #1356)
 * Contains: secrets, SBOM, DAST, reports, policies, container scanning, schedules
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId } from '../../middleware/auth';
import { projects } from '../projects';

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
// Helper Functions
// ============================================================================

/**
 * Secret type definitions for detection
 */
const secretTypes = [
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

/**
 * Calculate next run time for a scheduled scan
 */
function calculateNextRun(freq: string, dow?: number, tod: string = '02:00'): string {
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
// Route Definitions
// ============================================================================

export async function securityAdvancedRoutes(app: FastifyInstance) {
  // ============================================
  // Feature #927: Get exposed secrets for a project
  // ============================================
  app.get<{ Params: { projectId: string }; Querystring: { scan_id?: string; severity?: string; secret_type?: string } }>('/api/v1/security/secrets/:projectId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const { scan_id, severity, secret_type } = request.query;
    const orgId = getOrganizationId(request);

    // Verify project exists
    const project = projects.get(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Project with ID ${projectId} not found`,
      });
    }

    // Sample file paths for simulated secrets
    const files = [
      { path: 'src/config/database.ts', author: 'john.doe@example.com' },
      { path: 'src/services/aws-client.ts', author: 'jane.smith@example.com' },
      { path: '.env.example', author: 'john.doe@example.com' },
      { path: 'src/utils/auth.ts', author: 'mike.wilson@example.com' },
      { path: 'scripts/deploy.sh', author: 'jane.smith@example.com' },
      { path: 'config/production.json', author: 'admin@example.com' },
      { path: 'test/fixtures/mock-config.ts', author: 'test.user@example.com' },
    ];

    // Generate simulated secrets
    const detectedSecrets: {
      id: string;
      secret_type: string;
      secret_type_name: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      file_path: string;
      line_number: number;
      column_start: number;
      column_end: number;
      snippet: string;
      masked_value: string;
      first_detected: string;
      last_seen: string;
      commit_sha: string;
      author: string;
      is_verified: boolean;
      remediation: string;
    }[] = [];

    // Generate 5-10 random secrets
    const numSecrets = 5 + Math.floor(Math.random() * 6);
    for (let i = 0; i < numSecrets; i++) {
      const secretDefIndex = Math.floor(Math.random() * secretTypes.length);
      const secretDef = secretTypes[secretDefIndex]!;
      const fileIndex = Math.floor(Math.random() * files.length);
      const file = files[fileIndex]!;
      const lineNum = 10 + Math.floor(Math.random() * 200);
      const colStart = 5 + Math.floor(Math.random() * 20);
      const daysAgo = Math.floor(Math.random() * 90);

      // Generate masked value
      const maskedLength = 12 + Math.floor(Math.random() * 20);
      const maskedValue = '*'.repeat(maskedLength);

      // Generate code snippet based on secret type
      let snippet = '';
      switch (secretDef.type) {
        case 'aws_access_key':
          snippet = `const AWS_ACCESS_KEY = "AKIA${maskedValue.substring(0, 16)}";`;
          break;
        case 'github_token':
          snippet = `GITHUB_TOKEN=ghp_${maskedValue.substring(0, 36)}`;
          break;
        case 'password':
          snippet = `const password = "${maskedValue}";`;
          break;
        case 'database_url':
          snippet = `DATABASE_URL=postgres://user:${maskedValue}@localhost:5432/db`;
          break;
        case 'private_key':
          snippet = `-----BEGIN RSA PRIVATE KEY-----\n${maskedValue}...`;
          break;
        default:
          snippet = `${secretDef.type.toUpperCase()}="${maskedValue}"`;
      }

      detectedSecrets.push({
        id: `secret-${projectId}-${i + 1}`,
        secret_type: secretDef.type,
        secret_type_name: secretDef.name,
        severity: secretDef.severity,
        file_path: file.path,
        line_number: lineNum,
        column_start: colStart,
        column_end: colStart + 20,
        snippet: snippet,
        masked_value: maskedValue.substring(0, 8) + '...',
        first_detected: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
        last_seen: new Date(Date.now() - Math.floor(daysAgo / 2) * 24 * 60 * 60 * 1000).toISOString(),
        commit_sha: Math.random().toString(16).substring(2, 10),
        author: file.author,
        is_verified: Math.random() > 0.3,
        remediation: `Rotate the ${secretDef.name} and remove from source code. Use environment variables or a secrets manager instead.`,
      });
    }

    // Apply filters
    let filteredSecrets = [...detectedSecrets];
    if (severity) {
      filteredSecrets = filteredSecrets.filter(s => s.severity === severity);
    }
    if (secret_type) {
      filteredSecrets = filteredSecrets.filter(s => s.secret_type === secret_type);
    }

    // Calculate summary by severity
    const bySeverity = {
      critical: detectedSecrets.filter(s => s.severity === 'critical').length,
      high: detectedSecrets.filter(s => s.severity === 'high').length,
      medium: detectedSecrets.filter(s => s.severity === 'medium').length,
      low: detectedSecrets.filter(s => s.severity === 'low').length,
    };

    // Calculate summary by type
    const byType: Record<string, number> = {};
    for (const secret of detectedSecrets) {
      byType[secret.secret_type] = (byType[secret.secret_type] || 0) + 1;
    }

    // Calculate affected files
    const affectedFiles = [...new Set(detectedSecrets.map(s => s.file_path))];

    return {
      project_id: projectId,
      project_name: project.name,
      scan_id: scan_id || `secrets-scan-${Date.now()}`,
      scanned_at: new Date().toISOString(),
      summary: {
        total_secrets: detectedSecrets.length,
        filtered_count: filteredSecrets.length,
        by_severity: bySeverity,
        by_type: byType,
        affected_files: affectedFiles.length,
        verified_secrets: detectedSecrets.filter(s => s.is_verified).length,
      },
      secrets: filteredSecrets,
      affected_files: affectedFiles.map(fp => ({
        path: fp,
        secret_count: detectedSecrets.filter(s => s.file_path === fp).length,
      })),
      recommendations: [
        bySeverity.critical > 0
          ? { priority: 'critical', action: `Immediately rotate ${bySeverity.critical} critical secrets (AWS keys, private keys)` }
          : null,
        bySeverity.high > 0
          ? { priority: 'high', action: `Rotate ${bySeverity.high} high-severity secrets (API keys, passwords)` }
          : null,
        { priority: 'medium', action: 'Set up pre-commit hooks to prevent future secret commits' },
        { priority: 'info', action: 'Consider using a secrets manager (HashiCorp Vault, AWS Secrets Manager)' },
      ].filter(Boolean),
    };
  });

  // ============================================
  // Secrets Dashboard Endpoint (aggregates secrets across all projects)
  // Frontend expects: SecretsData interface with camelCase fields
  // ============================================
  app.get<{ Querystring: { project?: string; secretType?: string; sortBy?: string; sortOrder?: string } }>('/api/v1/secrets/dashboard', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { project, secretType, sortBy = 'date', sortOrder = 'desc' } = request.query;
    const orgId = getOrganizationId(request);

    // Get all projects for this organization
    const orgProjects = Array.from(projects.values()).filter(p => p.organization_id === orgId);

    // Sample file paths for simulated secrets
    const files = [
      { path: 'src/config/database.ts', author: 'john.doe@example.com' },
      { path: 'src/services/aws-client.ts', author: 'jane.smith@example.com' },
      { path: '.env.example', author: 'john.doe@example.com' },
      { path: 'src/utils/auth.ts', author: 'mike.wilson@example.com' },
      { path: 'scripts/deploy.sh', author: 'jane.smith@example.com' },
      { path: 'config/production.json', author: 'admin@example.com' },
    ];

    // Secret categories
    const secretCategories: Record<string, string> = {
      aws_access_key: 'Cloud Credentials',
      aws_secret_key: 'Cloud Credentials',
      github_token: 'API Tokens',
      api_key: 'API Tokens',
      private_key: 'Cryptographic Keys',
      password: 'Credentials',
      database_url: 'Connection Strings',
      jwt_secret: 'Cryptographic Keys',
      slack_token: 'API Tokens',
      sendgrid_key: 'API Tokens',
    };

    // Generate secrets for each project (DetectedSecret format)
    interface DetectedSecret {
      id: string;
      projectId: string;
      projectName: string;
      secretType: string;
      secretTypeName: string;
      category: string;
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      filePath: string;
      line: number;
      column?: number;
      snippet: string;
      detectedAt: string;
      commitSha?: string;
      commitAuthor?: string;
      status: 'active' | 'resolved' | 'false-positive';
      resolvedAt?: string;
      resolvedBy?: string;
      verificationStatus?: 'unverified' | 'active' | 'revoked' | 'unknown';
      lastVerifiedAt?: string;
      lastVerifiedBy?: string;
      verificationError?: string;
    }

    const allSecrets: DetectedSecret[] = [];

    for (const proj of orgProjects) {
      // Filter by project if specified
      if (project && project !== 'all' && proj.id !== project) continue;

      // Generate 2-5 secrets per project
      const numSecrets = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < numSecrets; i++) {
        const secretDefIndex = Math.floor(Math.random() * secretTypes.length);
        const secretDef = secretTypes[secretDefIndex]!;

        // Filter by secret type if specified
        if (secretType && secretType !== 'all' && secretDef.type !== secretType) continue;

        const fileIndex = Math.floor(Math.random() * files.length);
        const file = files[fileIndex]!;
        const lineNum = 10 + Math.floor(Math.random() * 200);
        const daysAgo = Math.floor(Math.random() * 90);

        const maskedLength = 12 + Math.floor(Math.random() * 20);
        const maskedValue = '*'.repeat(maskedLength);

        let snippet = '';
        switch (secretDef.type) {
          case 'aws_access_key':
            snippet = `const AWS_ACCESS_KEY = "AKIA${maskedValue.substring(0, 16)}";`;
            break;
          case 'github_token':
            snippet = `GITHUB_TOKEN=ghp_${maskedValue.substring(0, 36)}`;
            break;
          case 'password':
            snippet = `const password = "${maskedValue}";`;
            break;
          case 'database_url':
            snippet = `DATABASE_URL=postgres://user:${maskedValue}@localhost:5432/db`;
            break;
          case 'private_key':
            snippet = `-----BEGIN RSA PRIVATE KEY-----\n${maskedValue}...`;
            break;
          default:
            snippet = `${secretDef.type.toUpperCase()}="${maskedValue}"`;
        }

        const detectedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
        const statusRand = Math.random();
        const status: 'active' | 'resolved' | 'false-positive' = statusRand > 0.7 ? 'resolved' : statusRand > 0.9 ? 'false-positive' : 'active';
        const verificationRand = Math.random();
        const verificationStatus: 'unverified' | 'active' | 'revoked' | 'unknown' = verificationRand > 0.6 ? 'active' : verificationRand > 0.3 ? 'unverified' : verificationRand > 0.1 ? 'revoked' : 'unknown';

        allSecrets.push({
          id: `secret-${proj.id}-${i + 1}`,
          projectId: proj.id,
          projectName: proj.name,
          secretType: secretDef.type,
          secretTypeName: secretDef.name,
          category: secretCategories[secretDef.type] || 'Other',
          severity: secretDef.severity.toUpperCase() as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
          filePath: file.path,
          line: lineNum,
          column: 5 + Math.floor(Math.random() * 20),
          snippet,
          detectedAt,
          commitSha: `abc${Math.floor(Math.random() * 1000000).toString(16).padStart(6, '0')}`,
          commitAuthor: file.author,
          status,
          resolvedAt: status === 'resolved' ? new Date().toISOString() : undefined,
          resolvedBy: status === 'resolved' ? 'security-team@example.com' : undefined,
          verificationStatus,
          lastVerifiedAt: verificationStatus !== 'unverified' ? new Date().toISOString() : undefined,
        });
      }
    }

    // Sort the results
    const sortedSecrets = [...allSecrets].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'severity': {
          const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
          comparison = severityOrder[a.severity] - severityOrder[b.severity];
          break;
        }
        case 'project':
          comparison = a.projectName.localeCompare(b.projectName);
          break;
        case 'type':
          comparison = a.secretType.localeCompare(b.secretType);
          break;
        case 'date':
        default:
          comparison = new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Calculate summary stats (bySeverity uses lowercase keys per frontend interface)
    const bySeverity = {
      critical: sortedSecrets.filter(s => s.severity === 'CRITICAL').length,
      high: sortedSecrets.filter(s => s.severity === 'HIGH').length,
      medium: sortedSecrets.filter(s => s.severity === 'MEDIUM').length,
      low: sortedSecrets.filter(s => s.severity === 'LOW').length,
    };

    // bySecretType - array format per frontend interface
    const typeCountMap: Record<string, number> = {};
    for (const s of sortedSecrets) {
      typeCountMap[s.secretType] = (typeCountMap[s.secretType] || 0) + 1;
    }
    const bySecretType = secretTypes.map(st => ({
      type: st.type,
      name: st.name,
      count: typeCountMap[st.type] || 0,
      severity: st.severity.toUpperCase(),
      category: secretCategories[st.type] || 'Other',
    })).filter(t => t.count > 0);

    // byCategory
    const byCategory: Record<string, number> = {};
    for (const s of sortedSecrets) {
      byCategory[s.category] = (byCategory[s.category] || 0) + 1;
    }

    // byProject
    const projectCountMap: Record<string, { id: string; name: string; count: number }> = {};
    for (const s of sortedSecrets) {
      if (!projectCountMap[s.projectId]) {
        projectCountMap[s.projectId] = { id: s.projectId, name: s.projectName, count: 0 };
      }
      projectCountMap[s.projectId]!.count++;
    }
    const byProject = Object.values(projectCountMap);

    // secretTypes for filters (SecretType format)
    const secretTypesList = secretTypes.map(st => ({
      id: st.type,
      name: st.name,
      category: secretCategories[st.type] || 'Other',
      severity: st.severity.toUpperCase() as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
    }));

    return {
      secrets: sortedSecrets,
      summary: {
        total: sortedSecrets.length,
        active: sortedSecrets.filter(s => s.status === 'active').length,
        resolved: sortedSecrets.filter(s => s.status === 'resolved').length,
        falsePositives: sortedSecrets.filter(s => s.status === 'false-positive').length,
        bySeverity,
        bySecretType,
        byCategory,
        byProject,
      },
      secretTypes: secretTypesList,
    };
  });

  // ============================================
  // Feature #928: Verify if a secret is still active
  // ============================================
  app.post<{ Params: { secretId: string }; Querystring: { force_recheck?: string } }>('/api/v1/security/secrets/:secretId/verify', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { secretId } = request.params;
    const { force_recheck } = request.query;
    const orgId = getOrganizationId(request);
    const user = (request as any).user;
    const forceRecheck = force_recheck === 'true';

    // Parse secret ID format: secret-{projectId}-{index}
    const secretIdMatch = secretId.match(/^secret-([^-]+)-(\d+)$/);
    if (!secretIdMatch) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid secret ID format. Expected format: secret-{projectId}-{index}',
      });
    }

    const projectId = secretIdMatch[1]!;
    const secretIndex = parseInt(secretIdMatch[2]!, 10);

    // Verify project exists and belongs to org
    const project = projects.get(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Project with ID ${projectId} not found`,
      });
    }

    // Get secret type based on index
    const secretType = secretTypes[secretIndex % secretTypes.length]!;
    const isVerifiable = secretType.verifiable;

    // Simulate verification
    const verificationStarted = new Date();
    let status: 'active' | 'revoked' | 'expired' | 'unknown' | 'unverifiable';
    let confidence: number;
    let details: Record<string, unknown> = {};

    if (!isVerifiable) {
      status = 'unverifiable';
      confidence = 0;
      details = {
        reason: `${secretType.name} cannot be verified programmatically`,
        suggestion: 'Manually check if this secret is still in use',
      };
    } else {
      // Simulate random verification results
      const rand = Math.random();
      if (rand < 0.4) {
        status = 'active';
        confidence = 85 + Math.floor(Math.random() * 15);
        details = {
          verified_at: new Date().toISOString(),
          last_used: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000).toISOString(),
          permissions: secretType.type === 'aws_access_key' ? ['s3:GetObject', 's3:PutObject', 'ec2:DescribeInstances'] :
                       secretType.type === 'github_token' ? ['repo', 'read:org', 'read:user'] :
                       ['read', 'write'],
        };
      } else if (rand < 0.7) {
        status = 'revoked';
        confidence = 90 + Math.floor(Math.random() * 10);
        details = {
          revoked_at: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
          revoked_by: 'security-team@example.com',
          reason: 'Secret detected in public repository',
        };
      } else if (rand < 0.85) {
        status = 'expired';
        confidence = 95;
        details = {
          expired_at: new Date(Date.now() - Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000).toISOString(),
          original_validity: '90 days',
        };
      } else {
        status = 'unknown';
        confidence = 0;
        details = {
          reason: 'Unable to verify - service unreachable or rate limited',
          retry_after: new Date(Date.now() + 60 * 1000).toISOString(),
        };
      }
    }

    const verificationCompleted = new Date();

    return {
      secret_id: secretId,
      project_id: projectId,
      secret_type: secretType.type,
      secret_type_name: secretType.name,
      verification: {
        status,
        confidence_percent: confidence,
        is_verifiable: isVerifiable,
        check_performed: isVerifiable,
        details,
      },
      timing: {
        started_at: verificationStarted.toISOString(),
        completed_at: verificationCompleted.toISOString(),
        duration_ms: verificationCompleted.getTime() - verificationStarted.getTime(),
        from_cache: !forceRecheck && Math.random() > 0.5,
        cache_ttl_seconds: 3600,
      },
      recommendations: status === 'active' ? [
        { priority: 'critical', action: `Immediately rotate this ${secretType.name}` },
        { priority: 'high', action: 'Remove the secret from source code' },
        { priority: 'medium', action: 'Audit usage logs for this credential' },
      ] : status === 'revoked' || status === 'expired' ? [
        { priority: 'low', action: 'Remove the revoked secret from source code for cleanup' },
        { priority: 'info', action: 'No immediate action required - secret is already inactive' },
      ] : status === 'unverifiable' ? [
        { priority: 'medium', action: 'Manually verify this secret is not in use' },
        { priority: 'medium', action: 'Consider rotating as a precaution' },
      ] : [
        { priority: 'medium', action: 'Retry verification later' },
        { priority: 'medium', action: 'Consider rotating as a precaution if sensitive' },
      ],
      verified_by: user?.email || 'system',
    };
  });

  // ============================================
  // Feature #929: Generate SBOM (Software Bill of Materials)
  // ============================================
  app.post<{ Params: { projectId: string }; Querystring: { format?: string; include_dev?: string } }>('/api/v1/security/sbom/:projectId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const { format = 'cyclonedx', include_dev } = request.query;
    const orgId = getOrganizationId(request);
    const user = (request as any).user;
    const includeDevDeps = include_dev === 'true';

    // Verify project exists
    const project = projects.get(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Project with ID ${projectId} not found`,
      });
    }

    // Validate format
    const validFormats = ['cyclonedx', 'spdx'];
    if (!validFormats.includes(format)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Invalid format. Supported formats: ${validFormats.join(', ')}`,
      });
    }

    // Simulated SBOM components
    const components = [
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

    // Filter components based on include_dev
    const filteredComponents = includeDevDeps
      ? components
      : components.filter(c => c.scope === 'production');

    // Generate SBOM ID
    const sbomId = `sbom-${projectId}-${Date.now()}`;
    const generatedAt = new Date().toISOString();

    // Build SBOM metadata based on format
    let sbomContent: Record<string, unknown>;
    let filename: string;
    let contentType: string;

    if (format === 'cyclonedx') {
      // CycloneDX format
      filename = `sbom-${project.name.toLowerCase().replace(/\s+/g, '-')}-cyclonedx.json`;
      contentType = 'application/json';
      sbomContent = {
        bomFormat: 'CycloneDX',
        specVersion: '1.5',
        serialNumber: `urn:uuid:${sbomId}`,
        version: 1,
        metadata: {
          timestamp: generatedAt,
          tools: [
            { vendor: 'QA Guardian', name: 'SBOM Generator', version: '1.0.0' }
          ],
          component: {
            type: 'application',
            name: project.name,
            version: '1.0.0',
          },
        },
        components: filteredComponents.map(c => ({
          type: c.type,
          name: c.name,
          version: c.version,
          purl: c.purl,
          licenses: [{ license: { id: c.license } }],
          scope: c.scope === 'production' ? 'required' : 'optional',
        })),
      };
    } else {
      // SPDX format
      filename = `sbom-${project.name.toLowerCase().replace(/\s+/g, '-')}-spdx.json`;
      contentType = 'application/json';
      sbomContent = {
        spdxVersion: 'SPDX-2.3',
        dataLicense: 'CC0-1.0',
        SPDXID: 'SPDXRef-DOCUMENT',
        name: `${project.name}-SBOM`,
        documentNamespace: `https://qa-guardian.example.com/sbom/${sbomId}`,
        creationInfo: {
          created: generatedAt,
          creators: ['Tool: QA Guardian SBOM Generator-1.0.0'],
        },
        packages: filteredComponents.map((c, idx) => ({
          SPDXID: `SPDXRef-Package-${idx + 1}`,
          name: c.name,
          versionInfo: c.version,
          downloadLocation: 'NOASSERTION',
          filesAnalyzed: false,
          licenseConcluded: c.license,
          licenseDeclared: c.license,
          externalRefs: [
            {
              referenceCategory: 'PACKAGE-MANAGER',
              referenceType: 'purl',
              referenceLocator: c.purl,
            }
          ],
        })),
      };
    }

    // Calculate summary
    const licenseDistribution: Record<string, number> = {};
    for (const comp of filteredComponents) {
      licenseDistribution[comp.license] = (licenseDistribution[comp.license] || 0) + 1;
    }

    return {
      sbom_id: sbomId,
      project_id: projectId,
      project_name: project.name,
      format,
      spec_version: format === 'cyclonedx' ? '1.5' : '2.3',
      generated_at: generatedAt,
      generated_by: user?.email || 'system',
      summary: {
        total_components: filteredComponents.length,
        production_components: filteredComponents.filter(c => c.scope === 'production').length,
        dev_components: filteredComponents.filter(c => c.scope === 'development').length,
        unique_licenses: Object.keys(licenseDistribution).length,
        license_distribution: licenseDistribution,
      },
      download: {
        url: `/api/v1/security/sbom/${sbomId}/download`,
        filename,
        content_type: contentType,
        size_bytes: JSON.stringify(sbomContent).length,
      },
      sbom: sbomContent,
      compliance: {
        executive_order_14028: true,
        ntia_minimum_elements: true,
        missing_elements: [],
      },
    };
  });

  // ============================================
  // Feature #931: DAST scan trigger
  // ============================================
  app.post<{ Body: DastScanBody }>('/api/v1/security/dast/scan', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { target_url, scan_type = 'baseline', project_id, auth_config, scan_options } = request.body;
    const orgId = getOrganizationId(request);

    if (!target_url) {
      return reply.status(400).send({ error: 'Bad Request', message: 'target_url is required' });
    }

    // Validate URL format
    try {
      new URL(target_url);
    } catch {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid target_url format' });
    }

    // If project_id provided, verify ownership
    if (project_id) {
      const project = projects.get(project_id);
      if (!project || project.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Not Found', message: `Project with ID ${project_id} not found` });
      }
    }

    const scanId = `dast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const startTime = new Date().toISOString();

    // Scan configuration based on scan_type
    const scanConfig = {
      baseline: { estimated_duration_minutes: 5, checks: 15, spider_enabled: true, ajax_spider: false },
      full: { estimated_duration_minutes: 60, checks: 150, spider_enabled: true, ajax_spider: true },
      api: { estimated_duration_minutes: 15, checks: 45, spider_enabled: false, ajax_spider: false },
      ajax: { estimated_duration_minutes: 30, checks: 80, spider_enabled: true, ajax_spider: true },
    }[scan_type] || { estimated_duration_minutes: 5, checks: 15, spider_enabled: true, ajax_spider: false };

    // Apply scan options overrides
    if (scan_options?.ajax_spider !== undefined) {
      scanConfig.ajax_spider = scan_options.ajax_spider;
    }

    // Simulate initial findings
    const initialFindings = [
      {
        id: `finding-${scanId}-1`,
        rule_id: 'x-frame-options',
        name: 'X-Frame-Options Header Missing',
        severity: 'medium',
        confidence: 'high',
        url: target_url,
        method: 'GET',
        attack: '',
        evidence: 'The X-Frame-Options header is missing',
        cweid: 1021,
        wascid: 15,
        description: 'The page does not include an X-Frame-Options header to protect against clickjacking.',
        solution: 'Add X-Frame-Options: DENY or X-Frame-Options: SAMEORIGIN header',
        reference: 'https://owasp.org/www-community/attacks/Clickjacking',
        found_at: startTime,
        status: 'active',
      },
      {
        id: `finding-${scanId}-2`,
        rule_id: 'content-security-policy',
        name: 'Content Security Policy Missing',
        severity: 'medium',
        confidence: 'high',
        url: target_url,
        method: 'GET',
        attack: '',
        evidence: 'No Content-Security-Policy header found',
        cweid: 693,
        wascid: 15,
        description: 'Content Security Policy (CSP) is not implemented.',
        solution: 'Implement a strong Content-Security-Policy header',
        reference: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP',
        found_at: startTime,
        status: 'active',
      },
    ];

    // Add more findings for full/ajax scans
    if (scan_type === 'full' || scan_type === 'ajax') {
      initialFindings.push(
        {
          id: `finding-${scanId}-3`,
          rule_id: 'sql-injection',
          name: 'SQL Injection Vulnerability',
          severity: 'critical',
          confidence: 'medium',
          url: `${target_url}/api/search?q=test`,
          method: 'GET',
          attack: "q=' OR '1'='1",
          evidence: 'SQL syntax error detected in response',
          cweid: 89,
          wascid: 19,
          description: 'SQL injection may be possible on the search parameter.',
          solution: 'Use parameterized queries or prepared statements',
          reference: 'https://owasp.org/www-community/attacks/SQL_Injection',
          found_at: new Date(Date.now() + 30000).toISOString(),
          status: 'active',
        },
        {
          id: `finding-${scanId}-4`,
          rule_id: 'xss-reflected',
          name: 'Cross Site Scripting (Reflected)',
          severity: 'high',
          confidence: 'high',
          url: `${target_url}/search`,
          method: 'GET',
          attack: '<script>alert(1)</script>',
          evidence: 'Script tag reflected in response without encoding',
          cweid: 79,
          wascid: 8,
          description: 'Reflected XSS vulnerability detected in search functionality.',
          solution: 'Encode user input before reflecting in responses',
          reference: 'https://owasp.org/www-community/attacks/xss/',
          found_at: new Date(Date.now() + 60000).toISOString(),
          status: 'active',
        }
      );
    }

    // Simulate findings summary
    const findingsBySeverity = {
      critical: initialFindings.filter(f => f.severity === 'critical').length,
      high: initialFindings.filter(f => f.severity === 'high').length,
      medium: initialFindings.filter(f => f.severity === 'medium').length,
      low: initialFindings.filter(f => f.severity === 'low').length,
      info: initialFindings.filter(f => f.severity === 'info').length,
    };

    return {
      scan_id: scanId,
      status: 'running',
      target_url,
      scan_type,
      project_id: project_id || null,
      timing: {
        started_at: startTime,
        estimated_completion: new Date(Date.now() + scanConfig.estimated_duration_minutes * 60 * 1000).toISOString(),
        estimated_duration_minutes: scanConfig.estimated_duration_minutes,
      },
      configuration: {
        spider_enabled: scanConfig.spider_enabled,
        ajax_spider_enabled: scanConfig.ajax_spider,
        max_depth: scan_options?.max_depth || 5,
        max_duration_minutes: scan_options?.max_duration_minutes || scanConfig.estimated_duration_minutes * 2,
        exclude_paths: scan_options?.exclude_paths || [],
        include_paths: scan_options?.include_paths || [],
        auth_type: auth_config?.type || 'none',
      },
      progress: {
        phase: 'spidering',
        urls_crawled: 12,
        urls_to_crawl: 45,
        alerts_found: initialFindings.length,
        percentage: 15,
      },
      findings_summary: {
        total: initialFindings.length,
        by_severity: findingsBySeverity,
        new_since_last_scan: initialFindings.length,
      },
      realtime_findings: initialFindings,
      scan_engine: {
        name: 'OWASP ZAP',
        version: '2.14.0',
        mode: scan_type,
      },
      links: {
        status: `/api/v1/security/dast/scan/${scanId}/status`,
        findings: `/api/v1/security/dast/scan/${scanId}/findings`,
        stop: `/api/v1/security/dast/scan/${scanId}/stop`,
        report: `/api/v1/security/dast/scan/${scanId}/report`,
      },
    };
  });

  // ============================================
  // Feature #931: Get DAST scan status
  // ============================================
  app.get<{ Params: { scanId: string } }>('/api/v1/security/dast/scan/:scanId/status', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { scanId } = request.params;

    // Simulate scan progress
    const progress = Math.min(100, Math.floor(Math.random() * 100));
    const phase = progress < 30 ? 'spidering' : progress < 70 ? 'active_scan' : progress < 95 ? 'finalizing' : 'completed';
    const status = progress === 100 ? 'completed' : 'running';

    return {
      scan_id: scanId,
      status,
      progress: {
        phase,
        percentage: progress,
        urls_crawled: Math.floor(progress * 1.5),
        alerts_found: Math.floor(progress / 10),
        current_url: progress < 100 ? `https://example.com/page${Math.floor(progress / 10)}` : null,
      },
      timing: {
        started_at: new Date(Date.now() - 300000).toISOString(),
        elapsed_seconds: 300,
        estimated_remaining_seconds: progress < 100 ? Math.floor((100 - progress) * 6) : 0,
      },
    };
  });

  // ============================================
  // Feature #932: Get DAST scan findings
  // ============================================
  app.get<{ Params: { scanId: string }; Querystring: { severity?: string; category?: string; include_evidence?: string; include_remediation?: string; limit?: string; offset?: string } }>('/api/v1/security/dast/scan/:scanId/findings', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { scanId } = request.params;
    const { severity, category, include_evidence = 'true', include_remediation = 'true', limit = '50', offset = '0' } = request.query;
    const includeEvidence = include_evidence === 'true';
    const includeRemediation = include_remediation === 'true';

    // Comprehensive DAST findings
    const findings = [
      {
        id: `${scanId}-1`,
        rule_id: 'x-frame-options',
        name: 'X-Frame-Options Header Missing',
        category: 'security-headers',
        severity: 'medium',
        confidence: 'high',
        risk_score: 5.0,
        url: 'https://target.example.com/',
        method: 'GET',
        param: '',
        cweid: 1021,
        wascid: 15,
        status: 'active',
        found_at: new Date(Date.now() - 300000).toISOString(),
        evidence: includeEvidence ? {
          request: { method: 'GET', url: 'https://target.example.com/', headers: { 'User-Agent': 'OWASP ZAP' } },
          response: { status_code: 200, headers: { 'Content-Type': 'text/html' }, body_snippet: '<!DOCTYPE html>...' },
          observation: 'The X-Frame-Options header was not present in the HTTP response',
          proof: 'Missing header in response headers',
          attack_used: null,
        } : undefined,
        remediation: includeRemediation ? {
          summary: 'Add X-Frame-Options header to prevent clickjacking attacks',
          detailed_steps: [
            'Add the X-Frame-Options header to all HTTP responses',
            'Use DENY to prevent all framing, or SAMEORIGIN to allow same-origin framing',
          ],
          code_examples: [
            { language: 'nginx', code: 'add_header X-Frame-Options "DENY" always;' },
            { language: 'express', code: 'app.use(helmet({ frameguard: { action: "deny" } }));' },
          ],
          references: [
            { title: 'OWASP Clickjacking', url: 'https://owasp.org/www-community/attacks/Clickjacking' },
          ],
          effort_estimate: 'low',
          priority: 'medium',
        } : undefined,
      },
      {
        id: `${scanId}-2`,
        rule_id: 'csp-missing',
        name: 'Content Security Policy Missing',
        category: 'security-headers',
        severity: 'medium',
        confidence: 'high',
        risk_score: 5.0,
        url: 'https://target.example.com/',
        method: 'GET',
        param: '',
        cweid: 693,
        wascid: 15,
        status: 'active',
        found_at: new Date(Date.now() - 290000).toISOString(),
        evidence: includeEvidence ? {
          request: { method: 'GET', url: 'https://target.example.com/', headers: { 'User-Agent': 'OWASP ZAP' } },
          response: { status_code: 200, headers: { 'Content-Type': 'text/html' }, body_snippet: '<!DOCTYPE html>...' },
          observation: 'No Content-Security-Policy header found in the response',
          proof: 'CSP header missing from all responses',
          attack_used: null,
        } : undefined,
        remediation: includeRemediation ? {
          summary: 'Implement Content Security Policy to prevent XSS and data injection attacks',
          detailed_steps: [
            'Add a Content-Security-Policy header to all HTTP responses',
            'Start with a strict policy and relax as needed',
          ],
          code_examples: [
            { language: 'nginx', code: "add_header Content-Security-Policy \"default-src 'self'\" always;" },
          ],
          references: [
            { title: 'MDN CSP', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP' },
          ],
          effort_estimate: 'medium',
          priority: 'medium',
        } : undefined,
      },
    ];

    // Apply filters
    let filteredFindings = [...findings];
    if (severity) {
      filteredFindings = filteredFindings.filter(f => f.severity === severity);
    }
    if (category) {
      filteredFindings = filteredFindings.filter(f => f.category === category);
    }

    // Apply pagination
    const offsetNum = parseInt(offset, 10);
    const limitNum = parseInt(limit, 10);
    const paginatedFindings = filteredFindings.slice(offsetNum, offsetNum + limitNum);

    return {
      scan_id: scanId,
      total: filteredFindings.length,
      returned: paginatedFindings.length,
      offset: offsetNum,
      limit: limitNum,
      filters_applied: { severity, category },
      findings: paginatedFindings,
    };
  });

  // ============================================
  // Feature #933: Generate security report
  // ============================================
  app.post<{ Params: { projectId: string }; Body: SecurityReportBody }>('/api/v1/security/report/:projectId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const {
      format = 'pdf',
      include_sections = ['vulnerabilities', 'dependencies', 'secrets', 'dast', 'compliance', 'sbom'],
      time_range = '30d',
      severity_threshold = 'low',
      executive_summary = true,
    } = request.body;
    const orgId = getOrganizationId(request);

    const project = projects.get(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({ error: 'Not Found', message: `Project with ID ${projectId} not found` });
    }

    const reportId = `report-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const generatedAt = new Date().toISOString();

    // Simulated security metrics
    const securityScore = Math.floor(Math.random() * 30 + 60);
    const vulnerabilities = {
      critical: Math.floor(Math.random() * 3),
      high: Math.floor(Math.random() * 8) + 2,
      medium: Math.floor(Math.random() * 15) + 5,
      low: Math.floor(Math.random() * 20) + 10,
      info: Math.floor(Math.random() * 10),
    };
    const totalVulns = Object.values(vulnerabilities).reduce((a, b) => a + b, 0);

    // Build sections (abbreviated for length)
    const sections: Record<string, unknown> = {};
    if (include_sections.includes('vulnerabilities')) {
      sections.vulnerabilities = {
        title: 'Vulnerability Assessment',
        summary: { total: totalVulns, by_severity: vulnerabilities, trend: 'improving' },
      };
    }
    if (include_sections.includes('dependencies')) {
      sections.dependencies = {
        title: 'Dependency Analysis',
        summary: { total_dependencies: 156, vulnerable: 12, outdated: 28 },
      };
    }

    const response: Record<string, unknown> = {
      report_id: reportId,
      project_id: projectId,
      project_name: project.name,
      format,
      status: 'completed',
      generated_at: generatedAt,
      time_range,
      severity_threshold,
    };

    if (executive_summary) {
      response.executive_summary = {
        security_score: securityScore,
        security_grade: securityScore >= 90 ? 'A' : securityScore >= 80 ? 'B' : securityScore >= 70 ? 'C' : securityScore >= 60 ? 'D' : 'F',
        risk_level: vulnerabilities.critical > 0 ? 'critical' : vulnerabilities.high > 2 ? 'high' : 'medium',
        key_findings: [`${totalVulns} total vulnerabilities found`],
      };
    }

    response.sections = sections;
    response.file = {
      format,
      mime_type: format === 'pdf' ? 'application/pdf' : format === 'html' ? 'text/html' : 'application/json',
      download_url: `/api/v1/security/report/${reportId}/download`,
    };

    return response;
  });

  // ============================================
  // Feature #934: Security policy management (PUT)
  // ============================================
  app.put<{ Params: { projectId: string }; Body: SecurityPolicyBody }>('/api/v1/security/policy/:projectId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const body = request.body;
    const orgId = getOrganizationId(request);

    const project = projects.get(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({ error: 'Not Found', message: `Project with ID ${projectId} not found` });
    }

    const existingPolicy = securityPolicies.get(projectId) || {
      severity_threshold: 'high',
      blocked_licenses: ['AGPL-3.0', 'GPL-3.0'],
      approved_licenses: ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'],
      require_license_review: true,
      secret_detection: { enabled: true, block_on_active: true, allowed_paths: ['.env.example'] },
      dast_policy: { enabled: true, max_severity: 'high', scan_frequency: 'on_deploy' },
      sbom_policy: { auto_generate: true, format: 'cyclonedx' },
    };

    const updatedPolicy: Record<string, unknown> = {
      ...existingPolicy,
      ...body,
      updated_at: new Date().toISOString(),
      updated_by: (request as any).user?.email || 'owner@example.com',
    };

    securityPolicies.set(projectId, updatedPolicy);

    return {
      policy_id: `policy-${projectId}`,
      project_id: projectId,
      status: 'saved',
      policy: updatedPolicy,
    };
  });

  // ============================================
  // Feature #934: Security policy management (GET)
  // ============================================
  app.get<{ Params: { projectId: string } }>('/api/v1/security/policy/:projectId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const orgId = getOrganizationId(request);

    const project = projects.get(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({ error: 'Not Found', message: `Project with ID ${projectId} not found` });
    }

    const policy = securityPolicies.get(projectId) || {
      severity_threshold: 'high',
      blocked_licenses: ['AGPL-3.0', 'GPL-3.0'],
      approved_licenses: ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'],
      require_license_review: true,
      secret_detection: { enabled: true, block_on_active: true, allowed_paths: ['.env.example'] },
      dast_policy: { enabled: true, max_severity: 'high', scan_frequency: 'on_deploy' },
      sbom_policy: { auto_generate: true, format: 'cyclonedx' },
    };

    return {
      project_id: projectId,
      project_name: project.name,
      policy,
    };
  });

  // ============================================
  // Feature #935: Container vulnerability scanning
  // ============================================
  app.post<{ Querystring: { image: string; project_id?: string; severity?: string; include_layers?: string; include_base?: string } }>('/api/v1/security/container/scan', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { image, project_id, severity = 'all', include_layers = 'true', include_base = 'true' } = request.query;
    const includeLayers = include_layers === 'true';
    const includeBase = include_base === 'true';

    if (!image) {
      return reply.status(400).send({ error: 'Bad Request', message: 'image parameter is required' });
    }

    const imageRef = image.includes(':') ? image : `${image}:latest`;
    const imageParts = imageRef.split(':');
    const imageName = imageParts[0] ?? image;
    const imageTag = imageParts[1] ?? 'latest';
    const registry = imageName.includes('/') && imageName.includes('.') ? imageName.split('/')[0] ?? 'docker.io' : 'docker.io';

    const scanId = `container-scan-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const scannedAt = new Date().toISOString();

    // Simulated vulnerabilities
    const allVulnerabilities = [
      { id: 'CVE-2024-3456', package: 'openssl', version: '1.1.1k', fixed_version: '1.1.1n', severity: 'critical', cvss_score: 9.8, in_base_image: true },
      { id: 'CVE-2024-7890', package: 'libcurl', version: '7.74.0', fixed_version: '7.79.0', severity: 'high', cvss_score: 7.5, in_base_image: true },
      { id: 'CVE-2024-2345', package: 'nodejs', version: '18.12.0', fixed_version: '18.14.0', severity: 'high', cvss_score: 7.8, in_base_image: false },
      { id: 'CVE-2024-1234', package: 'glibc', version: '2.31', fixed_version: '2.35', severity: 'medium', cvss_score: 5.5, in_base_image: true },
      { id: 'CVE-2024-5678', package: 'zlib', version: '1.2.11', fixed_version: '1.2.12', severity: 'low', cvss_score: 3.5, in_base_image: true },
    ];

    // Filter by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    const vulnerabilities = severity === 'all'
      ? allVulnerabilities
      : allVulnerabilities.filter(v => severityOrder[v.severity as keyof typeof severityOrder] <= severityOrder[severity as keyof typeof severityOrder]);

    const summary = {
      total_vulnerabilities: vulnerabilities.length,
      by_severity: {
        critical: vulnerabilities.filter(v => v.severity === 'critical').length,
        high: vulnerabilities.filter(v => v.severity === 'high').length,
        medium: vulnerabilities.filter(v => v.severity === 'medium').length,
        low: vulnerabilities.filter(v => v.severity === 'low').length,
      },
      fixable: vulnerabilities.filter(v => v.fixed_version).length,
      from_base_image: vulnerabilities.filter(v => v.in_base_image).length,
    };

    const response: Record<string, unknown> = {
      scan_id: scanId,
      image: { reference: imageRef, name: imageName, tag: imageTag, registry },
      scan: { status: 'completed', scanned_at: scannedAt, scanner: 'Trivy', scanner_version: '0.48.0' },
      summary,
      vulnerabilities,
    };

    if (includeLayers) {
      response.layers = [
        { id: 'sha256:a1b2c3d4e5f6', command: 'FROM debian:bullseye-slim', size_mb: 80, vulnerability_count: 3, is_base_layer: true },
        { id: 'sha256:b2c3d4e5f6a7', command: 'RUN apt-get update && apt-get install -y curl openssl', size_mb: 45, vulnerability_count: 2, is_base_layer: false },
      ];
    }

    if (includeBase) {
      response.base_image = {
        reference: 'debian:bullseye-slim',
        vulnerabilities: summary.from_base_image,
        recommendation: summary.from_base_image > 0 ? 'Consider upgrading to debian:bookworm-slim' : 'Base image is relatively secure',
      };
    }

    if (project_id) {
      response.project_id = project_id;
    }

    return response;
  });

  // ============================================
  // Feature #936: Compare security scans
  // ============================================
  app.get<{ Querystring: { baseline: string; current: string; include_details?: string; severity?: string } }>('/api/v1/security/scans/compare', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { baseline, current, include_details = 'true', severity = 'all' } = request.query;
    const includeDetails = include_details === 'true';

    if (!baseline || !current) {
      return reply.status(400).send({ error: 'Bad Request', message: 'baseline and current scan IDs are required' });
    }

    // Simulated baseline and current vulnerabilities
    const baselineVulnerabilities = [
      { id: 'CVE-2024-1234', package: 'lodash', severity: 'high' },
      { id: 'CVE-2024-2345', package: 'axios', severity: 'medium' },
      { id: 'CVE-2024-3456', package: 'express', severity: 'critical' },
    ];

    const currentVulnerabilities = [
      { id: 'CVE-2024-1234', package: 'lodash', severity: 'high' },
      { id: 'CVE-2024-6789', package: 'minimist', severity: 'high' },
    ];

    const baselineIds = new Set(baselineVulnerabilities.map(v => v.id));
    const currentIds = new Set(currentVulnerabilities.map(v => v.id));

    const newVulnerabilities = currentVulnerabilities.filter(v => !baselineIds.has(v.id));
    const fixedVulnerabilities = baselineVulnerabilities.filter(v => !currentIds.has(v.id));
    const unchangedVulnerabilities = currentVulnerabilities.filter(v => baselineIds.has(v.id));

    return {
      comparison_id: `compare-${Date.now()}`,
      baseline_scan: { scan_id: baseline, total_vulnerabilities: baselineVulnerabilities.length },
      current_scan: { scan_id: current, total_vulnerabilities: currentVulnerabilities.length },
      compared_at: new Date().toISOString(),
      summary: {
        new_vulnerabilities: newVulnerabilities.length,
        fixed_vulnerabilities: fixedVulnerabilities.length,
        unchanged_vulnerabilities: unchangedVulnerabilities.length,
        net_change: newVulnerabilities.length - fixedVulnerabilities.length,
        improvement: fixedVulnerabilities.length > newVulnerabilities.length,
      },
      new_vulnerabilities: includeDetails ? newVulnerabilities : undefined,
      fixed_vulnerabilities: includeDetails ? fixedVulnerabilities : undefined,
      unchanged_vulnerabilities: includeDetails ? unchangedVulnerabilities : undefined,
    };
  });

  // ============================================
  // Feature #937: Schedule security scans (POST)
  // ============================================
  app.post<{
    Body: {
      project_id: string;
      scan_type: string;
      frequency: string;
      day_of_week?: number;
      time_of_day?: string;
      target_url?: string;
      image?: string;
      notify_on_failure?: boolean;
      notify_on_vulnerabilities?: boolean;
      severity_threshold?: string;
    }
  }>('/api/v1/security/scan-schedules', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const {
      project_id,
      scan_type,
      frequency,
      day_of_week,
      time_of_day = '02:00',
      target_url,
      image,
      notify_on_failure = true,
      notify_on_vulnerabilities = true,
      severity_threshold = 'medium',
    } = request.body;

    if (!project_id || !scan_type || !frequency) {
      return reply.code(400).send({ error: 'project_id, scan_type, and frequency are required' });
    }

    const validFrequencies = ['hourly', 'daily', 'weekly', 'monthly'];
    if (!validFrequencies.includes(frequency)) {
      return reply.code(400).send({ error: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}` });
    }

    const validScanTypes = ['dependency', 'container', 'dast', 'secret', 'full'];
    if (!validScanTypes.includes(scan_type)) {
      return reply.code(400).send({ error: `Invalid scan_type. Must be one of: ${validScanTypes.join(', ')}` });
    }

    if (frequency === 'weekly' && (day_of_week === undefined || day_of_week < 0 || day_of_week > 6)) {
      return reply.code(400).send({ error: 'day_of_week (0-6) is required for weekly schedules' });
    }

    const scheduleId = `sched-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();
    const nextRun = calculateNextRun(frequency, day_of_week, time_of_day);

    const schedule: SecurityScanSchedule = {
      schedule_id: scheduleId,
      project_id,
      scan_type,
      frequency,
      day_of_week: frequency === 'weekly' ? day_of_week : undefined,
      time_of_day,
      target_url,
      image,
      notify_on_failure,
      notify_on_vulnerabilities,
      severity_threshold,
      status: 'active',
      created_at: now.toISOString(),
      next_run: nextRun,
      last_run: null,
    };

    securityScanSchedules.set(scheduleId, schedule);

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let scheduleDescription = '';
    switch (frequency) {
      case 'hourly': scheduleDescription = 'Every hour'; break;
      case 'daily': scheduleDescription = `Daily at ${time_of_day} UTC`; break;
      case 'weekly': scheduleDescription = `Weekly on ${dayNames[day_of_week!]} at ${time_of_day} UTC`; break;
      case 'monthly': scheduleDescription = `Monthly on the 1st at ${time_of_day} UTC`; break;
    }

    return {
      schedule_id: scheduleId,
      project_id,
      scan_type,
      frequency,
      schedule_description: scheduleDescription,
      status: 'active',
      configuration: {
        day_of_week: frequency === 'weekly' ? day_of_week : undefined,
        time_of_day,
        target_url: scan_type === 'dast' ? target_url : undefined,
        image: scan_type === 'container' ? image : undefined,
      },
      timing: { created_at: now.toISOString(), next_run: nextRun, last_run: null },
    };
  });

  // ============================================
  // Feature #937: List security scan schedules (GET)
  // ============================================
  app.get<{ Querystring: { project_id?: string; scan_type?: string; status?: string } }>('/api/v1/security/scan-schedules', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { project_id, scan_type, status = 'active' } = request.query;

    let schedules = Array.from(securityScanSchedules.values());

    if (project_id) schedules = schedules.filter(s => s.project_id === project_id);
    if (scan_type) schedules = schedules.filter(s => s.scan_type === scan_type);
    if (status) schedules = schedules.filter(s => s.status === status);

    return {
      schedules: schedules.map(s => ({
        schedule_id: s.schedule_id,
        project_id: s.project_id,
        scan_type: s.scan_type,
        frequency: s.frequency,
        status: s.status,
        next_run: s.next_run,
        last_run: s.last_run,
      })),
      total: schedules.length,
    };
  });

  // ============================================
  // Feature #937: Delete security scan schedule
  // ============================================
  app.delete<{ Params: { scheduleId: string } }>('/api/v1/security/scan-schedules/:scheduleId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { scheduleId } = request.params;
    const schedule = securityScanSchedules.get(scheduleId);

    if (!schedule) {
      return reply.code(404).send({ error: 'Schedule not found' });
    }

    securityScanSchedules.delete(scheduleId);

    return {
      deleted: true,
      schedule_id: scheduleId,
      message: 'Security scan schedule deleted successfully',
    };
  });

  // ============================================
  // Feature #938: Get vulnerability fix suggestions
  // ============================================
  app.get<{
    Params: { vulnId: string };
    Querystring: {
      package?: string;
      version?: string;
      ecosystem?: string;
      breaking_changes?: string;
      code_examples?: string;
      max_suggestions?: string;
    }
  }>('/api/v1/security/vulnerabilities/:vulnId/fix-suggestions', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { vulnId } = request.params;
    const {
      package: packageName = 'lodash',
      version: currentVersion = '4.17.15',
      ecosystem = 'npm',
      breaking_changes = 'true',
      code_examples = 'true',
      max_suggestions = '3',
    } = request.query;

    const includeBreakingChanges = breaking_changes === 'true';
    const includeCodeExamples = code_examples === 'true';
    const maxSuggestions = parseInt(max_suggestions, 10);

    // Vulnerability info based on common CVEs
    const vulnInfoMap: Record<string, { title: string; severity: string; cwe: string; description: string }> = {
      'CVE-2021-23337': { title: 'Prototype Pollution in lodash', severity: 'high', cwe: 'CWE-1321', description: 'Lodash versions prior to 4.17.21 are vulnerable to Prototype Pollution.' },
      'CVE-2020-28469': { title: 'ReDoS in glob-parent', severity: 'high', cwe: 'CWE-400', description: 'glob-parent before 5.1.2 is vulnerable to ReDoS.' },
    };

    const vulnInfo = vulnInfoMap[vulnId] || {
      title: 'Prototype Pollution Vulnerability',
      severity: 'high',
      cwe: 'CWE-1321',
      description: `Vulnerability ${vulnId} affects ${packageName}@${currentVersion}`,
    };

    // Safe versions
    const safeVersions: Record<string, string> = {
      'lodash': '4.17.21',
      'glob-parent': '5.1.2',
      'axios': '1.6.0',
      'express': '4.18.2',
    };

    const safeVersion = safeVersions[packageName] || `${currentVersion.split('.')[0]}.${parseInt(currentVersion.split('.')[1] || '0', 10) + 1}.0`;

    const suggestions = [];

    // Suggestion 1: Upgrade
    suggestions.push({
      suggestion_id: `fix-${vulnId}-upgrade`,
      type: 'upgrade',
      priority: 1,
      title: `Upgrade ${packageName} to ${safeVersion}`,
      description: `Update ${packageName} from ${currentVersion} to ${safeVersion}.`,
      safe_version: safeVersion,
      current_version: currentVersion,
      fix_code: includeCodeExamples ? {
        commands: ecosystem === 'npm' ? [`npm install ${packageName}@${safeVersion}`] : [`pip install ${packageName}==${safeVersion}`],
      } : undefined,
      breaking_changes: includeBreakingChanges ? { has_breaking_changes: false, risk_level: 'low' } : undefined,
      effort_estimate: 'low',
      confidence: 0.95,
    });

    // Suggestion 2: Alternative package (if maxSuggestions >= 2)
    if (maxSuggestions >= 2) {
      const alternatives: Record<string, { name: string; description: string }> = {
        'lodash': { name: 'lodash-es', description: 'ES module version with better tree-shaking' },
        'moment': { name: 'dayjs', description: 'Lightweight alternative' },
      };
      const alternative = alternatives[packageName];
      if (alternative) {
        suggestions.push({
          suggestion_id: `fix-${vulnId}-alternative`,
          type: 'replace',
          priority: 2,
          title: `Replace ${packageName} with ${alternative.name}`,
          description: alternative.description,
          alternative_package: alternative.name,
          breaking_changes: includeBreakingChanges ? { has_breaking_changes: true, risk_level: 'medium' } : undefined,
          effort_estimate: 'medium',
          confidence: 0.70,
        });
      }
    }

    // Suggestion 3: Workaround (if maxSuggestions >= 3)
    if (maxSuggestions >= 3) {
      suggestions.push({
        suggestion_id: `fix-${vulnId}-workaround`,
        type: 'workaround',
        priority: 3,
        title: 'Apply temporary mitigation',
        description: 'Sanitize input before passing to vulnerable functions.',
        effort_estimate: 'low',
        confidence: 0.60,
        warning: 'This is a workaround, not a complete fix. Upgrade when possible.',
      });
    }

    return {
      vulnerability_id: vulnId,
      vulnerability_info: vulnInfo,
      package: packageName,
      current_version: currentVersion,
      ecosystem,
      suggestions: suggestions.slice(0, maxSuggestions),
      summary: {
        total_suggestions: Math.min(suggestions.length, maxSuggestions),
        recommended_action: 'upgrade',
        safe_version: safeVersion,
      },
      metadata: {
        generated_at: new Date().toISOString(),
        ai_model: 'security-analyzer-v2',
        confidence_score: 0.92,
      },
    };
  });
}
