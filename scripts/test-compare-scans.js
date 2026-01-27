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

  // FEATURE #936 TEST STEP 1: Call compare-security-scans with scan IDs
  console.log('\n=== Feature #936 Step 1: Call compare-security-scans with scan IDs ===');
  const compareRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/scans/compare?baseline=scan-baseline-123&current=scan-current-456',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', compareRes.status);
  console.log('Has comparison_id:', !!compareRes.data.comparison_id);
  console.log('Comparison ID:', compareRes.data.comparison_id);
  console.log('Has baseline_scan:', !!compareRes.data.baseline_scan);
  console.log('Has current_scan:', !!compareRes.data.current_scan);
  console.log('Compared at:', compareRes.data.compared_at);

  // Check scan info
  console.log('\nBaseline scan:');
  console.log('  Scan ID:', compareRes.data.baseline_scan?.scan_id);
  console.log('  Scanned at:', compareRes.data.baseline_scan?.scanned_at);
  console.log('  Total vulnerabilities:', compareRes.data.baseline_scan?.total_vulnerabilities);

  console.log('Current scan:');
  console.log('  Scan ID:', compareRes.data.current_scan?.scan_id);
  console.log('  Scanned at:', compareRes.data.current_scan?.scanned_at);
  console.log('  Total vulnerabilities:', compareRes.data.current_scan?.total_vulnerabilities);

  // FEATURE #936 TEST STEP 2: Verify new vulnerabilities shown
  console.log('\n=== Feature #936 Step 2: Verify new vulnerabilities shown ===');
  const newVulns = compareRes.data.new_vulnerabilities || [];
  console.log('New vulnerabilities count:', compareRes.data.summary?.new_vulnerabilities);
  console.log('New by severity:', JSON.stringify(compareRes.data.summary?.new_by_severity));
  console.log('\nNew vulnerabilities:');
  newVulns.forEach((v, i) => {
    console.log(`  ${i + 1}. [${v.severity.toUpperCase()}] ${v.id}: ${v.package}`);
    if (v.title) {
      console.log(`     Title: ${v.title}`);
      console.log(`     CVSS: ${v.cvss_score}, Fixed in: ${v.fixed_version}`);
    }
  });

  // FEATURE #936 TEST STEP 3: Verify fixed vulnerabilities shown
  console.log('\n=== Feature #936 Step 3: Verify fixed vulnerabilities shown ===');
  const fixedVulns = compareRes.data.fixed_vulnerabilities || [];
  console.log('Fixed vulnerabilities count:', compareRes.data.summary?.fixed_vulnerabilities);
  console.log('Fixed by severity:', JSON.stringify(compareRes.data.summary?.fixed_by_severity));
  console.log('\nFixed vulnerabilities:');
  fixedVulns.forEach((v, i) => {
    console.log(`  ${i + 1}. [${v.severity.toUpperCase()}] ${v.id}: ${v.package}`);
    if (v.title) {
      console.log(`     Title: ${v.title}`);
    }
  });

  // FEATURE #936 TEST STEP 4: Verify unchanged shown
  console.log('\n=== Feature #936 Step 4: Verify unchanged shown ===');
  const unchangedVulns = compareRes.data.unchanged_vulnerabilities || [];
  console.log('Unchanged vulnerabilities count:', compareRes.data.summary?.unchanged_vulnerabilities);
  console.log('\nUnchanged vulnerabilities:');
  unchangedVulns.forEach((v, i) => {
    console.log(`  ${i + 1}. [${v.severity.toUpperCase()}] ${v.id}: ${v.package}`);
  });

  // Check summary
  console.log('\n=== Additional: Check Summary ===');
  console.log('Net change:', compareRes.data.summary?.net_change);
  console.log('Improvement:', compareRes.data.summary?.improvement);

  // Check analysis
  console.log('\n=== Additional: Check Analysis ===');
  console.log('Trend:', compareRes.data.analysis?.trend);
  console.log('Critical change:', compareRes.data.analysis?.critical_change);
  console.log('High change:', compareRes.data.analysis?.high_change);
  console.log('Recommendations:', compareRes.data.analysis?.recommendations?.length);
  compareRes.data.analysis?.recommendations?.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.priority}] ${r.action}`);
  });

  // Additional: Test without details
  console.log('\n=== Additional: Test without details ===');
  const noDetailsRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/scans/compare?baseline=scan-baseline-123&current=scan-current-456&include_details=false',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const hasTitle = !!noDetailsRes.data.new_vulnerabilities?.[0]?.title;
  console.log('First new vuln has title (should be false):', hasTitle);

  // Additional: Test severity filter
  console.log('\n=== Additional: Test severity filter ===');
  const criticalRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/scans/compare?baseline=scan-baseline-123&current=scan-current-456&severity=high',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Severity filter: high');
  console.log('New vulns with filter:', criticalRes.data.summary?.new_vulnerabilities);
  console.log('Fixed vulns with filter:', criticalRes.data.summary?.fixed_vulnerabilities);

  // Final verification summary
  console.log('\n========================================');
  console.log('FEATURE #936 VERIFICATION SUMMARY');
  console.log('========================================');
  const step1Pass = compareRes.status === 200 && !!compareRes.data.comparison_id && !!compareRes.data.baseline_scan && !!compareRes.data.current_scan;
  const step2Pass = Array.isArray(newVulns) && newVulns.length > 0 && !!newVulns[0].id && !!newVulns[0].severity;
  const step3Pass = Array.isArray(fixedVulns) && fixedVulns.length > 0 && !!fixedVulns[0].id && !!fixedVulns[0].severity;
  const step4Pass = Array.isArray(unchangedVulns) && unchangedVulns.length > 0 && !!unchangedVulns[0].id;

  console.log('Step 1: Call compare-security-scans with scan IDs:', step1Pass);
  console.log('Step 2: Verify new vulnerabilities shown:', step2Pass);
  console.log('Step 3: Verify fixed vulnerabilities shown:', step3Pass);
  console.log('Step 4: Verify unchanged shown:', step4Pass);
  console.log('');
  console.log('All steps passed:', step1Pass && step2Pass && step3Pass && step4Pass ? 'true' : 'false');
})();
