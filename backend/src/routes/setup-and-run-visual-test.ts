/**
 * Create a visual test and run it with storage quota exceeded simulation
 */

import fetch from 'node-fetch';
import { createLogger } from '../services/logger.js';

const visualTestLogger = createLogger('visual-test-setup');

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
  visualTestLogger.info('Setting up visual test for quota exceeded verification...');

  const token = await login();
  visualTestLogger.info('Logged in');

  // Create project
  const projectResult = await apiRequest('/api/v1/projects', 'POST', {
    name: 'Quota Test Project',
    description: 'Testing storage quota exceeded',
    base_url: 'https://example.com',
  }, token);
  const projectId = projectResult.data.id;
  visualTestLogger.info({ projectId }, 'Created project');

  // Create test suite
  const suiteResult = await apiRequest(`/api/v1/projects/${projectId}/suites`, 'POST', {
    name: 'Visual Suite',
    description: 'Visual regression suite',
    browser: 'chromium',
    viewport_width: 1280,
    viewport_height: 720,
  }, token);
  const suiteId = suiteResult.data.id;
  visualTestLogger.info({ suiteId }, 'Created suite');

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
  visualTestLogger.info({ testId }, 'Created test');

  // Enable storage quota exceeded simulation
  await apiRequest('/api/v1/visual/test-storage-quota-exceeded', 'POST', {}, token);
  visualTestLogger.info('Storage quota exceeded simulation ENABLED');

  // Run the suite
  visualTestLogger.info('Running test suite...');
  const runResult = await apiRequest(`/api/v1/suites/${suiteId}/runs`, 'POST', {}, token);
  const runId = runResult.data.id;
  visualTestLogger.info({ runId }, 'Run started');

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

  visualTestLogger.info({ runStatus }, 'Run completed');

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
    visualTestLogger.info({
      testName: result.test_name,
      status: result.status,
      error: result.error,
      isQuotaExceeded: result.isQuotaExceeded,
      suggestions: result.suggestions,
    }, 'Test result');

    if (result.isQuotaExceeded === true && result.suggestions && result.suggestions.length > 0) {
      visualTestLogger.info({ suiteId }, 'SUCCESS: Storage quota exceeded error properly propagated to results!');
      visualTestLogger.info({ url: `http://localhost:5173/suites/${suiteId}` }, 'Open this URL in browser to verify UI');
    } else {
      visualTestLogger.warn('FAILED: isQuotaExceeded or suggestions not found in result');
    }
  }

  // Disable simulation
  await apiRequest('/api/v1/visual/test-storage-quota-exceeded', 'DELETE', undefined, token);
  visualTestLogger.info('Storage quota exceeded simulation DISABLED');

  visualTestLogger.info({ url: `http://localhost:5173/suites/${suiteId}` }, 'Suite URL');
}

main().catch((err) => {
  visualTestLogger.error({ error: err instanceof Error ? err.message : String(err) }, 'Visual test setup failed');
});
