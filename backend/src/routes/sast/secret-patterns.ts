/**
 * SAST Secret Patterns Routes
 *
 * Feature #1558: Add support for custom Gitleaks rules
 *
 * CRUD operations for managing custom secret detection patterns.
 * These patterns are used by Gitleaks CLI for detecting organization-specific secrets.
 *
 * Routes:
 * - GET /api/v1/projects/:projectId/sast/patterns - List patterns
 * - POST /api/v1/projects/:projectId/sast/patterns - Create pattern
 * - PUT /api/v1/projects/:projectId/sast/patterns/:patternId - Update pattern
 * - DELETE /api/v1/projects/:projectId/sast/patterns/:patternId - Delete pattern
 * - GET /api/v1/sast/patterns/templates - Get common rule templates
 */

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload } from '../../middleware/auth';
import { projects } from '../projects';
import { logAuditEntry } from '../audit-logs';
import { SecretPattern, SASTSeverity } from './types';
import {
  getSecretPatterns,
  addSecretPattern,
  updateSecretPattern,
  removeSecretPattern,
  generateId,
  SECRET_PATTERN_TEMPLATES,
} from './stores';

export async function secretPatternsRoutes(app: FastifyInstance): Promise<void> {
  // Get common rule templates
  app.get('/api/v1/sast/patterns/templates', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    return {
      templates: SECRET_PATTERN_TEMPLATES,
      count: SECRET_PATTERN_TEMPLATES.length,
    };
  });

  // Get secret patterns for a project
  app.get<{ Params: { projectId: string } }>(
    '/api/v1/projects/:projectId/sast/patterns',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;
      const user = request.user as JwtPayload;

      // Check project exists and user has access
      const project = projects.get(projectId);
      if (!project) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }

      if (project.organization_id !== user.organization_id) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }

      const patterns = getSecretPatterns(projectId);
      return {
        patterns,
        count: patterns.length,
        enabledCount: patterns.filter(p => p.enabled).length,
      };
    }
  );

  // Add a secret pattern
  app.post<{
    Params: { projectId: string };
    Body: {
      name: string;
      description?: string;
      pattern: string;
      severity?: SASTSeverity;
      category?: string;
    };
  }>(
    '/api/v1/projects/:projectId/sast/patterns',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { projectId } = request.params;
      const { name, description, pattern, severity = 'HIGH', category = 'custom' } = request.body;
      const user = request.user as JwtPayload;

      // Check permissions
      if (user.role === 'viewer') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Viewers cannot add secret patterns',
        });
      }

      // Check project exists and user has access
      const project = projects.get(projectId);
      if (!project) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }

      if (project.organization_id !== user.organization_id) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }

      // Validate required fields
      if (!name || !pattern) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Name and pattern are required',
        });
      }

      // Validate regex pattern
      try {
        new RegExp(pattern);
      } catch (error) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid regex pattern',
        });
      }

      // Create new pattern
      const now = new Date().toISOString();
      const newPattern: SecretPattern = {
        id: generateId(),
        name: name.trim(),
        description: description?.trim(),
        pattern: pattern.trim(),
        severity,
        category,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      };

      addSecretPattern(projectId, newPattern);

      // Log audit entry
      logAuditEntry(
        request,
        'secret_pattern_created',
        'project',
        projectId,
        project.name,
        { patternId: newPattern.id, patternName: name }
      );

      console.log(`
====================================
  Secret Pattern Created
====================================
  Project: ${project.name}
  Pattern: ${name}
  Regex: ${pattern}
  Severity: ${severity}
  Category: ${category}
====================================
      `);

      return newPattern;
    }
  );

  // Update a secret pattern
  app.put<{
    Params: { projectId: string; patternId: string };
    Body: {
      name?: string;
      description?: string;
      pattern?: string;
      severity?: SASTSeverity;
      category?: string;
      enabled?: boolean;
    };
  }>(
    '/api/v1/projects/:projectId/sast/patterns/:patternId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { projectId, patternId } = request.params;
      const updates = request.body;
      const user = request.user as JwtPayload;

      // Check permissions
      if (user.role === 'viewer') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Viewers cannot update secret patterns',
        });
      }

      // Check project exists and user has access
      const project = projects.get(projectId);
      if (!project) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }

      if (project.organization_id !== user.organization_id) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }

      // Validate pattern if being updated
      if (updates.pattern) {
        try {
          new RegExp(updates.pattern);
        } catch (error) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Invalid regex pattern',
          });
        }
      }

      const updatedPattern = updateSecretPattern(projectId, patternId, updates);

      if (!updatedPattern) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Secret pattern not found',
        });
      }

      // Log audit entry
      logAuditEntry(
        request,
        'secret_pattern_updated',
        'project',
        projectId,
        project.name,
        { patternId, patternName: updatedPattern.name }
      );

      return updatedPattern;
    }
  );

  // Delete a secret pattern
  app.delete<{ Params: { projectId: string; patternId: string } }>(
    '/api/v1/projects/:projectId/sast/patterns/:patternId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { projectId, patternId } = request.params;
      const user = request.user as JwtPayload;

      // Check permissions
      if (user.role === 'viewer') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Viewers cannot delete secret patterns',
        });
      }

      // Check project exists and user has access
      const project = projects.get(projectId);
      if (!project) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }

      if (project.organization_id !== user.organization_id) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }

      // Get pattern name for audit log before deleting
      const patterns = getSecretPatterns(projectId);
      const pattern = patterns.find(p => p.id === patternId);

      const success = removeSecretPattern(projectId, patternId);

      if (!success) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Secret pattern not found',
        });
      }

      // Log audit entry
      logAuditEntry(
        request,
        'secret_pattern_deleted',
        'project',
        projectId,
        project.name,
        { patternId, patternName: pattern?.name }
      );

      return { success: true, message: 'Secret pattern deleted successfully' };
    }
  );
}
