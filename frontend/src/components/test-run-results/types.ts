/**
 * Types for Test Run Results
 * Extracted from TestRunResultPage.tsx for modularity (Feature #46)
 */

// Accessibility violation interface
export interface AccessibilityViolation {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  wcagTags?: string[];
  nodes?: Array<{
    html: string;
    target: string[];
    failureSummary: string;
  }>;
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
  requestSize?: number;
  responseSize?: number;
  failed?: boolean;
  failureText?: string;
}

// Step result within a test
export interface StepResult {
  id: string;
  action: string;
  selector?: string;
  value?: string;
  status: 'passed' | 'failed' | 'skipped';
  duration_ms: number;
  error?: string;
  screenshot_timeout?: boolean;
  navigation_error?: boolean;
  http_status?: number;
  // Feature #1913: Multi-viewport visual test support
  viewport?: string;
  // Feature #1833: Timeline enhancement
  timestamp?: number;
  screenshot_before?: string;
  screenshot_after?: string;
  // Feature #1833: Per-step network requests and console logs
  network_requests?: NetworkRequest[];
  console_logs?: ConsoleLog[];
  metadata?: {
    screenshot_url?: string;
    diff_percentage?: number;
    baseline_url?: string;
    comparison_url?: string;
    diff_url?: string;
    isBrowserCrash?: boolean;
    crashDetectedAt?: string;
    crashDumpFile?: string;
    suggestion?: string;
    canRetry?: boolean;
  };
  load_test?: {
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
  };
  lighthouse?: LighthouseResult;
  accessibility?: {
    violations: AccessibilityViolation[];
    passes: number;
    incomplete: number;
    inapplicable: number;
    score?: number;
    wcagLevel?: string;
    axeVersion?: string;
  };
}

// Lighthouse test result
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
  metrics?: {
    lcp?: number;
    fid?: number;
    cls?: number;
    fcp?: number;
    tbt?: number;
    ttfb?: number;
    si?: number;
    tti?: number;
  };
  // Feature #1887, #1889: Opportunities, diagnostics, and passed audits
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
  // Feature #1890: Security detection results
  csp?: {
    detected: boolean;
    header?: string;
    blocksLighthouse: boolean;
    warning?: string;
    partialResults: boolean;
    bypassEnabled: boolean;
    suggestion?: string;
  };
  authentication?: {
    required: boolean;
    warning?: string;
    suggestion?: string;
    redirectedToLogin: boolean;
    originalUrl?: string;
    actualUrl?: string;
    loginIndicators?: string[];
    resultsReflectLoginPage: boolean;
  };
  mixedContent?: {
    detected: boolean;
    warning?: string;
    count: number;
    activeCount: number;
    passiveCount: number;
    resources: Array<{
      url: string;
      resourceType: string;
      severity: 'passive' | 'active';
    }>;
    hasMore: boolean;
    remediation: string[];
    securityImpact: 'high' | 'medium';
    scorePenalty: number;
  };
  // Feature #1893: Filmstrip view of page load
  filmstrip?: Array<{
    timestamp_ms: number;
    screenshot_base64: string;
    label?: string;
  }>;
  // Comparison to previous run
  comparison_to_previous?: {
    improved?: boolean;
    avg_change?: number;
    performance_change?: number;
    accessibility_change?: number;
    seo_change?: number;
  };
}

// Test result within a run
export interface TestResult {
  test_id: string;
  test_name: string;
  test_type?: 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility';
  status: 'passed' | 'failed' | 'error' | 'skipped';
  duration_ms: number;
  steps: StepResult[];
  error?: string;
  screenshot_base64?: string;
  trace_file?: string;
  video_file?: string;
  console_logs?: ConsoleLog[];
  network_requests?: NetworkRequest[];
  visual_comparison?: {
    hasBaseline: boolean;
    baselineScreenshot?: string;
    diffPercentage?: number;
    diffImage?: string;
    mismatchedPixels?: number;
    totalPixels?: number;
    baselineCorrupted?: boolean;
    corruptionError?: string;
  };
  baseline_screenshot_base64?: string;
  diff_image_base64?: string;
  diff_percentage?: number;
  // Feature #1913: Multi-viewport results
  viewport_results?: Array<{
    viewportId: string;
    viewportLabel: string;
    width: number;
    height: number;
    visualComparison?: {
      hasBaseline: boolean;
      diffPercentage?: number;
      mismatchedPixels?: number;
      totalPixels?: number;
    };
    screenshotBase64?: string;
    baselineScreenshotBase64?: string;
    diffImageBase64?: string;
    diffPercentage?: number;
  }>;
  load_test?: LoadTestResult;
}

// Load test result
export interface LoadTestResult {
  summary: {
    total_requests: number;
    failed_requests: number;
    success_rate: string;
    requests_per_second: string;
    data_transferred: number;
    data_transferred_formatted: string;
    max_vus?: number;
    duration_formatted?: string;
    peak_rps?: number;
    data_sent?: number;
    data_received?: number;
  };
  response_times: {
    min: number;
    avg: number;
    median: number;
    p50?: number;
    p75?: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
  };
  virtual_users: {
    configured: number;
    max_concurrent: number;
  };
  duration: {
    configured: number;
    actual: number;
    ramp_up: number;
  };
  http_codes: Record<string, number>;
  checks: Array<{ name: string; passes: number; fails: number; pass_rate?: number }>;
  // Feature #1836: K6 dashboard additions
  thresholds?: Record<string, boolean>;
  endpoints?: Array<{
    path: string;
    method: string;
    count: number;
    avg_time: number;
    p95_time: number;
    error_rate: number;
  }>;
  time_series?: Array<{
    time: string;
    timestamp?: number;
    vus: number;
    rps: number;
    avg_response_time: number;
    p95_response_time: number;
  }>;
  response_time_distribution?: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
  started_at?: string;
  target_url?: string;
  environment?: string;
  configuration?: {
    max_vus?: number;
    target_vus?: number;
    duration?: string;
    duration_formatted?: string;
  };
  comparison_to_previous?: {
    improved?: boolean;
    percentage_change?: number;
    requests_per_second_change?: number;
    avg_response_time_change?: number;
    success_rate_change?: number;
  };
  peak_rps?: number;
  threshold_details?: Array<{
    name: string;
    passed: boolean;
    value: number;
    threshold: number;
  }>;
  error_annotations?: Array<{
    time: string;
    timestamp?: number;
    message: string;
    type?: string;
  }>;
  error_time_series?: Array<{
    timestamp: number;
    count: number;
    types: Record<string, number>;
  }>;
  data_sent?: number;
  data_received?: number;
  expected_bandwidth?: number;
  content_type_breakdown?: Array<{ type: string; bytes: number; percentage: number }>;
  error_types?: Record<string, number>;
  custom_metrics?: Array<{
    name: string;
    type: 'counter' | 'rate' | 'trend' | 'gauge';
    value?: number;
    values?: { avg?: number; min?: number; max?: number; p90?: number; p95?: number };
  }>;
}

// Test run
export interface TestRun {
  id: string;
  suite_id: string;
  test_id?: string;
  organization_id?: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'error' | 'cancelled';
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  created_at: string;
  results: TestResult[];
  error?: string;
  browser?: string;
  branch?: string;
}

// Test info
export interface TestInfo {
  id: string;
  name: string;
  type: string;
  suite_id: string;
  target_url?: string;
}

// Suite info
export interface SuiteInfo {
  id: string;
  name: string;
  project_id: string;
}

// Result summary
export interface ResultSummary {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
}

// Error analysis result
export interface ErrorAnalysis {
  isSimple: boolean;
  tip?: string;
  category?: string;
}

// Run history entry
export interface RunHistoryEntry {
  id: string;
  status: string;
  created_at: string;
  duration_ms?: number;
  passed?: number;
  failed?: number;
  total?: number;
}

// Tab types
export type ActiveTab = 'results' | 'timeline' | 'screenshots' | 'metrics' | 'logs' | 'visual' | 'accessibility' | 'network';

// Screenshot type filter
export type ScreenshotTypeFilter = 'All' | 'E2E' | 'Visual' | 'Performance' | 'Load' | 'Accessibility';

// Visual view mode
export type VisualViewMode = 'side-by-side' | 'slider' | 'onion';

// Accessibility view mode
export type A11yViewMode = 'grouped' | 'list';

// Logs view mode
export type LogsViewMode = 'unified' | 'console' | 'network';

// Gallery view mode
export type GalleryViewMode = 'grid' | 'carousel';

// K6 active chart type
export type K6ActiveChart = 'vus' | 'rps' | 'response_times';

// K6 active tab
export type K6ActiveTab = 'overview' | 'response_times' | 'throughput' | 'errors' | 'endpoints';

// Lighthouse active tab
export type LighthouseActiveTab = 'overview' | 'performance' | 'accessibility' | 'best_practices' | 'seo';

// Export format types
export type K6ExportFormat = 'json' | 'csv';
export type LogsExportFormat = 'json' | 'txt';
export type ShareLinkExpiry = '1h' | '24h' | '7d' | '30d';

// Logs filter state
export interface LogsFilter {
  errors: boolean;
  warnings: boolean;
  info: boolean;
  debug: boolean;
  network: boolean;
  failedRequests: boolean;
}

// PDF section selection
export interface PdfSections {
  summary: boolean;
  typeBreakdown: boolean;
  testResults: boolean;
  failures: boolean;
  screenshots: boolean;
}

// Live execution state
export interface LiveStep {
  action: string;
  selector?: string;
  progress: number;
}

export interface LiveMetrics {
  rps?: number;
  responseTime?: number;
  vus?: number;
}

export interface ExecutionProgress {
  current: number;
  total: number;
  eta?: number;
}

// Visual marker for video timeline
export interface VisualMarker {
  id: string;
  testName: string;
  timestampMs: number;
  hasDiff: boolean;
  diffPercent: number;
  type: 'screenshot' | 'diff';
}

// Simple error pattern for detection
export interface SimpleErrorPattern {
  pattern: RegExp;
  tip: string;
  category: string;
}
