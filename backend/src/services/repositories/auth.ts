/**
 * Auth Repository
 * Feature #2083: Migrate Auth module to PostgreSQL database
 *
 * Dual-mode: PostgreSQL when available, in-memory fallback for dev without DB.
 * Memory maps restored to support no-DB development mode.
 */

import { query, isDatabaseConnected } from '../database.js';
import { getCache } from '../cache.js'; // Feature #216: Redis-backed token blacklist
import { createHash } from 'node:crypto'; // Feature #216: Fast token hashing for Redis key
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
// Column Constants (Feature #100: Replace SELECT * with explicit columns)
// ============================================================================

/**
 * Explicit column list for users table.
 */
const USER_COLUMNS = [
  'id', 'email', 'password_hash', 'name', 'avatar_url', 'role',
  'email_verified', 'created_at'
].join(', ');

/**
 * Explicit column list for sessions table.
 */
const SESSION_COLUMNS = [
  'id', 'user_id', 'token_hash', 'device', 'browser', 'ip_address',
  'last_active', 'created_at'
].join(', ');

/**
 * Explicit column list for reset_tokens table.
 * Feature #231: Fixed column names to match actual DB schema (user_email, used_at)
 */
const RESET_TOKEN_COLUMNS = [
  'user_email', 'token_hash', 'created_at', 'used_at'
].join(', ');

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
  // Feature #211: Only write to memory when DB is not connected (avoids dual-write)
  if (!isDatabaseConnected()) {
    memoryUsers.set(user.email, user);
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
      `SELECT ${USER_COLUMNS} FROM users WHERE email = $1`,
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
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
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
  // Feature #211: Only write to memory when DB is not connected (avoids dual-write)
  if (!isDatabaseConnected()) {
    const existing = memoryUsers.get(email);
    if (existing) { memoryUsers.set(email, { ...existing, ...updates }); }
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
 * Feature #216: Store in Redis for persistence across server restarts
 */
export async function blacklistToken(token: string, expiresAt?: Date): Promise<void> {
  // Always add to runtime cache (fast lookup for current session)
  memoryTokenBlacklist.add(token);

  // Feature #216: Create a fast SHA256 hash for Redis key (not bcrypt - too slow)
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const redisKey = `blacklist:${tokenHash}`;

  // Calculate TTL in seconds (default 1 hour to match new access token expiry)
  const defaultExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  const expiry = expiresAt || defaultExpiry;
  const ttlMs = Math.max(0, expiry.getTime() - Date.now());
  const ttlSeconds = Math.ceil(ttlMs / 1000);

  // Feature #216: Store in Redis with TTL for persistence
  const cache = getCache();
  if (cache.isRedisConnected() && ttlSeconds > 0) {
    try {
      await cache.set(redisKey, { blacklisted: true, createdAt: new Date().toISOString() }, ttlSeconds);
    } catch (error) {
      console.error('[AuthRepo] Failed to blacklist token in Redis:', error);
    }
  }

  // Also store in database for audit trail (optional)
  if (isDatabaseConnected()) {
    try {
      // Use bcrypt for database storage (for consistency)
      const dbTokenHash = await bcrypt.hash(token.substring(0, 30), 5);
      await query(
        `INSERT INTO token_blacklist (token_hash, expires_at, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (token_hash) DO NOTHING`,
        [dbTokenHash, expiry]
      );
    } catch (error) {
      console.error('[AuthRepo] Failed to blacklist token in database:', error);
    }
  }
}

/**
 * Check if a token is blacklisted
 * Feature #216: Check Redis after memory for persistence across restarts
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  // Check memory first (fast path for current session)
  if (memoryTokenBlacklist.has(token)) {
    return true;
  }

  // Feature #216: Check Redis (persists across server restarts)
  const cache = getCache();
  if (cache.isRedisConnected()) {
    try {
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const redisKey = `blacklist:${tokenHash}`;
      const exists = await cache.exists(redisKey);
      if (exists) {
        // Warm up memory cache for future fast-path lookups
        memoryTokenBlacklist.add(token);
        return true;
      }
    } catch (error) {
      console.error('[AuthRepo] Failed to check token blacklist in Redis:', error);
    }
  }

  return false;
}

// ============================================================================
// Session Functions
// ============================================================================

/**
 * Create a new session
 */
export async function createSession(session: Session): Promise<Session> {
  // Feature #211: Only write to memory when DB is not connected (avoids dual-write)
  if (!isDatabaseConnected()) {
    const sessions = memoryUserSessions.get(session.user_id) || [];
    sessions.push(session);
    memoryUserSessions.set(session.user_id, sessions);
    return session;
  }

  try {
    // Feature #222: Hash the token before storing (prevents exposure on DB compromise)
    const tokenHash = createHash('sha256').update(session.token).digest('hex');
    await query(
      `INSERT INTO sessions (id, user_id, token_hash, device, browser, ip_address, last_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        session.id,
        session.user_id,
        tokenHash,
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
      `SELECT ${SESSION_COLUMNS} FROM sessions WHERE user_id = $1 ORDER BY last_active DESC`,
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
  // Feature #211: Only write to memory when DB is not connected (avoids dual-write)
  if (!isDatabaseConnected()) {
    const memSessions = memoryUserSessions.get(userId);
    let deletedCount = 0;
    if (memSessions) {
      const newSessions = memSessions.filter(s => s.id === currentSessionId);
      deletedCount = memSessions.length - newSessions.length;
      memoryUserSessions.set(userId, newSessions);
    }
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
  // Memory store uses raw token as key (dev mode only)
  memoryResetTokens.set(resetToken.token, resetToken);
  if (!isDatabaseConnected()) {
    return resetToken;
  }

  try {
    // Feature #223: Hash the token before storing (prevents exposure on DB compromise)
    const tokenHash = createHash('sha256').update(resetToken.token).digest('hex');
    await query(
      `INSERT INTO reset_tokens (token_hash, user_email, expires_at, created_at)
       VALUES ($1, $2, $3, $4)`,
      [
        tokenHash,
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
    // Feature #223: Hash the incoming token to match stored hash
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const result = await query<any>(
      `SELECT ${RESET_TOKEN_COLUMNS} FROM reset_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
    if (result && result.rows[0]) {
      const row = result.rows[0];
      return {
        email: row.user_email,
        token: token, // Return original token, not hash
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
    // Feature #223: Hash the incoming token to match stored hash
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await query(
      'UPDATE reset_tokens SET used_at = NOW() WHERE token_hash = $1',
      [tokenHash]
    );
  } catch (error) {
    console.error('[AuthRepo] Failed to mark reset token as used:', error);
  }
}

// ============================================================================
// Refresh Token Functions (Feature #221)
// ============================================================================

// Memory map for refresh tokens (fallback when DB not available)
const memoryRefreshTokens: Map<string, { userId: string; expiresAt: Date }> = new Map();

/**
 * Store a refresh token hash in the database
 */
export async function storeRefreshTokenHash(hash: string, userId: string, expiresAt: Date): Promise<void> {
  // Always store in memory as fallback
  memoryRefreshTokens.set(hash, { userId, expiresAt });

  if (!isDatabaseConnected()) {
    return;
  }

  try {
    await query(
      `INSERT INTO refresh_tokens (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (token_hash) DO UPDATE SET expires_at = $3`,
      [hash, userId, expiresAt]
    );
  } catch (error) {
    console.error('[AuthRepo] Failed to store refresh token in database:', error);
    // Memory fallback will be used
  }
}

/**
 * Check if a refresh token hash is valid (not expired, not revoked)
 */
export async function isRefreshTokenHashValid(hash: string): Promise<boolean> {
  if (!isDatabaseConnected()) {
    const entry = memoryRefreshTokens.get(hash);
    return entry !== undefined && entry.expiresAt > new Date();
  }

  try {
    const result = await query<any>(
      `SELECT 1 FROM refresh_tokens
       WHERE token_hash = $1 AND expires_at > NOW() AND revoked_at IS NULL`,
      [hash]
    );
    if (result && result.rows.length > 0) {
      return true;
    }
  } catch (error) {
    console.error('[AuthRepo] Failed to check refresh token validity:', error);
    // Fall back to memory
    const entry = memoryRefreshTokens.get(hash);
    return entry !== undefined && entry.expiresAt > new Date();
  }

  return false;
}

/**
 * Revoke a refresh token hash
 */
export async function revokeRefreshTokenHash(hash: string): Promise<void> {
  // Remove from memory
  memoryRefreshTokens.delete(hash);

  if (!isDatabaseConnected()) {
    return;
  }

  try {
    await query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1',
      [hash]
    );
  } catch (error) {
    console.error('[AuthRepo] Failed to revoke refresh token:', error);
  }
}

/**
 * Clean up expired and revoked refresh tokens
 */
export async function cleanupExpiredRefreshTokens(): Promise<number> {
  // Clean up memory
  const now = new Date();
  for (const [hash, entry] of memoryRefreshTokens.entries()) {
    if (entry.expiresAt < now) {
      memoryRefreshTokens.delete(hash);
    }
  }

  if (!isDatabaseConnected()) {
    return 0;
  }

  try {
    const result = await query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked_at IS NOT NULL'
    );
    if (result && result.rowCount !== null) {
      return result.rowCount;
    }
  } catch (error) {
    console.error('[AuthRepo] Failed to cleanup expired refresh tokens:', error);
  }

  return 0;
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
      try {
        await createUser({
          id: userData.id,
          email: userData.email,
          password_hash,
          name: userData.name,
          role: userData.role,
          email_verified: true,
          created_at: new Date(),
        });
      } catch (error: any) {
        // Ignore duplicate key errors (user already exists with this id)
        if (error?.code !== '23505') {
          throw error;
        }
      }
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
