/**
 * Test MCP Server handling of invalid API keys
 *
 * Feature #625: MCP handles invalid API key
 *
 * Tests:
 * 1. Send MCP request with invalid API key
 * 2. Verify response code is -32001 (401 Unauthorized equivalent)
 * 3. Verify error message 'Invalid or expired API key'
 * 4. Verify no sensitive data is leaked in error response
 * 5. Verify failed attempt is logged for security auditing
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
    data?: unknown;
  };
}

interface TestResult {
  passed: boolean;
  message: string;
  response?: MCPResponse;
  logs?: string[];
}

// Start the MCP server with specific configuration
function startMCPServer(apiKey: string, requireAuth: boolean): Promise<{ server: ChildProcessWithoutNullStreams; logs: string[] }> {
  return new Promise((resolve) => {
    const args = ['tsx', serverPath];

    if (requireAuth) {
      args.push('--require-auth');
    }
    args.push('--api-key', apiKey);
    args.push('--api-url', 'http://localhost:3001');

    const logs: string[] = [];

    const server = spawn('npx', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '../..'),
    });

    // Capture stderr (where logs go)
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
function sendRequest(server: ChildProcessWithoutNullStreams, request: object): Promise<MCPResponse | null> {
  return new Promise((resolve) => {
    let stdoutData = '';

    server.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    server.stdin.write(JSON.stringify(request) + '\n');

    setTimeout(() => {
      const lines = stdoutData.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const response = JSON.parse(line) as MCPResponse;
          if (response.id === (request as { id?: number }).id) {
            resolve(response);
            return;
          }
        } catch {
          // Not JSON, skip
        }
      }
      resolve(null);
    }, 2500);
  });
}

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Feature #625: MCP handles invalid API key');
  console.log('='.repeat(60));
  console.log();

  const testResults: TestResult[] = [];

  // Test 1: Send MCP request with invalid API key
  console.log('Step 1: Send MCP request with invalid API key...');
  const { server: server1, logs: logs1 } = await startMCPServer('invalid-api-key-that-does-not-exist', true);

  // Initialize first
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
  await sendRequest(server1, initRequest);

  // Try to call a tool
  const toolRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'list_projects', arguments: {} }
  };
  const response1 = await sendRequest(server1, toolRequest);

  console.log('  Response received:', JSON.stringify(response1, null, 2));
  console.log('  Captured logs:');
  logs1.forEach(log => console.log('    ', log));

  // Test 2: Verify response code is -32001 (401 equivalent)
  console.log('\nStep 2: Verify response code is -32001 (401 Unauthorized)...');
  const codeTest: TestResult = {
    passed: response1?.error?.code === -32001,
    message: response1?.error?.code === -32001
      ? `✓ Error code is -32001 as expected`
      : `✗ Error code is ${response1?.error?.code}, expected -32001`,
    response: response1 ?? undefined,
  };
  testResults.push(codeTest);
  console.log('  ' + codeTest.message);

  // Test 3: Verify error message 'Invalid or expired API key'
  console.log('\nStep 3: Verify error message is \'Invalid or expired API key\'...');
  const messageTest: TestResult = {
    passed: response1?.error?.message === 'Invalid or expired API key',
    message: response1?.error?.message === 'Invalid or expired API key'
      ? `✓ Error message is correct`
      : `✗ Error message is "${response1?.error?.message}", expected "Invalid or expired API key"`,
    response: response1 ?? undefined,
  };
  testResults.push(messageTest);
  console.log('  ' + messageTest.message);

  // Test 4: Verify no sensitive data is leaked in error response
  console.log('\nStep 4: Verify no sensitive data is leaked in error response...');
  const errorResponse = response1?.error;
  const sensitivePatterns = [
    'invalid-api-key-that-does-not-exist', // The actual key should not appear
    'organization_id',
    'user_id',
    'password',
    'secret',
    'token',
    'database',
    'connection',
    'stack',
  ];

  const errorString = JSON.stringify(errorResponse || {}).toLowerCase();
  const leakedData = sensitivePatterns.filter(pattern =>
    errorString.includes(pattern.toLowerCase())
  );

  const noLeakTest: TestResult = {
    passed: leakedData.length === 0,
    message: leakedData.length === 0
      ? '✓ No sensitive data leaked in error response'
      : `✗ Sensitive data found in response: ${leakedData.join(', ')}`,
  };
  testResults.push(noLeakTest);
  console.log('  ' + noLeakTest.message);
  console.log('  Error response:', JSON.stringify(errorResponse, null, 2));

  // Test 5: Verify failed attempt is logged for security auditing
  console.log('\nStep 5: Verify failed attempt is logged for security auditing...');
  const allLogs = logs1.join('\n');
  const hasSecurityLog = allLogs.includes('[SECURITY]') && allLogs.includes('Failed authentication');
  const logsTest: TestResult = {
    passed: hasSecurityLog,
    message: hasSecurityLog
      ? '✓ Security log entry found for failed authentication'
      : '✗ No security log entry found for failed authentication',
    logs: logs1.filter(l => l.includes('[SECURITY]')),
  };
  testResults.push(logsTest);
  console.log('  ' + logsTest.message);
  if (logsTest.logs && logsTest.logs.length > 0) {
    console.log('  Security logs:');
    logsTest.logs.forEach(log => console.log('    ', log));
  }

  // Verify the API key is masked in logs (not showing full key)
  const hasFullKey = allLogs.includes('invalid-api-key-that-does-not-exist');
  const keyMaskedTest: TestResult = {
    passed: !hasFullKey,
    message: hasFullKey
      ? '✗ Full API key appears in logs (security risk!)'
      : '✓ API key is properly masked in logs',
  };
  testResults.push(keyMaskedTest);
  console.log('  ' + keyMaskedTest.message);

  // Cleanup
  server1.kill('SIGTERM');

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
    console.log('\n✓ Feature #625 verification PASSED!');
    console.log('  - Invalid API keys return proper 401 errors');
    console.log('  - Error message is "Invalid or expired API key"');
    console.log('  - No sensitive data leaked in error responses');
    console.log('  - Failed attempts are logged for security auditing');
    process.exit(0);
  } else {
    console.log('\n✗ Feature #625 verification FAILED');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
