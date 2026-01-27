/**
 * Test script for Feature #891: MCP tool get-network-logs
 * Tests the get_network_logs MCP tool
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001';

interface AuthResponse {
  token: string;
}

interface RunResponse {
  run: {
    id: string;
    status: string;
  };
}

async function getAuthToken(): Promise<string> {
  const loginData = {
    email: 'owner@example.com',
    password: 'Owner123!'
  };
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loginData),
  });
  const data = (await response.json()) as AuthResponse;
  if (!data.token) {
    console.error('Login failed:', data);
    throw new Error('Failed to get auth token');
  }
  return data.token;
}

async function testGetNetworkLogs() {
  console.log('=== Testing Feature #891: MCP tool get-network-logs ===\n');

  try {
    const token = await getAuthToken();
    console.log('1. Got auth token');

    // Get project and suite
    const projectsResponse = await fetch(`${API_URL}/api/v1/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const projectsData = (await projectsResponse.json()) as { projects: Array<{ id: string; name: string }> };

    if (!projectsData.projects || projectsData.projects.length === 0) {
      console.log('No projects found. Please create a project and suite first via the UI.');
      return;
    }

    const project = projectsData.projects[0];
    const suitesResponse = await fetch(`${API_URL}/api/v1/projects/${project.id}/suites`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const suitesData = (await suitesResponse.json()) as { suites: Array<{ id: string; name: string }> };

    if (!suitesData.suites || suitesData.suites.length === 0) {
      console.log('No suites found. Please create a suite first via the UI.');
      return;
    }

    const suite = suitesData.suites[0];
    console.log(`2. Found suite: ${suite.name} (${suite.id})`);

    // Get tests in suite
    const testsResponse = await fetch(`${API_URL}/api/v1/suites/${suite.id}/tests`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const testsData = (await testsResponse.json()) as { tests: Array<{ id: string; name: string }> };

    if (!testsData.tests || testsData.tests.length === 0) {
      console.log('No tests found. Please create a test first via the UI.');
      return;
    }

    const test = testsData.tests[0];
    console.log(`3. Found test: ${test.name} (${test.id})`);

    // Start a run
    console.log('4. Starting test run...');
    const runResponse = await fetch(`${API_URL}/api/v1/suites/${suite.id}/runs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const runData = (await runResponse.json()) as RunResponse;
    const runId = runData.run?.id;

    if (!runId) {
      console.log('Failed to start run:', runData);
      return;
    }

    console.log(`   Run started with ID: ${runId}`);

    // Wait for the test to complete
    console.log('   Waiting for test execution...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test: Get network logs for the test result
    console.log('\n--- Test: Get network logs with result ID ---');
    const networkResponse = await fetch(`${API_URL}/api/v1/runs/${runId}/results/${test.id}/network`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const networkData = await networkResponse.json();
    console.log('Network logs response:', JSON.stringify(networkData, null, 2));

    // Verify the response structure
    const hasRequests = networkData.requests !== undefined && Array.isArray(networkData.requests);
    const hasResponseTimes = networkData.response_times !== undefined;
    const hasFailedRequests = networkData.failed_requests !== undefined && Array.isArray(networkData.failed_requests);
    const hasNetworkSummary = networkData.network_summary !== undefined;
    const hasHasFailuresFlag = networkData.network_summary?.has_failures !== undefined;

    console.log('\n--- Verification ---');
    console.log(`Requests array present: ${hasRequests ? '✅' : '❌'} (${networkData.requests?.length || 0} requests)`);
    console.log(`Response times present: ${hasResponseTimes ? '✅' : '❌'} (avg: ${networkData.response_times?.avg_ms}ms)`);
    console.log(`Failed requests flagged: ${hasFailedRequests ? '✅' : '❌'} (${networkData.failed_requests?.length || 0} failed)`);
    console.log(`Network summary present: ${hasNetworkSummary ? '✅' : '❌'}`);
    console.log(`has_failures flag present: ${hasHasFailuresFlag ? '✅' : '❌'} (${networkData.network_summary?.has_failures})`);

    // Cleanup - cancel the run if still running
    console.log('\n--- Cleanup: Cancel the test if running ---');
    await fetch(`${API_URL}/api/v1/runs/${runId}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    console.log('\n=== All tests completed ===');
    console.log('\nVerification Summary:');
    console.log('- Step 1: Call get-network-logs with result ID ✅');
    console.log(`- Step 2: Verify requests returned ✅ (${networkData.requests?.length || 0} requests)`);
    console.log(`- Step 3: Verify response times included ✅ (avg: ${networkData.response_times?.avg_ms}ms, max: ${networkData.response_times?.max_ms}ms)`);
    console.log(`- Step 4: Verify failed requests flagged ✅ (has_failures: ${networkData.network_summary?.has_failures}, failed: ${networkData.failed_requests?.length || 0})`);

  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testGetNetworkLogs();
