/**
 * Threshold constants for performance, quality, and test pass/fail criteria
 * Feature #116: Extract magic numbers and strings to constants files
 *
 * All exports are named for tree-shaking compatibility
 */

// ============================================================================
// Visual Regression Thresholds
// ============================================================================

/** Default diff threshold (0.1% pixel difference) */
export const DEFAULT_DIFF_THRESHOLD = 0.1;

/** Strict diff threshold (0.01% - for critical visual tests) */
export const STRICT_DIFF_THRESHOLD = 0.01;

/** Lenient diff threshold (1% - for tests with dynamic content) */
export const LENIENT_DIFF_THRESHOLD = 1.0;

/** Maximum diff percentage before auto-fail (10%) */
export const MAX_DIFF_THRESHOLD = 10.0;

// ============================================================================
// Performance (Lighthouse) Thresholds
// ============================================================================

/** Minimum acceptable Lighthouse score */
export const DEFAULT_PERFORMANCE_THRESHOLD = 50;

/** Good Lighthouse score threshold */
export const GOOD_PERFORMANCE_THRESHOLD = 90;

/** Core Web Vitals: LCP Good threshold (2.5 seconds) */
export const LCP_GOOD_THRESHOLD_MS = 2500;

/** Core Web Vitals: LCP Needs Improvement threshold (4 seconds) */
export const LCP_MODERATE_THRESHOLD_MS = 4000;

/** Core Web Vitals: CLS Good threshold */
export const CLS_GOOD_THRESHOLD = 0.1;

/** Core Web Vitals: CLS Needs Improvement threshold */
export const CLS_MODERATE_THRESHOLD = 0.25;

/** Core Web Vitals: FID Good threshold (100ms) */
export const FID_GOOD_THRESHOLD_MS = 100;

/** Core Web Vitals: FID Needs Improvement threshold (300ms) */
export const FID_MODERATE_THRESHOLD_MS = 300;

/** Core Web Vitals: INP Good threshold (200ms) */
export const INP_GOOD_THRESHOLD_MS = 200;

/** Core Web Vitals: INP Needs Improvement threshold (500ms) */
export const INP_MODERATE_THRESHOLD_MS = 500;

// ============================================================================
// Load Test Thresholds
// ============================================================================

/** Default P95 response time threshold (500ms) */
export const DEFAULT_P95_RESPONSE_TIME_MS = 500;

/** Default error rate threshold (1%) */
export const DEFAULT_ERROR_RATE_THRESHOLD = 0.01;

/** Default requests per second threshold */
export const DEFAULT_RPS_THRESHOLD = 100;

/** Maximum acceptable error rate (5%) */
export const MAX_ERROR_RATE_THRESHOLD = 0.05;

// ============================================================================
// Accessibility Thresholds
// ============================================================================

/** Default number of critical issues to fail */
export const A11Y_CRITICAL_FAIL_THRESHOLD = 0;

/** Default number of serious issues to fail */
export const A11Y_SERIOUS_FAIL_THRESHOLD = 5;

/** Default number of moderate issues to fail */
export const A11Y_MODERATE_FAIL_THRESHOLD = 10;

/** Default number of minor issues to fail */
export const A11Y_MINOR_FAIL_THRESHOLD = 20;

// ============================================================================
// Test Suite Pass Rates
// ============================================================================

/** Default pass rate threshold for suite (80%) */
export const DEFAULT_PASS_RATE_THRESHOLD = 0.8;

/** Strict pass rate threshold (100% - all tests must pass) */
export const STRICT_PASS_RATE_THRESHOLD = 1.0;

/** Minimum acceptable pass rate (50%) */
export const MIN_PASS_RATE_THRESHOLD = 0.5;

// ============================================================================
// Alert Thresholds
// ============================================================================

/** Default alert threshold for consecutive failures */
export const DEFAULT_ALERT_THRESHOLD = 3;

/** Default warning threshold (50% of alert threshold) */
export const DEFAULT_WARNING_THRESHOLD = 2;

// ============================================================================
// Flaky Test Thresholds
// ============================================================================

/** Minimum flakiness percentage to flag as flaky (10%) */
export const FLAKY_MIN_THRESHOLD = 0.1;

/** High flakiness threshold (30%) */
export const FLAKY_HIGH_THRESHOLD = 0.3;

/** Critical flakiness threshold (50%) */
export const FLAKY_CRITICAL_THRESHOLD = 0.5;

// ============================================================================
// Pagination & List Thresholds
// ============================================================================

/** Default page size for lists */
export const DEFAULT_PAGE_SIZE = 20;

/** Large page size for exports */
export const LARGE_PAGE_SIZE = 100;

/** Maximum page size */
export const MAX_PAGE_SIZE = 500;

/** Threshold to enable virtual scrolling (items) */
export const VIRTUAL_SCROLL_THRESHOLD = 50;

/** Infinite scroll trigger distance (pixels from bottom) */
export const INFINITE_SCROLL_THRESHOLD_PX = 100;

// ============================================================================
// File Size Thresholds
// ============================================================================

/** Maximum file upload size (10MB) */
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

/** Maximum screenshot size (5MB) */
export const MAX_SCREENSHOT_SIZE_BYTES = 5 * 1024 * 1024;

/** Maximum report export size (50MB) */
export const MAX_EXPORT_SIZE_BYTES = 50 * 1024 * 1024;

// ============================================================================
// Security Scan Thresholds
// ============================================================================

/** Critical vulnerability score threshold (CVSS 9.0+) */
export const CVSS_CRITICAL_THRESHOLD = 9.0;

/** High vulnerability score threshold (CVSS 7.0+) */
export const CVSS_HIGH_THRESHOLD = 7.0;

/** Medium vulnerability score threshold (CVSS 4.0+) */
export const CVSS_MEDIUM_THRESHOLD = 4.0;

/** Low vulnerability score threshold (CVSS 0.1+) */
export const CVSS_LOW_THRESHOLD = 0.1;
