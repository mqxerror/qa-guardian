/**
 * SAST False Positives Routes
 *
 * Routes for managing false positive markings on SAST findings.
 * Extracted from sast.ts for better modularity.
 *
 * Routes:
 * - GET /api/v1/projects/:projectId/sast/false-positives - List false positives
 * - POST /api/v1/projects/:projectId/sast/false-positives - Mark finding as false positive
 * - DELETE /api/v1/projects/:projectId/sast/false-positives/:fpId - Remove false positive
 */

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload } from '../../middleware/auth.js';
import { getProject } from '../../services/repositories/projects.js';
import { logAuditEntry } from '../audit-logs.js';
import { FalsePositive } from './types.js';
import { sendError } from '../../utils/errors.js';
import {
  generateId,
  getFalsePositives,
  addFalsePositive,
  removeFalsePositive,
} from './stores.js';

export async function falsePositivesRoutes(app: FastifyInstance) {
  // Get all false positives for a project
  app.get<{ Params: { projectId: string } }>('/api/v1/projects/:projectId/sast/false-positives', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const user = request.user as JwtPayload;

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    if (project.organization_id !== user.organization_id) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    const fps = getFalsePositives(projectId);
    return { falsePositives: fps };
  });

  // Mark a finding as false positive
  app.post<{
    Params: { projectId: string };
    Body: {
      ruleId: string;
      filePath: string;
      line: number;
      snippet?: string;
      reason: string;
    };
  }>('/api/v1/projects/:projectId/sast/false-positives', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const { ruleId, filePath, line, snippet, reason } = request.body;
    const user = request.user as JwtPayload;

    // Check permissions
    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot mark false positives');
    }

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    if (project.organization_id !== user.organization_id) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    // Validate required fields
    if (!ruleId || !filePath || line === undefined || !reason) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Missing required fields: ruleId, filePath, line, reason');
    }

    // Check if already marked as false positive
    const existingFPs = await getFalsePositives(projectId);
    const alreadyExists = existingFPs.some(fp =>
      fp.ruleId === ruleId && fp.filePath === filePath && fp.line === line
    );

    if (alreadyExists) {
      return sendError(reply, 400, 'BAD_REQUEST', 'This finding is already marked as a false positive');
    }

    // Create false positive record
    const fp: FalsePositive = {
      id: generateId(),
      projectId,
      ruleId,
      filePath,
      line,
      snippet,
      reason,
      markedBy: user.email,
      markedAt: new Date().toISOString(),
    };

    addFalsePositive(projectId, fp);

    // Log audit entry
    logAuditEntry(
      request,
      'sast_false_positive_added',
      'project',
      projectId,
      project.name,
      { ruleId, filePath, line, reason }
    );

    return { falsePositive: fp, message: 'Finding marked as false positive' };
  });

  // Remove a false positive
  app.delete<{ Params: { projectId: string; fpId: string } }>('/api/v1/projects/:projectId/sast/false-positives/:fpId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId, fpId } = request.params;
    const user = request.user as JwtPayload;

    // Check permissions
    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot remove false positives');
    }

    // Check project exists and user has access
    const project = await getProject(projectId);
    if (!project) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    if (project.organization_id !== user.organization_id) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    const removed = removeFalsePositive(projectId, fpId);
    if (!removed) {
      return sendError(reply, 404, 'NOT_FOUND', 'False positive not found');
    }

    // Log audit entry
    logAuditEntry(
      request,
      'sast_false_positive_removed',
      'project',
      projectId,
      project.name,
      { fpId }
    );

    return { message: 'False positive removed successfully' };
  });
}
