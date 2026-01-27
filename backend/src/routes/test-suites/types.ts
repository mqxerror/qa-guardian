// Test Suites Module - Type Definitions
// All interfaces and types used across the test suites module

// Feature #619: K6 Threshold configuration interface
// Thresholds define pass/fail criteria for load tests
export interface K6Threshold {
  metric: string; // K6 metric name (e.g., 'http_req_duration', 'http_req_failed', 'http_reqs')
  expression: string; // Threshold expression (e.g., 'p(95)<500', 'rate<0.01', 'count>1000')
  abortOnFail?: boolean; // Stop test early if threshold fails
  delayAbortEval?: string; // Delay before checking threshold (e.g., '10s')
}

// In-memory test suite store for development
export interface TestSuite {
  id: string;
  project_id: string;
  organization_id: string;
  name: string;
  description?: string;
  // Type of tests in this suite (for MCP tool compatibility)
  type?: 'e2e' | 'api' | 'unit' | 'visual' | 'accessibility';
  base_url?: string; // Base URL for test execution
  browser?: 'chromium' | 'firefox' | 'webkit';
  browsers?: string[]; // Multiple browsers for parallel execution
  viewport_width?: number;
  viewport_height?: number;
  timeout?: number; // Test timeout in seconds (default: 30)
  retry_count?: number; // Number of retries on failure (default: 0)
  // Feature #1151: Human review workflow for AI tests
  require_human_review?: boolean; // Require human review before AI-generated tests become active
  created_at: Date;
  updated_at: Date;
}

// In-memory test store
export interface Test {
  id: string;
  suite_id: string;
  organization_id: string;
  name: string;
  description?: string;
  order?: number; // Order within the suite (for reordering tests)
  test_type: 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility'; // Type of test
  steps: TestStep[];
  playwright_code?: string; // Custom Playwright code for advanced users
  use_custom_code?: boolean; // Whether to use custom code instead of steps
  // Accessibility test specific fields
  wcag_level?: 'A' | 'AA' | 'AAA'; // WCAG conformance level
  accessibility_rules?: string[]; // Specific rules to check (axe-core rule IDs)
  include_best_practices?: boolean; // Include best practices in addition to WCAG
  include_experimental?: boolean; // Include experimental rules
  include_pa11y?: boolean; // Run Pa11y alongside axe-core
  disable_javascript?: boolean; // Feature #621: Disable JavaScript for accessibility scan
  // Accessibility threshold configuration
  a11y_fail_on_any?: boolean; // Fail on any violation regardless of severity
  a11y_fail_on_critical?: number; // Max critical violations (0 = fail on any, undefined = no limit)
  a11y_fail_on_serious?: number; // Max serious violations
  a11y_fail_on_moderate?: number; // Max moderate violations
  a11y_fail_on_minor?: number; // Max minor violations
  a11y_timeout?: number; // Feature #623: Timeout in seconds for accessibility scan (default: 60, range: 30-600)
  // Feature #624: Dynamic content loading configuration
  a11y_wait_for?: 'load' | 'domcontentloaded' | 'networkidle'; // Wait strategy (default: 'networkidle')
  a11y_wait_selector?: string; // Wait for specific CSS selector to appear before scanning
  a11y_wait_time?: number; // Additional wait time in ms after page load (default: 0, range: 0-30000)
  a11y_scroll_page?: boolean; // Scroll page to trigger lazy-loaded content before scanning (default: false)
  a11y_scroll_behavior?: 'smooth' | 'instant'; // Scroll behavior: smooth or instant (default: 'smooth')
  // Lighthouse specific fields
  device_preset?: 'mobile' | 'desktop'; // Device preset for Lighthouse audit
  performance_threshold?: number; // Minimum performance score (0-100) for Lighthouse pass/fail
  lcp_threshold?: number; // Maximum LCP in ms (0 = disabled)
  cls_threshold?: number; // Maximum CLS (0 = disabled)
  bypass_csp?: boolean; // Bypass CSP for Lighthouse audits in testing environments
  ignore_ssl_errors?: boolean; // Ignore SSL certificate errors (with security warning)
  audit_timeout?: number; // Maximum time in seconds for Lighthouse audit (default: 60, range: 30-300)
  // Visual regression specific fields
  target_url?: string; // URL to capture for visual regression
  viewport_width?: number; // Viewport width (overrides suite setting)
  viewport_height?: number; // Viewport height (overrides suite setting)
  viewport_preset?: string; // Preset name like 'desktop', 'tablet', 'mobile'
  capture_mode?: 'full_page' | 'viewport' | 'element'; // Screenshot capture mode (default: full_page)
  element_selector?: string; // CSS selector for element capture mode
  wait_for_selector?: string; // CSS selector to wait for before taking screenshot
  wait_time?: number; // Additional wait time in ms after page load before screenshot
  hide_selectors?: string; // CSS selectors for elements to hide (visibility:hidden) before screenshot
  remove_selectors?: string; // CSS selectors for elements to remove (display:none) before screenshot
  multi_viewport?: boolean; // Enable multi-viewport mode
  viewports?: string[]; // Array of viewport presets for multi-viewport mode
  diff_threshold?: number; // Acceptable diff percentage threshold for visual tests (0-100, default: 0)
  diff_threshold_mode?: 'percentage' | 'pixel_count'; // Threshold mode: percentage (default) or absolute pixel count
  diff_pixel_threshold?: number; // Max different pixels allowed when using pixel_count mode
  ignore_regions?: IgnoreRegion[]; // Regions to ignore during visual comparison (by coordinates)
  ignore_selectors?: string[]; // CSS selectors for elements to ignore during visual comparison (bounding box calculated at runtime)
  mask_datetime_selectors?: string; // CSS selectors for datetime elements to mask (handles locale/timezone differences)
  mask_dynamic_content?: boolean; // Auto-mask common dynamic content (timestamps, dates) for locale/timezone independence
  // Feature #647: Anti-aliasing tolerance for cross-browser comparisons
  anti_aliasing_tolerance?: 'off' | 'low' | 'medium' | 'high'; // Perceptual diff tolerance for font rendering differences (default: 'off')
  color_threshold?: number; // Color difference threshold for pixelmatch (0.0-1.0, default: 0.1)
  // Load test specific fields (K6)
  virtual_users?: number; // Number of virtual users for load test
  duration?: number; // Test duration in seconds
  ramp_up_time?: number; // Ramp-up time in seconds
  k6_script?: string; // Custom K6 script for advanced users
  k6_thresholds?: K6Threshold[]; // K6 threshold configuration for pass/fail criteria
  status: 'draft' | 'active' | 'archived';
  // Feature #1151: Human review workflow for AI tests
  review_status?: 'pending_review' | 'approved' | 'rejected' | null; // Review status for AI-generated tests
  ai_generated?: boolean; // Whether this test was generated by AI
  ai_confidence_score?: number; // AI generation confidence score (0-100)
  reviewed_by?: string; // User ID who reviewed the test
  reviewed_at?: Date; // When the test was reviewed
  review_notes?: string; // Reviewer's notes/comments
  // Feature #1103: Quarantine support
  quarantined?: boolean; // Whether test is quarantined (runs but doesn't block CI)
  quarantine_reason?: string; // Reason for quarantine
  quarantined_at?: Date; // When the test was quarantined
  quarantined_by?: string; // User ID who quarantined the test
  created_at: Date;
  updated_at: Date;
}

// Rectangular region to ignore during visual comparison
export interface IgnoreRegion {
  id: string;
  x: number; // X coordinate (from left)
  y: number; // Y coordinate (from top)
  width: number; // Width of region
  height: number; // Height of region
  name?: string; // Optional name for the region (e.g., "ad banner", "timestamp")
}

export interface TestStep {
  id: string;
  action: string;
  selector?: string;
  value?: string;
  order: number;
}

export interface ProjectParams {
  projectId: string;
}

export interface SuiteParams {
  suiteId: string;
}

export interface TestParams {
  testId: string;
}

export interface CreateSuiteBody {
  name: string;
  description?: string;
  // Type of tests in this suite (MCP compatibility)
  type?: 'e2e' | 'api' | 'unit' | 'visual' | 'accessibility';
  base_url?: string; // Base URL for test execution
  browser?: 'chromium' | 'firefox' | 'webkit';
  browsers?: string[]; // Multiple browsers (MCP compatibility)
  viewport_width?: number;
  viewport_height?: number;
  timeout?: number;
  retry_count?: number;
  retries?: number; // Alias for retry_count (MCP compatibility)
}

// Feature #1688: Update suite body for PATCH endpoint
export interface UpdateSuiteBody {
  name?: string;
  description?: string;
  type?: 'e2e' | 'api' | 'unit' | 'visual' | 'accessibility';
  base_url?: string;
  browser?: 'chromium' | 'firefox' | 'webkit';
  browsers?: string[];
  viewport_width?: number;
  viewport_height?: number;
  timeout?: number;
  retry_count?: number;
  retries?: number; // Alias for retry_count (MCP compatibility)
  require_human_review?: boolean;
}

export interface CreateTestBody {
  name: string;
  description?: string;
  test_type?: 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility'; // Defaults to 'e2e'
  steps?: TestStep[];
  // Accessibility test specific fields
  wcag_level?: 'A' | 'AA' | 'AAA'; // WCAG conformance level
  accessibility_rules?: string[]; // Specific rules to check
  include_best_practices?: boolean; // Include best practices
  include_experimental?: boolean; // Include experimental rules
  include_pa11y?: boolean; // Run Pa11y alongside axe-core
  disable_javascript?: boolean; // Feature #621: Disable JavaScript for accessibility scan
  // Accessibility threshold configuration
  a11y_fail_on_any?: boolean;
  a11y_fail_on_critical?: number;
  a11y_fail_on_serious?: number;
  a11y_fail_on_moderate?: number;
  a11y_fail_on_minor?: number;
  a11y_timeout?: number; // Feature #623: Timeout in seconds for accessibility scan (default: 60, range: 30-600)
  // Feature #624: Dynamic content loading configuration
  a11y_wait_for?: 'load' | 'domcontentloaded' | 'networkidle';
  a11y_wait_selector?: string;
  a11y_wait_time?: number;
  a11y_scroll_page?: boolean;
  a11y_scroll_behavior?: 'smooth' | 'instant';
  // Lighthouse specific fields
  device_preset?: 'mobile' | 'desktop';
  performance_threshold?: number; // Minimum performance score (0-100) for Lighthouse
  lcp_threshold?: number; // Maximum LCP in ms (0 = disabled)
  cls_threshold?: number; // Maximum CLS (0 = disabled)
  bypass_csp?: boolean; // Bypass CSP for Lighthouse audits in testing environments
  ignore_ssl_errors?: boolean; // Ignore SSL certificate errors (with security warning)
  audit_timeout?: number; // Maximum time in seconds for Lighthouse audit (default: 60, range: 30-300)
  // Visual regression specific fields
  target_url?: string;
  viewport_width?: number;
  viewport_height?: number;
  viewport_preset?: string;
  capture_mode?: 'full_page' | 'viewport' | 'element'; // Screenshot capture mode (default: full_page)
  element_selector?: string; // CSS selector for element capture mode
  wait_for_selector?: string; // CSS selector to wait for before taking screenshot
  wait_time?: number; // Additional wait time in ms after page load before screenshot
  hide_selectors?: string; // CSS selectors for elements to hide (visibility:hidden) before screenshot
  remove_selectors?: string; // CSS selectors for elements to remove (display:none) before screenshot
  multi_viewport?: boolean; // Enable multi-viewport mode
  viewports?: string[]; // Array of viewport presets for multi-viewport mode
  diff_threshold?: number; // Acceptable diff percentage threshold for visual tests (0-100, default: 0)
  diff_threshold_mode?: 'percentage' | 'pixel_count'; // Threshold mode
  diff_pixel_threshold?: number; // Max different pixels for pixel_count mode
  ignore_regions?: IgnoreRegion[]; // Regions to ignore during visual comparison
  ignore_selectors?: string[]; // CSS selectors to ignore (bounding box calculated at runtime)
  mask_datetime_selectors?: string; // CSS selectors for datetime elements to mask
  mask_dynamic_content?: boolean; // Auto-mask common dynamic content
  // Feature #647: Anti-aliasing tolerance for cross-browser comparisons
  anti_aliasing_tolerance?: 'off' | 'low' | 'medium' | 'high'; // Perceptual diff tolerance for font rendering differences
  color_threshold?: number; // Color difference threshold for pixelmatch (0.0-1.0)
  // Load test specific fields (K6)
  virtual_users?: number; // Number of virtual users for load test
  duration?: number; // Test duration in seconds
  ramp_up_time?: number; // Ramp-up time in seconds
  k6_script?: string; // Custom K6 script for advanced users
  k6_thresholds?: K6Threshold[]; // K6 threshold configuration
  // Feature #1151: Human review workflow for AI tests
  ai_generated?: boolean; // Whether this test was generated by AI
  ai_confidence_score?: number; // AI generation confidence score (0-100) - Feature #1164
  review_status?: 'pending_review' | 'approved' | 'rejected' | null; // Review status
  status?: 'draft' | 'active' | 'archived'; // Test status override
}

export interface UpdateTestBody {
  name?: string;
  description?: string;
  test_type?: 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility';
  steps?: TestStep[];
  playwright_code?: string;
  use_custom_code?: boolean;
  // Accessibility test specific fields
  wcag_level?: 'A' | 'AA' | 'AAA'; // WCAG conformance level
  accessibility_rules?: string[]; // Specific rules to check
  include_best_practices?: boolean; // Include best practices
  include_experimental?: boolean; // Include experimental rules
  include_pa11y?: boolean; // Run Pa11y alongside axe-core
  disable_javascript?: boolean; // Feature #621: Disable JavaScript for accessibility scan
  // Lighthouse specific fields
  device_preset?: 'mobile' | 'desktop';
  performance_threshold?: number; // Minimum performance score (0-100) for Lighthouse
  lcp_threshold?: number; // Maximum LCP in ms (0 = disabled)
  cls_threshold?: number; // Maximum CLS (0 = disabled)
  bypass_csp?: boolean; // Bypass CSP for Lighthouse audits in testing environments
  ignore_ssl_errors?: boolean; // Ignore SSL certificate errors (with security warning)
  audit_timeout?: number; // Maximum time in seconds for Lighthouse audit (default: 60, range: 30-300)
  // Visual regression specific fields
  target_url?: string;
  viewport_width?: number;
  viewport_height?: number;
  viewport_preset?: string;
  capture_mode?: 'full_page' | 'viewport' | 'element'; // Screenshot capture mode
  element_selector?: string; // CSS selector for element capture mode
  wait_for_selector?: string; // CSS selector to wait for before taking screenshot
  wait_time?: number; // Additional wait time in ms after page load before screenshot
  hide_selectors?: string; // CSS selectors for elements to hide (visibility:hidden) before screenshot
  remove_selectors?: string; // CSS selectors for elements to remove (display:none) before screenshot
  multi_viewport?: boolean; // Enable multi-viewport mode
  viewports?: string[]; // Array of viewport presets for multi-viewport mode
  diff_threshold?: number; // Acceptable diff percentage threshold for visual tests (0-100, default: 0)
  diff_threshold_mode?: 'percentage' | 'pixel_count'; // Threshold mode
  diff_pixel_threshold?: number; // Max different pixels for pixel_count mode
  ignore_regions?: IgnoreRegion[]; // Regions to ignore during visual comparison
  ignore_selectors?: string[]; // CSS selectors to ignore (bounding box calculated at runtime)
  mask_datetime_selectors?: string; // CSS selectors for datetime elements to mask
  mask_dynamic_content?: boolean; // Auto-mask common dynamic content
  // Feature #647: Anti-aliasing tolerance for cross-browser comparisons
  anti_aliasing_tolerance?: 'off' | 'low' | 'medium' | 'high'; // Perceptual diff tolerance for font rendering differences
  color_threshold?: number; // Color difference threshold for pixelmatch (0.0-1.0)
  // Load test specific fields (K6)
  virtual_users?: number; // Number of virtual users for load test
  duration?: number; // Test duration in seconds
  ramp_up_time?: number; // Ramp-up time in seconds
  k6_script?: string; // Custom K6 script for advanced users
  k6_thresholds?: K6Threshold[]; // K6 threshold configuration
  status?: 'draft' | 'active' | 'archived';
}
