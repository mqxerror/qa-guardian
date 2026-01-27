/**
 * Test Concurrent Baseline Updates - Feature #605
 *
 * This test verifies that when two users try to update the same baseline
 * simultaneously, the system prevents conflicts using optimistic locking.
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001';

interface ApiResponse {
  [key: string]: unknown;
}

async function login(email: string, password: string): Promise<string> {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json() as { token?: string };
  if (!data.token) {
    throw new Error(`Login failed for ${email}`);
  }
  return data.token;
}

async function apiRequest(
  endpoint: string,
  method: string = 'GET',
  body?: unknown,
  token?: string
): Promise<{ status: number; data: ApiResponse }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json() as ApiResponse;
  return { status: response.status, data };
}

async function runTest() {
  console.log('='.repeat(70));
  console.log('  Feature #605: Visual regression handles concurrent baseline updates');
  console.log('='.repeat(70));
  console.log('');

  let passed = 0;
  let failed = 0;

  try {
    // Step 1: Login as two different users (simulating User A and User B)
    console.log('--- Step 1: Login as two users ---');
    const tokenA = await login('developer@example.com', 'Developer123!');
    console.log('  ✓ User A logged in (developer@example.com)');

    const tokenB = await login('admin@example.com', 'Admin123!');
    console.log('  ✓ User B logged in (admin@example.com)');
    passed++;

    // Step 2: Create a project and test for this test
    console.log('\n--- Step 2: Create test project and visual test ---');
    const projectResult = await apiRequest('/api/v1/projects', 'POST', {
      name: 'Concurrent Test Project',
      description: 'Testing concurrent baseline updates',
      base_url: 'https://example.com',
    }, tokenA);
    const projectId = projectResult.data.id;
    console.log(`  ✓ Created project: ${projectId}`);

    const suiteResult = await apiRequest(`/api/v1/projects/${projectId}/suites`, 'POST', {
      name: 'Concurrent Suite',
      description: 'Testing concurrent updates',
      browser: 'chromium',
      viewport_width: 1280,
      viewport_height: 720,
    }, tokenA);
    const suiteId = suiteResult.data.id;
    console.log(`  ✓ Created suite: ${suiteId}`);

    const testResult = await apiRequest(`/api/v1/suites/${suiteId}/tests`, 'POST', {
      name: 'Concurrent Visual Test',
      description: 'Test concurrent baseline updates',
      type: 'visual',
      target_url: 'https://example.com',
      viewport_width: 1920,
      viewport_height: 1080,
      full_page: true,
    }, tokenA);
    const testId = testResult.data.id;
    console.log(`  ✓ Created test: ${testId}`);
    passed++;

    // Step 3: Run the suite to generate a screenshot
    console.log('\n--- Step 3: Run suite to generate screenshot ---');
    const runResult = await apiRequest(`/api/v1/suites/${suiteId}/runs`, 'POST', {}, tokenA);
    const runId = runResult.data.id;
    console.log(`  Running test... (run ${runId})`);

    // Wait for completion
    let runStatus = 'running';
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const statusResult = await apiRequest(`/api/v1/runs/${runId}`, 'GET', undefined, tokenA);
      runStatus = statusResult.data.status as string;
      if (runStatus !== 'running') break;
    }
    console.log(`  ✓ Run completed with status: ${runStatus}`);
    passed++;

    // Step 4: User A approves the baseline (first approval, no expectedVersion needed)
    console.log('\n--- Step 4: User A approves baseline (first approval) ---');
    const approveA1 = await apiRequest(`/api/v1/tests/${testId}/baseline/approve`, 'POST', {
      runId,
      viewport: 'single',
      branch: 'main',
    }, tokenA);

    if (approveA1.status === 200 && approveA1.data.success) {
      console.log(`  ✓ User A approved baseline successfully`);
      console.log(`    Version: ${approveA1.data.version}`);
      console.log(`    Approved by: ${approveA1.data.approvedBy}`);
      passed++;
    } else {
      console.log(`  ✗ FAIL - User A approval failed`);
      console.log(`    Status: ${approveA1.status}`);
      console.log(`    Response: ${JSON.stringify(approveA1.data)}`);
      failed++;
    }

    // Step 5: Both users fetch baseline info (get current version)
    console.log('\n--- Step 5: Both users fetch baseline info (simulating opening approval dialog) ---');
    const baselineInfoA = await apiRequest(`/api/v1/tests/${testId}/baseline?viewport=single&branch=main`, 'GET', undefined, tokenA);
    const baselineInfoB = await apiRequest(`/api/v1/tests/${testId}/baseline?viewport=single&branch=main`, 'GET', undefined, tokenB);

    const versionA = baselineInfoA.data.version as number;
    const versionB = baselineInfoB.data.version as number;
    console.log(`  User A sees version: ${versionA}`);
    console.log(`  User B sees version: ${versionB}`);

    if (versionA === versionB && versionA === 1) {
      console.log(`  ✓ Both users see the same version (${versionA})`);
      passed++;
    } else {
      console.log(`  ✗ FAIL - Version mismatch or unexpected version`);
      failed++;
    }

    // Step 6: Run suite again to get new screenshot
    console.log('\n--- Step 6: Run suite again to get new screenshot ---');
    const runResult2 = await apiRequest(`/api/v1/suites/${suiteId}/runs`, 'POST', {}, tokenA);
    const runId2 = runResult2.data.id;

    // Wait for completion
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const statusResult = await apiRequest(`/api/v1/runs/${runId2}`, 'GET', undefined, tokenA);
      if ((statusResult.data.status as string) !== 'running') break;
    }
    console.log(`  ✓ Second run completed`);
    passed++;

    // Step 7: User A approves the new baseline with expectedVersion
    console.log('\n--- Step 7: User A approves new baseline with expectedVersion ---');
    const approveA2 = await apiRequest(`/api/v1/tests/${testId}/baseline/approve`, 'POST', {
      runId: runId2,
      viewport: 'single',
      branch: 'main',
      expectedVersion: versionA, // User A expects version 1
    }, tokenA);

    if (approveA2.status === 200 && approveA2.data.success) {
      console.log(`  ✓ User A approved baseline successfully`);
      console.log(`    New version: ${approveA2.data.version}`);
      passed++;
    } else {
      console.log(`  ✗ FAIL - User A approval with version check failed`);
      console.log(`    Status: ${approveA2.status}`);
      console.log(`    Response: ${JSON.stringify(approveA2.data)}`);
      failed++;
    }

    // Step 8: User B tries to approve with stale version (should fail with 409)
    console.log('\n--- Step 8: User B attempts to approve with stale version ---');
    const approveB = await apiRequest(`/api/v1/tests/${testId}/baseline/approve`, 'POST', {
      runId: runId2,
      viewport: 'single',
      branch: 'main',
      expectedVersion: versionB, // User B still has version 1, but current is now 2
    }, tokenB);

    if (approveB.status === 409) {
      console.log(`  ✓ PASS - User B correctly received 409 Conflict`);
      console.log(`    Error: ${approveB.data.error}`);
      console.log(`    Message: ${approveB.data.message}`);
      console.log(`    Details: ${approveB.data.details}`);
      console.log(`    Current version: ${approveB.data.currentVersion}`);
      console.log(`    Expected version: ${approveB.data.expectedVersion}`);
      console.log(`    Requires refresh: ${approveB.data.requiresRefresh}`);
      passed++;
    } else {
      console.log(`  ✗ FAIL - Expected 409 Conflict, got ${approveB.status}`);
      console.log(`    Response: ${JSON.stringify(approveB.data)}`);
      failed++;
    }

    // Step 9: Verify error message contains expected text
    console.log('\n--- Step 9: Verify error message format ---');
    const message = approveB.data.message as string;
    const requiresRefresh = approveB.data.requiresRefresh as boolean;

    if (message?.includes('Baseline was modified by another user') && requiresRefresh === true) {
      console.log(`  ✓ PASS - Error message and refresh flag are correct`);
      passed++;
    } else {
      console.log(`  ✗ FAIL - Error message or refresh flag incorrect`);
      console.log(`    Expected message to contain: "Baseline was modified by another user"`);
      console.log(`    Actual message: ${message}`);
      console.log(`    Expected requiresRefresh: true`);
      console.log(`    Actual requiresRefresh: ${requiresRefresh}`);
      failed++;
    }

    // Step 10: User B refreshes and approves with correct version
    console.log('\n--- Step 10: User B refreshes and approves with correct version ---');
    const refreshedInfo = await apiRequest(`/api/v1/tests/${testId}/baseline?viewport=single&branch=main`, 'GET', undefined, tokenB);
    const currentVersion = refreshedInfo.data.version as number;
    console.log(`  User B refreshed, current version: ${currentVersion}`);

    const approveB2 = await apiRequest(`/api/v1/tests/${testId}/baseline/approve`, 'POST', {
      runId: runId2,
      viewport: 'single',
      branch: 'main',
      expectedVersion: currentVersion,
    }, tokenB);

    if (approveB2.status === 200 && approveB2.data.success) {
      console.log(`  ✓ PASS - User B approved baseline after refresh`);
      console.log(`    New version: ${approveB2.data.version}`);
      passed++;
    } else {
      console.log(`  ✗ FAIL - User B approval after refresh failed`);
      console.log(`    Status: ${approveB2.status}`);
      console.log(`    Response: ${JSON.stringify(approveB2.data)}`);
      failed++;
    }

  } catch (error) {
    console.log(`\n  ERROR: ${error}`);
    failed++;
  }

  console.log('\n' + '='.repeat(70));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(70));

  if (passed >= 10 && failed === 0) {
    console.log('\n✓ Feature #605 PASSED: Visual regression handles concurrent baseline updates');
    process.exit(0);
  } else {
    console.log('\n✗ Feature #605 FAILED');
    process.exit(1);
  }
}

runTest().catch((error) => {
  console.error('Test error:', error);
  process.exit(1);
});
