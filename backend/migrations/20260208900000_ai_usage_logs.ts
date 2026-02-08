/**
 * Migration: AI Usage Logs Table
 * Feature #477: Persist AI usage statistics to PostgreSQL for cost tracking
 *
 * Creates table for:
 * - ai_usage_logs: Tracks AI API calls with token counts and costs per organization
 *
 * NOTE: All operations are idempotent. Uses CREATE TABLE IF NOT EXISTS.
 */

import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // ============================================================================
  // AI Usage Logs Table - Feature #477
  // Tracks all AI API calls for billing and usage analytics
  // ============================================================================
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS ai_usage_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      model TEXT NOT NULL,
      provider TEXT NOT NULL,
      feature TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
      cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0,
      success BOOLEAN NOT NULL DEFAULT true,
      error_message TEXT,
      latency_ms INTEGER,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  // Add indexes for common query patterns
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_org_created
    ON ai_usage_logs(organization_id, created_at DESC);
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at
    ON ai_usage_logs(created_at DESC);
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_feature
    ON ai_usage_logs(feature, created_at DESC);
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_model
    ON ai_usage_logs(model, created_at DESC);
  `);

  // ============================================================================
  // AI Usage Budget Table - Feature #477
  // Stores budget thresholds for alerting
  // ============================================================================
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS ai_usage_budgets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
      daily_limit_usd DECIMAL(10, 2),
      monthly_limit_usd DECIMAL(10, 2),
      alert_threshold_percent INTEGER DEFAULT 80,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  // ============================================================================
  // AI Usage Alert History - Feature #477
  // Tracks when budget alerts were sent
  // ============================================================================
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS ai_usage_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      alert_type TEXT NOT NULL,
      threshold_percent INTEGER NOT NULL,
      current_usage_usd DECIMAL(10, 6) NOT NULL,
      limit_usd DECIMAL(10, 2) NOT NULL,
      period_start TIMESTAMP WITH TIME ZONE NOT NULL,
      period_end TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_ai_usage_alerts_org_created
    ON ai_usage_alerts(organization_id, created_at DESC);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TABLE IF EXISTS ai_usage_alerts CASCADE;');
  pgm.sql('DROP TABLE IF EXISTS ai_usage_budgets CASCADE;');
  pgm.sql('DROP TABLE IF EXISTS ai_usage_logs CASCADE;');
}
