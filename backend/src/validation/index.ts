/**
 * Validation Module Exports
 * Feature #122: Zod validation schemas for API endpoints
 */

// Export all schemas
export * from './schemas.js';

// Export middleware (validate renamed to validateRequest to avoid conflict)
export { validateBody, validateParams, validateQuery, validate as validateRequest, createValidatedHandler } from './middleware.js';
export type { ValidationSchemas } from './middleware.js';
