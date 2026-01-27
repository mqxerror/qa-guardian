const http = require('http');

async function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  // Login
  const loginRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/v1/auth/login',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, { email: 'owner@example.com', password: 'Owner123!' });
  const token = loginRes.data.token;

  // Get all vulnerabilities
  const vulnRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/v1/security/vulnerabilities',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });

  console.log('Testing all vulnerability types...\n');

  // Test each vulnerability
  for (const vuln of vulnRes.data.vulnerabilities.slice(0, 8)) {
    const detailsRes = await makeRequest({
      hostname: 'localhost', port: 3001,
      path: '/api/v1/security/vulnerabilities/' + encodeURIComponent(vuln.id),
      method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
    });

    const v = detailsRes.data.vulnerability;
    console.log(`=== ${v.type} - ${v.severity.toUpperCase()} ===`);
    console.log(`Message: ${v.message}`);
    console.log(`Description: ${v.description.substring(0, 100)}...`);
    console.log(`Remediation steps: ${v.remediation_steps.length}`);
    console.log(`Affected files: ${v.affected_files.length}`);
    console.log(`References: ${v.references.length}`);
    if (v.references.length > 0) {
      console.log(`  - ${v.references[0].type}: ${v.references[0].id}`);
    }
    console.log('');
  }

  // Test 404 for invalid vulnerability ID
  console.log('=== Testing 404 for Invalid ID ===');
  const invalidRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/vulnerabilities/invalid-vuln-id',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', invalidRes.status);
  console.log('Response:', JSON.stringify(invalidRes.data, null, 2));
})();
