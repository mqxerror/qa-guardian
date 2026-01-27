# User Interface

> 53 features | 51 completed | 2 pending

[← Back to Index](../README.md)

---

## ✅ Completed Features

### ✅ Sidebar navigation to all main pages

Verify all sidebar menu items navigate to correct pages

**How to use:**
Use the sidebar menu to navigate between Dashboard, Projects, Test Suites, Results, and Settings.

**Expected Behavior:**
1. Step 1: Login as admin user
2. Step 2: Click Dashboard in sidebar - verify /dashboard loads
3. Step 3: Click Projects - verify /projects loads
4. Step 4: Click Team - verify /team loads
5. Step 5: Click Settings - verify /settings loads
6. Step 6: Verify each page title and content matches expected page

---

### ✅ Project list to project detail navigation

Verify clicking a project navigates to correct project detail page

**How to use:**
Click any project name in the project list to view its details, test suites, and settings.

**Expected Behavior:**
1. Step 1: Navigate to projects list
2. Step 2: Click on first project card/row
3. Step 3: Verify URL contains correct project ID
4. Step 4: Verify project name matches clicked project
5. Step 5: Verify breadcrumb shows correct project name

---

### ✅ Test suite to test detail navigation

Verify navigating from suite list to individual test works correctly

**How to use:**
Click a test suite to see all tests within it. Click individual tests to view their steps and history.

**Expected Behavior:**
1. Step 1: Navigate to a test suite
2. Step 2: View list of tests in suite
3. Step 3: Click on a specific test
4. Step 4: Verify URL contains correct test ID
5. Step 5: Verify test editor/detail page loads with correct test data

---

### ✅ Breadcrumb navigation works correctly

Verify breadcrumbs reflect path and are clickable

**How to use:**
Breadcrumbs at the top of the page show your location. Click any breadcrumb to jump back to that level.

**Expected Behavior:**
1. Step 1: Navigate to Projects > Project A > Suite B > Test C
2. Step 2: Verify breadcrumb shows: Dashboard > Projects > Project A > Suite B > Test C
3. Step 3: Click on 'Project A' in breadcrumb
4. Step 4: Verify navigation to Project A detail page
5. Step 5: Click browser back button
6. Step 6: Verify return to Test C page

---

### ✅ Back button works after navigation

Verify browser back button returns to previous page correctly

**How to use:**
Use your browser back button to return to previous pages. The app preserves your navigation history.

**Expected Behavior:**
1. Step 1: Navigate from Dashboard to Projects
2. Step 2: Click on a project to view details
3. Step 3: Click browser back button
4. Step 4: Verify Projects list is displayed
5. Step 5: Click back again
6. Step 6: Verify Dashboard is displayed

---

### ✅ 404 page for non-existent routes

Verify non-existent URLs show 404 page, not crash

**How to use:**
If you visit a page that does not exist, you will see a friendly 404 error page with a link to go home.

**Expected Behavior:**
1. Step 1: Navigate to /this-page-does-not-exist
2. Step 2: Verify 404 page is displayed
3. Step 3: Verify helpful message and link to home/dashboard
4. Step 4: Verify no console errors or white screen

---

### ✅ Login redirect to intended destination

Verify after login user is redirected to originally requested page

**How to use:**
After logging in, you will be automatically taken to the page you originally requested.

**Expected Behavior:**
1. Step 1: Navigate directly to /projects/123 while logged out
2. Step 2: Verify redirect to login with return URL preserved
3. Step 3: Login with valid credentials
4. Step 4: Verify redirect to /projects/123 (not dashboard)

---

### ✅ Logout redirects to login page

Verify logout properly redirects user

**How to use:**
After logging out, you are redirected to the login page for security.

**Expected Behavior:**
1. Step 1: Login to application
2. Step 2: Click logout button
3. Step 3: Verify redirect to /login page
4. Step 4: Verify login form is displayed

---

### ✅ Modal close returns to previous state

Verify closing modals returns user to correct state

**How to use:**
Click the X button or press Escape to close any modal and return to what you were doing.

**Expected Behavior:**
1. Step 1: Open test suite page
2. Step 2: Click 'Create Test' button
3. Step 3: Verify modal opens
4. Step 4: Click close/X button
5. Step 5: Verify modal closes and suite page is visible
6. Step 6: Verify no data lost or navigation changed

---

### ✅ Edit button navigates to correct test

Verify CRUD action buttons use correct IDs

**How to use:**
Click "Edit" next to any test to modify its configuration and steps.

**Expected Behavior:**
1. Step 1: Navigate to test suite with multiple tests
2. Step 2: Click edit on test #3 in the list
3. Step 3: Verify test editor opens with test #3 data
4. Step 4: Verify test name matches test #3
5. Step 5: Verify test steps are for test #3

---

### ✅ Delete navigates correctly after deletion

Verify after deleting an item, user is navigated appropriately

**How to use:**
After deleting an item, you are automatically navigated back to the parent list.

**Expected Behavior:**
1. Step 1: Navigate to a test detail page
2. Step 2: Click delete button
3. Step 3: Confirm deletion
4. Step 4: Verify redirect to test suite page (parent)
5. Step 5: Verify deleted test not in list

---

### ✅ Pagination links work correctly

Verify pagination navigates to correct page of results

**How to use:**
Use the pagination controls at the bottom of lists to navigate between pages of results.

**Expected Behavior:**
1. Step 1: Navigate to test runs list with 25+ items
2. Step 2: Verify page 1 is displayed
3. Step 3: Click page 2 link
4. Step 4: Verify different items displayed
5. Step 5: Verify URL reflects page=2
6. Step 6: Click previous page
7. Step 7: Verify return to page 1

---

### ✅ Deep linking to test results

Verify direct URL access to test results works

**How to use:**
Share direct links to specific test results. Recipients with access can view them directly.

**Expected Behavior:**
1. Step 1: Run a test and note the result ID
2. Step 2: Copy the direct URL to the result
3. Step 3: Open new browser window
4. Step 4: Login and navigate to direct URL
5. Step 5: Verify result detail page loads correctly

---

### ✅ Tab navigation within pages

Verify tabs within pages work correctly

**How to use:**
Many pages have tabs (e.g., Overview, Settings, History). Click tabs to switch between views.

**Expected Behavior:**
1. Step 1: Navigate to project detail page
2. Step 2: Verify default tab (Suites) is active
3. Step 3: Click Settings tab
4. Step 4: Verify Settings content displayed
5. Step 5: Click GitHub tab
6. Step 6: Verify GitHub integration content displayed
7. Step 7: Verify URL reflects current tab

---

### ✅ Organization switcher navigation

Verify organization switcher changes context correctly

**How to use:**
Use the organization dropdown in the header to switch between organizations you belong to.

**Expected Behavior:**
1. Step 1: Login as user with access to multiple organizations
2. Step 2: Verify current organization shown in switcher
3. Step 3: Click organization switcher
4. Step 4: Select different organization
5. Step 5: Verify dashboard updates to new organization
6. Step 6: Verify projects shown are from new organization

---

### ✅ Desktop layout at 1920px

Verify full desktop layout

**How to use:**
On desktop (1920px+), you see the full layout with sidebar always visible.

**Expected Behavior:**
1. Step 1: Set viewport to 1920x1080
2. Step 2: Navigate to dashboard
3. Step 3: Verify sidebar fully visible
4. Step 4: Verify content area properly sized
5. Step 5: Verify no horizontal scrollbar
6. Step 6: Verify no overlapping elements

---

### ✅ Tablet layout at 768px

Verify tablet-sized layout

**How to use:**
On tablets (768px), the layout adapts with a collapsible sidebar.

**Expected Behavior:**
1. Step 1: Set viewport to 768x1024
2. Step 2: Verify sidebar collapses to icons or hamburger
3. Step 3: Verify content area adapts
4. Step 4: Verify tables may scroll horizontally
5. Step 5: Verify touch targets adequate size

---

### ✅ Mobile layout at 375px

Verify mobile layout

**How to use:**
On mobile (375px), the interface is optimized for touch with a hamburger menu.

**Expected Behavior:**
1. Step 1: Set viewport to 375x667 (iPhone SE)
2. Step 2: Verify hamburger menu for navigation
3. Step 3: Verify content stacks vertically
4. Step 4: Verify no horizontal scroll on main content
5. Step 5: Verify forms usable on mobile

---

### ✅ No horizontal scroll on standard viewports

Verify no unexpected horizontal scroll

**How to use:**
The layout is designed to never require horizontal scrolling on standard screens.

**Expected Behavior:**
1. Step 1: Check 1920px viewport - no h-scroll
2. Step 2: Check 1440px viewport - no h-scroll
3. Step 3: Check 1024px viewport - no h-scroll
4. Step 4: Check 768px viewport - no h-scroll
5. Step 5: Check 375px viewport - no h-scroll (except tables)

---

### ✅ Touch targets minimum 44px

Verify touch-friendly button sizes

**How to use:**
All buttons and touch targets are at least 44px for easy tapping on mobile.

**Expected Behavior:**
1. Step 1: Inspect button elements on mobile viewport
2. Step 2: Verify minimum height 44px
3. Step 3: Verify minimum width 44px for icon buttons
4. Step 4: Verify adequate spacing between touch targets

---

### ✅ Modals fit viewport on mobile

Verify modals are usable on small screens

**How to use:**
Modal dialogs resize to fit smaller screens so all content is accessible.

**Expected Behavior:**
1. Step 1: Set mobile viewport
2. Step 2: Open a modal dialog
3. Step 3: Verify modal fits within viewport
4. Step 4: Verify modal content scrollable if needed
5. Step 5: Verify close button accessible

---

### ✅ Long text truncates properly

Verify text overflow handling

**How to use:**
Long text is truncated with "..." to maintain clean layouts.

**Expected Behavior:**
1. Step 1: Create project with very long name (100+ chars)
2. Step 2: View in projects list
3. Step 3: Verify text truncates with ellipsis
4. Step 4: Verify no layout breaking
5. Step 5: Verify full text visible on hover or detail view

---

### ✅ Tables horizontally scroll on mobile

Verify data tables are usable on mobile

**How to use:**
Data tables scroll horizontally on mobile so you can see all columns.

**Expected Behavior:**
1. Step 1: Set mobile viewport
2. Step 2: Navigate to results table with many columns
3. Step 3: Verify table is horizontally scrollable
4. Step 4: Verify scroll indicators visible
5. Step 5: Verify no content cut off

---

### ✅ Sidebar collapse and expand

Verify sidebar behavior

**How to use:**
Click the hamburger icon to collapse/expand the sidebar.

**Expected Behavior:**
1. Step 1: Click sidebar collapse button
2. Step 2: Verify sidebar collapses to icons only
3. Step 3: Verify main content area expands
4. Step 4: Click expand button
5. Step 5: Verify sidebar fully visible again

---

### ✅ Data table sorting

Verify table column sorting

**How to use:**
Click column headers to sort tables by that column.

**Expected Behavior:**
1. Step 1: Navigate to data table (test runs)
2. Step 2: Click 'Date' column header
3. Step 3: Verify ascending sort applied
4. Step 4: Click again for descending
5. Step 5: Verify sort indicator shows direction

---

### ✅ Data table filtering

Verify inline table filters

**How to use:**
Use the filter row above tables for quick filtering.

**Expected Behavior:**
1. Step 1: Navigate to data table
2. Step 2: Use status filter dropdown
3. Step 3: Select 'Failed'
4. Step 4: Verify table updates to show only failed
5. Step 5: Clear filter and verify all shown

---

### ✅ Toast notification auto-dismiss

Verify toast behavior

**How to use:**
Toast notifications dismiss automatically after a few seconds.

**Expected Behavior:**
1. Step 1: Trigger success action
2. Step 2: Verify toast appears
3. Step 3: Wait 3-5 seconds
4. Step 4: Verify toast auto-dismisses
5. Step 5: Verify can manually dismiss before timeout

---

### ✅ Empty state with action

Verify empty state UX

**How to use:**
Empty states show helpful messages and action buttons.

**Expected Behavior:**
1. Step 1: Navigate to new project with no tests
2. Step 2: Verify empty state displayed
3. Step 3: Verify helpful message shown
4. Step 4: Verify 'Create Test' action button visible
5. Step 5: Click button and verify navigation to create form

---

### ✅ Data table pagination

Verify table pagination controls

**How to use:**
Navigate between pages using the pagination controls.

**Expected Behavior:**
1. Step 1: Navigate to table with 25+ items
2. Step 2: Verify pagination controls visible
3. Step 3: Click next page
4. Step 4: Verify different items shown
5. Step 5: Change page size to 50
6. Step 6: Verify more items per page

---

### ✅ Actual size (100%) zoom option

User can view screenshot at actual pixel dimensions

**How to use:**
Style feature: View screenshots at actual size (100% zoom).

**Expected Behavior:**
1. Step 1: View screenshot at any zoom level
2. Step 2: Click '100%' or 'Actual Size' button
3. Step 3: Verify image at 1:1 pixel ratio
4. Step 4: Can see exact pixel details

---

### ✅ Side-by-side comparison view in diff viewer

Diff viewer shows baseline and current screenshots side by side

**How to use:**
Compare baseline and current screenshots side by side.

**Expected Behavior:**
1. Step 1: Open visual diff for a test
2. Step 2: Verify side-by-side layout displayed
3. Step 3: Baseline on left labeled 'Baseline'
4. Step 4: Current on right labeled 'Current'
5. Step 5: Both images aligned and same size

---

### ✅ Overlay slider comparison mode

Diff viewer provides draggable slider to blend between baseline and current

**How to use:**
Use the slider to smoothly blend between baseline and current views.

**Expected Behavior:**
1. Step 1: Open diff viewer
2. Step 2: Click 'Slider' view mode
3. Step 3: Drag slider left - see more baseline
4. Step 4: Drag slider right - see more current
5. Step 5: Slider reveals differences interactively

---

### ✅ Onion skin overlay mode

Diff viewer can overlay current on baseline with adjustable opacity

**How to use:**
Overlay current on baseline with adjustable transparency to spot changes.

**Expected Behavior:**
1. Step 1: Open diff viewer
2. Step 2: Click 'Onion Skin' view mode
3. Step 3: Adjust opacity slider
4. Step 4: At 50% see blended view of both
5. Step 5: Differences visible as ghosting/blur

---

### ✅ Diff highlight overlay mode

Viewer can show diff image overlaid to highlight exactly what changed

**How to use:**
See exactly which pixels changed with the diff highlight overlay.

**Expected Behavior:**
1. Step 1: Open diff viewer
2. Step 2: Click 'Show Diff Overlay'
3. Step 3: Verify changed pixels highlighted in color
4. Step 4: Toggle overlay on/off
5. Step 5: Changed areas clearly visible

---

### ✅ Screenshot zoom controls in viewer

User can zoom in/out to inspect screenshots in detail

**How to use:**
Zoom in/out to inspect screenshot details closely.

**Expected Behavior:**
1. Step 1: Open screenshot in diff viewer
2. Step 2: Click zoom in button or use scroll wheel
3. Step 3: Verify image magnifies
4. Step 4: Zoom to 200%, 400% levels
5. Step 5: Zoom indicator shows current level

---

### ✅ Screenshot pan/drag navigation

When zoomed in, user can pan/drag to navigate around screenshot

**How to use:**
When zoomed in, drag to pan around the screenshot.

**Expected Behavior:**
1. Step 1: Zoom into screenshot to 300%
2. Step 2: Click and drag to pan
3. Step 3: Navigate to different areas of image
4. Step 4: Both baseline and current pan together (synced)

---

### ✅ Fit-to-screen zoom option

User can click to fit entire screenshot within viewport

**How to use:**
Click "Fit to Screen" to see the entire screenshot at once.

**Expected Behavior:**
1. Step 1: Zoom to high magnification
2. Step 2: Click 'Fit to Screen' button
3. Step 3: Verify entire screenshot visible
4. Step 4: Image scaled to fit container

---

### ✅ Diff viewer opens in modal or dedicated page

Clicking on visual diff opens detailed diff viewer

**How to use:**
Open the diff viewer in a modal or full page for detailed review.

**Expected Behavior:**
1. Step 1: Click on pending visual diff
2. Step 2: Verify diff viewer opens (modal or page)
3. Step 3: Viewer takes focus for detailed review
4. Step 4: Can close/navigate back to queue

---

### ✅ Diff viewer shows baseline image on left

Side-by-side view displays baseline (expected) on left side

**How to use:**
Baseline image appears on the left side.

**Expected Behavior:**
1. Step 1: Open diff viewer for visual test
2. Step 2: Verify left image is labeled 'Baseline' or 'Expected'
3. Step 3: Verify image is the approved baseline screenshot

---

### ✅ Diff viewer shows current image on right

Side-by-side view displays current (actual) on right side

**How to use:**
Current screenshot appears on the right side.

**Expected Behavior:**
1. Step 1: Open diff viewer
2. Step 2: Verify right image is labeled 'Current' or 'Actual'
3. Step 3: Verify image is from latest test run

---

### ✅ Diff viewer has view mode selector

Viewer has buttons/tabs to switch between comparison modes

**How to use:**
Switch between different comparison modes using the selector.

**Expected Behavior:**
1. Step 1: Open diff viewer
2. Step 2: Verify mode selector is visible
3. Step 3: Verify options include: Side-by-side, Slider, Overlay, Diff
4. Step 4: Can click to switch modes

---

### ✅ Slider comparison mode shows draggable divider

Slider mode overlays images with draggable divider line

**How to use:**
Slider mode shows a draggable divider between images.

**Expected Behavior:**
1. Step 1: Open diff viewer
2. Step 2: Select 'Slider' mode
3. Step 3: Verify images overlaid with vertical divider
4. Step 4: Verify divider is draggable
5. Step 5: Left of divider shows baseline, right shows current

---

### ✅ Dragging slider reveals differences

Moving slider back and forth clearly shows what changed

**How to use:**
Drag the slider to reveal differences.

**Expected Behavior:**
1. Step 1: Open slider comparison mode
2. Step 2: Position slider at a changed area
3. Step 3: Drag slider left and right
4. Step 4: Verify the change is visible as slider moves
5. Step 5: Can pinpoint exact boundary of change

---

### ✅ Overlay mode shows adjustable opacity blend

Overlay/onion-skin mode blends images with adjustable opacity

**How to use:**
Overlay mode blends images with adjustable transparency.

**Expected Behavior:**
1. Step 1: Open diff viewer
2. Step 2: Select 'Overlay' or 'Onion Skin' mode
3. Step 3: Verify opacity slider is visible
4. Step 4: Adjust opacity
5. Step 5: See blend of baseline and current

---

### ✅ Diff mode shows only changed pixels highlighted

Diff mode displays the generated diff image with highlighted changes

**How to use:**
Diff mode highlights only the changed pixels.

**Expected Behavior:**
1. Step 1: Open diff viewer
2. Step 2: Select 'Diff' or 'Changes Only' mode
3. Step 3: Verify diff image displayed
4. Step 4: Changed pixels highlighted in bright color
5. Step 5: Unchanged areas in grayscale

---

### ✅ Zoom controls visible in diff viewer

Diff viewer has zoom in, zoom out, and fit-to-screen buttons

**How to use:**
Zoom controls are visible in the diff viewer toolbar.

**Expected Behavior:**
1. Step 1: Open diff viewer
2. Step 2: Verify zoom controls visible (+ / - buttons)
3. Step 3: Verify 'Fit' button visible
4. Step 4: Verify current zoom level indicator

---

### ✅ Zoom in magnifies images

Clicking zoom in increases magnification level

**How to use:**
Click + to zoom in and magnify the images.

**Expected Behavior:**
1. Step 1: Open diff viewer at 100% zoom
2. Step 2: Click zoom in button
3. Step 3: Verify zoom increases to 150% or 200%
4. Step 4: Images appear larger
5. Step 5: Zoom level indicator updates

---

### ✅ Zoom out reduces magnification

Clicking zoom out decreases magnification level

**How to use:**
Click - to zoom out and see more of the image.

**Expected Behavior:**
1. Step 1: Zoom to 200%
2. Step 2: Click zoom out button
3. Step 3: Verify zoom decreases
4. Step 4: Images appear smaller

---

### ✅ Mouse wheel zooms images

Scrolling mouse wheel while holding modifier key zooms

**How to use:**
Use mouse wheel to zoom in and out.

**Expected Behavior:**
1. Step 1: Open diff viewer
2. Step 2: Hold Ctrl/Cmd key
3. Step 3: Scroll mouse wheel up
4. Step 4: Verify image zooms in
5. Step 5: Scroll down to zoom out

---

### ✅ Fit to screen shows entire image

Fit button scales image to fit within viewer container

**How to use:**
Click "Fit" to see the entire image on screen.

**Expected Behavior:**
1. Step 1: Zoom to high magnification
2. Step 2: Click 'Fit' button
3. Step 3: Verify entire image visible
4. Step 4: Image scaled to fit container dimensions

---

### ✅ Pan by dragging when zoomed in

When zoomed, can clickand drag to pan around image

**How to use:**
Drag to pan around when zoomed in.

**Expected Behavior:**
1. Step 1: Zoom to 300%
2. Step 2: Click and hold on image
3. Step 3: Drag to pan left/right/up/down
4. Step 4: View moves to show different parts of image

---

## 📋 Pending Features

### 📋 Diff viewer images are synchronized for scrolling

Scrolling one image scrolls the other to same position

**Expected Behavior:**
1. Step 1: Open diff viewer with tall screenshots
2. Step 2: Scroll down on left image
3. Step 3: Verify right image scrolls to same position
4. Step 4: Both images show same area of page

---

### 📋 100% zoom shows actual pixels

Clicking 100% or Actual Size shows 1:1 pixel ratio

**Expected Behavior:**
1. Step 1: Open diff viewer
2. Step 2: Click '100%' button
3. Step 3: Verify image at actual pixel size
4. Step 4: 1920px wide screenshot shows 1920 actual pixels

---

