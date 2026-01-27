/**
 * Report Store
 * Feature #1732: In-memory storage for comprehensive reports
 * Feature #2091: PostgreSQL migration
 *
 * Now uses repository functions with in-memory fallback.
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

// Backward compatible Map export (from repository memory store)
// Kept for backward compatibility with existing code that uses Map operations
export const reports: Map<string, ComprehensiveReport> = reportsRepo.getMemoryReports();
