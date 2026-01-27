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

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  };

  // Check runs
  const runsResult = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/v1/runs',
    method: 'GET',
    headers
  });

  console.log('Runs count:', runsResult.runs?.length || 0);
  if (runsResult.runs && runsResult.runs.length > 0) {
    const run = runsResult.runs[0];
    console.log('First run:', JSON.stringify(run, null, 2).substring(0, 500));
  }

  // Check tests
  const testsResult = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/v1/tests',
    method: 'GET',
    headers
  });

  console.log('Tests:', JSON.stringify(testsResult, null, 2).substring(0, 1000));
}

main().catch(console.error);
