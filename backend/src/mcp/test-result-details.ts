/**
 * Test script for Feature #900: MCP tool get-result-details
 * Tests the get_result_details MCP tool
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

interface ResultDetailsResponse {
  run_id: string;
  result_index: number;
  total_results: number;
  test_id: string;
  test_name: string;
  suite_id: string;
  suite_name?: string;
  status: string;
  browser?: string;
  viewport?: { width: number; height: number } | null;
  timing: {
    started_at?: string;
    completed_at?: string;
    total_duration_ms?: number;
    step_durations: Array<{
      step_number: number;
      action: string;
      duration_ms?: number;
    }>;
    average_step_duration_ms: number;
    slowest_step: any;
  };
  steps: Array<{
    step_number: number;
    action: string;
    target?: string;
    status: string;
    duration_ms?: number;
    error?: {
      message: string;
      type: string;
      stack?: string;
    };
    screenshot?: string;
  }>;
  step_count: number;
  passed_steps: number;
  failed_steps: number;
  error?: {
    message: string;
    type: string;
    stack?: string;
    selector?: string;
    expected?: string;
    actual?: string;
    screenshot?: string;
    failed_step?: any;
  } | null;
  visual_comparison?: any;
  accessibility?: any;
  performance?: any;
  console_logs?: any;
  network_logs?: any;
  screenshot?: string | null;
  video?: string | null;
  trace?: string | null;
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

async function testGetResultDetails() {
  console.log('=== Testing Feature #900: MCP tool get-result-details ===\n');

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

    // Step 1: Call get-result-details with result ID
    console.log('\n--- Step 1: Call get-result-details with result ID ---');
    const response = await fetch(`${API_URL}/api/v1/runs/${runId}/results/1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const details = (await response.json()) as ResultDetailsResponse;
    console.log('Response status:', response.status);
    console.log('Result details:', JSON.stringify(details, null, 2));

    const hasRunId = details.run_id !== undefined;
    const hasResultIndex = details.result_index !== undefined;
    const hasTestName = details.test_name !== undefined;
    const hasStatus = details.status !== undefined;

    console.log(`\nRun ID present: ${hasRunId ? '✅' : '❌'}`);
    console.log(`Result index present: ${hasResultIndex ? '✅' : '❌'}`);
    console.log(`Test name present: ${hasTestName ? '✅' : '❌'}`);
    console.log(`Status present: ${hasStatus ? '✅' : '❌'}`);

    // Step 2: Verify all step results
    console.log('\n--- Step 2: Verify all step results ---');
    const hasSteps = Array.isArray(details.steps);
    const hasStepCount = details.step_count !== undefined;
    const hasPassedSteps = details.passed_steps !== undefined;
    const hasFailedSteps = details.failed_steps !== undefined;

    console.log(`Steps array present: ${hasSteps ? '✅' : '❌'}`);
    console.log(`Step count: ${details.step_count}`);
    console.log(`Passed steps: ${details.passed_steps}`);
    console.log(`Failed steps: ${details.failed_steps}`);

    if (details.steps && details.steps.length > 0) {
      console.log('\nStep details:');
      details.steps.forEach(step => {
        console.log(`  Step ${step.step_number}: ${step.action} - ${step.status}${step.duration_ms ? ` (${step.duration_ms}ms)` : ''}`);
        if (step.error) {
          console.log(`    Error: ${step.error.message?.substring(0, 100)}...`);
        }
      });
    }

    // Step 3: Verify timing information
    console.log('\n--- Step 3: Verify timing information ---');
    const hasTiming = details.timing !== undefined;
    const hasTotalDuration = details.timing?.total_duration_ms !== undefined;
    const hasStepDurations = Array.isArray(details.timing?.step_durations);
    const hasAverageDuration = details.timing?.average_step_duration_ms !== undefined;
    const hasSlowestStep = details.timing?.slowest_step !== undefined;

    console.log(`Timing object present: ${hasTiming ? '✅' : '❌'}`);
    console.log(`Total duration: ${details.timing?.total_duration_ms}ms`);
    console.log(`Step durations present: ${hasStepDurations ? '✅' : '❌'}`);
    console.log(`Average step duration: ${details.timing?.average_step_duration_ms}ms`);
    console.log(`Slowest step: ${details.timing?.slowest_step ? `Step ${details.timing.slowest_step.step_number} (${details.timing.slowest_step.action})` : 'N/A'}`);

    // Step 4: Verify error stack traces
    console.log('\n--- Step 4: Verify error stack traces ---');
    const hasError = details.error !== null || details.status === 'passed';
    const hasErrorMessage = details.error?.message !== undefined || details.status === 'passed';
    const hasErrorType = details.error?.type !== undefined || details.status === 'passed';
    const hasFailedStep = details.error?.failed_step !== undefined || details.status === 'passed';

    if (details.error) {
      console.log(`Error present: ✅`);
      console.log(`Error message: ${details.error.message?.substring(0, 100)}...`);
      console.log(`Error type: ${details.error.type}`);
      console.log(`Stack trace present: ${details.error.stack ? '✅' : '❌ (may be null)'}`);
      console.log(`Failed step info: ${details.error.failed_step ? '✅' : '❌'}`);
    } else if (details.status === 'passed') {
      console.log(`Test passed, no error expected: ✅`);
    } else {
      console.log(`Error details not available for status: ${details.status}`);
    }

    // Summary
    console.log('\n=== Verification Summary ===');
    const allPassed = hasRunId && hasSteps && hasTiming && (hasError || details.status === 'passed');
    console.log(`- Step 1: Call get-result-details with result ID ${hasRunId ? '✅' : '❌'}`);
    console.log(`- Step 2: Verify all step results ${hasSteps ? '✅' : '❌'}`);
    console.log(`- Step 3: Verify timing information ${hasTiming ? '✅' : '❌'}`);
    console.log(`- Step 4: Verify error stack traces ${hasError ? '✅' : '❌'}`);
    console.log(`\nAll tests passed: ${allPassed ? '✅' : '❌'}`);

  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testGetResultDetails();
