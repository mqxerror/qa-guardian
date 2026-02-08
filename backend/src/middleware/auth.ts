import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
// Feature #2116: Use async DB call instead of synchronous Map
import { dbIsTokenBlacklisted } from '../routes/auth.js';
// Feature #202: Use async DB lookup for API key validation (deprecated empty Map removed)
import { getApiKeyByHash as dbGetApiKeyByHash, updateApiKey as dbUpdateApiKey } from '../services/repositories/api-keys.js';
// Feature #439: Use structured logger instead of console.*
import { logger } from '../services/logger.js';

// Internal service token for service-to-service communication (MCP -> Backend)
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;

export interface JwtPayload {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'developer' | 'viewer';
  organization_id: string;
}

export interface ApiKeyPayload {
  id: string;
  organization_id: string;
  scopes: string[];
  type: 'api_key';
}

export interface InternalServicePayload {
  id: string;
  organization_id: string;
  scopes: string[];
  type: 'internal_service';
}

// Helper to validate internal service token
// Feature #228: Use timing-safe comparison to prevent timing attacks
function validateInternalServiceToken(token: string): InternalServicePayload | null {
  if (!INTERNAL_SERVICE_TOKEN) {
    return null;
  }

  // Feature #228: Use crypto.timingSafeEqual for constant-time comparison
  // Feature #235: Hash both values with SHA-256 to normalize lengths and prevent
  // length-based timing leaks. The length pre-check was removed because it
  // leaks the expected token length via timing side-channel.
  const tokenHash = crypto.createHash('sha256').update(token).digest();
  const expectedHash = crypto.createHash('sha256').update(INTERNAL_SERVICE_TOKEN).digest();

  // Both hashes are now exactly 32 bytes, so no length check needed
  if (crypto.timingSafeEqual(tokenHash, expectedHash)) {
    return {
      id: 'internal-service',
      organization_id: 'system',
      scopes: ['admin', 'mcp', 'read', 'write', 'execute'],
      type: 'internal_service',
    };
  }
  return null;
}

// Feature #202: Async API key validation using PostgreSQL database lookup
async function validateApiKey(apiKey: string): Promise<ApiKeyPayload | null> {
  // Hash the provided key
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // Look up API key in database (already filters out revoked keys)
  const key = await dbGetApiKeyByHash(keyHash);
  if (!key) {
    return null;
  }

  // Check if expired
  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return null;
  }

  // Update last_used_at (async, don't wait for it)
  dbUpdateApiKey(key.id, { last_used_at: new Date() }).catch((err) => {
    logger.error({ err, keyId: key.id }, '[Auth] Failed to update API key last_used_at');
  });

  return {
    id: key.id,
    organization_id: key.organization_id,
    scopes: key.scopes,
    type: 'api_key',
  };
}

// Middleware to verify JWT or API key
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  const apiKeyHeader = request.headers['x-api-key'] as string | undefined;
  const internalServiceHeader = request.headers['x-internal-service-token'] as string | undefined;

  // Check internal service token first (for MCP -> Backend calls)
  if (internalServiceHeader) {
    const internalPayload = validateInternalServiceToken(internalServiceHeader);
    if (internalPayload) {
      request.user = internalPayload;
      return;
    }
    // Don't reveal that internal service auth failed - fall through to normal auth
  }

  // Try API key authentication first
  // Feature #202: await the async database lookup
  if (apiKeyHeader) {
    const apiKeyPayload = await validateApiKey(apiKeyHeader);
    if (apiKeyPayload) {
      request.user = apiKeyPayload;
      return;
    }
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired API key',
    });
  }

  // Fall back to JWT authentication
  try {
    await request.jwtVerify();

    // Feature #2116: Check if token is blacklisted using async DB call
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (await dbIsTokenBlacklisted(token)) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Token has been invalidated',
        });
      }
    }
  } catch {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required. Please provide a valid token or API key.',
    });
  }
}

// Middleware factory for role-based access control
export function requireRoles(allowedRoles: JwtPayload['role'][]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JwtPayload | ApiKeyPayload | InternalServicePayload;

    // Internal service has admin access to everything
    if ('type' in user && user.type === 'internal_service') {
      return;
    }

    // API keys don't have roles, they use scopes
    if ('type' in user && user.type === 'api_key') {
      // API keys with admin scope can do anything
      if (user.scopes.includes('admin')) {
        return;
      }
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'API key does not have admin scope required for this action',
      });
    }

    if (!user || !allowedRoles.includes(user.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
    }
  };
}

// Middleware factory for API key scope-based access control
export function requireScopes(requiredScopes: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as JwtPayload | ApiKeyPayload | InternalServicePayload;

    // Internal service has full admin access
    if ('type' in user && user.type === 'internal_service') {
      return;
    }

    // JWT users (regular session) can do anything their role allows
    if (!('type' in user) || user.type !== 'api_key') {
      return; // JWT users bypass scope checks
    }

    // API key - check if it has required scopes
    const apiKeyUser = user as ApiKeyPayload;

    // Admin scope allows everything
    if (apiKeyUser.scopes.includes('admin')) {
      return;
    }

    // Check if API key has all required scopes
    const hasAllScopes = requiredScopes.every(scope => apiKeyUser.scopes.includes(scope));
    if (!hasAllScopes) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `This action requires the following API key scopes: ${requiredScopes.join(', ')}. Your key has: ${apiKeyUser.scopes.join(', ')}`,
      });
    }
  };
}

// Helper to check if request is from API key
export function isApiKeyRequest(request: FastifyRequest): boolean {
  const user = request.user as JwtPayload | ApiKeyPayload;
  return 'type' in user && user.type === 'api_key';
}

// Feature #2096: UUID validation helper
// Allows both standard UUIDs (versions 1-5) and nil/zero UUIDs used for seeded test data
function isValidUUID(str: string): boolean {
  // Standard UUID pattern (versions 1-5)
  const standardUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  // Zero/nil UUID pattern (used for seeded default org/user data)
  const zeroUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return standardUUID.test(str) || zeroUUID.test(str);
}

// Helper to get organization ID from either JWT or API key
// Feature #2096: Added UUID validation to catch invalid tokens early
export function getOrganizationId(request: FastifyRequest): string {
  const user = request.user as JwtPayload | ApiKeyPayload | InternalServicePayload;
  const orgId = user.organization_id;

  // Allow 'system' org_id for internal service tokens
  if ('type' in user && user.type === 'internal_service' && orgId === 'system') {
    return orgId;
  }

  // Validate UUID format for all other tokens
  if (!orgId || !isValidUUID(orgId)) {
    throw new Error('Invalid organization_id in token - please log in again');
  }

  return orgId;
}
