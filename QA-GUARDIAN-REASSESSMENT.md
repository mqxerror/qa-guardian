# QA Guardian - Post-Implementation Reassessment
## BMAD Party Team Review | 2026-02-06

**Project:** QA-Dam3oun (QA Guardian) at `https://qa.pixelcraftedmedia.com`
**Previous Audit:** 198/199 features (99.5%), 4 CRITICAL + 8 HIGH + 14 MEDIUM findings
**Current Status:** 216/216 features passing (100%), 18 production readiness features implemented
**Build Health:** Backend tsc: 0 errors | ESLint: 0 errors | Frontend tsc: 0 errors | ESLint: 0 errors

---

## Executive Summary

The autonomous agent successfully implemented all 18 production readiness features. The original 4 CRITICAL findings (C1-C4) are resolved at the architecture level, but the reassessment uncovered **one new CRITICAL integration bug** and several moderate gaps that need attention.

### Overall Verdict: CONDITIONAL-GO

| Agent | Role | Verdict |
|-------|------|---------|
| **Murat (TEA)** | NFR Assessment | CONDITIONAL-GO |
| **Winston (Architect)** | Architecture Review | CONDITIONALLY READY |
| **Code Quality Review** | Integration & Quality | 72/100 |

---

## Original Findings Status

| ID | Original Finding | Status | Notes |
|----|-----------------|--------|-------|
| **C1** | Worker has no Socket.IO (real-time UX broken) | **RESOLVED** | Redis Pub/Sub in `redis-events.ts`, dual transport in `test-runs.ts:438-457` |
| **C2** | Socket.IO has zero authentication | **PARTIALLY RESOLVED** | Backend middleware exists (`index.ts:821-859`) but frontend never sends token (see NEW-C1) |
| **C3** | API key validation broken (empty Map) | **RESOLVED** | Async DB lookup via `dbGetApiKeyByHash()` in `auth.ts:49-75` |
| **C4** | Listing queries load full JSONB | **RESOLVED** | `TEST_RUN_COLUMNS_LIGHT` with denormalized counts, 731x speedup verified |
| **H1** | Unauthenticated health/metrics | **RESOLVED** | Split `/health` (probe) + `/health/detailed` (auth required) |
| **H2** | No CI/CD pipeline | **RESOLVED** | `.github/workflows/ci.yml` with 4 parallel jobs + gate |
| **H3** | Deploy script takes stack down | **RESOLVED** | Rolling update + health check + auto-rollback in `deploy.sh` |
| **H4** | No Socket.IO Redis adapter | **PARTIAL** | Custom Pub/Sub covers worker->API, but no `@socket.io/redis-adapter` for API->API scaling |
| **H5** | Swagger exposed in production | **RESOLVED** | Disabled when `NODE_ENV=production` |
| **H6** | ZAP container API key disabled | **RESOLVED** | API key enabled, addresses restricted, no host port |
| **H7** | 94 SELECT * queries | **RESOLVED** | Column lists defined for top repositories |
| **H8** | Unbounded in-memory Maps | **RESOLVED** | TTL eviction (5min terminal/10min stale) in `execution.ts:452-557` |
| **M1** | N+1 in getUserOrganizations | **RESOLVED** | JOIN query in `organizations.ts:403-468` |
| **M2** | In-memory rate limiting | **RESOLVED** | Redis INCR with tiered limits |
| **M3** | JWT 7-day expiry | **RESOLVED** | 1-hour access + 7-day refresh tokens |
| **M12** | Memory-only token blacklist | **RESOLVED** | 3-tier: memory Set + Redis (SHA-256) + PostgreSQL (bcrypt) |
| **M13** | Missing LIMIT clauses | **RESOLVED** | Limits added to list queries |
| **M14** | No encryption at rest | **RESOLVED** | AES-256-GCM with PBKDF2, but opt-in only (see NEW-H2) |

---

# NEW FINDINGS FROM REASSESSMENT

## NEW-C1: Frontend Socket.IO Authentication is Completely Non-Functional
**All Three Agents Identified | Severity: CRITICAL | Impact: Security + Feature #201 Dead**

**Root Cause:** `socketStore.ts:75` reads `localStorage.getItem('token')`, but the actual JWT is stored by Zustand's persist middleware under the key `qa-guardian-auth` as a JSON object. There is **zero** occurrences of `localStorage.setItem('token', ...)` anywhere in the frontend.

```typescript
// socketStore.ts:74-76 - BROKEN
const getAuthToken = (): string | null => {
  return localStorage.getItem('token');  // ALWAYS returns null
};

// authStore.ts:295 - Where token actually lives
name: 'qa-guardian-auth',  // Stored as JSON: {"state":{"token":"...","refreshToken":"..."}}
```

**Impact:**
- `getAuthToken()` always returns `null`
- Socket.IO `auth` option is always `undefined`
- Backend middleware at `index.ts:827-831` allows unauthenticated connections (backward compat)
- **Any user can join any organization's room and receive cross-tenant real-time data**
- The `join-run` event at `index.ts:880` has NO auth guard
- Feature #201 auth failure handling (`socketStore.ts:291-301`) never fires

**Fix (one-line):** Change `socketStore.ts:75` to:
```typescript
return useAuthStore.getState().token;
```

**Also needed:** Remove the unauthenticated connection bypass at `index.ts:827-831` and add auth to `join-run`.

---

## NEW-H1: Refresh Tokens Stored In-Memory Only (Lost on Every Deploy)
**Winston + Murat | Severity: HIGH | Impact: User sessions broken on every deployment**

`auth.ts:127` stores refresh tokens in a plain `Map`:
```typescript
const refreshTokenHashes = new Map<string, { userId: string; expiresAt: Date }>();
```

Every server restart/deployment clears this Map. With 1-hour access tokens, users who don't interact within an hour after deployment are silently logged out. No rotation, no cleanup of expired entries, per-instance only (breaks horizontal scaling).

**Fix:** Store refresh token hashes in the existing `sessions` table in PostgreSQL.

---

## NEW-H2: Encryption Silently Disabled in Production
**Winston | Severity: HIGH | Impact: Sensitive data stored in plaintext**

- `ENCRYPTION_KEY` is **NOT** in `docker/docker-compose.prod.yml` for either backend or worker
- `encryption.ts:97-100`: When key is not set, `encrypt()` silently returns plaintext
- GitHub tokens and secret env vars are stored unencrypted in PostgreSQL

**Fix:** Add `ENCRYPTION_KEY` to both `backend` and `worker` services in `docker-compose.prod.yml`.

---

## NEW-H3: Session/Reset Tokens Stored Unhashed in Database
**Murat | Severity: HIGH | Impact: Token theft via DB access**

- `repositories/auth.ts:403`: Session tokens stored as plaintext (comment says "should be hashed")
- `repositories/auth.ts:541`: Reset tokens stored as plaintext
- A database compromise exposes all active session and reset tokens

**Fix:** Hash tokens with SHA-256 before storage, compare on lookup.

---

## NEW-H4: Redis Event Subscriber Has No Reconnection Logic
**Winston | Severity: HIGH | Impact: Silent loss of real-time events**

`redis-events.ts:195-197`: On `close` event, sets `subscriberInitialized = false` but has no auto-reconnect. A transient Redis disconnect (network blip, Redis restart) permanently kills the subscriber until API server restart.

**Fix:** Add reconnection with exponential backoff and re-subscribe on reconnect.

---

## NEW-M1: No Proactive Token Refresh Timer
**Code Quality Review | Severity: MEDIUM | Impact: Auth interruptions in long sessions**

`authStore.ts:141-158`: Refresh only happens during `checkAuth()` (app load/navigation). No `setInterval` for background refresh. Users with long-open sessions will get 401s on API calls until next navigation.

---

## NEW-M2: Deploy Script Not Truly Zero-Downtime
**Winston | Severity: MEDIUM | Impact: Brief downtime on every deploy**

`deploy.sh:222`: `docker compose up -d --build --remove-orphans` stops old container before starting new one. For single-container services, there is a downtime window. True zero-downtime requires blue-green deployment or `deploy.update_config.order: start-first`.

Also: `deploy.sh:209` uses `git reset --hard origin/main` which destroys local changes, and health check accepts `degraded` status (line 99).

---

## NEW-M3: No Refresh Token Rotation
**Winston | Severity: MEDIUM | Impact: Token theft window**

`auth.ts:500-580`: The `/api/v1/auth/refresh` endpoint issues a new access token but keeps the same refresh token. OWASP recommends rotating refresh tokens on each use. A stolen refresh token can be used indefinitely for 7 days.

---

## NEW-M4: PBKDF2 Salt Derived From Key
**Winston | Severity: LOW | Impact: Cryptographic suboptimal**

`encryption.ts:58-60`: Salt is `masterKey.slice(0, 16)`, making PBKDF2 functionally equivalent to using a known constant salt. Per-message uniqueness comes from the random IV (which is correct for GCM), so this is not exploitable in practice.

---

## NEW-M5: Denormalized Columns Not In Migration System
**Code Quality Review | Severity: LOW | Impact: Schema inconsistency**

The `results_count`, `passed_count`, `failed_count`, `skipped_count` columns are added by `initializeSchema()` in `database.ts:1357-1360`, not by a migration file. The backfill also runs on every startup (no index on `results_count`).

---

## NEW-M6: Internal Service Token Uses `===` Comparison
**Murat | Severity: LOW | Impact: Timing attack theoretical risk**

`middleware/auth.ts:37` uses `===` instead of `crypto.timingSafeEqual()` for internal service token comparison.

---

# WHAT'S WORKING WELL (Post-Implementation)

- **Redis Pub/Sub architecture** (SOLID): Clean dual-transport fallback in `emitRunEvent()`, dedicated pub/sub connections, proper graceful shutdown
- **API key validation** (SOLID): Async DB lookup with expiration check, fire-and-forget `last_used_at` update
- **Denormalized counts** (SOLID): Atomic update with results in same SQL statement, idempotent backfill
- **Token blacklist** (SOLID): 3-tier architecture (memory + Redis + PostgreSQL) with proper TTLs
- **CI/CD pipeline** (SOLID): Parallel jobs, concurrency control, Docker layer caching, PostgreSQL/Redis test services
- **Deploy script** (ADEQUATE): Image tagging for rollback, health checks, automatic rollback on failure
- **Screenshot subscription** (VERIFIED): Frontend properly subscribes/unsubscribes `step:screenshot`
- **TTL eviction** (VERIFIED): 60s cleanup interval, 5min terminal / 10min stale eviction
- **N+1 fix** (VERIFIED): JOIN query replaces 1+N pattern
- **Column lists** (VERIFIED): All listing functions use `TEST_RUN_COLUMNS_LIGHT`
- **Build health**: 0 tsc errors, 0 ESLint errors across both frontend and backend

---

# PRIORITIZED REMEDIATION PLAN

## Immediate (P0 - Before Next Deploy)

| # | Task | Effort | File |
|---|------|--------|------|
| 1 | **Fix Socket.IO token passing** (NEW-C1) | 30 min | `frontend/src/stores/socketStore.ts:75` |
| 2 | **Remove unauthenticated Socket.IO bypass** | 30 min | `backend/src/index.ts:827-831` |
| 3 | **Add auth guard to `join-run`** | 15 min | `backend/src/index.ts:880` |
| 4 | **Add ENCRYPTION_KEY to prod compose** | 5 min | `docker/docker-compose.prod.yml` |

## Sprint 5: Security Hardening (1 week)

| # | Task | Effort | File |
|---|------|--------|------|
| 5 | **Persist refresh tokens in PostgreSQL** (NEW-H1) | 4 hours | `backend/src/routes/auth.ts:127` |
| 6 | **Hash session tokens before DB storage** (NEW-H3) | 2 hours | `backend/src/services/repositories/auth.ts:403` |
| 7 | **Hash reset tokens before DB storage** (NEW-H3) | 1 hour | `backend/src/services/repositories/auth.ts:541` |
| 8 | **Add Redis subscriber reconnection** (NEW-H4) | 2 hours | `backend/src/services/redis-events.ts:195-197` |
| 9 | **Implement refresh token rotation** (NEW-M3) | 4 hours | `backend/src/routes/auth.ts:500-580` |
| 10 | **Add proactive token refresh timer** (NEW-M1) | 2 hours | `frontend/src/stores/authStore.ts` |

## Sprint 6: Scale & Polish (1 week)

| # | Task | Effort | File |
|---|------|--------|------|
| 11 | **Install `@socket.io/redis-adapter`** | 4 hours | `backend/src/index.ts` |
| 12 | **True zero-downtime deploy** (blue-green) | 1 day | `deploy.sh` |
| 13 | **Migration file for denormalized columns** | 1 hour | `backend/migrations/` |
| 14 | **Use `crypto.timingSafeEqual`** for token comparison | 30 min | `backend/src/middleware/auth.ts:37` |
| 15 | **Fix PBKDF2 random salt** | 2 hours | `backend/src/services/encryption.ts:58-60` |

---

## Quality Scorecard

| Dimension | Pre-Agent | Post-Agent | Notes |
|-----------|-----------|------------|-------|
| **Security** | 30/100 | 65/100 | Socket.IO auth bypass + unhashed tokens remain |
| **Performance** | 40/100 | 90/100 | All JSONB, N+1, column list, eviction fixes solid |
| **Reliability** | 60/100 | 85/100 | Redis Pub/Sub + 3-tier blacklist + rollback deploy |
| **Scalability** | 50/100 | 70/100 | Missing Socket.IO Redis adapter + per-instance refresh |
| **Build Quality** | 70/100 | 95/100 | 0 errors across tsc + ESLint, both frontend and backend |
| **Integration** | N/A | 50/100 | Socket.IO token bug breaks Feature #201 entirely |
| **Overall** | 45/100 | **72/100** | Solid individual implementations, integration gap |

---

*Generated by BMAD Party Team Reassessment*
*Winston (Architect) | Murat (TEA) | Code Quality Reviewer*
*Assessment date: 2026-02-06*
*Agent run: 216/216 features passing (100%)*
