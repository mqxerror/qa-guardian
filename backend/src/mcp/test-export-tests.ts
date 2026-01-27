/**
 * Test script for Feature #870: MCP tool export-tests
 * Tests that the AI agent can export tests to JSON format
 */

const API_KEY = 'qg_WkD3tC5PnE7bcJ_j_Jl__M9W1cqxQJ9pTh1_qQIXZ44';
const SUITE_ID = '1768524229496';
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

async function testExportTests() {
  console.log('=== Testing MCP export_tests Tool (Feature #870) ===\n');

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

  // Step 1: Call export-tests with suite ID
  console.log('2. Step 1: Call export-tests with suite ID...');
  const exportResult = await mcpCall(sessionId, 'export_tests', {
    suite_id: SUITE_ID,
  });

  console.log('   Export result:', JSON.stringify(exportResult, null, 2).substring(0, 500) + '...');

  if (exportResult.error) {
    console.error('   ❌ Export failed:', exportResult.error.message);
    process.exit(1);
  }

  const mcpResult = exportResult.result;
  if (!mcpResult || !mcpResult.content || !mcpResult.content[0]) {
    console.error('   ❌ Invalid response format');
    process.exit(1);
  }

  const result = JSON.parse(mcpResult.content[0].text) as Record<string, unknown>;
  console.log(`   ✅ Export completed`);

  // Step 2: Verify JSON returned
  console.log('\n3. Step 2: Verify JSON returned...');
  if (result.exported === true && Array.isArray(result.tests)) {
    console.log(`   ✅ Valid JSON returned with ${(result.tests as unknown[]).length} tests`);
  } else {
    console.error('   ❌ Invalid JSON response');
    process.exit(1);
  }

  // Step 3: Verify all test details included
  console.log('\n4. Step 3: Verify all test details included...');
  const tests = result.tests as Array<Record<string, unknown>>;
  if (tests.length > 0) {
    const firstTest = tests[0];
    console.log('   Sample test:', JSON.stringify(firstTest, null, 2));

    const requiredFields = ['name', 'type'];
    const missingFields = requiredFields.filter(f => !(f in firstTest));

    if (missingFields.length === 0) {
      console.log(`   ✅ All required fields present: ${requiredFields.join(', ')}`);
    } else {
      console.error(`   ❌ Missing fields: ${missingFields.join(', ')}`);
    }

    // Check for optional fields
    const optionalFields = ['description', 'steps', 'status'];
    const presentOptional = optionalFields.filter(f => f in firstTest);
    console.log(`   Optional fields present: ${presentOptional.join(', ') || 'none'}`);
  }

  // Step 4: Verify importable format
  console.log('\n5. Step 4: Verify importable format...');
  if (result.importable === true) {
    console.log('   ✅ Export marked as importable');
  }

  // Verify format by checking we can parse each test
  let allValid = true;
  for (const test of tests) {
    if (!test.name || typeof test.name !== 'string') {
      console.log(`   ❌ Test missing valid name: ${JSON.stringify(test)}`);
      allValid = false;
    }
  }
  if (allValid) {
    console.log(`   ✅ All ${tests.length} tests have valid importable format`);
  }

  // Bonus: Test minimal format
  console.log('\n6. Bonus: Testing minimal format...');
  const minimalResult = await mcpCall(sessionId, 'export_tests', {
    suite_id: SUITE_ID,
    format: 'minimal',
  });

  const minimalMcpResult = minimalResult.result;
  if (minimalMcpResult && minimalMcpResult.content && minimalMcpResult.content[0]) {
    const minimalData = JSON.parse(minimalMcpResult.content[0].text) as Record<string, unknown>;
    const minimalTests = minimalData.tests as Array<Record<string, unknown>>;
    if (minimalTests.length > 0) {
      console.log('   Minimal format sample:', JSON.stringify(minimalTests[0], null, 2));
      const keys = Object.keys(minimalTests[0]);
      if (keys.length <= 3 && keys.includes('name') && keys.includes('type')) {
        console.log('   ✅ Minimal format returns only essential fields');
      }
    }
  }

  // Bonus: Test with IDs and timestamps
  console.log('\n7. Bonus: Testing with IDs and timestamps...');
  const fullResult = await mcpCall(sessionId, 'export_tests', {
    suite_id: SUITE_ID,
    include_ids: true,
    include_timestamps: true,
  });

  const fullMcpResult = fullResult.result;
  if (fullMcpResult && fullMcpResult.content && fullMcpResult.content[0]) {
    const fullData = JSON.parse(fullMcpResult.content[0].text) as Record<string, unknown>;
    const fullTests = fullData.tests as Array<Record<string, unknown>>;
    if (fullTests.length > 0) {
      const hasId = 'id' in fullTests[0];
      const hasTimestamps = 'created_at' in fullTests[0] || 'updated_at' in fullTests[0];
      if (hasId) console.log('   ✅ IDs included when requested');
      if (hasTimestamps) console.log('   ✅ Timestamps included when requested');
    }
  }

  console.log('\n=== All export_tests tests completed ===');
}

testExportTests().catch(console.error);
