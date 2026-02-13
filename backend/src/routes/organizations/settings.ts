/**
 * Organizations Module - Settings Routes
 * Feature #730: Split organizations.ts into sub-modules
 * Feature #1104: Auto-Quarantine Settings
 * Feature #1105: Retry Strategy Settings
 *
 * Handles organization-level settings for auto-quarantine and retry strategies.
 */

import { FastifyInstance } from 'fastify';
import { authenticate, requireRoles, getOrganizationId } from '../../middleware/auth.js';
// Feature #713: Zod validation middleware
import {
  validateBody,
  validateParams,
  retryStrategyTestIdParamsSchema,
  autoQuarantineSettingsSchema,
  retryStrategySettingsSchema,
} from '../../validation/index.js';
import { sendError } from '../../utils/errors.js';
import {
  listAllTests as dbListAllTests,
  getTestSuite as dbGetTestSuiteAsync,
  getTest as dbGetTestAsync,
} from '../test-suites/stores.js';
import { getProject as dbGetProjectAsync } from '../projects/stores.js';
import {
  AutoQuarantineSettings,
  RetryStrategySettings,
  RetryStrategyRule,
} from '../../services/repositories/organizations.js';
import {
  getAutoQuarantineSettings,
  setAutoQuarantineSettings,
  getRetryStrategySettings,
  setRetryStrategySettings,
  getRetriesForFlakinessScore,
} from './helpers.js';

export async function settingsRoutes(app: FastifyInstance) {
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
  // Feature #713: Add Zod validation
  app.patch<{
    Body: Partial<AutoQuarantineSettings>;
  }>('/api/v1/organization/auto-quarantine-settings', {
    preValidation: [validateBody(autoQuarantineSettingsSchema)],
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
  // Feature #713: Add Zod validation
  app.patch<{
    Body: Partial<RetryStrategySettings>;
  }>('/api/v1/organization/retry-strategy-settings', {
    preValidation: [validateBody(retryStrategySettingsSchema)],
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
  // Feature #713: Add Zod param validation
  app.get<{
    Params: { testId: string };
  }>('/api/v1/organization/retry-strategy/:testId', {
    preValidation: [validateParams(retryStrategyTestIdParamsSchema)],
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const orgId = getOrganizationId(request);

    // Find the test using async DB call
    const test = await dbGetTestAsync(testId);
    if (!test || test.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
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
