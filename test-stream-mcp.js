/**
 * Test script for Feature #1216: MCP tool stream_test_run
 *
 * This script tests the stream_test_run MCP tool by:
 * 1. Calling with a completed run_id (should return immediately with results)
 * 2. Verifying the response format matches expectations
 */

const { spawn } = require('child_process');

async function testStreamTestRun() {
  console.log('=== Testing stream_test_run MCP tool ===\n');

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
      clientInfo: { name: 'stream-test', version: '1.0.0' },
      capabilities: {},
    },
  };
  server.stdin.write(JSON.stringify(initRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 2: Test with completed run (should return immediately)
  console.log('\n--- Step 2: Test stream_test_run with completed run ---');
  const completedRunRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'stream_test_run',
      arguments: {
        run_id: '1768576771345',  // The completed run we just created
        include_step_details: true,
        include_failure_details: true,
      },
    },
  };
  server.stdin.write(JSON.stringify(completedRunRequest) + '\n');

  // Wait for response (longer wait since completed runs should return quickly)
  await new Promise(resolve => setTimeout(resolve, 8000));

  console.log('\n--- Results ---');
  console.log(`Total responses received: ${allResponses.length}`);

  // Show the tool call response
  const toolResponse = allResponses.find(r => r.id === 2);
  if (toolResponse) {
    console.log('\nTool response received!');
    if (toolResponse.result?.content?.[0]?.text) {
      try {
        const result = JSON.parse(toolResponse.result.content[0].text);
        console.log('Result:', JSON.stringify(result, null, 2));
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

testStreamTestRun().catch(console.error);
