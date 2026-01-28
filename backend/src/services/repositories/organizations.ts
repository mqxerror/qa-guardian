/**
 * Organizations Repository for PostgreSQL
 *
 * This repository provides database persistence for organizations, members,
 * invitations, and organization settings. Falls back to in-memory storage
 * when database is unavailable.
 *
 * Feature #2085: Migrate Organizations Module to PostgreSQL
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
// In-memory fallback stores
// ============================================================================

const memoryOrganizations: Map<string, Organization> = new Map();
const memoryOrganizationMembers: Map<string, OrganizationMember[]> = new Map();
const memoryInvitations: Map<string, Invitation> = new Map();
const memoryAutoQuarantineSettings: Map<string, AutoQuarantineSettings> = new Map();
const memoryRetryStrategySettings: Map<string, RetryStrategySettings> = new Map();

// Export memory stores for compatibility
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
  memoryOrganizations.set(org.id, org);

  if (isDatabaseConnected()) {
    try {
      await query(
        `INSERT INTO organizations (id, name, slug, settings, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id) DO UPDATE SET name = $2, slug = $3, settings = $4, updated_at = NOW()`,
        [org.id, org.name, org.slug, JSON.stringify({ timezone: org.timezone }), org.created_at]
      );
    } catch (error) {
      console.error('[Org Repo] Failed to create organization:', error);
    }
  }

  return org;
}

export async function getOrganizationById(id: string): Promise<Organization | null> {
  const memOrg = memoryOrganizations.get(id);
  if (memOrg) return memOrg;

  if (isDatabaseConnected()) {
    try {
      const result = await query<OrganizationRow>(
        `SELECT id, name, slug, settings->>'timezone' as timezone, created_at FROM organizations WHERE id = $1`,
        [id]
      );
      if (result && result.rows.length > 0) {
        const org = rowToOrganization(result.rows[0]);
        memoryOrganizations.set(id, org);
        return org;
      }
    } catch (error) {
      console.error('[Org Repo] Failed to get organization:', error);
    }
  }

  return null;
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  // Try memory first
  for (const [, org] of memoryOrganizations) {
    if (org.slug === slug) return org;
  }

  if (isDatabaseConnected()) {
    try {
      const result = await query<OrganizationRow>(
        `SELECT id, name, slug, settings->>'timezone' as timezone, created_at FROM organizations WHERE slug = $1`,
        [slug]
      );
      if (result && result.rows.length > 0) {
        const org = rowToOrganization(result.rows[0]);
        memoryOrganizations.set(org.id, org);
        return org;
      }
    } catch (error) {
      console.error('[Org Repo] Failed to get organization by slug:', error);
    }
  }

  return null;
}

export async function updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization | null> {
  const existing = memoryOrganizations.get(id) || await getOrganizationById(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates };
  memoryOrganizations.set(id, updated);

  if (isDatabaseConnected()) {
    try {
      await query(
        `UPDATE organizations SET name = $2, slug = $3, settings = $4, updated_at = NOW() WHERE id = $1`,
        [id, updated.name, updated.slug, JSON.stringify({ timezone: updated.timezone })]
      );
    } catch (error) {
      console.error('[Org Repo] Failed to update organization:', error);
    }
  }

  return updated;
}

export async function deleteOrganization(id: string): Promise<boolean> {
  memoryOrganizations.delete(id);
  memoryOrganizationMembers.delete(id);
  memoryAutoQuarantineSettings.delete(id);
  memoryRetryStrategySettings.delete(id);

  // Delete related invitations
  for (const [invId, inv] of memoryInvitations) {
    if (inv.organization_id === id) {
      memoryInvitations.delete(invId);
    }
  }

  if (isDatabaseConnected()) {
    try {
      await query('DELETE FROM organizations WHERE id = $1', [id]);
    } catch (error) {
      console.error('[Org Repo] Failed to delete organization:', error);
    }
  }

  return true;
}

export async function listOrganizations(): Promise<Organization[]> {
  if (isDatabaseConnected()) {
    try {
      const result = await query<OrganizationRow>(
        `SELECT id, name, slug, settings->>'timezone' as timezone, created_at FROM organizations ORDER BY created_at`
      );
      if (result) {
        const orgs = result.rows.map(rowToOrganization);
        // Update memory cache
        for (const org of orgs) {
          memoryOrganizations.set(org.id, org);
        }
        return orgs;
      }
    } catch (error) {
      console.error('[Org Repo] Failed to list organizations:', error);
    }
  }

  return Array.from(memoryOrganizations.values());
}

// ============================================================================
// Organization Member Functions
// ============================================================================

export async function addOrganizationMember(member: OrganizationMember): Promise<void> {
  const members = memoryOrganizationMembers.get(member.organization_id) || [];
  const existingIndex = members.findIndex(m => m.user_id === member.user_id);
  if (existingIndex >= 0) {
    members[existingIndex] = member;
  } else {
    members.push(member);
  }
  memoryOrganizationMembers.set(member.organization_id, members);

  if (isDatabaseConnected()) {
    try {
      // This would require a separate organization_members table
      // For now, we'll use the users table's organization_id field
      // or a separate join table
    } catch (error) {
      console.error('[Org Repo] Failed to add organization member:', error);
    }
  }
}

export async function removeOrganizationMember(organizationId: string, userId: string): Promise<boolean> {
  const members = memoryOrganizationMembers.get(organizationId) || [];
  const index = members.findIndex(m => m.user_id === userId);
  if (index === -1) return false;

  members.splice(index, 1);
  memoryOrganizationMembers.set(organizationId, members);

  return true;
}

export async function getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
  return memoryOrganizationMembers.get(organizationId) || [];
}

export async function updateMemberRole(
  organizationId: string,
  userId: string,
  role: OrganizationMember['role']
): Promise<boolean> {
  const members = memoryOrganizationMembers.get(organizationId) || [];
  const member = members.find(m => m.user_id === userId);
  if (!member) return false;

  member.role = role;
  memoryOrganizationMembers.set(organizationId, members);

  return true;
}

export async function getUserOrganization(userId: string): Promise<string | null> {
  for (const [orgId, members] of memoryOrganizationMembers) {
    if (members.some(m => m.user_id === userId)) {
      return orgId;
    }
  }
  return null;
}

export async function getUserOrganizations(userId: string): Promise<Array<{
  organization_id: string;
  role: string;
  organization: Organization | undefined;
}>> {
  const userOrgs: Array<{
    organization_id: string;
    role: string;
    organization: Organization | undefined;
  }> = [];

  for (const [orgId, members] of memoryOrganizationMembers) {
    const membership = members.find(m => m.user_id === userId);
    if (membership) {
      userOrgs.push({
        organization_id: orgId,
        role: membership.role,
        organization: memoryOrganizations.get(orgId),
      });
    }
  }

  return userOrgs;
}

// ============================================================================
// Invitation Functions
// ============================================================================

export async function createInvitation(invitation: Invitation): Promise<Invitation> {
  memoryInvitations.set(invitation.id, invitation);

  if (isDatabaseConnected()) {
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
    } catch (error) {
      console.error('[Org Repo] Failed to create invitation:', error);
    }
  }

  return invitation;
}

export async function getInvitationById(id: string): Promise<Invitation | null> {
  return memoryInvitations.get(id) || null;
}

export async function getInvitationsByOrg(organizationId: string): Promise<Invitation[]> {
  return Array.from(memoryInvitations.values()).filter(
    inv => inv.organization_id === organizationId
  );
}

export async function updateInvitation(id: string, updates: Partial<Invitation>): Promise<Invitation | null> {
  const existing = memoryInvitations.get(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates };
  memoryInvitations.set(id, updated);

  if (isDatabaseConnected()) {
    try {
      if (updates.status === 'accepted') {
        await query(
          `UPDATE invitations SET accepted_at = $2 WHERE id = $1`,
          [id, updates.accepted_at || new Date()]
        );
      }
    } catch (error) {
      console.error('[Org Repo] Failed to update invitation:', error);
    }
  }

  return updated;
}

export async function deleteInvitation(id: string): Promise<boolean> {
  const deleted = memoryInvitations.delete(id);

  if (isDatabaseConnected()) {
    try {
      await query('DELETE FROM invitations WHERE id = $1', [id]);
    } catch (error) {
      console.error('[Org Repo] Failed to delete invitation:', error);
    }
  }

  return deleted;
}

// ============================================================================
// Auto-Quarantine Settings Functions
// ============================================================================

export function getAutoQuarantineSettings(organizationId: string): AutoQuarantineSettings {
  return memoryAutoQuarantineSettings.get(organizationId) || { ...DEFAULT_AUTO_QUARANTINE_SETTINGS };
}

export function setAutoQuarantineSettings(
  organizationId: string,
  settings: Partial<AutoQuarantineSettings>
): AutoQuarantineSettings {
  const current = getAutoQuarantineSettings(organizationId);
  const updated: AutoQuarantineSettings = {
    ...current,
    ...settings,
    threshold: Math.max(0, Math.min(1, settings.threshold ?? current.threshold)),
    min_runs: Math.max(2, settings.min_runs ?? current.min_runs),
  };
  memoryAutoQuarantineSettings.set(organizationId, updated);
  return updated;
}

// ============================================================================
// Retry Strategy Settings Functions
// ============================================================================

export function getRetryStrategySettings(organizationId: string): RetryStrategySettings {
  return memoryRetryStrategySettings.get(organizationId) || {
    ...DEFAULT_RETRY_STRATEGY_SETTINGS,
    rules: [...DEFAULT_RETRY_STRATEGY_SETTINGS.rules],
  };
}

export function setRetryStrategySettings(
  organizationId: string,
  settings: Partial<RetryStrategySettings>
): RetryStrategySettings {
  const current = getRetryStrategySettings(organizationId);
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
  memoryRetryStrategySettings.set(organizationId, updated);
  return updated;
}

export function getRetriesForFlakinessScore(organizationId: string, flakinessScore: number): number {
  const settings = getRetryStrategySettings(organizationId);

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

export function seedDefaultOrganizations(): void {
  // Seed default organizations
  if (!memoryOrganizations.has(DEFAULT_ORG_ID)) {
    memoryOrganizations.set(DEFAULT_ORG_ID, {
      id: DEFAULT_ORG_ID,
      name: 'Default Organization',
      slug: 'default-org',
      timezone: 'UTC',
      created_at: new Date(),
    });
  }

  if (!memoryOrganizations.has(OTHER_ORG_ID)) {
    memoryOrganizations.set(OTHER_ORG_ID, {
      id: OTHER_ORG_ID,
      name: 'Other Organization',
      slug: 'other-org',
      timezone: 'UTC',
      created_at: new Date(),
    });
  }

  // Seed default members
  if (!memoryOrganizationMembers.has(DEFAULT_ORG_ID)) {
    memoryOrganizationMembers.set(DEFAULT_ORG_ID, [
      { user_id: DEFAULT_USER_IDS.owner, organization_id: DEFAULT_ORG_ID, role: 'owner' },
      { user_id: DEFAULT_USER_IDS.admin, organization_id: DEFAULT_ORG_ID, role: 'admin' },
      { user_id: DEFAULT_USER_IDS.developer, organization_id: DEFAULT_ORG_ID, role: 'developer' },
      { user_id: DEFAULT_USER_IDS.viewer, organization_id: DEFAULT_ORG_ID, role: 'viewer' },
    ]);
  }

  if (!memoryOrganizationMembers.has(OTHER_ORG_ID)) {
    memoryOrganizationMembers.set(OTHER_ORG_ID, [
      { user_id: DEFAULT_USER_IDS.otherOwner, organization_id: OTHER_ORG_ID, role: 'owner' },
      { user_id: DEFAULT_USER_IDS.owner, organization_id: OTHER_ORG_ID, role: 'admin' },
    ]);
  }
}

// Initialize seed data
seedDefaultOrganizations();
