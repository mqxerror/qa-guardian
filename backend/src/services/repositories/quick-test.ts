/**
 * Quick Test Repository for PostgreSQL
 *
 * Feature #465: Persist Quick Test results to PostgreSQL database
 *
 * This repository provides database persistence for Quick Test results,
 * replacing the in-memory Map storage for data that survives server restarts.
 */

import { query, isDatabaseConnected } from '../database.js';
import { logger } from '../logger.js';

// ============================================
// Types
// ============================================

export interface QuickTestWaveResult {
  wave: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  data?: Record<string, unknown>;
  error?: string;
}

export interface QuickTestSummary {
  healthScore: number;
  performanceScore: number;
  securityScore: number;
  accessibilityScore: number; // Feature #471
  apiScore: number; // Feature #472
  seoScore: number; // Feature #527
  overallScore: number;
}

export interface QuickTestResult {
  id: string;
  organizationId: string;
  userId: string;
  url: string;
  status: 'running' | 'completed' | 'failed';
  overallScore: number | null;
  healthScore: number | null;
  performanceScore: number | null;
  securityScore: number | null;
  waveScores: QuickTestSummary | null;
  waveResults: QuickTestWaveResult[];
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface QuickTestRow {
  id: string;
  organization_id: string;
  user_id: string;
  url: string;
  status: string;
  overall_score: number | null;
  health_score: number | null;
  performance_score: number | null;
  security_score: number | null;
  wave_scores: Record<string, unknown> | null;
  wave_results: QuickTestWaveResult[] | null;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// Column Constants
// ============================================

const QUICK_TEST_COLUMNS = `
  id, organization_id, user_id, url, status,
  overall_score, health_score, performance_score, security_score,
  wave_scores, wave_results, started_at, completed_at, created_at, updated_at
`;

// ============================================
// Row Mapping
// ============================================

function rowToQuickTestResult(row: QuickTestRow): QuickTestResult {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    url: row.url,
    status: row.status as 'running' | 'completed' | 'failed',
    overallScore: row.overall_score,
    healthScore: row.health_score,
    performanceScore: row.performance_score,
    securityScore: row.security_score,
    waveScores: row.wave_scores as QuickTestSummary | null,
    waveResults: row.wave_results || [],
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ============================================
// Create Functions
// ============================================

export async function createQuickTestResult(
  id: string,
  organizationId: string,
  userId: string,
  url: string,
  waveResults: QuickTestWaveResult[]
): Promise<QuickTestResult | null> {
  if (!isDatabaseConnected()) {
    logger.warn({ runId: id }, '[QuickTestRepo] Database not connected, cannot persist quick test result');
    return null;
  }

  try {
    const result = await query<QuickTestRow>(
      `INSERT INTO quick_test_results (
        id, organization_id, user_id, url, status,
        wave_results, started_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING ${QUICK_TEST_COLUMNS}`,
      [id, organizationId, userId, url, 'running', JSON.stringify(waveResults)]
    );

    if (!result || result.rows.length === 0) {
      return null;
    }

    logger.info({ runId: id, url }, '[QuickTestRepo] Created quick test result');
    return rowToQuickTestResult(result.rows[0]);
  } catch (error) {
    logger.error({ error, runId: id }, '[QuickTestRepo] Failed to create quick test result');
    return null;
  }
}

// ============================================
// Update Functions
// ============================================

export async function updateQuickTestWaves(
  id: string,
  waveResults: QuickTestWaveResult[]
): Promise<boolean> {
  if (!isDatabaseConnected()) {
    return false;
  }

  try {
    const result = await query(
      `UPDATE quick_test_results
       SET wave_results = $2, updated_at = NOW()
       WHERE id = $1`,
      [id, JSON.stringify(waveResults)]
    );

    return (result?.rowCount ?? 0) > 0;
  } catch (error) {
    logger.error({ error, runId: id }, '[QuickTestRepo] Failed to update wave results');
    return false;
  }
}

export async function completeQuickTestResult(
  id: string,
  status: 'completed' | 'failed',
  waveResults: QuickTestWaveResult[],
  summary: QuickTestSummary | null
): Promise<boolean> {
  if (!isDatabaseConnected()) {
    return false;
  }

  try {
    const result = await query(
      `UPDATE quick_test_results
       SET status = $2,
           wave_results = $3,
           wave_scores = $4,
           overall_score = $5,
           health_score = $6,
           performance_score = $7,
           security_score = $8,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        status,
        JSON.stringify(waveResults),
        summary ? JSON.stringify(summary) : null,
        summary?.overallScore ?? null,
        summary?.healthScore ?? null,
        summary?.performanceScore ?? null,
        summary?.securityScore ?? null,
      ]
    );

    if ((result?.rowCount ?? 0) > 0) {
      logger.info({ runId: id, status, overallScore: summary?.overallScore }, '[QuickTestRepo] Completed quick test result');
    }

    return (result?.rowCount ?? 0) > 0;
  } catch (error) {
    logger.error({ error, runId: id }, '[QuickTestRepo] Failed to complete quick test result');
    return false;
  }
}

// ============================================
// Read Functions
// ============================================

export async function getQuickTestResultById(id: string): Promise<QuickTestResult | null> {
  if (!isDatabaseConnected()) {
    return null;
  }

  try {
    const result = await query<QuickTestRow>(
      `SELECT ${QUICK_TEST_COLUMNS} FROM quick_test_results WHERE id = $1`,
      [id]
    );

    if (!result || result.rows.length === 0) {
      return null;
    }

    return rowToQuickTestResult(result.rows[0]);
  } catch (error) {
    logger.error({ error, runId: id }, '[QuickTestRepo] Failed to get quick test result by id');
    return null;
  }
}

export interface QuickTestHistoryOptions {
  organizationId: string;
  limit?: number;
  offset?: number;
  status?: 'running' | 'completed' | 'failed';
  userId?: string;
}

export interface QuickTestHistoryResult {
  results: QuickTestResult[];
  total: number;
  limit: number;
  offset: number;
}

export async function getQuickTestHistory(
  options: QuickTestHistoryOptions
): Promise<QuickTestHistoryResult> {
  const { organizationId, limit = 20, offset = 0, status, userId } = options;

  if (!isDatabaseConnected()) {
    return { results: [], total: 0, limit, offset };
  }

  try {
    // Build WHERE clause dynamically
    const conditions: string[] = ['organization_id = $1'];
    const params: unknown[] = [organizationId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (userId) {
      conditions.push(`user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM quick_test_results WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.rows[0]?.count || '0', 10);

    // Get paginated results
    const resultsQuery = await query<QuickTestRow>(
      `SELECT ${QUICK_TEST_COLUMNS}
       FROM quick_test_results
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      results: resultsQuery?.rows.map(rowToQuickTestResult) || [],
      total,
      limit,
      offset,
    };
  } catch (error) {
    logger.error({ error, organizationId }, '[QuickTestRepo] Failed to get quick test history');
    return { results: [], total: 0, limit, offset };
  }
}

// ============================================
// Delete Functions
// ============================================

export async function deleteOldQuickTestResults(olderThanDays: number = 30): Promise<number> {
  if (!isDatabaseConnected()) {
    return 0;
  }

  try {
    const result = await query(
      `DELETE FROM quick_test_results
       WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
      [olderThanDays]
    );

    const deletedCount = result?.rowCount ?? 0;
    if (deletedCount > 0) {
      logger.info({ deletedCount, olderThanDays }, '[QuickTestRepo] Deleted old quick test results');
    }

    return deletedCount;
  } catch (error) {
    logger.error({ error, olderThanDays }, '[QuickTestRepo] Failed to delete old quick test results');
    return 0;
  }
}
