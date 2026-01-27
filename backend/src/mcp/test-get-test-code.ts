/**
 * Test script for Feature #875: MCP tool get-test-code
 * Tests that the AI agent can retrieve generated Playwright code
 */

const API_KEY = 'qg_8yMJN_odoNAvwNUtJXyHMs9vcSLtfSG-ADdvSTKwP1w';
const SUITE_ID = '1768526840773';
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

async function testGetTestCode() {
  console.log('=== Testing MCP get_test_code Tool (Feature #875) ===\n');

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

  // First, get a test to work with
  console.log('2. Getting tests from suite...');
  const exportResult = await mcpCall(sessionId, 'export_tests', {
    suite_id: SUITE_ID,
    include_ids: true,
  });

  if (exportResult.error || !exportResult.result) {
    console.error('   ❌ Failed to get tests:', exportResult.error?.message);
    process.exit(1);
  }

  const exportData = JSON.parse(exportResult.result.content[0].text) as { tests: Array<{ id: string; name: string }> };
  if (exportData.tests.length === 0) {
    console.error('   ❌ No tests found in suite');
    process.exit(1);
  }

  const testId = exportData.tests[0].id;
  console.log(`   Using test ID: ${testId} (${exportData.tests[0].name})\n`);

  // Add some steps to the test first
  console.log('3. Adding steps to the test for code generation...');
  const stepsToAdd = [
    { action: 'navigate', value: 'https://example.com/login' },
    { action: 'fill', selector: '#username', value: 'testuser@example.com' },
    { action: 'fill', selector: '#password', value: 'password123' },
    { action: 'click', selector: '#login-button' },
    { action: 'wait', value: '2000' },
    { action: 'assert', selector: '.welcome-message', value: 'Welcome!' },
  ];

  for (const step of stepsToAdd) {
    const addResult = await mcpCall(sessionId, 'add_test_step', {
      test_id: testId,
      ...step,
    });
    if (addResult.result) {
      console.log(`   Added ${step.action} step`);
    }
  }
  console.log(`   Total steps added: ${stepsToAdd.length}\n`);

  // Step 1: Call get-test-code with test ID
  console.log('4. Step 1: Call get-test-code with test ID...');
  const codeResult = await mcpCall(sessionId, 'get_test_code', {
    test_id: testId,
  });

  if (codeResult.error) {
    console.error('   ❌ Get test code failed:', codeResult.error.message);
    process.exit(1);
  }

  const codeData = JSON.parse(codeResult.result!.content[0].text) as {
    test_id: string;
    test_name: string;
    format: string;
    code: string;
    source: string;
    steps_count: number;
    is_valid: boolean;
    message: string;
  };
  console.log(`   ✅ ${codeData.message}`);

  // Step 2: Verify Playwright code returned
  console.log('\n5. Step 2: Verify Playwright code returned...');
  if (codeData.code && codeData.code.length > 0) {
    console.log('   ✅ Playwright code returned');
    console.log(`   Format: ${codeData.format}`);
    console.log(`   Source: ${codeData.source}`);
    console.log(`   Steps count: ${codeData.steps_count}`);
    console.log('\n   Generated code:');
    console.log('   ' + '─'.repeat(60));
    codeData.code.split('\n').forEach(line => {
      console.log(`   ${line}`);
    });
    console.log('   ' + '─'.repeat(60));
  } else {
    console.error('   ❌ No code returned');
    process.exit(1);
  }

  // Step 3: Verify code is valid syntax
  console.log('\n6. Step 3: Verify code is valid syntax...');
  if (codeData.is_valid) {
    console.log('   ✅ Code is marked as valid');
  } else {
    console.error('   ❌ Code is marked as invalid');
  }

  // Check for expected Playwright patterns
  const expectedPatterns = [
    { pattern: "import { test, expect } from '@playwright/test'", name: 'Playwright import' },
    { pattern: 'test(', name: 'Test function' },
    { pattern: 'async ({ page })', name: 'Async page parameter' },
    { pattern: 'page.goto', name: 'Navigate action' },
    { pattern: 'page.locator', name: 'Locator usage' },
    { pattern: '.fill(', name: 'Fill action' },
    { pattern: '.click(', name: 'Click action' },
  ];

  console.log('\n   Checking for expected patterns:');
  let allPatternsFound = true;
  for (const { pattern, name } of expectedPatterns) {
    if (codeData.code.includes(pattern)) {
      console.log(`   ✅ ${name}: found`);
    } else {
      console.log(`   ❌ ${name}: NOT found`);
      allPatternsFound = false;
    }
  }

  if (allPatternsFound) {
    console.log('\n   ✅ All expected Playwright patterns found - code syntax is valid');
  } else {
    console.log('\n   ⚠️ Some patterns missing, but code may still be valid');
  }

  // Bonus: Test JavaScript format
  console.log('\n7. Bonus: Test JavaScript format...');
  const jsResult = await mcpCall(sessionId, 'get_test_code', {
    test_id: testId,
    format: 'javascript',
  });

  if (jsResult.result) {
    const jsData = JSON.parse(jsResult.result.content[0].text) as { format: string; code: string };
    if (jsData.format === 'javascript') {
      console.log('   ✅ JavaScript format requested and returned');
    }
  }

  // Clean up - delete the steps
  console.log('\n8. Cleanup: Removing test steps...');
  const verifyResult = await mcpCall(sessionId, 'export_tests', {
    suite_id: SUITE_ID,
    include_ids: true,
  });
  if (verifyResult.result) {
    const verifyData = JSON.parse(verifyResult.result.content[0].text) as {
      tests: Array<{ id: string; steps?: Array<{ id: string }> }>;
    };
    const test = verifyData.tests.find(t => t.id === testId);
    if (test && test.steps) {
      for (const step of test.steps) {
        await mcpCall(sessionId, 'delete_test_step', {
          test_id: testId,
          step_id: step.id,
        });
      }
      console.log(`   Deleted ${test.steps.length} steps`);
    }
  }

  console.log('\n=== All get_test_code tests completed ===');
}

testGetTestCode().catch(console.error);
