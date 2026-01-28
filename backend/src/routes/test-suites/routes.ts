// Test Suites Module - Core CRUD Routes
// Handles test suite and test CRUD operations, plus test steps

import { FastifyInstance } from 'fastify';
import { authenticate, JwtPayload, getOrganizationId } from '../../middleware/auth';
import { logAuditEntry } from '../audit-logs';
// Feature #1305: Import webhook function for test.created event
import { sendTestCreatedWebhook } from '../test-runs/webhook-events';
import {
  TestSuite,
  Test,
  TestStep,
  ProjectParams,
  SuiteParams,
  TestParams,
  CreateSuiteBody,
  CreateTestBody,
  UpdateTestBody,
  UpdateSuiteBody,
} from './types';
// Import async database functions
import {
  listTestSuites as dbListTestSuites,
  getTestSuite as dbGetTestSuite,
  createTestSuite as dbCreateTestSuite,
  updateTestSuite as dbUpdateTestSuite,
  deleteTestSuite as dbDeleteTestSuite,
  listTests as dbListTests,
  getTest as dbGetTest,
  createTest as dbCreateTest,
  updateTest as dbUpdateTest,
  deleteTest as dbDeleteTest,
} from './stores';
import { generatePlaywrightCode } from './utils';
// Feature #1958: Import testRuns for run metadata on test list
import { testRuns } from '../test-runs/execution';

export async function coreRoutes(app: FastifyInstance) {
  // List test suites for a project
  // Feature #2081: Use async database functions for persistence
  app.get<{ Params: ProjectParams }>('/api/v1/projects/:projectId/suites', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { projectId } = request.params;
    const orgId = getOrganizationId(request);

    // Use async database function
    const suites = await dbListTestSuites(projectId, orgId);

    return { suites };
  });

  // Get single test suite
  // Feature #2081: Use async database functions for persistence
  app.get<{ Params: SuiteParams }>('/api/v1/suites/:suiteId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { suiteId } = request.params;
    const orgId = getOrganizationId(request);

    // Use async database function
    const suite = await dbGetTestSuite(suiteId);
    if (!suite || suite.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test suite not found',
      });
    }

    return { suite };
  });

  // Create test suite
  // Feature #862: MCP tool create-test-suite support
  app.post<{ Params: ProjectParams; Body: CreateSuiteBody }>('/api/v1/projects/:projectId/suites', {
    preHandler: [authenticate],
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
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Viewers cannot create test suites',
      });
    }

    if (!name) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Test suite name is required',
      });
    }

    const id = String(Date.now());

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

    // Log audit entry
    logAuditEntry(request, 'create', 'test_suite', id, savedSuite.name, { projectId, type, base_url, browser: defaultBrowser, browsers, viewport_width, viewport_height });

    return reply.status(201).send({ suite: savedSuite });
  });

  // Feature #1688: Update test suite
  // MCP tool: update_test_suite
  // Feature #2081: Use async database functions for persistence
  app.patch<{ Params: SuiteParams; Body: UpdateSuiteBody }>('/api/v1/suites/:suiteId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { suiteId } = request.params;
    const updates = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot update test suites
    if (user.role === 'viewer') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Viewers cannot update test suites',
      });
    }

    // Use async database function
    const existingSuite = await dbGetTestSuite(suiteId);
    if (!existingSuite || existingSuite.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test suite not found',
      });
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

    // Log audit entry
    logAuditEntry(request, 'update', 'test_suite', suiteId, updatedSuite?.name || existingSuite.name, { updates: Object.keys(updates) });

    return { suite: updatedSuite || existingSuite };
  });

  // Delete test suite
  // Feature #2081: Use async database functions for persistence
  app.delete<{ Params: SuiteParams }>('/api/v1/suites/:suiteId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { suiteId } = request.params;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Only admin or owner can delete suites
    if (user.role !== 'admin' && user.role !== 'owner') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only administrators can delete test suites',
      });
    }

    // Use async database function
    const suite = await dbGetTestSuite(suiteId);
    if (!suite || suite.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test suite not found',
      });
    }

    const suiteName = suite.name;

    // Use async database function - it will cascade delete tests
    await dbDeleteTestSuite(suiteId);

    // Log audit entry
    logAuditEntry(request, 'delete', 'test_suite', suiteId, suiteName);

    return { message: 'Test suite deleted successfully' };
  });

  // List tests in a suite
  // Feature #1958: Include run metadata (last_run, last_result, run_count, avg_duration)
  // Feature #2081: Use async database functions for persistence
  app.get<{ Params: SuiteParams }>('/api/v1/suites/:suiteId/tests', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { suiteId } = request.params;
    const orgId = getOrganizationId(request);

    // Use async database function
    const suite = await dbGetTestSuite(suiteId);
    if (!suite || suite.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test suite not found',
      });
    }

    // Use async database function
    const testList = await dbListTests(suiteId);

    // Feature #1958: Compute run metadata for each test
    const testsWithRunMetadata = testList.map(test => {
      // Get all runs for this test
      const testRunsForTest = Array.from(testRuns.values())
        .filter(run => run.test_id === test.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const runCount = testRunsForTest.length;
      const lastRun = testRunsForTest[0];

      // Calculate last result from the most recent run
      // Feature #2051: Expand type to include all TestRunStatus values (including visual statuses)
      let lastResult: 'pending' | 'running' | 'paused' | 'passed' | 'failed' | 'warning' | 'error' | 'cancelled' | 'cancelling' | 'visual_approved' | 'visual_rejected' | null = null;
      if (lastRun) {
        lastResult = lastRun.status;
      }

      // Calculate average duration from completed runs
      const completedRuns = testRunsForTest.filter(run => run.duration_ms && run.duration_ms > 0);
      const avgDuration = completedRuns.length > 0
        ? Math.round(completedRuns.reduce((sum, run) => sum + (run.duration_ms || 0), 0) / completedRuns.length)
        : null;

      return {
        ...test,
        // Run metadata
        run_count: runCount,
        last_run_at: lastRun?.completed_at || lastRun?.started_at || null,
        last_result: lastResult,
        avg_duration_ms: avgDuration,
      };
    });

    return { tests: testsWithRunMetadata };
  });

  // Get single test
  // Feature #2081: Use async database functions for persistence
  app.get<{ Params: TestParams }>('/api/v1/tests/:testId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const orgId = getOrganizationId(request);

    // Use async database function
    const test = await dbGetTest(testId);
    if (!test || test.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    return { test };
  });

  // Feature #875: Get generated Playwright code for a test
  // Feature #2081: Use async database functions for persistence
  app.get<{ Params: TestParams; Querystring: { format?: 'typescript' | 'javascript' } }>('/api/v1/tests/:testId/code', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const format = request.query.format || 'typescript';
    const orgId = getOrganizationId(request);

    // Use async database function
    const test = await dbGetTest(testId);
    if (!test || test.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
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
  app.post<{ Params: SuiteParams; Body: CreateTestBody }>('/api/v1/suites/:suiteId/tests', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { suiteId } = request.params;
    const { name, description, test_type = 'e2e', steps = [], target_url, viewport_width, viewport_height, viewport_preset, capture_mode = 'full_page', element_selector, wait_for_selector, wait_time, hide_selectors, remove_selectors, multi_viewport, viewports, diff_threshold, diff_threshold_mode, diff_pixel_threshold, ignore_regions, ignore_selectors, mask_datetime_selectors, mask_dynamic_content, anti_aliasing_tolerance, color_threshold, device_preset, performance_threshold, lcp_threshold, cls_threshold, bypass_csp, ignore_ssl_errors, audit_timeout, virtual_users, duration, ramp_up_time, k6_script, k6_thresholds, ai_generated, ai_confidence_score, review_status, status: statusOverride } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot create tests
    if (user.role === 'viewer') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Viewers cannot create tests',
      });
    }

    // Use async database function
    const suite = await dbGetTestSuite(suiteId);
    if (!suite || suite.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test suite not found',
      });
    }

    if (!name) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Test name is required',
      });
    }

    // Validate visual regression test requirements
    if (test_type === 'visual_regression' && !target_url) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Target URL is required for visual regression tests',
      });
    }

    // Validate lighthouse test requirements
    if (test_type === 'lighthouse' && !target_url) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Target URL is required for Lighthouse performance tests',
      });
    }

    // Validate element capture mode requires a selector
    if (test_type === 'visual_regression' && capture_mode === 'element' && !element_selector) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Element selector is required when using element capture mode',
      });
    }

    // Validate multi-viewport mode requires at least 2 viewports
    if (test_type === 'visual_regression' && multi_viewport && (!viewports || viewports.length < 2)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Multi-viewport mode requires at least 2 viewports selected',
      });
    }

    // Validate load test requirements
    if (test_type === 'load' && !target_url) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Target URL is required for load tests',
      });
    }

    // Validate accessibility test requirements
    if (test_type === 'accessibility' && !target_url) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Target URL is required for accessibility tests',
      });
    }

    const { wcag_level, accessibility_rules, include_best_practices, include_experimental, include_pa11y, disable_javascript, a11y_fail_on_any, a11y_fail_on_critical, a11y_fail_on_serious, a11y_fail_on_moderate, a11y_fail_on_minor, a11y_timeout, a11y_wait_for, a11y_wait_selector, a11y_wait_time, a11y_scroll_page, a11y_scroll_behavior } = request.body;

    const id = String(Date.now());

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
      steps: finalSteps.map((s, i) => ({ ...s, id: String(Date.now() + i), order: i })),
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
      console.error('[WEBHOOK] Failed to send test.created webhook:', err);
    });

    return reply.status(201).send({ test: savedTest });
  });

  // Update test
  // Feature #2081: Use async database functions for persistence
  app.patch<{ Params: TestParams; Body: UpdateTestBody }>('/api/v1/tests/:testId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const updates = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot update tests
    if (user.role === 'viewer') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Viewers cannot update tests',
      });
    }

    // Use async database function
    const existingTest = await dbGetTest(testId);
    if (!existingTest || existingTest.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    // Build updates object for database
    const testUpdates: Partial<Test> = {};
    if (updates.name) testUpdates.name = updates.name;
    if (updates.description !== undefined) testUpdates.description = updates.description;
    if (updates.test_type) testUpdates.test_type = updates.test_type;
    if (updates.steps) testUpdates.steps = updates.steps.map((s, i) => ({ ...s, id: s.id || String(Date.now() + i), order: i }));
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

    // Log audit entry
    logAuditEntry(request, 'update', 'test', testId, updatedTest?.name || existingTest.name, { updates: Object.keys(updates) });

    return { test: updatedTest || existingTest };
  });

  // Reorder test steps
  // Feature #2081: Use async database functions for persistence
  app.put<{ Params: TestParams; Body: { steps: Array<{ id: string; action: string; selector?: string; value?: string; order?: number }> } }>('/api/v1/tests/:testId/steps/reorder', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const { steps } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot reorder steps
    if (user.role === 'viewer') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Viewers cannot reorder test steps',
      });
    }

    // Use async database function
    const existingTest = await dbGetTest(testId);
    if (!existingTest || existingTest.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    // Update the steps with new order
    const newSteps = steps.map((s, i) => ({
      ...s,
      id: s.id || String(Date.now() + i),
      order: i
    }));

    // Use async database function
    const updatedTest = await dbUpdateTest(testId, { steps: newSteps });

    // Log audit entry
    logAuditEntry(request, 'update', 'test', testId, updatedTest?.name || existingTest.name, { action: 'reorder_steps' });

    return { test: updatedTest || existingTest };
  });

  // Feature #872: Add a step to a test
  app.post<{ Params: TestParams; Body: { action: string; selector?: string; value?: string; index?: number } }>('/api/v1/tests/:testId/steps', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const { action, selector, value, index } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot add steps
    if (user.role === 'viewer') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Viewers cannot add test steps',
      });
    }

    // Use async database function
    const existingTest = await dbGetTest(testId);
    if (!existingTest || existingTest.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    if (!action) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Step action is required',
      });
    }

    // Validate action type
    const validActions = ['click', 'fill', 'navigate', 'assert', 'wait', 'hover', 'select', 'press', 'screenshot', 'scroll', 'check', 'uncheck', 'focus', 'blur', 'dblclick', 'type', 'clear', 'upload', 'download', 'evaluate'];
    if (!validActions.includes(action)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Invalid action type. Valid actions: ${validActions.join(', ')}`,
      });
    }

    // Create new step
    const newStep: TestStep = {
      id: String(Date.now()),
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
  app.patch<{ Params: { testId: string; stepId: string }; Body: { action?: string; selector?: string; value?: string } }>('/api/v1/tests/:testId/steps/:stepId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId, stepId } = request.params;
    const { action, selector, value } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot update steps
    if (user.role === 'viewer') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Viewers cannot update test steps',
      });
    }

    // Use async database function
    const existingTest = await dbGetTest(testId);
    if (!existingTest || existingTest.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    // Find the step
    const stepIndex = existingTest.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Step not found in this test',
      });
    }

    const step = existingTest.steps[stepIndex];
    if (!step) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Step not found',
      });
    }

    // Validate action type if provided
    if (action) {
      const validActions = ['click', 'fill', 'navigate', 'assert', 'wait', 'hover', 'select', 'press', 'screenshot', 'scroll', 'check', 'uncheck', 'focus', 'blur', 'dblclick', 'type', 'clear', 'upload', 'download', 'evaluate'];
      if (!validActions.includes(action)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Invalid action type. Valid actions: ${validActions.join(', ')}`,
        });
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
  app.delete<{ Params: { testId: string; stepId: string } }>('/api/v1/tests/:testId/steps/:stepId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId, stepId } = request.params;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot delete steps
    if (user.role === 'viewer') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Viewers cannot delete test steps',
      });
    }

    // Use async database function
    const existingTest = await dbGetTest(testId);
    if (!existingTest || existingTest.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    // Find the step
    const stepIndex = existingTest.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Step not found in this test',
      });
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
  app.put<{ Params: SuiteParams; Body: { test_ids: string[] } }>('/api/v1/suites/:suiteId/tests/reorder', {
    preHandler: [authenticate],
  // Feature #2081: Use async database functions for persistence
  }, async (request, reply) => {
    const { suiteId } = request.params;
    const { test_ids } = request.body;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Viewers cannot reorder tests
    if (user.role === 'viewer') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Viewers cannot reorder tests',
      });
    }

    // Use async database function
    const suite = await dbGetTestSuite(suiteId);
    if (!suite || suite.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test suite not found',
      });
    }

    if (!Array.isArray(test_ids) || test_ids.length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'test_ids must be a non-empty array of test IDs',
      });
    }

    // Get all tests in this suite using async database function
    const suiteTests = await dbListTests(suiteId);

    // Validate all test IDs belong to this suite
    const suiteTestIds = new Set(suiteTests.map(t => t.id));
    const invalidIds = test_ids.filter(id => !suiteTestIds.has(id));
    if (invalidIds.length > 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Some test IDs do not belong to this suite: ${invalidIds.join(', ')}`,
      });
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

    // Log audit entry
    logAuditEntry(request, 'update', 'suite', suiteId, suite.name, { action: 'reorder_tests', test_count: test_ids.length });

    return {
      reordered: true,
      suite_id: suiteId,
      tests: reorderedTests,
      count: reorderedTests.length,
    };
  });

  // Delete test
  // Feature #2081: Use async database functions for persistence
  app.delete<{ Params: TestParams }>('/api/v1/tests/:testId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { testId } = request.params;
    const user = request.user as JwtPayload;
    const orgId = getOrganizationId(request);

    // Only admin, owner, or developer can delete tests
    if (user.role === 'viewer') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Viewers cannot delete tests',
      });
    }

    // Use async database function
    const existingTest = await dbGetTest(testId);
    if (!existingTest || existingTest.organization_id !== orgId) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Test not found',
      });
    }

    const testName = existingTest.name;

    // Use async database function
    await dbDeleteTest(testId);

    // Log audit entry
    logAuditEntry(request, 'delete', 'test', testId, testName);

    return { message: 'Test deleted successfully' };
  });
}
