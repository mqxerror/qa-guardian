// Projects Routes - Re-exports from modular implementation
// This file maintains backward compatibility while the implementation is split into modules

// Re-export all types (must use 'export type' for ESM compatibility with Node.js 20+)
export type {
  Project,
  ProjectMember,
  EnvironmentVariable,
  ProjectVisualSettings,
  ProjectHealingSettings,
  CreateProjectBody,
  ProjectParams,
} from './projects/types.js';

// Re-export stores and constants (Maps removed in Feature #2112, only constants and async functions)
export {
  DEFAULT_PROJECT_VISUAL_SETTINGS,
  DEFAULT_PROJECT_HEALING_SETTINGS,
  getProject,
  listProjects,
  getProjectMembers,
  getProjectEnvVars,
} from './projects/stores.js';

// Re-export utility functions
export {
  getProjectVisualSettings,
  setProjectVisualSettings,
  getProjectHealingSettings,
  setProjectHealingSettings,
  hasProjectAccess,
  getProjectRole,
} from './projects/utils.js';

// Re-export main routes function
export { projectRoutes } from './projects/index.js';
