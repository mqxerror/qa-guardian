import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate, requireRoles, getOrganizationId, JwtPayload, ApiKeyPayload } from '../middleware/auth.js';
import { createLogger } from '../services/logger.js';

const log = createLogger('audit-logs');

// Feature #2119: Import only async repository functions (no getMemory* calls)
import {
  createAuditLog,
  listAuditLogs as listAuditLogsRepo,
  getUniqueActions,
  getUniqueResourceTypes,
} from '../services/repositories/audit-logs.js';
import type { AuditLogEntry } from '../services/repositories/audit-logs.js';

// Feature #123: Import cache service for read-heavy endpoints
import { getCache, CacheKeys, CacheTTL } from '../services/cache.js';

// Re-export interface for backward compatibility
export type { AuditLogEntry };

// Feature #2119: Map removed — all access now through async repository functions
// Re-export listAuditLogsRepo for other files that need audit log data
export { listAuditLogsRepo };

// Helper to extract IP address from request
function getClientIp(request: FastifyRequest): string {
  // Check for forwarded headers (behind proxy)
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = typeof forwarded === 'string' ? forwarded : forwarded[0];
    return ips.split(',')[0].trim();
  }
  return request.ip || '127.0.0.1';
}

// Helper to get user agent from request
function getUserAgent(request: FastifyRequest): string {
  return (request.headers['user-agent'] as string) || 'Unknown';
}

// Function to log an audit entry - call this from other routes
export async function logAuditEntry(
  request: FastifyRequest,
  action: string,
  resourceType: string,
  resourceId: string,
  resourceName?: string,
  details?: Record<string, unknown>
): Promise<void> {
  const user = request.user as JwtPayload | ApiKeyPayload;
  const orgId = getOrganizationId(request);

  const entry: AuditLogEntry = {
    id: crypto.randomUUID() + '-' + Math.random().toString(36).substr(2, 9),
    organization_id: orgId,
    user_id: user.id,
    user_email: 'type' in user && user.type === 'api_key' ? `API Key (${user.id.slice(0, 8)}...)` : (user as JwtPayload).email,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    resource_name: resourceName,
    details,
    ip_address: getClientIp(request),
    user_agent: getUserAgent(request),
    created_at: new Date(),
  };

  // Store via repository (async)
  await createAuditLog(entry);

  // Feature #123: Invalidate audit log cache when new entry is created
  const cache = getCache();
  await cache.invalidate(CacheKeys.auditLogs.byOrg(orgId));

  log.info({ userEmail: entry.user_email, action, resourceType, resourceId, resourceName: resourceName || 'unnamed', ipAddress: entry.ip_address }, 'Audit entry created');
}

export async function auditLogRoutes(app: FastifyInstance) {
  // Get audit logs for organization (owner/admin only)
  app.get<{ Params: { orgId: string }; Querystring: { limit?: string; offset?: string; action?: string; resource_type?: string } }>(
    '/api/v1/organizations/:orgId/audit-logs',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin'])],
    },
    async (request, reply) => {
      const { orgId } = request.params;
      const { limit = '50', offset = '0', action, resource_type } = request.query;
      const userOrgId = getOrganizationId(request);

      // Verify user has access to this organization
      if (orgId !== userOrgId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You do not have access to this organization',
        });
      }

      // Use repository to list logs with filters and pagination
      const limitNum = parseInt(limit, 10);
      const offsetNum = parseInt(offset, 10);

      // Feature #123: Build cache key with filters
      const filterStr = [action, resource_type, limit, offset].filter(Boolean).join(':');
      const cacheKey = CacheKeys.auditLogs.list(orgId, filterStr);
      const cache = getCache();

      // Try cache first
      const cached = await cache.get<{ logs: unknown[]; total: number }>(cacheKey);
      if (cached) {
        return {
          ...cached,
          limit: limitNum,
          offset: offsetNum,
        };
      }

      const { logs, total } = await listAuditLogsRepo(orgId, {
        action,
        resourceType: resource_type,
        limit: limitNum,
        offset: offsetNum,
      });

      const result = {
        logs: logs.map(log => ({
          id: log.id,
          user_id: log.user_id,
          user_email: log.user_email,
          action: log.action,
          resource_type: log.resource_type,
          resource_id: log.resource_id,
          resource_name: log.resource_name,
          details: log.details,
          ip_address: log.ip_address,
          user_agent: log.user_agent,
          created_at: log.created_at.toISOString(),
        })),
        total,
      };

      // Feature #123: Cache for 60 seconds (audit logs change frequently)
      await cache.set(cacheKey, result, CacheTTL.SHORT);

      return {
        ...result,
        limit: limitNum,
        offset: offsetNum,
      };
    }
  );

  // Get unique actions for filtering
  app.get<{ Params: { orgId: string } }>(
    '/api/v1/organizations/:orgId/audit-logs/actions',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin'])],
    },
    async (request, reply) => {
      const { orgId } = request.params;
      const userOrgId = getOrganizationId(request);

      if (orgId !== userOrgId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You do not have access to this organization',
        });
      }

      // Feature #123: Cache actions list for 5 minutes (rarely changes)
      const cache = getCache();
      const cacheKey = CacheKeys.auditLogs.actions(orgId);

      const actions = await cache.getOrSet(
        cacheKey,
        () => getUniqueActions(orgId),
        CacheTTL.MEDIUM
      );

      return { actions };
    }
  );

  // Get unique resource types for filtering
  app.get<{ Params: { orgId: string } }>(
    '/api/v1/organizations/:orgId/audit-logs/resource-types',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin'])],
    },
    async (request, reply) => {
      const { orgId } = request.params;
      const userOrgId = getOrganizationId(request);

      if (orgId !== userOrgId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You do not have access to this organization',
        });
      }

      // Feature #123: Cache resource types for 5 minutes (rarely changes)
      const cache = getCache();
      const cacheKey = CacheKeys.auditLogs.resourceTypes(orgId);

      const resourceTypes = await cache.getOrSet(
        cacheKey,
        () => getUniqueResourceTypes(orgId),
        CacheTTL.MEDIUM
      );

      return { resource_types: resourceTypes };
    }
  );
}
