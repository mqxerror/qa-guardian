/**
 * Run Orchestrator Module
 * Extracted from test-runs.ts for code organization (Feature #249)
 *
 * This module contains:
 * - runTestsForRun - Main test run orchestration function
 * - emitRunEvent - Socket.IO/Redis event emission helper
 * - Socket.IO state management
 * - checkAndSendAlerts wrapper
 */

import { Server as SocketIOServer } from 'socket.io';
import { Browser } from 'playwright';
import { publishRunEvent as publishToRedis, isPublisherAvailable } from '../../services/redis-events.js';
import { getCache, CacheKeys } from '../../services/cache.js';
import { getTestRun, updateTestRun as dbUpdateTestRun } from '../../services/repositories/test-runs.js';
import { getTestSuite, getTest, listTests, updateTest, batchGetTests } from '../test-suites.js';
import { getProjectEnvVars } from '../projects.js';
import { getProject } from '../projects/stores.js';

// Import types and stores from execution module
import {
  TestRun,
  TestRunResult,
  testRuns,
  runningBrowsers,
  setTestRun,
} from './execution.js';

// Import test executor
import {
  executeTest,
  launchBrowser,
  setTestExecutorEmitter,
  ExecuteTestConfig,
} from './test-executor.js';

// Import healing module for Socket.IO setup
import { setHealingSocketIO } from './healing.js';

// Import alert functions
import { checkAndSendAlerts as checkAndSendAlertsBase } from './alerts.js';

// Import webhook functions
import {
  sendRunStartedWebhook,
  sendRunCompletedWebhook,
  sendRunFailedWebhook,
  sendRunPassedWebhook,
} from './webhook-events.js';

import { createLogger } from '../../services/logger.js';

const logger = createLogger('route:test-runs:run-orchestrator');

// Phase 2A: Per-test timeout to prevent indefinite hangs from Chromium crashes,
// page hangs, or infinite loops. Configurable via environment variable.
const PER_TEST_TIMEOUT_MS = parseInt(process.env.PER_TEST_TIMEOUT_MS || '300000', 10); // 5 minutes default

// Socket.IO server instance (set by index.ts after server starts)
let io: SocketIOServer | null = null;

/**
 * Set Socket.IO instance from index.ts
 */
export function setSocketIO(socketIO: SocketIOServer) {
  io = socketIO;
  // Also set Socket.IO for the healing module
  setHealingSocketIO(socketIO);
  // Set emitter for test executor module
  setTestExecutorEmitter(emitRunEvent);
}

/**
 * Get the Socket.IO instance (for other modules that need it)
 */
export function getSocketIO(): SocketIOServer | null {
  return io;
}

/**
 * Helper to emit test run events to both run room and org room
 * Feature #200: Falls back to Redis Pub/Sub when Socket.IO is not available (worker mode)
 */
// Events that should be broadcast to the org room (for cross-tab/dashboard awareness)
// Granular events (test-start, step-start, step-complete, run-progress, test-complete)
// are only sent to the run room to prevent double delivery to clients in both rooms.
const ORG_ROOM_EVENTS = new Set(['run-start', 'run-complete', 'run-cancelled']);

export function emitRunEvent(runId: string, orgId: string, event: string, data: Record<string, unknown>) {
  if (io) {
    // Direct Socket.IO emit (API server mode)
    const payload = { runId, orgId, ...data };
    // Always emit to run-specific room
    io.to(`run:${runId}`).emit(event, payload);
    // Only emit lifecycle events to org room to prevent double delivery
    if (ORG_ROOM_EVENTS.has(event)) {
      io.to(`org:${orgId}`).emit(event, payload);
    }
    logger.info(`[Socket.IO] Emitted ${event} for run ${runId} (org: ${orgId})`);
  } else if (isPublisherAvailable()) {
    // Feature #200: Redis Pub/Sub fallback (worker mode)
    publishToRedis(runId, orgId, event, data).catch((err) => {
      logger.error({ err, event, runId }, '[RedisEvents] Failed to publish event');
    });
  } else {
    // Neither Socket.IO nor Redis available - log warning
    logger.warn(`[Events] No event transport available for ${event} (run: ${runId})`);
  }
}

// Feature #169: Eagerly initialize test executor emitter at module load time.
// In API server mode, setSocketIO() will re-set this (idempotent).
// In worker mode, setSocketIO() is never called, so this ensures
// the test executor can emit events via Redis Pub/Sub fallback.
setTestExecutorEmitter(emitRunEvent);

/**
 * Wrapper for checkAndSendAlerts that provides testSuites and projects access
 */
async function checkAndSendAlerts(run: TestRun, results: TestRunResult[]): Promise<void> {
  // Convert TestRunResult[] to AlertTestRunResult[]
  const alertResults = results.map(r => ({
    test_id: r.test_id,
    test_name: r.test_name,
    status: r.status,
    error: r.error,
    duration_ms: r.duration_ms,
    passed_on_retry: r.passed_on_retry,
  }));

  // Pre-fetch suite and project data for the run
  const suite = await getTestSuite(run.suite_id);
  const suiteInfo = suite ? { name: suite.name, project_id: suite.project_id } : undefined;
  const project = suiteInfo?.project_id ? await getProject(suiteInfo.project_id) : undefined;
  const projectInfo = project ? { name: project.name } : undefined;

  // Call the base function with pre-fetched data
  await checkAndSendAlertsBase(
    run,
    alertResults,
    () => suiteInfo,
    () => projectInfo
  );
}

/**
 * Phase 2A: Wrap executeTest in a timeout to prevent indefinite hangs.
 * If a single test execution takes longer than PER_TEST_TIMEOUT_MS (default 5 minutes),
 * the promise resolves with an error result instead of hanging forever.
 */
async function executeTestWithTimeout(
  test: ExecuteTestConfig,
  browser: Browser,
  runId: string,
  orgId: string,
  envVars: Record<string, string>,
): Promise<TestRunResult> {
  const timeoutMs = PER_TEST_TIMEOUT_MS;

  return new Promise<TestRunResult>((resolve) => {
    const timer = setTimeout(() => {
      const timeoutMinutes = Math.round(timeoutMs / 60000);
      logger.error({ testId: test.id, testName: test.name, timeoutMs, runId },
        `[TIMEOUT] Test execution timed out after ${timeoutMinutes} minutes`);

      // Emit test-complete with error status so the frontend is notified
      emitRunEvent(runId, orgId, 'test-complete', {
        testId: test.id,
        testName: test.name,
        status: 'error',
        error: `Test execution timed out after ${timeoutMinutes} minutes`,
      });

      resolve({
        test_id: test.id,
        test_name: test.name,
        status: 'error',
        error: `Test execution timed out after ${timeoutMinutes} minutes`,
        duration_ms: timeoutMs,
        steps: [],
      });
    }, timeoutMs);

    executeTest(test, browser, runId, orgId, envVars)
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        logger.error({ err, testId: test.id, runId }, '[TIMEOUT] executeTest threw unexpectedly');
        resolve({
          test_id: test.id,
          test_name: test.name,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown execution error',
          duration_ms: 0,
          steps: [],
        });
      });
  });
}

/**
 * Run tests asynchronously with real-time progress updates
 * This is the main test run orchestration function
 */
export async function runTestsForRun(runId: string) {
  // Try in-memory first (for in-flight runs), then fall back to DB
  const run = testRuns.get(runId) || await getTestRun(runId);
  if (!run) {
    logger.error({ runId }, '[RunOrchestrator] Run not found in memory or database - job will retry');
    throw new Error(`Run ${runId} not found in memory or database`);
  }

  const orgId = run.organization_id;

  // Update status to running
  run.status = 'running';
  run.started_at = new Date();
  setTestRun(runId, run);

  // Persist running status to database
  try {
    await dbUpdateTestRun(runId, { status: 'running', started_at: run.started_at });
  } catch (err) {
    logger.error({ err }, '[RunStart] Failed to persist running status to database');
  }

  // Emit run started event
  emitRunEvent(runId, orgId, 'run-start', {
    status: 'running',
    browser: run.browser,
    started_at: run.started_at.toISOString(),
  });

  // Feature #1283: Send test.run.started webhook
  const suite = await getTestSuite(run.suite_id);
  if (suite) {
    const triggerInfo = {
      type: (run.triggered_by === 'schedule' ? 'scheduled' : run.triggered_by === 'api' ? 'api' : run.triggered_by === 'github' ? 'github_pr' : 'manual') as 'manual' | 'scheduled' | 'api' | 'github_pr',
      triggered_by: run.user_id,
      schedule_id: run.schedule_id,
      pr_number: run.pr_number,
    };
    sendRunStartedWebhook(run, { id: suite.id, name: suite.name, project_id: suite.project_id }, triggerInfo)
      .catch(err => logger.error({ err }, '[WEBHOOK] Error sending run started webhook'));
  }

  let browser: Browser | null = null;
  const results: TestRunResult[] = [];
  let testsToRun: ExecuteTestConfig[] = [];

  // Helper to check if run was cancelled or is being cancelled
  const isCancelled = () => {
    const runState = runningBrowsers.get(runId);
    const currentRun = testRuns.get(runId);
    return runState?.cancelled === true || currentRun?.status === 'cancelling';
  };

  try {
    // Launch browser based on run configuration
    browser = await launchBrowser(run.browser || 'chromium');

    // Register browser for cancellation and pause tracking
    runningBrowsers.set(runId, { browser, cancelled: false, paused: false });

    // Get tests to run
    if (run.test_id) {
      // Running single test
      const test = await getTest(run.test_id);
      if (test) {
        testsToRun = [{
          id: test.id,
          name: test.name,
          steps: test.steps,
          test_type: test.test_type,
          target_url: test.target_url,
          viewport_width: test.viewport_width,
          viewport_height: test.viewport_height,
          capture_mode: test.capture_mode,
          element_selector: test.element_selector,
          wait_for_selector: test.wait_for_selector,
          wait_time: test.wait_time,
          hide_selectors: test.hide_selectors,
          remove_selectors: test.remove_selectors,
          multi_viewport: test.multi_viewport,
          viewports: test.viewports,
          diff_threshold: test.diff_threshold,
          diff_threshold_mode: test.diff_threshold_mode,
          diff_pixel_threshold: test.diff_pixel_threshold,
          ignore_regions: test.ignore_regions,
          ignore_selectors: test.ignore_selectors,
          mask_datetime_selectors: test.mask_datetime_selectors,
          mask_dynamic_content: test.mask_dynamic_content,
          branch: run.branch,
          virtual_users: test.virtual_users,
          duration: test.duration,
          ramp_up_time: test.ramp_up_time,
          k6_script: test.k6_script,
          k6_thresholds: test.k6_thresholds,
          wcag_level: test.wcag_level,
          include_best_practices: test.include_best_practices,
          include_experimental: test.include_experimental,
          include_pa11y: test.include_pa11y,
          disable_javascript: test.disable_javascript,
          a11y_fail_on_any: test.a11y_fail_on_any,
          a11y_fail_on_critical: test.a11y_fail_on_critical,
          a11y_fail_on_serious: test.a11y_fail_on_serious,
          a11y_fail_on_moderate: test.a11y_fail_on_moderate,
          a11y_fail_on_minor: test.a11y_fail_on_minor,
        }];
      }
    } else {
      // Running all tests in suite (or a subset if test_ids specified for rerun)
      let suiteTests = await listTests(run.suite_id);
      if (run.test_ids && Array.isArray(run.test_ids)) {
        const testIdSet = new Set(run.test_ids);
        suiteTests = suiteTests.filter(t => testIdSet.has(t.id));
      }
      testsToRun = suiteTests.map(t => ({
        id: t.id,
        name: t.name,
        steps: t.steps,
        test_type: t.test_type,
        target_url: t.target_url,
        viewport_width: t.viewport_width,
        viewport_height: t.viewport_height,
        capture_mode: t.capture_mode,
        element_selector: t.element_selector,
        wait_for_selector: t.wait_for_selector,
        wait_time: t.wait_time,
        hide_selectors: t.hide_selectors,
        remove_selectors: t.remove_selectors,
        multi_viewport: t.multi_viewport,
        viewports: t.viewports,
        diff_threshold: t.diff_threshold,
        diff_threshold_mode: t.diff_threshold_mode,
        diff_pixel_threshold: t.diff_pixel_threshold,
        ignore_regions: t.ignore_regions,
        ignore_selectors: t.ignore_selectors,
        mask_datetime_selectors: t.mask_datetime_selectors,
        mask_dynamic_content: t.mask_dynamic_content,
        branch: run.branch,
        virtual_users: t.virtual_users,
        duration: t.duration,
        ramp_up_time: t.ramp_up_time,
        k6_script: t.k6_script,
        k6_thresholds: t.k6_thresholds,
        wcag_level: t.wcag_level,
        include_best_practices: t.include_best_practices,
        include_experimental: t.include_experimental,
        include_pa11y: t.include_pa11y,
        disable_javascript: t.disable_javascript,
        a11y_fail_on_any: t.a11y_fail_on_any,
        a11y_fail_on_critical: t.a11y_fail_on_critical,
        a11y_fail_on_serious: t.a11y_fail_on_serious,
        a11y_fail_on_moderate: t.a11y_fail_on_moderate,
        a11y_fail_on_minor: t.a11y_fail_on_minor,
      }));
    }

    // Get suite for retry configuration
    const suiteForRetry = suite || await getTestSuite(run.suite_id);
    const maxRetries = suiteForRetry?.retry_count || 0;

    // Get project environment variables
    const projectId = suite?.project_id;
    const envVarsArray = projectId ? (await getProjectEnvVars(projectId)) || [] : [];
    const envVars: Record<string, string> = {};
    for (const envVar of envVarsArray) {
      envVars[envVar.key] = envVar.value;
    }

    // Feature #894: Merge run-specific environment variables
    if (run.run_env_vars) {
      for (const [key, value] of Object.entries(run.run_env_vars)) {
        envVars[key] = value;
      }
    }

    // Emit total tests info
    emitRunEvent(runId, orgId, 'run-progress', {
      totalTests: testsToRun.length,
      completedTests: 0,
    });

    // Execute each test with retries
    for (let testIndex = 0; testIndex < testsToRun.length; testIndex++) {
      if (isCancelled()) {
        logger.info(`[CANCELLED] Test run ${runId} was cancelled`);
        run.status = 'cancelled';
        break;
      }

      const test = testsToRun[testIndex];
      let result = await executeTestWithTimeout(test, browser, runId, orgId, envVars);
      let retryAttempt = 0;
      let passedOnRetry = false;

      // Retry logic
      while ((result.status === 'failed' || result.status === 'error') && retryAttempt < maxRetries) {
        if (isCancelled()) {
          logger.info(`[CANCELLED] Test run ${runId} was cancelled during retry`);
          run.status = 'cancelled';
          break;
        }

        retryAttempt++;
        logger.info(`[RETRY] Retrying test "${test.name}" (attempt ${retryAttempt}/${maxRetries})`);

        emitRunEvent(runId, orgId, 'test-retry', {
          testId: test.id,
          testName: test.name,
          retryAttempt,
          maxRetries,
        });

        result = await executeTestWithTimeout(test, browser, runId, orgId, envVars);

        if (result.status === 'passed') {
          passedOnRetry = true;
          logger.info(`[RETRY] Test "${test.name}" passed on retry attempt ${retryAttempt}`);
        }
      }

      if (run.status === 'cancelled') break;

      result.retry_count = retryAttempt;
      result.passed_on_retry = passedOnRetry;
      results.push(result);

      emitRunEvent(runId, orgId, 'run-progress', {
        totalTests: testsToRun.length,
        completedTests: testIndex + 1,
        currentTest: test.name,
        lastTestStatus: result.status,
        retryAttempts: retryAttempt,
        passedOnRetry,
      });
    }

    // Determine overall status
    const runStatus = run.status as string;
    if (runStatus !== 'cancelled' && runStatus !== 'cancelling') {
      const hasFailure = results.some(r => r.status === 'failed');
      const hasError = results.some(r => r.status === 'error');
      run.status = hasError ? 'error' : hasFailure ? 'failed' : 'passed';
    } else if (runStatus === 'cancelling') {
      run.status = 'cancelled';
      logger.info(`[CANCELLED] Test run ${runId} transitioned from 'cancelling' to 'cancelled'`);
    }

    run.results = results;
    run.completed_at = new Date();
    run.duration_ms = run.completed_at.getTime() - (run.started_at?.getTime() || run.created_at.getTime());

    // Set test_type and accessibility_results for analytics
    if (testsToRun.length > 0) {
      const firstTest = testsToRun[0];
      run.test_type = firstTest.test_type;

      if (firstTest.test_type === 'accessibility' && results.length > 0) {
        const a11yResult = results[0];
        const a11yStep = a11yResult.steps?.find((s) => s.action === 'axe_core_scan');
        if (a11yStep?.accessibility) {
          run.accessibility_results = a11yStep.accessibility;
        }
      }
    }
  } catch (err) {
    run.status = 'error';
    run.error = err instanceof Error ? err.message : 'Unknown error';
    run.completed_at = new Date();
    run.duration_ms = run.completed_at.getTime() - (run.started_at?.getTime() || run.created_at.getTime());
  } finally {
    // Cleanup
    runningBrowsers.delete(runId);

    if (browser) {
      await browser.close().catch(() => {});
    }
    setTestRun(runId, run);

    // Persist completed run to database (awaited to ensure data is saved)
    try {
      await dbUpdateTestRun(runId, {
        status: run.status,
        started_at: run.started_at,
        completed_at: run.completed_at,
        duration_ms: run.duration_ms,
        results: run.results,
        error: run.error,
        test_type: run.test_type,
        accessibility_results: run.accessibility_results,
      });
    } catch (err) {
      logger.error({ err }, '[RunComplete] Failed to persist completed run to database');
    }

    // Feature #212: Invalidate test run listing caches
    try {
      const cache = getCache();
      await cache.delete(CacheKeys.runs.bySuite(run.suite_id));
      if (run.test_id) {
        await cache.delete(CacheKeys.runs.byTest(run.test_id));
      }
      await cache.invalidate(`runs:list:${orgId}:*`);
    } catch (cacheErr) {
      logger.error({ err: cacheErr }, '[RunComplete] Cache invalidation failed (non-critical)');
    }

    // Emit run complete event
    const testName = testsToRun.length === 1 ? testsToRun[0].name : `${testsToRun.length} tests`;
    emitRunEvent(runId, orgId, 'run-complete', {
      status: run.status,
      duration_ms: run.duration_ms,
      completed_at: run.completed_at?.toISOString(),
      error: run.error,
      passed: run.results?.filter(r => r.status === 'passed').length || 0,
      failed: run.results?.filter(r => r.status === 'failed').length || 0,
      total: run.results?.length || 0,
      testName,
    });

    // Check and send alerts for failed runs
    if (run.status === 'failed' || run.status === 'error') {
      try {
        await checkAndSendAlerts(run, results);
      } catch (alertErr) {
        logger.error({ err: alertErr }, '[ALERT] Error checking/sending alerts');
      }
    }

    // Feature #1284: Send webhooks
    const suiteForWebhook = await getTestSuite(run.suite_id);
    if (suiteForWebhook) {
      sendRunCompletedWebhook(run, { id: suiteForWebhook.id, name: suiteForWebhook.name, project_id: suiteForWebhook.project_id }, results)
        .catch(err => logger.error({ err }, '[WEBHOOK] Error sending run completed webhook'));

      if (run.status === 'failed' || run.status === 'error') {
        sendRunFailedWebhook(run, { id: suiteForWebhook.id, name: suiteForWebhook.name, project_id: suiteForWebhook.project_id }, results)
          .catch(err => logger.error({ err }, '[WEBHOOK] Error sending run failed webhook'));
      }

      if (run.status === 'passed') {
        sendRunPassedWebhook(run, { id: suiteForWebhook.id, name: suiteForWebhook.name, project_id: suiteForWebhook.project_id }, results)
          .catch(err => logger.error({ err }, '[WEBHOOK] Error sending run passed webhook'));
      }

      // Feature #1957: Update test status from 'draft' to 'active'
      // Feature #706: Use batch query to eliminate N+1 database roundtrips
      const testIds = results.map(r => r.test_id);
      const testsMap = await batchGetTests(testIds);

      for (const result of results) {
        const test = testsMap.get(result.test_id);
        if (test && test.status === 'draft') {
          await updateTest(result.test_id, { status: 'active', updated_at: new Date() });
          logger.info(`[STATUS] Test "${test.name}" promoted from draft to active after first run (status: ${result.status})`);
        }
      }
    }
  }
}
