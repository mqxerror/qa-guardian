/**
 * Types for Test Detail Page
 * Extracted from TestDetailPage.tsx for modularity (Feature #48)
 */

// Test Suite interface
export interface TestSuite {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  test_count?: number;
  browser?: string;
  default_browser?: 'chromium' | 'firefox' | 'webkit';
  viewport_width?: number;
  viewport_height?: number;
  timeout?: number;
  retry_count?: number;
  project_id?: string;
}

// Test type (the main test entity)
export interface TestType {
  id: string;
  suite_id: string;
  name: string;
  description?: string;
  type: 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility' | 'api';
  test_type?: string;
  status: TestStatus;
  created_at: string;
  updated_at: string;
  last_run_at?: string;
  target_url?: string;
  viewport_width?: number;
  viewport_height?: number;
  capture_mode?: 'full_page' | 'viewport' | 'element';
  element_selector?: string;
  wait_for_selector?: string;
  wait_time?: number;
  hide_selectors?: string[];
  remove_selectors?: string[];
  diff_threshold?: number;
  diff_threshold_mode?: 'percentage' | 'pixel_count';
  diff_pixel_threshold?: number;
  anti_aliasing_tolerance?: 'off' | 'low' | 'medium' | 'high';
  color_threshold?: number;
  ignore_regions?: IgnoreRegion[];
  ignore_selectors?: string[];
  multi_viewport?: boolean;
  selected_viewports?: string[];
  steps?: TestStep[];
  device_preset?: 'mobile' | 'desktop';
  performance_threshold?: number;
  lcp_threshold?: number;
  cls_threshold?: number;
  bypass_csp?: boolean;
  ignore_ssl_errors?: boolean;
  audit_timeout?: number;
  wcag_level?: 'A' | 'AA' | 'AAA';
  include_best_practices?: boolean;
  include_experimental?: boolean;
  include_pa11y?: boolean;
  a11y_fail_on_critical?: number;
  a11y_fail_on_serious?: number;
  a11y_fail_on_moderate?: number;
  a11y_fail_on_minor?: number;
  a11y_fail_on_any?: boolean;
  virtual_users?: number;
  duration?: number;
  ramp_up_time?: number;
  k6_script?: string;
  ai_generated?: boolean;
  ai_confidence_score?: number;
  requires_review?: boolean;
  review_status?: 'pending' | 'approved' | 'rejected' | 'pending_review';
  reviewed_by?: string;
  reviewed_at?: string;
  healing_active?: boolean;
  healing_status?: 'idle' | 'healing' | 'healed';
  healing_count?: number;
  playwright_code?: string;
  use_custom_code?: boolean;
  viewports?: Viewport[];
  viewport_preset?: 'mobile' | 'tablet' | 'laptop' | 'desktop' | 'custom';
}

// Ignore region for visual tests
export interface IgnoreRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
}

// Viewport configuration
export interface Viewport {
  name: string;
  width: number;
  height: number;
}

// Test step
export interface TestStep {
  id?: string;
  action: string;
  selector?: string;
  value?: string;
  description?: string;
  optional?: boolean;
  timeout?: number;
}

// Test run type
export interface TestRunType {
  id: string;
  suite_id: string;
  test_id?: string;
  status: RunStatus;
  duration_ms?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  results?: TestRunResult[];
  error?: string;
}

// Console log entry
export interface ConsoleLog {
  timestamp: number;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  location?: string;
}

// Network request entry
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

// Visual comparison result
export interface VisualComparison {
  hasBaseline: boolean;
  baselineScreenshot?: string;
  diffPercentage?: number;
  diffImage?: string;
  mismatchedPixels?: number;
  totalPixels?: number;
  baselineCorrupted?: boolean;
  corruptionError?: string;
}

// Load test summary
export interface LoadTestSummary {
  total_requests: number;
  failed_requests: number;
  success_rate: string;
  requests_per_second: string;
  data_transferred: number;
  data_transferred_formatted: string;
}

// Load test response times
export interface LoadTestResponseTimes {
  min: number;
  avg: number;
  median: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
}

// Load test virtual users
export interface LoadTestVirtualUsers {
  configured: number;
  max_concurrent: number;
}

// Load test duration
export interface LoadTestDuration {
  configured: number;
  actual: number;
  ramp_up: number;
}

// Load test result
export interface LoadTestResult {
  summary: LoadTestSummary;
  response_times: LoadTestResponseTimes;
  virtual_users: LoadTestVirtualUsers;
  duration: LoadTestDuration;
  http_codes: Record<string, number>;
  checks: Record<string, { passes: number; fails: number }>;
}

// Test run result
export interface TestRunResult {
  test_id: string;
  test_name: string;
  status: ResultStatus;
  duration_ms: number;
  steps: StepResult[];
  error?: string;
  screenshot_base64?: string;
  trace_file?: string;
  video_file?: string;
  console_logs?: ConsoleLog[];
  network_requests?: NetworkRequest[];
  isQuotaExceeded?: boolean;
  suggestions?: string[];
  visual_comparison?: VisualComparison;
  baseline_screenshot_base64?: string;
  diff_image_base64?: string;
  diff_percentage?: number;
  load_test?: LoadTestResult;
}

// Step result
export interface StepResult {
  id: string;
  action: string;
  selector?: string;
  value?: string;
  status: StepStatus;
  duration_ms: number;
  error?: string;
  screenshot_timeout?: boolean;
  navigation_error?: boolean;
  http_status?: number;
  metadata?: StepMetadata;
  load_test?: StepLoadTestResult;
  lighthouse?: LighthouseResult;
  accessibility?: AccessibilityResult;
}

// Step metadata
export interface StepMetadata {
  screenshot_url?: string;
  diff_percentage?: number;
  baseline_url?: string;
  comparison_url?: string;
  diff_url?: string;
  isBrowserCrash?: boolean;
  isOversized?: boolean;
  crashDetectedAt?: string;
  crashDumpFile?: string;
  suggestion?: string;
  canRetry?: boolean;
  pageDimensions?: {
    width: number;
    height: number;
    estimatedSizeMb?: number;
    reason?: string;
  };
}

// Step load test result
export interface StepLoadTestResult {
  virtual_users: number | { configured: number; peak: number };
  duration: number;
  requests_per_second: number;
  avg_response_time: number;
  p95_response_time: number;
  error_rate: number;
  http_codes?: Record<string, number>;
  response_times?: {
    avg: number;
    min: number;
    max: number;
    median: number;
    p50?: number;
    p90: number;
    p95: number;
    p99: number;
  };
  summary?: {
    http_req_duration_avg: number;
    http_req_duration_p95: number;
    http_req_duration_p99: number;
    http_reqs: number;
    iterations: number;
    vus_max: number;
    success_rate?: number;
    total_requests?: number;
    requests_per_second?: number;
    peak_rps?: number;
    data_transferred_formatted?: string;
  };
}

// Lighthouse result
export interface LighthouseResult {
  performance: number;
  accessibility: number;
  best_practices: number;
  bestPractices?: number;
  seo: number;
  pwa?: number;
  lcp?: number;
  cls?: number;
  fcp?: number;
  tbt?: number;
  url?: string;
  device?: string;
  metrics?: LighthouseMetrics;
  opportunities?: LighthouseOpportunity[];
  diagnostics?: LighthouseDiagnostic[];
  passedAudits?: LighthousePassedAudit[];
}

// Lighthouse passed audit
export interface LighthousePassedAudit {
  id: string;
  title: string;
  description?: string;
  score?: number;
}

// Lighthouse metrics
export interface LighthouseMetrics {
  lcp?: number;
  fid?: number;
  cls?: number;
  fcp?: number;
  tbt?: number;
  si?: number;
  tti?: number;
  largestContentfulPaint?: number;
  firstContentfulPaint?: number;
  speedIndex?: number;
  timeToInteractive?: number;
  totalBlockingTime?: number;
  cumulativeLayoutShift?: number;
  interactionToNextPaint?: number;
}

// Lighthouse opportunity
export interface LighthouseOpportunity {
  id: string;
  title: string;
  description?: string;
  score?: number;
  savings?: number;
  numericValue?: number;
  displayValue?: string;
}

// Lighthouse diagnostic
export interface LighthouseDiagnostic {
  id: string;
  title: string;
  description?: string;
  score?: number;
  displayValue?: string;
  details?: unknown;
}

// Accessibility result
export interface AccessibilityResult {
  violations: AccessibilityViolation[];
  passes: number;
  incomplete: number;
  inapplicable: number;
  score?: number;
  wcagLevel?: string;
  axeVersion?: string;
}

// Accessibility violation
export interface AccessibilityViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  wcagTags?: string[];
  nodes?: AccessibilityNode[];
}

// Accessibility node
export interface AccessibilityNode {
  html: string;
  target: string[];
  failureSummary: string;
}

// Status types
export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'warning' | 'error' | 'active' | 'draft';
export type RunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'warning' | 'error' | 'cancelled';
export type ResultStatus = 'passed' | 'failed' | 'warning' | 'error' | 'skipped';
export type StepStatus = 'passed' | 'failed' | 'warning' | 'skipped';

// Test type category
export type TestCategory = 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility' | 'api';

// Browser types
export type BrowserType = 'chromium' | 'firefox' | 'webkit';

// Active tab types
export type DetailTab = 'steps' | 'code' | 'baseline' | 'k6script';

// WCAG levels
export type WcagLevel = 'A' | 'AA' | 'AAA';

// Review status
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'pending_review';

// Healing status
export type HealingStatus = 'idle' | 'healing' | 'healed';

// Capture mode
export type CaptureMode = 'full_page' | 'viewport' | 'element';

// Diff threshold mode
export type DiffThresholdMode = 'percentage' | 'pixel_count';

// Anti-aliasing tolerance
export type AntiAliasingTolerance = 'off' | 'low' | 'medium' | 'high';

// Viewport preset
export type ViewportPreset = 'mobile' | 'tablet' | 'laptop' | 'desktop' | 'custom';

// Feature #48: Flakiness Trend types
export interface FlakinessTrend {
  summary: {
    total_runs: number;
    total_passes: number;
    total_failures: number;
    overall_pass_rate: number;
    overall_flakiness_score: number;
    flakiness_started: string | null;
    first_run: string | null;
    last_run: string | null;
  };
  daily_trend: Array<{
    date: string;
    passes: number;
    failures: number;
    total: number;
    pass_rate: number;
    flakiness_score: number;
  }>;
  weekly_trend: Array<{
    week_start: string;
    passes: number;
    failures: number;
    flakiness_score: number;
  }>;
  code_changes: Array<{
    date: string;
    commit_id: string;
    message: string;
    author: string;
    files_changed: string[];
  }>;
}
