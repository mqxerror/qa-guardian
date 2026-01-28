import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { getUserOrganization, organizations, organizationMembers, DEFAULT_ORG_ID } from './organizations';

// Feature #2083: Import repository functions for database persistence
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
  getMemoryUsers,
  getMemoryTokenBlacklist,
  getMemoryUserSessions,
  getMemoryResetTokens,
} from '../services/repositories/auth';

// Re-export types for backward compatibility
export type { User, Session, ResetToken };

// Feature #2083: These Maps are now backed by the repository's memory stores
// They provide backward compatibility for synchronous code
export const users: Map<string, User> = getMemoryUsers();
export const tokenBlacklist: Set<string> = getMemoryTokenBlacklist();
export const userSessions: Map<string, Session[]> = getMemoryUserSessions();

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

// Helper function to create a session for a user
function createSession(userId: string, token: string, request: FastifyRequest): Session {
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

  // Add to user's sessions
  const sessions = userSessions.get(userId) || [];
  sessions.push(session);
  userSessions.set(userId, sessions);

  return session;
}

// Feature #2083: resetTokens Map backed by repository memory store
export const resetTokens: Map<string, ResetToken> = getMemoryResetTokens();

// Seed some test users for development
// Feature #2083: Now uses async repository function
// Feature #2083: Initialize test users using repository
async function initTestUsers() {
  await seedTestUsers();
}

// Initialize test users
initTestUsers();

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
    const { email, password } = request.body;

    if (!email || !password) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Email and password are required',
      });
    }

    const user = users.get(email);

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
    const organizationId = getUserOrganization(user.id);

    // If user is not a member of any organization, deny login
    if (!organizationId) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Your account is not associated with any organization. Please contact an administrator.',
      });
    }

    // Generate JWT token with 7 day expiration (configurable)
    const token = app.jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: organizationId,
      },
      { expiresIn: '7d' }
    );

    // Create a session for this login
    const session = createSession(user.id, token, request);

    return {
      token,
      session_id: session.id,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
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

    // Check if user already exists
    if (users.has(email)) {
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

    users.set(email, user);

    // Create a default organization for the new user
    // Feature #2095: Use proper UUID format instead of timestamp string
    const orgId = crypto.randomUUID();
    const orgName = `${name}'s Organization`;
    organizations.set(orgId, {
      id: orgId,
      name: orgName,
      slug: orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Add user as owner of the organization
    organizationMembers.set(orgId, [{
      user_id: user.id,
      role: 'owner',
      joined_at: new Date(),
    }]);

    // Update user role to owner since they own their organization
    user.role = 'owner';
    users.set(email, user);

    // Generate JWT token with 7 day expiration
    const token = app.jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: orgId,
      },
      { expiresIn: '7d' }
    );

    // Create a session for this registration
    const session = createSession(user.id, token, request);

    return reply.status(201).send({
      token,
      session_id: session.id,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
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

          // Check if token is blacklisted (logged out)
          const authHeader = request.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            if (tokenBlacklist.has(token)) {
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
    const user = users.get(decoded.email);

    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }

    // Get organization_id from JWT token or look it up
    const organizationId = decoded.organization_id || getUserOrganization(user.id);

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
  app.post('/api/v1/auth/logout', {
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
    // Get token from Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      tokenBlacklist.add(token);
    }
    return { message: 'Logged out successfully' };
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

    const user = users.get(email);

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
    const organizationId = getUserOrganization(user.id);

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

    // Only store and log if user exists (but don't reveal this to the client)
    const user = users.get(email);
    if (user) {
      // Store the reset token
      resetTokens.set(token, {
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

    // Find the reset token
    const resetToken = resetTokens.get(token);

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

    // Get the user
    const user = users.get(resetToken.email);
    if (!user) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'User not found',
      });
    }

    // Update the password
    user.password_hash = await bcrypt.hash(password, 10);
    users.set(resetToken.email, user);

    // Mark token as used
    resetToken.used = true;
    resetTokens.set(token, resetToken);

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
          const authHeader = request.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            if (tokenBlacklist.has(token)) {
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
    const sessions = userSessions.get(decoded.id) || [];

    // Get current token to identify current session
    const authHeader = request.headers.authorization;
    const currentToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    // Filter out sessions that have been blacklisted and mark current session
    const activeSessions = sessions
      .filter(session => !tokenBlacklist.has(session.token))
      .map(session => ({
        id: session.id,
        device: session.device,
        browser: session.browser,
        ip_address: session.ip_address,
        last_active: session.last_active,
        created_at: session.created_at,
        is_current: session.token === currentToken,
      }));

    return { sessions: activeSessions };
  });

  // Invalidate a specific session
  app.delete<{ Params: { sessionId: string } }>('/api/v1/auth/sessions/:sessionId', {
    preHandler: [
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          await request.jwtVerify();
          const authHeader = request.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            if (tokenBlacklist.has(token)) {
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
    const sessions = userSessions.get(decoded.id) || [];

    // Find the session to invalidate
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Session not found',
      });
    }

    // Add the session's token to the blacklist
    tokenBlacklist.add(session.token);

    // Remove session from the list
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    userSessions.set(decoded.id, updatedSessions);

    return { message: 'Session invalidated successfully' };
  });

  // Logout all sessions except current
  app.post('/api/v1/auth/sessions/logout-all', {
    preHandler: [
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          await request.jwtVerify();
          const authHeader = request.headers.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            if (tokenBlacklist.has(token)) {
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
    const sessions = userSessions.get(decoded.id) || [];

    // Get current token
    const authHeader = request.headers.authorization;
    const currentToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    // Add all session tokens except current to the blacklist
    let invalidatedCount = 0;
    sessions.forEach(session => {
      if (session.token !== currentToken && !tokenBlacklist.has(session.token)) {
        tokenBlacklist.add(session.token);
        invalidatedCount++;
      }
    });

    // Keep only the current session
    const updatedSessions = sessions.filter(s => s.token === currentToken);
    userSessions.set(decoded.id, updatedSessions);

    return {
      message: `Logged out ${invalidatedCount} other session(s) successfully`,
      invalidated_count: invalidatedCount,
    };
  });
}
