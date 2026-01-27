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
  console.log('Login response:', JSON.stringify(loginRes.data, null, 2));
  const token = loginRes.data.token;

  // Create project
  console.log('\n=== Step 2: Create Project ===');
  const createProjectRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/v1/projects',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { name: 'Dismiss Vuln Test ' + Date.now(), base_url: 'https://test.example.com' });
  console.log('Create project response:', JSON.stringify(createProjectRes.data, null, 2));

  // Get the project ID from the response
  const projectId = createProjectRes.data.project?.id || createProjectRes.data.id;
  console.log('Project ID:', projectId);

  if (!projectId) {
    // Try getting projects list
    console.log('\n=== Getting projects list ===');
    const projectsRes = await makeRequest({
      hostname: 'localhost', port: 3001, path: '/api/v1/projects',
      method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log('Projects:', JSON.stringify(projectsRes.data.projects?.slice(0, 2), null, 2));
    process.exit(1);
  }

  // Run security scan
  console.log('\n=== Step 3: Run Security Scan ===');
  const scanRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/v1/security/scans/project/' + projectId,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { scan_type: 'full', target_url: 'https://test.example.com' });
  console.log('Scan response:', JSON.stringify(scanRes.data, null, 2));

  // Wait for scan
  await new Promise(r => setTimeout(r, 3000));

  // Get vulnerabilities
  console.log('\n=== Step 4: Get Vulnerabilities ===');
  const vulnRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/v1/security/vulnerabilities',
    method: 'GET', headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Vulnerabilities:', JSON.stringify(vulnRes.data, null, 2));
})();
