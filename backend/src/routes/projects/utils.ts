// Projects Module Utility Functions
// Feature #2116: Migrated to async DB calls

import { ProjectVisualSettings, ProjectHealingSettings } from './types';
import {
  getProjectVisualSettings as dbGetProjectVisualSettings,
  updateProjectVisualSettings as dbUpdateProjectVisualSettings,
  getProjectHealingSettings as dbGetProjectHealingSettings,
  updateProjectHealingSettings as dbUpdateProjectHealingSettings,
  getProjectMembers as dbGetProjectMembers,
  isProjectMember as dbIsProjectMember,
  DEFAULT_PROJECT_VISUAL_SETTINGS,
  DEFAULT_PROJECT_HEALING_SETTINGS,
} from './stores';

// Helper to get project visual settings with defaults (async DB call)
export async function getProjectVisualSettings(projectId: string): Promise<ProjectVisualSettings> {
  return dbGetProjectVisualSettings(projectId);
}

// Helper to update project visual settings (async DB call)
export async function setProjectVisualSettings(projectId: string, settings: Partial<ProjectVisualSettings>): Promise<ProjectVisualSettings> {
  const current = await getProjectVisualSettings(projectId);
  const updated: ProjectVisualSettings = {
    ...current,
    ...settings,
  };
  await dbUpdateProjectVisualSettings(projectId, updated);
  return updated;
}

// Helper to get project healing settings with defaults (async DB call)
export async function getProjectHealingSettings(projectId: string): Promise<ProjectHealingSettings> {
  return dbGetProjectHealingSettings(projectId);
}

// Helper to update project healing settings (async DB call)
export async function setProjectHealingSettings(projectId: string, settings: Partial<ProjectHealingSettings>): Promise<ProjectHealingSettings> {
  const current = await getProjectHealingSettings(projectId);
  const updated: ProjectHealingSettings = {
    ...current,
    ...settings,
  };
  await dbUpdateProjectHealingSettings(projectId, updated);
  return updated;
}

// Helper to check if a user has access to a project (async DB call)
export async function hasProjectAccess(projectId: string, userId: string, userRole: string): Promise<boolean> {
  // Owners and admins have access to ALL projects in their organization
  if (userRole === 'owner' || userRole === 'admin') {
    return true;
  }

  // For developers and viewers, check project-level permissions
  return dbIsProjectMember(projectId, userId);
}

// Helper to get user's role on a specific project (async DB call)
export async function getProjectRole(projectId: string, userId: string, orgRole: string): Promise<string | null> {
  // Owners keep their org role for all projects
  if (orgRole === 'owner') return 'owner';
  if (orgRole === 'admin') return 'admin';

  // For developers and viewers, check project-level role
  const members = await dbGetProjectMembers(projectId);
  const member = members.find(m => m.user_id === userId);
  return member ? member.role : null;
}
