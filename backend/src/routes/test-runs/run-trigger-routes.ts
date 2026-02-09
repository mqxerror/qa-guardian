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
import { testRuns, BrowserType, TestRun, TestType, createTestRun as dbCreateTestRun } from './execution.js';
// Feature #61: Redis caching
import { getCache, CacheKeys } from '../../services/cache.js';
// Feature #155: Execution queue for concurrency limits
import { enqueueOrExecute } from '../../services/execution-queue.js';
import { createLogger } from '../../services/logger.js';

const logger = createLogger('route:test-runs:run-trigger');

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

// Extended TestRun for rerun with test_ids
interface RerunTestRun extends TestRun {
  test_ids?: string[];
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
    app.post<{ Params: RunParams; Body: RunBody }>('/api/v1/suites/:suiteId/runs', {
      preHandler: [authenticate, requireScopes(['execute'])],
    }, async (request, reply) => {
      const { suiteId } = request.params;
      const { browser: requestBrowser, branch: requestBranch } = request.body || {};
      const orgId = getOrganizationId(request);

      // Verify suite exists
      const suite = await getTestSuite(suiteId);
      if (!suite || suite.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Test suite not found',
        });
      }

      // Check if there are tests in the suite
      const suiteTests = await listTests(suiteId);
      if (suiteTests.length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'No tests found in this suite',
        });
      }

      // Use request browser, suite browser, or default to chromium
      const browserToUse: BrowserType = requestBrowser || suite.browser || 'chromium';
      // Use request branch or default to 'main'
      const branchToUse: string = requestBranch || 'main';

      const id = crypto.randomUUID();
      const run: TestRun = {
        id,
        suite_id: suiteId,
        organization_id: orgId,
        browser: browserToUse,
        branch: branchToUse,
        status: 'pending',
        created_at: new Date(),
      };

      testRuns.set(id, run);

      // Persist to database so the run appears in history and survives server restarts
      dbCreateTestRun(run).catch(err =>
        logger.error('[RunTrigger] Failed to persist test run to database:', err)
      );

      // Feature #61: Invalidate runs cache for this suite
      const cache = getCache();
      await cache.delete(CacheKeys.runs.bySuite(suiteId));

      // Feature #155: Queue test execution with concurrency limits
      // enqueueOrExecute will queue the job if queue is available, otherwise execute directly
      const queueResult = await enqueueOrExecute(id, 'e2e', {
        triggeredBy: getUserId(request),
      });

      // Update status to 'queued' if the run was queued (not executed directly)
      if (queueResult.queued) {
        run.status = 'pending'; // pending = waiting in queue
        testRuns.set(id, run);
        logger.info(`[RunTrigger] Run ${id} queued at position ${queueResult.position || 'unknown'}`);
      }

      return reply.status(201).send({
        run: {
          id: run.id,
          suite_id: run.suite_id,
          organization_id: run.organization_id,
          browser: run.browser,
          branch: run.branch,
          status: run.status,
          created_at: run.created_at.toISOString(),
        },
        queued: queueResult.queued,
        queuePosition: queueResult.position,
        message: queueResult.queued
          ? `Test run queued${queueResult.position ? ` at position ${queueResult.position}` : ''}`
          : 'Test run started successfully',
      });
    });

    // Trigger test run for a single test
    app.post<{ Params: TestIdParams; Body: RunBody }>('/api/v1/tests/:testId/runs', {
      preHandler: [authenticate, requireScopes(['execute'])],
    }, async (request, reply) => {
      const { testId } = request.params;
      const { browser: requestBrowser, branch: requestBranch } = request.body || {};
      const orgId = getOrganizationId(request);

      // Verify test exists
      const test = await getTest(testId);
      if (!test || test.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Test not found',
        });
      }

      // Get suite to determine default browser
      const suite = await getTestSuite(test.suite_id);
      const browserToUse: BrowserType = requestBrowser || suite?.browser || 'chromium';
      // Use request branch or default to 'main'
      const branchToUse: string = requestBranch || 'main';

      const id = crypto.randomUUID();
      const run: TestRun = {
        id,
        suite_id: test.suite_id,
        test_id: testId,
        organization_id: orgId,
        browser: browserToUse,
        branch: branchToUse,
        status: 'pending',
        created_at: new Date(),
      };

      testRuns.set(id, run);

      // Persist to database so the run appears in history and survives server restarts
      dbCreateTestRun(run).catch(err =>
        logger.error('[RunTrigger] Failed to persist test run to database:', err)
      );

      // Feature #61: Invalidate runs cache for this test and suite
      const cache = getCache();
      await cache.delete(CacheKeys.runs.byTest(testId));
      await cache.delete(CacheKeys.runs.bySuite(test.suite_id));

      // Feature #155: Queue test execution with concurrency limits
      // Determine test type for queue prioritization
      const testType: TestType = (test.test_type as TestType) || 'e2e';
      const queueResult = await enqueueOrExecute(id, testType, {
        triggeredBy: getUserId(request),
      });

      // Update status if queued
      if (queueResult.queued) {
        run.status = 'pending';
        testRuns.set(id, run);
        logger.info(`[RunTrigger] Run ${id} queued at position ${queueResult.position || 'unknown'}`);
      }

      return reply.status(201).send({
        run: {
          id: run.id,
          suite_id: run.suite_id,
          test_id: run.test_id,
          organization_id: run.organization_id,
          browser: run.browser,
          branch: run.branch,
          status: run.status,
          created_at: run.created_at.toISOString(),
        },
        queued: queueResult.queued,
        queuePosition: queueResult.position,
        message: queueResult.queued
          ? `Test run queued${queueResult.position ? ` at position ${queueResult.position}` : ''}`
          : 'Test run started successfully',
      });
    });

    // Rerun specific tests (e.g. failed tests from a previous run)
    app.post<{ Body: RerunBody }>('/api/v1/runs/rerun', {
      preHandler: [authenticate, requireScopes(['execute'])],
    }, async (request, reply) => {
      const { suite_id, test_ids, browser: requestBrowser, branch: requestBranch } = request.body || {};
      const orgId = getOrganizationId(request);

      if (!suite_id || !test_ids || !Array.isArray(test_ids) || test_ids.length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'suite_id and non-empty test_ids array are required',
        });
      }

      // Verify suite exists and belongs to org
      const suite = await getTestSuite(suite_id);
      if (!suite || suite.organization_id !== orgId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Test suite not found',
        });
      }

      // Verify at least some tests exist in the suite
      const suiteTests = await listTests(suite_id);
      const validTestIds = test_ids.filter(tid => suiteTests.some(t => t.id === tid));
      if (validTestIds.length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'None of the provided test_ids belong to the specified suite',
        });
      }

      const browserToUse: BrowserType = requestBrowser || suite.browser || 'chromium';
      const branchToUse: string = requestBranch || 'main';

      const id = crypto.randomUUID();
      // Use base TestRun interface and store test_ids separately for rerun logic
      const run: TestRun = {
        id,
        suite_id,
        organization_id: orgId,
        browser: browserToUse,
        branch: branchToUse,
        status: 'pending',
        created_at: new Date(),
      };
      // Store test_ids in the run for rerun handling (using type assertion for extended property)
      const rerunRun = run as RerunTestRun;
      rerunRun.test_ids = validTestIds;

      testRuns.set(id, rerunRun);

      // Persist to database
      dbCreateTestRun(rerunRun).catch(err =>
        logger.error('[RunTrigger] Failed to persist rerun to database:', err)
      );

      // Feature #61: Invalidate runs cache for the suite and all rerun tests
      const cache = getCache();
      await cache.delete(CacheKeys.runs.bySuite(suite_id));
      for (const tid of validTestIds) {
        await cache.delete(CacheKeys.runs.byTest(tid));
      }

      // Feature #155: Queue test execution with concurrency limits
      const queueResult = await enqueueOrExecute(id, 'e2e', {
        triggeredBy: getUserId(request),
      });

      if (queueResult.queued) {
        logger.info(`[RunTrigger] Rerun ${id} queued at position ${queueResult.position || 'unknown'}`);
      }

      return reply.status(201).send({
        run_id: id,
        run: {
          id,
          suite_id,
          organization_id: orgId,
          browser: browserToUse,
          branch: branchToUse,
          status: 'pending',
          created_at: run.created_at.toISOString(),
          test_ids: validTestIds,
        },
        queued: queueResult.queued,
        queuePosition: queueResult.position,
        message: queueResult.queued
          ? `Rerun queued for ${validTestIds.length} test(s)${queueResult.position ? ` at position ${queueResult.position}` : ''}`
          : `Rerun started for ${validTestIds.length} test(s)`,
      });
    });
  };
}
