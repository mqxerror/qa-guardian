/**
 * Create a visual test and run it with storage quota exceeded simulation
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001';

interface ApiResponse {
  [key: string]: unknown;
}

async function login(): Promise<string> {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'developer@example.com',
      password: 'Developer123!',
    }),
  });

  const data = await response.json() as { token?: string };
  if (!data.token) {
    throw new Error('Login failed');
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

async function main() {
  console.log('Setting up visual test for quota exceeded verification...\n');

  const token = await login();
  console.log('✓ Logged in');

  // Create project
  const projectResult = await apiRequest('/api/v1/projects', 'POST', {
    name: 'Quota Test Project',
    description: 'Testing storage quota exceeded',
    base_url: 'https://example.com',
  }, token);
  const projectId = projectResult.data.id;
  console.log(`✓ Created project: ${projectId}`);

  // Create test suite
  const suiteResult = await apiRequest(`/api/v1/projects/${projectId}/suites`, 'POST', {
    name: 'Visual Suite',
    description: 'Visual regression suite',
    browser: 'chromium',
    viewport_width: 1280,
    viewport_height: 720,
  }, token);
  const suiteId = suiteResult.data.id;
  console.log(`✓ Created suite: ${suiteId}`);

  // Create visual test
  const testResult = await apiRequest(`/api/v1/suites/${suiteId}/tests`, 'POST', {
    name: 'Quota Test Visual',
    description: 'Test storage quota exceeded',
    type: 'visual',
    target_url: 'https://example.com',
    viewport_width: 1920,
    viewport_height: 1080,
    full_page: true,
    steps: [
      { action: 'navigate', value: 'https://example.com' },
      { action: 'screenshot', value: 'Full page screenshot' }
    ],
  }, token);
  const testId = testResult.data.id;
  console.log(`✓ Created test: ${testId}`);

  // Enable storage quota exceeded simulation
  await apiRequest('/api/v1/visual/test-storage-quota-exceeded', 'POST', {}, token);
  console.log('✓ Storage quota exceeded simulation ENABLED');

  // Run the suite
  console.log('\nRunning test suite...');
  const runResult = await apiRequest(`/api/v1/suites/${suiteId}/runs`, 'POST', {}, token);
  const runId = runResult.data.id;
  console.log(`✓ Run started: ${runId}`);

  // Poll for completion
  let runStatus = 'running';
  let runData: ApiResponse = {};
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const statusResult = await apiRequest(`/api/v1/runs/${runId}`, 'GET', undefined, token);
    runData = statusResult.data;
    runStatus = runData.status as string;
    if (runStatus !== 'running') {
      break;
    }
  }

  console.log(`\nRun completed with status: ${runStatus}`);

  // Check the results
  const results = runData.results as Array<{
    test_name: string;
    status: string;
    error?: string;
    isQuotaExceeded?: boolean;
    suggestions?: string[];
  }>;

  if (results && results.length > 0) {
    const result = results[0];
    console.log(`\nTest result: ${result.test_name}`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Error: ${result.error}`);
    console.log(`  isQuotaExceeded: ${result.isQuotaExceeded}`);
    console.log(`  suggestions: ${JSON.stringify(result.suggestions)}`);

    if (result.isQuotaExceeded === true && result.suggestions && result.suggestions.length > 0) {
      console.log('\n✓ SUCCESS: Storage quota exceeded error properly propagated to results!');
      console.log(`\nOpen this URL in browser to verify UI: http://localhost:5173/suites/${suiteId}`);
    } else {
      console.log('\n✗ FAILED: isQuotaExceeded or suggestions not found in result');
    }
  }

  // Disable simulation
  await apiRequest('/api/v1/visual/test-storage-quota-exceeded', 'DELETE', undefined, token);
  console.log('\n✓ Storage quota exceeded simulation DISABLED');

  console.log(`\nSuite URL: http://localhost:5173/suites/${suiteId}`);
}

main().catch(console.error);
