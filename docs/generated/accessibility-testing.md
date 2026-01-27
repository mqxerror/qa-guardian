# Accessibility Testing

> 35 features | 34 completed | 1 pending

[← Back to Index](../README.md)

---

## ✅ Completed Features

### ✅ Create accessibility test from UI

User can create accessibility test for any URL

**How to use:**
Create an accessibility test for any URL from the Accessibility section.

**Expected Behavior:**
1. Step 1: Navigate to test suites
2. Step 2: Click 'Create Test' and select 'Accessibility'
3. Step 3: Enter test name and target URL
4. Step 4: Select WCAG level (AA or AAA)
5. Step 5: Save and verify test created

---

### ✅ axe-core scan executes successfully

System runs axe-core accessibility analysis on target page

**How to use:**
axe-core automatically scans your page for accessibility violations.

**Expected Behavior:**
1. Step 1: Create accessibility test
2. Step 2: Run the test
3. Step 3: Verify axe-core analysis completes
4. Step 4: Results captured and stored

---

### ✅ Accessibility violations detected and listed

All accessibility violations found are displayed in results

**How to use:**
All detected accessibility violations are listed with details.

**Expected Behavior:**
1. Step 1: Run accessibility test on page with issues
2. Step 2: View test results
3. Step 3: Verify violations listed
4. Step 4: Each violation shows rule that was violated

---

### ✅ WCAG 2.1 Level A violations detected

Test catches Level A WCAG 2.1 violations

**How to use:**
WCAG Level A violations (basic accessibility) are detected.

**Expected Behavior:**
1. Step 1: Run test on page missing image alt text
2. Step 2: View results
3. Step 3: Verify 'image-alt' violation detected
4. Step 4: WCAG reference shows Level A

---

### ✅ WCAG 2.1 Level AA violations detected

Test catches Level AA WCAG 2.1 violations

**How to use:**
WCAG Level AA violations (standard compliance) are detected.

**Expected Behavior:**
1. Step 1: Run test on page with poor color contrast
2. Step 2: View results
3. Step 3: Verify 'color-contrast' violation detected
4. Step 4: WCAG reference shows Level AA

---

### ✅ WCAG 2.1 Level AAA checking optional

User can enable stricter AAA level checking

**How to use:**
Enable AAA checking for the strictest accessibility requirements.

**Expected Behavior:**
1. Step 1: Create accessibility test
2. Step 2: Enable 'Include AAA rules'
3. Step 3: Run test
4. Step 4: Verify AAA-level violations included

---

### ✅ Violations categorized as Critical severity

Violations that completely block access marked Critical

**How to use:**
Critical violations completely block access for some users.

**Expected Behavior:**
1. Step 1: Run test on page with missing form labels
2. Step 2: View results
3. Step 3: Find violation marked 'Critical'
4. Step 4: Critical violations highlighted prominently

---

### ✅ Violations categorized as Serious severity

Violations causing major barriers marked Serious

**How to use:**
Serious violations cause major barriers for users with disabilities.

**Expected Behavior:**
1. Step 1: Run accessibility test
2. Step 2: View results
3. Step 3: Verify Serious severity violations identified
4. Step 4: Listed below Critical violations

---

### ✅ Violations categorized as Minor severity

Violations causing inconvenience marked Minor

**How to use:**
Minor violations cause minor inconvenience.

**Expected Behavior:**
1. Step 1: Run accessibility test
2. Step 2: View results
3. Step 3: Verify Minor severity violations identified

---

### ✅ Violation shows affected element selector

Each violation displays CSS selector of affected element

**How to use:**
Each violation shows the CSS selector of the affected element.

**Expected Behavior:**
1. Step 1: View accessibility violation
2. Step 2: Find 'Element' or 'Selector' field
3. Step 3: Verify CSS selector shown (e.g., '#nav > ul > li:nth-child(2)')
4. Step 4: Selector identifies exact element

---

### ✅ Violation shows affected element HTML

Each violation displays HTML snippet of affected element

**How to use:**
View the HTML snippet of the element causing the violation.

**Expected Behavior:**
1. Step 1: View accessibility violation
2. Step 2: Find 'HTML' section
3. Step 3: Verify HTML code snippet displayed
4. Step 4: Can see element's attributes and content

---

### ✅ Violation shows fix guidance

Each violation includes remediation instructions

**How to use:**
Each violation includes guidance on how to fix it.

**Expected Behavior:**
1. Step 1: View accessibility violation for 'color-contrast'
2. Step 2: Find 'How to fix' section
3. Step 3: Verify fix instructions displayed
4. Step 4: Instructions specific to violation type

---

### ✅ Violation shows WCAG success criterion reference

Each violation links to relevant WCAG guideline

**How to use:**
Violations link to the relevant WCAG success criterion.

**Expected Behavior:**
1. Step 1: View accessibility violation
2. Step 2: Find WCAG reference
3. Step 3: Verify shows criterion number (e.g., '1.4.3 Contrast')
4. Step 4: Link to WCAG documentation

---

### ✅ Accessibility score calculated

System calculates overall accessibility score for page

**How to use:**
The overall accessibility score summarizes page accessibility.

**Expected Behavior:**
1. Step 1: Run accessibility test
2. Step 2: View results summary
3. Step 3: Find accessibility score (0-100)
4. Step 4: Score based on violations found

---

### ✅ Filter violations by severity

User can filter violation list by severity level

**How to use:**
Filter violations by severity to focus on critical issues first.

**Expected Behavior:**
1. Step 1: View accessibility results with many violations
2. Step 2: Click 'Critical' filter
3. Step 3: Verify only Critical violations shown
4. Step 4: Click 'All' to show all again

---

### ✅ Filter violations by category

User can filter by violation category (color, forms, images, etc.)

**How to use:**
Filter by category (color contrast, forms, images, etc.).

**Expected Behavior:**
1. Step 1: View accessibility results
2. Step 2: Select 'Color' category filter
3. Step 3: Verify only color-related violations shown
4. Step 4: Select 'Forms' to see form violations

---

### ✅ Search violations by text

User can search violations by keyword

**How to use:**
Search violations by keyword to find specific issues.

**Expected Behavior:**
1. Step 1: View accessibility results
2. Step 2: Type 'contrast' in search box
3. Step 3: Verify results filtered to contrast violations
4. Step 4: Clear search to see all

---

### ✅ Accessibility trends over time

Dashboard shows violation count trend across test runs

**How to use:**
Track accessibility improvements over time in the dashboard.

**Expected Behavior:**
1. Step 1: Run accessibility test multiple times
2. Step 2: View accessibility trends
3. Step 3: Verify chart shows violations over time
4. Step 4: Can see improvement/regression

---

### ✅ Accessibility test pass/fail threshold

Test fails if violations exceed configured threshold

**How to use:**
Set a maximum violation count - tests fail if exceeded.

**Expected Behavior:**
1. Step 1: Configure: fail if Critical violations > 0
2. Step 2: Run test with 1 Critical violation
3. Step 3: Verify test fails
4. Step 4: Fix issue, run again
5. Step 5: Verify test passes

---

### ✅ Export accessibility report PDF

User can export accessibility results as PDF

**How to use:**
Export a PDF accessibility report to share with your team.

**Expected Behavior:**
1. Step 1: View accessibility results
2. Step 2: Click 'Export' and select PDF
3. Step 3: Verify PDF downloads
4. Step 4: PDF contains all violations and guidance

---

### ✅ Export accessibility report CSV

User can export accessibility violations as CSV

**How to use:**
Export violations as CSV for analysis in spreadsheets.

**Expected Behavior:**
1. Step 1: View accessibility results
2. Step 2: Click 'Export' and select CSV
3. Step 3: Verify CSV downloads
4. Step 4: CSV contains violation data in columns

---

### ✅ Pa11y integration available

System can also run Pa11y for complementary checks

**How to use:**
Pa11y provides complementary accessibility checks alongside axe-core.

**Expected Behavior:**
1. Step 1: Edit accessibility test
2. Step 2: Enable 'Include Pa11y checks'
3. Step 3: Run test
4. Step 4: Verify Pa11y findings included in results
5. Step 5: Results show source (axe-core vs Pa11y)

---

### ✅ Accessibility check as E2E test step

Accessibility scan can be added as step within E2E test

**How to use:**
Add accessibility checks as a step within your E2E tests.

**Expected Behavior:**
1. Step 1: Edit E2E test
2. Step 2: Add 'Accessibility Check' step after navigation
3. Step 3: Run E2E test
4. Step 4: Verify accessibility scan runs at that step
5. Step 5: E2E test fails if accessibility threshold exceeded

---

### ✅ MCP server configurable via environment variables

Server configuration via QA_GUARDIAN_API_KEY and QA_GUARDIAN_API_URL

**How to use:**
Configure MCP via environment variables QA_GUARDIAN_API_KEY and QA_GUARDIAN_API_URL.

**Expected Behavior:**
1. Step 1: Set QA_GUARDIAN_API_KEY environment variable
2. Step 2: Set QA_GUARDIAN_API_URL environment variable
3. Step 3: Start MCP server
4. Step 4: Verify server uses configured values

---

### ✅ Accessibility test type available in creation

When creating test, 'Accessibility' is an available type

**How to use:**
Accessibility is available as a test type when creating new tests.

**Expected Behavior:**
1. Step 1: Click Create Test
2. Step 2: View test type options
3. Step 3: Verify 'Accessibility' option exists
4. Step 4: Option has accessibility icon

---

### ✅ Accessibility test form shows required fields

Form shows name, URL, and WCAG level selection

**How to use:**
Enter the URL for accessibility scanning.

**Expected Behavior:**
1. Step 1: Select Accessibility test type
2. Step 2: Verify name field displayed
3. Step 3: Verify URL field displayed
4. Step 4: Verify WCAG level dropdown (A, AA, AAA)

---

### ✅ Run accessibility test executes axe-core scan

Running test performs axe-core analysis on page

**How to use:**
Click Run to execute the axe-core accessibility scan.

**Expected Behavior:**
1. Step 1: Create accessibility test
2. Step 2: Click Run
3. Step 3: Verify test executes
4. Step 4: axe-core scan runs on target page
5. Step 5: Results captured

---

### ✅ Accessibility violations listed in results

Results display all detected accessibility violations

**How to use:**
Violations are listed with full details.

**Expected Behavior:**
1. Step 1: Run accessibility test on page with issues
2. Step 2: View results
3. Step 3: Verify violations listed
4. Step 4: Each violation shows rule name

---

### ✅ Violation shows remediation guidance

Each violation includes instructions on how to fix

**How to use:**
Each violation includes guidance on how to fix it.

**Expected Behavior:**
1. Step 1: View accessibility violation
2. Step 2: Find 'How to fix' or guidance section
3. Step 3: Verify fix instructions provided
4. Step 4: Instructions specific to violation type

---

### ✅ Violation shows WCAG reference

Each violation links to relevant WCAG success criterion

**How to use:**
Each violation links to the relevant WCAG criterion.

**Expected Behavior:**
1. Step 1: View accessibility violation
2. Step 2: Find WCAG reference
3. Step 3: Verify criterion number shown (e.g., 1.4.3)
4. Step 4: May link to WCAG documentation

---

### ✅ Accessibility score calculated and displayed

Overall accessibility score (0-100) shown in results

**How to use:**
Overall accessibility score is calculated and displayed.

**Expected Behavior:**
1. Step 1: View accessibility results
2. Step 2: Find accessibility score
3. Step 3: Score displayed prominently
4. Step 4: Based on violations found relative to page

---

### ✅ Configure accessibility test threshold

User can set max violations for pass/fail

**How to use:**
Set maximum violation threshold for pass/fail.

**Expected Behavior:**
1. Step 1: Edit accessibility test settings
2. Step 2: Set 'Max Critical violations' to 0
3. Step 3: Run test with 1 critical violation
4. Step 4: Verify test fails
5. Step 5: Fix violation, run again - test passes

---

### ✅ Export accessibility report as PDF

User can download accessibility results as PDF

**How to use:**
Export accessibility results as a PDF report.

**Expected Behavior:**
1. Step 1: View accessibility results
2. Step 2: Click Export/Download
3. Step 3: Select PDF format
4. Step 4: Verify PDF downloads
5. Step 5: PDF contains all violations and guidance

---

### ✅ MCP server accepts API key via environment variable

Server reads QA_GUARDIAN_API_KEY from environment

**How to use:**
Set API key via QA_GUARDIAN_API_KEY environment variable.

**Expected Behavior:**
1. Step 1: Set environment variable: export QA_GUARDIAN_API_KEY=xxx
2. Step 2: Start MCP server
3. Step 3: Verify server uses the API key
4. Step 4: Connections authenticate with that key

---

## 📋 Pending Features

### 📋 Violation shows HTML snippet

Each violation displays HTML code of affected element

**Expected Behavior:**
1. Step 1: View accessibility violation
2. Step 2: Find HTML section
3. Step 3: Verify HTML code displayed
4. Step 4: Shows element and relevant attributes

---

