/**
 * Organization Routes - Re-exports from modular implementation
 *
 * This file maintains backward compatibility while the implementation is split into modules.
 * All types, helpers, and routes are now in the ./organizations/ directory.
 *
 * Feature #730: Split organizations.ts into sub-modules
 *
 * @see ./organizations/types.ts - Type definitions
 * @see ./organizations/helpers.ts - Helper functions and repository re-exports
 * @see ./organizations/crud.ts - Organization CRUD routes
 * @see ./organizations/members.ts - Member management routes
 * @see ./organizations/team-metrics.ts - Team productivity metrics routes
 * @see ./organizations/settings.ts - Auto-quarantine and retry strategy settings routes
 */

// Re-export everything from the modular implementation for backward compatibility
export type { AutoQuarantineSettings, RetryStrategySettings, RetryStrategyRule } from './organizations/index.js';
export {
  DEFAULT_AUTO_QUARANTINE_SETTINGS,
  DEFAULT_RETRY_STRATEGY_SETTINGS,
  DEFAULT_ORG_ID,
  OTHER_ORG_ID,
  DEFAULT_USER_IDS,
  getRetryStrategySettings,
  setRetryStrategySettings,
  getRetriesForFlakinessScore,
  getAutoQuarantineSettings,
  setAutoQuarantineSettings,
  getUserOrganization,
  getUserOrganizations,
  organizationRoutes,
} from './organizations/index.js';
