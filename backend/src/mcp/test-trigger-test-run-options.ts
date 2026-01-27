/**
 * Test MCP trigger_test_run Tool Options
 *
 * This test verifies Feature #387:
 * - trigger_test_run accepts environment, branch, and other options
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
        properties?: Record<string, { type: string; description?: string; enum?: string[] }>;
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
  console.log('  Feature #387: MCP trigger_test_run Options Test');
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

    // Test 2: Verify trigger_test_run has branch option
    console.log('\n--- Step 2: Verify trigger_test_run has branch option ---');
    const toolsListResponse = await sendMcpRequest(server, 'tools/list', {}, 2);

    if (toolsListResponse.result?.tools) {
      const triggerTool = toolsListResponse.result.tools.find(t => t.name === 'trigger_test_run');
      const properties = triggerTool?.inputSchema?.properties;

      if (properties?.branch) {
        console.log('  ✓ PASS - branch option found');
        console.log(`    Description: ${properties.branch.description}`);
        passed++;
      } else {
        console.log('  ✗ FAIL - branch option not found');
        failed++;
      }
    } else {
      console.log('  ✗ FAIL - Could not get tools list');
      failed++;
    }

    // Test 3: Verify trigger_test_run has env option
    console.log('\n--- Step 3: Verify trigger_test_run has env option ---');
    if (toolsListResponse.result?.tools) {
      const triggerTool = toolsListResponse.result.tools.find(t => t.name === 'trigger_test_run');
      const properties = triggerTool?.inputSchema?.properties;

      if (properties?.env) {
        console.log('  ✓ PASS - env option found');
        console.log(`    Description: ${properties.env.description}`);
        console.log(`    Allowed values: ${properties.env.enum?.join(', ')}`);
        passed++;
      } else {
        console.log('  ✗ FAIL - env option not found');
        failed++;
      }
    } else {
      console.log('  ✗ FAIL - Could not get tools list');
      failed++;
    }

    // Test 4: Call trigger_test_run with branch and env options
    console.log('\n--- Step 4: Call trigger_test_run with options ---');
    const triggerResponse = await sendMcpRequest(server, 'tools/call', {
      name: 'trigger_test_run',
      arguments: {
        suite_id: 'test-suite-456',
        branch: 'main',
        env: 'staging',
        browser: 'chromium',
        retries: 2,
        timeout: 60000
      }
    }, 4);

    // Since the test suite doesn't exist, we expect an API error
    // But the tool should accept the options
    if (triggerResponse.error?.code === -32003) {
      console.log('  ✗ FAIL - Permission denied');
      console.log(`    Error: ${triggerResponse.error.message}`);
      failed++;
    } else if (triggerResponse.error?.code === -32602) {
      console.log('  ✗ FAIL - Invalid parameters');
      console.log(`    Error: ${triggerResponse.error.message}`);
      failed++;
    } else {
      console.log('  ✓ PASS - trigger_test_run accepted options (branch, env, retries, timeout)');
      if (triggerResponse.error) {
        console.log(`    (API response: ${triggerResponse.error.message})`);
      }
      passed++;
    }

    // Test 5: Verify all expected options exist
    console.log('\n--- Step 5: Verify all expected options exist ---');
    if (toolsListResponse.result?.tools) {
      const triggerTool = toolsListResponse.result.tools.find(t => t.name === 'trigger_test_run');
      const properties = triggerTool?.inputSchema?.properties || {};

      const expectedOptions = ['suite_id', 'browser', 'branch', 'env', 'base_url', 'environment', 'parallel', 'retries', 'timeout'];
      const missingOptions = expectedOptions.filter(opt => !properties[opt]);

      if (missingOptions.length === 0) {
        console.log('  ✓ PASS - All expected options are present');
        console.log(`    Options: ${expectedOptions.join(', ')}`);
        passed++;
      } else {
        console.log(`  ✗ FAIL - Missing options: ${missingOptions.join(', ')}`);
        failed++;
      }
    } else {
      console.log('  ✗ FAIL - Could not get tools list');
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

  if (passed >= 5 && failed === 0) {
    console.log('\n✓ Feature #387 PASSED: trigger_test_run accepts options');
    process.exit(0);
  } else {
    console.log('\n✗ Feature #387 FAILED');
    process.exit(1);
  }
}

runTest().catch((error) => {
  console.error('Test error:', error);
  process.exit(1);
});
