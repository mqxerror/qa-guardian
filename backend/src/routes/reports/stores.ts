/**
 * Report Store
 * Feature #1732: In-memory storage for comprehensive reports
 */

import { ComprehensiveReport, ReportSummary } from './types';

// In-memory report storage
const reports: Map<string, ComprehensiveReport> = new Map();

// Generate unique ID
export function generateReportId(): string {
  return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Store a report
export function storeReport(report: ComprehensiveReport): void {
  reports.set(report.id, report);
}

// Get a report by ID
export function getReport(reportId: string): ComprehensiveReport | undefined {
  return reports.get(reportId);
}

// List reports for a project
export function listReports(projectId?: string): ReportSummary[] {
  const allReports = Array.from(reports.values());

  const filtered = projectId
    ? allReports.filter(r => r.projectId === projectId)
    : allReports;

  return filtered.map(r => ({
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName,
    title: r.title,
    createdAt: r.createdAt,
    createdBy: r.createdBy,
    overallScore: r.executiveSummary.overallScore,
    overallStatus: r.executiveSummary.overallStatus,
    sectionTypes: Object.keys(r.sections).filter(k => r.sections[k as keyof typeof r.sections] !== undefined),
    viewUrl: r.viewUrl,
  })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// Delete a report
export function deleteReport(reportId: string): boolean {
  return reports.delete(reportId);
}

// Get report count
export function getReportCount(): number {
  return reports.size;
}
