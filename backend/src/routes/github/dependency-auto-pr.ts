/**
 * Dependency Auto-PR Routes
 *
 * Routes for automated pull request creation for dependency updates.
 *
 * Feature #771: Auto-PR for Dependency Updates
 */

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload } from '../../middleware/auth.js';
import { getProject as dbGetProject } from '../projects/stores.js';
import { createLogger } from '../../services/logger.js';

import { sendError } from '../../utils/errors.js';
const logger = createLogger('dependency-auto-pr');

// ============================================================
// Feature #771: Auto-PR for Dependency Updates Types
// ============================================================

interface AutoPRConfig {
  enabled: boolean;
  auto_merge_patch: boolean;
  auto_merge_minor: boolean;
  require_tests_pass: boolean;
  include_changelog: boolean;
  assignees: string[];
  labels: string[];
  branch_prefix: string;
  commit_message_template: string;
  pr_title_template: string;
  pr_body_template: string;
  schedule: 'immediate' | 'daily' | 'weekly';
  max_prs_per_day: number;
}

interface AutoPR {
  id: string;
  organization_id: string;
  project_id: string;
  project_name: string;
  dependency_name: string;
  current_version: string;
  target_version: string;
  update_type: 'patch' | 'minor' | 'major';
  vulnerability?: {
    cve_id: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
  };
  pr_number?: number;
  pr_url?: string;
  pr_title: string;
  pr_body: string;
  branch_name: string;
  status: 'pending' | 'created' | 'merged' | 'closed' | 'failed';
  changelog?: string;
  tests_status?: 'pending' | 'running' | 'passed' | 'failed';
  created_at: Date;
  updated_at: Date;
  merged_at?: Date;
  error_message?: string;
}

// ============================================================
// In-memory stores
// ============================================================

// Feature #771: Auto-PR stores
const autoPRConfigs: Map<string, AutoPRConfig> = new Map(); // orgId -> config
const autoPRs: Map<string, AutoPR[]> = new Map(); // orgId -> auto PRs

// ============================================================
// Routes
// ============================================================

export async function dependencyAutoPRRoutes(app: FastifyInstance): Promise<void> {
  // ============================================================
  // Feature #771: Auto-PR for Dependency Updates Routes
  // ============================================================

  // Default Auto-PR config
  const defaultAutoPRConfig: AutoPRConfig = {
    enabled: false,
    auto_merge_patch: false,
    auto_merge_minor: false,
    require_tests_pass: true,
    include_changelog: true,
    assignees: [],
    labels: ['dependencies', 'security'],
    branch_prefix: 'deps/',
    commit_message_template: 'chore(deps): update {{package}} to {{version}}',
    pr_title_template: 'chore(deps): update {{package}} from {{from}} to {{to}}',
    pr_body_template: '## Dependency Update\n\nUpdates **{{package}}** from `{{from}}` to `{{to}}`.\n\n{{changelog}}\n\n{{vulnerability}}',
    schedule: 'immediate',
    max_prs_per_day: 10,
  };

  // Get auto-PR configuration
  app.get('/api/v1/organization/auto-pr/config', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;

    const config = autoPRConfigs.get(orgId) || { ...defaultAutoPRConfig };
    return { config };
  });

  // Update auto-PR configuration
  app.patch<{ Body: Partial<AutoPRConfig> }>('/api/v1/organization/auto-pr/config', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;
    const updates = request.body;

    const existingConfig = autoPRConfigs.get(orgId) || { ...defaultAutoPRConfig };
    const config = { ...existingConfig, ...updates };
    autoPRConfigs.set(orgId, config);

    logger.info({ orgId, enabled: config.enabled, autoMergePatch: config.auto_merge_patch, autoMergeMinor: config.auto_merge_minor }, 'Auto-PR config updated');

    return {
      success: true,
      message: 'Auto-PR configuration updated',
      config,
    };
  });

  // List all auto-PRs
  app.get('/api/v1/organization/auto-pr', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;
    const query = request.query as { status?: string; project_id?: string };

    let prs = autoPRs.get(orgId) || [];

    if (query.status) {
      prs = prs.filter(pr => pr.status === query.status);
    }
    if (query.project_id) {
      prs = prs.filter(pr => pr.project_id === query.project_id);
    }

    // Sort by created_at descending
    prs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const summary = {
      total: prs.length,
      pending: prs.filter(pr => pr.status === 'pending').length,
      created: prs.filter(pr => pr.status === 'created').length,
      merged: prs.filter(pr => pr.status === 'merged').length,
      closed: prs.filter(pr => pr.status === 'closed').length,
      failed: prs.filter(pr => pr.status === 'failed').length,
    };

    return { prs, summary };
  });

  // Trigger auto-PR for a specific vulnerability
  app.post<{ Body: {
    project_id: string;
    dependency_name: string;
    current_version: string;
    target_version: string;
    vulnerability?: {
      cve_id: string;
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      title: string;
    };
  } }>('/api/v1/organization/auto-pr/create', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;
    const { project_id, dependency_name, current_version, target_version, vulnerability } = request.body;

    const config = autoPRConfigs.get(orgId);
    if (!config?.enabled) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Auto-PR is not enabled. Enable it in settings first.');
    }

    // Get project name
    const project = await dbGetProject(project_id);
    const projectName = project?.name || 'Unknown Project';

    // Determine update type
    const [curMajor, curMinor] = current_version.split('.').map(Number);
    const [tgtMajor, tgtMinor] = target_version.split('.').map(Number);
    let updateType: 'patch' | 'minor' | 'major' = 'patch';
    if (tgtMajor > curMajor) updateType = 'major';
    else if (tgtMinor > curMinor) updateType = 'minor';

    // Generate branch name
    const branchName = `${config.branch_prefix}${dependency_name}-${target_version}`.replace(/[^a-zA-Z0-9-_/]/g, '-');

    // Generate PR title
    const prTitle = config.pr_title_template
      .replace(/\{\{package\}\}/g, dependency_name)
      .replace(/\{\{from\}\}/g, current_version)
      .replace(/\{\{to\}\}/g, target_version);

    // Generate changelog (simulated)
    const changelog = `### Changelog for ${dependency_name}

#### ${target_version}
- Security fix for ${vulnerability?.cve_id || 'various vulnerabilities'}
- Performance improvements
- Bug fixes

#### Previous versions
- ${current_version}: Initial version in use`;

    // Generate vulnerability section
    const vulnSection = vulnerability
      ? `### Security Fix\n\n**${vulnerability.cve_id}** (${vulnerability.severity})\n\n${vulnerability.title}`
      : '';

    // Generate PR body
    const prBody = config.pr_body_template
      .replace(/\{\{package\}\}/g, dependency_name)
      .replace(/\{\{from\}\}/g, current_version)
      .replace(/\{\{to\}\}/g, target_version)
      .replace(/\{\{changelog\}\}/g, config.include_changelog ? changelog : '')
      .replace(/\{\{vulnerability\}\}/g, vulnSection);

    // Simulate PR creation
    const prNumber = Math.floor(Math.random() * 900) + 100;
    const autoPR: AutoPR = {
      id: `auto-pr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      organization_id: orgId,
      project_id,
      project_name: projectName,
      dependency_name,
      current_version,
      target_version,
      update_type: updateType,
      vulnerability,
      pr_number: prNumber,
      pr_url: `https://github.com/${projectName}/pull/${prNumber}`,
      pr_title: prTitle,
      pr_body: prBody,
      branch_name: branchName,
      status: 'created',
      changelog: config.include_changelog ? changelog : undefined,
      tests_status: config.require_tests_pass ? 'pending' : undefined,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const orgPRs = autoPRs.get(orgId) || [];
    orgPRs.push(autoPR);
    autoPRs.set(orgId, orgPRs);

    logger.info({ projectName, dependencyName: dependency_name, currentVersion: current_version, targetVersion: target_version, prNumber, branchName }, `Auto-PR #${prNumber} created for ${dependency_name}`);

    return {
      success: true,
      message: `PR #${prNumber} created for ${dependency_name} update`,
      pr: autoPR,
    };
  });

  // Simulate detecting vulnerable dependencies and creating PRs
  app.post<{ Body: { project_id: string } }>('/api/v1/organization/auto-pr/scan-and-create', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;
    const { project_id } = request.body;

    const config = autoPRConfigs.get(orgId);
    if (!config?.enabled) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Auto-PR is not enabled. Enable it in settings first.');
    }

    // Get project name
    const project = await dbGetProject(project_id);
    const projectName = project?.name || 'demo-project';

    // Simulated vulnerable dependencies with available fixes
    const vulnerableDeps = [
      {
        name: 'lodash',
        current: '4.17.15',
        fixed: '4.17.21',
        vulnerability: {
          cve_id: 'CVE-2021-23337',
          severity: 'HIGH' as const,
          title: 'Command Injection vulnerability in lodash',
        },
      },
      {
        name: 'axios',
        current: '0.21.0',
        fixed: '0.21.4',
        vulnerability: {
          cve_id: 'CVE-2021-3749',
          severity: 'CRITICAL' as const,
          title: 'Server-Side Request Forgery in Axios',
        },
      },
      {
        name: 'minimist',
        current: '1.2.5',
        fixed: '1.2.8',
        vulnerability: {
          cve_id: 'CVE-2021-44906',
          severity: 'MEDIUM' as const,
          title: 'Prototype Pollution in minimist',
        },
      },
    ];

    const createdPRs: AutoPR[] = [];
    const orgPRs = autoPRs.get(orgId) || [];

    for (const dep of vulnerableDeps) {
      // Check if PR already exists for this dependency
      const existingPR = orgPRs.find(
        pr => pr.project_id === project_id &&
              pr.dependency_name === dep.name &&
              pr.target_version === dep.fixed &&
              (pr.status === 'pending' || pr.status === 'created')
      );

      if (existingPR) {
        continue; // Skip if PR already exists
      }

      // Determine update type
      const [curMajor, curMinor] = dep.current.split('.').map(Number);
      const [tgtMajor, tgtMinor] = dep.fixed.split('.').map(Number);
      let updateType: 'patch' | 'minor' | 'major' = 'patch';
      if (tgtMajor > curMajor) updateType = 'major';
      else if (tgtMinor > curMinor) updateType = 'minor';

      const branchName = `${config.branch_prefix}${dep.name}-${dep.fixed}`.replace(/[^a-zA-Z0-9-_/]/g, '-');
      const prNumber = Math.floor(Math.random() * 900) + 100;

      const prTitle = config.pr_title_template
        .replace(/\{\{package\}\}/g, dep.name)
        .replace(/\{\{from\}\}/g, dep.current)
        .replace(/\{\{to\}\}/g, dep.fixed);

      const changelog = `### Changelog for ${dep.name}

#### ${dep.fixed}
- Security fix for ${dep.vulnerability.cve_id}
- Performance improvements
- Bug fixes`;

      const vulnSection = `### Security Fix\n\n**${dep.vulnerability.cve_id}** (${dep.vulnerability.severity})\n\n${dep.vulnerability.title}`;

      const prBody = config.pr_body_template
        .replace(/\{\{package\}\}/g, dep.name)
        .replace(/\{\{from\}\}/g, dep.current)
        .replace(/\{\{to\}\}/g, dep.fixed)
        .replace(/\{\{changelog\}\}/g, config.include_changelog ? changelog : '')
        .replace(/\{\{vulnerability\}\}/g, vulnSection);

      const autoPR: AutoPR = {
        id: `auto-pr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        organization_id: orgId,
        project_id,
        project_name: projectName,
        dependency_name: dep.name,
        current_version: dep.current,
        target_version: dep.fixed,
        update_type: updateType,
        vulnerability: dep.vulnerability,
        pr_number: prNumber,
        pr_url: `https://github.com/${projectName}/pull/${prNumber}`,
        pr_title: prTitle,
        pr_body: prBody,
        branch_name: branchName,
        status: 'created',
        changelog: config.include_changelog ? changelog : undefined,
        tests_status: config.require_tests_pass ? 'running' : undefined,
        created_at: new Date(),
        updated_at: new Date(),
      };

      orgPRs.push(autoPR);
      createdPRs.push(autoPR);
    }

    autoPRs.set(orgId, orgPRs);

    logger.info({ projectName, vulnerableCount: vulnerableDeps.length, prsCreated: createdPRs.length }, `Auto-PR scan complete: created ${createdPRs.length} PRs`);

    return {
      success: true,
      message: `Created ${createdPRs.length} auto-PR(s) for vulnerable dependencies`,
      prs_created: createdPRs,
      total_scanned: vulnerableDeps.length,
    };
  });

  // Update auto-PR status (simulate merge, close, tests)
  app.patch<{ Params: { prId: string }; Body: {
    status?: 'merged' | 'closed';
    tests_status?: 'passed' | 'failed';
  } }>('/api/v1/organization/auto-pr/:prId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;
    const { prId } = request.params;
    const { status, tests_status } = request.body;

    const orgPRs = autoPRs.get(orgId) || [];
    const prIndex = orgPRs.findIndex(pr => pr.id === prId);

    if (prIndex === -1) {
      return sendError(reply, 404, 'NOT_FOUND', 'Auto-PR not found');
    }

    const pr = orgPRs[prIndex];

    if (status) {
      pr.status = status;
      if (status === 'merged') {
        pr.merged_at = new Date();
      }
    }
    if (tests_status) {
      pr.tests_status = tests_status;
    }
    pr.updated_at = new Date();

    orgPRs[prIndex] = pr;
    autoPRs.set(orgId, orgPRs);

    return {
      success: true,
      message: `Auto-PR updated`,
      pr,
    };
  });

  // Get auto-PR statistics
  app.get('/api/v1/organization/auto-pr/stats', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = request.user as JwtPayload;
    const orgId = user.organization_id;

    const prs = autoPRs.get(orgId) || [];
    const config = autoPRConfigs.get(orgId);

    // Calculate stats
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentPRs = prs.filter(pr => new Date(pr.created_at) >= sevenDaysAgo);

    // Group by update type
    const byUpdateType = {
      patch: prs.filter(pr => pr.update_type === 'patch').length,
      minor: prs.filter(pr => pr.update_type === 'minor').length,
      major: prs.filter(pr => pr.update_type === 'major').length,
    };

    // Group by severity (for security updates)
    const bySeverity = {
      critical: prs.filter(pr => pr.vulnerability?.severity === 'CRITICAL').length,
      high: prs.filter(pr => pr.vulnerability?.severity === 'HIGH').length,
      medium: prs.filter(pr => pr.vulnerability?.severity === 'MEDIUM').length,
      low: prs.filter(pr => pr.vulnerability?.severity === 'LOW').length,
    };

    return {
      enabled: config?.enabled || false,
      summary: {
        total_prs: prs.length,
        merged: prs.filter(pr => pr.status === 'merged').length,
        pending: prs.filter(pr => pr.status === 'pending' || pr.status === 'created').length,
        failed: prs.filter(pr => pr.status === 'failed').length,
        recent_week: recentPRs.length,
      },
      by_update_type: byUpdateType,
      by_severity: bySeverity,
      tests: {
        total: prs.filter(pr => pr.tests_status).length,
        passed: prs.filter(pr => pr.tests_status === 'passed').length,
        failed: prs.filter(pr => pr.tests_status === 'failed').length,
        running: prs.filter(pr => pr.tests_status === 'running').length,
      },
    };
  });
}
