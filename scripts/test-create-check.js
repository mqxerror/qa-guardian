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

  // FEATURE #941 TEST STEP 1: Call create-check with URL
  console.log('\n=== Feature #941 Step 1: Call create-check with URL ===');
  const createRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/monitoring/checks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    name: 'Production API Health',
    url: 'https://api.production.example.com/health'
  });
  console.log('Status:', createRes.status);
  console.log('Has check:', !!createRes.data.check);
  console.log('Check ID:', createRes.data.check?.id);
  console.log('Check name:', createRes.data.check?.name);
  console.log('Check URL:', createRes.data.check?.url);

  const checkId = createRes.data.check?.id;

  // FEATURE #941 TEST STEP 2: Configure interval and assertions
  console.log('\n=== Feature #941 Step 2: Configure interval and assertions ===');
  const advancedRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/monitoring/checks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    name: 'Payment Gateway Monitor',
    url: 'https://payments.example.com/ping',
    method: 'POST',
    interval: 30,
    timeout: 5000,
    expected_status: 200,
    headers: { 'X-API-Key': 'test-key' },
    assertions: [
      { type: 'status_code', operator: 'equals', value: '200' },
      { type: 'response_time', operator: 'less_than', value: '500' },
      { type: 'body_contains', operator: 'contains', value: 'healthy' }
    ],
    tags: ['production', 'payments', 'critical'],
    group: 'Payment Services'
  });
  console.log('Advanced check created:', (advancedRes.status === 200 || advancedRes.status === 201) || advancedRes.status === 201);
  console.log('Check ID:', advancedRes.data.check?.id);
  console.log('Interval:', advancedRes.data.check?.interval);
  console.log('Method:', advancedRes.data.check?.method);
  console.log('Timeout:', advancedRes.data.check?.timeout);
  console.log('Expected status:', advancedRes.data.check?.expected_status);
  console.log('Has assertions:', !!advancedRes.data.check?.assertions);
  console.log('Assertions count:', advancedRes.data.check?.assertions?.length);
  console.log('Tags:', advancedRes.data.check?.tags?.join(', '));
  console.log('Group:', advancedRes.data.check?.group);

  // FEATURE #941 TEST STEP 3: Verify check created
  console.log('\n=== Feature #941 Step 3: Verify check created ===');

  // List all checks to verify creation
  const listRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/monitoring/checks',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Total checks:', listRes.data.checks?.length);

  // Find our created check
  const foundCheck = listRes.data.checks?.find(c => c.id === checkId);
  console.log('Original check found:', !!foundCheck);
  if (foundCheck) {
    console.log('  Name:', foundCheck.name);
    console.log('  URL:', foundCheck.url);
    console.log('  Enabled:', foundCheck.enabled);
  }

  const foundAdvanced = listRes.data.checks?.find(c => c.id === advancedRes.data.check?.id);
  console.log('Advanced check found:', !!foundAdvanced);
  if (foundAdvanced) {
    console.log('  Interval:', foundAdvanced.interval);
    console.log('  Has assertions:', !!foundAdvanced.assertions);
  }

  // FEATURE #941 TEST STEP 4: Verify check running
  console.log('\n=== Feature #941 Step 4: Verify check running ===');
  console.log('Check enabled:', foundCheck?.enabled);
  console.log('Check has latest_status:', foundCheck?.latest_status !== undefined);
  console.log('Latest status:', foundCheck?.latest_status || 'unknown');

  // Get single check details
  const detailRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: `/api/v1/monitoring/checks/${checkId}`,
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('\nCheck details:');
  console.log('  Status:', detailRes.status);
  console.log('  Enabled:', detailRes.data.check?.enabled);
  console.log('  Created at:', detailRes.data.check?.created_at);

  // Additional: Test creating disabled check
  console.log('\n=== Additional: Create disabled check ===');
  const disabledRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/monitoring/checks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    name: 'Staging Environment',
    url: 'https://staging.example.com/health',
    enabled: false
  });
  console.log('Disabled check created:', (disabledRes.status === 200 || disabledRes.status === 201));
  console.log('Check enabled:', disabledRes.data.check?.enabled);

  // Additional: Test with custom headers
  console.log('\n=== Additional: Test with custom headers ===');
  const headersRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/monitoring/checks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    name: 'Authenticated Endpoint',
    url: 'https://secure.example.com/api',
    headers: {
      'Authorization': 'Bearer secret-token',
      'X-Custom-Header': 'value'
    }
  });
  console.log('Check with headers created:', (headersRes.status === 200 || headersRes.status === 201));
  console.log('Headers set:', !!headersRes.data.check?.headers);

  // Final verification summary
  console.log('\n========================================');
  console.log('FEATURE #941 VERIFICATION SUMMARY');
  console.log('========================================');
  const step1Pass = (createRes.status === 200 || createRes.status === 201) && !!createRes.data.check?.id && !!createRes.data.check?.url;
  const step2Pass = (advancedRes.status === 200 || advancedRes.status === 201) && advancedRes.data.check?.interval === 30 && advancedRes.data.check?.assertions?.length === 3;
  const step3Pass = !!foundCheck && foundCheck.name === 'Production API Health';
  const step4Pass = foundCheck?.enabled === true;

  console.log('Step 1: Call create-check with URL:', step1Pass);
  console.log('Step 2: Configure interval and assertions:', step2Pass);
  console.log('Step 3: Verify check created:', step3Pass);
  console.log('Step 4: Verify check running:', step4Pass);
  console.log('');
  console.log('All steps passed:', step1Pass && step2Pass && step3Pass && step4Pass ? 'true' : 'false');
})();
