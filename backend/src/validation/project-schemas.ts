/**
 * Project Validation Schemas
 * Extracted from schemas.ts - project CRUD, settings, members, env vars
 */

import { z } from 'zod';
import { uuidSchema } from './common-schemas.js';

// ============================================================================
// Project Schemas
// ============================================================================

/**
 * Create project request body
 */
export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(255, 'Project name must be less than 255 characters'),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  description: z
    .string()
    .max(2000, 'Description must be less than 2000 characters')
    .optional(),
  base_url: z
    .string()
    .url('Invalid URL format')
    .optional()
    .nullable(),
  settings: z.record(z.unknown()).optional(),
  visual_settings: z.record(z.unknown()).optional(),
  healing_settings: z.record(z.unknown()).optional(),
});

/**
 * Update project request body
 */
export const updateProjectSchema = createProjectSchema.partial();

/**
 * Project ID parameter
 */
export const projectIdParamsSchema = z.object({
  id: uuidSchema,
});

// ============================================================================
// Feature #714: Project Route Schemas
// ============================================================================

/**
 * Project list query parameters
 */
export const projectListQuerySchema = z.object({
  include_archived: z.string().optional(),
  archived_only: z.string().optional(),
});

/**
 * Project archive request body
 */
export const projectArchiveSchema = z.object({
  archived: z.boolean(),
});

/**
 * Project environment variable ID params
 */
export const projectEnvVarParamsSchema = z.object({
  id: uuidSchema,
  varId: uuidSchema,
});

/**
 * Create environment variable request body
 */
export const createEnvVarSchema = z.object({
  key: z
    .string()
    .min(1, 'Key is required')
    .transform(s => s.trim().toUpperCase())
    .refine(
      s => /^[A-Z_][A-Z0-9_]*$/.test(s),
      'Key must start with a letter or underscore and contain only letters, numbers, and underscores'
    ),
  value: z.string(),
  is_secret: z.boolean().default(false),
});

/**
 * Update environment variable request body
 */
export const updateEnvVarSchema = z.object({
  value: z.string().optional(),
  is_secret: z.boolean().optional(),
});

/**
 * Quick smoke test request body
 */
export const quickSmokeTestSchema = z.object({
  target_url: z.string().url('Invalid URL format').optional(),
});

// ============================================================================
// Feature #732: Project Settings
// ============================================================================

/**
 * Project visual settings update body
 */
export const projectVisualSettingsBodySchema = z.object({
  default_diff_threshold: z.number().min(0).max(100).optional(),
  default_diff_threshold_mode: z.enum(['percentage', 'pixel_count']).optional(),
  default_diff_pixel_threshold: z.number().min(0).optional(),
  default_capture_mode: z.enum(['full_page', 'viewport', 'element']).optional(),
  default_viewport_width: z.number().int().min(100).max(10000).optional(),
  default_viewport_height: z.number().int().min(100).max(10000).optional(),
});

/**
 * Project healing settings update body
 */
export const projectHealingSettingsBodySchema = z.object({
  healing_enabled: z.boolean().optional(),
  healing_timeout: z.number().int().min(5).max(120).optional(),
  max_healing_attempts: z.number().int().min(1).max(10).optional(),
  healing_strategies: z.array(
    z.enum(['selector_fallback', 'visual_match', 'text_match', 'attribute_match', 'css_selector', 'xpath'])
  ).optional(),
  notify_on_healing: z.boolean().optional(),
  auto_heal_confidence_threshold: z.number().min(0.5).max(1.0).optional(),
});

/**
 * Project settings projectId param
 */
export const projectSettingsParamsSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
});

// ============================================================================
// Project Members
// ============================================================================

/**
 * Project member params
 */
export const projectMemberParamsSchema = z.object({
  projectId: z.string().min(1),
  memberId: z.string().min(1),
});

/**
 * Add project member body
 */
export const addProjectMemberBodySchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
  role: z.enum(['developer', 'viewer']),
});

/**
 * Update project member role body
 */
export const updateProjectMemberRoleBodySchema = z.object({
  role: z.enum(['developer', 'viewer']),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;
export type ProjectArchiveInput = z.infer<typeof projectArchiveSchema>;
export type ProjectEnvVarParams = z.infer<typeof projectEnvVarParamsSchema>;
export type CreateEnvVarInput = z.infer<typeof createEnvVarSchema>;
export type UpdateEnvVarInput = z.infer<typeof updateEnvVarSchema>;
export type QuickSmokeTestInput = z.infer<typeof quickSmokeTestSchema>;
export type ProjectVisualSettingsBody = z.infer<typeof projectVisualSettingsBodySchema>;
export type ProjectHealingSettingsBody = z.infer<typeof projectHealingSettingsBodySchema>;
export type AddProjectMemberBody = z.infer<typeof addProjectMemberBodySchema>;
export type UpdateProjectMemberRoleBody = z.infer<typeof updateProjectMemberRoleBodySchema>;
