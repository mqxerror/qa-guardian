/**
 * Test MCP Server handling of missing required parameters
 *
 * Feature #630: MCP handles missing required parameters
 *
 * Tests:
 * 1. Call 'trigger_test_run' without required 'suite_id' parameter
 * 2. Verify error 'Missing required parameter: suite_id'
 * 3. Verify all missing parameters are listed
 * 4. Verify parameter descriptions are included
 * 5. Verify response code is -32602 (400 Bad Request equivalent - Invalid params)
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
      tool?: string;
      missingParameters?: Array<{
        parameter: string;
        description: string;
      }>;
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
  console.log('Feature #630: MCP handles missing required parameters');
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

  // Step 1: Call 'trigger_test_run' without required 'suite_id' parameter
  console.log('\n--- Step 1: Call \'trigger_test_run\' without required \'suite_id\' parameter ---');
  const response1 = await sendRequest(server, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'trigger_test_run', arguments: {} }
  });

  console.log('  Response:', JSON.stringify(response1, null, 2));

  // Step 2: Verify error 'Missing required parameter: suite_id'
  console.log('\n--- Step 2: Verify error message includes \'Missing required parameter: suite_id\' ---');
  const hasCorrectMessage = response1?.error?.message?.includes('Missing required parameter: suite_id');

  testResults.push({
    passed: hasCorrectMessage === true,
    message: hasCorrectMessage
      ? '✓ Error message includes "Missing required parameter: suite_id"'
      : `✗ Error message does not include expected text. Got: "${response1?.error?.message}"`,
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  // Step 3: Verify all missing parameters are listed
  console.log('\n--- Step 3: Verify all missing parameters are listed ---');
  const hasMissingParams = response1?.error?.data?.missingParameters && response1.error.data.missingParameters.length > 0;
  const suiteIdListed = response1?.error?.data?.missingParameters?.some(p => p.parameter === 'suite_id');

  testResults.push({
    passed: hasMissingParams === true && suiteIdListed === true,
    message: hasMissingParams && suiteIdListed
      ? `✓ Missing parameters listed: ${response1?.error?.data?.missingParameters?.map(p => p.parameter).join(', ')}`
      : '✗ Missing parameters not properly listed',
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  // Step 4: Verify parameter descriptions are included
  console.log('\n--- Step 4: Verify parameter descriptions are included ---');
  const hasDescription = response1?.error?.data?.missingParameters?.some(
    p => p.description && p.description.length > 0
  );

  testResults.push({
    passed: hasDescription === true,
    message: hasDescription
      ? `✓ Parameter descriptions included: "${response1?.error?.data?.missingParameters?.[0]?.description}"`
      : '✗ Parameter descriptions not included',
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  // Step 5: Verify response code is -32602 (400 Bad Request equivalent)
  console.log('\n--- Step 5: Verify response code is -32602 (Invalid params / 400) ---');
  const hasCorrectCode = response1?.error?.code === -32602;

  testResults.push({
    passed: hasCorrectCode,
    message: hasCorrectCode
      ? '✓ Error code is -32602 (Invalid params / 400 Bad Request equivalent)'
      : `✗ Error code is ${response1?.error?.code}, expected -32602`,
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  // Bonus test: Multiple missing required parameters
  console.log('\n--- Bonus: Test with tool requiring multiple parameters (create_test) ---');
  const response2 = await sendRequest(server, {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'create_test', arguments: {} } // Missing suite_id, name, type
  });

  console.log('  Response error:', JSON.stringify(response2?.error, null, 2));

  const hasMultipleMissing = response2?.error?.data?.missingParameters && response2.error.data.missingParameters.length >= 3;
  const messageHasPlural = response2?.error?.message?.includes('Missing required parameters:');

  if (hasMultipleMissing && messageHasPlural) {
    console.log('  ✓ Multiple missing parameters correctly reported');
    console.log(`    Missing: ${response2?.error?.data?.missingParameters?.map(p => p.parameter).join(', ')}`);
  } else {
    console.log('  ✗ Multiple missing parameters not correctly reported');
  }

  // Bonus test: Tool with all required params provided should work
  console.log('\n--- Bonus: Verify tool with all params passes validation ---');
  const response3 = await sendRequest(server, {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: { name: 'get_project', arguments: { project_id: 'test-123' } }
  });

  // This will fail with 404 (not found) because the project doesn't exist,
  // but it should NOT fail with -32602 (missing params)
  const passesValidation = response3?.error?.code !== -32602;
  console.log(`  Response code: ${response3?.error?.code}`);
  if (passesValidation) {
    console.log('  ✓ Tool with all required params passes parameter validation');
  } else {
    console.log('  ✗ Tool unexpectedly failed parameter validation');
  }

  // Check server logs for error message
  console.log('\n--- Server logs ---');
  const errorLogs = logs.filter(l => l.includes('[ERROR]') && l.includes('Missing required'));
  if (errorLogs.length > 0) {
    console.log('  ✓ Server logged missing parameter errors:');
    errorLogs.forEach(log => console.log(`    ${log}`));
  } else {
    console.log('  - No missing parameter error logs found (may be in later output)');
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
    console.log('\n✓ Feature #630 verification PASSED!');
    console.log('  - Error code is -32602 (Invalid params / 400 Bad Request)');
    console.log('  - Error message includes "Missing required parameter: {param}"');
    console.log('  - All missing parameters are listed');
    console.log('  - Parameter descriptions are included');
    process.exit(0);
  } else {
    console.log('\n✗ Feature #630 verification FAILED');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
