# Performance Testing

> 48 features | 47 completed | 1 pending

[← Back to Index](../README.md)

---

## ✅ Completed Features

### ✅ Create Lighthouse performance test

User can create a Lighthouse audit test for any URL

**How to use:**
Create a Lighthouse performance audit for any URL from the Performance Testing section.

**Expected Behavior:**
1. Step 1: Navigate to project test suites
2. Step 2: Click 'Create Test' and select 'Performance (Lighthouse)'
3. Step 3: Enter test name and target URL
4. Step 4: Select device preset (Mobile/Desktop)
5. Step 5: Save and verify test created

---

### ✅ Lighthouse audit runs successfully

System executes Lighthouse audit and captures all metrics

**How to use:**
Lighthouse runs a full audit and captures all performance metrics automatically.

**Expected Behavior:**
1. Step 1: Create Lighthouse test for a URL
2. Step 2: Run the test
3. Step 3: Verify audit completes without errors
4. Step 4: Confirm results stored and viewable

---

### ✅ Lighthouse captures LCP metric

Largest Contentful Paint metric captured and displayed

**How to use:**
LCP (Largest Contentful Paint) measures loading performance - how fast the main content appears.

**Expected Behavior:**
1. Step 1: Run Lighthouse audit
2. Step 2: View performance results
3. Step 3: Find LCP in Core Web Vitals section
4. Step 4: Verify value shown in seconds (e.g., 2.4s)
5. Step 5: Verify rating shown (Good/Needs Improvement/Poor)

---

### ✅ Lighthouse captures FID/INP metric

First Input Delay or Interaction to Next Paint metric captured

**How to use:**
FID/INP measures interactivity - how fast the page responds to user input.

**Expected Behavior:**
1. Step 1: Run Lighthouse audit
2. Step 2: View performance results
3. Step 3: Find INP in Core Web Vitals section
4. Step 4: Verify value shown in milliseconds
5. Step 5: Verify interactivity rating displayed

---

### ✅ Lighthouse captures CLS metric

Cumulative Layout Shift metric captured and displayed

**How to use:**
CLS (Cumulative Layout Shift) measures visual stability - how much the page shifts while loading.

**Expected Behavior:**
1. Step 1: Run Lighthouse audit
2. Step 2: View performance results
3. Step 3: Find CLS in Core Web Vitals section
4. Step 4: Verify value shown as decimal (e.g., 0.12)
5. Step 5: Verify visual stability rating displayed

---

### ✅ Lighthouse captures TTFB metric

Time to First Byte metric captured and displayed

**How to use:**
TTFB (Time to First Byte) measures server response time.

**Expected Behavior:**
1. Step 1: Run Lighthouse audit
2. Step 2: View performance results
3. Step 3: Find TTFB metric
4. Step 4: Verify value shown in milliseconds

---

### ✅ Lighthouse captures FCP metric

First Contentful Paint metric captured and displayed

**How to use:**
FCP (First Contentful Paint) measures when the first content appears on screen.

**Expected Behavior:**
1. Step 1: Run Lighthouse audit
2. Step 2: View performance results
3. Step 3: Find FCP metric
4. Step 4: Verify value shown in seconds

---

### ✅ Lighthouse captures Total Blocking Time

TBT metric showing main thread blocking time

**How to use:**
TBT (Total Blocking Time) measures how long the main thread was blocked.

**Expected Behavior:**
1. Step 1: Run Lighthouse audit
2. Step 2: View performance results
3. Step 3: Find Total Blocking Time metric
4. Step 4: Verify value shown in milliseconds

---

### ✅ Lighthouse overall performance score displayed

Aggregate performance score (0-100) prominently displayed

**How to use:**
The overall performance score (0-100) summarizes page performance at a glance.

**Expected Behavior:**
1. Step 1: Run Lighthouse audit
2. Step 2: View results summary
3. Step 3: Verify score shown as number 0-100
4. Step 4: Score color-coded (red <50, orange 50-89, green 90+)

---

### ✅ Lighthouse accessibility score displayed

Accessibility category score from Lighthouse displayed

**How to use:**
Accessibility score shows how accessible your page is according to Lighthouse.

**Expected Behavior:**
1. Step 1: Run Lighthouse audit
2. Step 2: View results summary
3. Step 3: Find Accessibility score
4. Step 4: Verify score 0-100 displayed

---

### ✅ Lighthouse best practices score displayed

Best Practices category score displayed

**How to use:**
Best Practices score highlights security and web development best practices.

**Expected Behavior:**
1. Step 1: Run Lighthouse audit
2. Step 2: View results
3. Step 3: Find Best Practices score
4. Step 4: Verify score 0-100 displayed

---

### ✅ Lighthouse SEO score displayed

SEO category score displayed

**How to use:**
SEO score shows how well optimized your page is for search engines.

**Expected Behavior:**
1. Step 1: Run Lighthouse audit
2. Step 2: View results
3. Step 3: Find SEO score
4. Step 4: Verify score 0-100 displayed

---

### ✅ User configures performance score threshold

Test fails if performance score below configured minimum

**How to use:**
Set a minimum performance score - tests fail if the score drops below this threshold.

**Expected Behavior:**
1. Step 1: Edit Lighthouse test
2. Step 2: Set minimum performance score to 80
3. Step 3: Run against page scoring 75
4. Step 4: Verify test fails
5. Step 5: Run against page scoring 85
6. Step 6: Verify test passes

---

### ✅ User configures LCP threshold

Test fails if LCP exceeds configured maximum

**How to use:**
Set a maximum LCP time - tests fail if loading takes longer than allowed.

**Expected Behavior:**
1. Step 1: Edit Lighthouse test
2. Step 2: Set LCP budget to 2.5 seconds
3. Step 3: Run against page with LCP 3.0s
4. Step 4: Verify test fails
5. Step 5: Run against page with LCP 2.0s
6. Step 6: Verify test passes

---

### ✅ User configures CLS threshold

Test fails if CLS exceeds configured maximum

**How to use:**
Set a maximum CLS score - tests fail if the page shifts too much.

**Expected Behavior:**
1. Step 1: Edit Lighthouse test
2. Step 2: Set CLS budget to 0.1
3. Step 3: Run against page with CLS 0.25
4. Step 4: Verify test fails

---

### ✅ Performance trends chart over time

Dashboard shows performance score trend across multiple runs

**How to use:**
Track performance scores over time to catch regressions early.

**Expected Behavior:**
1. Step 1: Run Lighthouse test 5+ times over several days
2. Step 2: Navigate to performance trends
3. Step 3: Verify line chart showing score over time
4. Step 4: Each data point represents a run
5. Step 5: Trend line indicates improvement/degradation

---

### ✅ Core Web Vitals trends over time

Individual CWV metrics (LCP, CLS, INP) trended over time

**How to use:**
View LCP, CLS, and INP trends over time in the dashboard.

**Expected Behavior:**
1. Step 1: Run multiple Lighthouse audits
2. Step 2: View CWV trends
3. Step 3: Verify separate trend lines for LCP, CLS, INP
4. Step 4: Can toggle individual metrics on/off

---

### ✅ Compare Lighthouse results between runs

User can compare metrics between two specific runs

**How to use:**
Compare two Lighthouse runs side-by-side to see what changed.

**Expected Behavior:**
1. Step 1: Select two Lighthouse test runs
2. Step 2: Click 'Compare'
3. Step 3: View side-by-side metric comparison
4. Step 4: Deltas shown (+0.5s LCP, -10 perf score)
5. Step 5: Color-coded to show improvement/regression

---

### ✅ Lighthouse recommendations displayed

Opportunities and diagnostics from Lighthouse shown with savings

**How to use:**
View Lighthouse recommendations for improving performance.

**Expected Behavior:**
1. Step 1: Run Lighthouse audit
2. Step 2: View 'Opportunities' section
3. Step 3: See list of recommendations
4. Step 4: Each shows estimated savings (e.g., 'Save 1.5s')
5. Step 5: Click to expand details and guidance

---

### ✅ Lighthouse diagnostics displayed

Diagnostic information about page performance shown

**How to use:**
See detailed diagnostic information about page performance issues.

**Expected Behavior:**
1. Step 1: Run Lighthouse audit
2. Step 2: View 'Diagnostics' section
3. Step 3: See diagnostic items (DOM size, JS execution time, etc.)
4. Step 4: Each shows current value and threshold

---

### ✅ Alert when performance degrades

System sends alert when performance score drops below threshold

**How to use:**
Get alerts when performance drops below your configured thresholds.

**Expected Behavior:**
1. Step 1: Configure alert: 'Performance score < 70'
2. Step 2: Run scheduled Lighthouse test
3. Step 3: Score drops to 65
4. Step 4: Verify alert sent via configured channel
5. Step 5: Alert includes score and comparison to previous

---

### ✅ Lighthouse runs in mobile emulation mode

Audit can run with mobile device emulation and throttling

**How to use:**
Run Lighthouse with mobile device emulation and network throttling.

**Expected Behavior:**
1. Step 1: Create Lighthouse test
2. Step 2: Select 'Mobile' device preset
3. Step 3: Run audit
4. Step 4: Verify results reflect mobile viewport
5. Step 5: CPU/network throttling applied

---

### ✅ Lighthouse runs in desktop mode

Audit can run with desktop settings (no throttling)

**How to use:**
Run Lighthouse in desktop mode without any throttling.

**Expected Behavior:**
1. Step 1: Create Lighthouse test
2. Step 2: Select 'Desktop' device preset
3. Step 3: Run audit
4. Step 4: Verify desktop viewport used
5. Step 5: No CPU/network throttling

---

### ✅ Download Lighthouse HTML report

User can download full Lighthouse report as HTML file

**How to use:**
Download the full Lighthouse report as an HTML file to share.

**Expected Behavior:**
1. Step 1: View Lighthouse test results
2. Step 2: Click 'Download Report'
3. Step 3: Select HTML format
4. Step 4: Verify file downloads
5. Step 5: Open file - full interactive Lighthouse report

---

### ✅ Download Lighthouse JSON report

User can download raw Lighthouse data as JSON

**How to use:**
Download raw Lighthouse data as JSON for custom analysis.

**Expected Behavior:**
1. Step 1: View Lighthouse test results
2. Step 2: Click 'Download Report'
3. Step 3: Select JSON format
4. Step 4: Verify JSON file downloads
5. Step 5: File contains all audit data

---

### ✅ Lighthouse test type available in test creation

When creating test, 'Performance (Lighthouse)' is an available type

**How to use:**
Lighthouse is available as a test type when creating new tests.

**Expected Behavior:**
1. Step 1: Click Create Test
2. Step 2: View test type options
3. Step 3: Verify 'Performance' or 'Lighthouse' option exists
4. Step 4: Option has performance/speed icon

---

### ✅ Lighthouse test creation form shows required fields

Form shows name, URL, and device preset fields

**How to use:**
Enter the URL and configure options for your Lighthouse audit.

**Expected Behavior:**
1. Step 1: Select Lighthouse test type
2. Step 2: Verify test name field displayed
3. Step 3: Verify target URL field displayed
4. Step 4: Verify device selection (Mobile/Desktop) displayed

---

### ✅ Lighthouse test saves with valid configuration

Completing form creates the Lighthouse test

**How to use:**
Save creates the Lighthouse test with your configuration.

**Expected Behavior:**
1. Step 1: Enter name: 'Homepage Performance'
2. Step 2: Enter URL: 'https://example.com'
3. Step 3: Select Mobile device
4. Step 4: Click Save
5. Step 5: Verify test created and appears in list

---

### ✅ Run Lighthouse test executes audit

Running test performs Lighthouse audit on target URL

**How to use:**
Click Run to execute the Lighthouse audit.

**Expected Behavior:**
1. Step 1: Navigate to Lighthouse test
2. Step 2: Click Run Test
3. Step 3: Verify test starts executing
4. Step 4: Wait for completion
5. Step 5: Verify results are captured

---

### ✅ Performance score prominently displayed in results

Overall performance score (0-100) shown prominently

**How to use:**
The performance score (0-100) is prominently displayed.

**Expected Behavior:**
1. Step 1: View completed Lighthouse results
2. Step 2: Verify large score display (e.g., '78')
3. Step 3: Score has color coding (green/orange/red)
4. Step 4: Score is the most prominent element

---

### ✅ Performance score color green for 90-100

Scores 90 and above shown in green indicating good

**How to use:**
Green score (90-100) indicates good performance.

**Expected Behavior:**
1. Step 1: View results with score 92
2. Step 2: Verify score displayed in green color
3. Step 3: Label may show 'Good'

---

### ✅ Performance score color orange for 50-89

Scores 50-89 shown in orange indicating needs improvement

**How to use:**
Orange score (50-89) indicates needs improvement.

**Expected Behavior:**
1. Step 1: View results with score 65
2. Step 2: Verify score displayed in orange/yellow color
3. Step 3: Label may show 'Needs Improvement'

---

### ✅ Performance score color red for 0-49

Scores below 50 shown in red indicating poor

**How to use:**
Red score (0-49) indicates poor performance.

**Expected Behavior:**
1. Step 1: View results with score 35
2. Step 2: Verify score displayed in red color
3. Step 3: Label may show 'Poor'

---

### ✅ LCP metric displayed with value and rating

Largest Contentful Paint shown with timing and good/needs-improvement/poor

**How to use:**
LCP is displayed with its value and Good/Needs Improvement/Poor rating.

**Expected Behavior:**
1. Step 1: View Lighthouse results
2. Step 2: Find LCP in metrics section
3. Step 3: Verify value shown (e.g., '2.4s')
4. Step 4: Verify rating indicator (green/orange/red)
5. Step 5: Good = ≤2.5s, Needs Improvement = 2.5-4s, Poor = >4s

---

### ✅ CLS metric displayed with value and rating

Cumulative Layout Shift shown with score and rating

**How to use:**
CLS is displayed with its value and rating.

**Expected Behavior:**
1. Step 1: View Lighthouse results
2. Step 2: Find CLS in metrics section
3. Step 3: Verify value shown (e.g., '0.12')
4. Step 4: Verify rating indicator
5. Step 5: Good = ≤0.1, Needs Improvement = 0.1-0.25, Poor = >0.25

---

### ✅ INP/FID metric displayed with value and rating

Interaction to Next Paint shown with timing and rating

**How to use:**
INP/FID is displayed with its value and rating.

**Expected Behavior:**
1. Step 1: View Lighthouse results
2. Step 2: Find INP or FID in metrics section
3. Step 3: Verify value shown in milliseconds
4. Step 4: Verify rating indicator

---

### ✅ Speed Index metric displayed

Speed Index timing is shown

**How to use:**
Speed Index shows how fast content is visible.

**Expected Behavior:**
1. Step 1: View Lighthouse results
2. Step 2: Find Speed Index metric
3. Step 3: Verify value shown (e.g., '3.2s')

---

### ✅ All five Lighthouse category scores displayed

Shows Performance, Accessibility, Best Practices, SEO scores

**How to use:**
All five Lighthouse categories are scored and displayed.

**Expected Behavior:**
1. Step 1: View Lighthouse results summary
2. Step 2: Verify Performance score shown
3. Step 3: Verify Accessibility score shown
4. Step 4: Verify Best Practices score shown
5. Step 5: Verify SEO score shown

---

### ✅ Configure performance score threshold

User can set minimum performance score for pass/fail

**How to use:**
Set minimum performance score threshold for pass/fail.

**Expected Behavior:**
1. Step 1: Edit Lighthouse test settings
2. Step 2: Find performance threshold field
3. Step 3: Set minimum score to 80
4. Step 4: Save configuration
5. Step 5: Run test scoring 75 - verify fails
6. Step 6: Run test scoring 85 - verify passes

---

### ✅ Configure LCP budget

User can set maximum acceptable LCP time

**How to use:**
Set maximum LCP time for pass/fail.

**Expected Behavior:**
1. Step 1: Edit Lighthouse test settings
2. Step 2: Find LCP budget field
3. Step 3: Set budget to 2500ms
4. Step 4: Save configuration
5. Step 5: Run test with LCP 3000ms - verify fails

---

### ✅ Configure CLS budget

User can set maximum acceptable CLS score

**How to use:**
Set maximum CLS value for pass/fail.

**Expected Behavior:**
1. Step 1: Edit Lighthouse test settings
2. Step 2: Find CLS budget field
3. Step 3: Set budget to 0.1
4. Step 4: Save configuration
5. Step 5: Run test with CLS 0.15 - verify fails

---

### ✅ Lighthouse opportunities section displayed

Results show optimization opportunities with estimated savings

**How to use:**
View Lighthouse opportunities for improvement.

**Expected Behavior:**
1. Step 1: View Lighthouse results
2. Step 2: Find 'Opportunities' section
3. Step 3: Verify optimization suggestions listed
4. Step 4: Each shows estimated time savings
5. Step 5: Opportunities sorted by impact

---

### ✅ Lighthouse diagnostics section displayed

Results show diagnostic information about page

**How to use:**
View Lighthouse diagnostics about your page.

**Expected Behavior:**
1. Step 1: View Lighthouse results
2. Step 2: Find 'Diagnostics' section
3. Step 3: Verify diagnostic items listed
4. Step 4: Shows items like DOM size, JS execution time

---

### ✅ Performance trends chart shows score over time

Dashboard displays performance score trend across runs

**How to use:**
View performance score trends over time.

**Expected Behavior:**
1. Step 1: Run Lighthouse test 5+ times
2. Step 2: Navigate to trends view
3. Step 3: Verify line chart showing score history
4. Step 4: Each point represents a test run
5. Step 5: Can see improvement or degradation pattern

---

### ✅ CWV metrics trended over time

Individual Core Web Vitals shown in trend chart

**How to use:**
Track Core Web Vitals metrics over time.

**Expected Behavior:**
1. Step 1: Run multiple Lighthouse tests
2. Step 2: View CWV trends
3. Step 3: Verify separate lines for LCP, CLS, INP/FID
4. Step 4: Can toggle individual metrics on/off

---

### ✅ Compare two Lighthouse runs

User can select two runs to compare metrics

**How to use:**
Compare metrics between two Lighthouse runs.

**Expected Behavior:**
1. Step 1: Select first Lighthouse run
2. Step 2: Select second Lighthouse run
3. Step 3: Click Compare
4. Step 4: Verify side-by-side metric comparison
5. Step 5: Deltas shown (e.g., +5 score, -0.3s LCP)

---

### ✅ Download Lighthouse JSON data

User can download raw Lighthouse data as JSON

**How to use:**
Download raw Lighthouse JSON for custom analysis.

**Expected Behavior:**
1. Step 1: View Lighthouse results
2. Step 2: Click Download/Export
3. Step 3: Select JSON format
4. Step 4: Verify JSON file downloads
5. Step 5: Contains all audit data

---

## 📋 Pending Features

### 📋 Lighthouse passed audits section displayed

Results show audits that passed for positive feedback

**Expected Behavior:**
1. Step 1: View Lighthouse results
2. Step 2: Find 'Passed Audits' section
3. Step 3: Verify list of passed checks
4. Step 4: Section may be collapsed by default

---

