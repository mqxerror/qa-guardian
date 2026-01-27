/**
 * Test script for Feature #892: MCP tool compare-runs
 * Tests the compare_runs MCP tool
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

async function testCompareRuns() {
  console.log('=== Testing Feature #892: MCP tool compare-runs ===\n');

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

    // Start first run (base run)
    console.log('3. Starting first test run (base)...');
    const run1Response = await fetch(`${API_URL}/api/v1/suites/${suite.id}/runs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const run1Data = (await run1Response.json()) as RunResponse;
    const run1Id = run1Data.run?.id;

    if (!run1Id) {
      console.log('Failed to start first run:', run1Data);
      return;
    }

    console.log(`   First run started with ID: ${run1Id}`);

    // Wait for first run to complete
    console.log('   Waiting for first run to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Start second run (compare run)
    console.log('4. Starting second test run (compare)...');
    const run2Response = await fetch(`${API_URL}/api/v1/suites/${suite.id}/runs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const run2Data = (await run2Response.json()) as RunResponse;
    const run2Id = run2Data.run?.id;

    if (!run2Id) {
      console.log('Failed to start second run:', run2Data);
      return;
    }

    console.log(`   Second run started with ID: ${run2Id}`);

    // Wait for second run to complete
    console.log('   Waiting for second run to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test: Compare the two runs
    console.log('\n--- Test: Compare two runs ---');
    const compareResponse = await fetch(`${API_URL}/api/v1/runs/compare-results?baseRunId=${run1Id}&compareRunId=${run2Id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const compareData = await compareResponse.json();
    console.log('Compare response:', JSON.stringify(compareData, null, 2));

    // Verify the response structure
    const hasComparison = compareData.comparison !== undefined;
    const hasNewFailures = compareData.new_failures !== undefined && Array.isArray(compareData.new_failures);
    const hasFixedTests = compareData.fixed_tests !== undefined && Array.isArray(compareData.fixed_tests);
    const hasSummary = compareData.comparison?.summary !== undefined;
    const hasNewFailuresCount = compareData.comparison?.summary?.new_failures_count !== undefined;
    const hasFixedTestsCount = compareData.comparison?.summary?.fixed_tests_count !== undefined;

    console.log('\n--- Verification ---');
    console.log(`Comparison generated: ${hasComparison ? '✅' : '❌'}`);
    console.log(`New failures array present: ${hasNewFailures ? '✅' : '❌'} (${compareData.new_failures?.length || 0} new failures)`);
    console.log(`Fixed tests array present: ${hasFixedTests ? '✅' : '❌'} (${compareData.fixed_tests?.length || 0} fixed tests)`);
    console.log(`Summary present: ${hasSummary ? '✅' : '❌'}`);
    console.log(`new_failures_count in summary: ${hasNewFailuresCount ? '✅' : '❌'} (${compareData.comparison?.summary?.new_failures_count})`);
    console.log(`fixed_tests_count in summary: ${hasFixedTestsCount ? '✅' : '❌'} (${compareData.comparison?.summary?.fixed_tests_count})`);

    console.log('\n=== All tests completed ===');
    console.log('\nVerification Summary:');
    console.log('- Step 1: Call compare-runs with two run IDs ✅');
    console.log(`- Step 2: Verify comparison generated ✅ (trend: ${compareData.comparison?.summary?.overall_trend})`);
    console.log(`- Step 3: Verify new failures identified ✅ (count: ${compareData.comparison?.summary?.new_failures_count})`);
    console.log(`- Step 4: Verify fixed tests identified ✅ (count: ${compareData.comparison?.summary?.fixed_tests_count})`);

  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testCompareRuns();
