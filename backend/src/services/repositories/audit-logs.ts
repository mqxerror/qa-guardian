/**
 * Audit Logs Repository - PostgreSQL persistence
 *
 * Feature #2093: Migrate Audit Logs Module to PostgreSQL
 *
 * Provides CRUD operations for:
 * - Audit log entries for tracking user actions
 */

import { query, isDatabaseConnected } from '../database';

// Audit log entry interface
export interface AuditLogEntry {
  id: string;
  organization_id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  resource_name?: string;
  details?: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
  created_at: Date;
}

// Memory fallback store
const memoryAuditLogs: Map<string, AuditLogEntry> = new Map();

// ============================================
// Memory Store Accessor (for backward compatibility)
// ============================================

export function getMemoryAuditLogs(): Map<string, AuditLogEntry> {
  return memoryAuditLogs;
}

// ============================================
// Helper Functions
// ============================================

function parseAuditLogRow(row: any): AuditLogEntry {
  return {
    id: row.id,
    organization_id: row.organization_id,
    user_id: row.user_id,
    user_email: row.user_email,
    action: row.action,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    resource_name: row.resource_name,
    details: row.details,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

// ============================================
// Audit Log CRUD Operations
// ============================================

/**
 * Create a new audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<AuditLogEntry> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      `INSERT INTO audit_logs (
        id, organization_id, user_id, user_email, action,
        resource_type, resource_id, resource_name, details,
        ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        entry.id,
        entry.organization_id,
        entry.user_id,
        entry.user_email,
        entry.action,
        entry.resource_type,
        entry.resource_id,
        entry.resource_name || null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ip_address,
        entry.user_agent,
        entry.created_at,
      ]
    );
    if (result && result.rows[0]) {
      return parseAuditLogRow(result.rows[0]);
    }
  }
  // Memory fallback
  memoryAuditLogs.set(entry.id, entry);
  return entry;
}

/**
 * Get an audit log entry by ID
 */
export async function getAuditLog(logId: string): Promise<AuditLogEntry | undefined> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM audit_logs WHERE id = $1',
      [logId]
    );
    if (result && result.rows[0]) {
      return parseAuditLogRow(result.rows[0]);
    }
    return undefined;
  }
  return memoryAuditLogs.get(logId);
}

/**
 * List audit logs for an organization with optional filters and pagination
 */
export async function listAuditLogs(
  organizationId: string,
  options?: {
    action?: string;
    resourceType?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const { action, resourceType, userId, limit = 50, offset = 0 } = options || {};

  if (isDatabaseConnected()) {
    // Build WHERE clause
    const conditions: string[] = ['organization_id = $1'];
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(action);
    }
    if (resourceType) {
      conditions.push(`resource_type = $${paramIndex++}`);
      params.push(resourceType);
    }
    if (userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(userId);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await query<any>(
      `SELECT COUNT(*) as count FROM audit_logs WHERE ${whereClause}`,
      params
    );
    const total = countResult?.rows[0]?.count ? parseInt(countResult.rows[0].count, 10) : 0;

    // Get paginated results
    params.push(limit, offset);
    const result = await query<any>(
      `SELECT * FROM audit_logs WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    if (result) {
      return {
        logs: result.rows.map(parseAuditLogRow),
        total,
      };
    }
    return { logs: [], total: 0 };
  }

  // Memory fallback
  let logs = Array.from(memoryAuditLogs.values())
    .filter(log => log.organization_id === organizationId);

  if (action) {
    logs = logs.filter(log => log.action === action);
  }
  if (resourceType) {
    logs = logs.filter(log => log.resource_type === resourceType);
  }
  if (userId) {
    logs = logs.filter(log => log.user_id === userId);
  }

  // Sort by created_at descending
  logs.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

  const total = logs.length;
  const paginatedLogs = logs.slice(offset, offset + limit);

  return { logs: paginatedLogs, total };
}

/**
 * Get unique actions for an organization (for filtering UI)
 */
export async function getUniqueActions(organizationId: string): Promise<string[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT DISTINCT action FROM audit_logs WHERE organization_id = $1 ORDER BY action',
      [organizationId]
    );
    if (result) {
      return result.rows.map((row: any) => row.action);
    }
    return [];
  }

  // Memory fallback
  const actions = new Set<string>();
  for (const log of memoryAuditLogs.values()) {
    if (log.organization_id === organizationId) {
      actions.add(log.action);
    }
  }
  return Array.from(actions).sort();
}

/**
 * Get unique resource types for an organization (for filtering UI)
 */
export async function getUniqueResourceTypes(organizationId: string): Promise<string[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT DISTINCT resource_type FROM audit_logs WHERE organization_id = $1 ORDER BY resource_type',
      [organizationId]
    );
    if (result) {
      return result.rows.map((row: any) => row.resource_type);
    }
    return [];
  }

  // Memory fallback
  const resourceTypes = new Set<string>();
  for (const log of memoryAuditLogs.values()) {
    if (log.organization_id === organizationId) {
      resourceTypes.add(log.resource_type);
    }
  }
  return Array.from(resourceTypes).sort();
}

/**
 * Delete audit logs older than a certain date (retention policy)
 */
export async function deleteOldAuditLogs(olderThan: Date): Promise<number> {
  if (isDatabaseConnected()) {
    const result = await query(
      'DELETE FROM audit_logs WHERE created_at < $1',
      [olderThan]
    );
    return result?.rowCount ?? 0;
  }

  // Memory fallback
  let deletedCount = 0;
  for (const [id, log] of memoryAuditLogs.entries()) {
    if (log.created_at < olderThan) {
      memoryAuditLogs.delete(id);
      deletedCount++;
    }
  }
  return deletedCount;
}

/**
 * Get audit log count for an organization
 */
export async function getAuditLogCount(organizationId?: string): Promise<number> {
  if (isDatabaseConnected()) {
    let sql = 'SELECT COUNT(*) as count FROM audit_logs';
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
    return Array.from(memoryAuditLogs.values()).filter(l => l.organization_id === organizationId).length;
  }
  return memoryAuditLogs.size;
}

/**
 * Get recent audit logs for a specific user
 */
export async function getAuditLogsByUser(
  userId: string,
  limit: number = 50
): Promise<AuditLogEntry[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    if (result) {
      return result.rows.map(parseAuditLogRow);
    }
    return [];
  }

  // Memory fallback
  return Array.from(memoryAuditLogs.values())
    .filter(log => log.user_id === userId)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .slice(0, limit);
}

/**
 * Get audit logs for a specific resource
 */
export async function getAuditLogsByResource(
  resourceType: string,
  resourceId: string,
  limit: number = 50
): Promise<AuditLogEntry[]> {
  if (isDatabaseConnected()) {
    const result = await query<any>(
      'SELECT * FROM audit_logs WHERE resource_type = $1 AND resource_id = $2 ORDER BY created_at DESC LIMIT $3',
      [resourceType, resourceId, limit]
    );
    if (result) {
      return result.rows.map(parseAuditLogRow);
    }
    return [];
  }

  // Memory fallback
  return Array.from(memoryAuditLogs.values())
    .filter(log => log.resource_type === resourceType && log.resource_id === resourceId)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .slice(0, limit);
}
