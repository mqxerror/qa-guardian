# QA Guardian -- Deployment Guide

**Server:** 38.111.111.206 (MercanAIServer)
**Domain:** https://qa.pixelcraftedmedia.com
**Platform:** Dokploy with Traefik reverse proxy

---

## 1. Architecture Overview

Single VPS running Dokploy, which manages Traefik as the reverse proxy with automatic Let's Encrypt SSL. All services run as Docker containers on an internal bridge network, with only the backend and frontend exposed to Traefik for external access.

```
Internet
   |
   v
Traefik (Dokploy) -- ports 80/443, SSL termination
   |
   +-- Frontend (nginx:80)       -- serves React SPA at /
   +-- Backend (node:3001)       -- API at /api/*, WebSocket at /socket.io/*
   +-- MCP Server (node:3002)    -- AI agent integration at /mcp/* (optional profile)
   |
   +-- PostgreSQL 15             -- primary data store
   +-- Redis 7                   -- cache and job queue
   +-- MinIO                     -- S3-compatible artifact storage
   +-- ZAP (OWASP)              -- security scanning daemon (dev compose only)
```

Traefik routes requests by path prefix. The `dokploy-network` external network connects application containers to Traefik. Internal-only services (Postgres, Redis, MinIO) live on a separate bridge network that is not reachable from the outside.

---

## 2. Docker Compose Services

Three compose files exist:

- `docker-compose.yml` -- local development stack (base services)
- `docker-compose.deploy.yml` -- production overlay that adds Traefik labels and `dokploy-network` to backend/frontend
- `dokploy/docker-compose.yml` -- full production stack (standalone alternative, used by Dokploy's native git deploy)

### Production Services (`dokploy/docker-compose.yml`)

| Service | Image / Build | Internal Port | Exposed Via | Purpose |
|---|---|---|---|---|
| `postgres` | `postgres:15-alpine` | 5432 | Internal only | Relational database |
| `redis` | `redis:7-alpine` | 6379 | Internal only | Cache, job queue, pub/sub |
| `minio` | `minio/minio:latest` | 9000 / 9001 | Internal only | Screenshot and artifact storage |
| `backend` | Build from `backend/` | 3001 | Traefik `/api`, `/socket.io` | Fastify API server with Playwright |
| `frontend` | Build from `frontend/` | 80 | Traefik `/` | React SPA served by nginx |
| `mcp-server` | Build from `packages/mcp-server/` | 3002 | Traefik `/mcp` | MCP server (optional, `--profile mcp`) |

### Development-Only Services (`docker-compose.yml`)

| Service | Image / Build | Host Port | Purpose |
|---|---|---|---|
| `zap` | `ghcr.io/zaproxy/zaproxy:stable` | 8090 | OWASP ZAP security scanner |
| `mcp-server` | Build from `backend/` | 3008 | MCP server (always on in dev) |

---

## 3. CI/CD Pipeline

The deployment pipeline is defined in `.github/workflows/deploy.yml` and triggered on push to `main` or manual dispatch.

### Job 1: Build and Test

```
- Checkout code
- Install dependencies (backend + frontend)
- Run linter (eslint)
- Build backend (npm run build)
- Build frontend (npm run build)
- Run tests (npm test)
```

### Job 2: Deploy to Production

```
- SSH into 38.111.111.206
- cd /opt/qa-guardian
- git pull origin main
- docker compose -f docker-compose.yml -f docker-compose.deploy.yml build backend frontend
- docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d --force-recreate backend frontend
- Wait for backend to be healthy (retry loop, up to 120s)
- Run database migrations
- Verify health: docker exec qa-guardian-backend curl -f http://localhost:3001/health
```

> **Note:** The deploy overlay (`docker-compose.deploy.yml`) adds Traefik labels and connects
> containers to `dokploy-network`. Without it, Traefik cannot route traffic to the backend.

### GitHub Secrets Required

| Secret | Description |
|---|---|
| `DOKPLOY_HOST` | Server IP: `38.111.111.206` |
| `DOKPLOY_SSH_KEY` | Private SSH key for deployment user |
| `DOKPLOY_USER` | SSH username (typically `root`) |

---

## 4. Manual Deployment

### Quick Deploy (Existing Setup)

```bash
ssh root@38.111.111.206
cd /opt/qa-guardian
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.deploy.yml build backend frontend
docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d --force-recreate backend frontend
```

### Full Rebuild (All Services)

```bash
ssh root@38.111.111.206
cd /opt/qa-guardian
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.deploy.yml down
docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d --build
```

### Run Database Migrations

```bash
docker exec qa-guardian-backend npm run migrate
```

### Verify Deployment

```bash
# Container health
docker compose ps

# Backend health (inside container -- authoritative check)
docker exec qa-guardian-backend curl -f http://localhost:3001/health

# API routable through Traefik (any non-502 = routing works)
curl -f https://qa.pixelcraftedmedia.com/api/v1/health

# Frontend accessible
curl -I https://qa.pixelcraftedmedia.com
```

---

## 5. Environment Variables

Copy the appropriate example file and fill in secrets before deploying.

| File | Purpose |
|---|---|
| `.env.example` | Local development defaults |
| `.env.production.example` | Production template with `CHANGE_ME` placeholders |
| `dokploy/.env.production.example` | Dokploy-specific production template |
| `dokploy/.env.example` | Dokploy development defaults |

### Required Secrets (Must Change Before Deploy)

| Variable | How to Generate |
|---|---|
| `POSTGRES_PASSWORD` | `openssl rand -base64 32` |
| `REDIS_PASSWORD` | `openssl rand -base64 32` |
| `JWT_SECRET` | `openssl rand -base64 64` |
| `JWT_REFRESH_SECRET` | `openssl rand -base64 64` |
| `SESSION_SECRET` | `openssl rand -base64 64` |
| `MINIO_ROOT_PASSWORD` | `openssl rand -base64 32` |

### Optional Variables

| Variable | Purpose |
|---|---|
| `KIE_API_KEY` / `ANTHROPIC_API_KEY` | AI-powered features (test generation, RCA) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth sign-in |
| `GITHUB_APP_ID` / `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub PR integration |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Email notifications |
| `SENTRY_DSN` | Error tracking |

---

## 6. Monitoring and Health Checks

### Application Health

The backend exposes two health endpoints:

- `GET /health` -- basic liveness check
- `GET /api/v1/mcp/status` -- MCP server connectivity (checked by Docker HEALTHCHECK)

### Docker Health Checks

Every service defines a `HEALTHCHECK` in its compose configuration:

| Service | Check | Interval |
|---|---|---|
| `postgres` | `pg_isready -U postgres` | 10s |
| `redis` | `redis-cli -a $REDIS_PASSWORD ping` | 10s |
| `minio` | `curl -f http://localhost:9000/minio/health/live` | 30s |
| `backend` | `curl -f http://localhost:3001/health` | 30s |
| `frontend` | `curl -f http://localhost/health` | 30s |

### Traefik Routing

Traefik labels on backend and frontend containers handle:

- HTTPS termination with Let's Encrypt (`certresolver=letsencrypt`)
- HTTP-to-HTTPS redirect
- Path-based routing: `/api` and `/socket.io` to backend, everything else to frontend
- Router priority ensures `/api` and `/socket.io` match before the frontend catch-all

### Checking Logs

```bash
# All services
docker compose logs -f

# Single service, last 200 lines
docker compose logs --tail=200 -f backend

# Resource usage
docker stats
```

---

## 7. Troubleshooting

### Container fails to start

```bash
# Check logs for the failing service
docker compose logs backend

# Verify dependent services are healthy
docker compose ps

# Check if ports are already in use
ss -tulpn | grep -E '3001|5432|6379|9000'
```

### Database migrations fail

```bash
# Connect to Postgres directly
docker exec -it qa-guardian-postgres psql -U postgres -d qa_guardian

# Check migration status
docker exec qa-guardian-backend npx prisma migrate status

# Reset migrations (DESTRUCTIVE -- development only)
docker exec qa-guardian-backend npx prisma migrate reset --force
```

### Traefik SSL certificate not issued

```bash
# Check Traefik logs for ACME errors
docker logs dokploy-traefik 2>&1 | grep -i acme

# Verify DNS resolves to the server
dig qa.pixelcraftedmedia.com

# Ensure port 80 is open (required for HTTP-01 challenge)
curl -I http://qa.pixelcraftedmedia.com
```

### Backend returns 502 Bad Gateway via Traefik

The backend container must be on `dokploy-network` with Traefik labels. If you deployed without the overlay, Traefik cannot reach the backend.

```bash
# Check if backend is on dokploy-network
docker inspect qa-guardian-backend --format='{{json .NetworkSettings.Networks}}' | grep dokploy

# Fix: redeploy with the overlay
docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d --force-recreate backend frontend
```

### WebSocket connections fail

1. Confirm Traefik labels include the `/socket.io` router.
2. Check that `CORS_ORIGINS` or `FRONTEND_URL` in `.env` includes the production domain.
3. Verify the backend container is healthy: `docker inspect qa-guardian-backend | grep -A5 Health`.

### MinIO bucket not created

```bash
# Create bucket manually
docker exec qa-guardian-minio mc alias set local http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD
docker exec qa-guardian-minio mc mb local/qa-guardian-artifacts
```

### Out of disk space

```bash
# Check disk usage
df -h

# Clean up Docker artifacts
docker system prune -a --volumes
```

---

## 8. Database Backup and Restore

### Backup

```bash
docker exec qa-guardian-postgres pg_dump -U postgres qa_guardian | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Restore

```bash
gunzip -c backup_20260202.sql.gz | docker exec -i qa-guardian-postgres psql -U postgres qa_guardian
```

---

## 9. Security Checklist

Before going live, verify:

- [ ] All `CHANGE_ME` placeholders replaced with generated secrets
- [ ] JWT secrets are unique, random, and at least 64 bytes
- [ ] PostgreSQL and Redis are not exposed on host ports (production compose uses internal network only)
- [ ] MinIO credentials are changed from defaults
- [ ] SSL certificate is active (`curl -vI https://qa.pixelcraftedmedia.com`)
- [ ] `CORS_ORIGINS` / `FRONTEND_URL` set to production domain only
- [ ] No `.env` file committed to version control
