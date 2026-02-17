/**
 * Quick Test Module - Schedule Routes
 * Feature #730: Split quick-test/routes.ts into sub-modules
 *
 * Provides CRUD routes for quick test schedules (recurring monitoring).
 * Feature #474: Scheduled Quick Tests
 * Feature #671: Database persistence for schedules
 */

import { FastifyInstance } from 'fastify';
import { authenticate, requireScopes, getOrganizationId, type JwtPayload } from '../../middleware/auth.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  quickTestScheduleBodySchema,
  quickTestScheduleUpdateBodySchema,
  quickTestScheduleIdParamsSchema,
  quickTestSchedulesQuerySchema,
} from '../../validation/index.js';
import { logAuditEntry } from '../audit-logs.js';
import { validateWebhookURLWithDNS } from '../../utils/index.js';
import {
  createQuickTestSchedule,
  listQuickTestSchedules,
  getQuickTestScheduleById,
  updateQuickTestSchedule,
  deleteQuickTestSchedule,
} from '../../services/repositories/quick-test.js';
// Feature #685: Cron expression validation
import { validateCronExpression } from '../../utils/cron-parser.js';
import { sendError } from '../../utils/errors.js';
import type { QuickTestScheduleBody } from './helpers.js';

export async function scheduleRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/quick-test/schedules
   * Feature #474: Create a scheduled Quick Test for recurring monitoring
   */
  // Feature #715: Zod validation for schedule body
  app.post<{ Body: QuickTestScheduleBody }>(
    '/api/v1/quick-test/schedules',
    {
      preHandler: [authenticate, requireScopes(['execute'])],
      preValidation: [validateBody(quickTestScheduleBodySchema)],
      schema: {
        tags: ['Quick Test'],
        summary: 'Create a scheduled Quick Test',
        description: 'Creates a recurring Quick Test schedule for monitoring a URL',
        body: {
          type: 'object',
          required: ['url', 'name', 'cron_expression'],
          properties: {
            url: {
              type: 'string',
              format: 'uri',
              description: 'The URL to monitor',
            },
            name: {
              type: 'string',
              description: 'Schedule name',
            },
            cron_expression: {
              type: 'string',
              description: 'Cron expression for schedule (e.g., "0 */6 * * *" for every 6 hours)',
            },
            notify_on_score_drop: {
              type: 'boolean',
              default: true,
              description: 'Whether to send alerts when score drops',
            },
            score_threshold: {
              type: 'number',
              default: 70,
              description: 'Score threshold for alerts (0-100)',
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              url: { type: 'string' },
              name: { type: 'string' },
              cron_expression: { type: 'string' },
              notify_on_score_drop: { type: 'boolean' },
              score_threshold: { type: 'number' },
              enabled: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
              next_run_at: { type: 'string', format: 'date-time' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { url, name, cron_expression, notify_on_score_drop = true, score_threshold = 70 } = request.body;
      const user = request.user as JwtPayload;
      const orgId = getOrganizationId(request);

      // Validate URL
      if (!url) {
        return sendError(reply, 400, 'BAD_REQUEST', 'URL is required');
      }

      // SSRF protection
      // Feature #BMAD: Async DNS resolution to prevent DNS rebinding attacks
      const isProduction = process.env.NODE_ENV === 'production';
      const ssrfValidation = await validateWebhookURLWithDNS(url, {
        allowLocalhost: !isProduction,
      });

      if (!ssrfValidation.safe) {
        return sendError(reply, 400, 'BAD_REQUEST', ssrfValidation.error || 'URL is not allowed for security reasons');
      }

      // Feature #685: Validate cron expression before creating schedule
      const cronValidation = validateCronExpression(cron_expression);
      if (!cronValidation.valid) {
        return sendError(reply, 400, 'BAD_REQUEST', `Invalid cron expression: ${cronValidation.error}`);
      }

      // Feature #671: Persist schedule to database
      const schedule = await createQuickTestSchedule({
        organizationId: orgId,
        userId: user.id,
        url,
        name,
        cronExpression: cron_expression,
        notifyOnScoreDrop: notify_on_score_drop,
        scoreThreshold: score_threshold,
      });

      if (!schedule) {
        return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to create schedule');
      }

      // Log the schedule creation
      logAuditEntry(request, 'create', 'quick_test_schedule', schedule.id, `Quick test schedule created for ${url}`, {
        url,
        cron_expression,
        notify_on_score_drop,
        score_threshold,
        user_id: user.id,
      });

      return reply.status(201).send({
        id: schedule.id,
        organization_id: schedule.organizationId,
        url: schedule.url,
        name: schedule.name,
        cron_expression: schedule.cronExpression,
        notify_on_score_drop: schedule.notifyOnScoreDrop,
        score_threshold: schedule.scoreThreshold,
        enabled: schedule.enabled,
        created_at: schedule.createdAt.toISOString(),
        next_run_at: schedule.nextRunAt?.toISOString() ?? null,
      });
    }
  );

  /**
   * GET /api/v1/quick-test/schedules
   * Feature #671: List quick test schedules
   */
  // Feature #715: Zod validation for schedules list query
  app.get<{ Querystring: { enabled?: string; limit?: string; offset?: string } }>(
    '/api/v1/quick-test/schedules',
    {
      preHandler: [authenticate],
      preValidation: [validateQuery(quickTestSchedulesQuerySchema)],
      schema: {
        tags: ['Quick Test'],
        summary: 'List quick test schedules',
        description: 'Returns paginated list of quick test schedules for the organization',
        querystring: {
          type: 'object',
          properties: {
            enabled: { type: 'string', enum: ['true', 'false'] },
            limit: { type: 'string', default: '50' },
            offset: { type: 'string', default: '0' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              schedules: { type: 'array' },
              total: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const orgId = getOrganizationId(request);
      const { enabled, limit = '50', offset = '0' } = request.query;

      const result = await listQuickTestSchedules(orgId, {
        enabled: enabled ? enabled === 'true' : undefined,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      });

      return reply.send({
        schedules: result.schedules.map(s => ({
          id: s.id,
          url: s.url,
          name: s.name,
          cron_expression: s.cronExpression,
          enabled: s.enabled,
          notify_on_score_drop: s.notifyOnScoreDrop,
          score_threshold: s.scoreThreshold,
          created_at: s.createdAt.toISOString(),
          next_run_at: s.nextRunAt?.toISOString() ?? null,
          last_run_at: s.lastRunAt?.toISOString() ?? null,
          run_count: s.runCount,
        })),
        total: result.total,
      });
    }
  );

  /**
   * GET /api/v1/quick-test/schedules/:scheduleId
   * Feature #671: Get a specific quick test schedule
   */
  // Feature #715: Zod validation for schedule ID param
  app.get<{ Params: { scheduleId: string } }>(
    '/api/v1/quick-test/schedules/:scheduleId',
    {
      preHandler: [authenticate],
      preValidation: [validateParams(quickTestScheduleIdParamsSchema)],
      schema: {
        tags: ['Quick Test'],
        summary: 'Get quick test schedule details',
        params: {
          type: 'object',
          required: ['scheduleId'],
          properties: {
            scheduleId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { scheduleId } = request.params;
      const orgId = getOrganizationId(request);

      const schedule = await getQuickTestScheduleById(scheduleId);
      if (!schedule || schedule.organizationId !== orgId) {
        return sendError(reply, 404, 'NOT_FOUND', 'Schedule not found');
      }

      return reply.send({
        id: schedule.id,
        url: schedule.url,
        name: schedule.name,
        cron_expression: schedule.cronExpression,
        enabled: schedule.enabled,
        notify_on_score_drop: schedule.notifyOnScoreDrop,
        score_threshold: schedule.scoreThreshold,
        created_at: schedule.createdAt.toISOString(),
        next_run_at: schedule.nextRunAt?.toISOString() ?? null,
        last_run_at: schedule.lastRunAt?.toISOString() ?? null,
        run_count: schedule.runCount,
      });
    }
  );

  /**
   * PATCH /api/v1/quick-test/schedules/:scheduleId
   * Feature #671: Update a quick test schedule
   */
  // Feature #715: Zod validation for schedule update params + body
  app.patch<{
    Params: { scheduleId: string };
    Body: { name?: string; cron_expression?: string; enabled?: boolean; notify_on_score_drop?: boolean; score_threshold?: number };
  }>(
    '/api/v1/quick-test/schedules/:scheduleId',
    {
      preHandler: [authenticate],
      preValidation: [validateParams(quickTestScheduleIdParamsSchema), validateBody(quickTestScheduleUpdateBodySchema)],
      schema: {
        tags: ['Quick Test'],
        summary: 'Update quick test schedule',
        params: {
          type: 'object',
          required: ['scheduleId'],
          properties: {
            scheduleId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            cron_expression: { type: 'string' },
            enabled: { type: 'boolean' },
            notify_on_score_drop: { type: 'boolean' },
            score_threshold: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { scheduleId } = request.params;
      const orgId = getOrganizationId(request);
      const { name, cron_expression, enabled, notify_on_score_drop, score_threshold } = request.body;

      // Verify ownership
      const existing = await getQuickTestScheduleById(scheduleId);
      if (!existing || existing.organizationId !== orgId) {
        return sendError(reply, 404, 'NOT_FOUND', 'Schedule not found');
      }

      // Feature #685: Validate cron expression if being updated
      if (cron_expression) {
        const cronValidation = validateCronExpression(cron_expression);
        if (!cronValidation.valid) {
          return sendError(reply, 400, 'BAD_REQUEST', `Invalid cron expression: ${cronValidation.error}`);
        }
      }

      const updated = await updateQuickTestSchedule(scheduleId, {
        name,
        cronExpression: cron_expression,
        enabled,
        notifyOnScoreDrop: notify_on_score_drop,
        scoreThreshold: score_threshold,
      });

      if (!updated) {
        return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update schedule');
      }

      logAuditEntry(request, 'update', 'quick_test_schedule', scheduleId, 'Quick test schedule updated', {});

      return reply.send({
        id: updated.id,
        url: updated.url,
        name: updated.name,
        cron_expression: updated.cronExpression,
        enabled: updated.enabled,
        notify_on_score_drop: updated.notifyOnScoreDrop,
        score_threshold: updated.scoreThreshold,
        created_at: updated.createdAt.toISOString(),
        next_run_at: updated.nextRunAt?.toISOString() ?? null,
      });
    }
  );

  /**
   * DELETE /api/v1/quick-test/schedules/:scheduleId
   * Feature #671: Delete a quick test schedule
   */
  // Feature #715: Zod validation for schedule delete params
  app.delete<{ Params: { scheduleId: string } }>(
    '/api/v1/quick-test/schedules/:scheduleId',
    {
      preHandler: [authenticate],
      preValidation: [validateParams(quickTestScheduleIdParamsSchema)],
      schema: {
        tags: ['Quick Test'],
        summary: 'Delete quick test schedule',
        params: {
          type: 'object',
          required: ['scheduleId'],
          properties: {
            scheduleId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { scheduleId } = request.params;
      const orgId = getOrganizationId(request);

      // Verify ownership
      const existing = await getQuickTestScheduleById(scheduleId);
      if (!existing || existing.organizationId !== orgId) {
        return sendError(reply, 404, 'NOT_FOUND', 'Schedule not found');
      }

      const deleted = await deleteQuickTestSchedule(scheduleId);
      if (!deleted) {
        return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to delete schedule');
      }

      logAuditEntry(request, 'delete', 'quick_test_schedule', scheduleId, 'Quick test schedule deleted', {});

      return reply.status(204).send();
    }
  );
}
