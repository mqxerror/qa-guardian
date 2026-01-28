-- ============================================================================
-- Pipeline Features: Remove In-Memory Maps - Use Database-Only Storage
-- ============================================================================
-- Run with: sqlite3 features.db < import-features.sql
--
-- UPDATED: 2026-01-28
-- Previous features 2100-2107 are replaced with refined, current-state-aware features.
-- Features #2100, #2101, #2103 were partially done (deprecated Maps, added Proxy wrappers)
-- but the new requirement is COMPLETE removal: no Proxy, no getMemory*, no isDatabaseConnected().
-- ============================================================================

-- ============================================================================
-- PHASE 0: Database Schema Prerequisites
-- ============================================================================

-- Feature 2100: Create Missing Database Tables
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2100,
  'Database',
  'Create Missing Database Tables for Memory Removal',
  'Before removing memory Maps, ensure all required PostgreSQL tables exist. Key missing table: organization_members. Also verify organizations, users, projects, test_suites, tests, test_runs, schedules, alert_channels, api_keys, audit_logs tables exist.',
  'pending',
  'critical',
  '1. Connect to production PostgreSQL using DATABASE_URL
2. Run: SELECT table_name FROM information_schema.tables WHERE table_schema = ''public''
3. Create organization_members table if missing (id UUID, organization_id UUID, user_id UUID, role VARCHAR, joined_at TIMESTAMP, UNIQUE(organization_id, user_id))
4. Seed default org member: INSERT INTO organization_members VALUES for default org/user
5. Verify all required tables exist: organizations, users, projects, test_suites, tests, test_runs, schedules, alert_channels, api_keys, audit_logs
6. Create any other missing tables referenced by repository files',
  datetime('now')
);

-- ============================================================================
-- PHASE 1: Core Repository Cleanup (remove isDatabaseConnected, getMemory*, Proxy)
-- ============================================================================

-- Feature 2101: Clean test-suites Repository - Remove isDatabaseConnected and getMemory
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2101,
  'Backend/DataLayer',
  'Clean test-suites Repository - Full DB-Only',
  'Complete cleanup of backend/src/services/repositories/test-suites.ts. Previous work added isDatabaseConnected() guards that return undefined/[] when DB disconnected. New requirement: REMOVE all isDatabaseConnected() checks (DB is always connected), REMOVE getMemoryTestSuites() and getMemoryTests() deprecated functions entirely, REMOVE getTestSuitesMap() and getTestsMap() compatibility functions. Every function should directly query PostgreSQL.',
  'pending',
  'critical',
  '1. Remove ALL isDatabaseConnected() checks from every function - DB is always connected
2. Remove getMemoryTestSuites() function (line ~566) - currently returns empty Map with deprecation warning
3. Remove getMemoryTests() function (line ~573) - currently returns empty Map with deprecation warning
4. Remove getTestSuitesMap() function (line ~518) - loads entire table into Map, unnecessary
5. Remove getTestsMap() function (line ~538) - loads entire table into Map, unnecessary
6. Remove the COMPATIBILITY EXPORTS section entirely
7. All functions should directly query PostgreSQL without any guards
8. Verify no imports of removed functions break',
  datetime('now')
);

-- Feature 2102: Clean projects Repository - Remove isDatabaseConnected and getMemory
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2102,
  'Backend/DataLayer',
  'Clean projects Repository - Full DB-Only',
  'Complete cleanup of backend/src/services/repositories/projects.ts. Previous work replaced memory Maps with isDatabaseConnected() guards and deprecated getMemory* functions returning empty Maps. New requirement: REMOVE all isDatabaseConnected() checks, REMOVE all getMemory* functions (getMemoryProjects, getMemoryProjectMembers, getMemoryProjectEnvVars, getMemoryProjectVisualSettings, getMemoryProjectHealingSettings), REMOVE getProjectsMap(). Every function should directly query PostgreSQL.',
  'pending',
  'critical',
  '1. Remove ALL isDatabaseConnected() checks from every function (createProject, getProject, updateProject, deleteProject, listProjects, getProjectBySlug, getProjectByName, addProjectMember, getProjectMembers, removeProjectMember, getProjectVisualSettings, updateProjectVisualSettings, getProjectHealingSettings, updateProjectHealingSettings, addProjectEnvVar, getProjectEnvVars, deleteProjectEnvVar)
2. Remove getMemoryProjects() - returns empty Map with warning
3. Remove getMemoryProjectMembers() - returns empty Map with warning
4. Remove getMemoryProjectEnvVars() - returns empty Map with warning
5. Remove getMemoryProjectVisualSettings() - returns empty Map with warning
6. Remove getMemoryProjectHealingSettings() - returns empty Map with warning
7. Remove getProjectsMap() - loads entire table into Map, unnecessary
8. Remove COMPATIBILITY EXPORTS section entirely',
  datetime('now')
);

-- Feature 2103: Clean organizations Repository - Remove Memory Maps Completely
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2103,
  'Backend/DataLayer',
  'Clean organizations Repository - Full DB-Only',
  'Complete cleanup of backend/src/services/repositories/organizations.ts. Still has 5 memory Maps: memoryOrganizations, memoryOrganizationMembers, memoryInvitations, memoryAutoQuarantineSettings, memoryRetryStrategySettings. Also has getMemory* exports returning empty Maps. Remove ALL memory Maps, ALL getMemory* functions, ALL isDatabaseConnected() guards. All functions must directly query PostgreSQL. Also update seedDefaultOrganizations() to INSERT into PostgreSQL instead of memory Maps.',
  'pending',
  'critical',
  '1. Delete const memoryOrganizations, memoryOrganizationMembers, memoryInvitations, memoryAutoQuarantineSettings, memoryRetryStrategySettings Map declarations
2. Remove getMemoryOrganizations() and all getMemory* export functions
3. Remove ALL isDatabaseConnected() guards from every function
4. Update seedDefaultOrganizations() to INSERT INTO PostgreSQL tables instead of memory Maps
5. Ensure getUserOrganization() queries organization_members table directly
6. All functions should directly query PostgreSQL without any guards',
  datetime('now')
);

-- Feature 2104: Clean auth Repository - Remove Memory Maps
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2104,
  'Backend/DataLayer',
  'Clean auth Repository - Remove Memory Maps',
  'Remove 3 memory Maps from backend/src/services/repositories/auth.ts: memoryUsers, memoryUserSessions, memoryResetTokens. Remove all isDatabaseConnected() guards. All auth operations must query PostgreSQL directly. Special care for session handling - ensure sessions table exists.',
  'pending',
  'critical',
  '1. Delete const memoryUsers: Map<string, User>
2. Delete const memoryUserSessions: Map<string, Session[]>
3. Delete const memoryResetTokens: Map<string, ResetToken>
4. Remove ALL isDatabaseConnected() guards
5. Remove ALL getMemory* export functions
6. All user lookup, session management, and password reset must query PostgreSQL
7. Verify sessions and reset_tokens tables exist in PostgreSQL',
  datetime('now')
);

-- Feature 2105: Clean monitoring Repository - Remove 37 Memory Maps
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2105,
  'Backend/DataLayer',
  'Clean monitoring Repository - Remove 37 Memory Maps',
  'Remove 37 memory Maps from backend/src/services/repositories/monitoring.ts. This is the LARGEST file with memoryUptimeChecks, memoryCheckResults, memoryTransactionChecks, memoryTransactionResults, memoryPerformanceChecks, memoryPerformanceResults, memoryMaintenanceWindows, memoryCheckIncidents, memoryActiveIncidents, memoryConsecutiveFailures, memoryWebhookChecks, memoryWebhookEvents, memoryWebhookTokenMap, memoryDnsChecks, memoryDnsResults, memoryTcpChecks, memoryTcpResults, memoryMonitoringSettings, memoryStatusPages, memoryStatusPagesBySlug, memoryStatusPageIncidents, memoryStatusPageSubscriptions, memoryOnCallSchedules, memoryEscalationPolicies, memoryDeletedCheckHistory, memoryAlertGroupingRules, memoryAlertGroups, memoryAlertRoutingRules, memoryAlertRoutingLogs, memoryAlertRateLimitConfigs, memoryAlertRateLimitStates, memoryAlertCorrelationConfigs, memoryAlertCorrelations, memoryAlertToCorrelation, memoryAlertRunbooks, memoryManagedIncidents, memoryIncidentsByOrg.',
  'pending',
  'high',
  '1. Delete ALL 37 const memory* Map declarations (lines 63-139)
2. Remove ALL isDatabaseConnected() guards from every function
3. Remove ALL getMemory* export functions
4. Create necessary PostgreSQL tables for monitoring data if they dont exist
5. All monitoring CRUD must query PostgreSQL directly
6. This is the largest file - work carefully through each function',
  datetime('now')
);

-- Feature 2106: Clean dast Repository - Remove 6 Memory Maps
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2106,
  'Backend/DataLayer',
  'Clean dast Repository - Remove 6 Memory Maps',
  'Remove 6 memory Maps from backend/src/services/repositories/dast.ts: memoryDastConfigs, memoryDastScans, memoryDastFalsePositives, memoryOpenApiSpecs, memoryDastSchedules, memoryGraphqlScans. Remove isDatabaseConnected() guards and getMemory* functions.',
  'pending',
  'medium',
  '1. Delete 6 memory Map declarations (lines 26-31)
2. Remove ALL isDatabaseConnected() guards
3. Remove ALL getMemory* exports
4. All DAST functions must query PostgreSQL directly',
  datetime('now')
);

-- Feature 2107: Clean sast Repository - Remove 6 Memory Maps
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2107,
  'Backend/DataLayer',
  'Clean sast Repository - Remove 6 Memory Maps',
  'Remove 6 memory Maps from backend/src/services/repositories/sast.ts: memorySastConfigs, memorySastScans, memoryFalsePositives, memorySastPRChecks, memorySastPRComments, memorySecretPatterns. Remove isDatabaseConnected() guards and getMemory* functions.',
  'pending',
  'medium',
  '1. Delete 6 memory Map declarations (lines 34-39)
2. Remove ALL isDatabaseConnected() guards
3. Remove ALL getMemory* exports
4. All SAST functions must query PostgreSQL directly',
  datetime('now')
);

-- Feature 2108: Clean github Repository - Remove 5 Memory Maps
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2108,
  'Backend/DataLayer',
  'Clean github Repository - Remove 5 Memory Maps',
  'Remove 5 memory Maps from backend/src/services/repositories/github.ts: memoryGithubConnections, memoryPRStatusChecks, memoryPRComments, memoryPRDependencyScans, memoryUserGithubTokens. Remove isDatabaseConnected() guards and getMemory* functions.',
  'pending',
  'medium',
  '1. Delete 5 memory Map declarations (lines 27-31)
2. Remove ALL isDatabaseConnected() guards
3. Remove ALL getMemory* exports
4. All GitHub functions must query PostgreSQL directly',
  datetime('now')
);

-- Feature 2109: Clean ai-test-generator Repository - Remove 6 Memory Maps
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2109,
  'Backend/DataLayer',
  'Clean ai-test-generator Repository - Remove 6 Memory Maps',
  'Remove 6 memory Maps from backend/src/services/repositories/ai-test-generator.ts: memoryAiGeneratedTests, memoryTestsByUser, memoryTestsByOrganization, memoryTestsByProject, memoryVersionChains, memoryTestsByApprovalStatus. Remove isDatabaseConnected() guards and getMemory* functions.',
  'pending',
  'medium',
  '1. Delete 6 memory Map declarations (lines 19-24)
2. Remove ALL isDatabaseConnected() guards
3. Remove ALL getMemory* exports
4. All AI test generator functions must query PostgreSQL directly',
  datetime('now')
);

-- Feature 2110: Clean Remaining Repositories (audit-logs, schedules, reports, api-keys, test-runs)
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2110,
  'Backend/DataLayer',
  'Clean Remaining Repositories - Remove Memory Maps',
  'Remove memory Maps from 5 remaining repository files: audit-logs.ts (memoryAuditLogs), schedules.ts (memorySchedules), reports.ts (memoryReports), api-keys.ts (memoryApiKeys + memoryMcpConnections + memoryMcpToolCalls + memoryMcpAuditLogs), test-runs.ts (memoryTestRuns + memorySelectorOverrides + memoryHealedSelectorHistory). Total: 10 memory Maps across 5 files.',
  'pending',
  'medium',
  '1. audit-logs.ts: Delete memoryAuditLogs Map, remove isDatabaseConnected() guards
2. schedules.ts: Delete memorySchedules Map, remove isDatabaseConnected() guards
3. reports.ts: Delete memoryReports Map, remove isDatabaseConnected() guards
4. api-keys.ts: Delete 4 memory Maps (memoryApiKeys, memoryMcpConnections, memoryMcpToolCalls, memoryMcpAuditLogs), remove isDatabaseConnected() guards
5. test-runs.ts: Delete 3 memory Maps (memoryTestRuns, memorySelectorOverrides, memoryHealedSelectorHistory), remove isDatabaseConnected() guards
6. Remove ALL getMemory* exports from all 5 files',
  datetime('now')
);

-- ============================================================================
-- PHASE 2: Route Store Files (remove Proxy wrappers)
-- ============================================================================

-- Feature 2111: Remove Proxy Maps from test-suites stores.ts
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2111,
  'Backend/Routes',
  'Remove Proxy Maps from test-suites stores.ts',
  'Remove ALL Proxy-wrapped Map exports from backend/src/routes/test-suites/stores.ts. Current state: exports testSuites and tests as Proxy(emptyMap) with deprecation warnings. These Proxy wrappers BROKE production. Remove them entirely. Only export async database functions.',
  'pending',
  'critical',
  '1. Remove emptyTestSuitesMap and emptyTestsMap declarations
2. Remove Proxy-wrapped testSuites export (lines 45-50)
3. Remove Proxy-wrapped tests export (lines 52-57)
4. Remove warnDeprecation() function and deprecationWarned flag
5. Remove import of getTestSuitesMap, getTestsMap (no longer needed)
6. Keep ONLY async function exports: createTestSuite, getTestSuite, updateTestSuite, deleteTestSuite, listTestSuites, listAllTestSuites, createTest, getTest, updateTest, deleteTest, listTests, listAllTests
7. File should be ~20 lines: imports + re-exports of async functions',
  datetime('now')
);

-- Feature 2112: Remove Proxy Maps from projects stores.ts
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2112,
  'Backend/Routes',
  'Remove Proxy Maps from projects stores.ts',
  'Remove ALL Proxy-wrapped Map exports from backend/src/routes/projects/stores.ts. Currently exports projects, projectMembers, projectEnvVars, projectVisualSettings, projectHealingSettings as Proxy(emptyMap). Remove entirely. Only export async database functions.',
  'pending',
  'critical',
  '1. Remove ALL empty Map declarations
2. Remove ALL 5 Proxy-wrapped exports (projects, projectMembers, projectEnvVars, projectVisualSettings, projectHealingSettings)
3. Remove warnDeprecation() function
4. Keep ONLY async function exports from repository
5. File should be ~20 lines: imports + re-exports',
  datetime('now')
);

-- Feature 2113: Remove Proxy Maps from api-keys stores.ts
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2113,
  'Backend/Routes',
  'Remove Proxy Maps from api-keys stores.ts',
  'Remove ALL Proxy-wrapped Map exports from backend/src/routes/api-keys/stores.ts. Currently exports apiKeys, mcpConnections, mcpToolCalls, mcpAuditLogs as Proxy(emptyMap). Remove entirely. Only export async database functions.',
  'pending',
  'high',
  '1. Remove ALL empty Map declarations
2. Remove ALL 4 Proxy-wrapped exports (apiKeys, mcpConnections, mcpToolCalls, mcpAuditLogs)
3. Remove warnDeprecation() function
4. Keep ONLY async function exports
5. Update all route files importing from this stores.ts',
  datetime('now')
);

-- Feature 2114: Remove Memory from Remaining 6 stores.ts Files
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2114,
  'Backend/Routes',
  'Remove Memory from Remaining 6 stores.ts Files',
  'Clean up remaining stores.ts files: monitoring/stores.ts, github/stores.ts, dast/stores.ts, sast/stores.ts, ai-test-generator/stores.ts, reports/stores.ts. Remove all Map exports, Proxy wrappers, getMemory* imports. Only export async database functions.',
  'pending',
  'high',
  '1. monitoring/stores.ts - Remove all Map/Proxy exports, keep async DB functions
2. github/stores.ts - Remove all Map/Proxy exports, keep async DB functions
3. dast/stores.ts - Remove all Map/Proxy exports, keep async DB functions
4. sast/stores.ts - Remove all Map/Proxy exports, keep async DB functions
5. ai-test-generator/stores.ts - Remove all Map/Proxy exports, keep async DB functions
6. reports/stores.ts - Remove all Map/Proxy exports, keep async DB functions
7. Each file should be ~20 lines: imports + re-exports of async functions',
  datetime('now')
);

-- ============================================================================
-- PHASE 3: Route File Migration (Map operations → async DB calls)
-- ============================================================================

-- Feature 2115: Migrate test-suites Route Files to Async DB Calls
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2115,
  'Backend/Routes',
  'Migrate test-suites Route Files to Async DB Calls',
  'Replace all synchronous Map operations with async database calls in backend/src/routes/test-suites/*.ts files: routes.ts, review.ts, healing.ts, ai-generation.ts, ai-coverage.ts, ai-variations.ts, ai-refine.ts. Replace testSuites.get(id) with await getTestSuite(id), tests.get(id) with await getTest(id), Array.from(X.values()) with await listAll*(), X.set() with await create/update functions.',
  'pending',
  'critical',
  '1. routes.ts - Replace all Map.get/set/delete with async DB functions
2. review.ts - Replace Map operations
3. healing.ts - Replace Map operations
4. ai-generation.ts - Replace Map operations
5. ai-coverage.ts - Replace Map operations
6. ai-variations.ts - Replace Map operations
7. ai-refine.ts - Replace Map operations
8. Ensure all route handlers are properly async
9. Change imports from stores.ts to use async functions',
  datetime('now')
);

-- Feature 2116: Migrate projects Route Files to Async DB Calls
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2116,
  'Backend/Routes',
  'Migrate projects Route Files to Async DB Calls',
  'Replace all synchronous Map operations with async database calls in backend/src/routes/projects/*.ts files: routes.ts, analytics.ts, remediation.ts, flaky-tests.ts, settings.ts, members.ts, utils.ts. Replace projects.get(id) with await getProject(id), etc.',
  'pending',
  'critical',
  '1. routes.ts - Replace all Map.get/set/delete with async DB functions
2. analytics.ts - Replace Map operations
3. remediation.ts - Replace Map operations
4. flaky-tests.ts - Replace Map operations
5. settings.ts - Replace Map operations
6. members.ts - Replace Map operations
7. utils.ts - Replace Map operations
8. Ensure all handlers are properly async',
  datetime('now')
);

-- Feature 2117: Migrate Auth and Organizations Routes to Async DB Calls
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2117,
  'Backend/Routes',
  'Migrate Auth and Organizations Routes to Async DB',
  'Update backend/src/routes/auth.ts and backend/src/routes/organizations.ts. CRITICAL: getUserOrganization(userId) currently iterates a memory Map - change to: query organization_members WHERE user_id=$1 LIMIT 1. Update ALL callers of getUserOrganization() to use await. Update seedDefaultOrganizations() to INSERT INTO PostgreSQL.',
  'pending',
  'critical',
  '1. organizations.ts: Change getUserOrganization() to async PostgreSQL query on organization_members table
2. auth.ts: Update all getUserOrganization() calls to use await
3. auth.ts: Replace any memoryUsers.get() with async DB queries
4. organizations.ts: Update seedDefaultOrganizations() to INSERT INTO PostgreSQL
5. Verify login flow works end-to-end with DB-only auth
6. Test: login as admin@example.com / Owner123!',
  datetime('now')
);

-- Feature 2118: Migrate test-runs Route Files to Async DB Calls
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2118,
  'Backend/Routes',
  'Migrate test-runs Route Files to Async DB Calls',
  'Replace Map operations in all backend/src/routes/test-runs/*.ts files (20+ files): execution.ts, test-executor.ts, run-core-routes.ts, run-data-routes.ts, run-trigger-routes.ts, run-control-routes.ts, results-routes.ts, healing.ts, healing-routes.ts, ai-analysis.ts, ai-failure-analysis.ts, visual-regression.ts, visual-test-executor.ts, visual-batch-routes.ts, visual-approval-routes.ts, visual-storage-routes.ts, baseline-routes.ts, security.ts, security-advanced.ts, recording-routes.ts, k6-helpers.ts, load-test-executor.ts, webhooks.ts, webhook-events.ts, webhook-subscriptions.ts, alerts.ts, alert-channels.ts, artifact-routes.ts, explanations.ts, failure-patterns-routes.ts, review-export-routes.ts, selector-override-routes.ts, browser-viewport-routes.ts, test-simulation.ts, organization-settings.ts, slack-integration.ts, storage.ts.',
  'pending',
  'high',
  '1. For each file, replace Map.get/set/delete with async DB function calls
2. Replace Array.from(X.values()) with await listAll*() calls
3. Ensure all route handlers are async
4. Update imports from stores.ts to use async functions
5. Work through files alphabetically, test after each batch',
  datetime('now')
);

-- Feature 2119: Migrate Remaining Route Files to Async DB Calls
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2119,
  'Backend/Routes',
  'Migrate Remaining Route Files to Async DB Calls',
  'Replace Map operations in remaining route files: monitoring/*.ts (maintenance.ts, status-pages.ts, on-call-escalation.ts, uptime.ts, alert-correlation.ts, alert-grouping-routing.ts, incidents.ts, webhooks.ts, dns-tcp.ts, reports.ts, helpers.ts), github/*.ts (core.ts, dependency-management.ts, dependency-scanning.ts, vulnerability-tracking.ts, ai-cost-analytics.ts, ai-test-generation.ts, ai-analysis.ts, ai-providers.ts, natural-language-tests.ts), sast/*.ts, dast/*.ts, api-keys/*.ts, schedules.ts, audit-logs.ts, mcp-tools/routes.ts.',
  'pending',
  'high',
  '1. monitoring/ route files - Replace Map operations with async DB calls
2. github/ route files - Replace Map operations
3. sast/ route files - Replace Map operations
4. dast/ route files - Replace Map operations
5. api-keys/ route files - Replace Map operations
6. schedules.ts - Replace Map operations
7. audit-logs.ts - Replace Map operations
8. mcp-tools/routes.ts - Replace Map operations
9. Ensure all handlers are async',
  datetime('now')
);

-- Feature 2120: Migrate MCP Handlers to Async DB Calls
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2120,
  'Backend/MCP',
  'Migrate MCP Handlers to Async DB Calls',
  'Check and update backend/src/mcp/handlers/*.ts and backend/src/mcp/server.ts for any Map operations. MCP handlers may import from stores.ts and use Map operations. Update to use async DB functions.',
  'pending',
  'high',
  '1. Check mcp/server.ts for Map imports/usage
2. Check all mcp/handlers/*.ts files for Map imports/usage
3. Check mcp/test-*.ts files for Map imports/usage
4. Replace any Map operations with async DB function calls
5. Update imports to use async functions from repositories',
  datetime('now')
);

-- ============================================================================
-- PHASE 4: Verification
-- ============================================================================

-- Feature 2121: Final Verification - Zero Memory Maps
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2121,
  'QA/Verification',
  'Final Verification - Zero Memory Maps in Codebase',
  'Comprehensive verification that ALL in-memory Maps have been removed and PostgreSQL is the single source of truth. Run grep commands to verify zero matches for memory patterns.',
  'pending',
  'critical',
  '1. grep -rn "new Map" backend/src/services/repositories/ → ZERO data storage Maps
2. grep -rn "getMemory" backend/src/ → ZERO matches
3. grep -rn "new Proxy" backend/src/routes/ → ZERO matches
4. grep -rn "isDatabaseConnected" backend/src/ → ZERO matches (or only in database.ts connection setup)
5. grep -rn "const memory" backend/src/ → ZERO matches for data storage variables
6. App builds successfully: docker compose build --no-cache backend
7. App starts without errors: docker compose logs --tail=50 backend',
  datetime('now')
);

-- Feature 2122: End-to-End CRUD Verification After Memory Removal
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2122,
  'QA/Verification',
  'End-to-End CRUD Verification After Memory Removal',
  'Full end-to-end testing of all CRUD operations against PostgreSQL after all memory removal is complete. This proves the refactoring works correctly.',
  'pending',
  'critical',
  '1. Login as admin@example.com / Owner123!
2. Create a new project → verify it appears in list
3. Create a test suite in the project → verify it appears
4. Create tests in the suite → verify they appear
5. Restart the backend container
6. Login again → project, suite, and tests should ALL still be there (proves DB-only works)
7. Update a test suite → verify changes persist
8. Delete a test → verify it disappears
9. Check MCP Hub / AI Chat works
10. Check monitoring, security, and other features
11. No "not found" errors in browser console or backend logs',
  datetime('now')
);

-- ============================================================================
-- Summary Query
-- ============================================================================
SELECT '========================================' AS '';
SELECT 'PIPELINE FEATURES IMPORTED SUCCESSFULLY' AS '';
SELECT '========================================' AS '';
SELECT id, priority, name FROM features WHERE id >= 2100 AND id <= 2122 ORDER BY id;
SELECT '========================================' AS '';
SELECT 'Total features: ' || COUNT(*) AS '' FROM features WHERE id >= 2100 AND id <= 2122;
SELECT 'Critical: ' || COUNT(*) AS '' FROM features WHERE id >= 2100 AND id <= 2122 AND priority = 'critical';
SELECT 'High: ' || COUNT(*) AS '' FROM features WHERE id >= 2100 AND id <= 2122 AND priority = 'high';
SELECT 'Medium: ' || COUNT(*) AS '' FROM features WHERE id >= 2100 AND id <= 2122 AND priority = 'medium';
