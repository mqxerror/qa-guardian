/**
 * Run Trigger Routes Module (Feature #1356 - Code Quality)
 * Extracted from test-runs.ts to reduce file size
 *
 * Contains: POST routes to trigger test runs for suites and individual tests
 * Feature #61: Redis caching integration
 *
 * Routes:
 * - POST /api/v1/suites/:suiteId/runs - Trigger test run for a suite
 * - POST /api/v1/tests/:testId/runs - Trigger test run for a single test
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate, requireScopes, getOrganizationId, JwtPayload, ApiKeyPayload, InternalServicePayload } from '../../middleware/auth.js';
import { getTestSuite, getTest, listTests } from '../test-suites.js';
import { BrowserType } from './execution.js';
// Feature #Agent8: Use TestExecutionService for run creation orchestration
import { testExecutionService } from '../../services/test-execution-service.js';

import { sendError } from '../../utils/errors.js';
// Feature #732: Zod validation for run trigger routes
import {
  validateBody,
  validateParams,
  suiteRunParamsSchema,
  testRunTriggerParamsSchema,
  runTriggerBodySchema,
  rerunBodySchema,
} from '../../validation/index.js';

// Type definitions for route params/body
interface RunParams {
  suiteId: string;
}

interface TestIdParams {
  testId: string;
}

interface RunBody {
  browser?: BrowserType;
  branch?: string;
}

interface RerunBody {
  suite_id: string;
  test_ids: string[];
  browser?: BrowserType;
  branch?: string;
}

// Type-safe user accessor for authenticated requests
type AuthUser = JwtPayload | ApiKeyPayload | InternalServicePayload;
function getUserId(request: FastifyRequest): string | undefined {
  const user = (request as unknown as { user?: AuthUser }).user;
  return user?.id;
}

// Import runTestsForRun from parent module (will be passed as dependency)
type RunTestsForRunFn = (runId: string) => Promise<void>;

/**
 * Create run trigger routes factory
 * @param runTestsForRun Function to execute tests for a run (injected dependency) - reserved for parallel execution
 */
export function createRunTriggerRoutes(_runTestsForRun: RunTestsForRunFn) {
  return async function runTriggerRoutes(app: FastifyInstance) {
    // Trigger test run for a suite
    // Feature #732: Zod validation for suite run trigger
    // Feature #Agent8: Run creation delegated to TestExecutionService
    app.post<{ Params: RunParams; Body: RunBody }>('/api/v1/suites/:suiteId/runs', {
      preHandler: [authenticate, requireScopes(['execute'])],
      preValidation: [validateParams(suiteRunParamsSchema), validateBody(runTriggerBodySchema)],
    }, async (request, reply) => {
      const { suiteId } = request.params;
      const { browser: requestBrowser, branch: requestBranch } = request.body || {};
      const orgId = getOrganizationId(request);

      // Verify suite exists and belongs to this org
      const suite = await getTestSuite(suiteId);
      if (!suite || suite.organization_id !== orgId) {
        return sendError(reply, 404, 'NOT_FOUND', 'Test suite not found');
      }

      // Verify suite has tests
      const suiteTests = await listTests(suiteId);
      if (suiteTests.length === 0) {
        return sendError(reply, 400, 'BAD_REQUEST', 'No tests found in this suite');
      }

      const result = await testExecutionService.createRun({
        suiteId,
        orgId,
        browser: requestBrowser,
        branch: requestBranch,
        triggeredBy: getUserId(request),
      });

      if (result.error) {
        return sendError(reply, 503, 'SERVICE_UNAVAILABLE', result.error);
      }

      return reply.status(201).send({
        run: {
          id: result.run.id,
          suite_id: result.run.suite_id,
          organization_id: result.run.organization_id,
          browser: result.run.browser,
          branch: result.run.branch,
          status: result.run.status,
          created_at: result.run.created_at.toISOString(),
        },
        queued: result.queued,
        queuePosition: result.queuePosition,
        message: result.queued
          ? `Test run queued${result.queuePosition ? ` at position ${result.queuePosition}` : ''}`
          : 'Test run started successfully',
      });
    });

    // Trigger test run for a single test
    // Feature #732: Zod validation for test run trigger
    // Feature #Agent8: Run creation delegated to TestExecutionService
    app.post<{ Params: TestIdParams; Body: RunBody }>('/api/v1/tests/:testId/runs', {
      preHandler: [authenticate, requireScopes(['execute'])],
      preValidation: [validateParams(testRunTriggerParamsSchema), validateBody(runTriggerBodySchema)],
    }, async (request, reply) => {
      const { testId } = request.params;
      const { browser: requestBrowser, branch: requestBranch } = request.body || {};
      const orgId = getOrganizationId(request);

      // Verify test exists and belongs to this org
      const test = await getTest(testId);
      if (!test || test.organization_id !== orgId) {
        return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
      }

      const result = await testExecutionService.createRun({
        suiteId: test.suite_id,
        orgId,
        browser: requestBrowser,
        branch: requestBranch,
        testId,
        triggeredBy: getUserId(request),
      });

      if (result.error) {
        return sendError(reply, 503, 'SERVICE_UNAVAILABLE', result.error);
      }

      return reply.status(201).send({
        run: {
          id: result.run.id,
          suite_id: result.run.suite_id,
          test_id: result.run.test_id,
          organization_id: result.run.organization_id,
          browser: result.run.browser,
          branch: result.run.branch,
          status: result.run.status,
          created_at: result.run.created_at.toISOString(),
        },
        queued: result.queued,
        queuePosition: result.queuePosition,
        message: result.queued
          ? `Test run queued${result.queuePosition ? ` at position ${result.queuePosition}` : ''}`
          : 'Test run started successfully',
      });
    });

    // Rerun specific tests (e.g. failed tests from a previous run)
    // Feature #732: Zod validation for rerun body
    // Feature #Agent8: Run creation delegated to TestExecutionService
    app.post<{ Body: RerunBody }>('/api/v1/runs/rerun', {
      preHandler: [authenticate, requireScopes(['execute'])],
      preValidation: [validateBody(rerunBodySchema)],
    }, async (request, reply) => {
      const { suite_id, test_ids, browser: requestBrowser, branch: requestBranch } = request.body || {};
      const orgId = getOrganizationId(request);

      if (!suite_id || !test_ids || !Array.isArray(test_ids) || test_ids.length === 0) {
        return sendError(reply, 400, 'BAD_REQUEST', 'suite_id and non-empty test_ids array are required');
      }

      // Verify suite exists and belongs to org
      const suite = await getTestSuite(suite_id);
      if (!suite || suite.organization_id !== orgId) {
        return sendError(reply, 404, 'NOT_FOUND', 'Test suite not found');
      }

      // Verify at least some tests exist in the suite
      const suiteTests = await listTests(suite_id);
      const validTestIds = test_ids.filter(tid => suiteTests.some(t => t.id === tid));
      if (validTestIds.length === 0) {
        return sendError(reply, 400, 'BAD_REQUEST', 'None of the provided test_ids belong to the specified suite');
      }

      const result = await testExecutionService.createRun({
        suiteId: suite_id,
        orgId,
        browser: requestBrowser,
        branch: requestBranch,
        testIds: validTestIds,
        triggeredBy: getUserId(request),
      });

      if (result.error) {
        return sendError(reply, 503, 'SERVICE_UNAVAILABLE', result.error);
      }

      return reply.status(201).send({
        run_id: result.run.id,
        run: {
          id: result.run.id,
          suite_id,
          organization_id: orgId,
          browser: result.run.browser,
          branch: result.run.branch,
          status: result.run.status,
          created_at: result.run.created_at.toISOString(),
          test_ids: validTestIds,
        },
        queued: result.queued,
        queuePosition: result.queuePosition,
        message: result.queued
          ? `Rerun queued for ${validTestIds.length} test(s)${result.queuePosition ? ` at position ${result.queuePosition}` : ''}`
          : `Rerun started for ${validTestIds.length} test(s)`,
      });
    });
  };
}
