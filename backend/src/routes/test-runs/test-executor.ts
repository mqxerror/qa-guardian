/**
 * Test Executor Module
 * Extracted from test-runs.ts for code organization (Feature #1356)
 *
 * This module contains the main executeTest function and launchBrowser helper.
 * Total: ~4600 lines of test execution logic for all test types:
 * - Visual regression
 * - Lighthouse performance
 * - K6 load testing
 * - Accessibility testing
 * - E2E testing
 */

import { Browser, BrowserContext, BrowserContextOptions, Page, chromium, firefox, webkit } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';
// PNG available from pngjs if needed for visual comparison

// Import types and stores from sibling modules
import {
  BrowserType,
  TestRunStatus,
  TestType,
  ConsoleLog,
  NetworkRequest,
  StepResult,
  TestRunResult,
  TestRun,
  BrowserState,
  testRuns,
  runningBrowsers,
  selectorOverrides,
  healedSelectorHistory,
  VIEWPORT_PRESETS,
  isRunCancelled as isRunCancelledHelper,
  isRunPaused as isRunPausedHelper,
} from './execution.js';

import {
  VisualComparisonResult,
  BaselineMetadata,
  BASELINES_DIR,
  getBaselineMetadataKey,
  setBaselineMetadata,
  getBaselineMetadata,
  addBaselineHistoryEntry,
  getDiffColors,
  getPixelmatchOptions,
  applyIgnoreRegions,
  compareScreenshots,
  getBaselinePath,
  loadBaseline,
  loadBaselineWithValidation,
  hasBaseline,
  saveBaseline as saveBaselineToFile,
  AntiAliasingOptions,
} from './visual-regression.js';

import {
  SCREENSHOTS_DIR,
  TRACES_DIR,
  VIDEOS_DIR,
  StorageQuotaExceededError,
  checkStorageQuota,
  getSimulatedStorageQuotaExceeded,
} from './storage.js';

import {
  getAutoHealThreshold,
  isHealingStrategyEnabled,
  getEnabledStrategies,
  waitForHealingApproval,
  recordSuccessfulHeal,
  trackHealingAttempt,
  trackHealingSuccess,
  trackHealingFailure,
  getSelectorHistory,
  recordHealingEvent,
  PendingHealingApproval,
} from './healing.js';

import {
  simulatedLighthouseError,
  simulatedAuthRedirect,
  simulatedAuditTimeout,
  simulatedLighthouseBrowserCrash,
  simulatedLighthouseNonHtmlResponse,
  simulatedK6RuntimeError,
  simulatedK6ServerUnavailable,
  simulatedK6ResourceExhaustion,
  getSimulatedBrowserCrash,
  setSimulatedBrowserCrash,
  getSimulatedOversizedPage,
  setSimulatedOversizedPage,
  getCrashDumpsDir,
} from './test-simulation.js';

import {
  CrashDumpData,
  ScreenshotUploadConfig,
  ScreenshotCaptureResult,
  DEFAULT_UPLOAD_CONFIG,
  DEFAULT_SCREENSHOT_TIMEOUT,
  MAX_PAGE_HEIGHT_FOR_FULL_CAPTURE,
  MAX_PAGE_WIDTH_FOR_FULL_CAPTURE,
  MAX_ESTIMATED_IMAGE_SIZE_MB,
  findElementByVisualMatch,
  saveCrashDump,
  saveScreenshotWithRetry,
  saveBaselineWithRetry,
  saveBaseline,
  checkPageDimensions,
  captureScreenshotWithTimeout,
  getIgnoreRegionsFromSelectors,
} from './execute-test-helpers.js';

import {
  detectCircularImports,
  validateK6ScriptImports,
  validateK6Thresholds,
  validateK6ScriptSyntax,
  detectRequiredEnvVars,
  detectCustomMetrics,
  generateCustomMetricValues,
} from './k6-helpers.js';

import {
  detectCspIssues,
  detectNonHtmlContent,
  detectLoginPage,
  detectMixedContent,
  runRealLighthouseAudit,
  classifyLighthouseError,
  generateLighthouseErrorMessage,
} from './lighthouse-executor.js';

import {
  DeviceConfig,
  TestDeviceConfig,
  resolveDeviceConfig,
  DEVICE_PRESETS,
} from './device-presets.js';

import {
  calculateA11yScore,
  countViolationsByImpact,
  checkA11yThresholds,
} from './accessibility-helpers.js';

import { getTestSuite, IgnoreRegion } from '../test-suites.js';
import { getProject, getProjectVisualSettings, getProjectHealingSettings } from '../projects.js';

// Import extracted test type executors
import { executeVisualTest, VisualTestConfig, ViewportResult } from './visual-test-executor.js';
import { executeLighthouseTest, LighthouseTestConfig } from './lighthouse-test-executor.js';
import { executeLoadTest, LoadTestConfig, LoadTestResults } from './load-test-executor.js';
import { executeAccessibilityTest, AccessibilityTestConfig } from './accessibility-test-executor.js';
// Feature #249: E2E step executor module (available for future migration)
// The E2E step execution logic below can be migrated to this module
// import { executeE2ESteps, E2EStepExecutionConfig, E2EStepExecutionResult } from './executor-functional.js';

// Feature #448: Use structured logger instead of console.*
import { createLogger } from '../../services/logger.js';

const log = createLogger('test-executor');

// Feature #414: Type for Playwright Request with custom __requestId property
// Used to correlate request/response/failure events during network monitoring
interface PlaywrightRequestWithId {
  __requestId?: string;
}

// Event emitter type - will be passed in from test-runs.ts
export type EmitRunEventFn = (runId: string, orgId: string, event: string, data: Record<string, unknown>) => void;

// Module-level event emitter reference
let emitRunEvent: EmitRunEventFn;

export function setTestExecutorEmitter(emitter: EmitRunEventFn) {
  emitRunEvent = emitter;
}


// Feature #414: Selector strategy for healing fallback
interface SelectorStrategy {
  selector: string;
  strategy: string;
  confidence?: number;
}

// Feature #414: Accessibility result structure for step execution
interface A11yViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  wcagTags: string[];
  nodes: Array<{ html: string; target: string[] }>;
}

// Step-level accessibility results (different from StepResult.accessibility)
interface StepA11yResults {
  wcag_level?: 'A' | 'AA' | 'AAA';
  violations: {
    count: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    items: A11yViolation[];
  };
  config?: Record<string, unknown>;
}

// Feature #414: Extended step interface for test execution
export interface ExecutionStep {
  id: string;
  action: string;
  selector?: string;
  value?: string;
  order?: number;
  optional?: boolean;
  optionalReason?: 'cookie_consent' | 'popup_dismiss' | 'notification_close' | 'user_marked';
  // Healing-related properties
  selectorStrategies?: SelectorStrategy[];
  visualFingerprint?: string;
  // Visual checkpoint properties
  checkpointName?: string;
  checkpointThreshold?: number;
  // Accessibility check properties
  a11y_wcag_level?: 'A' | 'AA' | 'AAA';
  a11y_fail_on_any?: boolean;
  a11y_fail_on_critical?: boolean;
  a11y_threshold?: number;
  // Internal runtime property for storing a11y results
  _a11yResults?: StepA11yResults;
}

// Test configuration type matching runTestsForRun in test-runs.ts
export interface ExecuteTestConfig {
  id: string;
  name: string;
  steps: ExecutionStep[];
  suite_id?: string; // Feature #1059: Required for healing stats tracking
  organization_id?: string; // Organization context for visual comparison
  test_type?: 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility';
  device_preset?: 'mobile' | 'desktop';
  // Feature #36: Full device emulation config
  device_config?: TestDeviceConfig;
  performance_threshold?: number;
  lcp_threshold?: number;
  cls_threshold?: number;
  color_threshold?: number; // Alias for cls_threshold for visual tests
  bypass_csp?: boolean;
  ignore_ssl_errors?: boolean;
  audit_timeout?: number;
  target_url?: string;
  viewport_width?: number;
  viewport_height?: number;
  capture_mode?: 'full_page' | 'viewport' | 'element';
  element_selector?: string;
  wait_for_selector?: string;
  wait_time?: number;
  hide_selectors?: string;
  remove_selectors?: string;
  multi_viewport?: boolean;
  viewports?: string[];
  diff_threshold?: number;
  diff_threshold_mode?: 'percentage' | 'pixel_count';
  diff_pixel_threshold?: number;
  ignore_regions?: IgnoreRegion[];
  ignore_selectors?: string[];
  mask_datetime_selectors?: string;
  mask_dynamic_content?: boolean;
  branch?: string;
  screenshot_timeout?: number; // Timeout for screenshot capture in ms
  anti_aliasing_tolerance?: 'off' | 'low' | 'medium' | 'high'; // Feature #647: Anti-aliasing tolerance
  // K6 Load test fields
  virtual_users?: number;
  duration?: number;
  ramp_up_time?: number;
  k6_script?: string;
  k6_thresholds?: Array<{ metric: string; expression: string; abortOnFail?: boolean; delayAbortEval?: string }>;
  // Accessibility test fields
  wcag_level?: 'A' | 'AA' | 'AAA';
  include_best_practices?: boolean;
  include_experimental?: boolean;
  include_pa11y?: boolean;
  disable_javascript?: boolean;
  a11y_fail_on_any?: boolean;
  a11y_fail_on_critical?: number;
  a11y_fail_on_serious?: number;
  a11y_fail_on_moderate?: number;
  a11y_fail_on_minor?: number;
}

async function executeTest(
  test: ExecuteTestConfig,
  browser: Browser,
  runId: string,
  orgId: string,
  envVars: Record<string, string> = {}
): Promise<TestRunResult> {
  const startTime = Date.now();
  const stepResults: StepResult[] = [];
  // Feature #2053: Added 'warning' status for accessibility tests with violations that don't exceed failure thresholds
  let testStatus: 'passed' | 'failed' | 'error' | 'warning' = 'passed';
  let testError: string | undefined;
  let screenshot_base64: string | undefined;
  let trace_file: string | undefined;

  let context: BrowserContext | null = null;
  let page: Page | null = null;
  const consoleLogs: ConsoleLog[] = [];
  const networkRequests: NetworkRequest[] = [];
  const pendingRequests: Map<string, { timestamp: number; method: string; url: string; resourceType: string; requestHeaders: Record<string, string> }> = new Map();

  // Create trace file name
  const traceFileName = `trace-${runId}-${test.id}-${Date.now()}.zip`;
  const tracePath = path.join(TRACES_DIR, traceFileName);

  // Create video file name
  const videoTimestamp = Date.now();
  const videoFileName = `video-${runId}-${test.id}-${videoTimestamp}.webm`;
  let video_file: string | undefined;

  // Visual comparison variables
  let visualComparison: VisualComparisonResult | undefined;
  let baselineScreenshotBase64: string | undefined;
  let diffImageBase64: string | undefined;
  let diffPercentage: number | undefined;
  // Feature #604: Storage quota exceeded tracking
  let isQuotaExceeded: boolean = false;
  let quotaExceededSuggestions: string[] | undefined;
  // Feature #1913: Multi-viewport results
  let viewportResults: ViewportResult[] | undefined;
  // Feature #1968: Load test results for UI display
  let loadTestResultsData: LoadTestResults | undefined;
  // Store screenshot buffers for baseline comparison (populated during visual regression tests)
  const capturedScreenshotBuffers: Map<string, Buffer> = new Map();
  // Branch for baseline comparison (default to 'main')
  const baselineBranch = test.branch || 'main';

  // Emit test start event
  emitRunEvent(runId, orgId, 'test-start', {
    testId: test.id,
    testName: test.name,
    totalSteps: test.steps.length,
  });

  try {
    // Feature #36: Resolve device config for mobile/tablet emulation
    const deviceConfig = resolveDeviceConfig(test.device_config);

    // Determine viewport size (use device config, test-specific, or default)
    const viewportWidth = test.device_config
      ? deviceConfig.viewport.width
      : (test.viewport_width || 1280);
    const viewportHeight = test.device_config
      ? deviceConfig.viewport.height
      : (test.viewport_height || 720);

    // Log device emulation info
    if (test.device_config) {
      log.info({ testName: test.name, device: deviceConfig.displayName, viewport: { width: viewportWidth, height: viewportHeight }, isMobile: deviceConfig.isMobile, hasTouch: deviceConfig.hasTouch }, 'Device emulation configured');
    }

    // Create a new context with tracing and video recording
    // For Lighthouse tests with ignore_ssl_errors enabled, skip HTTPS certificate validation
    const shouldIgnoreSSL = test.test_type === 'lighthouse' && test.ignore_ssl_errors;
    if (shouldIgnoreSSL) {
      log.warn({ testName: test.name }, 'SSL certificate errors will be ignored (not recommended for production)');
    }

    // Feature #36: Build context options with device emulation
    const contextOptions: BrowserContextOptions = {
      recordVideo: {
        dir: VIDEOS_DIR,
        size: { width: viewportWidth, height: viewportHeight },
      },
      viewport: { width: viewportWidth, height: viewportHeight },
      ignoreHTTPSErrors: shouldIgnoreSSL,
    };

    // Apply device emulation settings if configured
    if (test.device_config) {
      contextOptions.userAgent = deviceConfig.userAgent;
      contextOptions.deviceScaleFactor = deviceConfig.deviceScaleFactor;
      contextOptions.isMobile = deviceConfig.isMobile;
      contextOptions.hasTouch = deviceConfig.hasTouch;
    }

    context = await browser.newContext(contextOptions);

    // Start tracing before any page actions
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

    page = await context.newPage();

    // Capture console logs from the page
    page.on('console', (msg) => {
      const msgType = msg.type();
      // Playwright uses 'warning' but we normalize to 'warn' for display
      const level = (msgType === 'warning' ? 'warn' : msgType) as ConsoleLog['level'];
      // Only capture supported log levels
      if (['log', 'info', 'warn', 'error', 'debug'].includes(level)) {
        consoleLogs.push({
          timestamp: Date.now(),
          level,
          message: msg.text(),
          location: page?.url(),
        });
      }
    });

    // Capture network requests
    page.on('request', (request) => {
      const requestId = `${request.method()}-${request.url()}-${Date.now()}`;
      pendingRequests.set(requestId, {
        timestamp: Date.now(),
        method: request.method(),
        url: request.url(),
        resourceType: request.resourceType(),
        requestHeaders: request.headers(),
      });
      // Store the requestId on the request for later lookup
      (request as PlaywrightRequestWithId).__requestId = requestId;
    });

    page.on('response', async (response) => {
      const request = response.request();
      const requestId = (request as PlaywrightRequestWithId).__requestId;
      const pending = requestId ? pendingRequests.get(requestId) : null;

      if (pending && requestId) {
        pendingRequests.delete(requestId);
        let responseSize = 0;
        try {
          const body = await response.body();
          responseSize = body.length;
        } catch {
          // Response body may not be available for all requests
        }

        networkRequests.push({
          timestamp: pending.timestamp,
          method: pending.method,
          url: pending.url,
          resourceType: pending.resourceType,
          status: response.status(),
          statusText: response.statusText(),
          duration_ms: Date.now() - pending.timestamp,
          requestHeaders: pending.requestHeaders,
          responseHeaders: response.headers(),
          responseSize,
        });
      }
    });

    page.on('requestfailed', (request) => {
      const requestId = (request as PlaywrightRequestWithId).__requestId;
      const pending = requestId ? pendingRequests.get(requestId) : null;

      if (pending && requestId) {
        pendingRequests.delete(requestId);
        networkRequests.push({
          timestamp: pending.timestamp,
          method: pending.method,
          url: pending.url,
          resourceType: pending.resourceType,
          duration_ms: Date.now() - pending.timestamp,
          requestHeaders: pending.requestHeaders,
          failed: true,
          failureText: request.failure()?.errorText,
        });
      }
    });

    // Inject environment variables into the page context for test use
    // Environment variables are available via window.__QA_ENV__ in the browser
    if (Object.keys(envVars).length > 0) {
      await page.addInitScript((vars) => {
        // Feature #414: Using globalThis for type-safe window property assignment
        (globalThis as { __QA_ENV__?: Record<string, string> }).__QA_ENV__ = vars;
      }, envVars);
    }


    // Handle visual regression test type specially
    // Extracted to visual-test-executor.ts for code organization (Feature #1356)
    if (test.test_type === 'visual_regression' && test.target_url) {
      const visualResult = await executeVisualTest(
        {
          id: test.id,
          name: test.name,
          suite_id: test.suite_id,
          organization_id: test.organization_id,
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
          branch: test.branch,
          screenshot_timeout: test.screenshot_timeout,
          anti_aliasing_tolerance: test.anti_aliasing_tolerance,
          color_threshold: test.color_threshold,
        },
        {
          page: page!,
          browser,
          runId,
          orgId,
          emitRunEvent,
        }
      );

      // Apply results from visual test executor
      testStatus = visualResult.testStatus;
      testError = visualResult.testError;
      stepResults.push(...visualResult.stepResults);
      if (visualResult.screenshot_base64) {
        screenshot_base64 = visualResult.screenshot_base64;
      }
      if (visualResult.visualComparison) {
        visualComparison = visualResult.visualComparison;
      }
      if (visualResult.baselineScreenshotBase64) {
        baselineScreenshotBase64 = visualResult.baselineScreenshotBase64;
      }
      if (visualResult.diffImageBase64) {
        diffImageBase64 = visualResult.diffImageBase64;
      }
      if (visualResult.diffPercentage !== undefined) {
        diffPercentage = visualResult.diffPercentage;
      }
      if (visualResult.isQuotaExceeded) {
        isQuotaExceeded = visualResult.isQuotaExceeded;
      }
      // Feature #1913: Multi-viewport results
      if (visualResult.viewportResults) {
        viewportResults = visualResult.viewportResults;
      }
    } else if (test.test_type === 'lighthouse' && test.target_url) {
      // Lighthouse performance audit
      // Extracted to lighthouse-test-executor.ts for code organization (Feature #1356)
      const lighthouseResult = await executeLighthouseTest(
        {
          id: test.id,
          name: test.name,
          target_url: test.target_url,
          device_preset: test.device_preset,
          performance_threshold: test.performance_threshold,
          lcp_threshold: test.lcp_threshold,
          cls_threshold: test.cls_threshold,
          bypass_csp: test.bypass_csp,
          ignore_ssl_errors: test.ignore_ssl_errors,
          audit_timeout: test.audit_timeout,
        },
        {
          page: page!,
          browser,
          runId,
          orgId,
          emitRunEvent,
        }
      );

      // Apply results from lighthouse test executor
      testStatus = lighthouseResult.testStatus;
      testError = lighthouseResult.testError;
      stepResults.push(...lighthouseResult.stepResults);
      if (lighthouseResult.screenshot_base64) {
        screenshot_base64 = lighthouseResult.screenshot_base64;
      }
      // Store lighthouse results in test run data
      const run = testRuns.get(runId);
      if (run && lighthouseResult.lighthouseResults) {
        run.lighthouseResults = lighthouseResult.lighthouseResults as unknown as Record<string, unknown>;
      }
    } else if (test.test_type === 'load' && test.target_url) {
      // K6 Load Test execution
      // Extracted to load-test-executor.ts for code organization (Feature #1356)
      const loadResult = await executeLoadTest(
        {
          id: test.id,
          name: test.name,
          target_url: test.target_url,
          virtual_users: test.virtual_users,
          duration: test.duration,
          ramp_up_time: test.ramp_up_time,
          k6_script: test.k6_script,
          k6_thresholds: test.k6_thresholds,
        },
        {
          page: page!,
          browser,
          runId,
          orgId,
          emitRunEvent,
        }
      );

      // Apply results from load test executor
      testStatus = loadResult.testStatus;
      testError = loadResult.testError;
      stepResults.push(...loadResult.stepResults);
      // Feature #1968: Store load test results for UI display
      if (loadResult.loadTestResults) {
        loadTestResultsData = loadResult.loadTestResults;
      }
      // Store load test results in test run data
      const loadRun = testRuns.get(runId);
      if (loadRun && loadResult.loadTestResults) {
        loadRun.loadTestResults = loadResult.loadTestResults as Record<string, unknown>;
      }
    } else if (test.test_type === 'accessibility' && test.target_url) {
      // Accessibility Test execution
      // Extracted to accessibility-test-executor.ts for code organization (Feature #1356)
      const a11yResult = await executeAccessibilityTest(
        {
          id: test.id,
          name: test.name,
          target_url: test.target_url,
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
        },
        {
          page: page!,
          browser,
          runId,
          orgId,
          emitRunEvent,
        }
      );

      // Apply results from accessibility test executor
      testStatus = a11yResult.testStatus;
      testError = a11yResult.testError;
      stepResults.push(...a11yResult.stepResults);
      if (a11yResult.screenshot_base64) {
        screenshot_base64 = a11yResult.screenshot_base64;
      }
      // Store accessibility results in test run data
      const a11yRun = testRuns.get(runId);
      if (a11yRun && a11yResult.a11yResults) {
        a11yRun.a11yResults = a11yResult.a11yResults as unknown as Record<string, unknown>;
      }
    } else {
      // Standard E2E test execution - execute each step
      for (let stepIndex = 0; stepIndex < test.steps.length; stepIndex++) {
      const step = test.steps[stepIndex];
      const stepStart = Date.now();
      let stepStatus: 'passed' | 'failed' | 'skipped' = 'passed';
      let stepError: string | undefined;

      // Emit step start event
      emitRunEvent(runId, orgId, 'step-start', {
        testId: test.id,
        stepIndex,
        stepId: step.id,
        action: step.action,
        selector: step.selector,
        value: step.value,
        optional: step.optional, // Feature #37: Include optional flag
      });

      // Feature #37: Determine timeout for optional vs required steps
      // Optional steps use 2s timeout, required steps use 10s
      const isOptionalStep = step.optional === true;
      const stepTimeout = isOptionalStep ? 2000 : 10000;

      try {
        switch (step.action) {
          case 'navigate':
            // Feature #1886: Increase navigation timeout to 30s (was 10s) to support slower sites
            await page.goto(step.value || 'about:blank', { waitUntil: 'domcontentloaded', timeout: 30000 });
            break;
          case 'click':
            if (step.selector) {
              try {
                await page.click(step.selector, { timeout: stepTimeout });
                // Feature #38: Wait for network idle after click to ensure AJAX completes (e.g., add-to-cart)
                try {
                  await page.waitForLoadState('networkidle', { timeout: 3000 });
                } catch { /* Ignore timeout - some clicks don't trigger AJAX */ }
              } catch (clickErr: unknown) {
                // Feature #719: Type-narrow the unknown error to extract message
                const clickErrMsg = clickErr instanceof Error ? clickErr.message : String(clickErr);
                // Feature #1052: Detect element not found and initiate healing
                if (clickErrMsg.includes('strict mode') || clickErrMsg.includes('not found') ||
                    clickErrMsg.includes('timeout') || clickErrMsg.includes('waiting for')) {
                  log.info({ selector: step.selector, action: 'click' }, 'Element not found, initiating healing');

                  // Feature #1059: Get project ID for stats tracking
                  const healingSuite = test.suite_id ? await getTestSuite(test.suite_id) : undefined;
                  const healingProjectId = healingSuite?.project_id || null;

                  // Feature #1059: Track healing attempt
                  trackHealingAttempt(healingProjectId);

                  // Log the healing attempt initiation
                  const healingAttempt = {
                    timestamp: new Date().toISOString(),
                    test_id: test.id,
                    run_id: runId,
                    step_index: stepIndex,
                    original_selector: step.selector,
                    error_type: 'element_not_found',
                    error_message: clickErrMsg,
                    alt_selectors: step.selectorStrategies || [],
                    healing_initiated: true,
                  };
                  log.debug({ healingAttempt }, 'Healing attempt recorded for click');

                  // Try alternate selectors if available
                  // Feature #1055: Only auto-apply healing if confidence >= threshold
                  // Feature #1062: Use project-specific threshold
                  // Feature #1063: Only use enabled healing strategies
                  const projectAutoHealThreshold = await getAutoHealThreshold(healingProjectId);
                  const enabledStrategies = await getEnabledStrategies(healingProjectId);
                  log.debug({ projectId: healingProjectId, threshold: projectAutoHealThreshold, enabledStrategies }, 'Healing configuration loaded');
                  const altSelectors = step.selectorStrategies?.filter((s: SelectorStrategy) => s.selector !== step.selector) || [];
                  let healed = false;
                  for (const alt of altSelectors.sort((a: SelectorStrategy, b: SelectorStrategy) => (b.confidence ?? 0) - (a.confidence ?? 0))) {
                    // Skip visual-match strategy in this loop - try it last
                    if (alt.strategy === 'visual-match') continue;
                    // Feature #1063: Skip if strategy is disabled for this project
                    if (!(await isHealingStrategyEnabled(healingProjectId, alt.strategy))) {
                      log.debug({ strategy: alt.strategy }, 'Skipping disabled healing strategy');
                      continue;
                    }
                    // Feature #1055/#1062: Skip if confidence below project's auto-heal threshold
                    const altConfidence = alt.confidence ?? 0;
                    if (altConfidence < projectAutoHealThreshold) {
                      log.debug({ strategy: alt.strategy, confidence: altConfidence, threshold: projectAutoHealThreshold }, 'Skipping healing strategy below threshold');
                      continue;
                    }
                    try {
                      log.debug({ selector: alt.selector, confidence: alt.confidence }, 'Trying alternate selector');
                      await page.click(alt.selector, { timeout: 5000 });
                      // Feature #38: Wait for network idle after healing click
                      try {
                        await page.waitForLoadState('networkidle', { timeout: 3000 });
                      } catch { /* Ignore timeout */ }
                      log.info({ strategy: alt.strategy, selector: alt.selector, threshold: projectAutoHealThreshold }, 'Healing succeeded with auto-apply');
                      // Feature #1057: Record successful heal for test update
                      recordSuccessfulHeal(runId, test.id, stepIndex, step.selector, alt.selector, alt.strategy, altConfidence, orgId);
                      // Feature #1059: Track successful heal
                      trackHealingSuccess(healingProjectId, alt.strategy);
                      healed = true;
                      break;
                    } catch (altErr) {
                      log.debug({ strategy: alt.strategy, selector: alt.selector }, 'Healing attempt failed');
                    }
                  }

                  // Feature #1054: Try visual matching as last resort
                  // Feature #1063: Only try if visual_match strategy is enabled
                  if (!healed && (await isHealingStrategyEnabled(healingProjectId, 'visual-match'))) {
                    const visualFingerprint = step.visualFingerprint;
                    if (visualFingerprint) {
                      log.debug('All selectors failed or below threshold, attempting visual matching');
                      const visualMatch = await findElementByVisualMatch(page, visualFingerprint);
                      // Feature #1055/#1062: Check if visual match confidence meets project's auto-heal threshold
                      if (visualMatch.found && visualMatch.matchLocation && visualMatch.confidence >= projectAutoHealThreshold) {
                        log.info({ confidence: visualMatch.confidence * 100, threshold: projectAutoHealThreshold * 100 }, 'Visual match found and auto-applied');
                        log.debug({ x: visualMatch.matchLocation.x, y: visualMatch.matchLocation.y }, 'Visual match element location');
                        // Click at the center of the matched region
                        const centerX = visualMatch.matchLocation.x + visualMatch.matchLocation.width / 2;
                        const centerY = visualMatch.matchLocation.y + visualMatch.matchLocation.height / 2;
                        await page.mouse.click(centerX, centerY);
                        // Feature #38: Wait for network idle after visual match click
                        try {
                          await page.waitForLoadState('networkidle', { timeout: 3000 });
                        } catch { /* Ignore timeout */ }
                        log.info({ x: centerX, y: centerY }, 'Healing succeeded with visual-match click');
                        // Feature #1057: Record successful visual heal for test update
                        recordSuccessfulHeal(runId, test.id, stepIndex, step.selector, `visual-match:${visualFingerprint}`, 'visual-match', visualMatch.confidence, orgId);
                        // Feature #1059: Track successful visual heal
                        trackHealingSuccess(healingProjectId, 'visual-match');
                        healed = true;
                      } else if (visualMatch.found && visualMatch.matchLocation) {
                        // Feature #1056: Found but below threshold - require manual approval
                        log.info({ confidence: visualMatch.confidence * 100, threshold: projectAutoHealThreshold * 100 }, 'Visual match below threshold - waiting for approval');

                        const approvalId = `heal-${runId}-${test.id}-${stepIndex}-${Date.now()}`;
                        const pendingApproval: PendingHealingApproval = {
                          id: approvalId,
                          runId,
                          testId: test.id,
                          stepIndex,
                          originalSelector: step.selector,
                          suggestedSelector: `visual-match:${visualFingerprint}`,
                          strategy: 'visual-match',
                          confidence: visualMatch.confidence,
                          visualMatchLocation: visualMatch.matchLocation,
                          timestamp: new Date().toISOString(),
                          status: 'pending',
                        };

                        const approved = await waitForHealingApproval(pendingApproval, orgId);
                        if (approved) {
                          const centerX = visualMatch.matchLocation.x + visualMatch.matchLocation.width / 2;
                          const centerY = visualMatch.matchLocation.y + visualMatch.matchLocation.height / 2;
                          await page.mouse.click(centerX, centerY);
                          // Feature #38: Wait for network idle after approved visual match click
                          try {
                            await page.waitForLoadState('networkidle', { timeout: 3000 });
                          } catch { /* Ignore timeout */ }
                          log.info({ x: centerX, y: centerY }, 'Visual-match healing approved');
                          // Feature #1057: Record approved heal for test update
                          recordSuccessfulHeal(runId, test.id, stepIndex, step.selector, `visual-match:${visualFingerprint}`, 'visual-match', visualMatch.confidence, orgId);
                          // Feature #1059: Track approved visual heal
                          trackHealingSuccess(healingProjectId, 'visual-match');
                          healed = true;
                        } else {
                          log.info('Visual-match healing rejected or timed out');
                        }
                      } else {
                        log.debug({ confidence: visualMatch.confidence * 100 }, 'Visual match failed');
                      }
                    }
                  }

                  if (!healed) {
                    // Feature #37: For optional steps, skip instead of failing
                    if (isOptionalStep) {
                      log.debug({ selector: step.selector, reason: step.optionalReason || 'user_marked' }, 'Optional step skipped');
                      stepStatus = 'skipped';
                      stepError = `Optional element not found: ${step.selector}`;
                      break; // Exit switch statement without throwing
                    }
                    // Feature #1059: Track failed heal
                    trackHealingFailure(healingProjectId);
                    throw clickErr;
                  }
                } else {
                  // Feature #37: For optional steps, skip instead of failing
                  if (isOptionalStep) {
                    log.debug({ selector: step.selector, reason: step.optionalReason || 'user_marked' }, 'Optional step skipped');
                    stepStatus = 'skipped';
                    stepError = `Optional element not found: ${step.selector}`;
                    break; // Exit switch statement without throwing
                  }
                  throw clickErr;
                }
              }
            }
            break;
          case 'fill':
          case 'type':
            if (step.selector && step.value) {
              try {
                await page.fill(step.selector, step.value, { timeout: stepTimeout });
              } catch (fillErr: unknown) {
                // Feature #719: Type-narrow the unknown error to extract message
                const fillErrMsg = fillErr instanceof Error ? fillErr.message : String(fillErr);
                // Feature #1052: Detect element not found and initiate healing
                if (fillErrMsg.includes('strict mode') || fillErrMsg.includes('not found') ||
                    fillErrMsg.includes('timeout') || fillErrMsg.includes('waiting for')) {
                  log.info({ selector: step.selector, action: 'fill' }, 'Element not found, initiating healing for fill');

                  // Feature #1059: Get project ID for stats tracking
                  const fillHealingSuite = test.suite_id ? await getTestSuite(test.suite_id) : undefined;
                  const fillHealingProjectId = fillHealingSuite?.project_id || null;

                  // Feature #1059: Track healing attempt
                  trackHealingAttempt(fillHealingProjectId);

                  const healingAttempt = {
                    timestamp: new Date().toISOString(),
                    test_id: test.id,
                    run_id: runId,
                    step_index: stepIndex,
                    original_selector: step.selector,
                    error_type: 'element_not_found',
                    error_message: fillErrMsg,
                    alt_selectors: step.selectorStrategies || [],
                    healing_initiated: true,
                  };
                  log.debug({ healingAttempt }, 'Healing attempt recorded for fill');

                  // Try alternate selectors if available
                  // Feature #1055: Only auto-apply healing if confidence >= threshold
                  // Feature #1062: Use project-specific threshold
                  // Feature #1063: Only use enabled healing strategies
                  const fillProjectThreshold = await getAutoHealThreshold(fillHealingProjectId);
                  const fillEnabledStrategies = await getEnabledStrategies(fillHealingProjectId);
                  log.debug({ projectId: fillHealingProjectId, threshold: fillProjectThreshold, enabledStrategies: fillEnabledStrategies }, 'Healing configuration for fill');
                  const fillAltSelectors = step.selectorStrategies?.filter((s: SelectorStrategy) => s.selector !== step.selector) || [];
                  let fillHealed = false;
                  for (const alt of fillAltSelectors.sort((a: SelectorStrategy, b: SelectorStrategy) => (b.confidence ?? 0) - (a.confidence ?? 0))) {
                    // Skip visual-match strategy in this loop - try it last
                    if (alt.strategy === 'visual-match') continue;
                    // Feature #1063: Skip if strategy is disabled for this project
                    if (!(await isHealingStrategyEnabled(fillHealingProjectId, alt.strategy))) {
                      log.debug({ strategy: alt.strategy }, 'Skipping disabled healing strategy');
                      continue;
                    }
                    // Feature #1055/#1062: Skip if confidence below project's auto-heal threshold
                    const fillAltConfidence = alt.confidence ?? 0;
                    if (fillAltConfidence < fillProjectThreshold) {
                      log.debug({ strategy: alt.strategy, confidence: fillAltConfidence, threshold: fillProjectThreshold }, 'Skipping fill healing strategy below threshold');
                      continue;
                    }
                    try {
                      log.debug({ selector: alt.selector, confidence: fillAltConfidence }, 'Trying alternate fill selector');
                      await page.fill(alt.selector, step.value!, { timeout: 5000 });
                      log.info({ strategy: alt.strategy, selector: alt.selector, threshold: fillProjectThreshold }, 'Fill healing succeeded with auto-apply');
                      // Feature #1057: Record successful fill heal for test update
                      recordSuccessfulHeal(runId, test.id, stepIndex, step.selector, alt.selector, alt.strategy, fillAltConfidence, orgId);
                      // Feature #1059: Track successful fill heal
                      trackHealingSuccess(fillHealingProjectId, alt.strategy);
                      fillHealed = true;
                      break;
                    } catch (altErr) {
                      log.debug({ strategy: alt.strategy, selector: alt.selector }, 'Healing attempt failed');
                    }
                  }

                  // Feature #1054: Try visual matching as last resort for fill
                  // Feature #1063: Only try if visual_match strategy is enabled
                  if (!fillHealed && (await isHealingStrategyEnabled(fillHealingProjectId, 'visual-match'))) {
                    const fillVisualFingerprint = step.visualFingerprint;
                    if (fillVisualFingerprint) {
                      log.debug('All fill selectors failed, attempting visual matching');
                      const fillVisualMatch = await findElementByVisualMatch(page, fillVisualFingerprint);
                      // Feature #1055/#1062: Check if visual match confidence meets project's auto-heal threshold
                      if (fillVisualMatch.found && fillVisualMatch.matchLocation && fillVisualMatch.confidence >= fillProjectThreshold) {
                        log.info({ confidence: fillVisualMatch.confidence * 100, threshold: fillProjectThreshold * 100 }, 'Fill visual match found and auto-applied');
                        // Click at the center of the matched region to focus, then type
                        const fillCenterX = fillVisualMatch.matchLocation.x + fillVisualMatch.matchLocation.width / 2;
                        const fillCenterY = fillVisualMatch.matchLocation.y + fillVisualMatch.matchLocation.height / 2;
                        await page.mouse.click(fillCenterX, fillCenterY);
                        await page.keyboard.type(step.value!);
                        log.info({ x: fillCenterX, y: fillCenterY }, 'Fill healing succeeded with visual-match');
                        // Feature #1057: Record successful visual fill heal for test update
                        recordSuccessfulHeal(runId, test.id, stepIndex, step.selector, `visual-match:${fillVisualFingerprint}`, 'visual-match', fillVisualMatch.confidence, orgId);
                        // Feature #1059: Track successful visual fill heal
                        trackHealingSuccess(fillHealingProjectId, 'visual-match');
                        fillHealed = true;
                      } else if (fillVisualMatch.found && fillVisualMatch.matchLocation) {
                        // Feature #1056: Found but below threshold - require manual approval
                        log.info({ confidence: fillVisualMatch.confidence * 100, threshold: fillProjectThreshold * 100 }, 'Fill visual match below threshold - waiting for approval');

                        const fillApprovalId = `heal-${runId}-${test.id}-${stepIndex}-fill-${Date.now()}`;
                        const fillPendingApproval: PendingHealingApproval = {
                          id: fillApprovalId,
                          runId,
                          testId: test.id,
                          stepIndex,
                          originalSelector: step.selector,
                          suggestedSelector: `visual-match:${fillVisualFingerprint}`,
                          strategy: 'visual-match',
                          confidence: fillVisualMatch.confidence,
                          visualMatchLocation: fillVisualMatch.matchLocation,
                          timestamp: new Date().toISOString(),
                          status: 'pending',
                        };

                        const fillApproved = await waitForHealingApproval(fillPendingApproval, orgId);
                        if (fillApproved) {
                          const fillCenterX = fillVisualMatch.matchLocation.x + fillVisualMatch.matchLocation.width / 2;
                          const fillCenterY = fillVisualMatch.matchLocation.y + fillVisualMatch.matchLocation.height / 2;
                          await page.mouse.click(fillCenterX, fillCenterY);
                          await page.keyboard.type(step.value!);
                          log.info({ x: fillCenterX, y: fillCenterY }, 'Fill visual-match healing approved');
                          // Feature #1057: Record approved fill heal for test update
                          recordSuccessfulHeal(runId, test.id, stepIndex, step.selector, `visual-match:${fillVisualFingerprint}`, 'visual-match', fillVisualMatch.confidence, orgId);
                          // Feature #1059: Track approved visual fill heal
                          trackHealingSuccess(fillHealingProjectId, 'visual-match');
                          fillHealed = true;
                        } else {
                          log.info('Fill visual-match healing rejected or timed out');
                        }
                      } else {
                        log.debug({ confidence: fillVisualMatch.confidence * 100 }, 'Fill visual match failed');
                      }
                    }
                  }

                  if (!fillHealed) {
                    // Feature #37: For optional steps, skip instead of failing
                    if (isOptionalStep) {
                      log.debug({ selector: step.selector, reason: step.optionalReason || 'user_marked' }, 'Optional fill step skipped');
                      stepStatus = 'skipped';
                      stepError = `Optional element not found: ${step.selector}`;
                      break; // Exit switch statement without throwing
                    }
                    // Feature #1059: Track failed fill heal
                    trackHealingFailure(fillHealingProjectId);
                    throw fillErr;
                  }
                } else {
                  // Feature #37: For optional steps, skip instead of failing
                  if (isOptionalStep) {
                    log.debug({ selector: step.selector, reason: step.optionalReason || 'user_marked' }, 'Optional fill step skipped');
                    stepStatus = 'skipped';
                    stepError = `Optional element not found: ${step.selector}`;
                    break; // Exit switch statement without throwing
                  }
                  throw fillErr;
                }
              }
            }
            break;
          case 'wait':
            await page.waitForTimeout(parseInt(step.value || '1000', 10));
            break;
          case 'assert_text':
            if (step.value) {
              await page.waitForSelector(`text=${step.value}`, { timeout: 10000 });
            }
            break;
          case 'screenshot': {
            // Take screenshot and store
            const buffer = await page.screenshot();
            screenshot_base64 = buffer.toString('base64');
            break;
          }
          case 'visual_checkpoint': {
            // Take screenshot and compare against checkpoint baseline
            const checkpointBuffer = await page.screenshot();
            screenshot_base64 = checkpointBuffer.toString('base64');

            // Get checkpoint configuration
            const checkpointName = step.checkpointName || `checkpoint-${stepIndex}`;
            const checkpointThreshold = step.checkpointThreshold ?? 0.1;

            // Try to find baseline for this checkpoint
            const checkpointBaselineKey = `${test.id}-${checkpointName}`;
            const checkpointBaselinePath = path.join(BASELINES_DIR, `${checkpointBaselineKey}.png`);

            if (fs.existsSync(checkpointBaselinePath)) {
              // Compare with existing baseline
              const checkpointBaseline = fs.readFileSync(checkpointBaselinePath);
              // Feature #647: Use anti-aliasing tolerance for checkpoint comparisons
              const checkpointAaOptions: AntiAliasingOptions = {
                tolerance: test.anti_aliasing_tolerance ?? 'off',
                colorThreshold: test.color_threshold,
              };
              const checkpointComparison = await compareScreenshots(
                checkpointBaseline,
                checkpointBuffer,
                undefined,
                test.organization_id,
                checkpointAaOptions
              );

              if (checkpointComparison.diffPercentage !== undefined && checkpointComparison.diffPercentage > checkpointThreshold) {
                stepStatus = 'failed';
                stepError = `Visual checkpoint "${checkpointName}" failed: ${checkpointComparison.diffPercentage.toFixed(2)}% difference (threshold: ${checkpointThreshold}%)`;
                testStatus = 'failed';
                testError = stepError;

                // Store diff image for review
                if (checkpointComparison.diffImage) {
                  diffImageBase64 = checkpointComparison.diffImage; // Already base64 encoded
                }
                baselineScreenshotBase64 = checkpointBaseline.toString('base64');
              } else {
                // Checkpoint passed
                log.info({ checkpoint: checkpointName, diffPercentage: checkpointComparison.diffPercentage ?? 0 }, 'Visual checkpoint passed');
              }
            } else {
              // No baseline exists, create one
              fs.mkdirSync(BASELINES_DIR, { recursive: true });
              fs.writeFileSync(checkpointBaselinePath, checkpointBuffer);
              log.info({ checkpoint: checkpointName }, 'Created baseline for visual checkpoint');
            }
            break;
          }
          case 'accessibility_check': {
            // Run real axe-core accessibility scan at this step in the E2E test
            const a11yStepConfig = {
              wcagLevel: step.a11y_wcag_level || 'AA',
              failOnAny: step.a11y_fail_on_any === true,
              failOnCritical: step.a11y_fail_on_critical !== false, // Default true
              threshold: step.a11y_threshold || 0,
            };

            log.debug({ config: a11yStepConfig }, 'Running axe-core accessibility scan');

            // Take screenshot before the scan
            const a11yScreenshot = await page.screenshot();
            screenshot_base64 = a11yScreenshot.toString('base64');

            // Build WCAG tags for this step's scan
            const stepAxeTags: string[] = ['wcag2a', 'wcag21a'];
            if (a11yStepConfig.wcagLevel === 'AA' || a11yStepConfig.wcagLevel === 'AAA') {
              stepAxeTags.push('wcag2aa', 'wcag21aa');
            }
            if (a11yStepConfig.wcagLevel === 'AAA') {
              stepAxeTags.push('wcag2aaa', 'wcag21aaa');
            }

            // Run real axe-core scan
            const stepAxeResults = await new AxeBuilder({ page })
              .withTags(stepAxeTags)
              .analyze();

            // Map real violations to the expected format
            const stepViolations = stepAxeResults.violations.map(v => ({
              id: v.id,
              impact: (v.impact || 'minor') as 'critical' | 'serious' | 'moderate' | 'minor',
              description: v.description,
              wcagTags: v.tags,
              nodes: v.nodes.map(n => ({
                html: n.html,
                target: n.target as string[],
              })),
            }));

            // Determine if step should fail based on configuration
            const criticalOrSeriousViolations = stepViolations.filter(v => v.impact === 'critical' || v.impact === 'serious').length;
            const totalStepViolations = stepViolations.length;

            let stepShouldFail = false;
            let a11yStepFailReason = '';

            if (a11yStepConfig.failOnAny && totalStepViolations > 0) {
              stepShouldFail = true;
              a11yStepFailReason = `Found ${totalStepViolations} accessibility violation(s) (fail-on-any mode)`;
            } else if (a11yStepConfig.failOnCritical && criticalOrSeriousViolations > 0) {
              stepShouldFail = true;
              a11yStepFailReason = `Found ${criticalOrSeriousViolations} critical/serious accessibility violation(s)`;
            } else if (a11yStepConfig.threshold > 0 && totalStepViolations > a11yStepConfig.threshold) {
              stepShouldFail = true;
              a11yStepFailReason = `Found ${totalStepViolations} violations, exceeds threshold of ${a11yStepConfig.threshold}`;
            } else if (a11yStepConfig.threshold === 0 && totalStepViolations > 0) {
              stepShouldFail = true;
              a11yStepFailReason = `Found ${totalStepViolations} accessibility violation(s) (zero tolerance threshold)`;
            }

            // Store accessibility results (will be added to stepResult after creation)
            step._a11yResults = {
              wcag_level: a11yStepConfig.wcagLevel,
              violations: {
                count: totalStepViolations,
                critical: stepViolations.filter(v => v.impact === 'critical').length,
                serious: stepViolations.filter(v => v.impact === 'serious').length,
                moderate: stepViolations.filter(v => v.impact === 'moderate').length,
                minor: stepViolations.filter(v => v.impact === 'minor').length,
                items: stepViolations,
              },
              config: a11yStepConfig,
            };

            if (stepShouldFail) {
              stepStatus = 'failed';
              stepError = `Accessibility check failed: ${a11yStepFailReason}`;
              testStatus = 'failed';
              testError = stepError;
              log.info({ reason: a11yStepFailReason }, 'Accessibility check step failed');
            } else {
              log.info({ violations: totalStepViolations }, 'Accessibility check step passed (within threshold)');
            }
            break;
          }
          case 'assert_no_console_errors': {
            // Feature #1973: Check for console errors captured during test execution
            // Filter console logs for errors only
            const severityLevel = step.value || 'error'; // Default to 'error', can be 'critical' (error only) or 'warn' (error + warn)
            let consoleErrors: typeof consoleLogs = [];

            if (severityLevel === 'critical') {
              // Only check for error-level console messages
              consoleErrors = consoleLogs.filter(log => log.level === 'error');
            } else if (severityLevel === 'warn') {
              // Check for both errors and warnings
              consoleErrors = consoleLogs.filter(log => log.level === 'error' || log.level === 'warn');
            } else {
              // Default: only error level
              consoleErrors = consoleLogs.filter(log => log.level === 'error');
            }

            if (consoleErrors.length > 0) {
              stepStatus = 'failed';
              const errorMessages = consoleErrors.map(e => `[${e.level}] ${e.message.substring(0, 100)}`).join('; ');
              stepError = `Found ${consoleErrors.length} console error(s): ${errorMessages}`;
              testStatus = 'failed';
              testError = stepError;
              log.info({ errorCount: consoleErrors.length }, 'Console errors check failed');
            } else {
              log.debug({ severity: severityLevel }, 'Console errors check passed - no errors detected');
            }
            break;
          }
          default:
            // Unknown action, skip
            stepStatus = 'skipped';
        }
      } catch (err) {
        stepStatus = 'failed';
        stepError = err instanceof Error ? err.message : 'Unknown error';
        testStatus = 'failed';
        testError = `Step "${step.action}" failed: ${stepError}`;
      }

      const stepResult: StepResult = {
        id: step.id,
        action: step.action,
        selector: step.selector,
        value: step.value,
        status: stepStatus,
        duration_ms: Date.now() - stepStart,
        error: stepError,
      };

      // Feature #37: Add optional step metadata if this was a skipped optional step
      if (isOptionalStep && stepStatus === 'skipped') {
        stepResult.optional = true;
        stepResult.optionalReason = step.optionalReason || 'user_marked';
        stepResult.skipReason = 'Element not present on page';
      }

      // Add accessibility results if this was an accessibility_check step
      // Note: StepA11yResults has a different structure than StepResult.accessibility
      // This is intentional as the data is processed differently downstream
      if (step.action === 'accessibility_check' && step._a11yResults) {
        stepResult.accessibility = step._a11yResults as unknown as typeof stepResult.accessibility;
      }

      stepResults.push(stepResult);

      // Emit step complete event
      emitRunEvent(runId, orgId, 'step-complete', {
        testId: test.id,
        stepIndex,
        stepId: step.id,
        status: stepStatus,
        duration_ms: stepResult.duration_ms,
        error: stepError,
        completedSteps: stepIndex + 1,
        totalSteps: test.steps.length,
      });

      // Feature #35: Live screenshot streaming during test execution
      // Take screenshot after each successful step and emit to clients
      if (stepStatus === 'passed' && page) {
        try {
          // Small delay to let page settle after action
          await page.waitForTimeout(100);
          // Take JPEG screenshot with lower quality for faster streaming
          const stepScreenshot = await page.screenshot({
            type: 'jpeg',
            quality: 50,
            timeout: 5000
          });
          const stepScreenshotBase64 = stepScreenshot.toString('base64');

          // Emit step screenshot event for live streaming
          emitRunEvent(runId, orgId, 'step:screenshot', {
            testId: test.id,
            testName: test.name,
            stepIndex,
            stepAction: step.action,
            stepSelector: step.selector,
            stepValue: step.action === 'fill' || step.action === 'type' ? '[redacted]' : step.value,
            base64: stepScreenshotBase64,
            width: test.viewport_width || 1280,
            height: test.viewport_height || 720,
            timestamp: Date.now(),
          });
          log.debug({ stepIndex: stepIndex + 1, totalSteps: test.steps.length, action: step.action }, 'Live screenshot emitted');
        } catch (screenshotErr) {
          // Don't fail the test if screenshot fails - just log and continue
          log.warn({ stepIndex, error: String(screenshotErr) }, 'Failed to capture live screenshot');
        }
      }

      // Stop execution if step failed
      if (stepStatus === 'failed') {
        // Take screenshot on failure
        try {
          const buffer = await page.screenshot();
          screenshot_base64 = buffer.toString('base64');
        } catch {
          // Ignore screenshot errors
        }
        break;
      }
      }

      // Feature #1717: Validate test URL matches intended target
      // Check if the test navigated to a different domain than intended (e.g., example.com instead of the target URL)
      if (test.target_url && page && testStatus === 'passed') {
        try {
          const actualUrl = page.url();
          const intendedHost = new URL(test.target_url).hostname.toLowerCase();
          const actualHost = actualUrl && actualUrl !== 'about:blank' ? new URL(actualUrl).hostname.toLowerCase() : null;

          // Check for common placeholder domains that indicate test wasn't properly configured
          const placeholderDomains = ['example.com', 'localhost', '127.0.0.1', 'test.com', 'placeholder.com'];
          const isActualPlaceholder = actualHost && placeholderDomains.some(d => actualHost.includes(d));
          const isIntendedPlaceholder = placeholderDomains.some(d => intendedHost.includes(d));

          // Flag as URL mismatch if:
          // 1. Actual URL is a placeholder but intended URL is not
          // 2. OR the domains don't match at all (and intended wasn't a placeholder)
          if (actualHost && !isIntendedPlaceholder) {
            if (isActualPlaceholder || (!actualHost.includes(intendedHost) && !intendedHost.includes(actualHost))) {
              testStatus = 'failed';
              testError = `URL mismatch: Test was intended for "${test.target_url}" but actually tested "${actualUrl}". The test steps may be using placeholder URLs instead of the intended target.`;
              log.warn({ expected: intendedHost, actual: actualHost }, 'URL validation failed - potential redirect');

              // Add a validation step to the results
              stepResults.push({
                id: 'url_validation',
                action: 'validate_url',
                status: 'failed',
                duration_ms: 0,
                error: testError,
                metadata: {
                  intended_url: test.target_url,
                  actual_url: actualUrl,
                  intended_host: intendedHost,
                  actual_host: actualHost,
                },
              });
            }
          }
        } catch (urlValidationError) {
          // URL parsing failed, skip validation
          log.warn('URL validation skipped - could not parse URLs');
        }
      }

      // Take final screenshot if not already taken (E2E tests only)
      if (!screenshot_base64 && page) {
        try {
          const buffer = await page.screenshot();
          screenshot_base64 = buffer.toString('base64');
        } catch {
          // Ignore screenshot errors
        }
      }
    } // End of else block for E2E tests
  } catch (err) {
    testStatus = 'error';
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    // Feature #606: Detect browser crash during capture
    const isBrowserCrash =
      errorMessage.includes('Target closed') ||
      errorMessage.includes('Target page, context or browser has been closed') ||
      errorMessage.includes('browser has been closed') ||
      errorMessage.includes('Browser closed') ||
      errorMessage.includes('Browser process terminated') ||
      errorMessage.includes('crashed') ||
      errorMessage.includes('disconnected') ||
      errorMessage.includes('Navigation failed because page was closed') ||
      errorMessage.includes('Protocol error') ||
      errorMessage.includes('Connection closed');

    if (isBrowserCrash) {
      testError = 'Browser process terminated unexpectedly - the browser crashed during test execution. This may be caused by insufficient memory, a page causing excessive resource usage, or a browser bug.';
      log.error({ testId: test.id, error: errorMessage }, 'Browser crashed during visual test');

      const crashSuggestion = 'Try running the test again. If the crash persists, check if the target page has memory issues or reduce test parallelism.';

      // Feature #606: Save crash dump for debugging
      const crashDumpFile = saveCrashDump({
        timestamp: new Date().toISOString(),
        testId: test.id,
        testName: test.name,
        runId,
        errorMessage: testError,
        originalError: errorMessage,
        browserType: browser.browserType().name() || 'unknown',
        targetUrl: test.target_url,
        viewportWidth: test.viewport_width,
        viewportHeight: test.viewport_height,
        stepResults: [...stepResults], // Copy current step results
        suggestion: crashSuggestion,
      });

      // Add crash-specific step result
      stepResults.push({
        id: 'browser_crash',
        action: 'browser_crash_detection',
        name: 'Browser Crash Detection',
        status: 'failed',
        duration_ms: Date.now() - startTime,
        error: testError,
        metadata: {
          originalError: errorMessage,
          isBrowserCrash: true,
          crashDetectedAt: new Date().toISOString(),
          crashDumpFile: crashDumpFile || undefined,
          suggestion: crashSuggestion,
          canRetry: true, // Indicate that this test can be retried
        },
      });
    } else {
      testError = errorMessage;
    }
  } finally {
    // Stop tracing and save the trace file
    if (context) {
      try {
        await context.tracing.stop({ path: tracePath });
        trace_file = traceFileName;
      } catch {
        // Ignore trace save errors
      }

      // Save video file - need to close page first to finalize recording
      if (page) {
        try {
          const videoInstance = page.video();
          if (videoInstance) {
            // Close the page to finalize video
            await page.close();
            // Get the path of the video file
            const videoPath = await videoInstance.path();
            if (videoPath && fs.existsSync(videoPath)) {
              // Rename to our naming convention
              const destPath = path.join(VIDEOS_DIR, videoFileName);
              // Check if destination already exists and remove it
              if (fs.existsSync(destPath)) {
                fs.unlinkSync(destPath);
              }
              fs.renameSync(videoPath, destPath);
              video_file = videoFileName;
              log.info({ testId: test.id, videoFileName }, 'Video saved for test');
            } else {
              log.warn({ videoPath }, 'Video path not found or does not exist');
            }
          } else {
            log.debug({ testId: test.id }, 'No video instance for test');
            await page.close().catch(() => {});
          }
        } catch (err) {
          // Log video save errors for debugging
          log.error({ testId: test.id, error: err }, 'Error saving video for test');
          await page.close().catch(() => {});
        }
      }
      await context.close().catch(() => {});
    }
  }

  const result: TestRunResult = {
    test_id: test.id,
    test_name: test.name,
    test_type: test.test_type, // Feature #1991: Include test type for PDF breakdown
    status: testStatus,
    duration_ms: Date.now() - startTime,
    steps: stepResults,
    trace_file,
    video_file,
    error: testError,
    screenshot_base64,
    console_logs: consoleLogs.length > 0 ? consoleLogs : undefined,
    network_requests: networkRequests.length > 0 ? networkRequests : undefined,
    // Visual comparison results (only for visual regression tests)
    visual_comparison: visualComparison,
    baseline_screenshot_base64: baselineScreenshotBase64,
    diff_image_base64: diffImageBase64,
    diff_percentage: diffPercentage,
    // Feature #1913: Multi-viewport results
    viewport_results: viewportResults,
    // Feature #604: Storage quota exceeded info
    isQuotaExceeded: isQuotaExceeded || undefined,
    suggestions: quotaExceededSuggestions,
    // Viewport info for descriptive screenshot filenames
    viewport_width: test.viewport_width || 1280,
    viewport_height: test.viewport_height || 720,
    // Feature #1968: Load test results for UI display
    load_test: loadTestResultsData as Record<string, unknown> | undefined,
  };

  // Emit test complete event
  emitRunEvent(runId, orgId, 'test-complete', {
    testId: test.id,
    testName: test.name,
    status: testStatus,
    duration_ms: result.duration_ms,
    error: testError,
  });

  return result;
}

async function launchBrowser(browserType: BrowserType): Promise<Browser> {
  switch (browserType) {
    case 'firefox':
      return await firefox.launch({ headless: true });
    case 'webkit':
      return await webkit.launch({ headless: true });
    case 'chromium':
    default:
      return await chromium.launch({ headless: true });
  }
}

// Export the functions
export { executeTest, launchBrowser };
