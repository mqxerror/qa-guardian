/**
 * AI Provider Configs REST API
 *
 * Replaces the scattered Kie/Anthropic-specific endpoints with a single
 * provider-agnostic surface. The frontend's AIConfigurationTab writes here;
 * saves persist to `organization_ai_provider_configs` (encrypted) and
 * hot-reload the in-process aiRouter so the new key takes effect immediately.
 *
 * Routes:
 *   GET    /api/v1/ai/providers                — list masked configs + supported provider catalog
 *   PATCH  /api/v1/ai/providers/:provider      — upsert a provider's key + hot-reload router
 *   POST   /api/v1/ai/providers/:provider/test — ping the provider with current key
 *   DELETE /api/v1/ai/providers/:provider      — deactivate (soft-delete)
 *
 * Authorization: all routes require admin/owner role. Viewers/QA cannot
 * rotate keys. The handler re-checks at runtime because the authenticate
 * middleware only verifies the token, not the role.
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate, getOrganizationId, type JwtPayload, type ApiKeyPayload } from '../middleware/auth.js';
import { sendError } from '../utils/errors.js';
import { createLogger } from '../services/logger.js';
import {
  listActiveConfigs,
  getActiveConfig,
  upsertConfig,
  deactivateConfig,
  recordTestResult,
  getDecryptedApiKey,
} from '../services/repositories/ai-provider-configs.js';
import {
  reloadProviderKey,
  getSupportedProviders,
} from '../services/ai-provider-config-service.js';
import { aiRouter } from '../services/providers/ai-router.js';
import type { ProviderName } from '../services/providers/types.js';

const log = createLogger('routes:ai-provider-configs');

// Providers the UI is allowed to write keys for (validated at route entry).
const SUPPORTED_PROVIDERS = new Set<ProviderName>(['kie', 'anthropic']);

// Minimum key length sanity check — real keys are 20-200 chars typically.
// Blocks obviously-bad input ("test", "xxx") without being too strict.
const MIN_KEY_LENGTH = 10;

// Roles permitted to rotate keys.
const ADMIN_ROLES = new Set<JwtPayload['role']>(['admin', 'owner']);

function getJwtUser(request: FastifyRequest): JwtPayload | null {
  const user = request.user as (JwtPayload | ApiKeyPayload) | undefined;
  if (!user || typeof user !== 'object') return null;
  // JWT users have `role`; API key users have `type: 'api_key'`.
  if ('type' in user && user.type === 'api_key') return null;
  if (!('role' in user)) return null;
  return user as JwtPayload;
}

/**
 * Allow rotation if (a) caller is a JWT admin/owner, OR (b) caller is an
 * API key with the `admin` scope. API keys with admin scope are a deliberate
 * design choice — Claude Code CLI users with admin tokens need to be able
 * to rotate provider credentials without the UI's JWT session.
 */
function isAdmin(request: FastifyRequest): boolean {
  const jwt = getJwtUser(request);
  if (jwt && ADMIN_ROLES.has(jwt.role)) return true;
  const user = request.user as (JwtPayload | ApiKeyPayload) | undefined;
  if (user && 'type' in user && user.type === 'api_key' && Array.isArray(user.scopes) && user.scopes.includes('admin')) {
    return true;
  }
  return false;
}

export async function aiProviderConfigRoutes(app: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------
  // GET /api/v1/ai/providers
  // Returns:
  //   - supported[]: provider catalog the UI renders the form from
  //   - configs[]: masked key + status for providers that have been set
  //   - routerState: current primary/fallback + per-provider initialized flag
  // ---------------------------------------------------------------------
  app.get('/api/v1/ai/providers', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const orgId = getOrganizationId(request);
      const configs = await listActiveConfigs(orgId);
      const routerConfig = aiRouter.getRouterConfig();

      if (reply.sent) return;

      return {
        supported: getSupportedProviders(),
        configs: configs.map(c => ({
          provider: c.providerName,
          apiKeyMasked: c.apiKeyMasked,
          apiBaseUrl: c.apiBaseUrl,
          defaultModel: c.defaultModel,
          lastTestedAt: c.lastTestedAt,
          lastTestSuccess: c.lastTestSuccess,
          lastTestError: c.lastTestError,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
        routerState: {
          primary: routerConfig.primary,
          fallback: routerConfig.fallback,
          kieInitialized: aiRouter.isProviderAvailable('kie'),
          anthropicInitialized: aiRouter.isProviderAvailable('anthropic'),
        },
      };
    } catch (err) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR',
        err instanceof Error ? err.message : 'Failed to list providers');
    }
  });

  // ---------------------------------------------------------------------
  // PATCH /api/v1/ai/providers/:provider
  // Body: { apiKey: string, apiBaseUrl?: string, defaultModel?: string }
  // Writes encrypted key to DB, then hot-reloads the router.
  // ---------------------------------------------------------------------
  app.patch<{
    Params: { provider: string };
    Body: { apiKey: string; apiBaseUrl?: string; defaultModel?: string };
  }>('/api/v1/ai/providers/:provider', { preHandler: [authenticate] }, async (request, reply) => {
    if (!isAdmin(request)) {
      return sendError(reply, 403, 'FORBIDDEN', 'Only admins/owners can rotate provider keys');
    }

    const orgId = getOrganizationId(request);
    const providerName = request.params.provider as ProviderName;
    const { apiKey, apiBaseUrl, defaultModel } = request.body ?? {} as { apiKey?: string; apiBaseUrl?: string; defaultModel?: string };

    if (!SUPPORTED_PROVIDERS.has(providerName)) {
      return sendError(reply, 400, 'BAD_REQUEST',
        `Unsupported provider '${providerName}'. Supported: ${[...SUPPORTED_PROVIDERS].join(', ')}`);
    }
    if (!apiKey || apiKey.trim().length < MIN_KEY_LENGTH) {
      return sendError(reply, 400, 'BAD_REQUEST',
        `API key must be at least ${MIN_KEY_LENGTH} characters`);
    }

    try {
      const saved = await upsertConfig({
        organizationId: orgId,
        providerName,
        apiKeyPlaintext: apiKey.trim(),
        apiBaseUrl: apiBaseUrl?.trim() || null,
        defaultModel: defaultModel?.trim() || null,
        userId: getJwtUser(request)?.id ?? null,
      });

      // Hot-reload the running router so the next AI request uses the new key.
      const reload = await reloadProviderKey(orgId, providerName);
      log.info({ provider: providerName, org: orgId, reload }, 'Provider key updated');

      if (reply.sent) return;
      return {
        success: true,
        config: saved ? {
          provider: saved.providerName,
          apiKeyMasked: saved.apiKeyMasked,
          apiBaseUrl: saved.apiBaseUrl,
          defaultModel: saved.defaultModel,
          updatedAt: saved.updatedAt,
        } : null,
        routerApplied: reload.applied,
        routerReason: reload.reason,
      };
    } catch (err) {
      log.error({ err, provider: providerName }, 'Upsert failed');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR',
        err instanceof Error ? err.message : 'Failed to save provider config');
    }
  });

  // ---------------------------------------------------------------------
  // POST /api/v1/ai/providers/:provider/test
  // Pings the provider with the current key (DB → router) and records the
  // outcome on the config row so the UI can show "last tested 5m ago — ok".
  // ---------------------------------------------------------------------
  app.post<{ Params: { provider: string } }>(
    '/api/v1/ai/providers/:provider/test',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const providerName = request.params.provider as ProviderName;

      if (!SUPPORTED_PROVIDERS.has(providerName)) {
        return sendError(reply, 400, 'BAD_REQUEST',
          `Unsupported provider '${providerName}'`);
      }

      // Ensure the router has the latest DB key before we test.
      await reloadProviderKey(orgId, providerName);
      const provider = aiRouter.getProvider(providerName);
      if (!provider || !provider.isInitialized()) {
        const msg = 'Provider not initialized — save a key first';
        await recordTestResult(orgId, providerName, false, msg);
        return sendError(reply, 400, 'NOT_INITIALIZED', msg);
      }

      // A healthCheck call verifies the key is live without consuming a full
      // generation budget. Providers implement this differently (models-list
      // ping for Anthropic; chat echo for Kie).
      const started = Date.now();
      try {
        const result = await provider.healthCheck();
        const latencyMs = Date.now() - started;
        const success = result.status === 'healthy' || result.status === 'degraded';
        await recordTestResult(orgId, providerName, success,
          success ? undefined : `healthCheck returned status=${result.status}`);
        if (reply.sent) return;
        return {
          success,
          status: result.status,
          latencyMs,
          message: success ? 'Connection verified' : `Unhealthy: ${result.status}`,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await recordTestResult(orgId, providerName, false, msg);
        log.warn({ provider: providerName, err: msg }, 'test-connection failed');
        if (reply.sent) return;
        return {
          success: false,
          status: 'offline',
          latencyMs: Date.now() - started,
          message: msg,
        };
      }
    },
  );

  // ---------------------------------------------------------------------
  // DELETE /api/v1/ai/providers/:provider
  // Soft-deletes the active config. The router's cached key persists until
  // container restart OR the provider is re-initialized. We do NOT forcibly
  // clear the in-process key — you want existing inflight requests to finish.
  // ---------------------------------------------------------------------
  app.delete<{ Params: { provider: string } }>(
    '/api/v1/ai/providers/:provider',
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (!isAdmin(request)) {
        return sendError(reply, 403, 'FORBIDDEN', 'Only admins/owners can remove provider keys');
      }

      const orgId = getOrganizationId(request);
      const providerName = request.params.provider as ProviderName;

      if (!SUPPORTED_PROVIDERS.has(providerName)) {
        return sendError(reply, 400, 'BAD_REQUEST',
          `Unsupported provider '${providerName}'`);
      }

      const removed = await deactivateConfig(orgId, providerName);
      if (!removed) {
        return sendError(reply, 404, 'NOT_FOUND', 'No active config to remove');
      }
      log.info({ provider: providerName, org: orgId, by: getJwtUser(request)?.id }, 'Deactivated provider config');
      if (reply.sent) return;
      return { success: true };
    },
  );

  // Referenced but not used directly — keep for type-check and future internal calls.
  void getActiveConfig; void getDecryptedApiKey;
}
