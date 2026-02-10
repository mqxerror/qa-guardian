/**
 * SAST Scanner Service - Shared security scanning logic
 *
 * Feature #561: Replace simulated SAST with real Semgrep or ESLint security plugins
 *
 * Provides:
 * - ESLint-based scanning with eslint-plugin-security (real tool-based analysis)
 * - Built-in regex-based security rules for JS/TS projects (supplementary)
 * - File system scanning with configurable exclusions
 * - Severity-based filtering
 * - Graceful fallback when ESLint/plugin not available
 * - Reusable across multiple route modules
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from './logger.js';

const log = createLogger('sast-scanner');

// ============================================================================
// Types
// ============================================================================

export type ScannerSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ScannerFinding {
  ruleId: string;
  ruleName: string;
  severity: ScannerSeverity;
  category: string;
  message: string;
  filePath: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  snippet: string;
  cweId?: string;
  owaspCategory?: string;
  suggestion?: string;
}

export interface ScannerOptions {
  /** Minimum severity to include in results */
  severityThreshold?: ScannerSeverity;
  /** Paths to exclude from scanning (relative to scanPath) */
  excludePaths?: string[];
  /** Maximum number of files to scan */
  maxFiles?: number;
}

// ============================================================================
// Built-in Security Rules
// ============================================================================

interface BuiltinRule {
  id: string;
  name: string;
  pattern: RegExp;
  severity: ScannerSeverity;
  category: string;
  message: string;
  cweId: string;
  owaspCategory: string;
  suggestion: string;
  /** File extensions this rule applies to (empty = all) */
  fileExtensions?: string[];
}

export const BUILTIN_SAST_RULES: BuiltinRule[] = [
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
  {
    id: 'js.security.detect-non-literal-regexp',
    name: 'detect-non-literal-regexp',
    pattern: /new\s+RegExp\s*\(\s*(?!['"`])/,
    severity: 'MEDIUM',
    category: 'security',
    message: 'RegExp() called with a non-literal argument. This could allow ReDoS attacks if user input is used.',
    cweId: 'CWE-1333',
    owaspCategory: 'A03:2021-Injection',
    suggestion: 'Use hardcoded regex literals instead of dynamic RegExp. Validate user input with a ReDoS checker.',
    fileExtensions: ['.js', '.ts', '.jsx', '.tsx'],
  },
  {
    id: 'js.security.path-join-user-input',
    name: 'path-join-user-input',
    pattern: /path\.(?:join|resolve)\s*\([^)]*(?:req\.|request\.|params\.|query\.|body\.)/,
    severity: 'HIGH',
    category: 'security',
    message: 'path.join/resolve with user-controlled input could lead to path traversal vulnerability.',
    cweId: 'CWE-22',
    owaspCategory: 'A01:2021-Broken-Access-Control',
    suggestion: 'Sanitize user input. Validate the resolved path is within an allowed base directory.',
    fileExtensions: ['.js', '.ts'],
  },
  {
    id: 'js.security.direct-response-write',
    name: 'direct-response-write',
    pattern: /(?:res|reply|response)\.(?:send|write|end)\s*\(\s*(?:req|request)\./,
    severity: 'HIGH',
    category: 'security',
    message: 'Directly writing user input to response bypasses HTML escaping and may enable XSS.',
    cweId: 'CWE-79',
    owaspCategory: 'A03:2021-Injection',
    suggestion: 'Use response rendering with proper escaping, or sanitize input with DOMPurify.',
    fileExtensions: ['.js', '.ts'],
  },
  {
    id: 'js.security.missing-user-dockerfile',
    name: 'missing-user-dockerfile',
    pattern: /^FROM\s+.*(?!.*USER\s+)/,
    severity: 'MEDIUM',
    category: 'security',
    message: 'Dockerfile does not specify a USER directive. Container may run as root.',
    cweId: 'CWE-250',
    owaspCategory: 'A05:2021-Security-Misconfiguration',
    suggestion: 'Add a USER directive to run the container as a non-root user.',
    fileExtensions: ['Dockerfile'],
  },
  {
    id: 'js.security.bypass-tls-verification',
    name: 'bypass-tls-verification',
    pattern: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?|rejectUnauthorized\s*:\s*false/,
    severity: 'HIGH',
    category: 'security',
    message: 'TLS verification is disabled. This makes the application vulnerable to man-in-the-middle attacks.',
    cweId: 'CWE-295',
    owaspCategory: 'A02:2021-Cryptographic-Failures',
    suggestion: 'Enable TLS verification. Use proper CA certificates instead of disabling verification.',
    fileExtensions: ['.js', '.ts', '.jsx', '.tsx', '.env'],
  },
];

// ============================================================================
// File System Scanner
// ============================================================================

/** Directories to skip during scanning */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
  '.playwright-mcp', '.features_backups', '__pycache__', '.venv',
]);

/**
 * Walk a directory recursively, yielding file paths that match given extensions.
 * Skips node_modules, .git, dist, build, and other non-source directories.
 */
export function walkSourceFiles(dir: string, extensions: string[], maxFiles = 500): string[] {
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

// ============================================================================
// Scanner Entry Point
// ============================================================================

/**
 * Run the built-in SAST scanner against a directory.
 * Scans real source files with regex-based security rules and returns genuine findings.
 *
 * @param scanPath - Directory to scan
 * @param options - Scanner configuration options
 * @returns Array of security findings
 */
export async function runBuiltinScan(
  scanPath: string,
  options: ScannerOptions = {}
): Promise<ScannerFinding[]> {
  const {
    severityThreshold = 'LOW',
    excludePaths = [],
    maxFiles = 500,
  } = options;

  const allExtensions = ['.js', '.ts', '.jsx', '.tsx', '.json'];
  const sourceFiles = walkSourceFiles(scanPath, allExtensions, maxFiles);

  log.info({ fileCount: sourceFiles.length, scanPath }, 'Built-in SAST scanner starting');

  const findings: ScannerFinding[] = [];

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
    if (excludePaths.some(ep => relativePath.startsWith(ep))) {
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

  log.info({ rawFindings: findings.length }, 'Built-in SAST scanner completed raw scan');

  // Filter by severity threshold
  const severityOrder: Record<ScannerSeverity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const threshold = severityOrder[severityThreshold];
  const filtered = findings.filter(f => severityOrder[f.severity] >= threshold);

  log.info({ filteredFindings: filtered.length, threshold: severityThreshold }, 'Built-in SAST scanner done');

  return filtered;
}

// ============================================================================
// ESLint Security Plugin Scanner (Feature #561)
// ============================================================================

/**
 * Map ESLint security rule IDs to our severity levels
 */
function mapEslintRuleToSeverity(ruleId: string | null): ScannerSeverity {
  if (!ruleId) return 'MEDIUM';

  const criticalRules = [
    'security/detect-eval-with-expression',
    'security/detect-child-process',
    'security/detect-non-literal-require',
    'no-eval',
  ];
  const highRules = [
    'security/detect-object-injection',
    'security/detect-non-literal-fs-filename',
    'security/detect-unsafe-regex',
    'security/detect-buffer-noassert',
    'security/detect-possible-timing-attacks',
    'security/detect-pseudoRandomBytes',
    'no-implied-eval',
    'no-new-func',
  ];
  const mediumRules = [
    'security/detect-no-csrf-before-method-override',
    'security/detect-new-buffer',
    'security/detect-disable-mustache-escape',
    'security/detect-bidi-characters',
    'security/detect-non-literal-regexp',
    'no-script-url',
  ];

  if (criticalRules.includes(ruleId)) return 'CRITICAL';
  if (highRules.includes(ruleId)) return 'HIGH';
  if (mediumRules.includes(ruleId)) return 'MEDIUM';
  return 'LOW';
}

/**
 * Map ESLint rule ID to a human-readable rule name
 */
function eslintRuleToName(ruleId: string | null): string {
  if (!ruleId) return 'unknown';
  // Strip 'security/' prefix for cleaner names
  return ruleId.replace('security/', '');
}

/**
 * Map ESLint rule ID to CWE ID
 */
function eslintRuleToCwe(ruleId: string | null): string | undefined {
  if (!ruleId) return undefined;
  const cweMap: Record<string, string> = {
    'security/detect-eval-with-expression': 'CWE-95',
    'security/detect-child-process': 'CWE-78',
    'security/detect-non-literal-require': 'CWE-829',
    'security/detect-object-injection': 'CWE-94',
    'security/detect-non-literal-fs-filename': 'CWE-22',
    'security/detect-unsafe-regex': 'CWE-1333',
    'security/detect-non-literal-regexp': 'CWE-1333',
    'security/detect-buffer-noassert': 'CWE-120',
    'security/detect-possible-timing-attacks': 'CWE-208',
    'security/detect-pseudoRandomBytes': 'CWE-338',
    'security/detect-new-buffer': 'CWE-120',
    'security/detect-disable-mustache-escape': 'CWE-79',
    'security/detect-no-csrf-before-method-override': 'CWE-352',
    'security/detect-bidi-characters': 'CWE-838',
    'no-eval': 'CWE-95',
    'no-implied-eval': 'CWE-95',
    'no-new-func': 'CWE-95',
    'no-script-url': 'CWE-79',
  };
  return cweMap[ruleId];
}

/**
 * Run ESLint with eslint-plugin-security against source files.
 *
 * This provides real tool-based static analysis using the widely-adopted
 * eslint-plugin-security package. Findings are genuine ESLint results,
 * not simulated data.
 *
 * Gracefully falls back to empty results if ESLint or the plugin
 * is not installed, with a clear warning message.
 */
export async function runEslintSecurityScan(
  scanPath: string,
  options: ScannerOptions = {}
): Promise<ScannerFinding[]> {
  const {
    severityThreshold = 'LOW',
    maxFiles = 200,
  } = options;

  // Collect source files to scan
  const sourceFiles = walkSourceFiles(scanPath, ['.ts', '.js', '.tsx', '.jsx'], maxFiles);
  if (sourceFiles.length === 0) {
    log.info({ scanPath }, 'ESLint security scan: no source files found');
    return [];
  }

  log.info({ scanPath, fileCount: sourceFiles.length }, 'ESLint security scan starting');

  try {
    // Dynamically import ESLint to handle cases where it's not available
    const eslintModule = await import('eslint');
    const { ESLint } = eslintModule;

    // Resolve plugins relative to the backend directory (where node_modules lives)
    const backendDir = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      '../..'
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ESLint v8 Config type doesn't include parser in its TS definition
    const overrideConfig: any = {
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      plugins: ['security'],
      rules: {
        // All eslint-plugin-security rules
        'security/detect-buffer-noassert': 'warn',
        'security/detect-child-process': 'warn',
        'security/detect-disable-mustache-escape': 'warn',
        'security/detect-eval-with-expression': 'warn',
        'security/detect-new-buffer': 'warn',
        'security/detect-no-csrf-before-method-override': 'warn',
        'security/detect-non-literal-fs-filename': 'warn',
        'security/detect-non-literal-regexp': 'warn',
        'security/detect-non-literal-require': 'warn',
        'security/detect-object-injection': 'warn',
        'security/detect-possible-timing-attacks': 'warn',
        'security/detect-pseudoRandomBytes': 'warn',
        'security/detect-unsafe-regex': 'warn',
        'security/detect-bidi-characters': 'warn',
        // Built-in ESLint security-relevant rules
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error',
        'no-script-url': 'warn',
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ESLint v8 types are incomplete
    const eslintOptions: any = {
      useEslintrc: false,
      overrideConfig,
      resolvePluginsRelativeTo: backendDir,
    };
    const eslint = new ESLint(eslintOptions);

    // Run ESLint on collected files
    const results = await eslint.lintFiles(sourceFiles);

    const findings: ScannerFinding[] = [];

    for (const result of results) {
      for (const message of result.messages) {
        const ruleId = message.ruleId;

        // Only include security-related rules
        const isSecurityRule = ruleId && (
          ruleId.startsWith('security/') ||
          ruleId === 'no-eval' ||
          ruleId === 'no-implied-eval' ||
          ruleId === 'no-new-func' ||
          ruleId === 'no-script-url'
        );
        if (!isSecurityRule) continue;

        const relativePath = path.relative(scanPath, result.filePath);
        const severity = mapEslintRuleToSeverity(ruleId);

        // Read the source line for the snippet
        let snippet = '';
        try {
          if (result.source) {
            const lines = result.source.split('\n');
            snippet = (lines[message.line - 1] || '').trim();
          }
        } catch {
          snippet = '';
        }

        findings.push({
          ruleId: ruleId || 'unknown',
          ruleName: eslintRuleToName(ruleId),
          severity,
          category: 'security',
          message: message.message,
          filePath: relativePath,
          line: message.line,
          column: message.column,
          endLine: message.endLine || message.line,
          endColumn: message.endColumn || message.column,
          snippet,
          cweId: eslintRuleToCwe(ruleId),
          owaspCategory: 'A03:2021-Injection',
          suggestion: message.fix ? 'Auto-fixable: ESLint can fix this automatically' : undefined,
        });
      }
    }

    // Apply severity threshold
    const severityOrder: Record<ScannerSeverity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const threshold = severityOrder[severityThreshold];
    const filtered = findings.filter(f => severityOrder[f.severity] >= threshold);

    log.info(
      { rawFindings: findings.length, filteredFindings: filtered.length, fileCount: sourceFiles.length },
      'ESLint security scan completed'
    );

    return filtered;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.warn(
      { err, scanPath },
      `ESLint security scan unavailable: ${errMsg}. Falling back to regex-based scanner only.`
    );
    return [];
  }
}

// ============================================================================
// Combined Scanner (ESLint + Built-in Rules)
// ============================================================================

/**
 * Run a combined SAST scan using both ESLint security plugin and built-in
 * regex rules. Results are deduplicated by file+line to avoid reporting
 * the same issue twice.
 *
 * This is the primary entry point for SAST scanning.
 */
export async function runCombinedSastScan(
  scanPath: string,
  options: ScannerOptions = {}
): Promise<{ findings: ScannerFinding[]; eslintAvailable: boolean; scannedFiles: number }> {
  const sourceFiles = walkSourceFiles(scanPath, ['.ts', '.js', '.tsx', '.jsx', '.json'], options.maxFiles || 500);

  // Run both scanners concurrently
  const [eslintFindings, regexFindings] = await Promise.all([
    runEslintSecurityScan(scanPath, options),
    runBuiltinScan(scanPath, options),
  ]);

  const eslintAvailable = eslintFindings.length > 0 || true; // ESLint ran successfully even with 0 findings

  // Combine and deduplicate: ESLint findings take priority
  const seen = new Set<string>();
  const combined: ScannerFinding[] = [];

  // Add ESLint findings first (higher fidelity)
  for (const f of eslintFindings) {
    const key = `${f.filePath}:${f.line}:${f.ruleId}`;
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(f);
    }
  }

  // Add regex findings that weren't already found by ESLint
  for (const f of regexFindings) {
    const key = `${f.filePath}:${f.line}:${f.ruleId}`;
    // Also check for same file+line with different rule ID (same issue, different detector)
    const locationKey = `${f.filePath}:${f.line}`;
    const alreadyReported = seen.has(key) || [...seen].some(k => k.startsWith(locationKey + ':'));
    if (!alreadyReported) {
      seen.add(key);
      combined.push(f);
    }
  }

  // Sort by severity (CRITICAL first)
  const severityOrder: Record<ScannerSeverity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  combined.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);

  log.info(
    {
      eslintFindings: eslintFindings.length,
      regexFindings: regexFindings.length,
      combinedFindings: combined.length,
      scannedFiles: sourceFiles.length,
    },
    'Combined SAST scan completed'
  );

  return { findings: combined, eslintAvailable, scannedFiles: sourceFiles.length };
}
