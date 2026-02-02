const http = require('http');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = 'Bearer ' + token;
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Login
  const login = await request('POST', '/api/v1/auth/login', {
    email: 'admin@example.com',
    password: 'Admin123!'
  });
  console.log('Login:', login.token ? 'OK' : JSON.stringify(login));
  const token = login.token;
  if (!token) return;

  // Create project
  const proj = await request('POST', '/api/v1/projects', {
    name: 'Flaky Test Project',
    description: 'For testing flaky test detail'
  }, token);
  console.log('Project:', proj.id || JSON.stringify(proj));
  const projectId = proj.id;
  if (!projectId) return;

  // Create suite
  const suite = await request('POST', `/api/v1/projects/${projectId}/suites`, {
    name: 'Login Tests',
    description: 'Login test suite'
  }, token);
  console.log('Suite:', suite.id || JSON.stringify(suite));
  const suiteId = suite.id;
  if (!suiteId) return;

  // Create test
  const test = await request('POST', `/api/v1/projects/${projectId}/suites/${suiteId}/tests`, {
    name: 'Login Form Validation',
    description: 'Test login form validation',
    type: 'e2e',
    steps: ['Open login page', 'Submit empty form', 'Verify error']
  }, token);
  console.log('Test:', test.id || JSON.stringify(test));
  const testId = test.id;
  if (!testId) return;

  // Create multiple test runs with mixed results to generate flakiness
  for (let i = 0; i < 10; i++) {
    const result = i % 3 === 0 ? 'failed' : 'passed';
    const run = await request('POST', `/api/v1/projects/${projectId}/suites/${suiteId}/runs`, {
      status: 'completed',
      environment: 'staging',
      results: [{
        test_id: testId,
        status: result,
        duration_ms: 1000 + Math.floor(Math.random() * 2000),
        error: result === 'failed' ? 'Timeout waiting for element' : null
      }]
    }, token);
    console.log(`Run ${i+1}:`, run.id ? 'OK (' + result + ')' : JSON.stringify(run));
  }

  console.log('\nTest Detail URL: http://localhost:5173/projects/' + projectId + '/suites/' + suiteId + '/tests/' + testId);
}

main().catch(console.error);
