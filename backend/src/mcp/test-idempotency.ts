/**
 * Test script for Feature #857: MCP idempotency keys
 *
 * This script tests the idempotency key functionality for MCP operations.
 * Run with: npx tsx src/mcp/test-idempotency.ts
 */

import * as readline from 'readline';
import { spawn } from 'child_process';
import * as path from 'path';

async function testIdempotency(): Promise<void> {
  console.log('=== Feature #857: MCP Idempotency Keys Test ===\n');

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

  // Log server stderr for idempotency messages
  server.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('[IDEMPOTENCY]')) {
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
      clientInfo: { name: 'idempotency-test', version: '1.0.0' },
    },
  };
  server.stdin.write(JSON.stringify(initRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 500));

  // Step 2: Make request with idempotency key
  console.log('\n--- Step 2: Make request with idempotency key ---');
  const idempotencyKey = `test-key-${Date.now()}`;
  const request1 = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'list_projects',
      arguments: {
        limit: 10,
        _idempotencyKey: idempotencyKey,
      },
    },
  };
  console.log(`Idempotency key: ${idempotencyKey}`);
  server.stdin.write(JSON.stringify(request1) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Verify first response
  const response1 = responses.get(2) as { result?: { _idempotent?: unknown } };
  if (response1) {
    console.log('✓ First request completed');
    if (response1.result?._idempotent) {
      console.log('❌ First response should NOT have _idempotent indicator (it\'s the original)');
    } else {
      console.log('✓ First response is original (no _idempotent indicator)');
    }
  } else {
    console.log('❌ First request failed');
  }

  // Step 3: Retry same request with same key
  console.log('\n--- Step 3: Retry same request with same key ---');
  const request2 = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'list_projects',
      arguments: {
        limit: 10, // Same arguments
        _idempotencyKey: idempotencyKey, // Same key
      },
    },
  };
  server.stdin.write(JSON.stringify(request2) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 4: Verify operation not duplicated (cached response returned)
  console.log('\n--- Step 4: Verify cached response returned ---');
  const response2 = responses.get(3) as { result?: { _idempotent?: { cached?: boolean; key?: string } } };
  if (response2) {
    console.log('✓ Second request completed');
    const idempotent = response2.result?._idempotent;
    if (idempotent?.cached) {
      console.log('✓ Response was served from cache (_idempotent.cached = true)');
      console.log(`  Key: ${idempotent.key}`);
    } else {
      console.log('❌ Response should have _idempotent.cached = true');
    }
  } else {
    console.log('❌ Second request failed');
  }

  // Test: Same key with different request should NOT use cache
  console.log('\n--- Test: Same key with different arguments ---');
  const request3 = {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'list_projects',
      arguments: {
        limit: 5, // Different limit!
        _idempotencyKey: idempotencyKey, // Same key
      },
    },
  };
  server.stdin.write(JSON.stringify(request3) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const response3 = responses.get(4) as { result?: { _idempotent?: { cached?: boolean } } };
  if (response3) {
    const idempotent = response3.result?._idempotent;
    if (!idempotent?.cached) {
      console.log('✓ Different arguments result in fresh response (no cache hit)');
    } else {
      console.log('❌ Should NOT have used cache with different arguments');
    }
  }

  // Test: Different key should NOT use cache
  console.log('\n--- Test: Different key should not use cache ---');
  const newKey = `test-key-new-${Date.now()}`;
  const request4 = {
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'list_projects',
      arguments: {
        limit: 10,
        _idempotencyKey: newKey, // Different key
      },
    },
  };
  server.stdin.write(JSON.stringify(request4) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const response4 = responses.get(5) as { result?: { _idempotent?: { cached?: boolean } } };
  if (response4) {
    const idempotent = response4.result?._idempotent;
    if (!idempotent?.cached) {
      console.log('✓ New key results in fresh response (no cache hit)');
    } else {
      console.log('❌ New key should NOT have cache hit');
    }
  }

  // Summary
  console.log('\n=== Test Summary ===');
  const tests = [
    { name: 'First request (original)', pass: !!response1 && !response1.result?._idempotent },
    { name: 'Retry with same key (cached)', pass: !!response2?.result?._idempotent?.cached },
    { name: 'Same key, different args (fresh)', pass: !!response3 && !response3.result?._idempotent?.cached },
    { name: 'Different key (fresh)', pass: !!response4 && !response4.result?._idempotent?.cached },
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
testIdempotency().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
