/**
 * Test script for Feature #1219: MCP tool create_workflow
 *
 * This script tests the create_workflow MCP tool by:
 * 1. Calling create-workflow with steps definition
 * 2. Verifying workflow created
 * 3. Verifying steps validated
 * 4. Verifying workflow ID returned
 */

const { spawn } = require('child_process');

async function testCreateWorkflow() {
  console.log('=== Testing create_workflow MCP tool ===\n');

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

  // Initialize
  console.log('--- Step 1: Initialize MCP connection ---');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'workflow-test', version: '1.0.0' },
      capabilities: {},
    },
  }) + '\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 1: Create a valid workflow
  console.log('\n--- Step 2: Create a valid workflow with multiple steps ---');
  const createWorkflowRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'create_workflow',
      arguments: {
        name: 'Daily Regression Tests',
        description: 'Runs regression tests daily and sends alerts on failure',
        steps: [
          {
            name: 'Trigger Login Tests',
            tool: 'batch_trigger_tests',
            arguments: {
              suite_ids: ['${vars.login_suite_id}', '${vars.auth_suite_id}'],
              browser: 'chromium',
            },
            on_failure: 'continue',
            timeout_ms: 120000,
          },
          {
            name: 'Check Test Results',
            tool: 'get_run_status',
            arguments: {
              run_id: '${steps.0.run_ids[0]}',
            },
            condition: '${steps.0.success} === true',
            on_failure: 'stop',
          },
          {
            name: 'Subscribe to Alerts',
            tool: 'subscribe_to_alerts',
            arguments: {
              severity: ['critical', 'high'],
              timeout_ms: 60000,
            },
            on_failure: 'skip_remaining',
            retry_count: 2,
          },
        ],
        triggers: {
          schedule: '0 6 * * *',  // Daily at 6 AM
          manual: true,
        },
        variables: {
          login_suite_id: 'suite-login',
          auth_suite_id: 'suite-auth',
        },
      },
    },
  };
  server.stdin.write(JSON.stringify(createWorkflowRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Show result
  const createResponse = allResponses.find(r => r.id === 2);
  if (createResponse?.result?.content?.[0]?.text) {
    try {
      const result = JSON.parse(createResponse.result.content[0].text);
      console.log('\nWorkflow creation result:', JSON.stringify(result, null, 2));

      // Verification
      console.log('\n--- Verification ---');
      if (result.success) {
        console.log('✅ Workflow created successfully');
      } else {
        console.log('❌ Workflow creation failed:', result.error);
      }

      if (result.workflow_id) {
        console.log(`✅ Workflow ID returned: ${result.workflow_id}`);
      } else {
        console.log('❌ No workflow ID returned');
      }

      if (result.steps_count > 0) {
        console.log(`✅ Steps validated: ${result.steps_count} steps`);
      }

      if (result.steps && Array.isArray(result.steps)) {
        console.log('✅ Steps details included:');
        result.steps.forEach((s, i) => {
          console.log(`   [${i}] ${s.name}: ${s.tool} (on_failure: ${s.on_failure})`);
        });
      }
    } catch (e) {
      console.log('Result text:', createResponse.result.content[0].text);
    }
  } else if (createResponse?.error) {
    console.log('Error:', JSON.stringify(createResponse.error, null, 2));
  }

  // Test 2: Try to create workflow with invalid tool
  console.log('\n--- Step 3: Test validation with invalid tool ---');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'create_workflow',
      arguments: {
        name: 'Invalid Workflow',
        steps: [
          {
            name: 'Bad Step',
            tool: 'nonexistent_tool',
            arguments: { foo: 'bar' },
          },
        ],
      },
    },
  }) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const invalidResponse = allResponses.find(r => r.id === 3);
  if (invalidResponse?.result?.content?.[0]?.text) {
    try {
      const result = JSON.parse(invalidResponse.result.content[0].text);
      console.log('\nInvalid workflow result:', JSON.stringify(result, null, 2));
      if (result.validation_errors) {
        console.log('✅ Validation correctly rejected invalid tool');
      }
    } catch (e) {
      console.log('Result text:', invalidResponse.result.content[0].text);
    }
  }

  // Clean up
  server.kill();
  console.log('\n=== Test complete ===');
}

testCreateWorkflow().catch(console.error);
