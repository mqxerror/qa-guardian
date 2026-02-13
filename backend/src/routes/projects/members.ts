// Projects Module - Project Members Management Routes
// Handles project-level permissions and member management

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload } from '../../middleware/auth.js';
import { getProject, getProjectMembers, addProjectMember, removeProjectMember } from './stores.js';
import { createLogger } from '../../services/logger.js';

import { sendError } from '../../utils/errors.js';
const log = createLogger('projects-members');

export async function memberRoutes(app: FastifyInstance) {
  // Get project members
  app.get<{ Params: { projectId: string } }>('/api/v1/projects/:projectId/members', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const user = request.user as JwtPayload;

    const project = await getProject(projectId);
    if (!project) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    // Check organization membership
    if (project.organization_id !== user.organization_id) {
      return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
    }

    // Only admins/owners can see project members
    if (user.role !== 'owner' && user.role !== 'admin') {
      return sendError(reply, 403, 'FORBIDDEN', 'Only administrators can view project members');
    }

    const members = await getProjectMembers(projectId);
    return { members };
  });

  // Add member to project
  app.post<{ Params: { projectId: string }; Body: { user_id: string; role: 'developer' | 'viewer' } }>(
    '/api/v1/projects/:projectId/members',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const { user_id, role } = request.body;
      const user = request.user as JwtPayload;

      // Validate input
      if (!user_id || !role) {
        return sendError(reply, 400, 'BAD_REQUEST', 'User ID and role are required');
      }

      if (!['developer', 'viewer'].includes(role)) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Role must be developer or viewer');
      }

      const project = await getProject(projectId);
      if (!project) {
        return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
      }

      // Check organization membership
      if (project.organization_id !== user.organization_id) {
        return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
      }

      // Only admins/owners can add project members
      if (user.role !== 'owner' && user.role !== 'admin') {
        return sendError(reply, 403, 'FORBIDDEN', 'Only administrators can manage project members');
      }

      // Get or initialize project members array
      const members = await getProjectMembers(projectId);

      // Check if user is already a member
      if (members.some(m => m.user_id === user_id)) {
        return sendError(reply, 409, 'CONFLICT', 'User is already a member of this project');
      }

      // Add the new member
      const newMember = await addProjectMember({
        project_id: projectId,
        user_id,
        role,
        added_at: new Date(),
        added_by: user.id,
      });

      log.info({ userId: user_id, projectName: project.name, role }, 'Project member added');

      return reply.status(201).send({
        member: newMember,
        message: 'Member added to project successfully',
      });
    }
  );

  // Remove member from project
  app.delete<{ Params: { projectId: string; memberId: string } }>(
    '/api/v1/projects/:projectId/members/:memberId',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { projectId, memberId } = request.params;
      const user = request.user as JwtPayload;

      const project = await getProject(projectId);
      if (!project) {
        return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
      }

      // Check organization membership
      if (project.organization_id !== user.organization_id) {
        return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
      }

      // Only admins/owners can remove project members
      if (user.role !== 'owner' && user.role !== 'admin') {
        return sendError(reply, 403, 'FORBIDDEN', 'Only administrators can manage project members');
      }

      // Get project members
      const members = await getProjectMembers(projectId);
      const memberIndex = members.findIndex(m => m.user_id === memberId);

      if (memberIndex === -1) {
        return sendError(reply, 404, 'NOT_FOUND', 'Member not found in project');
      }

      // Remove the member
      await removeProjectMember(projectId, memberId);

      log.info({ userId: memberId, projectName: project.name }, 'Project member removed');

      return { message: 'Member removed from project successfully' };
    }
  );

  // Update member role on project
  app.patch<{ Params: { projectId: string; memberId: string }; Body: { role: 'developer' | 'viewer' } }>(
    '/api/v1/projects/:projectId/members/:memberId',
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const { projectId, memberId } = request.params;
      const { role } = request.body;
      const user = request.user as JwtPayload;

      if (!role || !['developer', 'viewer'].includes(role)) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Valid role is required (developer or viewer)');
      }

      const project = await getProject(projectId);
      if (!project) {
        return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
      }

      // Check organization membership
      if (project.organization_id !== user.organization_id) {
        return sendError(reply, 404, 'NOT_FOUND', 'Project not found');
      }

      // Only admins/owners can update project member roles
      if (user.role !== 'owner' && user.role !== 'admin') {
        return sendError(reply, 403, 'FORBIDDEN', 'Only administrators can manage project members');
      }

      // Get project members
      const members = await getProjectMembers(projectId);
      const member = members.find(m => m.user_id === memberId);

      if (!member) {
        return sendError(reply, 404, 'NOT_FOUND', 'Member not found in project');
      }

      const oldRole = member.role;
      // Update role: remove and re-add with new role
      await removeProjectMember(projectId, memberId);
      await addProjectMember({
        ...member,
        role,
      });
      member.role = role;

      log.info({ userId: memberId, oldRole, newRole: role, projectName: project.name }, 'Project member role updated');

      return {
        member,
        message: 'Member role updated successfully',
      };
    }
  );
}
