/**
 * SAST PR Integration Routes
 *
 * Routes for GitHub/GitLab PR integration including:
 * - PR integration settings (enable/disable PR checks, comments, blocking)
 * - PR scan triggering
 * - PR check status retrieval
 * - PR comments retrieval
 *
 * Extracted from sast.ts (Feature #1376)
 */

import { FastifyInstance } from 'fastify';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { authenticate, JwtPayload } from '../../middleware/auth.js';
import { getProject } from '../../services/repositories/projects.js';
import { logAuditEntry } from '../audit-logs.js';
import {
  SASTConfig,
  SASTFinding,
  SASTScanResult,
  SASTPRCheck,
  SASTPRComment,
} from './types.js';

// Semgrep result type
interface SemgrepResult {
  check_id: string;
  path: string;
  start?: { line?: number; col?: number };
  end?: { line?: number; col?: number };
  extra?: {
    severity?: string;
    message?: string;
    lines?: string;
    fix?: string;
    metadata?: {
      category?: string;
      cwe?: string | string[];
      owasp?: string | string[];
    };
  };
}
import {
  createSastScan,
  createSastPRCheck,
  getSastPRChecks,
  createSastPRComment,
  getSastPRComments,
  getSASTConfig,
  updateSASTConfig,
  generateId,
} from './stores.js';

const execFileAsync = promisify(execFile);

import { createLogger } from '../../services/logger.js';

const logger = createLogger('sast-pr-integration');

/**
 * Run Semgrep scan function type
 * This function is passed in from the main sast.ts module
 */
type RunSemgrepScanFn = (
  projectId: string,
  repoPath: string,
  config: SASTConfig
) => Promise<SASTFinding[]>;

/**
 * Default Semgrep scan function using the real Semgrep CLI.
 * Used when no scan function is explicitly provided.
 */
const defaultSemgrepScan: RunSemgrepScanFn = async (_projectId, repoPath, _config) => {

  function parseOutput(stdout: string): SASTFinding[] {
    const results = JSON.parse(stdout) as { results?: SemgrepResult[] };
    return (results.results || []).map((r: SemgrepResult) => ({
      id: `finding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: r.check_id,
      ruleName: r.check_id.split('.').pop() || r.check_id,
      severity: mapSeverity(r.extra?.severity),
      category: r.extra?.metadata?.category || 'security',
      message: r.extra?.message || r.check_id,
      filePath: r.path,
      line: r.start?.line ?? 0,
      column: r.start?.col ?? 0,
      endLine: r.end?.line ?? 0,
      endColumn: r.end?.col ?? 0,
      snippet: r.extra?.lines || '',
      cweId: Array.isArray(r.extra?.metadata?.cwe) ? r.extra.metadata.cwe[0] : r.extra?.metadata?.cwe,
      owaspCategory: Array.isArray(r.extra?.metadata?.owasp) ? r.extra.metadata.owasp[0] : r.extra?.metadata?.owasp,
      suggestion: r.extra?.fix || undefined,
    }));
  }

  function mapSeverity(s?: string): SASTFinding['severity'] {
    switch (s?.toUpperCase()) {
      case 'ERROR': return 'CRITICAL';
      case 'WARNING': return 'HIGH';
      case 'INFO': return 'MEDIUM';
      default: return 'LOW';
    }
  }

  try {
    const { stdout } = await execFileAsync('semgrep', [
      'scan', '--json', '--quiet', '--config', 'auto', repoPath,
    ], { timeout: 120000, maxBuffer: 50 * 1024 * 1024 });

    return parseOutput(stdout);
  } catch (err: unknown) {
    const execErr = err as { code?: string; stdout?: string; message?: string };
    if (execErr.code === 'ENOENT') {
      throw new Error('Semgrep is not installed. Install with: pip install semgrep');
    }
    // Semgrep exits with code 1 when findings exist -- parse stdout anyway
    if (execErr.stdout) {
      try {
        return parseOutput(execErr.stdout);
      } catch { /* fall through */ }
    }
    throw new Error(`Semgrep scan failed: ${err instanceof Error ? err.message : String(err)}`);
  }
};

/**
 * Register PR integration routes
 *
 * @param app - Fastify instance
 * @param runSemgrepScan - Function to run Semgrep scans (optional, uses mock by default)
 */
export async function prIntegrationRoutes(
  app: FastifyInstance,
  runSemgrepScan: RunSemgrepScanFn = defaultSemgrepScan
): Promise<void> {
  // Get SAST PR integration settings
  app.get<{ Params: { projectId: string } }>('/api/v1/projects/:projectId/sast/pr-integration', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const user = request.user as JwtPayload;

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    const config = await getSASTConfig(projectId);
    return {
      prChecksEnabled: config.prChecksEnabled || false,
      prCommentsEnabled: config.prCommentsEnabled || false,
      blockPrOnCritical: config.blockPrOnCritical || false,
      blockPrOnHigh: config.blockPrOnHigh || false,
    };
  });

  // Update SAST PR integration settings
  app.put<{
    Params: { projectId: string };
    Body: {
      prChecksEnabled?: boolean;
      prCommentsEnabled?: boolean;
      blockPrOnCritical?: boolean;
      blockPrOnHigh?: boolean;
    };
  }>('/api/v1/projects/:projectId/sast/pr-integration', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const user = request.user as JwtPayload;
    const updates = request.body;

    // Check permissions
    if (user.role === 'viewer') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Viewers cannot modify SAST PR integration settings' });
    }

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    const config = await updateSASTConfig(projectId, updates);

    // Log audit entry
    logAuditEntry(
      request,
      'sast_pr_integration_updated',
      'project',
      projectId,
      project.name,
      {
        prChecksEnabled: config.prChecksEnabled,
        prCommentsEnabled: config.prCommentsEnabled,
        blockPrOnCritical: config.blockPrOnCritical,
        blockPrOnHigh: config.blockPrOnHigh,
      }
    );

    return {
      prChecksEnabled: config.prChecksEnabled || false,
      prCommentsEnabled: config.prCommentsEnabled || false,
      blockPrOnCritical: config.blockPrOnCritical || false,
      blockPrOnHigh: config.blockPrOnHigh || false,
      message: 'SAST PR integration settings updated successfully',
    };
  });

  // Trigger SAST scan for a PR
  app.post<{
    Params: { projectId: string };
    Body: {
      prNumber: number;
      prTitle: string;
      headSha: string;
      branch?: string;
    };
  }>('/api/v1/projects/:projectId/sast/pr-scan', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const { prNumber, prTitle, headSha, branch = 'main' } = request.body;
    const user = request.user as JwtPayload;

    // Check permissions
    if (user.role === 'viewer') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Viewers cannot trigger SAST scans' });
    }

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    const config = await getSASTConfig(projectId);
    if (!config.prChecksEnabled) {
      return reply.status(400).send({ error: 'Bad Request', message: 'SAST PR checks are not enabled for this project' });
    }

    // Create a pending PR check
    const checkId = generateId();
    const prCheck: SASTPRCheck = {
      id: checkId,
      projectId,
      prNumber,
      prTitle,
      headSha,
      status: 'pending',
      context: 'QA Guardian / SAST Security Scan',
      description: 'SAST security scan queued',
      targetUrl: `http://localhost:5173/projects/${projectId}?tab=security`,
      blocked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store the PR check via async DB
    await createSastPRCheck(prCheck);

    // Run the scan asynchronously
    (async () => {
      try {
        // Update status to running
        prCheck.status = 'running';
        prCheck.description = 'Running SAST security scan...';
        prCheck.updatedAt = new Date().toISOString();

        // Perform the scan (reuse existing scan logic)
        const findings = await runSemgrepScan(projectId, '/tmp/repo', config);

        // Calculate summary
        const summary = {
          total: findings.length,
          critical: findings.filter(f => f.severity === 'CRITICAL').length,
          high: findings.filter(f => f.severity === 'HIGH').length,
          medium: findings.filter(f => f.severity === 'MEDIUM').length,
          low: findings.filter(f => f.severity === 'LOW').length,
        };

        // Determine if PR should be blocked
        let blocked = false;
        let blockReason = '';
        let conclusion: SASTPRCheck['conclusion'] = 'success';

        if (config.blockPrOnCritical && summary.critical > 0) {
          blocked = true;
          blockReason = `PR blocked: ${summary.critical} critical security finding(s) detected`;
          conclusion = 'blocked';
        } else if (config.blockPrOnHigh && (summary.critical > 0 || summary.high > 0)) {
          blocked = true;
          blockReason = `PR blocked: ${summary.critical} critical and ${summary.high} high severity finding(s) detected`;
          conclusion = 'blocked';
        } else if (summary.total > 0) {
          conclusion = 'failure';
        }

        // Update the PR check with results
        prCheck.status = blocked ? 'failure' : (summary.total > 0 ? 'failure' : 'success');
        prCheck.conclusion = conclusion;
        prCheck.description = blocked
          ? blockReason
          : summary.total > 0
            ? `${summary.total} security finding(s): ${summary.critical} critical, ${summary.high} high, ${summary.medium} medium, ${summary.low} low`
            : 'No security vulnerabilities detected';
        prCheck.findings = summary;
        prCheck.blocked = blocked;
        prCheck.blockReason = blockReason || undefined;
        prCheck.updatedAt = new Date().toISOString();

        // Create a scan record
        const scanId = generateId();
        const scan: SASTScanResult = {
          id: scanId,
          projectId,
          branch,
          commitSha: headSha,
          status: 'completed',
          startedAt: prCheck.createdAt,
          completedAt: new Date().toISOString(),
          findings: findings.filter(f => !f.isFalsePositive),  // Exclude false positives
          summary: {
            total: summary.total,
            bySeverity: {
              critical: summary.critical,
              high: summary.high,
              medium: summary.medium,
              low: summary.low,
            },
            byCategory: findings.reduce((acc, f) => {
              if (!f.isFalsePositive) {
                acc[f.category] = (acc[f.category] || 0) + 1;
              }
              return acc;
            }, {} as Record<string, number>),
          },
        };

        // Store scan via async DB
        await createSastScan(scan);

        prCheck.scanId = scanId;

        // Post PR comment if enabled
        if (config.prCommentsEnabled) {
          const findingsList = findings
            .filter(f => !f.isFalsePositive && (f.severity === 'CRITICAL' || f.severity === 'HIGH'))
            .slice(0, 10)  // Show top 10 critical/high findings
            .map(f => `- **${f.severity}**: ${f.ruleName} in \`${f.filePath}:${f.line}\``)
            .join('\n');

          const commentBody = `## 🔒 SAST Security Scan Results

${blocked ? '⛔ **PR Blocked** - Critical security issues must be resolved before merging\n\n' : ''}${
  summary.total === 0
    ? '✅ **No security vulnerabilities detected**'
    : `⚠️ **${summary.total} security finding(s) detected**

| Severity | Count |
|----------|-------|
| 🔴 Critical | ${summary.critical} |
| 🟠 High | ${summary.high} |
| 🟡 Medium | ${summary.medium} |
| 🔵 Low | ${summary.low} |

${findingsList ? `### Top Findings:\n${findingsList}\n` : ''}`
}

[View full scan results](http://localhost:5173/projects/${projectId}?tab=security)

---
*Scanned by [QA Guardian SAST](http://localhost:5173) on commit ${headSha.substring(0, 7)}*`;

          const prComment: SASTPRComment = {
            id: generateId(),
            projectId,
            prNumber,
            scanId,
            body: commentBody,
            findings: summary,
            blocked,
            createdAt: new Date().toISOString(),
          };

          await createSastPRComment(prComment);

          logger.info({
            projectName: project.name,
            prNumber,
            prTitle,
            findings: summary.total,
            blocked
          }, 'SAST PR comment posted');
        }

        logger.info({
          projectName: project.name,
          prNumber,
          prTitle,
          sha: headSha,
          status: prCheck.status,
          conclusion,
          findings: summary.total,
          blocked
        }, 'SAST PR check completed');

      } catch (error) {
        prCheck.status = 'error';
        prCheck.description = `SAST scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        prCheck.updatedAt = new Date().toISOString();
      }
    })();

    return reply.status(202).send({
      message: 'SAST PR scan started',
      checkId,
      prNumber,
      status: 'pending',
    });
  });

  // Get SAST PR checks for a project
  app.get<{
    Params: { projectId: string };
    Querystring: { prNumber?: string };
  }>('/api/v1/projects/:projectId/sast/pr-checks', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const { prNumber } = request.query;
    const user = request.user as JwtPayload;

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    let checks = await getSastPRChecks(projectId);

    if (prNumber) {
      checks = checks.filter(c => c.prNumber === parseInt(prNumber, 10));
    }

    // Sort by date descending
    checks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { checks };
  });

  // Get a specific SAST PR check
  app.get<{ Params: { projectId: string; checkId: string } }>('/api/v1/projects/:projectId/sast/pr-checks/:checkId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId, checkId } = request.params;
    const user = request.user as JwtPayload;

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    const checks = await getSastPRChecks(projectId);
    const check = checks.find(c => c.id === checkId);

    if (!check) {
      return reply.status(404).send({ error: 'Not Found', message: 'PR check not found' });
    }

    return { check };
  });

  // Get SAST PR comments for a project/PR
  app.get<{
    Params: { projectId: string };
    Querystring: { prNumber?: string };
  }>('/api/v1/projects/:projectId/sast/pr-comments', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const { prNumber } = request.query;
    const user = request.user as JwtPayload;

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    let comments = await getSastPRComments(projectId);

    if (prNumber) {
      comments = comments.filter(c => c.prNumber === parseInt(prNumber, 10));
    }

    // Sort by date descending
    comments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { comments };
  });
}
