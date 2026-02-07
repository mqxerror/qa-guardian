/**
 * GitHub Webhooks Handler
 * Feature #272: Auto-trigger dependency scan on GitHub PR
 *
 * Receives GitHub webhook events and triggers appropriate actions:
 * - pull_request opened/synchronize: Trigger dependency scan
 * - Post results as GitHub status check
 * - Post summary comment on PR
 */

import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import {
  prStatusChecks,
  prComments,
} from './stores.js';
import { PRStatusCheck, PRComment } from './types.js';

// Webhook secret for verifying GitHub signatures (in production, use env var)
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'qa-guardian-webhook-secret';

// PR scan configuration storage
interface PRScanConfig {
  enabled: boolean;
  severity_threshold: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  block_on_critical: boolean;
  block_on_high: boolean;
  post_comment: boolean;
  create_status_check: boolean;
}

const prScanConfigs: Map<string, PRScanConfig> = new Map();

// Default config for projects
const DEFAULT_PR_SCAN_CONFIG: PRScanConfig = {
  enabled: true,
  severity_threshold: 'MEDIUM',
  block_on_critical: true,
  block_on_high: false,
  post_comment: true,
  create_status_check: true,
};

// PR scan result storage (local interface that's simpler)
interface PRWebhookScanResult {
  id: string;
  project_id: string;
  pr_number: number;
  repository: string;
  commit_sha: string;
  branch: string;
  status: 'pending' | 'scanning' | 'completed' | 'failed';
  started_at: Date;
  completed_at?: Date;
  vulnerabilities: Array<{
    package_name: string;
    version: string;
    cve_id: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
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
  policy_result: {
    passed: boolean;
    blocked: boolean;
    reason: string;
  };
}

// Local storage for webhook-triggered scans
const webhookScans: Map<string, PRWebhookScanResult> = new Map();

// Simulated vulnerability database for demo
const DEMO_VULNERABILITIES = [
  {
    package: 'lodash',
    version_regex: /^4\.17\.(0|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20)$/,
    cve: 'CVE-2021-23337',
    severity: 'HIGH' as const,
    title: 'Prototype Pollution in lodash',
    fixed_version: '4.17.21',
  },
  {
    package: 'axios',
    version_regex: /^0\.(19|20|21)\./,
    cve: 'CVE-2021-3749',
    severity: 'HIGH' as const,
    title: 'Server-Side Request Forgery in axios',
    fixed_version: '0.21.2',
  },
  {
    package: 'express',
    version_regex: /^4\.17\.[0-1]$/,
    cve: 'CVE-2024-29041',
    severity: 'MEDIUM' as const,
    title: 'Open Redirect in express',
    fixed_version: '4.18.2',
  },
  {
    package: 'minimist',
    version_regex: /^1\.2\.[0-5]$/,
    cve: 'CVE-2021-44906',
    severity: 'CRITICAL' as const,
    title: 'Prototype Pollution in minimist',
    fixed_version: '1.2.6',
  },
];

// GitHub webhook event types
interface GitHubPullRequestEvent {
  action: 'opened' | 'synchronize' | 'closed' | 'reopened' | 'edited';
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    state: 'open' | 'closed';
    html_url: string;
    head: {
      ref: string;
      sha: string;
    };
    base: {
      ref: string;
      sha: string;
    };
    user: {
      login: string;
    };
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
  sender: {
    login: string;
  };
  installation?: {
    id: number;
  };
}

interface ScanResult {
  success: boolean;
  vulnerabilities: Array<{
    package_name: string;
    version: string;
    cve_id: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
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
  passed: boolean;
  blocked: boolean;
  message: string;
}

// Verify GitHub webhook signature
function verifyWebhookSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) return false;

  const sig = signature.startsWith('sha256=')
    ? signature.substring(7)
    : signature;

  try {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(sig, 'hex'),
      Buffer.from(digest, 'hex')
    );
  } catch {
    return false;
  }
}

// Simulate dependency scan for a PR
async function runPRDependencyScan(
  repoFullName: string,
  prNumber: number,
  commitSha: string,
  _branch: string
): Promise<ScanResult> {
  console.log(`[GitHub Webhook] Running dependency scan for ${repoFullName} PR #${prNumber} (${commitSha})`);

  // Simulate scanning package.json for vulnerabilities
  // In production, this would clone the repo and run actual scanners
  const simulatedDependencies = [
    { name: 'lodash', version: '4.17.15' },
    { name: 'axios', version: '0.21.1' },
    { name: 'express', version: '4.17.1' },
    { name: 'react', version: '18.2.0' },
    { name: 'typescript', version: '5.0.0' },
  ];

  const vulnerabilities: ScanResult['vulnerabilities'] = [];

  for (const dep of simulatedDependencies) {
    for (const vuln of DEMO_VULNERABILITIES) {
      if (dep.name === vuln.package && vuln.version_regex.test(dep.version)) {
        vulnerabilities.push({
          package_name: dep.name,
          version: dep.version,
          cve_id: vuln.cve,
          severity: vuln.severity,
          title: vuln.title,
          fixed_version: vuln.fixed_version,
        });
      }
    }
  }

  const summary = {
    total: vulnerabilities.length,
    critical: vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
    high: vulnerabilities.filter(v => v.severity === 'HIGH').length,
    medium: vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
    low: vulnerabilities.filter(v => v.severity === 'LOW').length,
  };

  // Get config for this repo
  const config = prScanConfigs.get(repoFullName) || DEFAULT_PR_SCAN_CONFIG;

  // Determine if scan passed based on policy
  const blocked =
    (config.block_on_critical && summary.critical > 0) ||
    (config.block_on_high && summary.high > 0);

  const passed = !blocked;

  let message: string;
  if (vulnerabilities.length === 0) {
    message = 'No vulnerabilities found in dependencies';
  } else if (blocked) {
    message = `Found ${summary.total} vulnerabilities (${summary.critical} critical, ${summary.high} high) - PR blocked`;
  } else {
    message = `Found ${summary.total} vulnerabilities (review recommended)`;
  }

  return {
    success: true,
    vulnerabilities,
    summary,
    passed,
    blocked,
    message,
  };
}

// Create GitHub status check (simulated)
async function createGitHubStatusCheck(
  projectId: string,
  prNumber: number,
  prTitle: string,
  commitSha: string,
  scanResult: ScanResult
): Promise<PRStatusCheck> {
  const checkId = `status-${Date.now()}`;

  const status: PRStatusCheck = {
    id: checkId,
    project_id: projectId,
    pr_number: prNumber,
    pr_title: prTitle,
    head_sha: commitSha,
    status: scanResult.passed ? 'success' : 'failure',
    context: 'QA Guardian / Dependency Scan',
    description: scanResult.message,
    target_url: `https://qa-guardian.example.com/scans/${checkId}`,
    created_at: new Date(),
    updated_at: new Date(),
  };

  // Store the status check
  if (!prStatusChecks.has(projectId)) {
    prStatusChecks.set(projectId, []);
  }
  prStatusChecks.get(projectId)!.push(status);

  console.log(`[GitHub Webhook] Created status check for PR #${prNumber}: ${status.status}`);

  return status;
}

// Create PR comment with scan summary (simulated)
async function createPRComment(
  projectId: string,
  prNumber: number,
  scanResult: ScanResult
): Promise<PRComment> {
  const commentId = `comment-${Date.now()}`;

  // Build markdown comment
  let body = '## QA Guardian Dependency Scan Results\n\n';

  if (scanResult.vulnerabilities.length === 0) {
    body += ':white_check_mark: **No vulnerabilities found**\n\n';
    body += 'All dependencies passed security checks.\n';
  } else {
    body += scanResult.blocked
      ? ':x: **Scan Failed - PR Blocked**\n\n'
      : ':warning: **Vulnerabilities Found**\n\n';

    body += `| Severity | Count |\n|----------|-------|\n`;
    body += `| :red_circle: Critical | ${scanResult.summary.critical} |\n`;
    body += `| :orange_circle: High | ${scanResult.summary.high} |\n`;
    body += `| :yellow_circle: Medium | ${scanResult.summary.medium} |\n`;
    body += `| :green_circle: Low | ${scanResult.summary.low} |\n\n`;

    body += '### Vulnerabilities\n\n';
    body += '| Package | Version | CVE | Severity | Fix |\n';
    body += '|---------|---------|-----|----------|-----|\n';

    for (const vuln of scanResult.vulnerabilities) {
      const severityIcon = {
        CRITICAL: ':red_circle:',
        HIGH: ':orange_circle:',
        MEDIUM: ':yellow_circle:',
        LOW: ':green_circle:',
      }[vuln.severity];

      body += `| ${vuln.package_name} | ${vuln.version} | ${vuln.cve_id} | ${severityIcon} ${vuln.severity} | ${vuln.fixed_version || 'N/A'} |\n`;
    }

    body += '\n---\n';
    body += '_Scanned by [QA Guardian](https://qa-guardian.example.com)_';
  }

  const comment: PRComment = {
    id: commentId,
    project_id: projectId,
    pr_number: prNumber,
    body,
    results_url: `https://qa-guardian.example.com/scans/${commentId}`,
    passed: scanResult.passed ? scanResult.vulnerabilities.length : 0,
    failed: scanResult.blocked ? scanResult.vulnerabilities.length : 0,
    skipped: 0,
    total: scanResult.vulnerabilities.length,
    created_at: new Date(),
  };

  // Store the comment
  if (!prComments.has(projectId)) {
    prComments.set(projectId, []);
  }
  prComments.get(projectId)!.push(comment);

  console.log(`[GitHub Webhook] Posted comment on PR #${prNumber}`);

  return comment;
}

export async function githubWebhookRoutes(app: FastifyInstance): Promise<void> {
  // ============================================================
  // Feature #272: GitHub Webhook Receiver
  // ============================================================

  // Receive GitHub webhook events (public endpoint - no auth)
  app.post<{
    Body: GitHubPullRequestEvent;
    Headers: {
      'x-github-event'?: string;
      'x-hub-signature-256'?: string;
      'x-github-delivery'?: string;
    };
  }>('/api/v1/github/webhooks', async (request, reply) => {
    const event = request.headers['x-github-event'];
    const signature = request.headers['x-hub-signature-256'];
    const deliveryId = request.headers['x-github-delivery'] || `local-${Date.now()}`;

    console.log(`[GitHub Webhook] Received event: ${event} (delivery: ${deliveryId})`);

    // Verify signature in production (skip for local testing)
    if (process.env.NODE_ENV === 'production' && WEBHOOK_SECRET !== 'qa-guardian-webhook-secret') {
      const payload = JSON.stringify(request.body);
      if (!verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
        console.log('[GitHub Webhook] Invalid signature');
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid webhook signature',
        });
      }
    }

    // Handle pull_request events
    if (event === 'pull_request') {
      const { action, number, pull_request, repository } = request.body;

      console.log(`[GitHub Webhook] PR ${action}: ${repository.full_name}#${number}`);

      // Only scan on opened or synchronize (new commits pushed)
      if (action === 'opened' || action === 'synchronize') {
        const repoFullName = repository.full_name;
        const commitSha = pull_request.head.sha;
        const branch = pull_request.head.ref;
        const prTitle = pull_request.title;

        // Check if scanning is enabled for this repo
        const config = prScanConfigs.get(repoFullName) || DEFAULT_PR_SCAN_CONFIG;
        if (!config.enabled) {
          console.log(`[GitHub Webhook] Scanning disabled for ${repoFullName}`);
          return {
            success: true,
            message: 'Scanning disabled for this repository',
            scanned: false,
          };
        }

        // Run dependency scan
        const scanResult = await runPRDependencyScan(
          repoFullName,
          number,
          commitSha,
          branch
        );

        // Store scan result
        const scanKey = `${repoFullName}:${number}`;
        const scanRecord: PRWebhookScanResult = {
          id: `scan-${Date.now()}`,
          project_id: repository.id.toString(),
          pr_number: number,
          repository: repoFullName,
          commit_sha: commitSha,
          branch,
          status: 'completed',
          started_at: new Date(Date.now() - 5000),
          completed_at: new Date(),
          vulnerabilities: scanResult.vulnerabilities,
          summary: scanResult.summary,
          policy_result: {
            passed: scanResult.passed,
            blocked: scanResult.blocked,
            reason: scanResult.message,
          },
        };
        webhookScans.set(scanKey, scanRecord);

        // Create status check
        if (config.create_status_check) {
          await createGitHubStatusCheck(
            repository.id.toString(),
            number,
            prTitle,
            commitSha,
            scanResult
          );
        }

        // Post PR comment
        if (config.post_comment) {
          await createPRComment(repository.id.toString(), number, scanResult);
        }

        return {
          success: true,
          message: scanResult.message,
          scanned: true,
          scan_id: scanRecord.id,
          summary: scanResult.summary,
          passed: scanResult.passed,
          blocked: scanResult.blocked,
        };
      }

      // PR closed - cleanup (optional)
      if (action === 'closed') {
        console.log(`[GitHub Webhook] PR #${number} closed`);
        return {
          success: true,
          message: 'PR closed event received',
          scanned: false,
        };
      }
    }

    // Return success for other events
    return {
      success: true,
      message: `Event ${event} received`,
      processed: false,
    };
  });

  // ============================================================
  // Feature #272: Configure PR Scan Settings
  // ============================================================

  // Get PR scan configuration for a repository
  app.get<{
    Params: { owner: string; repo: string };
  }>('/api/v1/github/webhooks/config/:owner/:repo', async (request) => {
    const { owner, repo } = request.params;
    const repoFullName = `${owner}/${repo}`;

    const config = prScanConfigs.get(repoFullName) || DEFAULT_PR_SCAN_CONFIG;

    return {
      repository: repoFullName,
      config,
    };
  });

  // Update PR scan configuration for a repository
  app.patch<{
    Params: { owner: string; repo: string };
    Body: Partial<PRScanConfig>;
  }>('/api/v1/github/webhooks/config/:owner/:repo', async (request) => {
    const { owner, repo } = request.params;
    const repoFullName = `${owner}/${repo}`;
    const updates = request.body;

    const currentConfig = prScanConfigs.get(repoFullName) || { ...DEFAULT_PR_SCAN_CONFIG };
    const newConfig = { ...currentConfig, ...updates };
    prScanConfigs.set(repoFullName, newConfig);

    console.log(`[GitHub Webhook] Updated config for ${repoFullName}:`, newConfig);

    return {
      repository: repoFullName,
      config: newConfig,
      message: 'Configuration updated',
    };
  });

  // ============================================================
  // Feature #272: Manual PR Scan Trigger
  // ============================================================

  // Manually trigger a PR scan (for testing or re-scanning)
  app.post<{
    Params: { owner: string; repo: string; prNumber: string };
  }>('/api/v1/github/webhooks/scan/:owner/:repo/:prNumber', async (request, reply) => {
    const { owner, repo, prNumber } = request.params;
    const repoFullName = `${owner}/${repo}`;
    const pr = parseInt(prNumber, 10);

    if (isNaN(pr)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid PR number',
      });
    }

    // Simulate getting PR info
    const commitSha = `manual-scan-${Date.now().toString(36)}`;
    const branch = 'feature-branch';

    // Run scan
    const scanResult = await runPRDependencyScan(repoFullName, pr, commitSha, branch);

    // Store scan result
    const scanKey = `${repoFullName}:${pr}`;
    const scanRecord: PRWebhookScanResult = {
      id: `scan-manual-${Date.now()}`,
      project_id: 'manual',
      pr_number: pr,
      repository: repoFullName,
      commit_sha: commitSha,
      branch,
      status: 'completed',
      started_at: new Date(Date.now() - 3000),
      completed_at: new Date(),
      vulnerabilities: scanResult.vulnerabilities,
      summary: scanResult.summary,
      policy_result: {
        passed: scanResult.passed,
        blocked: scanResult.blocked,
        reason: scanResult.message,
      },
    };
    webhookScans.set(scanKey, scanRecord);

    // Get config
    const config = prScanConfigs.get(repoFullName) || DEFAULT_PR_SCAN_CONFIG;

    // Create status check
    if (config.create_status_check) {
      await createGitHubStatusCheck('manual', pr, `PR #${pr}`, commitSha, scanResult);
    }

    // Post PR comment
    if (config.post_comment) {
      await createPRComment('manual', pr, scanResult);
    }

    return {
      success: true,
      scan_id: scanRecord.id,
      repository: repoFullName,
      pr_number: pr,
      summary: scanResult.summary,
      passed: scanResult.passed,
      blocked: scanResult.blocked,
      message: scanResult.message,
      vulnerabilities: scanResult.vulnerabilities,
    };
  });

  // ============================================================
  // Feature #272: Get PR Scan Results
  // ============================================================

  // Get scan results for a specific PR
  app.get<{
    Params: { owner: string; repo: string; prNumber: string };
  }>('/api/v1/github/webhooks/scan/:owner/:repo/:prNumber', async (request, reply) => {
    const { owner, repo, prNumber } = request.params;
    const repoFullName = `${owner}/${repo}`;
    const pr = parseInt(prNumber, 10);

    if (isNaN(pr)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid PR number',
      });
    }

    const scanKey = `${repoFullName}:${pr}`;
    const scan = webhookScans.get(scanKey);

    if (!scan) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `No scan results found for ${repoFullName} PR #${pr}`,
      });
    }

    return {
      scan,
    };
  });

  // List all webhook-triggered scans
  app.get('/api/v1/github/webhooks/scans', async () => {
    const scans: PRWebhookScanResult[] = [];
    webhookScans.forEach((scan) => {
      scans.push(scan);
    });

    // Sort by completed_at descending
    scans.sort((a, b) =>
      (b.completed_at?.getTime() || 0) - (a.completed_at?.getTime() || 0)
    );

    return {
      scans: scans.slice(0, 50), // Return latest 50
      total: scans.length,
    };
  });
}
