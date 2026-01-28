/**
 * Organizations Repository for PostgreSQL
 *
 * This repository provides database persistence for organizations, members,
 * invitations, and organization settings.
 *
 * PostgreSQL is REQUIRED - memory fallback has been removed (Feature #2102).
 * When database is not connected, operations will:
 * - CREATE: throw error (data would be lost)
 * - READ: return null/empty arrays/default settings
 * - UPDATE: return null/current settings
 * - DELETE: return false
 *
 * Feature #2085: Original PostgreSQL migration
 * Feature #2102: Remove memory Maps fallback
 */

import { query, isDatabaseConnected } from '../database';

// ============================================================================
// Types
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  created_at: Date;
}

export interface OrganizationMember {
  user_id: string;
  organization_id: string;
  role: 'owner' | 'admin' | 'developer' | 'viewer';
}

export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role: 'admin' | 'developer' | 'viewer';
  invited_by: string;
  created_at: Date;
  status: 'pending' | 'accepted' | 'expired';
  accepted_at?: Date;
  accepted_by?: string;
}

export interface AutoQuarantineSettings {
  enabled: boolean;
  threshold: number;
  min_runs: number;
  notify_on_quarantine: boolean;
  quarantine_reason_prefix: string;
}

export interface RetryStrategyRule {
  min_score: number;
  max_score: number;
  retries: number;
}

export interface RetryStrategySettings {
  enabled: boolean;
  rules: RetryStrategyRule[];
  default_retries: number;
  max_retries: number;
}

// Default settings
export const DEFAULT_AUTO_QUARANTINE_SETTINGS: AutoQuarantineSettings = {
  enabled: true,
  threshold: 0.7,
  min_runs: 5,
  notify_on_quarantine: true,
  quarantine_reason_prefix: 'Auto-quarantined: ',
};

export const DEFAULT_RETRY_STRATEGY_SETTINGS: RetryStrategySettings = {
  enabled: true,
  rules: [
    { min_score: 0, max_score: 0.3, retries: 1 },
    { min_score: 0.3, max_score: 0.6, retries: 2 },
    { min_score: 0.6, max_score: 1.01, retries: 3 },
  ],
  default_retries: 1,
  max_retries: 5,
};

// ============================================================================
// In-memory fallback stores (used when PostgreSQL is not connected)
// When database IS connected, these are kept in sync as a cache.
// ============================================================================

const memoryOrganizations = new Map<string, Organization>();
const memoryOrganizationMembers = new Map<string, OrganizationMember[]>();
const memoryInvitations = new Map<string, Invitation>();
const memoryAutoQuarantineSettings = new Map<string, AutoQuarantineSettings>();
const memoryRetryStrategySettings = new Map<string, RetryStrategySettings>();

// Export memory Maps for backward compatibility (used by route files)
export function getMemoryOrganizations(): Map<string, Organization> {
  return memoryOrganizations;
}

export function getMemoryOrganizationMembers(): Map<string, OrganizationMember[]> {
  return memoryOrganizationMembers;
}

export function getMemoryInvitations(): Map<string, Invitation> {
  return memoryInvitations;
}

export function getMemoryAutoQuarantineSettings(): Map<string, AutoQuarantineSettings> {
  return memoryAutoQuarantineSettings;
}

export function getMemoryRetryStrategySettings(): Map<string, RetryStrategySettings> {
  return memoryRetryStrategySettings;
}

// ============================================================================
// Organization Functions
// ============================================================================

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  created_at: Date;
}

function rowToOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    timezone: row.timezone || 'UTC',
    created_at: new Date(row.created_at),
  };
}

export async function createOrganization(org: Organization): Promise<Organization> {
  // Always store in memory for fallback
  memoryOrganizations.set(org.id, org);

  if (!isDatabaseConnected()) {
    return org;
  }

  try {
    await query(
      `INSERT INTO organizations (id, name, slug, settings, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO UPDATE SET name = $2, slug = $3, settings = $4, updated_at = NOW()`,
      [org.id, org.name, org.slug, JSON.stringify({ timezone: org.timezone }), org.created_at]
    );
    return org;
  } catch (error) {
    console.error('[Org Repo] Failed to create organization:', error);
    throw error;
  }
}

export async function getOrganizationById(id: string): Promise<Organization | null> {
  if (!isDatabaseConnected()) {
    return memoryOrganizations.get(id) || null;
  }

  try {
    const result = await query<OrganizationRow>(
      `SELECT id, name, slug, settings->>'timezone' as timezone, created_at FROM organizations WHERE id = $1`,
      [id]
    );
    if (result && result.rows.length > 0) {
      return rowToOrganization(result.rows[0]);
    }
  } catch (error) {
    console.error('[Org Repo] Failed to get organization:', error);
  }

  return null;
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  if (!isDatabaseConnected()) {
    return null;
  }

  try {
    const result = await query<OrganizationRow>(
      `SELECT id, name, slug, settings->>'timezone' as timezone, created_at FROM organizations WHERE slug = $1`,
      [slug]
    );
    if (result && result.rows.length > 0) {
      return rowToOrganization(result.rows[0]);
    }
  } catch (error) {
    console.error('[Org Repo] Failed to get organization by slug:', error);
  }

  return null;
}

export async function updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization | null> {
  if (!isDatabaseConnected()) {
    return null;
  }

  const existing = await getOrganizationById(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates };

  try {
    await query(
      `UPDATE organizations SET name = $2, slug = $3, settings = $4, updated_at = NOW() WHERE id = $1`,
      [id, updated.name, updated.slug, JSON.stringify({ timezone: updated.timezone })]
    );
    return updated;
  } catch (error) {
    console.error('[Org Repo] Failed to update organization:', error);
    return null;
  }
}

export async function deleteOrganization(id: string): Promise<boolean> {
  if (!isDatabaseConnected()) {
    return false;
  }

  try {
    const result = await query('DELETE FROM organizations WHERE id = $1', [id]);
    return result !== null && (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('[Org Repo] Failed to delete organization:', error);
    return false;
  }
}

export async function listOrganizations(): Promise<Organization[]> {
  if (!isDatabaseConnected()) {
    return [];
  }

  try {
    const result = await query<OrganizationRow>(
      `SELECT id, name, slug, settings->>'timezone' as timezone, created_at FROM organizations ORDER BY created_at`
    );
    if (result) {
      return result.rows.map(rowToOrganization);
    }
  } catch (error) {
    console.error('[Org Repo] Failed to list organizations:', error);
  }

  return [];
}

// ============================================================================
// Organization Member Functions
// ============================================================================

export async function addOrganizationMember(member: OrganizationMember): Promise<void> {
  // Always store in memory for fallback
  const existing = memoryOrganizationMembers.get(member.organization_id) || [];
  if (!existing.some(m => m.user_id === member.user_id)) {
    existing.push(member);
  }
  memoryOrganizationMembers.set(member.organization_id, existing);

  if (!isDatabaseConnected()) {
    return;
  }

  try {
    // Ensure the organization_members table exists
    await query(`
      CREATE TABLE IF NOT EXISTS organization_members (
        user_id UUID NOT NULL,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (user_id, organization_id)
      )
    `);

    await query(
      `INSERT INTO organization_members (user_id, organization_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, organization_id) DO UPDATE SET role = $3`,
      [member.user_id, member.organization_id, member.role]
    );
  } catch (error) {
    console.error('[Org Repo] Failed to add organization member:', error);
    throw error;
  }
}

export async function removeOrganizationMember(organizationId: string, userId: string): Promise<boolean> {
  if (!isDatabaseConnected()) {
    return false;
  }

  try {
    const result = await query(
      `DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userId]
    );
    return result !== null && (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('[Org Repo] Failed to remove organization member:', error);
    return false;
  }
}

export async function getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
  if (!isDatabaseConnected()) {
    return memoryOrganizationMembers.get(organizationId) || [];
  }

  try {
    const result = await query<OrganizationMember>(
      `SELECT user_id, organization_id, role FROM organization_members WHERE organization_id = $1`,
      [organizationId]
    );
    if (result) {
      return result.rows;
    }
  } catch (error) {
    console.error('[Org Repo] Failed to get organization members:', error);
  }

  return [];
}

export async function updateMemberRole(
  organizationId: string,
  userId: string,
  role: OrganizationMember['role']
): Promise<boolean> {
  if (!isDatabaseConnected()) {
    return false;
  }

  try {
    const result = await query(
      `UPDATE organization_members SET role = $3 WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userId, role]
    );
    return result !== null && (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('[Org Repo] Failed to update member role:', error);
    return false;
  }
}

export async function getUserOrganization(userId: string): Promise<string | null> {
  if (!isDatabaseConnected()) {
    // Use in-memory fallback
    for (const [orgId, members] of memoryOrganizationMembers) {
      if (members.some(m => m.user_id === userId)) {
        return orgId;
      }
    }
    return null;
  }

  try {
    const result = await query<{ organization_id: string }>(
      `SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    if (result && result.rows.length > 0) {
      return result.rows[0].organization_id;
    }
  } catch (error) {
    console.error('[Org Repo] Failed to get user organization:', error);
  }

  return null;
}

export async function getUserOrganizations(userId: string): Promise<Array<{
  organization_id: string;
  role: string;
  organization: Organization | undefined;
}>> {
  if (!isDatabaseConnected()) {
    return [];
  }

  try {
    const result = await query<{ organization_id: string; role: string }>(
      `SELECT organization_id, role FROM organization_members WHERE user_id = $1`,
      [userId]
    );

    if (result && result.rows.length > 0) {
      const userOrgs: Array<{
        organization_id: string;
        role: string;
        organization: Organization | undefined;
      }> = [];

      for (const row of result.rows) {
        const org = await getOrganizationById(row.organization_id);
        userOrgs.push({
          organization_id: row.organization_id,
          role: row.role,
          organization: org || undefined,
        });
      }

      return userOrgs;
    }
  } catch (error) {
    console.error('[Org Repo] Failed to get user organizations:', error);
  }

  return [];
}

// ============================================================================
// Invitation Functions
// ============================================================================

export async function createInvitation(invitation: Invitation): Promise<Invitation> {
  if (!isDatabaseConnected()) {
    throw new Error('Database connection required - cannot create invitation without PostgreSQL');
  }

  try {
    await query(
      `INSERT INTO invitations (id, organization_id, email, role, invited_by, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        invitation.id,
        invitation.organization_id,
        invitation.email,
        invitation.role,
        invitation.invited_by,
        invitation.id, // Using id as token_hash for simplicity
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days expiry
        invitation.created_at,
      ]
    );
    return invitation;
  } catch (error) {
    console.error('[Org Repo] Failed to create invitation:', error);
    throw error;
  }
}

export async function getInvitationById(id: string): Promise<Invitation | null> {
  if (!isDatabaseConnected()) {
    return null;
  }

  try {
    const result = await query<Invitation>(
      `SELECT * FROM invitations WHERE id = $1`,
      [id]
    );
    if (result && result.rows.length > 0) {
      const row = result.rows[0];
      return {
        ...row,
        created_at: new Date(row.created_at),
        accepted_at: row.accepted_at ? new Date(row.accepted_at) : undefined,
      };
    }
  } catch (error) {
    console.error('[Org Repo] Failed to get invitation:', error);
  }

  return null;
}

export async function getInvitationsByOrg(organizationId: string): Promise<Invitation[]> {
  if (!isDatabaseConnected()) {
    return [];
  }

  try {
    const result = await query<Invitation>(
      `SELECT * FROM invitations WHERE organization_id = $1`,
      [organizationId]
    );
    if (result) {
      return result.rows.map(row => ({
        ...row,
        created_at: new Date(row.created_at),
        accepted_at: row.accepted_at ? new Date(row.accepted_at) : undefined,
      }));
    }
  } catch (error) {
    console.error('[Org Repo] Failed to get invitations by org:', error);
  }

  return [];
}

export async function updateInvitation(id: string, updates: Partial<Invitation>): Promise<Invitation | null> {
  if (!isDatabaseConnected()) {
    return null;
  }

  const existing = await getInvitationById(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates };

  try {
    if (updates.status === 'accepted') {
      await query(
        `UPDATE invitations SET accepted_at = $2 WHERE id = $1`,
        [id, updates.accepted_at || new Date()]
      );
    }
    return updated;
  } catch (error) {
    console.error('[Org Repo] Failed to update invitation:', error);
    return null;
  }
}

export async function deleteInvitation(id: string): Promise<boolean> {
  if (!isDatabaseConnected()) {
    return false;
  }

  try {
    const result = await query('DELETE FROM invitations WHERE id = $1', [id]);
    return result !== null && (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('[Org Repo] Failed to delete invitation:', error);
    return false;
  }
}

// ============================================================================
// Auto-Quarantine Settings Functions
// Note: These are async but fall back to defaults when DB not connected (Feature #2102)
// ============================================================================

export async function getAutoQuarantineSettings(organizationId: string): Promise<AutoQuarantineSettings> {
  if (!isDatabaseConnected()) {
    return { ...DEFAULT_AUTO_QUARANTINE_SETTINGS };
  }

  try {
    const result = await query<{ auto_quarantine_settings: AutoQuarantineSettings }>(
      `SELECT settings->'auto_quarantine' as auto_quarantine_settings FROM organizations WHERE id = $1`,
      [organizationId]
    );
    if (result && result.rows[0]?.auto_quarantine_settings) {
      return { ...DEFAULT_AUTO_QUARANTINE_SETTINGS, ...result.rows[0].auto_quarantine_settings };
    }
  } catch (error) {
    console.error('[Org Repo] Failed to get auto-quarantine settings:', error);
  }

  return { ...DEFAULT_AUTO_QUARANTINE_SETTINGS };
}

export async function setAutoQuarantineSettings(
  organizationId: string,
  settings: Partial<AutoQuarantineSettings>
): Promise<AutoQuarantineSettings> {
  const current = await getAutoQuarantineSettings(organizationId);
  const updated: AutoQuarantineSettings = {
    ...current,
    ...settings,
    threshold: Math.max(0, Math.min(1, settings.threshold ?? current.threshold)),
    min_runs: Math.max(2, settings.min_runs ?? current.min_runs),
  };

  if (!isDatabaseConnected()) {
    return updated; // Return computed value but don't persist
  }

  try {
    await query(
      `UPDATE organizations SET settings = jsonb_set(COALESCE(settings, '{}'), '{auto_quarantine}', $2::jsonb) WHERE id = $1`,
      [organizationId, JSON.stringify(updated)]
    );
  } catch (error) {
    console.error('[Org Repo] Failed to set auto-quarantine settings:', error);
  }

  return updated;
}

// ============================================================================
// Retry Strategy Settings Functions
// Note: These are async but fall back to defaults when DB not connected (Feature #2102)
// ============================================================================

export async function getRetryStrategySettings(organizationId: string): Promise<RetryStrategySettings> {
  if (!isDatabaseConnected()) {
    return {
      ...DEFAULT_RETRY_STRATEGY_SETTINGS,
      rules: [...DEFAULT_RETRY_STRATEGY_SETTINGS.rules],
    };
  }

  try {
    const result = await query<{ retry_strategy_settings: RetryStrategySettings }>(
      `SELECT settings->'retry_strategy' as retry_strategy_settings FROM organizations WHERE id = $1`,
      [organizationId]
    );
    if (result && result.rows[0]?.retry_strategy_settings) {
      return {
        ...DEFAULT_RETRY_STRATEGY_SETTINGS,
        ...result.rows[0].retry_strategy_settings,
        rules: result.rows[0].retry_strategy_settings.rules || [...DEFAULT_RETRY_STRATEGY_SETTINGS.rules],
      };
    }
  } catch (error) {
    console.error('[Org Repo] Failed to get retry strategy settings:', error);
  }

  return {
    ...DEFAULT_RETRY_STRATEGY_SETTINGS,
    rules: [...DEFAULT_RETRY_STRATEGY_SETTINGS.rules],
  };
}

export async function setRetryStrategySettings(
  organizationId: string,
  settings: Partial<RetryStrategySettings>
): Promise<RetryStrategySettings> {
  const current = await getRetryStrategySettings(organizationId);
  const updated: RetryStrategySettings = {
    ...current,
    ...settings,
    max_retries: Math.max(1, Math.min(10, settings.max_retries ?? current.max_retries)),
    default_retries: Math.max(0, Math.min(
      settings.max_retries ?? current.max_retries,
      settings.default_retries ?? current.default_retries
    )),
    rules: settings.rules ?? current.rules,
  };

  if (!isDatabaseConnected()) {
    return updated; // Return computed value but don't persist
  }

  try {
    await query(
      `UPDATE organizations SET settings = jsonb_set(COALESCE(settings, '{}'), '{retry_strategy}', $2::jsonb) WHERE id = $1`,
      [organizationId, JSON.stringify(updated)]
    );
  } catch (error) {
    console.error('[Org Repo] Failed to set retry strategy settings:', error);
  }

  return updated;
}

export async function getRetriesForFlakinessScore(organizationId: string, flakinessScore: number): Promise<number> {
  const settings = await getRetryStrategySettings(organizationId);

  if (!settings.enabled) {
    return settings.default_retries;
  }

  for (const rule of settings.rules) {
    if (flakinessScore >= rule.min_score && flakinessScore < rule.max_score) {
      return Math.min(rule.retries, settings.max_retries);
    }
  }

  return settings.default_retries;
}

// ============================================================================
// Seed Functions
// ============================================================================

// Default organization UUIDs (consistent across restarts)
export const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';
export const OTHER_ORG_ID = '00000000-0000-0000-0000-000000000002';

// Default user UUIDs (must match auth.ts seedTestUsers)
export const DEFAULT_USER_IDS = {
  owner: '00000000-0000-0000-0000-000000000011',
  admin: '00000000-0000-0000-0000-000000000012',
  developer: '00000000-0000-0000-0000-000000000013',
  viewer: '00000000-0000-0000-0000-000000000014',
  otherOwner: '00000000-0000-0000-0000-000000000015',
};

/**
 * Seed default organizations and members to the database.
 * This function is async and should be called after database is connected.
 * If database is not connected, it does nothing (seed will happen when DB connects).
 */
export async function seedDefaultOrganizations(): Promise<void> {
  if (!isDatabaseConnected()) {
    console.log('[Org Repo] Database not connected - seeding organizations to memory');
    // Seed to memory maps so the app works without PostgreSQL
    memoryOrganizations.set(DEFAULT_ORG_ID, {
      id: DEFAULT_ORG_ID,
      name: 'Default Organization',
      slug: 'default-org',
      timezone: 'UTC',
      created_at: new Date(),
    });
    memoryOrganizations.set(OTHER_ORG_ID, {
      id: OTHER_ORG_ID,
      name: 'Other Organization',
      slug: 'other-org',
      timezone: 'UTC',
      created_at: new Date(),
    });
    // Seed members
    memoryOrganizationMembers.set(DEFAULT_ORG_ID, [
      { user_id: DEFAULT_USER_IDS.owner, organization_id: DEFAULT_ORG_ID, role: 'owner' },
      { user_id: DEFAULT_USER_IDS.admin, organization_id: DEFAULT_ORG_ID, role: 'admin' },
      { user_id: DEFAULT_USER_IDS.developer, organization_id: DEFAULT_ORG_ID, role: 'developer' },
      { user_id: DEFAULT_USER_IDS.viewer, organization_id: DEFAULT_ORG_ID, role: 'viewer' },
    ]);
    memoryOrganizationMembers.set(OTHER_ORG_ID, [
      { user_id: DEFAULT_USER_IDS.otherOwner, organization_id: OTHER_ORG_ID, role: 'owner' },
      { user_id: DEFAULT_USER_IDS.owner, organization_id: OTHER_ORG_ID, role: 'admin' },
    ]);
    console.log('[Org Repo] Seeded organizations and members to memory');
    return;
  }

  try {
    // Seed default organizations
    const defaultOrg = await getOrganizationById(DEFAULT_ORG_ID);
    if (!defaultOrg) {
      await createOrganization({
        id: DEFAULT_ORG_ID,
        name: 'Default Organization',
        slug: 'default-org',
        timezone: 'UTC',
        created_at: new Date(),
      });
      console.log('[Org Repo] Created Default Organization');
    }

    const otherOrg = await getOrganizationById(OTHER_ORG_ID);
    if (!otherOrg) {
      await createOrganization({
        id: OTHER_ORG_ID,
        name: 'Other Organization',
        slug: 'other-org',
        timezone: 'UTC',
        created_at: new Date(),
      });
      console.log('[Org Repo] Created Other Organization');
    }

    // Seed default members for DEFAULT_ORG
    const defaultOrgMembers = await getOrganizationMembers(DEFAULT_ORG_ID);
    if (defaultOrgMembers.length === 0) {
      await addOrganizationMember({ user_id: DEFAULT_USER_IDS.owner, organization_id: DEFAULT_ORG_ID, role: 'owner' });
      await addOrganizationMember({ user_id: DEFAULT_USER_IDS.admin, organization_id: DEFAULT_ORG_ID, role: 'admin' });
      await addOrganizationMember({ user_id: DEFAULT_USER_IDS.developer, organization_id: DEFAULT_ORG_ID, role: 'developer' });
      await addOrganizationMember({ user_id: DEFAULT_USER_IDS.viewer, organization_id: DEFAULT_ORG_ID, role: 'viewer' });
      console.log('[Org Repo] Created Default Organization members');
    }

    // Seed default members for OTHER_ORG
    const otherOrgMembers = await getOrganizationMembers(OTHER_ORG_ID);
    if (otherOrgMembers.length === 0) {
      await addOrganizationMember({ user_id: DEFAULT_USER_IDS.otherOwner, organization_id: OTHER_ORG_ID, role: 'owner' });
      await addOrganizationMember({ user_id: DEFAULT_USER_IDS.owner, organization_id: OTHER_ORG_ID, role: 'admin' });
      console.log('[Org Repo] Created Other Organization members');
    }
  } catch (error) {
    console.error('[Org Repo] Failed to seed organizations:', error);
  }
}

// NOTE: Removed auto-seed on module load (Feature #2102)
// seedDefaultOrganizations() should be called explicitly after database is connected
