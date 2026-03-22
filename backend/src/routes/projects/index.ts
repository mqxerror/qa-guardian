// Projects Module - Main Index
// Re-exports all types, stores, utilities, and routes from modular files

import { FastifyInstance } from 'fastify';

// Re-export all types (using type-only exports for interfaces)
export type {
  Project,
  ProjectMember,
  EnvironmentVariable,
  ProjectVisualSettings,
  ProjectHealingSettings,
  CreateProjectBody,
  ProjectParams,
} from './types.js';

// Re-export stores and constants
export {
  DEFAULT_PROJECT_VISUAL_SETTINGS,
  DEFAULT_PROJECT_HEALING_SETTINGS,
} from './stores.js';

// Re-export utility functions
export {
  getProjectVisualSettings,
  setProjectVisualSettings,
  getProjectHealingSettings,
  setProjectHealingSettings,
  hasProjectAccess,
  getProjectRole,
} from './utils.js';

// Import route modules
import { coreRoutes } from './routes.js';
import { analyticsRoutes } from './analytics/index.js';
import { aiInsightsRoutes } from './ai-insights-routes.js';
import { flakyTestsRoutes } from './flaky-tests/index.js';
import { remediationRoutes } from './remediation.js';
import { memberRoutes } from './members.js';
import { settingsRoutes } from './settings.js';

// Combined project routes function that registers all sub-routes
export async function projectRoutes(app: FastifyInstance) {
  // Register all route modules
  await coreRoutes(app);
  await analyticsRoutes(app);
  await aiInsightsRoutes(app);
  await flakyTestsRoutes(app);
  await remediationRoutes(app);
  await memberRoutes(app);
  await settingsRoutes(app);
}
