/**
 * Functional/E2E Test Executor Module
 * Extracted from test-executor.ts for code organization (Feature #249)
 *
 * This module contains the step execution logic for E2E/functional tests.
 * Includes:
 * - Step execution (navigate, click, fill, wait, assert_text, screenshot, etc.)
 * - Test healing with selector fallbacks
 * - Visual checkpoint handling
 * - Accessibility check steps
 * - Console error assertions
 * - Live screenshot streaming
 */

import { Page, Browser } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';

// Import types and stores from sibling modules
import {
  ConsoleLog,
  StepResult,
} from './execution.js';

import { TestStep } from '../test-suites/types.js';
// Simplified accessibility results for inline a11y checks
interface A11yStepResults {
  wcag_level: string;
  violations: {
    count: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    items: Array<{
      id: string;
      impact: 'critical' | 'serious' | 'moderate' | 'minor';
      description: string;
      wcagTags: string[];
      nodes: Array<{ html: string; target: string[] }>;
    }>;
  };
  config: {
    wcagLevel: string;
    failOnAny: boolean;
    failOnCritical: boolean;
    threshold: number;
  };
}

import {
  AntiAliasingOptions,
  BASELINES_DIR,
  compareScreenshots,
} from './visual-regression.js';

import {
  getAutoHealThreshold,
  isHealingStrategyEnabled,
  getEnabledStrategies,
  waitForHealingApproval,
  recordSuccessfulHeal,
  trackHealingAttempt,
  trackHealingSuccess,
  trackHealingFailure,
  PendingHealingApproval,
} from './healing.js';

import {
  findElementByVisualMatch,
} from './execute-test-helpers.js';

import { getTestSuite } from '../test-suites.js';

// Feature #448: Use structured logger instead of console.*
import { createLogger } from '../../services/logger.js';

const log = createLogger('executor-functional');

// Note: SelectorStrategy and ExecutableStep are no longer needed -
// TestStep now includes selectorStrategies property (Feature #414)

// Event emitter type - passed in from caller
export type EmitRunEventFn = (runId: string, orgId: string, event: string, data: Record<string, unknown>) => void;

// Configuration for E2E step execution
export interface E2EStepExecutionConfig {
  test: {
    id: string;
    name: string;
    suite_id?: string;
    organization_id?: string;
    viewport_width?: number;
    viewport_height?: number;
    anti_aliasing_tolerance?: 'off' | 'low' | 'medium' | 'high';
    color_threshold?: number;
    steps: TestStep[];
  };
  page: Page;
  browser: Browser;
  runId: string;
  orgId: string;
  emitRunEvent: EmitRunEventFn;
  consoleLogs: ConsoleLog[];
}

// Result of E2E step execution
export interface E2EStepExecutionResult {
  stepResults: StepResult[];
  testStatus: 'passed' | 'failed' | 'error' | 'warning';
  testError?: string;
  screenshot_base64?: string;
  baselineScreenshotBase64?: string;
  diffImageBase64?: string;
}

/**
 * Execute E2E test steps
 * This is the main step execution loop for functional/E2E tests
 */
export async function executeE2ESteps(config: E2EStepExecutionConfig): Promise<E2EStepExecutionResult> {
  const { test, page, runId, orgId, emitRunEvent, consoleLogs } = config;

  const stepResults: StepResult[] = [];
  let testStatus: 'passed' | 'failed' | 'error' | 'warning' = 'passed';
  let testError: string | undefined;
  let screenshot_base64: string | undefined;
  let baselineScreenshotBase64: string | undefined;
  let diffImageBase64: string | undefined;

  // Execute each step
  for (let stepIndex = 0; stepIndex < test.steps.length; stepIndex++) {
    const step = test.steps[stepIndex];
    const stepStart = Date.now();
    let stepStatus: 'passed' | 'failed' | 'skipped' = 'passed';
    let stepError: string | undefined;
    let stepA11yResults: A11yStepResults | undefined;

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
              // Feature #38: Wait for network idle after click to ensure AJAX completes
              try {
                await page.waitForLoadState('networkidle', { timeout: 3000 });
              } catch { /* Ignore timeout - some clicks don't trigger AJAX */ }
            } catch (clickErr: unknown) {
              // Try healing if element not found
              const healResult = await tryHealing(
                'click',
                step,
                page,
                test,
                runId,
                stepIndex,
                orgId,
                isOptionalStep,
                clickErr
              );

              if (healResult.healed) {
                // Healing succeeded, continue
              } else if (healResult.skipped) {
                stepStatus = 'skipped';
                stepError = healResult.error;
                break;
              } else {
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
              // Try healing if element not found
              const healResult = await tryHealingForFill(
                step,
                page,
                test,
                runId,
                stepIndex,
                orgId,
                isOptionalStep,
                fillErr
              );

              if (healResult.healed) {
                // Healing succeeded, continue
              } else if (healResult.skipped) {
                stepStatus = 'skipped';
                stepError = healResult.error;
                break;
              } else {
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
          const buffer = await page.screenshot();
          screenshot_base64 = buffer.toString('base64');
          break;
        }

        case 'visual_checkpoint': {
          const result = await executeVisualCheckpoint(step, stepIndex, page, test);
          if (result.failed) {
            stepStatus = 'failed';
            stepError = result.error;
            testStatus = 'failed';
            testError = stepError;
            if (result.diffImageBase64) diffImageBase64 = result.diffImageBase64;
            if (result.baselineScreenshotBase64) baselineScreenshotBase64 = result.baselineScreenshotBase64;
          }
          if (result.screenshot_base64) screenshot_base64 = result.screenshot_base64;
          break;
        }

        case 'accessibility_check': {
          const result = await executeAccessibilityCheckStep(step, page, consoleLogs);
          if (result.failed) {
            stepStatus = 'failed';
            stepError = result.error;
            testStatus = 'failed';
            testError = stepError;
          }
          if (result.screenshot_base64) screenshot_base64 = result.screenshot_base64;
          // Store accessibility results in step-scoped variable for later use
          stepA11yResults = result.a11yResults;
          break;
        }

        case 'assert_no_console_errors': {
          const result = assertNoConsoleErrors(step, consoleLogs);
          if (result.failed) {
            stepStatus = 'failed';
            stepError = result.error;
            testStatus = 'failed';
            testError = stepError;
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
    if (step.action === 'accessibility_check' && stepA11yResults) {
      stepResult.accessibility = {
        violations: stepA11yResults.violations.items,
        score: 100 - stepA11yResults.violations.count, // Simple score calculation
        wcagLevel: stepA11yResults.wcag_level as 'A' | 'AA' | 'AAA',
      };
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
    if (stepStatus === 'passed' && page) {
      try {
        await page.waitForTimeout(100);
        const stepScreenshot = await page.screenshot({
          type: 'jpeg',
          quality: 50,
          timeout: 5000
        });
        const stepScreenshotBase64 = stepScreenshot.toString('base64');

        emitRunEvent(runId, orgId, 'step:screenshot', {
          testId: test.id,
          testName: test.name,
          runId,
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
        log.warn({ stepIndex, error: String(screenshotErr) }, 'Failed to capture live screenshot');
      }
    }

    // Stop execution if step failed
    if (stepStatus === 'failed') {
      try {
        const buffer = await page.screenshot();
        screenshot_base64 = buffer.toString('base64');
      } catch {
        // Ignore screenshot errors
      }
      break;
    }
  }

  return {
    stepResults,
    testStatus,
    testError,
    screenshot_base64,
    baselineScreenshotBase64,
    diffImageBase64,
  };
}

// Helper interface for healing results
interface HealingResult {
  healed: boolean;
  skipped: boolean;
  error?: string;
}

/**
 * Try healing for click actions
 */
async function tryHealing(
  action: 'click',
  step: TestStep,
  page: Page,
  test: { id: string; suite_id?: string },
  runId: string,
  stepIndex: number,
  orgId: string,
  isOptionalStep: boolean,
  originalErr: unknown
): Promise<HealingResult> {
  const errorMessage = originalErr instanceof Error ? originalErr.message : String(originalErr);

  // Check if this is a healable error
  if (!errorMessage.includes('strict mode') && !errorMessage.includes('not found') &&
      !errorMessage.includes('timeout') && !errorMessage.includes('waiting for')) {
    if (isOptionalStep) {
      log.debug({ selector: step.selector, reason: step.optionalReason || 'user_marked' }, 'Optional step skipped');
      return { healed: false, skipped: true, error: `Optional element not found: ${step.selector}` };
    }
    return { healed: false, skipped: false };
  }

  log.info({ selector: step.selector }, 'Element not found, initiating healing');

  // Get project ID for stats tracking
  const healingSuite = test.suite_id ? await getTestSuite(test.suite_id) : undefined;
  const healingProjectId = healingSuite?.project_id || null;

  trackHealingAttempt(healingProjectId);

  const projectAutoHealThreshold = await getAutoHealThreshold(healingProjectId);
  const enabledStrategies = await getEnabledStrategies(healingProjectId);
  log.debug({ projectId: healingProjectId, threshold: projectAutoHealThreshold, enabledStrategies }, 'Healing configuration loaded');

  const altSelectors = step.selectorStrategies?.filter(s => s.selector !== step.selector) || [];

  // Try alternate selectors
  for (const alt of altSelectors.sort((a, b) => b.confidence - a.confidence)) {
    if (alt.strategy === 'visual-match') continue;
    if (!(await isHealingStrategyEnabled(healingProjectId, alt.strategy))) {
      log.debug({ strategy: alt.strategy }, 'Skipping disabled healing strategy');
      continue;
    }
    if (alt.confidence < projectAutoHealThreshold) {
      log.debug({ strategy: alt.strategy, confidence: alt.confidence, threshold: projectAutoHealThreshold }, 'Skipping healing strategy below threshold');
      continue;
    }
    try {
      log.debug({ selector: alt.selector, confidence: alt.confidence }, 'Trying alternate selector');
      await page.click(alt.selector, { timeout: 5000 });
      try {
        await page.waitForLoadState('networkidle', { timeout: 3000 });
      } catch { /* Ignore timeout */ }
      log.info({ strategy: alt.strategy, selector: alt.selector, threshold: projectAutoHealThreshold }, 'Healing succeeded with auto-apply');
      recordSuccessfulHeal(runId, test.id, stepIndex, step.selector!, alt.selector, alt.strategy, alt.confidence, orgId);
      trackHealingSuccess(healingProjectId, alt.strategy);
      return { healed: true, skipped: false };
    } catch (altErr) {
      log.debug({ strategy: alt.strategy, selector: alt.selector }, 'Healing attempt failed');
    }
  }

  // Try visual matching as last resort
  if (await isHealingStrategyEnabled(healingProjectId, 'visual-match')) {
    const visualFingerprint = step.visualFingerprint;
    if (visualFingerprint) {
      log.debug('All selectors failed or below threshold, attempting visual matching');
      const visualMatch = await findElementByVisualMatch(page, visualFingerprint);

      if (visualMatch.found && visualMatch.matchLocation && visualMatch.confidence >= projectAutoHealThreshold) {
        const centerX = visualMatch.matchLocation.x + visualMatch.matchLocation.width / 2;
        const centerY = visualMatch.matchLocation.y + visualMatch.matchLocation.height / 2;
        await page.mouse.click(centerX, centerY);
        try {
          await page.waitForLoadState('networkidle', { timeout: 3000 });
        } catch { /* Ignore timeout */ }
        log.info({ x: centerX, y: centerY }, 'Healing succeeded with visual-match click');
        recordSuccessfulHeal(runId, test.id, stepIndex, step.selector!, `visual-match:${visualFingerprint}`, 'visual-match', visualMatch.confidence, orgId);
        trackHealingSuccess(healingProjectId, 'visual-match');
        return { healed: true, skipped: false };
      } else if (visualMatch.found && visualMatch.matchLocation) {
        // Below threshold - require manual approval
        log.info({ confidence: visualMatch.confidence * 100, threshold: projectAutoHealThreshold * 100 }, 'Visual match below threshold - waiting for approval');

        const approvalId = `heal-${runId}-${test.id}-${stepIndex}-${Date.now()}`;
        const pendingApproval: PendingHealingApproval = {
          id: approvalId,
          runId,
          testId: test.id,
          stepIndex,
          originalSelector: step.selector!,
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
          try {
            await page.waitForLoadState('networkidle', { timeout: 3000 });
          } catch { /* Ignore timeout */ }
          log.info({ x: centerX, y: centerY }, 'Visual-match healing approved');
          recordSuccessfulHeal(runId, test.id, stepIndex, step.selector!, `visual-match:${visualFingerprint}`, 'visual-match', visualMatch.confidence, orgId);
          trackHealingSuccess(healingProjectId, 'visual-match');
          return { healed: true, skipped: false };
        } else {
          log.info('Visual-match healing rejected or timed out');
        }
      } else {
        log.debug({ confidence: visualMatch.confidence * 100 }, 'Visual match failed');
      }
    }
  }

  // Healing failed
  if (isOptionalStep) {
    log.debug({ selector: step.selector, reason: step.optionalReason || 'user_marked' }, 'Optional step skipped');
    return { healed: false, skipped: true, error: `Optional element not found: ${step.selector}` };
  }

  trackHealingFailure(healingProjectId);
  return { healed: false, skipped: false };
}

/**
 * Try healing for fill/type actions
 */
async function tryHealingForFill(
  step: TestStep,
  page: Page,
  test: { id: string; suite_id?: string },
  runId: string,
  stepIndex: number,
  orgId: string,
  isOptionalStep: boolean,
  originalErr: unknown
): Promise<HealingResult> {
  const errorMessage = originalErr instanceof Error ? originalErr.message : String(originalErr);

  if (!errorMessage.includes('strict mode') && !errorMessage.includes('not found') &&
      !errorMessage.includes('timeout') && !errorMessage.includes('waiting for')) {
    if (isOptionalStep) {
      log.debug({ selector: step.selector, reason: step.optionalReason || 'user_marked' }, 'Optional fill step skipped');
      return { healed: false, skipped: true, error: `Optional element not found: ${step.selector}` };
    }
    return { healed: false, skipped: false };
  }

  log.info({ selector: step.selector }, 'Element not found, initiating healing');

  const healingSuite = test.suite_id ? await getTestSuite(test.suite_id) : undefined;
  const healingProjectId = healingSuite?.project_id || null;

  trackHealingAttempt(healingProjectId);

  const projectThreshold = await getAutoHealThreshold(healingProjectId);
  const enabledStrategies = await getEnabledStrategies(healingProjectId);
  log.debug({ projectId: healingProjectId, threshold: projectThreshold, enabledStrategies }, 'Healing configuration for fill');

  const altSelectors = step.selectorStrategies?.filter(s => s.selector !== step.selector) || [];

  for (const alt of altSelectors.sort((a, b) => b.confidence - a.confidence)) {
    if (alt.strategy === 'visual-match') continue;
    if (!(await isHealingStrategyEnabled(healingProjectId, alt.strategy))) {
      continue;
    }
    if (alt.confidence < projectThreshold) {
      continue;
    }
    try {
      log.debug({ selector: alt.selector, confidence: alt.confidence }, 'Trying alternate selector');
      await page.fill(alt.selector, step.value!, { timeout: 5000 });
      log.info({ strategy: alt.strategy, selector: alt.selector, threshold: projectThreshold }, 'Fill healing succeeded with auto-apply');
      recordSuccessfulHeal(runId, test.id, stepIndex, step.selector!, alt.selector, alt.strategy, alt.confidence, orgId);
      trackHealingSuccess(healingProjectId, alt.strategy);
      return { healed: true, skipped: false };
    } catch (altErr) {
      log.debug({ strategy: alt.strategy, selector: alt.selector }, 'Healing attempt failed');
    }
  }

  // Try visual matching for fill
  if (await isHealingStrategyEnabled(healingProjectId, 'visual-match')) {
    const visualFingerprint = step.visualFingerprint;
    if (visualFingerprint) {
      log.debug('All fill selectors failed, attempting visual matching');
      const visualMatch = await findElementByVisualMatch(page, visualFingerprint);

      if (visualMatch.found && visualMatch.matchLocation && visualMatch.confidence >= projectThreshold) {
        const centerX = visualMatch.matchLocation.x + visualMatch.matchLocation.width / 2;
        const centerY = visualMatch.matchLocation.y + visualMatch.matchLocation.height / 2;
        await page.mouse.click(centerX, centerY);
        await page.keyboard.type(step.value!);
        log.info({ x: centerX, y: centerY }, 'Fill healing succeeded with visual-match');
        recordSuccessfulHeal(runId, test.id, stepIndex, step.selector!, `visual-match:${visualFingerprint}`, 'visual-match', visualMatch.confidence, orgId);
        trackHealingSuccess(healingProjectId, 'visual-match');
        return { healed: true, skipped: false };
      } else if (visualMatch.found && visualMatch.matchLocation) {
        log.info({ confidence: visualMatch.confidence * 100, threshold: projectThreshold * 100 }, 'Fill visual match below threshold - waiting for approval');

        const approvalId = `heal-${runId}-${test.id}-${stepIndex}-fill-${Date.now()}`;
        const pendingApproval: PendingHealingApproval = {
          id: approvalId,
          runId,
          testId: test.id,
          stepIndex,
          originalSelector: step.selector!,
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
          await page.keyboard.type(step.value!);
          log.info({ x: centerX, y: centerY }, 'Fill visual-match healing approved');
          recordSuccessfulHeal(runId, test.id, stepIndex, step.selector!, `visual-match:${visualFingerprint}`, 'visual-match', visualMatch.confidence, orgId);
          trackHealingSuccess(healingProjectId, 'visual-match');
          return { healed: true, skipped: false };
        } else {
          log.info('Fill visual-match healing rejected or timed out');
        }
      } else {
        log.debug({ confidence: visualMatch.confidence * 100 }, 'Visual match failed');
      }
    }
  }

  if (isOptionalStep) {
    log.debug({ selector: step.selector, reason: step.optionalReason || 'user_marked' }, 'Optional fill step skipped');
    return { healed: false, skipped: true, error: `Optional element not found: ${step.selector}` };
  }

  trackHealingFailure(healingProjectId);
  return { healed: false, skipped: false };
}

/**
 * Execute visual checkpoint step
 */
async function executeVisualCheckpoint(
  step: TestStep,
  stepIndex: number,
  page: Page,
  test: { id: string; anti_aliasing_tolerance?: string; color_threshold?: number; organization_id?: string }
): Promise<{
  failed: boolean;
  error?: string;
  screenshot_base64?: string;
  baselineScreenshotBase64?: string;
  diffImageBase64?: string;
}> {
  const checkpointBuffer = await page.screenshot();
  const screenshot_base64 = checkpointBuffer.toString('base64');

  const checkpointName = step.checkpointName || `checkpoint-${stepIndex}`;
  const checkpointThreshold = step.checkpointThreshold ?? 0.1;

  const checkpointBaselineKey = `${test.id}-${checkpointName}`;
  const checkpointBaselinePath = path.join(BASELINES_DIR, `${checkpointBaselineKey}.png`);

  if (fs.existsSync(checkpointBaselinePath)) {
    const checkpointBaseline = fs.readFileSync(checkpointBaselinePath);
    const checkpointAaOptions: AntiAliasingOptions = {
      tolerance: (test.anti_aliasing_tolerance ?? 'off') as 'off' | 'low' | 'medium' | 'high',
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
      return {
        failed: true,
        error: `Visual checkpoint "${checkpointName}" failed: ${checkpointComparison.diffPercentage.toFixed(2)}% difference (threshold: ${checkpointThreshold}%)`,
        screenshot_base64,
        baselineScreenshotBase64: checkpointBaseline.toString('base64'),
        diffImageBase64: checkpointComparison.diffImage,
      };
    } else {
      log.info({ checkpoint: checkpointName, diffPercentage: checkpointComparison.diffPercentage ?? 0 }, 'Visual checkpoint passed');
      return { failed: false, screenshot_base64 };
    }
  } else {
    fs.mkdirSync(BASELINES_DIR, { recursive: true });
    fs.writeFileSync(checkpointBaselinePath, checkpointBuffer);
    log.info({ checkpoint: checkpointName }, 'Created baseline for visual checkpoint');
    return { failed: false, screenshot_base64 };
  }
}

/**
 * Execute accessibility check step within E2E test
 */
async function executeAccessibilityCheckStep(
  step: TestStep,
  page: Page,
  consoleLogs: ConsoleLog[]
): Promise<{
  failed: boolean;
  error?: string;
  screenshot_base64?: string;
  a11yResults?: A11yStepResults;
}> {
  const a11yStepConfig = {
    wcagLevel: step.a11y_wcag_level || 'AA',
    failOnAny: step.a11y_fail_on_any === true,
    failOnCritical: step.a11y_fail_on_critical !== false,
    threshold: step.a11y_threshold || 0,
  };

  log.debug({ config: a11yStepConfig }, 'Running axe-core accessibility scan');

  const a11yScreenshot = await page.screenshot();
  const screenshot_base64 = a11yScreenshot.toString('base64');

  const stepAxeTags: string[] = ['wcag2a', 'wcag21a'];
  if (a11yStepConfig.wcagLevel === 'AA' || a11yStepConfig.wcagLevel === 'AAA') {
    stepAxeTags.push('wcag2aa', 'wcag21aa');
  }
  if (a11yStepConfig.wcagLevel === 'AAA') {
    stepAxeTags.push('wcag2aaa', 'wcag21aaa');
  }

  const stepAxeResults = await new AxeBuilder({ page })
    .withTags(stepAxeTags)
    .analyze();

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

  const a11yResults = {
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
    log.info({ reason: a11yStepFailReason }, 'Accessibility check step failed');
    return {
      failed: true,
      error: `Accessibility check failed: ${a11yStepFailReason}`,
      screenshot_base64,
      a11yResults,
    };
  } else {
    log.info({ violations: totalStepViolations }, 'Accessibility check step passed (within threshold)');
    return { failed: false, screenshot_base64, a11yResults };
  }
}

/**
 * Assert no console errors step
 */
function assertNoConsoleErrors(
  step: TestStep,
  consoleLogs: ConsoleLog[]
): { failed: boolean; error?: string } {
  const severityLevel = step.value || 'error';
  let consoleErrors: typeof consoleLogs = [];

  if (severityLevel === 'critical') {
    consoleErrors = consoleLogs.filter(log => log.level === 'error');
  } else if (severityLevel === 'warn') {
    consoleErrors = consoleLogs.filter(log => log.level === 'error' || log.level === 'warn');
  } else {
    consoleErrors = consoleLogs.filter(log => log.level === 'error');
  }

  if (consoleErrors.length > 0) {
    const errorMessages = consoleErrors.map(e => `[${e.level}] ${e.message.substring(0, 100)}`).join('; ');
    log.info({ errorCount: consoleErrors.length }, 'Console errors check failed');
    return {
      failed: true,
      error: `Found ${consoleErrors.length} console error(s): ${errorMessages}`,
    };
  } else {
    log.debug({ severity: severityLevel }, 'Console errors check passed - no errors detected');
    return { failed: false };
  }
}
