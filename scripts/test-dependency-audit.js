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
  }, { name: 'Dependency Audit Test ' + Date.now(), base_url: 'https://test.example.com' });
  const projectId = createProjectRes.data.project?.id;
  console.log('Project ID:', projectId);

  // FEATURE #924 TEST STEP 1: Call get-dependency-audit with project ID
  console.log('\n=== Feature #924 Step 1: Call get-dependency-audit with project ID ===');
  const auditRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/dependencies/' + projectId,
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', auditRes.status);
  console.log('Has project_id:', !!auditRes.data.project_id);
  console.log('Has project_name:', !!auditRes.data.project_name);
  console.log('Has summary:', !!auditRes.data.summary);
  console.log('Has dependencies:', !!auditRes.data.dependencies);

  // FEATURE #924 TEST STEP 2: Verify dependencies listed
  console.log('\n=== Feature #924 Step 2: Verify dependencies listed ===');
  const dependencies = auditRes.data.dependencies || [];
  console.log('Total dependencies:', dependencies.length);
  console.log('Production deps:', dependencies.filter(d => d.type === 'production').length);
  console.log('Dev deps:', dependencies.filter(d => d.type === 'development').length);
  if (dependencies.length > 0) {
    console.log('First dependency:', dependencies[0].name, 'v' + dependencies[0].version);
    console.log('  Latest version:', dependencies[0].latest_version);
    console.log('  Vulnerable:', dependencies[0].vulnerable);
  }

  // FEATURE #924 TEST STEP 3: Verify CVEs for each vulnerable dependency
  console.log('\n=== Feature #924 Step 3: Verify CVEs for each ===');
  const vulnDeps = dependencies.filter(d => d.vulnerable);
  console.log('Dependencies with vulnerabilities:', vulnDeps.length);
  if (vulnDeps.length > 0) {
    const firstVuln = vulnDeps[0];
    console.log('Vulnerable dep:', firstVuln.name);
    console.log('Vulnerability count:', firstVuln.vulnerability_count);
    console.log('CVEs:', firstVuln.vulnerabilities.map(v => v.cve_id).join(', '));
    console.log('Severity distribution:', firstVuln.vulnerabilities.map(v => v.severity).join(', '));
    // Check CVE details
    const cve = firstVuln.vulnerabilities[0];
    console.log('CVE details:');
    console.log('  - Title:', cve.title);
    console.log('  - Description:', cve.description.substring(0, 80) + '...');
    console.log('  - Patched version:', cve.patched_version);
    console.log('  - CWE IDs:', cve.cwe_ids?.join(', '));
    console.log('  - References:', cve.references?.length);
  }

  // FEATURE #924 TEST STEP 4: Verify upgrade suggestions
  console.log('\n=== Feature #924 Step 4: Verify upgrade suggestions ===');
  const upgradeSuggestions = auditRes.data.upgrade_suggestions || [];
  console.log('Upgrade suggestions count:', upgradeSuggestions.length);
  if (upgradeSuggestions.length > 0) {
    const firstUpgrade = upgradeSuggestions[0];
    console.log('Upgrade suggestion for:', firstUpgrade.package);
    console.log('  From:', firstUpgrade.current_version, '-> To:', firstUpgrade.recommended_version);
    console.log('  Command:', firstUpgrade.upgrade_command);
    console.log('  Vulnerabilities fixed:', firstUpgrade.vulnerabilities_fixed);
    console.log('  Breaking changes likely:', firstUpgrade.breaking_changes_likely ? 'Yes' : 'No');
    console.log('  Changelog URL:', firstUpgrade.changelog_url);
  }

  // Check summary
  console.log('\n=== Additional: Check Summary ===');
  const summary = auditRes.data.summary;
  console.log('Total dependencies:', summary?.total_dependencies);
  console.log('Vulnerable dependencies:', summary?.vulnerable_dependencies);
  console.log('Total vulnerabilities:', summary?.total_vulnerabilities);
  console.log('Severity breakdown:', JSON.stringify(summary?.severity_breakdown));
  console.log('Outdated dependencies:', summary?.outdated_dependencies);
  console.log('Updates available:', summary?.updates_available);

  // Check recommendations
  console.log('\n=== Additional: Check Recommendations ===');
  const recommendations = auditRes.data.recommendations || [];
  console.log('Recommendations count:', recommendations.length);
  recommendations.forEach((rec, i) => {
    console.log(`  ${i + 1}. [${rec.priority}] ${rec.message}`);
  });

  // Final verification summary
  console.log('\n========================================');
  console.log('FEATURE #924 VERIFICATION SUMMARY');
  console.log('========================================');
  const step1Pass = auditRes.status === 200 && !!auditRes.data.project_id && !!auditRes.data.dependencies;
  const step2Pass = dependencies.length > 0 && !!dependencies[0].version && !!dependencies[0].name;
  const step3Pass = vulnDeps.length > 0 && !!vulnDeps[0].vulnerabilities?.[0]?.cve_id && Array.isArray(vulnDeps[0].vulnerabilities?.[0]?.cwe_ids);
  const step4Pass = upgradeSuggestions.length > 0 && !!upgradeSuggestions[0].recommended_version && !!upgradeSuggestions[0].upgrade_command;

  console.log('✓ Step 1: Call get-dependency-audit with project ID:', step1Pass);
  console.log('✓ Step 2: Verify dependencies listed:', step2Pass);
  console.log('✓ Step 3: Verify CVEs for each:', step3Pass);
  console.log('✓ Step 4: Verify upgrade suggestions:', step4Pass);
  console.log('');
  console.log('All steps passed:', step1Pass && step2Pass && step3Pass && step4Pass);
})();
