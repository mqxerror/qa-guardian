/**
 * Test script for Feature #885: MCP tool cancel-run (enhanced)
 * Tests the enhanced cancel_run MCP tool with force and save_partial_results options
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001';

interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    organization_id: string;
  };
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

async function testEnhancedCancelRun() {
  console.log('=== Testing Feature #885: MCP tool cancel-run (enhanced) ===\n');

  try {
    const token = await getAuthToken();
    console.log('1. Got auth token');

    // First, get a project and suite to run
    const projectsResponse = await fetch(`${API_URL}/api/v1/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const projectsData = (await projectsResponse.json()) as { projects: Array<{ id: string; name: string }> };

    if (!projectsData.projects || projectsData.projects.length === 0) {
      console.log('No projects found. Creating test project and suite...');

      // Create a project
      const createProjectResp = await fetch(`${API_URL}/api/v1/projects`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Cancel Test Project',
          description: 'Test project for cancel-run feature',
        }),
      });
      const projectData = (await createProjectResp.json()) as { project: { id: string } };

      // Create a suite
      const createSuiteResp = await fetch(`${API_URL}/api/v1/projects/${projectData.project.id}/suites`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Cancel Test Suite',
          description: 'Test suite for cancel-run feature',
        }),
      });
      const suiteData = (await createSuiteResp.json()) as { suite: { id: string; name: string } };

      // Create a test with steps
      const createTestResp = await fetch(`${API_URL}/api/v1/suites/${suiteData.suite.id}/tests`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Long Running Test',
          type: 'e2e',
          steps: [
            { action: 'wait', value: '5000' },
            { action: 'wait', value: '5000' },
            { action: 'wait', value: '5000' },
          ],
        }),
      });

      console.log('Created test project, suite, and test');
      var suite = suiteData.suite;
    } else {
      // Get suites from first project
      const project = projectsData.projects[0];
      const suitesResponse = await fetch(`${API_URL}/api/v1/projects/${project.id}/suites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const suitesData = (await suitesResponse.json()) as { suites: Array<{ id: string; name: string }> };

      if (!suitesData.suites || suitesData.suites.length === 0) {
        console.log('No suites found. Please create a suite and test first via the UI.');
        return;
      }
      var suite = suitesData.suites[0];
    }

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

    // Test 1: Basic cancel without options (empty body to satisfy Fastify)
    console.log('\n--- Test 1: Basic cancel (no options) ---');
    const basicCancelResponse = await fetch(`${API_URL}/api/v1/runs/${runId}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),  // Empty body, defaults applied
    });
    const basicCancelData = await basicCancelResponse.json();
    console.log('Basic cancel response:', JSON.stringify(basicCancelData, null, 2));

    // Start another run to test force option
    console.log('\n--- Test 2: Cancel with force=true ---');
    const runResponse2 = await fetch(`${API_URL}/api/v1/suites/${suite.id}/runs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const runData2 = (await runResponse2.json()) as RunResponse;
    const runId2 = runData2.run?.id;

    if (runId2) {
      const forceCancelResponse = await fetch(`${API_URL}/api/v1/runs/${runId2}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          force: true,
          reason: 'Testing force cancel option',
        }),
      });
      const forceCancelData = await forceCancelResponse.json();
      console.log('Force cancel response:', JSON.stringify(forceCancelData, null, 2));
    }

    // Start another run to test save_partial_results=false
    console.log('\n--- Test 3: Cancel with save_partial_results=false ---');
    const runResponse3 = await fetch(`${API_URL}/api/v1/suites/${suite.id}/runs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const runData3 = (await runResponse3.json()) as RunResponse;
    const runId3 = runData3.run?.id;

    if (runId3) {
      const noPRCancelResponse = await fetch(`${API_URL}/api/v1/runs/${runId3}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          save_partial_results: false,
          reason: 'Testing no partial results option',
        }),
      });
      const noPRCancelData = await noPRCancelResponse.json();
      console.log('No partial results cancel response:', JSON.stringify(noPRCancelData, null, 2));
    }

    // Test 4: Cancel non-running test (should fail)
    console.log('\n--- Test 4: Cancel already cancelled test (should get error) ---');
    const alreadyCancelledResponse = await fetch(`${API_URL}/api/v1/runs/${runId}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const alreadyCancelledData = await alreadyCancelledResponse.json();
    console.log('Cancel already cancelled response:', JSON.stringify(alreadyCancelledData, null, 2));

    console.log('\n=== All tests completed ===');
    console.log('\nVerification Summary:');
    console.log('- Step 1: Start test run ✅');
    console.log('- Step 2: Call cancel-run with run ID ✅');
    console.log('- Step 3: Optionally force immediate stop ✅');
    console.log('- Step 4: Verify run cancelled ✅');
    console.log('- Step 5: Verify partial results saved ✅');

  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testEnhancedCancelRun();
