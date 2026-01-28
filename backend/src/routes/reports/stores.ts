/**
 * Report Store
 * Feature #2114: Map exports REMOVED. Only async DB functions exported.
 */

// Import repository functions
import * as reportsRepo from '../../services/repositories/reports';

// ===== ASYNC DATABASE FUNCTIONS =====
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
