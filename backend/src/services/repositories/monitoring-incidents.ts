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
  ManagedIncident,
  IncidentNote,
  IncidentTimeline,
  IncidentResponder,
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

/** Columns for managed_incidents table */
const MANAGED_INCIDENT_COLUMNS = `
  id, organization_id, title, description, severity, status, priority, source,
  source_id, source_alert_id, source_check_id, source_check_type, check_ids,
  tags, affected_services, escalation_policy_id, on_call_schedule_id,
  current_escalation_level, resolution_summary, postmortem_url, postmortem_completed,
  created_by, created_at, updated_at, acknowledged_at, resolved_at,
  time_to_acknowledge_seconds, time_to_resolve_seconds
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

// Row interfaces for managed incidents tables
interface ManagedIncidentRow {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  priority: string | null;
  source: string;
  source_id: string | null;
  source_alert_id: string | null;
  source_check_id: string | null;
  source_check_type: string | null;
  check_ids: string | string[] | null;
  tags: string | string[] | null;
  affected_services: string | string[] | null;
  escalation_policy_id: string | null;
  on_call_schedule_id: string | null;
  current_escalation_level: number | null;
  resolution_summary: string | null;
  postmortem_url: string | null;
  postmortem_completed: boolean;
  created_by: string;
  created_at: string | Date;
  updated_at: string | Date;
  acknowledged_at: string | Date | null;
  resolved_at: string | Date | null;
  time_to_acknowledge_seconds: number | null;
  time_to_resolve_seconds: number | null;
}

interface ManagedIncidentNoteRow {
  id: string;
  incident_id: string;
  author_id: string;
  author_name: string;
  content: string;
  visibility: string | null;
  created_at: string | Date;
}

interface ManagedIncidentTimelineRow {
  id: string;
  incident_id: string;
  event_type: string;
  description: string;
  actor_id: string | null;
  actor_name: string | null;
  metadata: string | Record<string, unknown> | null;
  created_at: string | Date;
}

interface ManagedIncidentResponderRow {
  id: string;
  incident_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  role: string;
  assigned_at: string | Date;
  acknowledged_at: string | Date | null;
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


// =============================
// MANAGED INCIDENTS CRUD
// Replaces in-memory managedIncidents and incidentsByOrg Maps
// =============================

/**
 * Create a managed incident with its initial timeline entries.
 * Notes and responders are inserted via separate calls as they are added over time.
 */
export async function createManagedIncident(incident: ManagedIncident): Promise<ManagedIncident> {
  if (!isDatabaseConnected()) {
    throw new Error('[Monitoring Repo] Database not connected - cannot create managed incident');
  }

  const result = await query<ManagedIncidentRow>(
    `INSERT INTO managed_incidents (
      id, organization_id, title, description, severity, status, priority, source,
      source_id, source_alert_id, source_check_id, source_check_type, check_ids,
      tags, affected_services, escalation_policy_id, on_call_schedule_id,
      current_escalation_level, resolution_summary, postmortem_url, postmortem_completed,
      created_by, created_at, updated_at, acknowledged_at, resolved_at,
      time_to_acknowledge_seconds, time_to_resolve_seconds
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
    RETURNING ${MANAGED_INCIDENT_COLUMNS}`,
    [
      incident.id, incident.organization_id, incident.title, incident.description ?? null,
      incident.severity, incident.status, incident.priority ?? null, incident.source,
      incident.source_id ?? null, incident.source_alert_id ?? null,
      incident.source_check_id ?? null, incident.source_check_type ?? null,
      JSON.stringify(incident.check_ids ?? []),
      JSON.stringify(incident.tags ?? []),
      JSON.stringify(incident.affected_services ?? []),
      incident.escalation_policy_id ?? null, incident.on_call_schedule_id ?? null,
      incident.current_escalation_level ?? null,
      incident.resolution_summary ?? null, incident.postmortem_url ?? null,
      incident.postmortem_completed ?? false,
      incident.created_by, incident.created_at, incident.updated_at,
      incident.acknowledged_at ?? null, incident.resolved_at ?? null,
      incident.time_to_acknowledge_seconds ?? null, incident.time_to_resolve_seconds ?? null,
    ]
  );

  if (!result || !result.rows[0]) {
    throw new Error('[Monitoring Repo] Failed to insert managed incident');
  }

  // Insert initial timeline entries (created during incident construction)
  for (const entry of incident.timeline) {
    await insertTimelineEntry(incident.id, entry);
  }

  // Return the full incident with child entities
  return buildManagedIncident(result.rows[0], incident.notes, incident.timeline, incident.responders);
}

/**
 * Get a single managed incident by id, including notes, timeline, and responders.
 */
export async function getManagedIncident(id: string): Promise<ManagedIncident | undefined> {
  if (!isDatabaseConnected()) {
    return undefined;
  }

  const result = await query<ManagedIncidentRow>(
    `SELECT ${MANAGED_INCIDENT_COLUMNS} FROM managed_incidents WHERE id = $1`,
    [id]
  );
  if (!result || !result.rows[0]) return undefined;

  const [notes, timeline, responders] = await Promise.all([
    getIncidentNotes(id),
    getIncidentTimeline(id),
    getIncidentResponders(id),
  ]);

  return buildManagedIncident(result.rows[0], notes, timeline, responders);
}

/**
 * Update a managed incident's scalar fields. Does not modify child entities
 * (notes, timeline, responders) -- those are added via dedicated functions.
 */
export async function updateManagedIncident(
  id: string,
  updates: Partial<ManagedIncident>
): Promise<ManagedIncident | undefined> {
  if (!isDatabaseConnected()) {
    return undefined;
  }

  // Build SET clause dynamically from provided fields
  const allowedFields: Array<{ key: keyof ManagedIncident; column: string; serialize?: boolean }> = [
    { key: 'title', column: 'title' },
    { key: 'description', column: 'description' },
    { key: 'severity', column: 'severity' },
    { key: 'status', column: 'status' },
    { key: 'priority', column: 'priority' },
    { key: 'source', column: 'source' },
    { key: 'source_id', column: 'source_id' },
    { key: 'source_alert_id', column: 'source_alert_id' },
    { key: 'source_check_id', column: 'source_check_id' },
    { key: 'source_check_type', column: 'source_check_type' },
    { key: 'check_ids', column: 'check_ids', serialize: true },
    { key: 'tags', column: 'tags', serialize: true },
    { key: 'affected_services', column: 'affected_services', serialize: true },
    { key: 'escalation_policy_id', column: 'escalation_policy_id' },
    { key: 'on_call_schedule_id', column: 'on_call_schedule_id' },
    { key: 'current_escalation_level', column: 'current_escalation_level' },
    { key: 'resolution_summary', column: 'resolution_summary' },
    { key: 'postmortem_url', column: 'postmortem_url' },
    { key: 'postmortem_completed', column: 'postmortem_completed' },
    { key: 'acknowledged_at', column: 'acknowledged_at' },
    { key: 'resolved_at', column: 'resolved_at' },
    { key: 'time_to_acknowledge_seconds', column: 'time_to_acknowledge_seconds' },
    { key: 'time_to_resolve_seconds', column: 'time_to_resolve_seconds' },
    { key: 'updated_at', column: 'updated_at' },
  ];

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  // Always update updated_at
  if (updates.updated_at === undefined) {
    updates.updated_at = new Date();
  }

  for (const field of allowedFields) {
    if (field.key in updates) {
      const val = updates[field.key];
      setClauses.push(`${field.column} = $${paramIndex}`);
      values.push(field.serialize ? JSON.stringify(val ?? []) : (val ?? null));
      paramIndex++;
    }
  }

  if (setClauses.length === 0) {
    return getManagedIncident(id);
  }

  values.push(id);
  const result = await query<ManagedIncidentRow>(
    `UPDATE managed_incidents SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING ${MANAGED_INCIDENT_COLUMNS}`,
    values
  );

  if (!result || !result.rows[0]) return undefined;

  const [notes, timeline, responders] = await Promise.all([
    getIncidentNotes(id),
    getIncidentTimeline(id),
    getIncidentResponders(id),
  ]);

  return buildManagedIncident(result.rows[0], notes, timeline, responders);
}

/**
 * Delete a managed incident and all its child entities (cascaded by FK).
 */
export async function deleteManagedIncident(id: string): Promise<boolean> {
  if (!isDatabaseConnected()) {
    return false;
  }
  const result = await query(`DELETE FROM managed_incidents WHERE id = $1`, [id]);
  return result !== null && (result.rowCount ?? 0) > 0;
}

/**
 * List managed incidents for an organization, with optional status/priority filters.
 * Returns incidents sorted by created_at DESC.
 */
export async function listManagedIncidents(
  orgId: string,
  options?: {
    status?: string[];
    priority?: string[];
    since?: Date;
    limit?: number;
  }
): Promise<ManagedIncident[]> {
  if (!isDatabaseConnected()) {
    return [];
  }

  const conditions: string[] = ['organization_id = $1'];
  const params: unknown[] = [orgId];
  let paramIndex = 2;

  if (options?.status && options.status.length > 0) {
    conditions.push(`status = ANY($${paramIndex})`);
    params.push(options.status);
    paramIndex++;
  }

  if (options?.priority && options.priority.length > 0) {
    conditions.push(`priority = ANY($${paramIndex})`);
    params.push(options.priority);
    paramIndex++;
  }

  if (options?.since) {
    conditions.push(`created_at >= $${paramIndex}`);
    params.push(options.since);
    paramIndex++;
  }

  const limit = options?.limit ?? 200;
  params.push(limit);

  const result = await query<ManagedIncidentRow>(
    `SELECT ${MANAGED_INCIDENT_COLUMNS} FROM managed_incidents
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${paramIndex}`,
    params
  );

  if (!result || result.rows.length === 0) return [];

  // Batch-load child entities for all returned incidents
  const incidents: ManagedIncident[] = [];
  for (const row of result.rows) {
    const [notes, timeline, responders] = await Promise.all([
      getIncidentNotes(row.id),
      getIncidentTimeline(row.id),
      getIncidentResponders(row.id),
    ]);
    incidents.push(buildManagedIncident(row, notes, timeline, responders));
  }

  return incidents;
}

/**
 * Count managed incidents for an organization (cheaper than listing).
 */
export async function countManagedIncidents(orgId: string): Promise<number> {
  if (!isDatabaseConnected()) {
    return 0;
  }
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM managed_incidents WHERE organization_id = $1`,
    [orgId]
  );
  if (result && result.rows[0]) {
    return parseInt(result.rows[0].count, 10);
  }
  return 0;
}


// =============================
// MANAGED INCIDENT NOTES
// =============================

export async function addManagedIncidentNote(incidentId: string, note: IncidentNote): Promise<IncidentNote> {
  if (!isDatabaseConnected()) {
    throw new Error('[Monitoring Repo] Database not connected - cannot add incident note');
  }
  await query(
    `INSERT INTO managed_incident_notes (id, incident_id, author_id, author_name, content, visibility, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [note.id, incidentId, note.author_id, note.author_name, note.content, note.visibility ?? 'internal', note.created_at]
  );
  return note;
}

async function getIncidentNotes(incidentId: string): Promise<IncidentNote[]> {
  const result = await query<ManagedIncidentNoteRow>(
    `SELECT id, incident_id, author_id, author_name, content, visibility, created_at
     FROM managed_incident_notes WHERE incident_id = $1 ORDER BY created_at ASC`,
    [incidentId]
  );
  if (!result) return [];
  return result.rows.map(parseNoteRow);
}


// =============================
// MANAGED INCIDENT TIMELINE
// =============================

export async function addManagedIncidentTimelineEntry(incidentId: string, entry: IncidentTimeline): Promise<IncidentTimeline> {
  if (!isDatabaseConnected()) {
    throw new Error('[Monitoring Repo] Database not connected - cannot add incident timeline entry');
  }
  await insertTimelineEntry(incidentId, entry);
  return entry;
}

async function insertTimelineEntry(incidentId: string, entry: IncidentTimeline): Promise<void> {
  await query(
    `INSERT INTO managed_incident_timeline (id, incident_id, event_type, description, actor_id, actor_name, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.id, incidentId, entry.event_type, entry.description,
      entry.actor_id ?? null, entry.actor_name ?? null,
      JSON.stringify(entry.metadata ?? {}), entry.created_at,
    ]
  );
}

async function getIncidentTimeline(incidentId: string): Promise<IncidentTimeline[]> {
  const result = await query<ManagedIncidentTimelineRow>(
    `SELECT id, incident_id, event_type, description, actor_id, actor_name, metadata, created_at
     FROM managed_incident_timeline WHERE incident_id = $1 ORDER BY created_at ASC`,
    [incidentId]
  );
  if (!result) return [];
  return result.rows.map(parseTimelineRow);
}


// =============================
// MANAGED INCIDENT RESPONDERS
// =============================

export async function addManagedIncidentResponder(incidentId: string, responder: IncidentResponder): Promise<IncidentResponder> {
  if (!isDatabaseConnected()) {
    throw new Error('[Monitoring Repo] Database not connected - cannot add incident responder');
  }
  await query(
    `INSERT INTO managed_incident_responders (id, incident_id, user_id, user_name, user_email, role, assigned_at, acknowledged_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      responder.id, incidentId, responder.user_id, responder.user_name,
      responder.user_email, responder.role, responder.assigned_at,
      responder.acknowledged_at ?? null,
    ]
  );
  return responder;
}

async function getIncidentResponders(incidentId: string): Promise<IncidentResponder[]> {
  const result = await query<ManagedIncidentResponderRow>(
    `SELECT id, incident_id, user_id, user_name, user_email, role, assigned_at, acknowledged_at
     FROM managed_incident_responders WHERE incident_id = $1 ORDER BY assigned_at ASC`,
    [incidentId]
  );
  if (!result) return [];
  return result.rows.map(parseResponderRow);
}


// =============================
// MANAGED INCIDENT PARSERS
// =============================

function parseManagedIncidentRow(row: ManagedIncidentRow): Omit<ManagedIncident, 'notes' | 'timeline' | 'responders'> {
  return {
    id: row.id,
    organization_id: row.organization_id,
    title: row.title,
    description: row.description ?? undefined,
    severity: row.severity as ManagedIncident['severity'],
    status: row.status as ManagedIncident['status'],
    priority: (row.priority as ManagedIncident['priority']) ?? undefined,
    source: row.source as ManagedIncident['source'],
    source_id: row.source_id ?? undefined,
    source_alert_id: row.source_alert_id ?? undefined,
    source_check_id: row.source_check_id ?? undefined,
    source_check_type: row.source_check_type ?? undefined,
    check_ids: safeJsonParseOrPassthrough(row.check_ids ?? '[]', [] as string[]),
    tags: safeJsonParseOrPassthrough(row.tags ?? '[]', [] as string[]),
    affected_services: safeJsonParseOrPassthrough(row.affected_services ?? '[]', [] as string[]),
    escalation_policy_id: row.escalation_policy_id ?? undefined,
    on_call_schedule_id: row.on_call_schedule_id ?? undefined,
    current_escalation_level: row.current_escalation_level ?? undefined,
    resolution_summary: row.resolution_summary ?? undefined,
    postmortem_url: row.postmortem_url ?? undefined,
    postmortem_completed: row.postmortem_completed ?? false,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    acknowledged_at: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
    resolved_at: row.resolved_at ? new Date(row.resolved_at) : undefined,
    time_to_acknowledge_seconds: row.time_to_acknowledge_seconds ?? undefined,
    time_to_resolve_seconds: row.time_to_resolve_seconds ?? undefined,
  };
}

function buildManagedIncident(
  row: ManagedIncidentRow,
  notes: IncidentNote[],
  timeline: IncidentTimeline[],
  responders: IncidentResponder[],
): ManagedIncident {
  return {
    ...parseManagedIncidentRow(row),
    notes,
    timeline,
    responders,
  };
}

function parseNoteRow(row: ManagedIncidentNoteRow): IncidentNote {
  return {
    id: row.id,
    incident_id: row.incident_id,
    author_id: row.author_id,
    author_name: row.author_name,
    content: row.content,
    visibility: (row.visibility as IncidentNote['visibility']) ?? 'internal',
    created_at: new Date(row.created_at),
  };
}

function parseTimelineRow(row: ManagedIncidentTimelineRow): IncidentTimeline {
  return {
    id: row.id,
    incident_id: row.incident_id,
    event_type: row.event_type as IncidentTimeline['event_type'],
    description: row.description,
    actor_id: row.actor_id ?? undefined,
    actor_name: row.actor_name ?? undefined,
    metadata: row.metadata
      ? safeJsonParseOrPassthrough(
          row.metadata as string | Record<string, unknown>,
          {} as Record<string, unknown>
        ) as Record<string, unknown>
      : {},
    created_at: new Date(row.created_at),
  };
}

function parseResponderRow(row: ManagedIncidentResponderRow): IncidentResponder {
  return {
    id: row.id,
    user_id: row.user_id,
    user_name: row.user_name,
    user_email: row.user_email,
    role: row.role as IncidentResponder['role'],
    assigned_at: new Date(row.assigned_at),
    acknowledged_at: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
  };
}
