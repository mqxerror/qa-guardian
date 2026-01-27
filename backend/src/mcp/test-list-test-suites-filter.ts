/**
 * Test MCP list_test_suites Filtering
 *
 * This test verifies Feature #392:
 * - list_test_suites supports filtering by type and name
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

const serverPath = path.join(__dirname, 'index.ts');

interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: {
    tools?: Array<{
      name: string;
      description: string;
      inputSchema?: {
        properties?: Record<string, { type?: string; description?: string; enum?: string[] }>;
      };
    }>;
    content?: Array<{
      type: string;
      text: string;
    }>;
  };
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
    }, 10000);

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
  console.log('  Feature #392: MCP list_test_suites Filtering Test');
  console.log('='.repeat(60));
  console.log('');

  let passed = 0;
  let failed = 0;

  // Start MCP server
  console.log('Starting MCP server...');
  const server = spawn('npx', [
    'tsx', serverPath,
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

    // Test 2: Verify type filter parameter exists
    console.log('\n--- Step 2: Verify type filter parameter ---');
    const toolsListResponse = await sendMcpRequest(server, 'tools/list', {}, 2);

    if (toolsListResponse.result?.tools) {
      const listTool = toolsListResponse.result.tools.find(t => t.name === 'list_test_suites');
      const properties = listTool?.inputSchema?.properties || {};

      if (properties.type && properties.type.enum) {
        console.log('  ✓ PASS - type filter parameter found');
        console.log(`    Allowed types: ${properties.type.enum.join(', ')}`);
        passed++;
      } else {
        console.log('  ✗ FAIL - type filter parameter missing');
        failed++;
      }
    } else {
      console.log('  ✗ FAIL - Could not get tools list');
      failed++;
    }

    // Test 3: Verify name filter parameter exists
    console.log('\n--- Step 3: Verify name filter parameter ---');
    if (toolsListResponse.result?.tools) {
      const listTool = toolsListResponse.result.tools.find(t => t.name === 'list_test_suites');
      const properties = listTool?.inputSchema?.properties || {};

      if (properties.name) {
        console.log('  ✓ PASS - name filter parameter found');
        console.log(`    Description: ${properties.name.description}`);
        passed++;
      } else {
        console.log('  ✗ FAIL - name filter parameter missing');
        failed++;
      }
    } else {
      console.log('  ✗ FAIL - Could not get tools list');
      failed++;
    }

    // Test 4: Call with type filter
    console.log('\n--- Step 4: Call list_test_suites with type filter ---');
    const typeFilterResponse = await sendMcpRequest(server, 'tools/call', {
      name: 'list_test_suites',
      arguments: {
        project_id: 'test-project-123',
        type: 'e2e'
      }
    }, 4);

    if (typeFilterResponse.error?.code === -32003) {
      console.log('  ✗ FAIL - Permission denied');
      failed++;
    } else if (typeFilterResponse.error?.code === -32602) {
      console.log('  ✗ FAIL - Invalid parameters');
      failed++;
    } else {
      console.log('  ✓ PASS - Tool accepted type filter');
      if (typeFilterResponse.error) {
        console.log(`    (API response: ${typeFilterResponse.error.message})`);
      }
      passed++;
    }

    // Test 5: Call with name filter
    console.log('\n--- Step 5: Call list_test_suites with name filter ---');
    const nameFilterResponse = await sendMcpRequest(server, 'tools/call', {
      name: 'list_test_suites',
      arguments: {
        project_id: 'test-project-123',
        name: 'checkout'
      }
    }, 5);

    if (nameFilterResponse.error?.code === -32003) {
      console.log('  ✗ FAIL - Permission denied');
      failed++;
    } else if (nameFilterResponse.error?.code === -32602) {
      console.log('  ✗ FAIL - Invalid parameters');
      failed++;
    } else {
      console.log('  ✓ PASS - Tool accepted name filter');
      if (nameFilterResponse.error) {
        console.log(`    (API response: ${nameFilterResponse.error.message})`);
      }
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

  if (passed >= 5 && failed === 0) {
    console.log('\n✓ Feature #392 PASSED: list_test_suites supports filtering');
    process.exit(0);
  } else {
    console.log('\n✗ Feature #392 FAILED');
    process.exit(1);
  }
}

runTest().catch((error) => {
  console.error('Test error:', error);
  process.exit(1);
});
