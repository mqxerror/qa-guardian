/**
 * DAST Repository - PostgreSQL persistence for DAST module
 *
 * Feature #2088: Migrate DAST Module to PostgreSQL
 *
 * Provides CRUD operations for:
 * - DAST configurations per project
 * - DAST scan results with alerts
 * - False positive tracking
 * - OpenAPI specifications
 * - DAST schedules
 * - GraphQL scans
 */

import { query, isDatabaseConnected } from '../database';
import {
  DASTConfig,
  DASTScanResult,
  DASTFalsePositive,
  OpenAPISpec,
  DASTSchedule,
  GraphQLScan,
} from '../../routes/dast/types';

// Memory fallback stores
const memoryDastConfigs: Map<string, DASTConfig> = new Map();
const memoryDastScans: Map<string, DASTScanResult[]> = new Map();
const memoryDastFalsePositives: Map<string, DASTFalsePositive[]> = new Map();
const memoryOpenApiSpecs: Map<string, OpenAPISpec> = new Map();
const memoryDastSchedules: Map<string, DASTSchedule> = new Map();
const memoryGraphqlScans: Map<string, GraphQLScan> = new Map();

// ============================================
// Memory Store Accessors (for backward compatibility)
// ============================================

export function getMemoryDastConfigs(): Map<string, DASTConfig> {
  return memoryDastConfigs;
}

export function getMemoryDastScans(): Map<string, DASTScanResult[]> {
  return memoryDastScans;
}

export function getMemoryDastFalsePositives(): Map<string, DASTFalsePositive[]> {
  return memoryDastFalsePositives;
}

export function getMemoryOpenApiSpecs(): Map<string, OpenAPISpec> {
  return memoryOpenApiSpecs;
}

export function getMemoryDastSchedules(): Map<string, DASTSchedule> {
  return memoryDastSchedules;
}

export function getMemoryGraphqlScans(): Map<string, GraphQLScan> {
  return memoryGraphqlScans;
}

// ============================================
// DAST Config Operations
// ============================================

export async function getDastConfig(projectId: string): Promise<DASTConfig | null> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM dast_configs WHERE project_id = $1',
      [projectId]
    );
    if (result && result.rows[0]) {
      return parseDastConfigRow(result.rows[0]);
    }
    return null;
  }
  return memoryDastConfigs.get(projectId) || null;
}

export async function saveDastConfig(projectId: string, config: DASTConfig): Promise<DASTConfig> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
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
  memoryDastConfigs.set(projectId, config);
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
  return memoryDastConfigs.delete(projectId);
}

function parseDastConfigRow(row: any): DASTConfig {
  return {
    enabled: row.enabled,
    targetUrl: row.target_url,
    scanProfile: row.scan_profile,
    authConfig: row.auth_config,
    contextConfig: row.context_config,
    alertThreshold: row.alert_threshold,
    autoScan: row.auto_scan,
    lastScanAt: row.last_scan_at?.toISOString(),
    lastScanStatus: row.last_scan_status,
    openApiSpecId: row.openapi_spec_id,
  };
}

// ============================================
// DAST Scan Operations
// ============================================

export async function createDastScan(scan: DASTScanResult): Promise<DASTScanResult> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
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
  // Memory fallback
  const scans = memoryDastScans.get(scan.projectId) || [];
  scans.push(scan);
  memoryDastScans.set(scan.projectId, scans);
  return scan;
}

export async function getDastScan(scanId: string): Promise<DASTScanResult | null> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM dast_scans WHERE id = $1',
      [scanId]
    );
    if (result && result.rows[0]) {
      return parseDastScanRow(result.rows[0]);
    }
    return null;
  }
  // Memory fallback - search all projects
  for (const scans of memoryDastScans.values()) {
    const scan = scans.find(s => s.id === scanId);
    if (scan) return scan;
  }
  return null;
}

export async function updateDastScan(scanId: string, updates: Partial<DASTScanResult>): Promise<DASTScanResult | null> {
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
    const result = await query<any>(
      `UPDATE dast_scans SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    if (result && result.rows[0]) {
      return parseDastScanRow(result.rows[0]);
    }
    return null;
  }

  // Memory fallback
  for (const [projectId, scans] of memoryDastScans.entries()) {
    const index = scans.findIndex(s => s.id === scanId);
    if (index !== -1) {
      scans[index] = { ...scans[index], ...updates };
      return scans[index];
    }
  }
  return null;
}

export async function getDastScansByProject(projectId: string): Promise<DASTScanResult[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM dast_scans WHERE project_id = $1 ORDER BY started_at DESC',
      [projectId]
    );
    if (result) {
      return result.rows.map(parseDastScanRow);
    }
    return [];
  }
  return memoryDastScans.get(projectId) || [];
}

export async function deleteDastScan(scanId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      'DELETE FROM dast_scans WHERE id = $1',
      [scanId]
    );
    return (result?.rowCount ?? 0) > 0;
  }
  // Memory fallback
  for (const [projectId, scans] of memoryDastScans.entries()) {
    const index = scans.findIndex(s => s.id === scanId);
    if (index !== -1) {
      scans.splice(index, 1);
      return true;
    }
  }
  return false;
}

function parseDastScanRow(row: any): DASTScanResult {
  return {
    id: row.id,
    projectId: row.project_id,
    targetUrl: row.target_url,
    scanProfile: row.scan_profile,
    status: row.status,
    startedAt: row.started_at?.toISOString() || row.started_at,
    completedAt: row.completed_at?.toISOString() || row.completed_at,
    alerts: row.alerts || [],
    summary: row.summary || { total: 0, byRisk: { high: 0, medium: 0, low: 0, informational: 0 }, byConfidence: { high: 0, medium: 0, low: 0 } },
    statistics: row.statistics,
    error: row.error,
    endpointsTested: row.endpoints_tested,
    scopeConfig: row.scope_config,
    progress: row.progress,
  };
}

// ============================================
// DAST False Positive Operations
// ============================================

export async function addDastFalsePositive(fp: DASTFalsePositive): Promise<DASTFalsePositive> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
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
  // Memory fallback
  const fps = memoryDastFalsePositives.get(fp.projectId) || [];
  fps.push(fp);
  memoryDastFalsePositives.set(fp.projectId, fps);
  return fp;
}

export async function getDastFalsePositives(projectId: string): Promise<DASTFalsePositive[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM dast_false_positives WHERE project_id = $1 ORDER BY marked_at DESC',
      [projectId]
    );
    if (result) {
      return result.rows.map(parseFalsePositiveRow);
    }
    return [];
  }
  return memoryDastFalsePositives.get(projectId) || [];
}

export async function deleteDastFalsePositive(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      'DELETE FROM dast_false_positives WHERE id = $1',
      [id]
    );
    return (result?.rowCount ?? 0) > 0;
  }
  // Memory fallback
  for (const [projectId, fps] of memoryDastFalsePositives.entries()) {
    const index = fps.findIndex(fp => fp.id === id);
    if (index !== -1) {
      fps.splice(index, 1);
      return true;
    }
  }
  return false;
}

export async function checkFalsePositive(projectId: string, pluginId: string, url: string, param?: string): Promise<DASTFalsePositive | null> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM dast_false_positives
       WHERE project_id = $1 AND plugin_id = $2 AND url = $3
       AND (param = $4 OR (param IS NULL AND $4 IS NULL))`,
      [projectId, pluginId, url, param || null]
    );
    if (result && result.rows[0]) {
      return parseFalsePositiveRow(result.rows[0]);
    }
    return null;
  }
  const fps = memoryDastFalsePositives.get(projectId) || [];
  return fps.find(fp => fp.pluginId === pluginId && fp.url === url && fp.param === param) || null;
}

function parseFalsePositiveRow(row: any): DASTFalsePositive {
  return {
    id: row.id,
    projectId: row.project_id,
    pluginId: row.plugin_id,
    url: row.url,
    param: row.param,
    reason: row.reason,
    markedBy: row.marked_by,
    markedAt: row.marked_at?.toISOString() || row.marked_at,
  };
}

// ============================================
// OpenAPI Spec Operations
// ============================================

export async function saveOpenApiSpec(spec: OpenAPISpec): Promise<OpenAPISpec> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
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
  memoryOpenApiSpecs.set(spec.id, spec);
  return spec;
}

export async function getOpenApiSpec(specId: string): Promise<OpenAPISpec | null> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM openapi_specs WHERE id = $1',
      [specId]
    );
    if (result && result.rows[0]) {
      return parseOpenApiSpecRow(result.rows[0]);
    }
    return null;
  }
  return memoryOpenApiSpecs.get(specId) || null;
}

export async function getOpenApiSpecsByProject(projectId: string): Promise<OpenAPISpec[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM openapi_specs WHERE project_id = $1 ORDER BY uploaded_at DESC',
      [projectId]
    );
    if (result) {
      return result.rows.map(parseOpenApiSpecRow);
    }
    return [];
  }
  return Array.from(memoryOpenApiSpecs.values()).filter(s => s.projectId === projectId);
}

export async function deleteOpenApiSpec(specId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      'DELETE FROM openapi_specs WHERE id = $1',
      [specId]
    );
    return (result?.rowCount ?? 0) > 0;
  }
  return memoryOpenApiSpecs.delete(specId);
}

function parseOpenApiSpecRow(row: any): OpenAPISpec {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    version: row.version,
    content: row.content,
    endpoints: row.endpoints || [],
    uploadedAt: row.uploaded_at?.toISOString() || row.uploaded_at,
    uploadedBy: row.uploaded_by,
  };
}

// ============================================
// DAST Schedule Operations
// ============================================

export async function createDastSchedule(schedule: DASTSchedule): Promise<DASTSchedule> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
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
  memoryDastSchedules.set(schedule.id, schedule);
  return schedule;
}

export async function getDastSchedule(scheduleId: string): Promise<DASTSchedule | null> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM dast_schedules WHERE id = $1',
      [scheduleId]
    );
    if (result && result.rows[0]) {
      return parseDastScheduleRow(result.rows[0]);
    }
    return null;
  }
  return memoryDastSchedules.get(scheduleId) || null;
}

export async function getDastSchedulesByProject(projectId: string): Promise<DASTSchedule[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM dast_schedules WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId]
    );
    if (result) {
      return result.rows.map(parseDastScheduleRow);
    }
    return [];
  }
  return Array.from(memoryDastSchedules.values()).filter(s => s.projectId === projectId);
}

export async function updateDastSchedule(scheduleId: string, updates: Partial<DASTSchedule>): Promise<DASTSchedule | null> {
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
    const result = await query<any>(
      `UPDATE dast_schedules SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    if (result && result.rows[0]) {
      return parseDastScheduleRow(result.rows[0]);
    }
    return null;
  }

  // Memory fallback
  const existing = memoryDastSchedules.get(scheduleId);
  if (existing) {
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    memoryDastSchedules.set(scheduleId, updated);
    return updated;
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
  return memoryDastSchedules.delete(scheduleId);
}

export async function getEnabledDastSchedules(): Promise<DASTSchedule[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM dast_schedules WHERE enabled = true ORDER BY next_run_at ASC',
      []
    );
    if (result) {
      return result.rows.map(parseDastScheduleRow);
    }
    return [];
  }
  return Array.from(memoryDastSchedules.values()).filter(s => s.enabled);
}

function parseDastScheduleRow(row: any): DASTSchedule {
  return {
    id: row.id,
    projectId: row.project_id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    frequency: row.frequency,
    cronExpression: row.cron_expression,
    timezone: row.timezone,
    enabled: row.enabled,
    scanProfile: row.scan_profile,
    targetUrl: row.target_url,
    notifyOnFailure: row.notify_on_failure,
    notifyOnHighSeverity: row.notify_on_high_severity,
    emailRecipients: row.email_recipients || [],
    createdAt: row.created_at?.toISOString() || row.created_at,
    updatedAt: row.updated_at?.toISOString() || row.updated_at,
    createdBy: row.created_by,
    nextRunAt: row.next_run_at?.toISOString() || row.next_run_at,
    lastRunAt: row.last_run_at?.toISOString() || row.last_run_at,
    lastRunId: row.last_run_id,
    runCount: row.run_count,
  };
}

// ============================================
// GraphQL Scan Operations
// ============================================

export async function createGraphqlScan(scan: GraphQLScan): Promise<GraphQLScan> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
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
  memoryGraphqlScans.set(scan.id, scan);
  return scan;
}

export async function getGraphqlScan(scanId: string): Promise<GraphQLScan | null> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM graphql_scans WHERE id = $1',
      [scanId]
    );
    if (result && result.rows[0]) {
      return parseGraphqlScanRow(result.rows[0]);
    }
    return null;
  }
  return memoryGraphqlScans.get(scanId) || null;
}

export async function updateGraphqlScan(scanId: string, updates: Partial<GraphQLScan>): Promise<GraphQLScan | null> {
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
    const result = await query<any>(
      `UPDATE graphql_scans SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    if (result && result.rows[0]) {
      return parseGraphqlScanRow(result.rows[0]);
    }
    return null;
  }

  // Memory fallback
  const existing = memoryGraphqlScans.get(scanId);
  if (existing) {
    const updated = { ...existing, ...updates };
    memoryGraphqlScans.set(scanId, updated);
    return updated;
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
  return memoryGraphqlScans.delete(scanId);
}

export async function listGraphqlScans(): Promise<GraphQLScan[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM graphql_scans ORDER BY started_at DESC',
      []
    );
    if (result) {
      return result.rows.map(parseGraphqlScanRow);
    }
    return [];
  }
  return Array.from(memoryGraphqlScans.values());
}

function parseGraphqlScanRow(row: any): GraphQLScan {
  return {
    id: row.id,
    config: row.config,
    status: row.status,
    startedAt: row.started_at?.toISOString() || row.started_at,
    completedAt: row.completed_at?.toISOString() || row.completed_at,
    schema: row.schema,
    operationsTested: row.operations_tested || [],
    findings: row.findings || [],
    summary: row.summary || { totalOperations: 0, queriesTested: 0, mutationsTested: 0, totalFindings: 0, bySeverity: { high: 0, medium: 0, low: 0, informational: 0 } },
    progress: row.progress,
    error: row.error,
  };
}
