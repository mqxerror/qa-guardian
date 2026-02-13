/**
 * Organizations Module - Helper Functions and Re-exports
 * Feature #730: Split organizations.ts into sub-modules
 *
 * Contains utility functions and re-exports from the repository layer
 * for backward compatibility.
 */

import {
  Organization,
  AutoQuarantineSettings,
  RetryStrategySettings,
  RetryStrategyRule,
  DEFAULT_AUTO_QUARANTINE_SETTINGS,
  DEFAULT_RETRY_STRATEGY_SETTINGS,
  DEFAULT_ORG_ID,
  OTHER_ORG_ID,
  DEFAULT_USER_IDS,
  getOrganizationById as repoGetOrganizationById,
  getAutoQuarantineSettings as repoGetAutoQuarantineSettings,
  setAutoQuarantineSettings as repoSetAutoQuarantineSettings,
  getRetryStrategySettings as repoGetRetryStrategySettings,
  setRetryStrategySettings as repoSetRetryStrategySettings,
  getRetriesForFlakinessScore as repoGetRetriesForFlakinessScore,
  getUserOrganization as dbGetUserOrganization,
  getUserOrganizations as dbGetUserOrganizations,
} from '../../services/repositories/organizations.js';

// Re-export types for backward compatibility
export type { AutoQuarantineSettings, RetryStrategySettings, RetryStrategyRule };

// Re-export default settings and UUID constants
export { DEFAULT_AUTO_QUARANTINE_SETTINGS, DEFAULT_RETRY_STRATEGY_SETTINGS, DEFAULT_ORG_ID, OTHER_ORG_ID, DEFAULT_USER_IDS };

// Re-export helper functions from repository
export const getRetryStrategySettings = repoGetRetryStrategySettings;
export const setRetryStrategySettings = repoSetRetryStrategySettings;
export const getRetriesForFlakinessScore = repoGetRetriesForFlakinessScore;
export const getAutoQuarantineSettings = repoGetAutoQuarantineSettings;
export const setAutoQuarantineSettings = repoSetAutoQuarantineSettings;

// Feature #2109: Fully async DB-backed organization lookup
export async function getUserOrganization(userId: string): Promise<string | null> {
  return await dbGetUserOrganization(userId);
}

// Feature #2109: Fully async DB-backed organization list
export async function getUserOrganizations(userId: string): Promise<Array<{ organization_id: string; role: string; organization: Organization | undefined }>> {
  const dbResult = await dbGetUserOrganizations(userId);
  if (dbResult && dbResult.length > 0) {
    const orgs = await Promise.all(dbResult.map(async r => ({
      organization_id: r.organization_id,
      role: r.role,
      organization: (await repoGetOrganizationById(r.organization_id)) || undefined,
    })));
    return orgs;
  }
  return [];
}

// Helper to generate slug from name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
