/**
 * Authentication Validation Schemas
 * Extracted from schemas.ts - login, register, logout, password reset, session
 */

import { z } from 'zod';
import { uuidSchema } from './common-schemas.js';

// ============================================================================
// Authentication Schemas
// ============================================================================

/**
 * Login request body
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Register request body
 */
export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be less than 100 characters'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters'),
  organization_name: z
    .string()
    .min(1, 'Organization name is required')
    .max(255)
    .optional(),
});

// ============================================================================
// Auth Extended Schemas (Feature #713)
// ============================================================================

/**
 * Logout request body
 */
export const logoutSchema = z.object({
  refresh_token: z.string().optional(),
});

/**
 * Refresh token request body
 */
export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

/**
 * Forgot password request body
 */
export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

/**
 * Reset password request body
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

/**
 * Session ID parameter
 */
export const sessionIdParamsSchema = z.object({
  sessionId: uuidSchema,
});

// ============================================================================
// Type Exports
// ============================================================================

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SessionIdParams = z.infer<typeof sessionIdParamsSchema>;
