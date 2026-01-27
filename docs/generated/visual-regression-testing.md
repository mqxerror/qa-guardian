# Visual Regression Testing

> 104 features | 98 completed | 6 pending

[← Back to Index](../README.md)

---

## ✅ Completed Features

### ✅ Create visual regression test from UI

User can create a new visual regression test by specifying a name, URL, and viewport settings through the UI

**How to use:**
Create visual regression tests from the UI by entering a name and target URL.

**Expected Behavior:**
1. Step 1: Navigate to project's test suites
2. Step 2: Click 'Create Test' and select 'Visual Regression' type
3. Step 3: Enter test name and target URL
4. Step 4: Select viewport preset or enter custom dimensions
5. Step 5: Click save and verify test appears in list

---

### ✅ Visual test captures full-page screenshot

When visual test runs, system captures complete full-page screenshot including content below the fold using Playwright's fullPage option

**How to use:**
Full-page screenshots capture the entire page including content below the fold.

**Expected Behavior:**
1. Step 1: Create visual test for a page with scrollable content
2. Step 2: Run the visual test
3. Step 3: View captured screenshot in results
4. Step 4: Verify screenshot includes all content from top to bottom
5. Step 5: Confirm screenshot dimensions match full page height

---

### ✅ Visual test captures viewport-only screenshot

User can configure visual test to capture only visible viewport area instead of full page

**How to use:**
Viewport-only screenshots capture just what is visible on screen.

**Expected Behavior:**
1. Step 1: Create or edit visual test
2. Step 2: Set capture mode to 'Viewport Only'
3. Step 3: Run the visual test
4. Step 4: Verify screenshot matches viewport dimensions exactly
5. Step 5: Confirm content below fold is not included

---

### ✅ Visual test captures element-specific screenshot

User can configure visual test to capture screenshot of a specific element by CSS selector

**How to use:**
Element screenshots capture a specific element by CSS selector.

**Expected Behavior:**
1. Step 1: Create or edit visual test
2. Step 2: Set capture mode to 'Element'
3. Step 3: Enter CSS selector for target element (e.g., '.hero-section')
4. Step 4: Run the visual test
5. Step 5: Verify screenshot contains only the targeted element with its exact boundaries

---

### ✅ Visual test runs at desktop viewport (1920x1080)

Visual test can be configured to run at standard desktop viewport resolution

**How to use:**
Desktop preset (1920x1080) tests standard desktop displays.

**Expected Behavior:**
1. Step 1: Create visual test
2. Step 2: Select 'Desktop' viewport preset (1920x1080)
3. Step 3: Run the visual test
4. Step 4: Verify screenshot width is 1920 pixels
5. Step 5: Confirm page rendered in desktop layout

---

### ✅ Visual test runs at tablet viewport (768x1024)

Visual test can be configured to run at standard tablet viewport resolution

**How to use:**
Tablet preset (768x1024) tests tablet-sized screens.

**Expected Behavior:**
1. Step 1: Create visual test
2. Step 2: Select 'Tablet' viewport preset (768x1024)
3. Step 3: Run the visual test
4. Step 4: Verify screenshot width is 768 pixels
5. Step 5: Confirm page rendered in tablet/responsive layout

---

### ✅ Visual test runs at mobile viewport (375x667)

Visual test can be configured to run at standard mobile viewport resolution

**How to use:**
Mobile preset (375x667) tests mobile phone screens.

**Expected Behavior:**
1. Step 1: Create visual test
2. Step 2: Select 'Mobile' viewport preset (375x667)
3. Step 3: Run the visual test
4. Step 4: Verify screenshot width is 375 pixels
5. Step 5: Confirm page rendered in mobile layout

---

### ✅ Visual test runs at custom viewport dimensions

User can specify custom viewport width and height for visual test

**How to use:**
Enter custom viewport dimensions for specific device testing.

**Expected Behavior:**
1. Step 1: Create visual test
2. Step 2: Select 'Custom' viewport option
3. Step 3: Enter width: 1440, height: 900
4. Step 4: Run the visual test
5. Step 5: Verify screenshot matches custom dimensions

---

### ✅ Visual test waits for page load before screenshot

System waits for page to fully load (network idle) before capturing screenshot

**How to use:**
Screenshots wait for the page to fully load before capturing.

**Expected Behavior:**
1. Step 1: Create visual test for page with async content
2. Step 2: Run the visual test
3. Step 3: Verify screenshot includes dynamically loaded content
4. Step 4: Confirm no loading spinners or placeholders in screenshot

---

### ✅ Visual regression test type available in test creation dropdown

When creating a new test, 'Visual Regression' appears as an option in the test type dropdown menu

**How to use:**
Visual Regression appears as a test type option when creating new tests.

**Expected Behavior:**
1. Step 1: Navigate to a project's test suites section
2. Step 2: Click the 'Create Test' or 'New Test' button
3. Step 3: Verify a dropdown or selection for test type is displayed
4. Step 4: Confirm 'Visual Regression' is listed as an available option
5. Step 5: Verify the option has an appropriate icon (e.g., eye or image icon)

---

### ✅ Visual test creation form displays required fields

The visual test creation form shows all required fields: name, URL, and viewport configuration

**How to use:**
The form shows required fields: name, URL, and viewport configuration.

**Expected Behavior:**
1. Step 1: Select 'Visual Regression' as test type
2. Step 2: Verify 'Test Name' field is displayed and marked required
3. Step 3: Verify 'Target URL' field is displayed and marked required
4. Step 4: Verify 'Viewport' selection is displayed
5. Step 5: Verify 'Save' button is disabled until required fields are filled

---

### ✅ Visual test URL field validates format

Target URL field validates that input is a properly formatted URL

**How to use:**
URL field validates that you enter a proper web address.

**Expected Behavior:**
1. Step 1: Enter 'not-a-url' - verify URL format error displayed
2. Step 2: Enter 'http://' only - verify incomplete URL error
3. Step 3: Enter 'https://example.com' - verify accepted
4. Step 4: Enter 'https://example.com/path?query=1' - verify complex URL accepted
5. Step 5: Verify URL field shows protocol hint (https://)

---

### ✅ Visual test saves successfully with valid data

Completing the form with valid data and clicking save creates the test

**How to use:**
Save creates the visual test when all required fields are valid.

**Expected Behavior:**
1. Step 1: Fill in valid test name 'Homepage Desktop Test'
2. Step 2: Fill in valid URL 'https://example.com'
3. Step 3: Select Desktop viewport
4. Step 4: Click Save button
5. Step 5: Verify success message displayed
6. Step 6: Verify test appears in test list
7. Step 7: Verify test details page shows correct configuration

---

### ✅ Visual test run button is visible on test details page

Test details page displays a prominent 'Run Test' button

**How to use:**
Click the Run Test button on the test details page to execute.

**Expected Behavior:**
1. Step 1: Navigate to visual test details page
2. Step 2: Verify 'Run Test' button is visible in header area
3. Step 3: Verify button has appropriate styling (primary action color)
4. Step 4: Verify button shows play icon or similar indicator

---

### ✅ Visual test navigates to target URL during execution

Test execution navigates Playwright browser to the configured target URL

**How to use:**
The test navigates to your configured URL during execution.

**Expected Behavior:**
1. Step 1: Configure visual test for 'https://example.com/products'
2. Step 2: Run the test
3. Step 3: View execution logs/trace
4. Step 4: Verify browser navigated to configured URL
5. Step 5: Verify correct page content was loaded

---

### ✅ Visual test waits for network idle before screenshot

System waits for network to be idle (no pending requests) before capturing screenshot

**How to use:**
Screenshots wait for network activity to stop before capture.

**Expected Behavior:**
1. Step 1: Create visual test for page with async API calls
2. Step 2: Run the test
3. Step 3: Verify screenshot shows fully loaded content
4. Step 4: Verify no loading spinners or placeholder content in screenshot
5. Step 5: Check execution logs for 'network idle' wait event

---

### ✅ Visual test waits for DOM content loaded

System waits for DOMContentLoaded event before proceeding

**How to use:**
Screenshots wait for the page DOM to be fully loaded.

**Expected Behavior:**
1. Step 1: Create visual test for page with deferred scripts
2. Step 2: Run the test
3. Step 3: Verify DOM elements are fully rendered in screenshot
4. Step 4: Check execution timing shows DOM wait

---

### ✅ Full page screenshot captures entire page height

Screenshot capture mode 'Full Page' captures from top to bottom of page

**How to use:**
Full page mode captures from the top to the bottom of the page.

**Expected Behavior:**
1. Step 1: Edit visual test
2. Step 2: Set capture mode to 'Full Page'
3. Step 3: Run test on page with 3000px height
4. Step 4: View captured screenshot
5. Step 5: Verify screenshot height is approximately 3000px
6. Step 6: Verify content at bottom of page is included

---

### ✅ Viewport-only screenshot captures visible area only

Screenshot capture mode 'Viewport Only' captures only the visible viewport

**How to use:**
Viewport mode captures only what is visible on screen.

**Expected Behavior:**
1. Step 1: Edit visual test
2. Step 2: Set capture mode to 'Viewport Only'
3. Step 3: Configure viewport 1920x1080
4. Step 4: Run test on page with 3000px height
5. Step 5: Verify screenshot dimensions are exactly 1920x1080
6. Step 6: Verify content below fold is NOT included

---

### ✅ Element screenshot captures specific element only

Screenshot capture can target a specific element by CSS selector

**How to use:**
Element mode captures a specific element by CSS selector.

**Expected Behavior:**
1. Step 1: Edit visual test
2. Step 2: Set capture mode to 'Element'
3. Step 3: Enter element selector: '.hero-banner'
4. Step 4: Run test
5. Step 5: Verify screenshot contains only the hero banner element
6. Step 6: Verify screenshot dimensions match element's bounding box

---

### ✅ Element screenshot validates selector exists

If configured element selector doesn't exist on page, test fails with clear error

**How to use:**
If the element selector does not exist, the test fails with a clear error.

**Expected Behavior:**
1. Step 1: Configure element screenshot with selector '.nonexistent-element'
2. Step 2: Run test
3. Step 3: Verify test fails
4. Step 4: Verify error message indicates selector not found
5. Step 5: Error message shows the selector that was attempted

---

### ✅ Screenshot stored in artifact storage after capture

Captured screenshot is uploaded and stored in configured artifact storage (MinIO/S3)

**How to use:**
Screenshots are stored in secure artifact storage after capture.

**Expected Behavior:**
1. Step 1: Run visual test
2. Step 2: Wait for test completion
3. Step 3: Verify screenshot artifact is listed in test results
4. Step 4: Verify screenshot has unique filename with timestamp
5. Step 5: Verify screenshot is downloadable via artifact URL

---

### ✅ Visual test runs across multiple viewports in single execution

User can configure visual test to capture screenshots at multiple viewports in one test run

**How to use:**
Run one test across multiple viewports to check responsive design.

**Expected Behavior:**
1. Step 1: Create visual test
2. Step 2: Enable 'Multi-viewport' mode
3. Step 3: Select Desktop, Tablet, and Mobile viewports
4. Step 4: Run the visual test
5. Step 5: Verify three separate screenshots captured (one per viewport)
6. Step 6: Confirm each screenshot has correct dimensions

---

### ✅ Visual test waits for custom selector before screenshot

User can specify a CSS selector that must be visible before screenshot is taken

**How to use:**
Wait for a specific element to appear before taking the screenshot.

**Expected Behavior:**
1. Step 1: Create visual test
2. Step 2: Set 'Wait for selector' to '.content-loaded'
3. Step 3: Run test against page where element appears after 2 seconds
4. Step 4: Verify screenshot includes the waited-for element
5. Step 5: Confirm screenshot timing waited for selector

---

### ✅ Visual test applies custom wait time before screenshot

User can specify additional delay (in ms) after page load before capturing screenshot

**How to use:**
Add extra delay before screenshot for animations to complete.

**Expected Behavior:**
1. Step 1: Create visual test
2. Step 2: Set 'Additional wait' to 2000ms
3. Step 3: Run test against page with animations
4. Step 4: Verify animations have completed in screenshot
5. Step 5: Confirm wait time was applied

---

### ✅ Visual test hides elements by selector before screenshot

User can specify CSS selectors for elements to hide (set visibility:hidden) before screenshot

**How to use:**
Hide dynamic elements (like ads) by CSS selector before screenshot.

**Expected Behavior:**
1. Step 1: Create visual test
2. Step 2: Add hide selector: '.cookie-banner, .chat-widget'
3. Step 3: Run the visual test
4. Step 4: Verify cookie banner and chat widget not visible in screenshot
5. Step 5: Confirm elements were hidden (space still occupied)

---

### ✅ Visual test removes elements by selector before screenshot

User can specify CSS selectors for elements to remove (set display:none) before screenshot

**How to use:**
Remove elements entirely from the page before screenshot.

**Expected Behavior:**
1. Step 1: Create visual test
2. Step 2: Add remove selector: '.ad-container'
3. Step 3: Run the visual test
4. Step 4: Verify ad container completely removed from screenshot
5. Step 5: Confirm layout adjusted as if element doesn't exist

---

### ✅ Pixelmatch performs pixel-by-pixel comparison

System uses pixelmatch library to compare baseline and current screenshots at pixel level

**How to use:**
Pixelmatch compares screenshots pixel-by-pixel for accuracy.

**Expected Behavior:**
1. Step 1: Establish baseline screenshot
2. Step 2: Make a 1-pixel change to the page (e.g., border color)
3. Step 3: Run visual test
4. Step 4: Verify pixelmatch detects the single pixel difference
5. Step 5: Confirm diff image highlights the changed pixel

---

### ✅ Visual diff calculates exact difference percentage

System calculates percentage of pixels that differ between baseline and current screenshot

**How to use:**
The diff percentage shows exactly how much changed between screenshots.

**Expected Behavior:**
1. Step 1: Have baseline with 1000x1000 = 1,000,000 pixels
2. Step 2: Make change affecting 10,000 pixels (1%)
3. Step 3: Run visual test
4. Step 4: Verify diff percentage shows 1.00%
5. Step 5: Confirm calculation is accurate to 2 decimal places

---

### ✅ Visual diff generates highlighted diff image

System generates third image showing changed pixels highlighted in magenta/red color

**How to use:**
Changed pixels are highlighted in the diff image for easy identification.

**Expected Behavior:**
1. Step 1: Run visual test with differences
2. Step 2: View diff artifacts
3. Step 3: Verify diff image exists alongside baseline and current
4. Step 4: Confirm changed pixels are highlighted in distinct color
5. Step 5: Verify unchanged pixels shown in grayscale for context

---

### ✅ Visual diff applies anti-aliasing tolerance

Pixelmatch ignores minor anti-aliasing differences that occur across browsers/renders

**How to use:**
Minor anti-aliasing differences are automatically ignored.

**Expected Behavior:**
1. Step 1: Configure visual test with anti-aliasing tolerance enabled (default)
2. Step 2: Run test where only anti-aliasing differs
3. Step 3: Verify these minor differences are ignored
4. Step 4: Confirm test passes despite anti-aliasing variations

---

### ✅ User configures diff threshold percentage for pass/fail

User sets acceptable difference threshold - test passes if diff below, fails if above

**How to use:**
Set a threshold percentage - tests pass if changes are below this level.

**Expected Behavior:**
1. Step 1: Create visual test
2. Step 2: Set diff threshold to 0.5%
3. Step 3: Run test with 0.3% difference - verify PASS
4. Step 4: Run test with 0.7% difference - verify FAIL
5. Step 5: Confirm threshold exactly at 0.5% results in PASS

---

### ✅ User configures absolute pixel count threshold

User can set maximum number of different pixels instead of percentage

**How to use:**
Set maximum pixel count instead of percentage for precise control.

**Expected Behavior:**
1. Step 1: Create visual test
2. Step 2: Set threshold mode to 'Pixel Count'
3. Step 3: Set max different pixels to 100
4. Step 4: Run test with 80 different pixels - verify PASS
5. Step 5: Run test with 150 different pixels - verify FAIL

---

### ✅ User defines rectangular ignore region by coordinates

User can mask rectangular area by specifying x, y, width, height to exclude from comparison

**How to use:**
Define rectangular regions to ignore by x, y, width, height.

**Expected Behavior:**
1. Step 1: Create visual test
2. Step 2: Add ignore region: x=100, y=200, width=300, height=150
3. Step 3: Make changes only within that region
4. Step 4: Run visual test
5. Step 5: Verify test passes - changes in region ignored

---

### ✅ Ignore regions shown visually in diff viewer

Diff viewer displays masked/ignored regions with visual indicator

**How to use:**
Ignored regions are visually marked in the diff viewer.

**Expected Behavior:**
1. Step 1: Run visual test with ignore regions
2. Step 2: Open diff viewer
3. Step 3: Verify ignored regions shown with overlay/hatching
4. Step 4: Confirm user can identify what was ignored

---

### ✅ First visual test run creates baseline automatically

When no baseline exists, first run captures and stores screenshot as baseline

**How to use:**
The first test run automatically creates the baseline screenshot.

**Expected Behavior:**
1. Step 1: Create new visual test (no prior runs)
2. Step 2: Run the visual test
3. Step 3: Verify test status shows 'Baseline Created'
4. Step 4: View baseline in test details
5. Step 5: Confirm baseline metadata includes timestamp and viewport

---

### ✅ User views current baseline screenshot

User can view the current approved baseline image for any visual test

**How to use:**
View the current baseline screenshot for any visual test.

**Expected Behavior:**
1. Step 1: Navigate to visual test details
2. Step 2: Click 'View Baseline' or 'Baseline' tab
3. Step 3: Verify baseline image displayed at full resolution
4. Step 4: Confirm image can be zoomed and inspected

---

### ✅ User approves new screenshot as baseline

When visual diff detected, user can approve new screenshot to replace baseline

**How to use:**
When changes are detected, approve to set the new screenshot as baseline.

**Expected Behavior:**
1. Step 1: Run visual test with intentional UI changes
2. Step 2: View failed test result with diff
3. Step 3: Click 'Approve as New Baseline' button
4. Step 4: Confirm approval in dialog
5. Step 5: Verify new screenshot is now the active baseline
6. Step 6: Run test again - verify it passes

---

### ✅ Baseline approval requires confirmation

Approving new baseline shows confirmation dialog to prevent accidental approval

**How to use:**
Baseline approval requires confirmation to prevent accidents.

**Expected Behavior:**
1. Step 1: View visual diff
2. Step 2: Click approve button
3. Step 3: Verify confirmation dialog appears
4. Step 4: Dialog shows old vs new baseline preview
5. Step 5: Must click 'Confirm' to complete approval

---

### ✅ Baseline approval records approver identity

System records which user approved the baseline and when

**How to use:**
Approval history shows who approved each baseline and when.

**Expected Behavior:**
1. Step 1: Approve new baseline as User A
2. Step 2: View baseline metadata
3. Step 3: Verify 'Approved by: User A' displayed
4. Step 4: Verify approval timestamp recorded

---

### ✅ User rejects visual changes

User can explicitly reject visual diff, marking it as regression

**How to use:**
Reject visual changes to mark them as regressions that need fixing.

**Expected Behavior:**
1. Step 1: View visual diff from failed test
2. Step 2: Click 'Reject Changes' button
3. Step 3: Optionally enter rejection reason
4. Step 4: Verify test marked as 'Rejected Regression'
5. Step 5: Baseline remains unchanged

---

### ✅ User batch approves multiple visual diffs

User can select and approve multiple pending visual changes at once

**How to use:**
Select multiple screenshots and approve them all at once.

**Expected Behavior:**
1. Step 1: Navigate to visual review queue with 5 pending changes
2. Step 2: Select 3 changes using checkboxes
3. Step 3: Click 'Batch Approve' button
4. Step 4: Confirm batch approval
5. Step 5: Verify all 3 baselines updated
6. Step 6: Verify 2 unselected changes still pending

---

### ✅ User batch rejects multiple visual diffs

User can select and reject multiple visual changes at once

**How to use:**
Select multiple screenshots and reject them all at once.

**Expected Behavior:**
1. Step 1: Navigate to visual review queue
2. Step 2: Select multiple changes
3. Step 3: Click 'Batch Reject'
4. Step 4: Enter shared rejection reason
5. Step 5: Verify all selected marked as rejected

---

### ✅ Baseline history preserved for audit

System maintains history of all baseline versions for each visual test

**How to use:**
Previous baseline versions are preserved for audit and rollback.

**Expected Behavior:**
1. Step 1: Approve baseline 3 times over several days
2. Step 2: Navigate to baseline history
3. Step 3: Verify all 3 versions listed with dates
4. Step 4: Click on any version to view that baseline
5. Step 5: Verify each version shows approver info

---

### ✅ User rollbacks to previous baseline version

User can restore previous baseline if current was approved in error

**How to use:**
Restore a previous baseline version if you accidentally approved the wrong screenshot.

**Expected Behavior:**
1. Step 1: View baseline history with multiple versions
2. Step 2: Select a previous version
3. Step 3: Click 'Restore as Current Baseline'
4. Step 4: Confirm rollback
5. Step 5: Verify selected version is now active baseline
6. Step 6: Run test and verify comparison uses restored baseline

---

### ✅ Branch-specific baselines supported

Different git branches can maintain separate baseline sets

**How to use:**
Different branches maintain separate baselines, so feature work does not affect main.

**Expected Behavior:**
1. Step 1: Create visual test on 'main' branch
2. Step 2: Approve baseline on 'main'
3. Step 3: Create 'feature-redesign' branch with UI changes
4. Step 4: Run test on feature branch - shows diff
5. Step 5: Approve baseline on feature branch
6. Step 6: Verify 'main' baseline unchanged
7. Step 7: Each branch has independent baseline

---

### ✅ Baseline merges when branches merge

When feature branch merged to main, user prompted to update main baseline

**How to use:**
When merging branches, you are prompted to decide which baseline to keep.

**Expected Behavior:**
1. Step 1: Have different baselines on main and feature branch
2. Step 2: Merge feature branch to main
3. Step 3: Run visual test on main
4. Step 4: System prompts to adopt feature branch baseline
5. Step 5: Approve to update main baseline

---

### ✅ Visual review queue lists all pending approvals

Centralized queue shows all visual diffs awaiting review across project

**How to use:**
View all pending visual approvals in one centralized queue.

**Expected Behavior:**
1. Step 1: Run multiple visual tests with changes
2. Step 2: Navigate to Visual Review Queue
3. Step 3: Verify all pending changes listed
4. Step 4: Each item shows: test name, diff %, viewport, timestamp
5. Step 5: Items sortable by diff % or date

---

### ✅ Visual review queue filterable by test suite

User can filter review queue to show only specific test suite

**How to use:**
Filter the review queue to focus on a specific test suite.

**Expected Behavior:**
1. Step 1: Have pending changes from multiple suites
2. Step 2: Open review queue
3. Step 3: Select filter for 'Homepage Suite'
4. Step 4: Verify only homepage visual tests shown
5. Step 5: Clear filter to see all again

---

### ✅ Visual review queue filterable by diff severity

User can filter to show only high-diff changes (e.g., >5%)

**How to use:**
Filter the queue to see only high-diff changes that need attention.

**Expected Behavior:**
1. Step 1: Have changes with various diff percentages
2. Step 2: Set filter to 'Diff > 5%'
3. Step 3: Verify only significant changes shown
4. Step 4: Low-diff changes hidden from view

---

### ✅ Visual test integrates as E2E test step

Visual checkpoint can be added within E2E test flow at any step

**How to use:**
Add visual checkpoints at any step within your E2E tests.

**Expected Behavior:**
1. Step 1: Edit E2E test
2. Step 2: Add step: 'Visual Checkpoint'
3. Step 3: Configure checkpoint name and options
4. Step 4: Run E2E test
5. Step 5: Verify visual comparison performed at that step
6. Step 6: E2E test fails if visual diff exceeds threshold

---

### ✅ Multiple visual checkpoints in single E2E test

E2E test can have multiple visual checkpoints at different steps

**How to use:**
Capture multiple screenshots at different points in a single E2E test.

**Expected Behavior:**
1. Step 1: Create E2E test with user journey
2. Step 2: Add checkpoint after login (Step 3)
3. Step 3: Add checkpoint after adding to cart (Step 7)
4. Step 4: Add checkpoint at checkout (Step 10)
5. Step 5: Run test - verify 3 separate visual comparisons
6. Step 6: Each checkpoint has own baseline

---

### ✅ Visual test results appear in test run dashboard

Visual test pass/fail and diff percentage shown in main results view

**How to use:**
Visual test results appear in the main test run dashboard with diff percentage.

**Expected Behavior:**
1. Step 1: Run test suite containing visual tests
2. Step 2: View test run dashboard
3. Step 3: Visual tests show pass/fail status
4. Step 4: Diff percentage displayed for each
5. Step 5: Click to open detailed diff viewer

---

### ✅ Visual test failure blocks PR merge

Visual test failures can be configured to block PR merging via status check

**How to use:**
Configure visual test failures to block PR merging in GitHub.

**Expected Behavior:**
1. Step 1: Configure visual tests as required status check
2. Step 2: Create PR with visual regression
3. Step 3: Visual test fails
4. Step 4: Verify PR merge blocked
5. Step 5: Approve baseline or fix regression
6. Step 6: PR becomes mergeable

---

### ✅ Lighthouse captures Speed Index metric

Speed Index metric showing how quickly content is visually displayed

**How to use:**
Speed Index measures how quickly content is visually displayed during load.

**Expected Behavior:**
1. Step 1: Run Lighthouse audit
2. Step 2: View performance results
3. Step 3: Find Speed Index metric
4. Step 4: Verify value shown in seconds

---

### ✅ Violations categorized as Moderate severity

Violations causing some difficulty marked Moderate

**How to use:**
Moderate violations cause some difficulty for users.

**Expected Behavior:**
1. Step 1: Run accessibility test
2. Step 2: View results
3. Step 3: Verify Moderate severity violations identified

---

### ✅ MCP tool: get-test-artifacts includes screenshots

Screenshots available in artifacts

**How to use:**
Screenshots are available for failed tests and visual diffs.

**Expected Behavior:**
1. Step 1: Run test that captures screenshots
2. Step 2: Call get-test-artifacts
3. Step 3: Verify screenshot artifacts present
4. Step 4: Type is 'screenshot', URL downloadable

**API Reference:**
```
Returns: { screenshots: [{ url, testId, step }] }
```

---

### ✅ Visual test name field validates input

Test name field enforces validation rules (required, min/max length, allowed characters)

**How to use:**
Test name is validated to ensure it is not empty or too long.

**Expected Behavior:**
1. Step 1: Leave test name empty and try to save - verify error shown
2. Step 2: Enter single character - verify minimum length error if applicable
3. Step 3: Enter 256+ characters - verify maximum length error
4. Step 4: Enter valid name 'Homepage Visual Test' - verify accepted
5. Step 5: Verify special characters handling (spaces, hyphens allowed)

---

### ✅ Custom wait selector configuration in test settings

User can configure a CSS selector to wait for before capturing screenshot

**How to use:**
Specify a CSS selector to wait for before capturing the screenshot.

**Expected Behavior:**
1. Step 1: Edit visual test settings
2. Step 2: Find 'Wait for selector' or 'Wait condition' field
3. Step 3: Enter selector: '#main-content.loaded'
4. Step 4: Save configuration
5. Step 5: Run test and verify it waits for that element before screenshot

---

### ✅ Additional delay before screenshot configuration

User can add extra delay (in ms) after page load before screenshot capture

**How to use:**
Add extra delay after page load for animations to complete.

**Expected Behavior:**
1. Step 1: Edit visual test settings
2. Step 2: Find 'Delay before capture' or 'Additional wait' field
3. Step 3: Enter 2000 (2 seconds)
4. Step 4: Save and run test
5. Step 5: Verify 2 second delay applied after page load, before screenshot

---

### ✅ Hide elements option accepts CSS selectors

User can specify elements to hide (visibility:hidden) before screenshot

**How to use:**
Enter CSS selectors for elements to hide before screenshot.

**Expected Behavior:**
1. Step 1: Edit visual test settings
2. Step 2: Find 'Hide elements' field
3. Step 3: Enter: '.cookie-popup, .chat-widget, #ad-banner'
4. Step 4: Save and run test
5. Step 5: Verify those elements are invisible in screenshot
6. Step 6: Verify layout space is still occupied (visibility:hidden not display:none)

---

### ✅ Remove elements option accepts CSS selectors

User can specify elements to remove (display:none) before screenshot

**How to use:**
Enter CSS selectors for elements to completely remove from the page.

**Expected Behavior:**
1. Step 1: Edit visual test settings
2. Step 2: Find 'Remove elements' field
3. Step 3: Enter: '.floating-cta, .promo-banner'
4. Step 4: Save and run test
5. Step 5: Verify those elements are completely gone from screenshot
6. Step 6: Verify layout has adjusted as if elements don't exist

---

### ✅ Screenshot filename includes test and viewport info

Screenshot filename is descriptive with test name, viewport, and timestamp

**How to use:**
Screenshot files are named with test name and viewport for easy identification.

**Expected Behavior:**
1. Step 1: Run visual test named 'Homepage Check' at Desktop viewport
2. Step 2: View stored screenshot filename
3. Step 3: Verify filename contains test identifier
4. Step 4: Verify filename contains viewport (e.g., 1920x1080)
5. Step 5: Verify filename contains timestamp or run ID

---

### ✅ First test run creates baseline automatically

When no baseline exists, first successful run creates the baseline screenshot

**How to use:**
The first run automatically saves the screenshot as the baseline.

**Expected Behavior:**
1. Step 1: Create new visual test (never run before)
2. Step 2: Run the test
3. Step 3: Verify test completes with status 'Baseline Created'
4. Step 4: Navigate to test baselines
5. Step 5: Verify baseline screenshot is displayed
6. Step 6: Verify baseline metadata shows creation timestamp

---

### ✅ Baseline created status displayed in results

Test result clearly indicates when a new baseline was created vs comparison

**How to use:**
Results show "Baseline Created" status on first run.

**Expected Behavior:**
1. Step 1: Run visual test for first time
2. Step 2: View test results
3. Step 3: Verify status badge shows 'Baseline Created' or similar
4. Step 4: Verify no diff percentage shown (nothing to compare)
5. Step 5: Verify helpful message explains baseline was established

---

### ✅ Subsequent runs compare against baseline

After baseline exists, subsequent runs compare current screenshot to baseline

**How to use:**
After baseline exists, every run compares against it.

**Expected Behavior:**
1. Step 1: Run visual test (baseline already exists)
2. Step 2: Wait for test completion
3. Step 3: Verify test performs comparison
4. Step 4: Verify diff percentage is calculated
5. Step 5: Verify test status reflects pass/fail based on threshold

---

### ✅ Pixelmatch comparison detects single pixel difference

The pixelmatch algorithm detects even a 1-pixel change between images

**How to use:**
Even a single pixel difference is detected by pixelmatch.

**Expected Behavior:**
1. Step 1: Establish baseline
2. Step 2: Change exactly 1 pixel on the page (e.g., single dot added)
3. Step 3: Run visual test
4. Step 4: Verify diff detected (diff count >= 1 pixel)
5. Step 5: Verify diff image highlights the changed pixel

---

### ✅ Pixelmatch comparison ignores anti-aliasing by default

Minor anti-aliasing differences between renders are ignored by default

**How to use:**
Minor anti-aliasing differences are automatically ignored.

**Expected Behavior:**
1. Step 1: Establish baseline
2. Step 2: Run test again (no page changes, just re-render)
3. Step 3: Verify any anti-aliasing differences are tolerated
4. Step 4: Verify test passes despite minor render variations

---

### ✅ Diff percentage calculated accurately

Diff percentage = (different pixels / total pixels) * 100, accurate to 2 decimals

**How to use:**
Diff percentage is calculated accurately based on total pixels.

**Expected Behavior:**
1. Step 1: Run test with known change affecting 1% of pixels
2. Step 2: View diff results
3. Step 3: Verify diff percentage shows approximately 1.00%
4. Step 4: Verify calculation is consistent across runs

---

### ✅ Diff percentage displayed in test results

Test results prominently display the calculated difference percentage

**How to use:**
The diff percentage is displayed prominently in test results.

**Expected Behavior:**
1. Step 1: Run visual test with some differences
2. Step 2: View test results summary
3. Step 3: Verify diff percentage shown (e.g., '2.34%')
4. Step 4: Verify percentage formatted consistently with 2 decimal places

---

### ✅ Diff image generated showing changed pixels

System generates a third 'diff' image highlighting pixels that changed

**How to use:**
A diff image highlights changed pixels in a distinct color.

**Expected Behavior:**
1. Step 1: Run visual test with differences
2. Step 2: View test artifacts
3. Step 3: Verify three images available: baseline, current, diff
4. Step 4: Verify diff image shows changed pixels in bright color (magenta/red)
5. Step 5: Verify unchanged pixels shown in grayscale for context

---

### ✅ Diff threshold percentage is configurable per test

Each visual test can have its own diff threshold percentage for pass/fail

**How to use:**
Set the acceptable diff threshold per test in settings.

**Expected Behavior:**
1. Step 1: Edit visual test settings
2. Step 2: Find 'Diff threshold' or 'Acceptable difference' field
3. Step 3: Set threshold to 0.5%
4. Step 4: Save configuration
5. Step 5: Verify threshold persisted in test settings

---

### ✅ Test passes when diff is below threshold

Visual test passes if calculated diff percentage is less than or equal to threshold

**How to use:**
Tests pass when the diff is below your configured threshold.

**Expected Behavior:**
1. Step 1: Configure test with 1% threshold
2. Step 2: Make change resulting in 0.5% diff
3. Step 3: Run test
4. Step 4: Verify test status is 'Passed'
5. Step 5: Verify result shows diff was within acceptable range

---

### ✅ Test fails when diff exceeds threshold

Visual test fails if calculated diff percentage is greater than threshold

**How to use:**
Tests fail when the diff exceeds your threshold.

**Expected Behavior:**
1. Step 1: Configure test with 0.5% threshold
2. Step 2: Make change resulting in 2% diff
3. Step 3: Run test
4. Step 4: Verify test status is 'Failed'
5. Step 5: Verify result indicates threshold exceeded

---

### ✅ Zero threshold requires pixel-perfect match

Setting threshold to 0% means any pixel difference fails the test

**How to use:**
Set threshold to 0 for pixel-perfect matching.

**Expected Behavior:**
1. Step 1: Configure test with 0% threshold
2. Step 2: Make any visible change to page
3. Step 3: Run test
4. Step 4: Verify test fails
5. Step 5: Verify 0 difference results in pass

---

### ✅ Multiple ignore regions can be defined

User can add multiple ignore regions to a single visual test

**How to use:**
Add multiple ignore regions for complex pages.

**Expected Behavior:**
1. Step 1: Edit visual test settings
2. Step 2: Add ignore region for '.ad-banner'
3. Step 3: Add ignore region for '#live-timestamp'
4. Step 4: Add ignore region for '.user-avatar'
5. Step 5: Save configuration
6. Step 6: Verify all three regions listed

---

### ✅ Changes within ignore region do not affect diff

Pixel changes within defined ignore regions are excluded from diff calculation

**How to use:**
Changes inside ignore regions do not affect the diff calculation.

**Expected Behavior:**
1. Step 1: Configure test with ignore region for '#timestamp'
2. Step 2: Establish baseline
3. Step 3: Timestamp changes on page
4. Step 4: Run visual test
5. Step 5: Verify diff is 0% (timestamp change ignored)
6. Step 6: Verify test passes

---

### ✅ Ignore regions visually indicated in diff viewer

Diff viewer shows which areas were ignored with visual overlay/hatching

**How to use:**
Ignored regions are visually marked in the diff viewer.

**Expected Behavior:**
1. Step 1: Run visual test with ignore regions configured
2. Step 2: Open diff viewer
3. Step 3: Verify ignored regions shown with semi-transparent overlay
4. Step 4: Verify overlay indicates 'Ignored' or similar label

---

### ✅ Baseline viewer displays current baseline image

User can view the current approved baseline screenshot in full resolution

**How to use:**
View the current baseline screenshot in the baseline viewer.

**Expected Behavior:**
1. Step 1: Navigate to visual test details
2. Step 2: Click 'Baseline' tab or 'View Baseline' button
3. Step 3: Verify baseline image displayed
4. Step 4: Verify image is full resolution and zoomable
5. Step 5: Verify baseline metadata shown (created date, approver)

---

### ✅ Baseline metadata includes creation timestamp

Baseline record shows when the baseline was created

**How to use:**
Baseline metadata shows when it was created.

**Expected Behavior:**
1. Step 1: View baseline details
2. Step 2: Find creation timestamp
3. Step 3: Verify date and time displayed
4. Step 4: Verify timezone information included

---

### ✅ Baseline metadata includes viewport dimensions

Baseline record shows viewport dimensions used when captured

**How to use:**
Baseline metadata shows the viewport dimensions used.

**Expected Behavior:**
1. Step 1: View baseline details
2. Step 2: Find viewport information
3. Step 3: Verify width x height displayed (e.g., 1920x1080)

---

### ✅ Approve new baseline button visible on failed visual test

When visual test fails, 'Approve as New Baseline' button is prominently displayed

**How to use:**
The Approve button appears on failed visual tests with changes.

**Expected Behavior:**
1. Step 1: Run visual test that fails due to diff
2. Step 2: View test results
3. Step 3: Verify 'Approve as New Baseline' button is visible
4. Step 4: Verify button is styled as primary action
5. Step 5: Verify button is near diff viewer for easy access

---

### ✅ Clicking approve baseline shows confirmation dialog

Approving baseline requires confirmation to prevent accidental approvals

**How to use:**
Confirmation dialog prevents accidental baseline approval.

**Expected Behavior:**
1. Step 1: Click 'Approve as New Baseline' button
2. Step 2: Verify confirmation dialog appears
3. Step 3: Verify dialog shows before/after preview
4. Step 4: Verify dialog has 'Confirm' and 'Cancel' buttons
5. Step 5: Verify dialog explains action being taken

---

### ✅ Confirming approval updates the baseline

Clicking confirm in dialog replaces old baseline with new screenshot

**How to use:**
Confirming sets the new screenshot as the baseline.

**Expected Behavior:**
1. Step 1: Click 'Approve as New Baseline'
2. Step 2: Click 'Confirm' in dialog
3. Step 3: Verify success message displayed
4. Step 4: View baseline - verify it shows new screenshot
5. Step 5: Run test again - verify it passes (comparing to new baseline)

---

### ✅ Canceling approval keeps old baseline

Clicking cancel in confirmation dialog aborts the approval

**How to use:**
Cancel keeps the old baseline unchanged.

**Expected Behavior:**
1. Step 1: Click 'Approve as New Baseline'
2. Step 2: Click 'Cancel' in dialog
3. Step 3: Verify dialog closes
4. Step 4: View baseline - verify old baseline still active
5. Step 5: Test still shows as failed

---

### ✅ Baseline approval records approver user

System records which user approved the baseline change

**How to use:**
Approval records who approved and when for audit.

**Expected Behavior:**
1. Step 1: Log in as 'user-a@example.com'
2. Step 2: Approve new baseline
3. Step 3: View baseline metadata
4. Step 4: Verify 'Approved by: user-a@example.com' displayed
5. Step 5: Verify approval timestamp recorded

---

### ✅ Reject changes button visible on failed visual test

Failed visual test shows 'Reject Changes' option alongside approve

**How to use:**
Reject button marks visual changes as regressions.

**Expected Behavior:**
1. Step 1: View failed visual test
2. Step 2: Verify 'Reject Changes' button is visible
3. Step 3: Verify button is secondary action (less prominent than approve)

---

### ✅ Rejecting changes marks test as regression

Clicking reject marks the visual diff as an unacceptable regression

**How to use:**
Rejecting marks the test as a regression that needs fixing.

**Expected Behavior:**
1. Step 1: Click 'Reject Changes'
2. Step 2: Optionally enter rejection reason
3. Step 3: Confirm rejection
4. Step 4: Verify test marked with 'Rejected Regression' status
5. Step 5: Verify baseline remains unchanged

---

### ✅ Baseline history shows all previous versions

System maintains and displays history of all baseline versions

**How to use:**
View all previous baseline versions in the history.

**Expected Behavior:**
1. Step 1: Approve baseline 3 times over time
2. Step 2: Navigate to baseline history
3. Step 3: Verify all 3 versions listed chronologically
4. Step 4: Each version shows timestamp and approver
5. Step 5: Versions numbered or dated for identification

---

### ✅ Can view any historical baseline version

User can click on historical baseline to view that screenshot

**How to use:**
Click any historical baseline to view it.

**Expected Behavior:**
1. Step 1: Navigate to baseline history
2. Step 2: Click on version from 2 weeks ago
3. Step 3: Verify that baseline screenshot is displayed
4. Step 4: Verify version metadata shown

---

### ✅ Can restore historical baseline as current

User can rollback to a previous baseline version

**How to use:**
Restore any historical baseline as the current one.

**Expected Behavior:**
1. Step 1: Navigate to baseline history
2. Step 2: Select version to restore
3. Step 3: Click 'Restore as Current'
4. Step 4: Confirm restoration
5. Step 5: Verify selected version is now active baseline
6. Step 6: Run test - verify comparison uses restored baseline

---

### ✅ Baseline restoration records the action in history

Restoring old baseline creates audit entry in history

**How to use:**
Restoration is recorded in the baseline history.

**Expected Behavior:**
1. Step 1: Restore historical baseline
2. Step 2: View baseline history
3. Step 3: Verify new entry shows 'Restored from version X'
4. Step 4: Entry includes who performed restoration

---

### ✅ Visual review queue accessible from sidebar

Navigation includes link to visual review queue

**How to use:**
Access the visual review queue from the sidebar menu.

**Expected Behavior:**
1. Step 1: View sidebar navigation
2. Step 2: Verify 'Visual Review' or 'Pending Approvals' link exists
3. Step 3: Click the link
4. Step 4: Verify visual review queue page loads

---

### ✅ Visual review queue lists all pending changes

Queue displays all visual tests with diffs awaiting review

**How to use:**
The queue lists all pending visual changes needing review.

**Expected Behavior:**
1. Step 1: Run 5 visual tests that all have diffs
2. Step 2: Navigate to visual review queue
3. Step 3: Verify all 5 pending changes listed
4. Step 4: Each item shows test name, project, diff %

---

### ✅ Review queue item shows thumbnail preview

Each queue item displays small thumbnail of the diff

**How to use:**
Thumbnail previews help you quickly identify changes.

**Expected Behavior:**
1. Step 1: View visual review queue
2. Step 2: Verify each item has thumbnail image
3. Step 3: Thumbnail shows diff or current screenshot
4. Step 4: Clicking thumbnail expands or opens detail view

---

### ✅ Review queue sortable by diff percentage

User can sort queue by diff percentage (highest first)

**How to use:**
Sort by diff percentage to review biggest changes first.

**Expected Behavior:**
1. Step 1: Have items with various diff percentages
2. Step 2: Click 'Diff %' column header
3. Step 3: Verify items sorted by diff descending
4. Step 4: Click again to reverse order

---

### ✅ Review queue sortable by date

User can sort queue by when the diff was detected

**How to use:**
Sort by date to review oldest changes first.

**Expected Behavior:**
1. Step 1: Have items from different dates
2. Step 2: Click 'Date' column header
3. Step 3: Verify items sorted chronologically
4. Step 4: Click again to reverse order

---

### ✅ Violation severity shown (Critical/Serious/Moderate/Minor)

Each violation displays severity level with visual indicator

**How to use:**
Each violation shows its severity level.

**Expected Behavior:**
1. Step 1: View accessibility violations
2. Step 2: Verify severity shown for each
3. Step 3: Critical = red, Serious = orange, Moderate = yellow, Minor = blue
4. Step 4: Violations grouped or sorted by severity

---

## 📋 Pending Features

### 📋 Baseline stored with metadata

Baseline screenshot stored with creation date, viewport, browser, creator info

**Expected Behavior:**
1. Step 1: Create baseline via first test run
2. Step 2: View baseline details
3. Step 3: Verify creation timestamp displayed
4. Step 4: Verify viewport dimensions shown
5. Step 5: Verify browser version recorded

---

### 📋 Diff image uses configurable highlight color

The color used to highlight differences can be configured

**Expected Behavior:**
1. Step 1: Navigate to visual test settings
2. Step 2: Find 'Diff highlight color' option
3. Step 3: Change from default magenta to red
4. Step 4: Run test with differences
5. Step 5: Verify diff image uses red for highlighting

---

### 📋 Project-level default threshold can be configured

Project settings include default diff threshold for all visual tests

**Expected Behavior:**
1. Step 1: Navigate to project settings
2. Step 2: Find 'Visual Testing' section
3. Step 3: Set default threshold to 0.1%
4. Step 4: Create new visual test
5. Step 5: Verify test inherits 0.1% threshold by default

---

### 📋 Baseline metadata includes browser info

Baseline record shows browser and version used during capture

**Expected Behavior:**
1. Step 1: View baseline details
2. Step 2: Find browser information
3. Step 3: Verify browser name and version shown (e.g., Chromium 120)

---

### 📋 Can compare historical baseline to current

User can compare historical baseline version to current baseline

**Expected Behavior:**
1. Step 1: Navigate to baseline history
2. Step 2: Select old version
3. Step 3: Click 'Compare to Current'
4. Step 4: Verify diff view shows old vs current baseline
5. Step 5: Verify diff percentage calculated

---

### 📋 Visual review queue shows count badge

Sidebar shows badge with number of pending visual approvals

**Expected Behavior:**
1. Step 1: Have 5 pending visual approvals
2. Step 2: View sidebar
3. Step 3: Verify badge shows '5' on Visual Review link
4. Step 4: Approve one
5. Step 5: Verify badge updates to '4'

---

