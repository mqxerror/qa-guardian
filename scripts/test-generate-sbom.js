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
  }, { name: 'SBOM Test Project ' + Date.now(), base_url: 'https://test.example.com' });
  const projectId = createProjectRes.data.project?.id;
  console.log('Project ID:', projectId);

  // FEATURE #929 TEST STEP 1: Call generate-sbom with project ID
  console.log('\n=== Feature #929 Step 1: Call generate-sbom with project ID ===');
  const sbomRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/sbom/' + projectId,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {});
  console.log('Status:', sbomRes.status);
  console.log('Has sbom_id:', !!sbomRes.data.sbom_id);
  console.log('Has format:', !!sbomRes.data.format);
  console.log('Has sbom:', !!sbomRes.data.sbom);

  // FEATURE #929 TEST STEP 2: Specify format (CycloneDX, SPDX)
  console.log('\n=== Feature #929 Step 2: Specify format (CycloneDX, SPDX) ===');

  // Test CycloneDX format (default)
  console.log('Testing CycloneDX format...');
  const cyclonedxRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/sbom/' + projectId + '?format=cyclonedx',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {});
  console.log('  Format:', cyclonedxRes.data.format);
  console.log('  Spec version:', cyclonedxRes.data.spec_version);
  console.log('  bomFormat:', cyclonedxRes.data.sbom?.bomFormat);
  console.log('  specVersion:', cyclonedxRes.data.sbom?.specVersion);

  // Test SPDX format
  console.log('\nTesting SPDX format...');
  const spdxRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/sbom/' + projectId + '?format=spdx',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {});
  console.log('  Format:', spdxRes.data.format);
  console.log('  Spec version:', spdxRes.data.spec_version);
  console.log('  spdxVersion:', spdxRes.data.sbom?.spdxVersion);
  console.log('  SPDXID:', spdxRes.data.sbom?.SPDXID);

  // FEATURE #929 TEST STEP 3: Verify SBOM generated
  console.log('\n=== Feature #929 Step 3: Verify SBOM generated ===');
  const sbom = sbomRes.data.sbom;
  console.log('SBOM generated:', !!sbom);
  console.log('Components in SBOM:', sbom?.components?.length || sbom?.packages?.length);
  console.log('Summary:');
  console.log('  Total components:', sbomRes.data.summary?.total_components);
  console.log('  Production:', sbomRes.data.summary?.production_components);
  console.log('  Dev:', sbomRes.data.summary?.dev_components);
  console.log('  Unique licenses:', sbomRes.data.summary?.unique_licenses);
  console.log('  License distribution:', JSON.stringify(sbomRes.data.summary?.license_distribution));

  // Check SBOM content
  if (sbom?.components?.length > 0) {
    const firstComp = sbom.components[0];
    console.log('\nFirst component:');
    console.log('  Name:', firstComp.name);
    console.log('  Version:', firstComp.version);
    console.log('  Type:', firstComp.type);
    console.log('  PURL:', firstComp.purl);
    console.log('  License:', firstComp.licenses?.[0]?.license?.id);
  }

  // FEATURE #929 TEST STEP 4: Verify download URL returned
  console.log('\n=== Feature #929 Step 4: Verify download URL returned ===');
  const download = sbomRes.data.download;
  console.log('Download URL:', download?.url);
  console.log('Filename:', download?.filename);
  console.log('Content type:', download?.content_type);
  console.log('Size:', download?.size_bytes, 'bytes');

  // Check compliance info
  console.log('\n=== Additional: Check Compliance ===');
  console.log('Executive Order 14028:', sbomRes.data.compliance?.executive_order_14028);
  console.log('NTIA minimum elements:', sbomRes.data.compliance?.ntia_minimum_elements);
  console.log('Missing elements:', sbomRes.data.compliance?.missing_elements?.length || 0);

  // Test with dev dependencies included
  console.log('\n=== Additional: Test with dev dependencies ===');
  const sbomWithDevRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/sbom/' + projectId + '?include_dev=true',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {});
  console.log('With dev deps - Total components:', sbomWithDevRes.data.summary?.total_components);
  console.log('With dev deps - Production:', sbomWithDevRes.data.summary?.production_components);
  console.log('With dev deps - Dev:', sbomWithDevRes.data.summary?.dev_components);

  // Final verification summary
  console.log('\n========================================');
  console.log('FEATURE #929 VERIFICATION SUMMARY');
  console.log('========================================');
  const step1Pass = sbomRes.status === 200 && !!sbomRes.data.sbom_id && !!sbomRes.data.sbom;
  const step2Pass = cyclonedxRes.data.format === 'cyclonedx' && cyclonedxRes.data.sbom?.bomFormat === 'CycloneDX' &&
                    spdxRes.data.format === 'spdx' && spdxRes.data.sbom?.spdxVersion === 'SPDX-2.3';
  const step3Pass = (sbom?.components?.length > 0 || sbom?.packages?.length > 0) && sbomRes.data.summary?.total_components > 0;
  const step4Pass = !!download?.url && !!download?.filename && download?.size_bytes > 0;

  console.log('✓ Step 1: Call generate-sbom with project ID:', step1Pass);
  console.log('✓ Step 2: Specify format (CycloneDX, SPDX):', step2Pass);
  console.log('✓ Step 3: Verify SBOM generated:', step3Pass);
  console.log('✓ Step 4: Verify download URL returned:', step4Pass);
  console.log('');
  console.log('All steps passed:', step1Pass && step2Pass && step3Pass && step4Pass);
})();
