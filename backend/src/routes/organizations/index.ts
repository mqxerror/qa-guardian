/**
 * Organizations Module Index
 * Feature #730: Split organizations.ts into sub-modules
 *
 * Central export point for all organization-related types, helpers, and routes.
 * This allows other parts of the application to import from a single location.
 *
 * Structure:
 * - types.ts: TypeScript interfaces for route handlers
 * - helpers.ts: Helper functions and repository re-exports
 * - crud.ts: Organization CRUD routes (list, get, create, update, delete)
 * - members.ts: Member management routes (invitations, roles, transfer ownership)
 * - team-metrics.ts: Team productivity metrics routes
 * - settings.ts: Auto-quarantine and retry strategy settings routes
 * - index.ts: This file - re-exports everything and combines route registration
 */

import { FastifyInstance } from 'fastify';

// Re-export types
export type { InvitationBody, OrgParams, CreateOrganizationBody } from './types.js';

// Re-export helpers and constants for backward compatibility
export type { AutoQuarantineSettings, RetryStrategySettings, RetryStrategyRule } from './helpers.js';
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
  generateSlug,
} from './helpers.js';

// Import route modules
import { crudRoutes } from './crud.js';
import { memberRoutes } from './members.js';
import { teamMetricsRoutes } from './team-metrics.js';
import { settingsRoutes } from './settings.js';

// Combined organization routes function that registers all sub-routes
export async function organizationRoutes(app: FastifyInstance) {
  await crudRoutes(app);
  await memberRoutes(app);
  await teamMetricsRoutes(app);
  await settingsRoutes(app);
}
