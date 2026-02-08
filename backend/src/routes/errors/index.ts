/**
 * Frontend Error Reporting Routes
 * Feature #166: Catch and store frontend errors for tracking and debugging
 *
 * Provides API endpoints for:
 * - Reporting frontend errors (from ErrorBoundary)
 * - Listing errors for review
 * - Marking errors as resolved
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../../services/database.js';
import { authenticate, JwtPayload } from '../../middleware/auth.js';

/**
 * Parse user agent string to extract browser and OS
 */
function parseUserAgent(userAgent: string): { browser: string; os: string } {
  let browser = 'Unknown';
  let os = 'Unknown';

  // Detect browser
  if (userAgent.includes('Firefox/')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Edg/')) {
    browser = 'Edge';
  } else if (userAgent.includes('Chrome/')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR/')) {
    browser = 'Opera';
  }

  // Detect OS
  if (userAgent.includes('Windows')) {
    os = 'Windows';
  } else if (userAgent.includes('Mac OS')) {
    os = 'macOS';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS';
  }

  return { browser, os };
}

export async function errorsRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/errors - Report a frontend error
   * This endpoint accepts errors both from authenticated and anonymous users
   */
  app.post('/api/v1/errors', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!pool) {
      return reply.status(503).send({ error: 'Database not available' });
    }

    const body = request.body as {
      message?: string;
      stack?: string;
      componentStack?: string;
      url?: string;
      userAgent?: string;
      browser?: string;
      os?: string;
      screenResolution?: string;
      metadata?: Record<string, unknown>;
    };

    // Validate required fields
    if (!body.message || !body.url) {
      return reply.status(400).send({
        error: 'Missing required fields: message and url are required',
      });
    }

    // Try to extract user info from JWT if present (but don't require it)
    let userId: string | null = null;
    let organizationId: string | null = null;

    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = app.jwt.verify(authHeader.substring(7)) as {
          id: string;
          organization_id?: string;
        };
        userId = decoded.id;
        organizationId = decoded.organization_id || null;
      } catch {
        // Token invalid or expired - continue without user info
      }
    }

    // Parse user agent
    const userAgent = body.userAgent || request.headers['user-agent'] || '';
    const { browser, os } = parseUserAgent(userAgent);

    try {
      const result = await pool.query(
        `INSERT INTO frontend_errors (
          organization_id,
          user_id,
          error_message,
          error_stack,
          component_stack,
          url,
          user_agent,
          browser,
          os,
          screen_resolution,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, created_at`,
        [
          organizationId,
          userId,
          body.message.substring(0, 5000), // Limit message length
          body.stack?.substring(0, 10000) || null, // Limit stack length
          body.componentStack?.substring(0, 10000) || null, // Limit component stack
          body.url.substring(0, 2000), // Limit URL length
          userAgent.substring(0, 500) || null,
          body.browser || browser,
          body.os || os,
          body.screenResolution || null,
          JSON.stringify(body.metadata || {}),
        ]
      );

      // Log the error for server-side tracking
      request.log.warn({
        msg: 'Frontend error reported',
        errorId: result.rows[0].id,
        url: body.url,
        message: body.message.substring(0, 200),
        userId,
        organizationId,
      });

      return reply.status(201).send({
        id: result.rows[0].id,
        message: 'Error reported successfully',
        createdAt: result.rows[0].created_at,
      });
    } catch (error) {
      request.log.error({ error }, 'Failed to store frontend error');
      return reply.status(500).send({
        error: 'Failed to store error report',
      });
    }
  });

  /**
   * GET /api/v1/errors - List frontend errors for the organization
   * Requires authentication
   */
  app.get(
    '/api/v1/errors',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!pool) {
        return reply.status(503).send({ error: 'Database not available' });
      }

      const user = request.user as JwtPayload;
      const organizationId = user?.organization_id;

      if (!organizationId) {
        return reply.status(403).send({ error: 'Organization context required' });
      }

      const query = request.query as {
        page?: string;
        limit?: string;
        resolved?: string;
        url?: string;
      };

      const page = parseInt(query.page || '1', 10);
      const limit = Math.min(parseInt(query.limit || '20', 10), 100);
      const offset = (page - 1) * limit;
      const resolved = query.resolved === 'true' ? true : query.resolved === 'false' ? false : null;
      const urlFilter = query.url;

      try {
        // Build query with optional filters
        let whereClause = 'WHERE organization_id = $1';
        const params: (string | boolean | number)[] = [organizationId];
        let paramIndex = 2;

        if (resolved !== null) {
          whereClause += ` AND resolved = $${paramIndex++}`;
          params.push(resolved);
        }

        if (urlFilter) {
          whereClause += ` AND url ILIKE $${paramIndex++}`;
          params.push(`%${urlFilter}%`);
        }

        // Get total count
        const countResult = await pool.query(
          `SELECT COUNT(*) FROM frontend_errors ${whereClause}`,
          params
        );
        const total = parseInt(countResult.rows[0].count, 10);

        // Get errors
        const result = await pool.query(
          `SELECT
            id, organization_id, user_id, error_message, error_stack,
            component_stack, url, user_agent, browser, os, screen_resolution,
            metadata, resolved, resolved_at, resolved_by, created_at
          FROM frontend_errors
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
          [...params, limit, offset]
        );

        return reply.send({
          errors: result.rows.map((row: any) => ({
            id: row.id,
            organizationId: row.organization_id,
            userId: row.user_id,
            message: row.error_message,
            stack: row.error_stack,
            componentStack: row.component_stack,
            url: row.url,
            userAgent: row.user_agent,
            browser: row.browser,
            os: row.os,
            screenResolution: row.screen_resolution,
            metadata: row.metadata,
            resolved: row.resolved,
            resolvedAt: row.resolved_at,
            resolvedBy: row.resolved_by,
            createdAt: row.created_at,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to fetch frontend errors');
        return reply.status(500).send({
          error: 'Failed to fetch errors',
        });
      }
    }
  );

  /**
   * PATCH /api/v1/errors/:id/resolve - Mark an error as resolved
   * Requires authentication
   */
  app.patch(
    '/api/v1/errors/:id/resolve',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!pool) {
        return reply.status(503).send({ error: 'Database not available' });
      }

      const params = request.params as { id: string };
      const user = request.user as JwtPayload;
      const userId = user?.id;
      const organizationId = user?.organization_id;

      if (!organizationId) {
        return reply.status(403).send({ error: 'Organization context required' });
      }

      try {
        const result = await pool.query(
          `UPDATE frontend_errors
          SET resolved = true, resolved_at = NOW(), resolved_by = $1
          WHERE id = $2 AND organization_id = $3
          RETURNING id, resolved, resolved_at`,
          [userId, params.id, organizationId]
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({ error: 'Error not found' });
        }

        return reply.send({
          id: result.rows[0].id,
          resolved: result.rows[0].resolved,
          resolvedAt: result.rows[0].resolved_at,
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to resolve frontend error');
        return reply.status(500).send({
          error: 'Failed to resolve error',
        });
      }
    }
  );

  /**
   * DELETE /api/v1/errors/:id - Delete an error
   * Requires authentication
   */
  app.delete(
    '/api/v1/errors/:id',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!pool) {
        return reply.status(503).send({ error: 'Database not available' });
      }

      const params = request.params as { id: string };
      const user = request.user as JwtPayload;
      const organizationId = user?.organization_id;

      if (!organizationId) {
        return reply.status(403).send({ error: 'Organization context required' });
      }

      try {
        const result = await pool.query(
          `DELETE FROM frontend_errors WHERE id = $1 AND organization_id = $2`,
          [params.id, organizationId]
        );

        if (result.rowCount === 0) {
          return reply.status(404).send({ error: 'Error not found' });
        }

        return reply.status(204).send();
      } catch (error) {
        request.log.error({ error }, 'Failed to delete frontend error');
        return reply.status(500).send({
          error: 'Failed to delete error',
        });
      }
    }
  );

  /**
   * GET /api/v1/errors/stats - Get error statistics
   * Requires authentication
   */
  app.get(
    '/api/v1/errors/stats',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!pool) {
        return reply.status(503).send({ error: 'Database not available' });
      }

      const user = request.user as JwtPayload;
      const organizationId = user?.organization_id;

      if (!organizationId) {
        return reply.status(403).send({ error: 'Organization context required' });
      }

      try {
        // Get counts by status
        const countResult = await pool.query(
          `SELECT resolved, COUNT(*) as count
          FROM frontend_errors
          WHERE organization_id = $1
          GROUP BY resolved`,
          [organizationId]
        );

        // Get counts by URL (top 10)
        const urlResult = await pool.query(
          `SELECT url, COUNT(*) as count
          FROM frontend_errors
          WHERE organization_id = $1
          GROUP BY url
          ORDER BY count DESC
          LIMIT 10`,
          [organizationId]
        );

        // Get counts by browser
        const browserResult = await pool.query(
          `SELECT browser, COUNT(*) as count
          FROM frontend_errors
          WHERE organization_id = $1 AND browser IS NOT NULL
          GROUP BY browser
          ORDER BY count DESC`,
          [organizationId]
        );

        // Get recent error count (last 24h)
        const recentResult = await pool.query(
          `SELECT COUNT(*) as count
          FROM frontend_errors
          WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
          [organizationId]
        );

        const resolved = countResult.rows.find((r: any) => r.resolved)?.count || '0';
        const unresolved = countResult.rows.find((r: any) => !r.resolved)?.count || '0';

        return reply.send({
          total: parseInt(resolved, 10) + parseInt(unresolved, 10),
          resolved: parseInt(resolved, 10),
          unresolved: parseInt(unresolved, 10),
          last24Hours: parseInt(recentResult.rows[0].count, 10),
          topUrls: urlResult.rows.map((r: any) => ({
            url: r.url,
            count: parseInt(r.count, 10),
          })),
          byBrowser: browserResult.rows.map((r: any) => ({
            browser: r.browser,
            count: parseInt(r.count, 10),
          })),
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to fetch error stats');
        return reply.status(500).send({
          error: 'Failed to fetch error stats',
        });
      }
    }
  );
}
