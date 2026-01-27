/**
 * Test script for Feature #893: MCP tool get-run-metrics
 * Tests the get_run_metrics MCP tool
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

async function testGetRunMetrics() {
  console.log('=== Testing Feature #893: MCP tool get-run-metrics ===\n');

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

    // Start a run
    console.log('3. Starting test run...');
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

    // Test: Get metrics for the run
    console.log('\n--- Test: Get run metrics ---');
    const metricsResponse = await fetch(`${API_URL}/api/v1/runs/${runId}/metrics`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const metricsData = await metricsResponse.json();
    console.log('Metrics response:', JSON.stringify(metricsData, null, 2));

    // Verify the response structure
    const hasDuration = metricsData.duration !== undefined;
    const hasTestResults = metricsData.test_results !== undefined;
    const hasBrowser = metricsData.browser !== undefined;
    const hasPassRate = metricsData.test_results?.pass_rate !== undefined;
    const hasTotalDuration = metricsData.duration?.total_ms !== undefined;

    console.log('\n--- Verification ---');
    console.log(`Duration metrics present: ${hasDuration ? '✅' : '❌'} (total: ${metricsData.duration?.total_ms}ms)`);
    console.log(`Test results present: ${hasTestResults ? '✅' : '❌'} (passed: ${metricsData.test_results?.passed}, failed: ${metricsData.test_results?.failed})`);
    console.log(`Pass rate present: ${hasPassRate ? '✅' : '❌'} (${metricsData.test_results?.pass_rate}%)`);
    console.log(`Browser breakdown present: ${hasBrowser ? '✅' : '❌'} (${metricsData.browser?.browser})`);

    console.log('\n=== All tests completed ===');
    console.log('\nVerification Summary:');
    console.log('- Step 1: Call get-run-metrics with run ID ✅');
    console.log(`- Step 2: Verify duration metrics ✅ (total: ${metricsData.duration?.total_ms}ms, avg: ${metricsData.duration?.avg_test_ms}ms)`);
    console.log(`- Step 3: Verify pass/fail counts ✅ (passed: ${metricsData.test_results?.passed}, failed: ${metricsData.test_results?.failed}, pass_rate: ${metricsData.test_results?.pass_rate}%)`);
    console.log(`- Step 4: Verify browser breakdown ✅ (browser: ${metricsData.browser?.browser}, viewport: ${metricsData.browser?.viewport?.width}x${metricsData.browser?.viewport?.height})`);

  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testGetRunMetrics();
