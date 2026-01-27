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

  // FEATURE #935 TEST STEP 1: Call get-container-vulnerabilities with image
  console.log('\n=== Feature #935 Step 1: Call get-container-vulnerabilities with image ===');
  const scanRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/container/scan?image=nginx:latest',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {});
  console.log('Status:', scanRes.status);
  console.log('Has scan_id:', !!scanRes.data.scan_id);
  console.log('Scan ID:', scanRes.data.scan_id);
  console.log('Has image info:', !!scanRes.data.image);
  console.log('Image reference:', scanRes.data.image?.reference);
  console.log('Image name:', scanRes.data.image?.name);
  console.log('Image tag:', scanRes.data.image?.tag);
  console.log('Registry:', scanRes.data.image?.registry);

  // FEATURE #935 TEST STEP 2: Verify image scanned
  console.log('\n=== Feature #935 Step 2: Verify image scanned ===');
  console.log('Scan status:', scanRes.data.scan?.status);
  console.log('Scanned at:', scanRes.data.scan?.scanned_at);
  console.log('Scanner:', scanRes.data.scan?.scanner);
  console.log('Scanner version:', scanRes.data.scan?.scanner_version);
  console.log('Duration:', scanRes.data.scan?.duration_seconds, 'seconds');
  console.log('Image digest:', scanRes.data.image?.digest);
  console.log('Image size:', scanRes.data.image?.size_mb, 'MB');

  // FEATURE #935 TEST STEP 3: Verify layer analysis
  console.log('\n=== Feature #935 Step 3: Verify layer analysis ===');
  const layers = scanRes.data.layers || [];
  console.log('Has layers:', !!scanRes.data.layers);
  console.log('Layer count:', layers.length);
  layers.forEach((layer, i) => {
    console.log(`  Layer ${i + 1}: ${layer.id?.substring(0, 20)}...`);
    console.log(`    Command: ${layer.command?.substring(0, 50)}...`);
    console.log(`    Size: ${layer.size_mb} MB, Vulns: ${layer.vulnerability_count}`);
    console.log(`    Is base layer: ${layer.is_base_layer}`);
  });

  // Check base image analysis
  console.log('\nBase image analysis:');
  console.log('Base image reference:', scanRes.data.base_image?.reference);
  console.log('Base image vulnerabilities:', scanRes.data.base_image?.vulnerabilities);
  console.log('Recommendation:', scanRes.data.base_image?.recommendation?.substring(0, 60) + '...');
  console.log('Alternatives:', scanRes.data.base_image?.alternatives?.length);

  // FEATURE #935 TEST STEP 4: Verify CVEs listed
  console.log('\n=== Feature #935 Step 4: Verify CVEs listed ===');
  const vulns = scanRes.data.vulnerabilities || [];
  console.log('Total vulnerabilities:', scanRes.data.summary?.total_vulnerabilities);
  console.log('By severity:', JSON.stringify(scanRes.data.summary?.by_severity));
  console.log('Fixable:', scanRes.data.summary?.fixable);
  console.log('From base image:', scanRes.data.summary?.from_base_image);

  console.log('\nVulnerabilities:');
  vulns.forEach((v, i) => {
    console.log(`  ${i + 1}. [${v.severity.toUpperCase()}] ${v.id}: ${v.title}`);
    console.log(`     Package: ${v.package} ${v.version} -> ${v.fixed_version}`);
    console.log(`     CVSS: ${v.cvss_score}, In base image: ${v.in_base_image}`);
  });

  // Additional: Test with custom image reference
  console.log('\n=== Additional: Test with custom image reference ===');
  const customRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/container/scan?image=gcr.io/my-project/app:v1.0.0',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {});
  console.log('Image name:', customRes.data.image?.name);
  console.log('Image tag:', customRes.data.image?.tag);
  console.log('Registry:', customRes.data.image?.registry);

  // Additional: Test severity filter
  console.log('\n=== Additional: Test severity filter ===');
  const criticalRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/container/scan?image=nginx:latest&severity=critical',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {});
  console.log('Critical filter - total:', criticalRes.data.summary?.total_vulnerabilities);
  console.log('All critical:', criticalRes.data.vulnerabilities?.every(v => v.severity === 'critical'));

  // Additional: Test without layers
  console.log('\n=== Additional: Test without layers ===');
  const noLayersRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/container/scan?image=nginx:latest&include_layers=false',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {});
  console.log('Has layers:', !!noLayersRes.data.layers);

  // Additional: Check recommendations
  console.log('\n=== Additional: Check recommendations ===');
  const recommendations = scanRes.data.recommendations || [];
  console.log('Recommendations:', recommendations.length);
  recommendations.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.priority}] ${r.action?.substring(0, 70)}...`);
  });

  // Final verification summary
  console.log('\n========================================');
  console.log('FEATURE #935 VERIFICATION SUMMARY');
  console.log('========================================');
  const step1Pass = scanRes.status === 200 && !!scanRes.data.scan_id && !!scanRes.data.image?.reference;
  const step2Pass = scanRes.data.scan?.status === 'completed' && !!scanRes.data.scan?.scanned_at && !!scanRes.data.scan?.scanner;
  const step3Pass = layers.length > 0 && layers[0].id && layers[0].command && layers.some(l => l.is_base_layer);
  const step4Pass = vulns.length > 0 && vulns[0].id && vulns[0].id.startsWith('CVE-') && !!vulns[0].severity && !!vulns[0].cvss_score;

  console.log('Step 1: Call get-container-vulnerabilities with image:', step1Pass);
  console.log('Step 2: Verify image scanned:', step2Pass);
  console.log('Step 3: Verify layer analysis:', step3Pass);
  console.log('Step 4: Verify CVEs listed:', step4Pass);
  console.log('');
  console.log('All steps passed:', step1Pass && step2Pass && step3Pass && step4Pass ? 'true' : 'false');
})();
