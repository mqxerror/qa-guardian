/**
 * Device Presets Module (Feature #36 - Mobile Device Emulation)
 *
 * Defines device presets for test execution with full device emulation:
 * - Viewport dimensions
 * - User agent string
 * - Device scale factor
 * - Mobile/touch flags
 *
 * Based on Playwright's built-in device descriptors with additions for common devices.
 */

export interface DeviceConfig {
  name: string;
  displayName: string;
  category: 'desktop' | 'laptop' | 'tablet' | 'mobile';
  viewport: {
    width: number;
    height: number;
  };
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  userAgent: string;
  defaultBrowserType?: 'chromium' | 'firefox' | 'webkit';
}

/**
 * Device presets for test execution
 * Key is the preset ID used in test configuration
 */
export const DEVICE_PRESETS: Record<string, DeviceConfig> = {
  // Desktop presets
  'desktop-1920': {
    name: 'desktop-1920',
    displayName: 'Desktop HD (1920x1080)',
    category: 'desktop',
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  'desktop-1280': {
    name: 'desktop-1280',
    displayName: 'Desktop (1280x720)',
    category: 'desktop',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  'macbook-pro-14': {
    name: 'macbook-pro-14',
    displayName: 'MacBook Pro 14"',
    category: 'laptop',
    viewport: { width: 1512, height: 982 },
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    defaultBrowserType: 'webkit',
  },
  'ipad-pro-11': {
    name: 'ipad-pro-11',
    displayName: 'iPad Pro 11"',
    category: 'tablet',
    viewport: { width: 834, height: 1194 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    defaultBrowserType: 'webkit',
  },
  'ipad-landscape': {
    name: 'ipad-landscape',
    displayName: 'iPad Landscape',
    category: 'tablet',
    viewport: { width: 1180, height: 820 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    defaultBrowserType: 'webkit',
  },
  'galaxy-tab-s7': {
    name: 'galaxy-tab-s7',
    displayName: 'Galaxy Tab S7',
    category: 'tablet',
    viewport: { width: 800, height: 1280 },
    deviceScaleFactor: 1.5,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    defaultBrowserType: 'chromium',
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
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    defaultBrowserType: 'webkit',
  },
  'iphone-14': {
    name: 'iphone-14',
    displayName: 'iPhone 14',
    category: 'mobile',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    defaultBrowserType: 'webkit',
  },
  'iphone-se': {
    name: 'iphone-se',
    displayName: 'iPhone SE',
    category: 'mobile',
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    defaultBrowserType: 'webkit',
  },
  'iphone-15-pro-max': {
    name: 'iphone-15-pro-max',
    displayName: 'iPhone 15 Pro Max',
    category: 'mobile',
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    defaultBrowserType: 'webkit',
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
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    defaultBrowserType: 'chromium',
  },
  'galaxy-s21': {
    name: 'galaxy-s21',
    displayName: 'Samsung Galaxy S21',
    category: 'mobile',
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    defaultBrowserType: 'chromium',
  },
  'galaxy-s23-ultra': {
    name: 'galaxy-s23-ultra',
    displayName: 'Samsung Galaxy S23 Ultra',
    category: 'mobile',
    viewport: { width: 384, height: 824 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    defaultBrowserType: 'chromium',
  },

  // Custom preset (user-defined dimensions)
  'custom': {
    name: 'custom',
    displayName: 'Custom',
    category: 'desktop',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
};

/**
 * Get device config by preset name
 * Returns default desktop config if preset not found
 */
export function getDeviceConfig(presetName: string): DeviceConfig {
  return DEVICE_PRESETS[presetName] || DEVICE_PRESETS['desktop-1280'];
}

/**
 * Get all device presets grouped by category
 */
export function getDevicePresetsByCategory(): Record<string, DeviceConfig[]> {
  const categories: Record<string, DeviceConfig[]> = {
    desktop: [],
    laptop: [],
    tablet: [],
    mobile: [],
  };

  for (const preset of Object.values(DEVICE_PRESETS)) {
    if (preset.name !== 'custom') {
      categories[preset.category].push(preset);
    }
  }

  return categories;
}

/**
 * Device config stored in test configuration
 * Allows custom overrides while referencing a preset
 */
export interface TestDeviceConfig {
  preset: string;
  // Custom overrides (used when preset is 'custom')
  customViewport?: {
    width: number;
    height: number;
  };
  customUserAgent?: string;
  customDeviceScaleFactor?: number;
  customIsMobile?: boolean;
  customHasTouch?: boolean;
}

/**
 * Resolve a TestDeviceConfig to a full DeviceConfig
 * Merges preset defaults with any custom overrides
 */
export function resolveDeviceConfig(testConfig: TestDeviceConfig | undefined): DeviceConfig {
  if (!testConfig) {
    return DEVICE_PRESETS['desktop-1280'];
  }

  const baseConfig = DEVICE_PRESETS[testConfig.preset] || DEVICE_PRESETS['desktop-1280'];

  // If custom preset, apply overrides
  if (testConfig.preset === 'custom') {
    return {
      ...baseConfig,
      viewport: testConfig.customViewport || baseConfig.viewport,
      userAgent: testConfig.customUserAgent || baseConfig.userAgent,
      deviceScaleFactor: testConfig.customDeviceScaleFactor ?? baseConfig.deviceScaleFactor,
      isMobile: testConfig.customIsMobile ?? baseConfig.isMobile,
      hasTouch: testConfig.customHasTouch ?? baseConfig.hasTouch,
    };
  }

  return baseConfig;
}

/**
 * Get list of device presets for API response
 */
export function getDevicePresetsForApi() {
  return Object.values(DEVICE_PRESETS).map(preset => ({
    name: preset.name,
    displayName: preset.displayName,
    category: preset.category,
    viewport: preset.viewport,
    isMobile: preset.isMobile,
    hasTouch: preset.hasTouch,
    deviceScaleFactor: preset.deviceScaleFactor,
  }));
}
