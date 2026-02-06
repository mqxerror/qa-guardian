/**
 * SAST Custom Rules Routes
 *
 * CRUD operations for managing custom Semgrep rules.
 * Extracted from sast.ts for better maintainability.
 *
 * Routes:
 * - GET /api/v1/projects/:projectId/sast/custom-rules
 * - POST /api/v1/projects/:projectId/sast/custom-rules
 * - PUT /api/v1/projects/:projectId/sast/custom-rules/:ruleId
 * - DELETE /api/v1/projects/:projectId/sast/custom-rules/:ruleId
 */

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload } from '../../middleware/auth';
import { getProject } from '../../services/repositories/projects';
import { logAuditEntry } from '../audit-logs';
import { CustomRule } from './types';
import { getSASTConfig, updateSASTConfig, generateId } from './stores';

export async function customRulesRoutes(app: FastifyInstance): Promise<void> {
  // Get custom rules for a project
  app.get<{ Params: { projectId: string } }>('/api/v1/projects/:projectId/sast/custom-rules', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const user = request.user as JwtPayload;

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    const config = await getSASTConfig(projectId);
    return { rules: config.customRulesYaml || [] };
  });

  // Add a custom rule
  app.post<{
    Params: { projectId: string };
    Body: { name: string; yaml: string };
  }>('/api/v1/projects/:projectId/sast/custom-rules', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const { name, yaml } = request.body;
    const user = request.user as JwtPayload;

    // Check permissions
    if (user.role === 'viewer') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Viewers cannot add custom rules' });
    }

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    // Validate required fields
    if (!name || !yaml) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Name and YAML are required' });
    }

    // Basic YAML validation (check if it contains "rules:" key)
    if (!yaml.includes('rules:') && !yaml.includes('pattern:')) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid Semgrep rule YAML. Must contain "rules:" or "pattern:" key.',
      });
    }

    const config = await getSASTConfig(projectId);
    const customRules = config.customRulesYaml || [];

    // Create new custom rule
    const newRule: CustomRule = {
      id: generateId(),
      name,
      yaml,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    customRules.push(newRule);
    await updateSASTConfig(projectId, { customRulesYaml: customRules });

    // Log audit entry
    logAuditEntry(
      request,
      'sast_custom_rule_created',
      'project',
      projectId,
      project.name,
      { ruleId: newRule.id, ruleName: name }
    );

    return { rule: newRule, message: 'Custom rule created successfully' };
  });

  // Update a custom rule
  app.put<{
    Params: { projectId: string; ruleId: string };
    Body: { name?: string; yaml?: string; enabled?: boolean };
  }>('/api/v1/projects/:projectId/sast/custom-rules/:ruleId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId, ruleId } = request.params;
    const updates = request.body;
    const user = request.user as JwtPayload;

    // Check permissions
    if (user.role === 'viewer') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Viewers cannot update custom rules' });
    }

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    const config = await getSASTConfig(projectId);
    const customRules = config.customRulesYaml || [];
    const ruleIndex = customRules.findIndex(r => r.id === ruleId);

    if (ruleIndex === -1) {
      return reply.status(404).send({ error: 'Not Found', message: 'Custom rule not found' });
    }

    // Update rule
    const existingRule = customRules[ruleIndex]!;
    const updatedRule: CustomRule = {
      ...existingRule,
      ...(updates.name && { name: updates.name }),
      ...(updates.yaml && { yaml: updates.yaml }),
      ...(updates.enabled !== undefined && { enabled: updates.enabled }),
      updatedAt: new Date().toISOString(),
    };
    customRules[ruleIndex] = updatedRule;

    await updateSASTConfig(projectId, { customRulesYaml: customRules });

    // Log audit entry
    logAuditEntry(
      request,
      'sast_custom_rule_updated',
      'project',
      projectId,
      project.name,
      { ruleId, ruleName: updatedRule.name }
    );

    return { rule: updatedRule, message: 'Custom rule updated successfully' };
  });

  // Delete a custom rule
  app.delete<{ Params: { projectId: string; ruleId: string } }>('/api/v1/projects/:projectId/sast/custom-rules/:ruleId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId, ruleId } = request.params;
    const user = request.user as JwtPayload;

    // Check permissions
    if (user.role === 'viewer') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Viewers cannot delete custom rules' });
    }

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    const config = await getSASTConfig(projectId);
    const customRules = config.customRulesYaml || [];
    const ruleIndex = customRules.findIndex(r => r.id === ruleId);

    if (ruleIndex === -1) {
      return reply.status(404).send({ error: 'Not Found', message: 'Custom rule not found' });
    }

    const deletedRule = customRules[ruleIndex]!;
    customRules.splice(ruleIndex, 1);
    await updateSASTConfig(projectId, { customRulesYaml: customRules });

    // Log audit entry
    logAuditEntry(
      request,
      'sast_custom_rule_deleted',
      'project',
      projectId,
      project.name,
      { ruleId, ruleName: deletedRule.name }
    );

    return { message: 'Custom rule deleted successfully' };
  });
}
