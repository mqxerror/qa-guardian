import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { authenticate, requireRoles, JwtPayload, getOrganizationId } from '../middleware/auth';
// Feature #2116: Use async DB calls instead of synchronous Map
import { dbGetUserByEmail } from './auth';
import { getUserById as dbGetUserById } from '../services/repositories/auth';
// projects Map removed in Feature #2110 - using async DB functions
// testSuites/tests Maps removed in Feature #2110 - using async DB functions
import { testRuns } from './test-runs';
import { listAuditLogsRepo } from './audit-logs';
import {
  listAllTestSuites as dbListAllTestSuites,
  listAllTests as dbListAllTests,
  deleteTestSuite as dbDeleteTestSuiteAsync,
  deleteTest as dbDeleteTestAsync,
  getTestSuite as dbGetTestSuiteAsync,
  getTest as dbGetTestAsync,
} from './test-suites/stores';
import { getProject as dbGetProjectAsync, listProjects as dbListProjectsAsync, deleteProject as dbDeleteProjectAsync } from './projects/stores';
import { listTestRunsByOrg as dbListTestRunsByOrg } from '../services/repositories/test-runs';

// Feature #2109: Fully migrated to async DB calls - no more in-memory Maps
import {
  Organization,
  OrganizationMember,
  Invitation,
  AutoQuarantineSettings,
  RetryStrategySettings,
  RetryStrategyRule,
  DEFAULT_AUTO_QUARANTINE_SETTINGS,
  DEFAULT_RETRY_STRATEGY_SETTINGS,
  DEFAULT_ORG_ID,
  OTHER_ORG_ID,
  DEFAULT_USER_IDS,
  createOrganization as repoCreateOrganization,
  getOrganizationById as repoGetOrganizationById,
  getOrganizationBySlug as repoGetOrganizationBySlug,
  updateOrganization as repoUpdateOrganization,
  deleteOrganization as repoDeleteOrganization,
  listOrganizations as repoListOrganizations,
  addOrganizationMember as repoAddOrganizationMember,
  removeOrganizationMember as repoRemoveOrganizationMember,
  getOrganizationMembers as repoGetOrganizationMembers,
  updateMemberRole as repoUpdateMemberRole,
  createInvitation as repoCreateInvitation,
  getInvitationById as repoGetInvitationById,
  getInvitationsByOrg as repoGetInvitationsByOrg,
  updateInvitation as repoUpdateInvitation,
  deleteInvitation as repoDeleteInvitation,
  getAutoQuarantineSettings as repoGetAutoQuarantineSettings,
  setAutoQuarantineSettings as repoSetAutoQuarantineSettings,
  getRetryStrategySettings as repoGetRetryStrategySettings,
  setRetryStrategySettings as repoSetRetryStrategySettings,
  getRetriesForFlakinessScore as repoGetRetriesForFlakinessScore,
} from '../services/repositories/organizations';

// Re-export types for backward compatibility
export type { AutoQuarantineSettings, RetryStrategySettings, RetryStrategyRule };

// Re-export default settings and UUID constants
export { DEFAULT_AUTO_QUARANTINE_SETTINGS, DEFAULT_RETRY_STRATEGY_SETTINGS, DEFAULT_ORG_ID, OTHER_ORG_ID, DEFAULT_USER_IDS };

// Re-export helper functions from repository
export const getRetryStrategySettings = repoGetRetryStrategySettings;
export const setRetryStrategySettings = repoSetRetryStrategySettings;
export const getRetriesForFlakinessScore = repoGetRetriesForFlakinessScore;
export const getAutoQuarantineSettings = repoGetAutoQuarantineSettings;
export const setAutoQuarantineSettings = repoSetAutoQuarantineSettings;

// Import async DB functions for user organization lookup
import {
  getUserOrganization as dbGetUserOrganization,
  getUserOrganizations as dbGetUserOrganizations,
} from '../services/repositories/organizations';

// Feature #2109: Fully async DB-backed organization lookup
export async function getUserOrganization(userId: string): Promise<string | null> {
  return await dbGetUserOrganization(userId);
}

// Feature #2109: Fully async DB-backed organization list
export async function getUserOrganizations(userId: string): Promise<Array<{ organization_id: string; role: string; organization: Organization | undefined }>> {
  const dbResult = await dbGetUserOrganizations(userId);
  if (dbResult && dbResult.length > 0) {
    const orgs = await Promise.all(dbResult.map(async r => ({
      organization_id: r.organization_id,
      role: r.role,
      organization: (await repoGetOrganizationById(r.organization_id)) || undefined,
    })));
    return orgs;
  }
  return [];
}

interface InvitationBody {
  email: string;
  role: 'admin' | 'developer' | 'viewer';
}

interface OrgParams {
  id: string;
}

interface CreateOrganizationBody {
  name: string;
  slug?: string;
  timezone?: string;
}

// Helper to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function organizationRoutes(app: FastifyInstance) {
  // Get all organizations the current user belongs to
  app.get('/api/v1/organizations', {
    preHandler: [authenticate],
  }, async (request) => {
    const user = request.user as JwtPayload;
    const userOrgs = await getUserOrganizations(user.id);

    return {
      organizations: userOrgs.map(org => ({
        id: org.organization_id,
        name: org.organization?.name,
        slug: org.organization?.slug,
        role: org.role,
        is_current: org.organization_id === user.organization_id,
      })),
      current_organization_id: user.organization_id,
    };
  });

  // Switch to a different organization - issues a new token
  app.post<{ Body: { organization_id: string } }>('/api/v1/organizations/switch', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { organization_id } = request.body;

    if (!organization_id) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'organization_id is required',
      });
    }

    // Check if user belongs to the target organization
    const userOrgs = await getUserOrganizations(user.id);
    const targetOrg = userOrgs.find(o => o.organization_id === organization_id);

    if (!targetOrg) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You are not a member of this organization',
      });
    }

    // Generate a new token with the new organization
    const token = app.jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: targetOrg.role, // Use role in the target organization
        organization_id: organization_id,
      },
      { expiresIn: '7d' }
    );

    return {
      token,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
      organization: {
        id: organization_id,
        name: targetOrg.organization?.name,
        slug: targetOrg.organization?.slug,
        role: targetOrg.role,
      },
    };
  });

  // Create organization
  app.post<{ Body: CreateOrganizationBody }>('/api/v1/organizations', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { name, slug: providedSlug, timezone = 'UTC' } = request.body;
    const user = request.user as JwtPayload;

    if (!name || name.trim().length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Organization name is required',
      });
    }

    if (name.length > 100) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Organization name must be 100 characters or less',
      });
    }

    // Generate or validate slug
    const slug = providedSlug || generateSlug(name);

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Slug can only contain lowercase letters, numbers, and hyphens',
      });
    }

    // Check for duplicate slug
    const existingOrg = await repoGetOrganizationBySlug(slug);
    if (existingOrg) {
      return reply.status(409).send({
        error: 'Conflict',
        message: 'An organization with this slug already exists',
      });
    }

    // Create the organization
    const id = crypto.randomUUID();
    const organization: Organization = {
      id,
      name: name.trim(),
      slug,
      timezone,
      created_at: new Date(),
    };

    await repoCreateOrganization(organization);

    // Add the creating user as owner
    await repoAddOrganizationMember({
      user_id: user.id,
      organization_id: id,
      role: 'owner',
    });

    return reply.status(201).send({
      organization,
      message: 'Organization created successfully',
    });
  });

  // Get organization
  app.get<{ Params: OrgParams }>('/api/v1/organizations/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const org = await repoGetOrganizationById(id);

    if (!org) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Organization not found',
      });
    }

    return { organization: org };
  });

  // Get organization members (with user details)
  app.get<{ Params: OrgParams }>('/api/v1/organizations/:id/members', {
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
  app.post<{ Params: OrgParams; Body: InvitationBody }>('/api/v1/organizations/:id/invitations', {
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request, reply) => {
    const { id } = request.params;
    const { email, role } = request.body;
    const user = request.user as JwtPayload;

    if (!email || !role) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Email and role are required',
      });
    }

    if (!['admin', 'developer', 'viewer'].includes(role)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid role. Must be admin, developer, or viewer',
      });
    }

    // Check if organization exists
    const orgExists = await repoGetOrganizationById(id);
    if (!orgExists) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Organization not found',
      });
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

    // Log to console (email would be sent in production)
    console.log(`
====================================
  Invitation Created
====================================
  To: ${email}
  Role: ${role}
  Organization: ${id}
  Invited by: ${user.email}
====================================
    `);

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
  app.get<{ Params: OrgParams }>('/api/v1/organizations/:id/invitations', {
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request, reply) => {
    const { id } = request.params;

    const orgInvitations = await repoGetInvitationsByOrg(id);

    return { invitations: orgInvitations };
  });

  // Delete invitation (requires owner or admin role)
  app.delete<{ Params: { id: string; inviteId: string } }>('/api/v1/organizations/:id/invitations/:inviteId', {
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request, reply) => {
    const { inviteId } = request.params;

    const invToDelete = await repoGetInvitationById(inviteId);
    if (!invToDelete) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Invitation not found',
      });
    }

    await repoDeleteInvitation(inviteId);

    return { message: 'Invitation deleted successfully' };
  });

  // Get invitation details (public - for accepting)
  app.get<{ Params: { inviteId: string } }>('/api/v1/invitations/:inviteId', async (request, reply) => {
    const { inviteId } = request.params;

    const invitation = await repoGetInvitationById(inviteId);
    if (!invitation) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Invitation not found or has expired',
      });
    }

    if (invitation.status !== 'pending') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: invitation.status === 'accepted'
          ? 'This invitation has already been accepted'
          : 'This invitation has expired',
      });
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
  app.post<{ Params: { inviteId: string } }>('/api/v1/invitations/:inviteId/accept', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { inviteId } = request.params;
    const user = request.user as JwtPayload;

    const invitation = await repoGetInvitationById(inviteId);
    if (!invitation) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Invitation not found',
      });
    }

    if (invitation.status !== 'pending') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: invitation.status === 'accepted'
          ? 'This invitation has already been accepted'
          : 'This invitation has expired',
      });
    }

    // Verify the logged in user's email matches the invitation
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'This invitation was sent to a different email address',
      });
    }

    // Check if organization still exists
    const org = await repoGetOrganizationById(invitation.organization_id);
    if (!org) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'The organization no longer exists',
      });
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

    console.log(`
====================================
  Invitation Accepted
====================================
  User: ${user.email}
  Organization: ${org.name}
  Role: ${invitation.role}
====================================
    `);

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

  // Update organization (requires owner or admin role)
  app.patch<{ Params: OrgParams; Body: Partial<Organization> }>('/api/v1/organizations/:id', {
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;

    const org = await repoGetOrganizationById(id);
    if (!org) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Organization not found',
      });
    }

    // Update allowed fields
    const updateFields: Partial<Organization> = {};
    if (updates.name) updateFields.name = updates.name;
    if (updates.timezone) updateFields.timezone = updates.timezone;

    const updatedOrg = await repoUpdateOrganization(id, updateFields);

    return { organization: updatedOrg || org };
  });

  // Delete organization (requires owner role only AND password confirmation)
  app.delete<{ Params: OrgParams; Body: { password: string } }>('/api/v1/organizations/:id', {
    preHandler: [authenticate, requireRoles(['owner'])],
  }, async (request, reply) => {
    const { id } = request.params;
    const { password } = request.body || {};
    const jwtUser = request.user as JwtPayload;

    // Require password confirmation
    if (!password) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Password confirmation is required to delete an organization',
      });
    }

    // Feature #2116: Get user using async DB call
    const user = await dbGetUserByEmail(jwtUser.email);
    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Incorrect password. Please try again.',
      });
    }

    // Check if organization exists
    const orgToDelete = await repoGetOrganizationById(id);
    if (!orgToDelete) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Organization not found',
      });
    }

    // Verify user owns this organization
    if (jwtUser.organization_id !== id) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You can only delete your own organization',
      });
    }

    // Cascade delete all organization data using async DB calls
    // 1. Delete test runs for this organization (clear from in-memory Map)
    let deletedRuns = 0;
    for (const [runId, run] of testRuns) {
      if (run.organization_id === id) {
        testRuns.delete(runId);
        deletedRuns++;
      }
    }

    // 2. Get org suites and tests from DB for counting and deletion
    const orgSuites = await dbListAllTestSuites(id);
    const orgTests = await dbListAllTests(id);

    // 3. Delete tests in organization (DB)
    for (const test of orgTests) {
      await dbDeleteTestAsync(test.id);
    }

    // 4. Delete test suites (DB)
    for (const suite of orgSuites) {
      await dbDeleteTestSuiteAsync(suite.id);
    }

    // 5. Delete projects (DB)
    const orgProjects = await dbListProjectsAsync(id);
    let deletedProjects = 0;
    for (const project of orgProjects) {
      await dbDeleteProjectAsync(project.id);
      deletedProjects++;
    }

    // 6. Delete the organization and members
    const membersList = await repoGetOrganizationMembers(id);
    const memberCount = membersList.length;
    await repoDeleteOrganization(id);

    console.log(`\n[ORGANIZATION DELETED] Organization ${id} was deleted by ${jwtUser.email}`);
    console.log(`  Cascade deleted: ${deletedProjects} projects, ${orgSuites.length} suites, ${orgTests.length} tests, ${deletedRuns} runs, ${memberCount} members\n`);

    return { message: 'Organization deleted successfully' };
  });

  // Remove member from organization (requires owner or admin role)
  app.delete<{ Params: { id: string; memberId: string } }>('/api/v1/organizations/:id/members/:memberId', {
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request, reply) => {
    const { id, memberId } = request.params;
    const jwtUser = request.user as JwtPayload;

    // Check if organization exists
    const orgForRemove = await repoGetOrganizationById(id);
    if (!orgForRemove) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Organization not found',
      });
    }

    // Get current members
    const members = await repoGetOrganizationMembers(id);

    // Find the member to remove
    const memberToRemove = members.find(m => m.user_id === memberId);
    if (!memberToRemove) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Member not found in organization',
      });
    }

    // Cannot remove the owner
    if (memberToRemove.role === 'owner') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Cannot remove the organization owner',
      });
    }

    // Cannot remove yourself
    if (memberToRemove.user_id === jwtUser.id) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Cannot remove yourself from the organization',
      });
    }

    // Remove the member
    await repoRemoveOrganizationMember(id, memberId);

    console.log(`\n[MEMBER REMOVED] User ${memberId} removed from organization ${id} by ${jwtUser.email}\n`);

    return { message: 'Member removed successfully' };
  });

  // Update member role (requires owner or admin role)
  app.patch<{ Params: { id: string; memberId: string }; Body: { role: 'admin' | 'developer' | 'viewer' } }>(
    '/api/v1/organizations/:id/members/:memberId',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin'])],
    },
    async (request, reply) => {
      const { id, memberId } = request.params;
      const { role } = request.body;
      const jwtUser = request.user as JwtPayload;

      // Validate role
      if (!role || !['admin', 'developer', 'viewer'].includes(role)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Valid role is required (admin, developer, or viewer)',
        });
      }

      // Check if organization exists
      const orgForUpdate = await repoGetOrganizationById(id);
      if (!orgForUpdate) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Organization not found',
        });
      }

      // Get current members
      const members = await repoGetOrganizationMembers(id);

      // Find the member to update
      const memberToUpdate = members.find(m => m.user_id === memberId);
      if (!memberToUpdate) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Member not found in organization',
        });
      }

      // Cannot change the owner's role
      if (memberToUpdate.role === 'owner') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Cannot change the organization owner\'s role',
        });
      }

      // Admins cannot promote others to admin (only owner can)
      if (jwtUser.role === 'admin' && role === 'admin') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Only the organization owner can promote members to admin',
        });
      }

      // Update the role
      const oldRole = memberToUpdate.role;
      await repoUpdateMemberRole(id, memberId, role);

      console.log(`\n[ROLE UPDATED] User ${memberId} role changed from ${oldRole} to ${role} by ${jwtUser.email}\n`);

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
  app.post<{ Params: OrgParams; Body: { new_owner_id: string; password: string } }>(
    '/api/v1/organizations/:id/transfer-ownership',
    {
      preHandler: [authenticate, requireRoles(['owner'])],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { new_owner_id, password } = request.body;
      const jwtUser = request.user as JwtPayload;

      // Validate inputs
      if (!new_owner_id || !password) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'New owner ID and password are required',
        });
      }

      // Check if organization exists
      const orgForTransfer = await repoGetOrganizationById(id);
      if (!orgForTransfer) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Organization not found',
        });
      }

      // Feature #2116: Verify password using async DB call
      const currentUser = await dbGetUserByEmail(jwtUser.email);
      if (!currentUser) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'User not found',
        });
      }

      const validPassword = await bcrypt.compare(password, currentUser.password_hash);
      if (!validPassword) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid password',
        });
      }

      // Get current members
      const members = await repoGetOrganizationMembers(id);

      // Find the new owner in members
      const newOwner = members.find(m => m.user_id === new_owner_id);
      if (!newOwner) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'New owner must be a member of the organization',
        });
      }

      // Find current owner
      const currentOwner = members.find(m => m.user_id === jwtUser.id);
      if (!currentOwner) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Current owner not found in organization',
        });
      }

      // Cannot transfer to yourself
      if (new_owner_id === jwtUser.id) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Cannot transfer ownership to yourself',
        });
      }

      // Transfer ownership
      const oldOwnerEmail = jwtUser.email;
      await repoUpdateMemberRole(id, new_owner_id, 'owner');
      await repoUpdateMemberRole(id, jwtUser.id, 'admin');

      // Get new owner details for response
      // Feature #2116: Use async DB call instead of iterating Map
      const newOwnerUser = await dbGetUserById(new_owner_id);
      const newOwnerEmail = newOwnerUser?.email || '';

      console.log(`\n[OWNERSHIP TRANSFERRED] Organization ${id} ownership transferred from ${oldOwnerEmail} to ${newOwnerEmail}\n`);

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

  // Feature #1002: Get team metrics - productivity metrics for organization members
  app.get<{ Params: OrgParams; Querystring: { period?: string; include_trends?: string; include_activity?: string } }>(
    '/api/v1/organizations/:id/team-metrics',
    {
      preHandler: [authenticate, requireRoles(['owner', 'admin'])],
    },
    async (request, reply) => {
      const { id: orgId } = request.params;
      const userOrgId = getOrganizationId(request);
      const period = request.query.period || '30d';
      const includeTrends = request.query.include_trends !== 'false';
      const includeActivity = request.query.include_activity !== 'false';

      // Verify user has access to this organization
      if (orgId !== userOrgId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You do not have access to this organization',
        });
      }

      // Parse period
      const periodMatch = period.match(/^(\d+)([dhw])$/);
      if (!periodMatch) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid period format. Use formats like 7d, 14d, 30d, or 4w',
        });
      }

      const periodValue = parseInt(periodMatch[1], 10);
      const periodUnit = periodMatch[2];
      let periodMs: number;
      switch (periodUnit) {
        case 'h':
          periodMs = periodValue * 60 * 60 * 1000;
          break;
        case 'd':
          periodMs = periodValue * 24 * 60 * 60 * 1000;
          break;
        case 'w':
          periodMs = periodValue * 7 * 24 * 60 * 60 * 1000;
          break;
        default:
          periodMs = 30 * 24 * 60 * 60 * 1000;
      }

      const cutoffDate = new Date(Date.now() - periodMs);
      const previousCutoffDate = new Date(Date.now() - periodMs * 2);

      // Get organization members
      const memberRecords = await repoGetOrganizationMembers(orgId);

      // Feature #2116: Build member details map using async DB calls
      const memberDetails = new Map<string, { id: string; name: string; email: string; role: string }>();
      for (const member of memberRecords) {
        const user = await dbGetUserById(member.user_id);
        if (user) {
          memberDetails.set(member.user_id, {
            id: user.id,
            name: user.name,
            email: user.email,
            role: member.role,
          });
        }
      }

      // Feature #2119: Get audit logs for this organization using async DB call
      const { logs: allOrgLogs } = await listAuditLogsRepo(orgId, { limit: 10000 });
      const currentPeriodLogs = allOrgLogs.filter(
        log => log.created_at >= cutoffDate
      );

      const previousPeriodLogs = includeTrends
        ? allOrgLogs.filter(
            log => log.created_at >= previousCutoffDate &&
                   log.created_at < cutoffDate
          )
        : [];

      // Calculate metrics per user
      const userMetrics: Array<{
        user_id: string;
        user_name: string;
        user_email: string;
        role: string;
        tests_created: number;
        tests_updated: number;
        tests_deleted: number;
        runs_triggered: number;
        runs_completed: number;
        suites_created: number;
        projects_created: number;
        total_actions: number;
        last_activity?: string;
        activity_score: number;
      }> = [];

      for (const [userId, details] of memberDetails) {
        const userLogs = currentPeriodLogs.filter(log => log.user_id === userId);

        // Count actions by type
        const testsCreated = userLogs.filter(log => log.action === 'create' && log.resource_type === 'test').length;
        const testsUpdated = userLogs.filter(log => log.action === 'update' && log.resource_type === 'test').length;
        const testsDeleted = userLogs.filter(log => log.action === 'delete' && log.resource_type === 'test').length;
        const runsTriggered = userLogs.filter(log => log.action === 'create' && log.resource_type === 'test_run').length;
        const runsCompleted = userLogs.filter(log => log.action === 'complete' && log.resource_type === 'test_run').length;
        const suitesCreated = userLogs.filter(log => log.action === 'create' && log.resource_type === 'test_suite').length;
        const projectsCreated = userLogs.filter(log => log.action === 'create' && log.resource_type === 'project').length;

        // Get last activity
        const sortedLogs = userLogs.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
        const lastActivity = sortedLogs.length > 0 ? sortedLogs[0].created_at.toISOString() : undefined;

        // Calculate activity score (weighted sum of actions)
        const activityScore =
          testsCreated * 3 +
          testsUpdated * 1 +
          runsTriggered * 2 +
          runsCompleted * 1 +
          suitesCreated * 4 +
          projectsCreated * 5;

        userMetrics.push({
          user_id: userId,
          user_name: details.name,
          user_email: details.email,
          role: details.role,
          tests_created: testsCreated,
          tests_updated: testsUpdated,
          tests_deleted: testsDeleted,
          runs_triggered: runsTriggered,
          runs_completed: runsCompleted,
          suites_created: suitesCreated,
          projects_created: projectsCreated,
          total_actions: userLogs.length,
          last_activity: lastActivity,
          activity_score: activityScore,
        });
      }

      // Sort by activity score descending
      userMetrics.sort((a, b) => b.activity_score - a.activity_score);

      // Calculate totals
      const totals = {
        tests_created: userMetrics.reduce((sum, m) => sum + m.tests_created, 0),
        tests_updated: userMetrics.reduce((sum, m) => sum + m.tests_updated, 0),
        runs_triggered: userMetrics.reduce((sum, m) => sum + m.runs_triggered, 0),
        runs_completed: userMetrics.reduce((sum, m) => sum + m.runs_completed, 0),
        suites_created: userMetrics.reduce((sum, m) => sum + m.suites_created, 0),
        projects_created: userMetrics.reduce((sum, m) => sum + m.projects_created, 0),
        total_actions: userMetrics.reduce((sum, m) => sum + m.total_actions, 0),
      };

      // Calculate trends
      let trends: {
        tests_created_change: number;
        runs_triggered_change: number;
        total_actions_change: number;
        trend_direction: 'improving' | 'declining' | 'stable';
      } | null = null;

      if (includeTrends && previousPeriodLogs.length > 0) {
        const prevTestsCreated = previousPeriodLogs.filter(
          log => log.action === 'create' && log.resource_type === 'test'
        ).length;
        const prevRunsTriggered = previousPeriodLogs.filter(
          log => log.action === 'create' && log.resource_type === 'test_run'
        ).length;
        const prevTotalActions = previousPeriodLogs.length;

        const testsCreatedChange = totals.tests_created - prevTestsCreated;
        const runsTriggeredChange = totals.runs_triggered - prevRunsTriggered;
        const totalActionsChange = totals.total_actions - prevTotalActions;

        const avgChange = (testsCreatedChange + runsTriggeredChange + totalActionsChange) / 3;

        trends = {
          tests_created_change: testsCreatedChange,
          runs_triggered_change: runsTriggeredChange,
          total_actions_change: totalActionsChange,
          trend_direction: avgChange > 2 ? 'improving' : avgChange < -2 ? 'declining' : 'stable',
        };
      }

      // Calculate activity by day for the period
      let activityByDay: Array<{ date: string; actions: number; tests_created: number; runs_triggered: number }> | null = null;

      if (includeActivity) {
        const dayMap = new Map<string, { actions: number; tests_created: number; runs_triggered: number }>();

        for (const log of currentPeriodLogs) {
          const dayKey = log.created_at.toISOString().split('T')[0];
          const existing = dayMap.get(dayKey) || { actions: 0, tests_created: 0, runs_triggered: 0 };
          existing.actions++;
          if (log.action === 'create' && log.resource_type === 'test') {
            existing.tests_created++;
          }
          if (log.action === 'create' && log.resource_type === 'test_run') {
            existing.runs_triggered++;
          }
          dayMap.set(dayKey, existing);
        }

        activityByDay = Array.from(dayMap.entries())
          .map(([date, data]) => ({ date, ...data }))
          .sort((a, b) => a.date.localeCompare(b.date));
      }

      // Calculate active members (members with at least one action in period)
      const activeMembers = userMetrics.filter(m => m.total_actions > 0).length;

      return {
        organization_id: orgId,
        period,
        period_start: cutoffDate.toISOString(),
        period_end: new Date().toISOString(),
        members: userMetrics,
        totals,
        summary: {
          total_members: memberDetails.size,
          active_members: activeMembers,
          inactive_members: memberDetails.size - activeMembers,
          average_actions_per_member: memberDetails.size > 0
            ? Math.round(totals.total_actions / memberDetails.size * 10) / 10
            : 0,
          most_active_member: userMetrics.length > 0 && userMetrics[0].total_actions > 0
            ? { user_id: userMetrics[0].user_id, user_name: userMetrics[0].user_name, actions: userMetrics[0].total_actions }
            : null,
        },
        ...(trends && { trends }),
        ...(activityByDay && { activity_by_day: activityByDay }),
      };
    }
  );

  // ===========================================
  // Feature #1104: Auto-Quarantine Settings
  // ===========================================

  // Get auto-quarantine settings for the organization
  app.get('/api/v1/organization/auto-quarantine-settings', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const settings = await getAutoQuarantineSettings(orgId);

    return {
      settings,
      organization_id: orgId,
      note: 'Tests exceeding the flakiness threshold will be automatically quarantined during test runs',
    };
  });

  // Update auto-quarantine settings for the organization (requires owner or admin role)
  app.patch<{
    Body: Partial<AutoQuarantineSettings>;
  }>('/api/v1/organization/auto-quarantine-settings', {
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const updates = request.body;

    const settings = await setAutoQuarantineSettings(orgId, updates);

    return {
      message: 'Auto-quarantine settings updated successfully',
      settings,
      organization_id: orgId,
    };
  });

  // Get auto-quarantine statistics for the organization
  app.get('/api/v1/organization/auto-quarantine-stats', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const settings = await getAutoQuarantineSettings(orgId);

    // Get all tests that were auto-quarantined (using async DB call)
    const allOrgTests = await dbListAllTests(orgId);
    const autoQuarantinedTests = await Promise.all(
      allOrgTests
        .filter(t =>
          t.quarantined &&
          (t as { quarantine_reason?: string }).quarantine_reason?.startsWith(settings.quarantine_reason_prefix)
        )
        .map(async t => {
          const suite = await dbGetTestSuiteAsync(t.suite_id);
          const project = suite ? await dbGetProjectAsync(suite.project_id) : null;
          return {
            test_id: t.id,
            test_name: t.name,
            suite_name: suite?.name || 'Unknown',
            project_name: project?.name || 'Unknown',
            quarantine_reason: (t as { quarantine_reason?: string }).quarantine_reason,
            quarantined_at: (t as { quarantined_at?: Date }).quarantined_at?.toISOString(),
          };
        })
    );

    return {
      settings,
      stats: {
        total_auto_quarantined: autoQuarantinedTests.length,
        tests: autoQuarantinedTests,
      },
      organization_id: orgId,
    };
  });

  // ===========================================
  // Feature #1105: Retry Strategy Settings
  // ===========================================

  // Get retry strategy settings for the organization
  app.get('/api/v1/organization/retry-strategy-settings', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const settings = await getRetryStrategySettings(orgId);

    return {
      settings,
      organization_id: orgId,
      note: 'Tests will be retried based on their flakiness score using these rules',
    };
  });

  // Update retry strategy settings for the organization (requires owner or admin role)
  app.patch<{
    Body: Partial<RetryStrategySettings>;
  }>('/api/v1/organization/retry-strategy-settings', {
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const updates = request.body;

    const settings = await setRetryStrategySettings(orgId, updates);

    return {
      message: 'Retry strategy settings updated successfully',
      settings,
      organization_id: orgId,
    };
  });

  // Get retry count for a specific test based on its flakiness score
  app.get<{
    Params: { testId: string };
  }>('/api/v1/organization/retry-strategy/:testId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const orgId = getOrganizationId(request);

    // Find the test using async DB call
    const test = await dbGetTestAsync(testId);
    if (!test || test.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    // Get the test's flakiness score (use 0 if not available)
    const flakinessScore = (test as { flakiness_score?: number }).flakiness_score ?? 0;
    const retries = await getRetriesForFlakinessScore(orgId, flakinessScore);
    const settings = await getRetryStrategySettings(orgId);

    // Find which rule was applied
    let appliedRule: RetryStrategyRule | null = null;
    for (const rule of settings.rules) {
      if (flakinessScore >= rule.min_score && flakinessScore < rule.max_score) {
        appliedRule = rule;
        break;
      }
    }

    return {
      test_id: testId,
      test_name: test.name,
      flakiness_score: flakinessScore,
      retries,
      applied_rule: appliedRule,
      strategy_enabled: settings.enabled,
      organization_id: orgId,
    };
  });

  // Preview retry counts for all flaky tests
  app.get('/api/v1/organization/retry-strategy-preview', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const settings = await getRetryStrategySettings(orgId);

    // Get all tests with flakiness data using async DB call
    const testsArray = await dbListAllTests(orgId);
    const allTestsWithRetries = await Promise.all(testsArray.map(async (t) => {
        const flakinessScore = (t as { flakiness_score?: number }).flakiness_score ?? 0;
        const retries = await getRetriesForFlakinessScore(orgId, flakinessScore);

        // Find which rule was applied
        let appliedRule: string = 'default';
        for (const rule of settings.rules) {
          if (flakinessScore >= rule.min_score && flakinessScore < rule.max_score) {
            appliedRule = `${(rule.min_score * 100).toFixed(0)}%-${(rule.max_score * 100).toFixed(0)}%`;
            break;
          }
        }

        const suite = await dbGetTestSuiteAsync(t.suite_id);
        const project = suite ? await dbGetProjectAsync(suite.project_id) : null;

        return {
          test_id: t.id,
          test_name: t.name,
          suite_name: suite?.name || 'Unknown',
          project_name: project?.name || 'Unknown',
          flakiness_score: flakinessScore,
          flakiness_percentage: Math.round(flakinessScore * 100),
          retries,
          applied_rule: appliedRule,
          severity: flakinessScore >= 0.6 ? 'high' : flakinessScore >= 0.3 ? 'medium' : 'low',
        };
      }));

    // Filter and sort after Promise.all completes
    const testsWithRetries = allTestsWithRetries
      .filter(t => t.flakiness_score > 0) // Only include tests with flakiness data
      .sort((a, b) => b.flakiness_score - a.flakiness_score);

    // Summary by rule
    const rulesSummary = settings.rules.map(rule => {
      const testsInRule = testsWithRetries.filter(
        t => t.flakiness_score >= rule.min_score && t.flakiness_score < rule.max_score
      );
      return {
        range: `${(rule.min_score * 100).toFixed(0)}%-${((rule.max_score >= 1 ? 100 : rule.max_score * 100)).toFixed(0)}%`,
        retries: rule.retries,
        test_count: testsInRule.length,
        tests: testsInRule.map(t => ({ test_id: t.test_id, test_name: t.test_name, flakiness_percentage: t.flakiness_percentage })),
      };
    });

    return {
      settings,
      preview: {
        total_flaky_tests: testsWithRetries.length,
        tests: testsWithRetries,
        by_rule: rulesSummary,
      },
      organization_id: orgId,
    };
  });
}
