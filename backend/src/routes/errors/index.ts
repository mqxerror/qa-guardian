/**
 * Frontend Error Reporting Routes
 * Feature #166: Catch and store frontend errors for tracking and debugging
 * Feature #653: Rate limiting (10 req/min per IP) and payload validation (10KB max)
 *
 * Provides API endpoints for:
 * - Reporting frontend errors (from ErrorBoundary)
 * - Listing errors for review
 * - Marking errors as resolved
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../../services/database.js';
import { authenticate, JwtPayload } from '../../middleware/auth.js';

import { sendError } from '../../utils/errors.js';
// Feature #653: Payload size limits for error reporting endpoint
const MAX_PAYLOAD_SIZE_BYTES = 10 * 1024; // 10KB max payload
const MAX_METADATA_SIZE_BYTES = 2 * 1024; // 2KB max for metadata field

// Row interfaces for typed database queries
interface ErrorRow {
  id: string;
  organization_id: string;
  user_id: string | null;
  error_message: string;
  error_stack: string | null;
  component_stack: string | null;
  url: string;
  user_agent: string | null;
  browser: string | null;
  os: string | null;
  screen_resolution: string | null;
  metadata: Record<string, unknown> | null;
  resolved: boolean;
  resolved_at: string | Date | null;
  resolved_by: string | null;
  created_at: string | Date;
}

interface ResolvedCountRow {
  resolved: boolean;
  count: string;
}

interface UrlCountRow {
  url: string;
  count: string;
}

interface BrowserCountRow {
  browser: string;
  count: string;
}

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
   * Feature #653: Rate limiting (10 req/min) handled by global rate limiter
   * Feature #653: Payload size validation (10KB max) enforced here
   */
  // Feature #653: Enforce 10KB max payload size at Fastify level
  app.post('/api/v1/errors', {
    bodyLimit: MAX_PAYLOAD_SIZE_BYTES,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!pool) {
      return sendError(reply, 503, 'SERVICE_UNAVAILABLE', 'Database not available');
    }

    // Feature #653: Double-check Content-Length header as backup validation
    const contentLength = parseInt(request.headers['content-length'] || '0', 10);
    if (contentLength > MAX_PAYLOAD_SIZE_BYTES) {
      return sendError(reply, 413, 'PAYLOAD_TOO_LARGE', `Payload too large: ${contentLength} bytes exceeds limit of ${MAX_PAYLOAD_SIZE_BYTES} bytes (10KB)`);
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
      return sendError(reply, 400, 'BAD_REQUEST', 'Missing required fields: message and url are required');
    }

    // Feature #653: Validate metadata size to prevent oversized JSON
    if (body.metadata) {
      const metadataSize = JSON.stringify(body.metadata).length;
      if (metadataSize > MAX_METADATA_SIZE_BYTES) {
        return sendError(reply, 400, 'BAD_REQUEST', `Metadata too large: ${metadataSize} bytes exceeds limit of ${MAX_METADATA_SIZE_BYTES} bytes`);
      }
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
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to store error report');
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
        return sendError(reply, 503, 'SERVICE_UNAVAILABLE', 'Database not available');
      }

      const user = request.user as JwtPayload;
      const organizationId = user?.organization_id;

      if (!organizationId) {
        return sendError(reply, 403, 'FORBIDDEN', 'Organization context required');
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
          errors: result.rows.map((row: ErrorRow) => ({
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
        return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch errors');
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
        return sendError(reply, 503, 'SERVICE_UNAVAILABLE', 'Database not available');
      }

      const params = request.params as { id: string };
      const user = request.user as JwtPayload;
      const userId = user?.id;
      const organizationId = user?.organization_id;

      if (!organizationId) {
        return sendError(reply, 403, 'FORBIDDEN', 'Organization context required');
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
          return sendError(reply, 404, 'NOT_FOUND', 'Error not found');
        }

        return reply.send({
          id: result.rows[0].id,
          resolved: result.rows[0].resolved,
          resolvedAt: result.rows[0].resolved_at,
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to resolve frontend error');
        return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to resolve error');
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
        return sendError(reply, 503, 'SERVICE_UNAVAILABLE', 'Database not available');
      }

      const params = request.params as { id: string };
      const user = request.user as JwtPayload;
      const organizationId = user?.organization_id;

      if (!organizationId) {
        return sendError(reply, 403, 'FORBIDDEN', 'Organization context required');
      }

      try {
        const result = await pool.query(
          `DELETE FROM frontend_errors WHERE id = $1 AND organization_id = $2`,
          [params.id, organizationId]
        );

        if (result.rowCount === 0) {
          return sendError(reply, 404, 'NOT_FOUND', 'Error not found');
        }

        return reply.status(204).send();
      } catch (error) {
        request.log.error({ error }, 'Failed to delete frontend error');
        return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to delete error');
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
        return sendError(reply, 503, 'SERVICE_UNAVAILABLE', 'Database not available');
      }

      const user = request.user as JwtPayload;
      const organizationId = user?.organization_id;

      if (!organizationId) {
        return sendError(reply, 403, 'FORBIDDEN', 'Organization context required');
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

        const resolvedRow = (countResult.rows as ResolvedCountRow[]).find((r) => r.resolved);
        const unresolvedRow = (countResult.rows as ResolvedCountRow[]).find((r) => !r.resolved);
        const resolved = resolvedRow?.count || '0';
        const unresolved = unresolvedRow?.count || '0';

        return reply.send({
          total: parseInt(resolved, 10) + parseInt(unresolved, 10),
          resolved: parseInt(resolved, 10),
          unresolved: parseInt(unresolved, 10),
          last24Hours: parseInt(recentResult.rows[0].count, 10),
          topUrls: (urlResult.rows as UrlCountRow[]).map((r) => ({
            url: r.url,
            count: parseInt(r.count, 10),
          })),
          byBrowser: (browserResult.rows as BrowserCountRow[]).map((r) => ({
            browser: r.browser,
            count: parseInt(r.count, 10),
          })),
        });
      } catch (error) {
        request.log.error({ error }, 'Failed to fetch error stats');
        return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch error stats');
      }
    }
  );
}
