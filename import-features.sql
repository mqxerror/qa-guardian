-- Import features for "Remove In-Memory Maps and Use Database-Only Storage" refactoring
-- Run with: sqlite3 features.db < import-features.sql

-- Feature 2100: Remove Memory Maps from test-suites Repository
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2100,
  'Backend/DataLayer',
  'Remove Memory Maps from test-suites Repository',
  'Remove memoryTestSuites and memoryTests Maps from backend/src/services/repositories/test-suites.ts. Remove all memory fallback logic and getMemoryTestSuites(), getMemoryTests() exports. This is critical to fix the not found errors after server restarts.',
  'pending',
  'critical',
  '1. Delete const memoryTestSuites and memoryTests Map declarations (lines 12-13)
2. Remove memory fallbacks in createTestSuite(), getTestSuite(), updateTestSuite(), deleteTestSuite(), listTestSuites(), listAllTestSuites()
3. Remove memory fallbacks in createTest(), getTest(), updateTest(), deleteTest(), listTests(), listAllTests()
4. Delete getMemoryTestSuites() and getMemoryTests() functions (lines 519-525)
5. Delete getTestSuitesMap() and getTestsMap() compatibility functions (lines 530-567)
6. Rebuild and test',
  datetime('now')
);

-- Feature 2101: Remove Memory Maps from projects Repository
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2101,
  'Backend/DataLayer',
  'Remove Memory Maps from projects Repository',
  'Remove 5 memory Maps from backend/src/services/repositories/projects.ts: memoryProjects, memoryProjectMembers, memoryProjectEnvVars, memoryProjectVisualSettings, memoryProjectHealingSettings.',
  'pending',
  'critical',
  '1. Delete all 5 memory Map declarations (lines 23-27)
2. Remove memory fallbacks from all project CRUD functions
3. Remove memory fallbacks from member, settings, and env var functions
4. Delete getMemoryProjects() and related exports (lines 456-474)
5. Delete getProjectsMap() function (lines 433-450)
6. Rebuild and test',
  datetime('now')
);

-- Feature 2102: Remove Memory Maps from organizations Repository
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2102,
  'Backend/DataLayer',
  'Remove Memory Maps from organizations Repository',
  'Remove 5 memory Maps from backend/src/services/repositories/organizations.ts: memoryOrganizations, memoryOrganizationMembers, memoryInvitations, memoryAutoQuarantineSettings, memoryRetryStrategySettings.',
  'pending',
  'critical',
  '1. Delete all 5 memory Map declarations (lines 88-92)
2. Remove memory fallbacks from all organization CRUD functions
3. Remove memory fallbacks from member, invitation, and settings functions
4. Delete getMemoryOrganizations() and related exports
5. Rebuild and test',
  datetime('now')
);

-- Feature 2103: Update test-suites stores.ts
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2103,
  'Backend/DataLayer',
  'Update test-suites stores.ts',
  'Update backend/src/routes/test-suites/stores.ts to stop exporting memory Maps. Keep only async database function exports.',
  'pending',
  'high',
  '1. Remove imports of getMemoryTestSuites, getMemoryTests (lines 23-24)
2. Remove exports of testSuites and tests Maps (lines 29-30)
3. Keep only async database function exports
4. Update all files that import from stores.ts to use async functions',
  datetime('now')
);

-- Feature 2104: Update Route Files to Use Async Repository Functions
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2104,
  'Backend/DataLayer',
  'Update Route Files to Use Async Repository Functions',
  'Update 94 route files to use async repository functions instead of direct Map operations. Replace synchronous Map.get/set/delete with await getX/createX/deleteX calls.',
  'pending',
  'high',
  '1. Replace testSuites.get(id) with await getTestSuite(id)
2. Replace testSuites.set(id, data) with await createTestSuite(data)
3. Replace testSuites.delete(id) with await deleteTestSuite(id)
4. Replace tests.get(id) with await getTest(id)
5. Replace projects.get(id) with await getProject(id)
6. Replace Array.from(*.values()) with await listAll*()
7. Ensure all route handlers are async
8. Test each route after update',
  datetime('now')
);

-- Feature 2105: Remove Memory Maps from Other Repositories
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2105,
  'Backend/DataLayer',
  'Remove Memory Maps from Other Repositories',
  'Remove memory fallbacks from remaining 11 repository files: ai-test-generator, auth, audit-logs, schedules, reports, sast, dast, github, monitoring, api-keys, test-runs.',
  'pending',
  'medium',
  '1. ai-test-generator.ts - Remove memory fallbacks
2. auth.ts - Evaluate session handling, remove memory fallbacks
3. audit-logs.ts - Remove memory fallbacks
4. schedules.ts - Remove memory fallbacks
5. reports.ts - Remove memory fallbacks
6. sast.ts - Remove memory fallbacks
7. dast.ts - Remove memory fallbacks
8. github.ts - Remove memory fallbacks
9. monitoring.ts - Remove memory fallbacks
10. api-keys.ts - Remove memory fallbacks
11. test-runs.ts - Remove memory fallbacks',
  datetime('now')
);

-- Feature 2106: Remove All Route Store Files Memory Exports
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2106,
  'Backend/DataLayer',
  'Remove All Route Store Files Memory Exports',
  'Update or remove 8 stores.ts files in routes that export memory Maps. Update to only export async database functions.',
  'pending',
  'medium',
  '1. routes/projects/stores.ts - Update
2. routes/api-keys/stores.ts - Update
3. routes/monitoring/stores.ts - Update
4. routes/github/stores.ts - Update
5. routes/dast/stores.ts - Update
6. routes/sast/stores.ts - Update
7. routes/ai-test-generator/stores.ts - Update
8. routes/reports/stores.ts - Update',
  datetime('now')
);

-- Feature 2107: Final Verification - Database-Only Storage
INSERT OR REPLACE INTO features (id, category, name, description, status, priority, steps, created_at)
VALUES (
  2107,
  'QA/Testing',
  'Final Verification - Database-Only Storage',
  'Comprehensive testing after all memory removal. Verify PostgreSQL is the single source of truth and no not found errors occur after restart.',
  'pending',
  'critical',
  '1. Rebuild backend: docker compose build --no-cache backend
2. Restart container
3. Create test suite and verify it exists
4. Restart container again
5. Verify test suite still exists (proves DB read works)
6. Test all CRUD: projects, test suites, tests, organizations
7. Check logs: docker compose logs --tail=100 backend
8. Verify no not found errors
9. Grep codebase to confirm no memoryXxx variables remain
10. Grep codebase to confirm no Map data storage operations',
  datetime('now')
);

-- Show what was inserted
SELECT id, name, priority, status FROM features WHERE id >= 2100 ORDER BY id;
