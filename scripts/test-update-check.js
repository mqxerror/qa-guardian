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

  // Setup: Create a check to update
  console.log('\n=== Setup: Create a check to update ===');
  const createRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/monitoring/checks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    name: 'Original Check Name',
    url: 'https://original.example.com/health',
    interval: 60,
    tags: ['test', 'original'],
    group: 'Test Group'
  });
  const checkId = createRes.data.check?.id;
  console.log('Created check ID:', checkId);
  console.log('Original name:', createRes.data.check?.name);
  console.log('Original interval:', createRes.data.check?.interval);

  // FEATURE #942 TEST STEP 1: Call update-check with check ID
  console.log('\n=== Feature #942 Step 1: Call update-check with check ID ===');
  const updateRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: `/api/v1/monitoring/checks/${checkId}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    name: 'Updated Check Name'
  });
  console.log('Status:', updateRes.status);
  console.log('Message:', updateRes.data.message);
  console.log('Updated check ID:', updateRes.data.check?.id);
  console.log('Updated name:', updateRes.data.check?.name);

  // FEATURE #942 TEST STEP 2: Update interval or assertions
  console.log('\n=== Feature #942 Step 2: Update interval or assertions ===');
  const intervalRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: `/api/v1/monitoring/checks/${checkId}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    interval: 120,
    assertions: [
      { type: 'status_code', operator: 'equals', value: '200' },
      { type: 'response_time', operator: 'less_than', value: '1000' }
    ]
  });
  console.log('Interval update status:', intervalRes.status);
  console.log('New interval:', intervalRes.data.check?.interval);
  console.log('Assertions count:', intervalRes.data.check?.assertions?.length);

  // Update tags and group
  const tagsRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: `/api/v1/monitoring/checks/${checkId}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    tags: ['production', 'updated'],
    group: 'Production Services'
  });
  console.log('Tags updated:', tagsRes.data.check?.tags?.join(', '));
  console.log('Group updated:', tagsRes.data.check?.group);

  // FEATURE #942 TEST STEP 3: Verify check updated
  console.log('\n=== Feature #942 Step 3: Verify check updated ===');

  // Get the check to verify updates
  const getRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: `/api/v1/monitoring/checks/${checkId}`,
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Get check status:', getRes.status);
  console.log('Check details:');
  console.log('  ID:', getRes.data.check?.id);
  console.log('  Name:', getRes.data.check?.name);
  console.log('  Interval:', getRes.data.check?.interval);
  console.log('  Tags:', getRes.data.check?.tags?.join(', '));
  console.log('  Group:', getRes.data.check?.group);
  console.log('  Has assertions:', getRes.data.check?.assertions?.length > 0);
  console.log('  Updated at:', getRes.data.check?.updated_at);

  // Verify all updates persisted
  const nameUpdated = getRes.data.check?.name === 'Updated Check Name';
  const intervalUpdated = getRes.data.check?.interval === 120;
  const tagsUpdated = getRes.data.check?.tags?.includes('production');
  console.log('\nVerification:');
  console.log('  Name updated correctly:', nameUpdated);
  console.log('  Interval updated correctly:', intervalUpdated);
  console.log('  Tags updated correctly:', tagsUpdated);

  // Additional: Test disabling a check
  console.log('\n=== Additional: Disable check ===');
  const disableRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: `/api/v1/monitoring/checks/${checkId}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    enabled: false
  });
  console.log('Enabled after disable:', disableRes.data.check?.enabled);

  // Re-enable
  const enableRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: `/api/v1/monitoring/checks/${checkId}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    enabled: true
  });
  console.log('Enabled after re-enable:', enableRes.data.check?.enabled);

  // Additional: Test updating URL
  console.log('\n=== Additional: Update URL ===');
  const urlRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: `/api/v1/monitoring/checks/${checkId}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    url: 'https://updated.example.com/health'
  });
  console.log('URL updated:', urlRes.data.check?.url);

  // Final verification summary
  console.log('\n========================================');
  console.log('FEATURE #942 VERIFICATION SUMMARY');
  console.log('========================================');
  const step1Pass = updateRes.status === 200 && updateRes.data.check?.name === 'Updated Check Name';
  const step2Pass = intervalRes.data.check?.interval === 120 && intervalRes.data.check?.assertions?.length === 2;
  const step3Pass = nameUpdated && intervalUpdated && tagsUpdated;

  console.log('Step 1: Call update-check with check ID:', step1Pass);
  console.log('Step 2: Update interval or assertions:', step2Pass);
  console.log('Step 3: Verify check updated:', step3Pass);
  console.log('');
  console.log('All steps passed:', step1Pass && step2Pass && step3Pass ? 'true' : 'false');
})();
