// Projects Module - Core Project Routes
// Handles CRUD operations for projects and environment variables

import { FastifyInstance } from 'fastify';
import { authenticate, requireScopes, JwtPayload, ApiKeyPayload, getOrganizationId } from '../../middleware/auth';
import { TestSuite, Test } from '../test-suites';
import { testSuites, tests } from '../test-suites/maps';
import {
  listTestSuites as dbListTestSuitesByProject,
  listTests as dbListTestsBySuite,
  deleteTestSuite as dbDeleteTestSuiteAsync,
  deleteTest as dbDeleteTestAsync,
  createTestSuite as dbCreateTestSuiteAsync,
  createTest as dbCreateTestAsync,
  listAllTestSuites as dbListAllTestSuites,
} from '../test-suites/stores';
import { createTestRun as dbCreateTestRunAsync } from '../../services/repositories/test-runs';
import { logAuditEntry } from '../audit-logs';
import { Project, CreateProjectBody, ProjectParams, EnvironmentVariable } from './types';
import {
  projects,
  projectMembers,
  projectEnvVars,
  createProject as dbCreateProject,
  getProject as dbGetProject,
  updateProject as dbUpdateProject,
  deleteProject as dbDeleteProject,
  listProjects as dbListProjects,
  getProjectByName as dbGetProjectByName,
  addProjectMember as dbAddProjectMember,
  addProjectEnvVar as dbAddProjectEnvVar,
  getProjectEnvVars as dbGetProjectEnvVars,
  deleteProjectEnvVar as dbDeleteProjectEnvVar,
} from './stores';
import { hasProjectAccess } from './utils';
import { testRuns, BrowserType } from '../test-runs/execution';

export async function coreRoutes(app: FastifyInstance) {
  // List all projects (requires authentication, only from user's organization)
  // API keys need 'read' scope
  // For developers/viewers, only show projects they have explicit access to
  // Query params: include_archived=true to include archived projects, archived_only=true for only archived
  app.get<{ Querystring: { include_archived?: string; archived_only?: string } }>('/api/v1/projects', {
    preHandler: [authenticate, requireScopes(['read'])],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload | ApiKeyPayload;
    const { include_archived, archived_only } = request.query;

    // Use async database function with Map fallback
    let projectList = await dbListProjects(orgId);

    // For JWT users (not API keys), filter by project-level access for non-admin users
    if (!('type' in user)) {
      const jwtUser = user as JwtPayload;
      if (jwtUser.role !== 'owner' && jwtUser.role !== 'admin') {
        // Filter to only projects this user has explicit access to
        projectList = projectList.filter(p => hasProjectAccess(p.id, jwtUser.id, jwtUser.role));
      }
    }

    // Filter by archive status
    if (archived_only === 'true') {
      // Show only archived projects
      projectList = projectList.filter(p => p.archived === true);
    } else if (include_archived !== 'true') {
      // By default, hide archived projects
      projectList = projectList.filter(p => !p.archived);
    }
    // If include_archived=true, show all projects (no filtering)

    return { projects: projectList };
  });

  // Get single project (requires authentication, organization membership, and project access)
  app.get<{ Params: ProjectParams }>('/api/v1/projects/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const user = request.user as JwtPayload;
    const project = await dbGetProject(id);

    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Check if user belongs to the project's organization
    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Check project-level access for non-admin users
    if (!hasProjectAccess(id, user.id, user.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    return { project };
  });

  // Create project (requires authentication, at least developer role)
  // API keys need 'write' scope
  app.post<{ Body: CreateProjectBody }>('/api/v1/projects', {
    preHandler: [authenticate, requireScopes(['write'])],
  }, async (request, reply) => {
    const { name, description, base_url } = request.body;
    const user = request.user as JwtPayload | ApiKeyPayload;
    const orgId = getOrganizationId(request);

    // For JWT users, viewers cannot create projects
    if (!('type' in user) && user.role === 'viewer') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Viewers cannot create projects',
      });
    }

    // Validate name - trim and check for empty/whitespace-only
    const trimmedName = name?.trim();
    if (!trimmedName) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Project name is required',
      });
    }
    if (trimmedName.length < 2) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Project name must be at least 2 characters',
      });
    }
    if (trimmedName.length > 100) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Project name must be less than 100 characters',
      });
    }

    // Check for duplicate name within organization (use trimmed name)
    const existingProject = await dbGetProjectByName(orgId, trimmedName);
    if (existingProject) {
      return reply.status(409).send({
        error: 'Conflict',
        message: 'A project with this name already exists in your organization',
      });
    }

    const id = crypto.randomUUID();
    const slug = trimmedName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const projectData: Project = {
      id,
      organization_id: orgId,
      name: trimmedName,
      slug,
      description,
      base_url,
      archived: false,
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Save to database (falls back to in-memory if DB not available)
    const project = await dbCreateProject(projectData);

    // For non-admin/owner users, automatically add them as a project member
    // so they can access the project they just created
    if (!('type' in user)) {
      const jwtUser = user as JwtPayload;
      if (jwtUser.role !== 'owner' && jwtUser.role !== 'admin') {
        await dbAddProjectMember({
          project_id: id,
          user_id: jwtUser.id,
          role: 'admin', // Creator gets admin role on their project
          added_at: new Date(),
          added_by: jwtUser.id,
        });
        console.log(`[PROJECT CREATED] User ${jwtUser.id} automatically added as admin to their new project ${project.name}`);
      }
    }

    // Log audit entry
    logAuditEntry(request, 'create', 'project', id, project.name, { description, base_url });

    return reply.status(201).send({ project });
  });

  // Update project (requires authentication and organization membership)
  app.patch<{ Params: ProjectParams; Body: Partial<CreateProjectBody> }>('/api/v1/projects/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;
    const user = request.user as JwtPayload;

    // Viewers cannot update projects
    if (user.role === 'viewer') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Viewers cannot update projects',
      });
    }

    const project = await dbGetProject(id);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Check organization membership
    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Prepare update fields
    const updateFields: Partial<Project> = {};
    if (updates.name) {
      updateFields.name = updates.name;
      updateFields.slug = updates.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }
    if (updates.description !== undefined) updateFields.description = updates.description;
    if (updates.base_url !== undefined) updateFields.base_url = updates.base_url;

    // Update in database (falls back to in-memory if DB not available)
    const updatedProject = await dbUpdateProject(id, updateFields);

    // Log audit entry
    logAuditEntry(request, 'update', 'project', id, updatedProject?.name || project.name, { updates });

    return { project: updatedProject };
  });

  // Delete project (requires authentication, admin or owner, and organization membership)
  app.delete<{ Params: ProjectParams }>('/api/v1/projects/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const user = request.user as JwtPayload;

    // Only admin or owner can delete projects
    if (user.role !== 'admin' && user.role !== 'owner') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only administrators can delete projects',
      });
    }

    const project = await dbGetProject(id);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Check organization membership
    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Cascade delete: first delete all tests in suites belonging to this project
    const projectSuites = await dbListTestSuitesByProject(id, project.organization_id);
    for (const suite of projectSuites) {
      // Delete all tests in this suite
      const suiteTests = await dbListTestsBySuite(suite.id);
      for (const test of suiteTests) {
        await dbDeleteTestAsync(test.id);
        tests.delete(test.id); // Also clear from in-memory Map
      }
      // Delete the suite
      await dbDeleteTestSuiteAsync(suite.id);
      testSuites.delete(suite.id); // Also clear from in-memory Map
    }

    // Delete the project from database (falls back to in-memory if DB not available)
    const projectName = project.name;
    await dbDeleteProject(id);

    // Log audit entry
    logAuditEntry(request, 'delete', 'project', id, projectName);

    return { message: 'Project deleted successfully' };
  });

  // Archive/unarchive project (requires authentication, admin or owner, and organization membership)
  app.post<{ Params: ProjectParams; Body: { archived: boolean } }>('/api/v1/projects/:id/archive', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const { archived } = request.body;
    const user = request.user as JwtPayload;

    // Only admin or owner can archive projects
    if (user.role !== 'admin' && user.role !== 'owner') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only administrators can archive or unarchive projects',
      });
    }

    const project = await dbGetProject(id);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Check organization membership
    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Update archive status in database
    const updatedProject = await dbUpdateProject(id, {
      archived,
      archived_at: archived ? new Date() : undefined,
    });

    // Log audit entry
    const action = archived ? 'archive' : 'unarchive';
    logAuditEntry(request, action, 'project', id, project.name);

    return {
      project: updatedProject,
      message: archived ? 'Project archived successfully' : 'Project unarchived successfully',
    };
  });

  // ========== ENVIRONMENT VARIABLES ==========

  // List environment variables for a project
  app.get<{ Params: ProjectParams }>('/api/v1/projects/:id/env', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const user = request.user as JwtPayload;

    const project = await dbGetProject(id);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Check organization membership
    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    const envVars = await dbGetProjectEnvVars(id);

    // Mask secret values
    const maskedVars = envVars.map(v => ({
      ...v,
      value: v.is_secret ? '********' : v.value,
    }));

    return { env_vars: maskedVars };
  });

  // Add environment variable to a project
  app.post<{ Params: ProjectParams; Body: { key: string; value: string; is_secret?: boolean } }>('/api/v1/projects/:id/env', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const { key, value, is_secret = false } = request.body;
    const user = request.user as JwtPayload;

    // Only admin or owner can modify env vars
    if (user.role !== 'admin' && user.role !== 'owner') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only administrators can manage environment variables',
      });
    }

    const project = await dbGetProject(id);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Check organization membership
    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Validate key
    if (!key || key.trim().length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Environment variable key is required',
      });
    }

    const trimmedKey = key.trim().toUpperCase();
    if (!/^[A-Z_][A-Z0-9_]*$/.test(trimmedKey)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Key must start with a letter or underscore and contain only letters, numbers, and underscores',
      });
    }

    // Check for duplicate keys
    const envVars = await dbGetProjectEnvVars(id);
    if (envVars.some(v => v.key === trimmedKey)) {
      return reply.status(409).send({
        error: 'Conflict',
        message: `Environment variable '${trimmedKey}' already exists`,
      });
    }

    const envVar: EnvironmentVariable = {
      id: crypto.randomUUID(),
      project_id: id,
      key: trimmedKey,
      value: value,
      is_secret: is_secret,
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Save to database (falls back to in-memory if DB not available)
    await dbAddProjectEnvVar(envVar);

    // Log audit entry
    logAuditEntry(request, 'create', 'env_var', envVar.id, trimmedKey, { project_id: id, is_secret });

    return reply.status(201).send({
      env_var: {
        ...envVar,
        value: is_secret ? '********' : value,
      },
    });
  });

  // Update environment variable
  app.put<{ Params: { id: string; varId: string }; Body: { value?: string; is_secret?: boolean } }>('/api/v1/projects/:id/env/:varId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id, varId } = request.params;
    const { value, is_secret } = request.body;
    const user = request.user as JwtPayload;

    // Only admin or owner can modify env vars
    if (user.role !== 'admin' && user.role !== 'owner') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only administrators can manage environment variables',
      });
    }

    const project = await dbGetProject(id);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Check organization membership
    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    const envVars = await dbGetProjectEnvVars(id);
    const varIndex = envVars.findIndex(v => v.id === varId);

    if (varIndex === -1) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Environment variable not found',
      });
    }

    // Get the env var (guaranteed to exist after findIndex check)
    const envVar = envVars[varIndex]!;

    // Update fields
    if (value !== undefined) {
      envVar.value = value;
    }
    if (is_secret !== undefined) {
      envVar.is_secret = is_secret;
    }
    envVar.updated_at = new Date();

    // Save updated env var to database
    await dbAddProjectEnvVar(envVar);

    // Log audit entry
    logAuditEntry(request, 'update', 'env_var', varId, envVar.key, { project_id: id });

    return {
      env_var: {
        ...envVar,
        value: envVar.is_secret ? '********' : envVar.value,
      },
    };
  });

  // Delete environment variable
  app.delete<{ Params: { id: string; varId: string } }>('/api/v1/projects/:id/env/:varId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { id, varId } = request.params;
    const user = request.user as JwtPayload;

    // Only admin or owner can modify env vars
    if (user.role !== 'admin' && user.role !== 'owner') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only administrators can manage environment variables',
      });
    }

    const project = await dbGetProject(id);
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    // Check organization membership
    if (project.organization_id !== user.organization_id) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    const envVars = await dbGetProjectEnvVars(id);
    const envVar = envVars.find(v => v.id === varId);

    if (!envVar) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Environment variable not found',
      });
    }

    // Delete from database (falls back to in-memory if DB not available)
    await dbDeleteProjectEnvVar(id, varId);

    // Log audit entry
    logAuditEntry(request, 'delete', 'env_var', varId, envVar.key, { project_id: id });

    return { message: 'Environment variable deleted successfully' };
  });

  // Feature #1975: Quick Smoke Test - One-click smoke test from project dashboard
  app.post<{ Params: ProjectParams; Body: { target_url: string } }>('/api/v1/projects/:id/quick-smoke-test', {
    preHandler: [authenticate, requireScopes(['execute'])],
  }, async (request, reply) => {
    const { id } = request.params;
    const { target_url } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Verify project exists and user has access
    const project = await dbGetProject(id);
    if (!project || project.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found',
      });
    }

    if (!hasProjectAccess(id, user.id, user.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You do not have access to this project',
      });
    }

    const url = target_url || project.base_url;
    if (!url) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No target URL provided and no base URL configured for the project',
      });
    }

    // Find or create a "Quick Smoke Tests" suite for this project
    const projectSuites = await dbListTestSuitesByProject(id, orgId);
    let smokeSuite = projectSuites.find(s => s.name === 'Quick Smoke Tests');

    if (!smokeSuite) {
      const suiteId = crypto.randomUUID();
      const suiteData = {
        id: suiteId,
        project_id: id,
        organization_id: orgId,
        name: 'Quick Smoke Tests',
        description: 'Auto-generated suite for quick smoke tests',
        browser: 'chromium' as const,
        viewport_width: 1280,
        viewport_height: 720,
        timeout: 30000,
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      } as unknown as TestSuite;
      smokeSuite = await dbCreateTestSuiteAsync(suiteData);
      testSuites.set(suiteId, smokeSuite); // Also populate in-memory Map
    }

    // Create the smoke test
    const testId = crypto.randomUUID();
    const hostname = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return url;
      }
    })();

    const smokeTestData = {
      id: testId,
      suite_id: smokeSuite.id,
      organization_id: orgId,
      name: `Smoke Test - ${hostname}`,
      description: `Quick health check for ${url} - verifies page loads, no critical issues`,
      type: 'e2e',
      status: 'active',
      target_url: url,
      steps: [
        { id: '1', action: 'navigate', value: url, order: 1 },
        { id: '2', action: 'wait', value: '1000', order: 2 },
        { id: '3', action: 'screenshot', value: 'smoke_test_page', order: 3 },
        { id: '4', action: 'assert_no_console_errors', value: 'critical', order: 4 },
      ],
      created_at: new Date(),
      updated_at: new Date(),
    } as unknown as Test;
    const smokeTest = await dbCreateTestAsync(smokeTestData);
    tests.set(testId, smokeTest); // Also populate in-memory Map

    // Create and start the test run
    const runId = crypto.randomUUID();
    const testRunData = {
      id: runId,
      suite_id: smokeSuite.id,
      test_id: testId,
      organization_id: orgId,
      browser: 'chromium' as BrowserType,
      branch: 'main',
      status: 'pending',
      created_at: new Date(),
      started_at: null as Date | null,
      completed_at: null as Date | null,
      duration_ms: null as number | null,
      results: [] as any[],
      error: null as string | null,
    };
    // Persist to DB and populate in-memory Map (execution engine reads from Map)
    await dbCreateTestRunAsync(testRunData as any);
    testRuns.set(runId, testRunData as any);

    // Import and run tests (this will start executing in the background)
    // We need to dynamically import to avoid circular dependency
    // Note: test-runs.ts is the main file, test-runs/ is the folder with modules
    try {
      const testRunsModule = await import('../test-runs.js');
      if (typeof testRunsModule.runTestsForRun === 'function') {
        testRunsModule.runTestsForRun(runId).catch(console.error);
      } else {
        console.error('[Quick Smoke Test] runTestsForRun not found in test-runs module');
      }
    } catch (err) {
      console.error('[Quick Smoke Test] Failed to start test execution:', err);
    }

    // Log audit entry
    logAuditEntry(request, 'create', 'quick_smoke_test', testId, `Quick smoke test for ${hostname}`, {
      project_id: id,
      run_id: runId,
      target_url: url,
    });

    return {
      run_id: runId,
      test_id: testId,
      suite_id: smokeSuite.id,
      message: 'Smoke test started',
    };
  });
}
