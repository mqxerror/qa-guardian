/**
 * Test script for Feature #858: MCP API versioning
 *
 * This script tests the API versioning functionality for MCP operations.
 * Run with: npx tsx src/mcp/test-api-versioning.ts
 */

import * as readline from 'readline';
import { spawn } from 'child_process';
import * as path from 'path';

async function testApiVersioning(): Promise<void> {
  console.log('=== Feature #858: MCP API Versioning Test ===\n');

  // Start the MCP server
  const serverPath = path.join(__dirname, 'server.ts');
  const server = spawn('npx', ['tsx', serverPath], {
    cwd: path.join(__dirname, '..', '..'),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const rl = readline.createInterface({
    input: server.stdout,
    crlfDelay: Infinity,
  });

  // Collect responses
  const responses: Map<string | number, unknown> = new Map();

  rl.on('line', (line) => {
    try {
      const parsed = JSON.parse(line);
      if (parsed.id !== undefined) {
        responses.set(parsed.id, parsed);
        if (parsed.result?.serverInfo) {
          console.log('✓ Server initialized');
        }
      }
    } catch {
      // Ignore non-JSON output
    }
  });

  // Log server stderr for versioning messages
  server.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('[VERSION]')) {
      console.log(`[SERVER] ${msg}`);
    }
  });

  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 1: Initialize the MCP connection
  console.log('\n--- Step 1: Initialize connection ---');
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'versioning-test', version: '1.0.0' },
    },
  };
  server.stdin.write(JSON.stringify(initRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 500));

  // Check initialize response for version info
  const initResponse = responses.get(1) as { result?: { apiVersioning?: { currentVersion?: string; supportedVersions?: string[] } } };
  if (initResponse?.result?.apiVersioning) {
    console.log('✓ API versioning info in initialize response');
    console.log(`  Current version: ${initResponse.result.apiVersioning.currentVersion}`);
    console.log(`  Supported versions: ${initResponse.result.apiVersioning.supportedVersions?.join(', ')}`);
  } else {
    console.log('❌ Missing apiVersioning in initialize response');
  }

  // Step 2: Make v1 request (deprecated)
  console.log('\n--- Step 2: Make v1 request (deprecated) ---');
  const v1Request = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'list_projects',
      arguments: {
        limit: 5,
        _apiVersion: 'v1', // Explicitly request v1
      },
    },
  };
  server.stdin.write(JSON.stringify(v1Request) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Verify v1 response has deprecation warning
  const v1Response = responses.get(2) as { result?: { _apiVersion?: { status?: string; deprecationWarning?: string; recommendedVersion?: string } } };
  if (v1Response) {
    console.log('✓ v1 request completed');
    const apiVersion = v1Response.result?._apiVersion;
    if (apiVersion?.status === 'deprecated') {
      console.log('✓ v1 response has deprecation status');
      console.log(`  Status: ${apiVersion.status}`);
      console.log(`  Warning: ${apiVersion.deprecationWarning}`);
      console.log(`  Recommended: ${apiVersion.recommendedVersion}`);
    } else {
      console.log('❌ v1 response should have deprecation status');
    }
  } else {
    console.log('❌ v1 request failed');
  }

  // Step 3: Make v2 request (current)
  console.log('\n--- Step 3: Make v2 request (current) ---');
  const v2Request = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'list_projects',
      arguments: {
        limit: 5,
        _apiVersion: 'v2', // Explicitly request v2
      },
    },
  };
  server.stdin.write(JSON.stringify(v2Request) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Verify v2 response (no deprecation warning)
  const v2Response = responses.get(3) as { result?: { _apiVersion?: { status?: string; deprecationWarning?: string } } };
  if (v2Response) {
    console.log('✓ v2 request completed');
    const apiVersion = v2Response.result?._apiVersion;
    if (!apiVersion) {
      console.log('✓ v2 response has no deprecation warning (as expected)');
    } else if (apiVersion.status === 'current') {
      console.log('✓ v2 response shows current status');
    } else {
      console.log('❌ v2 response should not have deprecation warning');
    }
  } else {
    console.log('❌ v2 request failed');
  }

  // Step 4: Verify both versions work
  console.log('\n--- Step 4: Verify both versions work ---');
  const bothWork = v1Response !== undefined && v2Response !== undefined;
  console.log(bothWork ? '✓ Both v1 and v2 requests succeeded' : '❌ Some version requests failed');

  // Test: Request without version (should use default v2)
  console.log('\n--- Test: Request without version (default v2) ---');
  const defaultRequest = {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'list_projects',
      arguments: {
        limit: 3,
        // No _apiVersion specified
      },
    },
  };
  server.stdin.write(JSON.stringify(defaultRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const defaultResponse = responses.get(4) as { result?: { _apiVersion?: unknown } };
  if (defaultResponse) {
    console.log('✓ Default version request completed');
    if (!defaultResponse.result?._apiVersion) {
      console.log('✓ No deprecation warning for default (v2)');
    }
  }

  // Test: Alternative version format "1" instead of "v1"
  console.log('\n--- Test: Alternative version format ("1" instead of "v1") ---');
  const altFormatRequest = {
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'list_projects',
      arguments: {
        limit: 2,
        _apiVersion: '1', // Alternative format
      },
    },
  };
  server.stdin.write(JSON.stringify(altFormatRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const altResponse = responses.get(5) as { result?: { _apiVersion?: { version?: string } } };
  if (altResponse?.result?._apiVersion?.version === 'v1') {
    console.log('✓ Alternative format "1" correctly parsed as v1');
  } else if (altResponse) {
    console.log('⚠ Alternative format test completed (check version parsing)');
  }

  // Summary
  console.log('\n=== Test Summary ===');
  const tests = [
    { name: 'Initialize includes version info', pass: !!initResponse?.result?.apiVersioning },
    { name: 'v1 request with deprecation warning', pass: v1Response?.result?._apiVersion?.status === 'deprecated' },
    { name: 'v2 request works (current)', pass: !!v2Response && !v2Response.result?._apiVersion?.deprecationWarning },
    { name: 'Both versions work simultaneously', pass: bothWork },
    { name: 'Default version (no warning)', pass: !!defaultResponse && !defaultResponse.result?._apiVersion },
  ];

  let passed = 0;
  for (const test of tests) {
    if (test.pass) {
      console.log(`✓ ${test.name}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
    }
  }

  console.log(`\nTotal: ${passed}/${tests.length} tests passed`);

  // Clean up
  server.kill();
  console.log('\n=== Test Complete ===');
  process.exit(passed === tests.length ? 0 : 1);
}

// Run the test
testApiVersioning().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
