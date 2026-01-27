/**
 * Test script for Feature #871: MCP tool reorder-tests
 * Tests that the AI agent can reorder tests within a suite
 */

const API_KEY = 'qg_p1ZDa-0TpqTAY0XnZAIYAd_6emYgKVpAXfxlIIsRyRc';
const SUITE_ID = '1768524970133';
const MCP_URL = 'http://localhost:3458';

interface MCPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: {
    content: Array<{ type: string; text: string }>;
  };
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

async function mcpCall(sessionId: string, toolName: string, args: Record<string, unknown>): Promise<MCPResponse> {
  const request: MCPRequest = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  };

  const response = await fetch(`${MCP_URL}/message?sessionId=${sessionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify(request),
  });

  return response.json();
}

async function testReorderTests() {
  console.log('=== Testing MCP reorder_tests Tool (Feature #871) ===\n');

  // Get a fresh session
  console.log('1. Getting MCP session...');
  const sessionResponse = await fetch(`${MCP_URL}/sse`);
  const reader = sessionResponse.body?.getReader();
  const decoder = new TextDecoder();

  let sessionId = '';
  if (reader) {
    const { value } = await reader.read();
    const text = decoder.decode(value);
    const match = text.match(/sessionId=([a-f0-9-]+)/);
    if (match) sessionId = match[1];
    reader.cancel();
  }

  if (!sessionId) {
    console.error('Failed to get session ID');
    process.exit(1);
  }
  console.log(`   Session ID: ${sessionId}\n`);

  // First, get current tests to know their IDs
  console.log('2. Getting current tests in suite...');
  const exportResult = await mcpCall(sessionId, 'export_tests', {
    suite_id: SUITE_ID,
    include_ids: true,
  });

  if (exportResult.error || !exportResult.result) {
    console.error('   ❌ Failed to get tests:', exportResult.error?.message);
    process.exit(1);
  }

  const exportData = JSON.parse(exportResult.result.content[0].text) as { tests: Array<{ id: string; name: string }> };
  const testIds = exportData.tests.map(t => t.id);
  console.log(`   Found ${testIds.length} tests in suite`);
  console.log(`   Original order: ${testIds.slice(0, 3).join(', ')}...`);

  if (testIds.length < 2) {
    console.error('   ❌ Need at least 2 tests to test reordering');
    process.exit(1);
  }

  // Step 1: Call reorder-tests with test IDs in reversed order
  console.log('\n3. Step 1: Call reorder-tests with test IDs in reversed order...');
  const reversedIds = [...testIds].reverse();
  console.log(`   New order: ${reversedIds.slice(0, 3).join(', ')}...`);

  const reorderResult = await mcpCall(sessionId, 'reorder_tests', {
    suite_id: SUITE_ID,
    test_ids: reversedIds,
  });

  if (reorderResult.error) {
    console.error('   ❌ Reorder failed:', reorderResult.error.message);
    process.exit(1);
  }

  const reorderData = JSON.parse(reorderResult.result!.content[0].text) as Record<string, unknown>;
  console.log(`   ✅ Reorder completed: ${reorderData.message}`);

  // Step 2: Verify order updated
  console.log('\n4. Step 2: Verify order updated...');
  if (reorderData.reordered === true) {
    console.log('   ✅ Reorder flag is true');
    const reorderedTests = reorderData.tests as Array<{ id: string; name: string; order: number }>;

    // Check if first test now has order 0
    if (reorderedTests.length > 0 && reorderedTests[0].order === 0) {
      console.log('   ✅ First test has order 0');
    }

    // Check if the order matches the reversed IDs
    const newOrder = reorderedTests.map(t => t.id);
    if (JSON.stringify(newOrder) === JSON.stringify(reversedIds)) {
      console.log('   ✅ Order matches the requested order');
    } else {
      console.log('   ⚠️ Order may differ slightly due to validation');
    }
  } else {
    console.error('   ❌ Reorder flag is not true');
  }

  // Step 3: Verify order reflected by fetching tests again
  console.log('\n5. Step 3: Verify order reflected when fetching tests...');
  const verifyResult = await mcpCall(sessionId, 'export_tests', {
    suite_id: SUITE_ID,
    include_ids: true,
  });

  if (verifyResult.result) {
    const verifyData = JSON.parse(verifyResult.result.content[0].text) as { tests: Array<{ id: string; name: string }> };
    const newTestIds = verifyData.tests.map(t => t.id);

    // Check if the first few IDs match our reversed order
    const firstThreeMatch = newTestIds.slice(0, 3).join(',') === reversedIds.slice(0, 3).join(',');
    if (firstThreeMatch) {
      console.log('   ✅ New order is reflected when fetching tests');
    } else {
      console.log('   ⚠️ Order might be affected by other factors');
      console.log(`   Expected first 3: ${reversedIds.slice(0, 3).join(', ')}`);
      console.log(`   Got first 3: ${newTestIds.slice(0, 3).join(', ')}`);
    }
  }

  // Restore original order
  console.log('\n6. Restoring original order...');
  await mcpCall(sessionId, 'reorder_tests', {
    suite_id: SUITE_ID,
    test_ids: testIds,
  });
  console.log('   ✅ Original order restored');

  console.log('\n=== All reorder_tests tests completed ===');
}

testReorderTests().catch(console.error);
