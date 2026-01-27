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
  console.log('\n=== Setup: Create Project ===');
  const createProjectRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/v1/projects',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { name: 'Security Policy Test ' + Date.now(), base_url: 'https://test.example.com' });
  const projectId = createProjectRes.data.project?.id;
  console.log('Project ID:', projectId);

  // FEATURE #934 TEST STEP 1: Call configure-security-policy
  console.log('\n=== Feature #934 Step 1: Call configure-security-policy ===');
  const policyRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/policy/' + projectId,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {});
  console.log('Status:', policyRes.status);
  console.log('Has policy_id:', !!policyRes.data.policy_id);
  console.log('Policy ID:', policyRes.data.policy_id);
  console.log('Project ID:', policyRes.data.project_id);
  console.log('Status:', policyRes.data.status);
  console.log('Has policy object:', !!policyRes.data.policy);

  // FEATURE #934 TEST STEP 2: Set max severity threshold
  console.log('\n=== Feature #934 Step 2: Set max severity threshold ===');
  const severityRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/policy/' + projectId,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { severity_threshold: 'critical' });
  console.log('Set severity_threshold: critical');
  console.log('Response severity_threshold:', severityRes.data.policy?.vulnerability?.severity_threshold);
  console.log('Description:', severityRes.data.policy?.vulnerability?.description);

  // Test different severity levels
  const mediumRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/policy/' + projectId,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { severity_threshold: 'medium' });
  console.log('\nSet severity_threshold: medium');
  console.log('Response severity_threshold:', mediumRes.data.policy?.vulnerability?.severity_threshold);

  // FEATURE #934 TEST STEP 3: Set blocked licenses
  console.log('\n=== Feature #934 Step 3: Set blocked licenses ===');
  const blockedLicenses = ['GPL-3.0', 'AGPL-3.0', 'SSPL-1.0', 'UNLICENSED'];
  const approvedLicenses = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC'];
  const licenseRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/policy/' + projectId,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { blocked_licenses: blockedLicenses, approved_licenses: approvedLicenses });
  console.log('Set blocked_licenses:', blockedLicenses.join(', '));
  console.log('Response blocked_licenses:', licenseRes.data.policy?.license?.blocked_licenses?.join(', '));
  console.log('Set approved_licenses:', approvedLicenses.join(', '));
  console.log('Response approved_licenses:', licenseRes.data.policy?.license?.approved_licenses?.join(', '));
  console.log('License description:', licenseRes.data.policy?.license?.description);

  // FEATURE #934 TEST STEP 4: Verify policy saved
  console.log('\n=== Feature #934 Step 4: Verify policy saved ===');
  console.log('Policy status:', licenseRes.data.status);
  console.log('Has metadata:', !!licenseRes.data.metadata);
  console.log('  Updated at:', licenseRes.data.metadata?.updated_at);
  console.log('  Updated by:', licenseRes.data.metadata?.updated_by);
  console.log('  Version:', licenseRes.data.metadata?.version);
  console.log('Has validation:', !!licenseRes.data.validation);
  console.log('  Is valid:', licenseRes.data.validation?.is_valid);
  console.log('  Warnings:', licenseRes.data.validation?.warnings?.length);
  console.log('  Errors:', licenseRes.data.validation?.errors?.length);

  // Verify by GET
  console.log('\nVerify by GET request:');
  const getRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/policy/' + projectId,
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('GET status:', getRes.status);
  console.log('Retrieved severity_threshold:', getRes.data.policy?.severity_threshold);
  console.log('Retrieved blocked_licenses:', getRes.data.policy?.blocked_licenses?.join(', '));

  // Additional: Test secret detection policy
  console.log('\n=== Additional: Test secret detection policy ===');
  const secretRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/policy/' + projectId,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { secret_detection: { enabled: true, block_on_active: false, allowed_paths: ['.env.test', 'test/**'] } });
  console.log('Secret detection enabled:', secretRes.data.policy?.secret_detection?.enabled);
  console.log('Block on active:', secretRes.data.policy?.secret_detection?.block_on_active);
  console.log('Allowed paths:', secretRes.data.policy?.secret_detection?.allowed_paths?.join(', '));

  // Additional: Test DAST policy
  console.log('\n=== Additional: Test DAST policy ===');
  const dastPolicyRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/policy/' + projectId,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { dast_policy: { enabled: true, max_severity: 'critical', scan_frequency: 'daily' } });
  console.log('DAST enabled:', dastPolicyRes.data.policy?.dast?.enabled);
  console.log('DAST max_severity:', dastPolicyRes.data.policy?.dast?.max_severity);
  console.log('DAST scan_frequency:', dastPolicyRes.data.policy?.dast?.scan_frequency);

  // Additional: Test SBOM policy
  console.log('\n=== Additional: Test SBOM policy ===');
  const sbomPolicyRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/policy/' + projectId,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { sbom_policy: { auto_generate: true, format: 'spdx' } });
  console.log('SBOM auto_generate:', sbomPolicyRes.data.policy?.sbom?.auto_generate);
  console.log('SBOM format:', sbomPolicyRes.data.policy?.sbom?.format);

  // Final verification summary
  console.log('\n========================================');
  console.log('FEATURE #934 VERIFICATION SUMMARY');
  console.log('========================================');
  const step1Pass = policyRes.status === 200 && !!policyRes.data.policy_id && !!policyRes.data.policy;
  const step2Pass = severityRes.data.policy?.vulnerability?.severity_threshold === 'critical' && mediumRes.data.policy?.vulnerability?.severity_threshold === 'medium';
  const step3Pass = licenseRes.data.policy?.license?.blocked_licenses?.length === 4 && licenseRes.data.policy?.license?.approved_licenses?.length === 4;
  const step4Pass = licenseRes.data.status === 'saved' && !!licenseRes.data.metadata?.updated_at && licenseRes.data.validation?.is_valid === true;

  console.log('Step 1: Call configure-security-policy:', step1Pass);
  console.log('Step 2: Set max severity threshold:', step2Pass);
  console.log('Step 3: Set blocked licenses:', step3Pass);
  console.log('Step 4: Verify policy saved:', step4Pass);
  console.log('');
  console.log('All steps passed:', step1Pass && step2Pass && step3Pass && step4Pass ? 'true' : 'false');
})();
