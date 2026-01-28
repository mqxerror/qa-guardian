/**
 * SAST Repository - PostgreSQL persistence for SAST module
 *
 * Feature #2089: Migrate SAST Module to PostgreSQL
 * Feature #2107: Remove in-memory Map stores (DB-only migration)
 *
 * Provides CRUD operations for:
 * - SAST configurations per project
 * - SAST scan results with findings
 * - False positive tracking
 * - PR checks
 * - PR comments
 * - Custom secret patterns
 *
 * NOTE: All in-memory Map fallbacks have been removed.
 * Database connection is now required for all operations.
 */

import { query, isDatabaseConnected } from '../database';
import {
  SASTConfig,
  SASTScanResult,
  FalsePositive,
  SASTPRCheck,
  SASTPRComment,
  SecretPattern,
} from '../../routes/sast/types';

// Default SAST config
const DEFAULT_SAST_CONFIG: SASTConfig = {
  enabled: false,
  ruleset: 'default',
  severityThreshold: 'MEDIUM',
  autoScan: false,
};

// ============================================
// Memory Store Accessors (DEPRECATED - Feature #2107)
// ============================================

export function getMemorySastConfigs(): Map<string, SASTConfig> {
  console.warn('[SAST Repo] DEPRECATED: getMemorySastConfigs() - memory maps removed.');
  return new Map<string, SASTConfig>();
}

export function getMemorySastScans(): Map<string, SASTScanResult[]> {
  console.warn('[SAST Repo] DEPRECATED: getMemorySastScans() - memory maps removed.');
  return new Map<string, SASTScanResult[]>();
}

export function getMemoryFalsePositives(): Map<string, FalsePositive[]> {
  console.warn('[SAST Repo] DEPRECATED: getMemoryFalsePositives() - memory maps removed.');
  return new Map<string, FalsePositive[]>();
}

export function getMemorySastPRChecks(): Map<string, SASTPRCheck[]> {
  console.warn('[SAST Repo] DEPRECATED: getMemorySastPRChecks() - memory maps removed.');
  return new Map<string, SASTPRCheck[]>();
}

export function getMemorySastPRComments(): Map<string, SASTPRComment[]> {
  console.warn('[SAST Repo] DEPRECATED: getMemorySastPRComments() - memory maps removed.');
  return new Map<string, SASTPRComment[]>();
}

export function getMemorySecretPatterns(): Map<string, SecretPattern[]> {
  console.warn('[SAST Repo] DEPRECATED: getMemorySecretPatterns() - memory maps removed.');
  return new Map<string, SecretPattern[]>();
}

// ============================================
// SAST Config Operations
// ============================================

export async function getSASTConfig(projectId: string): Promise<SASTConfig> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM sast_configs WHERE project_id = $1',
      [projectId]
    );
    if (result && result.rows[0]) {
      return parseSastConfigRow(result.rows[0]);
    }
    return { ...DEFAULT_SAST_CONFIG };
  }
  return { ...DEFAULT_SAST_CONFIG };
}

export async function updateSASTConfig(projectId: string, config: Partial<SASTConfig>): Promise<SASTConfig> {
  const current = await getSASTConfig(projectId);
  const updated: SASTConfig = { ...current, ...config };

  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO sast_configs (
        project_id, enabled, ruleset, custom_rules, custom_rules_yaml,
        exclude_paths, severity_threshold, auto_scan, last_scan_at,
        last_scan_status, pr_checks_enabled, pr_comments_enabled,
        block_pr_on_critical, block_pr_on_high, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      ON CONFLICT (project_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        ruleset = EXCLUDED.ruleset,
        custom_rules = EXCLUDED.custom_rules,
        custom_rules_yaml = EXCLUDED.custom_rules_yaml,
        exclude_paths = EXCLUDED.exclude_paths,
        severity_threshold = EXCLUDED.severity_threshold,
        auto_scan = EXCLUDED.auto_scan,
        last_scan_at = EXCLUDED.last_scan_at,
        last_scan_status = EXCLUDED.last_scan_status,
        pr_checks_enabled = EXCLUDED.pr_checks_enabled,
        pr_comments_enabled = EXCLUDED.pr_comments_enabled,
        block_pr_on_critical = EXCLUDED.block_pr_on_critical,
        block_pr_on_high = EXCLUDED.block_pr_on_high,
        updated_at = NOW()
      RETURNING *`,
      [
        projectId,
        updated.enabled,
        updated.ruleset,
        JSON.stringify(updated.customRules || []),
        JSON.stringify(updated.customRulesYaml || []),
        JSON.stringify(updated.excludePaths || []),
        updated.severityThreshold,
        updated.autoScan,
        updated.lastScanAt || null,
        updated.lastScanStatus || null,
        updated.prChecksEnabled || false,
        updated.prCommentsEnabled || false,
        updated.blockPrOnCritical || false,
        updated.blockPrOnHigh || false,
      ]
    );
    if (result && result.rows[0]) {
      return parseSastConfigRow(result.rows[0]);
    }
  }
  return updated;
}

export async function deleteSASTConfig(projectId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      'DELETE FROM sast_configs WHERE project_id = $1',
      [projectId]
    );
    return (result?.rowCount ?? 0) > 0;
  }
  return false;
}

function parseSastConfigRow(row: any): SASTConfig {
  return {
    enabled: row.enabled,
    ruleset: row.ruleset,
    customRules: row.custom_rules || [],
    customRulesYaml: row.custom_rules_yaml || [],
    excludePaths: row.exclude_paths || [],
    severityThreshold: row.severity_threshold,
    autoScan: row.auto_scan,
    lastScanAt: row.last_scan_at?.toISOString(),
    lastScanStatus: row.last_scan_status,
    prChecksEnabled: row.pr_checks_enabled,
    prCommentsEnabled: row.pr_comments_enabled,
    blockPrOnCritical: row.block_pr_on_critical,
    blockPrOnHigh: row.block_pr_on_high,
  };
}

// ============================================
// SAST Scan Operations
// ============================================

export async function createSastScan(scan: SASTScanResult): Promise<SASTScanResult> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO sast_scans (
        id, project_id, repository_url, branch, commit_sha, status,
        started_at, completed_at, findings, summary, error
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        scan.id,
        scan.projectId,
        scan.repositoryUrl || null,
        scan.branch || null,
        scan.commitSha || null,
        scan.status,
        scan.startedAt,
        scan.completedAt || null,
        JSON.stringify(scan.findings || []),
        JSON.stringify(scan.summary),
        scan.error || null,
      ]
    );
    if (result && result.rows[0]) {
      return parseSastScanRow(result.rows[0]);
    }
  }
  return scan;
}

export async function getSastScan(scanId: string): Promise<SASTScanResult | null> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM sast_scans WHERE id = $1',
      [scanId]
    );
    if (result && result.rows[0]) {
      return parseSastScanRow(result.rows[0]);
    }
    return null;
  }
  return null;
}

export async function updateSastScan(scanId: string, updates: Partial<SASTScanResult>): Promise<SASTScanResult | null> {
  if (isDatabaseConnected()) {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.completedAt !== undefined) {
      setClauses.push(`completed_at = $${paramIndex++}`);
      values.push(updates.completedAt);
    }
    if (updates.findings !== undefined) {
      setClauses.push(`findings = $${paramIndex++}`);
      values.push(JSON.stringify(updates.findings));
    }
    if (updates.summary !== undefined) {
      setClauses.push(`summary = $${paramIndex++}`);
      values.push(JSON.stringify(updates.summary));
    }
    if (updates.error !== undefined) {
      setClauses.push(`error = $${paramIndex++}`);
      values.push(updates.error);
    }

    if (setClauses.length === 0) {
      return getSastScan(scanId);
    }

    values.push(scanId);
    const result = await query<any>(
      `UPDATE sast_scans SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    if (result && result.rows[0]) {
      return parseSastScanRow(result.rows[0]);
    }
    return null;
  }

  return null;
}

export async function getSastScansByProject(projectId: string): Promise<SASTScanResult[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM sast_scans WHERE project_id = $1 ORDER BY started_at DESC',
      [projectId]
    );
    if (result) {
      return result.rows.map(parseSastScanRow);
    }
    return [];
  }
  return [];
}

export async function deleteSastScan(scanId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      'DELETE FROM sast_scans WHERE id = $1',
      [scanId]
    );
    return (result?.rowCount ?? 0) > 0;
  }
  return false;
}

function parseSastScanRow(row: any): SASTScanResult {
  return {
    id: row.id,
    projectId: row.project_id,
    repositoryUrl: row.repository_url,
    branch: row.branch,
    commitSha: row.commit_sha,
    status: row.status,
    startedAt: row.started_at?.toISOString() || row.started_at,
    completedAt: row.completed_at?.toISOString() || row.completed_at,
    findings: row.findings || [],
    summary: row.summary || { total: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 }, byCategory: {} },
    error: row.error,
  };
}

// ============================================
// False Positive Operations
// ============================================

export async function getFalsePositives(projectId: string): Promise<FalsePositive[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM sast_false_positives WHERE project_id = $1 ORDER BY marked_at DESC',
      [projectId]
    );
    if (result) {
      return result.rows.map(parseFalsePositiveRow);
    }
    return [];
  }
  return [];
}

export async function addFalsePositive(projectId: string, fp: FalsePositive): Promise<FalsePositive> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO sast_false_positives (
        id, project_id, rule_id, file_path, line, snippet, reason, marked_by, marked_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        fp.id,
        projectId,
        fp.ruleId,
        fp.filePath,
        fp.line,
        fp.snippet || null,
        fp.reason,
        fp.markedBy,
        fp.markedAt,
      ]
    );
    if (result && result.rows[0]) {
      return parseFalsePositiveRow(result.rows[0]);
    }
  }
  return fp;
}

export async function removeFalsePositive(projectId: string, fpId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      'DELETE FROM sast_false_positives WHERE id = $1 AND project_id = $2',
      [fpId, projectId]
    );
    return (result?.rowCount ?? 0) > 0;
  }
  return false;
}

function parseFalsePositiveRow(row: any): FalsePositive {
  return {
    id: row.id,
    projectId: row.project_id,
    ruleId: row.rule_id,
    filePath: row.file_path,
    line: row.line,
    snippet: row.snippet,
    reason: row.reason,
    markedBy: row.marked_by,
    markedAt: row.marked_at?.toISOString() || row.marked_at,
  };
}

// ============================================
// SAST PR Check Operations
// ============================================

export async function createSastPRCheck(check: SASTPRCheck): Promise<SASTPRCheck> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO sast_pr_checks (
        id, project_id, pr_number, pr_title, head_sha, status, conclusion,
        context, description, target_url, scan_id, findings, blocked,
        block_reason, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        check.id,
        check.projectId,
        check.prNumber,
        check.prTitle,
        check.headSha,
        check.status,
        check.conclusion || null,
        check.context,
        check.description,
        check.targetUrl || null,
        check.scanId || null,
        JSON.stringify(check.findings || null),
        check.blocked,
        check.blockReason || null,
        check.createdAt,
        check.updatedAt,
      ]
    );
    if (result && result.rows[0]) {
      return parseSastPRCheckRow(result.rows[0]);
    }
  }
  return check;
}

export async function getSastPRChecks(projectId: string): Promise<SASTPRCheck[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM sast_pr_checks WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId]
    );
    if (result) {
      return result.rows.map(parseSastPRCheckRow);
    }
    return [];
  }
  return [];
}

export async function updateSastPRCheck(checkId: string, updates: Partial<SASTPRCheck>): Promise<SASTPRCheck | null> {
  if (isDatabaseConnected()) {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.conclusion !== undefined) {
      setClauses.push(`conclusion = $${paramIndex++}`);
      values.push(updates.conclusion);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.findings !== undefined) {
      setClauses.push(`findings = $${paramIndex++}`);
      values.push(JSON.stringify(updates.findings));
    }
    if (updates.blocked !== undefined) {
      setClauses.push(`blocked = $${paramIndex++}`);
      values.push(updates.blocked);
    }
    if (updates.blockReason !== undefined) {
      setClauses.push(`block_reason = $${paramIndex++}`);
      values.push(updates.blockReason);
    }

    if (setClauses.length === 0) {
      return null;
    }

    values.push(checkId);
    const result = await query<any>(
      `UPDATE sast_pr_checks SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    if (result && result.rows[0]) {
      return parseSastPRCheckRow(result.rows[0]);
    }
    return null;
  }

  return null;
}

function parseSastPRCheckRow(row: any): SASTPRCheck {
  return {
    id: row.id,
    projectId: row.project_id,
    prNumber: row.pr_number,
    prTitle: row.pr_title,
    headSha: row.head_sha,
    status: row.status,
    conclusion: row.conclusion,
    context: row.context,
    description: row.description,
    targetUrl: row.target_url,
    scanId: row.scan_id,
    findings: row.findings,
    blocked: row.blocked,
    blockReason: row.block_reason,
    createdAt: row.created_at?.toISOString() || row.created_at,
    updatedAt: row.updated_at?.toISOString() || row.updated_at,
  };
}

// ============================================
// SAST PR Comment Operations
// ============================================

export async function createSastPRComment(comment: SASTPRComment): Promise<SASTPRComment> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO sast_pr_comments (
        id, project_id, pr_number, scan_id, body, findings, blocked, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        comment.id,
        comment.projectId,
        comment.prNumber,
        comment.scanId,
        comment.body,
        JSON.stringify(comment.findings),
        comment.blocked,
        comment.createdAt,
      ]
    );
    if (result && result.rows[0]) {
      return parseSastPRCommentRow(result.rows[0]);
    }
  }
  return comment;
}

export async function getSastPRComments(projectId: string): Promise<SASTPRComment[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM sast_pr_comments WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId]
    );
    if (result) {
      return result.rows.map(parseSastPRCommentRow);
    }
    return [];
  }
  return [];
}

function parseSastPRCommentRow(row: any): SASTPRComment {
  return {
    id: row.id,
    projectId: row.project_id,
    prNumber: row.pr_number,
    scanId: row.scan_id,
    body: row.body,
    findings: row.findings,
    blocked: row.blocked,
    createdAt: row.created_at?.toISOString() || row.created_at,
  };
}

// ============================================
// Secret Pattern Operations (Feature #1558)
// ============================================

export async function getSecretPatterns(projectId: string): Promise<SecretPattern[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM secret_patterns WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId]
    );
    if (result) {
      return result.rows.map(parseSecretPatternRow);
    }
    return [];
  }
  return [];
}

export async function addSecretPattern(projectId: string, pattern: SecretPattern): Promise<SecretPattern> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO secret_patterns (
        id, project_id, name, description, pattern, severity, category,
        enabled, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        pattern.id,
        projectId,
        pattern.name,
        pattern.description || null,
        pattern.pattern,
        pattern.severity,
        pattern.category,
        pattern.enabled,
        pattern.createdAt,
        pattern.updatedAt,
      ]
    );
    if (result && result.rows[0]) {
      return parseSecretPatternRow(result.rows[0]);
    }
  }
  return pattern;
}

export async function updateSecretPattern(projectId: string, patternId: string, updates: Partial<SecretPattern>): Promise<SecretPattern | null> {
  if (isDatabaseConnected()) {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.pattern !== undefined) {
      setClauses.push(`pattern = $${paramIndex++}`);
      values.push(updates.pattern);
    }
    if (updates.severity !== undefined) {
      setClauses.push(`severity = $${paramIndex++}`);
      values.push(updates.severity);
    }
    if (updates.category !== undefined) {
      setClauses.push(`category = $${paramIndex++}`);
      values.push(updates.category);
    }
    if (updates.enabled !== undefined) {
      setClauses.push(`enabled = $${paramIndex++}`);
      values.push(updates.enabled);
    }

    if (setClauses.length === 0) {
      return null;
    }

    values.push(patternId);
    values.push(projectId);
    const result = await query<any>(
      `UPDATE secret_patterns SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} AND project_id = $${paramIndex + 1} RETURNING *`,
      values
    );
    if (result && result.rows[0]) {
      return parseSecretPatternRow(result.rows[0]);
    }
    return null;
  }

  return null;
}

export async function removeSecretPattern(projectId: string, patternId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      'DELETE FROM secret_patterns WHERE id = $1 AND project_id = $2',
      [patternId, projectId]
    );
    return (result?.rowCount ?? 0) > 0;
  }
  return false;
}

function parseSecretPatternRow(row: any): SecretPattern {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    pattern: row.pattern,
    severity: row.severity,
    category: row.category,
    enabled: row.enabled,
    createdAt: row.created_at?.toISOString() || row.created_at,
    updatedAt: row.updated_at?.toISOString() || row.updated_at,
  };
}
