/**
 * Validation Module Exports
 * Feature #122: Zod validation schemas for API endpoints
 * Feature #881: Split into domain-specific files for maintainability
 */

// Domain-specific schema files (Feature #881)
// Replaces monolithic schemas.ts with focused domain files
export * from './common-schemas.js';
export * from './auth-schemas.js';
export * from './project-schemas.js';
export * from './test-schemas.js';
export * from './run-schemas.js';
export * from './organization-schemas.js';
export * from './quick-test-schemas.js';
export * from './security-schemas.js';
export * from './mcp-schemas.js';
export * from './monitoring-schemas.js';
export * from './remaining-schemas.js';

// Legacy file kept for backward compatibility with any direct imports
// All schemas are now maintained in domain-specific files above
// export * from './schemas.js'; // Deprecated - use domain files

// Export middleware (validate renamed to validateRequest to avoid conflict)
export { validateBody, validateParams, validateQuery, validate as validateRequest, createValidatedHandler } from './middleware.js';
export type { ValidationSchemas } from './middleware.js';
