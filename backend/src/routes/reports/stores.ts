/**
 * Report Store
 * Feature #1732: In-memory storage for comprehensive reports
 * Feature #2091: PostgreSQL migration
 * Feature #2106: Map exports are DEPRECATED - use async functions instead.
 *
 * WARNING: Map exports may return empty data when database is unavailable.
 * Use async functions: storeReport(), getReport(), listReports(), etc.
 */

import { ComprehensiveReport, ReportSummary } from './types';

// Import repository functions
import * as reportsRepo from '../../services/repositories/reports';

// Re-export repository functions for database access
export const storeReport = reportsRepo.storeReport;
export const getReport = reportsRepo.getReport;
export const listReports = reportsRepo.listReports;
export const deleteReport = reportsRepo.deleteReport;
export const getReportCount = reportsRepo.getReportCount;
export const getReportsByOrganization = reportsRepo.getReportsByOrganization;
export const getRecentReports = reportsRepo.getRecentReports;
export const updateReport = reportsRepo.updateReport;

// Re-export helper functions
export const generateReportId = reportsRepo.generateReportId;

// DEPRECATED Map export (Feature #2106)
// WARNING: This Map is DEPRECATED and may return empty data!
// Use async functions above instead.
export const reports: Map<string, ComprehensiveReport> = reportsRepo.getMemoryReports();
