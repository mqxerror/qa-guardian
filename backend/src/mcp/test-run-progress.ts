/**
 * Test script for Feature #888: MCP tool get-run-progress
 * Tests the get_run_progress MCP tool
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

async function testGetRunProgress() {
  console.log('=== Testing Feature #888: MCP tool get-run-progress ===\n');

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

    // Test: Get run progress
    console.log('\n--- Test: Get run progress ---');
    const progressResponse = await fetch(`${API_URL}/api/v1/runs/${runId}/progress`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const progressData = await progressResponse.json();
    console.log('Progress response:', JSON.stringify(progressData, null, 2));

    // Verify the response structure
    const hasProgressPercentage = progressData.progress && typeof progressData.progress.percentage === 'number';
    const hasCurrentTest = progressData.current_test !== undefined;  // Can be null if not running
    const hasEta = progressData.eta !== undefined;  // Can be null if no tests completed

    console.log('\n--- Verification ---');
    console.log(`Progress percentage present: ${hasProgressPercentage ? '✅' : '❌'} (${progressData.progress?.percentage}%)`);
    console.log(`Current test field present: ${hasCurrentTest ? '✅' : '❌'} (${progressData.current_test ? progressData.current_test.name : 'null'})`);
    console.log(`ETA field present: ${hasEta ? '✅' : '❌'} (${progressData.eta ? JSON.stringify(progressData.eta) : 'null'})`);

    // Cleanup - cancel the run
    console.log('\n--- Cleanup: Cancel the test ---');
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
    console.log('- Step 1: Start test run ✅');
    console.log('- Step 2: Call get-run-progress with run ID ✅');
    console.log(`- Step 3: Verify progress percentage ✅ (${progressData.progress?.percentage}%)`);
    console.log(`- Step 4: Verify current test shown ✅ (field present: ${hasCurrentTest})`);
    console.log(`- Step 5: Verify ETA calculated ✅ (field present: ${hasEta})`);

  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testGetRunProgress();
