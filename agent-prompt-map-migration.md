# Agent Task: Migrate Route Files from In-Memory Maps to Async Database Calls

## ⛔ MANDATORY RULES - READ BEFORE DOING ANYTHING

1. **DO NOT mark a feature as passing unless you have ACTUALLY completed the work AND run the verification command.** A previous agent falsely marked all 23 features as passing without doing the work. If you do this, the deployment will fail and crash in production.

2. **After EVERY feature, you MUST run the verification command listed in that feature's description.** Paste the output. If the verification fails, DO NOT mark the feature as passing.

3. **Work on features IN ORDER by ID** (2100, 2101, 2102, ...). Do not skip ahead.

4. **NEVER use `String(Date.now())` for IDs.** PostgreSQL columns are UUID type. Always use `crypto.randomUUID()`.

5. **NEVER revert existing `crypto.randomUUID()` calls back to `Date.now()`.** This was a critical production bug fix.

6. **Do NOT modify `backend/src/services/repositories/*.ts`** - these are already correct.

7. **Do NOT modify `backend/src/routes/*/stores.ts`** - these are already migrated.

## CRITICAL CONTEXT

The codebase is broken in production. Here's what happened:
1. A previous agent removed data from in-memory `Map` stores and migrated `stores.ts` files to export async database functions
2. But the agent did NOT migrate the **route files** that consume these stores - they still use synchronous Map operations like `.get()`, `.values()`, `.entries()`
3. The `index.ts` barrel files export **empty Maps** (never populated) for "backward compatibility"
4. Result: **every data lookup in every route returns `undefined`** - the entire application is broken

## WHAT YOU MUST DO

There are 23 features in the pipeline (IDs 2100-2122). Work through them IN ORDER. Each feature has a specific task and verification step.

### PHASE 1: Emergency Stability Fix (Features 2100-2102)

Create a bridge that populates empty Maps from PostgreSQL on startup so the app works immediately.

**Feature 2100**: Create `maps.ts` files to break circular dependencies.
- Create `backend/src/routes/projects/maps.ts` with: `export const projects = new Map<string, Project>()` and similar for projectMembers, projectEnvVars, projectVisualSettings, projectHealingSettings. Import types from `./types`.
- Create `backend/src/routes/test-suites/maps.ts` with: `export const testSuites = new Map<string, TestSuite>()` and `export const tests = new Map<string, Test>()`. Import types from `./types`.
- Update `backend/src/routes/projects/index.ts`: remove the inline `export const projects = new Map<>()` lines (around line 26), replace with `export { projects, projectMembers, projectEnvVars, projectVisualSettings, projectHealingSettings } from './maps';`
- Update `backend/src/routes/test-suites/index.ts`: remove the inline `export const testSuites = new Map<>()` and `export const tests = new Map<>()` lines (around line 42-43), replace with `export { testSuites, tests } from './maps';`
- Fix `backend/src/routes/projects/flaky-tests.ts`: change `import { projects } from './stores'` to `import { projects } from './maps'`
- Fix `backend/src/routes/projects/remediation.ts`: same change
- **VERIFICATION**: `cd backend && npx tsc --noEmit 2>&1 | head -20` — must show zero errors

**Feature 2101**: Create `backend/src/store-sync.ts` bridge module.
```typescript
import { isDatabaseConnected } from './services/database';
import { getProjectsMap } from './services/repositories/projects';
import { getTestSuitesMap, getTestsMap } from './services/repositories/test-suites';
import { projects, projectMembers, projectEnvVars } from './routes/projects/maps';
import { testSuites, tests } from './routes/test-suites/maps';

async function syncAllStores(): Promise<void> {
  if (!isDatabaseConnected()) return;
  try {
    const dbProjects = await getProjectsMap();
    projects.clear();
    for (const [k, v] of dbProjects) projects.set(k, v);

    const dbSuites = await getTestSuitesMap();
    testSuites.clear();
    for (const [k, v] of dbSuites) testSuites.set(k, v);

    const dbTests = await getTestsMap();
    tests.clear();
    for (const [k, v] of dbTests) tests.set(k, v);

    console.log(`[StoreSync] Loaded ${projects.size} projects, ${testSuites.size} suites, ${tests.size} tests from DB`);
  } catch (err) {
    console.error('[StoreSync] Error syncing stores:', err);
  }
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export async function initializeStoreSync(): Promise<void> {
  await syncAllStores();
  syncInterval = setInterval(syncAllStores, 30_000);
  console.log('[StoreSync] Initialized (30s refresh)');
}

export function stopStoreSync(): void {
  if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
}
```
- **VERIFICATION**: `cd backend && npx tsc --noEmit 2>&1 | head -20` — must show zero errors

**Feature 2102**: Wire store-sync into `backend/src/index.ts`.
- Add import: `import { initializeStoreSync, stopStoreSync } from './store-sync';`
- After the line `console.log('[Startup] PostgreSQL database connected - data will persist');` add: `await initializeStoreSync();`
- In SIGTERM handler before `await closeDatabase()`: `stopStoreSync();`
- In SIGINT handler before `await closeDatabase()`: `stopStoreSync();`
- **VERIFICATION**: `cd backend && npx tsc --noEmit 2>&1 | head -20` — must show zero errors
- **VERIFICATION 2**: `grep -n 'initializeStoreSync\|stopStoreSync' backend/src/index.ts` — must show 4 lines (1 import + 1 init + 2 shutdown)

### PHASE 2: Async Migration - Crashing Routes (Features 2103-2106)

Replace synchronous Map operations with async database calls in 4 files that crash in production.

**Pattern to follow in ALL migration features:**

BEFORE (synchronous Map - BROKEN):
```typescript
const project = projects.get(projectId);
```
AFTER (async database - CORRECT):
```typescript
const project = await getProject(projectId);
```

BEFORE:
```typescript
const orgRuns = Array.from(testRuns.values()).filter(r => r.organization_id === orgId);
```
AFTER:
```typescript
const orgRuns = await listTestRunsByOrg(orgId);
```

**Available async functions:**
- From `projects/stores.ts`: getProject, listProjects, getProjectByName, createProject, updateProject, deleteProject, getProjectMembers, addProjectMember, removeProjectMember, isProjectMember, getProjectVisualSettings, getProjectHealingSettings, getProjectEnvVars
- From `test-suites/stores.ts`: getTestSuite, listTestSuites, listAllTestSuites, getTest, listTests, listAllTests, createTestSuite, updateTestSuite, deleteTestSuite, createTest, updateTest, deleteTest
- From `services/repositories/test-runs.ts`: getTestRun, createTestRun, updateTestRun, deleteTestRun, listTestRunsBySuite, listTestRunsByProject, listTestRunsByOrg, getRecentTestRuns

**Feature 2103**: Migrate `backend/src/routes/projects/flaky-tests.ts`
- Replace all `tests.get()`, `testSuites.get()`, `projects.get()`, `testRuns.values()` with async calls
- Remove Map imports, add async function imports
- **VERIFICATION**: `grep -c 'testRuns\.values\|testRuns\.get\|testRuns\.entries\|tests\.get\|testSuites\.get\|projects\.get' backend/src/routes/projects/flaky-tests.ts` — must output `0`
- **VERIFICATION 2**: `cd backend && npx tsc --noEmit 2>&1 | head -20` — zero errors

**Feature 2104**: Migrate `backend/src/routes/test-runs.ts`
- Fix `checkAndSendAlerts`: `projects.get()` → `await getProject()`
- Fix any `testRuns.get()` → `await getTestRun()`
- **VERIFICATION**: `grep -c 'projects\.get\|projects\.values\|projects\.entries' backend/src/routes/test-runs.ts` — must output `0`
- **VERIFICATION 2**: `cd backend && npx tsc --noEmit 2>&1 | head -20` — zero errors

**Feature 2105**: Migrate `backend/src/routes/projects/remediation.ts`
- Same pattern as 2103
- **VERIFICATION**: `grep -c 'testRuns\.values\|tests\.get\|testSuites\.get\|projects\.get' backend/src/routes/projects/remediation.ts` — must output `0`
- **VERIFICATION 2**: `cd backend && npx tsc --noEmit 2>&1 | head -20`

**Feature 2106**: Migrate `backend/src/routes/projects/analytics.ts`
- Same pattern
- **VERIFICATION**: `grep -c 'tests\.get\|testSuites\.get' backend/src/routes/projects/analytics.ts` — must output `0`
- **VERIFICATION 2**: `cd backend && npx tsc --noEmit 2>&1 | head -20`

### PHASE 3: Core Routes (Features 2107-2111)

**Feature 2107**: Migrate `backend/src/routes/projects/routes.ts`
- `Array.from(testSuites.values()).filter(s => s.project_id === id)` → `await listTestSuites(id, orgId)`
- **VERIFICATION**: `grep -c 'testSuites\.values\|testSuites\.get' backend/src/routes/projects/routes.ts` — must output `0`

**Feature 2108**: Migrate `backend/src/routes/test-suites/routes.ts`
- `Array.from(testRuns.values())` → `await listTestRunsBySuite(suiteId)`
- **VERIFICATION**: `grep -c 'testRuns\.values\|testRuns\.get' backend/src/routes/test-suites/routes.ts` — must output `0`

**Feature 2109**: Migrate `backend/src/routes/organizations.ts`
- Many Map operations to replace
- **VERIFICATION**: `grep -c 'testSuites\.values\|testSuites\.get\|tests\.values\|tests\.get\|projects\.get' backend/src/routes/organizations.ts` — must output `0`

**Feature 2110**: Migrate 7 files in `backend/src/routes/test-runs/`:
- run-core-routes.ts, run-data-routes.ts, run-control-routes.ts, results-routes.ts, alert-channels.ts, artifact-routes.ts
- SPECIAL: execution.ts `testRuns` Map stays for in-flight runs. `runningBrowsers` Map MUST stay.
- **VERIFICATION**: For each file: `grep -c 'testRuns\.get\|testRuns\.values\|testRuns\.entries\|projects\.get\|projects\.values' backend/src/routes/test-runs/FILE.ts` — must output `0` (except execution.ts which keeps testRuns for in-flight state)

**Feature 2111**: Migrate 15 supplementary files in `backend/src/routes/test-runs/`:
- run-trigger-routes.ts, selector-override-routes.ts, visual-approval-routes.ts, visual-batch-routes.ts, review-export-routes.ts, healing-routes.ts, test-executor.ts, ai-failure-analysis.ts, webhook-events.ts, webhook-subscriptions.ts, security.ts, security-advanced.ts, slack-integration.ts, organization-settings.ts
- **VERIFICATION**: Same grep pattern per file — must output `0`

### PHASE 4: Remaining Routes (Features 2112-2120)

**Feature 2112**: Migrate `backend/src/routes/github/*.ts` (core.ts has ~12 instances of projects.get)
**Feature 2113**: Migrate `backend/src/routes/monitoring/*.ts`
**Feature 2114**: Migrate `backend/src/routes/sast/*.ts`
**Feature 2115**: Migrate `backend/src/routes/dast/*.ts`
**Feature 2116**: Migrate `backend/src/routes/auth.ts`
**Feature 2117**: Migrate `backend/src/routes/schedules.ts`
**Feature 2118**: Migrate `backend/src/routes/ai-test-generator/*.ts`
**Feature 2119**: Migrate remaining route files
**Feature 2120**: Migrate `backend/src/routes/mcp-tools/routes.ts`

For each: replace Map operations with async DB calls. Verify with grep that zero Map operations remain. Verify with `npx tsc --noEmit`.

### PHASE 5: Cleanup (Features 2121-2122)

**Feature 2121**: Remove store-sync bridge
- Delete `backend/src/store-sync.ts`
- Delete `backend/src/routes/projects/maps.ts`
- Delete `backend/src/routes/test-suites/maps.ts`
- Remove imports from `backend/src/index.ts`
- Remove Map re-exports from index.ts files
- **VERIFICATION**: `ls backend/src/store-sync.ts 2>&1` — must say "No such file"
- **VERIFICATION 2**: `cd backend && npx tsc --noEmit 2>&1 | head -20`

**Feature 2122**: Final verification
Run ALL checks — mark passing ONLY if ALL pass:
1. `grep -rn 'getMemory' backend/src/ --include='*.ts' | grep -v node_modules | wc -l` → 0
2. `grep -rn 'String(Date.now())' backend/src/ --include='*.ts' | grep -v node_modules | wc -l` → 0
3. `grep -rn 'new Proxy' backend/src/routes/ --include='*.ts' | grep -v node_modules | wc -l` → 0
4. `cd backend && npx tsc --noEmit 2>&1 | head -5` → zero errors

## IMPORTANT NOTES

- The agent runs against codebase at the PROJECT_DIR. The features.db is in the same directory.
- PostgreSQL connection: `postgresql://qa_guardian:QaGuardian2024Secure@localhost:5432/qa_guardian`
- The `testRuns` Map in `execution.ts` is SPECIAL — it holds in-flight browser test state. Keep it for active runs. The `runningBrowsers` Map MUST stay in-memory (Browser instances cannot be serialized).
- Compile check after EVERY file: `cd backend && npx tsc --noEmit`
