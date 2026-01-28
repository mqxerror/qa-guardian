/**
 * Visual Regression Test Executor
 * Extracted from test-executor.ts for Feature #1356 (Backend file size limit)
 *
 * This module handles visual regression test execution:
 * - Viewport validation
 * - Page navigation and preparation
 * - Screenshot capture (full-page, viewport, or element)
 * - Baseline comparison with pixelmatch
 * - Multi-viewport support
 */

import { Page, Browser } from 'playwright';

import {
  StepResult,
  VIEWPORT_PRESETS,
} from './execution';

import {
  VisualComparisonResult,
  AntiAliasingOptions,
  compareScreenshots,
  loadBaseline,
  saveBaseline,
} from './visual-regression';

import {
  getSimulatedBrowserCrash,
} from './test-simulation';

import {
  ScreenshotCaptureResult,
  DEFAULT_SCREENSHOT_TIMEOUT,
  saveCrashDump,
  captureScreenshotWithTimeout,
  getIgnoreRegionsFromSelectors,
} from './execute-test-helpers';

import { getTestSuite, IgnoreRegion } from '../test-suites';
import { getProjectVisualSettings } from '../projects';
import { sendVisualDiffWebhook } from './webhook-events';

/**
 * Configuration for a visual regression test
 */
export interface VisualTestConfig {
  id: string;
  name: string;
  suite_id?: string;
  organization_id?: string;
  target_url: string;
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
  screenshot_timeout?: number;
  anti_aliasing_tolerance?: 'off' | 'low' | 'medium' | 'high';
  color_threshold?: number;
}

/**
 * Context provided to the visual test executor
 */
export interface VisualTestContext {
  page: Page;
  browser: Browser;
  runId: string;
  orgId: string;
  emitRunEvent: (runId: string, orgId: string, event: string, data: any) => void;
}

/**
 * Feature #1913: Per-viewport visual comparison result
 */
export interface ViewportResult {
  viewportId: string;
  viewportLabel: string;
  width: number;
  height: number;
  visualComparison?: VisualComparisonResult;
  screenshotBase64?: string;
  baselineScreenshotBase64?: string;
  diffImageBase64?: string;
  diffPercentage?: number;
}

/**
 * Result from visual test execution
 */
export interface VisualTestResult {
  testStatus: 'passed' | 'failed' | 'error';
  testError?: string;
  stepResults: StepResult[];
  screenshot_base64?: string;
  visualComparison?: VisualComparisonResult;
  baselineScreenshotBase64?: string;
  diffImageBase64?: string;
  diffPercentage?: number;
  isQuotaExceeded?: boolean;
  quotaExceededSuggestions?: string[];
  // Feature #1913: Multi-viewport results
  viewportResults?: ViewportResult[];
}

// Viewport dimension limits
const MIN_VIEWPORT_WIDTH = 320;
const MAX_VIEWPORT_WIDTH = 3840;
const MIN_VIEWPORT_HEIGHT = 240;
const MAX_VIEWPORT_HEIGHT = 2160;

/**
 * Feature #1915: Scroll through page to trigger lazy-loaded content
 * Scrolls incrementally to bottom, then back to top, allowing lazy images to load
 */
async function scrollPageForLazyContent(page: Page): Promise<void> {
  const scrollStep = 100; // pixels per step
  const scrollDelay = 100; // ms between steps

  // Get the total scrollable height
  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);

  // If page is smaller than viewport, no need to scroll
  if (scrollHeight <= viewportHeight) {
    return;
  }

  // Scroll down incrementally
  let currentPosition = 0;
  while (currentPosition < scrollHeight) {
    await page.evaluate((pos) => window.scrollTo(0, pos), currentPosition);
    await page.waitForTimeout(scrollDelay);
    currentPosition += scrollStep;
  }

  // Scroll to absolute bottom to ensure all content loaded
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(200);

  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);

  // Wait for any final network requests to complete
  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 });
  } catch {
    // Timeout is okay, continue with capture
  }
}

/**
 * Feature #1916: Wait for all images (including lazy-loaded) to complete loading
 * Checks img.complete status for all images and waits for pending ones
 * Feature #1977: Fixed ReferenceError __name is not defined by using string-based evaluate
 */
async function waitForAllImagesToLoad(page: Page, timeout: number = 10000): Promise<{ loaded: number; failed: number }> {
  const startTime = Date.now();

  // Feature #1977: Use string-based evaluate to avoid esbuild __name transformation issues
  // When tsx/esbuild compiles arrow functions, it may add __name helper which doesn't exist in browser context
  const result = await page.evaluate(`
    (async () => {
      const maxWait = ${timeout};
      const images = Array.from(document.querySelectorAll('img'));
      let loaded = 0;
      let failed = 0;

      const waitForImage = function(img) {
        return new Promise(function(resolve) {
          if (img.complete) {
            if (img.naturalWidth > 0) {
              resolve(true);
            } else {
              resolve(false);
            }
            return;
          }

          function onLoad() {
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
            resolve(true);
          }
          function onError() {
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
            resolve(false);
          }

          img.addEventListener('load', onLoad);
          img.addEventListener('error', onError);

          setTimeout(function() {
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
            resolve(img.complete && img.naturalWidth > 0);
          }, Math.min(5000, maxWait));
        });
      };

      const results = await Promise.all(images.map(waitForImage));

      results.forEach(function(success) {
        if (success) loaded++;
        else failed++;
      });

      return { loaded: loaded, failed: failed, total: images.length };
    })()
  `) as { loaded: number; failed: number; total: number };

  // Also check for background images by waiting a bit longer
  const elapsed = Date.now() - startTime;
  if (elapsed < timeout / 2) {
    await page.waitForTimeout(Math.min(500, timeout - elapsed));
  }

  return { loaded: result.loaded, failed: result.failed };
}

/**
 * Validate viewport dimensions for visual regression tests
 */
function validateViewport(
  width: number,
  height: number,
  emitRunEvent: VisualTestContext['emitRunEvent'],
  runId: string,
  orgId: string,
  testId: string,
  visualStepStart: number
): { valid: boolean; error?: string; stepResult?: StepResult } {
  if (width <= 0) {
    const error = `Invalid viewport width: must be > 0. Minimum supported width is ${MIN_VIEWPORT_WIDTH}px (mobile viewport).`;
    emitRunEvent(runId, orgId, 'step-complete', {
      testId,
      stepIndex: 0,
      stepId: 'viewport_validation',
      status: 'failed',
      duration_ms: Date.now() - visualStepStart,
      error,
      completedSteps: 1,
      totalSteps: 1,
      suggestion: `Please configure a viewport width between ${MIN_VIEWPORT_WIDTH}px and ${MAX_VIEWPORT_WIDTH}px.`,
    });
    return {
      valid: false,
      error,
      stepResult: {
        id: 'viewport_validation',
        action: 'validate_viewport',
        value: `width=${width}, height=${height}`,
        status: 'failed',
        duration_ms: Date.now() - visualStepStart,
        error,
      },
    };
  }

  if (width < MIN_VIEWPORT_WIDTH) {
    const error = `Invalid viewport width: ${width}px is below minimum. Minimum supported width is ${MIN_VIEWPORT_WIDTH}px (mobile viewport).`;
    emitRunEvent(runId, orgId, 'step-complete', {
      testId,
      stepIndex: 0,
      stepId: 'viewport_validation',
      status: 'failed',
      duration_ms: Date.now() - visualStepStart,
      error,
      completedSteps: 1,
      totalSteps: 1,
      suggestion: `Please configure a viewport width of at least ${MIN_VIEWPORT_WIDTH}px.`,
    });
    return {
      valid: false,
      error,
      stepResult: {
        id: 'viewport_validation',
        action: 'validate_viewport',
        value: `width=${width}, height=${height}`,
        status: 'failed',
        duration_ms: Date.now() - visualStepStart,
        error,
      },
    };
  }

  if (width > MAX_VIEWPORT_WIDTH) {
    const error = `Invalid viewport width: ${width}px exceeds maximum. Maximum supported width is ${MAX_VIEWPORT_WIDTH}px (4K resolution).`;
    emitRunEvent(runId, orgId, 'step-complete', {
      testId,
      stepIndex: 0,
      stepId: 'viewport_validation',
      status: 'failed',
      duration_ms: Date.now() - visualStepStart,
      error,
      completedSteps: 1,
      totalSteps: 1,
      suggestion: `Please configure a viewport width of at most ${MAX_VIEWPORT_WIDTH}px.`,
    });
    return {
      valid: false,
      error,
      stepResult: {
        id: 'viewport_validation',
        action: 'validate_viewport',
        value: `width=${width}, height=${height}`,
        status: 'failed',
        duration_ms: Date.now() - visualStepStart,
        error,
      },
    };
  }

  if (height <= 0) {
    const error = `Invalid viewport height: must be > 0. Minimum supported height is ${MIN_VIEWPORT_HEIGHT}px.`;
    emitRunEvent(runId, orgId, 'step-complete', {
      testId,
      stepIndex: 0,
      stepId: 'viewport_validation',
      status: 'failed',
      duration_ms: Date.now() - visualStepStart,
      error,
      completedSteps: 1,
      totalSteps: 1,
      suggestion: `Please configure a viewport height between ${MIN_VIEWPORT_HEIGHT}px and ${MAX_VIEWPORT_HEIGHT}px.`,
    });
    return {
      valid: false,
      error,
      stepResult: {
        id: 'viewport_validation',
        action: 'validate_viewport',
        value: `width=${width}, height=${height}`,
        status: 'failed',
        duration_ms: Date.now() - visualStepStart,
        error,
      },
    };
  }

  if (height < MIN_VIEWPORT_HEIGHT || height > MAX_VIEWPORT_HEIGHT) {
    const error = `Invalid viewport height: ${height}px. Must be between ${MIN_VIEWPORT_HEIGHT}px and ${MAX_VIEWPORT_HEIGHT}px.`;
    emitRunEvent(runId, orgId, 'step-complete', {
      testId,
      stepIndex: 0,
      stepId: 'viewport_validation',
      status: 'failed',
      duration_ms: Date.now() - visualStepStart,
      error,
      completedSteps: 1,
      totalSteps: 1,
      suggestion: `Please configure a viewport height between ${MIN_VIEWPORT_HEIGHT}px and ${MAX_VIEWPORT_HEIGHT}px.`,
    });
    return {
      valid: false,
      error,
      stepResult: {
        id: 'viewport_validation',
        action: 'validate_viewport',
        value: `width=${width}, height=${height}`,
        status: 'failed',
        duration_ms: Date.now() - visualStepStart,
        error,
      },
    };
  }

  return { valid: true };
}

/**
 * Hide elements by selector (set visibility:hidden to preserve layout)
 */
async function hideElements(
  page: Page,
  selectors: string
): Promise<{ hiddenCount: number; warnings: string[] }> {
  const selectorList = selectors.split(',').map(s => s.trim()).filter(s => s.length > 0);
  let hiddenCount = 0;
  const warnings: string[] = [];

  for (const selector of selectorList) {
    try {
      const count = await page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel);
        elements.forEach((el) => {
          (el as HTMLElement).style.visibility = 'hidden';
        });
        return elements.length;
      }, selector);
      if (count === 0) {
        const warning = `Mask selector matched 0 elements: '${selector}'`;
        warnings.push(warning);
        console.log(`[Visual] ${warning}`);
      }
      hiddenCount += count;
    } catch (err) {
      const warning = `Error resolving mask selector '${selector}': ${err}`;
      warnings.push(warning);
      console.log(`[Visual] ${warning}`);
    }
  }

  return { hiddenCount, warnings };
}

/**
 * Remove elements by selector (set display:none to remove from layout)
 */
async function removeElements(
  page: Page,
  selectors: string
): Promise<{ removedCount: number; warnings: string[] }> {
  const selectorList = selectors.split(',').map(s => s.trim()).filter(s => s.length > 0);
  let removedCount = 0;
  const warnings: string[] = [];

  for (const selector of selectorList) {
    try {
      const count = await page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel);
        elements.forEach((el) => {
          (el as HTMLElement).style.display = 'none';
        });
        return elements.length;
      }, selector);
      if (count === 0) {
        const warning = `Mask selector matched 0 elements: '${selector}'`;
        warnings.push(warning);
        console.log(`[Visual] ${warning}`);
      }
      removedCount += count;
    } catch (err) {
      const warning = `Error resolving mask selector '${selector}': ${err}`;
      warnings.push(warning);
      console.log(`[Visual] ${warning}`);
    }
  }

  return { removedCount, warnings };
}

/**
 * Execute a visual regression test
 */
export async function executeVisualTest(
  test: VisualTestConfig,
  context: VisualTestContext
): Promise<VisualTestResult> {
  const { page, browser, runId, orgId, emitRunEvent } = context;
  const visualStepStart = Date.now();
  const stepResults: StepResult[] = [];
  let testStatus: 'passed' | 'failed' | 'error' = 'passed';
  let testError: string | undefined;
  let screenshot_base64: string | undefined;
  let visualComparison: VisualComparisonResult | undefined;
  let baselineScreenshotBase64: string | undefined;
  let diffImageBase64: string | undefined;
  let diffPercentage: number | undefined;
  let isQuotaExceeded = false;
  let quotaExceededSuggestions: string[] | undefined;
  // Feature #1913: Multi-viewport results storage
  const viewportResults: ViewportResult[] = [];

  // Branch for baseline comparison (default to 'main')
  const baselineBranch = test.branch || 'main';

  // Validate viewport dimensions for non-multi-viewport tests
  if (!test.multi_viewport) {
    const width = test.viewport_width || 0;
    const height = test.viewport_height || 0;

    const validation = validateViewport(
      width, height, emitRunEvent, runId, orgId, test.id, visualStepStart
    );

    if (!validation.valid) {
      if (validation.stepResult) {
        stepResults.push(validation.stepResult);
      }
      return {
        testStatus: 'failed',
        testError: validation.error,
        stepResults,
      };
    }
  }

  // Determine viewports to capture
  const viewportsToCapture: Array<{ id: string; width: number; height: number; label: string }> = [];

  if (test.multi_viewport && test.viewports && test.viewports.length > 0) {
    for (const vp of test.viewports) {
      const preset = VIEWPORT_PRESETS[vp];
      if (preset) {
        viewportsToCapture.push({ id: `${vp}_${preset.width}x${preset.height}`, ...preset });
      }
    }
  } else {
    const width = test.viewport_width || 1280;
    const height = test.viewport_height || 720;
    viewportsToCapture.push({
      id: `single_${width}x${height}`,
      width,
      height,
      label: 'Default',
    });
  }

  // Calculate total steps
  const waitSelectorStep = test.wait_for_selector ? 1 : 0;
  const waitTimeStep = (test.wait_time && test.wait_time > 0) ? 1 : 0;
  const hideSelectorsStep = test.hide_selectors ? 1 : 0;
  const removeSelectorsStep = test.remove_selectors ? 1 : 0;
  const totalSteps = 1 + waitSelectorStep + waitTimeStep + hideSelectorsStep + removeSelectorsStep + viewportsToCapture.length;

  // Emit step start for navigate
  emitRunEvent(runId, orgId, 'step-start', {
    testId: test.id,
    stepIndex: 0,
    stepId: 'visual_navigate',
    action: 'navigate',
    value: test.target_url,
  });

  // Track warnings for mask selectors
  let hideSelectorWarnings: string[] = [];
  let removeSelectorWarnings: string[] = [];

  try {
    // Feature #606: Check for simulated browser crash
    if (getSimulatedBrowserCrash()) {
      console.log(`[Visual][SimulatedCrash] Simulating browser crash for test ${test.id}`);
      throw new Error('Browser process terminated unexpectedly: Target page, context or browser has been closed');
    }

    // Navigate to the target URL
    const response = await page.goto(test.target_url, { waitUntil: 'networkidle', timeout: 30000 });
    const navigateDuration = Date.now() - visualStepStart;

    // Check for HTTP error responses
    const statusCode = response?.status() || 0;
    const isHttpError = statusCode >= 400;

    if (isHttpError) {
      console.error(`[Visual][Navigation] HTTP ${statusCode} error at ${test.target_url}`);
      emitRunEvent(runId, orgId, 'step-complete', {
        testId: test.id,
        stepIndex: 0,
        stepId: 'visual_navigate',
        status: 'failed',
        duration_ms: navigateDuration,
        completedSteps: 1,
        totalSteps: totalSteps,
        error: `Navigation failed: HTTP ${statusCode}`,
      });
      stepResults.push({
        id: 'visual_navigate',
        action: 'navigate',
        value: test.target_url,
        status: 'failed',
        duration_ms: navigateDuration,
        error: `Navigation failed: HTTP ${statusCode}`,
      } as StepResult);
      return {
        testStatus: 'failed',
        testError: `Navigation failed: HTTP ${statusCode} at ${test.target_url}`,
        stepResults,
      };
    }

    // Emit step complete for navigate
    emitRunEvent(runId, orgId, 'step-complete', {
      testId: test.id,
      stepIndex: 0,
      stepId: 'visual_navigate',
      status: 'passed',
      duration_ms: navigateDuration,
      completedSteps: 1,
      totalSteps: totalSteps,
    });

    stepResults.push({
      id: 'visual_navigate',
      action: 'navigate',
      value: test.target_url,
      status: 'passed',
      duration_ms: navigateDuration,
      http_status: statusCode,
    } as StepResult);

    // Wait for custom selector if specified
    if (test.wait_for_selector) {
      const waitSelectorStart = Date.now();
      try {
        await page.waitForSelector(test.wait_for_selector, { state: 'visible', timeout: 30000 });
        const waitDuration = Date.now() - waitSelectorStart;
        stepResults.push({
          id: 'visual_wait_selector',
          action: 'wait_for_selector',
          value: test.wait_for_selector,
          status: 'passed',
          duration_ms: waitDuration,
        });
      } catch (waitError) {
        const waitDuration = Date.now() - waitSelectorStart;
        stepResults.push({
          id: 'visual_wait_selector',
          action: 'wait_for_selector',
          value: test.wait_for_selector,
          status: 'failed',
          error: `Selector "${test.wait_for_selector}" not found within timeout`,
          duration_ms: waitDuration,
        });
        throw new Error(`Wait for selector failed: "${test.wait_for_selector}" not found`);
      }
    }

    // Apply additional wait time if specified
    if (test.wait_time && test.wait_time > 0) {
      const waitTimeStart = Date.now();
      await page.waitForTimeout(test.wait_time);
      const actualWaitDuration = Date.now() - waitTimeStart;
      stepResults.push({
        id: 'visual_wait_time',
        action: 'wait',
        value: `${test.wait_time}ms`,
        status: 'passed',
        duration_ms: actualWaitDuration,
      });
    }

    // Hide elements by selector if specified
    if (test.hide_selectors) {
      const hideStart = Date.now();
      const hideResult = await hideElements(page, test.hide_selectors);
      hideSelectorWarnings = hideResult.warnings;
      const hideDuration = Date.now() - hideStart;
      stepResults.push({
        id: 'visual_hide_elements',
        action: 'hide_elements',
        value: test.hide_selectors,
        status: 'passed',
        duration_ms: hideDuration,
        metadata: {
          hiddenCount: hideResult.hiddenCount,
          selectors: test.hide_selectors.split(',').length,
          warnings: hideResult.warnings.length > 0 ? hideResult.warnings : undefined,
        },
      } as StepResult);
    }

    // Remove elements by selector if specified
    if (test.remove_selectors) {
      const removeStart = Date.now();
      const removeResult = await removeElements(page, test.remove_selectors);
      removeSelectorWarnings = removeResult.warnings;
      const removeDuration = Date.now() - removeStart;
      stepResults.push({
        id: 'visual_remove_elements',
        action: 'remove_elements',
        value: test.remove_selectors,
        status: 'passed',
        duration_ms: removeDuration,
        metadata: {
          removedCount: removeResult.removedCount,
          selectors: test.remove_selectors.split(',').length,
          warnings: removeResult.warnings.length > 0 ? removeResult.warnings : undefined,
        },
      } as StepResult);
    }

    // Capture screenshots at each viewport
    for (let vpIndex = 0; vpIndex < viewportsToCapture.length; vpIndex++) {
      const viewport = viewportsToCapture[vpIndex]!;
      const stepIndex = 1 + waitSelectorStep + waitTimeStep + hideSelectorsStep + removeSelectorsStep + vpIndex;

      // Determine screenshot mode
      let screenshotAction: string;
      let screenshotLabel: string;
      let screenshotResult: string;
      const viewportSuffix = test.multi_viewport ? ` (${viewport.label} - ${viewport.width}x${viewport.height})` : '';

      if (test.capture_mode === 'element' && test.element_selector) {
        screenshotAction = 'element_screenshot';
        screenshotLabel = `Capturing element screenshot${viewportSuffix} (${test.element_selector})`;
        screenshotResult = `Element screenshot captured${viewportSuffix} (${test.element_selector})`;
      } else if (test.capture_mode === 'viewport') {
        screenshotAction = 'viewport_screenshot';
        screenshotLabel = `Capturing viewport screenshot${viewportSuffix}`;
        screenshotResult = `Viewport screenshot captured${viewportSuffix}`;
      } else {
        screenshotAction = 'full_page_screenshot';
        screenshotLabel = `Capturing full-page screenshot${viewportSuffix}`;
        screenshotResult = `Full page screenshot captured${viewportSuffix}`;
      }

      // Emit step start for screenshot
      const screenshotStart = Date.now();
      emitRunEvent(runId, orgId, 'step-start', {
        testId: test.id,
        stepIndex: stepIndex,
        stepId: `visual_screenshot_${viewport.id}`,
        action: screenshotAction,
        value: screenshotLabel,
      });

      // Resize viewport for multi-viewport mode
      if (test.multi_viewport) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.waitForTimeout(500);
      }

      // Take screenshot based on capture mode
      const screenshotTimeout = test.screenshot_timeout || DEFAULT_SCREENSHOT_TIMEOUT;
      let captureResult: ScreenshotCaptureResult;

      if (test.capture_mode === 'element' && test.element_selector) {
        const element = page.locator(test.element_selector);
        await element.waitFor({ state: 'visible', timeout: Math.min(10000, screenshotTimeout) });
        captureResult = await captureScreenshotWithTimeout(page, {
          element,
          timeout: screenshotTimeout,
        });
      } else if (test.capture_mode === 'viewport') {
        captureResult = await captureScreenshotWithTimeout(page, {
          fullPage: false,
          timeout: screenshotTimeout,
        });
      } else {
        // Feature #1915: Scroll page to trigger lazy-loaded images before full-page capture
        await scrollPageForLazyContent(page);

        // Feature #1916: Wait for all images to finish loading
        await waitForAllImagesToLoad(page, 10000);

        captureResult = await captureScreenshotWithTimeout(page, {
          fullPage: true,
          timeout: screenshotTimeout,
        });
      }

      // Handle oversized page
      if (captureResult.isOversized) {
        console.error(`[Visual][Oversized] Page too large for test ${test.id} viewport ${viewport.id}`);
        stepResults.push({
          id: `visual_screenshot_${viewport.id}`,
          action: 'visual_screenshot',
          value: `Page too large for full-page capture`,
          status: 'failed',
          duration_ms: captureResult.durationMs,
          error: captureResult.error || 'Page too large for full-page capture',
          metadata: {
            isOversized: true,
            pageDimensions: captureResult.pageDimensions,
            suggestion: 'Consider using viewport-only capture mode instead of full-page for extremely large pages.',
          },
        } as StepResult);
        testStatus = 'failed';
        testError = `Page too large for full-page capture: ${captureResult.pageDimensions?.reason || 'Page dimensions exceed safe limits'}. Consider using viewport-only capture mode.`;
        continue;
      }

      // Handle screenshot timeout
      if (captureResult.timedOut || !captureResult.buffer) {
        console.error(`[Visual][Timeout] Screenshot capture timed out for test ${test.id} viewport ${viewport.id}`);
        stepResults.push({
          id: `visual_screenshot_${viewport.id}`,
          action: 'visual_screenshot',
          value: `Screenshot (${viewport.label || viewport.id})`,
          status: 'failed',
          duration_ms: captureResult.durationMs,
          error: captureResult.error || 'Screenshot capture timed out',
          screenshot_timeout: true,
        } as StepResult);
        testStatus = 'failed';
        testError = `Visual regression test failed: ${captureResult.error || 'Screenshot capture timed out'}`;
        continue;
      }

      const buffer = captureResult.buffer;

      // Use the first screenshot as the main screenshot_base64
      if (vpIndex === 0) {
        screenshot_base64 = buffer.toString('base64');
      }

      const screenshotDuration = captureResult.durationMs;

      // Perform visual comparison with baseline
      let comparisonStatus: 'passed' | 'baseline_created' | 'diff_detected' = 'baseline_created';
      let comparisonMessage = 'Baseline screenshot captured';
      let ignoreSelectorWarnings: string[] = [];
      let datetimeMaskWarnings: string[] = [];

      const existingBaseline = loadBaseline(test.id, viewport.id, baselineBranch);
      if (existingBaseline) {
        // Build combined ignore regions
        let combinedIgnoreRegions: IgnoreRegion[] = [];

        if (test.ignore_regions && test.ignore_regions.length > 0) {
          combinedIgnoreRegions = [...test.ignore_regions];
        }

        if (test.ignore_selectors && test.ignore_selectors.length > 0) {
          const selectorResult = await getIgnoreRegionsFromSelectors(page, test.ignore_selectors);
          combinedIgnoreRegions = [...combinedIgnoreRegions, ...selectorResult.regions];
          ignoreSelectorWarnings = selectorResult.warnings;
        }

        // Handle datetime masking
        if (test.mask_datetime_selectors) {
          const datetimeSelectors = test.mask_datetime_selectors.split(',').map(s => s.trim()).filter(s => s.length > 0);
          if (datetimeSelectors.length > 0) {
            const datetimeResult = await getIgnoreRegionsFromSelectors(page, datetimeSelectors);
            combinedIgnoreRegions = [...combinedIgnoreRegions, ...datetimeResult.regions];
            datetimeMaskWarnings = datetimeResult.warnings;
            console.log(`[Visual] Masked ${datetimeResult.regions.length} datetime regions from selectors`);
          }
        }

        // Auto-mask common dynamic content
        if (test.mask_dynamic_content) {
          const dynamicContentSelectors = [
            'time', '[datetime]', '.timestamp', '.date', '.datetime', '.time',
            '.relative-time', '.timeago', '[class*="timestamp"]', '[class*="date"]',
            '[class*="time"]', '[data-timestamp]', '[data-date]', '[data-time]',
            '.moment', '.dayjs', '.luxon',
          ];
          const dynamicResult = await getIgnoreRegionsFromSelectors(page, dynamicContentSelectors);
          combinedIgnoreRegions = [...combinedIgnoreRegions, ...dynamicResult.regions];
          if (dynamicResult.regions.length > 0) {
            console.log(`[Visual] Auto-masked ${dynamicResult.regions.length} dynamic content regions`);
          }
        }

        // Anti-aliasing options
        const aaOptions: AntiAliasingOptions = {
          tolerance: test.anti_aliasing_tolerance ?? 'off',
          colorThreshold: test.color_threshold,
        };

        // Compare with existing baseline
        const comparison = await compareScreenshots(
          existingBaseline,
          buffer,
          combinedIgnoreRegions.length > 0 ? combinedIgnoreRegions : undefined,
          test.organization_id,
          aaOptions
        );
        visualComparison = comparison;

        if (comparison.diffPercentage !== undefined) {
          diffPercentage = comparison.diffPercentage;
          baselineScreenshotBase64 = comparison.baselineScreenshot;
          diffImageBase64 = comparison.diffImage;

          // Get threshold configuration
          const suite = test.suite_id ? await getTestSuite(test.suite_id) : undefined;
          const projectSettings = suite ? getProjectVisualSettings(suite.project_id) : null;

          const thresholdMode = test.diff_threshold_mode ??
            (projectSettings?.default_diff_threshold_mode ?? 'percentage');
          const percentageThreshold = test.diff_threshold ??
            (projectSettings?.default_diff_threshold ?? 0);
          const pixelThreshold = test.diff_pixel_threshold ??
            (projectSettings?.default_diff_pixel_threshold ?? 0);
          const mismatchedPixels = comparison.mismatchedPixels ?? 0;

          // Determine if within threshold
          let withinThreshold = false;
          let thresholdDescription = '';

          if (comparison.diffPercentage === 0) {
            withinThreshold = true;
            thresholdDescription = '0% difference';
          } else if (thresholdMode === 'pixel_count') {
            withinThreshold = mismatchedPixels <= pixelThreshold;
            thresholdDescription = `${pixelThreshold} pixel threshold`;
          } else {
            withinThreshold = comparison.diffPercentage <= percentageThreshold;
            thresholdDescription = `${percentageThreshold}% threshold`;
          }

          if (comparison.diffPercentage === 0) {
            comparisonStatus = 'passed';
            comparisonMessage = 'Screenshot matches baseline (0% difference)';
          } else if (withinThreshold) {
            comparisonStatus = 'passed';
            comparisonMessage = `Difference detected: ${comparison.diffPercentage.toFixed(2)}% (${mismatchedPixels} pixels) - within ${thresholdDescription}`;
          } else {
            comparisonStatus = 'diff_detected';
            comparisonMessage = `Difference detected: ${comparison.diffPercentage.toFixed(2)}% (${mismatchedPixels} pixels) - exceeds ${thresholdDescription}`;
            testStatus = 'failed';
            testError = `Visual regression test failed: ${comparisonMessage}`;

            // Send visual diff webhook
            if (suite) {
              const actualThreshold = thresholdMode === 'pixel_count' ? pixelThreshold : percentageThreshold;
              sendVisualDiffWebhook(orgId, {
                test_id: test.id,
                test_name: test.name,
                suite_id: suite.id,
                suite_name: suite.name,
                project_id: suite.project_id,
                run_id: runId,
                viewport_id: viewport.id,
                branch: baselineBranch,
                diff_percentage: comparison.diffPercentage,
                mismatched_pixels: mismatchedPixels,
                total_pixels: comparison.totalPixels || 0,
                threshold: actualThreshold,
                target_url: test.target_url,
              }).catch(err => console.error('[WEBHOOK] Error sending visual diff webhook:', err));
            }
          }
        }
      } else {
        // No baseline exists - save this as the baseline
        const saveResult = saveBaseline(test.id, buffer, viewport.id, baselineBranch);

        if (!saveResult.success && saveResult.isQuotaExceeded) {
          visualComparison = { hasBaseline: false };
          comparisonMessage = 'Storage quota exceeded - could not save baseline';
          testStatus = 'failed';
          testError = 'Storage quota exceeded - unable to save baseline. ' +
            (saveResult.suggestions ? saveResult.suggestions[0] : 'Clean up old baselines to free space.');
          isQuotaExceeded = true;
          quotaExceededSuggestions = saveResult.suggestions;
        } else {
          visualComparison = { hasBaseline: false };
          comparisonMessage = 'First run - baseline screenshot saved';
        }
      }

      // Emit step complete for screenshot
      emitRunEvent(runId, orgId, 'step-complete', {
        testId: test.id,
        stepIndex: stepIndex,
        stepId: `visual_screenshot_${viewport.id}`,
        status: 'passed',
        duration_ms: screenshotDuration,
        completedSteps: stepIndex + 1,
        totalSteps: totalSteps,
        visualComparison: comparisonStatus,
        diffPercentage: diffPercentage,
      });

      // Combine all mask selector warnings
      const allMaskWarnings: string[] = [
        ...hideSelectorWarnings,
        ...removeSelectorWarnings,
        ...ignoreSelectorWarnings,
        ...datetimeMaskWarnings,
      ];

      stepResults.push({
        id: `visual_screenshot_${viewport.id}`,
        action: screenshotAction,
        value: `${screenshotResult} - ${comparisonMessage}`,
        status: 'passed',
        duration_ms: screenshotDuration,
        viewport: test.multi_viewport ? `${viewport.label} (${viewport.width}x${viewport.height})` : undefined,
        metadata: allMaskWarnings.length > 0 ? {
          maskSelectorWarnings: allMaskWarnings,
        } : undefined,
      } as StepResult);

      // Feature #1913: Store per-viewport result for multi-viewport tests
      if (test.multi_viewport) {
        viewportResults.push({
          viewportId: viewport.id,
          viewportLabel: viewport.label,
          width: viewport.width,
          height: viewport.height,
          visualComparison,
          screenshotBase64: buffer?.toString('base64'),
          baselineScreenshotBase64,
          diffImageBase64,
          diffPercentage,
        });
      }
    }

  } catch (err) {
    const visualStepError = err instanceof Error ? err.message : 'Unknown error';

    // Check for navigation error (already handled)
    const isNavigationError = visualStepError.startsWith('NavigationError:');

    // Detect browser crash
    const isBrowserCrash =
      visualStepError.includes('Target closed') ||
      visualStepError.includes('Target page, context or browser has been closed') ||
      visualStepError.includes('browser has been closed') ||
      visualStepError.includes('Browser closed') ||
      visualStepError.includes('Browser process terminated') ||
      visualStepError.includes('crashed') ||
      visualStepError.includes('disconnected') ||
      visualStepError.includes('Navigation failed because page was closed') ||
      visualStepError.includes('Protocol error') ||
      visualStepError.includes('Connection closed');

    if (isBrowserCrash) {
      testStatus = 'error';
      testError = 'Browser process terminated unexpectedly - the browser crashed during test execution.';
      console.error(`[Visual][BrowserCrash] Browser crashed during visual test ${test.id}: ${visualStepError}`);

      const crashSuggestion = 'Try running the test again. If the crash persists, check if the target page has memory issues or reduce test parallelism.';

      const crashDumpFile = saveCrashDump({
        timestamp: new Date().toISOString(),
        testId: test.id,
        testName: test.name,
        runId,
        errorMessage: testError,
        originalError: visualStepError,
        browserType: browser.browserType().name() || 'unknown',
        targetUrl: test.target_url,
        viewportWidth: test.viewport_width,
        viewportHeight: test.viewport_height,
        stepResults: [...stepResults],
        suggestion: crashSuggestion,
      });

      stepResults.push({
        id: 'browser_crash',
        action: 'browser_crash_detection',
        status: 'failed',
        duration_ms: Date.now() - visualStepStart,
        error: testError,
        metadata: {
          originalError: visualStepError,
          isBrowserCrash: true,
          crashDetectedAt: new Date().toISOString(),
          crashDumpFile: crashDumpFile || undefined,
          suggestion: crashSuggestion,
          canRetry: true,
        },
      } as StepResult);
    } else if (!isNavigationError) {
      testStatus = 'failed';
      testError = `Visual regression test failed: ${visualStepError}`;

      // Try to capture screenshot on failure
      try {
        let buffer: Buffer;
        if (test.capture_mode === 'element' && test.element_selector) {
          try {
            const element = page.locator(test.element_selector);
            buffer = await element.screenshot();
          } catch {
            buffer = await page.screenshot({ fullPage: true });
          }
        } else if (test.capture_mode === 'viewport') {
          buffer = await page.screenshot({ fullPage: false });
        } else {
          buffer = await page.screenshot({ fullPage: true });
        }
        screenshot_base64 = buffer.toString('base64');
      } catch {
        // Ignore screenshot errors
      }

      stepResults.push({
        id: 'visual_error',
        action: 'visual_regression',
        status: 'failed',
        duration_ms: Date.now() - visualStepStart,
        error: visualStepError,
      });
    }
  }

  return {
    testStatus,
    testError,
    stepResults,
    screenshot_base64,
    visualComparison,
    baselineScreenshotBase64,
    diffImageBase64,
    diffPercentage,
    isQuotaExceeded,
    quotaExceededSuggestions,
    // Feature #1913: Multi-viewport results
    viewportResults: viewportResults.length > 0 ? viewportResults : undefined,
  };
}
