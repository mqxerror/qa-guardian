/**
 * Test MCP Server rate limit exceeded handling
 *
 * Feature #627: MCP handles rate limit exceeded
 *
 * Tests:
 * 1. Configure API key with 10 requests/minute limit
 * 2. Send 15 requests in rapid succession
 * 3. Verify 429 Too Many Requests after 10th request (code -32004)
 * 4. Verify Retry-After header is present (in error.data.retryAfter)
 * 5. Verify request succeeds after waiting retry period
 */
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';

const serverPath = path.join(__dirname, 'index.ts');

// Use 10 requests per 5 seconds for testing (faster than 1 minute)
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW = 5; // seconds

interface MCPResponse {
  jsonrpc: string;
  id?: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: {
      limit?: number;
      remaining?: number;
      resetMs?: number;
      retryAfter?: number;
    };
  };
}

interface TestResult {
  passed: boolean;
  message: string;
}

// Start the MCP server with rate limiting configuration
function startMCPServer(): Promise<{ server: ChildProcessWithoutNullStreams; logs: string[] }> {
  return new Promise((resolve) => {
    const args = [
      'tsx', serverPath,
      '--rate-limit', String(RATE_LIMIT),
      '--rate-limit-window', String(RATE_LIMIT_WINDOW),
      '--api-url', 'http://localhost:3001',
    ];

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
    }, 2000);
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
          // Not JSON
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
  console.log('Feature #627: MCP handles rate limit exceeded');
  console.log('='.repeat(60));
  console.log();
  console.log(`Configuration: ${RATE_LIMIT} requests per ${RATE_LIMIT_WINDOW} seconds`);
  console.log();

  const testResults: TestResult[] = [];

  // Step 1: Configure and start server with 10 requests/minute limit
  console.log('Step 1: Configure API key with 10 requests/5-second limit...');
  const { server, logs } = await startMCPServer();
  console.log('  ✓ MCP server started with rate limit configuration');

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

  // Step 2: Send 15 requests in rapid succession
  console.log('\nStep 2: Send 15 requests in rapid succession...');
  const responses: (MCPResponse | null)[] = [];
  let requestId = 2;

  for (let i = 0; i < 15; i++) {
    const toolRequest = {
      jsonrpc: '2.0',
      id: requestId++,
      method: 'tools/call',
      params: { name: 'list_projects', arguments: {} }
    };
    const response = await sendRequest(server, toolRequest, 2000);
    responses.push(response);

    const status = response?.error?.code === -32004 ? 'RATE LIMITED' : 'OK';
    console.log(`  Request ${i + 1}: ${status}`);
  }

  // Step 3: Verify 429 Too Many Requests after 10th request
  console.log('\nStep 3: Verify 429 Too Many Requests after 10th request...');

  // Count successful vs rate-limited responses
  // A response is successful if it doesn't have error code -32004 (other errors like network issues don't count as rate limiting)
  const successfulResponses = responses.filter(r => r && r.error?.code !== -32004);
  const rateLimitedResponses = responses.filter(r => r?.error?.code === -32004);

  console.log(`  Successful requests: ${successfulResponses.length}`);
  console.log(`  Rate-limited requests: ${rateLimitedResponses.length}`);

  const test3Passed = successfulResponses.length === RATE_LIMIT && rateLimitedResponses.length === 5;
  testResults.push({
    passed: test3Passed,
    message: test3Passed
      ? `✓ First ${successfulResponses.length} requests succeeded, then rate limiting kicked in`
      : `✗ Expected rate limiting after ${RATE_LIMIT} requests`,
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  // Step 4: Verify Retry-After header is present
  console.log('\nStep 4: Verify Retry-After header is present...');
  const rateLimitedResponse = responses.find(r => r?.error?.code === -32004);
  const hasRetryAfter = rateLimitedResponse?.error?.data?.retryAfter !== undefined;

  testResults.push({
    passed: hasRetryAfter,
    message: hasRetryAfter
      ? `✓ Retry-After present: ${rateLimitedResponse?.error?.data?.retryAfter} seconds`
      : '✗ Retry-After not present in error response',
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  if (rateLimitedResponse?.error) {
    console.log('  Error details:');
    console.log(`    Code: ${rateLimitedResponse.error.code}`);
    console.log(`    Message: ${rateLimitedResponse.error.message}`);
    if (rateLimitedResponse.error.data) {
      console.log(`    Limit: ${rateLimitedResponse.error.data.limit}`);
      console.log(`    Remaining: ${rateLimitedResponse.error.data.remaining}`);
      console.log(`    ResetMs: ${rateLimitedResponse.error.data.resetMs}`);
      console.log(`    RetryAfter: ${rateLimitedResponse.error.data.retryAfter}`);
    }
  }

  // Verify error code is -32004 (429 equivalent)
  console.log('\n  Verifying error code is -32004 (429 Too Many Requests equivalent)...');
  const hasCorrectCode = rateLimitedResponse?.error?.code === -32004;
  testResults.push({
    passed: hasCorrectCode,
    message: hasCorrectCode
      ? '✓ Error code is -32004 (429 Too Many Requests equivalent)'
      : `✗ Error code is ${rateLimitedResponse?.error?.code}, expected -32004`,
  });
  console.log('  ' + testResults[testResults.length - 1].message);

  // Step 5: Verify request succeeds after waiting retry period
  // Need to wait for the full window + buffer to ensure all timestamps expire
  const waitTime = RATE_LIMIT_WINDOW + 2; // Extra buffer
  console.log(`\nStep 5: Verify request succeeds after waiting ${waitTime} seconds...`);

  // Wait for rate limit window to expire
  console.log(`  Waiting ${waitTime} seconds for rate limit window to reset...`);
  await new Promise(r => setTimeout(r, waitTime * 1000));

  // Try another request
  const afterWaitRequest = {
    jsonrpc: '2.0',
    id: requestId++,
    method: 'tools/call',
    params: { name: 'list_projects', arguments: {} }
  };
  const afterWaitResponse = await sendRequest(server, afterWaitRequest);

  // Debug: show what we got
  console.log('  Response after wait:', JSON.stringify(afterWaitResponse?.error || 'no error', null, 2));

  // Check if the request succeeded (any error other than rate limit is still a "success" for this test)
  const succeededAfterWait = afterWaitResponse && afterWaitResponse.error?.code !== -32004;
  testResults.push({
    passed: succeededAfterWait === true,
    message: succeededAfterWait
      ? '✓ Request succeeded after waiting for retry period'
      : `✗ Request still rate limited after waiting (code: ${afterWaitResponse?.error?.code})`,
  });
  console.log('  ' + testResults[testResults.length - 1].message);

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
    console.log('\n✓ Feature #627 verification PASSED!');
    console.log('  - Rate limiting kicks in after configured limit');
    console.log('  - Error code is -32004 (429 Too Many Requests equivalent)');
    console.log('  - Retry-After is present in error response');
    console.log('  - Requests succeed after waiting retry period');
    process.exit(0);
  } else {
    console.log('\n✗ Feature #627 verification FAILED');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
