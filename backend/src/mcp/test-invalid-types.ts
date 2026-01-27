/**
 * Test MCP Server handling of invalid parameter types
 *
 * Feature #631: MCP handles invalid parameter types
 *
 * Tests:
 * 1. Call 'trigger_test_run' with suite_id as number instead of string
 * 2. Verify error 'Invalid type for suite_id: expected string, got number'
 * 3. Verify expected type is clearly stated
 * 4. Verify response code is -32602 (400 Bad Request equivalent)
 * 5. Verify valid example is provided
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
      invalidParameters?: Array<{
        parameter: string;
        expectedType: string;
        actualType: string;
        validExample: string;
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
  console.log('Feature #631: MCP handles invalid parameter types');
  console.log('='.repeat(60));
  console.log();

  const testResults: TestResult[] = [];

  // Start the MCP server
  console.log('Starting MCP server...');
  const { server, logs } = await startMCPServer();
  console.log('  MCP server started');

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

  // Step 1: Call 'trigger_test_run' with suite_id as number instead of string
  console.log('\n--- Step 1: Call \'trigger_test_run\' with suite_id as number instead of string ---');
  const response1 = await sendRequest(server, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'trigger_test_run', arguments: { suite_id: 12345 } } // number instead of string
  });

  console.log('  Response:', JSON.stringify(response1, null, 2));

  // Step 2: Verify error 'Invalid type for suite_id: expected string, got number'
  console.log('\n--- Step 2: Verify error message format ---');
  const hasCorrectMessage = response1?.error?.message?.includes('Invalid type for suite_id: expected string, got number');

  testResults.push({
    passed: hasCorrectMessage === true,
    message: hasCorrectMessage
      ? '✓ Error message includes "Invalid type for suite_id: expected string, got number"'
      : `✗ Error message format incorrect. Got: "${response1?.error?.message}"`,
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  // Step 3: Verify expected type is clearly stated
  console.log('\n--- Step 3: Verify expected type is clearly stated ---');
  const invalidParams = response1?.error?.data?.invalidParameters;
  const hasExpectedType = invalidParams && invalidParams.some(p =>
    p.expectedType === 'string' && p.parameter === 'suite_id'
  );

  testResults.push({
    passed: hasExpectedType === true,
    message: hasExpectedType
      ? '✓ Expected type "string" clearly stated in error data'
      : '✗ Expected type not clearly stated',
  });
  console.log('  ' + testResults[testResults.length - 1].message);
  if (invalidParams) {
    console.log(`  Invalid param details: ${JSON.stringify(invalidParams[0])}`);
  }

  // Step 4: Verify response code is -32602 (400 Bad Request equivalent)
  console.log('\n--- Step 4: Verify response code is -32602 ---');
  const hasCorrectCode = response1?.error?.code === -32602;

  testResults.push({
    passed: hasCorrectCode,
    message: hasCorrectCode
      ? '✓ Error code is -32602 (Invalid params / 400 Bad Request equivalent)'
      : `✗ Error code is ${response1?.error?.code}, expected -32602`,
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  // Step 5: Verify valid example is provided
  console.log('\n--- Step 5: Verify valid example is provided ---');
  const hasValidExample = invalidParams && invalidParams.some(p =>
    p.validExample && p.validExample.length > 0
  );

  testResults.push({
    passed: hasValidExample === true,
    message: hasValidExample
      ? `✓ Valid example provided: ${invalidParams?.[0]?.validExample}`
      : '✗ Valid example not provided',
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  // Bonus test: Boolean type validation
  console.log('\n--- Bonus: Test boolean type validation (parallel as string instead of boolean) ---');
  const response2 = await sendRequest(server, {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'trigger_test_run', arguments: { suite_id: 'test-suite-1', parallel: 'yes' } }
  });

  console.log('  Response error:', JSON.stringify(response2?.error, null, 2));
  const hasBooleanError = response2?.error?.message?.includes('parallel') &&
                         response2?.error?.message?.includes('boolean');
  if (hasBooleanError) {
    console.log('  ✓ Boolean type validation works correctly');
  } else {
    console.log('  - Boolean type validation result:', response2?.error?.message);
  }

  // Bonus test: Number type validation
  console.log('\n--- Bonus: Test number type validation (limit as string instead of number) ---');
  const response3 = await sendRequest(server, {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: { name: 'list_projects', arguments: { limit: 'fifty' } }
  });

  console.log('  Response error:', JSON.stringify(response3?.error, null, 2));
  const hasNumberError = response3?.error?.message?.includes('limit') &&
                        response3?.error?.message?.includes('number');
  if (hasNumberError) {
    console.log('  ✓ Number type validation works correctly');
  } else {
    console.log('  - Number type validation result:', response3?.error?.message);
  }

  // Bonus test: Valid types should pass validation
  console.log('\n--- Bonus: Verify correct types pass validation ---');
  const response4 = await sendRequest(server, {
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: { name: 'get_project', arguments: { project_id: 'valid-string-id' } }
  });

  // This should NOT fail with -32602 (type error), it might fail with 404 (not found)
  const passesTypeValidation = response4?.error?.code !== -32602 ||
                               !response4?.error?.message?.includes('Invalid type');
  console.log(`  Response code: ${response4?.error?.code}`);
  if (passesTypeValidation) {
    console.log('  ✓ Correct types pass type validation');
  } else {
    console.log('  ✗ Correct types unexpectedly failed type validation');
  }

  // Check server logs
  console.log('\n--- Server logs ---');
  const errorLogs = logs.filter(l => l.includes('[ERROR]') && l.includes('Invalid parameter types'));
  if (errorLogs.length > 0) {
    console.log('  ✓ Server logged type validation errors:');
    errorLogs.forEach(log => console.log(`    ${log}`));
  } else {
    console.log('  - No type error logs found (may be in later output)');
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
    console.log('\n✓ Feature #631 verification PASSED!');
    console.log('  - Error code is -32602 (Invalid params / 400 Bad Request)');
    console.log('  - Error message format: "Invalid type for {param}: expected {type}, got {type}"');
    console.log('  - Expected type is clearly stated');
    console.log('  - Valid example is provided');
    process.exit(0);
  } else {
    console.log('\n✗ Feature #631 verification FAILED');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
