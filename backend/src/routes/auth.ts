import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
// Feature #213: Node.js crypto for hashing refresh tokens
import { createHash } from 'node:crypto';
// Feature #213: fast-jwt for refresh token handling (separate from app.jwt)
import { createSigner, createVerifier } from 'fast-jwt';
import { getUserOrganization, DEFAULT_ORG_ID } from './organizations.js';
import {
  seedDefaultOrganizations,
  createOrganization as repoCreateOrganization,
  addOrganizationMember as repoAddOrganizationMember,
} from '../services/repositories/organizations.js';

// Feature #2116: Import only async repository functions (no getMemory* calls)
import {
  User,
  Session,
  ResetToken,
  getUserByEmail as dbGetUserByEmail,
  createUser as dbCreateUser,
  updateUser as dbUpdateUser,
  userExists as dbUserExists,
  getUserCount as dbGetUserCount,
  blacklistToken as dbBlacklistToken,
  isTokenBlacklisted as dbIsTokenBlacklisted,
  createSession as dbCreateSession,
  getUserSessions as dbGetUserSessions,
  deleteSession as dbDeleteSession,
  deleteOtherSessions as dbDeleteOtherSessions,
  createResetToken as dbCreateResetToken,
  getResetToken as dbGetResetToken,
  markResetTokenUsed as dbMarkResetTokenUsed,
  seedTestUsers,
} from '../services/repositories/auth.js';

// Re-export types for backward compatibility
export type { User, Session, ResetToken };

// Feature #2116: Export async accessors instead of synchronous Maps
// Other files that need user/token data should use these async functions
export { dbGetUserByEmail, dbIsTokenBlacklisted, dbGetUserSessions };

// Helper function to parse user agent into device/browser info
function parseUserAgent(userAgent: string | undefined): { device: string; browser: string } {
  if (!userAgent) {
    return { device: 'Unknown', browser: 'Unknown' };
  }

  // Detect browser
  let browser = 'Unknown';
  if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Edg')) {
    browser = 'Edge';
  } else if (userAgent.includes('Chrome')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Safari')) {
    browser = 'Safari';
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    browser = 'Opera';
  }

  // Detect device/OS
  let device = 'Desktop';
  if (userAgent.includes('iPhone')) {
    device = 'iPhone';
  } else if (userAgent.includes('iPad')) {
    device = 'iPad';
  } else if (userAgent.includes('Android')) {
    device = userAgent.includes('Mobile') ? 'Android Phone' : 'Android Tablet';
  } else if (userAgent.includes('Windows')) {
    device = 'Windows';
  } else if (userAgent.includes('Mac OS')) {
    device = 'Mac';
  } else if (userAgent.includes('Linux')) {
    device = 'Linux';
  }

  return { device, browser };
}

// Feature #2116: Helper function to create a session using async DB calls
async function createSessionForUser(userId: string, token: string, request: FastifyRequest): Promise<Session> {
  const { device, browser } = parseUserAgent(request.headers['user-agent']);
  const ip = request.ip || request.headers['x-forwarded-for']?.toString() || 'Unknown';

  const session: Session = {
    id: crypto.randomUUID(),
    user_id: userId,
    token,
    device,
    browser,
    ip_address: ip,
    last_active: new Date(),
    created_at: new Date(),
  };

  // Feature #2116: Use async DB call instead of Map
  await dbCreateSession(session);

  return session;
}

// Feature #2116: resetTokens now accessed via async dbGetResetToken/dbCreateResetToken

// ============================================================================
// Feature #213: Refresh Token Configuration
// ============================================================================

/** Access token expiry: 1 hour (short-lived for security) */
const ACCESS_TOKEN_EXPIRY = '1h';
const ACCESS_TOKEN_EXPIRY_SECONDS = 60 * 60; // 1 hour in seconds

/** Refresh token expiry: 7 days */
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

// Get refresh token secret (fallback to JWT_SECRET in dev)
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'dev-refresh-secret';

// Create signer and verifier for refresh tokens
const signRefreshToken = createSigner({ key: REFRESH_SECRET, expiresIn: REFRESH_TOKEN_EXPIRY });
const verifyRefreshToken = createVerifier({ key: REFRESH_SECRET });

// Store for refresh tokens (for production, store hash in sessions table)
// Feature #213: Simple in-memory store for refresh token hashes (mapped to user_id)
const refreshTokenHashes = new Map<string, { userId: string; expiresAt: Date }>();

/**
 * Feature #213: Generate a refresh token for a user
 */
function generateRefreshToken(userId: string, email: string, organizationId: string): string {
  const payload = {
    id: userId,
    email,
    organization_id: organizationId,
    type: 'refresh',
  };
  return signRefreshToken(payload);
}

/**
 * Feature #213: Store refresh token hash for later validation
 */
function storeRefreshToken(token: string, userId: string): void {
  // Hash the token for secure storage
  const hash = createHash('sha256').update(token).digest('hex');
  refreshTokenHashes.set(hash, {
    userId,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY),
  });
}

/**
 * Feature #213: Revoke a refresh token
 */
function revokeRefreshToken(token: string): boolean {
  const hash = createHash('sha256').update(token).digest('hex');
  return refreshTokenHashes.delete(hash);
}

/**
 * Feature #213: Check if a refresh token is valid (not revoked)
 */
function isRefreshTokenValid(token: string): boolean {
  const hash = createHash('sha256').update(token).digest('hex');
  const stored = refreshTokenHashes.get(hash);
  if (!stored) return false;
  if (stored.expiresAt < new Date()) {
    refreshTokenHashes.delete(hash);
    return false;
  }
  return true;
}

// Feature #2099: Seeding completion guard to prevent race conditions
let seedingComplete = false;

// Seed some test users for development
// Feature #2083: Now uses async repository function
// Feature #2083: Initialize test users using repository
// NOTE: This is now called from index.ts AFTER database is connected
export async function initTestUsers(): Promise<void> {
  console.log('[Auth] Starting test user seeding...');
  await seedDefaultOrganizations();
  await seedTestUsers();
  seedingComplete = true;
  console.log('[Auth] Test user seeding complete');
}

// NOTE: Removed auto-call - now called from index.ts after database initialization
// This ensures database is connected before seeding

interface LoginBody {
  email: string;
  password: string;
}

interface RegisterBody {
  email: string;
  password: string;
  name: string;
}

export async function authRoutes(app: FastifyInstance) {
  // Login endpoint
  app.post<{ Body: LoginBody }>('/api/v1/auth/login', async (request, reply) => {
    // Feature #2099: Guard against race conditions during server initialization
    if (!seedingComplete) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Server is initializing, please try again shortly',
      });
    }

    const { email, password } = request.body;

    if (!email || !password) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Email and password are required',
      });
    }

    // Feature #2116: Use async DB call instead of Map
    const user = await dbGetUserByEmail(email);

    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    // Get user's organization
    const organizationId = await getUserOrganization(user.id);

    // If user is not a member of any organization, deny login
    if (!organizationId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Your account is not associated with any organization. Please contact an administrator.',
      });
    }

    // Feature #213: Generate short-lived access token (1 hour)
    const token = app.jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: organizationId,
      },
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Feature #213: Generate long-lived refresh token (7 days)
    const refreshToken = generateRefreshToken(user.id, user.email, organizationId);
    storeRefreshToken(refreshToken, user.id);

    // Feature #2116: Create session using async DB call
    const session = await createSessionForUser(user.id, token, request);

    return {
      token,
      refresh_token: refreshToken,
      session_id: session.id,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS, // 1 hour in seconds
      refreshExpiresIn: REFRESH_TOKEN_EXPIRY_SECONDS, // 7 days in seconds
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: user.role,
        organization_id: organizationId,
      },
    };
  });

  // Register endpoint
  app.post<{ Body: RegisterBody }>('/api/v1/auth/register', async (request, reply) => {
    // Feature #2099: Guard against race conditions during server initialization
    if (!seedingComplete) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Server is initializing, please try again shortly',
      });
    }

    const { email, password, name } = request.body;

    if (!email || !password || !name) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Email, password, and name are required',
      });
    }

    // Password validation
    if (password.length < 8) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Password must be at least 8 characters long',
      });
    }

    if (!/[A-Z]/.test(password)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Password must contain at least one uppercase letter',
      });
    }

    if (!/[a-z]/.test(password)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Password must contain at least one lowercase letter',
      });
    }

    if (!/[0-9]/.test(password)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Password must contain at least one number',
      });
    }

    // Feature #2116: Check if user already exists using async DB call
    const existingUser = await dbUserExists(email);
    if (existingUser) {
      return reply.status(409).send({
        error: 'Conflict',
        message: 'User with this email already exists',
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    // Feature #2095: Use proper UUID format instead of simple string IDs
    const id = crypto.randomUUID();

    const user: User = {
      id,
      email,
      password_hash,
      name,
      role: 'developer', // Default role for new users
      email_verified: false,
      created_at: new Date(),
    };

    // Feature #2116: Use async DB call instead of Map
    await dbCreateUser(user);

    // Create a default organization for the new user
    // Feature #2095: Use proper UUID format instead of timestamp string
    const orgId = crypto.randomUUID();
    const orgName = `${name}'s Organization`;
    await repoCreateOrganization({
      id: orgId,
      name: orgName,
      slug: orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      timezone: 'UTC',
      created_at: new Date(),
    });

    // Add user as owner of the organization
    await repoAddOrganizationMember({
      user_id: user.id,
      organization_id: orgId,
      role: 'owner',
    });

    // Update user role to owner since they own their organization
    user.role = 'owner';
    await dbUpdateUser(email, { role: 'owner' });

    // Feature #213: Generate short-lived access token (1 hour)
    const token = app.jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: orgId,
      },
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Feature #213: Generate long-lived refresh token (7 days)
    const refreshToken = generateRefreshToken(user.id, user.email, orgId);
    storeRefreshToken(refreshToken, user.id);

    // Feature #2116: Create session using async DB call
    const session = await createSessionForUser(user.id, token, request);

    return reply.status(201).send({
      token,
      refresh_token: refreshToken,
      session_id: session.id,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS, // 1 hour in seconds
      refreshExpiresIn: REFRESH_TOKEN_EXPIRY_SECONDS, // 7 days in seconds
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  });

  // Get current user endpoint
  app.get('/api/v1/auth/me', {
    preHandler: [
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          await request.jwtVerify();

          // Feature #2116: Check if token is blacklisted using async DB call
          const authHeader = request.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            if (await dbIsTokenBlacklisted(token)) {
              return reply.status(401).send({
                error: 'Unauthorized',
                message: 'Token has been invalidated',
              });
            }
          }
        } catch {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Invalid or expired token',
          });
        }
      },
    ],
  }, async (request) => {
    const decoded = request.user as { id: string; email: string; role: string; organization_id?: string };
    // Feature #2116: Use async DB call instead of Map
    const user = await dbGetUserByEmail(decoded.email);

    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }

    // Get organization_id from JWT token or look it up
    const organizationId = decoded.organization_id || await getUserOrganization(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: user.role,
        organization_id: organizationId,
      },
    };
  });

  // Logout endpoint - invalidates the token by adding to blacklist
  app.post<{ Body: { refresh_token?: string } }>('/api/v1/auth/logout', {
    preHandler: [
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          await request.jwtVerify();
        } catch {
          // Allow logout even with invalid token
          return;
        }
      },
    ],
  }, async (request) => {
    // Feature #2116: Use async DB call to blacklist access token
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await dbBlacklistToken(token);
    }

    // Feature #213: Also revoke the refresh token if provided
    const { refresh_token } = request.body || {};
    if (refresh_token) {
      revokeRefreshToken(refresh_token);
    }

    return { message: 'Logged out successfully' };
  });

  // Feature #213: Refresh token endpoint - exchange refresh token for new access token
  app.post<{ Body: { refresh_token: string } }>('/api/v1/auth/refresh', async (request, reply) => {
    const { refresh_token } = request.body;

    if (!refresh_token) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Refresh token is required',
      });
    }

    // Verify the refresh token is not revoked
    if (!isRefreshTokenValid(refresh_token)) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Refresh token has been revoked or expired',
      });
    }

    // Verify and decode the refresh token
    let payload: any;
    try {
      payload = verifyRefreshToken(refresh_token);
    } catch (err) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token',
      });
    }

    // Ensure it's a refresh token
    if (payload.type !== 'refresh') {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid token type',
      });
    }

    // Get user to ensure they still exist and are valid
    const user = await dbGetUserByEmail(payload.email);
    if (!user) {
      revokeRefreshToken(refresh_token);
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    // Get current organization (may have changed)
    const organizationId = await getUserOrganization(user.id);
    if (!organizationId) {
      revokeRefreshToken(refresh_token);
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'User is not associated with any organization',
      });
    }

    // Generate new access token
    const newAccessToken = app.jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: organizationId,
      },
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    return {
      token: newAccessToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: user.role,
        organization_id: organizationId,
      },
    };
  });

  // Test endpoint to generate a short-lived token (for testing session expiration)
  app.post<{ Body: LoginBody }>('/api/v1/auth/login-short', async (request, reply) => {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Email and password are required',
      });
    }

    // Feature #2116: Use async DB call instead of Map
    const user = await dbGetUserByEmail(email);

    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    // Get user's organization
    const organizationId = await getUserOrganization(user.id);

    // Generate JWT token that expires in 2 seconds (for testing)
    const token = app.jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: organizationId || DEFAULT_ORG_ID,
      },
      { expiresIn: '2s' }
    );

    return {
      token,
      expiresIn: 2, // 2 seconds
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: user.role,
      },
    };
  });

  // Forgot password endpoint - request a password reset link
  app.post<{ Body: { email: string } }>('/api/v1/auth/forgot-password', async (request, reply) => {
    const { email } = request.body;

    if (!email) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Email is required',
      });
    }

    // Generate a reset token regardless of whether the user exists
    // This prevents email enumeration attacks
    const token = crypto.randomUUID() + '-' + crypto.randomUUID();

    // Feature #2116: Use async DB call instead of Map
    const user = await dbGetUserByEmail(email);
    if (user) {
      // Store the reset token using async DB call
      await dbCreateResetToken({
        email: email,
        token: token,
        createdAt: new Date(),
        used: false,
      });

      // In development, log the reset link to console
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
      console.log('\n========================================');
      console.log('PASSWORD RESET LINK (Development Mode)');
      console.log('========================================');
      console.log(`Email: ${email}`);
      console.log(`Reset Link: ${resetLink}`);
      console.log('Token expires in 1 hour');
      console.log('========================================\n');
    }

    // Always return success to prevent email enumeration
    return {
      message: 'If an account with that email exists, a password reset link has been sent.',
    };
  });

  // Reset password endpoint - reset password using token
  app.post<{ Body: { token: string; password: string } }>('/api/v1/auth/reset-password', async (request, reply) => {
    const { token, password } = request.body;

    if (!token || !password) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Token and new password are required',
      });
    }

    // Validate password
    if (password.length < 8) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Password must be at least 8 characters long',
      });
    }

    if (!/[A-Z]/.test(password)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Password must contain at least one uppercase letter',
      });
    }

    if (!/[a-z]/.test(password)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Password must contain at least one lowercase letter',
      });
    }

    if (!/[0-9]/.test(password)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Password must contain at least one number',
      });
    }

    // Feature #2116: Find the reset token using async DB call
    const resetToken = await dbGetResetToken(token);

    if (!resetToken) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid or expired reset token',
      });
    }

    // Check if token has been used
    if (resetToken.used) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'This reset link has already been used',
      });
    }

    // Check if token is expired (1 hour)
    const tokenAge = Date.now() - resetToken.createdAt.getTime();
    const oneHour = 60 * 60 * 1000;
    if (tokenAge > oneHour) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Reset token has expired. Please request a new one.',
      });
    }

    // Feature #2116: Get the user using async DB call
    const user = await dbGetUserByEmail(resetToken.email);
    if (!user) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'User not found',
      });
    }

    // Feature #2116: Update the password using async DB call
    const newPasswordHash = await bcrypt.hash(password, 10);
    await dbUpdateUser(resetToken.email, { password_hash: newPasswordHash });

    // Feature #2116: Mark token as used using async DB call
    await dbMarkResetTokenUsed(token);

    console.log(`\n[PASSWORD RESET] Password successfully reset for: ${user.email}\n`);

    return {
      message: 'Password has been reset successfully. You can now login with your new password.',
    };
  });

  // Session management endpoints

  // Get all active sessions for the current user
  app.get('/api/v1/auth/sessions', {
    preHandler: [
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          await request.jwtVerify();
          // Feature #2116: Use async DB call for token blacklist check
          const authHeader = request.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            if (await dbIsTokenBlacklisted(token)) {
              return reply.status(401).send({
                error: 'Unauthorized',
                message: 'Token has been invalidated',
              });
            }
          }
        } catch {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Invalid or expired token',
          });
        }
      },
    ],
  }, async (request) => {
    const decoded = request.user as { id: string };
    // Feature #2116: Use async DB call instead of Map
    const sessions = await dbGetUserSessions(decoded.id);

    // Get current token to identify current session
    const authHeader = request.headers.authorization;
    const currentToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    // Feature #2116: Filter out blacklisted sessions using async check
    const activeSessionPromises = sessions.map(async (session) => {
      const isBlacklisted = await dbIsTokenBlacklisted(session.token);
      if (isBlacklisted) return null;
      return {
        id: session.id,
        device: session.device,
        browser: session.browser,
        ip_address: session.ip_address,
        last_active: session.last_active,
        created_at: session.created_at,
        is_current: session.token === currentToken,
      };
    });
    const results = await Promise.all(activeSessionPromises);
    const activeSessions = results.filter(s => s !== null);

    return { sessions: activeSessions };
  });

  // Invalidate a specific session
  app.delete<{ Params: { sessionId: string } }>('/api/v1/auth/sessions/:sessionId', {
    preHandler: [
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          await request.jwtVerify();
          // Feature #2116: Use async DB call for token blacklist check
          const authHeader = request.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            if (await dbIsTokenBlacklisted(token)) {
              return reply.status(401).send({
                error: 'Unauthorized',
                message: 'Token has been invalidated',
              });
            }
          }
        } catch {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Invalid or expired token',
          });
        }
      },
    ],
  }, async (request, reply) => {
    const decoded = request.user as { id: string };
    const { sessionId } = request.params;
    // Feature #2116: Use async DB call instead of Map
    const sessions = await dbGetUserSessions(decoded.id);

    // Find the session to invalidate
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Session not found',
      });
    }

    // Feature #2116: Add the session's token to the blacklist using async DB call
    await dbBlacklistToken(session.token);

    // Feature #2116: Remove session from DB
    await dbDeleteSession(sessionId, decoded.id);

    return { message: 'Session invalidated successfully' };
  });

  // Logout all sessions except current
  app.post('/api/v1/auth/sessions/logout-all', {
    preHandler: [
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          await request.jwtVerify();
          // Feature #2116: Use async DB call for token blacklist check
          const authHeader = request.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            if (await dbIsTokenBlacklisted(token)) {
              return reply.status(401).send({
                error: 'Unauthorized',
                message: 'Token has been invalidated',
              });
            }
          }
        } catch {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Invalid or expired token',
          });
        }
      },
    ],
  }, async (request) => {
    const decoded = request.user as { id: string };
    // Feature #2116: Use async DB call instead of Map
    const sessions = await dbGetUserSessions(decoded.id);

    // Get current token
    const authHeader = request.headers.authorization;
    const currentToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    // Feature #2116: Find current session ID for deleteOtherSessions
    const currentSession = sessions.find(s => s.token === currentToken);

    // Blacklist all other session tokens
    let invalidatedCount = 0;
    for (const session of sessions) {
      if (session.token !== currentToken) {
        const isAlreadyBlacklisted = await dbIsTokenBlacklisted(session.token);
        if (!isAlreadyBlacklisted) {
          await dbBlacklistToken(session.token);
          invalidatedCount++;
        }
      }
    }

    // Feature #2116: Delete other sessions from DB
    if (currentSession) {
      await dbDeleteOtherSessions(decoded.id, currentSession.id);
    }

    return {
      message: `Logged out ${invalidatedCount} other session(s) successfully`,
      invalidated_count: invalidatedCount,
    };
  });
}
