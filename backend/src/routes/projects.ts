// Projects Routes - Re-exports from modular implementation
// This file maintains backward compatibility while the implementation is split into modules

// Re-export all types
export {
  Project,
  ProjectMember,
  EnvironmentVariable,
  ProjectVisualSettings,
  ProjectHealingSettings,
  CreateProjectBody,
  ProjectParams,
} from './projects/types';

// Re-export stores and constants (Maps removed in Feature #2112, only constants and async functions)
export {
  DEFAULT_PROJECT_VISUAL_SETTINGS,
  DEFAULT_PROJECT_HEALING_SETTINGS,
  getProject,
  listProjects,
  getProjectMembers,
  getProjectEnvVars,
} from './projects/stores';

// Re-export utility functions
export {
  getProjectVisualSettings,
  setProjectVisualSettings,
  getProjectHealingSettings,
  setProjectHealingSettings,
  hasProjectAccess,
  getProjectRole,
} from './projects/utils';

// Re-export main routes function
export { projectRoutes } from './projects/index';
