const http = require('http');

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // Login
  const loginResult = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: {'Content-Type': 'application/json'}
  }, JSON.stringify({email:'owner@example.com',password:'Owner123!'}));

  const token = loginResult.token;
  console.log('Token obtained');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  };

  // Create project
  const projectResult = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/v1/projects',
    method: 'POST',
    headers
  }, JSON.stringify({
    name: 'FlakyDemo' + Date.now(),
    description: 'Project demonstrating flaky test detection'
  }));

  const projectId = projectResult.project?.id || projectResult.id;
  console.log('Project created:', projectId);

  if (!projectId) {
    console.error('Failed to create project');
    return;
  }

  // Create test suite
  const suiteResult = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: `/api/v1/projects/${projectId}/suites`,
    method: 'POST',
    headers
  }, JSON.stringify({
    name: 'Flaky Test Suite',
    description: 'Suite with tests that have inconsistent results'
  }));

  const suiteId = suiteResult.suite?.id || suiteResult.id;
  console.log('Suite created:', suiteId);

  if (!suiteId) {
    console.error('Failed to create suite');
    return;
  }

  // Create tests
  const testNames = [
    { name: 'Login Form Validation', passRate: 0.5 },
    { name: 'Checkout Process', passRate: 0.7 },
    { name: 'Search Functionality', passRate: 0.3 },
    { name: 'User Profile Update', passRate: 0.6 },
    { name: 'Payment Processing', passRate: 0.8 }
  ];

  const testIds = [];
  for (const t of testNames) {
    const testResult = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/v1/suites/${suiteId}/tests`,
      method: 'POST',
      headers
    }, JSON.stringify({
      name: t.name,
      description: `Test case for ${t.name}`
    }));

    const testId = testResult.test?.id || testResult.id;
    console.log('Test created:', testId, t.name);

    if (testId) {
      testIds.push({ id: testId, name: t.name, passRate: t.passRate });
    }
  }

  if (testIds.length === 0) {
    console.error('No tests created');
    return;
  }

  // Create test runs via the suite endpoint
  const totalRuns = 10;
  for (let runIndex = 0; runIndex < totalRuns; runIndex++) {
    // Create run via suite endpoint
    const runResult = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/v1/suites/${suiteId}/runs`,
      method: 'POST',
      headers
    }, JSON.stringify({
      browser: 'chromium'
    }));

    const runId = runResult.run?.id || runResult.id;
    console.log(`Run ${runIndex + 1}/${totalRuns} created:`, runId);

    // Wait a bit for the run to complete
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('DONE:', JSON.stringify({
    message: 'Flaky test data injection complete',
    project_id: projectId,
    suite_id: suiteId,
    tests_created: testIds.length,
    runs_created: totalRuns
  }));
}

main().catch(console.error);
