/**
 * DNS and TCP Monitoring Routes - REMOVED
 *
 * DNS and TCP monitoring has been removed as it is infrastructure monitoring,
 * not QA testing functionality. All endpoints return 410 Gone.
 */

import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';

/**
 * Register stub DNS and TCP monitoring routes that return 410 Gone
 */
export async function dnsTcpRoutes(app: FastifyInstance): Promise<void> {
  const goneResponse = {
    statusCode: 410,
    error: 'Gone',
    message: 'DNS and TCP monitoring has been removed. This is infrastructure monitoring, not QA testing.',
  };

  // DNS endpoints - all return 410 Gone
  app.get('/api/v1/monitoring/dns', { preHandler: [authenticate] }, async (_request, reply) => {
    return reply.status(410).send(goneResponse);
  });

  app.post('/api/v1/monitoring/dns', { preHandler: [authenticate] }, async (_request, reply) => {
    return reply.status(410).send(goneResponse);
  });

  app.get('/api/v1/monitoring/dns/:checkId', { preHandler: [authenticate] }, async (_request, reply) => {
    return reply.status(410).send(goneResponse);
  });

  // TCP endpoints - all return 410 Gone
  app.get('/api/v1/monitoring/tcp', { preHandler: [authenticate] }, async (_request, reply) => {
    return reply.status(410).send(goneResponse);
  });

  app.post('/api/v1/monitoring/tcp', { preHandler: [authenticate] }, async (_request, reply) => {
    return reply.status(410).send(goneResponse);
  });

  app.get('/api/v1/monitoring/tcp/:checkId', { preHandler: [authenticate] }, async (_request, reply) => {
    return reply.status(410).send(goneResponse);
  });
}
