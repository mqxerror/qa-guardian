/**
 * Test script for Feature #1217: MCP tool subscribe_to_alerts
 *
 * This script tests the subscribe_to_alerts MCP tool by:
 * 1. Subscribing to alerts with filters
 * 2. Verifying subscription is created
 * 3. Verifying alerts are received in real-time (via streaming notifications)
 * 4. Testing unsubscribe functionality
 */

const { spawn } = require('child_process');

async function testAlertSubscription() {
  console.log('=== Testing subscribe_to_alerts MCP tool ===\n');

  // Start the MCP server process
  const serverPath = './backend/src/mcp/server.ts';
  // Use a valid JWT token for API calls
  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEiLCJlbWFpbCI6Im93bmVyQGV4YW1wbGUuY29tIiwicm9sZSI6Im93bmVyIiwib3JnYW5pemF0aW9uX2lkIjoiMSIsImlhdCI6MTc2ODU3NjY1MywiZXhwIjoxNzY5MTgxNDUzfQ.mIGBe0mpE2YXf6On72AJS79g9BmbEdXNHHYRHo2W_S0';
  const server = spawn('npx', ['tsx', serverPath, '--api-key', validToken], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let allResponses = [];
  let subscriptionId = null;

  server.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('[STDOUT]', output.substring(0, 500));
    const lines = output.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        allResponses.push(parsed);

        // Extract subscription ID from streaming notification
        if (parsed.method === 'notifications/stream/chunk' &&
            parsed.params?.data?.[0]?.subscription_id) {
          subscriptionId = parsed.params.data[0].subscription_id;
          console.log(`[INFO] Got subscription ID: ${subscriptionId}`);
        }
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
      clientInfo: { name: 'alert-sub-test', version: '1.0.0' },
      capabilities: {},
    },
  };
  server.stdin.write(JSON.stringify(initRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 2: Subscribe to alerts with filters
  console.log('\n--- Step 2: Subscribe to alerts with filters ---');
  const subscribeRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'subscribe_to_alerts',
      arguments: {
        severity: ['critical', 'high'],
        source: ['uptime', 'test_failure'],
        poll_interval_ms: 2000,
        timeout_ms: 10000, // Short timeout for test
        include_resolved: true,
      },
    },
  };
  server.stdin.write(JSON.stringify(subscribeRequest) + '\n');

  // Wait for initial subscription confirmation
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Step 3: Check subscription was created
  console.log('\n--- Step 3: Verify subscription created ---');
  const streamNotifications = allResponses.filter(r => r.method === 'notifications/stream/chunk');
  console.log(`Received ${streamNotifications.length} streaming notifications`);

  if (streamNotifications.length > 0) {
    const startEvent = streamNotifications.find(n =>
      n.params?.data?.[0]?.event_type === 'subscription_started'
    );
    if (startEvent) {
      console.log('✅ Subscription started event received:');
      console.log(JSON.stringify(startEvent.params.data[0], null, 2));
    }

    const activeAlerts = streamNotifications.find(n =>
      n.params?.data?.[0]?.event_type === 'active_alert'
    );
    if (activeAlerts) {
      console.log('✅ Active alerts received:');
      console.log(`  Count: ${activeAlerts.params.data.length} alerts`);
    }
  }

  // Step 4: Test unsubscribe (if we have a subscription ID)
  if (subscriptionId) {
    console.log('\n--- Step 4: Test unsubscribe ---');
    const unsubscribeRequest = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'unsubscribe_from_alerts',
        arguments: {
          subscription_id: subscriptionId,
        },
      },
    };
    server.stdin.write(JSON.stringify(unsubscribeRequest) + '\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const unsubResponse = allResponses.find(r => r.id === 3);
    if (unsubResponse?.result?.content?.[0]?.text) {
      try {
        const result = JSON.parse(unsubResponse.result.content[0].text);
        console.log('Unsubscribe result:', JSON.stringify(result, null, 2));
      } catch (e) {
        console.log('Unsubscribe response:', unsubResponse.result.content[0].text);
      }
    }
  } else {
    // Wait for subscription to timeout naturally
    console.log('\n--- Step 4: Wait for subscription timeout ---');
    await new Promise(resolve => setTimeout(resolve, 8000));
  }

  // Show final results
  console.log('\n--- Results ---');
  console.log(`Total responses received: ${allResponses.length}`);

  // Show the tool call response
  const toolResponse = allResponses.find(r => r.id === 2);
  if (toolResponse) {
    console.log('\nSubscribe tool response:');
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
    console.log('No tool response found yet (subscription may still be active).');
    console.log('All responses:');
    allResponses.forEach((r, i) => console.log(`[${i}]`, JSON.stringify(r).substring(0, 200)));
  }

  // Clean up
  server.kill();
  console.log('\n=== Test complete ===');
}

testAlertSubscription().catch(console.error);
