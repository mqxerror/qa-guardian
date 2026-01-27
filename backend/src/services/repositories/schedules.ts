/**
 * Schedules Repository - PostgreSQL persistence
 *
 * Feature #2092: Migrate Schedules Module to PostgreSQL
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

// Memory fallback store
const memorySchedules: Map<string, Schedule> = new Map();

// ============================================
// Memory Store Accessor (for backward compatibility)
// ============================================

export function getMemorySchedules(): Map<string, Schedule> {
  return memorySchedules;
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
  // Memory fallback
  memorySchedules.set(schedule.id, schedule);
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
  return memorySchedules.get(scheduleId);
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

  // Memory fallback
  const existing = memorySchedules.get(scheduleId);
  if (!existing) return undefined;

  const updated: Schedule = {
    ...existing,
    ...updates,
    updated_at: new Date(),
  };
  memorySchedules.set(scheduleId, updated);
  return updated;
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
  return memorySchedules.delete(scheduleId);
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

  // Memory fallback
  return Array.from(memorySchedules.values())
    .filter(s => s.organization_id === organizationId)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
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

  // Memory fallback
  return Array.from(memorySchedules.values())
    .filter(s => s.enabled)
    .sort((a, b) => {
      if (!a.next_run_at) return 1;
      if (!b.next_run_at) return -1;
      return a.next_run_at.getTime() - b.next_run_at.getTime();
    });
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

  // Memory fallback
  return Array.from(memorySchedules.values())
    .filter(s => s.suite_id === suiteId)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
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

  if (organizationId) {
    return Array.from(memorySchedules.values()).filter(s => s.organization_id === organizationId).length;
  }
  return memorySchedules.size;
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

  // Memory fallback
  return Array.from(memorySchedules.values())
    .filter(s => s.enabled && s.next_run_at && s.next_run_at <= now)
    .sort((a, b) => {
      if (!a.next_run_at) return 1;
      if (!b.next_run_at) return -1;
      return a.next_run_at.getTime() - b.next_run_at.getTime();
    });
}
