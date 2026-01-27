/**
 * Test MCP Server handling of malformed JSON requests
 *
 * Feature #628: MCP handles malformed JSON requests
 *
 * Tests:
 * 1. Send MCP request with malformed JSON body
 * 2. Verify response code is -32700 (400 Bad Request equivalent)
 * 3. Verify error message indicates JSON parse error
 * 4. Verify error location (line/column) is provided if possible
 * 5. Verify request is not processed
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
      originalError?: string;
      position?: number;
      line?: number;
      column?: number;
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

// Send a raw string (possibly malformed JSON) and get response
function sendRawRequest(server: ChildProcessWithoutNullStreams, rawData: string, timeout = 3000): Promise<MCPResponse | null> {
  return new Promise((resolve) => {
    let stdoutData = '';

    const handleData = (data: Buffer) => {
      stdoutData += data.toString();
      const lines = stdoutData.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const response = JSON.parse(line) as MCPResponse;
          server.stdout.off('data', handleData);
          resolve(response);
          return;
        } catch {
          // Not JSON yet
        }
      }
    };

    server.stdout.on('data', handleData);
    server.stdin.write(rawData + '\n');

    setTimeout(() => {
      server.stdout.off('data', handleData);
      resolve(null);
    }, timeout);
  });
}

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Feature #628: MCP handles malformed JSON requests');
  console.log('='.repeat(60));
  console.log();

  const testResults: TestResult[] = [];

  // Start the MCP server
  console.log('Starting MCP server...');
  const { server, logs } = await startMCPServer();
  console.log('  ✓ MCP server started');

  // Test Case 1: Completely invalid JSON (random text)
  console.log('\nTest Case 1: Send completely invalid JSON (random text)...');
  const response1 = await sendRawRequest(server, 'this is not json at all');

  console.log('  Response:', JSON.stringify(response1, null, 2));

  // Test Case 2: JSON with syntax error (missing quote)
  console.log('\nTest Case 2: Send JSON with missing quote...');
  const response2 = await sendRawRequest(server, '{"jsonrpc": "2.0", "id": 1, method: "initialize"}');

  console.log('  Response:', JSON.stringify(response2, null, 2));

  // Test Case 3: JSON with trailing comma
  console.log('\nTest Case 3: Send JSON with trailing comma...');
  const response3 = await sendRawRequest(server, '{"jsonrpc": "2.0", "id": 1, "method": "initialize",}');

  console.log('  Response:', JSON.stringify(response3, null, 2));

  // Step 2: Verify response code is -32700 (400 Bad Request equivalent)
  console.log('\n--- Step 2: Verify response code is -32700 (400 Bad Request) ---');
  const responses = [response1, response2, response3];
  const allHaveCorrectCode = responses.every(r => r?.error?.code === -32700);

  testResults.push({
    passed: allHaveCorrectCode,
    message: allHaveCorrectCode
      ? '✓ All responses have error code -32700'
      : `✗ Some responses have wrong error code`,
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  // Step 3: Verify error message indicates JSON parse error
  console.log('\n--- Step 3: Verify error message indicates JSON parse error ---');
  const allHaveParseError = responses.every(r =>
    r?.error?.message?.toLowerCase().includes('invalid json') ||
    r?.error?.message?.toLowerCase().includes('parse')
  );

  testResults.push({
    passed: allHaveParseError,
    message: allHaveParseError
      ? '✓ All error messages indicate JSON parse error'
      : '✗ Some error messages do not indicate parse error',
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  // Step 4: Verify error location (line/column) is provided if possible
  console.log('\n--- Step 4: Verify error location (position/line/column) if available ---');
  // At least response2 and response3 should have position info since they have a specific syntax error
  const hasPositionInfo = responses.some(r =>
    r?.error?.data?.position !== undefined ||
    r?.error?.message?.includes('position')
  );

  testResults.push({
    passed: hasPositionInfo,
    message: hasPositionInfo
      ? '✓ Position information provided in at least one error'
      : '✗ No position information in any error',
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  // Check for detailed error data
  responses.forEach((r, i) => {
    if (r?.error?.data) {
      console.log(`  Response ${i + 1} error data:`, JSON.stringify(r.error.data, null, 4));
    }
  });

  // Step 5: Verify request is not processed (no result, only error)
  console.log('\n--- Step 5: Verify request is not processed ---');
  const noneProcessed = responses.every(r => r?.result === undefined && r?.error !== undefined);

  testResults.push({
    passed: noneProcessed,
    message: noneProcessed
      ? '✓ No requests were processed (all have errors, no results)'
      : '✗ Some requests were incorrectly processed',
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  // Check logs for error entries
  console.log('\n--- Bonus: Check server logs for error entries ---');
  const errorLogs = logs.filter(l => l.includes('[ERROR]'));
  const hasErrorLogs = errorLogs.length > 0;

  testResults.push({
    passed: hasErrorLogs,
    message: hasErrorLogs
      ? `✓ Server logged ${errorLogs.length} error(s)`
      : '✗ No error logs found',
  });
  console.log('  ' + testResults[testResults.length - 1].message);
  if (errorLogs.length > 0) {
    console.log('  Error logs:');
    errorLogs.forEach(log => console.log('    ' + log));
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
    console.log('\n✓ Feature #628 verification PASSED!');
    console.log('  - Error code is -32700 (400 Bad Request equivalent)');
    console.log('  - Error message indicates JSON parse error');
    console.log('  - Error location (position) provided when available');
    console.log('  - Malformed requests are not processed');
    process.exit(0);
  } else {
    console.log('\n✗ Feature #628 verification FAILED');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
