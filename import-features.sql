-- ============================================================================
-- Pipeline Features v3 - Emergency Map-to-Async Migration
-- ============================================================================
-- Run with: sqlite3 features.db < import-features.sql
--
-- Schema: id INTEGER, priority INTEGER, category VARCHAR, name VARCHAR,
--         description TEXT, steps JSON, passes BOOLEAN, in_progress BOOLEAN
-- Priority: 1=critical, 2=high, 3=medium
-- ============================================================================

-- Delete old v2 features
DELETE FROM features WHERE id >= 2100 AND id <= 2122;

-- ============================================================================
-- PHASE 1: EMERGENCY FIX (App is broken NOW) - Features 2100-2102
-- ============================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2100, 1, 'Backend/Infrastructure',
'Create maps.ts files to break circular dependencies',
'The Map declarations in index.ts files cause circular imports (index.ts imports route files which import index.ts). Create separate maps.ts files to hold Map instances and break the cycle.',
'["Create backend/src/routes/projects/maps.ts with Map exports: projects, projectMembers, projectEnvVars, projectVisualSettings, projectHealingSettings. Import types from ./types",
"Create backend/src/routes/test-suites/maps.ts with Map exports: testSuites, tests. Import types from ./types",
"Update backend/src/routes/projects/index.ts: remove inline Map declarations (around line 26), replace with re-export from ./maps",
"Update backend/src/routes/test-suites/index.ts: remove inline Map declarations (lines 42-43), replace with re-export from ./maps",
"Fix backend/src/routes/projects/flaky-tests.ts: change import { projects } from ./stores to import from ./maps",
"Fix backend/src/routes/projects/remediation.ts: same import fix",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2101, 1, 'Backend/Infrastructure',
'Create store-sync.ts bridge to populate Maps from PostgreSQL',
'Create backend/src/store-sync.ts that populates empty in-memory Maps from PostgreSQL on startup and refreshes every 30 seconds. This temporary bridge makes the app work while route files are migrated to async.',
'["Create backend/src/store-sync.ts file",
"Import Map instances from ./routes/projects/maps and ./routes/test-suites/maps",
"Import getProjectsMap from ./services/repositories/projects",
"Import getTestSuitesMap and getTestsMap from ./services/repositories/test-suites",
"Import isDatabaseConnected from ./services/database",
"Implement initializeStoreSync(): load all DB data into Maps, set up 30s refresh interval",
"Implement stopStoreSync(): clear the refresh interval",
"Add logging: [StoreSync] Loaded X projects, Y suites, Z tests from DB",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2102, 1, 'Backend/Infrastructure',
'Wire store-sync into server startup and shutdown',
'Modify backend/src/index.ts to call initializeStoreSync on startup and stopStoreSync on shutdown.',
'["Add import: import { initializeStoreSync, stopStoreSync } from ./store-sync to backend/src/index.ts",
"After console.log PostgreSQL database connected line, add: await initializeStoreSync()",
"In SIGTERM handler before await closeDatabase(), add: stopStoreSync()",
"In SIGINT handler before await closeDatabase(), add: stopStoreSync()",
"Verify: cd backend && npx tsc --noEmit must show zero errors",
"Verify: grep -n initializeStoreSync backend/src/index.ts shows 4 lines (1 import + 1 init + 2 shutdown)"]',
0, 0);

-- ============================================================================
-- PHASE 2: Async Migration - Crashing Routes - Features 2103-2106
-- ============================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2103, 1, 'Backend/Routes',
'Migrate flaky-tests.ts from Map ops to async DB calls',
'File backend/src/routes/projects/flaky-tests.ts CRASHES at line 415. Replace ALL synchronous Map operations with async database function calls.',
'["Add imports: getProject from ./stores, getTest/getTestSuite/listAllTests from ../test-suites/stores, listTestRunsByOrg from ../../services/repositories/test-runs",
"Remove old Map imports: testSuites, tests from ../test-suites and testRuns from ../test-runs and projects from ./maps",
"Replace all tests.get(id) with await getTest(id)",
"Replace all testSuites.get(id) with await getTestSuite(id)",
"Replace all projects.get(id) with await getProject(id)",
"Replace Array.from(testRuns.values()).filter(...) with await listTestRunsByOrg(orgId)",
"Replace Array.from(tests.values()).filter(...) with await listAllTests(orgId) then filter",
"Verify: grep -c testRuns.values.*tests.get.*testSuites.get.*projects.get flaky-tests.ts outputs 0",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2104, 1, 'Backend/Routes',
'Migrate test-runs.ts checkAndSendAlerts from Map ops to async',
'File backend/src/routes/test-runs.ts CRASHES at line 495 in checkAndSendAlerts. Fix projects.get() and testRuns.get() calls.',
'["Import getProject from ./projects/stores",
"Import getTestRun from ../services/repositories/test-runs if needed",
"Replace projects.get(suiteInfo.project_id) with await getProject(suiteInfo.project_id)",
"Replace any testRuns.get(runId) with await getTestRun(runId)",
"Remove Map imports for projects",
"Ensure checkAndSendAlerts is async",
"Verify: grep -c projects.get backend/src/routes/test-runs.ts outputs 0",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2105, 1, 'Backend/Routes',
'Migrate remediation.ts from Map ops to async DB calls',
'File backend/src/routes/projects/remediation.ts uses tests.get(), testSuites.get(), projects.get(), testRuns.values(). Replace with async.',
'["Add async DB function imports from stores.ts files",
"Remove old Map imports",
"Replace tests.get(testId) with await getTest(testId)",
"Replace testSuites.get(suiteId) with await getTestSuite(suiteId)",
"Replace projects.get(projectId) with await getProject(projectId)",
"Replace Array.from(testRuns.values()).filter(...) with await listTestRunsByOrg(orgId)",
"Verify: grep -c testRuns.values.*tests.get.*testSuites.get.*projects.get remediation.ts outputs 0",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2106, 1, 'Backend/Routes',
'Migrate analytics.ts from Map ops to async DB calls',
'File backend/src/routes/projects/analytics.ts uses tests.get(), testSuites.get(). Replace with async DB calls.',
'["Add async DB function imports from stores.ts files",
"Remove old Map imports",
"Replace tests.get(testId) with await getTest(testId)",
"Replace testSuites.get(suiteId) with await getTestSuite(suiteId)",
"Replace any Array.from(X.values()) patterns with appropriate async list functions",
"Verify: grep -c tests.get.*testSuites.get analytics.ts outputs 0",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

-- ============================================================================
-- PHASE 3: Async Migration - Core Routes - Features 2107-2111
-- ============================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2107, 2, 'Backend/Routes',
'Migrate projects/routes.ts to async DB calls',
'File backend/src/routes/projects/routes.ts uses testSuites.values(). Replace with async DB calls.',
'["Add import listTestSuites from ../test-suites/stores or stores.ts",
"Replace Array.from(testSuites.values()).filter(s => s.project_id === id) with await listTestSuites(id, orgId)",
"Remove Map imports",
"Ensure all ID generation uses crypto.randomUUID() not String(Date.now())",
"Verify: grep -c testSuites.values.*testSuites.get backend/src/routes/projects/routes.ts outputs 0",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2108, 2, 'Backend/Routes',
'Migrate test-suites/routes.ts to async DB calls',
'File backend/src/routes/test-suites/routes.ts uses testRuns.values(). Replace with async DB calls.',
'["Import listTestRunsBySuite from ../../services/repositories/test-runs",
"Replace Array.from(testRuns.values()).filter(...) with await listTestRunsBySuite(suiteId)",
"Remove testRuns Map import",
"Ensure all ID generation uses crypto.randomUUID() not String(Date.now())",
"Verify: grep -c testRuns.values.*testRuns.get backend/src/routes/test-suites/routes.ts outputs 0",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2109, 2, 'Backend/Routes',
'Migrate organizations.ts to async DB calls',
'File backend/src/routes/organizations.ts uses testSuites.values(), tests.values(), projects.get(). Replace all with async.',
'["Import async functions: listAllTestSuites, listAllTests, getTestSuite, getTest from test-suites stores",
"Import getProject from projects/stores",
"Replace Array.from(testSuites.values()) with await listAllTestSuites(orgId)",
"Replace Array.from(tests.values()) with await listAllTests(orgId)",
"Replace testSuites.get(id) with await getTestSuite(id)",
"Replace tests.get(id) with await getTest(id)",
"Replace projects.get(id) with await getProject(id)",
"Ensure all ID generation uses crypto.randomUUID() not String(Date.now())",
"Verify: grep -c testSuites.values.*tests.values.*projects.get backend/src/routes/organizations.ts outputs 0",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2110, 2, 'Backend/Routes',
'Migrate test-runs core route files to async DB calls',
'Migrate 6 files in backend/src/routes/test-runs/. SPECIAL: execution.ts testRuns Map stays for in-flight runs. runningBrowsers MUST stay in-memory.',
'["Migrate run-core-routes.ts: testRuns.get() to await getTestRun(), testRuns.values() to await listTestRunsByOrg()",
"Migrate run-data-routes.ts: testRuns.get() to await getTestRun()",
"Migrate run-control-routes.ts: testRuns.get/values/entries to async equivalents",
"Migrate results-routes.ts: testRuns.get/values to async, projects.get to await getProject",
"Migrate alert-channels.ts: projects.get/values to getProject/listProjects",
"Migrate artifact-routes.ts: testRuns.get/values and projects.get to async",
"DO NOT remove testRuns Map from execution.ts - it holds in-flight test state",
"DO NOT remove runningBrowsers Map - it holds Browser instances",
"Verify per file: grep -c testRuns.get.*projects.get outputs 0 for each migrated file",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2111, 2, 'Backend/Routes',
'Migrate test-runs supplementary route files to async DB calls',
'Migrate 15 supplementary files in backend/src/routes/test-runs/ from Map ops to async DB calls.',
'["Migrate run-trigger-routes.ts: ensure crypto.randomUUID() for IDs",
"Migrate selector-override-routes.ts: testRuns.get() to async",
"Migrate visual-approval-routes.ts: testRuns.get/values to async",
"Migrate visual-batch-routes.ts: testRuns.get and projects.get to async",
"Migrate review-export-routes.ts: testRuns.get() to async",
"Migrate healing-routes.ts: testRuns.get() to async",
"Migrate test-executor.ts: testRuns.get() to async",
"Migrate ai-failure-analysis.ts: testRuns.get/entries to async",
"Migrate webhook-events.ts: projects.get() to async (11 instances!)",
"Migrate webhook-subscriptions.ts: projects.get() to async",
"Migrate security.ts and security-advanced.ts: projects.get/values to async",
"Migrate slack-integration.ts: projects.values() to async",
"Migrate organization-settings.ts: testRuns.get and projects.get to async",
"Verify per file: grep -c for Map operations outputs 0",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

-- ============================================================================
-- PHASE 4: Async Migration - Remaining Routes + MCP - Features 2112-2120
-- ============================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2112, 3, 'Backend/Routes',
'Migrate github route files to async DB calls',
'Migrate ALL files in backend/src/routes/github/ that use Map operations. core.ts alone has ~12 instances of projects.get().',
'["Migrate core.ts: replace ~12 projects.get(id) with await getProject(id)",
"Migrate dependency-management.ts: projects.get() to async",
"Migrate dependency-scanning.ts: projects.get() and projects.entries() to async",
"Migrate ai-analysis.ts, ai-cost-analytics.ts, ai-providers.ts: replace Map ops",
"Migrate ai-test-generation.ts, natural-language-tests.ts, vulnerability-tracking.ts",
"Import getProject and listProjects from ../projects/stores",
"Remove all Map imports",
"Verify: grep -rn projects.get backend/src/routes/github/ outputs 0 results",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2113, 3, 'Backend/Routes',
'Migrate monitoring route files to async DB calls',
'Migrate ALL files in backend/src/routes/monitoring/ that use Map operations.',
'["Check monitoring/stores.ts for available async functions",
"Migrate uptime.ts, webhooks.ts, dns-tcp.ts, incidents.ts",
"Migrate status-pages.ts, on-call-escalation.ts, alert-correlation.ts",
"Migrate alert-grouping-routing.ts, maintenance.ts, reports.ts, helpers.ts",
"Replace all Map.get/set/delete/values with async DB functions",
"Verify: grep -rn .get(.*).values() backend/src/routes/monitoring/ for Map ops outputs 0",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2114, 3, 'Backend/Routes',
'Migrate SAST route files to async DB calls',
'Migrate ALL files in backend/src/routes/sast/ that use Map operations.',
'["Check sast/stores.ts for available async functions",
"Migrate routes.ts, gitleaks.ts, secret-patterns.ts",
"Migrate secret-remediation.ts, secret-verification.ts",
"Replace all Map operations with async DB functions",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2115, 3, 'Backend/Routes',
'Migrate DAST route files to async DB calls',
'Migrate ALL files in backend/src/routes/dast/ that use Map operations.',
'["Check dast/stores.ts for available async functions",
"Migrate routes.ts and any other files with Map usage",
"Replace all Map operations with async DB functions",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2116, 3, 'Backend/Routes',
'Migrate auth.ts route file to async DB calls',
'File backend/src/routes/auth.ts. Replace any Map operations and ensure crypto.randomUUID() for all ID generation.',
'["Read auth.ts and find all Map operations",
"Replace any Map.get/set/values with async DB functions",
"Ensure registration uses crypto.randomUUID() for org/user IDs NOT String(Date.now())",
"Verify: grep -c String.Date.now backend/src/routes/auth.ts outputs 0",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2117, 3, 'Backend/Routes',
'Migrate schedules.ts to async DB calls',
'File backend/src/routes/schedules.ts. Replace Map operations with async DB calls.',
'["Read schedules.ts and find all Map operations",
"Replace Array.from(testRuns.values()) with await listTestRunsByOrg(orgId) or similar",
"Replace any other Map.get/set calls with async DB functions",
"Ensure ID generation uses crypto.randomUUID()",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2118, 3, 'Backend/Routes',
'Migrate AI test generator route files to async DB calls',
'Migrate files in backend/src/routes/ai-test-generator/ that use Map operations.',
'["Check ai-test-generator/stores.ts for available async functions",
"Migrate routes.ts and any other files with Map usage",
"Replace all Map operations with async DB functions",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2119, 3, 'Backend/Routes',
'Migrate remaining route files to async DB calls',
'Migrate any remaining route files not covered by features 2103-2118.',
'["Check backend/src/routes/test-suites/ai-coverage.ts for Map ops",
"Check remaining test-runs files: ai-analysis.ts, baseline-routes.ts, browser-viewport-routes.ts",
"Check: execute-test-helpers.ts, explanations.ts, failure-patterns-routes.ts, healing.ts",
"Check: k6-helpers.ts, load-test-executor.ts, recording-routes.ts, test-simulation.ts",
"Check: visual-regression.ts, visual-storage-routes.ts, webhooks.ts",
"Replace all Map operations with async DB calls",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2120, 3, 'Backend/Routes',
'Migrate MCP tool handlers to async DB calls',
'File backend/src/routes/mcp-tools/routes.ts. Replace any Map operations with async DB calls.',
'["Read mcp-tools/routes.ts and find all Map operations",
"Replace any Map.get/set/values/entries with async DB function calls",
"Import appropriate functions from stores.ts files",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

-- ============================================================================
-- PHASE 5: Cleanup & Final Verification - Features 2121-2122
-- ============================================================================

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2121, 2, 'Backend/Cleanup',
'Remove store-sync.ts bridge and empty Map exports',
'After ALL route files are migrated to async DB calls, remove the temporary bridge.',
'["Delete backend/src/store-sync.ts",
"Remove initializeStoreSync/stopStoreSync imports and calls from backend/src/index.ts",
"Delete backend/src/routes/projects/maps.ts",
"Delete backend/src/routes/test-suites/maps.ts",
"Remove empty Map re-exports from projects/index.ts and test-suites/index.ts",
"Remove getMemoryTestRuns, getMemorySelectorOverrides, getMemoryHealedSelectorHistory from services/repositories/test-runs.ts",
"Verify: ls backend/src/store-sync.ts must say No such file",
"Verify: cd backend && npx tsc --noEmit must show zero errors"]',
0, 0);

INSERT INTO features (id, priority, category, name, description, steps, passes, in_progress)
VALUES (2122, 1, 'QA/Verification',
'Final verification - zero Map stores, all async DB',
'Run ALL verification checks. Mark passing ONLY if ALL checks pass.',
'["Run: grep -rn getMemory backend/src/ --include=*.ts | wc -l must output 0",
"Run: grep -rn String(Date.now()) backend/src/ --include=*.ts | wc -l must output 0",
"Run: grep -rn new Proxy backend/src/routes/ --include=*.ts | wc -l must output 0",
"Verify route files have ZERO Map.get/values/entries on data Maps (only runningBrowsers and rateLimitStore allowed)",
"Run: cd backend && npx tsc --noEmit must pass with zero errors",
"Verify app starts without TypeError crashes in logs",
"Verify no Cannot read properties of undefined errors"]',
0, 0);

-- ============================================================================
-- Summary
-- ============================================================================
SELECT '========================================';
SELECT 'PIPELINE v3 FEATURES IMPORTED';
SELECT '========================================';
SELECT id || ' [P' || priority || '] ' || name FROM features WHERE id >= 2100 AND id <= 2122 ORDER BY id;
SELECT '========================================';
SELECT 'Total: ' || COUNT(*) FROM features WHERE id >= 2100 AND id <= 2122;
SELECT 'Critical (P1): ' || COUNT(*) FROM features WHERE id >= 2100 AND id <= 2122 AND priority = 1;
SELECT 'High (P2): ' || COUNT(*) FROM features WHERE id >= 2100 AND id <= 2122 AND priority = 2;
SELECT 'Medium (P3): ' || COUNT(*) FROM features WHERE id >= 2100 AND id <= 2122 AND priority = 3;
