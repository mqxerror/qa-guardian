// Projects Module Utility Functions

import { ProjectVisualSettings, ProjectHealingSettings } from './types';
import {
  projects,
  projectMembers,
  projectVisualSettings,
  projectHealingSettings,
  DEFAULT_PROJECT_VISUAL_SETTINGS,
  DEFAULT_PROJECT_HEALING_SETTINGS,
} from './stores';

// Helper to get project visual settings with defaults
export function getProjectVisualSettings(projectId: string): ProjectVisualSettings {
  return projectVisualSettings.get(projectId) || { ...DEFAULT_PROJECT_VISUAL_SETTINGS };
}

// Helper to update project visual settings
export function setProjectVisualSettings(projectId: string, settings: Partial<ProjectVisualSettings>): ProjectVisualSettings {
  const current = getProjectVisualSettings(projectId);
  const updated: ProjectVisualSettings = {
    ...current,
    ...settings,
  };
  projectVisualSettings.set(projectId, updated);
  return updated;
}

// Helper to get project healing settings with defaults
export function getProjectHealingSettings(projectId: string): ProjectHealingSettings {
  return projectHealingSettings.get(projectId) || { ...DEFAULT_PROJECT_HEALING_SETTINGS };
}

// Helper to update project healing settings
export function setProjectHealingSettings(projectId: string, settings: Partial<ProjectHealingSettings>): ProjectHealingSettings {
  const current = getProjectHealingSettings(projectId);
  const updated: ProjectHealingSettings = {
    ...current,
    ...settings,
  };
  projectHealingSettings.set(projectId, updated);
  return updated;
}

// Helper to check if a user has access to a project
export function hasProjectAccess(projectId: string, userId: string, userRole: string): boolean {
  // Owners and admins have access to ALL projects in their organization
  if (userRole === 'owner' || userRole === 'admin') {
    return true;
  }

  // For developers and viewers, check project-level permissions
  const members = projectMembers.get(projectId) || [];
  return members.some(m => m.user_id === userId);
}

// Helper to get user's role on a specific project
export function getProjectRole(projectId: string, userId: string, orgRole: string): string | null {
  // Owners keep their org role for all projects
  if (orgRole === 'owner') return 'owner';
  if (orgRole === 'admin') return 'admin';

  // For developers and viewers, check project-level role
  const members = projectMembers.get(projectId) || [];
  const member = members.find(m => m.user_id === userId);
  return member ? member.role : null;
}
