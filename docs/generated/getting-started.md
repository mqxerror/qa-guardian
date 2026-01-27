# Getting Started

> 15 features | 15 completed | 0 pending

[← Back to Index](../README.md)

---

## ✅ Completed Features

### ✅ User registration with email verification

Verify complete registration flow

**How to use:**
Sign up with your email. You will receive a verification link to confirm.

**Expected Behavior:**
1. Step 1: Navigate to registration page
2. Step 2: Fill in email, password, name
3. Step 3: Submit registration
4. Step 4: Verify 'Check your email' message
5. Step 5: Verify email with verification link sent
6. Step 6: Click verification link
7. Step 7: Verify email confirmed and can login

---

### ✅ Login with email and password

Verify standard login flow

**How to use:**
Enter your email and password on the login page to sign in.

**Expected Behavior:**
1. Step 1: Navigate to login page
2. Step 2: Enter valid email and password
3. Step 3: Click login button
4. Step 4: Verify redirect to dashboard
5. Step 5: Verify user name displayed in UI

---

### ✅ Google OAuth login

Verify OAuth login flow

**How to use:**
Click "Sign in with Google" to use your Google account for quick login.

**Expected Behavior:**
1. Step 1: Navigate to login page
2. Step 2: Click 'Sign in with Google'
3. Step 3: Verify redirect to Google OAuth
4. Step 4: Complete OAuth (or verify redirect URL)
5. Step 5: Verify return to application
6. Step 6: Verify user logged in

---

### ✅ Password reset complete flow

Verify forgot password workflow

**How to use:**
Forgot your password? Click the link on login page and check your email.

**Expected Behavior:**
1. Step 1: Click 'Forgot Password' on login page
2. Step 2: Enter registered email
3. Step 3: Submit request
4. Step 4: Verify email with reset link sent
5. Step 5: Click reset link within expiry
6. Step 6: Enter new password
7. Step 7: Verify password updated
8. Step 8: Login with new password - verify success

---

### ✅ Session management view and logout

Verify session management features

**How to use:**
View active sessions in Settings > Security. Click "Logout" to end any session.

**Expected Behavior:**
1. Step 1: Login from multiple devices/browsers
2. Step 2: Navigate to session management
3. Step 3: Verify all active sessions listed
4. Step 4: Click logout on a specific session
5. Step 5: Verify that session invalidated
6. Step 6: Click 'Logout all sessions'
7. Step 7: Verify all sessions except current logged out

---

### ✅ Create organization

Verify organization creation

**How to use:**
Create a new organization from the organization dropdown menu.

**Expected Behavior:**
1. Step 1: Navigate to organization creation
2. Step 2: Enter organization name
3. Step 3: Enter organization slug
4. Step 4: Submit
5. Step 5: Verify organization created
6. Step 6: Verify user is owner of new org

---

### ✅ Update organization settings

Verify org settings management

**How to use:**
Update organization name and settings in Organization Settings.

**Expected Behavior:**
1. Step 1: Navigate to organization settings
2. Step 2: Update organization name
3. Step 3: Upload logo
4. Step 4: Set timezone
5. Step 5: Save changes
6. Step 6: Verify changes persisted

---

### ✅ Invite team member

Verify invitation flow

**How to use:**
Invite team members by email from the Team page.

**Expected Behavior:**
1. Step 1: Navigate to team management
2. Step 2: Click invite member
3. Step 3: Enter email address
4. Step 4: Select role (developer)
5. Step 5: Send invitation
6. Step 6: Verify invitation appears as pending
7. Step 7: Verify email sent

---

### ✅ Change member role

Verify role modification

**How to use:**
Change member roles (Viewer, Developer, Admin) from the Team page.

**Expected Behavior:**
1. Step 1: Navigate to team members list
2. Step 2: Find member to modify
3. Step 3: Click edit role
4. Step 4: Change from developer to admin
5. Step 5: Save
6. Step 6: Verify role updated
7. Step 7: Verify member now has admin permissions

---

### ✅ Remove team member

Verify member removal

**How to use:**
Remove team members by clicking Remove next to their name.

**Expected Behavior:**
1. Step 1: Navigate to team members
2. Step 2: Find member to remove
3. Step 3: Click remove
4. Step 4: Confirm removal
5. Step 5: Verify member removed from list
6. Step 6: Verify member no longer has access

---

### ✅ Transfer ownership

Verify ownership transfer

**How to use:**
Transfer organization ownership to another admin in Settings.

**Expected Behavior:**
1. Step 1: Login as organization owner
2. Step 2: Navigate to organization settings
3. Step 3: Click transfer ownership
4. Step 4: Select new owner from admins
5. Step 5: Confirm with password
6. Step 6: Verify ownership transferred
7. Step 7: Verify previous owner now admin

---

### ✅ Create project with all settings

Verify complete project creation

**How to use:**
Create projects with custom settings for each application you test.

**Expected Behavior:**
1. Step 1: Navigate to new project form
2. Step 2: Enter project name
3. Step 3: Enter description
4. Step 4: Set base URL
5. Step 5: Configure default browser
6. Step 6: Set default timeout
7. Step 7: Save project
8. Step 8: Verify all settings saved correctly

---

### ✅ Project-level permissions

Verify project access control

**How to use:**
Control who can access each project with project-level permissions.

**Expected Behavior:**
1. Step 1: Create project in organization
2. Step 2: Add user with access to specific project only
3. Step 3: Login as that user
4. Step 4: Verify can access assigned project
5. Step 5: Verify cannot access other projects

---

### ✅ Archive project

Verify project archival

**How to use:**
Archive projects you no longer need. They can be restored later.

**Expected Behavior:**
1. Step 1: Navigate to project settings
2. Step 2: Click archive project
3. Step 3: Confirm archival
4. Step 4: Verify project marked as archived
5. Step 5: Verify project hidden from main list
6. Step 6: Verify can view in archived projects list

---

### ✅ Environment variables management

Verify env var CRUD

**How to use:**
Store environment variables securely in project settings.

**Expected Behavior:**
1. Step 1: Navigate to project settings
2. Step 2: Add environment variable: API_KEY=secret123
3. Step 3: Save
4. Step 4: Verify variable shows with masked value
5. Step 5: Edit variable
6. Step 6: Delete variable
7. Step 7: Verify variable removed

---

