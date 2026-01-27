/**
 * Test Runs - Execution Module
 * Feature #1368: Extract test execution logic
 *
 * Contains:
 * - Test execution types and interfaces
 * - Browser management (runningBrowsers store)
 * - Test run store (testRuns)
 * - Browser launch helpers
 * - Execution state management
 */

import { Browser, chromium, firefox, webkit } from 'playwright';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Browser type supported by the execution engine
 */
export type BrowserType = 'chromium' | 'firefox' | 'webkit';

/**
 * Status of a test run
 */
// Feature #1979: Added 'warning' status for accessibility tests with violations that don't exceed failure thresholds
export type TestRunStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'passed'
  | 'failed'
  | 'warning'
  | 'error'
  | 'cancelled'
  | 'cancelling'
  | 'visual_approved'
  | 'visual_rejected';

/**
 * Type of test being executed
 */
export type TestType = 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility';

/**
 * How the test run was triggered
 */
export type TriggerType = 'manual' | 'schedule' | 'api' | 'github';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Console log entry captured during test execution
 */
export interface ConsoleLog {
  timestamp: number;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  location?: string; // URL where the log was generated
}

/**
 * Network request captured during test execution
 */
export interface NetworkRequest {
  timestamp: number;
  method: string;
  url: string;
  resourceType: string;
  status?: number;
  statusText?: string;
  duration_ms?: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestSize?: number;
  responseSize?: number;
  failed?: boolean;
  failureText?: string;
}

/**
 * Result of a single step within a test
 */
export interface StepResult {
  id: string;
  action: string;
  selector?: string;
  value?: string;
  // Feature #1979: Added 'warning' status for accessibility tests with violations that don't exceed thresholds
  status: 'passed' | 'failed' | 'skipped' | 'warning';
  duration_ms: number;
  error?: string;
  viewport?: string; // Viewport info for multi-viewport tests
  // Feature #1065: AI healing selector tracking
  was_healed?: boolean; // True if this step was auto-healed
  original_selector?: string; // The original selector that failed
  healed_selector?: string; // The AI-healed selector that was used
  healing_strategy?: string; // Strategy used for healing (selector_fallback, visual_match, etc.)
  healing_confidence?: number; // Confidence score of the healing (0-100)
  manual_override?: boolean; // True if the selector was manually overridden
  manual_override_at?: string; // ISO timestamp of manual override
  manual_override_by?: string; // User ID who made the override
  // Feature #1068: Rejection tracking
  needs_manual_attention?: boolean; // True if healing was rejected and needs manual review
  healing_rejected?: boolean; // True if user rejected the AI-healed selector
  rejection_reason?: string; // Reason for rejecting the healed selector
  suggested_selector?: string; // User-suggested alternative selector
  // Feature #1966: Lighthouse performance metrics for performance test steps
  lighthouse?: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
    pwa?: number;
    url?: string;
    device?: string;
    metrics?: {
      first_contentful_paint?: number;
      largest_contentful_paint?: number;
      cumulative_layout_shift?: number;
      total_blocking_time?: number;
      speed_index?: number;
      lcp?: number;
      fid?: number;
      cls?: number;
      fcp?: number;
      tbt?: number;
      ttfb?: number;
      si?: number;
      tti?: number;
    };
    opportunities?: Array<{
      id: string;
      title: string;
      savings: number;
      description: string;
    }>;
    diagnostics?: Array<{
      id: string;
      title: string;
      description: string;
    }>;
    passedAudits?: Array<{
      id: string;
      title: string;
      description: string;
      category?: string;
    }>;
    filmstrip?: Array<{
      timestamp_ms: number;
      screenshot_base64: string;
      label?: string;
    }>;
  };
  // Feature #1137: Additional step metadata for detailed reporting
  name?: string; // Human-readable step name
  metadata?: Record<string, any>; // Arbitrary metadata for the step
  // Feature #1136: Accessibility test results
  accessibility?: {
    violations: Array<{
      id: string;
      impact: 'critical' | 'serious' | 'moderate' | 'minor';
      description: string;
      wcagTags: string[];
      nodes: Array<{
        html: string;
        target: string[];
      }>;
    }>;
    passes?: number;
    incomplete?: number;
    inapplicable?: number;
    score?: number;
    wcagLevel?: 'A' | 'AA' | 'AAA'; // WCAG conformance level tested
    axeVersion?: string; // Version of axe-core used
  };
  // Feature #1296: Load test results - flexible structure for K6 results
  load_test?: {
    summary?: {
      total_requests?: number;
      failed_requests?: number;
      success_rate?: string;
      requests_per_second?: string;
    };
    response_times?: {
      min?: number;
      avg?: number;
      p95?: number;
      p99?: number;
      max?: number;
    };
    virtual_users?: {
      configured?: number;
      max_concurrent?: number;
    };
    duration?: {
      configured?: number;
      actual?: number;
      ramp_up?: number;
    };
    custom_metrics?: Record<string, any>;
    server_unavailable?: {
      detected?: boolean;
      failureRate?: number;
      message?: string;
    };
    // Legacy K6 output format support
    vus?: number;
    duration_s?: number;
    iterations?: number;
    http_reqs?: number;
    http_req_duration?: {
      avg?: number;
      min?: number;
      max?: number;
      p95?: number;
      p99?: number;
    };
    http_req_failed?: number;
    error_rate?: number;
    throughput?: number;
    thresholds_passed?: boolean;
    thresholds?: Array<{
      metric: string;
      passed: boolean;
      value: number;
      threshold: string;
    }>;
  };
}

/**
 * Result of a single test within a test run
 */
export interface TestRunResult {
  test_id: string;
  test_name: string;
  test_type?: 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility'; // Feature #1991: Test type for PDF breakdown
  // Feature #2053: Added 'warning' status for accessibility tests with violations below failure threshold
  status: 'passed' | 'failed' | 'error' | 'skipped' | 'warning';
  duration_ms: number;
  steps: StepResult[];
  error?: string;
  screenshot_base64?: string;
  trace_file?: string; // Path to the trace file
  video_file?: string; // Path to the video recording file
  retry_count?: number; // Number of retries attempted
  passed_on_retry?: boolean; // True if test initially failed but passed on retry
  console_logs?: ConsoleLog[]; // Console messages captured during test execution
  network_requests?: NetworkRequest[]; // Network requests captured during test execution
  // Visual regression comparison results
  visual_comparison?: any; // VisualComparisonResult from visual-regression module
  baseline_screenshot_base64?: string; // Baseline image for comparison
  diff_image_base64?: string; // Diff image showing pixel differences
  diff_percentage?: number; // Percentage of pixels that differ
  // Feature #1913: Multi-viewport results
  viewport_results?: Array<{
    viewportId: string;
    viewportLabel: string;
    width: number;
    height: number;
    visualComparison?: any;
    screenshotBase64?: string;
    baselineScreenshotBase64?: string;
    diffImageBase64?: string;
    diffPercentage?: number;
  }>;
  // Feature #604: Storage quota exceeded info
  isQuotaExceeded?: boolean; // True if storage quota exceeded during save
  suggestions?: string[]; // Cleanup suggestions when quota exceeded
  // Viewport info for screenshot filenames
  viewport_width?: number;
  viewport_height?: number;
  // Feature #1968: Load test results for UI display
  load_test?: any;
  // Feature #912: Review status
  reviewed?: boolean;
  reviewed_at?: Date;
  reviewed_by?: string; // User ID who reviewed
  review_notes?: string;
  // Feature #2069: Timing and network properties for results-routes
  started_at?: Date;
  completed_at?: Date;
  network_logs?: any[]; // Network logs for timeline generation
}

/**
 * Represents a test run (execution of a test suite or single test)
 */
export interface TestRun {
  id: string;
  suite_id: string;
  suite_name?: string; // Feature #1076: Suite name for failure cluster display
  project_id?: string; // Feature #1076: Project ID for failure filtering
  project_name?: string; // Feature #1076: Project name for failure cluster display
  test_id?: string; // If running a single test
  schedule_id?: string; // If triggered by a schedule
  organization_id: string;
  browser: BrowserType;
  branch: string; // Git branch for baseline comparison (default: 'main')
  test_type?: TestType;
  status: TestRunStatus;
  started_at?: Date;
  completed_at?: Date;
  duration_ms?: number;
  created_at: Date;
  results?: TestRunResult[];
  error?: string;
  accessibility_results?: any; // Results from accessibility testing
  run_env_vars?: Record<string, string>; // Feature #894: Run-specific environment variables
  priority?: number; // Feature #896: Run priority (lower = higher priority, default: 100)
  // Feature #1283: Trigger info for webhook events
  triggered_by?: TriggerType;
  user_id?: string;
  pr_number?: number;
}

/**
 * State of a running browser instance
 */
export interface BrowserState {
  browser: Browser;
  cancelled: boolean;
  paused: boolean;
}

/**
 * Manual selector override for a test step
 * Feature #1065
 */
export interface SelectorOverride {
  test_id: string;
  step_id: string;
  original_selector: string;
  new_selector: string;
  override_by: string; // User ID
  override_by_email: string; // User email
  override_at: string; // ISO timestamp
  notes?: string; // Optional notes about the override
}

/**
 * Healed selector history entry
 * Feature #1065
 */
export interface HealedSelectorEntry {
  run_id?: string;
  test_id: string;
  step_id: string;
  original_selector: string;
  healed_selector: string;
  strategy?: string;
  healing_strategy?: string;
  confidence?: number;
  healing_confidence?: number;
  healed_at: string; // ISO timestamp
  was_successful?: boolean;
  // Feature #1067: Acceptance tracking
  was_accepted?: boolean;
  accepted_by?: string;
  accepted_at?: string;
  // Feature #1068: Rejection tracking
  was_rejected?: boolean;
  rejection_reason?: string;
  rejected_by?: string;
  rejected_at?: string;
  suggested_alternative?: string;
  suggested_selector?: string;
}

// ============================================================================
// In-Memory Stores
// ============================================================================

/**
 * Store for all test runs
 * Key: runId
 */
export const testRuns: Map<string, TestRun> = new Map();

/**
 * Track running browsers for cancellation and pause
 * Key: runId
 */
export const runningBrowsers: Map<string, BrowserState> = new Map();

/**
 * Store for manual selector overrides
 * Key format: `${testId}-${stepId}`
 */
export const selectorOverrides: Map<string, SelectorOverride> = new Map();

/**
 * Store for healed selector history
 * Key format: `${testId}-${stepId}`
 */
export const healedSelectorHistory: Map<string, HealedSelectorEntry> = new Map();

// ============================================================================
// Viewport Presets
// ============================================================================

/**
 * Feature #1920: Extended device presets for multi-viewport testing
 * Includes real device dimensions for common mobile, tablet, and desktop devices
 */
export const VIEWPORT_PRESETS: Record<string, { width: number; height: number; label: string }> = {
  // Legacy presets (backwards compatible)
  mobile: { width: 375, height: 667, label: 'Mobile (iPhone SE)' },
  tablet: { width: 768, height: 1024, label: 'Tablet (iPad)' },
  desktop: { width: 1920, height: 1080, label: 'Desktop HD' },
  'desktop-hd': { width: 1920, height: 1080, label: 'Desktop (1080p)' },

  // Feature #1920: Real device presets
  // Mobile devices
  'iPhone 14': { width: 390, height: 844, label: 'iPhone 14' },
  'iPhone SE': { width: 375, height: 667, label: 'iPhone SE' },
  'Pixel 7': { width: 412, height: 915, label: 'Pixel 7' },
  'Galaxy S21': { width: 360, height: 800, label: 'Samsung Galaxy S21' },

  // Tablet devices
  'iPad': { width: 768, height: 1024, label: 'iPad' },
  'iPad Pro': { width: 1024, height: 1366, label: 'iPad Pro' },

  // Desktop devices
  'MacBook 13"': { width: 1440, height: 900, label: 'MacBook 13"' },
  'Desktop HD': { width: 1920, height: 1080, label: 'Desktop HD (1080p)' },
  'Desktop 4K': { width: 3840, height: 2160, label: 'Desktop 4K (2160p)' },
};

// ============================================================================
// Browser Launch Functions
// ============================================================================

/**
 * Launch a browser instance of the specified type
 * @param browserType - Type of browser to launch
 * @returns Promise<Browser> - Playwright browser instance
 */
export async function launchBrowser(browserType: BrowserType): Promise<Browser> {
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

// ============================================================================
// Execution State Helpers
// ============================================================================

/**
 * Check if a test run has been cancelled or is being cancelled
 * @param runId - ID of the test run
 * @returns boolean - true if the run is cancelled/cancelling
 */
export function isRunCancelled(runId: string): boolean {
  const runState = runningBrowsers.get(runId);
  const currentRun = testRuns.get(runId);
  return runState?.cancelled === true || currentRun?.status === 'cancelling';
}

/**
 * Check if a test run is paused
 * @param runId - ID of the test run
 * @returns boolean - true if the run is paused
 */
export function isRunPaused(runId: string): boolean {
  const runState = runningBrowsers.get(runId);
  return runState?.paused === true;
}

/**
 * Wait while a test run is paused
 * Polls every second until the run is no longer paused
 * @param runId - ID of the test run
 * @param checkInterval - Interval in ms between pause checks (default: 1000)
 */
export async function waitWhilePaused(runId: string, checkInterval: number = 1000): Promise<void> {
  while (isRunPaused(runId)) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
}

/**
 * Register a browser for a test run
 * @param runId - ID of the test run
 * @param browser - Browser instance
 */
export function registerBrowser(runId: string, browser: Browser): void {
  runningBrowsers.set(runId, { browser, cancelled: false, paused: false });
}

/**
 * Unregister a browser after test run completes
 * @param runId - ID of the test run
 */
export function unregisterBrowser(runId: string): void {
  runningBrowsers.delete(runId);
}

/**
 * Mark a test run for cancellation
 * @param runId - ID of the test run
 */
export function markRunCancelled(runId: string): void {
  const runState = runningBrowsers.get(runId);
  if (runState) {
    runState.cancelled = true;
  }
}

/**
 * Mark a test run as paused
 * @param runId - ID of the test run
 */
export function markRunPaused(runId: string): void {
  const runState = runningBrowsers.get(runId);
  if (runState) {
    runState.paused = true;
  }
}

/**
 * Mark a test run as resumed (unpaused)
 * @param runId - ID of the test run
 */
export function markRunResumed(runId: string): void {
  const runState = runningBrowsers.get(runId);
  if (runState) {
    runState.paused = false;
  }
}

/**
 * Get the browser instance for a test run
 * @param runId - ID of the test run
 * @returns Browser | undefined - Browser instance if found
 */
export function getRunningBrowser(runId: string): Browser | undefined {
  return runningBrowsers.get(runId)?.browser;
}

/**
 * Close and cleanup the browser for a test run
 * @param runId - ID of the test run
 */
export async function closeBrowser(runId: string): Promise<void> {
  const runState = runningBrowsers.get(runId);
  if (runState?.browser) {
    try {
      await runState.browser.close();
    } catch {
      // Browser may already be closed
    }
  }
  unregisterBrowser(runId);
}
