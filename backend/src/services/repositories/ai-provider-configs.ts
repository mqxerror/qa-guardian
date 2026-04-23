/**
 * AI Provider Configs Repository
 *
 * Persistent, encrypted storage for per-organization AI provider credentials
 * (Kie.ai, Anthropic, future: gemma, openai, etc.). Replaces the in-memory
 * Map in routes/github/ai-providers-types.ts.
 *
 * Security:
 *   - API keys are encrypted with AES-256-GCM (shared encryption service)
 *     before insertion and decrypted on read.
 *   - Responses from read helpers include a MASKED key for the UI; the full
 *     plaintext key is returned ONLY from getDecryptedApiKey() which is used
 *     by the aiRouter at hot-reload time.
 *   - `UNIQUE(organization_id, provider_name) WHERE is_active` enforces one
 *     active key per provider per org. Deactivating tombstones the row for
 *     audit purposes rather than hard-deleting.
 */

import { query, isDatabaseConnected } from '../database.js';
import { encrypt, decrypt, isEncrypted } from '../encryption.js';
import { createLogger } from '../logger.js';

const log = createLogger('repo:ai-provider-configs');

// =============================================================================
// Types
// =============================================================================

export type ProviderName = 'kie' | 'anthropic' | 'gemma' | 'openai' | string;

export interface AIProviderConfig {
  id: string;
  organizationId: string;
  providerName: ProviderName;
  /** Always masked (`sk-...abcd`) — never the raw key. */
  apiKeyMasked: string;
  apiBaseUrl: string | null;
  defaultModel: string | null;
  isActive: boolean;
  lastTestedAt: Date | null;
  lastTestSuccess: boolean | null;
  lastTestError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AIProviderConfigRow {
  id: string;
  organization_id: string;
  provider_name: string;
  encrypted_api_key: string;
  api_base_url: string | null;
  default_model: string | null;
  is_active: boolean;
  last_tested_at: Date | null;
  last_test_success: boolean | null;
  last_test_error: string | null;
  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// Helpers
// =============================================================================

function maskApiKey(plaintext: string): string {
  if (!plaintext || plaintext.length < 8) return '****';
  return `${plaintext.slice(0, 4)}...${plaintext.slice(-4)}`;
}

function rowToConfig(row: AIProviderConfigRow): AIProviderConfig {
  let masked = '****';
  try {
    const plain = isEncrypted(row.encrypted_api_key)
      ? decrypt(row.encrypted_api_key)
      : row.encrypted_api_key;
    masked = maskApiKey(plain);
  } catch (err) {
    log.warn({ configId: row.id, err }, 'Failed to decrypt key for masking — returning placeholder');
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    providerName: row.provider_name,
    apiKeyMasked: masked,
    apiBaseUrl: row.api_base_url,
    defaultModel: row.default_model,
    isActive: row.is_active,
    lastTestedAt: row.last_tested_at,
    lastTestSuccess: row.last_test_success,
    lastTestError: row.last_test_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// =============================================================================
// Queries
// =============================================================================

const COLS = `
  id, organization_id, provider_name, encrypted_api_key, api_base_url,
  default_model, is_active, last_tested_at, last_test_success, last_test_error,
  created_at, updated_at
`;

/**
 * List all active provider configs for an organization. Keys come back masked.
 */
export async function listActiveConfigs(organizationId: string): Promise<AIProviderConfig[]> {
  if (!isDatabaseConnected()) {
    log.warn('DB not connected — returning empty provider configs');
    return [];
  }
  const result = await query<AIProviderConfigRow>(
    `SELECT ${COLS} FROM organization_ai_provider_configs
     WHERE organization_id = $1 AND is_active = true
     ORDER BY provider_name ASC`,
    [organizationId],
  );
  return (result?.rows ?? []).map(rowToConfig);
}

/**
 * Fetch one active config by (org, provider). Returns null if no active config.
 */
export async function getActiveConfig(
  organizationId: string,
  providerName: ProviderName,
): Promise<AIProviderConfig | null> {
  if (!isDatabaseConnected()) return null;
  const result = await query<AIProviderConfigRow>(
    `SELECT ${COLS} FROM organization_ai_provider_configs
     WHERE organization_id = $1 AND provider_name = $2 AND is_active = true
     LIMIT 1`,
    [organizationId, providerName],
  );
  const row = result?.rows?.[0];
  return row ? rowToConfig(row) : null;
}

/**
 * Return the DECRYPTED API key for the given active config. Used by the
 * aiRouter on hot-reload. Returns null if no active config or decrypt fails.
 *
 * Caller must NEVER log or return this value to the client.
 */
export async function getDecryptedApiKey(
  organizationId: string,
  providerName: ProviderName,
): Promise<string | null> {
  if (!isDatabaseConnected()) return null;
  const result = await query<AIProviderConfigRow>(
    `SELECT encrypted_api_key FROM organization_ai_provider_configs
     WHERE organization_id = $1 AND provider_name = $2 AND is_active = true
     LIMIT 1`,
    [organizationId, providerName],
  );
  const row = result?.rows?.[0];
  if (!row) return null;
  try {
    return isEncrypted(row.encrypted_api_key)
      ? decrypt(row.encrypted_api_key)
      : row.encrypted_api_key;
  } catch (err) {
    log.error({ organizationId, providerName, err }, 'Failed to decrypt API key');
    return null;
  }
}

/**
 * Upsert a provider config. Encrypts the plaintext key before storing.
 *
 * - Creates a new active row if none exists for (org, provider).
 * - If an active row exists, updates it in place (writes new key, nulls
 *   last_test_* so the user knows to re-test).
 * - The UNIQUE partial index ensures at most one active row per (org, provider).
 */
export async function upsertConfig(input: {
  organizationId: string;
  providerName: ProviderName;
  apiKeyPlaintext: string;
  apiBaseUrl?: string | null;
  defaultModel?: string | null;
  userId?: string | null;
}): Promise<AIProviderConfig | null> {
  if (!isDatabaseConnected()) return null;
  if (!input.apiKeyPlaintext || input.apiKeyPlaintext.trim().length === 0) {
    throw new Error('apiKeyPlaintext is required');
  }

  const encrypted = encrypt(input.apiKeyPlaintext);

  const result = await query<AIProviderConfigRow>(
    `INSERT INTO organization_ai_provider_configs (
       organization_id, provider_name, encrypted_api_key,
       api_base_url, default_model, is_active,
       last_tested_at, last_test_success, last_test_error,
       created_by, updated_by
     ) VALUES ($1, $2, $3, $4, $5, true, NULL, NULL, NULL, $6, $6)
     ON CONFLICT (organization_id, provider_name)
       WHERE is_active = true
     DO UPDATE SET
       encrypted_api_key = EXCLUDED.encrypted_api_key,
       api_base_url = EXCLUDED.api_base_url,
       default_model = EXCLUDED.default_model,
       last_tested_at = NULL,
       last_test_success = NULL,
       last_test_error = NULL,
       updated_by = EXCLUDED.updated_by
     RETURNING ${COLS}`,
    [
      input.organizationId,
      input.providerName,
      encrypted,
      input.apiBaseUrl ?? null,
      input.defaultModel ?? null,
      input.userId ?? null,
    ],
  );

  const row = result?.rows?.[0];
  return row ? rowToConfig(row) : null;
}

/**
 * Soft-delete a config by setting is_active=false. Preserves audit trail.
 */
export async function deactivateConfig(
  organizationId: string,
  providerName: ProviderName,
): Promise<boolean> {
  if (!isDatabaseConnected()) return false;
  const result = await query(
    `UPDATE organization_ai_provider_configs
     SET is_active = false
     WHERE organization_id = $1 AND provider_name = $2 AND is_active = true`,
    [organizationId, providerName],
  );
  return (result?.rowCount ?? 0) > 0;
}

/**
 * Record the outcome of a test-connection call.
 */
export async function recordTestResult(
  organizationId: string,
  providerName: ProviderName,
  success: boolean,
  errorMessage?: string,
): Promise<void> {
  if (!isDatabaseConnected()) return;
  await query(
    `UPDATE organization_ai_provider_configs
     SET last_tested_at = NOW(), last_test_success = $3, last_test_error = $4
     WHERE organization_id = $1 AND provider_name = $2 AND is_active = true`,
    [organizationId, providerName, success, errorMessage ?? null],
  );
}
