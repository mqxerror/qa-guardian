/**
 * Monitoring Module Index
 *
 * Central export point for all monitoring-related types, stores, helpers, and routes.
 * This allows other parts of the application to import from a single location.
 *
 * Feature #1374: Split monitoring.ts into modules
 * Feature #1376: Split status-pages.ts into status-pages.ts and on-call-escalation.ts
 * Feature #1377: Split alert-correlation-incidents.ts into alert-correlation.ts and incidents.ts
 *
 * Structure:
 * - types.ts: All TypeScript interfaces and type definitions
 * - stores.ts: In-memory data stores (Maps) for monitoring data
 * - helpers.ts: Helper functions for check execution, assertions, etc.
 * - uptime.ts: Uptime check routes (CRUD, results, incidents)
 * - maintenance.ts: Maintenance windows, pause/resume, SLA metrics, check history
 * - webhooks.ts: Webhook monitoring routes
 * - dns-tcp.ts: DNS and TCP check routes
 * - status-pages.ts: Status page, incidents, subscriptions routes
 * - on-call-escalation.ts: On-call schedule and escalation policy routes
 * - alert-grouping-routing.ts: Alert grouping and routing routes
 * - alert-correlation.ts: Alert correlation and runbooks routes
 * - incidents.ts: Managed incidents routes
 * - reports.ts: Uptime report routes
 * - index.ts: This file - re-exports everything
 */

// Re-export all types
export * from './types';

// Re-export all stores
export * from './stores';

// Re-export all helpers
export * from './helpers';

// Re-export route modules
export { uptimeRoutes } from './uptime';
export { maintenanceRoutes } from './maintenance';
export { webhookRoutes } from './webhooks';
export { dnsTcpRoutes } from './dns-tcp';
export { statusPageRoutes } from './status-pages';
export { onCallEscalationRoutes } from './on-call-escalation';
export { alertGroupingRoutingRoutes } from './alert-grouping-routing';
export { alertCorrelationRoutes } from './alert-correlation';
export { incidentRoutes } from './incidents';
export { reportRoutes } from './reports';
