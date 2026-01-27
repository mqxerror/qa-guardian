/**
 * Shared types for Create Test Modal components
 * Feature #1786: Component extraction from TestSuitePage
 */

export type TestType = 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility';

export type AIGenMode = 'text' | 'screenshot' | 'user-story' | 'gherkin' | 'wizard' | 'openapi';

export type ViewportPreset = 'mobile' | 'tablet' | 'desktop' | 'custom';

export type CaptureMode = 'full_page' | 'viewport' | 'element';

export type WcagLevel = 'A' | 'AA' | 'AAA';

export type AntiAliasingTolerance = 'off' | 'low' | 'medium' | 'high';

export type DiffThresholdMode = 'percentage' | 'pixel_count';

export interface IgnoreRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
}

export interface ViewportConfig {
  preset: ViewportPreset;
  width: number;
  height: number;
}

export interface TestFormData {
  // Basic info
  name: string;
  description: string;
  type: TestType;
  targetUrl: string;

  // Viewport settings
  viewportPreset: ViewportPreset;
  viewportWidth: number;
  viewportHeight: number;

  // Visual regression specific
  captureMode: CaptureMode;
  elementSelector: string;
  waitForSelector: string;
  waitTime?: number;
  hideSelectors: string;
  removeSelectors: string;
  multiViewport: boolean;
  selectedViewports: string[];
  diffThreshold: number;
  diffThresholdMode: DiffThresholdMode;
  diffPixelThreshold: number;
  antiAliasingTolerance: AntiAliasingTolerance;
  colorThreshold?: number;
  ignoreRegions: IgnoreRegion[];
  ignoreSelectors: string[];

  // Lighthouse specific
  devicePreset: 'mobile' | 'desktop';
  performanceThreshold: number;
  lcpThreshold: number;
  clsThreshold: number;
  bypassCsp: boolean;
  ignoreSslErrors: boolean;
  auditTimeout: number;

  // Accessibility specific
  wcagLevel: WcagLevel;
  includeBestPractices: boolean;
  includeExperimental: boolean;
  includePa11y: boolean;
  a11yFailOnCritical?: number;
  a11yFailOnSerious?: number;
  a11yFailOnModerate?: number;
  a11yFailOnMinor?: number;
  a11yFailOnAny: boolean;

  // Load testing specific
  virtualUsers: number;
  duration: number;
  rampUpTime: number;
  k6Script: string;
}

export interface AICopilotSuggestion {
  field: string;
  value: string | number | boolean;
  reason: string;
  confidence: number;
}

export interface GeneratedTestPreview {
  name: string;
  type: string;
  target_url: string;
  steps?: Array<{ action: string; target: string; value?: string }>;
  description?: string;
}

export interface ProjectContext {
  id: string;
  name: string;
  baseUrl?: string;
  defaultBrowser?: string;
  viewportProfiles?: ViewportConfig[];
}

export interface SuiteContext {
  id: string;
  name: string;
  projectId: string;
}

// Props for main CreateTestModal component
export interface CreateTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when test is created. runId is provided if Create & Run was used (Feature #1985) */
  onTestCreated: (test: { id: string; name: string; runId?: string }) => void;
  suiteId: string;
  project?: ProjectContext;
  suite?: SuiteContext;
  token?: string;
}

// Default values based on existing code
export const DEFAULT_FORM_DATA: TestFormData = {
  name: '',
  description: '',
  type: 'e2e',
  targetUrl: '',
  viewportPreset: 'desktop',
  viewportWidth: 1920,
  viewportHeight: 1080,
  captureMode: 'full_page',
  elementSelector: '',
  waitForSelector: '',
  waitTime: undefined,
  hideSelectors: '',
  removeSelectors: '',
  multiViewport: false,
  selectedViewports: ['desktop', 'tablet', 'mobile'],
  diffThreshold: 0,
  diffThresholdMode: 'percentage',
  diffPixelThreshold: 0,
  antiAliasingTolerance: 'off',
  colorThreshold: undefined,
  ignoreRegions: [],
  ignoreSelectors: [],
  devicePreset: 'desktop',
  performanceThreshold: 50,
  lcpThreshold: 2500,
  clsThreshold: 0.1,
  bypassCsp: false,
  ignoreSslErrors: false,
  auditTimeout: 60,
  wcagLevel: 'AA',
  includeBestPractices: true,
  includeExperimental: false,
  includePa11y: false,
  a11yFailOnCritical: 0,
  a11yFailOnSerious: undefined,
  a11yFailOnModerate: undefined,
  a11yFailOnMinor: undefined,
  a11yFailOnAny: false,
  virtualUsers: 10,
  duration: 60,
  rampUpTime: 10,
  k6Script: '',
};

// Viewport presets
export const VIEWPORT_PRESETS = {
  mobile: { width: 375, height: 667, label: 'Mobile (375×667)' },
  tablet: { width: 768, height: 1024, label: 'Tablet (768×1024)' },
  desktop: { width: 1920, height: 1080, label: 'Desktop (1920×1080)' },
  custom: { width: 0, height: 0, label: 'Custom' },
};

// Multi-viewport configurations for visual testing
export const MULTI_VIEWPORT_CONFIGS = [
  { key: 'mobile', label: 'Mobile', width: 375, height: 667 },
  { key: 'tablet', label: 'Tablet', width: 768, height: 1024 },
  { key: 'desktop', label: 'Desktop', width: 1920, height: 1080 },
];
