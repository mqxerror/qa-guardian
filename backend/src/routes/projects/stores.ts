// Projects Module Data Stores
//
// This module provides data access for projects with database persistence.
// PostgreSQL is REQUIRED - memory fallback has been removed (Feature #2101).
//
// Feature #2106: Map exports are DEPRECATED - they return empty Maps.
// Use async functions instead: getProject(), listProjects(), etc.

import {
  Project,
  ProjectMember,
  EnvironmentVariable,
  ProjectVisualSettings,
  ProjectHealingSettings,
} from './types';

// Import repository functions for database access
import {
  createProject as dbCreateProject,
  getProject as dbGetProject,
  updateProject as dbUpdateProject,
  deleteProject as dbDeleteProject,
  listProjects as dbListProjects,
  getProjectByName as dbGetProjectByName,
  addProjectMember as dbAddProjectMember,
  getProjectMembers as dbGetProjectMembers,
  removeProjectMember as dbRemoveProjectMember,
  isProjectMember as dbIsProjectMember,
  getProjectVisualSettings as dbGetProjectVisualSettings,
  updateProjectVisualSettings as dbUpdateProjectVisualSettings,
  getProjectHealingSettings as dbGetProjectHealingSettings,
  updateProjectHealingSettings as dbUpdateProjectHealingSettings,
  addProjectEnvVar as dbAddProjectEnvVar,
  getProjectEnvVars as dbGetProjectEnvVars,
  deleteProjectEnvVar as dbDeleteProjectEnvVar,
  DEFAULT_PROJECT_VISUAL_SETTINGS as DB_DEFAULT_VISUAL_SETTINGS,
  DEFAULT_PROJECT_HEALING_SETTINGS as DB_DEFAULT_HEALING_SETTINGS,
} from '../../services/repositories/projects';

// ===== DEPRECATED MAP EXPORTS =====
// WARNING: These Maps return EMPTY data and are DEPRECATED!
// Use async functions instead for database access.

let deprecationWarned = false;
function warnDeprecation() {
  if (!deprecationWarned) {
    console.warn('[DEPRECATED] projects, projectMembers, etc. Map exports return empty data.');
    console.warn('[DEPRECATED] Use async functions: getProject(), listProjects(), getProjectMembers()');
    deprecationWarned = true;
  }
}

// Create empty Maps with Proxy to log deprecation warning
const emptyProjectsMap = new Map<string, Project>();
const emptyMembersMap = new Map<string, ProjectMember[]>();
const emptyEnvVarsMap = new Map<string, EnvironmentVariable[]>();
const emptyVisualSettingsMap = new Map<string, ProjectVisualSettings>();
const emptyHealingSettingsMap = new Map<string, ProjectHealingSettings>();

export const projects: Map<string, Project> = new Proxy(emptyProjectsMap, {
  get(target, prop) { warnDeprecation(); const val = Reflect.get(target, prop); return typeof val === "function" ? val.bind(target) : val; }
});
export const projectMembers: Map<string, ProjectMember[]> = new Proxy(emptyMembersMap, {
  get(target, prop) { warnDeprecation(); const val = Reflect.get(target, prop); return typeof val === "function" ? val.bind(target) : val; }
});
export const projectEnvVars: Map<string, EnvironmentVariable[]> = new Proxy(emptyEnvVarsMap, {
  get(target, prop) { warnDeprecation(); const val = Reflect.get(target, prop); return typeof val === "function" ? val.bind(target) : val; }
});
export const projectVisualSettings: Map<string, ProjectVisualSettings> = new Proxy(emptyVisualSettingsMap, {
  get(target, prop) { warnDeprecation(); const val = Reflect.get(target, prop); return typeof val === "function" ? val.bind(target) : val; }
});
export const projectHealingSettings: Map<string, ProjectHealingSettings> = new Proxy(emptyHealingSettingsMap, {
  get(target, prop) { warnDeprecation(); const val = Reflect.get(target, prop); return typeof val === "function" ? val.bind(target) : val; }
});

// Export default settings
export const DEFAULT_PROJECT_VISUAL_SETTINGS: ProjectVisualSettings = DB_DEFAULT_VISUAL_SETTINGS;
export const DEFAULT_PROJECT_HEALING_SETTINGS: ProjectHealingSettings = DB_DEFAULT_HEALING_SETTINGS;

// ===== ASYNC DATABASE FUNCTIONS =====
// Use these functions for new code or when migrating to persistent storage

// Projects CRUD
export const createProject = dbCreateProject;
export const getProject = dbGetProject;
export const updateProject = dbUpdateProject;
export const deleteProject = dbDeleteProject;
export const listProjects = dbListProjects;
export const getProjectByName = dbGetProjectByName;

// Project Members
export const addProjectMember = dbAddProjectMember;
export const getProjectMembers = dbGetProjectMembers;
export const removeProjectMember = dbRemoveProjectMember;
export const isProjectMember = dbIsProjectMember;

// Visual Settings
export const getProjectVisualSettings = dbGetProjectVisualSettings;
export const updateProjectVisualSettings = dbUpdateProjectVisualSettings;

// Healing Settings
export const getProjectHealingSettings = dbGetProjectHealingSettings;
export const updateProjectHealingSettings = dbUpdateProjectHealingSettings;

// Environment Variables
export const addProjectEnvVar = dbAddProjectEnvVar;
export const getProjectEnvVars = dbGetProjectEnvVars;
export const deleteProjectEnvVar = dbDeleteProjectEnvVar;
