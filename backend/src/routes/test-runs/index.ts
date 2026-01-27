/**
 * Test Runs Module Index
 * Re-exports extracted modules for easier imports
 */

// Visual Regression Module
export {
  // Constants
  BASELINES_DIR,
  BASELINE_HISTORY_DIR,

  // Interfaces
  VisualComparisonResult,
  BaselineMetadata,
  BaselineHistoryEntry,
  LoadBaselineResult,
  DiffColorConfig,
  AntiAliasingOptions,

  // Baseline Metadata
  getBaselineMetadataKey,
  setBaselineMetadata,
  getBaselineMetadata,

  // Baseline History
  getBaselineHistoryKey,
  addBaselineHistoryEntry,
  getBaselineHistory,
  getBaselineHistoryEntry,
  getBaselineHistoryImage,

  // Baseline File Operations
  getBaselinePath,
  saveBaseline,
  loadBaseline,
  loadBaselineWithValidation,
  hasBaseline,

  // Diff Color Configuration
  getDiffColors,
  setDiffColors,

  // Anti-Aliasing Options
  getPixelmatchOptions,

  // Ignore Regions
  applyIgnoreRegions,

  // Screenshot Comparison
  compareScreenshots,
} from './visual-regression';

// Alerts Module
export {
  // Types
  AlertCondition,
  AlertChannelType,
  AlertChannel,
  SentEmailLog,
  SlackConnection,
  SlackChannel,
  SlackLogEntry,
  WebhookLogEntry,
  AlertTestRun,
  AlertTestRunResult,
  AlertSuiteInfo,
  AlertProjectInfo,

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
  checkAndSendAlerts,
} from './alerts';

// Storage Module (Feature #1371)
export {
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
} from './storage';

// AI Analysis Module (Feature #1372)
export {
  // Types - LLM Analysis
  LLMRootCauseAnalysis,
  TestResultInput,
  TestRunInput,

  // Types - Root Cause Analysis (Feature #1078)
  RootCause,
  RootCauseAnalysisResult,

  // Types - Evidence Artifacts (Feature #1079)
  EvidenceArtifacts,

  // Cache
  llmExplanationCache,
  LLM_CACHE_TTL_SECONDS,

  // Helper Functions
  generateErrorHash,
  callClaudeAPI,
  calculateConfidenceFactors,
  findSimilarFailures,
  generateCategorySpecificAnalysis,
  extractSelector,

  // Main Analysis Functions
  generateLLMRootCauseAnalysis,
  // Note: generateRootCauseAnalysis and generateEvidenceArtifacts are exported from root-cause-analysis module

  // Cache Management
  getLLMCacheStats,
  clearLLMCacheEntry,
  clearAllLLMCache,
} from './ai-analysis';

// Healing Module (Feature #1356 - Code Quality)
export {
  // Types
  PendingHealingApproval,
  HealingRecord,
  SelectorHistoryEntry,
  HealingEventEntry,
  DOMChangeContext,

  // In-Memory Stores
  pendingHealingApprovals,
  pendingHealingUpdates,
  selectorHistory,

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
} from './healing';

// Webhooks Module (Feature #1356 - Code Quality)
export {
  // Types
  WebhookSubscription,
  WebhookEventType,
  WebhookDeliveryAttempt,
  WebhookBatchEntry,
  WebhookDeliveryLog,

  // In-Memory Stores
  webhookSubscriptions,
  webhookDeliveryQueue,
  webhookBatchQueues,
  webhookBatchTimers,
  webhookDeliveryLogs,

  // Constants
  RETRY_DELAYS,

  // Helper Functions
  subscriptionMatchesProject,
  subscriptionMatchesResultStatus,
  subscriptionMatchesAnyResultStatus,

  // Batch Functions
  flushWebhookBatch,
  addToBatch,

  // Delivery Functions
  deliverOrBatchWebhook,
  deliverWebhookWithRetry,
  logWebhookDelivery,
  getWebhookDeliveryLogs,

  // Template Functions
  interpolateTemplate,
  applyPayloadTemplate,
} from './webhooks';

// Execution Module (Feature #1368)
export {
  // Types
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

  // In-Memory Stores
  testRuns,
  runningBrowsers,
  selectorOverrides,
  healedSelectorHistory,

  // Viewport Presets
  VIEWPORT_PRESETS,

  // Browser Functions
  launchBrowser,

  // Execution State Helpers
  isRunCancelled,
  isRunPaused,
  waitWhilePaused,
  registerBrowser,
  unregisterBrowser,
  markRunCancelled,
  markRunPaused,
  markRunResumed,
  getRunningBrowser,
  closeBrowser,
} from './execution';

// Root Cause Helpers Module (Feature #1356)
export {
  // Types - Related Commits
  RelatedCommit,
  CommitDetails,

  // Note: RootCause, RootCauseAnalysisResult, EvidenceArtifacts are already exported from ./ai-analysis above
  // to avoid duplicate identifier errors

  // Types - Suggested Actions
  SuggestedAction,
  SuggestedActions,

  // Types - Historical Pattern
  HistoricalFailure,
  HistoricalPatternMatch,

  // Types - Cross-Test Correlation
  AffectedTest,
  CrossTestCorrelation,

  // Types - Explanations
  HumanReadableExplanation,
  StackFrame,
  CodeChange,
  TechnicalExplanation,
  AffectedFeature,
  ExecutiveSummary,

  // Functions - Commit Helpers
  generateRelatedCommits,
  generateCommitDetails,

  // Functions - Parsing
  parseStackTrace,
  // Note: extractSelector is already exported from ./ai-analysis above

  // Functions - Simulation
  generateSimulatedConsoleLogs,
  generateSimulatedNetworkRequests,
} from './root-cause-helpers';

// Root Cause Analysis Module (Feature #1356)
export {
  generateRootCauseAnalysis,
  generateEvidenceArtifacts,
  generateSuggestedActions,
  generateHistoricalPatternMatch,
} from './root-cause-analysis';

// Explanations Module (Feature #1356)
export {
  generateCrossTestCorrelation,
  generateHumanReadableExplanation,
  generateTechnicalExplanation,
  generateExecutiveSummary,
} from './explanations';

// Security Module (Feature #1356 - Code Quality)
export {
  // Types
  SecurityScanType,
  SecurityScanStatus,
  VulnerabilitySeverity,
  DismissReason,
  SecurityFinding,
  SecurityScan,
  VulnerabilityDismissal,

  // In-Memory Stores
  securityScans,
  dismissedVulnerabilities,

  // Helper Functions
  generateVulnerabilityDescription,
  generateRemediationSteps,
  generateReferences,

  // Route Registration
  securityRoutes,
} from './security';

// Security Advanced Module (Feature #1356 - Code Quality)
export {
  // Types
  DastScanBody,
  SecurityReportBody,
  SecurityPolicyBody,
  SecurityScanSchedule,

  // In-Memory Stores
  securityPolicies,
  securityScanSchedules,

  // Route Registration
  securityAdvancedRoutes,
} from './security-advanced';

// Webhook Subscriptions Module (Feature #1356 - Code Quality)
export {
  // Helper Functions
  logWebhookDelivery as logWebhookDeliveryFromSubscriptions,

  // Route Registration
  webhookSubscriptionRoutes,
} from './webhook-subscriptions';

// Slack Integration Module (Feature #1356 - Code Quality)
export {
  // Route Registration
  slackIntegrationRoutes,
} from './slack-integration';

// Alert Channels Module (Feature #1356 - Code Quality)
export {
  // Route Registration
  alertChannelRoutes,
} from './alert-channels';

// AI Failure Analysis Module (Feature #1356 - Code Quality)
export {
  // Route Registration
  aiFailureAnalysisRoutes,
} from './ai-failure-analysis';

// Webhook Events Module (Feature #1356 - Code Quality)
export {
  // Types
  WebhookTestRun,
  WebhookTestRunResult,
  WebhookSuiteInfo,
  WebhookTriggerInfo,

  // Webhook Event Functions
  logWebhookDeliveryToAlertLog,
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
  sendTestCreatedWebhook,
} from './webhook-events';

// Baseline Routes Module (Feature #1356 - Code Quality)
export {
  // Types
  FailedUpload,

  // In-Memory Stores
  failedUploads,

  // Route Registration
  baselineRoutes,
} from './baseline-routes';

// Organization Settings Routes Module (Feature #1356 - Code Quality)
export {
  // Route Registration
  organizationSettingsRoutes,
} from './organization-settings';

// Test Simulation Routes Module (Feature #1356 - Code Quality)
export {
  // Simulation State Objects (exported for direct access from test-runs.ts)
  simulatedBrowserCrashState,
  simulatedOversizedPageState,
  simulatedLighthouseError,
  simulatedAuthRedirect,
  simulatedAuditTimeout,
  simulatedLighthouseBrowserCrash,
  simulatedLighthouseNonHtmlResponse,
  simulatedK6RuntimeError,
  simulatedK6ServerUnavailable,
  simulatedK6ResourceExhaustion,

  // Simulation State Getters/Setters
  getSimulatedBrowserCrash,
  setSimulatedBrowserCrash,
  getSimulatedOversizedPage,
  setSimulatedOversizedPage,
  getSimulatedLighthouseError,
  setSimulatedLighthouseError,
  getSimulatedAuthRedirect,
  setSimulatedAuthRedirect,
  getSimulatedAuditTimeout,
  setSimulatedAuditTimeout,
  getSimulatedLighthouseBrowserCrash,
  setSimulatedLighthouseBrowserCrash,
  getSimulatedLighthouseNonHtmlResponse,
  setSimulatedLighthouseNonHtmlResponse,
  getSimulatedK6RuntimeError,
  setSimulatedK6RuntimeError,
  getSimulatedK6ServerUnavailable,
  setSimulatedK6ServerUnavailable,
  getSimulatedK6ResourceExhaustion,
  setSimulatedK6ResourceExhaustion,
  getCrashDumpsDir,

  // Route Registration
  testSimulationRoutes,
} from './test-simulation';

// Healing Routes Module (Feature #1356 - Code Quality)
export {
  // Route Registration
  healingRoutes,
  // Healing event history map (shared with test-runs.ts)
  healingEventHistory,
} from './healing-routes';

// Artifact Routes Module (Feature #1356 - Code Quality)
export {
  // Route Registration
  artifactRoutes,
} from './artifact-routes';

// Results Routes Module (Feature #1356 - Code Quality)
export {
  // Route Registration
  resultsRoutes,
  // In-memory stores
  annotations,
  sharedResults,
} from './results-routes';

// Visual Batch Routes Module (Feature #1356 - Code Quality)
export {
  // Route Registration
  visualBatchRoutes,
} from './visual-batch-routes';

// Browser and Viewport Routes Module (Feature #1356 - Code Quality)
export {
  // Route Registration
  browserViewportRoutes,
} from './browser-viewport-routes';

// Failure Patterns Routes Module (Feature #1356 - Code Quality)
export {
  // Route Registration
  failurePatternsRoutes,
} from './failure-patterns-routes';

// Recording Routes Module (Feature #1356 - Code Quality)
export {
  // Types
  RecordingSession,
  // In-Memory Stores
  recordingSessions,
  // Route Registration
  recordingRoutes,
} from './recording-routes';

// Run Core Routes Module (Feature #1356 - Code Quality)
export {
  // Emitter Setup
  setRunCoreEmitter,
  // Route Registration
  runCoreRoutes,
} from './run-core-routes';

// Run Control Routes Module (Feature #1356 - Code Quality)
export {
  // Emitter Setup
  setRunControlEmitter,
  // Route Registration
  runControlRoutes,
} from './run-control-routes';

// Visual Storage Routes Module (Feature #1356 - Code Quality)
export {
  // Route Registration
  visualStorageRoutes,
} from './visual-storage-routes';

// Review and Export Routes Module (Feature #1356 - Code Quality)
export {
  // Route Registration
  reviewExportRoutes,
} from './review-export-routes';

// Selector Override Routes Module (Feature #1356 - Code Quality)
export {
  // Route Registration
  selectorOverrideRoutes,
} from './selector-override-routes';

// Run Data Routes Module (Feature #1356 - Code Quality)
export {
  // Route Registration
  runDataRoutes,
} from './run-data-routes';

// Visual Approval Routes Module (Feature #1356 - Code Quality)
export {
  // Route Registration
  visualApprovalRoutes,
} from './visual-approval-routes';

// Execute Test Helpers Module (Feature #1356 - Code Quality)
export {
  // Types
  CrashDumpData,
  ScreenshotUploadConfig,
  ScreenshotUploadError,
  FailedUpload as ExecuteTestFailedUpload,
  PageDimensionsResult,
  ScreenshotCaptureResult,
  SelectorRegionResult,

  // Constants
  DEFAULT_UPLOAD_CONFIG,
  DEFAULT_SCREENSHOT_TIMEOUT,
  MAX_PAGE_HEIGHT_FOR_FULL_CAPTURE,
  MAX_PAGE_WIDTH_FOR_FULL_CAPTURE,
  MAX_ESTIMATED_IMAGE_SIZE_MB,

  // Functions - Visual Matching
  findElementByVisualMatch,

  // Functions - Crash Dump
  saveCrashDump,

  // Functions - Screenshot Upload
  saveScreenshotWithRetry,
  saveBaselineWithRetry,
  saveBaseline as saveBaselineWithQuotaCheck,

  // Functions - Page Dimensions
  checkPageDimensions,

  // Functions - Screenshot Capture
  captureScreenshotWithTimeout,

  // Functions - Ignore Regions
  getIgnoreRegionsFromSelectors,
} from './execute-test-helpers';

// Run Trigger Routes Module (Feature #1356 - Code Quality)
export { createRunTriggerRoutes } from './run-trigger-routes';

// K6 Helpers Module (Feature #1356 - Code Quality)
export {
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
} from './k6-helpers';

// Lighthouse Executor Module (Feature #1356 - Code Quality)
export {
  // Types
  LighthouseTestConfig,
  LighthouseExecutionContext,
  LighthouseExecutionResult,
  LighthouseMetrics,
  LighthouseOpportunity,
  LighthouseDiagnostic,
  LighthousePassedAudit,
  CspDetectionResult,
  AuthDetectionResult,
  MixedContentResult,
  LighthouseResults,
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
} from './lighthouse-executor';

// Accessibility Helpers Module (Feature #1356 - Code Quality)
export {
  // Types
  A11yImpact,
  A11yViolationType,
  A11yViolation,
  ShadowDomInfo,
  IframeInfo,
  DomSizeInfo,
  A11yConfig,
  A11yScanResults,
  // Constants
  AXE_VIOLATION_TYPES,
  PA11Y_VIOLATION_TYPES,
  SHADOW_DOM_VIOLATION_TYPES,
  IFRAME_VIOLATION_TYPES,
  A11Y_PASS_CATEGORIES,
  // Functions
  generateSimulatedViolations,
  calculateA11yScore,
  countViolationsByImpact,
  checkA11yThresholds,
  buildTestEngineInfo,
} from './accessibility-helpers';
