// Projects Module - Main Index
// Re-exports all types, stores, utilities, and routes from modular files

import { FastifyInstance } from 'fastify';

// Re-export all types
export {
  Project,
  ProjectMember,
  EnvironmentVariable,
  ProjectVisualSettings,
  ProjectHealingSettings,
  CreateProjectBody,
  ProjectParams,
} from './types';

// Re-export stores and constants
export {
  projects,
  projectMembers,
  projectEnvVars,
  projectVisualSettings,
  projectHealingSettings,
  DEFAULT_PROJECT_VISUAL_SETTINGS,
  DEFAULT_PROJECT_HEALING_SETTINGS,
} from './stores';

// Re-export utility functions
export {
  getProjectVisualSettings,
  setProjectVisualSettings,
  getProjectHealingSettings,
  setProjectHealingSettings,
  hasProjectAccess,
  getProjectRole,
} from './utils';

// Import route modules
import { coreRoutes } from './routes';
import { analyticsRoutes } from './analytics';
import { flakyTestsRoutes } from './flaky-tests';
import { remediationRoutes } from './remediation';
import { memberRoutes } from './members';
import { settingsRoutes } from './settings';

// Combined project routes function that registers all sub-routes
export async function projectRoutes(app: FastifyInstance) {
  // Register all route modules
  await coreRoutes(app);
  await analyticsRoutes(app);
  await flakyTestsRoutes(app);
  await remediationRoutes(app);
  await memberRoutes(app);
  await settingsRoutes(app);
}
