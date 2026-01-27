/**
 * Test MCP Server handling of unknown tool invocations
 *
 * Feature #629: MCP handles unknown tool invocation
 *
 * Tests:
 * 1. Send MCP request for tool 'nonexistent-tool'
 * 2. Verify error 'Unknown tool: nonexistent-tool'
 * 3. Verify list of available tools is provided
 * 4. Verify similar tool names are suggested if close match exists
 * 5. Verify response code is -32601 (404 equivalent)
 */
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';

const serverPath = path.join(__dirname, 'index.ts');

interface MCPResponse {
  jsonrpc: string;
  id?: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: {
      requestedTool?: string;
      availableTools?: string[];
      suggestions?: string[];
    };
  };
}

interface TestResult {
  passed: boolean;
  message: string;
}

// Start the MCP server
function startMCPServer(): Promise<{ server: ChildProcessWithoutNullStreams; logs: string[] }> {
  return new Promise((resolve) => {
    const args = ['tsx', serverPath];

    const logs: string[] = [];

    const server = spawn('npx', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '../..'),
    });

    // Capture stderr
    server.stderr.on('data', (data) => {
      const logLine = data.toString().trim();
      if (logLine) {
        logs.push(logLine);
      }
    });

    // Wait for server to start
    setTimeout(() => {
      resolve({ server, logs });
    }, 1500);
  });
}

// Send a request and get response
function sendRequest(server: ChildProcessWithoutNullStreams, request: object, timeout = 3000): Promise<MCPResponse | null> {
  return new Promise((resolve) => {
    let stdoutData = '';
    const requestId = (request as { id?: number }).id;

    const handleData = (data: Buffer) => {
      stdoutData += data.toString();
      const lines = stdoutData.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const response = JSON.parse(line) as MCPResponse;
          if (response.id === requestId) {
            server.stdout.off('data', handleData);
            resolve(response);
            return;
          }
        } catch {
          // Not JSON yet
        }
      }
    };

    server.stdout.on('data', handleData);
    server.stdin.write(JSON.stringify(request) + '\n');

    setTimeout(() => {
      server.stdout.off('data', handleData);
      resolve(null);
    }, timeout);
  });
}

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Feature #629: MCP handles unknown tool invocation');
  console.log('='.repeat(60));
  console.log();

  const testResults: TestResult[] = [];

  // Start the MCP server
  console.log('Starting MCP server...');
  const { server, logs } = await startMCPServer();
  console.log('  ✓ MCP server started');

  // Initialize the server
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' }
    }
  };
  await sendRequest(server, initRequest);
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized' }) + '\n');
  await new Promise(r => setTimeout(r, 500));

  // Step 1: Send MCP request for tool 'nonexistent-tool'
  console.log('\nStep 1: Send MCP request for tool \'nonexistent-tool\'...');
  const response1 = await sendRequest(server, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'nonexistent-tool', arguments: {} }
  });

  console.log('  Response:', JSON.stringify(response1, null, 2));

  // Step 2: Verify error 'Unknown tool: nonexistent-tool'
  console.log('\n--- Step 2: Verify error message includes \'Unknown tool: nonexistent-tool\' ---');
  const hasCorrectMessage = response1?.error?.message?.includes('Unknown tool: nonexistent-tool');

  testResults.push({
    passed: hasCorrectMessage === true,
    message: hasCorrectMessage
      ? '✓ Error message includes "Unknown tool: nonexistent-tool"'
      : '✗ Error message does not include expected text',
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  // Step 3: Verify list of available tools is provided
  console.log('\n--- Step 3: Verify list of available tools is provided ---');
  const hasAvailableTools = response1?.error?.data?.availableTools && response1.error.data.availableTools.length > 0;

  testResults.push({
    passed: hasAvailableTools === true,
    message: hasAvailableTools
      ? `✓ Available tools list provided (${response1?.error?.data?.availableTools?.length} tools)`
      : '✗ Available tools list not provided',
  });
  console.log('  ' + testResults[testResults.length - 1].message);
  if (response1?.error?.data?.availableTools) {
    console.log('  Available tools:', response1.error.data.availableTools.slice(0, 5).join(', ') + '...');
  }

  // Step 4: Verify similar tool names are suggested if close match exists
  console.log('\n--- Step 4: Verify similar tool names are suggested ---');
  // Test with a tool name that's close to an existing one
  const response2 = await sendRequest(server, {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'list_project', arguments: {} } // Close to 'list_projects'
  });

  console.log('  Testing with \'list_project\' (close to \'list_projects\'):');
  console.log('  Response:', JSON.stringify(response2?.error, null, 2));

  const hasSuggestions = response2?.error?.data?.suggestions && response2.error.data.suggestions.length > 0;
  const suggestsCorrectTool = response2?.error?.data?.suggestions?.includes('list_projects') ||
                             response2?.error?.message?.includes('list_projects');

  testResults.push({
    passed: hasSuggestions === true && suggestsCorrectTool === true,
    message: hasSuggestions && suggestsCorrectTool
      ? `✓ Suggestions provided: ${response2?.error?.data?.suggestions?.join(', ')}`
      : '✗ No suggestions or incorrect suggestions',
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  // Step 5: Verify response code is -32601 (404 equivalent)
  console.log('\n--- Step 5: Verify response code is -32601 (Method not found / 404) ---');
  const hasCorrectCode = response1?.error?.code === -32601 && response2?.error?.code === -32601;

  testResults.push({
    passed: hasCorrectCode,
    message: hasCorrectCode
      ? '✓ Error code is -32601 (Method not found / 404 equivalent)'
      : `✗ Error code is ${response1?.error?.code}, expected -32601`,
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  // Bonus: Test another similar match
  console.log('\n--- Bonus: Test with \'runtest\' (should suggest \'run_test\') ---');
  const response3 = await sendRequest(server, {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: { name: 'runtest', arguments: {} }
  });

  console.log('  Response error:', JSON.stringify(response3?.error, null, 2));
  const suggestsRunTest = response3?.error?.data?.suggestions?.includes('run_test') ||
                         response3?.error?.message?.includes('run_test');
  if (suggestsRunTest) {
    console.log('  ✓ Correctly suggests "run_test"');
  }

  // Cleanup
  server.kill('SIGTERM');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));

  const passed = testResults.filter(t => t.passed).length;
  const total = testResults.length;

  testResults.forEach((result, i) => {
    console.log(`  Test ${i + 1}: ${result.passed ? '✓ PASS' : '✗ FAIL'} - ${result.message.substring(2)}`);
  });

  console.log('\n  Results: ' + passed + '/' + total + ' tests passed');

  if (passed === total) {
    console.log('\n✓ Feature #629 verification PASSED!');
    console.log('  - Error code is -32601 (Method not found / 404)');
    console.log('  - Error message includes "Unknown tool: {toolName}"');
    console.log('  - List of available tools is provided');
    console.log('  - Similar tool names are suggested');
    process.exit(0);
  } else {
    console.log('\n✗ Feature #629 verification FAILED');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
