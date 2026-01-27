/**
 * Reports Repository - PostgreSQL persistence
 *
 * Feature #2091: Migrate Reports Module to PostgreSQL
 *
 * Provides CRUD operations for:
 * - Comprehensive reports with all test type sections
 * - Report summaries for list views
 */

import { query, isDatabaseConnected } from '../database';
import { ComprehensiveReport, ReportSummary } from '../../routes/reports/types';

// Memory fallback store
const memoryReports: Map<string, ComprehensiveReport> = new Map();

// ============================================
// Memory Store Accessor (for backward compatibility)
// ============================================

export function getMemoryReports(): Map<string, ComprehensiveReport> {
  return memoryReports;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate unique ID for a report
 */
export function generateReportId(): string {
  return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function parseReportRow(row: any): ComprehensiveReport {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    createdBy: row.created_by,
    title: row.title,
    description: row.description,
    period: row.period || { start: '', end: '' },
    executiveSummary: row.executive_summary || {
      overallScore: 0,
      overallStatus: 'warning',
      highlights: [],
      criticalIssues: [],
      recommendations: [],
    },
    sections: row.sections || {},
    generatedBy: row.generated_by,
    format: row.format,
    viewUrl: row.view_url,
  };
}

function createSummaryFromReport(report: ComprehensiveReport): ReportSummary {
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

// ============================================
// Report CRUD Operations
// ============================================

/**
 * Store a report
 */
export async function storeReport(report: ComprehensiveReport): Promise<ComprehensiveReport> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
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
  // Memory fallback
  memoryReports.set(report.id, report);
  return report;
}

/**
 * Get a report by ID
 */
export async function getReport(reportId: string): Promise<ComprehensiveReport | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM reports WHERE id = $1',
      [reportId]
    );
    if (result && result.rows[0]) {
      return parseReportRow(result.rows[0]);
    }
    return undefined;
  }
  return memoryReports.get(reportId);
}

/**
 * List reports with optional project filter
 * Returns summaries sorted by creation date descending
 */
export async function listReports(projectId?: string): Promise<ReportSummary[]> {
  if (isDatabaseConnected()) {
    let sql = 'SELECT * FROM reports';
    const params: any[] = [];

    if (projectId) {
      sql += ' WHERE project_id = $1';
      params.push(projectId);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query<any>(sql, params);
    if (result) {
      return result.rows.map((row: any) => createSummaryFromReport(parseReportRow(row)));
    }
    return [];
  }

  // Memory fallback
  const allReports = Array.from(memoryReports.values());

  const filtered = projectId
    ? allReports.filter(r => r.projectId === projectId)
    : allReports;

  return filtered
    .map(createSummaryFromReport)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
  return memoryReports.delete(reportId);
}

/**
 * Get report count
 */
export async function getReportCount(projectId?: string): Promise<number> {
  if (isDatabaseConnected()) {
    let sql = 'SELECT COUNT(*) as count FROM reports';
    const params: any[] = [];

    if (projectId) {
      sql += ' WHERE project_id = $1';
      params.push(projectId);
    }

    const result = await query<any>(sql, params);
    if (result && result.rows[0]) {
      return parseInt(result.rows[0].count, 10);
    }
    return 0;
  }

  if (projectId) {
    return Array.from(memoryReports.values()).filter(r => r.projectId === projectId).length;
  }
  return memoryReports.size;
}

/**
 * Get reports by organization
 */
export async function getReportsByOrganization(organizationId: string): Promise<ReportSummary[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM reports WHERE organization_id = $1 ORDER BY created_at DESC',
      [organizationId]
    );
    if (result) {
      return result.rows.map((row: any) => createSummaryFromReport(parseReportRow(row)));
    }
    return [];
  }
  // Memory fallback - no organization filter available in memory store
  return listReports();
}

/**
 * Get recent reports (for dashboard)
 */
export async function getRecentReports(limit: number = 10): Promise<ReportSummary[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM reports ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    if (result) {
      return result.rows.map((row: any) => createSummaryFromReport(parseReportRow(row)));
    }
    return [];
  }

  // Memory fallback
  return Array.from(memoryReports.values())
    .map(createSummaryFromReport)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
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
    const values: any[] = [];
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
    const result = await query<any>(
      `UPDATE reports SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    if (result && result.rows[0]) {
      return parseReportRow(result.rows[0]);
    }
    return undefined;
  }

  // Memory fallback
  const existing = memoryReports.get(reportId);
  if (!existing) return undefined;

  const updated: ComprehensiveReport = {
    ...existing,
    ...updates,
  };
  memoryReports.set(reportId, updated);
  return updated;
}
