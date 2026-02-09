/**
 * Monitoring Incidents Repository - Database CRUD operations for incident entities
 *
 * Feature #250: Extracted from monitoring.ts (1499 lines) for better organization.
 *
 * This module handles incident and operations data including:
 * - Check incidents (active and historical)
 * - Consecutive failures tracking
 * - Maintenance windows
 */

import { query, isDatabaseConnected } from '../database.js';
import {
  Incident,
  MaintenanceWindow,
} from '../../routes/monitoring/types.js';
// Feature #510: Safe JSON parsing for DB row columns
import { safeJsonParseOrPassthrough } from '../../utils/index.js';

// =============================
// Feature #210: Explicit Column Lists (Replace SELECT *)
// =============================

/** Columns for check_incidents table */
const CHECK_INCIDENT_COLUMNS = `
  id, check_id, status, started_at, ended_at, duration_seconds, error, affected_locations
`.trim().replace(/\s+/g, ' ');

// ============================================
// Feature #462: Row interfaces to eliminate : any types
// ============================================

interface IncidentRow {
  id: string;
  check_id: string;
  status: string;
  started_at: string | Date;
  ended_at: string | Date | null;
  duration_seconds: number | null;
  error: string | null;
  affected_locations: string | string[];
}

interface MaintenanceWindowRow {
  id: string;
  check_id: string;
  name: string;
  start_time: string | Date;
  end_time: string | Date;
  reason: string | null;
  created_by: string;
  created_at: string | Date;
}

interface ConsecutiveFailuresRow {
  consecutive_failures: number;
}

// =============================
// INCIDENTS CRUD
// =============================

export async function createIncident(incident: Incident): Promise<Incident> {
  if (isDatabaseConnected()) {
    const result = await query<IncidentRow>(
      `INSERT INTO check_incidents (
        id, check_id, status, started_at, ended_at, duration_seconds, error, affected_locations
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        incident.id, incident.check_id, incident.status, incident.started_at,
        incident.ended_at, incident.duration_seconds, incident.error,
        JSON.stringify(incident.affected_locations)
      ]
    );
    if (result && result.rows[0]) {
      return parseIncidentRow(result.rows[0]);
    }
  }
  // No DB fallback - require PostgreSQL
  throw new Error('[Monitoring Repo] Database not connected - cannot create incident');
}

export async function getActiveIncident(checkId: string): Promise<Incident | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<IncidentRow>(
      `SELECT ${CHECK_INCIDENT_COLUMNS} FROM check_incidents WHERE check_id = $1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1`,
      [checkId]
    );
    if (result && result.rows[0]) {
      return parseIncidentRow(result.rows[0]);
    }
    return undefined;
  }
  return undefined;
}

export async function setActiveIncident(checkId: string, incident: Incident): Promise<void> {
  if (isDatabaseConnected()) {
    // Just create/update the incident in database
    await createIncident(incident);
    return;
  }
  // No memory fallback
}

export async function clearActiveIncident(_checkId: string): Promise<void> {
  if (isDatabaseConnected()) {
    // In DB, we resolve incidents by setting ended_at
    // The incident should already be resolved before calling this
    return;
  }
  // No memory fallback
}

export async function resolveIncident(incidentId: string, endedAt: Date): Promise<Incident | undefined> {
  if (isDatabaseConnected()) {
    // Calculate duration
    const existing = await query<IncidentRow>(
      `SELECT ${CHECK_INCIDENT_COLUMNS} FROM check_incidents WHERE id = $1`,
      [incidentId]
    );
    if (!existing || !existing.rows[0]) return undefined;

    const startedAt = new Date(existing.rows[0].started_at);
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

    const result = await query<IncidentRow>(
      `UPDATE check_incidents SET ended_at = $2, duration_seconds = $3 WHERE id = $1 RETURNING *`,
      [incidentId, endedAt, durationSeconds]
    );
    if (result && result.rows[0]) {
      return parseIncidentRow(result.rows[0]);
    }
    return undefined;
  }
  // No memory fallback
  return undefined;
}

export async function getCheckIncidents(checkId: string): Promise<Incident[]> {
  if (isDatabaseConnected()) {
    const result = await query<IncidentRow>(
      `SELECT ${CHECK_INCIDENT_COLUMNS} FROM check_incidents WHERE check_id = $1 ORDER BY started_at DESC`,
      [checkId]
    );
    if (result) {
      return result.rows.map(parseIncidentRow);
    }
    return [];
  }
  return [];
}

function parseIncidentRow(row: IncidentRow): Incident {
  return {
    id: row.id,
    check_id: row.check_id,
    status: row.status as Incident['status'],
    started_at: new Date(row.started_at),
    ended_at: row.ended_at ? new Date(row.ended_at) : undefined,
    duration_seconds: row.duration_seconds ?? undefined,
    error: row.error ?? undefined,
    affected_locations: safeJsonParseOrPassthrough(row.affected_locations, [] as string[]),
  };
}


// =============================
// CONSECUTIVE FAILURES TRACKING
// =============================

export async function getConsecutiveFailures(checkId: string): Promise<number> {
  if (isDatabaseConnected()) {
    const result = await query<ConsecutiveFailuresRow>(
      `SELECT consecutive_failures FROM uptime_check_state WHERE check_id = $1`,
      [checkId]
    );
    if (result && result.rows[0]) {
      return result.rows[0].consecutive_failures || 0;
    }
    return 0;
  }
  return 0;
}

export async function setConsecutiveFailures(checkId: string, count: number): Promise<void> {
  if (isDatabaseConnected()) {
    await query(
      `INSERT INTO uptime_check_state (check_id, consecutive_failures, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (check_id) DO UPDATE SET consecutive_failures = $2, updated_at = NOW()`,
      [checkId, count]
    );
    return;
  }
  // No memory fallback
}


// =============================
// MAINTENANCE WINDOWS CRUD
// =============================

export async function createMaintenanceWindow(window: MaintenanceWindow): Promise<MaintenanceWindow> {
  if (isDatabaseConnected()) {
    const result = await query<MaintenanceWindowRow>(
      `INSERT INTO maintenance_windows (id, check_id, name, start_time, end_time, reason, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [window.id, window.check_id, window.name, window.start_time, window.end_time, window.reason, window.created_by, window.created_at]
    );
    if (result && result.rows[0]) {
      return parseMaintenanceWindowRow(result.rows[0]);
    }
  }
  // No DB fallback - require PostgreSQL
  throw new Error('[Monitoring Repo] Database not connected - cannot create maintenance window');
}

export async function getMaintenanceWindows(checkId: string): Promise<MaintenanceWindow[]> {
  if (isDatabaseConnected()) {
    const result = await query<MaintenanceWindowRow>(
      `SELECT * FROM maintenance_windows WHERE check_id = $1 ORDER BY start_time DESC`,
      [checkId]
    );
    if (result) {
      return result.rows.map(parseMaintenanceWindowRow);
    }
    return [];
  }
  return [];
}

export async function deleteMaintenanceWindow(windowId: string): Promise<boolean> {
  if (isDatabaseConnected()) {
    const result = await query(
      `DELETE FROM maintenance_windows WHERE id = $1`,
      [windowId]
    );
    return result !== null && (result.rowCount ?? 0) > 0;
  }
  return false;
}

function parseMaintenanceWindowRow(row: MaintenanceWindowRow): MaintenanceWindow {
  return {
    id: row.id,
    check_id: row.check_id,
    name: row.name,
    start_time: new Date(row.start_time),
    end_time: new Date(row.end_time),
    reason: row.reason ?? undefined,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
  };
}
