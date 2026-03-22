/**
 * Flaky Tests - Mutation Routes (POST endpoints)
 *
 * Write endpoints for flaky test quarantine management:
 * - POST /api/v1/tests/:testId/quarantine (quarantine a flaky test)
 * - POST /api/v1/tests/:testId/unquarantine (remove test from quarantine)
 * - POST /api/v1/ai-insights/check-auto-quarantine (auto-quarantine check)
 *
 * Feature #1356: Code quality - extracted from flaky-tests.ts
 */

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload, getOrganizationId } from '../../../middleware/auth.js';
import { getAutoQuarantineSettings } from '../../organizations.js';
import { getTest, batchGetTests } from '../../test-suites/stores.js';
import { listTestRunsByOrg } from '../../../services/repositories/test-runs.js';
// Feature #145: Cache invalidation for quarantine mutations
import { getCache } from '../../../services/cache.js';
import { CacheKeys } from '../../../services/cache-keys.js';
import { sendError } from '../../../utils/errors.js';
import { getThirtyDaysAgo } from './helpers.js';

export async function flakyMutationRoutes(app: FastifyInstance): Promise<void> {
  // Feature #1103: Quarantine a flaky test
  // Marks a test as quarantined so it runs but doesn't block CI
  app.post<{
    Params: { testId: string };
    Body: { reason?: string };
  }>('/api/v1/tests/:testId/quarantine', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const { reason } = request.body || {};
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Find the test (async DB call)
    const test = await getTest(testId);
    if (!test) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
    }

    if (test.organization_id !== orgId) {
      return sendError(reply, 403, 'FORBIDDEN', 'Access denied');
    }

    // Already quarantined?
    if (test.quarantined) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Test is already quarantined', { quarantined_at: (test as { quarantined_at?: Date }).quarantined_at, quarantine_reason: (test as { quarantine_reason?: string }).quarantine_reason });
    }

    // Quarantine the test
    const now = new Date();
    (test as { quarantined?: boolean }).quarantined = true;
    (test as { quarantine_reason?: string }).quarantine_reason = reason || 'Flaky test - investigating';
    (test as { quarantined_at?: Date }).quarantined_at = now;
    (test as { quarantined_by?: string }).quarantined_by = user.id;
    test.updated_at = now;

    // Feature #145: Invalidate caches after quarantine
    await Promise.all([
      getCache().delete(CacheKeys.tests.detail(testId)),
      getCache().delete(CacheKeys.flakyTests.list(orgId)),
      getCache().delete(CacheKeys.flakyTests.quarantine(testId)),
    ]);

    return {
      message: 'Test quarantined successfully',
      test_id: testId,
      test_name: test.name,
      quarantined: true,
      quarantine_reason: (test as { quarantine_reason?: string }).quarantine_reason,
      quarantined_at: now.toISOString(),
      quarantined_by: user.id,
      note: 'Test will still run but failures will not block CI pipelines',
    };
  });

  // Feature #1103: Unquarantine a test
  app.post<{
    Params: { testId: string };
  }>('/api/v1/tests/:testId/unquarantine', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const orgId = getOrganizationId(request);

    // Find the test (async DB call)
    const test = await getTest(testId);
    if (!test) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
    }

    if (test.organization_id !== orgId) {
      return sendError(reply, 403, 'FORBIDDEN', 'Access denied');
    }

    // Not quarantined?
    if (!test.quarantined) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Test is not quarantined');
    }

    // Unquarantine the test
    const now = new Date();
    (test as { quarantined?: boolean }).quarantined = false;
    (test as { quarantine_reason?: string }).quarantine_reason = undefined;
    (test as { quarantined_at?: Date }).quarantined_at = undefined;
    (test as { quarantined_by?: string }).quarantined_by = undefined;
    test.updated_at = now;

    // Feature #145: Invalidate caches after unquarantine
    await Promise.all([
      getCache().delete(CacheKeys.tests.detail(testId)),
      getCache().delete(CacheKeys.flakyTests.list(orgId)),
      getCache().delete(CacheKeys.flakyTests.quarantine(testId)),
    ]);

    return {
      message: 'Test removed from quarantine',
      test_id: testId,
      test_name: test.name,
      quarantined: false,
    };
  });

  // Feature #1104: Check and auto-quarantine flaky tests based on threshold
  app.post('/api/v1/ai-insights/check-auto-quarantine', {
    preHandler: [authenticate],
  }, async (request) => {
    const orgId = getOrganizationId(request);
    const user = request.user as JwtPayload;
    const settings = await getAutoQuarantineSettings(orgId);

    // If auto-quarantine is disabled, return early
    if (!settings.enabled) {
      return {
        message: 'Auto-quarantine is disabled for this organization',
        auto_quarantine_enabled: false,
        tests_quarantined: 0,
        settings,
      };
    }

    // Feature #142: Get recent test runs (last 30 days) for flakiness calculation
    // Feature #198: includeResults needed because auto-quarantine iterates over individual test results
    const allOrgRuns = await listTestRunsByOrg(orgId, { since: getThirtyDaysAgo(), limit: 1000, includeResults: true });
    const orgRuns = allOrgRuns.filter(r => r.results);

    // Feature #139: Batch load all tests BEFORE the loop
    // Eliminates N+1 query pattern in auto-quarantine check
    const autoQuarantineTestIds = new Set<string>();
    for (const run of orgRuns) {
      if (!run.results) continue;
      for (const result of run.results) {
        if (result.test_id) autoQuarantineTestIds.add(result.test_id);
      }
    }
    const autoQuarantineTestsMap = await batchGetTests([...autoQuarantineTestIds]);

    // Track pass/fail count per test
    const testStats: Map<string, {
      test_id: string;
      test_name: string;
      suite_id: string;
      pass_count: number;
      fail_count: number;
      total_runs: number;
      flakiness_score: number;
    }> = new Map();

    // Analyze each run's results (now using Map lookup)
    for (const run of orgRuns) {
      if (!run.results) continue;

      for (const result of run.results) {
        const testId = result.test_id;
        const test = autoQuarantineTestsMap.get(testId);
        if (!test) continue;

        const existingStats = testStats.get(testId) || {
          test_id: testId,
          test_name: result.test_name,
          suite_id: test.suite_id,
          pass_count: 0,
          fail_count: 0,
          total_runs: 0,
          flakiness_score: 0,
        };

        existingStats.total_runs++;

        if (result.status === 'passed') {
          existingStats.pass_count++;
        } else if (result.status === 'failed' || result.status === 'error') {
          existingStats.fail_count++;
        }

        testStats.set(testId, existingStats);
      }
    }

    // Calculate flakiness scores and find tests that need quarantining
    const testsToQuarantine: Array<{
      test_id: string;
      test_name: string;
      flakiness_score: number;
      reason: string;
    }> = [];

    for (const stats of testStats.values()) {
      // Need minimum runs before auto-quarantine
      if (stats.total_runs < settings.min_runs) continue;

      // Calculate flakiness score
      const passRate = stats.pass_count / stats.total_runs;
      // Flakiness: 0 = always passes or always fails, 1 = 50/50 (most flaky)
      const flakiness_score = Math.min(passRate, 1 - passRate) * 2;
      stats.flakiness_score = flakiness_score;

      // Check if exceeds threshold
      // Feature #139: Use pre-loaded test map instead of individual query
      if (flakiness_score >= settings.threshold) {
        const test = autoQuarantineTestsMap.get(stats.test_id);
        if (!test || test.quarantined) continue; // Skip if already quarantined

        testsToQuarantine.push({
          test_id: stats.test_id,
          test_name: stats.test_name,
          flakiness_score,
          reason: `${settings.quarantine_reason_prefix}Flakiness score ${(flakiness_score * 100).toFixed(0)}% exceeds threshold ${(settings.threshold * 100).toFixed(0)}%`,
        });
      }
    }

    // Quarantine the identified tests
    const now = new Date();
    const quarantinedTests: Array<{
      test_id: string;
      test_name: string;
      flakiness_score: number;
      quarantined_at: string;
    }> = [];

    for (const toQuarantine of testsToQuarantine) {
      // Feature #139: Use pre-loaded test map instead of individual query
      const test = autoQuarantineTestsMap.get(toQuarantine.test_id);
      if (!test) continue;

      // Apply quarantine
      (test as { quarantined?: boolean }).quarantined = true;
      (test as { quarantine_reason?: string }).quarantine_reason = toQuarantine.reason;
      (test as { quarantined_at?: Date }).quarantined_at = now;
      (test as { quarantined_by?: string }).quarantined_by = 'system:auto-quarantine';
      test.updated_at = now;

      quarantinedTests.push({
        test_id: toQuarantine.test_id,
        test_name: toQuarantine.test_name,
        flakiness_score: toQuarantine.flakiness_score,
        quarantined_at: now.toISOString(),
      });
    }

    return {
      message: quarantinedTests.length > 0
        ? `Auto-quarantined ${quarantinedTests.length} test(s) exceeding flakiness threshold`
        : 'No tests exceeded the auto-quarantine threshold',
      auto_quarantine_enabled: true,
      threshold: settings.threshold,
      threshold_percentage: `${(settings.threshold * 100).toFixed(0)}%`,
      min_runs: settings.min_runs,
      tests_evaluated: testStats.size,
      tests_quarantined: quarantinedTests.length,
      quarantined_tests: quarantinedTests,
      notify: settings.notify_on_quarantine && quarantinedTests.length > 0,
    };
  });
}
