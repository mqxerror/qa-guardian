/**
 * GitHub Webhooks Handler
 * Feature #272: Auto-trigger dependency scan on GitHub PR
 * Feature #334: Wire Gitleaks scan to push webhook handler
 *
 * Receives GitHub webhook events and triggers appropriate actions:
 * - pull_request opened/synchronize: Trigger dependency scan
 * - push: Trigger Gitleaks secret scan (Feature #334)
 * - Post results as GitHub status check
 * - Post summary comment on PR
 */

import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { authenticate, requireScopes } from '../../middleware/auth.js'; // Feature #389: Add authentication
import {
  prStatusChecks,
  prComments,
} from './stores.js';
import { PRStatusCheck, PRComment } from './types.js';
// Feature #334: Import Gitleaks scanning functionality
import {
  runGitleaksScan,
  checkGitleaksAvailability,
  GitleaksScan,
  GitleaksConfig,
} from '../sast/gitleaks.js';
import * as gitleaksRepo from '../../services/repositories/gitleaks.js';

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

// Feature #334: GitHub Push Event type
interface GitHubPushEvent {
  ref: string;  // e.g., "refs/heads/main"
  before: string;  // SHA before the push
  after: string;   // SHA after the push
  created: boolean;
  deleted: boolean;
  forced: boolean;
  compare: string;  // URL to compare the changes
  commits: Array<{
    id: string;
    tree_id: string;
    distinct: boolean;
    message: string;
    timestamp: string;
    url: string;
    author: {
      name: string;
      email: string;
      username?: string;
    };
    committer: {
      name: string;
      email: string;
      username?: string;
    };
    added: string[];
    removed: string[];
    modified: string[];
  }>;
  head_commit: {
    id: string;
    tree_id: string;
    distinct: boolean;
    message: string;
    timestamp: string;
    url: string;
    author: {
      name: string;
      email: string;
      username?: string;
    };
  } | null;
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
    clone_url: string;
    default_branch: string;
  };
  pusher: {
    name: string;
    email: string;
  };
  sender: {
    login: string;
  };
  installation?: {
    id: number;
  };
}

// Feature #334: Storage for push scan results
interface PushSecretScanResult {
  id: string;
  repository: string;
  branch: string;
  before_sha: string;
  after_sha: string;
  pusher: string;
  status: 'pending' | 'scanning' | 'completed' | 'failed';
  started_at: Date;
  completed_at?: Date;
  secrets_found: number;
  scan_id?: string;  // Reference to GitleaksScan
  error?: string;
}

// In-memory storage for push scan results (for quick access)
const pushSecretScans: Map<string, PushSecretScanResult> = new Map();

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

// ============================================================
// Feature #334: Async Gitleaks scan for push events
// ============================================================

/**
 * Run Gitleaks scan asynchronously after a push event
 * This runs in the background so it doesn't block the webhook response
 */
async function runPushGitleaksScan(
  projectId: string,
  repoFullName: string,
  branch: string,
  beforeSha: string,
  afterSha: string,
  pusher: string,
  config: GitleaksConfig,
  pushScanKey: string
): Promise<void> {
  const scanId = `gitleaks_push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startedAt = new Date();

  console.log(`
====================================
  Feature #334: Gitleaks Push Scan
====================================
  Repository: ${repoFullName}
  Branch: ${branch}
  Commit Range: ${beforeSha.substring(0, 7)}..${afterSha.substring(0, 7)}
  Pusher: ${pusher}
  Scan ID: ${scanId}
====================================
  `);

  try {
    // In a real implementation, this would:
    // 1. Clone the repo (or use a cached working copy)
    // 2. Checkout the pushed commit
    // 3. Run Gitleaks with --commits flag to scan only the pushed commits
    //
    // For now, we scan the current working directory (which simulates the repo)
    const repoPath = process.env.GITLEAKS_SCAN_PATH || process.cwd();

    // Check Gitleaks availability
    const gitleaksInfo = checkGitleaksAvailability();

    // Run the scan (with 5 minute timeout)
    const scanResult = await runGitleaksScan(repoPath, {
      fullHistory: false,  // Only scan current state for push events
      timeout: 300000,     // 5 minutes
      excludePaths: config.exclude_paths,
    });

    // Apply scan_id to all findings
    const findings = scanResult.findings.map(f => ({ ...f, scan_id: scanId }));

    // Filter by severity threshold
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, all: 0 };
    const filteredFindings = findings.filter(f => {
      const findingSeverity = severityOrder[f.severity] || 0;
      const thresholdSeverity = severityOrder[config.severity_threshold] || 0;
      return findingSeverity >= thresholdSeverity;
    });

    // Create scan record for database
    const scan: GitleaksScan = {
      id: scanId,
      organization_id: 'webhook',  // Could be looked up from project
      project_id: projectId,
      repository: repoFullName,
      branch,
      status: scanResult.success ? 'completed' : 'failed',
      started_at: startedAt,
      completed_at: new Date(),
      trigger: 'push',
      commits_scanned: scanResult.commitsScanned || 1,
      findings: filteredFindings,
      summary: {
        total: filteredFindings.length,
        critical: filteredFindings.filter(f => f.severity === 'critical').length,
        high: filteredFindings.filter(f => f.severity === 'high').length,
        medium: filteredFindings.filter(f => f.severity === 'medium').length,
        low: filteredFindings.filter(f => f.severity === 'low').length,
        by_type: filteredFindings.reduce((acc, f) => {
          acc[f.secret_type] = (acc[f.secret_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
      error_message: scanResult.error,
    };

    // Store scan in database
    await gitleaksRepo.createGitleaksScan(scan);

    // Update in-memory push scan record
    const pushScanRecord = pushSecretScans.get(pushScanKey);
    if (pushScanRecord) {
      pushScanRecord.status = 'completed';
      pushScanRecord.completed_at = new Date();
      pushScanRecord.secrets_found = filteredFindings.length;
      pushScanRecord.scan_id = scanId;
    }

    console.log(`
====================================
  Gitleaks Push Scan Completed
====================================
  Repository: ${repoFullName}
  Branch: ${branch}
  Method: ${gitleaksInfo.available ? `CLI v${gitleaksInfo.version}` : 'Pattern Matching'}
  Secrets Found: ${scan.summary.total}
    - Critical: ${scan.summary.critical}
    - High: ${scan.summary.high}
    - Medium: ${scan.summary.medium}
    - Low: ${scan.summary.low}
====================================
    `);

    // Create alert/notification if secrets found (Feature #334 step 6)
    if (filteredFindings.length > 0 && config.notification_channels.length > 0) {
      await sendSecretDetectedNotification(
        repoFullName,
        branch,
        afterSha,
        pusher,
        filteredFindings.length,
        scan.summary,
        config.notification_channels
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[GitHub Webhook] Gitleaks push scan failed:`, error);

    // Update in-memory record with error
    const pushScanRecord = pushSecretScans.get(pushScanKey);
    if (pushScanRecord) {
      pushScanRecord.status = 'failed';
      pushScanRecord.completed_at = new Date();
      pushScanRecord.error = errorMessage;
    }

    // Create a failed scan record in database
    const failedScan: GitleaksScan = {
      id: scanId,
      organization_id: 'webhook',
      project_id: projectId,
      repository: repoFullName,
      branch,
      status: 'failed',
      started_at: startedAt,
      completed_at: new Date(),
      trigger: 'push',
      commits_scanned: 0,
      findings: [],
      summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, by_type: {} },
      error_message: errorMessage,
    };
    await gitleaksRepo.createGitleaksScan(failedScan);
  }
}

/**
 * Send notification when secrets are detected in pushed code
 * Feature #334 step 6
 */
async function sendSecretDetectedNotification(
  repository: string,
  branch: string,
  commitSha: string,
  pusher: string,
  secretsCount: number,
  summary: { critical: number; high: number; medium: number; low: number },
  channels: ('slack' | 'email' | 'webhook')[]
): Promise<void> {
  const message = `🔐 **Secret Detection Alert**

**Repository:** ${repository}
**Branch:** ${branch}
**Commit:** ${commitSha.substring(0, 7)}
**Pushed by:** ${pusher}

**${secretsCount} secrets detected:**
- 🔴 Critical: ${summary.critical}
- 🟠 High: ${summary.high}
- 🟡 Medium: ${summary.medium}
- 🟢 Low: ${summary.low}

Please review and remediate immediately. Secrets in code are a security risk.`;

  console.log(`[GitHub Webhook] Sending secret detection notification to channels:`, channels);
  console.log(message);

  // TODO: Implement actual notification channels
  // For now, we just log the notification
  // In production, this would send to Slack, email, or custom webhooks

  for (const channel of channels) {
    switch (channel) {
      case 'slack':
        console.log(`[Notification] Would send to Slack: ${secretsCount} secrets found`);
        // await sendSlackNotification(message);
        break;
      case 'email':
        console.log(`[Notification] Would send email: ${secretsCount} secrets found`);
        // await sendEmailNotification(message);
        break;
      case 'webhook':
        console.log(`[Notification] Would call webhook: ${secretsCount} secrets found`);
        // await sendWebhookNotification(message);
        break;
    }
  }
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

    // ============================================================
    // Feature #334: Handle push events - Trigger Gitleaks scan
    // ============================================================
    if (event === 'push') {
      const pushEvent = request.body as unknown as GitHubPushEvent;
      const { ref, before, after, repository, pusher, commits, deleted } = pushEvent;

      // Extract branch name from ref (refs/heads/main -> main)
      const branch = ref.replace('refs/heads/', '');

      console.log(`[GitHub Webhook] Push to ${repository.full_name}/${branch} by ${pusher.name}`);
      console.log(`[GitHub Webhook] Commits: ${before.substring(0, 7)}..${after.substring(0, 7)} (${commits?.length || 0} commits)`);

      // Don't scan on branch deletion
      if (deleted) {
        console.log(`[GitHub Webhook] Branch ${branch} deleted, skipping scan`);
        return {
          success: true,
          message: 'Branch deleted, no scan needed',
          scanned: false,
        };
      }

      // Check if Gitleaks scan_on_push is enabled for this repo
      // Look up config by repository full name (or use a default project ID pattern)
      const projectId = repository.id.toString();
      const gitleaksConfig = await gitleaksRepo.getGitleaksConfigOrDefault(projectId);

      if (!gitleaksConfig.enabled || !gitleaksConfig.scan_on_push) {
        console.log(`[GitHub Webhook] Gitleaks scan_on_push disabled for ${repository.full_name}`);
        return {
          success: true,
          message: 'Gitleaks scan on push disabled for this repository',
          scanned: false,
        };
      }

      // Create push scan record (mark as pending)
      const pushScanId = `push-scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const pushScanKey = `${repository.full_name}:${after}`;

      const pushScanRecord: PushSecretScanResult = {
        id: pushScanId,
        repository: repository.full_name,
        branch,
        before_sha: before,
        after_sha: after,
        pusher: pusher.name,
        status: 'scanning',
        started_at: new Date(),
        secrets_found: 0,
      };
      pushSecretScans.set(pushScanKey, pushScanRecord);

      // Run Gitleaks scan asynchronously (don't block webhook response)
      // GitHub webhooks have a 10-second timeout, so we run scan in background
      runPushGitleaksScan(
        projectId,
        repository.full_name,
        branch,
        before,
        after,
        pusher.name,
        gitleaksConfig,
        pushScanKey
      ).catch(err => {
        console.error(`[GitHub Webhook] Async Gitleaks scan error:`, err);
        // Update scan record with error
        const record = pushSecretScans.get(pushScanKey);
        if (record) {
          record.status = 'failed';
          record.completed_at = new Date();
          record.error = err.message || 'Unknown error';
        }
      });

      // Return immediately to acknowledge webhook (scan runs in background)
      return {
        success: true,
        message: 'Push received, Gitleaks scan triggered',
        scanned: true,
        scan_id: pushScanId,
        repository: repository.full_name,
        branch,
        commits_count: commits?.length || 0,
        scan_status: 'pending',
      };
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
  // Feature #389: Add authentication to protect endpoint
  app.get('/api/v1/github/webhooks/scans', {
    preHandler: [authenticate, requireScopes(['read'])],
  }, async () => {
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

  // ============================================================
  // Feature #334: Push Secret Scan Endpoints
  // ============================================================

  // Get Gitleaks config for push scanning (per project)
  app.get<{
    Params: { projectId: string };
  }>('/api/v1/github/webhooks/gitleaks/config/:projectId', async (request) => {
    const { projectId } = request.params;

    const config = await gitleaksRepo.getGitleaksConfigOrDefault(projectId);

    return {
      project_id: projectId,
      config,
      gitleaks_available: checkGitleaksAvailability().available,
      gitleaks_version: checkGitleaksAvailability().version,
    };
  });

  // Update Gitleaks config for push scanning (enable/disable auto-scan)
  app.patch<{
    Params: { projectId: string };
    Body: Partial<GitleaksConfig>;
  }>('/api/v1/github/webhooks/gitleaks/config/:projectId', async (request) => {
    const { projectId } = request.params;
    const updates = request.body;

    const currentConfig = await gitleaksRepo.getGitleaksConfigOrDefault(projectId);
    const newConfig: GitleaksConfig = { ...currentConfig, ...updates };
    await gitleaksRepo.upsertGitleaksConfig(projectId, newConfig);

    console.log(`[GitHub Webhook] Updated Gitleaks config for project ${projectId}:`, {
      enabled: newConfig.enabled,
      scan_on_push: newConfig.scan_on_push,
      scan_on_pr: newConfig.scan_on_pr,
    });

    return {
      project_id: projectId,
      config: newConfig,
      message: 'Gitleaks configuration updated',
    };
  });

  // List push secret scan results
  // Feature #389: Add authentication to protect endpoint
  app.get('/api/v1/github/webhooks/gitleaks/scans', {
    preHandler: [authenticate, requireScopes(['read'])],
  }, async () => {
    const scans: PushSecretScanResult[] = [];
    pushSecretScans.forEach((scan) => {
      scans.push(scan);
    });

    // Sort by started_at descending
    scans.sort((a, b) =>
      (b.started_at?.getTime() || 0) - (a.started_at?.getTime() || 0)
    );

    return {
      scans: scans.slice(0, 50), // Return latest 50
      total: scans.length,
    };
  });

  // Get specific push scan result
  app.get<{
    Params: { owner: string; repo: string; sha: string };
  }>('/api/v1/github/webhooks/gitleaks/scans/:owner/:repo/:sha', async (request, reply) => {
    const { owner, repo, sha } = request.params;
    const scanKey = `${owner}/${repo}:${sha}`;

    const scan = pushSecretScans.get(scanKey);
    if (!scan) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `No push scan found for ${owner}/${repo} at commit ${sha}`,
      });
    }

    // If scan has a scan_id, get the full Gitleaks scan from database
    let gitleaksScan: Awaited<ReturnType<typeof gitleaksRepo.getGitleaksScan>> | null = null;
    if (scan.scan_id) {
      // We need to find by scan_id across all projects
      const projectId = '0'; // Use a placeholder; in real impl would look up properly
      gitleaksScan = await gitleaksRepo.getGitleaksScan(projectId, scan.scan_id);
    }

    return {
      push_scan: scan,
      gitleaks_scan: gitleaksScan,
    };
  });

  // Manual trigger: Simulate a push event for testing
  app.post<{
    Params: { owner: string; repo: string };
    Body: { branch?: string; sha?: string };
  }>('/api/v1/github/webhooks/gitleaks/test/:owner/:repo', async (request) => {
    const { owner, repo } = request.params;
    const { branch = 'main', sha } = request.body;
    const repoFullName = `${owner}/${repo}`;
    const commitSha = sha || `test-${Date.now().toString(36)}`;
    const projectId = repoFullName.replace('/', '-');  // Simple project ID derivation

    const config = await gitleaksRepo.getGitleaksConfigOrDefault(projectId);

    if (!config.enabled) {
      return {
        success: false,
        message: 'Gitleaks is not enabled for this repository. Enable it first.',
        config_hint: 'PATCH /api/v1/github/webhooks/gitleaks/config/:projectId with { "enabled": true, "scan_on_push": true }',
      };
    }

    // Create a test push scan
    const pushScanKey = `${repoFullName}:${commitSha}`;
    const pushScanId = `push-test-${Date.now()}`;

    const pushScanRecord: PushSecretScanResult = {
      id: pushScanId,
      repository: repoFullName,
      branch,
      before_sha: '0000000000000000000000000000000000000000',
      after_sha: commitSha,
      pusher: 'test-user',
      status: 'scanning',
      started_at: new Date(),
      secrets_found: 0,
    };
    pushSecretScans.set(pushScanKey, pushScanRecord);

    // Run scan asynchronously
    runPushGitleaksScan(
      projectId,
      repoFullName,
      branch,
      pushScanRecord.before_sha,
      commitSha,
      'test-user',
      config,
      pushScanKey
    ).catch(err => {
      console.error(`[GitHub Webhook] Test Gitleaks scan error:`, err);
    });

    return {
      success: true,
      message: 'Test Gitleaks scan triggered',
      scan_id: pushScanId,
      repository: repoFullName,
      branch,
      commit_sha: commitSha,
      status: 'scanning',
      check_status_at: `/api/v1/github/webhooks/gitleaks/scans/${owner}/${repo}/${commitSha}`,
    };
  });
}
