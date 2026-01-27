# Load Testing

> 49 features | 39 completed | 10 pending

[← Back to Index](../README.md)

---

## ✅ Completed Features

### ✅ Create K6 load test from UI

User can create new K6 load test with name and description

**How to use:**
Create a new K6 load test by entering a name and description.

**Expected Behavior:**
1. Step 1: Navigate to load testing section
2. Step 2: Click 'Create Load Test'
3. Step 3: Enter test name and description
4. Step 4: Click create
5. Step 5: Verify test created and editor opens

---

### ✅ K6 script editor displays

Full code editor for K6 scripts with editing capabilities

**How to use:**
Write K6 test scripts in the built-in code editor.

**Expected Behavior:**
1. Step 1: Open K6 load test
2. Step 2: Verify code editor displayed
3. Step 3: Can type and edit JavaScript code
4. Step 4: Editor fills available space

---

### ✅ K6 editor has JavaScript syntax highlighting

Code editor highlights JavaScript syntax appropriately

**How to use:**
JavaScript syntax is highlighted for easier script editing.

**Expected Behavior:**
1. Step 1: Open K6 script editor
2. Step 2: Write JavaScript code
3. Step 3: Verify keywords highlighted (import, export, function)
4. Step 4: Strings in different color
5. Step 5: Comments grayed out

---

### ✅ K6 editor shows line numbers

Editor displays line numbers in gutter

**How to use:**
Line numbers help you navigate and debug your K6 scripts.

**Expected Behavior:**
1. Step 1: Open K6 script editor
2. Step 2: Verify line numbers shown on left
3. Step 3: Numbers update as lines added/removed

---

### ✅ K6 load test template available

Pre-built template for standard load test scenario

**How to use:**
Start with a pre-built load test template for common scenarios.

**Expected Behavior:**
1. Step 1: Create new K6 test
2. Step 2: Click 'Use Template'
3. Step 3: Select 'Load Test' template
4. Step 4: Verify template code populated
5. Step 5: Template includes basic VU ramp-up pattern

---

### ✅ K6 stress test template available

Pre-built template for stress testing to breaking point

**How to use:**
Use the stress test template to find your systems breaking point.

**Expected Behavior:**
1. Step 1: Create new K6 test
2. Step 2: Select 'Stress Test' template
3. Step 3: Verify template with aggressive VU scaling
4. Step 4: Template ramps to high VU count

---

### ✅ K6 spike test template available

Pre-built template for sudden traffic spike testing

**How to use:**
Use the spike test template to simulate sudden traffic surges.

**Expected Behavior:**
1. Step 1: Create new K6 test
2. Step 2: Select 'Spike Test' template
3. Step 3: Verify template with sudden VU jump
4. Step 4: Template includes quick ramp up and down

---

### ✅ K6 soak test template available

Pre-built template for long-duration stability testing

**How to use:**
Use the soak test template for long-duration stability testing.

**Expected Behavior:**
1. Step 1: Create new K6 test
2. Step 2: Select 'Soak Test' template
3. Step 3: Verify template with extended duration
4. Step 4: Template configured for hours-long run

---

### ✅ Configure K6 virtual users count

User can set number of virtual users in test options

**How to use:**
Set the number of virtual users (VUs) to simulate concurrent load.

**Expected Behavior:**
1. Step 1: Edit K6 test configuration
2. Step 2: Set 'Virtual Users' to 100
3. Step 3: Save configuration
4. Step 4: Run test
5. Step 5: Verify 100 concurrent VUs active

---

### ✅ Configure K6 test duration

User can set how long test runs

**How to use:**
Configure how long the test should run (e.g., 5m, 1h).

**Expected Behavior:**
1. Step 1: Edit K6 test configuration
2. Step 2: Set 'Duration' to 10 minutes
3. Step 3: Run test
4. Step 4: Verify test runs for 10 minutes
5. Step 5: Test ends automatically after duration

---

### ✅ Configure K6 ramp-up stages

User can define multiple stages with VU targets and durations

**How to use:**
Define ramp-up stages to gradually increase load over time.

**Expected Behavior:**
1. Step 1: Edit K6 test
2. Step 2: Add stage: 50 VUs over 2 minutes
3. Step 3: Add stage: 100 VUs over 5 minutes
4. Step 4: Add stage: 0 VUs over 2 minutes (ramp down)
5. Step 5: Run test and verify stages execute in order

---

### ✅ Run K6 load test

User can execute K6 test from UI

**How to use:**
Click "Run Test" to start executing your K6 load test.

**Expected Behavior:**
1. Step 1: Open K6 test
2. Step 2: Click 'Run Test' button
3. Step 3: Verify test starts executing
4. Step 4: Progress indicator shows test running

---

### ✅ Real-time VU count during K6 execution

Dashboard shows current virtual user count while test runs

**How to use:**
Watch the current virtual user count update in real-time.

**Expected Behavior:**
1. Step 1: Start K6 test with ramp-up
2. Step 2: View real-time metrics
3. Step 3: Verify VU count updates as users ramp up
4. Step 4: Count reflects current active VUs

---

### ✅ Real-time RPS during K6 execution

Dashboard shows requests per second in real-time

**How to use:**
Monitor requests per second (RPS) as the test runs.

**Expected Behavior:**
1. Step 1: Start K6 test
2. Step 2: View real-time metrics
3. Step 3: Verify RPS counter updating
4. Step 4: RPS chart shows throughput over time

---

### ✅ Real-time latency during K6 execution

Dashboard shows response time metrics in real-time

**How to use:**
See response times update live during test execution.

**Expected Behavior:**
1. Step 1: Start K6 test
2. Step 2: View real-time metrics
3. Step 3: Verify p50, p95 latency updating
4. Step 4: Latency chart updates every few seconds

---

### ✅ Real-time error rate during K6 execution

Dashboard shows error percentage in real-time

**How to use:**
Track error rates in real-time to catch issues immediately.

**Expected Behavior:**
1. Step 1: Start K6 test
2. Step 2: View real-time metrics
3. Step 3: Verify error rate % displayed
4. Step 4: Rate updates as errors occur

---

### ✅ K6 results show p50 latency

Final results include 50th percentile response time

**How to use:**
p50 latency shows the median response time (50% of requests were faster).

**Expected Behavior:**
1. Step 1: Complete K6 test
2. Step 2: View results summary
3. Step 3: Find p50 (median) latency value
4. Step 4: Value shown in milliseconds

---

### ✅ K6 results show p90 latency

Final results include 90th percentile response time

**How to use:**
p90 latency shows 90th percentile - 90% of requests were faster than this.

**Expected Behavior:**
1. Step 1: Complete K6 test
2. Step 2: View results summary
3. Step 3: Find p90 latency value
4. Step 4: Value shown in milliseconds

---

### ✅ K6 results show p95 latency

Final results include 95th percentile response time

**How to use:**
p95 latency shows 95th percentile response time.

**Expected Behavior:**
1. Step 1: Complete K6 test
2. Step 2: View results summary
3. Step 3: Find p95 latency value
4. Step 4: Value higher than p90

---

### ✅ K6 results show p99 latency

Final results include 99th percentile response time

**How to use:**
p99 latency shows the slowest 1% of requests.

**Expected Behavior:**
1. Step 1: Complete K6 test
2. Step 2: View results summary
3. Step 3: Find p99 latency value
4. Step 4: Value represents worst-case latency

---

### ✅ K6 results show total requests

Final results show total number of HTTP requests made

**How to use:**
Total requests shows how many HTTP requests were made during the test.

**Expected Behavior:**
1. Step 1: Complete K6 test
2. Step 2: View results summary
3. Step 3: Find total requests count
4. Step 4: Verify reasonable count based on duration and VUs

---

### ✅ K6 results show average RPS

Final results show average requests per second

**How to use:**
Average RPS shows the overall throughput achieved.

**Expected Behavior:**
1. Step 1: Complete K6 test
2. Step 2: View results summary
3. Step 3: Find average RPS metric
4. Step 4: Value consistent with total requests / duration

---

### ✅ K6 results show error count and rate

Final results show number and percentage of failed requests

**How to use:**
Error count and rate show how many requests failed.

**Expected Behavior:**
1. Step 1: Complete K6 test with some failures
2. Step 2: View results summary
3. Step 3: Find error count (e.g., 150 errors)
4. Step 4: Find error rate percentage (e.g., 1.5%)

---

### ✅ K6 results show data transferred

Final results show total data sent and received

**How to use:**
Data transferred shows total bytes sent and received.

**Expected Behavior:**
1. Step 1: Complete K6 test
2. Step 2: View results summary
3. Step 3: Find data received (e.g., 1.5 GB)
4. Step 4: Find data sent (e.g., 50 MB)

---

### ✅ K6 threshold evaluation

Test passes/fails based on configured K6 thresholds

**How to use:**
Thresholds determine pass/fail - set limits for latency, error rate, etc.

**Expected Behavior:**
1. Step 1: Configure threshold: http_req_duration p(95) < 500
2. Step 2: Run test where p95 is 400ms
3. Step 3: Verify test passes
4. Step 4: Run test where p95 is 600ms
5. Step 5: Verify test fails

---

### ✅ Schedule K6 test to run periodically

User can schedule K6 test to run on cron schedule

**How to use:**
Schedule load tests to run automatically on a recurring basis.

**Expected Behavior:**
1. Step 1: Open K6 test
2. Step 2: Click 'Schedule'
3. Step 3: Set schedule: 'Every night at 2 AM'
4. Step 4: Save schedule
5. Step 5: Verify test runs automatically at 2 AM

---

### ✅ Cancel running K6 test

User can stop a K6 test in progress

**How to use:**
Click "Cancel" to stop a running K6 test.

**Expected Behavior:**
1. Step 1: Start K6 test
2. Step 2: While running, click 'Cancel' button
3. Step 3: Verify test stops
4. Step 4: Partial results saved
5. Step 5: Status shows 'Cancelled'

---

### ✅ K6 test history viewable

User can view list of all past K6 test runs

**How to use:**
View the history of all K6 test runs and their results.

**Expected Behavior:**
1. Step 1: Open K6 test
2. Step 2: Click 'Run History' tab
3. Step 3: View list of past executions
4. Step 4: Each shows date, duration, pass/fail
5. Step 5: Click to view detailed results

---

### ✅ K6 load test type available in test creation

When creating test, 'Load Test (K6)' is an available type

**How to use:**
K6 Load Test is available as a test type when creating new tests.

**Expected Behavior:**
1. Step 1: Click Create Test
2. Step 2: View test type options
3. Step 3: Verify 'Load Test' or 'K6' option exists
4. Step 4: Option has load/performance icon

---

### ✅ K6 templates dropdown available

User can select from pre-built K6 templates

**How to use:**
Choose from pre-built K6 templates in the dropdown.

**Expected Behavior:**
1. Step 1: Create or edit K6 test
2. Step 2: Find 'Templates' or 'Use Template' button
3. Step 3: Click to open template selection
4. Step 4: Verify multiple templates available

---

### ✅ Load test template provides basic ramp pattern

Load test template has gradual VU ramp-up and ramp-down

**How to use:**
Load test template provides a standard ramp-up pattern.

**Expected Behavior:**
1. Step 1: Select 'Load Test' template
2. Step 2: Verify template code populated
3. Step 3: Template includes stages array
4. Step 4: Stages ramp up to target VUs, hold, ramp down

---

### ✅ Stress test template provides aggressive scaling

Stress test template ramps VUs aggressively to find limits

**How to use:**
Stress test template scales aggressively to find limits.

**Expected Behavior:**
1. Step 1: Select 'Stress Test' template
2. Step 2: Verify template code populated
3. Step 3: Template has aggressive VU ramp-up stages
4. Step 4: May include very high VU targets

---

### ✅ Spike test template provides sudden surge

Spike test template has sudden VU jump

**How to use:**
Spike test template simulates sudden traffic surges.

**Expected Behavior:**
1. Step 1: Select 'Spike Test' template
2. Step 2: Verify template code populated
3. Step 3: Template has short ramp to normal, instant spike, return
4. Step 4: Tests system recovery from traffic spike

---

### ✅ Soak test template provides long duration

Soak test template runs for extended period

**How to use:**
Soak test template runs for extended duration.

**Expected Behavior:**
1. Step 1: Select 'Soak Test' template
2. Step 2: Verify template code populated
3. Step 3: Template has hours-long duration
4. Step 4: Moderate VU count sustained

---

### ✅ Run K6 test starts execution

Clicking Run starts K6 test execution

**How to use:**
Click Run to start executing your K6 test.

**Expected Behavior:**
1. Step 1: Open K6 test with valid script
2. Step 2: Click Run Test
3. Step 3: Verify test starts
4. Step 4: Status changes to 'Running'
5. Step 5: Progress indicator visible

---

### ✅ Real-time RPS displayed during run

While running, requests per second shown in real-time

**How to use:**
Requests per second updates in real-time.

**Expected Behavior:**
1. Step 1: Start K6 test
2. Step 2: View real-time dashboard
3. Step 3: Verify RPS metric displayed
4. Step 4: Value updates every few seconds
5. Step 5: RPS chart shows throughput over time

---

### ✅ K6 results show total requests count

Final results show total number of HTTP requests made

**How to use:**
Total request count shown in final results.

**Expected Behavior:**
1. Step 1: View K6 results
2. Step 2: Find total requests metric
3. Step 3: Shows count (e.g., 125,000 requests)

---

### ✅ K6 thresholds evaluated for pass/fail

Test passes or fails based on configured K6 thresholds

**How to use:**
K6 thresholds determine pass/fail status.

**Expected Behavior:**
1. Step 1: Configure script with threshold: p(95)<500
2. Step 2: Run test where p95 is 400ms
3. Step 3: Verify test passes
4. Step 4: Run where p95 is 600ms
5. Step 5: Verify test fails

---

### ✅ K6 run history shows past executions

User can view list of all past K6 test runs

**How to use:**
View history of all past K6 test runs.

**Expected Behavior:**
1. Step 1: Open K6 test
2. Step 2: Navigate to Run History tab
3. Step 3: Verify list of past runs
4. Step 4: Each shows date, status, duration
5. Step 5: Click to view details

---

## 📋 Pending Features

### 📋 K6 editor supports code folding

User can collapse/expand code blocks

**Expected Behavior:**
1. Step 1: Write K6 script with function blocks
2. Step 2: Click fold icon next to function
3. Step 3: Verify block collapses
4. Step 4: Click again to expand

---

### 📋 K6 custom metrics tracked

Custom Counter/Trend/Gauge metrics in script are captured

**Expected Behavior:**
1. Step 1: Add custom metric to K6 script: new Counter('my_counter')
2. Step 2: Increment counter in test code
3. Step 3: Run test
4. Step 4: Verify 'my_counter' appears in results
5. Step 5: Custom metric value displayed

---

### 📋 Compare K6 test runs

User can compare metrics between two K6 executions

**Expected Behavior:**
1. Step 1: Run K6 test twice (before/after change)
2. Step 2: Select both runs
3. Step 3: Click 'Compare'
4. Step 4: View side-by-side metrics
5. Step 5: Deltas highlighted (faster/slower)

---

### 📋 K6 test creation shows code editor

Creating K6 test opens code editor for script

**Expected Behavior:**
1. Step 1: Select K6/Load Test type
2. Step 2: Enter test name
3. Step 3: Verify code editor panel is displayed
4. Step 4: Editor has default template or empty state

---

### 📋 K6 results show p50 response time

Final results include median (50th percentile) response time

**Expected Behavior:**
1. Step 1: Complete K6 test
2. Step 2: View results summary
3. Step 3: Find p50 latency metric
4. Step 4: Value shown in milliseconds

---

### 📋 K6 results show p90 response time

Final results include 90th percentile response time

**Expected Behavior:**
1. Step 1: View K6 results
2. Step 2: Find p90 latency
3. Step 3: Value is higher than p50

---

### 📋 K6 results show p95 response time

Final results include 95th percentile response time

**Expected Behavior:**
1. Step 1: View K6 results
2. Step 2: Find p95 latency
3. Step 3: Value shown in milliseconds

---

### 📋 K6 results show p99 response time

Final results include 99th percentile (worst case) response time

**Expected Behavior:**
1. Step 1: View K6 results
2. Step 2: Find p99 latency
3. Step 3: Represents tail latency

---

### 📋 K6 results show peak RPS

Final results show maximum RPS achieved

**Expected Behavior:**
1. Step 1: View K6 results
2. Step 2: Find peak/max RPS metric
3. Step 3: Shows highest throughput during test

---

### 📋 Compare two K6 runs

User can select two runs to compare metrics

**Expected Behavior:**
1. Step 1: Select first K6 run
2. Step 2: Select second K6 run
3. Step 3: Click Compare
4. Step 4: Verify side-by-side metrics
5. Step 5: Deltas show improvement or regression

---

