// Step Templates Routes - Feature #31: Reusable Step Templates
// CRUD operations for step templates that can be shared across tests

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload, getOrganizationId } from '../middleware/auth.js';
import { query } from '../services/database.js';
import { QueryResult, QueryResultRow } from 'pg';
import crypto from 'crypto';
import { TestStep } from './test-suites/types.js';
// Feature #484: Pino structured logging
import { createLogger } from '../services/logger.js';
// Feature #509: Safe JSON parsing
import { safeJsonParseOrPassthrough } from '../utils/index.js';
import { sendError } from '../utils/errors.js';
// Feature #716: Zod validation middleware and schemas
import {
  validateBody,
  validateParams,
  validateQuery,
  stepTemplateIdParamsSchema,
  createStepTemplateBodySchema,
  updateStepTemplateBodySchema,
  stepTemplatesQuerySchema,
} from '../validation/index.js';

const log = createLogger('step-templates');

// ============================================
// Column Constants for SELECT queries
// ============================================

const STEP_TEMPLATE_COLUMNS = `
  id, organization_id, suite_id, name, description, steps, tags, created_by, created_at, updated_at
`;

// TEST_COLUMNS reserved for future test template import feature
const _TEST_COLUMNS = `
  id, suite_id, project_id, name, description, type, config, code, enabled, priority, tags, created_at, updated_at
`;

// Helper to handle potentially null query results (when database not connected)
function ensureResult<T extends QueryResultRow>(result: QueryResult<T> | null): QueryResult<T> {
  if (!result) {
    // Return empty result when database not available
    return { rows: [] as T[], rowCount: 0, command: '', oid: 0, fields: [] };
  }
  return result;
}

// Types
interface StepTemplate {
  id: string;
  organization_id: string;
  suite_id?: string | null;
  name: string;
  description?: string;
  steps: TestStep[];
  tags: string[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

interface CreateTemplateBody {
  name: string;
  description?: string;
  steps: TestStep[];
  tags?: string[];
  suite_id?: string;
}

interface TemplateParams {
  templateId: string;
}

interface AppendStepsBody {
  steps: TestStep[];
}

interface TestParams {
  testId: string;
}

export async function stepTemplateRoutes(app: FastifyInstance) {

  // List step templates for the organization
  // Feature #716: Zod validation for step templates query
  app.get('/api/v1/step-templates', {
    preHandler: [authenticate],
    preValidation: [validateQuery(stepTemplatesQuerySchema)],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const { suite_id, search } = request.query as { suite_id?: string; search?: string };

    let sql = `SELECT ${STEP_TEMPLATE_COLUMNS} FROM step_templates WHERE organization_id = $1`;
    const params: unknown[] =[orgId];
    let paramIdx = 2;

    if (suite_id) {
      sql += ` AND (suite_id = $${paramIdx} OR suite_id IS NULL)`;
      params.push(suite_id);
      paramIdx++;
    }

    if (search) {
      sql += ` AND (name ILIKE $${paramIdx} OR description ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    sql += ` ORDER BY created_at DESC`;

    try {
      const result = ensureResult(await query(sql, params));
      return reply.send({
        templates: result.rows.map(row => ({
          ...row,
          steps: safeJsonParseOrPassthrough(row.steps, [] as TestStep[]),
          tags: row.tags || [],
        })),
        total: result.rowCount ?? 0,
      });
    } catch (error) {
      log.error({ err: error, orgId, code: 'TEMPLATE_LIST_FAILED' }, 'Failed to list step templates');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to list step templates');
    }
  });

  // Get a single step template
  // Feature #716: Zod validation for template ID param
  app.get<{ Params: TemplateParams }>('/api/v1/step-templates/:templateId', {
    preHandler: [authenticate],
    preValidation: [validateParams(stepTemplateIdParamsSchema)],
  }, async (request, reply) => {
    const { templateId } = request.params;
    const orgId = getOrganizationId(request);

    try {
      const result = ensureResult(await query(
        `SELECT ${STEP_TEMPLATE_COLUMNS} FROM step_templates WHERE id = $1 AND organization_id = $2`,
        [templateId, orgId]
      ));

      if ((result.rowCount ?? 0) === 0) {
        return sendError(reply, 404, 'NOT_FOUND', 'Step template not found');
      }

      const row = result.rows[0];
      return reply.send({
        template: {
          ...row,
          steps: safeJsonParseOrPassthrough(row.steps, [] as TestStep[]),
          tags: row.tags || [],
        },
      });
    } catch (error) {
      log.error({ err: error, templateId, orgId, code: 'TEMPLATE_GET_FAILED' }, 'Failed to get step template');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to get step template');
    }
  });

  // Create a new step template
  // Feature #716: Zod validation for template creation body
  app.post<{ Body: CreateTemplateBody }>('/api/v1/step-templates', {
    preHandler: [authenticate],
    preValidation: [validateBody(createStepTemplateBodySchema)],
  }, async (request, reply) => {
    const { name, description, steps, tags = [], suite_id } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    if (!name?.trim()) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Template name is required');
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return sendError(reply, 400, 'BAD_REQUEST', 'At least one step is required');
    }

    // Viewers cannot create templates
    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot create step templates');
    }

    const id = crypto.randomUUID();

    try {
      const result = ensureResult(await query(
        `INSERT INTO step_templates (id, organization_id, suite_id, name, description, steps, tags, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [id, orgId, suite_id || null, name.trim(), description || null, JSON.stringify(steps), tags, user.email]
      ));

      const row = result.rows[0];
      return reply.status(201).send({
        template: {
          ...row,
          steps: safeJsonParseOrPassthrough(row.steps, [] as TestStep[]),
          tags: row.tags || [],
        },
      });
    } catch (error) {
      log.error({ err: error, orgId, name, code: 'TEMPLATE_CREATE_FAILED' }, 'Failed to create step template');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to create step template');
    }
  });

  // Update a step template
  // Feature #716: Zod validation for template update params and body
  app.patch<{ Params: TemplateParams; Body: Partial<CreateTemplateBody> }>('/api/v1/step-templates/:templateId', {
    preHandler: [authenticate],
    preValidation: [validateParams(stepTemplateIdParamsSchema), validateBody(updateStepTemplateBodySchema)],
  }, async (request, reply) => {
    const { templateId } = request.params;
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;
    const { name, description, steps, tags, suite_id } = request.body;

    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot update step templates');
    }

    try {
      // Check exists
      const existing = ensureResult(await query(
        `SELECT ${STEP_TEMPLATE_COLUMNS} FROM step_templates WHERE id = $1 AND organization_id = $2`,
        [templateId, orgId]
      ));
      if ((existing.rowCount ?? 0) === 0) {
        return sendError(reply, 404, 'NOT_FOUND', 'Step template not found');
      }

      const updates: string[] = [];
      const params: unknown[] =[];
      let idx = 1;

      if (name !== undefined) { updates.push(`name = $${idx++}`); params.push(name.trim()); }
      if (description !== undefined) { updates.push(`description = $${idx++}`); params.push(description); }
      if (steps !== undefined) { updates.push(`steps = $${idx++}`); params.push(JSON.stringify(steps)); }
      if (tags !== undefined) { updates.push(`tags = $${idx++}`); params.push(tags); }
      if (suite_id !== undefined) { updates.push(`suite_id = $${idx++}`); params.push(suite_id || null); }

      if (updates.length === 0) {
        return sendError(reply, 400, 'BAD_REQUEST', 'No fields to update');
      }

      updates.push(`updated_at = NOW()`);
      params.push(templateId, orgId);

      const result = ensureResult(await query(
        `UPDATE step_templates SET ${updates.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx} RETURNING *`,
        params
      ));

      const row = result.rows[0];
      return reply.send({
        template: {
          ...row,
          steps: safeJsonParseOrPassthrough(row.steps, [] as TestStep[]),
          tags: row.tags || [],
        },
      });
    } catch (error) {
      log.error({ err: error, templateId, orgId, code: 'TEMPLATE_UPDATE_FAILED' }, 'Failed to update step template');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to update step template');
    }
  });

  // Delete a step template
  // Feature #716: Zod validation for template ID param
  app.delete<{ Params: TemplateParams }>('/api/v1/step-templates/:templateId', {
    preHandler: [authenticate],
    preValidation: [validateParams(stepTemplateIdParamsSchema)],
  }, async (request, reply) => {
    const { templateId } = request.params;
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;

    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot delete step templates');
    }

    try {
      const result = ensureResult(await query(
        `DELETE FROM step_templates WHERE id = $1 AND organization_id = $2 RETURNING id, name`,
        [templateId, orgId]
      ));

      if ((result.rowCount ?? 0) === 0) {
        return sendError(reply, 404, 'NOT_FOUND', 'Step template not found');
      }

      return reply.send({
        message: `Template "${result.rows[0]?.name ?? 'Unknown'}" deleted successfully`,
        id: templateId,
      });
    } catch (error) {
      log.error({ err: error, templateId, orgId, code: 'TEMPLATE_DELETE_FAILED' }, 'Failed to delete step template');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to delete step template');
    }
  });

  // Append steps from a template to an existing test
  app.post<{ Params: TestParams; Body: AppendStepsBody }>('/api/v1/tests/:testId/append-steps', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const { steps: newSteps } = request.body;
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;

    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot modify tests');
    }

    if (!newSteps || !Array.isArray(newSteps) || newSteps.length === 0) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Steps array is required');
    }

    try {
      // Get existing test
      const testResult = ensureResult(await query(
        `SELECT t.*, ts.organization_id FROM tests t JOIN test_suites ts ON t.suite_id = ts.id WHERE t.id = $1`,
        [testId]
      ));

      if ((testResult.rowCount ?? 0) === 0) {
        return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
      }

      const test = testResult.rows[0];
      if (test.organization_id !== orgId) {
        return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
      }

      // Parse existing config and append steps
      const config = safeJsonParseOrPassthrough(test.config, {} as Record<string, unknown>);
      const existingSteps = config.steps || [];
      const startOrder = existingSteps.length;

      const appendedSteps = newSteps.map((s: TestStep, i: number) => ({
        ...s,
        id: s.id || crypto.randomUUID(),
        order: startOrder + i,
      }));

      config.steps = [...existingSteps, ...appendedSteps];

      // Update the test
      await query(
        `UPDATE tests SET config = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(config), testId]
      );

      return reply.send({
        message: `${appendedSteps.length} steps appended to test`,
        test_id: testId,
        total_steps: config.steps.length,
      });
    } catch (error) {
      log.error({ err: error, testId, orgId, code: 'STEPS_APPEND_FAILED' }, 'Failed to append steps to test');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to append steps');
    }
  });

  // Duplicate a test (convenience endpoint)
  app.post<{ Params: TestParams }>('/api/v1/tests/:testId/duplicate', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;

    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot duplicate tests');
    }

    try {
      // Get existing test
      const testResult = ensureResult(await query(
        `SELECT t.*, ts.organization_id FROM tests t JOIN test_suites ts ON t.suite_id = ts.id WHERE t.id = $1`,
        [testId]
      ));

      if ((testResult.rowCount ?? 0) === 0) {
        return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
      }

      const test = testResult.rows[0];
      if (test.organization_id !== orgId) {
        return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
      }

      const newId = crypto.randomUUID();
      const newName = `${test.name} (Copy)`;

      const result = ensureResult(await query(
        `INSERT INTO tests (id, suite_id, project_id, name, description, type, config, code, enabled, priority, tags)
         SELECT $1, suite_id, project_id, $2, description, type, config, code, enabled, priority, tags
         FROM tests WHERE id = $3
         RETURNING *`,
        [newId, newName, testId]
      ));

      return reply.status(201).send({
        message: `Test duplicated as "${newName}"`,
        test: result.rows[0],
      });
    } catch (error) {
      log.error({ err: error, testId, orgId, code: 'TEST_DUPLICATE_FAILED' }, 'Failed to duplicate test');
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', 'Failed to duplicate test');
    }
  });
}
