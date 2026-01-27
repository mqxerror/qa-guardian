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

  // FEATURE #931 TEST STEP 1: Call run-dast-scan with target URL
  console.log('\n=== Feature #931 Step 1: Call run-dast-scan with target URL ===');
  const dastRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/dast/scan',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { target_url: 'https://test.example.com' });
  console.log('Status:', dastRes.status);
  console.log('Has scan_id:', !!dastRes.data.scan_id);
  console.log('Scan ID:', dastRes.data.scan_id);
  console.log('Target URL:', dastRes.data.target_url);
  console.log('Scan status:', dastRes.data.status);

  const scanId = dastRes.data.scan_id;

  // FEATURE #931 TEST STEP 2: Specify scan type (baseline, full)
  console.log('\n=== Feature #931 Step 2: Specify scan type (baseline, full) ===');
  const fullScanRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/dast/scan',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { target_url: 'https://test.example.com', scan_type: 'full' });
  console.log('Scan type requested: full');
  console.log('Scan type returned:', fullScanRes.data.scan_type);
  console.log('Configuration ajax_spider:', fullScanRes.data.configuration?.ajax_spider_enabled);
  console.log('Estimated duration:', fullScanRes.data.timing?.estimated_duration_minutes, 'minutes');
  console.log('Findings count (full scan finds more):', fullScanRes.data.realtime_findings?.length);

  // Also test baseline scan type
  console.log('\nBaseline scan test:');
  const baselineScanRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/dast/scan',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { target_url: 'https://test.example.com', scan_type: 'baseline' });
  console.log('Scan type returned:', baselineScanRes.data.scan_type);
  console.log('Estimated duration:', baselineScanRes.data.timing?.estimated_duration_minutes, 'minutes');
  console.log('Findings count (baseline finds less):', baselineScanRes.data.realtime_findings?.length);

  // FEATURE #931 TEST STEP 3: Verify scan starts
  console.log('\n=== Feature #931 Step 3: Verify scan starts ===');
  console.log('Scan status:', dastRes.data.status);
  console.log('Timing started_at:', dastRes.data.timing?.started_at);
  console.log('Timing estimated_completion:', dastRes.data.timing?.estimated_completion);
  console.log('Progress phase:', dastRes.data.progress?.phase);
  console.log('Progress percentage:', dastRes.data.progress?.percentage + '%');
  console.log('URLs crawled:', dastRes.data.progress?.urls_crawled);
  console.log('Scan engine:', dastRes.data.scan_engine?.name);
  console.log('Scan engine version:', dastRes.data.scan_engine?.version);

  // Check status endpoint
  console.log('\nStatus endpoint check:');
  const statusRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/dast/scan/' + scanId + '/status',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status endpoint returns:', statusRes.data.status);
  console.log('Progress phase:', statusRes.data.progress?.phase);
  console.log('Progress percentage:', statusRes.data.progress?.percentage + '%');

  // FEATURE #931 TEST STEP 4: Verify real-time findings
  console.log('\n=== Feature #931 Step 4: Verify real-time findings ===');
  const findings = dastRes.data.realtime_findings || [];
  console.log('Real-time findings count:', findings.length);
  console.log('Findings summary total:', dastRes.data.findings_summary?.total);
  console.log('Findings by severity:', JSON.stringify(dastRes.data.findings_summary?.by_severity));

  if (findings.length > 0) {
    console.log('\nFirst finding details:');
    console.log('  ID:', findings[0].id);
    console.log('  Rule ID:', findings[0].rule_id);
    console.log('  Name:', findings[0].name);
    console.log('  Severity:', findings[0].severity);
    console.log('  Confidence:', findings[0].confidence);
    console.log('  URL:', findings[0].url);
    console.log('  CWE ID:', findings[0].cweid);
    console.log('  Description:', findings[0].description?.substring(0, 60) + '...');
    console.log('  Solution:', findings[0].solution?.substring(0, 60) + '...');
  }

  // Check findings endpoint
  console.log('\nFindings endpoint check:');
  const findingsRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/dast/scan/' + scanId + '/findings',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Findings endpoint total:', findingsRes.data.total);
  console.log('Findings list:', findingsRes.data.findings?.map(f => f.name).join(', '));

  // Additional: Test with auth_config and scan_options
  console.log('\n=== Additional: Test with auth_config and scan_options ===');
  const advancedRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/dast/scan',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    target_url: 'https://test.example.com',
    scan_type: 'api',
    auth_config: { type: 'bearer', token: 'test-token' },
    scan_options: { max_depth: 3, exclude_paths: ['/admin', '/private'] }
  });
  console.log('Auth type configured:', advancedRes.data.configuration?.auth_type);
  console.log('Max depth configured:', advancedRes.data.configuration?.max_depth);
  console.log('Exclude paths:', advancedRes.data.configuration?.exclude_paths?.join(', '));

  // Check links
  console.log('\n=== Additional: Check links ===');
  console.log('Status link:', dastRes.data.links?.status);
  console.log('Findings link:', dastRes.data.links?.findings);
  console.log('Stop link:', dastRes.data.links?.stop);
  console.log('Report link:', dastRes.data.links?.report);

  // Final verification summary
  console.log('\n========================================');
  console.log('FEATURE #931 VERIFICATION SUMMARY');
  console.log('========================================');
  const step1Pass = dastRes.status === 200 && !!dastRes.data.scan_id && dastRes.data.target_url === 'https://test.example.com';
  const step2Pass = fullScanRes.data.scan_type === 'full' && baselineScanRes.data.scan_type === 'baseline';
  const step3Pass = dastRes.data.status === 'running' && !!dastRes.data.timing?.started_at && !!dastRes.data.progress?.phase;
  const step4Pass = findings.length > 0 && !!findings[0].severity && !!findings[0].name && !!findings[0].rule_id;

  console.log('Step 1: Call run-dast-scan with target URL:', step1Pass);
  console.log('Step 2: Specify scan type (baseline, full):', step2Pass);
  console.log('Step 3: Verify scan starts:', step3Pass);
  console.log('Step 4: Verify real-time findings:', step4Pass);
  console.log('');
  console.log('All steps passed:', step1Pass && step2Pass && step3Pass && step4Pass ? 'true' : 'false');
})();
