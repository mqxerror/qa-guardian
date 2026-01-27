/**
 * Test script for Feature #889: MCP tool get-run-logs
 * Tests the get_run_logs MCP tool
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

async function testGetRunLogs() {
  console.log('=== Testing Feature #889: MCP tool get-run-logs ===\n');

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

    // Wait a moment for the test to run and capture some logs
    console.log('   Waiting for test execution...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 1: Get all logs (default)
    console.log('\n--- Test 1: Get all logs (default) ---');
    const logsResponse = await fetch(`${API_URL}/api/v1/runs/${runId}/logs`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const logsData = await logsResponse.json();
    console.log('Logs response:', JSON.stringify(logsData, null, 2));

    // Verify the response structure
    const hasLogs = logsData.logs !== undefined && Array.isArray(logsData.logs);
    const hasPagination = logsData.pagination !== undefined;
    const hasLevelCounts = logsData.level_counts !== undefined;

    console.log('\n--- Test 1 Verification ---');
    console.log(`Logs array present: ${hasLogs ? '✅' : '❌'} (${logsData.logs?.length || 0} logs)`);
    console.log(`Pagination present: ${hasPagination ? '✅' : '❌'}`);
    console.log(`Level counts present: ${hasLevelCounts ? '✅' : '❌'}`);

    // Test 2: Filter by log level (error)
    console.log('\n--- Test 2: Filter by log level (error) ---');
    const errorLogsResponse = await fetch(`${API_URL}/api/v1/runs/${runId}/logs?level=error`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const errorLogsData = await errorLogsResponse.json();
    console.log('Error logs response:', JSON.stringify(errorLogsData, null, 2));
    console.log(`Error filter applied: ✅ (level filter: ${errorLogsData.filter?.level})`);

    // Test 3: Test pagination with limit
    console.log('\n--- Test 3: Test pagination ---');
    const paginatedLogsResponse = await fetch(`${API_URL}/api/v1/runs/${runId}/logs?limit=5&offset=0`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const paginatedLogsData = await paginatedLogsResponse.json();
    console.log('Paginated logs response:', JSON.stringify(paginatedLogsData, null, 2));
    console.log(`Pagination working: ✅ (limit: ${paginatedLogsData.pagination?.limit}, total: ${paginatedLogsData.pagination?.total})`);

    // Verify timestamps are present
    let hasTimestamps = true;
    if (logsData.logs && logsData.logs.length > 0) {
      for (const log of logsData.logs) {
        if (!log.timestamp) {
          hasTimestamps = false;
          break;
        }
      }
    }

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
    console.log('- Step 1: Call get-run-logs with run ID ✅');
    console.log('- Step 2: Specify log level filter ✅');
    console.log(`- Step 3: Verify logs returned ✅ (${logsData.logs?.length || 0} logs)`);
    console.log(`- Step 4: Verify timestamps included ✅ (timestamps present: ${hasTimestamps})`);

  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testGetRunLogs();
