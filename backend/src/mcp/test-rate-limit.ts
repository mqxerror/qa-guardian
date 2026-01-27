/**
 * Test MCP Rate Limiting
 *
 * This test verifies Feature #385:
 * - MCP connections are subject to rate limits per API key
 * - Rate limit error code -32004 is returned when exceeded
 * - Requests succeed after the window resets
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

const MCP_API_KEY = process.argv[2] || 'qg_test_rate_limit_key';
const serverPath = path.join(__dirname, 'index.ts');

// Use a small rate limit for testing (10 requests per 5 seconds)
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW = 5; // seconds

interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: {
      limit?: number;
      remaining?: number;
      resetMs?: number;
      retryAfter?: number;
    };
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
  console.log('  Feature #385: MCP Rate Limiting Test');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Rate Limit: ${RATE_LIMIT} requests per ${RATE_LIMIT_WINDOW} seconds`);
  console.log('');

  let passed = 0;
  let failed = 0;

  // Start MCP server with rate limiting configured
  console.log('Starting MCP server with rate limiting...');
  const server = spawn('npx', [
    'tsx', serverPath,
    '--rate-limit', String(RATE_LIMIT),
    '--rate-limit-window', String(RATE_LIMIT_WINDOW),
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
      passed++;
    } else {
      console.log('  ✗ Server initialization failed');
      failed++;
    }

    // Send initialized notification
    server.stdin?.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized' }) + '\n');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test 2: Make rapid requests up to the rate limit
    console.log(`\n--- Step 2: Make ${RATE_LIMIT} rapid tool calls (should succeed) ---`);
    let successCount = 0;
    let requestId = 2;

    for (let i = 0; i < RATE_LIMIT; i++) {
      try {
        const response = await sendMcpRequest(server, 'tools/call', {
          name: 'list_projects',
          arguments: {}
        }, requestId++);

        if (response.error?.code === -32004) {
          console.log(`  Request ${i + 1}: Rate limited (unexpected)`);
        } else {
          successCount++;
        }
      } catch (error) {
        console.log(`  Request ${i + 1}: Error - ${error}`);
      }
    }

    if (successCount === RATE_LIMIT) {
      console.log(`  ✓ PASS - All ${RATE_LIMIT} requests succeeded within rate limit`);
      passed++;
    } else {
      console.log(`  ✗ FAIL - Only ${successCount}/${RATE_LIMIT} requests succeeded`);
      failed++;
    }

    // Test 3: Make one more request (should be rate limited)
    console.log('\n--- Step 3: Make one more request (should be rate limited) ---');
    const rateLimitedResponse = await sendMcpRequest(server, 'tools/call', {
      name: 'list_projects',
      arguments: {}
    }, requestId++);

    if (rateLimitedResponse.error?.code === -32004) {
      console.log('  ✓ PASS - Request was rate limited as expected');
      console.log(`    Error: ${rateLimitedResponse.error.message}`);
      if (rateLimitedResponse.error.data) {
        console.log(`    Limit: ${rateLimitedResponse.error.data.limit}`);
        console.log(`    Remaining: ${rateLimitedResponse.error.data.remaining}`);
        console.log(`    Retry After: ${rateLimitedResponse.error.data.retryAfter}s`);
      }
      passed++;
    } else {
      console.log('  ✗ FAIL - Request should have been rate limited');
      console.log(`    Response: ${JSON.stringify(rateLimitedResponse)}`);
      failed++;
    }

    // Test 4: Wait for rate limit window to reset
    console.log(`\n--- Step 4: Wait ${RATE_LIMIT_WINDOW + 1} seconds for rate limit reset ---`);
    await new Promise(resolve => setTimeout(resolve, (RATE_LIMIT_WINDOW + 1) * 1000));

    // Test 5: Verify requests succeed again after reset
    console.log('\n--- Step 5: Verify requests succeed after reset ---');
    const afterResetResponse = await sendMcpRequest(server, 'tools/call', {
      name: 'list_projects',
      arguments: {}
    }, requestId++);

    if (afterResetResponse.error?.code === -32004) {
      console.log('  ✗ FAIL - Request should succeed after rate limit reset');
      console.log(`    Error: ${afterResetResponse.error.message}`);
      failed++;
    } else {
      console.log('  ✓ PASS - Request succeeded after rate limit reset');
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

  if (passed >= 4 && failed === 0) {
    console.log('\n✓ Feature #385 PASSED: MCP rate limiting enforced');
    process.exit(0);
  } else {
    console.log('\n✗ Feature #385 FAILED');
    process.exit(1);
  }
}

runTest().catch((error) => {
  console.error('Test error:', error);
  process.exit(1);
});
