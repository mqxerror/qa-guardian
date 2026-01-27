// Test script for Feature #1231: MCP tool validate-api-key
// Check API key permissions and validity

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

async function testValidateApiKey() {
  console.log('=== Testing Feature #1231: MCP tool validate-api-key ===\n');

  // Verify tool is available
  console.log('Verifying tool is available...');
  const toolsList = await callMCP('tools/list');
  const tools = toolsList.result?.tools || [];
  const validateTool = tools.find(t => t.name === 'validate_api_key');

  if (validateTool) {
    console.log('validate_api_key tool is available');
    console.log('   Description:', validateTool.description);
  } else {
    console.log('Tool not found');
    process.exit(1);
  }

  // Step 1: Call validate-api-key
  console.log('\n\nStep 1: Calling validate-api-key...');
  const result = await callMCP('tools/call', {
    name: 'validate_api_key',
    arguments: {
      include_usage_stats: true,
      include_rate_limits: true,
    },
  });

  console.log('\nResult:');
  let content = {};
  if (result.result?.content) {
    content = JSON.parse(result.result.content[0].text);

    if (content.success) {
      console.log('  Success:', content.success);

      // Step 2: Verify returns key status
      console.log('\n\nStep 2: Verifying returns key status...');
      if (content.key_status) {
        console.log('  Key status returned:', content.key_status);
        console.log('     - Is authenticated:', content.is_authenticated);
        console.log('     - Key ID:', content.key_id || 'N/A');
        console.log('     - Permission level:', content.permission_level);
        console.log('     - Validated at:', content.validated_at);
      } else {
        console.log('  Key status missing');
        process.exit(1);
      }

      // Step 3: Verify returns scopes/permissions
      console.log('\n\nStep 3: Verifying returns scopes/permissions...');
      if (content.scopes && content.scopes.length > 0) {
        console.log('  Scopes returned:', content.scopes.join(', '));
        console.log('     - Permission level:', content.permission_level);
        console.log('     - Accessible tools:', content.accessible_tools);
        console.log('     - Total tools:', content.total_tools);
      } else {
        console.log('  Scopes missing');
        process.exit(1);
      }

      // Step 4: Verify returns rate limit status
      console.log('\n\nStep 4: Verifying returns rate limit status...');
      if (content.rate_limit) {
        console.log('  Rate limit status returned:');
        console.log('     - Max requests:', content.rate_limit.max_requests);
        console.log('     - Window (seconds):', content.rate_limit.window_seconds);
        console.log('     - Burst limit:', content.rate_limit.burst_limit);
        console.log('     - Requests remaining:', content.rate_limit.requests_remaining);
        console.log('     - Reset at:', content.rate_limit.reset_at);
        console.log('     - Is limited:', content.rate_limit.is_limited);
      } else {
        console.log('  Rate limit status missing');
        process.exit(1);
      }

      // Bonus: Check usage stats
      if (content.usage_stats) {
        console.log('\n  Bonus - Usage stats:');
        console.log('     - Requests today:', content.usage_stats.requests_today);
        console.log('     - Requests this week:', content.usage_stats.requests_this_week);
        console.log('     - Tools used:', content.usage_stats.tools_used);
        console.log('     - Most used tools:');
        content.usage_stats.most_used_tools?.forEach(t => {
          console.log('       * ' + t.name + ': ' + t.count + ' calls');
        });
        console.log('     - Last request:', content.usage_stats.last_request_at);
      }

    } else {
      console.log('  Note: API returned error:', content.error);
      process.exit(1);
    }
  } else {
    console.log('  Error:', result.error);
    process.exit(1);
  }

  // Test scope testing feature
  console.log('\n\nBonus: Testing scope verification...');
  const scopeResult = await callMCP('tools/call', {
    name: 'validate_api_key',
    arguments: {
      test_scopes: ['mcp:read', 'mcp:write', 'mcp:execute', 'admin'],
      include_usage_stats: false,
      include_rate_limits: false,
    },
  });

  if (scopeResult.result?.content) {
    const scopeContent = JSON.parse(scopeResult.result.content[0].text);
    if (scopeContent.success && scopeContent.scope_test_results) {
      console.log('  Scope testing works');
      console.log('  Scope test results:');
      for (const [scope, hasAccess] of Object.entries(scopeContent.scope_test_results)) {
        console.log('    - ' + scope + ': ' + (hasAccess ? 'Available' : 'Not available'));
      }
    }
  }

  console.log('\n\n=== Verification Summary ===');
  console.log('Step 1: Call validate-api-key - PASS');
  console.log('Step 2: Verify returns key status - PASS');
  console.log('Step 3: Verify returns scopes/permissions - PASS');
  console.log('Step 4: Verify returns rate limit status - PASS');

  console.log('\n\n=== All tests completed ===');
  console.log('Feature #1231: MCP tool validate-api-key is working!');
}

testValidateApiKey().catch(console.error);
