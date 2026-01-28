import { FastifyInstance } from 'fastify';
import { authenticate, requireScopes, getOrganizationId, JwtPayload } from '../middleware/auth';
import { getTestSuite, getTest, listTests, updateTest, IgnoreRegion } from './test-suites';
import { getProjectEnvVars, getProjectVisualSettings, getProjectHealingSettings } from './projects';
import { getProject } from './projects/stores';
import { getTestRun } from '../services/repositories/test-runs';
import { chromium, firefox, webkit, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import archiver from 'archiver';
// pixelmatch is imported dynamically since v6+ is ESM-only
// import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

// Feature #1372: AI Analysis module functions are now available via ./test-runs/ai-analysis.ts
// Note: They are currently still defined in test-runs.ts within the route handler scope
// Full extraction will be completed in a future refactoring iteration

// Feature #1369: Import visual regression module
// Note: Some functions have enhanced local versions with quota checking etc.
// Importing types and baseline metadata/history functions from the module
import {
  // Types - re-exported from module
  VisualComparisonResult,
  BaselineMetadata,
  BaselineHistoryEntry,
  LoadBaselineResult as LoadBaselineResultType,
  DiffColorConfig,
  AntiAliasingOptions,
  // Feature #1054: Visual matching types
  VisualMatchResult,
  RejectionMetadata,
  // Directory constants
  BASELINES_DIR,
  // Baseline metadata functions
  getBaselineMetadataKey,
  setBaselineMetadata,
  getBaselineMetadata,
  // Baseline history functions
  getBaselineHistoryKey,
  addBaselineHistoryEntry,
  getBaselineHistory,
  getBaselineHistoryEntry,
  getBaselineHistoryImage,
  // Diff colors
  getDiffColors,
  setDiffColors,
  // Anti-aliasing
  getPixelmatchOptions,
  // Ignore regions
  applyIgnoreRegions,
  // Screenshot comparison
  compareScreenshots,
  // Feature #1054: Rejection metadata functions
  getRejectionMetadataKey,
  setRejectionMetadata,
  getRejectionMetadata,
  // Feature #1054: Visual matching helpers
  extractRegion,
  // Baseline path helper
  getBaselinePath,
  // Baseline file operations
  loadBaseline,
  loadBaselineWithValidation,
  hasBaseline,
  saveBaseline as saveBaselineToFile,
} from './test-runs/visual-regression';

// Feature #1370: Import alerts module
import {
  // Types
  AlertCondition,
  AlertChannelType,
  AlertChannel,
  SentEmailLog,
  SlackConnection,
  SlackChannel,
  SlackLogEntry,
  WebhookLogEntry,
  // In-Memory Stores
  alertChannels,
  emailLog,
  slackConnections,
  slackLog,
  webhookLog,
  // Alert Functions
  sendSlackAlert,
  sendEmailAlert,
  sendWebhookAlert,
  checkAndSendAlerts as checkAndSendAlertsBase,
} from './test-runs/alerts';

// Feature #1371: Import storage module
import {
  // Constants
  SCREENSHOTS_DIR,
  TRACES_DIR,
  VIDEOS_DIR,
  // Types
  StorageQuotaConfig,
  DEFAULT_STORAGE_QUOTA,
  // Error Class
  StorageQuotaExceededError,
  // Artifact Retention
  artifactRetentionSettings,
  // Storage Calculation
  calculateDirectorySize,
  calculateTotalStorageUsage,
  // Storage Quota Checking
  checkStorageQuota,
  // Simulation Functions
  setSimulatedStorageQuotaExceeded,
  getSimulatedStorageQuotaExceeded,
  // Utility Functions
  formatBytes,
} from './test-runs/storage';

// Feature #1372: Import AI analysis module
import {
  // Types
  LLMRootCauseAnalysis,
  TestResultInput,
  TestRunInput,
  // Cache
  llmExplanationCache,
  LLM_CACHE_TTL_SECONDS,
  // Functions
  generateErrorHash,
  generateLLMRootCauseAnalysis,
  getLLMCacheStats,
  clearLLMCacheEntry,
} from './test-runs/ai-analysis';

// Feature #1356: Import healing module
import {
  // Types
  PendingHealingApproval,
  HealingRecord,
  SelectorHistoryEntry,
  HealingEventEntry,
  DOMChangeContext,
  // In-Memory Stores
  pendingHealingApprovals,
  pendingHealingUpdates,
  // Socket.IO Setup
  setHealingSocketIO,
  // Project Settings Helpers
  getAutoHealThreshold,
  isHealingStrategyEnabled,
  getEnabledStrategies,
  // Healing Approval Functions
  waitForHealingApproval,
  resolveHealingApproval,
  // Healing Record Functions
  recordSuccessfulHeal,
  applyHealedSelector,
  dismissHealingUpdate,
  // History Functions
  getSelectorHistory,
  getHealingHistory,
  recordHealingEvent,
  markHealingEventApplied,
  // Statistics Functions
  trackHealingAttempt,
  trackHealingSuccess,
  trackHealingFailure,
  getHealingStats,
} from './test-runs/healing';

// Feature #1368: Import execution module types and stores
// Feature #1356: Migrated stores from local to execution.ts for shared state
// Feature #1356: Cleaned up - using types directly without aliases
import {
  // Types - used directly throughout this file
  BrowserType,
  TestRunStatus,
  TestType,
  TriggerType,
  ConsoleLog,
  NetworkRequest,
  StepResult,
  TestRunResult,
  TestRun,
  BrowserState,
  SelectorOverride,
  HealedSelectorEntry,
  // Shared stores - now imported from execution.ts
  testRuns,
  runningBrowsers,
  selectorOverrides,
  healedSelectorHistory,
  // Viewport presets - used directly, no local copy needed
  VIEWPORT_PRESETS,
  // Browser launch helper
  launchBrowser as launchBrowserFromModule,
  // Execution state helpers
  isRunCancelled as isRunCancelledHelper,
  isRunPaused as isRunPausedHelper,
} from './test-runs/execution';

// Feature #1356: Import root cause helpers module
import {
  // Functions
  generateRelatedCommits,
  generateCommitDetails,
} from './test-runs/root-cause-helpers';

// Feature #1356: Import root cause analysis module
import {
  generateRootCauseAnalysis,
  generateEvidenceArtifacts,
  generateSuggestedActions,
  generateHistoricalPatternMatch,
} from './test-runs/root-cause-analysis';

// Feature #1356: Import explanations module
import {
  generateCrossTestCorrelation,
  generateHumanReadableExplanation,
  generateTechnicalExplanation,
  generateExecutiveSummary,
} from './test-runs/explanations';

// Feature #1356: Import security routes modules
import { securityRoutes } from './test-runs/security';
import { securityAdvancedRoutes } from './test-runs/security-advanced';

// Feature #1356: Import webhook subscription routes module
import { webhookSubscriptionRoutes } from './test-runs/webhook-subscriptions';

// Feature #1356: Import slack integration routes module
import { slackIntegrationRoutes } from './test-runs/slack-integration';

// Feature #1356: Import alert channels routes module
import { alertChannelRoutes } from './test-runs/alert-channels';

// Feature #1356: Import AI failure analysis routes module
import { aiFailureAnalysisRoutes } from './test-runs/ai-failure-analysis';

// Feature #1356: Import baseline routes module
import { baselineRoutes, failedUploads as failedUploadsFromModule } from './test-runs/baseline-routes';

// Feature #1356: Import organization settings routes module
import { organizationSettingsRoutes } from './test-runs/organization-settings';

// Feature #1356: Import healing routes module
import { healingRoutes } from './test-runs/healing-routes';

// Feature #1356: Import artifact routes module
import { artifactRoutes } from './test-runs/artifact-routes';

// Feature #1356: Import results routes module
import { resultsRoutes } from './test-runs/results-routes';

// Feature #1356: Import visual batch routes module
import { visualBatchRoutes } from './test-runs/visual-batch-routes';

// Feature #1356: Import browser/viewport routes module
import { browserViewportRoutes } from './test-runs/browser-viewport-routes';

// Feature #1356: Import failure patterns routes module
import { failurePatternsRoutes } from './test-runs/failure-patterns-routes';

// Feature #1356: Import recording routes module
import { recordingRoutes } from './test-runs/recording-routes';

// Feature #1356: Import run core routes module
import { runCoreRoutes, setRunCoreEmitter } from './test-runs/run-core-routes';

// Feature #1356: Import run control routes module
import { runControlRoutes, setRunControlEmitter } from './test-runs/run-control-routes';

// Feature #1356: Import visual storage routes module
import { visualStorageRoutes } from './test-runs/visual-storage-routes';

// Feature #1356: Import review and export routes module
import { reviewExportRoutes } from './test-runs/review-export-routes';

// Feature #1356: Import selector override routes module
import { selectorOverrideRoutes } from './test-runs/selector-override-routes';

// Feature #1356: Import run data routes module (logs, console, network, metrics, environment, compare)
import { runDataRoutes } from './test-runs/run-data-routes';

// Feature #1356: Import visual approval routes module
import { visualApprovalRoutes } from './test-runs/visual-approval-routes';

// Feature #1356: Import run trigger routes module (POST routes for suites/:suiteId/runs, tests/:testId/runs)
import { createRunTriggerRoutes } from './test-runs/run-trigger-routes';

// Feature #1356: Import test simulation routes module
import {
  testSimulationRoutes,
  // Simulation state objects for direct access
  simulatedLighthouseError,
  simulatedAuthRedirect,
  simulatedAuditTimeout,
  simulatedLighthouseBrowserCrash,
  simulatedLighthouseNonHtmlResponse,
  simulatedK6RuntimeError,
  simulatedK6ServerUnavailable,
  simulatedK6ResourceExhaustion,
  // Getters/setters
  getSimulatedBrowserCrash,
  setSimulatedBrowserCrash,
  getSimulatedOversizedPage,
  setSimulatedOversizedPage,
  getCrashDumpsDir,
} from './test-runs/test-simulation';

// Feature #1356: Import webhook events module
import {
  sendRunStartedWebhook,
  sendRunCompletedWebhook,
  sendRunFailedWebhook,
  sendRunPassedWebhook,
  sendVisualDiffWebhook,
  sendPerformanceBudgetExceededWebhook,
  sendBaselineApprovedWebhook,
  sendScheduleTriggeredWebhook,
  sendFlakyTestWebhook,
  sendAccessibilityIssueWebhook,
} from './test-runs/webhook-events';

// Feature #1356: Import execute test helpers module
import {
  // Types
  CrashDumpData,
  ScreenshotUploadConfig,
  ScreenshotUploadError,
  FailedUpload,
  PageDimensionsResult,
  ScreenshotCaptureResult,
  SelectorRegionResult,
  // Constants
  DEFAULT_UPLOAD_CONFIG,
  DEFAULT_SCREENSHOT_TIMEOUT,
  MAX_PAGE_HEIGHT_FOR_FULL_CAPTURE,
  MAX_PAGE_WIDTH_FOR_FULL_CAPTURE,
  MAX_ESTIMATED_IMAGE_SIZE_MB,
  // Functions
  findElementByVisualMatch,
  saveCrashDump,
  saveScreenshotWithRetry,
  saveBaselineWithRetry,
  saveBaseline,
  checkPageDimensions,
  captureScreenshotWithTimeout,
  getIgnoreRegionsFromSelectors,
} from './test-runs/execute-test-helpers';

// Feature #1356: Import K6 helper functions from extracted module
import {
  // Types
  CircularImportCheckResult,
  K6ImportValidationResult,
  K6ThresholdError,
  K6ThresholdValidationResult,
  K6SyntaxValidationResult,
  K6EnvVarsResult,
  CustomMetricDefinition,
  CustomMetricValue,
  // Constants
  k6BuiltInModules,
  k6Metrics,
  thresholdOperators,
  thresholdFunctions,
  // Functions
  detectCircularImports,
  validateK6ScriptImports,
  validateK6Thresholds,
  validateK6ScriptSyntax,
  detectRequiredEnvVars,
  detectCustomMetrics,
  generateCustomMetricValues,
} from './test-runs/k6-helpers';

// Feature #1356: Import Lighthouse helper functions from extracted module
import {
  // Constants
  SSL_ERROR_MESSAGES,
  NETWORK_ERROR_MESSAGES,
  LOGIN_URL_PATTERNS,
  CSP_RESTRICTIVE_PATTERNS,
  LOGIN_CONTENT_INDICATORS,
  // Helper Functions
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
} from './test-runs/lighthouse-executor';

// Re-export healing types for external use
export {
  PendingHealingApproval,
  HealingRecord,
  SelectorHistoryEntry,
  HealingEventEntry,
  DOMChangeContext,
};

// Feature #1356: Re-export stores from execution.ts for backwards compatibility
// Other modules that import from test-runs.ts will continue to work
export { testRuns, runningBrowsers, selectorOverrides, healedSelectorHistory } from './test-runs/execution';

// Socket.IO server instance (set by index.ts after server starts)
let io: SocketIOServer | null = null;

// Function to set Socket.IO instance from index.ts
export function setSocketIO(socketIO: SocketIOServer) {
  io = socketIO;
  // Also set Socket.IO for the healing module
  setHealingSocketIO(socketIO);
  // Set emitter for test executor module (Feature #1356)
  setTestExecutorEmitter(emitRunEvent);
}

// Helper to emit test run events to both run room and org room
function emitRunEvent(runId: string, orgId: string, event: string, data: any) {
  if (io) {
    const payload = { runId, orgId, ...data };
    // Emit to run-specific room
    io.to(`run:${runId}`).emit(event, payload);
    // Also emit to organization room for cross-tab sync
    io.to(`org:${orgId}`).emit(event, payload);
    console.log(`[Socket.IO] Emitted ${event} for run ${runId} (org: ${orgId})`);
  }
}

// Feature #1356: Module extractions documented in ./test-runs/index.ts
// Modules: storage, healing, visual-regression, execute-test-helpers, alerts, webhooks
const failedUploads = failedUploadsFromModule;

// Re-exports for backwards compatibility
export { artifactRetentionSettings } from './test-runs/storage';
export { AlertCondition, AlertChannelType, AlertChannel, alertChannels, emailLog, slackConnections, SlackConnection, SlackChannel, slackLog } from './test-runs/alerts';
export { WebhookLogEntry, webhookLog } from './test-runs/alerts';

// Feature #1356: Import webhooks module
import {
  // Types
  WebhookSubscription,
  WebhookDeliveryLog,
  // In-Memory Stores
  webhookSubscriptions,
  webhookDeliveryLogs,
  webhookBatchQueues,
  webhookBatchTimers,
  // Helper Functions
  subscriptionMatchesProject,
  subscriptionMatchesResultStatus,
  subscriptionMatchesAnyResultStatus,
  // Delivery Functions
  deliverOrBatchWebhook,
  deliverWebhookWithRetry,
  getWebhookDeliveryLogs,
  // Template Functions
  applyPayloadTemplate,
} from './test-runs/webhooks';

// Re-export webhooks types
export { WebhookSubscription, webhookSubscriptions } from './test-runs/webhooks';

// Feature #1356: Import test executor module (extracted ~4600 lines)
import {
  executeTest,
  launchBrowser as launchBrowserFromExecutor,
  setTestExecutorEmitter,
  ExecuteTestConfig,
} from './test-runs/test-executor';


// Webhook infrastructure in ./test-runs/webhooks.ts, event functions in ./test-runs/webhook-events.ts

// Wrapper for checkAndSendAlerts that provides testSuites and projects access
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

// All types and stores imported from ./test-runs/execution.ts

// Route parameter interfaces
interface RunParams {
  suiteId: string;
}

interface TestRunParams {
  runId: string;
}

interface TestIdParams {
  testId: string;
}


// ============================================================================
// NOTE: executeTest and launchBrowser functions EXTRACTED to ./test-runs/test-executor.ts
// Feature #1356: Backend file size limit enforcement
// Total extracted: ~4600 lines of test execution logic
// ============================================================================


// Run tests asynchronously with real-time progress updates
export async function runTestsForRun(runId: string) {
  // Try in-memory first (for in-flight runs), then fall back to DB
  const run = testRuns.get(runId) || await getTestRun(runId);
  if (!run) return;

  const orgId = run.organization_id;

  // Update status to running
  run.status = 'running';
  run.started_at = new Date();
  testRuns.set(runId, run);

  // Emit run started event
  emitRunEvent(runId, orgId, 'run-start', {
    status: 'running',
    browser: run.browser,
    started_at: run.started_at.toISOString(),
  });

  // Feature #1283: Send test.run.started webhook
  const suite = await getTestSuite(run.suite_id);
  if (suite) {
    // Determine trigger info (default to 'manual' if not specified)
    const triggerInfo = {
      type: (run.triggered_by === 'schedule' ? 'scheduled' : run.triggered_by === 'api' ? 'api' : run.triggered_by === 'github' ? 'github_pr' : 'manual') as 'manual' | 'scheduled' | 'api' | 'github_pr',
      triggered_by: run.user_id,
      schedule_id: run.schedule_id,
      pr_number: run.pr_number,
    };

    // Send webhook asynchronously (don't wait)
    sendRunStartedWebhook(run, { id: suite.id, name: suite.name, project_id: suite.project_id }, triggerInfo)
      .catch(err => console.error('[WEBHOOK] Error sending run started webhook:', err));
  }

  let browser: Browser | null = null;
  const results: TestRunResult[] = [];
  // Use ExecuteTestConfig type from test-executor module
  let testsToRun: ExecuteTestConfig[] = [];

  // Helper to check if run was cancelled or is being cancelled
  const isCancelled = () => {
    const runState = runningBrowsers.get(runId);
    const currentRun = testRuns.get(runId);
    return runState?.cancelled === true || currentRun?.status === 'cancelling';
  };

  try {
    // Launch browser based on run configuration
    browser = await launchBrowserFromExecutor(run.browser || 'chromium');

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
          branch: run.branch, // Pass branch from run configuration
          // K6 Load test fields
          virtual_users: test.virtual_users,
          duration: test.duration,
          ramp_up_time: test.ramp_up_time,
          k6_script: test.k6_script,
          k6_thresholds: test.k6_thresholds, // Feature #619
          // Accessibility test fields
          wcag_level: test.wcag_level,
          include_best_practices: test.include_best_practices,
          include_experimental: test.include_experimental,
          include_pa11y: test.include_pa11y,
          disable_javascript: test.disable_javascript, // Feature #621
          a11y_fail_on_any: test.a11y_fail_on_any,
          a11y_fail_on_critical: test.a11y_fail_on_critical,
          a11y_fail_on_serious: test.a11y_fail_on_serious,
          a11y_fail_on_moderate: test.a11y_fail_on_moderate,
          a11y_fail_on_minor: test.a11y_fail_on_minor,
        }];
      }
    } else {
      // Running all tests in suite
      const suiteTests = await listTests(run.suite_id);
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
          branch: run.branch, // Pass branch from run configuration
          // K6 Load test fields
          virtual_users: t.virtual_users,
          duration: t.duration,
          ramp_up_time: t.ramp_up_time,
          k6_script: t.k6_script,
          k6_thresholds: t.k6_thresholds, // Feature #619
          // Accessibility test fields
          wcag_level: t.wcag_level,
          include_best_practices: t.include_best_practices,
          include_experimental: t.include_experimental,
          include_pa11y: t.include_pa11y,
          disable_javascript: t.disable_javascript, // Feature #621
          a11y_fail_on_any: t.a11y_fail_on_any,
          a11y_fail_on_critical: t.a11y_fail_on_critical,
          a11y_fail_on_serious: t.a11y_fail_on_serious,
          a11y_fail_on_moderate: t.a11y_fail_on_moderate,
          a11y_fail_on_minor: t.a11y_fail_on_minor,
        }));
    }

    // Get suite for retry configuration (reuse suite if already fetched)
    const suiteForRetry = suite || await getTestSuite(run.suite_id);
    const maxRetries = suiteForRetry?.retry_count || 0;

    // Get project environment variables (unmasked for test execution)
    const projectId = suite?.project_id;
    const envVarsArray = projectId ? (await getProjectEnvVars(projectId)) || [] : [];
    const envVars: Record<string, string> = {};
    for (const envVar of envVarsArray) {
      // For test execution, we use the actual values (not masked)
      envVars[envVar.key] = envVar.value;
    }

    // Feature #894: Merge run-specific environment variables (override project vars)
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
      // Check if cancelled before starting each test
      if (isCancelled()) {
        console.log(`[CANCELLED] Test run ${runId} was cancelled`);
        run.status = 'cancelled';
        break;
      }

      const test = testsToRun[testIndex];
      let result = await executeTest(test, browser, runId, orgId, envVars);
      let retryAttempt = 0;
      let passedOnRetry = false;

      // Retry logic: if test failed and retries are configured
      while ((result.status === 'failed' || result.status === 'error') && retryAttempt < maxRetries) {
        // Check if cancelled before retrying
        if (isCancelled()) {
          console.log(`[CANCELLED] Test run ${runId} was cancelled during retry`);
          run.status = 'cancelled';
          break;
        }

        retryAttempt++;
        console.log(`[RETRY] Retrying test "${test.name}" (attempt ${retryAttempt}/${maxRetries})`);

        // Emit retry event
        emitRunEvent(runId, orgId, 'test-retry', {
          testId: test.id,
          testName: test.name,
          retryAttempt,
          maxRetries,
        });

        // Execute test again (with env vars)
        result = await executeTest(test, browser, runId, orgId, envVars);

        // If passed on retry, mark it
        if (result.status === 'passed') {
          passedOnRetry = true;
          console.log(`[RETRY] Test "${test.name}" passed on retry attempt ${retryAttempt}`);
        }
      }

      // Break out if cancelled during retry loop
      if (run.status === 'cancelled') break;

      // Add retry metadata to result
      result.retry_count = retryAttempt;
      result.passed_on_retry = passedOnRetry;
      results.push(result);

      // Emit progress update
      emitRunEvent(runId, orgId, 'run-progress', {
        totalTests: testsToRun.length,
        completedTests: testIndex + 1,
        currentTest: test.name,
        lastTestStatus: result.status,
        retryAttempts: retryAttempt,
        passedOnRetry,
      });
    }

    // Determine overall status (only if not cancelled or cancelling)
    const runStatus = run.status as string;
    if (runStatus !== 'cancelled' && runStatus !== 'cancelling') {
      const hasFailure = results.some(r => r.status === 'failed');
      const hasError = results.some(r => r.status === 'error');
      run.status = hasError ? 'error' : hasFailure ? 'failed' : 'passed';
    } else if (runStatus === 'cancelling') {
      // Transition from 'cancelling' to 'cancelled'
      run.status = 'cancelled';
      console.log(`[CANCELLED] Test run ${runId} transitioned from 'cancelling' to 'cancelled'`);
    }
    // Always store partial results even for cancelled runs
    run.results = results;
    run.completed_at = new Date();
    run.duration_ms = run.completed_at.getTime() - (run.started_at?.getTime() || run.created_at.getTime());

    // Set test_type and accessibility_results for analytics
    if (testsToRun.length > 0) {
      const firstTest = testsToRun[0];
      run.test_type = firstTest.test_type as any;

      // If this is an accessibility test, extract accessibility results from step results
      if (firstTest.test_type === 'accessibility' && results.length > 0) {
        const a11yResult = results[0];
        const a11yStep = a11yResult.steps?.find((s: any) => s.action === 'axe_core_scan');
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
    // Cleanup browser tracking
    runningBrowsers.delete(runId);

    if (browser) {
      await browser.close().catch(() => {});
    }
    testRuns.set(runId, run);

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
        console.error('[ALERT] Error checking/sending alerts:', alertErr);
      }
    }

    // Feature #1284: Send test.run.completed webhook
    const suiteForWebhook = await getTestSuite(run.suite_id);
    if (suiteForWebhook) {
      // Send webhook asynchronously (don't wait)
      sendRunCompletedWebhook(run, { id: suiteForWebhook.id, name: suiteForWebhook.name, project_id: suiteForWebhook.project_id }, results)
        .catch(err => console.error('[WEBHOOK] Error sending run completed webhook:', err));

      // Feature #1285: Send test.run.failed webhook (only for failed/error runs)
      if (run.status === 'failed' || run.status === 'error') {
        sendRunFailedWebhook(run, { id: suiteForWebhook.id, name: suiteForWebhook.name, project_id: suiteForWebhook.project_id }, results)
          .catch(err => console.error('[WEBHOOK] Error sending run failed webhook:', err));
      }

      // Feature #1286: Send test.run.passed webhook (only for passed runs)
      if (run.status === 'passed') {
        sendRunPassedWebhook(run, { id: suiteForWebhook.id, name: suiteForWebhook.name, project_id: suiteForWebhook.project_id }, results)
          .catch(err => console.error('[WEBHOOK] Error sending run passed webhook:', err));
      }

      // Feature #1957: Update test status from 'draft' to 'active' after ANY run completes
      // Draft should only be for tests that have NEVER been run
      // A test becomes 'active' after its first execution, regardless of pass/fail status
      for (const result of results) {
        const test = await getTest(result.test_id);
        if (test && test.status === 'draft') {
          await updateTest(result.test_id, { status: 'active', updated_at: new Date() });
          console.log(`[STATUS] Test "${test.name}" promoted from draft to active after first run (status: ${result.status})`);
        }
      }
    }
  }
}

interface RunBody {
  browser?: BrowserType;
  branch?: string; // Git branch for baseline comparison (default: 'main')
}

export async function testRunRoutes(app: FastifyInstance) {
  // Feature #1356: All API routes have been extracted to separate modules in ./test-runs/
  // See index.ts for complete module listing. Routes are registered at the end of this function.

  // Register all extracted route modules
  await securityRoutes(app);
  await securityAdvancedRoutes(app);
  await webhookSubscriptionRoutes(app);
  await slackIntegrationRoutes(app);
  await alertChannelRoutes(app);
  await aiFailureAnalysisRoutes(app);
  await organizationSettingsRoutes(app);
  await testSimulationRoutes(app);
  await healingRoutes(app);
  await artifactRoutes(app);
  await resultsRoutes(app);
  await visualBatchRoutes(app);
  await browserViewportRoutes(app);
  await failurePatternsRoutes(app);
  await recordingRoutes(app);
  await visualStorageRoutes(app);
  await reviewExportRoutes(app);
  await selectorOverrideRoutes(app);
  await runDataRoutes(app);
  await runCoreRoutes(app);
  await runControlRoutes(app);
  await visualApprovalRoutes(app);
  await baselineRoutes(app); // Feature #1927: Register baseline routes for /api/v1/tests/:testId/baseline/branches

  // Run trigger routes require runTestsForRun dependency
  const runTriggerRoutes = createRunTriggerRoutes(runTestsForRun);
  await runTriggerRoutes(app);
}
