/**
 * Test script for Feature #898: MCP tool get-execution-viewports
 * Tests the get_execution_viewports MCP tool
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001';

interface AuthResponse {
  token: string;
}

interface ViewportPreset {
  name: string;
  displayName: string;
  width: number;
  height: number;
  description: string;
  isDefault: boolean;
}

interface ViewportsResponse {
  viewports: {
    desktop: ViewportPreset[];
    tablet: ViewportPreset[];
    mobile: ViewportPreset[];
  };
  summary: {
    desktop_count: number;
    tablet_count: number;
    mobile_count: number;
    total_presets: number;
    default_viewport: string;
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

async function testGetExecutionViewports() {
  console.log('=== Testing Feature #898: MCP tool get-execution-viewports ===\n');

  try {
    const token = await getAuthToken();
    console.log('1. Got auth token');

    // Test: Get available viewports
    console.log('\n--- Step 1: Call get-execution-viewports ---');
    const response = await fetch(`${API_URL}/api/v1/viewports`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as ViewportsResponse;
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    // Verify response structure
    const hasViewports = data.viewports !== undefined;
    const hasSummary = data.summary !== undefined;
    const hasDesktop = Array.isArray(data.viewports?.desktop);
    const hasTablet = Array.isArray(data.viewports?.tablet);
    const hasMobile = Array.isArray(data.viewports?.mobile);

    console.log(`\nResponse structure valid: ${hasViewports && hasSummary ? '✅' : '❌'}`);

    // Step 2: Verify desktop presets
    console.log('\n--- Step 2: Verify desktop presets ---');
    const desktopPresets = data.viewports.desktop;
    const hasDesktopPresets = desktopPresets.length > 0;
    const hasDesktopHD = desktopPresets.some(v => v.name === 'desktop-hd');
    const hasDesktop4K = desktopPresets.some(v => v.name === 'desktop-4k');
    const hasDesktopUltrawide = desktopPresets.some(v => v.name === 'desktop-ultrawide');

    console.log(`Desktop presets present: ${hasDesktopPresets ? '✅' : '❌'} (${desktopPresets.length} presets)`);
    console.log(`  - Desktop HD (1920x1080): ${hasDesktopHD ? '✅' : '❌'}`);
    console.log(`  - Desktop 4K (3840x2160): ${hasDesktop4K ? '✅' : '❌'}`);
    console.log(`  - Desktop Ultrawide: ${hasDesktopUltrawide ? '✅' : '❌'}`);

    console.log('\nDesktop presets:');
    desktopPresets.forEach(v => {
      console.log(`  - ${v.displayName} (${v.width}x${v.height})${v.isDefault ? ' [default]' : ''}`);
    });

    // Step 3: Verify tablet presets
    console.log('\n--- Step 3: Verify tablet presets ---');
    const tabletPresets = data.viewports.tablet;
    const hasTabletPresets = tabletPresets.length > 0;
    const hasTabletLandscape = tabletPresets.some(v => v.name === 'tablet-landscape');
    const hasTabletPortrait = tabletPresets.some(v => v.name === 'tablet-portrait');
    const hasTabletPro = tabletPresets.some(v => v.name.includes('tablet-pro'));

    console.log(`Tablet presets present: ${hasTabletPresets ? '✅' : '❌'} (${tabletPresets.length} presets)`);
    console.log(`  - Tablet Landscape: ${hasTabletLandscape ? '✅' : '❌'}`);
    console.log(`  - Tablet Portrait: ${hasTabletPortrait ? '✅' : '❌'}`);
    console.log(`  - Tablet Pro variants: ${hasTabletPro ? '✅' : '❌'}`);

    console.log('\nTablet presets:');
    tabletPresets.forEach(v => {
      console.log(`  - ${v.displayName} (${v.width}x${v.height})${v.isDefault ? ' [default]' : ''}`);
    });

    // Step 4: Verify mobile presets
    console.log('\n--- Step 4: Verify mobile presets ---');
    const mobilePresets = data.viewports.mobile;
    const hasMobilePresets = mobilePresets.length > 0;
    const hasMobileMedium = mobilePresets.some(v => v.name === 'mobile-medium');
    const hasMobileLarge = mobilePresets.some(v => v.name === 'mobile-large');
    const hasMobileSmall = mobilePresets.some(v => v.name === 'mobile-small');
    const hasMobileAndroid = mobilePresets.some(v => v.name.includes('android'));

    console.log(`Mobile presets present: ${hasMobilePresets ? '✅' : '❌'} (${mobilePresets.length} presets)`);
    console.log(`  - Mobile Medium (iPhone): ${hasMobileMedium ? '✅' : '❌'}`);
    console.log(`  - Mobile Large: ${hasMobileLarge ? '✅' : '❌'}`);
    console.log(`  - Mobile Small: ${hasMobileSmall ? '✅' : '❌'}`);
    console.log(`  - Mobile Android: ${hasMobileAndroid ? '✅' : '❌'}`);

    console.log('\nMobile presets:');
    mobilePresets.forEach(v => {
      console.log(`  - ${v.displayName} (${v.width}x${v.height})${v.isDefault ? ' [default]' : ''}`);
    });

    // Summary
    console.log('\n=== Summary ===');
    console.log(`Total presets: ${data.summary.total_presets}`);
    console.log(`  - Desktop: ${data.summary.desktop_count}`);
    console.log(`  - Tablet: ${data.summary.tablet_count}`);
    console.log(`  - Mobile: ${data.summary.mobile_count}`);
    console.log(`Default viewport: ${data.summary.default_viewport}`);

    console.log('\n=== Verification Summary ===');
    const allPassed = hasDesktopPresets && hasTabletPresets && hasMobilePresets;
    console.log(`- Step 1: Call get-execution-viewports ${hasViewports ? '✅' : '❌'}`);
    console.log(`- Step 2: Verify desktop presets ${hasDesktopPresets ? '✅' : '❌'}`);
    console.log(`- Step 3: Verify tablet presets ${hasTabletPresets ? '✅' : '❌'}`);
    console.log(`- Step 4: Verify mobile presets ${hasMobilePresets ? '✅' : '❌'}`);
    console.log(`\nAll tests passed: ${allPassed ? '✅' : '❌'}`);

  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testGetExecutionViewports();
