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
  }, { name: 'Verify Secret Test ' + Date.now(), base_url: 'https://test.example.com' });
  const projectId = createProjectRes.data.project?.id;
  console.log('Project ID:', projectId);

  // First get secrets to have a valid secret ID
  console.log('\n=== Step 3: Get Secrets ===');
  const secretsRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/secrets/' + projectId,
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Total secrets:', secretsRes.data.summary?.total_secrets);

  const secretId = secretsRes.data.secrets?.[0]?.id;
  console.log('First secret ID:', secretId);

  // FEATURE #928 TEST STEP 1: Call verify-secret-status with secret ID
  console.log('\n=== Feature #928 Step 1: Call verify-secret-status with secret ID ===');
  const verifyRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/secrets/' + encodeURIComponent(secretId) + '/verify',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {});
  console.log('Status:', verifyRes.status);
  console.log('Has secret_id:', !!verifyRes.data.secret_id);
  console.log('Has verification:', !!verifyRes.data.verification);
  console.log('Secret type:', verifyRes.data.secret_type);
  console.log('Secret type name:', verifyRes.data.secret_type_name);

  // FEATURE #928 TEST STEP 2: Verify check performed
  console.log('\n=== Feature #928 Step 2: Verify check performed ===');
  const verification = verifyRes.data.verification;
  console.log('Check performed:', verification?.check_performed);
  console.log('Is verifiable:', verification?.is_verifiable);
  console.log('Confidence:', verification?.confidence_percent + '%');
  console.log('Timing:');
  console.log('  Started at:', verifyRes.data.timing?.started_at);
  console.log('  Completed at:', verifyRes.data.timing?.completed_at);
  console.log('  Duration:', verifyRes.data.timing?.duration_ms + 'ms');
  console.log('  From cache:', verifyRes.data.timing?.from_cache);

  // FEATURE #928 TEST STEP 3: Verify active/revoked status returned
  console.log('\n=== Feature #928 Step 3: Verify active/revoked status returned ===');
  console.log('Status:', verification?.status);
  console.log('Valid statuses:', ['active', 'revoked', 'expired', 'unknown', 'unverifiable'].includes(verification?.status));
  console.log('Details:', JSON.stringify(verification?.details));

  // Test multiple verifications to see different statuses
  console.log('\n=== Additional: Test Multiple Verifications ===');
  const statuses = new Set();
  for (let i = 0; i < 5; i++) {
    const testSecretId = `secret-${projectId}-${i + 1}`;
    const multiRes = await makeRequest({
      hostname: 'localhost', port: 3001,
      path: '/api/v1/security/secrets/' + encodeURIComponent(testSecretId) + '/verify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    }, {});
    statuses.add(multiRes.data.verification?.status);
    console.log(`  Secret ${i + 1} (${multiRes.data.secret_type}): ${multiRes.data.verification?.status}`);
  }
  console.log('Unique statuses seen:', [...statuses].join(', '));

  // Check recommendations
  console.log('\n=== Additional: Check Recommendations ===');
  const recommendations = verifyRes.data.recommendations || [];
  console.log('Recommendations:', recommendations.length);
  recommendations.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.priority}] ${r.action}`);
  });

  // Test force_recheck
  console.log('\n=== Additional: Test force_recheck ===');
  const forceRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/secrets/' + encodeURIComponent(secretId) + '/verify?force_recheck=true',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {});
  console.log('Force recheck - from_cache:', forceRes.data.timing?.from_cache);

  // Final verification summary
  console.log('\n========================================');
  console.log('FEATURE #928 VERIFICATION SUMMARY');
  console.log('========================================');
  const validStatuses = ['active', 'revoked', 'expired', 'unknown', 'unverifiable'];
  const step1Pass = verifyRes.status === 200 && !!verifyRes.data.secret_id && !!verifyRes.data.verification;
  const step2Pass = verification?.check_performed !== undefined || verification?.is_verifiable !== undefined;
  const step3Pass = validStatuses.includes(verification?.status);

  console.log('✓ Step 1: Call verify-secret-status with secret ID:', step1Pass);
  console.log('✓ Step 2: Verify check performed:', step2Pass);
  console.log('✓ Step 3: Verify active/revoked status returned:', step3Pass);
  console.log('');
  console.log('All steps passed:', step1Pass && step2Pass && step3Pass);
})();
