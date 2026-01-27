/**
 * Monitoring Routes - Re-exports from modular implementation
 *
 * This file maintains backward compatibility while the implementation is split into modules.
 * All types, stores, helpers, and routes are now in the ./monitoring/ directory.
 *
 * Feature #1374: Split monitoring.ts into modules
 * Feature #1376: Split status-pages.ts into status-pages.ts and on-call-escalation.ts
 * Feature #1377: Split alert-correlation-incidents.ts into alert-correlation.ts and incidents.ts
 *
 * @see ./monitoring/types.ts - Type definitions
 * @see ./monitoring/stores.ts - In-memory data stores
 * @see ./monitoring/helpers.ts - Helper functions
 * @see ./monitoring/uptime.ts - Uptime check routes
 * @see ./monitoring/maintenance.ts - Maintenance windows, pause/resume routes
 * @see ./monitoring/webhooks.ts - Webhook monitoring routes
 * @see ./monitoring/dns-tcp.ts - DNS and TCP check routes
 * @see ./monitoring/status-pages.ts - Status page, incidents, subscriptions routes
 * @see ./monitoring/on-call-escalation.ts - On-call schedule and escalation policy routes
 * @see ./monitoring/alert-grouping-routing.ts - Alert grouping and routing routes
 * @see ./monitoring/alert-correlation.ts - Alert correlation and runbooks routes
 * @see ./monitoring/incidents.ts - Managed incidents routes
 * @see ./monitoring/reports.ts - Uptime report routes
 */

import { FastifyInstance } from 'fastify';

// Re-export all types and stores for backward compatibility
export * from './monitoring/types';
export * from './monitoring/stores';
export * from './monitoring/helpers';

// Import route modules
import {
  uptimeRoutes,
  maintenanceRoutes,
  webhookRoutes,
  dnsTcpRoutes,
  statusPageRoutes,
  onCallEscalationRoutes,
  alertGroupingRoutingRoutes,
  alertCorrelationRoutes,
  incidentRoutes,
  reportRoutes,
} from './monitoring/index';

// Combined monitoring routes function that registers all sub-routes
export async function monitoringRoutes(app: FastifyInstance) {
  // Register all route modules
  await uptimeRoutes(app);
  await maintenanceRoutes(app);
  await webhookRoutes(app);
  await dnsTcpRoutes(app);
  await statusPageRoutes(app);
  await onCallEscalationRoutes(app);
  await alertGroupingRoutingRoutes(app);
  await alertCorrelationRoutes(app);
  await incidentRoutes(app);
  await reportRoutes(app);
}
