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
import {
  testStart, testStep, testData, testPass, testFail, testResult, testExit, testLog, testSection
} from './test-logger.js';

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
  testStart('Feature #630: MCP handles missing required parameters');

  const testResults: TestResult[] = [];

  // Start the MCP server
  testLog('Starting MCP server...');
  const { server, logs } = await startMCPServer();
  testPass('MCP server started');

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
  testStep(1, 'Call \'trigger_test_run\' without required \'suite_id\' parameter');
  const response1 = await sendRequest(server, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'trigger_test_run', arguments: {} }
  });

  testData('Response', response1);

  // Step 2: Verify error 'Missing required parameter: suite_id'
  testStep(2, 'Verify error message includes \'Missing required parameter: suite_id\'');
  const hasCorrectMessage = response1?.error?.message?.includes('Missing required parameter: suite_id');

  testResults.push({
    passed: hasCorrectMessage === true,
    message: hasCorrectMessage
      ? 'Error message includes "Missing required parameter: suite_id"'
      : `Error message does not include expected text. Got: "${response1?.error?.message}"`,
  });
  if (testResults[testResults.length - 1].passed) testPass(testResults[testResults.length - 1].message); else testFail(testResults[testResults.length - 1].message);

  // Step 3: Verify all missing parameters are listed
  testStep(3, 'Verify all missing parameters are listed');
  const hasMissingParams = response1?.error?.data?.missingParameters && response1.error.data.missingParameters.length > 0;
  const suiteIdListed = response1?.error?.data?.missingParameters?.some(p => p.parameter === 'suite_id');

  testResults.push({
    passed: hasMissingParams === true && suiteIdListed === true,
    message: hasMissingParams && suiteIdListed
      ? `Missing parameters listed: ${response1?.error?.data?.missingParameters?.map(p => p.parameter).join(', ')}`
      : 'Missing parameters not properly listed',
  });
  if (testResults[testResults.length - 1].passed) testPass(testResults[testResults.length - 1].message); else testFail(testResults[testResults.length - 1].message);

  // Step 4: Verify parameter descriptions are included
  testStep(4, 'Verify parameter descriptions are included');
  const hasDescription = response1?.error?.data?.missingParameters?.some(
    p => p.description && p.description.length > 0
  );

  testResults.push({
    passed: hasDescription === true,
    message: hasDescription
      ? `Parameter descriptions included: "${response1?.error?.data?.missingParameters?.[0]?.description}"`
      : 'Parameter descriptions not included',
  });
  if (testResults[testResults.length - 1].passed) testPass(testResults[testResults.length - 1].message); else testFail(testResults[testResults.length - 1].message);

  // Step 5: Verify response code is -32602 (400 Bad Request equivalent)
  testStep(5, 'Verify response code is -32602 (Invalid params / 400)');
  const hasCorrectCode = response1?.error?.code === -32602;

  testResults.push({
    passed: hasCorrectCode,
    message: hasCorrectCode
      ? 'Error code is -32602 (Invalid params / 400 Bad Request equivalent)'
      : `Error code is ${response1?.error?.code}, expected -32602`,
  });
  if (testResults[testResults.length - 1].passed) testPass(testResults[testResults.length - 1].message); else testFail(testResults[testResults.length - 1].message);

  // Bonus test: Multiple missing required parameters
  testSection('Bonus: Test with tool requiring multiple parameters (create_test)');
  const response2 = await sendRequest(server, {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'create_test', arguments: {} } // Missing suite_id, name, type
  });

  testData('Response error', response2?.error);

  const hasMultipleMissing = response2?.error?.data?.missingParameters && response2.error.data.missingParameters.length >= 3;
  const messageHasPlural = response2?.error?.message?.includes('Missing required parameters:');

  if (hasMultipleMissing && messageHasPlural) {
    testPass('Multiple missing parameters correctly reported');
    testLog(`    Missing: ${response2?.error?.data?.missingParameters?.map(p => p.parameter).join(', ')}`);
  } else {
    testFail('Multiple missing parameters not correctly reported');
  }

  // Bonus test: Tool with all required params provided should work
  testSection('Bonus: Verify tool with all params passes validation');
  const response3 = await sendRequest(server, {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: { name: 'get_project', arguments: { project_id: 'test-123' } }
  });

  // This will fail with 404 (not found) because the project doesn't exist,
  // but it should NOT fail with -32602 (missing params)
  const passesValidation = response3?.error?.code !== -32602;
  testLog(`  Response code: ${response3?.error?.code}`);
  if (passesValidation) {
    testPass('Tool with all required params passes parameter validation');
  } else {
    testFail('Tool unexpectedly failed parameter validation');
  }

  // Check server logs for error message
  testSection('Server logs');
  const errorLogs = logs.filter(l => l.includes('[ERROR]') && l.includes('Missing required'));
  if (errorLogs.length > 0) {
    testPass('Server logged missing parameter errors:');
    errorLogs.forEach(log => testLog(`    ${log}`));
  } else {
    testLog('  - No missing parameter error logs found (may be in later output)');
  }

  // Cleanup
  server.kill('SIGTERM');

  // Summary
  testSection('Test Summary');

  const passed = testResults.filter(t => t.passed).length;
  const total = testResults.length;

  testResults.forEach((result, i) => {
    if (result.passed) {
      testPass(`Test ${i + 1}: ${result.message}`);
    } else {
      testFail(`Test ${i + 1}: ${result.message}`);
    }
  });

  testResult(passed, total);

  if (passed === total) {
    testLog('  - Error code is -32602 (Invalid params / 400 Bad Request)');
    testLog('  - Error message includes "Missing required parameter: {param}"');
    testLog('  - All missing parameters are listed');
    testLog('  - Parameter descriptions are included');
  }

  testExit(passed, total);
}

runTests().catch(err => {
  testFail(`Test error: ${err}`);
  process.exit(1);
});
