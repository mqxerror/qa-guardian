/**
 * GitHub Repository - Database CRUD operations for GitHub integration module
 *
 * Feature #2087: Migrates in-memory Map stores to PostgreSQL persistence.
 * Provides transparent fallback to in-memory storage when database is not connected.
 *
 * This module handles:
 * - GitHub connections (project <-> repo mapping)
 * - PR status checks
 * - PR comments
 * - PR dependency scan results
 * - User GitHub OAuth tokens
 */

import { query, isDatabaseConnected } from '../database';
import {
  GitHubConnection,
  PRStatusCheck,
  PRComment,
  PRDependencyScanResult,
} from '../../routes/github/types';

// =============================
// IN-MEMORY STORES (FALLBACK)
// =============================

const memoryGithubConnections: Map<string, GitHubConnection> = new Map(); // projectId -> connection
const memoryPRStatusChecks: Map<string, PRStatusCheck[]> = new Map(); // projectId -> status checks
const memoryPRComments: Map<string, PRComment[]> = new Map(); // projectId -> PR comments
const memoryPRDependencyScans: Map<string, PRDependencyScanResult[]> = new Map(); // projectId -> scans
const memoryUserGithubTokens: Map<string, string> = new Map(); // userId -> token


// =============================
// GITHUB CONNECTIONS CRUD
// =============================

export async function createGithubConnection(connection: GitHubConnection): Promise<GitHubConnection> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO github_connections (
        id, project_id, organization_id, github_owner, github_repo, github_branch,
        test_path, connected_at, connected_by, last_synced_at,
        pr_checks_enabled, pr_comments_enabled,
        pr_dependency_scan_enabled, pr_dependency_scan_files,
        pr_dependency_scan_severity, pr_dependency_scan_block_on_critical
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        connection.id, connection.project_id, connection.organization_id,
        connection.github_owner, connection.github_repo, connection.github_branch,
        connection.test_path, connection.connected_at, connection.connected_by,
        connection.last_synced_at,
        connection.pr_checks_enabled ?? true, connection.pr_comments_enabled ?? true,
        connection.pr_dependency_scan_enabled ?? false,
        JSON.stringify(connection.pr_dependency_scan_files || []),
        connection.pr_dependency_scan_severity || 'HIGH',
        connection.pr_dependency_scan_block_on_critical ?? false
      ]
    );
    if (result && result.rows[0]) {
      return parseGithubConnectionRow(result.rows[0]);
    }
  }
  // Fallback to memory
  memoryGithubConnections.set(connection.project_id, connection);
  return connection;
}

export async function getGithubConnection(projectId: string): Promise<GitHubConnection | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM github_connections WHERE project_id = $1`,
      [projectId]
    );
    if (result && result.rows[0]) {
      return parseGithubConnectionRow(result.rows[0]);
    }
    return undefined;
  }
  return memoryGithubConnections.get(projectId);
}

export async function updateGithubConnection(projectId: string, updates: Partial<GitHubConnection>): Promise<GitHubConnection | undefined> {
  const existing = await getGithubConnection(projectId);
  if (!existing) return undefined;

  const updated: GitHubConnection = { ...existing, ...updates };

  if (isDatabaseConnected()) {
    const result = await query<any>(
      `UPDATE github_connections SET
        github_owner = $2, github_repo = $3, github_branch = $4,
        test_path = $5, last_synced_at = $6,
        pr_checks_enabled = $7, pr_comments_enabled = $8,
        pr_dependency_scan_enabled = $9, pr_dependency_scan_files = $10,
        pr_dependency_scan_severity = $11, pr_dependency_scan_block_on_critical = $12
      WHERE project_id = $1
      RETURNING *`,
      [
        projectId, updated.github_owner, updated.github_repo, updated.github_branch,
        updated.test_path, updated.last_synced_at,
        updated.pr_checks_enabled, updated.pr_comments_enabled,
        updated.pr_dependency_scan_enabled,
        JSON.stringify(updated.pr_dependency_scan_files || []),
        updated.pr_dependency_scan_severity,
        updated.pr_dependency_scan_block_on_critical
      ]
    );
    if (result && result.rows[0]) {
      return parseGithubConnectionRow(result.rows[0]);
    }
    return undefined;
  }
  memoryGithubConnections.set(projectId, updated);
  return updated;
}

export async function deleteGithubConnection(projectId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      `DELETE FROM github_connections WHERE project_id = $1`,
      [projectId]
    );
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return memoryGithubConnections.delete(projectId);
}

export async function listGithubConnections(organizationId: string): Promise<GitHubConnection[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM github_connections WHERE organization_id = $1 ORDER BY connected_at DESC`,
      [organizationId]
    );
    if (result) {
      return result.rows.map(parseGithubConnectionRow);
    }
    return [];
  }
  return Array.from(memoryGithubConnections.values()).filter(c => c.organization_id === organizationId);
}

function parseGithubConnectionRow(row: any): GitHubConnection {
  return {
    id: row.id,
    project_id: row.project_id,
    organization_id: row.organization_id,
    github_owner: row.github_owner,
    github_repo: row.github_repo,
    github_branch: row.github_branch,
    test_path: row.test_path,
    connected_at: new Date(row.connected_at),
    connected_by: row.connected_by,
    last_synced_at: row.last_synced_at ? new Date(row.last_synced_at) : undefined,
    pr_checks_enabled: row.pr_checks_enabled,
    pr_comments_enabled: row.pr_comments_enabled,
    pr_dependency_scan_enabled: row.pr_dependency_scan_enabled,
    pr_dependency_scan_files: typeof row.pr_dependency_scan_files === 'string'
      ? JSON.parse(row.pr_dependency_scan_files)
      : row.pr_dependency_scan_files,
    pr_dependency_scan_severity: row.pr_dependency_scan_severity,
    pr_dependency_scan_block_on_critical: row.pr_dependency_scan_block_on_critical,
  };
}


// =============================
// PR STATUS CHECKS CRUD
// =============================

export async function addPRStatusCheck(check: PRStatusCheck): Promise<PRStatusCheck> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO pr_status_checks (
        id, project_id, pr_number, pr_title, head_sha, status,
        context, description, target_url, created_at, updated_at, test_run_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        check.id, check.project_id, check.pr_number, check.pr_title,
        check.head_sha, check.status, check.context, check.description,
        check.target_url, check.created_at, check.updated_at, check.test_run_id
      ]
    );
    if (result && result.rows[0]) {
      return parsePRStatusCheckRow(result.rows[0]);
    }
  }
  // Fallback to memory
  const checks = memoryPRStatusChecks.get(check.project_id) || [];
  checks.push(check);
  memoryPRStatusChecks.set(check.project_id, checks);
  return check;
}

export async function updatePRStatusCheck(checkId: string, updates: Partial<PRStatusCheck>): Promise<PRStatusCheck | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `UPDATE pr_status_checks SET
        status = COALESCE($2, status),
        description = COALESCE($3, description),
        target_url = COALESCE($4, target_url),
        updated_at = $5,
        test_run_id = COALESCE($6, test_run_id)
      WHERE id = $1
      RETURNING *`,
      [checkId, updates.status, updates.description, updates.target_url, new Date(), updates.test_run_id]
    );
    if (result && result.rows[0]) {
      return parsePRStatusCheckRow(result.rows[0]);
    }
    return undefined;
  }
  // Memory fallback
  for (const [projectId, checks] of memoryPRStatusChecks.entries()) {
    const idx = checks.findIndex(c => c.id === checkId);
    if (idx >= 0) {
      checks[idx] = { ...checks[idx], ...updates, updated_at: new Date() };
      return checks[idx];
    }
  }
  return undefined;
}

export async function getPRStatusChecks(projectId: string, limit: number = 100): Promise<PRStatusCheck[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM pr_status_checks WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [projectId, limit]
    );
    if (result) {
      return result.rows.map(parsePRStatusCheckRow);
    }
    return [];
  }
  const checks = memoryPRStatusChecks.get(projectId) || [];
  return checks.slice(-limit).reverse();
}

export async function getPRStatusChecksByPR(projectId: string, prNumber: number): Promise<PRStatusCheck[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM pr_status_checks WHERE project_id = $1 AND pr_number = $2 ORDER BY created_at DESC`,
      [projectId, prNumber]
    );
    if (result) {
      return result.rows.map(parsePRStatusCheckRow);
    }
    return [];
  }
  const checks = memoryPRStatusChecks.get(projectId) || [];
  return checks.filter(c => c.pr_number === prNumber);
}

function parsePRStatusCheckRow(row: any): PRStatusCheck {
  return {
    id: row.id,
    project_id: row.project_id,
    pr_number: row.pr_number,
    pr_title: row.pr_title,
    head_sha: row.head_sha,
    status: row.status,
    context: row.context,
    description: row.description,
    target_url: row.target_url,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    test_run_id: row.test_run_id,
  };
}


// =============================
// PR COMMENTS CRUD
// =============================

export async function addPRComment(comment: PRComment): Promise<PRComment> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO pr_comments (
        id, project_id, pr_number, body, results_url,
        passed, failed, skipped, total, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        comment.id, comment.project_id, comment.pr_number, comment.body,
        comment.results_url, comment.passed, comment.failed,
        comment.skipped, comment.total, comment.created_at
      ]
    );
    if (result && result.rows[0]) {
      return parsePRCommentRow(result.rows[0]);
    }
  }
  // Fallback to memory
  const comments = memoryPRComments.get(comment.project_id) || [];
  comments.push(comment);
  memoryPRComments.set(comment.project_id, comments);
  return comment;
}

export async function getPRComments(projectId: string, limit: number = 100): Promise<PRComment[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM pr_comments WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [projectId, limit]
    );
    if (result) {
      return result.rows.map(parsePRCommentRow);
    }
    return [];
  }
  const comments = memoryPRComments.get(projectId) || [];
  return comments.slice(-limit).reverse();
}

export async function getPRCommentsByPR(projectId: string, prNumber: number): Promise<PRComment[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM pr_comments WHERE project_id = $1 AND pr_number = $2 ORDER BY created_at DESC`,
      [projectId, prNumber]
    );
    if (result) {
      return result.rows.map(parsePRCommentRow);
    }
    return [];
  }
  const comments = memoryPRComments.get(projectId) || [];
  return comments.filter(c => c.pr_number === prNumber);
}

function parsePRCommentRow(row: any): PRComment {
  return {
    id: row.id,
    project_id: row.project_id,
    pr_number: row.pr_number,
    body: row.body,
    results_url: row.results_url,
    passed: row.passed,
    failed: row.failed,
    skipped: row.skipped,
    total: row.total,
    created_at: new Date(row.created_at),
  };
}


// =============================
// PR DEPENDENCY SCANS CRUD
// =============================

export async function addPRDependencyScan(scan: PRDependencyScanResult): Promise<PRDependencyScanResult> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO pr_dependency_scans (
        id, project_id, pr_number, head_sha, status,
        started_at, completed_at, changed_files, vulnerabilities, summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        scan.id, scan.project_id, scan.pr_number, scan.head_sha, scan.status,
        scan.started_at, scan.completed_at,
        JSON.stringify(scan.changed_files),
        JSON.stringify(scan.vulnerabilities),
        JSON.stringify(scan.summary)
      ]
    );
    if (result && result.rows[0]) {
      return parsePRDependencyScanRow(result.rows[0]);
    }
  }
  // Fallback to memory
  const scans = memoryPRDependencyScans.get(scan.project_id) || [];
  scans.push(scan);
  memoryPRDependencyScans.set(scan.project_id, scans);
  return scan;
}

export async function updatePRDependencyScan(scanId: string, updates: Partial<PRDependencyScanResult>): Promise<PRDependencyScanResult | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `UPDATE pr_dependency_scans SET
        status = COALESCE($2, status),
        completed_at = COALESCE($3, completed_at),
        vulnerabilities = COALESCE($4, vulnerabilities),
        summary = COALESCE($5, summary)
      WHERE id = $1
      RETURNING *`,
      [
        scanId,
        updates.status,
        updates.completed_at,
        updates.vulnerabilities ? JSON.stringify(updates.vulnerabilities) : null,
        updates.summary ? JSON.stringify(updates.summary) : null
      ]
    );
    if (result && result.rows[0]) {
      return parsePRDependencyScanRow(result.rows[0]);
    }
    return undefined;
  }
  // Memory fallback
  for (const [projectId, scans] of memoryPRDependencyScans.entries()) {
    const idx = scans.findIndex(s => s.id === scanId);
    if (idx >= 0) {
      scans[idx] = { ...scans[idx], ...updates };
      return scans[idx];
    }
  }
  return undefined;
}

export async function getPRDependencyScans(projectId: string, limit: number = 100): Promise<PRDependencyScanResult[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM pr_dependency_scans WHERE project_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [projectId, limit]
    );
    if (result) {
      return result.rows.map(parsePRDependencyScanRow);
    }
    return [];
  }
  const scans = memoryPRDependencyScans.get(projectId) || [];
  return scans.slice(-limit).reverse();
}

export async function getPRDependencyScansByPR(projectId: string, prNumber: number): Promise<PRDependencyScanResult[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM pr_dependency_scans WHERE project_id = $1 AND pr_number = $2 ORDER BY started_at DESC`,
      [projectId, prNumber]
    );
    if (result) {
      return result.rows.map(parsePRDependencyScanRow);
    }
    return [];
  }
  const scans = memoryPRDependencyScans.get(projectId) || [];
  return scans.filter(s => s.pr_number === prNumber);
}

function parsePRDependencyScanRow(row: any): PRDependencyScanResult {
  return {
    id: row.id,
    project_id: row.project_id,
    pr_number: row.pr_number,
    head_sha: row.head_sha,
    status: row.status,
    started_at: new Date(row.started_at),
    completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
    changed_files: typeof row.changed_files === 'string' ? JSON.parse(row.changed_files) : row.changed_files,
    vulnerabilities: typeof row.vulnerabilities === 'string' ? JSON.parse(row.vulnerabilities) : row.vulnerabilities,
    summary: typeof row.summary === 'string' ? JSON.parse(row.summary) : row.summary,
  };
}


// =============================
// USER GITHUB TOKENS CRUD
// =============================

export async function setUserGithubToken(userId: string, token: string): Promise<void> {
  if (isDatabaseConnected()) {
    await query(
      `INSERT INTO user_github_tokens (user_id, access_token, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET access_token = $2, updated_at = NOW()`,
      [userId, token]
    );
    return;
  }
  memoryUserGithubTokens.set(userId, token);
}

export async function getUserGithubToken(userId: string): Promise<string | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT access_token FROM user_github_tokens WHERE user_id = $1`,
      [userId]
    );
    if (result && result.rows[0]) {
      return result.rows[0].access_token;
    }
    return undefined;
  }
  return memoryUserGithubTokens.get(userId);
}

export async function deleteUserGithubToken(userId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      `DELETE FROM user_github_tokens WHERE user_id = $1`,
      [userId]
    );
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return memoryUserGithubTokens.delete(userId);
}


// =============================
// MEMORY STORE ACCESS (for compatibility)
// =============================

export function getMemoryGithubConnections(): Map<string, GitHubConnection> {
  return memoryGithubConnections;
}

export function getMemoryPRStatusChecks(): Map<string, PRStatusCheck[]> {
  return memoryPRStatusChecks;
}

export function getMemoryPRComments(): Map<string, PRComment[]> {
  return memoryPRComments;
}

export function getMemoryPRDependencyScans(): Map<string, PRDependencyScanResult[]> {
  return memoryPRDependencyScans;
}

export function getMemoryUserGithubTokens(): Map<string, string> {
  return memoryUserGithubTokens;
}
