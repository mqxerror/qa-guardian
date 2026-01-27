// DAST In-memory Data Stores and Constants

import {
  DASTConfig,
  DASTScanResult,
  DASTFalsePositive,
  OpenAPISpec,
  DASTSchedule,
  GraphQLScan,
} from './types';

// In-memory stores
export const dastConfigs: Map<string, DASTConfig> = new Map();
export const dastScans: Map<string, DASTScanResult[]> = new Map();  // projectId -> scans
export const dastFalsePositives: Map<string, DASTFalsePositive[]> = new Map();  // projectId -> false positives
export const openApiSpecs: Map<string, OpenAPISpec> = new Map();  // specId -> spec
export const dastSchedules: Map<string, DASTSchedule> = new Map();  // scheduleId -> schedule
export const graphqlScans: Map<string, GraphQLScan> = new Map();  // scanId -> scan

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
