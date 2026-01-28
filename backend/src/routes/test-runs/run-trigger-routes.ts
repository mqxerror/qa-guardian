/**
 * Run Trigger Routes Module (Feature #1356 - Code Quality)
 * Extracted from test-runs.ts to reduce file size
 *
 * Contains: POST routes to trigger test runs for suites and individual tests
 *
 * Routes:
 * - POST /api/v1/suites/:suiteId/runs - Trigger test run for a suite
 * - POST /api/v1/tests/:testId/runs - Trigger test run for a single test
 */

import { FastifyInstance } from 'fastify';
import { authenticate, requireScopes, getOrganizationId } from '../../middleware/auth';
import { getTestSuite, getTest, listTests } from '../test-suites';
import { testRuns, BrowserType } from './execution';

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

// Type for TestRun - simplified version for route handlers
interface TestRun {
  id: string;
  suite_id: string;
  test_id?: string;
  organization_id: string;
  browser: BrowserType;
  branch: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled' | 'cancelling' | 'paused';
  created_at: Date;
}

// Import runTestsForRun from parent module (will be passed as dependency)
type RunTestsForRunFn = (runId: string) => Promise<void>;

/**
 * Create run trigger routes factory
 * @param runTestsForRun Function to execute tests for a run (injected dependency)
 */
export function createRunTriggerRoutes(runTestsForRun: RunTestsForRunFn) {
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

      testRuns.set(id, run as any);

      // Start test execution asynchronously
      runTestsForRun(id).catch(console.error);

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
        message: 'Test run started successfully',
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

      testRuns.set(id, run as any);

      // Start test execution asynchronously
      runTestsForRun(id).catch(console.error);

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
        message: 'Test run started successfully',
      });
    });
  };
}
