// Core API Key CRUD routes

import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { authenticate, requireRoles, JwtPayload } from '../../middleware/auth';
import { ApiKey, CreateApiKeyBody, OrgParams, KeyParams } from './types';
import {
  dbCreateApiKey,
  dbGetApiKeyById,
  dbGetApiKeyByHash,
  dbListApiKeysByOrg,
  dbUpdateApiKey,
  dbRevokeApiKey,
} from './stores';
import { generateApiKey } from './utils';

export async function registerApiKeyRoutes(app: FastifyInstance) {
  // List API keys for organization (only shows prefix, not full key)
  app.get<{ Params: OrgParams }>('/api/v1/organizations/:orgId/api-keys', {
    preHandler: [authenticate, requireRoles(['owner', 'admin', 'developer'])],
  }, async (request, reply) => {
    const { orgId } = request.params;
    const user = request.user as JwtPayload;

    if (user.organization_id !== orgId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You can only view API keys for your organization',
      });
    }

    const allKeys = await dbListApiKeysByOrg(orgId);
    const keys = allKeys
      .filter(k => !k.revoked_at)
      .map(k => ({
        id: k.id,
        name: k.name,
        key_prefix: k.key_prefix,
        scopes: k.scopes,
        last_used_at: k.last_used_at,
        expires_at: k.expires_at,
        created_by: k.created_by,
        created_at: k.created_at,
      }));

    return { api_keys: keys };
  });

  // Create new API key (returns full key ONLY at creation time)
  app.post<{ Params: OrgParams; Body: CreateApiKeyBody }>('/api/v1/organizations/:orgId/api-keys', {
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request, reply) => {
    const { orgId } = request.params;
    const { name, scopes = ['read'], expires_in_days, rate_limit, rate_limit_window, burst_limit, burst_window } = request.body;
    const user = request.user as JwtPayload;

    if (user.organization_id !== orgId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You can only create API keys for your organization',
      });
    }

    if (!name || name.trim().length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'API key name is required',
      });
    }

    const validScopes = ['read', 'execute', 'write', 'admin', 'mcp', 'mcp:read', 'mcp:write', 'mcp:execute'];
    const invalidScopes = scopes.filter(s => !validScopes.includes(s));
    if (invalidScopes.length > 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Invalid scopes: ${invalidScopes.join(', ')}. Valid scopes are: ${validScopes.join(', ')}`,
      });
    }

    const { key, prefix, hash } = generateApiKey();

    let expiresAt: Date | null = null;
    if (expires_in_days && expires_in_days > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);
    }

    const apiKey: ApiKey = {
      id: crypto.randomUUID(),
      organization_id: orgId,
      name: name.trim(),
      key_hash: hash,
      key_prefix: prefix,
      scopes,
      last_used_at: null,
      expires_at: expiresAt,
      created_by: user.id,
      created_at: new Date(),
      revoked_at: null,
      rate_limit,
      rate_limit_window,
      burst_limit,
      burst_window,
    };

    await dbCreateApiKey(apiKey);

    console.log(`
====================================
  API Key Created
====================================
  Name: ${apiKey.name}
  ID: ${apiKey.id}
  Scopes: ${apiKey.scopes.join(', ')}
  Created by: ${user.email}
====================================
    `);

    return reply.status(201).send({
      api_key: {
        id: apiKey.id,
        name: apiKey.name,
        key: key,
        key_prefix: apiKey.key_prefix,
        scopes: apiKey.scopes,
        expires_at: apiKey.expires_at,
        created_at: apiKey.created_at,
        rate_limit: {
          max_requests: apiKey.rate_limit || 100,
          window_seconds: apiKey.rate_limit_window || 60,
          burst_limit: apiKey.burst_limit || 20,
          burst_window_seconds: apiKey.burst_window || 10,
        },
      },
      warning: 'This is the only time the full API key will be displayed. Please copy and store it securely.',
    });
  });

  // Revoke (delete) API key
  app.delete<{ Params: KeyParams }>('/api/v1/api-keys/:id', {
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request, reply) => {
    const { id } = request.params;
    const user = request.user as JwtPayload;

    const apiKey = await dbGetApiKeyById(id);
    if (!apiKey) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'API key not found',
      });
    }

    if (user.organization_id !== apiKey.organization_id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You can only delete API keys from your organization',
      });
    }

    await dbRevokeApiKey(id);

    console.log(`[API KEY REVOKED] Key ${apiKey.key_prefix} revoked by ${user.email}`);

    return { message: 'API key revoked successfully' };
  });

  // Rotate API key (revoke old, create new with same settings)
  app.post<{ Params: KeyParams }>('/api/v1/api-keys/:id/rotate', {
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request, reply) => {
    const { id } = request.params;
    const user = request.user as JwtPayload;

    const oldKey = await dbGetApiKeyById(id);
    if (!oldKey || oldKey.revoked_at) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'API key not found',
      });
    }

    if (user.organization_id !== oldKey.organization_id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You can only rotate API keys from your organization',
      });
    }

    await dbRevokeApiKey(id);

    const { key, prefix, hash } = generateApiKey();

    const newApiKey: ApiKey = {
      id: crypto.randomUUID(),
      organization_id: oldKey.organization_id,
      name: oldKey.name,
      key_hash: hash,
      key_prefix: prefix,
      scopes: oldKey.scopes,
      last_used_at: null,
      expires_at: oldKey.expires_at,
      created_by: user.id,
      created_at: new Date(),
      revoked_at: null,
    };

    await dbCreateApiKey(newApiKey);

    console.log(`[API KEY ROTATED] Key ${oldKey.key_prefix} -> ${newApiKey.key_prefix} by ${user.email}`);

    return {
      api_key: {
        id: newApiKey.id,
        name: newApiKey.name,
        key: key,
        key_prefix: newApiKey.key_prefix,
        scopes: newApiKey.scopes,
        expires_at: newApiKey.expires_at,
        created_at: newApiKey.created_at,
      },
      warning: 'This is the only time the new API key will be displayed. Please copy and store it securely.',
      old_key_revoked: true,
    };
  });

  // Validate API key for MCP access (called by MCP server)
  app.post<{ Body: { api_key: string; required_scope?: string } }>('/api/v1/mcp/validate-key', async (request, reply) => {
    const { api_key, required_scope = 'mcp' } = request.body;

    if (!api_key) {
      return reply.status(400).send({
        valid: false,
        error: 'API key is required',
      });
    }

    const keyHash = crypto.createHash('sha256').update(api_key).digest('hex');

    const foundKeyResult = await dbGetApiKeyByHash(keyHash);
    const foundKey = foundKeyResult && !foundKeyResult.revoked_at ? foundKeyResult : undefined;

    if (!foundKey) {
      return reply.status(401).send({
        valid: false,
        error: 'Invalid or revoked API key',
      });
    }

    if (foundKey.expires_at && new Date() > foundKey.expires_at) {
      return reply.status(401).send({
        valid: false,
        error: 'API key has expired',
      });
    }

    const hasMcpAccess = foundKey.scopes.some(scope => {
      if (scope === 'admin') return true;
      if (scope === 'mcp') return true;
      if (scope.startsWith('mcp:')) {
        if (required_scope === 'mcp') return true;
        return scope === required_scope;
      }
      return false;
    });

    if (!hasMcpAccess) {
      return reply.status(403).send({
        valid: false,
        error: 'API key does not have MCP access. Required scope: mcp or mcp:*',
        scopes: foundKey.scopes,
      });
    }

    await dbUpdateApiKey(foundKey.id, { last_used_at: new Date() });

    return {
      valid: true,
      organization_id: foundKey.organization_id,
      scopes: foundKey.scopes,
      key_name: foundKey.name,
      rate_limit: {
        max_requests: foundKey.rate_limit || 100,
        window_seconds: foundKey.rate_limit_window || 60,
        burst_limit: foundKey.burst_limit || 20,
        burst_window_seconds: foundKey.burst_window || 10,
      },
    };
  });
}
