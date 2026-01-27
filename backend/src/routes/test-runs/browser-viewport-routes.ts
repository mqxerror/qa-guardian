/**
 * Browser and Viewport Routes Module (Feature #1356 - Code Quality)
 *
 * Extracted from test-runs.ts for better maintainability.
 * Contains routes for:
 * - Available browsers and mobile emulators listing
 * - Viewport presets listing
 */

import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth';

// Browser type definitions
interface BrowserInfo {
  name: string;
  displayName: string;
  description: string;
  version: string;
  isDefault: boolean;
  supported: boolean;
  platforms: string[];
  features: string[];
}

interface MobileEmulator {
  name: string;
  device: string;
  browser: string;
  viewport: { width: number; height: number };
  userAgent: string;
  hasTouch: boolean;
  isMobile: boolean;
  deviceScaleFactor: number;
}

interface ViewportPreset {
  name: string;
  displayName: string;
  width: number;
  height: number;
  description: string;
  isDefault: boolean;
}

/**
 * Register browser and viewport routes
 */
export async function browserViewportRoutes(app: FastifyInstance) {

  // Feature #897: Get available execution browsers
  app.get('/api/v1/browsers', {
    preHandler: [authenticate],
  }, async (_request, _reply) => {
    // Return available browsers for test execution
    const browsers: BrowserInfo[] = [
      {
        name: 'chromium',
        displayName: 'Chromium',
        description: 'Google Chrome and Microsoft Edge compatible browser',
        version: 'latest',
        isDefault: true,
        supported: true,
        platforms: ['linux', 'macos', 'windows'],
        features: ['devtools', 'cdp', 'tracing', 'pdf', 'video'],
      },
      {
        name: 'firefox',
        displayName: 'Firefox',
        description: 'Mozilla Firefox browser',
        version: 'latest',
        isDefault: false,
        supported: true,
        platforms: ['linux', 'macos', 'windows'],
        features: ['devtools', 'video'],
      },
      {
        name: 'webkit',
        displayName: 'WebKit',
        description: 'Safari browser engine',
        version: 'latest',
        isDefault: false,
        supported: true,
        platforms: ['linux', 'macos', 'windows'],
        features: ['video'],
      },
    ];

    // Mobile emulators (Playwright device presets)
    const mobileEmulators: MobileEmulator[] = [
      {
        name: 'iPhone 14',
        device: 'iPhone 14',
        browser: 'webkit',
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 3,
      },
      {
        name: 'iPhone 14 Pro Max',
        device: 'iPhone 14 Pro Max',
        browser: 'webkit',
        viewport: { width: 430, height: 932 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 3,
      },
      {
        name: 'iPhone 12',
        device: 'iPhone 12',
        browser: 'webkit',
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 3,
      },
      {
        name: 'iPad Pro 11',
        device: 'iPad Pro 11',
        browser: 'webkit',
        viewport: { width: 834, height: 1194 },
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2,
      },
      {
        name: 'Pixel 7',
        device: 'Pixel 7',
        browser: 'chromium',
        viewport: { width: 412, height: 915 },
        userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Mobile Safari/537.36',
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2.625,
      },
      {
        name: 'Pixel 5',
        device: 'Pixel 5',
        browser: 'chromium',
        viewport: { width: 393, height: 851 },
        userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.105 Mobile Safari/537.36',
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2.75,
      },
      {
        name: 'Galaxy S21',
        device: 'Galaxy S21',
        browser: 'chromium',
        viewport: { width: 360, height: 800 },
        userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.105 Mobile Safari/537.36',
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 3,
      },
      {
        name: 'Galaxy Tab S7',
        device: 'Galaxy Tab S7',
        browser: 'chromium',
        viewport: { width: 800, height: 1280 },
        userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.105 Safari/537.36',
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 1.5,
      },
    ];

    return {
      browsers,
      mobile_emulators: mobileEmulators,
      summary: {
        browser_count: browsers.length,
        mobile_emulator_count: mobileEmulators.length,
        default_browser: 'chromium',
      },
    };
  });

  // Feature #898: Get available viewport presets
  app.get('/api/v1/viewports', {
    preHandler: [authenticate],
  }, async (_request, _reply) => {
    // Return available viewport presets for test execution
    const viewports: {
      desktop: ViewportPreset[];
      tablet: ViewportPreset[];
      mobile: ViewportPreset[];
    } = {
      desktop: [
        {
          name: 'desktop-hd',
          displayName: 'Desktop HD',
          width: 1920,
          height: 1080,
          description: 'Full HD desktop resolution',
          isDefault: true,
        },
        {
          name: 'desktop-large',
          displayName: 'Desktop Large',
          width: 1440,
          height: 900,
          description: 'Large desktop resolution (14-15" laptops)',
          isDefault: false,
        },
        {
          name: 'desktop-medium',
          displayName: 'Desktop Medium',
          width: 1280,
          height: 800,
          description: 'Medium desktop resolution (13" laptops)',
          isDefault: false,
        },
        {
          name: 'desktop-small',
          displayName: 'Desktop Small',
          width: 1024,
          height: 768,
          description: 'Small desktop / large tablet landscape',
          isDefault: false,
        },
        {
          name: 'desktop-4k',
          displayName: 'Desktop 4K',
          width: 3840,
          height: 2160,
          description: 'Ultra HD 4K resolution',
          isDefault: false,
        },
        {
          name: 'desktop-ultrawide',
          displayName: 'Desktop Ultrawide',
          width: 2560,
          height: 1080,
          description: 'Ultrawide 21:9 monitor',
          isDefault: false,
        },
      ],
      tablet: [
        {
          name: 'tablet-landscape',
          displayName: 'Tablet Landscape',
          width: 1024,
          height: 768,
          description: 'iPad and similar tablets in landscape',
          isDefault: true,
        },
        {
          name: 'tablet-portrait',
          displayName: 'Tablet Portrait',
          width: 768,
          height: 1024,
          description: 'iPad and similar tablets in portrait',
          isDefault: false,
        },
        {
          name: 'tablet-pro-landscape',
          displayName: 'Tablet Pro Landscape',
          width: 1194,
          height: 834,
          description: 'iPad Pro 11" in landscape',
          isDefault: false,
        },
        {
          name: 'tablet-pro-portrait',
          displayName: 'Tablet Pro Portrait',
          width: 834,
          height: 1194,
          description: 'iPad Pro 11" in portrait',
          isDefault: false,
        },
        {
          name: 'tablet-mini-landscape',
          displayName: 'Tablet Mini Landscape',
          width: 1024,
          height: 744,
          description: 'iPad Mini in landscape',
          isDefault: false,
        },
        {
          name: 'tablet-mini-portrait',
          displayName: 'Tablet Mini Portrait',
          width: 744,
          height: 1024,
          description: 'iPad Mini in portrait',
          isDefault: false,
        },
      ],
      mobile: [
        {
          name: 'mobile-medium',
          displayName: 'Mobile Medium',
          width: 390,
          height: 844,
          description: 'iPhone 14/15 (most common)',
          isDefault: true,
        },
        {
          name: 'mobile-large',
          displayName: 'Mobile Large',
          width: 430,
          height: 932,
          description: 'iPhone 14/15 Pro Max',
          isDefault: false,
        },
        {
          name: 'mobile-small',
          displayName: 'Mobile Small',
          width: 375,
          height: 667,
          description: 'iPhone SE / older iPhones',
          isDefault: false,
        },
        {
          name: 'mobile-android',
          displayName: 'Mobile Android',
          width: 412,
          height: 915,
          description: 'Pixel 7 / common Android size',
          isDefault: false,
        },
        {
          name: 'mobile-android-small',
          displayName: 'Mobile Android Small',
          width: 360,
          height: 800,
          description: 'Galaxy S21 / smaller Android',
          isDefault: false,
        },
        {
          name: 'mobile-landscape',
          displayName: 'Mobile Landscape',
          width: 844,
          height: 390,
          description: 'Mobile phone in landscape orientation',
          isDefault: false,
        },
      ],
    };

    const totalPresets = viewports.desktop.length + viewports.tablet.length + viewports.mobile.length;

    return {
      viewports,
      summary: {
        desktop_count: viewports.desktop.length,
        tablet_count: viewports.tablet.length,
        mobile_count: viewports.mobile.length,
        total_presets: totalPresets,
        default_viewport: 'desktop-hd',
      },
    };
  });
}
