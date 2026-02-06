// DAST Module Index - Re-exports all DAST functionality

// Types
export * from './types.js';

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
} from './stores.js';

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
} from './utils.js';

// Scanner Functions
export {
  runZAPScan,
  parseOpenAPISpec,
  getOpenAPISpec,
} from './scanner.js';

// Lightweight Scanner (fallback when ZAP/Docker unavailable)
export {
  runLightweightScan,
  isZAPAvailable,
} from './lightweight-scanner.js';

// Report Generation
export {
  generateHTMLReport,
  generateJSONReport,
  generatePDFReport,
} from './reports.js';

// GraphQL Scanning
export {
  performGraphQLIntrospection,
  analyzeGraphQLOperation,
  startGraphQLScan,
  getGraphQLScan,
  listGraphQLScans,
} from './graphql.js';

// Routes
export { dastRoutes } from './routes.js';
