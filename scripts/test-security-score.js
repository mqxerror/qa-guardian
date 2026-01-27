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
  }, { name: 'Security Score Test ' + Date.now(), base_url: 'https://test.example.com' });
  const projectId = createProjectRes.data.project?.id;
  console.log('Project ID:', projectId);

  // FEATURE #926 TEST STEP 1: Call get-security-score with project ID
  console.log('\n=== Feature #926 Step 1: Call get-security-score with project ID ===');
  const scoreRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/score/' + projectId,
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', scoreRes.status);
  console.log('Has project_id:', !!scoreRes.data.project_id);
  console.log('Has score:', scoreRes.data.score !== undefined);
  console.log('Has grade:', !!scoreRes.data.grade);

  // FEATURE #926 TEST STEP 2: Verify score returned (0-100)
  console.log('\n=== Feature #926 Step 2: Verify score returned (0-100) ===');
  const score = scoreRes.data.score;
  const grade = scoreRes.data.grade;
  console.log('Score:', score);
  console.log('Grade:', grade);
  console.log('Score is 0-100:', score >= 0 && score <= 100);
  console.log('Score range min:', scoreRes.data.score_range?.min);
  console.log('Score range max:', scoreRes.data.score_range?.max);

  // FEATURE #926 TEST STEP 3: Verify scoring factors shown
  console.log('\n=== Feature #926 Step 3: Verify scoring factors shown ===');
  const factors = scoreRes.data.scoring_factors || [];
  console.log('Total scoring factors:', factors.length);
  factors.forEach(f => {
    console.log(`  - ${f.name}: ${f.score}/100 (weight: ${f.weight_percent}%, contribution: ${f.weighted_contribution})`);
  });
  console.log('\nFactor details check:');
  const vulnFactor = factors.find(f => f.id === 'vulnerability_count');
  if (vulnFactor) {
    console.log('  Vulnerability factor details:', JSON.stringify(vulnFactor.details));
  }
  const scanFactor = factors.find(f => f.id === 'scan_coverage');
  if (scanFactor) {
    console.log('  Scan coverage factor details:', JSON.stringify(scanFactor.details));
  }

  // FEATURE #926 TEST STEP 4: Verify improvement suggestions
  console.log('\n=== Feature #926 Step 4: Verify improvement suggestions ===');
  const suggestions = scoreRes.data.improvement_suggestions || [];
  console.log('Total improvement suggestions:', suggestions.length);
  suggestions.forEach((s, i) => {
    console.log(`  ${i + 1}. [${s.priority}] ${s.action} (potential gain: ${s.potential_gain?.toFixed(1)} points)`);
  });

  // Check summary
  console.log('\n=== Additional: Check Summary ===');
  const summary = scoreRes.data.summary;
  console.log('Total vulnerabilities:', summary?.total_vulnerabilities);
  console.log('Critical issues:', summary?.critical_issues);
  console.log('Scan coverage:', summary?.scan_coverage_percent + '%');
  console.log('MTTR hours:', summary?.mttr_hours);
  console.log('Potential score gain:', summary?.potential_score_gain + ' points');

  // Test with history
  console.log('\n=== Additional: Test with history ===');
  const scoreWithHistoryRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/score/' + projectId + '?include_history=true',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('History included:', !!scoreWithHistoryRes.data.history);
  console.log('History length:', scoreWithHistoryRes.data.history?.length);
  console.log('Trend:', scoreWithHistoryRes.data.trend);
  if (scoreWithHistoryRes.data.history?.length > 0) {
    console.log('History sample:', scoreWithHistoryRes.data.history[0]);
  }

  // Final verification summary
  console.log('\n========================================');
  console.log('FEATURE #926 VERIFICATION SUMMARY');
  console.log('========================================');
  const step1Pass = scoreRes.status === 200 && !!scoreRes.data.project_id && scoreRes.data.score !== undefined;
  const step2Pass = score >= 0 && score <= 100 && !!grade;
  const step3Pass = factors.length > 0 && factors.every(f => f.name && f.score !== undefined && f.weight !== undefined && f.details);
  const step4Pass = Array.isArray(suggestions) && (suggestions.length === 0 || suggestions.every(s => s.priority && s.action && s.potential_gain !== undefined));

  console.log('✓ Step 1: Call get-security-score with project ID:', step1Pass);
  console.log('✓ Step 2: Verify score returned (0-100):', step2Pass);
  console.log('✓ Step 3: Verify scoring factors shown:', step3Pass);
  console.log('✓ Step 4: Verify improvement suggestions:', step4Pass);
  console.log('');
  console.log('All steps passed:', step1Pass && step2Pass && step3Pass && step4Pass);
})();
