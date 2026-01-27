/**
 * Test MCP mcp:execute scope permissions
 *
 * This test verifies Feature #383:
 * - mcp:execute scope allows test execution tools (run_test, cancel_test)
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

const MCP_EXECUTE_API_KEY = process.argv[2] || 'qg_pGpPuulQ79BtRD0gb99-BBiO-DwcvoDfb4P-xEo33rs';
const serverPath = path.join(__dirname, 'index.ts');

interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

async function sendMcpRequest(
  server: ChildProcess,
  method: string,
  params: Record<string, unknown>,
  id: number
): Promise<MCPResponse> {
  const request = {
    jsonrpc: '2.0',
    id,
    method,
    params,
  };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, 5000);

    const handleData = (data: Buffer) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const response = JSON.parse(line) as MCPResponse;
          if (response.id === id) {
            clearTimeout(timeout);
            server.stdout?.off('data', handleData);
            resolve(response);
            return;
          }
        } catch {
          // Not JSON, continue
        }
      }
    };

    server.stdout?.on('data', handleData);
    server.stdin?.write(JSON.stringify(request) + '\n');
  });
}

async function runTest() {
  console.log('='.repeat(60));
  console.log('  Feature #383: MCP mcp:execute Scope Permissions Test');
  console.log('='.repeat(60));
  console.log('');
  console.log(`API Key: ${MCP_EXECUTE_API_KEY.substring(0, 15)}...`);
  console.log('');

  let passed = 0;
  let failed = 0;

  // Start MCP server with the mcp:execute API key
  console.log('Starting MCP server with --require-auth...');
  const server = spawn('npx', [
    'tsx', serverPath,
    '--require-auth',
    '--api-key', MCP_EXECUTE_API_KEY,
    '--api-url', 'http://localhost:3001'
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: path.join(__dirname, '../..'),
  });

  // Log stderr for debugging
  server.stderr?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) {
      console.log(`  [MCP Server] ${msg}`);
    }
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // Initialize the server
    console.log('\n--- Step 1: Initialize MCP server ---');
    const initResponse = await sendMcpRequest(server, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' }
    }, 1);

    if (initResponse.result) {
      console.log('  ✓ Server initialized');
    } else {
      console.log('  ✗ Server initialization failed');
      failed++;
    }

    // Send initialized notification
    server.stdin?.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized' }) + '\n');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test 1: Call run_test (execute tool) - should succeed with mcp:execute
    console.log('\n--- Step 2: Call run_test (execute) ---');
    const runTestResponse = await sendMcpRequest(server, 'tools/call', {
      name: 'run_test',
      arguments: { test_id: 'test-123', browser: 'chromium' }
    }, 2);

    if (runTestResponse.error?.code === -32003) {
      console.log('  ✗ FAIL - Execute tool should be allowed with mcp:execute');
      console.log(`    Error: ${runTestResponse.error.message}`);
      failed++;
    } else if (runTestResponse.error) {
      // API error is OK (test doesn't exist), permission was granted
      console.log('  ✓ PASS - Tool call was allowed (API returned expected error)');
      console.log(`    (API error: ${runTestResponse.error.message})`);
      passed++;
    } else {
      console.log('  ✓ PASS - run_test succeeded');
      passed++;
    }

    // Test 2: Call cancel_test (execute tool) - should succeed with mcp:execute
    console.log('\n--- Step 3: Call cancel_test (execute) ---');
    const cancelTestResponse = await sendMcpRequest(server, 'tools/call', {
      name: 'cancel_test',
      arguments: { run_id: 'test-run-123' }
    }, 3);

    if (cancelTestResponse.error?.code === -32003) {
      console.log('  ✗ FAIL - Execute tool should be allowed with mcp:execute');
      console.log(`    Error: ${cancelTestResponse.error.message}`);
      failed++;
    } else if (cancelTestResponse.error) {
      // API error is OK (run doesn't exist), permission was granted
      console.log('  ✓ PASS - Tool call was allowed (API returned expected error)');
      console.log(`    (API error: ${cancelTestResponse.error.message})`);
      passed++;
    } else {
      console.log('  ✓ PASS - cancel_test succeeded');
      passed++;
    }

    // Test 3: Verify read-only tools are also allowed (mcp:execute includes read)
    console.log('\n--- Step 4: Verify read tools are allowed ---');
    const listProjectsResponse = await sendMcpRequest(server, 'tools/call', {
      name: 'list_projects',
      arguments: {}
    }, 4);

    if (listProjectsResponse.error?.code === -32003) {
      console.log('  ✗ FAIL - Read tools should be allowed with mcp:execute');
      console.log(`    Error: ${listProjectsResponse.error.message}`);
      failed++;
    } else {
      console.log('  ✓ PASS - Read tools are allowed with mcp:execute');
      passed++;
    }

  } catch (error) {
    console.log(`\n  ERROR: ${error}`);
    failed++;
  } finally {
    // Kill the server
    server.kill('SIGTERM');
  }

  console.log('\n' + '='.repeat(60));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  if (passed >= 3 && failed === 0) {
    console.log('\n✓ Feature #383 PASSED: mcp:execute scope allows test execution');
    process.exit(0);
  } else {
    console.log('\n✗ Feature #383 FAILED');
    process.exit(1);
  }
}

runTest().catch((error) => {
  console.error('Test error:', error);
  process.exit(1);
});
