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
  }, { name: 'Dismiss Vuln Test ' + Date.now(), base_url: 'https://test.example.com' });
  const projectId = createProjectRes.data.project?.id;
  console.log('Project ID:', projectId);

  // Run security scan
  console.log('\n=== Step 3: Run Security Scan ===');
  const scanRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/v1/security/scans/project/' + projectId,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { scan_type: 'full', target_url: 'https://test.example.com' });
  console.log('Scan ID:', scanRes.data.scan_id);

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
  console.log('First vulnerability ID:', vulnId);

  // FEATURE #923 TEST STEP 1: Call dismiss-vulnerability with vuln ID
  console.log('\n=== Feature #923 Step 1: Call dismiss-vulnerability with vuln ID ===');
  const dismissRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/vulnerabilities/' + encodeURIComponent(vulnId) + '/dismiss',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    reason: 'false_positive',
    comment: 'This is a test dismissal - the vulnerability has been verified as a false positive'
  });
  console.log('Status:', dismissRes.status);
  console.log('Success:', dismissRes.data.success);
  console.log('Dismissed:', dismissRes.data.dismissed);

  // FEATURE #923 TEST STEP 2: Provide dismissal reason
  console.log('\n=== Feature #923 Step 2: Verify dismissal reason ===');
  console.log('Reason provided:', dismissRes.data.dismissal?.reason);
  console.log('Comment provided:', dismissRes.data.dismissal?.comment);

  // FEATURE #923 TEST STEP 3: Verify vulnerability dismissed
  console.log('\n=== Feature #923 Step 3: Verify vulnerability dismissed ===');
  const detailsRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/vulnerabilities/' + encodeURIComponent(vulnId),
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Vulnerability metadata status:', detailsRes.data.vulnerability?.metadata?.status);
  console.log('Has dismissal info:', !!detailsRes.data.vulnerability?.metadata?.dismissal);

  // FEATURE #923 TEST STEP 4: Verify exclusion saved
  console.log('\n=== Feature #923 Step 4: Verify exclusion saved ===');
  const dismissedListRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/vulnerabilities/dismissed',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Dismissed count:', dismissedListRes.data.total);
  console.log('Exclusion found:', dismissedListRes.data.dismissals?.some(d => d.vulnerability_id === vulnId));

  // Additional tests
  console.log('\n=== Additional Tests ===');

  // Test dismissal with expiration
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
    console.log('Dismissal with expiration - Status:', dismissRes2.status);
    console.log('Expires at:', dismissRes2.data.dismissal?.expires_at);
  }

  // Test undismiss (restore)
  console.log('\n=== Test Undismiss/Restore ===');
  const restoreRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/vulnerabilities/' + encodeURIComponent(vulnId) + '/dismiss',
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Restore status:', restoreRes.status);
  console.log('Restored:', restoreRes.data.restored);

  // Verify restored (should no longer be dismissed)
  const detailsAfterRestore = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/vulnerabilities/' + encodeURIComponent(vulnId),
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status after restore:', detailsAfterRestore.data.vulnerability?.metadata?.status);

  // Final verification summary
  console.log('\n========================================');
  console.log('FEATURE #923 VERIFICATION SUMMARY');
  console.log('========================================');
  console.log('✓ Step 1: Call dismiss-vulnerability with vuln ID:', dismissRes.status === 200 && dismissRes.data.success);
  console.log('✓ Step 2: Provide dismissal reason:', dismissRes.data.dismissal?.reason === 'false_positive');
  console.log('✓ Step 3: Verify vulnerability dismissed:', dismissRes.data.dismissed === true);
  console.log('✓ Step 4: Verify exclusion saved:', dismissedListRes.data.total >= 1);
  console.log('');
  console.log('All steps passed:',
    dismissRes.status === 200 &&
    dismissRes.data.dismissal?.reason === 'false_positive' &&
    dismissRes.data.dismissed === true &&
    dismissedListRes.data.total >= 1
  );
})();
