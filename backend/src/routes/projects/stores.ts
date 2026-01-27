// Projects Module Data Stores
//
// This module provides data access for projects with database persistence.
// It maintains backward compatibility with Map-based access while adding
// async database operations for persistent storage.

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
  getMemoryProjects,
  getMemoryProjectMembers,
  getMemoryProjectEnvVars,
  getMemoryProjectVisualSettings,
  getMemoryProjectHealingSettings,
  DEFAULT_PROJECT_VISUAL_SETTINGS as DB_DEFAULT_VISUAL_SETTINGS,
  DEFAULT_PROJECT_HEALING_SETTINGS as DB_DEFAULT_HEALING_SETTINGS,
} from '../../services/repositories/projects';

// Export memory stores for backward compatibility with synchronous code
// These are still used by code that hasn't been migrated to async yet
export const projects: Map<string, Project> = getMemoryProjects();
export const projectMembers: Map<string, ProjectMember[]> = getMemoryProjectMembers();
export const projectEnvVars: Map<string, EnvironmentVariable[]> = getMemoryProjectEnvVars();
export const projectVisualSettings: Map<string, ProjectVisualSettings> = getMemoryProjectVisualSettings();
export const projectHealingSettings: Map<string, ProjectHealingSettings> = getMemoryProjectHealingSettings();

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
