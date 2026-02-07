/**
 * Webhook Subscriptions Routes - Features #1283-1315
 *
 * This module re-exports the split route handlers:
 * - webhook-crud.ts: CRUD operations for webhook subscriptions
 * - webhook-delivery.ts: Delivery logs, status, testing, and documentation
 *
 * Extracted from test-runs.ts for code quality (#1356)
 */
import { FastifyInstance } from 'fastify';
import { webhookCrudRoutes, logWebhookDelivery, flattenObject } from './webhook-crud.js';
import { webhookDeliveryRoutes } from './webhook-delivery.js';

// Re-export helper functions for use by other modules
export { logWebhookDelivery, flattenObject };

/**
 * Main entry point for webhook subscription routes
 * Registers both CRUD and delivery routes
 */
export async function webhookSubscriptionRoutes(app: FastifyInstance) {
  // Register CRUD routes (list, create, get, update, delete)
  await webhookCrudRoutes(app);

  // Register delivery routes (logs, status, test, preview, variables, signature docs)
  await webhookDeliveryRoutes(app);
}
