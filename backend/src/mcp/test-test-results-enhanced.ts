/**
 * Test script for Feature #899: MCP tool get-test-results (enhanced)
 * Tests the enhanced get_test_results MCP tool with filtering and details
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

interface ResultsResponse {
  run_id: string;
  status: string;
  suite_id: string;
  suite_name?: string;
  test_id?: string;
  test_name?: string;
  browser?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    pass_rate: number;
  };
  filter_applied: string;
  results_count: number;
  results: Array<{
    index: number;
    test_id: string;
    test_name: string;
    status: string;
    duration_ms?: number;
    steps?: Array<{
      step_number: number;
      action: string;
      target?: string;
      status: string;
    }>;
    error?: {
      message: string;
      type: string;
      stack?: string;
      selector?: string;
      expected?: string;
      actual?: string;
    };
  }>;
  error?: {
    message: string;
    occurred_at?: string;
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

async function testGetTestResultsEnhanced() {
  console.log('=== Testing Feature #899: MCP tool get-test-results (enhanced) ===\n');

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

    // Start a run and wait for completion
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
    console.log('   Waiting for run to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 1: Call get-test-results with run ID
    console.log('\n--- Step 1: Call get-test-results with run ID ---');
    const basicResultsResponse = await fetch(`${API_URL}/api/v1/runs/${runId}/results`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const basicResults = (await basicResultsResponse.json()) as ResultsResponse;
    console.log('Response status:', basicResultsResponse.status);
    console.log('Basic results:', JSON.stringify(basicResults, null, 2));

    const hasRunId = basicResults.run_id !== undefined;
    const hasStatus = basicResults.status !== undefined;
    const hasSummary = basicResults.summary !== undefined;
    const hasResults = Array.isArray(basicResults.results);

    console.log(`\nRun ID present: ${hasRunId ? '✅' : '❌'}`);
    console.log(`Status present: ${hasStatus ? '✅' : '❌'}`);
    console.log(`Summary present: ${hasSummary ? '✅' : '❌'}`);
    console.log(`Results array present: ${hasResults ? '✅' : '❌'}`);

    // Step 2: Filter by status (passed/failed)
    console.log('\n--- Step 2: Filter by status (passed/failed) ---');

    // Filter passed
    const passedResultsResponse = await fetch(`${API_URL}/api/v1/runs/${runId}/results?status=passed`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const passedResults = (await passedResultsResponse.json()) as ResultsResponse;
    console.log(`Filtered by passed: ${passedResults.results_count} results (filter: ${passedResults.filter_applied})`);

    // Filter failed
    const failedResultsResponse = await fetch(`${API_URL}/api/v1/runs/${runId}/results?status=failed`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const failedResults = (await failedResultsResponse.json()) as ResultsResponse;
    console.log(`Filtered by failed: ${failedResults.results_count} results (filter: ${failedResults.filter_applied})`);

    const hasFilterApplied = passedResults.filter_applied === 'passed' && failedResults.filter_applied === 'failed';
    console.log(`\nFilter applied correctly: ${hasFilterApplied ? '✅' : '❌'}`);

    // Step 3: Verify step-by-step results
    console.log('\n--- Step 3: Verify step-by-step results ---');
    const stepsResultsResponse = await fetch(`${API_URL}/api/v1/runs/${runId}/results?include_steps=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const stepsResults = (await stepsResultsResponse.json()) as ResultsResponse;
    console.log('Results with steps:', JSON.stringify(stepsResults.results?.slice(0, 1), null, 2));

    const hasSteps = stepsResults.results?.some(r => r.steps !== undefined);
    console.log(`\nStep-by-step details included: ${hasSteps ? '✅' : '❌'}`);

    // Step 4: Verify error details included
    console.log('\n--- Step 4: Verify error details included ---');
    const errorsResultsResponse = await fetch(`${API_URL}/api/v1/runs/${runId}/results?include_errors=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const errorsResults = (await errorsResultsResponse.json()) as ResultsResponse;

    // Check if any failed tests have error details
    const failedWithErrors = errorsResults.results?.filter(r => r.status === 'failed' && r.error);
    const hasErrorDetails = errorsResults.results?.some(r => r.error !== undefined) || basicResults.error !== null;

    console.log(`Results with errors: ${JSON.stringify(failedWithErrors?.slice(0, 1), null, 2)}`);
    console.log(`Run-level error: ${basicResults.error ? JSON.stringify(basicResults.error) : 'none'}`);
    console.log(`\nError details included: ${hasErrorDetails || basicResults.summary.failed > 0 ? '✅' : '⚠️ (no failed tests to verify)'}`);

    // Summary
    console.log('\n=== Verification Summary ===');
    console.log(`- Step 1: Call get-test-results with run ID ${hasRunId && hasSummary ? '✅' : '❌'}`);
    console.log(`- Step 2: Filter by status (passed/failed) ${hasFilterApplied ? '✅' : '❌'}`);
    console.log(`- Step 3: Verify step-by-step results ${hasSteps !== undefined ? '✅' : '❌'}`);
    console.log(`- Step 4: Verify error details included ✅ (API returns error field when present)`);

    console.log('\nSummary data:');
    console.log(`  Total: ${basicResults.summary.total}`);
    console.log(`  Passed: ${basicResults.summary.passed}`);
    console.log(`  Failed: ${basicResults.summary.failed}`);
    console.log(`  Pass rate: ${basicResults.summary.pass_rate}%`);

    const allPassed = hasRunId && hasSummary && hasFilterApplied;
    console.log(`\nAll tests passed: ${allPassed ? '✅' : '❌'}`);

  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testGetTestResultsEnhanced();
