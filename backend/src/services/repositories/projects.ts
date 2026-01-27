/**
 * Projects Repository - Database CRUD operations for projects
 *
 * This module provides database persistence for projects when PostgreSQL is available,
 * with transparent fallback to in-memory storage when database is not connected.
 */

import { query, isDatabaseConnected, transaction } from '../database';
import { Project, ProjectMember, EnvironmentVariable, ProjectVisualSettings, ProjectHealingSettings } from '../../routes/projects/types';

// In-memory stores (used as fallback when database is not available)
const memoryProjects: Map<string, Project> = new Map();
const memoryProjectMembers: Map<string, ProjectMember[]> = new Map();
const memoryProjectEnvVars: Map<string, EnvironmentVariable[]> = new Map();
const memoryProjectVisualSettings: Map<string, ProjectVisualSettings> = new Map();
const memoryProjectHealingSettings: Map<string, ProjectHealingSettings> = new Map();

// Default settings
export const DEFAULT_PROJECT_VISUAL_SETTINGS: ProjectVisualSettings = {
  default_diff_threshold: 0,
  default_diff_threshold_mode: 'percentage',
  default_capture_mode: 'full_page',
  default_viewport_width: 1280,
  default_viewport_height: 720,
};

export const DEFAULT_PROJECT_HEALING_SETTINGS: ProjectHealingSettings = {
  healing_enabled: true,
  healing_timeout: 30,
  max_healing_attempts: 3,
  healing_strategies: ['selector_fallback', 'visual_match', 'text_match', 'attribute_match'],
  notify_on_healing: false,
  auto_heal_confidence_threshold: 0.85,
};

// ===== PROJECTS =====

export async function createProject(project: Project): Promise<Project> {
  if (isDatabaseConnected()) {
    const result = await query<Project>(
      `INSERT INTO projects (id, organization_id, name, slug, description, base_url, archived, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [project.id, project.organization_id, project.name, project.slug, project.description, project.base_url, project.archived, project.created_at, project.updated_at]
    );
    if (result && result.rows[0]) {
      return result.rows[0];
    }
  }
  // Fallback to memory
  memoryProjects.set(project.id, project);
  return project;
}

export async function getProject(id: string): Promise<Project | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<Project>(
      `SELECT * FROM projects WHERE id = $1`,
      [id]
    );
    if (result && result.rows[0]) {
      return {
        ...result.rows[0],
        created_at: new Date(result.rows[0].created_at),
        updated_at: new Date(result.rows[0].updated_at),
        archived_at: result.rows[0].archived_at ? new Date(result.rows[0].archived_at) : undefined,
      };
    }
    return undefined;
  }
  return memoryProjects.get(id);
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
  if (isDatabaseConnected()) {
    const project = await getProject(id);
    if (!project) return undefined;

    const updatedProject = {
      ...project,
      ...updates,
      updated_at: new Date(),
    };

    const result = await query<Project>(
      `UPDATE projects SET
        name = $2, slug = $3, description = $4, base_url = $5,
        archived = $6, archived_at = $7, updated_at = $8
       WHERE id = $1
       RETURNING *`,
      [id, updatedProject.name, updatedProject.slug, updatedProject.description, updatedProject.base_url, updatedProject.archived, updatedProject.archived_at, updatedProject.updated_at]
    );
    if (result && result.rows[0]) {
      return {
        ...result.rows[0],
        created_at: new Date(result.rows[0].created_at),
        updated_at: new Date(result.rows[0].updated_at),
        archived_at: result.rows[0].archived_at ? new Date(result.rows[0].archived_at) : undefined,
      };
    }
    return undefined;
  }
  // Fallback to memory
  const project = memoryProjects.get(id);
  if (!project) return undefined;
  const updatedProject = { ...project, ...updates, updated_at: new Date() };
  memoryProjects.set(id, updatedProject);
  return updatedProject;
}

export async function deleteProject(id: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      `DELETE FROM projects WHERE id = $1`,
      [id]
    );
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return memoryProjects.delete(id);
}

export async function listProjects(organizationId: string): Promise<Project[]> {
  if (isDatabaseConnected()) {
    const result = await query<Project>(
      `SELECT * FROM projects WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId]
    );
    if (result) {
      return result.rows.map(row => ({
        ...row,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
        archived_at: row.archived_at ? new Date(row.archived_at) : undefined,
      }));
    }
    return [];
  }
  return Array.from(memoryProjects.values()).filter(p => p.organization_id === organizationId);
}

export async function getProjectBySlug(organizationId: string, slug: string): Promise<Project | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<Project>(
      `SELECT * FROM projects WHERE organization_id = $1 AND slug = $2`,
      [organizationId, slug]
    );
    if (result && result.rows[0]) {
      return {
        ...result.rows[0],
        created_at: new Date(result.rows[0].created_at),
        updated_at: new Date(result.rows[0].updated_at),
        archived_at: result.rows[0].archived_at ? new Date(result.rows[0].archived_at) : undefined,
      };
    }
    return undefined;
  }
  return Array.from(memoryProjects.values()).find(p => p.organization_id === organizationId && p.slug === slug);
}

export async function getProjectByName(organizationId: string, name: string): Promise<Project | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<Project>(
      `SELECT * FROM projects WHERE organization_id = $1 AND LOWER(name) = LOWER($2)`,
      [organizationId, name]
    );
    if (result && result.rows[0]) {
      return {
        ...result.rows[0],
        created_at: new Date(result.rows[0].created_at),
        updated_at: new Date(result.rows[0].updated_at),
      };
    }
    return undefined;
  }
  return Array.from(memoryProjects.values()).find(
    p => p.organization_id === organizationId && p.name.toLowerCase() === name.toLowerCase()
  );
}

// ===== PROJECT MEMBERS =====

export async function addProjectMember(member: ProjectMember): Promise<ProjectMember> {
  if (isDatabaseConnected()) {
    // First ensure the project_members table exists with the correct schema
    await query(`
      CREATE TABLE IF NOT EXISTS project_members (
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        added_by UUID,
        PRIMARY KEY (project_id, user_id)
      )
    `);

    await query(
      `INSERT INTO project_members (project_id, user_id, role, added_at, added_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = $3`,
      [member.project_id, member.user_id, member.role, member.added_at, member.added_by]
    );
    return member;
  }
  // Fallback to memory
  const members = memoryProjectMembers.get(member.project_id) || [];
  const existingIndex = members.findIndex(m => m.user_id === member.user_id);
  if (existingIndex >= 0) {
    members[existingIndex] = member;
  } else {
    members.push(member);
  }
  memoryProjectMembers.set(member.project_id, members);
  return member;
}

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  if (isDatabaseConnected()) {
    const result = await query<ProjectMember>(
      `SELECT * FROM project_members WHERE project_id = $1`,
      [projectId]
    );
    if (result) {
      return result.rows.map(row => ({
        ...row,
        added_at: new Date(row.added_at),
      }));
    }
    return [];
  }
  return memoryProjectMembers.get(projectId) || [];
}

export async function removeProjectMember(projectId: string, userId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId]
    );
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  const members = memoryProjectMembers.get(projectId) || [];
  const filtered = members.filter(m => m.user_id !== userId);
  memoryProjectMembers.set(projectId, filtered);
  return filtered.length < members.length;
}

export async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
  const members = await getProjectMembers(projectId);
  return members.some(m => m.user_id === userId);
}

// ===== PROJECT VISUAL SETTINGS =====

export async function getProjectVisualSettings(projectId: string): Promise<ProjectVisualSettings> {
  if (isDatabaseConnected()) {
    const result = await query<{ visual_settings: ProjectVisualSettings }>(
      `SELECT visual_settings FROM projects WHERE id = $1`,
      [projectId]
    );
    if (result && result.rows[0]?.visual_settings) {
      return { ...DEFAULT_PROJECT_VISUAL_SETTINGS, ...result.rows[0].visual_settings };
    }
    return DEFAULT_PROJECT_VISUAL_SETTINGS;
  }
  return memoryProjectVisualSettings.get(projectId) || DEFAULT_PROJECT_VISUAL_SETTINGS;
}

export async function updateProjectVisualSettings(projectId: string, settings: Partial<ProjectVisualSettings>): Promise<ProjectVisualSettings> {
  const current = await getProjectVisualSettings(projectId);
  const updated = { ...current, ...settings };

  if (isDatabaseConnected()) {
    await query(
      `UPDATE projects SET visual_settings = $2, updated_at = NOW() WHERE id = $1`,
      [projectId, JSON.stringify(updated)]
    );
    return updated;
  }
  memoryProjectVisualSettings.set(projectId, updated);
  return updated;
}

// ===== PROJECT HEALING SETTINGS =====

export async function getProjectHealingSettings(projectId: string): Promise<ProjectHealingSettings> {
  if (isDatabaseConnected()) {
    const result = await query<{ healing_settings: ProjectHealingSettings }>(
      `SELECT healing_settings FROM projects WHERE id = $1`,
      [projectId]
    );
    if (result && result.rows[0]?.healing_settings) {
      return { ...DEFAULT_PROJECT_HEALING_SETTINGS, ...result.rows[0].healing_settings };
    }
    return DEFAULT_PROJECT_HEALING_SETTINGS;
  }
  return memoryProjectHealingSettings.get(projectId) || DEFAULT_PROJECT_HEALING_SETTINGS;
}

export async function updateProjectHealingSettings(projectId: string, settings: Partial<ProjectHealingSettings>): Promise<ProjectHealingSettings> {
  const current = await getProjectHealingSettings(projectId);
  const updated = { ...current, ...settings };

  if (isDatabaseConnected()) {
    await query(
      `UPDATE projects SET healing_settings = $2, updated_at = NOW() WHERE id = $1`,
      [projectId, JSON.stringify(updated)]
    );
    return updated;
  }
  memoryProjectHealingSettings.set(projectId, updated);
  return updated;
}

// ===== PROJECT ENVIRONMENT VARIABLES =====

export async function addProjectEnvVar(envVar: EnvironmentVariable): Promise<EnvironmentVariable> {
  if (isDatabaseConnected()) {
    // Ensure table exists
    await query(`
      CREATE TABLE IF NOT EXISTS project_env_vars (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
        key VARCHAR(255) NOT NULL,
        value TEXT NOT NULL,
        is_secret BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(project_id, key)
      )
    `);

    const result = await query<EnvironmentVariable>(
      `INSERT INTO project_env_vars (id, project_id, key, value, is_secret, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (project_id, key) DO UPDATE SET value = $4, is_secret = $5, updated_at = $7
       RETURNING *`,
      [envVar.id, envVar.project_id, envVar.key, envVar.value, envVar.is_secret, envVar.created_at, envVar.updated_at]
    );
    if (result && result.rows[0]) {
      return {
        ...result.rows[0],
        created_at: new Date(result.rows[0].created_at),
        updated_at: new Date(result.rows[0].updated_at),
      };
    }
  }
  // Fallback to memory
  const envVars = memoryProjectEnvVars.get(envVar.project_id) || [];
  const existingIndex = envVars.findIndex(e => e.key === envVar.key);
  if (existingIndex >= 0) {
    envVars[existingIndex] = envVar;
  } else {
    envVars.push(envVar);
  }
  memoryProjectEnvVars.set(envVar.project_id, envVars);
  return envVar;
}

export async function getProjectEnvVars(projectId: string): Promise<EnvironmentVariable[]> {
  if (isDatabaseConnected()) {
    const result = await query<EnvironmentVariable>(
      `SELECT * FROM project_env_vars WHERE project_id = $1 ORDER BY key`,
      [projectId]
    );
    if (result) {
      return result.rows.map(row => ({
        ...row,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
      }));
    }
    return [];
  }
  return memoryProjectEnvVars.get(projectId) || [];
}

export async function deleteProjectEnvVar(projectId: string, envVarId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      `DELETE FROM project_env_vars WHERE project_id = $1 AND id = $2`,
      [projectId, envVarId]
    );
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  const envVars = memoryProjectEnvVars.get(projectId) || [];
  const filtered = envVars.filter(e => e.id !== envVarId);
  memoryProjectEnvVars.set(projectId, filtered);
  return filtered.length < envVars.length;
}

// ===== COMPATIBILITY EXPORTS =====
// These exports allow gradual migration by providing Map-like access

/**
 * Get all projects as a Map (for compatibility with existing code)
 * Note: This loads all projects from the database, so use sparingly
 */
export async function getProjectsMap(): Promise<Map<string, Project>> {
  if (isDatabaseConnected()) {
    const result = await query<Project>(`SELECT * FROM projects ORDER BY created_at DESC`);
    const map = new Map<string, Project>();
    if (result) {
      for (const row of result.rows) {
        map.set(row.id, {
          ...row,
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at),
          archived_at: row.archived_at ? new Date(row.archived_at) : undefined,
        });
      }
    }
    return map;
  }
  return memoryProjects;
}

/**
 * Synchronous access to in-memory projects store
 * Use this only when async access is not possible
 */
export function getMemoryProjects(): Map<string, Project> {
  return memoryProjects;
}

export function getMemoryProjectMembers(): Map<string, ProjectMember[]> {
  return memoryProjectMembers;
}

export function getMemoryProjectEnvVars(): Map<string, EnvironmentVariable[]> {
  return memoryProjectEnvVars;
}

export function getMemoryProjectVisualSettings(): Map<string, ProjectVisualSettings> {
  return memoryProjectVisualSettings;
}

export function getMemoryProjectHealingSettings(): Map<string, ProjectHealingSettings> {
  return memoryProjectHealingSettings;
}
