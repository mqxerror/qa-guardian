// DAST In-memory Data Stores and Constants
//
// Updated for Feature #2088: PostgreSQL migration
// Feature #2106: Map exports are DEPRECATED - use async functions instead.
//
// WARNING: Map exports may return empty data when database is unavailable.
// Use async functions: getDastConfig(), saveDastConfig(), etc.

import {
  DASTConfig,
  DASTScanResult,
  DASTFalsePositive,
  OpenAPISpec,
  DASTSchedule,
  GraphQLScan,
} from './types';

// Import repository functions
import * as dastRepo from '../../services/repositories/dast';

// Re-export repository functions for database access
export const getDastConfig = dastRepo.getDastConfig;
export const saveDastConfig = dastRepo.saveDastConfig;
export const deleteDastConfig = dastRepo.deleteDastConfig;

export const createDastScan = dastRepo.createDastScan;
export const getDastScan = dastRepo.getDastScan;
export const updateDastScan = dastRepo.updateDastScan;
export const getDastScansByProject = dastRepo.getDastScansByProject;
export const deleteDastScan = dastRepo.deleteDastScan;

export const addDastFalsePositive = dastRepo.addDastFalsePositive;
export const getDastFalsePositives = dastRepo.getDastFalsePositives;
export const deleteDastFalsePositive = dastRepo.deleteDastFalsePositive;
export const checkFalsePositive = dastRepo.checkFalsePositive;

export const saveOpenApiSpec = dastRepo.saveOpenApiSpec;
export const getOpenApiSpec = dastRepo.getOpenApiSpec;
export const getOpenApiSpecsByProject = dastRepo.getOpenApiSpecsByProject;
export const deleteOpenApiSpec = dastRepo.deleteOpenApiSpec;

export const createDastSchedule = dastRepo.createDastSchedule;
export const getDastSchedule = dastRepo.getDastSchedule;
export const getDastSchedulesByProject = dastRepo.getDastSchedulesByProject;
export const updateDastSchedule = dastRepo.updateDastSchedule;
export const deleteDastSchedule = dastRepo.deleteDastSchedule;
export const getEnabledDastSchedules = dastRepo.getEnabledDastSchedules;

export const createGraphqlScan = dastRepo.createGraphqlScan;
export const getGraphqlScan = dastRepo.getGraphqlScan;
export const updateGraphqlScan = dastRepo.updateGraphqlScan;
export const deleteGraphqlScan = dastRepo.deleteGraphqlScan;
export const listGraphqlScans = dastRepo.listGraphqlScans;

// Backward compatible Map exports (from repository memory stores)
// These are kept for backward compatibility with existing code that uses Map operations
export const dastConfigs: Map<string, DASTConfig> = dastRepo.getMemoryDastConfigs();
export const dastScans: Map<string, DASTScanResult[]> = dastRepo.getMemoryDastScans();
export const dastFalsePositives: Map<string, DASTFalsePositive[]> = dastRepo.getMemoryDastFalsePositives();
export const openApiSpecs: Map<string, OpenAPISpec> = dastRepo.getMemoryOpenApiSpecs();
export const dastSchedules: Map<string, DASTSchedule> = dastRepo.getMemoryDastSchedules();
export const graphqlScans: Map<string, GraphQLScan> = dastRepo.getMemoryGraphqlScans();

// Default DAST config
export const DEFAULT_DAST_CONFIG: DASTConfig = {
  enabled: false,
  targetUrl: '',
  scanProfile: 'baseline',
  alertThreshold: 'LOW',
  autoScan: false,
};

// ZAP scan profile descriptions
export const ZAP_SCAN_PROFILES = {
  baseline: {
    name: 'Baseline Scan',
    description: 'Quick passive scan that doesn\'t attack the application. Good for CI/CD.',
    duration: '~2 minutes',
  },
  full: {
    name: 'Full Scan',
    description: 'Comprehensive active scan with attack vectors. More thorough but slower.',
    duration: '~30+ minutes',
  },
  api: {
    name: 'API Scan',
    description: 'Scan designed for APIs (REST, GraphQL). Requires OpenAPI/Swagger spec.',
    duration: '~5-10 minutes',
  },
};

// Schedule frequency options
export const SCHEDULE_FREQUENCIES = {
  hourly: { name: 'Hourly', description: 'Every hour' },
  daily: { name: 'Daily', description: 'Once per day at specified time' },
  nightly: { name: 'Nightly', description: 'Every night at 2:00 AM' },
  weekly: { name: 'Weekly', description: 'Once per week on specified day' },
  monthly: { name: 'Monthly', description: 'Once per month on specified day' },
};
