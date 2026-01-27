/**
 * Test MCP mcp:read scope permissions
 *
 * This test verifies Feature #382:
 * - mcp:read scope allows read-only tools (get_test_results, list_test_suites)
 * - mcp:read scope denies execute tools (run_test)
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

const MCP_READ_API_KEY = process.argv[2] || 'qg_HEgjj-3-rLVf4hbAErBGAo05BApLaX_6JvXGjZcoCgA';
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
  console.log('  Feature #382: MCP mcp:read Scope Permissions Test');
  console.log('='.repeat(60));
  console.log('');
  console.log(`API Key: ${MCP_READ_API_KEY.substring(0, 15)}...`);
  console.log('');

  let passed = 0;
  let failed = 0;

  // Start MCP server with the mcp:read API key
  console.log('Starting MCP server with --require-auth...');
  const server = spawn('npx', [
    'tsx', serverPath,
    '--require-auth',
    '--api-key', MCP_READ_API_KEY,
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

    // Test 1: Call get_test_results (read-only tool) - should succeed
    console.log('\n--- Step 2: Call get_test_results (read-only) ---');
    const getResultsResponse = await sendMcpRequest(server, 'tools/call', {
      name: 'get_test_results',
      arguments: { run_id: 'test-run-123' }
    }, 2);

    if (getResultsResponse.error?.code === -32003) {
      console.log('  ✗ FAIL - Read-only tool should be allowed with mcp:read');
      console.log(`    Error: ${getResultsResponse.error.message}`);
      failed++;
    } else if (getResultsResponse.error) {
      // API error is OK (run doesn't exist), permission was granted
      console.log('  ✓ PASS - Tool call was allowed (API returned expected error)');
      console.log(`    (API error: ${getResultsResponse.error.message})`);
      passed++;
    } else {
      console.log('  ✓ PASS - get_test_results succeeded');
      passed++;
    }

    // Test 2: Call list_test_suites (read-only tool) - should succeed
    console.log('\n--- Step 3: Call list_test_suites (read-only) ---');
    const listSuitesResponse = await sendMcpRequest(server, 'tools/call', {
      name: 'list_test_suites',
      arguments: { project_id: 'test-project-123' }
    }, 3);

    if (listSuitesResponse.error?.code === -32003) {
      console.log('  ✗ FAIL - Read-only tool should be allowed with mcp:read');
      console.log(`    Error: ${listSuitesResponse.error.message}`);
      failed++;
    } else if (listSuitesResponse.error) {
      // API error is OK (project doesn't exist), permission was granted
      console.log('  ✓ PASS - Tool call was allowed (API returned expected error)');
      console.log(`    (API error: ${listSuitesResponse.error.message})`);
      passed++;
    } else {
      console.log('  ✓ PASS - list_test_suites succeeded');
      passed++;
    }

    // Test 3: Call run_test (execute tool) - should be DENIED
    console.log('\n--- Step 4: Call run_test (execute) - should be denied ---');
    const runTestResponse = await sendMcpRequest(server, 'tools/call', {
      name: 'run_test',
      arguments: { test_id: 'test-123', browser: 'chromium' }
    }, 4);

    if (runTestResponse.error?.code === -32003) {
      console.log('  ✓ PASS - Execute tool correctly denied');
      console.log(`    Error: ${runTestResponse.error.message}`);
      passed++;
    } else {
      console.log('  ✗ FAIL - Execute tool should have been denied');
      console.log(`    Response: ${JSON.stringify(runTestResponse)}`);
      failed++;
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
    console.log('\n✓ Feature #382 PASSED: mcp:read scope allows read-only tools');
    process.exit(0);
  } else {
    console.log('\n✗ Feature #382 FAILED');
    process.exit(1);
  }
}

runTest().catch((error) => {
  console.error('Test error:', error);
  process.exit(1);
});
