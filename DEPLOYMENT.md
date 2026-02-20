# QA Guardian -- Deployment Guide

**Server:** 38.111.111.206 (MercanAIServer)
**Domain:** https://qa.pixelcraftedmedia.com
**Platform:** Dokploy with Traefik reverse proxy
**Last updated:** 2026-02-14

---

## Table of Contents

0. [Fresh VPS Setup](#0-fresh-vps-setup)
1. [Architecture Overview](#1-architecture-overview)
2. [Docker Services](#2-docker-services)
3. [Environment Variables](#3-environment-variables)
4. [CI/CD Pipeline](#4-cicd-pipeline)
5. [Manual Deployment](#5-manual-deployment)
6. [Health Checks and Diagnostics](#6-health-checks-and-diagnostics)
7. [Troubleshooting](#7-troubleshooting)
8. [Database Backup and Restore](#8-database-backup-and-restore)
9. [Maintenance](#9-maintenance)
10. [Security Checklist](#10-security-checklist)

---

## 0. Fresh VPS Setup

This section walks through setting up a brand-new Ubuntu VPS from scratch, ending with a fully deployed QA Guardian instance.

### 0.1 Prerequisites

- A VPS with at least 4 CPU cores, 8 GB RAM, 80 GB SSD (recommended: 8 cores, 16 GB RAM)
- Ubuntu 22.04 or 24.04 LTS
- Root or sudo access
- A domain with DNS managed by you (e.g., Cloudflare, Namecheap)

### 0.2 Initial Server Hardening

```bash
# SSH into the server
ssh root@38.111.111.206

# Update system packages
apt update && apt upgrade -y

# Set hostname
hostnamectl set-hostname mercanai-server

# Set timezone
timedatectl set-timezone UTC

# Install essential tools
apt install -y curl git wget unzip htop jq

# Configure firewall (allow SSH, HTTP, HTTPS)
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 0.3 Install Docker Engine and Docker Compose Plugin

Install Docker Engine using the official apt repository. Do NOT install the standalone `docker-compose` binary -- use the Docker Compose plugin (`docker compose` with a space) instead.

```bash
# Remove any old Docker packages
apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Add Docker official GPG key and repository
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
docker --version          # Should show Docker 24+ or 27+
docker compose version    # Should show Docker Compose v2.x
```

### 0.4 Install Dokploy

Dokploy is a self-hosted PaaS that manages Traefik as a reverse proxy with automatic Let's Encrypt SSL.

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

This script will:
- Create the `dokploy-network` Docker network (required for Traefik routing)
- Start a Traefik container that listens on ports 80 and 443
- Start the Dokploy management UI (default port 3000)
- Configure automatic Let's Encrypt certificate provisioning

After installation, access the Dokploy dashboard at `http://38.111.111.206:3000` and complete the initial setup wizard.

### 0.5 Configure DNS

Create an A record pointing the domain to the server IP:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | qa.pixelcraftedmedia.com | 38.111.111.206 | 300 |

Verify DNS propagation:

```bash
dig qa.pixelcraftedmedia.com +short
# Should return: 38.111.111.206
```

> **Important:** DNS must be propagated before Traefik can issue SSL certificates via the HTTP-01 challenge. Wait until `dig` returns the correct IP before proceeding.

### 0.6 Clone the Repository

```bash
mkdir -p /opt
cd /opt
git clone git@github.com:mqxerror/qa-guardian.git
cd /opt/qa-guardian
```

### 0.7 Create the Production .env File

```bash
cp .env.production.example .env
```

Generate all required secrets and edit the file:

```bash
# Generate secrets
echo "POSTGRES_PASSWORD: $(openssl rand -base64 32)"
echo "REDIS_PASSWORD: $(openssl rand -base64 32)"
echo "JWT_SECRET: $(openssl rand -base64 64)"
echo "JWT_REFRESH_SECRET: $(openssl rand -base64 64)"
echo "SESSION_SECRET: $(openssl rand -base64 64)"
echo "ENCRYPTION_KEY: $(openssl rand -base64 32)"

# Edit the .env file and replace all CHANGE_ME / GENERATE placeholders
nano .env
```

See [Section 3: Environment Variables](#3-environment-variables) for the full list.

### 0.8 Set Up SSH Key for GitHub Actions Deployment

Generate an ed25519 SSH key pair for automated deployments:

```bash
# On the server
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy -N ""

# Add the public key to authorized_keys
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Display the private key (you will paste this into GitHub)
cat ~/.ssh/github_deploy
```

Then add the following GitHub repository secrets (Settings > Secrets and variables > Actions):

| Secret | Value |
|--------|-------|
| `DOKPLOY_HOST` | `38.111.111.206` |
| `DOKPLOY_SSH_KEY` | Contents of `~/.ssh/github_deploy` (the private key, including `-----BEGIN` and `-----END` lines) |
| `DOKPLOY_USER` | `root` |

### 0.9 First-Time Deploy

Start the infrastructure services first (database, cache), then build and deploy the application:

```bash
cd /opt/qa-guardian

# Step 1: Start infrastructure services (postgres, redis)
# These must be healthy before the app containers can start
docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d postgres redis

# Wait for infrastructure to be healthy
echo "Waiting for postgres and redis..."
sleep 15
docker compose -f docker-compose.yml -f docker-compose.deploy.yml ps

# Step 2: Build and start all application services
docker compose -f docker-compose.yml -f docker-compose.deploy.yml build --no-cache backend worker frontend
docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d

# Step 3: Wait for backend to become healthy
echo "Waiting for backend to start..."
for i in $(seq 1 12); do
  sleep 10
  if docker exec qa-guardian-backend curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo "Backend is healthy!"
    break
  fi
  echo "  Attempt $i/12..."
done

# Step 4: Run database migrations
docker exec qa-guardian-backend npm run migrate

# Step 5: Verify all services
docker compose -f docker-compose.yml -f docker-compose.deploy.yml ps
curl -sf https://qa.pixelcraftedmedia.com/api/v1/health && echo " -- API OK"
curl -sf https://qa.pixelcraftedmedia.com/ -o /dev/null && echo "Frontend OK"
```

---

## 1. Architecture Overview

### System Diagram

```
                         Internet
                            |
                            v
                  Traefik (Dokploy)
                  ports 80/443, SSL termination
                            |
            +---------------+------------------+
            |               |                  |
            v               v                  v
      Frontend        Backend API          MCP Server
      (nginx:80)      (node:3001)          (node:3002)
      serves React    Fastify API          AI agent
      SPA at /        at /api/*            integration
                      Socket.IO            at /mcp/*
                      at /socket.io/*      (optional)
            |               |
            |       +-------+-------+
            |       |               |
            |       v               v
            |   PostgreSQL 15    Redis 7
            |   (port 5432)      (port 6379)
            |   primary data     cache, BullMQ
            |   store            job queue
            |
            +-- Worker (node:3002 internal)
                Same image as backend
                Runs dist/worker.js
                BullMQ test execution consumer
                Playwright browsers (Chromium, Firefox, WebKit)
```

### Request Flow

1. **Traefik** terminates SSL and routes by path prefix:
   - `/api/*` and `/socket.io/*` --> Backend container (port 3001), priority 10
   - `/mcp/*` --> MCP Server container (port 3002), priority 10 (optional profile)
   - `/*` (catch-all) --> Frontend container (port 80), priority 1
2. **Backend** handles API requests, WebSocket connections, and optionally runs a local BullMQ worker as a fallback for test execution.
3. **Worker** is a dedicated container running the same Docker image as the backend but with the command `node dist/worker.js`. It consumes BullMQ test execution jobs from Redis, launches Playwright browser instances, and writes results back to PostgreSQL.
4. **Frontend** is a React SPA built with Vite and served by nginx. All API calls go through Traefik to the backend.

### Network Topology

| Network | Purpose | Containers |
|---------|---------|------------|
| `qa-network` (bridge) | Internal service communication | All containers |
| `dokploy-network` (external) | Traefik reverse proxy routing | backend, frontend, mcp-server |

PostgreSQL, Redis, and the Worker are **not** on `dokploy-network` -- they are only reachable via the internal bridge network.

---

## 2. Docker Services

### Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Base service definitions (all services, dev defaults) |
| `docker-compose.deploy.yml` | Production overlay: adds Traefik labels and `dokploy-network` to backend/frontend |
| `dokploy/docker-compose.yml` | Standalone production compose (alternative for Dokploy native git deploy) |

**Production deployment uses the overlay pattern:**

```bash
docker compose -f docker-compose.yml -f docker-compose.deploy.yml <command>
```

### Service Reference

| Service | Image / Build | Internal Port | Exposed Via | Memory Limit | Purpose |
|---------|---------------|---------------|-------------|--------------|---------|
| `postgres` | `postgres:15-alpine` | 5432 | Internal only | 1 GB | Relational database with slow query logging |
| `redis` | `redis:7-alpine` | 6379 | Internal only | 512 MB | Cache, BullMQ job queue, Socket.IO adapter |
| `backend` | Build from `backend/Dockerfile` | 3001 | Traefik `/api`, `/socket.io` | 2 GB | Fastify API server, also runs local BullMQ worker as fallback |
| `worker` | Same image as backend | 3002 (health only) | Internal only | 3 GB | Dedicated BullMQ test execution consumer with Playwright browsers |
| `frontend` | Build from `frontend/Dockerfile` | 80 | Traefik `/` (catch-all) | 256 MB | React SPA served by nginx |
| `zap` | `ghcr.io/zaproxy/zaproxy:stable` | 8080 | Internal only | 1 GB | OWASP ZAP security scanner |
| `mcp-server` | Build from `backend/Dockerfile` | 3002 | Traefik `/mcp` | 1 GB | MCP server for AI agent integration |
| `backup` | `postgres:15-alpine` | -- | Internal only | 256 MB | Automated daily PostgreSQL backups with 30-day retention |

### Worker Container Details

The worker deserves special attention because it runs Playwright browsers:

- **Image:** Same Dockerfile as backend (`backend/Dockerfile`)
- **Command override:** `node dist/worker.js` (instead of default `node dist/index.js`)
- **Memory:** 3 GB limit (Chromium requires significant headroom)
- **shm_size:** 2 GB (`/dev/shm` must be large enough for browser rendering)
- **Health port:** 3002 (HTTP server inside worker, not exposed to Traefik)
- **Concurrency:** `EXECUTION_MAX_CONCURRENCY=2` (processes up to 2 test jobs in parallel)
- **Job timeout:** `EXECUTION_JOB_TIMEOUT=600000` (10 minutes per test execution)

The backend container also has `EXECUTION_MAX_CONCURRENCY=2` set in its compose environment section, which means it runs a local BullMQ worker as a fallback. Together, the system can process up to 4 concurrent test executions.

---

## 3. Environment Variables

### How Environment Loading Works

1. The `.env` file is loaded via `env_file:` in `docker-compose.yml`.
2. The `environment:` section in compose **overrides** any value from `env_file`.
3. In the backend Dockerfile, `ENV NODE_ENV=production` is baked into the image.

This means: `.env` file < compose `environment:` < Dockerfile `ENV`.

For example, even if `.env` has `EXECUTION_MAX_CONCURRENCY=0`, the compose `environment: - EXECUTION_MAX_CONCURRENCY=2` wins.

### Required Secrets (Must Generate Before Deploy)

| Variable | Where Used | How to Generate |
|----------|------------|-----------------|
| `POSTGRES_PASSWORD` | PostgreSQL, DATABASE_URL | `openssl rand -base64 32` |
| `REDIS_PASSWORD` | Redis command config, REDIS_URL | `openssl rand -base64 32` |
| `JWT_SECRET` | Backend auth tokens | `openssl rand -base64 64` |
| `JWT_REFRESH_SECRET` | Backend refresh tokens | `openssl rand -base64 64` |
| `SESSION_SECRET` | Backend session encryption | `openssl rand -base64 64` |
| `ENCRYPTION_KEY` | Encrypt GitHub tokens, secrets at rest | `openssl rand -base64 32` |
| `STORAGE_SECRET_KEY` | MinIO object storage | `openssl rand -base64 32` |

### Critical Connection Variables

These are set in the `.env` file and use the container hostnames (Docker service names) for inter-container networking:

```env
# Database (use container hostname "postgres", not "localhost")
DATABASE_URL=postgresql://qa_guardian:YOUR_POSTGRES_PASSWORD@postgres:5432/qa_guardian

# Redis (use container hostname "redis", not "localhost")
REDIS_URL=redis://:YOUR_REDIS_PASSWORD@redis:6379

# Redis password must ALSO be set separately because the redis container
# uses it in its --requirepass command argument
REDIS_PASSWORD=YOUR_REDIS_PASSWORD

# Frontend URL (used for CORS configuration and OAuth redirects)
FRONTEND_URL=https://qa.pixelcraftedmedia.com
```

### Compose-Level Overrides (set in docker-compose.yml, not .env)

These are set directly in the compose `environment:` section and override `.env` values:

| Variable | Value | Service | Purpose |
|----------|-------|---------|---------|
| `EXECUTION_MAX_CONCURRENCY` | `2` | backend, worker | Number of concurrent test executions per container |
| `EXECUTION_JOB_TIMEOUT` | `600000` | worker | Max milliseconds per test job (10 min) |
| `WORKER_HEALTH_PORT` | `3002` | worker | Health check HTTP port inside worker |
| `NODE_OPTIONS` | `--max-old-space-size=1536` | backend, worker | Limit Node.js heap to 1.5 GB |

### Optional Integration Variables

| Variable | Purpose |
|----------|---------|
| `KIE_API_KEY` | Kie.ai API for AI features (primary, 70% cost savings) |
| `ANTHROPIC_API_KEY` | Anthropic Claude API (fallback) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth sign-in |
| `GITHUB_APP_ID` / `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub PR integration |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Email notifications |
| `SENTRY_DSN` | Error tracking |
| `ALERT_WEBHOOK_URL` | Discord/Slack webhook for health alerts |
| `ZAP_API_KEY` | OWASP ZAP scanner API key |

---

## 4. CI/CD Pipeline

The deployment pipeline is defined in `.github/workflows/deploy.yml` and triggered on push to `main` or manual dispatch via `workflow_dispatch`.

### Pipeline Overview

```
Push to main
    |
    v
Job 1: Build & Test (ubuntu-latest)
    - Checkout code
    - Install backend deps (npm ci)
    - Lint backend (eslint)
    - Build backend (tsc)
    - Test backend (vitest)
    - Install frontend deps (npm ci)
    - Build frontend (vite build with production VITE_* env vars)
    |
    v (only on push/dispatch, not PRs)
Job 2: Deploy to Production (via SSH)
    - SSH into 38.111.111.206
    - cd /opt/qa-guardian
    - git fetch origin main && git reset --hard origin/main
    - docker compose build --no-cache backend worker frontend
    - docker compose up -d --force-recreate backend worker frontend
    - Health check loop (12 attempts, 10s apart = 120s max)
    - Run database migrations (npm run migrate)
    - Verify worker container health
    - External verification: curl frontend + backend through Traefik
```

### Why --no-cache on Build

The `--no-cache` flag is used deliberately. BuildKit layer caching can serve stale builds when only source files change but the Dockerfile does not. Since the backend COPY step copies all source, Docker may re-use a cached layer if file timestamps do not change the layer hash. Using `--no-cache` ensures the latest source is always compiled.

### GitHub Secrets Required

| Secret | Value | Notes |
|--------|-------|-------|
| `DOKPLOY_HOST` | `38.111.111.206` | Server IP address |
| `DOKPLOY_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----...` | ed25519 private key (see Section 0.8) |
| `DOKPLOY_USER` | `root` | SSH username |

### Setting Up SSH Keys for CI/CD

```bash
# On the production server
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy -N ""

# Authorize the key
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys

# Copy the PRIVATE key -- this goes into the GitHub secret
cat ~/.ssh/github_deploy
```

Then in GitHub: Repository Settings > Secrets and variables > Actions > New repository secret.

### Concurrency Control

The workflow uses concurrency groups to prevent overlapping deployments:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

If a new push arrives while a deploy is running, the in-progress deploy is cancelled.

---

## 5. Manual Deployment

### Quick Deploy (Existing Setup)

When the server is already running and you just need to update the code:

```bash
ssh root@38.111.111.206
cd /opt/qa-guardian
git fetch origin main
git reset --hard origin/main

# Rebuild and deploy (backend, worker, and frontend)
docker compose -f docker-compose.yml -f docker-compose.deploy.yml build --no-cache backend worker frontend
docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d --force-recreate backend worker frontend

# Wait for backend health
for i in $(seq 1 12); do
  sleep 10
  if docker exec qa-guardian-backend curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo "Backend healthy!"
    break
  fi
  echo "Attempt $i/12..."
done

# Run migrations
docker exec qa-guardian-backend npm run migrate
```

### Full Rebuild (All Services Including Infrastructure)

Use this when you need to rebuild everything, including database and cache containers:

```bash
ssh root@38.111.111.206
cd /opt/qa-guardian
git fetch origin main
git reset --hard origin/main

# Stop everything
docker compose -f docker-compose.yml -f docker-compose.deploy.yml down

# Rebuild and start all services
docker compose -f docker-compose.yml -f docker-compose.deploy.yml build --no-cache
docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d

# Wait for health and run migrations
sleep 30
docker exec qa-guardian-backend npm run migrate
```

> **Warning:** `docker compose down` stops all containers but preserves volumes. Data in PostgreSQL and Redis is safe. If you also want to destroy volumes (full reset), add `--volumes` -- but this destroys all data.

### First-Time Deploy (Infrastructure First)

When deploying to a fresh server (after completing Section 0):

```bash
cd /opt/qa-guardian

# Step 1: Start infrastructure only
docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d postgres redis

# Step 2: Verify infrastructure is healthy
docker compose -f docker-compose.yml -f docker-compose.deploy.yml ps
# Both should show "healthy"

# Step 3: Build and start application services
docker compose -f docker-compose.yml -f docker-compose.deploy.yml build --no-cache backend worker frontend
docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d

# Step 4: Run initial migrations
sleep 30
docker exec qa-guardian-backend npm run migrate

# Step 5: Verify
curl -sf https://qa.pixelcraftedmedia.com/api/v1/health
curl -sf https://qa.pixelcraftedmedia.com/
```

### Deploy Only Backend (No Frontend Changes)

```bash
cd /opt/qa-guardian
git fetch origin main && git reset --hard origin/main
docker compose -f docker-compose.yml -f docker-compose.deploy.yml build --no-cache backend worker
docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d --force-recreate backend worker
sleep 30
docker exec qa-guardian-backend npm run migrate
```

### Deploy Only Frontend

```bash
cd /opt/qa-guardian
git fetch origin main && git reset --hard origin/main
docker compose -f docker-compose.yml -f docker-compose.deploy.yml build --no-cache frontend
docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d --force-recreate frontend
```

### Run Database Migrations Manually

```bash
docker exec qa-guardian-backend npm run migrate
```

To roll back the last migration:

```bash
docker exec qa-guardian-backend npm run migrate:down
```

---

## 6. Health Checks and Diagnostics

### Application Health Endpoints

The backend exposes three health endpoints with different levels of detail:

| Endpoint | Auth Required | Purpose | Response |
|----------|---------------|---------|----------|
| `GET /health` | No | Docker/Traefik liveness probe | `{"status":"ok","timestamp":"..."}` or 503 |
| `GET /health/queue` | No | BullMQ queue diagnostics | Queue job counts (waiting, active, completed, failed) and worker count |
| `GET /health/detailed` | Yes (JWT) | Full system diagnostics | Database, cache, disk, memory, backup status, queue, migrations, errors, version |

### Checking Health from the Server

```bash
# Basic liveness (inside Docker network)
docker exec qa-guardian-backend curl -sf http://localhost:3001/health

# Queue status (inside Docker network -- useful for debugging stuck tests)
docker exec qa-guardian-backend curl -sf http://localhost:3001/health/queue | jq .

# Worker health (worker container only, port 3002)
docker exec qa-guardian-worker curl -sf http://localhost:3002/health

# Through Traefik (external -- verifies full routing chain)
curl -sf https://qa.pixelcraftedmedia.com/api/v1/health
```

### Queue Health Interpretation

The `/health/queue` endpoint is the primary tool for diagnosing test execution issues:

```json
{
  "queue": {
    "waiting": 0,
    "active": 1,
    "completed": 42,
    "failed": 2,
    "workerCount": 2
  },
  "timestamp": "2026-02-14T12:00:00.000Z"
}
```

- **workerCount = 0:** No workers are consuming jobs. Check if the worker container is running.
- **waiting > 0, active = 0:** Jobs queued but not being picked up. Worker may have crashed.
- **active stuck at same number:** A job may be hung. Check worker logs.
- **failed increasing:** Tests are failing. Check test execution logs in the UI.

### Docker Health Checks

Every service has a Docker HEALTHCHECK defined. Check status with:

```bash
# All services
docker compose -f docker-compose.yml -f docker-compose.deploy.yml ps

# Detailed health for a specific container
docker inspect --format='{{json .State.Health}}' qa-guardian-backend | jq .
```

| Service | Health Check | Interval | Start Period |
|---------|-------------|----------|--------------|
| `postgres` | `pg_isready -U qa_guardian` | 10s | -- |
| `redis` | `redis-cli ping` (with auth) | 10s | -- |
| `backend` | `curl -f http://localhost:3001/health` | 30s | 60s |
| `worker` | `curl -f http://localhost:3002/health` | 30s | 30s |
| `frontend` | `curl -f http://localhost/health` | 30s | 5s |

### Checking Logs

```bash
# All services (follow mode)
docker compose -f docker-compose.yml -f docker-compose.deploy.yml logs -f

# Single service, last 200 lines
docker compose -f docker-compose.yml -f docker-compose.deploy.yml logs --tail=200 -f backend

# Worker logs (most useful for debugging test execution)
docker compose -f docker-compose.yml -f docker-compose.deploy.yml logs --tail=200 -f worker

# Resource usage (CPU, memory per container)
docker stats --no-stream
```

### Traefik Routing Verification

```bash
# Check Traefik logs for routing issues
docker logs dokploy-traefik 2>&1 | tail -50

# Verify backend and frontend are on dokploy-network
docker inspect qa-guardian-backend --format='{{json .NetworkSettings.Networks}}' | jq 'keys'
docker inspect qa-guardian-frontend --format='{{json .NetworkSettings.Networks}}' | jq 'keys'
# Both should include "qa-guardian_qa-network" and "dokploy-network"

# Verify traefik.docker.network label is set (required for multi-network containers)
docker inspect qa-guardian-frontend --format='{{index .Config.Labels "traefik.docker.network"}}'
# Should return: dokploy-network

# Test routing directly
curl -s -o /dev/null -w "Frontend: %{http_code}\n" https://qa.pixelcraftedmedia.com/
curl -s -o /dev/null -w "Backend API: %{http_code}\n" https://qa.pixelcraftedmedia.com/api/v1/health
# Frontend should be 200, Backend API should be non-502 (404 is OK -- proves routing works)

# Check for conflicts between Docker labels and Dokploy file config
docker exec dokploy-traefik wget -qO- http://localhost:8080/api/http/routers 2>&1 | python3 -m json.tool | grep -B 2 'qa-guardian'
# Look for duplicate @docker vs @file entries -- file config takes priority if its priority number is higher
```

### Dokploy File Config

Traefik routing comes from two sources:

1. **Docker labels** (in `docker-compose.deploy.yml`) -- handles frontend, backend API, WebSocket, HTTP-to-HTTPS redirect
2. **Dokploy file config** (`/etc/dokploy/traefik/dynamic/qa-guardian.yml`) -- handles `/health` and `/mcp` routes only

The file config must NOT duplicate routes already in Docker labels. If both define the same router name (e.g., `qa-guardian-frontend`), Traefik merges them by provider -- the `@file` version may have higher auto-calculated priority and win, causing 502 if it points to a wrong port.

```bash
# View current file config
cat /etc/dokploy/traefik/dynamic/qa-guardian.yml

# The file should only contain:
# - qa-guardian-health router (priority 100) -> backend:3006
# - qa-guardian-mcp router (priority 150) -> mcp:3008
# - redirect-to-https and mcp-stripprefix middlewares
```

---

## 7. Troubleshooting

### Tests Stuck at "Preparing tests..."

The UI shows "Preparing tests..." but tests never start. This means jobs are queued in BullMQ but no worker is consuming them.

```bash
# 1. Check queue status
docker exec qa-guardian-backend curl -sf http://localhost:3001/health/queue | jq .
# Look at workerCount. If 0, no worker is active.

# 2. Check if the worker container is running
docker ps --filter name=qa-guardian-worker --format "{{.Status}}"

# 3. Check worker logs for crash information
docker logs --tail=50 qa-guardian-worker

# 4. Restart the worker
docker compose -f docker-compose.yml -f docker-compose.deploy.yml restart worker

# 5. If the worker keeps crashing, check memory
docker stats --no-stream qa-guardian-worker
# If memory is near the 3GB limit, Chromium is OOM-killing the process
```

### Stale BullMQ Jobs After Redeploy

After a redeploy, old jobs may linger in the queue from the previous container lifecycle.

The backend automatically cleans stale jobs on startup. If you still see stuck jobs:

```bash
# Check for stale jobs
docker exec qa-guardian-backend curl -sf http://localhost:3001/health/queue | jq .

# Manually drain all waiting jobs via Redis CLI
docker exec qa-guardian-redis redis-cli -a YOUR_REDIS_PASSWORD
> DEL bull:test-execution:wait
> DEL bull:test-execution:active
> DEL bull:test-execution:delayed
> exit

# Restart backend to re-register the worker
docker compose -f docker-compose.yml -f docker-compose.deploy.yml restart backend worker
```

### Migration "Missing initializer" Error

This error occurs when node-pg-migrate tries to load a `.ts` migration file instead of the compiled `.cjs` file.

```
Error: Missing initializer in migration file
```

**Root cause:** The Dockerfile compiles `.ts` migrations to `.cjs` and deletes the `.ts` originals. If the build step failed or was cached incorrectly, `.ts` files may still exist.

**Fix:** Rebuild without cache:

```bash
docker compose -f docker-compose.yml -f docker-compose.deploy.yml build --no-cache backend
docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d --force-recreate backend
docker exec qa-guardian-backend npm run migrate
```

The relevant Dockerfile step:

```dockerfile
# Compile migrations to CJS and remove TypeScript source
RUN npx tsc migrations/*.ts --outDir migrations --module CommonJS --moduleResolution Node --esModuleInterop --skipLibCheck \
    && for f in migrations/*.js; do mv "$f" "${f%.js}.cjs"; done \
    && rm -f migrations/*.ts
```

### Chromium Crashes in Docker

Playwright browsers crash with errors like `Protocol error`, `Target closed`, or `OOM killed`.

**Required configuration (already in docker-compose.yml):**

```yaml
worker:
  shm_size: '2gb'        # Required: Chromium uses /dev/shm for rendering
  environment:
    - NODE_OPTIONS=--max-old-space-size=1536  # Limit Node heap to leave room for Chromium
  deploy:
    resources:
      limits:
        memory: 3G        # Chromium + Node together need ~2-3 GB
```

**Chromium launch flags (already in application code):**

```
--no-sandbox
--disable-setuid-sandbox
--disable-dev-shm-usage
```

**If crashes persist:**

```bash
# Check if /dev/shm is large enough inside the container
docker exec qa-guardian-worker df -h /dev/shm
# Should show 2.0G

# Check memory usage
docker stats --no-stream qa-guardian-worker

# Reduce concurrency if memory constrained
# Edit docker-compose.yml: EXECUTION_MAX_CONCURRENCY=1
```

### Docker Disk Full from --no-cache Builds

Each `--no-cache` build creates new image layers. Over time, old layers consume disk space.

```bash
# Check disk usage
df -h /
docker system df

# Clean up everything (images, containers, build cache)
docker system prune -af
docker builder prune -af

# Check disk after cleanup
df -h /
```

**Prevention:** Schedule regular cleanup (see [Section 9: Maintenance](#9-maintenance)).

### EXECUTION_MAX_CONCURRENCY=0 Means No Local Worker

If the `.env` file sets `EXECUTION_MAX_CONCURRENCY=0` but you expect the backend to process jobs locally, check the compose override:

```yaml
# docker-compose.yml - this OVERRIDES the .env value
environment:
  - EXECUTION_MAX_CONCURRENCY=2
```

The compose `environment:` always wins over `env_file:`. If you see `EXECUTION_MAX_CONCURRENCY=0` in `.env` but `=2` in compose, the backend will process 2 jobs concurrently.

To verify the actual value inside a running container:

```bash
docker exec qa-guardian-backend printenv EXECUTION_MAX_CONCURRENCY
```

### ESM __dirname Error

```
ReferenceError: __dirname is not defined in ES module scope
```

The backend uses `"type": "module"` (ESM). The global `__dirname` is not available in ESM. Use the `fileURLToPath` pattern instead:

```typescript
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

This is already handled throughout the codebase. If you see this error, a new file is using `__dirname` directly -- update it to the ESM pattern.

### 502 Bad Gateway Through Traefik

Traefik returns 502 when it cannot reach a container. This can happen for several reasons:

**Step 1: Check if the container is running and healthy**

```bash
docker ps --filter name=qa-guardian-backend
docker ps --filter name=qa-guardian-frontend
docker exec qa-guardian-backend curl -sf http://localhost:3001/health
docker exec qa-guardian-frontend curl -sf http://localhost/health
```

**Step 2: Verify the container is on dokploy-network**

```bash
docker inspect qa-guardian-frontend --format='{{json .NetworkSettings.Networks}}' | jq 'keys'
# Must include "dokploy-network"

# If not on dokploy-network, you deployed without the overlay
docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d --force-recreate backend frontend
```

**Step 3: Check for Dokploy file config conflicts**

Dokploy stores Traefik routing rules in `/etc/dokploy/traefik/dynamic/qa-guardian.yml`. If this file has stale routes that conflict with Docker labels, the file-based routes may win due to higher priority.

```bash
# View the file-based config
cat /etc/dokploy/traefik/dynamic/qa-guardian.yml

# Check Traefik's active routers via API (look for duplicate @file vs @docker entries)
docker exec dokploy-traefik wget -qO- http://localhost:8080/api/http/routers | python3 -m json.tool | grep -A 5 'qa-guardian-frontend'

# Check which service Traefik is routing to (look for wrong ports or IPs)
docker exec dokploy-traefik wget -qO- http://localhost:8080/api/http/services | python3 -m json.tool | grep -A 5 'qa-guardian-frontend'
```

The file config should only contain routes NOT handled by Docker labels (`/health`, `/mcp`). Frontend, backend API, and WebSocket routes are managed via Docker labels in `docker-compose.deploy.yml`.

**Step 4: Test connectivity from Traefik to the container**

When a container is on multiple networks, Traefik must use the correct one. The `traefik.docker.network=dokploy-network` label ensures this.

```bash
# Get the container's dokploy-network IP
docker inspect qa-guardian-frontend --format='{{(index .NetworkSettings.Networks "dokploy-network").IPAddress}}'

# Test from inside the Traefik container
docker exec dokploy-traefik wget -qO- --timeout=3 http://<IP>:80/health
```

### Container Fails to Start

```bash
# Check exit code and logs
docker inspect --format='{{.State.Status}} ExitCode={{.State.ExitCode}}' qa-guardian-backend
docker logs --tail=50 qa-guardian-backend

# Common causes:
# ExitCode 1: Application error (check logs for stack trace)
# ExitCode 137: OOM killed (increase memory limit)
# ExitCode 0 + restarting: Process exited cleanly but restart policy re-launches

# Check dependent services are healthy
docker compose -f docker-compose.yml -f docker-compose.deploy.yml ps
```

### WebSocket Connections Fail

```bash
# 1. Verify Traefik labels include /socket.io router
docker inspect qa-guardian-backend --format='{{json .Config.Labels}}' | jq . | grep socket

# 2. Check CORS configuration
docker exec qa-guardian-backend printenv FRONTEND_URL
# Must be: https://qa.pixelcraftedmedia.com

# 3. Test WebSocket routing through Traefik
curl -sf -H "Upgrade: websocket" -H "Connection: Upgrade" \
  https://qa.pixelcraftedmedia.com/socket.io/?EIO=4&transport=polling

# 4. Check backend health
docker exec qa-guardian-backend curl -sf http://localhost:3001/health | jq .
# "socketio" should be true in the checks
```

### SSL Certificate Not Issued

```bash
# Check Traefik logs for ACME / Let's Encrypt errors
docker logs dokploy-traefik 2>&1 | grep -i "acme\|certificate\|challenge"

# Verify DNS resolves correctly
dig qa.pixelcraftedmedia.com +short
# Must return 38.111.111.206

# Ensure port 80 is open (required for HTTP-01 challenge)
curl -I http://qa.pixelcraftedmedia.com

# If using Cloudflare proxy, ensure it's set to "DNS only" (grey cloud)
# for initial certificate issuance, then switch to "Proxied" after
```

---

## 8. Database Backup and Restore

### Automated Backups

The `backup` service runs automatically alongside the stack. It:

1. Creates a compressed PostgreSQL dump on startup
2. Runs a backup every 24 hours
3. Deletes backups older than 30 days (configurable via `RETENTION_DAYS`)
4. Stores backups in the `backup_data` Docker volume

### Manual Backup

```bash
# Quick backup using Docker exec
docker exec qa-guardian-postgres pg_dump -U qa_guardian qa_guardian | gzip > /opt/backups/qa_guardian_$(date +%Y%m%d_%H%M%S).sql.gz

# Using the backup script (more features)
docker exec qa-guardian-backup bash /usr/local/bin/backup-db.sh

# Verify the latest backup
docker exec qa-guardian-backup bash /usr/local/bin/backup-db.sh --verify

# List all backups
docker exec qa-guardian-backup bash /usr/local/bin/backup-db.sh --list

# Check backup status (JSON)
docker exec qa-guardian-backup bash /usr/local/bin/backup-db.sh --status
```

### Copy Backup Off-Server

```bash
# Find the backup volume mount
docker volume inspect qa-guardian_backup_data --format='{{.Mountpoint}}'

# Copy the latest backup to your local machine
scp root@38.111.111.206:/var/lib/docker/volumes/qa-guardian_backup_data/_data/qa_guardian_*.sql.gz ./

# Or copy to a specific path
docker cp qa-guardian-backup:/opt/backups/qa_guardian_20260214_020000.sql.gz /tmp/
scp root@38.111.111.206:/tmp/qa_guardian_20260214_020000.sql.gz ./
```

### Restore from Backup

```bash
# Stop the application to prevent writes during restore
docker compose -f docker-compose.yml -f docker-compose.deploy.yml stop backend worker

# Restore (interactive -- will ask for confirmation)
docker exec -it qa-guardian-backup bash /usr/local/bin/backup-db.sh --restore /opt/backups/qa_guardian_20260214_020000.sql.gz

# Alternative: manual restore using psql
gunzip -c qa_guardian_20260214_020000.sql.gz | \
  docker exec -i qa-guardian-postgres psql -U qa_guardian -d qa_guardian --quiet

# Restart the application
docker compose -f docker-compose.yml -f docker-compose.deploy.yml start backend worker

# Run migrations to apply any schema changes since the backup
docker exec qa-guardian-backend npm run migrate
```

### Point-in-Time Recovery

For disaster recovery, consider setting up a remote backup destination:

```bash
# Cron job to copy daily backup off-server (add to host crontab)
# crontab -e
0 3 * * * docker cp qa-guardian-backup:/opt/backups/$(ls -t /var/lib/docker/volumes/qa-guardian_backup_data/_data/ | head -1) /opt/offsite-backups/ && rsync -az /opt/offsite-backups/ remote-backup-server:/backups/qa-guardian/
```

---

## 9. Maintenance

### Docker Cleanup Schedule

Docker builds with `--no-cache` accumulate old images and layers. Schedule regular cleanup:

```bash
# Add to root crontab: crontab -e

# Weekly cleanup of unused Docker resources (Sunday 4 AM)
0 4 * * 0 docker system prune -af --filter "until=168h" >> /var/log/docker-cleanup.log 2>&1

# Monthly builder cache cleanup (1st of month, 4:30 AM)
30 4 1 * * docker builder prune -af >> /var/log/docker-cleanup.log 2>&1
```

### Log Rotation

Docker container logs are configured with `json-file` driver and limits in the compose files:

| Service | Max Size | Max Files | Total Max |
|---------|----------|-----------|-----------|
| backend, worker | 50 MB | 5 | 250 MB |
| postgres, redis, frontend, mcp-server | 10 MB | 3 | 30 MB |

These limits are set in the `dokploy/docker-compose.yml` logging configuration. The base `docker-compose.yml` does not set logging limits, so for deployments using the overlay pattern, consider adding the Docker daemon default log rotation:

```bash
# /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  }
}
```

After editing, restart Docker:

```bash
systemctl restart docker
```

### Monitoring Uptime

#### Option 1: Built-in Health Monitor

The backend supports webhook-based health alerts (Feature #170). Configure in `.env`:

```env
ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
HEALTH_CHECK_INTERVAL=300    # Check every 5 minutes
ALERT_THRESHOLD=2            # Alert after 2 consecutive failures
```

#### Option 2: External Uptime Monitoring

Set up an external monitor (UptimeRobot, Better Uptime, etc.) to ping:

- **Primary:** `https://qa.pixelcraftedmedia.com/health` (liveness, no auth)
- **API routing:** `https://qa.pixelcraftedmedia.com/api/v1/health` (verifies Traefik routing)
- **Queue health:** `https://qa.pixelcraftedmedia.com/health/queue` (verifies BullMQ)

#### Option 3: Simple Cron-based Monitoring

```bash
# /opt/qa-guardian/scripts/health-monitor.sh
#!/bin/bash
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" https://qa.pixelcraftedmedia.com/health)
if [ "$STATUS" != "200" ]; then
  curl -X POST "$ALERT_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"content\": \"QA Guardian health check FAILED (HTTP $STATUS) at $(date)\"}"
fi
```

```bash
# Crontab entry -- check every 5 minutes
*/5 * * * * /opt/qa-guardian/scripts/health-monitor.sh
```

### Updating Node.js Version

The backend Dockerfile pins to `node:20-slim`. To update:

1. Edit `backend/Dockerfile` -- change the `FROM node:20-slim` base image
2. Edit `.github/workflows/deploy.yml` -- change the `NODE_VERSION` env var
3. Test locally with `docker compose build backend`
4. Push to main -- CI/CD will rebuild and deploy

### Scaling Worker Concurrency

If tests are queuing up (high `waiting` count in `/health/queue`), increase concurrency:

```yaml
# In docker-compose.yml, worker service:
environment:
  - EXECUTION_MAX_CONCURRENCY=3  # Increase from 2 to 3
```

Make sure the server has enough RAM. Each concurrent Playwright browser needs approximately 500 MB - 1 GB.

---

## 10. Security Checklist

Before going live, verify every item:

### Secrets and Credentials

- [ ] All `CHANGE_ME` and `GENERATE_*` placeholders in `.env` have been replaced
- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are unique, random, at least 64 bytes
- [ ] `ENCRYPTION_KEY` is random, 32 bytes (for encrypting GitHub tokens, secrets at rest)
- [ ] `POSTGRES_PASSWORD` and `REDIS_PASSWORD` are random, at least 32 bytes
- [ ] No `.env` file is committed to version control (verify `.gitignore`)
- [ ] GitHub Actions secrets (`DOKPLOY_SSH_KEY`, etc.) are set and not logged

### Network Security

- [ ] PostgreSQL is NOT exposed on a host port (no `ports:` in production compose)
- [ ] Redis is NOT exposed on a host port
- [ ] MinIO is NOT exposed on a host port
- [ ] Worker is NOT exposed to Traefik (internal network only)
- [ ] ZAP API is restricted to backend container access only
- [ ] Firewall (`ufw`) allows only ports 22, 80, 443

### SSL and Domain

- [ ] SSL certificate is active: `curl -vI https://qa.pixelcraftedmedia.com 2>&1 | grep "SSL certificate"`
- [ ] HTTP-to-HTTPS redirect works: `curl -I http://qa.pixelcraftedmedia.com` returns 301/308
- [ ] HSTS header is set (check Traefik middleware configuration if needed)

### Application Security

- [ ] `FRONTEND_URL` is set to the production domain only (not `*` or localhost)
- [ ] `CORS_ORIGINS` does not include wildcard origins in production
- [ ] Rate limiting is enabled (default: 100 requests per 60 seconds)
- [ ] The `/health/detailed` endpoint requires authentication
- [ ] Default development passwords are NOT used in production (`QaGuardian2024Secure`, `QaGuardianRedis2024`, `minioadmin`)

### Container Security

- [ ] Backend runs with `dumb-init` for proper signal handling
- [ ] Frontend nginx runs as non-root user
- [ ] Docker resource limits are set for all services (prevent single-service OOM)
- [ ] Docker images use multi-stage builds (no build tools in production image)

### Backup Verification

- [ ] Backup service is running: `docker ps --filter name=qa-guardian-backup`
- [ ] A backup has been created: `docker exec qa-guardian-backup bash /usr/local/bin/backup-db.sh --list`
- [ ] Backup integrity verified: `docker exec qa-guardian-backup bash /usr/local/bin/backup-db.sh --verify`
- [ ] Offsite backup strategy is in place (backups copied off the VPS)

---

## Appendix: Quick Reference Commands

```bash
# ============================================
# Status
# ============================================
docker compose -f docker-compose.yml -f docker-compose.deploy.yml ps
docker stats --no-stream
docker exec qa-guardian-backend curl -sf http://localhost:3001/health | jq .
docker exec qa-guardian-backend curl -sf http://localhost:3001/health/queue | jq .
docker exec qa-guardian-worker curl -sf http://localhost:3002/health | jq .

# ============================================
# Deploy (quick)
# ============================================
cd /opt/qa-guardian
git fetch origin main && git reset --hard origin/main
docker compose -f docker-compose.yml -f docker-compose.deploy.yml build --no-cache backend worker frontend
docker compose -f docker-compose.yml -f docker-compose.deploy.yml up -d --force-recreate backend worker frontend
sleep 30 && docker exec qa-guardian-backend npm run migrate

# ============================================
# Logs
# ============================================
docker compose -f docker-compose.yml -f docker-compose.deploy.yml logs -f backend
docker compose -f docker-compose.yml -f docker-compose.deploy.yml logs -f worker
docker compose -f docker-compose.yml -f docker-compose.deploy.yml logs --tail=100 frontend

# ============================================
# Restart individual services
# ============================================
docker compose -f docker-compose.yml -f docker-compose.deploy.yml restart backend
docker compose -f docker-compose.yml -f docker-compose.deploy.yml restart worker
docker compose -f docker-compose.yml -f docker-compose.deploy.yml restart frontend

# ============================================
# Database
# ============================================
docker exec qa-guardian-backend npm run migrate
docker exec qa-guardian-backend npm run migrate:down
docker exec -it qa-guardian-postgres psql -U qa_guardian -d qa_guardian

# ============================================
# Cleanup
# ============================================
docker system prune -af
docker builder prune -af
df -h /
```
