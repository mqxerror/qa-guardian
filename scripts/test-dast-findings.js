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

  // First trigger a DAST scan to get a scan ID
  console.log('\n=== Setup: Trigger DAST scan ===');
  const dastRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/dast/scan',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { target_url: 'https://test.example.com', scan_type: 'full' });
  const scanId = dastRes.data.scan_id;
  console.log('Scan ID:', scanId);

  // FEATURE #932 TEST STEP 1: Call get-dast-findings with scan ID
  console.log('\n=== Feature #932 Step 1: Call get-dast-findings with scan ID ===');
  const findingsRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/dast/scan/' + scanId + '/findings',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', findingsRes.status);
  console.log('Has scan_id:', !!findingsRes.data.scan_id);
  console.log('Has summary:', !!findingsRes.data.summary);
  console.log('Has findings array:', Array.isArray(findingsRes.data.findings));
  console.log('Total findings:', findingsRes.data.summary?.total);

  // FEATURE #932 TEST STEP 2: Verify findings listed
  console.log('\n=== Feature #932 Step 2: Verify findings listed ===');
  const findings = findingsRes.data.findings || [];
  console.log('Findings count:', findings.length);
  console.log('Summary by severity:', JSON.stringify(findingsRes.data.summary?.by_severity));
  console.log('Summary by category:', JSON.stringify(findingsRes.data.summary?.by_category));

  if (findings.length > 0) {
    console.log('\nFirst finding basic info:');
    console.log('  ID:', findings[0].id);
    console.log('  Rule ID:', findings[0].rule_id);
    console.log('  Name:', findings[0].name);
    console.log('  Category:', findings[0].category);
    console.log('  Severity:', findings[0].severity);
    console.log('  Confidence:', findings[0].confidence);
    console.log('  Risk Score:', findings[0].risk_score);
    console.log('  URL:', findings[0].url);
    console.log('  Method:', findings[0].method);
    console.log('  CWE ID:', findings[0].cweid);
    console.log('  WASC ID:', findings[0].wascid);
  }

  // FEATURE #932 TEST STEP 3: Verify evidence included
  console.log('\n=== Feature #932 Step 3: Verify evidence included ===');
  if (findings.length > 0 && findings[0].evidence) {
    const evidence = findings[0].evidence;
    console.log('Has evidence:', !!evidence);
    console.log('Evidence request:', !!evidence.request);
    console.log('  Request method:', evidence.request?.method);
    console.log('  Request URL:', evidence.request?.url);
    console.log('  Request headers:', evidence.request?.headers ? 'present' : 'missing');
    console.log('Evidence response:', !!evidence.response);
    console.log('  Response status:', evidence.response?.status_code);
    console.log('  Response body snippet:', evidence.response?.body_snippet?.substring(0, 30) + '...');
    console.log('Observation:', evidence.observation?.substring(0, 60) + '...');
    console.log('Proof:', evidence.proof?.substring(0, 60) + '...');
    console.log('Attack used:', evidence.attack_used || 'N/A');
  } else {
    console.log('ERROR: No evidence found!');
  }

  // FEATURE #932 TEST STEP 4: Verify remediation guidance
  console.log('\n=== Feature #932 Step 4: Verify remediation guidance ===');
  if (findings.length > 0 && findings[0].remediation) {
    const remediation = findings[0].remediation;
    console.log('Has remediation:', !!remediation);
    console.log('Summary:', remediation.summary?.substring(0, 60) + '...');
    console.log('Detailed steps:', remediation.detailed_steps?.length, 'steps');
    remediation.detailed_steps?.forEach((step, i) => {
      console.log(`  Step ${i + 1}: ${step.substring(0, 60)}...`);
    });
    console.log('Code examples:', remediation.code_examples?.length, 'examples');
    remediation.code_examples?.forEach((ex, i) => {
      console.log(`  ${i + 1}. [${ex.language}] ${ex.code.substring(0, 50)}...`);
    });
    console.log('References:', remediation.references?.length, 'references');
    remediation.references?.forEach((ref, i) => {
      console.log(`  ${i + 1}. ${ref.title}: ${ref.url}`);
    });
    console.log('Effort estimate:', remediation.effort_estimate);
    console.log('Priority:', remediation.priority);
  } else {
    console.log('ERROR: No remediation found!');
  }

  // Additional: Test filtering by severity
  console.log('\n=== Additional: Test filtering by severity ===');
  const criticalRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/dast/scan/' + scanId + '/findings?severity=critical',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Critical findings:', criticalRes.data.findings?.length);
  criticalRes.data.findings?.forEach(f => {
    console.log(`  - [${f.severity}] ${f.name}`);
  });

  // Additional: Test filtering by category
  console.log('\n=== Additional: Test filtering by category ===');
  const injectionRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/dast/scan/' + scanId + '/findings?category=injection',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Injection findings:', injectionRes.data.findings?.length);
  injectionRes.data.findings?.forEach(f => {
    console.log(`  - [${f.category}] ${f.name}`);
  });

  // Additional: Test without evidence
  console.log('\n=== Additional: Test without evidence ===');
  const noEvidenceRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/dast/scan/' + scanId + '/findings?include_evidence=false',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('First finding has evidence:', !!noEvidenceRes.data.findings?.[0]?.evidence);

  // Additional: Test without remediation
  console.log('\n=== Additional: Test without remediation ===');
  const noRemediationRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/dast/scan/' + scanId + '/findings?include_remediation=false',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('First finding has remediation:', !!noRemediationRes.data.findings?.[0]?.remediation);

  // Additional: Test pagination
  console.log('\n=== Additional: Test pagination ===');
  console.log('Pagination info:');
  console.log('  Total:', findingsRes.data.pagination?.total);
  console.log('  Offset:', findingsRes.data.pagination?.offset);
  console.log('  Limit:', findingsRes.data.pagination?.limit);
  console.log('  Has more:', findingsRes.data.pagination?.has_more);

  // Final verification summary
  console.log('\n========================================');
  console.log('FEATURE #932 VERIFICATION SUMMARY');
  console.log('========================================');
  const step1Pass = findingsRes.status === 200 && !!findingsRes.data.scan_id && Array.isArray(findingsRes.data.findings);
  const step2Pass = findings.length > 0 && !!findings[0].id && !!findings[0].name && !!findings[0].severity && !!findings[0].category;
  const step3Pass = findings.length > 0 && !!findings[0].evidence && !!findings[0].evidence.request && !!findings[0].evidence.response && !!findings[0].evidence.observation;
  const step4Pass = findings.length > 0 && !!findings[0].remediation && !!findings[0].remediation.summary && findings[0].remediation.detailed_steps?.length > 0 && findings[0].remediation.code_examples?.length > 0;

  console.log('Step 1: Call get-dast-findings with scan ID:', step1Pass);
  console.log('Step 2: Verify findings listed:', step2Pass);
  console.log('Step 3: Verify evidence included:', step3Pass);
  console.log('Step 4: Verify remediation guidance:', step4Pass);
  console.log('');
  console.log('All steps passed:', step1Pass && step2Pass && step3Pass && step4Pass ? 'true' : 'false');
})();
