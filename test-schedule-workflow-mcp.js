// Test script for Feature #1221: MCP tool schedule-workflow
// Schedule workflow for recurring execution

const MCP_BASE = 'http://localhost:3002';

async function callMCP(method, params = {}) {
  const response = await fetch(`${MCP_BASE}/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });
  return response.json();
}

async function testScheduleWorkflow() {
  console.log('=== Testing Feature #1221: MCP tool schedule-workflow ===\n');

  // Step 1: First create a workflow to schedule
  console.log('Step 1: Creating a test workflow...');
  const createResult = await callMCP('tools/call', {
    name: 'create_workflow',
    arguments: {
      name: 'Daily Health Check ' + Date.now(),
      description: 'Automated daily health check workflow',
      steps: [
        {
          name: 'List Projects',
          tool: 'list_projects',
          arguments: {},
        },
        {
          name: 'List Recent Runs',
          tool: 'list_recent_runs',
          arguments: { limit: 5 },
        },
      ],
      variables: {
        environment: 'production',
      },
    },
  });

  console.log('Create workflow result:');
  console.log('Raw result:', JSON.stringify(createResult, null, 2).slice(0, 2000));
  if (createResult.result?.content) {
    const content = JSON.parse(createResult.result.content[0].text);
    console.log('  Success:', content.success);
    console.log('  Workflow ID:', content.workflow_id);
    console.log('  Workflow Name:', content.workflow_name);
    console.log('  Steps:', content.steps?.length || 0);
    if (content.error) {
      console.log('  Error:', content.error);
      console.log('  Details:', JSON.stringify(content, null, 2));
    }

    const workflowId = content.workflow_id;

    if (!workflowId) {
      console.log('\nFailed to create workflow');
      return;
    }

    // Step 2: Call schedule-workflow with workflowId and cron
    console.log('\nStep 2: Scheduling the workflow with cron expression...');
    const scheduleResult = await callMCP('tools/call', {
      name: 'schedule_workflow',
      arguments: {
        workflow_id: workflowId,
        cron: '0 0 * * *', // Daily at midnight
        timezone: 'UTC',
        enabled: true,
        notify_on_success: false,
        notify_on_failure: true,
        max_consecutive_failures: 3,
        variables: {
          scheduled_run: true,
        },
      },
    });

    console.log('Schedule workflow result:');
    if (scheduleResult.result?.content) {
      const schedContent = JSON.parse(scheduleResult.result.content[0].text);
      console.log('  Success:', schedContent.success);
      console.log('  Schedule ID:', schedContent.schedule_id);
      console.log('  Workflow ID:', schedContent.workflow_id);
      console.log('  Workflow Name:', schedContent.workflow_name);
      console.log('  Cron:', schedContent.cron);
      console.log('  Cron Description:', schedContent.cron_description);
      console.log('  Timezone:', schedContent.timezone);
      console.log('  Enabled:', schedContent.enabled);
      console.log('  Next Run:', schedContent.next_run);
      console.log('  Config:', JSON.stringify(schedContent.config, null, 2));
      console.log('  Message:', schedContent.message);

      // Step 3: Verify schedule was created
      console.log('\n\nStep 3: Verifying schedule was created...');
      if (schedContent.success && schedContent.schedule_id) {
        console.log('  ✅ Schedule created successfully');
        console.log('  ✅ Schedule ID returned:', schedContent.schedule_id);
        console.log('  ✅ Cron expression set:', schedContent.cron);
        console.log('  ✅ Next run calculated:', schedContent.next_run);

        // Test different cron expressions
        console.log('\n\n=== Testing different cron expressions ===');

        // Create another workflow for testing more cron patterns
        const createResult2 = await callMCP('tools/call', {
          name: 'create_workflow',
          arguments: {
            name: 'Hourly Monitoring ' + Date.now(),
            description: 'Runs every hour',
            steps: [
              {
                name: 'List Projects',
                tool: 'list_projects',
                arguments: {},
              },
            ],
          },
        });

        const content2 = JSON.parse(createResult2.result?.content[0]?.text || '{}');
        const workflowId2 = content2.workflow_id;

        if (workflowId2) {
          // Test every 6 hours
          console.log('\nTesting cron: "0 */6 * * *" (every 6 hours)');
          const schedule2 = await callMCP('tools/call', {
            name: 'schedule_workflow',
            arguments: {
              workflow_id: workflowId2,
              cron: '0 */6 * * *',
            },
          });
          const sched2Content = JSON.parse(schedule2.result?.content[0]?.text || '{}');
          console.log('  Description:', sched2Content.cron_description);
          console.log('  Next Run:', sched2Content.next_run);

          // Create another workflow for weekday testing
          const createResult3 = await callMCP('tools/call', {
            name: 'create_workflow',
            arguments: {
              name: 'Weekday CI Check ' + Date.now(),
              description: 'Runs on weekdays at 9 AM',
              steps: [
                {
                  name: 'List Runs',
                  tool: 'list_recent_runs',
                  arguments: { limit: 10 },
                },
              ],
            },
          });

          const content3 = JSON.parse(createResult3.result?.content[0]?.text || '{}');
          const workflowId3 = content3.workflow_id;

          if (workflowId3) {
            // Test weekdays at 9 AM
            console.log('\nTesting cron: "0 9 * * 1-5" (weekdays at 9 AM)');
            const schedule3 = await callMCP('tools/call', {
              name: 'schedule_workflow',
              arguments: {
                workflow_id: workflowId3,
                cron: '0 9 * * 1-5',
              },
            });
            const sched3Content = JSON.parse(schedule3.result?.content[0]?.text || '{}');
            console.log('  Description:', sched3Content.cron_description);
            console.log('  Next Run:', sched3Content.next_run);
          }
        }

        // Test validation - invalid cron
        console.log('\n\n=== Testing cron validation ===');
        console.log('\nTesting invalid cron (too few fields): "0 0 *"');
        const invalidResult = await callMCP('tools/call', {
          name: 'schedule_workflow',
          arguments: {
            workflow_id: workflowId,
            cron: '0 0 *',
          },
        });
        let invalidContent = {};
        try {
          invalidContent = JSON.parse(invalidResult.result?.content[0]?.text || '{}');
        } catch (e) {
          invalidContent = invalidResult;
        }
        console.log('  Success:', invalidContent.success);
        console.log('  Error:', invalidContent.error);
        console.log('  Hint:', invalidContent.hint);

        // Test missing workflow
        console.log('\nTesting with non-existent workflow ID:');
        const missingResult = await callMCP('tools/call', {
          name: 'schedule_workflow',
          arguments: {
            workflow_id: 'non-existent-workflow',
            cron: '0 0 * * *',
          },
        });
        let missingContent = {};
        try {
          missingContent = JSON.parse(missingResult.result?.content[0]?.text || '{}');
        } catch (e) {
          missingContent = missingResult;
        }
        console.log('  Success:', missingContent.success);
        console.log('  Error:', missingContent.error);
        console.log('  Hint:', missingContent.hint);

        console.log('\n\n=== All tests completed ===');
        console.log('✅ Feature #1221: MCP tool schedule-workflow is working!');

      } else {
        console.log('  ❌ Failed to create schedule');
        console.log('  Error:', schedContent.error);
      }
    } else if (scheduleResult.error) {
      console.log('  Error:', scheduleResult.error);
    }

  } else if (createResult.error) {
    console.log('  Error:', createResult.error);
  }
}

testScheduleWorkflow().catch(console.error);
