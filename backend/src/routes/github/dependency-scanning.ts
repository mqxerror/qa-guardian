/**
 * GitHub Dependency Scanning Routes
 *
 * Routes for PR dependency scanning, vulnerable dependency alerts,
 * and dependency policy enforcement.
 *
 * Features:
 * - Feature #768: PR dependency scanning routes
 * - Feature #769: Vulnerable dependency alerts routes
 * - Feature #770: Dependency policy enforcement routes
 *
 * Extracted from github.ts (Feature #1375)
 */

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload } from '../../middleware/auth';
import { getProject as dbGetProject, listProjects as dbListProjects } from '../projects/stores';
// TODO: sendSecurityVulnerabilityWebhook not yet implemented in test-runs module
async function sendSecurityVulnerabilityWebhook(..._args: unknown[]): Promise<void> {
  console.log('[WEBHOOK] sendSecurityVulnerabilityWebhook: stub - not yet implemented');
}
import {
  githubConnections,
  prStatusChecks,
  prDependencyScans,
  demoPullRequests,
} from './stores';
import {
  PRDependencyScanResult,
  PRDependencyVulnerability,
  PRStatusCheck,
  ProjectParams,
} from './types';

// ============================================================
// Feature #769: Vulnerable Dependency Alerts - Interfaces
// ============================================================

interface DependencyAlertConfig {
  enabled: boolean;
  severity_threshold: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  notify_email: boolean;
  notify_slack: boolean;
  slack_webhook?: string;
  notify_in_app: boolean;
  auto_create_issues: boolean;
  issue_assignees?: string[];
}

interface CVEAlert {
  id: string;
  cve_id: string;
  published_at: Date;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  cvss_score: number;
  title: string;
  description: string;
  affected_package: string;
  affected_versions: string;
  fixed_version?: string;
  references: string[];
  affected_projects: Array<{
    project_id: string;
    project_name: string;
    installed_version: string;
    is_direct_dependency: boolean;
  }>;
  status: 'new' | 'acknowledged' | 'dismissed' | 'fixed';
  acknowledged_by?: string;
  acknowledged_at?: Date;
  dismissed_reason?: string;
}

// ============================================================
// Feature #770: Dependency Policy Enforcement - Interfaces
// ============================================================

interface DependencyPolicy {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  enabled: boolean;
  max_allowed_severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  fail_on_critical: boolean;
  fail_on_high: boolean;
  fail_on_medium: boolean;
  fail_on_low: boolean;
  block_builds: boolean;
  block_deployments: boolean;
  block_pr_merge: boolean;
  grace_period_days: number;
  exception_patterns: string[];
  auto_create_fix_pr: boolean;
  notify_on_violation: boolean;
  notify_channels: ('slack' | 'email' | 'in_app')[];
  created_at: Date;
  created_by: string;
  updated_at: Date;
  updated_by: string;
}

interface PolicyViolation {
  id: string;
  organization_id: string;
  policy_id: string;
  policy_name: string;
  project_id: string;
  project_name: string;
  build_id?: string;
  pr_number?: number;
  violation_type: 'build' | 'deployment' | 'pr_merge';
  status: 'blocked' | 'warned' | 'overridden' | 'resolved';
  violations: Array<{
    package_name: string;
    version: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    cve_id: string;
    title: string;
    fixed_version?: string;
  }>;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  message: string;
  overridden_by?: string;
  overridden_at?: Date;
  override_reason?: string;
  created_at: Date;
  resolved_at?: Date;
}

interface BuildRequest {
  project_id: string;
  build_type: 'ci' | 'deployment' | 'pr';
  pr_number?: number;
  branch?: string;
  commit_sha?: string;
  dependencies?: Array<{
    name: string;
    version: string;
    vulnerabilities?: Array<{
      cve_id: string;
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      title: string;
      fixed_version?: string;
    }>;
  }>;
}

// ============================================================
// In-memory stores for Feature #769 and #770
// ============================================================

const dependencyAlertConfigs: Map<string, DependencyAlertConfig> = new Map();
const cveAlerts: Map<string, CVEAlert[]> = new Map();
const notificationsSent: Map<string, Array<{ alert_id: string; channel: string; sent_at: Date }>> = new Map();
const dependencyPolicies: Map<string, DependencyPolicy[]> = new Map();
const policyViolations: Map<string, PolicyViolation[]> = new Map();

// Helper function to check if a severity exceeds the threshold
function exceedsThreshold(severity: string, threshold: string): boolean {
  const severityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'NONE': 0 };
  return (severityOrder[severity as keyof typeof severityOrder] || 0) >=
         (severityOrder[threshold as keyof typeof severityOrder] || 0);
}

export async function dependencyScanningRoutes(app: FastifyInstance): Promise<void> {
  // ============================================================
  // Feature #768: PR Dependency Scanning Routes
  // ============================================================

  // Feature #768: Configure PR dependency scanning
  app.patch<{ Params: ProjectParams; Body: {
    pr_dependency_scan_enabled?: boolean;
    pr_dependency_scan_files?: string[];
    pr_dependency_scan_severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    pr_dependency_scan_block_on_critical?: boolean;
  } }>('/api/v1/projects/:projectId/github/pr-dependency-scan', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { projectId } = request.params;
    const {
      pr_dependency_scan_enabled,
      pr_dependency_scan_files,
      pr_dependency_scan_severity,
      pr_dependency_scan_block_on_critical
    } = request.body;

    const project = await dbGetProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    const connection = githubConnections.get(projectId);
    if (!connection) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No GitHub repository connected to this project',
      });
    }

    if (pr_dependency_scan_enabled !== undefined) {
      connection.pr_dependency_scan_enabled = pr_dependency_scan_enabled;
    }
    if (pr_dependency_scan_files !== undefined) {
      connection.pr_dependency_scan_files = pr_dependency_scan_files;
    }
    if (pr_dependency_scan_severity !== undefined) {
      connection.pr_dependency_scan_severity = pr_dependency_scan_severity;
    }
    if (pr_dependency_scan_block_on_critical !== undefined) {
      connection.pr_dependency_scan_block_on_critical = pr_dependency_scan_block_on_critical;
    }

    githubConnections.set(projectId, connection);

    console.log(`
====================================
  PR Dependency Scanning ${pr_dependency_scan_enabled ? 'Enabled' : 'Disabled'}
====================================
  Project: ${project.name}
  Repository: ${connection.github_owner}/${connection.github_repo}
  Watch Files: ${connection.pr_dependency_scan_files?.join(', ') || 'default'}
  Severity Threshold: ${connection.pr_dependency_scan_severity || 'HIGH'}
  Block on Critical: ${connection.pr_dependency_scan_block_on_critical || false}
====================================
    `);

    return {
      message: `PR dependency scanning ${pr_dependency_scan_enabled ? 'enabled' : 'updated'} successfully`,
      pr_dependency_scan_enabled: connection.pr_dependency_scan_enabled,
      pr_dependency_scan_files: connection.pr_dependency_scan_files,
      pr_dependency_scan_severity: connection.pr_dependency_scan_severity,
      pr_dependency_scan_block_on_critical: connection.pr_dependency_scan_block_on_critical,
    };
  });

  // Feature #768: Get PR dependency scan settings
  app.get<{ Params: ProjectParams }>('/api/v1/projects/:projectId/github/pr-dependency-scan', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { projectId } = request.params;

    const project = await dbGetProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    const connection = githubConnections.get(projectId);
    if (!connection) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No GitHub repository connected to this project',
      });
    }

    return {
      pr_dependency_scan_enabled: connection.pr_dependency_scan_enabled || false,
      pr_dependency_scan_files: connection.pr_dependency_scan_files || ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
      pr_dependency_scan_severity: connection.pr_dependency_scan_severity || 'HIGH',
      pr_dependency_scan_block_on_critical: connection.pr_dependency_scan_block_on_critical || false,
    };
  });

  // Feature #768: Trigger dependency scan for a PR (simulates webhook)
  app.post<{ Params: ProjectParams & { prNumber: string }; Body: { changed_files?: string[] } }>('/api/v1/projects/:projectId/github/pull-requests/:prNumber/dependency-scan', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { projectId, prNumber } = request.params;
    const { changed_files } = request.body;

    const project = await dbGetProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    const connection = githubConnections.get(projectId);
    if (!connection) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No GitHub repository connected to this project',
      });
    }

    if (!connection.pr_dependency_scan_enabled) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'PR dependency scanning is not enabled for this project',
      });
    }

    const fullName = `${connection.github_owner}/${connection.github_repo}`;
    const pullRequests = demoPullRequests[fullName] || [];
    const pr = pullRequests.find(p => p.number === parseInt(prNumber));

    if (!pr) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Pull request #${prNumber} not found`,
      });
    }

    // Check if any watched files are in the changed files
    const watchedFiles = connection.pr_dependency_scan_files || ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
    const detectedFiles = changed_files || ['package.json'];
    const matchingFiles = detectedFiles.filter(f => watchedFiles.some(wf => f.endsWith(wf)));

    if (matchingFiles.length === 0) {
      return reply.status(200).send({
        message: 'No package files changed in this PR, skipping dependency scan',
        skipped: true,
      });
    }

    // Generate simulated vulnerabilities based on PR
    const severityThreshold = connection.pr_dependency_scan_severity || 'HIGH';
    const vulnerabilities: PRDependencyVulnerability[] = [];

    const simulatedVulns: PRDependencyVulnerability[] = [
      {
        id: `vuln-${Date.now()}-1`,
        cve_id: 'CVE-2024-1234',
        package_name: 'lodash',
        installed_version: '4.17.19',
        fixed_version: '4.17.21',
        severity: 'CRITICAL',
        title: 'Prototype Pollution in lodash',
        description: 'lodash prior to 4.17.21 is vulnerable to prototype pollution via the setWith function.',
        is_new: true,
        is_fixed: false,
      },
      {
        id: `vuln-${Date.now()}-2`,
        cve_id: 'CVE-2024-5678',
        package_name: 'axios',
        installed_version: '0.21.1',
        fixed_version: '0.21.2',
        severity: 'HIGH',
        title: 'Server-Side Request Forgery in axios',
        description: 'axios before 0.21.2 allows SSRF when a URL parameter includes a malformed protocol.',
        is_new: true,
        is_fixed: false,
      },
      {
        id: `vuln-${Date.now()}-3`,
        cve_id: 'CVE-2023-9012',
        package_name: 'minimist',
        installed_version: '1.2.5',
        fixed_version: '1.2.6',
        severity: 'MEDIUM',
        title: 'Prototype Pollution in minimist',
        description: 'minimist before 1.2.6 is vulnerable to prototype pollution.',
        is_new: false,
        is_fixed: true,
      },
      {
        id: `vuln-${Date.now()}-4`,
        cve_id: 'CVE-2024-1111',
        package_name: 'express',
        installed_version: '4.17.1',
        fixed_version: '4.18.2',
        severity: 'LOW',
        title: 'Open redirect in express',
        description: 'express before 4.18.2 has an open redirect vulnerability in res.location().',
        is_new: false,
        is_fixed: false,
      },
    ];

    // Filter by severity threshold
    const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const thresholdIndex = severityOrder.indexOf(severityThreshold);
    for (const vuln of simulatedVulns) {
      const vulnIndex = severityOrder.indexOf(vuln.severity);
      if (vulnIndex <= thresholdIndex) {
        vulnerabilities.push(vuln);
      }
    }

    const scanResult: PRDependencyScanResult = {
      id: `dep-scan-${Date.now()}`,
      project_id: projectId,
      pr_number: parseInt(prNumber),
      head_sha: pr.head_sha,
      status: 'completed',
      started_at: new Date(),
      completed_at: new Date(),
      changed_files: matchingFiles,
      vulnerabilities,
      summary: {
        total: vulnerabilities.length,
        critical: vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
        high: vulnerabilities.filter(v => v.severity === 'HIGH').length,
        medium: vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
        low: vulnerabilities.filter(v => v.severity === 'LOW').length,
        new_in_pr: vulnerabilities.filter(v => v.is_new).length,
        fixed_in_pr: vulnerabilities.filter(v => v.is_fixed).length,
      },
    };

    // Store the scan result
    if (!prDependencyScans.has(projectId)) {
      prDependencyScans.set(projectId, []);
    }
    prDependencyScans.get(projectId)!.push(scanResult);

    // Determine if PR should be blocked
    const hasCritical = scanResult.summary.critical > 0;
    const shouldBlock = connection.pr_dependency_scan_block_on_critical && hasCritical;

    // Post status check if PR checks are enabled
    if (connection.pr_checks_enabled) {
      const statusCheck: PRStatusCheck = {
        id: `check-dep-${Date.now()}`,
        project_id: projectId,
        pr_number: parseInt(prNumber),
        pr_title: pr.title,
        head_sha: pr.head_sha,
        status: shouldBlock ? 'failure' : (scanResult.summary.total > 0 ? 'success' : 'success'),
        context: 'QA Guardian / Dependency Scan',
        description: shouldBlock
          ? `${scanResult.summary.critical} critical vulnerability(ies) found - merge blocked`
          : scanResult.summary.total > 0
            ? `${scanResult.summary.total} vulnerability(ies) found (${scanResult.summary.new_in_pr} new, ${scanResult.summary.fixed_in_pr} fixed)`
            : 'No vulnerabilities found',
        target_url: `http://localhost:5173/projects/${projectId}/security/pr-scans/${scanResult.id}`,
        created_at: new Date(),
        updated_at: new Date(),
      };

      if (!prStatusChecks.has(projectId)) {
        prStatusChecks.set(projectId, []);
      }
      prStatusChecks.get(projectId)!.push(statusCheck);
    }

    console.log(`
====================================
  PR Dependency Scan Completed
====================================
  Repository: ${fullName}
  PR #${prNumber}: ${pr.title}
  Changed Files: ${matchingFiles.join(', ')}
  Vulnerabilities Found: ${scanResult.summary.total}
    - Critical: ${scanResult.summary.critical}
    - High: ${scanResult.summary.high}
    - Medium: ${scanResult.summary.medium}
    - Low: ${scanResult.summary.low}
  New in PR: ${scanResult.summary.new_in_pr}
  Fixed in PR: ${scanResult.summary.fixed_in_pr}
  Merge Blocked: ${shouldBlock}
====================================
    `);

    return reply.status(201).send({
      message: 'Dependency scan completed',
      scan_result: scanResult,
      merge_blocked: shouldBlock,
      status_check_posted: connection.pr_checks_enabled,
    });
  });

  // Feature #768: Get dependency scan results for a PR
  app.get<{ Params: ProjectParams & { prNumber: string } }>('/api/v1/projects/:projectId/github/pull-requests/:prNumber/dependency-scan', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { projectId, prNumber } = request.params;

    const project = await dbGetProject(projectId);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    const connection = githubConnections.get(projectId);
    if (!connection) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'No GitHub repository connected to this project',
      });
    }

    const projectScans = prDependencyScans.get(projectId) || [];
    const prScans = projectScans
      .filter(s => s.pr_number === parseInt(prNumber))
      .sort((a, b) => b.started_at.getTime() - a.started_at.getTime());

    return {
      pr_number: parseInt(prNumber),
      scans: prScans,
      total: prScans.length,
      latest: prScans[0] || null,
    };
  });

  // ============================================================
  // Feature #769: Vulnerable Dependency Alerts
  // ============================================================

  // Configure dependency alerts for organization
  app.patch<{ Body: Partial<DependencyAlertConfig> }>('/api/v1/organization/dependency-alerts/config', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;
    const updates = request.body;

    let config = dependencyAlertConfigs.get(orgId) || {
      enabled: false,
      severity_threshold: 'HIGH' as const,
      notify_email: true,
      notify_slack: false,
      notify_in_app: true,
      auto_create_issues: false,
    };

    config = { ...config, ...updates };
    dependencyAlertConfigs.set(orgId, config);

    return {
      success: true,
      message: 'Dependency alert configuration updated',
      config,
    };
  });

  // Get dependency alerts configuration
  app.get('/api/v1/organization/dependency-alerts/config', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;

    const config = dependencyAlertConfigs.get(orgId) || {
      enabled: false,
      severity_threshold: 'HIGH' as const,
      notify_email: true,
      notify_slack: false,
      notify_in_app: true,
      auto_create_issues: false,
    };

    return { config };
  });

  // Get all CVE alerts for organization
  app.get('/api/v1/organization/dependency-alerts', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;

    const alerts = cveAlerts.get(orgId) || [];

    const summary = {
      total: alerts.length,
      new: alerts.filter(a => a.status === 'new').length,
      acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
      dismissed: alerts.filter(a => a.status === 'dismissed').length,
      fixed: alerts.filter(a => a.status === 'fixed').length,
      by_severity: {
        critical: alerts.filter(a => a.severity === 'CRITICAL').length,
        high: alerts.filter(a => a.severity === 'HIGH').length,
        medium: alerts.filter(a => a.severity === 'MEDIUM').length,
        low: alerts.filter(a => a.severity === 'LOW').length,
      },
    };

    return {
      alerts: alerts.sort((a, b) => b.published_at.getTime() - a.published_at.getTime()),
      summary,
    };
  });

  // Simulate a new CVE being published (for testing)
  app.post<{ Body: {
    package_name: string;
    severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    cve_id?: string;
  } }>('/api/v1/organization/dependency-alerts/simulate-cve', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;
    const { package_name, severity = 'HIGH', cve_id } = request.body;

    const config = dependencyAlertConfigs.get(orgId);
    if (!config?.enabled) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Dependency alerts are not enabled. Enable them first.',
      });
    }

    const generatedCveId = cve_id || `CVE-2026-${String(Math.floor(Math.random() * 90000) + 10000)}`;
    const cvssScores = { CRITICAL: 9.8, HIGH: 8.1, MEDIUM: 5.5, LOW: 3.1 };

    const affectedProjects: CVEAlert['affected_projects'] = [];
    const orgProjects = await dbListProjects(orgId);
    for (const project of orgProjects) {
      if (Math.random() > 0.5) {
        affectedProjects.push({
          project_id: project.id,
          project_name: project.name,
          installed_version: `${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 20)}`,
          is_direct_dependency: Math.random() > 0.3,
        });
      }
    }

    const alert: CVEAlert = {
      id: `alert-${Date.now()}`,
      cve_id: generatedCveId,
      published_at: new Date(),
      severity,
      cvss_score: cvssScores[severity],
      title: `${severity} vulnerability in ${package_name}`,
      description: `A ${severity.toLowerCase()} security vulnerability has been discovered in ${package_name}. ` +
        `This vulnerability allows attackers to ${severity === 'CRITICAL' ? 'execute arbitrary code' :
          severity === 'HIGH' ? 'gain unauthorized access' :
          severity === 'MEDIUM' ? 'access sensitive information' : 'cause denial of service'}.`,
      affected_package: package_name,
      affected_versions: `< ${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}.0`,
      fixed_version: `${Math.floor(Math.random() * 5) + 2}.${Math.floor(Math.random() * 10)}.0`,
      references: [
        `https://nvd.nist.gov/vuln/detail/${generatedCveId}`,
        `https://github.com/advisories/${generatedCveId}`,
      ],
      affected_projects: affectedProjects,
      status: 'new',
    };

    const orgAlerts = cveAlerts.get(orgId) || [];
    orgAlerts.push(alert);
    cveAlerts.set(orgId, orgAlerts);

    // Feature #1289: Send security.vulnerability.found webhook
    sendSecurityVulnerabilityWebhook(
      orgId,
      undefined,
      {
        cve_id: alert.cve_id,
        severity: alert.severity,
        cvss_score: alert.cvss_score,
        title: alert.title,
        description: alert.description,
        affected_package: alert.affected_package,
        affected_versions: alert.affected_versions,
        fixed_version: alert.fixed_version,
        references: alert.references,
      },
      affectedProjects
    ).catch(err => console.error('[WEBHOOK] Error sending security vulnerability webhook:', err));

    const notifications: Array<{ channel: string; sent_at: Date }> = [];

    if (config.notify_in_app) {
      notifications.push({ channel: 'in_app', sent_at: new Date() });
    }
    if (config.notify_email) {
      notifications.push({ channel: 'email', sent_at: new Date() });
    }
    if (config.notify_slack && config.slack_webhook) {
      notifications.push({ channel: 'slack', sent_at: new Date() });
    }

    const sentNotifications = notificationsSent.get(orgId) || [];
    notifications.forEach(n => {
      sentNotifications.push({ alert_id: alert.id, ...n });
    });
    notificationsSent.set(orgId, sentNotifications);

    return {
      success: true,
      message: `CVE ${generatedCveId} alert created`,
      alert,
      notifications_sent: notifications.map(n => n.channel),
      affected_projects_count: affectedProjects.length,
    };
  });

  // Update alert status (acknowledge, dismiss, mark as fixed)
  app.patch<{ Params: { alertId: string }; Body: {
    status: 'acknowledged' | 'dismissed' | 'fixed';
    dismissed_reason?: string;
  } }>('/api/v1/organization/dependency-alerts/:alertId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;
    const { alertId } = request.params;
    const { status, dismissed_reason } = request.body;

    const orgAlerts = cveAlerts.get(orgId) || [];
    const alertIndex = orgAlerts.findIndex(a => a.id === alertId);

    if (alertIndex === -1) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Alert not found',
      });
    }

    const alert = orgAlerts[alertIndex];
    alert.status = status;

    if (status === 'acknowledged') {
      alert.acknowledged_by = user.email || user.id;
      alert.acknowledged_at = new Date();
    } else if (status === 'dismissed' && dismissed_reason) {
      alert.dismissed_reason = dismissed_reason;
    }

    orgAlerts[alertIndex] = alert;
    cveAlerts.set(orgId, orgAlerts);

    return {
      success: true,
      message: `Alert ${status}`,
      alert,
    };
  });

  // Get alert details with affected projects
  app.get<{ Params: { alertId: string } }>('/api/v1/organization/dependency-alerts/:alertId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;
    const { alertId } = request.params;

    const orgAlerts = cveAlerts.get(orgId) || [];
    const alert = orgAlerts.find(a => a.id === alertId);

    if (!alert) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Alert not found',
      });
    }

    const sentNotifications = notificationsSent.get(orgId) || [];
    const alertNotifications = sentNotifications.filter(n => n.alert_id === alertId);

    return {
      alert,
      notifications: alertNotifications,
    };
  });

  // ============================================================
  // Feature #770: Dependency Policy Enforcement
  // Block builds with dependencies exceeding severity threshold
  // ============================================================

  // Get all dependency policies for organization
  app.get('/api/v1/organization/dependency-policies', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;

    const policies = dependencyPolicies.get(orgId) || [];

    return {
      policies,
      total: policies.length,
    };
  });

  // Create a new dependency policy
  app.post<{ Body: Omit<DependencyPolicy, 'id' | 'organization_id' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by'> }>(
    '/api/v1/organization/dependency-policies',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const user = request.user as JwtPayload;
      const orgId = user.organization_id;
      const body = request.body;

      const policy: DependencyPolicy = {
        id: `policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        organization_id: orgId,
        name: body.name,
        description: body.description,
        enabled: body.enabled ?? true,
        max_allowed_severity: body.max_allowed_severity || 'HIGH',
        fail_on_critical: body.fail_on_critical ?? true,
        fail_on_high: body.fail_on_high ?? true,
        fail_on_medium: body.fail_on_medium ?? false,
        fail_on_low: body.fail_on_low ?? false,
        block_builds: body.block_builds ?? true,
        block_deployments: body.block_deployments ?? true,
        block_pr_merge: body.block_pr_merge ?? false,
        grace_period_days: body.grace_period_days ?? 0,
        exception_patterns: body.exception_patterns || [],
        auto_create_fix_pr: body.auto_create_fix_pr ?? false,
        notify_on_violation: body.notify_on_violation ?? true,
        notify_channels: body.notify_channels || ['in_app'],
        created_at: new Date(),
        created_by: user.email || user.id,
        updated_at: new Date(),
        updated_by: user.email || user.id,
      };

      const orgPolicies = dependencyPolicies.get(orgId) || [];
      orgPolicies.push(policy);
      dependencyPolicies.set(orgId, orgPolicies);

      console.log(`
====================================
  Dependency Policy Created
====================================
  Organization: ${orgId}
  Policy: ${policy.name}
  Max Severity: ${policy.max_allowed_severity}
  Block Builds: ${policy.block_builds}
====================================
      `);

      return {
        success: true,
        message: 'Dependency policy created',
        policy,
      };
    }
  );

  // Update a dependency policy
  app.patch<{ Params: { policyId: string }; Body: Partial<DependencyPolicy> }>(
    '/api/v1/organization/dependency-policies/:policyId',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const orgId = user.organization_id;
      const { policyId } = request.params;
      const updates = request.body;

      const orgPolicies = dependencyPolicies.get(orgId) || [];
      const policyIndex = orgPolicies.findIndex(p => p.id === policyId);

      if (policyIndex === -1) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Policy not found',
        });
      }

      const policy = orgPolicies[policyIndex];

      if (updates.name !== undefined) policy.name = updates.name;
      if (updates.description !== undefined) policy.description = updates.description;
      if (updates.enabled !== undefined) policy.enabled = updates.enabled;
      if (updates.max_allowed_severity !== undefined) policy.max_allowed_severity = updates.max_allowed_severity;
      if (updates.fail_on_critical !== undefined) policy.fail_on_critical = updates.fail_on_critical;
      if (updates.fail_on_high !== undefined) policy.fail_on_high = updates.fail_on_high;
      if (updates.fail_on_medium !== undefined) policy.fail_on_medium = updates.fail_on_medium;
      if (updates.fail_on_low !== undefined) policy.fail_on_low = updates.fail_on_low;
      if (updates.block_builds !== undefined) policy.block_builds = updates.block_builds;
      if (updates.block_deployments !== undefined) policy.block_deployments = updates.block_deployments;
      if (updates.block_pr_merge !== undefined) policy.block_pr_merge = updates.block_pr_merge;
      if (updates.grace_period_days !== undefined) policy.grace_period_days = updates.grace_period_days;
      if (updates.exception_patterns !== undefined) policy.exception_patterns = updates.exception_patterns;
      if (updates.auto_create_fix_pr !== undefined) policy.auto_create_fix_pr = updates.auto_create_fix_pr;
      if (updates.notify_on_violation !== undefined) policy.notify_on_violation = updates.notify_on_violation;
      if (updates.notify_channels !== undefined) policy.notify_channels = updates.notify_channels;

      policy.updated_at = new Date();
      policy.updated_by = user.email || user.id;

      orgPolicies[policyIndex] = policy;
      dependencyPolicies.set(orgId, orgPolicies);

      return {
        success: true,
        message: 'Policy updated',
        policy,
      };
    }
  );

  // Delete a dependency policy
  app.delete<{ Params: { policyId: string } }>(
    '/api/v1/organization/dependency-policies/:policyId',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const orgId = user.organization_id;
      const { policyId } = request.params;

      const orgPolicies = dependencyPolicies.get(orgId) || [];
      const policyIndex = orgPolicies.findIndex(p => p.id === policyId);

      if (policyIndex === -1) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Policy not found',
        });
      }

      orgPolicies.splice(policyIndex, 1);
      dependencyPolicies.set(orgId, orgPolicies);

      return {
        success: true,
        message: 'Policy deleted',
      };
    }
  );

  // Check build against dependency policies (enforcement endpoint)
  app.post<{ Body: BuildRequest }>(
    '/api/v1/organization/dependency-policies/check-build',
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const user = request.user as JwtPayload;
      const orgId = user.organization_id;
      const { project_id, build_type, pr_number, dependencies } = request.body;

      const orgPolicies = dependencyPolicies.get(orgId) || [];
      const enabledPolicies = orgPolicies.filter(p => p.enabled);

      if (enabledPolicies.length === 0) {
        return {
          allowed: true,
          message: 'No active policies - build allowed',
          violations: [],
        };
      }

      const project = await dbGetProject(project_id);
      const projectName = project?.name || 'Unknown Project';

      // Simulate dependencies with vulnerabilities if not provided
      const depsToCheck = dependencies || [
        {
          name: 'lodash',
          version: '4.17.15',
          vulnerabilities: [
            { cve_id: 'CVE-2021-23337', severity: 'HIGH' as const, title: 'Command Injection in lodash', fixed_version: '4.17.21' },
          ],
        },
        {
          name: 'express',
          version: '4.17.1',
          vulnerabilities: [
            { cve_id: 'CVE-2022-24999', severity: 'MEDIUM' as const, title: 'Prototype Pollution in qs', fixed_version: '4.18.2' },
          ],
        },
        {
          name: 'axios',
          version: '0.21.0',
          vulnerabilities: [
            { cve_id: 'CVE-2021-3749', severity: 'CRITICAL' as const, title: 'Server-Side Request Forgery in Axios', fixed_version: '0.21.2' },
          ],
        },
      ];

      const allViolations: PolicyViolation[] = [];
      let shouldBlock = false;
      const blockReasons: string[] = [];

      for (const policy of enabledPolicies) {
        const policyViolationItems: PolicyViolation['violations'] = [];
        const violationCount = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };

        for (const dep of depsToCheck) {
          const isExcepted = policy.exception_patterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(dep.name);
          });

          if (isExcepted) continue;

          for (const vuln of dep.vulnerabilities || []) {
            const exceedsMax = exceedsThreshold(vuln.severity, policy.max_allowed_severity);
            const shouldFail =
              (vuln.severity === 'CRITICAL' && policy.fail_on_critical) ||
              (vuln.severity === 'HIGH' && policy.fail_on_high) ||
              (vuln.severity === 'MEDIUM' && policy.fail_on_medium) ||
              (vuln.severity === 'LOW' && policy.fail_on_low);

            if (exceedsMax && shouldFail) {
              policyViolationItems.push({
                package_name: dep.name,
                version: dep.version,
                severity: vuln.severity,
                cve_id: vuln.cve_id,
                title: vuln.title,
                fixed_version: vuln.fixed_version,
              });

              violationCount.total++;
              violationCount[vuln.severity.toLowerCase() as keyof typeof violationCount]++;
            }
          }
        }

        if (policyViolationItems.length > 0) {
          const violationType = build_type === 'pr' ? 'pr_merge' : build_type === 'deployment' ? 'deployment' : 'build';
          const isBlocked =
            (violationType === 'build' && policy.block_builds) ||
            (violationType === 'deployment' && policy.block_deployments) ||
            (violationType === 'pr_merge' && policy.block_pr_merge);

          const violation: PolicyViolation = {
            id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            organization_id: orgId,
            policy_id: policy.id,
            policy_name: policy.name,
            project_id,
            project_name: projectName,
            build_id: `build_${Date.now()}`,
            pr_number,
            violation_type: violationType,
            status: isBlocked ? 'blocked' : 'warned',
            violations: policyViolationItems,
            summary: violationCount,
            message: isBlocked
              ? `Build blocked: ${violationCount.total} vulnerability(ies) exceed policy "${policy.name}" threshold`
              : `Policy warning: ${violationCount.total} vulnerability(ies) detected but not blocking`,
            created_at: new Date(),
          };

          allViolations.push(violation);

          const orgViolations = policyViolations.get(orgId) || [];
          orgViolations.push(violation);
          policyViolations.set(orgId, orgViolations);

          if (isBlocked) {
            shouldBlock = true;
            blockReasons.push(`Policy "${policy.name}": ${violationCount.total} violations (${violationCount.critical} critical, ${violationCount.high} high)`);
          }
        }
      }

      console.log(`
====================================
  Dependency Policy Check
====================================
  Project: ${projectName}
  Build Type: ${build_type}
  Dependencies Checked: ${depsToCheck.length}
  Policies Evaluated: ${enabledPolicies.length}
  Violations Found: ${allViolations.length}
  Build Blocked: ${shouldBlock}
====================================
      `);

      return {
        allowed: !shouldBlock,
        message: shouldBlock
          ? `Build blocked due to policy violations: ${blockReasons.join('; ')}`
          : allViolations.length > 0
            ? 'Build allowed with warnings'
            : 'Build allowed - no policy violations',
        violations: allViolations,
        summary: {
          policies_checked: enabledPolicies.length,
          violations_count: allViolations.length,
          blocked: shouldBlock,
        },
      };
    }
  );

  // Get policy violations history
  app.get('/api/v1/organization/dependency-policies/violations', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;
    const query = request.query as { status?: string; policy_id?: string; project_id?: string; limit?: string };

    let violations = policyViolations.get(orgId) || [];

    if (query.status) {
      violations = violations.filter(v => v.status === query.status);
    }
    if (query.policy_id) {
      violations = violations.filter(v => v.policy_id === query.policy_id);
    }
    if (query.project_id) {
      violations = violations.filter(v => v.project_id === query.project_id);
    }

    violations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const limit = parseInt(query.limit || '50', 10);
    violations = violations.slice(0, limit);

    const summary = {
      total: violations.length,
      blocked: violations.filter(v => v.status === 'blocked').length,
      warned: violations.filter(v => v.status === 'warned').length,
      overridden: violations.filter(v => v.status === 'overridden').length,
      resolved: violations.filter(v => v.status === 'resolved').length,
    };

    return {
      violations,
      summary,
    };
  });

  // Override a policy violation (allow blocked build to proceed)
  app.post<{ Params: { violationId: string }; Body: { reason: string } }>(
    '/api/v1/organization/dependency-policies/violations/:violationId/override',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const orgId = user.organization_id;
      const { violationId } = request.params;
      const { reason } = request.body;

      const orgViolations = policyViolations.get(orgId) || [];
      const violationIndex = orgViolations.findIndex(v => v.id === violationId);

      if (violationIndex === -1) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Violation not found',
        });
      }

      const violation = orgViolations[violationIndex];

      if (violation.status !== 'blocked') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Only blocked violations can be overridden',
        });
      }

      violation.status = 'overridden';
      violation.overridden_by = user.email || user.id;
      violation.overridden_at = new Date();
      violation.override_reason = reason;

      orgViolations[violationIndex] = violation;
      policyViolations.set(orgId, orgViolations);

      console.log(`
====================================
  Policy Violation Override
====================================
  Violation: ${violationId}
  Overridden By: ${violation.overridden_by}
  Reason: ${reason}
====================================
      `);

      return {
        success: true,
        message: 'Violation overridden - build can proceed',
        violation,
      };
    }
  );

  // Resolve a violation (mark as fixed)
  app.post<{ Params: { violationId: string } }>(
    '/api/v1/organization/dependency-policies/violations/:violationId/resolve',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const orgId = user.organization_id;
      const { violationId } = request.params;

      const orgViolations = policyViolations.get(orgId) || [];
      const violationIndex = orgViolations.findIndex(v => v.id === violationId);

      if (violationIndex === -1) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Violation not found',
        });
      }

      const violation = orgViolations[violationIndex];
      violation.status = 'resolved';
      violation.resolved_at = new Date();

      orgViolations[violationIndex] = violation;
      policyViolations.set(orgId, orgViolations);

      return {
        success: true,
        message: 'Violation resolved',
        violation,
      };
    }
  );

  // Get policy statistics
  app.get('/api/v1/organization/dependency-policies/stats', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;

    const policies = dependencyPolicies.get(orgId) || [];
    const violations = policyViolations.get(orgId) || [];

    const policyStats = policies.map(policy => {
      const policyViolationsList = violations.filter(v => v.policy_id === policy.id);
      return {
        policy_id: policy.id,
        policy_name: policy.name,
        enabled: policy.enabled,
        total_violations: policyViolationsList.length,
        blocked_count: policyViolationsList.filter(v => v.status === 'blocked').length,
        overridden_count: policyViolationsList.filter(v => v.status === 'overridden').length,
        resolved_count: policyViolationsList.filter(v => v.status === 'resolved').length,
      };
    });

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentViolations = violations.filter(v => new Date(v.created_at) >= sevenDaysAgo);

    return {
      summary: {
        total_policies: policies.length,
        enabled_policies: policies.filter(p => p.enabled).length,
        total_violations: violations.length,
        blocked_builds: violations.filter(v => v.status === 'blocked').length,
        recent_violations: recentViolations.length,
      },
      policy_stats: policyStats,
    };
  });
}
