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

  // FEATURE #938 TEST STEP 1: Call get-fix-suggestions with vuln ID
  console.log('\n=== Feature #938 Step 1: Call get-fix-suggestions with vuln ID ===');
  const fixRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/vulnerabilities/CVE-2021-23337/fix-suggestions?package=lodash&version=4.17.15&ecosystem=npm',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', fixRes.status);
  console.log('Vulnerability ID:', fixRes.data.vulnerability_id);
  console.log('Package:', fixRes.data.package);
  console.log('Current version:', fixRes.data.current_version);
  console.log('Ecosystem:', fixRes.data.ecosystem);
  console.log('Total suggestions:', fixRes.data.summary?.total_suggestions);

  // Vulnerability info
  console.log('\nVulnerability info:');
  console.log('  Title:', fixRes.data.vulnerability_info?.title);
  console.log('  Severity:', fixRes.data.vulnerability_info?.severity);
  console.log('  CWE:', fixRes.data.vulnerability_info?.cwe);

  // FEATURE #938 TEST STEP 2: Verify fix code suggested
  console.log('\n=== Feature #938 Step 2: Verify fix code suggested ===');
  const suggestions = fixRes.data.suggestions || [];
  console.log('Suggestions count:', suggestions.length);

  suggestions.forEach((s, i) => {
    console.log(`\nSuggestion ${i + 1}: ${s.title}`);
    console.log('  Type:', s.type);
    console.log('  Priority:', s.priority);
    console.log('  Effort:', s.effort_estimate);
    console.log('  Confidence:', s.confidence);
    if (s.fix_code) {
      console.log('  Has fix_code:', true);
      console.log('  Language:', s.fix_code.language);
      if (s.fix_code.commands) {
        console.log('  Commands:', s.fix_code.commands.join(' && '));
      }
      if (s.fix_code.before && s.fix_code.after) {
        console.log('  Before:', s.fix_code.before.substring(0, 50) + '...');
        console.log('  After:', s.fix_code.after.substring(0, 50) + '...');
      }
    }
  });

  // FEATURE #938 TEST STEP 3: Verify safe version recommended
  console.log('\n=== Feature #938 Step 3: Verify safe version recommended ===');
  const upgradeSuggestion = suggestions.find(s => s.type === 'upgrade');
  console.log('Has upgrade suggestion:', !!upgradeSuggestion);
  console.log('Safe version:', upgradeSuggestion?.safe_version);
  console.log('Current version:', upgradeSuggestion?.current_version);
  console.log('Summary safe_version:', fixRes.data.summary?.safe_version);
  console.log('Summary recommended_action:', fixRes.data.summary?.recommended_action);

  // FEATURE #938 TEST STEP 4: Verify breaking change warnings
  console.log('\n=== Feature #938 Step 4: Verify breaking change warnings ===');
  console.log('Summary has_breaking_changes:', fixRes.data.summary?.has_breaking_changes);

  suggestions.forEach((s, i) => {
    if (s.breaking_changes) {
      console.log(`\nSuggestion ${i + 1} breaking changes:`);
      console.log('  Has breaking changes:', s.breaking_changes.has_breaking_changes);
      console.log('  Risk level:', s.breaking_changes.risk_level);
      console.log('  Changes:', s.breaking_changes.changes?.length || 0);
      if (s.breaking_changes.changes?.length > 0) {
        s.breaking_changes.changes.forEach((c, j) => {
          console.log(`    - ${c}`);
        });
      }
      console.log('  Migration notes:', s.breaking_changes.migration_notes?.substring(0, 60) + '...');
    }
  });

  // Additional: Test with known CVE
  console.log('\n=== Additional: Test with known CVE ===');
  const cveRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/vulnerabilities/CVE-2020-28469/fix-suggestions?package=glob-parent&version=5.1.0',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('CVE-2020-28469:');
  console.log('  Title:', cveRes.data.vulnerability_info?.title);
  console.log('  Safe version:', cveRes.data.summary?.safe_version);

  // Additional: Test without code examples
  console.log('\n=== Additional: Test without code examples ===');
  const noCodeRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/vulnerabilities/CVE-2021-23337/fix-suggestions?code_examples=false',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('First suggestion has fix_code:', !!noCodeRes.data.suggestions?.[0]?.fix_code);

  // Additional: Test without breaking changes
  console.log('\n=== Additional: Test without breaking changes ===');
  const noBreakingRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/vulnerabilities/CVE-2021-23337/fix-suggestions?breaking_changes=false',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('First suggestion has breaking_changes:', !!noBreakingRes.data.suggestions?.[0]?.breaking_changes);

  // Additional: Test with max_suggestions=1
  console.log('\n=== Additional: Test max_suggestions=1 ===');
  const maxOneRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/vulnerabilities/CVE-2021-23337/fix-suggestions?max_suggestions=1',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Suggestions returned:', maxOneRes.data.suggestions?.length);

  // Final verification summary
  console.log('\n========================================');
  console.log('FEATURE #938 VERIFICATION SUMMARY');
  console.log('========================================');
  const step1Pass = fixRes.status === 200 && fixRes.data.vulnerability_id === 'CVE-2021-23337' && suggestions.length > 0;
  const step2Pass = suggestions.some(s => !!s.fix_code && (!!s.fix_code.commands || (!!s.fix_code.before && !!s.fix_code.after)));
  const step3Pass = !!upgradeSuggestion?.safe_version && !!fixRes.data.summary?.safe_version && fixRes.data.summary?.recommended_action === 'upgrade';
  const step4Pass = suggestions.some(s => !!s.breaking_changes && s.breaking_changes.risk_level !== undefined);

  console.log('Step 1: Call get-fix-suggestions with vuln ID:', step1Pass);
  console.log('Step 2: Verify fix code suggested:', step2Pass);
  console.log('Step 3: Verify safe version recommended:', step3Pass);
  console.log('Step 4: Verify breaking change warnings:', step4Pass);
  console.log('');
  console.log('All steps passed:', step1Pass && step2Pass && step3Pass && step4Pass ? 'true' : 'false');
})();
