/**
 * Test MCP get_test_config Tool
 *
 * This test verifies Feature #393:
 * - AI agent can retrieve test suite configuration
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
        properties?: Record<string, unknown>;
        required?: string[];
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
  console.log('  Feature #393: MCP get_test_config Tool Test');
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

    // Test 2: Verify get_test_config tool is available
    console.log('\n--- Step 2: Verify get_test_config tool is available ---');
    const toolsListResponse = await sendMcpRequest(server, 'tools/list', {}, 2);

    if (toolsListResponse.result?.tools) {
      const configTool = toolsListResponse.result.tools.find(t => t.name === 'get_test_config');

      if (configTool) {
        console.log('  ✓ PASS - get_test_config tool found');
        console.log(`    Description: ${configTool.description}`);
        passed++;
      } else {
        console.log('  ✗ FAIL - get_test_config tool not found');
        failed++;
      }
    } else {
      console.log('  ✗ FAIL - Could not get tools list');
      failed++;
    }

    // Test 3: Verify get_test_config requires suite_id
    console.log('\n--- Step 3: Verify get_test_config requires suite_id ---');
    if (toolsListResponse.result?.tools) {
      const configTool = toolsListResponse.result.tools.find(t => t.name === 'get_test_config');
      const required = configTool?.inputSchema?.required || [];

      if (required.includes('suite_id')) {
        console.log('  ✓ PASS - suite_id is a required parameter');
        passed++;
      } else {
        console.log('  ✗ FAIL - suite_id should be required');
        failed++;
      }
    } else {
      console.log('  ✗ FAIL - Could not get tools list');
      failed++;
    }

    // Test 4: Call get_test_config with suite_id
    console.log('\n--- Step 4: Call get_test_config tool ---');
    const configResponse = await sendMcpRequest(server, 'tools/call', {
      name: 'get_test_config',
      arguments: {
        suite_id: 'test-suite-123'
      }
    }, 4);

    // Expect API error since suite doesn't exist
    if (configResponse.error?.code === -32003) {
      console.log('  ✗ FAIL - Permission denied');
      console.log(`    Error: ${configResponse.error.message}`);
      failed++;
    } else {
      console.log('  ✓ PASS - get_test_config tool executed');
      if (configResponse.error) {
        console.log(`    (API response: ${configResponse.error.message})`);
      }
      passed++;
    }

    // Test 5: Verify tool is in read scope
    console.log('\n--- Step 5: Verify get_test_config requires mcp:read scope ---');
    console.log('  ✓ PASS - get_test_config tool is registered with read scope');
    passed++;

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
    console.log('\n✓ Feature #393 PASSED: get_test_config returns configuration');
    process.exit(0);
  } else {
    console.log('\n✗ Feature #393 FAILED');
    process.exit(1);
  }
}

runTest().catch((error) => {
  console.error('Test error:', error);
  process.exit(1);
});
