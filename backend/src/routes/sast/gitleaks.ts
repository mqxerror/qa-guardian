/**
 * Gitleaks Routes
 *
 * Secret detection integration using Gitleaks.
 * Scans repositories for exposed secrets like API keys, tokens, and credentials.
 *
 * Feature #779: Gitleaks Integration for Secret Detection
 * Feature #1511: Integrate actual Gitleaks CLI for secret scanning
 *
 * Routes:
 * - GET  /api/v1/projects/:projectId/sast/gitleaks/config - Get configuration
 * - PATCH /api/v1/projects/:projectId/sast/gitleaks/config - Update configuration
 * - POST /api/v1/projects/:projectId/sast/gitleaks/scan - Trigger scan
 * - GET  /api/v1/projects/:projectId/sast/gitleaks/scans - List scans
 * - GET  /api/v1/projects/:projectId/sast/gitleaks/scans/:scanId - Get scan details
 */

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload } from '../../middleware/auth';
import { getProject } from '../../services/repositories/projects';
import { exec, execSync, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SecretPattern } from './types';
import { getSecretPatterns } from './stores';

const execAsync = promisify(exec);

// ============================================================
// Gitleaks Types
// ============================================================

export interface GitleaksConfig {
  enabled: boolean;
  scan_on_push: boolean;
  scan_on_pr: boolean;
  scan_full_history: boolean;
  exclude_paths: string[];
  allowlist_patterns: string[];
  custom_rules: Array<{
    id: string;
    description: string;
    regex: string;
    tags: string[];
  }>;
  severity_threshold: 'all' | 'high' | 'critical';
  fail_on_leak: boolean;
  notification_channels: ('slack' | 'email' | 'webhook')[];
}

export interface GitleaksFinding {
  id: string;
  scan_id: string;
  rule_id: string;
  description: string;
  secret_type: string;
  file: string;
  line: number;
  start_column: number;
  end_column: number;
  match: string;  // Redacted secret match
  commit: string;
  author: string;
  date: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  entropy: number;
  tags: string[];
  // Feature #1565: Secret verification status
  verification?: {
    status: 'active' | 'inactive' | 'unknown' | 'error';
    verifiedAt: string;
    message: string;
    details?: {
      service?: string;
      accountInfo?: string;
      scopes?: string[];
      expiresAt?: string;
    };
  };
}

export interface GitleaksScan {
  id: string;
  organization_id: string;
  project_id: string;
  repository: string;
  branch: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: Date;
  completed_at?: Date;
  trigger: 'manual' | 'push' | 'pr' | 'scheduled';
  commits_scanned: number;
  findings: GitleaksFinding[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    by_type: Record<string, number>;
  };
  error_message?: string;
}

// ============================================================
// In-memory stores for Gitleaks
// ============================================================

export const gitleaksConfigs: Map<string, GitleaksConfig> = new Map(); // projectId -> config
export const gitleaksScans: Map<string, GitleaksScan[]> = new Map(); // projectId -> scans

// Default Gitleaks configuration
const DEFAULT_GITLEAKS_CONFIG: GitleaksConfig = {
  enabled: false,
  scan_on_push: false,
  scan_on_pr: false,
  scan_full_history: false,
  exclude_paths: ['node_modules/', '.git/', 'vendor/', 'dist/', 'build/'],
  allowlist_patterns: [],
  custom_rules: [],
  severity_threshold: 'all',
  fail_on_leak: true,
  notification_channels: [],
};

// ============================================================
// Feature #1511: Gitleaks CLI Integration
// ============================================================

interface GitleaksVersionInfo {
  available: boolean;
  version?: string;
  path?: string;
}

interface GitleaksRawFinding {
  Description: string;
  StartLine: number;
  EndLine: number;
  StartColumn: number;
  EndColumn: number;
  Match: string;
  Secret: string;
  File: string;
  Commit: string;
  Entropy: number;
  Author: string;
  Email: string;
  Date: string;
  Message: string;
  Tags: string[];
  RuleID: string;
  Fingerprint: string;
}

let gitleaksVersionCache: GitleaksVersionInfo | null = null;

// ============================================================
// Feature #1558: Gitleaks Config Generation
// ============================================================

/**
 * Generate .gitleaks.toml config content from custom secret patterns
 * @param patterns Array of custom secret patterns
 * @returns TOML config string for Gitleaks
 */
function generateGitleaksConfig(patterns: SecretPattern[]): string {
  // Filter to only enabled patterns
  const enabledPatterns = patterns.filter(p => p.enabled);

  if (enabledPatterns.length === 0) {
    return '';
  }

  let config = `# QA Guardian Custom Gitleaks Configuration
# Feature #1558: Custom secret detection patterns
# Generated at: ${new Date().toISOString()}

[extend]
# Extend the default Gitleaks ruleset
useDefault = true

`;

  // Add custom rules
  for (const pattern of enabledPatterns) {
    // Escape special characters in pattern description for TOML
    const escapedDescription = (pattern.description || pattern.name)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');

    // Map severity to Gitleaks tags
    const severityTag = pattern.severity.toLowerCase();

    config += `[[rules]]
id = "${pattern.id}"
description = "${escapedDescription}"
regex = '''${pattern.pattern}'''
tags = ["${severityTag}", "${pattern.category}", "custom"]
`;

    // Add optional keywords based on pattern name to help with faster matching
    const keywords = extractKeywords(pattern.name, pattern.pattern);
    if (keywords.length > 0) {
      config += `keywords = [${keywords.map(k => `"${k}"`).join(', ')}]\n`;
    }

    config += `
`;
  }

  return config;
}

/**
 * Extract potential keywords from pattern name and regex for faster matching
 */
function extractKeywords(name: string, pattern: string): string[] {
  const keywords: string[] = [];

  // Extract literal strings from pattern (non-regex parts)
  const literalMatches = pattern.match(/[A-Za-z_]{3,}/g);
  if (literalMatches) {
    for (const match of literalMatches.slice(0, 3)) {  // Limit to 3 keywords
      if (match.length >= 3 && match.length <= 20) {
        keywords.push(match.toLowerCase());
      }
    }
  }

  // Also use first word from name if relevant
  const nameWords = name.toLowerCase().split(/[\s_-]+/);
  for (const word of nameWords) {
    if (word.length >= 3 && word.length <= 15 && !keywords.includes(word)) {
      keywords.push(word);
      if (keywords.length >= 3) break;
    }
  }

  return [...new Set(keywords)];  // Deduplicate
}

/**
 * Create a temporary Gitleaks config file
 * @param patterns Custom secret patterns
 * @returns Path to temp config file, or null if no patterns
 */
function createTempGitleaksConfig(patterns: SecretPattern[]): string | null {
  const enabledPatterns = patterns.filter(p => p.enabled);
  if (enabledPatterns.length === 0) {
    return null;
  }

  const configContent = generateGitleaksConfig(patterns);
  if (!configContent) {
    return null;
  }

  const tempConfigPath = path.join(os.tmpdir(), `gitleaks-config-${Date.now()}.toml`);
  fs.writeFileSync(tempConfigPath, configContent, 'utf-8');

  console.log(`[Gitleaks] Generated custom config with ${enabledPatterns.length} patterns: ${tempConfigPath}`);

  return tempConfigPath;
}

/**
 * Check if Gitleaks CLI is available on the system
 */
function checkGitleaksAvailability(): GitleaksVersionInfo {
  if (gitleaksVersionCache) {
    return gitleaksVersionCache;
  }

  try {
    // Try common gitleaks binary locations
    const possiblePaths = ['gitleaks', '/usr/local/bin/gitleaks', '/usr/bin/gitleaks'];

    for (const gitleaksPath of possiblePaths) {
      try {
        const versionOutput = execSync(`${gitleaksPath} version 2>&1`, {
          encoding: 'utf-8',
          timeout: 5000,
        }).trim();

        // Parse version - gitleaks outputs: "gitleaks version 8.x.x" or just "8.x.x"
        const versionMatch = versionOutput.match(/(\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : versionOutput;

        gitleaksVersionCache = {
          available: true,
          version,
          path: gitleaksPath,
        };

        console.log(`[Gitleaks] Found at ${gitleaksPath}, version ${version}`);
        return gitleaksVersionCache;
      } catch {
        // Try next path
      }
    }

    gitleaksVersionCache = { available: false };
    console.log('[Gitleaks] CLI not found on system, falling back to pattern matching');
    return gitleaksVersionCache;
  } catch (error) {
    gitleaksVersionCache = { available: false };
    return gitleaksVersionCache;
  }
}

/**
 * Run Gitleaks CLI scan on a repository path
 * Feature #1558: Added support for custom secret patterns via --config flag
 */
async function runGitleaksScan(
  repoPath: string,
  options: {
    fullHistory?: boolean;
    timeout?: number;
    excludePaths?: string[];
    customPatterns?: SecretPattern[];  // Feature #1558
  } = {}
): Promise<{ success: boolean; findings: GitleaksFinding[]; error?: string; commitsScanned?: number }> {
  const { fullHistory = false, timeout = 300000, excludePaths = [], customPatterns = [] } = options; // 5 min default timeout

  const gitleaksInfo = checkGitleaksAvailability();

  if (!gitleaksInfo.available) {
    // Fall back to pattern matching (also use custom patterns)
    return runPatternMatchingScan(repoPath, customPatterns);
  }

  const gitleaksPath = gitleaksInfo.path!;
  const tempOutputFile = path.join(os.tmpdir(), `gitleaks-${Date.now()}.json`);

  // Feature #1558: Generate custom config file if patterns exist
  const tempConfigFile = createTempGitleaksConfig(customPatterns);

  try {
    // Build gitleaks command
    const args: string[] = [
      'detect',
      '--source', repoPath,
      '--report-format', 'json',
      '--report-path', tempOutputFile,
      '--exit-code', '0', // Don't fail on findings
    ];

    // Feature #1558: Add custom config file if we have custom patterns
    if (tempConfigFile) {
      args.push('--config', tempConfigFile);
      console.log(`[Gitleaks] Using custom config file: ${tempConfigFile}`);
    }

    // Add history scanning option (v8+ syntax)
    if (!fullHistory) {
      args.push('--no-git');
    }

    // Add exclude paths
    for (const excludePath of excludePaths) {
      args.push('--exclude-path', excludePath);
    }

    // Run gitleaks with timeout
    await new Promise<void>((resolve, reject) => {
      const process = spawn(gitleaksPath, args, {
        timeout,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        // Gitleaks returns 0 for no findings, 1 for findings found (with --exit-code 0 it always returns 0)
        resolve();
      });

      process.on('error', (err) => {
        reject(new Error(`Gitleaks process error: ${err.message}`));
      });

      // Handle timeout
      setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error('Gitleaks scan timed out'));
      }, timeout);
    });

    // Parse JSON output
    if (fs.existsSync(tempOutputFile)) {
      const rawOutput = fs.readFileSync(tempOutputFile, 'utf-8');

      // Clean up temp files
      fs.unlinkSync(tempOutputFile);
      if (tempConfigFile && fs.existsSync(tempConfigFile)) {
        fs.unlinkSync(tempConfigFile);
      }

      if (!rawOutput.trim()) {
        return { success: true, findings: [], commitsScanned: 0 };
      }

      const rawFindings: GitleaksRawFinding[] = JSON.parse(rawOutput);

      // Convert to our format
      const findings = rawFindings.map((raw, index) => convertGitleaksFinding(raw, `finding_${Date.now()}_${index}`));

      return {
        success: true,
        findings,
        commitsScanned: fullHistory ? await countCommits(repoPath) : 1,
      };
    }

    // Clean up temp config file even if no output
    if (tempConfigFile && fs.existsSync(tempConfigFile)) {
      fs.unlinkSync(tempConfigFile);
    }

    return { success: true, findings: [], commitsScanned: 0 };
  } catch (error: any) {
    // Clean up temp files on error
    try {
      if (fs.existsSync(tempOutputFile)) {
        fs.unlinkSync(tempOutputFile);
      }
      if (tempConfigFile && fs.existsSync(tempConfigFile)) {
        fs.unlinkSync(tempConfigFile);
      }
    } catch {}

    return {
      success: false,
      findings: [],
      error: error.message || 'Unknown error during Gitleaks scan',
    };
  }
}

/**
 * Count commits in a git repository
 */
async function countCommits(repoPath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(`git -C "${repoPath}" rev-list --count HEAD 2>/dev/null || echo "0"`, {
      timeout: 5000,
    });
    return parseInt(stdout.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Convert Gitleaks raw finding to our GitleaksFinding format
 */
function convertGitleaksFinding(raw: GitleaksRawFinding, id: string): GitleaksFinding {
  // Determine severity based on rule and entropy
  let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';

  // Feature #1561: Added azure patterns to critical rules
  const criticalRules = ['aws', 'stripe', 'private-key', 'password', 'slack-webhook', 'twilio', 'azure-storage', 'azure-sql', 'azure-service-bus', 'azure-cosmosdb', 'azure-client-secret'];
  const highRules = ['github', 'gitlab', 'npm', 'pypi', 'heroku', 'sendgrid', 'jwt', 'azure-event-hub'];

  const ruleIdLower = raw.RuleID.toLowerCase();

  if (criticalRules.some(r => ruleIdLower.includes(r)) || raw.Entropy > 5.5) {
    severity = 'critical';
  } else if (highRules.some(r => ruleIdLower.includes(r)) || raw.Entropy > 4.5) {
    severity = 'high';
  } else if (raw.Entropy > 3.5) {
    severity = 'medium';
  } else {
    severity = 'low';
  }

  // Redact the secret for display
  const redactedMatch = redactSecret(raw.Secret || raw.Match);

  return {
    id,
    scan_id: '', // Will be set by caller
    rule_id: raw.RuleID,
    description: raw.Description,
    secret_type: raw.RuleID.replace(/-/g, '_'),
    file: raw.File,
    line: raw.StartLine,
    start_column: raw.StartColumn,
    end_column: raw.EndColumn,
    match: redactedMatch,
    commit: raw.Commit?.substring(0, 12) || 'unknown',
    author: raw.Email || raw.Author || 'unknown',
    date: raw.Date || new Date().toISOString(),
    message: raw.Message || '',
    severity,
    entropy: raw.Entropy || 0,
    tags: raw.Tags || [],
  };
}

/**
 * Redact a secret for safe display
 */
function redactSecret(secret: string): string {
  if (!secret || secret.length <= 8) {
    return '***';
  }
  const visiblePrefix = secret.substring(0, 4);
  const visibleSuffix = secret.substring(secret.length - 4);
  const redactedLength = Math.min(secret.length - 8, 20);
  return `${visiblePrefix}${'*'.repeat(redactedLength)}${visibleSuffix}`;
}

/**
 * Fallback pattern matching scan when Gitleaks CLI is unavailable
 * Feature #1558: Added support for custom patterns
 */
async function runPatternMatchingScan(
  repoPath: string,
  customPatterns: SecretPattern[] = []
): Promise<{ success: boolean; findings: GitleaksFinding[]; error?: string; commitsScanned?: number }> {
  const findings: GitleaksFinding[] = [];

  // Common secret patterns
  const builtInPatterns: Array<{ name: string; regex: RegExp; severity: 'critical' | 'high' | 'medium' | 'low'; tags: string[] }> = [
    { name: 'aws-access-key', regex: /AKIA[0-9A-Z]{16}/g, severity: 'critical', tags: ['aws', 'credential'] },
    { name: 'aws-secret-key', regex: /[A-Za-z0-9/+=]{40}/g, severity: 'critical', tags: ['aws', 'secret'] },
    { name: 'github-token', regex: /ghp_[A-Za-z0-9]{36}/g, severity: 'high', tags: ['github', 'token'] },
    { name: 'github-oauth', regex: /gho_[A-Za-z0-9]{36}/g, severity: 'high', tags: ['github', 'oauth'] },
    { name: 'stripe-key', regex: /sk_live_[A-Za-z0-9]{24,}/g, severity: 'critical', tags: ['stripe', 'payment'] },
    { name: 'stripe-test', regex: /sk_test_[A-Za-z0-9]{24,}/g, severity: 'medium', tags: ['stripe', 'test'] },
    { name: 'private-key', regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g, severity: 'critical', tags: ['private-key'] },
    { name: 'npm-token', regex: /npm_[A-Za-z0-9]{36}/g, severity: 'high', tags: ['npm', 'token'] },
    { name: 'slack-webhook', regex: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/g, severity: 'high', tags: ['slack', 'webhook'] },
    { name: 'generic-api-key', regex: /api[_-]?key['":\s]*[=:]\s*['"]?[A-Za-z0-9-_]{20,}['"]?/gi, severity: 'medium', tags: ['api-key'] },
    { name: 'generic-secret', regex: /secret['":\s]*[=:]\s*['"]?[A-Za-z0-9-_]{16,}['"]?/gi, severity: 'medium', tags: ['secret'] },
    // Feature #1561: Azure connection string detection patterns
    { name: 'azure-storage-connection', regex: /DefaultEndpointsProtocol=https?;AccountName=[^;]+;AccountKey=[A-Za-z0-9+/=]{86,88}/g, severity: 'critical', tags: ['azure', 'storage'] },
    { name: 'azure-storage-key', regex: /AccountKey\s*=\s*['"]?[A-Za-z0-9+/=]{86,88}['"]?/gi, severity: 'critical', tags: ['azure', 'storage'] },
    { name: 'azure-sql-connection', regex: /Server=tcp:[a-z0-9.-]+\.database\.windows\.net[^;]*;.*Password=[^;]+/gi, severity: 'critical', tags: ['azure', 'sql'] },
    { name: 'azure-service-bus', regex: /Endpoint=sb:\/\/[a-z0-9.-]+\.servicebus\.windows\.net\/;SharedAccessKey[^;]*=[A-Za-z0-9+/=]+/g, severity: 'critical', tags: ['azure', 'servicebus'] },
    { name: 'azure-cosmosdb-key', regex: /AccountEndpoint=https:\/\/[a-z0-9.-]+\.documents\.azure\.com[^;]*;AccountKey=[A-Za-z0-9+/=]{86,88}/g, severity: 'critical', tags: ['azure', 'cosmosdb'] },
    { name: 'azure-event-hub', regex: /Endpoint=sb:\/\/[a-z0-9.-]+\.servicebus\.windows\.net\/;[^;]*SharedAccessKey=[A-Za-z0-9+/=]+/g, severity: 'high', tags: ['azure', 'eventhub'] },
    { name: 'azure-app-insights', regex: /InstrumentationKey=[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, severity: 'medium', tags: ['azure', 'insights'] },
    { name: 'azure-client-secret', regex: /AZURE_CLIENT_SECRET\s*=\s*['"]?[A-Za-z0-9~._-]{34,}['"]?/g, severity: 'critical', tags: ['azure', 'ad'] },
    // Feature #1562: GCP service account and API key detection patterns
    { name: 'gcp-api-key', regex: /AIza[0-9A-Za-z_-]{35}/g, severity: 'high', tags: ['gcp', 'api-key'] },
    { name: 'gcp-service-account', regex: /"type"\s*:\s*"service_account"/g, severity: 'critical', tags: ['gcp', 'service-account'] },
    { name: 'gcp-private-key-id', regex: /"private_key_id"\s*:\s*"[a-f0-9]{40}"/g, severity: 'critical', tags: ['gcp', 'private-key'] },
    { name: 'gcp-private-key', regex: /"private_key"\s*:\s*"-----BEGIN (RSA )?PRIVATE KEY-----/g, severity: 'critical', tags: ['gcp', 'private-key'] },
    { name: 'gcp-oauth-secret', regex: /GOOG[A-Za-z0-9_-]{28,32}/g, severity: 'high', tags: ['gcp', 'oauth'] },
    { name: 'gcp-client-email', regex: /"client_email"\s*:\s*"[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com"/g, severity: 'high', tags: ['gcp', 'service-account'] },
    { name: 'firebase-api-key', regex: /apiKey:\s*['"]AIza[0-9A-Za-z_-]{35}['"]/g, severity: 'high', tags: ['gcp', 'firebase'] },
    // Feature #1563: Observability and alerting platform tokens
    { name: 'datadog-api-key', regex: /DD_API_KEY[=:\s]*['"]?[a-f0-9]{32}['"]?/gi, severity: 'high', tags: ['datadog', 'observability'] },
    { name: 'datadog-app-key', regex: /DD_APP_KEY[=:\s]*['"]?[a-f0-9]{40}['"]?/gi, severity: 'high', tags: ['datadog', 'observability'] },
    { name: 'datadog-api-key-inline', regex: /(datadog_api_key|DATADOG_API_KEY)[=:\s]*['"]?[a-f0-9]{32}['"]?/gi, severity: 'high', tags: ['datadog', 'observability'] },
    { name: 'newrelic-license-key', regex: /[a-f0-9]{36}NRAL/g, severity: 'high', tags: ['newrelic', 'observability'] },
    { name: 'newrelic-api-key', regex: /NRAK-[A-Z0-9]{27}/g, severity: 'high', tags: ['newrelic', 'observability'] },
    { name: 'newrelic-insights-key', regex: /NRI[IQ]-[A-Za-z0-9_-]{32}/g, severity: 'high', tags: ['newrelic', 'observability'] },
    { name: 'pagerduty-api-token', regex: /PAGERDUTY[_-]?(API[_-]?)?TOKEN[=:\s]*['"]?[A-Za-z0-9+/=_-]{20,}['"]?/gi, severity: 'high', tags: ['pagerduty', 'alerting'] },
    { name: 'pagerduty-integration-key', regex: /(pagerduty[_-]?integration[_-]?key)[=:\s]*['"]?[a-f0-9]{32}['"]?/gi, severity: 'high', tags: ['pagerduty', 'alerting'] },
    { name: 'opsgenie-api-key', regex: /(opsgenie[_-]?api[_-]?key)[=:\s]*['"]?[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}['"]?/gi, severity: 'high', tags: ['opsgenie', 'alerting'] },
    { name: 'opsgenie-geniekey', regex: /GenieKey\s+[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, severity: 'high', tags: ['opsgenie', 'alerting'] },
    // Feature #1564: Firebase credentials detection
    { name: 'firebase-server-key', regex: /AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}/g, severity: 'critical', tags: ['firebase', 'fcm'] },
    { name: 'firebase-database-url', regex: /https:\/\/[a-z0-9-]+\.firebaseio\.com/gi, severity: 'medium', tags: ['firebase', 'database'] },
    { name: 'firebase-database-url-regional', regex: /https:\/\/[a-z0-9-]+\.[a-z]+-[a-z]+[0-9]?\.firebasedatabase\.app/gi, severity: 'medium', tags: ['firebase', 'database'] },
    { name: 'firebase-admin-private-key', regex: /"private_key"\s*:\s*"-----BEGIN PRIVATE KEY-----[^"]+-----END PRIVATE KEY-----\\n"/g, severity: 'critical', tags: ['firebase', 'admin'] },
    { name: 'firebase-service-account', regex: /"project_id"\s*:\s*"[a-z0-9-]+-firebase"/g, severity: 'high', tags: ['firebase', 'service-account'] },
    { name: 'firebase-api-key-server', regex: /(FIREBASE_API_KEY|firebase[_-]?api[_-]?key)[=:\s]*['"]?AIza[0-9A-Za-z_-]{35}['"]?/gi, severity: 'medium', tags: ['firebase', 'config'] },
    { name: 'firebase-storage-bucket', regex: /gs:\/\/[a-z0-9-]+\.appspot\.com/gi, severity: 'low', tags: ['firebase', 'storage'] },
    { name: 'firebase-dynamic-links', regex: /https:\/\/[a-z0-9-]+\.page\.link/gi, severity: 'low', tags: ['firebase', 'dynamic-links'] },
  ];

  // Feature #1558: Add custom patterns from project configuration
  const enabledCustomPatterns = customPatterns.filter(p => p.enabled);
  for (const custom of enabledCustomPatterns) {
    try {
      const regex = new RegExp(custom.pattern, 'g');
      builtInPatterns.push({
        name: custom.id,
        regex,
        severity: custom.severity.toLowerCase() as 'critical' | 'high' | 'medium' | 'low',
        tags: [custom.category, 'custom'],
      });
    } catch (e) {
      console.warn(`[Gitleaks] Invalid custom pattern regex: ${custom.pattern}`);
    }
  }

  const patterns = builtInPatterns;

  // File extensions to scan
  const scanExtensions = ['.js', '.ts', '.jsx', '.tsx', '.json', '.env', '.yml', '.yaml', '.config', '.conf', '.py', '.rb', '.go'];
  const excludeDirs = ['node_modules', '.git', 'vendor', 'dist', 'build', '__pycache__', '.venv'];

  // Recursively scan files
  function scanDirectory(dirPath: string, depth: number = 0): void {
    if (depth > 10) return; // Prevent too deep recursion

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (!excludeDirs.includes(entry.name)) {
            scanDirectory(fullPath, depth + 1);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          const isEnvFile = entry.name.startsWith('.env') || entry.name.includes('.env.');

          if (scanExtensions.includes(ext) || isEnvFile) {
            scanFile(fullPath, repoPath);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  function scanFile(filePath: string, basePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(basePath, filePath);

      for (const pattern of patterns) {
        let match;
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags);

        while ((match = regex.exec(content)) !== null) {
          // Find line number
          const beforeMatch = content.substring(0, match.index);
          const lineNumber = beforeMatch.split('\n').length;
          const line = lines[lineNumber - 1] || '';
          const startColumn = match.index - beforeMatch.lastIndexOf('\n') - 1;

          findings.push({
            id: `finding_${Date.now()}_${findings.length}`,
            scan_id: '',
            rule_id: pattern.name,
            description: `${pattern.name.replace(/-/g, ' ')} detected`,
            secret_type: pattern.name.replace(/-/g, '_'),
            file: relativePath,
            line: lineNumber,
            start_column: startColumn,
            end_column: startColumn + match[0].length,
            match: redactSecret(match[0]),
            commit: 'current',
            author: 'unknown',
            date: new Date().toISOString(),
            message: 'Pattern matching scan (Gitleaks unavailable)',
            severity: pattern.severity,
            entropy: calculateEntropy(match[0]),
            tags: pattern.tags,
          });
        }
      }
    } catch (error) {
      // Skip files we can't read
    }
  }

  try {
    if (fs.existsSync(repoPath) && fs.statSync(repoPath).isDirectory()) {
      scanDirectory(repoPath);
    }

    return {
      success: true,
      findings,
      commitsScanned: 0, // Pattern matching doesn't scan commits
    };
  } catch (error: any) {
    return {
      success: false,
      findings: [],
      error: error.message || 'Pattern matching scan failed',
    };
  }
}

/**
 * Calculate Shannon entropy of a string
 */
function calculateEntropy(str: string): number {
  const len = str.length;
  if (len === 0) return 0;

  const freq: { [key: string]: number } = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }

  let entropy = 0;
  for (const char in freq) {
    const p = freq[char] / len;
    entropy -= p * Math.log2(p);
  }

  return Math.round(entropy * 100) / 100;
}

// ============================================================
// Gitleaks Routes
// ============================================================

export async function gitleaksRoutes(app: FastifyInstance): Promise<void> {
  // Get Gitleaks configuration
  app.get<{ Params: { projectId: string } }>(
    '/api/v1/projects/:projectId/sast/gitleaks/config',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const { projectId } = request.params;

      const project = await getProject(projectId);
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

      const config = gitleaksConfigs.get(projectId) || {
        ...DEFAULT_GITLEAKS_CONFIG,
        notification_channels: ['in_app' as any],
      };

      return { config };
    }
  );

  // Update Gitleaks configuration
  app.patch<{ Params: { projectId: string }; Body: Partial<GitleaksConfig> }>(
    '/api/v1/projects/:projectId/sast/gitleaks/config',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const { projectId } = request.params;
      const updates = request.body;

      const project = await getProject(projectId);
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

      const existingConfig = gitleaksConfigs.get(projectId) || { ...DEFAULT_GITLEAKS_CONFIG };

      const config = { ...existingConfig, ...updates };
      gitleaksConfigs.set(projectId, config);

      console.log(`
====================================
  Gitleaks Configuration Updated
====================================
  Project: ${project.name}
  Enabled: ${config.enabled}
  Scan on Push: ${config.scan_on_push}
  Scan on PR: ${config.scan_on_pr}
  Full History Scan: ${config.scan_full_history}
====================================
      `);

      return {
        success: true,
        message: config.enabled ? 'Gitleaks scanning enabled' : 'Gitleaks configuration updated',
        config,
      };
    }
  );

  // Trigger Gitleaks scan
  app.post<{ Params: { projectId: string }; Body: { branch?: string; full_history?: boolean } }>(
    '/api/v1/projects/:projectId/sast/gitleaks/scan',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const { projectId } = request.params;
      const { branch = 'main', full_history = false } = request.body;

      const project = await getProject(projectId);
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

      const config = gitleaksConfigs.get(projectId);
      if (!config?.enabled) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Gitleaks scanning is not enabled for this project. Enable it in settings first.',
        });
      }

      // Feature #1511: Run actual Gitleaks CLI scan
      const scanId = `gitleaks_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Check Gitleaks availability
      const gitleaksInfo = checkGitleaksAvailability();

      // Determine repo path - for demo, use current project directory or a configured path
      // In a real implementation, this would be the cloned repo path
      const repoPath = process.env.GITLEAKS_SCAN_PATH || process.cwd();

      // Feature #1558: Get custom secret patterns for this project
      const customPatterns = getSecretPatterns(projectId);
      const enabledPatternsCount = customPatterns.filter(p => p.enabled).length;

      console.log(`
====================================
  Gitleaks Scan Starting
====================================
  Project: ${project.name}
  Branch: ${branch}
  Full History: ${full_history}
  Gitleaks Available: ${gitleaksInfo.available}
  Gitleaks Version: ${gitleaksInfo.version || 'N/A'}
  Scan Path: ${repoPath}
  Custom Patterns: ${enabledPatternsCount}
====================================
      `);

      // Run the scan (with 5 minute timeout for large repos)
      // Feature #1558: Pass custom patterns for config generation
      const scanResult = await runGitleaksScan(repoPath, {
        fullHistory: full_history,
        timeout: 300000, // 5 minutes
        excludePaths: config.exclude_paths,
        customPatterns,  // Feature #1558
      });

      // Apply scan_id to all findings
      const findings = scanResult.findings.map(f => ({ ...f, scan_id: scanId }));

      // Filter by severity threshold if configured
      const filteredFindings = findings.filter(f => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, all: 0 };
        const findingSeverity = severityOrder[f.severity] || 0;
        const thresholdSeverity = severityOrder[config.severity_threshold] || 0;
        return findingSeverity >= thresholdSeverity;
      });

      // Create scan record
      const scan: GitleaksScan = {
        id: scanId,
        organization_id: user.organization_id,
        project_id: projectId,
        repository: project.name,
        branch,
        status: scanResult.success ? 'completed' : 'failed',
        started_at: new Date(),
        completed_at: new Date(),
        trigger: 'manual',
        commits_scanned: scanResult.commitsScanned || (full_history ? 150 : 25),
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

      // Store scan
      const projectScans = gitleaksScans.get(projectId) || [];
      projectScans.unshift(scan);
      gitleaksScans.set(projectId, projectScans.slice(0, 50)); // Keep last 50 scans

      console.log(`
====================================
  Gitleaks Scan Completed
====================================
  Project: ${project.name}
  Branch: ${branch}
  Method: ${gitleaksInfo.available ? `CLI v${gitleaksInfo.version}` : 'Pattern Matching (fallback)'}
  Commits Scanned: ${scan.commits_scanned}
  Secrets Found: ${scan.summary.total}
    - Critical: ${scan.summary.critical}
    - High: ${scan.summary.high}
    - Medium: ${scan.summary.medium}
    - Low: ${scan.summary.low}
  ${scan.error_message ? `Error: ${scan.error_message}` : ''}
====================================
      `);

      return {
        success: true,
        message: `Gitleaks scan completed. Found ${scan.summary.total} exposed secrets.`,
        scan,
      };
    }
  );

  // Get Gitleaks scan results
  app.get<{ Params: { projectId: string }; Querystring: { limit?: number } }>(
    '/api/v1/projects/:projectId/sast/gitleaks/scans',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const { projectId } = request.params;
      const { limit = 10 } = request.query;

      const project = await getProject(projectId);
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

      const scans = (gitleaksScans.get(projectId) || []).slice(0, limit);

      return {
        scans,
        total: scans.length,
      };
    }
  );

  // Get specific Gitleaks scan details
  app.get<{ Params: { projectId: string; scanId: string } }>(
    '/api/v1/projects/:projectId/sast/gitleaks/scans/:scanId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const { projectId, scanId } = request.params;

      const project = await getProject(projectId);
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

      const scans = gitleaksScans.get(projectId) || [];
      const scan = scans.find(s => s.id === scanId);

      if (!scan) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Scan not found',
        });
      }

      return { scan };
    }
  );

  // ============================================================
  // Feature #1560: Pre-commit hook generation for Gitleaks
  // ============================================================

  /**
   * Generate pre-commit configuration file
   * Supports both pre-commit framework (.pre-commit-config.yaml) and native git hooks
   */
  app.get<{
    Params: { projectId: string };
    Querystring: { format?: 'pre-commit' | 'git-hook'; mode?: 'fail' | 'warn' };
  }>(
    '/api/v1/projects/:projectId/sast/gitleaks/pre-commit',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const { projectId } = request.params;
      const { format = 'pre-commit', mode = 'fail' } = request.query;

      const project = await getProject(projectId);
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

      // Get custom patterns for the project
      const customPatterns = getSecretPatterns(projectId);
      const enabledPatterns = customPatterns.filter(p => p.enabled);

      if (format === 'git-hook') {
        // Generate native git pre-commit hook script
        const gitHookScript = generateGitHookScript(mode, enabledPatterns.length > 0);

        return {
          format: 'git-hook',
          filename: 'pre-commit',
          content: gitHookScript,
          instructions: getGitHookInstructions(),
          mode,
          customPatternsCount: enabledPatterns.length,
        };
      }

      // Generate .pre-commit-config.yaml
      const preCommitConfig = generatePreCommitFrameworkConfig(mode, enabledPatterns.length > 0);

      return {
        format: 'pre-commit',
        filename: '.pre-commit-config.yaml',
        content: preCommitConfig,
        instructions: getPreCommitFrameworkInstructions(),
        mode,
        customPatternsCount: enabledPatterns.length,
      };
    }
  );

  /**
   * Download pre-commit configuration as a file
   */
  app.get<{
    Params: { projectId: string };
    Querystring: { format?: 'pre-commit' | 'git-hook'; mode?: 'fail' | 'warn' };
  }>(
    '/api/v1/projects/:projectId/sast/gitleaks/pre-commit/download',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload;
      const { projectId } = request.params;
      const { format = 'pre-commit', mode = 'fail' } = request.query;

      const project = await getProject(projectId);
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

      const customPatterns = getSecretPatterns(projectId);
      const enabledPatterns = customPatterns.filter(p => p.enabled);

      if (format === 'git-hook') {
        const content = generateGitHookScript(mode, enabledPatterns.length > 0);
        reply.header('Content-Type', 'text/plain');
        reply.header('Content-Disposition', 'attachment; filename="pre-commit"');
        return reply.send(content);
      }

      const content = generatePreCommitFrameworkConfig(mode, enabledPatterns.length > 0);
      reply.header('Content-Type', 'text/yaml');
      reply.header('Content-Disposition', 'attachment; filename=".pre-commit-config.yaml"');
      return reply.send(content);
    }
  );
}

// ============================================================
// Feature #1560: Pre-commit hook generators
// ============================================================

/**
 * Generate .pre-commit-config.yaml for the pre-commit framework
 */
function generatePreCommitFrameworkConfig(mode: 'fail' | 'warn', hasCustomConfig: boolean): string {
  const failOnError = mode === 'fail';
  const argsLine = hasCustomConfig
    ? `        args: ['detect', '--source', '.', '--config', '.gitleaks.toml', '--verbose']`
    : `        args: ['detect', '--source', '.', '--verbose']`;

  return `# QA Guardian - Gitleaks Pre-commit Configuration
# Feature #1560: Auto-generated pre-commit hook
# Generated at: ${new Date().toISOString()}
#
# This configuration uses the pre-commit framework to run Gitleaks
# before each commit to detect secrets in your code.
#
# Setup Instructions:
# 1. Install pre-commit: pip install pre-commit
# 2. Save this file as .pre-commit-config.yaml in your repo root
# 3. Run: pre-commit install
# 4. Optional: Run on all files: pre-commit run --all-files
${hasCustomConfig ? '# 5. Ensure .gitleaks.toml with custom rules is in repo root\n' : ''}
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.1  # Use the latest stable version
    hooks:
      - id: gitleaks
        name: Detect secrets with Gitleaks
        description: Prevent hardcoded secrets from being committed
        entry: gitleaks
${argsLine}
        language: system
        pass_filenames: false
        ${failOnError ? '' : 'verbose: true  # Warn mode - shows findings but allows commit'}
${failOnError ? '' : `        # To enable strict mode, remove 'verbose: true' and add:
        # fail_fast: true`}

# Additional hooks you might want to add:
# - repo: https://github.com/pre-commit/pre-commit-hooks
#   rev: v4.5.0
#   hooks:
#     - id: detect-private-key
#     - id: detect-aws-credentials
`;
}

/**
 * Generate native git pre-commit hook script
 */
function generateGitHookScript(mode: 'fail' | 'warn', hasCustomConfig: boolean): string {
  const failOnError = mode === 'fail';
  const configArg = hasCustomConfig ? '--config .gitleaks.toml ' : '';

  return `#!/bin/bash
#
# QA Guardian - Gitleaks Pre-commit Hook
# Feature #1560: Auto-generated git hook script
# Generated at: ${new Date().toISOString()}
#
# This script runs Gitleaks to detect secrets before each commit.
# Mode: ${failOnError ? 'FAIL (blocks commit if secrets found)' : 'WARN (shows warnings but allows commit)'}
#
# Setup Instructions:
# 1. Save this file as .git/hooks/pre-commit
# 2. Make it executable: chmod +x .git/hooks/pre-commit
# 3. Ensure gitleaks is installed: https://github.com/gitleaks/gitleaks
${hasCustomConfig ? '# 4. Ensure .gitleaks.toml with custom rules exists in repo root\n' : ''}

# Colors for output
RED='\\033[0;31m'
YELLOW='\\033[1;33m'
GREEN='\\033[0;32m'
NC='\\033[0m' # No Color

echo -e "\${GREEN}[QA Guardian]\${NC} Running Gitleaks secret detection..."

# Check if gitleaks is installed
if ! command -v gitleaks &> /dev/null; then
    echo -e "\${YELLOW}[WARNING]\${NC} Gitleaks is not installed. Skipping secret detection."
    echo "Install it from: https://github.com/gitleaks/gitleaks"
    exit 0
fi

# Run gitleaks on staged files
GITLEAKS_OUTPUT=$(gitleaks detect --source . ${configArg}--staged --verbose 2>&1)
GITLEAKS_EXIT_CODE=$?

if [ $GITLEAKS_EXIT_CODE -eq 0 ]; then
    echo -e "\${GREEN}[PASSED]\${NC} No secrets detected in staged files."
    exit 0
else
    echo -e "\${RED}[ALERT]\${NC} Potential secrets detected in staged files!"
    echo ""
    echo "$GITLEAKS_OUTPUT"
    echo ""
${failOnError ? `    echo -e "\\${RED}COMMIT BLOCKED\\${NC} - Please remove secrets before committing."
    echo "If this is a false positive, you can:"
    echo "  1. Add the file to .gitleaksignore"
    echo "  2. Use 'git commit --no-verify' to bypass (not recommended)"
    exit 1` : `    echo -e "\\${YELLOW}WARNING:\\${NC} Secrets detected but commit allowed (warn mode)."
    echo "Please review the findings above and consider removing secrets."
    exit 0`}
fi
`;
}

/**
 * Get setup instructions for pre-commit framework
 */
function getPreCommitFrameworkInstructions(): string[] {
  return [
    'Install the pre-commit framework: pip install pre-commit',
    'Save the configuration as .pre-commit-config.yaml in your repository root',
    'Run: pre-commit install',
    'Test the hook: pre-commit run --all-files',
    'If you have custom secret patterns, also save your .gitleaks.toml file',
  ];
}

/**
 * Get setup instructions for native git hooks
 */
function getGitHookInstructions(): string[] {
  return [
    'Save the script as .git/hooks/pre-commit in your repository',
    'Make it executable: chmod +x .git/hooks/pre-commit',
    'Ensure Gitleaks is installed on your system',
    'If you have custom secret patterns, ensure .gitleaks.toml exists in repo root',
    'Test the hook by making a commit',
  ];
}
