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
  DEFAULT_PROJECT_VISUAL_SETTINGS,
  DEFAULT_PROJECT_HEALING_SETTINGS,
} from './stores';

// DEPRECATED: Empty Map exports for backward compatibility until route migration (#2116)
// These return empty Maps - consumers must migrate to async DB functions
import { Project, ProjectMember, EnvironmentVariable, ProjectVisualSettings, ProjectHealingSettings } from './types';
export const projects = new Map<string, Project>();
export const projectMembers = new Map<string, ProjectMember[]>();
export const projectEnvVars = new Map<string, EnvironmentVariable[]>();
export const projectVisualSettings = new Map<string, ProjectVisualSettings>();
export const projectHealingSettings = new Map<string, ProjectHealingSettings>();

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
