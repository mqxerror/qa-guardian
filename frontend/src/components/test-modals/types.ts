/**
 * Shared types for Create Test Modal components
 * Feature #1786: Component extraction from TestSuitePage
 */

export type TestType = 'e2e' | 'visual_regression' | 'lighthouse' | 'load' | 'accessibility';

export type AIGenMode = 'text' | 'screenshot' | 'user-story' | 'gherkin' | 'wizard' | 'openapi';

export type ViewportPreset = 'mobile' | 'tablet' | 'laptop' | 'desktop' | 'custom';

export type CaptureMode = 'full_page' | 'viewport' | 'element';

export type WcagLevel = 'A' | 'AA' | 'AAA';

export type AntiAliasingTolerance = 'off' | 'low' | 'medium' | 'high';

export type DiffThresholdMode = 'percentage' | 'pixel_count';

// Feature #36: Device emulation preset type
export type DeviceEmulationPreset =
  | 'desktop-1920'
  | 'desktop-1280'
  | 'laptop-1366'
  | 'macbook-pro-14'
  | 'ipad'
  | 'ipad-pro-11'
  | 'ipad-landscape'
  | 'galaxy-tab-s7'
  | 'iphone-14-pro'
  | 'iphone-14'
  | 'iphone-se'
  | 'iphone-15-pro-max'
  | 'pixel-7'
  | 'galaxy-s21'
  | 'galaxy-s23-ultra'
  | 'custom';

// Feature #36: Device emulation configuration
export interface DeviceConfig {
  preset: DeviceEmulationPreset;
  customViewport?: {
    width: number;
    height: number;
  };
  customUserAgent?: string;
  customDeviceScaleFactor?: number;
  customIsMobile?: boolean;
  customHasTouch?: boolean;
}

// Feature #36: Device preset display info
export interface DevicePresetInfo {
  name: string;
  displayName: string;
  category: 'desktop' | 'laptop' | 'tablet' | 'mobile';
  viewport: { width: number; height: number };
  isMobile: boolean;
  hasTouch: boolean;
  deviceScaleFactor: number;
}

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

  // Feature #36: Device emulation settings
  deviceEmulationEnabled: boolean;
  deviceConfig: DeviceConfig;

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

// Note: GeneratedTestPreview was removed - use from create-test/types.ts or suite-detail/useModalState.ts

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
  // Feature #36: Device emulation defaults
  deviceEmulationEnabled: false,
  deviceConfig: {
    preset: 'desktop-1280',
  },
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

// Feature #36: Device emulation presets with full device info
export const DEVICE_PRESETS: Record<DeviceEmulationPreset, DevicePresetInfo> = {
  // Desktop presets
  'desktop-1920': {
    name: 'desktop-1920',
    displayName: 'Desktop HD (1920x1080)',
    category: 'desktop',
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  'desktop-1280': {
    name: 'desktop-1280',
    displayName: 'Desktop (1280x720)',
    category: 'desktop',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  // Laptop presets
  'laptop-1366': {
    name: 'laptop-1366',
    displayName: 'Laptop (1366x768)',
    category: 'laptop',
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  'macbook-pro-14': {
    name: 'macbook-pro-14',
    displayName: 'MacBook Pro 14"',
    category: 'laptop',
    viewport: { width: 1512, height: 982 },
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
  },
  // Tablet presets
  'ipad': {
    name: 'ipad',
    displayName: 'iPad (10th gen)',
    category: 'tablet',
    viewport: { width: 820, height: 1180 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  'ipad-pro-11': {
    name: 'ipad-pro-11',
    displayName: 'iPad Pro 11"',
    category: 'tablet',
    viewport: { width: 834, height: 1194 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  'ipad-landscape': {
    name: 'ipad-landscape',
    displayName: 'iPad Landscape',
    category: 'tablet',
    viewport: { width: 1180, height: 820 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  'galaxy-tab-s7': {
    name: 'galaxy-tab-s7',
    displayName: 'Galaxy Tab S7',
    category: 'tablet',
    viewport: { width: 800, height: 1280 },
    deviceScaleFactor: 1.5,
    isMobile: true,
    hasTouch: true,
  },
  // Mobile presets - iPhone
  'iphone-14-pro': {
    name: 'iphone-14-pro',
    displayName: 'iPhone 14 Pro',
    category: 'mobile',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  'iphone-14': {
    name: 'iphone-14',
    displayName: 'iPhone 14',
    category: 'mobile',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  'iphone-se': {
    name: 'iphone-se',
    displayName: 'iPhone SE',
    category: 'mobile',
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  'iphone-15-pro-max': {
    name: 'iphone-15-pro-max',
    displayName: 'iPhone 15 Pro Max',
    category: 'mobile',
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  // Mobile presets - Android
  'pixel-7': {
    name: 'pixel-7',
    displayName: 'Pixel 7',
    category: 'mobile',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
  },
  'galaxy-s21': {
    name: 'galaxy-s21',
    displayName: 'Samsung Galaxy S21',
    category: 'mobile',
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  'galaxy-s23-ultra': {
    name: 'galaxy-s23-ultra',
    displayName: 'Samsung Galaxy S23 Ultra',
    category: 'mobile',
    viewport: { width: 384, height: 824 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  // Custom preset
  'custom': {
    name: 'custom',
    displayName: 'Custom Device',
    category: 'desktop',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
};

// Multi-viewport configurations for visual testing
export const MULTI_VIEWPORT_CONFIGS = [
  { key: 'mobile', label: 'Mobile', width: 375, height: 667 },
  { key: 'tablet', label: 'Tablet', width: 768, height: 1024 },
  { key: 'desktop', label: 'Desktop', width: 1920, height: 1080 },
];
