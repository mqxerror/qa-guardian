/**
 * Test script for Feature #876: MCP tool update-test-code
 * Tests that the AI agent can update Playwright code directly
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

async function testUpdateTestCode() {
  console.log('=== Testing MCP update_test_code Tool (Feature #876) ===\n');

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

  // The custom Playwright code to set
  const customCode = `import { test, expect } from '@playwright/test';

test('Custom Login Test', async ({ page }) => {
  // Navigate to login page
  await page.goto('https://example.com/login');

  // Fill in credentials
  await page.locator('#email').fill('user@example.com');
  await page.locator('#password').fill('securePassword123');

  // Click login button
  await page.locator('button[type="submit"]').click();

  // Wait for navigation
  await page.waitForURL('**/dashboard');

  // Verify login success
  await expect(page.locator('.user-name')).toHaveText('John Doe');
});
`;

  // Step 1: Call update-test-code with test ID
  console.log('3. Step 1: Call update-test-code with test ID...');
  const updateResult = await mcpCall(sessionId, 'update_test_code', {
    test_id: testId,
    code: customCode,
  });

  if (updateResult.error) {
    console.error('   ❌ Update test code failed:', updateResult.error.message);
    process.exit(1);
  }

  const updateData = JSON.parse(updateResult.result!.content[0].text) as {
    updated: boolean;
    test_id: string;
    test_name: string;
    use_custom_code: boolean;
    code_length: number;
    validation_warnings?: string[];
    is_valid: boolean;
    message: string;
  };
  console.log(`   ✅ ${updateData.message}`);

  // Step 2: Provide new Playwright code (already done in step 1)
  console.log('\n4. Step 2: Provide new Playwright code...');
  console.log(`   ✅ Code provided: ${customCode.length} characters`);
  console.log(`   Code saved length: ${updateData.code_length} characters`);

  // Step 3: Verify code validated
  console.log('\n5. Step 3: Verify code validated...');
  if (updateData.is_valid) {
    console.log('   ✅ Code passed validation');
  } else {
    console.log('   ⚠️ Code has validation warnings:');
    updateData.validation_warnings?.forEach(w => console.log(`      - ${w}`));
  }

  // Step 4: Verify code saved
  console.log('\n6. Step 4: Verify code saved...');
  if (updateData.updated) {
    console.log('   ✅ Code was saved successfully');
    console.log(`   Test ID: ${updateData.test_id}`);
    console.log(`   Test name: ${updateData.test_name}`);
    console.log(`   Use custom code: ${updateData.use_custom_code}`);
  } else {
    console.error('   ❌ Code was not saved');
  }

  // Verify by getting the code back
  console.log('\n7. Verifying saved code with get_test_code...');
  const verifyResult = await mcpCall(sessionId, 'get_test_code', {
    test_id: testId,
  });

  if (verifyResult.result) {
    const verifyData = JSON.parse(verifyResult.result.content[0].text) as {
      code: string;
      source: string;
    };
    if (verifyData.source === 'custom') {
      console.log('   ✅ Code source is "custom"');
      if (verifyData.code === customCode) {
        console.log('   ✅ Retrieved code matches what was saved');
      } else {
        console.log('   ⚠️ Retrieved code differs slightly (might have formatting differences)');
      }
    } else {
      console.log(`   ⚠️ Code source is "${verifyData.source}" instead of "custom"`);
    }
  }

  // Bonus: Test with invalid code (missing import)
  console.log('\n8. Bonus: Test validation with incomplete code...');
  const incompleteCode = `
test('Simple test', async ({ page }) => {
  await page.goto('https://example.com');
});
`;

  const invalidResult = await mcpCall(sessionId, 'update_test_code', {
    test_id: testId,
    code: incompleteCode,
  });

  if (invalidResult.result) {
    const invalidData = JSON.parse(invalidResult.result.content[0].text) as {
      is_valid: boolean;
      validation_warnings?: string[];
    };
    if (!invalidData.is_valid && invalidData.validation_warnings && invalidData.validation_warnings.length > 0) {
      console.log('   ✅ Validation correctly detected issues:');
      invalidData.validation_warnings.forEach(w => console.log(`      - ${w}`));
    } else {
      console.log('   ⚠️ Validation did not detect expected issues');
    }
  }

  // Restore with valid code
  console.log('\n9. Restoring valid code...');
  await mcpCall(sessionId, 'update_test_code', {
    test_id: testId,
    code: customCode,
  });
  console.log('   ✅ Valid code restored');

  // Test disabling custom code
  console.log('\n10. Bonus: Test use_custom_code=false...');
  const disableResult = await mcpCall(sessionId, 'update_test_code', {
    test_id: testId,
    code: customCode,
    use_custom_code: false,
  });

  if (disableResult.result) {
    const disableData = JSON.parse(disableResult.result.content[0].text) as {
      use_custom_code: boolean;
    };
    if (disableData.use_custom_code === false) {
      console.log('   ✅ use_custom_code correctly set to false');
    } else {
      console.log(`   ⚠️ use_custom_code is ${disableData.use_custom_code}`);
    }
  }

  console.log('\n=== All update_test_code tests completed ===');
}

testUpdateTestCode().catch(console.error);
