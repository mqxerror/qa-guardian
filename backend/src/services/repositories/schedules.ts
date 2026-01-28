/**
 * Schedules Repository - PostgreSQL persistence
 *
 * Feature #2092: Migrate Schedules Module to PostgreSQL
 * Feature #2110: Remove in-memory Map stores (DB-only migration)
 *
 * Provides CRUD operations for:
 * - Test schedules with cron expressions or one-time runs
 */

import { query, isDatabaseConnected } from '../database';

// Schedule interface matching the original
export interface Schedule {
  id: string;
  organization_id: string;
  suite_id: string;
  name: string;
  description?: string;
  cron_expression?: string;
  run_at?: Date;
  timezone: string;
  enabled: boolean;
  browsers: ('chromium' | 'firefox' | 'webkit')[];
  notify_on_failure: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  next_run_at?: Date;
  last_run_id?: string;
  run_count: number;
}

// ============================================
// Deprecated Memory Store Accessor
// ============================================

/** @deprecated Feature #2110: Memory stores removed. Returns empty Map. Use DB queries instead. */
export function getMemorySchedules(): Map<string, Schedule> {
  console.warn('[DEPRECATED] getMemorySchedules() called - memory stores removed in Feature #2110. Use DB queries instead.');
  return new Map();
}

// ============================================
// Helper Functions
// ============================================

function parseScheduleRow(row: any): Schedule {
  return {
    id: row.id,
    organization_id: row.organization_id,
    suite_id: row.suite_id,
    name: row.name,
    description: row.description,
    cron_expression: row.cron_expression,
    run_at: row.run_at ? new Date(row.run_at) : undefined,
    timezone: row.timezone || 'UTC',
    enabled: row.enabled,
    browsers: row.browsers || ['chromium'],
    notify_on_failure: row.notify_on_failure ?? true,
    created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    created_by: row.created_by,
    next_run_at: row.next_run_at ? new Date(row.next_run_at) : undefined,
    last_run_id: row.last_run_id,
    run_count: row.run_count || 0,
  };
}

// ============================================
// Schedule CRUD Operations
// ============================================

/**
 * Create a new schedule
 */
export async function createSchedule(schedule: Schedule): Promise<Schedule> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO schedules (
        id, organization_id, suite_id, name, description,
        cron_expression, run_at, timezone, enabled, browsers,
        notify_on_failure, created_at, updated_at, created_by,
        next_run_at, last_run_id, run_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        schedule.id,
        schedule.organization_id,
        schedule.suite_id,
        schedule.name,
        schedule.description || null,
        schedule.cron_expression || null,
        schedule.run_at || null,
        schedule.timezone,
        schedule.enabled,
        JSON.stringify(schedule.browsers),
        schedule.notify_on_failure,
        schedule.created_at,
        schedule.updated_at,
        schedule.created_by,
        schedule.next_run_at || null,
        schedule.last_run_id || null,
        schedule.run_count,
      ]
    );
    if (result && result.rows[0]) {
      return parseScheduleRow(result.rows[0]);
    }
  }
  // DB-only: return schedule as-is if DB unavailable
  return schedule;
}

/**
 * Get a schedule by ID
 */
export async function getSchedule(scheduleId: string): Promise<Schedule | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM schedules WHERE id = $1',
      [scheduleId]
    );
    if (result && result.rows[0]) {
      return parseScheduleRow(result.rows[0]);
    }
    return undefined;
  }
  return undefined;
}

/**
 * Update a schedule
 */
export async function updateSchedule(
  scheduleId: string,
  updates: Partial<Schedule>
): Promise<Schedule | undefined> {
  if (isDatabaseConnected()) {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.cron_expression !== undefined) {
      setClauses.push(`cron_expression = $${paramIndex++}`);
      values.push(updates.cron_expression);
    }
    if (updates.run_at !== undefined) {
      setClauses.push(`run_at = $${paramIndex++}`);
      values.push(updates.run_at);
    }
    if (updates.timezone !== undefined) {
      setClauses.push(`timezone = $${paramIndex++}`);
      values.push(updates.timezone);
    }
    if (updates.enabled !== undefined) {
      setClauses.push(`enabled = $${paramIndex++}`);
      values.push(updates.enabled);
    }
    if (updates.browsers !== undefined) {
      setClauses.push(`browsers = $${paramIndex++}`);
      values.push(JSON.stringify(updates.browsers));
    }
    if (updates.notify_on_failure !== undefined) {
      setClauses.push(`notify_on_failure = $${paramIndex++}`);
      values.push(updates.notify_on_failure);
    }
    if (updates.next_run_at !== undefined) {
      setClauses.push(`next_run_at = $${paramIndex++}`);
      values.push(updates.next_run_at);
    }
    if (updates.last_run_id !== undefined) {
      setClauses.push(`last_run_id = $${paramIndex++}`);
      values.push(updates.last_run_id);
    }
    if (updates.run_count !== undefined) {
      setClauses.push(`run_count = $${paramIndex++}`);
      values.push(updates.run_count);
    }

    if (setClauses.length === 0) {
      return getSchedule(scheduleId);
    }

    // Always update updated_at
    setClauses.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());

    values.push(scheduleId);
    const result = await query<any>(
      `UPDATE schedules SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    if (result && result.rows[0]) {
      return parseScheduleRow(result.rows[0]);
    }
    return undefined;
  }

  // DB-only: return undefined when DB unavailable
  return undefined;
}

/**
 * Delete a schedule
 */
export async function deleteSchedule(scheduleId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      'DELETE FROM schedules WHERE id = $1',
      [scheduleId]
    );
    return (result?.rowCount ?? 0) > 0;
  }
  return false;
}

/**
 * List schedules for an organization
 */
export async function listSchedules(organizationId: string): Promise<Schedule[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM schedules WHERE organization_id = $1 ORDER BY created_at DESC',
      [organizationId]
    );
    if (result) {
      return result.rows.map(parseScheduleRow);
    }
    return [];
  }

  // DB-only: return empty when DB unavailable
  return [];
}

/**
 * Get all enabled schedules (for scheduler startup)
 */
export async function getEnabledSchedules(): Promise<Schedule[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM schedules WHERE enabled = true ORDER BY next_run_at ASC NULLS LAST',
      []
    );
    if (result) {
      return result.rows.map(parseScheduleRow);
    }
    return [];
  }

  // DB-only: return empty when DB unavailable
  return [];
}

/**
 * Get schedules by suite ID
 */
export async function getSchedulesBySuiteId(suiteId: string): Promise<Schedule[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM schedules WHERE suite_id = $1 ORDER BY created_at DESC',
      [suiteId]
    );
    if (result) {
      return result.rows.map(parseScheduleRow);
    }
    return [];
  }

  // DB-only: return empty when DB unavailable
  return [];
}

/**
 * Get schedule count for an organization
 */
export async function getScheduleCount(organizationId?: string): Promise<number> {
  if (isDatabaseConnected()) {
    let sql = 'SELECT COUNT(*) as count FROM schedules';
    const params: any[] = [];

    if (organizationId) {
      sql += ' WHERE organization_id = $1';
      params.push(organizationId);
    }

    const result = await query<any>(sql, params);
    if (result && result.rows[0]) {
      return parseInt(result.rows[0].count, 10);
    }
    return 0;
  }

  // DB-only: return 0 when DB unavailable
  return 0;
}

/**
 * Get schedules due to run (for scheduler)
 */
export async function getSchedulesDueToRun(): Promise<Schedule[]> {
  const now = new Date();

  if (isDatabaseConnected()) {
    const result = await query<any>(
      `SELECT * FROM schedules
       WHERE enabled = true
       AND next_run_at IS NOT NULL
       AND next_run_at <= $1
       ORDER BY next_run_at ASC`,
      [now]
    );
    if (result) {
      return result.rows.map(parseScheduleRow);
    }
    return [];
  }

  // DB-only: return empty when DB unavailable
  return [];
}
