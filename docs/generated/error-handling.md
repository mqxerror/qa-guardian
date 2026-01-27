# Error Handling

> 58 features | 30 completed | 28 pending

[← Back to Index](../README.md)

---

## ✅ Completed Features

### ✅ Invalid form input shows field errors

Verify form validation error display

**How to use:**
Invalid form inputs show red error messages below the field. Fix the error and try again.

**Expected Behavior:**
1. Step 1: Navigate to create project form
2. Step 2: Leave required name field empty
3. Step 3: Click submit
4. Step 4: Verify field-level error on name field
5. Step 5: Enter invalid characters in slug field
6. Step 6: Verify specific error message for slug

---

### ✅ API errors display meaningful messages

Verify API errors are translated to user-friendly messages

**How to use:**
API errors display clear messages explaining what went wrong and how to fix it.

**Expected Behavior:**
1. Step 1: Attempt to create project with duplicate name
2. Step 2: Verify error message mentions duplicate/exists
3. Step 3: Verify message does not expose raw SQL error

---

### ✅ Empty search shows no results message

Verify empty state for search

**How to use:**
When search returns no results, you see a helpful message suggesting to try different keywords.

**Expected Behavior:**
1. Step 1: Navigate to test search
2. Step 2: Search for 'zzz_nonexistent_xyz_12345'
3. Step 3: Verify 'No results found' message displayed
4. Step 4: Verify helpful suggestion (try different keywords)

---

### ✅ Loading states during async operations

Verify loading indicators appear during operations

**How to use:**
During loading, spinner icons indicate the operation is in progress. Please wait.

**Expected Behavior:**
1. Step 1: Navigate to dashboard
2. Step 2: Verify loading spinner/skeleton while data loads
3. Step 3: Trigger test run
4. Step 4: Verify loading/progress indicator
5. Step 5: Verify spinner disappears when complete

---

### ✅ Duplicate email registration error

Verify clear error for existing email

**How to use:**
If your email is already registered, you will see a message to log in instead.

**Expected Behavior:**
1. Step 1: Navigate to registration page
2. Step 2: Enter email that already exists
3. Step 3: Complete form and submit
4. Step 4: Verify error message: 'Email already registered'
5. Step 5: Verify form data is preserved

---

### ✅ Server error doesn't expose stack trace

Verify 500 errors are handled gracefully

**How to use:**
Server errors show a friendly message. Technical details are logged securely, not exposed.

**Expected Behavior:**
1. Step 1: Trigger a server error (if possible via edge case)
2. Step 2: Verify error page/message displayed
3. Step 3: Verify no stack trace or technical details visible to user
4. Step 4: Verify error is logged (check console network tab)

---

### ✅ Network failure shows user-friendly error

Verify graceful handling of network errors

**How to use:**
If your internet connection drops, you will see a friendly error message. Retry when connected.

**Expected Behavior:**
1. Step 1: Navigate to projects page
2. Step 2: Simulate network failure (disable network)
3. Step 3: Attempt to create a new project
4. Step 4: Verify user-friendly error message displayed
5. Step 5: Verify no console errors or crashes
6. Step 6: Re-enable network
7. Step 7: Verify retry or reload works

---

### ✅ File upload errors are clear

Verify file upload error handling

**How to use:**
File upload errors show specific messages: file too large, wrong format, etc.

**Expected Behavior:**
1. Step 1: Navigate to import tests feature
2. Step 2: Attempt to upload unsupported file type
3. Step 3: Verify error message indicates invalid file type
4. Step 4: Attempt to upload file that's too large
5. Step 5: Verify error indicates size limit

---

### ✅ Visual regression handles missing baseline gracefully

When no baseline exists for a screenshot, the system should clearly indicate this is the first capture and prompt for baseline creation

**How to use:**
If no baseline exists, the system prompts you to create one.

**Expected Behavior:**
1. Step 1: Navigate to a project with visual regression enabled
2. Step 2: Run a visual test for a new page with no existing baseline
3. Step 3: Verify system shows 'No baseline found' message
4. Step 4: Verify option to 'Set as baseline' is prominently displayed
5. Step 5: Confirm no diff comparison is attempted without baseline

---

### ✅ K6 handles test cancellation gracefully

Cancelled tests should stop cleanly without data loss

**How to use:**
Cancelled K6 tests stop cleanly with partial results preserved.

**Expected Behavior:**
1. Step 1: Start a 10-minute load test
2. Step 2: Cancel the test after 2 minutes
3. Step 3: Verify test stops within 10 seconds
4. Step 4: Verify results collected up to cancellation are saved
5. Step 5: Verify test status shows 'Cancelled' not 'Failed'

---

### ✅ MCP handles invalid API key

Requests with invalid or expired API keys should return proper 401 errors

**How to use:**
Invalid API keys return a clear 401 Unauthorized error.

**Expected Behavior:**
1. Step 1: Send MCP request with invalid API key
2. Step 2: Verify response code is 401 Unauthorized
3. Step 3: Verify error message 'Invalid or expired API key'
4. Step 4: Verify no sensitive data is leaked in error response
5. Step 5: Verify failed attempt is logged for security auditing

---

### ✅ MCP handles insufficient scope

API keys without required scope should get 403 Forbidden

**How to use:**
Insufficient scope returns 403 with the required scope listed.

**Expected Behavior:**
1. Step 1: Create API key with only 'mcp:read' scope
2. Step 2: Attempt to call 'trigger-test-run' (requires mcp:execute)
3. Step 3: Verify response code is 403 Forbidden
4. Step 4: Verify error message lists required scope 'mcp:execute'
5. Step 5: Verify suggestion to update API key permissions

---

### ✅ MCP handles rate limit exceeded

Rate-limited requests should return 429 with retry-after header

**How to use:**
Rate limit exceeded returns 429 with Retry-After header.

**Expected Behavior:**
1. Step 1: Configure API key with 10 requests/minute limit
2. Step 2: Send 15 requests in rapid succession
3. Step 3: Verify 429 Too Many Requests after 10th request
4. Step 4: Verify Retry-After header is present
5. Step 5: Verify request succeeds after waiting retry period

---

### ✅ MCP handles malformed JSON requests

Invalid JSON in request body should return helpful parse error

**How to use:**
Malformed JSON returns 400 with parse error details.

**Expected Behavior:**
1. Step 1: Send MCP request with malformed JSON body
2. Step 2: Verify response code is 400 Bad Request
3. Step 3: Verify error message indicates JSON parse error
4. Step 4: Verify error location (line/column) is provided if possible
5. Step 5: Verify request is not processed

---

### ✅ MCP handles unknown tool invocation

Calls to non-existent tools should return clear error

**How to use:**
Unknown tools return 404 with a list of available tools.

**Expected Behavior:**
1. Step 1: Send MCP request for tool 'nonexistent-tool'
2. Step 2: Verify error 'Unknown tool: nonexistent-tool'
3. Step 3: Verify list of available tools is provided
4. Step 4: Verify similar tool names are suggested if close match exists
5. Step 5: Verify response code is 404

---

### ✅ MCP handles missing required parameters

Tool calls missing required params should list missing fields

**How to use:**
Missing parameters return 400 listing what is required.

**Expected Behavior:**
1. Step 1: Call 'trigger-test-run' without required 'suiteId' parameter
2. Step 2: Verify error 'Missing required parameter: suiteId'
3. Step 3: Verify all missing parameters are listed
4. Step 4: Verify parameter descriptions are included
5. Step 5: Verify response code is 400

---

### ✅ MCP handles invalid parameter types

Wrong parameter types should be validated with type info

**How to use:**
Invalid parameter types return 400 with expected type.

**Expected Behavior:**
1. Step 1: Call 'trigger-test-run' with suiteId as number instead of string
2. Step 2: Verify error 'Invalid type for suiteId: expected string, got number'
3. Step 3: Verify expected type is clearly stated
4. Step 4: Verify response code is 400
5. Step 5: Verify valid example is provided

---

### ✅ MCP handles resource not found

Accessing non-existent resources should return 404 with context

**How to use:**
Resource not found returns 404 with helpful message.

**Expected Behavior:**
1. Step 1: Request resource 'qaguardian://projects/nonexistent-id'
2. Step 2: Verify response code is 404
3. Step 3: Verify error message 'Project not found: nonexistent-id'
4. Step 4: Verify no sensitive data about existing projects is leaked
5. Step 5: Verify available resource patterns are documented

---

### ✅ MCP handles SSE connection timeout

SSE connections that timeout should reconnect gracefully

**How to use:**
SSE connection timeouts trigger automatic reconnection.

**Expected Behavior:**
1. Step 1: Establish SSE connection to MCP server
2. Step 2: Simulate network interruption for 60 seconds
3. Step 3: Verify client receives connection lost event
4. Step 4: Verify automatic reconnection is attempted
5. Step 5: Verify events during disconnection are buffered and delivered

---

### ✅ MCP handles concurrent request limits

Too many concurrent requests should be queued or rejected

**How to use:**
Concurrent request limits queue or reject excess requests.

**Expected Behavior:**
1. Step 1: Configure max 5 concurrent requests per API key
2. Step 2: Send 10 simultaneous requests
3. Step 3: Verify first 5 are processed
4. Step 4: Verify remaining 5 are queued or get 429 response
5. Step 5: Verify queued requests complete when slots free up

---

### ✅ MCP handles test run cancellation during execution

Cancelling a running test via MCP should stop cleanly

**How to use:**
Cancelling a running test stops it cleanly with partial results.

**Expected Behavior:**
1. Step 1: Trigger test run via 'trigger-test-run'
2. Step 2: Wait for run to start executing
3. Step 3: Call 'cancel-test-run' with run ID
4. Step 4: Verify run status changes to 'cancelling' then 'cancelled'
5. Step 5: Verify partial results are available via 'get-test-results'

---

### ✅ Visual regression handles network interruption during upload

Network failure during screenshot upload should allow retry

**How to use:**
Network interruptions during upload retry automatically.

**Expected Behavior:**
1. Step 1: Start visual regression test
2. Step 2: Simulate network failure during screenshot upload
3. Step 3: Verify error 'Failed to upload screenshot - network error'
4. Step 4: Verify automatic retry is attempted (3 times default)
5. Step 5: Verify manual retry option is available if all retries fail

---

### ✅ K6 handles WebSocket target failures

WebSocket load tests against failed endpoints should report clearly

**How to use:**
WebSocket target failures report clear connection errors.

**Expected Behavior:**
1. Step 1: Create K6 script testing WebSocket endpoint
2. Step 2: Configure target that rejects WebSocket upgrade
3. Step 3: Run load test
4. Step 4: Verify error 'WebSocket handshake failed: 400 Bad Request'
5. Step 5: Verify connection failure metrics are captured

---

### ✅ Lighthouse handles Content Security Policy blocks

CSP that blocks Lighthouse should be reported

**How to use:**
CSP blocks are reported with workaround suggestions.

**Expected Behavior:**
1. Step 1: Configure audit for page with strict CSP
2. Step 2: Run Lighthouse audit
3. Step 3: Verify warning if CSP blocks Lighthouse resources
4. Step 4: Verify partial results are shown where possible
5. Step 5: Suggest CSP bypass option for testing environment

---

### ✅ axe-core handles Shadow DOM scanning

Web Components with Shadow DOM should be scanned correctly

**How to use:**
Shadow DOM elements are scanned for accessibility.

**Expected Behavior:**
1. Step 1: Run accessibility scan on page with Shadow DOM components
2. Step 2: Verify Shadow DOM elements are included in scan
3. Step 3: Verify issues within Shadow DOM show correct selectors
4. Step 4: Verify open vs closed Shadow DOMs are handled differently
5. Step 5: Verify warning for closed Shadow DOMs that can't be scanned

---

### ✅ Visual regression handles responsive viewport errors

Invalid viewport configurations should be caught

**How to use:**
Invalid viewport dimensions are caught with helpful errors.

**Expected Behavior:**
1. Step 1: Configure responsive test with viewport width 0
2. Step 2: Attempt to run visual test
3. Step 3: Verify validation error 'Invalidviewport width: must be > 0'
4. Step 4: Verify suggested minimum viewport (320px)
5. Step 5: Prevent test execution with invalid viewport

---

### ✅ K6 handles circular import in scripts

Scripts with circular imports should be detected

**How to use:**
Circular imports are detected with the dependency chain shown.

**Expected Behavior:**
1. Step 1: Create K6 script A that imports B, B imports A
2. Step 2: Attempt to run the script
3. Step 3: Verify error 'Circular import detected: A -> B -> A'
4. Step 4: Verify import chain is shown for debugging
5. Step 5: Suggest how to resolve circular dependency

---

### ✅ K6 handles environment variable injection failures

Missing required environment variables should be caught

**How to use:**
Missing environment variables are caught with clear messages.

**Expected Behavior:**
1. Step 1: Create K6 script using __ENV.API_KEY
2. Step 2: Run without setting API_KEY environment variable
3. Step 3: Verify error 'Required environment variable not set: API_KEY'
4. Step 4: Verify list of required env vars from script
5. Step 5: Suggest using secrets management for sensitive values

---

### ✅ MCP handles invalid resource URI format

Malformed resource URIs should return helpful error

**How to use:**
Invalid resource URIs return 400 with format examples.

**Expected Behavior:**
1. Step 1: Request resource with invalid URI 'qaguardian://invalid//path'
2. Step 2: Verify error 'Invalid resource URI format'
3. Step 3: Verify correct URI format is shown in error
4. Step 4: Verify examples of valid URIs are provided
5. Step 5: Verify response code is 400

---

### ✅ K6 handles DNS resolution failures

DNS failures should be clearly distinguished from connection errors

**Expected Behavior:**
1. Step 1: Configure K6 test against 'nonexistent.invalid' domain
2. Step 2: Run load test
3. Step 3: Verify error shows 'DNS resolution failed'
4. Step 4: Verify this is categorized separately from connection errors
5. Step 5: Verify DNS lookup time metrics show N/A or error state

---

## 📋 Pending Features

### 📋 Visual regression handles corrupted baseline image

System should detect and report corrupted baseline images and offer recovery options

**Expected Behavior:**
1. Step 1: Simulate a corrupted baseline image in storage
2. Step 2: Trigger a visual comparison against the corrupted baseline
3. Step 3: Verify error message indicates 'Baseline image corrupted or unreadable'
4. Step 4: Verify option to re-capture baseline is offered
5. Step 5: Confirm system logs the corruption event for debugging

---

### 📋 Visual regression handles screenshot capture timeout

When page takes too long to render or stabilize, screenshot capture should timeout gracefully

**Expected Behavior:**
1. Step 1: Configure a test against a slow-loading page (>30s render)
2. Step 2: Set screenshot timeout to 10 seconds
3. Step 3: Run visual regression test
4. Step 4: Verify timeout error is captured with message 'Screenshot capture timed out'
5. Step 5: Verify partial results are preserved and test is marked as failed

---

### 📋 Visual regression handles page navigation errors

When target URL returns error (404, 500, etc.), visual test should report navigation failure

**Expected Behavior:**
1. Step 1: Configure visual test for a URL that returns 404
2. Step 2: Run the visual regression test
3. Step 3: Verify error shows 'Navigation failed: HTTP 404'
4. Step 4: Verify no screenshot comparison is attempted
5. Step 5: Confirm error includes the failed URL for debugging

---

### 📋 Visual regression handles dynamic content masking failures

When mask selector doesn't match any elements, system should warn but continue

**Expected Behavior:**
1. Step 1: Configure visual test with mask selector '.nonexistent-element'
2. Step 2: Run the visual regression test
3. Step 3: Verify warning message 'Mask selector matched 0 elements'
4. Step 4: Verify screenshot is still captured without masking
5. Step 5: Confirm test result includes the warning in metadata

---

### 📋 Visual regression handles storage quota exceeded

When MinIO/S3 storage is full, system should provide clear error and cleanup suggestions

**Expected Behavior:**
1. Step 1: Simulate storage quota being reached
2. Step 2: Attempt to save new baseline or screenshot
3. Step 3: Verify error message 'Storage quota exceeded'
4. Step 4: Verify suggestion to 'Clean up old baselines' is shown
5. Step 5: Confirm no data corruption occurs during failed save

---

### 📋 Visual regression handles concurrent baseline updates

When two users try to update the same baseline simultaneously, system should prevent conflicts

**Expected Behavior:**
1. Step 1: User A opens baseline approval dialog for screenshot X
2. Step 2: User B also opens baseline approval for same screenshot X
3. Step 3: User A approves new baseline
4. Step 4: User B attempts to approve (stale) new baseline
5. Step 5: Verify User B sees 'Baseline was modified by another user' error
6. Step 6: Verify User B is prompted to refresh before continuing

---

### 📋 Visual regression handles browser crash during capture

If Playwright browser crashes during screenshot, test should fail gracefully with retry option

**Expected Behavior:**
1. Step 1: Simulate browser crash during page render
2. Step 2: Verify test fails with 'Browser process terminated unexpectedly'
3. Step 3: Verify automatic retry is attempted (if configured)
4. Step 4: Verify crash dump is saved for debugging
5. Step 5: Confirm other tests in the suite continue execution

---

### 📋 Visual regression handles memory exhaustion on large pages

Full-page screenshots of very tall pages should have memory protection

**Expected Behavior:**
1. Step 1: Configure full-page screenshot for extremely long page (50000px height)
2. Step 2: Run visual regression test
3. Step 3: Verify system detects oversized capture
4. Step 4: Verify error message 'Page too large for full-page capture'
5. Step 5: Verify suggestion to use viewport-only capture

---

### 📋 Lighthouse handles unreachable URL

When target URL is unreachable, Lighthouse audit should fail with clear network error

**Expected Behavior:**
1. Step 1: Configure Lighthouse audit for unreachable URL
2. Step 2: Run performance audit
3. Step 3: Verify error shows 'Unable to connect to target URL'
4. Step 4: Verify DNS resolution vs connection timeout is distinguished
5. Step 5: Confirm no partial scores are shown for failed audit

---

### 📋 Lighthouse handles HTTPS certificate errors

Self-signed or expired SSL certificates should be reported clearly

**Expected Behavior:**
1. Step 1: Configure audit for URL with expired SSL certificate
2. Step 2: Run Lighthouse audit
3. Step 3: Verify error shows 'SSL certificate error: CERT_HAS_EXPIRED'
4. Step 4: Verify option to 'Ignore SSL errors' is available (with warning)
5. Step 5: Confirm security implications are explained in UI

---

### 📋 Lighthouse handles authentication-required pages

Pages behind login should prompt for authentication configuration

**Expected Behavior:**
1. Step 1: Configure audit for URL that redirects to login
2. Step 2: Run Lighthouse audit without authentication
3. Step 3: Verify warning 'Page appears to require authentication'
4. Step 4: Verify suggestion to configure authentication settings
5. Step 5: Confirm audit results reflect login page (not target page)

---

### 📋 Lighthouse handles audit timeout

Long-running audits should timeout with partial results

**Expected Behavior:**
1. Step 1: Configure audit for very slow page
2. Step 2: Set audit timeout to 60 seconds
3. Step 3: Run audit against page that takes 120 seconds to stabilize
4. Step 4: Verify timeout error after configured duration
5. Step 5: Verify any captured partial metrics are preserved

---

### 📋 Lighthouse handles Chrome crash during audit

Browser crashes during Lighthouse should be handled gracefully

**Expected Behavior:**
1. Step 1: Simulate Chrome crash during Lighthouse audit
2. Step 2: Verify error 'Lighthouse audit failed: Browser terminated'
3. Step 3: Verify automatic retry is attempted
4. Step 4: Verify crash is logged with stack trace
5. Step 5: Confirm other scheduled audits continue

---

### 📋 Lighthouse handles invalid page (non-HTML response)

Non-HTML responses (JSON, images) should be detected and reported

**Expected Behavior:**
1. Step 1: Configure audit for URL returning JSON API response
2. Step 2: Run Lighthouse audit
3. Step 3: Verify error 'Target is not an HTML page'
4. Step 4: Verify content type detected is shown
5. Step 5: Suggest using appropriate audit type for APIs

---

### 📋 K6 handles script syntax errors

Invalid K6 scripts should be validated before execution with clear error messages

**Expected Behavior:**
1. Step 1: Create K6 script with JavaScript syntax error
2. Step 2: Attempt to save and run the script
3. Step 3: Verify validation catches error before execution
4. Step 4: Verify error message shows line number and error type
5. Step 5: Verify script editor highlights the error location

---

### 📋 K6 handles script runtime errors

Runtime errors in K6 scripts should be captured with context

**Expected Behavior:**
1. Step 1: Create K6 script that throws runtime error (null reference)
2. Step 2: Run the load test
3. Step 3: Verify error is captured in results
4. Step 4: Verify stack trace shows script location
5. Step 5: Verify test is marked as failed with error count

---

### 📋 K6 handles target server unavailable

When target server is down, K6 should report connection failures clearly

**Expected Behavior:**
1. Step 1: Configure K6 test against unavailable server
2. Step 2: Run load test
3. Step 3: Verify results show high error rate
4. Step 4: Verify error breakdown shows 'Connection refused' or 'Host unreachable'
5. Step 5: Verify test completes (doesn't hang indefinitely)

---

### 📋 K6 handles resource exhaustion during test

When test runner runs out of memory/CPU, test should abort safely

**Expected Behavior:**
1. Step 1: Configure test with 10000 VUs on limited resources
2. Step 2: Start load test
3. Step 3: Verify system detects resource exhaustion
4. Step 4: Verify test aborts with 'Resource limit exceeded' message
5. Step 5: Verify partial results up to abort point are preserved

---

### 📋 K6 handles script import failures

Missing or invalid module imports should be caught and reported

**Expected Behavior:**
1. Step 1: Create K6 script importing non-existent module
2. Step 2: Attempt to run the script
3. Step 3: Verify error 'Module not found: ./missing-module.js'
4. Step 4: Verify available modules are suggested if similar name exists
5. Step 5: Confirm validation happens before test execution begins

---

### 📋 K6 handles invalid threshold configuration

Malformed thresholds should be validated with helpful messages

**Expected Behavior:**
1. Step 1: Configure threshold with invalid syntax (e.g., 'p(95) < abc')
2. Step 2: Attempt to save configuration
3. Step 3: Verify validation error 'Invalid threshold expression'
4. Step 4: Verify correct syntax examples are shown
5. Step 5: Prevent test execution until thresholds are valid

---

### 📋 axe-core handles JavaScript-disabled pages

Pages with JS disabled should still be scanned with appropriate warnings

**Expected Behavior:**
1. Step 1: Configure accessibility scan for page requiring JS
2. Step 2: Run scan with JavaScript disabled
3. Step 3: Verify warning 'Page may not render correctly without JavaScript'
4. Step 4: Verify scan completes on static HTML content
5. Step 5: Verify results indicate limited scan scope

---

### 📋 axe-core handles iframe accessibility errors

Cross-origin iframes that can't be scanned should be reported

**Expected Behavior:**
1. Step 1: Run accessibility scan on page with cross-origin iframe
2. Step 2: Verify warning 'Cannot scan cross-origin iframe: xyz.com'
3. Step 3: Verify main page results are still complete
4. Step 4: Verify iframe is listed as 'Not scanned - cross-origin'
5. Step 5: Suggest alternative (scan iframe URL directly)

---

### 📋 axe-core handles extremely large DOM

Very large pages should be scanned with performance warnings

**Expected Behavior:**
1. Step 1: Run accessibility scan on page with 50000+ DOM nodes
2. Step 2: Verify warning 'Large page detected - scan may take longer'
3. Step 3: Verify progress indicator during extended scan
4. Step 4: Verify timeout option is available
5. Step 5: Confirm results are complete after extended scan

---

### 📋 axe-core handles dynamic content loading

Pages with lazy-loaded content should allow wait configuration

**Expected Behavior:**
1. Step 1: Configure scan for page with infinite scroll
2. Step 2: Set 'wait for network idle' option
3. Step 3: Run accessibility scan
4. Step 4: Verify scan waits for dynamic content
5. Step 5: Verify results include dynamically loaded elements

---

### 📋 MCP handles server shutdown gracefully

During server restart, active connections should be notified

**Expected Behavior:**
1. Step 1: Establish MCP connection
2. Step 2: Initiate server graceful shutdown
3. Step 3: Verify client receives 'server-shutdown' event
4. Step 4: Verify in-progress operations complete or abort cleanly
5. Step 5: Verify reconnection works after server restarts

---

### 📋 Visual regression handles locale/timezone differences

Date/time displayed differently should be maskable

**Expected Behavior:**
1. Step 1: Run visual test from US-East timezone
2. Step 2: Create baseline with 'January 13, 2026' displayed
3. Step 3: Run comparison from UK timezone showing '13 January 2026'
4. Step 4: Verify date region is flagged as changed
5. Step 5: Verify option to mask datetime regions globally

---

### 📋 Lighthouse handles mixed content warnings

HTTPS pages loading HTTP resources should be flagged

**Expected Behavior:**
1. Step 1: Run Lighthouse on HTTPS page with HTTP image
2. Step 2: Verify mixed content warning is shown
3. Step 3: Verify list of HTTP resources is provided
4. Step 4: Verify this affects security score appropriately
5. Step 5: Provide remediation guidance for mixed content

---

### 📋 Visual regression handles anti-aliasing differences across browsers

Font rendering differences should use perceptual diff

**Expected Behavior:**
1. Step 1: Create baseline in Chrome
2. Step 2: Run comparison in Firefox (different font rendering)
3. Step 3: Verify perceptual diff ignores anti-aliasing differences
4. Step 4: Verify truly different content is still detected
5. Step 5: Verify diff threshold is configurable for edge cases

---

