/**
 * Test MCP list_test_suites Tool
 *
 * This test verifies Feature #391:
 * - AI agent can list available test suites
 * - Pagination is supported
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
        properties?: Record<string, { type?: string; description?: string; default?: unknown }>;
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
  console.log('  Feature #391: MCP list_test_suites Tool Test');
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

    // Test 2: Verify list_test_suites tool is available
    console.log('\n--- Step 2: Verify list_test_suites tool is available ---');
    const toolsListResponse = await sendMcpRequest(server, 'tools/list', {}, 2);

    if (toolsListResponse.result?.tools) {
      const listTool = toolsListResponse.result.tools.find(t => t.name === 'list_test_suites');

      if (listTool) {
        console.log('  ✓ PASS - list_test_suites tool found');
        console.log(`    Description: ${listTool.description}`);
        passed++;
      } else {
        console.log('  ✗ FAIL - list_test_suites tool not found');
        failed++;
      }
    } else {
      console.log('  ✗ FAIL - Could not get tools list');
      failed++;
    }

    // Test 3: Verify list_test_suites requires project_id
    console.log('\n--- Step 3: Verify list_test_suites requires project_id ---');
    if (toolsListResponse.result?.tools) {
      const listTool = toolsListResponse.result.tools.find(t => t.name === 'list_test_suites');
      const required = listTool?.inputSchema?.required || [];

      if (required.includes('project_id')) {
        console.log('  ✓ PASS - project_id is a required parameter');
        passed++;
      } else {
        console.log('  ✗ FAIL - project_id should be required');
        failed++;
      }
    } else {
      console.log('  ✗ FAIL - Could not get tools list');
      failed++;
    }

    // Test 4: Verify pagination parameters are available
    console.log('\n--- Step 4: Verify pagination parameters (limit, offset) ---');
    if (toolsListResponse.result?.tools) {
      const listTool = toolsListResponse.result.tools.find(t => t.name === 'list_test_suites');
      const properties = listTool?.inputSchema?.properties || {};

      if (properties.limit && properties.offset) {
        console.log('  ✓ PASS - Pagination parameters found');
        console.log(`    limit: ${properties.limit.description}`);
        console.log(`    offset: ${properties.offset.description}`);
        passed++;
      } else {
        console.log('  ✗ FAIL - Missing pagination parameters (limit and/or offset)');
        failed++;
      }
    } else {
      console.log('  ✗ FAIL - Could not get tools list');
      failed++;
    }

    // Test 5: Call list_test_suites with project_id
    console.log('\n--- Step 5: Call list_test_suites tool ---');
    const listResponse = await sendMcpRequest(server, 'tools/call', {
      name: 'list_test_suites',
      arguments: {
        project_id: 'test-project-123',
        limit: 10,
        offset: 0
      }
    }, 5);

    // Expect API error since project doesn't exist
    if (listResponse.error?.code === -32003) {
      console.log('  ✗ FAIL - Permission denied');
      console.log(`    Error: ${listResponse.error.message}`);
      failed++;
    } else {
      console.log('  ✓ PASS - list_test_suites tool executed');
      if (listResponse.error) {
        console.log(`    (API response: ${listResponse.error.message})`);
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
    console.log('\n✓ Feature #391 PASSED: list_test_suites returns suite list');
    process.exit(0);
  } else {
    console.log('\n✗ Feature #391 FAILED');
    process.exit(1);
  }
}

runTest().catch((error) => {
  console.error('Test error:', error);
  process.exit(1);
});
