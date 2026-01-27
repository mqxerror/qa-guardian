/**
 * Selector Override Routes Module
 * Feature #1356: Backend file size limit enforcement (1500 lines)
 *
 * This module contains routes for selector healing and override management:
 * - GET /api/v1/runs/:runId/results/:testId/healed-selectors
 * - PUT /api/v1/runs/:runId/results/:testId/steps/:stepId/selector
 * - POST /api/v1/runs/:runId/results/:testId/steps/:stepId/accept-healed
 * - POST /api/v1/runs/:runId/results/:testId/steps/:stepId/reject-healed
 * - GET /api/v1/tests/:testId/selector-overrides
 * - DELETE /api/v1/tests/:testId/steps/:stepId/selector-override
 *
 * Extracted from test-runs.ts to reduce file size.
 */

import { FastifyInstance } from 'fastify';
import { authenticate, getOrganizationId, JwtPayload } from '../../middleware/auth';
import { testRuns, selectorOverrides, healedSelectorHistory, SelectorOverride } from './execution';
import { tests } from '../test-suites';

/**
 * Register selector override routes
 */
export async function selectorOverrideRoutes(app: FastifyInstance): Promise<void> {
  // ============================================
  // Feature #1065: Manual Override for Healed Selectors
  // ============================================

  // Get healed selectors for a test result
  app.get<{ Params: { runId: string; testId: string } }>('/api/v1/runs/:runId/results/:testId/healed-selectors', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId } = request.params;
    const user = (request as any).user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Get the test run
    const run = testRuns.get(runId);
    if (!run) {
      return reply.status(404).send({ error: 'Not Found', message: 'Test run not found' });
    }

    // Check organization
    if (run.organization_id !== orgId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
    }

    // Find the test result
    const result = run.results?.find(r => r.test_id === testId);
    if (!result) {
      return reply.status(404).send({ error: 'Not Found', message: 'Test result not found' });
    }

    // Collect healed selector information from step results
    const healedSelectors = result.steps
      .filter(step => step.was_healed)
      .map(step => ({
        step_id: step.id,
        action: step.action,
        original_selector: step.original_selector,
        healed_selector: step.healed_selector,
        current_selector: step.selector,
        healing_strategy: step.healing_strategy,
        healing_confidence: step.healing_confidence,
        manual_override: step.manual_override,
        manual_override_at: step.manual_override_at,
        manual_override_by: step.manual_override_by,
        status: step.status,
      }));

    // Also check for any manual overrides for this test
    const overrides: SelectorOverride[] = [];
    for (const [key, override] of selectorOverrides.entries()) {
      if (override.test_id === testId) {
        overrides.push(override);
      }
    }

    return {
      run_id: runId,
      test_id: testId,
      test_name: result.test_name,
      healed_selectors: healedSelectors,
      manual_overrides: overrides,
      summary: {
        total_healed: healedSelectors.length,
        with_manual_override: healedSelectors.filter(s => s.manual_override).length,
        average_confidence: healedSelectors.length > 0
          ? healedSelectors.reduce((sum, s) => sum + (s.healing_confidence || 0), 0) / healedSelectors.length
          : 0,
      },
    };
  });

  // Update a selector manually (override healed selector)
  app.put<{
    Params: { runId: string; testId: string; stepId: string };
    Body: {
      new_selector: string;
      notes?: string;
      apply_to_test?: boolean;
      // Testing/simulation fields for Feature #1065 verification
      simulate_healed?: boolean;
      healing_strategy?: string;
      healing_confidence?: number;
    };
  }>('/api/v1/runs/:runId/results/:testId/steps/:stepId/selector', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId, stepId } = request.params;
    const { new_selector, notes, apply_to_test, simulate_healed, healing_strategy, healing_confidence } = request.body || {};
    const user = (request as any).user as JwtPayload;
    const orgId = getOrganizationId(request);

    if (!new_selector || typeof new_selector !== 'string') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'new_selector is required and must be a string',
      });
    }

    // Get the test run
    const run = testRuns.get(runId);
    if (!run) {
      return reply.status(404).send({ error: 'Not Found', message: 'Test run not found' });
    }

    // Check organization
    if (run.organization_id !== orgId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
    }

    // Find the test result
    const result = run.results?.find(r => r.test_id === testId);
    if (!result) {
      return reply.status(404).send({ error: 'Not Found', message: 'Test result not found' });
    }

    // Find the step
    const step = result.steps.find(s => s.id === stepId);
    if (!step) {
      return reply.status(404).send({ error: 'Not Found', message: 'Step not found' });
    }

    // Store the original selector before overriding
    const originalSelector = step.selector || step.original_selector || '';

    // Feature #1065: Support simulating healed selector for testing
    if (simulate_healed) {
      step.was_healed = true;
      step.original_selector = originalSelector || '#original-broken-selector';
      step.healed_selector = new_selector;
      step.healing_strategy = healing_strategy || 'visual_match';
      step.healing_confidence = healing_confidence ?? 85;
    }

    // Update the step with manual override
    step.original_selector = step.original_selector || originalSelector;
    step.selector = new_selector;
    step.manual_override = true;
    step.manual_override_at = new Date().toISOString();
    step.manual_override_by = user.userId;

    // Store the override for future reference
    const overrideKey = `${testId}-${stepId}`;
    const override: SelectorOverride = {
      test_id: testId,
      step_id: stepId,
      original_selector: originalSelector,
      new_selector,
      override_by: user.userId,
      override_by_email: user.email,
      override_at: new Date().toISOString(),
      notes,
    };
    selectorOverrides.set(overrideKey, override);

    // If apply_to_test is true, also update the test definition
    let testUpdated = false;
    if (apply_to_test) {
      const test = tests.get(testId);
      if (test) {
        const testStep = test.steps.find((s: any) => s.id === stepId);
        if (testStep) {
          testStep.selector = new_selector;
          test.updated_at = new Date();
          testUpdated = true;
          console.log(`[SELECTOR OVERRIDE] Updated test definition for step ${stepId} in test ${testId}`);
        }
      }
    }

    console.log(`[SELECTOR OVERRIDE] User ${user.email} updated selector for step ${stepId} in test ${testId}`);
    console.log(`[SELECTOR OVERRIDE] Original: ${originalSelector}, New: ${new_selector}`);

    return {
      run_id: runId,
      test_id: testId,
      step_id: stepId,
      original_selector: originalSelector,
      new_selector,
      manual_override: true,
      manual_override_at: step.manual_override_at,
      manual_override_by: user.userId,
      test_definition_updated: testUpdated,
      message: `Selector successfully updated${testUpdated ? ' and applied to test definition' : ''}`,
    };
  });

  // Accept a healed selector (make it permanent)
  app.post<{
    Params: { runId: string; testId: string; stepId: string };
    Body: { apply_to_test?: boolean };
  }>('/api/v1/runs/:runId/results/:testId/steps/:stepId/accept-healed', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId, stepId } = request.params;
    const { apply_to_test } = request.body || {};
    const user = (request as any).user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Get the test run
    const run = testRuns.get(runId);
    if (!run) {
      return reply.status(404).send({ error: 'Not Found', message: 'Test run not found' });
    }

    // Check organization
    if (run.organization_id !== orgId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
    }

    // Find the test result
    const result = run.results?.find(r => r.test_id === testId);
    if (!result) {
      return reply.status(404).send({ error: 'Not Found', message: 'Test result not found' });
    }

    // Find the step
    const step = result.steps.find(s => s.id === stepId);
    if (!step) {
      return reply.status(404).send({ error: 'Not Found', message: 'Step not found' });
    }

    if (!step.was_healed || !step.healed_selector) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'This step was not healed. Nothing to accept.',
      });
    }

    // Update healed selector history
    const historyKey = `${runId}-${testId}-${stepId}`;
    const historyEntry = healedSelectorHistory.get(historyKey);
    if (historyEntry) {
      historyEntry.was_accepted = true;
      historyEntry.accepted_at = new Date().toISOString();
      historyEntry.accepted_by = user.userId;
    }

    // If apply_to_test is true, update the test definition with the healed selector
    let testUpdated = false;
    if (apply_to_test) {
      const test = tests.get(testId);
      if (test) {
        const testStep = test.steps.find((s: any) => s.id === stepId);
        if (testStep) {
          testStep.selector = step.healed_selector;
          test.updated_at = new Date();
          testUpdated = true;
          console.log(`[ACCEPT HEALED] Applied healed selector to test definition for step ${stepId}`);
        }
      }
    }

    console.log(`[ACCEPT HEALED] User ${user.email} accepted healed selector for step ${stepId} in test ${testId}`);

    return {
      run_id: runId,
      test_id: testId,
      step_id: stepId,
      original_selector: step.original_selector,
      healed_selector: step.healed_selector,
      healing_strategy: step.healing_strategy,
      healing_confidence: step.healing_confidence,
      accepted: true,
      accepted_at: historyEntry?.accepted_at || new Date().toISOString(),
      accepted_by: user.userId,
      test_definition_updated: testUpdated,
      message: `Healed selector accepted${testUpdated ? ' and applied to test definition' : ''}`,
    };
  });

  // Feature #1068: Reject a healed selector (mark as rejected and flag for manual attention)
  app.post<{
    Params: { runId: string; testId: string; stepId: string };
    Body: { reason?: string; suggest_selector?: string };
  }>('/api/v1/runs/:runId/results/:testId/steps/:stepId/reject-healed', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { runId, testId, stepId } = request.params;
    const { reason, suggest_selector } = request.body || {};
    const user = (request as any).user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Get the test run
    const run = testRuns.get(runId);
    if (!run) {
      return reply.status(404).send({ error: 'Not Found', message: 'Test run not found' });
    }

    // Check organization
    if (run.organization_id !== orgId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
    }

    // Find the test result
    const result = run.results?.find(r => r.test_id === testId);
    if (!result) {
      return reply.status(404).send({ error: 'Not Found', message: 'Test result not found' });
    }

    // Find the step
    const step = result.steps.find(s => s.id === stepId);
    if (!step) {
      return reply.status(404).send({ error: 'Not Found', message: 'Step not found' });
    }

    if (!step.was_healed || !step.healed_selector) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'This step was not healed. Nothing to reject.',
      });
    }

    // Update healed selector history to mark as rejected
    const historyKey = `${runId}-${testId}-${stepId}`;
    const historyEntry = healedSelectorHistory.get(historyKey);
    if (historyEntry) {
      historyEntry.was_rejected = true;
      historyEntry.rejected_at = new Date().toISOString();
      historyEntry.rejected_by = user.userId;
      historyEntry.rejection_reason = reason;
      historyEntry.suggested_selector = suggest_selector;
    } else {
      // Create a new history entry if one doesn't exist
      healedSelectorHistory.set(historyKey, {
        run_id: runId,
        test_id: testId,
        step_id: stepId,
        original_selector: step.original_selector || '',
        healed_selector: step.healed_selector,
        healing_strategy: step.healing_strategy,
        healing_confidence: step.healing_confidence,
        healed_at: new Date().toISOString(),
        was_accepted: false,
        was_rejected: true,
        rejected_at: new Date().toISOString(),
        rejected_by: user.userId,
        rejection_reason: reason,
        suggested_selector: suggest_selector,
      });
    }

    // Mark the step as needing manual attention
    step.needs_manual_attention = true;
    step.healing_rejected = true;
    step.rejection_reason = reason;

    // If a suggested selector was provided, store it for later use
    if (suggest_selector) {
      step.suggested_selector = suggest_selector;
    }

    console.log(`[REJECT HEALED] User ${user.email} rejected healed selector for step ${stepId} in test ${testId}. Reason: ${reason || 'Not provided'}`);

    return {
      run_id: runId,
      test_id: testId,
      step_id: stepId,
      original_selector: step.original_selector,
      healed_selector: step.healed_selector,
      healing_strategy: step.healing_strategy,
      healing_confidence: step.healing_confidence,
      rejected: true,
      rejected_at: new Date().toISOString(),
      rejected_by: user.userId,
      rejection_reason: reason,
      suggested_selector: suggest_selector,
      needs_manual_attention: true,
      message: `Healed selector rejected${reason ? `: ${reason}` : ''}. Step flagged for manual attention.`,
    };
  });

  // Get all selector overrides for a test
  app.get<{ Params: { testId: string } }>('/api/v1/tests/:testId/selector-overrides', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const user = (request as any).user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Check if test exists and belongs to the organization
    const test = tests.get(testId);
    if (!test) {
      return reply.status(404).send({ error: 'Not Found', message: 'Test not found' });
    }

    if (test.organization_id !== orgId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
    }

    // Get all overrides for this test
    const overrides: SelectorOverride[] = [];
    for (const [key, override] of selectorOverrides.entries()) {
      if (override.test_id === testId) {
        overrides.push(override);
      }
    }

    return {
      test_id: testId,
      test_name: test.name,
      overrides,
      total_overrides: overrides.length,
    };
  });

  // Revert a selector override (restore original selector)
  app.delete<{ Params: { testId: string; stepId: string } }>('/api/v1/tests/:testId/steps/:stepId/selector-override', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId, stepId } = request.params;
    const user = (request as any).user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Check if test exists and belongs to the organization
    const test = tests.get(testId);
    if (!test) {
      return reply.status(404).send({ error: 'Not Found', message: 'Test not found' });
    }

    if (test.organization_id !== orgId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
    }

    // Find the override
    const overrideKey = `${testId}-${stepId}`;
    const override = selectorOverrides.get(overrideKey);
    if (!override) {
      return reply.status(404).send({ error: 'Not Found', message: 'Selector override not found' });
    }

    // Restore the original selector in the test definition
    const testStep = test.steps.find((s: any) => s.id === stepId);
    if (testStep) {
      testStep.selector = override.original_selector;
      test.updated_at = new Date();
    }

    // Remove the override
    selectorOverrides.delete(overrideKey);

    console.log(`[SELECTOR REVERT] User ${user.email} reverted selector for step ${stepId} in test ${testId}`);

    return {
      test_id: testId,
      step_id: stepId,
      reverted_to: override.original_selector,
      message: 'Selector override reverted to original',
    };
  });
}
