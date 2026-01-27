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

  // Create project
  console.log('\n=== Step 2: Create Project ===');
  const createProjectRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/v1/projects',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { name: 'Dismiss Vuln Test Project', base_url: 'https://test.example.com' });
  console.log('Project created:', createProjectRes.status === 200 || createProjectRes.status === 201);
  const projectId = createProjectRes.data.id;
  console.log('Project ID:', projectId);

  // Run security scan
  console.log('\n=== Step 3: Run Security Scan ===');
  const scanRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/v1/security/scans/project/' + projectId,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { scan_type: 'full', target_url: 'https://test.example.com' });
  console.log('Scan started:', scanRes.data.scan_id);

  // Wait for scan
  await new Promise(r => setTimeout(r, 3000));

  // Get vulnerabilities
  console.log('\n=== Step 4: Get Vulnerabilities ===');
  const vulnRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/v1/security/vulnerabilities',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Total vulnerabilities:', vulnRes.data.total);

  const vulnId = vulnRes.data.vulnerabilities?.[0]?.id;
  if (!vulnId) {
    console.log('ERROR: No vulnerabilities found');
    process.exit(1);
  }
  console.log('First vulnerability ID:', vulnId);

  // Test Step 1 & 2: Call dismiss-vulnerability with vuln ID and reason
  console.log('\n=== Step 5: Dismiss Vulnerability (Feature #923) ===');
  const dismissRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/vulnerabilities/' + encodeURIComponent(vulnId) + '/dismiss',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    reason: 'false_positive',
    comment: 'This is a test dismissal - the vulnerability has been verified as a false positive'
  });
  console.log('Dismiss response status:', dismissRes.status);
  console.log('Dismiss response:', JSON.stringify(dismissRes.data, null, 2));

  // Test Step 3: Verify vulnerability dismissed
  console.log('\n=== Step 6: Verify Vulnerability is Dismissed ===');
  const detailsRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/vulnerabilities/' + encodeURIComponent(vulnId),
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Vulnerability status:', detailsRes.data.vulnerability?.metadata?.status);
  console.log('Has dismissal info:', !!detailsRes.data.vulnerability?.metadata?.dismissal);
  if (detailsRes.data.vulnerability?.metadata?.dismissal) {
    console.log('Dismissal reason:', detailsRes.data.vulnerability.metadata.dismissal.reason);
  }

  // Test Step 4: Verify exclusion saved (get dismissed list)
  console.log('\n=== Step 7: Verify Exclusion Saved ===');
  const dismissedListRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/vulnerabilities/dismissed',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Dismissed vulnerabilities count:', dismissedListRes.data.total);
  console.log('First dismissed:', JSON.stringify(dismissedListRes.data.dismissals?.[0], null, 2));

  // Test with expiration date
  console.log('\n=== Step 8: Test Dismissal with Expiration ===');
  const vulnId2 = vulnRes.data.vulnerabilities?.[1]?.id;
  if (vulnId2) {
    const dismissRes2 = await makeRequest({
      hostname: 'localhost', port: 3001,
      path: '/api/v1/security/vulnerabilities/' + encodeURIComponent(vulnId2) + '/dismiss',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    }, {
      reason: 'accepted_risk',
      comment: 'Accepted risk - low impact in our environment',
      expires_at: '2026-06-01'
    });
    console.log('Second dismiss status:', dismissRes2.status);
    console.log('Expires at:', dismissRes2.data.dismissal?.expires_at);
  }

  // Verification summary
  console.log('\n=== VERIFICATION SUMMARY (Feature #923) ===');
  console.log('✓ Step 1: Called dismiss-vulnerability with vuln ID:', dismissRes.status === 200);
  console.log('✓ Step 2: Provided dismissal reason:', dismissRes.data.dismissal?.reason === 'false_positive');
  console.log('✓ Step 3: Vulnerability dismissed:', detailsRes.data.vulnerability?.metadata?.status === 'dismissed');
  console.log('✓ Step 4: Exclusion saved:', dismissedListRes.data.total > 0);
})();
