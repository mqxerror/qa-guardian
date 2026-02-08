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
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

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
