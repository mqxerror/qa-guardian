/**
 * SAST Core Routes
 *
 * Core SAST scanning and configuration routes including:
 * - Configuration management (GET/PUT /sast/config)
 * - Available rulesets (GET /sast/rulesets)
 * - Scan triggering (POST /sast/scan)
 * - Scan listing and details (GET /sast/scans, GET /sast/scans/:scanId)
 * - Organization dashboard (GET /sast/dashboard)
 * - Trending analytics (GET /sast/trends)
 *
 * Extracted from sast.ts (Feature #1376)
 */

import { FastifyInstance } from 'fastify';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { authenticate, JwtPayload } from '../../middleware/auth.js';
import { getProject, listProjects } from '../../services/repositories/projects.js';
import { logAuditEntry } from '../audit-logs.js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const execFileAsync = promisify(execFile);

import { createLogger } from '../../services/logger.js';

const logger = createLogger('sast');

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
  SASTSeverity,
  SASTConfig,
  SASTFinding,
  SASTScanResult,
} from './types.js';

import {
  getSASTConfig,
  updateSASTConfig,
  createSastScan,
  getSastScan,
  updateSastScan,
  getSastScansByProject,
  getFalsePositives,
  generateId,
} from './stores.js';

import {
  getDashboardSummary,
  getDashboardFindings,
} from '../../services/repositories/sast.js';

/**
 * Run a real Semgrep CLI scan against a target directory.
 * Parses JSON output and maps results to SASTFinding format.
 */
async function runSemgrepScan(
  projectId: string,
  repoPath: string,
  config: SASTConfig
): Promise<SASTFinding[]> {

  // Map ruleset config to Semgrep config strings
  const rulesetMap: Record<string, string> = {
    default: 'auto',
    security: 'p/security-audit',
    custom: 'auto',
  };
  const rulesets: string[] = [rulesetMap[config.ruleset] || 'auto'];

  // Build Semgrep CLI arguments
  const args = ['scan', '--json', '--quiet'];
  for (const ruleset of rulesets) {
    args.push('--config', ruleset);
  }

  // Add custom YAML rules as inline config if present
  if (config.customRulesYaml && config.customRulesYaml.length > 0) {
    for (const customRule of config.customRulesYaml) {
      if (!customRule.enabled) continue;
      // Pass custom YAML rule content via --config flag
      args.push('--config', customRule.yaml);
    }
  }

  // Exclude paths if configured
  if (config.excludePaths && config.excludePaths.length > 0) {
    for (const excludePath of config.excludePaths) {
      args.push('--exclude', excludePath);
    }
  }

  args.push(repoPath);

  /**
   * Parse Semgrep JSON stdout into SASTFinding array
   */
  function parseSemgrepOutput(stdout: string): SASTFinding[] {
    const results = JSON.parse(stdout) as { results?: SemgrepResult[] };
    return (results.results || []).map((r: SemgrepResult) => ({
      id: generateId(),
      ruleId: r.check_id,
      ruleName: r.check_id.split('.').pop() || r.check_id,
      severity: mapSemgrepSeverity(r.extra?.severity),
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

  try {
    const { stdout } = await execFileAsync('semgrep', args, {
      timeout: 120000, // 2 minute timeout
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
    });

    const findings = parseSemgrepOutput(stdout);

    // Filter by severity threshold
    const severityOrder: Record<SASTSeverity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const threshold = severityOrder[config.severityThreshold];
    const filteredByThreshold = findings.filter(f => severityOrder[f.severity] >= threshold);

    // Mark findings that are false positives
    const projectFPs = await getFalsePositives(projectId);
    return filteredByThreshold.map(finding => {
      const isFP = projectFPs.some(fp =>
        fp.ruleId === finding.ruleId &&
        fp.filePath === finding.filePath &&
        fp.line === finding.line
      );
      return { ...finding, isFalsePositive: isFP };
    });
  } catch (err: unknown) {
    const execErr = err as { code?: string; stdout?: string; message?: string };
    // If semgrep binary is not installed, fall back to built-in JS scanner
    if (execErr.code === 'ENOENT') {
      logger.info('Semgrep not installed, falling back to built-in JS SAST scanner');
      return runBuiltinSASTScan(projectId, repoPath, config);
    }

    // Semgrep exits with code 1 when findings exist -- parse stdout anyway
    if (execErr.stdout) {
      try {
        const findings = parseSemgrepOutput(execErr.stdout);

        const severityOrder: Record<SASTSeverity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        const threshold = severityOrder[config.severityThreshold];
        const filteredByThreshold = findings.filter(f => severityOrder[f.severity] >= threshold);

        const projectFPs = await getFalsePositives(projectId);
        return filteredByThreshold.map(finding => {
          const isFP = projectFPs.some(fp =>
            fp.ruleId === finding.ruleId &&
            fp.filePath === finding.filePath &&
            fp.line === finding.line
          );
          return { ...finding, isFalsePositive: isFP };
        });
      } catch {
        // stdout was not valid JSON, fall through to generic error
      }
    }

    throw new Error(`Semgrep scan failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Map Semgrep severity strings to our SASTSeverity type.
 * Semgrep uses ERROR/WARNING/INFO; we map to CRITICAL/HIGH/MEDIUM/LOW.
 */
function mapSemgrepSeverity(semgrepSeverity?: string): SASTSeverity {
  switch (semgrepSeverity?.toUpperCase()) {
    case 'ERROR':
      return 'CRITICAL';
    case 'WARNING':
      return 'HIGH';
    case 'INFO':
      return 'MEDIUM';
    default:
      return 'LOW';
  }
}

/**
 * Built-in JavaScript SAST scanner — used as fallback when Semgrep CLI is not installed.
 * Scans real source files with regex-based security rules and returns genuine findings.
 * Each rule maps to a real CWE ID and OWASP category.
 */
interface BuiltinRule {
  id: string;
  name: string;
  pattern: RegExp;
  severity: SASTSeverity;
  category: string;
  message: string;
  cweId: string;
  owaspCategory: string;
  suggestion: string;
  /** File extensions this rule applies to (empty = all) */
  fileExtensions?: string[];
}

const BUILTIN_SAST_RULES: BuiltinRule[] = [
  {
    id: 'js.security.eval-usage',
    name: 'eval-usage',
    pattern: /\beval\s*\(/,
    severity: 'CRITICAL',
    category: 'security',
    message: 'Use of eval() can lead to code injection vulnerabilities. Avoid eval() and use safer alternatives.',
    cweId: 'CWE-95',
    owaspCategory: 'A03:2021-Injection',
    suggestion: 'Replace eval() with JSON.parse(), Function constructor, or a safe expression evaluator.',
    fileExtensions: ['.js', '.ts', '.jsx', '.tsx'],
  },
  {
    id: 'js.security.hardcoded-secret',
    name: 'hardcoded-secret',
    pattern: /(password|secret|api_key|apikey|token|private_key)\s*[:=]\s*['"][^'"]{8,}['"]/i,
    severity: 'HIGH',
    category: 'security',
    message: 'Hardcoded secret or credential detected. Use environment variables or a secrets manager instead.',
    cweId: 'CWE-798',
    owaspCategory: 'A07:2021-Identification-and-Authentication-Failures',
    suggestion: 'Move secrets to environment variables or a vault service like AWS Secrets Manager.',
    fileExtensions: ['.js', '.ts', '.jsx', '.tsx', '.json', '.env'],
  },
  {
    id: 'js.security.sql-injection',
    name: 'sql-injection',
    pattern: /query\s*\(\s*['"`](?:SELECT|INSERT|UPDATE|DELETE|DROP).*\$\{/i,
    severity: 'CRITICAL',
    category: 'security',
    message: 'Possible SQL injection via string interpolation in query. Use parameterized queries instead.',
    cweId: 'CWE-89',
    owaspCategory: 'A03:2021-Injection',
    suggestion: 'Use parameterized queries with $1, $2 placeholders instead of template literals.',
    fileExtensions: ['.js', '.ts'],
  },
  {
    id: 'js.security.command-injection',
    name: 'command-injection',
    pattern: /(?:exec|execSync|spawn|spawnSync)\s*\(\s*(?:`[^`]*\$\{|['"][^'"]*['"]?\s*\+)/,
    severity: 'CRITICAL',
    category: 'security',
    message: 'Possible command injection via dynamic string in child_process call. Validate and sanitize inputs.',
    cweId: 'CWE-78',
    owaspCategory: 'A03:2021-Injection',
    suggestion: 'Use execFile() with an argument array instead of exec() with string concatenation.',
    fileExtensions: ['.js', '.ts'],
  },
  {
    id: 'js.security.path-traversal',
    name: 'path-traversal',
    pattern: /(?:readFile|readFileSync|writeFile|writeFileSync|createReadStream)\s*\([^)]*(?:req\.|request\.|params\.|query\.)/,
    severity: 'HIGH',
    category: 'security',
    message: 'File operation uses user-controlled input. This could lead to path traversal attacks.',
    cweId: 'CWE-22',
    owaspCategory: 'A01:2021-Broken-Access-Control',
    suggestion: 'Validate and sanitize file paths. Use path.resolve() and check against an allowed base directory.',
    fileExtensions: ['.js', '.ts'],
  },
  {
    id: 'js.security.xss-innerhtml',
    name: 'xss-innerhtml',
    pattern: /(?:innerHTML|outerHTML|document\.write)\s*[=(]/,
    severity: 'HIGH',
    category: 'security',
    message: 'Direct DOM manipulation with innerHTML/outerHTML can lead to Cross-Site Scripting (XSS).',
    cweId: 'CWE-79',
    owaspCategory: 'A03:2021-Injection',
    suggestion: 'Use textContent, createElement, or a framework\'s safe rendering methods instead.',
    fileExtensions: ['.js', '.ts', '.jsx', '.tsx'],
  },
  {
    id: 'js.security.no-csrf-protection',
    name: 'no-csrf-protection',
    pattern: /cors\(\s*\{[^}]*origin\s*:\s*(?:true|'\*'|"\*")/,
    severity: 'MEDIUM',
    category: 'security',
    message: 'CORS configured with wildcard or permissive origin. This may expose the API to CSRF attacks.',
    cweId: 'CWE-352',
    owaspCategory: 'A01:2021-Broken-Access-Control',
    suggestion: 'Restrict CORS origin to specific trusted domains and implement CSRF tokens.',
    fileExtensions: ['.js', '.ts'],
  },
  {
    id: 'js.security.weak-crypto',
    name: 'weak-crypto',
    pattern: /createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)/,
    severity: 'MEDIUM',
    category: 'security',
    message: 'Use of weak cryptographic hash (MD5 or SHA1). These are vulnerable to collision attacks.',
    cweId: 'CWE-328',
    owaspCategory: 'A02:2021-Cryptographic-Failures',
    suggestion: 'Use SHA-256 or SHA-3 for hashing. For passwords, use bcrypt, scrypt, or Argon2.',
    fileExtensions: ['.js', '.ts'],
  },
  {
    id: 'js.security.insecure-random',
    name: 'insecure-random',
    pattern: /Math\.random\(\)/,
    severity: 'LOW',
    category: 'security',
    message: 'Math.random() is not cryptographically secure. Do not use for security-sensitive operations.',
    cweId: 'CWE-338',
    owaspCategory: 'A02:2021-Cryptographic-Failures',
    suggestion: 'Use crypto.randomBytes() or crypto.randomUUID() for security-sensitive random values.',
    fileExtensions: ['.js', '.ts', '.jsx', '.tsx'],
  },
  {
    id: 'js.security.unvalidated-redirect',
    name: 'unvalidated-redirect',
    pattern: /(?:res|response)\.redirect\s*\(\s*(?:req|request)\./,
    severity: 'MEDIUM',
    category: 'security',
    message: 'Redirect uses user-controlled input. This could lead to open redirect vulnerabilities.',
    cweId: 'CWE-601',
    owaspCategory: 'A01:2021-Broken-Access-Control',
    suggestion: 'Validate redirect URLs against an allowlist of trusted destinations.',
    fileExtensions: ['.js', '.ts'],
  },
  {
    id: 'js.security.jwt-no-verify',
    name: 'jwt-no-verify',
    pattern: /jwt\.decode\s*\(/,
    severity: 'HIGH',
    category: 'security',
    message: 'jwt.decode() does not verify the signature. Use jwt.verify() to validate tokens.',
    cweId: 'CWE-345',
    owaspCategory: 'A07:2021-Identification-and-Authentication-Failures',
    suggestion: 'Always use jwt.verify() with a secret/public key to validate JWT tokens.',
    fileExtensions: ['.js', '.ts'],
  },
  {
    id: 'js.security.sensitive-data-log',
    name: 'sensitive-data-log',
    pattern: /console\.log\s*\([^)]*(?:password|token|secret|credential|apiKey|api_key)/i,
    severity: 'MEDIUM',
    category: 'security',
    message: 'Sensitive data may be logged to console. Avoid logging secrets, tokens, or credentials.',
    cweId: 'CWE-532',
    owaspCategory: 'A09:2021-Security-Logging-and-Monitoring-Failures',
    suggestion: 'Remove or redact sensitive data from log statements.',
    fileExtensions: ['.js', '.ts', '.jsx', '.tsx'],
  },
];

/**
 * Walk a directory recursively, yielding file paths that match given extensions.
 * Skips node_modules, .git, dist, build, and other non-source directories.
 */
function walkSourceFiles(dir: string, extensions: string[], maxFiles = 500): string[] {
  const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.playwright-mcp', '.features_backups']);
  const files: string[] = [];

  function walk(currentDir: string) {
    if (files.length >= maxFiles) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= maxFiles) return;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          walk(path.join(currentDir, entry.name));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          files.push(path.join(currentDir, entry.name));
        }
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Run built-in JS SAST scanner against a target directory.
 * Scans actual source files with regex-based security rules.
 */
async function runBuiltinSASTScan(
  projectId: string,
  scanPath: string,
  config: SASTConfig
): Promise<SASTFinding[]> {
  const allExtensions = ['.js', '.ts', '.jsx', '.tsx', '.json'];
  const sourceFiles = walkSourceFiles(scanPath, allExtensions);

  logger.info({ fileCount: sourceFiles.length, scanPath }, 'Built-in scanner starting');

  const findings: SASTFinding[] = [];

  for (const filePath of sourceFiles) {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    const relativePath = path.relative(scanPath, filePath);

    // Check if file is in excluded paths
    if (config.excludePaths?.some(ep => relativePath.startsWith(ep))) {
      continue;
    }

    for (const rule of BUILTIN_SAST_RULES) {
      // Check if rule applies to this file extension
      if (rule.fileExtensions && rule.fileExtensions.length > 0) {
        const ext = path.extname(filePath);
        if (!rule.fileExtensions.includes(ext)) continue;
      }

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx]!;
        const match = rule.pattern.exec(line);
        if (match) {
          findings.push({
            id: generateId(),
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            category: rule.category,
            message: rule.message,
            filePath: relativePath,
            line: lineIdx + 1,
            column: match.index + 1,
            endLine: lineIdx + 1,
            endColumn: match.index + match[0].length + 1,
            snippet: line.trim(),
            cweId: rule.cweId,
            owaspCategory: rule.owaspCategory,
            suggestion: rule.suggestion,
          });
        }
      }
    }
  }

  logger.info({ findingCount: findings.length }, 'Built-in scanner completed');

  // Filter by severity threshold
  const severityOrder: Record<SASTSeverity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const threshold = severityOrder[config.severityThreshold];
  const filteredByThreshold = findings.filter(f => severityOrder[f.severity] >= threshold);

  // Mark findings that are false positives
  const projectFPs = await getFalsePositives(projectId);
  return filteredByThreshold.map(finding => {
    const isFP = projectFPs.some(fp =>
      fp.ruleId === finding.ruleId &&
      fp.filePath === finding.filePath &&
      fp.line === finding.line
    );
    return { ...finding, isFalsePositive: isFP };
  });
}

/**
 * Register core SAST routes
 */
export async function coreRoutes(app: FastifyInstance) {
  // Get SAST configuration for a project
  app.get<{ Params: { projectId: string } }>('/api/v1/projects/:projectId/sast/config', {
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
    return { config };
  });

  // Update SAST configuration for a project
  app.put<{ Params: { projectId: string }; Body: Partial<SASTConfig> }>('/api/v1/projects/:projectId/sast/config', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const user = request.user as JwtPayload;
    const updates = request.body;

    // Check permissions (only developers or higher can modify)
    if (user.role === 'viewer') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Viewers cannot modify SAST configuration' });
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
      'sast_config_update',
      'project',
      projectId,
      project.name,
      {
        enabled: config.enabled,
        ruleset: config.ruleset,
        severityThreshold: config.severityThreshold,
      }
    );

    return { config };
  });

  // Get available Semgrep rulesets
  app.get('/api/v1/sast/rulesets', {
    preHandler: [authenticate],
  }, async () => {
    return {
      rulesets: [
        { id: 'default', name: 'Default', description: 'General security and code quality rules' },
        { id: 'security', name: 'Security Audit', description: 'Comprehensive security vulnerability detection' },
        { id: 'owasp', name: 'OWASP Top 10', description: 'Rules targeting OWASP Top 10 vulnerabilities' },
        { id: 'secrets', name: 'Secrets Detection', description: 'Detect hardcoded secrets and credentials' },
        { id: 'ci', name: 'CI/CD', description: 'Optimized ruleset for CI/CD pipelines' },
      ],
    };
  });

  // Trigger a SAST scan for a project
  app.post<{ Params: { projectId: string }; Body: { branch?: string } }>('/api/v1/projects/:projectId/sast/scan', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const { branch = 'main' } = request.body || {};
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

    // Create scan record (use UUID for DB compatibility)
    const scanId = crypto.randomUUID();
    const scan: SASTScanResult = {
      id: scanId,
      projectId,
      branch,
      status: 'running',
      startedAt: new Date().toISOString(),
      findings: [],
      summary: {
        total: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        byCategory: {},
      },
    };

    // Store scan via async DB
    await createSastScan(scan);

    // Update config with scan status
    await updateSASTConfig(projectId, { lastScanAt: scan.startedAt, lastScanStatus: 'running' });

    // Determine scan path: use SAST_SCAN_PATH env, or the project cwd
    const scanPath = process.env.SAST_SCAN_PATH || process.cwd();

    // Run scan asynchronously
    (async () => {
      try {
        const findings = await runSemgrepScan(projectId, scanPath, config);

        // Calculate summary
        const summary = {
          total: findings.length,
          bySeverity: {
            critical: findings.filter(f => f.severity === 'CRITICAL').length,
            high: findings.filter(f => f.severity === 'HIGH').length,
            medium: findings.filter(f => f.severity === 'MEDIUM').length,
            low: findings.filter(f => f.severity === 'LOW').length,
          },
          byCategory: findings.reduce((acc, f) => {
            acc[f.category] = (acc[f.category] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        };

        // Update scan result in memory and persist to DB
        scan.status = 'completed';
        scan.completedAt = new Date().toISOString();
        scan.findings = findings;
        scan.summary = summary;

        await updateSastScan(scanId, {
          status: 'completed',
          completedAt: scan.completedAt,
          findings,
          summary,
        });
        await updateSASTConfig(projectId, { lastScanStatus: 'completed' });
        logger.info({ scanId, findingCount: findings.length }, 'SAST scan completed');
      } catch (error) {
        scan.status = 'failed';
        scan.completedAt = new Date().toISOString();
        scan.error = error instanceof Error ? error.message : 'Unknown error';

        await updateSastScan(scanId, {
          status: 'failed',
          completedAt: scan.completedAt,
          error: scan.error,
        });
        await updateSASTConfig(projectId, { lastScanStatus: 'failed' });
        logger.error({ scanId, error: scan.error }, 'SAST scan failed');
      }
    })();

    // Log audit entry
    logAuditEntry(
      request,
      'sast_scan_triggered',
      'project',
      projectId,
      project.name,
      { scanId, branch }
    );

    return {
      message: 'SAST scan started',
      scanId,
      status: 'running',
    };
  });

  // ========== Organization-wide Security Dashboard ==========

  /**
   * Get all SAST findings across all projects in the organization.
   * Feature #86: Optimized to prevent memory overflow by using:
   * - Database-level pagination with LIMIT/OFFSET
   * - Efficient queries using DISTINCT ON for latest scans
   * - Summary calculation without loading all findings into memory
   */
  app.get<{
    Querystring: {
      severity?: string;
      category?: string;
      sortBy?: 'date' | 'severity' | 'project';
      sortOrder?: 'asc' | 'desc';
      limit?: string;
      offset?: string;
    };
  }>('/api/v1/sast/dashboard', {
    preHandler: [authenticate],
  }, async (request, _reply) => {
    const user = request.user as JwtPayload;
    const {
      severity,
      category,
      sortBy = 'date',
      sortOrder = 'desc',
      limit = '50',
      offset = '0',
    } = request.query;

    // Parse and validate pagination params - enforce max limit to prevent memory issues
    const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
    const offsetNum = parseInt(offset, 10) || 0;

    // Parse filters
    const severityFilter = severity ? severity.toUpperCase().split(',') : undefined;
    const categoryFilter = category ? category.toLowerCase().split(',') : undefined;

    // Get all projects in the user's organization
    const orgProjectsList = await listProjects(user.organization_id);
    const projectIds = orgProjectsList.map(p => p.id);
    const projectMap = new Map(orgProjectsList.map(p => [p.id, { name: p.name, slug: p.slug }]));

    // Get summary stats using optimized aggregation
    const summary = await getDashboardSummary(projectIds, severityFilter, categoryFilter);

    // Get paginated findings
    const { findings, total } = await getDashboardFindings(projectIds, projectMap, {
      severityFilter,
      categoryFilter,
      sortBy: sortBy as 'date' | 'severity' | 'project',
      sortOrder: sortOrder as 'asc' | 'desc',
      limit: limitNum,
      offset: offsetNum,
    });

    return {
      findings,
      summary,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      },
    };
  });

  // Get SAST trend data over time
  app.get<{
    Querystring: {
      days?: string;
    };
  }>('/api/v1/sast/trends', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const days = parseInt(request.query.days || '30', 10);

    // Get all projects in the user's organization
    const orgProjectsList2 = await listProjects(user.organization_id);
    const orgProjects = orgProjectsList2.map(p => ({ id: p.id, name: p.name }));

    // Collect all completed scans from all projects
    interface ScanDataPoint {
      date: string;
      scanId: string;
      projectId: string;
      projectName: string;
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    }

    const allScans: ScanDataPoint[] = [];

    for (const project of orgProjects) {
      const projectScans = await getSastScansByProject(project.id);
      for (const scan of projectScans) {
        if (scan.status === 'completed' && scan.completedAt) {
          allScans.push({
            date: scan.completedAt,
            scanId: scan.id,
            projectId: project.id,
            projectName: project.name,
            total: scan.summary.total,
            critical: scan.summary.bySeverity.critical,
            high: scan.summary.bySeverity.high,
            medium: scan.summary.bySeverity.medium,
            low: scan.summary.bySeverity.low,
          });
        }
      }
    }

    // Sort by date ascending
    allScans.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Filter to requested time range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const filteredScans = allScans.filter(s => new Date(s.date) >= cutoffDate);

    // Aggregate by day for the chart
    const dailyTrends: Record<string, {
      date: string;
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
      scanCount: number;
    }> = {};

    for (const scan of filteredScans) {
      const dateKey = new Date(scan.date).toISOString().split('T')[0] ?? ''; // YYYY-MM-DD
      if (!dailyTrends[dateKey]) {
        dailyTrends[dateKey] = {
          date: dateKey,
          total: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          scanCount: 0,
        };
      }
      // Use the latest scan values for the day (cumulative view)
      const dayTrend = dailyTrends[dateKey]!;
      dayTrend.total = scan.total;
      dayTrend.critical = scan.critical;
      dayTrend.high = scan.high;
      dayTrend.medium = scan.medium;
      dayTrend.low = scan.low;
      dayTrend.scanCount++;
    }

    // Convert to array and sort by date
    const trendData = Object.values(dailyTrends).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate overall stats
    const lastScan = filteredScans[filteredScans.length - 1];
    const latestTotals = lastScan
      ? {
          total: lastScan.total,
          critical: lastScan.critical,
          high: lastScan.high,
          medium: lastScan.medium,
          low: lastScan.low,
        }
      : { total: 0, critical: 0, high: 0, medium: 0, low: 0 };

    const firstScan = filteredScans[0];
    const firstTotals = firstScan
      ? {
          total: firstScan.total,
          critical: firstScan.critical,
          high: firstScan.high,
          medium: firstScan.medium,
          low: firstScan.low,
        }
      : { total: 0, critical: 0, high: 0, medium: 0, low: 0 };

    // Calculate change percentages
    const calculateChange = (latest: number, first: number) => {
      if (first === 0) return latest > 0 ? 100 : 0;
      return Math.round(((latest - first) / first) * 100);
    };

    return {
      trends: trendData,
      summary: {
        totalScans: filteredScans.length,
        latestFindings: latestTotals,
        changes: {
          total: calculateChange(latestTotals.total, firstTotals.total),
          critical: calculateChange(latestTotals.critical, firstTotals.critical),
          high: calculateChange(latestTotals.high, firstTotals.high),
          medium: calculateChange(latestTotals.medium, firstTotals.medium),
          low: calculateChange(latestTotals.low, firstTotals.low),
        },
      },
      scans: filteredScans,
    };
  });

  // Get scan results for a project
  app.get<{ Params: { projectId: string }; Querystring: { limit?: string } }>('/api/v1/projects/:projectId/sast/scans', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const limit = parseInt(request.query.limit || '10', 10);
    const user = request.user as JwtPayload;

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    const allScans = await getSastScansByProject(projectId);
    const scans = allScans.slice(0, limit);
    return { scans };
  });

  // Get a specific scan result
  app.get<{ Params: { projectId: string; scanId: string } }>('/api/v1/projects/:projectId/sast/scans/:scanId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId, scanId } = request.params;
    const user = request.user as JwtPayload;

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    const scan = await getSastScan(scanId);

    if (!scan) {
      return reply.status(404).send({ error: 'Not Found', message: 'Scan not found' });
    }

    return { scan };
  });
}
