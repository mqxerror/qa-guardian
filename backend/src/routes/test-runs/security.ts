/**
 * Test Runs - Security Scanning Routes Module
 * Feature #1356: Extract security routes for file size management
 *
 * Contains:
 * - Security scan management (create, get, list)
 * - Vulnerability management (list, details, dismiss)
 * - Dependency scanning
 * - DAST (Dynamic Application Security Testing)
 * - Secret detection
 * - SBOM generation
 * - Security policies
 * - Container scanning
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId, JwtPayload } from '../../middleware/auth';
import { projects } from '../projects';

// ============================================================================
// Type Definitions
// ============================================================================

export type SecurityScanType = 'sast' | 'dast' | 'dependency' | 'secrets' | 'full';
export type SecurityScanStatus = 'pending' | 'running' | 'completed' | 'failed';
export type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type DismissReason = 'false_positive' | 'accepted_risk' | 'not_applicable' | 'will_not_fix' | 'mitigated';

export interface SecurityFinding {
  severity: VulnerabilitySeverity;
  type: string;
  message: string;
  location?: string;
  line?: number;
}

export interface SecurityScan {
  id: string;
  project_id: string;
  organization_id: string;
  scan_type: SecurityScanType;
  status: SecurityScanStatus;
  target_url?: string;
  branch?: string;
  started_at: Date;
  completed_at?: Date;
  created_by: string;
  findings_count: number;
  findings: SecurityFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

export interface VulnerabilityDismissal {
  vulnerability_id: string;
  reason: DismissReason;
  comment?: string;
  dismissed_by: string;
  dismissed_at: Date;
  expires_at?: Date;
  organization_id: string;
}

// ============================================================================
// In-Memory Stores
// ============================================================================

/**
 * Store for security scans
 * Key: scanId
 */
export const securityScans = new Map<string, SecurityScan>();

/**
 * Store for dismissed vulnerabilities
 * Key: vulnerabilityId (format: scanId-vuln-index)
 */
export const dismissedVulnerabilities = new Map<string, VulnerabilityDismissal>();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate simulated security findings based on scan type
 */
function generateFindings(scanType: SecurityScanType): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  // Simulated findings based on scan type
  if (scanType === 'sast' || scanType === 'full') {
    findings.push(
      { severity: 'high', type: 'SAST', message: 'Potential SQL injection vulnerability', location: 'src/db/query.ts', line: 42 },
      { severity: 'medium', type: 'SAST', message: 'Hardcoded credential detected', location: 'src/config.ts', line: 15 }
    );
  }
  if (scanType === 'dast' || scanType === 'full') {
    findings.push(
      { severity: 'high', type: 'DAST', message: 'Cross-site scripting (XSS) vulnerability detected', location: '/api/search?q=<script>' },
      { severity: 'medium', type: 'DAST', message: 'Missing Content-Security-Policy header', location: '/' }
    );
  }
  if (scanType === 'dependency' || scanType === 'full') {
    findings.push(
      { severity: 'critical', type: 'DEPENDENCY', message: 'Known vulnerability in lodash@4.17.20 (CVE-2021-23337)', location: 'package.json' },
      { severity: 'low', type: 'DEPENDENCY', message: 'Outdated package: axios@0.21.1', location: 'package.json' }
    );
  }
  if (scanType === 'secrets' || scanType === 'full') {
    findings.push(
      { severity: 'critical', type: 'SECRETS', message: 'AWS Access Key detected', location: '.env.example', line: 5 },
      { severity: 'high', type: 'SECRETS', message: 'GitHub token pattern detected', location: 'src/deploy.sh', line: 12 }
    );
  }
  return findings;
}

/**
 * Generate vulnerability description based on finding type
 */
export function generateVulnerabilityDescription(finding: SecurityFinding): string {
  switch (finding.type.toUpperCase()) {
    case 'SAST':
      if (finding.message.includes('SQL injection')) {
        return 'SQL Injection is a code injection technique that exploits security vulnerabilities in an application\'s database layer. An attacker can use malicious SQL statements to control a web application\'s database server, potentially gaining unauthorized access to data.';
      }
      if (finding.message.includes('Hardcoded credential')) {
        return 'Hardcoded credentials are authentication secrets embedded directly in source code. This practice is dangerous because credentials may be exposed in version control, logs, or compiled binaries, allowing unauthorized access.';
      }
      return 'A static application security testing (SAST) issue was detected in the source code that could lead to security vulnerabilities if exploited.';
    case 'DAST':
      if (finding.message.includes('XSS')) {
        return 'Cross-Site Scripting (XSS) vulnerabilities allow attackers to inject malicious scripts into web pages viewed by other users. This can lead to session hijacking, credential theft, or malware distribution.';
      }
      if (finding.message.includes('Content-Security-Policy')) {
        return 'Content-Security-Policy (CSP) is a security header that helps prevent XSS attacks by specifying trusted sources of content. Missing or weak CSP can expose users to script injection attacks.';
      }
      return 'A dynamic application security testing (DAST) issue was detected while testing the running application that could lead to security vulnerabilities.';
    case 'DEPENDENCY':
      if (finding.message.includes('CVE')) {
        return 'A known vulnerability exists in a project dependency. CVE (Common Vulnerabilities and Exposures) entries describe publicly known security flaws that may be exploitable by attackers.';
      }
      return 'An outdated or vulnerable dependency was detected. Keeping dependencies up-to-date is essential for maintaining application security.';
    case 'SECRETS':
      if (finding.message.includes('AWS')) {
        return 'AWS credentials detected in the codebase. Exposed AWS keys can give attackers full access to cloud resources, potentially leading to data breaches, service disruption, or financial loss.';
      }
      if (finding.message.includes('GitHub')) {
        return 'GitHub token detected in the codebase. Exposed tokens can allow unauthorized repository access, enabling attackers to steal code, inject malicious commits, or access private data.';
      }
      return 'A secret or credential was detected in the source code or configuration files. Secrets should be managed using environment variables or secret management solutions.';
    default:
      return 'A security vulnerability was detected that requires attention.';
  }
}

/**
 * Generate remediation steps based on finding type
 */
export function generateRemediationSteps(finding: SecurityFinding): string[] {
  const steps: string[] = [];
  switch (finding.type.toUpperCase()) {
    case 'SAST':
      if (finding.message.includes('SQL injection')) {
        steps.push('Use parameterized queries or prepared statements instead of string concatenation');
        steps.push('Validate and sanitize all user input before using in queries');
        steps.push('Use an ORM (Object-Relational Mapping) library that automatically escapes inputs');
        steps.push('Apply the principle of least privilege for database accounts');
      } else if (finding.message.includes('Hardcoded credential')) {
        steps.push('Remove the hardcoded credential from the source code immediately');
        steps.push('Rotate the exposed credential and generate new ones');
        steps.push('Use environment variables or a secret management service (e.g., AWS Secrets Manager, HashiCorp Vault)');
        steps.push('Add patterns to .gitignore to prevent accidental commits of credentials');
      } else {
        steps.push('Review the flagged code for security issues');
        steps.push('Apply secure coding best practices');
        steps.push('Consider using security linters and static analysis tools in CI/CD');
      }
      break;
    case 'DAST':
      if (finding.message.includes('XSS')) {
        steps.push('Encode all user-supplied output before rendering in HTML');
        steps.push('Use a Content Security Policy (CSP) to restrict script sources');
        steps.push('Validate and sanitize all user input on both client and server side');
        steps.push('Use a modern framework with built-in XSS protection (React, Vue, Angular)');
      } else if (finding.message.includes('Content-Security-Policy')) {
        steps.push("Add a Content-Security-Policy header to your server responses");
        steps.push("Start with a strict policy: \"default-src 'self'; script-src 'self'; style-src 'self'\"");
        steps.push("Use 'nonce' or 'hash' for inline scripts instead of 'unsafe-inline'");
        steps.push("Test your CSP with browser developer tools and refine as needed");
      } else {
        steps.push('Address the identified vulnerability in the running application');
        steps.push('Apply security headers (CSP, X-Frame-Options, X-Content-Type-Options)');
        steps.push('Conduct regular penetration testing');
      }
      break;
    case 'DEPENDENCY':
      if (finding.message.includes('CVE') || finding.message.includes('vulnerability')) {
        steps.push('Update the affected dependency to the latest patched version');
        steps.push('Check the CVE database for detailed impact and exploitation information');
        steps.push('If no patch is available, consider using an alternative library');
        steps.push('Enable automated dependency updates (Dependabot, Renovate)');
      } else {
        steps.push('Update the outdated dependency to the latest stable version');
        steps.push('Review the changelog for breaking changes before updating');
        steps.push('Run your test suite after updating to ensure compatibility');
        steps.push('Consider using a lock file (package-lock.json, yarn.lock) for reproducible builds');
      }
      break;
    case 'SECRETS':
      steps.push('IMMEDIATELY revoke and rotate the exposed secret');
      steps.push('Remove the secret from the codebase and git history (use git filter-branch or BFG)');
      steps.push('Store secrets in environment variables or a secret management system');
      steps.push('Add secret patterns to .gitignore and pre-commit hooks');
      steps.push('Review access logs for any unauthorized usage of the exposed credential');
      break;
    default:
      steps.push('Review the security finding and assess the impact');
      steps.push('Apply appropriate security fixes');
      steps.push('Verify the fix with another security scan');
  }
  return steps;
}

/**
 * Generate CVE/CWE references for a finding
 */
export function generateReferences(finding: SecurityFinding): { type: string; id: string; url: string; title: string }[] {
  const refs: { type: string; id: string; url: string; title: string }[] = [];

  // Extract CVE from message if present
  const cveMatch = finding.message.match(/CVE-\d{4}-\d+/);
  if (cveMatch) {
    refs.push({
      type: 'CVE',
      id: cveMatch[0],
      url: `https://nvd.nist.gov/vuln/detail/${cveMatch[0]}`,
      title: 'NIST National Vulnerability Database Entry',
    });
  }

  // Add CWE references based on vulnerability type
  if (finding.message.includes('SQL injection')) {
    refs.push({
      type: 'CWE',
      id: 'CWE-89',
      url: 'https://cwe.mitre.org/data/definitions/89.html',
      title: 'Improper Neutralization of Special Elements used in an SQL Command',
    });
  }
  if (finding.message.includes('XSS') || finding.message.includes('Cross-site scripting')) {
    refs.push({
      type: 'CWE',
      id: 'CWE-79',
      url: 'https://cwe.mitre.org/data/definitions/79.html',
      title: 'Improper Neutralization of Input During Web Page Generation',
    });
  }
  if (finding.message.includes('credential') || finding.message.includes('token') || finding.message.includes('key')) {
    refs.push({
      type: 'CWE',
      id: 'CWE-798',
      url: 'https://cwe.mitre.org/data/definitions/798.html',
      title: 'Use of Hard-coded Credentials',
    });
  }

  return refs;
}

// ============================================================================
// Route Definitions
// ============================================================================

export async function securityRoutes(app: FastifyInstance) {
  // ============================================
  // Feature #919: Security Scan Management
  // ============================================

  // Create security scan for a project
  app.post<{ Params: { projectId: string }; Body: { scan_type?: string; target_url?: string; branch?: string } }>('/api/v1/security/scans/project/:projectId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const { scan_type, target_url, branch } = request.body || {};
    const orgId = getOrganizationId(request);
    const user = (request as any).user;

    // Validate project exists
    const project = projects.get(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Project with ID ${projectId} not found`,
      });
    }

    // Validate scan type
    const validScanTypes = ['sast', 'dast', 'dependency', 'secrets', 'full'];
    const selectedScanType = (scan_type || 'full') as SecurityScanType;
    if (!validScanTypes.includes(selectedScanType)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Invalid scan_type. Must be one of: ${validScanTypes.join(', ')}`,
      });
    }

    // DAST requires a target URL
    if ((selectedScanType === 'dast' || selectedScanType === 'full') && !target_url && !project.base_url) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'DAST scan requires a target_url or project base_url',
      });
    }

    // Create the scan record
    const scanId = `scan-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    const now = new Date();

    const findings = generateFindings(selectedScanType);
    const summary = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
      info: findings.filter(f => f.severity === 'info').length,
    };

    const scan: SecurityScan = {
      id: scanId,
      project_id: projectId,
      organization_id: orgId,
      scan_type: selectedScanType,
      status: 'running',
      target_url: target_url || project.base_url,
      branch: branch || 'main',
      started_at: now,
      created_by: user?.id || 'unknown',
      findings_count: findings.length,
      findings,
      summary,
    };

    securityScans.set(scanId, scan);

    // Simulate scan completion after a short delay
    setTimeout(() => {
      const completedScan = securityScans.get(scanId);
      if (completedScan && completedScan.status === 'running') {
        completedScan.status = 'completed';
        completedScan.completed_at = new Date();
        securityScans.set(scanId, completedScan);
      }
    }, 2000);

    return {
      success: true,
      scan_id: scanId,
      project_id: projectId,
      project_name: project.name,
      scan_type: selectedScanType,
      status: 'running',
      target_url: scan.target_url,
      branch: scan.branch,
      started_at: now.toISOString(),
      estimated_duration_seconds: selectedScanType === 'full' ? 60 : 30,
      message: `Security scan (${selectedScanType}) started for project ${project.name}`,
    };
  });

  // Get security scan status
  app.get<{ Params: { scanId: string } }>('/api/v1/security/scans/:scanId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { scanId } = request.params;
    const orgId = getOrganizationId(request);

    const scan = securityScans.get(scanId);
    if (!scan || scan.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Security scan with ID ${scanId} not found`,
      });
    }

    return {
      id: scan.id,
      project_id: scan.project_id,
      scan_type: scan.scan_type,
      status: scan.status,
      target_url: scan.target_url,
      branch: scan.branch,
      started_at: scan.started_at.toISOString(),
      completed_at: scan.completed_at?.toISOString(),
      findings_count: scan.findings_count,
      findings: scan.findings,
      summary: scan.summary,
    };
  });

  // ============================================
  // Feature #920: Vulnerability Management
  // ============================================

  // List vulnerabilities across scans
  app.get<{ Querystring: { project_id?: string; severity?: string; scan_type?: string; status?: string; limit?: string } }>('/api/v1/security/vulnerabilities', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { project_id, severity, scan_type, limit } = request.query;
    const orgId = getOrganizationId(request);

    // Collect all findings from scans belonging to this org
    const allFindings: {
      id: string;
      scan_id: string;
      project_id: string;
      severity: string;
      type: string;
      message: string;
      location?: string;
      line?: number;
      found_at: string;
    }[] = [];

    securityScans.forEach(scan => {
      if (scan.organization_id !== orgId) return;
      if (project_id && scan.project_id !== project_id) return;

      scan.findings.forEach((finding, index) => {
        if (severity && finding.severity !== severity) return;
        if (scan_type && finding.type.toLowerCase() !== scan_type.toLowerCase()) return;

        // Generate unique vulnerability ID from scan ID and finding index
        const vulnId = `${scan.id}-vuln-${index}`;
        allFindings.push({
          id: vulnId,
          scan_id: scan.id,
          project_id: scan.project_id,
          severity: finding.severity,
          type: finding.type,
          message: finding.message,
          location: finding.location,
          line: finding.line,
          found_at: scan.started_at.toISOString(),
        });
      });
    });

    // Sort by severity (critical first)
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    allFindings.sort((a, b) => severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder]);

    // Apply limit
    const maxResults = Math.min(parseInt(limit || '100', 10), 500);
    const limitedFindings = allFindings.slice(0, maxResults);

    return {
      vulnerabilities: limitedFindings,
      total: allFindings.length,
      returned: limitedFindings.length,
      filters_applied: {
        project_id,
        severity,
        scan_type,
      },
    };
  });

  // Get vulnerability details
  app.get<{ Params: { vulnerabilityId: string }; Querystring: { scan_id?: string } }>('/api/v1/security/vulnerabilities/:vulnerabilityId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { vulnerabilityId } = request.params;
    const { scan_id: queryScanId } = request.query;
    const orgId = getOrganizationId(request);

    // Parse vulnerability ID format: scan_id-vuln-index
    let scanId: string | undefined;
    let findingIndex: number | undefined;

    // Try to parse the vulnerability ID
    const vulnMatch = vulnerabilityId.match(/^(.+)-vuln-(\d+)$/);
    if (vulnMatch && vulnMatch[1] && vulnMatch[2]) {
      scanId = vulnMatch[1];
      findingIndex = parseInt(vulnMatch[2], 10);
    } else if (queryScanId) {
      scanId = queryScanId;
    }

    // Search for the vulnerability
    let foundScan: SecurityScan | undefined;
    let foundFinding: SecurityFinding | undefined;
    let foundIndex = -1;
    let resolvedVulnId = vulnerabilityId;

    if (scanId && findingIndex !== undefined) {
      // Direct lookup by parsed scan ID and index
      const scan = securityScans.get(scanId);
      if (scan && scan.organization_id === orgId) {
        foundScan = scan;
        foundFinding = scan.findings[findingIndex];
        foundIndex = findingIndex;
      }
    } else {
      // Search all scans for a matching vulnerability ID
      for (const [id, scan] of securityScans.entries()) {
        if (scan.organization_id !== orgId) continue;
        if (queryScanId && id !== queryScanId) continue;

        for (let i = 0; i < scan.findings.length; i++) {
          const checkId = `${id}-vuln-${i}`;
          if (checkId === vulnerabilityId) {
            foundScan = scan;
            foundFinding = scan.findings[i];
            foundIndex = i;
            resolvedVulnId = checkId;
            break;
          }
        }
        if (foundFinding) break;
      }
    }

    if (!foundScan || !foundFinding) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Vulnerability with ID ${vulnerabilityId} not found`,
        hint: 'Vulnerability IDs are in format: scan_id-vuln-index. Use get_vulnerabilities to list available vulnerabilities.',
      });
    }

    // Generate affected files info
    const affectedFiles: { file_path: string; line_number?: number; code_snippet?: string; fix_suggestion?: string }[] = [];
    if (foundFinding.location) {
      const file: typeof affectedFiles[0] = {
        file_path: foundFinding.location,
        line_number: foundFinding.line,
      };

      // Add code snippets and fix suggestions based on type
      if (foundFinding.type.toUpperCase() === 'SAST') {
        if (foundFinding.message.includes('SQL injection')) {
          file.code_snippet = 'const query = `SELECT * FROM users WHERE id = ${userId}`;';
          file.fix_suggestion = 'const query = await db.query("SELECT * FROM users WHERE id = $1", [userId]);';
        } else if (foundFinding.message.includes('Hardcoded credential')) {
          file.code_snippet = 'const API_KEY = "sk_live_abc123xyz789";';
          file.fix_suggestion = 'const API_KEY = process.env.API_KEY;';
        }
      } else if (foundFinding.type.toUpperCase() === 'SECRETS') {
        if (foundFinding.message.includes('AWS')) {
          file.code_snippet = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
          file.fix_suggestion = '# Remove from .env.example, use real .env file that is gitignored';
        } else if (foundFinding.message.includes('GitHub')) {
          file.code_snippet = 'GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx';
          file.fix_suggestion = 'export GITHUB_TOKEN=$GITHUB_TOKEN  # Pass from environment';
        }
      }

      affectedFiles.push(file);
    }

    return {
      vulnerability: {
        id: resolvedVulnId,
        scan_id: foundScan.id,
        project_id: foundScan.project_id,
        finding_index: foundIndex,
        severity: foundFinding.severity,
        type: foundFinding.type,
        message: foundFinding.message,
        description: generateVulnerabilityDescription(foundFinding),
        remediation_steps: generateRemediationSteps(foundFinding),
        affected_files: affectedFiles,
        references: generateReferences(foundFinding),
        scan_info: {
          scan_type: foundScan.scan_type,
          target_url: foundScan.target_url,
          branch: foundScan.branch,
          scanned_at: foundScan.started_at.toISOString(),
          completed_at: foundScan.completed_at?.toISOString(),
        },
        metadata: {
          first_detected: foundScan.started_at.toISOString(),
          status: dismissedVulnerabilities.has(resolvedVulnId) ? 'dismissed' : 'open',
          priority: foundFinding.severity === 'critical' ? 'P1' :
                    foundFinding.severity === 'high' ? 'P2' :
                    foundFinding.severity === 'medium' ? 'P3' : 'P4',
          dismissal: dismissedVulnerabilities.get(resolvedVulnId) ? {
            reason: dismissedVulnerabilities.get(resolvedVulnId)!.reason,
            dismissed_at: dismissedVulnerabilities.get(resolvedVulnId)!.dismissed_at.toISOString(),
          } : undefined,
        },
      },
    };
  });

  // ============================================
  // Feature #923: Vulnerability Dismissal
  // ============================================

  // Dismiss a vulnerability
  app.post<{ Params: { vulnerabilityId: string }; Body: { reason: string; comment?: string; expires_at?: string } }>('/api/v1/security/vulnerabilities/:vulnerabilityId/dismiss', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { vulnerabilityId } = request.params;
    const { reason, comment, expires_at } = request.body || {};
    const orgId = getOrganizationId(request);
    const user = (request as any).user;

    // Validate reason
    const validReasons: DismissReason[] = ['false_positive', 'accepted_risk', 'not_applicable', 'will_not_fix', 'mitigated'];
    if (!reason || !validReasons.includes(reason as DismissReason)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Invalid or missing reason. Must be one of: ${validReasons.join(', ')}`,
      });
    }

    // Parse vulnerability ID to find the vulnerability
    const vulnMatch = vulnerabilityId.match(/^(.+)-vuln-(\d+)$/);
    if (!vulnMatch || !vulnMatch[1] || !vulnMatch[2]) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid vulnerability ID format. Expected format: scan_id-vuln-index',
      });
    }

    const scanId = vulnMatch[1];
    const findingIndex = parseInt(vulnMatch[2], 10);

    // Verify vulnerability exists
    const scan = securityScans.get(scanId);
    if (!scan || scan.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Vulnerability with ID ${vulnerabilityId} not found`,
      });
    }

    const finding = scan.findings[findingIndex];
    if (!finding) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Vulnerability with ID ${vulnerabilityId} not found`,
      });
    }

    // Check if already dismissed
    const existingDismissal = dismissedVulnerabilities.get(vulnerabilityId);
    const wasAlreadyDismissed = !!existingDismissal;

    // Parse expires_at if provided
    let expiresAtDate: Date | undefined;
    if (expires_at) {
      expiresAtDate = new Date(expires_at);
      if (isNaN(expiresAtDate.getTime())) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid expires_at date format. Use ISO format (YYYY-MM-DD)',
        });
      }
    }

    // Create dismissal record
    const dismissal: VulnerabilityDismissal = {
      vulnerability_id: vulnerabilityId,
      reason: reason as DismissReason,
      comment: comment || undefined,
      dismissed_by: user?.id || 'unknown',
      dismissed_at: new Date(),
      expires_at: expiresAtDate,
      organization_id: orgId,
    };

    // Store the dismissal
    dismissedVulnerabilities.set(vulnerabilityId, dismissal);

    return {
      success: true,
      vulnerability_id: vulnerabilityId,
      dismissed: true,
      was_already_dismissed: wasAlreadyDismissed,
      dismissal: {
        reason: dismissal.reason,
        comment: dismissal.comment,
        dismissed_by: dismissal.dismissed_by,
        dismissed_at: dismissal.dismissed_at.toISOString(),
        expires_at: dismissal.expires_at?.toISOString(),
      },
      vulnerability_info: {
        severity: finding.severity,
        type: finding.type,
        message: finding.message,
        location: finding.location,
      },
      message: `Vulnerability ${vulnerabilityId} has been dismissed as ${reason.replace(/_/g, ' ')}`,
    };
  });

  // Get dismissed vulnerabilities list
  app.get<{ Querystring: { project_id?: string; include_expired?: string } }>('/api/v1/security/vulnerabilities/dismissed', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { project_id, include_expired } = request.query;
    const orgId = getOrganizationId(request);
    const includeExpired = include_expired === 'true';
    const now = new Date();

    const dismissals: {
      vulnerability_id: string;
      reason: string;
      comment?: string;
      dismissed_by: string;
      dismissed_at: string;
      expires_at?: string;
      is_expired: boolean;
      vulnerability_info?: {
        severity: string;
        type: string;
        message: string;
        location?: string;
        scan_id: string;
        project_id: string;
      };
    }[] = [];

    dismissedVulnerabilities.forEach((dismissal, vulnId) => {
      if (dismissal.organization_id !== orgId) return;

      // Check expiration
      const isExpired = dismissal.expires_at ? dismissal.expires_at < now : false;
      if (isExpired && !includeExpired) return;

      // Parse vulnerability ID to get scan info
      const vulnMatch = vulnId.match(/^(.+)-vuln-(\d+)$/);
      let vulnerabilityInfo: typeof dismissals[0]['vulnerability_info'];

      if (vulnMatch && vulnMatch[1] && vulnMatch[2]) {
        const scan = securityScans.get(vulnMatch[1]);
        const findingIdx = parseInt(vulnMatch[2], 10);
        const finding = scan?.findings[findingIdx];

        // Filter by project if specified
        if (project_id && scan?.project_id !== project_id) return;

        if (scan && finding) {
          vulnerabilityInfo = {
            severity: finding.severity,
            type: finding.type,
            message: finding.message,
            location: finding.location,
            scan_id: scan.id,
            project_id: scan.project_id,
          };
        }
      }

      dismissals.push({
        vulnerability_id: vulnId,
        reason: dismissal.reason,
        comment: dismissal.comment,
        dismissed_by: dismissal.dismissed_by,
        dismissed_at: dismissal.dismissed_at.toISOString(),
        expires_at: dismissal.expires_at?.toISOString(),
        is_expired: isExpired,
        vulnerability_info: vulnerabilityInfo,
      });
    });

    // Sort by dismissed_at (most recent first)
    dismissals.sort((a, b) => new Date(b.dismissed_at).getTime() - new Date(a.dismissed_at).getTime());

    return {
      dismissals,
      total: dismissals.length,
      filters_applied: {
        project_id,
        include_expired: includeExpired,
      },
    };
  });

  // Undismiss (restore) a vulnerability
  app.delete<{ Params: { vulnerabilityId: string } }>('/api/v1/security/vulnerabilities/:vulnerabilityId/dismiss', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { vulnerabilityId } = request.params;
    const orgId = getOrganizationId(request);

    const dismissal = dismissedVulnerabilities.get(vulnerabilityId);
    if (!dismissal || dismissal.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `No dismissal found for vulnerability ${vulnerabilityId}`,
      });
    }

    // Remove the dismissal
    dismissedVulnerabilities.delete(vulnerabilityId);

    return {
      success: true,
      vulnerability_id: vulnerabilityId,
      dismissed: false,
      message: `Vulnerability ${vulnerabilityId} has been restored (undismissed)`,
      previous_dismissal: {
        reason: dismissal.reason,
        comment: dismissal.comment,
        dismissed_by: dismissal.dismissed_by,
        dismissed_at: dismissal.dismissed_at.toISOString(),
      },
    };
  });

  // ============================================
  // Feature #924: Dependency Vulnerability Audit
  // ============================================

  // Simulated dependency data for projects
  const simulatedDependencies = [
    {
      name: 'lodash',
      version: '4.17.20',
      latest_version: '4.17.21',
      type: 'production' as const,
      vulnerabilities: [
        {
          cve_id: 'CVE-2021-23337',
          severity: 'high' as VulnerabilitySeverity,
          title: 'Command Injection in Lodash',
          description: 'Lodash versions prior to 4.17.21 are vulnerable to Command Injection via the template function.',
          published_date: '2021-02-15',
          patched_version: '4.17.21',
          cwe_ids: ['CWE-77', 'CWE-94'],
          references: ['https://nvd.nist.gov/vuln/detail/CVE-2021-23337'],
        },
      ],
      update_available: true,
      outdated: true,
    },
    {
      name: 'axios',
      version: '0.21.1',
      latest_version: '1.6.2',
      type: 'production' as const,
      vulnerabilities: [
        {
          cve_id: 'CVE-2021-3749',
          severity: 'high' as VulnerabilitySeverity,
          title: 'Regular Expression Denial of Service (ReDoS)',
          description: 'axios is vulnerable to ReDoS via a crafted request to a malicious server.',
          published_date: '2021-08-27',
          patched_version: '0.21.2',
          cwe_ids: ['CWE-1333'],
          references: ['https://nvd.nist.gov/vuln/detail/CVE-2021-3749'],
        },
      ],
      update_available: true,
      outdated: true,
    },
    {
      name: 'express',
      version: '4.18.2',
      latest_version: '4.18.2',
      type: 'production' as const,
      vulnerabilities: [],
      update_available: false,
      outdated: false,
    },
    {
      name: 'jsonwebtoken',
      version: '8.5.1',
      latest_version: '9.0.2',
      type: 'production' as const,
      vulnerabilities: [
        {
          cve_id: 'CVE-2022-23529',
          severity: 'critical' as VulnerabilitySeverity,
          title: 'JsonWebToken Arbitrary Code Execution',
          description: 'jsonwebtoken library is vulnerable to arbitrary code execution due to insecure default options.',
          published_date: '2022-12-21',
          patched_version: '9.0.0',
          cwe_ids: ['CWE-20', 'CWE-94'],
          references: ['https://nvd.nist.gov/vuln/detail/CVE-2022-23529'],
        },
      ],
      update_available: true,
      outdated: true,
    },
    {
      name: 'jest',
      version: '29.7.0',
      latest_version: '29.7.0',
      type: 'development' as const,
      vulnerabilities: [],
      update_available: false,
      outdated: false,
    },
    {
      name: 'typescript',
      version: '5.2.2',
      latest_version: '5.3.3',
      type: 'development' as const,
      vulnerabilities: [],
      update_available: true,
      outdated: true,
    },
  ];

  // Get dependency vulnerability audit report
  app.get<{ Params: { projectId: string }; Querystring: { include_dev?: string } }>('/api/v1/security/dependencies/:projectId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const { include_dev } = request.query;
    const orgId = getOrganizationId(request);
    const includeDevDeps = include_dev !== 'false';

    // Verify project exists
    const project = projects.get(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Project with ID ${projectId} not found`,
      });
    }

    // Filter based on include_dev
    const filteredDeps = includeDevDeps
      ? simulatedDependencies
      : simulatedDependencies.filter(d => d.type === 'production');

    // Calculate summary
    const vulnerableDeps = filteredDeps.filter(d => d.vulnerabilities.length > 0);
    const allVulns = filteredDeps.flatMap(d => d.vulnerabilities);
    const severityCounts = {
      critical: allVulns.filter(v => v.severity === 'critical').length,
      high: allVulns.filter(v => v.severity === 'high').length,
      medium: allVulns.filter(v => v.severity === 'medium').length,
      low: allVulns.filter(v => v.severity === 'low').length,
    };

    // Generate upgrade suggestions
    const upgradeSuggestions = vulnerableDeps.map(dep => ({
      package: dep.name,
      current_version: dep.version,
      recommended_version: dep.latest_version,
      vulnerabilities_fixed: dep.vulnerabilities.length,
      severity_fixed: dep.vulnerabilities.map(v => v.severity),
      upgrade_command: `npm install ${dep.name}@${dep.latest_version}`,
      breaking_changes_likely: dep.name === 'jsonwebtoken' || dep.name === 'axios',
    }));

    return {
      project_id: projectId,
      project_name: project.name,
      scanned_at: new Date().toISOString(),
      summary: {
        total_dependencies: filteredDeps.length,
        production_dependencies: filteredDeps.filter(d => d.type === 'production').length,
        dev_dependencies: filteredDeps.filter(d => d.type === 'development').length,
        vulnerable_dependencies: vulnerableDeps.length,
        total_vulnerabilities: allVulns.length,
        severity_breakdown: severityCounts,
        outdated_dependencies: filteredDeps.filter(d => d.outdated).length,
        updates_available: filteredDeps.filter(d => d.update_available).length,
      },
      dependencies: filteredDeps.map(dep => ({
        name: dep.name,
        version: dep.version,
        latest_version: dep.latest_version,
        type: dep.type,
        vulnerable: dep.vulnerabilities.length > 0,
        vulnerability_count: dep.vulnerabilities.length,
        vulnerabilities: dep.vulnerabilities,
        update_available: dep.update_available,
        outdated: dep.outdated,
      })),
      upgrade_suggestions: upgradeSuggestions,
      recommendations: [
        severityCounts.critical > 0
          ? { priority: 'critical', message: `Fix ${severityCounts.critical} critical vulnerabilities immediately`, action: 'Update jsonwebtoken to v9.0.0 or later' }
          : null,
        severityCounts.high > 0
          ? { priority: 'high', message: `Address ${severityCounts.high} high severity vulnerabilities`, action: 'Update lodash and axios to latest versions' }
          : null,
        { priority: 'info', message: 'Enable automated dependency updates', action: 'Set up Dependabot or Renovate' },
      ].filter(Boolean),
    };
  });

  // ============================================
  // Feature #925: Security Trends and Metrics
  // ============================================

  // Get security trends over time
  app.get<{ Querystring: { project_id?: string; period?: string; metric?: string; from_date?: string; to_date?: string } }>('/api/v1/security/trends', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { project_id, period = '30d', from_date, to_date } = request.query;
    const orgId = getOrganizationId(request);

    // Determine date range
    let startDate: Date;
    let endDate = new Date();

    if (from_date && to_date) {
      startDate = new Date(from_date);
      endDate = new Date(to_date);
    } else {
      const periodDays: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
      startDate = new Date(Date.now() - (periodDays[period] || 30) * 24 * 60 * 60 * 1000);
    }

    // Generate simulated trend data
    const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const interval = period === '7d' ? 1 : period === '30d' ? 1 : period === '90d' ? 7 : 30;
    const dataPoints: {
      date: string;
      vulnerabilities: { total: number; critical: number; high: number; medium: number; low: number };
      scan_coverage: number;
      fix_rate: number;
    }[] = [];

    let totalVulns = 85;

    for (let i = 0; i <= daysInPeriod; i += interval) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dailyNew = Math.floor(Math.random() * 5);
      const dailyFixed = Math.floor(Math.random() * 8);
      totalVulns = Math.max(10, totalVulns + dailyNew - dailyFixed);

      dataPoints.push({
        date: date.toISOString().split('T')[0],
        vulnerabilities: {
          total: totalVulns,
          critical: Math.floor(totalVulns * 0.05),
          high: Math.floor(totalVulns * 0.15),
          medium: Math.floor(totalVulns * 0.35),
          low: Math.floor(totalVulns * 0.45),
        },
        scan_coverage: Math.min(100, 75 + Math.floor(Math.random() * 20)),
        fix_rate: Math.min(100, 60 + Math.floor(Math.random() * 30)),
      });
    }

    return {
      period,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      data_points: dataPoints,
      summary: {
        total_data_points: dataPoints.length,
        average_vulnerabilities: Math.round(dataPoints.reduce((a, b) => a + b.vulnerabilities.total, 0) / dataPoints.length),
        trend: dataPoints.length > 1 && dataPoints[dataPoints.length - 1].vulnerabilities.total < dataPoints[0].vulnerabilities.total ? 'improving' : 'stable',
        average_fix_rate: Math.round(dataPoints.reduce((a, b) => a + b.fix_rate, 0) / dataPoints.length),
      },
      filters_applied: { project_id, period },
    };
  });

  // ============================================
  // Feature #926: Security Score
  // ============================================

  // Get security score for a project
  app.get<{ Params: { projectId: string }; Querystring: { include_history?: string } }>('/api/v1/security/score/:projectId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const { include_history } = request.query;
    const orgId = getOrganizationId(request);

    const project = projects.get(projectId);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Project with ID ${projectId} not found`,
      });
    }

    // Calculate security score (0-100)
    const baseScore = 100;
    let deductions = 0;

    // Deductions based on simulated findings
    deductions += 10; // Critical vulnerabilities
    deductions += 5;  // High vulnerabilities
    deductions += 2;  // Missing security headers
    deductions += 3;  // Outdated dependencies

    const score = Math.max(0, baseScore - deductions);
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

    const result: any = {
      project_id: projectId,
      project_name: project.name,
      score,
      grade,
      calculated_at: new Date().toISOString(),
      breakdown: {
        vulnerability_score: 75,
        dependency_score: 80,
        configuration_score: 90,
        compliance_score: 85,
      },
      factors: [
        { name: 'Critical vulnerabilities', impact: -10, details: '1 critical CVE found' },
        { name: 'High vulnerabilities', impact: -5, details: '2 high severity issues' },
        { name: 'Missing headers', impact: -2, details: 'CSP header not configured' },
        { name: 'Outdated deps', impact: -3, details: '4 outdated packages' },
      ],
      recommendations: [
        { priority: 1, action: 'Fix critical vulnerability in jsonwebtoken' },
        { priority: 2, action: 'Update lodash and axios packages' },
        { priority: 3, action: 'Add Content-Security-Policy header' },
      ],
    };

    if (include_history === 'true') {
      result.history = Array.from({ length: 10 }, (_, i) => ({
        date: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        score: Math.max(60, score - 5 + Math.floor(Math.random() * 10)),
      })).reverse();
    }

    return result;
  });
}
