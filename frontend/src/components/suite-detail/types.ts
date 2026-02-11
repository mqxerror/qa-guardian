/**
 * Types for Test Suite Detail Page
 * Extracted from TestSuitePage.tsx for modularity (Feature #50)
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
  viewport_width?: number;
  viewport_height?: number;
  timeout?: number;
  retry_count?: number;
  project_id?: string;
}

// Test type - the individual test within a suite
export interface TestType {
  id: string;
  suite_id: string;
  name: string;
  description?: string;
  type: TestTypeEnum;
  test_type?: string;
  status: TestStatus;
  created_at: string;
  updated_at: string;
  last_run_at?: string;
  target_url?: string;
  viewport_width?: number;
  viewport_height?: number;
  // Visual regression specific
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
  // Lighthouse specific
  device_preset?: 'mobile' | 'desktop';
  performance_threshold?: number;
  lcp_threshold?: number;
  cls_threshold?: number;
  bypass_csp?: boolean;
  ignore_ssl_errors?: boolean;
  audit_timeout?: number;
  // Accessibility specific
  wcag_level?: 'A' | 'AA' | 'AAA';
  include_best_practices?: boolean;
  include_experimental?: boolean;
  include_pa11y?: boolean;
  a11y_fail_on_critical?: number;
  a11y_fail_on_serious?: number;
  a11y_fail_on_moderate?: number;
  a11y_fail_on_minor?: number;
  a11y_fail_on_any?: boolean;
  // Load test specific
  virtual_users?: number;
  duration?: number;
  ramp_up_time?: number;
  k6_script?: string;
  // AI generation metadata
  ai_generated?: boolean;
  ai_confidence_score?: number;
  requires_review?: boolean;
  review_status?: 'pending' | 'approved' | 'rejected' | 'pending_review';
  reviewed_by?: string;
  reviewed_at?: string;
  // Self-healing properties
  healing_active?: boolean;
  healing_status?: HealingStatus;
  healing_count?: number;
  // Run metadata for test list display
  run_count?: number;
  last_result?: 'passed' | 'failed' | 'error' | 'running' | null;
  avg_duration_ms?: number | null;
}

export type TestTypeEnum = 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility' | 'api';
export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'error' | 'active' | 'draft';
export type HealingStatus = 'idle' | 'healing' | 'healed' | 'pending' | 'applied' | 'rejected';

export interface IgnoreRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
}

export interface TestStep {
  id: string;
  action: string;
  selector?: string;
  value?: string;
  description?: string;
}

// AI Copilot suggestion
export interface AICopilotSuggestion {
  id: string;
  type: 'selector' | 'assertion' | 'name' | 'description' | 'best_practice';
  message: string;
  suggestion: string;
  impact: 'high' | 'medium' | 'low';
  field?: string;
}

// AI Test Generation types
export interface AITestGeneration {
  name: string;
  description: string;
  type: TestTypeEnum;
  steps?: TestStep[];
  targetUrl: string;
  confidence: number;
}

// Edit selector modal state
export interface EditSelectorModalState {
  isOpen: boolean;
  runId: string;
  testId: string;
  stepId: string;
  currentSelector: string;
  originalSelector: string;
  wasHealed: boolean;
}

// Annotation types for screenshot-to-test
export type AnnotationType = 'click' | 'type' | 'expect';

export interface Annotation {
  id: string;
  type: AnnotationType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
}

// Sort configuration
export type SortField = 'name' | 'type' | 'status' | 'last_run_at' | 'run_count' | 'avg_duration_ms';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

// Viewport presets
// Note: ViewportPreset string union is defined in test-modals/types.ts
// This interface is for the preset configuration objects
export interface ViewportPresetConfig {
  width: number;
  height: number;
  label: string;
}

export const VIEWPORT_PRESETS: Record<string, ViewportPresetConfig> = {
  desktop: { width: 1920, height: 1080, label: 'Desktop (1920x1080)' },
  'desktop-hd': { width: 2560, height: 1440, label: 'Desktop HD (2560x1440)' },
  laptop: { width: 1366, height: 768, label: 'Laptop (1366x768)' },
  tablet: { width: 768, height: 1024, label: 'Tablet (768x1024)' },
  'tablet-landscape': { width: 1024, height: 768, label: 'Tablet Landscape (1024x768)' },
  mobile: { width: 375, height: 812, label: 'Mobile (375x812)' },
  'mobile-sm': { width: 320, height: 568, label: 'Mobile Small (320x568)' },
  custom: { width: 0, height: 0, label: 'Custom' },
};

// K6 Load test default script template
export const DEFAULT_K6_SCRIPT = `import http from 'k6/http';
import { check, sleep } from 'k6';

// Test configuration
export const options = {
  vus: {{VUS}},
  duration: '{{DURATION}}s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

// Default function - runs for each virtual user iteration
export default function () {
  const res = http.get('{{TARGET_URL}}');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}

// Setup function - runs once before the test
export function setup() {
  console.log('Starting load test...');
}

// Teardown function - runs once after the test
export function teardown(data) {
  console.log('Load test completed');
}
`;

// Project interface
export interface Project {
  id: string;
  name: string;
  base_url?: string;
}

// Review settings
export interface ReviewSettings {
  requires_review: boolean;
  auto_approve_threshold?: number;
}

// Quick action types
export type QuickAction = 'run' | 'duplicate' | 'delete' | 'edit';
