/**
 * Organizations Module - CRUD Routes
 * Feature #730: Split organizations.ts into sub-modules
 *
 * Handles organization list, get, create, update, and delete operations.
 */

import { FastifyInstance } from 'fastify';
// Feature #455: Use native bcrypt for performance (removed bcryptjs)
import bcrypt from 'bcrypt';
import { authenticate, requireRoles, JwtPayload, getOrganizationId } from '../../middleware/auth.js';
import { createLogger } from '../../services/logger.js';
// Feature #713: Zod validation middleware
import {
  validateBody,
  validateParams,
  orgIdParamsSchema,
  switchOrganizationSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  deleteOrganizationSchema,
} from '../../validation/index.js';
// Feature #2116: Use async DB calls instead of synchronous Map
import { dbGetUserByEmail } from '../auth.js';
import { testRuns } from '../test-runs.js';
import {
  listAllTestSuites as dbListAllTestSuites,
  listAllTests as dbListAllTests,
  deleteTestSuite as dbDeleteTestSuiteAsync,
  deleteTest as dbDeleteTestAsync,
} from '../test-suites/stores.js';
import { listProjects as dbListProjectsAsync, deleteProject as dbDeleteProjectAsync } from '../projects/stores.js';
import { sendError } from '../../utils/errors.js';
import {
  Organization,
  createOrganization as repoCreateOrganization,
  getOrganizationById as repoGetOrganizationById,
  getOrganizationBySlug as repoGetOrganizationBySlug,
  updateOrganization as repoUpdateOrganization,
  deleteOrganization as repoDeleteOrganization,
  addOrganizationMember as repoAddOrganizationMember,
  getOrganizationMembers as repoGetOrganizationMembers,
} from '../../services/repositories/organizations.js';
import type { OrgParams, CreateOrganizationBody } from './types.js';
import { getUserOrganizations, generateSlug } from './helpers.js';

const log = createLogger('route:organizations:crud');

export async function crudRoutes(app: FastifyInstance) {
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
  // Feature #713: Add Zod validation
  app.post<{ Body: { organization_id: string } }>('/api/v1/organizations/switch', {
    preValidation: [validateBody(switchOrganizationSchema)],
    preHandler: [authenticate],
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    // Feature #713: Zod validation now handles required field check
    const { organization_id } = request.body;

    // Check if user belongs to the target organization
    const userOrgs = await getUserOrganizations(user.id);
    const targetOrg = userOrgs.find(o => o.organization_id === organization_id);

    if (!targetOrg) {
      return sendError(reply, 403, 'FORBIDDEN', 'You are not a member of this organization');
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
  // Feature #713: Add Zod validation
  app.post<{ Body: CreateOrganizationBody }>('/api/v1/organizations', {
    preValidation: [validateBody(createOrganizationSchema)],
    preHandler: [authenticate],
  }, async (request, reply) => {
    // Feature #713: Zod validation now handles required fields and constraints
    const { name, slug: providedSlug, timezone = 'UTC' } = request.body;
    const user = request.user as JwtPayload;

    // Generate or validate slug
    const slug = providedSlug || generateSlug(name);

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Slug can only contain lowercase letters, numbers, and hyphens');
    }

    // Check for duplicate slug
    const existingOrg = await repoGetOrganizationBySlug(slug);
    if (existingOrg) {
      return sendError(reply, 409, 'CONFLICT', 'An organization with this slug already exists');
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
  // Feature #713: Add Zod param validation
  app.get<{ Params: OrgParams }>('/api/v1/organizations/:id', {
    preValidation: [validateParams(orgIdParamsSchema)],
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const org = await repoGetOrganizationById(id);

    if (!org) {
      return sendError(reply, 404, 'NOT_FOUND', 'Organization not found');
    }

    return { organization: org };
  });

  // Update organization (requires owner or admin role)
  // Feature #713: Add Zod validation
  app.patch<{ Params: OrgParams; Body: Partial<Organization> }>('/api/v1/organizations/:id', {
    preValidation: [validateParams(orgIdParamsSchema), validateBody(updateOrganizationSchema)],
    preHandler: [authenticate, requireRoles(['owner', 'admin'])],
  }, async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;

    const org = await repoGetOrganizationById(id);
    if (!org) {
      return sendError(reply, 404, 'NOT_FOUND', 'Organization not found');
    }

    // Update allowed fields
    const updateFields: Partial<Organization> = {};
    if (updates.name) updateFields.name = updates.name;
    if (updates.timezone) updateFields.timezone = updates.timezone;

    const updatedOrg = await repoUpdateOrganization(id, updateFields);

    return { organization: updatedOrg || org };
  });

  // Delete organization (requires owner role only AND password confirmation)
  // Feature #713: Add Zod validation
  app.delete<{ Params: OrgParams; Body: { password: string } }>('/api/v1/organizations/:id', {
    preValidation: [validateParams(orgIdParamsSchema), validateBody(deleteOrganizationSchema)],
    preHandler: [authenticate, requireRoles(['owner'])],
  }, async (request, reply) => {
    // Feature #713: Zod validation now handles password requirement check
    const { id } = request.params;
    const { password } = request.body;
    const jwtUser = request.user as JwtPayload;

    // Feature #2116: Get user using async DB call
    const user = await dbGetUserByEmail(jwtUser.email);
    if (!user) {
      return sendError(reply, 401, 'UNAUTHORIZED', 'User not found');
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return sendError(reply, 401, 'UNAUTHORIZED', 'Incorrect password. Please try again.');
    }

    // Check if organization exists
    const orgToDelete = await repoGetOrganizationById(id);
    if (!orgToDelete) {
      return sendError(reply, 404, 'NOT_FOUND', 'Organization not found');
    }

    // Verify user owns this organization
    if (jwtUser.organization_id !== id) {
      return sendError(reply, 403, 'FORBIDDEN', 'You can only delete your own organization');
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

    log.info({
      organizationId: id,
      deletedBy: jwtUser.email,
      deletedProjects,
      deletedSuites: orgSuites.length,
      deletedTests: orgTests.length,
      deletedRuns,
      deletedMembers: memberCount,
    }, 'Organization deleted with cascade');

    return { message: 'Organization deleted successfully' };
  });
}
