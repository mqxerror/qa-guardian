# Security & Access

> 24 features | 24 completed | 0 pending

[← Back to Index](../README.md)

---

## ✅ Completed Features

### ✅ Unauthenticated user redirected to login

Verify that accessing protected routes without authentication redirects to login page

**How to use:**
Protected pages automatically redirect you to login. Simply sign in to access the requested page.

**Expected Behavior:**
1. Step 1: Clear all session/cookie data
2. Step 2: Navigate directly to /dashboard
3. Step 3: Verify redirect to /login page
4. Step 4: Verify login form is displayed

---

### ✅ Viewer cannot access admin pages

Verify that users with viewer role cannot access admin-only pages

**How to use:**
Viewers have read-only access. Contact an admin to upgrade your role if you need additional permissions.

**Expected Behavior:**
1. Step 1: Login as user with viewer role
2. Step 2: Navigate directly to /organization/settings
3. Step 3: Verify 403 forbidden response or redirect to dashboard
4. Step 4: Verify error message indicates insufficient permissions

---

### ✅ Developer cannot manage organization members

Verify developers cannot add/remove team members

**How to use:**
Team member management is restricted to owners and admins. Developers can view team members but cannot modify them.

**Expected Behavior:**
1. Step 1: Login as user with developer role
2. Step 2: Navigate to team management page
3. Step 3: Verify invite button is not visible or disabled
4. Step 4: Attempt to POST to /api/v1/organizations/:id/invitations
5. Step 5: Verify 403 forbidden response

---

### ✅ API returns 401 for unauthenticated requests

Verify API endpoints require authentication

**How to use:**
All API requests require authentication. Include your API key in the Authorization header: Bearer YOUR_API_KEY

**Expected Behavior:**
1. Step 1: Make GET request to /api/v1/projects without auth header
2. Step 2: Verify 401 Unauthorized response
3. Step 3: Verify response body contains appropriate error message

**API Reference:**
```
Authorization: Bearer <api_key>
```

---

### ✅ API returns 403 for unauthorized role access

Verify API endpoints enforce role-based access control

**How to use:**
API endpoints enforce role-based access. Ensure your API key has the required scopes for the operation.

**Expected Behavior:**
1. Step 1: Login as viewer and obtain auth token
2. Step 2: Attempt POST to /api/v1/projects with valid token
3. Step 3: Verify 403 Forbidden response
4. Step 4: Verify response indicates permission denied

**API Reference:**
```
Returns 403 Forbidden when scope is insufficient
```

---

### ✅ Session expiration after inactivity

Verify sessions expire after configured timeout period

**How to use:**
For security, sessions expire after inactivity. Simply log in again to continue working.

**Expected Behavior:**
1. Step 1: Login with valid credentials
2. Step 2: Navigate to dashboard and verify access
3. Step 3: Wait for session timeout period (or simulate by modifying session)
4. Step 4: Attempt to access protected route
5. Step 5: Verify redirect to login with session expired message

---

### ✅ Logout clears all session data

Verify logout properly invalidates session and clears tokens

**How to use:**
Click "Logout" to securely end your session. All session data is cleared from your browser.

**Expected Behavior:**
1. Step 1: Login with valid credentials
2. Step 2: Note auth token and session cookies
3. Step 3: Click logout button
4. Step 4: Verify redirect to login page
5. Step 5: Verify cookies are cleared
6. Step 6: Attempt to use old token for API request
7. Step 7: Verify 401 response

---

### ✅ Invalid tokens are rejected

Verify malformed or invalid tokens are properly rejected

**How to use:**
Invalid or expired tokens are automatically rejected. If you see authentication errors, try logging in again.

**Expected Behavior:**
1. Step 1: Make API request with malformed JWT token
2. Step 2: Verify 401 response
3. Step 3: Make API request with expired token
4. Step 4: Verify 401 response with appropriate message

---

### ✅ Role-based menu visibility

Verify each role only sees their permitted menu items

**How to use:**
Your sidebar menu shows only the features available to your role. Owners see all options, viewers see limited options.

**Expected Behavior:**
1. Step 1: Login as owner and capture visible menu items
2. Step 2: Verify Settings, Team, Billing visible
3. Step 3: Logout and login as developer
4. Step 4: Verify Team, Billing NOT visible
5. Step 5: Logout and login as viewer
6. Step 6: Verify only view-related menu items visible

---

### ✅ Cannot access another user's data via URL manipulation

Verify users cannot access other users' resources by changing IDs in URLs

**How to use:**
Each user can only access their own data. Attempting to access other users data via URL manipulation is blocked.

**Expected Behavior:**
1. Step 1: Login as User A and create a project
2. Step 2: Note the project ID
3. Step 3: Logout and login as User B in different organization
4. Step 4: Navigate to /projects/{User A's project ID}
5. Step 5: Verify 404 or 403 response, not the project data

---

### ✅ Password reset flow security

Verify secure password reset process

**How to use:**
Click "Forgot Password" on the login page, enter your email, and follow the secure link sent to reset your password.

**Expected Behavior:**
1. Step 1: Navigate to forgot password page
2. Step 2: Enter valid email address
3. Step 3: Verify success message (no email existence leak)
4. Step 4: Use reset link with valid token
5. Step 5: Reset password successfully
6. Step 6: Verify old password no longer works
7. Step 7: Verify reset link cannot be reused

---

### ✅ Failed login attempts handling

Verify failed logins don't leak user existence information

**How to use:**
For security, failed login attempts show a generic error message. This prevents attackers from discovering valid usernames.

**Expected Behavior:**
1. Step 1: Attempt login with non-existent email
2. Step 2: Verify generic 'Invalid credentials' message
3. Step 3: Attempt login with existing email, wrong password
4. Step 4: Verify same generic error message (no difference)

---

### ✅ Delete organization requires password confirmation

Verify sensitive operations require re-authentication

**How to use:**
Deleting an organization requires password confirmation to prevent accidental deletion.

**Expected Behavior:**
1. Step 1: Login as organization owner
2. Step 2: Navigate to organization settings
3. Step 3: Click delete organization
4. Step 4: Verify password confirmation dialog appears
5. Step 5: Enter incorrect password
6. Step 6: Verify deletion is blocked
7. Step 7: Enter correct password
8. Step 8: Verify organization is deleted

---

### ✅ API key shown only once on creation

Verify API keys are displayed only at creation time

**How to use:**
API keys are shown only once when created. Copy and store your key securely - you cannot view it again.

**Expected Behavior:**
1. Step 1: Navigate to API keys management
2. Step 2: Create new API key
3. Step 3: Verify full key is displayed
4. Step 4: Close dialog and return to API keys list
5. Step 5: Verify only key prefix is shown (qg_xxxx...)
6. Step 6: Verify no way to view full key again

**API Reference:**
```
POST /api/v1/api-keys - returns key only in response
```

---

### ✅ API key scopes enforcement

Verify API keys with limited scopes cannot perform unauthorized actions

**How to use:**
API keys have specific scopes (read, write, execute). The key can only perform actions within its assigned scopes.

**Expected Behavior:**
1. Step 1: Create API key with 'read' scope only
2. Step 2: Use key to GET /api/v1/projects - verify success
3. Step 3: Use key to POST /api/v1/projects - verify 403
4. Step 4: Use key to POST /api/v1/suites/:id/runs - verify 403

**API Reference:**
```
Scopes: read, write, execute, admin, mcp:read, mcp:execute, mcp:write
```

---

### ✅ MCP requires API key authentication

MCP connections must provide valid API key

**How to use:**
MCP connections require a valid API key for authentication.

**Expected Behavior:**
1. Step 1: Attempt MCP connection without API key
2. Step 2: Verify connection rejected with auth error
3. Step 3: Provide valid API key
4. Step 4: Verify connection succeeds

**API Reference:**
```
Header: Authorization: Bearer <api_key>
```

---

### ✅ MCP API key requires mcp scope

API key must have mcp:* scope to access MCP

**How to use:**
API keys need the mcp scope to access MCP endpoints.

**Expected Behavior:**
1. Step 1: Create API key with only 'read' scope
2. Step 2: Attempt MCP connection
3. Step 3: Verify connection rejected - insufficient scope
4. Step 4: Create key with 'mcp:read' scope
5. Step 5: Verify connection succeeds

**API Reference:**
```
Scope: mcp
```

---

### ✅ MCP mcp:read scope allows read-only tools

mcp:read scope grants access to read-only MCP tools

**How to use:**
mcp:read allows listing and viewing projects, suites, and results.

**Expected Behavior:**
1. Step 1: Connect with mcp:read scope only
2. Step 2: Call get-test-results - verify success
3. Step 3: Call list-test-suites - verify success
4. Step 4: Call trigger-test-run - verify permission denied

**API Reference:**
```
Scope: mcp:read
```

---

### ✅ MCP mcp:execute scope allows test execution

mcp:execute scope grants access to run tests

**How to use:**
mcp:execute allows triggering and canceling test runs.

**Expected Behavior:**
1. Step 1: Connect with mcp:execute scope
2. Step 2: Call trigger-test-run - verify success
3. Step 3: Call cancel-test-run - verify success

**API Reference:**
```
Scope: mcp:execute
```

---

### ✅ MCP mcp:write scope allows modifications

mcp:write scope grants access to modify data

**How to use:**
mcp:write allows creating and modifying projects and tests.

**Expected Behavior:**
1. Step 1: Connect with mcp:write scope
2. Step 2: Call approve-baseline - verify success
3. Step 3: Call update-test-config - verify success

**API Reference:**
```
Scope: mcp:write
```

---

### ✅ MCP connection requires valid API key

Connections without valid API key are rejected

**How to use:**
MCP connections require a valid API key.

**Expected Behavior:**
1. Step 1: Start MCP server with API key configured
2. Step 2: Attempt connection without API key
3. Step 3: Verify connection rejected
4. Step 4: Error message indicates authentication required

---

### ✅ MCP API key scope mcp:read allows read operations

API key with mcp:read scope can call read-only tools

**How to use:**
mcp:read scope allows read-only operations.

**Expected Behavior:**
1. Step 1: Create API key with mcp:read scope
2. Step 2: Connect to MCP with this key
3. Step 3: Call get-test-results - verify success
4. Step 4: Call list-test-suites - verify success

---

### ✅ MCP API key scope mcp:execute allows test execution

API key with mcp:execute scope can trigger tests

**How to use:**
mcp:execute scope allows triggering test runs.

**Expected Behavior:**
1. Step 1: Create API key with mcp:execute scope
2. Step 2: Connect to MCP
3. Step 3: Call trigger-test-run - verify success
4. Step 4: Call cancel-test-run - verify success

---

### ✅ MCP read-only key cannot trigger tests

API key with only mcp:read cannot execute tests

**How to use:**
Read-only API keys cannot trigger or cancel tests.

**Expected Behavior:**
1. Step 1: Connect with mcp:read only key
2. Step 2: Call trigger-test-run
3. Step 3: Verify permission denied error
4. Step 4: Error indicates insufficient scope

---

