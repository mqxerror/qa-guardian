import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate, requireRoles, getOrganizationId, JwtPayload, ApiKeyPayload } from '../middleware/auth';

// Audit log entry interface
export interface AuditLogEntry {
  id: string;
  organization_id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  resource_name?: string;
  details?: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
  created_at: Date;
}

// In-memory audit log store
export const auditLogs: Map<string, AuditLogEntry> = new Map();

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
export function logAuditEntry(
  request: FastifyRequest,
  action: string,
  resourceType: string,
  resourceId: string,
  resourceName?: string,
  details?: Record<string, unknown>
): void {
  const user = request.user as JwtPayload | ApiKeyPayload;
  const orgId = getOrganizationId(request);

  const entry: AuditLogEntry = {
    id: String(Date.now()) + '-' + Math.random().toString(36).substr(2, 9),
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

  auditLogs.set(entry.id, entry);

  console.log(`[AUDIT] ${entry.user_email} ${action} ${resourceType} ${resourceId} (${resourceName || 'unnamed'}) from ${entry.ip_address}`);
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

      // Filter logs for this organization
      let logs = Array.from(auditLogs.values())
        .filter(log => log.organization_id === orgId);

      // Apply filters
      if (action) {
        logs = logs.filter(log => log.action === action);
      }
      if (resource_type) {
        logs = logs.filter(log => log.resource_type === resource_type);
      }

      // Sort by created_at descending (newest first)
      logs.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

      // Get total count before pagination
      const total = logs.length;

      // Apply pagination
      const limitNum = parseInt(limit, 10);
      const offsetNum = parseInt(offset, 10);
      logs = logs.slice(offsetNum, offsetNum + limitNum);

      return {
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

      const actions = new Set<string>();
      for (const log of auditLogs.values()) {
        if (log.organization_id === orgId) {
          actions.add(log.action);
        }
      }

      return { actions: Array.from(actions).sort() };
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

      const resourceTypes = new Set<string>();
      for (const log of auditLogs.values()) {
        if (log.organization_id === orgId) {
          resourceTypes.add(log.resource_type);
        }
      }

      return { resource_types: Array.from(resourceTypes).sort() };
    }
  );
}
