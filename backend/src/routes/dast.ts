// DAST Routes - Re-exports from modular implementation
// This file maintains backward compatibility while actual code lives in dast/ directory

// Type-only exports (required for ESM compatibility)
export type {
  DASTConfig,
  DASTScanResult,
  DASTAlert,
  DASTRisk,
  DASTConfidence,
  DASTFalsePositive,
  DASTSchedule,
  OpenAPIEndpoint,
  OpenAPISpec,
  ReportFormat,
  GraphQLSchema,
  GraphQLOperation,
  GraphQLType,
  GraphQLScanConfig,
  GraphQLFinding,
  GraphQLScan,
} from './dast/types.js';

export {
  // Stores
  dastConfigs,
  dastScans,
  dastFalsePositives,
  openApiSpecs,
  dastSchedules,
  graphqlScans,
  DEFAULT_DAST_CONFIG,
  ZAP_SCAN_PROFILES,
  SCHEDULE_FREQUENCIES,
} from './dast/stores.js';

export {
  // Utility Functions
  generateId,
  getDASTConfig,
  updateDASTConfig,
  matchUrlPattern,
  isUrlInScope,
  generateCronExpression,
  calculateDASTNextRun,
  escapeHTML,
} from './dast/utils.js';

export {
  // Scanner Functions
  runZAPScan,
  parseOpenAPISpec,
  getOpenAPISpec,
} from './dast/scanner.js';

export {
  // Report Generation
  generateHTMLReport,
  generateJSONReport,
  generatePDFReport,
} from './dast/reports.js';

export {
  // GraphQL Scanning
  performGraphQLIntrospection,
  analyzeGraphQLOperation,
  startGraphQLScan,
  getGraphQLScan,
  listGraphQLScans,
} from './dast/graphql.js';

export {
  // Routes
  dastRoutes,
} from './dast/routes.js';
