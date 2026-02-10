// Feature #104: Split VisualConfig.tsx into logical modules
// Constants extracted from VisualConfig.tsx

import type { DevicePreset, CaptureModeOption, VisualConfigState, ViewportConfig } from './types';

/**
 * Feature #1920: Extended device presets with real device dimensions
 */
export const DEVICE_PRESETS: DevicePreset[] = [
  // Mobile devices
  { name: 'iPhone 14', width: 390, height: 844, enabled: false, icon: '📱', category: 'mobile' },
  { name: 'iPhone SE', width: 375, height: 667, enabled: false, icon: '📱', category: 'mobile' },
  { name: 'Pixel 7', width: 412, height: 915, enabled: false, icon: '📱', category: 'mobile' },
  { name: 'Galaxy S21', width: 360, height: 800, enabled: false, icon: '📱', category: 'mobile' },
  // Tablet devices
  { name: 'iPad', width: 768, height: 1024, enabled: false, icon: '📟', category: 'tablet' },
  { name: 'iPad Pro', width: 1024, height: 1366, enabled: false, icon: '📟', category: 'tablet' },
  // Desktop devices
  { name: 'MacBook 13"', width: 1440, height: 900, enabled: false, icon: '💻', category: 'desktop' },
  { name: 'Desktop HD', width: 1920, height: 1080, enabled: true, icon: '🖥️', category: 'desktop' },
  { name: 'Desktop 4K', width: 3840, height: 2160, enabled: false, icon: '🖥️', category: 'desktop' },
];

/**
 * Default viewport presets (backwards compatible)
 */
export const DEFAULT_VIEWPORTS: ViewportConfig[] = DEVICE_PRESETS.map(({ icon, category, ...vp }) => vp);

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: VisualConfigState = {
  name: '',
  description: '',
  targetUrl: '',
  viewports: DEFAULT_VIEWPORTS,
  captureMode: 'full_page',
  elementSelector: '',
  diffThreshold: 0.1,
  hideSelectors: [],
  waitForSelector: '',
  delay: 0,
  // Feature #590: Additional visual regression options
  antiAliasingTolerance: 'off',
  ignoreRegions: [],
  ignoreSelectors: [],
  customCSS: '',
  clipSelector: '',
  colorThreshold: 0.1,
};

/**
 * Anti-aliasing tolerance options for UI display
 * Feature #590: Human-readable labels for anti-aliasing levels
 */
export const ANTI_ALIASING_OPTIONS = [
  { value: 'off', label: 'Off', description: 'No anti-aliasing tolerance (strictest)' },
  { value: 'low', label: 'Low', description: 'Minor font rendering differences' },
  { value: 'medium', label: 'Medium', description: 'Moderate edge smoothing (recommended)' },
  { value: 'high', label: 'High', description: 'Maximum tolerance for visual differences' },
] as const;

/**
 * Capture mode options
 */
export const CAPTURE_MODES: CaptureModeOption[] = [
  { value: 'full_page', label: 'Full Page', description: 'Capture the entire scrollable page' },
  { value: 'viewport', label: 'Viewport Only', description: 'Capture only the visible viewport' },
  { value: 'element', label: 'Specific Element', description: 'Capture a specific DOM element' },
];
