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

  // Create project for testing
  console.log('\n=== Setup: Create Project ===');
  const createProjectRes = await makeRequest({
    hostname: 'localhost', port: 3001, path: '/api/v1/projects',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { name: 'Security Schedule Test ' + Date.now(), base_url: 'https://test.example.com' });
  const projectId = createProjectRes.data.project?.id;
  console.log('Project ID:', projectId);

  // FEATURE #937 TEST STEP 1: Call schedule-security-scan
  console.log('\n=== Feature #937 Step 1: Call schedule-security-scan ===');
  const dailyScheduleRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/scan-schedules',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    project_id: projectId,
    scan_type: 'dependency',
    frequency: 'daily',
    time_of_day: '03:00'
  });
  console.log('Status:', dailyScheduleRes.status);
  console.log('Has schedule_id:', !!dailyScheduleRes.data.schedule_id);
  console.log('Schedule ID:', dailyScheduleRes.data.schedule_id);
  console.log('Project ID:', dailyScheduleRes.data.project_id);
  console.log('Scan type:', dailyScheduleRes.data.scan_type);
  console.log('Status:', dailyScheduleRes.data.status);

  // FEATURE #937 TEST STEP 2: Set frequency (daily, weekly)
  console.log('\n=== Feature #937 Step 2: Set frequency (daily, weekly) ===');
  console.log('Daily schedule:');
  console.log('  Frequency:', dailyScheduleRes.data.frequency);
  console.log('  Schedule description:', dailyScheduleRes.data.schedule_description);

  // Test weekly frequency
  const weeklyScheduleRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/scan-schedules',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    project_id: projectId,
    scan_type: 'dast',
    frequency: 'weekly',
    day_of_week: 1,
    time_of_day: '04:00',
    target_url: 'https://test.example.com'
  });
  console.log('\nWeekly schedule:');
  console.log('  Frequency:', weeklyScheduleRes.data.frequency);
  console.log('  Schedule description:', weeklyScheduleRes.data.schedule_description);
  console.log('  Day of week:', weeklyScheduleRes.data.configuration?.day_of_week);

  // Test hourly frequency
  const hourlyScheduleRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/scan-schedules',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    project_id: projectId,
    scan_type: 'secret',
    frequency: 'hourly'
  });
  console.log('\nHourly schedule:');
  console.log('  Frequency:', hourlyScheduleRes.data.frequency);
  console.log('  Schedule description:', hourlyScheduleRes.data.schedule_description);

  // FEATURE #937 TEST STEP 3: Verify schedule created
  console.log('\n=== Feature #937 Step 3: Verify schedule created ===');
  console.log('Daily schedule created:', dailyScheduleRes.status === 200);
  console.log('  Schedule ID:', dailyScheduleRes.data.schedule_id);
  console.log('  Status:', dailyScheduleRes.data.status);
  console.log('  Notifications:', JSON.stringify(dailyScheduleRes.data.notifications));
  console.log('  Metadata:', JSON.stringify(dailyScheduleRes.data.metadata));

  // Verify by listing schedules
  const listRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/scan-schedules?project_id=' + projectId,
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('\nListed schedules:', listRes.data.total);
  listRes.data.schedules?.forEach((s, i) => {
    console.log(`  ${i + 1}. [${s.scan_type}] ${s.frequency} - ${s.status}`);
  });

  // FEATURE #937 TEST STEP 4: Verify next run time shown
  console.log('\n=== Feature #937 Step 4: Verify next run time shown ===');
  console.log('Daily schedule timing:');
  console.log('  Next run:', dailyScheduleRes.data.timing?.next_run);
  console.log('  Last run:', dailyScheduleRes.data.timing?.last_run);
  console.log('  Created at:', dailyScheduleRes.data.timing?.created_at);
  console.log('  Timezone:', dailyScheduleRes.data.timing?.timezone);

  console.log('\nWeekly schedule timing:');
  console.log('  Next run:', weeklyScheduleRes.data.timing?.next_run);

  // Verify next_run is in the future
  const nextRunDate = new Date(dailyScheduleRes.data.timing?.next_run);
  const now = new Date();
  console.log('\nNext run is in future:', nextRunDate > now);

  // Additional: Test monthly frequency
  console.log('\n=== Additional: Test monthly frequency ===');
  const monthlyScheduleRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/scan-schedules',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    project_id: projectId,
    scan_type: 'full',
    frequency: 'monthly',
    time_of_day: '01:00',
    severity_threshold: 'critical'
  });
  console.log('Monthly schedule:');
  console.log('  Frequency:', monthlyScheduleRes.data.frequency);
  console.log('  Schedule description:', monthlyScheduleRes.data.schedule_description);
  console.log('  Severity threshold:', monthlyScheduleRes.data.notifications?.severity_threshold);

  // Additional: Test container scan schedule
  console.log('\n=== Additional: Test container scan schedule ===');
  const containerScheduleRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/scan-schedules',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    project_id: projectId,
    scan_type: 'container',
    frequency: 'daily',
    image: 'myapp:latest',
    notify_on_vulnerabilities: true,
    severity_threshold: 'high'
  });
  console.log('Container schedule:');
  console.log('  Image:', containerScheduleRes.data.configuration?.image);
  console.log('  Notify on vulns:', containerScheduleRes.data.notifications?.notify_on_vulnerabilities);

  // Additional: Test invalid frequency
  console.log('\n=== Additional: Test invalid frequency ===');
  const invalidRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/scan-schedules',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    project_id: projectId,
    scan_type: 'dependency',
    frequency: 'invalid'
  });
  console.log('Invalid frequency rejected:', invalidRes.status === 400);
  console.log('Error message:', invalidRes.data.error);

  // Additional: Test delete schedule
  console.log('\n=== Additional: Test delete schedule ===');
  const deleteRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/security/scan-schedules/' + hourlyScheduleRes.data.schedule_id,
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Deleted:', deleteRes.data.deleted);
  console.log('Message:', deleteRes.data.message);

  // Final verification summary
  console.log('\n========================================');
  console.log('FEATURE #937 VERIFICATION SUMMARY');
  console.log('========================================');
  const step1Pass = dailyScheduleRes.status === 200 && !!dailyScheduleRes.data.schedule_id && dailyScheduleRes.data.status === 'active';
  const step2Pass = dailyScheduleRes.data.frequency === 'daily' && weeklyScheduleRes.data.frequency === 'weekly' && hourlyScheduleRes.data.frequency === 'hourly';
  const step3Pass = !!dailyScheduleRes.data.schedule_id && !!dailyScheduleRes.data.notifications && listRes.data.total >= 3;
  const step4Pass = !!dailyScheduleRes.data.timing?.next_run && nextRunDate > now && !!weeklyScheduleRes.data.timing?.next_run;

  console.log('Step 1: Call schedule-security-scan:', step1Pass);
  console.log('Step 2: Set frequency (daily, weekly):', step2Pass);
  console.log('Step 3: Verify schedule created:', step3Pass);
  console.log('Step 4: Verify next run time shown:', step4Pass);
  console.log('');
  console.log('All steps passed:', step1Pass && step2Pass && step3Pass && step4Pass ? 'true' : 'false');
})();
