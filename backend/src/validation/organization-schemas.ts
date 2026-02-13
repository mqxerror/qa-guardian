/**
 * Organization Validation Schemas
 * Extracted from schemas.ts - organization CRUD, members, invitations, settings
 */

import { z } from 'zod';
import { uuidSchema } from './common-schemas.js';

// ============================================================================
// Organization Schemas (Feature #713)
// ============================================================================

/**
 * Organization member role enum
 */
export const memberRoleSchema = z.enum(['owner', 'admin', 'developer', 'viewer']);

/**
 * Invitation role enum (excludes 'owner')
 */
export const invitationRoleSchema = z.enum(['admin', 'developer', 'viewer']);

/**
 * Organization ID parameter
 */
export const orgIdParamsSchema = z.object({
  id: uuidSchema,
});

/**
 * Organization switch request body
 */
export const switchOrganizationSchema = z.object({
  organization_id: uuidSchema,
});

/**
 * Create organization request body
 */
export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, 'Organization name is required')
    .max(100, 'Organization name must be 100 characters or less')
    .transform(s => s.trim()),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .max(100)
    .optional(),
  timezone: z.string().default('UTC'),
});

/**
 * Update organization request body
 */
export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  timezone: z.string().optional(),
});

/**
 * Delete organization request body (requires password confirmation)
 */
export const deleteOrganizationSchema = z.object({
  password: z.string().min(1, 'Password confirmation is required'),
});

/**
 * Create invitation request body
 */
export const createInvitationSchema = z.object({
  email: z.string().email('Invalid email format'),
  role: invitationRoleSchema,
});

/**
 * Invitation ID parameter
 */
export const inviteIdParamsSchema = z.object({
  inviteId: uuidSchema,
});

/**
 * Organization invitation delete params
 */
export const orgInviteParamsSchema = z.object({
  id: uuidSchema,
  inviteId: uuidSchema,
});

/**
 * Organization member params
 */
export const orgMemberParamsSchema = z.object({
  id: uuidSchema,
  memberId: uuidSchema,
});

/**
 * Update member role request body
 */
export const updateMemberRoleSchema = z.object({
  role: invitationRoleSchema,
});

/**
 * Transfer ownership request body
 */
export const transferOwnershipSchema = z.object({
  new_owner_id: uuidSchema,
  password: z.string().min(1, 'Password confirmation is required'),
});

/**
 * Team metrics query parameters
 */
export const teamMetricsQuerySchema = z.object({
  period: z
    .string()
    .regex(/^\d+[dhw]$/, 'Invalid period format. Use formats like 7d, 14d, 30d, or 4w')
    .optional()
    .default('30d'),
  include_trends: z
    .string()
    .optional()
    .default('true'),
  include_activity: z
    .string()
    .optional()
    .default('true'),
});

/**
 * Retry strategy test ID parameter
 */
export const retryStrategyTestIdParamsSchema = z.object({
  testId: uuidSchema,
});

// ============================================================================
// Organization Settings
// ============================================================================

/**
 * Org settings params
 */
export const orgSettingsParamsSchema = z.object({
  orgId: z.string().min(1, 'Organization ID is required'),
});

/**
 * Retention policy body
 */
export const retentionPolicyBodySchema = z.object({
  retention_days: z.number().int().min(1).max(365),
});

/**
 * Diff color settings body
 */
export const diffColorSettingsBodySchema = z.object({
  diff_color: z.array(z.number().int().min(0).max(255)).length(3).optional(),
  diff_color_alt: z.array(z.number().int().min(0).max(255)).length(3).optional(),
  preset: z.string().max(50).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type OrgIdParams = z.infer<typeof orgIdParamsSchema>;
export type SwitchOrganizationInput = z.infer<typeof switchOrganizationSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type DeleteOrganizationInput = z.infer<typeof deleteOrganizationSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type InviteIdParams = z.infer<typeof inviteIdParamsSchema>;
export type OrgInviteParams = z.infer<typeof orgInviteParamsSchema>;
export type OrgMemberParams = z.infer<typeof orgMemberParamsSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
export type TeamMetricsQuery = z.infer<typeof teamMetricsQuerySchema>;
export type RetryStrategyTestIdParams = z.infer<typeof retryStrategyTestIdParamsSchema>;
export type RetentionPolicyBody = z.infer<typeof retentionPolicyBodySchema>;
