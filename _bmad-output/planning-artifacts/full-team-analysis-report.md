# QA-Dam3oun Full Team Analysis Report

**Date:** 2026-03-21
**Method:** 5 parallel deep-dive agents, each with independent context
**Scope:** Complete functionality audit — backend, frontend, worker, auth/integrations, database

---

## Executive Summary

The QA-Dam3oun platform has **5 systemic root causes** explaining why most features don't work:

| # | Root Cause | Impact | Endpoints Affected |
|---|-----------|--------|-------------------|
| 1 | In-memory Maps instead of DB persistence | Data lost on restart, empty responses | ~90+ |
| 2 | Frontend VITE_API_URL double-origin bug | CORS failures, broken API calls | ~40 references in 18 files |
| 3 | Worker isolation gaps | Webhooks/alerts never fire from worker | All run completions |
| 4 | Simulated integrations | GitHub, Email, Slack are fake | All integration features |
| 5 | Dual schema system | SQL errors at runtime | Visual testing, selector healing |

---

## Issue 1: In-Memory Maps (CRITICAL)

### Root Cause
`stores.ts` files export both deprecated `new Map()` objects AND async DB repository functions. Route handlers import the empty Maps instead of the DB functions. Data is lost on every container restart.

### Affected Modules

| Module | Maps | Route Files Using Maps | Priority |
|--------|------|----------------------|----------|
| monitoring | 25 Maps (12 alert-specific) | alert-grouping.ts, alert-routing.ts, alert-correlation.ts, incidents.ts, helpers.ts, reports.ts | CRITICAL |
| github | 5 Maps | core.ts, dependency-scanning.ts, github-webhooks.ts | HIGH |
| dast | 6 Maps | Routes don't import Maps directly | LOW |
| sast | 6 Maps | Routes don't import Maps directly | LOW |
| ai-test-generator | 6 Maps | Routes don't import Maps directly | LOW |

### Monitoring Module Detail (Most Critical)

**Alert Grouping** (`alert-grouping.ts`): Uses `alertGroupingRules.set/get/delete/values()` and `alertGroups.set/get()` — 13+ endpoints broken

**Alert Routing** (`alert-routing.ts`): Uses `alertRoutingRules`, `alertRateLimitConfigs`, `alertRateLimitStates` — 5+ endpoints broken

**Alert Correlation** (`alert-correlation.ts`): Uses `alertCorrelationConfigs`, `alertCorrelations`, `alertToCorrelation`, `alertRunbooks` — 8+ endpoints broken

**Incidents** (`incidents.ts`): Uses `managedIncidents`, `incidentsByOrg` — 8+ endpoints broken. NOTE: `reports.ts` line 19 says "managedIncidents / incidentsByOrg have no async DB functions yet" — these need to be implemented first.

### GitHub Module Detail

**core.ts**: `githubConnections.set/get()` at 15+ locations, `prStatusChecks.set/get()` at 6+ locations

**dependency-scanning.ts**: `githubConnections.set/get()` at 4 locations, `prStatusChecks` at 2 locations

**github-webhooks.ts**: `prStatusChecks.set/get()` at 3 locations

### Exception
`checkIntervals` Map in monitoring stores MUST remain in-memory (stores `NodeJS.Timeout` objects).

---

## Issue 2: Frontend VITE_API_URL Double-Origin Bug (HIGH)

### Root Cause
Files construct URLs like `${import.meta.env.VITE_API_URL}/api/v1/...` which creates double-origin URLs (e.g., `https://qa.pixelcraftedmedia.com/api/v1/tests` when the page is already served from that origin). The correct pattern is relative paths `/api/v1/...`.

### Affected Files (18 files, ~40 references)

| File | Lines | Issue |
|------|-------|-------|
| AIAnalyticsPage.tsx | 20, 57, 65, 73, 81, 102, 122, 137 | `API_BASE` + fetchWithAuth |
| CreateTestModal.tsx | 392-394, 496-498 | Conditional double origin |
| RecordStep.tsx | 176, 258 | localhost:3001 hardcoded fallback |
| useTestDetailActions.ts | 76, 105, 140, 170, 214, 242 | Raw fetch() + VITE_API_BASE_URL |
| AIRouterPage.tsx | 46-51, 68, 80, 91, 102 | Raw fetch() + VITE_API_BASE_URL |
| useFlakyTestsModals.ts | 157 | Mixed patterns (line 99 correct, 157 wrong) |
| useFlakyTests.ts | 287 | Raw fetch + VITE_API_BASE_URL |
| SbomPage.tsx | 21 | localhost:3001 fallback |
| DASTComparisonPage.tsx | 20, 37, 51 | localhost:3001 as default state |
| ProviderHealthPage.tsx | 20 | VITE_API_URL pattern |
| UnifiedAIService.ts | 18, 153, 197 | VITE_API_URL pattern |
| useAI.ts | 17 | Variable defined (mostly unused) |
| test-modals/hooks.ts | 11, 290, 595 | VITE_API_URL pattern |
| useTestPageUtilities.ts | 69 | VITE_API_BASE_URL |
| useSettingsHandlers.ts | 627 | VITE_API_BASE_URL |
| useStepHandlers.ts | 331 | VITE_API_BASE_URL |
| TestAISummary.tsx | 124, 164 | VITE_API_BASE_URL |
| BatchAnalysisModal.tsx | 75 | VITE_API_BASE_URL |
| VideoPlayer.tsx | 25, 61 | VITE_API_BASE_URL |
| useReports.ts | 59 | VITE_API_BASE_URL |
| LoginPage.tsx | 187 | Google OAuth redirect (needs special handling) |

### Correct Pattern
```typescript
// WRONG
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
fetch(`${API_BASE}/api/v1/tests/${testId}`)

// CORRECT
fetchWithAuth(`/api/v1/tests/${testId}`, token)
```

---

## Issue 3: Worker Isolation Gaps (HIGH)

- Quick Test runs Playwright directly on API server (bypasses BullMQ queue), contradicts API-only production mode
- Webhooks don't fire from worker — `webhookSubscriptions` Map empty in worker container
- Alert channels don't fire from worker — same in-memory Map issue
- Final DB write for test results is fire-and-forget (`.catch()`) — data loss risk

---

## Issue 4: Simulated Integrations (MEDIUM)

- GitHub integration is 100% simulated (hardcoded demo data, fake tokens)
- Email notifications only log to console (no SMTP client)
- Slack notifications only log to console
- Google OAuth referenced but zero implementation
- `ENCRYPTION_KEY` missing — encryption service silently returns plaintext
- AI provider config hardcodes `org-001` instead of using JWT org
- PR comment URLs hardcoded to `localhost:5173`

---

## Issue 5: Dual Schema System (CRITICAL)

### Schema Conflicts

| Table | Inline Schema | Migration Schema | Match |
|-------|---------------|------------------|-------|
| `healed_selector_history` | 22 columns (VARCHAR IDs) | 10 columns (UUID IDs) | NO — 12+ columns missing from migration |
| `selector_overrides` | 11 cols (`new_selector`) | 11 cols (`healed_selector`) | NO — different column names and types |
| `quick_test_comparisons` | Exists in inline only | NO MIGRATION | Incomplete |
| `quick_test_schedules` | Exists in inline only | NO MIGRATION | Incomplete |

### Column Reference Bug
`HEALED_SELECTOR_COLUMNS` in `test-runs.ts:88` references `approved`, `approved_by`, `approved_at` — these columns exist in NEITHER schema definition. Any query using this constant fails at runtime.

### N+1 Query Pattern
`analytics.ts:202-205` — failing-tests endpoint runs `getTest()` + `getTestSuite()` inside a double-nested loop. 20 runs × 50 results = 1,000+ individual DB queries.

### Dead Code
`emitRunProgress()` in `websocket-events.ts:118` — exported but never called anywhere.

### Fire-and-Forget DB Writes
`run-orchestrator.ts:163,432` — test run status updates are non-awaited with only `.catch(log)`. No retry, no recovery.

---

## Prioritized Fix Order

### Tier 1: Fix Real Bugs (This Session)
1. **Frontend VITE_API_URL removal** — 18 files, switch to relative paths (unblocks all frontend API calls)
2. **HEALED_SELECTOR_COLUMNS fix** — align with actual schema columns (unblocks selector healing)
3. **N+1 query fix** — batch-load tests/suites in analytics endpoint

### Tier 2: Map→DB Migration (Next Session)
4. **GitHub routes** — swap Map imports for DB function calls in core.ts, dependency-scanning.ts, webhooks.ts
5. **Monitoring alert routes** — swap Maps for DB functions (largest migration, ~50+ call sites)
6. **Monitoring incidents** — implement missing DB functions first, then swap

### Tier 3: Schema Consolidation
7. **Create missing migrations** for quick_test_comparisons and quick_test_schedules
8. **Align healed_selector_history** — pick one schema as source of truth
9. **Align selector_overrides** — standardize column names

### Tier 4: Integration & Worker Fixes
10. **Worker webhook hydration** — load webhook subscriptions from DB on worker startup
11. **Quick Test queue routing** — route through BullMQ instead of direct Playwright
12. **Await critical DB writes** — make run status persistence synchronous

---

*Report generated by 5 parallel deep-dive agents with independent analysis contexts.*
