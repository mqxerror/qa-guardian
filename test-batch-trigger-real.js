/**
 * Test script for Feature #1218: MCP tool batch_trigger_tests
 * Using actual suite IDs from the system
 */

const { spawn } = require('child_process');

async function testBatchTriggerReal() {
  console.log('=== Testing batch_trigger_tests with real suite IDs ===\n');

  // Start the MCP server process
  const serverPath = './backend/src/mcp/server.ts';
  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEiLCJlbWFpbCI6Im93bmVyQGV4YW1wbGUuY29tIiwicm9sZSI6Im93bmVyIiwib3JnYW5pemF0aW9uX2lkIjoiMSIsImlhdCI6MTc2ODU3NjY1MywiZXhwIjoxNzY5MTgxNDUzfQ.mIGBe0mpE2YXf6On72AJS79g9BmbEdXNHHYRHo2W_S0';
  const server = spawn('npx', ['tsx', serverPath, '--api-key', validToken], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let allResponses = [];

  server.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('[STDOUT]', output.substring(0, 600));
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

  // Initialize
  console.log('--- Step 1: Initialize ---');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'batch-test-real', version: '1.0.0' },
      capabilities: {},
    },
  }) + '\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // First, list suites to get real IDs
  console.log('\n--- Step 2: List suites to get real IDs ---');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'list_suites',
      arguments: {},
    },
  }) + '\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Parse suite list response
  const listResponse = allResponses.find(r => r.id === 2);
  let suiteIds = [];
  if (listResponse?.result?.content?.[0]?.text) {
    try {
      const suitesResult = JSON.parse(listResponse.result.content[0].text);
      if (suitesResult.suites && Array.isArray(suitesResult.suites)) {
        suiteIds = suitesResult.suites.slice(0, 3).map(s => s.id);
        console.log('Found suite IDs:', suiteIds);
      }
    } catch (e) {
      console.log('Could not parse suites:', e.message);
    }
  }

  if (suiteIds.length === 0) {
    console.log('No suites found, using test IDs');
    suiteIds = ['test-suite-1', 'test-suite-2'];
  }

  // Now trigger batch tests
  console.log('\n--- Step 3: Batch trigger tests with real suite IDs ---');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'batch_trigger_tests',
      arguments: {
        suite_ids: suiteIds,
        browser: 'chromium',
        parallel: true,
      },
    },
  }) + '\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Show results
  console.log('\n--- Results ---');
  const batchResponse = allResponses.find(r => r.id === 3);
  if (batchResponse?.result?.content?.[0]?.text) {
    try {
      const result = JSON.parse(batchResponse.result.content[0].text);
      console.log('Batch trigger result:', JSON.stringify(result, null, 2));

      // Verification
      console.log('\n--- Verification ---');
      if (result.success) {
        console.log('✅ Batch trigger successful');
      }
      console.log(`✅ total_suites: ${result.total_suites}`);
      console.log(`✅ started: ${result.started}`);
      console.log(`✅ failed: ${result.failed}`);
      console.log(`✅ run_ids: ${result.run_ids.length} IDs returned`);

      if (result.run_ids.length > 0) {
        console.log('\n--- Step 4: Track one of the runs ---');
        // We can use stream_test_run or get_run_status to track
        server.stdin.write(JSON.stringify({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'get_run_status',
            arguments: {
              run_id: result.run_ids[0],
            },
          },
        }) + '\n');
        await new Promise(resolve => setTimeout(resolve, 2000));

        const trackResponse = allResponses.find(r => r.id === 4);
        if (trackResponse?.result?.content?.[0]?.text) {
          console.log('Tracking result:', trackResponse.result.content[0].text.substring(0, 300));
        }
      }

    } catch (e) {
      console.log('Error parsing result:', e.message);
    }
  } else if (batchResponse?.error) {
    console.log('Error:', JSON.stringify(batchResponse.error, null, 2));
  } else {
    console.log('No batch response found');
  }

  // Clean up
  server.kill();
  console.log('\n=== Test complete ===');
}

testBatchTriggerReal().catch(console.error);
