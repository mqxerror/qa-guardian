/**
 * Gitleaks Repository - PostgreSQL persistence for Gitleaks module
 *
 * Feature #2121: Migrate Gitleaks in-memory Maps to PostgreSQL
 *
 * Provides CRUD operations for:
 * - Gitleaks configurations per project
 * - Gitleaks scan results with findings
 */

import { query, isDatabaseConnected } from '../database';
import { GitleaksConfig, GitleaksScan } from '../../routes/sast/gitleaks';

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

// ============================================
// Gitleaks Config Operations
// ============================================

export async function getGitleaksConfig(projectId: string): Promise<GitleaksConfig | null> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM gitleaks_configs WHERE project_id = $1',
      [projectId]
    );
    if (result && result.rows[0]) {
      return parseGitleaksConfigRow(result.rows[0]);
    }
    return null;
  }
  return null;
}

export async function getGitleaksConfigOrDefault(projectId: string): Promise<GitleaksConfig> {
  const config = await getGitleaksConfig(projectId);
  return config || { ...DEFAULT_GITLEAKS_CONFIG };
}

export async function upsertGitleaksConfig(projectId: string, config: GitleaksConfig): Promise<GitleaksConfig> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO gitleaks_configs (
        project_id, enabled, scan_on_push, scan_on_pr, scan_full_history,
        exclude_paths, allowlist_patterns, custom_rules, severity_threshold,
        fail_on_leak, notification_channels, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (project_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        scan_on_push = EXCLUDED.scan_on_push,
        scan_on_pr = EXCLUDED.scan_on_pr,
        scan_full_history = EXCLUDED.scan_full_history,
        exclude_paths = EXCLUDED.exclude_paths,
        allowlist_patterns = EXCLUDED.allowlist_patterns,
        custom_rules = EXCLUDED.custom_rules,
        severity_threshold = EXCLUDED.severity_threshold,
        fail_on_leak = EXCLUDED.fail_on_leak,
        notification_channels = EXCLUDED.notification_channels,
        updated_at = NOW()
      RETURNING *`,
      [
        projectId,
        config.enabled,
        config.scan_on_push,
        config.scan_on_pr,
        config.scan_full_history,
        JSON.stringify(config.exclude_paths),
        JSON.stringify(config.allowlist_patterns),
        JSON.stringify(config.custom_rules),
        config.severity_threshold,
        config.fail_on_leak,
        JSON.stringify(config.notification_channels),
      ]
    );
    if (result && result.rows[0]) {
      return parseGitleaksConfigRow(result.rows[0]);
    }
  }
  return config;
}

function parseGitleaksConfigRow(row: any): GitleaksConfig {
  return {
    enabled: row.enabled,
    scan_on_push: row.scan_on_push,
    scan_on_pr: row.scan_on_pr,
    scan_full_history: row.scan_full_history,
    exclude_paths: row.exclude_paths || [],
    allowlist_patterns: row.allowlist_patterns || [],
    custom_rules: row.custom_rules || [],
    severity_threshold: row.severity_threshold || 'all',
    fail_on_leak: row.fail_on_leak,
    notification_channels: row.notification_channels || [],
  };
}

// ============================================
// Gitleaks Scan Operations
// ============================================

export async function createGitleaksScan(scan: GitleaksScan): Promise<GitleaksScan> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO gitleaks_scans (
        id, organization_id, project_id, repository, branch, status,
        started_at, completed_at, trigger, commits_scanned,
        findings, summary, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        scan.id,
        scan.organization_id,
        scan.project_id,
        scan.repository,
        scan.branch,
        scan.status,
        scan.started_at,
        scan.completed_at || null,
        scan.trigger,
        scan.commits_scanned,
        JSON.stringify(scan.findings),
        JSON.stringify(scan.summary),
        scan.error_message || null,
      ]
    );
    if (result && result.rows[0]) {
      return parseGitleaksScanRow(result.rows[0]);
    }
  }
  return scan;
}

export async function getGitleaksScans(projectId: string, limit: number = 10): Promise<GitleaksScan[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM gitleaks_scans WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2',
      [projectId, limit]
    );
    if (result) {
      return result.rows.map(parseGitleaksScanRow);
    }
    return [];
  }
  return [];
}

export async function getGitleaksScan(projectId: string, scanId: string): Promise<GitleaksScan | null> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM gitleaks_scans WHERE project_id = $1 AND id = $2',
      [projectId, scanId]
    );
    if (result && result.rows[0]) {
      return parseGitleaksScanRow(result.rows[0]);
    }
    return null;
  }
  return null;
}

function parseGitleaksScanRow(row: any): GitleaksScan {
  return {
    id: row.id,
    organization_id: row.organization_id,
    project_id: row.project_id,
    repository: row.repository,
    branch: row.branch,
    status: row.status,
    started_at: row.started_at instanceof Date ? row.started_at : new Date(row.started_at),
    completed_at: row.completed_at ? (row.completed_at instanceof Date ? row.completed_at : new Date(row.completed_at)) : undefined,
    trigger: row.trigger,
    commits_scanned: row.commits_scanned,
    findings: row.findings || [],
    summary: row.summary || { total: 0, critical: 0, high: 0, medium: 0, low: 0, by_type: {} },
    error_message: row.error_message,
  };
}
