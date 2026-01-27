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
  }, { name: 'Security Trends Test ' + Date.now(), base_url: 'https://test.example.com' });
  const projectId = createProjectRes.data.project?.id;
  console.log('Project ID:', projectId);

  // FEATURE #925 TEST STEP 1: Call get-security-trends with project ID
  console.log('\n=== Feature #925 Step 1: Call get-security-trends with project ID ===');
  const trendsRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/trends?project_id=' + projectId,
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', trendsRes.status);
  console.log('Has project_id:', !!trendsRes.data.project_id);
  console.log('Has period:', !!trendsRes.data.period);
  console.log('Has date_range:', !!trendsRes.data.date_range);
  console.log('Has trends:', !!trendsRes.data.trends);

  // FEATURE #925 TEST STEP 2: Specify date range (using period)
  console.log('\n=== Feature #925 Step 2: Specify date range ===');
  console.log('Testing different periods...');

  // Test 7 day period
  const trends7dRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/trends?period=7d',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('7d period - Days:', trends7dRes.data.date_range?.days);
  console.log('7d period - Data points:', trends7dRes.data.trends?.length);

  // Test 90 day period
  const trends90dRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/trends?period=90d',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('90d period - Days:', trends90dRes.data.date_range?.days);
  console.log('90d period - Data points:', trends90dRes.data.trends?.length);

  // Test explicit date range
  const fromDate = '2026-01-01';
  const toDate = '2026-01-15';
  const trendsDateRangeRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: `/api/v1/security/trends?from_date=${fromDate}&to_date=${toDate}`,
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Custom date range - From:', fromDate, 'To:', toDate);
  console.log('Custom date range - Days:', trendsDateRangeRes.data.date_range?.days);

  // FEATURE #925 TEST STEP 3: Verify trend data returned
  console.log('\n=== Feature #925 Step 3: Verify trend data returned ===');
  const trends = trendsRes.data.trends || [];
  console.log('Trend data points:', trends.length);
  if (trends.length > 0) {
    const firstPoint = trends[0];
    const lastPoint = trends[trends.length - 1];
    console.log('First data point:', firstPoint.date);
    console.log('  - Total vulnerabilities:', firstPoint.vulnerabilities?.total);
    console.log('  - Scan coverage:', firstPoint.scan_coverage?.toFixed(1) + '%');
    console.log('  - Fix rate:', firstPoint.fix_rate + '%');
    console.log('  - MTTR:', firstPoint.mttr_hours + ' hours');
    console.log('Last data point:', lastPoint.date);
    console.log('  - Total vulnerabilities:', lastPoint.vulnerabilities?.total);
  }
  console.log('\nSummary:');
  const summary = trendsRes.data.summary;
  console.log('  Total vulnerabilities (latest):', summary?.total_vulnerabilities);
  console.log('  Vulnerability change:', summary?.vulnerability_change);
  console.log('  Change percent:', summary?.vulnerability_change_percent + '%');
  console.log('  Avg fix rate:', summary?.avg_fix_rate + '%');
  console.log('  Avg scan coverage:', summary?.avg_scan_coverage + '%');
  console.log('  Avg MTTR:', summary?.avg_mttr_hours + ' hours');
  console.log('  Total scans:', summary?.total_scans);
  console.log('  Vulnerabilities fixed:', summary?.vulnerabilities_fixed);

  // FEATURE #925 TEST STEP 4: Verify severity breakdown
  console.log('\n=== Feature #925 Step 4: Verify by severity breakdown ===');
  const severityBreakdown = trendsRes.data.severity_breakdown;
  console.log('Current severity breakdown:');
  console.log('  Critical:', severityBreakdown?.current?.critical);
  console.log('  High:', severityBreakdown?.current?.high);
  console.log('  Medium:', severityBreakdown?.current?.medium);
  console.log('  Low:', severityBreakdown?.current?.low);
  console.log('\nChange from period start:');
  console.log('  Critical:', severityBreakdown?.change_from_start?.critical);
  console.log('  High:', severityBreakdown?.change_from_start?.high);
  console.log('  Medium:', severityBreakdown?.change_from_start?.medium);
  console.log('  Low:', severityBreakdown?.change_from_start?.low);

  // Check analysis
  console.log('\n=== Additional: Check Analysis ===');
  const analysis = trendsRes.data.analysis;
  console.log('Vulnerability trend:', analysis?.vulnerability_trend);
  console.log('Critical issues:', analysis?.critical_issues);
  console.log('Recommendations:', analysis?.recommendations?.length);
  if (analysis?.recommendations?.length > 0) {
    analysis.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. [${rec.priority}] ${rec.action}`);
    });
  }

  // Test metric filtering
  console.log('\n=== Additional: Test Metric Filtering ===');
  const vulnMetricRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/trends?metric=vulnerabilities',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Metric filter "vulnerabilities" - First point keys:', Object.keys(vulnMetricRes.data.trends?.[0] || {}));

  // Final verification summary
  console.log('\n========================================');
  console.log('FEATURE #925 VERIFICATION SUMMARY');
  console.log('========================================');
  const step1Pass = trendsRes.status === 200 && !!trendsRes.data.project_id && !!trendsRes.data.trends;
  const step2Pass = trends7dRes.status === 200 && trends7dRes.data.date_range?.days === 7 &&
                    trends90dRes.status === 200 && trends90dRes.data.date_range?.days === 90;
  const step3Pass = trends.length > 0 &&
                    trends[0].vulnerabilities !== undefined &&
                    trends[0].scan_coverage !== undefined &&
                    summary?.total_vulnerabilities !== undefined;
  const step4Pass = severityBreakdown?.current?.critical !== undefined &&
                    severityBreakdown?.current?.high !== undefined &&
                    severityBreakdown?.current?.medium !== undefined &&
                    severityBreakdown?.current?.low !== undefined;

  console.log('✓ Step 1: Call get-security-trends with project ID:', step1Pass);
  console.log('✓ Step 2: Specify date range:', step2Pass);
  console.log('✓ Step 3: Verify trend data returned:', step3Pass);
  console.log('✓ Step 4: Verify by severity breakdown:', step4Pass);
  console.log('');
  console.log('All steps passed:', step1Pass && step2Pass && step3Pass && step4Pass);
})();
