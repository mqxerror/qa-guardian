// DAST Module Index - Re-exports all DAST functionality

// Types
export * from './types';

// Stores and Constants
export {
  dastConfigs,
  dastScans,
  dastFalsePositives,
  openApiSpecs,
  dastSchedules,
  graphqlScans,
  DEFAULT_DAST_CONFIG,
  ZAP_SCAN_PROFILES,
  SCHEDULE_FREQUENCIES,
} from './stores';

// Utility Functions
export {
  generateId,
  getDASTConfig,
  updateDASTConfig,
  matchUrlPattern,
  isUrlInScope,
  generateCronExpression,
  calculateDASTNextRun,
  escapeHTML,
} from './utils';

// Scanner Functions
export {
  simulateZAPScan,
  parseOpenAPISpec,
  getOpenAPISpec,
} from './scanner';

// Alert Generation
export { generateSimulatedAlerts } from './alerts';

// Report Generation
export {
  generateHTMLReport,
  generateJSONReport,
  generatePDFReport,
} from './reports';

// GraphQL Scanning
export {
  performGraphQLIntrospection,
  analyzeGraphQLOperation,
  startGraphQLScan,
  getGraphQLScan,
  listGraphQLScans,
} from './graphql';

// Routes
export { dastRoutes } from './routes';
