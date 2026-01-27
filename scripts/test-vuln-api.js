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
  console.log('=== Step 1: Login ===');
  const loginRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/v1/auth/login',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, { email: 'owner@example.com', password: 'Owner123!' });
  console.log('Token:', loginRes.data.token ? 'received' : 'missing');
  const token = loginRes.data.token;

  // Get projects
  console.log('\n=== Step 2: Get Projects ===');
  const projectsRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/v1/projects',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  const projectId = projectsRes.data.projects[0]?.id;
  console.log('Project ID:', projectId);

  if (!projectId) {
    console.log('No project found, please create one first');
    process.exit(1);
  }

  // Run security scan
  console.log('\n=== Step 3: Run Security Scan ===');
  const scanRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/v1/security/scans/project/' + projectId,
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { scan_type: 'full', target_url: 'https://test.example.com' });
  console.log('Scan response:', JSON.stringify(scanRes.data, null, 2));
  const scanId = scanRes.data.scan_id;

  // Wait for scan
  console.log('\n=== Step 4: Wait for Scan to Complete ===');
  await new Promise(r => setTimeout(r, 3000));

  // Get vulnerabilities
  console.log('\n=== Step 5: Get Vulnerabilities List ===');
  const vulnRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/v1/security/vulnerabilities',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Total vulnerabilities:', vulnRes.data.total);
  console.log('First vulnerability:', JSON.stringify(vulnRes.data.vulnerabilities?.[0], null, 2));

  const vulnId = vulnRes.data.vulnerabilities?.[0]?.id;
  if (!vulnId) {
    console.log('No vulnerabilities found');
    process.exit(1);
  }
  console.log('\nVulnerability ID to test:', vulnId);

  // Get vulnerability details (Feature #922)
  console.log('\n=== Step 6: Get Vulnerability Details (Feature #922) ===');
  const detailsRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/v1/security/vulnerabilities/' + encodeURIComponent(vulnId),
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', detailsRes.status);
  console.log('Vulnerability Details:');
  console.log(JSON.stringify(detailsRes.data, null, 2));

  // Verify required fields
  console.log('\n=== Verification ===');
  const vuln = detailsRes.data.vulnerability;
  if (vuln) {
    console.log('✓ Has description:', !!vuln.description);
    console.log('✓ Has remediation_steps:', Array.isArray(vuln.remediation_steps) && vuln.remediation_steps.length > 0);
    console.log('✓ Has affected_files:', Array.isArray(vuln.affected_files));
    console.log('✓ Has references:', Array.isArray(vuln.references));
    console.log('✓ Has scan_info:', !!vuln.scan_info);
    console.log('✓ Has metadata:', !!vuln.metadata);
  } else {
    console.log('✗ No vulnerability data returned');
  }
})();
