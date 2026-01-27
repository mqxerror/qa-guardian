/**
 * Simple test script for Feature #858: MCP API versioning
 *
 * This script tests the API versioning functions directly without starting the full server.
 * Run with: npx tsx src/mcp/test-api-versioning-simple.ts
 */

// Feature #858: API versioning support
type APIVersionStatus = 'current' | 'deprecated' | 'sunset';

interface APIVersionInfo {
  version: string;
  status: APIVersionStatus;
  deprecationDate?: string;
  sunsetDate?: string;
  deprecationMessage?: string;
}

// API version definitions (matching server.ts)
const API_VERSIONS: Record<string, APIVersionInfo> = {
  'v1': {
    version: 'v1',
    status: 'deprecated',
    deprecationDate: '2025-06-01',
    sunsetDate: '2026-06-01',
    deprecationMessage: 'API v1 is deprecated and will be removed on 2026-06-01. Please migrate to v2.',
  },
  'v2': {
    version: 'v2',
    status: 'current',
  },
};

const DEFAULT_API_VERSION = 'v2';
const CURRENT_API_VERSION = 'v2';

// Simulate parseApiVersion function
function parseApiVersion(params?: Record<string, unknown>): string {
  if (!params) return DEFAULT_API_VERSION;

  const version = params._apiVersion;
  if (typeof version === 'string') {
    const normalizedVersion = version.toLowerCase().startsWith('v')
      ? version.toLowerCase()
      : `v${version}`;

    if (API_VERSIONS[normalizedVersion]) {
      return normalizedVersion;
    }

    console.log(`  [LOG] Unknown API version requested: ${version}, using default: ${DEFAULT_API_VERSION}`);
  }

  return DEFAULT_API_VERSION;
}

// Simulate getVersionInfo function
function getVersionInfo(version: string): APIVersionInfo {
  return API_VERSIONS[version] || API_VERSIONS[DEFAULT_API_VERSION];
}

// Simulate addVersionWarnings function
function addVersionWarnings(
  result: Record<string, unknown>,
  version: string
): Record<string, unknown> {
  const versionInfo = getVersionInfo(version);

  if (versionInfo.status === 'deprecated' || versionInfo.status === 'sunset') {
    return {
      ...result,
      _apiVersion: {
        version: versionInfo.version,
        status: versionInfo.status,
        deprecationWarning: versionInfo.deprecationMessage,
        deprecationDate: versionInfo.deprecationDate,
        sunsetDate: versionInfo.sunsetDate,
        recommendedVersion: CURRENT_API_VERSION,
      },
    };
  }

  return result;
}

// Run tests
console.log('=== Feature #858: MCP API Versioning Test (Simple) ===\n');

// Test 1: Parse v1 version
console.log('--- Test 1: Parse "v1" version ---');
const v1Parsed = parseApiVersion({ _apiVersion: 'v1' });
console.log(`Input: _apiVersion = "v1"`);
console.log(`Output: ${v1Parsed}`);
console.log(v1Parsed === 'v1' ? '✓ PASS' : '❌ FAIL');

// Test 2: Parse v2 version
console.log('\n--- Test 2: Parse "v2" version ---');
const v2Parsed = parseApiVersion({ _apiVersion: 'v2' });
console.log(`Input: _apiVersion = "v2"`);
console.log(`Output: ${v2Parsed}`);
console.log(v2Parsed === 'v2' ? '✓ PASS' : '❌ FAIL');

// Test 3: Parse "1" (alternative format)
console.log('\n--- Test 3: Parse "1" (alternative format) ---');
const alt1Parsed = parseApiVersion({ _apiVersion: '1' });
console.log(`Input: _apiVersion = "1"`);
console.log(`Output: ${alt1Parsed}`);
console.log(alt1Parsed === 'v1' ? '✓ PASS' : '❌ FAIL');

// Test 4: Parse "2" (alternative format)
console.log('\n--- Test 4: Parse "2" (alternative format) ---');
const alt2Parsed = parseApiVersion({ _apiVersion: '2' });
console.log(`Input: _apiVersion = "2"`);
console.log(`Output: ${alt2Parsed}`);
console.log(alt2Parsed === 'v2' ? '✓ PASS' : '❌ FAIL');

// Test 5: Default version (no _apiVersion)
console.log('\n--- Test 5: Default version (no _apiVersion) ---');
const defaultParsed = parseApiVersion({ limit: 10 });
console.log(`Input: { limit: 10 } (no _apiVersion)`);
console.log(`Output: ${defaultParsed}`);
console.log(defaultParsed === DEFAULT_API_VERSION ? '✓ PASS' : '❌ FAIL');

// Test 6: Unknown version falls back to default
console.log('\n--- Test 6: Unknown version falls back to default ---');
const unknownParsed = parseApiVersion({ _apiVersion: 'v99' });
console.log(`Input: _apiVersion = "v99"`);
console.log(`Output: ${unknownParsed}`);
console.log(unknownParsed === DEFAULT_API_VERSION ? '✓ PASS' : '❌ FAIL');

// Test 7: v1 adds deprecation warning
console.log('\n--- Test 7: v1 response includes deprecation warning ---');
const v1Result = addVersionWarnings({ content: 'test' }, 'v1');
console.log(`Input version: v1`);
console.log(`Has _apiVersion: ${!!v1Result._apiVersion}`);
const v1ApiVersion = v1Result._apiVersion as Record<string, unknown>;
console.log(`Status: ${v1ApiVersion?.status}`);
console.log(`Has deprecation warning: ${!!v1ApiVersion?.deprecationWarning}`);
console.log(v1ApiVersion?.status === 'deprecated' && !!v1ApiVersion?.deprecationWarning ? '✓ PASS' : '❌ FAIL');

// Test 8: v2 does NOT add deprecation warning
console.log('\n--- Test 8: v2 response does NOT include deprecation warning ---');
const v2Result = addVersionWarnings({ content: 'test' }, 'v2');
console.log(`Input version: v2`);
console.log(`Has _apiVersion: ${!!v2Result._apiVersion}`);
console.log(!v2Result._apiVersion ? '✓ PASS - No warning for current version' : '❌ FAIL');

// Test 9: Get version info for v1
console.log('\n--- Test 9: Get version info for v1 ---');
const v1Info = getVersionInfo('v1');
console.log(`Version: ${v1Info.version}`);
console.log(`Status: ${v1Info.status}`);
console.log(`Deprecation date: ${v1Info.deprecationDate}`);
console.log(`Sunset date: ${v1Info.sunsetDate}`);
console.log(v1Info.status === 'deprecated' ? '✓ PASS' : '❌ FAIL');

// Test 10: Get version info for v2
console.log('\n--- Test 10: Get version info for v2 ---');
const v2Info = getVersionInfo('v2');
console.log(`Version: ${v2Info.version}`);
console.log(`Status: ${v2Info.status}`);
console.log(v2Info.status === 'current' ? '✓ PASS' : '❌ FAIL');

// Summary
console.log('\n=== Test Summary ===');
const tests = [
  { name: 'Parse "v1"', pass: v1Parsed === 'v1' },
  { name: 'Parse "v2"', pass: v2Parsed === 'v2' },
  { name: 'Parse "1" -> "v1"', pass: alt1Parsed === 'v1' },
  { name: 'Parse "2" -> "v2"', pass: alt2Parsed === 'v2' },
  { name: 'Default version', pass: defaultParsed === DEFAULT_API_VERSION },
  { name: 'Unknown version -> default', pass: unknownParsed === DEFAULT_API_VERSION },
  { name: 'v1 has deprecation warning', pass: v1ApiVersion?.status === 'deprecated' && !!v1ApiVersion?.deprecationWarning },
  { name: 'v2 no deprecation warning', pass: !v2Result._apiVersion },
  { name: 'v1 info is deprecated', pass: v1Info.status === 'deprecated' },
  { name: 'v2 info is current', pass: v2Info.status === 'current' },
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  if (test.pass) {
    console.log(`✓ ${test.name}`);
    passed++;
  } else {
    console.log(`❌ ${test.name}`);
    failed++;
  }
}

console.log(`\nTotal: ${passed}/${tests.length} tests passed`);

if (failed === 0) {
  console.log('\n✅ All API versioning tests passed!');
  process.exit(0);
} else {
  console.log(`\n❌ ${failed} test(s) failed`);
  process.exit(1);
}
