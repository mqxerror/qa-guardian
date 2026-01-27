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

  // Check flaky tests
  const flakyResult = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/v1/analytics/flaky-tests',
    method: 'GET',
    headers
  });

  console.log('Flaky Tests API Response:');
  console.log(JSON.stringify(flakyResult, null, 2));
}

main().catch(console.error);
