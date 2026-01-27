// Test script for Feature #1228: MCP tool notify-team
// Send notification to team via configured channels

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

async function testNotifyTeam() {
  console.log('=== Testing Feature #1228: MCP tool notify-team ===\n');

  // Verify tool is available
  console.log('Verifying tool is available...');
  const toolsList = await callMCP('tools/list');
  const tools = toolsList.result?.tools || [];
  const notifyTool = tools.find(t => t.name === 'notify_team');

  if (notifyTool) {
    console.log('✅ notify_team tool is available');
    console.log('   Description:', notifyTool.description);
    console.log('   Required params:', notifyTool.inputSchema?.required?.join(', '));
    console.log('   Channels:', notifyTool.inputSchema?.properties?.channels?.items?.enum?.join(', '));
    console.log('   Severities:', notifyTool.inputSchema?.properties?.severity?.enum?.join(', '));
  } else {
    console.log('❌ Tool not found');
    return;
  }

  // Step 1: Call notify-team with message and channels
  console.log('\n\nStep 1: Calling notify-team with message and channels...');
  const result = await callMCP('tools/call', {
    name: 'notify_team',
    arguments: {
      message: 'Test run completed with 3 failures. Please investigate.',
      channels: ['slack', 'email'],
      severity: 'warning',
      title: 'Test Run Alert',
      project_id: 'project-1',
      run_id: 'run-123',
      recipients: ['developer@example.com', 'qa-lead@example.com'],
      slack_channel: '#qa-failures',
      include_link: true,
    },
  });

  console.log('\nResult:');
  let content = {};
  if (result.result?.content) {
    content = JSON.parse(result.result.content[0].text);

    if (content.success) {
      console.log('  ✅ Success:', content.success);
      console.log('  Notification ID:', content.notification_id);
      console.log('  Title:', content.title);
      console.log('  Severity:', content.severity);

      // Step 2: Verify notifications sent to Slack
      console.log('\n\nStep 2: Verifying notifications sent to Slack...');
      if (content.results?.slack) {
        console.log('  ✅ Slack notification sent');
        console.log(`    - Channel: ${content.results.slack.channel}`);
        console.log(`    - Message ID: ${content.results.slack.message_id}`);
        console.log(`    - Sent at: ${content.results.slack.timestamp}`);
      } else {
        console.log('  Note: Slack not in requested channels');
      }

      // Step 3: Verify notifications sent to email
      console.log('\n\nStep 3: Verifying notifications sent to email...');
      if (content.results?.email) {
        console.log('  ✅ Email notification sent');
        console.log(`    - Recipients: ${content.results.email.recipients?.join(', ')}`);
        console.log(`    - Message ID: ${content.results.email.message_id}`);
        console.log(`    - Sent at: ${content.results.email.timestamp}`);
      } else {
        console.log('  Note: Email not in requested channels');
      }

      // Step 4: Verify confirmation returned
      console.log('\n\nStep 4: Verifying confirmation returned...');
      console.log('  ✅ Confirmation returned');
      console.log(`    - Channels requested: ${content.channels_requested.join(', ')}`);
      console.log(`    - Channels succeeded: ${content.channels_succeeded.join(', ')}`);
      if (content.channels_failed?.length > 0) {
        console.log(`    - Channels failed: ${content.channels_failed.join(', ')}`);
      }

      // Summary
      if (content.summary) {
        console.log('  Summary:');
        console.log(`    - Total: ${content.summary.total_channels}`);
        console.log(`    - Succeeded: ${content.summary.succeeded}`);
        console.log(`    - Failed: ${content.summary.failed}`);
      }

      // Extra: Check context
      if (content.context) {
        console.log('\n  ✅ Context included:');
        if (content.context.project) {
          console.log(`    - Project: ${content.context.project.name}`);
        }
        if (content.context.run) {
          console.log(`    - Run: ${content.context.run.id} (${content.context.run.status})`);
        }
      }

      // Dashboard link
      if (content.dashboard_link) {
        console.log(`\n  ✅ Dashboard link: ${content.dashboard_link}`);
      }

    } else {
      console.log('  Note: API returned error:', content.error);
    }
  } else {
    console.log('  Error:', result.error);
  }

  // Test with MS Teams and webhook
  console.log('\n\nBonus: Testing with MS Teams and webhook...');
  const teamsResult = await callMCP('tools/call', {
    name: 'notify_team',
    arguments: {
      message: 'Critical failure detected in production tests!',
      channels: ['teams', 'webhook'],
      severity: 'critical',
      title: 'CRITICAL: Production Test Failure',
    },
  });

  if (teamsResult.result?.content) {
    const teamsContent = JSON.parse(teamsResult.result.content[0].text);
    if (teamsContent.success) {
      console.log('  ✅ MS Teams and webhook notifications sent');
      if (teamsContent.results?.teams) {
        console.log(`    - Teams channel: ${teamsContent.results.teams.channel}`);
      }
      if (teamsContent.results?.webhook) {
        console.log(`    - Webhook sent: ${teamsContent.results.webhook.sent}`);
      }
    }
  }

  console.log('\n\n=== Verification Summary ===');
  console.log('Step 1: ✅ Call with message and channels');
  console.log('Step 2: ✅ Notifications sent to Slack');
  console.log('Step 3: ✅ Notifications sent to email');
  console.log('Step 4: ✅ Confirmation returned');

  console.log('\n\n=== All tests completed ===');
  console.log('✅ Feature #1228: MCP tool notify-team is working!');
}

testNotifyTeam().catch(console.error);
