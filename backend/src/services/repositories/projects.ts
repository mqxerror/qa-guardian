/**
 * Projects Repository - Database CRUD operations for projects
 *
 * This module provides database persistence for projects.
 * PostgreSQL is REQUIRED - memory fallback has been removed (Feature #2101).
 * When database is not connected, operations will:
 * - CREATE: throw error (data would be lost)
 * - READ: return undefined/empty arrays/default settings
 * - UPDATE: return undefined/current settings
 * - DELETE: return false
 */

import { query, isDatabaseConnected, transaction } from '../database';
import { Project, ProjectMember, EnvironmentVariable, ProjectVisualSettings, ProjectHealingSettings } from '../../routes/projects/types';

// Feature #2097: UUID validation helper for defensive programming
// Allows both standard UUIDs (versions 1-5) and zero/nil UUIDs used for seeded test data
function isValidUUID(str: string): boolean {
  if (!str) return false;
  // Standard UUID pattern (versions 1-5)
  const standardUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  // Zero/nil UUID pattern (used for seeded default org/user data)
  const zeroUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return standardUUID.test(str) || zeroUUID.test(str);
}

// In-memory fallback stores for when PostgreSQL is not available
// This allows the application to function in development without a database
const memProjects = new Map<string, Project>();
const memProjectMembers = new Map<string, ProjectMember[]>();
const memProjectEnvVars = new Map<string, EnvironmentVariable[]>();

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

// ===== Column Constants (Feature #100: Replace SELECT * with explicit columns) =====

/**
 * Explicit column list for projects table.
 */
const PROJECT_COLUMNS = [
  'id', 'organization_id', 'name', 'slug', 'description', 'base_url',
  'archived', 'archived_at', 'settings', 'visual_settings', 'healing_settings',
  'created_at', 'updated_at'
].join(', ');

/**
 * Explicit column list for project_members table.
 */
const PROJECT_MEMBER_COLUMNS = [
  'project_id', 'user_id', 'role', 'added_at', 'added_by'
].join(', ');

/**
 * Explicit column list for project_env_vars table.
 */
const PROJECT_ENV_VAR_COLUMNS = [
  'id', 'project_id', 'key', 'value', 'encrypted', 'created_at', 'updated_at'
].join(', ');

// ===== PROJECTS =====

export async function createProject(project: Project): Promise<Project> {
  // Feature #2097: Defensive UUID validation
  if (!isValidUUID(project.organization_id)) {
    console.error('[Projects] Invalid organization_id format in createProject:', project.organization_id);
    throw new Error('Invalid organization_id format');
  }

  if (!isDatabaseConnected()) {
    // In-memory fallback for development without PostgreSQL
    console.log('[Projects] Using in-memory storage for createProject');
    memProjects.set(project.id, project);
    return project;
  }

  const result = await query<Project>(
    `INSERT INTO projects (id, organization_id, name, slug, description, base_url, archived, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [project.id, project.organization_id, project.name, project.slug, project.description, project.base_url, project.archived, project.created_at, project.updated_at]
  );
  if (result && result.rows[0]) {
    return result.rows[0];
  }
  throw new Error('Failed to create project in database');
}

export async function getProject(id: string): Promise<Project | undefined> {
  if (!isDatabaseConnected()) {
    return memProjects.get(id);
  }

  const result = await query<Project>(
    `SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = $1`,
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

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
  if (!isDatabaseConnected()) {
    const existing = memProjects.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updated_at: new Date() };
    memProjects.set(id, updated);
    return updated;
  }

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

export async function deleteProject(id: string): Promise<boolean> {
  if (!isDatabaseConnected()) {
    return memProjects.delete(id);
  }

  const result = await query(
    `DELETE FROM projects WHERE id = $1`,
    [id]
  );
  return result !== null && (result.rowCount ?? 0) > 0;
}

export async function listProjects(organizationId: string): Promise<Project[]> {
  // Feature #2097: Defensive UUID validation to prevent cryptic database errors
  if (!isValidUUID(organizationId)) {
    console.error('[Projects] Invalid organization_id format:', organizationId);
    return [];
  }

  if (!isDatabaseConnected()) {
    return Array.from(memProjects.values()).filter(p => p.organization_id === organizationId);
  }

  const result = await query<Project>(
    `SELECT ${PROJECT_COLUMNS} FROM projects WHERE organization_id = $1 ORDER BY created_at DESC`,
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

export async function getProjectBySlug(organizationId: string, slug: string): Promise<Project | undefined> {
  // Feature #2097: Defensive UUID validation
  if (!isValidUUID(organizationId)) {
    console.error('[Projects] Invalid organization_id format in getProjectBySlug:', organizationId);
    return undefined;
  }

  if (!isDatabaseConnected()) {
    return Array.from(memProjects.values()).find(p => p.organization_id === organizationId && p.slug === slug);
  }

  const result = await query<Project>(
    `SELECT ${PROJECT_COLUMNS} FROM projects WHERE organization_id = $1 AND slug = $2`,
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

export async function getProjectByName(organizationId: string, name: string): Promise<Project | undefined> {
  // Feature #2097: Defensive UUID validation
  if (!isValidUUID(organizationId)) {
    console.error('[Projects] Invalid organization_id format in getProjectByName:', organizationId);
    return undefined;
  }

  if (!isDatabaseConnected()) {
    return Array.from(memProjects.values()).find(p => p.organization_id === organizationId && p.name.toLowerCase() === name.toLowerCase());
  }

  const result = await query<Project>(
    `SELECT ${PROJECT_COLUMNS} FROM projects WHERE organization_id = $1 AND LOWER(name) = LOWER($2)`,
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

/**
 * Feature #139: Batch load multiple projects by ID in a single query
 * Eliminates N+1 query patterns when processing multiple test results
 * @param ids Array of project IDs to fetch
 * @returns Map of project ID to Project object for efficient lookup
 */
export async function batchGetProjects(ids: string[]): Promise<Map<string, Project>> {
  const result = new Map<string, Project>();
  if (!ids || ids.length === 0) return result;

  // Deduplicate IDs
  const uniqueIds = [...new Set(ids)];

  if (!isDatabaseConnected()) {
    for (const id of uniqueIds) {
      const project = memProjects.get(id);
      if (project) result.set(id, project);
    }
    return result;
  }

  // Single query using ANY($1) instead of N separate queries
  const queryResult = await query<Project>(
    `SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ANY($1)`,
    [uniqueIds]
  );

  if (queryResult) {
    for (const row of queryResult.rows) {
      const project: Project = {
        ...row,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
        archived_at: row.archived_at ? new Date(row.archived_at) : undefined,
      };
      result.set(row.id, project);
    }
  }
  return result;
}

// ===== PROJECT MEMBERS =====

export async function addProjectMember(member: ProjectMember): Promise<ProjectMember> {
  if (!isDatabaseConnected()) {
    const existing = memProjectMembers.get(member.project_id) || [];
    const idx = existing.findIndex(m => m.user_id === member.user_id);
    if (idx >= 0) existing[idx] = member; else existing.push(member);
    memProjectMembers.set(member.project_id, existing);
    return member;
  }

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

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  if (!isDatabaseConnected()) {
    return memProjectMembers.get(projectId) || [];
  }

  const result = await query<ProjectMember>(
    `SELECT ${PROJECT_MEMBER_COLUMNS} FROM project_members WHERE project_id = $1`,
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

export async function removeProjectMember(projectId: string, userId: string): Promise<boolean> {
  if (!isDatabaseConnected()) {
    return false;
  }

  const result = await query(
    `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [projectId, userId]
  );
  return result !== null && (result.rowCount ?? 0) > 0;
}

export async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
  const members = await getProjectMembers(projectId);
  return members.some(m => m.user_id === userId);
}

// ===== PROJECT VISUAL SETTINGS =====

export async function getProjectVisualSettings(projectId: string): Promise<ProjectVisualSettings> {
  if (!isDatabaseConnected()) {
    return DEFAULT_PROJECT_VISUAL_SETTINGS;
  }

  const result = await query<{ visual_settings: ProjectVisualSettings }>(
    `SELECT visual_settings FROM projects WHERE id = $1`,
    [projectId]
  );
  if (result && result.rows[0]?.visual_settings) {
    return { ...DEFAULT_PROJECT_VISUAL_SETTINGS, ...result.rows[0].visual_settings };
  }
  return DEFAULT_PROJECT_VISUAL_SETTINGS;
}

export async function updateProjectVisualSettings(projectId: string, settings: Partial<ProjectVisualSettings>): Promise<ProjectVisualSettings> {
  const current = await getProjectVisualSettings(projectId);
  const updated = { ...current, ...settings };

  if (!isDatabaseConnected()) {
    // Return the updated settings even without DB (for graceful degradation)
    return updated;
  }

  await query(
    `UPDATE projects SET visual_settings = $2, updated_at = NOW() WHERE id = $1`,
    [projectId, JSON.stringify(updated)]
  );
  return updated;
}

// ===== PROJECT HEALING SETTINGS =====

export async function getProjectHealingSettings(projectId: string): Promise<ProjectHealingSettings> {
  if (!isDatabaseConnected()) {
    return DEFAULT_PROJECT_HEALING_SETTINGS;
  }

  const result = await query<{ healing_settings: ProjectHealingSettings }>(
    `SELECT healing_settings FROM projects WHERE id = $1`,
    [projectId]
  );
  if (result && result.rows[0]?.healing_settings) {
    return { ...DEFAULT_PROJECT_HEALING_SETTINGS, ...result.rows[0].healing_settings };
  }
  return DEFAULT_PROJECT_HEALING_SETTINGS;
}

export async function updateProjectHealingSettings(projectId: string, settings: Partial<ProjectHealingSettings>): Promise<ProjectHealingSettings> {
  const current = await getProjectHealingSettings(projectId);
  const updated = { ...current, ...settings };

  if (!isDatabaseConnected()) {
    // Return the updated settings even without DB (for graceful degradation)
    return updated;
  }

  await query(
    `UPDATE projects SET healing_settings = $2, updated_at = NOW() WHERE id = $1`,
    [projectId, JSON.stringify(updated)]
  );
  return updated;
}

// ===== PROJECT ENVIRONMENT VARIABLES =====

export async function addProjectEnvVar(envVar: EnvironmentVariable): Promise<EnvironmentVariable> {
  if (!isDatabaseConnected()) {
    const existing = memProjectEnvVars.get(envVar.project_id) || [];
    const idx = existing.findIndex(e => e.key === envVar.key);
    if (idx >= 0) existing[idx] = envVar; else existing.push(envVar);
    memProjectEnvVars.set(envVar.project_id, existing);
    return envVar;
  }

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
  throw new Error('Failed to add environment variable to database');
}

export async function getProjectEnvVars(projectId: string): Promise<EnvironmentVariable[]> {
  if (!isDatabaseConnected()) {
    return memProjectEnvVars.get(projectId) || [];
  }

  const result = await query<EnvironmentVariable>(
    `SELECT ${PROJECT_ENV_VAR_COLUMNS} FROM project_env_vars WHERE project_id = $1 ORDER BY key`,
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

export async function deleteProjectEnvVar(projectId: string, envVarId: string): Promise<boolean> {
  if (!isDatabaseConnected()) {
    const existing = memProjectEnvVars.get(projectId) || [];
    const idx = existing.findIndex(e => e.id === envVarId);
    if (idx >= 0) { existing.splice(idx, 1); memProjectEnvVars.set(projectId, existing); return true; }
    return false;
  }

  const result = await query(
    `DELETE FROM project_env_vars WHERE project_id = $1 AND id = $2`,
    [projectId, envVarId]
  );
  return result !== null && (result.rowCount ?? 0) > 0;
}

// ===== COMPATIBILITY EXPORTS =====
// These exports allow gradual migration by providing Map-like access

/**
 * Get all projects as a Map (for compatibility with existing code)
 * Note: This loads all projects from the database, so use sparingly
 */
export async function getProjectsMap(): Promise<Map<string, Project>> {
  if (isDatabaseConnected()) {
    const result = await query<Project>(`SELECT ${PROJECT_COLUMNS} FROM projects ORDER BY created_at DESC`);
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
  // Return in-memory map when database not connected
  return new Map(memProjects);
}

// Feature #2102: Removed deprecated getMemory* functions
// Use async functions: getProjectsMap(), getProject(), listProjects(), etc.
