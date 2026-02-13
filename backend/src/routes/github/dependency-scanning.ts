/**
 * GitHub Dependency Scanning Routes
 *
 * Routes for PR dependency scanning (used by GitHub integration / ProjectDetailPage).
 *
 * Features:
 * - Feature #768: PR dependency scanning routes (still used)
 *
 * Feature #862: Removed dead endpoints after page cuts:
 *   - Feature #769: Vulnerable dependency alerts (CVE Database page removed)
 *   - Feature #770: Dependency policy enforcement (Dependency Policy page removed)
 *
 * Extracted from github.ts (Feature #1375)
 */

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload } from '../../middleware/auth.js';
import { getProject as dbGetProject } from '../projects/stores.js';
import { createLogger } from '../../services/logger.js';
import { sendError } from '../../utils/errors.js';
// Feature #716: Zod validation middleware and schemas
import {
  validateParams,
  depScanProjectIdParamsSchema,
  depProjectPrParamsSchema,
} from '../../validation/index.js';

const logger = createLogger('dependency-scanning');

import {
  githubConnections,
  prStatusChecks,
  prDependencyScans,
  demoPullRequests,
} from './stores.js';
import {
  PRDependencyScanResult,
  PRDependencyVulnerability,
  PRStatusCheck,
  ProjectParams,
} from './types.js';

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
    preValidation: [validateParams(depScanProjectIdParamsSchema)],
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
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    if (project.organization_id !== user.organization_id) {
      return sendError(reply, 403, 'FORBIDDEN', 'You do not have access to this project');
    }

    const connection = githubConnections.get(projectId);
    if (!connection) {
      return sendError(reply, 404, 'NOT_FOUND', 'No GitHub repository connected to this project');
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

    logger.info({
      enabled: pr_dependency_scan_enabled,
      projectName: project.name,
      repository: `${connection.github_owner}/${connection.github_repo}`,
      watchFiles: connection.pr_dependency_scan_files || 'default',
      severityThreshold: connection.pr_dependency_scan_severity || 'HIGH',
      blockOnCritical: connection.pr_dependency_scan_block_on_critical || false
    }, 'PR dependency scanning configuration updated');

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
    preValidation: [validateParams(depScanProjectIdParamsSchema)],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { projectId } = request.params;

    const project = await dbGetProject(projectId);
    if (!project) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    if (project.organization_id !== user.organization_id) {
      return sendError(reply, 403, 'FORBIDDEN', 'You do not have access to this project');
    }

    const connection = githubConnections.get(projectId);
    if (!connection) {
      return sendError(reply, 404, 'NOT_FOUND', 'No GitHub repository connected to this project');
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
    preValidation: [validateParams(depProjectPrParamsSchema)],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { projectId, prNumber } = request.params;
    const { changed_files } = request.body;

    const project = await dbGetProject(projectId);
    if (!project) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    if (project.organization_id !== user.organization_id) {
      return sendError(reply, 403, 'FORBIDDEN', 'You do not have access to this project');
    }

    const connection = githubConnections.get(projectId);
    if (!connection) {
      return sendError(reply, 404, 'NOT_FOUND', 'No GitHub repository connected to this project');
    }

    if (!connection.pr_dependency_scan_enabled) {
      return sendError(reply, 400, 'BAD_REQUEST', 'PR dependency scanning is not enabled for this project');
    }

    const fullName = `${connection.github_owner}/${connection.github_repo}`;
    const pullRequests = demoPullRequests[fullName] || [];
    const pr = pullRequests.find(p => p.number === parseInt(prNumber));

    if (!pr) {
      return sendError(reply, 404, 'NOT_FOUND', `Pull request #${prNumber} not found`);
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

    logger.info({
      repository: fullName,
      prNumber,
      prTitle: pr.title,
      changedFiles: matchingFiles,
      vulnerabilities: scanResult.summary,
      newInPr: scanResult.summary.new_in_pr,
      fixedInPr: scanResult.summary.fixed_in_pr,
      mergeBlocked: shouldBlock
    }, 'PR dependency scan completed');

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
    preValidation: [validateParams(depProjectPrParamsSchema)],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { projectId, prNumber } = request.params;

    const project = await dbGetProject(projectId);
    if (!project) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    if (project.organization_id !== user.organization_id) {
      return sendError(reply, 403, 'FORBIDDEN', 'You do not have access to this project');
    }

    const connection = githubConnections.get(projectId);
    if (!connection) {
      return sendError(reply, 404, 'NOT_FOUND', 'No GitHub repository connected to this project');
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
}
