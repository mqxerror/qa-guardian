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
// Feature #439: Use structured logger instead of console.*
import { logger } from '../logger.js';

// ============================================================================
// Type Definitions
// ============================================================================

// Database row types (match actual DB schema columns)
interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  avatar_url: string | null;
  role: string;
  email_verified: boolean;
  created_at: string | Date;
  updated_at?: string | Date;
}

interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  device: string | null;
  browser: string | null;
  ip_address: string | null;
  last_active: string | Date;
  created_at: string | Date;
}

interface ResetTokenRow {
  user_email: string;
  token_hash: string;
  created_at: string | Date;
  used_at: string | Date | null;
  expires_at?: string | Date;
}

interface RefreshTokenRow {
  token_hash: string;
  user_id: string;
  expires_at: string | Date;
  revoked_at: string | Date | null;
}

interface CountRow {
  count: string;
}

interface ExistsRow {
  '?column?'?: number;
}

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
// Feature #241: Changed from Set to Map with expiry timestamp for TTL-based eviction
// Key: token, Value: expiry timestamp (ms since epoch)
const memoryTokenBlacklist: Map<string, number> = new Map();
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
function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    password_hash: row.password_hash,
    name: row.name,
    avatar_url: row.avatar_url ?? undefined,
    role: row.role as User['role'],
    email_verified: row.email_verified,
    created_at: new Date(row.created_at),
  };
}

/**
 * Convert a database row to a Session object
 */
function rowToSession(row: SessionRow): Session {
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
    const result = await query<UserRow>(
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
    logger.error({ error }, '[AuthRepo] Failed to create user in database:');
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
    const result = await query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users WHERE email = $1`,
      [email]
    );
    if (result && result.rows[0]) {
      return rowToUser(result.rows[0]);
    }
  } catch (error) {
    logger.error({ error }, '[AuthRepo] Failed to get user from database:');
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
    const result = await query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
      [id]
    );
    if (result && result.rows[0]) {
      return rowToUser(result.rows[0]);
    }
  } catch (error) {
    logger.error({ error }, '[AuthRepo] Failed to get user from database:');
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
    const values: (string | boolean | undefined)[] = [];
    let paramIndex = 1;

    const fieldMappings: Record<keyof Pick<User, 'password_hash' | 'name' | 'avatar_url' | 'role' | 'email_verified'>, string> = {
      password_hash: 'password_hash',
      name: 'name',
      avatar_url: 'avatar_url',
      role: 'role',
      email_verified: 'email_verified',
    };

    for (const [key, dbField] of Object.entries(fieldMappings)) {
      const typedKey = key as keyof typeof fieldMappings;
      if (typedKey in updates) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        values.push(updates[typedKey]);
        paramIndex++;
      }
    }

    if (setClauses.length > 0) {
      setClauses.push(`updated_at = NOW()`);
      values.push(email);
      const result = await query<UserRow>(
        `UPDATE users SET ${setClauses.join(', ')} WHERE email = $${paramIndex} RETURNING *`,
        values
      );
      if (result && result.rows[0]) {
        return rowToUser(result.rows[0]);
      }
    }
  } catch (error) {
    logger.error({ error }, '[AuthRepo] Failed to update user in database:');
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
    const result = await query<ExistsRow>(
      'SELECT 1 FROM users WHERE email = $1',
      [email]
    );
    if (result && result.rows.length > 0) {
      return true;
    }
  } catch (error) {
    logger.error({ error }, '[AuthRepo] Failed to check user existence:');
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
    const result = await query<CountRow>('SELECT COUNT(*) as count FROM users');
    if (result && result.rows[0]) {
      return parseInt(result.rows[0].count, 10);
    }
  } catch (error) {
    logger.error({ error }, '[AuthRepo] Failed to get user count:');
  }

  return 0;
}

// ============================================================================
// Token Blacklist Functions
// ============================================================================

/**
 * Add a token to the blacklist
 * Feature #216: Store in Redis for persistence across server restarts
 * Feature #241: Store expiry timestamp for TTL-based eviction
 */
export async function blacklistToken(token: string, expiresAt?: Date): Promise<void> {
  // Calculate TTL in seconds (default 1 hour to match new access token expiry)
  const defaultExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  const expiry = expiresAt || defaultExpiry;

  // Feature #241: Store with expiry timestamp (enables TTL-based eviction)
  memoryTokenBlacklist.set(token, expiry.getTime());

  // Feature #216: Create a fast SHA256 hash for Redis key (not bcrypt - too slow)
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const redisKey = `blacklist:${tokenHash}`;
  const ttlMs = Math.max(0, expiry.getTime() - Date.now());
  const ttlSeconds = Math.ceil(ttlMs / 1000);

  // Feature #216: Store in Redis with TTL for persistence
  const cache = getCache();
  if (cache.isRedisConnected() && ttlSeconds > 0) {
    try {
      await cache.set(redisKey, { blacklisted: true, createdAt: new Date().toISOString() }, ttlSeconds);
    } catch (error) {
      logger.error({ error }, '[AuthRepo] Failed to blacklist token in Redis:');
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
      logger.error({ error }, '[AuthRepo] Failed to blacklist token in database:');
    }
  }
}

/**
 * Check if a token is blacklisted
 * Feature #216: Check Redis after memory for persistence across restarts
 * Feature #241: Check expiry timestamp for TTL-based eviction
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  // Check memory first (fast path for current session)
  // Feature #241: Also check expiry timestamp
  const expiryTimestamp = memoryTokenBlacklist.get(token);
  if (expiryTimestamp !== undefined) {
    if (expiryTimestamp > Date.now()) {
      return true;
    }
    // Token has expired, remove from memory cache
    memoryTokenBlacklist.delete(token);
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
        // Feature #241: Store with 1 hour expiry for warm-up entries
        memoryTokenBlacklist.set(token, Date.now() + 60 * 60 * 1000);
        return true;
      }
    } catch (error) {
      logger.error({ error }, '[AuthRepo] Failed to check token blacklist in Redis:');
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
    logger.error({ error }, '[AuthRepo] Failed to create session in database:');
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
    const result = await query<SessionRow>(
      `SELECT ${SESSION_COLUMNS} FROM sessions WHERE user_id = $1 ORDER BY last_active DESC`,
      [userId]
    );
    if (result && result.rows) {
      return result.rows.map(rowToSession);
    }
  } catch (error) {
    logger.error({ error }, '[AuthRepo] Failed to get sessions from database:');
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
    logger.error({ error }, '[AuthRepo] Failed to update session:');
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
    logger.error({ error }, '[AuthRepo] Failed to delete session:');
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
    logger.error({ error }, '[AuthRepo] Failed to delete other sessions:');
  }

  return 0;
}

// ============================================================================
// Reset Token Functions
// ============================================================================

/**
 * Create a password reset token
 * Feature #234: Guarded memory write with isDatabaseConnected check
 */
export async function createResetToken(resetToken: ResetToken): Promise<ResetToken> {
  // Feature #234: Only write to memory when DB is not connected (avoids memory leak)
  if (!isDatabaseConnected()) {
    // Memory store uses raw token as key (dev mode only)
    memoryResetTokens.set(resetToken.token, resetToken);
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
    logger.error({ error }, '[AuthRepo] Failed to create reset token in database:');
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
    const result = await query<ResetTokenRow>(
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
    logger.error({ error }, '[AuthRepo] Failed to get reset token from database:');
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
    logger.error({ error }, '[AuthRepo] Failed to mark reset token as used:');
  }
}

// ============================================================================
// Refresh Token Functions (Feature #221)
// ============================================================================

// Memory map for refresh tokens (fallback when DB not available)
const memoryRefreshTokens: Map<string, { userId: string; expiresAt: Date }> = new Map();

/**
 * Store a refresh token hash in the database
 * Feature #240: Guarded memory write with isDatabaseConnected check
 */
export async function storeRefreshTokenHash(hash: string, userId: string, expiresAt: Date): Promise<void> {
  // Feature #240: Only write to memory when DB is not connected (avoids unbounded memory growth)
  if (!isDatabaseConnected()) {
    memoryRefreshTokens.set(hash, { userId, expiresAt });
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
    logger.error({ error }, '[AuthRepo] Failed to store refresh token in database:');
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
    const result = await query<ExistsRow>(
      `SELECT 1 FROM refresh_tokens
       WHERE token_hash = $1 AND expires_at > NOW() AND revoked_at IS NULL`,
      [hash]
    );
    if (result && result.rows.length > 0) {
      return true;
    }
  } catch (error) {
    logger.error({ error }, '[AuthRepo] Failed to check refresh token validity:');
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
    logger.error({ error }, '[AuthRepo] Failed to revoke refresh token:');
  }
}

/**
 * Feature #233: Atomically revoke a refresh token and return whether it was valid
 *
 * This fixes the race condition where two concurrent refresh requests could both
 * succeed by checking validity separately before revoking. By using a single
 * UPDATE ... WHERE revoked_at IS NULL RETURNING *, only the first request can
 * succeed - subsequent requests will find the token already revoked.
 *
 * @param hash The token hash to atomically revoke
 * @returns The user_id if the token was valid and successfully revoked, or null if already revoked/expired
 */
export async function atomicRevokeRefreshToken(hash: string): Promise<string | null> {
  // Memory fallback - use simple check-then-delete (not truly atomic, but acceptable for dev)
  if (!isDatabaseConnected()) {
    const entry = memoryRefreshTokens.get(hash);
    if (entry && entry.expiresAt > new Date()) {
      memoryRefreshTokens.delete(hash);
      return entry.userId;
    }
    return null;
  }

  try {
    // Atomic: UPDATE only if not already revoked AND not expired, return the row if successful
    const result = await query<Pick<RefreshTokenRow, 'user_id'>>(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()
       RETURNING user_id`,
      [hash]
    );

    // If rowCount is 0, the token was already revoked or expired
    if (result && result.rows.length > 0) {
      // Also clean up memory cache
      memoryRefreshTokens.delete(hash);
      return result.rows[0].user_id;
    }
  } catch (error) {
    logger.error({ error }, '[AuthRepo] Failed to atomically revoke refresh token:');
  }

  return null;
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
    logger.error({ error }, '[AuthRepo] Failed to cleanup expired refresh tokens:');
  }

  return 0;
}

// ============================================================================
// Cleanup Functions
// ============================================================================

/**
 * Clean up expired tokens and sessions
 * Feature #241: Also clean up expired entries from memoryTokenBlacklist
 */
export async function cleanupExpiredData(): Promise<{ tokens: number; sessions: number; memoryBlacklist: number }> {
  let tokensDeleted = 0;
  let sessionsDeleted = 0;
  let memoryBlacklistEvicted = 0;

  // Feature #241: Evict expired entries from memory blacklist
  const now = Date.now();
  for (const [token, expiryTimestamp] of memoryTokenBlacklist) {
    if (expiryTimestamp <= now) {
      memoryTokenBlacklist.delete(token);
      memoryBlacklistEvicted++;
    }
  }

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
      logger.error({ error }, '[AuthRepo] Failed to cleanup expired data:');
    }
  }

  return { tokens: tokensDeleted, sessions: sessionsDeleted, memoryBlacklist: memoryBlacklistEvicted };
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
      } catch (error: unknown) {
        // Ignore duplicate key errors (user already exists with this id)
        const dbError = error as { code?: string };
        if (dbError?.code !== '23505') {
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

// Feature #241: Return type changed from Set to Map (with expiry timestamp)
export function getMemoryTokenBlacklist(): Map<string, number> {
  return memoryTokenBlacklist; // Runtime cache with expiry timestamps
}

export function getMemoryUserSessions(): Map<string, Session[]> {
  return memoryUserSessions;
}

export function getMemoryResetTokens(): Map<string, ResetToken> {
  return memoryResetTokens;
}
