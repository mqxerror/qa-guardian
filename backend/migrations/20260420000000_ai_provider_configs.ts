/**
 * Migration: organization_ai_provider_configs
 *
 * Per-organization storage for Kie.ai and Anthropic (and future) AI provider
 * credentials + defaults. Replaces the prior in-memory Map approach so that:
 *   - Keys survive backend restarts
 *   - Keys are encrypted at rest (AES-256-GCM via the shared encryption service)
 *   - The UI (AIConfigurationTab) can read/write via the existing PATCH
 *     endpoints, then hot-reload aiRouter without a container restart.
 *
 * Schema:
 *   - provider_name: free-text so we can add providers (gemma, gpt-4, etc.)
 *     without a schema change. FE validates against an allowlist.
 *   - encrypted_api_key: the AES-256-GCM ciphertext (with `enc:v2:` prefix).
 *   - api_base_url: nullable — falls back to provider default.
 *   - default_model: nullable — caller can override at request time.
 *   - is_active: operator can temporarily disable without deleting.
 *   - UNIQUE(organization_id, provider_name) — one active config per provider
 *     per org. Tombstoning a key means setting is_active=false.
 *
 * Idempotent: uses CREATE TABLE IF NOT EXISTS.
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS organization_ai_provider_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      provider_name TEXT NOT NULL,
      encrypted_api_key TEXT NOT NULL,
      api_base_url TEXT,
      default_model TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      last_tested_at TIMESTAMP WITH TIME ZONE,
      last_test_success BOOLEAN,
      last_test_error TEXT,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  // One active config per provider per org. We still allow soft-deleted
  // inactive rows to coexist so we can audit key rotation history.
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_aipc_org_provider_active
    ON organization_ai_provider_configs(organization_id, provider_name)
    WHERE is_active = true;
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_aipc_org
    ON organization_ai_provider_configs(organization_id);
  `);

  // Auto-update updated_at on row change.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION set_updated_at_aipc()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_aipc_updated_at ON organization_ai_provider_configs;
    CREATE TRIGGER trg_aipc_updated_at
    BEFORE UPDATE ON organization_ai_provider_configs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_aipc();
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TRIGGER IF EXISTS trg_aipc_updated_at ON organization_ai_provider_configs;');
  pgm.sql('DROP FUNCTION IF EXISTS set_updated_at_aipc();');
  pgm.sql('DROP TABLE IF EXISTS organization_ai_provider_configs CASCADE;');
}
