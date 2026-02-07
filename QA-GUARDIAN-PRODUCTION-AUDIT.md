# QA Guardian - Production Readiness Audit
## BMAD Party Team Assessment | 2026-02-06

**Project:** QA-Dam3oun (QA Guardian) at `https://qa.pixelcraftedmedia.com`
**Stack:** Node.js/TypeScript + Fastify backend, React frontend, PostgreSQL, Redis, Docker
**Status:** 198/199 features passing (99.5%), deployed on `38.111.111.206` via Dokploy/Traefik

---

## Team Perspectives

### Winston (Architect) - System Design & Scalability
### Murat (TEA/Test Architect) - Quality Gates & Non-Functional Requirements
### John (PM) - Prioritization & Business Impact

---

# CRITICAL FINDINGS (Must Fix Before Production Scale)

## C1: Real-Time Test Execution UX is Broken in Production
**Winston + Murat Assessment | Severity: CRITICAL | Impact: Core user experience**

**Root Cause:** In production, the API server runs in `API_ONLY_MODE` (`EXECUTION_MAX_CONCURRENCY=0`) while a separate worker container executes tests. The worker process has **NO Socket.IO instance** - `io` is always `null`. All `emitRunEvent()` calls are silently dropped.

**User Impact:** When a user clicks "Run" on a test:
- No real-time progress appears (step-by-step results, console logs, screenshots)
- The test tracker progress bar is useless
- Results only appear after the test completes and the frontend polls the API

**Files:**
- `backend/src/worker.ts` - No Socket.IO import/setup
- `backend/src/index.ts:736-765` - Socket.IO only exists on API server
- `docker/docker-compose.prod.yml:140` - `EXECUTION_MAX_CONCURRENCY: '0'`

**Fix:** Worker must publish events via Redis Pub/Sub. API server subscribes and forwards to Socket.IO clients. Pattern:
```
Worker -> Redis channel "test-events" -> API Server -> Socket.IO -> Frontend
```

---

## C2: Socket.IO Has Zero Authentication
**Murat Assessment | Severity: CRITICAL | Impact: Security**

Socket.IO accepts connections without JWT verification. Any client can `join-org` with any orgId and receive all real-time data for that organization.

**File:** `backend/src/index.ts:736-765`

**Fix:** Add `io.use()` middleware that validates JWT token on connection. Verify org membership on `join-org`.

---

## C3: API Key Validation is Silently Broken
**Murat Assessment | Severity: CRITICAL | Impact: Security**

`validateApiKey()` in `auth.ts:48-72` iterates over an empty `Map` imported from `routes/api-keys/index.ts:33` (labeled "DEPRECATED: Empty Map exports for backward compatibility"). API key auth always returns null. Any MCP/CI integrations using API keys are broken.

**Fix:** Rewrite to use async `dbGetApiKeyByHash()` from repository layer.

---

## C4: Run History Still Loading Full JSONB
**Winston Assessment | Severity: CRITICAL | Impact: Performance**

`run-core-routes.ts:487-490` computes `results_count`, `passed_count`, `failed_count` by loading the FULL `results` JSONB column (up to 114MB per row) and filtering in JavaScript:

```typescript
results_count: r.results?.length || 0,
passed_count: r.results?.filter(res => res.status === 'passed').length || 0,
```

This also affects `getRecentTestRuns()`, `listTestRunsPaginated()`, and `listTestRunsBySchedule()`.

**Fix:** Switch these to `TEST_RUN_COLUMNS_LIGHT`. Add denormalized count columns (`results_count`, `passed_count`, `failed_count`) to the `test_runs` table, populated on completion.

---

# HIGH SEVERITY FINDINGS

## H1: Unauthenticated Metrics & Health Endpoints
**Murat | `/health` exposes DB stats, memory, errors, disk space, migration status. `/api/v1/metrics` exposes per-endpoint latency. Both public.**

**Fix:** Split `/health` into lightweight probe (for Docker) and authenticated `/health/detailed`. Add auth to `/api/v1/metrics`.

## H2: No CI/CD Pipeline
**John | No `.github/workflows/` directory. No automated testing, linting, or deployment.**

**Fix:** Create GitHub Actions pipeline: tsc + ESLint + tests + Docker build + deploy.

## H3: Deploy Script Takes Stack Fully Down
**Winston | `deploy.sh` runs `docker compose down` then `docker compose up -d --build`. Zero-downtime deployment not possible. No rollback.**

**Fix:** Use `docker compose up -d --build --remove-orphans` for rolling updates. Add health check verification and rollback logic.

## H4: No Socket.IO Redis Adapter for Scaling
**Winston | Socket.IO runs in-process on API server. Can't horizontally scale.**

**Fix:** Install `@socket.io/redis-adapter`. This also solves C1 (worker events via Redis).

## H5: Swagger Docs Exposed in Production
**Murat | `/api/docs` accessible without auth, exposing complete API surface.**

**Fix:** Disable in production or add auth.

## H6: ZAP Container API Key Disabled
**Murat | `api.disablekey=true` with port 8090 mapped to host.**

**Fix:** Enable API key, restrict addresses, remove host port mapping.

## H7: 94 SELECT * Queries Across 16 Repository Files
**Winston | Monitoring repository alone has 31 unbounded `SELECT *` queries. Reports loads full JSONB sections for list views.**

**Fix:** Define explicit column lists per repository. Highest priority: reports.ts, monitoring.ts.

## H8: 304 In-Memory Maps with Unbounded Growth
**Winston | `testRuns` Map stores complete test results including 100MB+ JSONB. No eviction. Dual-write pattern writes to memory AND database simultaneously, causing linear memory growth.**

**Fix:** Implement TTL-based eviction. Stop dual-writing when DB is connected.

---

# MEDIUM SEVERITY FINDINGS

| ID | Finding | Owner |
|----|---------|-------|
| M1 | N+1 query in `getUserOrganizations` (1+N DB calls per login) | Winston |
| M2 | Rate limiting is in-memory only (5000/min, not distributed) | Murat |
| M3 | JWT tokens expire in 7 days (too long) | Murat |
| M4 | No email verification required before login | Murat |
| M5 | DB connection retry limited to 2 attempts | Winston |
| M6 | Health check returns `healthy: true` on disk space check failure | Murat |
| M7 | No APM/Sentry/OpenTelemetry integration | Winston |
| M8 | In-memory fallback pattern masks outages in production | Winston |
| M9 | Default DB/Redis credentials as fallbacks in dev compose | Murat |
| M10 | CORS allows all origins if NODE_ENV != production | Murat |
| M11 | Docker image is large (includes Playwright, k6, semgrep, etc.) | Winston |
| M12 | Token blacklist is memory-only; cleared on restart | Murat |
| M13 | Missing LIMIT clauses in multiple list functions | Winston |
| M14 | No data encryption at rest for sensitive fields | Murat |

---

# WHAT'S WORKING WELL

- **Defense-in-depth architecture:** Separate API/Worker containers, BullMQ queue, Redis cache
- **Comprehensive error handling:** Global handler, uncaught exception/rejection tracking, webhook alerts, graceful shutdown
- **Structured logging:** Pino JSON logging, request correlation IDs, request duration tracking
- **Database design:** Foreign keys, constraints, 151 indexes, parameterized queries
- **Migration system:** node-pg-migrate with proper transaction support
- **Automated backups:** 30-day retention, integrity verification, restore capability
- **Resource limits:** CPU/memory limits on all Docker containers
- **Connection pool monitoring:** Pool exhaustion detection and logging
- **Request timeouts:** Per-endpoint configurable timeouts
- **Test coverage:** 198/199 features passing (99.5%)
- **Performance optimization:** `TEST_RUN_COLUMNS_LIGHT` achieving 731x speedup on listing queries

---

# PRIORITIZED ACTION PLAN

## Sprint 1: Critical Security & UX (1 week)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | **Worker Redis Pub/Sub for real-time events** (C1+H4) | 2-3 days | Fixes core UX complaint |
| 2 | **Socket.IO JWT authentication** (C2) | 1 day | Critical security fix |
| 3 | **Fix API key validation** (C3) | 2 hours | Security fix |
| 4 | **Switch listing queries to LIGHT columns** (C4) | 1 hour | Performance fix |
| 5 | **Add denormalized count columns** to test_runs | 4 hours | Eliminates JSONB loading for counts |
| 6 | **Rotate hardcoded API keys** | 30 min | Immediate security |

## Sprint 2: Production Hardening (1 week)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 7 | **Add auth to /health/detailed and /api/v1/metrics** (H1) | 4 hours | Security |
| 8 | **Create CI/CD pipeline** (H2) | 1 day | DevOps foundation |
| 9 | **Fix deploy script** (H3) for zero-downtime | 4 hours | Reliability |
| 10 | **Disable Swagger in production** (H5) | 30 min | Security |
| 11 | **Fix ZAP container security** (H6) | 1 hour | Security |
| 12 | **Fix N+1 query** in getUserOrganizations (M1) | 30 min | Performance |

## Sprint 3: Performance & Observability (1 week)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 13 | **Define column lists for top 5 repositories** (H7) | 3 days | Performance |
| 14 | **Implement testRuns Map TTL eviction** (H8) | 4 hours | Memory safety |
| 15 | **Stop dual-writing to memory when DB connected** (H8) | 1 day | Memory safety |
| 16 | **Add caching to test run listing endpoints** | 4 hours | Performance |
| 17 | **Reduce JWT expiry + implement refresh tokens** (M3) | 1 day | Security |
| 18 | **Add Sentry/OpenTelemetry** (M7) | 1 day | Observability |

## Sprint 4: Scale Readiness (1 week)

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 19 | **Redis-based rate limiting** (M2) | 4 hours | Scalability |
| 20 | **Add LIMIT to all unbounded list queries** (M13) | 4 hours | Performance |
| 21 | **Encrypt sensitive data at rest** (M14) | 2 days | Security |
| 22 | **Multi-stage Docker build** (M11) | 1 day | Deploy speed |
| 23 | **Redis-backed token blacklist** (M12) | 1 day | Security |

---

## Feature Backlog for MqxCode Harness

These can be tracked as features in `features.db` for the autonomous agent:

| Feature | Category | Priority |
|---------|----------|----------|
| Worker Redis Pub/Sub for real-time events | architecture | P0 |
| Socket.IO JWT authentication middleware | security | P0 |
| Fix API key validation (use DB lookup) | security | P0 |
| Denormalized count columns on test_runs | performance | P0 |
| Auth on health/metrics endpoints | security | P1 |
| CI/CD GitHub Actions pipeline | devops | P1 |
| Zero-downtime deploy script | devops | P1 |
| N+1 fix: getUserOrganizations JOIN | performance | P1 |
| Column lists for monitoring.ts | performance | P2 |
| Column lists for reports.ts | performance | P2 |
| testRuns Map TTL eviction | performance | P2 |
| Stop dual-write to memory Maps | performance | P2 |
| Cache test run listings (SHORT TTL) | performance | P2 |
| JWT expiry reduction + refresh tokens | security | P2 |
| Sentry/OpenTelemetry integration | observability | P2 |
| Redis rate limiting | scalability | P3 |
| Encrypt sensitive data at rest | security | P3 |
| Multi-stage Docker build | devops | P3 |
| Redis-backed token blacklist | security | P3 |

---

*Generated by BMAD Party Team: Winston (Architect), Murat (TEA), John (PM)*
*Assessment date: 2026-02-06*
