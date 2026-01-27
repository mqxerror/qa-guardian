# Other Features

> 97 features | 93 completed | 4 pending

[← Back to Index](../README.md)

---

## ✅ Completed Features

### ✅ Tab navigation through all interactive elements

Verify keyboard navigation works

**How to use:**
Press Tab to move between interactive elements. The app is fully keyboard accessible.

**Expected Behavior:**
1. Step 1: Navigate to dashboard
2. Step 2: Press Tab repeatedly
3. Step 3: Verify focus moves through all interactive elements
4. Step 4: Verify logical tab order
5. Step 5: Verify no elements skipped or trapped

---

### ✅ Focus ring visible on focused elements

Verify focus indicators are visible

**How to use:**
A visible focus ring shows which element is currently selected via keyboard.

**Expected Behavior:**
1. Step 1: Tab to a button element
2. Step 2: Verify visible focus ring appears
3. Step 3: Tab to input field
4. Step 4: Verify visible focus indicator
5. Step 5: Verify focus visible in both light and dark mode

---

### ✅ ARIA labels on icon buttons

Verify icon buttons are accessible

**How to use:**
Icon-only buttons have descriptive labels for screen readers.

**Expected Behavior:**
1. Step 1: Find icon-only button (e.g., delete trash icon)
2. Step 2: Inspect element
3. Step 3: Verify aria-label present (e.g., 'Delete test')
4. Step 4: Verify screen reader announces purpose

---

### ✅ Color contrast meets WCAG AA

Verify sufficient color contrast

**How to use:**
Color contrast meets WCAG AA standards for readability.

**Expected Behavior:**
1. Step 1: Use contrast checker tool
2. Step 2: Check primary text against background (4.5:1 minimum)
3. Step 3: Check secondary text contrast
4. Step 4: Check button text on button backgrounds
5. Step 5: Check in both light and dark mode

---

### ✅ Form fields have associated labels

Verify form accessibility

**How to use:**
All form fields have proper labels for screen reader users.

**Expected Behavior:**
1. Step 1: Navigate to form with multiple fields
2. Step 2: Inspect each input element
3. Step 3: Verify each has associated <label> or aria-label
4. Step 4: Verify clicking label focuses input

---

### ✅ Error messages announced to screen readers

Verify error accessibility

**How to use:**
Error messages are announced to screen readers automatically.

**Expected Behavior:**
1. Step 1: Submit form with errors
2. Step 2: Verify error messages have role='alert' or aria-live
3. Step 3: Verify errors are announced by screen reader
4. Step 4: Verify errors are associated with fields (aria-describedby)

---

### ✅ Images have alt text

Verify image accessibility

**How to use:**
All images have descriptive alt text for screen readers.

**Expected Behavior:**
1. Step 1: Navigate to page with images (screenshots, logos)
2. Step 2: Inspect img elements
3. Step 3: Verify alt attribute present
4. Step 4: Verify alt text is descriptive or empty for decorative

---

### ✅ Keyboard can operate all features

Verify full keyboard operability

**How to use:**
Every feature can be operated using only a keyboard, no mouse required.

**Expected Behavior:**
1. Step 1: Navigate using only keyboard
2. Step 2: Open dropdown with Enter/Space
3. Step 3: Navigate dropdown with arrows
4. Step 4: Select with Enter
5. Step 5: Close modal with Escape
6. Step 6: Verify all actions possible without mouse

---

### ✅ Two users edit same record

Verify conflict handling when two users edit simultaneously

**How to use:**
If two people edit the same item, the system handles the conflict gracefully.

**Expected Behavior:**
1. Step 1: User A opens test editor
2. Step 2: User B opens same test editor
3. Step 3: User A makes changes and saves
4. Step 4: User B makes different changes and saves
5. Step 5: Verify either last-write-wins or conflict warning shown
6. Step 6: Verify no data corruption

---

### ✅ Record deleted while viewing

Verify graceful handling when resource disappears

**How to use:**
If an item is deleted while you are viewing it, you see a helpful message.

**Expected Behavior:**
1. Step 1: User A views project detail page
2. Step 2: User B deletes the project
3. Step 3: User A attempts to save changes
4. Step 4: Verify error message: 'Project no longer exists'
5. Step 5: Verify no crash or hung state

---

### ✅ List updates during pagination

Verify pagination stability during changes

**How to use:**
Pagination remains stable even if items are added during viewing.

**Expected Behavior:**
1. Step 1: Navigate to page 2 of results
2. Step 2: Another process adds new results
3. Step 3: Click to page 3
4. Step 4: Verify pagination still works correctly
5. Step 5: Verify no missing or duplicate items

---

### ✅ Rapid navigation no stale data

Verify quick navigation doesn't show wrong data

**How to use:**
Quick navigation between pages shows fresh data, not stale cache.

**Expected Behavior:**
1. Step 1: Click Project A
2. Step 2: Immediately click Project B (before A loads)
3. Step 3: Verify Project B data displayed
4. Step 4: Verify Project A data not mistakenly shown
5. Step 5: Verify no race condition in data display

---

### ✅ API response after navigation

Verify late API responses don't cause issues

**How to use:**
Slow API responses after navigation are discarded to prevent confusion.

**Expected Behavior:**
1. Step 1: Navigate to slow-loading page
2. Step 2: Navigate away before load completes
3. Step 3: Verify no crash when delayed response arrives
4. Step 4: Verify old data doesn't appear on new page

---

### ✅ Concurrent form submissions from same user

Verify multiple rapid submissions handled

**How to use:**
Rapid form submissions from the same user are handled correctly.

**Expected Behavior:**
1. Step 1: Open form in two tabs as same user
2. Step 2: Submit both nearly simultaneously
3. Step 3: Verify appropriate handling
4. Step 4: Verify no duplicate records or corruption

---

### ✅ New form shows correct defaults

Verify form defaults are sensible

**How to use:**
New forms come with sensible defaults already filled in.

**Expected Behavior:**
1. Step 1: Open create test suite form
2. Step 2: Verify browser default is 'Chromium'
3. Step 3: Verify timeout default is reasonable (30s)
4. Step 4: Verify retry count default (0 or 1)

---

### ✅ Date picker defaults to today

Verify date pickers have sensible defaults

**How to use:**
Date pickers default to today for convenience.

**Expected Behavior:**
1. Step 1: Open schedule creation form
2. Step 2: Click on date picker
3. Step 3: Verify current date is highlighted/default
4. Step 4: Verify not defaulting to 1970-01-01

---

### ✅ Reset filters returns to default

Verify filter reset functionality

**How to use:**
Click "Reset Filters" to return to the default view.

**Expected Behavior:**
1. Step 1: Navigate to test results with filters available
2. Step 2: Apply status filter: 'Failed'
3. Step 3: Apply date filter: 'Last 7 days'
4. Step 4: Click 'Clear Filters' or reset
5. Step 5: Verify all filters reset to default
6. Step 6: Verify all results now shown

---

### ✅ Pagination resets on filter change

Verify page resets when filters change

**How to use:**
Changing filters resets you to page 1 automatically.

**Expected Behavior:**
1. Step 1: Navigate to page 3 of results
2. Step 2: Apply a new filter
3. Step 3: Verify pagination resets to page 1
4. Step 4: Verify URL reflects page 1

---

### ✅ Theme default matches system

Verify theme preference defaults correctly

**How to use:**
The theme defaults to your system preference (light/dark).

**Expected Behavior:**
1. Step 1: Register new user (fresh account)
2. Step 2: Verify theme follows system preference
3. Step 3: Navigate to settings
4. Step 4: Verify theme preference shows 'System'

---

### ✅ Double-click submit creates one record

Verify rapid submit clicks don't create duplicates

**How to use:**
Clicking Save multiple times quickly will only create one record.

**Expected Behavior:**
1. Step 1: Open create project form
2. Step 2: Fill in all required fields
3. Step 3: Rapidly double-click submit button
4. Step 4: Verify only one project created
5. Step 5: Verify submit button was disabled during processing

---

### ✅ Rapid delete clicks handled

Verify multiple delete clicks don't cause issues

**How to use:**
Clicking Delete multiple times will only delete once. No errors occur.

**Expected Behavior:**
1. Step 1: Navigate to item with delete button
2. Step 2: Rapidly click delete multiple times
3. Step 3: Verify only one deletion occurs
4. Step 4: Verify no errors from deleting non-existent item

---

### ✅ Submit button disabled during processing

Verify UI prevents double submission

**How to use:**
The Submit button is disabled during processing to prevent double submissions.

**Expected Behavior:**
1. Step 1: Open form with submit button
2. Step 2: Submit the form
3. Step 3: Verify button shows loading/disabled state
4. Step 4: Verify button re-enables after completion

---

### ✅ Back and resubmit handled

Verify form resubmission on back is handled

**How to use:**
Using the back button after form submission will not cause duplicates.

**Expected Behavior:**
1. Step 1: Submit create project form
2. Step 2: After success, press back button
3. Step 3: Press forward or resubmit
4. Step 4: Verify appropriate handling (error or new submission)
5. Step 5: Verify no corruption

---

### ✅ Concurrent API calls handled

Verify server handles simultaneous requests

**How to use:**
Simultaneous requests from your browser are handled correctly.

**Expected Behavior:**
1. Step 1: Open two browser tabs with same form
2. Step 2: Fill both forms with same data
3. Step 3: Submit both nearly simultaneously
4. Step 4: Verify server handles correctly (one success, one duplicate error)
5. Step 5: Verify database consistency

---

### ✅ Success toast on save

Verify success feedback for save actions

**How to use:**
Green toast notifications confirm successful actions like saving.

**Expected Behavior:**
1. Step 1: Create a new project
2. Step 2: Click save
3. Step 3: Verify success toast appears
4. Step 4: Verify toast message is specific ('Project created')
5. Step 5: Verify toast auto-dismisses after ~3-5 seconds

---

### ✅ Error toast on failure

Verify error feedback for failed actions

**How to use:**
Red toast notifications alert you to errors with details on what went wrong.

**Expected Behavior:**
1. Step 1: Attempt an action that will fail
2. Step 2: Verify error toast appears
3. Step 3: Verify error message is helpful
4. Step 4: Verify toast is dismissible

---

### ✅ Loading spinner during save

Verify loading indication during operations

**How to use:**
A spinner appears while saving to show the operation is in progress.

**Expected Behavior:**
1. Step 1: Click save on a form
2. Step 2: Verify loading spinner appears
3. Step 3: Verify button text changes to 'Saving...'
4. Step 4: Verify spinner disappears on completion

---

### ✅ Progress indicator for test run

Verify progress tracking for long operations

**How to use:**
Test run progress shows percentage complete and current step.

**Expected Behavior:**
1. Step 1: Start a suite run with multiple tests
2. Step 2: Verify progress indicator appears
3. Step 3: Verify percentage/count updates as tests complete
4. Step 4: Verify completion state clearly shown

---

### ✅ Multiple notifications don't overlap

Verify toast stacking behavior

**How to use:**
Multiple notifications stack neatly without overlapping.

**Expected Behavior:**
1. Step 1: Trigger multiple actions rapidly
2. Step 2: Verify multiple toasts appear
3. Step 3: Verify they stack properly (not overlapping)
4. Step 4: Verify each is dismissible independently

---

### ✅ Specific success messages

Verify messages are contextual not generic

**How to use:**
Success messages are specific: "Project created" not just "Success".

**Expected Behavior:**
1. Step 1: Create a test - verify 'Test created' message
2. Step 2: Delete a suite - verify 'Suite deleted' message
3. Step 3: Update settings - verify 'Settings saved' message
4. Step 4: Verify no generic 'Success' messages without context

---

### ✅ Page load under 3 seconds with 100 items

Verify performance with moderate data

**How to use:**
Pages load quickly even with hundreds of items.

**Expected Behavior:**
1. Step 1: Ensure 100 test results exist
2. Step 2: Clear browser cache
3. Step 3: Navigate to results list
4. Step 4: Measure time to interactive
5. Step 5: Verify under 3 seconds

---

### ✅ Search responds under 1 second

Verify search performance

**How to use:**
Search results appear within a second of typing.

**Expected Behavior:**
1. Step 1: Navigate to search
2. Step 2: Enter search term
3. Step 3: Measure time for results to appear
4. Step 4: Verify results appear in under 1 second

---

### ✅ No console errors during operation

Verify clean console output

**How to use:**
The app runs cleanly without console errors.

**Expected Behavior:**
1. Step 1: Open browser DevTools console
2. Step 2: Clear console
3. Step 3: Navigate through application
4. Step 4: Create, edit, delete items
5. Step 5: Verify no JavaScript errors in console

---

### ✅ Dashboard loads efficiently

Verify dashboard performance

**How to use:**
The dashboard loads efficiently with all widgets.

**Expected Behavior:**
1. Step 1: Navigate to organization dashboard
2. Step 2: Measure time to render all charts
3. Step 3: Verify charts render within 3 seconds
4. Step 4: Verify no layout jumps during load

---

### ✅ Empty search shows all results

Verify empty search query behavior

**How to use:**
Leave the search box empty to see all results.

**Expected Behavior:**
1. Step 1: Navigate to tests list
2. Step 2: Enter empty search (clear any text)
3. Step 3: Press enter or click search
4. Step 4: Verify all tests are displayed

---

### ✅ Search with only spaces

Verify whitespace-only search handled

**How to use:**
Searches with only spaces are treated as empty searches.

**Expected Behavior:**
1. Step 1: Enter '    ' (only spaces) in search
2. Step 2: Submit search
3. Step 3: Verify treated as empty search or error message
4. Step 4: Verify no crash

---

### ✅ Search with special characters

Verify special characters don't break search

**How to use:**
Special characters in search are handled safely without errors.

**Expected Behavior:**
1. Step 1: Search for test@#$%^&*()
2. Step 2: Verify no error/crash
3. Step 3: Verify appropriate results (none or matching)
4. Step 4: Verify no SQL injection

---

### ✅ Search with very long string

Verify long search queries handled

**How to use:**
Very long search queries are truncated but still work.

**Expected Behavior:**
1. Step 1: Enter 500+ character search string
2. Step 2: Submit search
3. Step 3: Verify no crash or timeout
4. Step 4: Verify appropriate response (no results or truncated)

---

### ✅ Filter combination with zero results

Verify helpful message for no results

**How to use:**
If no items match your filters, you will see a helpful "no results" message.

**Expected Behavior:**
1. Step 1: Apply multiple filters that result in no matches
2. Step 2: Verify 'No results match your filters' message
3. Step 3: Verify suggestion to modify filters
4. Step 4: Verify clear filters option visible

---

### ✅ Filter persists after viewing detail

Verify filters maintained when returning to list

**How to use:**
Your filters are remembered when you go to a detail page and come back.

**Expected Behavior:**
1. Step 1: Apply 'Failed' status filter to results
2. Step 2: Click on a result to view details
3. Step 3: Click back or breadcrumb to return to list
4. Step 4: Verify 'Failed' filter still applied
5. Step 5: Verify filtered results still showing

---

### ✅ Clear individual filter

Verify single filter can be cleared

**How to use:**
Click the X on any filter chip to remove just that filter.

**Expected Behavior:**
1. Step 1: Apply status filter 'Failed'
2. Step 2: Apply browser filter 'Chrome'
3. Step 3: Click X on status filter chip
4. Step 4: Verify only status filter cleared
5. Step 5: Verify browser filter still applied

---

### ✅ Search is case-insensitive

Verify search works regardless of case

**How to use:**
Search is case-insensitive. "Test" and "test" return the same results.

**Expected Behavior:**
1. Step 1: Create test named 'MyTestCase'
2. Step 2: Search for 'mytestcase' (lowercase)
3. Step 3: Verify test is found
4. Step 4: Search for 'MYTESTCASE' (uppercase)
5. Step 5: Verify test is found

---

### ✅ User notification preferences

Verify notification settings

**How to use:**
Configure which notifications you receive in Settings > Notifications.

**Expected Behavior:**
1. Step 1: Navigate to user settings
2. Step 2: Find notification preferences
3. Step 3: Toggle email notifications off
4. Step 4: Save settings
5. Step 5: Verify setting persisted
6. Step 6: Trigger notification and verify NOT sent via email

---

### ✅ Theme preference light/dark/system

Verify theme switching

**How to use:**
Choose Light, Dark, or System theme in Settings > Appearance.

**Expected Behavior:**
1. Step 1: Navigate to appearance settings
2. Step 2: Select 'Light' theme
3. Step 3: Verify UI switches to light mode
4. Step 4: Select 'Dark' theme
5. Step 5: Verify UI switches to dark mode
6. Step 6: Select 'System' and verify follows OS preference

---

### ✅ Default test timeout configuration

Verify timeout defaults

**How to use:**
Set default test timeout in Settings > Testing Defaults.

**Expected Behavior:**
1. Step 1: Navigate to organization settings
2. Step 2: Set default timeout to 60000ms
3. Step 3: Save settings
4. Step 4: Create new test
5. Step 5: Verify test inherits 60000ms timeout

---

### ✅ Default retry count configuration

Verify retry defaults

**How to use:**
Configure how many times failed tests retry by default.

**Expected Behavior:**
1. Step 1: Set default retry count to 2
2. Step 2: Save settings
3. Step 3: Create new suite
4. Step 4: Verify suite has retry count 2 by default

---

### ✅ Dates display in user timezone

Verify timezone handling for display

**How to use:**
All dates and times are displayed in your local timezone.

**Expected Behavior:**
1. Step 1: Set user timezone preference to 'America/New_York'
2. Step 2: View a test run created at specific UTC time
3. Step 3: Verify displayed time is in Eastern timezone
4. Step 4: Change preference to 'Europe/London'
5. Step 5: Verify time display updates accordingly

---

### ✅ Schedule runs at correct timezone

Verify scheduled runs respect timezone

**How to use:**
Scheduled tests run at the time you set in your timezone.

**Expected Behavior:**
1. Step 1: Create schedule for 9:00 AM 'America/Los_Angeles'
2. Step 2: Verify next run time displayed correctly
3. Step 3: Verify actual execution happens at 9:00 AM Pacific
4. Step 4: Verify not running at 9:00 AM UTC or server time

---

### ✅ Created timestamps accurate

Verify timestamp accuracy

**How to use:**
Timestamps show exactly when actions occurred.

**Expected Behavior:**
1. Step 1: Note current time
2. Step 2: Create a new project
3. Step 3: View project details
4. Step 4: Verify 'created_at' shows current time (within 1 min)
5. Step 5: Verify not showing future or past date

---

### ✅ Date filters work correctly

Verify date-based filtering

**How to use:**
Date filters work correctly across your timezone.

**Expected Behavior:**
1. Step 1: Create test runs across multiple days
2. Step 2: Apply 'Today' filter
3. Step 3: Verify only today's runs shown
4. Step 4: Apply 'Last 7 days' filter
5. Step 5: Verify runs from last 7 days shown
6. Step 6: Verify timezone-aware filtering

---

### ✅ Date sorting across months/years

Verify date sorting edge cases

**How to use:**
Dates sort correctly even across month and year boundaries.

**Expected Behavior:**
1. Step 1: Create test runs on Dec 31 and Jan 1
2. Step 2: Sort by date descending
3. Step 3: Verify Jan 1 (newer) appears first
4. Step 4: Verify no sorting bugs at month/year boundaries

---

### ✅ Dropdown options from database

Verify dropdowns are populated from real database data

**How to use:**
Dropdown menus are populated with your actual data from the database.

**Expected Behavior:**
1. Step 1: Create a project named 'TEST_PROJECT_DROPDOWN'
2. Step 2: Navigate to test creation form
3. Step 3: Verify project dropdown contains 'TEST_PROJECT_DROPDOWN'
4. Step 4: Delete the project
5. Step 5: Refresh the form
6. Step 6: Verify 'TEST_PROJECT_DROPDOWN' no longer in dropdown

---

### ✅ Browser selection from config

Verify browser options match backend configuration

**How to use:**
Browser options (Chrome, Firefox, Safari) are loaded from your configuration.

**Expected Behavior:**
1. Step 1: Navigate to test suite settings
2. Step 2: Open browser selection dropdown
3. Step 3: Verify Chromium, Firefox, WebKit options available
4. Step 4: Verify mobile emulation options available
5. Step 5: Save selection
6. Step 6: Verify selection persisted correctly

---

### ✅ Filter by status syncs with backend

Verify status filters return correct data from backend

**How to use:**
Status filters (Passed, Failed, Pending) query the database for accurate results.

**Expected Behavior:**
1. Step 1: Run tests until you have passed and failed results
2. Step 2: Apply 'Passed' filter
3. Step 3: Verify only passed results shown
4. Step 4: Apply 'Failed' filter
5. Step 5: Verify only failed results shown
6. Step 6: Verify counts match filter selections

---

### ✅ Sort functionality works with real data

Verify sorting sends correct parameters to backend

**How to use:**
Sorting by columns sends requests to the server for accurate sorted results.

**Expected Behavior:**
1. Step 1: Navigate to test runs list
2. Step 2: Click sort by 'Duration'
3. Step 3: Verify items sorted by duration ascending
4. Step 4: Click again for descending
5. Step 5: Verify order reversed
6. Step 6: Verify actual duration values are in correct order

---

### ✅ Deleting parent handles children

Verify cascading deletes work correctly

**How to use:**
Deleting a project automatically deletes all its test suites and tests.

**Expected Behavior:**
1. Step 1: Create project with suite and tests
2. Step 2: Delete the project
3. Step 3: Verify suite is also deleted
4. Step 4: Verify tests are also deleted
5. Step 5: Verify orphaned records don't exist in database

---

### ✅ Test result artifacts load correctly

Verify artifact references resolve to real files

**How to use:**
Screenshots and videos from test runs load from secure artifact storage.

**Expected Behavior:**
1. Step 1: Run a test that captures screenshots
2. Step 2: Navigate to test result
3. Step 3: Click on screenshot thumbnail
4. Step 4: Verify full-size image loads from storage
5. Step 5: Verify image is the actual captured screenshot

---

### ✅ API error responses parsed correctly

Verify frontend parses and displays API errors

**How to use:**
API errors are translated into user-friendly messages in the UI.

**Expected Behavior:**
1. Step 1: Submit form with validation errors
2. Step 2: Verify frontend receives 400 response
3. Step 3: Verify error message matches API response
4. Step 4: Verify field-specific errors mapped correctly

---

### ✅ Pagination returns correct page

Verify pagination offset/limit works with backend

**How to use:**
Pagination fetches the correct page of data from the server.

**Expected Behavior:**
1. Step 1: Create 25+ test results
2. Step 2: Navigate to results with page size 10
3. Step 3: Verify first 10 items shown
4. Step 4: Navigate to page 2
5. Step 5: Verify next 10 items shown
6. Step 6: Verify no duplicate items between pages

---

### ✅ Real-time WebSocket updates

Verify WebSocket delivers real-time test progress

**How to use:**
Test progress updates appear in real-time via WebSocket connection.

**Expected Behavior:**
1. Step 1: Open test run page in browser
2. Step 2: Start a test run
3. Step 3: Verify real-time status updates appear without refresh
4. Step 4: Verify progress percentage updates
5. Step 5: Verify completion notification appears

---

### ✅ Environment variables encrypted

Verify sensitive data is encrypted in backend

**How to use:**
Environment variables are encrypted before storage. Only you can access them.

**Expected Behavior:**
1. Step 1: Add environment variable with secret value
2. Step 2: Save project settings
3. Step 3: Verify secret masked in UI (****)
4. Step 4: Verify API response doesn't expose raw secret
5. Step 5: Verify secret works when test runs

---

### ✅ URL ID manipulation blocked

Verify changing entity IDs in URL doesn't expose other data

**How to use:**
URLs are protected. Changing IDs in the URL will not give access to other data.

**Expected Behavior:**
1. Step 1: Navigate to own project /projects/abc123
2. Step 2: Manually change URL to /projects/xyz789 (another user's)
3. Step 3: Verify 404 or 403 response
4. Step 4: Verify no data leakage

---

### ✅ Admin URL access blocked for non-admin

Verify direct admin URL access is protected

**How to use:**
Admin pages are protected. Direct URL access requires admin role.

**Expected Behavior:**
1. Step 1: Login as developer role
2. Step 2: Navigate directly to /admin/settings
3. Step 3: Verify 403 or redirect to dashboard
4. Step 4: Verify admin content not visible

---

### ✅ Malformed URL parameters handled

Verify invalid URL parameters don't crash app

**How to use:**
Invalid URL parameters are handled gracefully without crashing.

**Expected Behavior:**
1. Step 1: Navigate to /projects?page=abc (non-numeric)
2. Step 2: Verify no crash, appropriate fallback
3. Step 3: Navigate to /projects?page=-1
4. Step 4: Verify no crash, page 1 shown
5. Step 5: Navigate to /projects?page=99999999
6. Step 6: Verify no crash, empty or last page shown

---

### ✅ Deep link to deleted entity

Verify deleted resource URLs handled gracefully

**How to use:**
Links to deleted items show a friendly "not found" message.

**Expected Behavior:**
1. Step 1: Create and delete a project
2. Step 2: Note the project ID
3. Step 3: Navigate to /projects/{deleted-id}
4. Step 4: Verify 404 page displayed
5. Step 5: Verify helpful 'resource not found' message

---

### ✅ Tablet viewport preset sets 768x1024 dimensions

Selecting 'Tablet' viewport preset configures test for 768x1024 (portrait) resolution

**How to use:**
Tablet preset configures 768x1024 portrait resolution.

**Expected Behavior:**
1. Step 1: Create or edit visual test
2. Step 2: Select 'Tablet' from viewport dropdown
3. Step 3: Verify dimensions shown as 768 x 1024
4. Step 4: Save and verify configuration

---

### ✅ Mobile viewport preset sets 375x667 dimensions

Selecting 'Mobile' viewport preset configures test for 375x667 (iPhone SE) resolution

**How to use:**
Mobile preset configures 375x667 (iPhone SE) resolution.

**Expected Behavior:**
1. Step 1: Create or edit visual test
2. Step 2: Select 'Mobile' from viewport dropdown
3. Step 3: Verify dimensions shown as 375 x 667
4. Step 4: Save and verify configuration

---

### ✅ Custom viewport allows manual dimension entry

Selecting 'Custom' viewport reveals width and height input fields for manual entry

**How to use:**
Custom viewport lets you enter exact width and height values.

**Expected Behavior:**
1. Step 1: Create or edit visual test
2. Step 2: Select 'Custom' from viewport dropdown
3. Step 3: Verify width input field appears
4. Step 4: Verify height input field appears
5. Step 5: Enter width: 1440, height: 900
6. Step 6: Save and verify custom dimensions persisted

---

### ✅ Custom viewport validates dimension ranges

Custom viewport dimensions are validated for reasonable ranges (min 320, max 3840)

**How to use:**
Custom dimensions are validated (min 320px, max 3840px).

**Expected Behavior:**
1. Step 1: Select Custom viewport
2. Step 2: Enter width: 100 - verify minimum width error
3. Step 3: Enter width: 5000 - verify maximum width error
4. Step 4: Enter height: 100 - verify minimum height error
5. Step 5: Enter valid dimensions 1440x900 - verify accepted

---

### ✅ Clicking run test starts test execution

Clicking the run button initiates test execution and shows progress indicator

**How to use:**
Clicking run starts the test and shows a progress indicator.

**Expected Behavior:**
1. Step 1: Navigate to visual test details
2. Step 2: Click 'Run Test' button
3. Step 3: Verify button changes to loading/running state
4. Step 4: Verify progress indicator or spinner displayed
5. Step 5: Verify status shows 'Running' or similar

---

### ✅ User defines ignore region by CSS selector

User can mask elements by CSS selector - system calculates bounding box automatically

**How to use:**
Ignore dynamic content by CSS selector (e.g., .timestamp, .ad-banner).

**Expected Behavior:**
1. Step 1: Create visual test
2. Step 2: Add ignore selector: '#dynamic-timestamp'
3. Step 3: Page has changing timestamp in that element
4. Step 4: Run visual test multiple times
5. Step 5: Verify test always passes despite timestamp changes

---

### ✅ User defines multiple ignore regions

User can specify multiple regions/selectors to ignore in single test

**How to use:**
Add multiple ignore regions for complex pages.

**Expected Behavior:**
1. Step 1: Create visual test
2. Step 2: Add ignore selectors: '.timestamp', '.user-avatar', '.ad-slot'
3. Step 3: Make changes to all three elements
4. Step 4: Run visual test
5. Step 5: Verify all three regions ignored, test passes

---

### ✅ Desktop viewport preset sets 1920x1080 dimensions

Selecting 'Desktop' viewport preset configures test for 1920x1080 resolution

**How to use:**
Desktop preset sets 1920x1080 resolution.

**Expected Behavior:**
1. Step 1: Create or edit visual test
2. Step 2: Click viewport dropdown
3. Step 3: Select 'Desktop' preset
4. Step 4: Verify dimensions shown as 1920 x 1080
5. Step 5: Save test and verify configuration persisted

---

### ✅ Laptop viewport preset sets 1366x768 dimensions

Selecting 'Laptop' viewport preset configures test for 1366x768 resolution

**How to use:**
Laptop preset sets 1366x768 resolution.

**Expected Behavior:**
1. Step 1: Create or edit visual test
2. Step 2: Select 'Laptop' from viewport dropdown
3. Step 3: Verify dimensions shown as 1366 x 768
4. Step 4: Save and verify configuration

---

### ✅ Multi-viewport mode allows selecting multiple presets

User can enable multi-viewport mode to run test across multiple viewport sizes

**How to use:**
Select multiple viewports to test responsive design in one run.

**Expected Behavior:**
1. Step 1: Create or edit visual test
2. Step 2: Toggle 'Multi-viewport' or 'Run on multiple viewports' switch
3. Step 3: Verify viewport selection changes to multi-select checkboxes
4. Step 4: Check Desktop, Tablet, and Mobile
5. Step 5: Save and verify all three viewports configured

---

### ✅ Custom wait timeout configuration

User can configure maximum wait time for page load

**How to use:**
Set a maximum wait time for the selector to appear.

**Expected Behavior:**
1. Step 1: Edit visual test settings
2. Step 2: Find 'Wait timeout' field
3. Step 3: Set timeout to 30 seconds
4. Step 4: Save configuration
5. Step 5: Run test against slow page - verify timeout is respected

---

### ✅ Ignore region by rectangular coordinates

User can define rectangular ignore region by x, y, width, height coordinates

**How to use:**
Define rectangular ignore regions by x, y, width, height.

**Expected Behavior:**
1. Step 1: Edit visual test settings
2. Step 2: Click 'Add Ignore Region'
3. Step 3: Select 'Coordinates' mode
4. Step 4: Enter: x=100, y=200, width=300, height=150
5. Step 5: Save configuration
6. Step 6: Verify region appears in ignore list

---

### ✅ Ignore region by CSS selector

User can define ignore region by CSS selector - bounding box calculated automatically

**How to use:**
Ignore dynamic content by specifying CSS selectors.

**Expected Behavior:**
1. Step 1: Edit visual test settings
2. Step 2: Click 'Add Ignore Region'
3. Step 3: Select 'CSS Selector' mode
4. Step 4: Enter: '#timestamp-display'
5. Step 5: Save configuration
6. Step 6: Verify selector appears in ignore list

---

### ✅ Ignore region can be removed

User can delete previously configured ignore regions

**How to use:**
Remove ignore regions you no longer need.

**Expected Behavior:**
1. Step 1: Edit visual test with existing ignore region
2. Step 2: Find the ignore region in list
3. Step 3: Click delete/remove button on that region
4. Step 4: Confirm deletion
5. Step 5: Save configuration
6. Step 6: Verify region no longer in list

---

### ✅ Rejection reason is optional

User can reject changes without providing a reason

**How to use:**
Optionally provide a reason when rejecting changes.

**Expected Behavior:**
1. Step 1: Click 'Reject Changes'
2. Step 2: Leave reason field empty
3. Step 3: Click Confirm
4. Step 4: Verify rejection accepted without reason

---

### ✅ Rejection reason is recorded when provided

If user provides rejection reason, it's stored with the result

**How to use:**
Rejection reasons are saved for reference.

**Expected Behavior:**
1. Step 1: Click 'Reject Changes'
2. Step 2: Enter reason: 'Button color should not be red'
3. Step 3: Confirm rejection
4. Step 4: View result details
5. Step 5: Verify rejection reason is displayed

---

### ✅ Review queue filterable by test suite

User can filter queue to show only specific test suite

**How to use:**
Filter to show only a specific test suite.

**Expected Behavior:**
1. Step 1: Have pending items from multiple suites
2. Step 2: Select suite filter
3. Step 3: Choose 'Homepage Suite'
4. Step 4: Verify only that suite's items shown

---

### ✅ Batch select multiple itemsin review queue

User can select multiple queue items using checkboxes

**How to use:**
Select multiple items using checkboxes for batch actions.

**Expected Behavior:**
1. Step 1: View review queue with multiple items
2. Step 2: Verify each item has checkbox
3. Step 3: Check 3 items
4. Step 4: Verify selection count indicator shows '3 selected'
5. Step 5: Verify batch action buttons become visible

---

### ✅ Select all items in review queue

User can select all visible items at once

**How to use:**
Select all items in the queue with one click.

**Expected Behavior:**
1. Step 1: View review queue with multiple items
2. Step 2: Click 'Select All' checkbox in header
3. Step 3: Verify all visible items selected
4. Step 4: Selection count matches total items

---

### ✅ Batch approve selected items

User can approve multiple selected items at once

**How to use:**
Approve all selected items at once.

**Expected Behavior:**
1. Step 1: Select 3 items in review queue
2. Step 2: Click 'Batch Approve' button
3. Step 3: Confirm batch approval in dialog
4. Step 4: Verify all 3 items approved
5. Step 5: Verify items removed from queue

---

### ✅ Batch reject selected items

User can reject multiple selected items at once

**How to use:**
Reject all selected items at once.

**Expected Behavior:**
1. Step 1: Select 3 items in review queue
2. Step 2: Click 'Batch Reject' button
3. Step 3: Optionally enter shared reason
4. Step 4: Confirm batch rejection
5. Step 5: Verify all 3 items marked as rejected

---

### ✅ FCP metric displayed

First Contentful Paint timing is shown

**How to use:**
FCP (First Contentful Paint) is displayed.

**Expected Behavior:**
1. Step 1: View Lighthouse results
2. Step 2: Find FCP metric
3. Step 3: Verify value shown (e.g., '1.8s')

---

### ✅ Total Blocking Time metric displayed

TBT timing is shown in milliseconds

**How to use:**
Total Blocking Time shows main thread blocking.

**Expected Behavior:**
1. Step 1: View Lighthouse results
2. Step 2: Find TBT metric
3. Step 3: Verify value shown (e.g., '350ms')

---

### ✅ TTFB metric displayed

Time to First Byte is shown

**How to use:**
TTFB shows server response time.

**Expected Behavior:**
1. Step 1: View Lighthouse results
2. Step 2: Find TTFB metric
3. Step 3: Verify value shown (e.g., '180ms')

---

### ✅ Mobile preset applies mobile throttling

Selecting Mobile preset runs with CPU/network throttling

**How to use:**
Mobile preset applies throttling to simulate mobile devices.

**Expected Behavior:**
1. Step 1: Configure Lighthouse test with Mobile preset
2. Step 2: Run test
3. Step 3: Verify results reflect mobile throttling
4. Step 4: Scores typically lower than Desktop
5. Step 5: Metadata shows mobile configuration used

---

### ✅ Desktop preset runs without throttling

Selecting Desktop preset runs without throttling

**How to use:**
Desktop preset runs at full speed without throttling.

**Expected Behavior:**
1. Step 1: Configure Lighthouse test with Desktop preset
2. Step 2: Run test
3. Step 3: Verify no throttling applied
4. Step 4: Scores typically higher than Mobile
5. Step 5: Viewport is desktop-sized

---

### ✅ Real-time VU count displayed during run

While running, current VU count shown in real-time

**How to use:**
Virtual user count updates in real-time during execution.

**Expected Behavior:**
1. Step 1: Start K6 test with ramp stages
2. Step 2: View real-time dashboard
3. Step 3: Verify current VU count displayed
4. Step 4: Count updates as VUs ramp up/down

---

### ✅ Failed thresholds clearly indicated

When thresholds fail, specific failures are highlighted

**How to use:**
Failed thresholds are highlighted in red.

**Expected Behavior:**
1. Step 1: Run test that fails thresholds
2. Step 2: View results
3. Step 3: Verify failed thresholds listed
4. Step 4: Shows expected vs actual value

---

## 📋 Pending Features

### 📋 Test-level threshold overrides project default

Individual test threshold takes precedence over project default

**Expected Behavior:**
1. Step 1: Set project default threshold to 0.5%
2. Step 2: Create visual test
3. Step 3: Set test-specific threshold to 2%
4. Step 4: Run test with 1.5% diff
5. Step 5: Verify test passes (uses 2% threshold, not 0.5%)

---

### 📋 Review queue filterable by project

User can filter queue to show only specific project

**Expected Behavior:**
1. Step 1: Have pending items from multiple projects
2. Step 2: Select project filter
3. Step 3: Choose 'Project A'
4. Step 4: Verify only Project A items shown
5. Step 5: Clear filter to show all

---

### 📋 Real-time response time displayed during run

While running, response time percentiles shown in real-time

**Expected Behavior:**
1. Step 1: Start K6 test
2. Step 2: View real-time dashboard
3. Step 3: Verify response time metrics displayed
4. Step 4: Shows p50, p95, p99 updating live

---

### 📋 Real-time error rate displayed during run

While running, error percentage shown in real-time

**Expected Behavior:**
1. Step 1: Start K6 test
2. Step 2: View real-time dashboard
3. Step 3: Verify error rate % displayed
4. Step 4: Updates as errors occur

---

