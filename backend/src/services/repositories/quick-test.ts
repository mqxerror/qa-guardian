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

// ============================================
// Quick Test Comparisons (Feature #670)
// ============================================

export interface QuickTestComparison {
  id: string;
  organizationId: string;
  runIdA: string;
  runIdB: string;
  createdAt: Date;
  expiresAt: Date;
}

interface QuickTestComparisonRow {
  id: string;
  organization_id: string;
  run_id_a: string;
  run_id_b: string;
  created_at: Date;
  expires_at: Date;
}

function rowToQuickTestComparison(row: QuickTestComparisonRow): QuickTestComparison {
  return {
    id: row.id,
    organizationId: row.organization_id,
    runIdA: row.run_id_a,
    runIdB: row.run_id_b,
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
  };
}

/**
 * Create a quick test comparison mapping
 * Feature #670: Persist compareRunMap to database
 */
export async function createQuickTestComparison(
  compareId: string,
  organizationId: string,
  runIdA: string,
  runIdB: string
): Promise<QuickTestComparison | null> {
  if (!isDatabaseConnected()) {
    logger.warn({ compareId }, '[QuickTestRepo] Database not connected, cannot persist comparison');
    return null;
  }

  try {
    const result = await query<QuickTestComparisonRow>(
      `INSERT INTO quick_test_comparisons (id, organization_id, run_id_a, run_id_b, created_at, expires_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '24 hours')
       RETURNING id, organization_id, run_id_a, run_id_b, created_at, expires_at`,
      [compareId, organizationId, runIdA, runIdB]
    );

    if (!result || result.rows.length === 0) {
      return null;
    }

    logger.info({ compareId, runIdA, runIdB }, '[QuickTestRepo] Created quick test comparison');
    return rowToQuickTestComparison(result.rows[0]);
  } catch (error) {
    logger.error({ error, compareId }, '[QuickTestRepo] Failed to create quick test comparison');
    return null;
  }
}

/**
 * Get a quick test comparison by ID
 * Feature #670: Persist compareRunMap to database
 */
export async function getQuickTestComparison(compareId: string): Promise<QuickTestComparison | null> {
  if (!isDatabaseConnected()) {
    return null;
  }

  try {
    const result = await query<QuickTestComparisonRow>(
      `SELECT id, organization_id, run_id_a, run_id_b, created_at, expires_at
       FROM quick_test_comparisons
       WHERE id = $1 AND expires_at > NOW()`,
      [compareId]
    );

    if (!result || result.rows.length === 0) {
      return null;
    }

    return rowToQuickTestComparison(result.rows[0]);
  } catch (error) {
    logger.error({ error, compareId }, '[QuickTestRepo] Failed to get quick test comparison');
    return null;
  }
}

/**
 * Delete expired quick test comparisons
 * Feature #670: TTL cleanup for comparisons (replaces setTimeout)
 */
export async function deleteExpiredQuickTestComparisons(): Promise<number> {
  if (!isDatabaseConnected()) {
    return 0;
  }

  try {
    const result = await query(
      `DELETE FROM quick_test_comparisons WHERE expires_at < NOW()`
    );

    const deletedCount = result?.rowCount ?? 0;
    if (deletedCount > 0) {
      logger.info({ deletedCount }, '[QuickTestRepo] Deleted expired quick test comparisons');
    }

    return deletedCount;
  } catch (error) {
    logger.error({ error }, '[QuickTestRepo] Failed to delete expired comparisons');
    return 0;
  }
}

// ============================================
// Quick Test Schedules (Feature #671)
// ============================================

export interface QuickTestSchedule {
  id: string;
  organizationId: string;
  userId: string;
  url: string;
  name: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  notifyOnScoreDrop: boolean;
  scoreThreshold: number;
  createdAt: Date;
  updatedAt: Date;
  nextRunAt: Date | null;
  lastRunId: string | null;
  lastRunAt: Date | null;
  runCount: number;
}

interface QuickTestScheduleRow {
  id: string;
  organization_id: string;
  user_id: string;
  url: string;
  name: string;
  cron_expression: string;
  timezone: string;
  enabled: boolean;
  notify_on_score_drop: boolean;
  score_threshold: number;
  created_at: Date;
  updated_at: Date;
  next_run_at: Date | null;
  last_run_id: string | null;
  last_run_at: Date | null;
  run_count: number;
}

const QUICK_TEST_SCHEDULE_COLUMNS = `
  id, organization_id, user_id, url, name, cron_expression, timezone,
  enabled, notify_on_score_drop, score_threshold, created_at, updated_at,
  next_run_at, last_run_id, last_run_at, run_count
`;

function rowToQuickTestSchedule(row: QuickTestScheduleRow): QuickTestSchedule {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    url: row.url,
    name: row.name,
    cronExpression: row.cron_expression,
    timezone: row.timezone,
    enabled: row.enabled,
    notifyOnScoreDrop: row.notify_on_score_drop,
    scoreThreshold: row.score_threshold,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    nextRunAt: row.next_run_at ? new Date(row.next_run_at) : null,
    lastRunId: row.last_run_id,
    lastRunAt: row.last_run_at ? new Date(row.last_run_at) : null,
    runCount: row.run_count,
  };
}

/**
 * Create a quick test schedule
 * Feature #671: Persist quick test schedules
 */
export async function createQuickTestSchedule(params: {
  organizationId: string;
  userId: string;
  url: string;
  name: string;
  cronExpression: string;
  timezone?: string;
  notifyOnScoreDrop?: boolean;
  scoreThreshold?: number;
}): Promise<QuickTestSchedule | null> {
  if (!isDatabaseConnected()) {
    logger.warn('[QuickTestRepo] Database not connected, cannot create schedule');
    return null;
  }

  const {
    organizationId,
    userId,
    url,
    name,
    cronExpression,
    timezone = 'UTC',
    notifyOnScoreDrop = false,
    scoreThreshold = 80,
  } = params;

  try {
    // Calculate next run time (simplified - in production would use a cron parser)
    const nextRunAt = calculateNextRunFromCron(cronExpression);

    const result = await query<QuickTestScheduleRow>(
      `INSERT INTO quick_test_schedules (
        organization_id, user_id, url, name, cron_expression, timezone,
        notify_on_score_drop, score_threshold, next_run_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING ${QUICK_TEST_SCHEDULE_COLUMNS}`,
      [organizationId, userId, url, name, cronExpression, timezone, notifyOnScoreDrop, scoreThreshold, nextRunAt]
    );

    if (!result || result.rows.length === 0) {
      return null;
    }

    logger.info({ scheduleId: result.rows[0].id, url, cronExpression }, '[QuickTestRepo] Created quick test schedule');
    return rowToQuickTestSchedule(result.rows[0]);
  } catch (error) {
    logger.error({ error, url }, '[QuickTestRepo] Failed to create quick test schedule');
    return null;
  }
}

/**
 * Get a quick test schedule by ID
 * Feature #671: Persist quick test schedules
 */
export async function getQuickTestScheduleById(id: string): Promise<QuickTestSchedule | null> {
  if (!isDatabaseConnected()) {
    return null;
  }

  try {
    const result = await query<QuickTestScheduleRow>(
      `SELECT ${QUICK_TEST_SCHEDULE_COLUMNS} FROM quick_test_schedules WHERE id = $1`,
      [id]
    );

    if (!result || result.rows.length === 0) {
      return null;
    }

    return rowToQuickTestSchedule(result.rows[0]);
  } catch (error) {
    logger.error({ error, id }, '[QuickTestRepo] Failed to get quick test schedule by id');
    return null;
  }
}

/**
 * List quick test schedules for an organization
 * Feature #671: Persist quick test schedules
 */
export async function listQuickTestSchedules(
  organizationId: string,
  options?: { enabled?: boolean; limit?: number; offset?: number }
): Promise<{ schedules: QuickTestSchedule[]; total: number }> {
  if (!isDatabaseConnected()) {
    return { schedules: [], total: 0 };
  }

  const { enabled, limit = 50, offset = 0 } = options || {};

  try {
    let whereClause = 'organization_id = $1';
    const params: unknown[] = [organizationId];
    let paramIndex = 2;

    if (enabled !== undefined) {
      whereClause += ` AND enabled = $${paramIndex}`;
      params.push(enabled);
      paramIndex++;
    }

    // Get total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM quick_test_schedules WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.rows[0]?.count || '0', 10);

    // Get schedules
    const result = await query<QuickTestScheduleRow>(
      `SELECT ${QUICK_TEST_SCHEDULE_COLUMNS} FROM quick_test_schedules
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      schedules: result?.rows.map(rowToQuickTestSchedule) || [],
      total,
    };
  } catch (error) {
    logger.error({ error, organizationId }, '[QuickTestRepo] Failed to list quick test schedules');
    return { schedules: [], total: 0 };
  }
}

/**
 * Update a quick test schedule
 * Feature #671: Persist quick test schedules
 */
export async function updateQuickTestSchedule(
  id: string,
  updates: Partial<{
    name: string;
    cronExpression: string;
    timezone: string;
    enabled: boolean;
    notifyOnScoreDrop: boolean;
    scoreThreshold: number;
  }>
): Promise<QuickTestSchedule | null> {
  if (!isDatabaseConnected()) {
    return null;
  }

  try {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      params.push(updates.name);
      paramIndex++;
    }
    if (updates.cronExpression !== undefined) {
      setClauses.push(`cron_expression = $${paramIndex}`);
      params.push(updates.cronExpression);
      paramIndex++;
      // Recalculate next run
      setClauses.push(`next_run_at = $${paramIndex}`);
      params.push(calculateNextRunFromCron(updates.cronExpression));
      paramIndex++;
    }
    if (updates.timezone !== undefined) {
      setClauses.push(`timezone = $${paramIndex}`);
      params.push(updates.timezone);
      paramIndex++;
    }
    if (updates.enabled !== undefined) {
      setClauses.push(`enabled = $${paramIndex}`);
      params.push(updates.enabled);
      paramIndex++;
    }
    if (updates.notifyOnScoreDrop !== undefined) {
      setClauses.push(`notify_on_score_drop = $${paramIndex}`);
      params.push(updates.notifyOnScoreDrop);
      paramIndex++;
    }
    if (updates.scoreThreshold !== undefined) {
      setClauses.push(`score_threshold = $${paramIndex}`);
      params.push(updates.scoreThreshold);
      paramIndex++;
    }

    params.push(id);

    const result = await query<QuickTestScheduleRow>(
      `UPDATE quick_test_schedules SET ${setClauses.join(', ')} WHERE id = $${paramIndex}
       RETURNING ${QUICK_TEST_SCHEDULE_COLUMNS}`,
      params
    );

    if (!result || result.rows.length === 0) {
      return null;
    }

    logger.info({ scheduleId: id }, '[QuickTestRepo] Updated quick test schedule');
    return rowToQuickTestSchedule(result.rows[0]);
  } catch (error) {
    logger.error({ error, id }, '[QuickTestRepo] Failed to update quick test schedule');
    return null;
  }
}

/**
 * Delete a quick test schedule
 * Feature #671: Persist quick test schedules
 */
export async function deleteQuickTestSchedule(id: string): Promise<boolean> {
  if (!isDatabaseConnected()) {
    return false;
  }

  try {
    const result = await query(
      `DELETE FROM quick_test_schedules WHERE id = $1`,
      [id]
    );

    const deleted = (result?.rowCount ?? 0) > 0;
    if (deleted) {
      logger.info({ scheduleId: id }, '[QuickTestRepo] Deleted quick test schedule');
    }
    return deleted;
  } catch (error) {
    logger.error({ error, id }, '[QuickTestRepo] Failed to delete quick test schedule');
    return false;
  }
}

/**
 * Get all due quick test schedules
 * Feature #684: Quick Test cron scheduler worker
 * Returns schedules where enabled = true AND next_run_at <= NOW()
 */
export async function getDueQuickTestSchedules(): Promise<QuickTestSchedule[]> {
  if (!isDatabaseConnected()) {
    return [];
  }

  try {
    const result = await query<QuickTestScheduleRow>(
      `SELECT ${QUICK_TEST_SCHEDULE_COLUMNS} FROM quick_test_schedules
       WHERE enabled = true AND next_run_at <= NOW()
       ORDER BY next_run_at ASC`
    );

    const schedules = result?.rows.map(rowToQuickTestSchedule) || [];
    if (schedules.length > 0) {
      logger.info({ count: schedules.length }, '[QuickTestRepo] Found due quick test schedules');
    }
    return schedules;
  } catch (error) {
    logger.error({ error }, '[QuickTestRepo] Failed to get due quick test schedules');
    return [];
  }
}

/**
 * Mark a schedule as run and update next run time
 * Feature #684: Quick Test cron scheduler worker
 * Updates last_run_at, last_run_id, next_run_at, and increments run_count
 */
export async function markScheduleRun(scheduleId: string, runId: string, cronExpression: string): Promise<QuickTestSchedule | null> {
  if (!isDatabaseConnected()) {
    return null;
  }

  try {
    const nextRunAt = calculateNextRunFromCron(cronExpression);

    const result = await query<QuickTestScheduleRow>(
      `UPDATE quick_test_schedules
       SET last_run_at = NOW(),
           last_run_id = $1,
           next_run_at = $2,
           run_count = run_count + 1,
           updated_at = NOW()
       WHERE id = $3
       RETURNING ${QUICK_TEST_SCHEDULE_COLUMNS}`,
      [runId, nextRunAt, scheduleId]
    );

    if (!result || result.rows.length === 0) {
      return null;
    }

    logger.info({ scheduleId, runId, nextRunAt }, '[QuickTestRepo] Marked schedule as run');
    return rowToQuickTestSchedule(result.rows[0]);
  } catch (error) {
    logger.error({ error, scheduleId, runId }, '[QuickTestRepo] Failed to mark schedule as run');
    return null;
  }
}

/**
 * Calculate next run time from cron expression
 * Simplified implementation - in production would use a proper cron parser like cron-parser
 */
function calculateNextRunFromCron(cronExpression: string): Date {
  const now = new Date();

  // Simple mapping for common patterns
  if (cronExpression === '0 * * * *') {
    // Hourly - next hour
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return next;
  }
  if (cronExpression === '0 0 * * *') {
    // Daily at midnight
    const next = new Date(now);
    next.setHours(0, 0, 0, 0);
    next.setDate(next.getDate() + 1);
    return next;
  }
  if (cronExpression === '0 9 * * 1') {
    // Weekly on Monday at 9 AM
    const next = new Date(now);
    next.setHours(9, 0, 0, 0);
    const daysUntilMonday = (8 - next.getDay()) % 7 || 7;
    next.setDate(next.getDate() + daysUntilMonday);
    return next;
  }

  // Default: 1 hour from now
  return new Date(now.getTime() + 60 * 60 * 1000);
}
