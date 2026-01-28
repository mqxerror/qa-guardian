/**
 * Auth Repository
 * Feature #2083: Migrate Auth module to PostgreSQL database
 *
 * Dual-mode: PostgreSQL when available, in-memory fallback for dev without DB.
 * Memory maps restored to support no-DB development mode.
 */

import { query, isDatabaseConnected } from '../database';
import bcrypt from 'bcryptjs';

// ============================================================================
// Type Definitions
// ============================================================================

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  avatar_url?: string;
  role: 'owner' | 'admin' | 'developer' | 'viewer';
  email_verified: boolean;
  created_at: Date;
}

export interface Session {
  id: string;
  user_id: string;
  token: string;
  device: string;
  browser: string;
  ip_address: string;
  last_active: Date;
  created_at: Date;
}

export interface ResetToken {
  email: string;
  token: string;
  createdAt: Date;
  used: boolean;
}

// ============================================================================
// Memory Maps (fallback for no-DB dev mode)
// PostgreSQL is primary when available; memory fallback when not.
// ============================================================================

const memoryUsers: Map<string, User> = new Map();
const memoryTokenBlacklist: Set<string> = new Set();
const memoryUserSessions: Map<string, Session[]> = new Map();
const memoryResetTokens: Map<string, ResetToken> = new Map();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert a database row to a User object
 */
function rowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    password_hash: row.password_hash,
    name: row.name,
    avatar_url: row.avatar_url,
    role: row.role as User['role'],
    email_verified: row.email_verified,
    created_at: new Date(row.created_at),
  };
}

/**
 * Convert a database row to a Session object
 */
function rowToSession(row: any): Session {
  return {
    id: row.id,
    user_id: row.user_id,
    token: row.token_hash, // We store hash, but interface uses 'token'
    device: row.device || 'Unknown',
    browser: row.browser || 'Unknown',
    ip_address: row.ip_address || 'Unknown',
    last_active: new Date(row.last_active),
    created_at: new Date(row.created_at),
  };
}

// ============================================================================
// User CRUD Functions
// ============================================================================

/**
 * Create a new user
 */
export async function createUser(user: User): Promise<User> {
  // Always store in memory for fallback
  memoryUsers.set(user.email, user);

  if (!isDatabaseConnected()) {
    return user;
  }

  try {
    const result = await query<any>(
      `INSERT INTO users (id, email, password_hash, name, avatar_url, role, email_verified, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        user.id,
        user.email,
        user.password_hash,
        user.name,
        user.avatar_url,
        user.role,
        user.email_verified,
        user.created_at,
      ]
    );
    if (result && result.rows[0]) {
      return rowToUser(result.rows[0]);
    }
  } catch (error) {
    console.error('[AuthRepo] Failed to create user in database:', error);
    throw error;
  }

  return user;
}

/**
 * Get a user by email
 */
export async function getUserByEmail(email: string): Promise<User | undefined> {
  if (!isDatabaseConnected()) {
    return memoryUsers.get(email);
  }

  try {
    const result = await query<any>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    if (result && result.rows[0]) {
      return rowToUser(result.rows[0]);
    }
  } catch (error) {
    console.error('[AuthRepo] Failed to get user from database:', error);
  }

  return undefined;
}

/**
 * Get a user by ID
 */
export async function getUserById(id: string): Promise<User | undefined> {
  if (!isDatabaseConnected()) {
    for (const user of memoryUsers.values()) { if (user.id === id) return user; }
    return undefined;
  }

  try {
    const result = await query<any>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    if (result && result.rows[0]) {
      return rowToUser(result.rows[0]);
    }
  } catch (error) {
    console.error('[AuthRepo] Failed to get user from database:', error);
  }

  return undefined;
}

/**
 * Update a user
 */
export async function updateUser(email: string, updates: Partial<User>): Promise<User | undefined> {
  const existing = memoryUsers.get(email);
  if (existing) { memoryUsers.set(email, { ...existing, ...updates }); }
  if (!isDatabaseConnected()) {
    return memoryUsers.get(email);
  }

  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMappings: Record<string, string> = {
      password_hash: 'password_hash',
      name: 'name',
      avatar_url: 'avatar_url',
      role: 'role',
      email_verified: 'email_verified',
    };

    for (const [key, dbField] of Object.entries(fieldMappings)) {
      if (key in updates) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        values.push((updates as any)[key]);
        paramIndex++;
      }
    }

    if (setClauses.length > 0) {
      setClauses.push(`updated_at = NOW()`);
      values.push(email);
      const result = await query<any>(
        `UPDATE users SET ${setClauses.join(', ')} WHERE email = $${paramIndex} RETURNING *`,
        values
      );
      if (result && result.rows[0]) {
        return rowToUser(result.rows[0]);
      }
    }
  } catch (error) {
    console.error('[AuthRepo] Failed to update user in database:', error);
  }

  return undefined;
}

/**
 * Check if a user exists by email
 */
export async function userExists(email: string): Promise<boolean> {
  if (!isDatabaseConnected()) {
    return memoryUsers.has(email);
  }

  try {
    const result = await query<any>(
      'SELECT 1 FROM users WHERE email = $1',
      [email]
    );
    if (result && result.rows.length > 0) {
      return true;
    }
  } catch (error) {
    console.error('[AuthRepo] Failed to check user existence:', error);
  }

  return false;
}

/**
 * Get the count of users (for generating new IDs)
 */
export async function getUserCount(): Promise<number> {
  if (!isDatabaseConnected()) {
    return memoryUsers.size;
  }

  try {
    const result = await query<any>('SELECT COUNT(*) as count FROM users');
    if (result && result.rows[0]) {
      return parseInt(result.rows[0].count, 10);
    }
  } catch (error) {
    console.error('[AuthRepo] Failed to get user count:', error);
  }

  return 0;
}

// ============================================================================
// Token Blacklist Functions
// ============================================================================

/**
 * Add a token to the blacklist
 */
export async function blacklistToken(token: string, expiresAt?: Date): Promise<void> {
  // Always add to runtime cache (fast lookup, cleared on restart)
  memoryTokenBlacklist.add(token);

  if (isDatabaseConnected()) {
    try {
      // Hash the token for storage
      const tokenHash = await bcrypt.hash(token.substring(0, 30), 5); // Quick hash of first 30 chars
      await query(
        `INSERT INTO token_blacklist (token_hash, expires_at, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (token_hash) DO NOTHING`,
        [tokenHash, expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)] // Default 7 day expiry
      );
    } catch (error) {
      console.error('[AuthRepo] Failed to blacklist token in database:', error);
    }
  }
}

/**
 * Check if a token is blacklisted
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  // Check memory first (fast path)
  if (memoryTokenBlacklist.has(token)) {
    return true;
  }

  // For database, we'd need to check by hash - this is expensive
  // For now, rely on memory blacklist (cleared on restart)
  // In production with Redis, this would be fast
  return false;
}

// ============================================================================
// Session Functions
// ============================================================================

/**
 * Create a new session
 */
export async function createSession(session: Session): Promise<Session> {
  // Add to memory
  const sessions = memoryUserSessions.get(session.user_id) || [];
  sessions.push(session);
  memoryUserSessions.set(session.user_id, sessions);

  if (!isDatabaseConnected()) {
    return session;
  }

  try {
    await query(
      `INSERT INTO sessions (id, user_id, token_hash, device, browser, ip_address, last_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        session.id,
        session.user_id,
        session.token, // In production, this should be hashed
        session.device,
        session.browser,
        session.ip_address,
        session.last_active,
        session.created_at,
      ]
    );
  } catch (error) {
    console.error('[AuthRepo] Failed to create session in database:', error);
    throw error;
  }

  return session;
}

/**
 * Get all sessions for a user
 */
export async function getUserSessions(userId: string): Promise<Session[]> {
  if (!isDatabaseConnected()) {
    return memoryUserSessions.get(userId) || [];
  }

  try {
    const result = await query<any>(
      'SELECT * FROM sessions WHERE user_id = $1 ORDER BY last_active DESC',
      [userId]
    );
    if (result && result.rows) {
      return result.rows.map(rowToSession);
    }
  } catch (error) {
    console.error('[AuthRepo] Failed to get sessions from database:', error);
  }

  return [];
}

/**
 * Update session last active time
 */
export async function updateSessionLastActive(sessionId: string): Promise<void> {
  // Update in memory
  for (const [userId, sessions] of memoryUserSessions.entries()) {
    const session = sessions.find(s => s.id === sessionId);
    if (session) { session.last_active = new Date(); break; }
  }
  if (!isDatabaseConnected()) {
    return;
  }

  try {
    await query(
      'UPDATE sessions SET last_active = NOW() WHERE id = $1',
      [sessionId]
    );
  } catch (error) {
    console.error('[AuthRepo] Failed to update session:', error);
  }
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string, userId: string): Promise<boolean> {
  // Remove from memory
  const memSessions = memoryUserSessions.get(userId);
  if (memSessions) {
    const idx = memSessions.findIndex(s => s.id === sessionId);
    if (idx !== -1) memSessions.splice(idx, 1);
  }
  if (!isDatabaseConnected()) {
    return true;
  }

  try {
    const result = await query(
      'DELETE FROM sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    return result !== null && result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error('[AuthRepo] Failed to delete session:', error);
  }

  return false;
}

/**
 * Delete all sessions for a user except current
 */
export async function deleteOtherSessions(userId: string, currentSessionId: string): Promise<number> {
  // Remove from memory
  const memSessions = memoryUserSessions.get(userId);
  let deletedCount = 0;
  if (memSessions) {
    const newSessions = memSessions.filter(s => s.id === currentSessionId);
    deletedCount = memSessions.length - newSessions.length;
    memoryUserSessions.set(userId, newSessions);
  }
  if (!isDatabaseConnected()) {
    return deletedCount;
  }

  try {
    const result = await query(
      'DELETE FROM sessions WHERE user_id = $1 AND id != $2',
      [userId, currentSessionId]
    );
    if (result && result.rowCount !== null) {
      return result.rowCount;
    }
  } catch (error) {
    console.error('[AuthRepo] Failed to delete other sessions:', error);
  }

  return 0;
}

// ============================================================================
// Reset Token Functions
// ============================================================================

/**
 * Create a password reset token
 */
export async function createResetToken(resetToken: ResetToken): Promise<ResetToken> {
  memoryResetTokens.set(resetToken.token, resetToken);
  if (!isDatabaseConnected()) {
    return resetToken;
  }

  try {
    await query(
      `INSERT INTO reset_tokens (token_hash, user_email, expires_at, created_at)
       VALUES ($1, $2, $3, $4)`,
      [
        resetToken.token, // In production, this should be hashed
        resetToken.email,
        new Date(resetToken.createdAt.getTime() + 60 * 60 * 1000), // 1 hour expiry
        resetToken.createdAt,
      ]
    );
  } catch (error) {
    console.error('[AuthRepo] Failed to create reset token in database:', error);
    throw error;
  }

  return resetToken;
}

/**
 * Get a reset token
 */
export async function getResetToken(token: string): Promise<ResetToken | undefined> {
  if (!isDatabaseConnected()) {
    return memoryResetTokens.get(token);
  }

  try {
    const result = await query<any>(
      'SELECT * FROM reset_tokens WHERE token_hash = $1',
      [token]
    );
    if (result && result.rows[0]) {
      const row = result.rows[0];
      return {
        email: row.user_email,
        token: row.token_hash,
        createdAt: new Date(row.created_at),
        used: row.used_at !== null,
      };
    }
  } catch (error) {
    console.error('[AuthRepo] Failed to get reset token from database:', error);
  }

  return undefined;
}

/**
 * Mark a reset token as used
 */
export async function markResetTokenUsed(token: string): Promise<void> {
  const memToken = memoryResetTokens.get(token);
  if (memToken) { memToken.used = true; }
  if (!isDatabaseConnected()) {
    return;
  }

  try {
    await query(
      'UPDATE reset_tokens SET used_at = NOW() WHERE token_hash = $1',
      [token]
    );
  } catch (error) {
    console.error('[AuthRepo] Failed to mark reset token as used:', error);
  }
}

// ============================================================================
// Cleanup Functions
// ============================================================================

/**
 * Clean up expired tokens and sessions
 */
export async function cleanupExpiredData(): Promise<{ tokens: number; sessions: number }> {
  let tokensDeleted = 0;
  let sessionsDeleted = 0;

  if (isDatabaseConnected()) {
    try {
      // Clean up expired blacklisted tokens
      const tokenResult = await query(
        'DELETE FROM token_blacklist WHERE expires_at < NOW()'
      );
      if (tokenResult && tokenResult.rowCount !== null) {
        tokensDeleted = tokenResult.rowCount;
      }

      // Clean up expired reset tokens (older than 1 hour)
      await query(
        "DELETE FROM reset_tokens WHERE created_at < NOW() - INTERVAL '1 hour'"
      );

      // Clean up old sessions (older than 30 days)
      const sessionResult = await query(
        "DELETE FROM sessions WHERE last_active < NOW() - INTERVAL '30 days'"
      );
      if (sessionResult && sessionResult.rowCount !== null) {
        sessionsDeleted = sessionResult.rowCount;
      }
    } catch (error) {
      console.error('[AuthRepo] Failed to cleanup expired data:', error);
    }
  }

  return { tokens: tokensDeleted, sessions: sessionsDeleted };
}

// ============================================================================
// Seed Functions
// ============================================================================

// Default user UUIDs (must match organizations.ts DEFAULT_USER_IDS)
export const DEFAULT_USER_IDS = {
  owner: '00000000-0000-0000-0000-000000000011',
  admin: '00000000-0000-0000-0000-000000000012',
  developer: '00000000-0000-0000-0000-000000000013',
  viewer: '00000000-0000-0000-0000-000000000014',
  otherOwner: '00000000-0000-0000-0000-000000000015',
};

/**
 * Seed test users (for development)
 * Works in both DB and no-DB modes via memory fallback.
 */
export async function seedTestUsers(): Promise<void> {
  const testUsers = [
    {
      id: DEFAULT_USER_IDS.owner,
      email: 'owner@example.com',
      password: 'Owner123!',
      name: 'Test Owner',
      role: 'owner' as const,
    },
    {
      id: DEFAULT_USER_IDS.admin,
      email: 'admin@example.com',
      password: 'Admin123!',
      name: 'Test Admin',
      role: 'admin' as const,
    },
    {
      id: DEFAULT_USER_IDS.developer,
      email: 'developer@example.com',
      password: 'Developer123!',
      name: 'Test Developer',
      role: 'developer' as const,
    },
    {
      id: DEFAULT_USER_IDS.viewer,
      email: 'viewer@example.com',
      password: 'Viewer123!',
      name: 'Test Viewer',
      role: 'viewer' as const,
    },
    {
      id: DEFAULT_USER_IDS.otherOwner,
      email: 'otherowner@example.com',
      password: 'Other123!',
      name: 'Other Org Owner',
      role: 'owner' as const,
    },
  ];

  for (const userData of testUsers) {
    const exists = await userExists(userData.email);
    if (!exists) {
      const password_hash = await bcrypt.hash(userData.password, 10);
      await createUser({
        id: userData.id,
        email: userData.email,
        password_hash,
        name: userData.name,
        role: userData.role,
        email_verified: true,
        created_at: new Date(),
      });
    }
  }
}

// ============================================================================
// Memory Store Accessors
// Return shared memory maps for route files that import them at module load.
// ============================================================================

export function getMemoryUsers(): Map<string, User> {
  return memoryUsers;
}

export function getMemoryTokenBlacklist(): Set<string> {
  return memoryTokenBlacklist; // Runtime cache
}

export function getMemoryUserSessions(): Map<string, Session[]> {
  return memoryUserSessions;
}

export function getMemoryResetTokens(): Map<string, ResetToken> {
  return memoryResetTokens;
}
