// Script to extract executeTest function from test-runs.ts
const fs = require('fs');
const path = require('path');

const testRunsPath = path.join(__dirname, '../backend/src/routes/test-runs.ts');
const outputPath = path.join(__dirname, '../backend/src/routes/test-runs/test-executor.ts');

// Read test-runs.ts
const content = fs.readFileSync(testRunsPath, 'utf8');
const lines = content.split('\n');

// Find executeTest function boundaries (lines 512-5104 based on analysis)
// In 0-indexed: 511-5103
const executeTestStart = 511; // Line 512 in 1-indexed
const executeTestEnd = 5104; // Line 5105 (end of function) in 1-indexed

// Also extract the launchBrowser helper (lines 5107-5117)
const launchBrowserStart = 5106; // Line 5107
const launchBrowserEnd = 5117; // Line 5118

// Extract the code
const executeTestCode = lines.slice(executeTestStart, executeTestEnd);
const launchBrowserCode = lines.slice(launchBrowserStart, launchBrowserEnd);

// Create imports for the new module
const imports = `/**
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

import { Browser, BrowserContext, Page, chromium, firefox, webkit } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';

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
} from './execution';

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
} from './visual-regression';

import {
  SCREENSHOTS_DIR,
  TRACES_DIR,
  VIDEOS_DIR,
  StorageQuotaExceededError,
  checkStorageQuota,
  getSimulatedStorageQuotaExceeded,
} from './storage';

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
} from './healing';

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
} from './test-simulation';

import {
  CrashDumpData,
  ScreenshotUploadConfig,
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
} from './execute-test-helpers';

import {
  detectCircularImports,
  validateK6ScriptImports,
  validateK6Thresholds,
  validateK6ScriptSyntax,
  detectRequiredEnvVars,
  detectCustomMetrics,
  generateCustomMetricValues,
} from './k6-helpers';

import {
  detectCspIssues,
  detectNonHtmlContent,
  detectLoginPage,
  detectMixedContent,
  generateLighthouseMetrics,
  generateLighthouseOpportunities,
  generateLighthouseDiagnostics,
  generateLighthousePassedAudits,
  classifyLighthouseError,
  generateLighthouseErrorMessage,
} from './lighthouse-executor';

import {
  generateSimulatedViolations,
  calculateA11yScore,
  countViolationsByImpact,
  checkA11yThresholds,
  buildTestEngineInfo,
} from './accessibility-helpers';

import { tests, testSuites, IgnoreRegion } from '../test-suites';
import { projects, getProjectVisualSettings, getProjectHealingSettings } from '../projects';

// Event emitter type - will be passed in from test-runs.ts
export type EmitRunEventFn = (runId: string, orgId: string, event: string, data: any) => void;

// Module-level event emitter reference
let emitRunEvent: EmitRunEventFn;

export function setTestExecutorEmitter(emitter: EmitRunEventFn) {
  emitRunEvent = emitter;
}

`;

// Combine into new module
const outputContent = imports + '\n' + executeTestCode.join('\n') + '\n\n' + launchBrowserCode.join('\n') + '\n\n// Export the functions\nexport { executeTest, launchBrowser };\n';

// Write the new module
fs.writeFileSync(outputPath, outputContent);

console.log('Successfully extracted executeTest to:', outputPath);
console.log('Lines in new module:', outputContent.split('\n').length);
console.log('');
console.log('Next steps:');
console.log('1. Run the removal script to remove executeTest from test-runs.ts');
console.log('2. Update test-runs.ts to import executeTest from ./test-runs/test-executor');
console.log('3. Update test-runs.ts to import launchBrowser from ./test-runs/test-executor');
