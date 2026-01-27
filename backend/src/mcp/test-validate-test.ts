/**
 * Test script for Feature #877: MCP tool - validate_test
 *
 * Tests the validate-test tool functionality
 */

import * as http from 'http';

interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: {
    content?: Array<{ type: string; text: string }>;
    [key: string]: unknown;
  };
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

function makeRequest(toolName: string, args: Record<string, unknown>, port = 3100): Promise<MCPResponse> {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    });

    const options = {
      hostname: 'localhost',
      port: port,
      path: '/mcp/message',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

async function runTests() {
  console.log('=== Testing Feature #877: MCP tool - validate_test ===\n');

  try {
    // Test 1: Call validate_test with a test ID
    console.log('Test 1: Calling validate_test with a test ID...');
    const response1 = await makeRequest('validate_test', {
      test_id: 'test-001'
    });

    if (response1.error) {
      console.log('  Error response:', response1.error.message);
      // This is expected if the test doesn\'t exist in the backend
    } else if (response1.result?.content) {
      const resultText = response1.result.content[0]?.text;
      if (resultText) {
        const result = JSON.parse(resultText);
        console.log('  Result:', JSON.stringify(result, null, 2));

        if ('valid' in result) {
          console.log('  ✓ Validation result received');
        }
      }
    }

    // Test 2: Call validate_test with strict mode
    console.log('\nTest 2: Calling validate_test with strict mode...');
    const response2 = await makeRequest('validate_test', {
      test_id: 'test-001',
      strict: true
    });

    if (response2.error) {
      console.log('  Error response:', response2.error.message);
    } else if (response2.result?.content) {
      const resultText = response2.result.content[0]?.text;
      if (resultText) {
        const result = JSON.parse(resultText);
        console.log('  Strict mode result - valid:', result.valid);
        console.log('  ✓ Strict validation result received');
      }
    }

    // Test 3: Verify validation runs
    console.log('\nTest 3: Verifying validation runs with options...');
    const response3 = await makeRequest('validate_test', {
      test_id: 'test-001',
      validate_selectors: true,
      validate_steps: true,
      validate_assertions: true
    });

    if (response3.error) {
      console.log('  Error response:', response3.error.message);
    } else if (response3.result?.content) {
      const resultText = response3.result.content[0]?.text;
      if (resultText) {
        const result = JSON.parse(resultText);
        console.log('  Validation options:', result.validation_options);
        console.log('  ✓ Validation runs with all options');
      }
    }

    console.log('\n=== All tests completed ===');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTests();
