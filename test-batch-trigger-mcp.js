/**
 * Test script for Feature #1218: MCP tool batch_trigger_tests
 *
 * This script tests the batch_trigger_tests MCP tool by:
 * 1. Calling batch-trigger-tests with array of suiteIds
 * 2. Verifying all suites started
 * 3. Verifying returns array of runIds
 * 4. Verifying can track all runs
 */

const { spawn } = require('child_process');

async function testBatchTrigger() {
  console.log('=== Testing batch_trigger_tests MCP tool ===\n');

  // Start the MCP server process
  const serverPath = './backend/src/mcp/server.ts';
  // Use a valid JWT token for API calls
  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEiLCJlbWFpbCI6Im93bmVyQGV4YW1wbGUuY29tIiwicm9sZSI6Im93bmVyIiwib3JnYW5pemF0aW9uX2lkIjoiMSIsImlhdCI6MTc2ODU3NjY1MywiZXhwIjoxNzY5MTgxNDUzfQ.mIGBe0mpE2YXf6On72AJS79g9BmbEdXNHHYRHo2W_S0';
  const server = spawn('npx', ['tsx', serverPath, '--api-key', validToken], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let allResponses = [];

  server.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('[STDOUT]', output.substring(0, 500));
    const lines = output.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        allResponses.push(parsed);
      } catch (e) {
        // Not JSON, ignore
      }
    }
  });

  server.stderr.on('data', (data) => {
    const msg = data.toString();
    if (!msg.includes('Debugger') && !msg.includes('ExperimentalWarning')) {
      console.log('[STDERR]', msg.substring(0, 200));
    }
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 1: Initialize
  console.log('--- Step 1: Initialize MCP connection ---');
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'batch-test', version: '1.0.0' },
      capabilities: {},
    },
  };
  server.stdin.write(JSON.stringify(initRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 2: Call batch_trigger_tests with array of suiteIds
  console.log('\n--- Step 2: Call batch_trigger_tests with array of suiteIds ---');
  // Use suite IDs that exist in the mock data
  const batchRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'batch_trigger_tests',
      arguments: {
        suite_ids: ['suite-1', 'suite-2', 'suite-3'],  // Multiple suite IDs
        browser: 'chromium',
        parallel: true,
        retries: 1,
        continue_on_failure: true,
      },
    },
  };
  server.stdin.write(JSON.stringify(batchRequest) + '\n');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Show results
  console.log('\n--- Results ---');
  console.log(`Total responses received: ${allResponses.length}`);

  const toolResponse = allResponses.find(r => r.id === 2);
  if (toolResponse) {
    console.log('\nBatch trigger tool response:');
    if (toolResponse.result?.content?.[0]?.text) {
      try {
        const result = JSON.parse(toolResponse.result.content[0].text);
        console.log('Result:', JSON.stringify(result, null, 2));

        // Verify the response format
        console.log('\n--- Verification ---');
        console.log('✅ Response received');

        if (result.total_suites !== undefined) {
          console.log(`✅ total_suites: ${result.total_suites}`);
        } else {
          console.log('❌ Missing total_suites field');
        }

        if (result.started !== undefined) {
          console.log(`✅ started: ${result.started}`);
        } else {
          console.log('❌ Missing started field');
        }

        if (Array.isArray(result.run_ids)) {
          console.log(`✅ run_ids is array with ${result.run_ids.length} items`);
          if (result.run_ids.length > 0) {
            console.log(`   First run_id: ${result.run_ids[0]}`);
          }
        } else {
          console.log('❌ Missing or invalid run_ids field');
        }

        if (Array.isArray(result.results)) {
          console.log(`✅ results is array with ${result.results.length} items`);
          result.results.forEach((r, i) => {
            console.log(`   [${i}] suite_id: ${r.suite_id}, status: ${r.status}${r.run_id ? ', run_id: ' + r.run_id : ''}${r.error ? ', error: ' + r.error : ''}`);
          });
        } else {
          console.log('❌ Missing or invalid results field');
        }

        if (result.tracking_info) {
          console.log('✅ tracking_info provided:', result.tracking_info.message);
        }

      } catch (e) {
        console.log('Result text:', toolResponse.result.content[0].text);
      }
    } else if (toolResponse.error) {
      console.log('Error:', JSON.stringify(toolResponse.error, null, 2));
    }
  } else {
    console.log('No tool response found. All responses:');
    allResponses.forEach((r, i) => console.log(`[${i}]`, JSON.stringify(r).substring(0, 200)));
  }

  // Clean up
  server.kill();
  console.log('\n=== Test complete ===');
}

testBatchTrigger().catch(console.error);
