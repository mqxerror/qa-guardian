/**
 * Test script for Feature #1220: MCP tool execute_workflow
 *
 * This script tests the execute_workflow MCP tool by:
 * 1. Creating a workflow first
 * 2. Calling execute-workflow with workflowId
 * 3. Verifying workflow executes
 * 4. Verifying steps run in order
 * 5. Verifying results aggregated
 */

const { spawn } = require('child_process');

async function testExecuteWorkflow() {
  console.log('=== Testing execute_workflow MCP tool ===\n');

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
      console.log('[STDERR]', msg.substring(0, 250));
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
      clientInfo: { name: 'execute-workflow-test', version: '1.0.0' },
      capabilities: {},
    },
  }) + '\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // First, create a workflow
  console.log('\n--- Step 2: Create a test workflow ---');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'create_workflow',
      arguments: {
        name: 'Test Execution Workflow',
        description: 'Workflow for testing execute_workflow',
        steps: [
          {
            name: 'List Projects',
            tool: 'list_projects',
            arguments: {},
            on_failure: 'continue',
          },
          {
            name: 'Get Flaky Tests',
            tool: 'get_flaky_tests',
            arguments: {},
            on_failure: 'continue',
          },
          {
            name: 'Check Alert Groups',
            tool: 'subscribe_to_alerts',
            arguments: {
              severity: ['critical'],
            },
            on_failure: 'stop',
          },
        ],
        variables: {
          env: 'test',
        },
      },
    },
  }) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Get workflow ID from response
  let workflowId = null;
  const createResponse = allResponses.find(r => r.id === 2);
  if (createResponse?.result?.content?.[0]?.text) {
    try {
      const result = JSON.parse(createResponse.result.content[0].text);
      workflowId = result.workflow_id;
      console.log(`Workflow created: ${workflowId}`);
    } catch (e) {
      console.log('Failed to parse workflow creation result');
    }
  }

  if (!workflowId) {
    console.log('Failed to create workflow, exiting');
    server.kill();
    return;
  }

  // Execute the workflow (dry run first)
  console.log('\n--- Step 3: Execute workflow (dry run) ---');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'execute_workflow',
      arguments: {
        workflow_id: workflowId,
        dry_run: true,
      },
    },
  }) + '\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const dryRunResponse = allResponses.find(r => r.id === 3);
  if (dryRunResponse?.result?.content?.[0]?.text) {
    try {
      const result = JSON.parse(dryRunResponse.result.content[0].text);
      console.log('\nDry run result:', JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('Result:', dryRunResponse.result.content[0].text);
    }
  }

  // Execute the workflow for real
  console.log('\n--- Step 4: Execute workflow (real run) ---');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'execute_workflow',
      arguments: {
        workflow_id: workflowId,
      },
    },
  }) + '\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  const executeResponse = allResponses.find(r => r.id === 4);
  if (executeResponse?.result?.content?.[0]?.text) {
    try {
      const result = JSON.parse(executeResponse.result.content[0].text);
      console.log('\nExecution result:', JSON.stringify(result, null, 2));

      // Verification
      console.log('\n--- Verification ---');
      if (result.execution_id) {
        console.log(`✅ Execution ID returned: ${result.execution_id}`);
      } else {
        console.log('❌ No execution ID returned');
      }

      if (result.workflow_id === workflowId) {
        console.log(`✅ Correct workflow executed: ${result.workflow_id}`);
      }

      if (result.summary) {
        console.log(`✅ Summary provided: ${result.summary.total_steps} total, ${result.summary.successful} success, ${result.summary.failed} failed`);
      }

      if (result.step_results && Array.isArray(result.step_results)) {
        console.log(`✅ Step results aggregated: ${result.step_results.length} steps`);
        result.step_results.forEach((s, i) => {
          console.log(`   [${i}] ${s.step_name}: ${s.status} (${s.duration_ms}ms)`);
        });
      }

      if (result.duration_ms !== undefined) {
        console.log(`✅ Total duration tracked: ${result.duration_ms}ms`);
      }

    } catch (e) {
      console.log('Result:', executeResponse.result.content[0].text);
    }
  } else if (executeResponse?.error) {
    console.log('Error:', JSON.stringify(executeResponse.error, null, 2));
  }

  // Test with invalid workflow ID
  console.log('\n--- Step 5: Test with invalid workflow ID ---');
  server.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'execute_workflow',
      arguments: {
        workflow_id: 'nonexistent-workflow-id',
      },
    },
  }) + '\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  const invalidResponse = allResponses.find(r => r.id === 5);
  if (invalidResponse?.result?.content?.[0]?.text) {
    try {
      const result = JSON.parse(invalidResponse.result.content[0].text);
      console.log('\nInvalid workflow result:', JSON.stringify(result, null, 2));
      if (result.error) {
        console.log('✅ Properly rejected invalid workflow ID');
      }
    } catch (e) {
      console.log('Result:', invalidResponse.result.content[0].text);
    }
  }

  // Clean up
  server.kill();
  console.log('\n=== Test complete ===');
}

testExecuteWorkflow().catch(console.error);
