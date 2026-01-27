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

  // Get vulnerabilities
  console.log('\n=== Step 2: Get Vulnerabilities ===');
  const vulnRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/v1/security/vulnerabilities',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Total vulnerabilities:', vulnRes.data.total);

  const vulnId = vulnRes.data.vulnerabilities?.[0]?.id;
  if (!vulnId) {
    console.log('No vulnerabilities found - need to run a scan first');

    // Get projects
    const projectsRes = await makeRequest({
      hostname: 'localhost', port: 3001, path: '/api/v1/projects',
      method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
    });
    const projectId = projectsRes.data.projects[0]?.id;
    console.log('Project ID:', projectId);

    if (projectId) {
      // Run security scan
      console.log('\nRunning security scan...');
      await makeRequest({
        hostname: 'localhost', port: 3001, path: '/api/v1/security/scans/project/' + projectId,
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
      }, { scan_type: 'full', target_url: 'https://test.example.com' });
      await new Promise(r => setTimeout(r, 3000));

      // Get vulnerabilities again
      const vulnRes2 = await makeRequest({
        hostname: 'localhost', port: 3001, path: '/api/v1/security/vulnerabilities',
        method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
      });
      console.log('Total vulnerabilities after scan:', vulnRes2.data.total);
    }
    process.exit(0);
  }

  console.log('Vulnerability ID to dismiss:', vulnId);

  // Step 1: Call dismiss-vulnerability with vuln ID
  console.log('\n=== Step 3: Dismiss Vulnerability ===');
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

  // Step 2 & 3: Verify vulnerability dismissed
  console.log('\n=== Step 4: Verify Vulnerability is Dismissed ===');
  const detailsRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/vulnerabilities/' + encodeURIComponent(vulnId),
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Vulnerability status:', detailsRes.data.vulnerability?.metadata?.status);
  console.log('Has dismissal info:', !!detailsRes.data.vulnerability?.metadata?.dismissal);

  // Step 4: Verify exclusion saved (get dismissed list)
  console.log('\n=== Step 5: Verify Exclusion Saved ===');
  const dismissedListRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/vulnerabilities/dismissed',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Dismissed vulnerabilities count:', dismissedListRes.data.total);
  console.log('Dismissed list:', JSON.stringify(dismissedListRes.data.dismissals, null, 2));

  // Test with different reason
  console.log('\n=== Step 6: Test Different Dismissal Reasons ===');
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
  console.log('\n=== Verification Summary ===');
  console.log('✓ Step 1: Called dismiss-vulnerability with vuln ID:', dismissRes.status === 200);
  console.log('✓ Step 2: Provided dismissal reason:', dismissRes.data.dismissal?.reason === 'false_positive');
  console.log('✓ Step 3: Vulnerability dismissed:', dismissRes.data.dismissed === true);
  console.log('✓ Step 4: Exclusion saved:', dismissedListRes.data.total > 0);
})();
