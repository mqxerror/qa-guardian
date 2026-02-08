/**
 * Migration: Authentication Tables
 * Feature #440: Complete database migration coverage
 *
 * Creates tables for:
 * - sessions: User session management
 * - token_blacklist: Invalidated JWT tokens
 * - reset_tokens: Password reset tokens
 * - refresh_tokens: Refresh token persistence
 * - api_keys: API key management
 * - invitations: Organization invitations
 *
 * NOTE: All operations are idempotent. Tables may already exist from
 * service-level CREATE TABLE IF NOT EXISTS with a different schema.
 * Columns are defensively added to handle schema drift.
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Defensively ensure columns exist on a table that may have been created
 * by service-level code with a different schema. Uses ALTER TABLE ... ADD
 * COLUMN IF NOT EXISTS (PostgreSQL 9.6+).
 */
function ensureColumns(
  pgm: MigrationBuilder,
  table: string,
  columns: Array<{ name: string; type: string; notNull?: boolean; default?: string }>
): void {
  for (const col of columns) {
    const parts = [`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`];
    if (col.default !== undefined) {
      parts.push(`DEFAULT ${col.default}`);
    }
    if (col.notNull) {
      // Add NOT NULL only if there's a default, otherwise skip to avoid breaking existing rows
      if (col.default !== undefined) {
        parts.push('NOT NULL');
      }
    }
    pgm.sql(parts.join(' ') + ';');
  }
}

/**
 * Defensively add a foreign key constraint if it does not already exist.
 */
function ensureForeignKey(
  pgm: MigrationBuilder,
  table: string,
  constraintName: string,
  column: string,
  refTable: string,
  refColumn: string,
  onDelete: string = 'CASCADE'
): void {
  pgm.sql(`
    DO $$ BEGIN
      ALTER TABLE "${table}" ADD CONSTRAINT "${constraintName}"
        FOREIGN KEY ("${column}") REFERENCES "${refTable}"("${refColumn}") ON DELETE ${onDelete};
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ============================================================================
  // API Keys Table
  // ============================================================================
  pgm.createTable('api_keys', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    organization_id: {
      type: 'uuid',
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    key_hash: {
      type: 'varchar(255)',
      notNull: true,
    },
    key_prefix: {
      type: 'varchar(20)',
      notNull: true,
    },
    scopes: {
      type: 'text[]',
      default: pgm.func("ARRAY[]::text[]"),
    },
    rate_limit: {
      type: 'integer',
      default: 100,
    },
    rate_limit_window: {
      type: 'integer',
      default: 60,
    },
    burst_limit: {
      type: 'integer',
      default: 20,
    },
    burst_window: {
      type: 'integer',
      default: 10,
    },
    last_used_at: {
      type: 'timestamptz',
    },
    expires_at: {
      type: 'timestamptz',
    },
    created_by: {
      type: 'uuid',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    revoked_at: {
      type: 'timestamptz',
    },
  }, { ifNotExists: true });

  // Ensure all columns exist if table was pre-created with different schema
  ensureColumns(pgm, 'api_keys', [
    { name: 'organization_id', type: 'uuid' },
    { name: 'name', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'key_hash', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'key_prefix', type: 'varchar(20)', notNull: true, default: "''" },
    { name: 'scopes', type: 'text[]', default: "ARRAY[]::text[]" },
    { name: 'rate_limit', type: 'integer', default: '100' },
    { name: 'rate_limit_window', type: 'integer', default: '60' },
    { name: 'burst_limit', type: 'integer', default: '20' },
    { name: 'burst_window', type: 'integer', default: '10' },
    { name: 'last_used_at', type: 'timestamptz' },
    { name: 'expires_at', type: 'timestamptz' },
    { name: 'created_by', type: 'uuid' },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'revoked_at', type: 'timestamptz' },
  ]);

  ensureForeignKey(pgm, 'api_keys', 'api_keys_organization_id_fkey', 'organization_id', 'organizations', 'id', 'CASCADE');

  pgm.createIndex('api_keys', 'organization_id', { ifNotExists: true, name: 'idx_api_keys_org' });
  pgm.createIndex('api_keys', 'key_prefix', { ifNotExists: true, name: 'idx_api_keys_prefix' });
  pgm.createIndex('api_keys', 'key_hash', { ifNotExists: true, name: 'idx_api_keys_hash' });

  // ============================================================================
  // Sessions Table
  // ============================================================================
  pgm.createTable('sessions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    token_hash: {
      type: 'text',
      notNull: true,
    },
    device: {
      type: 'varchar(100)',
    },
    browser: {
      type: 'varchar(100)',
    },
    ip_address: {
      type: 'varchar(45)',
    },
    last_active: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    expires_at: {
      type: 'timestamptz',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'sessions', [
    { name: 'user_id', type: 'uuid' },
    { name: 'token_hash', type: 'text', notNull: true, default: "''" },
    { name: 'device', type: 'varchar(100)' },
    { name: 'browser', type: 'varchar(100)' },
    { name: 'ip_address', type: 'varchar(45)' },
    { name: 'last_active', type: 'timestamptz', default: 'NOW()' },
    { name: 'expires_at', type: 'timestamptz' },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  ensureForeignKey(pgm, 'sessions', 'sessions_user_id_fkey', 'user_id', 'users', 'id', 'CASCADE');

  pgm.createIndex('sessions', 'user_id', { ifNotExists: true, name: 'idx_sessions_user' });
  pgm.createIndex('sessions', 'token_hash', { ifNotExists: true, name: 'idx_sessions_token' });
  pgm.createIndex('sessions', 'expires_at', { ifNotExists: true, name: 'idx_sessions_expires' });

  // ============================================================================
  // Token Blacklist Table
  // ============================================================================
  pgm.createTable('token_blacklist', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    token_hash: {
      type: 'text',
      notNull: true,
      unique: true,
    },
    expires_at: {
      type: 'timestamptz',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'token_blacklist', [
    { name: 'token_hash', type: 'text', notNull: true, default: "''" },
    { name: 'expires_at', type: 'timestamptz' },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  pgm.createIndex('token_blacklist', 'expires_at', { ifNotExists: true, name: 'idx_token_blacklist_expires' });

  // ============================================================================
  // Reset Tokens Table
  // ============================================================================
  pgm.createTable('reset_tokens', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    token_hash: {
      type: 'text',
      notNull: true,
      unique: true,
    },
    user_email: {
      type: 'varchar(255)',
      notNull: true,
    },
    expires_at: {
      type: 'timestamptz',
      notNull: true,
    },
    used_at: {
      type: 'timestamptz',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'reset_tokens', [
    { name: 'token_hash', type: 'text', notNull: true, default: "''" },
    { name: 'user_email', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'expires_at', type: 'timestamptz' },
    { name: 'used_at', type: 'timestamptz' },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  pgm.createIndex('reset_tokens', 'user_email', { ifNotExists: true, name: 'idx_reset_tokens_email' });
  pgm.createIndex('reset_tokens', 'expires_at', { ifNotExists: true, name: 'idx_reset_tokens_expires' });

  // ============================================================================
  // Refresh Tokens Table
  // ============================================================================
  pgm.createTable('refresh_tokens', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    token_hash: {
      type: 'varchar(64)',
      notNull: true,
      unique: true,
    },
    user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    expires_at: {
      type: 'timestamptz',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    revoked_at: {
      type: 'timestamptz',
    },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'refresh_tokens', [
    { name: 'token_hash', type: 'varchar(64)', notNull: true, default: "''" },
    { name: 'user_id', type: 'uuid' },
    { name: 'expires_at', type: 'timestamptz' },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
    { name: 'revoked_at', type: 'timestamptz' },
  ]);

  ensureForeignKey(pgm, 'refresh_tokens', 'refresh_tokens_user_id_fkey', 'user_id', 'users', 'id', 'CASCADE');

  pgm.createIndex('refresh_tokens', 'user_id', { ifNotExists: true, name: 'idx_refresh_tokens_user' });
  pgm.createIndex('refresh_tokens', 'expires_at', { ifNotExists: true, name: 'idx_refresh_tokens_expires' });

  // ============================================================================
  // Invitations Table
  // ============================================================================
  pgm.createTable('invitations', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    organization_id: {
      type: 'uuid',
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
    },
    role: {
      type: 'varchar(50)',
      notNull: true,
    },
    invited_by: {
      type: 'uuid',
    },
    token_hash: {
      type: 'text',
      notNull: true,
      unique: true,
    },
    expires_at: {
      type: 'timestamptz',
      notNull: true,
    },
    accepted_at: {
      type: 'timestamptz',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  }, { ifNotExists: true });

  ensureColumns(pgm, 'invitations', [
    { name: 'organization_id', type: 'uuid' },
    { name: 'email', type: 'varchar(255)', notNull: true, default: "''" },
    { name: 'role', type: 'varchar(50)', notNull: true, default: "''" },
    { name: 'invited_by', type: 'uuid' },
    { name: 'token_hash', type: 'text', notNull: true, default: "''" },
    { name: 'expires_at', type: 'timestamptz' },
    { name: 'accepted_at', type: 'timestamptz' },
    { name: 'created_at', type: 'timestamptz', notNull: true, default: 'NOW()' },
  ]);

  ensureForeignKey(pgm, 'invitations', 'invitations_organization_id_fkey', 'organization_id', 'organizations', 'id', 'CASCADE');

  pgm.createIndex('invitations', 'organization_id', { ifNotExists: true, name: 'idx_invitations_org' });
  pgm.createIndex('invitations', 'email', { ifNotExists: true, name: 'idx_invitations_email' });
  pgm.createIndex('invitations', 'expires_at', { ifNotExists: true, name: 'idx_invitations_expires' });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop tables in reverse order
  pgm.dropTable('invitations', { ifExists: true, cascade: true });
  pgm.dropTable('refresh_tokens', { ifExists: true, cascade: true });
  pgm.dropTable('reset_tokens', { ifExists: true, cascade: true });
  pgm.dropTable('token_blacklist', { ifExists: true, cascade: true });
  pgm.dropTable('sessions', { ifExists: true, cascade: true });
  pgm.dropTable('api_keys', { ifExists: true, cascade: true });
}
