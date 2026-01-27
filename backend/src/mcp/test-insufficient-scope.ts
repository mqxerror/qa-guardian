/**
 * Test MCP Server handling of insufficient scope
 *
 * Feature #626: MCP handles insufficient scope
 *
 * Tests:
 * 1. Create API key with only 'mcp:read' scope
 * 2. Attempt to call 'trigger_test_run' (requires mcp:execute)
 * 3. Verify response code is -32003 (403 Forbidden equivalent)
 * 4. Verify error message lists required scope 'mcp:execute'
 * 5. Verify suggestion to update API key permissions
 */
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';
import crypto from 'crypto';

const serverPath = path.join(__dirname, 'index.ts');
const BACKEND_URL = 'http://localhost:3001';

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

// Create a test API key via the backend API
async function createTestApiKey(scopes: string[]): Promise<string | null> {
  // First, login to get a token
  try {
    const loginResponse = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@example.com',
        password: 'Owner123!',
      }),
    });

    if (!loginResponse.ok) {
      console.error('  Failed to login:', await loginResponse.text());
      return null;
    }

    const loginData = await loginResponse.json() as { token: string; user: { organization_id: string } };
    const token = loginData.token;
    const orgId = loginData.user.organization_id;

    // Create API key with specified scopes
    const createResponse = await fetch(`${BACKEND_URL}/api/v1/organizations/${orgId}/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: `Test Key - ${crypto.randomUUID().substring(0, 8)}`,
        scopes,
      }),
    });

    if (!createResponse.ok) {
      console.error('  Failed to create API key:', await createResponse.text());
      return null;
    }

    const createData = await createResponse.json() as { api_key: { key: string } };
    return createData.api_key.key;
  } catch (error) {
    console.error('  Error creating API key:', error);
    return null;
  }
}

// Start the MCP server with specific configuration
function startMCPServer(apiKey: string): Promise<{ server: ChildProcessWithoutNullStreams; logs: string[] }> {
  return new Promise((resolve) => {
    const args = ['tsx', serverPath];
    args.push('--require-auth');
    args.push('--api-key', apiKey);
    args.push('--api-url', BACKEND_URL);

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
    }, 3000);
  });
}

async function runTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Feature #626: MCP handles insufficient scope');
  console.log('='.repeat(60));
  console.log();

  const testResults: TestResult[] = [];

  // Step 1: Create API key with only 'mcp:read' scope
  console.log('Step 1: Create API key with only \'mcp:read\' scope...');
  const apiKey = await createTestApiKey(['mcp:read']);

  if (!apiKey) {
    console.log('  ✗ Failed to create test API key');
    process.exit(1);
  }
  console.log('  ✓ API key created successfully');
  console.log(`  Key prefix: ${apiKey.substring(0, 10)}...`);

  // Step 2: Attempt to call 'trigger_test_run' (requires mcp:execute)
  console.log('\nStep 2: Attempt to call \'trigger_test_run\' (requires mcp:execute)...');
  const { server, logs } = await startMCPServer(apiKey);

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
  await sendRequest(server, initRequest);

  // Try to call trigger_test_run
  const toolRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'trigger_test_run',
      arguments: { suite_id: 'test-suite-123' }
    }
  };
  const response = await sendRequest(server, toolRequest);

  console.log('  Response received:', JSON.stringify(response, null, 2));
  console.log('  Captured logs:');
  logs.filter(l => l.includes('[SECURITY]')).forEach(log => console.log('    ', log));

  // Step 3: Verify response code is -32003 (403 Forbidden equivalent)
  console.log('\nStep 3: Verify response code is -32003 (403 Forbidden)...');
  const codeTest: TestResult = {
    passed: response?.error?.code === -32003,
    message: response?.error?.code === -32003
      ? '✓ Error code is -32003 as expected'
      : `✗ Error code is ${response?.error?.code}, expected -32003`,
    response: response ?? undefined,
  };
  testResults.push(codeTest);
  console.log('  ' + codeTest.message);

  // Step 4: Verify error message lists required scope 'mcp:execute'
  console.log('\nStep 4: Verify error message lists required scope \'mcp:execute\'...');
  const hasRequiredScope = response?.error?.message?.includes('mcp:execute');
  const scopeTest: TestResult = {
    passed: hasRequiredScope === true,
    message: hasRequiredScope
      ? '✓ Error message includes required scope \'mcp:execute\''
      : '✗ Error message does not mention required scope',
    response: response ?? undefined,
  };
  testResults.push(scopeTest);
  console.log('  ' + scopeTest.message);
  console.log('  Error message:', response?.error?.message);

  // Step 5: Verify suggestion to update API key permissions
  console.log('\nStep 5: Verify suggestion to update API key permissions...');
  const hasSuggestion = response?.error?.message?.includes('Update your API key permissions') ||
                       response?.error?.message?.includes('dashboard');
  const suggestionTest: TestResult = {
    passed: hasSuggestion === true,
    message: hasSuggestion
      ? '✓ Error message includes suggestion to update permissions'
      : '✗ Error message does not include suggestion',
    response: response ?? undefined,
  };
  testResults.push(suggestionTest);
  console.log('  ' + suggestionTest.message);

  // Additional: Verify security logging
  console.log('\nBonus: Verify security logging...');
  const allLogs = logs.join('\n');
  const hasSecurityLog = allLogs.includes('[SECURITY]') && allLogs.includes('Permission denied');
  const logsTest: TestResult = {
    passed: hasSecurityLog,
    message: hasSecurityLog
      ? '✓ Security log entry found for permission denied'
      : '✗ No security log entry found',
    logs: logs.filter(l => l.includes('[SECURITY]')),
  };
  testResults.push(logsTest);
  console.log('  ' + logsTest.message);

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
    console.log('\n✓ Feature #626 verification PASSED!');
    console.log('  - Insufficient scope returns 403 Forbidden (code -32003)');
    console.log('  - Error message includes required scope \'mcp:execute\'');
    console.log('  - Suggestion to update API key permissions included');
    console.log('  - Security logging for permission denied events');
    process.exit(0);
  } else {
    console.log('\n✗ Feature #626 verification FAILED');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
