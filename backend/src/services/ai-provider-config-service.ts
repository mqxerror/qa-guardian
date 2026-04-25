/**
 * AI Provider Config Service
 *
 * Thin orchestration layer between the `organization_ai_provider_configs`
 * repository and the runtime `aiRouter`. Responsibilities:
 *
 *   - Bootstrap: on backend startup, load any DB-stored keys and apply them
 *     to the router's providers (overriding env var defaults). This means
 *     the UI-set keys take effect even without touching `.env`.
 *
 *   - Hot-reload: when the UI saves a new key via PATCH, this service is
 *     called immediately. It decrypts, injects into the running provider,
 *     and verifies `isInitialized()`. The next API request uses the new key
 *     without restarting the container.
 *
 * Scope: this version assumes single-tenant usage — we load keys for the
 * DEFAULT organization and apply them process-wide. Multi-tenant per-org
 * routing would require a larger refactor (request-scoped provider instances);
 * flag for later if the product grows that direction.
 */

import { aiRouter } from './providers/ai-router.js';
import type { ProviderName } from './providers/types.js';
import {
  getDecryptedApiKey,
  listActiveConfigs,
  type ProviderName as RepoProviderName,
} from './repositories/ai-provider-configs.js';
import { createLogger } from './logger.js';

const log = createLogger('ai-provider-config-service');

// Single-tenant default org id (matches the seed used elsewhere).
// If multi-tenant is introduced later, callers can pass an explicit orgId.
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

// Providers the aiRouter knows how to hot-swap via its public `getProvider()`.
// Adding gemma / openai here later only requires registering the provider
// class in ai-router.ts — this service stays the same.
const HOT_RELOADABLE_PROVIDERS: ProviderName[] = ['kie', 'anthropic'];

/**
 * Reload one provider's key from the DB into the running aiRouter.
 * Returns true if the provider ends up initialized after applying the key.
 */
export async function reloadProviderKey(
  organizationId: string,
  providerName: ProviderName,
): Promise<{ applied: boolean; reason?: string }> {
  const key = await getDecryptedApiKey(organizationId, providerName as RepoProviderName);
  if (!key) {
    return { applied: false, reason: 'No active DB config' };
  }
  const provider = aiRouter.getProvider(providerName);
  if (!provider) {
    return { applied: false, reason: `Provider '${providerName}' not registered in aiRouter` };
  }
  provider.initialize(key);
  const ok = provider.isInitialized();
  if (ok) {
    log.info({ provider: providerName, org: organizationId }, 'Hot-reloaded provider key from DB');
  } else {
    log.warn({ provider: providerName, org: organizationId }, 'Provider did not initialize despite having key');
  }
  return { applied: ok, reason: ok ? undefined : 'Provider refused to initialize with supplied key' };
}

/**
 * Boot-time: read all active configs for the default org and apply them.
 * Called after the DB is connected but before the server starts handling
 * requests. Silent if no configs exist — env-var fallback continues to work.
 */
export async function bootstrapProviderConfigs(): Promise<void> {
  try {
    const configs = await listActiveConfigs(DEFAULT_ORG_ID);
    if (configs.length === 0) {
      log.info('No DB-stored provider configs — using env-var defaults');
      return;
    }
    log.info({ count: configs.length }, 'Bootstrapping provider configs from DB');
    for (const cfg of configs) {
      if (!HOT_RELOADABLE_PROVIDERS.includes(cfg.providerName as ProviderName)) {
        log.warn({ provider: cfg.providerName }, 'Skipping non-hot-reloadable provider in bootstrap');
        continue;
      }
      await reloadProviderKey(cfg.organizationId, cfg.providerName as ProviderName);
    }
  } catch (err) {
    log.error({ err }, 'bootstrapProviderConfigs failed — router will use env-var defaults');
  }
}

/**
 * Return the list of providers supported by the UI for adding keys, plus
 * the list of models each provider accepts. The frontend renders a model
 * dropdown so users don't have to memorise the right string.
 *
 * Source of truth:
 *   - Kie.ai's supported model set lives in kie-ai-provider.ts:KIE_SUPPORTED_MODELS.
 *     Anything not in that set gets mapped to deepseek-chat at request time.
 *   - Anthropic's catalog is documented in their API docs; we list the ones
 *     actually used by features in this codebase.
 */
export function getSupportedProviders(): Array<{
  name: ProviderName;
  label: string;
  defaultModel?: string;
  availableModels: Array<{ id: string; label: string; tier: 'fast' | 'balanced' | 'powerful' }>;
}> {
  return [
    {
      name: 'kie',
      label: 'Kie.ai (primary)',
      defaultModel: 'deepseek-chat',
      availableModels: [
        { id: 'deepseek-chat', label: 'DeepSeek Chat (recommended for cost)', tier: 'fast' },
        { id: 'deepseek-coder', label: 'DeepSeek Coder (codegen-tuned)', tier: 'balanced' },
        { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner (deeper analysis)', tier: 'powerful' },
        { id: 'qwen-turbo', label: 'Qwen Turbo (fast Chinese-strong)', tier: 'fast' },
        { id: 'qwen-plus', label: 'Qwen Plus', tier: 'balanced' },
        { id: 'gpt-4o-mini', label: 'GPT-4o Mini', tier: 'fast' },
        { id: 'gpt-4o', label: 'GPT-4o', tier: 'powerful' },
      ],
    },
    {
      name: 'anthropic',
      label: 'Anthropic (fallback)',
      defaultModel: 'claude-3-haiku-20240307',
      availableModels: [
        { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (fastest, cheapest)', tier: 'fast' },
        { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (balanced)', tier: 'balanced' },
        { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', tier: 'balanced' },
        { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus (deepest)', tier: 'powerful' },
      ],
    },
  ];
}
