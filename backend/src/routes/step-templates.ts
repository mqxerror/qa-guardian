// Step Templates Routes - Feature #31: Reusable Step Templates
// CRUD operations for step templates that can be shared across tests

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload, getOrganizationId } from '../middleware/auth';
import { query } from '../services/database';
import crypto from 'crypto';

// Types
interface StepTemplate {
  id: string;
  organization_id: string;
  suite_id?: string | null;
  name: string;
  description?: string;
  steps: any[];
  tags: string[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

interface CreateTemplateBody {
  name: string;
  description?: string;
  steps: any[];
  tags?: string[];
  suite_id?: string;
}

interface TemplateParams {
  templateId: string;
}

interface AppendStepsBody {
  steps: any[];
}

interface TestParams {
  testId: string;
}

export async function stepTemplateRoutes(app: FastifyInstance) {

  // List step templates for the organization
  app.get('/api/v1/step-templates', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const orgId = getOrganizationId(request);
    const { suite_id, search } = request.query as { suite_id?: string; search?: string };

    let sql = `SELECT * FROM step_templates WHERE organization_id = $1`;
    const params: any[] = [orgId];
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
      const result = await query(sql, params);
      return reply.send({
        templates: result.rows.map(row => ({
          ...row,
          steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
          tags: row.tags || [],
        })),
        total: result.rowCount,
      });
    } catch (error) {
      console.error('[StepTemplates] Failed to list templates:', error);
      return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to list step templates' });
    }
  });

  // Get a single step template
  app.get<{ Params: TemplateParams }>('/api/v1/step-templates/:templateId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { templateId } = request.params;
    const orgId = getOrganizationId(request);

    try {
      const result = await query(
        `SELECT * FROM step_templates WHERE id = $1 AND organization_id = $2`,
        [templateId, orgId]
      );

      if (result.rowCount === 0) {
        return reply.status(404).send({ error: 'Not Found', message: 'Step template not found' });
      }

      const row = result.rows[0];
      return reply.send({
        template: {
          ...row,
          steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
          tags: row.tags || [],
        },
      });
    } catch (error) {
      console.error('[StepTemplates] Failed to get template:', error);
      return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to get step template' });
    }
  });

  // Create a new step template
  app.post<{ Body: CreateTemplateBody }>('/api/v1/step-templates', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { name, description, steps, tags = [], suite_id } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    if (!name?.trim()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Template name is required' });
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'At least one step is required' });
    }

    // Viewers cannot create templates
    if (user.role === 'viewer') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Viewers cannot create step templates' });
    }

    const id = crypto.randomUUID();

    try {
      const result = await query(
        `INSERT INTO step_templates (id, organization_id, suite_id, name, description, steps, tags, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [id, orgId, suite_id || null, name.trim(), description || null, JSON.stringify(steps), tags, user.email]
      );

      const row = result.rows[0];
      return reply.status(201).send({
        template: {
          ...row,
          steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
          tags: row.tags || [],
        },
      });
    } catch (error) {
      console.error('[StepTemplates] Failed to create template:', error);
      return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to create step template' });
    }
  });

  // Update a step template
  app.patch<{ Params: TemplateParams; Body: Partial<CreateTemplateBody> }>('/api/v1/step-templates/:templateId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { templateId } = request.params;
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;
    const { name, description, steps, tags, suite_id } = request.body;

    if (user.role === 'viewer') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Viewers cannot update step templates' });
    }

    try {
      // Check exists
      const existing = await query(
        `SELECT * FROM step_templates WHERE id = $1 AND organization_id = $2`,
        [templateId, orgId]
      );
      if (existing.rowCount === 0) {
        return reply.status(404).send({ error: 'Not Found', message: 'Step template not found' });
      }

      const updates: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (name !== undefined) { updates.push(`name = $${idx++}`); params.push(name.trim()); }
      if (description !== undefined) { updates.push(`description = $${idx++}`); params.push(description); }
      if (steps !== undefined) { updates.push(`steps = $${idx++}`); params.push(JSON.stringify(steps)); }
      if (tags !== undefined) { updates.push(`tags = $${idx++}`); params.push(tags); }
      if (suite_id !== undefined) { updates.push(`suite_id = $${idx++}`); params.push(suite_id || null); }

      if (updates.length === 0) {
        return reply.status(400).send({ error: 'Bad Request', message: 'No fields to update' });
      }

      updates.push(`updated_at = NOW()`);
      params.push(templateId, orgId);

      const result = await query(
        `UPDATE step_templates SET ${updates.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx} RETURNING *`,
        params
      );

      const row = result.rows[0];
      return reply.send({
        template: {
          ...row,
          steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
          tags: row.tags || [],
        },
      });
    } catch (error) {
      console.error('[StepTemplates] Failed to update template:', error);
      return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to update step template' });
    }
  });

  // Delete a step template
  app.delete<{ Params: TemplateParams }>('/api/v1/step-templates/:templateId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { templateId } = request.params;
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;

    if (user.role === 'viewer') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Viewers cannot delete step templates' });
    }

    try {
      const result = await query(
        `DELETE FROM step_templates WHERE id = $1 AND organization_id = $2 RETURNING id, name`,
        [templateId, orgId]
      );

      if (result.rowCount === 0) {
        return reply.status(404).send({ error: 'Not Found', message: 'Step template not found' });
      }

      return reply.send({
        message: `Template "${result.rows[0].name}" deleted successfully`,
        id: templateId,
      });
    } catch (error) {
      console.error('[StepTemplates] Failed to delete template:', error);
      return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to delete step template' });
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
      return reply.status(403).send({ error: 'Forbidden', message: 'Viewers cannot modify tests' });
    }

    if (!newSteps || !Array.isArray(newSteps) || newSteps.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Steps array is required' });
    }

    try {
      // Get existing test
      const testResult = await query(
        `SELECT t.*, ts.organization_id FROM tests t JOIN test_suites ts ON t.suite_id = ts.id WHERE t.id = $1`,
        [testId]
      );

      if (testResult.rowCount === 0) {
        return reply.status(404).send({ error: 'Not Found', message: 'Test not found' });
      }

      const test = testResult.rows[0];
      if (test.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Not Found', message: 'Test not found' });
      }

      // Parse existing config and append steps
      const config = typeof test.config === 'string' ? JSON.parse(test.config) : (test.config || {});
      const existingSteps = config.steps || [];
      const startOrder = existingSteps.length;

      const appendedSteps = newSteps.map((s: any, i: number) => ({
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
      console.error('[StepTemplates] Failed to append steps:', error);
      return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to append steps' });
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
      return reply.status(403).send({ error: 'Forbidden', message: 'Viewers cannot duplicate tests' });
    }

    try {
      // Get existing test
      const testResult = await query(
        `SELECT t.*, ts.organization_id FROM tests t JOIN test_suites ts ON t.suite_id = ts.id WHERE t.id = $1`,
        [testId]
      );

      if (testResult.rowCount === 0) {
        return reply.status(404).send({ error: 'Not Found', message: 'Test not found' });
      }

      const test = testResult.rows[0];
      if (test.organization_id !== orgId) {
        return reply.status(404).send({ error: 'Not Found', message: 'Test not found' });
      }

      const newId = crypto.randomUUID();
      const newName = `${test.name} (Copy)`;

      const result = await query(
        `INSERT INTO tests (id, suite_id, project_id, name, description, type, config, code, enabled, priority, tags)
         SELECT $1, suite_id, project_id, $2, description, type, config, code, enabled, priority, tags
         FROM tests WHERE id = $3
         RETURNING *`,
        [newId, newName, testId]
      );

      return reply.status(201).send({
        message: `Test duplicated as "${newName}"`,
        test: result.rows[0],
      });
    } catch (error) {
      console.error('[StepTemplates] Failed to duplicate test:', error);
      return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to duplicate test' });
    }
  });
}
