/**
 * Test script for Feature #869: MCP tool import-tests
 * Tests that the AI agent can import tests from JSON into a test suite
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
  result?: unknown;
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

async function getSessionId(): Promise<string> {
  // Connect to SSE and get session ID
  const response = await fetch(`${MCP_URL}/sse`);
  const text = await response.text();
  const match = text.match(/sessionId=([a-f0-9-]+)/);
  if (!match) throw new Error('Could not get session ID');
  return match[1];
}

async function testImportTests() {
  console.log('=== Testing MCP import_tests Tool (Feature #869) ===\n');

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

  // Test 1: Call import-tests with JSON data
  console.log('2. Step 1: Call import-tests with JSON data...');
  const testsToImport = [
    {
      name: 'Login Form Validation Test',
      type: 'e2e',
      description: 'Test that login form validates email and password',
      tags: ['auth', 'validation'],
      target_url: 'http://localhost:5173/login',
    },
    {
      name: 'Dashboard Load Performance',
      type: 'performance',
      description: 'Test that dashboard loads within 2 seconds',
      tags: ['performance', 'dashboard'],
    },
    {
      name: 'API Health Check',
      type: 'api',
      description: 'Test that API health endpoint returns 200',
      target_url: 'http://localhost:3001/health',
    },
  ];

  const importResult = await mcpCall(sessionId, 'import_tests', {
    suite_id: SUITE_ID,
    tests: testsToImport,
  });

  console.log('   Import result:', JSON.stringify(importResult, null, 2));

  if (importResult.error) {
    console.error('   ❌ Import failed:', importResult.error.message);
    process.exit(1);
  }

  // Parse the MCP result - it's wrapped in content[0].text as a JSON string
  const mcpResult = importResult.result as { content: Array<{ type: string; text: string }> };
  const result = JSON.parse(mcpResult.content[0].text) as Record<string, unknown>;

  // Step 2: Verify target suite was specified
  console.log('\n3. Step 2: Verify target suite was specified...');
  if (result.suite_id === SUITE_ID) {
    console.log(`   ✅ Target suite correctly specified: ${SUITE_ID}`);
  } else {
    console.error(`   ❌ Suite ID mismatch: expected ${SUITE_ID}, got ${result.suite_id}`);
  }

  // Step 3: Verify tests imported
  console.log('\n4. Step 3: Verify tests imported...');
  if (result.imported === true) {
    console.log('   ✅ Tests imported successfully');
    const importedTests = result.imported_tests as Array<{ id: string; name: string }>;
    console.log(`   Imported tests:`);
    importedTests.forEach((t, i) => {
      console.log(`     ${i + 1}. ${t.name} (ID: ${t.id})`);
    });
  } else {
    console.error('   ❌ Import failed');
  }

  // Step 4: Verify import count returned
  console.log('\n5. Step 4: Verify import count returned...');
  if (typeof result.imported_count === 'number') {
    console.log(`   ✅ Import count: ${result.imported_count}/${result.total_count}`);
    if (result.failed_count && (result.failed_count as number) > 0) {
      console.log(`   ⚠️ Failed imports: ${result.failed_count}`);
    }
  } else {
    console.error('   ❌ Import count not returned');
  }

  // Test validation-only mode
  console.log('\n6. Bonus: Testing validate_only mode...');
  const validateResult = await mcpCall(sessionId, 'import_tests', {
    suite_id: SUITE_ID,
    tests: [
      { name: 'Valid Test', type: 'e2e' },
      { name: '', type: 'e2e' },  // Invalid - empty name
      { name: 'Invalid Type Test', type: 'invalid_type' },  // Invalid type
    ],
    validate_only: true,
  });

  console.log('   Validation result:', JSON.stringify(validateResult, null, 2));
  const valMcpResult = validateResult.result as { content: Array<{ type: string; text: string }> };
  const valResult = JSON.parse(valMcpResult.content[0].text) as Record<string, unknown>;
  if (valResult.valid === false) {
    console.log('   ✅ Validation correctly caught errors');
    const errors = valResult.errors as Array<{ index: number; error: string }>;
    errors.forEach((e) => console.log(`     - Index ${e.index}: ${e.error}`));
  }

  console.log('\n=== All import_tests tests completed ===');
}

testImportTests().catch(console.error);
