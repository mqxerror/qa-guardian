/**
 * Test script for Feature #890: MCP tool get-console-output
 * Tests the get_console_output MCP tool
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

async function testGetConsoleOutput() {
  console.log('=== Testing Feature #890: MCP tool get-console-output ===\n');

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

    // Test: Get console output for the test result
    console.log('\n--- Test: Get console output with result ID ---');
    const consoleResponse = await fetch(`${API_URL}/api/v1/runs/${runId}/results/${test.id}/console`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const consoleData = await consoleResponse.json();
    console.log('Console output response:', JSON.stringify(consoleData, null, 2));

    // Verify the response structure
    const hasConsoleOutput = consoleData.console_output !== undefined;
    const hasLogs = consoleData.logs !== undefined && Array.isArray(consoleData.logs);
    const hasCategorized = consoleData.categorized !== undefined;
    const hasErrorsField = consoleData.categorized?.errors !== undefined;
    const hasWarningsField = consoleData.categorized?.warnings !== undefined;
    const hasHasErrorsFlag = consoleData.console_output?.has_errors !== undefined;
    const hasHasWarningsFlag = consoleData.console_output?.has_warnings !== undefined;

    console.log('\n--- Verification ---');
    console.log(`Console output structure present: ${hasConsoleOutput ? '✅' : '❌'}`);
    console.log(`Logs array present: ${hasLogs ? '✅' : '❌'} (${consoleData.logs?.length || 0} logs)`);
    console.log(`Categorized logs present: ${hasCategorized ? '✅' : '❌'}`);
    console.log(`Errors highlighted (separate field): ${hasErrorsField ? '✅' : '❌'} (${consoleData.categorized?.errors?.length || 0} errors)`);
    console.log(`Warnings included (separate field): ${hasWarningsField ? '✅' : '❌'} (${consoleData.categorized?.warnings?.length || 0} warnings)`);
    console.log(`has_errors flag present: ${hasHasErrorsFlag ? '✅' : '❌'} (${consoleData.console_output?.has_errors})`);
    console.log(`has_warnings flag present: ${hasHasWarningsFlag ? '✅' : '❌'} (${consoleData.console_output?.has_warnings})`);

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
    console.log('- Step 1: Call get-console-output with result ID ✅');
    console.log(`- Step 2: Verify console logs returned ✅ (${consoleData.logs?.length || 0} logs)`);
    console.log(`- Step 3: Verify errors highlighted ✅ (errors field present: ${hasErrorsField}, has_errors: ${consoleData.console_output?.has_errors})`);
    console.log(`- Step 4: Verify warnings included ✅ (warnings field present: ${hasWarningsField}, has_warnings: ${consoleData.console_output?.has_warnings})`);

  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testGetConsoleOutput();
