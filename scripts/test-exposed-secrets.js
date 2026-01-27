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
  }, { name: 'Exposed Secrets Test ' + Date.now(), base_url: 'https://test.example.com' });
  const projectId = createProjectRes.data.project?.id;
  console.log('Project ID:', projectId);

  // FEATURE #927 TEST STEP 1: Call get-exposed-secrets with project ID
  console.log('\n=== Feature #927 Step 1: Call get-exposed-secrets with project ID ===');
  const secretsRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/secrets/' + projectId,
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', secretsRes.status);
  console.log('Has project_id:', !!secretsRes.data.project_id);
  console.log('Has scan_id:', !!secretsRes.data.scan_id);
  console.log('Has secrets array:', Array.isArray(secretsRes.data.secrets));

  // FEATURE #927 TEST STEP 2: Verify secrets listed
  console.log('\n=== Feature #927 Step 2: Verify secrets listed ===');
  const secrets = secretsRes.data.secrets || [];
  console.log('Total secrets:', secretsRes.data.summary?.total_secrets);
  console.log('Secrets in response:', secrets.length);
  if (secrets.length > 0) {
    console.log('\nFirst secret:');
    console.log('  ID:', secrets[0].id);
    console.log('  Type:', secrets[0].secret_type);
    console.log('  Type Name:', secrets[0].secret_type_name);
    console.log('  Severity:', secrets[0].severity);
    console.log('  Masked Value:', secrets[0].masked_value);
  }

  // FEATURE #927 TEST STEP 3: Verify secret type identified
  console.log('\n=== Feature #927 Step 3: Verify secret type identified ===');
  console.log('Secrets by type:', JSON.stringify(secretsRes.data.summary?.by_type));
  const secretTypes = [...new Set(secrets.map(s => s.secret_type))];
  console.log('Unique secret types found:', secretTypes.join(', '));
  secrets.slice(0, 3).forEach((s, i) => {
    console.log(`  Secret ${i + 1}: ${s.secret_type} (${s.secret_type_name})`);
  });

  // FEATURE #927 TEST STEP 4: Verify file locations shown
  console.log('\n=== Feature #927 Step 4: Verify file locations shown ===');
  const affectedFiles = secretsRes.data.affected_files || [];
  console.log('Affected files:', affectedFiles.length);
  affectedFiles.forEach(f => {
    console.log(`  - ${f.path}: ${f.secret_count} secret(s)`);
  });

  // Check file location details in secrets
  if (secrets.length > 0) {
    console.log('\nFile location details in first secret:');
    console.log('  File path:', secrets[0].file_path);
    console.log('  Line number:', secrets[0].line_number);
    console.log('  Column start:', secrets[0].column_start);
    console.log('  Column end:', secrets[0].column_end);
    console.log('  Commit SHA:', secrets[0].commit_sha);
    console.log('  Author:', secrets[0].author);
    console.log('  Snippet:', secrets[0].snippet?.substring(0, 50) + '...');
  }

  // Check summary
  console.log('\n=== Additional: Check Summary ===');
  const summary = secretsRes.data.summary;
  console.log('By severity:', JSON.stringify(summary?.by_severity));
  console.log('Verified secrets:', summary?.verified_secrets);

  // Test filtering by severity
  console.log('\n=== Additional: Test Filtering ===');
  const criticalSecretsRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/secrets/' + projectId + '?severity=critical',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Critical secrets filter:', criticalSecretsRes.data.summary?.filtered_count, 'secrets');

  // Check recommendations
  console.log('\n=== Additional: Check Recommendations ===');
  const recommendations = secretsRes.data.recommendations || [];
  console.log('Recommendations:', recommendations.length);
  recommendations.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.priority}] ${r.action}`);
  });

  // Final verification summary
  console.log('\n========================================');
  console.log('FEATURE #927 VERIFICATION SUMMARY');
  console.log('========================================');
  const step1Pass = secretsRes.status === 200 && !!secretsRes.data.project_id && Array.isArray(secretsRes.data.secrets);
  const step2Pass = secrets.length > 0 && secrets[0].id && secrets[0].severity;
  const step3Pass = secrets.length > 0 && secrets[0].secret_type && secrets[0].secret_type_name;
  const step4Pass = secrets.length > 0 && secrets[0].file_path && secrets[0].line_number !== undefined && affectedFiles.length > 0;

  console.log('✓ Step 1: Call get-exposed-secrets with project ID:', step1Pass);
  console.log('✓ Step 2: Verify secrets listed:', step2Pass);
  console.log('✓ Step 3: Verify secret type identified:', step3Pass);
  console.log('✓ Step 4: Verify file locations shown:', step4Pass);
  console.log('');
  console.log('All steps passed:', step1Pass && step2Pass && step3Pass && step4Pass);
})();
