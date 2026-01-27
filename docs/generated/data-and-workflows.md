# Data & Workflows

> 43 features | 43 completed | 0 pending

[← Back to Index](../README.md)

---

## ✅ Completed Features

### ✅ Delete project removes all suites

Verify cascade delete for project children

**How to use:**
Deleting a project removes all its test suites and tests automatically.

**Expected Behavior:**
1. Step 1: Create project with 3 test suites
2. Step 2: Note suite IDs
3. Step 3: Delete the project
4. Step 4: Attempt to access suite URLs directly
5. Step 5: Verify all suites return 404

---

### ✅ Delete suite removes from search results

Verify deleted items removed from search index

**How to use:**
Deleted items are immediately removed from all search results.

**Expected Behavior:**
1. Step 1: Create suite 'SEARCHABLE_SUITE_123'
2. Step 2: Search for 'SEARCHABLE_SUITE_123' - verify found
3. Step 3: Delete the suite
4. Step 4: Search again
5. Step 5: Verify no results found

---

### ✅ Delete updates statistics immediately

Verify dashboard counts update on delete

**How to use:**
Dashboard statistics update immediately after deletion.

**Expected Behavior:**
1. Step 1: Note total test count on dashboard
2. Step 2: Delete a test
3. Step 3: Refresh dashboard
4. Step 4: Verify count decreased by 1

---

### ✅ Delete member removes from project permissions

Verify removed user loses access immediately

**How to use:**
Removing a team member revokes their access immediately.

**Expected Behavior:**
1. Step 1: Add user to organization as developer
2. Step 2: Verify user can access projects
3. Step 3: Remove user from organization
4. Step 4: Have user attempt to access projects
5. Step 5: Verify access denied

---

### ✅ Delete organization removes all data

Verify complete cascade on organization delete

**How to use:**
Deleting an organization removes all projects, tests, and data permanently.

**Expected Behavior:**
1. Step 1: Create organization with projects, suites, tests
2. Step 2: Note all entity IDs
3. Step 3: Delete organization (with password confirmation)
4. Step 4: Verify all projects, suites, tests, members deleted
5. Step 5: Verify no orphaned records

---

### ✅ Required field empty blocks submit

Verify required validation

**How to use:**
Required fields are marked with *. The form will not submit until they are filled.

**Expected Behavior:**
1. Step 1: Open create project form
2. Step 2: Leave name field empty
3. Step 3: Fill other fields
4. Step 4: Click submit
5. Step 5: Verify form not submitted
6. Step 6: Verify error message on name field

---

### ✅ Email field validation

Verify email format validation

**How to use:**
Email fields must contain a valid email format (e.g., user@example.com).

**Expected Behavior:**
1. Step 1: Open registration form
2. Step 2: Enter 'notanemail' in email field
3. Step 3: Tab out or submit
4. Step 4: Verify email format error displayed
5. Step 5: Enter 'valid@email.com'
6. Step 6: Verify error clears

---

### ✅ Password complexity requirements

Verify password validation rules

**How to use:**
Passwords must meet complexity requirements: minimum length, mixed case, etc.

**Expected Behavior:**
1. Step 1: Open registration form
2. Step 2: Enter '12345' (too short)
3. Step 3: Verify minimum length error
4. Step 4: Enter 'password' (no uppercase/number)
5. Step 5: Verify complexity error
6. Step 6: Enter 'Password1' (valid)
7. Step 7: Verify no errors

---

### ✅ URL field validation

Verify URL format validation

**How to use:**
URL fields must contain valid URLs starting with http:// or https://.

**Expected Behavior:**
1. Step 1: Open project settings
2. Step 2: Enter 'not a url' in base URL field
3. Step 3: Verify URL format error
4. Step 4: Enter 'https://example.com'
5. Step 5: Verify error clears

---

### ✅ Numeric field rejects letters

Verify numeric input validation

**How to use:**
Numeric fields only accept numbers. Letters are automatically rejected.

**Expected Behavior:**
1. Step 1: Open suite settings
2. Step 2: Enter 'abc' in timeout field
3. Step 3: Verify either rejected or error shown
4. Step 4: Enter '30' (valid number)
5. Step 5: Verify accepted

---

### ✅ Max length enforcement

Verify character limits enforced

**How to use:**
Text fields have character limits. You will see a counter as you type.

**Expected Behavior:**
1. Step 1: Open create project form
2. Step 2: Enter 300 characters in name field (if max is 255)
3. Step 3: Verify either truncated or error shown
4. Step 4: Verify form indicates max length

---

### ✅ Duplicate unique value rejected

Verify unique constraint validation

**How to use:**
Unique fields (like project names) show an error if the value already exists.

**Expected Behavior:**
1. Step 1: Create project with slug 'my-project'
2. Step 2: Create another project
3. Step 3: Try to use slug 'my-project' again
4. Step 4: Verify error: 'Slug already exists'
5. Step 5: Verify first project unchanged

---

### ✅ Errors clear when user corrects input

Verify error messages update in real-time

**How to use:**
Error messages disappear automatically when you fix the input.

**Expected Behavior:**
1. Step 1: Enter invalid email
2. Step 2: See error message
3. Step 3: Correct the email to valid format
4. Step 4: Verify error message disappears
5. Step 5: Verify form can now be submitted

---

### ✅ Whitespace-only rejected for required

Verify spaces don't satisfy required

**How to use:**
Spaces-only inputs are not accepted for required fields.

**Expected Behavior:**
1. Step 1: Enter '   ' (only spaces) in required name field
2. Step 2: Submit form
3. Step 3: Verify validation error
4. Step 4: Verify not treated as valid input

---

### ✅ Server-side validation matches client

Verify consistent validation

**How to use:**
Validation rules are the same on the form and the server for consistency.

**Expected Behavior:**
1. Step 1: Bypass client validation (via API or DevTools)
2. Step 2: Submit invalid data directly to API
3. Step 3: Verify server returns same validation errors
4. Step 4: Verify no data corruption

---

### ✅ Created project appears in list

Verify newly created project with unique name appears in project list

**How to use:**
When you create a new project, it immediately appears in your project list.

**Expected Behavior:**
1. Step 1: Navigate to projects page
2. Step 2: Count existing projects
3. Step 3: Click create project
4. Step 4: Enter unique name: TEST_PROJ_{timestamp}
5. Step 5: Save project
6. Step 6: Verify project appears in list with exact name
7. Step 7: Verify project count increased by 1

---

### ✅ Created test suite persists after refresh

Verify test suite data persists after page refresh

**How to use:**
All data is saved to the database. Refreshing the page will show your saved work.

**Expected Behavior:**
1. Step 1: Create new test suite with unique name
2. Step 2: Verify suite appears in list
3. Step 3: Refresh the browser page
4. Step 4: Verify suite still appears with same name
5. Step 5: Verify suite configuration is preserved

---

### ✅ Data persists after logout and login

Verify created data persists across sessions

**How to use:**
Your data persists across sessions. Log out and back in - everything will be there.

**Expected Behavior:**
1. Step 1: Create a test with unique name TEST_{timestamp}
2. Step 2: Note the test ID and content
3. Step 3: Logout completely
4. Step 4: Login again
5. Step 5: Navigate to the test
6. Step 6: Verify test exists with same name and content

---

### ✅ Edited test changes persist after refresh

Verify test edits are saved to database

**How to use:**
Changes to tests are saved immediately when you click Save. Refresh to confirm.

**Expected Behavior:**
1. Step 1: Navigate to an existing test
2. Step 2: Click edit
3. Step 3: Change the test name to TEST_EDITED_{timestamp}
4. Step 4: Save changes
5. Step 5: Refresh the page
6. Step 6: Verify new name is displayed
7. Step 7: Verify old name is not displayed

---

### ✅ Deleted project removed from list and database

Verify delete actually removes data

**How to use:**
Deleted items are permanently removed from the database and all lists.

**Expected Behavior:**
1. Step 1: Create a new project TEST_DELETE_{timestamp}
2. Step 2: Note the project ID
3. Step 3: Delete the project
4. Step 4: Verify project not in list
5. Step 5: Navigate directly to /projects/{id}
6. Step 6: Verify 404 not found response

---

### ✅ Dashboard statistics reflect real counts

Verify dashboard shows accurate counts

**How to use:**
Dashboard statistics reflect actual data in your account in real-time.

**Expected Behavior:**
1. Step 1: Navigate to dashboard
2. Step 2: Note 'Total Tests' count
3. Step 3: Create 3 new tests
4. Step 4: Refresh dashboard
5. Step 5: Verify 'Total Tests' increased by exactly 3

---

### ✅ Search results match created data

Verify search finds actually created records

**How to use:**
Search finds records based on actual database content. Results match your data.

**Expected Behavior:**
1. Step 1: Create test with unique name SEARCHTEST_{timestamp}
2. Step 2: Navigate to test search/filter
3. Step 3: Search for 'SEARCHTEST_{timestamp}'
4. Step 4: Verify exactly one result
5. Step 5: Verify result matches created test

---

### ✅ Test run results are real not mock

Verify test execution produces real results

**How to use:**
Test results come from real Playwright executions, not mock data.

**Expected Behavior:**
1. Step 1: Create a simple test that navigates to a page
2. Step 2: Run the test
3. Step 3: Wait for completion
4. Step 4: View results
5. Step 5: Verify screenshot shows actual page content
6. Step 6: Verify execution time is realistic (not 0ms)
7. Step 7: Verify step results match actual test steps

---

### ✅ Deleted test removed from dropdowns

Verify deleted items are removed from all UI elements

**How to use:**
Deleted tests are removed from all dropdowns and selection lists immediately.

**Expected Behavior:**
1. Step 1: Create test TEST_DROPDOWN_{timestamp}
2. Step 2: Verify test appears in suite's test list
3. Step 3: Delete the test
4. Step 4: Navigate to run configuration
5. Step 5: Verify test is NOT in test selection dropdown

---

### ✅ Pass rate reflects actual test results

Verify analytics show real data

**How to use:**
Pass rates and analytics are calculated from actual test execution results.

**Expected Behavior:**
1. Step 1: Note current pass rate percentage
2. Step 2: Run 5 tests that pass
3. Step 3: Refresh analytics dashboard
4. Step 4: Verify pass rate calculation reflects new runs
5. Step 5: Run 2 tests that fail
6. Step 6: Verify pass rate updates accordingly

---

### ✅ Form data preserved on refresh

Verify appropriate form state handling on refresh

**How to use:**
Form data in progress is preserved if you accidentally refresh. Just continue where you left off.

**Expected Behavior:**
1. Step 1: Open create project form
2. Step 2: Fill in name and description
3. Step 3: Refresh the page
4. Step 4: Verify either data is preserved or form is reset with warning
5. Step 5: Verify no partial/corrupted state

---

### ✅ Session restored after browser close

Verify session handling on browser restart

**How to use:**
Close your browser and come back later - your session will be restored.

**Expected Behavior:**
1. Step 1: Login to application
2. Step 2: Note auth cookies/tokens
3. Step 3: Close browser completely
4. Step 4: Reopen browser and navigate to app
5. Step 5: Verify either still logged in or prompted to login

---

### ✅ Multi-tab consistency

Verify changes in one tab reflect in another

**How to use:**
Working in multiple tabs? Changes in one tab sync to others automatically.

**Expected Behavior:**
1. Step 1: Open application in Tab 1
2. Step 2: Open same page in Tab 2
3. Step 3: Create a project in Tab 1
4. Step 4: Refresh Tab 2
5. Step 5: Verify new project appears in Tab 2

---

### ✅ No duplicate submission on back button

Verify back button doesn't resubmit form

**How to use:**
Pressing back after form submission will not resubmit. Your data is safe.

**Expected Behavior:**
1. Step 1: Fill and submit create project form
2. Step 2: Verify project created successfully
3. Step 3: Press browser back button
4. Step 4: Verify no duplicate project created
5. Step 5: Verify form or list page displayed

---

### ✅ Bookmark and return later

Verify bookmarked pages work after session

**How to use:**
Bookmark any page and return to it later. Your access is preserved.

**Expected Behavior:**
1. Step 1: Navigate to specific test result page
2. Step 2: Bookmark the URL
3. Step 3: Logout
4. Step 4: Open bookmark URL
5. Step 5: Login when prompted
6. Step 6: Verify redirect to bookmarked page

---

### ✅ Unsaved changes warning

Verify warning when navigating away from dirty form

**How to use:**
If you have unsaved changes and try to leave, you will be warned first.

**Expected Behavior:**
1. Step 1: Open test editor
2. Step 2: Make changes to test steps
3. Step 3: Click to navigate away without saving
4. Step 4: Verify warning dialog appears
5. Step 5: Click cancel - verify stays on page
6. Step 6: Click confirm - verify navigation proceeds

---

### ✅ Create project via UI form

Verify complete project creation workflow

**How to use:**
Click "New Project" > fill in name and description > click "Create" to create a project.

**Expected Behavior:**
1. Step 1: Navigate to projects page
2. Step 2: Click 'New Project' button
3. Step 3: Fill in project name
4. Step 4: Fill in description
5. Step 5: Set base URL
6. Step 6: Click create/save button
7. Step 7: Verify success notification
8. Step 8: Verify redirect to new project page
9. Step 9: Verify project data matches input

---

### ✅ Create test suite via UI

Verify complete test suite creation workflow

**How to use:**
Inside a project, click "New Test Suite" > enter name > click "Create" to add a test suite.

**Expected Behavior:**
1. Step 1: Navigate to a project
2. Step 2: Click 'New Suite' button
3. Step 3: Enter suite name and description
4. Step 4: Configure browser settings
5. Step 5: Save suite
6. Step 6: Verify suite appears in project's suite list
7. Step 7: Verify configuration is saved

---

### ✅ Delete test with confirmation

Verify delete workflow with confirmation

**How to use:**
Click the trash icon on a test, confirm deletion in the dialog to remove it.

**Expected Behavior:**
1. Step 1: Navigate to test list
2. Step 2: Click delete on a test
3. Step 3: Verify confirmation dialog appears
4. Step 4: Click cancel
5. Step 5: Verify test still exists
6. Step 6: Click delete again
7. Step 7: Confirm deletion
8. Step 8: Verify test removed from list

---

### ✅ Run single test manually

Verify single test execution workflow

**How to use:**
Click the play button on any test to run it immediately. Results appear when complete.

**Expected Behavior:**
1. Step 1: Navigate to a test
2. Step 2: Click 'Run Test' button
3. Step 3: Verify run starts (status shows running)
4. Step 4: Wait for completion
5. Step 5: Verify results displayed
6. Step 6: Verify pass/fail status shown

---

### ✅ Run entire test suite

Verify suite execution workflow

**How to use:**
Click "Run All" on a test suite to execute all tests in the suite.

**Expected Behavior:**
1. Step 1: Navigate to test suite with multiple tests
2. Step 2: Click 'Run Suite' button
3. Step 3: Verify all tests queued
4. Step 4: Verify real-time progress updates
5. Step 5: Wait for completion
6. Step 6: Verify summary shows all test results

---

### ✅ Invite team member via email

Verify team invitation workflow

**How to use:**
Go to Team Settings > click "Invite" > enter email > select role > send invitation.

**Expected Behavior:**
1. Step 1: Navigate to team management
2. Step 2: Click 'Invite Member'
3. Step 3: Enter email address
4. Step 4: Select role (developer)
5. Step 5: Send invitation
6. Step 6: Verify invitation shows as pending
7. Step 7: Verify invitation email sent (or API shows invitation)

---

### ✅ Create and configure schedule

Verify schedule creation workflow

**How to use:**
Go to Schedules > "New Schedule" > set frequency > select test suite > save.

**Expected Behavior:**
1. Step 1: Navigate to test suite
2. Step 2: Go to Schedules tab
3. Step 3: Click 'Create Schedule'
4. Step 4: Enter schedule name
5. Step 5: Select frequency (daily)
6. Step 6: Set time and timezone
7. Step 7: Save schedule
8. Step 8: Verify schedule appears with next run time
9. Step 9: Verify schedule is active

---

### ✅ Cancel running test

Verify test cancellation workflow

**How to use:**
Click "Cancel" on a running test to stop execution. Partial results are preserved.

**Expected Behavior:**
1. Step 1: Start a long-running test
2. Step 2: Verify test shows 'running' status
3. Step 3: Click 'Cancel' button
4. Step 4: Verify test status changes to 'cancelled'
5. Step 5: Verify test execution stops

---

### ✅ Accept team invitation

Verify invitation acceptance workflow

**How to use:**
Click the invitation link in your email to join the team. No separate signup needed.

**Expected Behavior:**
1. Step 1: Create invitation for new email
2. Step 2: Note invitation token/link
3. Step 3: Navigate to invitation link
4. Step 4: Register/login with invited email
5. Step 5: Verify user joins organization with correct role
6. Step 6: Verify invitation marked as accepted

---

### ✅ Connect GitHub repository

Verify GitHub connection workflow

**How to use:**
Go to Project Settings > Integrations > GitHub > connect your repository.

**Expected Behavior:**
1. Step 1: Navigate to project settings
2. Step 2: Go to GitHub tab
3. Step 3: Click 'Connect Repository'
4. Step 4: Complete OAuth flow (or verify modal)
5. Step 5: Select repository from list
6. Step 6: Verify repository connected
7. Step 7: Verify test files discovered

---

### ✅ Create test via visual recorder

Verify complete test recording workflow

**How to use:**
Click "New Test" > "Visual Recorder" > enter URL > record actions > save to create tests visually.

**Expected Behavior:**
1. Step 1: Navigate to test suite
2. Step 2: Click 'Record New Test' button
3. Step 3: Enter target URL
4. Step 4: Perform click action on an element
5. Step 5: Perform type action in input field
6. Step 6: Add assertion step
7. Step 7: Stop recording
8. Step 8: Review recorded steps
9. Step 9: Save test
10. Step 10: Verify test appears in suite with recorded steps

---

### ✅ Edit test steps via drag-and-drop

Verify test step reordering works

**How to use:**
Drag and drop test steps to reorder them. Changes save automatically.

**Expected Behavior:**
1. Step 1: Open a test with 3+ steps
2. Step 2: Note original step order
3. Step 3: Drag step 3 to position 1
4. Step 4: Verify visual reorder
5. Step 5: Save changes
6. Step 6: Refresh page
7. Step 7: Verify new order persisted

---

