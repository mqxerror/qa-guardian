import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { tokenBlacklist } from '../routes/auth';
import { apiKeys } from '../routes/api-keys';

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

// Helper to validate API key
function validateApiKey(apiKey: string): ApiKeyPayload | null {
  // Hash the provided key
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // Find matching API key
  for (const [, key] of apiKeys) {
    if (key.key_hash === keyHash && !key.revoked_at) {
      // Check if expired
      if (key.expires_at && new Date(key.expires_at) < new Date()) {
        return null;
      }

      // Update last_used_at
      key.last_used_at = new Date();

      return {
        id: key.id,
        organization_id: key.organization_id,
        scopes: key.scopes,
        type: 'api_key',
      };
    }
  }
  return null;
}

// Middleware to verify JWT or API key
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  const apiKeyHeader = request.headers['x-api-key'] as string | undefined;

  // Try API key authentication first
  if (apiKeyHeader) {
    const apiKeyPayload = validateApiKey(apiKeyHeader);
    if (apiKeyPayload) {
      // @ts-ignore - we're extending the user property to support API keys
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

    // Check if token is blacklisted (logged out)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (tokenBlacklist.has(token)) {
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
    const user = request.user as JwtPayload | ApiKeyPayload;

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
    const user = request.user as JwtPayload | ApiKeyPayload;

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

// Helper to get organization ID from either JWT or API key
export function getOrganizationId(request: FastifyRequest): string {
  const user = request.user as JwtPayload | ApiKeyPayload;
  return user.organization_id;
}
