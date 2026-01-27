// DAST Routes - Re-exports from modular implementation
// This file maintains backward compatibility while actual code lives in dast/ directory

export {
  // Types
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
} from './dast/types';

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
} from './dast/stores';

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
} from './dast/utils';

export {
  // Scanner Functions
  simulateZAPScan,
  parseOpenAPISpec,
  getOpenAPISpec,
} from './dast/scanner';

export {
  // Alert Generation
  generateSimulatedAlerts,
} from './dast/alerts';

export {
  // Report Generation
  generateHTMLReport,
  generateJSONReport,
  generatePDFReport,
} from './dast/reports';

export {
  // GraphQL Scanning
  performGraphQLIntrospection,
  analyzeGraphQLOperation,
  startGraphQLScan,
  getGraphQLScan,
  listGraphQLScans,
} from './dast/graphql';

export {
  // Routes
  dastRoutes,
} from './dast/routes';
