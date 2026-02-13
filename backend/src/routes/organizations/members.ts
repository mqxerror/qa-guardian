/**
 * Organizations Module - Member Management Routes
 * Feature #730: Split organizations.ts into sub-modules
 *
 * Handles organization member operations: list members, invitations,
 * accept invitations, remove members, update roles, and transfer ownership.
 */

import { FastifyInstance } from 'fastify';
// Feature #455: Use native bcrypt for performance (removed bcryptjs)
import bcrypt from 'bcrypt';
import { authenticate, requireRoles, JwtPayload } from '../../middleware/auth.js';
import { createLogger } from '../../services/logger.js';
// Feature #713: Zod validation middleware
import {
  validateBody,
  validateParams,
  orgIdParamsSchema,
  createInvitationSchema,
  inviteIdParamsSchema,
  orgInviteParamsSchema,
  orgMemberParamsSchema,
  updateMemberRoleSchema,
  transferOwnershipSchema,
} from '../../validation/index.js';
// Feature #2116: Use async DB calls instead of synchronous Map
import { dbGetUserByEmail } from '../auth.js';
import { getUserById as dbGetUserById } from '../../services/repositories/auth.js';
import { sendError } from '../../utils/errors.js';
import {
  getOrganizationById as repoGetOrganizationById,
  addOrganizationMember as repoAddOrganizationMember,
  removeOrganizationMember as repoRemoveOrganizationMember,
  getOrganizationMembers as repoGetOrganizationMembers,
  updateMemberRole as repoUpdateMemberRole,
  createInvitation as repoCreateInvitation,
  getInvitationById as repoGetInvitationById,
  getInvitationsByOrg as repoGetInvitationsByOrg,
  updateInvitation as repoUpdateInvitation,
  deleteInvitation as repoDeleteInvitation,
  Invitation,
} from '../../services/repositories/organizations.js';
import type { OrgParams, InvitationBody } from './types.js';

const log = createLogger('route:organizations:members');

export async function memberRoutes(app: FastifyInstance) {
  // Get organization members (with user details)
  // Feature #713: Add Zod param validation
  app.get<{ Params: OrgParams }>('/api/v1/organizations/:id/members', {
    preValidation: [validateParams(orgIdParamsSchema)],
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const memberRecords = await repoGetOrganizationMembers(id);

    // Feature #2116: Enrich with user details using async DB calls
    const members = await Promise.all(memberRecords.map(async (member) => {
      const user = await dbGetUserById(member.user_id);
      const userDetails = user ? {
        id: user.id,
        email: user.email,
        name: user.name,
      } : null;
      return {
        ...member,
        ...userDetails,
      };
    }));

    return { members };
  });

  // Create invitation (requires owner or admin role)
  // Feature #713: Add Zod validation
  app.post<{ Params: OrgParams; Body: InvitationBody }>('/api/v1/organizations/:id/invitations', {
    preValidation: [validateParams(orgIdParamsSchema), validateBody(createInvitationSchema)],
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request, reply) => {
    // Feature #713: Zod validation now handles required fields and role enum
    const { id } = request.params;
    const { email, role } = request.body;
    const user = request.user as JwtPayload;

    // Check if organization exists
    const orgExists = await repoGetOrganizationById(id);
    if (!orgExists) {
      return sendError(reply, 404, 'NOT_FOUND', 'Organization not found');
    }

    // Create invitation
    const invitationId = crypto.randomUUID();
    const invitation: Invitation = {
      id: invitationId,
      organization_id: id,
      email,
      role,
      invited_by: user.id,
      created_at: new Date(),
      status: 'pending',
    };

    await repoCreateInvitation(invitation);

    // Log invitation (email would be sent in production)
    log.info({
      email,
      role,
      organizationId: id,
      invitedBy: user.email,
    }, 'Invitation created');

    return reply.status(201).send({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        created_at: invitation.created_at,
      },
    });
  });

  // Get invitations for organization (requires owner or admin role)
  // Feature #713: Add Zod param validation
  app.get<{ Params: OrgParams }>('/api/v1/organizations/:id/invitations', {
    preValidation: [validateParams(orgIdParamsSchema)],
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request, reply) => {
    const { id } = request.params;

    const orgInvitations = await repoGetInvitationsByOrg(id);

    return { invitations: orgInvitations };
  });

  // Delete invitation (requires owner or admin role)
  // Feature #713: Add Zod param validation
  app.delete<{ Params: { id: string; inviteId: string } }>('/api/v1/organizations/:id/invitations/:inviteId', {
    preValidation: [validateParams(orgInviteParamsSchema)],
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request, reply) => {
    const { inviteId } = request.params;

    const invToDelete = await repoGetInvitationById(inviteId);
    if (!invToDelete) {
      return sendError(reply, 404, 'NOT_FOUND', 'Invitation not found');
    }

    await repoDeleteInvitation(inviteId);

    return { message: 'Invitation deleted successfully' };
  });

  // Get invitation details (public - for accepting)
  // Feature #713: Add Zod param validation
  app.get<{ Params: { inviteId: string } }>('/api/v1/invitations/:inviteId', {
    preValidation: [validateParams(inviteIdParamsSchema)],
  }, async (request, reply) => {
    const { inviteId } = request.params;

    const invitation = await repoGetInvitationById(inviteId);
    if (!invitation) {
      return sendError(reply, 404, 'NOT_FOUND', 'Invitation not found or has expired');
    }

    if (invitation.status !== 'pending') {
      return sendError(reply, 400, 'BAD_REQUEST', invitation.status === 'accepted'
          ? 'This invitation has already been accepted'
          : 'This invitation has expired');
    }

    // Get organization details
    const org = await repoGetOrganizationById(invitation.organization_id);

    return {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        organization: org ? {
          id: org.id,
          name: org.name,
          slug: org.slug,
        } : null,
        created_at: invitation.created_at,
      },
    };
  });

  // Accept invitation (requires authentication - user must be logged in)
  // Feature #713: Add Zod param validation
  app.post<{ Params: { inviteId: string } }>('/api/v1/invitations/:inviteId/accept', {
    preValidation: [validateParams(inviteIdParamsSchema)],
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { inviteId } = request.params;
    const user = request.user as JwtPayload;

    const invitation = await repoGetInvitationById(inviteId);
    if (!invitation) {
      return sendError(reply, 404, 'NOT_FOUND', 'Invitation not found');
    }

    if (invitation.status !== 'pending') {
      return sendError(reply, 400, 'BAD_REQUEST', invitation.status === 'accepted'
          ? 'This invitation has already been accepted'
          : 'This invitation has expired');
    }

    // Verify the logged in user's email matches the invitation
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return sendError(reply, 403, 'FORBIDDEN', 'This invitation was sent to a different email address');
    }

    // Check if organization still exists
    const org = await repoGetOrganizationById(invitation.organization_id);
    if (!org) {
      return sendError(reply, 404, 'NOT_FOUND', 'The organization no longer exists');
    }

    // Check if user is already a member
    const members = await repoGetOrganizationMembers(invitation.organization_id);
    const existingMember = members.find(m => m.user_id === user.id);
    if (existingMember) {
      // Mark invitation as accepted but don't add duplicate member
      await repoUpdateInvitation(inviteId, {
        status: 'accepted',
        accepted_at: new Date(),
        accepted_by: user.id,
      });

      return {
        message: 'You are already a member of this organization',
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          role: existingMember.role,
        },
      };
    }

    // Add user to organization with invited role
    await repoAddOrganizationMember({
      user_id: user.id,
      organization_id: invitation.organization_id,
      role: invitation.role,
    });

    // Mark invitation as accepted
    await repoUpdateInvitation(inviteId, {
      status: 'accepted',
      accepted_at: new Date(),
      accepted_by: user.id,
    });

    log.info({
      userEmail: user.email,
      organizationName: org.name,
      role: invitation.role,
    }, 'Invitation accepted');

    return {
      message: 'Invitation accepted successfully',
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: invitation.role,
      },
    };
  });

  // Remove member from organization (requires owner or admin role)
  // Feature #713: Add Zod param validation
  app.delete<{ Params: { id: string; memberId: string } }>('/api/v1/organizations/:id/members/:memberId', {
    preValidation: [validateParams(orgMemberParamsSchema)],
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request, reply) => {
    const { id, memberId } = request.params;
    const jwtUser = request.user as JwtPayload;

    // Check if organization exists
    const orgForRemove = await repoGetOrganizationById(id);
    if (!orgForRemove) {
      return sendError(reply, 404, 'NOT_FOUND', 'Organization not found');
    }

    // Get current members
    const members = await repoGetOrganizationMembers(id);

    // Find the member to remove
    const memberToRemove = members.find(m => m.user_id === memberId);
    if (!memberToRemove) {
      return sendError(reply, 404, 'NOT_FOUND', 'Member not found in organization');
    }

    // Cannot remove the owner
    if (memberToRemove.role === 'owner') {
      return sendError(reply, 400, 'BAD_REQUEST', 'Cannot remove the organization owner');
    }

    // Cannot remove yourself
    if (memberToRemove.user_id === jwtUser.id) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Cannot remove yourself from the organization');
    }

    // Remove the member
    await repoRemoveOrganizationMember(id, memberId);

    log.info({ memberId, organizationId: id, removedBy: jwtUser.email }, 'Member removed from organization');

    return { message: 'Member removed successfully' };
  });

  // Update member role (requires owner or admin role)
  // Feature #713: Add Zod validation
  app.patch<{ Params: { id: string; memberId: string }; Body: { role: 'admin' | 'developer' | 'viewer' } }>(
    '/api/v1/organizations/:id/members/:memberId',
    {
      preValidation: [validateParams(orgMemberParamsSchema), validateBody(updateMemberRoleSchema)],
      preHandler: [authenticate, requireRoles(['owner', 'admin'])],
    },
    async (request, reply) => {
      // Feature #713: Zod validation now handles role enum validation
      const { id, memberId } = request.params;
      const { role } = request.body;
      const jwtUser = request.user as JwtPayload;

      // Check if organization exists
      const orgForUpdate = await repoGetOrganizationById(id);
      if (!orgForUpdate) {
        return sendError(reply, 404, 'NOT_FOUND', 'Organization not found');
      }

      // Get current members
      const members = await repoGetOrganizationMembers(id);

      // Find the member to update
      const memberToUpdate = members.find(m => m.user_id === memberId);
      if (!memberToUpdate) {
        return sendError(reply, 404, 'NOT_FOUND', 'Member not found in organization');
      }

      // Cannot change the owner's role
      if (memberToUpdate.role === 'owner') {
        return sendError(reply, 400, 'BAD_REQUEST', 'Cannot change the organization owner\'s role');
      }

      // Admins cannot promote others to admin (only owner can)
      if (jwtUser.role === 'admin' && role === 'admin') {
        return sendError(reply, 403, 'FORBIDDEN', 'Only the organization owner can promote members to admin');
      }

      // Update the role
      const oldRole = memberToUpdate.role;
      await repoUpdateMemberRole(id, memberId, role);

      log.info({ memberId, organizationId: id, oldRole, newRole: role, updatedBy: jwtUser.email }, 'Member role updated');

      return {
        message: 'Member role updated successfully',
        member: {
          user_id: memberId,
          role: role,
        },
      };
    }
  );

  // Transfer ownership (requires owner role and password confirmation)
  // Feature #713: Add Zod validation
  app.post<{ Params: OrgParams; Body: { new_owner_id: string; password: string } }>(
    '/api/v1/organizations/:id/transfer-ownership',
    {
      preValidation: [validateParams(orgIdParamsSchema), validateBody(transferOwnershipSchema)],
      preHandler: [authenticate, requireRoles(['owner'])],
    },
    async (request, reply) => {
      // Feature #713: Zod validation now handles required field checks
      const { id } = request.params;
      const { new_owner_id, password } = request.body;
      const jwtUser = request.user as JwtPayload;

      // Check if organization exists
      const orgForTransfer = await repoGetOrganizationById(id);
      if (!orgForTransfer) {
        return sendError(reply, 404, 'NOT_FOUND', 'Organization not found');
      }

      // Feature #2116: Verify password using async DB call
      const currentUser = await dbGetUserByEmail(jwtUser.email);
      if (!currentUser) {
        return sendError(reply, 404, 'NOT_FOUND', 'User not found');
      }

      const validPassword = await bcrypt.compare(password, currentUser.password_hash);
      if (!validPassword) {
        return sendError(reply, 401, 'UNAUTHORIZED', 'Invalid password');
      }

      // Get current members
      const members = await repoGetOrganizationMembers(id);

      // Find the new owner in members
      const newOwner = members.find(m => m.user_id === new_owner_id);
      if (!newOwner) {
        return sendError(reply, 404, 'NOT_FOUND', 'New owner must be a member of the organization');
      }

      // Find current owner
      const currentOwner = members.find(m => m.user_id === jwtUser.id);
      if (!currentOwner) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Current owner not found in organization');
      }

      // Cannot transfer to yourself
      if (new_owner_id === jwtUser.id) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Cannot transfer ownership to yourself');
      }

      // Transfer ownership
      const oldOwnerEmail = jwtUser.email;
      await repoUpdateMemberRole(id, new_owner_id, 'owner');
      await repoUpdateMemberRole(id, jwtUser.id, 'admin');

      // Get new owner details for response
      // Feature #2116: Use async DB call instead of iterating Map
      const newOwnerUser = await dbGetUserById(new_owner_id);
      const newOwnerEmail = newOwnerUser?.email || '';

      log.info({
        organizationId: id,
        previousOwner: oldOwnerEmail,
        newOwner: newOwnerEmail,
      }, 'Organization ownership transferred');

      return {
        message: 'Ownership transferred successfully',
        previous_owner: {
          user_id: jwtUser.id,
          new_role: 'admin',
        },
        new_owner: {
          user_id: new_owner_id,
          role: 'owner',
        },
      };
    }
  );
}
