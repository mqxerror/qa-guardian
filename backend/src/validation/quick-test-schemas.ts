/**
 * Quick Test Validation Schemas
 * Extracted from schemas.ts - quick test CRUD, compare, schedule, history
 */

import { z } from 'zod';
import { uuidSchema } from './common-schemas.js';

// ============================================================================
// Feature #715: Quick Test Schemas
// ============================================================================

/**
 * Quick test run ID parameter
 */
export const quickTestRunIdParamsSchema = z.object({
  runId: uuidSchema,
});

/**
 * Quick test compare ID parameter
 */
export const quickTestCompareIdParamsSchema = z.object({
  compareId: uuidSchema,
});

/**
 * Quick test schedule ID parameter
 */
export const quickTestScheduleIdParamsSchema = z.object({
  scheduleId: uuidSchema,
});

/**
 * Quick test screenshot params
 */
export const quickTestScreenshotParamsSchema = z.object({
  runId: uuidSchema,
  type: z.enum(['desktop', 'mobile']),
});

/**
 * Quick test body (POST /quick-test)
 */
export const quickTestBodySchema = z.object({
  url: z.string().url('Invalid URL format'),
  browser: z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
});

/**
 * Quick test compare body
 */
export const quickTestCompareBodySchema = z.object({
  urlA: z.string().url('Invalid URL format for urlA'),
  urlB: z.string().url('Invalid URL format for urlB'),
});

/**
 * Quick test schedule body
 */
export const quickTestScheduleBodySchema = z.object({
  url: z.string().url('Invalid URL format'),
  name: z.string().min(1, 'Name is required').max(255),
  cron_expression: z.string().min(1, 'Cron expression is required'),
  notify_on_score_drop: z.boolean().default(true),
  score_threshold: z.number().min(0).max(100).default(70),
});

/**
 * Quick test schedule update body
 */
export const quickTestScheduleUpdateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  cron_expression: z.string().optional(),
  enabled: z.boolean().optional(),
  notify_on_score_drop: z.boolean().optional(),
  score_threshold: z.number().min(0).max(100).optional(),
});

/**
 * Quick test history query
 */
export const quickTestHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['running', 'completed', 'failed']).optional(),
});

/**
 * Quick test schedules list query
 */
export const quickTestSchedulesQuerySchema = z.object({
  enabled: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ============================================================================
// Type Exports
// ============================================================================

export type QuickTestRunIdParams = z.infer<typeof quickTestRunIdParamsSchema>;
export type QuickTestCompareIdParams = z.infer<typeof quickTestCompareIdParamsSchema>;
export type QuickTestScheduleIdParams = z.infer<typeof quickTestScheduleIdParamsSchema>;
export type QuickTestScreenshotParams = z.infer<typeof quickTestScreenshotParamsSchema>;
export type QuickTestBodyInput = z.infer<typeof quickTestBodySchema>;
export type QuickTestCompareBodyInput = z.infer<typeof quickTestCompareBodySchema>;
export type QuickTestScheduleBodyInput = z.infer<typeof quickTestScheduleBodySchema>;
export type QuickTestScheduleUpdateBodyInput = z.infer<typeof quickTestScheduleUpdateBodySchema>;
export type QuickTestHistoryQuery = z.infer<typeof quickTestHistoryQuerySchema>;
export type QuickTestSchedulesQuery = z.infer<typeof quickTestSchedulesQuerySchema>;
