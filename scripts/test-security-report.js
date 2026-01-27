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
  }, { name: 'Security Report Test ' + Date.now(), base_url: 'https://test.example.com' });
  const projectId = createProjectRes.data.project?.id;
  console.log('Project ID:', projectId);

  // FEATURE #933 TEST STEP 1: Call generate-security-report with project ID
  console.log('\n=== Feature #933 Step 1: Call generate-security-report with project ID ===');
  const reportRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/report/' + projectId,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {});
  console.log('Status:', reportRes.status);
  console.log('Has report_id:', !!reportRes.data.report_id);
  console.log('Report ID:', reportRes.data.report_id);
  console.log('Project ID:', reportRes.data.project_id);
  console.log('Report status:', reportRes.data.status);
  console.log('Generated at:', reportRes.data.generated_at);

  // FEATURE #933 TEST STEP 2: Specify report format (PDF, HTML)
  console.log('\n=== Feature #933 Step 2: Specify report format (PDF, HTML) ===');

  // Test PDF format (default)
  console.log('PDF format test:');
  console.log('  Format:', reportRes.data.format);
  console.log('  Mime type:', reportRes.data.file?.mime_type);

  // Test HTML format
  const htmlReportRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/report/' + projectId,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { format: 'html' });
  console.log('HTML format test:');
  console.log('  Format:', htmlReportRes.data.format);
  console.log('  Mime type:', htmlReportRes.data.file?.mime_type);

  // Test JSON format
  const jsonReportRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/report/' + projectId,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { format: 'json' });
  console.log('JSON format test:');
  console.log('  Format:', jsonReportRes.data.format);
  console.log('  Mime type:', jsonReportRes.data.file?.mime_type);

  // Test Markdown format
  const mdReportRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/report/' + projectId,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { format: 'markdown' });
  console.log('Markdown format test:');
  console.log('  Format:', mdReportRes.data.format);
  console.log('  Mime type:', mdReportRes.data.file?.mime_type);

  // FEATURE #933 TEST STEP 3: Verify report generated
  console.log('\n=== Feature #933 Step 3: Verify report generated ===');
  console.log('Report status:', reportRes.data.status);
  console.log('Has file info:', !!reportRes.data.file);
  console.log('File size:', reportRes.data.file?.size_bytes, 'bytes');
  console.log('Download URL:', reportRes.data.file?.download_url);
  console.log('Expires at:', reportRes.data.file?.expires_at);
  console.log('Has executive summary:', !!reportRes.data.executive_summary);
  if (reportRes.data.executive_summary) {
    console.log('  Security score:', reportRes.data.executive_summary.security_score);
    console.log('  Security grade:', reportRes.data.executive_summary.security_grade);
    console.log('  Risk level:', reportRes.data.executive_summary.risk_level);
    console.log('  Key findings:', reportRes.data.executive_summary.key_findings?.length);
    console.log('  Recommendations:', reportRes.data.executive_summary.recommendations?.length);
  }

  // FEATURE #933 TEST STEP 4: Verify all scan types included
  console.log('\n=== Feature #933 Step 4: Verify all scan types included ===');
  const sections = reportRes.data.sections || {};
  console.log('Sections included:');
  console.log('  Vulnerabilities:', !!sections.vulnerabilities);
  console.log('  Dependencies:', !!sections.dependencies);
  console.log('  Secrets:', !!sections.secrets);
  console.log('  DAST:', !!sections.dast);
  console.log('  Compliance:', !!sections.compliance);
  console.log('  SBOM:', !!sections.sbom);

  // Check section details
  if (sections.vulnerabilities) {
    console.log('\nVulnerabilities section:');
    console.log('  Title:', sections.vulnerabilities.title);
    console.log('  Total vulns:', sections.vulnerabilities.summary?.total);
    console.log('  Top vulns:', sections.vulnerabilities.top_vulnerabilities?.length);
  }
  if (sections.dast) {
    console.log('\nDAST section:');
    console.log('  Title:', sections.dast.title);
    console.log('  Scan type:', sections.dast.summary?.scan_type);
    console.log('  Top findings:', sections.dast.top_findings?.length);
  }
  if (sections.compliance) {
    console.log('\nCompliance section:');
    console.log('  Title:', sections.compliance.title);
    console.log('  Frameworks:', sections.compliance.frameworks?.length);
  }

  // Additional: Test with specific sections
  console.log('\n=== Additional: Test with specific sections ===');
  const partialRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/report/' + projectId,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { include_sections: ['vulnerabilities', 'dast'] });
  console.log('Requested sections: vulnerabilities, dast');
  console.log('Has vulnerabilities:', !!partialRes.data.sections?.vulnerabilities);
  console.log('Has dast:', !!partialRes.data.sections?.dast);
  console.log('Has dependencies:', !!partialRes.data.sections?.dependencies);
  console.log('Has secrets:', !!partialRes.data.sections?.secrets);

  // Additional: Test without executive summary
  console.log('\n=== Additional: Test without executive summary ===');
  const noSummaryRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/report/' + projectId,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { executive_summary: false });
  console.log('Has executive summary:', !!noSummaryRes.data.executive_summary);

  // Final verification summary
  console.log('\n========================================');
  console.log('FEATURE #933 VERIFICATION SUMMARY');
  console.log('========================================');
  const step1Pass = reportRes.status === 200 && !!reportRes.data.report_id && reportRes.data.project_id === projectId;
  const step2Pass = reportRes.data.format === 'pdf' && htmlReportRes.data.format === 'html' && jsonReportRes.data.format === 'json';
  const step3Pass = reportRes.data.status === 'completed' && !!reportRes.data.file && !!reportRes.data.file.download_url;
  const step4Pass = !!sections.vulnerabilities && !!sections.dependencies && !!sections.secrets && !!sections.dast && !!sections.compliance && !!sections.sbom;

  console.log('Step 1: Call generate-security-report with project ID:', step1Pass);
  console.log('Step 2: Specify report format (PDF, HTML):', step2Pass);
  console.log('Step 3: Verify report generated:', step3Pass);
  console.log('Step 4: Verify all scan types included:', step4Pass);
  console.log('');
  console.log('All steps passed:', step1Pass && step2Pass && step3Pass && step4Pass ? 'true' : 'false');
})();
