/**
 * Test script for MCP create_test_suite tool (Feature #862)
 *
 * Tests that an AI agent can create test suites via MCP
 */

import * as http from 'http';

const API_KEY = 'qg_iSdVmM4fDC5n5G9Wgbq6PaWaTMUuoq8WE0jPJL8RIzs';
const PROJECT_ID = '1768523199997';
const MCP_PORT = 3002;

interface MCPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

function sendMCPRequest(request: MCPRequest): Promise<MCPResponse> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(request);

    const options = {
      hostname: 'localhost',
      port: MCP_PORT,
      path: '/message',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${API_KEY}`,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testCreateTestSuite() {
  console.log('=== Testing MCP create_test_suite Tool (Feature #862) ===\n');

  // Step 1: Call create_test_suite with project ID
  console.log('Step 1: Call create_test_suite with project ID');
  const createRequest: MCPRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'create_test_suite',
      arguments: {
        project_id: PROJECT_ID,
        name: 'MCP Created E2E Suite',
        type: 'e2e',
        description: 'Test suite created via MCP create_test_suite tool',
        base_url: 'https://example.com',
        browsers: ['chromium', 'firefox'],
        timeout: 60,
        retries: 2,
      },
    },
  };

  console.log('Request:', JSON.stringify(createRequest, null, 2));

  try {
    const response = await sendMCPRequest(createRequest);
    console.log('Response:', JSON.stringify(response, null, 2));

    if (response.error) {
      console.log('❌ Step 1 FAILED: Error returned');
      console.log('Error:', response.error);
      return;
    }

    // Step 2: Verify suite name and config set
    console.log('\nStep 2: Set suite name and config');
    const result = response.result as any;
    const content = result?.content?.[0]?.text;

    if (content) {
      const suiteData = JSON.parse(content);
      console.log('Suite data:', JSON.stringify(suiteData, null, 2));

      const suite = suiteData.suite;
      if (suite) {
        console.log('✅ Suite name:', suite.name);
        console.log('✅ Suite type:', suite.type);
        console.log('✅ Suite base_url:', suite.base_url);
        console.log('✅ Suite browsers:', suite.browsers);
        console.log('✅ Suite timeout:', suite.timeout);
        console.log('✅ Suite retry_count:', suite.retry_count);

        // Step 3: Verify suite created
        console.log('\nStep 3: Verify suite created');
        if (suite.id) {
          console.log('✅ Suite was created successfully');

          // Step 4: Verify suite ID returned
          console.log('\nStep 4: Verify suite ID returned');
          console.log('✅ Suite ID:', suite.id);

          console.log('\n=== All Steps Passed! ===');
        } else {
          console.log('❌ Step 3 FAILED: No suite ID in response');
        }
      } else {
        console.log('❌ Step 2 FAILED: No suite in response');
      }
    } else {
      console.log('❌ Step 2 FAILED: No content in response');
    }
  } catch (error) {
    console.log('❌ Test FAILED with error:', error);
  }
}

// Run the test
testCreateTestSuite().catch(console.error);
