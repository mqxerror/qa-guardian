# QA Guardian Deployment Guide

**Target Server:** MercanAIServer (38.111.111.206)
**Domain:** qa.pixelcraftedmedia.com
**Application:** QA Guardian - Full-Stack QA Automation Platform

---

## Table of Contents

1. [Server Requirements](#1-server-requirements)
2. [Pre-Deployment Checklist](#2-pre-deployment-checklist)
3. [Step-by-Step Deployment](#3-step-by-step-deployment)
4. [Environment Configuration](#4-environment-configuration)
5. [Docker Compose Configuration](#5-docker-compose-configuration)
6. [Traefik/SSL Configuration](#6-traefikssl-configuration)
7. [Post-Deployment Verification](#7-post-deployment-verification)
8. [Maintenance Commands](#8-maintenance-commands)

---

## 1. Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **CPU** | 2 cores | 4+ cores |
| **RAM** | 4 GB | 8+ GB |
| **Disk** | 20 GB | 50+ GB |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

**Current Server Specs:**
- CPU: AMD EPYC 7532 (16 cores)
- RAM: 62 GB
- Disk: 630 GB (106 GB used)
- Docker: Installed with Dokploy

---

## 2. Pre-Deployment Checklist

### On Local Machine

```bash
# 1. Build frontend for production
cd /Users/mqxerrormac16/Documents/QA-Dam3oun/frontend
npm install
npm run build

# 2. Build backend
cd /Users/mqxerrormac16/Documents/QA-Dam3oun/backend
npm install
npm run build

# 3. Create deployment archive
cd /Users/mqxerrormac16/Documents/QA-Dam3oun
tar -czvf qa-guardian.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='*.db' \
  --exclude='traces' \
  --exclude='videos' \
  --exclude='screenshots' \
  --exclude='baselines' \
  .
```

### On Server

```bash
# SSH into server
ssh root@38.111.111.206

# Create application directory
mkdir -p /opt/qa-guardian
cd /opt/qa-guardian
```

---

## 3. Step-by-Step Deployment

### Step 1: Transfer Files to Server

```bash
# From local machine
scp qa-guardian.tar.gz root@38.111.111.206:/opt/qa-guardian/

# On server - extract files
cd /opt/qa-guardian
tar -xzvf qa-guardian.tar.gz
rm qa-guardian.tar.gz
```

### Step 2: Create Environment File

```bash
# On server
cat > /opt/qa-guardian/.env << 'EOF'
# ===========================================
# QA Guardian Production Configuration
# Domain: qa.pixelcraftedmedia.com
# ===========================================

# Application
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://qa.pixelcraftedmedia.com

# Database (PostgreSQL)
DATABASE_URL=postgresql://qa_guardian:QaGuardian2024!Secure@postgres:5432/qa_guardian
POSTGRES_USER=qa_guardian
POSTGRES_PASSWORD=QaGuardian2024!Secure
POSTGRES_DB=qa_guardian

# Redis
REDIS_URL=redis://redis:6379

# Authentication (CHANGE THESE!)
JWT_SECRET=CHANGE_ME_production_jwt_secret_min_32_chars_random
JWT_REFRESH_SECRET=CHANGE_ME_production_refresh_secret_min_32_chars
SESSION_SECRET=CHANGE_ME_production_session_secret_min_32_chars
SESSION_TIMEOUT_DAYS=7

# Storage (MinIO/S3)
STORAGE_ENDPOINT=minio
STORAGE_PORT=9000
STORAGE_ACCESS_KEY=qaGuardianAdmin
STORAGE_SECRET_KEY=QaGuardian2024!MinioSecure
STORAGE_BUCKET=qa-guardian-artifacts
STORAGE_USE_SSL=false
STORAGE_PUBLIC_URL=https://qa.pixelcraftedmedia.com/storage

# AI Providers
AI_PROVIDER_PRIMARY=kie
AI_PROVIDER_FALLBACK=anthropic
KIE_API_KEY=your_kie_api_key_here
KIE_API_URL=https://api.kie.ai/v1
KIE_DEFAULT_MODEL=claude-3-haiku-20240307
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_API_URL=https://api.anthropic.com/v1
ANTHROPIC_DEFAULT_MODEL=claude-3-haiku-20240307
AI_FALLBACK_ON_ERROR=true
AI_FALLBACK_ON_TIMEOUT=true
AI_TIMEOUT_MS=30000
AI_RETRY_COUNT=2
AI_COST_TRACKING=true
AI_MONTHLY_BUDGET_USD=100
AI_BUDGET_ALERT_THRESHOLD=0.8
AI_CACHE_ENABLED=true
AI_CACHE_TTL_SECONDS=3600

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGINS=https://qa.pixelcraftedmedia.com,http://localhost:3000

# Email (Optional - configure if needed)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@pixelcraftedmedia.com

# OAuth (Optional - configure if needed)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://qa.pixelcraftedmedia.com/api/v1/auth/google/callback
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=
EOF
```

### Step 3: Create Docker Compose File

```bash
cat > /opt/qa-guardian/docker-compose.yml << 'EOF'
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: qa-guardian-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - qa-guardian-network

  # Redis Cache & Queue
  redis:
    image: redis:7-alpine
    container_name: qa-guardian-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - qa-guardian-network

  # MinIO Object Storage
  minio:
    image: minio/minio:latest
    container_name: qa-guardian-minio
    restart: unless-stopped
    environment:
      MINIO_ROOT_USER: ${STORAGE_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${STORAGE_SECRET_KEY}
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 30s
      timeout: 20s
      retries: 3
    networks:
      - qa-guardian-network

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: qa-guardian-backend
    restart: unless-stopped
    environment:
      - NODE_ENV=${NODE_ENV}
      - PORT=${PORT}
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - SESSION_SECRET=${SESSION_SECRET}
      - STORAGE_ENDPOINT=${STORAGE_ENDPOINT}
      - STORAGE_PORT=${STORAGE_PORT}
      - STORAGE_ACCESS_KEY=${STORAGE_ACCESS_KEY}
      - STORAGE_SECRET_KEY=${STORAGE_SECRET_KEY}
      - STORAGE_BUCKET=${STORAGE_BUCKET}
      - STORAGE_USE_SSL=${STORAGE_USE_SSL}
      - AI_PROVIDER_PRIMARY=${AI_PROVIDER_PRIMARY}
      - AI_PROVIDER_FALLBACK=${AI_PROVIDER_FALLBACK}
      - KIE_API_KEY=${KIE_API_KEY}
      - KIE_API_URL=${KIE_API_URL}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - ANTHROPIC_API_URL=${ANTHROPIC_API_URL}
      - CORS_ORIGINS=${CORS_ORIGINS}
      - FRONTEND_URL=${FRONTEND_URL}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.qa-guardian-api.rule=Host(`qa.pixelcraftedmedia.com`) && PathPrefix(`/api`)"
      - "traefik.http.routers.qa-guardian-api.entrypoints=websecure"
      - "traefik.http.routers.qa-guardian-api.tls.certresolver=letsencrypt"
      - "traefik.http.services.qa-guardian-api.loadbalancer.server.port=3001"
      # WebSocket support
      - "traefik.http.routers.qa-guardian-ws.rule=Host(`qa.pixelcraftedmedia.com`) && PathPrefix(`/socket.io`)"
      - "traefik.http.routers.qa-guardian-ws.entrypoints=websecure"
      - "traefik.http.routers.qa-guardian-ws.tls.certresolver=letsencrypt"
      - "traefik.http.services.qa-guardian-ws.loadbalancer.server.port=3001"
    networks:
      - qa-guardian-network
      - dokploy-network

  # Frontend (Nginx serving static files)
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: qa-guardian-frontend
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:80"]
      interval: 30s
      timeout: 10s
      retries: 3
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.qa-guardian-frontend.rule=Host(`qa.pixelcraftedmedia.com`)"
      - "traefik.http.routers.qa-guardian-frontend.entrypoints=websecure"
      - "traefik.http.routers.qa-guardian-frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.qa-guardian-frontend.loadbalancer.server.port=80"
      # Redirect HTTP to HTTPS
      - "traefik.http.routers.qa-guardian-http.rule=Host(`qa.pixelcraftedmedia.com`)"
      - "traefik.http.routers.qa-guardian-http.entrypoints=web"
      - "traefik.http.routers.qa-guardian-http.middlewares=https-redirect"
      - "traefik.http.middlewares.https-redirect.redirectscheme.scheme=https"
    networks:
      - qa-guardian-network
      - dokploy-network

networks:
  qa-guardian-network:
    driver: bridge
  dokploy-network:
    external: true

volumes:
  postgres_data:
  redis_data:
  minio_data:
EOF
```

### Step 4: Create Backend Dockerfile

```bash
cat > /opt/qa-guardian/backend/Dockerfile << 'EOF'
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY dist ./dist
COPY templates ./templates

# Create directories for artifacts
RUN mkdir -p /app/screenshots /app/traces /app/videos /app/baselines

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
EOF
```

### Step 5: Create Frontend Dockerfile

```bash
cat > /opt/qa-guardian/frontend/Dockerfile << 'EOF'
FROM nginx:alpine

# Copy built frontend
COPY dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
EOF
```

### Step 6: Create Frontend Nginx Config

```bash
cat > /opt/qa-guardian/frontend/nginx.conf << 'EOF'
server {
    listen 80;
    server_name qa.pixelcraftedmedia.com;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check endpoint
    location /nginx-health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF
```

### Step 7: Create Database Init Script

```bash
mkdir -p /opt/qa-guardian/docker

cat > /opt/qa-guardian/docker/init-db.sql << 'EOF'
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE qa_guardian TO qa_guardian;
EOF
```

### Step 8: Build and Deploy

```bash
cd /opt/qa-guardian

# Install backend dependencies and build
cd backend
npm ci
npm run build
cd ..

# Install frontend dependencies and build with production API URL
cd frontend
npm ci
VITE_API_URL=https://qa.pixelcraftedmedia.com npm run build
cd ..

# Start the application
docker compose up -d --build

# Check status
docker compose ps
docker compose logs -f
```

---

## 4. Environment Configuration

### Required Secrets (MUST CHANGE)

Generate secure secrets for production:

```bash
# Generate random secrets
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For JWT_REFRESH_SECRET
openssl rand -base64 32  # For SESSION_SECRET
```

### AI Provider Keys

Update the `.env` file with your actual API keys:

```bash
# Edit .env file
nano /opt/qa-guardian/.env

# Update these values:
KIE_API_KEY=your_actual_kie_api_key
ANTHROPIC_API_KEY=your_actual_anthropic_api_key
```

---

## 5. Docker Compose Configuration

### Useful Commands

```bash
cd /opt/qa-guardian

# Start all services
docker compose up -d

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend
docker compose logs -f frontend

# Restart a service
docker compose restart backend

# Stop all services
docker compose down

# Stop and remove volumes (CAUTION: destroys data)
docker compose down -v

# Rebuild and restart
docker compose up -d --build --force-recreate
```

---

## 6. Traefik/SSL Configuration

The server already has Traefik (Dokploy) running. The Docker Compose labels configure:

- **HTTPS** with Let's Encrypt certificates
- **HTTP to HTTPS redirect**
- **WebSocket support** for Socket.IO
- **API routing** at `/api/*`

### DNS Configuration

Add an A record for your domain:

| Type | Name | Value |
|------|------|-------|
| A | qa | 38.111.111.206 |

Or if using a subdomain directly:

| Type | Name | Value |
|------|------|-------|
| A | qa.pixelcraftedmedia.com | 38.111.111.206 |

---

## 7. Post-Deployment Verification

### Health Checks

```bash
# Check backend health
curl https://qa.pixelcraftedmedia.com/api/health

# Check frontend
curl -I https://qa.pixelcraftedmedia.com

# Check API docs
curl https://qa.pixelcraftedmedia.com/api/docs
```

### Container Health

```bash
docker compose ps
# All services should show "healthy"
```

### Test Login

1. Open https://qa.pixelcraftedmedia.com
2. Register a new account or login
3. Verify WebSocket connection (real-time updates)

---

## 8. Maintenance Commands

### Backup Database

```bash
# Backup PostgreSQL
docker exec qa-guardian-postgres pg_dump -U qa_guardian qa_guardian > backup_$(date +%Y%m%d).sql

# Backup to compressed file
docker exec qa-guardian-postgres pg_dump -U qa_guardian qa_guardian | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Restore Database

```bash
# Restore from backup
cat backup_20240126.sql | docker exec -i qa-guardian-postgres psql -U qa_guardian qa_guardian
```

### Update Application

```bash
cd /opt/qa-guardian

# Pull latest code (if using git)
git pull

# Rebuild and restart
cd backend && npm ci && npm run build && cd ..
cd frontend && npm ci && VITE_API_URL=https://qa.pixelcraftedmedia.com npm run build && cd ..

docker compose up -d --build
```

### View Logs

```bash
# All logs
docker compose logs -f

# Backend only
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend
```

### Monitor Resources

```bash
# Container stats
docker stats

# Disk usage
docker system df
```

---

## Architecture Overview

```
                    ┌─────────────────────────────────┐
                    │         Internet                │
                    └─────────────┬───────────────────┘
                                  │
                    ┌─────────────▼───────────────────┐
                    │    Traefik (Dokploy)            │
                    │    Ports: 80, 443               │
                    │    SSL: Let's Encrypt           │
                    └─────────────┬───────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
┌─────────▼─────────┐   ┌────────▼────────┐   ┌─────────▼─────────┐
│   Frontend        │   │    Backend      │   │   Socket.IO       │
│   (nginx:80)      │   │    (node:3001)  │   │   (node:3001)     │
│   /               │   │    /api/*       │   │   /socket.io/*    │
└───────────────────┘   └────────┬────────┘   └───────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌────────▼────────┐   ┌─────────▼─────────┐   ┌────────▼────────┐
│   PostgreSQL    │   │      Redis        │   │     MinIO       │
│   (port 5432)   │   │   (port 6379)     │   │  (port 9000)    │
│   Database      │   │   Cache/Queue     │   │  Artifacts      │
└─────────────────┘   └───────────────────┘   └─────────────────┘
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs backend

# Check if ports are in use
ss -tulpn | grep -E '3001|5432|6379|9000'
```

### Database connection failed

```bash
# Test database connection
docker exec -it qa-guardian-postgres psql -U qa_guardian -d qa_guardian -c "SELECT 1"
```

### SSL certificate issues

```bash
# Check Traefik logs
docker logs dokploy-traefik

# Verify DNS propagation
dig qa.pixelcraftedmedia.com
```

### WebSocket not connecting

- Ensure Traefik labels include WebSocket routing
- Check CORS_ORIGINS includes your domain
- Verify /socket.io path is proxied correctly

---

## Security Checklist

- [ ] Changed all default passwords
- [ ] Generated unique JWT secrets
- [ ] Configured proper CORS origins
- [ ] SSL certificate active
- [ ] Database not exposed externally
- [ ] MinIO credentials changed
- [ ] API rate limiting enabled
- [ ] Regular backups configured

---

**Deployment Guide Version:** 1.0
**Last Updated:** January 2024
**Application:** QA Guardian
**Domain:** qa.pixelcraftedmedia.com
