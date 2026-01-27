# Integrations

> 14 features | 14 completed | 0 pending

[← Back to Index](../README.md)

---

## ✅ Completed Features

### ✅ Trigger test run via API

Verify API test execution

**How to use:**
Trigger test runs programmatically via the REST API.

**Expected Behavior:**
1. Step 1: Generate API key with 'execute' scope
2. Step 2: POST /api/v1/suites/{id}/runs with API key
3. Step 3: Verify 201 response with run ID
4. Step 4: GET /api/v1/runs/{id} to check status
5. Step 5: Verify run completes with results

**API Reference:**
```
POST /api/v1/suites/{id}/run
```

---

### ✅ Get test results via API

Verify API results retrieval

**How to use:**
Fetch test results via API for integration with other tools.

**Expected Behavior:**
1. Step 1: Run tests to create results
2. Step 2: GET /api/v1/runs/{id}/results
3. Step 3: Verify 200 response
4. Step 4: Verify results array returned
5. Step 5: Verify each result has status, duration, artifacts

**API Reference:**
```
GET /api/v1/runs/{id}/results
```

---

### ✅ API key rotation

Verify key rotation without downtime

**How to use:**
Rotate API keys in Settings without downtime. Both keys work during transition.

**Expected Behavior:**
1. Step 1: Create API key and note the key
2. Step 2: Use key to make successful request
3. Step 3: Rotate the key (POST /api/v1/api-keys/{id}/rotate)
4. Step 4: Verify new key returned
5. Step 5: Verify old key still works briefly
6. Step 6: Verify new key works
7. Step 7: Verify old key eventually invalidated

---

### ✅ OpenAPI documentation accessible

Verify API docs availability

**How to use:**
Interactive API documentation is available at /api/docs.

**Expected Behavior:**
1. Step 1: Navigate to /api/docs or /swagger
2. Step 2: Verify Swagger UI loads
3. Step 3: Verify all endpoints documented
4. Step 4: Verify request/response schemas shown
5. Step 5: Verify try-it-out functionality works

---

### ✅ API rate limiting

Verify rate limit enforcement

**How to use:**
API requests are rate limited. Check headers for your remaining quota.

**Expected Behavior:**
1. Step 1: Make rapid API requests (100+ in 1 minute)
2. Step 2: Verify 429 response after limit exceeded
3. Step 3: Verify rate limit headers present
4. Step 4: Wait for rate limit reset
5. Step 5: Verify requests work again

**API Reference:**
```
Headers: X-RateLimit-Remaining, X-RateLimit-Reset
```

---

### ✅ Email alert on test failure

Verify email notification

**How to use:**
Receive email alerts when tests fail. Configure in notification settings.

**Expected Behavior:**
1. Step 1: Configure email alert channel
2. Step 2: Set condition: On any failure
3. Step 3: Run test that fails
4. Step 4: Verify email sent (or queued)
5. Step 5: Verify email contains failure details
6. Step 6: Verify link to results in email

---

### ✅ Webhook alert delivery

Verify webhook notification

**How to use:**
Configure webhooks to send alerts to any custom endpoint.

**Expected Behavior:**
1. Step 1: Configure webhook URL
2. Step 2: Set alert condition
3. Step 3: Trigger alert (run failing test)
4. Step 4: Verify webhook received (check endpoint)
5. Step 5: Verify payload contains expected data

---

### ✅ Alert suppression on retry success

Verify smart alert suppression

**How to use:**
If a retry passes, the initial failure alert is suppressed.

**Expected Behavior:**
1. Step 1: Configure alert with retry suppression
2. Step 2: Run test that fails then passes on retry
3. Step 3: Verify alert NOT sent (retry succeeded)
4. Step 4: Run test that fails all retries
5. Step 5: Verify alert IS sent

---

### ✅ Alert history log

Verify alert tracking

**How to use:**
View a log of all alerts sent and their delivery status.

**Expected Behavior:**
1. Step 1: Trigger multiple alerts over time
2. Step 2: Navigate to alert history
3. Step 3: Verify all alerts logged
4. Step 4: Verify sent/failed status shown
5. Step 5: Verify timestamp and details

---

### ✅ Slack integration alert

Verify Slack notification

**How to use:**
Connect Slack to receive test failure alerts in your channel.

**Expected Behavior:**
1. Step 1: Connect Slack via OAuth
2. Step 2: Select channel for alerts
3. Step 3: Configure alert on failure
4. Step 4: Run failing test
5. Step 5: Verify Slack message posted
6. Step 6: Verify message contains summary

---

### ✅ Auto-discover Playwright tests

Verify test file discovery from repo

**How to use:**
Connect your repo and QA Guardian automatically discovers your Playwright test files.

**Expected Behavior:**
1. Step 1: Connect GitHub repo with Playwright tests
2. Step 2: Verify auto-discovery runs
3. Step 3: Check discovered tests list
4. Step 4: Verify *.spec.ts and *.test.ts files found
5. Step 5: Verify test count matches repository

---

### ✅ Select branch for discovery

Verify branch selection

**How to use:**
Choose which branch to scan for tests in the GitHub integration settings.

**Expected Behavior:**
1. Step 1: Connect repository with multiple branches
2. Step 2: Change branch selection to 'develop'
3. Step 3: Trigger refresh
4. Step 4: Verify tests from 'develop' branch discovered
5. Step 5: Verify different from 'main' branch tests

---

### ✅ PR status check posted

Verify GitHub status checks

**How to use:**
Test results are posted as status checks on your GitHub pull requests.

**Expected Behavior:**
1. Step 1: Configure project for PR checks
2. Step 2: Create/update a PR in connected repo
3. Step 3: Verify QA Guardian status check appears
4. Step 4: Verify status updates as tests run
5. Step 5: Verify final pass/fail status shown

---

### ✅ PR comment with results

Verify PR commenting

**How to use:**
Test result summaries are added as comments on your pull requests.

**Expected Behavior:**
1. Step 1: Enable PR comments in settings
2. Step 2: Run tests triggered by PR
3. Step 3: Verify comment posted to PR
4. Step 4: Verify comment contains pass/fail summary
5. Step 5: Verify link to detailed results

---

