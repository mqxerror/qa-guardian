/**
 * Test Suites Module - Suite CRUD Routes
 * Feature #730: Split test-suites/routes.ts into sub-modules
 *
 * Handles test suite list, get, create, update, delete operations
 * and test listing within suites (including run metadata enrichment).
 */

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload, getOrganizationId } from '../../middleware/auth.js';
import {
  validateParams,
  validateQuery,
  suiteProjectParamsSchema,
  suiteParamsSchema,
  listPaginationQuerySchema,
} from '../../validation/index.js';
import { logAuditEntry } from '../audit-logs.js';
import { getCache, CacheKeys, CacheTTL } from '../../services/cache.js';
import { emitSuiteCreated, emitSuiteUpdated, emitSuiteDeleted } from '../../services/websocket-events.js';
import {
  TestSuite,
  Test,
  ProjectParams,
  SuiteParams,
  CreateSuiteBody,
  UpdateSuiteBody,
} from './types.js';
import {
  listTestSuitesPaginated as dbListTestSuitesPaginated,
  getTestSuite as dbGetTestSuite,
  createTestSuite as dbCreateTestSuite,
  updateTestSuite as dbUpdateTestSuite,
  deleteTestSuite as dbDeleteTestSuite,
  listTestsPaginated as dbListTestsPaginated,
} from './stores.js';
import { getTestRunMetadataForSuite } from '../../services/repositories/test-runs.js';
import { sendError } from '../../utils/errors.js';

export async function suiteCrudRoutes(app: FastifyInstance) {
  // List test suites for a project
  // Feature #2081: Use async database functions for persistence
  // Feature #55: Add server-side pagination
  // Feature #61: Cached for 5 minutes
  // Feature #99: Database-level pagination - no longer loads ALL suites into memory
  // Feature #714: Zod validation for params and query
  app.get<{ Params: ProjectParams; Querystring: { page?: number; limit?: number } }>('/api/v1/projects/:projectId/suites', {
    preHandler: [authenticate],
    preValidation: [validateParams(suiteProjectParamsSchema), validateQuery(listPaginationQuerySchema)],
  }, async (request, _reply) => {
    const { projectId } = request.params;
    const { page = 1, limit = 20 } = request.query;
    const orgId = getOrganizationId(request);
    const cache = getCache();

    // Validate and clamp pagination params
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Feature #99: Cache key now includes page/limit for proper cache scoping
    const cacheKey = `${CacheKeys.suites.list(projectId)}:page=${pageNum}:limit=${limitNum}`;
    const cachedResult = await cache.get<{ data: TestSuite[]; total: number }>(cacheKey);

    let suites: TestSuite[];
    let total: number;

    if (cachedResult) {
      // Cache hit - use cached paginated result
      suites = cachedResult.data;
      total = cachedResult.total;
    } else {
      // Cache miss - fetch from database with LIMIT/OFFSET
      const result = await dbListTestSuitesPaginated(projectId, orgId, limitNum, offset);
      suites = result.data;
      total = result.total;
      // Cache the paginated result
      await cache.set(cacheKey, { data: suites, total }, CacheTTL.MEDIUM);
    }

    // Feature #55: Return paginated response
    const totalPages = Math.ceil(total / limitNum);
    return {
      data: suites,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
      // Backwards compatibility
      suites,
    };
  });

  // Get single test suite
  // Feature #2081: Use async database functions for persistence
  // Feature #61: Cached for 5 minutes
  // Feature #714: Zod validation for params
  app.get<{ Params: SuiteParams }>('/api/v1/suites/:suiteId', {
    preHandler: [authenticate],
    preValidation: [validateParams(suiteParamsSchema)],
  }, async (request, reply) => {
    const { suiteId } = request.params;
    const orgId = getOrganizationId(request);
    const cache = getCache();

    // Feature #61: Try to get from cache first
    const cacheKey = CacheKeys.suites.detail(suiteId);
    let suite: TestSuite | null | undefined = await cache.get<TestSuite>(cacheKey);

    if (!suite) {
      // Cache miss - fetch from database
      suite = await dbGetTestSuite(suiteId) ?? null;
      if (suite) {
        // Cache the suite
        await cache.set(cacheKey, suite, CacheTTL.MEDIUM);
      }
    }

    if (!suite || suite.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test suite not found');
    }

    return { suite };
  });

  // Create test suite
  // Feature #862: MCP tool create-test-suite support
  // Feature #714: Zod validation for params
  app.post<{ Params: ProjectParams; Body: CreateSuiteBody }>('/api/v1/projects/:projectId/suites', {
    preHandler: [authenticate],
    preValidation: [validateParams(suiteProjectParamsSchema)],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const {
      name,
      description,
      type,
      base_url,
      browser,
      browsers,
      viewport_width,
      viewport_height,
      timeout,
      retry_count,
      retries  // MCP alias for retry_count
    } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot create test suites
    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot create test suites');
    }

    if (!name) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Test suite name is required');
    }

    const id = crypto.randomUUID();

    // Determine default browser: use browsers array first element if provided, or browser, or default to chromium
    const defaultBrowser = browsers?.[0] as 'chromium' | 'firefox' | 'webkit' || browser || 'chromium';

    const suite: TestSuite = {
      id,
      project_id: projectId,
      organization_id: orgId,
      name,
      description,
      type: type || 'e2e', // Default to e2e if not specified
      base_url,
      browser: defaultBrowser,
      browsers: browsers || (browser ? [browser] : ['chromium']),
      viewport_width: viewport_width || 1280,
      viewport_height: viewport_height || 720,
      timeout: timeout ?? 30, // Default 30 seconds
      retry_count: retries ?? retry_count ?? 0, // Support both retries (MCP) and retry_count
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Feature #2081: Use async database function for persistence
    const savedSuite = await dbCreateTestSuite(suite);

    // Feature #61: Invalidate all paginated suites list cache entries for this project
    await getCache().invalidate(`${CacheKeys.suites.list(projectId)}*`);

    // Log audit entry
    logAuditEntry(request, 'create', 'test_suite', id, savedSuite.name, { projectId, type, base_url, browser: defaultBrowser, browsers, viewport_width, viewport_height });

    // Feature #108: Emit WebSocket event for real-time cache invalidation
    emitSuiteCreated(orgId, id, projectId);

    return reply.status(201).send({ suite: savedSuite });
  });

  // Feature #1688: Update test suite
  // MCP tool: update_test_suite
  // Feature #2081: Use async database functions for persistence
  // Feature #714: Zod validation for params
  app.patch<{ Params: SuiteParams; Body: UpdateSuiteBody }>('/api/v1/suites/:suiteId', {
    preHandler: [authenticate],
    preValidation: [validateParams(suiteParamsSchema)],
  }, async (request, reply) => {
    const { suiteId } = request.params;
    const updates = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot update test suites
    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot update test suites');
    }

    // Use async database function
    const existingSuite = await dbGetTestSuite(suiteId);
    if (!existingSuite || existingSuite.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test suite not found');
    }

    // Build updates object for database
    const suiteUpdates: Partial<TestSuite> = {};
    if (updates.name !== undefined) suiteUpdates.name = updates.name;
    if (updates.description !== undefined) suiteUpdates.description = updates.description;
    if (updates.type !== undefined) suiteUpdates.type = updates.type;
    if (updates.base_url !== undefined) suiteUpdates.base_url = updates.base_url;
    if (updates.browser !== undefined) suiteUpdates.browser = updates.browser;
    if (updates.browsers !== undefined) suiteUpdates.browsers = updates.browsers;
    if (updates.viewport_width !== undefined) suiteUpdates.viewport_width = updates.viewport_width;
    if (updates.viewport_height !== undefined) suiteUpdates.viewport_height = updates.viewport_height;
    if (updates.timeout !== undefined) suiteUpdates.timeout = updates.timeout;
    // Support both retry_count and retries (MCP compatibility)
    if (updates.retry_count !== undefined) suiteUpdates.retry_count = updates.retry_count;
    if (updates.retries !== undefined) suiteUpdates.retry_count = updates.retries;
    if (updates.require_human_review !== undefined) suiteUpdates.require_human_review = updates.require_human_review;

    // Use async database function
    const updatedSuite = await dbUpdateTestSuite(suiteId, suiteUpdates);

    // Feature #61: Invalidate suite cache (pattern match for paginated keys)
    const cache = getCache();
    await cache.delete(CacheKeys.suites.detail(suiteId));
    await cache.invalidate(`${CacheKeys.suites.list(existingSuite.project_id)}*`);

    // Log audit entry
    logAuditEntry(request, 'update', 'test_suite', suiteId, updatedSuite?.name || existingSuite.name, { updates: Object.keys(updates) });

    // Feature #108: Emit WebSocket event for real-time cache invalidation
    emitSuiteUpdated(existingSuite.organization_id, suiteId, existingSuite.project_id);

    return { suite: updatedSuite || existingSuite };
  });

  // Delete test suite
  // Feature #2081: Use async database functions for persistence
  // Feature #714: Zod validation for params
  app.delete<{ Params: SuiteParams }>('/api/v1/suites/:suiteId', {
    preHandler: [authenticate],
    preValidation: [validateParams(suiteParamsSchema)],
  }, async (request, reply) => {
    const { suiteId } = request.params;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Only admin or owner can delete suites
    if (user.role !== 'admin' && user.role !== 'owner') {
      return sendError(reply, 403, 'FORBIDDEN', 'Only administrators can delete test suites');
    }

    // Use async database function
    const suite = await dbGetTestSuite(suiteId);
    if (!suite || suite.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test suite not found');
    }

    const suiteName = suite.name;
    const projectId = suite.project_id;

    // Use async database function - it will cascade delete tests
    await dbDeleteTestSuite(suiteId);

    // Feature #61: Invalidate suite cache (pattern match for paginated keys)
    const cache = getCache();
    await cache.delete(CacheKeys.suites.detail(suiteId));
    await cache.invalidate(`${CacheKeys.suites.list(projectId)}*`);
    // Also invalidate tests list for this suite since they're deleted
    await cache.delete(CacheKeys.tests.list(suiteId));

    // Log audit entry
    logAuditEntry(request, 'delete', 'test_suite', suiteId, suiteName);

    // Feature #108: Emit WebSocket event for real-time cache invalidation
    emitSuiteDeleted(suite.organization_id, suiteId, projectId);

    return { message: 'Test suite deleted successfully' };
  });

  // List tests in a suite
  // Feature #1958: Include run metadata (last_run, last_result, run_count, avg_duration)
  // Feature #2081: Use async database functions for persistence
  // Feature #54: Add server-side pagination
  // Feature #61: Cached for 5 minutes (tests list)
  // Feature #99: Database-level pagination - no longer loads ALL tests into memory
  // Feature #714: Zod validation for params and query
  app.get<{ Params: SuiteParams; Querystring: { page?: number; limit?: number } }>('/api/v1/suites/:suiteId/tests', {
    preHandler: [authenticate],
    preValidation: [validateParams(suiteParamsSchema), validateQuery(listPaginationQuerySchema)],
  }, async (request, reply) => {
    const { suiteId } = request.params;
    const { page = 1, limit = 50 } = request.query;
    const orgId = getOrganizationId(request);
    const cache = getCache();

    // Validate and clamp pagination params
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    // Feature #61: Try to get suite from cache first
    const suiteCacheKey = CacheKeys.suites.detail(suiteId);
    let suite: TestSuite | null | undefined = await cache.get<TestSuite>(suiteCacheKey);
    if (!suite) {
      suite = await dbGetTestSuite(suiteId) ?? null;
      if (suite) {
        await cache.set(suiteCacheKey, suite, CacheTTL.MEDIUM);
      }
    }

    if (!suite || suite.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test suite not found');
    }

    // Feature #99: Cache key now includes page/limit for proper cache scoping
    const testsCacheKey = `${CacheKeys.tests.list(suiteId)}:page=${pageNum}:limit=${limitNum}`;
    const cachedResult = await cache.get<{ data: Test[]; total: number }>(testsCacheKey);

    let testList: Test[];
    let total: number;

    if (cachedResult) {
      // Cache hit - use cached paginated result
      testList = cachedResult.data;
      total = cachedResult.total;
    } else {
      // Cache miss - fetch from database with LIMIT/OFFSET
      const result = await dbListTestsPaginated(suiteId, limitNum, offset);
      testList = result.data;
      total = result.total;
      // Cache the paginated result
      await cache.set(testsCacheKey, { data: testList, total }, CacheTTL.MEDIUM);
    }

    // Feature #1958: Compute run metadata for each test
    // Feature #87: Use optimized aggregated query instead of loading ALL runs into memory
    // This prevents memory overflow and timeouts on suites with many runs
    const testIds = testList.map(t => t.id);
    const runMetadataMap = await getTestRunMetadataForSuite(suiteId, testIds, orgId);

    const testsWithRunMetadata = testList.map(test => {
      const metadata = runMetadataMap.get(test.id);
      return {
        ...test,
        // Run metadata from optimized aggregated query
        run_count: metadata?.run_count || 0,
        last_run_at: metadata?.last_run_at || null,
        last_result: metadata?.last_result || null,
        avg_duration_ms: metadata?.avg_duration_ms || null,
      };
    });

    // Feature #54: Return paginated response
    const totalPages = Math.ceil(total / limitNum);
    return {
      data: testsWithRunMetadata,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
      // Backwards compatibility
      tests: testsWithRunMetadata,
    };
  });
}
