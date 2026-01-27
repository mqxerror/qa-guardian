/**
 * Test script for Feature #897: MCP tool get-execution-browsers
 * Tests the get_execution_browsers MCP tool
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001';

interface AuthResponse {
  token: string;
}

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

interface BrowsersResponse {
  browsers: BrowserInfo[];
  mobile_emulators: MobileEmulator[];
  summary: {
    browser_count: number;
    mobile_emulator_count: number;
    default_browser: string;
  };
}

async function getAuthToken(): Promise<string> {
  const loginData = {
    email: 'owner@example.com',
    password: 'Owner123!'
  };
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loginData),
  });
  const data = (await response.json()) as AuthResponse;
  if (!data.token) {
    console.error('Login failed:', data);
    throw new Error('Failed to get auth token');
  }
  return data.token;
}

async function testGetExecutionBrowsers() {
  console.log('=== Testing Feature #897: MCP tool get-execution-browsers ===\n');

  try {
    const token = await getAuthToken();
    console.log('1. Got auth token');

    // Test: Get available browsers
    console.log('\n--- Test 1: Get available browsers ---');
    const response = await fetch(`${API_URL}/api/v1/browsers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as BrowsersResponse;
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    // Verify response structure
    const hasBrowsers = Array.isArray(data.browsers);
    const hasMobileEmulators = Array.isArray(data.mobile_emulators);
    const hasSummary = data.summary !== undefined;

    console.log(`\nResponse structure valid: ${hasBrowsers && hasMobileEmulators && hasSummary ? '✅' : '❌'}`);

    // Step 2: Verify Chromium listed
    console.log('\n--- Step 2: Verify Chromium listed ---');
    const chromium = data.browsers.find(b => b.name === 'chromium');
    const hasChromium = chromium !== undefined;
    const chromiumIsDefault = chromium?.isDefault === true;
    console.log(`Chromium listed: ${hasChromium ? '✅' : '❌'}`);
    console.log(`Chromium is default: ${chromiumIsDefault ? '✅' : '❌'}`);
    if (chromium) {
      console.log(`  - Display name: ${chromium.displayName}`);
      console.log(`  - Platforms: ${chromium.platforms.join(', ')}`);
      console.log(`  - Features: ${chromium.features.join(', ')}`);
    }

    // Step 3: Verify Firefox listed
    console.log('\n--- Step 3: Verify Firefox listed ---');
    const firefox = data.browsers.find(b => b.name === 'firefox');
    const hasFirefox = firefox !== undefined;
    console.log(`Firefox listed: ${hasFirefox ? '✅' : '❌'}`);
    if (firefox) {
      console.log(`  - Display name: ${firefox.displayName}`);
      console.log(`  - Platforms: ${firefox.platforms.join(', ')}`);
      console.log(`  - Features: ${firefox.features.join(', ')}`);
    }

    // Step 4: Verify WebKit listed
    console.log('\n--- Step 4: Verify WebKit listed ---');
    const webkit = data.browsers.find(b => b.name === 'webkit');
    const hasWebKit = webkit !== undefined;
    console.log(`WebKit listed: ${hasWebKit ? '✅' : '❌'}`);
    if (webkit) {
      console.log(`  - Display name: ${webkit.displayName}`);
      console.log(`  - Platforms: ${webkit.platforms.join(', ')}`);
      console.log(`  - Features: ${webkit.features.join(', ')}`);
    }

    // Step 5: Verify mobile emulators listed
    console.log('\n--- Step 5: Verify mobile emulators listed ---');
    const hasMobileDevices = data.mobile_emulators.length > 0;
    console.log(`Mobile emulators listed: ${hasMobileDevices ? '✅' : '❌'}`);
    console.log(`Total mobile emulators: ${data.mobile_emulators.length}`);

    // Check for specific device types
    const hasIPhone = data.mobile_emulators.some(m => m.name.includes('iPhone'));
    const hasPixel = data.mobile_emulators.some(m => m.name.includes('Pixel'));
    const hasGalaxy = data.mobile_emulators.some(m => m.name.includes('Galaxy'));
    const hasIPad = data.mobile_emulators.some(m => m.name.includes('iPad'));

    console.log(`  - iPhone devices: ${hasIPhone ? '✅' : '❌'}`);
    console.log(`  - Pixel devices: ${hasPixel ? '✅' : '❌'}`);
    console.log(`  - Galaxy devices: ${hasGalaxy ? '✅' : '❌'}`);
    console.log(`  - iPad devices: ${hasIPad ? '✅' : '❌'}`);

    console.log('\nMobile emulators:');
    data.mobile_emulators.forEach(m => {
      console.log(`  - ${m.name} (${m.browser}, ${m.viewport.width}x${m.viewport.height})`);
    });

    // Summary
    console.log('\n=== Verification Summary ===');
    const allPassed = hasChromium && hasFirefox && hasWebKit && hasMobileDevices &&
                      hasIPhone && hasPixel && hasGalaxy && hasIPad;
    console.log(`- Step 1: Call get-execution-browsers ${hasBrowsers ? '✅' : '❌'}`);
    console.log(`- Step 2: Verify Chromium listed ${hasChromium ? '✅' : '❌'}`);
    console.log(`- Step 3: Verify Firefox listed ${hasFirefox ? '✅' : '❌'}`);
    console.log(`- Step 4: Verify WebKit listed ${hasWebKit ? '✅' : '❌'}`);
    console.log(`- Step 5: Verify mobile emulators listed ${hasMobileDevices ? '✅' : '❌'}`);
    console.log(`\nAll tests passed: ${allPassed ? '✅' : '❌'}`);

  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testGetExecutionBrowsers();
