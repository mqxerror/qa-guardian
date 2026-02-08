/**
 * DAST Repository - PostgreSQL persistence for DAST module
 *
 * Feature #2088: Migrate DAST Module to PostgreSQL
 * Feature #2106: Remove in-memory Map stores (DB-only migration)
 *
 * Provides CRUD operations for:
 * - DAST configurations per project
 * - DAST scan results with alerts
 * - False positive tracking
 * - OpenAPI specifications
 * - DAST schedules
 * - GraphQL scans
 *
 * NOTE: All in-memory fallback stores have been removed.
 * Database connection is now required for all operations.
 */

import { query, isDatabaseConnected } from '../database.js';
import {
  DASTConfig,
  DASTScanResult,
  DASTFalsePositive,
  OpenAPISpec,
  DASTSchedule,
  GraphQLScan,
} from '../../routes/dast/types.js';
// Feature #449: Use structured logger instead of console.*
import { createLogger } from '../logger.js';

const log = createLogger('repo:dast');

// ============================================
// Feature #462: Row interfaces to eliminate : any types
// ============================================

/** Database row type for dast_configs table */
interface DastConfigRow {
  project_id: string;
  enabled: boolean;
  target_url: string;
  scan_profile: string;
  auth_config: Record<string, unknown> | null;
  context_config: Record<string, unknown> | null;
  alert_threshold: string;
  auto_scan: boolean;
  last_scan_at: Date | null;
  last_scan_status: string | null;
  openapi_spec_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Database row type for dast_scans table */
interface DastScanRow {
  id: string;
  project_id: string;
  target_url: string;
  scan_profile: string;
  status: string;
  started_at: Date | string;
  completed_at: Date | string | null;
  alerts: unknown[];
  summary: Record<string, unknown>;
  statistics: Record<string, unknown> | null;
  error: string | null;
  endpoints_tested: unknown[] | null;
  scope_config: Record<string, unknown> | null;
  progress: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

/** Database row type for dast_false_positives table */
interface DastFalsePositiveRow {
  id: string;
  project_id: string;
  plugin_id: string;
  url: string;
  param: string | null;
  reason: string;
  marked_by: string;
  marked_at: Date | string;
}

/** Database row type for openapi_specs table */
interface OpenApiSpecRow {
  id: string;
  project_id: string;
  name: string;
  version: string;
  content: Record<string, unknown>;
  endpoints: unknown[];
  uploaded_at: Date | string;
  uploaded_by: string;
}

/** Database row type for dast_schedules table */
interface DastScheduleRow {
  id: string;
  project_id: string;
  organization_id: string;
  name: string;
  description: string | null;
  frequency: string;
  cron_expression: string;
  timezone: string;
  enabled: boolean;
  scan_profile: string;
  target_url: string;
  notify_on_failure: boolean;
  notify_on_high_severity: boolean;
  email_recipients: string[];
  created_at: Date | string;
  updated_at: Date | string;
  created_by: string;
  next_run_at: Date | string | null;
  last_run_at: Date | string | null;
  last_run_id: string | null;
  run_count: number;
}

/** Database row type for graphql_scans table */
interface GraphqlScanRow {
  id: string;
  config: Record<string, unknown>;
  status: string;
  started_at: Date | string;
  completed_at: Date | string | null;
  schema: Record<string, unknown> | null;
  operations_tested: unknown[] | null;
  findings: unknown[];
  summary: Record<string, unknown>;
  progress: Record<string, unknown> | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// Column Constants for SELECT queries
// ============================================

const DAST_CONFIG_COLUMNS = `
  project_id, enabled, target_url, scan_profile, auth_config,
  context_config, alert_threshold, auto_scan, last_scan_at,
  last_scan_status, openapi_spec_id, created_at, updated_at
`;

const DAST_SCAN_COLUMNS = `
  id, project_id, target_url, scan_profile, status,
  started_at, completed_at, alerts, summary, statistics,
  error, endpoints_tested, scope_config, progress, created_at, updated_at
`;

const DAST_FALSE_POSITIVE_COLUMNS = `
  id, project_id, plugin_id, url, param, reason, marked_by, marked_at
`;

const OPENAPI_SPEC_COLUMNS = `
  id, project_id, name, version, content, endpoints, uploaded_at, uploaded_by
`;

const DAST_SCHEDULE_COLUMNS = `
  id, project_id, organization_id, name, description, frequency,
  cron_expression, timezone, enabled, scan_profile, target_url,
  notify_on_failure, notify_on_high_severity, email_recipients,
  created_at, updated_at, created_by, next_run_at, last_run_at,
  last_run_id, run_count
`;

const GRAPHQL_SCAN_COLUMNS = `
  id, config, status, started_at, completed_at, schema,
  operations_tested, findings, summary, progress, error, created_at, updated_at
`;

// ============================================
// Memory Store Accessors (DEPRECATED - return empty Maps)
// ============================================

export function getMemoryDastConfigs(): Map<string, DASTConfig> {
  log.warn('DEPRECATED: getMemoryDastConfigs() - memory maps removed');
  return new Map<string, DASTConfig>();
}

export function getMemoryDastScans(): Map<string, DASTScanResult[]> {
  log.warn('DEPRECATED: getMemoryDastScans() - memory maps removed');
  return new Map<string, DASTScanResult[]>();
}

export function getMemoryDastFalsePositives(): Map<string, DASTFalsePositive[]> {
  log.warn('DEPRECATED: getMemoryDastFalsePositives() - memory maps removed');
  return new Map<string, DASTFalsePositive[]>();
}

export function getMemoryOpenApiSpecs(): Map<string, OpenAPISpec> {
  log.warn('DEPRECATED: getMemoryOpenApiSpecs() - memory maps removed');
  return new Map<string, OpenAPISpec>();
}

export function getMemoryDastSchedules(): Map<string, DASTSchedule> {
  log.warn('DEPRECATED: getMemoryDastSchedules() - memory maps removed');
  return new Map<string, DASTSchedule>();
}

export function getMemoryGraphqlScans(): Map<string, GraphQLScan> {
  log.warn('DEPRECATED: getMemoryGraphqlScans() - memory maps removed');
  return new Map<string, GraphQLScan>();
}

// ============================================
// DAST Config Operations
// ============================================

export async function getDastConfig(projectId: string): Promise<DASTConfig | null> {
  if (isDatabaseConnected()) {
    const result = await query<DastConfigRow>(
      `SELECT ${DAST_CONFIG_COLUMNS} FROM dast_configs WHERE project_id = $1`,
      [projectId]
    );
    if (result && result.rows[0]) {
      return parseDastConfigRow(result.rows[0]);
    }
    return null;
  }
  return null;
}

export async function saveDastConfig(projectId: string, config: DASTConfig): Promise<DASTConfig> {
  if (isDatabaseConnected()) {
    const result = await query<DastConfigRow>(
      `INSERT INTO dast_configs (
        project_id, enabled, target_url, scan_profile, auth_config,
        context_config, alert_threshold, auto_scan, last_scan_at,
        last_scan_status, openapi_spec_id, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (project_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        target_url = EXCLUDED.target_url,
        scan_profile = EXCLUDED.scan_profile,
        auth_config = EXCLUDED.auth_config,
        context_config = EXCLUDED.context_config,
        alert_threshold = EXCLUDED.alert_threshold,
        auto_scan = EXCLUDED.auto_scan,
        last_scan_at = EXCLUDED.last_scan_at,
        last_scan_status = EXCLUDED.last_scan_status,
        openapi_spec_id = EXCLUDED.openapi_spec_id,
        updated_at = NOW()
      RETURNING *`,
      [
        projectId,
        config.enabled,
        config.targetUrl,
        config.scanProfile,
        JSON.stringify(config.authConfig || null),
        JSON.stringify(config.contextConfig || null),
        config.alertThreshold,
        config.autoScan,
        config.lastScanAt || null,
        config.lastScanStatus || null,
        config.openApiSpecId || null,
      ]
    );
    if (result && result.rows[0]) {
      return parseDastConfigRow(result.rows[0]);
    }
  }
  return config;
}

export async function deleteDastConfig(projectId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      'DELETE FROM dast_configs WHERE project_id = $1',
      [projectId]
    );
    return (result?.rowCount ?? 0) > 0;
  }
  return false;
}

function parseDastConfigRow(row: DastConfigRow): DASTConfig {
  return {
    enabled: row.enabled,
    targetUrl: row.target_url,
    scanProfile: row.scan_profile as DASTConfig['scanProfile'],
    authConfig: row.auth_config as DASTConfig['authConfig'],
    contextConfig: row.context_config as DASTConfig['contextConfig'],
    alertThreshold: row.alert_threshold as DASTConfig['alertThreshold'],
    autoScan: row.auto_scan,
    lastScanAt: row.last_scan_at?.toISOString(),
    lastScanStatus: row.last_scan_status as DASTConfig['lastScanStatus'],
    openApiSpecId: row.openapi_spec_id ?? undefined,
  };
}

// ============================================
// DAST Scan Operations
// ============================================

export async function createDastScan(scan: DASTScanResult): Promise<DASTScanResult> {
  if (isDatabaseConnected()) {
    const result = await query<DastScanRow>(
      `INSERT INTO dast_scans (
        id, project_id, target_url, scan_profile, status,
        started_at, completed_at, alerts, summary, statistics,
        error, endpoints_tested, scope_config, progress
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        scan.id,
        scan.projectId,
        scan.targetUrl,
        scan.scanProfile,
        scan.status,
        scan.startedAt,
        scan.completedAt || null,
        JSON.stringify(scan.alerts || []),
        JSON.stringify(scan.summary),
        JSON.stringify(scan.statistics || null),
        scan.error || null,
        JSON.stringify(scan.endpointsTested || null),
        JSON.stringify(scan.scopeConfig || null),
        JSON.stringify(scan.progress || null),
      ]
    );
    if (result && result.rows[0]) {
      return parseDastScanRow(result.rows[0]);
    }
  }
  return scan;
}

export async function getDastScan(scanId: string): Promise<DASTScanResult | null> {
  if (isDatabaseConnected()) {
    const result = await query<DastScanRow>(
      `SELECT ${DAST_SCAN_COLUMNS} FROM dast_scans WHERE id = $1`,
      [scanId]
    );
    if (result && result.rows[0]) {
      return parseDastScanRow(result.rows[0]);
    }
    return null;
  }
  return null;
}

export async function updateDastScan(scanId: string, updates: Partial<DASTScanResult>): Promise<DASTScanResult | null> {
  if (isDatabaseConnected()) {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.completedAt !== undefined) {
      setClauses.push(`completed_at = $${paramIndex++}`);
      values.push(updates.completedAt);
    }
    if (updates.alerts !== undefined) {
      setClauses.push(`alerts = $${paramIndex++}`);
      values.push(JSON.stringify(updates.alerts));
    }
    if (updates.summary !== undefined) {
      setClauses.push(`summary = $${paramIndex++}`);
      values.push(JSON.stringify(updates.summary));
    }
    if (updates.statistics !== undefined) {
      setClauses.push(`statistics = $${paramIndex++}`);
      values.push(JSON.stringify(updates.statistics));
    }
    if (updates.error !== undefined) {
      setClauses.push(`error = $${paramIndex++}`);
      values.push(updates.error);
    }
    if (updates.endpointsTested !== undefined) {
      setClauses.push(`endpoints_tested = $${paramIndex++}`);
      values.push(JSON.stringify(updates.endpointsTested));
    }
    if (updates.scopeConfig !== undefined) {
      setClauses.push(`scope_config = $${paramIndex++}`);
      values.push(JSON.stringify(updates.scopeConfig));
    }
    if (updates.progress !== undefined) {
      setClauses.push(`progress = $${paramIndex++}`);
      values.push(JSON.stringify(updates.progress));
    }

    if (setClauses.length === 0) {
      return getDastScan(scanId);
    }

    values.push(scanId);
    const result = await query<DastScanRow>(
      `UPDATE dast_scans SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    if (result && result.rows[0]) {
      return parseDastScanRow(result.rows[0]);
    }
    return null;
  }
  return null;
}

export async function getDastScansByProject(projectId: string): Promise<DASTScanResult[]> {
  if (isDatabaseConnected()) {
    const result = await query<DastScanRow>(
      `SELECT ${DAST_SCAN_COLUMNS} FROM dast_scans WHERE project_id = $1 ORDER BY started_at DESC`,
      [projectId]
    );
    if (result) {
      return result.rows.map(parseDastScanRow);
    }
    return [];
  }
  return [];
}

/**
 * Feature #124: Get DAST scans for all projects in an organization
 * Uses a single JOIN query instead of N+1 queries (one per project)
 */
export async function getDastScansByOrg(
  orgId: string,
  options?: { since?: Date; limit?: number }
): Promise<DASTScanResult[]> {
  if (isDatabaseConnected()) {
    const conditions = ['p.organization_id = $1'];
    const params: unknown[] = [orgId];
    let paramIndex = 2;

    if (options?.since) {
      conditions.push(`s.started_at >= $${paramIndex++}`);
      params.push(options.since.toISOString());
    }

    const limitClause = options?.limit ? `LIMIT ${options.limit}` : '';

    const result = await query<DastScanRow>(
      `SELECT s.* FROM dast_scans s
       INNER JOIN projects p ON s.project_id = p.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.started_at DESC ${limitClause}`,
      params
    );
    if (result) {
      return result.rows.map(parseDastScanRow);
    }
    return [];
  }
  return [];
}

export async function deleteDastScan(scanId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      'DELETE FROM dast_scans WHERE id = $1',
      [scanId]
    );
    return (result?.rowCount ?? 0) > 0;
  }
  return false;
}

function parseDastScanRow(row: DastScanRow): DASTScanResult {
  const startedAt = row.started_at instanceof Date ? row.started_at.toISOString() : row.started_at;
  const completedAt = row.completed_at instanceof Date ? row.completed_at.toISOString() : (row.completed_at ?? undefined);
  return {
    id: row.id,
    projectId: row.project_id,
    targetUrl: row.target_url,
    scanProfile: row.scan_profile as DASTScanResult['scanProfile'],
    status: row.status as DASTScanResult['status'],
    startedAt,
    completedAt,
    alerts: (row.alerts || []) as DASTScanResult['alerts'],
    summary: (row.summary || { total: 0, byRisk: { high: 0, medium: 0, low: 0, informational: 0 }, byConfidence: { high: 0, medium: 0, low: 0 } }) as DASTScanResult['summary'],
    statistics: row.statistics as DASTScanResult['statistics'],
    error: row.error ?? undefined,
    endpointsTested: (row.endpoints_tested ?? undefined) as unknown as DASTScanResult['endpointsTested'],
    scopeConfig: row.scope_config as DASTScanResult['scopeConfig'],
    progress: row.progress as DASTScanResult['progress'],
  };
}

// ============================================
// DAST False Positive Operations
// ============================================

export async function addDastFalsePositive(fp: DASTFalsePositive): Promise<DASTFalsePositive> {
  if (isDatabaseConnected()) {
    const result = await query<DastFalsePositiveRow>(
      `INSERT INTO dast_false_positives (
        id, project_id, plugin_id, url, param, reason, marked_by, marked_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        fp.id,
        fp.projectId,
        fp.pluginId,
        fp.url,
        fp.param || null,
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

export async function getDastFalsePositives(projectId: string): Promise<DASTFalsePositive[]> {
  if (isDatabaseConnected()) {
    const result = await query<DastFalsePositiveRow>(
      `SELECT ${DAST_FALSE_POSITIVE_COLUMNS} FROM dast_false_positives WHERE project_id = $1 ORDER BY marked_at DESC`,
      [projectId]
    );
    if (result) {
      return result.rows.map(parseFalsePositiveRow);
    }
    return [];
  }
  return [];
}

export async function deleteDastFalsePositive(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      'DELETE FROM dast_false_positives WHERE id = $1',
      [id]
    );
    return (result?.rowCount ?? 0) > 0;
  }
  return false;
}

export async function checkFalsePositive(projectId: string, pluginId: string, url: string, param?: string): Promise<DASTFalsePositive | null> {
  if (isDatabaseConnected()) {
    const result = await query<DastFalsePositiveRow>(
      `SELECT ${DAST_FALSE_POSITIVE_COLUMNS} FROM dast_false_positives
       WHERE project_id = $1 AND plugin_id = $2 AND url = $3
       AND (param = $4 OR (param IS NULL AND $4 IS NULL))`,
      [projectId, pluginId, url, param || null]
    );
    if (result && result.rows[0]) {
      return parseFalsePositiveRow(result.rows[0]);
    }
    return null;
  }
  return null;
}

function parseFalsePositiveRow(row: DastFalsePositiveRow): DASTFalsePositive {
  const markedAt = row.marked_at instanceof Date ? row.marked_at.toISOString() : row.marked_at;
  return {
    id: row.id,
    projectId: row.project_id,
    pluginId: row.plugin_id,
    url: row.url,
    param: row.param ?? undefined,
    reason: row.reason,
    markedBy: row.marked_by,
    markedAt,
  };
}

// ============================================
// OpenAPI Spec Operations
// ============================================

export async function saveOpenApiSpec(spec: OpenAPISpec): Promise<OpenAPISpec> {
  if (isDatabaseConnected()) {
    const result = await query<OpenApiSpecRow>(
      `INSERT INTO openapi_specs (
        id, project_id, name, version, content, endpoints, uploaded_at, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        version = EXCLUDED.version,
        content = EXCLUDED.content,
        endpoints = EXCLUDED.endpoints,
        uploaded_at = EXCLUDED.uploaded_at,
        uploaded_by = EXCLUDED.uploaded_by
      RETURNING *`,
      [
        spec.id,
        spec.projectId,
        spec.name,
        spec.version,
        spec.content,
        JSON.stringify(spec.endpoints),
        spec.uploadedAt,
        spec.uploadedBy,
      ]
    );
    if (result && result.rows[0]) {
      return parseOpenApiSpecRow(result.rows[0]);
    }
  }
  return spec;
}

export async function getOpenApiSpec(specId: string): Promise<OpenAPISpec | null> {
  if (isDatabaseConnected()) {
    const result = await query<OpenApiSpecRow>(
      `SELECT ${OPENAPI_SPEC_COLUMNS} FROM openapi_specs WHERE id = $1`,
      [specId]
    );
    if (result && result.rows[0]) {
      return parseOpenApiSpecRow(result.rows[0]);
    }
    return null;
  }
  return null;
}

export async function getOpenApiSpecsByProject(projectId: string): Promise<OpenAPISpec[]> {
  if (isDatabaseConnected()) {
    const result = await query<OpenApiSpecRow>(
      `SELECT ${OPENAPI_SPEC_COLUMNS} FROM openapi_specs WHERE project_id = $1 ORDER BY uploaded_at DESC`,
      [projectId]
    );
    if (result) {
      return result.rows.map(parseOpenApiSpecRow);
    }
    return [];
  }
  return [];
}

export async function deleteOpenApiSpec(specId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      'DELETE FROM openapi_specs WHERE id = $1',
      [specId]
    );
    return (result?.rowCount ?? 0) > 0;
  }
  return false;
}

function parseOpenApiSpecRow(row: OpenApiSpecRow): OpenAPISpec {
  const uploadedAt = row.uploaded_at instanceof Date ? row.uploaded_at.toISOString() : row.uploaded_at;
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    version: row.version,
    content: row.content as unknown as string,
    endpoints: (row.endpoints || []) as OpenAPISpec['endpoints'],
    uploadedAt,
    uploadedBy: row.uploaded_by,
  };
}

// ============================================
// DAST Schedule Operations
// ============================================

export async function createDastSchedule(schedule: DASTSchedule): Promise<DASTSchedule> {
  if (isDatabaseConnected()) {
    const result = await query<DastScheduleRow>(
      `INSERT INTO dast_schedules (
        id, project_id, organization_id, name, description, frequency,
        cron_expression, timezone, enabled, scan_profile, target_url,
        notify_on_failure, notify_on_high_severity, email_recipients,
        created_at, updated_at, created_by, next_run_at, last_run_at,
        last_run_id, run_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *`,
      [
        schedule.id,
        schedule.projectId,
        schedule.organizationId,
        schedule.name,
        schedule.description || null,
        schedule.frequency,
        schedule.cronExpression,
        schedule.timezone,
        schedule.enabled,
        schedule.scanProfile,
        schedule.targetUrl,
        schedule.notifyOnFailure,
        schedule.notifyOnHighSeverity,
        JSON.stringify(schedule.emailRecipients || []),
        schedule.createdAt,
        schedule.updatedAt,
        schedule.createdBy,
        schedule.nextRunAt || null,
        schedule.lastRunAt || null,
        schedule.lastRunId || null,
        schedule.runCount,
      ]
    );
    if (result && result.rows[0]) {
      return parseDastScheduleRow(result.rows[0]);
    }
  }
  return schedule;
}

export async function getDastSchedule(scheduleId: string): Promise<DASTSchedule | null> {
  if (isDatabaseConnected()) {
    const result = await query<DastScheduleRow>(
      `SELECT ${DAST_SCHEDULE_COLUMNS} FROM dast_schedules WHERE id = $1`,
      [scheduleId]
    );
    if (result && result.rows[0]) {
      return parseDastScheduleRow(result.rows[0]);
    }
    return null;
  }
  return null;
}

export async function getDastSchedulesByProject(projectId: string): Promise<DASTSchedule[]> {
  if (isDatabaseConnected()) {
    const result = await query<DastScheduleRow>(
      `SELECT ${DAST_SCHEDULE_COLUMNS} FROM dast_schedules WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId]
    );
    if (result) {
      return result.rows.map(parseDastScheduleRow);
    }
    return [];
  }
  return [];
}

export async function updateDastSchedule(scheduleId: string, updates: Partial<DASTSchedule>): Promise<DASTSchedule | null> {
  if (isDatabaseConnected()) {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.frequency !== undefined) {
      setClauses.push(`frequency = $${paramIndex++}`);
      values.push(updates.frequency);
    }
    if (updates.cronExpression !== undefined) {
      setClauses.push(`cron_expression = $${paramIndex++}`);
      values.push(updates.cronExpression);
    }
    if (updates.timezone !== undefined) {
      setClauses.push(`timezone = $${paramIndex++}`);
      values.push(updates.timezone);
    }
    if (updates.enabled !== undefined) {
      setClauses.push(`enabled = $${paramIndex++}`);
      values.push(updates.enabled);
    }
    if (updates.scanProfile !== undefined) {
      setClauses.push(`scan_profile = $${paramIndex++}`);
      values.push(updates.scanProfile);
    }
    if (updates.targetUrl !== undefined) {
      setClauses.push(`target_url = $${paramIndex++}`);
      values.push(updates.targetUrl);
    }
    if (updates.notifyOnFailure !== undefined) {
      setClauses.push(`notify_on_failure = $${paramIndex++}`);
      values.push(updates.notifyOnFailure);
    }
    if (updates.notifyOnHighSeverity !== undefined) {
      setClauses.push(`notify_on_high_severity = $${paramIndex++}`);
      values.push(updates.notifyOnHighSeverity);
    }
    if (updates.emailRecipients !== undefined) {
      setClauses.push(`email_recipients = $${paramIndex++}`);
      values.push(JSON.stringify(updates.emailRecipients));
    }
    if (updates.nextRunAt !== undefined) {
      setClauses.push(`next_run_at = $${paramIndex++}`);
      values.push(updates.nextRunAt);
    }
    if (updates.lastRunAt !== undefined) {
      setClauses.push(`last_run_at = $${paramIndex++}`);
      values.push(updates.lastRunAt);
    }
    if (updates.lastRunId !== undefined) {
      setClauses.push(`last_run_id = $${paramIndex++}`);
      values.push(updates.lastRunId);
    }
    if (updates.runCount !== undefined) {
      setClauses.push(`run_count = $${paramIndex++}`);
      values.push(updates.runCount);
    }

    if (setClauses.length === 0) {
      return getDastSchedule(scheduleId);
    }

    values.push(scheduleId);
    const result = await query<DastScheduleRow>(
      `UPDATE dast_schedules SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    if (result && result.rows[0]) {
      return parseDastScheduleRow(result.rows[0]);
    }
    return null;
  }
  return null;
}

export async function deleteDastSchedule(scheduleId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      'DELETE FROM dast_schedules WHERE id = $1',
      [scheduleId]
    );
    return (result?.rowCount ?? 0) > 0;
  }
  return false;
}

export async function getEnabledDastSchedules(): Promise<DASTSchedule[]> {
  if (isDatabaseConnected()) {
    const result = await query<DastScheduleRow>(
      `SELECT ${DAST_SCHEDULE_COLUMNS} FROM dast_schedules WHERE enabled = true ORDER BY next_run_at ASC`,
      []
    );
    if (result) {
      return result.rows.map(parseDastScheduleRow);
    }
    return [];
  }
  return [];
}

function parseDastScheduleRow(row: DastScheduleRow): DASTSchedule {
  const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
  const updatedAt = row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at;
  const nextRunAt = row.next_run_at instanceof Date ? row.next_run_at.toISOString() : (row.next_run_at ?? undefined);
  const lastRunAt = row.last_run_at instanceof Date ? row.last_run_at.toISOString() : (row.last_run_at ?? undefined);
  return {
    id: row.id,
    projectId: row.project_id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description ?? undefined,
    frequency: row.frequency as DASTSchedule['frequency'],
    cronExpression: row.cron_expression,
    timezone: row.timezone,
    enabled: row.enabled,
    scanProfile: row.scan_profile as DASTSchedule['scanProfile'],
    targetUrl: row.target_url,
    notifyOnFailure: row.notify_on_failure,
    notifyOnHighSeverity: row.notify_on_high_severity,
    emailRecipients: row.email_recipients || [],
    createdAt,
    updatedAt,
    createdBy: row.created_by,
    nextRunAt,
    lastRunAt,
    lastRunId: row.last_run_id ?? undefined,
    runCount: row.run_count,
  };
}

// ============================================
// GraphQL Scan Operations
// ============================================

export async function createGraphqlScan(scan: GraphQLScan): Promise<GraphQLScan> {
  if (isDatabaseConnected()) {
    const result = await query<GraphqlScanRow>(
      `INSERT INTO graphql_scans (
        id, config, status, started_at, completed_at, schema,
        operations_tested, findings, summary, progress, error
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        scan.id,
        JSON.stringify(scan.config),
        scan.status,
        scan.startedAt,
        scan.completedAt || null,
        JSON.stringify(scan.schema || null),
        JSON.stringify(scan.operationsTested),
        JSON.stringify(scan.findings),
        JSON.stringify(scan.summary),
        JSON.stringify(scan.progress || null),
        scan.error || null,
      ]
    );
    if (result && result.rows[0]) {
      return parseGraphqlScanRow(result.rows[0]);
    }
  }
  return scan;
}

export async function getGraphqlScan(scanId: string): Promise<GraphQLScan | null> {
  if (isDatabaseConnected()) {
    const result = await query<GraphqlScanRow>(
      `SELECT ${GRAPHQL_SCAN_COLUMNS} FROM graphql_scans WHERE id = $1`,
      [scanId]
    );
    if (result && result.rows[0]) {
      return parseGraphqlScanRow(result.rows[0]);
    }
    return null;
  }
  return null;
}

export async function updateGraphqlScan(scanId: string, updates: Partial<GraphQLScan>): Promise<GraphQLScan | null> {
  if (isDatabaseConnected()) {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.completedAt !== undefined) {
      setClauses.push(`completed_at = $${paramIndex++}`);
      values.push(updates.completedAt);
    }
    if (updates.schema !== undefined) {
      setClauses.push(`schema = $${paramIndex++}`);
      values.push(JSON.stringify(updates.schema));
    }
    if (updates.operationsTested !== undefined) {
      setClauses.push(`operations_tested = $${paramIndex++}`);
      values.push(JSON.stringify(updates.operationsTested));
    }
    if (updates.findings !== undefined) {
      setClauses.push(`findings = $${paramIndex++}`);
      values.push(JSON.stringify(updates.findings));
    }
    if (updates.summary !== undefined) {
      setClauses.push(`summary = $${paramIndex++}`);
      values.push(JSON.stringify(updates.summary));
    }
    if (updates.progress !== undefined) {
      setClauses.push(`progress = $${paramIndex++}`);
      values.push(JSON.stringify(updates.progress));
    }
    if (updates.error !== undefined) {
      setClauses.push(`error = $${paramIndex++}`);
      values.push(updates.error);
    }

    if (setClauses.length === 0) {
      return getGraphqlScan(scanId);
    }

    values.push(scanId);
    const result = await query<GraphqlScanRow>(
      `UPDATE graphql_scans SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    if (result && result.rows[0]) {
      return parseGraphqlScanRow(result.rows[0]);
    }
    return null;
  }
  return null;
}

export async function deleteGraphqlScan(scanId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      'DELETE FROM graphql_scans WHERE id = $1',
      [scanId]
    );
    return (result?.rowCount ?? 0) > 0;
  }
  return false;
}

export async function listGraphqlScans(): Promise<GraphQLScan[]> {
  if (isDatabaseConnected()) {
    const result = await query<GraphqlScanRow>(
      `SELECT ${GRAPHQL_SCAN_COLUMNS} FROM graphql_scans ORDER BY started_at DESC`,
      []
    );
    if (result) {
      return result.rows.map(parseGraphqlScanRow);
    }
    return [];
  }
  return [];
}

function parseGraphqlScanRow(row: GraphqlScanRow): GraphQLScan {
  const startedAt = row.started_at instanceof Date ? row.started_at.toISOString() : row.started_at;
  const completedAt = row.completed_at instanceof Date ? row.completed_at.toISOString() : (row.completed_at ?? undefined);
  return {
    id: row.id,
    config: row.config as unknown as GraphQLScan['config'],
    status: row.status as GraphQLScan['status'],
    startedAt,
    completedAt,
    schema: (row.schema ?? undefined) as unknown as GraphQLScan['schema'],
    operationsTested: (row.operations_tested || []) as GraphQLScan['operationsTested'],
    findings: (row.findings || []) as GraphQLScan['findings'],
    summary: (row.summary || { totalOperations: 0, queriesTested: 0, mutationsTested: 0, totalFindings: 0, bySeverity: { high: 0, medium: 0, low: 0, informational: 0 } }) as GraphQLScan['summary'],
    progress: row.progress as GraphQLScan['progress'],
    error: row.error ?? undefined,
  };
}
