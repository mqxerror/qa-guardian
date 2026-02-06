/**
 * Timeout constants for API calls, polling, and UI interactions
 * Feature #116: Extract magic numbers and strings to constants files
 *
 * All exports are named for tree-shaking compatibility
 */

// ============================================================================
// Test Execution Timeouts
// ============================================================================

/** Default test execution timeout (30 seconds) */
export const DEFAULT_TEST_TIMEOUT_MS = 30000;

/** Minimum test timeout (5 seconds) */
export const MIN_TEST_TIMEOUT_MS = 5000;

/** Maximum test timeout (5 minutes) */
export const MAX_TEST_TIMEOUT_MS = 300000;

/** Screenshot capture timeout (10 seconds) */
export const SCREENSHOT_TIMEOUT_MS = 10000;

// ============================================================================
// WebSocket & Connection Timeouts
// ============================================================================

/** WebSocket connection timeout (10 seconds) */
export const SOCKET_CONNECT_TIMEOUT_MS = 10000;

/** Heartbeat interval (30 seconds) */
export const HEARTBEAT_INTERVAL_MS = 30000;

/** Heartbeat response timeout (60 seconds - 2 missed heartbeats) */
export const HEARTBEAT_TIMEOUT_MS = 60000;

/** Initial reconnect delay (1 second) */
export const INITIAL_RECONNECT_DELAY_MS = 1000;

/** Maximum reconnect delay (30 seconds) */
export const MAX_RECONNECT_DELAY_MS = 30000;

// ============================================================================
// Polling Intervals
// ============================================================================

/** Test run status polling interval (2 seconds) */
export const RUN_POLL_INTERVAL_MS = 2000;

/** DAST/SAST scan polling interval (2 seconds) */
export const SCAN_POLL_INTERVAL_MS = 2000;

/** Dashboard stats refresh interval (30 seconds) */
export const DASHBOARD_REFRESH_INTERVAL_MS = 30000;

/** Monitoring health check interval (60 seconds) */
export const HEALTH_CHECK_INTERVAL_MS = 60000;

// ============================================================================
// API Request Timeouts
// ============================================================================

/** Standard API request timeout (10 seconds) */
export const API_TIMEOUT_MS = 10000;

/** Long-running API timeout (30 seconds) */
export const API_LONG_TIMEOUT_MS = 30000;

/** File upload timeout (2 minutes) */
export const UPLOAD_TIMEOUT_MS = 120000;

/** AI analysis timeout (60 seconds) */
export const AI_ANALYSIS_TIMEOUT_MS = 60000;

// ============================================================================
// UI Debounce & Throttle
// ============================================================================

/** Search input debounce delay (300ms) */
export const SEARCH_DEBOUNCE_MS = 300;

/** Form input debounce delay (150ms) */
export const INPUT_DEBOUNCE_MS = 150;

/** Scroll throttle delay (100ms) */
export const SCROLL_THROTTLE_MS = 100;

/** Auto-focus delay for modals (100ms) */
export const MODAL_FOCUS_DELAY_MS = 100;

// ============================================================================
// Animation Durations
// ============================================================================

/** Toast notification display duration (5 seconds) */
export const TOAST_DURATION_MS = 5000;

/** Modal transition duration (200ms) */
export const MODAL_TRANSITION_MS = 200;

/** Loading spinner minimum display (500ms) */
export const MIN_LOADING_DISPLAY_MS = 500;

// ============================================================================
// Stale Time for React Query
// ============================================================================

/** Default stale time for queries (1 minute) */
export const QUERY_STALE_TIME_MS = 60000;

/** Short stale time for frequently changing data (30 seconds) */
export const QUERY_SHORT_STALE_TIME_MS = 30000;

/** Long stale time for static data (5 minutes) */
export const QUERY_LONG_STALE_TIME_MS = 300000;
