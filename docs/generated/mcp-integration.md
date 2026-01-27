# MCP Integration

> 47 features | 41 completed | 6 pending

[← Back to Index](../README.md)

---

## ✅ Completed Features

### ✅ MCP server supports stdio transport

Server can communicate via stdin/stdout for local use

**How to use:**
Connect AI agents via stdio transport for local integrations.

**Expected Behavior:**
1. Step 1: Configure MCP with transport: stdio
2. Step 2: Start server
3. Step 3: Verify server reads from stdin
4. Step 4: Verify server writes to stdout
5. Step 5: Compatible with Claude Code integration

**API Reference:**
```
Transport: stdio (stdin/stdout)
```

---

### ✅ MCP server supports SSE transport

Server can communicate via Server-Sent Events for remote use

**How to use:**
Connect AI agents via SSE for remote/web-based integrations.

**Expected Behavior:**
1. Step 1: Configure MCP with transport: sse
2. Step 2: Start server on port 3000
3. Step 3: Connect from remote client
4. Step 4: Verify SSE connection established
5. Step 5: Events streamed successfully

**API Reference:**
```
Transport: SSE (Server-Sent Events)
```

---

### ✅ MCP server configurable via config file

Server can read configuration from JSON config file

**How to use:**
Configure MCP by providing a JSON configuration file.

**Expected Behavior:**
1. Step 1: Create mcp-config.json with apiKey and apiUrl
2. Step 2: Start server with --config flag
3. Step 3: Verify server uses config file values

---

### ✅ MCP rate limiting enforced

MCP connections subject to rate limits per API key

**How to use:**
MCP requests are rate limited. Check response headers for limits.

**Expected Behavior:**
1. Step 1: Connect to MCP
2. Step 2: Make 100 rapid tool calls
3. Step 3: Verify rate limit error returned
4. Step 4: Wait 1 minute
5. Step 5: Verify calls succeed again

**API Reference:**
```
Headers: X-RateLimit-Limit, X-RateLimit-Remaining
```

---

### ✅ MCP tool: trigger-test-run executes tests

AI agent can start test suite execution via MCP tool

**How to use:**
AI agents can trigger test runs using the trigger-test-run tool.

**Expected Behavior:**
1. Step 1: Connect to MCP server
2. Step 2: Call trigger-test-run with {suiteId: 'xyz'}
3. Step 3: Verify response includes runId
4. Step 4: Test run starts executing
5. Step 5: Can track via returned runId

**API Reference:**
```
Tool: trigger-test-run { suiteId: string }
```

---

### ✅ MCP tool: trigger-test-run accepts options

Tool accepts environment, branch, and other options

**How to use:**
Specify browsers, environment, and other options when triggering.

**Expected Behavior:**
1. Step 1: Call trigger-test-run with {suiteId, branch: 'main', env: 'staging'}
2. Step 2: Verify test runs against staging environment
3. Step 3: Verify branch parameter respected

**API Reference:**
```
Tool: trigger-test-run { suiteId, browsers?, environment? }
```

---

### ✅ MCP tool: cancel-test-run stops execution

AI agent can cancel running test via MCP

**How to use:**
Stop a running test using the cancel-test-run tool.

**Expected Behavior:**
1. Step 1: Trigger a test run
2. Step 2: While running, call cancel-test-run with runId
3. Step 3: Verify test stops
4. Step 4: Response confirms cancellation

**API Reference:**
```
Tool: cancel-test-run { runId: string }
```

---

### ✅ MCP tool: get-run-status returns current status

AI agent can check test run status

**How to use:**
Check the current status of any test run.

**Expected Behavior:**
1. Step 1: Trigger test run
2. Step 2: Call get-run-status with runId
3. Step 3: Verify status: 'running'
4. Step 4: Wait for completion
5. Step 5: Call again - verify status: 'completed'

**API Reference:**
```
Tool: get-run-status { runId: string }
```

---

### ✅ MCP tool: get-run-status includes progress

Status includes test progress (completed/total)

**How to use:**
Status includes progress percentage and current step.

**Expected Behavior:**
1. Step 1: Trigger test suite with 10 tests
2. Step 2: Call get-run-status during execution
3. Step 3: Verify response includes progress: {completed: 4, total: 10}
4. Step 4: Progress updates as tests complete

**API Reference:**
```
Returns: { status, progress, currentStep }
```

---

### ✅ MCP tool: list-test-suites returns suite list

AI agent can list available test suites

**How to use:**
List all test suites in a project.

**Expected Behavior:**
1. Step 1: Call list-test-suites with {projectId: 'abc'}
2. Step 2: Verify array of suites returned
3. Step 3: Each suite has id, name, type
4. Step 4: Pagination supported for large lists

**API Reference:**
```
Tool: list-test-suites { projectId: string }
```

---

### ✅ MCP tool: list-test-suites supports filtering

Tool supports filtering by type, name

**How to use:**
Filter suites by name or status.

**Expected Behavior:**
1. Step 1: Call list-test-suites with {type: 'e2e'}
2. Step 2: Verify only E2E suites returned
3. Step 3: Call with {name: 'checkout'}
4. Step 4: Verify filtered by name pattern

**API Reference:**
```
Tool: list-test-suites { projectId, filter? }
```

---

### ✅ MCP tool: get-test-config returns configuration

AI agent can retrieve test suite configuration

**How to use:**
Get the full configuration of a test.

**Expected Behavior:**
1. Step 1: Call get-test-config with suiteId
2. Step 2: Verify configuration object returned
3. Step 3: Includes browsers, timeout, retries
4. Step 4: Includes base URL and other settings

**API Reference:**
```
Tool: get-test-config { testId: string }
```

---

### ✅ MCP tool: get-test-results returns detailed results

AI agent can retrieve test run results

**How to use:**
Get detailed results including step-by-step outcomes.

**Expected Behavior:**
1. Step 1: Complete a test run
2. Step 2: Call get-test-results with runId
3. Step 3: Verify results array returned
4. Step 4: Each result has testName, status, duration
5. Step 5: Failed tests include error message

**API Reference:**
```
Tool: get-test-results { runId: string }
```

---

### ✅ MCP tool: get-test-results includes pass/fail summary

Results include aggregate summary

**How to use:**
Results include pass/fail counts and summary.

**Expected Behavior:**
1. Step 1: Call get-test-results
2. Step 2: Verify summary object in response
3. Step 3: Summary has passed, failed, skipped counts
4. Step 4: Total duration included

**API Reference:**
```
Returns: { passed, failed, total, tests[] }
```

---

### ✅ MCP tool: get-test-artifacts includes videos

Video recordings available in artifacts

**How to use:**
Video recordings of test execution are available.

**Expected Behavior:**
1. Step 1: Run test with video recording
2. Step 2: Call get-test-artifacts
3. Step 3: Verify video artifact present
4. Step 4: Type is 'video', URL playable

**API Reference:**
```
Returns: { videos: [{ url, testId }] }
```

---

### ✅ MCP tool: get-test-artifacts includes traces

Playwright traces available in artifacts

**How to use:**
Playwright trace files for detailed debugging.

**Expected Behavior:**
1. Step 1: Run test with tracing enabled
2. Step 2: Call get-test-artifacts
3. Step 3: Verify trace artifact present
4. Step 4: Type is 'trace', URL downloadable

**API Reference:**
```
Returns: { traces: [{ url, testId }] }
```

---

### ✅ MCP tool: get-test-artifacts returns artifact URLs

AI agent can retrieve artifact download URLs

**How to use:**
Get URLs to screenshots, videos, and trace files.

**Expected Behavior:**
1. Step 1: Call get-test-artifacts with resultId
2. Step 2: Verify artifacts array returned
3. Step 3: Each artifact has type, name, url
4. Step 4: URLs are valid download links

**API Reference:**
```
Tool: get-test-artifacts { runId: string }
```

---

### ✅ MCP resource: qaguardian://projects accessible

AI agent can access project list via resource protocol

**How to use:**
List all projects via MCP resource.

**Expected Behavior:**
1. Step 1: Request resource qaguardian://projects
2. Step 2: Verify project list returned
3. Step 3: Each project has id, name, slug
4. Step 4: Resource cacheable

**API Reference:**
```
Resource: qaguardian://projects
```

---

### ✅ MCP resource: qaguardian://test-runs/{id} accessible

AI agent can access test run details via resource

**How to use:**
Get test run details.

**Expected Behavior:**
1. Step 1: Request qaguardian://test-runs/xyz789
2. Step 2: Verify test run data returned
3. Step 3: Includes status, summary, timestamps
4. Step 4: 404 for non-existent run

**API Reference:**
```
Resource: qaguardian://test-runs/{id}
```

---

### ✅ MCP resource: qaguardian://test-runs/{id}/results accessible

AI agent can access test results via resource

**How to use:**
Get test run results.

**Expected Behavior:**
1. Step 1: Request qaguardian://test-runs/xyz/results
2. Step 2: Verify results array returned
3. Step 3: Same data as get-test-results tool

**API Reference:**
```
Resource: qaguardian://test-runs/{id}/results
```

---

### ✅ MCP resource: qaguardian://projects/{id} accessible

AI agent can access specific project details

**How to use:**
Get a specific project by ID.

**Expected Behavior:**
1. Step 1: Request qaguardian://projects/abc123
2. Step 2: Verify project details returned
3. Step 3: Includes settings, suites count, etc.
4. Step 4: 404 for non-existent project

**API Reference:**
```
Resource: qaguardian://projects/{id}
```

---

### ✅ MCP resource: qaguardian://test-runs/{id}/artifacts accessible

AI agent can access artifacts via resource

**How to use:**
Get test run artifacts.

**Expected Behavior:**
1. Step 1: Request qaguardian://test-runs/xyz/artifacts
2. Step 2: Verify artifacts list returned
3. Step 3: Includes all artifact types

**API Reference:**
```
Resource: qaguardian://test-runs/{id}/artifacts
```

---

### ✅ MCP returns helpful error messages

Errors include actionable information

**How to use:**
MCP returns clear error messages when something goes wrong.

**Expected Behavior:**
1. Step 1: Call tool with invalid suiteId
2. Step 2: Verify error response
3. Step 3: Error message explains issue
4. Step 4: Includes suggestion for fix

---

### ✅ MCP tool: list-projects returns all projects

AI agent can list all accessible projects

**How to use:**
List all projects accessible to the API key.

**Expected Behavior:**
1. Step 1: Call list-projects
2. Step 2: Verify array of projects returned
3. Step 3: Each has id, name, description
4. Step 4: Only projects user has access to

**API Reference:**
```
Tool: list-projects {}
```

---

### ✅ MCP server graceful shutdown

Server shuts down cleanly on SIGTERM

**How to use:**
The MCP server shuts down gracefully, completing active requests.

**Expected Behavior:**
1. Step 1: Start MCP server
2. Step 2: Send SIGTERM signal
3. Step 3: Verify server shuts down gracefully
4. Step 4: Active connections closed cleanly

---

### ✅ MCP server logs connection events

Server logs when clients connect/disconnect

**How to use:**
Connection events are logged for debugging.

**Expected Behavior:**
1. Step 1: Start server with logging enabled
2. Step 2: Connect AI agent
3. Step 3: Verify 'client connected' log entry
4. Step 4: Disconnect agent
5. Step 5: Verify 'client disconnected' log entry

---

### ✅ MCP server logs tool invocations

Server logs each tool call for debugging

**How to use:**
All tool invocations are logged for audit trails.

**Expected Behavior:**
1. Step 1: Enable debug logging
2. Step 2: Call trigger-test-run tool
3. Step 3: Verify log shows tool name and params
4. Step 4: Log shows response time

---

### ✅ MCP handles concurrent requests

Server handles multiple simultaneous tool calls

**How to use:**
MCP handles multiple concurrent requests from AI agents.

**Expected Behavior:**
1. Step 1: Send 5 tool calls simultaneously
2. Step 2: Verify all 5 responses returned
3. Step 3: No errors or timeouts
4. Step 4: Results are correct

---

### ✅ MCP tool trigger-test-run starts test execution

AI agent can start test suite via MCP tool call

**How to use:**
trigger-test-run tool starts test execution.

**Expected Behavior:**
1. Step 1: Connect to MCP
2. Step 2: Call trigger-test-run with suiteId parameter
3. Step 3: Verify response includes runId
4. Step 4: Test execution starts in system
5. Step 5: Can track progress via returned runId

**API Reference:**
```
Tool: trigger-test-run
```

---

### ✅ MCP tool get-run-status returns current status

AI agent can check test run status via MCP

**How to use:**
get-run-status tool returns current test status.

**Expected Behavior:**
1. Step 1: Trigger a test run via MCP
2. Step 2: Call get-run-status with runId
3. Step 3: Verify status returned (pending/running/completed/failed)
4. Step 4: Call again when finished - status shows completed

**API Reference:**
```
Tool: get-run-status
```

---

### ✅ MCP tool get-run-status includes progress info

Status includes test progress (completed/total)

**How to use:**
Status includes progress percentage and details.

**Expected Behavior:**
1. Step 1: Trigger test suite with 10 tests
2. Step 2: Call get-run-status during execution
3. Step 3: Verify progress object in response
4. Step 4: Shows completed: 4, total: 10 for example

---

### ✅ MCP tool cancel-test-run stops execution

AI agent can cancel running test via MCP

**How to use:**
cancel-test-run tool stops test execution.

**Expected Behavior:**
1. Step 1: Trigger test run
2. Step 2: While running, call cancel-test-run with runId
3. Step 3: Verify confirmation response
4. Step 4: Test execution stops
5. Step 5: Status shows cancelled

**API Reference:**
```
Tool: cancel-test-run
```

---

### ✅ MCP tool list-test-suites returns available suites

AI agent can list test suites in a project

**How to use:**
list-test-suites tool returns available suites.

**Expected Behavior:**
1. Step 1: Call list-test-suites with projectId
2. Step 2: Verify array of suites returned
3. Step 3: Each suite has id, name, type properties
4. Step 4: Pagination supported for large lists

**API Reference:**
```
Tool: list-test-suites
```

---

### ✅ MCP tool get-test-results returns detailed results

AI agent can retrieve test run results via MCP

**How to use:**
get-test-results tool returns detailed results.

**Expected Behavior:**
1. Step 1: Complete a test run
2. Step 2: Call get-test-results with runId
3. Step 3: Verify results array returned
4. Step 4: Each result has testName, status, duration, error if failed

**API Reference:**
```
Tool: get-test-results
```

---

### ✅ MCP tool get-test-artifacts returns artifact URLs

AI agent can retrieve artifact download URLs

**How to use:**
get-test-artifacts tool returns artifact URLs.

**Expected Behavior:**
1. Step 1: Call get-test-artifacts with resultId
2. Step 2: Verify artifacts array returned
3. Step 3: Each artifact has type, name, downloadUrl
4. Step 4: URLs are accessible for download

**API Reference:**
```
Tool: get-test-artifacts
```

---

### ✅ MCP tool list-projects returns accessible projects

AI agent can list all projects they have access to

**How to use:**
list-projects tool returns all accessible projects.

**Expected Behavior:**
1. Step 1: Call list-projects tool
2. Step 2: Verify array of projects returned
3. Step 3: Each project has id, name, description
4. Step 4: Only shows projects user has permission for

**API Reference:**
```
Tool: list-projects
```

---

### ✅ MCP resource qaguardian://projects is accessible

AI agent can access project list via resource protocol

**How to use:**
Access projects via qaguardian://projects resource.

**Expected Behavior:**
1. Step 1: Request resource qaguardian://projects
2. Step 2: Verify project list data returned
3. Step 3: Same data as list-projects tool

---

### ✅ MCP resource qaguardian://test-runs/{id} is accessible

AI agent can access test run details via resource

**How to use:**
Access test run details via qaguardian://test-runs/{id}.

**Expected Behavior:**
1. Step 1: Request qaguardian://test-runs/abc123
2. Step 2: Verify test run details returned
3. Step 3: Includes status, summary, timestamps
4. Step 4: Returns 404 for non-existent run

---

### ✅ MCP returns clear error messages

Errors from MCP include helpful descriptions

**How to use:**
MCP returns clear, helpful error messages.

**Expected Behavior:**
1. Step 1: Call tool with invalid suiteId
2. Step 2: Verify error response returned
3. Step 3: Error message explains the issue
4. Step 4: Includes suggestion for resolution

---

### ✅ MCP handles malformed requests gracefully

Invalid requests return proper error, not crash

**How to use:**
Malformed requests are handled gracefully with error details.

**Expected Behavior:**
1. Step 1: Send malformed tool call (missing params)
2. Step 2: Verify error response (not crash)
3. Step 3: Error indicates what was wrong
4. Step 4: Server continues operating

---

### ✅ MCP rate limiting returns 429 when exceeded

Exceeding rate limit returns proper error code

**How to use:**
Rate limited requests return 429 status code.

**Expected Behavior:**
1. Step 1: Make rapid tool calls to exceed limit
2. Step 2: Verify rate limit error returned
3. Step 3: Error includes retry-after information
4. Step 4: Wait and retry - succeeds

---

## 📋 Pending Features

### 📋 Install MCP server via npx

MCP server package installable and runnable via npx

**Expected Behavior:**
1. Step 1: Run: npx @qa-guardian/mcp-server
2. Step 2: Verify package downloads and installs
3. Step 3: Server starts successfully
4. Step 4: Ready message displayed with connection info

---

### 📋 Install MCP server via npm global

MCP server can be installed globally via npm

**Expected Behavior:**
1. Step 1: Run: npm install -g @qa-guardian/mcp-server
2. Step 2: Verify package installs
3. Step 3: Run: qa-guardian-mcp
4. Step 4: Server starts successfully

---

### 📋 MCP connection status visible in dashboard

Dashboard shows active MCP connections

**Expected Behavior:**
1. Step 1: Connect AI agent via MCP
2. Step 2: Navigate to admin dashboard
3. Step 3: Find MCP connections section
4. Step 4: Verify connection listed
5. Step 5: Shows API key name, connected time

---

### 📋 MCP tool usage tracked in analytics

System tracks MCP tool call counts

**Expected Behavior:**
1. Step 1: Make MCP tool calls
2. Step 2: Navigate to usage analytics
3. Step 3: Find MCP usage section
4. Step 4: Verify tool call counts displayed
5. Step 5: Breakdown by tool type available

---

### 📋 MCP server starts with npx command

Running npx @qa-guardian/mcp-server starts the server

**Expected Behavior:**
1. Step 1: Open terminal
2. Step 2: Run: npx @qa-guardian/mcp-server
3. Step 3: Verify package downloads if needed
4. Step 4: Verify server starts
5. Step 5: Ready message displayed

---

### 📋 MCP connection visible in admin dashboard

Active MCP connections shown in admin area

**Expected Behavior:**
1. Step 1: Connect AI agent via MCP
2. Step 2: Navigate to admin dashboard
3. Step 3: Find MCP connections section
4. Step 4: Verify connection listed
5. Step 5: Shows API key name, connected time

---

