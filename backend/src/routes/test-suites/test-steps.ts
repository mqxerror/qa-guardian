/**
 * Test Suites Module - Test Steps Management Routes
 * Feature #730: Split test-suites/routes.ts into sub-modules
 *
 * Handles test step reordering, adding, updating, deleting,
 * and test reordering within a suite.
 */

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload, getOrganizationId } from '../../middleware/auth.js';
import {
  validateBody,
  validateParams,
  testParamsSchema,
  testStepParamsSchema,
  suiteParamsSchema,
  reorderStepsSchema,
  addStepSchema,
  updateStepSchema,
  reorderTestsSchema,
} from '../../validation/index.js';
import { logAuditEntry } from '../audit-logs.js';
import { getCache, CacheKeys } from '../../services/cache.js';
import {
  Test,
  TestStep,
  TestParams,
  SuiteParams,
} from './types.js';
import {
  getTestSuite as dbGetTestSuite,
  getTest as dbGetTest,
  updateTest as dbUpdateTest,
  listTests as dbListTests,
} from './stores.js';
import { sendError } from '../../utils/errors.js';

export async function testStepsRoutes(app: FastifyInstance) {
  // Reorder test steps
  // Feature #2081: Use async database functions for persistence
  // Feature #714: Zod validation for params and body
  app.put<{ Params: TestParams; Body: { steps: Array<{ id: string; action: string; selector?: string; value?: string; order?: number }> } }>('/api/v1/tests/:testId/steps/reorder', {
    preHandler: [authenticate],
    preValidation: [validateParams(testParamsSchema), validateBody(reorderStepsSchema)],
  }, async (request, reply) => {
    const { testId } = request.params;
    const { steps } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot reorder steps
    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot reorder test steps');
    }

    // Use async database function
    const existingTest = await dbGetTest(testId);
    if (!existingTest || existingTest.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
    }

    // Update the steps with new order
    const newSteps = steps.map((s, i) => ({
      ...s,
      id: s.id || crypto.randomUUID(),
      order: i
    }));

    // Use async database function
    const updatedTest = await dbUpdateTest(testId, { steps: newSteps });

    // Feature #61: Invalidate test cache
    const cache = getCache();
    await cache.delete(CacheKeys.tests.detail(testId));

    // Log audit entry
    logAuditEntry(request, 'update', 'test', testId, updatedTest?.name || existingTest.name, { action: 'reorder_steps' });

    return { test: updatedTest || existingTest };
  });

  // Feature #872: Add a step to a test
  // Feature #714: Zod validation for params and body
  app.post<{ Params: TestParams; Body: { action: string; selector?: string; value?: string; index?: number } }>('/api/v1/tests/:testId/steps', {
    preHandler: [authenticate],
    preValidation: [validateParams(testParamsSchema), validateBody(addStepSchema)],
  }, async (request, reply) => {
    const { testId } = request.params;
    const { action, selector, value, index } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot add steps
    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot add test steps');
    }

    // Use async database function
    const existingTest = await dbGetTest(testId);
    if (!existingTest || existingTest.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
    }

    if (!action) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Step action is required');
    }

    // Validate action type
    const validActions = ['click', 'fill', 'navigate', 'assert', 'wait', 'hover', 'select', 'press', 'screenshot', 'scroll', 'check', 'uncheck', 'focus', 'blur', 'dblclick', 'type', 'clear', 'upload', 'download', 'evaluate'];
    if (!validActions.includes(action)) {
      return sendError(reply, 400, 'BAD_REQUEST', `Invalid action type. Valid actions: ${validActions.join(', ')}`);
    }

    // Create new step
    const newStep: TestStep = {
      id: crypto.randomUUID(),
      action,
      selector,
      value,
      order: 0, // Will be set based on index
    };

    // Insert at specified index or append to end
    const insertIndex = typeof index === 'number' && index >= 0 && index <= existingTest.steps.length
      ? index
      : existingTest.steps.length;

    const newSteps = [...existingTest.steps];
    newSteps.splice(insertIndex, 0, newStep);

    // Re-order all steps
    newSteps.forEach((step, i) => {
      step.order = i;
    });

    // Use async database function
    const updatedTest = await dbUpdateTest(testId, { steps: newSteps });

    // Feature #61: Invalidate test cache
    const cache = getCache();
    await cache.delete(CacheKeys.tests.detail(testId));

    // Log audit entry
    logAuditEntry(request, 'update', 'test', testId, updatedTest?.name || existingTest.name, { action: 'add_step', stepAction: action, stepIndex: insertIndex });

    return reply.status(201).send({
      step: newStep,
      test_id: testId,
      index: insertIndex,
      total_steps: newSteps.length,
    });
  });

  // Feature #873: Update a step in a test
  // Feature #2081: Use async database functions for persistence
  // Feature #714: Zod validation for params and body
  app.patch<{ Params: { testId: string; stepId: string }; Body: { action?: string; selector?: string; value?: string } }>('/api/v1/tests/:testId/steps/:stepId', {
    preHandler: [authenticate],
    preValidation: [validateParams(testStepParamsSchema), validateBody(updateStepSchema)],
  }, async (request, reply) => {
    const { testId, stepId } = request.params;
    const { action, selector, value } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot update steps
    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot update test steps');
    }

    // Use async database function
    const existingTest = await dbGetTest(testId);
    if (!existingTest || existingTest.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
    }

    // Find the step
    const stepIndex = existingTest.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) {
      return sendError(reply, 404, 'NOT_FOUND', 'Step not found in this test');
    }

    const step = existingTest.steps[stepIndex];
    if (!step) {
      return sendError(reply, 404, 'NOT_FOUND', 'Step not found');
    }

    // Validate action type if provided
    if (action) {
      const validActions = ['click', 'fill', 'navigate', 'assert', 'wait', 'hover', 'select', 'press', 'screenshot', 'scroll', 'check', 'uncheck', 'focus', 'blur', 'dblclick', 'type', 'clear', 'upload', 'download', 'evaluate'];
      if (!validActions.includes(action)) {
        return sendError(reply, 400, 'BAD_REQUEST', `Invalid action type. Valid actions: ${validActions.join(', ')}`);
      }
      step.action = action;
    }

    // Update optional fields
    if (selector !== undefined) step.selector = selector || undefined;
    if (value !== undefined) step.value = value || undefined;

    // Update steps array with modified step
    const newSteps = [...existingTest.steps];
    newSteps[stepIndex] = step;

    // Use async database function
    const updatedTest = await dbUpdateTest(testId, { steps: newSteps });

    // Feature #61: Invalidate test cache
    const cache = getCache();
    await cache.delete(CacheKeys.tests.detail(testId));

    // Log audit entry
    logAuditEntry(request, 'update', 'test', testId, updatedTest?.name || existingTest.name, { action: 'update_step', stepId, stepIndex });

    return {
      updated: true,
      step,
      test_id: testId,
      index: stepIndex,
    };
  });

  // Feature #874: Delete a step from a test
  // Feature #2081: Use async database functions for persistence
  // Feature #714: Zod validation for params
  app.delete<{ Params: { testId: string; stepId: string } }>('/api/v1/tests/:testId/steps/:stepId', {
    preHandler: [authenticate],
    preValidation: [validateParams(testStepParamsSchema)],
  }, async (request, reply) => {
    const { testId, stepId } = request.params;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot delete steps
    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot delete test steps');
    }

    // Use async database function
    const existingTest = await dbGetTest(testId);
    if (!existingTest || existingTest.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
    }

    // Find the step
    const stepIndex = existingTest.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) {
      return sendError(reply, 404, 'NOT_FOUND', 'Step not found in this test');
    }

    const deletedStep = existingTest.steps[stepIndex];

    // Remove the step
    const newSteps = [...existingTest.steps];
    newSteps.splice(stepIndex, 1);

    // Reindex remaining steps
    newSteps.forEach((step, i) => {
      step.order = i;
    });

    // Use async database function
    const updatedTest = await dbUpdateTest(testId, { steps: newSteps });

    // Feature #61: Invalidate test cache
    const cache = getCache();
    await cache.delete(CacheKeys.tests.detail(testId));

    // Log audit entry
    logAuditEntry(request, 'update', 'test', testId, updatedTest?.name || existingTest.name, { action: 'delete_step', stepId, stepIndex });

    return {
      deleted: true,
      deleted_step: deletedStep,
      test_id: testId,
      deleted_index: stepIndex,
      remaining_steps: newSteps.length,
    };
  });

  // Feature #871: Reorder tests within a suite
  // Feature #2081: Use async database functions for persistence
  // Feature #714: Zod validation for params and body
  app.put<{ Params: SuiteParams; Body: { test_ids: string[] } }>('/api/v1/suites/:suiteId/tests/reorder', {
    preHandler: [authenticate],
    preValidation: [validateParams(suiteParamsSchema), validateBody(reorderTestsSchema)],
  }, async (request, reply) => {
    const { suiteId } = request.params;
    const { test_ids } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot reorder tests
    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot reorder tests');
    }

    // Use async database function
    const suite = await dbGetTestSuite(suiteId);
    if (!suite || suite.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test suite not found');
    }

    if (!Array.isArray(test_ids) || test_ids.length === 0) {
      return sendError(reply, 400, 'BAD_REQUEST', 'test_ids must be a non-empty array of test IDs');
    }

    // Get all tests in this suite using async database function
    const suiteTests = await dbListTests(suiteId);

    // Validate all test IDs belong to this suite
    const suiteTestIds = new Set(suiteTests.map(t => t.id));
    const invalidIds = test_ids.filter(id => !suiteTestIds.has(id));
    if (invalidIds.length > 0) {
      return sendError(reply, 400, 'BAD_REQUEST', `Some test IDs do not belong to this suite: ${invalidIds.join(', ')}`);
    }

    // Update order for each test using async database function
    const reorderedTests: Test[] = [];
    for (let index = 0; index < test_ids.length; index++) {
      const testId = test_ids[index];
      const updatedTest = await dbUpdateTest(testId, { order: index });
      if (updatedTest) {
        reorderedTests.push(updatedTest);
      }
    }

    // Feature #61: Invalidate test list cache for this suite
    const cache = getCache();
    await cache.delete(CacheKeys.tests.list(suiteId));
    // Also invalidate individual test caches
    for (const testId of test_ids) {
      await cache.delete(CacheKeys.tests.detail(testId));
    }

    // Log audit entry
    logAuditEntry(request, 'update', 'suite', suiteId, suite.name, { action: 'reorder_tests', test_count: test_ids.length });

    return {
      reordered: true,
      suite_id: suiteId,
      tests: reorderedTests,
      count: reorderedTests.length,
    };
  });
}
