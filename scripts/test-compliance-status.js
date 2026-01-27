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
  }, { name: 'Compliance Test Project ' + Date.now(), base_url: 'https://test.example.com' });
  const projectId = createProjectRes.data.project?.id;
  console.log('Project ID:', projectId);

  // FEATURE #930 TEST STEP 1: Call get-compliance-status with project ID
  console.log('\n=== Feature #930 Step 1: Call get-compliance-status with project ID ===');
  const complianceRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/compliance/' + projectId,
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', complianceRes.status);
  console.log('Has project_id:', !!complianceRes.data.project_id);
  console.log('Has overall_status:', !!complianceRes.data.overall_status);
  console.log('Overall status:', complianceRes.data.overall_status);

  // FEATURE #930 TEST STEP 2: Verify license compliance shown
  console.log('\n=== Feature #930 Step 2: Verify license compliance shown ===');
  const licenseCompliance = complianceRes.data.license_compliance;
  console.log('License compliance status:', licenseCompliance?.status);
  console.log('License policies:', licenseCompliance?.policies?.length);
  licenseCompliance?.policies?.forEach(p => {
    console.log(`  - ${p.name}: ${p.status}`);
  });
  console.log('Approved licenses:', licenseCompliance?.approved_licenses?.join(', '));
  console.log('Restricted licenses:', licenseCompliance?.restricted_licenses?.join(', '));
  console.log('Denied licenses:', licenseCompliance?.denied_licenses?.join(', '));

  // FEATURE #930 TEST STEP 3: Verify security policy compliance
  console.log('\n=== Feature #930 Step 3: Verify security policy compliance ===');
  const securityCompliance = complianceRes.data.security_compliance;
  console.log('Security compliance status:', securityCompliance?.status);
  console.log('Security policies:', securityCompliance?.policies?.length);
  securityCompliance?.policies?.forEach(p => {
    console.log(`  - ${p.name}: ${p.status}`);
  });

  // FEATURE #930 TEST STEP 4: Verify violations listed
  console.log('\n=== Feature #930 Step 4: Verify violations listed ===');
  const violations = complianceRes.data.violations || [];
  const violationsSummary = complianceRes.data.violations_summary;
  console.log('Violations summary:');
  console.log('  Total:', violationsSummary?.total);
  console.log('  Unresolved:', violationsSummary?.unresolved);
  console.log('  Overdue:', violationsSummary?.overdue);
  console.log('  By category:', JSON.stringify(violationsSummary?.by_category));
  console.log('  By severity:', JSON.stringify(violationsSummary?.by_severity));

  console.log('\nViolations:');
  violations.forEach(v => {
    console.log(`  - [${v.severity}] ${v.policy_name}: ${v.description.substring(0, 60)}...`);
    console.log(`    Affected: ${v.affected_item}, Due: ${v.resolution_due.split('T')[0]}`);
  });

  // Check summary
  console.log('\n=== Additional: Check Summary ===');
  const summary = complianceRes.data.summary;
  console.log('Total policies:', summary?.total_policies);
  console.log('Passing:', summary?.passing);
  console.log('Failing:', summary?.failing);
  console.log('Warnings:', summary?.warnings);
  console.log('Compliance score:', summary?.compliance_score + '%');

  // Check recommendations
  console.log('\n=== Additional: Check Recommendations ===');
  const recommendations = complianceRes.data.recommendations || [];
  console.log('Recommendations:', recommendations.length);
  recommendations.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.priority}] ${r.action}`);
  });

  // Test without details
  console.log('\n=== Additional: Test without details ===');
  const noDetailsRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/compliance/' + projectId + '?include_details=false',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Has violations when include_details=false:', !!noDetailsRes.data.violations);

  // Final verification summary
  console.log('\n========================================');
  console.log('FEATURE #930 VERIFICATION SUMMARY');
  console.log('========================================');
  const step1Pass = complianceRes.status === 200 && !!complianceRes.data.project_id && !!complianceRes.data.overall_status;
  const step2Pass = !!licenseCompliance?.status && licenseCompliance?.policies?.length > 0 && licenseCompliance?.approved_licenses?.length > 0;
  const step3Pass = !!securityCompliance?.status && securityCompliance?.policies?.length > 0;
  const step4Pass = violations.length > 0 && violations[0].severity && violations[0].policy_name && violations[0].affected_item;

  console.log('✓ Step 1: Call get-compliance-status with project ID:', step1Pass);
  console.log('✓ Step 2: Verify license compliance shown:', step2Pass);
  console.log('✓ Step 3: Verify security policy compliance:', step3Pass);
  console.log('✓ Step 4: Verify violations listed:', step4Pass);
  console.log('');
  console.log('All steps passed:', step1Pass && step2Pass && step3Pass && step4Pass);
})();
