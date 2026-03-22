import { FastifyInstance } from 'fastify';
// Feature #253: Most imports moved to run-orchestrator.ts
// Keeping only what's needed for route registration and re-exports

// Feature #1372: AI Analysis module functions are now available via ./test-runs/ai-analysis.ts
// Note: They are currently still defined in test-runs.ts within the route handler scope
// Full extraction will be completed in a future refactoring iteration

// Feature #1369: Import visual regression module
// Note: Some functions have enhanced local versions with quota checking etc.
// Importing types and baseline metadata/history functions from the module
import {
  // Types - re-exported from module (VisualComparisonResult available if needed)
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
} from './test-runs/visual-regression.js';

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
} from './test-runs/alerts.js';

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
} from './test-runs/storage.js';

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
} from './test-runs/ai-analysis.js';

// Feature #1356: Import healing module
// Type-only imports (required for ESM compatibility)
import type {
  PendingHealingApproval,
  HealingRecord,
  SelectorHistoryEntry,
  HealingEventEntry,
  DOMChangeContext,
} from './test-runs/healing.js';

// Value imports from healing module
import {
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
} from './test-runs/healing.js';

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
} from './test-runs/execution.js';

// Feature #1356: Import root cause helpers module
import {
  // Functions
  generateRelatedCommits,
  generateCommitDetails,
} from './test-runs/root-cause-helpers.js';

// Feature #1356: Import root cause analysis module
import {
  generateRootCauseAnalysis,
  generateEvidenceArtifacts,
  generateSuggestedActions,
  generateHistoricalPatternMatch,
} from './test-runs/root-cause-analysis.js';

// Feature #1356: Import explanations module
import {
  generateCrossTestCorrelation,
  generateHumanReadableExplanation,
  generateTechnicalExplanation,
  generateExecutiveSummary,
} from './test-runs/explanations.js';

// Feature #1356: Import security routes modules
import { securityRoutes } from './test-runs/security.js';
import { securityAdvancedRoutes } from './test-runs/security-advanced.js';

// Feature #1356: Import webhook subscription routes module
import { webhookSubscriptionRoutes } from './test-runs/webhook-subscriptions.js';

// Feature #1356: Import slack integration routes module
import { slackIntegrationRoutes } from './test-runs/slack-integration.js';

// Feature #1356: Import alert channels routes module
import { alertChannelRoutes } from './test-runs/alert-channels.js';

// Feature #1356: Import AI failure analysis routes module
import { aiFailureAnalysisRoutes } from './test-runs/ai-failure-analysis.js';

// Feature #1356: Import baseline routes module
import { baselineRoutes, failedUploads as failedUploadsFromModule } from './test-runs/baseline-routes.js';

// Feature #1356: Import organization settings routes module
import { organizationSettingsRoutes } from './test-runs/organization-settings.js';

// Feature #1356: Import healing routes module
import { healingRoutes } from './test-runs/healing-routes.js';

// Feature #1356: Import artifact routes module
import { artifactRoutes } from './test-runs/artifact-routes/index.js';

// Feature #1356: Import results routes module
import { resultsRoutes } from './test-runs/results-routes.js';

// Feature #1356: Import visual batch routes module
import { visualBatchRoutes } from './test-runs/visual-batch-routes.js';

// Feature #1356: Import browser/viewport routes module
import { browserViewportRoutes } from './test-runs/browser-viewport-routes.js';

// Feature #1356: Import failure patterns routes module
import { failurePatternsRoutes } from './test-runs/failure-patterns-routes.js';

// Feature #1356: Import recording routes module
import { recordingRoutes } from './test-runs/recording-routes.js';

// Feature #1356: Import run core routes module
import { runCoreRoutes, setRunCoreEmitter } from './test-runs/run-core-routes.js';

// Feature #1356: Import run control routes module
import { runControlRoutes, setRunControlEmitter } from './test-runs/run-control-routes.js';

// Feature #1356: Import visual storage routes module
import { visualStorageRoutes } from './test-runs/visual-storage-routes.js';

// Feature #1356: Import review and export routes module
import { reviewExportRoutes } from './test-runs/review-export-routes.js';

// Feature #1356: Import selector override routes module
import { selectorOverrideRoutes } from './test-runs/selector-override-routes.js';

// Feature #1356: Import run data routes module (logs, console, network, metrics, environment, compare)
import { runDataRoutes } from './test-runs/run-data-routes/index.js';

// Feature #1356: Import visual approval routes module
import { visualApprovalRoutes } from './test-runs/visual-approval-routes.js';

// Feature #1356: Import run trigger routes module (POST routes for suites/:suiteId/runs, tests/:testId/runs)
import { createRunTriggerRoutes } from './test-runs/run-trigger-routes.js';

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
} from './test-runs/test-simulation.js';

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
} from './test-runs/webhook-events.js';

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
} from './test-runs/execute-test-helpers.js';

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
} from './test-runs/k6-helpers.js';

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
  runRealLighthouseAudit,
  classifyLighthouseError,
  generateLighthouseErrorMessage,
} from './test-runs/lighthouse-executor.js';

// Feature #155: Import execution queue for concurrency-limited test runs
import {
  registerExecutionCallback,
  enqueueOrExecute,
  isQueueReady,
} from '../services/execution-queue.js';

// Feature #484: Pino structured logging
import { createLogger } from '../services/logger.js';
const log = createLogger('test-runs');

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
export { testRuns, runningBrowsers, selectorOverrides, healedSelectorHistory } from './test-runs/execution.js';

// Feature #253: Orchestration functions now in run-orchestrator.ts
// Re-export setSocketIO for backwards compatibility with index.ts
export { setSocketIO } from './test-runs/run-orchestrator.js';

// Feature #1356: Module extractions documented in ./test-runs/index.ts
// Modules: storage, healing, visual-regression, execute-test-helpers, alerts, webhooks
const failedUploads = failedUploadsFromModule;

// Re-exports for backwards compatibility
export { artifactRetentionSettings } from './test-runs/storage.js';
// Type exports (must use 'export type' for ESM compatibility with Node.js 20+)
export type { AlertCondition, AlertChannelType, AlertChannel, SlackConnection, SlackChannel, WebhookLogEntry } from './test-runs/alerts.js';
export { alertChannels, emailLog, slackConnections, slackLog, webhookLog } from './test-runs/alerts.js';

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
} from './test-runs/webhooks.js';

// Re-export webhooks types (must use 'export type' for ESM compatibility with Node.js 20+)
export type { WebhookSubscription } from './test-runs/webhooks.js';
export { webhookSubscriptions } from './test-runs/webhooks.js';

// Feature #1356: Import test executor module (extracted ~4600 lines)
import {
  executeTest,
  launchBrowser as launchBrowserFromExecutor,
  setTestExecutorEmitter,
  ExecuteTestConfig,
} from './test-runs/test-executor.js';

// Feature #249 & #253: Run orchestrator module - now active!
// Contains runTestsForRun, setSocketIO, emitRunEvent, checkAndSendAlerts
// Note: setSocketIO re-exported above for index.ts, runTestsForRun re-exported below
import { runTestsForRun } from './test-runs/run-orchestrator.js';

// Webhook infrastructure in ./test-runs/webhooks.ts, event functions in ./test-runs/webhook-events.ts

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


// Feature #253: runTestsForRun extracted to run-orchestrator.ts (~376 lines)
// Re-export for backwards compatibility with run-trigger-routes.ts and execution-queue.ts
export { runTestsForRun } from './test-runs/run-orchestrator.js';

export async function testRunRoutes(app: FastifyInstance) {
  // Feature #1356: All API routes have been extracted to separate modules in ./test-runs/
  // See index.ts for complete module listing. Routes are registered at the end of this function.

  // Feature #155: Register the execution callback for the queue worker
  // This allows the queue to execute test runs with proper concurrency limits
  registerExecutionCallback(runTestsForRun);
  log.info({ code: 'EXECUTION_CALLBACK_REGISTERED' }, 'Execution callback registered with queue');

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
