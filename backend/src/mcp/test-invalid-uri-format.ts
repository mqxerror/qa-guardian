/**
 * Test MCP Server handling of invalid resource URI format
 *
 * Feature #646: MCP handles invalid resource URI format
 *
 * Tests:
 * 1. Request resource with invalid URI 'qaguardian://invalid//path'
 * 2. Verify error 'Invalid resource URI format'
 * 3. Verify correct URI format is shown in error
 * 4. Verify examples of valid URIs are provided
 * 5. Verify response code is 400 (error code -32602)
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
      requestedUri?: string;
      issues?: string[];
      expectedFormat?: string;
      examples?: string[];
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
  console.log('Feature #646: MCP handles invalid resource URI format');
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

  // Step 1: Request resource with invalid URI 'qaguardian://invalid//path' (wrong protocol + double slashes)
  console.log('\n--- Step 1: Request resource with invalid URI \'qaguardian://invalid//path\' ---');
  const response1 = await sendRequest(server, {
    jsonrpc: '2.0',
    id: 2,
    method: 'resources/read',
    params: { uri: 'qaguardian://invalid//path' }
  });

  console.log('  Response:', JSON.stringify(response1, null, 2));

  // Step 2: Verify error 'Invalid resource URI format'
  console.log('\n--- Step 2: Verify error \'Invalid resource URI format\' ---');
  const hasInvalidFormatError = response1?.error?.message?.includes('Invalid resource URI format');

  testResults.push({
    passed: hasInvalidFormatError === true,
    message: hasInvalidFormatError
      ? '✓ Error message contains "Invalid resource URI format"'
      : `✗ Error message should contain "Invalid resource URI format". Got: "${response1?.error?.message}"`,
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  // Step 3: Verify correct URI format is shown in error
  console.log('\n--- Step 3: Verify correct URI format is shown in error ---');
  const hasExpectedFormat = response1?.error?.data?.expectedFormat &&
                           response1.error.data.expectedFormat.includes('qa-guardian://');

  testResults.push({
    passed: hasExpectedFormat === true,
    message: hasExpectedFormat
      ? `✓ Expected format shown: "${response1?.error?.data?.expectedFormat}"`
      : '✗ Expected URI format not shown in error',
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  // Step 4: Verify examples of valid URIs are provided
  console.log('\n--- Step 4: Verify examples of valid URIs are provided ---');
  const hasExamples = response1?.error?.data?.examples &&
                     response1.error.data.examples.length > 0;

  testResults.push({
    passed: hasExamples === true,
    message: hasExamples
      ? `✓ Examples provided (${response1?.error?.data?.examples?.length} examples)`
      : '✗ No examples of valid URIs provided',
  });
  console.log('  ' + testResults[testResults.length - 1].message);
  if (hasExamples) {
    console.log('  Valid URI examples:');
    response1?.error?.data?.examples?.slice(0, 3).forEach(e => console.log(`    - ${e}`));
  }

  // Step 5: Verify response code is 400 (error code -32602)
  console.log('\n--- Step 5: Verify response code is 400 (error code -32602) ---');
  const hasCorrectCode = response1?.error?.code === -32602;

  testResults.push({
    passed: hasCorrectCode,
    message: hasCorrectCode
      ? '✓ Error code is -32602 (Invalid params / 400 Bad Request)'
      : `✗ Error code is ${response1?.error?.code}, expected -32602`,
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  // Bonus: Verify issues list contains specific validation errors
  console.log('\n--- Bonus: Verify issues list contains specific validation errors ---');
  const hasIssues = response1?.error?.data?.issues &&
                   response1.error.data.issues.length > 0;

  if (hasIssues) {
    console.log('  ✓ Validation issues documented:');
    response1?.error?.data?.issues?.forEach(issue => console.log(`    - ${issue}`));
  } else {
    console.log('  - No specific issues documented');
  }

  // Test with double slashes only
  console.log('\n--- Bonus: Test URI with double slashes only ---');
  const response2 = await sendRequest(server, {
    jsonrpc: '2.0',
    id: 3,
    method: 'resources/read',
    params: { uri: 'qa-guardian://projects//123' }
  });

  if (response2?.error?.message?.includes('Invalid resource URI format')) {
    console.log('  ✓ Double slashes detected: ' + response2.error.message);
  } else {
    console.log('  - Double slashes handling: ' + response2?.error?.message);
  }

  // Test with empty path segments
  console.log('\n--- Bonus: Test URI with empty path segment ---');
  const response3 = await sendRequest(server, {
    jsonrpc: '2.0',
    id: 4,
    method: 'resources/read',
    params: { uri: 'qa-guardian://projects/' }
  });

  if (response3?.error) {
    console.log('  Error for trailing slash: ' + response3.error.message);
  }

  // Test with missing URI
  console.log('\n--- Bonus: Test with missing URI ---');
  const response4 = await sendRequest(server, {
    jsonrpc: '2.0',
    id: 5,
    method: 'resources/read',
    params: {}
  });

  if (response4?.error?.message?.includes('URI is required')) {
    console.log('  ✓ Missing URI handled: ' + response4.error.message);
  } else {
    console.log('  - Missing URI response: ' + response4?.error?.message);
  }

  // Check server logs
  console.log('\n--- Server logs ---');
  const errorLogs = logs.filter(l => l.includes('[ERROR]'));
  if (errorLogs.length > 0) {
    console.log('  ✓ Server logged errors:');
    errorLogs.forEach(log => console.log(`    ${log}`));
  } else {
    console.log('  - No error logs found');
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
    console.log('\n✓ Feature #646 verification PASSED!');
    console.log('  - Invalid URIs return "Invalid resource URI format" error');
    console.log('  - Correct URI format is shown (qa-guardian://{resource-type}[/{resource-id}])');
    console.log('  - Examples of valid URIs are provided');
    console.log('  - Error code is -32602 (400 Bad Request)');
    process.exit(0);
  } else {
    console.log('\n✗ Feature #646 verification FAILED');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
