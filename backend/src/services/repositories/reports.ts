/**
 * Reports Repository - PostgreSQL persistence
 *
 * Feature #2091: Migrate Reports Module to PostgreSQL
 * Feature #2110: Remove in-memory Map stores (DB-only migration)
 *
 * Provides CRUD operations for:
 * - Comprehensive reports with all test type sections
 * - Report summaries for list views
 */

import { query, isDatabaseConnected } from '../database.js';
import { ComprehensiveReport, ReportSummary } from '../../routes/reports/types.js';
import { generateId } from '../../utils/index.js';
// Feature #449: Use structured logger instead of console.*
import { createLogger } from '../logger.js';

const log = createLogger('repo:reports');

// ============================================
// Feature #462: Row interfaces to eliminate : any types
// ============================================

/** Database row type for full report retrieval */
interface ReportRow {
  id: string;
  project_id: string;
  project_name: string;
  created_at: Date | string;
  created_by: string;
  title: string;
  description: string | null;
  period: { start: string; end: string } | null;
  executive_summary: {
    overallScore: number;
    overallStatus: string;
    highlights: unknown[];
    criticalIssues: unknown[];
    recommendations: unknown[];
  } | null;
  sections: Record<string, unknown> | null;
  generated_by: string;
  format: string;
  view_url: string | null;
  organization_id: string;
}

/** Database row type for summary retrieval (lightweight) */
interface ReportSummaryRow {
  id: string;
  project_id: string;
  project_name: string;
  created_at: Date | string;
  created_by: string;
  title: string;
  overall_score: string | null;
  overall_status: string | null;
  section_types: string[] | null;
  view_url: string | null;
}

// ============================================
// Column Constants (Feature #210: Replace SELECT *)
// ============================================

/**
 * Columns for full report retrieval (includes JSONB sections and executive_summary)
 */
const REPORT_FULL_COLUMNS = [
  'id', 'project_id', 'project_name', 'created_at', 'created_by',
  'title', 'description', 'period', 'executive_summary', 'sections',
  'generated_by', 'format', 'view_url', 'organization_id'
].join(', ');

/**
 * Feature #210: Lightweight columns for list views (excludes heavy JSONB sections)
 * - Excludes: sections (heavy JSONB with all test data)
 * - Excludes: period (not needed for list view)
 * - Includes: executive_summary for overallScore/overallStatus extraction
 * - Uses (SELECT array_agg...) subquery to get section keys
 */
const REPORT_SUMMARY_COLUMNS = `
  id, project_id, project_name, created_at, created_by,
  title, description, generated_by, format, view_url, organization_id,
  executive_summary->>'overallScore' as overall_score,
  executive_summary->>'overallStatus' as overall_status,
  (SELECT array_agg(key) FROM jsonb_object_keys(COALESCE(sections, '{}'::jsonb)) as key) as section_types
`.trim();

// ============================================
// Deprecated Memory Store Accessor
// ============================================

/** @deprecated Feature #2110: Memory stores removed. Returns empty Map. Use DB queries instead. */
export function getMemoryReports(): Map<string, ComprehensiveReport> {
  log.warn('DEPRECATED: getMemoryReports() - memory stores removed, use DB queries');
  return new Map();
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate unique ID for a report
 */
export function generateReportId(): string {
  return generateId('report'); // Feature #357: Use shared ID generator
}

function parseReportRow(row: ReportRow): ComprehensiveReport {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    createdBy: row.created_by,
    title: row.title,
    description: row.description ?? undefined,
    period: row.period || { start: '', end: '' },
    executiveSummary: (row.executive_summary || {
      overallScore: 0,
      overallStatus: 'warning',
      highlights: [],
      criticalIssues: [],
      recommendations: [],
    }) as ComprehensiveReport['executiveSummary'],
    sections: (row.sections || {}) as ComprehensiveReport['sections'],
    generatedBy: row.generated_by as ComprehensiveReport['generatedBy'],
    format: row.format as ComprehensiveReport['format'],
    viewUrl: row.view_url ?? '',
  };
}

// Helper function for future use
function _createSummaryFromReport(report: ComprehensiveReport): ReportSummary {
  return {
    id: report.id,
    projectId: report.projectId,
    projectName: report.projectName,
    title: report.title,
    createdAt: report.createdAt,
    createdBy: report.createdBy,
    overallScore: report.executiveSummary.overallScore,
    overallStatus: report.executiveSummary.overallStatus,
    sectionTypes: Object.keys(report.sections).filter(
      k => report.sections[k as keyof typeof report.sections] !== undefined
    ),
    viewUrl: report.viewUrl,
  };
}

/**
 * Feature #210: Parse lightweight summary row (from REPORT_SUMMARY_COLUMNS query)
 */
function parseSummaryRow(row: ReportSummaryRow): ReportSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    title: row.title,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    createdBy: row.created_by,
    overallScore: row.overall_score ? parseFloat(row.overall_score) : 0,
    overallStatus: (row.overall_status || 'warning') as ReportSummary['overallStatus'],
    sectionTypes: row.section_types || [],
    viewUrl: row.view_url ?? '',
  };
}

// ============================================
// Report CRUD Operations
// ============================================

/**
 * Store a report
 */
export async function storeReport(report: ComprehensiveReport): Promise<ComprehensiveReport> {
  if (isDatabaseConnected()) {
    const result = await query<ReportRow>(
      `INSERT INTO reports (
        id, project_id, project_name, created_at, created_by,
        title, description, period, executive_summary, sections,
        generated_by, format, view_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        report.id,
        report.projectId,
        report.projectName,
        report.createdAt,
        report.createdBy,
        report.title,
        report.description || null,
        JSON.stringify(report.period),
        JSON.stringify(report.executiveSummary),
        JSON.stringify(report.sections),
        report.generatedBy,
        report.format,
        report.viewUrl,
      ]
    );
    if (result && result.rows[0]) {
      return parseReportRow(result.rows[0]);
    }
  }
  // DB-only: return report as-is if DB unavailable
  return report;
}

/**
 * Get a report by ID (full data including JSONB sections)
 */
export async function getReport(reportId: string): Promise<ComprehensiveReport | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<ReportRow>(
      `SELECT ${REPORT_FULL_COLUMNS} FROM reports WHERE id = $1`,
      [reportId]
    );
    if (result && result.rows[0]) {
      return parseReportRow(result.rows[0]);
    }
    return undefined;
  }
  return undefined;
}

/**
 * List reports with optional project filter
 * Returns summaries sorted by creation date descending
 * Feature #210: Uses lightweight columns, excludes heavy JSONB sections
 */
export async function listReports(projectId?: string, limit: number = 100): Promise<ReportSummary[]> {
  if (isDatabaseConnected()) {
    let sql = `SELECT ${REPORT_SUMMARY_COLUMNS} FROM reports`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (projectId) {
      sql += ` WHERE project_id = $${paramIndex++}`;
      params.push(projectId);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await query<ReportSummaryRow>(sql, params);
    if (result) {
      return result.rows.map(parseSummaryRow);
    }
    return [];
  }

  // DB-only: return empty when DB unavailable
  return [];
}

/**
 * Delete a report
 */
export async function deleteReport(reportId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      'DELETE FROM reports WHERE id = $1',
      [reportId]
    );
    return (result?.rowCount ?? 0) > 0;
  }
  return false;
}

/**
 * Get report count
 */
export async function getReportCount(projectId?: string): Promise<number> {
  if (isDatabaseConnected()) {
    let sql = 'SELECT COUNT(*) as count FROM reports';
    const params: unknown[] = [];

    if (projectId) {
      sql += ' WHERE project_id = $1';
      params.push(projectId);
    }

    const result = await query<{ count: string }>(sql, params);
    if (result && result.rows[0]) {
      return parseInt(result.rows[0].count, 10);
    }
    return 0;
  }

  // DB-only: return 0 when DB unavailable
  return 0;
}

/**
 * Get reports by organization
 * Feature #210: Uses lightweight columns, excludes heavy JSONB sections
 */
export async function getReportsByOrganization(organizationId: string, limit: number = 100): Promise<ReportSummary[]> {
  if (isDatabaseConnected()) {
    const result = await query<ReportSummaryRow>(
      `SELECT ${REPORT_SUMMARY_COLUMNS} FROM reports WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [organizationId, limit]
    );
    if (result) {
      return result.rows.map(parseSummaryRow);
    }
    return [];
  }
  // DB-only: return empty when DB unavailable
  return [];
}

/**
 * Get recent reports (for dashboard)
 * Feature #210: Uses lightweight columns, excludes heavy JSONB sections
 */
export async function getRecentReports(limit: number = 10): Promise<ReportSummary[]> {
  if (isDatabaseConnected()) {
    const result = await query<ReportSummaryRow>(
      `SELECT ${REPORT_SUMMARY_COLUMNS} FROM reports ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    if (result) {
      return result.rows.map(parseSummaryRow);
    }
    return [];
  }

  // DB-only: return empty when DB unavailable
  return [];
}

/**
 * Update report (mainly for updating view_url or metadata)
 */
export async function updateReport(
  reportId: string,
  updates: Partial<Pick<ComprehensiveReport, 'title' | 'description' | 'viewUrl'>>
): Promise<ComprehensiveReport | undefined> {
  if (isDatabaseConnected()) {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.viewUrl !== undefined) {
      setClauses.push(`view_url = $${paramIndex++}`);
      values.push(updates.viewUrl);
    }

    if (setClauses.length === 0) {
      return getReport(reportId);
    }

    values.push(reportId);
    const result = await query<ReportRow>(
      `UPDATE reports SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    if (result && result.rows[0]) {
      return parseReportRow(result.rows[0]);
    }
    return undefined;
  }

  // DB-only: return undefined when DB unavailable
  return undefined;
}
