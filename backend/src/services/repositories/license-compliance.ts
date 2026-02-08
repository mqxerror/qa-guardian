/**
 * License Compliance Repository
 * Feature #333: Persist license policies, SBOM, and dependency data to PostgreSQL
 *
 * Provides CRUD operations for:
 * - License policies
 * - License scan results
 * - SBOM entries
 * - Dependency analysis
 */

import { query, isDatabaseConnected } from '../database.js';
import type { QueryResult, QueryResultRow } from 'pg';

// Helper to handle potentially null query results (when database not connected)
function ensureResult<T extends QueryResultRow>(result: QueryResult<T> | null): QueryResult<T> {
  if (!result) {
    return { rows: [] as T[], rowCount: 0, command: '', oid: 0, fields: [] };
  }
  return result;
}

// ============================================================================
// Types
// ============================================================================

export interface LicensePolicy {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  allowed_licenses: string[];
  blocked_licenses: string[];
  policy_mode: 'strict' | 'warn' | 'disabled';
  fail_on_unknown: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface LicenseScanResult {
  id: string;
  project_id: string;
  organization_id: string;
  scanned_at: Date;
  scan_duration_ms: number | null;
  policy_id: string | null;
  total_packages: number;
  compliant_packages: number;
  violation_count: number;
  unknown_license_count: number;
  compliance_percentage: number;
  license_summary: Record<string, number>;
  violations: Array<{
    package: string;
    version: string;
    license: string;
    spdxId: string | null;
    violationType: string;
    severity: string;
    reason: string;
  }>;
  packages: Array<{
    name: string;
    version: string;
    license: string;
    spdxId: string | null;
  }> | null;
  status: 'completed' | 'failed' | 'partial';
  error_message: string | null;
  created_at: Date;
}

export interface SbomEntry {
  id: string;
  project_id: string;
  organization_id: string;
  format: 'cyclonedx' | 'spdx';
  spec_version: string;
  serial_number: string;
  generated_at: Date;
  generated_by: string;
  total_components: number;
  production_components: number;
  dev_components: number;
  unique_licenses: number;
  license_distribution: Record<string, number>;
  storage_location: 'database' | 'minio' | 'local';
  storage_bucket: string | null;
  storage_key: string | null;
  storage_path: string | null;
  filename: string;
  content_type: string;
  size_bytes: number | null;
  sbom_content: object | null;
  eo_14028_compliant: boolean;
  ntia_compliant: boolean;
  missing_elements: string[];
  created_at: Date;
}

export interface DependencyAnalysis {
  id: string;
  project_id: string;
  organization_id: string;
  analyzed_at: Date;
  analysis_duration_ms: number | null;
  total_dependencies: number;
  direct_dependencies: number;
  transitive_dependencies: number;
  production_dependencies: number;
  dev_dependencies: number;
  outdated_count: number;
  major_updates_available: number;
  minor_updates_available: number;
  patch_updates_available: number;
  vulnerable_count: number;
  critical_vulnerabilities: number;
  high_vulnerabilities: number;
  medium_vulnerabilities: number;
  low_vulnerabilities: number;
  health_score: number | null;
  outdated_packages: Array<{
    name: string;
    current: string;
    latest: string;
    updateType: 'major' | 'minor' | 'patch';
  }>;
  vulnerable_packages: Array<{
    name: string;
    version: string;
    vulnerabilities: Array<{
      id: string;
      severity: string;
      title: string;
    }>;
  }>;
  ecosystem: string;
  lockfile_path: string | null;
  status: 'completed' | 'failed' | 'partial';
  error_message: string | null;
  created_at: Date;
}

// ============================================================================
// License Policy CRUD
// ============================================================================

export async function createLicensePolicy(
  policy: Omit<LicensePolicy, 'id' | 'created_at' | 'updated_at'>
): Promise<LicensePolicy> {
  if (!isDatabaseConnected()) {
    throw new Error('Database not connected');
  }

  const result = ensureResult(await query(
    `INSERT INTO license_policies (
      organization_id, name, description, allowed_licenses, blocked_licenses,
      policy_mode, fail_on_unknown, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      policy.organization_id,
      policy.name,
      policy.description,
      policy.allowed_licenses,
      policy.blocked_licenses,
      policy.policy_mode,
      policy.fail_on_unknown,
      policy.is_active,
    ]
  ));

  if (!result.rows[0]) {
    throw new Error('Failed to create license policy');
  }
  return mapRowToLicensePolicy(result.rows[0]);
}

export async function getLicensePolicy(id: string): Promise<LicensePolicy | null> {
  if (!isDatabaseConnected()) return null;

  const result = ensureResult(await query('SELECT * FROM license_policies WHERE id = $1', [id]));
  return result.rows.length > 0 ? mapRowToLicensePolicy(result.rows[0]) : null;
}

export async function getLicensePolicyByOrg(organizationId: string): Promise<LicensePolicy | null> {
  if (!isDatabaseConnected()) return null;

  const result = ensureResult(await query(
    'SELECT * FROM license_policies WHERE organization_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
    [organizationId]
  ));
  return result.rows.length > 0 ? mapRowToLicensePolicy(result.rows[0]) : null;
}

export async function updateLicensePolicy(
  id: string,
  updates: Partial<Omit<LicensePolicy, 'id' | 'created_at' | 'updated_at'>>
): Promise<LicensePolicy | null> {
  if (!isDatabaseConnected()) return null;

  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }
  if (updates.allowed_licenses !== undefined) {
    fields.push(`allowed_licenses = $${paramIndex++}`);
    values.push(updates.allowed_licenses);
  }
  if (updates.blocked_licenses !== undefined) {
    fields.push(`blocked_licenses = $${paramIndex++}`);
    values.push(updates.blocked_licenses);
  }
  if (updates.policy_mode !== undefined) {
    fields.push(`policy_mode = $${paramIndex++}`);
    values.push(updates.policy_mode);
  }
  if (updates.fail_on_unknown !== undefined) {
    fields.push(`fail_on_unknown = $${paramIndex++}`);
    values.push(updates.fail_on_unknown);
  }
  if (updates.is_active !== undefined) {
    fields.push(`is_active = $${paramIndex++}`);
    values.push(updates.is_active);
  }

  if (fields.length === 0) return getLicensePolicy(id);

  values.push(id);
  const result = ensureResult(await query(
    `UPDATE license_policies SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  ));

  return result.rows.length > 0 ? mapRowToLicensePolicy(result.rows[0]) : null;
}

export async function deleteLicensePolicy(id: string): Promise<boolean> {
  if (!isDatabaseConnected()) return false;

  const result = ensureResult(await query('DELETE FROM license_policies WHERE id = $1', [id]));
  return (result.rowCount ?? 0) > 0;
}

function mapRowToLicensePolicy(row: Record<string, unknown>): LicensePolicy {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    name: row.name as string,
    description: row.description as string | null,
    allowed_licenses: row.allowed_licenses as string[],
    blocked_licenses: row.blocked_licenses as string[],
    policy_mode: row.policy_mode as 'strict' | 'warn' | 'disabled',
    fail_on_unknown: row.fail_on_unknown as boolean,
    is_active: row.is_active as boolean,
    created_at: new Date(row.created_at as string),
    updated_at: new Date(row.updated_at as string),
  };
}

// ============================================================================
// License Scan Results CRUD
// ============================================================================

export async function createLicenseScanResult(
  result: Omit<LicenseScanResult, 'id' | 'created_at'>
): Promise<LicenseScanResult> {
  if (!isDatabaseConnected()) {
    throw new Error('Database not connected');
  }

  const dbResult = ensureResult(await query(
    `INSERT INTO license_scan_results (
      project_id, organization_id, scanned_at, scan_duration_ms, policy_id,
      total_packages, compliant_packages, violation_count, unknown_license_count,
      compliance_percentage, license_summary, violations, packages, status, error_message
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *`,
    [
      result.project_id,
      result.organization_id,
      result.scanned_at,
      result.scan_duration_ms,
      result.policy_id,
      result.total_packages,
      result.compliant_packages,
      result.violation_count,
      result.unknown_license_count,
      result.compliance_percentage,
      JSON.stringify(result.license_summary),
      JSON.stringify(result.violations),
      result.packages ? JSON.stringify(result.packages) : null,
      result.status,
      result.error_message,
    ]
  ));

  return mapRowToLicenseScanResult(dbResult.rows[0]);
}

export async function getLicenseScanResults(
  projectId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ items: LicenseScanResult[]; total: number }> {
  if (!isDatabaseConnected()) return { items: [], total: 0 };

  const { limit = 20, offset = 0 } = options;

  const [resultsRaw, countResultRaw] = await Promise.all([
    query(
      `SELECT * FROM license_scan_results
       WHERE project_id = $1
       ORDER BY scanned_at DESC
       LIMIT $2 OFFSET $3`,
      [projectId, limit, offset]
    ),
    query(
      'SELECT COUNT(*) as total FROM license_scan_results WHERE project_id = $1',
      [projectId]
    ),
  ]);
  const results = ensureResult(resultsRaw);
  const countResult = ensureResult(countResultRaw);

  return {
    items: results.rows.map(mapRowToLicenseScanResult),
    total: parseInt(countResult.rows[0]?.total || '0', 10),
  };
}

export async function getLatestLicenseScan(projectId: string): Promise<LicenseScanResult | null> {
  if (!isDatabaseConnected()) return null;

  const result = ensureResult(await query(
    `SELECT * FROM license_scan_results
     WHERE project_id = $1
     ORDER BY scanned_at DESC
     LIMIT 1`,
    [projectId]
  ));

  return result.rows.length > 0 ? mapRowToLicenseScanResult(result.rows[0]) : null;
}

export async function deleteOldLicenseScans(daysToKeep: number = 90): Promise<number> {
  if (!isDatabaseConnected()) return 0;

  const result = ensureResult(await query(
    `DELETE FROM license_scan_results
     WHERE scanned_at < NOW() - $1 * INTERVAL '1 day'`,
    [daysToKeep]
  ));

  return result.rowCount ?? 0;
}

function mapRowToLicenseScanResult(row: Record<string, unknown>): LicenseScanResult {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    organization_id: row.organization_id as string,
    scanned_at: new Date(row.scanned_at as string),
    scan_duration_ms: row.scan_duration_ms as number | null,
    policy_id: row.policy_id as string | null,
    total_packages: row.total_packages as number,
    compliant_packages: row.compliant_packages as number,
    violation_count: row.violation_count as number,
    unknown_license_count: row.unknown_license_count as number,
    compliance_percentage: parseFloat(row.compliance_percentage as string),
    license_summary: row.license_summary as Record<string, number>,
    violations: row.violations as LicenseScanResult['violations'],
    packages: row.packages as LicenseScanResult['packages'],
    status: row.status as 'completed' | 'failed' | 'partial',
    error_message: row.error_message as string | null,
    created_at: new Date(row.created_at as string),
  };
}

// ============================================================================
// SBOM Entries CRUD
// ============================================================================

export async function createSbomEntry(
  entry: Omit<SbomEntry, 'id' | 'created_at'>
): Promise<SbomEntry> {
  if (!isDatabaseConnected()) {
    throw new Error('Database not connected');
  }

  const result = ensureResult(await query(
    `INSERT INTO sbom_entries (
      project_id, organization_id, format, spec_version, serial_number,
      generated_at, generated_by, total_components, production_components,
      dev_components, unique_licenses, license_distribution, storage_location,
      storage_bucket, storage_key, storage_path, filename, content_type,
      size_bytes, sbom_content, eo_14028_compliant, ntia_compliant, missing_elements
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
    RETURNING *`,
    [
      entry.project_id,
      entry.organization_id,
      entry.format,
      entry.spec_version,
      entry.serial_number,
      entry.generated_at,
      entry.generated_by,
      entry.total_components,
      entry.production_components,
      entry.dev_components,
      entry.unique_licenses,
      JSON.stringify(entry.license_distribution),
      entry.storage_location,
      entry.storage_bucket,
      entry.storage_key,
      entry.storage_path,
      entry.filename,
      entry.content_type,
      entry.size_bytes,
      entry.sbom_content ? JSON.stringify(entry.sbom_content) : null,
      entry.eo_14028_compliant,
      entry.ntia_compliant,
      entry.missing_elements,
    ]
  ));

  return mapRowToSbomEntry(result.rows[0]);
}

export async function getSbomEntries(
  projectId: string,
  options: { format?: 'cyclonedx' | 'spdx'; limit?: number; offset?: number } = {}
): Promise<{ items: SbomEntry[]; total: number }> {
  if (!isDatabaseConnected()) return { items: [], total: 0 };

  const { format, limit = 20, offset = 0 } = options;
  const params: unknown[] = [projectId, limit, offset];
  let whereClause = 'WHERE project_id = $1';

  if (format) {
    whereClause += ' AND format = $4';
    params.push(format);
  }

  const [resultsRaw, countResultRaw] = await Promise.all([
    query(
      `SELECT * FROM sbom_entries
       ${whereClause}
       ORDER BY generated_at DESC
       LIMIT $2 OFFSET $3`,
      params
    ),
    query(
      `SELECT COUNT(*) as total FROM sbom_entries ${whereClause}`,
      format ? [projectId, format] : [projectId]
    ),
  ]);
  const results = ensureResult(resultsRaw);
  const countResult = ensureResult(countResultRaw);

  return {
    items: results.rows.map(mapRowToSbomEntry),
    total: parseInt(countResult.rows[0]?.total || '0', 10),
  };
}

export async function getSbomEntry(id: string): Promise<SbomEntry | null> {
  if (!isDatabaseConnected()) return null;

  const result = ensureResult(await query('SELECT * FROM sbom_entries WHERE id = $1', [id]));
  return result.rows.length > 0 ? mapRowToSbomEntry(result.rows[0]) : null;
}

export async function getLatestSbom(
  projectId: string,
  format?: 'cyclonedx' | 'spdx'
): Promise<SbomEntry | null> {
  if (!isDatabaseConnected()) return null;

  const params: unknown[] = [projectId];
  let whereClause = 'WHERE project_id = $1';

  if (format) {
    whereClause += ' AND format = $2';
    params.push(format);
  }

  const result = ensureResult(await query(
    `SELECT * FROM sbom_entries
     ${whereClause}
     ORDER BY generated_at DESC
     LIMIT 1`,
    params
  ));

  return result.rows.length > 0 ? mapRowToSbomEntry(result.rows[0]) : null;
}

export async function deleteOldSboms(daysToKeep: number = 180): Promise<number> {
  if (!isDatabaseConnected()) return 0;

  const result = ensureResult(await query(
    `DELETE FROM sbom_entries
     WHERE generated_at < NOW() - $1 * INTERVAL '1 day'`,
    [daysToKeep]
  ));

  return result.rowCount ?? 0;
}

function mapRowToSbomEntry(row: Record<string, unknown>): SbomEntry {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    organization_id: row.organization_id as string,
    format: row.format as 'cyclonedx' | 'spdx',
    spec_version: row.spec_version as string,
    serial_number: row.serial_number as string,
    generated_at: new Date(row.generated_at as string),
    generated_by: row.generated_by as string,
    total_components: row.total_components as number,
    production_components: row.production_components as number,
    dev_components: row.dev_components as number,
    unique_licenses: row.unique_licenses as number,
    license_distribution: row.license_distribution as Record<string, number>,
    storage_location: row.storage_location as 'database' | 'minio' | 'local',
    storage_bucket: row.storage_bucket as string | null,
    storage_key: row.storage_key as string | null,
    storage_path: row.storage_path as string | null,
    filename: row.filename as string,
    content_type: row.content_type as string,
    size_bytes: row.size_bytes as number | null,
    sbom_content: row.sbom_content as object | null,
    eo_14028_compliant: row.eo_14028_compliant as boolean,
    ntia_compliant: row.ntia_compliant as boolean,
    missing_elements: row.missing_elements as string[],
    created_at: new Date(row.created_at as string),
  };
}

// ============================================================================
// Dependency Analysis CRUD
// ============================================================================

export async function createDependencyAnalysis(
  analysis: Omit<DependencyAnalysis, 'id' | 'created_at'>
): Promise<DependencyAnalysis> {
  if (!isDatabaseConnected()) {
    throw new Error('Database not connected');
  }

  const result = ensureResult(await query(
    `INSERT INTO dependency_analysis (
      project_id, organization_id, analyzed_at, analysis_duration_ms,
      total_dependencies, direct_dependencies, transitive_dependencies,
      production_dependencies, dev_dependencies, outdated_count,
      major_updates_available, minor_updates_available, patch_updates_available,
      vulnerable_count, critical_vulnerabilities, high_vulnerabilities,
      medium_vulnerabilities, low_vulnerabilities, health_score,
      outdated_packages, vulnerable_packages, ecosystem, lockfile_path,
      status, error_message
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
    RETURNING *`,
    [
      analysis.project_id,
      analysis.organization_id,
      analysis.analyzed_at,
      analysis.analysis_duration_ms,
      analysis.total_dependencies,
      analysis.direct_dependencies,
      analysis.transitive_dependencies,
      analysis.production_dependencies,
      analysis.dev_dependencies,
      analysis.outdated_count,
      analysis.major_updates_available,
      analysis.minor_updates_available,
      analysis.patch_updates_available,
      analysis.vulnerable_count,
      analysis.critical_vulnerabilities,
      analysis.high_vulnerabilities,
      analysis.medium_vulnerabilities,
      analysis.low_vulnerabilities,
      analysis.health_score,
      JSON.stringify(analysis.outdated_packages),
      JSON.stringify(analysis.vulnerable_packages),
      analysis.ecosystem,
      analysis.lockfile_path,
      analysis.status,
      analysis.error_message,
    ]
  ));

  return mapRowToDependencyAnalysis(result.rows[0]);
}

export async function getDependencyAnalyses(
  projectId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ items: DependencyAnalysis[]; total: number }> {
  if (!isDatabaseConnected()) return { items: [], total: 0 };

  const { limit = 20, offset = 0 } = options;

  const [resultsRaw, countResultRaw] = await Promise.all([
    query(
      `SELECT * FROM dependency_analysis
       WHERE project_id = $1
       ORDER BY analyzed_at DESC
       LIMIT $2 OFFSET $3`,
      [projectId, limit, offset]
    ),
    query(
      'SELECT COUNT(*) as total FROM dependency_analysis WHERE project_id = $1',
      [projectId]
    ),
  ]);
  const results = ensureResult(resultsRaw);
  const countResult = ensureResult(countResultRaw);

  return {
    items: results.rows.map(mapRowToDependencyAnalysis),
    total: parseInt(countResult.rows[0]?.total || '0', 10),
  };
}

export async function getLatestDependencyAnalysis(projectId: string): Promise<DependencyAnalysis | null> {
  if (!isDatabaseConnected()) return null;

  const result = ensureResult(await query(
    `SELECT * FROM dependency_analysis
     WHERE project_id = $1
     ORDER BY analyzed_at DESC
     LIMIT 1`,
    [projectId]
  ));

  return result.rows.length > 0 ? mapRowToDependencyAnalysis(result.rows[0]) : null;
}

export async function deleteOldDependencyAnalyses(daysToKeep: number = 90): Promise<number> {
  if (!isDatabaseConnected()) return 0;

  const result = ensureResult(await query(
    `DELETE FROM dependency_analysis
     WHERE analyzed_at < NOW() - $1 * INTERVAL '1 day'`,
    [daysToKeep]
  ));

  return result.rowCount ?? 0;
}

function mapRowToDependencyAnalysis(row: Record<string, unknown>): DependencyAnalysis {
  return {
    id: row.id as string,
    project_id: row.project_id as string,
    organization_id: row.organization_id as string,
    analyzed_at: new Date(row.analyzed_at as string),
    analysis_duration_ms: row.analysis_duration_ms as number | null,
    total_dependencies: row.total_dependencies as number,
    direct_dependencies: row.direct_dependencies as number,
    transitive_dependencies: row.transitive_dependencies as number,
    production_dependencies: row.production_dependencies as number,
    dev_dependencies: row.dev_dependencies as number,
    outdated_count: row.outdated_count as number,
    major_updates_available: row.major_updates_available as number,
    minor_updates_available: row.minor_updates_available as number,
    patch_updates_available: row.patch_updates_available as number,
    vulnerable_count: row.vulnerable_count as number,
    critical_vulnerabilities: row.critical_vulnerabilities as number,
    high_vulnerabilities: row.high_vulnerabilities as number,
    medium_vulnerabilities: row.medium_vulnerabilities as number,
    low_vulnerabilities: row.low_vulnerabilities as number,
    health_score: row.health_score as number | null,
    outdated_packages: row.outdated_packages as DependencyAnalysis['outdated_packages'],
    vulnerable_packages: row.vulnerable_packages as DependencyAnalysis['vulnerable_packages'],
    ecosystem: row.ecosystem as string,
    lockfile_path: row.lockfile_path as string | null,
    status: row.status as 'completed' | 'failed' | 'partial',
    error_message: row.error_message as string | null,
    created_at: new Date(row.created_at as string),
  };
}
