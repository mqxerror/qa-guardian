# QA Guardian - Post-Implementation Reassessment Round 2
## BMAD Party Team Review | 2026-02-06

**Project:** QA-Dam3oun (QA Guardian) at `https://qa.pixelcraftedmedia.com`
**Previous Assessment:** CONDITIONAL-GO (72/100) with 5 conditions
**Current Status:** 229/229 features passing (100%)
**Build Health:** Backend tsc: 0 errors | ESLint: 0 errors | Frontend tsc: 0 errors | ESLint: 0 errors

---

## Executive Summary

The autonomous agent successfully implemented all 13 remediation features (#218-#230). The TEA and Architect assessments both give full clearance. However, the code review uncovered **2 new CRITICAL bugs** that were missed by the agent and need immediate attention.

### Verdicts

| Agent | Role | Verdict | Score |
|-------|------|---------|-------|
| **Murat (TEA)** | NFR Assessment | **GO** | 13/13 PASS |
| **Winston (Architect)** | Architecture & Scalability | **READY** | 7/7 SOLID |
| **Code Review** | Quality & Correctness | **62/100** | 2 CRITICAL blocking |

---

## Previous Conditions Status - ALL RESOLVED

| Priority | Condition | Features | Status |
|----------|-----------|----------|--------|
| P0 | Remove Socket.IO unauthenticated bypass, add auth to join-run | #218, #219 | **RESOLVED** |
| P0 | Hash session/reset tokens before DB storage | #222, #223 | **RESOLVED** |
| P1 | Persist refresh tokens in Redis/PostgreSQL | #221, #225 | **RESOLVED** |
| P1 | Install @socket.io/redis-adapter | #227 | **RESOLVED** |
| P2 | Add ENCRYPTION_KEY to production compose | #220 | **RESOLVED** |
| P3 | Use crypto.timingSafeEqual | #228 | **RESOLVED** |

---

## Feature-by-Feature Assessment

| # | Feature | TEA | Architect | Code Review |
|---|---------|-----|-----------|-------------|
| 218 | Socket.IO frontend token fix | PASS | N/A | PASS (but incomplete scope) |
| 219 | Socket.IO auth bypass removal | PASS | N/A | PASS |
| 220 | ENCRYPTION_KEY in docker-compose | PASS | N/A | PASS |
| 221 | Refresh token persistence (PostgreSQL) | PASS | SOLID | PASS |
| 222 | Session token hashing | PASS | N/A | PASS |
| 223 | Reset token hashing | PASS | N/A | PASS (but RESET_TOKEN_COLUMNS broken) |
| 224 | Redis reconnection with backoff | PASS | SOLID | PASS (minor client leak concern) |
| 225 | Refresh token rotation | PASS | SOLID | PASS (race condition noted) |
| 226 | Background token refresh timer | PASS | SOLID | PASS |
| 227 | @socket.io/redis-adapter | PASS | SOLID | PASS (missing shutdown cleanup) |
| 228 | crypto.timingSafeEqual | PASS | N/A | PASS (length leak noted) |
| 229 | PBKDF2 random salt v2 | PASS | SOLID | PASS (no v1->v2 migration) |
| 230 | Migration file | PASS | SOLID | PASS |

---

# NEW FINDINGS FROM CODE REVIEW

## CRITICAL-1: RESET_TOKEN_COLUMNS SQL Column Mismatch - Password Reset BROKEN
**Code Review | Severity: CRITICAL | Impact: Password reset non-functional in production**

**File:** `backend/src/services/repositories/auth.ts`, lines 80-82

The `RESET_TOKEN_COLUMNS` constant references columns that don't exist in the database:
```typescript
const RESET_TOKEN_COLUMNS = ['email', 'token_hash', 'created_at', 'used'].join(', ');
```

Actual DB columns (from `database.ts` line 344-351): `id`, `token_hash`, `user_email`, `expires_at`, `used_at`, `created_at`

- `email` should be `user_email`
- `used` should be `used_at`

**Impact:** Any `SELECT` using this constant produces a PostgreSQL error. Password reset is completely broken in production.

**Fix:** Change to `['token_hash', 'user_email', 'created_at', 'used_at']`

---

## CRITICAL-2: 14 Frontend Pages Still Use `localStorage.getItem('token')`
**Code Review | Severity: CRITICAL | Impact: 14 feature pages send unauthenticated API requests**

Feature #218 fixed `socketStore.ts` but the same broken pattern exists in **14 other page components**:

| File | Line |
|------|------|
| `pages/AICostTrackingPage.tsx` | 57 |
| `pages/KieAIProviderPage.tsx` | 68 |
| `pages/ScanCachingPage.tsx` | 66 |
| `pages/ExploitabilityAnalysisPage.tsx` | 52 |
| `pages/AnthropicProviderPage.tsx` | 54 |
| `pages/DASTGraphQLPage.tsx` | 145 |
| `pages/VulnerabilityHistoryPage.tsx` | 44 |
| `pages/ProviderHealthPage.tsx` | 69 |
| `pages/AIRouterPage.tsx` | 506 |
| `pages/DependencyAgePage.tsx` | 37 |
| `pages/DependencyAlertsPage.tsx` | 46 |
| `pages/DependencyPolicyPage.tsx` | 70 |
| `pages/AIUsageAnalyticsDashboard.tsx` | 76 |
| `pages/AutoPRPage.tsx` | 50 |

All use `localStorage.getItem('token')` which returns `null` (token is in Zustand under `qa-guardian-auth`). All API calls from these pages fail with 401.

**Fix:** Replace all 14 occurrences with `useAuthStore.getState().token`.

---

## HIGH-1: Refresh Token Rotation Race Condition
**Code Review + Architect (acknowledged) | Severity: HIGH**

`auth.ts` lines 503-593: The refresh endpoint checks validity, then revokes, then issues - non-atomically. Two concurrent requests with the same token both succeed, issuing duplicate valid refresh tokens.

**Architect assessment:** "Known and accepted industry-standard pattern. Not a security vulnerability - the old token IS revoked."

**Fix (optional):** Use `UPDATE ... WHERE revoked_at IS NULL RETURNING *` for atomic revoke-and-check.

---

## HIGH-2: createResetToken Memory Leak
**Code Review | Severity: HIGH**

`repositories/auth.ts` line 534: `memoryResetTokens.set()` runs unconditionally (even when DB is connected), unlike other functions that guard with `if (!isDatabaseConnected())`. Memory grows with every password reset.

---

## HIGH-3: No v1-to-v2 Encryption Migration Path
**Code Review | Severity: HIGH**

`encryptIfNeeded()` checks `isEncrypted()` first - existing `enc:v1:` data is never re-encrypted to v2. The security improvement (random salt) only applies to new data.

**Fix:** Create a one-time migration utility to decrypt v1 and re-encrypt as v2.

---

## HIGH-4: timingSafeEqual Length Leak
**Code Review | Severity: HIGH**

`middleware/auth.ts` lines 41-45: The length pre-check before `timingSafeEqual` leaks the expected token length via timing.

**Fix:** Hash both values with SHA-256 first (normalizes length):
```typescript
const tokenHash = crypto.createHash('sha256').update(token).digest();
const expectedHash = crypto.createHash('sha256').update(INTERNAL_SERVICE_TOKEN).digest();
if (crypto.timingSafeEqual(tokenHash, expectedHash)) { ... }
```

---

## MEDIUM Issues (5)

| ID | Finding | File |
|----|---------|------|
| M1 | Session.token field stores hash but named "token" (confusing) | `repositories/auth.ts:107` |
| M2 | Refresh timer interval (50min) too close to threshold (10min) - browser throttling risk | `authStore.ts:63-64` |
| M3 | Redis reconnection creates new client without closing old one (potential leak) | `redis-events.ts:108-171` |
| M4 | Socket.IO adapter Redis clients not closed in gracefulShutdown | `index.ts:831-833` |
| M5 | blacklistToken uses bcrypt(substring(0,30)) for DB but SHA-256 for Redis (inconsistent) | `repositories/auth.ts:309-348` |

## LOW Issues (3)

| ID | Finding | File |
|----|---------|------|
| L1 | No key caching for v2 encryption (PBKDF2 100K iterations per call) | `encryption.ts:80-88` |
| L2 | Verbose console.log in Socket.IO handlers (should use Fastify logger at debug level) | `index.ts:900-952` |
| L3 | Worker docker-compose uses `node dist/worker.js` but project uses tsx | `docker-compose.prod.yml:208` |

---

## Architect's Non-Blocking Observations (6)

1. `fast-jwt` used as transitive dep from `@fastify/jwt` - should be direct dependency
2. No max reconnect attempt limit in redis-events.ts (infinite retry by design)
3. PBKDF2 per-call cost for v2 encryption acceptable at current scale
4. Refresh token race condition is industry-standard accepted behavior
5. `refresh_tokens` table not in formal migration (uses CREATE IF NOT EXISTS)
6. Socket.IO adapter clients not in graceful shutdown

---

# QUALITY SCORECARD

| Dimension | Round 1 (72/100) | Round 2 | Delta |
|-----------|-------------------|---------|-------|
| **Security** | 65/100 | 88/100 | +23 |
| **Performance** | 90/100 | 90/100 | 0 |
| **Reliability** | 85/100 | 92/100 | +7 |
| **Scalability** | 70/100 | 95/100 | +25 |
| **Build Quality** | 95/100 | 95/100 | 0 |
| **Integration** | 50/100 | 62/100 | +12 |
| **Overall** | **72/100** | **82/100** | **+10** |

Note: Integration score held back by the 14 pages still using broken localStorage pattern (CRITICAL-2).

---

# PRIORITIZED REMEDIATION

## Immediate (Before Deploy)

| # | Task | Effort | File |
|---|------|--------|------|
| 1 | **Fix RESET_TOKEN_COLUMNS** (CRITICAL-1) | 5 min | `backend/src/services/repositories/auth.ts:80-82` |
| 2 | **Fix 14 pages using localStorage.getItem('token')** (CRITICAL-2) | 1 hour | 14 frontend page files |

## Next Sprint

| # | Task | Effort | File |
|---|------|--------|------|
| 3 | Atomic refresh token rotation (HIGH-1) | 2 hours | `backend/src/routes/auth.ts:503-593` |
| 4 | Guard createResetToken memory write (HIGH-2) | 15 min | `backend/src/services/repositories/auth.ts:534` |
| 5 | Hash before timingSafeEqual (HIGH-4) | 15 min | `backend/src/middleware/auth.ts:41-45` |
| 6 | v1-to-v2 encryption migration utility (HIGH-3) | 4 hours | `backend/src/services/encryption.ts` |
| 7 | Close adapter Redis clients on shutdown (M4) | 15 min | `backend/src/index.ts` |
| 8 | Reduce refresh timer to 5 min interval (M2) | 5 min | `frontend/src/stores/authStore.ts:63` |

---

*Generated by BMAD Party Team Reassessment Round 2*
*Murat (TEA): GO | Winston (Architect): READY | Code Review: 62/100*
*Assessment date: 2026-02-06*
*Agent run: 229/229 features passing (100%)*
