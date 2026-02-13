/**
 * Test Suites Module - Test CRUD Routes
 * Feature #730: Split test-suites/routes.ts into sub-modules
 *
 * Handles test get, get code, create, update, and delete operations.
 */

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload, getOrganizationId } from '../../middleware/auth.js';
import {
  validateParams,
  validateQuery,
  testParamsSchema,
  suiteParamsSchema,
  testCodeQuerySchema,
} from '../../validation/index.js';
import { logAuditEntry } from '../audit-logs.js';
import { getCache, CacheKeys, CacheTTL } from '../../services/cache.js';
// Feature #1305: Import webhook function for test.created event
import { sendTestCreatedWebhook } from '../test-runs/webhook-events.js';
import { emitTestCreated, emitTestUpdated, emitTestDeleted } from '../../services/websocket-events.js';
import {
  TestSuite,
  Test,
  SuiteParams,
  TestParams,
  CreateTestBody,
  UpdateTestBody,
} from './types.js';
import {
  getTestSuite as dbGetTestSuite,
  getTest as dbGetTest,
  createTest as dbCreateTest,
  updateTest as dbUpdateTest,
  deleteTest as dbDeleteTest,
} from './stores.js';
import { generatePlaywrightCode } from './utils.js';
import { createLogger } from '../../services/logger.js';
import { sendError } from '../../utils/errors.js';

const logger = createLogger('test-suites');

export async function testCrudRoutes(app: FastifyInstance) {
  // Get single test
  // Feature #2081: Use async database functions for persistence
  // Feature #61: Cached for 5 minutes
  // Feature #714: Zod validation for params
  app.get<{ Params: TestParams }>('/api/v1/tests/:testId', {
    preHandler: [authenticate],
    preValidation: [validateParams(testParamsSchema)],
  }, async (request, reply) => {
    const { testId } = request.params;
    const orgId = getOrganizationId(request);
    const cache = getCache();

    // Feature #61: Try to get from cache first
    const cacheKey = CacheKeys.tests.detail(testId);
    let test: Test | null | undefined = await cache.get<Test>(cacheKey);

    if (!test) {
      // Cache miss - fetch from database
      test = await dbGetTest(testId) ?? null;
      if (test) {
        // Cache the test
        await cache.set(cacheKey, test, CacheTTL.MEDIUM);
      }
    }

    if (!test || test.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
    }

    return { test };
  });

  // Feature #875: Get generated Playwright code for a test
  // Feature #2081: Use async database functions for persistence
  // Feature #714: Zod validation for params and query
  app.get<{ Params: TestParams; Querystring: { format?: 'typescript' | 'javascript' } }>('/api/v1/tests/:testId/code', {
    preHandler: [authenticate],
    preValidation: [validateParams(testParamsSchema), validateQuery(testCodeQuerySchema)],
  }, async (request, reply) => {
    const { testId } = request.params;
    const format = request.query.format || 'typescript';
    const orgId = getOrganizationId(request);

    // Use async database function
    const test = await dbGetTest(testId);
    if (!test || test.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
    }

    // Get the suite for base URL using async database function
    const suite = await dbGetTestSuite(test.suite_id);
    const baseUrl = suite?.base_url || 'https://example.com';

    // If custom code exists and is enabled, return it
    if (test.use_custom_code && test.playwright_code) {
      return {
        test_id: testId,
        test_name: test.name,
        format,
        code: test.playwright_code,
        source: 'custom',
        is_valid: true,
      };
    }

    // Generate Playwright code from steps
    const code = generatePlaywrightCode(test.name, test.steps, baseUrl, format);

    return {
      test_id: testId,
      test_name: test.name,
      format,
      code,
      source: 'generated',
      steps_count: test.steps.length,
      is_valid: true,
    };
  });

  // Create test in a suite
  // Feature #2081: Use async database functions for persistence
  // Feature #714: Zod validation for params
  app.post<{ Params: SuiteParams; Body: CreateTestBody }>('/api/v1/suites/:suiteId/tests', {
    preHandler: [authenticate],
    preValidation: [validateParams(suiteParamsSchema)],
  }, async (request, reply) => {
    const { suiteId } = request.params;
    // Feature #589: Added timeout, retries, tags, device_emulation, device_config for E2E tests
    const { name, description, test_type = 'e2e', steps = [], target_url, viewport_width, viewport_height, viewport_preset, capture_mode = 'full_page', element_selector, wait_for_selector, wait_time, hide_selectors, remove_selectors, multi_viewport, viewports, diff_threshold, diff_threshold_mode, diff_pixel_threshold, ignore_regions, ignore_selectors, mask_datetime_selectors, mask_dynamic_content, anti_aliasing_tolerance, color_threshold, device_preset, performance_threshold, lcp_threshold, cls_threshold, bypass_csp, ignore_ssl_errors, audit_timeout, virtual_users, duration, ramp_up_time, k6_script, k6_thresholds, ai_generated, ai_confidence_score, review_status, status: statusOverride, timeout, retries, tags, device_emulation, device_config } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot create tests
    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot create tests');
    }

    // Use async database function
    const suite = await dbGetTestSuite(suiteId);
    if (!suite || suite.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test suite not found');
    }

    if (!name) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Test name is required');
    }

    // Validate visual regression test requirements
    if (test_type === 'visual_regression' && !target_url) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Target URL is required for visual regression tests');
    }

    // Validate lighthouse test requirements
    if (test_type === 'lighthouse' && !target_url) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Target URL is required for Lighthouse performance tests');
    }

    // Validate element capture mode requires a selector
    if (test_type === 'visual_regression' && capture_mode === 'element' && !element_selector) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Element selector is required when using element capture mode');
    }

    // Validate multi-viewport mode requires at least 2 viewports
    if (test_type === 'visual_regression' && multi_viewport && (!viewports || viewports.length < 2)) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Multi-viewport mode requires at least 2 viewports selected');
    }

    // Validate load test requirements
    if (test_type === 'load' && !target_url) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Target URL is required for load tests');
    }

    // Validate accessibility test requirements
    if (test_type === 'accessibility' && !target_url) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Target URL is required for accessibility tests');
    }

    const { wcag_level, accessibility_rules, include_best_practices, include_experimental, include_pa11y, disable_javascript, a11y_fail_on_any, a11y_fail_on_critical, a11y_fail_on_serious, a11y_fail_on_moderate, a11y_fail_on_minor, a11y_timeout, a11y_wait_for, a11y_wait_selector, a11y_wait_time, a11y_scroll_page, a11y_scroll_behavior } = request.body;

    const id = crypto.randomUUID();

    // Feature #1846: Auto-generate basic steps for E2E tests when no steps provided
    let finalSteps = steps;
    if (test_type === 'e2e' && (!steps || steps.length === 0) && target_url) {
      finalSteps = [
        { id: '1', action: 'navigate', value: target_url, order: 0 },
        { id: '2', action: 'wait', value: '2000', order: 1 },  // Wait 2 seconds for page to load
        { id: '3', action: 'screenshot', value: 'initial_page', order: 2 }
      ];
    }

    const test: Test = {
      id,
      suite_id: suiteId,
      organization_id: orgId,
      name,
      description,
      test_type,
      steps: finalSteps.map((s, i) => ({ ...s, id: s.id || crypto.randomUUID(), order: i })),
      // Feature #589: E2E test specific fields
      timeout: test_type === 'e2e' ? (timeout ?? 30000) : undefined, // Default 30 seconds
      retries: test_type === 'e2e' ? (retries ?? 0) : undefined, // Default 0 retries
      tags: test_type === 'e2e' && tags && tags.length > 0 ? tags : undefined,
      device_emulation: test_type === 'e2e' ? (device_emulation ?? false) : undefined,
      device_config: test_type === 'e2e' && device_emulation ? device_config : undefined,
      // Accessibility fields
      wcag_level: test_type === 'accessibility' ? (wcag_level ?? 'AA') : undefined, // Default to AA
      accessibility_rules: test_type === 'accessibility' ? accessibility_rules : undefined,
      include_best_practices: test_type === 'accessibility' ? (include_best_practices ?? true) : undefined, // Default to true
      include_experimental: test_type === 'accessibility' ? (include_experimental ?? false) : undefined, // Default to false
      include_pa11y: test_type === 'accessibility' ? (include_pa11y ?? false) : undefined, // Default to false - Pa11y integration
      disable_javascript: test_type === 'accessibility' ? (disable_javascript ?? false) : undefined, // Feature #621: Default to false
      // Accessibility threshold configuration
      a11y_fail_on_any: test_type === 'accessibility' ? a11y_fail_on_any : undefined,
      a11y_fail_on_critical: test_type === 'accessibility' ? a11y_fail_on_critical : undefined,
      a11y_fail_on_serious: test_type === 'accessibility' ? a11y_fail_on_serious : undefined,
      a11y_fail_on_moderate: test_type === 'accessibility' ? a11y_fail_on_moderate : undefined,
      a11y_fail_on_minor: test_type === 'accessibility' ? a11y_fail_on_minor : undefined,
      a11y_timeout: test_type === 'accessibility' ? (a11y_timeout ?? 60) : undefined, // Feature #623: Default 60 seconds for accessibility scan timeout
      // Feature #624: Dynamic content loading configuration
      a11y_wait_for: test_type === 'accessibility' ? (a11y_wait_for ?? 'networkidle') : undefined, // Default to networkidle
      a11y_wait_selector: test_type === 'accessibility' ? a11y_wait_selector : undefined, // Optional CSS selector to wait for
      a11y_wait_time: test_type === 'accessibility' ? (a11y_wait_time ?? 0) : undefined, // Default 0ms additional wait
      a11y_scroll_page: test_type === 'accessibility' ? (a11y_scroll_page ?? false) : undefined, // Default don't scroll
      a11y_scroll_behavior: test_type === 'accessibility' ? (a11y_scroll_behavior ?? 'smooth') : undefined, // Default smooth scroll
      // Lighthouse fields
      device_preset: test_type === 'lighthouse' ? (device_preset || 'desktop') : undefined,
      performance_threshold: test_type === 'lighthouse' ? (performance_threshold ?? 50) : undefined,
      lcp_threshold: test_type === 'lighthouse' ? (lcp_threshold ?? 2500) : undefined,
      cls_threshold: test_type === 'lighthouse' ? (cls_threshold ?? 0.1) : undefined,
      bypass_csp: test_type === 'lighthouse' ? (bypass_csp ?? false) : undefined, // Bypass CSP for testing environments
      ignore_ssl_errors: test_type === 'lighthouse' ? (ignore_ssl_errors ?? false) : undefined, // Ignore SSL certificate errors
      audit_timeout: test_type === 'lighthouse' ? (audit_timeout ?? 60) : undefined, // Default 60 seconds for Lighthouse audit timeout
      // Visual regression, lighthouse, load, accessibility & E2E fields (all need target_url)
      // Feature #1846: E2E tests also store target_url for auto-generated steps
      target_url: (test_type === 'visual_regression' || test_type === 'lighthouse' || test_type === 'load' || test_type === 'accessibility' || test_type === 'e2e') ? target_url : undefined,
      viewport_width: test_type === 'visual_regression' && !multi_viewport ? viewport_width : undefined,
      viewport_height: test_type === 'visual_regression' && !multi_viewport ? viewport_height : undefined,
      viewport_preset: test_type === 'visual_regression' && !multi_viewport ? viewport_preset : undefined,
      capture_mode: test_type === 'visual_regression' ? capture_mode : undefined,
      element_selector: test_type === 'visual_regression' && capture_mode === 'element' ? element_selector : undefined,
      wait_for_selector: test_type === 'visual_regression' ? wait_for_selector : undefined,
      wait_time: test_type === 'visual_regression' ? wait_time : undefined,
      hide_selectors: test_type === 'visual_regression' ? hide_selectors : undefined,
      remove_selectors: test_type === 'visual_regression' ? remove_selectors : undefined,
      multi_viewport: test_type === 'visual_regression' ? multi_viewport : undefined,
      viewports: test_type === 'visual_regression' && multi_viewport ? viewports : undefined,
      diff_threshold: test_type === 'visual_regression' ? (diff_threshold ?? 0) : undefined, // Default to 0% threshold
      diff_threshold_mode: test_type === 'visual_regression' ? (diff_threshold_mode ?? 'percentage') : undefined, // Default to percentage mode
      diff_pixel_threshold: test_type === 'visual_regression' && diff_threshold_mode === 'pixel_count' ? diff_pixel_threshold : undefined,
      ignore_regions: test_type === 'visual_regression' ? ignore_regions : undefined,
      ignore_selectors: test_type === 'visual_regression' ? ignore_selectors : undefined,
      mask_datetime_selectors: test_type === 'visual_regression' ? mask_datetime_selectors : undefined,
      mask_dynamic_content: test_type === 'visual_regression' ? mask_dynamic_content : undefined,
      // Feature #647: Anti-aliasing tolerance for cross-browser comparisons
      anti_aliasing_tolerance: test_type === 'visual_regression' ? (anti_aliasing_tolerance ?? 'off') : undefined, // Default to 'off' (strict matching)
      color_threshold: test_type === 'visual_regression' ? color_threshold : undefined, // Custom color threshold (0.0-1.0)
      // Load test fields (K6)
      virtual_users: test_type === 'load' ? (virtual_users ?? 10) : undefined, // Default 10 virtual users
      duration: test_type === 'load' ? (duration ?? 60) : undefined, // Default 60 seconds
      ramp_up_time: test_type === 'load' ? (ramp_up_time ?? 10) : undefined, // Default 10 seconds ramp-up
      k6_script: test_type === 'load' ? k6_script : undefined, // Custom K6 script
      k6_thresholds: test_type === 'load' ? k6_thresholds : undefined, // K6 threshold configuration
      status: statusOverride || 'draft',
      // Feature #1151: Human review workflow for AI tests
      ai_generated: ai_generated || false,
      ai_confidence_score: ai_confidence_score, // Feature #1164: AI confidence score
      review_status: review_status || null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Feature #2081: Use async database function for persistence
    const savedTest = await dbCreateTest(test);

    // Feature #61: Invalidate tests list cache
    await getCache().delete(CacheKeys.tests.list(suiteId));

    // Log audit entry
    logAuditEntry(request, 'create', 'test', id, savedTest.name, { suiteId, stepCount: steps.length });

    // Feature #1305: Send test.created webhook
    sendTestCreatedWebhook(orgId, {
      test_id: id,
      test_name: name,
      test_type,
      description,
      suite_id: suiteId,
      suite_name: suite.name,
      project_id: suite.project_id,
      created_by: user.email,
    }).catch(err => {
      logger.error({ err }, 'Failed to send test.created webhook');
    });

    // Feature #108: Emit WebSocket event for real-time cache invalidation
    emitTestCreated(orgId, id, suiteId);

    return reply.status(201).send({ test: savedTest });
  });

  // Update test
  // Feature #2081: Use async database functions for persistence
  // Feature #714: Zod validation for params
  app.patch<{ Params: TestParams; Body: UpdateTestBody }>('/api/v1/tests/:testId', {
    preHandler: [authenticate],
    preValidation: [validateParams(testParamsSchema)],
  }, async (request, reply) => {
    const { testId } = request.params;
    const updates = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot update tests
    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot update tests');
    }

    // Use async database function
    const existingTest = await dbGetTest(testId);
    if (!existingTest || existingTest.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
    }

    // Build updates object for database
    const testUpdates: Partial<Test> = {};
    if (updates.name) testUpdates.name = updates.name;
    if (updates.description !== undefined) testUpdates.description = updates.description;
    if (updates.test_type) testUpdates.test_type = updates.test_type;
    if (updates.steps) testUpdates.steps = updates.steps.map((s, i) => ({ ...s, id: s.id || crypto.randomUUID(), order: i }));
    if (updates.playwright_code !== undefined) testUpdates.playwright_code = updates.playwright_code;
    if (updates.use_custom_code !== undefined) testUpdates.use_custom_code = updates.use_custom_code;
    // Visual regression fields
    if (updates.target_url !== undefined) testUpdates.target_url = updates.target_url;
    if (updates.viewport_width !== undefined) testUpdates.viewport_width = updates.viewport_width;
    if (updates.viewport_height !== undefined) testUpdates.viewport_height = updates.viewport_height;
    if (updates.viewport_preset !== undefined) testUpdates.viewport_preset = updates.viewport_preset;
    if (updates.capture_mode !== undefined) testUpdates.capture_mode = updates.capture_mode;
    if (updates.element_selector !== undefined) testUpdates.element_selector = updates.element_selector;
    if (updates.wait_for_selector !== undefined) testUpdates.wait_for_selector = updates.wait_for_selector;
    if (updates.wait_time !== undefined) testUpdates.wait_time = updates.wait_time;
    if (updates.hide_selectors !== undefined) testUpdates.hide_selectors = updates.hide_selectors;
    if (updates.remove_selectors !== undefined) testUpdates.remove_selectors = updates.remove_selectors;
    if (updates.multi_viewport !== undefined) testUpdates.multi_viewport = updates.multi_viewport;
    if (updates.viewports !== undefined) testUpdates.viewports = updates.viewports;
    if (updates.diff_threshold !== undefined) testUpdates.diff_threshold = updates.diff_threshold;
    if (updates.diff_threshold_mode !== undefined) testUpdates.diff_threshold_mode = updates.diff_threshold_mode;
    if (updates.diff_pixel_threshold !== undefined) testUpdates.diff_pixel_threshold = updates.diff_pixel_threshold;
    if (updates.ignore_regions !== undefined) testUpdates.ignore_regions = updates.ignore_regions;
    if (updates.ignore_selectors !== undefined) testUpdates.ignore_selectors = updates.ignore_selectors;
    if (updates.mask_datetime_selectors !== undefined) testUpdates.mask_datetime_selectors = updates.mask_datetime_selectors;
    if (updates.mask_dynamic_content !== undefined) testUpdates.mask_dynamic_content = updates.mask_dynamic_content;
    // Feature #969: Anti-aliasing and color threshold settings
    if (updates.anti_aliasing_tolerance !== undefined) testUpdates.anti_aliasing_tolerance = updates.anti_aliasing_tolerance;
    if (updates.color_threshold !== undefined) testUpdates.color_threshold = updates.color_threshold;
    // Lighthouse fields
    if (updates.device_preset !== undefined) testUpdates.device_preset = updates.device_preset;
    if (updates.performance_threshold !== undefined) testUpdates.performance_threshold = updates.performance_threshold;
    if (updates.lcp_threshold !== undefined) testUpdates.lcp_threshold = updates.lcp_threshold;
    if (updates.cls_threshold !== undefined) testUpdates.cls_threshold = updates.cls_threshold;
    if (updates.bypass_csp !== undefined) testUpdates.bypass_csp = updates.bypass_csp;
    if (updates.ignore_ssl_errors !== undefined) testUpdates.ignore_ssl_errors = updates.ignore_ssl_errors;
    if (updates.audit_timeout !== undefined) testUpdates.audit_timeout = updates.audit_timeout;
    // Load test fields
    if (updates.k6_script !== undefined) testUpdates.k6_script = updates.k6_script;
    if (updates.status) testUpdates.status = updates.status;

    // Use async database function
    const updatedTest = await dbUpdateTest(testId, testUpdates);

    // Feature #61: Invalidate test cache
    const cache = getCache();
    await cache.delete(CacheKeys.tests.detail(testId));
    await cache.delete(CacheKeys.tests.list(existingTest.suite_id));

    // Log audit entry
    logAuditEntry(request, 'update', 'test', testId, updatedTest?.name || existingTest.name, { updates: Object.keys(updates) });

    // Feature #108: Emit WebSocket event for real-time cache invalidation
    emitTestUpdated(existingTest.organization_id, testId, existingTest.suite_id);

    return { test: updatedTest || existingTest };
  });

  // Delete test
  // Feature #2081: Use async database functions for persistence
  // Feature #714: Zod validation for params
  app.delete<{ Params: TestParams }>('/api/v1/tests/:testId', {
    preHandler: [authenticate],
    preValidation: [validateParams(testParamsSchema)],
  }, async (request, reply) => {
    const { testId } = request.params;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Only admin, owner, or developer can delete tests
    if (user.role === 'viewer') {
      return sendError(reply, 403, 'FORBIDDEN', 'Viewers cannot delete tests');
    }

    // Use async database function
    const existingTest = await dbGetTest(testId);
    if (!existingTest || existingTest.organization_id !== orgId) {
      return sendError(reply, 404, 'NOT_FOUND', 'Test not found');
    }

    const testName = existingTest.name;
    const suiteId = existingTest.suite_id;

    // Use async database function
    await dbDeleteTest(testId);

    // Feature #61: Invalidate test cache
    const cache = getCache();
    await cache.delete(CacheKeys.tests.detail(testId));
    await cache.delete(CacheKeys.tests.list(suiteId));

    // Log audit entry
    logAuditEntry(request, 'delete', 'test', testId, testName);

    // Feature #108: Emit WebSocket event for real-time cache invalidation
    emitTestDeleted(existingTest.organization_id, testId, suiteId);

    return { message: 'Test deleted successfully' };
  });
}
